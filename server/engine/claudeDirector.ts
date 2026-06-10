/**
 * Live engine: one combined Claude call per turn (state deltas + scene +
 * choices in a single structured output), a second schema for the report.
 *
 * Opus 4.8 surface: adaptive thinking only, no sampling params, no prefills;
 * structured outputs via output_config.format (zodOutputFormat).
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";
import type { z } from "zod";
import { DirectorTurnWireSchema, LifeReportSchema } from "@shared/schemas";
import type { Choice, DirectorTurn, LifeReport, QueuedEvent, SessionState } from "@shared/types";
import type { AppConfig } from "../config";
import { EngineError, type Director } from "./director";
import { wireToDirectorTurn } from "./wire";
import {
  DIRECTOR_RULES,
  REPORT_RULES,
  STATIC_CONTENT_JSON,
  buildArrivalPrompt,
  buildReportPrompt,
  buildTurnPrompt,
} from "./prompts";

const TURN_MAX_TOKENS = 8000;
const REPORT_MAX_TOKENS = 8000;

export interface CallUsage {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

export class ClaudeDirector implements Director {
  readonly name = "claude" as const;
  /** Usage of the most recent successful call (for verification scripts). */
  lastUsage: CallUsage | null = null;
  private client: Anthropic;

  constructor(private readonly config: AppConfig) {
    // Node's fetch ignores HTTP(S)_PROXY env vars; honor them explicitly so
    // the SDK works behind local proxies (common where direct API access is
    // region-blocked and only proxied requests succeed). Uses undici's own
    // fetch + dispatcher pair — mixing npm-undici dispatchers into Node's
    // built-in fetch fails across versions.
    const hasProxy = Boolean(
      process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.ALL_PROXY,
    );
    let fetchOverride: ((url: string | URL | Request, init?: RequestInit) => Promise<Response>) | undefined;
    if (hasProxy) {
      const dispatcher = new EnvHttpProxyAgent();
      fetchOverride = (url, init) =>
        undiciFetch(url as Parameters<typeof undiciFetch>[0], {
          ...(init as object),
          dispatcher,
        }) as unknown as Promise<Response>;
    }
    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: 120_000,
      ...(fetchOverride ? { fetch: fetchOverride } : {}),
    });
  }

  /**
   * One structured call with a single app-level retry carrying a terse
   * correction note (SDK already retries transport-level 429/5xx itself).
   */
  private async callParsed<S extends z.ZodType>(opts: {
    rules: string;
    userText: string;
    schema: S;
    effort: "low" | "medium" | "high";
    maxTokens: number;
  }): Promise<z.infer<S>> {
    const request = (correction?: string) =>
      this.client.messages.parse({
        model: this.config.model,
        max_tokens: opts.maxTokens,
        thinking: { type: "adaptive" },
        output_config: {
          effort: opts.effort,
          format: zodOutputFormat(opts.schema),
        },
        // Stable prefix first (rules + world bible, cached); volatile turn after.
        system: [
          { type: "text", text: opts.rules },
          { type: "text", text: STATIC_CONTENT_JSON, cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: correction ? `${opts.userText}\n<correction>${correction}</correction>` : opts.userText,
          },
        ],
      });

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(
        attempt === 0 ? undefined : `上一次输出未通过校验（${lastError}）。请严格按照 schema 重新输出完整 JSON。`,
      ).catch((e: unknown) => {
        throw new EngineError("api", e instanceof Error ? e.message : String(e));
      });

      if (response.stop_reason === "refusal") {
        throw new EngineError("refusal", "model refused");
      }
      if (response.stop_reason === "max_tokens") {
        lastError = "输出超长被截断，请收紧篇幅";
        continue;
      }
      const parsed = response.parsed_output;
      if (parsed != null) {
        const usage = response.usage;
        this.lastUsage = {
          inputTokens: usage.input_tokens,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
          outputTokens: usage.output_tokens,
        };
        console.log(
          `[claude] ok effort=${opts.effort} in=${usage.input_tokens} cached=${usage.cache_read_input_tokens ?? 0} out=${usage.output_tokens}`,
        );
        return parsed;
      }
      lastError = "JSON 结构不完整或不合 schema";
    }
    throw new EngineError("parse", `structured output failed after retry: ${lastError}`);
  }

  async startLife(state: SessionState): Promise<DirectorTurn> {
    const wire = await this.callParsed({
      rules: DIRECTOR_RULES,
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
    const wire = await this.callParsed({
      rules: DIRECTOR_RULES,
      userText: buildTurnPrompt(state, chosen, dueEvents),
      schema: DirectorTurnWireSchema,
      effort,
      maxTokens: TURN_MAX_TOKENS,
    });
    return wireToDirectorTurn(wire);
  }

  async writeReport(state: SessionState): Promise<LifeReport> {
    return this.callParsed({
      rules: REPORT_RULES,
      userText: buildReportPrompt(state),
      schema: LifeReportSchema,
      effort: "high",
      maxTokens: REPORT_MAX_TOKENS,
    });
  }
}
