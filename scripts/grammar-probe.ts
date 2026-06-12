/**
 * Diagnostic: which wire-schema variants fit the structured-outputs grammar
 * ceiling TODAY. The 400 fires at request validation, so failures are free
 * and successes are tiny (max_tokens kept minimal is not possible with
 * thinking, so we use plain calls and accept one short completion per pass).
 */
import dotenv from "dotenv";
dotenv.config({ override: true });
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";
import { DirectorTurnWireSchema } from "@shared/schemas";
import { loadConfig } from "../server/config";

const config = loadConfig();
const hasProxy = Boolean(process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? process.env.ALL_PROXY);
const dispatcher = hasProxy ? new EnvHttpProxyAgent() : undefined;
const client = new Anthropic({
  apiKey: config.apiKey,
  timeout: 120_000,
  ...(dispatcher
    ? {
        fetch: ((url: never, init: never) =>
          undiciFetch(url, { ...(init as object), dispatcher })) as never,
      }
    : {}),
});

async function probe(name: string, schema: z.ZodType): Promise<boolean> {
  try {
    await client.messages.parse({
      model: config.model,
      max_tokens: 1500,
      output_config: { format: zodOutputFormat(schema) },
      messages: [{ role: "user", content: "回复最小合法 JSON，全部字段用最短值。" }],
    });
    console.log(`  PASS  ${name}`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("grammar is too large")) {
      console.log(`  FAIL  ${name} (grammar too large)`);
      return false;
    }
    console.log(`  ????  ${name}: ${msg.slice(0, 120)}`);
    return false;
  }
}

// The original (2026-06-11, verified-live) wire schema, reconstructed.
const enumish = {
  locationId: z.enum(["market_cross", "silk_row", "wine_house", "persian_lodge", "bookshop", "temple_hall", "market_office", "gate_lane"]),
  timeOfDay: z.enum(["morning", "noon", "dusk", "night"]),
  weather: z.enum(["clear", "overcast", "snow", "windy"]),
  mood: z.enum(["festive", "calm", "tense", "ominous", "melancholy"]),
  crowd: z.enum(["sparse", "busy", "packed"]),
  lanterns: z.enum(["none", "dim", "bright", "festival"]),
};
const TENSIONS = z.object({
  official_scrutiny: z.number(),
  guild_dispute: z.number(),
  festival_fervor: z.number(),
  street_danger: z.number(),
});
const ORIGINAL = z.object({
  sceneTitleZh: z.string(),
  consequenceRecapZh: z.string(),
  proseZh: z.string(),
  directive: z.object({ ...enumish, focusNpcIds: z.array(z.string()) }),
  choices: z.array(
    z.object({
      labelZh: z.string(),
      hintZh: z.string(),
      actionTag: z.enum(["seek_patronage", "protect_someone", "conceal_info", "reveal_info", "take_risk", "preserve_reputation", "pursue_money", "pursue_status", "pursue_art", "observe_wait"]),
      risk: z.enum(["low", "medium", "high"]),
    }),
  ),
  update: z.object({
    moneyDelta: z.number(),
    healthDelta: z.number(),
    reputationDelta: z.number(),
    skillUps: z.array(z.string()),
    statusAdd: z.array(z.string()),
    statusRemove: z.array(z.string()),
    moveTo: z.string(),
    timeAdvance: z.number(),
    publicMoodZh: z.string(),
    tensionDeltas: TENSIONS,
    rumorAddZh: z.string(),
    npcUpdates: z.array(
      z.object({
        npcId: z.enum(["shen_yanqiu", "cui_jiu", "lvyao", "pei_heng", "he_shisan"]),
        trustDelta: z.number(),
        fearDelta: z.number(),
        respectDelta: z.number(),
        agendaZh: z.string(),
        memoryZh: z.string(),
      }),
    ),
  }),
  timelineEvents: z.array(
    z.object({ kind: z.string(), titleZh: z.string(), descZh: z.string(), importance: z.number(), npcIds: z.array(z.string()) }),
  ),
  causalEntries: z.array(
    z.object({ cause: z.string(), textZh: z.string(), effectsZh: z.array(z.string()), openedZh: z.array(z.string()), closedZh: z.array(z.string()) }),
  ),
  isEnding: z.boolean(),
  endingReasonZh: z.string(),
});

async function main() {
  if (!config.apiKey) {
    console.log("SKIP: no key");
    return;
  }
  console.log(`probing against ${config.model}`);
  await probe("original wire schema (verified 06-11)", ORIGINAL);
  await probe("current wire schema", DirectorTurnWireSchema);

  const base = ORIGINAL.shape;
  await probe(
    "original + npcLines(string[])",
    z.object({ ...base, npcLines: z.array(z.string()) }),
  );
  await probe(
    "original + choices.extra(string)",
    z.object({
      ...base,
      choices: z.array(
        z.object({
          labelZh: z.string(),
          hintZh: z.string(),
          actionTag: z.string(),
          risk: z.string(),
          extra: z.string(),
        }),
      ),
    }),
  );
  await probe(
    "original + BOTH (relaxed-enum choices)",
    z.object({
      ...base,
      npcLines: z.array(z.string()),
      choices: z.array(
        z.object({
          labelZh: z.string(),
          hintZh: z.string(),
          actionTag: z.string(),
          risk: z.string(),
          extra: z.string(),
        }),
      ),
    }),
  );

  // Reclaim grammar: pack causal string-arrays + timeline npcIds into strings.
  await probe(
    "BOTH + compact causal/timeline",
    z.object({
      ...base,
      npcLines: z.array(z.string()),
      choices: z.array(
        z.object({
          labelZh: z.string(),
          hintZh: z.string(),
          actionTag: z.string(),
          risk: z.string(),
          extra: z.string(),
        }),
      ),
      timelineEvents: z.array(
        z.object({
          kind: z.string(),
          titleZh: z.string(),
          descZh: z.string(),
          importance: z.number(),
          npcIds: z.string(),
        }),
      ),
      causalEntries: z.array(
        z.object({
          cause: z.string(),
          textZh: z.string(),
          effectsZh: z.string(),
          openedZh: z.string(),
          closedZh: z.string(),
        }),
      ),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
