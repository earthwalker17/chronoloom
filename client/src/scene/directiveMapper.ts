/**
 * Maps a SceneDirective onto every live scene module, tweening over `ms`
 * via the shared Tweener (keyed tweens + live `from` values make every
 * channel retarget-safe mid-flight).
 *
 * Combination order: time-of-day base → weather → mood → location tint
 * (so e.g. market_office's "lanterns ≤ dim" clamp beats festive's floor).
 */
import * as THREE from "three";
import type { SceneDirective } from "@shared/types";
import type { CrowdLevel, LanternLevel, LocationId, PresetId } from "@shared/constants";
import { Tweener } from "./tween";
import { LIGHTING, type LightRig } from "./lighting";
import { CameraRig } from "./cameraRig";
import type { SceneMaterials } from "./materials";
import type { SkyUniforms } from "./renderer";
import { LANTERN_COUNTS, LANTERN_LIGHT_FACTOR, Lanterns } from "./lanterns";
import { BANNER_BASE_AMPLITUDE, Banners } from "./banners";
import { CROWD_COUNTS, Crowd } from "./crowd";
import { Heroes } from "./heroes";
import { Particles, type ParticleMode } from "./particles";

export const LOCATION_PRESETS: Record<LocationId, PresetId> = {
  market_cross: "market_street",
  silk_row: "stall_row",
  wine_house: "teahouse_porch",
  persian_lodge: "gate_plaza",
  bookshop: "back_alley",
  temple_hall: "back_alley",
  market_office: "gate_plaza",
  gate_lane: "back_alley",
};

const LANTERN_RANK: Record<LanternLevel, number> = { none: 0, dim: 1, bright: 2, festival: 3 };
const CROWD_DOWN: Record<CrowdLevel, CrowdLevel> = { packed: "busy", busy: "sparse", sparse: "sparse" };

function floorLantern(level: LanternLevel, floor: LanternLevel): LanternLevel {
  return LANTERN_RANK[level] < LANTERN_RANK[floor] ? floor : level;
}

function clampLantern(level: LanternLevel, max: LanternLevel): LanternLevel {
  return LANTERN_RANK[level] > LANTERN_RANK[max] ? max : level;
}

/** Lerp toward the color's own grayscale (snow desaturates the dir light). */
function desaturate(c: THREE.Color, amount: number): void {
  const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  c.lerp(new THREE.Color(l, l, l), amount);
}

const WARM = new THREE.Color(0xffb45c);
const STEEL = new THREE.Color(0x96a3b4);
const COLD_FOG = new THREE.Color(0x0e1626);
const INCENSE_BLUE = new THREE.Color(0x52688c);
const BLUE_GRAY = new THREE.Color(0x6d7c8c);
const FORMAL = new THREE.Color(0xe8e8e8);

export interface DirectiveMapperDeps {
  tweener: Tweener;
  renderer: THREE.WebGLRenderer;
  fog: THREE.FogExp2;
  skyUniforms: SkyUniforms;
  lights: LightRig;
  rig: CameraRig;
  materials: SceneMaterials;
  lanterns: Lanterns;
  banners: Banners;
  crowd: Crowd;
  heroes: Heroes;
  particles: Particles;
}

export class DirectiveMapper {
  constructor(private readonly deps: DirectiveMapperDeps) {}

