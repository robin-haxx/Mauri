// ============================================
// PLANT CLASS - Sprite-based rendering with procedural fallback
// ============================================

// Plant type constants (avoid string comparisons)
const PLANT_TYPE_ID = {
  tussock: 0,
  flax: 1,
  fern: 2,
  kawakawa: 3,
  rimu: 4,
  beech: 5
};

// Plants that use sprite rendering
const SPRITE_PLANTS = new Set(['tussock', 'flax', 'fern', 'rimu', 'beech']);

// Sprite reference - initialized from mauri_sketch.js
let PLANT_SPRITES = null;

function initPlantSprites(sprites) {
  PLANT_SPRITES = sprites;
}

// Pre-computed values shared across all plants (kept for kawakawa procedural rendering)
const PlantStatics = {
  kawakawaAngles: null,
  initialized: false,
  
  init() {
    if (this.initialized) return;
    
    // Pre-compute kawakawa angles (only plant still using procedural)
    this.kawakawaAngles = [];
    const kawaStep = TWO_PI / 5;
    for (let i = 0; i < 5; i++) {
      this.kawakawaAngles.push(i * kawaStep + 0.2);
    }
    
    this.initialized = true;
  }
};

class Plant {
  constructor(x, y, type, terrain, biomeKey) {
    // Initialize statics if needed
    PlantStatics.init();
    
    this.pos = createVector(x, y);
    this.type = type;
    this.typeId = PLANT_TYPE_ID[type] ?? 4;
    this.terrain = terrain;
    this.biomeKey = biomeKey;
    this.elevation = terrain.getElevationAt(x, y);
    
    // Check if this plant uses sprites
    this.usesSprites = SPRITE_PLANTS.has(type);
    
    const plantDef = PLANT_TYPES[type];
    this.baseNutrition = plantDef.nutrition;
    this.nutrition = plantDef.nutrition;
    this.maxNutrition = plantDef.nutrition;
    this.size = plantDef.size;
    this.baseGrowthTime = plantDef.growthTime;
    this.growthTime = plantDef.growthTime;
    
    // Parse color once and cache RGB values
    const c = color(plantDef.color);
    this.baseR = red(c);
    this.baseG = green(c);
    this.baseB = blue(c);
    
    // Current color values (modified by state)
    this.colorR = this.baseR;
    this.colorG = this.baseG;
    this.colorB = this.baseB;
    
    this.alive = true;
    this.dormant = false;
    this.dormantTimer = 0;
    this.regrowthTimer = 0;
    this.growth = 1.0;
    this.seasonalModifier = 1.0;
    
    this.isSpawned = false;
    this.parentPlaceable = null;
    
    // Pre-calculate visual variation
    this.visualOffset = random(-1, 1);
    this.swayPhase = random(TWO_PI);
    
    // Track sprite state to avoid recalculating
    this._lastSpriteState = 'mature';
    
    // Track color state to avoid recalculating
    this._lastColorState = 'normal';
    this._colorDirty = true;
  }
  
  update(seasonManager) {
    if (this.isSpawned && this.parentPlaceable) {
      if (!this.parentPlaceable.alive) {
        this.alive = false;
        return;
      }
      this.seasonalModifier = 1.2;
      this.handleGrowth();
      return;
    }
    
    const newModifier = seasonManager.getPlantModifier(this.biomeKey);
    if (Math.abs(newModifier - this.seasonalModifier) > 0.01) {
      this.seasonalModifier = newModifier;
      this._colorDirty = true;
    }
    
    this.checkDormancy(seasonManager);
    
    if (this.dormant) {
      this.handleDormancy(seasonManager);
      return;
    }
    
    this.handleGrowth();
    
    // Only update color when dirty
    if (this._colorDirty) {
      this.updateColor();
      this._colorDirty = false;
    }
  }
  
