import type { MetaResponse } from "@shared/types";

interface Props {
  era: MetaResponse["era"];
  onNext: () => void;
}

export function EraIntro({ era, onNext }: Props) {
  return (
    <div className="screen">
      <div className="scroll-card paper-grain fade-in">
        <h2>{era.titleZh}</h2>
        <div className="sub">{era.subtitleZh}</div>
        <p>{era.introZh}</p>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontFamily: "var(--font-display)", letterSpacing: "0.3em", fontSize: 14, color: "var(--cinnabar)" }}>
            市井传闻
          </div>
          {era.rumorsZh.map((r, i) => (
            <div key={i} className="rumor-chip">
              {r}
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 26 }}>
          <button className="btn-cinnabar" onClick={onNext}>
            择身入世
          </button>
        </div>
      </div>
    </div>
  );
}
