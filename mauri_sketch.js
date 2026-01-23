let plantSprites = {};
// Delta time management
let lastFrameTime = 0;
let deltaTime = 16.667; // Default to 60fps in ms
let deltaMultiplier = 1.0; // 1.0 = 60fps
const TARGET_FRAME_TIME = 16.667; // 60fps target in ms

// FPS tracking
let fpsHistory = [];
const FPS_HISTORY_SIZE = 30;
let currentFPS = 60;

function preload(){
  OpenDyslexic = loadFont('typefaces/OpenDyslexic.ttf');
  GroceryRounded = loadFont('typefaces/GroceryRounded.ttf');
  // Load plant sprites
  // Plants that have sprites (Kawakawa keeps procedural rendering)
  const spritePlants = ['Tussock', 'Flax', 'Fern', 'Rimu', 'Beech', 'Patotara'];
  const states = ['Mature', 'Thriving', 'Wilting', 'Dormant'];
  
  for (const plant of spritePlants) {
    const key = plant.toLowerCase();
    plantSprites[key] = {};
    for (const state of states) {
      plantSprites[key][state.toLowerCase()] = loadImage(`sprites/${plant}_${state}.png`);
    }
  }
}

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  version: '0.7.0',
  // Canvas dimensions
  canvasWidth: 1920,
  canvasHeight: 1080,
  
  // Game area (where simulation runs)
  gameAreaX: 0,
  gameAreaY: 180,
  gameAreaWidth: 1280,
  gameAreaHeight: 720,
  
  // UI Panel dimensions
  topBarHeight: 180,
  bottomBarHeight: 180,
  rightSidebarWidth: 640,
  rightSidebarX: 1280, // gameAreaWidth
  
  // Legacy compatibility (point to game area)
  get width() { return this.gameAreaWidth; },
  get height() { return this.gameAreaHeight; },
  
  pixelScale: 1,
  zoom: 2,
  debugMode: false,
  
  // UI Colors
  col_UI: [40, 70, 30, 180],
  col_panelBg: [25, 35, 30, 240],
  col_panelBorder: [60, 90, 70],
  col_panelHeader: [45, 75, 55],
  
  noiseScale: 0.005,
  octaves: 2,
  persistence: 0.4,
  lacunarity: 3.0,
  
  ridgeInfluence: 2.25,
  elevationPower: 2.2,
  islandFalloff: 0.3, 
  
  showContours: true,
  contourInterval: 0.045,
  showLabels: false,
  showDebug: false,
  showHungerBars: true,
  
  initialMoaCount: 6,
  maxMoaPopulation: 60,
  eagleCount: 2,
  startingSpecies: 'upland_moa',
  
  plantDensity: 0.002,
  
  startingMauri: 30,
  targetPopulation: 30,
  survivalTimeGoal: 3600,
  
  eggIncubationTime: 500,
  securityTimeToLay: 900,
  securityTimeVariation: 400, 
  layingHungerThreshold: 28,
  
  seasonDuration: 1500, 
  
  eagleSpawnMilestones: [10, 15, 20, 25, 35, 45, 55]
};

function fillColor(colorArray, alphaOverride = null) {
  if (!colorArray) {
    fill(128, 128, 128); // Fallback gray
    return;
  }
  if (alphaOverride !== null) {
    fill(colorArray[0], colorArray[1], colorArray[2], alphaOverride);
  } else if (colorArray.length === 4) {
    fill(colorArray[0], colorArray[1], colorArray[2], colorArray[3]);
  } else {
    fill(colorArray[0], colorArray[1], colorArray[2]);
  }
}

function strokeColor(colorArray) {
  if (!colorArray) {
    stroke(128, 128, 128); // Fallback gray
    return;
  }
  if (colorArray.length === 4) {
    stroke(colorArray[0], colorArray[1], colorArray[2], colorArray[3]);
  } else {
    stroke(colorArray[0], colorArray[1], colorArray[2]);
  }
}

// ============================================
// PRE-CACHED COLORS (avoid creating in render loops)
// ============================================
const CACHED_COLORS = {
  // Initialized in setup() after p5 is ready
};

function initCachedColors() {
  CACHED_COLORS.placementValid = [100, 255, 100, 100];
  CACHED_COLORS.placementInvalid = [255, 100, 100, 100];
  CACHED_COLORS.placementValidStrong = [100, 255, 100, 200];
  CACHED_COLORS.placementInvalidStrong = [255, 100, 100, 200];
  CACHED_COLORS.spacingValid = [100, 200, 255, 60];
  CACHED_COLORS.spacingInvalid = [255, 150, 100, 80];
  CACHED_COLORS.blockerLine = [255, 100, 100, 150];
  CACHED_COLORS.blockerHighlight = [255, 100, 100, 200];
  CACHED_COLORS.floatingGreen = [100, 220, 100];
  CACHED_COLORS.menuBg = [25, 35, 30];
  CACHED_COLORS.menuTitle = [180, 220, 180];
  CACHED_COLORS.menuSubtitle = [140, 180, 140];
  CACHED_COLORS.menuText = [160, 180, 160];
  CACHED_COLORS.menuHint = [120, 150, 130];
  CACHED_COLORS.menuFooter = [100, 120, 100];
  CACHED_COLORS.btnNormal = [60, 120, 60];
  CACHED_COLORS.btnHover = [80, 140, 80];
  CACHED_COLORS.btnStroke = [100, 160, 100];
  CACHED_COLORS.notifSuccess = [60, 120, 60];
  CACHED_COLORS.notifSuccessText = [180, 255, 180];
  CACHED_COLORS.notifError = [120, 60, 60];
  CACHED_COLORS.notifErrorText = [255, 180, 180];
  CACHED_COLORS.notifInfo = [60, 80, 100];
  CACHED_COLORS.notifInfoText = [200, 220, 240];
}

