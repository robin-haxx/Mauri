// ============================================
// GAME UI CLASS
// ============================================
class GameUI {
  constructor(config, terrain, simulation, mauri, game, seasonManager) {
    this.config = config;
    this.terrain = terrain;
    this.simulation = simulation;
    this.mauri = mauri;
    this.game = game;
    this.seasonManager = seasonManager;
    
    this.toolbarY = config.height - 90;
    this.hoveredTool = null;
  }
  
  handleClick(mx, my) {
    let btnX = 20;
    let btnY = this.toolbarY;
    let btnSize = 50;
    let spacing = 60;
    
    let i = 0;
    for (let type in PLACEABLES) {
      let x = btnX + i * spacing;
      if (mx > x && mx < x + btnSize && my > btnY && my < btnY + btnSize) {
        this.game.selectPlaceable(type);
        return true;
      }
      i++;
    }
    
    return false;
  }
  
  render() {
    this.renderMauriBar();
    this.renderSeasonIndicator();
    this.renderMigrationStatus();
    this.renderToolbar();
    this.renderStats();
    this.renderGoals();
    this.renderTime();
    
    if (this.game.selectedPlaceable) {
      this.renderSelectedInfo();
    }
  }
  
  renderMauriBar() {
    let x = 25, y = 25;
    
    fill(CONFIG.col_UI);
    stroke(80, 100, 85);
    strokeWeight(1);
    rect(x - 10, y - 10, 120, 50, 8);
    
    push();
    translate(x + 15, y + 12);
    noFill();
    stroke(120, 200, 140);
    strokeWeight(4);
    arc(0, 0, 16, 16, PI, TWO_PI);
    arc(4, 2, 10, 10, 0, PI);
    pop();
    
    fill(180, 230, 190);
    noStroke();
    textSize(14);
    textAlign(LEFT, TOP);
    text("Mauri", x + 35, y - 2);
    
    // mauri count
    fill(140, 255, 160);
    textSize(26);
    push();
    textFont(GroceryRounded);
    text(Math.floor(this.mauri.mauri), x + 35, y + 12);
    pop();
  }
  
  renderSeasonIndicator() {
    let x = 220, y = 25;
    let season = this.seasonManager.current;
    let progress = this.seasonManager.progress;
    
    fill(CONFIG.col_UI);
    stroke(80, 100, 85);
    strokeWeight(1);
    rect(x - 10, y - 10, 180, 45, 8);
    
    // Season icon and name
    fill(255);
    noStroke();
    textSize(18);
    textAlign(LEFT, CENTER);
    text(season.icon, x, y + 10);
    
    let seasonCol = color(season.color);
    fill(seasonCol);
    textSize(14);
    text(season.name, x + 28, y + 10);
    
    // Progress bar
    fill(60, 70, 65);
    rect(x, y + 22, 155, 6, 3);
    
    // Fill with gradient toward next season
    let nextSeason = this.seasonManager.next;
    let nextCol = color(nextSeason.color);
    let gradientCol = lerpColor(seasonCol, nextCol, progress);
    fill(gradientCol);
    rect(x, y + 22, 155 * progress, 6, 3);
    
    // Next season hint
    fill(150, 160, 155);
    textSize(9);
    textAlign(RIGHT, CENTER);
    text(`Next: ${nextSeason.icon}`, x + 160, y + 10);
  }
  
