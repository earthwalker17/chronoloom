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
  ENGINE_IDS,
  FINAL_STANDINGS,
  GATE_TIERS,
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
export const EngineIdSchema = z.enum(ENGINE_IDS);
/** "" = no trust gate on this choice. */
export const GateTierSchema = z.enum(["", ...GATE_TIERS]);

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
  /**
   * Scene anchor: clicking this NPC's figure selects this choice.
   * "" = not anchored. Must be one of directive.focusNpcIds (clamp-enforced).
   */
  anchorNpcId: z.union([NpcIdSchema, z.literal("")]),
  /** Costs deducted on pick, BEFORE outcome deltas. 0 = free. */
  moneyCost: z.number(),
  staminaCost: z.number(),
  /** Gates: choice is locked (visible, unpickable) unless met. -100 / "" = no gate. */
  minReputation: z.number(),
  minTrustNpcId: z.union([NpcIdSchema, z.literal("")]),
  minTrustTier: GateTierSchema,
});

/** In-scene speech bubble line attached to a focus NPC's figure. */
export const NpcLineSchema = z.object({
  npcId: NpcIdSchema,
  lineZh: z.string(),
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
  /** Disclosure ids already surfaced through 攀谈 — never re-revealed. */
  revealed: z.array(z.string()),
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
  /** In-scene speech bubbles (≤3, focus NPCs only — clamp-enforced). */
  npcLines: z.array(NpcLineSchema),
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
  // Enums relaxed to strings: repeated in-array enum productions are what
  // blow the constrained-decoding grammar budget. wire.ts validates with
  // safe fallbacks (observe_wait / medium).
  actionTag: z.string(),
  risk: z.string(),
  /**
   * Costs/gate/anchor packed into ONE string — the grammar ceiling rejects
   * them as separate fields ("compiled grammar too large"). Space-separated
   * tokens: "money=200 stamina=8 rep=10 anchor=he_shisan"; "" = free,
   * unanchored. wire.ts parses + validates; malformed tokens just drop.
   */
  extra: z.string(),
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
  /** "npcId|台词" per entry (object nesting costs grammar; wire.ts splits). */
  npcLines: z.array(z.string()),
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
      /** Comma/；-joined npc ids — arrays-in-arrays cost grammar. */
      npcIds: z.string(),
    }),
  ),
  causalEntries: z.array(
    z.object({
      cause: z.string(),
      textZh: z.string(),
      // ；-joined lists (wire.ts splits) — string arrays here tipped the
      // grammar ceiling once npcLines + choice extras joined the schema.
      effectsZh: z.string(),
      openedZh: z.string(),
      closedZh: z.string(),
    }),
  ),
  isEnding: z.boolean(),
  endingReasonZh: z.string(),
});

// ---------------------------------------------------------------------------
// 攀谈 (talk) — bounded sub-turn micro-dialogue with one NPC
// ---------------------------------------------------------------------------

/**
 * What the engine returns for a talk exchange (wire-safe: primitives only).
 * The route clamps trustDelta to ±CAPS.talkTrustClamp and blanks revealZh
 * unless it matches a disclosure the player's trust tier has earned.
 */
export const TalkExchangeWireSchema = z.object({
  /** The NPC's spoken line, in their persona voice. ≤60 chars (clamped). */
  lineZh: z.string(),
  /** Optional second beat; "" = single-line exchange. */
  followUpZh: z.string(),
  /** A hint/secret surfaced this exchange; "" = nothing revealed. */
  revealZh: z.string(),
  trustDelta: z.number(),
  /** What the NPC will remember of this exchange; "" = nothing. ≤80 chars. */
  memoryZh: z.string(),
});

export const TalkBodySchema = z.object({
  npcId: NpcIdSchema,
  /** Turn the client believes it is on; mismatch → 409. */
  turn: z.number(),
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

/** One observed theme about the real player, tied to concrete lived evidence. */
export const MirrorThemeSchema = z.object({
  observationZh: z.string(),
  /** Must cite actual choices/moments from the life; guarded non-empty. */
  evidenceZh: z.string(),
});

/**
 * 镜中人 — what this life may reveal about the real player. Warm, specific,
 * evidence-grounded; never personality-test labels, never preachy.
 */
export const MirrorSchema = z.object({
  decisionStyleZh: z.string(),
  themes: z.array(MirrorThemeSchema),
  innerTensionZh: z.string(),
  gentleAdviceZh: z.string(),
  blessingZh: z.string(),
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
  mirror: MirrorSchema,
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
  npcLines: z.array(NpcLineSchema),
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
  engine: EngineIdSchema,
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
  /** NPCs already talked-to this turn (sub-turn fence); reset each applied turn. */
  talkedNpcIds: z.array(NpcIdSchema),
  validationLog: z.array(z.string()),
  report: LifeReportSchema.nullable(),
});

// ---------------------------------------------------------------------------
// API DTOs
// ---------------------------------------------------------------------------

export const CreateSessionBodySchema = z.object({
  identityId: IdentityIdSchema,
  playerNameZh: z.string().optional(),
  /** Engine to pin this session to; omitted = server default. */
  provider: EngineIdSchema.optional(),
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
  /** Present in the current scene (∈ directive.focusNpcIds). */
  inScene: z.boolean(),
  /** 攀谈 available right now (in scene, not yet talked-to this turn). */
  canTalk: z.boolean(),
});

/** Result of POST /sessions/:id/talk — raw trust never leaves the server. */
export const TalkResponseSchema = z.object({
  npcId: NpcIdSchema,
  /** 1–2 spoken lines (followUp folded in as a second line). */
  lines: z.array(NpcLineSchema),
  /** "" = nothing revealed this exchange. */
  revealZh: z.string(),
  attitude: z.enum(["warmer", "cooler", "unchanged"]),
  npc: NpcViewSchema,
  turn: z.number(),
});

export const SessionViewSchema = z.object({
  id: z.string(),
  engine: EngineIdSchema,
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

/** One selectable engine on the landing page (unavailable = visible, disabled). */
export const ProviderInfoSchema = z.object({
  id: EngineIdSchema,
  labelZh: z.string(),
  available: z.boolean(),
  /** Model id when configured; null for scripted/unavailable. */
  model: z.string().nullable(),
});

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  engine: EngineIdSchema,
  model: z.string().nullable(),
  providers: z.array(ProviderInfoSchema),
});
