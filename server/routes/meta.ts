import { Hono } from "hono";
import { ENGINE_IDS, IDENTITY_IDS, SKILL_NAMES_ZH, type EngineId, type SkillId } from "@shared/constants";
import type { Director } from "../engine/director";
import type { AppConfig } from "../config";
import type { HealthResponse, MetaResponse } from "@shared/types";
import { ERA_BIBLE } from "../content/eraBible";
import { IDENTITIES } from "../content/identities";

export interface MetaDeps {
  config: AppConfig;
  directors: Map<EngineId, Director>;
  defaultEngine: EngineId;
}

const PROVIDER_LABELS_ZH: Record<EngineId, string> = {
  claude: "Claude",
  openai: "GPT",
  deepseek: "DeepSeek",
  scripted: "离线推演",
};

export function metaRoutes(deps: MetaDeps): Hono {
  const { config, directors, defaultEngine } = deps;
  const app = new Hono();

  const modelFor = (id: EngineId): string | null => {
    if (!directors.has(id)) return null;
    if (id === "claude") return config.model;
    return null; // scripted has no model; openai/deepseek filled in by the provider layer
  };

  app.get("/health", (c) => {
    const health: HealthResponse = {
      ok: true,
      engine: defaultEngine,
      model: modelFor(defaultEngine),
      providers: ENGINE_IDS.map((id) => ({
        id,
        labelZh: PROVIDER_LABELS_ZH[id],
        available: directors.has(id),
        model: modelFor(id),
      })),
    };
    return c.json(health);
  });

  app.get("/meta", (c) => {
    const meta: MetaResponse = {
      era: {
        titleZh: ERA_BIBLE.titleZh,
        subtitleZh: `${ERA_BIBLE.periodZh} · ${ERA_BIBLE.subtitleZh}`,
        introZh: ERA_BIBLE.introZh,
        rumorsZh: ERA_BIBLE.seedRumorsZh,
      },
      identities: IDENTITY_IDS.map((id) => {
        const def = IDENTITIES[id];
        const skills = Object.entries(def.start.skills)
          .filter(([, v]) => (v ?? 0) >= 2)
          .map(([k]) => SKILL_NAMES_ZH[k as SkillId]);
        return {
          id,
          nameZh: def.nameZh,
          glyphZh: def.glyphZh,
          cardLineZh: def.cardLineZh,
          statHintsZh: [`身怀${skills.join("、")}`, `盘缠 ${def.start.money} 文`],
        };
      }),
    };
    return c.json(meta);
  });

  return app;
}
