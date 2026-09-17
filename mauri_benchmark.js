// ============================================
// SIMULATION BENCHMARK RECORDER (debug tool)
// Armed from the level splash while debug mode (D) is on. Runs the level with the
// tutorial off, samples every animal population every 10 in-game seconds, records
// placeables placed per interval, and downloads the run as a CSV.
//
// The run ends (final sample + CSV) on a win/loss, or after ENDLESS_YEARS in-game
// years on an endless level (Free Play). Default 1 year; set BENCHMARK.endlessYears
// or arm via armBatch to record more.
//
// CSV columns: time_s, year, season, <one per moa species>, other_moa,
// total_moa, eagles, eggs, n_<other entity types>, placed_<each placeable>, event
// ============================================

const BENCHMARK = {
  pending: false,    // armed from the menu; consumed by Game.init()
  active: false,
  finished: false,

  // Batch mode: run N playthroughs back-to-back, each saving its own CSV.
  batchTotal: 0,
  batchIndex: 0,
  _restartAtFrame: null,
  _game: null,

  SAMPLE_INTERVAL: 600,   // frames; 10 seconds of game time at 60fps

  // Endless mode has no win: record this many in-game years, then finish + save.
  endlessYears: 1,

  _rows: [],
  _moaKeys: [],
  _otherKeys: [],
  _placeableKeys: [],
  _placedSinceSample: {},
  _nextSampleAt: 0,
  _levelId: '',

  arm() { this.armBatch(1); },

  // Arm a batch of n back-to-back runs
  armBatch(n) {
    this.batchTotal = n;
    this.batchIndex = 0;
    this.pending = true;
  },

  // Called from Game.init() when a run was armed from the menu
  start(game) {
    this.pending = false;
    this.active = true;
    this.finished = false;
    this._game = game;
    this.batchIndex++;
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
    const endless = this._endlessDeadline(game) > 0;
    const yrs = Math.max(1, this.endlessYears);
    const label = this.batchTotal > 1
      ? `Benchmark run ${this.batchIndex}/${this.batchTotal} recording…`
      : (endless
          ? `Benchmark recording; 10s samples, CSV after ${yrs} year${yrs > 1 ? 's' : ''}`
          : 'Benchmark recording; 10s samples, CSV on win/loss');
    game.addNotification(label, 'info');
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
    // Endless levels never win on their own; close the run after a fixed number of years.
    const deadline = this._endlessDeadline(game);
    if (deadline && game.playTime >= deadline) this.finish(game, 'year_end');
  },

  // Frame count at which an endless run should stop, or 0 for a non-endless level.
  _endlessDeadline(game) {
    if (!game.currentLevel || !game.currentLevel.endless) return 0;
    const seasonDur = (typeof CONFIG !== 'undefined' && CONFIG.seasonDuration) || 3600;
    return Math.max(1, this.endlessYears) * 4 * seasonDur;
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
    // Year/season markers for the population arc.
    row.year = (game.cycle | 0) + 1;   // 1-based in-game year
    row.season = (game.seasonManager && game.seasonManager.currentKey) || '';
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

    if (this.batchIndex < this.batchTotal) {
      // More runs queued; auto-restart after a short delay.
      this._restartAtFrame = frameCount + 90;
      game.addNotification(`Benchmark ${this.batchIndex}/${this.batchTotal} done; next run starting…`, 'success');
    } else {
      const n = this.batchTotal;
      this.batchTotal = 0;
      this.batchIndex = 0;
      game.addNotification(n > 1 ? `Benchmark batch complete (${n} CSVs)` : 'Benchmark CSV downloaded', 'success');
    }
  },

  // Called every frame from the main draw() loop; performs a queued restart
  tick() {
    if (this._restartAtFrame !== null && frameCount >= this._restartAtFrame) {
      this._restartAtFrame = null;
      this.pending = true;          // re-arm the next run
      if (this._game) this._game.init();
    }
  },

  // Abandon without saving (e.g. level restarted mid-run)
  cancel() {
    this.active = false;
    this.finished = false;
    this.batchTotal = 0;
    this.batchIndex = 0;
    this._restartAtFrame = null;
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
    const runTag = this.batchTotal > 1 ? `run${this.batchIndex}of${this.batchTotal}_` : '';
    saveStrings(lines, `benchmark_${this._levelId}_${runTag}${stamp}.csv`);
  }
};
