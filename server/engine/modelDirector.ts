/**
 * ModelDirector: the Director's prompt/wire logic, parameterized by a
 * StructuredModelClient — which LLM vendor answers is a constructor detail.
 * ClaudeDirector (the verified path) is this class + AnthropicClient.
 */
import { DirectorTurnWireSchema, LifeReportSchema, TalkExchangeWireSchema } from "@shared/schemas";
import type { EngineId } from "@shared/constants";
import type { Choice, DirectorTurn, LifeReport, QueuedEvent, SessionState } from "@shared/types";
import type { Director, TalkContext, TalkResult } from "./director";
import type { CallUsage, StructuredModelClient } from "./providers/types";
import { wireToDirectorTurn } from "./wire";
import {
  DIRECTOR_RULES,
  REPORT_RULES,
  STATIC_CONTENT_JSON,
  TALK_RULES,
  TALK_STATIC_JSON,
  buildArrivalPrompt,
  buildReportPrompt,
  buildTalkPrompt,
  buildTurnPrompt,
} from "./prompts";

const TURN_MAX_TOKENS = 8000;
const REPORT_MAX_TOKENS = 8000;
const TALK_MAX_TOKENS = 1000;

export class ModelDirector implements Director {
  constructor(
    readonly name: EngineId,
    protected readonly client: StructuredModelClient,
  ) {}

  /** Usage of the most recent successful call (for verification scripts). */
  get lastUsage(): CallUsage | null {
    return this.client.lastUsage;
  }

  async startLife(state: SessionState): Promise<DirectorTurn> {
    const wire = await this.client.callParsed({
      rules: DIRECTOR_RULES,
      staticJson: STATIC_CONTENT_JSON,
      userText: buildArrivalPrompt(state),
      schema: DirectorTurnWireSchema,
      effort: "medium",
      maxTokens: TURN_MAX_TOKENS,
    });
    return wireToDirectorTurn(wire);
  }

  async takeTurn(state: SessionState, chosen: Choice, dueEvents: QueuedEvent[]): Promise<DirectorTurn> {
    // Climax turns get deeper simulation; ordinary turns stay snappy.
    const effort = state.turn + 1 === 7 || state.turn + 1 === 10 ? "high" : "medium";
    const wire = await this.client.callParsed({
      rules: DIRECTOR_RULES,
      staticJson: STATIC_CONTENT_JSON,
      userText: buildTurnPrompt(state, chosen, dueEvents),
      schema: DirectorTurnWireSchema,
      effort,
      maxTokens: TURN_MAX_TOKENS,
    });
    return wireToDirectorTurn(wire);
  }

  async talk(state: SessionState, ctx: TalkContext): Promise<TalkResult> {
    return this.client.callParsed({
      rules: TALK_RULES,
      staticJson: TALK_STATIC_JSON,
      userText: buildTalkPrompt(state, ctx),
      schema: TalkExchangeWireSchema,
      effort: "low",
      maxTokens: TALK_MAX_TOKENS,
    });
  }

  async writeReport(state: SessionState): Promise<LifeReport> {
    return this.client.callParsed({
      rules: REPORT_RULES,
      staticJson: STATIC_CONTENT_JSON,
      userText: buildReportPrompt(state),
      schema: LifeReportSchema,
      effort: "high",
      maxTokens: REPORT_MAX_TOKENS,
    });
  }
}
