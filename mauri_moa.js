// ============================================
// MOA CLASS - With seasonal migration
// ============================================
class Moa extends Boid {
  constructor(x, y, terrain, config) {
    super(x, y, terrain);
    this.config = config;
    
    // Base speeds - these are the reference values
    this.baseSpeed = 0.35;
    this.fleeSpeed = .7;
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
    
    this.baseSecurityTime = config.securityTimeToLay;
    this.securityTimeRequired = config.securityTimeToLay + Math.floor(random(0, config.securityTimeVariation));
    
    this.securityTime = 0;
    this.canLayEgg = true;
    this.eggCooldown = 0;
    this.eggCooldownTime = 800;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    
    this.inShelter = false;
    this.preferredElevation = { min: 0.25, max: 0.55 };
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
    
    // Update preferred elevation based on season
    this.preferredElevation = seasonManager.getPreferredElevation();
    
    if (this.eggCooldown > 0) {
      this.eggCooldown--;
      this.canLayEgg = this.eggCooldown <= 0;
    }
    
    this.checkPlaceableEffects(placeables);
    
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
    
    // Determine state for speed calculation
    let isStarving = this.hunger > this.criticalHunger;
    
    // Calculate speed based on current state (not overwriting base values)
    this.maxSpeed = this.calculateSpeed(dominated, isStarving);
    
    if (dominated) {
      this.isForaging = false;
      this.targetPlant = null;
      this.targetPlaceable = null;
      let sep = this.separate(moas).mult(0.5);
      this.applyForce(sep);
    } else {
      this.tryLayEgg(simulation, mauri, placeables);
      
      let attracted = this.seekPlaceableAttractions(placeables);
      
      if (!attracted && this.hunger > this.hungerThreshold) {
        this.forage(simulation, mauri);
      } else if (!attracted) {
        this.isForaging = false;
        this.targetPlant = null;
        this.targetPlaceable = null;
        
        let wander = this.wander().mult(0.4);
        this.applyForce(wander);
        
        let homeForce = this.stayInHomeRange();
        this.applyForce(homeForce);
      }
      
      this.migrateSeasonally();
      
      let sep = this.separate(moas).mult(0.8);
      this.applyForce(sep);
    }
    
    let avoid = this.avoidUnwalkable().mult(2);
    this.applyForce(avoid);
    
    this.edges();
    
    // Starvation death
    if (this.hunger >= this.maxHunger) {
      this.alive = false;
    }
  }
  
  // ... rest of Moa methods remain the same
  
  migrateSeasonally() {
    let currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    let prefMin = this.preferredElevation.min;
    let prefMax = this.preferredElevation.max;
    let prefMid = (prefMin + prefMax) / 2;
    
    if (currentElev < prefMin - 0.05 || currentElev > prefMax + 0.05) {
      let gradient = this.getElevationGradient();
      
      if (currentElev < prefMid) {
        this.applyForce(gradient.mult(0.2));
      } else {
        this.applyForce(gradient.mult(-0.2));
      }
      
      if (frameCount % 120 === 0) {
        if (currentElev >= prefMin && currentElev <= prefMax) {
          this.homeRange = this.pos.copy();
        }
      }
    }
  }
  
  getElevationGradient() {
    const step = 5;
    let ex = this.terrain.getElevationAt(this.pos.x + step, this.pos.y) -
             this.terrain.getElevationAt(this.pos.x - step, this.pos.y);
    let ey = this.terrain.getElevationAt(this.pos.x, this.pos.y + step) -
             this.terrain.getElevationAt(this.pos.x, this.pos.y - step);
    return createVector(ex, ey).normalize().mult(this.maxForce);
  }
  
  checkPlaceableEffects(placeables) {
    this.inShelter = false;
    this.securityBonus = 1;
    this.eggSpeedBonus = 1;
    let hungerMod = 1;
    
    for (let p of placeables) {
      if (!p.alive || !p.isInRange(this.pos)) continue;
      
      if (p.def.blocksEagleVision) this.inShelter = true;
      if (p.def.securityBonus) this.securityBonus = max(this.securityBonus, p.def.securityBonus);
      if (p.def.eggSpeedBonus) this.eggSpeedBonus = max(this.eggSpeedBonus, p.def.eggSpeedBonus);
      if (p.def.hungerSlowdown) hungerMod = min(hungerMod, p.def.hungerSlowdown);
    }
    
    this.hungerRate = this.baseHungerRate * hungerMod;
  }
  
