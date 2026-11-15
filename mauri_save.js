// ============================================================================
// THE SAVE GAME: seeds, attempts, high scores, and the save as one file
// ============================================================================
// Every attempt at a level runs on a SEED (Game._initTerrainAndSeason): p5's random() and
// noise() are seeded with it, so the land (and, as far as the sim's rolls stay on p5's
// generator, the play) comes back the same when the seed is played again. Where the seed
// comes from, first that applies:
//   a research batch's  (BENCHMARK.nextSeed: tools/batch.js, ?bench=)
//   a replayed one      (Game._replaySeed: "Replay seed" on an end card, a high score's ▶,
//                        "Play a seed…" on a level's splash, "Replay best seed" on the journey)
//   the URL's           (?seed=<n>, every level started from that page)
//   a fresh one         (SAVEGAME.newSeed)
//
// When an attempt ends (won, lost, a run ended from the pause card, or left through Restart or
// Exit to Menu) Game._closeAttempt hands SAVEGAME.record its tally. That keeps, in PROGRESS
// (mauri_progress.js, so in the one localStorage save):
//   stats[levelId]       attempts, wins, losses, runs ended, quits, seconds played, best score
//                        and years, the last seed and when it was last played
//   highScores[levelId]  the best MAX_SCORES results, each with its seed, date and tally. A
//                        level's high scores are its wins; an endless level (endless or
//                        endlessChapters: it is never won) ranks every run by where it ended.
//   attempts             the last MAX_LOG attempts at anything, newest last
// A research run (?bench=) records nothing, as it writes no campaign record either.
//
// EXPORT / IMPORT (the level select's Settings): the whole save as one JSON file, which is
// PROGRESS (levels won and unlocked, best scores, the above), the journey's record
// (CAMPAIGN.record: who is alive, the herds, the bounty) and the two display preferences. An
// import replaces all of it; the save it replaced is kept (under _backupKey) so "Undo import"
// can put it back.
// ============================================================================

