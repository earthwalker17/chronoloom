/**
 * Pointer picking over hero figures: hover (cursor + brighten via
 * Heroes.setHover) and click (drag-guarded) against the invisible fat
 * cylinder hit-proxies — never the limb meshes. Event-driven; no per-frame
 * cost beyond the pointermove raycast over ≤6 proxies.
 */
import * as THREE from "three";
import type { SceneHit } from "./diorama";
import type { Heroes } from "./heroes";

const DRAG_GUARD_PX = 5;

export class Picking {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private cb: ((hit: SceneHit | null) => void) | null = null;
  private downX = 0;
  private downY = 0;
  private downValid = false;
  private hovered: string | null = null;

  private readonly onMove = (e: PointerEvent): void => {
    const id = this.hitAt(e);
    if (id !== this.hovered) {
      this.hovered = id;
      this.heroes.setHover(id);
      this.canvas.style.cursor = id !== null ? "pointer" : "";
    }
  };

  private readonly onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downValid = true;
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (!this.downValid || e.button !== 0) return;
    this.downValid = false;
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (moved > DRAG_GUARD_PX) return; // drag, not a click
    const id = this.hitAt(e);
    this.cb?.(id !== null ? { kind: "npc", npcId: id } : null);
  };

  private readonly onLeave = (): void => {
    if (this.hovered !== null) {
      this.hovered = null;
      this.heroes.setHover(null);
      this.canvas.style.cursor = "";
    }
    this.downValid = false;
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly heroes: Heroes,
  ) {
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointerleave", this.onLeave);
  }

  onPick(cb: (hit: SceneHit | null) => void): void {
    this.cb = cb;
  }

  /** npcId under the pointer, or null. CSS-rect math is DPR-safe. */
  private hitAt(e: PointerEvent): string | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.ndc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const targets = this.heroes.getPickTargets();
    if (targets.length === 0) return null;
    let best: { npcId: string; dist: number } | null = null;
    for (const t of targets) {
      // Proxies are invisible — raycast each object directly (visibility-agnostic).
      const hits = this.raycaster.intersectObject(t.object, false);
      const first = hits[0];
      if (first && (best === null || first.distance < best.dist)) {
        best = { npcId: t.npcId, dist: first.distance };
      }
    }
    return best?.npcId ?? null;
  }

  dispose(): void {
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.style.cursor = "";
    this.cb = null;
  }
}
