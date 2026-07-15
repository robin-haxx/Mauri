// ============================================
// HAAST'S EAGLE CLASS
// ============================================

class HaastsEagle extends Boid {
  constructor(x, y, terrain, config = null, speciesData = null) {
    super(x, y, terrain);
    
    this.config = config;
    
    // Movement
    this.baseSpeed = 0.4;
    this.huntSpeed = 0.6;
    this.maxSpeed = this.baseSpeed;
    this.maxForce = 0.05;
    this.perceptionRadius = 160;
    this.separationDist = 100;
    this.separationDistSq = 10000;
    this.wanderStrength = 1.2;
    
    // Hunting
    // UPDATE SQUARED VALUES WITH RADIUS VALUES
    this.huntRadius = 130;
    this.huntRadiusSq = 16900;
    this.catchRadius = 12;
    this.catchRadiusSq = 144;
    this.target = null;
    this.hunting = false;
    this.huntSearchTimer = 0;
    this.huntSearchTimeout = 300;
    this.lastTargetTime = 0;
    this._huntEventFired = false;
    
    // Hunger
    this.hunger = random(20, 25);
    this.maxHunger = 100;
    this.hungerRate = 0.015;
    this.huntThreshold = 40;
    this.kills = 0;
    
    // Patrol
    this.patrolCenter = createVector(x, y);
    this.patrolRadius = random(70, 100);
    this.patrolAngle = random(TWO_PI);
    this.patrolSpeed = random(0.008, 0.012);
    this._driftTimer = 0;
    
    // State
    this.state = 'patrol';
    this.restTimer = 0;
    this.restDuration = 180;
    this.distractedBy = null;
    this.distractedTimer = 0;
    this.relocateTarget = null;
    this.relocateTimer = 0;
    
    // Visual
    this.wingspan = random(14, 18);
    this.wingPhase = random(TWO_PI);
    this.bodyLength = this.wingspan * 0.45;
    this.animTime = random(1000);
    
    // Reusable vectors
    this._tempForce = createVector();
    this._targetVec = createVector();
    this._edgeForce = createVector();
    this._separationForce = createVector();
    this._relocateTargetVec = createVector();

    // Alive flag — emergent eagles can die of starvation and be cleaned up
    // like moa (the classic controller never needed this).
    this.alive = true;

    // Sex. Emergent reproduction is sexual: a female only lays with a mature male
    // nearby, so the founding pair matters and losing a sex means eventual
    // extinction. Founder/starting-egg sexes are set explicitly by the simulation.
    this.isFemale = random() < 0.5;

    // ---- Emergent population model (opt-in via LEVEL_MECHANICS.emergentEagles) ----
    // When on, an eagle's numbers are NOT set by a top-down controller: each bird
    // holds a fixed nest, feeds or starves on its own energy budget, and breeds
    // with a varied drive scaled to prey abundance. Population ebbs and flows from
    // these individual births and deaths.
    const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
    this.emergent = !!M.emergentEagles;

    // Nest: a fixed home site (a crag eyrie, or a large tree) the bird patrols
    // around and returns to after feeding. Placed precisely by the simulation
    // (Simulation._assignEagleNest); defaults to the spawn point until then.
    this.nest = createVector(x, y);

    // Age & maturity — hatchlings must mature before they can breed.
    this.age = 0;
    this.mature = true;                 // spawned founders are already adults
    this.maturityAge = M.eagleMaturityAge ?? 1500;
    this.adultWingspan = this.wingspan; // restored when a juvenile matures

    // Starvation budget. Hunger already climbs each frame; when it stays above
    // starveThreshold for starveTimeout ticks with no catch, the bird dies.
    this.starveTimer = 0;
    this.starveThreshold = M.eagleStarveThreshold ?? 85;
    this.starveTimeout = M.eagleStarveTimeout ?? 900;

    // Reproduction: a *varied* per-bird drive, gated on being well-fed, mature,
    // and off cooldown, with a rate that scales by how far below the target
    // eagle:moa ratio the population currently sits (see _tryReproduce).
    this.reproDrive = random(0.6, 1.4);
    this.reproCooldown = 0;
    this.reproCheckInterval = M.eagleReproCheckInterval ?? 220;
    this.reproCheckTimer = random(0, this.reproCheckInterval);

    // Pair bond: emergent birds hold a partner so a mated pair keeps a *shared*
    // territory. Without this each bird chases prey and relocates its own nest
    // independently, the two drift beyond eagleMateRadius, and the female can
    // never find a mate to lay with — so reproduction silently stalls.
    this.partner = null;

    if (this.emergent) {
      // Emergent birds metabolise a little faster so the population visibly ebbs
      // across a season instead of coasting indefinitely.
      this.hungerRate = M.eagleHungerRate ?? 0.03;
    }
  }
  