function initPanelColors() {
  // Panel colors - stored as arrays
  CACHED_COLORS.panelBg = [25, 35, 30, 240];
  CACHED_COLORS.panelBorder = [60, 90, 70];
  CACHED_COLORS.panelHeader = [45, 75, 55];
  CACHED_COLORS.panelDivider = [50, 80, 60];
  CACHED_COLORS.sidebarBg = [30, 45, 35, 250];
}

// ============================================
// GAME STATE
// ============================================
const GAME_STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

// ============================================
// PLACEABLE ITEMS
// ============================================
const PLACEABLES = {
  kawakawa: {
    name: "Kawakawa Grove",
    description: "Rich feeding ground",
    cost: 25,
    icon: '🌿',
    color: '#2d8a4e',
    effect: 'feeding',
    radius: 40,
    duration: 1200, 
    minSpacing: 30,
    ignoresSpacing: false,
    feedingRate: 0.2,
    baseFeedingRate: 0.2,
    plantSpawnCount: 5,
    plantType: 'kawakawa',
    seasonalBonus: { summer: 1.5, autumn: 0.8, winter: 0.4, spring: 1.0 },
    attractsHungryMoa: true,
    attractionStrength: 1.3
  },
  
  shelter: {
    name: "Fern Shelter",
    description: "Eagles can't see moa here",
    cost: 40,
    icon: '🌴',
    color: '#1a5c32',
    effect: 'shelter',
    radius: 50,
    duration: 3200,
    securityBonus: 4.0,
    blocksEagleVision: true,
    minSpacing: 30,
    ignoresSpacing: false,
    feedingRate: 0.05,
    baseFeedingRate: 0.05,
    seasonalBonus: { summer: 1.0, autumn: 1.0, winter: 1.3, spring: 1.0 }
  },
  
  nest: {
    name: "Nesting Site",
    description: "Safe place to lay eggs",
    cost: 50,
    icon: '🪺',
    color: '#8b7355',
    effect: 'nesting',
    radius: 32,
    duration: 3600,
    securityBonus: 2.5,
    eggSpeedBonus: 2.0,
    attractsReadyMoa: true,
    attractionStrength: 2.0,
    minSpacing: 20,
    ignoresSpacing: false,
    seasonalBonus: { summer: 0.8, autumn: 1.0, winter: 0.6, spring: 1.5 }
  },
  
  decoy: {
    name: "Decoy",
    description: "Distracts hunting eagles",
    cost: 35,
    icon: '🌩️',
    color: '#c4a35a',
    effect: 'decoy',
    radius: 70,
    duration: 600,
    distractsEagles: true,
    distractionStrength: 1.0,
    minSpacing: 0,
    ignoresSpacing: true,
    seasonalBonus: { summer: 1.0, autumn: 1.0, winter: 1.2, spring: 1.0 }
  },
  
  waterhole: {
    name: "Waterhole",
    description: "Rest and slow hunger",
    cost: 45,
    icon: '💧',
    color: '#4a90a4',
    effect: 'water',
    radius: 35,
    duration: 2400,
    hungerSlowdown: 0.4,
    feedingRate: 0.1,
    baseFeedingRate: 0.1,
    attractsMoa: true,
    attractionStrength: 1.2,
    minSpacing: 30,
    ignoresSpacing: false,
    seasonalBonus: { summer: 2.0, autumn: 1.0, winter: 0.5, spring: 1.2 }
  },
  
  harakeke: {
    name: "Harakeke Flax",
    description: "Food and light cover",
    cost: 30,
    icon: '🌾',
    color: '#5a8a3a',
    effect: 'feeding',
    radius: 36,
    duration: 1800,
    minSpacing: 30,
    ignoresSpacing: false,
    feedingRate: 0.15,
    baseFeedingRate: 0.15,
    plantSpawnCount: 3,
    plantType: 'flax',
    securityBonus: 1.4,
    seasonalBonus: { summer: 1.3, autumn: 1.5, winter: 0.7, spring: 1.0 },
    attractsHungryMoa: true,
    attractionStrength: 1.2
  }
};

// Pre-parse placeable colors after setup
function initPlaceableColors() {
  for (const key in PLACEABLES) {
    const p = PLACEABLES[key];
    p._parsedColor = color(p.color);
  }
}

// ============================================
// BIOME DEFINITIONS
// ============================================
const BIOMES = {
  sea: {
    key: 'sea', name: "Sea", minElevation: 0, maxElevation: 0.12,
    colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#0f2533',
    walkable: false, canHavePlants: false, canPlace: false
  },
  coastal: {
    key: 'coastal', name: "Coastal/Beach", minElevation: 0.12, maxElevation: 0.15,
    colors: ['#c2b280', '#d4c794', '#e6dca8'], contourColor: '#8a7d5a',
    walkable: true, canHavePlants: false, canPlace: true
  },
  grassland: {
    key: 'grassland', name: "Lowland Grassland", minElevation: 0.15, maxElevation: 0.25,
    colors: ['#7fb069', '#8fbc79', '#9fc889'], contourColor: '#5a7d4a',
    walkable: true, canHavePlants: true, plantTypes: ['tussock', 'flax'], canPlace: true
  },
  podocarp: {
    key: 'podocarp', name: "Podocarp Forest", minElevation: 0.25, maxElevation: 0.45,
    colors: ['#2d5a3d', '#346644', '#3b724b'], contourColor: '#1e3d29',
    walkable: true, canHavePlants: true, plantTypes: ['fern', 'rimu'], canPlace: true
  },
  montane: {
    key: 'montane', name: "Montane Forest", minElevation: 0.45, maxElevation: 0.53,
    colors: ['#4a7c59', '#528764', '#5a926f'], contourColor: '#335740',
    walkable: true, canHavePlants: true, 
    plantTypes: ['beech', 'fern', 'patotara'],
    canPlace: true
  },
  subalpine: {
    key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.53, maxElevation: 0.70,
    colors: ['#a8a060', '#b5ad6d', '#c2ba7a'], contourColor: '#7a7445',
    walkable: true, canHavePlants: true, 
    plantTypes: ['tussock', 'patotara'],
    canPlace: true
  },
  alpine: {
    key: 'alpine', name: "Alpine Rock", minElevation: 0.70, maxElevation: 0.84,
    colors: ['#8b8b8b', '#9a9a9a', '#a9a9a9'], contourColor: '#5c5c5c',
    walkable: false, canHavePlants: false, canPlace: false
  },
  snow: {
    key: 'snow', name: "Permanent Snow", minElevation: 0.84, maxElevation: 1.0,
    colors: ['#e8e8e8', '#f0f0f0', '#ffffff'], contourColor: '#b0b0b0',
    walkable: false, canHavePlants: false, canPlace: false
  }
};

