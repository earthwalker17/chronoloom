import { useEffect, useState } from "react";

const LINES = [
  "灯影摇曳，命数推演中……",
  "市声渐远，因果交织……",
  "执笔者落墨了……",
  "一念既动，万象生焉……",
];

const SLOW_LINE = "长安夜长，且稍待……";

interface Props {
  error: string | null;
  onRetry: () => void;
}

export function WaitingOverlay({ error, onRetry }: Props) {
  const [idx, setIdx] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const rotate = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 2800);
    const slowTimer = setTimeout(() => setSlow(true), 12000);
    return () => {
      clearInterval(rotate);
      clearTimeout(slowTimer);
    };
  }, []);

  return (
    <div className="waiting-overlay">
      {error ? (
        <>
          <div className="error-line">{error}</div>
          <button className="btn-cinnabar" onClick={onRetry}>
            重掷
          </button>
        </>
      ) : (
        <>
          <div className="coin-spinner" />
          <div className="divination" key={slow ? "slow" : idx}>
            {slow ? SLOW_LINE : LINES[idx]}
          </div>
        </>
      )}
    </div>
  );
}
