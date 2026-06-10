/**
 * Anti-drift validation: the model (or a buggy beat table) proposes, this file
 * disposes. Every correction is recorded so prompt regressions are visible.
 */
import {
  ABS_RANGES,
  CAPS,
  NPC_IDS,
  PER_TURN_CLAMPS,
  TENSION_IDS,
  chapterForTurn,
  type NpcId,
} from "@shared/constants";
import type { Choice, DirectorTurn, NpcUpdate, SessionState } from "@shared/types";
import { LOCATIONS } from "../content/locations";

export interface ClampResult {
  turn: DirectorTurn;
  log: string[];
}

const clampNum = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Sanitize a DirectorTurn against the current state. Pure. */
export function clampDirectorTurn(raw: DirectorTurn, state: SessionState, isArrival: boolean): ClampResult {
  const log: string[] = [];
  const note = (msg: string) => log.push(msg);
  const t: DirectorTurn = JSON.parse(JSON.stringify(raw));
  const newTurn = isArrival ? 0 : state.turn + 1;

  // --- prose / strings ---
  if (t.proseZh.length > CAPS.proseMaxChars) {
    t.proseZh = t.proseZh.slice(0, CAPS.proseMaxChars);
    note(`proseZh truncated to ${CAPS.proseMaxChars} chars`);
  }
  if (isArrival && t.consequenceRecapZh !== "") {
    t.consequenceRecapZh = "";
    note("arrival recap cleared");
  }

  // --- numeric per-turn deltas ---
  const u = t.update;
  const clampDelta = (key: "moneyDelta" | "healthDelta" | "reputationDelta", lim: number) => {
    const v = u[key];
    if (Math.abs(v) > lim) {
      u[key] = clampNum(v, -lim, lim);
      note(`${key} ${v} clamped to ${u[key]}`);
    }
  };
  clampDelta("moneyDelta", PER_TURN_CLAMPS.moneyDelta);
  clampDelta("healthDelta", PER_TURN_CLAMPS.healthDelta);
  clampDelta("reputationDelta", PER_TURN_CLAMPS.reputationDelta);

  // --- skills: at most one new skill-up per turn, none past max ---
  const validSkillUps = t.update.skillUps.filter(
    (s) => state.player.skills[s] < ABS_RANGES.skill.max,
  );
  if (validSkillUps.length > 1) note(`skillUps trimmed from ${validSkillUps.length} to 1`);
  u.skillUps = validSkillUps.slice(0, 1);

  // --- statuses: dedupe; remove only what exists ---
  u.statusAdd = [...new Set(u.statusAdd)].filter((s) => !state.player.statuses.includes(s));
  u.statusRemove = [...new Set(u.statusRemove)].filter((s) => state.player.statuses.includes(s));

  // --- movement gating ---
  if (u.moveTo === "market_office") {
    const allowed =
      state.player.accessTags.includes("office_lobby") ||
      state.player.statuses.includes("official_errand") ||
      u.statusAdd.includes("official_errand");
    if (!allowed) {
      u.moveTo = "stay";
      note("moveTo market_office rejected (no office access)");
    }
  }
  if (u.moveTo !== "stay" && !LOCATIONS[u.moveTo]) {
    u.moveTo = "stay";
    note("moveTo unknown location rejected");
  }

  // --- tensions ---
  for (const id of TENSION_IDS) {
    const v = u.tensionDeltas[id];
    if (Math.abs(v) > PER_TURN_CLAMPS.tensionDelta) {
      u.tensionDeltas[id] = clampNum(v, -PER_TURN_CLAMPS.tensionDelta, PER_TURN_CLAMPS.tensionDelta);
      note(`tensionDelta ${id} ${v} clamped`);
    }
  }

  // --- NPC updates: known ids only, one per NPC (merged), per-turn clamps ---
  const merged = new Map<NpcId, NpcUpdate>();
  for (const upd of u.npcUpdates) {
    if (!NPC_IDS.includes(upd.npcId)) {
      note(`npcUpdate for unknown npc dropped`);
      continue;
    }
    const prev = merged.get(upd.npcId);
    if (prev) {
      prev.trustDelta += upd.trustDelta;
      prev.fearDelta += upd.fearDelta;
      prev.respectDelta += upd.respectDelta;
      if (upd.agendaZh) prev.agendaZh = upd.agendaZh;
      if (upd.memoryZh) prev.memoryZh = upd.memoryZh;
      note(`duplicate npcUpdate for ${upd.npcId} merged`);
    } else {
      merged.set(upd.npcId, { ...upd });
    }
  }
  u.npcUpdates = [...merged.values()].map((upd) => {
    const fix = (v: number, lim: number, label: string) => {
      if (Math.abs(v) > lim) {
        note(`${label} ${v} for ${upd.npcId} clamped to ${clampNum(v, -lim, lim)}`);
        return clampNum(v, -lim, lim);
      }
      return v;
    };
    return {
      ...upd,
      trustDelta: fix(upd.trustDelta, PER_TURN_CLAMPS.trustDelta, "trustDelta"),
      fearDelta: fix(upd.fearDelta, PER_TURN_CLAMPS.fearDelta, "fearDelta"),
      respectDelta: fix(upd.respectDelta, PER_TURN_CLAMPS.respectDelta, "respectDelta"),
      memoryZh: upd.memoryZh.slice(0, CAPS.npcMemoryMaxChars),
    };
  });

  // --- event ops ---
  t.eventOps = t.eventOps.slice(0, CAPS.eventOpsPerTurn).flatMap((op) => {
    if (op.op === "cancel") {
      const exists = state.eventQueue.some((e) => e.id === op.eventId && e.status === "pending");
      if (!exists) {
        note(`eventOp cancel for unknown/closed event ${op.eventId} dropped`);
        return [];
      }
      return [op];
    }
    return [
      {
        ...op,
        dueTurnOffset: clampNum(op.dueTurnOffset, CAPS.dueTurnOffsetMin, CAPS.dueTurnOffsetMax),
      },
    ];
  });

  // --- timeline / causal caps ---
  if (t.timelineEvents.length > CAPS.timelineEventsPerTurn) {
    note(`timelineEvents trimmed ${t.timelineEvents.length} → ${CAPS.timelineEventsPerTurn}`);
    t.timelineEvents = t.timelineEvents.slice(0, CAPS.timelineEventsPerTurn);
  }
  let majorSeen = false;
  t.timelineEvents = t.timelineEvents.map((ev) => {
    if (ev.importance === 3) {
      if (majorSeen) {
        note("extra importance-3 timeline event demoted to 2");
        return { ...ev, importance: 2 as const };
      }
      majorSeen = true;
    }
    return ev;
  });
  if (t.causalEntries.length > CAPS.causalEntriesPerTurn) {
    t.causalEntries = t.causalEntries.slice(0, CAPS.causalEntriesPerTurn);
    note("causalEntries trimmed");
  }
  if (t.causalEntries.length === 0 && !isArrival) {
    // Causality must never go silent: synthesize from the update.
    const effects: string[] = [];
    if (u.moneyDelta !== 0) effects.push(u.moneyDelta > 0 ? `进账${u.moneyDelta}文` : `破费${-u.moneyDelta}文`);
    if (u.reputationDelta !== 0) effects.push(u.reputationDelta > 0 ? "声望略涨" : "声望受损");
    for (const n of u.npcUpdates) {
      if (n.trustDelta !== 0) effects.push(`${n.npcId} 对你的态度变了`);
    }
    t.causalEntries = [
      {
        cause: "player_action",
        textZh: "你的选择在市井间留下了痕迹。",
        effectsZh: effects.length ? effects : ["这一步的影响尚未浮出水面"],
        openedZh: [],
        closedZh: [],
      },
    ];
    note("causalEntries empty — synthesized from update");
  }

  // --- directive sanity ---
  t.directive.focusNpcIds = [...new Set(t.directive.focusNpcIds)].slice(0, CAPS.focusNpcsMax);

  // --- ending rules ---
  const chapter = chapterForTurn(newTurn);
  if (t.isEnding && chapter !== 3) {
    t.isEnding = false;
    t.endingReasonZh = "";
    note(`isEnding outside chapter 3 (turn ${newTurn}) rejected`);
  }

  // --- choices: 3–4, unique ids, ≥3 distinct action tags; none when ending ---
  if (t.isEnding) {
    t.choices = [];
  } else {
    const seenIds = new Set<string>();
    let choices: Choice[] = t.choices.filter((c) => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });
    if (choices.length > CAPS.choicesMax) {
      choices = choices.slice(0, CAPS.choicesMax);
      note("choices trimmed to 4");
    }
    const fillers: Choice[] = [
      { id: "c3", labelZh: "静观其变，先看清局势", hintZh: "不出手，也是一种选择", actionTag: "observe_wait", risk: "low" },
      { id: "c4", labelZh: "去何家酒肆探听风声", hintZh: "消息比铜钱值钱", actionTag: "seek_patronage", risk: "low" },
    ];
    for (const filler of fillers) {
      if (choices.length >= CAPS.choicesMin) break;
      if (!choices.some((c) => c.id === filler.id)) {
        choices.push(filler);
        note(`choice filler added (${filler.actionTag})`);
      }
    }
    const distinctTags = new Set(choices.map((c) => c.actionTag));
    if (distinctTags.size < 3 && choices.length >= 3) {
      const replacement = fillers.find((f) => !distinctTags.has(f.actionTag));
      if (replacement && choices.length > 0) {
        const last = choices[choices.length - 1];
        if (last) {
          choices[choices.length - 1] = { ...replacement, id: last.id };
          note("low choice variety — last choice replaced for tag diversity");
        }
      }
    }
    t.choices = choices;
  }

  return { turn: t, log };
}