// ============================================
// PLANT DEFINITIONS
// ============================================
// Update PLANT_TYPES:
const PLANT_TYPES = {
  tussock: { name: "Tussock", nutrition: 25, color: '#8ea040', size: 24, growthTime: 200 },
  flax: { name: "Flax", nutrition: 35, color: '#487020', size: 26, growthTime: 280 },
  fern: { name: "Fern", nutrition: 30, color: '#228B22', size: 36, growthTime: 240 },
  rimu: { name: "Rimu Fruit", nutrition: 50, color: '#8B0000', size: 48, growthTime: 400 },
  beech: { name: "Beech Mast", nutrition: 40, color: '#8b430f', size: 52, growthTime: 350 },
  kawakawa: { name: "Kawakawa", nutrition: 40, color: '#3d9a5e', size: 22, growthTime: 150 },
  patotara: { name: "Patotara", nutrition: 35, color: '#c94c5a', size: 28, growthTime: 160 }
};

// ============================================
// MAURI MANAGER (Optimized)
// ============================================
class MauriManager {
  constructor(startingAmount) {
    this.mauri = startingAmount;
    this.totalEarned = 0;
    this.totalSpent = 0;
    
    this.perMoaPerSecond = 0;
    this.onMoaEat = 1;
    this.onEggLaid = 5;
    this.onEggHatch = 10;
    this.onMoaThriving = 0.1;
    this.populationMilestoneBonus = 50;

    this.eatMauriThreshold = 50; 
    this.floatingTexts = [];
    this.lastMilestone = 0;
    this.eagleSpawnedAt = new Set(); // Use Set for O(1) lookup
  }
  
  earn(amount, x, y, reason) {
    this.mauri += amount;
    this.totalEarned += amount;
    
    if (x !== undefined && y !== undefined) {
      this.floatingTexts.push({
        text: `+${amount | 0}`, // Faster than toFixed(0)
        x: x,
        y: y,
        life: 60,
        maxLife: 60
      });
    }
  }
  
  earnFromEating(amount, x, y) {
    if (this.mauri < this.eatMauriThreshold) {
      this.earn(amount, x, y, 'eat');
      return true;
    }
    return false;
  }
  
  spend(amount) {
    if (this.mauri >= amount) {
      this.mauri -= amount;
      this.totalSpent += amount;
      return true;
    }
    return false;
  }
  
  canAfford(amount) {
    return this.mauri >= amount;
  }
  
  checkMilestones(moaCount, simulation, game) {
    const mauriMilestones = [10, 15, 20, 25, 30, 40, 50];
    for (let i = 0; i < mauriMilestones.length; i++) {
      const m = mauriMilestones[i];
      if (moaCount >= m && this.lastMilestone < m) {
        this.lastMilestone = m;
        this.earn(this.populationMilestoneBonus, CONFIG.width / 2 / CONFIG.zoom, 50, 'milestone');
        game.addNotification(`Population milestone: ${m} moa! +${this.populationMilestoneBonus} mauri`, 'success');
      }
    }
    
    const eagleMilestones = CONFIG.eagleSpawnMilestones;
    for (let i = 0; i < eagleMilestones.length; i++) {
      const threshold = eagleMilestones[i];
      if (moaCount >= threshold && !this.eagleSpawnedAt.has(threshold)) {
        this.eagleSpawnedAt.add(threshold);
        simulation.spawnEagle();
        game.addNotification(`A new Haast's Eagle has arrived!`, 'error');
        return threshold;
      }
    }
    
    return null;
  }
  
  updateFloatingTexts(dt = 1) {
  const texts = this.floatingTexts;
  for (let i = texts.length - 1; i >= 0; i--) {
    const ft = texts[i];
    ft.life -= dt;
    ft.y -= 0.5 * dt;
    if (ft.life <= 0) {
      texts[i] = texts[texts.length - 1];
      texts.pop();
    }
  }
}
  
  renderFloatingTexts() {
    const texts = this.floatingTexts;
    if (texts.length === 0) return;
    
    noStroke();
    textSize(10);
    textAlign(CENTER, CENTER);
    
    for (let i = 0; i < texts.length; i++) {
      const ft = texts[i];
      const alpha = (ft.life / ft.maxLife) * 255;
      fill(100, 220, 100, alpha);
      text(ft.text, ft.x, ft.y);
    }
  }
}

