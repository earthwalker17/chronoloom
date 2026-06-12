/**
 * Offline 命书 generator: templates over the REAL timeline / tendency / trust
 * data. Same LifeReportSchema as the Claude path — one render path in the UI.
 */
import {
  ACTION_TAGS,
  ACTION_TAG_VALUES_ZH,
  NPC_IDS,
  type ActionTag,
  type FinalStanding,
  type IdentityId,
  type NpcId,
} from "@shared/constants";
import type { LifeReport, Mirror, SessionState, TimelineEvent } from "@shared/types";
import { IDENTITIES } from "./identities";
import { NPCS, NPC_NAME_ZH } from "./npcs";

const TAG_PREFIX: Record<ActionTag, string> = {
  seek_patronage: "攀云",
  protect_someone: "仗义",
  conceal_info: "藏锋",
  reveal_info: "直道",
  take_risk: "行险",
  preserve_reputation: "守身",
  pursue_money: "殖货",
  pursue_status: "趋阶",
  pursue_art: "落墨",
  observe_wait: "观灯",
};

const TAG_EPITHET: Record<ActionTag, string> = {
  seek_patronage: "结网于灯下",
  protect_someone: "灯下护人者",
  conceal_info: "袖中藏锋者",
  reveal_info: "宁折不弯者",
  take_risk: "刀尖行路者",
  preserve_reputation: "守得住分寸",
  pursue_money: "市声中称金者",
  pursue_status: "拾级而上者",
  pursue_art: "以笔为灯者",
  observe_wait: "冷眼观灯者",
};

const IDENTITY_NOUN: Record<IdentityId, string> = {
  scholar: "书生",
  apprentice: "学徒",
  interpreter: "译人",
  copyist: "经生",
};

const TAG_PROTECTED: Record<ActionTag, string> = {
  seek_patronage: "你护住了来之不易的门路与人情。",
  protect_someone: "你护住了想护的人——哪怕代价不小。",
  conceal_info: "你护住了袖中的秘密，也护住了说话的余地。",
  reveal_info: "你护住了心里那杆不肯弯的秤。",
  take_risk: "你护住了放手一搏的胆气。",
  preserve_reputation: "你护住了一身干净的名声。",
  pursue_money: "你护住了安身立命的本钱。",
  pursue_status: "你护住了向上走的那条窄路。",
  pursue_art: "你护住了笔下那点不肯将就的心气。",
  observe_wait: "你护住了进退自如的余地。",
};

const TAG_SACRIFICED: Record<ActionTag, string> = {
  seek_patronage: "为此你折了些傲骨，欠下了不少人情。",
  protect_someone: "为此你舍了钱财，也舍了独善其身的轻省。",
  conceal_info: "为此你舍了坦荡，夜里多了几分不安。",
  reveal_info: "为此你得罪了人，断了几条转圜的路。",
  take_risk: "为此你押上了皮肉与安稳。",
  preserve_reputation: "为此你错过了浑水里的几桩机缘。",
  pursue_money: "为此你冷了一些本可以更近的人。",
  pursue_status: "为此你把一些旧情分留在了身后。",
  pursue_art: "为此你穷了口袋，富了纸墨。",
  observe_wait: "为此你眼睁睁看着几个机会从指间溜走。",
};

const TAG_ROAD: Record<ActionTag, string> = {
  seek_patronage: "若当初不去攀那些高枝，你或许活得清贫些，也自在些。",
  protect_someone: "若当初袖手旁观，你的囊中会更满，心里会更空。",
  conceal_info: "若当初把一切和盘托出，局面会更险，也可能更快了结。",
  reveal_info: "若当初守口如瓶，你会少几个敌人，也少几分被人敬重的理由。",
  take_risk: "若当初步步求稳，你会睡得安生些，也平庸些。",
  preserve_reputation: "若当初豁出名声去搏一把，胜负犹未可知。",
  pursue_money: "若当初少算几文钱，多记几张脸，灯下的情分会更暖。",
  pursue_status: "若当初不急着向上看，身边的人会离你更近。",
  pursue_art: "若当初务实些,囊中不至于如此清减——可那就不是你了。",
  observe_wait: "若当初早些出手，有些事的结局也许会不同。",
};

