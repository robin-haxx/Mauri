// ============================================
// PLAN-OBLIQUE PROJECTION  ("fixed 3D view")
// ============================================
// Ported from Te Manawa (TeManawa_projection.js). The simulation stays TOP-DOWN:
// positions, walkability, spawning and the spatial hash all live on the flat
// world grid — nothing here moves them. This module owns only the *paint*: the
// one mapping from a world point (plus the terrain elevation under it) to where
// it lands on screen, so the relief terrain bake and every billboarded entity
// agree on a single 3/4 projection.
//
// Plan-oblique, NOT isometric: no x-shear, no rotation. One formula —
//
//     screenX = worldX
//     screenY = worldY · K  −  elev · LIFT   (+ LIFT baseline, see groundY)
//
//   K     Pitch squash. 1.0 = straight top-down; lower tips the camera forward.
//   LIFT  Relief height in WORLD PIXELS at elevation 1.0. Authored as a fraction
//         of mapHeight (liftFrac) so it is resolution-independent.
//
// Mauri keeps K + liftFrac ≈ 1.0 on purpose: then projectedWorldHeight() equals
// mapHeight, so the standing terrain occupies the SAME [0,0,mapWidth,mapHeight]
// rect the flat map did. The 3D toggle therefore needs no change to the view
// transform (viewX/viewY/viewZoom/clip) — the far ridge simply rises to the top
// of the frame and the near edge stays pinned at the bottom.
//
// Pure and p5-free, so it can be reasoned about (and unit-tested) without the
// sketch. K and liftFrac come from CONFIG and are held HERE, never written back.

const Projection = {
  // Authoring bounds. configure() clamps into these rather than trusting input.
  K_MIN: 0.5,
  K_MAX: 1.0,
  LIFT_FRAC_MIN: 0.0,
  LIFT_FRAC_MAX: 0.35,

  // Defaults, so the module is usable before any level configures it.
  K: 0.8,
  liftFrac: 0.2,
  LIFT: 0.2 * 760,      // world px at elevation 1.0 — recomputed in configure()
  mapWidth: 760,
  mapHeight: 760,

  // Whether elevation lifts things off the flat plane. Defaults false so a flat
  // (2D) render never floats entities above the ground; the 3D toggle sets it true
  // and groundY() and the relief bake then agree.
  relief: false,

  _clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

  // Called on level load and on every 3D toggle, AFTER the terrain exists so the
  // map dimensions are known. Anything missing keeps the current value, anything
  // out of range is clamped.
  configure(opts) {
    const o = opts || {};
    if (Number.isFinite(o.K))        this.K = this._clamp(o.K, this.K_MIN, this.K_MAX);
    if (Number.isFinite(o.liftFrac)) this.liftFrac = this._clamp(o.liftFrac, this.LIFT_FRAC_MIN, this.LIFT_FRAC_MAX);
    if (o.mapWidth  > 0) this.mapWidth  = o.mapWidth;
    if (o.mapHeight > 0) this.mapHeight = o.mapHeight;
    this.LIFT = this.liftFrac * this.mapHeight;
    return this;
  },

  // ---- the projection (allocation-free scalars for the render hot path) ------
  // screenX is unchanged in plan-oblique; kept as a call so every renderer reads
  // symmetrically and a future shear would have exactly one home.
  projX(worldX) { return worldX; },

  // World y and the cell's elevation (0–1) → screen y, in WORLD units (before the
  // view zoom). elev defaults to 0 → the flat squash plane.
  projY(worldY, elev) { return worldY * this.K - (elev || 0) * this.LIFT; },

  // The render-facing vertical mapping every entity and the terrain share: the
  // PAINT-SPACE y (before the view zoom) where a thing standing on the ground at
  // (·, worldY) of elevation `elev` is drawn. The relief buffer is baked in this
  // exact space, so a sprite and the ground cell under it always line up.
  //
  // The +LIFT baseline keeps paint y ≥ 0: the highest possible peak (elev 1) sits
  // at worldY·K, flat ground (elev 0) sits LIFT below it, higher ground is drawn
  // higher on screen. While relief is off it is the flat plane (worldY unchanged,
  // elevation ignored) so 2D mode is pixel-for-pixel the old behaviour.
  groundY(worldY, elev) {
    return this.relief
      ? worldY * this.K - (elev || 0) * this.LIFT + this.LIFT
      : worldY;
  },

  // The world's on-screen vertical extent, in world units. With K + liftFrac = 1
  // this equals mapHeight, so the standing terrain fills the flat map's rect.
  projectedWorldHeight() { return this.mapHeight * this.K + this.LIFT; },

  // ---- inverse: screen → world (mouse picking) -------------------------------
  // screenY couples y and elevation, so invert by iteration: assume flat, sample
  // the height there, correct, repeat. elevAt(x, y) returns elevation 0–1. A
  // handful of steps converge for any sane LIFT. Allocates a result object, which
  // is fine off the per-frame render path (called only on click / preview).
  screenToWorld(screenX, screenY, elevAt) {
    const x = screenX;                 // projX is the identity
    if (!this.relief || this.LIFT === 0) return { x, y: screenY };
    let y = (screenY - this.LIFT) / this.K;   // flat first guess (drop the baseline)
    if (typeof elevAt === 'function') {
      for (let i = 0; i < 6; i++) {
        const e = elevAt(x, y) || 0;
        y = (screenY + e * this.LIFT - this.LIFT) / this.K;
      }
    }
    return { x, y };
  },

  // Restore module defaults. Handy for tests / a full reset.
  reset() {
    this.K = 0.8;
    this.liftFrac = 0.2;
    this.mapWidth = 760;
    this.mapHeight = 760;
    this.LIFT = 0.2 * 760;
    this.relief = false;
    return this;
  }
};
