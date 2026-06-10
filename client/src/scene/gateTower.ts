/**
 * 春明门 — two-tier gate tower at the far (-z) end of the street. Stone base
 * with an arched passage, vermilion column rows, two stacked hipped roofs.
 * Reads mostly as a fog silhouette. 1 draw call.
 */
import * as THREE from "three";
import { PALETTE, type SceneMaterials, box, colorize, mergeAll } from "./materials";
import { hipRoof } from "./buildings";

const GATE_Z = -16;

export function createGateTower(materials: SceneMaterials): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];

  // Stone base with arched passage (Shape with arc hole, extruded).
  const shape = new THREE.Shape();
  shape.moveTo(-5, 0);
  shape.lineTo(5, 0);
  shape.lineTo(5, 4);
  shape.lineTo(-5, 4);
  shape.closePath();
  const arch = new THREE.Path();
  arch.moveTo(1.5, 0);
  arch.lineTo(1.5, 1.7);
  arch.absarc(0, 1.7, 1.5, 0, Math.PI, false);
  arch.lineTo(-1.5, 0);
  arch.closePath();
  shape.holes.push(arch);
  const base = new THREE.ExtrudeGeometry(shape, { depth: 3.5, bevelEnabled: false, curveSegments: 10 });
  base.translate(0, 0, GATE_Z - 1.75);
  parts.push(colorize(base, PALETTE.stone, 0.9));

  // Platform + parapet lip.
  parts.push(box(10.8, 0.4, 4.2, 0, 4.2, GATE_Z, PALETTE.stone, 0, 0.82));
  parts.push(box(10.8, 0.3, 0.25, 0, 4.55, GATE_Z + 2.0, PALETTE.stone, 0, 0.75));
  parts.push(box(10.8, 0.3, 0.25, 0, 4.55, GATE_Z - 2.0, PALETTE.stone, 0, 0.75));

  // Tier 1: vermilion column rows + recessed wall.
  for (const cz of [GATE_Z + 1.2, GATE_Z - 1.2]) {
    for (let i = 0; i < 5; i++) {
      const cxp = -3.6 + i * 1.8;
      const col = new THREE.CylinderGeometry(0.13, 0.15, 2.25, 8);
      col.translate(cxp, 5.5, cz);
      parts.push(colorize(col, PALETTE.vermilion));
    }
  }
  parts.push(box(8.4, 2.25, 2.4, 0, 5.5, GATE_Z, PALETTE.plaster, 0, 0.7));

  // Tier 1 roof (ridge along x) + ridge cap.
  const roof1 = hipRoof(4.8, 11.2, 1.4, 0.32);
  roof1.rotateY(Math.PI / 2);
  roof1.translate(0, 6.62, GATE_Z);
  parts.push(colorize(roof1, PALETTE.roofTile, 0.85));
  parts.push(box(11.2 * 0.42, 0.18, 0.34, 0, 7.95, GATE_Z, PALETTE.roofRidge));

  // Tier 2: smaller hall + columns + top roof.
  parts.push(box(6.2, 1.9, 2.1, 0, 8.6, GATE_Z, PALETTE.plaster, 0, 0.66));
  for (const cz of [GATE_Z + 1.0, GATE_Z - 1.0]) {
    for (let i = 0; i < 4; i++) {
      const cxp = -2.55 + i * 1.7;
      const col = new THREE.CylinderGeometry(0.11, 0.12, 1.9, 8);
      col.translate(cxp, 8.6, cz);
      parts.push(colorize(col, PALETTE.vermilion, 0.9));
    }
  }
  const roof2 = hipRoof(4.0, 8.2, 1.5, 0.35);
  roof2.rotateY(Math.PI / 2);
  roof2.translate(0, 9.55, GATE_Z);
  parts.push(colorize(roof2, PALETTE.roofTile, 0.8));
  parts.push(box(8.2 * 0.36, 0.2, 0.36, 0, 10.98, GATE_Z, PALETTE.roofRidge));

  // Flanking wall stubs running off into the fog.
  parts.push(box(5.5, 2.6, 1.6, -7.6, 1.3, GATE_Z, PALETTE.stone, 0, 0.78));
  parts.push(box(5.5, 2.6, 1.6, 7.6, 1.3, GATE_Z, PALETTE.stone, 0, 0.78));

  const mesh = new THREE.Mesh(mergeAll(parts), materials.vertexLambert);
  mesh.matrixAutoUpdate = false;
  return mesh;
}
