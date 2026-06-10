import { describe, expect, it } from "vitest";
import { IDENTITY_IDS, type ActionTag } from "@shared/constants";
import type { SessionState } from "@shared/types";
import { ScriptedDirector } from "../server/engine/scriptedDirector";
import { applyDirectorTurn } from "../server/sim/applyTurn";
import { clampDirectorTurn } from "../server/sim/clamp";
import { newSession } from "../server/sim/newSession";
import { guardReport } from "../server/sim/reportGuard";
import { stringifySorted } from "../server/engine/prompts";

const director = new ScriptedDirector();

async function playLife(identity: (typeof IDENTITY_IDS)[number], prefer: ActionTag[]): Promise<SessionState> {
  let state = newSession(identity, "scripted");
  const arrival = await director.startLife(state);
  {
    const { turn, log } = clampDirectorTurn(arrival, state, true);
    state = applyDirectorTurn(state, turn, null, "scripted", log);
  }
  while (!state.finished) {
    const choice =
      state.scene.choices.find((ch) => prefer.includes(ch.actionTag)) ?? state.scene.choices[0];
    if (!choice) throw new Error("no choice available");
    const result = await director.takeTurn(state, choice, []);
    const { turn, log } = clampDirectorTurn(result, state, false);
    state = applyDirectorTurn(state, turn, choice, "scripted", log);
  }
  return state;
}

// Strip volatile fields so two runs of the same life compare byte-identical.
function fingerprint(state: SessionState): string {
  const { id, createdAt, updatedAt, ...rest } = state;
  return stringifySorted(rest);
}

describe("ScriptedDirector", () => {
  it("is deterministic: same identity + same choices → identical life", async () => {
    const a = await playLife("apprentice", ["protect_someone", "reveal_info"]);
    const b = await playLife("apprentice", ["protect_someone", "reveal_info"]);
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("diverges: different choices → different reputation/trust", async () => {
    const protect = await playLife("scholar", ["protect_someone", "pursue_art"]);
    const money = await playLife("scholar", ["pursue_money", "take_risk"]);
    expect(protect.player.reputation).not.toBe(money.player.reputation);
    expect(protect.npcs.lvyao.trust).not.toBe(money.npcs.lvyao.trust);
  });

  it("every identity completes a full 10-turn life with a grounded report", async () => {
    for (const identity of IDENTITY_IDS) {
      const state = await playLife(identity, ["observe_wait"]);
      expect(state.finished).toBe(true);
      expect(state.turn).toBe(10);
      expect(state.timeline.length).toBeGreaterThanOrEqual(11);
      expect(state.ledger.length).toBeGreaterThanOrEqual(10);

      const raw = await director.writeReport(state);
      const { report } = guardReport(raw, state);
      const ids = new Set(state.timeline.map((e) => e.id));
      expect(report.turningPoints.length).toBeGreaterThanOrEqual(2);
      for (const tp of report.turningPoints) expect(ids.has(tp.timelineId)).toBe(true);
      expect(report.valuesRevealedZh.length).toBeGreaterThan(0);
      expect(report.closingLetterZh.length).toBeGreaterThanOrEqual(60);
      expect(report.shareCard.statHighlightsZh).toHaveLength(3);
    }
  });

  it("mentor/friend relationships move every chapter in a protect-leaning life", async () => {
    const state = await playLife("scholar", ["protect_someone", "seek_patronage"]);
    // 绿腰 or 沈砚秋 must have moved substantially — the recurring-relationship demo bar.
    const lvyaoMoved = Math.abs(state.npcs.lvyao.trust - 5) >= 10;
    const shenMoved = Math.abs(state.npcs.shen_yanqiu.trust - 25) >= 10;
    expect(lvyaoMoved || shenMoved).toBe(true);
    expect(state.npcs.lvyao.memory.length).toBeGreaterThan(0);
  });
});
