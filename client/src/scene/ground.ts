/**
 * Ground: one merged mesh — packed-earth plane with subtle vertex-color
 * variation, a stone path strip down the street axis (plus a faint cross
 * strip at the market cross), and a few flat stone slabs. 1 draw call.
 */
import * as THREE from "three";
import { PALETTE, type SceneMaterials, box, colorize, makeRng, mergeAll } from "./materials";

export function createGround(materials: SceneMaterials): THREE.Mesh {
  const rng = makeRng(20260610);

  const plane = new THREE.PlaneGeometry(28, 38, 28, 38);
  plane.rotateX(-Math.PI / 2);
  plane.translate(0, 0, -4);

  const earth = new THREE.Color(PALETTE.packedEarth);
  const stone = new THREE.Color(PALETTE.stone);
  const pos = plane.getAttribute("position");
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    // Stone path: main strip along the street + faint cross strip at z ~ 1.
    const mainStrip = 1 - smooth(2.0, 3.0, Math.abs(x));
    const crossStrip = (1 - smooth(1.4, 2.4, Math.abs(z - 1))) * 0.8;
    const stoniness = Math.max(mainStrip, crossStrip);
    c.copy(earth).lerp(stone, stoniness);
    // Subtle deterministic mottling, slightly darker against building rows.
    const mottle = 0.93 + rng() * 0.13 - (Math.abs(x) > 4.6 ? 0.05 : 0);
    c.multiplyScalar(mottle);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  plane.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  // A few flat stone slabs on the path.
  const parts: THREE.BufferGeometry[] = [plane];
  for (let i = 0; i < 9; i++) {
    const sx = (rng() - 0.5) * 3.6;
    const sz = -13 + i * 2.6 + (rng() - 0.5) * 1.4;
    parts.push(
      box(
        0.8 + rng() * 0.5, 0.045, 0.6 + rng() * 0.4,
        sx, 0.022, sz,
        PALETTE.stone, rng() * 0.6 - 0.3, 0.88 + rng() * 0.2,
      ),
    );
  }
  // Threshold slab under the gate passage.
  parts.push(colorize(boxAt(3.4, 0.06, 2.4, 0, 0.03, -15.2), PALETTE.stone, 0.8));

  const mesh = new THREE.Mesh(mergeAll(parts), materials.vertexLambert);
  mesh.matrixAutoUpdate = false;
  return mesh;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

/** smoothstep(edge0, edge1, v) */
function smooth(edge0: number, edge1: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
