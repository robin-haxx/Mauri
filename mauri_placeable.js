// ============================================
// PLACEABLE SPRITES 
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
    this.radiusSq = this.radius * this.radius;
    
    // Seasonal effectiveness
    this.seasonalMultiplier = 1.0;
    this.updateSeasonalBonus();
    
    // Feeding tracking
    this.feedingMoaCount = 0;
    
    // Visual effects
    this.pulsePhase = random(TWO_PI);
    this.feedingParticles = [];
    
    // Spawn plants if applicable
    this.spawnedPlants = [];
    if (this.def.plantSpawnCount) {
      this.spawnPlantsInRadius();
      if (audioManager) audioManager.playPlantRustle();
    }
    
    // Storm-specific
    if (this.type === 'Storm') {
      this._initThunderstorm();
    }
  }
  
  // ============================================
  // THUNDERSTORM EFFECT
  // ============================================
  
  _initThunderstorm() {
    this.clouds = [];
    const cloudCount = 4 + Math.floor(random(2));
    
    for (let i = 0; i < cloudCount; i++) {
      const angle = (i / cloudCount) * TWO_PI + random(-0.3, 0.3);
      const dist = random(this.radius * 0.2, this.radius * 0.7);
      
      this.clouds.push({
        x: cos(angle) * dist,
        y: sin(angle) * dist,
        vx: random(-0.3, 0.3),
        vy: random(-0.2, 0.2),
        spriteType: random() < 0.5 ? 'cloud1' : 'cloud2',
        scale: random(0.5, 0.9),
        bobPhase: random(TWO_PI),
        bobSpeed: random(0.02, 0.04),
        alpha: random(180, 255)
      });
    }
    
    this.boltActive = false;
    this.boltTimer = random(40, 80);
    this.boltDuration = 0;
    this.boltX = 0;
    this.boltY = 0;
    this.boltScale = 1;
    this.boltRotation = 0;
  }
  
  _updateThunderstorm(dt = 1) {
    const lifeRatio = this.life / this.maxLife;
    const maxDist = this.radius * 0.8;
    const maxDistSq = maxDist * maxDist;
    
    for (const cloud of this.clouds) {
      cloud.x += cloud.vx * dt;
      cloud.y += cloud.vy * dt;
      cloud.bobPhase += cloud.bobSpeed * dt;
      
      // Soft boundary
      const distSq = cloud.x * cloud.x + cloud.y * cloud.y;
      if (distSq > maxDistSq) {
        const dist = Math.sqrt(distSq);
        const pushBack = (dist - maxDist) * 0.02;
        cloud.vx -= (cloud.x / dist) * pushBack;
        cloud.vy -= (cloud.y / dist) * pushBack;
      }
      
      cloud.vx += random(-0.01, 0.01) * dt;
      cloud.vy += random(-0.01, 0.01) * dt;
      cloud.vx *= 0.99;
      cloud.vy *= 0.99;
      cloud.alpha = 100 + lerp(255, cloud.alpha, lifeRatio);
    }
    
    // Bolt lifecycle
    if (this.boltActive) {
      this.boltDuration -= dt;
      if (this.boltDuration <= 0) {
        this.boltActive = false;
        this.boltTimer = random(50, 100);
      }
    } else {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) {
        this.boltActive = true;
        this.boltDuration = random(4, 8);
        const angle = random(TWO_PI);
        const dist = random(0, this.radius * 0.5);
        this.boltX = cos(angle) * dist;
        this.boltY = sin(angle) * dist;
        this.boltScale = random(0.6, 1.0);
        this.boltRotation = random(-0.3, 0.3);
      }
    }
  }
  
  _renderThunderstorm(lifeRatio) {
    if (!placeableSprites.loaded) return; // Sprites load in preload; fallback unnecessary
    
    push();
    imageMode(CENTER);
    
    for (const cloud of this.clouds) {
      const sprite = placeableSprites[cloud.spriteType];
      if (!sprite) continue;
      
      const size = 64 * cloud.scale;
      tint(255, cloud.alpha * lifeRatio);
      image(sprite, cloud.x, cloud.y + sin(cloud.bobPhase) * 2, size, size);
    }
    
    if (this.boltActive && placeableSprites.bolt) {
      push();
      translate(this.boltX, this.boltY);
      rotate(this.boltRotation);
      
      tint(255, 255, 200, min(255, (this.boltDuration / 8) * 255 + 150));
      image(placeableSprites.bolt, 0, 0, 64 * this.boltScale, 64 * this.boltScale);
      
      // Screen flash on first frame
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
  
  // ============================================
  // PLANT SPAWNING
  // ============================================
  
  spawnPlantsInRadius() {
    const plantType = this.def.plantType || 'tussock';
    
    for (let i = 0; i < this.def.plantSpawnCount; i++) {
      const angle = random(TWO_PI);
      const dist = random(5, this.radius * 0.8);
      const px = this.pos.x + cos(angle) * dist;
      const py = this.pos.y + sin(angle) * dist;
      
      if (this.terrain.isWalkable(px, py)) {
        const biome = this.terrain.getBiomeAt(px, py);
        const plant = new Plant(px, py, plantType, this.terrain, biome.key);
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
    if (!this.def.seasonalBonus || !this.seasonManager) return;
    
    const currentSeason = this.seasonManager.currentKey;
    this.seasonalMultiplier = this.def.seasonalBonus[currentSeason] || 1.0;
    
    if (this.seasonManager.transitionProgress > 0) {
      const nextSeason = this.seasonManager.seasonOrder[
        (this.seasonManager.currentSeasonIndex + 1) % 4
      ];
      const nextMultiplier = this.def.seasonalBonus[nextSeason] || 1.0;
      this.seasonalMultiplier = lerp(this.seasonalMultiplier, nextMultiplier, this.seasonManager.transitionProgress);
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
    this.feedingMoaCount = 0;
    this.updateParticles(dt);
    
    if (this.type === 'Storm' && this.clouds) {
      this._updateThunderstorm(dt);
    }
  }
  
  // ============================================
  // FEEDING
  // ============================================
  
  feedMoa(moa, dt = 1) {
    if (!this.def.feedingRate) return 0;
    
    this.feedingMoaCount++;
    
    if (frameCount % 15 === 0) {
      this.spawnFeedingParticle(moa.pos.x, moa.pos.y);
    }
    
    return this.def.baseFeedingRate * this.seasonalMultiplier * dt;
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
    const particles = this.feedingParticles;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles[i] = particles[particles.length - 1];
        particles.pop();
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
      strength = (moa.hunger / 100) * (this.def.attractionStrength || 1.0) * this.seasonalMultiplier;
    }
    
    // Note: attractsReadyMoa uses pregnancy system now (moa.isPregnant)
    if (this.def.attractsReadyMoa && moa.isPregnant && moa.hunger < (moa.config?.layingHungerThreshold || 28)) {
      strength = (this.def.attractionStrength || 1.0) * 1.5 * this.seasonalMultiplier;
    }
    
    if (this.def.attractsMoa) {
      strength = max(strength, (this.def.attractionStrength || 1.0) * 0.5);
    }
    
    return strength;
  }
  
  isInRange(pos) {
    const dx = this.pos.x - pos.x;
    const dy = this.pos.y - pos.y;
    return dx * dx + dy * dy < this.radiusSq;
  }
  
  // ============================================
  // DESTROY
  // ============================================
  
  destroy() {
    this.alive = false;
    for (const plant of this.spawnedPlants) plant.alive = false;
  }
  
  // ============================================
  // RENDER
  // ============================================
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    const lifeRatio = this.life / this.maxLife;
    const pulse = sin(frameCount * 0.05 + this.pulsePhase) * 0.1 + 1;
    
    if (this.type === 'Storm') {
      this._renderStorm(lifeRatio, pulse);
      pop();
      return;
    }
    
    this._renderStandard(lifeRatio, pulse);
    pop();
    
    this.renderParticles();
  }
  
  // Shared life bar (was duplicated between storm and standard)
  _renderLifeBar(lifeRatio, yPos) {
    if (lifeRatio >= 0.5) return;
    fill(50, 50, 50, 150);
    rect(-10, yPos, 20, 3);
    fill(255, 200, 100, 200);
    rect(-10, yPos, 20 * lifeRatio, 3);
  }
  
  _renderStorm(lifeRatio, pulse) {
    noFill();
    const radiusAlpha = (20 + sin(frameCount * 0.03 + this.pulsePhase) * 10) * lifeRatio;
    stroke(100, 100, 120, radiusAlpha);
    strokeWeight(1);
    ellipse(0, 0, this.radius * 2 * pulse, this.radius * 2 * pulse);
    
    fill(40, 40, 50, 30 * lifeRatio);
    noStroke();
    ellipse(0, 0, this.radius * 1.8, this.radius * 1.8);
    
    this._renderThunderstorm(lifeRatio);
    this._renderLifeBar(lifeRatio, this.radius * 0.6);
  }
  
  _renderStandard(lifeRatio, pulse) {
    const isFeeding = this.feedingMoaCount > 0;
    const radiusAlpha = (30 + sin(frameCount * 0.03 + this.pulsePhase) * 15 + (isFeeding ? 15 : 0)) * lifeRatio;
    
    // Seasonal ring color
    noFill();
    if (this.seasonalMultiplier > 1.2) {
      stroke(100, 255, 150, radiusAlpha);
    } else if (this.seasonalMultiplier < 0.7) {
      stroke(255, 150, 100, radiusAlpha);
    } else {
      stroke(255, 255, 255, radiusAlpha);
    }
    
    strokeWeight(isFeeding ? 2 : 1);
    ellipse(0, 0, this.radius * 2 * pulse, this.radius * 2 * pulse);
    
    // Inner glow when feeding
    if (isFeeding) {
      const col = this.def._parsedColor;
      fill(red(col), green(col), blue(col), (sin(frameCount * 0.1) * 0.3 + 0.5) * 80);
      noStroke();
      ellipse(0, 0, this.radius * 1.5, this.radius * 1.5);
    }
    
    // Types with spawned plants skip the central icon dot
    const hasSpawnedPlants = this.type === 'kawakawa' || this.type === 'harakeke';
    
    if (!hasSpawnedPlants) {
      // Main icon background
      const col = this.def._parsedColor;
      let bgAlpha = 180 * lifeRatio;
      if (this.seasonalMultiplier > 1.0) bgAlpha = min(220, bgAlpha * this.seasonalMultiplier);
      
      noStroke();
      fill(red(col), green(col), blue(col), bgAlpha);
      ellipse(0, 0, 20, 20);
      
      // Border
      stroke(255, 255, 255, 150 * lifeRatio);
      strokeWeight(2);
      noFill();
      ellipse(0, 0, 20, 20);
    }
    
    // Type-specific rendering
    noStroke();
    this.renderTypeSpecific(lifeRatio);
    
    // Seasonal multiplier indicator
    if (this.seasonalMultiplier !== 1.0) {
      fill(255, 255, 255, 200 * lifeRatio);
      textSize(7);
      textAlign(CENTER, CENTER);
      text(
        this.seasonalMultiplier > 1.0 
          ? `+${((this.seasonalMultiplier - 1) * 100).toFixed(0)}%`
          : `-${((1 - this.seasonalMultiplier) * 100).toFixed(0)}%`,
        0, 14
      );
    }
    
    this._renderLifeBar(lifeRatio, 18);
  }
  
  renderParticles() {
    for (const p of this.feedingParticles) {
      fill(150, 255, 150, (p.life / p.maxLife) * 200);
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
        // Spawned plants provide visual detail; no icon overlay needed
        break;
        
      case 'shelter': {
        // Render a few fern sprites for natural canopy look
        const fernSprite = plantSprites.fern?.mature;
        if (fernSprite) {
          imageMode(CENTER);
          
          // 3-4 overlapping ferns at slight offsets and rotations
          const ferns = [
            { x: -14, y: -13, rot: -0.3, s: 32 },
            { x:  15, y: -11, rot:  0.4, s: 30 },
            { x:  0, y:  17, rot:  0.1, s: 34 },
            { x: -13, y:  13, rot: -0.5, s: 28 }
          ];
          
          for (const f of ferns) {
            push();
            translate(f.x, f.y);
            rotate(f.rot);
            image(fernSprite, 0, 0, f.s, f.s);
            pop();
          }
          
          noTint();
        } 
        break;
      }
        
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
        const ripple = (frameCount * 0.05) % 1;
        ellipse(0, 0, 8 + ripple * 8, 4 + ripple * 4);
        break;
        
      case 'harakeke':
        // Spawned plants provide visual detail; no icon overlay needed
        break;
    }
  }
}