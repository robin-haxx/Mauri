// ============================================
// MOA CLASS - Species-aware implementation with Spatial Grid optimization
// ============================================
class Moa extends Boid {
  constructor(x, y, terrain, config, speciesData = null) {
    super(x, y, terrain);
    this.config = config;
    
    // Species-specific data (from registry or defaults)
    this.species = speciesData || this.getDefaultSpecies();
    const s = this.species.config;
    
    // Physical characteristics from species
    this.size = this.getSpeciesValue(s.size, 8, 11);
    this.bodyColor = this.generateBodyColor(s.bodyColor);
    
    // Movement from species
    this.baseSpeed = s.baseSpeed || 0.25;
    this.fleeSpeed = s.fleeSpeed || 0.6;
    this.starvingSpeedMultiplier = 0.6;
    this.maxSpeed = this.baseSpeed;
    this.maxForce = s.maxForce || 0.025;
    
    this.perceptionRadius = 35;
    this.separationDist = 50;
    this.fleeRadius = 85;
    
    // Behavior modifiers from species
    this.flockTendency = s.flockTendency || 0.8;
    this.curiosity = s.curiosity || 0.6;
    this.flightiness = s.flightiness || 0.7;
    
    // Special abilities from species
    this.eagleResistance = s.eagleResistance || 0;
    this.foragingBonus = s.foragingBonus || 1.0;
    this.camouflage = s.camouflage || 0;
    
    // Home range
    this.homeRange = createVector(x, y);
    this.homeRangeRadius = random(50, 90);
    this.homeRangeStrength = 0.12;
    
    // Visual
    this.legPhase = random(TWO_PI);
    this.hasCrest = s.hasCrest || false;
    if (this.hasCrest && s.crestColor) {
      this.crestColor = this.generateBodyColor(s.crestColor);
    }
    
    // State
    this.alive = true;
    this.panicLevel = 0;
    
    // Hunger from species
    this.hunger = random(15, 35);
    this.maxHunger = s.maxHunger || 100;
    this.baseHungerRate = s.baseHungerRate || 0.04;
    this.hungerRate = this.baseHungerRate;
    this.hungerThreshold = s.hungerThreshold || 35;
    this.criticalHunger = s.criticalHunger || 80;
    this.eatRadius = 14;
    
    // Foraging
    this.targetPlant = null;
    this.targetPlaceable = null;
    this.isForaging = false;
    this.isFeeding = false;
    this.feedingAt = null;
    this.lastFedTime = 0;
    
    // Reproduction from species
    this.baseSecurityTime = s.securityTimeBase || config.securityTimeToLay;
    this.securityTimeRequired = this.baseSecurityTime + 
      Math.floor(random(0, s.securityTimeVariation || config.securityTimeVariation));
    this.securityTime = 0;
    this.canLayEgg = true;
    this.eggCooldown = 0;
    this.eggCooldownTime = s.eggCooldownTime || 800;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    
    // Shelter & habitat
    this.inShelter = false;
    this.preferredElevation = s.preferredElevation || { min: 0.25, max: 0.70 };
    this.temperatureTolerance = s.temperatureTolerance || { cold: 0.6, heat: 0.6 };
    
    // Migration state
    this.isMigrating = false;
    this.migrationTarget = null;
    this.lastMigrationCheck = 0;
    this.migrationCooldown = 0;
    this.localFoodScore = 1.0;
    this.foodCheckTimer = 0;
    
    // Reusable vectors for behavior calculations (reduces GC pressure)
    this._separateForce = createVector();
    this._seekForce = createVector();
    this._fleeForce = createVector();
  }
  
  /**
   * Get default species data if none provided
   */
  getDefaultSpecies() {
    if (typeof REGISTRY !== 'undefined') {
      return REGISTRY.getSpecies('upland_moa') || { config: {} };
    }
    return { config: {} };
  }
  
  /**
   * Get a value from species config, handling range objects
   */
  getSpeciesValue(value, defaultMin, defaultMax) {
    if (!value) return random(defaultMin, defaultMax);
    if (typeof value === 'object' && 'min' in value && 'max' in value) {
      return random(value.min, value.max);
    }
    return value;
  }
  
  /**
   * Generate body color from species color config
   */
  generateBodyColor(colorConfig) {
    if (!colorConfig) {
      return color(random(90, 110), random(60, 75), random(28, 40));
    }
    
    const r = Array.isArray(colorConfig.r) ? random(colorConfig.r[0], colorConfig.r[1]) : colorConfig.r;
    const g = Array.isArray(colorConfig.g) ? random(colorConfig.g[0], colorConfig.g[1]) : colorConfig.g;
    const b = Array.isArray(colorConfig.b) ? random(colorConfig.b[0], colorConfig.b[1]) : colorConfig.b;
    
    return color(r, g, b);
  }
  
