// ============================================
// HAAST'S EAGLE CLASS - Simplified
// ============================================

// Consolidated eagle colors (initialized in setup)
const EagleColors = {
  initialized: false,
  
  wing: null,
  wingDark: null,
  wingLight: null,
  body: null,
  bodyLight: null,
  head: null,
  beak: null,
  beakTip: null,
  eye: null,
  eyeGold: null,
  talon: null,
  shadow: null,
  
  init() {
    if (this.initialized) return;
    
    this.wing = color(65, 45, 30);
    this.wingDark = color(40, 28, 18);
    this.wingLight = color(90, 65, 45);
    this.body = color(55, 40, 28);
    this.bodyLight = color(95, 80, 60);
    this.head = color(85, 70, 50);
    this.beak = color(45, 45, 48);
    this.beakTip = color(25, 25, 28);
    this.eye = color(200, 161, 50);
    this.eyeGold = color(220, 180, 60);
    this.talon = color(50, 45, 40);
    this.shadow = color(0, 0, 0, 30);
    
    this.initialized = true;
  }
};

class HaastsEagle extends Boid {
  constructor(x, y, terrain, config = null, speciesData = null) {
    super(x, y, terrain);
    
    EagleColors.init();
    
    this.config = config;
    this.species = speciesData;
    
    // Movement
    this.baseSpeed = 0.6;
    this.huntSpeed = 1.4;
    this.maxSpeed = this.baseSpeed;
    this.maxForce = 0.05;
    this.perceptionRadius = 160;
    this.separationDist = 100;
    this.separationDistSq = 10000;
    
    // Hunting
    this.huntRadius = 130;
    this.huntRadiusSq = 16900;
    this.catchRadius = 12;
    this.catchRadiusSq = 144;
    this.target = null;
    this.hunting = false;
    
    // Hunt search timeout - relocate after 5 seconds of fruitless searching
    this.huntSearchTimer = 0;
    this.huntSearchTimeout = 300; // 5 seconds at 60fps
    this.lastTargetTime = 0; // Track when we last had a target
    
    // Hunger
    this.hunger = random(20, 45);
    this.maxHunger = 100;
    this.hungerRate = 0.022;
    this.huntThreshold = 40;
    this.kills = 0;
    
    // Patrol
    this.patrolCenter = createVector(x, y);
    this.patrolRadius = random(70, 100);
    this.patrolAngle = random(TWO_PI);
    this.patrolSpeed = random(0.008, 0.012);
    
    // State tracking
    this.state = 'patrol'; // 'patrol', 'hunting', 'resting', 'distracted', 'relocating'
    
    // State timers
    this.restTimer = 0;
    this.restDuration = 180;
    this.distractedBy = null;
    this.distractedTimer = 0;
    this.relocateTarget = null;
    this.relocateTimer = 0;
    
    // Visual
    this.wingspan = random(22, 28);
    this.wingPhase = random(TWO_PI);
    this.bodyLength = this.wingspan * 0.45;
    
    // Reusable vectors
    this._tempForce = createVector();
    this._targetVec = createVector();
    this._edgeForce = createVector();
  }
  
  isHunting() { 
    return this.hunting && this.target !== null; 
  }
  
  // ============================================
  // BEHAVIOR
  // ============================================
  
  behave(simulation) {
    this.hunger += this.hungerRate;
    if (this.hunger > this.maxHunger) this.hunger = this.maxHunger;
    
    // Check for decoys
    const nearbyPlaceables = simulation.getNearbyPlaceables(this.pos.x, this.pos.y, 100);
    this.checkDecoys(nearbyPlaceables);
    
    // Handle states
    if (this.distractedTimer > 0) {
      this.state = 'distracted';
      this.distractedTimer--;
      this.beDistracted();
      return;
    }
    
    if (this.restTimer > 0) {
      this.state = 'resting';
      this.restTimer--;
      this.rest();
      return;
    }
    
    // Handle relocation (moving to new hunting grounds)
    if (this.relocateTimer > 0) {
      this.state = 'relocating';
      this.relocate();
      return;
    }
    
    // Separation from other eagles
    const nearbyEagles = simulation.getNearbyEagles(this.pos.x, this.pos.y, this.separationDist * 1.5);
    const sep = this.separate(nearbyEagles);
    sep.mult(2);
    this.applyForce(sep);
    
    // Strong edge avoidance - prevents getting stuck
    const edgeForce = this.avoidEdges();
    this.applyForce(edgeForce);
    
    // Hunt or patrol
    if (this.hunger > this.huntThreshold) {
      this.hunt(simulation);
    } else {
      this.state = 'patrol';
      this.hunting = false;
      this.target = null;
      this.huntSearchTimer = 0; // Reset search timer when not hungry
      this.patrol();
    }
    
    this.edges();
  }
  
