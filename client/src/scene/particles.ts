/**
 * ONE THREE.Points buffer (~300 points) with three modes:
 *   petals — warm pink-white, slow drift with flutter (festive)
 *   dust   — faint, hugging the ground (windy)
 *   snow   — white steady fall (weather snow)
 * Positions are computed procedurally from per-particle seeds + time, so
 * mode switches need no re-simulation. sizeAttenuation on.
 */
import * as THREE from "three";
import { makeRng } from "./materials";

export type ParticleMode = "petals" | "dust" | "snow";

const COUNT = 300;
const AREA_W = 16; // x ∈ [-8, 8]
const AREA_D = 26; // z ∈ [AREA_Z0, AREA_Z0 + AREA_D]
const AREA_Z0 = -17;

interface ModeParams {
  color: number;
  size: number;
  opacity: number;
  yMin: number;
  yMax: number;
  /** Fall speed in units/sec; negative = slow rise (dust). */
  fall: number;
  sway: number;
  flutter: number;
}

const MODE_PARAMS: Record<ParticleMode, ModeParams> = {
  petals: { color: 0xf6cfc4, size: 0.085, opacity: 0.95, yMin: 0.15, yMax: 6.0, fall: 0.32, sway: 0.9, flutter: 0.35 },
  dust: { color: 0xbfae8a, size: 0.05, opacity: 0.26, yMin: 0.04, yMax: 1.8, fall: -0.07, sway: 1.3, flutter: 0.15 },
  snow: { color: 0xe9eef8, size: 0.07, opacity: 0.85, yMin: 0.0, yMax: 8.0, fall: 0.85, sway: 0.35, flutter: 0.1 },
};

interface Seed {
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
}

const wrap = (v: number, span: number): number => ((v % span) + span) % span;

export class Particles {
  readonly points: THREE.Points;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly seeds: Seed[];
  private mode: ParticleMode = "petals";

  constructor() {
    const rng = makeRng(9043);
    this.seeds = Array.from({ length: COUNT }, () => ({
      x: rng(),
      y: rng(),
      z: rng(),
      phase: rng() * Math.PI * 2,
      speed: 0.7 + rng() * 0.6,
    }));

    this.geometry = new THREE.BufferGeometry();
    const attr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
    attr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", attr);

    this.material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.applyModeParams();
  }

  setMode(mode: ParticleMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.applyModeParams();
  }

  setVisible(visible: boolean): void {
    this.points.visible = visible;
  }

  update(timeSec: number): void {
    if (!this.points.visible) return;
    const p = MODE_PARAMS[this.mode];
    const span = p.yMax - p.yMin;
    const attr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    this.seeds.forEach((s, i) => {
      const y = p.yMin + wrap(s.y * span - p.fall * s.speed * timeSec, span);
      const x =
        s.x * AREA_W - AREA_W / 2 +
        p.sway * Math.sin(timeSec * 0.5 * s.speed + s.phase) +
        p.flutter * Math.sin(timeSec * 1.9 + s.phase * 2.3);
      const z =
        s.z * AREA_D + AREA_Z0 +
        p.sway * 0.6 * Math.cos(timeSec * 0.4 * s.speed + s.phase * 1.4);
      attr.setXYZ(i, x, y, z);
    });
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private applyModeParams(): void {
    const p = MODE_PARAMS[this.mode];
    this.material.color.setHex(p.color);
    this.material.size = p.size;
    this.material.opacity = p.opacity;
  }
}