  checkDormancy(seasonManager) {
    if (this.dormant || !this.alive) return;
    
    if (seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey)) {
      const dormancyChance = seasonManager.getDormancyChance();
      
      if (seasonManager.justChanged && random() < dormancyChance) {
        this.goDormant();
      } else if (this.seasonalModifier < 0.25 && this.growth > 0.5 && random() < 0.01) {
        this.goDormant();
      }
    }
  }
  
  goDormant() {
    this.dormant = true;
    this.dormantTimer = 0;
    this.growth = this.growth * 0.3;
    if (this.growth < 0.1) this.growth = 0.1;
    this._colorDirty = true;
  }
  
  handleDormancy(seasonManager) {
    this.dormantTimer++;
    
    const shouldBeDormant = seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey);
    
    if (!shouldBeDormant && this.seasonalModifier > 0.5) {
      if (random() < 0.02) {
        this.dormant = false;
        this.growth = 0.2;
        this._colorDirty = true;
      }
    }
    
    this.nutrition = 0;
  }
  
  handleGrowth() {
    if (!this.alive) {
      const regrowthRate = this.seasonalModifier;
      this.regrowthTimer += regrowthRate;
      
      const divisor = this.seasonalModifier > 0.3 ? this.seasonalModifier : 0.3;
      this.growthTime = this.baseGrowthTime / divisor;
      
      if (this.regrowthTimer >= this.growthTime) {
        this.alive = true;
        this.growth = 0.3;
        this.regrowthTimer = 0;
        this._colorDirty = true;
      }
    } else if (this.growth < 1.0) {
      const growthRate = 0.002 * this.seasonalModifier;
      this.growth += growthRate;
      if (this.growth > 1.0) this.growth = 1.0;
      this.nutrition = this.maxNutrition * this.growth * this.seasonalModifier;
    } else {
      this.nutrition = this.maxNutrition * this.seasonalModifier;
    }
    
    this.maxNutrition = this.baseNutrition * this.seasonalModifier;
  }
  
  updateColor() {
    let newState;
    
    if (this.dormant) {
      newState = 'dormant';
    } else if (this.seasonalModifier < 0.5) {
      newState = 'wilt';
    } else if (this.seasonalModifier > 1.1) {
      newState = 'thrive';
    } else {
      newState = 'normal';
    }
    
    if (newState === this._lastColorState && !this._colorDirty) return;
    this._lastColorState = newState;
    
    if (newState === 'dormant') {
      this.colorR = this.baseR * 0.3 + 120 * 0.7;
      this.colorG = this.baseG * 0.3 + 100 * 0.7;
      this.colorB = this.baseB * 0.3 + 70 * 0.7;
    } else if (newState === 'wilt') {
      const wiltAmount = (1 - this.seasonalModifier * 2) * 0.6;
      const keepAmount = 1 - wiltAmount;
      this.colorR = this.baseR * keepAmount + 139 * wiltAmount;
      this.colorG = this.baseG * keepAmount + 119 * wiltAmount;
      this.colorB = this.baseB * keepAmount + 90 * wiltAmount;
    } else if (newState === 'thrive') {
      let thriveAmount = (this.seasonalModifier - 1.0) * 2;
      if (thriveAmount > 0.4) thriveAmount = 0.4;
      const keepAmount = 1 - thriveAmount;
      this.colorR = this.baseR * keepAmount + 60 * thriveAmount;
      this.colorG = this.baseG * keepAmount + 180 * thriveAmount;
      this.colorB = this.baseB * keepAmount + 60 * thriveAmount;
    } else {
      this.colorR = this.baseR;
      this.colorG = this.baseG;
      this.colorB = this.baseB;
    }
  }
  
  consume() {
    if (this.dormant) return 0;
    
    const nutritionGained = this.nutrition;
    this.alive = false;
    this.growth = 0;
    this.nutrition = 0;
    this.regrowthTimer = 0;
    return nutritionGained;
  }
  
  // ============================================
  // SPRITE STATE DETERMINATION
  // ============================================
  
  _getSpriteState() {
    if (this.dormant) {
      return 'dormant';
    }
    
    if (this.seasonalModifier < 0.5) {
      return 'wilting';
    }
    
    if (this.seasonalModifier > 1.1 && this.growth > 0.7) {
      return 'thriving';
    }
    
    return 'mature';
  }
  
  // ============================================
  // MAIN RENDER METHOD
  // ============================================
  
  render() {
    if (!this.alive && !this.dormant) return;
    
    const px = this.pos.x;
    const py = this.pos.y;
    const dormant = this.dormant;
    const dormantMult = dormant ? 0.5 : 1;
    const displaySize = this.size * this.growth * dormantMult;
    
    if (displaySize < 2) return;
    
    // Route to sprite or procedural rendering
    if (this.usesSprites && PLANT_SPRITES && PLANT_SPRITES[this.type]) {
      this._renderSprite(px, py, displaySize, dormant);
    } else {
      this._renderProcedural(px, py, displaySize, dormant);
    }
  }
  
  // ============================================
  // SPRITE RENDERING
  // ============================================
  
  _renderSprite(px, py, displaySize, dormant) {
    const spriteState = this._getSpriteState();
    const sprite = PLANT_SPRITES[this.type][spriteState];
    
    if (!sprite) {
      // Fallback to procedural if sprite missing
      this._renderProcedural(px, py, displaySize, dormant);
      return;
    }
    
    push();
    translate(px, py);
    
    // Sway for non-dormant plants
    if (!dormant) {
      const sway = sin(frameCount * 0.02 + this.swayPhase) * 0.05 * this.seasonalModifier;
      rotate(sway);
    }
    
    // Shadow
    noStroke();
    fill(0, 0, 0, dormant ? 10 : 20);
    ellipse(1, 1, displaySize * 1.2, displaySize * 0.6);
    
    // Calculate sprite size
    // For small/growing plants, scale down the sprite
    let spriteSize = displaySize;
    if (this.growth < 0.5 && spriteState === 'mature') {
      // Use mature sprite but scaled smaller for growing plants
      spriteSize = displaySize * (0.5 + this.growth);
    }
    
    // Apply subtle tint based on color state for variation
    if (dormant) {
      tint(255, 255, 255, 150);
    } else {
      // Subtle color influence from seasonal modifier
      const tintStrength = 0.15;
      const tintR = lerp(255, this.colorR, tintStrength);
      const tintG = lerp(255, this.colorG, tintStrength);
      const tintB = lerp(255, this.colorB, tintStrength);
      tint(tintR, tintG, tintB, 255);
    }
    
    // Draw sprite centered
    imageMode(CENTER);
    image(sprite, 0, 0, spriteSize, spriteSize);
    
    // Reset tint
    noTint();
    
    // Dormant indicator
    if (dormant) {
      fill(200, 200, 200, 180);
      textSize(6);
      textAlign(CENTER, CENTER);
      text("❄", 0, -displaySize * 0.5);
    }
    
    pop();
  }
  
  // ============================================
  // PROCEDURAL RENDERING (for Kawakawa and fallback)
  // ============================================
  
  _renderProcedural(px, py, displaySize, dormant) {
    const alpha = dormant ? 150 : 255;
    const r = this.colorR;
    const g = this.colorG;
    const b = this.colorB;
    
    push();
    translate(px, py);
    
    // Sway for non-dormant plants
    if (!dormant) {
      const sway = sin(frameCount * 0.02 + this.swayPhase) * 0.05 * this.seasonalModifier;
      rotate(sway);
    }
    
    // Shadow
    noStroke();
    fill(0, 0, 0, dormant ? 10 : 20);
    ellipse(1, 1, displaySize * 1.2, displaySize * 0.6);
    
    const typeId = this.typeId;
    
    if (typeId === PLANT_TYPE_ID.kawakawa) {
      this._renderKawakawa(displaySize, r, g, b, alpha);
    } else {
      // Generic fallback for any missing sprites
      this._renderGenericPlant(displaySize, r, g, b, alpha);
    }
    
    // Dormant indicator
    if (dormant) {
      fill(200, 200, 200, 180);
      textSize(6);
      textAlign(CENTER, CENTER);
      text("❄", 0, -displaySize);
    }
    
    pop();
  }
  
  // ============================================
  // KAWAKAWA (procedural - no sprite)
  // ============================================
  
  _renderKawakawa(displaySize, r, g, b, alpha) {
    const angles = PlantStatics.kawakawaAngles;
    const stemLen = displaySize * 0.3;
    const leafPosOffset = stemLen + displaySize * 0.15;
    
    for (let i = 0; i < 5; i++) {
      push();
      rotate(angles[i]);
      
      // Stem
      stroke(75, 110, 50);
      strokeWeight(displaySize * 0.03);
      line(0, 0, stemLen, 0);
      
      translate(leafPosOffset, 0);
      rotate(HALF_PI);
      
      const lw = displaySize * 0.32;
      const lh = displaySize * 0.38;
      const lw2 = lw * 0.2;
      const lw45 = lw * 0.45;
      const lw5 = lw * 0.5;
      const lw55 = lw * 0.55;
      const lw15 = lw * 0.15;
      const lh5 = lh * 0.5;
      const lh35 = lh * 0.35;
      const lh2 = lh * 0.2;
      const lh4 = lh * 0.4;
      const lh05 = lh * 0.05;
      
      // Heart-shaped leaf
      fill(85, 155, 55);
      stroke(60, 120, 45);
      strokeWeight(1);
      
      beginShape();
      vertex(0, -lh5);
      bezierVertex(-lw2, -lh5, -lw45, -lh35, -lw5, -lh05);
      bezierVertex(-lw55, lh2, -lw15, lh4, 0, lh5);
      bezierVertex(lw15, lh4, lw55, lh2, lw5, -lh05);
      bezierVertex(lw45, -lh35, lw2, -lh5, 0, -lh5);
      endShape(CLOSE);
      
      // Veins
      stroke(55, 110, 40);
      strokeWeight(displaySize * 0.015);
      line(0, -lh * 0.4, 0, lh * 0.45);
      
      strokeWeight(displaySize * 0.008);
      const veinX0 = lw * 0.3;
      const veinX1 = lw * 0.25;
      const veinX2 = lw * 0.2;
      const veinYStart = -lh * 0.2;
      const veinYStep = lh * 0.22;
      const veinYOffset = lh * 0.1;
      
      line(0, veinYStart, -veinX0, veinYStart + veinYOffset);
      line(0, veinYStart, veinX0, veinYStart + veinYOffset);
      line(0, veinYStart + veinYStep, -veinX1, veinYStart + veinYStep + veinYOffset);
      line(0, veinYStart + veinYStep, veinX1, veinYStart + veinYStep + veinYOffset);
      line(0, veinYStart + veinYStep * 2, -veinX2, veinYStart + veinYStep * 2 + veinYOffset);
      line(0, veinYStart + veinYStep * 2, veinX2, veinYStart + veinYStep * 2 + veinYOffset);
      
      // Holes (characteristic of kawakawa)
      fill(35, 80, 30, 180);
      noStroke();
      ellipse(-lw * 0.2, lh * 0.1, lw * 0.15, lw * 0.12);
      ellipse(lw * 0.15, -lh * 0.1, lw * 0.1, lw * 0.1);
      
      pop();
    }
    
    // Center node
    fill(90, 75, 55);
    noStroke();
    ellipse(0, 0, displaySize * 0.12, displaySize * 0.12);
  }
  
  // ============================================
  // GENERIC FALLBACK (simple circle plant)
  // ============================================
  
  _renderGenericPlant(displaySize, r, g, b, alpha) {
    // Simple circular plant as fallback
    noStroke();
    
    // Main body
    fill(r, g, b, alpha);
    ellipse(0, 0, displaySize, displaySize * 0.9);
    
    // Highlight
    fill(r + 30, g + 30, b + 20, alpha * 0.5);
    ellipse(-displaySize * 0.15, -displaySize * 0.15, displaySize * 0.4, displaySize * 0.35);
    
    // Center/shadow
    fill(r - 30, g - 25, b - 20, alpha * 0.6);
    ellipse(displaySize * 0.05, displaySize * 0.05, displaySize * 0.5, displaySize * 0.45);
  }
}