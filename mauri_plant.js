// mauri_plant.js
class Plant {
  constructor(x, y, type, terrain, biomeKey) {
    this.pos = createVector(x, y);
    this.type = type;
    this.terrain = terrain;
    this.biomeKey = biomeKey;
    this.elevation = terrain.getElevationAt(x, y);
    
    const plantDef = PLANT_TYPES[type];
    this.baseNutrition = plantDef.nutrition;
    this.nutrition = plantDef.nutrition;
    this.maxNutrition = plantDef.nutrition;
    this.baseColor = color(plantDef.color);
    this.color = color(plantDef.color);
    this.size = plantDef.size;
    this.baseGrowthTime = plantDef.growthTime;
    this.growthTime = plantDef.growthTime;
    
    this.alive = true;
    this.dormant = false;  // New: seasonal dormancy
    this.dormantTimer = 0;
    this.regrowthTimer = 0;
    this.growth = 1.0;
    this.seasonalModifier = 1.0;
    
    // Spawned plants (from placeables) don't go dormant
    this.isSpawned = false;
    this.parentPlaceable = null;
    
    // Visual variation
    this.visualOffset = random(-1, 1);
    this.swayPhase = random(TWO_PI);
  }
  
  update(seasonManager) {
    // Spawned plants follow their parent
    if (this.isSpawned && this.parentPlaceable) {
      if (!this.parentPlaceable.alive) {
        this.alive = false;
        return;
      }
      // Spawned plants don't go dormant and have boosted growth
      this.seasonalModifier = 1.2;
      this.handleGrowth();
      return;
    }
    
    // Get seasonal modifier for this biome
    this.seasonalModifier = seasonManager.getPlantModifier(this.biomeKey);
    
    // Check for dormancy
    this.checkDormancy(seasonManager);
    
    if (this.dormant) {
      this.handleDormancy(seasonManager);
      return;
    }
    
    // Normal growth
    this.handleGrowth();
    
    // Update color based on health
    this.updateColor();
  }
  
