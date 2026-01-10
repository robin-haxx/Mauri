// ============================================
// PLACEABLE OBJECT CLASS
// ============================================
class PlaceableObject {
  constructor(x, y, type, terrain, simulation, seasonManager) {
    this.pos = createVector(x, y);
    this.type = type;
    this.terrain = terrain;
    this.simulation = simulation;
    this.seasonManager = seasonManager;
    this.def = PLACEABLES[type];
    
    this.life = this.def.duration;
    this.maxLife = this.def.duration;
    this.alive = true;
    this.radius = this.def.radius;
    
    // Seasonal effectiveness
    this.seasonalMultiplier = 1.0;
    this.updateSeasonalBonus();
    
    // Track moa currently feeding here
    this.feedingMoa = [];
    
    // Visual effects
    this.pulsePhase = random(TWO_PI);
    this.feedingParticles = [];
    
    // Spawn plants if this is a feeding placeable
    this.spawnedPlants = [];
    if (this.def.plantSpawnCount) {
      this.spawnPlantsInRadius();
    }
  }
  
  spawnPlantsInRadius() {
    const plantType = this.def.plantType || 'tussock';
    
    for (let i = 0; i < this.def.plantSpawnCount; i++) {
      // Random position within radius
      let angle = random(TWO_PI);
      let dist = random(5, this.radius * 0.8);
      let px = this.pos.x + cos(angle) * dist;
      let py = this.pos.y + sin(angle) * dist;
      
      // Only spawn on walkable terrain
      if (this.terrain.isWalkable(px, py)) {
        let biome = this.terrain.getBiomeAt(px, py);
        let plant = new Plant(px, py, plantType, this.terrain, biome.key);
        plant.isSpawned = true;  // Mark as spawned by placeable
        plant.parentPlaceable = this;
        plant.growth = 0.8;  // Start mostly grown
        
        this.spawnedPlants.push(plant);
        this.simulation.plants.push(plant);
      }
    }
  }
  
  updateSeasonalBonus() {
    if (this.def.seasonalBonus && this.seasonManager) {
      const currentSeason = this.seasonManager.currentKey;
      this.seasonalMultiplier = this.def.seasonalBonus[currentSeason] || 1.0;
      
      // Blend during transition
      if (this.seasonManager.transitionProgress > 0) {
        const nextSeason = this.seasonManager.seasonOrder[
          (this.seasonManager.currentSeasonIndex + 1) % 4
        ];
        const nextMultiplier = this.def.seasonalBonus[nextSeason] || 1.0;
        this.seasonalMultiplier = lerp(
          this.seasonalMultiplier,
          nextMultiplier,
          this.seasonManager.transitionProgress
        );
      }
    }
  }
  
  update() {
    this.life--;
    
    if (this.life <= 0) {
      this.destroy();
      return;
    }
    
    // Update seasonal bonus
    this.updateSeasonalBonus();
    
    // Clear feeding list each frame
    this.feedingMoa = [];
    
    // Update particles
    this.updateParticles();
  }
  
  // Called by Moa when inside radius
  feedMoa(moa) {
    if (!this.def.feedingRate) return 0;
    
    // Calculate effective feeding rate
    let rate = this.def.baseFeedingRate * this.seasonalMultiplier;
    
    // Apply hunger slowdown if applicable
    if (this.def.hungerSlowdown) {
      // This is handled in moa's checkPlaceableEffects
    }
    
    // Add to feeding list for visual feedback
    if (!this.feedingMoa.includes(moa)) {
      this.feedingMoa.push(moa);
    }
    
    // Spawn feeding particle
    if (frameCount % 15 === 0 && this.feedingMoa.length > 0) {
      this.spawnFeedingParticle(moa.pos.x, moa.pos.y);
    }
    
    return rate;
  }
  
  spawnFeedingParticle(x, y) {
    this.feedingParticles.push({
      x: x + random(-5, 5),
      y: y,
      vy: -0.5,
      life: 30,
      maxLife: 30,
      size: random(2, 4)
    });
  }
  
