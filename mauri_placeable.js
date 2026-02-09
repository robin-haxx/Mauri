// ============================================
// PLACEABLE SPRITES (loaded in preload)
// ============================================
let placeableSprites = {
  cloud1: null,
  cloud2: null,
  bolt: null,
  loaded: false
};


function loadPlaceableSprites() {
  placeableSprites.cloud1 = loadImage('sprites/cloud1.png');
  placeableSprites.cloud2 = loadImage('sprites/cloud2.png');
  placeableSprites.bolt = loadImage('sprites/bolt.png');
  placeableSprites.loaded = true;
}

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
      if (typeof audioManager !== 'undefined' && audioManager) {
        audioManager.playPlantRustle();
      }
    }
    
    // Decoy-specific: thunderstorm effect
    if (this.type === 'decoy') {
      this._initThunderstorm();
    }
  }
  
  // ============================================
  // THUNDERSTORM EFFECT (Decoy)
  // ============================================
  
  _initThunderstorm() {
    // Create cloud particles
    this.clouds = [];
    const cloudCount = 4 + Math.floor(random(2)); // 4-5 clouds
    
    for (let i = 0; i < cloudCount; i++) {
      this.clouds.push(this._createCloud(i, cloudCount));
    }
    
    // Bolt state
    this.boltActive = false;
    this.boltTimer = random(40, 80); // Frames until next bolt
    this.boltDuration = 0;
    this.boltX = 0;
    this.boltY = 0;
    this.boltScale = 1;
    this.boltRotation = 0;
  }
  
  _createCloud(index, total) {
    // Distribute clouds around the radius
    const angle = (index / total) * TWO_PI + random(-0.3, 0.3);
    const dist = random(this.radius * 0.2, this.radius * 0.7);
    
    return {
      x: cos(angle) * dist,
      y: sin(angle) * dist,
      // Movement
      vx: random(-0.3, 0.3),
      vy: random(-0.2, 0.2),
      // Which sprite to use
      spriteType: random() < 0.5 ? 'cloud1' : 'cloud2',
      // Size variation
      scale: random(0.5, 0.9),
      // Subtle bob animation
      bobPhase: random(TWO_PI),
      bobSpeed: random(0.02, 0.04),
      // Opacity
      alpha: random(180, 255)
    };
  }
  
  _updateThunderstorm(dt = 1) {
    const lifeRatio = (this.life / this.maxLife);
    
    // Update clouds
    for (let cloud of this.clouds) {
      // Move cloud
      cloud.x += cloud.vx * dt;
      cloud.y += cloud.vy * dt;
      
      // Bob animation
      cloud.bobPhase += cloud.bobSpeed * dt;
      
      // Keep clouds within radius (soft boundary)
      const distSq = cloud.x * cloud.x + cloud.y * cloud.y;
      const maxDist = this.radius * 0.8;
      
      if (distSq > maxDist * maxDist) {
        // Steer back toward center
        const dist = Math.sqrt(distSq);
        const pushBack = (dist - maxDist) * 0.02;
        cloud.vx -= (cloud.x / dist) * pushBack;
        cloud.vy -= (cloud.y / dist) * pushBack;
      }
      
      // Add slight random drift
      cloud.vx += random(-0.01, 0.01) * dt;
      cloud.vy += random(-0.01, 0.01) * dt;
      
      // Dampen velocity
      cloud.vx *= 0.99;
      cloud.vy *= 0.99;
      
      // Fade clouds as life decreases
      cloud.alpha = 100+(lerp(255, cloud.alpha, lifeRatio));
    }
    
    // Update bolt
    if (this.boltActive) {
      this.boltDuration -= dt;
      if (this.boltDuration <= 0) {
        this.boltActive = false;
        this.boltTimer = random(50, 100); // Time until next bolt
      }
    } else {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this._triggerBolt();
      }
    }
  }
  
  _triggerBolt() {
    this.boltActive = true;
    this.boltDuration = random(4, 8); // Flash duration in frames
    
    // Random position within radius (bias toward center)
    const angle = random(TWO_PI);
    const dist = random(0, this.radius * 0.5);
    this.boltX = cos(angle) * dist;
    this.boltY = sin(angle) * dist;
    
    // Random variations
    this.boltScale = random(0.6, 1.0);
    this.boltRotation = random(-0.3, 0.3);
  }
  
  _renderThunderstorm(lifeRatio) {
    if (!placeableSprites.loaded) {
      // Fallback if sprites not loaded
      this._renderDecoyFallback(lifeRatio);
      return;
    }
    
    push();
    imageMode(CENTER);
    
    // Render clouds
    for (let cloud of this.clouds) {
      const sprite = placeableSprites[cloud.spriteType];
      if (!sprite) continue;
      
      const bobOffset = sin(cloud.bobPhase) * 2;
      const size = 64 * cloud.scale;
      
      tint(255, cloud.alpha * lifeRatio);
      image(sprite, cloud.x, cloud.y + bobOffset, size, size);
    }
    
    // Render bolt
    if (this.boltActive && placeableSprites.bolt) {
      push();
      translate(this.boltX, this.boltY);
      rotate(this.boltRotation);
      
      // Bright flash effect
      const flashIntensity = (this.boltDuration / 8) * 255;
      tint(255, 255, 200, min(255, flashIntensity + 150));
      
      const boltSize = 64 * this.boltScale;
      image(placeableSprites.bolt, 0, 0, boltSize, boltSize);
      
      // Screen flash on first frame of bolt
      if (this.boltDuration > 6) {
        noTint();
        fill(255, 255, 200, 60);
        noStroke();
        ellipse(0, 0, this.radius * 1.5, this.radius * 1.5);
      }
      
      pop();
    }
    
    noTint();
    pop();
  }
  
  _renderDecoyFallback(lifeRatio) {
    // Original simple rendering as fallback
    fill(200, 100, 80, 220 * lifeRatio);
    ellipse(0, 0, 10, 10);
    fill(240, 200, 150, 220 * lifeRatio);
    ellipse(0, 0, 5, 5);
  }
  
  // ============================================
  // PLANT SPAWNING
  // ============================================
  
  spawnPlantsInRadius() {
    const plantType = this.def.plantType || 'tussock';
    
    for (let i = 0; i < this.def.plantSpawnCount; i++) {
      let angle = random(TWO_PI);
      let dist = random(5, this.radius * 0.8);
      let px = this.pos.x + cos(angle) * dist;
      let py = this.pos.y + sin(angle) * dist;
      
      if (this.terrain.isWalkable(px, py)) {
        let biome = this.terrain.getBiomeAt(px, py);
        let plant = new Plant(px, py, plantType, this.terrain, biome.key);
        plant.isSpawned = true;
        plant.parentPlaceable = this;
        plant.growth = 0.8;
        
        this.spawnedPlants.push(plant);
        this.simulation.plants.push(plant);
      }
    }
  }
  
  // ============================================
  // SEASONAL BONUS
  // ============================================
  
  updateSeasonalBonus() {
    if (this.def.seasonalBonus && this.seasonManager) {
      const currentSeason = this.seasonManager.currentKey;
      this.seasonalMultiplier = this.def.seasonalBonus[currentSeason] || 1.0;
      
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
  
  // ============================================
  // UPDATE
  // ============================================
  
  update(dt = 1) {
    this.life -= dt;
    
    if (this.life <= 0) {
      this.destroy();
      return;
    }
    
    this.updateSeasonalBonus();
    this.feedingMoa = [];
    this.updateParticles(dt);
    
    // Update decoy thunderstorm
    if (this.type === 'decoy' && this.clouds) {
      this._updateThunderstorm(dt);
    }
  }
  
  // ============================================
  // FEEDING
  // ============================================
  
  feedMoa(moa, dt = 1) {
    if (!this.def.feedingRate) return 0;
    
    let rate = this.def.baseFeedingRate * this.seasonalMultiplier * dt;
    
    if (!this.feedingMoa.includes(moa)) {
      this.feedingMoa.push(moa);
    }
    
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
  
  updateParticles(dt = 1) {
    for (let i = this.feedingParticles.length - 1; i >= 0; i--) {
      let p = this.feedingParticles[i];
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.feedingParticles.splice(i, 1);
      }
    }
  }
  
  // ============================================
  // ATTRACTION
  // ============================================
  
  getAttractionStrength(moa) {
    if (!this.alive) return 0;
    
    let strength = 0;
    
    if (this.def.attractsHungryMoa && moa.hunger > 25) {
      strength = (moa.hunger / 100) * (this.def.attractionStrength || 1.0);
      strength *= this.seasonalMultiplier;
    }
    
    if (this.def.attractsReadyMoa && moa.canLayEgg && moa.hunger < moa.config.layingHungerThreshold) {
      strength = (this.def.attractionStrength || 1.0) * 1.5;
      strength *= this.seasonalMultiplier;
    }
    
    if (this.def.attractsMoa) {
      strength = max(strength, (this.def.attractionStrength || 1.0) * 0.5);
    }
    
    return strength;
  }
  
  isInRange(pos) {
    return p5.Vector.dist(this.pos, pos) < this.radius;
  }
  
  // ============================================
  // DESTROY
  // ============================================
  
  destroy() {
    this.alive = false;
    
    for (let plant of this.spawnedPlants) {
      plant.alive = false;
    }
  }
  
  // ============================================
  // RENDER
  // ============================================
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    let lifeRatio = this.life / this.maxLife;
    let pulse = sin(frameCount * 0.05 + this.pulsePhase) * 0.1 + 1;
    
    // Decoy has special rendering
    if (this.type === 'decoy') {
      this._renderDecoy(lifeRatio, pulse);
      pop();
      return;
    }
    
    // Standard placeable rendering
    this._renderStandard(lifeRatio, pulse);
    
    pop();
    
    this.renderParticles();
  }
  
  _renderDecoy(lifeRatio, pulse) {
    // Subtle radius indicator (darker, stormy)
    let radiusAlpha = (20 + sin(frameCount * 0.03 + this.pulsePhase) * 10) * lifeRatio;
    
    noFill();
    stroke(100, 100, 120, radiusAlpha);
    strokeWeight(1);
    ellipse(0, 0, this.radius * 2 * pulse, this.radius * 2 * pulse);
    
    // Dark storm area
    fill(40, 40, 50, 30 * lifeRatio);
    noStroke();
    ellipse(0, 0, this.radius * 1.8, this.radius * 1.8);
    
    // Render thunderstorm effect
    this._renderThunderstorm(lifeRatio);
    
    // Life bar when low
    if (lifeRatio < 0.5) {
      fill(50, 50, 50, 150);
      rect(-10, this.radius * 0.6, 20, 3);
      fill(255, 200, 100, 200);
      rect(-10, this.radius * 0.6, 20 * lifeRatio, 3);
    }
  }
  
  _renderStandard(lifeRatio, pulse) {
    // Radius indicator
    let feedingBoost = this.feedingMoa.length > 0 ? 0.3 : 0;
    let radiusAlpha = (30 + sin(frameCount * 0.03 + this.pulsePhase) * 15 + feedingBoost * 50) * lifeRatio;
    
    noFill();
    
    // Seasonal effectiveness ring color
    let ringColor;
    if (this.seasonalMultiplier > 1.2) {
      ringColor = color(100, 255, 150, radiusAlpha);
    } else if (this.seasonalMultiplier < 0.7) {
      ringColor = color(255, 150, 100, radiusAlpha);
    } else {
      ringColor = color(255, 255, 255, radiusAlpha);
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
        
      // 'decoy' is handled separately in _renderDecoy
    }
  }
}