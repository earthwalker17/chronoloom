import { Hono } from "hono";
import type { EngineId } from "@shared/constants";
import { CreateSessionBodySchema, TurnBodySchema } from "@shared/schemas";
import type { Choice, DirectorTurn, QueuedEvent, SessionState } from "@shared/types";
import type { AppConfig } from "../config";
import type { Director } from "../engine/director";
import { clampDirectorTurn, lockReason, snapshotOf } from "../sim/clamp";
import { applyDirectorTurn } from "../sim/applyTurn";
import { newSession } from "../sim/newSession";
import { guardReport } from "../sim/reportGuard";
import { SessionStore, StateCorruptError } from "../store/sessionStore";
import { toSessionView } from "../views";

export interface SessionDeps {
  config: AppConfig;
  /** Engines sessions can be pinned to; always contains "scripted". */
  directors: Map<EngineId, Director>;
  defaultEngine: EngineId;
  /** Serves a turn when the primary engine fails (null = fail hard). */
  fallback: Director | null;
  store: SessionStore;
}

const err = (code: string, message: string) => ({ error: { code, message } });

export function sessionRoutes(deps: SessionDeps): Hono {
  const { directors, defaultEngine, fallback, store } = deps;
  const app = new Hono();

  /** Resolve a session's pinned engine; sessions outlive keys, so fall back gracefully. */
  function directorFor(engineId: EngineId): Director {
    const exact = directors.get(engineId);
    if (exact) return exact;
    const def = directors.get(defaultEngine);
    if (def) {
      console.warn(`[engine] ${engineId} unavailable; serving session on ${defaultEngine}`);
      return def;
    }
    // "scripted" is always present — this is the unreachable-in-practice floor.
    return directors.get("scripted") as Director;
  }

  /** Run the engine; on failure, optionally finish the turn on the fallback. */
  async function runEngine<T>(
    engineId: EngineId,
    primary: (d: Director) => Promise<T>,
  ): Promise<{ result: T; engineUsed: string }> {
    const director = directorFor(engineId);
    try {
      return { result: await primary(director), engineUsed: director.name };
    } catch (e) {
      if (fallback && fallback !== director) {
        console.warn(`[engine] ${director.name} failed (${(e as Error).message}); serving turn from fallback`);
        return { result: await primary(fallback), engineUsed: `${fallback.name}-fallback` };
      }
      throw e;
    }
  }

  function applyAndFinish(
    state: SessionState,
    turn: DirectorTurn,
    chosen: Choice | null,
    engineUsed: string,
  ): SessionState {
    const { turn: clean, log } = clampDirectorTurn(turn, state, chosen === null, chosen);
    return applyDirectorTurn(state, clean, chosen, engineUsed, log);
  }

  // --- create session (runs the arrival scene) ---
  app.post("/sessions", async (c) => {
    const body = CreateSessionBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json(err("invalid_identity", "身份无效"), 400);

    let engine: EngineId = defaultEngine;
    if (body.data.provider) {
      if (!directors.has(body.data.provider)) {
        return c.json(err("provider_unavailable", "该执笔者尚未到场（未配置密钥）"), 400);
      }
      engine = body.data.provider;
    }

    const base = newSession(body.data.identityId, engine, body.data.playerNameZh);
    try {
      const { result, engineUsed } = await runEngine(engine, (d) => d.startLife(base));
      const state = applyAndFinish(base, result, null, engineUsed);
      await store.save(state);
      return c.json(toSessionView(state), 201);
    } catch (e) {
      console.error("[sessions] startLife failed:", e);
      return c.json(err("engine_failed", "天机受阻，请稍后再试"), 502);
    }
  });

  // --- resume ---
  app.get("/sessions/:id", async (c) => {
    try {
      const state = await store.load(c.req.param("id"));
      if (!state) return c.json(err("not_found", "未找到这段人生"), 404);
      return c.json(toSessionView(state));
    } catch (e) {
      if (e instanceof StateCorruptError) return c.json(err("state_corrupt", "存档已损坏"), 500);
      throw e;
    }
  });

  // --- take a turn ---
  app.post("/sessions/:id/turn", async (c) => {
    const id = c.req.param("id");
    const body = TurnBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json(err("invalid_choice", "选择无效"), 400);

    return store.withLock(id, async () => {
      let state: SessionState | null;
      try {
        state = await store.load(id);
      } catch (e) {
        if (e instanceof StateCorruptError) return c.json(err("state_corrupt", "存档已损坏"), 500);
        throw e;
      }
      if (!state) return c.json(err("not_found", "未找到这段人生"), 404);
      if (state.finished) return c.json(err("session_ended", "这段人生已经落幕"), 422);
      if (body.data.turn !== state.turn) {
        return c.json(err("turn_conflict", "时辰已过，这一步早已落子"), 409);
      }
      const chosen = state.scene.choices.find((ch) => ch.id === body.data.choiceId);
      if (!chosen) return c.json(err("invalid_choice", "没有这样的选择"), 400);

      // Affordability re-check at pick time: 攀谈 can shift trust (and thus
      // tier gates) after the scene was clamped — never trust the client.
      const locked = lockReason(chosen, snapshotOf(state));
      if (locked) return c.json(err("choice_locked", `此路此刻走不通——${locked}`), 422);

      const dueEvents: QueuedEvent[] = state.eventQueue.filter(
        (ev) => ev.status === "pending" && ev.dueTurn <= state.turn + 1,
      );

      try {
        const { result, engineUsed } = await runEngine(state.engine, (d) =>
          d.takeTurn(state, chosen, dueEvents),
        );
        const next = applyAndFinish(state, result, chosen, engineUsed);
        await store.save(next);
        return c.json(toSessionView(next));
      } catch (e) {
        console.error("[sessions] takeTurn failed:", e);
        // State was never written — the client can safely retry the same turn.
        return c.json(err("engine_failed", "天机受阻，再试一次"), 502);
      }
    });
  });

  // --- life report (idempotent, cached on the session) ---
  app.post("/sessions/:id/report", async (c) => {
    const id = c.req.param("id");
    return store.withLock(id, async () => {
      let state: SessionState | null;
      try {
        state = await store.load(id);
      } catch (e) {
        if (e instanceof StateCorruptError) return c.json(err("state_corrupt", "存档已损坏"), 500);
        throw e;
      }
      if (!state) return c.json(err("not_found", "未找到这段人生"), 404);
      if (!state.finished) return c.json(err("session_active", "人生未到尽头，命书言之尚早"), 409);
      if (state.report) return c.json({ report: state.report });

      try {
        const { result } = await runEngine(state.engine, (d) => d.writeReport(state));
        const { report, log } = guardReport(result, state);
        state.report = report;
        if (log.length) state.validationLog.push(...log);
        state.updatedAt = new Date().toISOString();
        await store.save(state);
        return c.json({ report });
      } catch (e) {
        console.error("[sessions] writeReport failed:", e);
        return c.json(err("engine_failed", "命书未成，请再试一次"), 502);
      }
    });
  });

  return app;
}