  // ============================================
  // EDGE AVOIDANCE - Prevents getting stuck at boundaries
  // ============================================
  
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
    
    // Calculate repulsion from edges
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
    const force = this._tempForce;
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
      
      // Circle around decoy
      this._tempForce.set(-dy, dx);
      this._tempForce.normalize();
      this._tempForce.mult(this.maxForce * 0.8);
      this.applyForce(this._tempForce);
      
      // Stay near it
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
  
  patrol() {
    this.maxSpeed = this.baseSpeed;
    
    this.patrolAngle += this.patrolSpeed * this.personality.wanderStrength;
    
    this._targetVec.set(
      this.patrolCenter.x + cos(this.patrolAngle) * this.patrolRadius,
      this.patrolCenter.y + sin(this.patrolAngle) * this.patrolRadius
    );
    
    const seekForce = this.seek(this._targetVec, 0.4);
    this.applyForce(seekForce);
    
    const wander = this.wander();
    wander.mult(0.25);
    this.applyForce(wander);
    
    // Occasionally drift patrol center
    if ((frameCount & 255) === 0) {
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
  // HUNTING - With timeout and relocation
  // ============================================
  
  hunt(simulation) {
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
      // Found a target - reset search timer
      this.state = 'hunting';
      this.hunting = true;
      this.target = nearestMoa;
      this.huntSearchTimer = 0;
      this.lastTargetTime = frameCount;
      
      // Predict target position
      this._targetVec.set(
        nearestMoa.pos.x + nearestMoa.vel.x * 12,
        nearestMoa.pos.y + nearestMoa.vel.y * 12
      );
      
      const pursue = this.seek(this._targetVec, 1.4);
      this.applyForce(pursue);
      
      if (nearestDistSq < this.catchRadiusSq) {
        this.catchMoa(nearestMoa);
      }
    } else {
      // No target found - increment search timer
      this.huntSearchTimer++;
      this.hunting = true; // Still hunting, just searching
      this.target = null;
      
      // Check if we should relocate to new hunting grounds
      if (this.huntSearchTimer >= this.huntSearchTimeout) {
        this.startRelocation();
        return;
      }
      
      // While searching, move toward patrol center but keep looking
      this.searchForPrey();
    }
  }
  
  /**
   * Behavior while searching for prey (no target found yet)
   */
  searchForPrey() {
    this.state = 'hunting'; // Still in hunting mode, just searching
    
    // Reduce speed slightly while searching
    this.maxSpeed = this.huntSpeed * 0.8;
    
    // Spiral outward from patrol center while searching
    const searchAngle = frameCount * 0.02 + this.wingPhase;
    const searchRadius = this.patrolRadius + (this.huntSearchTimer * 0.3);
    
    this._targetVec.set(
      this.patrolCenter.x + cos(searchAngle) * searchRadius,
      this.patrolCenter.y + sin(searchAngle) * searchRadius
    );
    
    // Constrain search target to map bounds
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    this._targetVec.x = constrain(this._targetVec.x, 50, mapW - 50);
    this._targetVec.y = constrain(this._targetVec.y, 50, mapH - 50);
    
    const seekForce = this.seek(this._targetVec, 0.8);
    this.applyForce(seekForce);
    
    // Add some wander to cover more ground
    const wander = this.wander();
    wander.mult(0.3);
    this.applyForce(wander);
  }
  
  /**
   * Start relocating to new hunting grounds
   */
  startRelocation() {
    this.huntSearchTimer = 0;
    this.hunting = false;
    this.target = null;
    this.state = 'relocating';
    
    // Pick a new location far from current position
    const mapW = this.terrain.mapWidth;
    const mapH = this.terrain.mapHeight;
    
    // Try to find a spot at least 150 units away from current position
    let newX, newY;
    let attempts = 0;
    const minRelocateDist = 150;
    const minRelocateDistSq = minRelocateDist * minRelocateDist;
    
    do {
      // Bias toward center of map to avoid edges
      newX = random(80, mapW - 80);
      newY = random(80, mapH - 80);
      
      const dx = newX - this.pos.x;
      const dy = newY - this.pos.y;
      const distSq = dx * dx + dy * dy;
      
      attempts++;
      
      // Accept if far enough away or we've tried too many times
      if (distSq >= minRelocateDistSq || attempts > 10) {
        break;
      }
    } while (attempts <= 10);
    
    // Set new relocation target
    this.relocateTarget = createVector(newX, newY);
    this.relocateTimer = 180; // 3 seconds to reach new area
    
    if (CONFIG.debugMode) {
      console.log(`Eagle relocating from (${this.pos.x.toFixed(0)}, ${this.pos.y.toFixed(0)}) to (${newX.toFixed(0)}, ${newY.toFixed(0)})`);
    }
  }
  
  /**
   * Move toward relocation target
   */
  relocate() {
    this.relocateTimer--;
    this.maxSpeed = this.huntSpeed * 1.2; // Fly fast to new location
    
    if (!this.relocateTarget) {
      this.relocateTimer = 0;
      return;
    }
    
    // Check if we've arrived
    const dx = this.relocateTarget.x - this.pos.x;
    const dy = this.relocateTarget.y - this.pos.y;
    const distSq = dx * dx + dy * dy;
    
    if (distSq < 900 || this.relocateTimer <= 0) { // Within 30 units or time's up
      // Set new patrol center at destination
      this.patrolCenter.set(this.relocateTarget.x, this.relocateTarget.y);
      this.patrolAngle = random(TWO_PI);
      this.relocateTarget = null;
      this.relocateTimer = 0;
      this.state = 'hunting'; // Resume hunting at new location
      return;
    }
    
    // Fly toward target
    const seekForce = this.seek(this.relocateTarget, 1.2);
    this.applyForce(seekForce);
    
    this.edges();
  }
  
  /**
   * Drift patrol center slightly (used during normal patrol)
   */
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
  
  catchMoa(moa) {
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
  
  // ============================================
  // RENDERING - Simplified
  // ============================================
  
  render() {
    const ws = this.wingspan;
    const colors = EagleColors;
    
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading() + HALF_PI);
    
    // Animation state
    const isHunting = this.hunting || this.state === 'hunting';
    const isResting = this.state === 'resting';
    const isDistracted = this.state === 'distracted';
    const isRelocating = this.state === 'relocating';
    
    const flapSpeed = isHunting ? 0.4 : (isResting ? 0.06 : (isRelocating ? 0.3 : 0.1));
    const flapAmount = isHunting ? 0.5 : (isResting ? 0.1 : (isRelocating ? 0.4 : 0.2));
    const wingFlap = sin(frameCount * flapSpeed + this.wingPhase) * flapAmount;
    
    // Shadow
    noStroke();
    fill(colors.shadow);
    ellipse(isHunting ? 2 : 5, 3, ws * 0.9, ws * 0.3);
    
    // Talons (when diving)
    if (isHunting && this.target && wingFlap < -0.2) {
      this.renderTalons(ws, colors);
    }
    
    // Wings
    this.renderWing(-1, wingFlap, ws, colors);
    this.renderWing(1, wingFlap, ws, colors);
    
    // Tail
    this.renderTail(ws, isHunting, colors);
    
    // Body
    noStroke();
    fill(colors.body);
    ellipse(0, 0, 7, this.bodyLength * 0.85);
    fill(colors.bodyLight);
    ellipse(0, -this.bodyLength * 0.15, 5, this.bodyLength * 0.35);
    
    // Head
    this.renderHead(ws, colors);
    
    // State indicators
    if (isDistracted) {
      fill(255, 200, 100);
      textSize(7);
      textAlign(CENTER, CENTER);
      text("?", 0, -this.bodyLength * 0.7);
    } else if (isRelocating) {
      fill(150, 200, 255);
      textSize(6);
      textAlign(CENTER, CENTER);
      text("→", 0, -this.bodyLength * 0.7);
    }
    
    pop();
    
    if (CONFIG.showHungerBars) {
      this.renderHungerBar();
    }
  }
  
  renderWing(side, flap, ws, colors) {
    push();
    rotate(side * flap);
    scale(side, 1);
    
    // Main wing shape
    noStroke();
    fill(colors.wing);
    beginShape();
    vertex(0, -1);
    bezierVertex(ws * 0.2, -2, ws * 0.4, 0, ws * 0.5, 4);
    bezierVertex(ws * 0.45, 6, ws * 0.2, 5, 0, 2);
    endShape(CLOSE);
    
    // Wing edge feathers (simplified)
    fill(colors.wingDark);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = ws * (0.3 + t * 0.2);
      const y = 1 + t * 4;
      push();
      translate(x, y);
      rotate(0.3 + t * 0.3);
      ellipse(0, 0, ws * 0.1, 3);
      pop();
    }
    
    // Wing highlight
    stroke(colors.wingLight);
    strokeWeight(0.8);
    noFill();
    bezier(ws * 0.05, -0.5, ws * 0.2, -1.5, ws * 0.35, -0.5, ws * 0.45, 2);
    
    pop();
  }
  