const SAVEGAME = {
  FORMAT: 'avianage-save',
  VERSION: 1,
  MAX_SCORES: 10,
  MAX_LOG: 200,
  _backupKey: 'avianage_save_backup',
  // The display preferences carried in a save (mauri_sketch.js: PERF_PREF_KEY, GL_PREF_KEY).
  PREF_KEYS: ['mauri_perfMode', 'mauri_useGL'],

  // A fresh seed: a positive 31-bit whole number (Math.random, as p5's generator is about to be
  // seeded with it).
  newSeed() { return 1 + Math.floor(Math.random() * 2147483646); },

  // A research run's attempts are not the player's. (Asked as a level's land is seeded, when a
  // benchmark run about to start is still `pending`; a finished one left `active` is cancelled
  // by the next ordinary start, which does count.)
  research() { return typeof BENCHMARK !== 'undefined' && !!BENCHMARK.pending; },

  // A level that is never won: its runs rank by where they ended.
  isEndless(level) { return !!(level && (level.endless || level.endlessChapters)); },

  // ---- Recording an attempt ------------------------------------------------------------------
  // e: { level (id), seed, source, outcome: 'won' | 'lost' | 'ended' | 'quit', score, years,
  //      moa, mauri, seconds, goals, endless }. Returns { rank (1.. on the high scores, else 0),
  //      best (a new best score) }.
  record(e) {
    if (typeof PROGRESS === 'undefined' || !e || !e.level) return { rank: 0, best: false };
    const P = PROGRESS, id = e.level, now = new Date().toISOString();
    const entry = {
      level: id, seed: e.seed, outcome: e.outcome, score: Math.round(e.score || 0),
      years: e.years || 0, moa: e.moa || 0, mauri: Math.round(e.mauri || 0),
      seconds: Math.round(e.seconds || 0), goals: e.goals || 0, date: now
    };
    if (e.source === 'replay' || e.source === 'url') entry.replayed = true;

    const s = P.stats[id] || (P.stats[id] = {
      attempts: 0, won: 0, lost: 0, ended: 0, quit: 0, seconds: 0,
      bestScore: 0, bestYears: 0, firstPlayed: now
    });
    s.attempts++;
    s[e.outcome] = (s[e.outcome] || 0) + 1;
    s.seconds += entry.seconds;
    s.lastSeed = entry.seed;
    s.lastPlayed = now;
    s.bestYears = Math.max(s.bestYears || 0, entry.years);

    P.attempts.push(entry);
    if (P.attempts.length > this.MAX_LOG) P.attempts.splice(0, P.attempts.length - this.MAX_LOG);

    // The high scores: a win, or any end of an endless run that got anywhere.
    let rank = 0, best = false;
    const counts = e.outcome === 'won' || (e.endless && (entry.seconds > 0 || entry.years > 0));
    if (counts) {
      const list = P.highScores[id] || (P.highScores[id] = []);
      const prevBest = list.length ? list[0].score : null;
      list.push(entry);
      list.sort((a, b) => (b.score - a.score) || (a.date < b.date ? -1 : 1));
      if (list.length > this.MAX_SCORES) list.length = this.MAX_SCORES;
      rank = list.indexOf(entry) + 1;
      best = rank === 1 && (prevBest == null || entry.score > prevBest);
      s.bestScore = Math.max(s.bestScore || 0, entry.score);
      P.bestScores[id] = Math.max(P.bestScores[id] || 0, entry.score);
    }
    P.save();
    return { rank, best };
  },

  // A level's high scores (best first) and its best one, or null.
  scores(levelId) { return (typeof PROGRESS !== 'undefined' && PROGRESS.highScores[levelId]) || []; },
  best(levelId) { return this.scores(levelId)[0] || null; },

  // ---- The save as one file ------------------------------------------------------------------
  snapshot() {
    const prefs = {};
    for (const k of this.PREF_KEYS) {
      try { const v = localStorage.getItem(k); if (v != null) prefs[k] = v; } catch (e) { /* no storage */ }
    }
    let campaign = null;
    if (typeof CAMPAIGN !== 'undefined') {
      // (A ?record= run plays a record it was handed: the saved one is what gets exported.)
      campaign = CAMPAIGN._ephemeral ? CAMPAIGN._load() : CAMPAIGN.record;
    }
    return JSON.parse(JSON.stringify({
      format: this.FORMAT, version: this.VERSION, game: 'Avian Age',
      exportedAt: new Date().toISOString(),
      progress: typeof PROGRESS !== 'undefined' ? PROGRESS.toJSON() : null,
      campaign, prefs
    }));
  },

  // A one-line summary of a snapshot, for the Settings status line.
  describe(snap) {
    const p = (snap && snap.progress) || {};
    const won = (p.levelsCompleted || []).length;
    const runs = Object.values(p.stats || {}).reduce((a, s) => a + (s.attempts || 0), 0);
    const scores = Object.values(p.highScores || {}).reduce((a, l) => a + l.length, 0);
    return `${won} level${won === 1 ? '' : 's'} won, ${runs} attempt${runs === 1 ? '' : 's'}, ${scores} high score${scores === 1 ? '' : 's'}`;
  },

  // Download the save as a .json file. Returns the summary line.
  exportToFile() {
    const snap = this.snapshot();
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    const name = `AvianAge_save_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return this.describe(snap);
  },

  // Read a save file's text. Returns the snapshot, or throws with a line the player can read.
  parse(text) {
    let o;
    try { o = JSON.parse(text); } catch (e) { throw new Error("That file isn't a save (it isn't JSON)."); }
    if (!o || o.format !== this.FORMAT || !o.progress || typeof o.progress !== 'object') {
      throw new Error("That file isn't an Avian Age save.");
    }
    if ((o.version | 0) > this.VERSION) throw new Error("That save is from a newer version of the game.");
    return o;
  },

  // Make a snapshot the save. The one it replaces is kept for undo() unless `keepBackup` is false.
  apply(snap, keepBackup = true) {
    if (keepBackup) {
      try { localStorage.setItem(this._backupKey, JSON.stringify(this.snapshot())); }
      catch (e) { console.warn('[save] could not keep a backup:', e); }
    }
    if (typeof PROGRESS !== 'undefined') {
      PROGRESS.fromJSON(snap.progress);
      PROGRESS.save();
      PROGRESS.init();   // (reads it back, and keeps the first level unlocked)
      PROGRESS.save();
    }
    if (typeof CAMPAIGN !== 'undefined') {
      CAMPAIGN._ephemeral = false;
      CAMPAIGN.record = (snap.campaign && CAMPAIGN._normalize(snap.campaign)) || CAMPAIGN.defaultRecord();
      CAMPAIGN.save();
    }
    const prefs = snap.prefs || {};
    for (const k of this.PREF_KEYS) {
      if (typeof prefs[k] !== 'string') continue;
      try { localStorage.setItem(k, prefs[k]); } catch (e) { /* no storage */ }
      if (k === 'mauri_perfMode' && typeof setPerfMode === 'function') setPerfMode(prefs[k] === '1', false);
    }
    return this.describe(snap);
  },

  hasBackup() {
    try { return !!localStorage.getItem(this._backupKey); } catch (e) { return false; }
  },

  // Put back the save the last import replaced.
  undo() {
    let snap = null;
    try { snap = JSON.parse(localStorage.getItem(this._backupKey)); } catch (e) { snap = null; }
    if (!snap || !snap.progress) throw new Error("There's no earlier save to put back.");
    const line = this.apply(snap, false);
    try { localStorage.removeItem(this._backupKey); } catch (e) { /* no storage */ }
    return line;
  },

  // Ask the browser for a save file, and import it. done(error | null, summaryLine). Must run
  // inside the click (a browser opens a file picker only for one).
  pickAndImport(done) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { done(null, this.apply(this.parse(String(reader.result)))); }
        catch (e) { done(e, null); }
      };
      reader.onerror = () => done(new Error("That file couldn't be read."), null);
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
  }
};
