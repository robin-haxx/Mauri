// ============================================
// PLACEABLE OBJECT CLASS
// ============================================
class PlaceableObject {
  constructor(x, y, type, terrain) {
    this.pos = createVector(x, y);
    this.type = type;
    this.terrain = terrain;
    this.def = PLACEABLES[type];
    
    this.life = this.def.duration;
    this.maxLife = this.def.duration;
    this.alive = true;
    this.radius = this.def.radius;
    
    if (this.def.nutrition) {
      this.foodRemaining = this.def.nutrition * 3;
      this.maxFood = this.foodRemaining;
    }
    
    this.pulsePhase = random(TWO_PI);
  }
  
  update() {
    this.life--;
    if (this.life <= 0) {
      this.alive = false;
    }
    if (this.def.nutrition && this.foodRemaining <= 0) {
      this.alive = false;
    }
  }
  
  consumeFood(amount) {
    if (!this.def.nutrition) return 0;
    let consumed = min(amount, this.foodRemaining);
    this.foodRemaining -= consumed;
    return consumed;
  }
  
  isInRange(pos) {
    return p5.Vector.dist(this.pos, pos) < this.radius;
  }
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    let lifeRatio = this.life / this.maxLife;
    let pulse = sin(frameCount * 0.05 + this.pulsePhase) * 0.1 + 1;
    
    noFill();
    let radiusAlpha = 30 + sin(frameCount * 0.03 + this.pulsePhase) * 15;
    stroke(255, 255, 255, radiusAlpha * lifeRatio);
    strokeWeight(1);
    ellipse(0, 0, this.radius * 2 * pulse, this.radius * 2 * pulse);
    
    noStroke();
    let col = color(this.def.color);
    fill(red(col), green(col), blue(col), 180 * lifeRatio);
    ellipse(0, 0, 18, 18);
    
    stroke(255, 255, 255, 150 * lifeRatio);
    strokeWeight(2);
    noFill();
    ellipse(0, 0, 18, 18);
    
    noStroke();
    this.renderTypeSpecific(lifeRatio);
    
    if (lifeRatio < 0.5) {
      fill(50, 50, 50, 150);
      rect(-10, 12, 20, 3);
      fill(255, 200, 100, 200);
      rect(-10, 12, 20 * lifeRatio, 3);
    }
    
    if (this.def.nutrition && this.maxFood) {
      let foodRatio = this.foodRemaining / this.maxFood;
      fill(50, 50, 50, 150);
      rect(-10, 16, 20, 2);
      fill(100, 200, 100, 200);
      rect(-10, 16, 20 * foodRatio, 2);
    }
    
    pop();
  }
  
  renderTypeSpecific(lifeRatio) {
    fill(255, 255, 255, 200 * lifeRatio);
    textSize(10);
    textAlign(CENTER, CENTER);
    
    switch(this.type) {
      case 'kawakawa':
        fill(45, 160, 80, 220 * lifeRatio);
        for (let i = 0; i < 5; i++) {
          let angle = i * TWO_PI / 5;
          ellipse(cos(angle) * 5, sin(angle) * 5, 5, 7);
        }
        break;
      case 'shelter':
        fill(30, 100, 55, 220 * lifeRatio);
        for (let i = 0; i < 6; i++) {
          push();
          rotate(i * TWO_PI / 6);
          ellipse(0, -5, 3, 8);
          pop();
        }
        break;
      case 'nest':
        fill(160, 130, 100, 220 * lifeRatio);
        ellipse(0, 0, 12, 8);
        fill(120, 95, 70, 220 * lifeRatio);
        ellipse(0, 0, 8, 5);
        break;
      case 'decoy':
        fill(200, 100, 80, 220 * lifeRatio);
        ellipse(0, 0, 10, 10);
        fill(240, 200, 150, 220 * lifeRatio);
        ellipse(0, 0, 5, 5);
        break;
      case 'waterhole':
        noFill();
        stroke(150, 200, 230, 150 * lifeRatio);
        strokeWeight(1);
        let ripple = (frameCount * 0.05) % 1;
        ellipse(0, 0, 8 + ripple * 8, 4 + ripple * 4);
        break;
      case 'harakeke':
        fill(100, 150, 70, 220 * lifeRatio);
        for (let i = -2; i <= 2; i++) {
          beginShape();
          vertex(i * 2, 3);
          vertex(i * 1.5, -8);
          vertex(i * 2 + 1, 3);
          endShape(CLOSE);
        }
        break;
    }
  }
}