  renderTail(ws, isHunting, colors) {
    const tailLen = ws * 0.3;
    const spread = isHunting ? 0.35 : 0.2;
    
    noStroke();
    fill(colors.wing);
    
    for (let i = -2; i <= 2; i++) {
      const angle = i * spread * 0.25;
      const len = tailLen * (1 - abs(i) * 0.1);
      
      push();
      rotate(angle);
      beginShape();
      vertex(-1.5, 2);
      vertex(0, len);
      vertex(1.5, 2);
      endShape(CLOSE);
      pop();
    }
    
    // Tail base
    fill(colors.body);
    ellipse(0, 3, 5, 3);
  }
  
  renderHead(ws, colors) {
    const headY = -this.bodyLength * 0.5;
    const headSize = ws * 0.2;
    
    push();
    translate(0, headY);
    
    noStroke();
    
    // Head
    fill(colors.head);
    ellipse(0, 0, headSize * 0.85, headSize);
    
    // Beak (hooked shape)
    fill(colors.beak);
    beginShape();
    vertex(-headSize * 0.25, -headSize * 0.1);
    bezierVertex(
      -headSize * 0.2, -headSize * 0.5,
      0, -headSize * 0.7,
      headSize * 0.05, -headSize * 0.65
    );
    bezierVertex(
      headSize * 0.1, -headSize * 0.5,
      headSize * 0.2, -headSize * 0.2,
      headSize * 0.25, -headSize * 0.1
    );
    endShape(CLOSE);
    
    // Beak tip
    fill(colors.beakTip);
    ellipse(0, -headSize * 0.6, 2, 3);
    
    // Eyes
    fill(colors.eye);
    ellipse(-headSize * 0.2, 0, headSize * 0.22, headSize * 0.2);
    ellipse(headSize * 0.2, 0, headSize * 0.22, headSize * 0.2);
    
    // Pupils
    fill(20);
    const pupilSize = this.hunting ? 0.12 : 0.08;
    ellipse(-headSize * 0.18, 0, headSize * pupilSize, headSize * pupilSize);
    ellipse(headSize * 0.18, 0, headSize * pupilSize, headSize * pupilSize);
    
    // Eye highlights
    fill(255, 255, 255, 180);
    ellipse(-headSize * 0.22, -headSize * 0.03, 1.5, 1.5);
    ellipse(headSize * 0.22, -headSize * 0.03, 1.5, 1.5);
    
    pop();
  }
  
