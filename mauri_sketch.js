// lets goooo
let tutorialMantisSprite = null;
let splashScreenMoa = null;

let plantSprites = {};
// Delta time management
let lastFrameTime = 0;
let deltaTime = 16.667;
let deltaMultiplier = 1.0;
const TARGET_FRAME_TIME = 16.667;

// FPS tracking
let fpsHistory = [];
const FPS_HISTORY_SIZE = 30;
let currentFPS = 60;

function preload(){
  OpenDyslexic = loadFont('typefaces/OpenDyslexic.ttf');
  GroceryRounded = loadFont('typefaces/GroceryRounded.ttf');
  
  const spritePlants = ['Tussock', 'Flax', 'Fern', 'Rimu', 'Beech', 'Patotara', 'Lancewood'];
  const states = ['Mature', 'Thriving', 'Wilting', 'Dormant'];
  
  for (const plant of spritePlants) {
    const key = plant.toLowerCase();
    plantSprites[key] = {};
    for (const state of states) {
      plantSprites[key][state.toLowerCase()] = loadImage(`sprites/${plant}_${state}.png`);
    }
  }

  splashScreenMoa = loadImage('sprites/moa_idle.png')
  tutorialMantisSprite = loadImage('sprites/mantis_talk.png');

  loadPlaceableSprites();
  loadEntitySprites();
  preloadAudio();
}

// ============================================
// CONFIGURATION
// ============================================
// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  // ===== ENGINE CONSTANTS (never change between levels) =====
  version: 'alpha 1.0.6 (TEST_BUILD_2_dev)',

  // Reference height is always 1080; width is computed from window aspect ratio
  referenceHeight: 1080,

  // Canvas dimensions (set by recalculateLayout, defaults to 16:9)
  canvasWidth: 1920,
  canvasHeight: 1080,

  // Game area (set by recalculateLayout)
  gameAreaX: 0,
  gameAreaY: 180,
  gameAreaWidth: 1360,
  gameAreaHeight: 760,

  // Panel heights (fixed)
  topBarHeight: 180,
  bottomBarHeight: 140,

  // Sidebar (set by recalculateLayout)
  rightSidebarWidth: 560,
  rightSidebarX: 1360,

  // Sidebar sizing constraints
  minSidebarWidth: 400,
  maxSidebarWidth: 600,
  sidebarWidthRatio: 0.2917,   // ≈560/1920, the 16:9 baseline proportion

  // Supported aspect ratio range
  minAspectRatio: 4 / 3,       // 1.333  (e.g. 1440×1080)
  maxAspectRatio: 21 / 9,      // 2.333  (e.g. 2520×1080)

  // Convenience getters (used throughout simulation code)
  get width() { return this.gameAreaWidth; },
  get height() { return this.gameAreaHeight; },

  pixelScale: 1,
  zoom: 2.5,
  debugMode: false,

  // ===== VIEW TRANSFORM =====
  // The transform the world actually renders through. Normal mode mirrors
  // gameAreaX/Y + zoom; fullscreen mode scales the map to fill the canvas.
  // Written by Game._updateViewTransform() — read, never set, elsewhere.
  fullscreen: false,
  viewX: 0,
  viewY: 180,
  viewZoom: 2.5,

  col_UI: [40, 70, 30, 180],
  col_panelBg: [25, 35, 30, 240],
  col_panelBorder: [60, 90, 70],
  col_panelHeader: [45, 75, 55],

  showContours: true,
  contourInterval: 0.045,
  showLabels: false,
  showDebug: false,
  showHungerBars: true,

  // ===== LEVEL-VARIABLE PARAMS (written by loadLevel) =====
  noiseScale: 0.005,
  octaves: 3,
  persistence: 0.3,
  lacunarity: 3.0,
  ridgeInfluence: 1.3,
  elevationPower: 1.5,
  islandFalloff: 0.6,
  plantDensity: 0.006,

  initialMoaCount: 7,
  maxMoaPopulation: 60,
  eagleCount: 2,
  startingSpecies: 'upland_moa',

  startingMauri: 60,
  eggIncubationTime: 500,
  securityTimeToLay: 800,
  securityTimeVariation: 200,
  layingHungerThreshold: 28,
  seasonDuration: 2100,
  eagleSpawnMilestones: [12, 18, 25, 35, 45, 55],
  targetPopulation: 30,
  survivalTimeGoal: 3600,

  // ===== RESPONSIVE LAYOUT =====
  /**
   * Recomputes all layout dimensions from the current window size.
   * Canvas height is always referenceHeight (1080).
   * Canvas width varies with the window's aspect ratio, clamped to supported range.
   * Sidebar width is proportional to canvas width, clamped to min/max.
   * Game area fills the remaining horizontal space.
   *
   * Call once in setup() and again whenever the window dimensions change
   * (though during gameplay the canvas dimensions are locked and CSS-scaled).
   */
  recalculateLayout(windowW, windowH) {
    const h = this.referenceHeight;

    // Determine aspect ratio from window, clamped to supported range
    let aspect = windowW / windowH;
    aspect = Math.max(this.minAspectRatio, Math.min(this.maxAspectRatio, aspect));

    // Canvas width derived from clamped aspect ratio
    const w = Math.round(h * aspect);

    this.canvasWidth = w;
    this.canvasHeight = h;

    // Sidebar width: proportional to canvas width, clamped
    let sidebarW = Math.round(w * this.sidebarWidthRatio);
    sidebarW = Math.max(this.minSidebarWidth, Math.min(this.maxSidebarWidth, sidebarW));

    this.rightSidebarWidth = sidebarW;
    this.rightSidebarX = w - sidebarW;

    // Game area fills remaining space
    this.gameAreaX = 0;
    this.gameAreaY = this.topBarHeight;
    this.gameAreaWidth = w - sidebarW;
    this.gameAreaHeight = h - this.topBarHeight - this.bottomBarHeight;
  }
};

// ============================================
// LEVEL MECHANICS (optional, per-level, opt-in)
// Read by mauri_moa.js / mauri_simulation.js. Empty = disabled,
// so levels that don't set `mechanics` behave exactly as before.
// ============================================
let LEVEL_MECHANICS = {};
let FOREST_BIOMES = new Set();

// Player-toggled species highlights: speciesKeys whose moa pulse a halo in
// their species highlightColor. Toggled from the population panel (full UI)
// and the focus-species buttons (fullscreen). Cleared on level load.
let SPECIES_HIGHLIGHT = new Set();

// Applies level parameters onto CONFIG
function applyLevelToConfig(levelDef) {
  // Opt-in gameplay mechanics (habitat stress, forest competition, ...)
  LEVEL_MECHANICS = levelDef.mechanics || {};
  FOREST_BIOMES = new Set(LEVEL_MECHANICS.forestBiomes || []);

  // View & calendar (per-level, with engine defaults for levels that omit them)
  CONFIG.zoom = (levelDef.zoom != null) ? levelDef.zoom : 2.5;
  const _seasonOrder = ['summer', 'autumn', 'winter', 'spring'];
  CONFIG.startSeasonIndex = levelDef.startSeason ? Math.max(0, _seasonOrder.indexOf(levelDef.startSeason)) : 0;

  const t = levelDef.terrain;
  CONFIG.noiseScale = t.noiseScale;
  CONFIG.octaves = t.octaves;
  CONFIG.persistence = t.persistence;
  CONFIG.lacunarity = t.lacunarity;
  CONFIG.ridgeInfluence = t.ridgeInfluence;
  CONFIG.elevationPower = t.elevationPower;
  CONFIG.islandFalloff = t.islandFalloff;

  // Optional terrain features
  CONFIG.useLakes = levelDef.terrain.useLakes || false;
  CONFIG.lakeThreshold = levelDef.terrain.lakeThreshold || 0.12;
  CONFIG.lakeNoiseScale = levelDef.terrain.lakeNoiseScale || 0.008;
  
  if (levelDef.terrain.seasonSnowLines) {
    CONFIG.seasonSnowLines = levelDef.terrain.seasonSnowLines;
  } else {
    delete CONFIG.seasonSnowLines; // Use TerrainGenerator defaults
  }

  CONFIG.plantDensity = t.plantDensity;
  
  const e = levelDef.economy;
  CONFIG.startingMauri = e.startingMauri;
  CONFIG.seasonDuration = e.seasonDuration;
  CONFIG.eggIncubationTime = e.eggIncubationTime;
  CONFIG.securityTimeToLay = e.securityTimeToLay;
  CONFIG.securityTimeVariation = e.securityTimeVariation;
  CONFIG.layingHungerThreshold = e.layingHungerThreshold;
  CONFIG.eagleSpawnMilestones = [...e.eagleSpawnMilestones];
  CONFIG.maxMoaPopulation = e.maxPopulation;
  
  const c = levelDef.initialEntityCounts;
  CONFIG.initialMoaCount = c.moa;
  CONFIG.eagleCount = c.eagle;
  CONFIG.startingSpecies = levelDef.startingSpecies;
}

// ============================================
// COLOR UTILITIES 
// ============================================
function fillColor(colorArray, alphaOverride = null) {
  if (!colorArray) { fill(128); return; }
  const a = alphaOverride ?? colorArray[3];
  a !== undefined
    ? fill(colorArray[0], colorArray[1], colorArray[2], a)
    : fill(colorArray[0], colorArray[1], colorArray[2]);
}

