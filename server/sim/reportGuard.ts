/**
 * Grounding guard: a life report may only claim what was actually lived.
 * Turning points must cite real timeline ids; value chips must correspond to
 * tendencies the player actually expressed; mirror themes must carry real
 * evidence. Ungrounded claims are deleted (or rebuilt from the lived record).
 */
import { ACTION_TAGS, ACTION_TAG_VALUES_ZH, CAPS } from "@shared/constants";
import type { LifeReport, SessionState } from "@shared/types";
import { buildScriptedMirror } from "../content/reportTemplates";

export function guardReport(report: LifeReport, state: SessionState): { report: LifeReport; log: string[] } {
  const log: string[] = [];
  const r: LifeReport = JSON.parse(JSON.stringify(report));

  const knownIds = new Set(state.timeline.map((ev) => ev.id));
  const before = r.turningPoints.length;
  r.turningPoints = r.turningPoints.filter((tp) => knownIds.has(tp.timelineId));
  if (r.turningPoints.length < before) {
    log.push(`report: ${before - r.turningPoints.length} turning point(s) cited unknown timeline ids — dropped`);
  }
  if (r.turningPoints.length === 0 && state.timeline.length > 0) {
    // Never let the report float free of the life: re-anchor on the major events.
    r.turningPoints = [...state.timeline]
      .sort((a, b) => b.importance - a.importance || a.turn - b.turn)
      .slice(0, 3)
      .map((ev) => ({ timelineId: ev.id, titleZh: ev.titleZh, whyZh: ev.descZh }));
    log.push("report: turning points re-anchored from timeline");
  }

  const lived = new Set(
    ACTION_TAGS.filter((t) => state.player.tendencies[t] > 0).map((t) => ACTION_TAG_VALUES_ZH[t]),
  );
  const beforeVals = r.valuesRevealedZh.length;
  r.valuesRevealedZh = [...new Set(r.valuesRevealedZh)]
    .filter((v) => lived.has(v))
    .slice(0, CAPS.valuesRevealedMax);
  if (r.valuesRevealedZh.length < beforeVals) {
    log.push(`report: ${beforeVals - r.valuesRevealedZh.length} ungrounded value chip(s) dropped`);
  }
  if (r.valuesRevealedZh.length === 0) {
    r.valuesRevealedZh = [...lived].slice(0, CAPS.valuesRevealedMax);
    log.push("report: value chips re-derived from tendencies");
  }

  // One relationship entry per NPC.
  const seen = new Set<string>();
  r.relationships = r.relationships.filter((rel) => {
    if (seen.has(rel.npcId)) return false;
    seen.add(rel.npcId);
    return true;
  });

  // Share card needs exactly 3 stat highlights.
  while (r.shareCard.statHighlightsZh.length < 3) {
    r.shareCard.statHighlightsZh.push(`七日 · ${state.timeline.length} 件大事记入浮生簿`);
  }
  r.shareCard.statHighlightsZh = r.shareCard.statHighlightsZh.slice(0, 3);

  // --- 镜中人: themes need evidence; a hollow mirror is rebuilt, not shown ---
  const beforeThemes = r.mirror.themes.length;
  r.mirror.themes = r.mirror.themes
    .filter((t) => t.evidenceZh.trim() !== "" && t.observationZh.trim() !== "")
    .slice(0, CAPS.mirrorThemesMax);
  if (r.mirror.themes.length < beforeThemes) {
    log.push(`report: ${beforeThemes - r.mirror.themes.length} evidence-free mirror theme(s) dropped`);
  }
  const mirrorHollow =
    r.mirror.themes.length === 0 ||
    r.mirror.decisionStyleZh.trim() === "" ||
    r.mirror.gentleAdviceZh.trim() === "" ||
    r.mirror.blessingZh.trim() === "";
  if (mirrorHollow) {
    r.mirror = buildScriptedMirror(state);
    log.push("report: mirror was hollow — rebuilt from the lived record");
  }

  return { report: r, log };
}