  seekPlaceableAttractions(placeables) {
    let bestTarget = null;
    let bestScore = -Infinity;
    
    for (let p of placeables) {
      if (!p.alive) continue;
      let d = p5.Vector.dist(this.pos, p.pos);
      if (d > 100) continue;
      
      let score = 0;
      
      if (p.def.attractsHungryMoa && this.hunger > 25 && p.foodRemaining > 0) {
        score = (this.hunger / 100) * 50 - d * 0.3;
      }
      if (p.def.attractsReadyMoa && this.canLayEgg && this.hunger < this.config.layingHungerThreshold) {
        score = 80 - d * 0.2;
      }
      if (p.def.attractsMoa) {
        score = max(score, 30 - d * 0.3);
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = p;
      }
    }
    
    if (bestTarget && bestScore > 10) {
      let seekForce = this.seek(bestTarget.pos, 0.7);
      this.applyForce(seekForce);
      this.targetPlaceable = bestTarget;
      return true;
    }
    
    return false;
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
  // Use spatial grid for efficient lookup
  const nearbyPlants = simulation.plantGrid.getInRadius(
    this.pos.x, this.pos.y, 100
  );
  
  let nearest = null;
  let nearestScore = Infinity;
  
  for (let plant of nearbyPlants) {
    if (!plant.alive || plant.growth < 0.5) continue;
    if (plant.seasonalModifier < 0.4) continue;
    
    let d = p5.Vector.dist(this.pos, plant.pos);
    let homeD = p5.Vector.dist(this.homeRange, plant.pos);
    let score = d / plant.seasonalModifier;
    if (homeD < this.homeRangeRadius) score *= 0.7;
    
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
    
    let angle = this.vel.heading();
    rotate(angle + HALF_PI);
    
    let speed = this.vel.mag();
    let legOffset = sin(frameCount * 0.15 + this.legPhase) * speed * 3;
    
    let bodyCol = this.bodyColor;
    if (this.panicLevel > 0) {
      bodyCol = lerpColor(this.bodyColor, color(150, 80, 60), this.panicLevel * 0.5);
    } else if (this.hunger > this.criticalHunger) {
      bodyCol = lerpColor(this.bodyColor, color(70, 50, 35), 0.4);
    }
    
    if (this.inShelter) {
      noFill();
      stroke(100, 200, 100, 100);
      strokeWeight(1);
      ellipse(0, 0, this.size * 2, this.size * 2);
    }
    
    noStroke();
    fill(0, 0, 0, 30);
    ellipse(2, 2, this.size * 1.3, this.size * 0.7);
    
    stroke(55, 38, 20);
    strokeWeight(1.5);
    line(-2.5, 0, -2.5 + legOffset, this.size * 0.7);
    line(2.5, 0, 2.5 - legOffset, this.size * 0.7);
    
    noStroke();
    fill(bodyCol);
    ellipse(0, 0, this.size * 0.8, this.size * 1.1);
    ellipse(0, -this.size * 0.55, this.size * 0.45, this.size * 0.65);
    
    fill(30);
    ellipse(1.5, -this.size * 0.6, 1.5, 1.5);
    
    fill(85, 70, 40);
    triangle(0, -this.size * 0.9, -2, -this.size * 0.65, 2, -this.size * 0.65);
    
    pop();
    
    if (CONFIG.showHungerBars) {
      this.renderStatusBars();
    }
  }
  
  renderStatusBars() {
    const barWidth = 14, barHeight = 2, yOffset = -this.size - 5;
    
    fill(50, 50, 50, 150);
    noStroke();
    rect(this.pos.x - barWidth/2, this.pos.y + yOffset, barWidth, barHeight);
    
    let hungerPercent = this.hunger / this.maxHunger;
    fill(lerpColor(color(100, 200, 100), color(200, 80, 80), hungerPercent));
    rect(this.pos.x - barWidth/2, this.pos.y + yOffset, barWidth * (1 - hungerPercent), barHeight);
    
    if (this.canLayEgg && this.hunger <= this.config.layingHungerThreshold) {
      let securityProgress = min(1, this.securityTime / this.securityTimeRequired);
      if (securityProgress > 0.1) {
        fill(50, 50, 50, 150);
        rect(this.pos.x - barWidth/2, this.pos.y + yOffset - 3, barWidth, barHeight);
        fill(200, 180, 100);
        rect(this.pos.x - barWidth/2, this.pos.y + yOffset - 3, barWidth * securityProgress, barHeight);
      }
    }
  }
}