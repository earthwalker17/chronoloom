/**
 * Locked palette, shared materials and small geometry helpers used by every
 * builder in the scene folder. All composite meshes use vertex colors with one
 * of the two shared Lambert materials so each composite stays one draw call.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------------------
// Palette (locked)
// ---------------------------------------------------------------------------

export const PALETTE = {
  woodDark: 0x6b4a36,
  woodLight: 0x8a6248,
  plaster: 0xd8cdb4,
  roofTile: 0x3e4a52,
  roofRidge: 0x2c343b,
  vermilion: 0x9e3b2c,
  stone: 0x9a938a,
  packedEarth: 0xb59e7e,
  awningRed: 0xb8503c,
  awningYellow: 0xc9a24b,
  awningIndigo: 0x34505e,
  awningWhite: 0xd9d2c0,
  lanternWarm: 0xffb45c,
  foliage: 0x5c6e4c,
} as const;

export const AWNING_COLORS = [
  PALETTE.awningRed,
  PALETTE.awningYellow,
  PALETTE.awningIndigo,
  PALETTE.awningWhite,
] as const;

// ---------------------------------------------------------------------------
// Shared materials (created per diorama instance so dispose() is clean)
// ---------------------------------------------------------------------------

export interface SceneMaterials {
  /** Vertex-colored Lambert for all merged opaque composites. */
  vertexLambert: THREE.MeshLambertMaterial;
  /** Same but double-sided (stall awnings, banners). */
  vertexLambertDouble: THREE.MeshLambertMaterial;
  /** Emissive-look lantern paper; instanceColor supplies gold/red. */
  lanternPaper: THREE.MeshBasicMaterial;
  /** Emissive-look warm window glow planes; opacity tweened by time of day. */
  windowGlow: THREE.MeshBasicMaterial;
  /** Crowd figures; instanceColor supplies muted hanfu colors. */
  crowdWhite: THREE.MeshLambertMaterial;
  /** Hero NPC marker diamonds. */
  marker: THREE.MeshBasicMaterial;
  all: THREE.Material[];
}

export function createMaterials(): SceneMaterials {
  const vertexLambert = new THREE.MeshLambertMaterial({ vertexColors: true });
  const vertexLambertDouble = new THREE.MeshLambertMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });
  const lanternPaper = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const windowGlow = new THREE.MeshBasicMaterial({
    color: PALETTE.lanternWarm,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const crowdWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const marker = new THREE.MeshBasicMaterial({ color: PALETTE.lanternWarm });
  return {
    vertexLambert,
    vertexLambertDouble,
    lanternPaper,
    windowGlow,
    crowdWhite,
    marker,
    all: [vertexLambert, vertexLambertDouble, lanternPaper, windowGlow, crowdWhite, marker],
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const tmpColor = new THREE.Color();

/** Paint a flat vertex color over the whole geometry (in-place, returns it). */
export function colorize(geo: THREE.BufferGeometry, hex: number, brightness = 1): THREE.BufferGeometry {
  tmpColor.setHex(hex).multiplyScalar(brightness);
  const pos = geo.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = tmpColor.r;
    arr[i * 3 + 1] = tmpColor.g;
    arr[i * 3 + 2] = tmpColor.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Colored box translated to (x, y, z); optional yaw rotation. */
export function box(
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  hex: number, ry = 0, brightness = 1,
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry !== 0) g.rotateY(ry);
  g.translate(x, y, z);
  return colorize(g, hex, brightness);
}

/** Merge with uv attributes stripped (mixed builders, uvs unused by Lambert+vertexColors). */
export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const g of geos) {
    g.deleteAttribute("uv");
    if (g.index) {
      // Non-indexed merge keeps flat shading consistent across mixed sources.
      const ni = g.toNonIndexed();
      g.copy(ni);
      ni.dispose();
    }
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) throw new Error("mergeGeometries failed: incompatible attribute sets");
  return merged;
}

/** Deterministic mulberry32 PRNG so the diorama is identical every load. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