  /**
   * Get seasonal modifier for this species
   */
  getSeasonalModifier(season, stat) {
    const s = this.species.config;
    if (!s.seasonalModifiers || !s.seasonalModifiers[season]) {
      return 1.0;
    }
    return s.seasonalModifiers[season][stat] || 1.0;
  }
  
  /**
   * Calculate effective speed based on state and species
   */
  calculateSpeed(isFleeing, isStarving, seasonManager) {
    let speed = isFleeing ? this.fleeSpeed : this.baseSpeed;
    
    if (isStarving) {
      speed *= this.starvingSpeedMultiplier;
    }
    
    if (seasonManager) {
      const seasonKey = seasonManager.currentKey;
      speed *= this.getSeasonalModifier(seasonKey, 'speed');
    }
    
    return speed;
  }
  
  /**
   * Optimized separation using pre-filtered nearby boids
   */
  separateOptimized(nearbyMoas) {
    this._separateForce.set(0, 0);
    let count = 0;
    
    for (let i = 0; i < nearbyMoas.length; i++) {
      const other = nearbyMoas[i];
      if (!other.alive || other === this) continue;
      
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const distSq = dx * dx + dy * dy;
      const sepDistSq = this.separationDist * this.separationDist;
      
      if (distSq < sepDistSq && distSq > 0) {
        const invDistSq = 1 / distSq;
        this._separateForce.x += dx * invDistSq;
        this._separateForce.y += dy * invDistSq;
        count++;
      }
    }
    
    if (count > 0) {
      this._separateForce.div(count);
      this._separateForce.setMag(this.maxSpeed);
      this._separateForce.sub(this.vel);
      this._separateForce.limit(this.maxForce);
    }
    
    return this._separateForce;
  }
  
  /**
   * Optimized flee using coordinates to reduce vector creation
   */
  fleeOptimized(targetX, targetY, radius) {
    const dx = this.pos.x - targetX;
    const dy = this.pos.y - targetY;
    const distSq = dx * dx + dy * dy;
    const radiusSq = radius * radius;
    
    if (distSq < radiusSq && distSq > 0) {
      const d = Math.sqrt(distSq);
      const urgency = 1 - (d / radius);
      const speed = this.maxSpeed * (1 + urgency);
      
      this._fleeForce.set(dx, dy);
      this._fleeForce.setMag(speed);
      this._fleeForce.sub(this.vel);
      this._fleeForce.limit(this.maxForce * 2);
      
      return this._fleeForce;
    }
    
    this._fleeForce.set(0, 0);
    return this._fleeForce;
  }
  
