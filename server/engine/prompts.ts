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

## 数值边界（超出会被系统裁剪并记录）
- moneyDelta ±2000，healthDelta ±20，reputationDelta ±10
- npc trustDelta ±15，fearDelta/respectDelta ±10，tensionDeltas 每项 ±2
- skillUps 每回合至多 1 项；timeAdvance 0~2（晨→午→暮→夜）
- moveTo 仅限已知地点；market_office 需有官面途径方可进入

## 输出
只输出符合 schema 的 JSON。所有玩家可见文本用中文（白话叙述，人物称谓与名物须合于唐代）；所有 id 与枚举用英文。`;

const STATIC_CONTENT = {
  eraBible: ERA_BIBLE,
  identities: IDENTITIES,
  locations: LOCATIONS,
  npcs: NPCS,
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

export const REPORT_RULES = `你是「时织」的命书执笔人。根据玩家七日人生的真实记录（时间线、因果账、倾向统计、人物关系轨迹），写一份命书（LifeReport JSON）。

铁律：
1. 每一条 turningPoint 必须引用真实存在的 timelineId，whyZh 须扣住该事件实际改变了什么。
2. valuesRevealedZh 只能写玩家行为里真实体现过的价值（依据 tendencies 统计），至多 4 个，使用给定的价值词汇。
3. 禁止泛泛的性格测试话术（"你是一个外向的人"之类）；每句话都要能指向这段人生里发生过的具体事。
4. closingLetterZh 是「这个世界里的你」写给「另一个世界的你」的信，120~200 字，克制而有余味。
5. lifeTitleZh ≤ 12 字，epithetZh ≤ 8 字，shareCard.sealZh 恰好 4 字，statHighlightsZh 恰好 3 条。
6. 所有玩家可见文本用中文；npcId 与枚举用英文。`;

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
