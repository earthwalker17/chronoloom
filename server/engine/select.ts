import type { EngineId } from "@shared/constants";
import type { AppConfig } from "../config";
import type { Director } from "./director";
import { ScriptedDirector } from "./scriptedDirector";

export interface SelectedDirectors {
  /** Every engine sessions may be pinned to. Always contains "scripted". */
  directors: Map<EngineId, Director>;
  /** Engine for new sessions that don't request a provider. */
  defaultEngine: EngineId;
  /** Serves a turn when the primary engine fails (null = fail hard). */
  fallback: Director | null;
}

/**
 * Engine selection: explicit CHRONOLOOM_ENGINE wins; otherwise the best
 * available key (claude > openai > deepseek), scripted as the floor. Every
 * keyed provider goes into the map — players pick per session on the landing
 * page. Model SDK modules are imported lazily so offline play never loads them.
 */
export async function selectDirectors(config: AppConfig): Promise<SelectedDirectors> {
  const scripted = new ScriptedDirector();
  const directors = new Map<EngineId, Director>([["scripted", scripted]]);

  if (config.apiKey) {
    const { ClaudeDirector } = await import("./claudeDirector");
    directors.set("claude", new ClaudeDirector(config));
  }
  if (config.openaiKey || config.deepseekKey) {
    const { ModelDirector } = await import("./modelDirector");
    const { OpenAICompatClient } = await import("./providers/openaiCompatClient");
    if (config.openaiKey) {
      directors.set(
        "openai",
        new ModelDirector(
          "openai",
          new OpenAICompatClient({
            id: "openai",
            apiKey: config.openaiKey,
            model: config.openaiModel,
            schemaMode: "json_schema",
          }),
        ),
      );
    }
    if (config.deepseekKey) {
      directors.set(
        "deepseek",
        new ModelDirector(
          "deepseek",
          new OpenAICompatClient({
            id: "deepseek",
            apiKey: config.deepseekKey,
            model: config.deepseekModel,
            baseURL: "https://api.deepseek.com",
            schemaMode: "json_object",
          }),
        ),
      );
    }
  }

  const defaultEngine: EngineId = directors.has(config.engine) ? config.engine : "scripted";
  return {
    directors,
    defaultEngine,
    fallback: config.fallbackToScripted && defaultEngine !== "scripted" ? scripted : null,
  };
}