  /**
   * Main behavior update - uses spatial grid queries via simulation
   */
  behave(simulation, mauri, seasonManager) {
    // Get seasonal modifiers for this species
    const seasonKey = seasonManager.currentKey;
    const hungerMod = this.getSeasonalModifier(seasonKey, 'hungerRate');
    
    // Apply species-adjusted hunger rate
    this.hungerRate = this.baseHungerRate * seasonManager.getHungerModifier() * hungerMod;
    this.hunger = min(this.hunger + this.hungerRate, this.maxHunger);
    
    // Get preferred elevation - blend species preference with seasonal
    const seasonalPref = seasonManager.getPreferredElevation();
    this.preferredElevation = this.blendElevationPreference(
      this.species.config.preferredElevation || seasonalPref,
      seasonalPref,
      0.5
    );
    
    if (this.eggCooldown > 0) {
      this.eggCooldown--;
      this.canLayEgg = this.eggCooldown <= 0;
    }
    
    this.assessLocalFood(simulation, seasonManager);
    
    // Get nearby entities using spatial grid
    const nearbyPlaceables = simulation.getNearbyPlaceables(this.pos.x, this.pos.y, 80);
    this.checkPlaceableEffects(nearbyPlaceables, simulation);
    
    // Get nearby eagles for threat detection
    const nearbyEagles = simulation.getNearbyEagles(this.pos.x, this.pos.y, this.fleeRadius * 1.5);
    
    // Check for threats - use species flightiness
    let dominated = false;
    let nearestThreatDist = Infinity;
    this.panicLevel = 0;
    
    const effectiveFleeRadius = this.fleeRadius * this.flightiness;
    
    for (let i = 0; i < nearbyEagles.length; i++) {
      const eagle = nearbyEagles[i];
      
      // Check camouflage
      if (this.camouflage > 0 && random() < this.camouflage) {
        continue;
      }
      
      const dx = eagle.pos.x - this.pos.x;
      const dy = eagle.pos.y - this.pos.y;
      const dSq = dx * dx + dy * dy;
      const d = Math.sqrt(dSq);
      
      if (this.inShelter && !eagle.isHunting()) continue;
      
      if (eagle.isHunting() && d < effectiveFleeRadius) {
        let fleeForce = this.fleeOptimized(eagle.pos.x, eagle.pos.y, effectiveFleeRadius);
        fleeForce.mult(2.5 * this.flightiness);
        this.applyForce(fleeForce);
        dominated = true;
        nearestThreatDist = min(nearestThreatDist, d);
        this.panicLevel = max(this.panicLevel, 1 - d / effectiveFleeRadius);
      } else if (d < effectiveFleeRadius * 0.5) {
        nearestThreatDist = min(nearestThreatDist, d);
      }
    }
    
    // Security time
    if (nearestThreatDist > effectiveFleeRadius * 0.8) {
      this.securityTime += this.securityBonus;
    } else {
      this.securityTime = 0;
    }
    
    // Speed calculation with seasonal modifiers
    let isStarving = this.hunger > this.criticalHunger;
    this.maxSpeed = this.calculateSpeed(dominated, isStarving, seasonManager);
    
    this.homeRangeStrength = 0.12;
    
    // Get nearby moas for flocking (use spatial grid)
    const nearbyMoas = simulation.getNearbyMoas(this.pos.x, this.pos.y, this.separationDist * 2);
    
    if (dominated) {
      this.isMigrating = false;
      this.isForaging = false;
      this.targetPlant = null;
      this.targetPlaceable = null;
      
      // Use species flock tendency for separation
      let sep = this.separateOptimized(nearbyMoas);
      sep.mult(0.5 * this.flockTendency);
      this.applyForce(sep);
    } else {
      this.tryLayEgg(simulation, mauri, nearbyPlaceables);
      
      let shouldMigrate = this.shouldMigrate(seasonManager);
      
      if (shouldMigrate || this.isMigrating) {
        this.migrateSeasonally(seasonManager);
        if (this.hunger > 60) {
          this.forage(simulation, mauri);
        }
      } else {
        let attracted = this.seekPlaceableAttractions(nearbyPlaceables, simulation);
        
        if (!attracted && this.hunger > this.hungerThreshold) {
          this.forage(simulation, mauri);
        } else if (!attracted && !this.isFeeding) {
          this.isForaging = false;
          this.targetPlant = null;
          this.targetPlaceable = null;
          
          let wander = this.wander().mult(0.4);
          this.applyForce(wander);
          
          let homeForce = this.stayInHomeRange();
          this.applyForce(homeForce);
        }
      }
      
      // Separation based on species flock tendency
      let sep = this.separateOptimized(nearbyMoas);
      sep.mult(0.8 * (2 - this.flockTendency));
      this.applyForce(sep);
    }
    
    let avoid = this.avoidUnwalkable().mult(2);
    this.applyForce(avoid);
    
    this.edges();
    
    if (this.hunger >= this.maxHunger) {
      this.alive = false;
    }
  }
  
  /**
   * Blend species elevation preference with seasonal preference
   */
  blendElevationPreference(speciesPref, seasonalPref, seasonalWeight) {
    return {
      min: lerp(speciesPref.min, seasonalPref.min, seasonalWeight),
      max: lerp(speciesPref.max, seasonalPref.max, seasonalWeight)
    };
  }
  
  /**
   * Find food with species foraging bonus - uses spatial grid
   */
  findNearestPlant(simulation) {
    // Foraging bonus increases search radius
    const searchRadius = 100 * this.foragingBonus;
    const nearbyPlants = simulation.getNearbyPlants(this.pos.x, this.pos.y, searchRadius);
    
    let nearest = null;
    let nearestScore = Infinity;
    
    for (let i = 0; i < nearbyPlants.length; i++) {
      const plant = nearbyPlants[i];
      if (!plant.alive || plant.growth < 0.5) continue;
      if (plant.seasonalModifier < 0.3 && this.hunger < 70) continue;
      
      const dx = plant.pos.x - this.pos.x;
      const dy = plant.pos.y - this.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      // Species foraging bonus affects scoring
      let score = d / this.foragingBonus;
      score /= plant.seasonalModifier;
      score /= (plant.nutrition / 30);
      
      const homeDx = this.homeRange.x - plant.pos.x;
      const homeDy = this.homeRange.y - plant.pos.y;
      const homeD = Math.sqrt(homeDx * homeDx + homeDy * homeDy);
      
      if (homeD < this.homeRangeRadius) {
        score *= 0.7;
      }
      
      if (plant.isSpawned) {
        score *= 0.6;
      }
      
      if (score < nearestScore) {
        nearestScore = score;
        nearest = plant;
      }
    }
    
    return nearest;
  }
  
