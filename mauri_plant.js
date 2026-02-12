// ============================================
// PLANT CLASS 
// ============================================

// Plant type constants (avoid string comparisons)
const PLANT_TYPE_ID = {
  tussock: 0,
  flax: 1,
  fern: 2,
  kawakawa: 3,
  rimu: 4,
  beech: 5,
  patotara: 6
};

// Plants that use sprite rendering
const SPRITE_PLANTS = new Set(['tussock', 'flax', 'fern', 'rimu', 'beech', 'patotara']);

// Sprite reference - initialized from mauri_sketch.js
let PLANT_SPRITES = null;

function initPlantSprites(sprites) {
  PLANT_SPRITES = sprites;
}

// Pre-computed values shared across all plants
const PlantStatics = {
  kawakawaAngles: null,
  kawakawaBuffer: null,
  kawakawaBufferDormant: null,
  swayTable: null,
  initialized: false,
  
  SWAY_TABLE_SIZE: 256,
  
  init() {
    if (this.initialized) return;
    
    // Pre-compute kawakawa angles
    this.kawakawaAngles = [];
    const kawaStep = TWO_PI / 5;
    for (let i = 0; i < 5; i++) {
      this.kawakawaAngles.push(i * kawaStep + 0.2);
    }
    
    // Pre-compute sway lookup table
    this.swayTable = new Float32Array(this.SWAY_TABLE_SIZE);
    for (let i = 0; i < this.SWAY_TABLE_SIZE; i++) {
      this.swayTable[i] = Math.sin((i / this.SWAY_TABLE_SIZE) * TWO_PI);
    }
    
    // Pre-render kawakawa buffers
    this._renderKawakawaBuffers();
    
    this.initialized = true;
  },
  
  _renderKawakawaBuffers() {
    const size = 64;
    
    // Normal state
    this.kawakawaBuffer = createGraphics(size, size);
    this._drawKawakawaToBuffer(this.kawakawaBuffer, size, false);
    
    // Dormant state (brownish/wilted)
    this.kawakawaBufferDormant = createGraphics(size, size);
    this._drawKawakawaToBuffer(this.kawakawaBufferDormant, size, true);
  },
  
  _drawKawakawaToBuffer(buffer, size, dormant) {
    const displaySize = size * 0.8;
    const cx = size / 2;
    const cy = size / 2;
    
    buffer.push();
    buffer.translate(cx, cy);
    
    const angles = this.kawakawaAngles;
    const stemLen = displaySize * 0.3;
    const leafPosOffset = stemLen + displaySize * 0.15;
    const alpha = dormant ? 150 : 255;
    
    // Color adjustments for dormant state
    const leafFillR = dormant ? 110 : 85;
    const leafFillG = dormant ? 115 : 155;
    const leafFillB = dormant ? 80 : 55;
    
    const stemR = dormant ? 90 : 75;
    const stemG = dormant ? 95 : 110;
    const stemB = dormant ? 60 : 50;
    
    for (let i = 0; i < 5; i++) {
      buffer.push();
      buffer.rotate(angles[i]);
      
      // Stem
      buffer.stroke(stemR, stemG, stemB, alpha);
      buffer.strokeWeight(displaySize * 0.03);
      buffer.line(0, 0, stemLen, 0);
      
      buffer.translate(leafPosOffset, 0);
      buffer.rotate(HALF_PI);
      
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
      buffer.fill(leafFillR, leafFillG, leafFillB, alpha);
      buffer.stroke(dormant ? 70 : 60, dormant ? 100 : 120, dormant ? 55 : 45, alpha);
      buffer.strokeWeight(1);
      
      buffer.beginShape();
      buffer.vertex(0, -lh5);
      buffer.bezierVertex(-lw2, -lh5, -lw45, -lh35, -lw5, -lh05);
      buffer.bezierVertex(-lw55, lh2, -lw15, lh4, 0, lh5);
      buffer.bezierVertex(lw15, lh4, lw55, lh2, lw5, -lh05);
      buffer.bezierVertex(lw45, -lh35, lw2, -lh5, 0, -lh5);
      buffer.endShape(CLOSE);
      
      // Central vein
      buffer.stroke(dormant ? 70 : 55, dormant ? 90 : 110, dormant ? 50 : 40, alpha);
      buffer.strokeWeight(displaySize * 0.015);
      buffer.line(0, -lh * 0.4, 0, lh * 0.45);
      
      // Side veins
      buffer.strokeWeight(displaySize * 0.008);
      const veinX0 = lw * 0.3;
      const veinX1 = lw * 0.25;
      const veinX2 = lw * 0.2;
      const veinYStart = -lh * 0.2;
      const veinYStep = lh * 0.22;
      const veinYOffset = lh * 0.1;
      
      buffer.line(0, veinYStart, -veinX0, veinYStart + veinYOffset);
      buffer.line(0, veinYStart, veinX0, veinYStart + veinYOffset);
      buffer.line(0, veinYStart + veinYStep, -veinX1, veinYStart + veinYStep + veinYOffset);
      buffer.line(0, veinYStart + veinYStep, veinX1, veinYStart + veinYStep + veinYOffset);
      buffer.line(0, veinYStart + veinYStep * 2, -veinX2, veinYStart + veinYStep * 2 + veinYOffset);
      buffer.line(0, veinYStart + veinYStep * 2, veinX2, veinYStart + veinYStep * 2 + veinYOffset);
      
      // Holes (characteristic of kawakawa)
      buffer.fill(dormant ? 50 : 35, dormant ? 70 : 80, dormant ? 40 : 30, dormant ? 120 : 180);
      buffer.noStroke();
      buffer.ellipse(-lw * 0.2, lh * 0.1, lw * 0.15, lw * 0.12);
      buffer.ellipse(lw * 0.15, -lh * 0.1, lw * 0.1, lw * 0.1);
      
      buffer.pop();
    }
    
    // Center node
    buffer.fill(dormant ? 100 : 90, dormant ? 85 : 75, dormant ? 65 : 55, alpha);
    buffer.noStroke();
    buffer.ellipse(0, 0, displaySize * 0.12, displaySize * 0.12);
    
    buffer.pop();
  },
  
  getSway(frameCount, phase, modifier) {
    const index = ((frameCount * 0.02 + phase) * (this.SWAY_TABLE_SIZE / TWO_PI)) % this.SWAY_TABLE_SIZE;
    return this.swayTable[index | 0] * 0.05 * modifier;
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
    
    // Parse color once and cache RGB values (for procedural rendering)
    const c = color(plantDef.color);
    this.baseR = red(c);
    this.baseG = green(c);
    this.baseB = blue(c);
    
    this.alive = true;
    this.dormant = false;
    this.dormantTimer = 0;
    this.regrowthTimer = 0;
    this.growth = 1.0;
    this.seasonalModifier = 1.0;
    this.plantTypeModifier = 1.0;
    
    this.isSpawned = false;
    this.parentPlaceable = null;
    
    // Pre-calculate visual variation
    this.visualOffset = random(-1, 1);
    this.swayPhase = random(TWO_PI);
    
    // Track sprite state to avoid recalculating
    this._lastSpriteState = 'mature';
  }
  
  update(seasonManager) {
    if (this.isSpawned && this.parentPlaceable) {
      if (!this.parentPlaceable.alive) {
        this.alive = false;
        return;
      }
      this.seasonalModifier = 1.2;
      this.plantTypeModifier = 1.0;
      this.handleGrowth();
      return;
    }
    
    const newModifier = seasonManager.getPlantModifier(this.biomeKey);
    if (Math.abs(newModifier - this.seasonalModifier) > 0.01) {
      this.seasonalModifier = newModifier;
    }
    
    // Get plant-type specific modifier (for patotara berries, etc.)
    this.plantTypeModifier = seasonManager.getPlantTypeModifier(this.type);
    
    this.checkDormancy(seasonManager);
    
    if (this.dormant) {
      this.handleDormancy(seasonManager);
      return;
    }
    
    this.handleGrowth();
  }
  
  checkDormancy(seasonManager) {
    if (this.dormant || !this.alive) return;
    
    // Summer uses wilting sprites instead of dormancy for harsh conditions
    if (seasonManager.currentKey === 'summer') return;
    
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
  }
  
  handleDormancy(seasonManager) {
    this.dormantTimer++;
    
    const shouldBeDormant = seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey);
    
    if (!shouldBeDormant && this.seasonalModifier > 0.5) {
      if (random() < 0.02) {
        this.dormant = false;
        this.growth = 0.2;
      }
    }
    
    this.nutrition = 0;
  }
  
  handleGrowth() {
    const typeModifier = this.plantTypeModifier || 1.0;
    
    if (!this.alive) {
      const regrowthRate = this.seasonalModifier;
      this.regrowthTimer += regrowthRate;
      
      const divisor = this.seasonalModifier > 0.3 ? this.seasonalModifier : 0.3;
      this.growthTime = this.baseGrowthTime / divisor;
      
      if (this.regrowthTimer >= this.growthTime) {
        this.alive = true;
        this.growth = 0.3;
        this.regrowthTimer = 0;
      }
    } else if (this.growth < 1.0) {
      const growthRate = 0.002 * this.seasonalModifier;
      this.growth += growthRate;
      if (this.growth > 1.0) this.growth = 1.0;
      this.nutrition = this.maxNutrition * this.growth * this.seasonalModifier * typeModifier;
    } else {
      this.nutrition = this.maxNutrition * this.seasonalModifier * typeModifier;
    }
    
    this.maxNutrition = this.baseNutrition * this.seasonalModifier;
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
    // Dormant plants use wilting sprite
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
    
    // Route to appropriate rendering method
    if (this.typeId === PLANT_TYPE_ID.kawakawa) {
      this._renderKawakawa(px, py, displaySize, dormant);
    } else if (this.usesSprites && PLANT_SPRITES && PLANT_SPRITES[this.type]) {
      this._renderSprite(px, py, displaySize, dormant);
    } else {
      this._renderGenericPlant(px, py, displaySize, dormant);
    }
  }
  
  // ============================================
  // SPRITE RENDERING (No tint - fast!)
  // ============================================
  
  _renderSprite(px, py, displaySize, dormant) {
    const spriteState = this._getSpriteState();
    const sprites = PLANT_SPRITES[this.type];
    const sprite = sprites ? sprites[spriteState] : null;
    
    if (!sprite) {
      this._renderGenericPlant(px, py, displaySize, dormant);
      return;
    }
    
    // Shadow - draw directly without transform
    noStroke();
    fill(0, 0, 0, dormant ? 10 : 20);
    ellipse(px + 1, py + 1, displaySize * 1.2, displaySize * 0.6);
    
    // Calculate sprite size for growing plants
    let spriteSize = displaySize;
    if (this.growth < 0.5) {
      spriteSize = displaySize * (0.5 + this.growth);
    }
    
    const halfSize = spriteSize * 0.5;
    
    // Only use push/pop if we need rotation (sway)
    if (!dormant && this.seasonalModifier > 0.1) {
      const sway = PlantStatics.getSway(frameCount, this.swayPhase, this.seasonalModifier);
      push();
      translate(px, py);
      rotate(sway);
      image(sprite, -halfSize, -halfSize, spriteSize, spriteSize);
      pop();
    } else {
      // No rotation needed - direct draw (faster)
      image(sprite, px - halfSize, py - halfSize, spriteSize, spriteSize);
    }
    
    // Dormant indicator
    if (dormant) {
      this._drawDormantIndicator(px, py - displaySize * 0.5);
    }
  }
  
  // ============================================
  // KAWAKAWA RENDERING (Pre-rendered buffer)
  // ============================================
  
  _renderKawakawa(px, py, displaySize, dormant) {
    const buffer = dormant ? PlantStatics.kawakawaBufferDormant : PlantStatics.kawakawaBuffer;
    
    // Shadow
    noStroke();
    fill(0, 0, 0, dormant ? 10 : 20);
    ellipse(px + 1, py + 1, displaySize * 1.2, displaySize * 0.6);
    
    const halfSize = displaySize * 0.5;
    
    // Only use push/pop if we need rotation (sway)
    if (!dormant && this.seasonalModifier > 0.1) {
      const sway = PlantStatics.getSway(frameCount, this.swayPhase, this.seasonalModifier);
      push();
      translate(px, py);
      rotate(sway);
      image(buffer, -halfSize, -halfSize, displaySize, displaySize);
      pop();
    } else {
      // No rotation needed - direct draw (faster)
      image(buffer, px - halfSize, py - halfSize, displaySize, displaySize);
    }
    
    // Dormant indicator
    if (dormant) {
      this._drawDormantIndicator(px, py - displaySize * 0.5);
    }
  }
  
  // ============================================
  // GENERIC FALLBACK (simple circle plant)
  // ============================================
  
  _renderGenericPlant(px, py, displaySize, dormant) {
    const alpha = dormant ? 150 : 255;
    let r, g, b;
    if (dormant) {
      r = this.baseR * 0.5 + 80;
      g = this.baseG * 0.5 + 70;
      b = this.baseB * 0.5 + 50;
    } else {
      r = this.baseR;
      g = this.baseG;
      b = this.baseB;
    }
    noStroke();
    fill(0, 0, 0, dormant ? 10 : 20);
    ellipse(px + 1, py + 1, displaySize * 1.2, displaySize * 0.6);
    fill(r, g, b, alpha);
    ellipse(px, py, displaySize, displaySize * 0.9);
    fill(r + 30, g + 30, b + 20, alpha * 0.5);
    ellipse(px - displaySize * 0.15, py - displaySize * 0.15, displaySize * 0.4, displaySize * 0.35);
    fill(r - 30, g - 25, b - 20, alpha * 0.6);
    ellipse(px + displaySize * 0.05, py + displaySize * 0.05, displaySize * 0.5, displaySize * 0.45);
    if (dormant) {
      this._drawDormantIndicator(px, py - displaySize * 0.6);
    }
  }
  
  // ============================================
  // DORMANT INDICATOR 
  // ============================================
  
  _drawDormantIndicator(x, y) {
    stroke(160, 160, 160, 180);
    strokeWeight(0.8);
    const s = 3;
    line(x - s, y, x + s, y);
    line(x, y - s, x, y + s);
    line(x - s * 0.7, y - s * 0.7, x + s * 0.7, y + s * 0.7);
    line(x - s * 0.7, y + s * 0.7, x + s * 0.7, y - s * 0.7);
  }
}