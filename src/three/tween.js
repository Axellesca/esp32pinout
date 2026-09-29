/**
 * Minimal tween helper. Deliberately tiny: the project is not allowed to add another
 * dependency for animation, and everything here is driven by requestAnimationFrame deltas.
 *
 * Usage:
 *   const tweener = new Tweener();
 *   tweener.to({ duration: 400, onUpdate: t => obj.scale.setScalar(lerp(a, b, t)) });
 *   tweener.to({ tag: 'flip', ... });   // a new tween with the same tag cancels the old one
 *   tweener.update(nowMs);
 */

export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
};

export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent exponential smoothing. `rate` is roughly "per second". */
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

class Tween {
  constructor(opts) {
    this.start = opts.now + (opts.delay ?? 0);
    this.duration = Math.max(1, opts.duration ?? 400);
    this.ease = opts.ease ?? Ease.inOutCubic;
    this.onUpdate = opts.onUpdate;
    this.onComplete = opts.onComplete;
    this.tag = opts.tag ?? null;
    this.done = false;
  }

  advance(now) {
    const raw = (now - this.start) / this.duration;
    if (raw < 0) return;
    const t = raw >= 1 ? 1 : raw;
    if (this.onUpdate) this.onUpdate(this.ease(t), t);
    if (t === 1) {
      this.done = true;
      if (this.onComplete) this.onComplete();
    }
  }
}

export class Tweener {
  constructor() {
    this.items = [];
  }

  to(opts) {
    if (opts.tag) this.cancel(opts.tag);
    const tween = new Tween({ ...opts, now: opts.now ?? this._now ?? 0 });
    this.items.push(tween);
    return tween;
  }

  cancel(tag) {
    this.items = this.items.filter((i) => i.tag !== tag);
  }

  /** True while a tween with this tag is running. */
  has(tag) {
    return this.items.some((i) => i.tag === tag);
  }

  get active() {
    return this.items.length;
  }

  update(now) {
    this._now = now;
    if (this.items.length === 0) return;
    for (const item of this.items) item.advance(now);
    if (this.items.some((i) => i.done)) {
      this.items = this.items.filter((i) => !i.done);
    }
  }
}
