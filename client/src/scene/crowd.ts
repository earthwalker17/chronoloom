/**
 * Street crowd: two InstancedMeshes of very low-poly humanoids (a standing
 * variant and a mid-stride walking variant, ~120 tris each) with muted
 * per-instance hanfu colors and per-instance idle-bob phase. Visible count is
 * driven by the directive crowd level, split proportionally across the two
 * variants (placement is already random, so any prefix reads as a spread
 * crowd). Named-NPC hero figures live in heroes.ts, not here.
 */
import * as THREE from "three";
import type { CrowdLevel } from "@shared/constants";
import { type SceneMaterials, makeRng, mergeAll } from "./materials";
import { STALLS } from "./stalls";
import { HERO_SLOTS } from "./heroes";

export const CROWD_COUNTS: Record<CrowdLevel, number> = {
  sparse: 6,
  busy: 14,
  packed: 24,
};

const TOTAL = 24;
const WALKER_RATIO = 1 / 3;

/**
 * Cheap merged humanoid (~120 tris): robe skirt, torso, head, arm stubs.
 * The walking variant shortens the robe over stride-spread legs and swings
 * the arm stubs. Feet at y = 0; faces +z. No color attribute — instanceColor
 * carries the hanfu tone.
 */
function humanGeometry(walking: boolean): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const hemY = walking ? 0.34 : 0.02;

  const skirt = new THREE.CylinderGeometry(0.13, 0.21, 0.62 - hemY * 0.5, 7);
  skirt.translate(0, hemY + (0.62 - hemY * 0.5) / 2, 0);
  parts.push(skirt);

  const torso = new THREE.CylinderGeometry(0.105, 0.135, 0.34, 7);
  torso.scale(1.25, 1, 0.8);
  torso.translate(0, 0.78, 0);
  parts.push(torso);

  const head = new THREE.SphereGeometry(0.095, 6, 5);
  head.translate(0, 1.08, 0);
  parts.push(head);

  // Hair mass (slightly darker would need vertex color; silhouette only).
  const hair = new THREE.SphereGeometry(0.1, 6, 4);
  hair.scale(1, 0.7, 1);
  hair.translate(0, 1.14, -0.015);
  parts.push(hair);

  // Arm stubs hanging from the shoulders; the walker swings them.
  for (const s of [-1, 1] as const) {
    const arm = new THREE.CylinderGeometry(0.035, 0.045, 0.4, 5);
    arm.translate(0, -0.2, 0);
    if (walking) arm.rotateX(s * 0.45);
    arm.rotateZ(s * -0.12);
    arm.translate(s * 0.155, 0.93, 0);
    parts.push(arm);
  }

  if (walking) {
    // Stride-spread legs under the shortened robe.
    for (const s of [-1, 1] as const) {
      const leg = new THREE.CylinderGeometry(0.04, 0.05, 0.38, 5);
      leg.translate(0, -0.19, 0);
      leg.rotateX(s * 0.35);
      leg.translate(s * 0.05, 0.38, 0);
      parts.push(leg);
    }
  }

  return mergeAll(parts);
}

interface CrowdEntry {
  x: number;
  z: number;
  phase: number;
  speed: number;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpMat = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();

interface Variant {
  mesh: THREE.InstancedMesh;
  entries: CrowdEntry[];
}

export class Crowd {
  readonly group = new THREE.Group();

  private readonly variants: Variant[];
  private visibleTotal = TOTAL;

  constructor(materials: SceneMaterials) {
    const rng = makeRng(6021);

    // Keep figures off the stalls, hero anchors and props (well, handcart).
    const exclusions: { x: number; z: number; r: number }[] = [
      ...STALLS.map((s) => ({ x: s.x, z: s.z, r: 1.25 })),
      ...HERO_SLOTS.map((h) => ({ x: h.x, z: h.z, r: 0.9 })),
      { x: -2.3, z: 3.6, r: 1.1 }, // stone well (props.ts)
      { x: -2.7, z: 8.0, r: 1.2 }, // handcart (props.ts)
    ];

    const placements: CrowdEntry[] = [];
    let guard = 0;
    while (placements.length < TOTAL && guard < 600) {
      guard++;
      const x = (rng() - 0.5) * 6.4;
      const z = -12.8 + rng() * 20.6;
      if (exclusions.some((e) => (x - e.x) ** 2 + (z - e.z) ** 2 < e.r * e.r)) continue;
      const s = 0.92 + rng() * 0.16;
      placements.push({
        x,
        z,
        phase: rng() * Math.PI * 2,
        speed: 1.6 + rng() * 1.2,
        quat: new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2),
        scale: new THREE.Vector3(s, 0.95 + rng() * 0.14, s),
      });
    }

    const walkerCount = Math.round(TOTAL * WALKER_RATIO);
    const split: [CrowdEntry[], CrowdEntry[]] = [
      placements.slice(walkerCount), // standing
      placements.slice(0, walkerCount), // walking
    ];

    const HANFU_COLORS = [
      0x8a7866, 0x70655a, 0x5c6470, 0x77694f,
      0x556052, 0x7d6a5e, 0x93836b, 0x4e5560,
    ] as const;

    const c = new THREE.Color();
    this.variants = split.map((entries, vi) => {
      const mesh = new THREE.InstancedMesh(humanGeometry(vi === 1), materials.crowdWhite, entries.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      entries.forEach((e, i) => {
        tmpMat.compose(tmpPos.set(e.x, 0, e.z), e.quat, e.scale);
        mesh.setMatrixAt(i, tmpMat);
        const hex = HANFU_COLORS[(i * 2 + vi) % HANFU_COLORS.length] ?? 0x77694f;
        c.setHex(hex).multiplyScalar(0.85 + rng() * 0.3);
        mesh.setColorAt(i, c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
      return { mesh, entries };
    });
  }

  get count(): number {
    return this.visibleTotal;
  }

  /** Split the visible count proportionally across the two variants. */
  setCount(n: number): void {
    this.visibleTotal = Math.max(0, Math.min(TOTAL, n));
    const standing = this.variants[0];
    const walking = this.variants[1];
    if (!standing || !walking) return;
    const walkers = Math.round(this.visibleTotal * WALKER_RATIO);
    walking.mesh.count = Math.min(walking.entries.length, walkers);
    standing.mesh.count = Math.min(standing.entries.length, this.visibleTotal - walking.mesh.count);
  }

  /** Idle bob via per-instance phase (walkers bob a touch faster). */
  update(timeSec: number): void {
    this.variants.forEach((v, vi) => {
      const rate = vi === 1 ? 1.35 : 1;
      v.entries.forEach((e, i) => {
        tmpPos.set(e.x, 0.02 + 0.02 * Math.sin(timeSec * e.speed * rate + e.phase), e.z);
        tmpMat.compose(tmpPos, e.quat, e.scale);
        v.mesh.setMatrixAt(i, tmpMat);
      });
      v.mesh.instanceMatrix.needsUpdate = true;
    });
  }

  dispose(): void {
    for (const v of this.variants) {
      v.mesh.geometry.dispose();
      v.mesh.dispose();
    }
  }
}
