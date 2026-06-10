/**
 * Restores strictness the wire schema relaxed for grammar-size reasons:
 * coerces the model's wire output into an exact DirectorTurn (valid enums,
 * integer literals, choice ids by position). clamp.ts then applies game-rule
 * bounds as usual — nothing downstream ever sees a loose value.
 */
import { z } from "zod";
import {
  CHOICE_IDS,
  NPC_IDS,
  SKILL_IDS,
  STATUS_IDS,
  TIMELINE_KINDS,
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

const intIn = <T extends number>(v: number, allowed: readonly T[], fallback: T): T => {
  const r = Math.round(v) as T;
  return allowed.includes(r) ? r : fallback;
};

export function wireToDirectorTurn(wire: Wire): DirectorTurn {
  const choices: Choice[] = wire.choices.slice(0, 4).map((c, i) => ({
    id: CHOICE_IDS[i] ?? "c4",
    labelZh: c.labelZh,
    hintZh: c.hintZh,
    actionTag: c.actionTag,
    risk: c.risk,
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