function topTendencies(state: SessionState, n: number): ActionTag[] {
  return [...ACTION_TAGS]
    .filter((t) => state.player.tendencies[t] > 0)
    .sort((a, b) => state.player.tendencies[b] - state.player.tendencies[a])
    .slice(0, n);
}

// ---------------------------------------------------------------------------
// 镜中人 — deterministic real-player mirror from the lived record
// ---------------------------------------------------------------------------

const TAG_OBSERVATION: Record<ActionTag, string> = {
  seek_patronage: "你相信人与人之间的网，遇事先想到的是'谁能帮上忙'——这不是圆滑，是你对'独木难支'有切身的认识。",
  protect_someone: "看到有人要被压垮时，你很难说服自己转过头去。别人的难处会变成你自己的事，这几乎不像是选择，更像本能。",
  conceal_info: "你习惯先把话留三分。知道的不全说，不是因为冷漠，而是你深知话一旦出口就收不回来。",
  reveal_info: "心里搁不住事，是非面前你倾向把话摆到桌面上——哪怕明知道这样会得罪人。",
  take_risk: "规规矩矩的路让你不安分。有五成把握你就愿意下注，输赢之外，你更怕的是'没试过'。",
  preserve_reputation: "你在意别人眼里的自己，走每一步都先想'这样做体面吗'。这让你稳，也让你时常活得有些累。",
  pursue_money: "你对'手里有钱心里不慌'有很实在的执念。这不是贪，是你深知没有余粮的日子是什么滋味。",
  pursue_status: "你想往上走，想被看见、被承认。承认这一点并不丢人——那是你对自己尚未到达之处的诚实。",
  pursue_art: "在实利和心气之间，你常常选心气。有些东西做得好不好，只有你自己知道，而你过不了自己这一关。",
  observe_wait: "你习惯先看再动。许多人把这看作犹豫，其实是你不愿意在看不清的局里交出主动权。",
};

const TAG_TENSION: Record<ActionTag, string> = {
  seek_patronage: "依靠别人与保全自己之间，你始终在找那个不亏欠的位置。",
  protect_someone: "你想护住别人，却不太习惯让别人护你。",
  conceal_info: "你渴望被了解，却又先一步把自己藏好。",
  reveal_info: "你知道直话伤人，可弯着说的话你自己先难受。",
  take_risk: "你向往安稳，却又受不了安稳带来的沉闷。",
  preserve_reputation: "你想活给自己看，却总不自觉先看别人的眼色。",
  pursue_money: "你算得清每一文钱,却算不清自己愿意为谁破例。",
  pursue_status: "你想往高处走，又怕高处的自己认不出原来的自己。",
  pursue_art: "你不甘心向现实低头，又不得不在现实里讨生活。",
  observe_wait: "你等最稳妥的时机，可心里清楚有些时机等不来。",
};

