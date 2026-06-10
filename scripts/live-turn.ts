/**
 * One real Claude life-start + one turn (≈3 calls including any retry).
 * Verifies: structured output parses, Chinese prose, 3-4 choices, timeline
 * events, and prompt-cache reads on the second call.
 *
 * Exits 0 with SKIP when no ANTHROPIC_API_KEY is available.
 */
import dotenv from "dotenv";
dotenv.config({ override: true });
import { loadConfig } from "../server/config";
import { ClaudeDirector } from "../server/engine/claudeDirector";
import { applyDirectorTurn } from "../server/sim/applyTurn";
import { clampDirectorTurn } from "../server/sim/clamp";
import { newSession } from "../server/sim/newSession";

let passed = 0;
function ok(cond: boolean, label: string): void {
  if (!cond) {
    console.error(`  ✗ ${label}`);
    process.exit(1);
  }
  passed++;
  console.log(`  ✓ ${label}`);
}

const CJK = /[一-鿿]/;

async function main() {
  const config = loadConfig();
  if (!config.apiKey) {
    console.log("SKIP: no ANTHROPIC_API_KEY — live test not run.");
    return;
  }
  console.log(`live test against ${config.model}`);
  const director = new ClaudeDirector(config);

  // --- call 1: arrival ---
  let state = newSession("scholar", "claude");
  const arrival = await director.startLife(state);
  ok(CJK.test(arrival.proseZh), "arrival prose is Chinese");
  ok(arrival.proseZh.length >= 80, `arrival prose has substance (${arrival.proseZh.length} chars)`);
  ok(arrival.choices.length >= 3 && arrival.choices.length <= 4, `arrival has ${arrival.choices.length} choices`);
  ok(new Set(arrival.choices.map((c) => c.actionTag)).size >= 3, "choices span ≥3 action tags");
  ok(arrival.timelineEvents.length >= 1, "arrival logs a timeline event");
  const firstUsage = director.lastUsage;
  ok(firstUsage !== null, "usage captured");

  const a = clampDirectorTurn(arrival, state, true);
  console.log(a.log.length ? `  (clamp notes: ${a.log.join(" | ")})` : "  (no clamp corrections)");
  state = applyDirectorTurn(state, a.turn, null, "claude", a.log);

  // --- call 2: one turn (same cached prefix) ---
  const choice = state.scene.choices[0];
  if (!choice) throw new Error("no choices from arrival");
  console.log(`  acting: ${choice.labelZh} [${choice.actionTag}]`);
  const dueEvents = state.eventQueue.filter((ev) => ev.status === "pending" && ev.dueTurn <= state.turn + 1);
  const turn = await director.takeTurn(state, choice, dueEvents);
  ok(CJK.test(turn.proseZh), "turn prose is Chinese");
  ok(turn.consequenceRecapZh.length > 0, "turn shows a visible consequence recap");
  ok(turn.choices.length >= 3 && turn.choices.length <= 4, `turn offers ${turn.choices.length} choices`);
  ok(turn.causalEntries.length >= 1, "turn writes the causal ledger");
  const secondUsage = director.lastUsage;
  ok(
    secondUsage !== null && secondUsage.cacheReadTokens > 0,
    `second call read the prompt cache (${secondUsage?.cacheReadTokens} tokens)`,
  );

  const t = clampDirectorTurn(turn, state, false);
  console.log(t.log.length ? `  (clamp notes: ${t.log.join(" | ")})` : "  (no clamp corrections)");
  state = applyDirectorTurn(state, t.turn, choice, "claude", t.log);
  ok(state.turn === 1, "state advanced to turn 1");
  ok(state.timeline.length >= 2, "timeline grew");

  console.log(`\nscene preview:\n  「${t.turn.sceneTitleZh}」 ${t.turn.proseZh.slice(0, 80)}…`);
  console.log(`\nLIVE test passed (${passed} assertions).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
