/**
 * Owns the Three.js diorama behind a ref; React never touches the scene graph.
 * If the 3D layer fails to load (or WebGL is unavailable), degrades to a CSS
 * gradient scene card driven by the same SceneDirective.
 *
 * Scene-native interaction flows through props: highlights/talking/approach/
 * protagonist drive the handle; picks and nameplate projections flow back up.
 */
import { useEffect, useRef, useState } from "react";
import type { SceneDirective } from "@shared/types";
import type { DioramaHandle, NameplatePos, SceneHit } from "../scene";

interface Props {
  directive: SceneDirective;
  /** npcId → display name for nameplates. */
  focusNames: Record<string, string>;
  paused?: boolean;
  /** Identity of the visible player figure; null hides it (landing). */
  protagonist?: string | null;
  /** Heroes that glow as interactable (anchored choices). */
  highlights?: readonly string[];
  /** Hero currently playing the talking gesture. */
  talkingNpcId?: string | null;
  /** Protagonist walk target; bump seq to retrigger the same target. */
  approach?: { npcId: string | null; seq: number };
  onPick?: (hit: SceneHit | null) => void;
  onPlates?: (plates: NameplatePos[]) => void;
}

const FALLBACK_SKY: Record<SceneDirective["timeOfDay"], string> = {
  morning: "linear-gradient(180deg, #c9d4e0 0%, #e4d9bd 55%, #8d7b5f 100%)",
  noon: "linear-gradient(180deg, #b7c8d8 0%, #e8debf 60%, #97825f 100%)",
  dusk: "linear-gradient(180deg, #54465c 0%, #c97f4e 55%, #6d5340 100%)",
  night: "linear-gradient(180deg, #121724 0%, #202840 55%, #2d2536 100%)",
};

export function SceneCanvas({
  directive,
  focusNames,
  paused = false,
  protagonist = null,
  highlights = [],
  talkingNpcId = null,
  approach,
  onPick,
  onPlates,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<DioramaHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [plates, setPlates] = useState<NameplatePos[]>([]);
  const onPickRef = useRef(onPick);
  const onPlatesRef = useRef(onPlates);
  onPickRef.current = onPick;
  onPlatesRef.current = onPlates;

  // Mount the diorama once.
  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    import("../scene")
      .then(({ initDiorama }) => {
        if (disposed) return;
        const handle = initDiorama(canvas);
        handleRef.current = handle;
        handle.onNameplates((p) => {
          setPlates(p);
          onPlatesRef.current?.(p);
        });
        handle.onPick((hit) => onPickRef.current?.(hit));
        const parent = canvas.parentElement;
        if (parent) handle.resize(parent.clientWidth, parent.clientHeight);
        setReady(true);
      })
      .catch((e) => {
        console.warn("[scene] 3D layer unavailable, using CSS fallback:", e);
        setFailed(true);
      });
    return () => {
      disposed = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  // Drive directives + interaction channels + pause state + resize.
  useEffect(() => {
    if (ready) handleRef.current?.applyDirective(directive);
  }, [ready, directive]);

  useEffect(() => {
    if (ready) handleRef.current?.setProtagonist(protagonist);
  }, [ready, protagonist]);

  useEffect(() => {
    if (ready) handleRef.current?.setHighlights(highlights);
  }, [ready, highlights]);

  useEffect(() => {
    if (ready) handleRef.current?.setTalking(talkingNpcId);
  }, [ready, talkingNpcId]);

  useEffect(() => {
    if (ready && approach) handleRef.current?.protagonistApproach(approach.npcId);
  }, [ready, approach]);

  useEffect(() => {
    if (ready) handleRef.current?.setRunning(!paused && !document.hidden);
    const onVis = () => handleRef.current?.setRunning(!paused && !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ready, paused]);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current;
      const parent = canvas?.parentElement;
      if (parent) handleRef.current?.resize(parent.clientWidth, parent.clientHeight);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="canvas-layer">
      {failed ? (
        <div
          className="scene-fallback"
          style={{
            background: FALLBACK_SKY[directive.timeOfDay],
            filter: directive.mood === "tense" || directive.mood === "ominous" ? "saturate(0.6) brightness(0.8)" : undefined,
          }}
        />
      ) : (
        <canvas ref={canvasRef} />
      )}
      {plates
        .filter((p) => p.visible && focusNames[p.npcId])
        .map((p) => (
          <div key={p.npcId} className="nameplate" style={{ left: p.x, top: p.y }}>
            {focusNames[p.npcId]}
          </div>
        ))}
    </div>
  );
}
