import { Hono } from "hono";
import type { EngineId } from "@shared/constants";
import type { AppConfig } from "./config";
import type { Director } from "./engine/director";
import { metaRoutes } from "./routes/meta";
import { sessionRoutes, type SessionDeps } from "./routes/sessions";
import { SessionStore } from "./store/sessionStore";

export interface AppDeps {
  config: AppConfig;
  /** Engines sessions can be pinned to; always contains "scripted". */
  directors: Map<EngineId, Director>;
  /** Engine for new sessions that don't request a provider. */
  defaultEngine: EngineId;
  /** Serves a turn when the primary engine fails (null = fail hard). */
  fallback: Director | null;
  store: SessionStore;
}

/** Pure app factory — the test seam. E2E drives this via app.request(), no port needed. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const api = new Hono();

  api.route("/", metaRoutes(deps));
  api.route("/", sessionRoutes(deps satisfies SessionDeps));

  app.route("/api", api);
  return app;
}
