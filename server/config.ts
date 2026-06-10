import { z } from "zod";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  CHRONOLOOM_MODEL: z.string().default("claude-opus-4-8"),
  CHRONOLOOM_ENGINE: z.enum(["claude", "scripted"]).or(z.literal("")).default(""),
  CHRONOLOOM_FALLBACK: z
    .string()
    .default("true")
    .transform((v) => v.toLowerCase() !== "false"),
  PORT: z.coerce.number().default(8787),
});

export interface AppConfig {
  apiKey: string | undefined;
  model: string;
  /** Resolved engine after auto-selection. */
  engine: "claude" | "scripted";
  fallbackToScripted: boolean;
  port: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const apiKey = parsed.ANTHROPIC_API_KEY?.trim() || undefined;
  const engine =
    parsed.CHRONOLOOM_ENGINE !== ""
      ? parsed.CHRONOLOOM_ENGINE
      : apiKey
        ? "claude"
        : "scripted";
  return {
    apiKey,
    model: parsed.CHRONOLOOM_MODEL,
    engine,
    fallbackToScripted: parsed.CHRONOLOOM_FALLBACK,
    port: parsed.PORT,
  };
}