function strokeColor(colorArray) {
  if (!colorArray) { stroke(128); return; }
  colorArray.length === 4
    ? stroke(colorArray[0], colorArray[1], colorArray[2], colorArray[3])
    : stroke(colorArray[0], colorArray[1], colorArray[2]);
}

// ============================================
// PRE-CACHED COLORS
// ============================================
const CACHED_COLORS = {};

function initCachedColors() {
  Object.assign(CACHED_COLORS, {
    placementValid: [100, 255, 100, 100],
    placementInvalid: [255, 100, 100, 100],
    placementValidStrong: [100, 255, 100, 200],
    placementInvalidStrong: [255, 100, 100, 200],
    spacingValid: [100, 200, 255, 60],
    spacingInvalid: [255, 150, 100, 80],
    blockerLine: [255, 100, 100, 150],
    blockerHighlight: [255, 100, 100, 200],
    floatingGreen: [100, 220, 100],
    menuBg: [25, 35, 30],
    menuTitle: [180, 220, 180],
    menuSubtitle: [140, 180, 140],
    menuText: [160, 180, 160],
    menuHint: [120, 150, 130],
    menuFooter: [100, 120, 100],
    btnNormal: [60, 120, 60],
    btnHover: [80, 140, 80],
    btnStroke: [100, 160, 100],
    notifSuccess: [60, 120, 60],
    notifSuccessText: [180, 255, 180],
    notifError: [120, 60, 60],
    notifErrorText: [255, 180, 180],
    notifInfo: [60, 80, 100],
    notifInfoText: [200, 220, 240],
    panelBg: CONFIG.col_panelBg,
    panelBorder: CONFIG.col_panelBorder,
    panelHeader: CONFIG.col_panelHeader,
    panelDivider: [50, 80, 60],
    sidebarBg: [30, 45, 35, 250],
  });
}

// ============================================
// GAME STATE
// ============================================
const GAME_STATE = {
  LEVEL_SELECT: 'level_select',
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
    seasonalBonus: { summer: 1.2, autumn: 0.8, winter: 0.5, spring: 1.0 },
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
    cost: 55,
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
  
  Storm: {
    name: "Storm",
    description: "Distracts hunting eagles",
    cost: 40,
    icon: '🌩️',
    color: '#c4a35a',
    effect: 'Storm',
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
  },

  lancewood: {
    name: "Lancewood Stand",
    description: "Tough browse the bush moa favour",
    cost: 30,
    icon: '🌲',
    color: '#6a7a3a',
    effect: 'feeding',
    radius: 40,
    duration: 2400,
    minSpacing: 30,
    ignoresSpacing: false,
    feedingRate: 0.15,
    baseFeedingRate: 0.15,
    plantSpawnCount: 4,
    plantType: 'lancewood',
    favouredSpecies: 'little_bush_moa',
    // Plantable in tussock region too, to help if bush moa wander too far upslope.
    allowedBiomes: ['forestRefuge', 'shrubland', 'subalpine', 'glacialFlats'],
    seasonalBonus: { summer: 1.0, autumn: 1.2, winter: 1.1, spring: 1.0 },
    attractsHungryMoa: true,
    attractionStrength: 1.4
  },

  speargrass: {
    name: "Speargrass Patch",
    description: "Spiny herb the upland moa favour",
    cost: 30,
    icon: '🌵',
    color: '#8f9a55',
    effect: 'feeding',
    radius: 40,
    duration: 2400,
    minSpacing: 30,
    ignoresSpacing: false,
    feedingRate: 0.15,
    baseFeedingRate: 0.15,
    plantSpawnCount: 4,
    plantType: 'speargrass',
    favouredSpecies: 'upland_moa',
    allowedBiomes: ['subalpine', 'shrubland', 'glacialFlats'],
    seasonalBonus: { summer: 1.2, autumn: 1.0, winter: 0.9, spring: 1.1 },
    attractsHungryMoa: true,
    attractionStrength: 1.4
  }
};

function initPlaceableColors() {
  for (const key in PLACEABLES) {
    PLACEABLES[key]._parsedColor = color(PLACEABLES[key].color);
  }
}

// ============================================
// BIOME DEFINITIONS
// ============================================
const BIOMES = {
  sea: {
    key: 'sea', name: "Sea", minElevation: 0, maxElevation: 0.1,
    colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#0f2533',
    walkable: false, canHavePlants: false, canPlace: false
  },
  coastal: {
    key: 'coastal', name: "Coastal/Beach", minElevation: 0.1, maxElevation: 0.15,
    colors: ['#c2b280', '#d4c794', '#e6dca8'], contourColor: '#8a7d5a',
    walkable: true, canHavePlants: false, canPlace: true
  },
  grassland: {
    key: 'grassland', name: "Lowland Grassland", minElevation: 0.15, maxElevation: 0.3,
    colors: ['#7fb069', '#8fbc79', '#9fc889'], contourColor: '#5a7d4a',
    walkable: true, canHavePlants: true, plantTypes: ['tussock', 'flax'], canPlace: true
  },
  podocarp: {
    key: 'podocarp', name: "Podocarp Forest", minElevation: 0.3, maxElevation: 0.4,
    colors: ['#2d5a3d', '#346644', '#3b724b'], contourColor: '#1e3d29',
    walkable: true, canHavePlants: true, plantTypes: ['fern', 'rimu'], canPlace: true
  },
  montane: {
    key: 'montane', name: "Montane Forest", minElevation: 0.4, maxElevation: 0.60,
    colors: ['#4a7c59', '#528764', '#5a926f'], contourColor: '#335740',
    walkable: true, canHavePlants: true, 
    plantTypes: ['beech', 'fern', 'patotara'],
    canPlace: true
  },
  subalpine: {
    key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.60, maxElevation: 0.80,
    colors: ['#a8a060', '#b5ad6d', '#c2ba7a'], contourColor: '#7a7445',
    walkable: true, canHavePlants: true, 
    plantTypes: ['tussock', 'patotara'],
    canPlace: true
  },
  alpine: {
    key: 'alpine', name: "Alpine Rock", minElevation: 0.77, maxElevation: 0.9,
    colors: ['#8b8b8b', '#9a9a9a', '#a9a9a9'], contourColor: '#5c5c5c',
    walkable: false, canHavePlants: false, canPlace: false
  },
  snow: {
    key: 'snow', name: "Permanent Snow", minElevation: 0.9, maxElevation: 1.0,
    colors: ['#e8e8e8', '#f0f0f0', '#ffffff'], contourColor: '#b0b0b0',
    walkable: false, canHavePlants: false, canPlace: false
  }
};

// ============================================
// PLANT DEFINITIONS
// ============================================
const PLANT_TYPES = {
  tussock: { name: "Tussock", nutrition: 25, color: '#8ea040', size: 24, growthTime: 200,
    description: "Hardy grass that covers the high country" },
  flax: { name: "Flax", nutrition: 35, color: '#487020', size: 26, growthTime: 280,
    description: "Harakeke: versatile, with sweet nectar" },
  fern: { name: "Fern", nutrition: 30, color: '#228B22', size: 36, growthTime: 240,
    description: "The iconic Ponga's fronds populate forests" },
  rimu: { name: "Rimu", nutrition: 50, color: '#8B0000', size: 48, growthTime: 400,
    description: "Ancient podocarp with bright red fruit" },
  beech: { name: "Beech", nutrition: 40, color: '#8b430f', size: 52, growthTime: 350,
    description: "Tawhai: produces mast seed in good years" },
  kawakawa: { name: "Kawakawa", nutrition: 40, color: '#3d9a5e', size: 22, growthTime: 150,
    description: "Heart-shaped leaves with peppery fruit" },
  patotara: { name: "Patotara", nutrition: 35, color: '#c94c5a', size: 28, growthTime: 160,
    description: "Alpine shrub with summer berries" },

  // --- Glacial-flora (LGM) additions. Procedural blob-rendered (no sprites yet). ---
  coprosma: { name: "Coprosma", nutrition: 30, color: '#5c7d3e', size: 22, growthTime: 190,
    description: "Divaricating shrub; hardy glacial browse with orange berries" },
  dracophyllum: { name: "Dracophyllum", nutrition: 28, color: '#9a7b4f', size: 30, growthTime: 250,
    description: "Inaka grass-tree of the cold subalpine tops" },
  matagouri: { name: "Matagouri", nutrition: 26, color: '#7a6f4a', size: 24, growthTime: 210,
    description: "Tūmatakuru: thorny shrub of the glacial outwash flats" },

  // --- Favoured, browse-resistant plants (planted via the palette) ---
  lancewood: { name: "Juvenile Lancewood", nutrition: 34, color: '#6a5a33', size: 30, growthTime: 300,
    description: "Horoeka: tough and spiky when growing." },
  speargrass: { name: "Speargrass", nutrition: 30, color: '#8f9a55', size: 26, growthTime: 260,
    description: "Taramea: spiny herb of the hills" }
};

