/**
 * Low-poly humanoid figure builder for hero NPCs and the protagonist.
 *
 * Budget contract (hard): everything static per figure — torso, robe, head,
 * hair/headgear, legs, belts, props that do not move — is merged into ONE
 * vertex-colored geometry (1 draw call). The only separate meshes are the two
 * arms, each hung from a shoulder pivot Object3D so heroes.ts can swing them
 * (pivot rotation only, never per-vertex). `head` is an empty pivot at head
 * center used as the marker / nameplate / face-target anchor (the head
 * geometry itself is merged, so "head turns" are done as subtle whole-figure
 * yaw in heroes.ts). Every figure stays well under 400 triangles.
 *
 * Local frame: feet at y = 0, figure faces +z when group yaw = 0.
 */
import * as THREE from "three";
import type { IdentityId, NpcId } from "@shared/constants";
import { PALETTE, colorize, mergeAll } from "./materials";

export type FigureKey = NpcId | IdentityId;

type Headgear =
  | "scholarCap" // soft dark scholar's cap
  | "futou"      // rounded headwrap with back knob
  | "futouWings" // official futou with stiff side wings
  | "bun"        // hair bun + hairpin glint
  | "highBun"    // taller hostess bun
  | "softCap"    // pale scholar identity cap
  | "headband"   // worker's headband over hair
  | "feltHat"    // rounded hu-style felt hat
  | "closeCap";  // plain close-fitting cap

interface ArmPose {
  x: number; // pivot rotation.x (negative = forearm swings forward)
  z: number; // pivot rotation.z (sign convention: +z tips the hand toward +x)
}

export interface FigureSpec {
  height: number;     // top of head, world units
  shoulderW: number;  // full width across shoulders (silhouette driver)
  hipR: number;       // robe radius at the waist
  hemR: number;       // robe radius at the hem (skirt flare driver)
  skirtTopY: number;  // waist height as a fraction of height (high for women)
  hemY?: number;      // hem height fraction (0 = floor robe; higher = tunic)
  robe: number;       // main robe / skirt color
  robeUnder?: number; // under-layer peeking below the hem (layered robes)
  torso?: number;     // bodice / tunic color when it differs from the robe
  trim?: number;      // collar ring color
  skin: number;
  hair: Headgear;
  hairColor: number;
  stoop?: number;     // forward lean of the upper body, radians
  legs?: { color: number; topY: number; stance: number }; // visible trousers
  apron?: number;     // front apron panel color
  belt?: { y: number; color: number; plaque?: number };
  sleeveR?: number;   // sleeve cuff radius (wide Tang sleeves vs work sleeves)
  hands?: boolean;    // small hand spheres at the cuffs (false = lost in sleeves)
  pipa?: boolean;     // merged into the LEFT arm mesh so it moves with the cradle
  rest: { l: ArmPose; r: ArmPose };
  /** Walk-cycle swing multiplier per arm (lvyao keeps the pipa arm still). */
  swing: { l: number; r: number };
}

