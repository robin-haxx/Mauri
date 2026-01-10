// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  width: 1920,
  height: 1080,
  pixelScale: 2,
  zoom: 2,
  
  // Noise settings
  noiseScale: 0.006,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  
  // Terrain shaping
  ridgeInfluence: 0.35,
  elevationPower: 1.2,
  islandFalloff: 0.6, 
  
  // Display
  showContours: true,
  contourInterval: 0.05,
  showLabels: false,
  showDebug: false,
  showHungerBars: true,
  
  // Starting conditions
  initialMoaCount: 6,
  maxMoaPopulation: 60,
  eagleCount: 2,
  
  // Plants
  plantDensity: 0.004,
  
  // Game settings
  startingMauri: 0,
  targetPopulation: 30,
  survivalTimeGoal: 3600,
  
  // Reproduction tuning
  eggIncubationTime: 500,
  securityTimeToLay: 900,
  securityTimeVariation: 400, 
  layingHungerThreshold: 28,
  
  // Seasons
  seasonDuration: 1500, 
  
  // Eagle spawning
  eagleSpawnMilestones: [15, 25, 40] // Spawn eagle at these moa populations
};



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
    duration: 1800, 
    
    // Feeding zone properties
    feedingRate: 0.2,           // Hunger reduced per frame while inside
    baseFeedingRate: 0.2,
    plantSpawnCount: 5,         // Spawns temporary plants
    plantType: 'kawakawa',      // Custom plant type
    
    // Seasonal effectiveness (multiplier when this biome's natural food is scarce)
    seasonalBonus: {
      summer: 1.5,   // Good in summer when lowlands are dry
      autumn: 1.0,
      winter: 0.8,   // Less effective in winter
      spring: 1.2
    },
    
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
    
    // Small feeding benefit too
    feedingRate: 0.05,
    baseFeedingRate: 0.05,
    
    seasonalBonus: {
      summer: 1.0,
      autumn: 1.0,
      winter: 1.3,  // Better shelter in winter
      spring: 1.0
    }
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
    
    seasonalBonus: {
      summer: 0.8,
      autumn: 1.0,
      winter: 0.6,   // Hard to nest in winter
      spring: 1.5    // Best nesting in spring
    }
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
    
    seasonalBonus: {
      summer: 1.0,
      autumn: 1.0,
      winter: 1.2,   // Eagles hungrier in winter, more distractible
      spring: 1.0
    }
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
    hungerSlowdown: 0.4,        // 40% hunger rate while inside
    feedingRate: 0.1,           // Small passive feeding
    baseFeedingRate: 0.1,
    attractsMoa: true,
    attractionStrength: 1.2,
    
    seasonalBonus: {
      summer: 2.0,   // Critical in summer
      autumn: 1.0,
      winter: 0.5,   // Frozen in winter
      spring: 1.2
    }
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
    
    feedingRate: 0.15,
    baseFeedingRate: 0.15,
    plantSpawnCount: 3,
    plantType: 'flax',
    
    securityBonus: 1.4,
    
    seasonalBonus: {
      summer: 1.3,
      autumn: 1.5,   // Flax fruits in autumn
      winter: 0.7,
      spring: 1.0
    },
    
    attractsHungryMoa: true,
    attractionStrength: 1.2
  }
};