const TAG_ADVICE: Record<ActionTag, string> = {
  seek_patronage: "你经营人情的本事是真的，但别忘了：最值得经营的那个人，是你自己。偶尔也让别人来求你一次。",
  protect_someone: "你的肩膀让很多人靠过，记得偶尔检查一下自己站得稳不稳。护人之前，先别弄丢自己。",
  conceal_info: "藏锋是本事，但信任总得有人先递出第一寸。挑一两个值得的人，把话说满一次试试。",
  reveal_info: "你的坦荡是稀有的东西，别让它磨钝。只是直话也可以挑时辰说——话是给人听的，不是给理对的。",
  take_risk: "敢下注的人少，你是其中一个。只提醒一句：最大的赌注不在桌面上，是日复一日的耐心。",
  preserve_reputation: "体面你已经够了，偶尔允许自己狼狈一次。真正记得你的人，记住的从来不是你的体面。",
  pursue_money: "踏实是你的根，别人笑你计较时不必理会。只是账本之外的那些账——情分、亏欠、心安——也值得记一笔。",
  pursue_status: "想被看见不是错。只是路往上走的时候，回头看看是谁一直在原地为你举着灯。",
  pursue_art: "守住那点心气，它比你以为的值钱。但也吃饭——养得活自己的心气，才走得远。",
  observe_wait: "看得清是天分，等得起是修养。可有些门只在敲的人面前开——下一次，早半步伸手。",
};

const STYLE_FOCUSED = "认定了一条路，你就很少回头——你的选择有一种近乎固执的连贯。";
const STYLE_BALANCED = "你不押注在单一的活法上：每一步都在掂量眼前的局，而不是套用同一个答案。";

/**
 * Deterministic 镜中人 from tendencies + history. Also used to backfill
 * pre-mirror saved reports on migration.
 */
export function buildScriptedMirror(state: SessionState): Mirror {
  const tags = topTendencies(state, 3);
  const dominant = tags[0] ?? "observe_wait";
  const second = tags[1];
  const total = ACTION_TAGS.reduce((sum, t) => sum + state.player.tendencies[t], 0);
  const dominantShare = total > 0 ? state.player.tendencies[dominant] / total : 0;

  const evidenceFor = (tag: ActionTag): string => {
    const moments = state.history.filter((h) => h.actionTag === tag).map((h) => h.labelZh);
    if (moments.length === 0) return "这七日里你不止一次这样选了。";
    if (moments.length === 1) return `你选了「${moments[0]}」。`;
    return `你先后选了「${moments[0]}」「${moments[moments.length - 1]}」。`;
  };

  const themes = tags.map((t) => ({
    observationZh: TAG_OBSERVATION[t],
    evidenceZh: evidenceFor(t),
  }));

  return {
    decisionStyleZh: dominantShare >= 0.5 ? STYLE_FOCUSED : STYLE_BALANCED,
    themes,
    innerTensionZh: TAG_TENSION[second ?? dominant],
    gentleAdviceZh: TAG_ADVICE[dominant],
    blessingZh:
      "灯会散了，那个在长安灯下做选择的人，和此刻读这页字的人，原是同一副心肠。往后的路，愿你也这样走——认得出自己，护得住在意的，偶尔，也敢把灯举高一点。",
  };
}

function initialTrust(identityId: IdentityId, npcId: NpcId): number {
  return NPCS[npcId].baseTrust + IDENTITIES[identityId].npcPriors[npcId].trust;
}

function standingFor(trust: number): FinalStanding {
  if (trust >= 50) return "devoted";
  if (trust >= 20) return "warm";
  if (trust >= -15) return "wary";
  if (trust >= -40) return "hostile";
  return "severed";
}

function relationshipArc(name: string, start: number, end: number): string {
  const delta = end - start;
  if (delta >= 25) return `${name}从陌生到相托，这七日里你们之间结下的，已经不是寻常交情。`;
  if (delta >= 10) return `${name}待你日渐亲厚，几次关口上都念着你的好。`;
  if (delta <= -25) return `你与${name}走到了水火不容的地步，灯节里的恩怨，怕是要记很多年。`;
  if (delta <= -10) return `${name}对你冷了下去——有些选择，是要在人情上付账的。`;
  return `你与${name}之间不远不近，维持着市井里最常见的那种分寸。`;
}

function pickTurningPoints(timeline: TimelineEvent[]): TimelineEvent[] {
  return [...timeline]
    .sort((a, b) => b.importance - a.importance || a.turn - b.turn)
    .slice(0, 4)
    .sort((a, b) => a.turn - b.turn);
}

