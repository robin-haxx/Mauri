// ============================================
// MOA CLASS - With Mating Behavior
// ============================================

const MOA_STATE = {
  IDLE: 'idle',
  FORAGING: 'foraging',
  FLEEING: 'fleeing',
  MIGRATING: 'migrating',
  FEEDING: 'feeding',
  SEEKING_MATE: 'seeking_mate',
  MATING: 'mating'
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
    preferredElevation: { min: 0.35, max: 0.75 },
    // Mating config
    matingHungerThreshold: 40,  // Must be below this hunger to mate
    matingRange: 15,            // Distance to initiate mating
    matingDuration: 60,         // Frames spent mating
    pregnancyDuration: 90,      // Frames after mating before laying
    matingSearchRadius: 80      // How far to look for mates
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
    this.timeAlive = 0;
    
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
    
    // Reproduction - security time
    this.securityTime = 0;
    this.securityTimeRequired = (s.securityTimeBase || config.securityTimeToLay) + 
      random(s.securityTimeVariation || config.securityTimeVariation);
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    
    // Reproduction - mating
    this.canMate = true;
    this.mateCooldown = 0;
    this.mateCooldownTime = s.eggCooldownTime;
    this.matingHungerThreshold = s.matingHungerThreshold;
    this.matingRange = s.matingRange;
    this.matingRangeSq = s.matingRange * s.matingRange;
    this.matingDuration = s.matingDuration;
    this.pregnancyDuration = s.pregnancyDuration;
    this.matingSearchRadius = s.matingSearchRadius;
    
    // Mating state
    this.matingPartner = null;
    this.matingTimer = 0;
    this.isPregnant = false;
    this.pregnancyTimer = 0;
    this.targetMate = null;  // Moa we're moving toward
    
    // Visual mating indicator
    this.heartTimer = 0;  // For showing hearts
    
    // Migration
    this.isMigrating = false;
    this.migrationTarget = null;
    this.migrationCooldown = 0;
    this.localFoodScore = 1.0;
    this.foodCheckTimer = 0;
    this.preferredElevation = s.preferredElevation;
    
    // Reusable vectors
    this._tempForce = createVector();
    this._returnForce = createVector();
    this._homeForce = createVector();
    this._migrationTargetVec = null;
    
    // Size cache
    this._sizeCache = null;
    
    // Color caching
    this._lastPanicLevel = -1;
    this._cachedPanicColor = null;
    
    // Season cache
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
      mating: color(lerp(r, 180, 0.3), lerp(g, 100, 0.3), lerp(b, 120, 0.3)),
      pregnant: color(lerp(r, 160, 0.2), lerp(g, 140, 0.2), lerp(b, 100, 0.2)),
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
    this.sc;
  }

  _updateSeasonCache(seasonManager) {
    const cache = this._seasonCache;
    cache.key = seasonManager.currentKey;
    cache.hungerMod = seasonManager.getHungerModifier();
    cache.migrationStrength = seasonManager.getMigrationStrength();
    
    const sp = seasonManager.getPreferredElevation();
    const pp = this.speciesConfig.preferredElevation || sp;
    cache.preferredElevation.min = (pp.min + sp.min) * 0.5;
    cache.preferredElevation.max = (pp.max + sp.max) * 0.5;
  }

  // ============================================
  // MATING READINESS
  // ============================================
  
  /**
   * Check if this moa is ready to seek a mate
   */

  //perhaps use size to determine rather than timeAlive
  isReadyToMate() {
    return this.canMate && 
           this.mateCooldown <= 0 &&
           !this.isPregnant &&
           !this.matingPartner &&
           this.hunger < this.matingHungerThreshold &&
           this.securityTime >= this.securityTimeRequired * 0.5; // Need some security
  }
  
  /**
   * Check if this moa can be a mate target (slightly looser requirements)
   */
  canBeMate() {
    return this.alive &&
           this.canMate &&
           this.mateCooldown <= 0 &&
           !this.isPregnant &&
           !this.matingPartner &&
           this.hunger < this.matingHungerThreshold * 1.5; // Slightly higher hunger OK for target
  }

  // ============================================
  // MAIN BEHAVIOR
  // ============================================

  behave(simulation, mauri, seasonManager, dt = 1) {

    this.timeAlive+= dt;
    this._updateSeasonCache(seasonManager);
    const seasonCache = this._seasonCache;
    
    // Hunger
    const hungerMod = this.speciesConfig.seasonalModifiers?.[seasonCache.key]?.hungerRate || 1;
    this.hungerRate = this.baseHungerRate * seasonCache.hungerMod * hungerMod;
    this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);
    
    // Mate cooldown
    if (this.mateCooldown > 0) {
      this.mateCooldown -= dt;
      if (this.mateCooldown <= 0) {
        this.mateCooldown = 0;
        this.canMate = true;
      }
    }
    
    // Heart animation timer
    if (this.heartTimer > 0) {
      this.heartTimer -= dt;
    }
    
    // Food assessment (throttled)
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
    
    // Update elevation preference
    this.preferredElevation = seasonCache.preferredElevation;
    
    // Handle active mating first
    if (this.matingPartner || this.matingTimer > 0) {
      this.executeMating(simulation, mauri, dt);
      return;
    }
    
    // Handle pregnancy
    if (this.isPregnant) {
      this.executePregnancy(simulation, mauri, placeables, dt);
      // Continue with normal behavior while pregnant
    }
    
    // Determine and execute state
    this.currentState = this.determineState(eagles, placeables, seasonCache, moas);
    this.executeState(simulation, mauri, seasonCache, eagles, moas, placeables, dt);
    
    // Common behaviors
    this.applySeparation(moas);
    const avoid = this.avoidUnwalkable();
    avoid.mult(2);
    this.applyForce(avoid);
    this.edges();
    
    // Security time
    this.updateSecurity(eagles, dt);
    
    // Death check
    if (this.hunger >= this.maxHunger) this.alive = false;
  }

  determineState(eagles, placeables, seasonCache, moas) {
    // Flee from threats (highest priority)
    for (let i = 0; i < eagles.length; i++) {
      const e = eagles[i];
      if (this.camouflage > 0 && random() < this.camouflage) continue;
      if (this.inShelter && !e.isHunting()) continue;
      
      const dx = e.pos.x - this.pos.x, dy = e.pos.y - this.pos.y;
      if (e.isHunting() && dx * dx + dy * dy < this.fleeRadiusSq) {
        // Clear mating state when fleeing
        this.targetMate = null;
        return MOA_STATE.FLEEING;
      }
    }
    
    // Already mating
    if (this.matingTimer > 0 || this.matingPartner) {
      return MOA_STATE.MATING;
    }
    
    // Check if being courted - respond if we can mate
    if (this.canBeMate() && !this.targetMate && this.hunger < this.hungerThreshold) {
      const suitor = this.isBeingCourted(moas);
      if (suitor && suitor.alive) {
        this.targetMate = suitor;
        return MOA_STATE.SEEKING_MATE;
      }
    }
    
    // Actively seeking mate
    if (this.targetMate && this.targetMate.alive && this.canBeMate()) {
      return MOA_STATE.SEEKING_MATE;
    }
    
    // Ready to seek a new mate
    if (this.isReadyToMate() && this.hunger < this.hungerThreshold) {
      const potentialMate = this.findPotentialMate(moas);
      if (potentialMate) {
        this.targetMate = potentialMate;
        return MOA_STATE.SEEKING_MATE;
      }
    }
    
    // Clear stale target
    this.targetMate = null;
    
    // Migration
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
      this.targetMate = null;
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
      
    case MOA_STATE.SEEKING_MATE:
      this.maxSpeed = this.baseSpeed * 1.5; // Faster pursuit
      this.seekMate(moas, dt);
      break;
      
    case MOA_STATE.MATING:
      // Handled in executeMating()
      break;
      
    case MOA_STATE.MIGRATING:
      this.targetMate = null;
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
// MATING READINESS
// ============================================

/**
 * Check if this moa is ready to seek a mate
 */
isReadyToMate() {
  return this.canMate && 
         this.mateCooldown <= 0 &&
         this.timeAlive >= 1200 &&
         !this.isPregnant &&
         !this.matingPartner &&
         this.hunger < this.matingHungerThreshold &&
         this.securityTime >= this.securityTimeRequired * 0.5;
}

/**
 * Check if this moa can be a mate target (slightly looser requirements)
 */
canBeMate() {
  return this.alive &&
         this.canMate &&
         this.mateCooldown <= 0 &&
         !this.isPregnant &&
         !this.matingPartner &&
         this.hunger < this.matingHungerThreshold * 1.5;
}

/**
 * Check if this moa is being courted by another
 */
isBeingCourted(moas) {
  for (let i = 0; i < moas.length; i++) {
    const other = moas[i];
    if (other !== this && other.targetMate === this && other.alive) {
      return other;
    }
  }
  return null;
}

  // ============================================
  // MATING BEHAVIOR
  // ============================================

  /**
   * Find a potential mate from nearby moa
   */
  findPotentialMate(moas) {
    let bestMate = null;
    let bestScore = Infinity;
    const maxDistSq = this.matingSearchRadius * this.matingSearchRadius;
    
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0; i < moas.length; i++) {
      const other = moas[i];
      
      // Skip self and invalid mates
      if (other === this || !other.canBeMate()) continue;
      
      // Skip if they're actively mating with someone else
      if (other.matingPartner && other.matingPartner !== this) continue;
      
      const dx = other.pos.x - px;
      const dy = other.pos.y - py;
      const distSq = dx * dx + dy * dy;
      
      if (distSq > maxDistSq) continue;
      
      // Score based on distance and compatibility
      let score = distSq;
      
      // Big bonus if they're already targeting us (mutual attraction)
      if (other.targetMate === this) {
        score *= 0.1; // 10x preference
      }
      // Bonus if they're also seeking a mate
      else if (other.currentState === MOA_STATE.SEEKING_MATE && !other.targetMate) {
        score *= 0.5;
      }
      // Bonus if they're ready to mate
      else if (other.isReadyToMate()) {
        score *= 0.7;
      }
      // Penalty if they're busy foraging (harder to catch)
      else if (other.currentState === MOA_STATE.FORAGING) {
        score *= 1.5;
      }
      
      if (score < bestScore) {
        bestScore = score;
        bestMate = other;
      }
    }
    
    return bestMate;
  }

  /**
   * Move toward target mate and initiate mating when close
   */
  seekMate(moas, dt = 1) {
    // Validate target mate still exists and is valid
    if (!this.targetMate || !this.targetMate.alive || !this.targetMate.canBeMate()) {
      this.targetMate = this.findPotentialMate(moas);
      if (!this.targetMate) {
        this.currentState = MOA_STATE.IDLE;
        return;
      }
    }
    
    const target = this.targetMate;
    const dx = target.pos.x - this.pos.x;
    const dy = target.pos.y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    
    // Check if close enough to mate
    if (distSq < this.matingRangeSq) {
      this.initiateMating(target);
      return;
    }
    
    // Pursuit with prediction
    const dist = Math.sqrt(distSq);
    
    // Lead the target - predict where they'll be
    const closingSpeed = this.maxSpeed - target.vel.mag() * 0.5;
    const predictTime = constrain(dist / max(closingSpeed, 0.1), 0, 40);
    
    const predictX = target.pos.x + target.vel.x * predictTime;
    const predictY = target.pos.y + target.vel.y * predictTime;
    
    // Stronger pursuit when closer
    const urgency = map(dist, 0, this.matingSearchRadius, 1.5, 0.8);
    
    this._tempForce.set(predictX, predictY);
    const seekForce = this.seek(this._tempForce, urgency);
    this.applyForce(seekForce);
    
    // Show hearts when getting close
    if (distSq < this.matingSearchRadius * this.matingSearchRadius * 0.25) {
      this.heartTimer = 20;
    }
  }

  initiateMating(partner) {
    // Both moa enter mating state
    this.matingPartner = partner;
    this.matingTimer = this.matingDuration;
    this.currentState = MOA_STATE.MATING;
    this.heartTimer = this.matingDuration;
    this.targetMate = null;
    
    partner.matingPartner = this;
    partner.matingTimer = this.matingDuration;
    partner.currentState = MOA_STATE.MATING;
    partner.heartTimer = this.matingDuration;
    partner.targetMate = null;
    
    // Stop movement briefly
    this.vel.mult(0.2);
    partner.vel.mult(0.2);
    
    // Play mating sound
    if (typeof audioManager !== 'undefined' && audioManager) {
      audioManager.playMateCheep();
    }
  }

  /**
   * Execute mating behavior (called each frame while mating)
   */
  executeMating(simulation, mauri, dt = 1) {
    this.matingTimer -= dt;
    this.maxSpeed = this.baseSpeed * 0.15; // Very slow
    
    // Stay close to partner
    if (this.matingPartner && this.matingPartner.alive) {
      const dx = this.matingPartner.pos.x - this.pos.x;
      const dy = this.matingPartner.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      
      // Move toward partner if drifted apart
      if (distSq > this.matingRangeSq * 2) {
        const seekForce = this.seek(this.matingPartner.pos, 0.5);
        this.applyForce(seekForce);
      } else if (distSq > 25) {
        // Gentle attraction when close
        this._tempForce.set(dx, dy);
        this._tempForce.setMag(this.maxForce * 0.3);
        this.applyForce(this._tempForce);
      }
      
      // Very slow wandering in place
      const w = this.wander();
      w.mult(0.1);
      this.applyForce(w);
    } else {
      // Partner died or disappeared - cancel mating
      this.matingTimer = 0;
    }
    
    // Mating complete
    if (this.matingTimer <= 0) {
      this.completeMating(simulation, mauri);
    }
  }

  /**
   * Complete mating - one moa becomes pregnant
   */
  completeMating(simulation, mauri) {
    const partner = this.matingPartner;
    
    // Determine which one becomes pregnant (random)
    const thisBecomesPregnant = random() < 0.5;
    
    if (thisBecomesPregnant) {
      this.becomePregnant();
    } else if (partner && partner.alive) {
      partner.becomePregnant();
    } else {
      // Fallback if partner died
      this.becomePregnant();
    }
    
    // Both go on cooldown
    this.canMate = false;
    this.mateCooldown = this.mateCooldownTime;
    this.matingPartner = null;
    this.matingTimer = 0;
    this.currentState = MOA_STATE.IDLE;
    
    if (partner && partner.alive) {
      partner.canMate = false;
      partner.mateCooldown = partner.mateCooldownTime;
      partner.matingPartner = null;
      partner.matingTimer = 0;
      partner.currentState = MOA_STATE.IDLE;
    }
    
    // Hunger cost
    this.hunger += 10;
    if (partner && partner.alive) {
      partner.hunger += 10;
    }
  }

  /**
   * This moa becomes pregnant
   */
  becomePregnant() {
    this.isPregnant = true;
    this.pregnancyTimer = this.pregnancyDuration;
  }

  /**
   * Handle pregnancy each frame
   */
  executePregnancy(simulation, mauri, placeables, dt = 1) {
    this.pregnancyTimer -= dt;
    
    // Apply nest bonus
    for (let i = 0; i < placeables.length; i++) {
      const p = placeables[i];
      if (p.alive && p.type === 'nest' && p.isInRange(this.pos)) {
        this.pregnancyTimer -= dt * 0.5;
        break;
      }
    }
    
    if (this.pregnancyTimer <= 0) {
      this.layEgg(simulation, mauri);
    }
  }

  /**
   * Lay the egg
   */
  layEgg(simulation, mauri) {
    if (simulation.getMoaPopulation() >= this.config.maxMoaPopulation) {
      this.isPregnant = false;
      this.pregnancyTimer = 0;
      return;
    }
    
    const isFirstEgg = simulation.eggs.filter(e => e.alive && !e.hatched).length === 0;
    
    const egg = simulation.addEgg(this.pos.x, this.pos.y);
    egg.speedBonus = this.eggSpeedBonus;
    if (this.speciesKey) egg.parentSpecies = this.speciesKey;
    
    if (isFirstEgg && simulation.game?.tutorial) {
      simulation.game.tutorial.fireEvent(TUTORIAL_EVENTS.FIRST_EGG, { egg: egg });
    }
    
    mauri.earn(mauri.onEggLaid, this.pos.x, this.pos.y, 'egg');
    
    this.isPregnant = false;
    this.pregnancyTimer = 0;
    this.hunger += 15;
    this.homeRange.set(this.pos.x, this.pos.y);
    
    this.securityTime = 0;
    this.securityTimeRequired = (this.speciesConfig.securityTimeBase || this.config.securityTimeToLay) +
      random(this.speciesConfig.securityTimeVariation || this.config.securityTimeVariation);
  }

  // ============================================
  // MOVEMENT
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
    return force;
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
    return force;
  }

  applySeparation(moas) {
    const force = this._tempForce;
    force.set(0, 0);
    let count = 0;
    
    // Much weaker separation during mating behavior
    const isMatingBehavior = (this.currentState === MOA_STATE.MATING || 
                              this.currentState === MOA_STATE.SEEKING_MATE);
    const separationDist = isMatingBehavior 
      ? this.separationDistSq * 0.15  // Very small separation zone
      : this.separationDistSq;
    
    for (let i = 0; i < moas.length; i++) {
      const other = moas[i];
      if (!other.alive || other === this) continue;
      
      // Don't separate from mating partner
      if (other === this.matingPartner) continue;
      
      // Don't separate from target mate (pursuing them)
      if (other === this.targetMate) continue;
      
      // Don't separate from someone pursuing us
      if (other.targetMate === this) continue;
      
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < separationDist && dSq > 0.0001) {
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
      
      let mult;
      if (isMatingBehavior) {
        mult = 0.2; // Very weak separation during mating
      } else if (this.currentState === MOA_STATE.FLEEING) {
        mult = 0.5 * this.flockTendency;
      } else {
        mult = 0.8 * (2 - this.flockTendency);
      }
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
        feedTotal += p.feedMoa(this, dt);
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
  // MIGRATION
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
  // SECURITY
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
      this.securityTime += this.securityBonus * dt;
    } else {
      this.securityTime = Math.max(0, this.securityTime - dt * 2); // Lose security faster
    }
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
    
    // Legs
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
    
    // Render hearts and status indicators (in world space, not rotated)
    this.renderMatingIndicators();
    
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
    
    strokeWeight(1.2);
    line(endX, y3, endX - 3, y3 - 2.5 * side);
    line(endX, y3, endX - 4, y3);
    line(endX, y3, endX - 3, y3 + 2.5 * side);
  }

  getBodyColor() {
    const c = this._colors;
    
    // Mating colors take priority
    if (this.currentState === MOA_STATE.MATING || this.heartTimer > 0) {
      return c.mating;
    }
    
    // Pregnant color
    if (this.isPregnant) {
      return c.pregnant;
    }
    
    if (this.panicLevel > 0) {
      if (!this._cachedPanicColor || abs(this._lastPanicLevel - this.panicLevel) > 0.05) {
        this._cachedPanicColor = lerpColor(c.body, c.panic, this.panicLevel);
        this._lastPanicLevel = this.panicLevel;
      }
      return this._cachedPanicColor;
    }
    
    this._lastPanicLevel = -1;
    
    if (this.hunger > this.criticalHunger) return c.starving;
    if (this.isFeeding) return c.feeding;
    return c.body;
  }

  renderMatingIndicators() {
    // Hearts when seeking/mating
    if (this.heartTimer > 0) {
      const heartAlpha = min(255, this.heartTimer * 8);
      const heartFloat = sin(frameCount * 0.15) * 2;
      
      fill(255, 100, 120, heartAlpha);
      noStroke();
      
      // Draw heart
      push();
      translate(this.pos.x, this.pos.y - this.size - 5 + heartFloat);
      scale(0.4);
      beginShape();
      vertex(0, -3);
      bezierVertex(-5, -8, -10, -3, 0, 5);
      endShape();
      beginShape();
      vertex(0, -3);
      bezierVertex(5, -8, 10, -3, 0, 5);
      endShape();
      pop();
    }
    
    // Pregnancy indicator
    if (this.isPregnant) {
      const progress = 1 - (this.pregnancyTimer / this.pregnancyDuration);
      
      // Small egg icon
      fill(245, 238, 220, 200);
      stroke(200, 195, 180, 200);
      strokeWeight(0.5);
      ellipse(this.pos.x, this.pos.y - this.size - 3, 4 * (0.5 + progress * 0.5), 5 * (0.5 + progress * 0.5));
    }
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
    
    // Mating readiness indicator (replaces egg progress)
    if (this.isReadyToMate() && !this.isPregnant) {
      fill(40, 40, 40, 150);
      rect(px - 7, py + yOff - 3, 14, 2, 1);
      fill(255, 150, 180); // Pink for ready to mate
      rect(px - 7, py + yOff - 3, 14, 2, 1);
    } else if (this.canMate && !this.isPregnant && this.mateCooldown <= 0) {
      // Show security progress toward mating readiness
      const prog = Math.min(this.securityTime / (this.securityTimeRequired * 0.5), 1);
      if (prog > 0.1) {
        fill(40, 40, 40, 150);
        rect(px - 7, py + yOff - 3, 14, 2, 1);
        fill(220, 180, 200); // Light pink for progress
        rect(px - 7, py + yOff - 3, 14 * prog, 2, 1);
      }
    }
    
    // Pregnancy progress
    if (this.isPregnant) {
      const prog = 1 - (this.pregnancyTimer / this.pregnancyDuration);
      fill(40, 40, 40, 150);
      rect(px - 7, py + yOff - 3, 14, 2, 1);
      fill(220, 200, 100); // Yellow for pregnancy
      rect(px - 7, py + yOff - 3, 14 * prog, 2, 1);
    }
    
    // State indicators
    textAlign(CENTER, BOTTOM);
    textSize(6);
    
    if (this.isMigrating) {
      fill(100, 150, 255, 220);
      text("↗", px, py + yOff - 5);
    } else if (this.currentState === MOA_STATE.SEEKING_MATE) {
      fill(255, 150, 180, 220);
      text("♥", px, py + yOff - 5);
    } else if (this.localFoodScore < 0.3 && !this.isFeeding) {
      fill(255, 180, 80, 220);
      text("!", px, py + yOff - 5);
    }
  }
}