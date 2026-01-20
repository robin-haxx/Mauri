// ============================================
// MOA CLASS - Simplified and Optimized
// ============================================

const MOA_STATE = {
  IDLE: 'idle',
  FORAGING: 'foraging',
  FLEEING: 'fleeing',
  MIGRATING: 'migrating',
  FEEDING: 'feeding'
};

class Moa extends Boid {
  // Static defaults - single source of truth for species config
  static DEFAULTS = {
    size: { min: 8, max: 11 },
    baseSpeed: 0.25,
    fleeSpeed: 0.6,
    maxForce: 0.025,
    flockTendency: 0.8,
    curiosity: 0.6,
    flightiness: 0.7,
    eagleResistance: 0,
    foragingBonus: 1.0,
    camouflage: 0,
    maxHunger: 100,
    baseHungerRate: 0.04,
    hungerThreshold: 35,
    criticalHunger: 80,
    eggCooldownTime: 800,
    hasCrest: false,
    preferredElevation: { min: 0.25, max: 0.70 },
    temperatureTolerance: { cold: 0.6, heat: 0.6 }
  };

  // Shared static resources
  static TWO_PI = Math.PI * 2;
  static _tempVec = null;
  
  static getTempVec() {
    return Moa._tempVec || (Moa._tempVec = createVector());
  }

  constructor(x, y, terrain, config, speciesData = null) {
    super(x, y, terrain);
    this.config = config;
    
    // Species data with defaults
    this.species = speciesData || this.getDefaultSpecies();
    const s = { ...Moa.DEFAULTS, ...(this.species.config || {}) };
    this.speciesConfig = s;
    
    // Physical characteristics
    this.size = this.randomizeValue(s.size);
    this.bodyColor = this.generateBodyColor(s.bodyColor);
    this._initColors();
    
    // Movement
    this.baseSpeed = s.baseSpeed;
    this.fleeSpeed = s.fleeSpeed;
    this.starvingSpeedMultiplier = 0.6;
    this.maxSpeed = this.baseSpeed;
    this.maxForce = s.maxForce;
    
    // Perception (with pre-squared values for distance checks)
    this.perceptionRadius = 35;
    this.separationDist = 50;
    this.separationDistSq = 2500;
    this.fleeRadius = 85;
    this.fleeRadiusSq = 7225;
    
    // Behavior modifiers
    this.flockTendency = s.flockTendency;
    this.curiosity = s.curiosity;
    this.flightiness = s.flightiness;
    
    // Pre-calculate effective flee radius
    this._effectiveFleeRadius = this.fleeRadius * this.flightiness;
    this._effectiveFleeRadiusSq = this._effectiveFleeRadius * this._effectiveFleeRadius;
    
    // Special abilities
    this.eagleResistance = s.eagleResistance;
    this.foragingBonus = s.foragingBonus;
    this.camouflage = s.camouflage;
    
    // Home range
    this.homeRange = createVector(x, y);
    this.homeRangeRadius = random(50, 90);
    this.homeRangeRadiusSq = this.homeRangeRadius * this.homeRangeRadius;
    this.homeRangeStrength = 0.12;
    
    // Visual
    this.legPhase = random(Moa.TWO_PI);
    this.hasCrest = s.hasCrest;
    if (this.hasCrest && s.crestColor) {
      this.crestColor = this.generateBodyColor(s.crestColor);
    }
    
    // State
    this.alive = true;
    this.currentState = MOA_STATE.IDLE;
    this.panicLevel = 0;
    
    // Hunger
    this.hunger = random(15, 35);
    this.maxHunger = s.maxHunger;
    this.baseHungerRate = s.baseHungerRate;
    this.hungerRate = this.baseHungerRate;
    this.hungerThreshold = s.hungerThreshold;
    this.criticalHunger = s.criticalHunger;
    this.eatRadius = 14;
    this.eatRadiusSq = 196;
    
    // Foraging
    this.targetPlant = null;
    this.targetPlaceable = null;
    this.isForaging = false;
    this.isFeeding = false;
    this.feedingAt = null;
    this.lastFedTime = 0;
    
    // Reproduction
    this.baseSecurityTime = s.securityTimeBase || config.securityTimeToLay;
    this.securityTimeRequired = this.baseSecurityTime + 
      ((random() * (s.securityTimeVariation || config.securityTimeVariation)) | 0);
    this.securityTime = 0;
    this.canLayEgg = true;
    this.eggCooldown = 0;
    this.eggCooldownTime = s.eggCooldownTime;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    
    // Shelter & habitat
    this.inShelter = false;
    this.preferredElevation = s.preferredElevation;
    this.temperatureTolerance = s.temperatureTolerance;
    
    // Migration
    this.isMigrating = false;
    this.migrationTarget = null;
    this.lastMigrationCheck = 0;
    this.migrationCooldown = 0;
    this.localFoodScore = 1.0;
    this.foodCheckTimer = 0;
    
    // Single reusable vector for force calculations
    this._tempForce = createVector();
    
    // Cached size calculations (lazy-loaded)
    this._sizeCache = null;
  }

  // ============================================
  // INITIALIZATION HELPERS
  // ============================================

