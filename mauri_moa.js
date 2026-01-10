// ============================================
// MOA CLASS - With seasonal migration
// ============================================
class Moa extends Boid {
  constructor(x, y, terrain, config) {
    super(x, y, terrain);
    this.config = config;
    
    // Base speeds - these are the reference values
    this.baseSpeed = 0.25;
    this.fleeSpeed = .6;
    this.starvingSpeedMultiplier = 0.6;
    
    // Current maxSpeed will be calculated from these
    this.maxSpeed = this.baseSpeed;
    this.maxForce = 0.025;
    this.perceptionRadius = 35;
    this.separationDist = 50;
    this.fleeRadius = 85;
    
    this.homeRange = createVector(x, y);
    this.homeRangeRadius = random(50, 90);
    this.homeRangeStrength = 0.12;
    
    this.size = random(8, 11);
    this.bodyColor = color(random(90, 110), random(60, 75), random(28, 40));
    this.legPhase = random(TWO_PI);
    
    this.alive = true;
    this.panicLevel = 0;
    
    this.hunger = random(15, 35);
    this.maxHunger = 100;
    this.baseHungerRate = 0.04;
    this.hungerRate = 0.04;
    this.hungerThreshold = 35;
    this.criticalHunger = 80;
    this.eatRadius = 14;
    
    this.targetPlant = null;
    this.targetPlaceable = null;
    this.isForaging = false;

    this.isFeeding = false;
    this.feedingAt = null;  // Reference to placeable being fed at
    this.lastFedTime = 0;
    
    this.baseSecurityTime = config.securityTimeToLay;
    this.securityTimeRequired = config.securityTimeToLay + Math.floor(random(0, config.securityTimeVariation));
    
    this.securityTime = 0;
    this.canLayEgg = true;
    this.eggCooldown = 0;
    this.eggCooldownTime = 800;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    
    this.inShelter = false;
    this.preferredElevation = { min: 0.25, max: 0.70 };

    // Migration state
    this.isMigrating = false;
    this.migrationTarget = null;
    this.lastMigrationCheck = 0;
    this.migrationCooldown = 0;
    
    // Track food availability in current area
    this.localFoodScore = 1.0;
    this.foodCheckTimer = 0;
  }
  
  // New method to calculate current speed based on state
  calculateSpeed(isFleeing, isStarving) {
    let speed = isFleeing ? this.fleeSpeed : this.baseSpeed;
    
    if (isStarving) {
      speed *= this.starvingSpeedMultiplier;
    }
    
    return speed;
  }
  
