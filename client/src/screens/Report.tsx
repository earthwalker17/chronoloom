import { DAY_NAMES_ZH, FINAL_STANDING_ZH } from "@shared/constants";
import type { LifeReport, SessionView } from "@shared/types";
import { downloadShareCard } from "../components/ShareCard";

interface Props {
  view: SessionView;
  report: LifeReport;
  onRebirth: () => void;
}

/** Staged reveal: each section rises out of the paper in reading order. */
const stage = (i: number) => ({ animationDelay: `${0.25 + i * 0.55}s` });

export function Report({ view, report, onRebirth }: Props) {
  const npcName = (id: string) => view.npcs.find((n) => n.id === id)?.nameZh ?? id;
  const dayOf = (timelineId: string) => {
    const ev = view.timeline.find((e) => e.id === timelineId);
    return ev ? `正月${DAY_NAMES_ZH[ev.day - 1] ?? "十三"}` : "";
  };

  return (
    <div className="screen" style={{ justifyContent: "flex-start", paddingTop: 40, paddingBottom: 60 }}>
      <div className="report-card paper-grain fade-in">
        <div className="report-head">长 安 浮 生 · 命 书</div>

        <div className="report-title-row reveal-stage" style={stage(0)}>
          <div className="report-life-title">{report.lifeTitleZh}</div>
          <div className="report-epithet">{report.epithetZh}</div>
        </div>

        <div className="report-section reveal-stage" style={stage(1)}>
          <h4>身世</h4>
          <p>{report.arcSummaryZh}</p>
        </div>

        <div className="report-section reveal-stage" style={stage(2)}>
          <h4>命途</h4>
          {report.turningPoints.map((tp) => (
            <div key={tp.timelineId} className="turning-point">
              <span className="day">{dayOf(tp.timelineId)}</span>
              <div className="tp-title">{tp.titleZh}</div>
              <div className="tp-why">{tp.whyZh}</div>
            </div>
          ))}
        </div>

        <div className="report-section reveal-stage" style={stage(3)}>
          <h4>人缘</h4>
          {report.relationships.map((rel) => (
            <div key={rel.npcId} className="rel-row">
              <span className="rel-name">{npcName(rel.npcId)}</span>
              <span className={`rel-standing ${rel.finalStanding}`}>{FINAL_STANDING_ZH[rel.finalStanding]}</span>
              <span className="rel-arc">{rel.arcZh}</span>
            </div>
          ))}
        </div>

        <div className="report-section reveal-stage" style={stage(4)}>
          <h4>心性</h4>
          <div className="value-chips">
            {report.valuesRevealedZh.map((v) => (
              <span key={v} className="value-chip">
                {v}
              </span>
            ))}
          </div>
          <p style={{ marginTop: 12 }}>{report.protectedZh}</p>
          <p>{report.sacrificedZh}</p>
          <p style={{ color: "var(--ink-soft)" }}>{report.roadNotTakenZh}</p>
        </div>

        <div className="report-section reveal-stage" style={stage(5)}>
          <h4>结语</h4>
          <p className="closing-letter">{report.closingLetterZh}</p>
        </div>

        {/* 镜中人 — out of the dream: what this life may say about the real you. */}
        <div className="report-section mirror-section reveal-stage" style={stage(6)}>
          <div className="mirror-head">镜 中 人</div>
          <p className="mirror-note">出梦之后——这七日的选择，或许也照见了灯影之外的你。</p>
          <p>{report.mirror.decisionStyleZh}</p>
          {report.mirror.themes.map((t, i) => (
            <div key={i} className="mirror-theme">
              <p>{t.observationZh}</p>
              <p className="mirror-evidence">—— {t.evidenceZh}</p>
            </div>
          ))}
          <p className="mirror-tension">{report.mirror.innerTensionZh}</p>
          <p className="mirror-advice">{report.mirror.gentleAdviceZh}</p>
          <p className="mirror-blessing">{report.mirror.blessingZh}</p>
        </div>

        <div className="report-seal reveal-stage" style={stage(7)}>
          {[...report.shareCard.sealZh.slice(0, 4)].map((ch, i) => (
            <span key={i}>{ch}</span>
          ))}
        </div>
      </div>

      <div className="report-actions fade-in" style={{ animationDelay: "1.2s" }}>
        <button className="btn-cinnabar" onClick={() => downloadShareCard(report, view.player.identityNameZh)}>
          留影分享
        </button>
        <button className="btn-ghost" onClick={onRebirth}>
          再入轮回
        </button>
      </div>
    </div>
  );
}
