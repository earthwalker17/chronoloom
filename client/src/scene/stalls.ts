/**
 * Seven market stalls along the street edges: counter, four posts, a slightly
 * bent cloth awning (palette rotation), small goods boxes on the counters.
 * 2 draw calls: solid parts + double-sided awnings.
 */
import * as THREE from "three";
import { AWNING_COLORS, PALETTE, type SceneMaterials, box, colorize, makeRng, mergeAll } from "./materials";

interface StallSpec {
  x: number;
  z: number;
  /** Yaw: stalls face the street center. */
  rot: number;
}

export const STALLS: readonly StallSpec[] = [
  { x: 3.55, z: -6.5, rot: Math.PI },
  { x: 3.5, z: -2.0, rot: Math.PI },
  { x: 3.6, z: 3.0, rot: Math.PI },
  { x: -3.55, z: -8.5, rot: 0 },
  { x: -3.5, z: -4.0, rot: 0 },
  { x: -3.6, z: 0.5, rot: 0 },
  { x: -3.5, z: 5.0, rot: 0 },
];

const GOODS_COLORS = [PALETTE.awningYellow, PALETTE.foliage, PALETTE.woodLight, PALETTE.awningRed] as const;

export interface StallsResult {
  solidMesh: THREE.Mesh;
  awningMesh: THREE.Mesh;
}

export function createStalls(materials: SceneMaterials): StallsResult {
  const rng = makeRng(3517);
  const solids: THREE.BufferGeometry[] = [];
  const awnings: THREE.BufferGeometry[] = [];

  STALLS.forEach((spec, i) => {
    const place = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
      g.rotateY(spec.rot);
      g.translate(spec.x, 0, spec.z);
      return g;
    };

    // Counter (local frame: street toward +x).
    solids.push(place(box(0.8, 0.85, 1.9, 0.25, 0.425, 0, PALETTE.woodLight, 0, 0.9 + rng() * 0.18)));

    // Posts: taller at the back, shorter at the front (awning slope).
    for (const [px, pz, ph] of [
      [-0.7, -1.05, 2.05], [-0.7, 1.05, 2.05],
      [0.72, -1.05, 1.66], [0.72, 1.05, 1.66],
    ] as const) {
      solids.push(place(box(0.07, ph, 0.07, px, ph / 2, pz, PALETTE.woodDark)));
    }

    // Goods boxes on the counter.
    const goodsCount = 2 + (i % 2);
    for (let gi = 0; gi < goodsCount; gi++) {
      const s = 0.2 + rng() * 0.16;
      const hex = GOODS_COLORS[(i + gi) % GOODS_COLORS.length] ?? PALETTE.woodLight;
      solids.push(place(box(s, s, s, 0.25 + (rng() - 0.5) * 0.4, 0.85 + s / 2, (rng() - 0.5) * 1.4, hex, rng(), 0.85)));
    }

    // Slightly bent awning, sloping down toward the street.
    const awning = new THREE.PlaneGeometry(1.8, 2.4, 3, 4);
    awning.rotateX(-Math.PI / 2);
    const pos = awning.getAttribute("position");
    for (let vi = 0; vi < pos.count; vi++) {
      const t = (pos.getX(vi) + 0.9) / 1.8; // 0 back → 1 front
      pos.setY(vi, 2.1 - 0.34 * t - 0.12 * t * t);
    }
    awning.computeVertexNormals();
    const hex = AWNING_COLORS[i % AWNING_COLORS.length] ?? PALETTE.awningWhite;
    awnings.push(place(colorize(awning, hex, 0.92 + rng() * 0.16)));
  });

  const solidMesh = new THREE.Mesh(mergeAll(solids), materials.vertexLambert);
  solidMesh.matrixAutoUpdate = false;
  const awningMesh = new THREE.Mesh(mergeAll(awnings), materials.vertexLambertDouble);
  awningMesh.matrixAutoUpdate = false;
  return { solidMesh, awningMesh };
}
