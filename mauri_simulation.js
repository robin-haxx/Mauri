// ============================================
// SIMULATION CLASS - Optimized with better throttling and batching
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
    const mapW = terrain.mapWidth;
    const mapH = terrain.mapHeight;
    this.moaGrid = new SpatialGrid(mapW, mapH, 60);
    this.eagleGrid = new SpatialGrid(mapW, mapH, 100);
    this.plantGrid = new SpatialGrid(mapW, mapH, 50);
    this.placeableGrid = new SpatialGrid(mapW, mapH, 80);
    this.eggGrid = new SpatialGrid(mapW, mapH, 40);

    // Cache for population counts
    this._cachedAliveMoas = 0;
    this._cachedAliveEggs = 0;
    this._cacheFrame = -1;
    
    // Plant update batching
    this._plantBatchIndex = 0;
    this._plantBatchSize = 50; // Update 50 plants per frame
    
    // Reusable position vector
    this._tempPos = null;
  }
  
  init() {
    this._tempPos = createVector(0, 0);
    this.spawnPlants();
    const levelSpecies = this.config.startingSpecies || null;
    this.spawnMoas(this.config.initialMoaCount, levelSpecies);
    this.spawnEagles(this.config.eagleCount);
  }
  
spawnPlants() {
  // Use a fixed spawn grid regardless of pixelScale
  const spawnScale = 2;  // Always use 2-unit spacing for plants
  const spawnCols = Math.ceil(this.terrain.mapWidth / spawnScale);
  const spawnRows = Math.ceil(this.terrain.mapHeight / spawnScale);
  
  for (let row = 0; row < spawnRows; row++) {
    for (let col = 0; col < spawnCols; col++) {
      const x = col * spawnScale + random(-1, 1);
      const y = row * spawnScale + random(-1, 1);
      const biome = this.terrain.getBiomeAt(x, y);
      
      if (biome.canHavePlants && random() < this.config.plantDensity) {
        const plantTypes = biome.plantTypes;
        const plantType = plantTypes[(random() * plantTypes.length) | 0];
        this.plants.push(new Plant(x, y, plantType, this.terrain, biome.key));
      }
    }
  }
}
  
  spawnMoas(count, speciesKey = null) {
    const pref = this.seasonManager.getPreferredElevation();
    
    for (let i = 0; i < count; i++) {
      const pos = this.findWalkablePosition(pref.min, pref.max);
      
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
    const eagles = this.eagles;
    
    while (attempts < 20) {
      let tooClose = false;
      for (let i = 0, len = eagles.length; i < len; i++) {
        const e = eagles[i];
        const dx = pos.x - e.pos.x;
        const dy = pos.y - e.pos.y;
        if (dx * dx + dy * dy < 6400) {
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
  
  findWalkablePosition(minElev, maxElev) {
    const terrain = this.terrain;
    const maxX = terrain.mapWidth - 30;
    const maxY = terrain.mapHeight - 30;
    
    for (let attempts = 0; attempts < 100; attempts++) {
      const x = 30 + random() * (maxX - 30);
      const y = 30 + random() * (maxY - 30);
      const elev = terrain.getElevationAt(x, y);
      
      if (elev > minElev && elev < maxElev && terrain.isWalkable(x, y)) {
        this._tempPos.set(x, y);
        return this._tempPos;
      }
    }
    
    this._tempPos.set(terrain.mapWidth * 0.5, terrain.mapHeight * 0.5);
    return this._tempPos;
  }
  
  addEgg(x, y) {
    const egg = new Egg(x, y, this.terrain, this.config);
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
    let moaCount = 0;
    let eggCount = 0;
    
    const moas = this.moas;
    for (let i = 0, len = moas.length; i < len; i++) {
      if (moas[i].alive) moaCount++;
    }
    
    const eggs = this.eggs;
    for (let i = 0, len = eggs.length; i < len; i++) {
      const e = eggs[i];
      if (e.alive && !e.hatched) eggCount++;
    }
    
    this._cachedAliveMoas = moaCount;
    this._cachedAliveEggs = eggCount;
    this._cacheFrame = frameCount;
  }
  
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
    
    // Populate moa grid
    const moas = this.moas;
    const moaGrid = this.moaGrid;
    for (let i = 0, len = moas.length; i < len; i++) {
      const moa = moas[i];
      if (moa.alive) moaGrid.insert(moa);
    }
    
    // Populate eagle grid
    const eagles = this.eagles;
    const eagleGrid = this.eagleGrid;
    for (let i = 0, len = eagles.length; i < len; i++) {
      eagleGrid.insert(eagles[i]);
    }
    
    // Populate plant grid
    const plants = this.plants;
    const plantGrid = this.plantGrid;
    for (let i = 0, len = plants.length; i < len; i++) {
      const plant = plants[i];
      if (plant.alive) plantGrid.insert(plant);
    }
    
    // Populate placeable grid
    const placeables = this.placeables;
    const placeableGrid = this.placeableGrid;
    for (let i = 0, len = placeables.length; i < len; i++) {
      const p = placeables[i];
      if (p.alive) placeableGrid.insert(p);
    }
    
    // Populate egg grid
    const eggs = this.eggs;
    const eggGrid = this.eggGrid;
    for (let i = 0, len = eggs.length; i < len; i++) {
      const egg = eggs[i];
      if (egg.alive) eggGrid.insert(egg);
    }
  }
  
  // ============================================
  // SPATIAL QUERY HELPER METHODS
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
  
    // Update plants in batches (throttled for performance)
    this.updatePlantsBatched();
    
    // Handle season change effects
    if (this.seasonManager.justChanged) {
      this.onSeasonChange();
    }
    
    // Update placeables (every other frame)
    if ((frameCount & 1) === 0) {
      this.updatePlaceables();
    }
    
    // Update eggs
    this.updateEggs(mauri);
    
    // Track deaths
    const aliveBeforeUpdate = this.getMoaPopulation();
    
    // Update moas
    this.updateMoas(mauri);
    
    // Recalculate after moa updates
    this._invalidateCache();
    const aliveAfterUpdate = this.getMoaPopulation();
    const newDeaths = aliveBeforeUpdate - aliveAfterUpdate;
    if (newDeaths > 0) {
      this.stats.starvations += newDeaths;
      this.stats.deaths += newDeaths;
    }
    
    // Update eagles
    this.updateEagles();
    
    // Periodic cleanup
    if ((frameCount & 511) === 0) { // Every ~512 frames
      this.cleanup();
    }
  }
  
  updatePlantsBatched() {
    const plants = this.plants;
    const len = plants.length;
    if (len === 0) return;
    
    const seasonManager = this.seasonManager;
    const batchSize = this._plantBatchSize;
    const startIdx = this._plantBatchIndex;
    const endIdx = Math.min(startIdx + batchSize, len);
    
    for (let i = startIdx; i < endIdx; i++) {
      plants[i].update(seasonManager);
    }
    
    this._plantBatchIndex = endIdx;
    if (this._plantBatchIndex >= len) {
      this._plantBatchIndex = 0;
    }
  }
  
  updatePlaceables() {
    const placeables = this.placeables;
    let writeIdx = 0;
    
    for (let i = 0, len = placeables.length; i < len; i++) {
      const p = placeables[i];
      p.update();
      if (p.alive) {
        placeables[writeIdx++] = p;
      }
    }
    
    placeables.length = writeIdx;
  }
  
  updateEggs(mauri) {
    const eggs = this.eggs;
    const moas = this.moas;
    const config = this.config;
    const game = this.game;
    const terrain = this.terrain;
    
    let writeIdx = 0;
    
    for (let i = 0, len = eggs.length; i < len; i++) {
      const egg = eggs[i];
      
      // Check if egg is in a nest
      const nearbyPlaceables = this.getNearbyPlaceables(egg.pos.x, egg.pos.y, 50);
      for (let j = 0, pLen = nearbyPlaceables.length; j < pLen; j++) {
        const p = nearbyPlaceables[j];
        if (p.alive && p.type === 'nest' && p.isInRange(egg.pos)) {
          const bonus = p.def.eggSpeedBonus;
          if (bonus > egg.speedBonus) egg.speedBonus = bonus;
        }
      }
      
      egg.update();
      
      if (egg.hatched && egg.alive) {
        if (this.getMoaPopulation() < config.maxMoaPopulation) {
          const offspringSpecies = egg.getOffspringSpecies();
          
          let newMoa;
          if (typeof REGISTRY !== 'undefined' && offspringSpecies) {
            newMoa = REGISTRY.createAnimal(offspringSpecies, egg.pos.x, egg.pos.y, terrain, config);
          } else {
            newMoa = new Moa(egg.pos.x, egg.pos.y, terrain, config);
          }
          
          if (newMoa) {
            newMoa.hunger = 35;
            newMoa.size *= 0.6;
            newMoa._cacheSizeMultipliers(); // Recache after size change
            newMoa.homeRange.set(egg.pos.x, egg.pos.y);
            moas.push(newMoa);
            this.stats.births++;
            this._invalidateCache();
            mauri.earn(mauri.onEggHatch, egg.pos.x, egg.pos.y, 'hatch');
            
            const speciesName = newMoa.species?.displayName || 'moa';
            game.addNotification(`A ${speciesName} has hatched!`, 'success');
          }
          
          egg.alive = false;
        }
      }
      
      if (egg.alive) {
        eggs[writeIdx++] = egg;
      }
    }
    
    eggs.length = writeIdx;
  }
  
  updateMoas(mauri) {
    const moas = this.moas;
    const seasonManager = this.seasonManager;
    
    for (let i = 0, len = moas.length; i < len; i++) {
      const moa = moas[i];
      if (moa.alive) {
        moa.behave(this, mauri, seasonManager);
        moa.update();
      }
    }
  }
  
  updateEagles() {
    const eagles = this.eagles;
    
    for (let i = 0, len = eagles.length; i < len; i++) {
      const eagle = eagles[i];
      eagle.behave(this);
      eagle.update();
    }
  }
  
  cleanup() {
    const moas = this.moas;
    let writeIdx = 0;
    
    for (let i = 0, len = moas.length; i < len; i++) {
      if (moas[i].alive) {
        moas[writeIdx++] = moas[i];
      }
    }
    
    if (writeIdx !== moas.length) {
      moas.length = writeIdx;
      this._invalidateCache();
    }
  }
  
  onSeasonChange() {
    const plants = this.plants;
    const seasonManager = this.seasonManager;
    const dormancyChance = seasonManager.getDormancyChance();
    
    let dormantCount = 0;
    let wokeCount = 0;
    
    for (let i = 0, len = plants.length; i < len; i++) {
      const plant = plants[i];
      if (plant.isSpawned) continue;
      
      const shouldBeDormant = seasonManager.shouldPlantBeDormant(
        plant.elevation, 
        plant.biomeKey
      );
      
      if (shouldBeDormant && !plant.dormant && plant.alive) {
        if (random() < dormancyChance) {
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
    const plants = this.plants;
    for (let i = 0, len = plants.length; i < len; i++) {
      plants[i].render();
    }
    
    // Render placeables
    const placeables = this.placeables;
    for (let i = 0, len = placeables.length; i < len; i++) {
      placeables[i].render();
    }
    
    // Render eggs
    const eggs = this.eggs;
    for (let i = 0, len = eggs.length; i < len; i++) {
      eggs[i].render();
    }
    
    // Render moas
    const moas = this.moas;
    for (let i = 0, len = moas.length; i < len; i++) {
      moas[i].render();
    }
    
    // Render eagles
    const eagles = this.eagles;
    for (let i = 0, len = eagles.length; i < len; i++) {
      eagles[i].render();
    }
    
    // Debug grid stats
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
    const maxInCell = Math.max(stats.moas.maxInCell, stats.plants.maxInCell);
    text(`Max/cell: ${maxInCell}`, 10, y);
    
    pop();
  }
}