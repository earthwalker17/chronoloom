/**
 * Per-frame nameplate projections flow through this micro-store instead of
 * React state at the App level — only the small overlay components that
 * actually position things off the 3D scene re-render at frame rate.
 */
import { useSyncExternalStore } from "react";
import type { NameplatePos } from "./scene";

type Listener = () => void;
const listeners = new Set<Listener>();
let latest: NameplatePos[] = [];

export const platesStore = {
  publish(plates: NameplatePos[]): void {
    latest = plates;
    listeners.forEach((l) => l());
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get(): NameplatePos[] {
    return latest;
  },
};

export function usePlates(): NameplatePos[] {
  return useSyncExternalStore(platesStore.subscribe, platesStore.get);
}