  getDefaultSpecies() {
    if (typeof REGISTRY !== 'undefined') {
      return REGISTRY.getSpecies('upland_moa') || { config: {} };
    }
    return { config: {} };
  }

  randomizeValue(val) {
    if (!val) return null;
    if (typeof val === 'object' && 'min' in val && 'max' in val) {
      return random(val.min, val.max);
    }
    return val;
  }

  generateBodyColor(colorConfig) {
    if (!colorConfig) {
      return color(random(90, 110), random(60, 75), random(28, 40));
    }
    
    const r = Array.isArray(colorConfig.r) ? random(colorConfig.r[0], colorConfig.r[1]) : colorConfig.r;
    const g = Array.isArray(colorConfig.g) ? random(colorConfig.g[0], colorConfig.g[1]) : colorConfig.g;
    const b = Array.isArray(colorConfig.b) ? random(colorConfig.b[0], colorConfig.b[1]) : colorConfig.b;
    
    return color(r, g, b);
  }

  _initColors() {
    const bc = this.bodyColor;
    const r = red(bc), g = green(bc), b = blue(bc);
    
    this._colors = {
      // Base colors
      body: bc,
      neck: color(r - 5, g - 3, b - 3),
      
      // State tint targets
      panic: color(lerp(r, 150, 0.5), lerp(g, 80, 0.5), lerp(b, 60, 0.5)),
      starving: color(lerp(r, 70, 0.4), lerp(g, 50, 0.4), lerp(b, 35, 0.4)),
      feeding: color(lerp(r, 80, 0.2), lerp(g, 100, 0.2), lerp(b, 60, 0.2)),
      migrating: color(lerp(r, 80, 0.15), lerp(g, 80, 0.15), lerp(b, 110, 0.15)),
      
      // Static colors
      leg: color(60, 42, 25),
      beak: color(70, 55, 35),
      beakStroke: color(50, 40, 25),
      beakNostril: color(40, 30, 20),
      eyeWhite: color(240, 235, 220),
      eyePupil: color(25, 20, 15),
      eyeHighlight: color(255, 255, 255, 180),
      shadow: color(0, 0, 0, 25)
    };
  }

  // Lazy-loaded size cache
  get sc() {
    if (!this._sizeCache || this._sizeCache._size !== this.size) {
      this._sizeCache = this._computeSizeCache();
    }
    return this._sizeCache;
  }

  _computeSizeCache() {
    const s = this.size;
    return {
      _size: s,
      // Body
      bodyW: s * 0.85, bodyH: s * 0.65,
      shadowW: s, shadowH: s * 0.65,
      // Legs
      legLen: s * 0.55, legAttachX: -s * 0.1,
      legY1: s * 0.18, legY2: s * 0.28, legY3: s * 0.35,
      // Tail
      tailX1: -s * 0.35, tailX2: -s * 0.55, tailX3: -s * 0.48, tailY: s * 0.12,
      // Neck
      neckX1: s * 0.2, neckX2: s * 0.52, neckY1: s * 0.12, neckY2: s * 0.07,
      // Head
      headX: s * 0.6, headW: s * 0.28, headH: s * 0.24,
      headHighX: s * 0.58, headHighW: s * 0.15, headHighH: s * 0.1,
      // Eyes
      eyeX: s * 0.57, eyeOffsetY: s * 0.085, eyeSize: s * 0.08,
      // Beak
      beakX1: s * 0.68, beakX2: s * 0.88, beakX3: s * 0.9, beakX4: s * 0.7, beakX5: s * 0.74,
      beakY1: s * 0.04, beakY2: s * 0.01, beakNostrilY: s * 0.015,
      // Crest
      crestX: [s * 0.5, s * 0.55, s * 0.62, s * 0.68, s * 0.72, s * 0.65],
      crestY: [-s * 0.12, -s * 0.22, -s * 0.18, -s * 0.25, -s * 0.15, -s * 0.1],
      // Status bars
      barYOffset: -s * 0.8 - 4
    };
  }

  _cacheSizeMultipliers() {
    this._sizeCache = this._computeSizeCache();
  }

  // ============================================
  // SEASONAL MODIFIERS
  // ============================================

  getSeasonalModifier(season, stat) {
    const mods = this.speciesConfig.seasonalModifiers;
    if (!mods || !mods[season]) return 1.0;
    return mods[season][stat] || 1.0;
  }

  calculateSpeed(isFleeing, isStarving, seasonManager) {
    let speed = isFleeing ? this.fleeSpeed : this.baseSpeed;
    if (isStarving) speed *= this.starvingSpeedMultiplier;
    if (seasonManager) speed *= this.getSeasonalModifier(seasonManager.currentKey, 'speed');
    return speed;
  }

  // ============================================
  // STATE MACHINE
  // ============================================

  updateState(nearbyEagles, nearbyPlaceables, seasonManager) {
    // Check for threats first (highest priority)
    if (this.detectThreats(nearbyEagles)) {
      return MOA_STATE.FLEEING;
    }
    
    // Check migration
    if (this.isMigrating || this.shouldMigrate(seasonManager)) {
      return MOA_STATE.MIGRATING;
    }
    
    // Check if being fed by placeable
    if (this.isFeeding) {
      return MOA_STATE.FEEDING;
    }
    
    // Check hunger
    if (this.hunger > this.hungerThreshold) {
      return MOA_STATE.FORAGING;
    }
    
    // Check placeable attractions
    if (this.hasPlaceableAttraction(nearbyPlaceables)) {
      return MOA_STATE.FORAGING;
    }
    
    return MOA_STATE.IDLE;
  }

