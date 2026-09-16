// ============================================
// PLAN-OBLIQUE PROJECTION  ("fixed 3D view")
// ============================================
// The simulation stays top-down; this module owns only the paint: the one mapping
// from a world point (plus terrain elevation) to screen, so the relief bake and
// every billboarded entity share a single 3/4 projection.
//
// Plan-oblique, not isometric (no shear, no rotation):
//     screenX = worldX
//     screenY = worldY · K − elev · LIFT   (+ LIFT baseline, see groundY)
//   K     pitch squash. 1.0 = top-down; lower tips the camera forward.
//   LIFT  relief height in world px at elevation 1.0 (from liftFrac · mapHeight).
//
// With K + liftFrac ≈ 1.0 the standing terrain fills the flat map's rect, so the
// 3D toggle needs no change to the view transform. Pure and p5-free.

const Projection = {
  // Authoring bounds; configure() clamps into these.
  K_MIN: 0.5,
  K_MAX: 1.0,
  LIFT_FRAC_MIN: 0.0,
  LIFT_FRAC_MAX: 0.35,

  // Defaults, usable before any level configures it.
  K: 0.8,
  liftFrac: 0.2,
  LIFT: 0.2 * 760,      // world px at elevation 1.0; recomputed in configure()
  mapWidth: 760,
  mapHeight: 760,

  // Whether elevation lifts things off the flat plane. False in 2D, true in 3D.
  relief: false,

  _clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); },

  // Called on level load and every 3D toggle. Missing values keep, out-of-range clamp.
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
  // screenX is unchanged in plan-oblique; kept as a call for symmetry.
  projX(worldX) { return worldX; },

  // World y + elevation (0–1) → screen y, in world units. elev 0 = flat plane.
  projY(worldY, elev) { return worldY * this.K - (elev || 0) * this.LIFT; },

  // Paint-space y (before view zoom) where a thing at (·, worldY, elev) is drawn;
  // the relief buffer is baked in this same space so sprites and ground align. The
  // +LIFT baseline keeps paint y ≥ 0. When relief is off this is the flat plane.
  groundY(worldY, elev) {
    return this.relief
      ? worldY * this.K - (elev || 0) * this.LIFT + this.LIFT
      : worldY;
  },

  // On-screen vertical extent in world units. Equals mapHeight when K + liftFrac = 1.
  projectedWorldHeight() { return this.mapHeight * this.K + this.LIFT; },

  // ---- inverse: screen → world (mouse picking) -------------------------------
  // screenY couples y and elevation, so invert by iteration: assume flat, sample
  // height, correct, repeat. elevAt(x, y) returns elevation 0–1. Off the hot path.
  screenToWorld(screenX, screenY, elevAt) {
    const x = screenX;                 // projX is the identity
    if (!this.relief || this.LIFT === 0) return { x, y: screenY };
    let y = (screenY - this.LIFT) / this.K;   // flat first guess
    if (typeof elevAt === 'function') {
      for (let i = 0; i < 6; i++) {
        const e = elevAt(x, y) || 0;
        y = (screenY + e * this.LIFT - this.LIFT) / this.K;
      }
    }
    return { x, y };
  },

  // Restore module defaults.
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
