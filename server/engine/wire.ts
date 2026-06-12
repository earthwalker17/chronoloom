/**
 * Restores strictness the wire schema relaxed for grammar-size reasons:
 * coerces the model's wire output into an exact DirectorTurn (valid enums,
 * integer literals, choice ids by position). clamp.ts then applies game-rule
 * bounds as usual — nothing downstream ever sees a loose value.
 */
import { z } from "zod";
import {
  CAPS,
  CHOICE_IDS,
  GATE_TIERS,
  NPC_IDS,
  SKILL_IDS,
  STATUS_IDS,
  TIMELINE_KINDS,
  type GateTier,
  type LocationId,
  type NpcId,
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
const isGateTier = (v: string): v is GateTier => (GATE_TIERS as readonly string[]).includes(v);

const intIn = <T extends number>(v: number, allowed: readonly T[], fallback: T): T => {
  const r = Math.round(v) as T;
  return allowed.includes(r) ? r : fallback;
};

const cost = (v: number, max: number): number => Math.max(0, Math.min(max, Math.round(v)));

export function wireToDirectorTurn(wire: Wire): DirectorTurn {
  const choices: Choice[] = wire.choices.slice(0, 4).map((c, i) => {
    // Trust gates only make sense as a pair; drop half-formed ones.
    const gateNpc = isNpc(c.minTrustNpcId) && isGateTier(c.minTrustTier) ? c.minTrustNpcId : "";
    return {
      id: CHOICE_IDS[i] ?? "c4",
      labelZh: c.labelZh,
      hintZh: c.hintZh,
      actionTag: c.actionTag,
      risk: c.risk,
      anchorNpcId: isNpc(c.anchorNpcId) ? c.anchorNpcId : "",
      moneyCost: cost(c.moneyCost, CAPS.moneyCostMax),
      staminaCost: cost(c.staminaCost, CAPS.staminaCostMax),
      minReputation: Math.max(-100, Math.min(100, Math.round(c.minReputation))),
      minTrustNpcId: gateNpc,
      minTrustTier: gateNpc ? (c.minTrustTier as GateTier) : "",
    };
  });

  return {
    sceneTitleZh: wire.sceneTitleZh,
    consequenceRecapZh: wire.consequenceRecapZh,
    proseZh: wire.proseZh,
    directive: {
      ...wire.directive,
      focusNpcIds: wire.directive.focusNpcIds.filter(isNpc),
    },
    choices,
    npcLines: wire.npcLines
      .filter((l) => isNpc(l.npcId))
      .slice(0, CAPS.npcLinesMax)
      .map((l) => ({ npcId: l.npcId as NpcId, lineZh: l.lineZh })),
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
      npcIds: ev.npcIds.filter(isNpc),
      locationId: wire.directive.locationId,
    })),
    causalEntries: wire.causalEntries.map((entry) => ({
      cause: (["player_action", "npc_action", "world_event", "time_passage"] as const).includes(
        entry.cause as "player_action",
      )
        ? (entry.cause as "player_action")
        : "player_action",
      textZh: entry.textZh,
      effectsZh: entry.effectsZh,
      openedZh: entry.openedZh,
      closedZh: entry.closedZh,
    })),
    isEnding: wire.isEnding,
    endingReasonZh: wire.endingReasonZh,
  };
}
