import { randomUUID } from "node:crypto";
import { NPC_IDS, SKILL_IDS, ACTION_TAGS, TENSION_IDS, type IdentityId } from "@shared/constants";
import type { SessionState, Skills, Tendencies, Tensions } from "@shared/types";
import { ERA_BIBLE } from "../content/eraBible";
import { IDENTITIES } from "../content/identities";
import { NPCS } from "../content/npcs";
import { seedEvents } from "./pacing";

const BASE_TENSIONS: Tensions = {
  official_scrutiny: 4,
  guild_dispute: 4,
  festival_fervor: 6,
  street_danger: 2,
};

export function newSession(
  identityId: IdentityId,
  engine: "claude" | "scripted",
  playerNameZh?: string,
): SessionState {
  const def = IDENTITIES[identityId];
  const now = new Date().toISOString();

  const skills = Object.fromEntries(SKILL_IDS.map((s) => [s, def.start.skills[s] ?? 0])) as Skills;
  const tendencies = Object.fromEntries(ACTION_TAGS.map((t) => [t, 0])) as Tendencies;
  const tensions = Object.fromEntries(
    TENSION_IDS.map((t) => [t, Math.min(10, BASE_TENSIONS[t] + (def.tensionBias[t] ?? 0))]),
  ) as Tensions;

  const npcs = Object.fromEntries(
    NPC_IDS.map((id) => {
      const base = NPCS[id];
      const prior = def.npcPriors[id];
      return [
        id,
        {
          id,
          nameZh: base.nameZh,
          roleZh: base.roleZh,
          motivationZh: base.motivationZh,
          trust: base.baseTrust + prior.trust,
          fear: base.baseFear,
          respect: base.baseRespect,
          agendaZh: base.agendaZh,
          memory: prior.trust !== 0 ? [{ turn: 0, summaryZh: prior.noteZh }] : [],
        },
      ];
    }),
  ) as SessionState["npcs"];

  return {
    id: randomUUID(),
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    engine,
    identityId,
    turn: 0,
    chapter: 1,
    finished: false,
    endingReasonZh: "",
    player: {
      identityId,
      nameZh: playerNameZh?.trim() || def.defaultNameZh,
      age: def.age,
      money: def.start.money,
      health: def.start.health,
      reputation: def.start.reputation,
      skills,
      tendencies,
      statuses: [...def.start.statuses],
      accessTags: [...def.start.accessTags],
      location: def.start.location,
    },
    world: {
      day: 1,
      timeOfDay: "dusk",
      weather: "clear",
      publicMoodZh: "灯节将近，满市欢腾里藏着一丝不安。",
      tensions,
      rumors: ERA_BIBLE.seedRumorsZh.map((textZh, i) => ({ id: `rumor_seed_${i}`, textZh })),
    },
    npcs,
    eventQueue: seedEvents(identityId),
    timeline: [],
    ledger: [],
    scene: {
      titleZh: "",
      consequenceRecapZh: "",
      proseZh: "",
      directive: {
        locationId: def.start.location,
        timeOfDay: "dusk",
        weather: "clear",
        mood: "festive",
        crowd: "busy",
        lanterns: "bright",
        focusNpcIds: [],
      },
      choices: [],
    },
    history: [],
    validationLog: [],
    report: null,
  };
}

export function freshSessionId(): string {
  return randomUUID();
}
