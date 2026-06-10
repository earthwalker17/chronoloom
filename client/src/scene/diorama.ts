/**
 * Orchestrator and the ONLY public entry point for the Chang'an diorama.
 * Owns the requestAnimationFrame loop, drives every module's per-frame
 * update, and emits nameplate screen positions each frame.
 *
 * Draw-call audit (worst case: night + festival + packed + 3 heroes):
 *   sky 1, ground 1, buildings 2 (opaque + window glow), gate tower 1,
 *   stalls 2 (solids + awnings), props 1, lanterns 2 (instanced + strings),
 *   banners 1, crowd 1 (instanced) + hero bodies 3 + markers 3, particles 1
 *   → ~19 draw calls observed, ~25–30 expected ceiling, ≤40 budget.
 * Triangles ≈ 15–20k (≤60k budget).
 */
import type { SceneDirective } from "@shared/types";
import { createRenderer } from "./renderer";
import { createMaterials } from "./materials";
import { createLights } from "./lighting";
import { CameraRig } from "./cameraRig";
import { createGround } from "./ground";
import { createBuildings } from "./buildings";
import { createGateTower } from "./gateTower";
import { createStalls } from "./stalls";
import { createProps } from "./props";
import { Lanterns } from "./lanterns";
import { Banners } from "./banners";
import { Crowd } from "./crowd";
import { Particles } from "./particles";
import { projectNameplates, type NameplatePos } from "./nameplates";
import { Tweener } from "./tween";
import { DirectiveMapper } from "./directiveMapper";

export type { NameplatePos } from "./nameplates";

export interface DioramaHandle {
  /** Tween every scene channel toward the directive. Retarget-safe mid-tween. */
  applyDirective(d: SceneDirective, ms?: number): void;
  resize(width: number, height: number): void;
  onNameplates(cb: (plates: NameplatePos[]) => void): void;
  setRunning(running: boolean): void;
  info(): { drawCalls: number; triangles: number; fps: number };
  /** PNG data URL of the current frame (renderer keeps the drawing buffer). */
  screenshot(): string;
  dispose(): void;
}

/** Hero shot until the first real directive arrives: 上元夜, festival, packed. */
const DEFAULT_DIRECTIVE: SceneDirective = {
  locationId: "market_cross",
  timeOfDay: "night",
  weather: "clear",
  mood: "festive",
  crowd: "packed",
  lanterns: "festival",
  focusNpcIds: [],
};

export function initDiorama(canvas: HTMLCanvasElement): DioramaHandle {
  const bundle = createRenderer(canvas);
  const materials = createMaterials();

  let cssW = canvas.clientWidth || 960;
  let cssH = canvas.clientHeight || 540;
  bundle.renderer.setSize(cssW, cssH, false);

  const rig = new CameraRig(cssW / cssH);
  const lights = createLights(bundle.scene);

  const ground = createGround(materials);
  const buildings = createBuildings(materials);
  const gate = createGateTower(materials);
  const stalls = createStalls(materials);
  const props = createProps(materials);
  const lanterns = new Lanterns(materials);
  const banners = new Banners(materials);
  const crowd = new Crowd(materials);
  const particles = new Particles();

  const staticMeshes = [
    ground,
    buildings.mesh,
    buildings.glowMesh,
    gate,
    stalls.solidMesh,
    stalls.awningMesh,
    props,
  ];
  bundle.scene.add(...staticMeshes, lanterns.group, banners.mesh, crowd.group, particles.points);

  const tweener = new Tweener();
  const mapper = new DirectiveMapper({
    tweener,
    renderer: bundle.renderer,
    fog: bundle.fog,
    skyUniforms: bundle.skyUniforms,
    lights,
    rig,
    materials,
    lanterns,
    banners,
    crowd,
    particles,
  });
  mapper.apply(DEFAULT_DIRECTIVE, 0);

  let nameplateCb: ((plates: NameplatePos[]) => void) | null = null;
  let running = false;
  let disposed = false;
  let rafId = 0;
  let last = performance.now();
  let animTime = 0;
  let fps = 60;

  const renderFrame = (): void => {
    bundle.renderer.render(bundle.scene, rig.camera);
  };

  const frame = (now: number): void => {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (dt > 0) fps += (1 / dt - fps) * 0.08; // rolling FPS
    animTime += dt;

    tweener.update(now);
    rig.update(animTime, dt); // includes ±0.08u idle drift + ominous push-in
    lanterns.update(animTime);
    banners.update(animTime);
    crowd.update(animTime);
    particles.update(animTime);

    renderFrame();
    if (nameplateCb) nameplateCb(projectNameplates(rig.camera, crowd.getAnchors(), cssW, cssH));
  };

  const setRunning = (run: boolean): void => {
    if (disposed || run === running) return;
    running = run;
    if (run) {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(rafId);
    }
  };
  setRunning(true);

  return {
    applyDirective(d, ms = 1800) {
      if (!disposed) mapper.apply(d, ms);
    },

    resize(width, height) {
      if (disposed || width <= 0 || height <= 0) return;
      cssW = width;
      cssH = height;
      bundle.renderer.setSize(width, height, false);
      rig.resize(width / height);
    },

    onNameplates(cb) {
      nameplateCb = cb;
    },

    setRunning,

    info() {
      const r = bundle.renderer.info.render;
      return { drawCalls: r.calls, triangles: r.triangles, fps: Math.round(fps) };
    },

    screenshot() {
      renderFrame(); // guarantee a fresh frame even while paused
      return bundle.renderer.domElement.toDataURL("image/png");
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (running) {
        cancelAnimationFrame(rafId);
        running = false;
      }
      nameplateCb = null;
      tweener.clear();
      for (const mesh of staticMeshes) mesh.geometry.dispose();
      lanterns.dispose();
      banners.dispose();
      crowd.dispose();
      particles.dispose();
      for (const m of materials.all) m.dispose();
      bundle.dispose();
    },
  };
}