// ============================================
// BIOME DEFINITIONS
// ============================================
const BIOMES = {
  sea: {
    key: 'sea',
    name: "Sea",
    minElevation: 0,
    maxElevation: 0.12,
    colors: ['#1a3a52', '#1e4d6b', '#236384'],
    contourColor: '#0f2533',
    walkable: false,
    canHavePlants: false,
    canPlace: false
  },
  coastal: {
    key: 'coastal',
    name: "Coastal/Beach",
    minElevation: 0.12,
    maxElevation: 0.15,
    colors: ['#c2b280', '#d4c794', '#e6dca8'],
    contourColor: '#8a7d5a',
    walkable: true,
    canHavePlants: false,
    canPlace: true
  },
  grassland: {
    key: 'grassland',
    name: "Lowland Grassland",
    minElevation: 0.15,
    maxElevation: 0.3,
    colors: ['#7fb069', '#8fbc79', '#9fc889'],
    contourColor: '#5a7d4a',
    walkable: true,
    canHavePlants: true,
    plantTypes: ['tussock', 'flax'],
    canPlace: true
  },
  podocarp: {
    key: 'podocarp',
    name: "Podocarp Forest",
    minElevation: 0.3,
    maxElevation: 0.45,
    colors: ['#2d5a3d', '#346644', '#3b724b'],
    contourColor: '#1e3d29',
    walkable: true,
    canHavePlants: true,
    plantTypes: ['fern', 'rimu'],
    canPlace: true
  },
  montane: {
    key: 'montane',
    name: "Montane Forest",
    minElevation: 0.45,
    maxElevation: 0.56,
    colors: ['#4a7c59', '#528764', '#5a926f'],
    contourColor: '#335740',
    walkable: true,
    canHavePlants: true,
    plantTypes: ['beech', 'fern'],
    canPlace: true
  },
  subalpine: {
    key: 'subalpine',
    name: "Subalpine Tussock",
    minElevation: 0.56,
    maxElevation: 0.70,
    colors: ['#a8a060', '#b5ad6d', '#c2ba7a'],
    contourColor: '#7a7445',
    walkable: true,
    canHavePlants: true,
    plantTypes: ['tussock'],
    canPlace: true
  },
  alpine: {
    key: 'alpine',
    name: "Alpine Rock",
    minElevation: 0.70,
    maxElevation: 0.84,
    colors: ['#8b8b8b', '#9a9a9a', '#a9a9a9'],
    contourColor: '#5c5c5c',
    walkable: false,
    canHavePlants: false,
    canPlace: false
  },
  snow: {
    key: 'snow',
    name: "Permanent Snow",
    minElevation: 0.84,
    maxElevation: 1.0,
    colors: ['#e8e8e8', '#f0f0f0', '#ffffff'],
    contourColor: '#b0b0b0',
    walkable: false,
    canHavePlants: false,
    canPlace: false
  }
};

// ============================================
// PLANT DEFINITIONS
// ============================================
const PLANT_TYPES = {
  tussock: { name: "Tussock", nutrition: 25, color: '#8ea040', size: 12, growthTime: 200 },
  flax: { name: "Flax", nutrition: 35, color: '#487020', size: 20, growthTime: 280 },
  fern: { name: "Fern", nutrition: 30, color: '#228B22', size: 18, growthTime: 240 },
  rimu: { name: "Rimu Fruit", nutrition: 50, color: '#8B0000', size: 14, growthTime: 400 },
  beech: { name: "Beech Mast", nutrition: 40, color: '#8b430f', size: 16, growthTime: 350 },
  kawakawa: { name: "Kawakawa", nutrition: 40, color: '#3d9a5e', size: 11, growthTime: 150 }
};

// ============================================
// MAURI MANAGER
// ============================================
class MauriManager {
  constructor(startingAmount) {
    this.mauri = startingAmount;
    this.totalEarned = 0;
    this.totalSpent = 0;
    
    // Earning rates
    this.perMoaPerSecond = 0;
    this.onMoaEat = 1;
    this.onEggLaid = 5;
    this.onEggHatch = 10;
    this.onMoaThriving = 0.1;
    this.populationMilestoneBonus = 50;

    this.eatMauriThreshold = 50; 
    this.floatingTexts = [];
    this.lastMilestone = 0;
    this.eagleSpawnedAt = [];
  }
  
