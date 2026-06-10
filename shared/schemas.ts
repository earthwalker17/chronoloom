/**
 * Single source of truth for every data shape in ChronoLoom.
 *
 * Structured-output rules (DirectorTurn / LifeReport go through
 * zodOutputFormat to Claude): fixed-key objects only (no z.record),
 * every field required, sentinel values ("" / []) instead of optionals.
 * Numeric bounds live in clamp.ts, not in the schema.
 */
import { z } from "zod";
import {
  ACCESS_TAGS,
  ACTION_TAGS,
  CHOICE_IDS,
  CROWD_LEVELS,
  FINAL_STANDINGS,
  IDENTITY_IDS,
  LANTERN_LEVELS,
  LOCATION_IDS,
  MOODS,
  NPC_IDS,
  PRESET_IDS,
  RISK_LEVELS,
  SKILL_IDS,
  STATUS_IDS,
  TENSION_IDS,
  TIMELINE_KINDS,
  TIMES_OF_DAY,
  WEATHERS,
} from "./constants";

// ---------------------------------------------------------------------------
// Enum schemas
// ---------------------------------------------------------------------------

export const IdentityIdSchema = z.enum(IDENTITY_IDS);
export const NpcIdSchema = z.enum(NPC_IDS);
export const LocationIdSchema = z.enum(LOCATION_IDS);
export const PresetIdSchema = z.enum(PRESET_IDS);
export const SkillIdSchema = z.enum(SKILL_IDS);
export const StatusIdSchema = z.enum(STATUS_IDS);
export const AccessTagSchema = z.enum(ACCESS_TAGS);
export const TensionIdSchema = z.enum(TENSION_IDS);
export const TimeOfDaySchema = z.enum(TIMES_OF_DAY);
export const WeatherSchema = z.enum(WEATHERS);
export const MoodSchema = z.enum(MOODS);
export const CrowdLevelSchema = z.enum(CROWD_LEVELS);
export const LanternLevelSchema = z.enum(LANTERN_LEVELS);
export const ActionTagSchema = z.enum(ACTION_TAGS);
export const RiskLevelSchema = z.enum(RISK_LEVELS);
export const TimelineKindSchema = z.enum(TIMELINE_KINDS);
export const FinalStandingSchema = z.enum(FINAL_STANDINGS);
export const ChoiceIdSchema = z.enum(CHOICE_IDS);

// Fixed-key numeric maps (structured-output safe; no z.record anywhere).
export const SkillsSchema = z.object({
  letters: z.number(),
  etiquette: z.number(),
  bargaining: z.number(),
  tongues: z.number(),
  streetwise: z.number(),
});

export const TendenciesSchema = z.object({
  seek_patronage: z.number(),
  protect_someone: z.number(),
  conceal_info: z.number(),
  reveal_info: z.number(),
  take_risk: z.number(),
  preserve_reputation: z.number(),
  pursue_money: z.number(),
  pursue_status: z.number(),
  pursue_art: z.number(),
  observe_wait: z.number(),
});

export const TensionsSchema = z.object({
  official_scrutiny: z.number(),
  guild_dispute: z.number(),
  festival_fervor: z.number(),
  street_danger: z.number(),
});

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export const SceneDirectiveSchema = z.object({
  locationId: LocationIdSchema,
  timeOfDay: TimeOfDaySchema,
  weather: WeatherSchema,
  mood: MoodSchema,
  crowd: CrowdLevelSchema,
  lanterns: LanternLevelSchema,
  focusNpcIds: z.array(NpcIdSchema),
});

export const ChoiceSchema = z.object({
  id: ChoiceIdSchema,
  labelZh: z.string(),
  /** Consequence hint shown under the label; "" = none. */
  hintZh: z.string(),
  actionTag: ActionTagSchema,
  risk: RiskLevelSchema,
});

// ---------------------------------------------------------------------------
// Live state (internal — persisted, never sent to the model verbatim)
// ---------------------------------------------------------------------------

