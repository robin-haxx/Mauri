// ============================================
// SIMULATION CLASS - Optimized with better throttling and batching
// All coordinates are in WORLD space (game area, not canvas)
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

    // World dimensions from terrain (these are the authoritative dimensions)
    const worldWidth = terrain.mapWidth;
    const worldHeight = terrain.mapHeight;
    
    // Store for easy access
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Spatial grids with appropriate cell sizes
    this.moaGrid = new SpatialGrid(worldWidth, worldHeight, 60);
    this.eagleGrid = new SpatialGrid(worldWidth, worldHeight, 100);
    this.plantGrid = new SpatialGrid(worldWidth, worldHeight, 50);
    this.placeableGrid = new SpatialGrid(worldWidth, worldHeight, 80);
    this.eggGrid = new SpatialGrid(worldWidth, worldHeight, 40);

    // Cache for population counts
    this._cachedAliveMoas = 0;
    this._cachedAliveEggs = 0;
    this._cacheFrame = -1;
    
    // Plant update batching
    this._plantBatchIndex = 0;
    this._plantBatchSize = 50; // Update 50 plants per frame
    
    // Reusable position vector
    this._tempPos = null;
    
    // Spawn boundary padding (entities won't spawn within this distance of edge)
    this.spawnPadding = 30;
  }
  
  init() {
    this._tempPos = createVector(0, 0);
    this.spawnPlants();
    const levelSpecies = this.config.startingSpecies || null;
    this.spawnMoas(this.config.initialMoaCount, levelSpecies);
    this.spawnEagles(this.config.eagleCount);
  }
  
  // ============================================
  // SPAWNING
  // ============================================
  
  spawnPlants() {
    // Use a fixed spawn grid regardless of pixelScale
    const spawnScale = 2;  // Always use 2-unit spacing for plants
    const spawnCols = Math.ceil(this.worldWidth / spawnScale);
    const spawnRows = Math.ceil(this.worldHeight / spawnScale);
    
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
    const minDistSq = 6400; // 80^2
    
    while (attempts < 20) {
      let tooClose = false;
      for (let i = 0, len = eagles.length; i < len; i++) {
        const e = eagles[i];
        const dx = pos.x - e.pos.x;
        const dy = pos.y - e.pos.y;
        if (dx * dx + dy * dy < minDistSq) {
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
  
  /**
   * Find a walkable position within elevation range
   * @param {number} minElev - Minimum elevation (0-1)
   * @param {number} maxElev - Maximum elevation (0-1)
   * @returns {p5.Vector} - Position vector (reused, copy if needed to store)
   */
  findWalkablePosition(minElev, maxElev) {
    const terrain = this.terrain;
    const padding = this.spawnPadding;
    const maxX = this.worldWidth - padding;
    const maxY = this.worldHeight - padding;
    
    for (let attempts = 0; attempts < 100; attempts++) {
      const x = padding + random() * (maxX - padding);
      const y = padding + random() * (maxY - padding);
      const elev = terrain.getElevationAt(x, y);
      
      if (elev > minElev && elev < maxElev && terrain.isWalkable(x, y)) {
        this._tempPos.set(x, y);
        return this._tempPos;
      }
    }
    
    // Fallback to center
    this._tempPos.set(this.worldWidth * 0.5, this.worldHeight * 0.5);
    return this._tempPos;
  }
  
  /**
   * Find a walkable position near a given point
   * @param {number} x - Center X
   * @param {number} y - Center Y
   * @param {number} radius - Search radius
   * @returns {p5.Vector|null} - Position vector or null if not found
   */
  findWalkablePositionNear(x, y, radius) {
    for (let attempts = 0; attempts < 30; attempts++) {
      const angle = random(TWO_PI);
      const dist = random(radius * 0.3, radius);
      const px = x + cos(angle) * dist;
      const py = y + sin(angle) * dist;
      
      // Check bounds
      if (px < 0 || px >= this.worldWidth || py < 0 || py >= this.worldHeight) {
        continue;
      }
      
      if (this.terrain.isWalkable(px, py)) {
        this._tempPos.set(px, py);
        return this._tempPos;
      }
    }
    
    return null;
  }

  /**
 * Handle eagle catching a moa - called by eagle when it catches prey
 * @param {HaastsEagle} eagle - The eagle that made the catch
 * @param {Moa} moa - The moa that was caught
 * @param {MauriManager} mauri - The mauri manager
 */
handleEagleCatch(eagle, moa, mauri) {
  // Kill the moa
  moa.alive = false;
  
  // Update eagle state
  eagle.kills++;
  eagle.hunger = Math.max(0, eagle.hunger - 60);
  eagle.vel.mult(0.1);
  eagle.hunting = false;
  eagle.target = null;
  eagle.huntSearchTimer = 0;
  eagle.state = 'resting';
  eagle.restTimer = eagle.restDuration;
  eagle.patrolCenter.set(eagle.pos.x, eagle.pos.y);
  
  // Check for balanced ecosystem reward
  const moaCount = this.getMoaPopulation();
  const eagleCount = this.eagles.length;
  
  // Reward if moa population is at least 2x eagle population
  if (moaCount >= eagleCount * 2) {
    const balanceReward = 5;
    mauri.earn(balanceReward, moa.pos.x, moa.pos.y, 'ecosystem_balance');
    this.game.addNotification(`Balanced ecosystem! Eagle fed. +${balanceReward} mauri`, 'info');
  } else {
    this.game.addNotification('Eagle caught a moa - population low!', 'error');
  }
  
  // Track death
  this.stats.deaths++;
  this._invalidateCache();
}
  
  // ============================================
  // ENTITY CREATION
  // ============================================
  
  addEgg(x, y, parentSpecies = null) {
    const egg = new Egg(x, y, this.terrain, this.config, parentSpecies);
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
  // BOUNDS CHECKING FOR ENTITIES
  // ============================================
  
  /**
   * Check if position is within world bounds with optional padding
   */
  isInBounds(x, y, padding = 0) {
    return x >= padding && 
           x < this.worldWidth - padding && 
           y >= padding && 
           y < this.worldHeight - padding;
  }
  
  /**
   * Constrain position to world bounds
   */
  constrainToBounds(pos, padding = 5) {
    pos.x = constrain(pos.x, padding, this.worldWidth - padding);
    pos.y = constrain(pos.y, padding, this.worldHeight - padding);
    return pos;
  }
  
  // ============================================
  // MAIN UPDATE LOOP
  // ============================================
  
  update(mauri, dt = 1) {
  // Update spatial grids at start of frame
  this.updateSpatialGrids();

  // Update plants in batches (throttled for performance)
  this.updatePlantsBatched(dt);
  
  // Handle season change effects
  if (this.seasonManager.justChanged) {
    this.onSeasonChange();
  }
  
  // Update placeables (accumulate time instead of frame count)
  this._placeableTimer = (this._placeableTimer || 0) + dt;
  if (this._placeableTimer >= 2) {
    this._placeableTimer -= 2;
    this.updatePlaceables(dt);
  }
  
  // Update eggs
  this.updateEggs(mauri, dt);
  
  // Track deaths
  const aliveBeforeUpdate = this.getMoaPopulation();
  
  // Update moas
  this.updateMoas(mauri, dt);
  
  // Recalculate after moa updates
  this._invalidateCache();
  const aliveAfterUpdate = this.getMoaPopulation();
  const newDeaths = aliveBeforeUpdate - aliveAfterUpdate;
  if (newDeaths > 0) {
    this.stats.starvations += newDeaths;
    this.stats.deaths += newDeaths;
  }
  
  // Update eagles
  this.updateEagles(mauri, dt);
  
  // Periodic cleanup (accumulate time)
  this._cleanupTimer = (this._cleanupTimer || 0) + dt;
  if (this._cleanupTimer >= 512) {
    this._cleanupTimer -= 512;
    this.cleanup();
  }
}

updatePlantsBatched(dt = 1) {
  const plants = this.plants;
  const len = plants.length;
  if (len === 0) return;
  
  const seasonManager = this.seasonManager;
  const batchSize = Math.ceil(this._plantBatchSize * dt); // Scale batch size with dt
  const startIdx = this._plantBatchIndex;
  const endIdx = Math.min(startIdx + batchSize, len);
  
  for (let i = startIdx; i < endIdx; i++) {
    plants[i].update(seasonManager, dt);
  }
  
  this._plantBatchIndex = endIdx;
  if (this._plantBatchIndex >= len) {
    this._plantBatchIndex = 0;
  }
}

updatePlaceables(dt = 1) {
  const placeables = this.placeables;
  let writeIdx = 0;
  
  for (let i = 0, len = placeables.length; i < len; i++) {
    const p = placeables[i];
    p.update(dt);
    if (p.alive) {
      placeables[writeIdx++] = p;
    }
  }
  
  placeables.length = writeIdx;
}

updateEggs(mauri, dt = 1) {
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
    
    egg.update(dt);
    
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
          newMoa._cacheSizeMultipliers();
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

updateMoas(mauri, dt = 1) {
  const moas = this.moas;
  const seasonManager = this.seasonManager;
  
  for (let i = 0, len = moas.length; i < len; i++) {
    const moa = moas[i];
    if (moa.alive) {
      moa.behave(this, mauri, seasonManager, dt);
      moa.update(dt);
      
      this.constrainToBounds(moa.pos);
    }
  }
}

updateEagles(mauri, dt = 1) {
  const eagles = this.eagles;
  
  for (let i = 0, len = eagles.length; i < len; i++) {
    const eagle = eagles[i];
    eagle.behave(this, mauri, dt);
    eagle.update(dt);
    
    this.constrainToBounds(eagle.pos);
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

  // ============================================
  // RENDERING
  // ============================================

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
    rect(5, 100, 140, 100, 5);
    
    fill(255);
    textSize(8);
    textAlign(LEFT, TOP);
    let y = 105;
    
    text(`World: ${this.worldWidth}x${this.worldHeight}`, 10, y);
    y += 12;
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
  
  // ============================================
  // DATA FOR UI
  // ============================================
  
  /**
   * Get summary data for UI display
   */
  getSummary() {
    const aliveMoas = [];
    const moas = this.moas;
    for (let i = 0, len = moas.length; i < len; i++) {
      if (moas[i].alive) aliveMoas.push(moas[i]);
    }
    
    return {
      moaCount: aliveMoas.length,
      aliveMoas: aliveMoas,
      migratingCount: aliveMoas.filter(m => m.isMigrating).length,
      eggCount: this.getAliveEggsCount(),
      eagleCount: this.eagles.length,
      plantCount: this.plants.filter(p => p.alive && !p.dormant).length,
      dormantPlantCount: this.plants.filter(p => p.dormant).length,
      births: this.stats.births,
      deaths: this.stats.deaths
    };
  }
}