function preload(){
  openDyslexic = loadFont('typefaces/OpenDyslexic-Regular.otf');
  openDyslexic_B = loadFont('typefaces/OpenDyslexic-Bold.otf');
  openDyslexic_I = loadFont('typefaces/OpenDyslexic-Italic.otf');
  openDyslexic_B_I = loadFont('typefaces/OpenDyslexic-BoldItalic.otf')
  GroceryRounded = loadFont('typefaces/GroceryRounded.ttf')
}



// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  width: 1280,
  height: 720,
  pixelScale: 2,
  zoom: 2,
  debugMode: false,
  col_UI: [40,70,30,180],
  
  // Noise settings
  noiseScale: 0.006,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  
  // Terrain shaping
  ridgeInfluence: 1.35,
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
  startingSpecies: 'upland_moa',
  
  // Plants
  plantDensity: 0.003,
  
  // Game settings
  startingMauri: 30,
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
  eagleSpawnMilestones: [10, 15, 20, 25, 35, 45, 55] // Spawn eagle at these moa populations
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
    duration: 1200, 
    minSpacing: 30,        // Minimum distance from other placeables
    ignoresSpacing: false,
    
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
    minSpacing: 30,        
    ignoresSpacing: false,
    
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
    minSpacing: 20,        
    ignoresSpacing: false,
    
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
    minSpacing: 0,        
    ignoresSpacing: true,
    
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
    minSpacing: 30,        
    ignoresSpacing: false,
    
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
    minSpacing: 30,        
    ignoresSpacing: false,
    
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
      this.onSeasonChange();
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

  onSeasonChange() {
    const season = this.seasonManager.current;
    
    // Basic season change notification
    this.addNotification(`Season changed to ${season.name} ${season.icon}`, 'info');
    
    // Get migration messages for species in simulation
    const aliveMoas = this.simulation.moas.filter(m => m.alive);
    const migrationMessages = this.seasonManager.getMigrationMessages(aliveMoas);
    
    // Show current migration status
    if (migrationMessages.current) {
      // Slight delay so messages don't all appear at once
      setTimeout(() => {
        this.addNotification(migrationMessages.current, 'info');
      }, 500);
    }
    
    // Show upcoming migration hint
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
      let def = PLACEABLES[type];
      
      // Items that ignore spacing can always be placed (terrain permitting)
      if (def.ignoresSpacing) {
        return { allowed: true };
      }
      
      let mySpacing = def.minSpacing || 40;
      
      // Check against all existing placeables
      for (let p of this.simulation.placeables) {
        if (!p.alive) continue;
        
        let otherDef = PLACEABLES[p.type];
        
        // Skip if the other placeable ignores spacing
        if (otherDef.ignoresSpacing) continue;
        
        let otherSpacing = otherDef.minSpacing || 40;
        
        // Required distance is the average of both spacing requirements
        let requiredDist = (mySpacing + otherSpacing) / 2;
        
        let dist = p5.Vector.dist(createVector(x, y), p.pos);
        
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
      
      let def = PLACEABLES[this.selectedPlaceable];
      
      // Check terrain placement
      if (!this.terrain.canPlace(x, y)) {
        this.addNotification("Cannot place here!", 'error');
        return false;
      }
      
      // Check spacing with other placeables
      let spacingCheck = this.canPlaceWithSpacing(x, y, this.selectedPlaceable);
      if (!spacingCheck.allowed) {
        this.addNotification(spacingCheck.reason, 'error');
        return false;
      }
      
      // Check cost
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
    
    renderPlacementPreview() {
      let tx = mouseX / CONFIG.zoom;
      let ty = mouseY / CONFIG.zoom;
      
      if (tx < 0 || tx > this.terrain.mapWidth || ty < 0 || ty > this.terrain.mapHeight) return;
      
      let def = PLACEABLES[this.selectedPlaceable];
      let canPlaceTerrain = this.terrain.canPlace(tx, ty);
      let spacingCheck = this.canPlaceWithSpacing(tx, ty, this.selectedPlaceable);
      let canPlace = canPlaceTerrain && spacingCheck.allowed;
      
      push();
      translate(tx, ty);
      
      // Main radius indicator
      noFill();
      stroke(canPlace ? color(100, 255, 100, 100) : color(255, 100, 100, 100));
      strokeWeight(1);
      ellipse(0, 0, def.radius * 2, def.radius * 2);
      
      // Show spacing radius if item requires spacing
      if (!def.ignoresSpacing) {
        let spacingRadius = def.minSpacing || 40;
        stroke(canPlace ? color(100, 200, 255, 60) : color(255, 150, 100, 80));
        strokeWeight(1);
        drawingContext.setLineDash([4, 4]);
        ellipse(0, 0, spacingRadius * 2, spacingRadius * 2);
        drawingContext.setLineDash([]);
      }
      
      // Main placement indicator
      let col = color(def.color);
      fill(red(col), green(col), blue(col), canPlace ? 150 : 80);
      stroke(canPlace ? color(100, 255, 100, 200) : color(255, 100, 100, 200));
      strokeWeight(2);
      ellipse(0, 0, 18, 18);
      
      // Show blocking indicator
      if (!spacingCheck.allowed && spacingCheck.blocker) {
        pop();
        
        // Draw line to blocking placeable
        push();
        stroke(255, 100, 100, 150);
        strokeWeight(1);
        drawingContext.setLineDash([3, 3]);
        line(tx, ty, spacingCheck.blocker.pos.x, spacingCheck.blocker.pos.y);
        drawingContext.setLineDash([]);
        
        // Highlight the blocker
        noFill();
        stroke(255, 100, 100, 200);
        strokeWeight(2);
        let blockerRadius = spacingCheck.blocker.radius;
        ellipse(spacingCheck.blocker.pos.x, spacingCheck.blocker.pos.y, blockerRadius * 2 + 10, blockerRadius * 2 + 10);
        pop();
      } else {
        pop();
      }
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
    push();
    textFont(GroceryRounded);
    text("MAURI", CONFIG.width / 2, 100);
    pop();
    
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
    ellipse(3, -3, 7, 5);
    fill(185, 170, 140);
    triangle(5, -5, 10, -2, 6, -2);
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
    textSize(24);
    push();
    textFont(GroceryRounded);
    text("Start Level", CONFIG.width / 2, btnY + btnH / 2);
    pop();
    
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
    //fill(0, 0, 0, 150);
    //rect(0, 0, CONFIG.width, CONFIG.height);
    
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

    if (key === 'd' || key === 'D') {
      if (!CONFIG.debugMode){
        CONFIG.debugMode = true;
      } else {
        CONFIG.debugMode = false;
      }
      return;
    }
    
    if (this.state === GAME_STATE.PLAYING) {
      if (key === 'p' || key === 'P' || key === ' ') {
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
  // global typeface font
  textFont('OpenDyslexic');
  
  initializeRegistry();
  
  game = new Game();
}

function initializeRegistry() {
  // Register base animal types
  REGISTRY.registerAnimalType('moa', {}, Moa);
  REGISTRY.registerAnimalType('eagle', {}, HaastsEagle);
  
  // Register all moa species
  for (const [key, config] of Object.entries(MOA_SPECIES)) {
    REGISTRY.registerSpecies(key, 'moa', config);
  }
  
  // Register all eagle species
  for (const [key, config] of Object.entries(EAGLE_SPECIES)) {
    REGISTRY.registerSpecies(key, 'eagle', config);
  }
  
  // Register plants
  for (const [key, config] of Object.entries(PLANT_TYPES)) {
    REGISTRY.registerPlant(key, config);
  }
  
  // Register placeables
  for (const [key, config] of Object.entries(PLACEABLES)) {
    REGISTRY.registerPlaceable(key, config);
  }
  
  // Register biomes
  for (const [key, config] of Object.entries(BIOMES)) {
    REGISTRY.registerBiome(key, config);
  }
  
  // Validate everything is properly linked
  const issues = REGISTRY.validate();
  if (issues.length > 0) {
    console.warn('Registry validation found issues:', issues);
  }
  
  console.log('Registry initialized:', REGISTRY.getSummary());
}

function draw() {
  game.update();
  game.render();
  //filter(POSTERIZE, 16);
}

function mousePressed() {
  game.handleClick(mouseX, mouseY);
}

function keyPressed() {
  game.handleKey(key);
}