  isHunting() { 
    return this.hunting && this.target !== null; 
  }
  
  // ============================================
  // BEHAVIOR
  // ============================================
  
  behave(simulation, mauri, dt = 1) {
    this.animTime += dt;
    this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);

    // Emergent population model: age, maybe starve, and (when calm) maybe breed.
    if (this.emergent) {
      this.age += dt;
      if (!this.mature && this.age >= this.maturityAge) {
        this.mature = true;
        this.wingspan = this.adultWingspan;
        this.bodyLength = this.wingspan * 0.45;
      }

      // Starvation: sustained high hunger kills; a recent feed pays the debt back.
      if (this.hunger >= this.starveThreshold) {
        this.starveTimer += dt;
        if (this.starveTimer >= this.starveTimeout) {
          this.alive = false;
          if (simulation.onEagleDeath) simulation.onEagleDeath(this);
          return;
        }
      } else if (this.starveTimer > 0) {
        this.starveTimer = Math.max(0, this.starveTimer - dt * 2);
      }

      // Reproduction check (throttled). Only when calm — never mid-hunt.
      this.reproCooldown = Math.max(0, this.reproCooldown - dt);
      this.reproCheckTimer -= dt;
      if (this.reproCheckTimer <= 0) {
        this.reproCheckTimer = this.reproCheckInterval;
        this._refreshPartner(simulation);
        if (this.state !== 'hunting' && this.state !== 'distracted') {
          this._tryReproduce(simulation);
        }
      }
    }

    const nearbyPlaceables = simulation.getNearbyPlaceables(this.pos.x, this.pos.y, 100);
    this.checkStorms(nearbyPlaceables);
    
    if (this.distractedTimer > 0) {
      this.state = 'distracted';
      this.distractedTimer -= dt;
      this.beDistracted();
      return;
    }
    
    if (this.restTimer > 0) {
      this.state = 'resting';
      this.restTimer -= dt;
      this.rest();
      return;
    }
    
    if (this.relocateTimer > 0) {
      this.state = 'relocating';
      this.relocate(dt);
      return;
    }
    
    const nearbyEagles = simulation.getNearbyEagles(this.pos.x, this.pos.y, this.separationDist * 1.5);
    const sep = this.separate(nearbyEagles);
    sep.mult(2);
    this.applyForce(sep);
    this.applyForce(this.avoidEdges());
    
    // Lotka-Volterra predation restraint: when the flock already sits at or
    // above the target eagle:moa ratio (i.e. there are more predators than the
    // prey base supports), each bird tolerates more hunger before hunting. So a
    // sudden moa die-off — which makes the population instantly "over target" —
    // is met with restraint rather than the last herd being cropped to zero; the
    // surplus predators thin out by starvation instead, tracking prey with a lag.
    let _huntThresh = this.huntThreshold;
    if (this.emergent) {
      const _M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
      const _moaN = simulation.getMoaPopulation();
      const _target = _moaN * (_M.eagleTargetRatio ?? (1 / 6));
      const _eagleN = simulation.countAliveEagles ? simulation.countAliveEagles() : this.eagles?.length ?? 1;
      if (_target > 0 && _eagleN > _target) {
        const _over = _eagleN / _target;   // >1 → predators above prey capacity
        _huntThresh += Math.min((_over - 1) * (_M.eagleOverhuntRestraint ?? 30), _M.eagleRestraintCap ?? 45);
      }
    }

