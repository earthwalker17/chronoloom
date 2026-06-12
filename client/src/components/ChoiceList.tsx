import type { Choice, SessionView } from "@shared/types";
import { choiceAffordance } from "../affordance";

interface Props {
  view: SessionView;
  choices: Choice[];
  disabled: boolean;
  chosenId: string | null;
  turnKey: number;
  onChoose: (choice: Choice) => void;
}

const RISK_ZH = { low: "稳", medium: "险中平", high: "大险" } as const;

export function ChoiceList({ view, choices, disabled, chosenId, turnKey, onChoose }: Props) {
  return (
    <div className="choice-list" key={turnKey}>
      {choices.map((c) => {
        const aff = choiceAffordance(view, c);
        return (
          <button
            key={c.id}
            className={`choice-slip paper-grain${aff.locked ? " locked" : ""}${c.anchorNpcId ? " anchored" : ""}`}
            disabled={disabled || aff.locked}
            style={chosenId && chosenId !== c.id ? { opacity: 0.35 } : undefined}
            onClick={() => !aff.locked && onChoose(c)}
          >
            <div className="label">{c.labelZh}</div>
            {c.hintZh && <div className="hint">{c.hintZh}</div>}
            {aff.chips.length > 0 && (
              <div className="cost-chips">
                {aff.chips.map((chip) => (
                  <span key={chip.text} className={`cost-chip ${chip.kind}`}>
                    {chip.text}
                  </span>
                ))}
              </div>
            )}
            {aff.locked ? (
              <span className="lock-reason">{aff.reasonZh}</span>
            ) : (
              <span className={`risk ${c.risk}`}>{RISK_ZH[c.risk]}</span>
            )}
            {chosenId === c.id && <span className="seal">择</span>}
            {aff.locked && <span className="seal lock">锁</span>}
          </button>
        );
      })}
    </div>
  );
}
