// ============================================
// SIMULATION BENCHMARK RECORDER (debug tool)
// Armed from the level splash screen while debug mode (D) is on. Starts the
// level with the tutorial off, samples every animal population every 10
// in-game seconds (plus a final sample on win/loss), records how many of
// each placeable the player placed during each interval, and downloads the
// whole run as a CSV ready for graphing.
//
// CSV columns: time_s, <one per moa species>, other_moa, total_moa, eagles,
// eggs, n_<other entity types>, placed_<each placeable>, event
// ============================================

const BENCHMARK = {
  pending: false,    // armed from the menu; consumed by Game.init()
  active: false,
  finished: false,

  SAMPLE_INTERVAL: 600,   // frames — 10 seconds of game time at 60fps

  _rows: [],
  _moaKeys: [],
  _otherKeys: [],
  _placeableKeys: [],
  _placedSinceSample: {},
  _nextSampleAt: 0,
  _levelId: '',

  arm() { this.pending = true; },

  // Called from Game.init() when a run was armed from the menu
  start(game) {
    this.pending = false;
    this.active = true;
    this.finished = false;
    this._rows = [];
    this._nextSampleAt = this.SAMPLE_INTERVAL;
    this._levelId = (game.currentLevel && game.currentLevel.id) || 'level';

    // Fix the column set at run start from the level's own lists
    const species = game.simulation.activeSpecies || {};
    this._moaKeys = (species.moa || []).slice();
    this._otherKeys = Object.keys(game.simulation.otherEntities || {});
    this._placeableKeys = Object.keys(game.activePlaceables || {});
    this._resetPlacedCounts();

    this.sample(game, 'start');
    game.addNotification('Benchmark recording — 10s samples, CSV on win/loss', 'info');
  },

  _resetPlacedCounts() {
    this._placedSinceSample = {};
    for (const k of this._placeableKeys) this._placedSinceSample[k] = 0;
  },

  // Called from Game.tryPlace on every successful placement
  recordPlacement(type) {
    if (!this.active || this.finished) return;
    if (this._placedSinceSample[type] === undefined) this._placedSinceSample[type] = 0;
    this._placedSinceSample[type]++;
  },

  // Called every frame from Game.update while playing
  update(game) {
    if (!this.active || this.finished) return;
    if (game.playTime >= this._nextSampleAt) {
      this.sample(game, 'sample');
      this._nextSampleAt += this.SAMPLE_INTERVAL;
    }
  },

  sample(game, event) {
    const sim = game.simulation;

    // Moa, bucketed per species (off-list species land in other_moa)
    const counts = {};
    for (const k of this._moaKeys) counts[k] = 0;
    let otherMoa = 0, totalMoa = 0;
    for (const m of sim.moas) {
      if (!m.alive) continue;
      totalMoa++;
      if (counts[m.speciesKey] !== undefined) counts[m.speciesKey]++;
      else otherMoa++;
    }

    let eagles = 0;
    for (const e of sim.eagles) if (e.alive) eagles++;

    let eggs = 0;
    for (const e of sim.eggs) if (e.alive && !e.hatched) eggs++;

    const row = { time_s: +(game.playTime / 60).toFixed(1) };
    for (const k of this._moaKeys) row[k] = counts[k];
    row.other_moa = otherMoa;
    row.total_moa = totalMoa;
    row.eagles = eagles;
    row.eggs = eggs;
    for (const k of this._otherKeys) {
      const list = sim.otherEntities[k] || [];
      let n = 0;
      for (let i = 0; i < list.length; i++) if (list[i].alive) n++;
      row['n_' + k] = n;
    }
    for (const k of this._placeableKeys) {
      row['placed_' + k] = this._placedSinceSample[k] || 0;
    }
    row.event = event;

    this._rows.push(row);
    this._resetPlacedCounts();
  },

  // Final sample + CSV download; called when the run ends
  finish(game, event) {
    if (!this.active || this.finished) return;
    this.finished = true;
    this.sample(game, event);
    this._save();
    game.addNotification('Benchmark CSV downloaded', 'success');
  },

  // Abandon without saving (e.g. level restarted mid-run)
  cancel() {
    this.active = false;
    this.finished = false;
    this._rows = [];
  },

  _save() {
    if (!this._rows.length) return;
    const cols = Object.keys(this._rows[0]);
    const lines = [cols.join(',')];
    for (const r of this._rows) {
      lines.push(cols.map(c => (r[c] !== undefined ? r[c] : '')).join(','));
    }
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    saveStrings(lines, `benchmark_${this._levelId}_${stamp}.csv`);
  }
};