export const PlayerStateSchema = z.object({
  identityId: IdentityIdSchema,
  nameZh: z.string(),
  age: z.number(),
  money: z.number(),
  health: z.number(),
  reputation: z.number(),
  skills: SkillsSchema,
  /** Server-computed histogram of chosen action tags. Never model-writable. */
  tendencies: TendenciesSchema,
  statuses: z.array(StatusIdSchema),
  accessTags: z.array(AccessTagSchema),
  location: LocationIdSchema,
});

export const RumorSchema = z.object({ id: z.string(), textZh: z.string() });

export const WorldStateSchema = z.object({
  day: z.number(),
  timeOfDay: TimeOfDaySchema,
  weather: WeatherSchema,
  publicMoodZh: z.string(),
  tensions: TensionsSchema,
  rumors: z.array(RumorSchema),
});

export const NpcMemorySchema = z.object({ turn: z.number(), summaryZh: z.string() });

export const NpcStateSchema = z.object({
  id: NpcIdSchema,
  nameZh: z.string(),
  roleZh: z.string(),
  /** Hidden from the client. */
  motivationZh: z.string(),
  trust: z.number(),
  fear: z.number(),
  respect: z.number(),
  /** Hidden, mutable. */
  agendaZh: z.string(),
  memory: z.array(NpcMemorySchema),
});

export const QueuedEventSchema = z.object({
  id: z.string(),
  hintZh: z.string(),
  dueTurn: z.number(),
  status: z.enum(["pending", "fired", "cancelled"]),
  source: z.enum(["seed", "director"]),
});

