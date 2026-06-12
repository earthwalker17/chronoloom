import { useCallback, useEffect, useRef, useState } from "react";
import type { Choice, NpcView, SessionView, TalkResponse } from "@shared/types";
import { ApiError, api } from "../api";
import { choiceAffordance } from "../affordance";
import { ChoiceList } from "../components/ChoiceList";
import { NpcPopover } from "../components/NpcPopover";
import { ProsePanel } from "../components/ProsePanel";
import { RelationshipPanel } from "../components/RelationshipPanel";
import { SpeechBubbles } from "../components/SpeechBubbles";
import { StatusStrip } from "../components/StatusStrip";
import { TimelineDrawer } from "../components/TimelineDrawer";
import { WaitingOverlay } from "../components/WaitingOverlay";

/** Scene-interaction controls App wires to the diorama handle. */
export interface SceneCtl {
  setHighlights: (ids: string[]) => void;
  setTalking: (id: string | null) => void;
  approach: (id: string | null) => void;
  registerPick: (fn: (npcId: string | null) => void) => void;
}

interface Props {
  view: SessionView;
  onView: (v: SessionView) => void;
  onOpenReport: () => void;
  sceneCtl: SceneCtl;
}

interface DeltaChip {
  id: number;
  text: string;
  gain: boolean;
}

const ENGINE_ZH: Record<SessionView["engine"], string> = {
  claude: "天机 · Claude",
  openai: "天机 · GPT",
  deepseek: "天机 · DeepSeek",
  scripted: "演示 · 离线推演",
};

export function Play({ view, onView, onOpenReport, sceneCtl }: Props) {
  const [panel, setPanel] = useState<"none" | "relations" | "timeline">("none");
  const [pending, setPending] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [ink, setInk] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deltas, setDeltas] = useState<DeltaChip[]>([]);
  const [popoverNpc, setPopoverNpc] = useState<string | null>(null);
  const [talkBusy, setTalkBusy] = useState(false);
  const [talks, setTalks] = useState<Record<string, TalkResponse>>({});
  const retryRef = useRef<Choice | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

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
      setPopoverNpc(null);
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
        if (e instanceof ApiError && (e.status === 409 || e.status === 422)) {
          // 409: turn already applied (double-click / lost response).
          // 422: choice got locked (e.g. a talk shifted trust) — resync shows why.
          const fresh = await api.getSession(view.id).catch(() => null);
          if (fresh) {
            onView(fresh);
            setChosenId(null);
            setPending(false);
            if (e.status === 422) setError(null);
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

  // --- 攀谈 (sub-turn talk) ---
  const talk = useCallback(
    async (npc: NpcView) => {
      setTalkBusy(true);
      sceneCtl.setTalking(npc.id);
      try {
        const r = await api.talk(view.id, npc.id, view.turn);
        setTalks((t) => ({ ...t, [npc.id]: r }));
        // Talk mutates trust/memory and can re-floor choice costs — resync.
        const fresh = await api.getSession(view.id).catch(() => null);
        if (fresh) onView(fresh);
      } catch (e) {
        if (e instanceof ApiError) {
          const fresh = await api.getSession(view.id).catch(() => null);
          if (fresh) onView(fresh);
        }
      } finally {
        setTalkBusy(false);
        setTimeout(() => sceneCtl.setTalking(null), 2600);
      }
    },
    [view.id, view.turn, onView, sceneCtl],
  );

  // Pick handler (registered once; reads the latest view through a ref).
  useEffect(() => {
    sceneCtl.registerPick((npcId) => {
      if (!npcId || viewRef.current.finished) {
        setPopoverNpc(null);
        return;
      }
      setPopoverNpc(npcId);
      sceneCtl.approach(npcId);
    });
  }, [sceneCtl]);

  // Anchored, affordable choices glow on their figures.
  useEffect(() => {
    const ids = view.finished
      ? []
      : view.scene.choices
          .filter((c) => c.anchorNpcId !== "" && !choiceAffordance(view, c).locked)
          .map((c) => c.anchorNpcId);
    sceneCtl.setHighlights(ids);
    return () => sceneCtl.setHighlights([]);
  }, [view, sceneCtl]);

  // New turn: talk replies expire, popover closes, protagonist returns home.
  useEffect(() => {
    setTalks({});
    setPopoverNpc(null);
    sceneCtl.approach(null);
  }, [view.turn, sceneCtl]);

  const bubbleLines = [
    ...view.scene.npcLines,
    ...Object.values(talks).flatMap((t) => t.lines),
  ];
  const popNpc = popoverNpc ? view.npcs.find((n) => n.id === popoverNpc) : undefined;
  const popChoice = popoverNpc
    ? (view.scene.choices.find((c) => c.anchorNpcId === popoverNpc) ?? null)
    : null;

  return (
    <>
      <SpeechBubbles lines={bubbleLines} turnKey={view.turn} />
      {popNpc && (
        <NpcPopover
          view={view}
          npc={popNpc}
          anchoredChoice={popChoice}
          talkBusy={talkBusy}
          revealZh={talks[popNpc.id]?.revealZh ?? ""}
          onChoose={(c) => void submit(c)}
          onTalk={() => void talk(popNpc)}
          onClose={() => setPopoverNpc(null)}
        />
      )}

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
              view={view}
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
        {ENGINE_ZH[view.engine]} · 第{view.turn}手
      </span>
    </>
  );
}
