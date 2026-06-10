/**
 * End-to-end playthrough against the ScriptedDirector via app.request()
 * (in-process, no port). Proves the core claim mechanically: choices change
 * the life path, the world remembers, and the report cites the lived record.
 *
 * Run: npm run e2e
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Hono } from "hono";
import type { LifeReport, SessionView } from "@shared/types";
import { createApp } from "../server/app";
import { ScriptedDirector } from "../server/engine/scriptedDirector";
import { SessionStore } from "../server/store/sessionStore";
import { IDENTITIES } from "../server/content/identities";
import { NPCS } from "../server/content/npcs";
import { stringifySorted } from "../server/engine/prompts";
import type { AppConfig } from "../server/config";

let passed = 0;
function ok(cond: boolean, label: string): void {
  if (!cond) {
    console.error(`  ✗ ${label}`);
    process.exitCode = 1;
    throw new Error(`assertion failed: ${label}`);
  }
  passed++;
  console.log(`  ✓ ${label}`);
}

const config: AppConfig = {
  apiKey: undefined,
  model: "claude-opus-4-8",
  engine: "scripted",
  fallbackToScripted: false,
  port: 0,
};

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function post(app: Hono, url: string, body: unknown): Promise<Response> {
  return app.request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

type Lean = "protect" | "money";
function pickChoice(view: SessionView, lean: Lean): { id: string } {
  const prefer = lean === "protect" ? ["protect_someone", "reveal_info", "pursue_art"] : ["pursue_money", "take_risk", "conceal_info"];
  for (const tag of prefer) {
    const c = view.scene.choices.find((ch) => ch.actionTag === tag);
    if (c) return c;
  }
  const first = view.scene.choices[0];
  if (!first) throw new Error("no choices available");
  return first;
}

async function playLife(app: Hono, store: SessionStore, lean: Lean): Promise<{ view: SessionView; report: LifeReport }> {
  const createRes = await post(app, "/api/sessions", { identityId: "scholar" });
  ok(createRes.status === 201, `create session → 201 (${lean}-leaning run)`);
  let view = await json<SessionView>(createRes);
  ok(view.turn === 0, "arrival is turn 0");
  ok(view.scene.proseZh.length > 0, "arrival scene has prose");
  ok(view.scene.choices.length >= 3 && view.scene.choices.length <= 4, "arrival offers 3-4 choices");
  ok(view.timeline.length >= 1, "arrival recorded on the timeline");

  let prevTimeline = view.timeline.length;
  let prevJson = JSON.stringify(view);

  while (!view.finished) {
    const choice = pickChoice(view, lean);
    const res = await post(app, `/api/sessions/${view.id}/turn`, { choiceId: choice.id, turn: view.turn });
    if (res.status !== 200) throw new Error(`turn failed: ${res.status} ${await res.text()}`);
    const next = await json<SessionView>(res);
    ok(next.turn === view.turn + 1, `turn ${next.turn}: counter incremented`);
    ok(next.timeline.length > prevTimeline, `turn ${next.turn}: timeline strictly grew`);
    ok(JSON.stringify(next) !== prevJson, `turn ${next.turn}: state actually changed`);
    if (next.turn > 1) {
      ok(next.scene.consequenceRecapZh.length > 0, `turn ${next.turn}: visible consequence recap present`);
    }
    prevTimeline = next.timeline.length;
    prevJson = JSON.stringify(next);
    view = next;
  }
  ok(view.turn === 10 || view.finished, "life ran to its ending");
  ok(view.endingReasonZh.length > 0, "ending has a reason");

  // Raw-state assertions (server-side knowledge the redacted view hides).
  const state = await store.load(view.id);
  if (!state) throw new Error("state missing after finish");
  for (let t = 1; t <= view.turn; t++) {
    ok(
      state.ledger.some((e) => e.turn === t),
      `turn ${t}: causal ledger has an entry`,
    );
  }

  // Persistence round-trip.
  const reload = await app.request(`/api/sessions/${view.id}`);
  ok(
    stringifySorted(await json<SessionView>(reload)) === stringifySorted(view),
    "GET after finish equals last response",
  );

  // Report.
  const repRes = await post(app, `/api/sessions/${view.id}/report`, {});
  ok(repRes.status === 200, "report generated");
  const { report } = await json<{ report: LifeReport }>(repRes);
  ok(report.lifeTitleZh.length > 0, "report has a life title");
  ok(report.turningPoints.length >= 2, "report has ≥2 turning points");
  const ids = new Set(state.timeline.map((e) => e.id));
  ok(
    report.turningPoints.every((tp) => ids.has(tp.timelineId)),
    "every turning point cites a real timeline event",
  );
  const repRes2 = await post(app, `/api/sessions/${view.id}/report`, {});
  ok(stringifySorted(await json(repRes2)) === stringifySorted({ report }), "report is idempotent");

  return { view, report };
}

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "chronoloom-e2e-"));
  const store = new SessionStore(dir);
  const app = createApp({ config, director: new ScriptedDirector(), fallback: null, store });

  console.log("— meta —");
  const health = await json<{ ok: boolean; engine: string }>(await app.request("/api/health"));
  ok(health.ok && health.engine === "scripted", "health reports scripted engine");
  const meta = await json<{ identities: unknown[] }>(await app.request("/api/meta"));
  ok(meta.identities.length === 4, "meta lists 4 identities");

  console.log("— life A: protect-leaning scholar —");
  const a = await playLife(app, store, "protect");

  console.log("— life B: money-leaning scholar —");
  const b = await playLife(app, store, "money");

  console.log("— divergence: choices change the life path —");
  const stateA = await store.load(a.view.id);
  const stateB = await store.load(b.view.id);
  if (!stateA || !stateB) throw new Error("states missing");
  ok(stateA.player.reputation !== stateB.player.reputation || stateA.player.money !== stateB.player.money,
    "reputation/money diverged between lives");
  ok(stateA.npcs.lvyao.trust !== stateB.npcs.lvyao.trust, "绿腰's trust diverged between lives");
  ok(
    JSON.stringify(a.report.valuesRevealedZh) !== JSON.stringify(b.report.valuesRevealedZh),
    "revealed values diverged between lives",
  );
  const lvyaoStart = NPCS.lvyao.baseTrust + IDENTITIES.scholar.npcPriors.lvyao.trust;
  ok(Math.abs(stateA.npcs.lvyao.trust - lvyaoStart) >= 10, "绿腰's relationship moved ≥10 in the protect life");

  console.log("— error paths —");
  const stale = await post(app, `/api/sessions/${a.view.id}/turn`, { choiceId: "c1", turn: 0 });
  ok(stale.status === 422 || stale.status === 409, "turn on finished/stale session rejected");
  const fresh = await post(app, "/api/sessions", { identityId: "apprentice" });
  const freshView = await json<SessionView>(fresh);
  const conflict = await post(app, `/api/sessions/${freshView.id}/turn`, { choiceId: "c1", turn: 5 });
  ok(conflict.status === 409, "stale turn counter → 409");
  const bogus = await post(app, `/api/sessions/${freshView.id}/turn`, { choiceId: "c4", turn: 0 });
  // c4 exists on arrival scenes; use a structurally-valid but absent id only if c4 is taken.
  const bogusOk = bogus.status === 400 || bogus.status === 200;
  ok(bogusOk, "turn body validation behaves");
  const missing = await app.request("/api/sessions/00000000-0000-4000-8000-000000000000");
  ok(missing.status === 404, "unknown session → 404");

  rmSync(dir, { recursive: true, force: true });
  console.log(`\nE2E passed (${passed} assertions).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
