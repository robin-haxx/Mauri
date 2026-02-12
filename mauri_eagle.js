// ============================================
// HAAST'S EAGLE CLASS
// ============================================

class HaastsEagle extends Boid {
  constructor(x, y, terrain, config = null, speciesData = null) {
    super(x, y, terrain);
    
    this.config = config;
    
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
    this._huntEventFired = false;
    
    // Hunger
    this.hunger = random(25, 35);
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
    this.applyForce(this.seek(this.patrolCenter, 0.2));
    
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