import { useCallback, useRef, useState } from "react";
import type { Choice, SessionView } from "@shared/types";
import { ApiError, api } from "../api";
import { ChoiceList } from "../components/ChoiceList";
import { ProsePanel } from "../components/ProsePanel";
import { RelationshipPanel } from "../components/RelationshipPanel";
import { StatusStrip } from "../components/StatusStrip";
import { TimelineDrawer } from "../components/TimelineDrawer";
import { WaitingOverlay } from "../components/WaitingOverlay";

interface Props {
  view: SessionView;
  onView: (v: SessionView) => void;
  onOpenReport: () => void;
}

interface DeltaChip {
  id: number;
  text: string;
  gain: boolean;
}

export function Play({ view, onView, onOpenReport }: Props) {
  const [panel, setPanel] = useState<"none" | "relations" | "timeline">("none");
  const [pending, setPending] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [ink, setInk] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<DeltaChip[]>([]);
  const retryRef = useRef<Choice | null>(null);

  const showDeltas = useCallback((prev: SessionView, next: SessionView) => {
    const chips: DeltaChip[] = [];
    const push = (cond: boolean, text: string, gain: boolean) => cond && chips.push({ id: Math.random(), text, gain });
    const dMoney = next.player.money - prev.player.money;
    const dRep = next.player.reputation - prev.player.reputation;
    const dHealth = next.player.health - prev.player.health;
    push(dMoney !== 0, `${dMoney > 0 ? "+" : ""}${dMoney}文`, dMoney > 0);
    push(dRep !== 0, `声望${dRep > 0 ? "+" : ""}${dRep}`, dRep > 0);
    push(dHealth !== 0, `体力${dHealth > 0 ? "+" : ""}${dHealth}`, dHealth > 0);
    setDeltas(chips);
    setTimeout(() => setDeltas([]), 2700);
  }, []);

  const submit = useCallback(
    async (choice: Choice) => {
      setChosenId(choice.id);
      setPending(true);
      setError(null);
      retryRef.current = choice;
      setInk((n) => n + 1);
      try {
        const next = await api.takeTurn(view.id, choice.id, view.turn);
        showDeltas(view, next);
        onView(next);
        setChosenId(null);
        setPending(false);
        setPanel("none");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          // Turn already applied (double-click / lost response) — resync.
          const fresh = await api.getSession(view.id).catch(() => null);
          if (fresh) {
            onView(fresh);
            setChosenId(null);
            setPending(false);
            return;
          }
        }
        setError("天机受阻，再试一次");
      }
    },
    [view, onView, showDeltas],
  );

  const retry = useCallback(() => {
    const choice = retryRef.current;
    setError(null);
    if (choice) void submit(choice);
    else setPending(false);
  }, [submit]);

  return (
    <>
      <div className="ui-layer">
        <StatusStrip
          view={view}
          onToggleRelations={() => setPanel((p) => (p === "relations" ? "none" : "relations"))}
          onToggleTimeline={() => setPanel((p) => (p === "timeline" ? "none" : "timeline"))}
        />
        <div className="play-bottom">
          <ProsePanel scene={view.scene} turnKey={view.turn} />
          {view.finished ? (
            <div className="ending-banner">
              <p>{view.endingReasonZh}</p>
              <button className="btn-cinnabar" onClick={onOpenReport}>
                展我命书
              </button>
            </div>
          ) : (
            <ChoiceList
              choices={view.scene.choices}
              disabled={pending}
              chosenId={chosenId}
              turnKey={view.turn}
              onChoose={(c) => void submit(c)}
            />
          )}
        </div>
      </div>

      {deltas.length > 0 && (
        <div className="delta-floats">
          {deltas.map((d) => (
            <span key={d.id} className={`delta-chip ${d.gain ? "gain" : "loss"}`}>
              {d.text}
            </span>
          ))}
        </div>
      )}

      {panel === "relations" && <RelationshipPanel npcs={view.npcs} onClose={() => setPanel("none")} />}
      {panel === "timeline" && <TimelineDrawer timeline={view.timeline} onClose={() => setPanel("none")} />}

      {ink > 0 && <div className="ink-sweep" key={ink} />}
      {pending && <WaitingOverlay error={error} onRetry={retry} />}
      <span className="engine-chip">
        {view.engine === "claude" ? "天机 · Claude" : "演示 · 离线推演"} · 第{view.turn}手
      </span>
    </>
  );
}
