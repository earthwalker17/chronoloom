/**
 * Prompt architecture (cache-friendly by construction):
 *  - DIRECTOR_RULES + STATIC_CONTENT form one byte-stable global prefix shared
 *    by every session and every turn (cache_control on the last block).
 *  - Everything volatile (state snapshot, action, due events, texture hint)
 *    lives in the user turn, after the cached prefix.
 * No timestamps, no session ids, no conditionals in the prefix; deterministic
 * sorted-key serialization everywhere.
 */
import { NPC_IDS } from "@shared/constants";
import type { Choice, QueuedEvent, SessionState } from "@shared/types";
import { ERA_BIBLE } from "../content/eraBible";
import { IDENTITIES } from "../content/identities";
import { LOCATIONS } from "../content/locations";
import { NPCS } from "../content/npcs";
import type { TalkContext } from "./director";

/** Deterministic JSON: keys sorted at every level. */
export function stringifySorted(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, sortValue(v)]),
    );
  }
  return value;
}

/** Seeded picker for prose texture — variety without sampling params. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function textureHint(sessionId: string, turn: number): string {
  const rand = mulberry32(hashString(`${sessionId}:${turn}`));
  const motifs = ERA_BIBLE.visualMotifsZh;
  return motifs[Math.floor(rand() * motifs.length)] ?? motifs[0] ?? "灯影";
}

// ---------------------------------------------------------------------------
// Static prefix
// ---------------------------------------------------------------------------

export const DIRECTOR_RULES = `你是「时织」的世界导演（Director），主持一场唐代长安东市上元灯节七日的人生模拟。玩家以一个具体身份生活其中。你每回合读取结构化状态与玩家行动，推演后果，并以严格的 JSON 结构返回下一幕。

## 你的职责
1. 从状态推演，而非凭空编造：每个后果都必须能由当前状态、玩家行动与世界规则解释。
2. consequenceRecapZh：开篇先让玩家看见「因为你上一步做了什么，世界发生了什么变化」，一到两句，具体可感。到场景（arrival）时为空字符串。
3. proseZh：一段 150~280 字的中文场景文，沉浸、具体、克制。写市声、灯影、人情的质感；忌空泛抒情、忌现代语汇、忌说教。当回合若有 due_events，必须把它们织进场景。
4. choices：3~4 个有分量的选择，各自折射不同的价值取向（actionTag 至少 3 种），无明显"正确答案"，labelZh 不超过 30 字，hintZh 是一句后果暗示（可为空字符串）。
5. update：用有界的增量更新状态。钱以"文"计；信任/声望等变化要与事件分量相称，宁小勿大。
6. timelineEvents：本回合值得记入浮生簿的事（至多 3 条，importance 3 仅限重大转折）。causalEntries：因果账（至少 1 条）：什么导致了什么、打开或关闭了哪些路。
7. directive：场景视觉指令，与 proseZh 描写一致（地点/时辰/天气/气氛/人潮/灯火/在场要角）。
8. NPC 是活人：有动机、有记忆、会记仇也会报恩。npcUpdates 里用 memoryZh（≤80字）记下他们会记住的事。
9. 节奏：chapter 1（回合0-3）布局试探，chapter 2（4-7）风波升级，chapter 3（8-10）收束清算。isEnding 只在 chapter 3 且确实到了终局时为 true（回合 10 必须收束）。
10. 世界自有边界：遵守 plausibilityRules 与身份的 forbidden 条目。玩家不能凭空获得身份外的能力、财富与权力。时间只向前。
11. 选择定价：choices 可带 moneyCost/staminaCost/minReputation/minTrustNpcId+minTrustTier。有分量的行动要在虚构内定价——宴请需钱、奔走耗体、声望与交情解锁门路但也引人注目；每回合至少 2 个选择免费且无门槛；带代价或门槛的选择，须在 hintZh 里自然点出（如"得备份薄礼"）。
12. npcLines：1~3 句场景内说出口的台词，每句 ≤40 字，只许给 directive.focusNpcIds 中的人物，须合于各自 personaZh 的声口，不得重复 proseZh 里已有的句子。
13. proseZh 里若有对话，须按 personaZh 分声口：节奏、称谓、口头习惯要能分辨出是谁在说话。

## 数值边界（超出会被系统裁剪并记录）
- moneyDelta ±2000，healthDelta ±20，reputationDelta ±10
- npc trustDelta ±15，fearDelta/respectDelta ±10，tensionDeltas 每项 ±2
- skillUps 每回合至多 1 项；timeAdvance 0~2（晨→午→暮→夜）
- moveTo 仅限已知地点；market_office 需有官面途径方可进入
- moneyCost 0~2000，staminaCost 0~20，minReputation -100~100

## 输出
只输出符合 schema 的 JSON。所有玩家可见文本用中文（白话叙述，人物称谓与名物须合于唐代）；所有 id 与枚举用英文。`;

/**
 * NPC block for the cached prefix: persona voice included, disclosures NEVER.
 * The prefix is shared by every turn call of every session — a secret in here
 * would leak to all of them. Secrets travel only through the talk path, where
 * the route pre-filters them by earned trust tier.
 */
