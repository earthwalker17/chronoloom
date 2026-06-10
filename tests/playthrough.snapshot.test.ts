/**
 * Fixed-choice full-life structural snapshots per identity: always pick c1.
 * Guards the authored content's invariants (pacing, spine, report grounding)
 * against accidental regressions without brittle golden files.
 */
import { describe, expect, it } from "vitest";
import { IDENTITY_IDS } from "@shared/constants";
import type { SessionState } from "@shared/types";
import { ScriptedDirector } from "../server/engine/scriptedDirector";
import { applyDirectorTurn } from "../server/sim/applyTurn";
import { clampDirectorTurn } from "../server/sim/clamp";
import { newSession } from "../server/sim/newSession";

const director = new ScriptedDirector();

async function playC1(identity: (typeof IDENTITY_IDS)[number]): Promise<SessionState> {
  let state = newSession(identity, "scripted");
  const arrival = await director.startLife(state);
  const a = clampDirectorTurn(arrival, state, true);
  state = applyDirectorTurn(state, a.turn, null, "scripted", a.log);
  while (!state.finished) {
    const choice = state.scene.choices[0];
    if (!choice) throw new Error("no choices");
    const result = await director.takeTurn(state, choice, []);
    const t = clampDirectorTurn(result, state, false);
    state = applyDirectorTurn(state, t.turn, choice, "scripted", t.log);
  }
  return state;
}

describe("full-life structural snapshot (always pick c1)", () => {
  for (const identity of IDENTITY_IDS) {
    it(`${identity}: pacing, spine and state invariants hold`, async () => {
      const s = await playC1(identity);
      expect(s.turn).toBe(10);
      expect(s.chapter).toBe(3);
      expect(s.world.day).toBe(7); // 正月十九 by the finale
      expect(s.finished).toBe(true);
      expect(s.scene.titleZh).toBe("灯落之时");
      expect(s.timeline.length).toBeGreaterThanOrEqual(11);
      expect(s.ledger.length).toBeGreaterThanOrEqual(10);
      expect(s.history).toHaveLength(10);
      // Seeded spine events all resolved (none still pending).
      expect(s.eventQueue.filter((e) => e.source === "seed" && e.status === "pending")).toHaveLength(0);
      // Tendencies sum equals the number of choices made.
      const total = Object.values(s.player.tendencies).reduce((a, b) => a + b, 0);
      expect(total).toBe(10);
      // Numbers stayed in range.
      expect(s.player.money).toBeGreaterThanOrEqual(0);
      expect(s.player.health).toBeGreaterThanOrEqual(0);
      expect(s.player.health).toBeLessThanOrEqual(100);
      // No clamp violations in authored content.
      expect(s.validationLog).toHaveLength(0);
    });
  }
});
