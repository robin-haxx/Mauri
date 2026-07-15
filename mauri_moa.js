// ============================================
// MOA CLASS
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
  ADULT_MIN: 900,
  MATING_AGE: 900,
  SIZE_JUVENILE: 0.6,
  SIZE_ADOLESCENT: 0.9,
  SIZE_ADULT: 1.0
};

class Moa extends Boid {
  static DEFAULTS = {
    size: { min: 8, max: 11 },
    baseSpeed: 0.1,
    fleeSpeed: 0.3,
    maxForce: 0.025,
    flockTendency: 0.8,
    flightiness: 0.7,
    eagleResistance: 0,
    foragingBonus: 1.0,
    camouflage: 0,
    maxHunger: 100,
    baseHungerRate: 0.02,
    hungerThreshold: 35,
    criticalHunger: 80,
    eggCooldownTime: 600,
    preferredElevation: { min: 0.35, max: 0.85 },
    matingHungerThreshold: 40,
    matingRange: 15,
    matingDuration: 60,
    pregnancyDuration: 90,
    matingSearchRadius: 100
  };

  constructor(x, y, terrain, config, speciesData = null) {
    super(x, y, terrain);
    this.config = config;
    
    const species = speciesData || (typeof REGISTRY !== 'undefined' && REGISTRY.getSpecies('upland_moa')) || { config: {} };
    const s = { ...Moa.DEFAULTS, ...(species.config || {}) };
    this.speciesConfig = s;
    
    // Store species key for offspring
    this.speciesKey = species.key || null;

    this.isFemale = random() < 0.5;

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

    // Focal (the level's protected founders) vs non-focal (competitors). When a
    // level names its focalSpecies, the OTHER moa sustain themselves better: they
    // breed a bit faster and favour their own kind more strongly. With no focal
    // list set, every moa behaves as focal (unchanged).
    const _focal = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.focalSpecies) || null;
    this.isFocal = _focal ? _focal.indexOf(this.speciesKey) !== -1 : true;
    this.mateCrossPenalty = this.isFocal ? 40 : 80;
    this.reproCooldownMult = this.isFocal ? 1 : 0.7;

