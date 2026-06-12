/**
 * 攀谈 route: fences (turn/absence/once-per-turn), structural disclosure
 * filtering by trust tier, canonical-reveal-only, clamped deltas, persistence.
 * Runs against the real app (scripted engine) over a temp store.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hono } from "hono";
import type { SessionView, TalkResponse } from "@shared/types";
import type { NpcId } from "@shared/constants";
import { createApp } from "../server/app";
import { ScriptedDirector } from "../server/engine/scriptedDirector";
import { SessionStore } from "../server/store/sessionStore";
import { NPCS } from "../server/content/npcs";
import type { AppConfig } from "../server/config";

const config: AppConfig = {
  apiKey: undefined,
  openaiKey: undefined,
  deepseekKey: undefined,
  model: "claude-opus-4-8",
  openaiModel: "gpt-5.1",
  deepseekModel: "deepseek-chat",
  engine: "scripted",
  fallbackToScripted: false,
  port: 0,
};

let dir: string;
let store: SessionStore;
let app: Hono;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "chronoloom-talk-"));
  store = new SessionStore(dir);
  app = createApp({
    config,
    directors: new Map([["scripted", new ScriptedDirector()] as const]),
    defaultEngine: "scripted",
    fallback: null,
    store,
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

async function post<T>(url: string, body: unknown): Promise<{ status: number; body: T }> {
  const res = await app.request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return { status: res.status, body: (await res.json()) as T };
}

async function newLife(): Promise<SessionView> {
  const { status, body } = await post<SessionView>("/api/sessions", { identityId: "scholar" });
  expect(status).toBe(201);
  return body;
}

/** Advance to a turn whose scene has at least one focus NPC. */
async function advanceToFocus(view: SessionView): Promise<SessionView> {
  let v = view;
  while (v.scene.directive.focusNpcIds.length === 0 && !v.finished) {
    const free = v.scene.choices[0];
    if (!free) throw new Error("no choices");
    const r = await post<SessionView>(`/api/sessions/${v.id}/turn`, { choiceId: free.id, turn: v.turn });
    expect(r.status).toBe(200);
    v = r.body;
  }
  return v;
}

