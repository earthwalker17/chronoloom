/** z.infer re-exports — import types from here, schemas from ./schemas. */
import type { z } from "zod";
import type {
  CausalEntrySchema,
  ChoiceSchema,
  CreateSessionBodySchema,
  DirectorTurnSchema,
  EventOpSchema,
  HistoryEntrySchema,
  IdentityCardSchema,
  LifeReportSchema,
  MetaResponseSchema,
  NewCausalEntrySchema,
  NewTimelineEventSchema,
  NpcStateSchema,
  NpcUpdateSchema,
  NpcViewSchema,
  PlayerStateSchema,
  QueuedEventSchema,
  RumorSchema,
  SceneDirectiveSchema,
  SceneSchema,
  SessionStateSchema,
  SessionViewSchema,
  ShareCardSchema,
  SkillsSchema,
  TendenciesSchema,
  TensionsSchema,
  TimelineEventSchema,
  TurnBodySchema,
  TurnUpdateSchema,
  WorldStateSchema,
} from "./schemas";

export type Skills = z.infer<typeof SkillsSchema>;
export type Tendencies = z.infer<typeof TendenciesSchema>;
export type Tensions = z.infer<typeof TensionsSchema>;
export type SceneDirective = z.infer<typeof SceneDirectiveSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type Rumor = z.infer<typeof RumorSchema>;
export type WorldState = z.infer<typeof WorldStateSchema>;
export type NpcState = z.infer<typeof NpcStateSchema>;
export type QueuedEvent = z.infer<typeof QueuedEventSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type CausalEntry = z.infer<typeof CausalEntrySchema>;
export type NpcUpdate = z.infer<typeof NpcUpdateSchema>;
export type TurnUpdate = z.infer<typeof TurnUpdateSchema>;
export type EventOp = z.infer<typeof EventOpSchema>;
export type NewTimelineEvent = z.infer<typeof NewTimelineEventSchema>;
export type NewCausalEntry = z.infer<typeof NewCausalEntrySchema>;
export type DirectorTurn = z.infer<typeof DirectorTurnSchema>;
export type LifeReport = z.infer<typeof LifeReportSchema>;
export type ShareCard = z.infer<typeof ShareCardSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;
export type TurnBody = z.infer<typeof TurnBodySchema>;
export type NpcView = z.infer<typeof NpcViewSchema>;
export type SessionView = z.infer<typeof SessionViewSchema>;
export type IdentityCard = z.infer<typeof IdentityCardSchema>;
export type MetaResponse = z.infer<typeof MetaResponseSchema>;
