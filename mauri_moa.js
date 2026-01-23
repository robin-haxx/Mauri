// ============================================
// MOA CLASS - Optimized
// ============================================

const MOA_STATE = {
  IDLE: 'idle',
  FORAGING: 'foraging',
  FLEEING: 'fleeing',
  MIGRATING: 'migrating',
  FEEDING: 'feeding'
};

class Moa extends Boid {
  static DEFAULTS = {
    size: { min: 8, max: 11 },
    baseSpeed: 0.2,
    fleeSpeed: 0.4,
    maxForce: 0.025,
    flockTendency: 0.8,
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
    preferredElevation: { min: 0.25, max: 0.70 }
  };

  constructor(x, y, terrain, config, speciesData = null) {
    super(x, y, terrain);
    this.config = config;
    
    // Merge species config with defaults
    this.species = speciesData || this.getDefaultSpecies();
    const s = { ...Moa.DEFAULTS, ...(this.species.config || {}) };
    this.speciesConfig = s;
    
    // Physical
    this.size = this.randomizeValue(s.size);
    this.bodyColor = this.generateBodyColor(s.bodyColor);
    this._initColors();
    
    // Movement
    this.baseSpeed = s.baseSpeed;
    this.fleeSpeed = s.fleeSpeed;
    this.maxSpeed = this.baseSpeed;
    this.maxForce = s.maxForce;
    this.flockTendency = s.flockTendency;
    this.flightiness = s.flightiness;
    
    // Perception
    this.separationDistSq = 2500;
    this.fleeRadius = 85 * this.flightiness;
    this.fleeRadiusSq = this.fleeRadius * this.fleeRadius;
    this.eatRadiusSq = 196;
    
    // Abilities
    this.eagleResistance = s.eagleResistance;
    this.foragingBonus = s.foragingBonus;
    this.camouflage = s.camouflage;
    
    // Home range
    this.homeRange = createVector(x, y);
    this.homeRangeRadius = random(50, 90);
    this.homeRangeRadiusSq = this.homeRangeRadius * this.homeRangeRadius;
    
    // Visual
    this.legPhase = random(TWO_PI);
    this.hasCrest = s.hasCrest;
    if (this.hasCrest && s.crestColor) {
      this.crestColor = this.generateBodyColor(s.crestColor);
    }
    
    // State
    this.alive = true;
    this.currentState = MOA_STATE.IDLE;
    this.panicLevel = 0;
    this.inShelter = false;
    
    // Hunger
    this.hunger = random(15, 35);
    this.maxHunger = s.maxHunger;
    this.baseHungerRate = s.baseHungerRate;
    this.hungerRate = this.baseHungerRate;
    this.hungerThreshold = s.hungerThreshold;
    this.criticalHunger = s.criticalHunger;
    
    // Foraging
    this.targetPlant = null;
    this.isFeeding = false;
    this.feedingAt = null;
    
    // Reproduction
    this.securityTime = 0;
    this.securityTimeRequired = (s.securityTimeBase || config.securityTimeToLay) + 
      random(s.securityTimeVariation || config.securityTimeVariation);
    this.canLayEgg = true;
    this.eggCooldown = 0;
    this.eggCooldownTime = s.eggCooldownTime;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    
    // Migration
    this.isMigrating = false;
    this.migrationTarget = null;
    this.migrationCooldown = 0;
    this.localFoodScore = 1.0;
    this.foodCheckTimer = 0;
    this.preferredElevation = s.preferredElevation;
    
    // Reusable vectors - avoid allocations in hot paths
    this._tempForce = createVector();
    this._returnForce = createVector();      // For methods that return forces
    this._homeForce = createVector();        // For stayInHomeRange
    this._migrationTargetVec = null;         // Lazy-created for migration
    
    // Size cache
    this._sizeCache = null;
    
    // Color caching for panic interpolation
    this._lastPanicLevel = -1;
    this._cachedPanicColor = null;
    
    // Cached season data (updated each frame in behave)
    this._seasonCache = {
      key: null,
      hungerMod: 1,
      migrationStrength: 0,
      preferredElevation: { min: 0.25, max: 0.70 }
    };
  }

  // ============================================
  // INIT HELPERS
  // ============================================

  getDefaultSpecies() {
    return (typeof REGISTRY !== 'undefined' && REGISTRY.getSpecies('upland_moa')) || { config: {} };
  }