    if (this.hunger > _huntThresh) {
      this.hunt(simulation, mauri, dt);
    } else {
      this.state = 'patrol';
      this.hunting = false;
      this.target = null;
      this.huntSearchTimer = 0;
      this._huntEventFired = false;
      this.patrol(dt);
    }
    
    this.edges();
  }
  
  avoidEdges() {
    const force = this._edgeForce;
    force.set(0, 0);
    
    const margin = 50;
    const strongMargin = 25;
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    const px = this.pos.x;
    const py = this.pos.y;
    
    let urgency = 1;
    
    if (px < margin) {
      force.x += (margin - px) / margin * 2;
      if (px < strongMargin) urgency = 3;
    } else if (px > mapW - margin) {
      force.x -= (px - (mapW - margin)) / margin * 2;
      if (px > mapW - strongMargin) urgency = 3;
    }
    
    if (py < margin) {
      force.y += (margin - py) / margin * 2;
      if (py < strongMargin) urgency = 3;
    } else if (py > mapH - margin) {
      force.y -= (py - (mapH - margin)) / margin * 2;
      if (py > mapH - strongMargin) urgency = 3;
    }
    
    if (force.magSq() > 0) force.setMag(this.maxForce * urgency);
    return force;
  }
  
  separate(nearbyEagles) {
    const force = this._separationForce;
    force.set(0, 0);
    let count = 0;
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0; i < nearbyEagles.length; i++) {
      const other = nearbyEagles[i];
      if (other === this) continue;
      
      const dx = px - other.pos.x;
      const dy = py - other.pos.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < this.separationDistSq && distSq > 0.0001) {
        force.x += dx / distSq;
        force.y += dy / distSq;
        count++;
      }
    }
    
    if (count > 0) {
      force.mult(1 / count);
      force.setMag(this.maxSpeed);
      force.sub(this.vel);
      force.limit(this.maxForce);
    }
    
    return force;
  }
  
  checkStorms(nearbyPlaceables) {
    if (this.distractedTimer > 0) return;
    
    for (let i = 0; i < nearbyPlaceables.length; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive || !p.def.distractsEagles) continue;
      
      const dx = p.pos.x - this.pos.x;
      const dy = p.pos.y - this.pos.y;
      
      if (dx * dx + dy * dy < p.radius * p.radius && this.hunting) {
        this.distractedBy = p;
        this.distractedTimer = 180;
        this.hunting = false;
        this.target = null;
        this.huntSearchTimer = 0;
        break;
      }
    }
  }
  
  beDistracted() {
    this.maxSpeed = this.baseSpeed * 0.8;
    
    if (this.distractedBy?.alive) {
      const dx = this.distractedBy.pos.x - this.pos.x;
      const dy = this.distractedBy.pos.y - this.pos.y;
      
      // Orbit around the distraction
      this._tempForce.set(-dy, dx);
      this._tempForce.normalize();
      this._tempForce.mult(this.maxForce * 0.8);
      this.applyForce(this._tempForce);
      
      const distSq = dx * dx + dy * dy;
      if (distSq > 400) {
        const dist = Math.sqrt(distSq);
        this._tempForce.set(dx / dist * this.maxForce * 0.3, dy / dist * this.maxForce * 0.3);
        this.applyForce(this._tempForce);
      }
    } else {
      this.distractedTimer = 0;
    }
    
    this.edges();
  }
  
  patrol(dt = 1) {
    this.maxSpeed = this.baseSpeed;
    
    this.patrolAngle += this.patrolSpeed * this.wanderStrength * dt;
    
    this._targetVec.set(
      this.patrolCenter.x + cos(this.patrolAngle) * this.patrolRadius,
      this.patrolCenter.y + sin(this.patrolAngle) * this.patrolRadius
    );
    
    this.applyForce(this.seek(this._targetVec, 0.4));
    
    const wander = this.wander();
    wander.mult(0.25);
    this.applyForce(wander);
    
    this._driftTimer += dt;
    if (this._driftTimer >= 256) {
      this._driftTimer -= 256;
      this.driftPatrolCenter(20);
    }
  }
  
  rest() {
    this.maxSpeed = this.baseSpeed * 0.5;
    this.hunting = false;
    this.target = null;

    const wander = this.wander();
    wander.mult(0.15);
    this.applyForce(wander);
    // Arrival radius here is what stops the post-kill "spin": without it the
    // seek has no target-speed ramp, so once the bird reaches its nest it
    // overshoots and whips back and forth across the point (a tight spin) for
    // the rest of the rest timer. Easing down inside 45px lets it settle.
    this.applyForce(this.seek(this.patrolCenter, 0.2, 45));

    this.edges();
  }
  
  // ============================================
  // HUNTING
  // ============================================
  
  hunt(simulation, mauri, dt = 1) {
    this.maxSpeed = this.huntSpeed;
    
    const nearbyMoas = simulation.getNearbyMoas(this.pos.x, this.pos.y, this.huntRadius);
    
    let nearestDistSq = Infinity;
    let nearestEff = Infinity;
    let nearestMoa = null;
    const px = this.pos.x, py = this.pos.y;

    const _M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
    const _preyThreshold = _M.eaglePreyPopThreshold ?? 12;
    const _scarcePenalty = _M.eagleScarcePreyPenalty ?? 6;

    for (let i = 0; i < nearbyMoas.length; i++) {
      const moa = nearbyMoas[i];
      if (!moa.alive) continue;
      if (simulation.isSpeciesProtected && simulation.isSpeciesProtected(moa.speciesKey)) continue; // never target a protected floor species
      if (moa.inShelter && this.target !== moa) continue;
      if (moa.eagleResistance > 0 && random() < moa.eagleResistance) continue;
      // Camouflage: chance the eagle simply doesn't spot this moa during a
      // scan. Once a moa IS spotted (current target) camo no longer hides it —
      // camouflage makes prey harder to find, not harder to chase.
      if (moa.camouflage > 0 && this.target !== moa && random() < moa.camouflage) continue;

      const dx = moa.pos.x - px;
      const dy = moa.pos.y - py;
      const dSq = dx * dx + dy * dy;

      // Prefer abundant prey: a species at/below the threshold is "protected" —
      // its members feel much farther away, so eagles crop common species and
      // spare rare ones (this breaks the moa death-spiral when things turn cold).
      let eff = dSq;
      if (this.emergent && simulation.getCachedSpeciesCount &&
          simulation.getCachedSpeciesCount(moa.speciesKey) <= _preyThreshold) {
        eff *= _scarcePenalty;
      }

      if (eff < nearestEff) {
        nearestEff = eff;
        nearestDistSq = dSq;   // keep the TRUE distance for the catch check
        nearestMoa = moa;
      }
    }
    
    if (nearestMoa) {
      const hadNoTarget = this.target === null;

      this.state = 'hunting';
      this.hunting = true;
      this.target = nearestMoa;
      this.huntSearchTimer = 0;
      this.lastTargetTime = frameCount;

      if (hadNoTarget && !this._huntEventFired) {
        simulation.onEagleStartHunt(this, this.target);
        this._huntEventFired = true;
        if (audioManager) audioManager.playEagleHunt();
      }
      
      // Pursue with prediction
      this._targetVec.set(
        nearestMoa.pos.x + nearestMoa.vel.x * 12,
        nearestMoa.pos.y + nearestMoa.vel.y * 12
      );
      this.applyForce(this.seek(this._targetVec, 1.4));
      
      if (nearestDistSq < this.catchRadiusSq) {
        simulation.handleEagleCatch(this, nearestMoa, mauri);
      }
    } else {
      this.huntSearchTimer += dt;
      this.hunting = true;
      this.target = null;
      this._huntEventFired = false;
      
      if (this.huntSearchTimer >= this.huntSearchTimeout) {
        if (this.emergent) {
          // Follow the prey: if a moa exists anywhere in a wide radius, shift the
          // territory toward it — eagles trail the herds downhill in winter rather
          // than roaming the barren alps. Only when NO moa can be found does the
          // bird stay put and let hunger take its course (a real local ebb).
          const followR = _M.eagleFollowRadius ?? 900;
          const prey = simulation.getClosestMoa
            ? simulation.getClosestMoa(this.pos.x, this.pos.y, followR)
            : null;
          if (prey) {
            // Drag a bonded partner along so the pair tracks prey together and
            // stays inside mate range instead of splitting up.
            this._relocateTerritory(prey.pos.x, prey.pos.y);
          }
          this.state = 'patrol';
          this.hunting = false;
          this.target = null;
          this.huntSearchTimer = 0;
          return;
        }
        this.startRelocation();
        return;
      }

      this.searchForPrey();
    }
    
    if (this.state !== 'hunting') this._huntEventFired = false;
  }
  
  searchForPrey() {
    this.maxSpeed = this.huntSpeed * 0.8;
    
    const searchAngle = frameCount * 0.02 + this.wingPhase;
    const searchRadius = this.patrolRadius + (this.huntSearchTimer * 0.3);
    
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    
    this._targetVec.set(
      constrain(this.patrolCenter.x + cos(searchAngle) * searchRadius, 50, mapW - 50),
      constrain(this.patrolCenter.y + sin(searchAngle) * searchRadius, 50, mapH - 50)
    );
    
    this.applyForce(this.seek(this._targetVec, 0.8));
    
    const wander = this.wander();
    wander.mult(0.3);
    this.applyForce(wander);
  }
  
  startRelocation() {
    this.huntSearchTimer = 0;
    this.hunting = false;
    this.target = null;
    this.state = 'relocating';
    
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    const minRelocateDistSq = 22500; // 150^2
    
    let newX, newY;
    for (let attempts = 0; attempts <= 10; attempts++) {
      newX = random(80, mapW - 80);
      newY = random(80, mapH - 80);
      
      const dx = newX - this.pos.x;
      const dy = newY - this.pos.y;
      if (dx * dx + dy * dy >= minRelocateDistSq || attempts === 10) break;
    }
    
    this._relocateTargetVec.set(newX, newY);
    this.relocateTarget = this._relocateTargetVec;
    this.relocateTimer = 180;
    
    if (CONFIG.debugMode) {
      console.log(`Eagle relocating from (${this.pos.x.toFixed(0)}, ${this.pos.y.toFixed(0)}) to (${newX.toFixed(0)}, ${newY.toFixed(0)})`);
    }
  }
  
  relocate(dt = 1) {
    this.relocateTimer -= dt;
    this.maxSpeed = this.huntSpeed * 1.2;
    
    if (!this.relocateTarget) {
      this.relocateTimer = 0;
      return;
    }
    
    const dx = this.relocateTarget.x - this.pos.x;
    const dy = this.relocateTarget.y - this.pos.y;
    
    if (dx * dx + dy * dy < 900 || this.relocateTimer <= 0) {
      this.patrolCenter.set(this.relocateTarget.x, this.relocateTarget.y);
      this.patrolAngle = random(TWO_PI);
      this.relocateTarget = null;
      this.relocateTimer = 0;
      this.state = 'hunting';
      return;
    }
    
    this.applyForce(this.seek(this.relocateTarget, 1.2));
    this.edges();
  }
  
  driftPatrolCenter(amount) {
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    this.patrolCenter.x = constrain(this.patrolCenter.x + random(-amount, amount), 80, mapW - 80);
    this.patrolCenter.y = constrain(this.patrolCenter.y + random(-amount, amount), 80, mapH - 80);
  }

  // ============================================
  // REPRODUCTION (emergent population)
  // ============================================

  // Keep a live pair bond. Drops a dead/stale partner and, when single, adopts
  // the nearest mature opposite-sex emergent bird (bonding both ways). Cheap and
  // throttled by the caller so it isn't run every frame.
  _refreshPartner(simulation) {
    if (this.partner && (!this.partner.alive || this.partner.isFemale === this.isFemale)) {
      this.partner = null;
    }
    if (this.partner && this.partner.alive) return;

    const eagles = simulation.eagles;
    let best = null, bestSq = Infinity;
    for (let i = 0; i < eagles.length; i++) {
      const o = eagles[i];
      if (o === this || !o.alive || !o.emergent || !o.mature) continue;
      if (o.isFemale === this.isFemale) continue;
      if (o.partner && o.partner !== this && o.partner.alive) continue; // already paired
      const dx = o.pos.x - this.pos.x, dy = o.pos.y - this.pos.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = o; }
    }
    if (best) { this.partner = best; best.partner = this; }
  }

  // Move this bird's territory onto (x, y) and drag a bonded partner along to a
  // nearby offset, so a following/relocating pair stays inside mate range and
  // keeps breeding instead of splitting up over the map.
  _relocateTerritory(x, y) {
    this.nest.set(x, y);
    this.patrolCenter.set(x, y);
    const mate = this.partner;
    if (mate && mate.alive) {
      const ox = x + random(-40, 40), oy = y + random(-40, 40);
      mate.nest.set(ox, oy);
      mate.patrolCenter.set(ox, oy);
    }
  }

  // Lay an egg in the nest when prey is plentiful. Emergent, not scripted: the
  // decision is per-bird (a varied drive, a fed state, a cooldown) and the rate
  // is pulled toward a target eagle:moa RATIO — the tuning knob the designer sets
  // instead of a fixed eagle count. Pressure is 0 at/above target and rises to 1
  // as the population falls below it, so numbers self-regulate around the ratio
  // without ever being forced there.
  _tryReproduce(simulation) {
    if (!this.mature || this.reproCooldown > 0) return;

    // Sexual reproduction: the female lays. A lone male, or a female with no
    // mate, does not — so the founding pair matters and a lost sex leads to
    // extinction.
    if (!this.isFemale) return;

    // Must be well-fed to invest in an egg.
    const wellFed = this.maxHunger * 0.45;
    if (this.hunger > wellFed) return;

    const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};

    const cap = M.eagleMaxPopulation ?? 12;
    const eagleN = simulation.countAliveEagles
      ? simulation.countAliveEagles()
      : simulation.eagles.length;
    if (eagleN >= cap) return;

    const moaN = simulation.getMoaPopulation();
    if (moaN <= 0) return;

    // Need a mature male within mating range to pair with.
    const mateR = M.eagleMateRadius ?? 250;
    const mateRSq = mateR * mateR;
    let hasMate = false;
    const eagles = simulation.eagles;
    for (let i = 0; i < eagles.length; i++) {
      const o = eagles[i];
      if (o === this || !o.alive || o.isFemale || !o.mature) continue;
      const dx = o.pos.x - this.pos.x, dy = o.pos.y - this.pos.y;
      if (dx * dx + dy * dy <= mateRSq) { hasMate = true; break; }
    }
    if (!hasMate) return;

    // The tuning knob: ~one eagle per six moa by default.
    const ratio = M.eagleTargetRatio ?? (1 / 6);
    const targetEagles = moaN * ratio;
    if (targetEagles <= 0) return;

    // Pressure: 0 when at/over the target, → 1 when well below it.
    let pressure = 1 - (eagleN / targetEagles);
    if (pressure <= 0) return;
    if (pressure > 1) pressure = 1;

    // Better-fed birds are likelier to breed.
    const fed = 1 - (this.hunger / wellFed); // 0..1
    const base = M.eagleReproChance ?? 0.5;
    const p = base * pressure * this.reproDrive * (0.5 + 0.5 * fed);

    if (random() < p) {
      const egg = simulation.addEgg(this.nest.x, this.nest.y);
      egg.offspringType = 'eagle';
      egg.parentSpecies = this.speciesKey || egg.parentSpecies || null;
      egg.incubationTime *= 1.6; // eagles brood a little longer than moa
      egg.forcedSex = null;      // hatchling sex is auto-balanced in _hatchEagleEgg
      this.reproCooldown = M.eagleReproCooldown ?? 2600;
      // Laying is costly — the parent must hunt again soon.
      this.hunger = Math.min(this.maxHunger, this.hunger + 25);
      if (simulation.game) {
        simulation.game.addNotification('A Pouākai pair nests — an egg is laid.', 'info');
      }
    }
  }

  // ============================================
  // RENDERING
  // ============================================
  
  render() {
    const isActiveHunt = this.hunting && this.target !== null;
    const spriteState = isActiveHunt ? 'hunting' : (this.state === 'resting' ? 'resting' : 'flying');
    const sprite = EntitySprites.getEagleSprite(this.animTime, spriteState);
    
    if (sprite) {
      push();
      translate(this.pos.x, this.pos.y);
      
      // Shadow
      noStroke();
      fill(0, 0, 0, isActiveHunt ? 35 : 25);
      ellipse(isActiveHunt ? 2 : 5, 3, this.wingspan * 1.5, this.wingspan * 0.6);
      
      const targetAngle = this.vel.heading() + HALF_PI;
      this._displayAngle = SpriteAngle.snapWithHysteresis(this._displayAngle, targetAngle);
      rotate(this._displayAngle);
      
      if (SpriteAngle.shouldMirror(this._displayAngle)) scale(-1, 1);
      
      imageMode(CENTER);
      image(sprite, 0, 0, this.wingspan * 2.8, this.wingspan * 2.1);
      
      pop();
    }
    
    if (this.state === 'distracted') {
      fill(255, 200, 100);
      noStroke();
      textSize(7);
      textAlign(CENTER, CENTER);
      text("?", this.pos.x, this.pos.y - this.wingspan - 5);
    } else if (this.state === 'relocating') {
      fill(150, 200, 255);
      noStroke();
      textSize(6);
      textAlign(CENTER, CENTER);
      text("→", this.pos.x, this.pos.y - this.wingspan - 2);
    }
    
    if (CONFIG.showHungerBars) this.renderHungerBar();
  }
  
  renderHungerBar() {
    const barWidth = 16;
    const barHeight = 2;
    const px = this.pos.x;
    const py = this.pos.y - 16;
    
    const hasTarget = this.target !== null;
    const isHunting = this.state === 'hunting';
    
    noStroke();
    
    // Background
    fill(50, 50, 50, 150);
    rect(px - 8, py, barWidth, barHeight, 1);
    
    // Hunger level
    const hungerPct = this.hunger / this.maxHunger;
    fill(100 + hungerPct * 100, 160 - hungerPct * 80, 120);
    rect(px - 8, py, barWidth * (1 - hungerPct), barHeight, 1);
    
    // State dot
    if (isHunting) {
      fill(hasTarget ? [255, 80, 80] : [255, 200, 80]);
      ellipse(px + 11, py + 1, 4, 4);
    } else if (this.state === 'relocating') {
      fill(100, 150, 255);
      ellipse(px + 11, py + 1, 4, 4);
    }
    
    // Search timer bar
    if (isHunting && !hasTarget && this.huntSearchTimer > 0) {
      fill(255, 200, 80, 150);
      rect(px - 8, py + 3, barWidth * (this.huntSearchTimer / this.huntSearchTimeout), 1, 0.5);
    }
    
    // Debug
    if (CONFIG.debugMode) {
      fill(200, 200, 200, 180);
      textSize(6);
      textAlign(CENTER, TOP);
      text(
        isHunting 
          ? (hasTarget ? 'HUNTING' : `SEARCH ${((this.huntSearchTimer / 60) | 0)}s`)
          : this.state.toUpperCase(), 
        px, py + 5
      );
    }
  }
}