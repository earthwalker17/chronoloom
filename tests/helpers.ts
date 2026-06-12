/** Shared builders for sim tests. */
import type { Choice, DirectorTurn } from "@shared/types";

export function mkChoice(
  id: Choice["id"],
  labelZh: string,
  actionTag: Choice["actionTag"],
  risk: Choice["risk"],
  extras: Partial<Choice> = {},
): Choice {
  return {
    id,
    labelZh,
    hintZh: "",
    actionTag,
    risk,
    anchorNpcId: "",
    moneyCost: 0,
    staminaCost: 0,
    minReputation: -100,
    minTrustNpcId: "",
    minTrustTier: "",
    ...extras,
  };
}

export function mkTurn(overrides: Partial<DirectorTurn> = {}): DirectorTurn {
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
      mkChoice("c1", "一", "observe_wait", "low"),
      mkChoice("c2", "二", "pursue_money", "low"),
      mkChoice("c3", "三", "take_risk", "high"),
    ],
    npcLines: [],
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
    },
    eventOps: [],
    timelineEvents: [],
    causalEntries: [],
    isEnding: false,
    endingReasonZh: "",
    ...overrides,
  };
}