  /**
   * Check if eagle attack is resisted (for larger moa species)
   */
  resistEagleAttack() {
    if (this.eagleResistance > 0 && random() < this.eagleResistance) {
      return true;
    }
    return false;
  }
  
  /**
   * Assess local food availability using spatial grid
   */
  assessLocalFood(simulation, seasonManager) {
    this.foodCheckTimer++;
    if (this.foodCheckTimer < 60) return;
    this.foodCheckTimer = 0;
    
    const nearbyPlants = simulation.getNearbyPlants(this.pos.x, this.pos.y, 60);
    
    let ediblePlants = 0;
    let totalNutrition = 0;
    
    for (let i = 0; i < nearbyPlants.length; i++) {
      const plant = nearbyPlants[i];
      if (plant.alive && !plant.dormant && plant.growth > 0.5) {
        ediblePlants++;
        totalNutrition += plant.nutrition;
      }
    }
    
    this.localFoodScore = min(1.0, ediblePlants / 8);
  }
  
  /**
   * Check effects from nearby placeables
   */
  checkPlaceableEffects(nearbyPlaceables, simulation) {
    this.inShelter = false;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    this.isFeeding = false;
    this.feedingAt = null;
    
    let hungerMod = 1;
    let feedingRateTotal = 0;
    
    for (let i = 0; i < nearbyPlaceables.length; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive || !p.isInRange(this.pos)) continue;
      
      if (p.def.blocksEagleVision) {
        this.inShelter = true;
      }
      
      if (p.def.securityBonus) {
        this.securityBonus = max(this.securityBonus, p.def.securityBonus * p.seasonalMultiplier);
      }
      
      if (p.def.eggSpeedBonus) {
        this.eggSpeedBonus = max(this.eggSpeedBonus, p.def.eggSpeedBonus * p.seasonalMultiplier);
      }
      
      if (p.def.hungerSlowdown) {
        hungerMod = min(hungerMod, p.def.hungerSlowdown);
      }
      
      if (p.def.feedingRate) {
        let rate = p.feedMoa(this);
        feedingRateTotal += rate;
        this.isFeeding = true;
        this.feedingAt = p;
      }
    }
    
    this.hungerRate = this.baseHungerRate * hungerMod;
    
