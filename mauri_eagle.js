// ============================================
// HAAST'S EAGLE CLASS - Uses Spatial Grid for hunting
// ============================================
class HaastsEagle extends Boid {
  constructor(x, y, terrain, config = null, speciesData = null) {
    super(x, y, terrain);
    
    this.config = config;
    this.species = speciesData;
    
    this.baseSpeed = 0.6;
    this.huntSpeed = 1.4;
    this.maxSpeed = this.baseSpeed;
    this.maxForce = 0.05;
    this.perceptionRadius = 160;
    this.separationDist = 100;
    
    this.huntRadius = 130;
    this.catchRadius = 12;
    this.target = null;
    this.hunting = false;
    
    this.hunger = random(20, 45);
    this.maxHunger = 100;
    this.hungerRate = 0.022;
    this.huntThreshold = 40;
    this.kills = 0;
    
    this.patrolCenter = createVector(x, y);
    this.patrolRadius = random(70, 100);
    this.patrolAngle = random(TWO_PI);
    this.patrolSpeed = random(0.008, 0.012);
    
    this.restTimer = 0;
    this.restDuration = 180;
    
    this.distractedBy = null;
    this.distractedTimer = 0;
    
    this.wingspan = random(20, 26);
    this.wingPhase = random(TWO_PI);
    
    // Reusable vectors
    this._separateForce = createVector();
    this._seekForce = createVector();
  }
  
  isHunting() { 
    return this.hunting && this.target !== null; 
  }
  
  /**
   * Optimized separation using pre-filtered nearby eagles
   */
  separateOptimized(nearbyEagles) {
    this._separateForce.set(0, 0);
    let count = 0;
    
    for (let i = 0; i < nearbyEagles.length; i++) {
      const other = nearbyEagles[i];
      if (other === this) continue;
      
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const distSq = dx * dx + dy * dy;
      const sepDistSq = this.separationDist * this.separationDist;
      
      if (distSq < sepDistSq && distSq > 0) {
        const invDistSq = 1 / distSq;
        this._separateForce.x += dx * invDistSq;
        this._separateForce.y += dy * invDistSq;
        count++;
      }
    }
    
    if (count > 0) {
      this._separateForce.div(count);
      this._separateForce.setMag(this.maxSpeed);
      this._separateForce.sub(this.vel);
      this._separateForce.limit(this.maxForce);
    }
    
    return this._separateForce;
  }
  
  /**
   * Main behavior - uses simulation for spatial queries
   */
  behave(simulation) {
    this.hunger = min(this.hunger + this.hungerRate, this.maxHunger);
    
    // Check for decoys using spatial grid
    const nearbyPlaceables = simulation.getNearbyPlaceables(this.pos.x, this.pos.y, 100);
    this.checkDecoys(nearbyPlaceables);
    
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
    
    // Separation from other eagles using spatial grid
    const nearbyEagles = simulation.getNearbyEagles(this.pos.x, this.pos.y, this.separationDist * 1.5);
    let sep = this.separateOptimized(nearbyEagles);
    sep.mult(2);
    this.applyForce(sep);
    
    if (this.hunger > this.huntThreshold) {
      this.hunt(simulation);
    } else {
      this.hunting = false;
      this.target = null;
      this.patrol();
    }
    
    this.edges();
  }
  