  renderToolbar() {
    let btnX = 25;
    let btnY = this.toolbarY;
    let btnSize = 50;
    let spacing = 60;
    
    fill(CONFIG.col_UI);
    stroke(70, 90, 75);
    strokeWeight(1);
    rect(btnX - 15, btnY - 15, Object.keys(PLACEABLES).length * spacing + 20, btnSize + 35, 10);
    
    fill(150, 180, 160);
    noStroke();
    textSize(10);
    textAlign(LEFT, TOP);
    text("TOOLS (1-6) • Hold \"shift\" to place more • ESC to cancel", btnX, btnY - 12);
    
    let i = 0;
    for (let type in PLACEABLES) {
      let def = PLACEABLES[type];
      let x = btnX + i * spacing;
      
      let isSelected = this.game.selectedPlaceable === type;
      let canAfford = this.mauri.canAfford(def.cost);
      let isHovered = mouseX > x && mouseX < x + btnSize && mouseY > btnY && mouseY < btnY + btnSize;
      
      if (isSelected) {
        fill(80, 140, 100);
        stroke(140, 220, 160);
        strokeWeight(2);
      } else if (isHovered && canAfford) {
        fill(60, 90, 70);
        stroke(100, 150, 120);
        strokeWeight(1);
      } else {
        fill(canAfford ? color(45, 60, 50) : color(40, 40, 40));
        stroke(canAfford ? color(70, 90, 75) : color(60, 60, 60));
        strokeWeight(1);
      }
      rect(x, btnY, btnSize, btnSize, 8);
      
      push();
      translate(x + btnSize/2, btnY + btnSize/2 - 5);
      
      let iconCol = color(def.color);
      fill(canAfford ? iconCol : color(80, 80, 80));
      noStroke();
      ellipse(0, 0, 24, 24);
      
      fill(255, 255, 255, canAfford ? 220 : 100);
      textSize(14);
      textAlign(CENTER, CENTER);
      
      switch(type) {
        case 'kawakawa': text("🌿", 0, 0); break;
        case 'shelter': text("🌲", 0, 0); break;
        case 'nest': text("🪹", 0, 0); break;
        case 'decoy': text("🌩️", 0, 0); break;
        case 'waterhole': text("💧", 0, 0); break;
        case 'harakeke': text("🌾", 0, 0); break;
      }
      pop();
      
      fill(canAfford ? color(200, 255, 200) : color(255, 150, 150));
      noStroke();
      textSize(10);
      textAlign(CENTER, TOP);
      text(def.cost, x + btnSize/2, btnY + btnSize - 12);
      
      fill(120, 140, 130);
      textSize(9);
      text(i + 1, x + btnSize/2, btnY + btnSize + 3);
      
      if (isHovered) {
        this.renderTooltip(x + btnSize/2, btnY - 10, def);
      }
      
      i++;
    }
  }
  
  renderTooltip(x, y, def) {
    let tw = 150;
    let th = 60;
    
    x = constrain(x - tw/2, 10, this.config.width - tw - 10);
    y = y - th - 5;
    
    fill(CONFIG.col_UI);
    stroke(90, 120, 100);
    strokeWeight(1);
    rect(x, y, tw, th, 6);
    
    fill(200, 230, 210);
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    text(def.name, x + 8, y + 6);
    
    fill(150, 180, 160);
    textSize(10);
    text(def.description, x + 8, y + 22);
    
    fill(120, 150, 130);
    textSize(9);
    text(`Duration: ${(def.duration / 60).toFixed(0)}s`, x + 8, y + 42);
  }
  
  renderStats() {
    let x = this.config.width - 155;
    let y = 30;
    
    let aliveMoas = this.simulation.moas.filter(m => m.alive);
    let migratingCount = aliveMoas.filter(m => m.isMigrating).length;
    let dormantPlants = this.simulation.plants.filter(p => p.dormant).length;
    let totalPlants = this.simulation.plants.length;
    
    let stats = {
      moas: aliveMoas.length,
      migrating: migratingCount,
      eggs: this.simulation.eggs.filter(e => e.alive).length,
      births: this.simulation.stats.births,
      eagles: this.simulation.eagles.length,
      dormantPlants: dormantPlants,
      activePlants: this.simulation.plants.filter(p => p.alive && !p.dormant).length
    };
    
    fill(CONFIG.col_UI);
    stroke(80, 100, 85);
    strokeWeight(1);
    rect(x - 10, y - 10, 145, 120, 8);
    
    fill(180, 210, 190);
    noStroke();
    textSize(11);
    textAlign(LEFT, TOP);
    text("Population", x, y);
    
    textSize(10);
    
    // Moa count
    fill(150, 120, 90);
    ellipse(x + 8, y + 23, 8, 10);
    fill(160, 190, 170);
    text(`Moa: ${stats.moas} / ${this.config.maxMoaPopulation}`, x + 18, y + 18);
    
    // Migrating count
    if (stats.migrating > 0) {
      fill(100, 150, 255);
      text(`  (${stats.migrating} migrating)`, x + 80, y + 18);
    }
    
    // Eggs
    fill(245, 240, 220);
    ellipse(x + 8, y + 40, 6, 8);
    fill(160, 190, 170);
    text(`Eggs: ${stats.eggs}`, x + 18, y + 35);
    text(`Hatched: ${stats.births}`, x + 70, y + 35);
    
    // Eagles
    fill(60, 45, 30);
    ellipse(x + 8, y + 57, 10, 5);
    fill(180, 150, 150);
    text(`Eagles: ${stats.eagles}`, x + 18, y + 52);
    
    // Plants
    fill(100, 160, 100);
    ellipse(x + 8, y + 74, 6, 6);
    fill(160, 190, 170);
    text(`Plants: ${stats.activePlants}`, x + 18, y + 69);
    
    // Dormant plants
    if (stats.dormantPlants > 0) {
      fill(140, 130, 110);
      text(`(${stats.dormantPlants} dormant)`, x + 70, y + 69);
    }
    
    // Preferred elevation indicator
    let pref = this.seasonManager.getPreferredElevation();
    fill(140, 160, 150);
    textSize(9);
    text(`Preferred elev: ${(pref.min * 100).toFixed(0)}-${(pref.max * 100).toFixed(0)}%`, x, y + 90);
    
    // Migration strength
    let migStr = this.seasonManager.getMigrationStrength();
    let migColor = migStr > 0.7 ? color(255, 200, 100) : color(160, 190, 170);
    fill(migColor);
    text(`Migration drive: ${(migStr * 100).toFixed(0)}%`, x, y + 102);
  }
  