// ============================================
// MAURI MANAGER
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

    // Scales the passive income you earn just for having moa (population-based
    // stream in Game.update). Halved so a large flock is worth less per second.
    this.passiveIncomeScale = 0.5;

    this.eatMauriThreshold = 50;
    this.floatingTexts = [];
    this.populationMilestones = [10, 15, 20, 25, 30, 40, 50];
    this.lastMilestone = 0;
    this.eagleSpawnedAt = new Set();
  }

  // Seed the milestone tracker to the starting population so milestones already
  // satisfied at level start (e.g. a level that opens with 16 moa clears the 10
  // and 15 marks) don't retroactively pay out — only genuine growth is rewarded.
  primeMilestones(startPop) {
    let m = 0;
    for (const t of this.populationMilestones) if (startPop >= t) m = t;
    this.lastMilestone = m;
  }
  
  earn(amount, x, y, reason) {
    this.mauri += amount;
    this.totalEarned += amount;
    
    if (x !== undefined && y !== undefined) {
      this.floatingTexts.push({
        text: `+${amount | 0}`,
        x, y,
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
    const mauriMilestones = this.populationMilestones;
    for (const m of mauriMilestones) {
      if (moaCount >= m && this.lastMilestone < m) {
        this.lastMilestone = m;
        this.earn(this.populationMilestoneBonus, CONFIG.width / 2 / CONFIG.zoom, 50, 'milestone');
        game.addNotification(`Population milestone: ${m} moa! +${this.populationMilestoneBonus} mauri`, 'success');
        if (audioManager) audioManager.playMoaMilestone();
      }
    }
    
    for (const threshold of CONFIG.eagleSpawnMilestones) {
      if (moaCount >= threshold && !this.eagleSpawnedAt.has(threshold)) {
        this.eagleSpawnedAt.add(threshold);
        simulation.spawnEagle();
        game.addNotification(`A new Haast's Eagle has arrived!`, 'error');
        if (game.tutorial) game.tutorial.fireEvent(TUTORIAL_EVENTS.EAGLE_SPAWNED);
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
      fill(100, 220, 100, (ft.life / ft.maxLife) * 255);
      text(ft.text, ft.x, ft.y);
    }
  }
}

// ============================================
// GAME MANAGER
// ============================================
class Game {
  constructor() {
    this.state = GAME_STATE.LEVEL_SELECT;

    // now we allow biome, placeable, species redef. per level
    this.currentLevel = null;
    this.activeBiomes = null;
    this.activePlaceables = null;
    this.activeSpecies = null;

    this.terrain = null;
    this.simulation = null;
    this.mauri = null;
    this.ui = null;
    this.seasonManager = null;
    this.tutorial = null;
    this.menuArt = new MenuArtManager();
    
    this.selectedPlaceable = null;
    this.placePreview = null;
    this._stormCooldownUntil = 0;
    
    this.playTime = 0;
    this.maxPlayTime = 0;
    this._menuBtnBounds = null;

    this.goals = [];
    this.phases = null;
    this._phaseIndex = -1;
    
    this.notifications = [];
    this.gameOverReason = '';
    
    this._cachedMoaCount = 0;
    this._cachedEggCount = 0;
    this._cachedThrivingCount = 0;
    this._tempVec = null;
    this._incomeAccumulator = 0;
  }

  loadLevel(levelId) {
    const rawDef = LEVEL_REGISTRY.get(levelId);
    if (!rawDef) {
      console.error(`Level not found: ${levelId}`);
      return;
    }

    const levelDef = resolveLevelDef(rawDef);
    this.currentLevel = levelDef;

    applyLevelToConfig(levelDef);

    this.activeBiomes = levelDef.biomes;
    this.activePlaceables = levelDef._resolvedPlaceables;
    this.activeSpecies = levelDef.species;

    // Phased levels build their goal list dynamically per phase; classic
    // levels use the static goals array exactly as before.
    if (levelDef.phases) {
      this.phases = levelDef.phases;
      this._phaseIndex = -1;
      this.goals = [];
    } else {
      this.phases = null;
      this.goals = (levelDef.goals || []).map(goalDef => ({
        name: goalDef.name,
        condition: () => goalDef.condition(this.simulation, this),
        reward: goalDef.reward,
        achieved: false
      }));
    }

    // NEW: Load illustration assets for this level's start screen
    this.menuArt.loadForLevel(levelDef);

    this.init();
  }
  
  init() {

    if (!this.currentLevel) return;

    this.terrain = new TerrainGenerator(CONFIG, this.activeBiomes);
    this.seasonManager = new SeasonManager(CONFIG);
    this.terrain.setSeasonManager(this.seasonManager);
    this.terrain.generate();
    this._updateViewTransform();
    
    this.simulation = new Simulation(
      this.terrain, CONFIG, this, this.seasonManager
    );
    this.simulation.setActiveSpecies(this.activeSpecies);
    this.simulation.init();
    
    this.mauri = new MauriManager(CONFIG.startingMauri);
    // Don't pay population milestones the starting flock already satisfies
    // (removes the ~+100 mauri jump when a level opens above the 10/15 marks).
    this.mauri.primeMilestones(this.simulation.getMoaPopulation());
    this.ui = new GameUI(CONFIG, this.terrain, this.simulation, this.mauri, this, this.seasonManager);
    
    this.playTime = 0;
    this._stormCooldownUntil = 0;   // reset per level load, else a restart starts mid-cooldown
    // Species highlights: reset, then enable by default for the level's focus
    // species (fall back to its vulnerable-highlight list if no focal list).
    SPECIES_HIGHLIGHT.clear();
    const _hlDefaults = LEVEL_MECHANICS.focalSpecies ||
      (LEVEL_MECHANICS.vulnerableHighlight ? Object.keys(LEVEL_MECHANICS.vulnerableHighlight) : []);
    for (const _k of _hlDefaults) SPECIES_HIGHLIGHT.add(_k);
    this.state = GAME_STATE.PLAYING;
    this._tempVec = createVector(0, 0);
    
    for (const goal of this.goals) goal.achieved = false;
    this._goalsCompleted = 0;
    this._goalsTotal = null;   // computed lazily for the end-of-level tally

    this.tutorial = new TutorialManager(this);
    this.tutorial.setGuideSprite(
      this._getGuideSprite(this.currentLevel.tutorial?.guideSprite)
    );
    if (this.currentLevel.tutorial?.tips){
      this.tutorial.setLevelTips(this.currentLevel.tutorial.tips);
    }
    if (BENCHMARK.pending) this.tutorial.enabled = false;   // benchmark runs clean
    this.tutorial.init();

    // Benchmark: start an armed run; a reload mid-run abandons the old one
    if (BENCHMARK.pending) BENCHMARK.start(this);
    else if (BENCHMARK.active) BENCHMARK.cancel();

    if (audioManager) audioManager.playBackground();
  }

  isInGameArea(mx, my) {
    if (CONFIG.fullscreen && this.terrain) {
      return mx >= CONFIG.viewX &&
             mx < CONFIG.viewX + this.terrain.mapWidth * CONFIG.viewZoom &&
             my >= CONFIG.viewY &&
             my < CONFIG.viewY + this.terrain.mapHeight * CONFIG.viewZoom;
    }
    return mx >= CONFIG.gameAreaX &&
           mx < CONFIG.gameAreaX + CONFIG.gameAreaWidth &&
           my >= CONFIG.gameAreaY &&
           my < CONFIG.gameAreaY + CONFIG.gameAreaHeight;
  }

  toggleFullscreen() {
    CONFIG.fullscreen = !CONFIG.fullscreen;
    this._updateViewTransform();
  }

  // Recomputes the active render transform. Normal mode: the classic
  // game-area placement. Fullscreen: the map scaled to the largest size that
  // fits the whole canvas, centred, with the HUD drawn as an overlay.
  _updateViewTransform() {
    if (CONFIG.fullscreen && this.terrain) {
      const z = Math.min(CONFIG.canvasWidth / this.terrain.mapWidth,
                         CONFIG.canvasHeight / this.terrain.mapHeight);
      CONFIG.viewZoom = z;
      CONFIG.viewX = Math.round((CONFIG.canvasWidth - this.terrain.mapWidth * z) / 2);
      CONFIG.viewY = Math.round((CONFIG.canvasHeight - this.terrain.mapHeight * z) / 2);
    } else {
      CONFIG.viewZoom = CONFIG.zoom;
      CONFIG.viewX = CONFIG.gameAreaX;
      CONFIG.viewY = CONFIG.gameAreaY;
    }
  }
  
  updateCachedCounts() {
    const moas = this.simulation.moas;
    let moaCount = 0, thrivingCount = 0;
    
    for (let i = 0; i < moas.length; i++) {
      if (moas[i].alive) {
        moaCount++;
        if (moas[i].hunger < 20) thrivingCount++;
      }
    }
    
    let eggCount = 0;
    const eggs = this.simulation.eggs;
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
  
  update(dt = 1) {
    if (this.state !== GAME_STATE.PLAYING && this.state !== GAME_STATE.PAUSED) return;
      
    if (this.tutorial) this.tutorial.update(dt);
    if (this.state !== GAME_STATE.PLAYING) return;
    
    this.playTime += dt;
    if (this.playTime > this.maxPlayTime) this.maxPlayTime = this.playTime;
    
    if (this.seasonManager.update(dt)) this.onSeasonChange();
    
    this.simulation.update(this.mauri, dt);
    this.updateCachedCounts();
    if (BENCHMARK.active) BENCHMARK.update(this);
    
    // Passive mauri income, with smooth diminishing returns at higher populations.
    // The "effective" earning population tapers above tStart: each extra moa is
    // worth a little less, so by population 25 income is worth ~15 moa at the base
    // rate, flattening beyond (discourages hoarding a huge flock).
    this._incomeAccumulator += dt;
    if (this._incomeAccumulator >= 64) {
      this._incomeAccumulator -= 64;
      const pop = this._cachedMoaCount;
      let income = (pop * this.mauri.perMoaPerSecond +
                    this._cachedThrivingCount * this.mauri.onMoaThriving)
                   * this.mauri.passiveIncomeScale;   // halved: mauri for having moa
      const tStart = 10, tScale = 5.3;   // asymptote ≈ tStart+tScale; tuned so pop 25 → ~15
      if (pop > tStart && income > 0) {
        const effPop = tStart + tScale * (1 - Math.exp(-(pop - tStart) / tScale));
        income *= effPop / pop;   // scale the whole passive income by the taper
      }
      if (income > 0) this.mauri.earn(income, undefined, undefined, 'passive');
    }
    
    this.checkGoals();
    this.mauri.checkMilestones(this._cachedMoaCount, this.simulation, this);
    
    if (this._cachedMoaCount === 0 && this._cachedEggCount === 0) {
      this.state = GAME_STATE.LOST;
      this.gameOverReason = "All moa here were hunted...";
      if (audioManager) audioManager.playLoss();
    }

    // Eagle extinction (emergent-eagle levels): the apex predator dying out is a
    // loss. A grace period holds while an eagle egg is still incubating.
    if (this.state === GAME_STATE.PLAYING &&
        typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.emergentEagles &&
        this.simulation.countAliveEagles() === 0) {
      let eagleEggs = 0;
      const eggs = this.simulation.eggs;
      for (let i = 0; i < eggs.length; i++) {
        if (eggs[i].alive && !eggs[i].hatched && eggs[i].offspringType === 'eagle') { eagleEggs++; break; }
      }
      if (eagleEggs === 0) {
        this.state = GAME_STATE.LOST;
        this.gameOverReason = "The Pouākai vanished from these ranges — an ecosystem loses its apex predator.";
        if (audioManager) audioManager.playLoss();
      }
    }
    
    this.mauri.updateFloatingTexts(dt);
    this.updateNotifications(dt);
  }

  updateNotifications(dt = 1) {
    const notifs = this.notifications;
    for (let i = notifs.length - 1; i >= 0; i--) {
      notifs[i].life -= dt;
      if (notifs[i].life <= 0) notifs.splice(i, 1);
    }
  }
  
  // Snapshot passed to the (per-level tunable) score formula. See
  // computeLevelScore / defaultLevelScore in mauri_level_format.js.
  _scoreContext() {
    return {
      moaCount: this._cachedMoaCount,
      totalEarned: this.mauri.totalEarned,
      playTime: this.playTime,
      goalsCompleted: this._goalsCompleted || 0,
      level: this.currentLevel
    };
  }

  checkGoals() {
    if (this.phases) { this._checkPhases(); return; }
    const goals = this.goals;
    const halfWidth = CONFIG.width / 2 / CONFIG.zoom;
    let allAchieved = true;
    
    for (const goal of goals) {
      if (!goal.achieved && goal.condition()) {
        goal.achieved = true;
        this._goalsCompleted = (this._goalsCompleted || 0) + 1;
        this.mauri.earn(goal.reward, halfWidth, 80, 'goal');
        this.addNotification(`Goal achieved: ${goal.name}! +${goal.reward} mauri`, 'success');
      }
      if (!goal.achieved) allAchieved = false;
    }
    
    if (allAchieved) {
      this.state = GAME_STATE.WON;
      if (audioManager) audioManager.playWin();

      const score = computeLevelScore(this.currentLevel, this._scoreContext());
      PROGRESS.completeLevel(this.currentLevel.id, score);
    }
  }

  _buildPhaseGoals(idx) {
    const ph = this.phases[idx] || { goals: [] };
    const fresh = (ph.goals || []).map(g => ({
      name: g.name,
      condition: g.condition ? (() => g.condition(this.simulation, this)) : (() => false),
      reward: g.reward || 0,
      survive: !!g.survive,
      achieved: false
    }));
    // Persist the previous spring/summer growth goals into this phase when it is a
    // survival (autumn/winter) phase, so those achievements don't vanish the moment
    // autumn arrives. They keep their achieved state (and an unmet one can still be
    // finished during autumn); they're cleared again when the next growth phase begins.
    const isSurvivePhase = fresh.some(g => g.survive);
    let carried = [];
    if (isSurvivePhase && idx > 0 && Array.isArray(this.goals)) {
      carried = this.goals.filter(g => !g.survive);
    }
    this.goals = carried.concat(fresh);
  }

  _checkPhases() {
    const phaseDur = 2 * CONFIG.seasonDuration;
    const total = this.phases.length * phaseDur;
    const halfWidth = CONFIG.width / 2 / CONFIG.zoom;
    const idx = Math.min(Math.floor(this.playTime / phaseDur), this.phases.length - 1);

    // Entering a new phase
    if (idx !== this._phaseIndex) {
      // Completing a survival phase means you endured it — mark its goals met.
      if (this._phaseIndex >= 0) {
        for (const g of this.goals) {
          if (g.survive && !g.achieved) {
            g.achieved = true;
            this._goalsCompleted = (this._goalsCompleted || 0) + 1;
            if (g.reward) this.mauri.earn(g.reward, halfWidth, 80, 'goal');
            this.addNotification(`Endured: ${g.name}! +${g.reward} mauri`, 'success');
          }
        }
      }
      this._phaseIndex = idx;
      this._buildPhaseGoals(idx);
      this.addNotification(`Phase ${idx + 1}: ${this.phases[idx].name}`, 'success');
    }

    // Growth objectives reward the moment they are met (soft — no penalty if missed)
    for (const goal of this.goals) {
      if (!goal.survive && !goal.achieved && goal.condition()) {
        goal.achieved = true;
        this._goalsCompleted = (this._goalsCompleted || 0) + 1;
        if (goal.reward) this.mauri.earn(goal.reward, halfWidth, 80, 'goal');
        this.addNotification(`Objective met: ${goal.name}! +${goal.reward} mauri`, 'success');
      }
    }

    // Phase fail condition (e.g. a focal population going extinct in winter)
    const ph = this.phases[idx];
    if (ph.fail && ph.fail(this.simulation, this)) {
      this.state = GAME_STATE.LOST;
      this.gameOverReason = ph.failReason || "A population you were protecting died out.";
      if (audioManager) audioManager.playLoss();
      return;
    }

    // Win: survived to the end of the final phase
    if (this.playTime >= total) {
      for (const g of this.goals) { if (!g.achieved) { g.achieved = true; this._goalsCompleted = (this._goalsCompleted || 0) + 1; } }
      this.state = GAME_STATE.WON;
      if (audioManager) audioManager.playWin();
      const score = computeLevelScore(this.currentLevel, this._scoreContext());
      PROGRESS.completeLevel(this.currentLevel.id, score);
    }
  }
  
  addNotification(text, type = 'info') {
    this.notifications.push({
      text, type,
      life: 600,
      maxLife: 600,
      time: this.playTime,
      _cachedWidth: null
    });
    if (this.notifications.length > 8) this.notifications.shift();
  }
  
  onSeasonChange() {
    const season = this.seasonManager.current;
    const seasonKey = this.seasonManager.currentKey;

    this.addNotification(`Season changed to ${season.name} ${season.icon}`, 'info');
    if (audioManager) audioManager.playSeasonChange(seasonKey);

    // Glacial predation: winter drives an extra hungry eagle to hunt.
    if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.winterPredation && seasonKey === 'winter') {
      this.simulation.spawnEagle();
      this.addNotification("The glacial winter drives a hungry eagle to hunt.", 'error');
    }
    if (this.tutorial) {
      this.tutorial.fireEvent(TUTORIAL_EVENTS.SEASON_CHANGE, { season, seasonKey });
    }
    
    const aliveMoas = this.simulation.moas.filter(m => m.alive);
    const migrationMessages = this.seasonManager.getMigrationMessages(aliveMoas);
    
    if (migrationMessages.current) {
      setTimeout(() => this.addNotification(migrationMessages.current, 'info'), 500);
    }
    if (migrationMessages.upcoming) {
      setTimeout(() => this.addNotification(migrationMessages.upcoming, 'info'), 2000);
    }
  }
  
  selectPlaceable(type) {
    // Check against level's active placeables, not global PLACEABLES
    const def = this.activePlaceables[type];
    if (def && this.mauri.canAfford(def.cost)) {
      this.selectedPlaceable = type;
    } else if (!def) {
      this.addNotification("Not available in this area!", 'error');
    } else {
      this.addNotification("Not enough mauri!", 'error');
    }
  }
  
  cancelPlacement() {
    this.selectedPlaceable = null;
  }
  
  canPlaceWithSpacing(x, y, type) {
    const def = this.activePlaceables[type];
    if (def.ignoresSpacing) return { allowed: true };
    
    const mySpacing = def.minSpacing || 40;
    this._tempVec.set(x, y);
    
    for (const p of this.simulation.placeables) {
      if (!p.alive) continue;
      const otherDef = PLACEABLES[p.type];
      if (otherDef.ignoresSpacing) continue;
      
      const requiredDist = (mySpacing + (otherDef.minSpacing || 40)) * 0.5;
      const dist = p5.Vector.dist(this._tempVec, p.pos);
      
      if (dist < requiredDist) {
        return { 
          allowed: false, 
          reason: `Too close to ${otherDef.name}`,
          blocker: p,
          requiredDist,
          actualDist: dist
        };
      }
    }
    
    return { allowed: true };
  }
    
  tryPlace(x, y) {
    if (!this.selectedPlaceable) return false;
    
    const def = this.activePlaceables[this.selectedPlaceable];
    if (!def) return false;

    if (this.selectedPlaceable === 'Storm' && this.playTime < this._stormCooldownUntil) {
      const secs = Math.ceil((this._stormCooldownUntil - this.playTime) / 60);
      this.addNotification(`Storm is recharging (${secs}s)`, 'error');
      return false;
    }
    
    if (!this.terrain.canPlace(x, y)) {
      this.addNotification("Cannot place here!", 'error');
      return false;
    }

    if (def.allowedBiomes) {
      const biome = this.terrain.getBiomeAt(x, y);
      if (!def.allowedBiomes.includes(biome.key)) {
        this.addNotification(`${def.name} can't take root in ${biome.name}`, 'error');
        return false;
      }
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
    BENCHMARK.recordPlacement(this.selectedPlaceable);
    if (this.selectedPlaceable === 'Storm') this._stormCooldownUntil = this.playTime + 600; // 10s @60fps
    this.addNotification(`Placed ${def.name}`, 'info');
    
    if (audioManager) {
      this.selectedPlaceable === 'Storm' ? audioManager.playBoltStrike() : audioManager.playPlantRustle();
    }
    
    if (!keyIsDown(SHIFT)) this.selectedPlaceable = null;
    return true;
  }
  
  render() {
    background(20, 30, 25);

    if (this.state === GAME_STATE.LEVEL_SELECT){
      this.renderLevelSelect();
      return;
    }
    
    if (this.state === GAME_STATE.MENU) {
      this.renderMenu();
      return;
    }
    
    if (!CONFIG.fullscreen) this.ui.renderPanels();

    push();
    drawingContext.save();
    drawingContext.beginPath();
    const _clipW = CONFIG.fullscreen ? this.terrain.mapWidth * CONFIG.viewZoom : CONFIG.gameAreaWidth;
    const _clipH = CONFIG.fullscreen ? this.terrain.mapHeight * CONFIG.viewZoom : CONFIG.gameAreaHeight;
    drawingContext.rect(CONFIG.viewX, CONFIG.viewY, _clipW, _clipH);
    drawingContext.clip();

    translate(CONFIG.viewX, CONFIG.viewY);
    scale(CONFIG.viewZoom);
    
    this.terrain.render();

    // Winter frost: a single cool haze laid over the ground (under the animals),
    // fading in through late autumn and out into spring. One rect — no perf cost.
    const _frost = this.seasonManager.getWinterness ? this.seasonManager.getWinterness() : 0;
    if (_frost > 0.001) {
      push();
      noStroke();
      rectMode(CORNER);
      fill(216, 232, 245, 72 * _frost);
      rect(0, 0, this.terrain.mapWidth, this.terrain.mapHeight);
      pop();
    }

    this.simulation.render();
    this.mauri.renderFloatingTexts();
    
    if (this.selectedPlaceable &&
        (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED)) {
      this.renderPlacementPreview();
    }
    
    drawingContext.restore();
    pop();

    // Benchmark: the run ends with the level (update() no longer ticks in
    // WON/LOST states, so the final sample + CSV save happens here)
    if (BENCHMARK.active && !BENCHMARK.finished &&
        (this.state === GAME_STATE.WON || this.state === GAME_STATE.LOST)) {
      BENCHMARK.finish(this, this.state === GAME_STATE.WON ? 'win' : 'loss');
    }

    if (this.state === GAME_STATE.PAUSED) {
      this._renderOverlay(...CONFIG.col_UI.slice(0,3), 100, {
        title: "PAUSED",
        titleColor: [255, 255, 255],
        lines: [
          { text: "Press P or SPACE to resume", color: [180, 200, 180], size: 16 },
          { text: "Press R to restart", color: [150, 170, 150], size: 14 }
        ],
        boxColor: [30, 45, 35, 240],
        strokeColor: [70, 110, 80]
      });
    } else if (this.state === GAME_STATE.WON) {
      this._renderOverlay(...CONFIG.col_UI.slice(0,3), 150, {
        title: "ECOSYSTEM THRIVING!",
        titleColor: [180, 255, 180],
        lines: [
          { text: "All goals achieved!", color: [150, 220, 150], size: 18 },
          { text: this._goalsTally(), color: [150, 220, 150], size: 14 },
          { text: `Final population: ${this._cachedMoaCount} moa`, color: [120, 180, 120], size: 14 },
          { text: `Total mauri earned: ${this.mauri.totalEarned | 0}`, color: [120, 180, 120], size: 14 },
          { text: `Time elapsed: ${(this.playTime / 60) | 0} seconds`, color: [120, 180, 120], size: 14 },
          { text: `Final Score: ${computeLevelScore(this.currentLevel, this._scoreContext())} points`, color: [200, 240, 200], size: 16 },
          { text: "", color: [200, 240, 200], size: 18 },
          { text: "Press R to play again", color: [200, 240, 200], size: 18 }
        ],
        boxColor: [30, 60, 40, 250],
        strokeColor: [100, 180, 120]
      });
    } else if (this.state === GAME_STATE.LOST) {
      this._renderOverlay(80, 30, 30, 150, {
        title: "EXTINCTION",
        titleColor: [255, 180, 180],
        lines: [
          { text: this.gameOverReason, color: [220, 150, 150], size: 16 },
          { text: this._goalsTally(), color: [200, 180, 140], size: 14 },
          { text: `Time survived: ${(this.playTime / 60) | 0} seconds`, color: [180, 120, 120], size: 14 },
          { text: `Moa hatched: ${this.simulation.stats.births}`, color: [180, 120, 120], size: 14 },
          { text: `Total mauri earned: ${this.mauri.totalEarned | 0}`, color: [180, 120, 120], size: 14 },
          { text: "", color: [200, 240, 200], size: 18 },
          { text: "Press R to try again", color: [220, 180, 180], size: 18 }
        ],
        boxColor: [60, 35, 35, 250],
        strokeColor: [150, 100, 100]
      });
    }

    // HUD drawn after the paused/won/lost overlay so its panels and buttons
    // stay bright and readable above the tint.
    if (CONFIG.fullscreen) this.ui.renderFullscreenOverlay();
    else this.ui.render();

    if (this.tutorial) {
      this.tutorial.render();
      // Tips flagged ringsAboveUI (e.g. "Say hello to the new Moa!") re-draw
      // the vulnerable-founder rings above the tutorial overlay so the player
      // can spot the highlighted moa while the tip is up.
      if (this.tutorial.active && this.tutorial.currentTip &&
          this.tutorial.currentTip.ringsAboveUI) {
        this.renderVulnerableRingsAboveUI();
      }
    }
  }

  // Re-draws the pulsing red low-population rings in world space, above the
  // tutorial overlay (same clip + view transform as the main game-area pass).
  renderVulnerableRingsAboveUI() {
    push();
    drawingContext.save();
    drawingContext.beginPath();
    const _clipW = CONFIG.fullscreen ? this.terrain.mapWidth * CONFIG.viewZoom : CONFIG.gameAreaWidth;
    const _clipH = CONFIG.fullscreen ? this.terrain.mapHeight * CONFIG.viewZoom : CONFIG.gameAreaHeight;
    drawingContext.rect(CONFIG.viewX, CONFIG.viewY, _clipW, _clipH);
    drawingContext.clip();
    translate(CONFIG.viewX, CONFIG.viewY);
    scale(CONFIG.viewZoom);

    const moas = this.simulation.moas;
    for (let i = 0; i < moas.length; i++) {
      const m = moas[i];
      if (!m.alive || !m._vhl) continue;
      // Refresh the flag here: moa updates don't run while the tip has the
      // game paused, so a moa spawned just before the tip (e.g. the bush moa
      // founders) would otherwise still have its spawn-time value (false).
      m._highlightActive =
        this.simulation.getCachedSpeciesCount(m.speciesKey) < m._vhl.until;
      m.renderLowPopRing();
    }

    drawingContext.restore();
    pop();
  }

  _getGuideSprite(spriteKey){
    const spriteMap = {
      'mantis_talk': tutorialMantisSprite
      //add others here
    };
    return spriteMap[spriteKey] || tutorialMantisSprite;
  }

  // "Goals completed: X / Y" for the end screen. Total spans every phase's
  // objectives (for phased levels) or the classic goal list; completed is the
  // cumulative count tracked as objectives are met.
  _goalsTally() {
    if (this._goalsTotal == null) {
      this._goalsTotal = this.phases
        ? this.phases.reduce((n, ph) => n + ((ph.goals && ph.goals.length) || 0), 0)
        : (this.goals ? this.goals.length : 0);
    }
    return `Goals completed: ${this._goalsCompleted || 0} / ${this._goalsTotal}`;
  }

  // Unified overlay renderer (replaces renderPauseOverlay, renderWinOverlay, renderLoseOverlay)
  _renderOverlay(r, g, b, a, opts) {
    const cw = CONFIG.fullscreen ? CONFIG.canvasWidth : CONFIG.gameAreaWidth;
    const ch = CONFIG.fullscreen ? CONFIG.canvasHeight : CONFIG.gameAreaHeight;
    const cy = CONFIG.fullscreen ? 0 : CONFIG.gameAreaY;
    const centerX = cw * 0.5;
    const centerY = ch * 0.5;
    
    // Tinted background
    fill(r, g, b, a);
    noStroke();
    rect(0, cy, cw, ch);
    
    // Box
    const boxH = 60 + opts.lines.length * 40;
    const boxW = Math.max(300, 400);
    
    push();
    translate(0, cy);
    fill(...opts.boxColor);
    stroke(...opts.strokeColor);
    strokeWeight(opts.strokeColor ? 3 : 2);
    rect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, 15);
    
    noStroke();
    textAlign(CENTER, CENTER);
    
    // Title
    fill(...opts.titleColor);
    textSize(42);
    push();
    textFont(GroceryRounded);
    const titleY = centerY - boxH / 2 + 40;
    text(opts.title, centerX, titleY);
    pop();
    
    // Lines
    let lineY = titleY + 50;
    for (const line of opts.lines) {
      fill(...line.color);
      textSize(line.size);
      text(line.text, centerX, lineY);
      lineY += line.size + 10;
    }
    
    pop();
  }

    renderLevelSelect() {
    const cw = CONFIG.canvasWidth;
    const ch = CONFIG.canvasHeight;
    const centerX = cw * 0.5;

    fill(CACHED_COLORS.menuBg);
    noStroke();
    rect(0, 0, cw, ch);

    textAlign(CENTER, CENTER);
    fill(CACHED_COLORS.menuTitle);
    textSize(52);
    push(); textFont(GroceryRounded);
    text("Avian Age: Select Area", centerX, 100);
    pop();

    fill(CACHED_COLORS.menuSubtitle);
    textSize(18);
    text("Choose an ecosystem to protect", centerX, 150);

    // Responsive card layout
    const levels = LEVEL_REGISTRY.getAll();
    const maxCardW = 320;
    const minCardW = 200;
    const cardH = 200;
    const cardSpacing = 40;
    const availableW = cw - 120;  // 60px padding each side

    // Calculate card width that fits all cards
    let cardW = maxCardW;
    let totalW = levels.length * cardW + (levels.length - 1) * cardSpacing;
    if (totalW > availableW && levels.length > 1) {
      cardW = Math.max(minCardW,
        (availableW - (levels.length - 1) * cardSpacing) / levels.length
      );
      totalW = levels.length * cardW + (levels.length - 1) * cardSpacing;
    }

    const startX = centerX - totalW / 2;
    const cardY = ch / 2 - cardH / 2;

    this._levelCardBounds = [];

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const x = startX + i * (cardW + cardSpacing);
      const unlocked = PROGRESS.isUnlocked(level.id);
      const completed = PROGRESS.isCompleted(level.id);
      const hover = unlocked && mouseX > x && mouseX < x + cardW
                             && mouseY > cardY && mouseY < cardY + cardH;

      // Card background
      if (!unlocked) {
        fill(30, 30, 35, 200);
        stroke(50, 50, 55);
      } else if (hover) {
        fill(40, 65, 45, 240);
        stroke(100, 160, 110);
      } else {
        fill(30, 50, 35, 240);
        stroke(70, 110, 80);
      }
      strokeWeight(completed ? 3 : 2);
      rect(x, cardY, cardW, cardH, 12);

      // Completion badge
      if (completed) {
        fill(80, 180, 100);
        noStroke();
        ellipse(x + cardW - 20, cardY + 20, 24, 24);
        fill(255);
        textSize(14);
        text("✓", x + cardW - 20, cardY + 20);
      }

      // Level name
      fill(unlocked ? [200, 240, 210] : [80, 80, 85]);
      textSize(22);
      push(); textFont(GroceryRounded);
      text(level.name, x + cardW / 2, cardY + 40);
      pop();

      // Region
      fill(unlocked ? [140, 180, 150] : [60, 60, 65]);
      textSize(14);
      text(level.menu?.areaLabel || '', x + cardW / 2, cardY + 70);

      // Description preview
      fill(unlocked ? [120, 160, 130] : [50, 50, 55]);
      textSize(12);
      const desc = (level.menu?.flavorText || []).slice(0, 2);
      for (let j = 0; j < desc.length; j++) {
        text(desc[j], x + cardW / 2, cardY + 100 + j * 18);
      }

      // Lock icon
      if (!unlocked) {
        fill(100, 100, 110);
        textSize(32);
        text("🔒", x + cardW / 2, cardY + 160);
      }

      // Best score
      if (PROGRESS.bestScores[level.id]) {
        fill(180, 200, 180);
        textSize(12);
        text(`Best: ${PROGRESS.bestScores[level.id]} pts`,
             x + cardW / 2, cardY + cardH - 20);
      }

      this._levelCardBounds.push({
        x, y: cardY, w: cardW, h: cardH,
        levelId: level.id, unlocked
      });
    }

    fill(CACHED_COLORS.menuFooter);
    textSize(11);
    text(`Version: ${CONFIG.version}`, centerX, ch - 40);
  }
  
    renderMenu() {
    const cw = CONFIG.canvasWidth;
    const ch = CONFIG.canvasHeight;
    const centerX = cw * 0.5;
    const centerY = ch * 0.5;
    const menu = this.currentLevel.menu;

    // NEW: Render illustration layers (or plain background if no art)
    // This replaces the old manual background fill + vignette
    this.menuArt.render(cw, ch);

    textAlign(CENTER, CENTER);

    // Title — from level def
    fill(CACHED_COLORS.menuTitle);
    textSize(64);
    push(); textFont(GroceryRounded);
    text(menu.title || "Avian Age", centerX, centerY - 300);
    pop();

    fill(CACHED_COLORS.menuSubtitle);
    textSize(20);
    text(menu.subtitle || "A New Zealand Ecosystem Strategy Game",
         centerX, centerY - 240);

    // Plants — from level def (responsive spacing)
    const displayPlants = menu.displayPlants || [];
    const plantY = centerY - 80;
    const spriteSize = 64;

    // Calculate plant spacing that adapts to canvas width
    const maxPlantAreaWidth = cw - 200;  // padding on each side
    const plantCount = displayPlants.length - 1; // minus featured species in center
    const baseSpacing = 180;
    const plantSpacing = Math.min(baseSpacing, maxPlantAreaWidth / (plantCount + 2));

    const midpoint = Math.ceil(displayPlants.length / 2);
    const leftPlants = displayPlants.slice(0, midpoint - 1);
    const rightPlants = displayPlants.slice(midpoint);

    for (let i = 0; i < leftPlants.length; i++) {
      this._renderMenuPlant(
        centerX - 250 - (leftPlants.length - 1 - i) * plantSpacing,
        plantY, leftPlants[i], spriteSize
      );
    }
    for (let i = 0; i < rightPlants.length; i++) {
      this._renderMenuPlant(
        centerX + 250 + i * plantSpacing,
        plantY, rightPlants[i], spriteSize
      );
    }

    // Featured species — from level def
    const featured = menu.featuredSpecies;
    if (featured) {
      push();
      imageMode(CENTER);
      translate(centerX, plantY);
      scale(featured.spriteScale || 2);
      const sprite = this._getMenuSprite(featured.spriteKey);
      if (featured.tint) tint(featured.tint[0], featured.tint[1], featured.tint[2]);
      if (sprite) image(sprite, 0, 0);
      pop();

      fill(CACHED_COLORS.menuSubtitle);
      textSize(16);
      textStyle(BOLD);
      text(featured.displayName, centerX, plantY + 80);
      textStyle(NORMAL);
      fill(CACHED_COLORS.menuText);
      textSize(14);
      text(featured.localName || '', centerX, plantY + 98);
    }

    // Flavor text — from level def
    fill(CACHED_COLORS.menuText);
    textSize(16);
    const flavorLines = [
      menu.areaLabel || '',
      menu.areaSubtitle || '',
      ' ',
      ...(menu.flavorText || [])
    ];

    const instructionsY = centerY + 60;
    for (let i = 0; i < flavorLines.length; i++) {
      text(flavorLines[i], centerX, instructionsY + i * 22);
    }

    // Start button
    const btnW = 200, btnH = 60;
    const btnX = centerX - btnW / 2;
    const btnY = centerY + 230;
    const hover = mouseX > btnX && mouseX < btnX + btnW
               && mouseY > btnY && mouseY < btnY + btnH;

    fill(0, 0, 0, 30);
    noStroke();
    rect(btnX + 3, btnY + 3, btnW, btnH, 12);

    fill(hover ? CACHED_COLORS.btnHover : CACHED_COLORS.btnNormal);
    stroke(CACHED_COLORS.btnStroke);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 12);

    fill(255);
    noStroke();
    textSize(28);
    push(); textFont(GroceryRounded);
    text("Start Level", centerX, btnY + btnH * 0.5);
    pop();

    // Back button
    const backW = 120, backH = 40;
    const backX = centerX - backW / 2;
    const backY = btnY + btnH + 20;
    const backHover = mouseX > backX && mouseX < backX + backW
                   && mouseY > backY && mouseY < backY + backH;

    fill(backHover ? [60, 60, 70] : [40, 40, 50]);
    stroke(80, 80, 90);
    strokeWeight(1);
    rect(backX, backY, backW, backH, 8);

    fill(160, 170, 160);
    noStroke();
    textSize(14);
    text("← Back", centerX, backY + backH * 0.5);

    // Debug-only: benchmark run (starts the level tutorial-free and logs
    // populations + placements to a CSV every 10s and on win/loss)
    this._benchBtnBounds = null;
    if (CONFIG.debugMode) {
      const bw = 210, bh = 44;
      const bx = centerX + btnW / 2 + 30;
      const by = btnY + (btnH - bh) / 2;
      const bHover = mouseX > bx && mouseX < bx + bw && mouseY > by && mouseY < by + bh;

      fill(bHover ? 70 : 50, bHover ? 60 : 45, bHover ? 95 : 70);
      stroke(120, 110, 160);
      strokeWeight(1);
      rect(bx, by, bw, bh, 8);

      fill(205, 195, 235);
      noStroke();
      textSize(15);
      text("📊 Benchmark Run", bx + bw / 2, by + bh / 2);
      fill(140, 132, 172);
      textSize(10);
      text("no tutorial · 10s samples · CSV", bx + bw / 2, by + bh + 12);

      this._benchBtnBounds = { x: bx, y: by, w: bw, h: bh };

      // ×5 batch: five unattended runs back-to-back
      const b5y = by + bh + 26;
      const b5h = 34;
      const b5Hover = mouseX > bx && mouseX < bx + bw && mouseY > b5y && mouseY < b5y + b5h;
      fill(b5Hover ? 70 : 50, b5Hover ? 60 : 45, b5Hover ? 95 : 70);
      stroke(120, 110, 160);
      strokeWeight(1);
      rect(bx, b5y, bw, b5h, 8);
      fill(205, 195, 235);
      noStroke();
      textSize(14);
      text("📊 Benchmark ×5", bx + bw / 2, b5y + b5h / 2);
      this._bench5BtnBounds = { x: bx, y: b5y, w: bw, h: b5h };
    }

    fill(CACHED_COLORS.menuFooter);
    textSize(11);
    text(`Version: ${CONFIG.version}`, centerX, ch - 40);

    this._menuBtnBounds = { x: btnX, y: btnY, w: btnW, h: btnH };
    this._backBtnBounds = { x: backX, y: backY, w: backW, h: backH };
  }
  
  _getMenuSprite(spriteKey) {
    const map = {
      'moa_idle': splashScreenMoa,
      'LB_moa_walk_01': EntitySprites.moaVariants?.bush?.walk?.[0],
      // Add more as you create them
    };
    return map[spriteKey] || splashScreenMoa;
  }

  _renderMenuPlant(x, y, plantKey, size) {
    const plantDef = PLANT_TYPES[plantKey];
    const sprite = plantSprites[plantKey]?.mature;
    
    push();
    
    if (sprite) {
      imageMode(CENTER);
      image(sprite, x, y, size, size);
    } else if (plantKey === 'kawakawa') {
      this._renderMenuKawakawa(x, y, size);
    } else {
      const c = color(plantDef.color);
      const displaySize = size * 0.7;
      noStroke();
      fill(red(c), green(c), blue(c), 220);
      ellipse(x, y, displaySize, displaySize * 0.9);
      fill(red(c) + 40, green(c) + 40, blue(c) + 30, 150);
      ellipse(x - displaySize * 0.15, y - displaySize * 0.15, displaySize * 0.4, displaySize * 0.35);
    }
    
    // Label
    fill(CACHED_COLORS.menuSubtitle);
    textSize(16);
    textStyle(BOLD);
    textAlign(CENTER, CENTER);
    text(plantDef.name, x, y + size * 0.8);
    textStyle(NORMAL);
    fill(CACHED_COLORS.menuText);
    textSize(12);
    
    this._renderWrappedText(plantDef.description || "", x, y + size * 0.8 + 16, 140);
    pop();
  }

  // Extracted word-wrap helper (was inline in _renderMenuPlant)
  _renderWrappedText(desc, x, y, maxWidth) {
    if (textWidth(desc) <= maxWidth) {
      text(desc, x, y);
      return;
    }
    const words = desc.split(' ');
    let line1 = '', line2 = '', onLine1 = true;
    
    for (const word of words) {
      if (onLine1) {
        const test = line1 + (line1 ? ' ' : '') + word;
        if (textWidth(test) > maxWidth) {
          onLine1 = false;
          line2 = word;
        } else {
          line1 = test;
        }
      } else {
        line2 += (line2 ? ' ' : '') + word;
      }
    }
    text(line1, x, y);
    text(line2, x, y + 14);
  }

  _renderMenuKawakawa(x, y, size) {
    const leafSize = size * 0.25;
    const stemLen = size * 0.15;
    
    push();
    translate(x, y);
    
    for (let i = 0; i < 5; i++) {
      push();
      rotate(i * TWO_PI / 5 + 0.2);
      
      stroke(75, 110, 50);
      strokeWeight(2);
      line(0, 0, stemLen + leafSize * 0.5, 0);
      
      translate(stemLen + leafSize * 0.8, 0);
      rotate(HALF_PI);
      
      fill(85, 155, 55);
      stroke(60, 120, 45);
      strokeWeight(1);
      
      const lw = leafSize * 0.5;
      const lh = leafSize * 0.6;
      beginShape();
      vertex(0, -lh * 0.5);
      bezierVertex(-lw * 0.3, -lh * 0.5, -lw * 0.5, -lh * 0.2, -lw * 0.5, 0);
      bezierVertex(-lw * 0.5, lh * 0.3, -lw * 0.2, lh * 0.4, 0, lh * 0.5);
      bezierVertex(lw * 0.2, lh * 0.4, lw * 0.5, lh * 0.3, lw * 0.5, 0);
      bezierVertex(lw * 0.5, -lh * 0.2, lw * 0.3, -lh * 0.5, 0, -lh * 0.5);
      endShape(CLOSE);
      pop();
    }
    
    fill(90, 75, 55);
    noStroke();
    ellipse(0, 0, size * 0.1, size * 0.1);
    pop();
  }
  
  renderPlacementPreview() {
    if (!this.isInGameArea(mouseX, mouseY)) return;
    
    const invZoom = 1 / CONFIG.viewZoom;
    const tx = (mouseX - CONFIG.viewX) * invZoom;
    const ty = (mouseY - CONFIG.viewY) * invZoom;
    
    if (tx < 0 || tx > this.terrain.mapWidth || ty < 0 || ty > this.terrain.mapHeight) return;
    
    const def = (this.activePlaceables && this.activePlaceables[this.selectedPlaceable]) || PLACEABLES[this.selectedPlaceable];
    const canPlaceTerrain = this.terrain.canPlace(tx, ty);
    const spacingCheck = this.canPlaceWithSpacing(tx, ty, this.selectedPlaceable);
    let biomeOk = true;
    if (def.allowedBiomes) {
      const b = this.terrain.getBiomeAt(tx, ty);
      biomeOk = def.allowedBiomes.includes(b.key);
    }
    const canPlace = canPlaceTerrain && spacingCheck.allowed && biomeOk;
    
    push();
    translate(tx, ty);
    
    noFill();
    stroke(canPlace ? CACHED_COLORS.placementValid : CACHED_COLORS.placementInvalid);
    strokeWeight(1);
    ellipse(0, 0, def.radius * 2, def.radius * 2);
    
    if (!def.ignoresSpacing) {
      stroke(canPlace ? CACHED_COLORS.spacingValid : CACHED_COLORS.spacingInvalid);
      drawingContext.setLineDash([4, 4]);
      ellipse(0, 0, (def.minSpacing || 40) * 2, (def.minSpacing || 40) * 2);
      drawingContext.setLineDash([]);
    }
    
    const col = def._parsedColor;
    fill(red(col), green(col), blue(col), canPlace ? 150 : 80);
    stroke(canPlace ? CACHED_COLORS.placementValidStrong : CACHED_COLORS.placementInvalidStrong);
    strokeWeight(2);
    ellipse(0, 0, 18, 18);
    pop();
    
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
      const br = spacingCheck.blocker.radius;
      ellipse(spacingCheck.blocker.pos.x, spacingCheck.blocker.pos.y, br * 2 + 10, br * 2 + 10);
      pop();
    }
  }
  
  handleClick(mx, my) {
    // Level select screen
    if (this.state === GAME_STATE.LEVEL_SELECT) {
      if (this._levelCardBounds) {
        for (const card of this._levelCardBounds) {
          if (card.unlocked &&
              mx > card.x && mx < card.x + card.w &&
              my > card.y && my < card.y + card.h) {
            this.loadLevel(card.levelId);
            this.state = GAME_STATE.MENU;  // Go to level splash
            return;
          }
        }
      }
      return;
    }
    
    // Level splash menu
    if (this.state === GAME_STATE.MENU) {
      if (CONFIG.debugMode && this._benchBtnBounds) {
        const btn = this._benchBtnBounds;
        if (mx > btn.x && mx < btn.x + btn.w &&
            my > btn.y && my < btn.y + btn.h) {
          BENCHMARK.arm();
          this.init();  // Start playing with the benchmark recording
          return;
        }
      }
      if (CONFIG.debugMode && this._bench5BtnBounds) {
        const btn = this._bench5BtnBounds;
        if (mx > btn.x && mx < btn.x + btn.w &&
            my > btn.y && my < btn.y + btn.h) {
          BENCHMARK.armBatch(5);   // five unattended runs, one CSV each
          this.init();
          return;
        }
      }
      if (this._menuBtnBounds) {
        const btn = this._menuBtnBounds;
        if (mx > btn.x && mx < btn.x + btn.w &&
            my > btn.y && my < btn.y + btn.h) {
          this.init();  // Start playing
          return;
        }
      }
      if (this._backBtnBounds) {
        const btn = this._backBtnBounds;
        if (mx > btn.x && mx < btn.x + btn.w &&
            my > btn.y && my < btn.y + btn.h) {
          this.state = GAME_STATE.LEVEL_SELECT;
          return;
        }
      }
      return;
    }

    if (this.tutorial && this.tutorial.active && this.tutorial.handleClick(mx, my)) return;
    
    if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED) {
      if (this.ui.handleClick(mx, my)) return;
    }
    
    if (this.state !== GAME_STATE.PLAYING && this.state !== GAME_STATE.PAUSED) return;

    if (this.isInGameArea(mx, my) && this.selectedPlaceable) {
      const invZoom = 1 / CONFIG.viewZoom;
      this.tryPlace((mx - CONFIG.viewX) * invZoom, (my - CONFIG.viewY) * invZoom);
    }
  }
  
  handleKey(key) {

      if (key === 'r' || key === 'R') {
      if (this.state === GAME_STATE.WON || this.state === GAME_STATE.LOST) {
        this.state = GAME_STATE.LEVEL_SELECT;
      } else if (this.currentLevel) {
        this.loadLevel(this.currentLevel.id);  // Restart current level
      }
      return;
    }

    if (key === 'd' || key === 'D') { CONFIG.debugMode = !CONFIG.debugMode; return; }

    if ((key === 'f' || key === 'F') &&
        (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED)) {
      this.toggleFullscreen();
      return;
    }
    
    if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED) {
      const palette = this.activePlaceables || PLACEABLES;
      const paletteKeys = Object.keys(palette);
      const digit = (key >= '1' && key <= '9') ? parseInt(key, 10) - 1 : -1;
      if (digit >= 0 && digit < paletteKeys.length) {
        this.selectPlaceable(paletteKeys[digit]);
      } else switch (key) {
        case 'p': case 'P': case ' ':
          this.state = (this.state === GAME_STATE.PAUSED)
            ? GAME_STATE.PLAYING : GAME_STATE.PAUSED;
          break;
        case 'Escape':
          this.cancelPlacement(); break;
        case 'h': case 'H':
          CONFIG.showHungerBars = !CONFIG.showHungerBars; break;
      }
    }
    
    if ((key === 't' || key === 'T') && this.state === GAME_STATE.PLAYING) {
      if (this.tutorial && !this.tutorial.active) this.tutorial.toggle();
    }

    if (key === 'm' || key === 'M') {
      if (audioManager) this.addNotification(audioManager.toggleMusic() ? 'Music enabled' : 'Music disabled', 'info');
    }
    if (key === 'n' || key === 'N') {
      if (audioManager) this.addNotification(audioManager.toggleAudio() ? 'Audio enabled' : 'Audio muted', 'info');
    }
  }

  handleVisibilityChange(isVisible) {
    if (!audioManager) return;
    if (isVisible) {
      audioManager.unmute();
      if (this.state === GAME_STATE.PLAYING) audioManager.resumeBackground();
    } else {
      audioManager.mute();
    }
  }
}