  randomizeValue(val) {
    if (!val) return random(8, 11);
    return (typeof val === 'object') ? random(val.min, val.max) : val;
  }

  generateBodyColor(cfg) {
    if (!cfg) return color(random(90, 110), random(60, 75), random(28, 40));
    const ch = (v) => Array.isArray(v) ? random(v[0], v[1]) : v;
    return color(ch(cfg.r), ch(cfg.g), ch(cfg.b));
  }

  _initColors() {
    const bc = this.bodyColor;
    const r = red(bc), g = green(bc), b = blue(bc);
    
    this._colors = {
      body: bc,
      neck: color(r - 5, g - 3, b - 3),
      panic: color(lerp(r, 150, 0.5), lerp(g, 80, 0.5), lerp(b, 60, 0.5)),
      starving: color(lerp(r, 70, 0.4), lerp(g, 50, 0.4), lerp(b, 35, 0.4)),
      feeding: color(lerp(r, 80, 0.2), lerp(g, 100, 0.2), lerp(b, 60, 0.2)),
      leg: color(60, 42, 25),
      beak: color(70, 55, 35),
      beakStroke: color(50, 40, 25),
      eye: color(240, 235, 220),
      pupil: color(25, 20, 15),
      shadow: color(0, 0, 0, 25)
    };
  }

  get sc() {
    if (!this._sizeCache || this._sizeCache._s !== this.size) {
      const s = this.size;
      this._sizeCache = {
        _s: s,
        bodyW: s * 0.85, bodyH: s * 0.65,
        legLen: s * 0.55, legAttach: -s * 0.1,
        legY: [s * 0.18, s * 0.28, s * 0.35],
        tailX: [-s * 0.35, -s * 0.55, -s * 0.48], tailY: s * 0.12,
        neckX: [s * 0.2, s * 0.52], neckY: [s * 0.12, s * 0.07],
        headX: s * 0.6, headW: s * 0.28, headH: s * 0.24,
        eyeX: s * 0.57, eyeY: s * 0.085, eyeSize: s * 0.08,
        beakX: [s * 0.68, s * 0.88, s * 0.9, s * 0.7],
        beakY: s * 0.04
      };
    }
    return this._sizeCache;
  }

  _cacheSizeMultipliers() {
    this._sizeCache = null;
    this.sc; // Force recompute
  }

  // ============================================
  // SEASON DATA CACHING
  // ============================================
  
  _updateSeasonCache(seasonManager) {
    const cache = this._seasonCache;
    cache.key = seasonManager.currentKey;
    cache.hungerMod = seasonManager.getHungerModifier();
    cache.migrationStrength = seasonManager.getMigrationStrength();
    
    // Blend species preference with season preference
    const sp = seasonManager.getPreferredElevation();
    const pp = this.speciesConfig.preferredElevation || sp;
    cache.preferredElevation.min = (pp.min + sp.min) * 0.5;
    cache.preferredElevation.max = (pp.max + sp.max) * 0.5;
  }

  // ============================================
  // MAIN BEHAVIOR
  // ============================================

  behave(simulation, mauri, seasonManager, dt = 1) {
    // Cache season data once per frame
    this._updateSeasonCache(seasonManager);
    const seasonCache = this._seasonCache;
    
    // Hunger - multiply rate by delta time
    const hungerMod = this.speciesConfig.seasonalModifiers?.[seasonCache.key]?.hungerRate || 1;
    this.hungerRate = this.baseHungerRate * seasonCache.hungerMod * hungerMod;
    this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);
    
    // Egg cooldown - scale by delta time
    if (this.eggCooldown > 0) {
      this.eggCooldown -= dt;
      if (this.eggCooldown <= 0) {
        this.eggCooldown = 0;
        this.canLayEgg = true;
      }
    }
    
    // Food assessment (throttled - accumulate time)
    this.foodCheckTimer += dt;
    if (this.foodCheckTimer >= 60) {
      this.foodCheckTimer -= 60;
      const plants = simulation.getNearbyPlants(this.pos.x, this.pos.y, 60);
      let edible = 0;
      for (let i = 0; i < plants.length && edible < 8; i++) {
        if (plants[i].alive && !plants[i].dormant && plants[i].growth > 0.5) edible++;
      }
      this.localFoodScore = edible * 0.125;
    }
    
