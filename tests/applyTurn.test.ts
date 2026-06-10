import { describe, expect, it } from "vitest";
import type { DirectorTurn, SessionState } from "@shared/types";
import { newSession } from "../server/sim/newSession";
import { applyDirectorTurn } from "../server/sim/applyTurn";
import { clampDirectorTurn } from "../server/sim/clamp";

function zeroTurn(overrides: Partial<DirectorTurn["update"]> = {}): DirectorTurn {
  return {
    sceneTitleZh: "测试",
    consequenceRecapZh: "测试回顾",
    proseZh: "测试场景。",
    directive: {
      locationId: "market_cross",
      timeOfDay: "noon",
      weather: "clear",
      mood: "calm",
      crowd: "busy",
      lanterns: "dim",
      focusNpcIds: [],
    },
    choices: [
      { id: "c1", labelZh: "一", hintZh: "", actionTag: "observe_wait", risk: "low" },
      { id: "c2", labelZh: "二", hintZh: "", actionTag: "pursue_money", risk: "low" },
      { id: "c3", labelZh: "三", hintZh: "", actionTag: "take_risk", risk: "high" },
    ],
    update: {
      moneyDelta: 0,
      healthDelta: 0,
      reputationDelta: 0,
      skillUps: [],
      statusAdd: [],
      statusRemove: [],
      moveTo: "stay",
      timeAdvance: 0,
      publicMoodZh: "",
      tensionDeltas: { official_scrutiny: 0, guild_dispute: 0, festival_fervor: 0, street_danger: 0 },
      rumorAddZh: "",
      npcUpdates: [],
      ...overrides,
    },
    eventOps: [],
    timelineEvents: [],
    causalEntries: [],
    isEnding: false,
    endingReasonZh: "",
  };
}

const chosen = { id: "c1", labelZh: "一", hintZh: "", actionTag: "observe_wait", risk: "low" } as const;

function fresh(): SessionState {
  return newSession("scholar", "scripted");
}

describe("clamp + applyTurn", () => {
  it("clamps oversized deltas and logs them", () => {
    const s = fresh();
    const raw = zeroTurn({ moneyDelta: 99999, healthDelta: -90, reputationDelta: 50 });
    const { turn, log } = clampDirectorTurn(raw, s, false);
    expect(turn.update.moneyDelta).toBe(2000);
    expect(turn.update.healthDelta).toBe(-20);
    expect(turn.update.reputationDelta).toBe(10);
    expect(log.length).toBeGreaterThanOrEqual(3);
  });

  it("merges duplicate npc updates and clamps trust", () => {
    const s = fresh();
    const raw = zeroTurn({
      npcUpdates: [
        { npcId: "lvyao", trustDelta: 10, fearDelta: 0, respectDelta: 0, agendaZh: "", memoryZh: "" },
        { npcId: "lvyao", trustDelta: 10, fearDelta: 0, respectDelta: 0, agendaZh: "", memoryZh: "" },
      ],
    });
    const { turn } = clampDirectorTurn(raw, s, false);
    expect(turn.update.npcUpdates).toHaveLength(1);
    expect(turn.update.npcUpdates[0]?.trustDelta).toBe(15); // 20 merged → clamped to ±15
  });

  it("rejects market_office movement without access", () => {
    const s = fresh();
    const { turn, log } = clampDirectorTurn(zeroTurn({ moveTo: "market_office" }), s, false);
    expect(turn.update.moveTo).toBe("stay");
    expect(log.some((l) => l.includes("market_office"))).toBe(true);
  });

  it("allows market_office with official_errand granted this turn", () => {
    const s = fresh();
    const { turn } = clampDirectorTurn(
      zeroTurn({ moveTo: "market_office", statusAdd: ["official_errand"] }),
      s,
      false,
    );
    expect(turn.update.moveTo).toBe("market_office");
  });

  it("synthesizes a causal entry when the model returns none", () => {
    const s = fresh();
    const { turn } = clampDirectorTurn(zeroTurn({ moneyDelta: 300 }), s, false);
    expect(turn.causalEntries.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects isEnding outside chapter 3", () => {
    const s = fresh();
    const raw = { ...zeroTurn(), isEnding: true, endingReasonZh: "提前结束" };
    const { turn } = clampDirectorTurn(raw, s, false);
    expect(turn.isEnding).toBe(false);
  });

  it("applies deltas, tendencies, timeline and history through the reducer", () => {
    const s = fresh();
    const raw = zeroTurn({ moneyDelta: 100, reputationDelta: 5 });
    raw.timelineEvents = [
      { kind: "decision", titleZh: "事", descZh: "细", importance: 1, npcIds: [], locationId: "market_cross" },
    ];
    const { turn, log } = clampDirectorTurn(raw, s, false);
    const next = applyDirectorTurn(s, turn, { ...chosen }, "scripted", log);
    expect(next.player.money).toBe(s.player.money + 100);
    expect(next.player.reputation).toBe(s.player.reputation + 5);
    expect(next.player.tendencies.observe_wait).toBe(1);
    expect(next.turn).toBe(1);
    expect(next.timeline).toHaveLength(1);
    expect(next.history).toHaveLength(1);
    expect(s.turn).toBe(0); // reducer is pure — input untouched
  });

  it("absolute ranges hold (money never below 0, health caps at 100)", () => {
    const s = fresh();
    s.player.money = 50;
    const { turn } = clampDirectorTurn(zeroTurn({ moneyDelta: -2000, healthDelta: 20 }), s, false);
    const next = applyDirectorTurn(s, turn, { ...chosen }, "scripted");
    expect(next.player.money).toBe(0);
    expect(next.player.health).toBeLessThanOrEqual(100);
  });

  it("ends the life when health hits zero", () => {
    const s = fresh();
    s.player.health = 10;
    const { turn } = clampDirectorTurn(zeroTurn({ healthDelta: -20 }), s, false);
    const next = applyDirectorTurn(s, turn, { ...chosen }, "scripted");
    expect(next.finished).toBe(true);
    expect(next.scene.choices).toHaveLength(0);
    expect(next.endingReasonZh.length).toBeGreaterThan(0);
  });

  it("enforces the day floor so the festival reaches 十九 by turn 10", () => {
    let s = fresh();
    const t = zeroTurn();
    for (let i = 0; i < 10; i++) {
      const { turn } = clampDirectorTurn(t, s, false);
      s = applyDirectorTurn(s, turn, { ...chosen }, "scripted");
    }
    expect(s.world.day).toBe(7);
    expect(s.finished).toBe(true);
  });
});
