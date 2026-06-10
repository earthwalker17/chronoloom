/**
 * Eight vertical cloth shop banners (绢幡) hung on small arms off the shop
 * fronts. Segmented planes merged with their arms into ONE double-sided
 * draw call; cloth vertices get a CPU sine-wave each frame (top row pinned,
 * sway grows toward the hem). `amplitude` is the wind tween target
 * (directiveMapper: windy → ×2.2).
 */
import * as THREE from "three";
import { AWNING_COLORS, PALETTE, type SceneMaterials, box, colorize, makeRng, mergeAll } from "./materials";

export const BANNER_BASE_AMPLITUDE = 0.085;

const TOP_Y = 3.05;
const HEIGHT = 2.0;
const WIDTH = 0.55;

/** Banner z positions sit on real shop faces (see buildings.ts HOUSES). */
const SPECS: readonly { side: 1 | -1; z: number }[] = [
  { side: -1, z: -8.6 },
  { side: -1, z: -3.9 },
  { side: -1, z: 2.5 },
  { side: -1, z: 7.2 },
  { side: 1, z: -10.3 },
  { side: 1, z: -5.2 },
  { side: 1, z: 4.5 },
  { side: 1, z: 6.5 },
];

export class Banners {
  readonly mesh: THREE.Mesh;

  /** Tween target: world-unit sway amplitude at the hem. */
  amplitude = BANNER_BASE_AMPLITUDE;

  private readonly base: THREE.BufferAttribute;

  constructor(materials: SceneMaterials) {
    const rng = makeRng(4127);
    const parts: THREE.BufferGeometry[] = [];

    SPECS.forEach((spec, i) => {
      const x = spec.side * 4.42;

      // Cloth: vertical segmented plane facing the street (waved per frame).
      const cloth = new THREE.PlaneGeometry(WIDTH, HEIGHT, 1, 7);
      cloth.rotateY(spec.side === 1 ? -Math.PI / 2 : Math.PI / 2);
      cloth.translate(x, TOP_Y - HEIGHT / 2, spec.z);
      const hex = AWNING_COLORS[i % AWNING_COLORS.length] ?? PALETTE.awningWhite;
      parts.push(colorize(cloth, hex, 0.92 + rng() * 0.14));

      // Wall arm + crossbar (static: their vertices sit above TOP_Y).
      parts.push(box(0.36, 0.05, 0.05, spec.side * 4.6, TOP_Y + 0.08, spec.z, PALETTE.woodDark, 0, 0.85));
      parts.push(box(0.05, 0.04, WIDTH + 0.12, x, TOP_Y + 0.02, spec.z, PALETTE.woodDark, 0, 0.75));
    });

    this.mesh = new THREE.Mesh(mergeAll(parts), materials.vertexLambertDouble);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;

    const pos = this.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    this.base = pos.clone();
  }

  /** CPU cloth wave; phases derive from base position so no per-banner bookkeeping. */
  update(timeSec: number): void {
    const pos = this.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const by = this.base.getY(i);
      const hang = (TOP_Y - by) / HEIGHT;
      if (hang <= 0) continue; // arms + pinned top row
      const h = Math.min(1, hang);
      const bx = this.base.getX(i);
      const bz = this.base.getZ(i);
      const sway = this.amplitude * Math.pow(h, 1.4);
      const w1 = Math.sin(timeSec * 1.9 + bz * 1.5 + by * 1.9);
      const w2 = 0.45 * Math.sin(timeSec * 3.3 + bz * 2.3 + by * 3.6);
      pos.setX(i, bx + sway * (w1 + w2));
      pos.setZ(i, bz + sway * 0.4 * Math.sin(timeSec * 1.3 + bx * 1.1 + by * 2.6));
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