  checkDecoys(nearbyPlaceables) {
    if (this.distractedTimer > 0) return;
    
    for (let i = 0; i < nearbyPlaceables.length; i++) {
      const p = nearbyPlaceables[i];
      if (!p.alive || !p.def.distractsEagles) continue;
      
      const dx = p.pos.x - this.pos.x;
      const dy = p.pos.y - this.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      if (d < p.radius && this.hunting) {
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
      let toDecoy = p5.Vector.sub(this.distractedBy.pos, this.pos);
      let tangent = createVector(-toDecoy.y, toDecoy.x).normalize();
      tangent.mult(this.maxForce * 0.8);
      this.applyForce(tangent);
      
      if (toDecoy.mag() > 20) {
        this.applyForce(toDecoy.normalize().mult(this.maxForce * 0.3));
      }
    } else {
      this.distractedTimer = 0;
    }
    
    this.edges();
  }
  
  patrol() {
    this.maxSpeed = this.baseSpeed;
    
    this.patrolAngle += this.patrolSpeed * this.personality.wanderStrength;
    let targetX = this.patrolCenter.x + cos(this.patrolAngle) * this.patrolRadius;
    let targetY = this.patrolCenter.y + sin(this.patrolAngle) * this.patrolRadius;
    
    let seekForce = this.seek(createVector(targetX, targetY), 0.4);
    this.applyForce(seekForce);
    
    let wander = this.wander().mult(0.25);
    this.applyForce(wander);
    
    if (frameCount % 300 === 0) {
      this.patrolCenter.x = constrain(this.patrolCenter.x + random(-20, 20), 50, this.terrain.mapWidth - 50);
      this.patrolCenter.y = constrain(this.patrolCenter.y + random(-20, 20), 50, this.terrain.mapHeight - 50);
    }
  }
  
  rest() {
    this.maxSpeed = this.baseSpeed * 0.5;
    this.hunting = false;
    this.target = null;
    
    let wander = this.wander().mult(0.15);
    this.applyForce(wander);
    
    let toCenter = this.seek(this.patrolCenter, 0.2);
    this.applyForce(toCenter);
    
    this.edges();
  }
  
  /**
   * Hunt for moas using spatial grid
   */
  hunt(simulation) {
    this.maxSpeed = this.huntSpeed;
    
    // Get nearby moas using spatial grid
    const nearbyMoas = simulation.getNearbyMoas(this.pos.x, this.pos.y, this.huntRadius);
    
    let nearestDist = Infinity;
    let nearestMoa = null;
    
    for (let i = 0; i < nearbyMoas.length; i++) {
      const moa = nearbyMoas[i];
      if (!moa.alive) continue;
      if (moa.inShelter && this.target !== moa) continue;
      
      // Check if moa resists (for larger species)
      if (moa.resistEagleAttack && moa.resistEagleAttack()) continue;
      
      const dx = moa.pos.x - this.pos.x;
      const dy = moa.pos.y - this.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      if (d < nearestDist) {
        nearestDist = d;
        nearestMoa = moa;
      }
    }
    
    if (nearestMoa) {
      this.hunting = true;
      this.target = nearestMoa;
      
      // Predict where moa will be
      let prediction = p5.Vector.add(nearestMoa.pos, p5.Vector.mult(nearestMoa.vel, 12));
      let pursue = this.seek(prediction, 1.4);
      this.applyForce(pursue);
      
      if (nearestDist < this.catchRadius) {
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
    this.hunger = max(0, this.hunger - 60);
    this.vel.mult(0.1);
    this.hunting = false;
    this.target = null;
    this.restTimer = this.restDuration;
    this.patrolCenter = this.pos.copy();
  }
  
  render() {
    push();
    translate(this.pos.x, this.pos.y);
    
    let angle = this.vel.heading();
    rotate(angle + HALF_PI);
    
    let flapSpeed, flapAmount;
    if (this.distractedTimer > 0) {
      flapSpeed = 0.3;
      flapAmount = 0.4;
    } else if (this.restTimer > 0) {
      flapSpeed = 0.08;
      flapAmount = 0.15;
    } else if (this.hunting) {
      flapSpeed = 0.4;
      flapAmount = 0.5;
    } else {
      flapSpeed = 0.1;
      flapAmount = 0.2;
    }
    
    let wingFlap = sin(frameCount * flapSpeed + this.wingPhase) * flapAmount;
    
    let shadowOffset = this.hunting ? 3 : 7;
    let shadowAlpha = this.hunting ? 35 : 20;
    noStroke();
    fill(0, 0, 0, shadowAlpha);
    ellipse(shadowOffset, shadowOffset, this.wingspan * 0.9, this.wingspan * 0.4);
    
    let wingColor;
    if (this.distractedTimer > 0) {
      wingColor = color(80, 60, 45);
    } else if (this.hunting) {
      wingColor = color(40, 28, 15);
    } else if (this.restTimer > 0) {
      wingColor = color(70, 55, 40);
    } else {
      wingColor = color(60, 45, 30);
    }
    
    fill(wingColor);
    noStroke();
    
    push();
    rotate(-wingFlap);
    beginShape();
    vertex(0, 0);
    vertex(-this.wingspan * 0.5, -2);
    vertex(-this.wingspan * 0.55, 4);
    vertex(-this.wingspan * 0.3, 5);
    vertex(0, 2);
    endShape(CLOSE);
    pop();
    
    push();
    rotate(wingFlap);
    beginShape();
    vertex(0, 0);
    vertex(this.wingspan * 0.5, -2);
    vertex(this.wingspan * 0.55, 4);
    vertex(this.wingspan * 0.3, 5);
    vertex(0, 2);
    endShape(CLOSE);
    pop();
    
    fill(35, 25, 15);
    ellipse(0, 0, 7, 11);
    
    fill(50, 38, 25);
    ellipse(0, -5.5, 5.5, 6.5);
    
    fill(85, 75, 30);
    beginShape();
    vertex(0, -10);
    vertex(-2, -7);
    vertex(0, -8);
    vertex(2, -7);
    endShape(CLOSE);
    
    fill(30);
    ellipse(1.5, -5.5, 2, 2);
    
    if (this.distractedTimer > 0) {
      noFill();
      stroke(255, 200, 100, 150);
      strokeWeight(1);
      ellipse(0, -8, 8, 8);
      fill(255, 200, 100);
      noStroke();
      textSize(6);
      textAlign(CENTER, CENTER);
      text("?", 0, -8);
    }
    
    if (this.hunting && this.target && this.target.alive) {
      stroke(255, 80, 80, 100);
      strokeWeight(1);
      let targetDir = p5.Vector.sub(this.target.pos, this.pos);
      rotate(-angle - HALF_PI);
      line(0, 0, targetDir.x * 0.3, targetDir.y * 0.3);
    }
    
    pop();
    
    if (CONFIG.showHungerBars) {
      this.renderHungerBar();
    }
  }
  
    renderHungerBar() {
    const barWidth = 18, barHeight = 2, yOffset = -16;
    
    fill(50, 50, 50, 150);
    noStroke();
    rect(this.pos.x - barWidth/2, this.pos.y + yOffset, barWidth, barHeight);
    
    let hungerPercent = this.hunger / this.maxHunger;
    let barColor;
    if (hungerPercent < 0.5) {
      barColor = lerpColor(color(100, 160, 200), color(180, 180, 100), hungerPercent * 2);
    } else {
      barColor = lerpColor(color(180, 180, 100), color(200, 100, 80), (hungerPercent - 0.5) * 2);
    }
    
    fill(barColor);
    rect(this.pos.x - barWidth/2, this.pos.y + yOffset, barWidth * (1 - hungerPercent), barHeight);
    
    if (this.hunting) {
      fill(255, 100, 100);
      ellipse(this.pos.x + barWidth/2 + 4, this.pos.y + yOffset + 1, 4, 4);
    }
    
    // Debug info
    if (CONFIG.debugMode) {
      fill(200, 200, 200, 150);
      noStroke();
      textSize(5);
      textAlign(CENTER, TOP);
      
      let stateText = '';
      if (this.distractedTimer > 0) {
        stateText = 'DISTRACTED';
      } else if (this.restTimer > 0) {
        stateText = 'RESTING';
      } else if (this.hunting) {
        stateText = 'HUNTING';
      } else {
        stateText = 'PATROL';
      }
      
      text(stateText, this.pos.x, this.pos.y + yOffset + 4);
      
      // Show hunt radius
      noFill();
      stroke(255, 100, 100, 30);
      strokeWeight(1);
      ellipse(this.pos.x, this.pos.y, this.huntRadius * 2, this.huntRadius * 2);
    }
  }
}