// ============================================
// GAME MANAGER (Optimized)
// ============================================
class Game {
  constructor() {
    this.state = GAME_STATE.MENU;
    this.terrain = null;
    this.simulation = null;
    this.mauri = null;
    this.ui = null;
    this.seasonManager = null;
    
    this.selectedPlaceable = null;
    this.placePreview = null;
    
    this.playTime = 0;
    this.maxPlayTime = 0;

    this._menuBtnBounds = null;
    
    this.goals = [
      { name: "Survive 60 seconds", condition: () => this.playTime >= 3600, reward: 50, achieved: false },
      { name: "Reach 10 moa", condition: () => this._cachedMoaCount >= 10, reward: 50, achieved: false },
      { name: "Hatch 10 eggs", condition: () => this.simulation?.stats.births >= 10, reward: 100, achieved: false },
      { name: "Reach 20 moa", condition: () => this._cachedMoaCount >= 20, reward: 50, achieved: false },
      { name: "Survive 3 minutes", condition: () => this.playTime >= 10800, reward: 100, achieved: false },
      { name: "Reach 30 moa", condition: () => this._cachedMoaCount >= 30, reward: 100, achieved: false }
    ];
    
    this.notifications = [];
    this.gameOverReason = '';
    
    // Cached values to avoid repeated calculations
    this._cachedMoaCount = 0;
    this._cachedEggCount = 0;
    this._cachedThrivingCount = 0;
    
    // Reusable vector for distance checks
    this._tempVec = null;
  }
  
  init() {
    this.terrain = new TerrainGenerator(CONFIG, BIOMES);
    this.terrain.generate();
    
    this.seasonManager = new SeasonManager(CONFIG);
    
    this.simulation = new Simulation(this.terrain, CONFIG, this, this.seasonManager);
    this.simulation.init();
    
    this.mauri = new MauriManager(CONFIG.startingMauri);
    this.ui = new GameUI(CONFIG, this.terrain, this.simulation, this.mauri, this, this.seasonManager);
    
    this.playTime = 0;
    this.state = GAME_STATE.PLAYING;
    
    this._tempVec = createVector(0, 0);
    
    for (let i = 0; i < this.goals.length; i++) {
      this.goals[i].achieved = false;
    }
  }

  isInGameArea(mx, my) {
    return mx >= CONFIG.gameAreaX && 
           mx < CONFIG.gameAreaX + CONFIG.gameAreaWidth &&
           my >= CONFIG.gameAreaY && 
           my < CONFIG.gameAreaY + CONFIG.gameAreaHeight;
  }
  
  // Cache population counts once per frame
  updateCachedCounts() {
    const moas = this.simulation.moas;
    const eggs = this.simulation.eggs;
    
    let moaCount = 0;
    let thrivingCount = 0;
    
    for (let i = 0; i < moas.length; i++) {
      if (moas[i].alive) {
        moaCount++;
        if (moas[i].hunger < 20) thrivingCount++;
      }
    }
    
    let eggCount = 0;
    for (let i = 0; i < eggs.length; i++) {
      if (eggs[i].alive) eggCount++;
    }
    
    this._cachedMoaCount = moaCount;
    this._cachedEggCount = eggCount;
    this._cachedThrivingCount = thrivingCount;
  }
  
  getMoaPopulation() {
    return this._cachedMoaCount;
  }
  
  update(dt = 1) {  // dt = delta time multiplier (1.0 = 60fps)
  if (this.state !== GAME_STATE.PLAYING) return;
  
  this.playTime += dt;
  if (this.playTime > this.maxPlayTime) this.maxPlayTime = this.playTime;
  
  const seasonChanged = this.seasonManager.update(dt);
  if (seasonChanged) {
    this.onSeasonChange();
  }
  
  this.simulation.update(this.mauri, dt);
  
  // Update cached counts once per frame
  this.updateCachedCounts();
  
  // Passive mauri income (adjusted for delta time)
  // Instead of checking every 64 frames, accumulate time
  this._incomeAccumulator = (this._incomeAccumulator || 0) + dt;
  if (this._incomeAccumulator >= 64) {
    this._incomeAccumulator -= 64;
    const income = this._cachedMoaCount * this.mauri.perMoaPerSecond + 
                   this._cachedThrivingCount * this.mauri.onMoaThriving;
    
    if (income > 0) {
      this.mauri.earn(income, undefined, undefined, 'passive');
    }
  }
  
  this.checkGoals();
  this.mauri.checkMilestones(this._cachedMoaCount, this.simulation, this);
  
  if (this._cachedMoaCount === 0 && this._cachedEggCount === 0) {
    this.state = GAME_STATE.LOST;
    this.gameOverReason = "All moa have perished!";
  }
  
  this.mauri.updateFloatingTexts(dt);
  this.updateNotifications(dt);
}

updateNotifications(dt = 1) {
  const notifs = this.notifications;
  for (let i = notifs.length - 1; i >= 0; i--) {
    notifs[i].life -= dt;
    if (notifs[i].life <= 0) {
      notifs.splice(i, 1);
    }
  }
}
  
