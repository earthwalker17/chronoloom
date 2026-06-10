import { useEffect, useRef, useState } from "react";
import type { Scene } from "@shared/types";

interface Props {
  scene: Scene;
  turnKey: number;
}

/** Typewriter prose (~35 chars/s); click to reveal instantly. */
export function ProsePanel({ scene, turnKey }: Props) {
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setShown(0);
    timer.current = setInterval(() => {
      setShown((n) => {
        if (n >= scene.proseZh.length) {
          if (timer.current) clearInterval(timer.current);
          return n;
        }
        return n + 1;
      });
    }, 28);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [turnKey, scene.proseZh]);

  return (
    <div className="prose-panel paper-grain">
      <div className="scene-title">{scene.titleZh}</div>
      <div className="prose-body">
        {scene.consequenceRecapZh && <div className="recap">{scene.consequenceRecapZh}</div>}
        <div className="prose-text" onClick={() => setShown(scene.proseZh.length)}>
          {scene.proseZh.slice(0, shown)}
          {shown < scene.proseZh.length && <span style={{ opacity: 0.4 }}>▍</span>}
        </div>
      </div>
    </div>
  );
}
