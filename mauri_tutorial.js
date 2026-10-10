// ============================================
// TUTORIAL SYSTEM 
// ============================================

// Uniform scale for the guide's dialog panels; box, text, buttons, and the
// mantis sprite all grow together from this one knob. 1.0 = original size.
const TIP_PANEL_SCALE = 1.25;

const TRIGGER_TYPE = {
  IMMEDIATE: 'immediate',
  TIME: 'time',
  EVENT: 'event',
  CONDITION: 'condition',
  MANUAL: 'manual'
};

const TUTORIAL_EVENTS = {
  GAME_START: 'game_start',
  EAGLE_HUNTING: 'eagle_hunting',
  MOA_KILLED: 'moa_killed',
  FIRST_PLACEMENT: 'first_placement',
  SEASON_CHANGE: 'season_change',
  EAGLE_SPAWNED: 'eagle_spawned',
  POPULATION_MILESTONE: 'population_milestone',
  MOA_HUNGRY: 'moa_hungry',
  EGG_LAID: 'egg_laid',    // every moa egg laid, data: { egg, speciesKey }
  EGG_HATCHED: 'egg_hatched',
  LOW_MAURI: 'low_mauri',
  PLACEABLE_EXPIRED: 'placeable_expired',
  FIRST_EGG: 'first_egg',
  PLACEMENT: 'placement',  // fired on every successful placement, data: { type }
  YEAR_START: 'year_start', // endless: a year's focus, palette + goals are set, data: { cycle }
  NEST_RAID: 'nest_raid',   // a kea raid was rolled on a nest, data: { site, success }
  PLACEABLE_MOVED: 'placeable_moved', // a touch-and-hold move set an item down, data: { type }
  MODULE_BEAT: 'module_beat'          // a module level's story moment, data: { beat, director, ... }
};

// Named toolbar-button highlight targets → the placeable key each one shows.
const TOOL_BUTTON_KEYS = {
  kawakawaButton: 'kawakawa', shelterButton: 'shelter', nestButton: 'nest',
  StormButton: 'Storm', waterholeButton: 'waterhole', harakekeButton: 'harakeke'
};

// True while a "place this" tip's guided window is open (see
// tip.guidedPlaceable). Shared helper for level tutorial scripts.
function tutorialGuidedWindowActive(game) {
  const g = game.tutorial && game.tutorial.scratch.guidedPlaceable;
  return !!(g && game.playTime <= g.until);
}

// ============================================
// TUTORIAL SCRIPT REGISTRY
// Level tip scripts live in levels/tutorial_*.js and register here, keyed by
// level id ('default' = shared fallback). Game.init() resolves:
//   levelDef.tutorial.tips (inline override) -> registry[levelId] -> registry['default']
// ============================================
const TUTORIAL_REGISTRY = {
  _scripts: {},
  register(levelId, tips) { this._scripts[levelId] = tips; },
  get(levelId) { return this._scripts[levelId] || null; }
};


// ============================================
// UI ELEMENT BOUNDS CALCULATOR
// ============================================
class TutorialUIMapper {
  constructor(ui, config) {
    this.ui = ui;
    this.config = config;
  }
  
