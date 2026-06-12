import { z } from "zod";
import type { EngineId } from "@shared/constants";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  CHRONOLOOM_MODEL: z.string().default("claude-opus-4-8"),
  /** Placeholder default — override per deployment; not live-verified here. */
  CHRONOLOOM_OPENAI_MODEL: z.string().default("gpt-5.1"),
  CHRONOLOOM_DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  CHRONOLOOM_ENGINE: z.enum(["claude", "openai", "deepseek", "scripted"]).or(z.literal("")).default(""),
  CHRONOLOOM_FALLBACK: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false"),
  PORT: z.coerce.number().default(8787),
});

export interface AppConfig {
  apiKey: string | undefined;
  openaiKey: string | undefined;
  deepseekKey: string | undefined;
  model: string;
  openaiModel: string;
  deepseekModel: string;
  /** Resolved default engine after auto-selection. */
  engine: EngineId;
  fallbackToScripted: boolean;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const apiKey = parsed.ANTHROPIC_API_KEY?.trim() || undefined;
  const openaiKey = parsed.OPENAI_API_KEY?.trim() || undefined;
  const deepseekKey = parsed.DEEPSEEK_API_KEY?.trim() || undefined;
  // Explicit choice wins; otherwise best available key, scripted as the floor.
  const engine: EngineId =
    parsed.CHRONOLOOM_ENGINE !== ""
      ? parsed.CHRONOLOOM_ENGINE
      : apiKey
        ? "claude"
        : openaiKey
          ? "openai"
          : deepseekKey
            ? "deepseek"
            : "scripted";
  return {
    apiKey,
    openaiKey,
    deepseekKey,
    model: parsed.CHRONOLOOM_MODEL,
    openaiModel: parsed.CHRONOLOOM_OPENAI_MODEL,
    deepseekModel: parsed.CHRONOLOOM_DEEPSEEK_MODEL,
    engine,
    fallbackToScripted: parsed.CHRONOLOOM_FALLBACK,
    port: parsed.PORT,
  };
}
