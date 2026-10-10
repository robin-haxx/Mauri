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
  patotara: 6,
  coprosma: 7,
  dracophyllum: 8,
  matagouri: 9,
  lancewood: 10,
  speargrass: 11,
  toatoa: 12,
  pohuehue: 13,
  wharariki: 14
};

// Plants that use sprite rendering (wharariki borrows the flax sprites for now; see preload)
const SPRITE_PLANTS = new Set(['tussock', 'flax', 'fern', 'rimu', 'beech', 'patotara', 'lancewood', 'speargrass', 'coprosma', 'dracophyllum', 'wharariki']);

// Forest canopy trees subject to seasonal forest-band contraction
const FOREST_TREES = new Set(['beech', 'rimu', 'fern']);

// Free Play winter-inedibility tuning (read only when LEVEL_MECHANICS.winterInedibility).
// A deepening glacial (coldIndex) erodes each plant's winter food floor; below the
// threshold a plant is standing scenery, not forage.
const PLANT_CLIMATE_EDIBILITY_EROSION = 0.8;   // how hard coldIndex erodes the floor
const PLANT_INEDIBLE_THRESHOLD = 3;            // nutrition below this => skipped as food

// A plant the player taps (Game._tapPlant) rustles, shakes, and for a few seconds draws the
// hungry plant-eaters near it a little (Simulation.lurePlant): their food search weighs it as
// if it were nearer (a moa's score times `pull`, a fruit bird's distance² times pull²), and a
// module family member within `range` walks over to eat it (MoaLife._luredPlant), feeding there
// at feedPerSec hunger a second without using the plant up.
const PLANT_LURE = { sec: 5, range: 90, pull: 0.5, feedPerSec: 30 };
const PLANT_SHAKE_FRAMES = 30;                 // how long a tapped plant shakes

// A pātōtara sprouted by hand comes into leaf (its 'mature' sprite) and then, this many frames
// later (plus up to FRUIT_JITTER, so a patch ripples), into fruit ('thriving', in summer).
// Each change crossfades over ~30 frames (see _renderSprite).
const PLANT_FRUIT_DELAY = 45;
const PLANT_FRUIT_JITTER = 15;

// Sprite reference - initialized from mauri_sketch.js
let PLANT_SPRITES = null;

function initPlantSprites(sprites) {
  PLANT_SPRITES = sprites;
}

// Portrait-sprite plants: 2 alternate sprites each, one picked at random, anchored at
// bottom-centre (the base sits on the ground point), via a dedicated render path.
const PORTRAIT_PLANTS = new Set(['rimu', 'beech', 'dracophyllum', 'matagouri']);

// Trees' cast shadows (EntitySprites.drawTreeShadow): every portrait plant, plus the square-
// sprite trees listed here. squash: the shadow's length over the tree's height; lean: its
// sideways slant per unit of that length.
const TREE_SHADOW = { squash: 0.42, lean: 0.45, square: new Set(['lancewood']) };
let PORTRAIT_PLANT_SPRITES = null;