  behave(moas, eagles, plants, placeables, simulation, mauri, seasonManager) {
    // Apply seasonal hunger modifier
    this.hungerRate = this.baseHungerRate * seasonManager.getHungerModifier();
    this.hunger = min(this.hunger + this.hungerRate, this.maxHunger);
    
    this.preferredElevation = seasonManager.getPreferredElevation();
    
    if (this.eggCooldown > 0) {
      this.eggCooldown--;
      this.canLayEgg = this.eggCooldown <= 0;
    }
    
    // Assess local food availability
    this.assessLocalFood(simulation, seasonManager);
    
    // Check placeable effects
    this.checkPlaceableEffects(placeables, simulation);
    
    // Check for threats
    let dominated = false;
    let nearestThreatDist = Infinity;
    this.panicLevel = 0;
    
    for (let eagle of eagles) {
      let d = p5.Vector.dist(this.pos, eagle.pos);
      if (this.inShelter && !eagle.isHunting()) continue;
      
      if (eagle.isHunting() && d < this.fleeRadius) {
        let fleeForce = this.flee(eagle.pos, this.fleeRadius);
        fleeForce.mult(2.5);
        this.applyForce(fleeForce);
        dominated = true;
        nearestThreatDist = min(nearestThreatDist, d);
        this.panicLevel = max(this.panicLevel, 1 - d / this.fleeRadius);
      } else if (d < this.fleeRadius * 0.5) {
        nearestThreatDist = min(nearestThreatDist, d);
      }
    }
    
    // Security time
    if (nearestThreatDist > this.fleeRadius * 0.8) {
      this.securityTime += this.securityBonus;
    } else {
      this.securityTime = 0;
    }
    
    // Speed
    let isStarving = this.hunger > this.criticalHunger;
    this.maxSpeed = this.calculateSpeed(dominated, isStarving);
    
    // Reset home range strength
    this.homeRangeStrength = 0.12;
    
    if (dominated) {
      // Fleeing - cancel migration
      this.isMigrating = false;
      this.isForaging = false;
      this.targetPlant = null;
      this.targetPlaceable = null;
      let sep = this.separate(moas).mult(0.5);
      this.applyForce(sep);
    } else {
      // Try to lay egg
      this.tryLayEgg(simulation, mauri, placeables);
      
      // MIGRATION PRIORITY - if migrating, this takes precedence
      let shouldMigrate = this.shouldMigrate(seasonManager);
      
      if (shouldMigrate || this.isMigrating) {
        this.migrateSeasonally(seasonManager);
        
        // Still forage while migrating if very hungry
        if (this.hunger > 60) {
          this.forage(simulation, mauri);
        }
      } else {
        // Normal behavior when not migrating
        let attracted = this.seekPlaceableAttractions(placeables, simulation);
        
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
      
      let sep = this.separate(moas).mult(0.8);
      this.applyForce(sep);
    }
    
    let avoid = this.avoidUnwalkable().mult(2);
    this.applyForce(avoid);
    
    this.edges();
    
    if (this.hunger >= this.maxHunger) {
      this.alive = false;
    }
  }
  
  
  // migrateSeasonally() {
  //   let currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
  //   let prefMin = this.preferredElevation.min;
  //   let prefMax = this.preferredElevation.max;
  //   let prefMid = (prefMin + prefMax) / 2;
    
  //   if (currentElev < prefMin - 0.05 || currentElev > prefMax + 0.05) {
  //     let gradient = this.getElevationGradient();
      
  //     if (currentElev < prefMid) {
  //       this.applyForce(gradient.mult(0.2));
  //     } else {
  //       this.applyForce(gradient.mult(-0.2));
  //     }
      
  //     if (frameCount % 120 === 0) {
  //       if (currentElev >= prefMin && currentElev <= prefMax) {
  //         this.homeRange = this.pos.copy();
  //       }
  //     }
  //   }
  // }
  
  getElevationGradient() {
    const step = 5;
    let ex = this.terrain.getElevationAt(this.pos.x + step, this.pos.y) -
             this.terrain.getElevationAt(this.pos.x - step, this.pos.y);
    let ey = this.terrain.getElevationAt(this.pos.x, this.pos.y + step) -
             this.terrain.getElevationAt(this.pos.x, this.pos.y - step);
    return createVector(ex, ey).normalize().mult(this.maxForce);
  }
  
  checkPlaceableEffects(placeables, simulation) {
    this.inShelter = false;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    this.isFeeding = false;
    this.feedingAt = null;
    
    let hungerMod = 1;
    let feedingRateTotal = 0;
    
    // Use spatial grid if available
    let nearbyPlaceables;
    if (simulation && simulation.placeableGrid) {
      nearbyPlaceables = simulation.placeableGrid.getInRadius(this.pos.x, this.pos.y, 80);
    } else {
      nearbyPlaceables = placeables;
    }
    
    for (let p of nearbyPlaceables) {
      if (!p.alive || !p.isInRange(this.pos)) continue;
      
      // Shelter effects
      if (p.def.blocksEagleVision) {
        this.inShelter = true;
      }
      
      // Security bonuses
      if (p.def.securityBonus) {
        this.securityBonus = max(this.securityBonus, p.def.securityBonus * p.seasonalMultiplier);
      }
      
      // Egg speed bonus
      if (p.def.eggSpeedBonus) {
        this.eggSpeedBonus = max(this.eggSpeedBonus, p.def.eggSpeedBonus * p.seasonalMultiplier);
      }
      
      // Hunger slowdown (waterhole effect)
      if (p.def.hungerSlowdown) {
        hungerMod = min(hungerMod, p.def.hungerSlowdown);
      }
      
      // Passive feeding from placeables
      if (p.def.feedingRate) {
        let rate = p.feedMoa(this);  // This returns the seasonal-adjusted rate
        feedingRateTotal += rate;
        this.isFeeding = true;
        this.feedingAt = p;
      }
    }
    
    // Apply hunger modifications
    this.hungerRate = this.baseHungerRate * hungerMod;
    
    // Apply passive feeding (reduce hunger)
    if (feedingRateTotal > 0) {
      this.hunger = max(0, this.hunger - feedingRateTotal);
      this.lastFedTime = frameCount;
    }
  }
  
  seekPlaceableAttractions(placeables, simulation) {
    let bestTarget = null;
    let bestScore = -Infinity;
    
    // Use spatial grid if available
    let nearbyPlaceables;
    if (simulation && simulation.placeableGrid) {
      nearbyPlaceables = simulation.placeableGrid.getInRadius(this.pos.x, this.pos.y, 120);
    } else {
      nearbyPlaceables = placeables.filter(p => p5.Vector.dist(this.pos, p.pos) < 120);
    }
    
    for (let p of nearbyPlaceables) {
      if (!p.alive) continue;
      
      let d = p5.Vector.dist(this.pos, p.pos);
      let attractionStrength = p.getAttractionStrength(this);
      
      if (attractionStrength <= 0) continue;
      
      // Score based on attraction strength and distance
      let score = attractionStrength * 50 - d * 0.3;
      
      // Bonus if we're hungry and this is a feeding placeable
      if (this.hunger > 30 && p.def.feedingRate) {
        score += (this.hunger / 100) * 30 * p.seasonalMultiplier;
      }
      
      // Bonus for seasonal effectiveness
      score *= p.seasonalMultiplier;
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = p;
      }
    }
    
    if (bestTarget && bestScore > 10) {
      // Move toward the placeable
      let seekForce = this.seek(bestTarget.pos, 0.8);
      this.applyForce(seekForce);
      this.targetPlaceable = bestTarget;
      
      // If inside, slow down to feed
      if (bestTarget.isInRange(this.pos)) {
        this.vel.mult(0.7);  // Slow down while feeding
      }
      
      return true;
    }
    
    return false;
  }
  