export const TimelineEventSchema = z.object({
  id: z.string(),
  turn: z.number(),
  day: z.number(),
  kind: TimelineKindSchema,
  titleZh: z.string(),
  descZh: z.string(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  npcIds: z.array(NpcIdSchema),
  locationId: LocationIdSchema,
});

export const CausalEntrySchema = z.object({
  id: z.string(),
  turn: z.number(),
  cause: z.enum(["player_action", "npc_action", "world_event", "time_passage"]),
  textZh: z.string(),
  effectsZh: z.array(z.string()),
  openedZh: z.array(z.string()),
  closedZh: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// DirectorTurn — the ONLY thing engines return for a turn
// ---------------------------------------------------------------------------

export const NpcUpdateSchema = z.object({
  npcId: NpcIdSchema,
  trustDelta: z.number(),
  fearDelta: z.number(),
  respectDelta: z.number(),
  /** "" = keep current agenda. */
  agendaZh: z.string(),
  /** "" = no new memory. */
  memoryZh: z.string(),
});

export const TurnUpdateSchema = z.object({
  moneyDelta: z.number(),
  healthDelta: z.number(),
  reputationDelta: z.number(),
  /** Skills that improve this turn (clamped to max 1). */
  skillUps: z.array(SkillIdSchema),
  statusAdd: z.array(StatusIdSchema),
  statusRemove: z.array(StatusIdSchema),
  moveTo: z.enum([...LOCATION_IDS, "stay"]),
  timeAdvance: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  /** "" = unchanged. */
  publicMoodZh: z.string(),
  tensionDeltas: TensionsSchema,
  /** "" = no new rumor. */
  rumorAddZh: z.string(),
  npcUpdates: z.array(NpcUpdateSchema),
});

export const EventOpSchema = z.object({
  op: z.enum(["schedule", "cancel"]),
  eventId: z.string(),
  dueTurnOffset: z.number(),
  hintZh: z.string(),
});

export const NewTimelineEventSchema = z.object({
  kind: TimelineKindSchema,
  titleZh: z.string(),
  descZh: z.string(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  npcIds: z.array(NpcIdSchema),
  locationId: LocationIdSchema,
});

export const NewCausalEntrySchema = z.object({
  cause: z.enum(["player_action", "npc_action", "world_event", "time_passage"]),
  textZh: z.string(),
  effectsZh: z.array(z.string()),
  openedZh: z.array(z.string()),
  closedZh: z.array(z.string()),
});

export const DirectorTurnSchema = z.object({
  sceneTitleZh: z.string(),
  /** What visibly changed because of the last action. "" on arrival. */
  consequenceRecapZh: z.string(),
  proseZh: z.string(),
  directive: SceneDirectiveSchema,
  choices: z.array(ChoiceSchema),
  update: TurnUpdateSchema,
  eventOps: z.array(EventOpSchema),
  timelineEvents: z.array(NewTimelineEventSchema),
  causalEntries: z.array(NewCausalEntrySchema),
  isEnding: z.boolean(),
  endingReasonZh: z.string(),
});

// ---------------------------------------------------------------------------
// Wire schema for structured outputs (relaxed)
//
// The full DirectorTurnSchema compiles to a constrained-decoding grammar that
// exceeds the API's size limit ("compiled grammar too large"). This variant
// keeps enums only where they are cheap or critical and relaxes repeated
// enum-arrays / literal-unions to plain strings/numbers; the server-side
// sanitizer (server/engine/wire.ts) + clamp.ts restore full strictness before
// anything touches game state.
// ---------------------------------------------------------------------------

export const WireChoiceSchema = z.object({
  labelZh: z.string(),
  hintZh: z.string(),
  actionTag: ActionTagSchema,
  risk: RiskLevelSchema,
});

export const WireNpcUpdateSchema = z.object({
  npcId: NpcIdSchema,
  trustDelta: z.number(),
  fearDelta: z.number(),
  respectDelta: z.number(),
  agendaZh: z.string(),
  memoryZh: z.string(),
});

export const DirectorTurnWireSchema = z.object({
  sceneTitleZh: z.string(),
  consequenceRecapZh: z.string(),
  proseZh: z.string(),
  directive: z.object({
    locationId: LocationIdSchema,
    timeOfDay: TimeOfDaySchema,
    weather: WeatherSchema,
    mood: MoodSchema,
    crowd: CrowdLevelSchema,
    lanterns: LanternLevelSchema,
    focusNpcIds: z.array(z.string()),
  }),
  choices: z.array(WireChoiceSchema),
  update: z.object({
    moneyDelta: z.number(),
    healthDelta: z.number(),
    reputationDelta: z.number(),
    skillUps: z.array(z.string()),
    statusAdd: z.array(z.string()),
    statusRemove: z.array(z.string()),
    moveTo: z.string(),
    timeAdvance: z.number(),
    publicMoodZh: z.string(),
    tensionDeltas: TensionsSchema,
    rumorAddZh: z.string(),
    npcUpdates: z.array(WireNpcUpdateSchema),
  }),
  timelineEvents: z.array(
    z.object({
      kind: z.string(),
      titleZh: z.string(),
      descZh: z.string(),
      importance: z.number(),
      npcIds: z.array(z.string()),
    }),
  ),
  causalEntries: z.array(
    z.object({
      cause: z.string(),
      textZh: z.string(),
      effectsZh: z.array(z.string()),
      openedZh: z.array(z.string()),
      closedZh: z.array(z.string()),
    }),
  ),
  isEnding: z.boolean(),
  endingReasonZh: z.string(),
});

// ---------------------------------------------------------------------------
// Life report
// ---------------------------------------------------------------------------

export const TurningPointSchema = z.object({
  /** Must cite a real timeline event id; uncited claims are dropped. */
  timelineId: z.string(),
  titleZh: z.string(),
  whyZh: z.string(),
});

export const ReportRelationshipSchema = z.object({
  npcId: NpcIdSchema,
  arcZh: z.string(),
  finalStanding: FinalStandingSchema,
});

export const ShareCardSchema = z.object({
  headlineZh: z.string(),
  sublineZh: z.string(),
  statHighlightsZh: z.array(z.string()),
  sealZh: z.string(),
});

export const LifeReportSchema = z.object({
  lifeTitleZh: z.string(),
  epithetZh: z.string(),
  arcSummaryZh: z.string(),
  turningPoints: z.array(TurningPointSchema),
  relationships: z.array(ReportRelationshipSchema),
  valuesRevealedZh: z.array(z.string()),
  protectedZh: z.string(),
  sacrificedZh: z.string(),
  roadNotTakenZh: z.string(),
  closingLetterZh: z.string(),
  shareCard: ShareCardSchema,
});

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export const SceneSchema = z.object({
  titleZh: z.string(),
  consequenceRecapZh: z.string(),
  proseZh: z.string(),
  directive: SceneDirectiveSchema,
  choices: z.array(ChoiceSchema),
});

export const HistoryEntrySchema = z.object({
  turn: z.number(),
  choiceId: ChoiceIdSchema,
  labelZh: z.string(),
  actionTag: ActionTagSchema,
  engineUsed: z.string(),
});

export const SessionStateSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  engine: z.enum(["claude", "scripted"]),
  identityId: IdentityIdSchema,
  turn: z.number(),
  chapter: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  finished: z.boolean(),
  endingReasonZh: z.string(),
  player: PlayerStateSchema,
  world: WorldStateSchema,
  npcs: z.object({
    shen_yanqiu: NpcStateSchema,
    cui_jiu: NpcStateSchema,
    lvyao: NpcStateSchema,
    pei_heng: NpcStateSchema,
    he_shisan: NpcStateSchema,
  }),
  eventQueue: z.array(QueuedEventSchema),
  timeline: z.array(TimelineEventSchema),
  ledger: z.array(CausalEntrySchema),
  scene: SceneSchema,
  history: z.array(HistoryEntrySchema),
  validationLog: z.array(z.string()),
  report: LifeReportSchema.nullable(),
});

// ---------------------------------------------------------------------------
// API DTOs
// ---------------------------------------------------------------------------

export const CreateSessionBodySchema = z.object({
  identityId: IdentityIdSchema,
  playerNameZh: z.string().optional(),
});

export const TurnBodySchema = z.object({
  choiceId: ChoiceIdSchema,
  /** Turn the client believes it is on; mismatch → 409 (idempotency fence). */
  turn: z.number(),
});

/** Redacted NPC view — the world knows things the player doesn't. */
export const NpcViewSchema = z.object({
  id: NpcIdSchema,
  nameZh: z.string(),
  roleZh: z.string(),
  tier: z.enum(["冷淡", "相识", "信任", "莫逆"]),
  glyph: z.enum(["亲", "敬", "疑", "敌"]),
  /** Most recent relationship change line; "" if unchanged. */
  lastChangeZh: z.string(),
  changedThisTurn: z.boolean(),
});

export const SessionViewSchema = z.object({
  id: z.string(),
  engine: z.enum(["claude", "scripted"]),
  identityId: IdentityIdSchema,
  turn: z.number(),
  chapter: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  chapterNameZh: z.string(),
  finished: z.boolean(),
  endingReasonZh: z.string(),
  player: z.object({
    nameZh: z.string(),
    identityNameZh: z.string(),
    money: z.number(),
    health: z.number(),
    reputation: z.number(),
    skills: SkillsSchema,
    statusesZh: z.array(z.string()),
    location: LocationIdSchema,
    locationNameZh: z.string(),
  }),
  world: z.object({
    day: z.number(),
    dayNameZh: z.string(),
    timeOfDay: TimeOfDaySchema,
    timeOfDayZh: z.string(),
    weather: WeatherSchema,
    weatherZh: z.string(),
    publicMoodZh: z.string(),
    rumorsZh: z.array(z.string()),
  }),
  npcs: z.array(NpcViewSchema),
  scene: SceneSchema,
  timeline: z.array(TimelineEventSchema),
  hasReport: z.boolean(),
});

export const IdentityCardSchema = z.object({
  id: IdentityIdSchema,
  nameZh: z.string(),
  glyphZh: z.string(),
  cardLineZh: z.string(),
  statHintsZh: z.array(z.string()),
});

export const MetaResponseSchema = z.object({
  era: z.object({
    titleZh: z.string(),
    subtitleZh: z.string(),
    introZh: z.string(),
    rumorsZh: z.array(z.string()),
  }),
  identities: z.array(IdentityCardSchema),
});