export interface FigureRig {
  group: THREE.Group;
  /** ONE merged static mesh: torso+robe+head+headgear+legs+belt+apron. */
  body: THREE.Mesh;
  /** Shoulder pivots; rotating them swings the whole sleeve. */
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  /** Empty pivot at head center (anchor only — head geometry is merged). */
  head: THREE.Object3D;
  height: number;
  rest: { l: ArmPose; r: ArmPose };
  swing: { l: number; r: number };
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Costume palette (locked scene PALETTE reused where it fits; the rest are
// figure-only costume tones, kept muted to sit inside the night street).
// ---------------------------------------------------------------------------

const SKIN = 0xdfb893;
const SKIN_PALE = 0xd9c4a6;
const C = {
  hairInk: 0x2a2530,
  capInk: 0x32303c,
  greyWhiteRobe: 0xcfc9ba,
  greyUnderRobe: 0x8f8a7c,
  stewardBrown: 0x5a3d2c,
  tealSkirt: 0x3f7468,
  tealBodice: 0x6da394,
  officialBlue: 0x3a5a64,
  wineRobe: 0x8c3f34,
  amberBodice: 0xb87a46,
  apronCloth: 0xd9d2c0,
  trousers: 0x4a4438,
  caftan: 0x6e5638,
  feltHat: 0x77694f,
  copyistRobe: 0x7e7668,
  beltDark: 0x2c2622,
} as const;

const REST_NORMAL: FigureSpec["rest"] = { l: { x: 0, z: -0.1 }, r: { x: 0, z: 0.1 } };
const REST_SLEEVES: FigureSpec["rest"] = { l: { x: -0.62, z: 0.42 }, r: { x: -0.62, z: -0.42 } };
const REST_CRADLE: FigureSpec["rest"] = { l: { x: -1.05, z: 0.5 }, r: { x: -0.5, z: -0.12 } };
const SWING_BOTH = { l: 1, r: 1 };

// ---------------------------------------------------------------------------
// Spec table — the 5 hero NPCs + 4 protagonist identity variants
// ---------------------------------------------------------------------------

export const FIGURE_SPECS: Record<FigureKey, FigureSpec> = {
  // 沈砚秋 — elderly scholar: grey-white layered robe, thin, stooped, soft cap,
  // hands resting in sleeves.
  shen_yanqiu: {
    height: 1.58, shoulderW: 0.33, hipR: 0.145, hemR: 0.25, skirtTopY: 0.52, hemY: 0.07,
    robe: C.greyWhiteRobe, robeUnder: C.greyUnderRobe, trim: C.greyUnderRobe,
    skin: SKIN_PALE, hair: "scholarCap", hairColor: C.capInk, stoop: 0.15,
    rest: REST_SLEEVES, swing: { l: 0.55, r: 0.55 },
  },
  // 崔九 — silk-guild steward: stocky, dark brown robe with gold trim, futou,
  // wide stance (robe stops at the shin over spread trouser legs).
  cui_jiu: {
    height: 1.63, shoulderW: 0.46, hipR: 0.21, hemR: 0.3, skirtTopY: 0.5, hemY: 0.18,
    robe: C.stewardBrown, trim: PALETTE.awningYellow, skin: SKIN,
    hair: "futou", hairColor: C.hairInk,
    legs: { color: 0x3a332c, topY: 0.22, stance: 0.1 },
    belt: { y: 0.5, color: C.beltDark },
    rest: REST_NORMAL, swing: SWING_BOTH,
  },
  // 绿瑶 — young musician: teal/green ruqun (narrow shoulders, high waist,
  // floor-length flare), hair bun + hairpin glint, cradles a pipa.
  lvyao: {
    height: 1.5, shoulderW: 0.26, hipR: 0.115, hemR: 0.31, skirtTopY: 0.66,
    robe: C.tealSkirt, torso: C.tealBodice, trim: C.apronCloth, skin: 0xe8cba8,
    hair: "bun", hairColor: C.hairInk, pipa: true,
    rest: REST_CRADLE, swing: { l: 0.12, r: 0.7 },
  },
  // 裴衡 — market official: tall, upright, blue-green round-collar robe,
  // winged futou, dark belt with bright plaques.
  pei_heng: {
    height: 1.78, shoulderW: 0.42, hipR: 0.175, hemR: 0.25, skirtTopY: 0.52,
    robe: C.officialBlue, trim: 0x2c444c, skin: SKIN,
    hair: "futouWings", hairColor: 0x1f1f26,
    belt: { y: 0.55, color: C.beltDark, plaque: PALETTE.awningYellow },
    rest: REST_NORMAL, swing: { l: 0.7, r: 0.7 },
  },
  // 何十三 — tavern hostess: warm amber/wine robe, apron hint, fuller female
  // silhouette, high bun.
  he_shisan: {
    height: 1.56, shoulderW: 0.31, hipR: 0.165, hemR: 0.32, skirtTopY: 0.6,
    robe: C.wineRobe, torso: C.amberBodice, trim: C.apronCloth, skin: 0xe6c5a2,
    hair: "highBun", hairColor: C.hairInk, apron: C.apronCloth,
    rest: REST_NORMAL, swing: SWING_BOTH,
  },

  // --- protagonist identity variants ---------------------------------------
  scholar: {
    height: 1.66, shoulderW: 0.37, hipR: 0.16, hemR: 0.26, skirtTopY: 0.52,
    robe: PALETTE.plaster, trim: 0x6b5c4a, skin: SKIN,
    hair: "softCap", hairColor: C.capInk,
    rest: REST_NORMAL, swing: SWING_BOTH,
  },
  apprentice: {
    height: 1.6, shoulderW: 0.38, hipR: 0.18, hemR: 0.23, skirtTopY: 0.5, hemY: 0.4,
    robe: PALETTE.woodLight, trim: 0x5e4534, skin: SKIN,
    hair: "headband", hairColor: C.hairInk,
    legs: { color: C.trousers, topY: 0.42, stance: 0.07 },
    belt: { y: 0.5, color: C.beltDark }, sleeveR: 0.05, hands: true,
    rest: REST_NORMAL, swing: SWING_BOTH,
  },
  interpreter: {
    height: 1.68, shoulderW: 0.4, hipR: 0.17, hemR: 0.26, skirtTopY: 0.52, hemY: 0.16,
    robe: C.caftan, trim: PALETTE.vermilion, skin: SKIN,
    hair: "feltHat", hairColor: C.feltHat,
    legs: { color: 0x2e2a26, topY: 0.2, stance: 0.07 },
    belt: { y: 0.52, color: C.beltDark }, sleeveR: 0.06, hands: true,
    rest: REST_NORMAL, swing: SWING_BOTH,
  },
  copyist: {
    height: 1.62, shoulderW: 0.36, hipR: 0.155, hemR: 0.25, skirtTopY: 0.52,
    robe: C.copyistRobe, trim: 0x55504a, skin: SKIN_PALE,
    hair: "closeCap", hairColor: 0x2e2e34,
    rest: REST_NORMAL, swing: SWING_BOTH,
  },
};

// ---------------------------------------------------------------------------
// Small geometry helpers (all colorized, merged later)
// ---------------------------------------------------------------------------

/** Vertical tapered tube between two heights, capped. */
function tube(
  rTop: number, rBottom: number, yTop: number, yBottom: number,
  hex: number, brightness = 1, seg = 8, scaleX = 1, scaleZ = 1,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, Math.max(0.01, yTop - yBottom), seg);
  g.scale(scaleX, 1, scaleZ);
  g.translate(0, (yTop + yBottom) / 2, 0);
  return colorize(g, hex, brightness);
}

function ball(
  r: number, x: number, y: number, z: number, hex: number,
  brightness = 1, w = 6, h = 5, sx = 1, sy = 1, sz = 1,
): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, w, h);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return colorize(g, hex, brightness);
}