const KIND_WHY: Record<TimelineEvent["kind"], string> = {
  decision: "这一步定下了你后来许多事的走向。",
  consequence: "这是你此前种种选择结出的果。",
  relationship: "一段人情自此不同，它改变了你在这座市里的位置。",
  opportunity: "一扇门在这里打开了。",
  setback: "这一跤让你看清了脚下的路。",
  milestone: "你的长安岁月，在这里划下了一道刻痕。",
};

export function buildScriptedReport(state: SessionState): LifeReport {
  const def = IDENTITIES[state.identityId];
  const tags = topTendencies(state, 4);
  const dominant = tags[0] ?? "observe_wait";
  const lifeTitleZh = `${TAG_PREFIX[dominant]}${IDENTITY_NOUN[state.identityId]}`;
  const moneyStart = def.start.money;
  const moneyDiff = state.player.money - moneyStart;

  const turningPoints = pickTurningPoints(state.timeline).map((ev) => ({
    timelineId: ev.id,
    titleZh: ev.titleZh,
    whyZh: KIND_WHY[ev.kind],
  }));

  const relationships = NPC_IDS.map((id) => {
    const start = initialTrust(state.identityId, id);
    const end = state.npcs[id].trust;
    return { id, start, end, moved: Math.abs(end - start) };
  })
    .filter((r) => r.moved >= 8 || Math.abs(r.end) >= 25)
    .sort((a, b) => b.moved - a.moved)
    .slice(0, 4)
    .map((r) => ({
      npcId: r.id,
      arcZh: relationshipArc(NPC_NAME_ZH[r.id], r.start, r.end),
      finalStanding: standingFor(r.end),
    }));

  const deepest = relationships[0];
  const deepestName = deepest ? NPC_NAME_ZH[deepest.npcId] : "这座市井";

  const repLine =
    state.player.reputation >= 15
      ? "你的名字在东市有了分量"
      : state.player.reputation <= -8
        ? "你的名声折在了流言里"
        : "你不显山露水地走完了这七日";
  const moneyLine =
    moneyDiff >= 200 ? `囊中比来时厚了${moneyDiff}文` : moneyDiff <= -200 ? `散出去${-moneyDiff}文` : "钱财上不增不减";

  const arcSummaryZh =
    `天宝三载上元，你以${def.nameZh}之身在长安东市过了${state.world.day}日。` +
    `失账风波卷过每一个人，你${TAG_EPITHET[dominant]}，${repLine}，${moneyLine}。` +
    `这七日里最深的牵绊，落在${deepestName}身上。`;

  const closingLetterZh =
    `致另一个世界的你：上元的灯我替你看过了。${TAG_PROTECTED[dominant].replace("你", "我")}` +
    `${TAG_SACRIFICED[dominant].replace("你", "我")}` +
    `若你也站在那年正月的市楼下，未必会走我这条路——可灯落的时候，我没有后悔。`;

  return {
    lifeTitleZh,
    epithetZh: TAG_EPITHET[dominant],
    arcSummaryZh,
    turningPoints,
    relationships,
    valuesRevealedZh: tags.map((t) => ACTION_TAG_VALUES_ZH[t]),
    protectedZh: TAG_PROTECTED[dominant],
    sacrificedZh: TAG_SACRIFICED[dominant],
    roadNotTakenZh: TAG_ROAD[dominant],
    closingLetterZh,
    mirror: buildScriptedMirror(state),
    shareCard: {
      headlineZh: lifeTitleZh,
      sublineZh: `长安上元 · 七日 · ${TAG_EPITHET[dominant]}`,
      statHighlightsZh: [
        `银钱 ${state.player.money} 文（${moneyDiff >= 0 ? "+" : ""}${moneyDiff}）`,
        repLine,
        `最深羁绊 · ${deepestName}`,
      ],
      sealZh: "长安浮生",
    },
  };
}
