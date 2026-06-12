/**
 * Hero rig manager: owns the 5 named-NPC humanoid rigs and the protagonist
 * rig (4 prebuilt identity variants, one visible at a time).
 *
 * Movement is per-frame steering (constant speed toward a destination), NOT
 * keyed tweens — retargeting mid-walk (new focus, new approach target, new
 * camera preset) just swaps the destination, so it can never glitch.
 *
 * Draw calls: each visible figure = 3 (merged body + armL + armR), plus one
 * octahedron marker per visible NPC. All idle variation uses the
 * deterministic PRNG in materials.ts with fixed seeds.
 */
import * as THREE from "three";
import type { IdentityId, PresetId } from "@shared/constants";
import { IDENTITY_IDS, NPC_IDS } from "@shared/constants";
import { type SceneMaterials, makeRng } from "./materials";
import { FIGURE_SPECS, buildFigure, type FigureRig } from "./figures";
import type { NameplateAnchor } from "./nameplates";

export interface PickTarget {
  npcId: string;
  object: THREE.Object3D;
}

/** The 3 hero slots (same world anchors the cone-era crowd used). */
export const HERO_SLOTS: readonly { x: number; z: number; yaw: number }[] = [
  { x: 3.05, z: 1.6, yaw: -2.0 }, // by the teahouse porch
  { x: -2.8, z: -4.6, yaw: 1.1 }, // by the west stall row
  { x: 0.9, z: -12.2, yaw: 0.4 }, // gate plaza
];

/** Where heroes appear from / retreat to when (un)focused, per slot. */
const SLOT_SPAWNS: readonly { x: number; z: number }[] = [
  { x: 2.75, z: -0.9 },  // up the street, clear of stalls and barrels
  { x: -2.0, z: -7.6 },  // between the west stalls
  { x: 0.0, z: -14.9 },  // through the gate arch
];

/**
 * Protagonist idle anchor per camera preset: a camera-side foreground spot
 * (~3 units ahead of the lens, slightly off axis) so the player figure stays
 * in frame at every location. Yaw faces into the scene. All spots verified
 * against stall / prop / hero-slot footprints.
 */
export const PROTAGONIST_ANCHORS: Record<PresetId, { x: number; z: number; yaw: number }> = {
  market_street: { x: -0.9, z: 5.2, yaw: Math.PI },
  stall_row: { x: -1.2, z: 2.4, yaw: 2.55 },
  teahouse_porch: { x: 2.3, z: 0.4, yaw: -2.5 },
  gate_plaza: { x: -2.4, z: -8.4, yaw: 0.3 },
  back_alley: { x: -6.4, z: -2.4, yaw: 2.23 },
};

const WALK_SPEED = 1.5;       // u/s
const STRIDE_FREQ = 4.6;      // stride phase per unit walked
const ARRIVE_EPS = 0.04;
const APPROACH_DIST = 1.2;
const EASE = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);
const WARM = new THREE.Color(0xffb45c);

interface Actor {
  rig: FigureRig;
  mat: THREE.MeshLambertMaterial; // per-actor so brighten/glow is per-figure
  yaw: number;
  dest: THREE.Vector3 | null;
  arriveYaw: number | null;       // settle yaw when no faceTarget
  faceTarget: THREE.Vector3 | null;
  hideOnArrive: boolean;
  stride: number;
  moveW: number;                  // eased walk weight 0..1
  talkW: number;
  hlW: number;
  hoverW: number;
  // deterministic idle character
  bobPhase: number;
  swayPhase: number;
  headPhase: number;
  headRate: number;
}

interface NpcActor extends Actor {
  npcId: string;
  marker: THREE.Mesh;
  proxy: THREE.Mesh;
  slotIndex: number; // -1 = unplaced
  anchor: THREE.Vector3;
}

const tmpV = new THREE.Vector3();

function shortestAngle(a: number): number {
  return THREE.MathUtils.euclideanModulo(a + Math.PI, Math.PI * 2) - Math.PI;
}

