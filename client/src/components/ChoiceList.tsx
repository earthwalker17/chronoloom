import type { Choice } from "@shared/types";

interface Props {
  choices: Choice[];
  disabled: boolean;
  chosenId: string | null;
  turnKey: number;
  onChoose: (choice: Choice) => void;
}

const RISK_ZH = { low: "稳", medium: "险中平", high: "大险" } as const;

export function ChoiceList({ choices, disabled, chosenId, turnKey, onChoose }: Props) {
  return (
    <div className="choice-list" key={turnKey}>
      {choices.map((c) => (
        <button
          key={c.id}
          className="choice-slip paper-grain"
          disabled={disabled}
          style={chosenId && chosenId !== c.id ? { opacity: 0.35 } : undefined}
          onClick={() => onChoose(c)}
        >
          <div className="label">{c.labelZh}</div>
          {c.hintZh && <div className="hint">{c.hintZh}</div>}
          <span className={`risk ${c.risk}`}>{RISK_ZH[c.risk]}</span>
          {chosenId === c.id && <span className="seal">择</span>}
        </button>
      ))}
    </div>
  );
}
