import type { SessionView } from "@shared/types";

interface Props {
  view: SessionView;
  onToggleRelations: () => void;
  onToggleTimeline: () => void;
}

function InkBar({ value, max, warn }: { value: number; max: number; warn?: boolean }) {
  const segments = 5;
  const on = Math.round((Math.max(0, Math.min(value, max)) / max) * segments);
  return (
    <span className={`ink-bar${warn ? " warn" : ""}`}>
      {Array.from({ length: segments }, (_, i) => (
        <i key={i} className={i < on ? "on" : ""} />
      ))}
    </span>
  );
}

export function StatusStrip({ view, onToggleRelations, onToggleTimeline }: Props) {
  const { player, world } = view;
  const repNorm = Math.round(((player.reputation + 100) / 200) * 100);
  return (
    <div className="status-strip">
      <span className="date">
        〔上元 · 正月{world.dayNameZh} · {world.timeOfDayZh}〕
      </span>
      <span className="stat">{player.identityNameZh} · {player.nameZh}</span>
      <span className="stat">银钱 {player.money.toLocaleString()}文</span>
      <span className="stat">
        声望 <InkBar value={repNorm} max={100} />
      </span>
      <span className="stat">
        体力 <InkBar value={player.health} max={100} warn={player.health <= 30} />
      </span>
      {player.statusesZh.length > 0 && (
        <span className="stat status-tags">〔{player.statusesZh.join("·")}〕</span>
      )}
      <span className="spacer" />
      <span className="stat" style={{ opacity: 0.75 }}>{player.locationNameZh}</span>
      <button onClick={onToggleRelations}>人缘</button>
      <button onClick={onToggleTimeline}>浮生簿</button>
    </div>
  );
}