  checkDormancy(seasonManager) {
    // Already dormant - handled elsewhere
    if (this.dormant) return;
    
    // Already dead (eaten) - handled elsewhere
    if (!this.alive) return;
    
    // Check if this plant should go dormant
    if (seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey)) {
      let dormancyChance = seasonManager.getDormancyChance();
      
      // Random check (once per season change)
      if (seasonManager.justChanged && random() < dormancyChance) {
        this.goDormant();
      }
      
      // Also go dormant if modifier is very low
      if (this.seasonalModifier < 0.25 && this.growth > 0.5 && random() < 0.01) {
        this.goDormant();
      }
    }
  }
  
  goDormant() {
    this.dormant = true;
    this.dormantTimer = 0;
    this.growth = max(0.1, this.growth * 0.3);  // Shrink but don't disappear
  }
  
  handleDormancy(seasonManager) {
    this.dormantTimer++;
    
    // Check if we should wake up
    let shouldBeDormant = seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey);
    
    // Wake up if conditions improve
    if (!shouldBeDormant && this.seasonalModifier > 0.5) {
      // Gradual wake up
      if (random() < 0.02) {
        this.dormant = false;
        this.growth = 0.2;  // Start regrowing
      }
    }
    
    // Dormant plants still sway slightly
    this.nutrition = 0;  // Can't eat dormant plants
  }
  
  handleGrowth() {
    if (!this.alive) {
      // Regrowth after being eaten
      let regrowthRate = this.seasonalModifier;
      this.regrowthTimer += regrowthRate;
      this.growthTime = this.baseGrowthTime / max(0.3, this.seasonalModifier);
      
      if (this.regrowthTimer >= this.growthTime) {
        this.alive = true;
        this.growth = 0.3;
        this.regrowthTimer = 0;
      }
    } else if (this.growth < 1.0) {
      // Growing
      let growthRate = 0.002 * this.seasonalModifier;
      this.growth = min(1.0, this.growth + growthRate);
      this.nutrition = this.maxNutrition * this.growth * this.seasonalModifier;
    } else {
      // Fully grown
      this.nutrition = this.maxNutrition * this.seasonalModifier;
    }
    
    this.maxNutrition = this.baseNutrition * this.seasonalModifier;
  }
  
  updateColor() {
    if (this.dormant) {
      // Brown/grey dormant color
      this.color = lerpColor(this.baseColor, color(120, 100, 70), 0.7);
    } else if (this.seasonalModifier < 0.5) {
      // Wilted - brownish
      let wiltAmount = 1 - (this.seasonalModifier * 2);
      this.color = lerpColor(this.baseColor, color(139, 119, 90), wiltAmount * 0.6);
    } else if (this.seasonalModifier > 1.1) {
      // Thriving - more vibrant green
      let thriveAmount = (this.seasonalModifier - 1.0) * 2;
      this.color = lerpColor(this.baseColor, color(60, 180, 60), min(0.4, thriveAmount));
    } else {
      this.color = this.baseColor;
    }
  }
  
  consume() {
    if (this.dormant) return 0;  // Can't eat dormant plants
    
    const nutritionGained = this.nutrition;
    this.alive = false;
    this.growth = 0;
    this.nutrition = 0;
    this.regrowthTimer = 0;
    return nutritionGained;
  }
  
  render() {
    // Don't render if dead (eaten)
    if (!this.alive && !this.dormant) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    // Wind sway
    let sway = 0;
    if (!this.dormant) {
      sway = sin(frameCount * 0.02 + this.swayPhase) * 0.05 * this.seasonalModifier;
    }
    rotate(sway);
    
    let displaySize = this.size * this.growth;
    
    // Smaller when dormant
    if (this.dormant) {
      displaySize *= 0.5;
    }
    
    // Shadow
    noStroke();
    fill(0, 0, 0, this.dormant ? 10 : 20);
    ellipse(1, 1, displaySize * 1.2, displaySize * 0.6);
    
    // Plant body
    fill(this.color);
    
    // Alpha based on state
    let alpha = this.dormant ? 150 : 255;
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    
    if (this.type === 'tussock') {
      for (let i = -2; i <= 2; i++) {
        let h = displaySize * (0.8 + random(0, 0.4));
        if (this.dormant) h *= 0.6;
        ellipse(i * 0.8, 0, 1.5, h);
      }
    } else if (this.type === 'flax') {
      
      for (let i = -1; i <= 1; i++) {
        let h = displaySize * 1.5;
        if (this.dormant) h *= 0.5;
        beginShape();
        vertex(i * 2, 0);
        vertex(i * 1.5, -h);
        vertex(i * 2.5, 0);
        endShape(CLOSE);
      }
    } else if (this.type === 'fern') {
      ellipse(0, 0, displaySize, displaySize * 0.8);
      if (!this.dormant) {
        fill(red(this.color) - 20, green(this.color) + 10, blue(this.color) - 10, alpha);
        ellipse(0, -1, displaySize * 0.5, displaySize * 0.4);
      }
    } else if (this.type === 'kawakawa') {
      // Heart-shaped leaves
      for (let i = 0; i < 4; i++) {
        let angle = i * HALF_PI + PI/4;
        let lx = cos(angle) * displaySize * 0.4;
        let ly = sin(angle) * displaySize * 0.4;
        ellipse(lx, ly, displaySize * 0.5, displaySize * 0.6);
      }
    } else {
      // Berries/nuts
      for (let i = 0; i < 4; i++) {
        let angle = i * HALF_PI;
        ellipse(
          cos(angle) * displaySize * 0.3, 
          sin(angle) * displaySize * 0.3, 
          displaySize * 0.5, 
          displaySize * 0.5
        );
      }
    }
    
    // Dormant indicator (small snowflake or sun icon)
    if (this.dormant) {
      fill(200, 200, 200, 180);
      textSize(6);
      textAlign(CENTER, CENTER);
      text(" ᭄᭡", 0, -displaySize);
    }
    
    pop();
  }
}