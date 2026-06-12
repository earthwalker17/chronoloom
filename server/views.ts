/**
 * Redacted client view: NPC motives, agendas and raw trust numbers stay
 * server-side — the world knows things the player doesn't.
 */
import {
  CHAPTER_NAMES_ZH,
  DAY_NAMES_ZH,
  NPC_IDS,
  STATUS_NAMES_ZH,
  TIME_OF_DAY_ZH,
  WEATHER_ZH,
  attitudeGlyph,
  trustTier,
} from "@shared/constants";
import type { SessionState, SessionView } from "@shared/types";
import { IDENTITIES } from "./content/identities";
import { locationName } from "./content/locations";

export function toSessionView(state: SessionState): SessionView {
  const identity = IDENTITIES[state.identityId];
  return {
    id: state.id,
    engine: state.engine,
    identityId: state.identityId,
    turn: state.turn,
    chapter: state.chapter,
    chapterNameZh: CHAPTER_NAMES_ZH[state.chapter],
    finished: state.finished,
    endingReasonZh: state.endingReasonZh,
    player: {
      nameZh: state.player.nameZh,
      identityNameZh: identity.nameZh,
      money: state.player.money,
      health: state.player.health,
      reputation: state.player.reputation,
      skills: state.player.skills,
      statusesZh: state.player.statuses.map((s) => STATUS_NAMES_ZH[s]),
      location: state.player.location,
      locationNameZh: locationName(state.player.location),
    },
    world: {
      day: state.world.day,
      dayNameZh: DAY_NAMES_ZH[state.world.day - 1] ?? "十三",
      timeOfDay: state.world.timeOfDay,
      timeOfDayZh: TIME_OF_DAY_ZH[state.world.timeOfDay],
      weather: state.world.weather,
      weatherZh: WEATHER_ZH[state.world.weather],
      publicMoodZh: state.world.publicMoodZh,
      rumorsZh: state.world.rumors.map((r) => r.textZh),
    },
    npcs: NPC_IDS.map((id) => {
      const npc = state.npcs[id];
      const lastMemory = npc.memory[npc.memory.length - 1];
      const inScene = state.scene.directive.focusNpcIds.includes(id);
      return {
        id,
        nameZh: npc.nameZh,
        roleZh: npc.roleZh,
        tier: trustTier(npc.trust),
        glyph: attitudeGlyph(npc.trust, npc.fear, npc.respect),
        lastChangeZh: lastMemory?.summaryZh ?? "",
        changedThisTurn: lastMemory !== undefined && lastMemory.turn === state.turn && state.turn > 0,
        inScene,
        canTalk: inScene && !state.talkedNpcIds.includes(id) && !state.finished,
      };
    }),
    scene: state.scene,
    timeline: state.timeline,
    hasReport: state.report !== null,
  };
}