function cube(
  w: number, h: number, d: number, x: number, y: number, z: number,
  hex: number, brightness = 1,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colorize(g, hex, brightness);
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildFigure(spec: FigureSpec, material: THREE.Material): FigureRig {
  const H = spec.height;
  const headR = H * 0.073;
  const headCY = H - headR * 1.25;
  const neckY = headCY - headR * 1.1;
  const shoulderY = neckY - 0.025;
  const waistY = H * spec.skirtTopY;
  const hemY = H * (spec.hemY ?? 0.012);
  const sx = spec.shoulderW / 2;

  const lower: THREE.BufferGeometry[] = []; // below the waist (no stoop)
  const upper: THREE.BufferGeometry[] = []; // above the waist (stoop applies)

  // Robe skirt: waist → hem. Under-layer peeks below layered robes.
  lower.push(tube(spec.hipR, spec.hemR, waistY + 0.05, hemY, spec.robe));
  if (spec.robeUnder !== undefined) {
    lower.push(tube(spec.hemR * 0.92, spec.hemR * 1.04, hemY + H * 0.09, H * 0.01, spec.robeUnder, 0.95));
  }

  // Visible trouser legs below short robes.
  if (spec.legs) {
    const lw = H * 0.055;
    for (const s of [-1, 1] as const) {
      lower.push(cube(lw, H * spec.legs.topY, lw * 1.1, s * spec.legs.stance, (H * spec.legs.topY) / 2, 0.01, spec.legs.color));
    }
  }

  // Belt ring (+ plaques for the official).
  if (spec.belt) {
    const by = H * spec.belt.y;
    lower.push(tube(spec.hipR * 1.12, spec.hipR * 1.14, by + 0.035, by - 0.035, spec.belt.color, 1, 8));
    if (spec.belt.plaque !== undefined) {
      for (const a of [-0.7, 0, 0.7]) {
        lower.push(cube(0.05, 0.04, 0.02, Math.sin(a) * spec.hipR * 1.16, by, Math.cos(a) * spec.hipR * 1.16, spec.belt.plaque, 1.2));
      }
    }
  }

  // Apron hint: thin front panel tilted to follow the skirt cone.
  if (spec.apron !== undefined) {
    const g = new THREE.BoxGeometry(spec.hipR * 1.7, H * 0.42, 0.02);
    g.rotateX(-0.1);
    g.translate(0, H * 0.33, spec.hemR * 0.62);
    lower.push(colorize(g, spec.apron, 0.95));
  }

  // Torso: shoulders → waist, widened in x and flattened in z so male/female
  // shoulder widths read in silhouette.
  upper.push(tube(sx * 0.82, spec.hipR * 1.02, shoulderY + 0.02, waistY - 0.04, spec.torso ?? spec.robe, 1.02, 8, 1.22, 0.72));

  // Collar ring.
  if (spec.trim !== undefined) {
    upper.push(tube(headR * 0.85, headR * 0.98, neckY + 0.025, neckY - 0.035, spec.trim, 1, 7));
  }

  // Head + hair/headgear.
  upper.push(ball(headR, 0, headCY, 0.004, spec.skin, 1, 7, 5, 0.94, 1.06, 0.96));
  pushHeadgear(upper, spec, headR, headCY);

  // Stoop: rotate the upper stack forward around the waist.
  const stoop = spec.stoop ?? 0;
  if (stoop !== 0) {
    for (const g of upper) {
      g.translate(0, -waistY, 0);
      g.rotateX(stoop);
      g.translate(0, waistY, 0);
    }
  }

  const group = new THREE.Group();
  const body = new THREE.Mesh(mergeAll([...lower, ...upper]), material);
  group.add(body);

  // Stoop-adjusted anchor positions (rotation about x at waist: y→z plane).
  const lean = (y: number): { y: number; z: number } => ({
    y: waistY + (y - waistY) * Math.cos(stoop),
    z: (y - waistY) * Math.sin(stoop),
  });
  const sh = lean(shoulderY);
  const hd = lean(headCY);

  const head = new THREE.Object3D();
  head.position.set(0, hd.y, hd.z + 0.004);
  group.add(head);

  // Arms: sleeve tube hanging from a shoulder pivot (+ optional hand + pipa).
  const armLen = H * 0.36;
  const sleeveR = spec.sleeveR ?? sx * 0.46;
  const buildArm = (side: -1 | 1): { pivot: THREE.Object3D; mesh: THREE.Mesh } => {
    const parts: THREE.BufferGeometry[] = [];
    const s = new THREE.CylinderGeometry(sx * 0.3, sleeveR, armLen, 6);
    s.translate(0, -armLen / 2, 0);
    parts.push(colorize(s, spec.torso ?? spec.robe, 0.92));
    if (spec.hands) parts.push(ball(headR * 0.42, 0, -armLen - 0.01, 0, spec.skin, 1, 5, 3));
    if (spec.pipa && side === -1) {
      // Pipa merged into the cradling left arm so it follows the gesture.
      parts.push(ball(0.155, 0.03, -armLen * 0.82, 0.12, PALETTE.woodLight, 0.95, 6, 4, 0.78, 1.2, 0.36));
      const neck = new THREE.BoxGeometry(0.04, 0.34, 0.035);
      neck.rotateZ(0.55);
      neck.translate(-0.1, -armLen * 0.82 + 0.24, 0.12);
      parts.push(colorize(neck, PALETTE.woodDark, 0.9));
    }
    const mesh = new THREE.Mesh(mergeAll(parts), material);
    const pivot = new THREE.Object3D();
    pivot.position.set(side * (sx - 0.015), sh.y - 0.015, sh.z);
    pivot.add(mesh);
    group.add(pivot);
    return { pivot, mesh };
  };
  const left = buildArm(-1);
  const right = buildArm(1);
  left.pivot.rotation.set(spec.rest.l.x, 0, spec.rest.l.z);
  right.pivot.rotation.set(spec.rest.r.x, 0, spec.rest.r.z);

  return {
    group,
    body,
    armL: left.pivot,
    armR: right.pivot,
    head,
    height: H,
    rest: spec.rest,
    swing: spec.swing,
    dispose() {
      body.geometry.dispose();
      left.mesh.geometry.dispose();
      right.mesh.geometry.dispose();
    },
  };
}

function pushHeadgear(out: THREE.BufferGeometry[], spec: FigureSpec, headR: number, headCY: number): void {
  const c = spec.hairColor;
  const topY = headCY + headR * 0.9;
  switch (spec.hair) {
    case "scholarCap":
    case "softCap":
      // Hair line + soft rectangular cap with a small raised back.
      out.push(ball(headR * 1.04, 0, headCY + headR * 0.18, -headR * 0.12, c, spec.hair === "softCap" ? 1.1 : 1, 6, 4, 1, 0.72, 1));
      out.push(cube(headR * 1.5, headR * 0.55, headR * 1.5, 0, topY + headR * 0.2, -headR * 0.1, c));
      out.push(cube(headR * 1.0, headR * 0.6, headR * 0.5, 0, topY + headR * 0.55, -headR * 0.55, c, 0.92));
      break;
    case "futou":
      out.push(ball(headR * 1.06, 0, headCY + headR * 0.22, -headR * 0.08, c, 1, 6, 4, 1, 0.85, 1));
      out.push(ball(headR * 0.5, 0, topY + headR * 0.35, -headR * 0.55, c, 0.9, 5, 3));
      break;
    case "futouWings":
      out.push(ball(headR * 1.06, 0, headCY + headR * 0.22, -headR * 0.08, c, 1, 6, 4, 1, 0.9, 1));
      out.push(ball(headR * 0.55, 0, topY + headR * 0.45, -headR * 0.35, c, 0.9, 5, 3));
      // Stiff horizontal side wings.
      out.push(cube(headR * 4.4, headR * 0.22, headR * 0.42, 0, headCY + headR * 0.55, -headR * 0.7, c, 0.85));
      break;
    case "bun":
    case "highBun": {
      const high = spec.hair === "highBun";
      out.push(ball(headR * 1.05, 0, headCY + headR * 0.2, -headR * 0.1, c, 1, 6, 4, 1, 0.82, 1));
      out.push(ball(headR * (high ? 0.52 : 0.44), 0, topY + headR * (high ? 0.75 : 0.5), -headR * 0.1, c, 1, 5, 4, 1, high ? 1.25 : 1, 1));
      // Hairpin glint through the bun (bright gold reads as a highlight).
      out.push(cube(headR * 2.1, headR * 0.1, headR * 0.1, 0, topY + headR * (high ? 0.8 : 0.55), -headR * 0.1, 0xffd87a, 1.6));
      break;
    }
    case "headband":
      out.push(ball(headR * 1.05, 0, headCY + headR * 0.15, -headR * 0.08, c, 1, 6, 4, 1, 0.9, 1));
      out.push(tube(headR * 1.06, headR * 1.08, headCY + headR * 0.55, headCY + headR * 0.3, PALETTE.vermilion, 1, 7));
      break;
    case "feltHat":
      out.push(ball(headR * 1.02, 0, headCY + headR * 0.15, -headR * 0.06, 0x352f2a, 1, 6, 3, 1, 0.8, 1));
      out.push(tube(headR * 0.5, headR * 1.12, topY + headR * 0.75, headCY + headR * 0.35, c, 1, 7));
      break;
    case "closeCap":
      out.push(ball(headR * 1.07, 0, headCY + headR * 0.22, -headR * 0.06, c, 1, 6, 4, 1, 0.78, 1));
      break;
  }
}
