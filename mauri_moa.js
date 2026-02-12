// ============================================
// MOA CLASS - Optimized with Age & Sprites
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

const MOA_AGE = {
  JUVENILE_MAX: 600,
  ADULT_MIN: 1200,
  MATING_AGE: 1500,
  SIZE_JUVENILE: 0.6,
  SIZE_ADOLESCENT: 0.8,
  SIZE_ADULT: 1.0
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
    baseHungerRate: 0.03,
    hungerThreshold: 35,
    criticalHunger: 80,
    eggCooldownTime: 600,
    preferredElevation: { min: 0.35, max: 0.85 },
    matingHungerThreshold: 40,
    matingRange: 15,
    matingDuration: 60,
    pregnancyDuration: 90,
    matingSearchRadius: 80
  };

  constructor(x, y, terrain, config, speciesData = null) {
    super(x, y, terrain);
    this.config = config;
    
    const species = speciesData || (typeof REGISTRY !== 'undefined' && REGISTRY.getSpecies('upland_moa')) || { config: {} };
    const s = { ...Moa.DEFAULTS, ...(species.config || {}) };
    this.speciesConfig = s;
    
    // Size & age
    this.baseSize = typeof s.size === 'object' ? random(s.size.min, s.size.max) : (s.size || random(8, 11));
    this.size = this.baseSize * MOA_AGE.SIZE_JUVENILE;
    this.age = 0;
    this.ageStage = 'juvenile';
    this.animTime = random(1000);
    
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
    
    // Security & reproduction
    this.securityTime = 0;
    this.securityTimeRequired = (s.securityTimeBase || config.securityTimeToLay) + random(s.securityTimeVariation || config.securityTimeVariation);
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    
    // Mating
    this.canMate = true;
    this.mateCooldown = 0;
    this.mateCooldownTime = s.eggCooldownTime;
    this.matingHungerThreshold = s.matingHungerThreshold;
    this.matingRangeSq = s.matingRange * s.matingRange;
    this.matingDuration = s.matingDuration;
    this.pregnancyDuration = s.pregnancyDuration;
    this.matingSearchRadius = s.matingSearchRadius;
    this.matingPartner = null;
    this.matingTimer = 0;
    this.isPregnant = false;
    this.pregnancyTimer = 0;
    this.targetMate = null;
    this.heartTimer = 0;
    
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
    
    // Season cache
    this._seasonCache = { key: null, hungerMod: 1, migrationStrength: 0, preferredElevation: { min: 0.25, max: 0.70 } };
  }

  // Compatibility stub
  _cacheSizeMultipliers() {}

  _updateSeasonCache(sm) {
    const c = this._seasonCache;
    c.key = sm.currentKey;
    c.hungerMod = sm.getHungerModifier();
    c.migrationStrength = sm.getMigrationStrength();
    const sp = sm.getPreferredElevation();
    const pp = this.speciesConfig.preferredElevation || sp;
    c.preferredElevation.min = (pp.min + sp.min) * 0.5;
    c.preferredElevation.max = (pp.max + sp.max) * 0.5;
  }

  // ============================================
  // AGE SYSTEM
  // ============================================

  updateAge(dt) {
    this.age += dt;
    
    let sizeMult;
    if (this.age >= MOA_AGE.ADULT_MIN) {
      this.ageStage = 'adult';
      sizeMult = MOA_AGE.SIZE_ADULT;
    } else if (this.age >= MOA_AGE.JUVENILE_MAX) {
      this.ageStage = 'adolescent';
      sizeMult = lerp(MOA_AGE.SIZE_ADOLESCENT, MOA_AGE.SIZE_ADULT, 
        (this.age - MOA_AGE.JUVENILE_MAX) / (MOA_AGE.ADULT_MIN - MOA_AGE.JUVENILE_MAX));
    } else {
      this.ageStage = 'juvenile';
      sizeMult = lerp(MOA_AGE.SIZE_JUVENILE, MOA_AGE.SIZE_ADOLESCENT, this.age / MOA_AGE.JUVENILE_MAX);
    }
    
    const newSize = this.baseSize * sizeMult;
    if (Math.abs(this.size - newSize) > 0.1) this.size = newSize;
  }

  isJuvenile() { return this.age < MOA_AGE.JUVENILE_MAX; }
  isAdult() { return this.age >= MOA_AGE.ADULT_MIN; }
  canMateByAge() { return this.age >= MOA_AGE.MATING_AGE; }

  // ============================================
  // MATING READINESS
  // ============================================

  isReadyToMate() {
    return this.canMate && this.mateCooldown <= 0 && this.canMateByAge() && 
      !this.isPregnant && !this.matingPartner && 
      this.hunger < this.matingHungerThreshold && 
      this.securityTime >= this.securityTimeRequired * 0.5;
  }

  canBeMate() {
    return this.alive && this.canMate && this.mateCooldown <= 0 && this.canMateByAge() &&
      !this.isPregnant && !this.matingPartner && 
      this.hunger < this.matingHungerThreshold * 1.5;
  }

  // ============================================
  // MAIN BEHAVIOR
  // ============================================

  behave(simulation, mauri, seasonManager, dt = 1) {
    this.updateAge(dt);
    this.animTime += dt;
    this._updateSeasonCache(seasonManager);
    
    const sc = this._seasonCache;
    
    // Hunger (juveniles 30% faster)
    const hungerMod = this.speciesConfig.seasonalModifiers?.[sc.key]?.hungerRate || 1;
    this.hungerRate = this.baseHungerRate * sc.hungerMod * hungerMod * (this.isJuvenile() ? 1.3 : 1);
    this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);
    
    // Cooldowns
    if (this.mateCooldown > 0) {
      this.mateCooldown -= dt;
      if (this.mateCooldown <= 0) this.canMate = true;
    }
    if (this.heartTimer > 0) this.heartTimer -= dt;
    
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
    
    this.applyPlaceableEffects(placeables, dt);
    this.preferredElevation = sc.preferredElevation;
    
    // Mating takes priority
    if (this.matingPartner || this.matingTimer > 0) {
      this.executeMating(simulation, mauri, dt);
      return;
    }
    
    if (this.isPregnant) this.executePregnancy(simulation, mauri, placeables, dt);
    
    // Determine and execute state
    this.currentState = this.determineState(eagles, placeables, sc, moas);
    this.executeState(simulation, mauri, sc, eagles, moas, placeables, dt);
    
    // Common behaviors
    this.applySeparation(moas);
    const avoid = this.avoidUnwalkable();
    avoid.mult(2);
    this.applyForce(avoid);
    this.edges();
    this.updateSecurity(eagles, dt);
    
    if (this.hunger >= this.maxHunger) this.alive = false;
      // Apply terrain slope speed modifier
    const terrainMult = this.getTerrainSpeedMultiplier();
    this.maxSpeed *= terrainMult;
    
    // Also slightly reduce acceleration on steep terrain for smoother movement
    if (terrainMult < 0.7) {
      this.vel.mult(0.95); // Slight drag on very steep terrain
    }
  }

  determineState(eagles, placeables, seasonCache, moas) {
    // Flee check
    for (let i = 0; i < eagles.length; i++) {
      const e = eagles[i];
      if (this.camouflage > 0 && random() < this.camouflage) continue;
      if (this.inShelter && !e.isHunting()) continue;
      const dx = e.pos.x - this.pos.x, dy = e.pos.y - this.pos.y;
      if (e.isHunting() && dx * dx + dy * dy < this.fleeRadiusSq) {
        this.targetMate = null;
        return MOA_STATE.FLEEING;
      }
    }
    
    if (this.matingTimer > 0 || this.matingPartner) return MOA_STATE.MATING;
    
    // Respond to courtship
    if (this.canBeMate() && !this.targetMate && this.hunger < this.hungerThreshold) {
      for (let i = 0; i < moas.length; i++) {
        if (moas[i] !== this && moas[i].targetMate === this && moas[i].alive) {
          this.targetMate = moas[i];
          return MOA_STATE.SEEKING_MATE;
        }
      }
    }
    
    // Already seeking
    if (this.targetMate?.alive && this.canBeMate() && this.hunger < this.hungerThreshold) 
    return MOA_STATE.SEEKING_MATE;
    
    // Find new mate
    if (this.isReadyToMate() && this.hunger < this.hungerThreshold) {
      const mate = this.findPotentialMate(moas);
      if (mate) {
        this.targetMate = mate;
        return MOA_STATE.SEEKING_MATE;
      }
    }
    
    this.targetMate = null;
    
    if (this.isMigrating || this.shouldMigrate(seasonCache)) return MOA_STATE.MIGRATING;
    if (this.isFeeding) return MOA_STATE.FEEDING;
    if (this.hunger > this.hungerThreshold) return MOA_STATE.FORAGING;
    
    for (let i = 0; i < placeables.length; i++) {
      if (placeables[i].alive && placeables[i].getAttractionStrength(this) > 0) return MOA_STATE.FORAGING;
    }
    
    return MOA_STATE.IDLE;
  }

  executeState(simulation, mauri, seasonCache, eagles, moas, placeables, dt) {
    this.panicLevel = 0;
    const starving = this.hunger > this.criticalHunger;
    const speedMod = starving ? 0.6 : 1;
    
    switch (this.currentState) {
      case MOA_STATE.FLEEING:
        this.isMigrating = false;
        this.targetPlant = null;
        this.targetMate = null;
        this.maxSpeed = this.fleeSpeed * speedMod;
        for (let i = 0; i < eagles.length; i++) {
          const e = eagles[i];
          if (!e.isHunting() || (this.inShelter && !e.isHunting())) continue;
          const dx = e.pos.x - this.pos.x, dy = e.pos.y - this.pos.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < this.fleeRadiusSq) {
            const flee = this.fleeFrom(e.pos.x, e.pos.y);
            flee.mult(2.5 * this.flightiness);
            this.applyForce(flee);
            this.panicLevel = Math.max(this.panicLevel, 1 - Math.sqrt(dSq) / this.fleeRadius);
          }
        }
        break;
        
      case MOA_STATE.SEEKING_MATE:
        this.maxSpeed = this.baseSpeed * 1.2;
        this.seekMate(moas, dt);
        break;
        
      case MOA_STATE.MIGRATING:
        this.targetMate = null;
        this.maxSpeed = this.baseSpeed * speedMod;
        this.executeMigration(seasonCache, dt);
        if (this.hunger > this.hungerThreshold) this.forage(simulation, mauri);
        break;
        
      case MOA_STATE.FORAGING:
        this.maxSpeed = this.baseSpeed * speedMod;
        if (!this.seekAttractions(placeables)) this.forage(simulation, mauri);
        break;
        
      case MOA_STATE.FEEDING:
        this.maxSpeed = this.baseSpeed * 0.7;
        if (this.feedingAt) {
          const dx = this.feedingAt.pos.x - this.pos.x, dy = this.feedingAt.pos.y - this.pos.y;
          if (dx * dx + dy * dy > this.feedingAt.radius * this.feedingAt.radius * 0.25) {
            this.applyForce(this.seek(this.feedingAt.pos, 0.3));
          } else {
            const w = this.wander(); w.mult(0.2); this.applyForce(w);
          }
        }
        break;
        
      default: // IDLE
        this.maxSpeed = this.baseSpeed;
        this.targetPlant = null;
        if (!this.seekAttractions(placeables)) {
          const w = this.wander(); w.mult(0.4); this.applyForce(w);
          this.applyForce(this.stayInHomeRange());
        }
    }
  }

  // ============================================
  // TERRAIN-BASED SPEED MODIFIER
  // ============================================

  /**
   * Calculate speed multiplier based on terrain slope
   * Moving uphill is slower, downhill is slightly faster
   */
  getTerrainSpeedMultiplier() {
    const velMagSq = this.vel.magSq();
    if (velMagSq < 0.0001) return 1.0; // Not moving
    
    const velMag = Math.sqrt(velMagSq);
    const lookAhead = 3; // World units to look ahead
    
    // Direction we're moving (normalized)
    const dirX = this.vel.x / velMag;
    const dirY = this.vel.y / velMag;
    
    // Sample elevation ahead
    const aheadX = this.pos.x + dirX * lookAhead;
    const aheadY = this.pos.y + dirY * lookAhead;
    
    const currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    const aheadElev = this.terrain.getElevationAt(aheadX, aheadY);
    
    // Calculate slope (elevation change per unit distance)
    // Positive = uphill, negative = downhill
    const slope = (aheadElev - currentElev) / lookAhead;
    
    // Apply speed modifier based on slope
    let multiplier;
    
    if (slope > 0) {
      // Uphill - significant slowdown
      // slope of 0.03 (moderate hill) = ~80% speed
      // slope of 0.08 (steep) = ~50% speed
      multiplier = 1 - slope * 6;
      multiplier = Math.max(0.35, multiplier); // Min 35% speed on steep climbs
    } else {
      // Downhill - slight speed boost
      // slope of -0.03 = ~106% speed
      // slope of -0.08 = ~116% speed (capped)
      multiplier = 1 - slope * 2;
      multiplier = Math.min(1.2, multiplier); // Max 120% speed downhill
    }
    
    return multiplier;
  }

  // ============================================
  // MATING
  // ============================================

  findPotentialMate(moas) {
    let best = null, bestScore = Infinity;
    const maxDistSq = this.matingSearchRadius * this.matingSearchRadius;
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0; i < moas.length; i++) {
      const o = moas[i];
      if (o === this || !o.canBeMate()) continue;
      if (o.matingPartner && o.matingPartner !== this) continue;
      
      const dx = o.pos.x - px, dy = o.pos.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) continue;
      
      let score = distSq;
      if (o.targetMate === this) score *= 0.1;
      else if (o.currentState === MOA_STATE.SEEKING_MATE && !o.targetMate) score *= 0.5;
      else if (o.isReadyToMate()) score *= 0.7;
      else if (o.currentState === MOA_STATE.FORAGING) score *= 1.5;
      
      if (score < bestScore) { bestScore = score; best = o; }
    }
    return best;
  }

  seekMate(moas, dt) {
    if (!this.targetMate?.alive || !this.targetMate.canBeMate()) {
      this.targetMate = this.findPotentialMate(moas);
      if (!this.targetMate) { this.currentState = MOA_STATE.IDLE; return; }
    }
    
    const t = this.targetMate;
    const dx = t.pos.x - this.pos.x, dy = t.pos.y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq < this.matingRangeSq) {
      this.initiateMating(t);
      return;
    }
    
    const dist = Math.sqrt(distSq);
    const predictTime = constrain(dist / max(this.maxSpeed - t.vel.mag() * 0.5, 0.1), 0, 40);
    this._tempForce.set(t.pos.x + t.vel.x * predictTime, t.pos.y + t.vel.y * predictTime);
    this.applyForce(this.seek(this._tempForce, map(dist, 0, this.matingSearchRadius, 1.5, 0.8)));
    
    if (distSq < this.matingSearchRadius * this.matingSearchRadius * 0.25) this.heartTimer = 20;
  }

  initiateMating(partner) {
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
    
    this.vel.mult(0.2);
    partner.vel.mult(0.2);
    
    if (typeof audioManager !== 'undefined' && audioManager) audioManager.playMateCheep();
  }

  executeMating(simulation, mauri, dt) {
    this.matingTimer -= dt;
    this.maxSpeed = this.baseSpeed * 0.15;
    
    if (this.matingPartner?.alive) {
      const dx = this.matingPartner.pos.x - this.pos.x;
      const dy = this.matingPartner.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq > this.matingRangeSq * 2) {
        this.applyForce(this.seek(this.matingPartner.pos, 0.5));
      } else if (distSq > 25) {
        this._tempForce.set(dx, dy);
        this._tempForce.setMag(this.maxForce * 0.3);
        this.applyForce(this._tempForce);
      }
      const w = this.wander(); w.mult(0.1); this.applyForce(w);
    } else {
      this.matingTimer = 0;
    }
    
    if (this.matingTimer <= 0) this.completeMating(simulation, mauri);
  }

  completeMating(simulation, mauri) {
    const partner = this.matingPartner;
    
    // One becomes pregnant
    if (random() < 0.5) {
      this.isPregnant = true;
      this.pregnancyTimer = this.pregnancyDuration;
    } else if (partner?.alive) {
      partner.isPregnant = true;
      partner.pregnancyTimer = partner.pregnancyDuration;
    } else {
      this.isPregnant = true;
      this.pregnancyTimer = this.pregnancyDuration;
    }
    
    // Reset state for both
    this.canMate = false;
    this.mateCooldown = this.mateCooldownTime;
    this.matingPartner = null;
    this.matingTimer = 0;
    this.currentState = MOA_STATE.IDLE;
    this.hunger += 10;
    
    if (partner?.alive) {
      partner.canMate = false;
      partner.mateCooldown = partner.mateCooldownTime;
      partner.matingPartner = null;
      partner.matingTimer = 0;
      partner.currentState = MOA_STATE.IDLE;
      partner.hunger += 10;
    }
  }

  executePregnancy(simulation, mauri, placeables, dt) {
    this.pregnancyTimer -= dt;
    
    for (let i = 0; i < placeables.length; i++) {
      const p = placeables[i];
      if (p.alive && p.type === 'nest' && p.isInRange(this.pos)) {
        this.pregnancyTimer -= dt * 0.5;
        break;
      }
    }
    
    if (this.pregnancyTimer <= 0) this.layEgg(simulation, mauri);
  }

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
      simulation.game.tutorial.fireEvent(TUTORIAL_EVENTS.FIRST_EGG, { egg });
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
    const f = this._returnForce;
    const dx = this.pos.x - tx, dy = this.pos.y - ty;
    const dSq = dx * dx + dy * dy;
    
    if (dSq < this.fleeRadiusSq && dSq > 0.0001) {
      const urgency = 1 - Math.sqrt(dSq) / this.fleeRadius;
      f.set(dx, dy);
      f.setMag(this.maxSpeed * (1 + urgency));
      f.sub(this.vel);
      f.limit(this.maxForce * 2);
    } else {
      f.set(0, 0);
    }
    return f;
  }

  stayInHomeRange() {
    const dx = this.homeRange.x - this.pos.x, dy = this.homeRange.y - this.pos.y;
    const dSq = dx * dx + dy * dy;
    const f = this._homeForce;
    
    if (dSq > this.homeRangeRadiusSq) {
      f.set(dx, dy);
      f.setMag(this.maxForce * 0.12);
      f.mult(1 + (Math.sqrt(dSq) - this.homeRangeRadius) * 0.02);
    } else {
      f.set(0, 0);
    }
    return f;
  }

  applySeparation(moas) {
    const f = this._tempForce;
    f.set(0, 0);
    let count = 0;
    
    const isMating = this.currentState === MOA_STATE.MATING || this.currentState === MOA_STATE.SEEKING_MATE;
    const sepDist = isMating ? this.separationDistSq * 0.15 : this.separationDistSq;
    
    for (let i = 0; i < moas.length; i++) {
      const o = moas[i];
      if (!o.alive || o === this || o === this.matingPartner || o === this.targetMate || o.targetMate === this) continue;
      
      const dx = this.pos.x - o.pos.x, dy = this.pos.y - o.pos.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < sepDist && dSq > 0.0001) {
        f.x += dx / dSq;
        f.y += dy / dSq;
        count++;
      }
    }
    
    if (count > 0) {
      f.mult(1 / count);
      f.setMag(this.maxSpeed);
      f.sub(this.vel);
      f.limit(this.maxForce);
      
      const mult = isMating ? 0.2 : 
        (this.currentState === MOA_STATE.FLEEING ? 0.5 * this.flockTendency : 0.8 * (2 - this.flockTendency));
      f.mult(mult);
      this.applyForce(f);
    }
  }

  // ============================================
  // FORAGING
  // ============================================

  applyPlaceableEffects(placeables, dt) {
    this.inShelter = false;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    this.isFeeding = false;
    this.feedingAt = null;
    let hungerMod = 1, feedTotal = 0;
    
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
      if (this.hunger > 30 && p.def.feedingRate) score += this.hunger * 0.3 * p.seasonalMultiplier;
      score *= p.seasonalMultiplier;
      
      if (score > bestScore) { bestScore = score; best = p; }
    }
    
    if (best) {
      this.applyForce(this.seek(best.pos, 0.8));
      if (best.isInRange(this.pos)) this.vel.mult(0.7);
      return true;
    }
    return false;
  }

  forage(simulation, mauri) {
    if (!this.targetPlant?.alive || this.targetPlant.growth < 0.5) {
      this.targetPlant = this.findPlant(simulation);
    }
    
    if (this.targetPlant) {
      const dx = this.targetPlant.pos.x - this.pos.x, dy = this.targetPlant.pos.y - this.pos.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < this.eatRadiusSq) {
        this.hunger = Math.max(0, this.hunger - this.targetPlant.consume());
        mauri.earnFromEating(mauri.onMoaEat, this.pos.x, this.pos.y);
        this.targetPlant = null;
        this.vel.mult(0.3);
      } else {
        this.applyForce(this.seek(this.targetPlant.pos, map(this.hunger, this.hungerThreshold, this.maxHunger, 0.5, 0.9)));
      }
    } else {
      const w = this.wander(); w.mult(0.6); this.applyForce(w);
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
      
      if (score < bestScore) { bestScore = score; best = p; }
    }
    return best;
  }

  // ============================================
  // MIGRATION
  // ============================================

  shouldMigrate(sc) {
    const elev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    const p = this.preferredElevation;
    const err = elev < p.min ? p.min - elev : (elev > p.max ? elev - p.max : 0);
    
    return err > 0.08 || (this.localFoodScore < 0.3 && this.hunger > 30) || (err > 0.03 && sc.migrationStrength > 0.7);
  }

  executeMigration(sc, dt) {
    if (this.migrationCooldown > 0) {
      this.migrationCooldown -= dt;
      if (this.migrationTarget) this.moveToMigrationTarget(sc);
      return;
    }
    
    if (!this.isMigrating && this.shouldMigrate(sc)) {
      this.migrationTarget = this.findMigrationTarget();
      this.isMigrating = !!this.migrationTarget;
    }
    
    if (this.isMigrating && this.migrationTarget) this.moveToMigrationTarget(sc);
  }

  findMigrationTarget() {
    const target = (this.preferredElevation.min + this.preferredElevation.max) * 0.5;
    const current = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    let bestX = 0, bestY = 0, bestScore = -Infinity, found = false;
    const mapW = this.terrain.mapWidth - 20, mapH = this.terrain.mapHeight - 20;
    
    for (let i = 0; i < 20; i++) {
      const angle = random(TWO_PI), dist = random(50, 150);
      const x = constrain(this.pos.x + cos(angle) * dist, 20, mapW);
      const y = constrain(this.pos.y + sin(angle) * dist, 20, mapH);
      
      if (!this.terrain.isWalkable(x, y)) continue;
      
      const elev = this.terrain.getElevationAt(x, y);
      let score = 1 - abs(elev - target) * 5;
      if (elev >= this.preferredElevation.min && elev <= this.preferredElevation.max) score += 0.5;
      if ((current < target && elev > current) || (current > target && elev < current)) score += 0.3;
      
      if (score > bestScore) { bestScore = score; bestX = x; bestY = y; found = true; }
    }
    
    if (found) {
      if (!this._migrationTargetVec) this._migrationTargetVec = createVector(bestX, bestY);
      else this._migrationTargetVec.set(bestX, bestY);
      return this._migrationTargetVec;
    }
    return null;
  }

  moveToMigrationTarget(sc) {
    const dx = this.migrationTarget.x - this.pos.x, dy = this.migrationTarget.y - this.pos.y;
    
    if (dx * dx + dy * dy < 400) {
      this.homeRange.set(this.migrationTarget.x, this.migrationTarget.y);
      this.homeRangeRadiusSq = this.homeRangeRadius * this.homeRangeRadius;
      this.isMigrating = false;
      this.migrationTarget = null;
      this.migrationCooldown = 300;
      return;
    }
    
    let urgency = 0.5 + sc.migrationStrength * 0.5;
    if (this.hunger > 50 && this.localFoodScore < 0.3) urgency *= 1.5;
    
    const seek = this.seek(this.migrationTarget, urgency);
    seek.mult(sc.migrationStrength);
    this.applyForce(seek);
  }

  // ============================================
  // SECURITY
  // ============================================

  updateSecurity(eagles, dt) {
    const safeDist = this.fleeRadiusSq * 0.64;
    let nearest = Infinity;
    
    for (let i = 0; i < eagles.length; i++) {
      const dx = eagles[i].pos.x - this.pos.x, dy = eagles[i].pos.y - this.pos.y;
      nearest = Math.min(nearest, dx * dx + dy * dy);
    }
    
    if (nearest > safeDist) this.securityTime += this.securityBonus * dt;
    else this.securityTime = Math.max(0, this.securityTime - dt * 2);
  }

  resistEagleAttack() {
    return this.eagleResistance > 0 && random() < this.eagleResistance;
  }

  // ============================================
  // RENDERING
  // ============================================

  render() {
    if (!this.alive) return;

    const sprite = EntitySprites.getMoaSprite(this.animTime, this.vel.magSq() > 0.01, this.isJuvenile());
    
    if (sprite) {
      push();
      translate(this.pos.x, this.pos.y);
      
      // Shadow
      noStroke();
      fill(0, 0, 0, 25);
      ellipse(1.5, 1.5, this.size * 1.0, this.size * 0.5);
      
      // Snap rotation to pixel-art friendly angles
      const targetAngle = this.vel.heading();
      this._displayAngle = SpriteAngle.snapWithHysteresis(this._displayAngle, targetAngle);
      rotate(this._displayAngle);
      
      // Mirror vertically when in 45°-225° range to keep right side visible
      if (SpriteAngle.shouldMirror(this._displayAngle)) {
        scale(1, -1);
      }
      
      imageMode(CENTER);
      image(sprite, 0, 0, this.size * 2.5, this.size * 2.5);
      pop();
    }
  }


  renderIndicators() {
    const px = this.pos.x, py = this.pos.y, s = this.size;
    const yOff = -s * 0.8 - 4;
    
    // Heart indicator
    if (this.heartTimer > 0) {
      const a = min(255, this.heartTimer * 8);
      fill(255, 120, 140, a);
      noStroke();
      push();
      translate(px, py - s - 5 + sin(this.animTime * 0.15) * 2);
      scale(0.4);
      beginShape(); vertex(0, -3); bezierVertex(-5, -8, -10, -3, 0, 5); endShape();
      beginShape(); vertex(0, -3); bezierVertex(5, -8, 10, -3, 0, 5); endShape();
      pop();
    }
    
    // Pregnancy indicator
    if (this.isPregnant) {
      const prog = 1 - this.pregnancyTimer / this.pregnancyDuration;
      fill(245, 238, 220, 220);
      stroke(200, 195, 180, 200);
      strokeWeight(0.5);
      ellipse(px, py - s - 3, 4 * (0.5 + prog * 0.5), 5 * (0.5 + prog * 0.5));
    }
    
    if (!CONFIG.showHungerBars) return;
    
    noStroke();
    
    // Hunger bar
    this._drawBar(px, py + yOff, 14, 2, 1 - this.hunger / this.maxHunger, 
      [120 + (this.hunger / this.maxHunger) * 120, 260 - (this.hunger / this.maxHunger) * 120, 120]);
    
    // Secondary bar (age/mating/pregnancy)
    if (!this.canMateByAge()) {
      this._drawBar(px, py + yOff - 3, 14, 2, this.age / MOA_AGE.MATING_AGE, [150, 200, 255]);
    } else if (this.isPregnant) {
      this._drawBar(px, py + yOff - 3, 14, 2, 1 - this.pregnancyTimer / this.pregnancyDuration, [220, 200, 100]);
    } else if (this.isReadyToMate()) {
      this._drawBar(px, py + yOff - 3, 14, 2, 1, [255, 150, 180]);
    } else if (this.canMate && this.mateCooldown <= 0) {
      const prog = this.securityTime / (this.securityTimeRequired * 0.5);
      if (prog > 0.1) this._drawBar(px, py + yOff - 3, 14, 2, Math.min(prog, 1), [220, 180, 200]);
    }
    
    // State icon
    textAlign(CENTER, BOTTOM);
    textSize(6);
    if (this.isJuvenile()) { fill(150, 200, 255, 220); text("◆", px, py + yOff - 5); }
    else if (this.isMigrating) { fill(100, 150, 255, 220); text("↗", px, py + yOff - 5); }
    else if (this.currentState === MOA_STATE.SEEKING_MATE) { fill(255, 150, 180, 220); text("♥", px, py + yOff - 5); }
    else if (this.localFoodScore < 0.3 && !this.isFeeding) { fill(255, 180, 80, 220); text("!", px, py + yOff - 5); }
  }

  _drawBar(x, y, w, h, pct, col) {
    fill(40, 40, 40, 150);
    rect(x - w/2, y, w, h, 1);
    fill(col[0], col[1], col[2]);
    rect(x - w/2, y, w * Math.max(0, Math.min(1, pct)), h, 1);
  }
}