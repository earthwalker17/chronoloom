/**
 * Click-a-figure action popover: the in-scene interaction hub for one NPC.
 * Offers the anchored choice (if any) and 攀谈 — clicking a person replaces
 * clicking a card. Tracks the NPC's projected screen position per frame.
 */
import type { Choice, NpcView, SessionView } from "@shared/types";
import { choiceAffordance } from "../affordance";
import { usePlates } from "../platesStore";

interface Props {
  view: SessionView;
  npc: NpcView;
  anchoredChoice: Choice | null;
  talkBusy: boolean;
  /** Already-received reveal for this npc this turn ("" = none). */
  revealZh: string;
  onChoose: (c: Choice) => void;
  onTalk: () => void;
  onClose: () => void;
}

export function NpcPopover({ view, npc, anchoredChoice, talkBusy, revealZh, onChoose, onTalk, onClose }: Props) {
  const plates = usePlates();
  const plate = plates.find((p) => p.npcId === npc.id && p.visible);
  if (!plate) return null;
  const aff = anchoredChoice ? choiceAffordance(view, anchoredChoice) : null;

  return (
    <div className="npc-popover paper-grain" style={{ left: plate.x, top: plate.y }}>
      <button className="popover-close" onClick={onClose} aria-label="close">
        ×
      </button>
      <div className="popover-head">
        <span className="popover-name">{npc.nameZh}</span>
        <span className="popover-role">{npc.roleZh}</span>
        <span className="popover-tier">{npc.tier}</span>
      </div>
      {revealZh && <p className="popover-reveal">密 · {revealZh}</p>}
      <div className="popover-actions">
        {anchoredChoice && aff && (
          <button
            className={`popover-action primary${aff.locked ? " locked" : ""}`}
            disabled={aff.locked || talkBusy}
            title={aff.locked ? aff.reasonZh : undefined}
            onClick={() => onChoose(anchoredChoice)}
          >
            {anchoredChoice.labelZh}
            <span className="popover-cost">
              {aff.locked ? aff.reasonZh : aff.chips.map((c) => c.text).join(" · ")}
            </span>
          </button>
        )}
        <button className="popover-action" disabled={!npc.canTalk || talkBusy} onClick={onTalk}>
          {talkBusy ? "攀谈中……" : npc.canTalk ? "攀谈" : "这一阵聊过了"}
        </button>
      </div>
    </div>
  );
}
