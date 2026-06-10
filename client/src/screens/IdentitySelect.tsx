import { useState } from "react";
import type { IdentityId } from "@shared/constants";
import type { IdentityCard } from "@shared/types";

interface Props {
  identities: IdentityCard[];
  busy: boolean;
  onConfirm: (id: IdentityId) => void;
}

const GLYPH_COLORS: Record<string, string> = {
  scholar: "linear-gradient(150deg, #2e4a4f, #1b2233)",
  apprentice: "linear-gradient(150deg, #a23e2e, #6b2a20)",
  interpreter: "linear-gradient(150deg, #c9a227, #8a6b14)",
  copyist: "linear-gradient(150deg, #5a5248, #2b2620)",
};

export function IdentitySelect({ identities, busy, onConfirm }: Props) {
  const [selected, setSelected] = useState<IdentityId | null>(null);

  return (
    <div className="screen">
      <h2 className="fade-in" style={{ fontFamily: "var(--font-display)", color: "var(--paper)", fontSize: 28, letterSpacing: "0.4em", textShadow: "0 2px 12px #000" }}>
        择身入世
      </h2>
      <div className="identity-grid">
        {identities.map((card) => (
          <button
            key={card.id}
            className={`identity-card paper-grain fade-in${selected === card.id ? " selected" : ""}`}
            onClick={() => setSelected(card.id)}
          >
            <div className="identity-glyph" style={{ background: GLYPH_COLORS[card.id] }}>
              {card.glyphZh}
            </div>
            <h3>{card.nameZh}</h3>
            <div className="line">{card.cardLineZh}</div>
            <div className="hints">
              {card.statHintsZh.map((h, i) => (
                <span key={i}>{h}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
      <button
        className="btn-cinnabar"
        disabled={!selected || busy}
        style={{ opacity: selected && !busy ? 1 : 0.45 }}
        onClick={() => selected && onConfirm(selected)}
      >
        {busy ? "命数推演中……" : "以此身，入此局"}
      </button>
    </div>
  );
}
