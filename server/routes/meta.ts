import { Hono } from "hono";
import { IDENTITY_IDS, SKILL_NAMES_ZH, type SkillId } from "@shared/constants";
import type { MetaResponse } from "@shared/types";
import { ERA_BIBLE } from "../content/eraBible";
import { IDENTITIES } from "../content/identities";
import type { AppConfig } from "../config";

export function metaRoutes(config: AppConfig): Hono {
  const app = new Hono();

  app.get("/health", (c) =>
    c.json({ ok: true, engine: config.engine, model: config.engine === "claude" ? config.model : null }),
  );

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