describe("POST /sessions/:id/talk", () => {
  it("talks to a focus NPC: lines, attitude, memory, ledger, fence", async () => {
    let v = await newLife();
    v = await advanceToFocus(v);
    const npcId = v.scene.directive.focusNpcIds[0] as NpcId;

    const { status, body } = await post<TalkResponse>(`/api/sessions/${v.id}/talk`, { npcId, turn: v.turn });
    expect(status).toBe(200);
    expect(body.npcId).toBe(npcId);
    expect(body.lines.length).toBeGreaterThanOrEqual(1);
    expect(body.lines[0]?.lineZh.length).toBeGreaterThan(0);
    expect(["warmer", "cooler", "unchanged"]).toContain(body.attitude);
    expect(body.npc.canTalk).toBe(false);

    const state = await store.load(v.id);
    expect(state?.talkedNpcIds).toContain(npcId);
    expect(state?.ledger.some((e) => e.id === `cl_talk_${v.turn}_${npcId}`)).toBe(true);
    // scripted talk always remembers something
    expect(state?.npcs[npcId].memory.length).toBeGreaterThan(0);

    // The redacted session view agrees.
    const fresh = await app.request(`/api/sessions/${v.id}`);
    const fv = (await fresh.json()) as SessionView;
    expect(fv.npcs.find((n) => n.id === npcId)?.canTalk).toBe(false);

    // Second talk same turn → fenced.
    const again = await post<{ error: { code: string } }>(`/api/sessions/${v.id}/talk`, { npcId, turn: v.turn });
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe("already_talked");

    // Taking a turn resets the fence.
    const choice = fv.scene.choices.find((c) => {
      // pick something affordable
      return fv.player.money >= c.moneyCost && (c.staminaCost === 0 || fv.player.health > c.staminaCost);
    });
    if (!choice) throw new Error("no affordable choice");
    const turned = await post<SessionView>(`/api/sessions/${v.id}/turn`, { choiceId: choice.id, turn: fv.turn });
    expect(turned.status).toBe(200);
    const after = await store.load(v.id);
    expect(after?.talkedNpcIds).toEqual([]);
  });

  it("rejects talk to an NPC who is not in the scene", async () => {
    let v = await newLife();
    v = await advanceToFocus(v);
    const absent = (["shen_yanqiu", "cui_jiu", "lvyao", "pei_heng", "he_shisan"] as NpcId[]).find(
      (id) => !v.scene.directive.focusNpcIds.includes(id),
    );
    if (!absent) throw new Error("all npcs in scene?");
    const r = await post<{ error: { code: string } }>(`/api/sessions/${v.id}/talk`, { npcId: absent, turn: v.turn });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("npc_absent");
  });

  it("rejects a stale turn", async () => {
    let v = await newLife();
    v = await advanceToFocus(v);
    const npcId = v.scene.directive.focusNpcIds[0] as NpcId;
    const r = await post<{ error: { code: string } }>(`/api/sessions/${v.id}/talk`, { npcId, turn: v.turn - 1 });
    expect(r.status).toBe(409);
  });

  it("tier-gates disclosures structurally: low trust reveals nothing, high trust reveals canonical text", async () => {
    let v = await newLife();
    v = await advanceToFocus(v);
    const npcId = v.scene.directive.focusNpcIds[0] as NpcId;

    // Force trust below 相识 → no qualified disclosures → revealZh must be "".
    const low = await store.load(v.id);
    if (!low) throw new Error("state missing");
    low.npcs[npcId].trust = -50;
    await store.save(low);
    const cold = await post<TalkResponse>(`/api/sessions/${v.id}/talk`, { npcId, turn: v.turn });
    expect(cold.status).toBe(200);
    expect(cold.body.revealZh).toBe("");

    // Reset fence, force trust to 莫逆 → first unrevealed disclosure, canonical text.
    const high = await store.load(v.id);
    if (!high) throw new Error("state missing");
    high.talkedNpcIds = [];
    high.npcs[npcId].trust = 80;
    await store.save(high);
    const warm = await post<TalkResponse>(`/api/sessions/${v.id}/talk`, { npcId, turn: v.turn });
    expect(warm.status).toBe(200);
    const canon = NPCS[npcId].disclosures.map((d) => d.revealZh);
    expect(canon).toContain(warm.body.revealZh);

    // The disclosure id persisted and is never re-revealed.
    const after = await store.load(v.id);
    expect(after?.npcs[npcId].revealed.length).toBe(1);
    const usedId = after?.npcs[npcId].revealed[0];
    const reset = await store.load(v.id);
    if (!reset) throw new Error("state missing");
    reset.talkedNpcIds = [];
    await store.save(reset);
    const second = await post<TalkResponse>(`/api/sessions/${v.id}/talk`, { npcId, turn: v.turn });
    expect(second.status).toBe(200);
    if (second.body.revealZh !== "") {
      const secondId = NPCS[npcId].disclosures.find((d) => d.revealZh === second.body.revealZh)?.id;
      expect(secondId).not.toBe(usedId);
    }
  });

  it("trust moves by at most ±3 per talk", async () => {
    let v = await newLife();
    v = await advanceToFocus(v);
    const npcId = v.scene.directive.focusNpcIds[0] as NpcId;
    const before = (await store.load(v.id))?.npcs[npcId].trust ?? 0;
    await post(`/api/sessions/${v.id}/talk`, { npcId, turn: v.turn });
    const after = (await store.load(v.id))?.npcs[npcId].trust ?? 0;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(3);
  });

  it("rejects talk on a finished life", async () => {
    const v = await newLife();
    const state = await store.load(v.id);
    if (!state) throw new Error("state missing");
    state.finished = true;
    await store.save(state);
    const r = await post<{ error: { code: string } }>(`/api/sessions/${v.id}/talk`, {
      npcId: "lvyao",
      turn: state.turn,
    });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe("session_ended");
  });
});
