/**
 * In-scene speech: paper-slip bubbles anchored to NPC figures via the
 * nameplate projection. Subscribes to the per-frame plates store itself so
 * only this small layer re-renders at frame rate.
 */
import type { NpcLine } from "@shared/types";
import { usePlates } from "../platesStore";

interface Props {
  /** Lines to show this beat (scene npcLines and/or talk replies). */
  lines: NpcLine[];
  turnKey: string | number;
}

export function SpeechBubbles({ lines, turnKey }: Props) {
  const plates = usePlates();
  const plateOf = new Map(plates.filter((p) => p.visible).map((p) => [p.npcId, p]));
  // Group lines per NPC; the bubble shows the most recent two.
  const byNpc = new Map<string, NpcLine[]>();
  for (const line of lines) {
    const list = byNpc.get(line.npcId) ?? [];
    list.push(line);
    byNpc.set(line.npcId, list);
  }

  return (
    <div className="bubble-layer" key={turnKey}>
      {[...byNpc.entries()].map(([npcId, npcLines], i) => {
        const plate = plateOf.get(npcId);
        if (!plate) return null;
        return (
          <div
            key={npcId}
            className="speech-bubble"
            style={{ left: plate.x, top: plate.y, animationDelay: `${i * 0.45}s` }}
          >
            {npcLines.slice(-2).map((l, j) => (
              <p key={j}>{l.lineZh}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
