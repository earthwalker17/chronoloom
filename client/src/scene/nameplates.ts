/**
 * Projects hero anchor world positions to canvas CSS coordinates for the
 * HTML nameplate overlay. Pure math — no DOM. Call after render so the
 * camera matrices are current.
 */
import * as THREE from "three";

export interface NameplatePos {
  npcId: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface NameplateAnchor {
  npcId: string;
  position: THREE.Vector3;
}

const NDC_MARGIN = 1.1;

const tmpNdc = new THREE.Vector3();
const tmpView = new THREE.Vector3();

export function projectNameplates(
  camera: THREE.PerspectiveCamera,
  anchors: readonly NameplateAnchor[],
  width: number,
  height: number,
): NameplatePos[] {
  return anchors.map(({ npcId, position }) => {
    // In-front test in view space (project() folds behind-camera points back).
    tmpView.copy(position).applyMatrix4(camera.matrixWorldInverse);
    const inFront = tmpView.z < -camera.near;

    tmpNdc.copy(position).project(camera);
    const visible =
      inFront &&
      Math.abs(tmpNdc.x) <= NDC_MARGIN &&
      Math.abs(tmpNdc.y) <= NDC_MARGIN;

    return {
      npcId,
      x: (tmpNdc.x * 0.5 + 0.5) * width,
      y: (0.5 - tmpNdc.y * 0.5) * height,
      visible,
    };
  });
}