  detectThreats(nearbyEagles) {
    const effectiveFleeRadiusSq = this._effectiveFleeRadiusSq;
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0, len = nearbyEagles.length; i < len; i++) {
      const eagle = nearbyEagles[i];
      
      // Check camouflage
      if (this.camouflage > 0 && random() < this.camouflage) continue;
      
      // Skip if in shelter and eagle not actively hunting
      if (this.inShelter && !eagle.isHunting()) continue;
      
      const dx = eagle.pos.x - px;
      const dy = eagle.pos.y - py;
      const dSq = dx * dx + dy * dy;
      
      if (eagle.isHunting() && dSq < effectiveFleeRadiusSq) {
        return true;
      }
    }
    return false;
  }

  hasPlaceableAttraction(nearbyPlaceables) {
    for (let i = 0, len = nearbyPlaceables.length; i < len; i++) {
      const p = nearbyPlaceables[i];
      if (p.alive && p.getAttractionStrength(this) > 0) {
        return true;
      }
    }
    return false;
  }

  // ============================================
  // MAIN BEHAVIOR UPDATE
  // ============================================

  behave(simulation, mauri, seasonManager) {
    // Update hunger
    this.updateHunger(seasonManager);
    
    // Update egg cooldown
    if (this.eggCooldown > 0) {
      this.eggCooldown--;
      if (this.eggCooldown <= 0) this.canLayEgg = true;
    }
    
    // Periodic food assessment
    this.assessLocalFood(simulation, seasonManager);
    
    // Get nearby entities
    const px = this.pos.x, py = this.pos.y;
    const nearbyPlaceables = simulation.getNearbyPlaceables(px, py, 80);
    const nearbyEagles = simulation.getNearbyEagles(px, py, this._effectiveFleeRadius * 1.5);
    const nearbyMoas = simulation.getNearbyMoas(px, py, this.separationDist * 2);
    
    // Apply placeable effects (shelter, feeding zones, etc.)
    this.checkPlaceableEffects(nearbyPlaceables);
    
    // Update preferred elevation based on season
    this.updatePreferredElevation(seasonManager);
    
    // Determine current state
    this.currentState = this.updateState(nearbyEagles, nearbyPlaceables, seasonManager);
    
    // Handle state-specific behavior
    switch (this.currentState) {
      case MOA_STATE.FLEEING:
        this.handleFleeing(nearbyEagles, nearbyMoas);
        break;
      case MOA_STATE.MIGRATING:
        this.handleMigrating(simulation, mauri, seasonManager);
        break;
      case MOA_STATE.FORAGING:
        this.handleForaging(simulation, mauri, nearbyPlaceables);
        break;
      case MOA_STATE.FEEDING:
        this.handleFeeding();
        break;
      case MOA_STATE.IDLE:
        this.handleIdle(nearbyPlaceables, simulation, mauri);
        break;
    }
    
    // Common behaviors
    this.applySeparation(nearbyMoas);
    this.applyTerrainAvoidance();
    this.edges();
    
    // Update security time for egg laying
    this.updateSecurityTime(nearbyEagles);
    
    // Try to lay egg if conditions are met
    if (this.currentState !== MOA_STATE.FLEEING) {
      this.tryLayEgg(simulation, mauri, nearbyPlaceables);
    }
    
    // Check death
    if (this.hunger >= this.maxHunger) {
      this.alive = false;
    }
  }

  updateHunger(seasonManager) {
    const seasonKey = seasonManager.currentKey;
    const hungerMod = this.getSeasonalModifier(seasonKey, 'hungerRate');
    this.hungerRate = this.baseHungerRate * seasonManager.getHungerModifier() * hungerMod;
    this.hunger += this.hungerRate;
    if (this.hunger > this.maxHunger) this.hunger = this.maxHunger;
  }

  updatePreferredElevation(seasonManager) {
    const seasonalPref = seasonManager.getPreferredElevation();
    const speciesPref = this.speciesConfig.preferredElevation || seasonalPref;
    this.preferredElevation = {
      min: (speciesPref.min + seasonalPref.min) * 0.5,
      max: (speciesPref.max + seasonalPref.max) * 0.5
    };
  }

  updateSecurityTime(nearbyEagles) {
    const safeDistSq = this._effectiveFleeRadiusSq * 0.64;
    let nearestThreatDistSq = Infinity;
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0, len = nearbyEagles.length; i < len; i++) {
      const eagle = nearbyEagles[i];
      const dx = eagle.pos.x - px;
      const dy = eagle.pos.y - py;
      const dSq = dx * dx + dy * dy;
      if (dSq < nearestThreatDistSq) nearestThreatDistSq = dSq;
    }
    
    if (nearestThreatDistSq > safeDistSq) {
      this.securityTime += this.securityBonus;
    } else {
      this.securityTime = 0;
    }
  }

  // ============================================
  // STATE HANDLERS
  // ============================================

  handleFleeing(nearbyEagles, nearbyMoas) {
    this.isMigrating = false;
    this.isForaging = false;
    this.targetPlant = null;
    this.targetPlaceable = null;
    this.panicLevel = 0;
    
    const effectiveFleeRadiusSq = this._effectiveFleeRadiusSq;
    const effectiveFleeRadius = this._effectiveFleeRadius;
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0, len = nearbyEagles.length; i < len; i++) {
      const eagle = nearbyEagles[i];
      
      if (this.camouflage > 0 && random() < this.camouflage) continue;
      if (this.inShelter && !eagle.isHunting()) continue;
      
      const dx = eagle.pos.x - px;
      const dy = eagle.pos.y - py;
      const dSq = dx * dx + dy * dy;
      
      if (eagle.isHunting() && dSq < effectiveFleeRadiusSq) {
        const fleeForce = this.fleeFrom(eagle.pos.x, eagle.pos.y, effectiveFleeRadiusSq);
        fleeForce.mult(2.5 * this.flightiness);
        this.applyForce(fleeForce);
        
        const d = Math.sqrt(dSq);
        const panic = 1 - d / effectiveFleeRadius;
        if (panic > this.panicLevel) this.panicLevel = panic;
      }
    }
    
    // Update speed for fleeing
    this.maxSpeed = this.calculateSpeed(true, this.hunger > this.criticalHunger, null);
    
    // Reduced separation while fleeing
    const sep = this.calculateSeparation(nearbyMoas);
    sep.mult(0.5 * this.flockTendency);
    this.applyForce(sep);
  }

  handleMigrating(simulation, mauri, seasonManager) {
    this.migrateSeasonally(seasonManager);
    
    // Opportunistic foraging during migration
    if (this.hunger > 60) {
      this.forage(simulation, mauri);
    }
    
    this.maxSpeed = this.calculateSpeed(false, this.hunger > this.criticalHunger, seasonManager);
  }

  handleForaging(simulation, mauri, nearbyPlaceables) {
    // First check placeable attractions
    const attracted = this.seekPlaceableAttractions(nearbyPlaceables);
    
    if (!attracted) {
      this.forage(simulation, mauri);
    }
    
    this.maxSpeed = this.calculateSpeed(false, this.hunger > this.criticalHunger, null);
  }

  handleFeeding() {
    // Slow down while feeding
    if (this.feedingAt) {
      const dx = this.feedingAt.pos.x - this.pos.x;
      const dy = this.feedingAt.pos.y - this.pos.y;
      const dSq = dx * dx + dy * dy;
      const halfRadiusSq = this.feedingAt.radius * this.feedingAt.radius * 0.25;
      
      if (dSq > halfRadiusSq) {
        const seekForce = this.seek(this.feedingAt.pos, 0.3);
        this.applyForce(seekForce);
      } else {
        const wander = this.wander();
        wander.mult(0.2);
        this.applyForce(wander);
      }
    }
    
    this.maxSpeed = this.baseSpeed * 0.7;
  }

  handleIdle(nearbyPlaceables, simulation, mauri) {
    this.isForaging = false;
    this.targetPlant = null;
    this.targetPlaceable = null;
    
    // Check for placeable attractions even when not hungry
    const attracted = this.seekPlaceableAttractions(nearbyPlaceables);
    
    if (!attracted) {
      const wander = this.wander();
      wander.mult(0.4);
      this.applyForce(wander);
      
      const homeForce = this.stayInHomeRange();
      this.applyForce(homeForce);
    }
    
    this.maxSpeed = this.baseSpeed;
    this.homeRangeStrength = 0.12;
  }

  // ============================================
  // MOVEMENT HELPERS
  // ============================================

  calculateSeparation(nearbyMoas) {
    const force = this._tempForce;
    force.set(0, 0);
    
    let count = 0;
    const sepDistSq = this.separationDistSq;
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0, len = nearbyMoas.length; i < len; i++) {
      const other = nearbyMoas[i];
      if (!other.alive || other === this) continue;
      
      const dx = px - other.pos.x;
      const dy = py - other.pos.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < sepDistSq && distSq > 0.0001) {
        const invDistSq = 1 / distSq;
        force.x += dx * invDistSq;
        force.y += dy * invDistSq;
        count++;
      }
    }
    
    if (count > 0) {
      force.mult(1 / count);
      force.setMag(this.maxSpeed);
      force.sub(this.vel);
      force.limit(this.maxForce);
    }
    
    return force.copy();
  }

  applySeparation(nearbyMoas) {
    const sep = this.calculateSeparation(nearbyMoas);
    const mult = this.currentState === MOA_STATE.FLEEING 
      ? 0.5 * this.flockTendency 
      : 0.8 * (2 - this.flockTendency);
    sep.mult(mult);
    this.applyForce(sep);
  }

  applyTerrainAvoidance() {
    const avoid = this.avoidUnwalkable();
    avoid.mult(2);
    this.applyForce(avoid);
  }

  fleeFrom(targetX, targetY, radiusSq) {
    const force = this._tempForce;
    const dx = this.pos.x - targetX;
    const dy = this.pos.y - targetY;
    const distSq = dx * dx + dy * dy;
    
    if (distSq < radiusSq && distSq > 0.0001) {
      const d = Math.sqrt(distSq);
      const radius = Math.sqrt(radiusSq);
      const urgency = 1 - (d / radius);
      const speed = this.maxSpeed * (1 + urgency);
      
      force.set(dx, dy);
      force.setMag(speed);
      force.sub(this.vel);
      force.limit(this.maxForce * 2);
    } else {
      force.set(0, 0);
    }
    
    return force.copy();
  }

  stayInHomeRange() {
    const force = this._tempForce;
    const dx = this.homeRange.x - this.pos.x;
    const dy = this.homeRange.y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq > this.homeRangeRadiusSq) {
      const distFromHome = Math.sqrt(distSq);
      force.set(dx, dy);
      force.setMag(this.maxForce * this.homeRangeStrength);
      force.mult(1 + (distFromHome - this.homeRangeRadius) * 0.02);
      return force.copy();
    }
    
    force.set(0, 0);
    return force;
  }

  // ============================================
  // FORAGING
  // ============================================

  assessLocalFood(simulation, seasonManager) {
    this.foodCheckTimer++;
    if (this.foodCheckTimer < 60) return;
    this.foodCheckTimer = 0;
    
    const nearbyPlants = simulation.getNearbyPlants(this.pos.x, this.pos.y, 60);
    let ediblePlants = 0;
    
    for (let i = 0, len = nearbyPlants.length; i < len; i++) {
      const plant = nearbyPlants[i];
      if (plant.alive && !plant.dormant && plant.growth > 0.5) {
        ediblePlants++;
        if (ediblePlants >= 8) break;
      }
    }
    
    this.localFoodScore = Math.min(ediblePlants * 0.125, 1);
  }

  findNearestPlant(simulation) {
    const searchRadius = 100 * this.foragingBonus;
    const nearbyPlants = simulation.getNearbyPlants(this.pos.x, this.pos.y, searchRadius);
    
    let nearest = null;
    let nearestScore = Infinity;
    const px = this.pos.x, py = this.pos.y;
    const homeX = this.homeRange.x, homeY = this.homeRange.y;
    const homeRadiusSq = this.homeRangeRadiusSq;
    const invForaging = 1 / this.foragingBonus;
    
    for (let i = 0, len = nearbyPlants.length; i < len; i++) {
      const plant = nearbyPlants[i];
      if (!plant.alive || plant.growth < 0.5) continue;
      if (plant.seasonalModifier < 0.3 && this.hunger < 70) continue;
      
      const dx = plant.pos.x - px;
      const dy = plant.pos.y - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      let score = d * invForaging / plant.seasonalModifier / (plant.nutrition * 0.0333);
      
      const homeDx = homeX - plant.pos.x;
      const homeDy = homeY - plant.pos.y;
      if (homeDx * homeDx + homeDy * homeDy < homeRadiusSq) {
        score *= 0.7;
      }
      
      if (plant.isSpawned) score *= 0.6;
      
      if (score < nearestScore) {
        nearestScore = score;
        nearest = plant;
      }
    }
    
    return nearest;
  }

  forage(simulation, mauri) {
    this.isForaging = true;
    
    // Check placeable food sources first
    const nearbyPlaceables = simulation.getNearbyPlaceables(this.pos.x, this.pos.y, 30);
    
    for (let i = 0, len = nearbyPlaceables.length; i < len; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive || !p.def.nutrition || p.foodRemaining <= 0) continue;
      if (p.isInRange(this.pos)) {
        const nutrition = p.consumeFood ? p.consumeFood(15) : 0;
        this.hunger = Math.max(0, this.hunger - nutrition);
        mauri.earnFromEating(mauri.onMoaEat * 0.5, this.pos.x, this.pos.y);
        this.vel.mult(0.3);
        return;
      }
    }
    
    // Find and pursue plants
    if (!this.targetPlant || !this.targetPlant.alive) {
      this.targetPlant = this.findNearestPlant(simulation);
    }
    
    if (this.targetPlant) {
      const dx = this.targetPlant.pos.x - this.pos.x;
      const dy = this.targetPlant.pos.y - this.pos.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < this.eatRadiusSq) {
        const nutrition = this.targetPlant.consume();
        this.hunger = Math.max(0, this.hunger - nutrition);
        mauri.earnFromEating(mauri.onMoaEat, this.pos.x, this.pos.y);
        this.targetPlant = null;
        this.vel.mult(0.3);
        this.lastFedTime = frameCount;
      } else {
        const urgency = map(this.hunger, this.hungerThreshold, this.maxHunger, 0.5, 0.9);
        const seekForce = this.seek(this.targetPlant.pos, urgency);
        this.applyForce(seekForce);
      }
    } else {
      const wander = this.wander();
      wander.mult(0.6);
      this.applyForce(wander);
    }
  }

  // ============================================
  // PLACEABLES
  // ============================================

  checkPlaceableEffects(nearbyPlaceables) {
    this.inShelter = false;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    this.isFeeding = false;
    this.feedingAt = null;
    
    let hungerMod = 1;
    let feedingRateTotal = 0;
    
    for (let i = 0, len = nearbyPlaceables.length; i < len; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive || !p.isInRange(this.pos)) continue;
      
      const def = p.def;
      
      if (def.blocksEagleVision) this.inShelter = true;
      
      if (def.securityBonus) {
        const bonus = def.securityBonus * p.seasonalMultiplier;
        if (bonus > this.securityBonus) this.securityBonus = bonus;
      }
      
      if (def.eggSpeedBonus) {
        const bonus = def.eggSpeedBonus * p.seasonalMultiplier;
        if (bonus > this.eggSpeedBonus) this.eggSpeedBonus = bonus;
      }
      
      if (def.hungerSlowdown && def.hungerSlowdown < hungerMod) {
        hungerMod = def.hungerSlowdown;
      }
      
      if (def.feedingRate) {
        feedingRateTotal += p.feedMoa(this);
        this.isFeeding = true;
        this.feedingAt = p;
      }
    }
    
    this.hungerRate = this.baseHungerRate * hungerMod;
    
    if (feedingRateTotal > 0) {
      this.hunger = Math.max(0, this.hunger - feedingRateTotal);
      this.lastFedTime = frameCount;
    }
  }

  seekPlaceableAttractions(nearbyPlaceables) {
    let bestTarget = null;
    let bestScore = -Infinity;
    const px = this.pos.x, py = this.pos.y;
    const hungerFactor = this.hunger * 0.01;
    
    for (let i = 0, len = nearbyPlaceables.length; i < len; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive) continue;
      
      const attractionStrength = p.getAttractionStrength(this);
      if (attractionStrength <= 0) continue;
      
      const dx = p.pos.x - px;
      const dy = p.pos.y - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      let score = attractionStrength * 50 - d * 0.3;
      
      if (this.hunger > 30 && p.def.feedingRate) {
        score += hungerFactor * 30 * p.seasonalMultiplier;
      }
      
      score *= p.seasonalMultiplier;
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = p;
      }
    }
    
    if (bestTarget && bestScore > 10) {
      const seekForce = this.seek(bestTarget.pos, 0.8);
      this.applyForce(seekForce);
      this.targetPlaceable = bestTarget;
      
      if (bestTarget.isInRange(this.pos)) {
        this.vel.mult(0.7);
      }
      
      return true;
    }
    
    return false;
  }

  // ============================================
  // MIGRATION
  // ============================================

  shouldMigrate(seasonManager) {
    const currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    const pref = this.preferredElevation;
    
    let elevationError = 0;
    if (currentElev < pref.min) elevationError = pref.min - currentElev;
    else if (currentElev > pref.max) elevationError = currentElev - pref.max;
    
    if (elevationError > 0.08) return true;
    if (this.localFoodScore < 0.3 && this.hunger > 30) return true;
    if (elevationError > 0.03 && seasonManager.getMigrationStrength() > 0.7) return true;
    
    return false;
  }

  findMigrationTarget(seasonManager) {
    const pref = this.preferredElevation;
    const targetElev = (pref.min + pref.max) * 0.5;
    const currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    
    let bestPos = null;
    let bestScore = -Infinity;
    
    const px = this.pos.x, py = this.pos.y;
    const mapW = this.terrain.mapWidth - 20;
    const mapH = this.terrain.mapHeight - 20;
    
    for (let i = 0; i < 20; i++) {
      const angle = random(Moa.TWO_PI);
      const dist = random(50, 150);
      let testX = constrain(px + cos(angle) * dist, 20, mapW);
      let testY = constrain(py + sin(angle) * dist, 20, mapH);
      
      if (!this.terrain.isWalkable(testX, testY)) continue;
      
      const elev = this.terrain.getElevationAt(testX, testY);
      const elevError = abs(elev - targetElev);
      let score = 1 - elevError * 5;
      
      if (elev >= pref.min && elev <= pref.max) score += 0.5;
      
      if ((currentElev < targetElev && elev > currentElev) ||
          (currentElev > targetElev && elev < currentElev)) {
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
    if (this.migrationCooldown > 0) this.migrationCooldown--;
    
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
        if (this.migrationTarget) this.isMigrating = true;
      }
    }
    
    if (this.isMigrating) this.executeMigration(seasonManager);
  }

  executeMigration(seasonManager) {
    if (!this.migrationTarget) {
      this.isMigrating = false;
      return;
    }
    
    const dx = this.migrationTarget.x - this.pos.x;
    const dy = this.migrationTarget.y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq < 400) {
      this.homeRange.set(this.migrationTarget.x, this.migrationTarget.y);
      this.homeRangeRadiusSq = this.homeRangeRadius * this.homeRangeRadius;
      this.isMigrating = false;
      this.migrationTarget = null;
      this.migrationCooldown = 300;
      return;
    }
    
    const migrationStrength = seasonManager.getMigrationStrength();
    let urgency = 0.5 + migrationStrength * 0.5;
    
    if (this.hunger > 50 && this.localFoodScore < 0.3) urgency *= 1.5;
    
    const seekForce = this.seek(this.migrationTarget, urgency);
    seekForce.mult(migrationStrength);
    this.applyForce(seekForce);
    
    this.homeRangeStrength = 0.02;
  }

  // ============================================
  // REPRODUCTION
  // ============================================

  tryLayEgg(simulation, mauri, nearbyPlaceables) {
    if (!this.canLayEgg) return;
    if (this.hunger > this.config.layingHungerThreshold) return;
    
    let requiredSecurity = this.securityTimeRequired;
    
    // Check for nest bonus
    for (let i = 0, len = nearbyPlaceables.length; i < len; i++) {
      const p = nearbyPlaceables[i];
      if (p.alive && p.type === 'nest' && p.isInRange(this.pos)) {
        requiredSecurity *= 0.5;
        break;
      }
    }
    
    if (this.securityTime < requiredSecurity) return;
    if (simulation.getMoaPopulation() >= this.config.maxMoaPopulation) return;
    
    const egg = simulation.addEgg(this.pos.x, this.pos.y);
    egg.speedBonus = this.eggSpeedBonus;
    
    if (this.speciesKey) egg.parentSpecies = this.speciesKey;
    
    mauri.earn(mauri.onEggLaid, this.pos.x, this.pos.y, 'egg');
    
    this.securityTime = 0;
    this.canLayEgg = false;
    this.eggCooldown = this.eggCooldownTime;
    this.hunger += 25;
    this.homeRange.set(this.pos.x, this.pos.y);
    
    this.securityTimeRequired = this.baseSecurityTime + 
      ((random() * (this.speciesConfig.securityTimeVariation || this.config.securityTimeVariation)) | 0);
  }

  resistEagleAttack() {
    return this.eagleResistance > 0 && random() < this.eagleResistance;
  }

  // ============================================
  // RENDERING
  // ============================================

  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    
    this.renderShadow();
    this.renderLegs();
    this.renderTail();
    this.renderBody();
    this.renderNeck();
    this.renderHead();
    
    if (CONFIG.debugMode) this.renderDebugIndicators();
    
    pop();
    
    if (CONFIG.debugMode && this.isMigrating && this.migrationTarget) {
      this.renderMigrationLine();
    }
    
    if (CONFIG.showHungerBars) this.renderStatusBars();
  }

  getBodyColor() {
    const colors = this._colors;
    
    if (this.panicLevel > 0) {
      return lerpColor(colors.body, colors.panic, this.panicLevel);
    }
    if (this.hunger > this.criticalHunger) return colors.starving;
    if (this.isFeeding) return colors.feeding;
    if (this.isMigrating) return colors.migrating;
    return colors.body;
  }

  renderShadow() {
    const sc = this.sc;
    noStroke();
    fill(this._colors.shadow);
    ellipse(1.5, 1.5, sc.shadowW, sc.shadowH);
  }

  renderLegs() {
    const sc = this.sc;
    const speed = this.vel.mag();
    const walkCycle = frameCount * 0.18 + this.legPhase;
    const legSwing = sin(walkCycle) * (0.5 + speed * 2);
    
    stroke(this._colors.leg);
    strokeWeight(1.8);
    
    // Left leg
    this.renderLeg(-1, legSwing * 2, sc);
    // Right leg
    this.renderLeg(1, -legSwing * 2, sc);
  }

  renderLeg(side, swing, sc) {
    const y1 = sc.legY1 * side;
    const y2 = sc.legY2 * side;
    const y3 = sc.legY3 * side;
    const legLenX = sc.legLen * 0.7;
    const legMidX = sc.legLen * 0.3;
    const endX = sc.legAttachX - legLenX + swing * side;
    
    strokeWeight(1.8);
    line(sc.legAttachX, y1, sc.legAttachX - legMidX, y2);
    line(sc.legAttachX - legMidX, y2, endX, y3);
    
    // Toes
    strokeWeight(1.2);
    line(endX, y3, endX - 3, y3 - 2.5 * side);
    line(endX, y3, endX - 4, y3);
    line(endX, y3, endX - 3, y3 + 2.5 * side);
  }

  renderTail() {
    const sc = this.sc;
    const bodyCol = this.getBodyColor();
    
    noStroke();
    fill(red(bodyCol) - 20, green(bodyCol) - 15, blue(bodyCol) - 10);
    beginShape();
    vertex(sc.tailX1, 0);
    vertex(sc.tailX2, -sc.tailY);
    vertex(sc.tailX3, 0);
    vertex(sc.tailX2, sc.tailY);
    endShape(CLOSE);
  }

  renderBody() {
    const sc = this.sc;
    const bodyCol = this.getBodyColor();
    
    noStroke();
    fill(bodyCol);
    ellipse(-2, 0, sc.bodyW, sc.bodyH);
    
    // Feather texture highlights
    fill(red(bodyCol) + 8, green(bodyCol) + 5, blue(bodyCol) + 3, 80);
    ellipse(-sc.bodyW * 0.06, -sc.bodyH * 0.12, sc.bodyW * 0.35, sc.bodyH * 0.23);
    ellipse(-sc.bodyW * 0.06, sc.bodyH * 0.12, sc.bodyW * 0.35, sc.bodyH * 0.23);
  }

  renderNeck() {
    const sc = this.sc;
    const bodyCol = this.getBodyColor();
    const neckCol = this.panicLevel > 0 
      ? lerpColor(this._colors.neck, this._colors.panic, this.panicLevel)
      : this._colors.neck;
    
    noStroke();
    fill(neckCol);
    beginShape();
    vertex(sc.neckX1, -sc.neckY1);
    vertex(sc.neckX1, sc.neckY1);
    vertex(sc.neckX2, sc.neckY2);
    vertex(sc.neckX2, -sc.neckY2);
    endShape(CLOSE);
  }

  renderHead() {
    const sc = this.sc;
    const bodyCol = this.getBodyColor();
    const colors = this._colors;
    
    noStroke();
    
    // Head
    fill(bodyCol);
    ellipse(sc.headX, 0, sc.headW, sc.headH);
    
    // Crest
    if (this.hasCrest) {
      fill(this.crestColor || color(140, 100, 60));
      beginShape();
      for (let i = 0; i < 6; i++) {
        vertex(sc.crestX[i], sc.crestY[i]);
      }
      endShape(CLOSE);
    }
    
    // Head highlight
    fill(red(bodyCol) + 10, green(bodyCol) + 8, blue(bodyCol) + 5, 100);
    ellipse(sc.headHighX, 0, sc.headHighW, sc.headHighH);
    
    // Eyes
    const eyeSizePlus = sc.eyeSize + 1;
    fill(colors.eyeWhite);
    ellipse(sc.eyeX, -sc.eyeOffsetY, eyeSizePlus, eyeSizePlus);
    ellipse(sc.eyeX, sc.eyeOffsetY, eyeSizePlus, eyeSizePlus);
    
    fill(colors.eyePupil);
    ellipse(sc.eyeX + 0.3, -sc.eyeOffsetY, sc.eyeSize, sc.eyeSize);
    ellipse(sc.eyeX + 0.3, sc.eyeOffsetY, sc.eyeSize, sc.eyeSize);
    
    const eyeHlSize = sc.eyeSize * 0.4;
    fill(colors.eyeHighlight);
    ellipse(sc.eyeX + 0.8, -sc.eyeOffsetY - 0.5, eyeHlSize, eyeHlSize);
    ellipse(sc.eyeX + 0.8, sc.eyeOffsetY - 0.5, eyeHlSize, eyeHlSize);
    
    // Beak
    fill(colors.beak);
    stroke(colors.beakStroke);
    strokeWeight(0.5);
    beginShape();
    vertex(sc.beakX1, -sc.beakY1);
    vertex(sc.beakX2, -sc.beakY2);
    vertex(sc.beakX3, 0);
    vertex(sc.beakX2, sc.beakY2);
    vertex(sc.beakX1, sc.beakY1);
    vertex(sc.beakX4, 0);
    endShape(CLOSE);
    
    line(sc.beakX4, 0, sc.beakX2, 0);
    
    noStroke();
    fill(colors.beakNostril);
    ellipse(sc.beakX5, -sc.beakNostrilY, 1.2, 0.8);
    ellipse(sc.beakX5, sc.beakNostrilY, 1.2, 0.8);
  }

  renderDebugIndicators() {
    const s = this.size;
    noFill();
    strokeWeight(1);
    
    if (this.inShelter) {
      stroke(100, 200, 100, 100);
      ellipse(0, 0, s * 2.2, s * 2.2);
    }
    if (this.isMigrating) {
      stroke(100, 150, 255, 80);
      const pulse = sin(frameCount * 0.1) * 2;
      ellipse(0, 0, s * 2 + pulse, s * 2 + pulse);
    }
    if (this.isFeeding) {
      stroke(150, 255, 150, 80);
      const pulse = sin(frameCount * 0.15) * 2;
      ellipse(0, 0, s * 1.8 + pulse, s * 1.8 + pulse);
    }
  }

  renderMigrationLine() {
    push();
    stroke(100, 150, 255, 40);
    strokeWeight(1);
    drawingContext.setLineDash([3, 3]);
    line(this.pos.x, this.pos.y, this.migrationTarget.x, this.migrationTarget.y);
    drawingContext.setLineDash([]);
    pop();
  }

  renderStatusBars() {
    const sc = this.sc;
    const barWidth = 14;
    const barHeight = 2;
    const yOffset = sc.barYOffset;
    const px = this.pos.x, py = this.pos.y;
    
    noStroke();
    
    // Hunger bar background
    fill(40, 40, 40, 150);
    rect(px - 7, py + yOffset, barWidth, barHeight, 1);
    
    // Hunger bar fill
    const hungerPercent = this.hunger / this.maxHunger;
    const hungerWidth = barWidth * (1 - hungerPercent);
    fill(80 + hungerPercent * 120, 180 - hungerPercent * 120, 80);
    rect(px - 7, py + yOffset, hungerWidth, barHeight, 1);
    
    // Egg progress
    if (this.canLayEgg && this.hunger <= this.config.layingHungerThreshold) {
      const progress = Math.min(this.securityTime / this.securityTimeRequired, 1);
      if (progress > 0.1) {
        fill(40, 40, 40, 150);
        rect(px - 7, py + yOffset - 3, barWidth, barHeight, 1);
        fill(220, 200, 100);
        rect(px - 7, py + yOffset - 3, barWidth * progress, barHeight, 1);
      }
    }
    
    // State indicators
    const indicatorY = py + yOffset - 5;
    let indicatorX = px;
    
    textAlign(CENTER, BOTTOM);
    textSize(6);
    
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
      text(this.species.displayName || this.speciesKey, px, py + yOffset + 10);
    }
  }
}