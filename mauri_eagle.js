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
    this.eye = color(200, 160, 50);
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
    
    // State timers
    this.restTimer = 0;
    this.restDuration = 180;
    this.distractedBy = null;
    this.distractedTimer = 0;
    
    // Visual
    this.wingspan = random(22, 28);
    this.wingPhase = random(TWO_PI);
    this.bodyLength = this.wingspan * 0.45;
    
    // Reusable vectors
    this._tempForce = createVector();
    this._targetVec = createVector();
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
      this.distractedTimer--;
      this.beDistracted();
      return;
    }
    
    if (this.restTimer > 0) {
      this.restTimer--;
      this.rest();
      return;
    }
    
    // Separation from other eagles
    const nearbyEagles = simulation.getNearbyEagles(this.pos.x, this.pos.y, this.separationDist * 1.5);
    const sep = this.separate(nearbyEagles);
    sep.mult(2);
    this.applyForce(sep);
    
    // Hunt or patrol
    if (this.hunger > this.huntThreshold) {
      this.hunt(simulation);
    } else {
      this.hunting = false;
      this.target = null;
      this.patrol();
    }
    
    this.edges();
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
      const mapW = this.terrain.mapWidth;
      const mapH = this.terrain.mapHeight;
      this.patrolCenter.x = constrain(this.patrolCenter.x + random(-20, 20), 50, mapW - 50);
      this.patrolCenter.y = constrain(this.patrolCenter.y + random(-20, 20), 50, mapH - 50);
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
      this.hunting = true;
      this.target = nearestMoa;
      
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
      this.hunting = false;
      this.target = null;
      this.patrol();
    }
  }
  
  catchMoa(moa) {
    moa.alive = false;
    this.kills++;
    this.hunger = Math.max(0, this.hunger - 60);
    this.vel.mult(0.1);
    this.hunting = false;
    this.target = null;
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
    const isHunting = this.hunting;
    const isResting = this.restTimer > 0;
    const isDistracted = this.distractedTimer > 0;
    
    const flapSpeed = isHunting ? 0.4 : (isResting ? 0.06 : 0.1);
    const flapAmount = isHunting ? 0.5 : (isResting ? 0.1 : 0.2);
    const wingFlap = sin(frameCount * flapSpeed + this.wingPhase) * flapAmount;
    
    // Shadow
    noStroke();
    fill(colors.shadow);
    ellipse(isHunting ? 2 : 5, 3, ws * 0.9, ws * 0.3);
    
    // Talons (when diving)
    if (isHunting && wingFlap < -0.2) {
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
    
    // Distracted indicator
    if (isDistracted) {
      fill(255, 200, 100);
      textSize(7);
      textAlign(CENTER, CENTER);
      text("?", 0, -this.bodyLength * 0.7);
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
    
    // Hunting indicator
    if (this.hunting) {
      fill(255, 80, 80);
      ellipse(px + 11, py + 1, 4, 4);
    }
    
    // Debug info
    if (CONFIG.debugMode) {
      fill(200, 200, 200, 180);
      textSize(6);
      textAlign(CENTER, TOP);
      
      const state = this.distractedTimer > 0 ? 'DISTRACTED' :
                    this.restTimer > 0 ? 'RESTING' :
                    this.hunting ? 'HUNTING' : 'PATROL';
      text(state, px, py + 4);
    }
  }
}