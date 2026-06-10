/**
 * Eight low-poly Tang shop-houses in two rows lining the street, plus the
 * teahouse porch (vermilion pillars) used by the teahouse_porch camera.
 * Merged into 2 draw calls: opaque composite + warm window-glow planes.
 */
import * as THREE from "three";
import { PALETTE, type SceneMaterials, box, colorize, makeRng, mergeAll } from "./materials";

/** Building row body center |x|; fronts face the street at |x| ~ 4.7. */
export const ROW_X = 6.2;
export const FRONT_X = 4.7;
/** Height at which lantern strings are anchored between the rows. */
export const STRING_Y = 4.1;
export const STRING_X = 4.85;

interface HouseSpec {
  side: 1 | -1; // +1 = east row, -1 = west row
  z: number;
  w: number; // width along z
  h: number; // wall height
  hip: number; // 0 = gable ends, >0 = hipped
  glow: boolean;
}

// West row leaves a gap (z ~ -3.1..-0.4) for the back_alley camera.
const HOUSES: readonly HouseSpec[] = [
  { side: -1, z: -9.4, w: 3.8, h: 3.0, hip: 0.0, glow: true },
  { side: -1, z: -4.8, w: 3.4, h: 3.3, hip: 0.3, glow: false },
  { side: -1, z: 1.6, w: 4.0, h: 2.8, hip: 0.0, glow: true },
  { side: -1, z: 6.6, w: 3.6, h: 3.2, hip: 0.25, glow: true },
  { side: 1, z: -9.0, w: 4.0, h: 3.1, hip: 0.3, glow: true },
  { side: 1, z: -4.2, w: 3.6, h: 2.9, hip: 0.0, glow: false },
  { side: 1, z: 0.5, w: 4.4, h: 3.4, hip: 0.35, glow: true }, // teahouse
  { side: 1, z: 5.6, w: 3.8, h: 3.0, hip: 0.0, glow: true },
];

const DEPTH = 3.0; // along x

export interface BuildingsResult {
  mesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
}

export function createBuildings(materials: SceneMaterials): BuildingsResult {
  const rng = makeRng(7141);
  const parts: THREE.BufferGeometry[] = [];
  const glows: THREE.BufferGeometry[] = [];

  for (const spec of HOUSES) {
    const cx = spec.side * ROW_X;
    const frontX = spec.side * (ROW_X - DEPTH / 2);
    const proud = spec.side * 0.06;

    // Plaster body + dark plinth.
    parts.push(box(DEPTH, spec.h, spec.w, cx, spec.h / 2, spec.z, PALETTE.plaster, 0, 0.94 + rng() * 0.1));
    parts.push(box(DEPTH + 0.1, 0.28, spec.w + 0.1, cx, 0.14, spec.z, PALETTE.woodDark, 0, 0.8));

    // Timber frame on the street face: corner posts, mid post, top beam.
    const hw = spec.w / 2;
    for (const pz of [spec.z - hw + 0.1, spec.z + hw - 0.1, spec.z - hw * 0.25]) {
      parts.push(box(0.14, spec.h, 0.14, frontX + proud, spec.h / 2, pz, PALETTE.woodDark));
    }
    parts.push(box(0.12, 0.16, spec.w, frontX + proud, spec.h - 0.22, spec.z, PALETTE.woodDark));

    // Door (slightly proud, darker) and shuttered windows.
    const doorZ = spec.z + hw * 0.35;
    parts.push(box(0.1, 1.7, 1.0, frontX + proud * 0.7, 0.85, doorZ, PALETTE.woodDark, 0, 0.62));
    const winZ = spec.z - hw * 0.55;
    parts.push(box(0.08, 0.72, 0.8, frontX + proud * 0.7, 1.95, winZ, PALETTE.woodDark, 0, 0.55));
    parts.push(box(0.08, 0.72, 0.8, frontX + proud * 0.7, 1.95, spec.z + hw * 0.78, PALETTE.woodDark, 0, 0.55));

    // Roof: hip/gable prism + ridge cap.
    const overhang = 0.55;
    const roof = hipRoof(DEPTH + overhang * 2, spec.w + overhang * 2, 1.05 + rng() * 0.3, spec.hip);
    roof.translate(cx, spec.h, spec.z);
    parts.push(colorize(roof, PALETTE.roofTile, 0.92 + rng() * 0.16));
    const ridgeLen = (spec.w + overhang * 2) * (1 - spec.hip) + 0.25;
    parts.push(box(0.3, 0.14, ridgeLen, cx, spec.h + 1.1, spec.z, PALETTE.roofRidge));

    // Warm window glow planes (opacity tweened by time of day).
    if (spec.glow) {
      glows.push(glowPlane(0.74, 0.62, spec.side, frontX + proud + spec.side * 0.05, 1.95, winZ));
      glows.push(glowPlane(0.5, 1.3, spec.side, frontX + proud + spec.side * 0.05, 1.0, doorZ));
    }
  }

  // Teahouse porch (east row, z = 0.5): deck, vermilion pillars, lean-to roof.
  parts.push(box(1.5, 0.18, 4.6, 3.95, 0.1, 0.5, PALETTE.woodLight, 0, 0.9));
  for (const pz of [-1.5, 0.5, 1.9]) {
    const pillar = new THREE.CylinderGeometry(0.09, 0.11, 2.35, 8);
    pillar.translate(3.7, 1.36, pz);
    parts.push(colorize(pillar, PALETTE.vermilion));
  }
  const porchRoof = new THREE.BoxGeometry(1.9, 0.09, 5.0);
  porchRoof.rotateZ(0.34);
  porchRoof.translate(3.95, 2.75, 0.5);
  parts.push(colorize(porchRoof, PALETTE.roofTile, 0.85));

  const mesh = new THREE.Mesh(mergeAll(parts), materials.vertexLambert);
  mesh.matrixAutoUpdate = false;

  const glowMesh = new THREE.Mesh(mergeAll(glows), materials.windowGlow);
  glowMesh.matrixAutoUpdate = false;

  return { mesh, glowMesh };
}

/** Quad facing +x (side=1 faces -x toward the street from the east row). */
function glowPlane(w: number, h: number, side: 1 | -1, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateY(side === 1 ? -Math.PI / 2 : Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/**
 * Roof prism with ridge along z. hipRatio 0 → gable (vertical triangle ends);
 * >0 → hipped (sloped ends). Non-indexed, flat normals.
 */
export function hipRoof(wx: number, wz: number, rh: number, hipRatio: number): THREE.BufferGeometry {
  const hw = wx / 2;
  const hd = wz / 2;
  const hip = Math.min(hd * 0.9, hd * hipRatio);
  const a: [number, number, number] = [-hw, 0, -hd];
  const b: [number, number, number] = [hw, 0, -hd];
  const c: [number, number, number] = [hw, 0, hd];
  const d: [number, number, number] = [-hw, 0, hd];
  const r1: [number, number, number] = [0, rh, -hd + hip];
  const r2: [number, number, number] = [0, rh, hd - hip];
  // Winding verified: outward normals (see slope/end cross products).
  const tris: [number, number, number][] = [
    a, d, r2, a, r2, r1, // west slope
    c, b, r1, c, r1, r2, // east slope
    b, a, r1, // -z end
    d, c, r2, // +z end
  ];
  const positions = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => positions.set(v, i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}