  checkGoals() {
    const goals = this.goals;
    const halfWidth = CONFIG.width / 2 / CONFIG.zoom;
    
    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i];
      if (!goal.achieved && goal.condition()) {
        goal.achieved = true;
        this.mauri.earn(goal.reward, halfWidth, 80, 'goal');
        this.addNotification(`Goal achieved: ${goal.name}! +${goal.reward} mauri`, 'success');
      }
    }
    
    // Check all goals achieved
    let allAchieved = true;
    for (let i = 0; i < goals.length; i++) {
      if (!goals[i].achieved) {
        allAchieved = false;
        break;
      }
    }
    if (allAchieved) {
      this.state = GAME_STATE.WON;
    }
  }
  
  addNotification(text, type = 'info') {
    this.notifications.push({
      text: text,
      type: type,
      life: 600,      // 2x longer (was 300)
      maxLife: 600,   // 2x longer (was 300)
      time: this.playTime,  // Add timestamp for "X seconds ago" display
      _cachedWidth: null
    });
    
    if (this.notifications.length > 8) {  // Fewer max since they're bigger in sidebar
      this.notifications.shift();
    }
  }
  

  onSeasonChange() {
    const season = this.seasonManager.current;
    this.addNotification(`Season changed to ${season.name} ${season.icon}`, 'info');
    
    const aliveMoas = [];
    const moas = this.simulation.moas;
    for (let i = 0; i < moas.length; i++) {
      if (moas[i].alive) aliveMoas.push(moas[i]);
    }
    
    const migrationMessages = this.seasonManager.getMigrationMessages(aliveMoas);
    
    if (migrationMessages.current) {
      setTimeout(() => {
        this.addNotification(migrationMessages.current, 'info');
      }, 500);
    }
    
    if (migrationMessages.upcoming) {
      setTimeout(() => {
        this.addNotification(migrationMessages.upcoming, 'info');
      }, 2000);
    }
  }
  
  selectPlaceable(type) {
    if (PLACEABLES[type] && this.mauri.canAfford(PLACEABLES[type].cost)) {
      this.selectedPlaceable = type;
    } else {
      this.addNotification("Not enough mauri!", 'error');
    }
  }
  
  cancelPlacement() {
    this.selectedPlaceable = null;
  }
  
  canPlaceWithSpacing(x, y, type) {
    const def = PLACEABLES[type];
    
    if (def.ignoresSpacing) {
      return { allowed: true };
    }
    
    const mySpacing = def.minSpacing || 40;
    const placeables = this.simulation.placeables;
    
    // Reuse temp vector
    this._tempVec.set(x, y);
    
    for (let i = 0; i < placeables.length; i++) {
      const p = placeables[i];
      if (!p.alive) continue;
      
      const otherDef = PLACEABLES[p.type];
      if (otherDef.ignoresSpacing) continue;
      
      const otherSpacing = otherDef.minSpacing || 40;
      const requiredDist = (mySpacing + otherSpacing) * 0.5;
      
      const dist = p5.Vector.dist(this._tempVec, p.pos);
      
      if (dist < requiredDist) {
        return { 
          allowed: false, 
          reason: `Too close to ${otherDef.name}`,
          blocker: p,
          requiredDist: requiredDist,
          actualDist: dist
        };
      }
    }
    
    return { allowed: true };
  }
    
  tryPlace(x, y) {
    if (!this.selectedPlaceable) return false;
    
    const def = PLACEABLES[this.selectedPlaceable];
    
    if (!this.terrain.canPlace(x, y)) {
      this.addNotification("Cannot place here!", 'error');
      return false;
    }
    
    const spacingCheck = this.canPlaceWithSpacing(x, y, this.selectedPlaceable);
    if (!spacingCheck.allowed) {
      this.addNotification(spacingCheck.reason, 'error');
      return false;
    }
    
    if (!this.mauri.spend(def.cost)) {
      this.addNotification("Not enough mauri!", 'error');
      return false;
    }
    
    this.simulation.addPlaceable(x, y, this.selectedPlaceable);
    this.addNotification(`Placed ${def.name}`, 'info');
    
    if (!keyIsDown(SHIFT)) {
      this.selectedPlaceable = null;
    }
    
    return true;
  }
  
  render() {
    background(20, 30, 25); // Dark background for panels
    
    if (this.state === GAME_STATE.MENU) {
      this.renderMenu();
      return;
    }
    
    // Render UI panels first (behind game area)
    this.ui.renderPanels();
    
    // Render game area with offset and clipping
    push();
    
    // Clip to game area to prevent overflow
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(
      CONFIG.gameAreaX, 
      CONFIG.gameAreaY, 
      CONFIG.gameAreaWidth, 
      CONFIG.gameAreaHeight
    );
    drawingContext.clip();
    
    // Translate to game area origin
    translate(CONFIG.gameAreaX, CONFIG.gameAreaY);
    scale(CONFIG.zoom);
    
    this.terrain.render();
    this.simulation.render();
    this.mauri.renderFloatingTexts();
    
    if (this.selectedPlaceable && this.state === GAME_STATE.PLAYING) {
      this.renderPlacementPreview();
    }
    
    drawingContext.restore();
    pop();
    
    // Render UI content on top of panels
    this.ui.render();
    //this.renderNotifications();
    
    if (this.state === GAME_STATE.PAUSED) {
      this.renderPauseOverlay();
    } else if (this.state === GAME_STATE.WON) {
      this.renderWinOverlay();
    } else if (this.state === GAME_STATE.LOST) {
      this.renderLoseOverlay();
    }
  }
  
  renderMenu() {
    // Use full canvas dimensions for menu
    const cw = CONFIG.canvasWidth;
    const ch = CONFIG.canvasHeight;
    const centerX = cw * 0.5;
    const centerY = ch * 0.5;
    
    // Full canvas background
    fill(CACHED_COLORS.menuBg);
    noStroke();
    rect(0, 0, cw, ch);
    
    // Subtle vignette effect
    for (let i = 0; i < 5; i++) {
      const alpha = 3 - i * 0.5;
      fill(0, 0, 0, alpha);
      rect(i * 20, i * 20, cw - i * 40, ch - i * 40);
    }
    
    textAlign(CENTER, CENTER);
    
    // Game title
    fill(CACHED_COLORS.menuTitle);
    textSize(64);
    push();
    textFont(GroceryRounded);
    text("MAURI", centerX, centerY - 280);
    pop();
    
    // Subtitle
    fill(CACHED_COLORS.menuSubtitle);
    textSize(20);
    text("A New Zealand Ecosystem Strategy Game", centerX, centerY - 220);
    
    // Moa illustration
    push();
    translate(centerX, centerY - 100);
    scale(5);
    noStroke();
    fill(101, 67, 33);
    ellipse(0, 0, 8, 11);
    ellipse(3, -3, 7, 5);
    fill(185, 170, 140);
    triangle(5, -5, 10, -2, 6, -2);
    stroke(55, 38, 20);
    strokeWeight(1.5);
    line(-3, 5, -4, 12);
    line(3, 5, 4, 12);
    pop();
    
    // Instructions
    fill(CACHED_COLORS.menuText);
    textSize(16);
    const instructions = [
      "Guide the Upland Moa through the seasons;",
      "Cold regions become barren during winter.",
      "Grow the ecosystem to gain Mauri",
      "Beware: More moa attracts more Pouākai!"
    ];
    
    for (let i = 0; i < instructions.length; i++) {
      text(instructions[i], centerX, centerY + 60 + i * 28);
    }
    
    // Start button - centered on full canvas
    const btnW = 200;
    const btnH = 60;
    const btnX = centerX - btnW / 2;
    const btnY = centerY + 200;
    
    const hover = mouseX > btnX && mouseX < btnX + btnW && 
                  mouseY > btnY && mouseY < btnY + btnH;
    
    // Button shadow
    fill(0, 0, 0, 30);
    noStroke();
    rect(btnX + 3, btnY + 3, btnW, btnH, 12);
    
    // Button background
    fill(hover ? CACHED_COLORS.btnHover : CACHED_COLORS.btnNormal);
    stroke(CACHED_COLORS.btnStroke);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 12);
    
    // Button text
    fill(255);
    noStroke();
    textSize(28);
    push();
    textFont(GroceryRounded);
    text("Start Level", centerX, btnY + btnH * 0.5);
    pop();
    
    // Hint text
    fill(CACHED_COLORS.menuHint);
    textSize(12);
    text("Press any key or click to start", centerX, btnY + btnH + 30);
    
    // Footer
    fill(CACHED_COLORS.menuFooter);
    textSize(11);
    text("Inspired by Equilinox • Upland Moa & Haast's Eagle", centerX, ch - 40);
    
    // Store button bounds for click detection
    this._menuBtnBounds = { x: btnX, y: btnY, w: btnW, h: btnH };
  }

  
  renderPlacementPreview() {

  if (!this.isInGameArea(mouseX, mouseY)) return;
  
  const invZoom = 1 / CONFIG.zoom;
  const tx = (mouseX - CONFIG.gameAreaX) * invZoom;
  const ty = (mouseY - CONFIG.gameAreaY) * invZoom;
  
  if (tx < 0 || tx > this.terrain.mapWidth || ty < 0 || ty > this.terrain.mapHeight) return;
    
    const def = PLACEABLES[this.selectedPlaceable];
    const canPlaceTerrain = this.terrain.canPlace(tx, ty);
    const spacingCheck = this.canPlaceWithSpacing(tx, ty, this.selectedPlaceable);
    const canPlace = canPlaceTerrain && spacingCheck.allowed;
    
    push();
    translate(tx, ty);
    
    const radiusDouble = def.radius * 2;
    
    // Main radius indicator
    noFill();
    stroke(canPlace ? CACHED_COLORS.placementValid : CACHED_COLORS.placementInvalid);
    strokeWeight(1);
    ellipse(0, 0, radiusDouble, radiusDouble);
    
    // Spacing radius
    if (!def.ignoresSpacing) {
      const spacingRadius = (def.minSpacing || 40) * 2;
      stroke(canPlace ? CACHED_COLORS.spacingValid : CACHED_COLORS.spacingInvalid);
      drawingContext.setLineDash([4, 4]);
      ellipse(0, 0, spacingRadius, spacingRadius);
      drawingContext.setLineDash([]);
    }
    
    // Main placement indicator
    const col = def._parsedColor;
    fill(red(col), green(col), blue(col), canPlace ? 150 : 80);
    stroke(canPlace ? CACHED_COLORS.placementValidStrong : CACHED_COLORS.placementInvalidStrong);
    strokeWeight(2);
    ellipse(0, 0, 18, 18);
    
    pop();
    
    // Blocking indicator
    if (!spacingCheck.allowed && spacingCheck.blocker) {
      push();
      stroke(CACHED_COLORS.blockerLine);
      strokeWeight(1);
      drawingContext.setLineDash([3, 3]);
      line(tx, ty, spacingCheck.blocker.pos.x, spacingCheck.blocker.pos.y);
      drawingContext.setLineDash([]);
      
      noFill();
      stroke(CACHED_COLORS.blockerHighlight);
      strokeWeight(2);
      const blockerRadius = spacingCheck.blocker.radius;
      ellipse(spacingCheck.blocker.pos.x, spacingCheck.blocker.pos.y, 
              blockerRadius * 2 + 10, blockerRadius * 2 + 10);
      pop();
    }
  }
  
  renderNotifications() {
    const notifs = this.notifications;
    if (notifs.length === 0) return;
    
    // Position notifications in the game area, below the top bar
    const centerX = CONFIG.gameAreaX + CONFIG.gameAreaWidth * 0.5;
    let y = CONFIG.gameAreaY + 50; // 50px below top of game area
    
    textSize(12);
    
    for (let i = 0; i < notifs.length; i++) {
      const notif = notifs[i];
      const alpha = min(255, notif.life * 2);
      
      let bgColor, textColor;
      switch (notif.type) {
        case 'success':
          bgColor = CACHED_COLORS.notifSuccess;
          textColor = CACHED_COLORS.notifSuccessText;
          break;
        case 'error':
          bgColor = CACHED_COLORS.notifError;
          textColor = CACHED_COLORS.notifErrorText;
          break;
        default:
          bgColor = CACHED_COLORS.notifInfo;
          textColor = CACHED_COLORS.notifInfoText;
      }
      
      // Cache text width
      if (notif._cachedWidth === null) {
        notif._cachedWidth = textWidth(notif.text) + 24;
      }
      const tw = notif._cachedWidth;
      
      fill(bgColor[0], bgColor[1], bgColor[2], alpha * 0.85);
      noStroke();
      rect(centerX - tw * 0.5, y, tw, 26, 6);
      
      fill(textColor[0], textColor[1], textColor[2], alpha);
      textAlign(CENTER, CENTER);
      text(notif.text, centerX, y + 13);
      
      y += 32;
    }
  }
  
  renderPauseOverlay() {
    const cw = CONFIG.gameAreaWidth;
    const ch = CONFIG.gameAreaHeight;
    const cy = CONFIG.gameAreaY;
    const UIgreen = [...CONFIG.col_UI.slice(0,3),100];
    const centerX = cw * 0.5;
    const centerY = ch * 0.5;
    
    // Darken entire screen
    fill(UIgreen);
    noStroke();
    rect(0, cy, cw, ch);
    
    // Pause box
    push();
    translate(0,cy);
    fill(30, 45, 35, 240);
    stroke(70, 110, 80);
    strokeWeight(2);
    rect(centerX - 150, centerY - 80, 300, 160, 15);
    
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(42);
    push();
    textFont(GroceryRounded);
    text("PAUSED", centerX, centerY - 30);
    pop();
    
    textSize(16);
    fill(180, 200, 180);
    text("Press P or SPACE to resume", centerX, centerY + 20);
    
    fill(150, 170, 150);
    textSize(14);
    text("Press R to restart", centerX, centerY + 50);
    pop();
  }

  renderWinOverlay() {
    const cw = CONFIG.gameAreaWidth;
    const ch = CONFIG.gameAreaHeight;
    const cy = CONFIG.gameAreaY;
    const UIgreen = [...CONFIG.col_UI.slice(0, 3), 150];
    const centerX = cw * 0.5;
    const centerY = ch * 0.5;
    
    // Green tinted overlay
    fill(UIgreen);
    noStroke();
    rect(0, cy, cw, ch);
    
    // Win box
    push();
    translate(0, cy);
    fill(30, 60, 40, 250);
    stroke(100, 180, 120);
    strokeWeight(3);
    rect(centerX - 200, centerY - 120, 400, 280, 15);
    
    fill(180, 255, 180);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(42);
    push();
    textFont(GroceryRounded);
    text("ECOSYSTEM THRIVING!", centerX, centerY - 70);
    pop();
    
    fill(150, 220, 150);
    textSize(18);
    text("All goals achieved!", centerX, centerY - 20);
    
    textSize(14);
    fill(120, 180, 120);
    text(`Final population: ${this._cachedMoaCount} moa`, centerX, centerY + 20);
    text(`Total mauri earned: ${this.mauri.totalEarned | 0}`, centerX, centerY + 45);
    text(`Time survived: ${(this.playTime / 60) | 0} seconds`, centerX, centerY + 70);
    
    fill(200, 240, 200);
    textSize(18);
    text("Press R to play again", centerX, centerY + 120);
    pop();
  }

  renderLoseOverlay() {
    const cw = CONFIG.gameAreaWidth;
    const ch = CONFIG.gameAreaHeight;
    const cy = CONFIG.gameAreaY;
    const UIred = [80, 30, 30, 150];
    const centerX = cw * 0.5;
    const centerY = ch * 0.5;
    
    // Red tinted overlay
    fill(UIred);
    noStroke();
    rect(0, cy, cw, ch);
    
    // Lose box
    push();
    translate(0, cy);
    fill(60, 35, 35, 250);
    stroke(150, 100, 100);
    strokeWeight(3);
    rect(centerX - 200, centerY - 120, 400, 280, 15);
    
    fill(255, 180, 180);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(42);
    push();
    textFont(GroceryRounded);
    text("EXTINCTION", centerX, centerY - 70);
    pop();
    
    fill(220, 150, 150);
    textSize(16);
    text(this.gameOverReason, centerX, centerY - 20);
    
    textSize(14);
    fill(180, 120, 120);
    text(`Time survived: ${(this.playTime / 60) | 0} seconds`, centerX, centerY + 20);
    text(`Moa hatched: ${this.simulation.stats.births}`, centerX, centerY + 45);
    text(`Total mauri earned: ${this.mauri.totalEarned | 0}`, centerX, centerY + 70);
    
    fill(220, 180, 180);
    textSize(18);
    text("Press R to try again", centerX, centerY + 120);
    pop();
  }
  
  handleClick(mx, my) {
    if (this.state === GAME_STATE.MENU) {
      // Check button bounds (stored during render)
      if (this._menuBtnBounds) {
        const btn = this._menuBtnBounds;
        if (mx > btn.x && mx < btn.x + btn.w && 
            my > btn.y && my < btn.y + btn.h) {
          this.init();
          return;
        }
      }
      
      // Fallback: click anywhere to start (optional)
      // this.init();
      return;
    }
    
    if (this.state !== GAME_STATE.PLAYING) return;
    
    // Check UI panel clicks first
    if (this.ui.handleClick(mx, my)) return;
    
    // Check if click is within game area
    if (this.isInGameArea(mx, my) && this.selectedPlaceable) {
      // Convert to game area coordinates
      const gameX = mx - CONFIG.gameAreaX;
      const gameY = my - CONFIG.gameAreaY;
      const invZoom = 1 / CONFIG.zoom;
      this.tryPlace(gameX * invZoom, gameY * invZoom);
    }
  }

  isInGameArea(mx, my) {
    return mx >= CONFIG.gameAreaX && 
          mx < CONFIG.gameAreaX + CONFIG.gameAreaWidth &&
          my >= CONFIG.gameAreaY && 
          my < CONFIG.gameAreaY + CONFIG.gameAreaHeight;
  }
  
  handleKey(key) {
    if (key === 'r' || key === 'R') {
      this.init();
      return;
    }

    if (key === 'd' || key === 'D') {
      CONFIG.debugMode = !CONFIG.debugMode;
      return;
    }
    
    if (this.state === GAME_STATE.PLAYING) {
      switch (key) {
        case 'p': case 'P': case ' ':
          this.state = GAME_STATE.PAUSED;
          break;
        case 'Escape':
          this.cancelPlacement();
          break;
        case '1': this.selectPlaceable('kawakawa'); break;
        case '2': this.selectPlaceable('shelter'); break;
        case '3': this.selectPlaceable('nest'); break;
        case '4': this.selectPlaceable('decoy'); break;
        case '5': this.selectPlaceable('waterhole'); break;
        case '6': this.selectPlaceable('harakeke'); break;
        case 'h': case 'H':
          CONFIG.showHungerBars = !CONFIG.showHungerBars;
          break;
      }
    } else if (this.state === GAME_STATE.PAUSED) {
      if (key === 'p' || key === 'P' || key === ' ') {
        this.state = GAME_STATE.PLAYING;
      }
    }
  }
}