  forage(simulation, mauri) {
    this.isForaging = true;
    
    // If we're being passively fed by a placeable, don't actively seek plants
    // unless we're very hungry
    if (this.isFeeding && this.hunger < 60) {
      // Just stay in the feeding zone
      if (this.feedingAt) {
        let d = p5.Vector.dist(this.pos, this.feedingAt.pos);
        if (d > this.feedingAt.radius * 0.5) {
          // Move back toward center of feeding zone
          let seekForce = this.seek(this.feedingAt.pos, 0.3);
          this.applyForce(seekForce);
        } else {
          // Gentle wander within zone
          let wander = this.wander().mult(0.2);
          this.applyForce(wander);
        }
      }
      return;
    }
    
    // Otherwise, seek plants normally
    if (!this.targetPlant || !this.targetPlant.alive) {
      this.targetPlant = this.findNearestPlant(simulation);
    }
    
    if (this.targetPlant) {
      let d = p5.Vector.dist(this.pos, this.targetPlant.pos);
      
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
      // No plants found - wander to search
      let wander = this.wander().mult(0.6);
      this.applyForce(wander);
    }
  }

    // Check local food availability
  assessLocalFood(simulation, seasonManager) {
    this.foodCheckTimer++;
    if (this.foodCheckTimer < 60) return;  // Check every second
    this.foodCheckTimer = 0;
    
    let nearbyPlants;
    if (simulation && simulation.plantGrid) {
      nearbyPlants = simulation.plantGrid.getInRadius(this.pos.x, this.pos.y, 60);
    } else {
      return;
    }
    
    let ediblePlants = 0;
    let totalNutrition = 0;
    
    for (let plant of nearbyPlants) {
      if (plant.alive && !plant.dormant && plant.growth > 0.5) {
        ediblePlants++;
        totalNutrition += plant.nutrition;
      }
    }
    
    // Score from 0 (barren) to 1 (abundant)
    this.localFoodScore = min(1.0, ediblePlants / 8);
  }
  
