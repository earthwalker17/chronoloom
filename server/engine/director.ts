import type { IdentityId } from "@shared/constants";
import type { Choice, DirectorTurn, LifeReport, QueuedEvent, SessionState } from "@shared/types";

export interface Director {
  readonly name: "claude" | "scripted";
  /** Arrival scene for a brand-new session (turn 0). */
  startLife(state: SessionState): Promise<DirectorTurn>;
  /** Next turn from current state + the chosen action + events now due. */
  takeTurn(state: SessionState, chosen: Choice, dueEvents: QueuedEvent[]): Promise<DirectorTurn>;
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