// ============================================
// MAIN SKETCH
// ============================================
let game;

function setup() {
  createCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);
  pixelDensity(1);
  frameRate(60);
  textFont('OpenDyslexic');
  
 
  initCachedColors();
  initPanelColors();  
  initPlaceableColors();
  initPlantSprites(plantSprites);
  initializeRegistry();
  
  game = new Game();
}

function initPanelColors() {
  CACHED_COLORS.panelBg = CONFIG.col_panelBg;
  CACHED_COLORS.panelBorder = CONFIG.col_panelBorder;
  CACHED_COLORS.panelHeader = CONFIG.col_panelHeader;
  CACHED_COLORS.panelDivider = [50, 80, 60];
  CACHED_COLORS.sidebarBg = [30, 45, 35, 250];
}

function initializeRegistry() {
  REGISTRY.registerAnimalType('moa', {}, Moa);
  REGISTRY.registerAnimalType('eagle', {}, HaastsEagle);
  
  for (const [key, config] of Object.entries(MOA_SPECIES)) {
    REGISTRY.registerSpecies(key, 'moa', config);
  }
  
  for (const [key, config] of Object.entries(EAGLE_SPECIES)) {
    REGISTRY.registerSpecies(key, 'eagle', config);
  }
  
  for (const [key, config] of Object.entries(PLANT_TYPES)) {
    REGISTRY.registerPlant(key, config);
  }
  
  for (const [key, config] of Object.entries(PLACEABLES)) {
    REGISTRY.registerPlaceable(key, config);
  }
  
  for (const [key, config] of Object.entries(BIOMES)) {
    REGISTRY.registerBiome(key, config);
  }
  
  const issues = REGISTRY.validate();
  if (issues.length > 0) {
    console.warn('Registry validation found issues:', issues);
  }
  
  if (CONFIG.debugMode) {
    console.log('Registry initialized:', REGISTRY.getSummary());
  }
}