  // Determine if moa should migrate
  shouldMigrate(seasonManager) {
    let currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    let pref = seasonManager.getPreferredElevation();
    let prefMid = (pref.min + pref.max) / 2;
    
    // How far outside preferred range
    let elevationError = 0;
    if (currentElev < pref.min) {
      elevationError = pref.min - currentElev;
    } else if (currentElev > pref.max) {
      elevationError = currentElev - pref.max;
    }
    
    // Migration triggers:
    // 1. Significantly outside preferred elevation
    // 2. Local food is scarce
    // 3. Season has strong migration drive
    
    let shouldMigrate = false;
    
    // Outside preferred range
    if (elevationError > 0.08) {
      shouldMigrate = true;
    }
    
    // Food is scarce locally
    if (this.localFoodScore < 0.3 && this.hunger > 30) {
      shouldMigrate = true;
    }
    
    // Strong seasonal pressure
    if (elevationError > 0.03 && seasonManager.getMigrationStrength() > 0.7) {
      shouldMigrate = true;
    }
    
    return shouldMigrate;
  }
  
  // Find migration target position
  findMigrationTarget(seasonManager) {
    let pref = seasonManager.getPreferredElevation();
    let targetElev = (pref.min + pref.max) / 2;
    
    // Search for suitable location
    let bestPos = null;
    let bestScore = -Infinity;
    
    // Sample random positions
    for (let i = 0; i < 20; i++) {
      let angle = random(TWO_PI);
      let dist = random(50, 150);
      let testX = this.pos.x + cos(angle) * dist;
      let testY = this.pos.y + sin(angle) * dist;
      
      // Clamp to map bounds
      testX = constrain(testX, 20, this.terrain.mapWidth - 20);
      testY = constrain(testY, 20, this.terrain.mapHeight - 20);
      
      if (!this.terrain.isWalkable(testX, testY)) continue;
      
      let elev = this.terrain.getElevationAt(testX, testY);
      
      // Score based on how close to target elevation
      let elevError = abs(elev - targetElev);
      let score = 1 - (elevError * 5);  // Penalize distance from ideal
      
      // Bonus if within preferred range
      if (elev >= pref.min && elev <= pref.max) {
        score += 0.5;
      }
      
      // Prefer positions in direction of needed elevation change
      let currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
      if (currentElev < targetElev && elev > currentElev) {
        score += 0.3;  // Bonus for moving uphill when needed
      } else if (currentElev > targetElev && elev < currentElev) {
        score += 0.3;  // Bonus for moving downhill when needed
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestPos = createVector(testX, testY);
      }
    }
    
    return bestPos;
  }
  
  // Perform migration
  migrateSeasonally(seasonManager) {
    // Cooldown between migration attempts
    if (this.migrationCooldown > 0) {
      this.migrationCooldown--;
    }
    
    // Only check migration periodically
    if (frameCount - this.lastMigrationCheck < 30) {
      if (this.isMigrating && this.migrationTarget) {
        this.executeMigration(seasonManager);
      }
      return;
    }
    this.lastMigrationCheck = frameCount;
    
    // Check if we should start migrating
    if (!this.isMigrating && this.migrationCooldown <= 0) {
      if (this.shouldMigrate(seasonManager)) {
        this.migrationTarget = this.findMigrationTarget(seasonManager);
        if (this.migrationTarget) {
          this.isMigrating = true;
        }
      }
    }
    
    // Execute migration if active
    if (this.isMigrating) {
      this.executeMigration(seasonManager);
    }
  }
  
  executeMigration(seasonManager) {
    if (!this.migrationTarget) {
      this.isMigrating = false;
      return;
    }
    
    let distToTarget = p5.Vector.dist(this.pos, this.migrationTarget);
    
    // Arrived at target
    if (distToTarget < 20) {
      this.homeRange = this.migrationTarget.copy();
      this.isMigrating = false;
      this.migrationTarget = null;
      this.migrationCooldown = 300;  // 5 second cooldown
      return;
    }
    
    // Move toward target
    let migrationStrength = seasonManager.getMigrationStrength();
    let urgency = 0.5 + migrationStrength * 0.5;
    
    // Increase urgency if hungry and food is scarce
    if (this.hunger > 50 && this.localFoodScore < 0.3) {
      urgency *= 1.5;
    }
    
    let seekForce = this.seek(this.migrationTarget, urgency);
    seekForce.mult(migrationStrength);
    this.applyForce(seekForce);
    
    // Override home range during migration
    this.homeRangeStrength = 0.02;  // Weaker home pull while migrating
  }
  
