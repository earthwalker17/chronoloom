/** Mirror guard: themes need evidence; a hollow mirror is rebuilt from the lived record. */
import { describe, expect, it } from "vitest";
import type { LifeReport, SessionState } from "@shared/types";
import { newSession } from "../server/sim/newSession";
import { guardReport } from "../server/sim/reportGuard";
import { buildScriptedReport } from "../server/content/reportTemplates";

function livedState(): SessionState {
  const s = newSession("scholar", "scripted");
  s.player.tendencies.protect_someone = 3;
  s.player.tendencies.pursue_art = 2;
  s.history.push(
    { turn: 1, choiceId: "c1", labelZh: "替被喝斥的摊贩说句公道话", actionTag: "protect_someone", engineUsed: "scripted" },
    { turn: 2, choiceId: "c2", labelZh: "献上一首用心之作", actionTag: "pursue_art", engineUsed: "scripted" },
  );
  s.timeline.push({
    id: "tl_1_0",
    turn: 1,
    day: 1,
    kind: "decision",
    titleZh: "出头之恩",
    descZh: "你替弱者撑了腰。",
    importance: 2,
    npcIds: [],
    locationId: "market_cross",
  });
  s.finished = true;
  return s;
}

function validReport(state: SessionState): LifeReport {
  return buildScriptedReport(state);
}

describe("guardReport mirror", () => {
  it("trims themes past the cap", () => {
    const state = livedState();
    const r = validReport(state);
    r.mirror.themes = Array.from({ length: 5 }, (_, i) => ({
      observationZh: `观察${i}`,
      evidenceZh: `你选了「某事${i}」`,
    }));
    const { report } = guardReport(r, state);
    expect(report.mirror.themes.length).toBeLessThanOrEqual(3);
  });

  it("drops evidence-free themes and logs", () => {
    const state = livedState();
    const r = validReport(state);
    r.mirror.themes = [
      { observationZh: "有凭据的观察", evidenceZh: "你选了「替被喝斥的摊贩说句公道话」" },
      { observationZh: "凭空的断言", evidenceZh: "   " },
    ];
    const { report, log } = guardReport(r, state);
    expect(report.mirror.themes).toHaveLength(1);
    expect(log.some((l) => l.includes("mirror"))).toBe(true);
  });

  it("rebuilds a hollow mirror from the lived record", () => {
    const state = livedState();
    const r = validReport(state);
    r.mirror = {
      decisionStyleZh: "",
      themes: [{ observationZh: "x", evidenceZh: "" }],
      innerTensionZh: "",
      gentleAdviceZh: "",
      blessingZh: "",
    };
    const { report, log } = guardReport(r, state);
    expect(report.mirror.decisionStyleZh.length).toBeGreaterThan(0);
    expect(report.mirror.themes.length).toBeGreaterThanOrEqual(1);
    expect(report.mirror.themes[0]?.evidenceZh.length).toBeGreaterThan(0);
    expect(report.mirror.blessingZh.length).toBeGreaterThan(0);
    expect(log.some((l) => l.includes("rebuilt"))).toBe(true);
  });

  it("evidence in the rebuilt mirror cites real choice labels", () => {
    const state = livedState();
    const r = validReport(state);
    r.mirror.themes = [];
    const { report } = guardReport(r, state);
    expect(report.mirror.themes.some((t) => t.evidenceZh.includes("替被喝斥的摊贩说句公道话"))).toBe(true);
  });
});
