/**
 * Old saves must keep loading: migrate-on-read fills the scene-native upgrade
 * fields (talk fence, npcLines, choice costs, npc.revealed, report.mirror)
 * and the result passes the strict schema. Garbage still rejects.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SessionStateSchema } from "@shared/schemas";
import { migrateSessionJson } from "../server/store/migrate";

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

describe("migrateSessionJson", () => {
  it("migrates a finished pre-upgrade life (with report) to a valid state", () => {
    const state = SessionStateSchema.parse(migrateSessionJson(fixture("pre-upgrade-finished.json")));
    expect(state.talkedNpcIds).toEqual([]);
    expect(state.scene.npcLines).toEqual([]);
    for (const npc of Object.values(state.npcs)) expect(npc.revealed).toEqual([]);
    // 镜中人 backfilled from the lived record, grounded in real choices.
    expect(state.report).not.toBeNull();
    expect(state.report?.mirror.themes.length).toBeGreaterThanOrEqual(1);
    expect(state.report?.mirror.decisionStyleZh.length).toBeGreaterThan(0);
    expect(state.report?.mirror.blessingZh.length).toBeGreaterThan(0);
  });

  it("migrates a mid-life pre-upgrade save: choices get free/ungated defaults", () => {
    const state = SessionStateSchema.parse(migrateSessionJson(fixture("pre-upgrade-midlife.json")));
    expect(state.report).toBeNull();
    expect(state.scene.choices.length).toBeGreaterThan(0);
    for (const c of state.scene.choices) {
      expect(c.moneyCost).toBe(0);
      expect(c.staminaCost).toBe(0);
      expect(c.minReputation).toBe(-100); // never gates
      expect(c.anchorNpcId).toBe("");
      expect(c.minTrustNpcId).toBe("");
    }
  });

  it("migration is idempotent on already-current states", () => {
    const once = migrateSessionJson(fixture("pre-upgrade-finished.json"));
    const twice = migrateSessionJson(JSON.parse(JSON.stringify(once)));
    expect(SessionStateSchema.parse(twice)).toEqual(SessionStateSchema.parse(once));
  });

  it("garbage still rejects cleanly", () => {
    expect(() => SessionStateSchema.parse(migrateSessionJson({ hello: "world" }))).toThrow();
    expect(() => SessionStateSchema.parse(migrateSessionJson("not even an object"))).toThrow();
  });
});
