import type { AppConfig } from "../config";
import type { Director } from "./director";
import { ScriptedDirector } from "./scriptedDirector";

/**
 * Engine selection: explicit CHRONOLOOM_ENGINE wins; otherwise claude when a
 * key is present, scripted when not. The Claude module is imported lazily so
 * offline play never touches the SDK.
 */
export async function selectDirectors(
  config: AppConfig,
): Promise<{ director: Director; fallback: Director | null }> {
  const scripted = new ScriptedDirector();
  if (config.engine === "claude") {
    const { ClaudeDirector } = await import("./claudeDirector");
    return {
      director: new ClaudeDirector(config),
      fallback: config.fallbackToScripted ? scripted : null,
    };
  }
  return { director: scripted, fallback: null };
}