    // Get nearby entities
    const px = this.pos.x, py = this.pos.y;
    const placeables = simulation.getNearbyPlaceables(px, py, 80);
    const eagles = simulation.getNearbyEagles(px, py, this.fleeRadius * 1.5);
    const moas = simulation.getNearbyMoas(px, py, 100);
    
    // Placeable effects
    this.applyPlaceableEffects(placeables, dt);
    
    // Update elevation preference from cache
    this.preferredElevation = seasonCache.preferredElevation;
    
    // Determine and execute state
    this.currentState = this.determineState(eagles, placeables, seasonCache);
    this.executeState(simulation, mauri, seasonCache, eagles, moas, placeables, dt);
    
    // Common behaviors
    this.applySeparation(moas);
    const avoid = this.avoidUnwalkable();
    avoid.mult(2);
    this.applyForce(avoid);
    this.edges();
    
    // Security time - scale by delta time
    this.updateSecurity(eagles, dt);
    
    // Try laying egg
    if (this.currentState !== MOA_STATE.FLEEING) {
      this.tryLayEgg(simulation, mauri, placeables);
    }
    
    // Death check
    if (this.hunger >= this.maxHunger) this.alive = false;
  }

  determineState(eagles, placeables, seasonCache) {
    // Flee from threats
    for (let i = 0; i < eagles.length; i++) {
      const e = eagles[i];
      if (this.camouflage > 0 && random() < this.camouflage) continue;
      if (this.inShelter && !e.isHunting()) continue;
      
      const dx = e.pos.x - this.pos.x, dy = e.pos.y - this.pos.y;
      if (e.isHunting() && dx * dx + dy * dy < this.fleeRadiusSq) {
        return MOA_STATE.FLEEING;
      }
    }
    
    // Migration - use cached migration strength
    if (this.isMigrating || this.shouldMigrate(seasonCache)) {
      return MOA_STATE.MIGRATING;
    }
    
    // Feeding at placeable
    if (this.isFeeding) return MOA_STATE.FEEDING;
    
    // Hungry or attracted
    if (this.hunger > this.hungerThreshold) return MOA_STATE.FORAGING;
    
    for (let i = 0; i < placeables.length; i++) {
      if (placeables[i].alive && placeables[i].getAttractionStrength(this) > 0) {
        return MOA_STATE.FORAGING;
      }
    }
    
    return MOA_STATE.IDLE;
  }

  executeState(simulation, mauri, seasonCache, eagles, moas, placeables, dt = 1) {
    this.panicLevel = 0;
    const isStarving = this.hunger > this.criticalHunger;
    
    switch (this.currentState) {
      case MOA_STATE.FLEEING:
        this.isMigrating = false;
        this.targetPlant = null;
        this.maxSpeed = this.fleeSpeed * (isStarving ? 0.6 : 1);
        
        for (let i = 0; i < eagles.length; i++) {
          const e = eagles[i];
          if (!e.isHunting()) continue;
          if (this.inShelter && !e.isHunting()) continue;
          
          const dx = e.pos.x - this.pos.x, dy = e.pos.y - this.pos.y;
          const dSq = dx * dx + dy * dy;
          
          if (dSq < this.fleeRadiusSq) {
            const flee = this.fleeFrom(e.pos.x, e.pos.y);
            flee.mult(2.5 * this.flightiness);
            this.applyForce(flee);
            
            const d = Math.sqrt(dSq);
            this.panicLevel = Math.max(this.panicLevel, 1 - d / this.fleeRadius);
          }
        }
        break;
        
      case MOA_STATE.MIGRATING:
        this.maxSpeed = this.baseSpeed * (isStarving ? 0.6 : 1);
        this.executeMigration(seasonCache, dt);
        if (this.hunger > 60) this.forage(simulation, mauri);
        break;
        
      case MOA_STATE.FORAGING:
        this.maxSpeed = this.baseSpeed * (isStarving ? 0.6 : 1);
        if (!this.seekAttractions(placeables)) {
          this.forage(simulation, mauri);
        }
        break;
        
      case MOA_STATE.FEEDING:
        this.maxSpeed = this.baseSpeed * 0.7;
        if (this.feedingAt) {
          const dx = this.feedingAt.pos.x - this.pos.x;
          const dy = this.feedingAt.pos.y - this.pos.y;
          if (dx * dx + dy * dy > this.feedingAt.radius * this.feedingAt.radius * 0.25) {
            this.applyForce(this.seek(this.feedingAt.pos, 0.3));
          } else {
            const w = this.wander();
            w.mult(0.2);
            this.applyForce(w);
          }
        }
        break;
        
      default: // IDLE
        this.maxSpeed = this.baseSpeed;
        this.targetPlant = null;
        if (!this.seekAttractions(placeables)) {
          const w = this.wander();
          w.mult(0.4);
          this.applyForce(w);
          this.applyForce(this.stayInHomeRange());
        }
    }
  }

  // ============================================
  // MOVEMENT - Optimized to avoid vector allocations
  // ============================================

  fleeFrom(tx, ty) {
    const force = this._returnForce;
    const dx = this.pos.x - tx, dy = this.pos.y - ty;
    const dSq = dx * dx + dy * dy;
    
    if (dSq < this.fleeRadiusSq && dSq > 0.0001) {
      const d = Math.sqrt(dSq);
      const urgency = 1 - d / this.fleeRadius;
      force.set(dx, dy);
      force.setMag(this.maxSpeed * (1 + urgency));
      force.sub(this.vel);
      force.limit(this.maxForce * 2);
    } else {
      force.set(0, 0);
    }
    return force;  // Return reusable vector directly (no copy)
  }

  stayInHomeRange() {
    const dx = this.homeRange.x - this.pos.x;
    const dy = this.homeRange.y - this.pos.y;
    const dSq = dx * dx + dy * dy;
    
    const force = this._homeForce;
    
    if (dSq > this.homeRangeRadiusSq) {
      force.set(dx, dy);
      force.setMag(this.maxForce * 0.12);
      force.mult(1 + (Math.sqrt(dSq) - this.homeRangeRadius) * 0.02);
    } else {
      force.set(0, 0);
    }
    return force;  // Return reusable vector directly
  }

  applySeparation(moas) {
    const force = this._tempForce;
    force.set(0, 0);
    let count = 0;
    
    for (let i = 0; i < moas.length; i++) {
      const other = moas[i];
      if (!other.alive || other === this) continue;
      
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < this.separationDistSq && dSq > 0.0001) {
        force.x += dx / dSq;
        force.y += dy / dSq;
        count++;
      }
    }
    
    if (count > 0) {
      force.mult(1 / count);
      force.setMag(this.maxSpeed);
      force.sub(this.vel);
      force.limit(this.maxForce);
      
      const mult = this.currentState === MOA_STATE.FLEEING 
        ? 0.5 * this.flockTendency 
        : 0.8 * (2 - this.flockTendency);
      force.mult(mult);
      this.applyForce(force);
    }
  }

  // ============================================
  // FORAGING & PLACEABLES
  // ============================================

  applyPlaceableEffects(placeables, dt = 1) {
    this.inShelter = false;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    this.isFeeding = false;
    this.feedingAt = null;
    
    let hungerMod = 1;
    let feedTotal = 0;
    
    for (let i = 0; i < placeables.length; i++) {
      const p = placeables[i];
      if (!p.alive || !p.isInRange(this.pos)) continue;
      
      const d = p.def;
      if (d.blocksEagleVision) this.inShelter = true;
      if (d.securityBonus) this.securityBonus = Math.max(this.securityBonus, d.securityBonus * p.seasonalMultiplier);
      if (d.eggSpeedBonus) this.eggSpeedBonus = Math.max(this.eggSpeedBonus, d.eggSpeedBonus * p.seasonalMultiplier);
      if (d.hungerSlowdown) hungerMod = Math.min(hungerMod, d.hungerSlowdown);
      if (d.feedingRate) {
        feedTotal += p.feedMoa(this, dt);  // Pass dt to feeding
        this.isFeeding = true;
        this.feedingAt = p;
      }
    }
    
    this.hungerRate = this.baseHungerRate * hungerMod;
    if (feedTotal > 0) this.hunger = Math.max(0, this.hunger - feedTotal);
  }

  seekAttractions(placeables) {
    let best = null, bestScore = 10;
    
    for (let i = 0; i < placeables.length; i++) {
      const p = placeables[i];
      if (!p.alive) continue;
      
      const strength = p.getAttractionStrength(this);
      if (strength <= 0) continue;
      
      const dx = p.pos.x - this.pos.x, dy = p.pos.y - this.pos.y;
      let score = strength * 50 - Math.sqrt(dx * dx + dy * dy) * 0.3;
      
      if (this.hunger > 30 && p.def.feedingRate) {
        score += this.hunger * 0.3 * p.seasonalMultiplier;
      }
      score *= p.seasonalMultiplier;
      
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    
    if (best) {
      this.applyForce(this.seek(best.pos, 0.8));
      if (best.isInRange(this.pos)) this.vel.mult(0.7);
      return true;
    }
    return false;
  }

  forage(simulation, mauri) {
    // Find target if needed
    if (!this.targetPlant || !this.targetPlant.alive) {
      this.targetPlant = this.findPlant(simulation);
    }
    
    if (this.targetPlant) {
      const dx = this.targetPlant.pos.x - this.pos.x;
      const dy = this.targetPlant.pos.y - this.pos.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < this.eatRadiusSq) {
        this.hunger = Math.max(0, this.hunger - this.targetPlant.consume());
        mauri.earnFromEating(mauri.onMoaEat, this.pos.x, this.pos.y);
        this.targetPlant = null;
        this.vel.mult(0.3);
      } else {
        const urgency = map(this.hunger, this.hungerThreshold, this.maxHunger, 0.5, 0.9);
        this.applyForce(this.seek(this.targetPlant.pos, urgency));
      }
    } else {
      const w = this.wander();
      w.mult(0.6);
      this.applyForce(w);
    }
  }

  findPlant(simulation) {
    const plants = simulation.getNearbyPlants(this.pos.x, this.pos.y, 100 * this.foragingBonus);
    let best = null, bestScore = Infinity;
    
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      if (!p.alive || p.growth < 0.5) continue;
      if (p.seasonalModifier < 0.3 && this.hunger < 70) continue;
      
      const dx = p.pos.x - this.pos.x, dy = p.pos.y - this.pos.y;
      let score = Math.sqrt(dx * dx + dy * dy) / this.foragingBonus / p.seasonalModifier / (p.nutrition * 0.033);
      
      const hx = this.homeRange.x - p.pos.x, hy = this.homeRange.y - p.pos.y;
      if (hx * hx + hy * hy < this.homeRangeRadiusSq) score *= 0.7;
      if (p.isSpawned) score *= 0.6;
      
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  // ============================================
  // MIGRATION - Optimized vector allocation
  // ============================================

  shouldMigrate(seasonCache) {
    const elev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    const p = this.preferredElevation;
    
    let err = 0;
    if (elev < p.min) err = p.min - elev;
    else if (elev > p.max) err = elev - p.max;
    
    return err > 0.08 || 
           (this.localFoodScore < 0.3 && this.hunger > 30) ||
           (err > 0.03 && seasonCache.migrationStrength > 0.7);
  }

  executeMigration(seasonCache, dt = 1) {
    if (this.migrationCooldown > 0) {
      this.migrationCooldown -= dt;
      if (this.migrationTarget) this.moveToMigrationTarget(seasonCache);
      return;
    }
    
    if (!this.isMigrating && this.shouldMigrate(seasonCache)) {
      this.migrationTarget = this.findMigrationTarget();
      this.isMigrating = !!this.migrationTarget;
    }
    
    if (this.isMigrating && this.migrationTarget) {
      this.moveToMigrationTarget(seasonCache);
    }
  }

  findMigrationTarget() {
    const target = (this.preferredElevation.min + this.preferredElevation.max) * 0.5;
    const current = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    
    let bestX = 0, bestY = 0;
    let bestScore = -Infinity;
    let foundValid = false;
    
    const px = this.pos.x, py = this.pos.y;
    const mapW = this.terrain.mapWidth - 20;
    const mapH = this.terrain.mapHeight - 20;
    
    for (let i = 0; i < 20; i++) {
      const angle = random(TWO_PI);
      const dist = random(50, 150);
      const x = constrain(px + cos(angle) * dist, 20, mapW);
      const y = constrain(py + sin(angle) * dist, 20, mapH);
      
      if (!this.terrain.isWalkable(x, y)) continue;
      
      const elev = this.terrain.getElevationAt(x, y);
      let score = 1 - abs(elev - target) * 5;
      
      if (elev >= this.preferredElevation.min && elev <= this.preferredElevation.max) score += 0.5;
      if ((current < target && elev > current) || (current > target && elev < current)) score += 0.3;
      
      if (score > bestScore) {
        bestScore = score;
        bestX = x;
        bestY = y;
        foundValid = true;
      }
    }
    
    // Only create/reuse vector if we found something
    if (foundValid) {
      if (!this._migrationTargetVec) {
        this._migrationTargetVec = createVector(bestX, bestY);
      } else {
        this._migrationTargetVec.set(bestX, bestY);
      }
      return this._migrationTargetVec;
    }
    return null;
  }

  moveToMigrationTarget(seasonCache) {
    const dx = this.migrationTarget.x - this.pos.x;
    const dy = this.migrationTarget.y - this.pos.y;
    
    if (dx * dx + dy * dy < 400) {
      this.homeRange.set(this.migrationTarget.x, this.migrationTarget.y);
      this.homeRangeRadiusSq = this.homeRangeRadius * this.homeRangeRadius;
      this.isMigrating = false;
      this.migrationTarget = null;
      this.migrationCooldown = 300;
      return;
    }
    
    const strength = seasonCache.migrationStrength;
    let urgency = 0.5 + strength * 0.5;
    if (this.hunger > 50 && this.localFoodScore < 0.3) urgency *= 1.5;
    
    const seek = this.seek(this.migrationTarget, urgency);
    seek.mult(strength);
    this.applyForce(seek);
  }

  // ============================================
  // REPRODUCTION
  // ============================================

  updateSecurity(eagles, dt = 1) {
    const safeDist = this.fleeRadiusSq * 0.64;
    let nearest = Infinity;
    
    for (let i = 0; i < eagles.length; i++) {
      const dx = eagles[i].pos.x - this.pos.x;
      const dy = eagles[i].pos.y - this.pos.y;
      nearest = Math.min(nearest, dx * dx + dy * dy);
    }
    
    if (nearest > safeDist) {
      this.securityTime += this.securityBonus * dt;  // Scale by dt
    } else {
      this.securityTime = 0;
    }
  }

  tryLayEgg(simulation, mauri, placeables) {
    if (!this.canLayEgg || this.hunger > this.config.layingHungerThreshold) return;
    
    let required = this.securityTimeRequired;
    for (let i = 0; i < placeables.length; i++) {
      const p = placeables[i];
      if (p.alive && p.type === 'nest' && p.isInRange(this.pos)) {
        required *= 0.5;
        break;
      }
    }
    
    if (this.securityTime < required) return;
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
    this.securityTimeRequired = (this.speciesConfig.securityTimeBase || this.config.securityTimeToLay) +
      random(this.speciesConfig.securityTimeVariation || this.config.securityTimeVariation);
  }

  resistEagleAttack() {
    return this.eagleResistance > 0 && random() < this.eagleResistance;
  }

  // ============================================
  // RENDERING
  // ============================================

  render() {
    if (!this.alive) return;
    
    const sc = this.sc;
    const bodyCol = this.getBodyColor();
    const colors = this._colors;
    
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    
    // Shadow
    noStroke();
    fill(colors.shadow);
    ellipse(1.5, 1.5, sc.bodyW * 1.2, sc.bodyH);
    
    // Legs (alternating motion)
    const speed = this.vel.mag();
    const cycle = frameCount * 0.18 + this.legPhase;
    const swing = sin(cycle) * (0.5 + speed * 2);
    
    stroke(colors.leg);
    strokeWeight(1.8);
    this.renderLeg(-1, swing, sc);
    this.renderLeg(1, -swing, sc);
    
    // Tail
    noStroke();
    fill(red(bodyCol) - 20, green(bodyCol) - 15, blue(bodyCol) - 10);
    beginShape();
    vertex(sc.tailX[0], 0);
    vertex(sc.tailX[1], -sc.tailY);
    vertex(sc.tailX[2], 0);
    vertex(sc.tailX[1], sc.tailY);
    endShape(CLOSE);
    
    // Body
    fill(bodyCol);
    ellipse(-2, 0, sc.bodyW, sc.bodyH);
    
    // Neck
    const neckCol = this.panicLevel > 0 
      ? lerpColor(colors.neck, colors.panic, this.panicLevel) 
      : colors.neck;
    fill(neckCol);
    beginShape();
    vertex(sc.neckX[0], -sc.neckY[0]);
    vertex(sc.neckX[0], sc.neckY[0]);
    vertex(sc.neckX[1], sc.neckY[1]);
    vertex(sc.neckX[1], -sc.neckY[1]);
    endShape(CLOSE);
    
    // Head
    fill(bodyCol);
    ellipse(sc.headX, 0, sc.headW, sc.headH);
    
    // Crest
    if (this.hasCrest) {
      fill(this.crestColor || color(140, 100, 60));
      const cx = this.size;
      beginShape();
      vertex(cx * 0.5, -cx * 0.12);
      vertex(cx * 0.55, -cx * 0.22);
      vertex(cx * 0.62, -cx * 0.18);
      vertex(cx * 0.68, -cx * 0.25);
      vertex(cx * 0.72, -cx * 0.15);
      vertex(cx * 0.65, -cx * 0.1);
      endShape(CLOSE);
    }
    
    // Eyes
    fill(colors.eye);
    ellipse(sc.eyeX, -sc.eyeY, sc.eyeSize + 1, sc.eyeSize + 1);
    ellipse(sc.eyeX, sc.eyeY, sc.eyeSize + 1, sc.eyeSize + 1);
    fill(colors.pupil);
    ellipse(sc.eyeX + 0.3, -sc.eyeY, sc.eyeSize, sc.eyeSize);
    ellipse(sc.eyeX + 0.3, sc.eyeY, sc.eyeSize, sc.eyeSize);
    
    // Beak
    fill(colors.beak);
    stroke(colors.beakStroke);
    strokeWeight(0.5);
    beginShape();
    vertex(sc.beakX[0], -sc.beakY);
    vertex(sc.beakX[1], -sc.beakY * 0.25);
    vertex(sc.beakX[2], 0);
    vertex(sc.beakX[1], sc.beakY * 0.25);
    vertex(sc.beakX[0], sc.beakY);
    vertex(sc.beakX[3], 0);
    endShape(CLOSE);
    
    pop();
    
    if (CONFIG.showHungerBars) this.renderStatusBars();
  }

  renderLeg(side, swing, sc) {
    const y1 = sc.legY[0] * side;
    const y2 = sc.legY[1] * side;
    const y3 = sc.legY[2] * side;
    const midX = sc.legAttach - sc.legLen * 0.3;
    const endX = sc.legAttach - sc.legLen * 0.7 + swing;
    
    strokeWeight(1.8);
    line(sc.legAttach, y1, midX, y2);
    line(midX, y2, endX, y3);
    
    // Toes
    strokeWeight(1.2);
    line(endX, y3, endX - 3, y3 - 2.5 * side);
    line(endX, y3, endX - 4, y3);
    line(endX, y3, endX - 3, y3 + 2.5 * side);
  }

  getBodyColor() {
    const c = this._colors;
    
    if (this.panicLevel > 0) {
      // Only recalculate if panic changed significantly
      if (!this._cachedPanicColor || abs(this._lastPanicLevel - this.panicLevel) > 0.05) {
        this._cachedPanicColor = lerpColor(c.body, c.panic, this.panicLevel);
        this._lastPanicLevel = this.panicLevel;
      }
      return this._cachedPanicColor;
    }
    
    // Reset panic cache when not panicking
    this._lastPanicLevel = -1;
    
    if (this.hunger > this.criticalHunger) return c.starving;
    if (this.isFeeding) return c.feeding;
    return c.body;
  }

  renderStatusBars() {
    const s = this.size;
    const px = this.pos.x, py = this.pos.y;
    const yOff = -s * 0.8 - 4;
    
    noStroke();
    
    // Hunger bar
    fill(40, 40, 40, 150);
    rect(px - 7, py + yOff, 14, 2, 1);
    
    const pct = this.hunger / this.maxHunger;
    fill(80 + pct * 120, 180 - pct * 120, 80);
    rect(px - 7, py + yOff, 14 * (1 - pct), 2, 1);
    
    // Egg progress
    if (this.canLayEgg && this.hunger <= this.config.layingHungerThreshold) {
      const prog = Math.min(this.securityTime / this.securityTimeRequired, 1);
      if (prog > 0.1) {
        fill(40, 40, 40, 150);
        rect(px - 7, py + yOff - 3, 14, 2, 1);
        fill(220, 200, 100);
        rect(px - 7, py + yOff - 3, 14 * prog, 2, 1);
      }
    }
    
    // State indicators
    textAlign(CENTER, BOTTOM);
    textSize(6);
    
    if (this.isMigrating) {
      fill(100, 150, 255, 220);
      text("↗", px, py + yOff - 5);
    } else if (this.localFoodScore < 0.3 && !this.isFeeding) {
      fill(255, 180, 80, 220);
      text("!", px, py + yOff - 5);
    }
  }
}