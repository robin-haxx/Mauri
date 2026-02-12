// ============================================
// TUTORIAL SYSTEM FOR MAURI
// ============================================

// ============================================
// TRIGGER TYPES
// ============================================
const TRIGGER_TYPE = {
  IMMEDIATE: 'immediate',
  TIME: 'time',
  EVENT: 'event',
  CONDITION: 'condition',
  MANUAL: 'manual'
};

// ============================================
// TUTORIAL EVENTS
// ============================================
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

// ============================================
// TUTORIAL TIPS REGISTRY
// ============================================
const TUTORIAL_TIPS = {
  // ===== INTRODUCTION SEQUENCE =====
  welcome: {
    id: 'welcome',
    trigger: { type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.GAME_START },
    title: "Kia ora! Welcome to Mauri",
    content: [
      "I'm Te Whē, the mantis, and I will be your guide.",
      "Let me show you how to become a great kaitiaki!"
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
    title: "Your Mission",
    content: [
      "The Upland Moa need your help to survive.",
      "Guide them through the seasons, help them find food,",
      "and protect them from the mighty Pouākai!"
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
      "Good luck, kaitiaki!"
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
      "The Pouākai is hunting your moa!",
      "Create a thunderstorm (🌩️) to distract it,",
      "or a Fern Shelter (🌴) to create cover."
    ],
    guidePosition: 'bottomRight',
    highlight: { type: 'element', target: 'decoyButton' },
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
      "When moa have are food-secure and not threatened, they can reproduce."
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
    content: [
      "The Moa population is starting to thrive! But be wary..",
      "Haast's Eagle evolved gigantism with Moa, to eat 'em!",
      "Knowing these sorts of relationships between flora and fauna is what makes a true eco-steward."
    ],
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
      "Nesting Sites (🪺) speed up incubation",
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
    pauseGame: true,  // FIXED: was false
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
      "complete goals for bonus Mauri."
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
    content: [
      "The Moa population is starting to thrive! But be wary..",
      "Haast's Eagle evolved gigantism with Moa, to eat 'em!",
      "Knowing these sorts of relationships between flora and fauna is what makes a true eco-steward."
    ],
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
    trigger: { 
      type: TRIGGER_TYPE.TIME, 
      delay: 2400
    },
    title: "Migration Patterns",
    content: [
      "These moa will migrate to find food.",
      "Think about where they might go next...",
      "And create an abundant patch of forest there!"
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'migrationHint' },
    nextTip: null,
    pauseGame: true,  // FIXED: was false
    showOnce: true,
    priority: 4
  },
  
  waterhole_tip: {
    id: 'waterhole_tip',
    trigger: { 
      type: TRIGGER_TYPE.TIME, 
      delay: 3600
    },
    title: "Waterholes",
    content: [
      "Waterholes (💧) slow down hunger",
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
      
      case 'kawakawaButton':
        return this._getToolButtonBounds(0);
      case 'shelterButton':
        return this._getToolButtonBounds(1);
      case 'nestButton':
        return this._getToolButtonBounds(2);
      case 'decoyButton':
        return this._getToolButtonBounds(3);
      case 'waterholeButton':
        return this._getToolButtonBounds(4);
      case 'harakekeButton':
        return this._getToolButtonBounds(5);
      
      case 'goalsPanel':
        return { x: ui.sidebar.x + 20, y: 20, w: ui.sidebar.width - 40, h: 30 + this.ui.game.goals.length * 28 };
        
      case 'eventLog':
        const goalsHeight = 30 + this.ui.game.goals.length * 28;
        return { x: ui.sidebar.x + 20, y: goalsHeight + 35, w: ui.sidebar.width - 40, h: 320 };
        
      case 'populationPanel':
        const eventLogY = 30 + this.ui.game.goals.length * 28 + 35 + 320;
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
    
    // Cooldowns
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
    this._previousGameState = null;
    
    // Guide sprite
    this.guideSprite = null;
    this._guideWobble = 0;
  }
  
  /**
   * Load the mantis sprite - call this in preload()
   */
  static loadSprite() {
    return loadImage('sprites/mantis_talk.png');
  }
  
  /**
   * Set the guide sprite after loading
   */
  setGuideSprite(sprite) {
    this.guideSprite = sprite;
  }
  
  /**
   * Initialize tutorial system
   */
  init() {
    this.shownTips.clear();
    this.pendingTips = [];
    this.currentTip = null;
    this.active = false;
    this.gameTimeAtStart = this.game.playTime;
    this.lastTipTime = -this.minTimeBetweenTips;
    this.tipCooldowns = {};
    this._pausedByTutorial = false;
    this._previousGameState = null;
    
    if (this.game.ui) {
      this.uiMapper = new TutorialUIMapper(this.game.ui, this.game.config || CONFIG);
    }
    
    if (this.enabled) {
      this.fireEvent(TUTORIAL_EVENTS.GAME_START);
    }
  }
  
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.dismissCurrentTip();
    }
    this.game.addNotification(
      enabled ? "Tutorial enabled" : "Tutorial disabled (press T to re-enable)", 
      'info'
    );
  }
  
  toggle() {
    this.setEnabled(!this.enabled);
  }
  
  skipTutorial() {
    this.enabled = false;
    this.pendingTips = [];  // ADD: Clear pending tips queue
    this.eventQueue = [];   // ADD: Clear event queue
    this.dismissCurrentTip();
    this.game.addNotification("Tutorial skipped. Press T anytime for tips!", 'info');
  }

  
  // ============================================
  // EVENT SYSTEM
  // ============================================
  
  fireEvent(eventType, data = {}) {
    if (!this.enabled) return;
    
    if (this.active) {
      this.eventQueue.push({ type: eventType, data: data, time: this.game.playTime });
      return;
    }
    
    this._checkEventTriggers(eventType, data);
  }
  
  _checkEventTriggers(eventType, data) {
    for (const tipId in TUTORIAL_TIPS) {
      const tip = TUTORIAL_TIPS[tipId];
      
      if (tip.showOnce && this.shownTips.has(tipId)) continue;
      
      if (this.tipCooldowns[tipId] && this.game.playTime < this.tipCooldowns[tipId]) {
        continue;
      }
      
      if (tip.trigger.type === TRIGGER_TYPE.EVENT && tip.trigger.event === eventType) {
        if (tip.trigger.minGameTime && this.game.playTime < tip.trigger.minGameTime) continue;
        this._queueTip(tipId, data);
      }
    }
  }
  
  // ============================================
  // UPDATE LOOP
  // ============================================
  
  update(dt = 1) {
    if (!this.enabled && !this.active) return;
    
    // Update animations
    this.highlightPulse += 0.02 * dt;
    this._guideWobble += 0.04 * dt;
    this._updateFade(dt);
    
    if (this.active) {
      this.tipDisplayTime += dt;
      return;
    }
    
    if (!this.enabled) return;
    
    this._processEventQueue();
    this._checkTimeTriggers();
    
    if (frameCount % 30 === 0) {
      this._checkConditionTriggers();
    }
    
    if (this.pendingTips.length > 0 && 
        this.game.playTime - this.lastTipTime >= this.minTimeBetweenTips) {
      this._showNextTip();
    }
  }
  
  _processEventQueue() {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      this._checkEventTriggers(event.type, event.data);
    }
  }
  
  _checkTimeTriggers() {
    const gameTime = this.game.playTime - this.gameTimeAtStart;
    
    for (const tipId in TUTORIAL_TIPS) {
      const tip = TUTORIAL_TIPS[tipId];
      
      if (tip.showOnce && this.shownTips.has(tipId)) continue;
      
      if (tip.trigger.type === TRIGGER_TYPE.TIME && gameTime >= tip.trigger.delay) {
        this._queueTip(tipId);
      }
    }
  }
  
  _checkConditionTriggers() {
    for (const tipId in TUTORIAL_TIPS) {
      const tip = TUTORIAL_TIPS[tipId];
      
      if (tip.showOnce && this.shownTips.has(tipId)) continue;
      
      if (this.tipCooldowns[tipId] && this.game.playTime < this.tipCooldowns[tipId]) {
        continue;
      }
      
      if (tip.trigger.type === TRIGGER_TYPE.CONDITION) {
        try {
          if (tip.trigger.condition(this.game)) {
            this._queueTip(tipId);
          }
        } catch (e) {
          console.warn(`Tutorial condition error for ${tipId}:`, e);
        }
      }
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
      tip: tip,
      data: data,
      priority: tip.priority || 5,
      queuedAt: this.game.playTime
    });
    
    this.pendingTips.sort((a, b) => a.priority - b.priority);
  }
  
  _showNextTip() {
    if (this.pendingTips.length === 0) return;
    
    const queued = this.pendingTips.shift();
    this._showTip(queued.id, queued.data);
  }
  
  _showTip(tipId, data = {}) {
    const tip = TUTORIAL_TIPS[tipId];
    if (!tip) return;
    
    this.currentTip = { ...tip, data: data };
    this.active = true;
    this.tipDisplayTime = 0;
    this.shownTips.add(tipId);
    this.lastTipTime = this.game.playTime;
    
    if (tip.trigger.cooldown) {
        this.tipCooldowns[tipId] = this.game.playTime + tip.trigger.cooldown;
    }
    
    this.targetFadeAlpha = 255;
    
    // Play tutorial tip sound
    if (typeof audioManager !== 'undefined' && audioManager) {
        audioManager.playTutorialTip();
    }
    
    // Pause handling
    if (tip.pauseGame) {
        this._previousGameState = this.game.state;
        if (this.game.state === GAME_STATE.PLAYING) {
        this.game.state = GAME_STATE.PAUSED;
        this._pausedByTutorial = true;
        }
    }
  }
  
  // ============================================
  // TIP DISMISSAL
  // ============================================
  
  dismissCurrentTip() {
    if (!this.active || !this.currentTip) return;
    
    const tip = this.currentTip;
    
    // Proper unpause handling
    if (this._pausedByTutorial) {
        if (this.game.state === GAME_STATE.PAUSED) {
        this.game.state = GAME_STATE.PLAYING;
        }
        this._pausedByTutorial = false;
    }
    this._previousGameState = null;
    
    // Check for chained next tip - ONLY IF STILL ENABLED
    if (this.enabled && tip.nextTip) {  // <-- ADD this.enabled check
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
  
  advanceToNextTip() {
    this.dismissCurrentTip();
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
    
    if (this.nextButtonBounds) {
      const btn = this.nextButtonBounds;
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        this.advanceToNextTip();
        return true;
      }
    }
    
    if (this.skipButtonBounds) {
      const btn = this.skipButtonBounds;
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        this.skipTutorial();
        return true;
      }
    }
    
    return true;
  }
  
  handleKey(key) {
    if (!this.active) {
      if (key === 't' || key === 'T') {
        this.toggle();
        return true;
      }
      return false;
    }
    
    if (key === 'Enter' || key === ' ') {
      this.advanceToNextTip();
      return true;
    }
    
    if (key === 'Escape') {
      this.skipTutorial();
      return true;
    }
    
    return true;
  }
  
  // ============================================
  // RENDERING
  // ============================================
  
  render() {
    if (this.fadeAlpha < 1 && !this.active) return;
    
    const alpha = this.fadeAlpha;
    
    if (this.active && this.currentTip) {
      this._renderOverlay(alpha);
      this._renderHighlights(alpha);
      this._renderTipPanel(alpha);
    }
  }
  
  _renderOverlay(alpha) {
    noStroke();
    fill(0, 0, 0, alpha * 0.5);
    rect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
  }
  
  _renderHighlights(alpha) {
    const tip = this.currentTip;
    
    if (tip.highlight) {
      this._renderHighlightBox(tip.highlight, alpha);
    }
    
    if (tip.highlightAlt) {
      this._renderHighlightBox(tip.highlightAlt, alpha * 0.7);
    }
  }
  
  _renderHighlightBox(highlight, alpha) {
    if (!this.uiMapper) return;
    
    const bounds = this.uiMapper.getBounds(highlight.target);
    if (!bounds) return;
    
    const pulse = sin(this.highlightPulse) * 0.3 + 0.7;
    const expand =  sin(this.highlightPulse * 2) * 2;
    
    push();
    
    // Brighten highlighted area
    blendMode(LIGHTEST);
    fill(30, 40, 35, alpha * 0.8);
    noStroke();
    rect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8, 8);
    blendMode(BLEND);
    
    // Glowing border
    noFill();
    stroke(180, 215, 190, alpha * pulse);
    strokeWeight(3);
    rect(bounds.x - expand, bounds.y - expand, bounds.w + expand * 2, bounds.h + expand * 2, 10);
    
    // Outer glow
    stroke(255, 255, 200, alpha * 0.4 * pulse);
    strokeWeight(6);
    rect(bounds.x - expand - 4, bounds.y - expand - 4, bounds.w + expand * 2 + 8, bounds.h + expand * 2 + 8, 12);
    
    pop();
  }
  
  _renderTipPanel(alpha) {
    const tip = this.currentTip;
    
    // Calculate panel dimensions
    const panelWidth = 500;
    const content = Array.isArray(tip.content) ? tip.content : [tip.content];
    const lineHeight = 24;
    const panelHeight = 80 + (content.length * lineHeight) + 60;
    
    const pos = this._getTipPanelPosition(tip.guidePosition, panelWidth, panelHeight);
    
    // Sprite dimensions
    const spriteSize = 180;
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
    if (typeof GroceryRounded !== 'undefined') {
      textFont(GroceryRounded);
    }
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
    
    // Render guide sprite OUTSIDE the panel push/pop
    this._renderGuide(spriteX, spriteY, alpha, spriteSize);
  }
  
  _renderGuide(x, y, alpha, size) {
    if (!this.guideSprite) {
      // Fallback: draw a simple placeholder
      this._renderGuidePlaceholder(x, y, alpha, size);
      return;
    }
    
    push();
    
    // Gentle wobble animation
    const wobbleY = sin(this._guideWobble) * 3;
    const wobbleRotation = sin(this._guideWobble * 0.7) * 0.03;
    
    imageMode(CENTER);
    tint(255, alpha);
    
    translate((x + size * 0.5)-132, y + size * 0.5 );
    //rotate(wobbleRotation);
    
    image(this.guideSprite, 0, 0, size, size);
    
    pop();
  }
  
  _renderGuidePlaceholder(x, y, alpha, size) {
    // Simple colored circle as fallback if sprite not loaded
    push();
    
    const wobbleY = sin(this._guideWobble) * 3;
    
    fill(80, 150, 80, alpha);
    stroke(60, 120, 60, alpha);
    strokeWeight(2);
    ellipse(x + size * 0.5, y + size * 0.5 + wobbleY, size * 0.7, size * 0.8);
    
    // Simple eyes
    fill(20, 20, 20, alpha);
    noStroke();
    ellipse(x + size * 0.35, y + size * 0.35 + wobbleY, size * 0.12, size * 0.15);
    ellipse(x + size * 0.65, y + size * 0.35 + wobbleY, size * 0.12, size * 0.15);
    
    // Eye highlights
    fill(255, 255, 255, alpha * 0.7);
    ellipse(x + size * 0.33, y + size * 0.32 + wobbleY, size * 0.05, size * 0.06);
    ellipse(x + size * 0.63, y + size * 0.32 + wobbleY, size * 0.05, size * 0.06);
    
    pop();
  }
  
  _renderTipButtons(x, y, panelWidth, alpha, tip) {
    const btnWidth = 110;
    const btnHeight = 36;
    const btnY = y + 12;
    
    // "Next" / "Got it" button
    const nextBtnX = x + panelWidth - btnWidth - 25;
    const nextLabel = tip.nextTip ? "Next →" : "Got it!";
    
    const hoverNext = mouseX >= nextBtnX && mouseX <= nextBtnX + btnWidth &&
                      mouseY >= btnY && mouseY <= btnY + btnHeight;
    
    fill(hoverNext ? [70, 135, 80, alpha] : [50, 110, 60, alpha]);
    stroke(100, 170, 110, alpha);
    strokeWeight(hoverNext ? 2 : 1);
    rect(nextBtnX, btnY, btnWidth, btnHeight, 8);
    
    fill(255, 255, 255, alpha);
    textSize(16);
    textAlign(CENTER, CENTER);
    text(nextLabel, nextBtnX + btnWidth / 2, btnY + btnHeight / 2);
    
    this.nextButtonBounds = { x: nextBtnX, y: btnY, w: btnWidth, h: btnHeight };
    
    // "Skip Tutorial" button
    const skipBtnX = x + 25;
    const skipBtnWidth = 100;
    
    const hoverSkip = mouseX >= skipBtnX && mouseX <= skipBtnX + skipBtnWidth &&
                      mouseY >= btnY && mouseY <= btnY + btnHeight;
    
    fill(hoverSkip ? [55, 45, 45, alpha] : [35, 35, 35, alpha * 0.8]);
    stroke(70, 60, 60, alpha * 0.8);
    strokeWeight(1);
    rect(skipBtnX, btnY, skipBtnWidth, btnHeight, 8);
    
    fill(140, 130, 130, alpha);
    textSize(12);
    text("Skip Tutorial", skipBtnX + skipBtnWidth / 2, btnY + btnHeight / 2);
    
    this.skipButtonBounds = { x: skipBtnX, y: btnY, w: skipBtnWidth, h: btnHeight };
    
    
  }
  
  _getTipPanelPosition(guidePosition, panelWidth, panelHeight) {
    const cw = CONFIG.canvasWidth;
    const ch = CONFIG.canvasHeight;
    const margin = 60;
    const topMargin = CONFIG.topBarHeight + 40;
    const bottomMargin = CONFIG.bottomBarHeight + 40;
    
    switch (guidePosition) {
      case 'center':
        return { x: (cw - panelWidth) / 3, y: (ch - panelHeight) / 2 };
      case 'left':
        return { x: (CONFIG.gameAreaWidth - panelWidth*1.2), y: (ch - panelHeight) / 2 };
      case 'right':
        return { x: CONFIG.rightSidebarX - panelWidth - margin, y: (ch - panelHeight) / 2 };
      case 'top':
        return { x: (CONFIG.gameAreaWidth - panelWidth) / 2, y: topMargin };
      case 'bottom':
        return { x: (CONFIG.gameAreaWidth - panelWidth) / 2, y: ch - panelHeight - bottomMargin };
      case 'topLeft':
        return { x: (CONFIG.gameAreaWidth - panelWidth*1.2), y: topMargin };
      case 'topRight':
        return { x: CONFIG.rightSidebarX - panelWidth - margin, y: topMargin };
      case 'bottomLeft':
        return { x: (CONFIG.gameAreaWidth - panelWidth*1.2), y: ch - panelHeight - bottomMargin };
      case 'bottomRight':
        return { x: CONFIG.rightSidebarX - panelWidth - margin, y: ch - panelHeight - bottomMargin };
      default:
        return { x: (cw - panelWidth) / 2, y: (ch - panelHeight) / 2 };
    }
  }
  
  // ============================================
  // UTILITY METHODS
  // ============================================
  
  triggerTip(tipId) {
    if (TUTORIAL_TIPS[tipId]) {
      this.shownTips.delete(tipId);
      this._showTip(tipId);
    }
  }
  
  reset() {
    this.shownTips.clear();
    this.pendingTips = [];
    this.currentTip = null;
    this.active = false;
    this.enabled = true;
    this.tipCooldowns = {};
    this._pausedByTutorial = false;
    this._previousGameState = null;
  }
  
  getProgress() {
    const total = Object.keys(TUTORIAL_TIPS).length;
    const shown = this.shownTips.size;
    return { shown, total, percentage: Math.round((shown / total) * 100) };
  }
  
  hasShown(tipId) {
    return this.shownTips.has(tipId);
  }
}