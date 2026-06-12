/**
 * OpenAI-compatible structured client for GPT and DeepSeek (chat-completions
 * surface; DeepSeek via baseURL https://api.deepseek.com).
 *
 * - schemaMode "json_schema" (GPT): response_format json_schema strict:true,
 *   schema derived from zod via z.toJSONSchema + a strict-mode normalizer.
 * - schemaMode "json_object" (DeepSeek): response_format json_object with the
 *   JSON schema embedded in the system text.
 * Both: manual JSON.parse + zod safeParse, ONE repair retry carrying a terse
 * error summary, then EngineError("parse"). Same proxy handling as Anthropic.
 *
 * NOTE: built against documented API surfaces and mock-tested; not yet
 * verified against live GPT/DeepSeek endpoints (no keys in this environment).
 */
import OpenAI from "openai";
import { z } from "zod";
import { EngineError } from "../director";
import { proxyAwareFetch, type CallUsage, type StructuredCall, type StructuredModelClient } from "./types";

export interface OpenAICompatOptions {
  id: "openai" | "deepseek";
  apiKey: string | undefined;
  model: string;
  baseURL?: string;
  schemaMode: "json_schema" | "json_object";
  /** Test seam: bypasses the SDK entirely when provided. */
  fetchOverride?: (url: string | URL | Request, init?: RequestInit) => Promise<Response>;
}

/**
 * OpenAI strict mode requires every object node to carry
 * additionalProperties:false and list every property as required.
 * Our schemas are fixed-key all-required by convention; this normalizer
 * makes that explicit in the emitted JSON schema.
 */
export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (obj.type === "object" && typeof obj.properties === "object" && obj.properties !== null) {
      obj.additionalProperties = false;
      obj.required = Object.keys(obj.properties as Record<string, unknown>);
    }
    for (const v of Object.values(obj)) walk(v);
  };
  walk(json);
  delete json.$schema;
  return json;
}

export class OpenAICompatClient implements StructuredModelClient {
  readonly id: "openai" | "deepseek";
  lastUsage: CallUsage | null = null;
  private client: OpenAI;
  private readonly model: string;
  private readonly schemaMode: "json_schema" | "json_object";

  constructor(opts: OpenAICompatOptions) {
    this.id = opts.id;
    this.model = opts.model;
    this.schemaMode = opts.schemaMode;
    const fetchOverride = opts.fetchOverride ?? proxyAwareFetch();
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      timeout: 120_000,
      ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
      ...(fetchOverride ? { fetch: fetchOverride as never } : {}),
    });
  }

  async callParsed<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S>> {
    const jsonSchema = toStrictJsonSchema(call.schema);

    let system = `${call.rules}\n\n${call.staticJson}`;
    if (this.schemaMode === "json_object") {
      // No grammar enforcement on this surface — the schema rides in the prompt.
      system += `\n\n<output_schema>你必须输出且只输出一个符合此 JSON Schema 的 JSON 对象：\n${JSON.stringify(jsonSchema)}\n</output_schema>`;
    }

    const responseFormat =
      this.schemaMode === "json_schema"
        ? ({
            type: "json_schema",
            json_schema: { name: "output", strict: true, schema: jsonSchema },
          } as const)
        : ({ type: "json_object" } as const);

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const userText =
        attempt === 0
          ? call.userText
          : `${call.userText}\n<correction>上一次输出未通过校验（${lastError}）。请严格按照 schema 重新输出完整 JSON。</correction>`;

      const response = await this.client.chat.completions
        .create({
          model: this.model,
          // Newer OpenAI models reject max_tokens; DeepSeek's surface still uses it.
          // reasoning_effort exists only on the OpenAI reasoning surface.
          ...(this.schemaMode === "json_schema"
            ? { max_completion_tokens: call.maxTokens, reasoning_effort: call.effort }
            : { max_tokens: call.maxTokens }),
          response_format: responseFormat,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userText },
          ],
        })
        .catch((e: unknown) => {
          throw new EngineError("api", e instanceof Error ? e.message : String(e));
        });

      const choice = response.choices[0];
      if (choice?.finish_reason === "content_filter") {
        throw new EngineError("refusal", "model refused (content_filter)");
      }
      const content = choice?.message?.content;
      if (!content) {
        lastError = "空响应";
        continue;
      }
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        lastError = "JSON 解析失败";
        continue;
      }
      const result = call.schema.safeParse(parsedJson);
      if (result.success) {
        const usage = response.usage;
        this.lastUsage = {
          inputTokens: usage?.prompt_tokens ?? 0,
          cacheReadTokens: usage?.prompt_tokens_details?.cached_tokens ?? 0,
          cacheWriteTokens: 0,
          outputTokens: usage?.completion_tokens ?? 0,
        };
        console.log(
          `[${this.id}] ok effort=${call.effort} in=${usage?.prompt_tokens ?? 0} cached=${usage?.prompt_tokens_details?.cached_tokens ?? 0} out=${usage?.completion_tokens ?? 0}`,
        );
        return result.data as z.infer<S>;
      }
      lastError = result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    }
    throw new EngineError("parse", `structured output failed after retry: ${lastError}`);
  }
}
