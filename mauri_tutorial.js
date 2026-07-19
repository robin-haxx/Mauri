// ============================================
// TUTORIAL SYSTEM 
// ============================================

// Uniform scale for the guide's dialog panels — box, text, buttons, and the
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
  EGG_LAID: 'egg_laid',
  EGG_HATCHED: 'egg_hatched',
  LOW_MAURI: 'low_mauri',
  PLACEABLE_EXPIRED: 'placeable_expired',
  FIRST_EGG: 'first_egg',
  PLACEMENT: 'placement'   // fired on every successful placement, data: { type }
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
    // Tool buttons by name (classic global order)
    const toolButtons = {
      kawakawaButton: 0, shelterButton: 1, nestButton: 2,
      StormButton: 3, waterholeButton: 4, harakekeButton: 5
    };
    if (target in toolButtons) return this._getToolButtonBounds(toolButtons[target]);
    
    // Fullscreen goals panel bounds (also stands in for the sidebar panels
    // that aren't drawn in fullscreen).
    const _fsGoals = fs ? {
      x: fs.goalsX - 12, y: fs.goalsY - 12,
      w: layout.sidebarPanelWidth + 24,
      h: 30 + ui.game.goals.length * 26 + 24
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
      case 'mauriDisplay':
        return { x: fs ? fs.mauriX : layout.mauriX, y: fs ? fs.stripY : 20, w: 180, h: 70 };
      case 'seasonDisplay':
        return { x: fs ? fs.seasonX : layout.seasonX, y: fs ? fs.stripY : 20, w: 280, h: 70 };
      case 'timerDisplay':
        return { x: fs ? fs.timerX : layout.timerX, y: fs ? fs.stripY : 20, w: 120, h: 70 };
      case 'pauseButton':
        if (fs) return { x: fs.pauseBtnX, y: fs.btnY, w: fs.btnSize, h: fs.btnSize };
        return { x: layout.pauseBtnX, y: layout.pauseBtnY, w: layout.pauseBtnSize, h: layout.pauseBtnSize };
      case 'migrationHint':
        // Not shown in fullscreen — anchor to the HUD strip instead
        if (fs) return { x: fs.mauriX, y: fs.stripY, w: 590, h: 70 };
        return { x: layout.migrationHintX, y: 110, w: layout.migrationHintWidth, h: 50 };
      case 'toolbar':
        const _tbX = fs ? fs.toolbarStartX : layout.toolbarStartX;
        const _tbY = fs ? fs.toolbarY : ui.toolbarY;
        const toolbarW = (layout.toolbarBtnCount - 1) * layout.toolbarSpacing + layout.toolbarBtnSize;
        return { x: _tbX - 10, y: _tbY - 10, w: toolbarW + 20, h: layout.toolbarBtnSize + 30 };
      case 'goalsPanel':
        if (fs) return _fsGoals;
        return { x: ui.sidebar.x + 20, y: 20, w: ui.sidebar.width - 40, h: 30 + ui.game.goals.length * 28 };
      case 'eventLog':
        if (fs) return _fsGoals;
        const goalsHeight = 30 + ui.game.goals.length * 28;
        return { x: ui.sidebar.x + 20, y: goalsHeight + 35, w: ui.sidebar.width - 40, h: 320 };
      case 'populationPanel':
        if (fs) return _fsGoals;
        const eventLogY = 30 + ui.game.goals.length * 28 + 35 + 320;
        return { x: ui.sidebar.x + 20, y: eventLogY + 15, w: ui.sidebar.width - 40, h: 220 };
      default:
        console.warn(`TutorialUIMapper: Unknown target "${target}"`);
        return null;
    }
  }

  _getToolButtonBounds(index) {
    const layout = this.ui.layout;
    const fs = (this.config.fullscreen && layout.fs) ? layout.fs : null;
    return {
      x: (fs ? fs.toolbarStartX : layout.toolbarStartX) + index * layout.toolbarSpacing,
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
    return false;
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
    if (!this.enabled && !this.active) return;
    
    // Animations always update
    this.highlightPulse += 0.02 * dt;
    this._guideWobble += 0.04 * dt;
    this._updateFade(dt);
    
    if (this.active) {
      this.tipDisplayTime += dt;
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
    // play — not going off-script. Clearing here is what keeps a storm
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
    // eagle attack warning) skip the spacing delay — the simulation keeps
    // running while a tip waits in the queue, so making an urgent one sit out
    // the gap lets the very thing it warns about resolve unseen.
    if (this.pendingTips.length > 0) {
      const head = this.pendingTips[0];
      const isUrgent = head.tip && head.tip.urgency === 'high';
      if (isUrgent || this.game.playTime - this.lastTipTime >= this.minTimeBetweenTips) {
        const queued = this.pendingTips.shift();
        this._showTip(queued.id, queued.data);
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
    this.active = true;
    this.tipDisplayTime = 0;
    this.shownTips.add(tipId);
    this.lastTipTime = this.game.playTime;
    
    if (tip.trigger.cooldown) {
      this.tipCooldowns[tipId] = this.game.playTime + tip.trigger.cooldown;
    }
    
    this.targetFadeAlpha = 255;

    if (audioManager) audioManager.playTutorialTip();

    if (tip.pauseGame && this.game.state === GAME_STATE.PLAYING) {
      this.game.state = GAME_STATE.PAUSED;
      this._pausedByTutorial = true;
    }

    // "Place this" tips open a guided window that lasts only while this tip
    // is on screen (cleared in update() right after the tip's queued
    // placements are processed — see the drain there). Placing the guided
    // type fulfils it; placing anything ELSE while the tip is up triggers
    // off_script_placement. `until` is just a failsafe upper bound.
    if (tip.guidedPlaceable) {
      this.scratch.guidedPlaceable = {
        type: tip.guidedPlaceable,
        until: this.game.playTime + 1800
      };
    }

    // Optional per-tip hook — lets a tip adjust game state as it appears
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
    
    if (this._pausedByTutorial && this.game.state === GAME_STATE.PAUSED) {
      this.game.state = GAME_STATE.PLAYING;
    }
    this._pausedByTutorial = false;
    
    // Chain to next tip if still enabled
    if (this.enabled && tip.nextTip) {
      const nextTip = this.tips[tip.nextTip];
      if (nextTip && nextTip.trigger.type === TRIGGER_TYPE.IMMEDIATE) {
        this.currentTip = null;
        this.active = false;
        this._showTip(tip.nextTip);
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

    // Only consume clicks on the tip panel itself — everything else
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
    
    // Overlay
    noStroke();
    fill(0, 0, 0, alpha * 0.5);
    rect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    
    // Highlights
    const tip = this.currentTip;
    if (tip.highlight) this._renderHighlightBox(tip.highlight, alpha);
    if (tip.highlightAlt) this._renderHighlightBox(tip.highlightAlt, alpha * 0.7);
    
    // Tip panel
    this._renderTipPanel(alpha);
  }
  
  _renderHighlightBox(highlight, alpha) {
    if (!this.uiMapper) return;
    const bounds = this.uiMapper.getBounds(highlight.target);
    if (!bounds) return;
    
    const pulse = sin(this.highlightPulse) * 0.3 + 0.7;
    const expand = sin(this.highlightPulse * 2) * 2;
    
    push();
    
    // Brighten highlighted area
    blendMode(LIGHTEST);
    fill(30, 40, 35, alpha * 0.8);
    noStroke();
    rect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8, 8);
    blendMode(BLEND);
    
    // Glowing borders (inner + outer)
    noFill();
    const glowLayers = [
      { color: [180, 215, 190, alpha * pulse], weight: 3, pad: 0, radius: 10 },
      { color: [255, 255, 200, alpha * 0.4 * pulse], weight: 6, pad: 4, radius: 12 }
    ];
    for (const layer of glowLayers) {
      stroke(...layer.color);
      strokeWeight(layer.weight);
      rect(
        bounds.x - expand - layer.pad, bounds.y - expand - layer.pad,
        bounds.w + expand * 2 + layer.pad * 2, bounds.h + expand * 2 + layer.pad * 2,
        layer.radius
      );
    }
    
    pop();
  }
  
  _renderTipPanel(alpha) {
    const S = TIP_PANEL_SCALE;
    const tip = this.currentTip;
    const panelWidth = 500 * S;
    const content = Array.isArray(tip.content) ? tip.content : [tip.content];
    const lineHeight = 24 * S;
    const panelHeight = 80 * S + (content.length * lineHeight) + 60 * S;

    const pos = this._getTipPanelPosition(tip.guidePosition, panelWidth, panelHeight);
    this.panelBounds = { x: pos.x, y: pos.y, w: panelWidth, h: panelHeight };

    // Guide sprite
    const spriteSize = 200 * S;
    const spriteX = pos.x - spriteSize * 0.3;
    const spriteY = pos.y + panelHeight * 0.5 - spriteSize * 0.5;

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

    // Title text
    fill(200, 245, 210, alpha);
    textSize(20 * S);
    textAlign(LEFT, CENTER);
    if (typeof GroceryRounded !== 'undefined') textFont(GroceryRounded);
    text(tip.title, pos.x + 25 * S, pos.y + 25 * S);
    textFont('OpenDyslexic');

    // Content text
    fill(180, 215, 190, alpha);
    textSize(15 * S);
    textAlign(LEFT, TOP);

    let contentY = pos.y + 65 * S;
    for (const line of content) {
      text(line, pos.x + 25 * S, contentY, panelWidth - 50 * S);
      contentY += lineHeight;
    }

    // Buttons
    this._renderTipButtons(pos.x, pos.y + panelHeight - 55 * S, panelWidth, alpha, tip);

    pop();

    // Guide sprite (outside push/pop)
    this._renderGuide(spriteX, spriteY, alpha, spriteSize);
  }

  _renderGuide(x, y, alpha, size) {
    push();
    imageMode(CENTER);

    if (this.guideSprite) {
      tint(255, alpha);
      image(this.guideSprite, (x + size * 0.5) - 150 * TIP_PANEL_SCALE, y + size * 0.5, size, size);
    } else {
      // Minimal fallback
      fill(80, 150, 80, alpha);
      stroke(60, 120, 60, alpha);
      strokeWeight(2);
      ellipse(x + size * 0.5, y + size * 0.5, size * 0.7, size * 0.8);
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
    const nextLabel = tip.nextTip ? "Next →" : "Got it!";
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
    
    // "Skip Tutorial" button
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