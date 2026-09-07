// ============================================================
// MAURI — FREE PLAY CLIMATE DRIFT
// ------------------------------------------------------------
// One pure function of a game-time clock. No state, no p5, no dependencies.
//
//     ClimateDrift.indexAt(years, cfg) -> coldIndex in [warmFloor, coldCap]
//
// coldIndex is the *glacial severity of the moment*: 0 = interglacial (winters as
// authored in SEASONS), 1 = full glacial (winters at their harshest). It is a slow,
// multi-year oscillation whose cold peaks DEEPEN across the run — a stark
// glacial<->interglacial swing, with ramped (eased) ends, tuned so a run is "quite
// difficult by cycle 10".
//
// The season system already handles summer<->winter WITHIN a year. coldIndex sits
// on top of that: it decides which YEARS are glacial (brutal winters) versus
// interglacial (mild winters, breathing room to rebuild), and how deep the glacials
// have grown. SeasonManager folds it into the winter end of its getters; nothing
// here writes back to CONFIG or SEASONS (that would compound across resets — see
// MISTAKES.md).
//
// Design of the curve (see FREEPLAY_PLAN.md §4.1 and the decisions that fixed it):
//   * A STARK oscillation: a cosine contrasted toward a trapezoid, so the climate
//     HOLDS at glacial and interglacial and RAMPS between them, rather than a soft
//     sine that is never really at either.
//   * DEEPENING peaks: the glacial peak severity follows a smoothstep 0 -> coldCap
//     over `rampCycles` years. Smoothstep is gentle at BOTH ends — the run eases in
//     (early years are the easy, learn-the-loop phase) and eases into the cap around
//     cycle `rampCycles`, then holds there. That is the "ramp at the ends".
//   * Interglacials stay survivable: at a trough coldIndex returns to `warmFloor`.
//
// This is a GAME DIFFICULTY CURVE, not a paleoclimate, so a parametric curve is the
// right tool (the Te Manawa fork uses an anchor TABLE precisely because it must
// reproduce a REAL sequence — the opposite requirement). See MISTAKES.md.
// ============================================================

const ClimateDrift = {
  // ---- tunables (a level overrides via mechanics.climateDrift = { ... }) --------
  DEFAULTS: {
    periodYears:  3.0,  // years per glacial<->interglacial oscillation (2 harsh yrs, 1 relief)
    rampCycles:   10,   // years to grow the glacial ceiling from ~0 to coldCap ("hard by 10")
    coldCap:      1.0,  // deepest glacial severity (1 = full glacial)
    warmFloor:    0.0,  // hard floor on the index (kept for clamping / future use)
    baselineFrac: 0.2,  // a relief year still sits at this fraction of the current ceiling,
                        //   so interglacials cool over the run but stay rebuildable
    starkness:    1.0,  // 0 = soft sine .. 1 = trapezoid (holds at the extremes)
    phaseOffset:  0.0   // radians; 0 => the run OPENS in an interglacial trough
  },

  // Merge a level's mechanics.climateDrift onto the defaults. `climateDrift: true`
  // (a bare flag) uses the defaults; an object overrides individual knobs.
  cfgFrom(mechanics) {
    const d = this.DEFAULTS;
    const o = (mechanics && typeof mechanics.climateDrift === 'object')
      ? mechanics.climateDrift : null;
    if (!o) return Object.assign({}, d);
    return {
      periodYears:  o.periodYears  != null ? o.periodYears  : d.periodYears,
      rampCycles:   o.rampCycles   != null ? o.rampCycles   : d.rampCycles,
      coldCap:      o.coldCap      != null ? o.coldCap      : d.coldCap,
      warmFloor:    o.warmFloor    != null ? o.warmFloor    : d.warmFloor,
      baselineFrac: o.baselineFrac != null ? o.baselineFrac : d.baselineFrac,
      starkness:    o.starkness    != null ? o.starkness    : d.starkness,
      phaseOffset:  o.phaseOffset  != null ? o.phaseOffset  : d.phaseOffset
    };
  },

  // ---- small pure helpers (Math only, so this file runs under Node) -------------
  _clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); },
  _smooth01(x) { const t = this._clamp(x, 0, 1); return t * t * (3 - 2 * t); },
  _smoothstep(edge0, edge1, x) {
    if (edge1 === edge0) return x < edge0 ? 0 : 1;
    return this._smooth01((x - edge0) / (edge1 - edge0));
  },

  // 0..1 stark oscillation over WHOLE cycles. 0 at an interglacial trough, 1 at a
  // glacial peak. Keyed off the integer cycle (not fractional years) so a glacial
  // always lands ON a year — its winter — and never drifts onto a summer.
  // Contrasted toward a trapezoid by `starkness`.
  _starkWave(cycle, cfg) {
    const raw = 0.5 - 0.5 * Math.cos((2 * Math.PI * cycle) / cfg.periodYears + cfg.phaseOffset);
    if (cfg.starkness <= 0) return raw;
    const ss2 = this._smooth01(this._smooth01(raw));   // double smoothstep => trapezoid
    return raw + (ss2 - raw) * this._clamp(cfg.starkness, 0, 1);
  },

  // The deepening ceiling: the severity a glacial peak reaches at this cycle. Grows
  // 0 -> coldCap over rampCycles, gently at BOTH ends (smoothstep), then holds. This
  // is the "ramp at the ends".
  ceilingAt(cycle, cfg) {
    cfg = cfg || this.DEFAULTS;
    return cfg.coldCap * this._smoothstep(0, cfg.rampCycles, cycle);
  },

  // ---- THE CURVE ---------------------------------------------------------------
  // Severity of a whole cycle (year), held constant across its four seasons. The sim
  // reads this; the season getters scale their winter end by it, so a glacial year
  // has a brutal winter and an interglacial year a mild one — with the glacials
  // deepening across the run and even relief years cooling toward baselineFrac.
  severityOfCycle(cycle, cfg) {
    cfg = cfg || this.DEFAULTS;
    if (cycle <= 0) return cfg.warmFloor;         // the opening year is the easy, learn-it year
    const ceil = this.ceilingAt(cycle, cfg);      // how deep glacials have grown
    const wave = this._starkWave(cycle, cfg);     // where in the oscillation this year sits
    const idx = ceil * (cfg.baselineFrac + (1 - cfg.baselineFrac) * wave);
    return this._clamp(idx, cfg.warmFloor, cfg.coldCap);
  },

  // `years` = fractional years elapsed (playTime / (4 * seasonDuration)). Constant
  // within a year by design (see severityOfCycle) — the value the sim folds in.
  indexAt(years, cfg) {
    return this.severityOfCycle(Math.floor(years), cfg);
  },

  // This year's severity, for scaling its population goals and labelling the HUD.
  cycleWinterIndex(cycle, cfg) {
    return this.severityOfCycle(cycle, cfg);
  },

  // A coarse, readable band name for the HUD/encyclopedia (never read by the sim).
  stageName(idx) {
    if (idx < 0.15) return 'interglacial';
    if (idx < 0.45) return 'cooling';
    if (idx < 0.75) return 'glacial';
    return 'full glacial';
  }
};

// Node/headless can require this file to audit the curve without p5.
if (typeof module !== 'undefined' && module.exports) module.exports = { ClimateDrift };
