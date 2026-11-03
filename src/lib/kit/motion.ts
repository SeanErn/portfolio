/** Small helpers for scroll-driven animation. `p` is always a 0..1 progress value. */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Progress through the sub-range [a, b] of p, clamped to 0..1. */
export const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothstep. */
export const ease = (t: number) => t * t * (3 - 2 * t);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeIn = (t: number) => t ** 3;

/** 0 → 1 → 0 window: fades in over [a, b], holds, fades out over [c, d]. */
export const win = (p: number, a: number, b: number, c: number, d: number) =>
	ease(seg(p, a, b)) * (1 - ease(seg(p, c, d)));

/** Context key the /lab route uses to pin every <Pinned> to a fixed progress. */
export const FORCED_PROGRESS = 'forced-progress';