  apply(d: SceneDirective, ms: number): void {
    const { tweener, renderer, fog, skyUniforms, lights, rig, materials, lanterns, banners, crowd, heroes, particles } =
      this.deps;
    const base = LIGHTING[d.timeOfDay];

    // --- Compose the target from the time-of-day base -----------------------
    const hemiSky = new THREE.Color(base.hemiSky);
    const hemiGround = new THREE.Color(base.hemiGround);
    const dirColor = new THREE.Color(base.dirColor);
    const fogColor = new THREE.Color(base.fogColor);
    const skyTop = new THREE.Color(base.skyTop);
    const skyBottom = new THREE.Color(base.skyBottom);
    let hemiIntensity = base.hemiIntensity;
    let dirIntensity = base.dirIntensity;
    let fogDensity = base.fogDensity;
    let exposure = base.exposure;
    let lanternLevel: LanternLevel = d.lanterns;
    let crowdLevel: CrowdLevel = d.crowd;
    let lanternBoost = 1;
    let flickerAmp = 1;
    let bannerAmp = BANNER_BASE_AMPLITUDE;
    let fovOffset = 0;

    // --- Weather -------------------------------------------------------------
    if (d.weather === "overcast") fogDensity *= 1.3;
    if (d.weather === "snow") {
      fogDensity *= 1.5;
      desaturate(dirColor, 0.65);
    }
    if (d.weather === "windy") bannerAmp *= 2.2;

    // --- Mood ----------------------------------------------------------------
    if (d.mood === "festive") {
      lanternLevel = floorLantern(lanternLevel, "bright");
      exposure *= 1.05;
      hemiSky.lerp(WARM, 0.12);
      lanternBoost *= 1.15;
    } else if (d.mood === "tense") {
      dirColor.lerp(STEEL, 0.55);
      fovOffset = -4;
      flickerAmp *= 1.8;
    } else if (d.mood === "ominous") {
      fogDensity *= 1.3;
      fogColor.lerp(COLD_FOG, 0.3);
      hemiIntensity *= 0.8;
    } else if (d.mood === "melancholy") {
      hemiSky.lerp(BLUE_GRAY, 0.45);
      hemiGround.lerp(BLUE_GRAY, 0.3);
      crowdLevel = CROWD_DOWN[crowdLevel];
    }

    // --- Location tint ---------------------------------------------------------
    if (d.locationId === "temple_hall") {
      hemiIntensity *= 0.9;
      dirIntensity *= 0.85;
      hemiSky.lerp(INCENSE_BLUE, 0.15);
      fogColor.lerp(INCENSE_BLUE, 0.18);
      crowdLevel = CROWD_DOWN[crowdLevel];
      flickerAmp *= 0.8;
    } else if (d.locationId === "market_office") {
      lanternLevel = clampLantern(lanternLevel, "dim");
      dirColor.lerp(FORMAL, 0.12);
    } else if (d.locationId === "gate_lane") {
      hemiIntensity *= 0.75;
    }

    // --- Particles (priority: snow > festive petals > windy dust) -------------
    let mode: ParticleMode | null = null;
    if (d.weather === "snow") mode = "snow";
    else if (d.mood === "festive") mode = "petals";
    else if (d.weather === "windy") mode = "dust";
    if (mode !== null) particles.setMode(mode);
    particles.setVisible(mode !== null);

    // --- Immediate (non-tweened) state -----------------------------------------
    heroes.setFocus(d.focusNpcIds.slice(0, 3));
    heroes.setLocationPreset(LOCATION_PRESETS[d.locationId]);
    rig.setPushIn(d.mood === "ominous");
    rig.goTo(LOCATION_PRESETS[d.locationId], ms, tweener);

    // --- Tween everything else ---------------------------------------------------
    this.color("light.hemi.sky", lights.hemi.color, hemiSky, ms);
    this.color("light.hemi.ground", lights.hemi.groundColor, hemiGround, ms);
    this.num("light.hemi.intensity", lights.hemi.intensity, hemiIntensity, ms, (v) => {
      lights.hemi.intensity = v;
    });
    this.color("light.dir.color", lights.dir.color, dirColor, ms);
    this.num("light.dir.intensity", lights.dir.intensity, dirIntensity, ms, (v) => {
      lights.dir.intensity = v;
    });
    this.vec("light.dir.position", lights.dir.position, new THREE.Vector3(...base.dirPosition), ms);

    this.color("fog.color", fog.color, fogColor, ms);
    this.num("fog.density", fog.density, fogDensity, ms, (v) => {
      fog.density = v;
    });
    this.color("sky.top", skyUniforms.topColor.value, skyTop, ms);
    this.color("sky.bottom", skyUniforms.bottomColor.value, skyBottom, ms);
    this.num("renderer.exposure", renderer.toneMappingExposure, exposure, ms, (v) => {
      renderer.toneMappingExposure = v;
    });
    this.num("materials.windowGlow", materials.windowGlow.opacity, base.windowGlow, ms, (v) => {
      materials.windowGlow.opacity = v;
    });

    this.num(
      "lantern.base",
      lanterns.base,
      base.lanternBase * LANTERN_LIGHT_FACTOR[lanternLevel] * lanternBoost,
      ms,
      (v) => {
        lanterns.base = v;
      },
    );
    this.num("lantern.flickerAmp", lanterns.flickerAmp, flickerAmp, ms, (v) => {
      lanterns.flickerAmp = v;
    });
    this.num("lantern.count", lanterns.count, LANTERN_COUNTS[lanternLevel], ms, (v) => {
      lanterns.setCount(Math.round(v));
    });
    this.num("crowd.count", crowd.count, CROWD_COUNTS[crowdLevel], ms, (v) => {
      crowd.setCount(Math.round(v));
    });
    this.num("banners.amplitude", banners.amplitude, bannerAmp, ms, (v) => {
      banners.amplitude = v;
    });
    this.num("camera.fovOffset", rig.fovOffset, fovOffset, ms, (v) => {
      rig.fovOffset = v;
    });
  }

  private num(key: string, from: number, to: number, ms: number, set: (v: number) => void): void {
    this.deps.tweener.run(key, from, to, ms, (v) => set(v));
  }

  private color(key: string, live: THREE.Color, to: THREE.Color, ms: number): void {
    const from = live.clone();
    this.deps.tweener.run(key, 0, 1, ms, (_v, t) => {
      live.lerpColors(from, to, t);
    });
  }

  private vec(key: string, live: THREE.Vector3, to: THREE.Vector3, ms: number): void {
    const from = live.clone();
    this.deps.tweener.run(key, 0, 1, ms, (_v, t) => {
      live.lerpVectors(from, to, t);
    });
  }
}
