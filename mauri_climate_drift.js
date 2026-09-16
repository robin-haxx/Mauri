// ============================================================
// MAURI — FREE PLAY CLIMATE DRIFT
// One pure function of a game-time clock. No state, no p5, no dependencies.
//
//     ClimateDrift.indexAt(years, cfg) -> coldIndex in [warmFloor, coldCap]
//
// coldIndex is the glacial severity of the moment: 0 = interglacial (winters as
// authored in SEASONS), 1 = full glacial (harshest winters). A slow multi-year
// oscillation whose cold peaks deepen across the run. SeasonManager folds it into
// the winter end of its getters; nothing here writes back to CONFIG or SEASONS.
// A game difficulty curve, not a paleoclimate.
// ============================================================

const ClimateDrift = {
  // ---- tunables (a level overrides via mechanics.climateDrift = { ... }) --------
  DEFAULTS: {
    periodYears:  3.0,  // years per glacial<->interglacial oscillation
    rampCycles:   10,   // years to grow the glacial ceiling to coldCap
    coldCap:      1.0,  // deepest glacial severity (1 = full glacial)
    warmFloor:    0.0,  // hard floor on the index
    baselineFrac: 0.2,  // a relief year sits at this fraction of the current ceiling
    starkness:    1.0,  // 0 = soft sine .. 1 = trapezoid (holds at the extremes)
    phaseOffset:  0.0   // radians; 0 => run opens in an interglacial trough
  },

  // Merge a level's mechanics.climateDrift onto the defaults (bare true = defaults).
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

  // 0..1 stark oscillation over whole cycles: 0 at an interglacial trough, 1 at a
  // glacial peak. Keyed off the integer cycle. Contrasted toward a trapezoid by starkness.
  _starkWave(cycle, cfg) {
    const raw = 0.5 - 0.5 * Math.cos((2 * Math.PI * cycle) / cfg.periodYears + cfg.phaseOffset);
    if (cfg.starkness <= 0) return raw;
    const ss2 = this._smooth01(this._smooth01(raw));   // double smoothstep => trapezoid
    return raw + (ss2 - raw) * this._clamp(cfg.starkness, 0, 1);
  },

  // The deepening ceiling: severity a glacial peak reaches at this cycle. Grows
  // 0 -> coldCap over rampCycles, then holds.
  ceilingAt(cycle, cfg) {
    cfg = cfg || this.DEFAULTS;
    return cfg.coldCap * this._smoothstep(0, cfg.rampCycles, cycle);
  },

  // ---- THE CURVE ---------------------------------------------------------------
  // Severity of a whole cycle (year), held constant across its four seasons. Season
  // getters scale their winter end by it: glacial years bite, interglacial years ease.
  severityOfCycle(cycle, cfg) {
    cfg = cfg || this.DEFAULTS;
    if (cycle <= 0) return cfg.warmFloor;         // opening year is the easy one
    const ceil = this.ceilingAt(cycle, cfg);      // how deep glacials have grown
    const wave = this._starkWave(cycle, cfg);     // where in the oscillation this year sits
    const idx = ceil * (cfg.baselineFrac + (1 - cfg.baselineFrac) * wave);
    return this._clamp(idx, cfg.warmFloor, cfg.coldCap);
  },

  // years = fractional years elapsed. Constant within a year (see severityOfCycle).
  indexAt(years, cfg) {
    return this.severityOfCycle(Math.floor(years), cfg);
  },

  // This year's severity, for scaling its population goals and labelling the HUD.
  cycleWinterIndex(cycle, cfg) {
    return this.severityOfCycle(cycle, cfg);
  },

  // A coarse band name for the HUD/encyclopedia.
  stageName(idx) {
    if (idx < 0.15) return 'interglacial';
    if (idx < 0.45) return 'cooling';
    if (idx < 0.75) return 'glacial';
    return 'full glacial';
  }
};

// Node/headless can require this file to audit the curve without p5.
if (typeof module !== 'undefined' && module.exports) module.exports = { ClimateDrift };
