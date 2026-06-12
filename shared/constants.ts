/**
 * Canonical enums, clamp tables and pacing tables for the Tang Chang'an slice.
 * Everything player-facing is Chinese (Zh suffix); ids and enums are English.
 */

export const IDENTITY_IDS = ["scholar", "apprentice", "interpreter", "copyist"] as const;
export type IdentityId = (typeof IDENTITY_IDS)[number];

export const NPC_IDS = ["shen_yanqiu", "cui_jiu", "lvyao", "pei_heng", "he_shisan"] as const;
export type NpcId = (typeof NPC_IDS)[number];

export const LOCATION_IDS = [
  "market_cross",
  "silk_row",
  "wine_house",
  "persian_lodge",
  "bookshop",
  "temple_hall",
  "market_office",
  "gate_lane",
] as const;
export type LocationId = (typeof LOCATION_IDS)[number];

export const PRESET_IDS = [
  "market_street",
  "stall_row",
  "teahouse_porch",
  "gate_plaza",
  "back_alley",
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const SKILL_IDS = ["letters", "etiquette", "bargaining", "tongues", "streetwise"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SKILL_NAMES_ZH: Record<SkillId, string> = {
  letters: "文墨",
  etiquette: "礼数",
  bargaining: "商道",
  tongues: "胡语",
  streetwise: "市井",
};

export const STATUS_IDS = [
  "under_suspicion",
  "guild_favor",
  "official_errand",
  "in_debt",
  "poem_famous",
  "holds_ledger_page",
  "sheltering_friend",
  "injured",
  "arrested",
] as const;
export type StatusId = (typeof STATUS_IDS)[number];

export const STATUS_NAMES_ZH: Record<StatusId, string> = {
  under_suspicion: "受疑",
  guild_favor: "行会青眼",
  official_errand: "官差在身",
  in_debt: "负债",
  poem_famous: "诗名鹊起",
  holds_ledger_page: "身藏账页",
  sheltering_friend: "庇护友人",
  injured: "带伤",
  arrested: "被拘",
};

export const ACCESS_TAGS = [
  "scholar_circle",
  "guild_floor",
  "caravan_court",
  "temple_inner",
  "office_lobby",
] as const;
export type AccessTag = (typeof ACCESS_TAGS)[number];

export const TENSION_IDS = [
  "official_scrutiny",
  "guild_dispute",
  "festival_fervor",
  "street_danger",
] as const;
export type TensionId = (typeof TENSION_IDS)[number];

export const TIMES_OF_DAY = ["morning", "noon", "dusk", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const WEATHERS = ["clear", "overcast", "snow", "windy"] as const;
export type Weather = (typeof WEATHERS)[number];

export const MOODS = ["festive", "calm", "tense", "ominous", "melancholy"] as const;
export type Mood = (typeof MOODS)[number];

export const CROWD_LEVELS = ["sparse", "busy", "packed"] as const;
export type CrowdLevel = (typeof CROWD_LEVELS)[number];

export const LANTERN_LEVELS = ["none", "dim", "bright", "festival"] as const;
export type LanternLevel = (typeof LANTERN_LEVELS)[number];

export const ACTION_TAGS = [
  "seek_patronage",
  "protect_someone",
  "conceal_info",
  "reveal_info",
  "take_risk",
  "preserve_reputation",
  "pursue_money",
  "pursue_status",
  "pursue_art",
  "observe_wait",
] as const;
export type ActionTag = (typeof ACTION_TAGS)[number];

/** Value chip shown in the life report for each dominant tendency. */
export const ACTION_TAG_VALUES_ZH: Record<ActionTag, string> = {
  seek_patronage: "攀缘",
  protect_someone: "重义",
  conceal_info: "藏锋",
  reveal_info: "直言",
  take_risk: "敢为",
  preserve_reputation: "惜名",
  pursue_money: "务实",
  pursue_status: "求达",
  pursue_art: "尚雅",
  observe_wait: "谨慎",
};

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const TIMELINE_KINDS = [
  "decision",
  "consequence",
  "relationship",
  "opportunity",
  "setback",
  "milestone",
] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export const FINAL_STANDINGS = ["devoted", "warm", "wary", "hostile", "severed"] as const;
export type FinalStanding = (typeof FINAL_STANDINGS)[number];

export const FINAL_STANDING_ZH: Record<FinalStanding, string> = {
  devoted: "莫逆",
  warm: "亲厚",
  wary: "存疑",
  hostile: "交恶",
  severed: "恩断",
};

export const CHOICE_IDS = ["c1", "c2", "c3", "c4"] as const;
export type ChoiceId = (typeof CHOICE_IDS)[number];

/** Engines a session can be pinned to ("scripted" = offline deterministic). */
export const ENGINE_IDS = ["claude", "openai", "deepseek", "scripted"] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

// ---------------------------------------------------------------------------
// Clamp tables (enforced in server/sim/clamp.ts, never in JSON Schema)
// ---------------------------------------------------------------------------

export const PER_TURN_CLAMPS = {
  trustDelta: 15,
  fearDelta: 10,
  respectDelta: 10,
  reputationDelta: 10,
  moneyDelta: 2000,
  healthDelta: 20,
  tensionDelta: 2,
} as const;

export const ABS_RANGES = {
  money: { min: 0, max: 50000 },
  health: { min: 0, max: 100 },
  reputation: { min: -100, max: 100 },
  trust: { min: -100, max: 100 },
  fear: { min: 0, max: 100 },
  respect: { min: 0, max: 100 },
  skill: { min: 0, max: 5 },
  tension: { min: 0, max: 10 },
  day: { min: 1, max: 7 },
} as const;

export const CAPS = {
  rumors: 6,
  npcMemory: 8,
  timelineEventsPerTurn: 3,
  causalEntriesPerTurn: 4,
  eventOpsPerTurn: 3,
  choicesMin: 3,
  choicesMax: 4,
  proseMaxChars: 600,
  npcMemoryMaxChars: 80,
  dueTurnOffsetMin: 1,
  dueTurnOffsetMax: 5,
  focusNpcsMax: 3,
  valuesRevealedMax: 4,
  /** In-scene speech bubbles per turn. */
  npcLinesMax: 3,
  npcLineMaxChars: 40,
  /** 攀谈 micro-interaction bounds (sub-turn, once per NPC per turn). */
  talkTrustClamp: 3,
  talkLineMaxChars: 60,
  /** Choice cost ceilings (model-priced, clamp-enforced). */
  moneyCostMax: 2000,
  staminaCostMax: 20,
  /** The affordability floor: this many choices must always remain pickable. */
  minAffordableChoices: 2,
  /** Mirror (镜中人) section bounds. */
  mirrorThemesMax: 3,
} as const;

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

/** Final main turn index. Turn 0 is the arrival scene. */
export const MAX_TURN = 10;

/** Server-computed chapter for a given turn (model can never move chapters). */
export function chapterForTurn(turn: number): 1 | 2 | 3 {
  if (turn <= 3) return 1;
  if (turn <= 7) return 2;
  return 3;
}

export const CHAPTER_NAMES_ZH: Record<1 | 2 | 3, string> = {
  1: "试灯",
  2: "正灯",
  3: "收灯",
};

/**
 * Minimum festival day per turn index (正月十三..十九 → day 1..7).
 * world.day = max(computed, DAY_FLOORS[turn]).
 */
export const DAY_FLOORS = [1, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7] as const;

export const DAY_NAMES_ZH = ["十三", "十四", "十五", "十六", "十七", "十八", "十九"] as const;

export const TIME_OF_DAY_ZH: Record<TimeOfDay, string> = {
  morning: "晨",
  noon: "午",
  dusk: "暮",
  night: "夜",
};

export const WEATHER_ZH: Record<Weather, string> = {
  clear: "晴",
  overcast: "阴",
  snow: "小雪",
  windy: "夜风",
};

// ---------------------------------------------------------------------------
// Relationship presentation tiers (client sees tiers, not raw trust)
// ---------------------------------------------------------------------------

export type TrustTier = "冷淡" | "相识" | "信任" | "莫逆";

export function trustTier(trust: number): TrustTier {
  if (trust >= 50) return "莫逆";
  if (trust >= 15) return "信任";
  if (trust >= -15) return "相识";
  return "冷淡";
}

/** Choice gates compare tiers by rank; "" = no gate. */
export const TIER_RANK: Record<"" | TrustTier, number> = {
  "": 0,
  冷淡: 0,
  相识: 1,
  信任: 2,
  莫逆: 3,
};

/** Tiers usable as a choice gate (gating on 冷淡 would be a no-op). */
export const GATE_TIERS = ["相识", "信任", "莫逆"] as const;
export type GateTier = (typeof GATE_TIERS)[number];

export type AttitudeGlyph = "亲" | "敬" | "疑" | "敌";

export function attitudeGlyph(trust: number, fear: number, respect: number): AttitudeGlyph {
  if (trust <= -30) return "敌";
  if (trust >= 30) return "亲";
  if (respect >= 40 && trust >= 0) return "敬";
  return "疑";
}
