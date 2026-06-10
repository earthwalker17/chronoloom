/**
 * Deterministic offline engine: same state + same choice → byte-identical turn.
 * Authored spine + outcome tables; zero RNG anywhere.
 */
import { MAX_TURN, NPC_IDS, TENSION_IDS, chapterForTurn, type NpcId } from "@shared/constants";
import type { Choice, DirectorTurn, LifeReport, QueuedEvent, SessionState, Tensions } from "@shared/types";
import { IDENTITIES } from "../content/identities";
import {
  CONDITIONAL_FRAGMENTS,
  MONEY_SCALE,
  OUTCOMES,
  SPINE_SCENES,
  type SpineScene,
} from "../content/scriptedBeats";
import { renderRecap } from "../sim/recap";
import { buildScriptedReport } from "../content/reportTemplates";
import type { Director } from "./director";

const ZERO_TENSIONS: Tensions = {
  official_scrutiny: 0,
  guild_dispute: 0,
  festival_fervor: 0,
  street_danger: 0,
};

function sceneFor(turn: number): SpineScene {
  const scene = SPINE_SCENES[Math.min(turn, SPINE_SCENES.length - 1)];
  if (!scene) throw new Error(`no spine scene for turn ${turn}`);
  return scene;
}

function composeProse(scene: SpineScene, state: SessionState, extraLeadZh = ""): string {
  const identityFragment = scene.identityProseZh?.[state.identityId] ?? "";
  const trust = Object.fromEntries(
    NPC_IDS.map((id) => [id, state.npcs[id].trust]),
  ) as Record<NpcId, number>;
  const fragments = CONDITIONAL_FRAGMENTS.map((f) =>
    f.check({
      money: state.player.money,
      reputation: state.player.reputation,
      health: state.player.health,
      trust,
      statuses: state.player.statuses,
    }),
  )
    .filter((line): line is string => line !== null)
    .slice(0, 2);
  return [extraLeadZh, scene.proseZh, identityFragment, ...fragments].filter(Boolean).join("\n");
}

function endingReason(state: SessionState): string {
  if (state.player.reputation >= 20) return "七日之间，你在东市挣下了一个被人记住的名字。灯落了，路才刚刚铺开。";
  if (state.player.reputation <= -10) return "灯落幕收，市井间关于你的流言还要再传上一阵子。长安居，大不易。";
  if (state.npcs.lvyao.trust >= 35 || state.npcs.shen_yanqiu.trust >= 35)
    return "这七日你未必得了名利，却结下了一段灯火般暖的情义。";
  return "灯落幕收，七日喧腾归于市鼓与钲声。你的故事融进了长安的人海。";
}

export class ScriptedDirector implements Director {
  readonly name = "scripted" as const;

  async startLife(state: SessionState): Promise<DirectorTurn> {
    const def = IDENTITIES[state.identityId];
    const scene = sceneFor(0);
    const locationId = scene.locationByIdentity?.[state.identityId] ?? scene.location;
    return {
      sceneTitleZh: scene.titleZh,
      consequenceRecapZh: "",
      proseZh: composeProse(scene, state, def.openingHookZh),
      directive: { ...scene.directive, locationId },
      choices: scene.choices,
      update: {
        moneyDelta: 0,
        healthDelta: 0,
        reputationDelta: 0,
        skillUps: [],
        statusAdd: [],
        statusRemove: [],
        moveTo: "stay",
        timeAdvance: scene.timeAdvance,
        publicMoodZh: "",
        tensionDeltas: { ...ZERO_TENSIONS },
        rumorAddZh: "",
        npcUpdates: [],
      },
      eventOps: [],
      timelineEvents: [
        {
          kind: "milestone",
          titleZh: "初入灯市",
          descZh: `正月十三，你以${def.nameZh}之身踏进了上元灯节的东市。`,
          importance: 2,
          npcIds: [],
          locationId,
        },
      ],
      causalEntries: [
        {
          cause: "world_event",
          textZh: "上元灯节开市，七日灯火点亮了长安东市。",
          effectsZh: ["你的故事从这里开始"],
          openedZh: ["灯节七日的机会与风险"],
          closedZh: [],
        },
      ],
      isEnding: false,
      endingReasonZh: "",
    };
  }

  async takeTurn(state: SessionState, chosen: Choice, _dueEvents: QueuedEvent[]): Promise<DirectorTurn> {
    const newTurn = state.turn + 1;
    const chapter = chapterForTurn(newTurn);
    const outcome = OUTCOMES[chapter][chosen.actionTag];
    const scene = sceneFor(newTurn);
    const locationId = scene.locationByIdentity?.[state.identityId] ?? scene.location;
    const scale = MONEY_SCALE[state.identityId];

    const tensionDeltas: Tensions = { ...ZERO_TENSIONS };
    for (const id of TENSION_IDS) {
      tensionDeltas[id] = outcome.tensionDeltas?.[id] ?? 0;
    }

    const update: DirectorTurn["update"] = {
      moneyDelta: Math.round((outcome.moneyDelta * scale) / 10) * 10,
      healthDelta: outcome.healthDelta,
      reputationDelta: outcome.reputationDelta,
      skillUps: outcome.skillUp ? [outcome.skillUp] : [],
      statusAdd: outcome.statusAdd ?? [],
      statusRemove: outcome.statusRemove ?? [],
      moveTo: locationId === state.player.location ? "stay" : locationId,
      timeAdvance: scene.timeAdvance,
      publicMoodZh: "",
      tensionDeltas,
      rumorAddZh: outcome.rumorAddZh ?? "",
      npcUpdates: outcome.npcEffects.map((e) => ({
        npcId: e.npcId,
        trustDelta: e.trustDelta,
        fearDelta: e.fearDelta ?? 0,
        respectDelta: e.respectDelta ?? 0,
        agendaZh: "",
        memoryZh: e.memoryZh ?? "",
      })),
    };

    const isEnding = newTurn >= MAX_TURN;
    return {
      sceneTitleZh: scene.titleZh,
      consequenceRecapZh: renderRecap(chosen.actionTag, update),
      proseZh: composeProse(scene, state),
      directive: { ...scene.directive, locationId },
      choices: isEnding ? [] : scene.choices,
      update,
      eventOps: [],
      timelineEvents: [
        {
          ...outcome.timeline,
          npcIds: outcome.npcEffects.slice(0, 2).map((e) => e.npcId),
          locationId: state.player.location,
        },
      ],
      causalEntries: [
        {
          cause: "player_action",
          textZh: outcome.causal.textZh,
          effectsZh: outcome.causal.effectsZh,
          openedZh: outcome.causal.openedZh,
          closedZh: outcome.causal.closedZh,
        },
      ],
      isEnding,
      endingReasonZh: isEnding ? endingReason(state) : "",
    };
  }

  async writeReport(state: SessionState): Promise<LifeReport> {
    return buildScriptedReport(state);
  }
}
