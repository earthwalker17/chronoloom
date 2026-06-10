import type { NpcView } from "@shared/types";

interface Props {
  npcs: NpcView[];
  onClose: () => void;
}

export function RelationshipPanel({ npcs, onClose }: Props) {
  return (
    <div className="side-panel paper-grain">
      <h3>
        人缘
        <button className="btn-ghost" style={{ float: "right", color: "var(--ink-soft)", borderColor: "var(--paper-shadow)", padding: "2px 10px", fontSize: 13 }} onClick={onClose}>
          收
        </button>
      </h3>
      {npcs.map((n) => (
        <div key={n.id} className="npc-row">
          <div className="head">
            <span className={`npc-glyph ${n.glyph}`}>{n.glyph}</span>
            <div>
              <div className="name">
                {n.nameZh}
                {n.changedThisTurn && <span className="npc-dot" />}
              </div>
              <div className="role">{n.roleZh}</div>
            </div>
            <span className="tier">〔{n.tier}〕</span>
          </div>
          {n.lastChangeZh && <div className="change">「{n.lastChangeZh}」</div>}
        </div>
      ))}
    </div>
  );
}
