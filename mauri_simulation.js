// ============================================
// SIMULATION CLASS - Optimized with Spatial Grids
// ============================================
class Simulation {
  constructor(terrain, config, game, seasonManager) {
    this.terrain = terrain;
    this.config = config;
    this.game = game;
    this.seasonManager = seasonManager;
    this.moas = [];
    this.eagles = [];
    this.plants = [];
    this.eggs = [];
    this.placeables = [];
    
    this.stats = {
      births: 0,
      deaths: 0,
      starvations: 0
    };

    // Spatial grids with appropriate cell sizes
    // Cell size should be roughly equal to the largest typical query radius
    this.moaGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 60);
    this.eagleGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 100);
    this.plantGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 50);
    this.placeableGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 80);
    this.eggGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 40);

    // Cache for population counts to avoid repeated filtering
    this._cachedAliveMoas = 0;
    this._cachedAliveEggs = 0;
    this._cacheFrame = -1;
  }
  
  init() {
    this.spawnPlants();
    const levelSpecies = this.config.startingSpecies || null;
    this.spawnMoas(this.config.initialMoaCount, levelSpecies);
    this.spawnEagles(this.config.eagleCount);
  }
  
  spawnPlants() {
    const scale = this.config.pixelScale;
    for (let row = 0; row < this.terrain.biomeMap.length; row++) {
      for (let col = 0; col < this.terrain.biomeMap[row].length; col++) {
        const biome = this.terrain.biomeMap[row][col];
        if (biome.canHavePlants && random() < this.config.plantDensity) {
          const x = col * scale + random(-scale/2, scale/2);
          const y = row * scale + random(-scale/2, scale/2);
          this.plants.push(new Plant(x, y, random(biome.plantTypes), this.terrain, biome.key));
        }
      }
    }
  }
  
  spawnMoas(count, speciesKey = null) {
    let pref = this.seasonManager.getPreferredElevation();
    
    for (let i = 0; i < count; i++) {
      let pos = this.findWalkablePosition(pref.min, pref.max);
      
      let moa;
      if (speciesKey && typeof REGISTRY !== 'undefined') {
        moa = REGISTRY.createAnimal(speciesKey, pos.x, pos.y, this.terrain, this.config);
      } else if (typeof REGISTRY !== 'undefined') {
        moa = REGISTRY.createRandomOfType('moa', pos.x, pos.y, this.terrain, this.config);
      } else {
        moa = new Moa(pos.x, pos.y, this.terrain, this.config);
      }
      
      if (moa) {
        this.moas.push(moa);
      }
    }
  }

  spawnEagles(count) {
    for (let i = 0; i < count; i++) {
      this.spawnEagle();
    }
  }

  spawnEagle(speciesKey = null) {
    let pos = this.findWalkablePosition(0.25, 0.7);
    let attempts = 0;
    
    while (attempts < 20) {
      let tooClose = false;
      for (let i = 0; i < this.eagles.length; i++) {
        const e = this.eagles[i];
        const dx = pos.x - e.pos.x;
        const dy = pos.y - e.pos.y;
        if (dx * dx + dy * dy < 6400) { // 80^2
          tooClose = true;
          break;
        }
      }
      if (!tooClose) break;
      pos = this.findWalkablePosition(0.25, 0.7);
      attempts++;
    }
    
    let eagle;
    if (speciesKey && typeof REGISTRY !== 'undefined') {
      eagle = REGISTRY.createAnimal(speciesKey, pos.x, pos.y, this.terrain, this.config);
    } else if (typeof REGISTRY !== 'undefined') {
      eagle = REGISTRY.createRandomOfType('eagle', pos.x, pos.y, this.terrain, this.config);
    } else {
      eagle = new HaastsEagle(pos.x, pos.y, this.terrain, this.config);
    }
    
    if (eagle) {
      this.eagles.push(eagle);
    }
  }
  
  findWalkablePosition(minElev = 0.15, maxElev = 0.8) {
    let attempts = 0;
    while (attempts < 100) {
      let x = random(30, this.terrain.mapWidth - 30);
      let y = random(30, this.terrain.mapHeight - 30);
      let elev = this.terrain.getElevationAt(x, y);
      if (elev > minElev && elev < maxElev && this.terrain.isWalkable(x, y)) {
        return createVector(x, y);
      }
      attempts++;
    }
    return createVector(this.terrain.mapWidth / 2, this.terrain.mapHeight / 2);
  }
  
  addEgg(x, y) {
    let egg = new Egg(x, y, this.terrain, this.config);
    this.eggs.push(egg);
    return egg;
  }
  
  addPlaceable(x, y, type) {
    const placeable = new PlaceableObject(
      x, y, type, 
      this.terrain, 
      this,
      this.seasonManager
    );
    this.placeables.push(placeable);
    return placeable;
  }
  
  // ============================================
  // POPULATION COUNTING (Cached)
  // ============================================
  
  getMoaPopulation() {
    if (this._cacheFrame !== frameCount) {
      this._updatePopulationCache();
    }
    return this._cachedAliveMoas;
  }
  
  getAliveEggsCount() {
    if (this._cacheFrame !== frameCount) {
      this._updatePopulationCache();
    }
    return this._cachedAliveEggs;
  }
  
  _updatePopulationCache() {
    this._cachedAliveMoas = 0;
    this._cachedAliveEggs = 0;
    
    for (let i = 0; i < this.moas.length; i++) {
      if (this.moas[i].alive) this._cachedAliveMoas++;
    }
    for (let i = 0; i < this.eggs.length; i++) {
      if (this.eggs[i].alive && !this.eggs[i].hatched) this._cachedAliveEggs++;
    }
    
    this._cacheFrame = frameCount;
  }
  
  // Invalidate cache when population changes
  _invalidateCache() {
    this._cacheFrame = -1;
  }

  // ============================================
  // SPATIAL GRID UPDATES
  // ============================================
  
  updateSpatialGrids() {
    // Clear all grids
    this.moaGrid.clear();
    this.eagleGrid.clear();
    this.plantGrid.clear();
    this.placeableGrid.clear();
    this.eggGrid.clear();
    
    // Populate moa grid (only alive moas)
    for (let i = 0; i < this.moas.length; i++) {
      const moa = this.moas[i];
      if (moa.alive) {
        this.moaGrid.insert(moa);
      }
    }
    
    // Populate eagle grid
    for (let i = 0; i < this.eagles.length; i++) {
      this.eagleGrid.insert(this.eagles[i]);
    }
    
    // Populate plant grid (only alive plants)
    for (let i = 0; i < this.plants.length; i++) {
      const plant = this.plants[i];
      if (plant.alive) {
        this.plantGrid.insert(plant);
      }
    }
    
    // Populate placeable grid (only alive placeables)
    for (let i = 0; i < this.placeables.length; i++) {
      const p = this.placeables[i];
      if (p.alive) {
        this.placeableGrid.insert(p);
      }
    }
    
    // Populate egg grid
    for (let i = 0; i < this.eggs.length; i++) {
      const egg = this.eggs[i];
      if (egg.alive) {
        this.eggGrid.insert(egg);
      }
    }
  }
  
  // ============================================
  // SPATIAL QUERY HELPER METHODS
  // These are called by entities to find nearby objects
  // ============================================
  
  getNearbyMoas(x, y, radius) {
    return this.moaGrid.getInRadius(x, y, radius);
  }
  
  getNearbyEagles(x, y, radius) {
    return this.eagleGrid.getInRadius(x, y, radius);
  }
  
  getNearbyPlants(x, y, radius) {
    return this.plantGrid.getInRadius(x, y, radius);
  }
  
  getNearbyPlaceables(x, y, radius) {
    return this.placeableGrid.getInRadius(x, y, radius);
  }
  
  getNearbyEggs(x, y, radius) {
    return this.eggGrid.getInRadius(x, y, radius);
  }
  
  getClosestPlant(x, y, radius, filter = null) {
    return this.plantGrid.getClosest(x, y, radius, filter);
  }
  
  getClosestMoa(x, y, radius, filter = null) {
    return this.moaGrid.getClosest(x, y, radius, filter);
  }
  
  getClosestPlaceable(x, y, radius, filter = null) {
    return this.placeableGrid.getClosest(x, y, radius, filter);
  }
  
  // ============================================
  // MAIN UPDATE LOOP
  // ============================================
  
  update(mauri) {
    // Update spatial grids at start of frame
    this.updateSpatialGrids();
  
    // Update plants with seasonal effects (throttled for performance)
    if (frameCount % 3 === 0) {
      for (let i = 0; i < this.plants.length; i++) {
        this.plants[i].update(this.seasonManager);
      }
    }
    
    // Handle season change effects
    if (this.seasonManager.justChanged) {
      this.onSeasonChange();
    }
    
    // Update placeables (throttled)
    if (frameCount % 2 === 0) {
      for (let i = 0; i < this.placeables.length; i++) {
        this.placeables[i].update();
      }
      // Remove dead placeables
      this.placeables = this.placeables.filter(p => p.alive);
    }
    
    // Update eggs
    for (let i = 0; i < this.eggs.length; i++) {
      const egg = this.eggs[i];
      
      // Check if egg is in a nest using spatial grid
      const nearbyPlaceables = this.getNearbyPlaceables(egg.pos.x, egg.pos.y, 50);
      for (let j = 0; j < nearbyPlaceables.length; j++) {
        const p = nearbyPlaceables[j];
        if (p.alive && p.type === 'nest' && p.isInRange(egg.pos)) {
          egg.speedBonus = Math.max(egg.speedBonus, p.def.eggSpeedBonus);
        }
      }
      
      egg.update();
      
      if (egg.hatched && egg.alive) {
        if (this.getMoaPopulation() < this.config.maxMoaPopulation) {
          const offspringSpecies = egg.getOffspringSpecies();
          
          let newMoa;
          if (typeof REGISTRY !== 'undefined' && offspringSpecies) {
            newMoa = REGISTRY.createAnimal(offspringSpecies, egg.pos.x, egg.pos.y, this.terrain, this.config);
          } else {
            newMoa = new Moa(egg.pos.x, egg.pos.y, this.terrain, this.config);
          }
          
          if (newMoa) {
            newMoa.hunger = 35;
            newMoa.size = newMoa.size * 0.6;
            newMoa.homeRange = egg.pos.copy();
            this.moas.push(newMoa);
            this.stats.births++;
            this._invalidateCache();
            mauri.earn(mauri.onEggHatch, egg.pos.x, egg.pos.y, 'hatch');
            
            const speciesName = newMoa.species?.displayName || 'moa';
            this.game.addNotification(`A ${speciesName} has hatched!`, 'success');
          }
          
          egg.alive = false;
        }
      }
    }
    this.eggs = this.eggs.filter(e => e.alive);
    
    // Track deaths
    let aliveBeforeUpdate = this.getMoaPopulation();
    
    // Update moas - pass simulation reference for spatial queries
    for (let i = 0; i < this.moas.length; i++) {
      const moa = this.moas[i];
      if (moa.alive) {
        moa.behave(this, mauri, this.seasonManager);
        moa.update();
      }
    }
    
    // Recalculate after moa updates
    this._invalidateCache();
    let aliveAfterUpdate = this.getMoaPopulation();
    let newDeaths = aliveBeforeUpdate - aliveAfterUpdate;
    if (newDeaths > 0) {
      this.stats.starvations += newDeaths;
      this.stats.deaths += newDeaths;
    }
    
    // Update eagles - pass simulation reference for spatial queries
    for (let i = 0; i < this.eagles.length; i++) {
      const eagle = this.eagles[i];
      eagle.behave(this);
      eagle.update();
    }
    
    // Periodic cleanup of dead moas from array
    if (frameCount % 600 === 0) {
      const beforeLength = this.moas.length;
      this.moas = this.moas.filter(m => m.alive);
      if (this.moas.length !== beforeLength) {
        this._invalidateCache();
      }
    }
  }
  
  onSeasonChange() {
    let dormantCount = 0;
    let wokeCount = 0;
    
    for (let i = 0; i < this.plants.length; i++) {
      const plant = this.plants[i];
      if (plant.isSpawned) continue;
      
      let shouldBeDormant = this.seasonManager.shouldPlantBeDormant(
        plant.elevation, 
        plant.biomeKey
      );
      
      if (shouldBeDormant && !plant.dormant && plant.alive) {
        if (random() < this.seasonManager.getDormancyChance()) {
          plant.goDormant();
          dormantCount++;
        }
      } else if (!shouldBeDormant && plant.dormant) {
        if (random() < 0.5) {
          plant.dormant = false;
          plant.growth = 0.3;
          wokeCount++;
        }
      }
    }
    
    if (CONFIG.debugMode) {
      console.log(`Season change: ${dormantCount} plants went dormant, ${wokeCount} plants woke up`);
    }
  }

  render() {
    // Render plants
    for (let i = 0; i < this.plants.length; i++) {
      this.plants[i].render();
    }
    
    // Render placeables
    for (let i = 0; i < this.placeables.length; i++) {
      this.placeables[i].render();
    }
    
    // Render eggs
    for (let i = 0; i < this.eggs.length; i++) {
      this.eggs[i].render();
    }
    
    // Render moas
    for (let i = 0; i < this.moas.length; i++) {
      this.moas[i].render();
    }
    
    // Render eagles
    for (let i = 0; i < this.eagles.length; i++) {
      this.eagles[i].render();
    }
    
    // Debug: render spatial grid stats
    if (CONFIG.debugMode && CONFIG.showGridStats) {
      this.renderGridStats();
    }
  }
  
  renderGridStats() {
    const stats = {
      moas: this.moaGrid.getStats(),
      eagles: this.eagleGrid.getStats(),
      plants: this.plantGrid.getStats(),
      placeables: this.placeableGrid.getStats()
    };
    
    push();
    fill(0, 0, 0, 150);
    noStroke();
    rect(5, 100, 120, 80, 5);
    
    fill(255);
    textSize(8);
    textAlign(LEFT, TOP);
    let y = 105;
    
    text(`Moas: ${stats.moas.totalEntities} in ${stats.moas.nonEmptyCells} cells`, 10, y);
    y += 12;
    text(`Eagles: ${stats.eagles.totalEntities} in ${stats.eagles.nonEmptyCells} cells`, 10, y);
    y += 12;
    text(`Plants: ${stats.plants.totalEntities} in ${stats.plants.nonEmptyCells} cells`, 10, y);
    y += 12;
    text(`Placeables: ${stats.placeables.totalEntities} in ${stats.placeables.nonEmptyCells} cells`, 10, y);
    y += 12;
    text(`Max/cell: ${Math.max(stats.moas.maxInCell, stats.plants.maxInCell)}`, 10, y);
    
    pop();
  }
}