// ============================================
// MAIN SKETCH
// ============================================
let game;

let _needsInitialResize = true;

function setup() {
  if (!audioManager) audioManager = initAudioManager();

  CONFIG.recalculateLayout(windowWidth, windowHeight);

  pixelDensity(1); // must run BEFORE scaleCanvasToFit: it resets the canvas's inline CSS size
  let cnv = createCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);
  cnv.style('display', 'block');
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.style.background = '#19231e';

  scaleCanvasToFit();
  frameRate(60);
  textFont('OpenDyslexic');

  initCachedColors();
  initPlaceableColors();
  initPlantSprites(plantSprites);
  initializeRegistry();

  PROGRESS.init();

  game = new Game();

  document.addEventListener('visibilitychange', () => {
    if (game) game.handleVisibilityChange(!document.hidden);
  });
}

function windowResized() {
  // Recalculate layout for actual window dimensions
  CONFIG.recalculateLayout(windowWidth, windowHeight);

  // Resize the p5 canvas to the new computed dimensions
  resizeCanvas(CONFIG.canvasWidth, CONFIG.canvasHeight);

  // Apply CSS scaling to fill the window
  scaleCanvasToFit();

  // Update UI panel positions if game is running
  if (game && game.ui) {
    game.ui.recalculate();
    game._updateViewTransform();
  }
}

