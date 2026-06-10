/**
 * Festival lanterns: one InstancedMesh of 60 low-poly paper lanterns
 * (per-instance warm gold/red via instanceColor), hung from sagging strings
 * between the building rows plus stall posts, the teahouse porch, the gate
 * parapet and shop doors. Strings are thin merged boxes (1 draw call).
 * Six hero warm PointLights pool light on the street; per-frame flicker.
 * Visible lantern count is driven by the directive lantern level via .count
 * (instances are golden-ratio shuffled so any prefix spans the street).
 */
import * as THREE from "three";
import type { LanternLevel } from "@shared/constants";
import { PALETTE, type SceneMaterials, colorize, makeRng, mergeAll } from "./materials";
import { STRING_X, STRING_Y } from "./buildings";
import { STALLS } from "./stalls";

export const LANTERN_COUNTS: Record<LanternLevel, number> = {
  none: 0,
  dim: 18,
  bright: 40,
  festival: 60,
};

/** Hero point-light scale per lantern level (× lighting preset lanternBase). */
export const LANTERN_LIGHT_FACTOR: Record<LanternLevel, number> = {
  none: 0,
  dim: 0.5,
  bright: 0.85,
  festival: 1.15,
};

const STRING_ZS = [-13.5, -10.5, -7.5, -4.5, -1.5, 1.5, 4.5] as const;
const HANG_XS = [-3.6, -2.16, -0.72, 0.72, 2.16, 3.6] as const;
const SAG = 0.42;
const STRING_SEGMENTS = 8;
const STRING_COLOR = 0x3a3128;
const LANTERN_RED = 0xe0512f;
const LANTERN_GOLD = 0xffc270;
const LIGHT_POWER = 11;

const LIGHT_SPOTS: readonly [number, number, number][] = [
  [3.6, 2.1, 1.2], // teahouse porch
  [-3.4, 2.0, -4.0], // west stall row
  [3.4, 2.0, -6.3], // east stall row
  [-3.5, 2.0, 0.6], // west stalls near the cross
  [0, 3.1, -9.8], // mid-street string
  [0.4, 3.4, -13.6], // gate approach
];

/** Sagging cross-street string height at offset x. */
function stringY(x: number): number {
  return STRING_Y - SAG * (1 - (x / STRING_X) ** 2);
}

interface LanternSpot {
  x: number;
  y: number; // lantern center
  z: number;
}

const AXIS_X = new THREE.Vector3(1, 0, 0);
const tmpDir = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();

/** Thin box strand between two points (lantern string / drop). */
function strand(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
): THREE.BufferGeometry {
  tmpDir.set(x2 - x1, y2 - y1, z2 - z1);
  const len = tmpDir.length();
  const g = new THREE.BoxGeometry(Math.max(len, 0.02), 0.016, 0.016);
  g.applyQuaternion(tmpQuat.setFromUnitVectors(AXIS_X, tmpDir.normalize()));
  g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  return colorize(g, STRING_COLOR, 0.9);
}

export class Lanterns {
  readonly group = new THREE.Group();

  /** Tween target: hero light base (preset lanternBase × level factor × boost). */
  base = 1.0;
  /** Tween target: flicker amplitude multiplier (mood "tense" → 1.8). */
  flickerAmp = 1.0;

  private readonly mesh: THREE.InstancedMesh;
  private readonly strings: THREE.Mesh;
  private readonly lights: THREE.PointLight[];
  private readonly total: number;

