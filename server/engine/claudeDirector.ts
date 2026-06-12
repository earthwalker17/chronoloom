/**
 * Live Claude engine = ModelDirector prompt/wire logic + AnthropicClient
 * (structured outputs, cached byte-stable prefix, adaptive thinking, proxy
 * support). Kept as a named class so scripts and logs keep their identity;
 * `lastUsage` is surfaced for the live verification script.
 */
import type { AppConfig } from "../config";
import { ModelDirector } from "./modelDirector";
import { AnthropicClient } from "./providers/anthropicClient";

export type { CallUsage } from "./providers/types";

export class ClaudeDirector extends ModelDirector {
  constructor(config: AppConfig) {
    super("claude", new AnthropicClient({ apiKey: config.apiKey, model: config.model }));
  }
}
