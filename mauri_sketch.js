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
  FreckleFace = loadFont('typefaces/FreckleFace-Regular.ttf');
  const spritePlants = ['Tussock', 'Flax', 'Fern', 'Rimu', 'Beech', 'Patotara', 'Lancewood', 'Speargrass', 'Coprosma', 'Dracophyllum'];
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
  version: 'alpha 1.2.1',

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
  terrainDetail: 2,  // render-only: bakes terrain buffers at 2x resolution
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

  // ===== FIXED 3D VIEW (plan-oblique) =====
  // Toggled with V (Game.toggleView3D). When on, the terrain is re-drawn from a
  // relief bake so the ranges stand up, and the sprite cast is billboarded onto
  // it (see mauri_projection.js / mauri_simulation.js). view3DK + view3DLiftFrac
  // feed Projection.configure; keep their sum ≈ 1.0 so the standing terrain fills
  // the same rect the flat map did (no view-transform change needed).
  view3D: false,
  view3DK: 0.72,         // pitch squash (1 = top-down, lower = more tilt). Keep K + liftFrac ≈ 1.0
  view3DLiftFrac: 0.28,  // range height at elevation 1.0, as a fraction of map height
  view3DHaze: [206, 220, 230],   // atmospheric haze behind the far ridge
  view3DEdge: [38, 46, 42],      // dark ink lip on prominent relief silhouettes
  // World pad: the terrain is generated as an island spanning a domain this much
  // TALLER than the play area on each side (fraction of map height), so the play
  // area is a WINDOW into the CENTRE of a larger island rather than a whole island.
  // 2D shows the window at the same zoom (the rest cropped); 3D reveals the rest as
  // one continuous real landmass. Applied at level generation (it shifts the habitat
  // toward the island interior — retune levels to taste). 0 = the old whole-island.
  view3DWorldPad: 0.5,
  // Over-scan: how much of that larger island (as a fraction of map height) the 3D
  // relief bake actually draws beyond the play window. FAR fills the receding
  // distance past the top of the frame (needs ≳ liftFrac/K ≈ 0.39); NEAR continues
  // the foreground down under the bottom HUD bar. Keep ≤ view3DWorldPad.
  view3DOverscan: 0.45,       // far (up-map) over-scan
  view3DOverscanNear: 0.28,   // near (down-map) over-scan — hides the near cut under the HUD
  // Aerial perspective: optional. 0 = off — the over-scan renders as plain real
  // terrain, identical in fashion to the play area (the island's true near/far
  // outskirts). Raise toward ~0.5 only if a seed's compressed far distance reads
  // too busy and you want it muted into haze.
  view3DHazeFade: 0,

  col_UI: [40, 70, 30, 180],
  col_panelBg: [25, 35, 30, 240],
  col_panelBorder: [60, 90, 70],
  col_panelHeader: [45, 75, 55],

  showContours: true,
  contourInterval: 0.045,
  contourStrength: 0.45,
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

// ============================================
// GLOBAL TEXT SCALE
// One knob for all small screen-space UI text (labels, costs, hotkeys,
// log entries, sidebar rows...). Call sites with base sizes ≤ 13 use
// smallTextSize(base) instead of textSize(base); raising SMALL_TEXT_BUMP
// nudges them all together. World-space text (drawn inside the zoomed view
// transform) deliberately keeps plain textSize.
// ============================================
let SMALL_TEXT_BUMP = 2;
function smallTextSize(base) { textSize(base + SMALL_TEXT_BUMP); }

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
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};