  stayInHomeRange() {
    let distFromHome = p5.Vector.dist(this.pos, this.homeRange);
    if (distFromHome > this.homeRangeRadius) {
      let toHome = p5.Vector.sub(this.homeRange, this.pos).setMag(this.maxForce * this.homeRangeStrength);
      toHome.mult(1 + (distFromHome - this.homeRangeRadius) * 0.02);
      return toHome;
    }
    return createVector(0, 0);
  }
  
  tryLayEgg(simulation, mauri, placeables) {
    if (!this.canLayEgg) return;
    if (this.hunger > this.config.layingHungerThreshold) return;
    
    let requiredSecurity = this.securityTimeRequired;
    
    for (let p of placeables) {
      if (p.alive && p.type === 'nest' && p.isInRange(this.pos)) {
        requiredSecurity *= 0.5;
        break;
      }
    }
    
    if (this.securityTime < requiredSecurity) return;
    if (simulation.getMoaPopulation() >= this.config.maxMoaPopulation) return;
    
    let egg = simulation.addEgg(this.pos.x, this.pos.y);
    egg.speedBonus = this.eggSpeedBonus;
    
    mauri.earn(mauri.onEggLaid, this.pos.x, this.pos.y, 'egg');
    
    this.securityTime = 0;
    this.canLayEgg = false;
    this.eggCooldown = this.eggCooldownTime;
    this.hunger += 25;
    this.homeRange = this.pos.copy();
    
    this.securityTimeRequired = this.config.securityTimeToLay + Math.floor(random(0, this.config.securityTimeVariation));
  }
  
