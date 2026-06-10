/**
 * WebGLRenderer + Scene + exponential fog + gradient sky dome.
 * The sky dome is a large inverted sphere with a tiny two-stop vertical
 * gradient ShaderMaterial (uniform-driven, not a post pass).
 */
import * as THREE from "three";

export interface SkyUniforms {
  topColor: { value: THREE.Color };
  bottomColor: { value: THREE.Color };
}

export interface RendererBundle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  fog: THREE.FogExp2;
  sky: THREE.Mesh;
  skyUniforms: SkyUniforms;
  dispose(): void;
}

const SKY_VERT = /* glsl */ `
varying vec3 vWorldPosition;
void main() {
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 topColor;
uniform vec3 bottomColor;
varying vec3 vWorldPosition;
void main() {
  float h = clamp(vWorldPosition.y / 45.0, 0.0, 1.0);
  gl_FragColor = vec4(mix(bottomColor, topColor, pow(h, 0.75)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createRenderer(canvas: HTMLCanvasElement): RendererBundle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true, // required for screenshot()
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0x141a2a, 0.045);
  scene.fog = fog;

  const skyUniforms: SkyUniforms = {
    topColor: { value: new THREE.Color(0x202840) },
    bottomColor: { value: new THREE.Color(0x3a3450) },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyGeo = new THREE.SphereGeometry(70, 24, 12);
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  return {
    renderer,
    scene,
    fog,
    sky,
    skyUniforms,
    dispose() {
      skyGeo.dispose();
      skyMat.dispose();
      renderer.dispose();
    },
  };
}
