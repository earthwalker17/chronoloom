import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EngineId, IdentityId } from "@shared/constants";
import type { LifeReport, MetaResponse, ProviderInfo, SceneDirective, SessionView } from "@shared/types";
import { api, savedSession } from "./api";
import { ReportForging } from "./components/ReportForging";
import { SceneCanvas } from "./components/SceneCanvas";
import { platesStore } from "./platesStore";
import { DevScene } from "./screens/DevScene";
import { EraIntro } from "./screens/EraIntro";
import { IdentitySelect } from "./screens/IdentitySelect";
import { Landing } from "./screens/Landing";
import { Play, type SceneCtl } from "./screens/Play";
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
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState<EngineId>("scripted");
  const [view, setView] = useState<SessionView | null>(null);
  const [report, setReport] = useState<LifeReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [resumable, setResumable] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // --- scene-native interaction channels (Play drives, SceneCanvas applies) ---
  const [highlights, setHighlights] = useState<string[]>([]);
  const [talking, setTalking] = useState<string | null>(null);
  const [approach, setApproach] = useState<{ npcId: string | null; seq: number }>({ npcId: null, seq: 0 });
  const pickRef = useRef<(npcId: string | null) => void>(() => {});
  const sceneCtl = useMemo<SceneCtl>(
    () => ({
      setHighlights,
      setTalking,
      approach: (npcId) => setApproach((s) => ({ npcId, seq: s.seq + 1 })),
      registerPick: (fn) => {
        pickRef.current = fn;
      },
    }),
    [],
  );

  // --- report prefetch: fire the idempotent POST the moment a life finishes ---
  const reportPromiseRef = useRef<{ id: string; promise: Promise<LifeReport> } | null>(null);
  const fetchReport = useCallback((id: string): Promise<LifeReport> => {
    if (reportPromiseRef.current?.id !== id) reportPromiseRef.current = null;
    if (!reportPromiseRef.current) {
      const promise = api.getReport(id).then((r) => r.report);
      reportPromiseRef.current = { id, promise };
      promise.catch(() => {
        // allow retry on the next call
        if (reportPromiseRef.current?.id === id) reportPromiseRef.current = null;
      });
    }
    return reportPromiseRef.current.promise;
  }, []);

  useEffect(() => {
    if (view?.finished) {
      // Forge the 命书 in the background while the player reads the ending.
      fetchReport(view.id).catch(() => {});
    }
  }, [view?.finished, view?.id, fetchReport]);

  useEffect(() => {
    api.meta().then(setMeta).catch(console.error);
    api
      .health()
      .then((h) => {
        setProviders(h.providers);
        setProvider(h.engine);
      })
      .catch(console.error);
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

  const startLife = useCallback(
    async (identityId: IdentityId) => {
      setCreating(true);
      try {
        const v = await api.createSession(identityId, provider);
        savedSession.set(v.id);
        setView(v);
        setReport(null);
        setPhase("play");
      } finally {
        setCreating(false);
      }
    },
    [provider],
  );

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
    setReportError(null);
    setPhase("report");
    try {
      setReport(await fetchReport(view.id));
    } catch {
      setReportError("命书未成，请再试一次");
    }
  }, [view, fetchReport]);

  const rebirth = useCallback(() => {
    savedSession.clear();
    reportPromiseRef.current = null;
    setView(null);
    setReport(null);
    setReportError(null);
    setResumable(null);
    setPhase("identity");
  }, []);

  if (devMode) return <DevScene />;

  const playing = phase === "play" && view !== null;
  const directive = playing && view ? view.scene.directive : LANDING_DIRECTIVE;
  const dimmed = phase !== "play";

  return (
    <div className="app-root">
      <SceneCanvas
        directive={directive}
        focusNames={view && playing ? Object.fromEntries(view.npcs.map((n) => [n.id, n.nameZh])) : {}}
        paused={phase === "report"}
        protagonist={playing && view ? view.identityId : null}
        highlights={playing ? highlights : []}
        talkingNpcId={playing ? talking : null}
        approach={approach}
        onPick={(hit) => pickRef.current(hit?.kind === "npc" ? hit.npcId : null)}
        onPlates={(p) => platesStore.publish(p)}
      />
      <div className="vignette" />
      {dimmed && <div className="screen screen-dim" style={{ pointerEvents: "none", zIndex: 2 }} />}

      {phase === "landing" && (
        <Landing
          providers={providers}
          selected={provider}
          onSelectProvider={setProvider}
          canResume={resumable !== null}
          onEnter={() => setPhase("intro")}
          onResume={() => void resumeLife().catch(console.error)}
        />
      )}
      {phase === "intro" && meta && <EraIntro era={meta.era} onNext={() => setPhase("identity")} />}
      {phase === "identity" && meta && (
        <IdentitySelect identities={meta.identities} busy={creating} onConfirm={(id) => void startLife(id)} />
      )}
      {phase === "play" && view && (
        <Play view={view} onView={setView} onOpenReport={() => void openReport()} sceneCtl={sceneCtl} />
      )}
      {phase === "report" && view && report && <Report view={view} report={report} onRebirth={rebirth} />}
      {phase === "report" && !report && <ReportForging error={reportError} onRetry={() => void openReport()} />}
    </div>
  );
}
