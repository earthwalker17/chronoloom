/**
 * Street props: barrel clusters, crates, a handcart, a stone well with a
 * little roof, and one willow (trunk + foliage blobs). All vertex-colored
 * and merged into ONE mesh — 1 draw call.
 */
import * as THREE from "three";
import { PALETTE, type SceneMaterials, box, colorize, makeRng, mergeAll } from "./materials";

export function createProps(materials: SceneMaterials): THREE.Mesh {
  const rng = makeRng(8273);
  const parts: THREE.BufferGeometry[] = [];

  // Barrels: cluster by the teahouse corner (one stacked) + two on the west row.
  const barrel = (x: number, z: number, y = 0.31): void => {
    const g = new THREE.CylinderGeometry(0.26, 0.3, 0.62, 9);
    g.translate(x, y, z);
    parts.push(colorize(g, PALETTE.woodLight, 0.82 + rng() * 0.2));
  };
  barrel(4.05, 2.7);
  barrel(4.3, 3.15);
  barrel(3.78, 3.2);
  barrel(4.05, 2.95, 0.93);
  barrel(-4.25, -6.2);
  barrel(-4.3, -5.6);

  // Crates near the stall rows (one stacked pair, one single).
  parts.push(box(0.5, 0.5, 0.5, 3.1, 0.25, -4.5, PALETTE.woodLight, 0.3, 0.9));
  parts.push(box(0.4, 0.4, 0.4, 3.12, 0.7, -4.48, PALETTE.woodLight, 0.85, 0.78));
  parts.push(box(0.55, 0.55, 0.55, -3.25, 0.275, 2.45, PALETTE.woodLight, 0.15, 0.95));

  // Handcart, parked at the south end of the west row.
  const cart = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    g.rotateY(0.6);
    g.translate(-2.7, 0, 8.0);
    return g;
  };
  parts.push(cart(box(1.55, 0.1, 0.95, 0, 0.62, 0, PALETTE.woodLight, 0, 0.88)));
  parts.push(cart(box(1.55, 0.16, 0.06, 0, 0.75, 0.47, PALETTE.woodDark, 0, 0.9)));
  parts.push(cart(box(1.55, 0.16, 0.06, 0, 0.75, -0.47, PALETTE.woodDark, 0, 0.9)));
  parts.push(cart(box(0.07, 0.07, 1.18, -0.25, 0.42, 0, PALETTE.woodDark, 0, 0.7)));
  for (const wz of [-0.56, 0.56]) {
    const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 10);
    wheel.rotateX(Math.PI / 2);
    wheel.translate(-0.25, 0.42, wz);
    parts.push(cart(colorize(wheel, PALETTE.woodDark, 0.75)));
  }
  for (const sz of [-0.35, 0.35]) {
    const shaft = new THREE.BoxGeometry(1.25, 0.05, 0.06);
    shaft.rotateZ(-0.3);
    shaft.translate(0.95, 0.45, sz);
    parts.push(cart(colorize(shaft, PALETTE.woodLight, 0.7)));
  }

  // Stone well near the market cross, with posts and a small plank roof.
  const wx = -2.3;
  const wz = 3.6;
  const ring = new THREE.CylinderGeometry(0.62, 0.68, 0.58, 10);
  ring.translate(wx, 0.29, wz);
  parts.push(colorize(ring, PALETTE.stone, 0.95));
  const mouth = new THREE.CylinderGeometry(0.44, 0.44, 0.6, 10);
  mouth.translate(wx, 0.3, wz);
  parts.push(colorize(mouth, PALETTE.roofRidge, 0.3)); // reads as the dark hole
  for (const px of [-0.52, 0.52]) {
    parts.push(box(0.07, 1.45, 0.07, wx + px, 0.725, wz, PALETTE.woodDark, 0, 0.85));
  }
  parts.push(box(1.2, 0.06, 0.06, wx, 1.32, wz, PALETTE.woodDark, 0, 0.8));
  parts.push(box(1.4, 0.06, 0.55, wx, 1.5, wz, PALETTE.roofTile, 0, 0.8));

  // One willow at the south-east corner: leaning trunk + 4 drooping blobs.
  const tx = 4.35;
  const tz = 8.6;
  const trunk = new THREE.CylinderGeometry(0.12, 0.2, 2.3, 7);
  trunk.rotateZ(0.07);
  trunk.translate(tx, 1.15, tz);
  parts.push(colorize(trunk, PALETTE.woodDark, 0.85));
  for (const [ox, oy, oz, r] of [
    [0.15, 2.85, 0.1, 1.05],
    [-0.55, 2.55, -0.25, 0.8],
    [0.6, 2.5, 0.4, 0.75],
    [0, 3.4, -0.1, 0.8],
  ] as const) {
    const blob = new THREE.SphereGeometry(r, 6, 5);
    blob.scale(1, 1.3, 1); // drooping willow silhouette
    blob.translate(tx + ox, oy, tz + oz);
    parts.push(colorize(blob, PALETTE.foliage, 0.85 + rng() * 0.25));
  }

  const mesh = new THREE.Mesh(mergeAll(parts), materials.vertexLambert);
  mesh.matrixAutoUpdate = false;
  return mesh;
}