  getBounds(target) {
    const ui = this.ui;
    const config = this.config;
    const layout = ui.layout;
    // In fullscreen the HUD lives at the overlay positions, so highlights
    // must follow it there instead of the full-UI placements.
    const fs = (config.fullscreen && layout.fs) ? layout.fs : null;

    // Tool buttons by placeable key (level-scoped): 'tool:<key>'
    if (typeof target === 'string' && target.startsWith('tool:')) {
      const key = target.slice(5);
      const keys = Object.keys((ui.game && ui.game.activePlaceables) || {});
      const idx = keys.indexOf(key);
      return idx >= 0 ? this._getToolButtonBounds(idx) : null;
    }
    // Named tool buttons: resolve to the placeable's ACTUAL slot in the level's
    // palette (its order in game.activePlaceables), so the highlight tracks the
    // button wherever the level puts it. The old fixed indices assumed a single
    // global toolbar order and pointed at the wrong buttons once a level reordered
    // its palette (e.g. StormButton landed on the nest). The classic index is kept
    // only as a fallback for a level whose palette lacks that key.
    const classicToolIndex = {
      kawakawaButton: 0, shelterButton: 1, nestButton: 2,
      StormButton: 3, waterholeButton: 4, harakekeButton: 5
    };
    if (target in TOOL_BUTTON_KEYS) {
      const keys = Object.keys((ui.game && ui.game.activePlaceables) || {});
      const idx = keys.indexOf(TOOL_BUTTON_KEYS[target]);
      return this._getToolButtonBounds(idx >= 0 ? idx : classicToolIndex[target]);
    }
    
    // Fullscreen goals panel bounds (also stands in for the sidebar panels
    // that aren't drawn in fullscreen).
    const _fsGoals = fs ? {
      x: fs.goalsX - 12, y: fs.goalsY - 12,
      w: layout.sidebarPanelWidth + 24,
      h: ui.goalsPanelHeight() + 24
    } : null;

    switch (target) {
      case 'topBar':
      case 'topBarContent':
        if (fs) return { x: fs.mauriX - 10, y: fs.stripY - 5,
                         w: (fs.pauseBtnX + fs.btnSize) - fs.mauriX + 20, h: 80 };
        if (target === 'topBar')
          return { x: ui.topBar.x, y: ui.topBar.y, w: ui.topBar.width, h: ui.topBar.height };
        return { x: layout.mauriX - 10, y: 15, w: layout.timerX + 130 - layout.mauriX + 20, h: 80 };
      case 'sidebar':
        if (fs) return _fsGoals;
        return { x: ui.sidebar.x, y: ui.sidebar.y, w: ui.sidebar.width, h: ui.sidebar.height };
      case 'gameArea':
        if (fs) return { x: 0, y: 0, w: config.canvasWidth, h: config.canvasHeight };
        return { x: config.gameAreaX, y: config.gameAreaY, w: config.gameAreaWidth, h: config.gameAreaHeight };
      case 'bottomBar':
        if (fs) return { x: fs.toolbarStartX - 10, y: fs.toolbarY - 10,
                         w: layout.toolbarTotalWidth + 20, h: layout.toolbarBtnSize + 30 };
        return { x: ui.bottomBar.x, y: ui.bottomBar.y, w: ui.bottomBar.width, h: ui.bottomBar.height };
      // The top bar's Mauri counter is now a circular dial (renderMauriRing), not
      // the old 180x70 panel; the highlight must be the ring's bounding box.
      case 'mauriDisplay': {
        const cx = fs ? fs.mauriRingCX : layout.mauriRingCX;
        const cy = fs ? fs.mauriRingCY : layout.mauriRingCY;
        const r  = fs ? fs.mauriRingR  : layout.mauriRingR;
        return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, circle: true };
      }
      // Endless ecosystem dial (AVG POP / balance), right of the season ring.
      case 'popDial': {
        const cx = fs ? fs.popDialCX : layout.popDialCX;
        const cy = fs ? fs.popDialCY : layout.popDialCY;
        const r  = fs ? fs.popDialR  : layout.popDialR;
        return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, circle: true };
      }
      // Focus-species tiles under the fullscreen goals panel (the year's focus group, or the
      // off-focus keystone moa beside it). Docked, the focus falls back to the POPULATION
      // panel's species rows; the off-focus group has no docked tile.
      case 'focusSpecies':
      case 'offFocusSpecies': {
        const wantSurvival = target === 'offFocusSpecies';
        if (!fs) {
          if (wantSurvival) return null;
          return this.getBounds('populationPanel');
        }
        const tiles = (ui._fsFocusBtnBounds || []).filter(b => !!b.survival === wantSurvival);
        if (!tiles.length) return null;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const b of tiles) {
          x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
          x1 = Math.max(x1, b.x + b.size); y1 = Math.max(y1, b.y + b.size);
        }
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      // Season/year/time are now one circular ring (renderSeasonRing) in place of
      // the old season + TIME panels; both targets map to that ring.
      case 'seasonDisplay':
      case 'timerDisplay': {
        const cx = fs ? fs.ringCX : layout.ringCX;
        const cy = fs ? fs.ringCY : layout.ringCY;
        const r  = fs ? fs.ringR  : layout.ringR;
        return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, circle: true };
      }
      case 'pauseButton':
        if (fs) return { x: fs.pauseBtnX, y: fs.btnY, w: fs.btnSize, h: fs.btnSize };
        return { x: layout.pauseBtnX, y: layout.pauseBtnY, w: layout.pauseBtnSize, h: layout.pauseBtnSize };
      case 'fullscreenButton':
        if (fs) return { x: fs.fsBtnX, y: fs.btnY, w: fs.btnSize, h: fs.btnSize };
        return { x: layout.fsBtnX, y: layout.pauseBtnY, w: layout.pauseBtnSize, h: layout.pauseBtnSize };
      case 'migrationHint':
        // Not shown in fullscreen; anchor to the HUD strip instead
        if (fs) return { x: fs.mauriX, y: fs.stripY, w: 590, h: 70 };
        return { x: layout.migrationHintX, y: 110, w: layout.migrationHintWidth, h: 50 };
      case 'toolbar':
        const _tbX = fs ? fs.toolbarStartX : layout.toolbarStartX;
        const _tbY = fs ? fs.toolbarY : ui.toolbarY;
        return { x: _tbX - 10, y: _tbY - 10, w: layout.toolbarTotalWidth + 20, h: layout.toolbarBtnSize + 30 };
      // Sidebar panels report their live rect as they render (see mauri_UI.js), so
      // these highlights follow the panels wherever the layout puts them (the
      // POPULATION panel now sits directly under GOALS, above the EVENT LOG). Fall
      // back to a computed rect only if the panel hasn't been drawn yet this run.
      case 'goalsPanel':
        if (fs) return _fsGoals;
        return ui._goalsPanelBounds ||
          { x: ui.sidebar.x + layout.sidebarPadding, y: layout.sidebarPadding,
            w: layout.sidebarPanelWidth, h: ui.goalsPanelHeight() };
      case 'populationPanel':
        if (fs) return _fsGoals;
        return ui._populationPanelBounds ||
          { x: ui.sidebar.x + layout.sidebarPadding,
            y: layout.sidebarPadding + (ui.goalsPanelHeight()) + 12,
            w: layout.sidebarPanelWidth, h: layout.speciesPanelHeight };
      case 'eventLog':
        if (fs) return _fsGoals;
        return ui._eventLogBounds ||
          { x: ui.sidebar.x + layout.sidebarPadding, y: layout.sidebarPadding,
            w: layout.sidebarPanelWidth, h: layout.eventLogHeight };
      default:
        console.warn(`TutorialUIMapper: Unknown target "${target}"`);
        return null;
    }
  }

  _getToolButtonBounds(index) {
    const layout = this.ui.layout;
    const fs = (this.config.fullscreen && layout.fs) ? layout.fs : null;
    const slot = this.ui._toolbarSlotOffsets()[index];
    return {
      x: (fs ? fs.toolbarStartX : layout.toolbarStartX) +
         (slot != null ? slot : index * layout.toolbarSpacing),
      y: fs ? fs.toolbarY : this.ui.toolbarY,
      w: layout.toolbarBtnSize,
      h: layout.toolbarBtnSize
    };
  }
}