function draw() {

  
  // Calculate delta time
  const currentTime = millis();
  deltaTime = currentTime - lastFrameTime;
  lastFrameTime = currentTime;
  
  // Clamp delta time to prevent huge jumps (e.g., after tab switch)
  deltaTime = constrain(deltaTime, 1, 100);
  
  // Calculate multiplier (1.0 = 60fps)
  deltaMultiplier = deltaTime / TARGET_FRAME_TIME;
  
  // Track FPS
  updateFPS();
  
  // Update and render game
  // game.update(deltaMultiplier);
  // game.render();

    let t0 = performance.now();
  game.update(deltaMultiplier);
  let t1 = performance.now();
  game.render();
  let t2 = performance.now();
  
  // Show timing breakdown
  fill(255);
  textSize(10);
  text(`Update: ${(t1-t0).toFixed(1)}ms`, 85, 38);
  text(`Render: ${(t2-t1).toFixed(1)}ms`, 85, 52);
  text(`Version: ${(CONFIG.version)}`, 85, 70);
  
  // Render FPS counter
  renderFPSCounter();
}

function updateFPS() {
  const fps = 1000 / deltaTime;
  fpsHistory.push(fps);
  if (fpsHistory.length > FPS_HISTORY_SIZE) {
    fpsHistory.shift();
  }
  
  // Calculate average FPS
  let sum = 0;
  for (let i = 0; i < fpsHistory.length; i++) {
    sum += fpsHistory[i];
  }
  currentFPS = sum / fpsHistory.length;
}

function renderFPSCounter() {
  push();
  
  // Background
  fill(0, 0, 0, 150);
  noStroke();
  rect(5, 5, 70, 20, 4);
  
  // FPS text
  fill(currentFPS >= 55 ? [100, 255, 100] : (currentFPS >= 30 ? [255, 255, 100] : [255, 100, 100]));
  textSize(12);
  textAlign(LEFT, CENTER);
  textFont('monospace');
  text(`FPS: ${currentFPS.toFixed(1)}`, 10, 15);
  
  pop();
}

function mousePressed() {
  game.handleClick(mouseX, mouseY);
}

function keyPressed() {
  game.handleKey(key);
}