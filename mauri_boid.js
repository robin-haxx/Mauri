// ============================================
// BASE BOID CLASS - Fully optimized
// ============================================
class Boid {
  constructor(x, y, terrain) {
    this.pos = createVector(x, y);
    this.vel = createVector(random(-1, 1), random(-1, 1));
    this.vel.setMag(random(0.2, 0.5));
    this.acc = createVector(0, 0);
    this.terrain = terrain;
    
    this.maxSpeed = 1;
    this.maxForce = 0.05;
    this.perceptionRadius = 50;
    this.perceptionRadiusSq = 2500;
    this.separationDist = 25;
    this.separationDistSq = 625;
    
    this.personality = {
      wanderStrength: 0.8 + random() * 0.4,
      speedVariation: 0.9 + random() * 0.2,
      turniness: 0.8 + random() * 0.4
    };
    this.noiseOffset = random() * 1000;
    
    // Reusable vectors
    this._steeringVec = createVector();
    this._tempVec1 = createVector();
    this._tempVec2 = createVector();
    this._tempVec3 = createVector();
    
    // Cache for terrain avoidance
    this._avoidAngles = [];
    for (let a = 0; a < 12; a++) {
      this._avoidAngles.push(a * (Math.PI / 6));
    }
  }
  
  // Optimized separation
  separate(nearbyBoids) {
    const force = this._steeringVec;
    force.set(0, 0);
    
    let count = 0;
    const sepDistSq = this.separationDistSq;
    const px = this.pos.x;
    const py = this.pos.y;
    
    for (let i = 0, len = nearbyBoids.length; i < len; i++) {
      const other = nearbyBoids[i];
      if (!other.alive || other === this) continue;
      
      const dx = px - other.pos.x;
      const dy = py - other.pos.y;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < sepDistSq && distSq > 0.0001) {
        const invDistSq = 1 / distSq;
        force.x += dx * invDistSq;
        force.y += dy * invDistSq;
        count++;
      }
    }
    
    if (count > 0) {
      const invCount = 1 / count;
      force.x *= invCount;
      force.y *= invCount;
      force.setMag(this.maxSpeed);
      force.sub(this.vel);
      force.limit(this.maxForce);
    }
    