    // When the level forbids speciation, same-species pairing is mandatory:
    // cross-species is not a fallback but forbidden (see findPotentialMate).
    this._noSpeciation = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.noSpeciation) || false;
    // Later maturity (measured reproduction): a level may raise the age at which
    // a moa can first breed. Defaults to the global MOA_AGE.MATING_AGE.
    this._matingAge = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.matingAge) || MOA_AGE.MATING_AGE;
    // Soft carrying-capacity breeding gate, recomputed each tick in behave().
    // 1 = unsuppressed; <1 = probability the moa initiates courtship this tick.
    this._breedDensityFactor = 1;

    // Vulnerable-founder highlight: while this species sits at/below its threshold
    // it pulses in a highlight colour so the player can find and protect it.
    this._vhl = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.vulnerableHighlight &&
                 LEVEL_MECHANICS.vulnerableHighlight[this.speciesKey]) || null;
    this._highlightActive = false;
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
    this._nearFavouredPlant = false;  // near a plant favoured by this species
    this.preferredElevation = s.preferredElevation;
    
    // Reusable vectors
    this._tempForce = createVector();
    this._returnForce = createVector();
    this._homeForce = createVector();
    this._migrationTargetVec = null;
    
    // Cached per-frame: threatening eagles (avoids double iteration)
    this._threateningEagles = [];
    
    // Season cache
    this._seasonCache = { key: null, hungerMod: 1, migrationStrength: 0, winterness: 0, preferredElevation: { min: 0.25, max: 0.70 } };
  }

  // Called from simulation's updateEggs when hatching new moa
  _cacheSizeMultipliers() {}

  _updateSeasonCache(sm) {
    const c = this._seasonCache;
    c.key = sm.currentKey;
    c.hungerMod = sm.getHungerModifier();
    c.migrationStrength = sm.getMigrationStrength();
    // Smooth 0..1 "winterness": ramps up across late autumn, holds at 1 through
    // winter, fades across the winter->spring thaw. Winter penalties scale by
    // this instead of snapping on at the hard season boundary.
    c.winterness = sm.getWinterness ? sm.getWinterness() : (c.key === 'winter' ? 1 : 0);
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
      // Adult females ~10% larger than males (sexual dimorphism)
      sizeMult = this.isFemale ? MOA_AGE.SIZE_ADULT : MOA_AGE.SIZE_ADULT * 0.9;
    } else if (this.age >= MOA_AGE.JUVENILE_MAX) {
      this.ageStage = 'adolescent';
      const adultSize = this.isFemale ? MOA_AGE.SIZE_ADULT : MOA_AGE.SIZE_ADULT * 0.9;
      sizeMult = lerp(MOA_AGE.SIZE_ADOLESCENT, adultSize, 
        (this.age - MOA_AGE.JUVENILE_MAX) / (MOA_AGE.ADULT_MIN - MOA_AGE.JUVENILE_MAX));
    } else {
      this.ageStage = 'juvenile';
      sizeMult = lerp(MOA_AGE.SIZE_JUVENILE, MOA_AGE.SIZE_ADOLESCENT, this.age / MOA_AGE.JUVENILE_MAX);
    }
    
    const newSize = this.baseSize * sizeMult;
    if (Math.abs(this.size - newSize) > 0.1) this.size = newSize;
  }

  isJuvenile() { return this.age < MOA_AGE.JUVENILE_MAX; }
  canMateByAge() { return this.age >= this._matingAge; }

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

  // Soft carrying-capacity taper (opt-in via LEVEL_MECHANICS.breedingSoftCap).
  // Returns 1 while the total moa population is at/below the soft cap, then
  // falls linearly to breedingSuppressFloor as it climbs toward the carrying
  // cap. Used as a per-tick probability that a ready moa starts courtship, so
  // the unprompted spring boom flattens into a measured climb, and — because it
  // keys off live population — breeding rebounds automatically after a crash.
  _computeBreedDensityFactor(simulation) {
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : null;
    const soft = M ? M.breedingSoftCap : undefined;
    if (soft == null) return 1;                       // feature off — no change
    const carry = M.breedingCarryingCap ?? (soft * 3);
    const floor = M.breedingSuppressFloor ?? 0.15;
    const P = simulation.getMoaPopulation();
    if (P <= soft) return 1;
    if (P >= carry) return floor;
    const t = (P - soft) / (carry - soft);            // 0..1 across the band
    return 1 - t * (1 - floor);
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

    // Vulnerable-founder highlight flag (drawn in render): active while the
    // species is still below its threshold.
    if (this._vhl) {
      this._highlightActive = simulation.getCachedSpeciesCount(this.speciesKey) < this._vhl.until;
    }

    // Habitat stress (opt-in per level): a moa sitting far outside its
    // species' preferred elevation band burns extra energy. This keeps each
    // species genuinely tethered to its habitat rather than roaming freely.
    if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.habitatStress) {
      const niche = this.speciesConfig.preferredElevation;
      if (niche) {
        const elev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
        const margin = LEVEL_MECHANICS.habitatStressMargin ?? 0.10;
        const lo = niche.min - margin, hi = niche.max + margin;
        const err = elev < lo ? lo - elev : (elev > hi ? elev - hi : 0);
        if (err > 0) {
          let penalty = LEVEL_MECHANICS.habitatStressPenalty ?? 0.45;
          // Ramp the cold-season surcharge in smoothly rather than at the winter boundary.
          penalty *= 1 + ((LEVEL_MECHANICS.winterStressMult ?? 1.4) - 1) * sc.winterness;
          this.hunger = Math.min(this.hunger + err * penalty * dt, this.maxHunger);
        }
      }
    }
    
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
      let edible = 0, nearFav = false;
      for (let i = 0; i < plants.length; i++) {
        const p = plants[i];
        if (!p.alive) continue;
        if (p.favouredSpecies === this.speciesKey) nearFav = true;
        if (!p.dormant && p.growth > 0.5 && edible < 8) edible++;
      }
      this.localFoodScore = edible * 0.125;
      this._nearFavouredPlant = nearFav;
    }
    
    // Get nearby entities
    const px = this.pos.x, py = this.pos.y;
    const placeables = simulation.getNearbyPlaceables(px, py, 80);
    const eagles = simulation.getNearbyEagles(px, py, this.fleeRadius * 1.5);
    // Widen the neighbour query when the favoured-plant bonus is active, so
    // the doubled mating radius actually has candidates to search over.
    const moas = simulation.getNearbyMoas(px, py, Math.max(100, this.effectiveMatingRadius()));
    
    // Cache threatening eagles once (used by both determineState and executeState)
    this._cacheThreateningEagles(eagles);
    
    this.applyPlaceableEffects(placeables, dt);
    this.preferredElevation = sc.preferredElevation;
    
    // Mating takes priority
    if (this.matingPartner || this.matingTimer > 0) {
      this.executeMating(simulation, mauri, dt);
      return;
    }
    
    if (this.isPregnant) this.executePregnancy(simulation, mauri, placeables, dt);

    // Density-dependent breeding gate (recomputed here so determineState can
    // read it without threading simulation through its signature).
    this._breedDensityFactor = this._computeBreedDensityFactor(simulation);

    // Determine and execute state
    this.currentState = this.determineState(placeables, sc, moas);
    this.executeState(simulation, mauri, sc, moas, placeables, dt);
    
    // Common behaviors
    this.applySeparation(moas);
    const avoid = this.avoidUnwalkable();
    avoid.mult(2);
    this.applyForce(avoid);
    this.edges();
    this.updateSecurity(eagles, dt);
    
    if (this.hunger >= this.maxHunger) {
      // Protected floor species (e.g. the last Dinornis) don't starve to death.
      if (simulation.isSpeciesProtected && simulation.isSpeciesProtected(this.speciesKey)) {
        this.hunger = this.maxHunger * 0.9;
      } else {
        this.alive = false;
      }
    }
    
    const terrainMult = this.getTerrainSpeedMultiplier();
    this.maxSpeed *= terrainMult;
    if (terrainMult < 0.7) this.vel.mult(0.95);
  }

  // Cache which eagles are threatening (hunting + in flee range)
  _cacheThreateningEagles(eagles) {
    const threats = this._threateningEagles;
    threats.length = 0;
    
    for (let i = 0; i < eagles.length; i++) {
      const e = eagles[i];
      if (this.inShelter && !e.isHunting()) continue;
      if (!e.isHunting()) continue;
      
      const dx = e.pos.x - this.pos.x, dy = e.pos.y - this.pos.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < this.fleeRadiusSq) {
        threats.push({ eagle: e, distSq: dSq });
      }
    }
  }

  determineState(placeables, seasonCache, moas) {
    // Flee check (uses cached threats)
    if (this._threateningEagles.length > 0) {
      this.targetMate = null;
      return MOA_STATE.FLEEING;
    }
    
    if (this.matingTimer > 0 || this.matingPartner) return MOA_STATE.MATING;
    
    // Respond to courtship (opposite sex only)
    if (this.canBeMate() && !this.targetMate && this.hunger < this.hungerThreshold) {
      for (let i = 0; i < moas.length; i++) {
        if (moas[i] !== this && moas[i].targetMate === this && 
            moas[i].alive && moas[i].isFemale !== this.isFemale) {
          this.targetMate = moas[i];
          return MOA_STATE.SEEKING_MATE;
        }
      }
    }
    
    if (this.targetMate?.alive && this.canBeMate() && this.hunger < this.hungerThreshold) 
      return MOA_STATE.SEEKING_MATE;
    
    if (this.isReadyToMate() && this.hunger < this.hungerThreshold &&
        (this._breedDensityFactor >= 1 || random() < this._breedDensityFactor)) {
      const mate = this.findPotentialMate(moas);
      if (mate) { this.targetMate = mate; return MOA_STATE.SEEKING_MATE; }
    }
    
    this.targetMate = null;
    
    // Actively eating at a placeable: stay on the food. (This used to rank
    // below MIGRATING, so a seasonal elevation shift pulled moa off feeders
    // mid-meal — a classic "starved out of nowhere".)
    if (this.isFeeding) return MOA_STATE.FEEDING;

    // Hunger deadband: start foraging above the threshold but keep foraging
    // until comfortably below it. Without it, one bite dropped hunger just
    // under the threshold → IDLE → home-range spring yanked the moa back →
    // hunger re-crossed → out again (rubber-banding).
    const _wasForaging = this.currentState === MOA_STATE.FORAGING || this.currentState === MOA_STATE.FEEDING;
    const _forageExit = Math.max(this.hungerThreshold - 10, 5);
    const _hungry = this.hunger > (_wasForaging ? _forageExit : this.hungerThreshold);

    // Food outranks migration when urgent or actually available: a starving
    // moa always eats first; a merely-hungry one eats first unless local food
    // is scarce (in which case migrating IS the path to food — and it still
    // forages opportunistically while travelling).
    if (_hungry && (this.hunger > this.criticalHunger || this.localFoodScore >= 0.3)) {
      return MOA_STATE.FORAGING;
    }

    if (this.isMigrating || this.shouldMigrate(seasonCache)) return MOA_STATE.MIGRATING;
    if (_hungry) return MOA_STATE.FORAGING;
    
    for (let i = 0; i < placeables.length; i++) {
      if (placeables[i].alive && placeables[i].getAttractionStrength(this) > 0) return MOA_STATE.FORAGING;
    }
    
    return MOA_STATE.IDLE;
  }

  executeState(simulation, mauri, seasonCache, moas, placeables, dt) {
    this.panicLevel = 0;
    const starving = this.hunger > this.criticalHunger;
    const speedMod = starving ? 0.6 : 1;
    
    switch (this.currentState) {
      case MOA_STATE.FLEEING:
        this.isMigrating = false;
        this.targetPlant = null;
        this.targetMate = null;
        this.maxSpeed = this.fleeSpeed * speedMod;
        // Use cached threatening eagles
        for (let i = 0; i < this._threateningEagles.length; i++) {
          const { eagle, distSq } = this._threateningEagles[i];
          const flee = this.fleeFrom(eagle.pos.x, eagle.pos.y);
          flee.mult(2.5 * this.flightiness);
          this.applyForce(flee);
          this.panicLevel = Math.max(this.panicLevel, 1 - Math.sqrt(distSq) / this.fleeRadius);
        }
        break;
        
      case MOA_STATE.SEEKING_MATE:
        this.maxSpeed = this.baseSpeed * 1.2;
        this.seekMate(moas, dt);
        break;
        
      case MOA_STATE.MIGRATING:
        this.targetMate = null;
        this.maxSpeed = this.baseSpeed * speedMod;
        this.executeMigration(simulation, seasonCache, dt);
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
          const r = this.feedingAt.radius;
          // Graze across the stand rather than sliding to its centre: only steer
          // back when near the outer edge (and gently, with arrival so it eases
          // in instead of oscillating across the middle). Inside that band the
          // moa just wanders/grazes, so a herd spreads over the patch and can
          // still drift on through a corridor of feeders.
          if (dx * dx + dy * dy > r * r * 0.64) {
            this.applyForce(this.seek(this.feedingAt.pos, 0.3, r * 0.8));
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
  // TERRAIN-BASED SPEED
  // ============================================

  getTerrainSpeedMultiplier() {
    const velMagSq = this.vel.magSq();
    if (velMagSq < 0.0001) return 1.0;
    
    const velMag = Math.sqrt(velMagSq);
    const lookAhead = 3;
    const dirX = this.vel.x / velMag;
    const dirY = this.vel.y / velMag;
    
    const currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    const aheadElev = this.terrain.getElevationAt(this.pos.x + dirX * lookAhead, this.pos.y + dirY * lookAhead);
    const slope = (aheadElev - currentElev) / lookAhead;
    
    // Uphill: significant slowdown; Downhill: slight boost
    return slope > 0
      ? Math.max(0.35, 1 - slope * 6)
      : Math.min(1.2, 1 - slope * 2);
  }

  // ============================================
  // MATING
  // ============================================

  // Mating search radius — doubled while standing near a plant favoured by
  // this species (a well-fed spot is a good place to pair up from).
  effectiveMatingRadius() {
    return this._nearFavouredPlant ? this.matingSearchRadius * 2 : this.matingSearchRadius;
  }

  findPotentialMate(moas) {
    // Two buckets: any same-species mate always beats a cross-species one, so a
    // small founder population reliably pairs within itself instead of being
    // forced to hybridise when both members happen to share a sex nearby.
    let best = null, bestScore = Infinity;            // same species
    let bestCross = null, bestCrossScore = Infinity;  // other species
    const _mateR = this.effectiveMatingRadius();
    const maxDistSq = _mateR * _mateR;
    const px = this.pos.x, py = this.pos.y;

    for (let i = 0; i < moas.length; i++) {
      const o = moas[i];
      if (o === this || !o.canBeMate()) continue;
      if (o.isFemale === this.isFemale) continue; // Must be opposite sex
      if (o.matingPartner && o.matingPartner !== this) continue;

      const dx = o.pos.x - px, dy = o.pos.y - py;
      const distSq = dx * dx + dy * dy;
      if (distSq > maxDistSq) continue;

      let score = distSq;
      if (o.targetMate === this) score *= 0.1;
      else if (o.currentState === MOA_STATE.SEEKING_MATE && !o.targetMate) score *= 0.5;
      else if (o.isReadyToMate()) score *= 0.7;
      else if (o.currentState === MOA_STATE.FORAGING) score *= 1.5;

      if (o.speciesKey === this.speciesKey) {
        if (score < bestScore) { bestScore = score; best = o; }
      } else {
        const cs = score * this.mateCrossPenalty; // cross-species is heavily discouraged
        if (cs < bestCrossScore) { bestCrossScore = cs; bestCross = o; }
      }
    }

    if (best) return best;              // prefer own kind whenever one is available
    if (this._noSpeciation) return null; // level forbids hybridising — pause instead
    return bestCross;                   // otherwise cross-species is a last resort
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
    this.applyForce(this.seek(this._tempForce, map(dist, 0, this.matingSearchRadius, 1.5, 0.8), 12));
    
    if (distSq < this.matingSearchRadius * this.matingSearchRadius * 0.25) this.heartTimer = 20;
  }

  initiateMating(partner) {
    this._setMatingState(this, partner);
    this._setMatingState(partner, this);
    this.vel.mult(0.2);
    partner.vel.mult(0.2);
    if (audioManager) audioManager.playMateCheep();
  }

  _setMatingState(moa, partner) {
    moa.matingPartner = partner;
    moa.matingTimer = this.matingDuration;
    moa.currentState = MOA_STATE.MATING;
    moa.heartTimer = this.matingDuration;
    moa.targetMate = null;
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
    
    // The female becomes pregnant
    const female = this.isFemale ? this : partner;
    if (female?.alive) {
      female.isPregnant = true;
      female.pregnancyTimer = female.pregnancyDuration;
    }
    
    // Reset both
    this._resetAfterMating(this);
    if (partner?.alive) this._resetAfterMating(partner);
  }

  _resetAfterMating(moa) {
    moa.canMate = false;
    let _cd = moa.mateCooldownTime;
    if (typeof LEVEL_MECHANICS !== 'undefined') {
      // Cold-season breeding slowdown ramps in with winterness instead of snapping
      // on at the winter boundary.
      const _wm = LEVEL_MECHANICS.winterBreedingCooldownMult ?? 1;
      _cd *= 1 + (_wm - 1) * ((moa._seasonCache && moa._seasonCache.winterness) || 0);
      // Global "more measured" breeding: a flat lengthening of every cooldown.
      _cd *= (LEVEL_MECHANICS.breedingCooldownMult ?? 1);
    }
    _cd *= (moa.reproCooldownMult || 1);   // non-focal competitors breed a little faster
    moa.mateCooldown = _cd;
    moa.matingPartner = null;
    moa.matingTimer = 0;
    moa.currentState = MOA_STATE.IDLE;
    moa.hunger += 10;
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
    const _cap = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.maxPerSpecies) || Infinity;
    if (simulation.getMoaPopulation() >= this.config.maxMoaPopulation ||
        (this.speciesKey && simulation.getSpeciesCount(this.speciesKey) >= _cap)) {
      this.isPregnant = false;
      this.pregnancyTimer = 0;
      return;
    }
    
    const aliveEggs = simulation.eggs.filter(e => e.alive && !e.hatched);
    const egg = simulation.addEgg(this.pos.x, this.pos.y);
    egg.speedBonus = this.eggSpeedBonus;
    if (this.speciesKey) egg.parentSpecies = this.speciesKey;
    
    if (aliveEggs.length === 0 && simulation.game?.tutorial) {
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
        const fed = p.feedMoa(this, dt);
        if (fed > 0) {          // a species-exclusive feeder returns 0 to the wrong moa
          feedTotal += fed;
          this.isFeeding = true;
          this.feedingAt = p;
        }
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
      const r = best.radius || 15;
      const dx = best.pos.x - this.pos.x, dy = best.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > r * r) {
        // GUIDE phase: steer toward the patch at cruising speed with NO arrival
        // braking, so the moa reaches it carrying momentum instead of
        // decelerating onto the centre point. The old arrive-vs-attract tug (and
        // the vel*0.9 brake once in range) is what rubber-banded big, fast movers
        // like the giant moa as they hit a stand.
        this.applyForce(this.seek(best.pos, 0.8));
      } else {
        // ACROSS phase: once inside the patch, stop pulling the moa to the
        // centre. Preserve its heading so it grazes straight across and out the
        // far side — a *line* of favoured plants then behaves like a corridor
        // that conveys the herd along, letting the player steer where moa go
        // rather than trapping each one sliding to a centre point.
        const vMagSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
        if (vMagSq > 0.0001) {
          const s = (this.maxForce * 0.6) / Math.sqrt(vMagSq);
          this._tempForce.set(this.vel.x * s, this.vel.y * s);
          this.applyForce(this._tempForce);
        } else {
          // Stalled dead inside a patch — nudge it back into motion through the
          // stand instead of letting it park on the centre.
          this.applyForce(this.seek(best.pos, 0.5));
        }
      }
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
        let gain = this.targetPlant.consume();

        // Forest competition (opt-in per level): when the forest is crowded,
        // each moa wins less from a given plant (interference competition).
        // Combined with a glacially-scarce forest this makes habitat contested.
        if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.forestCompetition
            && FOREST_BIOMES.has(this.targetPlant.biomeKey)) {
          const radius = LEVEL_MECHANICS.forestCompetitionRadius ?? 45;
          const neighbours = simulation.getNearbyMoas(this.pos.x, this.pos.y, radius);
          let competitors = 0;
          for (let n = 0; n < neighbours.length; n++) {
            const m = neighbours[n];
            if (m !== this && m.alive) competitors++;
          }
          const tolerance = LEVEL_MECHANICS.forestCompetitionTolerance ?? 2;
          if (competitors > tolerance) {
            const over = competitors - tolerance;
            let per = LEVEL_MECHANICS.forestCompetitionPenalty ?? 0.18;
            // Cold-season competition ramps in with winterness (smooth, not a cliff).
            per *= 1 + ((LEVEL_MECHANICS.winterCompetitionMult ?? 1.6) - 1) * this._seasonCache.winterness;
            gain *= Math.max(0.25, 1 - over * per);
          }
        }

        // Diet breadth. A species-specific planted resource (lancewood, speargrass)
        // yields little to species it isn't favoured by, so it stays a targeted
        // founder subsidy (aggregation model of coexistence). Meanwhile the
        // non-focal competitors are dietary generalists: they win MORE from the
        // wild background flora than the specialist founders do, which is their
        // niche edge rather than nibbling the founders' planted food.
        if (this.targetPlant.favouredSpecies) {
          if (this.targetPlant.favouredSpecies !== this.speciesKey) {
            gain *= (typeof LEVEL_MECHANICS !== 'undefined' ? (LEVEL_MECHANICS.unfavouredBrowsePenalty ?? 0.25) : 0.25);
          }
          // else: browsing its own favoured plant — full gain.
        } else if (!this.isFocal && typeof LEVEL_MECHANICS !== 'undefined') {
          gain *= (LEVEL_MECHANICS.nonFocalGeneralistBonus ?? 1); // wild plant + generalist
        }

        this.hunger = Math.max(0, this.hunger - gain);
        mauri.earnFromEating(mauri.onMoaEat, this.pos.x, this.pos.y);
        this.targetPlant = null;
        this.vel.mult(0.3);
      } else {
        this.applyForce(this.seek(this.targetPlant.pos, map(this.hunger, this.hungerThreshold, this.maxHunger, 0.5, 0.9), 10));
      }
    } else {
      const w = this.wander(); w.mult(0.6); this.applyForce(w);
    }
  }

  findPlant(simulation) {
    // Starving moa cast a wider net rather than dying next to just-out-of-range food
    const _range = (this.hunger > this.criticalHunger ? 150 : 100) * this.foragingBonus;
    const plants = simulation.getNearbyPlants(this.pos.x, this.pos.y, _range);
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
      if (p.favouredSpecies) {
        if (p.favouredSpecies === this.speciesKey) score *= 0.6;  // prefer own resource
        else score *= 4.0;                                        // largely ignore others'
      }
      
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

  executeMigration(simulation, sc, dt) {
    if (this.migrationCooldown > 0) {
      this.migrationCooldown -= dt;
      if (this.migrationTarget) this.moveToMigrationTarget(sc);
      return;
    }

    if (!this.isMigrating && this.shouldMigrate(sc)) {
      this.migrationTarget = this.findMigrationTarget(simulation);
      this.isMigrating = !!this.migrationTarget;
    }

    if (this.isMigrating && this.migrationTarget) this.moveToMigrationTarget(sc);
  }

  findMigrationTarget(simulation) {
    const target = (this.preferredElevation.min + this.preferredElevation.max) * 0.5;
    const current = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    let bestX = 0, bestY = 0, bestScore = -Infinity, found = false;
    const mapW = this.terrain.mapWidth - 20, mapH = this.terrain.mapHeight - 20;

    // Forest-seeking species (e.g. little bush moa) bias candidate scoring
    // toward dense tree cover (beech/rimu/fern).
    const forestAffinity =
      (simulation && typeof FOREST_TREES !== 'undefined' &&
       this.speciesConfig.forestAffinity) || 0;

    for (let i = 0; i < 20; i++) {
      const angle = random(TWO_PI), dist = random(50, 150);
      const x = constrain(this.pos.x + cos(angle) * dist, 20, mapW);
      const y = constrain(this.pos.y + sin(angle) * dist, 20, mapH);

      if (!this.terrain.isWalkable(x, y)) continue;

      const elev = this.terrain.getElevationAt(x, y);
      let score = 1 - abs(elev - target) * 5;
      if (elev >= this.preferredElevation.min && elev <= this.preferredElevation.max) score += 0.5;
      if ((current < target && elev > current) || (current > target && elev < current)) score += 0.3;

      if (forestAffinity > 0) {
        const plants = simulation.getNearbyPlants(x, y, 60);
        let trees = 0;
        for (let j = 0; j < plants.length && trees < 8; j++) {
          const p = plants[j];
          if (p.alive && FOREST_TREES.has(p.type)) trees++;
        }
        score += (trees / 8) * forestAffinity;  // up to +forestAffinity at full cover
      }

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
    
    const seek = this.seek(this.migrationTarget, urgency, 25);
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

    const variant = this.speciesConfig.spriteSet;
    const sprite = EntitySprites.getMoaSprite(this.animTime, this.vel.magSq() > 0.01, this.isJuvenile(), variant);
    if (!sprite) return;
    
    push();
    translate(this.pos.x, this.pos.y);

    // Species highlight: a soft pulsing halo under the moa, driven purely by
    // the player toggle (population panel / fullscreen focus buttons; focus
    // species start toggled on). The low-population warning is a separate red
    // ring drawn in renderIndicators so it sits above trees.
    if (typeof SPECIES_HIGHLIGHT !== 'undefined' && SPECIES_HIGHLIGHT.has(this.speciesKey)) {
      const _hc = this.speciesConfig.highlightColor ||
                  (this._vhl && this._vhl.color) || [255, 235, 120];
      const _pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12);
      noStroke();
      fill(_hc[0], _hc[1], _hc[2], 55 + _pulse * 95);
      ellipse(0, 0, this.size * (2.8 + _pulse * 1.4), this.size * (2.8 + _pulse * 1.4));
    }

    // Shadow
    noStroke();
    fill(0, 0, 0, 25);
    ellipse(1.5, 1.5, this.size * 1.0, this.size * 0.5);
    
    // Only update facing while actually moving: heading() of a near-zero
    // velocity is pure noise and made stationary moa spin on the spot
    // (mating, feeding, uphill crawls). Below the gate, keep the last facing.
    if (this.vel.magSq() > 0.0025) {
      this._displayAngle = SpriteAngle.snapWithHysteresis(this._displayAngle, this.vel.heading());
    }
    if (this._displayAngle === undefined) this._displayAngle = SpriteAngle.snap(this.vel.heading());
    rotate(this._displayAngle);
    
    if (SpriteAngle.shouldMirror(this._displayAngle)) scale(1, -1);
    
    // Per-species tint (by genus), but skip it for species with their own
    // dedicated sprite set (e.g. bush moa) so their art shows unaltered.
    const _tint = variant ? null : this.speciesConfig.tint;
    if (_tint) tint(_tint[0], _tint[1], _tint[2]);
    imageMode(CENTER);
    const _drawSize = this.size * 2.5 * (this.speciesConfig.spriteScale || 1);
    image(sprite, 0, 0, _drawSize, _drawSize);
    pop();
  }

  // Pulsing red vulnerable-founder ring. Called from renderIndicators, and
  // re-drawn above the tutorial overlay for tips flagged ringsAboveUI.
  renderLowPopRing() {
    if (!this._highlightActive) return;
    const _pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12);
    const _d = this.size * (2.8 + _pulse * 1.4);
    noFill();
    stroke(255, 70, 60, 120 + _pulse * 120);
    strokeWeight(1.5);
    ellipse(this.pos.x, this.pos.y, _d, _d);
  }

  renderIndicators() {
    const px = this.pos.x, py = this.pos.y, s = this.size;
    const yOff = -s * 0.8 - 4;

    // Low-population warning: a pulsing red ring. Drawn here (the indicator
    // pass, top render layer) rather than under the body, so it stays visible
    // over trees and other plants.
    this.renderLowPopRing();
    
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
    
    // Pregnancy indicator (females only now)
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
    // Sex indicator for adults
    else if (this.canMateByAge()) { 
      fill(200, 200, 200, 140); 
      text(this.isFemale ? "♀" : "♂", px, py + yOff - 5); 
    }
  }

  // Small two-tone progress bar used by the indicators above.
  _drawBar(x, y, w, h, pct, col) {
    fill(40, 40, 40, 150);
    rect(x - w/2, y, w, h, 1);
    fill(col[0], col[1], col[2]);
    rect(x - w/2, y, w * Math.max(0, Math.min(1, pct)), h, 1);
  }
}