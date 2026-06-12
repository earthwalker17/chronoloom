/**
 * Restores strictness the wire schema relaxed for grammar-size reasons:
 * coerces the model's wire output into an exact DirectorTurn (valid enums,
 * integer literals, choice ids by position). clamp.ts then applies game-rule
 * bounds as usual — nothing downstream ever sees a loose value.
 */
import { z } from "zod";
import {
  ACTION_TAGS,
  CAPS,
  CHOICE_IDS,
  NPC_IDS,
  RISK_LEVELS,
  SKILL_IDS,
  STATUS_IDS,
  TIMELINE_KINDS,
  type ActionTag,
  type LocationId,
  type NpcId,
  type RiskLevel,
  type SkillId,
  type StatusId,
  type TimelineKind,
} from "@shared/constants";
import { LOCATION_IDS } from "@shared/constants";
import type { DirectorTurnWireSchema } from "@shared/schemas";
import type { Choice, DirectorTurn } from "@shared/types";

type Wire = z.infer<typeof DirectorTurnWireSchema>;

const isNpc = (v: string): v is NpcId => (NPC_IDS as readonly string[]).includes(v);
const isSkill = (v: string): v is SkillId => (SKILL_IDS as readonly string[]).includes(v);
const isStatus = (v: string): v is StatusId => (STATUS_IDS as readonly string[]).includes(v);
const isLocation = (v: string): v is LocationId => (LOCATION_IDS as readonly string[]).includes(v);
const isKind = (v: string): v is TimelineKind => (TIMELINE_KINDS as readonly string[]).includes(v);
const isTag = (v: string): v is ActionTag => (ACTION_TAGS as readonly string[]).includes(v);
const isRisk = (v: string): v is RiskLevel => (RISK_LEVELS as readonly string[]).includes(v);

const intIn = <T extends number>(v: number, allowed: readonly T[], fallback: T): T => {
  const r = Math.round(v) as T;
  return allowed.includes(r) ? r : fallback;
};

const cost = (v: number, max: number): number => Math.max(0, Math.min(max, Math.round(v)));

/** Split a ；/;/,-joined wire string into a trimmed list ("" → []). */
function splitPacked(s: string): string[] {
  return s
    .split(/[；;，,]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Parse the packed choice-extra DSL: "money=200 stamina=8 rep=10
 * anchor=he_shisan". Forgiving by design — malformed tokens drop and leave
 * the choice free/unanchored; clamp.ts re-bounds everything afterwards.
 */
function parseChoiceExtra(s: string): {
  anchorNpcId: NpcId | "";
  moneyCost: number;
  staminaCost: number;
  minReputation: number;
} {
  let anchorNpcId: NpcId | "" = "";
  let moneyCost = 0;
  let staminaCost = 0;
  let minReputation = -100;
  for (const token of s.split(/[\s;,，；]+/)) {
    const [k, v] = token.split(/[=:：]/);
    if (!k || v === undefined) continue;
    const n = Number(v);
    switch (k.trim()) {
      case "anchor":
        if (isNpc(v.trim())) anchorNpcId = v.trim() as NpcId;
        break;
      case "money":
        if (Number.isFinite(n)) moneyCost = cost(n, CAPS.moneyCostMax);
        break;
      case "stamina":
        if (Number.isFinite(n)) staminaCost = cost(n, CAPS.staminaCostMax);
        break;
      case "rep":
        if (Number.isFinite(n)) minReputation = Math.max(-100, Math.min(100, Math.round(n)));
        break;
    }
  }
  return { anchorNpcId, moneyCost, staminaCost, minReputation };
}

export function wireToDirectorTurn(wire: Wire): DirectorTurn {
  const choices: Choice[] = wire.choices.slice(0, 4).map((c, i) => ({
    id: CHOICE_IDS[i] ?? "c4",
    labelZh: c.labelZh,
    hintZh: c.hintZh,
    actionTag: isTag(c.actionTag) ? c.actionTag : "observe_wait",
    risk: isRisk(c.risk) ? c.risk : "medium",
    ...parseChoiceExtra(c.extra),
    // Trust gates are not on the wire (grammar ceiling) — scripted beats only.
    minTrustNpcId: "",
    minTrustTier: "",
  }));

  return {
    sceneTitleZh: wire.sceneTitleZh,
    consequenceRecapZh: wire.consequenceRecapZh,
    proseZh: wire.proseZh,
    directive: {
      ...wire.directive,
      focusNpcIds: wire.directive.focusNpcIds.filter(isNpc),
    },
    choices,
    // "npcId|台词" strings → validated NpcLine objects.
    npcLines: wire.npcLines
      .map((s) => {
        const sep = s.indexOf("|");
        if (sep <= 0) return null;
        const npcId = s.slice(0, sep).trim();
        const lineZh = s.slice(sep + 1).trim();
        return isNpc(npcId) && lineZh ? { npcId: npcId as NpcId, lineZh } : null;
      })
      .filter((l): l is { npcId: NpcId; lineZh: string } => l !== null)
      .slice(0, CAPS.npcLinesMax),
    update: {
      moneyDelta: wire.update.moneyDelta,
      healthDelta: wire.update.healthDelta,
      reputationDelta: wire.update.reputationDelta,
      skillUps: wire.update.skillUps.filter(isSkill),
      statusAdd: wire.update.statusAdd.filter(isStatus),
      statusRemove: wire.update.statusRemove.filter(isStatus),
      moveTo: isLocation(wire.update.moveTo) ? wire.update.moveTo : "stay",
      timeAdvance: intIn(wire.update.timeAdvance, [0, 1, 2] as const, 1),
      publicMoodZh: wire.update.publicMoodZh,
      tensionDeltas: wire.update.tensionDeltas,
      rumorAddZh: wire.update.rumorAddZh,
      npcUpdates: wire.update.npcUpdates,
    },
    // Director-scheduled events are not part of the live wire (grammar size);
    // the seeded festival spine drives the event queue.
    eventOps: [],
    timelineEvents: wire.timelineEvents.map((ev) => ({
      kind: isKind(ev.kind) ? ev.kind : "decision",
      titleZh: ev.titleZh,
      descZh: ev.descZh,
      importance: intIn(ev.importance, [1, 2, 3] as const, 1),
      npcIds: splitPacked(ev.npcIds).filter(isNpc),
      locationId: wire.directive.locationId,
    })),
    causalEntries: wire.causalEntries.map((entry) => ({
      cause: (["player_action", "npc_action", "world_event", "time_passage"] as const).includes(
        entry.cause as "player_action",
      )
        ? (entry.cause as "player_action")
        : "player_action",
      textZh: entry.textZh,
      effectsZh: splitPacked(entry.effectsZh),
      openedZh: splitPacked(entry.openedZh),
      closedZh: splitPacked(entry.closedZh),
    })),
    isEnding: wire.isEnding,
    endingReasonZh: wire.endingReasonZh,
  };
}