const STATIC_NPCS = Object.fromEntries(
  NPC_IDS.map((id) => {
    const { disclosures: _secrets, ...visible } = NPCS[id];
    return [id, visible];
  }),
);

const STATIC_CONTENT = {
  eraBible: ERA_BIBLE,
  identities: IDENTITIES,
  locations: LOCATIONS,
  npcs: STATIC_NPCS,
};

export const STATIC_CONTENT_JSON = `<era_bible_and_cast>\n${stringifySorted(STATIC_CONTENT)}\n</era_bible_and_cast>`;

// ---------------------------------------------------------------------------
// Volatile user turns
// ---------------------------------------------------------------------------

function stateSnapshot(state: SessionState): string {
  const snapshot = {
    chapter: state.chapter,
    turn: state.turn,
    player: state.player,
    world: state.world,
    npcs: Object.fromEntries(
      NPC_IDS.map((id) => {
        const n = state.npcs[id];
        return [
          id,
          {
            trust: n.trust,
            fear: n.fear,
            respect: n.respect,
            agendaZh: n.agendaZh,
            recentMemory: n.memory.slice(-3),
          },
        ];
      }),
    ),
  };
  return stringifySorted(snapshot);
}

function recentContext(state: SessionState): string {
  return stringifySorted({
    recentCausal: state.ledger.slice(-5),
    recentTimeline: state.timeline.slice(-5),
  });
}

export function buildArrivalPrompt(state: SessionState): string {
  return [
    `<task>这是这段人生的第 0 回合（到场景）。玩家刚刚以「${IDENTITIES[state.identityId].nameZh}」的身份进入长安东市。写出到场景：交代处境与张力，给出第一组选择。consequenceRecapZh 留空，update 全部为零增量（moveTo:"stay"，timeAdvance 按场景需要 0~2），timelineEvents 记一条「初入灯市」类的里程碑。</task>`,
    `<state>${stateSnapshot(state)}</state>`,
    `<texture_hint>本回合可织入的意象：${textureHint(state.id, 0)}</texture_hint>`,
  ].join("\n");
}

