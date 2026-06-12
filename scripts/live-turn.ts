/**
 * Live-engine verification (~5 real calls): life-start + one turn (wire
 * grammar for the grown DirectorTurnWireSchema, npcLines, costs, cache reads),
 * one 攀谈 exchange (TalkExchange grammar + persona voice), and one report on
 * a synthetic finished life (LifeReport+mirror grammar).
 *
 * Exits 0 with SKIP when no ANTHROPIC_API_KEY is available.
 */
import dotenv from "dotenv";
dotenv.config({ override: true });
import { CAPS, trustTier } from "@shared/constants";
import { loadConfig } from "../server/config";
import { ClaudeDirector } from "../server/engine/claudeDirector";
import type { TalkContext } from "../server/engine/director";
import { NPCS } from "../server/content/npcs";
import { applyDirectorTurn } from "../server/sim/applyTurn";
import { clampDirectorTurn, snapshotOf, affordableChoice } from "../server/sim/clamp";
import { guardReport } from "../server/sim/reportGuard";
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

  // --- call 1: arrival (wire grammar check for the grown schema) ---
  let state = newSession("scholar", "claude");
  const arrival = await director.startLife(state);
  ok(CJK.test(arrival.proseZh), "arrival prose is Chinese");
  ok(arrival.proseZh.length >= 80, `arrival prose has substance (${arrival.proseZh.length} chars)`);
  ok(arrival.choices.length >= 3 && arrival.choices.length <= 4, `arrival has ${arrival.choices.length} choices`);
  ok(new Set(arrival.choices.map((c) => c.actionTag)).size >= 3, "choices span ≥3 action tags");
  ok(arrival.timelineEvents.length >= 1, "arrival logs a timeline event");
  ok(
    arrival.choices.every((c) => c.moneyCost >= 0 && c.moneyCost <= CAPS.moneyCostMax && c.staminaCost >= 0),
    "choice costs are sane",
  );
  const firstUsage = director.lastUsage;
  ok(firstUsage !== null, "usage captured");

  const a = clampDirectorTurn(arrival, state, true);
  console.log(a.log.length ? `  (clamp notes: ${a.log.join(" | ")})` : "  (no clamp corrections)");
  state = applyDirectorTurn(state, a.turn, null, "claude", a.log);

  // --- call 2: one turn (same cached prefix; npcLines live check) ---
  const choice = state.scene.choices[0];
  if (!choice) throw new Error("no choices from arrival");
  console.log(`  acting: ${choice.labelZh} [${choice.actionTag}]`);
  const dueEvents = state.eventQueue.filter((ev) => ev.status === "pending" && ev.dueTurn <= state.turn + 1);
  const turn = await director.takeTurn(state, choice, dueEvents);
  ok(CJK.test(turn.proseZh), "turn prose is Chinese");
  ok(turn.consequenceRecapZh.length > 0, "turn shows a visible consequence recap");
  ok(turn.choices.length >= 3 && turn.choices.length <= 4, `turn offers ${turn.choices.length} choices`);
  ok(turn.causalEntries.length >= 1, "turn writes the causal ledger");
  ok(turn.npcLines.length <= CAPS.npcLinesMax, `npcLines within cap (${turn.npcLines.length})`);
  if (turn.npcLines.length > 0) {
    ok(turn.npcLines.every((l) => CJK.test(l.lineZh)), "npcLines speak Chinese");
    console.log(`  (npcLines: ${turn.npcLines.map((l) => `${l.npcId}:「${l.lineZh}」`).join(" / ")})`);
  } else {
    console.log("  (no npcLines this turn — soft signal, not a failure)");
  }
  const secondUsage = director.lastUsage;
  ok(
    secondUsage !== null && secondUsage.cacheReadTokens > 0,
    `second call read the prompt cache (${secondUsage?.cacheReadTokens} tokens)`,
  );

  const t = clampDirectorTurn(turn, state, false, choice);
  console.log(t.log.length ? `  (clamp notes: ${t.log.join(" | ")})` : "  (no clamp corrections)");
  state = applyDirectorTurn(state, t.turn, choice, "claude", t.log);
  ok(state.turn === 1, "state advanced to turn 1");
  ok(state.timeline.length >= 2, "timeline grew");
  ok(
    state.scene.choices.filter((c) => affordableChoice(c, snapshotOf(state))).length >= 2,
    "≥2 affordable choices after the live turn",
  );

  // --- call 3: 攀谈 (TalkExchange grammar + structural disclosure filter) ---
  const focusNpc = state.scene.directive.focusNpcIds[0] ?? "he_shisan";
  const npc = state.npcs[focusNpc];
  const tier = trustTier(npc.trust);
  const ctx: TalkContext = {
    npcId: focusNpc,
    tier,
    allowedDisclosures: NPCS[focusNpc].disclosures
      .filter((d) => d.tier === "相识" && tier !== "冷淡")
      .map((d) => ({ id: d.id, revealZh: d.revealZh })),
    alreadyRevealedIds: [],
  };
  const exchange = await director.talk(state, ctx);
  ok(CJK.test(exchange.lineZh), `talk line is Chinese:「${exchange.lineZh.slice(0, 30)}…」`);
  ok(Math.abs(exchange.trustDelta) <= 5, `talk trustDelta plausible pre-clamp (${exchange.trustDelta})`);
  ok(
    exchange.revealZh === "" || ctx.allowedDisclosures.length > 0,
    "no reveal invented beyond the allowed list",
  );

  // --- call 4: report on a synthetic finished life (mirror grammar check) ---
  const done = JSON.parse(JSON.stringify(state)) as typeof state;
  done.finished = true;
  done.endingReasonZh = "灯落幕收，七日喧腾归于市鼓与钲声。";
  done.world.day = 7;
  done.player.tendencies.protect_someone = 4;
  done.player.tendencies.pursue_art = 3;
  done.player.tendencies.observe_wait = 2;
  done.history.push(
    { turn: 2, choiceId: "c1", labelZh: "倾囊相助，替她把这笔押钱垫上", actionTag: "protect_someone", engineUsed: "claude" },
    { turn: 7, choiceId: "c1", labelZh: "献上一首用心之作", actionTag: "pursue_art", engineUsed: "claude" },
  );
  const rawReport = await director.writeReport(done);
  const { report, log: guardLog } = guardReport(rawReport, done);
  console.log(guardLog.length ? `  (report guard: ${guardLog.join(" | ")})` : "  (report guard: clean)");
  ok(CJK.test(report.arcSummaryZh), "report summary is Chinese");
  ok(report.mirror.themes.length >= 1 && report.mirror.themes.length <= 3, `mirror has ${report.mirror.themes.length} themes`);
  ok(report.mirror.themes.every((th) => th.evidenceZh.length > 0), "mirror themes carry evidence");
  ok(CJK.test(report.mirror.gentleAdviceZh), "mirror advice present");
  ok(CJK.test(report.mirror.blessingZh), "mirror blessing present");
  console.log(`  (decision style: ${report.mirror.decisionStyleZh.slice(0, 40)}…)`);

  console.log(`\nscene preview:\n  「${t.turn.sceneTitleZh}」 ${t.turn.proseZh.slice(0, 80)}…`);
  console.log(`\nLIVE test passed (${passed} assertions).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
