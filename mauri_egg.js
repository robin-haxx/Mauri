// ============================================
// EGG CLASS
// ============================================
class Egg {
  constructor(x, y, terrain, config) {
    this.pos = createVector(x, y);
    this.terrain = terrain;
    this.config = config;
    this.incubationTime = 0;
    this.hatchTime = config.eggIncubationTime;
    this.alive = true;
    this.hatched = false;
    this.wobblePhase = random(TWO_PI);
    this.size = 5;
    this.speedBonus = 1;
  }
  
  update() {
    if (!this.alive || this.hatched) return;
    this.incubationTime += this.speedBonus;
    if (this.incubationTime >= this.hatchTime) this.hatched = true;
  }
  
  render() {
    if (!this.alive || this.hatched) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    let progress = this.incubationTime / this.hatchTime;
    let wobble = progress > 0.7 ? sin(frameCount * 0.3 + this.wobblePhase) * (progress - 0.7) * 0.3 : 0;
    rotate(wobble);
    
    noStroke();
    fill(0, 0, 0, 30);
    ellipse(1, 1, this.size * 1.1, this.size * 0.7);
    
    fill(245, 240, 220);
    ellipse(0, 0, this.size * 0.7, this.size);
    
    fill(180, 160, 130);
    for (let i = 0; i < 3; i++) ellipse(random(-1.5, 1.5), random(-2, 2), 1, 1);
    
    if (progress > 0.5) {
      fill(200, 180, 150, (progress - 0.5) * 100);
      ellipse(0, 0, this.size * 0.5, this.size * 0.7);
    }
    
    noFill();
    stroke(200, 180, 100, 150);
    strokeWeight(1.5);
    arc(0, 0, this.size * 1.5, this.size * 1.5, -HALF_PI, -HALF_PI + progress * TWO_PI);
    
    pop();
  }
}
