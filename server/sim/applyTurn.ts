/**
 * Pure reducer: (SessionState, sanitized DirectorTurn, chosen Choice) → next SessionState.
 * Absolute-range clamps live here (per-turn delta clamps live in clamp.ts).
 * Turn counter, chapter, day and tendencies are computed here — never by the model.
 */
import {
  ABS_RANGES,
  CAPS,
  MAX_TURN,
  chapterForTurn,
  type StatusId,
} from "@shared/constants";
import type { Choice, DirectorTurn, SessionState } from "@shared/types";
import { advanceTime, floorDay } from "./pacing";

const clampAbs = (v: number, r: { min: number; max: number }) => Math.max(r.min, Math.min(r.max, v));

export function applyDirectorTurn(
  state: SessionState,
  turn: DirectorTurn,
  chosen: Choice | null,
  engineUsed: string,
  clampLog: string[] = [],
): SessionState {
  const s: SessionState = JSON.parse(JSON.stringify(state));
  const isArrival = chosen === null;
  const newTurn = isArrival ? 0 : s.turn + 1;
  const u = turn.update;

  // --- choice costs land FIRST, as their own clamped step ---
  // (a positive outcome delta must never mask the cost at the 0/100 boundaries)
  if (chosen) {
    s.player.money = clampAbs(s.player.money - chosen.moneyCost, ABS_RANGES.money);
    s.player.health = clampAbs(s.player.health - chosen.staminaCost, ABS_RANGES.health);
  }

  // --- player numerics ---
  s.player.money = clampAbs(s.player.money + u.moneyDelta, ABS_RANGES.money);
  s.player.health = clampAbs(s.player.health + u.healthDelta, ABS_RANGES.health);
  s.player.reputation = clampAbs(s.player.reputation + u.reputationDelta, ABS_RANGES.reputation);
  for (const skill of u.skillUps) {
    s.player.skills[skill] = clampAbs(s.player.skills[skill] + 1, ABS_RANGES.skill);
  }

  // --- statuses ---
  const statuses = new Set<StatusId>(s.player.statuses);
  for (const st of u.statusAdd) statuses.add(st);
  for (const st of u.statusRemove) statuses.delete(st);
  s.player.statuses = [...statuses];

  // --- movement ---
  if (u.moveTo !== "stay") s.player.location = u.moveTo;

  // --- time ---
  const { timeOfDay, daysCrossed } = advanceTime(s.world.timeOfDay, u.timeAdvance);
  s.world.timeOfDay = timeOfDay;
  s.world.day = floorDay(s.world.day + daysCrossed, newTurn);

  // --- world texture ---
  if (u.publicMoodZh) s.world.publicMoodZh = u.publicMoodZh;
  for (const key of Object.keys(u.tensionDeltas) as (keyof typeof u.tensionDeltas)[]) {
    s.world.tensions[key] = clampAbs(s.world.tensions[key] + u.tensionDeltas[key], ABS_RANGES.tension);
  }
  if (u.rumorAddZh) {
    s.world.rumors.push({ id: `rumor_${newTurn}_${s.world.rumors.length}`, textZh: u.rumorAddZh });
    while (s.world.rumors.length > CAPS.rumors) s.world.rumors.shift();
  }

  // --- NPCs ---
  for (const upd of u.npcUpdates) {
    const npc = s.npcs[upd.npcId];
    npc.trust = clampAbs(npc.trust + upd.trustDelta, ABS_RANGES.trust);
    npc.fear = clampAbs(npc.fear + upd.fearDelta, ABS_RANGES.fear);
    npc.respect = clampAbs(npc.respect + upd.respectDelta, ABS_RANGES.respect);
    if (upd.agendaZh) npc.agendaZh = upd.agendaZh;
    if (upd.memoryZh) {
      npc.memory.push({ turn: newTurn, summaryZh: upd.memoryZh });
      while (npc.memory.length > CAPS.npcMemory) npc.memory.shift();
    }
  }

  // --- tendencies + history (server-computed; the report's ground truth) ---
  if (chosen) {
    s.player.tendencies[chosen.actionTag] += 1;
    s.history.push({
      turn: newTurn,
      choiceId: chosen.id,
      labelZh: chosen.labelZh,
      actionTag: chosen.actionTag,
      engineUsed,
    });
  }

  // --- event queue ---
  for (const op of turn.eventOps) {
    if (op.op === "schedule") {
      s.eventQueue.push({
        id: op.eventId.startsWith("evt_") ? op.eventId : `evt_${newTurn}_${op.eventId}`,
        hintZh: op.hintZh,
        dueTurn: newTurn + op.dueTurnOffset,
        status: "pending",
        source: "director",
      });
    } else {
      const ev = s.eventQueue.find((e) => e.id === op.eventId && e.status === "pending");
      if (ev) ev.status = "cancelled";
    }
  }
  // Events due by this turn were handed to the Director — mark them woven.
  for (const ev of s.eventQueue) {
    if (ev.status === "pending" && ev.dueTurn <= newTurn) ev.status = "fired";
  }

  // --- timeline & causal ledger ---
  turn.timelineEvents.forEach((ev, i) => {
    s.timeline.push({ ...ev, id: `tl_${newTurn}_${i}`, turn: newTurn, day: s.world.day });
  });
  turn.causalEntries.forEach((entry, i) => {
    s.ledger.push({ ...entry, id: `cl_${newTurn}_${i}`, turn: newTurn });
  });

  // --- scene ---
  s.scene = {
    titleZh: turn.sceneTitleZh,
    consequenceRecapZh: turn.consequenceRecapZh,
    proseZh: turn.proseZh,
    directive: turn.directive,
    choices: turn.choices,
    npcLines: turn.npcLines,
  };

  // --- 攀谈 fence resets with every applied turn ---
  s.talkedNpcIds = [];

  // --- turn / chapter / ending (server-owned) ---
  s.turn = newTurn;
  s.chapter = chapterForTurn(newTurn);

  let finished = false;
  let reason = "";
  if (turn.isEnding && s.chapter === 3) {
    finished = true;
    reason = turn.endingReasonZh || "灯落幕收，这一段长安岁月到了尽头。";
  }
  if (s.player.health <= 0) {
    finished = true;
    reason = "伤病交加，你倒在了上元的灯影里。";
  }
  if (s.player.statuses.includes("arrested")) {
    finished = true;
    reason = "市署的差役锁了你的双手——这个灯节，你在牢狱中度过。";
  }
  if (!isArrival && newTurn >= MAX_TURN) {
    finished = true;
    reason = reason || turn.endingReasonZh || "正月十九，收灯。七日灯火落幕，你的故事告一段落。";
  }
  if (finished) {
    s.finished = true;
    s.endingReasonZh = reason;
    s.scene.choices = [];
  }

  // --- bookkeeping ---
  if (clampLog.length) {
    s.validationLog.push(...clampLog.map((l) => `t${newTurn}: ${l}`));
  }
  s.updatedAt = new Date().toISOString();
  return s;
}
