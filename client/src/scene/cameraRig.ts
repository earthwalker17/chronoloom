/**
 * PerspectiveCamera + the 5 named presets. One set of geometry — "location
 * changes" are camera + lighting changes. Permanent slow idle drift; mood
 * "ominous" adds a very slow push-in along the view direction.
 */
import * as THREE from "three";
import type { PresetId } from "@shared/constants";
import { Tweener, easeInOutCubic } from "./tween";

export interface CameraPreset {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export const CAMERA_PRESETS: Record<PresetId, CameraPreset> = {
  /** Mid-street hero shot down the axis toward the fog-silhouetted gate tower. */
  market_street: { position: [0.6, 3.0, 9.0], lookAt: [0, 1.6, -14], fov: 45 },
  /** Low, close, oblique along the east stall row. */
  stall_row: { position: [-2.6, 1.35, 5.0], lookAt: [3.2, 1.1, -3.5], fov: 50 },
  /** From the teahouse porch corner, past a vermilion pillar. */
  teahouse_porch: { position: [4.45, 1.95, 3.1], lookAt: [-3.5, 1.4, -7.5], fov: 47 },
  /** Wider, near the gate, looking back into the market. */
  gate_plaza: { position: [-3.4, 2.7, -11.5], lookAt: [2.0, 1.6, 6.0], fov: 55 },
  /** Tight and low, in the gap between two west-row buildings. */
  back_alley: { position: [-8.3, 1.3, -1.7], lookAt: [0.5, 1.8, -8.5], fov: 42 },
};

const DRIFT = 0.08;
const PUSH_DISTANCE = 0.9; // max ominous push-in, world units
const PUSH_IN_SECONDS = 22;
const PUSH_OUT_SECONDS = 6;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;

  /** Externally tweened (mood "tense" → -4). Applied on top of preset fov. */
  fovOffset = 0;

  private readonly basePos = new THREE.Vector3();
  private readonly baseLook = new THREE.Vector3();
  private baseFov: number;
  private push = 0;
  private pushActive = false;

  private readonly tmpDir = new THREE.Vector3();
  private readonly tmpLook = new THREE.Vector3();

  constructor(aspect: number, initial: PresetId = "market_street") {
    const p = CAMERA_PRESETS[initial];
    this.camera = new THREE.PerspectiveCamera(p.fov, aspect, 0.1, 200);
    this.basePos.set(...p.position);
    this.baseLook.set(...p.lookAt);
    this.baseFov = p.fov;
    this.update(0, 0);
  }

  /** Tween to a preset. Retarget-safe: starts from the live base transform. */
  goTo(preset: PresetId, ms: number, tweener: Tweener): void {
    const p = CAMERA_PRESETS[preset];
    const fromPos = this.basePos.clone();
    const fromLook = this.baseLook.clone();
    const fromFov = this.baseFov;
    const toPos = new THREE.Vector3(...p.position);
    const toLook = new THREE.Vector3(...p.lookAt);
    tweener.run(
      "camera.move",
      0,
      1,
      ms,
      (_v, t) => {
        this.basePos.lerpVectors(fromPos, toPos, t);
        this.baseLook.lerpVectors(fromLook, toLook, t);
        this.baseFov = fromFov + (p.fov - fromFov) * t;
      },
      easeInOutCubic,
    );
  }

  setPushIn(active: boolean): void {
    this.pushActive = active;
  }

  /** Per-frame: idle drift + push-in on top of the (possibly tweening) base. */
  update(timeSec: number, dt: number): void {
    if (this.pushActive) {
      this.push = Math.min(1, this.push + dt / PUSH_IN_SECONDS);
    } else {
      this.push = Math.max(0, this.push - dt / PUSH_OUT_SECONDS);
    }

    this.tmpDir.copy(this.baseLook).sub(this.basePos).normalize();
    this.camera.position
      .copy(this.basePos)
      .addScaledVector(this.tmpDir, this.push * PUSH_DISTANCE);
    this.camera.position.x += DRIFT * Math.sin(timeSec * 0.21);
    this.camera.position.y += DRIFT * 0.6 * Math.sin(timeSec * 0.13 + 1.7);
    this.camera.position.z += DRIFT * 0.75 * Math.sin(timeSec * 0.17 + 3.1);

    this.tmpLook.copy(this.baseLook);
    this.tmpLook.x += 0.05 * Math.sin(timeSec * 0.11 + 0.8);
    this.tmpLook.y += 0.03 * Math.sin(timeSec * 0.09 + 2.2);
    this.camera.lookAt(this.tmpLook);

    const fov = this.baseFov + this.fovOffset;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
