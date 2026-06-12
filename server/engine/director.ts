import type { EngineId, IdentityId, NpcId, TrustTier } from "@shared/constants";
import type {
  Choice,
  DirectorTurn,
  LifeReport,
  QueuedEvent,
  SessionState,
  TalkExchangeWire,
} from "@shared/types";

/**
 * Context for one 攀谈 exchange. The ROUTE builds this: it computes the trust
 * tier and pre-filters disclosures, so an engine never sees a secret the
 * player's standing hasn't earned — structural information hiding, not model
 * discretion.
 */
export interface TalkContext {
  npcId: NpcId;
  tier: TrustTier;
  /** Tier-qualified, not-yet-revealed secrets — the only ones the model may surface. */
  allowedDisclosures: { id: string; revealZh: string }[];
  /** Already-surfaced disclosure ids (for continuity, never re-revealed). */
  alreadyRevealedIds: string[];
}

export type TalkResult = TalkExchangeWire;

export interface Director {
  readonly name: EngineId;
  /** Arrival scene for a brand-new session (turn 0). */
  startLife(state: SessionState): Promise<DirectorTurn>;
  /** Next turn from current state + the chosen action + events now due. */
  takeTurn(state: SessionState, chosen: Choice, dueEvents: QueuedEvent[]): Promise<DirectorTurn>;
  /** One bounded sub-turn dialogue exchange (does not advance the turn). */
  talk(state: SessionState, ctx: TalkContext): Promise<TalkResult>;
  /** Final life report from the finished session. */
  writeReport(state: SessionState): Promise<LifeReport>;
}

export type EngineErrorCode = "api" | "parse" | "refusal";

export class EngineError extends Error {
  constructor(
    public code: EngineErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export type IdentityStart = { identityId: IdentityId };
