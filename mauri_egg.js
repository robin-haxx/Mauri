// ============================================
// EGG CLASS - Simplified rendering
// ============================================

// Pre-computed egg colors (avoid creating in render loop)
const EGG_COLORS = {
  base: null,
  stroke: null,
  highlight: null,
  speckle: null,
  crack: null,
  shadow: null,
  barBg: null,
  barStart: null,
  barEnd: null,
  initialized: false,
  
  init() {
    if (this.initialized) return;
    
    this.base = [245, 238, 220];        // Warm off-white
    this.stroke = [200, 195, 180];       // Subtle outline
    this.highlight = [255, 255, 255, 60];
    this.speckle = [180, 170, 150, 100];
    this.crack = [150, 140, 120];
    this.shadow = [0, 0, 0, 20];
    this.barBg = [40, 40, 40, 150];
    this.barStart = [200, 180, 100];     // Yellow-ish
    this.barEnd = [100, 200, 100];       // Green
    
    this.initialized = true;
  }
};

class Egg {
  constructor(x, y, terrain, config) {
    // Initialize colors if needed
    EGG_COLORS.init();
    
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
    
    // Visual - pre-calculate speckle positions
    this.wobblePhase = random(TWO_PI);
    this.size = random(4, 5);
    
    // Pre-compute speckle positions (avoid sin/cos in render)
    this.speckles = [];
    for (let i = 0; i < 5; i++) {
      this.speckles.push({
        x: sin(i * 1.3 + this.wobblePhase) * this.size * 0.3,
        y: cos(i * 1.7 + this.wobblePhase) * this.size * 0.5
      });
    }
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
    
    const px = this.pos.x;
    const py = this.pos.y;
    const progress = this.currentTime / this.incubationTime;
    
    // Calculate wobble
    let wobble = 0;
    if (progress > 0.7) {
      const wobbleIntensity = (progress - 0.7) / 0.3;
      wobble = sin(frameCount * 0.3 + this.wobblePhase) * wobbleIntensity * 0.15;
    }
    
    // Only use push/pop if wobbling
    if (wobble !== 0) {
      push();
      translate(px, py);
      rotate(wobble);
      this._renderEggBody(0, 0, progress);
      pop();
    } else {
      this._renderEggBody(px, py, progress);
    }
    
    // Progress indicator
    if (CONFIG.showHungerBars) {
      this._renderProgressBar(px, py, progress);
    }
  }
  
  _renderEggBody(x, y, progress) {
    const size = this.size;
    const c = EGG_COLORS;
    
    // Shadow
    noStroke();
    fill(c.shadow);
    ellipse(x + 1, y + 1, size * 1.4, size * 0.9);
    
    // Main egg
    fill(c.base);
    stroke(c.stroke);
    strokeWeight(0.5);
    ellipse(x, y, size * 1.3, size * 1.7);
    
    // Highlight
    noStroke();
    fill(c.highlight);
    ellipse(x - size * 0.15, y - size * 0.25, size * 0.5, size * 0.7);
    
    // Speckles (pre-computed positions)
    fill(c.speckle);
    for (let i = 0; i < this.speckles.length; i++) {
      const sp = this.speckles[i];
      ellipse(x + sp.x, y + sp.y, 1.5, 1.5);
    }
    
    // Cracks when close to hatching
    if (progress > 0.85) {
      this._renderCracks(x, y, progress);
    }
  }
  
  _renderCracks(x, y, progress) {
    const size = this.size;
    const crackIntensity = (progress - 0.85) / 0.15;
    
    stroke(EGG_COLORS.crack);
    strokeWeight(0.8);
    noFill();
    
    // Main crack
    beginShape();
    vertex(x, y - size * 0.4);
    vertex(x + size * 0.1 * crackIntensity, y - size * 0.2);
    vertex(x - size * 0.15 * crackIntensity, y);
    vertex(x + size * 0.2 * crackIntensity, y + size * 0.2);
    endShape();
    
    // Secondary crack
    if (crackIntensity > 0.5) {
      beginShape();
      vertex(x - size * 0.2, y - size * 0.3);
      vertex(x - size * 0.3 * crackIntensity, y - size * 0.1);
      vertex(x - size * 0.1 * crackIntensity, y + size * 0.1);
      endShape();
    }
  }
  
  _renderProgressBar(px, py, progress) {
    const barWidth = 12;
    const barHeight = 2;
    const yOffset = -this.size - 4;
    const barX = px - barWidth * 0.5;
    const barY = py + yOffset;
    
    noStroke();
    
    // Background
    fill(EGG_COLORS.barBg);
    rect(barX, barY, barWidth, barHeight, 1);
    
    // Progress fill - interpolate color manually (faster than lerpColor)
    const c = EGG_COLORS;
    const r = c.barStart[0] + (c.barEnd[0] - c.barStart[0]) * progress;
    const g = c.barStart[1] + (c.barEnd[1] - c.barStart[1]) * progress;
    const b = c.barStart[2] + (c.barEnd[2] - c.barStart[2]) * progress;
    
    fill(r, g, b);
    rect(barX, barY, barWidth * progress, barHeight, 1);
    
    // Species indicator (debug only)
    if (CONFIG.debugMode && this.parentSpecies) {
      fill(200, 200, 200, 120);
      textSize(4);
      textAlign(CENTER, TOP);
      text(this.parentSpecies.substring(0, 8), px, barY + 4);
    }
  }
}