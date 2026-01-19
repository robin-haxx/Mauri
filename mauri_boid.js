// ============================================
// BASE BOID CLASS - Optimized for performance
// ============================================
class Boid {
  constructor(x, y, terrain) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(random(0.2, 0.5));
    this.acc = createVector(0, 0);
    this.terrain = terrain;
    
    this.maxSpeed = 1;
    this.maxForce = 0.05;
    this.perceptionRadius = 50;
    this.separationDist = 25;
    
    this.personality = {
      wanderStrength: random(0.8, 1.2),
      speedVariation: random(0.9, 1.1),
      turniness: random(0.8, 1.2)
    };
    this.noiseOffset = random(1000);
    
    // Reusable vectors to minimize garbage collection
    this._steeringVec = createVector();
    this._tempVec1 = createVector();
    this._tempVec2 = createVector();
    this._tempVec3 = createVector();
  }
  
  // Optimized separation using spatial grid results
  // Pass in pre-filtered nearby boids from spatial grid
  separate(nearbyBoids) {
    this._steeringVec.set(0, 0);
    let count = 0;
    
    for (let i = 0; i < nearbyBoids.length; i++) {
      const other = nearbyBoids[i];
      if (!other.alive || other === this) continue;
      
      // Calculate distance without creating vectors
      const dx = this.pos.x - other.pos.x;
      const dy = this.pos.y - other.pos.y;
      const distSq = dx * dx + dy * dy;
      const sepDistSq = this.separationDist * this.separationDist;
      
      if (distSq < sepDistSq && distSq > 0) {
        // Weight by inverse distance squared
        const invDistSq = 1 / distSq;
        this._steeringVec.x += dx * invDistSq;
        this._steeringVec.y += dy * invDistSq;
        count++;
      }
    }
    
    if (count > 0) {
      this._steeringVec.div(count);
      this._steeringVec.setMag(this.maxSpeed);
      this._steeringVec.sub(this.vel);
      this._steeringVec.limit(this.maxForce);
    }
    
    return this._steeringVec;
  }
  
  // Optimized alignment - steer towards average heading of neighbors
  align(nearbyBoids) {
    this._tempVec1.set(0, 0);
    let count = 0;
    
    for (let i = 0; i < nearbyBoids.length; i++) {
      const other = nearbyBoids[i];
      if (!other.alive || other === this) continue;
      
      const dx = other.pos.x - this.pos.x;
      const dy = other.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      const perceptionSq = this.perceptionRadius * this.perceptionRadius;
      
      if (distSq < perceptionSq) {
        this._tempVec1.x += other.vel.x;
        this._tempVec1.y += other.vel.y;
        count++;
      }
    }
    
    if (count > 0) {
      this._tempVec1.div(count);
      this._tempVec1.setMag(this.maxSpeed);
      this._tempVec1.sub(this.vel);
      this._tempVec1.limit(this.maxForce);
    }
    
    return this._tempVec1;
  }
  
  // Optimized cohesion - steer towards center of neighbors
  cohesion(nearbyBoids) {
    this._tempVec2.set(0, 0);
    let count = 0;
    
    for (let i = 0; i < nearbyBoids.length; i++) {
      const other = nearbyBoids[i];
      if (!other.alive || other === this) continue;
      
      const dx = other.pos.x - this.pos.x;
      const dy = other.pos.y - this.pos.y;
      const distSq = dx * dx + dy * dy;
      const perceptionSq = this.perceptionRadius * this.perceptionRadius;
      
      if (distSq < perceptionSq) {
        this._tempVec2.x += other.pos.x;
        this._tempVec2.y += other.pos.y;
        count++;
      }
    }
    
    if (count > 0) {
      this._tempVec2.div(count);
      // Seek the center
      return this.seekPoint(this._tempVec2.x, this._tempVec2.y, 1);
    }
    
    this._tempVec2.set(0, 0);
    return this._tempVec2;
  }
  
  // Optimized seek using coordinates instead of vector
  seekPoint(tx, ty, urgency = 1) {
    const dx = tx - this.pos.x;
    const dy = ty - this.pos.y;
    
    this._tempVec3.set(dx, dy);
    this._tempVec3.setMag(this.maxSpeed * urgency);
    this._tempVec3.sub(this.vel);
    this._tempVec3.limit(this.maxForce * urgency);
    
    return this._tempVec3;
  }
  
  // Original seek for compatibility (accepts vector)
  seek(target, urgency = 1) {
    return this.seekPoint(target.x, target.y, urgency);
  }
  
  // Optimized flee using coordinates
  fleePoint(tx, ty, radius = 100) {
    const dx = this.pos.x - tx;
    const dy = this.pos.y - ty;
    const distSq = dx * dx + dy * dy;
    const radiusSq = radius * radius;
    
    if (distSq < radiusSq && distSq > 0) {
      const d = Math.sqrt(distSq);
      const urgency = 1 - (d / radius);
      const speed = this.maxSpeed * (1 + urgency);
      
      this._tempVec1.set(dx, dy);
      this._tempVec1.setMag(speed);
      this._tempVec1.sub(this.vel);
      this._tempVec1.limit(this.maxForce * 2);
      
      return this._tempVec1;
    }
    
    this._tempVec1.set(0, 0);
    return this._tempVec1;
  }
  
  // Original flee for compatibility
  flee(target, radius = 100) {
    return this.fleePoint(target.x, target.y, radius);
  }
  
  // Optimized wander using noise
  wander() {
    const noiseVal = noise(
      this.pos.x * 0.005 + this.noiseOffset,
      this.pos.y * 0.005 + this.noiseOffset,
      frameCount * 0.008
    );
    const angle = noiseVal * TWO_PI * 4 - TWO_PI * 2;
    const mag = 0.3 * this.personality.wanderStrength;
    
    this._tempVec1.set(Math.cos(angle) * mag, Math.sin(angle) * mag);
    return this._tempVec1;
  }
  
  // Optimized terrain avoidance
  avoidUnwalkable() {
    this._steeringVec.set(0, 0);
    const lookAhead = 12;
    
    // Calculate future position
    const velMag = this.vel.mag();
    if (velMag < 0.01) return this._steeringVec;
    
    const futureX = this.pos.x + (this.vel.x / velMag) * lookAhead;
    const futureY = this.pos.y + (this.vel.y / velMag) * lookAhead;
    
    if (!this.terrain.isWalkable(futureX, futureY)) {
      let bestDot = -Infinity;
      let bestAngle = 0;
      const currentHeading = this.vel.heading();
      
      // Check angles to find walkable direction
      for (let a = 0; a < TWO_PI; a += PI / 6) {
        const testAngle = currentHeading + a;
        const testX = this.pos.x + Math.cos(testAngle) * lookAhead;
        const testY = this.pos.y + Math.sin(testAngle) * lookAhead;
        
        if (this.terrain.isWalkable(testX, testY)) {
          // Prefer directions closer to current heading
          const dot = Math.cos(a);
          if (dot > bestDot) {
            bestDot = dot;
            bestAngle = testAngle;
          }
        }
      }
      
      if (bestDot > -Infinity) {
        this._steeringVec.set(
          Math.cos(bestAngle) * this.maxForce * 2,
          Math.sin(bestAngle) * this.maxForce * 2
        );
      } else {
        // No walkable direction found, reverse
        this._steeringVec.set(
          -this.vel.x * this.maxForce * 3 / velMag,
          -this.vel.y * this.maxForce * 3 / velMag
        );
      }
    }
    
    return this._steeringVec;
  }
  
  // Edge avoidance
  edges() {
    const margin = 25;
    const turnForce = 0.3 * this.personality.turniness;
    const w = this.terrain.mapWidth;
    const h = this.terrain.mapHeight;
    
    if (this.pos.x < margin) this.acc.x += turnForce;
    if (this.pos.x > w - margin) this.acc.x -= turnForce;
    if (this.pos.y < margin) this.acc.y += turnForce;
    if (this.pos.y > h - margin) this.acc.y -= turnForce;
  }
  
  applyForce(force) {
    this.acc.x += force.x;
    this.acc.y += force.y;
  }
  
  update() {
    // Apply acceleration to velocity
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    
    // Limit speed
    const maxSpd = this.maxSpeed * this.personality.speedVariation;
    const spdSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
    if (spdSq > maxSpd * maxSpd) {
      const spd = Math.sqrt(spdSq);
      this.vel.x = (this.vel.x / spd) * maxSpd;
      this.vel.y = (this.vel.y / spd) * maxSpd;
    }
    
    // Apply velocity to position
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    
    // Reset acceleration
    this.acc.x = 0;
    this.acc.y = 0;
    
    // Constrain to map
    const w = this.terrain.mapWidth;
    const h = this.terrain.mapHeight;
    this.pos.x = constrain(this.pos.x, 5, w - 5);
    this.pos.y = constrain(this.pos.y, 5, h - 5);
  }
}