function initPortraitPlantSprites(sprites) {
  PORTRAIT_PLANT_SPRITES = sprites;
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
  },

  // Whether plants draw their ground shadow: one extra sprite per plant, of hundreds on
  // screen, so performance mode leaves it out.
  shadows() {
    return !(typeof CONFIG !== 'undefined' && CONFIG.perfMode);
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
    this.spriteKey = type;   // PLANT_SPRITES key; a matured plant switches to '<type>_mature'
    this.matured = false;    // grown out of a moa's reach (see mature)

    // Portrait-sprite plants pick one of 2 variants at random (fixed for life).
    this.usesPortraitSprite = PORTRAIT_PLANTS.has(type);
    this.portraitVariant = this.usesPortraitSprite ? floor(random(2)) : 0;
    
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
    this.favouredSpecies = null;   // set by a placeable that plants a species-specific resource
    this.suppressed = false;       // true when a forest tree is outside the contracted forest band
    this.winterInedible = false;   // Free Play: standing (frosted) but no winter food value
    // A level can keep some plant types standing all year (mechanics.evergreenPlants): they
    // never go dormant.
    this.evergreen = !!(typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.evergreenPlants &&
                        LEVEL_MECHANICS.evergreenPlants.includes(type));
    // A level with mechanics.sproutPatotara (the modules): pātōtara starts unsprouted (its
    // dormant look, no berries, nothing for a bird to eat) until the player sprouts it, by
    // pressing and holding on it (Game._sprout). Sprouted, it looks thriving in summer and mature
    // in spring and autumn (see _getSpriteState).
    this.unsprouted = Plant.sproutsByHand(type);
    this.sprouted = false;
    this._seasonKey = null;

    // Pre-calculate visual variation
    this.visualOffset = random(-1, 1);
    this.swayPhase = random(TWO_PI);
    
    // Track sprite state to avoid recalculating
    this._lastSpriteState = 'mature';
  }
  
  // Whether this level's `type` plants start unsprouted (see the constructor).
  static sproutsByHand(type) {
    return type === 'patotara' && typeof LEVEL_MECHANICS !== 'undefined' && !!LEVEL_MECHANICS.sproutPatotara;
  }

  // Bring out its berries (a press and hold on it; see Game._sprout). `staged` (the player's
  // sprouting) shows it in leaf for a moment before the fruit (PLANT_FRUIT_DELAY); timed on
  // the render clock, so it plays while a prompt has the game paused too.
  sprout(staged = false) {
    this.unsprouted = false;
    this.sprouted = true;
    if (this.alive && this.growth < 0.8) this.growth = 0.8;
    if (staged) this._fruitAt = frameCount + PLANT_FRUIT_DELAY + random(PLANT_FRUIT_JITTER);
  }

  // Whether there's anything on it for a browser to eat now (what a tap's lure needs).
  hasFood() {
    return this.alive && !this.dormant && !this.unsprouted && !this.matured && this.growth >= 0.3;
  }

  // A tap on it (Game._tapPlant): a quick side-to-side shake on top of the sway. It runs on
  // the render clock, so it plays while a prompt has the game paused too.
  shake() { this._shakeStart = frameCount; }

  // The shake's x offset this frame, for a sprite `half` wide (0 when not shaking).
  _shakeX(half) {
    if (this._shakeStart == null) return 0;
    const t = frameCount - this._shakeStart;
    if (t >= PLANT_SHAKE_FRAMES || t < 0) { this._shakeStart = null; return 0; }
    return Math.sin(t * 1.0) * (1 - t / PLANT_SHAKE_FRAMES) * half * 0.2;
  }

  update(seasonManager) {
    this._seasonKey = seasonManager.currentKey;
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
    
    // Forest contraction: canopy trees outside the shrinking forest band go
    // unproductive/wilted. O(1) per plant against a per-frame lerped band.
    if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.forestContraction
        && FOREST_TREES.has(this.type)) {
      const band = seasonManager.getForestBand();
      if (band && (this.elevation < band.min || this.elevation > band.max)) {
        this.suppressed = true;
        this.dormant = false;
        this.nutrition = 0;
        return;
      }
      this.suppressed = false;
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

    // Free Play: winter takes food value, not the plant. A wild plant stays standing
    // (frosted) but its nutrition drops to its winter floor. Placeable food is exempt.
    if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.winterInedibility) {
      this._applyWinterEdibility(seasonManager);
    } else {
      this.winterInedible = false;
    }
  }

  // Standing-but-inedible winter model. Blends nutrition toward a per-type winter floor
  // by winterness, and flags the plant unforageable below the threshold. Never touches alive.
  _applyWinterEdibility(seasonManager) {
    const w = seasonManager.getWinterness ? seasonManager.getWinterness() : 0;
    if (w <= 0) { this.winterInedible = false; return; }
    // Mast year: forest plants keep their food value through the cold.
    if (seasonManager.mastYear && typeof FOREST_TREES !== 'undefined' && FOREST_TREES.has(this.type)) {
      this.winterInedible = false; return;
    }
    const def = PLANT_TYPES[this.type];
    const we = (def && def.winterEdibility != null) ? def.winterEdibility : 0.12;
    const cold = seasonManager.coldIndex || 0;
    // Level tuning: winterEdibilityMult scales how much food value survives the cold (a gentler
    // winter starve); winterEdibilityErosion is how hard a deepening glacial erodes that floor.
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    const mult = M.winterEdibilityMult ?? 1;
    const erosion = (M.winterEdibilityErosion != null) ? M.winterEdibilityErosion : PLANT_CLIMATE_EDIBILITY_EROSION;
    const eff = Math.max(0, we * mult * (1 - erosion * cold));
    const winterVal = this.baseNutrition * this.growth * eff;
    this.nutrition = this.nutrition + (winterVal - this.nutrition) * w;   // ease in by winterness
    this.winterInedible = this.nutrition < PLANT_INEDIBLE_THRESHOLD;
  }
  
  checkDormancy(seasonManager) {
    if (this.dormant || !this.alive || this.evergreen) return;
    
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
  
  // Grow into the adult form (a planted lancewood after its first year; see
  // PlaceableObject.mature): drawn with the '<type>_mature' sprites when there are any, and
  // skipped as food by moa. One-way.
  mature() {
    this.matured = true;
    const key = this.type + '_mature';
    if (PLANT_SPRITES && PLANT_SPRITES[key]) this.spriteKey = key;
  }

  consume() {
    if (this.dormant || this.unsprouted) return 0;
    
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
    // Trees suppressed by forest contraction show as wilted
    if (this.suppressed) {
      return 'wilting';
    }
    // Dormant plants use wilting sprite
    if (this.dormant) {
      return 'dormant';
    }
    // Pātōtara waiting to be sprouted shows bare; sprouted, it's in fruit in summer (thriving)
    // and in leaf in spring and autumn (mature). See sprout().
    if (this.unsprouted) return 'dormant';
    if (this.sprouted) {
      if (this._fruitAt != null) {
        if (frameCount < this._fruitAt) return 'mature';   // just sprouted: in leaf first
        this._fruitAt = null;
      }
      return this._seasonKey === 'summer' ? 'thriving' : 'mature';
    }
    // Free Play: winter-inedible plants stand frosted/wilted (present, not gone).
    if (this.winterInedible) {
      return 'wilting';
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
    // (An unsprouted pātōtara draws as dormant does, but nearly full size and with no frost.)
    const dormant = this.dormant || this.unsprouted;
    const dormantMult = this.dormant ? 0.5 : (this.unsprouted ? 0.9 : 1);
    const displaySize = this.size * this.growth * dormantMult;
    
    if (displaySize < 2) return;

    // Food-value fade (GL only): a plant dims toward drab as its live nutrition falls, so
    // "standing food with nothing in it" reads visibly. Skipped for dormant plants.
    let _faded = false;
    if (!dormant && typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch._open) {
      // Fade by absolute food value against a "worthwhile browse" band, so a plant that
      // holds its value (beech) stays green while a collapsing one greys out.
      const GOOD_LO = 1.5, GOOD_HI = 6.5;
      let fade = Math.max(0, Math.min(1, (GOOD_HI - (this.nutrition || 0)) / (GOOD_HI - GOOD_LO)));
      if (this.winterInedible) fade = Math.max(fade, 0.85);
      fade *= 0.72;                                  // cap: never fully grey
      if (fade > 0.03) {
        tint(255 + (150 - 255) * fade, 255 + (152 - 255) * fade, 255 + (135 - 255) * fade);
        _faded = true;
      }
    }

    // Route to appropriate rendering method
    if (this.usesPortraitSprite && PORTRAIT_PLANT_SPRITES && PORTRAIT_PLANT_SPRITES[this.type]) {
      this._renderPortraitSprite(px, py, displaySize, dormant);
    } else if (this.typeId === PLANT_TYPE_ID.kawakawa) {
      this._renderKawakawa(px, py, displaySize, dormant);
    } else if (this.usesSprites && PLANT_SPRITES && PLANT_SPRITES[this.spriteKey]) {
      this._renderSprite(px, py, displaySize, dormant);
    } else {
      this._renderGenericPlant(px, py, displaySize, dormant);
    }
    if (_faded) noTint();
  }
  
  // ============================================
  // SPRITE RENDERING (No tint - fast!)
  // ============================================
  
  _renderSprite(px, py, displaySize, dormant) {
    const spriteState = this._getSpriteState();
    const sprites = PLANT_SPRITES[this.spriteKey];
    const sprite = sprites ? sprites[spriteState] : null;

    if (!sprite) {
      this._renderGenericPlant(px, py, displaySize, dormant);
      return;
    }

    // Crossfade on a sprite change (a new sprite state, or growing into the mature art) so
    // plants don't hard-flick: blend the outgoing sprite out under the incoming one over ~0.5s.
    if (this._lastSprite && this._lastSprite !== sprite) {
      this._fadeSprite = this._lastSprite;
      this._fadeStart = frameCount;
    }
    this._lastSprite = sprite;
    let fadeT = 1;
    if (this._fadeSprite) {
      fadeT = (frameCount - this._fadeStart) / 30;
      if (fadeT >= 1) { this._fadeSprite = null; fadeT = 1; }
    }

    // Calculate sprite size for growing plants
    let spriteSize = displaySize;
    if (this.growth < 0.5) {
      spriteSize = displaySize * (0.5 + this.growth);
    }

    const halfSize = spriteSize * 0.5;

    // Shadow; sprite-shaped on GL (bake-free silhouette), ellipse blob on 2D. Skipped in
    // performance mode (see PlantStatics.shadows). A tree's is cast from its trunk's foot
    // (the sprite's bottom-centre); a clump's pools under its middle.
    // Positional args (alpha, squash, wide, mirror, fbW, fbH) — no per-frame options object.
    if (PlantStatics.shadows()) {
      if (TREE_SHADOW.square.has(this.type)) EntitySprites.drawTreeShadow(sprite, px, py + halfSize,
        spriteSize, spriteSize, dormant ? 0.05 : 0.10, TREE_SHADOW.squash, TREE_SHADOW.lean, spriteSize * 0.9);
      else EntitySprites.drawSpriteShadow(sprite, px + 1, py + 1, displaySize, displaySize,
        dormant ? 0.05 : 0.10, 0.5, 0.82, null, displaySize * 1.2, displaySize * 0.6);
    }

    // Sway as a cheap sub-pixel x-offset rather than a per-plant push/rotate/pop, which
    // was the dominant render cost with thousands of plants on screen.
    let drawX = px - halfSize;
    if (!dormant && this.seasonalModifier > 0.1) {
      drawX += PlantStatics.getSway(frameCount, this.swayPhase, this.seasonalModifier) * halfSize;
    }
    if (this._shakeStart != null) drawX += this._shakeX(halfSize);
    const dy = py - halfSize;
    if (this._fadeSprite && fadeT < 1) {
      // Outgoing sprite fades out beneath the incoming one (a true crossfade).
      tint(255, (1 - fadeT) * 255);
      image(this._fadeSprite, drawX, dy, spriteSize, spriteSize);
      tint(255, fadeT * 255);
      image(sprite, drawX, dy, spriteSize, spriteSize);
      noTint();
    } else {
      image(sprite, drawX, dy, spriteSize, spriteSize);
    }

    // Dormant indicator (the frost of a winter's dormancy, not an unsprouted plant's)
    if (this.dormant) {
      this._drawDormantIndicator(px, py - displaySize * 0.5);
    }
  }
  
  // ============================================
  // PORTRAIT SPRITE RENDERING
  // Bottom-centre anchored, aspect preserved: (px, py) sits at the base of the sprite.
  // ============================================

  _renderPortraitSprite(px, py, displaySize, dormant) {
    const variants = PORTRAIT_PLANT_SPRITES[this.type];
    const sprite = variants ? variants[this.portraitVariant] : null;

    if (!sprite) {
      this._renderGenericPlant(px, py, displaySize, dormant);
      return;
    }

    // Width follows displaySize; height follows the sprite's aspect ratio.
    let spriteW = displaySize;
    if (this.growth < 0.5) {
      spriteW = displaySize * (0.5 + this.growth);
    }
    const aspect = sprite.height / sprite.width || 1;
    const spriteH = spriteW * aspect;
    const halfW = spriteW * 0.5;

    // Cast shadow from the trunk's foot (the sprite's bottom-centre, px, py).
    if (PlantStatics.shadows()) EntitySprites.drawTreeShadow(sprite, px, py, spriteW, spriteH,
      dormant ? 0.05 : 0.10, TREE_SHADOW.squash, TREE_SHADOW.lean, spriteW * 0.9);

    // Cheap sub-pixel sway offset (see _renderSprite); no per-plant matrix ops.
    let drawX = px - halfW;
    if (!dormant && this.seasonalModifier > 0.1) {
      drawX += PlantStatics.getSway(frameCount, this.swayPhase, this.seasonalModifier) * halfW;
    }
    if (this._shakeStart != null) drawX += this._shakeX(halfW);
    // Bottom of the sprite sits on the ground point (py).
    image(sprite, drawX, py - spriteH, spriteW, spriteH);

    // Dormant indicator
    if (dormant) {
      this._drawDormantIndicator(px, py - spriteH * 0.5);
    }
  }

  // ============================================
  // KAWAKAWA RENDERING (Pre-rendered buffer)
  // ============================================
  
  _renderKawakawa(px, py, displaySize, dormant) {
    const buffer = dormant ? PlantStatics.kawakawaBufferDormant : PlantStatics.kawakawaBuffer;
    
    // Shadow; kawakawa's pre-rendered buffer works as the silhouette source on GL.
    if (PlantStatics.shadows()) EntitySprites.drawSpriteShadow(buffer, px + 1, py + 1, displaySize, displaySize,
      dormant ? 0.05 : 0.10, 0.5, 0.82, null, displaySize * 1.2, displaySize * 0.6);

    const halfSize = displaySize * 0.5;

    // Cheap sub-pixel sway offset (see _renderSprite); no per-plant matrix ops.
    let drawX = px - halfSize;
    if (!dormant && this.seasonalModifier > 0.1) {
      drawX += PlantStatics.getSway(frameCount, this.swayPhase, this.seasonalModifier) * halfSize;
    }
    if (this._shakeStart != null) drawX += this._shakeX(halfSize);
    image(buffer, drawX, py - halfSize, displaySize, displaySize);
    
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
    if (this._shakeStart != null) px += this._shakeX(displaySize * 0.5);
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