// mauri_plant.js
class Plant {
  constructor(x, y, type, terrain, biomeKey) {
    this.pos = createVector(x, y);
    this.type = type;
    this.terrain = terrain;
    this.biomeKey = biomeKey;
    this.elevation = terrain.getElevationAt(x, y);
    
    const plantDef = PLANT_TYPES[type];
    this.baseNutrition = plantDef.nutrition;
    this.nutrition = plantDef.nutrition;
    this.maxNutrition = plantDef.nutrition;
    this.baseColor = color(plantDef.color);
    this.color = color(plantDef.color);
    this.size = plantDef.size;
    this.baseGrowthTime = plantDef.growthTime;
    this.growthTime = plantDef.growthTime;
    
    this.alive = true;
    this.dormant = false;  // New: seasonal dormancy
    this.dormantTimer = 0;
    this.regrowthTimer = 0;
    this.growth = 1.0;
    this.seasonalModifier = 1.0;
    
    // Spawned plants (from placeables) don't go dormant
    this.isSpawned = false;
    this.parentPlaceable = null;
    
    // Visual variation
    this.visualOffset = random(-1, 1);
    this.swayPhase = random(TWO_PI);

    if (this.type === 'flax') {
      this.leafHeights = [];
      this.leafBends = [];
      for (let i = 0; i < 7; i++) {
        this.leafHeights.push(0.8 + random(0.2));
        this.leafBends.push(0.15 + random(0.2));
      }
    }
  }
  
  update(seasonManager) {
    // Spawned plants follow their parent
    if (this.isSpawned && this.parentPlaceable) {
      if (!this.parentPlaceable.alive) {
        this.alive = false;
        return;
      }
      // Spawned plants don't go dormant and have boosted growth
      this.seasonalModifier = 1.2;
      this.handleGrowth();
      return;
    }
    
    // Get seasonal modifier for this biome
    this.seasonalModifier = seasonManager.getPlantModifier(this.biomeKey);
    
    // Check for dormancy
    this.checkDormancy(seasonManager);
    
    if (this.dormant) {
      this.handleDormancy(seasonManager);
      return;
    }
    
    // Normal growth
    this.handleGrowth();
    
    // Update color based on health
    this.updateColor();
  }
  
