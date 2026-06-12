/**
 * 命书生成 overlay — staged progress language so the wait reads as a ritual,
 * not a frozen page. Stages advance on a timer; actual readiness is whenever
 * the (prefetched) report promise resolves and the parent swaps screens.
 */
import { useEffect, useState } from "react";

const STAGES = [
  { at: 0, text: "检视浮生簿……" },
  { at: 4500, text: "推演心性……" },
  { at: 12000, text: "落墨成书……" },
  { at: 26000, text: "命书将成，稍候……" },
];

interface Props {
  error: string | null;
  onRetry: () => void;
}

export function ReportForging({ error, onRetry }: Props) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.slice(1).map((s, i) => setTimeout(() => setStage(i + 1), s.at));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="waiting-overlay forging">
      {error ? (
        <>
          <div className="error-line">{error}</div>
          <button className="btn-cinnabar" onClick={onRetry}>
            再续命书
          </button>
        </>
      ) : (
        <>
          <div className="coin-spinner" />
          <div className="forging-stages">
            {STAGES.map((s, i) => (
              <div key={s.text} className={`forging-stage${i < stage ? " done" : i === stage ? " active" : ""}`}>
                {i < stage ? "✓ " : ""}
                {s.text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
