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
 * Engine selection: explicit CHRONOLOOM_ENGINE wins; otherwise claude when a
 * key is present, scripted when not. Model SDK modules are imported lazily so
 * offline play never touches them.
 */
export async function selectDirectors(config: AppConfig): Promise<SelectedDirectors> {
  const scripted = new ScriptedDirector();
  const directors = new Map<EngineId, Director>([["scripted", scripted]]);

  if (config.apiKey) {
    const { ClaudeDirector } = await import("./claudeDirector");
    directors.set("claude", new ClaudeDirector(config));
  }

  const defaultEngine: EngineId = directors.has(config.engine) ? config.engine : "scripted";
  return {
    directors,
    defaultEngine,
    fallback: config.fallbackToScripted && defaultEngine !== "scripted" ? scripted : null,
  };
}
