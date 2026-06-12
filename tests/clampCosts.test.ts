/**
 * The "stats that bite" enforcement core: cost caps, gate coherence, scene
 * anchors, npcLines bounds, and the affordability floor (≥2 pickable choices,
 * judged against the PROJECTED post-apply state).
 */
import { describe, expect, it } from "vitest";
import type { SessionState } from "@shared/types";
import { newSession } from "../server/sim/newSession";
import { affordableChoice, clampDirectorTurn, lockReason, snapshotOf } from "../server/sim/clamp";
import { mkChoice, mkTurn } from "./helpers";

function fresh(): SessionState {
  return newSession("scholar", "scripted");
}

describe("choice costs and gates", () => {
  it("caps absurd costs and clamps gate bounds", () => {
    const s = fresh();
    const raw = mkTurn({
      choices: [
        mkChoice("c1", "一", "observe_wait", "low", { moneyCost: 99999, staminaCost: 80, minReputation: 500 }),
        mkChoice("c2", "二", "pursue_money", "low"),
        mkChoice("c3", "三", "take_risk", "high"),
      ],
    });
    const { turn, log } = clampDirectorTurn(raw, s, false);
    const c1 = turn.choices.find((c) => c.id === "c1");
    // Floor may zero these afterwards if unaffordable — assert via log instead.
    expect(log.some((l) => l.includes("moneyCost"))).toBe(true);
    expect(log.some((l) => l.includes("staminaCost"))).toBe(true);
    expect(c1).toBeDefined();
  });

  it("clears half-formed trust gates", () => {
    const s = fresh();
    const raw = mkTurn({
      choices: [
        mkChoice("c1", "一", "observe_wait", "low", { minTrustNpcId: "lvyao", minTrustTier: "" }),
        mkChoice("c2", "二", "pursue_money", "low", { minTrustTier: "信任" }),
        mkChoice("c3", "三", "take_risk", "high"),
      ],
    });
    const { turn } = clampDirectorTurn(raw, s, false);
    expect(turn.choices.every((c) => c.minTrustNpcId === "" && c.minTrustTier === "")).toBe(true);
  });

  it("clears anchors pointing at NPCs not in the scene", () => {
    const s = fresh();
    const raw = mkTurn({
      directive: { ...mkTurn().directive, focusNpcIds: ["lvyao"] },
      choices: [
        mkChoice("c1", "一", "observe_wait", "low", { anchorNpcId: "lvyao" }),
        mkChoice("c2", "二", "pursue_money", "low", { anchorNpcId: "cui_jiu" }),
        mkChoice("c3", "三", "take_risk", "high"),
      ],
    });
    const { turn, log } = clampDirectorTurn(raw, s, false);
    expect(turn.choices.find((c) => c.id === "c1")?.anchorNpcId).toBe("lvyao");
    expect(turn.choices.find((c) => c.id === "c2")?.anchorNpcId).toBe("");
    expect(log.some((l) => l.includes("anchor"))).toBe(true);
  });

  it("affordability floor keeps ≥2 pickable, clearing from the last choice back", () => {
    const s = fresh();
    s.player.money = 60;
    const raw = mkTurn({
      choices: [
        mkChoice("c1", "一", "observe_wait", "low", { moneyCost: 100 }),
        mkChoice("c2", "二", "pursue_money", "low", { moneyCost: 100 }),
        mkChoice("c3", "三", "take_risk", "high", { moneyCost: 100 }),
      ],
    });
    const { turn } = clampDirectorTurn(raw, s, false);
    const snap = snapshotOf(s);
    const affordable = turn.choices.filter((c) => affordableChoice(c, snap));
    expect(affordable.length).toBeGreaterThanOrEqual(2);
    // Walked from the back: c3 and c2 freed, c1 still priced.
    expect(turn.choices.find((c) => c.id === "c1")?.moneyCost).toBe(100);
    expect(turn.choices.find((c) => c.id === "c2")?.moneyCost).toBe(0);
    expect(turn.choices.find((c) => c.id === "c3")?.moneyCost).toBe(0);
  });

  it("floor judges against the projected post-apply state, not the current one", () => {
    const s = fresh();
    s.player.money = 300;
    const chosen = mkChoice("c1", "先前的选择", "pursue_money", "low", { moneyCost: 200 });
    const raw = mkTurn({
      update: { ...mkTurn().update, moneyDelta: -100 }, // projected: 300-200-100 = 0
      choices: [
        mkChoice("c1", "一", "observe_wait", "low", { moneyCost: 50 }),
        mkChoice("c2", "二", "pursue_money", "low", { moneyCost: 50 }),
        mkChoice("c3", "三", "take_risk", "high"),
      ],
    });
    const { turn } = clampDirectorTurn(raw, s, false, chosen);
    // Projected money is 0 → both 50文 choices were unaffordable → c2 freed.
    expect(turn.choices.find((c) => c.id === "c2")?.moneyCost).toBe(0);
    expect(turn.choices.find((c) => c.id === "c1")?.moneyCost).toBe(50);
  });

  it("low stamina locks exertion strictly (health must EXCEED the cost)", () => {
    const s = fresh();
    s.player.health = 10;
    const tired = mkChoice("c1", "拼一把", "take_risk", "high", { staminaCost: 10 });
    expect(affordableChoice(tired, snapshotOf(s))).toBe(false);
    expect(lockReason(tired, snapshotOf(s))).toBe("体力不支");
    s.player.health = 11;
    expect(affordableChoice(tired, snapshotOf(s))).toBe(true);
  });

  it("trust-tier gates read the live tier", () => {
    const s = fresh();
    const gated = mkChoice("c1", "求情", "seek_patronage", "medium", {
      minTrustNpcId: "he_shisan",
      minTrustTier: "信任",
    });
    s.npcs.he_shisan.trust = 10; // 相识
    expect(lockReason(gated, snapshotOf(s))).toBe("交情未到");
    s.npcs.he_shisan.trust = 20; // 信任
    expect(affordableChoice(gated, snapshotOf(s))).toBe(true);
  });
});

describe("npcLines", () => {
  it("drops lines from non-focus NPCs, caps count and length", () => {
    const s = fresh();
    const raw = mkTurn({
      directive: { ...mkTurn().directive, focusNpcIds: ["lvyao", "he_shisan"] },
      npcLines: [
        { npcId: "lvyao", lineZh: "弦断了。" },
        { npcId: "cui_jiu", lineZh: "我不在场却在说话。" },
        { npcId: "he_shisan", lineZh: "一".repeat(60) },
        { npcId: "lvyao", lineZh: "第二句。" },
        { npcId: "he_shisan", lineZh: "第四句被裁。" },
      ],
    });
    const { turn, log } = clampDirectorTurn(raw, s, false);
    expect(turn.npcLines.length).toBeLessThanOrEqual(3);
    expect(turn.npcLines.every((l) => l.npcId !== "cui_jiu")).toBe(true);
    expect(turn.npcLines.every((l) => l.lineZh.length <= 40)).toBe(true);
    expect(log.some((l) => l.includes("npcLine"))).toBe(true);
  });
});