function scaleCanvasToFit() {
  const cnv = document.querySelector('canvas');
  if (!cnv) return;

  const cw = CONFIG.canvasWidth;
  const ch = CONFIG.canvasHeight;

  // Because we resize the canvas to match the window's aspect ratio,
  // the scale factor should be very close to uniform.
  // We use min() as a safety net against rounding.
  const scale = Math.min(windowWidth / cw, windowHeight / ch);

  cnv.style.width = (cw * scale) + 'px';
  cnv.style.height = (ch * scale) + 'px';
  cnv.style.position = 'absolute';
  cnv.style.left = ((windowWidth - cw * scale) / 2) + 'px';
  cnv.style.top = ((windowHeight - ch * scale) / 2) + 'px';
}

function initializeRegistry() {
  REGISTRY.registerAnimalType('moa', {}, Moa);
  REGISTRY.registerAnimalType('eagle', {}, HaastsEagle);
  
  for (const [key, config] of Object.entries(MOA_SPECIES)) REGISTRY.registerSpecies(key, 'moa', config);
  for (const [key, config] of Object.entries(EAGLE_SPECIES)) REGISTRY.registerSpecies(key, 'eagle', config);
  for (const [key, config] of Object.entries(PLANT_TYPES)) REGISTRY.registerPlant(key, config);
  for (const [key, config] of Object.entries(PLACEABLES)) REGISTRY.registerPlaceable(key, config);
  for (const [key, config] of Object.entries(BIOMES)) REGISTRY.registerBiome(key, config);
  
  const issues = REGISTRY.validate();
  if (issues.length > 0) console.warn('Registry validation found issues:', issues);
  if (CONFIG.debugMode) console.log('Registry initialized:', REGISTRY.getSummary());
}

