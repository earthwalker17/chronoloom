/**
 * Visual dev harness at #/dev/scene — every SceneDirective knob, live renderer
 * stats and a screenshot button. Not linked from the game UI.
 */
import { useEffect, useRef, useState } from "react";
import {
  CROWD_LEVELS,
  LANTERN_LEVELS,
  LOCATION_IDS,
  MOODS,
  NPC_IDS,
  TIMES_OF_DAY,
  WEATHERS,
} from "@shared/constants";
import type { SceneDirective } from "@shared/types";
import type { DioramaHandle } from "../scene";

const INITIAL: SceneDirective = {
  locationId: "market_cross",
  timeOfDay: "night",
  weather: "clear",
  mood: "festive",
  crowd: "packed",
  lanterns: "festival",
  focusNpcIds: ["shen_yanqiu"],
};

export function DevScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<DioramaHandle | null>(null);
  const [directive, setDirective] = useState<SceneDirective>(INITIAL);
  const [stats, setStats] = useState({ drawCalls: 0, triangles: 0, fps: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let handle: DioramaHandle | null = null;
    void import("../scene").then(({ initDiorama }) => {
      handle = initDiorama(canvas);
      handleRef.current = handle;
      handle.resize(window.innerWidth, window.innerHeight);
      handle.applyDirective(INITIAL, 0);
    });
    const statsTimer = setInterval(() => {
      if (handleRef.current) setStats(handleRef.current.info());
    }, 500);
    const onResize = () => handleRef.current?.resize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(statsTimer);
      window.removeEventListener("resize", onResize);
      handle?.dispose();
    };
  }, []);

  const set = (patch: Partial<SceneDirective>) => {
    const next = { ...directive, ...patch };
    setDirective(next);
    handleRef.current?.applyDirective(next);
  };

  const select = <K extends keyof SceneDirective>(label: string, key: K, options: readonly string[]) => (
    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
      <span style={{ width: 56 }}>{label}</span>
      <select
        value={directive[key] as string}
        onChange={(e) => set({ [key]: e.target.value } as Partial<SceneDirective>)}
        style={{ flex: 1 }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );

  const screenshot = () => {
    const url = handleRef.current?.screenshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `chronoloom-scene-${directive.locationId}-${directive.timeOfDay}-${directive.mood}.png`;
    a.click();
  };

  return (
    <div className="app-root">
      <div className="canvas-layer">
        <canvas ref={canvasRef} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 10,
          width: 250,
          padding: 14,
          background: "rgba(18,23,36,0.85)",
          color: "#f2ead8",
          fontFamily: "var(--font-ui)",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <strong style={{ fontSize: 13 }}>场景调试 · #/dev/scene</strong>
        {select("地点", "locationId", LOCATION_IDS)}
        {select("时辰", "timeOfDay", TIMES_OF_DAY)}
        {select("天气", "weather", WEATHERS)}
        {select("气氛", "mood", MOODS)}
        {select("人潮", "crowd", CROWD_LEVELS)}
        {select("灯火", "lanterns", LANTERN_LEVELS)}
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <span style={{ width: 56 }}>要角</span>
          <select
            multiple
            value={directive.focusNpcIds}
            onChange={(e) =>
              set({ focusNpcIds: [...e.target.selectedOptions].map((o) => o.value).slice(0, 3) as SceneDirective["focusNpcIds"] })
            }
            style={{ flex: 1, height: 64 }}
          >
            {NPC_IDS.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <div style={{ fontSize: 12, opacity: 0.9 }}>
          drawCalls {stats.drawCalls} · tris {(stats.triangles / 1000).toFixed(1)}k · fps {stats.fps.toFixed(0)}
        </div>
        <button className="btn-ghost" style={{ fontSize: 13, padding: "6px 0" }} onClick={screenshot}>
          截图
        </button>
      </div>
    </div>
  );
}
