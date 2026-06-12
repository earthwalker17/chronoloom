/**
 * StructuredModelClient — the seam between "which LLM vendor" and the
 * Director's prompt/wire logic. One structured, schema-validated call;
 * provider-appropriate retry/repair lives inside the client.
 */
import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";
import type { z } from "zod";

export interface StructuredCall<S extends z.ZodType> {
  /** Stable system rules (cache-friendly: byte-identical across calls). */
  rules: string;
  /** Stable world block (cached where the provider supports it). */
  staticJson: string;
  /** Volatile turn text. */
  userText: string;
  schema: S;
  effort: "low" | "medium" | "high";
  maxTokens: number;
}

export interface CallUsage {
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

export interface StructuredModelClient {
  readonly id: "claude" | "openai" | "deepseek";
  /** Usage of the most recent successful call (for verification scripts). */
  lastUsage: CallUsage | null;
  /** Throws EngineError("api" | "parse" | "refusal") on failure. */
  callParsed<S extends z.ZodType>(call: StructuredCall<S>): Promise<z.infer<S>>;
}

/**
 * Node's fetch ignores HTTP(S)_PROXY env vars. Both SDK clients route through
 * undici's EnvHttpProxyAgent + undici fetch when a proxy is configured (mixing
 * npm-undici dispatchers into Node's built-in fetch fails across versions).
 */
export function proxyAwareFetch():
  | ((url: string | URL | Request, init?: RequestInit) => Promise<Response>)
  | undefined {
  const hasProxy = Boolean(
    process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.ALL_PROXY,
  );
  if (!hasProxy) return undefined;
  const dispatcher = new EnvHttpProxyAgent();
  return (url, init) =>
    undiciFetch(url as Parameters<typeof undiciFetch>[0], {
      ...(init as object),
      dispatcher,
    }) as unknown as Promise<Response>;
}