  earn(amount, x, y, reason) {
    this.mauri += amount;
    this.totalEarned += amount;
    
    if (x !== undefined && y !== undefined) {
      this.floatingTexts.push({
        text: `+${amount.toFixed(0)}`,
        x: x,
        y: y,
        life: 60,
        maxLife: 60,
        color: color(100, 220, 100)
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
    // Population milestones for mauri bonus
    const mauriMilestones = [10, 15, 20, 25, 30, 40, 50];
    for (let m of mauriMilestones) {
      if (moaCount >= m && this.lastMilestone < m) {
        this.lastMilestone = m;
        this.earn(this.populationMilestoneBonus, CONFIG.width / 2 / CONFIG.zoom, 50, 'milestone');
        game.addNotification(`Population milestone: ${m} moa! +${this.populationMilestoneBonus} mauri`, 'success');
      }
    }
    
    // Eagle spawn milestones
    for (let threshold of CONFIG.eagleSpawnMilestones) {
      if (moaCount >= threshold && !this.eagleSpawnedAt.includes(threshold)) {
        this.eagleSpawnedAt.push(threshold);
        simulation.spawnEagle();
        game.addNotification(`A new Haast's Eagle has arrived!`, 'error');
        return threshold;
      }
    }
    
    return null;
  }
  
  updateFloatingTexts() {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      let ft = this.floatingTexts[i];
      ft.life--;
      ft.y -= 0.5;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }
  
  renderFloatingTexts() {
    for (let ft of this.floatingTexts) {
      let alpha = (ft.life / ft.maxLife) * 255;
      fill(red(ft.color), green(ft.color), blue(ft.color), alpha);
      noStroke();
      textSize(10);
      textAlign(CENTER, CENTER);
      text(ft.text, ft.x, ft.y);
    }
  }
}



// ============================================
// GAME MANAGER
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
      { name: "Reach 10 moa", condition: () => this.simulation?.getMoaPopulation() >= 10, reward: 50, achieved: false },
      { name: "Hatch 10 eggs", condition: () => this.simulation?.stats.births >= 10, reward: 100, achieved: false },
      { name: "Reach 20 moa", condition: () => this.simulation?.getMoaPopulation() >= 20, reward: 50, achieved: false },
      { name: "Survive 3 minutes", condition: () => this.playTime >= 10800, reward: 100, achieved: false },
      { name: "Reach 30 moa", condition: () => this.simulation?.getMoaPopulation() >= 30, reward: 100, achieved: false }
    ];
    
    this.notifications = [];
    this.gameOverReason = '';
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
    
    for (let goal of this.goals) {
      goal.achieved = false;
    }
  }
  
  update() {
    if (this.state !== GAME_STATE.PLAYING) return;
    
    this.playTime++;
    this.maxPlayTime = max(this.maxPlayTime, this.playTime);
    
    // Update season
    let seasonChanged = this.seasonManager.update();
    if (seasonChanged) {
      this.addNotification(`Season changed to ${this.seasonManager.current.name} ${this.seasonManager.current.icon}`, 'info');
      this.addNotification(this.seasonManager.current.description, 'info');
    }
    
    this.simulation.update(this.mauri);
    
    
    // Passive mauri income
    if (frameCount % 60 === 0) {
      let aliveMoas = this.simulation.getMoaPopulation();
      let income = aliveMoas * this.mauri.perMoaPerSecond;
      
      let thrivingMoas = this.simulation.moas.filter(m => m.alive && m.hunger < 20).length;
      income += thrivingMoas * this.mauri.onMoaThriving;
      
      if (income > 0) {
        this.mauri.earn(income, undefined, undefined, 'passive');
      }
    }
    
    this.checkGoals();
    
    // Check milestones (including eagle spawning)
    let moaCount = this.simulation.moas.filter(m => m.alive).length;
    this.mauri.checkMilestones(moaCount, this.simulation, this);
    
    if (this.simulation.getMoaPopulation() === 0 && this.simulation.eggs.filter(e => e.alive).length === 0) {
      this.state = GAME_STATE.LOST;
      this.gameOverReason = "All moa have perished!";
    }
    
    this.mauri.updateFloatingTexts();
    this.updateNotifications();
  }
  
  checkGoals() {
    for (let goal of this.goals) {
      if (!goal.achieved && goal.condition()) {
        goal.achieved = true;
        this.mauri.earn(goal.reward, CONFIG.width / 2 / CONFIG.zoom, 80, 'goal');
        this.addNotification(`Goal achieved: ${goal.name}! +${goal.reward} mauri`, 'success');
      }
    }
    
    let allGoalsAchieved = this.goals.every(g => g.achieved);
    if (allGoalsAchieved) {
      this.state = GAME_STATE.WON;
    }
  }
  
