/**
 * Anthropic structured-output client — the verified live path, extracted
 * verbatim from the original ClaudeDirector. Byte-identical request shape:
 * system = [rules, staticJson(cache_control: ephemeral)], adaptive thinking,
 * effort via output_config, one app-level retry with a zh correction note.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { EngineError } from "../director";
import { proxyAwareFetch, type CallUsage, type StructuredCall, type StructuredModelClient } from "./types";

export class AnthropicClient implements StructuredModelClient {
  readonly id = "claude" as const;
  lastUsage: CallUsage | null = null;
  private client: Anthropic;

  constructor(opts: { apiKey: string | undefined; model: string }) {
    this.model = opts.model;
    const fetchOverride = proxyAwareFetch();
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      timeout: 120_000,
      ...(fetchOverride ? { fetch: fetchOverride } : {}),
    });
  }

  private readonly model: string;

  async callParsed<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S>> {
    const request = (correction?: string) =>
      this.client.messages.parse({
        model: this.model,
        max_tokens: call.maxTokens,
        thinking: { type: "adaptive" },
        output_config: {
          effort: call.effort,
          format: zodOutputFormat(call.schema),
        },
        // Stable prefix first (rules + world bible, cached); volatile turn after.
        system: [
          { type: "text", text: call.rules },
          { type: "text", text: call.staticJson, cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: correction ? `${call.userText}\n<correction>${correction}</correction>` : call.userText,
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
          `[claude] ok effort=${call.effort} in=${usage.input_tokens} cached=${usage.cache_read_input_tokens ?? 0} out=${usage.output_tokens}`,
        );
        return parsed;
      }
      lastError = "JSON 结构不完整或不合 schema";
    }
    throw new EngineError("parse", `structured output failed after retry: ${lastError}`);
  }
}
