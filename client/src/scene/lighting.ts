/**
 * Hemisphere + directional + ambient light rig and the per-TimeOfDay lighting
 * lookup table. All values are tween targets — directiveMapper combines a
 * time-of-day base with weather / mood / location modifiers and tweens the
 * live lights toward the result.
 */
import * as THREE from "three";
import type { TimeOfDay } from "@shared/constants";

export interface LightingPreset {
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  dirColor: number;
  dirIntensity: number;
  dirPosition: [number, number, number];
  fogColor: number;
  fogDensity: number;
  skyTop: number;
  skyBottom: number;
  exposure: number;
  /** Base intensity for the hero lantern point lights. */
  lanternBase: number;
  /** Opacity of the warm window-glow planes. */
  windowGlow: number;
}

export const LIGHTING: Record<TimeOfDay, LightingPreset> = {
  // Cool pale gold; low fresh sun from the east.
  morning: {
    hemiSky: 0xbcccdf,
    hemiGround: 0x8f8472,
    hemiIntensity: 0.85,
    dirColor: 0xffe3ae,
    dirIntensity: 1.15,
    dirPosition: [14, 9, 6],
    fogColor: 0xc3c8cf,
    fogDensity: 0.026,
    skyTop: 0x88aed2,
    skyBottom: 0xe6d9bb,
    exposure: 1.0,
    lanternBase: 0.2,
    windowGlow: 0.0,
  },
  // Bright neutral overhead sun.
  noon: {
    hemiSky: 0xcdd8e2,
    hemiGround: 0x9c8e76,
    hemiIntensity: 1.0,
    dirColor: 0xfff4dc,
    dirIntensity: 1.55,
    dirPosition: [5, 16, 4],
    fogColor: 0xc9cdc8,
    fogDensity: 0.018,
    skyTop: 0x7aa6d2,
    skyBottom: 0xd8dccf,
    exposure: 1.0,
    lanternBase: 0.08,
    windowGlow: 0.0,
  },
  // Warm orange-pink, sun low in the west behind the gate tower.
  dusk: {
    hemiSky: 0x9d7d92,
    hemiGround: 0x6e5648,
    hemiIntensity: 0.72,
    dirColor: 0xff9a5c,
    dirIntensity: 0.95,
    dirPosition: [-10, 4.5, -14],
    fogColor: 0xb08672,
    fogDensity: 0.03,
    skyTop: 0x55567f,
    skyBottom: 0xe8966b,
    exposure: 1.05,
    lanternBase: 0.75,
    windowGlow: 0.6,
  },
  // 上元夜 — deep blue sky, cold moonlight, lanterns carry the street.
  night: {
    hemiSky: 0x2a3450,
    hemiGround: 0x241d2a,
    hemiIntensity: 0.5,
    dirColor: 0x6e82ac,
    dirIntensity: 0.28,
    dirPosition: [-6, 12, 8],
    fogColor: 0x141a2a,
    fogDensity: 0.042,
    skyTop: 0x202840,
    skyBottom: 0x39304e,
    exposure: 1.12,
    lanternBase: 1.0,
    windowGlow: 0.85,
  },
};

export interface LightRig {
  hemi: THREE.HemisphereLight;
  dir: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
}

export function createLights(scene: THREE.Scene): LightRig {
  const night = LIGHTING.night;
  const hemi = new THREE.HemisphereLight(night.hemiSky, night.hemiGround, night.hemiIntensity);
  const dir = new THREE.DirectionalLight(night.dirColor, night.dirIntensity);
  dir.position.set(...night.dirPosition);
  const ambient = new THREE.AmbientLight(0xffffff, 0.06);
  scene.add(hemi, dir, dir.target, ambient);
  return { hemi, dir, ambient };
}