  checkDormancy(seasonManager) {
    // Already dormant - handled elsewhere
    if (this.dormant) return;
    
    // Already dead (eaten) - handled elsewhere
    if (!this.alive) return;
    
    // Check if this plant should go dormant
    if (seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey)) {
      let dormancyChance = seasonManager.getDormancyChance();
      
      // Random check (once per season change)
      if (seasonManager.justChanged && random() < dormancyChance) {
        this.goDormant();
      }
      
      // Also go dormant if modifier is very low
      if (this.seasonalModifier < 0.25 && this.growth > 0.5 && random() < 0.01) {
        this.goDormant();
      }
    }
  }
  
  goDormant() {
    this.dormant = true;
    this.dormantTimer = 0;
    this.growth = max(0.1, this.growth * 0.3);  // Shrink but don't disappear
  }
  
  handleDormancy(seasonManager) {
    this.dormantTimer++;
    
    // Check if we should wake up
    let shouldBeDormant = seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey);
    
    // Wake up if conditions improve
    if (!shouldBeDormant && this.seasonalModifier > 0.5) {
      // Gradual wake up
      if (random() < 0.02) {
        this.dormant = false;
        this.growth = 0.2;  // Start regrowing
      }
    }
    
    // Dormant plants still sway slightly
    this.nutrition = 0;  // Can't eat dormant plants
  }
  
  handleGrowth() {
    if (!this.alive) {
      // Regrowth after being eaten
      let regrowthRate = this.seasonalModifier;
      this.regrowthTimer += regrowthRate;
      this.growthTime = this.baseGrowthTime / max(0.3, this.seasonalModifier);
      
      if (this.regrowthTimer >= this.growthTime) {
        this.alive = true;
        this.growth = 0.3;
        this.regrowthTimer = 0;
      }
    } else if (this.growth < 1.0) {
      // Growing
      let growthRate = 0.002 * this.seasonalModifier;
      this.growth = min(1.0, this.growth + growthRate);
      this.nutrition = this.maxNutrition * this.growth * this.seasonalModifier;
    } else {
      // Fully grown
      this.nutrition = this.maxNutrition * this.seasonalModifier;
    }
    
    this.maxNutrition = this.baseNutrition * this.seasonalModifier;
  }
  
  updateColor() {
    if (this.dormant) {
      // Brown/grey dormant color
      this.color = lerpColor(this.baseColor, color(120, 100, 70), 0.7);
    } else if (this.seasonalModifier < 0.5) {
      // Wilted - brownish
      let wiltAmount = 1 - (this.seasonalModifier * 2);
      this.color = lerpColor(this.baseColor, color(139, 119, 90), wiltAmount * 0.6);
    } else if (this.seasonalModifier > 1.1) {
      // Thriving - more vibrant green
      let thriveAmount = (this.seasonalModifier - 1.0) * 2;
      this.color = lerpColor(this.baseColor, color(60, 180, 60), min(0.4, thriveAmount));
    } else {
      this.color = this.baseColor;
    }
  }
  
  consume() {
    if (this.dormant) return 0;  // Can't eat dormant plants
    
    const nutritionGained = this.nutrition;
    this.alive = false;
    this.growth = 0;
    this.nutrition = 0;
    this.regrowthTimer = 0;
    return nutritionGained;
  }
  
  render() {
    // Don't render if dead (eaten)
    if (!this.alive && !this.dormant) return;
    
    push();
    translate(this.pos.x, this.pos.y);
    
    // Wind sway
    let sway = 0;
    if (!this.dormant) {
      sway = sin(frameCount * 0.02 + this.swayPhase) * 0.05 * this.seasonalModifier;
    }
    rotate(sway);
    
    let displaySize = this.size * this.growth;
    
    // Smaller when dormant
    if (this.dormant) {
      displaySize *= 0.5;
    }
    
    // Shadow
    noStroke();
    fill(0, 0, 0, this.dormant ? 10 : 20);
    ellipse(1, 1, displaySize * 1.2, displaySize * 0.6);
    
    // Plant body
    fill(this.color);
    
    // Alpha based on state
    let alpha = this.dormant ? 150 : 255;
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    
    if (this.type === 'tussock') {
      // Tussock grass - arching blades from central clump
      let numBlades = 12;
      
      // Base clump
      fill(120, 100, 60);
      noStroke();
      ellipse(0, displaySize * 0.05, displaySize * 0.2, displaySize * 0.1);
      
      // Grass blades
      stroke(this.color);
      strokeWeight(displaySize * 0.04);
      noFill();
      
      for (let i = 0; i < numBlades; i++) {
        let angle = map(i, 0, numBlades, -PI * 0.4, PI * 0.4);
        
        // Use sin to vary height deterministically instead of random()
        let h = displaySize * (0.35 + sin(i * 1.7) * 0.1);
        if (this.dormant) h *= 0.6;
        
        let curve = angle * 0.8;
        let tipX = sin(angle) * displaySize * 0.35 + sin(curve) * h * 0.6;
        let tipY = -h;
        
        beginShape();
        vertex(sin(angle) * displaySize * 0.1, 0);
        quadraticVertex(
          sin(angle) * displaySize * 0.25, -h * 0.1,
          tipX, tipY
        );
        endShape();
      }
    } else if (this.type === 'flax') {
      // Harakeke (NZ Flax) - arching sword-like leaves
      let numLeaves = 7;
      
      for (let i = 0; i < numLeaves; i++) {
        let spreadAngle = map(i, 0, numLeaves - 1, -0.5, 0.5);
        
        let h = displaySize * this.leafHeights[i];
        let w = displaySize * 0.07;
        
        if (this.dormant) {
          h *= 0.45;
        }
        
        // Outer leaves arch over more
        let archAmount = abs(spreadAngle) * 1.5 + this.leafBends[i];
        
        push();
        rotate(spreadAngle * 0.7);
        
        // Calculate bend - leaf goes up then arches over
        let bendY = -h * 0.6;
        let bendX = sin(spreadAngle) * h * 0.15;
        let tipX = bendX + sin(archAmount) * h * 0.45;
        let tipY = bendY - cos(archAmount) * h * 0.35;
        
        // Leaf blade
        fill(this.color);
        stroke(red(this.color) - 25, green(this.color) - 20, blue(this.color) - 15);
        strokeWeight(0.5);
        
        beginShape();
        vertex(-w, 0);
        quadraticVertex(-w * 0.8, bendY * 0.5, bendX - w * 0.5, bendY);
        quadraticVertex(bendX - w * 0.2, (bendY + tipY) / 2, tipX, tipY);
        quadraticVertex(bendX + w * 0.2, (bendY + tipY) / 2, bendX + w * 0.5, bendY);
        quadraticVertex(w * 0.8, bendY * 0.5, w, 0);
        endShape(CLOSE);
        
        // Central fold/crease
        stroke(red(this.color) + 25, green(this.color) + 25, blue(this.color) + 15);
        strokeWeight(displaySize * 0.012);
        noFill();
        beginShape();
        vertex(0, -h * 0.05);
        quadraticVertex(bendX * 0.5, bendY * 0.6, bendX, bendY);
        quadraticVertex((bendX + tipX) / 2, (bendY + tipY) / 2 + h * 0.05, tipX, tipY + h * 0.03);
        endShape();
        
        pop();
      }
      
      // Kōrari (flower stalk) - only when not dormant
      if (!this.dormant) {
        let stalkH = displaySize * 1.4;
        
        // Main stalk
        stroke(100, 75, 50);
        strokeWeight(displaySize * 0.04);
        noFill();
        beginShape();
        vertex(0, -displaySize * 0.1);
        quadraticVertex(displaySize * 0.05, -stalkH * 0.5, 0, -stalkH);
        endShape();
        
        // Flower branches with seed pods
        for (let b = 0; b < 5; b++) {
          let by = -stalkH * (0.5 + b * 0.1);
          let side = (b % 2 === 0) ? -1 : 1;
          let bLen = displaySize * (0.25 - b * 0.03);
          
          // Branch
          stroke(100, 75, 50);
          strokeWeight(displaySize * 0.02);
          let branchEndX = side * bLen;
          let branchEndY = by - bLen * 0.3;
          line(0, by, branchEndX, branchEndY);
          
          // Seed pods (dark reddish-brown)
          fill(65, 30, 25);
          noStroke();
          push();
          translate(branchEndX, branchEndY);
          rotate(side * 0.3);
          ellipse(0, 0, displaySize * 0.06, displaySize * 0.12);
          pop();
        }
        
        // Top flower cluster
        fill(75, 35, 30);
        noStroke();
        ellipse(0, -stalkH, displaySize * 0.08, displaySize * 0.14);
        ellipse(displaySize * 0.03, -stalkH + displaySize * 0.05, displaySize * 0.06, displaySize * 0.1);
      }
      
      // Base clump
      fill(65, 75, 40);
      noStroke();
      ellipse(0, displaySize * 0.03, displaySize * 0.22, displaySize * 0.1);
    } else if (this.type === 'fern') {
      // Silver fern / Ponga - fronds with pinnae
      let numFronds = this.dormant ? 3 : 5;
      
      for (let f = 0; f < numFronds; f++) {
        let angle = map(f, 0, numFronds, -PI * 0.4, PI * 0.4);
        let frondLen = displaySize * (0.8 + f % 2 * 0.2);
        
        push();
        rotate(angle);
        
        // Rachis (central stem)
        stroke(red(this.color) - 30, green(this.color) - 20, blue(this.color) - 20);
        strokeWeight(displaySize * 0.03);
        noFill();
        
        beginShape();
        vertex(0, 0);
        quadraticVertex(0, -frondLen * 0.5, sin(angle) * displaySize * 0.1, -frondLen);
        endShape();
        
        // Pinnae (leaflets)
        fill(this.color);
        noStroke();
        let numPinnae = 8;
        
        for (let p = 1; p <= numPinnae; p++) {
          let py = -frondLen * (p / numPinnae) * 0.9;
          let px = sin(angle) * displaySize * 0.1 * (p / numPinnae);
          let pSize = displaySize * 0.15 * (1 - p / numPinnae * 0.5);
          
          // Left and right pinnae
          push();
          translate(px, py);
          
          // Left pinna
          push();
          rotate(-0.3);
          ellipse(-pSize * 0.6, 0, pSize, pSize * 0.3);
          pop();
          
          // Right pinna
          push();
          rotate(0.3);
          ellipse(pSize * 0.6, 0, pSize, pSize * 0.3);
          pop();
          
          pop();
        }
        
        pop();
      }
      
      // Koru (unfurling frond) - iconic NZ symbol
      if (!this.dormant) {
        stroke(red(this.color) - 20, green(this.color) + 15, blue(this.color) - 10);
        strokeWeight(displaySize * 0.05);
        noFill();
        
        push();
        rotate(-0.2);
        arc(displaySize * 0.08, -displaySize * 0.25, displaySize * 0.2, displaySize * 0.2, PI * 0.5, PI * 2);
        pop();
      }
      
      // Base/trunk suggestion
      fill(90, 70, 50);
      noStroke();
      ellipse(0, displaySize * 0.1, displaySize * 0.2, displaySize * 0.15);
    } else if (this.type === 'kawakawa') {
    // Kawakawa (Piper excelsum) - heart-shaped leaves with characteristic holes
    
    let numLeaves = 5;
    
    for (let i = 0; i < numLeaves; i++) {
      let angle = (i / numLeaves) * TWO_PI + 0.2;
      let stemLen = displaySize * 0.3;
      
      push();
      rotate(angle);
      
      // Draw stem
      stroke(75, 110, 50);
      strokeWeight(displaySize * 0.03);
      line(0, 0, stemLen, 0);
      
      translate(stemLen + displaySize * 0.15, 0);
      rotate(HALF_PI); // Leaf angle
      
      let lw = displaySize * 0.32; // leaf width
      let lh = displaySize * 0.38; // leaf height
      
      // Heart-shaped leaf (notch at top/base, point at bottom/tip)
      fill(85, 155, 55);
      stroke(60, 120, 45);
      strokeWeight(1);
      
      beginShape();
      vertex(0, -lh * 0.5); // Top notch (base, where stem attaches)
      bezierVertex(-lw * 0.2, -lh * 0.5, -lw * 0.45, -lh * 0.35, -lw * 0.5, -lh * 0.05); // Left lobe
      bezierVertex(-lw * 0.55, lh * 0.2, -lw * 0.15, lh * 0.4, 0, lh * 0.5); // Down to tip
      bezierVertex(lw * 0.15, lh * 0.4, lw * 0.55, lh * 0.2, lw * 0.5, -lh * 0.05); // Right side up
      bezierVertex(lw * 0.45, -lh * 0.35, lw * 0.2, -lh * 0.5, 0, -lh * 0.5); // Right lobe back to notch
      endShape(CLOSE);
      
      // Central vein
      stroke(55, 110, 40);
      strokeWeight(displaySize * 0.015);
      line(0, -lh * 0.4, 0, lh * 0.45);
      
      // Side veins (curving toward tip)
      strokeWeight(displaySize * 0.008);
      for (let v = 0; v < 3; v++) {
        let vy = -lh * 0.2 + v * lh * 0.22;
        let vx = lw * (0.3 - v * 0.05);
        line(0, vy, -vx, vy + lh * 0.1);
        line(0, vy, vx, vy + lh * 0.1);
      }
      
      // Characteristic holes (kawakawa looper caterpillar damage)
      fill(35, 80, 30, 180);
      noStroke();
      ellipse(-lw * 0.2, lh * 0.1, lw * 0.15, lw * 0.12);
      ellipse(lw * 0.15, -lh * 0.1, lw * 0.1, lw * 0.1);
      
      pop();
    }
    
    // Center node
    fill(90, 75, 55);
    noStroke();
    ellipse(0, 0, displaySize * 0.12, displaySize * 0.12);
  } else {
      // Berries/nuts
      for (let i = 0; i < 4; i++) {
        let angle = i * HALF_PI;
        ellipse(
          cos(angle) * displaySize * 0.3, 
          sin(angle) * displaySize * 0.3, 
          displaySize * 0.5, 
          displaySize * 0.5
        );
      }
    }
    
    // Dormant indicator (small snowflake or sun icon)
    if (this.dormant) {
      fill(200, 200, 200, 180);
      textSize(6);
      textAlign(CENTER, CENTER);
      text(" ᭄᭡", 0, -displaySize);
    }
    
    pop();
  }
}