  addNotification(text, type = 'info') {
    this.notifications.push({
      text: text,
      type: type,
      life: 300,
      maxLife: 300
    });
    
    if (this.notifications.length > 5) {
      this.notifications.shift();
    }
  }
  
  updateNotifications() {
    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].life--;
      if (this.notifications[i].life <= 0) {
        this.notifications.splice(i, 1);
      }
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
  
  tryPlace(x, y) {
    if (!this.selectedPlaceable) return false;
    
    let def = PLACEABLES[this.selectedPlaceable];
    
    if (!this.terrain.canPlace(x, y)) {
      this.addNotification("Cannot place here!", 'error');
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
    fill(25, 35, 30);
    rect(0, 0, CONFIG.width, CONFIG.height);
    
    textAlign(CENTER, CENTER);
    fill(180, 220, 180);
    textSize(48);
    text("MAURI", CONFIG.width / 2, 100);
    
    fill(140, 180, 140);
    textSize(16);
    text("A New Zealand Ecosystem Strategy Game", CONFIG.width / 2, 145);
    
    // Moa illustration
    push();
    translate(CONFIG.width / 2, 240);
    scale(4);
    noStroke();
    fill(101, 67, 33);
    ellipse(0, 0, 8, 11);
    ellipse(0, -6, 5, 7);
    fill(85, 70, 40);
    triangle(0, -11, -2, -8, 2, -8);
    stroke(55, 38, 20);
    strokeWeight(1.5);
    line(-3, 5, -4, 12);
    line(3, 5, 4, 12);
    pop();
    
    fill(160, 180, 160);
    textSize(13);
    let instructions = [
      "Guide the Upland Moa through the seasons",
      "Place food sources, shelters, and nesting sites",
      "Moa migrate between highlands and lowlands seasonally",
      "Earn mauri by keeping your moa population thriving",
      "Beware: More moa attracts more Haast's Eagles!"
    ];
    
    for (let i = 0; i < instructions.length; i++) {
      text(instructions[i], CONFIG.width / 2, 350 + i * 22);
    }
    
    // Season preview
    fill(120, 150, 130);
    textSize(11);
    text("Seasons: ☀️ Summer (upland) → 🍂 Autumn → ❄️ Winter (lowland) → 🌸 Spring", CONFIG.width / 2, 480);
    
    let btnX = CONFIG.width / 2 - 80;
    let btnY = 520;
    let btnW = 160;
    let btnH = 50;
    
    let hover = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
    
    fill(hover ? color(80, 140, 80) : color(60, 120, 60));
    stroke(100, 160, 100);
    strokeWeight(2);
    rect(btnX, btnY, btnW, btnH, 10);
    
    fill(255);
    noStroke();
    textSize(20);
    text("Start Game", CONFIG.width / 2, btnY + btnH / 2);
    
    fill(100, 120, 100);
    textSize(10);
    text("Inspired by Equilinox • Upland Moa & Haast's Eagle", CONFIG.width / 2, CONFIG.height - 30);
  }
  
  renderPlacementPreview() {
    let tx = mouseX / CONFIG.zoom;
    let ty = mouseY / CONFIG.zoom;
    
    if (tx < 0 || tx > this.terrain.mapWidth || ty < 0 || ty > this.terrain.mapHeight) return;
    
    let def = PLACEABLES[this.selectedPlaceable];
    let canPlace = this.terrain.canPlace(tx, ty);
    
    push();
    translate(tx, ty);
    
    noFill();
    stroke(canPlace ? color(100, 255, 100, 100) : color(255, 100, 100, 100));
    strokeWeight(1);
    ellipse(0, 0, def.radius * 2, def.radius * 2);
    
    let col = color(def.color);
    fill(red(col), green(col), blue(col), canPlace ? 150 : 80);
    stroke(canPlace ? color(100, 255, 100, 200) : color(255, 100, 100, 200));
    strokeWeight(2);
    ellipse(0, 0, 18, 18);
    
    pop();
  }
  
  renderNotifications() {
    let y = 100;
    
    for (let notif of this.notifications) {
      let alpha = min(255, notif.life * 2);
      
      let bgColor, textColor;
      switch (notif.type) {
        case 'success':
          bgColor = color(60, 120, 60, alpha * 0.8);
          textColor = color(180, 255, 180, alpha);
          break;
        case 'error':
          bgColor = color(120, 60, 60, alpha * 0.8);
          textColor = color(255, 180, 180, alpha);
          break;
        default:
          bgColor = color(60, 80, 100, alpha * 0.8);
          textColor = color(200, 220, 240, alpha);
      }
      
      textSize(12);
      let tw = textWidth(notif.text) + 20;
      
      fill(bgColor);
      noStroke();
      rect(CONFIG.width / 2 - tw / 2, y, tw, 24, 5);
      
      fill(textColor);
      textAlign(CENTER, CENTER);
      text(notif.text, CONFIG.width / 2, y + 12);
      
      y += 30;
    }
  }
  
  renderPauseOverlay() {
    fill(0, 0, 0, 150);
    rect(0, 0, CONFIG.width, CONFIG.height);
    
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(36);
    text("PAUSED", CONFIG.width / 2, CONFIG.height / 2 - 30);
    
    textSize(16);
    fill(200);
    text("Press P to resume or R to restart", CONFIG.width / 2, CONFIG.height / 2 + 20);
  }
  
  renderWinOverlay() {
    fill(0, 50, 0, 180);
    rect(0, 0, CONFIG.width, CONFIG.height);
    
    fill(180, 255, 180);
    textAlign(CENTER, CENTER);
    textSize(42);
    text("ECOSYSTEM THRIVING!", CONFIG.width / 2, CONFIG.height / 2 - 60);
    
    fill(150, 220, 150);
    textSize(18);
    text("All goals achieved!", CONFIG.width / 2, CONFIG.height / 2 - 10);
    
    textSize(14);
    fill(120, 180, 120);
    text(`Final population: ${this.simulation.getMoaPopulation()} moa`, CONFIG.width / 2, CONFIG.height / 2 + 30);
    text(`Total mauri earned: ${this.mauri.totalEarned.toFixed(0)}`, CONFIG.width / 2, CONFIG.height / 2 + 50);
    text(`Time survived: ${(this.playTime / 60).toFixed(0)} seconds`, CONFIG.width / 2, CONFIG.height / 2 + 70);
    
    fill(200);
    textSize(16);
    text("Press R to play again", CONFIG.width / 2, CONFIG.height / 2 + 120);
  }
  
  renderLoseOverlay() {
    fill(50, 0, 0, 180);
    rect(0, 0, CONFIG.width, CONFIG.height);
    
    fill(255, 180, 180);
    textAlign(CENTER, CENTER);
    textSize(36);
    text("EXTINCTION", CONFIG.width / 2, CONFIG.height / 2 - 60);
    
    fill(220, 150, 150);
    textSize(16);
    text(this.gameOverReason, CONFIG.width / 2, CONFIG.height / 2 - 10);
    
    textSize(14);
    fill(180, 120, 120);
    text(`Time survived: ${(this.playTime / 60).toFixed(0)} seconds`, CONFIG.width / 2, CONFIG.height / 2 + 30);
    text(`Moa hatched: ${this.simulation.stats.births}`, CONFIG.width / 2, CONFIG.height / 2 + 50);
    text(`Total mauri earned: ${this.mauri.totalEarned.toFixed(0)}`, CONFIG.width / 2, CONFIG.height / 2 + 70);
    
    fill(200);
    textSize(16);
    text("Press R to try again", CONFIG.width / 2, CONFIG.height / 2 + 120);
  }
  
  handleClick(mx, my) {
    if (this.state === GAME_STATE.MENU) {
      let btnX = CONFIG.width / 2 - 80;
      let btnY = 520;
      let btnW = 160;
      let btnH = 50;
      
      if (mx > btnX && mx < btnX + btnW && my > btnY && my < btnY + btnH) {
        this.init();
      }
      return;
    }
    
    if (this.state !== GAME_STATE.PLAYING) return;
    
    if (this.ui.handleClick(mx, my)) return;
    
    if (this.selectedPlaceable) {
      let tx = mx / CONFIG.zoom;
      let ty = my / CONFIG.zoom;
      this.tryPlace(tx, ty);
    }
  }
  
  handleKey(key) {
    if (key === 'r' || key === 'R') {
      this.init();
      return;
    }
    
    if (this.state === GAME_STATE.PLAYING) {
      if (key === 'p' || key === 'P') {
        this.state = GAME_STATE.PAUSED;
      } else if (key === 'Escape') {
        this.cancelPlacement();
      } else if (key === '1') {
        this.selectPlaceable('kawakawa');
      } else if (key === '2') {
        this.selectPlaceable('shelter');
      } else if (key === '3') {
        this.selectPlaceable('nest');
      } else if (key === '4') {
        this.selectPlaceable('decoy');
      } else if (key === '5') {
        this.selectPlaceable('waterhole');
      } else if (key === '6') {
        this.selectPlaceable('harakeke');
      } else if (key === 'h' || key === 'H') {
        CONFIG.showHungerBars = !CONFIG.showHungerBars;
      }
    } else if (this.state === GAME_STATE.PAUSED) {
      if (key === 'p' || key === 'P') {
        this.state = GAME_STATE.PLAYING;
      }
    }
  }
}

// ============================================
// SIMULATION CLASS
// ============================================
class Simulation {
  constructor(terrain, config, game, seasonManager) {
    this.terrain = terrain;
    this.config = config;
    this.game = game;
    this.seasonManager = seasonManager;
    this.moas = [];
    this.eagles = [];
    this.plants = [];
    this.eggs = [];
    this.placeables = [];
    
    this.stats = {
      births: 0,
      deaths: 0,
      starvations: 0
    };

    this.moaGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 50);
    this.eagleGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 80);
    this.plantGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 40);
    this.placeableGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 60);

  }
  
  init() {
    this.spawnPlants();
    this.spawnMoas(this.config.initialMoaCount);
    this.spawnEagles(this.config.eagleCount);
  }
  
  spawnPlants() {
    const scale = this.config.pixelScale;
    for (let row = 0; row < this.terrain.biomeMap.length; row++) {
      for (let col = 0; col < this.terrain.biomeMap[row].length; col++) {
        const biome = this.terrain.biomeMap[row][col];
        if (biome.canHavePlants && random() < this.config.plantDensity) {
          const x = col * scale + random(-scale/2, scale/2);
          const y = row * scale + random(-scale/2, scale/2);
          this.plants.push(new Plant(x, y, random(biome.plantTypes), this.terrain, biome.key));
        }
      }
    }
  }
  
  spawnMoas(count) {
    let pref = this.seasonManager.getPreferredElevation();
    for (let i = 0; i < count; i++) {
      let pos = this.findWalkablePosition(pref.min, pref.max);
      this.moas.push(new Moa(pos.x, pos.y, this.terrain, this.config));
    }
  }
  
  spawnEagles(count) {
    for (let i = 0; i < count; i++) {
      this.spawnEagle();
    }
  }
  
  spawnEagle() {
    let pos = this.findWalkablePosition(0.25, 0.7);
    let attempts = 0;
    while (attempts < 20) {
      let tooClose = this.eagles.some(e => p5.Vector.dist(pos, e.pos) < 80);
      if (!tooClose) break;
      pos = this.findWalkablePosition(0.25, 0.7);
      attempts++;
    }
    this.eagles.push(new HaastsEagle(pos.x, pos.y, this.terrain));
  }
  
  findWalkablePosition(minElev = 0.15, maxElev = 0.8) {
    let attempts = 0;
    while (attempts < 100) {
      let x = random(30, this.terrain.mapWidth - 30);
      let y = random(30, this.terrain.mapHeight - 30);
      let elev = this.terrain.getElevationAt(x, y);
      if (elev > minElev && elev < maxElev && this.terrain.isWalkable(x, y)) {
        return createVector(x, y);
      }
      attempts++;
    }
    return createVector(this.terrain.mapWidth / 2, this.terrain.mapHeight / 2);
  }
  
  addEgg(x, y) {
    let egg = new Egg(x, y, this.terrain, this.config);
    this.eggs.push(egg);
    return egg;
  }
  
  addPlaceable(x, y, type) {
    const placeable = new PlaceableObject(
      x, y, type, 
      this.terrain, 
      this,  // Pass simulation reference
      this.seasonManager
    );
    this.placeables.push(placeable);
    return placeable;
  }
  
  getMoaPopulation() {
    // add eggs to moa pop
    // + this.eggs.filter(e => e.alive && !e.hatched).length
    return this.moas.filter(m => m.alive).length;
  }

  updateSpatialGrids() {
    this.moaGrid.clear();
    this.eagleGrid.clear();
    this.plantGrid.clear();
    this.placeableGrid.clear();
    
    for (let moa of this.moas) {
      if (moa.alive) this.moaGrid.insert(moa);
    }
    for (let eagle of this.eagles) {
      this.eagleGrid.insert(eagle);
    }
    for (let plant of this.plants) {
      if (plant.alive) this.plantGrid.insert(plant);
    }
    for (let p of this.placeables) {
      if (p.alive) this.placeableGrid.insert(p);
    }
  }  
  
  update(mauri) {

    this.updateSpatialGrids();

    // Update plants with seasonal effects
    for (let plant of this.plants) {
      plant.update(this.seasonManager);
    }
    
    for (let p of this.placeables) {
      p.update();
    }
    this.placeables = this.placeables.filter(p => p.alive);
    
    for (let egg of this.eggs) {
      for (let p of this.placeables) {
        if (p.alive && p.type === 'nest' && p.isInRange(egg.pos)) {
          egg.speedBonus = max(egg.speedBonus, p.def.eggSpeedBonus);
        }
      }
      
      egg.update();
      
      if (egg.hatched && egg.alive) {
        if (this.getMoaPopulation() < this.config.maxMoaPopulation) {
          let newMoa = new Moa(egg.pos.x, egg.pos.y, this.terrain, this.config);
          newMoa.hunger = 35;
          newMoa.size = 6;
          newMoa.homeRange = egg.pos.copy();
          this.moas.push(newMoa);
          this.stats.births++;
          mauri.earn(mauri.onEggHatch, egg.pos.x, egg.pos.y, 'hatch');
          this.game.addNotification("A moa has hatched!", 'success');
        }
        egg.alive = false;
      }
    }
    this.eggs = this.eggs.filter(e => e.alive);
    
    let aliveBeforeUpdate = this.moas.filter(m => m.alive).length;
    
    for (let moa of this.moas) {
      if (moa.alive) {
        moa.behave(this.moas, this.eagles, this.plants, this.placeables, this, mauri, this.seasonManager);
        moa.update();
      }
    }
    
    let aliveAfterUpdate = this.moas.filter(m => m.alive).length;
    let newDeaths = aliveBeforeUpdate - aliveAfterUpdate;
    if (newDeaths > 0) {
      this.stats.starvations += newDeaths;
    }
    
    for (let eagle of this.eagles) {
      eagle.behave(this.moas, this.eagles, this.placeables);
      eagle.update();
    }
    
    if (frameCount % 600 === 0) {
      this.moas = this.moas.filter(m => m.alive);
    }
  }
  
  render() {
    for (let plant of this.plants) {
      plant.render();
    }
    
    for (let p of this.placeables) {
      p.render();
    }
    
    for (let egg of this.eggs) {
      egg.render();
    }
    
    for (let moa of this.moas) {
      moa.render();
    }
    
    for (let eagle of this.eagles) {
      eagle.render();
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
  textFont('Arial');
  
  game = new Game();
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