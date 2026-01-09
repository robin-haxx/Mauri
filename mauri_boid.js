// ============================================
// BASE BOID CLASS
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
  }
  
  separate(boids) {
    let steering = createVector();
    let count = 0;
    for (let other of boids) {
      if (!other.alive) continue;
      let d = p5.Vector.dist(this.pos, other.pos);
      if (other !== this && d < this.separationDist && d > 0) {
        let diff = p5.Vector.sub(this.pos, other.pos).normalize().div(d);
        steering.add(diff);
        count++;
      }
    }
    if (count > 0) {
      steering.div(count).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
    }
    return steering;
  }
  
  seek(target, urgency = 1) {
    let desired = p5.Vector.sub(target, this.pos).setMag(this.maxSpeed * urgency);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce * urgency);
  }
  
  flee(target, radius = 100) {
    let d = p5.Vector.dist(this.pos, target);
    if (d < radius && d > 0) {
      let urgency = 1 - (d / radius);
      let desired = p5.Vector.sub(this.pos, target).setMag(this.maxSpeed * (1 + urgency));
      return p5.Vector.sub(desired, this.vel).limit(this.maxForce * 2);
    }
    return createVector(0, 0);
  }
  
  wander() {
    let noiseVal = noise(this.pos.x * 0.005 + this.noiseOffset, this.pos.y * 0.005 + this.noiseOffset, frameCount * 0.008);
    let angle = noiseVal * TWO_PI * 4 - TWO_PI * 2;
    return p5.Vector.fromAngle(angle).setMag(0.3 * this.personality.wanderStrength);
  }
  
  avoidUnwalkable() {
    let steering = createVector();
    const lookAhead = 12;
    let futurePos = p5.Vector.add(this.pos, p5.Vector.mult(this.vel.copy().normalize(), lookAhead));
    
    if (!this.terrain.isWalkable(futurePos.x, futurePos.y)) {
      let bestDir = null, bestDot = -Infinity;
      for (let a = 0; a < TWO_PI; a += PI / 6) {
        let testAngle = this.vel.heading() + a;
        let testDir = p5.Vector.fromAngle(testAngle);
        let testPos = p5.Vector.add(this.pos, testDir.copy().mult(lookAhead));
        if (this.terrain.isWalkable(testPos.x, testPos.y)) {
          let dot = testDir.dot(this.vel.copy().normalize());
          if (dot > bestDot) { bestDot = dot; bestDir = testDir; }
        }
      }
      steering = bestDir ? bestDir.mult(this.maxForce * 2) : p5.Vector.mult(this.vel, -1).setMag(this.maxForce * 3);
    }
    return steering;
  }
  
  edges() {
    const margin = 25, turnForce = 0.3 * this.personality.turniness;
    const w = this.terrain.mapWidth, h = this.terrain.mapHeight;
    if (this.pos.x < margin) this.acc.x += turnForce;
    if (this.pos.x > w - margin) this.acc.x -= turnForce;
    if (this.pos.y < margin) this.acc.y += turnForce;
    if (this.pos.y > h - margin) this.acc.y -= turnForce;
  }
  
  applyForce(force) { this.acc.add(force); }
  
  update() {
    this.vel.add(this.acc).limit(this.maxSpeed * this.personality.speedVariation);
    this.pos.add(this.vel);
    this.acc.mult(0);
    const w = this.terrain.mapWidth, h = this.terrain.mapHeight;
    this.pos.x = constrain(this.pos.x, 5, w - 5);
    this.pos.y = constrain(this.pos.y, 5, h - 5);
  }
}

