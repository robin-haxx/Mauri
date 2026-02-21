// ============================================
// PLAYER PROGRESS (persisted to localStorage)
// ============================================

const PROGRESS = {
  levelsCompleted: [],
  levelsUnlocked: [],
  bestScores: {},
  _storageKey: 'avianage_progress',
  
  init() {
    this.load();
    // Always ensure first level is unlocked
    const first = LEVEL_REGISTRY.getFirst();
    if (first && !this.levelsUnlocked.includes(first.id)) {
      this.levelsUnlocked.push(first.id);
    }
  },
  
  save() {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify({
        levelsCompleted: this.levelsCompleted,
        levelsUnlocked: this.levelsUnlocked,
        bestScores: this.bestScores
      }));
    } catch (e) {
      console.warn('Could not save progress:', e);
    }
  },
  
  load() {
    try {
      const data = localStorage.getItem(this._storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.levelsCompleted = parsed.levelsCompleted || [];
        this.levelsUnlocked = parsed.levelsUnlocked || [];
        this.bestScores = parsed.bestScores || {};
      }
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
    return this.levelsUnlocked.includes(levelId);
  },
  
  isCompleted(levelId) {
    return this.levelsCompleted.includes(levelId);
  },
  
  reset() {
    this.levelsCompleted = [];
    this.levelsUnlocked = [];
    this.bestScores = {};
    localStorage.removeItem(this._storageKey);
    this.init();
  }
};