  renderGoals() {
    let x = this.config.width - 200;
    let y = 180;
    
    fill(CONFIG.col_UI);
    stroke(80, 100, 85);
    strokeWeight(1);
    rect(x - 10, y - 10, 190, 25 + this.game.goals.length * 18, 8);
    
    fill(180, 210, 190);
    noStroke();
    textSize(11);
    textAlign(LEFT, TOP);
    text("Goals", x, y);
    
    textSize(9);
    for (let i = 0; i < this.game.goals.length; i++) {
      let goal = this.game.goals[i];
      let gy = y + 16 + i * 16;
      
      fill(goal.achieved ? color(100, 200, 120) : color(60, 70, 65));
      stroke(goal.achieved ? color(140, 230, 160) : color(90, 100, 95));
      strokeWeight(1);
      rect(x, gy, 10, 10, 2);
      
      if (goal.achieved) {
        fill(40, 80, 50);
        noStroke();
        textSize(10);
        text("✓", x + 1, gy - 1);
      }
      
      fill(goal.achieved ? color(120, 160, 130) : color(160, 190, 170));
      noStroke();
      textSize(9);
      textAlign(LEFT, TOP);
      text(goal.name, x + 15, gy + 1);
      
      fill(goal.achieved ? color(100, 130, 110) : color(140, 180, 150));
      textAlign(RIGHT, TOP);
      text(`+${goal.reward}`, x + 175, gy + 1);
      textAlign(LEFT, TOP);
    }
  }
  
  renderTime() {
    let seconds = Math.floor(this.game.playTime / 60);
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    
    let timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    fill(CONFIG.col_UI);
    stroke(80, 100, 85);
    strokeWeight(1);
    rect(this.config.width / 2 - 35, 25, 70, 28, 6);
    
    fill(180, 220, 190);
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text(timeStr, this.config.width / 2, 40);
  }

  renderMigrationStatus() {
    const aliveMoas = this.simulation.moas.filter(m => m.alive);
    const hint = this.seasonManager.getMigrationHint(aliveMoas);
    
    if (!hint) return;
    
    let x = 220;
    let y = 80;  // Below the season panel
    
    // Background
    fill(CONFIG.col_UI);
    stroke(80, 100, 85);
    strokeWeight(1);
    rect(x - 10, y - 10, 180, 45, 8);
    
    // Direction arrow
    fill(this.seasonManager.current.color);
    noStroke();
    textSize(18);
    textAlign(LEFT, CENTER);
    text(hint.direction, x, y + 8);
    
    // Status text
    fill(180, 210, 190);
    textSize(11);
    text(hint.text, x + 22, y + 5);
    
    // Detail text
    fill(140, 160, 150);
    textSize(9);
    text(hint.detail, x, y + 22);
    
    // Migrating count
    const migratingCount = aliveMoas.filter(m => m.isMigrating).length;
    if (migratingCount > 0) {
      fill(100, 150, 255);
      textSize(9);
      textAlign(RIGHT, CENTER);
      text(`${migratingCount} migrating`, x + 130, y + 5);
    }
  }
  
  renderSelectedInfo() {
    let def = PLACEABLES[this.game.selectedPlaceable];
    
    fill(50, 70, 60, 230);
    stroke(100, 140, 120);
    strokeWeight(1);
    rect(this.config.width / 2 - 100, 50, 200, 30, 6);
    
    fill(200, 240, 210);
    noStroke();
    textSize(12);
    textAlign(CENTER, CENTER);
    text(`Placing: ${def.name} (${def.cost} mauri)`, this.config.width / 2, 65);
  }
}