    return force;
  }
  
  // Optimized alignment
  align(nearbyBoids) {
    const result = this._tempVec1;
    result.set(0, 0);
    
    let count = 0;
    const perceptionSq = this.perceptionRadiusSq;
    const px = this.pos.x;
    const py = this.pos.y;
    
    for (let i = 0, len = nearbyBoids.length; i < len; i++) {
      const other = nearbyBoids[i];
      if (!other.alive || other === this) continue;
      
      const dx = other.pos.x - px;
      const dy = other.pos.y - py;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < perceptionSq) {
        result.x += other.vel.x;
        result.y += other.vel.y;
        count++;
      }
    }
    
    if (count > 0) {
      const invCount = 1 / count;
      result.x *= invCount;
      result.y *= invCount;
      result.setMag(this.maxSpeed);
      result.sub(this.vel);
      result.limit(this.maxForce);
    }
    
    return result;
  }
  
  // Optimized cohesion
  cohesion(nearbyBoids) {
    const result = this._tempVec2;
    result.set(0, 0);
    
    let count = 0;
    const perceptionSq = this.perceptionRadiusSq;
    const px = this.pos.x;
    const py = this.pos.y;
    
    for (let i = 0, len = nearbyBoids.length; i < len; i++) {
      const other = nearbyBoids[i];
      if (!other.alive || other === this) continue;
      
      const dx = other.pos.x - px;
      const dy = other.pos.y - py;
      const distSq = dx * dx + dy * dy;
      
      if (distSq < perceptionSq) {
        result.x += other.pos.x;
        result.y += other.pos.y;
        count++;
      }
    }
    
    if (count > 0) {
      const invCount = 1 / count;
      result.x *= invCount;
      result.y *= invCount;
      return this.seekPoint(result.x, result.y, 1);
    }
    
    result.set(0, 0);
    return result;
  }
  
  // Optimized seek using coordinates
  seekPoint(tx, ty, urgency = 1) {
    const result = this._tempVec3;
    const dx = tx - this.pos.x;
    const dy = ty - this.pos.y;
    
    result.set(dx, dy);
    result.setMag(this.maxSpeed * urgency);
    result.sub(this.vel);
    result.limit(this.maxForce * urgency);
    
    return result;
  }
  
  // Vector-accepting seek (for compatibility)
  seek(target, urgency = 1) {
    return this.seekPoint(target.x, target.y, urgency);
  }
  
  // Optimized flee
  fleePoint(tx, ty, radius = 100) {
    const result = this._tempVec1;
    const dx = this.pos.x - tx;
    const dy = this.pos.y - ty;
    const distSq = dx * dx + dy * dy;
    const radiusSq = radius * radius;
    
    if (distSq < radiusSq && distSq > 0.0001) {
      const d = Math.sqrt(distSq);
      const urgency = 1 - (d / radius);
      const speed = this.maxSpeed * (1 + urgency);
      
      result.set(dx, dy);
      result.setMag(speed);
      result.sub(this.vel);
      result.limit(this.maxForce * 2);
      
      return result;
    }
    
    result.set(0, 0);
    return result;
  }
  
  flee(target, radius = 100) {
    return this.fleePoint(target.x, target.y, radius);
  }
  
  // Optimized wander
  wander() {
    const result = this._tempVec1;
    const noiseVal = noise(
      this.pos.x * 0.005 + this.noiseOffset,
      this.pos.y * 0.005 + this.noiseOffset,
      frameCount * 0.008
    );
    const angle = noiseVal * 12.566370614359172 - 6.283185307179586; // TWO_PI * 2 - TWO_PI
    const mag = 0.3 * this.personality.wanderStrength;
    
    result.set(Math.cos(angle) * mag, Math.sin(angle) * mag);
    return result;
  }
  
  // Optimized terrain avoidance
  avoidUnwalkable() {
    const result = this._steeringVec;
    result.set(0, 0);
    
    const lookAhead = 12;
    const velX = this.vel.x;
    const velY = this.vel.y;
    const velMagSq = velX * velX + velY * velY;
    
    if (velMagSq < 0.0001) return result;
    
    const velMag = Math.sqrt(velMagSq);
    const invVelMag = 1 / velMag;
    const futureX = this.pos.x + velX * invVelMag * lookAhead;
    const futureY = this.pos.y + velY * invVelMag * lookAhead;
    
    if (!this.terrain.isWalkable(futureX, futureY)) {
      let bestDot = -2;
      let bestAngle = 0;
      const currentHeading = Math.atan2(velY, velX);
      const px = this.pos.x;
      const py = this.pos.y;
      
      const angles = this._avoidAngles;
      for (let i = 0; i < 12; i++) {
        const a = angles[i];
        const testAngle = currentHeading + a;
        const testX = px + Math.cos(testAngle) * lookAhead;
        const testY = py + Math.sin(testAngle) * lookAhead;
        
        if (this.terrain.isWalkable(testX, testY)) {
          const dot = Math.cos(a);
          if (dot > bestDot) {
            bestDot = dot;
            bestAngle = testAngle;
          }
        }
      }
      
      if (bestDot > -2) {
        result.set(
          Math.cos(bestAngle) * this.maxForce * 2,
          Math.sin(bestAngle) * this.maxForce * 2
        );
      } else {
        result.set(
          -velX * invVelMag * this.maxForce * 3,
          -velY * invVelMag * this.maxForce * 3
        );
      }
    }
    
    return result;
  }
  
  // Edge avoidance
  edges() {
    const margin = 25;
    const turnForce = 0.3 * this.personality.turniness;
    const w = this.terrain.mapWidth;
    const h = this.terrain.mapHeight;
    const px = this.pos.x;
    const py = this.pos.y;
    
    if (px < margin) this.acc.x += turnForce;
    else if (px > w - margin) this.acc.x -= turnForce;
    
    if (py < margin) this.acc.y += turnForce;
    else if (py > h - margin) this.acc.y -= turnForce;
  }
  
  applyForce(force) {
    this.acc.x += force.x;
    this.acc.y += force.y;
  }
  
  update() {
    // Apply acceleration
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    
    // Limit speed (inline for performance)
    const maxSpd = this.maxSpeed * this.personality.speedVariation;
    const maxSpdSq = maxSpd * maxSpd;
    const spdSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
    
    if (spdSq > maxSpdSq) {
      const invSpd = maxSpd / Math.sqrt(spdSq);
      this.vel.x *= invSpd;
      this.vel.y *= invSpd;
    }
    
    // Apply velocity
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    
    // Reset acceleration
    this.acc.x = 0;
    this.acc.y = 0;
    
    // Constrain to map (inline)
    const w = this.terrain.mapWidth - 5;
    const h = this.terrain.mapHeight - 5;
    
    if (this.pos.x < 5) this.pos.x = 5;
    else if (this.pos.x > w) this.pos.x = w;
    
    if (this.pos.y < 5) this.pos.y = 5;
    else if (this.pos.y > h) this.pos.y = h;
  }
}