export class Heroes {
  readonly group = new THREE.Group();

  private readonly npcs = new Map<string, NpcActor>();
  private readonly markerGeo = new THREE.OctahedronGeometry(0.09);
  private readonly proxyGeo: THREE.CylinderGeometry;
  private readonly proxyMat: THREE.MeshBasicMaterial;

  private readonly protaRigs = new Map<IdentityId, FigureRig>();
  private readonly protaMat: THREE.MeshLambertMaterial;
  private prota: Actor | null = null; // animation state survives variant swaps
  private protaId: IdentityId | null = null;
  private approachId: string | null = null;
  private preset: PresetId = "market_street";

  private highlights = new Set<string>();
  private talkingId: string | null = null;
  private hoverId: string | null = null;

  constructor(materials: SceneMaterials) {
    const rng = makeRng(4127);
    this.proxyGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.1, 8);
    this.proxyGeo.translate(0, 1.05, 0);
    this.proxyMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

    for (const npcId of NPC_IDS) {
      const spec = FIGURE_SPECS[npcId];
      const mat = materials.vertexLambert.clone();
      const rig = buildFigure(spec, mat);
      rig.group.visible = false;
      this.group.add(rig.group);

      const marker = new THREE.Mesh(this.markerGeo, materials.marker);
      marker.position.y = rig.height + 0.28;
      rig.group.add(marker);

      const proxy = new THREE.Mesh(this.proxyGeo, this.proxyMat);
      proxy.visible = false; // never rendered; raycaster still hits it
      proxy.userData["npcId"] = npcId;
      rig.group.add(proxy);

      this.npcs.set(npcId, {
        npcId, rig, mat, marker, proxy,
        yaw: 0, dest: null, arriveYaw: null, faceTarget: null, hideOnArrive: false,
        stride: 0, moveW: 0, talkW: 0, hlW: 0, hoverW: 0,
        bobPhase: rng() * Math.PI * 2,
        swayPhase: rng() * Math.PI * 2,
        headPhase: rng() * Math.PI * 2,
        headRate: 0.16 + rng() * 0.1,
        slotIndex: -1,
        anchor: new THREE.Vector3(),
      });
    }