  renderTalons(ws, colors) {
    push();
    translate(0, this.bodyLength * 0.25);
    
    stroke(colors.talon);
    strokeWeight(1.5);
    
    // Two feet with simple talons
    for (let foot = -1; foot <= 1; foot += 2) {
      push();
      translate(foot * 2.5, 0);
      
      // Leg
      line(0, -2, 0, 2);
      
      // Talons
      strokeWeight(1);
      for (let t = -1; t <= 1; t++) {
        line(0, 2, t * 2, 6);
      }
      line(0, 2, 0, 7);
      
      pop();
    }
    
    pop();
  }
  
  renderHungerBar() {
    const barWidth = 16;
    const barHeight = 2;
    const px = this.pos.x;
    const py = this.pos.y - 16;
    
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
    if (this.state === 'hunting' && this.target) {
      // Active hunt - red dot
      fill(255, 80, 80);
      ellipse(px + 11, py + 1, 4, 4);
    } else if (this.state === 'hunting') {
      // Searching - yellow dot
      fill(255, 200, 80);
      ellipse(px + 11, py + 1, 4, 4);
    } else if (this.state === 'relocating') {
      // Relocating - blue dot
      fill(100, 150, 255);
      ellipse(px + 11, py + 1, 4, 4);
    }
    
    // Search timer indicator (when searching for prey)
    if (this.state === 'hunting' && !this.target && this.huntSearchTimer > 0) {
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
      if (this.state === 'hunting') {
        stateText = this.target ? 'HUNTING' : `SEARCH ${((this.huntSearchTimer / 60) | 0)}s`;
      }
      text(stateText, px, py + 5);
    }
  }
}