  updateParticles() {
    for (let i = this.feedingParticles.length - 1; i >= 0; i--) {
      let p = this.feedingParticles[i];
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.feedingParticles.splice(i, 1);
      }
    }
  }
  
  getAttractionStrength(moa) {
    if (!this.alive) return 0;
    
    let strength = 0;
    
    // Hungry moa attracted to feeding placeables
    if (this.def.attractsHungryMoa && moa.hunger > 25) {
      strength = (moa.hunger / 100) * (this.def.attractionStrength || 1.0);
      strength *= this.seasonalMultiplier;  // More attractive when seasonally effective
    }
    
    // Ready-to-nest moa attracted to nests
    if (this.def.attractsReadyMoa && moa.canLayEgg && moa.hunger < moa.config.layingHungerThreshold) {
      strength = (this.def.attractionStrength || 1.0) * 1.5;
      strength *= this.seasonalMultiplier;
    }
    
    // General attraction
    if (this.def.attractsMoa) {
      strength = max(strength, (this.def.attractionStrength || 1.0) * 0.5);
    }
    
    return strength;
  }
  
  isInRange(pos) {
    return p5.Vector.dist(this.pos, pos) < this.radius;
  }
  
  destroy() {
    this.alive = false;
    
    // Remove spawned plants
    for (let plant of this.spawnedPlants) {
      plant.alive = false;
    }
  }
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    let lifeRatio = this.life / this.maxLife;
    let pulse = sin(frameCount * 0.05 + this.pulsePhase) * 0.1 + 1;
    
    // Radius indicator - brighter when moa are feeding
    let feedingBoost = this.feedingMoa.length > 0 ? 0.3 : 0;
    let radiusAlpha = (30 + sin(frameCount * 0.03 + this.pulsePhase) * 15 + feedingBoost * 50) * lifeRatio;
    
    noFill();
    
    // Seasonal effectiveness ring color
    let ringColor;
    if (this.seasonalMultiplier > 1.2) {
      ringColor = color(100, 255, 150, radiusAlpha);  // Green when very effective
    } else if (this.seasonalMultiplier < 0.7) {
      ringColor = color(255, 150, 100, radiusAlpha);  // Orange when less effective
    } else {
      ringColor = color(255, 255, 255, radiusAlpha);  // White normal
    }
    
    stroke(ringColor);
    strokeWeight(this.feedingMoa.length > 0 ? 2 : 1);
    ellipse(0, 0, this.radius * 2 * pulse, this.radius * 2 * pulse);
    
    // Inner glow when feeding
    if (this.feedingMoa.length > 0) {
      let glowAlpha = (sin(frameCount * 0.1) * 0.3 + 0.5) * 80;
      fill(red(this.def.color), green(this.def.color), blue(this.def.color), glowAlpha);
      noStroke();
      ellipse(0, 0, this.radius * 1.5, this.radius * 1.5);
    }
    
    // Main icon background
    noStroke();
    let col = color(this.def.color);
    let bgAlpha = 180 * lifeRatio;
    if (this.seasonalMultiplier > 1.0) {
      // Brighter when seasonally effective
      bgAlpha = min(220, bgAlpha * this.seasonalMultiplier);
    }
    fill(red(col), green(col), blue(col), bgAlpha);
    ellipse(0, 0, 20, 20);
    
    // Border
    stroke(255, 255, 255, 150 * lifeRatio);
    strokeWeight(2);
    noFill();
    ellipse(0, 0, 20, 20);
    
    // Type-specific icon
    noStroke();
    this.renderTypeSpecific(lifeRatio);
    
    // Seasonal multiplier indicator
    if (this.seasonalMultiplier !== 1.0) {
      fill(255, 255, 255, 200 * lifeRatio);
      textSize(7);
      textAlign(CENTER, CENTER);
      let multiplierText = this.seasonalMultiplier > 1.0 
        ? `+${((this.seasonalMultiplier - 1) * 100).toFixed(0)}%`
        : `-${((1 - this.seasonalMultiplier) * 100).toFixed(0)}%`;
      text(multiplierText, 0, 14);
    }
    
    // Life bar
    if (lifeRatio < 0.5) {
      fill(50, 50, 50, 150);
      rect(-10, 18, 20, 3);
      fill(255, 200, 100, 200);
      rect(-10, 18, 20 * lifeRatio, 3);
    }
    
    // Feeding count indicator
    if (this.feedingMoa.length > 0) {
      fill(100, 255, 150, 200);
      textSize(8);
      textAlign(CENTER, CENTER);
      text(`${this.feedingMoa.length}🐦`, 0, -14);
    }
    
    pop();
    
    // Render feeding particles
    this.renderParticles();
  }
  
  renderParticles() {
    for (let p of this.feedingParticles) {
      let alpha = (p.life / p.maxLife) * 200;
      fill(150, 255, 150, alpha);
      noStroke();
      ellipse(p.x, p.y, p.size, p.size);
    }
  }
  
  renderTypeSpecific(lifeRatio) {
    fill(255, 255, 255, 200 * lifeRatio);
    textSize(10);
    textAlign(CENTER, CENTER);
    
    switch(this.type) {
      case 'kawakawa':
        fill(45, 160, 80, 220 * lifeRatio);
        for (let i = 0; i < 5; i++) {
          let angle = i * TWO_PI / 5;
          ellipse(cos(angle) * 5, sin(angle) * 5, 5, 7);
        }
        break;
        
      case 'shelter':
        fill(30, 100, 55, 220 * lifeRatio);
        for (let i = 0; i < 6; i++) {
          push();
          rotate(i * TWO_PI / 6);
          ellipse(0, -5, 3, 8);
          pop();
        }
        break;
        
      case 'nest':
        fill(160, 130, 100, 220 * lifeRatio);
        ellipse(0, 0, 12, 8);
        fill(120, 95, 70, 220 * lifeRatio);
        ellipse(0, 0, 8, 5);
        break;
        
      case 'decoy':
        fill(200, 100, 80, 220 * lifeRatio);
        ellipse(0, 0, 10, 10);
        fill(240, 200, 150, 220 * lifeRatio);
        ellipse(0, 0, 5, 5);
        break;
        
      case 'waterhole':
        noFill();
        stroke(150, 200, 230, 150 * lifeRatio);
        strokeWeight(1);
        let ripple = (frameCount * 0.05) % 1;
        ellipse(0, 0, 8 + ripple * 8, 4 + ripple * 4);
        break;
        
      case 'harakeke':
        fill(100, 150, 70, 220 * lifeRatio);
        for (let i = -2; i <= 2; i++) {
          beginShape();
          vertex(i * 2, 3);
          vertex(i * 1.5, -8);
          vertex(i * 2 + 1, 3);
          endShape(CLOSE);
        }
        break;
    }
  }
}
