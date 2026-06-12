/**
 * Migrate-on-read for saved sessions written before the scene-native upgrade.
 * Purely additive defaults — schemaVersion stays 1. Anything that is not an
 * object passes through untouched and fails the subsequent schema parse, so
 * genuinely corrupt files still reject cleanly (StateCorruptError).
 *
 * The store validates on write, so a migrated session self-heals on its
 * first save and this shim becomes a no-op for it afterwards.
 */
import type { SessionState } from "@shared/types";
import { buildScriptedMirror } from "../content/reportTemplates";

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

const CHOICE_DEFAULTS = {
  anchorNpcId: "",
  moneyCost: 0,
  staminaCost: 0,
  minReputation: -100, // never gates
  minTrustNpcId: "",
  minTrustTier: "",
};

export function migrateSessionJson(raw: unknown): unknown {
  if (!isObj(raw)) return raw;

  // Sub-turn talk fence
  raw.talkedNpcIds ??= [];

  // Scene: npcLines + choice cost/gate/anchor defaults
  if (isObj(raw.scene)) {
    raw.scene.npcLines ??= [];
    if (Array.isArray(raw.scene.choices)) {
      for (const c of raw.scene.choices) {
        if (!isObj(c)) continue;
        for (const [k, v] of Object.entries(CHOICE_DEFAULTS)) c[k] ??= v;
      }
    }
  }

  // NPC disclosure bookkeeping
  if (isObj(raw.npcs)) {
    for (const npc of Object.values(raw.npcs)) {
      if (isObj(npc)) npc.revealed ??= [];
    }
  }

  // Finished pre-upgrade lives: backfill the 镜中人 section from the lived
  // record (tendencies/history exist in the old shape, which is all the
  // scripted mirror reads).
  if (isObj(raw.report) && raw.report.mirror === undefined) {
    try {
      raw.report.mirror = buildScriptedMirror(raw as unknown as SessionState);
    } catch {
      // leave it absent — the parse will reject and report corruption honestly
    }
  }

  return raw;
}
