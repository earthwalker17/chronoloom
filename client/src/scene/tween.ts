/**
 * Minimal keyed tween helper. No external lib.
 *
 * Each tween is keyed; starting a new tween with an existing key replaces it.
 * Retargeting pattern: callers always pass the *live* current value as `from`
 * (the apply callbacks write into the live objects), so re-issuing a tween
 * mid-flight naturally continues from wherever the previous one left off.
 */

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;

export const easeInOutCubic: Ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** apply(value, easedT) — easedT is provided for color-lerp style tweens. */
export type TweenApply = (value: number, easedT: number) => void;

interface ActiveTween {
  from: number;
  to: number;
  start: number; // -1 until first update tick
  ms: number;
  ease: Ease;
  apply: TweenApply;
}

export class Tweener {
  private readonly tweens = new Map<string, ActiveTween>();

  /** Start (or retarget) a tween. ms <= 0 applies the target immediately. */
  run(key: string, from: number, to: number, ms: number, apply: TweenApply, ease: Ease = easeInOutCubic): void {
    if (ms <= 0) {
      this.tweens.delete(key);
      apply(to, 1);
      return;
    }
    this.tweens.set(key, { from, to, start: -1, ms, ease, apply });
  }

  /** Advance all tweens to `now` (ms timestamp, e.g. performance.now()). */
  update(now: number): void {
    for (const [key, tw] of this.tweens) {
      if (tw.start < 0) tw.start = now;
      const raw = Math.min(1, (now - tw.start) / tw.ms);
      const t = tw.ease(raw);
      tw.apply(tw.from + (tw.to - tw.from) * t, t);
      if (raw >= 1) this.tweens.delete(key);
    }
  }

  clear(): void {
    this.tweens.clear();
  }
}
