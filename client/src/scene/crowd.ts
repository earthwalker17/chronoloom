/**
 * Street crowd: one InstancedMesh of 24 cone-body + sphere-head figures with
 * muted per-instance hanfu colors and per-instance idle-bob phase. Visible
 * count is driven by the directive crowd level via .count (placement is
 * already random, so any prefix reads as a spread crowd).
 *
 * Plus 3 HERO figures at fixed anchor points (teahouse / stalls / gate):
 * slightly larger, own muted-rich color, a small floating emissive diamond
 * marker overhead. Shown/hidden by directive.focusNpcIds (first ≤3); their
 * world positions are the nameplate anchors.
 */
import * as THREE from "three";
import type { CrowdLevel } from "@shared/constants";
import { type SceneMaterials, colorize, makeRng, mergeAll } from "./materials";
import { STALLS } from "./stalls";
import type { NameplateAnchor } from "./nameplates";

export const CROWD_COUNTS: Record<CrowdLevel, number> = {
  sparse: 6,
  busy: 14,
  packed: 24,
};

const TOTAL = 24;
const HERO_SCALE = 1.18;
const MARKER_Y = 1.75;
const ANCHOR_Y = 2.0;

const HERO_SLOTS: readonly { x: number; z: number; yaw: number }[] = [
  { x: 3.05, z: 1.6, yaw: -2.0 }, // by the teahouse porch
  { x: -2.8, z: -4.6, yaw: 1.1 }, // by the west stall row
  { x: 0.9, z: -12.2, yaw: 0.4 }, // gate plaza
];
const HERO_COLORS = [0x7e4a3a, 0x3f5e63, 0x5a4a6e] as const;

const HANFU_COLORS = [
  0x8a7866, 0x70655a, 0x5c6470, 0x77694f,
  0x556052, 0x7d6a5e, 0x93836b, 0x4e5560,
] as const;

/** Merged cone body + sphere head, feet at y = 0. No color attribute. */
function figureGeometry(scale: number): THREE.BufferGeometry {
  const body = new THREE.ConeGeometry(0.23, 1.0, 7);
  body.translate(0, 0.5, 0);
  const head = new THREE.SphereGeometry(0.13, 7, 6);
  head.translate(0, 1.13, 0);
  const geo = mergeAll([body, head]);
  if (scale !== 1) geo.scale(scale, scale, scale);
  return geo;
}

interface CrowdEntry {
  x: number;
  z: number;
  phase: number;
  speed: number;
  quat: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface Hero {
  group: THREE.Group;
  body: THREE.Mesh;
  marker: THREE.Mesh;
  npcId: string | null;
  anchor: THREE.Vector3;
  phase: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpMat = new THREE.Matrix4();
const tmpPos = new THREE.Vector3();

export class Crowd {
  readonly group = new THREE.Group();

  private readonly mesh: THREE.InstancedMesh;
  private readonly entries: CrowdEntry[];
  private readonly heroes: Hero[];
  private readonly markerGeo: THREE.OctahedronGeometry;

  constructor(materials: SceneMaterials) {
    const rng = makeRng(6021);

    // Keep figures off the stalls, hero anchors and props (well, handcart).
    const exclusions: { x: number; z: number; r: number }[] = [
      ...STALLS.map((s) => ({ x: s.x, z: s.z, r: 1.25 })),
      ...HERO_SLOTS.map((h) => ({ x: h.x, z: h.z, r: 0.9 })),
      { x: -2.3, z: 3.6, r: 1.1 }, // stone well (props.ts)
      { x: -2.7, z: 8.0, r: 1.2 }, // handcart (props.ts)
    ];

    this.entries = [];
    let guard = 0;
    while (this.entries.length < TOTAL && guard < 600) {
      guard++;
      const x = (rng() - 0.5) * 6.4;
      const z = -12.8 + rng() * 20.6;
      if (exclusions.some((e) => (x - e.x) ** 2 + (z - e.z) ** 2 < e.r * e.r)) continue;
      const s = 0.92 + rng() * 0.16;
      this.entries.push({
        x,
        z,
        phase: rng() * Math.PI * 2,
        speed: 1.6 + rng() * 1.2,
        quat: new THREE.Quaternion().setFromAxisAngle(UP, rng() * Math.PI * 2),
        scale: new THREE.Vector3(s, 0.95 + rng() * 0.14, s),
      });
    }

    this.mesh = new THREE.InstancedMesh(figureGeometry(1), materials.crowdWhite, TOTAL);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    this.entries.forEach((e, i) => {
      tmpMat.compose(tmpPos.set(e.x, 0, e.z), e.quat, e.scale);
      this.mesh.setMatrixAt(i, tmpMat);
      const hex = HANFU_COLORS[i % HANFU_COLORS.length] ?? 0x77694f;
      c.setHex(hex).multiplyScalar(0.85 + rng() * 0.3);
      this.mesh.setColorAt(i, c);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.group.add(this.mesh);

    this.markerGeo = new THREE.OctahedronGeometry(0.09);
    this.heroes = HERO_SLOTS.map((slot, i) => {
      const geo = colorize(figureGeometry(HERO_SCALE), HERO_COLORS[i] ?? 0x7e4a3a);
      const body = new THREE.Mesh(geo, materials.vertexLambert);
      const marker = new THREE.Mesh(this.markerGeo, materials.marker);
      marker.position.y = MARKER_Y;
      const group = new THREE.Group();
      group.add(body, marker);
      group.position.set(slot.x, 0, slot.z);
      group.rotation.y = slot.yaw;
      group.visible = false;
      this.group.add(group);
      return { group, body, marker, npcId: null, anchor: new THREE.Vector3(), phase: i * 2.1 };
    });
  }

  get count(): number {
    return this.mesh.count;
  }

  setCount(n: number): void {
    this.mesh.count = Math.max(0, Math.min(TOTAL, n));
  }

  /** First ≤3 npc ids claim the hero slots in order; the rest stay hidden. */
  setFocus(npcIds: readonly string[]): void {
    this.heroes.forEach((hero, i) => {
      const id = npcIds[i] ?? null;
      hero.npcId = id;
      hero.group.visible = id !== null;
    });
  }

  /** Nameplate anchors (above the marker) for the visible heroes. */
  getAnchors(): NameplateAnchor[] {
    const out: NameplateAnchor[] = [];
    for (const hero of this.heroes) {
      if (!hero.group.visible || hero.npcId === null) continue;
      hero.anchor.set(hero.group.position.x, hero.group.position.y + ANCHOR_Y, hero.group.position.z);
      out.push({ npcId: hero.npcId, position: hero.anchor });
    }
    return out;
  }

  /** Idle bob (per-instance phase) + hero bob and marker spin/float. */
  update(timeSec: number): void {
    this.entries.forEach((e, i) => {
      tmpPos.set(e.x, 0.02 + 0.02 * Math.sin(timeSec * e.speed + e.phase), e.z);
      tmpMat.compose(tmpPos, e.quat, e.scale);
      this.mesh.setMatrixAt(i, tmpMat);
    });
    this.mesh.instanceMatrix.needsUpdate = true;

    this.heroes.forEach((hero, i) => {
      hero.group.position.y = 0.025 + 0.025 * Math.sin(timeSec * 1.6 + hero.phase);
      hero.marker.rotation.y = timeSec * 1.3 + i;
      hero.marker.position.y = MARKER_Y + 0.07 * Math.sin(timeSec * 2.1 + i * 2.0);
    });
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.markerGeo.dispose();
    for (const hero of this.heroes) hero.body.geometry.dispose();
  }
}
