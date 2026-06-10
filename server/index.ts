// .env wins over inherited shell vars — for a local game, "edit .env and it
// just works" beats env-precedence convention.
import dotenv from "dotenv";
dotenv.config({ override: true });
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { selectDirectors } from "./engine/select";
import { SessionStore } from "./store/sessionStore";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const config = loadConfig();
  const { director, fallback } = await selectDirectors(config);
  const store = new SessionStore(path.join(root, "data", "sessions"));
  const app = createApp({ config, director, fallback, store });

  // Production: serve the built client same-origin if it exists.
  const dist = path.join(root, "dist", "client");
  if (existsSync(dist)) {
    const rel = path.relative(process.cwd(), dist).replaceAll("\\", "/");
    app.use("/*", serveStatic({ root: rel }));
    app.get("*", serveStatic({ path: path.join(rel, "index.html") }));
  }

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`[chronoloom] engine=${config.engine}${config.engine === "claude" ? ` model=${config.model}` : ""} fallback=${fallback ? "scripted" : "none"}`);
    console.log(`[chronoloom] api on http://localhost:${info.port}${existsSync(dist) ? " (serving dist/client)" : ""}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
