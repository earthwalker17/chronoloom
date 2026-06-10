import { Hono } from "hono";
import type { AppConfig } from "./config";
import type { Director } from "./engine/director";
import { metaRoutes } from "./routes/meta";
import { sessionRoutes, type SessionDeps } from "./routes/sessions";
import { SessionStore } from "./store/sessionStore";

export interface AppDeps {
  config: AppConfig;
  director: Director;
  fallback: Director | null;
  store: SessionStore;
}

/** Pure app factory — the test seam. E2E drives this via app.request(), no port needed. */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const api = new Hono();

  api.route("/", metaRoutes(deps.config));
  api.route("/", sessionRoutes(deps satisfies SessionDeps));

  app.route("/api", api);
  return app;
}