    if (feedingRateTotal > 0) {
      this.hunger = max(0, this.hunger - feedingRateTotal);
      this.lastFedTime = frameCount;
    }
  }
  
  /**
   * Seek attraction from placeables
   */
  seekPlaceableAttractions(nearbyPlaceables, simulation) {
    let bestTarget = null;
    let bestScore = -Infinity;
    
    for (let i = 0; i < nearbyPlaceables.length; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive) continue;
      
      const dx = p.pos.x - this.pos.x;
      const dy = p.pos.y - this.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      let attractionStrength = p.getAttractionStrength(this);
      
      if (attractionStrength <= 0) continue;
      
      let score = attractionStrength * 50 - d * 0.3;
      
      if (this.hunger > 30 && p.def.feedingRate) {
        score += (this.hunger / 100) * 30 * p.seasonalMultiplier;
      }
      
      score *= p.seasonalMultiplier;
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = p;
      }
    }
    
    if (bestTarget && bestScore > 10) {
      let seekForce = this.seek(bestTarget.pos, 0.8);
      this.applyForce(seekForce);
      this.targetPlaceable = bestTarget;
      
      if (bestTarget.isInRange(this.pos)) {
        this.vel.mult(0.7);
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Forage for food using spatial grid
   */
  forage(simulation, mauri) {
    this.isForaging = true;
    
    // If being passively fed, stay in zone unless very hungry
    if (this.isFeeding && this.hunger < 60) {
      if (this.feedingAt) {
        const dx = this.feedingAt.pos.x - this.pos.x;
        const dy = this.feedingAt.pos.y - this.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        if (d > this.feedingAt.radius * 0.5) {
          let seekForce = this.seek(this.feedingAt.pos, 0.3);
          this.applyForce(seekForce);
        } else {
          let wander = this.wander().mult(0.2);
          this.applyForce(wander);
        }
      }
      return;
    }
    
    // Check placeable food sources using spatial grid
    const nearbyPlaceables = simulation.getNearbyPlaceables(this.pos.x, this.pos.y, 30);
    
    for (let i = 0; i < nearbyPlaceables.length; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive || !p.def.nutrition || p.foodRemaining <= 0) continue;
      if (p.isInRange(this.pos)) {
        let nutrition = p.consumeFood ? p.consumeFood(15) : 0;
        this.hunger = max(0, this.hunger - nutrition);
        mauri.earnFromEating(mauri.onMoaEat * 0.5, this.pos.x, this.pos.y);
        this.vel.mult(0.3);
        return;
      }
    }
    
    // Find nearest plant
    if (!this.targetPlant || !this.targetPlant.alive) {
      this.targetPlant = this.findNearestPlant(simulation);
    }
    
    if (this.targetPlant) {
      const dx = this.targetPlant.pos.x - this.pos.x;
      const dy = this.targetPlant.pos.y - this.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      if (d < this.eatRadius) {
        let nutrition = this.targetPlant.consume();
        this.hunger = max(0, this.hunger - nutrition);
        mauri.earnFromEating(mauri.onMoaEat, this.pos.x, this.pos.y);
        this.targetPlant = null;
        this.vel.mult(0.3);
        this.lastFedTime = frameCount;
      } else {
        let urgency = map(this.hunger, this.hungerThreshold, this.maxHunger, 0.5, 0.9);
        let seekForce = this.seek(this.targetPlant.pos, urgency);
        this.applyForce(seekForce);
      }
    } else {
      let wander = this.wander().mult(0.6);
      this.applyForce(wander);
    }
  }
  
  shouldMigrate(seasonManager) {
    let currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    let pref = this.preferredElevation;
    
    let elevationError = 0;
    if (currentElev < pref.min) {
      elevationError = pref.min - currentElev;
    } else if (currentElev > pref.max) {
      elevationError = currentElev - pref.max;
    }
    
    let shouldMigrate = false;
    
    if (elevationError > 0.08) {
      shouldMigrate = true;
    }
    
    if (this.localFoodScore < 0.3 && this.hunger > 30) {
      shouldMigrate = true;
    }
    
    if (elevationError > 0.03 && seasonManager.getMigrationStrength() > 0.7) {
      shouldMigrate = true;
    }
    
    return shouldMigrate;
  }

  findMigrationTarget(seasonManager) {
    let pref = this.preferredElevation;
    let targetElev = (pref.min + pref.max) / 2;
    
    let bestPos = null;
    let bestScore = -Infinity;
    
    for (let i = 0; i < 20; i++) {
      let angle = random(TWO_PI);
      let dist = random(50, 150);
      let testX = this.pos.x + cos(angle) * dist;
      let testY = this.pos.y + sin(angle) * dist;
      
      testX = constrain(testX, 20, this.terrain.mapWidth - 20);
      testY = constrain(testY, 20, this.terrain.mapHeight - 20);
      
      if (!this.terrain.isWalkable(testX, testY)) continue;
      
      let elev = this.terrain.getElevationAt(testX, testY);
      
      let elevError = abs(elev - targetElev);
      let score = 1 - (elevError * 5);
      
      if (elev >= pref.min && elev <= pref.max) {
        score += 0.5;
      }
      
      let currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
      if (currentElev < targetElev && elev > currentElev) {
        score += 0.3;
      } else if (currentElev > targetElev && elev < currentElev) {
        score += 0.3;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestPos = createVector(testX, testY);
      }
    }
    
    return bestPos;
  }
  
  migrateSeasonally(seasonManager) {
    if (this.migrationCooldown > 0) {
      this.migrationCooldown--;
    }
    
    if (frameCount - this.lastMigrationCheck < 30) {
      if (this.isMigrating && this.migrationTarget) {
        this.executeMigration(seasonManager);
      }
      return;
    }
    this.lastMigrationCheck = frameCount;
    
    if (!this.isMigrating && this.migrationCooldown <= 0) {
      if (this.shouldMigrate(seasonManager)) {
        this.migrationTarget = this.findMigrationTarget(seasonManager);
        if (this.migrationTarget) {
          this.isMigrating = true;
        }
      }
    }
    
    if (this.isMigrating) {
      this.executeMigration(seasonManager);
    }
  }
  
  executeMigration(seasonManager) {
    if (!this.migrationTarget) {
      this.isMigrating = false;
      return;
    }
    
    const dx = this.migrationTarget.x - this.pos.x;
    const dy = this.migrationTarget.y - this.pos.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    
    if (distToTarget < 20) {
      this.homeRange = this.migrationTarget.copy();
      this.isMigrating = false;
      this.migrationTarget = null;
      this.migrationCooldown = 300;
      return;
    }
    
    let migrationStrength = seasonManager.getMigrationStrength();
    let urgency = 0.5 + migrationStrength * 0.5;
    
    if (this.hunger > 50 && this.localFoodScore < 0.3) {
      urgency *= 1.5;
    }
    
    let seekForce = this.seek(this.migrationTarget, urgency);
    seekForce.mult(migrationStrength);
    this.applyForce(seekForce);
    
    this.homeRangeStrength = 0.02;
  }
  
  stayInHomeRange() {
    const dx = this.homeRange.x - this.pos.x;
    const dy = this.homeRange.y - this.pos.y;
    const distFromHome = Math.sqrt(dx * dx + dy * dy);
    
    if (distFromHome > this.homeRangeRadius) {
      let toHome = createVector(dx, dy);
      toHome.setMag(this.maxForce * this.homeRangeStrength);
      toHome.mult(1 + (distFromHome - this.homeRangeRadius) * 0.02);
      return toHome;
    }
    return createVector(0, 0);
  }
  
  tryLayEgg(simulation, mauri, nearbyPlaceables) {
    if (!this.canLayEgg) return;
    if (this.hunger > this.config.layingHungerThreshold) return;
    
    let requiredSecurity = this.securityTimeRequired;
    
    for (let i = 0; i < nearbyPlaceables.length; i++) {
      const p = nearbyPlaceables[i];
      if (p.alive && p.type === 'nest' && p.isInRange(this.pos)) {
        requiredSecurity *= 0.5;
        break;
      }
    }
    
    if (this.securityTime < requiredSecurity) return;
    if (simulation.getMoaPopulation() >= this.config.maxMoaPopulation) return;
    
    let egg = simulation.addEgg(this.pos.x, this.pos.y);
    egg.speedBonus = this.eggSpeedBonus;
    
    if (this.speciesKey) {
      egg.parentSpecies = this.speciesKey;
    }
    
    mauri.earn(mauri.onEggLaid, this.pos.x, this.pos.y, 'egg');
    
    this.securityTime = 0;
    this.canLayEgg = false;
    this.eggCooldown = this.eggCooldownTime;
    this.hunger += 25;
    this.homeRange = this.pos.copy();
    
    this.securityTimeRequired = this.baseSecurityTime + 
      Math.floor(random(0, this.species.config.securityTimeVariation || this.config.securityTimeVariation));
  }
  
  getElevationGradient() {
    const step = 5;
    let ex = this.terrain.getElevationAt(this.pos.x + step, this.pos.y) -
             this.terrain.getElevationAt(this.pos.x - step, this.pos.y);
    let ey = this.terrain.getElevationAt(this.pos.x, this.pos.y + step) -
             this.terrain.getElevationAt(this.pos.x, this.pos.y - step);
    return createVector(ex, ey).normalize().mult(this.maxForce);
  }
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    let angle = this.vel.heading();
    rotate(angle);
    
    let speed = this.vel.mag();
    let walkCycle = frameCount * 0.18 + this.legPhase;
    let legSwing = sin(walkCycle) * (0.5 + speed * 2);
    
    // Colors based on state
    let bodyCol = this.bodyColor;
    let neckCol = color(
      red(this.bodyColor) - 5,
      green(this.bodyColor) - 3,
      blue(this.bodyColor) - 3
    );
    
    if (this.panicLevel > 0) {
      bodyCol = lerpColor(this.bodyColor, color(150, 80, 60), this.panicLevel * 0.5);
      neckCol = lerpColor(neckCol, color(140, 75, 55), this.panicLevel * 0.5);
    } else if (this.hunger > this.criticalHunger) {
      bodyCol = lerpColor(this.bodyColor, color(70, 50, 35), 0.4);
      neckCol = lerpColor(neckCol, color(65, 45, 30), 0.4);
    } else if (this.isFeeding) {
      bodyCol = lerpColor(this.bodyColor, color(80, 100, 60), 0.2);
    } else if (this.isMigrating) {
      bodyCol = lerpColor(this.bodyColor, color(80, 80, 110), 0.15);
    }
    
    // Debug indicators
    if (CONFIG.debugMode) {
      noFill();
      strokeWeight(1);
      if (this.inShelter) {
        stroke(100, 200, 100, 100);
        ellipse(0, 0, this.size * 2.2, this.size * 2.2);
      }
      if (this.isMigrating) {
        stroke(100, 150, 255, 80);
        let migPulse = sin(frameCount * 0.1) * 2;
        ellipse(0, 0, this.size * 2 + migPulse, this.size * 2 + migPulse);
      }
      if (this.isFeeding) {
        stroke(150, 255, 150, 80);
        let feedPulse = sin(frameCount * 0.15) * 2;
        ellipse(0, 0, this.size * 1.8 + feedPulse, this.size * 1.8 + feedPulse);
      }
    }
    
    // Shadow
    noStroke();
    fill(0, 0, 0, 25);
    ellipse(1.5, 1.5, this.size * 1.0, this.size * 0.65);
    
    // Legs
    let legColor = color(60, 42, 25);
    let legLength = this.size * 0.55;
    let legAttachX = -this.size * 0.1;
    
    stroke(legColor);
    strokeWeight(1.8);
    
    // Left leg
    let leftLegEndX = legAttachX - legLength * 0.7 + legSwing * 2;
    let leftLegEndY = -this.size * 0.35;
    line(legAttachX, -this.size * 0.18, legAttachX - legLength * 0.3, -this.size * 0.28);
    line(legAttachX - legLength * 0.3, -this.size * 0.28, leftLegEndX, leftLegEndY);
    strokeWeight(1.2);
    line(leftLegEndX, leftLegEndY, leftLegEndX - 3, leftLegEndY - 2.5);
    line(leftLegEndX, leftLegEndY, leftLegEndX - 4, leftLegEndY);
    line(leftLegEndX, leftLegEndY, leftLegEndX - 3, leftLegEndY + 2.5);
    
    // Right leg
    let rightLegEndX = legAttachX - legLength * 0.7 - legSwing * 2;
    let rightLegEndY = this.size * 0.35;
    strokeWeight(1.8);
    line(legAttachX, this.size * 0.18, legAttachX - legLength * 0.3, this.size * 0.28);
    line(legAttachX - legLength * 0.3, this.size * 0.28, rightLegEndX, rightLegEndY);
    strokeWeight(1.2);
    line(rightLegEndX, rightLegEndY, rightLegEndX - 3, rightLegEndY - 2.5);
    line(rightLegEndX, rightLegEndY, rightLegEndX - 4, rightLegEndY);
    line(rightLegEndX, rightLegEndY, rightLegEndX - 3, rightLegEndY + 2.5);
    
    // Tail
    noStroke();
    fill(red(bodyCol) - 20, green(bodyCol) - 15, blue(bodyCol) - 10);
    beginShape();
    vertex(-this.size * 0.35, 0);
    vertex(-this.size * 0.55, -this.size * 0.12);
    vertex(-this.size * 0.48, 0);
    vertex(-this.size * 0.55, this.size * 0.12);
    endShape(CLOSE);
    
    // Body
    noStroke();
    fill(bodyCol);
    ellipse(-2, 0, this.size * 0.85, this.size * 0.65);
    
    // Body feather texture
    fill(red(bodyCol) + 8, green(bodyCol) + 5, blue(bodyCol) + 3, 80);
    ellipse(-this.size * 0.05, -this.size * 0.08, this.size * 0.3, this.size * 0.15);
    ellipse(-this.size * 0.05, this.size * 0.08, this.size * 0.3, this.size * 0.15);
    
    // Neck
    fill(neckCol);
    noStroke();
    beginShape();
    vertex(this.size * 0.2, -this.size * 0.12);
    vertex(this.size * 0.2, this.size * 0.12);
    vertex(this.size * 0.52, this.size * 0.07);
    vertex(this.size * 0.52, -this.size * 0.07);
    endShape(CLOSE);
    
    // Head
    fill(bodyCol);
    ellipse(this.size * 0.6, 0, this.size * 0.28, this.size * 0.24);
    
    // Crest (for species that have it)
    if (this.hasCrest) {
      fill(this.crestColor || color(140, 100, 60));
      beginShape();
      vertex(this.size * 0.5, -this.size * 0.12);
      vertex(this.size * 0.55, -this.size * 0.22);
      vertex(this.size * 0.62, -this.size * 0.18);
      vertex(this.size * 0.68, -this.size * 0.25);
      vertex(this.size * 0.72, -this.size * 0.15);
      vertex(this.size * 0.65, -this.size * 0.1);
      endShape(CLOSE);
    }
    
    // Head highlight
    fill(red(bodyCol) + 10, green(bodyCol) + 8, blue(bodyCol) + 5, 100);
    ellipse(this.size * 0.58, 0, this.size * 0.15, this.size * 0.1);
    
    // Eyes
    let eyeX = this.size * 0.57;
    let eyeOffsetY = this.size * 0.085;
    let eyeSize = this.size * 0.08;
    
    fill(240, 235, 220);
    ellipse(eyeX, -eyeOffsetY, eyeSize + 1, eyeSize + 1);
    ellipse(eyeX, eyeOffsetY, eyeSize + 1, eyeSize + 1);
    
    fill(25, 20, 15);
    ellipse(eyeX + 0.3, -eyeOffsetY, eyeSize, eyeSize);
    ellipse(eyeX + 0.3, eyeOffsetY, eyeSize, eyeSize);
    
    fill(255, 255, 255, 180);
    ellipse(eyeX + 0.8, -eyeOffsetY - 0.5, eyeSize * 0.4, eyeSize * 0.4);
    ellipse(eyeX + 0.8, eyeOffsetY - 0.5, eyeSize * 0.4, eyeSize * 0.4);
    
    // Beak
    fill(70, 55, 35);
    stroke(50, 40, 25);
    strokeWeight(0.5);
    beginShape();
    vertex(this.size * 0.68, -this.size * 0.04);
    vertex(this.size * 0.88, -this.size * 0.01);
    vertex(this.size * 0.9, 0);
    vertex(this.size * 0.88, this.size * 0.01);
    vertex(this.size * 0.68, this.size * 0.04);
    vertex(this.size * 0.7, 0);
    endShape(CLOSE);
    
    stroke(50, 40, 25);
    strokeWeight(0.5);
    line(this.size * 0.7, 0, this.size * 0.88, 0);
    
    noStroke();
    fill(40, 30, 20);
    ellipse(this.size * 0.74, -this.size * 0.015, 1.2, 0.8);
    ellipse(this.size * 0.74, this.size * 0.015, 1.2, 0.8);
    
    pop();
    
    // Migration target line (debug)
    if (CONFIG.debugMode && this.isMigrating && this.migrationTarget && CONFIG.showHungerBars) {
      stroke(100, 150, 255, 40);
      strokeWeight(1);
      drawingContext.setLineDash([3, 3]);
      line(this.pos.x, this.pos.y, this.migrationTarget.x, this.migrationTarget.y);
      drawingContext.setLineDash([]);
    }
    
    if (CONFIG.showHungerBars) {
      this.renderStatusBars();
    }
  }

  renderStatusBars() {
    const barWidth = 14;
    const barHeight = 2;
    const yOffset = -this.size * 0.8 - 4;
    
    noStroke();
    
    // Hunger bar
    fill(40, 40, 40, 150);
    rect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth, barHeight, 1);
    
    let hungerPercent = this.hunger / this.maxHunger;
    let hungerColor = lerpColor(color(80, 180, 80), color(200, 60, 60), hungerPercent);
    fill(hungerColor);
    rect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth * (1 - hungerPercent), barHeight, 1);
    
    // Egg progress
    if (this.canLayEgg && this.hunger <= this.config.layingHungerThreshold) {
      let securityProgress = min(1, this.securityTime / this.securityTimeRequired);
      if (securityProgress > 0.1) {
        fill(40, 40, 40, 150);
        rect(this.pos.x - barWidth / 2, this.pos.y + yOffset - 3, barWidth, barHeight, 1);
        fill(220, 200, 100);
        rect(this.pos.x - barWidth / 2, this.pos.y + yOffset - 3, barWidth * securityProgress, barHeight, 1);
      }
    }
    
    // State indicators
    textAlign(CENTER, BOTTOM);
    textSize(6);
    
    let indicatorY = this.pos.y + yOffset - 5;
    let indicatorX = this.pos.x;
    
    if (this.isMigrating) {
      fill(100, 150, 255, 220);
      text("↗", indicatorX, indicatorY);
      indicatorX += 8;
    }
    
    if (this.localFoodScore < 0.3 && !this.isMigrating && !this.isFeeding) {
      fill(255, 180, 80, 220);
      text("!", indicatorX, indicatorY);
    }
    
    if (CONFIG.debugMode && this.species) {
      fill(200, 200, 200, 150);
      textSize(5);
      text(this.species.displayName || this.speciesKey, this.pos.x, this.pos.y + yOffset + 10);
    }
  }
}