// Terrain resolution options for the splash-screen slider (left to right).
// Low resolutions coarsen the terrain cells (pixelScale) rather than
// shrinking the baked buffer, so pixels stay crisp instead of blurring.
const TERRAIN_DETAIL_OPTIONS = [
  { label: '2x',   pixelScale: 1, detail: 2 },
  { label: '1x',   pixelScale: 1, detail: 1 },
  { label: '0.5x', pixelScale: 2, detail: 1 }
];

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
  
  // A GLOBAL one-shot interactable (Free Play), not a spatial placement: invoking it
  // makes the NEXT year a mast year — the podocarp forest fruits abundantly (huge
  // forest growth, fruit edible through the cold) and the fruit-birds (kererū, kōkako)
  // boom. Costs a lot of mauri. Handled by Game._useGlobalInteractable / triggerMastYear
  // (the `global` flag routes it past tryPlace's spatial checks). Beech mast is cued a
  // year ahead by the previous summer's warmth — hence the deliberate one-year delay.
  mastYear: {
    name: "Mast Year",
    description: "Invoke a bumper year: next year the podocarp forest blooms and the fruit-birds boom",
    cost: 200,
    icon: '🌰',
    color: '#c98a3a',
    effect: 'mastYear',
    global: true,           // gamewide one-shot — no map placement
    cooldown: 3600,         // recharge (~1 year @ this level's seasonDuration); also gated by "next year"
    radius: 0,
    minSpacing: 0,
    ignoresSpacing: true,
    seasonalBonus: { summer: 1.0, autumn: 1.0, winter: 1.0, spring: 1.0 }
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
    iconSprite: 'Speargrass.png',
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
    colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#112b3b',
    walkable: false, canHavePlants: false, canPlace: false
  },
  coastal: {
    key: 'coastal', name: "Coastal/Beach", minElevation: 0.1, maxElevation: 0.15,
    colors: ['#c2b280', '#d4c794', '#e6dca8'], contourColor: '#93855d',
    walkable: true, canHavePlants: false, canPlace: true
  },
  grassland: {
    key: 'grassland', name: "Lowland Grassland", minElevation: 0.15, maxElevation: 0.3,
    colors: ['#7fb069', '#8fbc79', '#9fc889'], contourColor: '#658c53',
    walkable: true, canHavePlants: true, plantTypes: ['tussock', 'flax'], canPlace: true
  },
  podocarp: {
    key: 'podocarp', name: "Podocarp Forest", minElevation: 0.3, maxElevation: 0.4,
    colors: ['#2d5a3d', '#346644', '#3b724b'], contourColor: '#295438',
    walkable: true, canHavePlants: true, plantTypes: ['fern', 'rimu'], canPlace: true
  },
  montane: {
    key: 'montane', name: "Montane Forest", minElevation: 0.4, maxElevation: 0.60,
    colors: ['#4a7c59', '#528764', '#5a926f'], contourColor: '#406f52',
    walkable: true, canHavePlants: true, 
    plantTypes: ['beech', 'fern', 'patotara'],
    canPlace: true
  },
  subalpine: {
    key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.60, maxElevation: 0.80,
    colors: ['#a8a060', '#b5ad6d', '#c2ba7a'], contourColor: '#827c4a',
    walkable: true, canHavePlants: true, 
    plantTypes: ['tussock', 'patotara'],
    canPlace: true
  },
  alpine: {
    key: 'alpine', name: "Alpine Rock", minElevation: 0.77, maxElevation: 0.9,
    colors: ['#8b8b8b', '#9a9a9a', '#a9a9a9'], contourColor: '#696969',
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
// winterEdibility (0..1): fraction of a plant's food value that survives the cold.
// Read ONLY by the Free Play winter-inedibility mechanic (LEVEL_MECHANICS.winterInedibility);
// inert on every other level. NZ's flora is evergreen, so winter takes FOOD, not the
// plant: berry/fruit sources drop to ~0, the evergreen beech refuge keeps the most.
// See FREEPLAY_PLAN.md §4.2. A deepening glacial erodes these floors further (in Plant).
const PLANT_TYPES = {
  tussock: { name: "Tussock", nutrition: 25, color: '#8ea040', size: 24, growthTime: 200,
    winterEdibility: 0.20, description: "Hardy grass that covers the high country" },
  flax: { name: "Flax", nutrition: 35, color: '#487020', size: 26, growthTime: 280,
    winterEdibility: 0.10, description: "Harakeke: versatile, with sweet nectar" },
  fern: { name: "Fern", nutrition: 30, color: '#228B22', size: 36, growthTime: 240,
    winterEdibility: 0.10, description: "The iconic Ponga's fronds populate forests" },
  rimu: { name: "Rimu", nutrition: 50, color: '#8B0000', size: 48, growthTime: 400,
    winterEdibility: 0.0, description: "Ancient podocarp with bright red fruit" },
  beech: { name: "Beech", nutrition: 40, color: '#8b430f', size: 52, growthTime: 350,
    winterEdibility: 0.35, description: "Tawhai: produces mast seed in good years" },
  kawakawa: { name: "Kawakawa", nutrition: 40, color: '#3d9a5e', size: 22, growthTime: 150,
    winterEdibility: 0.15, description: "Heart-shaped leaves with peppery fruit" },
  patotara: { name: "Pātōtara", nutrition: 35, color: '#c94c5a', size: 28, growthTime: 160,
    winterEdibility: 0.0, description: "Alpine shrub with summer berries" },

  // --- Glacial-flora (LGM) additions. Coprosma & dracophyllum are sprite-rendered; matagouri is procedural. ---
  coprosma: { name: "Coprosma", nutrition: 30, color: '#5c7d3e', size: 22, growthTime: 190,
    winterEdibility: 0.15, description: "Divaricating shrub; hardy glacial browse with orange berries" },
  dracophyllum: { name: "Dracophyllum", nutrition: 28, color: '#9a7b4f', size: 30, growthTime: 250,
    winterEdibility: 0.15, description: "Inaka grass-tree of the cold subalpine tops" },
  matagouri: { name: "Matagouri", nutrition: 26, color: '#7a6f4a', size: 24, growthTime: 210,
    winterEdibility: 0.15, description: "Tūmatakuru: thorny shrub of the glacial outwash flats" },

  // --- Favoured, browse-resistant plants (planted via the palette) ---
  lancewood: { name: "Juvenile Lancewood", nutrition: 34, color: '#6a5a33', size: 30, growthTime: 300,
    winterEdibility: 0.25, description: "Horoeka: tough and spiky when growing." },
  speargrass: { name: "Speargrass", nutrition: 30, color: '#8f9a55', size: 26, growthTime: 260,
    winterEdibility: 0.25, description: "Taramea: spiny herb of the hills" }
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

    // Touch-and-hold move: press a placed item for ~1s to pick it up, click
    // to set it down elsewhere for half its mauri price.
    this._holdCandidate = null;   // { p, heldFrames, startMX, startMY }
    this.movingPlaceable = null;

    this.playTime = 0;
    this.maxPlayTime = 0;
    this._menuBtnBounds = null;

    // Free Play climate drift (see mauri_climate_drift.js). Inert unless the level
    // sets mechanics.climateDrift; _climateCfg stays null on every other level.
    this._climateCfg = null;
    this.coldIndex = 0;
    this.cycle = 0;
    // Free Play endless yearly-goal engine state.
    this._freeplayYear = -1;      // which year's goals are currently built
    this.freeplayFocus = [];      // the two species this year's goals protect
    this._yearsSurvived = 0;
    // Mast Year interactable (see triggerMastYear): the cycle a bought mast lands on
    // (-1 = none). Global one-shot cooldowns live here, keyed by placeable type.
    this._mastYearTargetCycle = -1;
    this._globalCooldownUntil = {};

    // Gamewide field guide / encyclopedia (opened with E).
    this.encyclopedia = (typeof Encyclopedia !== 'undefined') ? new Encyclopedia() : null;

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

    // Timed end (classic-goals levels): when set, the level always runs to
    // this playTime and then completes — goals are en-route rewards, not the
    // win condition. Phased levels have their own built-in timed end.
    this.timeLimit = levelDef.timeLimit || null;

    // NEW: Load illustration assets for this level's start screen
    this.menuArt.loadForLevel(levelDef);

    // NOTE: init() is intentionally NOT called here. The level splash only
    // needs the level def + menu art; the heavy work (terrain generation,
    // buffer baking, simulation setup) is deferred to _startLoading(),
    // triggered by the Start Level button.
  }

  // Show the loading screen, then run init() on the following frame.
  // The one-frame delay lets the browser actually paint the loading screen
  // before the blocking generation work starts.
  _startLoading() {
    this.state = GAME_STATE.LOADING;
    this._loadingFramesDrawn = 0;
  }
  
  init() {

    if (!this.currentLevel) return;

    this.terrain = new TerrainGenerator(CONFIG, this.activeBiomes);
    this.seasonManager = new SeasonManager(CONFIG);
    this.terrain.setSeasonManager(this.seasonManager);
    this.terrain.generate();
    this._configureProjection();   // 3D projection depends on the new map dimensions
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
    // Free Play: build the climate-drift config for this level (null = mode off).
    this._climateCfg = (typeof ClimateDrift !== 'undefined' && LEVEL_MECHANICS && LEVEL_MECHANICS.climateDrift)
      ? ClimateDrift.cfgFrom(LEVEL_MECHANICS) : null;
    this.coldIndex = 0;
    this.cycle = 0;
    if (this.seasonManager) this.seasonManager.coldIndex = 0;
    this._freeplayYear = -1;
    this.freeplayFocus = [];
    this._yearsSurvived = 0;
    this._mastYearTargetCycle = -1;   // reset the pending/active mast per level load
    this._globalCooldownUntil = {};
    this._stormCooldownUntil = 0;   // reset per level load, else a restart starts mid-cooldown
    this._holdCandidate = null;     // stale refs would point into the old simulation
    this.movingPlaceable = null;
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
    // Tip-script resolution: an inline levelDef override wins, else the
    // script registered for this level id, else the shared 'default' script.
    // Per-level scripts live in levels/tutorial_*.js (see TUTORIAL_REGISTRY).
    this.tutorial.setLevelTips(
      this.currentLevel.tutorial?.tips ||
      TUTORIAL_REGISTRY.get(this.currentLevel.id) ||
      TUTORIAL_REGISTRY.get('default')
    );
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

  // Fixed 3D view (plan-oblique). Toggled with V. The relief terrain is baked
  // lazily on the first switch (a one-time hitch), then cached; entities are
  // billboarded onto it. No view-transform change is needed because K+liftFrac≈1
  // keeps the standing terrain inside the flat map's rect.
  toggleView3D() {
    if (!this.terrain) return;
    CONFIG.view3D = !CONFIG.view3D;
    this._configureProjection();
    this.addNotification(CONFIG.view3D ? "3D view" : "Top-down view", 'info');
  }

  // Point Projection at the current map + authored pitch/lift, and mirror the
  // 3D flag onto Projection.relief (the master switch the bake + billboards read).
  _configureProjection() {
    if (typeof Projection === 'undefined' || !this.terrain) return;
    Projection.configure({
      K: CONFIG.view3DK,
      liftFrac: CONFIG.view3DLiftFrac,
      mapWidth: this.terrain.mapWidth,
      mapHeight: this.terrain.mapHeight
    });
    Projection.relief = !!CONFIG.view3D;
  }

  // Screen (canvas) point → world point, honouring the 3D projection so clicks
  // and placement previews land on the ground under the cursor. In 2D this is the
  // plain inverse of the view transform; in 3D it also inverts the plan-oblique
  // lift via Projection.screenToWorld (iterative, off the per-frame path).
  _pointerWorld(mx, my) {
    const invZoom = 1 / CONFIG.viewZoom;
    const px = (mx - CONFIG.viewX) * invZoom;
    const py = (my - CONFIG.viewY) * invZoom;
    if (CONFIG.view3D && typeof Projection !== 'undefined' && Projection.relief) {
      return Projection.screenToWorld(px, py, (x, y) => this.terrain.getElevationAt(x, y));
    }
    return { x: px, y: py };
  }

  // Paint-space y for a world point — where a thing standing at (x, y) is drawn.
  // In 2D this is just y; in 3D it lifts onto the relief so placement rings and
  // ghosts sit on the ground like the billboarded cast. Used only by previews.
  _groundPaintY(x, y) {
    if (CONFIG.view3D && typeof Projection !== 'undefined' && Projection.relief) {
      return Projection.groundY(y, this.terrain.getElevationAt(x, y));
    }
    return y;
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
    
    // Moa eggs only: this count backs the "all moa gone" loss check, and an
    // incubating EAGLE egg must not postpone that verdict on a moa-empty map.
    let eggCount = 0;
    const eggs = this.simulation.eggs;
    for (let i = 0; i < eggs.length; i++) {
      if (eggs[i].alive && eggs[i].offspringType !== 'eagle') eggCount++;
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
    this.updateHoldToMove(dt);   // like placement, works while paused
    if (this.state !== GAME_STATE.PLAYING) return;
    
    this.playTime += dt;
    if (this.playTime > this.maxPlayTime) this.maxPlayTime = this.playTime;

    // Free Play: track the year, and advance the deepening climate. The cycle (year)
    // drives the endless yearly goals; coldIndex is the glacial severity of the year,
    // which the season manager folds into its winter-end getters. Set BEFORE
    // seasonManager.update and simulation.update so this frame reads it.
    this.cycle = Math.floor(this.playTime / (4 * CONFIG.seasonDuration));
    if (this._climateCfg) {
      this.coldIndex = ClimateDrift.severityOfCycle(this.cycle, this._climateCfg);
      this.seasonManager.coldIndex = this.coldIndex;
    }

    // Mast Year: a bought bumper year is live while cycle == its target. The season
    // manager folds it into forest growth + winter edibility; the simulation into the
    // fruit-birds' breeding. Set BEFORE seasonManager/simulation update so this frame reads it.
    const _mast = this._isMastYear();
    this.seasonManager.mastYear = _mast;
    this.simulation.mastYear = _mast;

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

    // Level-wide fail condition: the non-phased counterpart of a phase's
    // `fail` hook. Lets a level lose on conditions the generic all-moa check
    // misses — e.g. level 1's focal Upland Moa dying out while mutated
    // cousin species carry the headcount.
    if (this.state === GAME_STATE.PLAYING && this.currentLevel &&
        this.currentLevel.fail && this.currentLevel.fail(this.simulation, this)) {
      this.state = GAME_STATE.LOST;
      this.gameOverReason = this.currentLevel.failReason || "A population you were protecting died out.";
      if (audioManager) audioManager.playLoss();
    }

    // Eagle extinction (emergent-eagle levels): the apex predator dying out is a
    // loss — EXCEPT in Free Play, where it instead unleashes a dominant-moa boom
    // (handled in _updateEagleBoom) and eagles re-immigrate next year. A grace
    // period holds while an eagle egg is still incubating.
    if (this.state === GAME_STATE.PLAYING && !(this.currentLevel && this.currentLevel.endless) &&
        typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.emergentEagles &&
        this.simulation.countAliveEagles() === 0) {
      let eagleEggs = 0;
      const eggs = this.simulation.eggs;
      for (let i = 0; i < eggs.length; i++) {
        if (eggs[i].alive && !eggs[i].hatched && eggs[i].offspringType === 'eagle') { eagleEggs++; break; }
      }
      if (eagleEggs === 0) {
        this.state = GAME_STATE.LOST;
        this.gameOverReason = "The ecosystem lost its apex predator!";
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
  
  // Headline for the WON overlay. Only claims "all goals achieved" when it's
  // actually true — timed levels (and phased ones) can end with goals unmet.
  // Levels may override with an `endMessage` string.
  _endMessage() {
    if (this.currentLevel && this.currentLevel.endMessage) return this.currentLevel.endMessage;
    const goals = this.goals || [];
    const allDone = goals.length > 0 && goals.every(g => g.achieved);
    return allDone ? "All goals achieved!" : "";
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
    // Free Play is endless: rolling yearly goals, and NEVER a win (an empty goals
    // array would otherwise win on frame one — see MISTAKES.md). Loss stays with the
    // all-moa-gone check in update().
    if (this.currentLevel && this.currentLevel.endless) { this._checkFreeplayYear(); return; }
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
    
    // Timed levels run to the clock; goal completion alone never ends them.
    const timeUp = this.timeLimit && this.playTime >= this.timeLimit;
    if (timeUp || (!this.timeLimit && allAchieved)) {
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

    // Win: survived to the end of the final phase. Enduring to the clock
    // completes the final phase's SURVIVE goals (same rule as a phase
    // transition) — but unmet growth goals stay unmet, so the end screen
    // reports an honest tally instead of claiming everything was achieved.
    if (this.playTime >= total) {
      for (const g of this.goals) {
        if (g.survive && !g.achieved) {
          g.achieved = true;
          this._goalsCompleted = (this._goalsCompleted || 0) + 1;
          if (g.reward) this.mauri.earn(g.reward, halfWidth, 80, 'goal');
        }
      }
      this.state = GAME_STATE.WON;
      if (audioManager) audioManager.playWin();
      const score = computeLevelScore(this.currentLevel, this._scoreContext());
      PROGRESS.completeLevel(this.currentLevel.id, score);
    }
  }
  
  // ============================================
  // FREE PLAY — endless yearly goals, refounding & the eagle-loss boom
  // (see FREEPLAY_PLAN.md §4.4 / §4.5). Only reached for a level with endless:true.
  // ============================================

  _freeplaySpeciesName(key) {
    return (typeof MOA_SPECIES !== 'undefined' && MOA_SPECIES[key] && MOA_SPECIES[key].displayName) || key;
  }

  // Roster moa species ranked most-endangered first (lowest headcount).
  _rankFreeplaySpecies() {
    const roster = (this.activeSpecies && this.activeSpecies.moa) || [];
    const sim = this.simulation;
    return roster
      .map(k => ({ k, count: sim.getSpeciesCount(k) }))
      .sort((a, b) => (a.count - b.count) || (roster.indexOf(a.k) - roster.indexOf(b.k)));
  }

  _dominantNonFocusSpecies() {
    const roster = (this.activeSpecies && this.activeSpecies.moa) || [];
    const sim = this.simulation;
    let best = null, bestN = -1;
    for (const k of roster) {
      if (this.freeplayFocus.includes(k)) continue;
      const n = sim.getSpeciesCount(k);
      if (n > bestN) { bestN = n; best = k; }
    }
    return best;
  }

  _checkFreeplayYear() {
    const sim = this.simulation;
    const halfWidth = CONFIG.width / 2 / CONFIG.zoom;

    if (this.cycle !== this._freeplayYear) {
      if (this._freeplayYear >= 0) this._yearsSurvived++;
      this._freeplayYear = this.cycle;
      this._beginFreeplayYear();
    }

    // Soft growth goals: reward when met. There is deliberately NO win path.
    for (const goal of this.goals) {
      if (!goal.achieved && goal.condition && goal.condition()) {
        goal.achieved = true;
        this._goalsCompleted = (this._goalsCompleted || 0) + 1;
        if (goal.reward) this.mauri.earn(goal.reward, halfWidth, 80, 'goal');
        this.addNotification(`Recovered: ${goal.name}! +${goal.reward} mauri`, 'success');
      }
    }

    this._updateEagleBoom();
  }

  _beginFreeplayYear() {
    const sim = this.simulation;
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    const protectFloor = M.freeplayProtectFloor ?? 2;
    const refoundCount = M.freeplayRefoundCount ?? 3;
    const targets = this.currentLevel.freeplayTargets || M.freeplayTargets || {};
    const defaultTarget = M.freeplayDefaultTarget ?? 8;

    // 1) The two most-endangered species become this year's focus.
    const ranked = this._rankFreeplaySpecies();
    this.freeplayFocus = ranked.slice(0, 2).map(s => s.k);

    // 2) Refound extinct NON-focus species so the full cast returns each year.
    for (const s of ranked) {
      if (this.freeplayFocus.includes(s.k)) continue;
      if (s.count === 0) sim._spawnDistributedMoas({ [s.k]: refoundCount });
    }
    // 3) Top a crashed focus species up to its protect floor so it stays growable.
    for (const k of this.freeplayFocus) {
      const short = protectFloor - sim.getSpeciesCount(k);
      if (short > 0) sim._spawnDistributedMoas({ [k]: short });
    }

    // 4) Protect ONLY the focus species from a total wipe this year (dynamic floor).
    const floors = {};
    for (const k of this.freeplayFocus) floors[k] = protectFloor;
    sim.dynamicFloors = floors;

    // 5) Highlight the focus species in the UI.
    if (typeof SPECIES_HIGHLIGHT !== 'undefined') {
      SPECIES_HIGHLIGHT.clear();
      for (const k of this.freeplayFocus) SPECIES_HIGHLIGHT.add(k);
    }

    // 6) Eagles re-immigrate if the apex predator was lost (this ends any boom).
    if (M.emergentEagles && sim.countAliveEagles() === 0) {
      sim.spawnEagle(); sim.spawnEagle();
      sim.boomSpecies = null;
    }

    // 7) Build this year's goals: recover each focus species to its target.
    this.goals = this.freeplayFocus.map(k => {
      const target = targets[k] || defaultTarget;
      const reward = Math.round((M.freeplayGoalReward ?? 80) * (1 + this.coldIndex));
      return {
        name: `${this._freeplaySpeciesName(k)} ≥ ${target}`,
        condition: () => this.simulation.getSpeciesCount(k) >= target,
        reward,
        achieved: false
      };
    });

    // 8) Announce the year.
    const stage = (typeof ClimateDrift !== 'undefined' && this._climateCfg)
      ? ClimateDrift.stageName(this.coldIndex) : '';
    const names = this.freeplayFocus.map(k => this._freeplaySpeciesName(k)).join(' & ');
    this.addNotification(`Year ${this.cycle + 1}${stage ? ' — ' + stage : ''}: protect ${names}`, 'info');

    // 9) Mast year onset: announce the boom and seed a few extra fruit-birds to the
    // feast so it reads at once (forest growth + faster breeding do the rest all year).
    if (this._isMastYear()) {
      this.addNotification('Mast year! The podocarp forest blooms — the fruit-birds will boom.', 'success');
      if (sim._spawnOtherEntities) {
        sim._spawnOtherEntities('kereru', 2);
        sim._spawnOtherEntities('kokako', 1);
      }
    }
  }

  // Endless eagle-loss consequence: with no apex predator, the current dominant
  // (non-focus) moa surges unchecked, filling the population budget and crowding the
  // focus species out of the forest — until eagles re-immigrate next year.
  _updateEagleBoom() {
    const sim = this.simulation;
    if (!(typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.emergentEagles)) return;
    if (sim.countAliveEagles() === 0) {
      if (!sim.boomSpecies) {
        const dom = this._dominantNonFocusSpecies();
        if (dom) {
          sim.boomSpecies = dom;
          this.addNotification(`No eagles: ${this._freeplaySpeciesName(dom)} surge unchecked.`, 'error');
        }
      }
    } else if (sim.boomSpecies) {
      sim.boomSpecies = null;
    }
  }

  // Free Play HUD: the deepening-climate gauge — current year, glacial stage, a
  // cold thermometer, and years survived. Drawn in screen space over the game.
  _renderClimateGauge() {
    if (this.state !== GAME_STATE.PLAYING && this.state !== GAME_STATE.PAUSED) return;
    const W = CONFIG.canvasWidth;
    const gw = 190, gh = 42, gx = W / 2 - gw / 2, gy = 44;
    push();
    noStroke();
    fill(20, 26, 34, 205); rect(gx, gy, gw, gh, 8);
    fill(224, 232, 226); textAlign(LEFT, CENTER); textStyle(BOLD); textSize(13);
    text(`Year ${this.cycle + 1}`, gx + 10, gy + 14);
    textStyle(NORMAL); textSize(10); fill(168, 190, 178);
    const stage = (typeof ClimateDrift !== 'undefined') ? ClimateDrift.stageName(this.coldIndex) : '';
    text(stage, gx + 10, gy + 30);
    // thermometer
    const bx = gx + 84, by = gy + 11, bw = gw - 96, bh = 8;
    fill(40, 50, 58); rect(bx, by, bw, bh, 4);
    const t = Math.max(0, Math.min(1, this.coldIndex));
    fill(lerp(92, 208, t), lerp(172, 224, t), lerp(150, 246, t));
    rect(bx, by, bw * t, bh, 4);
    fill(150, 168, 158); textAlign(LEFT, CENTER); textSize(10);
    text(`survived: ${this._yearsSurvived}`, bx, gy + 30);

    // Mast Year tag: shown while a mast is booked — "coming" next year, then live this
    // year — so the player sees their (costly) investment on its way and landing.
    if (this._mastYearTargetCycle >= 0 && this._mastYearTargetCycle >= this.cycle) {
      const active = this._isMastYear();
      const label = active ? 'MAST YEAR' : 'mast year next';
      textAlign(CENTER, CENTER); textStyle(BOLD); textSize(10);
      const tw = textWidth(label) + 16, px = gx + gw / 2 - tw / 2, py = gy + gh + 4;
      fill(70, 138, 62, active ? 235 : 150); rect(px, py, tw, 16, 6);
      fill(242, 250, 236); text(label, gx + gw / 2, py + 8);
      textStyle(NORMAL);
    }
    pop();
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
    if (this.movingPlaceable) this.cancelMove();   // one mode at a time
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

  // ============================================
  // TOUCH-AND-HOLD MOVE
  // ============================================

  _moveDef(p) {
    return (this.activePlaceables && this.activePlaceables[p.type]) || p.def;
  }

  _moveCost(p) {
    return Math.ceil((this._moveDef(p).cost || 0) / 2);
  }

  // Ticks an armed hold candidate toward becoming a move; called every frame
  // in PLAYING and PAUSED. The candidate dies if the button lifts early, the
  // cursor drifts, a tool is selected, or the item expires.
  updateHoldToMove(dt = 1) {
    if (this.movingPlaceable && !this.movingPlaceable.alive) {
      this.addNotification("It faded away before it could be moved.", 'error');
      this.movingPlaceable = null;
    }

    const hc = this._holdCandidate;
    if (!hc) return;

    if (!hc.p.alive || this.selectedPlaceable || this.movingPlaceable || !mouseIsPressed ||
        dist(mouseX, mouseY, hc.startMX, hc.startMY) > 14) {
      this._holdCandidate = null;
      return;
    }

    hc.heldFrames += dt;
    if (hc.heldFrames >= 60) {   // ~1 second
      this._holdCandidate = null;
      this._beginMove(hc.p);
    }
  }

  _beginMove(p) {
    const def = this._moveDef(p);
    const cost = this._moveCost(p);
    if (!this.mauri.canAfford(cost)) {
      this.addNotification(`Need ${cost} mauri to move ${def.name}`, 'error');
      return;
    }
    this.cancelPlacement();
    this.movingPlaceable = p;
    this.addNotification(`Moving ${def.name} — click to set it down (${cost} mauri), ESC to cancel`, 'info');
    if (audioManager) audioManager.playPlantRustle();
  }

  cancelMove() {
    if (this.movingPlaceable) {
      this.movingPlaceable = null;
      this.addNotification("Move cancelled", 'info');
    }
  }

  tryDropMove(x, y) {
    const p = this.movingPlaceable;
    if (!p || !p.alive) { this.movingPlaceable = null; return false; }
    const def = this._moveDef(p);

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
    // Spacing must ignore the item being moved, or it blocks itself
    const spacingCheck = this.canPlaceWithSpacing(x, y, p.type, p);
    if (!spacingCheck.allowed) {
      this.addNotification(spacingCheck.reason, 'error');
      return false;
    }

    const cost = this._moveCost(p);
    if (!this.mauri.spend(cost)) {
      this.addNotification("Not enough mauri!", 'error');
      return false;
    }

    p.moveTo(x, y);
    if (p.type === 'nest') this.simulation._nestCacheValid = false;
    this.movingPlaceable = null;
    this.addNotification(`Moved ${def.name} (-${cost} mauri)`, 'info');
    if (audioManager) audioManager.playPlantRustle();
    return true;
  }
  
  canPlaceWithSpacing(x, y, type, exclude = null) {
    const def = this.activePlaceables[type];
    if (def.ignoresSpacing) return { allowed: true };

    const mySpacing = def.minSpacing || 40;
    this._tempVec.set(x, y);

    for (const p of this.simulation.placeables) {
      if (!p.alive || p === exclude) continue;
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

    // Global one-shot interactables (e.g. Mast Year) fire a gamewide effect instead of
    // placing an object — route them past the spatial checks below.
    if (def.global) return this._useGlobalInteractable(this.selectedPlaceable, def);

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
    if (this.selectedPlaceable === 'Storm') {
      this._stormCooldownDuration = 600;   // 10s @60fps (UI reads this for the cooldown sweep)
      this._stormCooldownUntil = this.playTime + this._stormCooldownDuration;
    }
    this.addNotification(`Placed ${def.name}`, 'info');
    if (this.tutorial) {
      this.tutorial.fireEvent(TUTORIAL_EVENTS.PLACEMENT, { type: this.selectedPlaceable });
    }
    
    if (audioManager) {
      this.selectedPlaceable === 'Storm' ? audioManager.playBoltStrike() : audioManager.playPlantRustle();
    }
    
    if (!keyIsDown(SHIFT)) this.selectedPlaceable = null;
    return true;
  }

  // Use a GLOBAL one-shot interactable (a placeable flagged `global`): spend its cost,
  // fire its gamewide effect, and start its own recharge — no map placement. Currently
  // just Mast Year, but written so another gamewide tool can slot in the same way.
  _useGlobalInteractable(type, def) {
    const until = this._globalCooldownUntil[type] || 0;
    if (this.playTime < until) {
      const secs = Math.ceil((until - this.playTime) / 60);
      this.addNotification(`${def.name} is recharging (${secs}s)`, 'error');
      return false;
    }
    // Feature precondition: a mast is already booked for next year.
    if (type === 'mastYear' && this._mastYearTargetCycle > this.cycle) {
      this.addNotification('A mast year is already on the way.', 'error');
      return false;
    }
    if (!this.mauri.spend(def.cost)) {
      this.addNotification('Not enough mauri!', 'error');
      return false;
    }

    if (type === 'mastYear') this.triggerMastYear();

    this._globalCooldownUntil[type] = this.playTime + (def.cooldown || 3600);
    if (typeof BENCHMARK !== 'undefined') BENCHMARK.recordPlacement(type);
    if (audioManager) audioManager.playPlantRustle();
    if (!keyIsDown(SHIFT)) this.selectedPlaceable = null;
    return true;
  }

  // Book a mast year for the NEXT full year (a real beech/rimu mast is cued a year
  // ahead by the previous summer's warmth). While that year runs, _isMastYear() is
  // true: mauri_seasons.js surges forest growth and keeps forest fruit edible through
  // the cold, and the fruit-birds (kererū/kōkako) breed hard (mauri_kereru.js /
  // Simulation._hatchFlyerEgg). The onset is announced in _beginFreeplayYear.
  triggerMastYear() {
    this._mastYearTargetCycle = this.cycle + 1;
    this.addNotification('Mast year invoked — next year the podocarp forest will bloom.', 'success');
  }

  // Is the current game year the booked mast year?
  _isMastYear() {
    return this._mastYearTargetCycle >= 0 && this.cycle === this._mastYearTargetCycle;
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

    if (this.state === GAME_STATE.LOADING) {
      this.renderLoading();
      if (this._loadingFramesDrawn >= 1) {
        this.init();   // blocking; the loading frame painted last frame stays visible
      } else {
        this._loadingFramesDrawn++;
      }
      return;
    }

    if (!CONFIG.fullscreen) this.ui.renderPanels();

    // In 3D (windowed) the terrain is allowed to fill DOWN under the bottom HUD
    // bar so the near over-scan continues off-frame instead of ending in a hard
    // cut at the game-area edge; the bar is redrawn opaque over it after the world.
    const _clip3D = CONFIG.view3D && !CONFIG.fullscreen && this.terrain;

    push();
    drawingContext.save();
    drawingContext.beginPath();
    const _clipW = CONFIG.fullscreen ? this.terrain.mapWidth * CONFIG.viewZoom : CONFIG.gameAreaWidth;
    const _clipH = CONFIG.fullscreen ? this.terrain.mapHeight * CONFIG.viewZoom
                 : (_clip3D ? CONFIG.canvasHeight - CONFIG.viewY : CONFIG.gameAreaHeight);
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
    } else if ((this.movingPlaceable || this._holdCandidate) &&
        (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED)) {
      this.renderMovePreview();
    }
    
    drawingContext.restore();
    pop();

    // 3D: the terrain filled behind the bottom bar — repaint the bar over it so the
    // near over-scan is hidden and the palette sits on a clean panel again.
    if (_clip3D) {
      const bb = this.ui.bottomBar;
      this.ui.renderPanelBackground(bb.x, bb.y, bb.width, bb.height, 'bottom');
    }

    // Benchmark: the run ends with the level (update() no longer ticks in
    // WON/LOST states, so the final sample + CSV save happens here)
    if (BENCHMARK.active && !BENCHMARK.finished &&
        (this.state === GAME_STATE.WON || this.state === GAME_STATE.LOST)) {
      BENCHMARK.finish(this, this.state === GAME_STATE.WON ? 'win' : 'loss');
    }

    // A tutorial-tip pause shows only the tip (its own overlay dims the
    // world); the PAUSED dialog is for pauses the player asked for.
    const _tutorialPause = this.tutorial && this.tutorial._pausedByTutorial;
    if (this.state === GAME_STATE.PAUSED && !_tutorialPause) {
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
      // "Thriving" is reserved for a full-clear; a win with unmet goals is
      // merely "balanced". (_goalsTally() also lazily fills _goalsTotal.)
      const goalsTally = this._goalsTally();
      const allGoalsMet = (this._goalsCompleted || 0) >= this._goalsTotal;
      this._renderOverlay(...CONFIG.col_UI.slice(0,3), 150, {
        title: allGoalsMet ? "ECOSYSTEM THRIVING!" : "ECOSYSTEM BALANCED",
        titleColor: [180, 255, 180],
        lines: [
          { text: this._endMessage(), color: [150, 220, 150], size: 18 },
          { text: goalsTally, color: [150, 220, 150], size: 14 },
          { text: `Final population: ${this._cachedMoaCount} moa`, color: [120, 180, 120], size: 14 },
          { text: `Total mauri earned: ${this.mauri.totalEarned | 0}`, color: [120, 180, 120], size: 14 },
          { text: `Time elapsed: ${(this.playTime / 60) | 0} seconds`, color: [120, 180, 120], size: 14 },
          { text: `Final Score: ${computeLevelScore(this.currentLevel, this._scoreContext())} points`, color: [200, 240, 200], size: 16 },
          { text: "", color: [200, 240, 200], size: 18 },
          { text: "Press R to return to menu", color: [200, 240, 200], size: 18 }
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
          { text: "Press R to return to menu", color: [220, 180, 180], size: 18 }
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
      // Tips flagged spotlightHuntingEagle (e.g. "Drop It on the Eagle!")
      // re-draw the hunting eagle's sprite above the overlay, flashing white,
      // so the player knows exactly which bird to storm.
      if (this.tutorial.active && this.tutorial.currentTip &&
          this.tutorial.currentTip.spotlightHuntingEagle) {
        this.renderHuntingEagleAboveUI();
      }
      // Tips flagged speciesHighlightAboveUI (e.g. "The Upland Moa need your
      // help!") re-draw every SPECIES_HIGHLIGHT moa above the overlay, so the
      // flock the tip introduces glows through the dimmed world.
      if (this.tutorial.active && this.tutorial.currentTip &&
          this.tutorial.currentTip.speciesHighlightAboveUI) {
        this.renderHighlightedMoaAboveUI();
      }
    }
  }

  // Re-draws every moa of a highlighted species (halo + sprite) in world
  // space, above the tutorial overlay (same clip + view transform as the main
  // game-area pass). Used by tips flagged speciesHighlightAboveUI.
  renderHighlightedMoaAboveUI() {
    if (typeof SPECIES_HIGHLIGHT === 'undefined' || SPECIES_HIGHLIGHT.size === 0) return;
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
      if (m.alive && SPECIES_HIGHLIGHT.has(m.speciesKey)) m.render();
    }

    drawingContext.restore();
    pop();
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

  // Re-draws hunting eagles' sprites in world space, above the tutorial
  // overlay, with a pulsing white flash (same clip + view transform as the
  // main game-area pass). Used by tips flagged spotlightHuntingEagle.
  renderHuntingEagleAboveUI() {
    push();
    drawingContext.save();
    drawingContext.beginPath();
    const _clipW = CONFIG.fullscreen ? this.terrain.mapWidth * CONFIG.viewZoom : CONFIG.gameAreaWidth;
    const _clipH = CONFIG.fullscreen ? this.terrain.mapHeight * CONFIG.viewZoom : CONFIG.gameAreaHeight;
    drawingContext.rect(CONFIG.viewX, CONFIG.viewY, _clipW, _clipH);
    drawingContext.clip();
    translate(CONFIG.viewX, CONFIG.viewY);
    scale(CONFIG.viewZoom);

    const eagles = this.simulation.eagles;
    for (let i = 0; i < eagles.length; i++) {
      const e = eagles[i];
      if (e.alive !== false && e.hunting) e.renderSpotlight();
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
    textFont(FreckleFace);
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
    push(); textFont(FreckleFace);
    text("Avian Age: Mauri", centerX, 100);
    pop();

    fill(CACHED_COLORS.menuSubtitle);
    textSize(18);
    text("Select a habitat...", centerX, 150);

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
      noStroke();

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
      push(); textFont(FreckleFace);
      text(level.name, x + cardW / 2, cardY + 40);
      pop();

      // Region
      fill(unlocked ? [140, 180, 150] : [60, 60, 65]);
      textSize(14);
      text(level.menu?.areaLabel || '', x + cardW / 2, cardY + 70);

      // Description preview
      fill(unlocked ? [120, 160, 130] : [50, 50, 55]);
      smallTextSize(12);
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
        smallTextSize(12);
        text(`Best: ${PROGRESS.bestScores[level.id]} pts`,
             x + cardW / 2, cardY + cardH - 20);
      }

      this._levelCardBounds.push({
        x, y: cardY, w: cardW, h: cardH,
        levelId: level.id, unlocked
      });
    }

    fill(CACHED_COLORS.menuFooter);
    smallTextSize(11);
    text(`Version: ${CONFIG.version}`, centerX, ch - 40);
  }
  
  renderLoading() {
    const cw = CONFIG.canvasWidth;
    const ch = CONFIG.canvasHeight;
    const centerX = cw * 0.5;
    const centerY = ch * 0.5;

    fill(CACHED_COLORS.menuBg);
    noStroke();
    rect(0, 0, cw, ch);

    textAlign(CENTER, CENTER);

    fill(CACHED_COLORS.menuTitle);
    textSize(42);
    push(); textFont(FreckleFace);
    text(this.currentLevel?.name || "Loading", centerX, centerY - 40);
    pop();

    fill(CACHED_COLORS.menuSubtitle);
    textSize(18);
    text("Preparing the ecosystem...", centerX, centerY + 20);
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
    push(); textFont(FreckleFace);
    text(menu.title || "Avian Age", centerX, centerY - 300);
    pop();

    fill(CACHED_COLORS.menuSubtitle);
    textSize(20);
    text(menu.subtitle || "A New Zealand Ecosystem Strategy Game",
         centerX, centerY - 240);

    // Plants — from level def, arranged in two vertical columns (one each side
    // of the featured species) so their descriptions stack vertically instead
    // of colliding horizontally, keeping the central level info uncluttered.
    const displayPlants = menu.displayPlants || [];
    const plantY = centerY - 80;
    const spriteSize = 64;

    const midpoint = Math.ceil(displayPlants.length / 2);
    const leftPlants = displayPlants.slice(0, midpoint - 1);
    const rightPlants = displayPlants.slice(midpoint);

    // Vertical spacing per plant; shrinks so taller columns still fit the band.
    const maxCol = Math.max(leftPlants.length, rightPlants.length, 1);
    const rowSpacing = Math.min(150, 360 / Math.max(1, maxCol - 1));
    const colCenterY = centerY - 40;
    const leftColX = cw * 0.16;
    const rightColX = cw * 0.84;

    const placeColumn = (plants, colX) => {
      const firstY = colCenterY - (plants.length - 1) * rowSpacing / 2;
      for (let i = 0; i < plants.length; i++) {
        this._renderMenuPlant(colX, firstY + i * rowSpacing, plants[i], spriteSize);
      }
    };
    placeColumn(leftPlants, leftColX);
    placeColumn(rightPlants, rightColX);

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
    push(); textFont(FreckleFace);
    text("Start Level", centerX, btnY + btnH * 0.5);
    pop();

    // Terrain resolution slider (same width as Start Level button)
    const sliderW = btnW;
    const sliderX = btnX;
    const sliderY = btnY + btnH + 18;
    const trackPad = 16;
    const trackY = sliderY + 22;
    const opts = TERRAIN_DETAIL_OPTIONS;

    let selIdx = 0;
    for (let i = 0; i < opts.length; i++) {
      if (CONFIG.pixelScale === opts[i].pixelScale &&
          CONFIG.terrainDetail === opts[i].detail) selIdx = i;
    }

    fill(CACHED_COLORS.menuText);
    noStroke();
    smallTextSize(12);
    text("[TERRAIN RESOLUTION]", centerX, sliderY + 4);

    // Track
    stroke(CACHED_COLORS.btnStroke);
    strokeWeight(3);
    line(sliderX + trackPad, trackY, sliderX + sliderW - trackPad, trackY);

    // Ticks + labels
    const stepW = (sliderW - trackPad * 2) / (opts.length - 1);
    for (let i = 0; i < opts.length; i++) {
      const tx = sliderX + trackPad + i * stepW;
      stroke(CACHED_COLORS.btnStroke);
      strokeWeight(2);
      line(tx, trackY - 5, tx, trackY + 5);
      noStroke();
      fill(i === selIdx ? [200, 240, 210] : CACHED_COLORS.menuText);
      smallTextSize(12);
      text(opts[i].label, tx, trackY + 18);
    }

    // Handle
    const hx = sliderX + trackPad + selIdx * stepW;
    fill(CACHED_COLORS.btnNormal);
    stroke(200, 240, 210);
    strokeWeight(2);
    ellipse(hx, trackY, 16, 16);
    noStroke();

    this._detailSliderBounds = {
      x: sliderX, y: sliderY, w: sliderW, h: trackY + 12 - sliderY,
      trackPad, stepW
    };

    // Back button
    const backW = 120, backH = 40;
    const backX = centerX - backW / 2;
    const backY = trackY + 48;
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
      smallTextSize(10);
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
    smallTextSize(11);
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
    smallTextSize(12);
    
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
  
  // Visuals for the touch-and-hold move: a filling progress ring while the
  // press is held, then a dashed marker on the lifted item plus a validity
  // ghost that follows the cursor until the drop click.
  renderMovePreview() {
    const hc = this._holdCandidate;
    if (hc && hc.p.alive) {
      const prog = constrain(hc.heldFrames / 60, 0, 1);
      push();
      translate(hc.p.pos.x, this._groundPaintY(hc.p.pos.x, hc.p.pos.y));
      noFill();
      stroke(255, 255, 255, 90);
      strokeWeight(3);
      ellipse(0, 0, 34, 34);
      stroke(180, 240, 200, 230);
      arc(0, 0, 34, 34, -HALF_PI, -HALF_PI + prog * TWO_PI);
      pop();
      return;
    }

    const p = this.movingPlaceable;
    if (!p || !p.alive) return;
    const def = (this.activePlaceables && this.activePlaceables[p.type]) || p.def;

    // Dashed ring on the item being moved
    push();
    translate(p.pos.x, this._groundPaintY(p.pos.x, p.pos.y));
    noFill();
    stroke(255, 255, 255, 120 + sin(frameCount * 0.15) * 60);
    strokeWeight(2);
    drawingContext.setLineDash([6, 6]);
    ellipse(0, 0, 40, 40);
    drawingContext.setLineDash([]);
    pop();

    // Cursor ghost with validity tint
    if (!this.isInGameArea(mouseX, mouseY)) return;
    const { x: tx, y: ty } = this._pointerWorld(mouseX, mouseY);
    if (tx < 0 || tx > this.terrain.mapWidth || ty < 0 || ty > this.terrain.mapHeight) return;

    const spacingCheck = this.canPlaceWithSpacing(tx, ty, p.type, p);
    let biomeOk = true;
    if (def.allowedBiomes) biomeOk = def.allowedBiomes.includes(this.terrain.getBiomeAt(tx, ty).key);
    const ok = this.terrain.canPlace(tx, ty) && spacingCheck.allowed && biomeOk;

    push();
    translate(tx, this._groundPaintY(tx, ty));
    noFill();
    stroke(ok ? CACHED_COLORS.placementValid : CACHED_COLORS.placementInvalid);
    strokeWeight(1);
    ellipse(0, 0, def.radius * 2, def.radius * 2);
    const col = def._parsedColor;
    if (col) fill(red(col), green(col), blue(col), ok ? 150 : 80);
    else fill(150, 200, 160, ok ? 150 : 80);
    stroke(ok ? CACHED_COLORS.placementValidStrong : CACHED_COLORS.placementInvalidStrong);
    strokeWeight(2);
    ellipse(0, 0, 18, 18);
    pop();
  }

  renderPlacementPreview() {
    // Global one-shot interactables (Mast Year) place nothing on the map — no ghost.
    const _gdef = this.activePlaceables && this.activePlaceables[this.selectedPlaceable];
    if (_gdef && _gdef.global) return;
    if (!this.isInGameArea(mouseX, mouseY)) return;
    
    const { x: tx, y: ty } = this._pointerWorld(mouseX, mouseY);
    
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
    translate(tx, this._groundPaintY(tx, ty));
    
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
          this._startLoading();  // Start playing with the benchmark recording
          return;
        }
      }
      if (CONFIG.debugMode && this._bench5BtnBounds) {
        const btn = this._bench5BtnBounds;
        if (mx > btn.x && mx < btn.x + btn.w &&
            my > btn.y && my < btn.y + btn.h) {
          BENCHMARK.armBatch(5);   // five unattended runs, one CSV each
          this._startLoading();
          return;
        }
      }
      if (this._menuBtnBounds) {
        const btn = this._menuBtnBounds;
        if (mx > btn.x && mx < btn.x + btn.w &&
            my > btn.y && my < btn.y + btn.h) {
          this._startLoading();  // Start playing
          return;
        }
      }
      if (this._detailSliderBounds) {
        const s = this._detailSliderBounds;
        if (mx > s.x && mx < s.x + s.w &&
            my > s.y && my < s.y + s.h) {
          const t = (mx - (s.x + s.trackPad)) / s.stepW;
          const idx = Math.max(0, Math.min(TERRAIN_DETAIL_OPTIONS.length - 1,
                                           Math.round(t)));
          CONFIG.pixelScale = TERRAIN_DETAIL_OPTIONS[idx].pixelScale;
          CONFIG.terrainDetail = TERRAIN_DETAIL_OPTIONS[idx].detail;
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

    if (this.isInGameArea(mx, my)) {
      const { x: tx, y: ty } = this._pointerWorld(mx, my);

      if (this.movingPlaceable) { this.tryDropMove(tx, ty); return; }
      if (this.selectedPlaceable) { this.tryPlace(tx, ty); return; }

      // Nothing selected: pressing near a placed item's center arms a
      // touch-and-hold — held ~1s it becomes a move (see updateHoldToMove).
      const held = this.simulation &&
        this.simulation.getClosestPlaceable(tx, ty, 26, (pl) => pl.alive);
      if (held) {
        this._holdCandidate = { p: held, heldFrames: 0, startMX: mx, startMY: my };
      }
    }
  }
  
  handleKey(key) {

      if (key === 'r' || key === 'R') {
      if (this.state === GAME_STATE.WON || this.state === GAME_STATE.LOST) {
        this.state = GAME_STATE.LEVEL_SELECT;
      } else if (this.currentLevel) {
        this.loadLevel(this.currentLevel.id);  // Restart current level
        this._startLoading();
      }
      return;
    }

    if (key === 'd' || key === 'D') { CONFIG.debugMode = !CONFIG.debugMode; return; }

    if ((key === 'f' || key === 'F') &&
        (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED)) {
      this.toggleFullscreen();
      return;
    }

    if ((key === 'v' || key === 'V') &&
        (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.PAUSED)) {
      this.toggleView3D();
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
          this.cancelMove();
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

  // Flighted birds — each its own base type + list (Simulation.otherEntities[key]),
  // seeded per level via initialEntityCounts and bred emergently, the way the moa
  // are seeded (see mauri_kereru.js / mauri_kokako.js). kea / kākā / kākāpō extend
  // the same Kereru base later.
  if (typeof Kereru !== 'undefined') {
    REGISTRY.registerAnimalType('kereru', {}, Kereru);
    REGISTRY.registerSpecies('kereru', 'kereru', KERERU_SPECIES);
  }
  if (typeof Kokako !== 'undefined') {
    REGISTRY.registerAnimalType('kokako', {}, Kokako);
    REGISTRY.registerSpecies('kokako', 'kokako', KOKAKO_SPECIES);
  }

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
    smallTextSize(10);
    text(`Update: ${(t1-t0).toFixed(1)}ms`, 85, 38);
    text(`Render: ${(t2-t1).toFixed(1)}ms`, 85, 52);
    text(`Canvas: ${CONFIG.canvasWidth}×${CONFIG.canvasHeight}`, 85, 70);
    text(`Version: ${CONFIG.version}`, 85, 84);
  } else {
    game.update(deltaMultiplier);
    game.render();
  }

  // Free Play climate gauge + gamewide field guide overlay (screen space, on top).
  if (game) {
    if (game._climateCfg && typeof game._renderClimateGauge === 'function') game._renderClimateGauge();
    if (game.encyclopedia && game.encyclopedia.open) game.encyclopedia.render(game);
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
  smallTextSize(12);
  textAlign(LEFT, CENTER);
  textFont('monospace');
  text(`FPS: ${currentFPS.toFixed(1)}`, 10, 15);
  pop();
}

function mousePressed() {
  if (game && game.encyclopedia && game.encyclopedia.open) { game.encyclopedia.handleClick(mouseX, mouseY); return; }
  game.handleClick(mouseX, mouseY);
}
function keyPressed() {
  // Gamewide field guide: E toggles it, and it swallows keys while open (modal).
  if (game && game.encyclopedia && game.encyclopedia.handleGlobalKey(key, game)) return;
  game.handleKey(key);
}
function mouseWheel(e) {
  if (game && game.encyclopedia && game.encyclopedia.open) { game.encyclopedia.handleWheel(e.delta); return false; }
}