// ============================================
// TUTORIAL MANAGER CLASS
// ============================================
class TutorialManager {
  constructor(game) {
    this.game = game;
    this.tips = {};   // set per level via setLevelTips() (see TUTORIAL_REGISTRY)
    this.enabled = true;
    this.active = false;
    this.currentTip = null;
    this.shownTips = new Set();
    this.pendingTips = [];
    this.gameTimeAtStart = 0;
    this.eventQueue = [];

    // Per-run scratch space for tips (e.g. timestamps set in one tip's onShow
    // and read by another tip's condition). Cleared on init/reset.
    this.scratch = {};
    // Frames of live play (the game running, not paused) since the level began, for tips that
    // wait a while of play after another (see MODULE_TIP_KIT's line `wait`).
    this.liveTime = 0;

    // Timing
    this.tipDisplayTime = 0;
    this.minTimeBetweenTips = 180;
    this.lastTipTime = -this.minTimeBetweenTips;
    this.tipCooldowns = {};
    
    // UI mapping
    this.uiMapper = null;
    
    // Visual state
    this.fadeAlpha = 0;
    this.targetFadeAlpha = 0;
    this.highlightPulse = 0;
    
    // Button bounds
    this.nextButtonBounds = null;
    this.skipButtonBounds = null;
    this.panelBounds = null;
    
    // Pause tracking
    this._pausedByTutorial = false;
    
    // Guide sprite
    this.guideSprite = null;
    this._guideWobble = 0;
  }
  
  setGuideSprite(sprite) {
    this.guideSprite = sprite;
  }

  setLevelTips(tips) {
    this.tips = tips || {};
  }
  
