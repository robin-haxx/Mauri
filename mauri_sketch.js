let plantSprites = {};

function preload(){
  OpenDyslexic = loadFont('typefaces/OpenDyslexic.ttf');
  GroceryRounded = loadFont('typefaces/GroceryRounded.ttf');
  // Load plant sprites
  // Plants that have sprites (Kawakawa keeps procedural rendering)
  const spritePlants = ['Tussock', 'Flax', 'Fern', 'Rimu', 'Beech'];
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
  width: 1080,
  height: 720,
  pixelScale: 1,
  zoom: 2,
  debugMode: false,
  col_UI: [40,70,30,180],
  
  noiseScale: 0.005,
  octaves: 4,
  persistence: 0.4,
  lacunarity: 2.0,
  
  ridgeInfluence: 1.55,
  elevationPower: 1.8,
  islandFalloff: 0.4, 
  
  showContours: true,
  contourInterval: 0.045,
  showLabels: false,
  showDebug: false,
  showHungerBars: true,
  
  initialMoaCount: 6,
  maxMoaPopulation: 60,
  eagleCount: 2,
  startingSpecies: 'upland_moa',
  
  plantDensity: 0.003,
  
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
    seasonalBonus: { summer: 1.5, autumn: 1.0, winter: 0.8, spring: 1.2 },
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
    key: 'grassland', name: "Lowland Grassland", minElevation: 0.15, maxElevation: 0.3,
    colors: ['#7fb069', '#8fbc79', '#9fc889'], contourColor: '#5a7d4a',
    walkable: true, canHavePlants: true, plantTypes: ['tussock', 'flax'], canPlace: true
  },
  podocarp: {
    key: 'podocarp', name: "Podocarp Forest", minElevation: 0.3, maxElevation: 0.45,
    colors: ['#2d5a3d', '#346644', '#3b724b'], contourColor: '#1e3d29',
    walkable: true, canHavePlants: true, plantTypes: ['fern', 'rimu'], canPlace: true
  },
  montane: {
    key: 'montane', name: "Montane Forest", minElevation: 0.45, maxElevation: 0.56,
    colors: ['#4a7c59', '#528764', '#5a926f'], contourColor: '#335740',
    walkable: true, canHavePlants: true, plantTypes: ['beech', 'fern'], canPlace: true
  },
  subalpine: {
    key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.56, maxElevation: 0.70,
    colors: ['#a8a060', '#b5ad6d', '#c2ba7a'], contourColor: '#7a7445',
    walkable: true, canHavePlants: true, plantTypes: ['tussock'], canPlace: true
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
const PLANT_TYPES = {
  tussock: { name: "Tussock", nutrition: 25, color: '#8ea040', size: 24, growthTime: 200 },
  flax: { name: "Flax", nutrition: 35, color: '#487020', size: 26, growthTime: 280 },
  fern: { name: "Fern", nutrition: 30, color: '#228B22', size: 36, growthTime: 240 },
  rimu: { name: "Rimu Fruit", nutrition: 50, color: '#8B0000', size: 48, growthTime: 400 },
  beech: { name: "Beech Mast", nutrition: 40, color: '#8b430f', size: 52, growthTime: 350 },
  kawakawa: { name: "Kawakawa", nutrition: 40, color: '#3d9a5e', size: 22, growthTime: 150 }
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
  
  updateFloatingTexts() {
    const texts = this.floatingTexts;
    for (let i = texts.length - 1; i >= 0; i--) {
      const ft = texts[i];
      ft.life--;
      ft.y -= 0.5;
      if (ft.life <= 0) {
        // Swap with last and pop (faster than splice)
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
  
  update() {
    if (this.state !== GAME_STATE.PLAYING) return;
    
    this.playTime++;
    if (this.playTime > this.maxPlayTime) this.maxPlayTime = this.playTime;
    
    const seasonChanged = this.seasonManager.update();
    if (seasonChanged) {
      this.onSeasonChange();
    }
    
    this.simulation.update(this.mauri);
    
    // Update cached counts once per frame
    this.updateCachedCounts();
    
    // Passive mauri income (every 60 frames)
    if ((frameCount & 63) === 0) { // Bitwise AND is faster than modulo for powers of 2
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
    
    this.mauri.updateFloatingTexts();
    this.updateNotifications();
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
      life: 300,
      maxLife: 300,
      _cachedWidth: null // Will be calculated once when needed
    });
    
    if (this.notifications.length > 5) {
      this.notifications.shift();
    }
  }
  
  updateNotifications() {
    const notifs = this.notifications;
    for (let i = notifs.length - 1; i >= 0; i--) {
      notifs[i].life--;
      if (notifs[i].life <= 0) {
        notifs.splice(i, 1);
      }
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
    background(30);
    
    if (this.state === GAME_STATE.MENU) {
      this.renderMenu();
      return;
    }
    
    push();
    scale(CONFIG.zoom);
    
    this.terrain.render();
    this.simulation.render();
    this.mauri.renderFloatingTexts();
    
    if (this.selectedPlaceable && this.state === GAME_STATE.PLAYING) {
      this.renderPlacementPreview();
    }
    
    pop();
    
    this.ui.render();
    this.renderNotifications();
    
    if (this.state === GAME_STATE.PAUSED) {
      this.renderPauseOverlay();
    } else if (this.state === GAME_STATE.WON) {
      this.renderWinOverlay();
    } else if (this.state === GAME_STATE.LOST) {
      this.renderLoseOverlay();
    }
  }
  
  renderMenu() {
    fill(CACHED_COLORS.menuBg);
    rect(0, 0, CONFIG.width, CONFIG.height);
    
    const centerX = CONFIG.width * 0.5;
    
    textAlign(CENTER, CENTER);
    fill(CACHED_COLORS.menuTitle);
    textSize(48);
    push();
    textFont(GroceryRounded);
    text("MAURI", centerX, 100);
    pop();
    
    fill(CACHED_COLORS.menuSubtitle);
    textSize(16);
    text("A New Zealand Ecosystem Strategy Game", centerX, 145);
    
    // Moa illustration
    push();
    translate(centerX, 240);
    scale(4);
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
    
    fill(CACHED_COLORS.menuText);
    textSize(13);
    const instructions = [
      "Guide the Upland Moa through the seasons",
      "Place food sources, shelters, and nesting sites",
      "Moa migrate between highlands and lowlands seasonally",
      "Earn mauri by keeping your moa population thriving",
      "Beware: More moa attracts more Haast's Eagles!"
    ];
    
    for (let i = 0; i < instructions.length; i++) {
      text(instructions[i], centerX, 350 + i * 22);
    }
    
    fill(CACHED_COLORS.menuHint);
    textSize(11);
    text("Seasons: ☀️ Summer (upland) → 🍂 Autumn → ❄️ Winter (lowland) → 🌸 Spring", centerX, 480);
    
    const btnX = centerX - 80;
    const btnY = 520;
    const btnW = 160;
    const btnH = 50;
    
    const hover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
    
    fill(hover ? CACHED_COLORS.btnHover : CACHED_COLORS.btnNormal);
    stroke(CACHED_COLORS.btnStroke);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 10);
    
    fill(255);
    noStroke();
    textSize(24);
    push();
    textFont(GroceryRounded);
    text("Start Level", centerX, btnY + btnH * 0.5);
    pop();
    
    fill(CACHED_COLORS.menuFooter);
    textSize(10);
    text("Inspired by Equilinox • Upland Moa & Haast's Eagle", centerX, CONFIG.height - 30);
  }
  
  renderPlacementPreview() {
    const invZoom = 1 / CONFIG.zoom;
    const tx = mouseX * invZoom;
    const ty = mouseY * invZoom;
    
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
    
    const centerX = CONFIG.width * 0.5;
    let y = 100;
    
    textSize(12);
    
    for (let i = 0; i < notifs.length; i++) {
      const notif = notifs[i];
      const alpha = min(255, notif.life * 2);
      const alphaRatio = alpha / 255;
      
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
        notif._cachedWidth = textWidth(notif.text) + 20;
      }
      const tw = notif._cachedWidth;
      
      fill(red(bgColor), green(bgColor), blue(bgColor), alpha * 0.8);
      noStroke();
      rect(centerX - tw * 0.5, y, tw, 24, 5);
      
      fill(red(textColor), green(textColor), blue(textColor), alpha);
      textAlign(CENTER, CENTER);
      text(notif.text, centerX, y + 12);
      
      y += 30;
    }
  }
  
  renderPauseOverlay() {
    const centerX = CONFIG.width * 0.5;
    const centerY = CONFIG.height * 0.5;
    
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(36);
    text("PAUSED", centerX, centerY - 30);
    
    textSize(16);
    fill(200);
    text("Press P to resume or R to restart", centerX, centerY + 20);
  }
  
  renderWinOverlay() {
    const centerX = CONFIG.width * 0.5;
    const centerY = CONFIG.height * 0.5;
    
    fill(0, 50, 0, 180);
    rect(0, 0, CONFIG.width, CONFIG.height);
    
    fill(180, 255, 180);
    textAlign(CENTER, CENTER);
    textSize(42);
    text("ECOSYSTEM THRIVING!", centerX, centerY - 60);
    
    fill(150, 220, 150);
    textSize(18);
    text("All goals achieved!", centerX, centerY - 10);
    
    textSize(14);
    fill(120, 180, 120);
    text(`Final population: ${this._cachedMoaCount} moa`, centerX, centerY + 30);
    text(`Total mauri earned: ${this.mauri.totalEarned | 0}`, centerX, centerY + 50);
    text(`Time survived: ${(this.playTime / 60) | 0} seconds`, centerX, centerY + 70);
    
    fill(200);
    textSize(16);
    text("Press R to play again", centerX, centerY + 120);
  }
  
  renderLoseOverlay() {
    const centerX = CONFIG.width * 0.5;
    const centerY = CONFIG.height * 0.5;
    
    fill(50, 0, 0, 180);
    rect(0, 0, CONFIG.width, CONFIG.height);
    
    fill(255, 180, 180);
    textAlign(CENTER, CENTER);
    textSize(36);
    text("EXTINCTION", centerX, centerY - 60);
    
    fill(220, 150, 150);
    textSize(16);
    text(this.gameOverReason, centerX, centerY - 10);
    
    textSize(14);
    fill(180, 120, 120);
    text(`Time survived: ${(this.playTime / 60) | 0} seconds`, centerX, centerY + 30);
    text(`Moa hatched: ${this.simulation.stats.births}`, centerX, centerY + 50);
    text(`Total mauri earned: ${this.mauri.totalEarned | 0}`, centerX, centerY + 70);
    
    fill(200);
    textSize(16);
    text("Press R to try again", centerX, centerY + 120);
  }
  
  handleClick(mx, my) {
    if (this.state === GAME_STATE.MENU) {
      const btnX = CONFIG.width * 0.5 - 80;
      const btnY = 520;
      const btnW = 160;
      const btnH = 50;
      
      if (mx > btnX && mx < btnX + btnW && my > btnY && my < btnY + btnH) {
        this.init();
      }
      return;
    }
    
    if (this.state !== GAME_STATE.PLAYING) return;
    
    if (this.ui.handleClick(mx, my)) return;
    
    if (this.selectedPlaceable) {
      const invZoom = 1 / CONFIG.zoom;
      this.tryPlace(mx * invZoom, my * invZoom);
    }
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
  createCanvas(CONFIG.width, CONFIG.height);
  pixelDensity(1);
  frameRate(60);
  textFont('OpenDyslexic');
  
  // Initialize cached colors after p5 is ready
  initCachedColors();
  initPlaceableColors();
  initPlantSprites(plantSprites);

  initializeRegistry();
  
  game = new Game();
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
  game.update();
  game.render();
}

function mousePressed() {
  game.handleClick(mouseX, mouseY);
}

function keyPressed() {
  game.handleKey(key);
}