function draw() {
  // On first frame, re-check dimensions in case setup() got stale values
  if (_needsInitialResize) {
    _needsInitialResize = false;
    const expectedW = Math.round(
      CONFIG.referenceHeight *
      Math.max(CONFIG.minAspectRatio,
        Math.min(CONFIG.maxAspectRatio, windowWidth / windowHeight))
    );
    if (expectedW !== CONFIG.canvasWidth) {
      windowResized(); // forces recalculate + resizeCanvas
    } else {
      scaleCanvasToFit(); // dimensions fine, but CSS scaling may have been reset
    }
  }

  const currentTime = millis();
  deltaTime = constrain(currentTime - lastFrameTime, 1, 100);
  lastFrameTime = currentTime;
  deltaMultiplier = deltaTime / TARGET_FRAME_TIME;

  updateFPS();

  if (typeof BENCHMARK !== 'undefined') BENCHMARK.tick();

  if (CONFIG.debugMode) {
    let t0 = performance.now();
    game.update(deltaMultiplier);
    let t1 = performance.now();
    game.render();
    let t2 = performance.now();

    fill(255);
    textSize(10);
    text(`Update: ${(t1-t0).toFixed(1)}ms`, 85, 38);
    text(`Render: ${(t2-t1).toFixed(1)}ms`, 85, 52);
    text(`Canvas: ${CONFIG.canvasWidth}×${CONFIG.canvasHeight}`, 85, 70);
    text(`Version: ${CONFIG.version}`, 85, 84);
  } else {
    game.update(deltaMultiplier);
    game.render();
  }
}

function updateFPS() {
  fpsHistory.push(1000 / deltaTime);
  if (fpsHistory.length > FPS_HISTORY_SIZE) fpsHistory.shift();
  
  let sum = 0;
  for (let i = 0; i < fpsHistory.length; i++) sum += fpsHistory[i];
  currentFPS = sum / fpsHistory.length;
}

function renderFPSCounter() {
  push();
  fill(0, 0, 0, 150);
  noStroke();
  rect(5, 5, 70, 20, 4);
  
  fill(currentFPS >= 55 ? [100, 255, 100] : (currentFPS >= 30 ? [255, 255, 100] : [255, 100, 100]));
  textSize(12);
  textAlign(LEFT, CENTER);
  textFont('monospace');
  text(`FPS: ${currentFPS.toFixed(1)}`, 10, 15);
  pop();
}

function mousePressed() { game.handleClick(mouseX, mouseY); }
function keyPressed() { game.handleKey(key); }