  constructor(materials: SceneMaterials) {
    const rng = makeRng(15170);
    const stringParts: THREE.BufferGeometry[] = [];
    const spots: LanternSpot[] = [];

    // Cross-street strings: piecewise segments + a drop per lantern.
    for (const z of STRING_ZS) {
      for (let s = 0; s < STRING_SEGMENTS; s++) {
        const xa = -STRING_X + (2 * STRING_X * s) / STRING_SEGMENTS;
        const xb = -STRING_X + (2 * STRING_X * (s + 1)) / STRING_SEGMENTS;
        stringParts.push(strand(xa, stringY(xa), z, xb, stringY(xb), z));
      }
      for (const x of HANG_XS) {
        const top = stringY(x);
        stringParts.push(strand(x, top, z, x, top - 0.16, z));
        spots.push({ x, y: top - 0.35, z });
      }
    }

    // One lantern at each stall's front-corner post (local +x faces street).
    for (const stall of STALLS) {
      const cos = Math.cos(stall.rot);
      const sin = Math.sin(stall.rot);
      const lx = 0.72;
      const lz = 1.05;
      const x = stall.x + lx * cos + lz * sin;
      const z = stall.z - lx * sin + lz * cos;
      stringParts.push(strand(x, 1.64, z, x, 1.52, z));
      spots.push({ x, y: 1.33, z });
    }

    // Teahouse porch eaves.
    for (const z of [-1.5, 0.5, 1.9]) {
      stringParts.push(strand(4.05, 2.52, z, 4.05, 2.42, z));
      spots.push({ x: 4.05, y: 2.23, z });
    }

    // Gate tower parapet front.
    for (const x of [-3.0, -1.0, 1.0, 3.0]) {
      stringParts.push(strand(x, 4.5, -13.85, x, 4.3, -13.85));
      spots.push({ x, y: 4.1, z: -13.85 });
    }

    // Shop door lanterns (over door positions from buildings.ts HOUSES).
    for (const [side, z] of [
      [-1, -8.735], [-1, 2.3], [1, -8.3], [1, 6.265],
    ] as const) {
      const x = side * 4.45;
      stringParts.push(strand(x, 2.6, z, x, 2.5, z));
      spots.push({ x, y: 2.31, z });
    }

    this.total = spots.length; // 7*6 + 7 + 3 + 4 + 4 = 60

    // Golden-ratio shuffle: any .count prefix is spread across the street.
    const ordered = spots
      .map((spot, i) => ({ spot, key: (i * 0.61803398875) % 1 }))
      .sort((a, b) => a.key - b.key)
      .map((e) => e.spot);

    const geo = new THREE.SphereGeometry(0.17, 6, 5);
    geo.scale(1, 1.12, 1);
    this.mesh = new THREE.InstancedMesh(geo, materials.lanternPaper, this.total);
    this.mesh.frustumCulled = false;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const c = new THREE.Color();
    ordered.forEach((spot, i) => {
      const s = 0.85 + rng() * 0.25;
      m.compose(p.set(spot.x, spot.y, spot.z), q, sc.set(s, s, s));
      this.mesh.setMatrixAt(i, m);
      const red = rng() < 0.28;
      c.setHex(red ? LANTERN_RED : LANTERN_GOLD).multiplyScalar(0.88 + rng() * 0.18);
      this.mesh.setColorAt(i, c);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.strings = new THREE.Mesh(mergeAll(stringParts), materials.vertexLambert);
    this.strings.matrixAutoUpdate = false;

    this.lights = LIGHT_SPOTS.map(([x, y, z]) => {
      const light = new THREE.PointLight(PALETTE.lanternWarm, 0, 7, 2);
      light.position.set(x, y, z);
      return light;
    });

    this.group.add(this.mesh, this.strings, ...this.lights);
  }

  get count(): number {
    return this.mesh.count;
  }

  setCount(n: number): void {
    this.mesh.count = Math.max(0, Math.min(this.total, n));
  }

  /** Per-frame flicker: intensity = base * (0.92 + 0.08·sin(7t+i)·sin(13t+i·1.7)). */
  update(timeSec: number): void {
    this.lights.forEach((light, i) => {
      const flicker =
        0.92 + 0.08 * this.flickerAmp * Math.sin(7 * timeSec + i) * Math.sin(13 * timeSec + i * 1.7);
      light.intensity = LIGHT_POWER * this.base * flicker;
    });
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.strings.geometry.dispose();
    for (const light of this.lights) light.dispose();
  }
}
