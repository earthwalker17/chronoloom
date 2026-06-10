import type { TimelineEvent } from "@shared/types";
import { DAY_NAMES_ZH } from "@shared/constants";

interface Props {
  timeline: TimelineEvent[];
  onClose: () => void;
}

export function TimelineDrawer({ timeline, onClose }: Props) {
  const items = [...timeline].reverse();
  return (
    <div className="timeline-drawer paper-grain">
      <h3>
        浮生簿
        <button className="btn-ghost" style={{ float: "right", color: "var(--ink-soft)", borderColor: "var(--paper-shadow)", padding: "2px 10px", fontSize: 13 }} onClick={onClose}>
          收
        </button>
      </h3>
      {items.length === 0 && <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>尚无大事记。</p>}
      {items.map((ev) => (
        <div key={ev.id} className="tl-item">
          <span className="when">正月{DAY_NAMES_ZH[ev.day - 1] ?? "十三"}</span>
          <div className={`what${ev.importance === 3 ? " major" : ""}`}>{ev.titleZh}</div>
          <div className="detail">{ev.descZh}</div>
        </div>
      ))}
    </div>
  );
}
