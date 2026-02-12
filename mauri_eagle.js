// ============================================
// HAAST'S EAGLE CLASS - Sprite Only
// ============================================

class HaastsEagle extends Boid {
  constructor(x, y, terrain, config = null, speciesData = null) {
    super(x, y, terrain);
    
    this.config = config;
    this.species = speciesData;
    
    // Movement
    this.baseSpeed = 0.4;
    this.huntSpeed = 0.8;
    this.maxSpeed = this.baseSpeed;
    this.maxForce = 0.05;
    this.perceptionRadius = 160;
    this.separationDist = 100;
    this.separationDistSq = 10000;
    
    this.wanderStrength = 1.0;
    
    // Hunting
    this.huntRadius = 130;
    this.huntRadiusSq = 16900;
    this.catchRadius = 12;
    this.catchRadiusSq = 144;
    this.target = null;
    this.hunting = false;
    
    this.huntSearchTimer = 0;
    this.huntSearchTimeout = 300;
    this.lastTargetTime = 0;
    
    // Hunger
    this.hunger = random(25, 35);
    this.maxHunger = 100;
    this.hungerRate = 0.018;
    this.huntThreshold = 40;
    this.kills = 0;
    
    // Patrol
    this.patrolCenter = createVector(x, y);
    this.patrolRadius = random(70, 100);
    this.patrolAngle = random(TWO_PI);
    this.patrolSpeed = random(0.008, 0.012);
    
    // State tracking
    this.state = 'patrol';
    
    // State timers
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
    
    // Animation timing
    this.animTime = random(1000);
    
    // Reusable vectors
    this._tempForce = createVector();
    this._targetVec = createVector();
    this._edgeForce = createVector();
    this._separationForce = createVector();
    this._relocateTargetVec = createVector();
  }
  
  isHunting() { 
    return this.hunting && this.target !== null; 
  }
  
  // ============================================
  // BEHAVIOR
  // ============================================
  