    this.protaMat = materials.vertexLambert.clone();
    for (const id of IDENTITY_IDS) {
      const rig = buildFigure(FIGURE_SPECS[id], this.protaMat);
      rig.group.visible = false;
      this.group.add(rig.group);
      this.protaRigs.set(id, rig);
    }
  }

  // -------------------------------------------------------------------------
  // Directive-driven state
  // -------------------------------------------------------------------------

  /** First ≤3 npc ids claim the slots in order; everyone else walks out. */
  setFocus(npcIds: readonly string[]): void {
    const assigned = new Map<string, number>();
    npcIds.slice(0, 3).forEach((id, i) => assigned.set(id, i));

    for (const actor of this.npcs.values()) {
      const slotIndex = assigned.get(actor.npcId);
      if (slotIndex === undefined) {
        if (actor.rig.group.visible && !actor.hideOnArrive) {
          const spawn = SLOT_SPAWNS[actor.slotIndex >= 0 ? actor.slotIndex : 0] ?? SLOT_SPAWNS[0];
          if (spawn) this.send(actor, spawn.x, spawn.z, null, true);
        }
        actor.slotIndex = -1;
        continue;
      }
      const slot = HERO_SLOTS[slotIndex];
      if (!slot) continue;
      const sameSlot = actor.slotIndex === slotIndex && actor.rig.group.visible && !actor.hideOnArrive;
      actor.slotIndex = slotIndex;
      if (sameSlot && actor.dest === null) continue; // already idle there
      if (!actor.rig.group.visible) {
        // Enter from the slot's spawn point. (If currently walking OUT we are
        // still visible — just retarget back to the slot from where we stand.)
        const spawn = SLOT_SPAWNS[slotIndex] ?? { x: slot.x, z: slot.z };
        actor.rig.group.position.set(spawn.x, 0, spawn.z);
        actor.rig.group.visible = true;
      }
      this.send(actor, slot.x, slot.z, slot.yaw, false);
    }
  }

  /** Camera preset changed: the protagonist drifts to that preset's anchor. */
  setLocationPreset(preset: PresetId): void {
    if (preset === this.preset) return;
    this.preset = preset;
    if (this.prota && this.protaId !== null && this.approachId === null) {
      this.sendProtaHome(false);
    }
  }

  // -------------------------------------------------------------------------
  // Interaction state (DioramaHandle surface)
  // -------------------------------------------------------------------------

  setHighlights(npcIds: readonly string[]): void {
    this.highlights = new Set(npcIds);
  }

  setTalking(npcId: string | null): void {
    this.talkingId = npcId;
  }

  setHover(npcId: string | null): void {
    this.hoverId = npcId;
  }

  setProtagonist(identityId: string | null): void {
    const id = identityId !== null && (IDENTITY_IDS as readonly string[]).includes(identityId)
      ? (identityId as IdentityId)
      : null;
    if (id === this.protaId) return;

    const prevRig = this.protaId !== null ? this.protaRigs.get(this.protaId) : undefined;
    if (prevRig) prevRig.group.visible = false;
    this.protaId = id;
    if (id === null) {
      this.prota = null;
      this.approachId = null;
      return;
    }

    const rig = this.protaRigs.get(id);
    if (!rig) return;
    const anchor = PROTAGONIST_ANCHORS[this.preset];
    if (prevRig && this.prota) {
      // Mid-scene identity swap: keep position, walk state and yaw.
      rig.group.position.copy(prevRig.group.position);
      this.prota.rig = rig;
    } else {
      rig.group.position.set(anchor.x, 0, anchor.z);
      this.prota = {
        rig, mat: this.protaMat,
        yaw: anchor.yaw, dest: null, arriveYaw: null, faceTarget: null, hideOnArrive: false,
        stride: 0, moveW: 0, talkW: 0, hlW: 0, hoverW: 0,
        bobPhase: 0.7, swayPhase: 2.3, headPhase: 4.1, headRate: 0.14,
      };
      this.approachId = null;
    }
    rig.group.rotation.set(0, this.prota.yaw, 0);
    rig.group.visible = true;
  }

  /** Walk to ~1.2u from that hero and face them; null = walk home. */
  protagonistApproach(npcId: string | null): void {
    if (!this.prota || this.protaId === null) return;
    if (npcId === null) {
      this.approachId = null;
      this.sendProtaHome(false);
      return;
    }
    const target = this.npcs.get(npcId);
    if (!target || !target.rig.group.visible) return; // only visible heroes
    this.approachId = npcId;
    // Stand-point: APPROACH_DIST out from the hero, on the protagonist's side.
    const hp = target.dest ?? target.rig.group.position; // settle point if walking
    tmpV.copy(this.prota.rig.group.position).sub(hp);
    tmpV.y = 0;
    if (tmpV.lengthSq() < 1e-4) tmpV.set(0, 0, 1);
    tmpV.normalize().multiplyScalar(APPROACH_DIST);
    const sx = hp.x + tmpV.x;
    const sz = hp.z + tmpV.z;
    this.send(this.prota, sx, sz, null, false);
    this.prota.faceTarget = new THREE.Vector3(hp.x, 0, hp.z);
  }

  private sendProtaHome(snap: boolean): void {
    if (!this.prota) return;
    const anchor = PROTAGONIST_ANCHORS[this.preset];
    if (snap) {
      this.prota.rig.group.position.set(anchor.x, 0, anchor.z);
      this.prota.dest = null;
      this.prota.yaw = anchor.yaw;
    } else {
      this.send(this.prota, anchor.x, anchor.z, anchor.yaw, false);
    }
  }

  private send(actor: Actor, x: number, z: number, arriveYaw: number | null, hideOnArrive: boolean): void {
    actor.dest = (actor.dest ?? new THREE.Vector3()).set(x, 0, z);
    actor.arriveYaw = arriveYaw;
    actor.faceTarget = null;
    actor.hideOnArrive = hideOnArrive;
  }

  // -------------------------------------------------------------------------
  // Read access for nameplates and picking
  // -------------------------------------------------------------------------

  /** Nameplate anchors above the heads of visible heroes (frozen shape). */
  getAnchors(): NameplateAnchor[] {
    const out: NameplateAnchor[] = [];
    for (const a of this.npcs.values()) {
      if (!a.rig.group.visible || a.hideOnArrive) continue;
      const p = a.rig.group.position;
      a.anchor.set(p.x, p.y + a.rig.height + 0.55, p.z);
      out.push({ npcId: a.npcId, position: a.anchor });
    }
    return out;
  }

  /** Invisible fat-cylinder hit proxies of visible heroes (no protagonist). */
  getPickTargets(): PickTarget[] {
    const out: PickTarget[] = [];
    for (const a of this.npcs.values()) {
      if (!a.rig.group.visible || a.hideOnArrive) continue;
      out.push({ npcId: a.npcId, object: a.proxy });
    }
    return out;
  }

  isHighlighted(npcId: string): boolean {
    return this.highlights.has(npcId);
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  update(time: number, dt: number): void {
    for (const a of this.npcs.values()) {
      if (!a.rig.group.visible) continue;
      this.step(a, time, dt);
      this.animateNpc(a, time, dt);
    }
    if (this.prota && this.protaId !== null) {
      // Keep tracking a hero that is still walking to its slot.
      if (this.approachId !== null) this.retargetApproach();
      this.step(this.prota, time, dt);
    }
  }

  /** Steering walk + shared idle/talk/walk body animation for one actor. */
  private step(a: Actor, time: number, dt: number): void {
    const g = a.rig.group;

    // --- locomotion ---------------------------------------------------------
    let moving = false;
    if (a.dest) {
      tmpV.copy(a.dest).sub(g.position);
      tmpV.y = 0;
      const dist = tmpV.length();
      if (dist <= ARRIVE_EPS) {
        g.position.x = a.dest.x;
        g.position.z = a.dest.z;
        a.dest = null;
        if (a.hideOnArrive) {
          g.visible = false;
          a.hideOnArrive = false;
          return;
        }
      } else {
        moving = true;
        const stepLen = Math.min(dist, WALK_SPEED * dt);
        tmpV.normalize();
        a.yaw += shortestAngle(Math.atan2(tmpV.x, tmpV.z) - a.yaw) * EASE(10, dt);
        g.position.addScaledVector(tmpV, stepLen);
        a.stride += stepLen * STRIDE_FREQ;
      }
    }
    if (!moving) {
      if (a.faceTarget) {
        const ty = Math.atan2(a.faceTarget.x - g.position.x, a.faceTarget.z - g.position.z);
        a.yaw += shortestAngle(ty - a.yaw) * EASE(6, dt);
      } else if (a.arriveYaw !== null) {
        a.yaw += shortestAngle(a.arriveYaw - a.yaw) * EASE(6, dt);
      }
    }
    a.moveW += ((moving ? 1 : 0) - a.moveW) * EASE(8, dt);
    a.talkW += ((this.isTalking(a) ? 1 : 0) - a.talkW) * EASE(6, dt);

    // --- body animation -------------------------------------------------------
    // Idle: breath bob + occasional slow "head turn" (subtle whole-figure yaw —
    // the head is merged into the body geometry by the draw-call budget).
    const idleW = 1 - a.moveW;
    const headTurn = idleW * 0.13 * Math.sin(time * a.headRate + a.headPhase) *
      Math.max(0, Math.sin(time * a.headRate * 0.37 + a.swayPhase)); // dwells, then turns
    g.rotation.y = a.yaw + headTurn;
    g.rotation.z = a.moveW * 0.03 * Math.sin(a.stride); // walk rock
    g.position.y =
      idleW * 0.012 * Math.sin(time * 1.7 + a.bobPhase) +
      a.moveW * 0.03 * Math.abs(Math.sin(a.stride)) +
      a.talkW * 0.012 * Math.sin(time * 3.4);

    // Arms: rest pose + walk swing (opposite phases) + talking gesture
    // (right forearm raised, gently beating time) — pivot rotation only.
    const swing = a.moveW * 0.55;
    const rig = a.rig;
    const talkRaise = a.talkW * (-0.85 + 0.14 * Math.sin(time * 4.2));
    const talkSide = a.talkW * -0.18;
    rig.armL.rotation.x = rig.rest.l.x + swing * rig.swing.l * Math.sin(a.stride);
    rig.armL.rotation.z = rig.rest.l.z;
    rig.armR.rotation.x =
      rig.rest.r.x * (1 - a.talkW) + talkRaise + swing * rig.swing.r * Math.sin(a.stride + Math.PI);
    rig.armR.rotation.z = rig.rest.r.z + talkSide;
  }

  private isTalking(a: Actor): boolean {
    return "npcId" in a && (a as NpcActor).npcId === this.talkingId;
  }

  /** Marker float/spin + highlight pulse / brighten / scale for one NPC. */
  private animateNpc(a: NpcActor, time: number, dt: number): void {
    const hl = this.highlights.has(a.npcId) ? 1 : 0;
    const hov = this.hoverId === a.npcId ? 1 : 0;
    a.hlW += (hl - a.hlW) * EASE(7, dt);
    a.hoverW += (hov - a.hoverW) * EASE(10, dt);

    const m = a.marker;
    m.rotation.y = time * 1.3 + a.bobPhase;
    m.position.y = a.rig.height + 0.28 + 0.07 * Math.sin(time * 2.1 + a.bobPhase);
    const pulse = 1 + a.hlW * (0.22 + 0.18 * Math.sin(time * 4.6 + a.swayPhase));
    m.scale.setScalar(pulse);

    // Brighten via per-actor material (vertex colors multiply material color).
    const lift = 1 + 0.16 * a.hlW + 0.14 * a.hoverW;
    a.mat.color.setScalar(lift);
    a.mat.emissive.copy(WARM).multiplyScalar(0.075 * a.hlW + 0.055 * a.hoverW);

    const s = 1 + 0.05 * a.hlW;
    a.rig.group.scale.setScalar(s);
  }

  /** Keep the approach stand-point pinned to the hero's settle position. */
  private retargetApproach(): void {
    const p = this.prota;
    const id = this.approachId;
    if (!p || id === null) return;
    const target = this.npcs.get(id);
    if (!target || !target.rig.group.visible || target.hideOnArrive) {
      this.approachId = null;
      this.sendProtaHome(false);
      return;
    }
    const hp = target.dest ?? target.rig.group.position;
    if (p.faceTarget) p.faceTarget.set(hp.x, 0, hp.z);
    if (p.dest) {
      const d2 = (p.dest.x - hp.x) ** 2 + (p.dest.z - hp.z) ** 2;
      if (Math.abs(Math.sqrt(d2) - APPROACH_DIST) > 0.15) {
        tmpV.set(p.rig.group.position.x - hp.x, 0, p.rig.group.position.z - hp.z);
        if (tmpV.lengthSq() < 1e-4) tmpV.set(0, 0, 1);
        tmpV.normalize().multiplyScalar(APPROACH_DIST);
        p.dest.set(hp.x + tmpV.x, 0, hp.z + tmpV.z);
      }
    } else if (!p.faceTarget) {
      p.faceTarget = new THREE.Vector3(hp.x, 0, hp.z);
    }
  }

  dispose(): void {
    for (const a of this.npcs.values()) {
      a.rig.dispose();
      a.mat.dispose();
    }
    for (const rig of this.protaRigs.values()) rig.dispose();
    this.protaMat.dispose();
    this.markerGeo.dispose();
    this.proxyGeo.dispose();
    this.proxyMat.dispose();
  }
}
