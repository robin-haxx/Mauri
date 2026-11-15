// ============================================
// PLAYER PROGRESS (persisted to localStorage; exported and imported whole by mauri_save.js)
// ============================================

const PROGRESS = {
  levelsCompleted: [],
  levelsUnlocked: [],
  bestScores: {},
  // Seeds, attempts and high scores (mauri_save.js: SAVEGAME.record writes them).
  stats: {},          // levelId -> { attempts, won, lost, ended, quit, seconds, bestScore, ... }
  highScores: {},     // levelId -> [{ score, seed, outcome, date, years, moa, mauri, ... }], best first
  attempts: [],       // the last attempts at anything, newest last
  _storageKey: 'avianage_progress',
  
  init() {
    this.load();
    // Always ensure first level is unlocked
    const first = LEVEL_REGISTRY.getFirst();
    if (first && !this.levelsUnlocked.includes(first.id)) {
      this.levelsUnlocked.push(first.id);
    }
  },
  
  // The save's shape (also what a save file's `progress` holds; see SAVEGAME.snapshot).
  toJSON() {
    return {
      levelsCompleted: this.levelsCompleted,
      levelsUnlocked: this.levelsUnlocked,
      bestScores: this.bestScores,
      stats: this.stats,
      highScores: this.highScores,
      attempts: this.attempts
    };
  },

  // Take a saved shape, keeping only what has the right type (an older save has no stats).
  fromJSON(p) {
    p = p || {};
    const arr = (v) => Array.isArray(v) ? v.slice() : [];
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.assign({}, v) : {};
    this.levelsCompleted = arr(p.levelsCompleted).filter(id => typeof id === 'string');
    this.levelsUnlocked = arr(p.levelsUnlocked).filter(id => typeof id === 'string');
    this.bestScores = obj(p.bestScores);
    this.stats = obj(p.stats);
    this.highScores = {};
    for (const [id, list] of Object.entries(obj(p.highScores))) {
      if (Array.isArray(list)) this.highScores[id] = list.filter(e => e && typeof e.score === 'number');
    }
    this.attempts = arr(p.attempts).filter(e => e && typeof e === 'object');
  },

  save() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(this.toJSON()));
    } catch (e) {
      console.warn('Could not save progress:', e);
    }
  },
  
  load() {
    try {
      const data = localStorage.getItem(this._storageKey);
      if (data) this.fromJSON(JSON.parse(data));
    } catch (e) {
      console.warn('Could not load progress:', e);
    }
  },
  
  completeLevel(levelId, score) {
    if (!this.levelsCompleted.includes(levelId)) {
      this.levelsCompleted.push(levelId);
    }
    this.bestScores[levelId] = Math.max(this.bestScores[levelId] || 0, score);
    
    // Check if any new levels should unlock
    for (const level of LEVEL_REGISTRY.getAll()) {
      if (!this.levelsUnlocked.includes(level.id)) {
        if (!level.unlockCondition || level.unlockCondition(this)) {
          this.levelsUnlocked.push(level.id);
        }
      }
    }
    
    this.save();
  },
  
  isUnlocked(levelId) {
    // A level with no unlockCondition is always open (e.g. Free Play).
    if (typeof LEVEL_REGISTRY !== 'undefined') {
      const def = LEVEL_REGISTRY.get(levelId);
      if (def && !def.unlockCondition) return true;
    }
    return this.levelsUnlocked.includes(levelId);
  },
  
  isCompleted(levelId) {
    return this.levelsCompleted.includes(levelId);
  },
  
  reset() {
    this.levelsCompleted = [];
    this.levelsUnlocked = [];
    this.bestScores = {};
    this.stats = {};
    this.highScores = {};
    this.attempts = [];
    localStorage.removeItem(this._storageKey);
    this.init();
  }
};