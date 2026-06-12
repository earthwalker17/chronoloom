/**
 * OpenAICompatClient against a mocked fetch — the only verification GPT and
 * DeepSeek get in this environment (no live keys). Asserts request shaping
 * (schema mode, token param, system embedding), the parse→repair→fail ladder,
 * and usage mapping.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EngineError } from "../server/engine/director";
import { OpenAICompatClient, toStrictJsonSchema } from "../server/engine/providers/openaiCompatClient";

const Schema = z.object({ titleZh: z.string(), count: z.number() });

interface Captured {
  url: string;
  body: Record<string, unknown>;
}

function mockFetch(replies: string[]): { fetch: (url: never, init?: never) => Promise<Response>; calls: Captured[] } {
  const calls: Captured[] = [];
  let i = 0;
  return {
    calls,
    fetch: async (url: never, init?: never) => {
      const req = init as { body?: string } | undefined;
      calls.push({ url: String(url), body: JSON.parse(req?.body ?? "{}") as Record<string, unknown> });
      const content = replies[Math.min(i, replies.length - 1)];
      i++;
      return new Response(
        JSON.stringify({
          id: "cmpl-test",
          object: "chat.completion",
          choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
          usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 60 } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  };
}

const call = {
  rules: "规则",
  staticJson: '{"world":"长安"}',
  userText: "回合",
  schema: Schema,
  effort: "medium" as const,
  maxTokens: 1000,
};

describe("toStrictJsonSchema", () => {
  it("marks every object node strict with all keys required", () => {
    const nested = z.object({ a: z.string(), inner: z.object({ b: z.number() }) });
    const json = toStrictJsonSchema(nested) as {
      additionalProperties: boolean;
      required: string[];
      properties: { inner: { additionalProperties: boolean; required: string[] } };
    };
    expect(json.additionalProperties).toBe(false);
    expect(json.required).toEqual(["a", "inner"]);
    expect(json.properties.inner.additionalProperties).toBe(false);
    expect(json.properties.inner.required).toEqual(["b"]);
  });
});

describe("OpenAICompatClient", () => {
  it("json_schema mode: strict response_format + max_completion_tokens, parses valid output", async () => {
    const mock = mockFetch([JSON.stringify({ titleZh: "灯市", count: 3 })]);
    const client = new OpenAICompatClient({
      id: "openai",
      apiKey: "test",
      model: "gpt-test",
      schemaMode: "json_schema",
      fetchOverride: mock.fetch as never,
    });
    const out = await client.callParsed(call);
    expect(out).toEqual({ titleZh: "灯市", count: 3 });
    const body = mock.calls[0]?.body as {
      max_completion_tokens: number;
      max_tokens?: number;
      response_format: { type: string; json_schema: { strict: boolean; schema: { additionalProperties: boolean } } };
    };
    expect(body.max_completion_tokens).toBe(1000);
    expect(body.max_tokens).toBeUndefined();
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(client.lastUsage).toEqual({
      inputTokens: 100,
      cacheReadTokens: 60,
      cacheWriteTokens: 0,
      outputTokens: 20,
    });
  });

  it("json_object mode: schema embedded in system, max_tokens used", async () => {
    const mock = mockFetch([JSON.stringify({ titleZh: "夜市", count: 1 })]);
    const client = new OpenAICompatClient({
      id: "deepseek",
      apiKey: "test",
      model: "deepseek-chat",
      baseURL: "https://api.deepseek.com",
      schemaMode: "json_object",
      fetchOverride: mock.fetch as never,
    });
    const out = await client.callParsed(call);
    expect(out.titleZh).toBe("夜市");
    expect(mock.calls[0]?.url).toContain("api.deepseek.com");
    const body = mock.calls[0]?.body as {
      max_tokens: number;
      max_completion_tokens?: number;
      response_format: { type: string };
      messages: { role: string; content: string }[];
    };
    expect(body.max_tokens).toBe(1000);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.response_format.type).toBe("json_object");
    expect(body.messages[0]?.content).toContain("output_schema");
    expect(body.messages[0]?.content).toContain("规则");
  });

  it("repairs once on invalid output: correction note in the retry, then success", async () => {
    const mock = mockFetch([
      JSON.stringify({ titleZh: "缺字段" }), // fails schema (no count)
      JSON.stringify({ titleZh: "补全", count: 7 }),
    ]);
    const client = new OpenAICompatClient({
      id: "openai",
      apiKey: "test",
      model: "gpt-test",
      schemaMode: "json_schema",
      fetchOverride: mock.fetch as never,
    });
    const out = await client.callParsed(call);
    expect(out.count).toBe(7);
    expect(mock.calls).toHaveLength(2);
    const retryMessages = (mock.calls[1]?.body as { messages: { content: string }[] }).messages;
    expect(retryMessages[1]?.content).toContain("correction");
  });

  it("fails with EngineError(parse) after two invalid outputs", async () => {
    const mock = mockFetch(["not json at all"]);
    const client = new OpenAICompatClient({
      id: "openai",
      apiKey: "test",
      model: "gpt-test",
      schemaMode: "json_schema",
      fetchOverride: mock.fetch as never,
    });
    await expect(client.callParsed(call)).rejects.toThrowError(EngineError);
    await expect(
      new OpenAICompatClient({
        id: "openai",
        apiKey: "test",
        model: "gpt-test",
        schemaMode: "json_schema",
        fetchOverride: mockFetch(["{}"]).fetch as never,
      }).callParsed(call),
    ).rejects.toMatchObject({ code: "parse" });
  });
});
