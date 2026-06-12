/**
 * One real GPT (or DeepSeek) life-start through the OpenAI-compatible client —
 * verifies json_schema strict mode + the wire sanitizer against a live
 * non-Anthropic provider. SKIPs cleanly without a key.
 *
 * Run: npx tsx scripts/live-openai.ts [deepseek]
 */
import dotenv from "dotenv";
dotenv.config({ override: true });
import { loadConfig } from "../server/config";
import { ModelDirector } from "../server/engine/modelDirector";
import { OpenAICompatClient } from "../server/engine/providers/openaiCompatClient";
import { clampDirectorTurn } from "../server/sim/clamp";
import { newSession } from "../server/sim/newSession";

const CJK = /[一-鿿]/;

async function main() {
  const which = process.argv[2] === "deepseek" ? "deepseek" : "openai";
  const config = loadConfig();
  const key = which === "openai" ? config.openaiKey : config.deepseekKey;
  const model = which === "openai" ? config.openaiModel : config.deepseekModel;
  if (!key) {
    console.log(`SKIP: no ${which} key — live test not run.`);
    return;
  }
  console.log(`live ${which} test against ${model}`);
  const director = new ModelDirector(
    which,
    new OpenAICompatClient({
      id: which,
      apiKey: key,
      model,
      ...(which === "deepseek"
        ? { baseURL: "https://api.deepseek.com", schemaMode: "json_object" as const }
        : { schemaMode: "json_schema" as const }),
    }),
  );

  const state = newSession("scholar", which);
  const arrival = await director.startLife(state);
  const checks: [boolean, string][] = [
    [CJK.test(arrival.proseZh), "prose is Chinese"],
    [arrival.proseZh.length >= 80, `prose has substance (${arrival.proseZh.length} chars)`],
    [arrival.choices.length >= 3 && arrival.choices.length <= 4, `${arrival.choices.length} choices`],
    [arrival.choices.every((c) => c.moneyCost >= 0 && c.staminaCost >= 0), "costs sane"],
    [arrival.timelineEvents.length >= 1, "timeline event logged"],
  ];
  let failed = false;
  for (const [cond, label] of checks) {
    console.log(`  ${cond ? "✓" : "✗"} ${label}`);
    if (!cond) failed = true;
  }
  const { log } = clampDirectorTurn(arrival, state, true);
  console.log(log.length ? `  (clamp notes: ${log.join(" | ")})` : "  (no clamp corrections)");
  console.log(`  scene:「${arrival.sceneTitleZh}」 ${arrival.proseZh.slice(0, 60)}…`);
  if (failed) process.exit(1);
  console.log(`\nLIVE ${which} smoke passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
