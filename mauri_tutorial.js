// ============================================
// TUTORIAL SYSTEM 
// ============================================

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
  FIRST_EGG: 'first_egg'
};

const _PREDATOR_PREY_CONTENT = [
  "The Moa population is starting to thrive! But be wary..",
  "Haast's Eagle evolved gigantism with Moa, to eat 'em!",
  "Knowing these sorts of relationships between flora and fauna is what makes a true eco-steward."
];

const TUTORIAL_TIPS = {
  // ===== INTRODUCTION SEQUENCE =====
  welcome: {
    id: 'welcome',
    trigger: { type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.GAME_START },
    title: "Kia ora! And welcome to the glacial Alps.",
    content: [
      "I'm Te Whē, the mantis, and I will be your guide!",
      "Your role in Avian Age is to become a responsible kaitiaki of our ancient land."
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: 'goal_intro',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  goal_intro: {
    id: 'goal_intro',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "The Upland Moa need your help!",
    content: [
      "Temperatures were far colder 30,000 years ago.",
      "The moa need your guidance finding food each season,",
      "and protection from the mighty Haast's Eagle!"
    ],
    guidePosition: 'topLeft',
    highlight: { type: 'element', target: 'gameArea' },
    nextTip: 'ui_topbar',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  ui_topbar: {
    id: 'ui_topbar',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "The Top Bar",
    content: [
      "Here you can see your Mauri (spiritual energy),",
      "the season, and the time taken to reach your goals.",
      "Mauri is gained when you help the ecosystem thrive!"
    ],
    guidePosition: 'topLeft',
    highlight: { type: 'element', target: 'topBarContent' },
    nextTip: 'ui_mauri',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  ui_mauri: {
    id: 'ui_mauri',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Mauri Energy",
    content: [
      "Don't be afraid to use the Mauri you gain;",
      "It will let you create a more bountiful forest.",
      "Spend it wisely and bird populations will flourish!"
    ],
    guidePosition: 'topLeft',
    highlight: { type: 'element', target: 'mauriDisplay' },
    nextTip: 'ui_sidebar',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  ui_sidebar: {
    id: 'ui_sidebar',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Goals & Information",
    content: [
      "The sidebar shows your goals and ecosystem status.",
      "You pass the level when all the goals are complete!",
      "The event log and top tooltip show the most vital info; pause & check them if things get busy!"
    ],
    guidePosition: 'left',
    highlight: { type: 'element', target: 'sidebar' },
    nextTip: 'ui_toolbar',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  ui_toolbar: {
    id: 'ui_toolbar',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Your Tools",
    content: [
      "These tools help shape the ecosystem.",
      "Click one, then click in the world to place it.",
      "Press number keys 1-6 for quick selection!"
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'toolbar' },
    nextTip: 'intro_complete',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  intro_complete: {
    id: 'intro_complete',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "You're Ready!",
    content: [
      "That's the basics! I'll pop up when something",
      "important happens. Press T anytime to toggle tips.",
      "Good luck, budding eco-guardian!"
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  // ===== EVENT-TRIGGERED TIPS =====
  eagle_hunting: {
    id: 'eagle_hunting',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.EAGLE_HUNTING,
      minGameTime: 180
    },
    title: "Haast's Eagle Attack!",
    content: [
      "The Pouākai is hunting the upland moa!",
      "Create a thunderstorm [🌩️] to distract it,",
      "or a Fern Shelter [🌴] to create cover."
    ],
    guidePosition: 'bottomRight',
    highlight: { type: 'element', target: 'StormButton' },
    highlightAlt: { type: 'element', target: 'shelterButton' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 1,
    urgency: 'high'
  },
  
  first_moa_death: {
    id: 'first_moa_death',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.MOA_KILLED 
    },
    title: "A Moa Has Fallen",
    content: [
      "The eagle caught a moa... but don't lose hope!",
      "Place Kawakawa [🌿] to help moa feed and breed.",
      "When moa are food-secure and not threatened, they can reproduce."
    ],
    guidePosition: 'center',
    highlight: { type: 'element', target: 'kawakawaButton' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },
  
  season_change_first: {
    id: 'season_change_first',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.SEASON_CHANGE 
    },
    title: "The Seasons Turn",
    content: [
      "The mosaic of native plants shifts with the seasons.",
      "Upland Moa love alpine shrubs like the Pātōtara.",
      "It fruits around Autumn, before the alps get too cold!"
    ],
    guidePosition: 'topRight',
    highlight: { type: 'element', target: 'seasonDisplay' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 3
  },
  
  new_eagle_spawned: {
    id: 'new_eagle_spawned',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.EAGLE_SPAWNED 
    },
    title: "A New Predator Arrives",
    content: _PREDATOR_PREY_CONTENT,
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },
  
  first_egg: {
    id: 'first_egg',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.FIRST_EGG 
    },
    title: "An Egg!",
    content: [
      "A moa has laid an egg! Keep it safe.",
      "Nesting Sites [🪺] speed up incubation",
      "and provide extra protection."
    ],
    guidePosition: 'left',
    highlight: { type: 'element', target: 'nestButton' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },
  
  egg_hatched: {
    id: 'egg_hatched',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.EGG_HATCHED 
    },
    title: "New Life!",
    content: [
      "The egg has hatched! A new moa joins the flock.",
      "Young moa are small and hungry.",
      "Make sure there's food nearby!"
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 3
  },
  
  // ===== CONDITION-BASED TIPS =====
  low_mauri_warning: {
    id: 'low_mauri_warning',
    trigger: { 
      type: TRIGGER_TYPE.CONDITION, 
      condition: (game) => game.mauri.mauri < 12 && game.playTime > 900,
      cooldown: 1800
    },
    title: "Mauri Running Low",
    content: [
      "Your Mauri is getting low!",
      "Complete goals for a boost."
    ],
    guidePosition: 'topLeft',
    highlight: { type: 'element', target: 'mauriDisplay' },
    nextTip: null,
    pauseGame: true,
    showOnce: false,
    priority: 2
  },
  
  population_growing: {
    id: 'population_growing',
    trigger: { 
      type: TRIGGER_TYPE.CONDITION, 
      condition: (game) => game._cachedMoaCount >= 12 
    },
    title: "The Population Grows!",
    content: _PREDATOR_PREY_CONTENT,
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 3
  },
  
  hungry_population: {
    id: 'hungry_population',
    trigger: { 
      type: TRIGGER_TYPE.CONDITION, 
      condition: (game) => {
        const moas = game.simulation?.moas || [];
        const alive = moas.filter(m => m.alive);
        if (alive.length < 3) return false;
        const avgHunger = alive.reduce((s, m) => s + m.hunger, 0) / alive.length;
        return avgHunger > 65 && game.playTime > 600;
      },
      cooldown: 1200
    },
    title: "Moa Are Hungry!",
    content: [
      "Your moa are getting very hungry!",
      "Place Kawakawa (🌿) or Harakeke (🌾)",
      "to give them food quickly."
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'kawakawaButton' },
    nextTip: null,
    pauseGame: true,
    showOnce: false,
    priority: 1
  },
  
  // ===== TIMED TIPS =====
  migration_reminder: {
    id: 'migration_reminder',
    trigger: { type: TRIGGER_TYPE.TIME, delay: 2400 },
    title: "Migration Patterns",
    content: [
      "These moa will migrate to find food.",
      "Think about where they might go next...",
      "And create an abundant patch of forest there!"
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'migrationHint' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 4
  },
  
  waterhole_tip: {
    id: 'waterhole_tip',
    trigger: { type: TRIGGER_TYPE.TIME, delay: 3600 },
    title: "Waterholes",
    content: [
      "Waterholes [💧] slow down hunger",
      "and attract moa to rest.",
      "Great for keeping moa in safe areas!"
    ],
    guidePosition: 'bottom',
    highlight: { type: 'element', target: 'waterholeButton' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 4
  },
  
  kaitiaki_progress: {
    id: 'kaitiaki_progress',
    trigger: { 
      type: TRIGGER_TYPE.CONDITION, 
      condition: (game) => game._cachedMoaCount >= 20 && game.simulation?.stats.births >= 5
    },
    title: "True Kaitiaki",
    content: [
      "You're doing wonderfully!",
      "The ecosystem is thriving under your care.",
      "Keep balancing growth with protection."
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 4
  }
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
    
    // Tool buttons by name
    const toolButtons = {
      kawakawaButton: 0, shelterButton: 1, nestButton: 2,
      StormButton: 3, waterholeButton: 4, harakekeButton: 5
    };
    if (target in toolButtons) return this._getToolButtonBounds(toolButtons[target]);
    
    switch (target) {
      case 'topBar':
        return { x: ui.topBar.x, y: ui.topBar.y, w: ui.topBar.width, h: ui.topBar.height };
      case 'topBarContent':
        return { x: layout.mauriX - 10, y: 15, w: layout.timerX + 130 - layout.mauriX + 20, h: 80 };
      case 'sidebar':
        return { x: ui.sidebar.x, y: ui.sidebar.y, w: ui.sidebar.width, h: ui.sidebar.height };
      case 'gameArea':
        return { x: config.gameAreaX, y: config.gameAreaY, w: config.gameAreaWidth, h: config.gameAreaHeight };
      case 'bottomBar':
        return { x: ui.bottomBar.x, y: ui.bottomBar.y, w: ui.bottomBar.width, h: ui.bottomBar.height };
      case 'mauriDisplay':
        return { x: layout.mauriX, y: 20, w: 180, h: 70 };
      case 'seasonDisplay':
        return { x: layout.seasonX, y: 20, w: 280, h: 70 };
      case 'timerDisplay':
        return { x: layout.timerX, y: 20, w: 120, h: 70 };
      case 'pauseButton':
        return { x: layout.pauseBtnX, y: layout.pauseBtnY, w: layout.pauseBtnSize, h: layout.pauseBtnSize };
      case 'migrationHint':
        return { x: layout.migrationHintX, y: 110, w: layout.migrationHintWidth, h: 50 };
      case 'toolbar':
        const toolbarW = (layout.toolbarBtnCount - 1) * layout.toolbarSpacing + layout.toolbarBtnSize;
        return { x: layout.toolbarStartX - 10, y: ui.toolbarY - 10, w: toolbarW + 20, h: layout.toolbarBtnSize + 30 };
      case 'goalsPanel':
        return { x: ui.sidebar.x + 20, y: 20, w: ui.sidebar.width - 40, h: 30 + ui.game.goals.length * 28 };
      case 'eventLog':
        const goalsHeight = 30 + ui.game.goals.length * 28;
        return { x: ui.sidebar.x + 20, y: goalsHeight + 35, w: ui.sidebar.width - 40, h: 320 };
      case 'populationPanel':
        const eventLogY = 30 + ui.game.goals.length * 28 + 35 + 320;
        return { x: ui.sidebar.x + 20, y: eventLogY + 15, w: ui.sidebar.width - 40, h: 220 };
      default:
        console.warn(`TutorialUIMapper: Unknown target "${target}"`);
        return null;
    }
  }
  
  _getToolButtonBounds(index) {
    const layout = this.ui.layout;
    return {
      x: layout.toolbarStartX + index * layout.toolbarSpacing,
      y: this.ui.toolbarY,
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
    this.enabled = true;
    this.active = false;
    this.currentTip = null;
    this.shownTips = new Set();
    this.pendingTips = [];
    this.gameTimeAtStart = 0;
    this.eventQueue = [];
    
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
    
    // Pause tracking
    this._pausedByTutorial = false;
    
    // Guide sprite
    this.guideSprite = null;
    this._guideWobble = 0;
  }
  
  setGuideSprite(sprite) {
    this.guideSprite = sprite;
  }
  
  init() {
    this.shownTips.clear();
    this.pendingTips = [];
    this.currentTip = null;
    this.active = false;
    this.gameTimeAtStart = this.game.playTime;
    this.lastTipTime = -this.minTimeBetweenTips;
    this.tipCooldowns = {};
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
    for (const tipId in TUTORIAL_TIPS) {
      const tip = TUTORIAL_TIPS[tipId];
      if (this._shouldSkipTip(tipId, tip)) continue;
      if (tip.trigger.type !== TRIGGER_TYPE.EVENT || tip.trigger.event !== eventType) continue;
      if (tip.trigger.minGameTime && this.game.playTime < tip.trigger.minGameTime) continue;
      this._queueTip(tipId, data);
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
    
    // Check time-based triggers
    const gameTime = this.game.playTime - this.gameTimeAtStart;
    for (const tipId in TUTORIAL_TIPS) {
      const tip = TUTORIAL_TIPS[tipId];
      if (this._shouldSkipTip(tipId, tip)) continue;
      if (tip.trigger.type === TRIGGER_TYPE.TIME && gameTime >= tip.trigger.delay) {
        this._queueTip(tipId);
      }
    }
    
    // Check condition triggers (throttled)
    if (frameCount % 30 === 0) {
      for (const tipId in TUTORIAL_TIPS) {
        const tip = TUTORIAL_TIPS[tipId];
        if (this._shouldSkipTip(tipId, tip)) continue;
        if (tip.trigger.type !== TRIGGER_TYPE.CONDITION) continue;
        try {
          if (tip.trigger.condition(this.game)) this._queueTip(tipId);
        } catch (e) {
          console.warn(`Tutorial condition error for ${tipId}:`, e);
        }
      }
    }
    
    // Show next queued tip if enough time has passed
    if (this.pendingTips.length > 0 && 
        this.game.playTime - this.lastTipTime >= this.minTimeBetweenTips) {
      const queued = this.pendingTips.shift();
      this._showTip(queued.id, queued.data);
    }
  }
  
  // ============================================
  // TIP QUEUE MANAGEMENT
  // ============================================
  
  _queueTip(tipId, data = {}) {
    if (this.pendingTips.some(t => t.id === tipId)) return;
    
    const tip = TUTORIAL_TIPS[tipId];
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
    const tip = TUTORIAL_TIPS[tipId];
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
      const nextTip = TUTORIAL_TIPS[tip.nextTip];
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
    
    return true; // Consume click when tutorial active
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
    const tip = this.currentTip;
    const panelWidth = 500;
    const content = Array.isArray(tip.content) ? tip.content : [tip.content];
    const lineHeight = 24;
    const panelHeight = 80 + (content.length * lineHeight) + 60;
    
    const pos = this._getTipPanelPosition(tip.guidePosition, panelWidth, panelHeight);
    
    // Guide sprite
    const spriteSize = 200;
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
    rect(pos.x, pos.y, panelWidth, 50, 6, 6, 0, 0);
    
    // Title text
    fill(200, 245, 210, alpha);
    textSize(20);
    textAlign(LEFT, CENTER);
    if (typeof GroceryRounded !== 'undefined') textFont(GroceryRounded);
    text(tip.title, pos.x + 25, pos.y + 25);
    textFont('OpenDyslexic');
    
    // Content text
    fill(180, 215, 190, alpha);
    textSize(15);
    textAlign(LEFT, TOP);
    
    let contentY = pos.y + 65;
    for (const line of content) {
      text(line, pos.x + 25, contentY, panelWidth - 50);
      contentY += lineHeight;
    }
    
    // Buttons
    this._renderTipButtons(pos.x, pos.y + panelHeight - 55, panelWidth, alpha, tip);
    
    pop();
    
    // Guide sprite (outside push/pop)
    this._renderGuide(spriteX, spriteY, alpha, spriteSize);
  }
  
  _renderGuide(x, y, alpha, size) {
    push();
    imageMode(CENTER);
    
    if (this.guideSprite) {
      tint(255, alpha);
      image(this.guideSprite, (x + size * 0.5) - 150, y + size * 0.5, size, size);
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
    const btnHeight = 36;
    const btnY = y + 12;
    
    // "Next" / "Got it" button
    const nextBtnW = 110;
    const nextBtnX = x + panelWidth - nextBtnW - 25;
    const nextLabel = tip.nextTip ? "Next →" : "Got it!";
    const hoverNext = this._hitTest({ x: nextBtnX, y: btnY, w: nextBtnW, h: btnHeight }, mouseX, mouseY);
    
    fill(hoverNext ? [70, 135, 80, alpha] : [50, 110, 60, alpha]);
    stroke(100, 170, 110, alpha);
    strokeWeight(hoverNext ? 2 : 1);
    rect(nextBtnX, btnY, nextBtnW, btnHeight, 8);
    
    fill(255, 255, 255, alpha);
    textSize(16);
    textAlign(CENTER, CENTER);
    text(nextLabel, nextBtnX + nextBtnW / 2, btnY + btnHeight / 2);
    
    this.nextButtonBounds = { x: nextBtnX, y: btnY, w: nextBtnW, h: btnHeight };
    
    // "Skip Tutorial" button
    const skipBtnX = x + 25;
    const skipBtnW = 100;
    const hoverSkip = this._hitTest({ x: skipBtnX, y: btnY, w: skipBtnW, h: btnHeight }, mouseX, mouseY);
    
    fill(hoverSkip ? [55, 45, 45, alpha] : [35, 35, 35, alpha * 0.8]);
    stroke(70, 60, 60, alpha * 0.8);
    strokeWeight(1);
    rect(skipBtnX, btnY, skipBtnW, btnHeight, 8);
    
    fill(140, 130, 130, alpha);
    textSize(12);
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
    this._pausedByTutorial = false;
  }
}