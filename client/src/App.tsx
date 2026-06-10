import { useCallback, useEffect, useState } from "react";
import type { IdentityId } from "@shared/constants";
import type { LifeReport, MetaResponse, SceneDirective, SessionView } from "@shared/types";
import { api, savedSession } from "./api";
import { SceneCanvas } from "./components/SceneCanvas";
import { DevScene } from "./screens/DevScene";
import { EraIntro } from "./screens/EraIntro";
import { IdentitySelect } from "./screens/IdentitySelect";
import { Landing } from "./screens/Landing";
import { Play } from "./screens/Play";
import { Report } from "./screens/Report";

type Phase = "landing" | "intro" | "identity" | "play" | "report";

const LANDING_DIRECTIVE: SceneDirective = {
  locationId: "market_cross",
  timeOfDay: "night",
  weather: "clear",
  mood: "festive",
  crowd: "busy",
  lanterns: "festival",
  focusNpcIds: [],
};

export function App() {
  const [devMode] = useState(() => window.location.hash === "#/dev/scene");
  const [phase, setPhase] = useState<Phase>("landing");
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [engine, setEngine] = useState<"claude" | "scripted">("scripted");
  const [view, setView] = useState<SessionView | null>(null);
  const [report, setReport] = useState<LifeReport | null>(null);
  const [resumable, setResumable] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(console.error);
    api.health().then((h) => setEngine(h.engine)).catch(console.error);
    // ?session=<id> jumps straight back into a life (shareable resume link).
    const fromUrl = new URLSearchParams(window.location.search).get("session");
    if (fromUrl) {
      savedSession.set(fromUrl);
      void (async () => {
        try {
          const v = await api.getSession(fromUrl);
          setView(v);
          if (v.finished && v.hasReport) {
            const { report } = await api.getReport(v.id);
            setReport(report);
            setPhase("report");
          } else {
            setPhase("play");
          }
        } catch {
          savedSession.clear();
        }
      })();
      return;
    }
    const saved = savedSession.get();
    if (saved) {
      api
        .getSession(saved)
        .then((v) => setResumable(v.finished ? null : saved))
        .catch(() => savedSession.clear());
    }
  }, []);

  const startLife = useCallback(async (identityId: IdentityId) => {
    setCreating(true);
    try {
      const v = await api.createSession(identityId);
      savedSession.set(v.id);
      setView(v);
      setReport(null);
      setPhase("play");
    } finally {
      setCreating(false);
    }
  }, []);

  const resumeLife = useCallback(async () => {
    const saved = savedSession.get();
    if (!saved) return;
    const v = await api.getSession(saved);
    setView(v);
    setPhase(v.finished && v.hasReport ? "report" : "play");
    if (v.finished && v.hasReport) {
      const { report } = await api.getReport(v.id);
      setReport(report);
    }
  }, []);

  const openReport = useCallback(async () => {
    if (!view) return;
    const { report } = await api.getReport(view.id);
    setReport(report);
    setPhase("report");
  }, [view]);

  const rebirth = useCallback(() => {
    savedSession.clear();
    setView(null);
    setReport(null);
    setResumable(null);
    setPhase("identity");
  }, []);

  if (devMode) return <DevScene />;

  const directive = phase === "play" && view ? view.scene.directive : LANDING_DIRECTIVE;
  const dimmed = phase !== "play";

  return (
    <div className="app-root">
      <SceneCanvas
        directive={directive}
        focusNames={view && phase === "play" ? Object.fromEntries(view.npcs.map((n) => [n.id, n.nameZh])) : {}}
        paused={phase === "report"}
      />
      <div className="vignette" />
      {dimmed && <div className="screen screen-dim" style={{ pointerEvents: "none", zIndex: 2 }} />}

      {phase === "landing" && (
        <Landing
          engine={engine}
          canResume={resumable !== null}
          onEnter={() => setPhase("intro")}
          onResume={() => void resumeLife().catch(console.error)}
        />
      )}
      {phase === "intro" && meta && <EraIntro era={meta.era} onNext={() => setPhase("identity")} />}
      {phase === "identity" && meta && (
        <IdentitySelect identities={meta.identities} busy={creating} onConfirm={(id) => void startLife(id)} />
      )}
      {phase === "play" && view && <Play view={view} onView={setView} onOpenReport={() => void openReport().catch(console.error)} />}
      {phase === "report" && view && report && <Report view={view} report={report} onRebirth={rebirth} />}
    </div>
  );
}
