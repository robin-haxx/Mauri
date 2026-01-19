// ============================================
// EGG CLASS 
// ============================================
class Egg {
  constructor(x, y, terrain, config) {
    this.pos = createVector(x, y);
    this.terrain = terrain;
    this.config = config;
    
    this.alive = true;
    this.hatched = false;
    
    this.incubationTime = config.eggIncubationTime;
    this.currentTime = 0;
    this.speedBonus = 1;
    
    // Species inheritance
    this.parentSpecies = null;  // Set by parent moa
    
    // Visual
    this.wobblePhase = random(TWO_PI);
    this.size = random(4, 5);
  }
  
  update() {
    if (!this.alive || this.hatched) return;
    
    this.currentTime += this.speedBonus;
    
    if (this.currentTime >= this.incubationTime) {
      this.hatched = true;
    }
  }
  
  /**
   * Get the species key for the offspring
   * Can include mutation/variation logic here
   */
  getOffspringSpecies() {
    // If parent species is set, usually inherit it
    if (this.parentSpecies) {
      // Small chance of mutation to related species
      if (random() < 0.05) {  // 5% mutation chance
        return this.getMutatedSpecies();
      }
      return this.parentSpecies;
    }
    
    // Default to upland moa if no parent species
    return 'upland_moa';
  }
  
  /**
   * Get a mutated species (related to parent)
   */
  getMutatedSpecies() {
    if (typeof REGISTRY === 'undefined') return this.parentSpecies;
    
    // Get all moa species
    const moaSpecies = REGISTRY.getSpeciesOfType('moa');
    if (moaSpecies.length <= 1) return this.parentSpecies;
    
    // Pick a random different species
    const otherSpecies = moaSpecies.filter(s => s.key !== this.parentSpecies);
    if (otherSpecies.length === 0) return this.parentSpecies;
    
    const mutant = otherSpecies[Math.floor(random() * otherSpecies.length)];
    return mutant.key;
  }
  
  render() {
    if (!this.alive) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    let progress = this.currentTime / this.incubationTime;
    let wobble = 0;
    
    // Wobble more as hatching approaches
    if (progress > 0.7) {
      let wobbleIntensity = (progress - 0.7) / 0.3;
      wobble = sin(frameCount * 0.3 + this.wobblePhase) * wobbleIntensity * 0.15;
    }
    
    rotate(wobble);
    
    // Shadow
    noStroke();
    fill(0, 0, 0, 20);
    ellipse(1, 1, this.size * 1.4, this.size * 0.9);
    
    // Egg base color - slightly tinted by parent species if known
    let eggColor = color(245, 240, 225);
    if (this.parentSpecies && typeof REGISTRY !== 'undefined') {
      const species = REGISTRY.getSpecies(this.parentSpecies);
      if (species && species.config.bodyColor) {
        const bc = species.config.bodyColor;
        const tintR = Array.isArray(bc.r) ? (bc.r[0] + bc.r[1]) / 2 : bc.r;
        const tintG = Array.isArray(bc.g) ? (bc.g[0] + bc.g[1]) / 2 : bc.g;
        const tintB = Array.isArray(bc.b) ? (bc.b[0] + bc.b[1]) / 2 : bc.b;
        // Subtle tint
        eggColor = lerpColor(eggColor, color(tintR + 100, tintG + 100, tintB + 100), 0.15);
      }
    }
    
    // Main egg
    fill(eggColor);
    stroke(200, 195, 180);
    strokeWeight(0.5);
    ellipse(0, 0, this.size * 1.3, this.size * 1.7);
    
    // Highlight
    noStroke();
    fill(255, 255, 255, 60);
    ellipse(-this.size * 0.15, -this.size * 0.25, this.size * 0.5, this.size * 0.7);
    
    // Speckles
    fill(180, 170, 150, 100);
    for (let i = 0; i < 5; i++) {
      let sx = sin(i * 1.3 + this.wobblePhase) * this.size * 0.3;
      let sy = cos(i * 1.7 + this.wobblePhase) * this.size * 0.5;
      ellipse(sx, sy, 1.5, 1.5);
    }
    
    // Cracks when close to hatching
    if (progress > 0.85) {
      stroke(150, 140, 120);
      strokeWeight(0.8);
      noFill();
      
      let crackIntensity = (progress - 0.85) / 0.15;
      
      // Crack lines
      beginShape();
      vertex(0, -this.size * 0.4);
      vertex(this.size * 0.1 * crackIntensity, -this.size * 0.2);
      vertex(-this.size * 0.15 * crackIntensity, 0);
      vertex(this.size * 0.2 * crackIntensity, this.size * 0.2);
      endShape();
      
      if (crackIntensity > 0.5) {
        beginShape();
        vertex(-this.size * 0.2, -this.size * 0.3);
        vertex(-this.size * 0.3 * crackIntensity, -this.size * 0.1);
        vertex(-this.size * 0.1 * crackIntensity, this.size * 0.1);
        endShape();
      }
    }
    
    pop();
    
    // Progress indicator
    if (CONFIG.showHungerBars) {
      this.renderProgressBar(progress);
    }
  }
  
  renderProgressBar(progress) {
    const barWidth = 12;
    const barHeight = 2;
    const yOffset = -this.size - 4;
    
    noStroke();
    
    // Background
    fill(40, 40, 40, 150);
    rect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth, barHeight, 1);
    
    // Progress fill
    let barColor = lerpColor(color(200, 180, 100), color(100, 200, 100), progress);
    fill(barColor);
    rect(this.pos.x - barWidth / 2, this.pos.y + yOffset, barWidth * progress, barHeight, 1);
    
    // Species indicator (small, optional)
    if (CONFIG.debugMode && this.parentSpecies) {
      fill(200, 200, 200, 120);
      textSize(4);
      textAlign(CENTER, TOP);
      text(this.parentSpecies.substring(0, 8), this.pos.x, this.pos.y + yOffset + 4);
    }
  }
}