  forage(simulation, mauri) {
  this.isForaging = true;
  
  // Check placeable food sources first (use spatial grid)
  const nearbyPlaceables = simulation.placeableGrid.getInRadius(
    this.pos.x, this.pos.y, 30
  );
  
  for (let p of nearbyPlaceables) {
    if (!p.alive || !p.def.nutrition || p.foodRemaining <= 0) continue;
    if (p.isInRange(this.pos)) {
      let nutrition = p.consumeFood(15);
      this.hunger = max(0, this.hunger - nutrition);
      mauri.earnFromEating(mauri.onMoaEat * 0.5, this.pos.x, this.pos.y);
      this.vel.mult(0.3);
      return;
    }
  }
  
  // Find nearest plant using spatial grid
  if (!this.targetPlant || !this.targetPlant.alive) {
    this.targetPlant = this.findNearestPlant(simulation);
  }
  
  if (this.targetPlant) {
    let d = p5.Vector.dist(this.pos, this.targetPlant.pos);
    if (d < this.eatRadius) {
      let nutrition = this.targetPlant.consume();
      this.hunger = max(0, this.hunger - nutrition);
      mauri.earnFromEating(mauri.onMoaEat, this.pos.x, this.pos.y);
      this.targetPlant = null;
      this.vel.mult(0.3);
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

  findNearestPlant(simulation) {
    // Use spatial grid
    let nearbyPlants;
    if (simulation && simulation.plantGrid) {
      nearbyPlants = simulation.plantGrid.getInRadius(this.pos.x, this.pos.y, 100);
    } else {
      return null;
    }
    
    let nearest = null;
    let nearestScore = Infinity;
    
    for (let plant of nearbyPlants) {
      if (!plant.alive || plant.growth < 0.5) continue;
      
      // Skip plants with very low seasonal value unless desperate
      if (plant.seasonalModifier < 0.3 && this.hunger < 70) continue;
      
      let d = p5.Vector.dist(this.pos, plant.pos);
      
      // Score: lower is better
      // Prioritize: close, high nutrition, good seasonal value
      let score = d;
      score /= plant.seasonalModifier;  // Prefer seasonally abundant plants
      score /= (plant.nutrition / 30);  // Prefer nutritious plants
      
      // Prefer plants in home range
      let homeD = p5.Vector.dist(this.homeRange, plant.pos);
      if (homeD < this.homeRangeRadius) {
        score *= 0.7;
      }
      
      // Prefer plants spawned by placeables (they're reliable food)
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
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    // Rotate to face direction of movement
    // Beak will point in +X direction (right), so we just use heading
    let angle = this.vel.heading();
    rotate(angle);
    
    let speed = this.vel.mag();
    
    // === ALTERNATING LEG ANIMATION ===
    // Walk cycle - legs move opposite to each other
    let walkCycle = frameCount * 0.18 + this.legPhase;
    let legSwing = sin(walkCycle) * (0.5 + speed * 2);  // More swing when moving faster
    
    // === COLORS BASED ON STATE ===
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
    
    // === INDICATOR RINGS (behind everything) ===
    noFill();
    strokeWeight(1);
    if (CONFIG.debugMode){
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
    
    // === SHADOW ===
    noStroke();
    fill(0, 0, 0, 25);
    ellipse(1.5, 1.5, this.size * 1.0, this.size * 0.65);
    
    // === LEGS (drawn first, behind body) ===
    let legColor = color(60, 42, 25);
    let legLength = this.size * 0.55;
    let legAttachX = -this.size * 0.1;  // Legs attach slightly behind body center
    
    stroke(legColor);
    strokeWeight(1.8);
    
    // Left leg (top side in top-down view)
    // When legSwing is positive, left leg is forward (toward +X)
    let leftLegEndX = legAttachX - legLength * 0.7 + legSwing * 2;
    let leftLegEndY = -this.size * 0.35;
    
    // Thigh
    line(legAttachX, -this.size * 0.18, legAttachX - legLength * 0.3, -this.size * 0.28);
    // Lower leg
    line(legAttachX - legLength * 0.3, -this.size * 0.28, leftLegEndX, leftLegEndY);
    
    // Left foot - three toes
    strokeWeight(1.2);
    line(leftLegEndX, leftLegEndY, leftLegEndX - 3, leftLegEndY - 2.5);  // Outer toe
    line(leftLegEndX, leftLegEndY, leftLegEndX - 4, leftLegEndY);         // Middle toe
    line(leftLegEndX, leftLegEndY, leftLegEndX - 3, leftLegEndY + 2.5);  // Inner toe
    
    // Right leg (bottom side, OPPOSITE phase)
    let rightLegEndX = legAttachX - legLength * 0.7 - legSwing * 2;  // Opposite swing
    let rightLegEndY = this.size * 0.35;
    
    strokeWeight(1.8);
    // Thigh
    line(legAttachX, this.size * 0.18, legAttachX - legLength * 0.3, this.size * 0.28);
    // Lower leg
    line(legAttachX - legLength * 0.3, this.size * 0.28, rightLegEndX, rightLegEndY);
    
    // Right foot - three toes
    strokeWeight(1.2);
    line(rightLegEndX, rightLegEndY, rightLegEndX - 3, rightLegEndY - 2.5);
    line(rightLegEndX, rightLegEndY, rightLegEndX - 4, rightLegEndY);
    line(rightLegEndX, rightLegEndY, rightLegEndX - 3, rightLegEndY + 2.5);
    
    // === TAIL (small tuft at back) ===
    noStroke();
    fill(red(bodyCol) - 20, green(bodyCol) - 15, blue(bodyCol) - 10);
    beginShape();
    vertex(-this.size * 0.35, 0);
    vertex(-this.size * 0.55, -this.size * 0.12);
    vertex(-this.size * 0.48, 0);
    vertex(-this.size * 0.55, this.size * 0.12);
    endShape(CLOSE);
    
    // === BODY (oval, longer front-to-back) ===
    noStroke();
    fill(bodyCol);
    ellipse(-2, 0, this.size * 0.85, this.size * 0.65);
    
    // Body feather texture (subtle)
    fill(red(bodyCol) + 8, green(bodyCol) + 5, blue(bodyCol) + 3, 80);
    ellipse(-this.size * 0.05, -this.size * 0.08, this.size * 0.3, this.size * 0.15);
    ellipse(-this.size * 0.05, this.size * 0.08, this.size * 0.3, this.size * 0.15);
    
    // === NECK (extends forward from body) ===
    fill(neckCol);
    noStroke();
    
    // Neck as tapered shape
    beginShape();
    vertex(this.size * 0.2, -this.size * 0.12);   // Base left
    vertex(this.size * 0.2, this.size * 0.12);    // Base right  
    vertex(this.size * 0.52, this.size * 0.07);   // Tip right
    vertex(this.size * 0.52, -this.size * 0.07);  // Tip left
    endShape(CLOSE);
    
    // === HEAD ===
    fill(bodyCol);
    ellipse(this.size * 0.6, 0, this.size * 0.28, this.size * 0.24);
    
    // Slight crown/top of head highlight
    fill(red(bodyCol) + 10, green(bodyCol) + 8, blue(bodyCol) + 5, 100);
    ellipse(this.size * 0.58, 0, this.size * 0.15, this.size * 0.1);
    
    // === EYES (both sides of head) ===
    let eyeX = this.size * 0.57;
    let eyeOffsetY = this.size * 0.085;
    let eyeSize = this.size * 0.08;
    
    // Eye whites (slight)
    fill(240, 235, 220);
    ellipse(eyeX, -eyeOffsetY, eyeSize + 1, eyeSize + 1);
    ellipse(eyeX, eyeOffsetY, eyeSize + 1, eyeSize + 1);
    
    // Pupils
    fill(25, 20, 15);
    ellipse(eyeX + 0.3, -eyeOffsetY, eyeSize, eyeSize);
    ellipse(eyeX + 0.3, eyeOffsetY, eyeSize, eyeSize);
    
    // Eye shine
    fill(255, 255, 255, 180);
    ellipse(eyeX + 0.8, -eyeOffsetY - 0.5, eyeSize * 0.4, eyeSize * 0.4);
    ellipse(eyeX + 0.8, eyeOffsetY - 0.5, eyeSize * 0.4, eyeSize * 0.4);
    
    // === BEAK (pointing forward) ===
    // Moa had distinctive curved beaks
    fill(70, 55, 35);
    stroke(50, 40, 25);
    strokeWeight(0.5);
    
    // Upper beak
    beginShape();
    vertex(this.size * 0.68, -this.size * 0.04);  // Base top
    vertex(this.size * 0.88, -this.size * 0.01);  // Tip top
    vertex(this.size * 0.9, 0);                    // Tip point
    vertex(this.size * 0.88, this.size * 0.01);   // Tip bottom
    vertex(this.size * 0.68, this.size * 0.04);   // Base bottom
    vertex(this.size * 0.7, 0);                    // Base center (curve inward)
    endShape(CLOSE);
    
    // Beak ridge line
    stroke(50, 40, 25);
    strokeWeight(0.5);
    line(this.size * 0.7, 0, this.size * 0.88, 0);
    
    // Nostrils
    noStroke();
    fill(40, 30, 20);
    ellipse(this.size * 0.74, -this.size * 0.015, 1.2, 0.8);
    ellipse(this.size * 0.74, this.size * 0.015, 1.2, 0.8);
    
    // === PECKING ANIMATION (when feeding) ===
    // Handled by slight head bob - we can add this by adjusting head position
    // For now the base render is good
    
    pop();
    
    // === STATUS BARS AND INDICATORS (drawn in world space, not rotated) ===
    
    // Migration target line
    if (CONFIG.debugMode){
      if (this.isMigrating && this.migrationTarget && CONFIG.showHungerBars) {
        stroke(100, 150, 255, 40);
        strokeWeight(1);
        drawingContext.setLineDash([3, 3]);
        line(this.pos.x, this.pos.y, this.migrationTarget.x, this.migrationTarget.y);
        drawingContext.setLineDash([]);
      }
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
    
    // Hunger bar background
    fill(40, 40, 40, 150);
    rect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth, barHeight, 1);
    
    // Hunger bar fill
    let hungerPercent = this.hunger / this.maxHunger;
    let hungerColor = lerpColor(color(80, 180, 80), color(200, 60, 60), hungerPercent);
    fill(hungerColor);
    rect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth * (1 - hungerPercent), barHeight, 1);
    
    // Egg progress bar (when applicable)
    if (this.canLayEgg && this.hunger <= this.config.layingHungerThreshold) {
      let securityProgress = min(1, this.securityTime / this.securityTimeRequired);
      if (securityProgress > 0.1) {
        // Background
        fill(40, 40, 40, 150);
        rect(this.pos.x - barWidth / 2, this.pos.y + yOffset - 3, barWidth, barHeight, 1);
        // Fill
        fill(220, 200, 100);
        rect(this.pos.x - barWidth / 2, this.pos.y + yOffset - 3, barWidth * securityProgress, barHeight, 1);
      }
    }
    
    // State indicators (small icons)
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
  }
}