  init() {
    this.shownTips.clear();
    this.pendingTips = [];
    this.currentTip = null;
    this.active = false;
    this.gameTimeAtStart = this.game.playTime;
    this.lastTipTime = -this.minTimeBetweenTips;
    this.tipCooldowns = {};
    this.scratch = {};
    this.liveTime = 0;
    this._pausedByTutorial = false;

    if (this.game.ui) {
      this.uiMapper = new TutorialUIMapper(this.game.ui, CONFIG);
    }
    
    if (this.enabled) this.fireEvent(TUTORIAL_EVENTS.GAME_START);
  }
  
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.dismissCurrentTip();
    this.game.addNotification(
      this.enabled ? "Tutorial enabled" : "Tutorial disabled (press T to re-enable)", 
      'info'
    );
  }
  
  skipTutorial() {
    this.enabled = false;
    this.pendingTips = [];
    this.eventQueue = [];
    this.dismissCurrentTip();
    this.game.addNotification("Tutorial skipped. Press T anytime for tips!", 'info');
  }

  // ============================================
  // EVENT SYSTEM
  // ============================================
  
  fireEvent(eventType, data = {}) {
    if (!this.enabled) return;
    
    if (this.active) {
      this.eventQueue.push({ type: eventType, data, time: this.game.playTime });
      return;
    }
    
    this._checkEventTriggers(eventType, data);
  }
  
  // Unified guard: returns true if this tip should be skipped
  _shouldSkipTip(tipId, tip) {
    if (tip.showOnce && this.shownTips.has(tipId)) return true;
    if (this.tipCooldowns[tipId] && this.game.playTime < this.tipCooldowns[tipId]) return true;
    if (!this._tipAffordable(tip)) return true;
    return false;
  }

  // The toolbar item a tip teaches: an explicit `placeable`, else its guided "place this"
  // type, else the tool button it highlights. null = not an item tip.
  _tipPlaceable(tip) {
    if (tip.placeable) return tip.placeable;
    if (tip.guidedPlaceable) return tip.guidedPlaceable;
    for (const h of [tip.highlight, tip.highlightAlt]) {
      const t = h && h.target;
      if (typeof t !== 'string') continue;
      if (t.startsWith('tool:')) return t.slice(5);
      if (t in TOOL_BUTTON_KEYS) return TOOL_BUTTON_KEYS[t];
    }
    return null;
  }

  // Item tips only run while the player can pay for the item they point at, so the guide
  // never asks for a tool that's greyed out. Tools outside the level's palette aren't gated.
  _tipAffordable(tip) {
    const key = this._tipPlaceable(tip);
    const def = key && this.game.activePlaceables && this.game.activePlaceables[key];
    return !def || this.game.mauri.canAfford(def.cost);
  }
  
  _checkEventTriggers(eventType, data) {
    for (const tipId in this.tips) {
      const tip = this.tips[tipId];
      if (this._shouldSkipTip(tipId, tip)) continue;
      if (tip.trigger.type !== TRIGGER_TYPE.EVENT || tip.trigger.event !== eventType) continue;
      if (tip.trigger.minGameTime && this.game.playTime < tip.trigger.minGameTime) continue;
      if (tip.trigger.condition && !tip.trigger.condition(this.game, data)) continue;
      this._queueTip(tipId, data);
    }

    // A placement matching the open guided window fulfils it. Done AFTER the
    // trigger checks so off_script/free-placement tips saw the window state
    // this placement was made under.
    if (eventType === TUTORIAL_EVENTS.PLACEMENT && data && data.type &&
        this.scratch.guidedPlaceable && this.scratch.guidedPlaceable.type === data.type) {
      delete this.scratch.guidedPlaceable;
    }
  }
  
  // ============================================
  // UPDATE LOOP
  // ============================================
  
  update(dt = 1) {
    if (this.game.state === GAME_STATE.PLAYING) this.liveTime += dt;
    if (!this.enabled && !this.active) return;

    // Animations always update
    this.highlightPulse += 0.02 * dt;
    this._guideWobble += 0.04 * dt;
    this._updateFade(dt);
    
    if (this.active) {
      this.tipDisplayTime += dt;
      // A tip with no buttons (a banner) closes itself once the player has done what it asks.
      const cur = this.currentTip;
      if (cur && typeof cur.dismissWhen === 'function') {
        let done = false;
        try { done = cur.dismissWhen(this.game, cur.data); }
        catch (e) { console.warn(`Tutorial dismissWhen error for ${cur.id}:`, e); }
        if (done) this.dismissCurrentTip();
      }
      return;
    }
    
    if (!this.enabled) return;
    
    // Process queued events
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      this._checkEventTriggers(event.type, event.data);
    }

    // A guided "place this" window only lives while its tip is on screen.
    // The drain above has just judged any placements made DURING the tip
    // (queued while it was up), so anything placed from here on is ordinary
    // play; not going off-script. Clearing here is what keeps a storm
    // placed minutes later from triggering "Doing It Your Way".
    if (this.scratch.guidedPlaceable && !this.active) {
      delete this.scratch.guidedPlaceable;
    }
    
    // Check time-based triggers
    const gameTime = this.game.playTime - this.gameTimeAtStart;
    for (const tipId in this.tips) {
      const tip = this.tips[tipId];
      if (this._shouldSkipTip(tipId, tip)) continue;
      if (tip.trigger.type === TRIGGER_TYPE.TIME && gameTime >= tip.trigger.delay) {
        this._queueTip(tipId);
      }
    }
    
    // Check condition triggers (throttled)
    if (frameCount % 30 === 0) {
      for (const tipId in this.tips) {
        const tip = this.tips[tipId];
        if (this._shouldSkipTip(tipId, tip)) continue;
        if (tip.trigger.type !== TRIGGER_TYPE.CONDITION) continue;
        try {
          if (tip.trigger.condition(this.game)) this._queueTip(tipId);
        } catch (e) {
          console.warn(`Tutorial condition error for ${tipId}:`, e);
        }
      }
    }
    
    // Show next queued tip if enough time has passed. Urgent tips (like the
    // eagle attack warning) skip the spacing delay; the simulation keeps
    // running while a tip waits in the queue, so making an urgent one sit out
    // the gap lets the very thing it warns about resolve unseen.
    if (this.pendingTips.length > 0) {
      const head = this.pendingTips[0];
      const isUrgent = head.tip && head.tip.urgency === 'high';
      if (isUrgent || this.game.playTime - this.lastTipTime >= this.minTimeBetweenTips) {
        const queued = this.pendingTips.shift();
        // Mauri may have been spent while an item tip waited its turn: drop it unshown,
        // so its trigger can fire it again once the item is affordable.
        if (this._tipAffordable(queued.tip)) this._showTip(queued.id, queued.data);
      }
    }
  }
  
  // ============================================
  // TIP QUEUE MANAGEMENT
  // ============================================
  
  _queueTip(tipId, data = {}) {
    if (this.pendingTips.some(t => t.id === tipId)) return;
    
    const tip = this.tips[tipId];
    if (!tip) return;
    
    this.pendingTips.push({
      id: tipId,
      tip,
      data,
      priority: tip.priority || 5,
      queuedAt: this.game.playTime
    });
    
    this.pendingTips.sort((a, b) => a.priority - b.priority);
  }
  
  _showTip(tipId, data = {}) {
    const tip = this.tips[tipId];
    if (!tip) return;
    
    this.currentTip = { ...tip, data };
    // title / content / guidePosition / highlight may be (game, data) => value, resolved as
    // the tip appears (e.g. words that name this year's focus, a panel placed clear of a
    // nest, or this year's tool). A function highlight isn't read by the affordability gate
    // (_tipPlaceable), so such a tip gates its item in its own trigger condition.
    for (const k of ['title', 'content', 'guidePosition', 'highlight']) {
      if (typeof tip[k] !== 'function') continue;
      try {
        this.currentTip[k] = tip[k](this.game, data);
      } catch (e) {
        console.warn(`Tutorial ${k} error for ${tipId}:`, e);
        this.currentTip[k] = k === 'content' ? [] : (k === 'title' ? '' : null);
      }
    }
    this.active = true;
    this.tipDisplayTime = 0;
    this.shownTips.add(tipId);
    // The buttons are laid out again as the panel draws. A banner has none, so stale bounds
    // left from the last panel must not catch its clicks.
    this.nextButtonBounds = this.skipButtonBounds = this.panelBounds = null;
    this.lastTipTime = this.game.playTime;

    if (tip.trigger.cooldown) {
      this.tipCooldowns[tipId] = this.game.playTime + tip.trigger.cooldown;
    }

    this.targetFadeAlpha = 255;

    // A tip spoken by a bird (tip.voice) opens on a snippet of its call, or on its one-shot
    // species call (tip.call, e.g. the eagle's cry), or on its speaker's sound (tip.speaker:
    // a story line, see AudioManager.playSpeaker), else the chime. A tip about birds can play
    // their recordings instead, together (tip.voices: voice keys, for tip.voicesSec seconds).
    if (audioManager) {
      let voiced = tip.voice && audioManager.playVoiceCue && audioManager.playVoiceCue(tip.voice);
      if (!voiced && tip.voices && audioManager.playVoiceCue) {
        for (const v of tip.voices) if (audioManager.playVoiceCue(v, tip.voicesSec || 6)) voiced = true;
      }
      if (!voiced && tip.call && audioManager.playSpeciesCall) {
        audioManager.playSpeciesCall(tip.call);
        voiced = true;
      }
      if (!voiced && tip.speaker && audioManager.playSpeaker) {
        voiced = audioManager.playSpeaker(tip.speaker, tip.speakerPitch || 1);
      }
      if (!voiced) audioManager.playTutorialTip();
    }

    if (tip.pauseGame && this.game.state === GAME_STATE.PLAYING) {
      this.game.state = GAME_STATE.PAUSED;
      this._pausedByTutorial = true;
      // Freeze every moa on a settled facing, not squashed edge-on mid-turn under the spotlight.
      const sim = this.game.simulation;
      if (sim && sim.moas) for (const m of sim.moas) m.settleFacing();
    }

    // "Place this" tips open a guided window that lasts only while this tip
    // is on screen (cleared in update() right after the tip's queued
    // placements are processed; see the drain there). Placing the guided
    // type fulfils it; placing anything ELSE while the tip is up triggers
    // off_script_placement. `until` is just a failsafe upper bound.
    if (tip.guidedPlaceable) {
      this.scratch.guidedPlaceable = {
        type: tip.guidedPlaceable,
        until: this.game.playTime + 1800
      };
    }

    // Optional per-tip hook; lets a tip adjust game state as it appears
    // (e.g. eagle_hunting arms a grace window on hunting eagles).
    if (typeof tip.onShow === 'function') {
      try {
        tip.onShow(this.game, data);
      } catch (e) {
        console.warn(`Tutorial onShow error for ${tipId}:`, e);
      }
    }
  }
  
  // ============================================
  // TIP DISMISSAL
  // ============================================
  
  dismissCurrentTip() {
    if (!this.active || !this.currentTip) return;

    const tip = this.currentTip;

    // Optional per-tip hook, mirroring onShow; runs on every dismissal path
    // (close or chain). E.g. goal_intro turns the species highlight back off.
    if (typeof tip.onDismiss === 'function') {
      try {
        tip.onDismiss(this.game);
      } catch (e) {
        console.warn(`Tutorial onDismiss error for ${tip.id}:`, e);
      }
    }
    
    if (this._pausedByTutorial && this.game.state === GAME_STATE.PAUSED) {
      this.game.state = GAME_STATE.PLAYING;
    }
    this._pausedByTutorial = false;
    
    // Chain to next tip if still enabled. Item links the player can't afford (e.g. mauri
    // spent while the previous tip was up) are passed over; the chain carries on after them.
    if (this.enabled && tip.nextTip) {
      let nextId = tip.nextTip;
      const seen = new Set();
      while (nextId && this.tips[nextId] && !seen.has(nextId) &&
             !this._tipAffordable(this.tips[nextId])) {
        seen.add(nextId);
        nextId = this.tips[nextId].nextTip;
      }
      const nextTip = nextId && this.tips[nextId];
      if (nextTip && nextTip.trigger.type === TRIGGER_TYPE.IMMEDIATE && !seen.has(nextId)) {
        this.currentTip = null;
        this.active = false;
        this._showTip(nextId);
        return;
      }
    }
    
    this.targetFadeAlpha = 0;
    this.currentTip = null;
    this.active = false;
  }
  
  _updateFade(dt) {
    const fadeSpeed = 20 * dt;
    if (this.fadeAlpha < this.targetFadeAlpha) {
      this.fadeAlpha = min(this.fadeAlpha + fadeSpeed, this.targetFadeAlpha);
    } else if (this.fadeAlpha > this.targetFadeAlpha) {
      this.fadeAlpha = max(this.fadeAlpha - fadeSpeed, this.targetFadeAlpha);
    }
  }
  
  // ============================================
  // INPUT HANDLING
  // ============================================
  
  handleClick(mx, my) {
    if (!this.active) return false;
    
    if (this._hitTest(this.nextButtonBounds, mx, my)) {
      this.dismissCurrentTip();
      return true;
    }
    
    if (this._hitTest(this.skipButtonBounds, mx, my)) {
      this.skipTutorial();
      return true;
    }

    // Only consume clicks on the tip panel itself; everything else
    // (palette, game area) passes through so items can be placed
    // while a tip is up.
    return this._hitTest(this.panelBounds, mx, my);
  }
  
  _hitTest(bounds, mx, my) {
    return bounds && mx >= bounds.x && mx <= bounds.x + bounds.w && 
           my >= bounds.y && my <= bounds.y + bounds.h;
  }
  
  // ============================================
  // RENDERING
  // ============================================
  
  render() {
    if (this.fadeAlpha < 1 && !this.active) return;
    if (!this.active || !this.currentTip) return;
    
    const alpha = this.fadeAlpha;
    const tip = this.currentTip;
    const hlMain = this._highlightBounds(tip.highlight);
    const hlAlt = this._highlightBounds(tip.highlightAlt);

    // Overlay, with the highlighted UI cut out of it: the icons, dials and buttons a tip
    // points at stay at full brightness above the dimmed screen. A banner with dim: false
    // (one shown while the game plays on) leaves the screen undimmed and spotlights nothing.
    const dim = !(tip.banner && tip.dim === false);
    if (dim) this._renderOverlay(alpha, [hlMain, hlAlt].filter(Boolean));

    // Highlights
    if (hlMain) this._renderHighlightBox(hlMain, alpha);
    if (hlAlt) this._renderHighlightBox(hlAlt, alpha * 0.7);

    // A tip can spotlight part of the world through the overlay, under its panel. (An undimmed
    // banner draws its markers straight over the game, e.g. rings round the birds it means.)
    if (typeof tip.renderAboveOverlay === 'function') tip.renderAboveOverlay(this.game, tip.data);

    // Tip panel, or a banner's big line of text
    if (tip.banner) this._renderBanner(alpha);
    else this._renderTipPanel(alpha);
  }

  // The part of the canvas the world shows in: the world clip (in fullscreen, the whole map,
  // which runs off the canvas) cut down to the canvas.
  playArea() {
    const cw = CONFIG.canvasWidth, ch = CONFIG.canvasHeight;
    const c = this.game._worldClip ? this.game._worldClip() : { x: 0, y: 0, w: cw, h: ch };
    const x = Math.max(0, c.x), y = Math.max(0, c.y);
    return { x, y, w: Math.min(cw, c.x + c.w) - x, h: Math.min(ch, c.y + c.h) - y };
  }

  // A banner tip: a large line of FreckleFace text across the play area, with no panel and no
  // buttons, so the map stays free to use. tip.banner is a string or (game, data) => string,
  // read every frame so it can follow what the player is doing. It sits in the upper part of
  // the play area, clear of the action the camera frames. (It closes by tip.dismissWhen.)
  // tip.bannerSprite (a guide-sprite key, e.g. the hunting Pouākai) stands beside the words,
  // twitching, for a prompt that's an alarm.
  _renderBanner(alpha) {
    const tip = this.currentTip;
    let words = tip.banner;
    if (typeof words === 'function') {
      try { words = words(this.game, tip.data); } catch (e) { words = ''; }
    }
    if (!words) return;
    const { x: ax, y: ay, w: aw, h: ah } = this.playArea();
    const size = 54 * TIP_PANEL_SCALE * (CONFIG.portrait ? 0.8 : 1);
    const breathe = 1 + 0.025 * Math.sin(this.highlightPulse * 2);
    const sprite = tip.bannerSprite && this.game._getGuideSprite ? this.game._getGuideSprite(tip.bannerSprite) : null;
    const spriteSize = sprite ? size * 2.8 : 0, gap = sprite ? size * 0.3 : 0;

    push();
    if (typeof FreckleFace !== 'undefined') textFont(FreckleFace);
    textSize(size);
    const lines = this._wrapTipLines([words], aw * 0.86 - spriteSize - gap);
    let textW = 0;
    for (const l of lines) textW = Math.max(textW, textWidth(l));
    textAlign(CENTER, CENTER);
    // (With a sprite, the words move right to make room for it on their left.)
    translate(ax + aw * 0.5 + (spriteSize + gap) * 0.5, ay + ah * 0.2);
    scale(breathe);
    const lh = size * 1.15, y0 = -(lines.length - 1) * lh * 0.5;
    if (sprite) {
      push();
      translate(-textW * 0.5 - gap - spriteSize * 0.5, 0);
      rotate(0.06 * Math.sin(this.highlightPulse * 9));
      imageMode(CENTER);
      const k = spriteSize / Math.max(sprite.width || 1, sprite.height || 1);
      tint(255, alpha);
      image(sprite, 0, 0, sprite.width * k, sprite.height * k);
      pop();
    }
    // A dark outline keeps the words readable over any ground.
    stroke(12, 22, 16, alpha * 0.9);
    strokeWeight(size * 0.14);
    strokeJoin(ROUND);
    fill(235, 250, 225, alpha);
    for (let i = 0; i < lines.length; i++) text(lines[i], 0, y0 + i * lh);
    pop();
  }

  _highlightBounds(highlight) {
    if (!highlight || !this.uiMapper) return null;
    return this.uiMapper.getBounds(highlight.target);
  }

  // The dimming fill over the whole canvas, minus a hole per highlighted element. Each hole
  // clips in turn (the canvas minus that hole, even-odd), so overlapping holes still combine
  // into one clear area.
  _renderOverlay(alpha, holes) {
    const ctx = drawingContext;
    ctx.save();
    for (const b of holes) {
      ctx.beginPath();
      ctx.rect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
      this._highlightPath(ctx, b, 4);
      ctx.clip('evenodd');
    }
    noStroke();
    fill(0, 0, 0, alpha * 0.5);
    rect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    ctx.restore();
  }

  // Adds a highlight's outline, grown by pad, to the current canvas path: a circle for the
  // round dials (bounds.circle), else a rounded rect.
  _highlightPath(ctx, b, pad) {
    const x = b.x - pad, y = b.y - pad, w = b.w + pad * 2, h = b.h + pad * 2;
    if (b.circle) {
      const r = Math.min(w, h) / 2;
      ctx.moveTo(x + w / 2 + r, y + h / 2);
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2);
      return;
    }
    const r = Math.min(10, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Glowing borders (inner + outer) around a highlighted element's cut-out.
  _renderHighlightBox(bounds, alpha) {
    const pulse = sin(this.highlightPulse) * 0.3 + 0.7;
    const expand = sin(this.highlightPulse * 2) * 2;

    push();
    noFill();
    const glowLayers = [
      { color: [180, 215, 190, alpha * pulse], weight: 3, pad: 4 },
      { color: [255, 255, 200, alpha * 0.4 * pulse], weight: 6, pad: 8 }
    ];
    for (const layer of glowLayers) {
      stroke(...layer.color);
      strokeWeight(layer.weight);
      drawingContext.beginPath();
      this._highlightPath(drawingContext, bounds, layer.pad + expand);
      drawingContext.stroke();
    }
    pop();
  }
  
  _renderTipPanel(alpha) {
    const S = TIP_PANEL_SCALE;
    const tip = this.currentTip;
    const panelWidth = 500 * S;
    const content = Array.isArray(tip.content) ? tip.content : [tip.content];
    const lineHeight = 24 * S;
    const textW = panelWidth - 50 * S;
    // Each content entry is a paragraph, word-wrapped to the panel so a long line takes the
    // rows it needs instead of spilling over the next one ('' stays a blank spacer row).
    push();
    textFont('OpenDyslexic');
    textSize(15 * S);
    const lines = this._wrapTipLines(content, textW);
    pop();
    const panelHeight = 80 * S + (lines.length * lineHeight) + 60 * S;

    // A guidePosition worked out from the world (e.g. away from a speaker) is worked out again
    // each frame, so it holds even if the camera was still settling when the tip appeared.
    let where = tip.guidePosition;
    const src = this.tips[tip.id];
    if (src && typeof src.guidePosition === 'function') {
      try { where = src.guidePosition(this.game, tip.data); } catch (e) { /* keep the first answer */ }
    }
    const pos = this._getTipPanelPosition(where, panelWidth, panelHeight);
    this.panelBounds = { x: pos.x, y: pos.y, w: panelWidth, h: panelHeight };

    // Guide sprite (mantis). Landscape: to the LEFT of the panel, vertically centred.
    // Portrait: ABOVE the panel, horizontally centred — there's no room to its left on a
    // narrow screen (it would hang off the canvas). Falls back to below the panel if the
    // panel sits too high to fit the sprite above it.
    const spriteSize = 200 * S * (tip.guideScale || 1);
    let guideCX, guideCY;
    if (CONFIG.portrait) {
      const gap = 10 * S;
      guideCX = pos.x + panelWidth * 0.5;
      const aboveCY = pos.y - gap - spriteSize * 0.5;
      guideCY = (aboveCY - spriteSize * 0.5 >= 8)
        ? aboveCY
        : pos.y + panelHeight + gap + spriteSize * 0.5;   // no room above → below the panel
    } else {
      guideCX = pos.x - 110 * S;                           // matches the previous left placement
      guideCY = pos.y + panelHeight * 0.5;
    }

    push();

    // Panel background
    fill(25, 40, 32, alpha * 0.95);
    stroke(180, 215, 190, alpha);
    strokeWeight(2);
    rect(pos.x, pos.y, panelWidth, panelHeight, 6);

    // Title bar
    fill(40, 70, 50, alpha);
    noStroke();
    rect(pos.x, pos.y, panelWidth, 50 * S, 6, 6, 0, 0);

    // Title text (shrunk to fit a long title on one line)
    fill(200, 245, 210, alpha);
    textSize(20 * S);
    textAlign(LEFT, CENTER);
    if (typeof FreckleFace !== 'undefined') textFont(FreckleFace);
    const titleW = textWidth(tip.title);
    if (titleW > textW) textSize(20 * S * textW / titleW);
    text(tip.title, pos.x + 25 * S, pos.y + 25 * S);
    textFont('OpenDyslexic');

    // Content text
    fill(180, 215, 190, alpha);
    textSize(15 * S);
    textAlign(LEFT, TOP);

    let contentY = pos.y + 65 * S;
    for (const line of lines) {
      text(line, pos.x + 25 * S, contentY);
      contentY += lineHeight;
    }

    // Buttons
    this._renderTipButtons(pos.x, pos.y + panelHeight - 55 * S, panelWidth, alpha, tip);

    pop();

    // Guide sprite (outside push/pop). (guideCX, guideCY) is the sprite's centre.
    this._renderGuide(guideCX, guideCY, alpha, spriteSize, this._tipGuideSprite(tip));
  }

  // Greedy word-wrap of each paragraph to maxW at the current text font/size.
  _wrapTipLines(paragraphs, maxW) {
    const out = [];
    for (const para of paragraphs) {
      const words = String(para == null ? '' : para).split(' ');
      let line = '';
      for (const w of words) {
        const next = line ? line + ' ' + w : w;
        if (line && textWidth(next) > maxW) { out.push(line); line = w; }
        else line = next;
      }
      out.push(line);
    }
    return out;
  }

  // The speaker's sprite: a tip can name its own guide (tip.guideSprite, e.g. 'kea'),
  // else the level's guide (the mantis).
  _tipGuideSprite(tip) {
    if (tip && tip.guideSprite && this.game._getGuideSprite) {
      return this.game._getGuideSprite(tip.guideSprite) || this.guideSprite;
    }
    return this.guideSprite;
  }

  // Draws the guide sprite centred on (cx, cy).
  _renderGuide(cx, cy, alpha, size, sprite = this.guideSprite) {
    push();
    imageMode(CENTER);

    if (sprite) {
      // Fit the sprite in a size x size square, keeping its shape (a moa is taller than wide).
      const sw = sprite.width || 1, sh = sprite.height || 1, k = size / Math.max(sw, sh);
      tint(255, alpha);
      image(sprite, cx, cy, sw * k, sh * k);
    } else {
      // Minimal fallback
      fill(80, 150, 80, alpha);
      stroke(60, 120, 60, alpha);
      strokeWeight(2);
      ellipse(cx, cy, size * 0.7, size * 0.8);
    }

    pop();
  }
  
  _renderTipButtons(x, y, panelWidth, alpha, tip) {
    const S = TIP_PANEL_SCALE;
    const btnHeight = 36 * S;
    const btnY = y + 12 * S;

    // "Next" / "Got it" button
    const nextBtnW = 110 * S;
    const nextBtnX = x + panelWidth - nextBtnW - 25 * S;
    const nextLabel = tip.buttonLabel || (tip.nextTip ? "Next →" : "Got it!");
    const hoverNext = this._hitTest({ x: nextBtnX, y: btnY, w: nextBtnW, h: btnHeight }, mouseX, mouseY);
    
    fill(hoverNext ? [70, 135, 80, alpha] : [50, 110, 60, alpha]);
    stroke(100, 170, 110, alpha);
    strokeWeight(hoverNext ? 2 : 1);
    rect(nextBtnX, btnY, nextBtnW, btnHeight, 8);
    
    fill(255, 255, 255, alpha);
    textSize(16 * S);
    textAlign(CENTER, CENTER);
    text(nextLabel, nextBtnX + nextBtnW / 2, btnY + btnHeight / 2);
    
    this.nextButtonBounds = { x: nextBtnX, y: btnY, w: nextBtnW, h: btnHeight };

    // "Skip Tutorial" button (not in the module levels: their tips tell the story)
    if (this.game.module) { this.skipButtonBounds = null; return; }
    const skipBtnX = x + 25 * S;
    const skipBtnW = 100 * S;
    const hoverSkip = this._hitTest({ x: skipBtnX, y: btnY, w: skipBtnW, h: btnHeight }, mouseX, mouseY);
    
    fill(hoverSkip ? [55, 45, 45, alpha] : [35, 35, 35, alpha * 0.8]);
    stroke(70, 60, 60, alpha * 0.8);
    strokeWeight(1);
    rect(skipBtnX, btnY, skipBtnW, btnHeight, 8);
    
    fill(140, 130, 130, alpha);
    textSize(12 * S);   // scales with the panel, not the small-UI-text knob
    text("Skip Tutorial", skipBtnX + skipBtnW / 2, btnY + btnHeight / 2);
    
    this.skipButtonBounds = { x: skipBtnX, y: btnY, w: skipBtnW, h: btnHeight };
  }
  
  _getTipPanelPosition(guidePosition, panelWidth, panelHeight) {
    const cw = CONFIG.canvasWidth;
    const ch = CONFIG.canvasHeight;
    const margin = 60;
    const topMargin = CONFIG.topBarHeight + 40;
    const bottomMargin = CONFIG.bottomBarHeight + 40;

    // { fx, fy }: the panel's centre as fractions of the play area, kept on screen (with room
    // for the guide sprite beside or above it). Lets a tip sit clear of a point in the world.
    if (guidePosition && typeof guidePosition === 'object') {
      const S = TIP_PANEL_SCALE;
      const { x: ax, y: ay, w: aw, h: ah } = this.playArea();
      const roomL = CONFIG.portrait ? 20 : 240 * S, roomT = CONFIG.portrait ? 230 * S : topMargin;
      const x = ax + aw * guidePosition.fx - panelWidth / 2;
      const y = ay + ah * guidePosition.fy - panelHeight / 2;
      return {
        x: Math.max(roomL, Math.min(cw - panelWidth - 20, x)),
        y: Math.max(roomT, Math.min(ch - panelHeight - bottomMargin, y))
      };
    }

    const positions = {
      center:      { x: (cw - panelWidth) / 3, y: (ch - panelHeight) / 2 },
      left:        { x: CONFIG.gameAreaWidth - panelWidth * 1.2, y: (ch - panelHeight) / 2 },
      right:       { x: CONFIG.rightSidebarX - panelWidth - margin, y: (ch - panelHeight) / 2 },
      top:         { x: (CONFIG.gameAreaWidth - panelWidth) / 2, y: topMargin },
      bottom:      { x: (CONFIG.gameAreaWidth - panelWidth) / 2, y: ch - panelHeight - bottomMargin },
      topLeft:     { x: CONFIG.gameAreaWidth - panelWidth * 1.2, y: topMargin },
      topRight:    { x: CONFIG.rightSidebarX - panelWidth - margin, y: topMargin },
      bottomLeft:  { x: CONFIG.gameAreaWidth - panelWidth * 1.2, y: ch - panelHeight - bottomMargin },
      bottomRight: { x: CONFIG.rightSidebarX - panelWidth - margin, y: ch - panelHeight - bottomMargin }
    };
    
    return positions[guidePosition] || positions.center;
  }
  
  reset() {
    this.shownTips.clear();
    this.pendingTips = [];
    this.currentTip = null;
    this.active = false;
    this.enabled = true;
    this.tipCooldowns = {};
    this.scratch = {};
    this._pausedByTutorial = false;
  }
}