  behave(simulation, mauri, dt = 1) {
    this.animTime += dt;
    
    this.hunger += this.hungerRate * dt;
    if (this.hunger > this.maxHunger) this.hunger = this.maxHunger;
    
    const nearbyPlaceables = simulation.getNearbyPlaceables(this.pos.x, this.pos.y, 100);
    this.checkDecoys(nearbyPlaceables);
    
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
    
    const edgeForce = this.avoidEdges();
    this.applyForce(edgeForce);
    
    if (this.hunger > this.huntThreshold) {
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
      const strength = (margin - px) / margin;
      force.x += strength * 2;
      if (px < strongMargin) urgency = 3;
    } else if (px > mapW - margin) {
      const strength = (px - (mapW - margin)) / margin;
      force.x -= strength * 2;
      if (px > mapW - strongMargin) urgency = 3;
    }
    
    if (py < margin) {
      const strength = (margin - py) / margin;
      force.y += strength * 2;
      if (py < strongMargin) urgency = 3;
    } else if (py > mapH - margin) {
      const strength = (py - (mapH - margin)) / margin;
      force.y -= strength * 2;
      if (py > mapH - strongMargin) urgency = 3;
    }
    
    if (force.magSq() > 0) {
      force.setMag(this.maxForce * urgency);
    }
    
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
  
  checkDecoys(nearbyPlaceables) {
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
    
    if (this.distractedBy && this.distractedBy.alive) {
      const dx = this.distractedBy.pos.x - this.pos.x;
      const dy = this.distractedBy.pos.y - this.pos.y;
      
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
    
    const seekForce = this.seek(this._targetVec, 0.4);
    this.applyForce(seekForce);
    
    const wander = this.wander();
    wander.mult(0.25);
    this.applyForce(wander);
    
    this._driftTimer = (this._driftTimer || 0) + dt;
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
    
    const toCenter = this.seek(this.patrolCenter, 0.2);
    this.applyForce(toCenter);
    
    this.edges();
  }
  
  // ============================================
  // HUNTING
  // ============================================
  
  hunt(simulation, mauri, dt = 1) {
    this.maxSpeed = this.huntSpeed;
    
    const nearbyMoas = simulation.getNearbyMoas(this.pos.x, this.pos.y, this.huntRadius);
    
    let nearestDistSq = Infinity;
    let nearestMoa = null;
    const px = this.pos.x, py = this.pos.y;
    
    for (let i = 0; i < nearbyMoas.length; i++) {
      const moa = nearbyMoas[i];
      if (!moa.alive) continue;
      if (moa.inShelter && this.target !== moa) continue;
      if (moa.eagleResistance > 0 && random() < moa.eagleResistance) continue;
      
      const dx = moa.pos.x - px;
      const dy = moa.pos.y - py;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < nearestDistSq) {
        nearestDistSq = dSq;
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
        if (simulation.game?.tutorial) {
          simulation.onEagleStartHunt(this, this.target);
        }
        this._huntEventFired = true;
        if (typeof audioManager !== 'undefined' && audioManager) {
          audioManager.playEagleHunt();
        }
      }
      
      this._targetVec.set(
        nearestMoa.pos.x + nearestMoa.vel.x * 12,
        nearestMoa.pos.y + nearestMoa.vel.y * 12
      );
      
      const pursue = this.seek(this._targetVec, 1.4);
      this.applyForce(pursue);
      
      if (nearestDistSq < this.catchRadiusSq) {
        this.catchMoa(nearestMoa, simulation, mauri);
      }
    } else {
      this.huntSearchTimer += dt;
      this.hunting = true;
      this.target = null;
      this._huntEventFired = false;
      
      if (this.huntSearchTimer >= this.huntSearchTimeout) {
        this.startRelocation();
        return;
      }
      
      this.searchForPrey();
    }
    
    if (this.state !== 'hunting') {
      this._huntEventFired = false;
    }
  }
  
  searchForPrey() {
    this.state = 'hunting';
    this.maxSpeed = this.huntSpeed * 0.8;
    
    const searchAngle = frameCount * 0.02 + this.wingPhase;
    const searchRadius = this.patrolRadius + (this.huntSearchTimer * 0.3);
    
    this._targetVec.set(
      this.patrolCenter.x + cos(searchAngle) * searchRadius,
      this.patrolCenter.y + sin(searchAngle) * searchRadius
    );
    
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    this._targetVec.x = constrain(this._targetVec.x, 50, mapW - 50);
    this._targetVec.y = constrain(this._targetVec.y, 50, mapH - 50);
    
    const seekForce = this.seek(this._targetVec, 0.8);
    this.applyForce(seekForce);
    
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
    
    let newX, newY;
    let attempts = 0;
    const minRelocateDist = 150;
    const minRelocateDistSq = minRelocateDist * minRelocateDist;
    
    do {
      newX = random(80, mapW - 80);
      newY = random(80, mapH - 80);
      
      const dx = newX - this.pos.x;
      const dy = newY - this.pos.y;
      const distSq = dx * dx + dy * dy;
      
      attempts++;
      
      if (distSq >= minRelocateDistSq || attempts > 10) {
        break;
      }
    } while (attempts <= 10);
    
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
    const distSq = dx * dx + dy * dy;
    
    if (distSq < 900 || this.relocateTimer <= 0) {
      this.patrolCenter.set(this.relocateTarget.x, this.relocateTarget.y);
      this.patrolAngle = random(TWO_PI);
      this.relocateTarget = null;
      this.relocateTimer = 0;
      this.state = 'hunting';
      return;
    }
    
    const seekForce = this.seek(this.relocateTarget, 1.2);
    this.applyForce(seekForce);
    
    this.edges();
  }
  
  driftPatrolCenter(amount) {
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    this.patrolCenter.x = constrain(
      this.patrolCenter.x + random(-amount, amount), 
      80, mapW - 80
    );
    this.patrolCenter.y = constrain(
      this.patrolCenter.y + random(-amount, amount), 
      80, mapH - 80
    );
  }
  
  catchMoa(moa, simulation, mauri) {
    if (simulation && mauri) {
      simulation.handleEagleCatch(this, moa, mauri);
    } else {
      moa.alive = false;
      this.kills++;
      this.hunger = Math.max(0, this.hunger - 60);
      this.vel.mult(0.1);
      this.hunting = false;
      this.target = null;
      this.huntSearchTimer = 0;
      this.state = 'resting';
      this.restTimer = this.restDuration;
      this.patrolCenter.set(this.pos.x, this.pos.y);
    }
  }
  
  // ============================================
  // RENDERING - Sprite Only
  // ============================================
  
  getSpriteState() {
    if (this.hunting && this.target !== null) {
      return 'hunting';
    }
    if (this.state === 'resting') {
      return 'resting';
    }
    return 'flying';
  }
  
  render() {
    const spriteState = this.getSpriteState();
    const sprite = EntitySprites.getEagleSprite(this.animTime, spriteState);
    
    if (sprite) {
      const isHunting = this.hunting && this.target !== null;
      
      push();
      translate(this.pos.x, this.pos.y);
      
      // Shadow
      noStroke();
      fill(0, 0, 0, isHunting ? 35 : 25);
      const shadowOffset = isHunting ? 2 : 5;
      ellipse(shadowOffset, 3, this.wingspan * 0.9, this.wingspan * 0.3);
      
      // Snap rotation to pixel-art friendly angles (eagle uses +HALF_PI offset)
      const targetAngle = this.vel.heading() + HALF_PI;
      this._displayAngle = SpriteAngle.snapWithHysteresis(this._displayAngle, targetAngle);
      rotate(this._displayAngle);
      
      imageMode(CENTER);
      image(sprite, 0, 0, this.wingspan * 2.2, this.wingspan * 2.2);
      
      // State indicators
      if (this.state === 'distracted') {
        fill(255, 200, 100);
        textSize(7);
        textAlign(CENTER, CENTER);
        text("?", 0, -this.bodyLength * 0.7);
      } else if (this.state === 'relocating') {
        fill(150, 200, 255);
        textSize(6);
        textAlign(CENTER, CENTER);
        text("→", 0, -this.bodyLength * 0.7);
      }
      
      pop();
    }
    
    if (CONFIG.showHungerBars) this.renderHungerBar();
  }
  
  renderHungerBar() {
    const barWidth = 16;
    const barHeight = 2;
    const px = this.pos.x;
    const py = this.pos.y - 16;
    
    const isHunting = this.state === 'hunting';
    const hasTarget = this.target !== null;
    const isRelocating = this.state === 'relocating';
    
    noStroke();
    
    // Background
    fill(50, 50, 50, 150);
    rect(px - 8, py, barWidth, barHeight, 1);
    
    // Hunger level
    const hungerPercent = this.hunger / this.maxHunger;
    const r = 100 + hungerPercent * 100;
    const g = 160 - hungerPercent * 80;
    fill(r, g, 120);
    rect(px - 8, py, barWidth * (1 - hungerPercent), barHeight, 1);
    
    // State indicator
    if (isHunting && hasTarget) {
      fill(255, 80, 80);
      ellipse(px + 11, py + 1, 4, 4);
    } else if (isHunting) {
      fill(255, 200, 80);
      ellipse(px + 11, py + 1, 4, 4);
    } else if (isRelocating) {
      fill(100, 150, 255);
      ellipse(px + 11, py + 1, 4, 4);
    }
    
    // Search timer indicator
    if (isHunting && !hasTarget && this.huntSearchTimer > 0) {
      const searchProgress = this.huntSearchTimer / this.huntSearchTimeout;
      fill(255, 200, 80, 150);
      rect(px - 8, py + 3, barWidth * searchProgress, 1, 0.5);
    }
    
    // Debug info
    if (CONFIG.debugMode) {
      fill(200, 200, 200, 180);
      textSize(6);
      textAlign(CENTER, TOP);
      
      let stateText = this.state.toUpperCase();
      if (isHunting) {
        stateText = hasTarget ? 'HUNTING' : `SEARCH ${((this.huntSearchTimer / 60) | 0)}s`;
      }
      text(stateText, px, py + 5);
    }
  }
}