export function buildTurnPrompt(state: SessionState, chosen: Choice, dueEvents: QueuedEvent[]): string {
  const due = dueEvents.length
    ? `<due_events>以下既定事件已到期，必须织进本回合：${stringifySorted(
        dueEvents.map((e) => ({ id: e.id, hintZh: e.hintZh })),
      )}</due_events>`
    : "";
  return [
    `<task>推演第 ${state.turn + 1} 回合。先在 consequenceRecapZh 里写出上一步行动的可见后果，再展开新场景。</task>`,
    `<state>${stateSnapshot(state)}</state>`,
    `<recent_context>${recentContext(state)}</recent_context>`,
    due,
    `<player_action choiceId="${chosen.id}" actionTag="${chosen.actionTag}" risk="${chosen.risk}">${chosen.labelZh}</player_action>`,
    `<texture_hint>本回合可织入的意象：${textureHint(state.id, state.turn + 1)}</texture_hint>`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// 攀谈 (talk) — its own small prefix; tier-filtered secrets ride ONLY in the
// volatile user turn (the route filters them — see server/routes/sessions.ts)
// ---------------------------------------------------------------------------

export const TALK_RULES = `你是「时织」中一位长安东市人物的扮演者。玩家走近与你攀谈，你以这个人物的身份说一两句话（TalkExchange JSON）。

规则：
1. lineZh：这个人此刻会说出口的一句话，≤60 字，必须合于其 personaZh 的声口与处境，可回应玩家近来的所作所为（见 recent_memory 与 ledger）。
2. followUpZh：可选的第二句（补充、转折或试探），≤60 字；不需要则为空字符串。
3. revealZh：只能从 <allowed_disclosures> 中选一条原文输出，或输出空字符串。列表为空就必须为空——这个人此刻不会透露任何秘密。绝不自创秘密。透露要自然：交情到了、话头对了才说。
4. trustDelta：整数 -3~+3。攀谈本身是小事：寻常寒暄 +1，说到心坎 +2~+3，唐突冒犯 -1~-3。要与人物性情和当前standing相称。
5. memoryZh：这个人会记住这次攀谈的什么（第三人称，≤80 字）；不值一记则为空字符串。
6. 人物不是全知的：只知道自己份内、市井可闻、以及 agenda/memory 里的事。守住 boundariesZh——有些话这个人无论如何不会说。
7. 所有玩家可见文本用中文；只输出符合 schema 的 JSON。`;

/** Personas only — small, byte-stable, cacheable. Disclosures NEVER here. */
export const TALK_STATIC_JSON = `<cast_personas>\n${stringifySorted(
  Object.fromEntries(
    NPC_IDS.map((id) => {
      const n = NPCS[id];
      return [
        id,
        {
          nameZh: n.nameZh,
          roleZh: n.roleZh,
          motivationZh: n.motivationZh,
          personaZh: n.personaZh,
          boundariesZh: n.boundariesZh,
        },
      ];
    }),
  ),
)}\n</cast_personas>`;

export function buildTalkPrompt(state: SessionState, ctx: TalkContext): string {
  const npc = state.npcs[ctx.npcId];
  const def = IDENTITIES[state.identityId];
  return [
    `<task>玩家（${def.nameZh}「${state.player.nameZh}」）在「${state.scene.titleZh}」的场景中走近${npc.nameZh}攀谈。以${npc.nameZh}的身份回应。</task>`,
    `<npc_state>${stringifySorted({
      npcId: ctx.npcId,
      standing: ctx.tier,
      agendaZh: npc.agendaZh,
      recentMemory: npc.memory.slice(-3),
    })}</npc_state>`,
    `<player_snapshot>${stringifySorted({
      day: state.world.day,
      timeOfDay: state.world.timeOfDay,
      location: state.player.location,
      reputationBand: state.player.reputation >= 15 ? "有些名声" : state.player.reputation <= -8 ? "名声有损" : "声名平平",
      statuses: state.player.statuses,
    })}</player_snapshot>`,
    `<recent_ledger>${stringifySorted(state.ledger.slice(-3).map((e) => e.textZh))}</recent_ledger>`,
    `<allowed_disclosures>${stringifySorted(ctx.allowedDisclosures)}</allowed_disclosures>`,
    `<already_revealed>${stringifySorted(ctx.alreadyRevealedIds)}</already_revealed>`,
  ].join("\n");
}

export const REPORT_RULES = `你是「时织」的命书执笔人。根据玩家七日人生的真实记录（时间线、因果账、倾向统计、人物关系轨迹），写一份命书（LifeReport JSON）。

铁律：
1. 每一条 turningPoint 必须引用真实存在的 timelineId，whyZh 须扣住该事件实际改变了什么。
2. valuesRevealedZh 只能写玩家行为里真实体现过的价值（依据 tendencies 统计），至多 4 个，使用给定的价值词汇。
3. 禁止泛泛的性格测试话术（"你是一个外向的人"之类）；每句话都要能指向这段人生里发生过的具体事。
4. closingLetterZh 是「这个世界里的你」写给「另一个世界的你」的信，120~200 字，克制而有余味。
5. lifeTitleZh ≤ 12 字，epithetZh ≤ 8 字，shareCard.sealZh 恰好 4 字，statHighlightsZh 恰好 3 条。
6. 所有玩家可见文本用中文；npcId 与枚举用英文。

镜中人（mirror）——写给灯影之外那位真实玩家的一段照见：
7. decisionStyleZh：从选择的整体模式里读出这个人做决定的方式（一两句，具体到模式本身，不贴标签）。
8. themes：2~3 条观察。每条 observationZh 写这些选择可能照见的真实性情、在意与害怕；evidenceZh 必须引用 history 里真实的选择措辞（如「你选了『倾囊相助，替她把这笔押钱垫上』」）。无凭据的观察不许写。
9. innerTensionZh：一句指出其中可见的内在拉扯（想要A却又B），要从两类真实选择的并存里读出来。
10. gentleAdviceZh：一句诚恳的建议。可以点出弱处，但以体谅为底色，不指摘、不说教。
11. blessingZh：温热、具体、不落俗套的收尾祝愿——禁止"愿你前程似锦"式的空话。
12. 整体语气：克制、温和、有依据。像一位看完全程的旧识，不像测评报告。禁止 MBTI/星座/任何人格类型学词汇。`;

export function buildReportPrompt(state: SessionState): string {
  const def = IDENTITIES[state.identityId];
  const trustTrajectory = Object.fromEntries(
    NPC_IDS.map((id) => [
      id,
      {
        start: NPCS[id].baseTrust + def.npcPriors[id].trust,
        end: state.npcs[id].trust,
        memories: state.npcs[id].memory,
      },
    ]),
  );
  return [
    `<task>为这段已落幕的人生撰写命书。</task>`,
    `<life_record>${stringifySorted({
      identity: { id: state.identityId, nameZh: def.nameZh, playerNameZh: state.player.nameZh, goalSeedsZh: def.goalSeedsZh },
      endingReasonZh: state.endingReasonZh,
      daysLived: state.world.day,
      finalPlayer: state.player,
      tendencies: state.player.tendencies,
      history: state.history,
      timeline: state.timeline,
      causalLedger: state.ledger,
      trustTrajectory,
    })}</life_record>`,
    `<value_vocabulary>攀缘/重义/藏锋/直言/敢为/惜名/务实/求达/尚雅/谨慎</value_vocabulary>`,
  ].join("\n");
}
