// ============================================
// PLANT CLASS - With seasonal effects
// ============================================
class Plant {
  constructor(x, y, type, terrain, biomeKey) {
    this.pos = createVector(x, y);
    this.type = type;
    this.terrain = terrain;
    this.biomeKey = biomeKey;
    
    const plantDef = PLANT_TYPES[type];
    this.baseNutrition = plantDef.nutrition;
    this.nutrition = plantDef.nutrition;
    this.maxNutrition = plantDef.nutrition;
    this.color = color(plantDef.color);
    this.size = plantDef.size;
    this.baseGrowthTime = plantDef.growthTime;
    this.growthTime = plantDef.growthTime;
    
    this.alive = true;
    this.regrowthTimer = 0;
    this.growth = 1.0;
    this.seasonalModifier = 1.0;
  }
  
  update(seasonManager) {
    // Get seasonal modifier for this biome
    this.seasonalModifier = seasonManager.getPlantModifier(this.biomeKey);
    
    // Adjust nutrition based on season
    this.maxNutrition = this.baseNutrition * this.seasonalModifier;
    
    if (!this.alive) {
      // Regrowth speed affected by season
      this.regrowthTimer += this.seasonalModifier;
      this.growthTime = this.baseGrowthTime / max(0.3, this.seasonalModifier);
      
      if (this.regrowthTimer >= this.growthTime) {
        this.alive = true;
        this.growth = 0.3;
        this.regrowthTimer = 0;
      }
    } else if (this.growth < 1.0) {
      this.growth += 0.002 * this.seasonalModifier;
      this.nutrition = this.maxNutrition * this.growth;
    } else {
      this.nutrition = this.maxNutrition;
    }
  }
  
  consume() {
    const nutritionGained = this.nutrition;
    this.alive = false;
    this.growth = 0;
    this.nutrition = 0;
    this.regrowthTimer = 0;
    return nutritionGained;
  }
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    let displaySize = this.size * this.growth;
    
    // Seasonal color modification
    let seasonColor = this.color;
    if (this.seasonalModifier < 0.5) {
      // Wilted/dormant - brownish
      seasonColor = lerpColor(this.color, color(139, 119, 101), 1 - this.seasonalModifier * 2);
      displaySize *= (0.7 + this.seasonalModifier * 0.6);
    } else if (this.seasonalModifier > 1.0) {
      // Thriving - more vibrant
      seasonColor = lerpColor(this.color, color(50, 205, 50), (this.seasonalModifier - 1) * 0.5);
    }
    
    noStroke();
    fill(0, 0, 0, 20);
    ellipse(1, 1, displaySize * 1.2, displaySize * 0.6);
    
    fill(seasonColor);
    if (this.type === 'tussock') {
      for (let i = -2; i <= 2; i++) ellipse(i * 0.8, 0, 1.5, displaySize * random(0.8, 1.2));
    } else if (this.type === 'flax') {
      for (let i = -1; i <= 1; i++) {
        beginShape();
        vertex(i * 2, 0);
        vertex(i * 1.5, -displaySize * 1.5);
        vertex(i * 2.5, 0);
        endShape(CLOSE);
      }
    } else if (this.type === 'fern') {
      ellipse(0, 0, displaySize, displaySize * 0.8);
    } else {
      for (let i = 0; i < 4; i++) {
        let angle = i * HALF_PI;
        ellipse(cos(angle) * displaySize * 0.3, sin(angle) * displaySize * 0.3, displaySize * 0.5, displaySize * 0.5);
      }
    }
    pop();
  }
}
