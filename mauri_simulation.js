// ============================================
// SIMULATION CLASS
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

    this.activeSpecies = {moa: {}, eagle: []};
    this.otherEntities = {};
    
    this.stats = {
      births: 0,
      deaths: 0,
      starvations: 0,
      birthsBySpecies: {},
      deathsBySpecies: {},
      anySpeciesExtinct: false

    };

    this.activeSpecies = { moa: [], eagle: [] };
    this.otherEntities = {};
    this._speciesStableTimes = {};
    this._speciesLastAlive = {};

    this._speciesStableTimes = {};
    this.speciesLastAlive = {};

    const worldWidth = terrain.mapWidth;
    const worldHeight = terrain.mapHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // Spatial grids with appropriate cell sizes
    this.moaGrid = new SpatialGrid(worldWidth, worldHeight, 60);
    this.eagleGrid = new SpatialGrid(worldWidth, worldHeight, 100);
    this.plantGrid = new SpatialGrid(worldWidth, worldHeight, 50);
    this.placeableGrid = new SpatialGrid(worldWidth, worldHeight, 80);
    this.eggGrid = new SpatialGrid(worldWidth, worldHeight, 40);

    // All grids + entity lists for batch operations
    this._gridEntityPairs = [
      { grid: this.moaGrid, list: this.moas },
      { grid: this.eagleGrid, list: this.eagles },
      { grid: this.plantGrid, list: this.plants },
      { grid: this.placeableGrid, list: this.placeables },
      { grid: this.eggGrid, list: this.eggs }
    ];

    this.dynamicGrids = {};

    // Population cache
    this._cachedAliveMoas = 0;
    this._cachedAliveEggs = 0;
    this._cacheFrame = -1;
    
    // Plant update batching
    this._plantBatchIndex = 0;
    this._plantBatchSize = 50;
    
    // Reusable position vector
    this._tempPos = null;
    
    this.spawnPadding = 30;
    
    // Viewport bounds (updated each frame for culling)
    this._viewLeft = 0;
    this._viewTop = 0;
    this._viewRight = worldWidth;
    this._viewBottom = worldHeight;
    this._viewMargin = 60;
    
    // Cached summary
    this._cachedSummary = {
      moaCount: 0,
      aliveMoas: [],
      migratingCount: 0,
      eggCount: 0,
      eagleCount: 0,
      plantCount: 0,
      dormantPlantCount: 0,
      births: 0,
      deaths: 0
    };
    this._summaryFrame = -1;
    
    // Timers for throttled updates
    this._placeableTimer = 0;
    this._cleanupTimer = 0;
    
    // Nest lookup cache
    this._nestCache = [];
    this._nestCacheValid = false;
  }

  init() {
    this._tempPos = createVector(0, 0);
    this.spawnPlants();
    
    // Check if the level defines a species distribution
    const level = this.game.currentLevel;
    
    if (level && level.initialSpeciesDistribution) {
      // Multi-species spawn: distribute according to weights
      this._spawnDistributedMoas(level.initialSpeciesDistribution);
    } else {
      // Single-species spawn (level 1 style)
      this.spawnMoas(this.config.initialMoaCount, this.config.startingSpecies || null);
    }
    
    this.spawnEagles(this.config.eagleCount);
    
    // Spawn other entity types if the level defines them
    if (level && level.initialEntityCounts) {
      for (const [type, count] of Object.entries(level.initialEntityCounts)) {
        if (type === 'moa' || type === 'eagle') continue; // Already handled
        this._spawnOtherEntities(type, count);
      }
    }
  }

  _spawnDistributedMoas(distribution) {
    const pref = this.seasonManager.getPreferredElevation();
    
    for (const [speciesKey, count] of Object.entries(distribution)) {
      const species = MOA_SPECIES[speciesKey];
      if (!species) {
        console.warn(`Unknown moa species in distribution: ${speciesKey}`);
        continue;
      }
      
      // Use the species' preferred elevation if available, 
      // otherwise fall back to season default
      const minElev = species.preferredElevation?.min || pref.min;
      const maxElev = species.preferredElevation?.max || pref.max;
      
      for (let i = 0; i < count; i++) {
        const pos = this.findWalkablePosition(minElev, maxElev);
        const moa = this._createFromRegistry('moa', speciesKey, pos.x, pos.y, Moa);
        if (moa) this.moas.push(moa);
      }
    }
  }

  _spawnOtherEntities(type, count) {
    // This is a hook for weka, kea, etc.
    // For now, create the list and spawn using registry
    if (!this.otherEntities[type]) {
      this.otherEntities[type] = [];
    }
    
    for (let i = 0; i < count; i++) {
      const pos = this.findWalkablePosition(0.15, 0.65);
      const entity = this._createFromRegistry(type, type, pos.x, pos.y, null);
      
      if (entity) {
        this.otherEntities[type].push(entity);
      } else {
        console.warn(`Could not create entity of type: ${type}. ` +
          `Register it in REGISTRY before the level loads.`);
      }
    }
  }
  
  // ============================================
  // REGISTRY HELPER (eliminates 3x duplication)
  // ============================================
  
  _createFromRegistry(type, speciesKey, x, y, FallbackClass) {
    if (typeof REGISTRY !== 'undefined') {
      if (speciesKey) {
        const entity = REGISTRY.createAnimal(speciesKey, x, y, this.terrain, this.config);
        if (entity) return entity;
      }
      const entity = REGISTRY.createRandomOfType(type, x, y, this.terrain, this.config);
      if (entity) return entity;
    }
    return new FallbackClass(x, y, this.terrain, this.config);
  }
  
  // ============================================
  // VIEWPORT MANAGEMENT
  // ============================================
  
  updateViewport() {
    const invZoom = 1 / this.config.zoom;
    this._viewLeft = 0;
    this._viewTop = 0;
    this._viewRight = this.config.gameAreaWidth * invZoom;
    this._viewBottom = this.config.gameAreaHeight * invZoom;
  }
  
  // ============================================
  // SPAWNING
  // ============================================
  
  setActiveSpecies(species) {
    this.activeSpecies = species;
  
    // Initialize entity lists for non-moa/eagle types
    if (species.other) {
      for (const type of species.other) {
        if (!this.otherEntities[type]) {
          this.otherEntities[type] = [];
        }
      }
    }
    
    // Initialize per-species stats
    for (const key of (species.moa || [])) {
      this.stats.birthsBySpecies[key] = 0;
      this.stats.deathsBySpecies[key] = 0;
      this._speciesStableTimes[key] = 0;
      this._speciesLastAlive[key] = false;
    }
    if (species.other) {
      for (const key of species.other) {
        this._speciesStableTimes[key] = 0;
        this._speciesLastAlive[key] = false;
      }
    }
  }
  
  spawnPlants() {
    const spawnScale = 2;
    const spawnCols = Math.ceil(this.worldWidth / spawnScale);
    const spawnRows = Math.ceil(this.worldHeight / spawnScale);
    const density = this.config.plantDensity;
    const terrain = this.terrain;
    
    for (let row = 0; row < spawnRows; row++) {
      for (let col = 0; col < spawnCols; col++) {
        const x = col * spawnScale + random(-1, 1);
        const y = row * spawnScale + random(-1, 1);
        const biome = terrain.getBiomeAt(x, y);
        
        if (biome.canHavePlants && random() < density) {
          const plantTypes = biome.plantTypes;
          const plantType = plantTypes[(random() * plantTypes.length) | 0];
          this.plants.push(new Plant(x, y, plantType, terrain, biome.key));
        }
      }
    }
  }
  
  spawnMoas(count, speciesKey = null) {
    const pref = this.seasonManager.getPreferredElevation();
    
    for (let i = 0; i < count; i++) {
      const pos = this.findWalkablePosition(pref.min, pref.max);
      const moa = this._createFromRegistry('moa', speciesKey, pos.x, pos.y, Moa);
      if (moa) this.moas.push(moa);
    }
  }

  spawnEagles(count) {
    for (let i = 0; i < count; i++) {
      this.spawnEagle();
    }
    
    // Give non-first eagles a rest period
    for (let i = 1; i < this.eagles.length; i++) {
      const eagle = this.eagles[i];
      eagle.hunger = 0;
      eagle.hunting = false;
      eagle.state = 'patrolling';
      eagle.restTimer = eagle.restDuration || 200;
    }
  }

  spawnEagle(speciesKey = null) {
    let pos = this.findWalkablePosition(0.25, 0.7);
    const eagles = this.eagles;
    const minDistSq = 6400;
    
    for (let attempts = 0; attempts < 20; attempts++) {
      let tooClose = false;
      for (let i = 0, len = eagles.length; i < len; i++) {
        const dx = pos.x - eagles[i].pos.x;
        const dy = pos.y - eagles[i].pos.y;
        if (dx * dx + dy * dy < minDistSq) { tooClose = true; break; }
      }
      if (!tooClose) break;
      pos = this.findWalkablePosition(0.25, 0.7);
    }
    
    // Pick from active eagle species if no specific key given
    if (!speciesKey && this.activeSpecies.eagle.length > 0) {
      const eagleSpecies = this.activeSpecies.eagle;
      speciesKey = eagleSpecies[Math.floor(Math.random() * eagleSpecies.length)];
    }
    
    const eagle = this._createFromRegistry('eagle', speciesKey, pos.x, pos.y, HaastsEagle);
    if (eagle) this.eagles.push(eagle);
  }
  
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
    
    this._tempPos.set(this.worldWidth * 0.5, this.worldHeight * 0.5);
    return this._tempPos;
  }
  
  findWalkablePositionNear(x, y, radius) {
    for (let attempts = 0; attempts < 30; attempts++) {
      const angle = random(TWO_PI);
      const dist = random(radius * 0.3, radius);
      const px = x + cos(angle) * dist;
      const py = y + sin(angle) * dist;
      
      if (px < 0 || px >= this.worldWidth || py < 0 || py >= this.worldHeight) continue;
      
      if (this.terrain.isWalkable(px, py)) {
        this._tempPos.set(px, py);
        return this._tempPos;
      }
    }
    return null;
  }

  handleEagleCatch(eagle, moa, mauri) {
    moa.alive = false;
    if (audioManager) audioManager.playEagleCatch();
    
    eagle.kills++;
    eagle.hunger = Math.max(0, eagle.hunger - 90);
    eagle.vel.mult(0.1);
    eagle.hunting = false;
    eagle.target = null;
    eagle.huntSearchTimer = 0;
    eagle.state = 'resting';
    eagle.restTimer = eagle.restDuration;
    eagle.patrolCenter.set(eagle.pos.x, eagle.pos.y);
    
    // Track per-species death
    const speciesKey = moa.speciesKey || 'unknown';
    if (this.stats.deathsBySpecies[speciesKey] !== undefined) {
      this.stats.deathsBySpecies[speciesKey]++;
    }
    
    const moaCount = this.getMoaPopulation();
    
    if (moaCount > this.eagles.length * 2) {
      const balanceReward = 5;
      mauri.earn(balanceReward, moa.pos.x, moa.pos.y, 'ecosystem_balance');
      this.game.addNotification(`Balanced ecosystem! Eagle fed. +${balanceReward} mauri`, 'info');
    } else {
      this.game.addNotification('Eagle caught a moa - population low!', 'error');
    }

    if (this.game.tutorial) {
      this.game.tutorial.fireEvent(TUTORIAL_EVENTS.MOA_KILLED, { moa, eagle });
    }
    
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
    const placeable = new PlaceableObject(x, y, type, this.terrain, this, this.seasonManager);
    this.placeables.push(placeable);
    if (type === 'nest') this._nestCacheValid = false;
    return placeable;
  }
  
  // ============================================
  // POPULATION COUNTING (Cached)
  // ============================================
  
  _ensurePopulationCache() {
    if (this._cacheFrame === frameCount) return;
    
    let moaCount = 0, eggCount = 0;
    const moas = this.moas;
    for (let i = 0, len = moas.length; i < len; i++) {
      if (moas[i].alive) moaCount++;
    }
    const eggs = this.eggs;
    for (let i = 0, len = eggs.length; i < len; i++) {
      if (eggs[i].alive && !eggs[i].hatched) eggCount++;
    }
    
    this._cachedAliveMoas = moaCount;
    this._cachedAliveEggs = eggCount;
    this._cacheFrame = frameCount;
  }

  // Convenience getters for level 2 goal conditions
  get wekaStableTime() {
    return this._speciesStableTimes['weka'] || 0;
  }

  get keaStableTime() {
    return this._speciesStableTimes['kea'] || 0;
  }

  getSpeciesCount(speciesKey) {
    let count = 0;
    // Check moas
    for (let i = 0; i < this.moas.length; i++) {
      if (this.moas[i].alive && this.moas[i].speciesKey === speciesKey) count++;
    }
    // Check other entities
    if (this.otherEntities[speciesKey]) {
      for (let i = 0; i < this.otherEntities[speciesKey].length; i++) {
        if (this.otherEntities[speciesKey][i].alive) count++;
      }
    }
    return count;
  }
  
  getMoaPopulation() {
    this._ensurePopulationCache();
    return this._cachedAliveMoas;
  }
  
  getAliveEggsCount() {
    this._ensurePopulationCache();
    return this._cachedAliveEggs;
  }
  
  _invalidateCache() {
    this._cacheFrame = -1;
    this._summaryFrame = -1;
  }

  // ============================================
  // SPATIAL GRID UPDATES 
  // ============================================
  
  updateSpatialGrids() {
    // Existing grid updates
    for (const pair of this._gridEntityPairs) {
      pair.grid.clear();
      const list = pair.list;
      const needsAliveCheck = (list !== this.eagles);
      for (let i = 0, len = list.length; i < len; i++) {
        const entity = list[i];
        if (!needsAliveCheck || entity.alive) {
          pair.grid.insert(entity);
        }
      }
    }
    
    // Dynamic grids for other entity types
    for (const [type, list] of Object.entries(this.otherEntities)) {
      if (!this._dynamicGrids[type]) {
        this._dynamicGrids[type] = new SpatialGrid(
          this.worldWidth, this.worldHeight, 60
        );
      }
      const grid = this._dynamicGrids[type];
      grid.clear();
      for (let i = 0; i < list.length; i++) {
        if (list[i].alive) grid.insert(list[i]);
      }
    }
  }
  
  // ============================================
  // SPATIAL QUERY METHODS
  // ============================================
  
  getNearbyMoas(x, y, radius) { return this.moaGrid.getInRadius(x, y, radius); }
  getNearbyEagles(x, y, radius) { return this.eagleGrid.getInRadius(x, y, radius); }
  getNearbyPlants(x, y, radius) { return this.plantGrid.getInRadius(x, y, radius); }
  getNearbyPlaceables(x, y, radius) { return this.placeableGrid.getInRadius(x, y, radius); }
  getNearbyEggs(x, y, radius) { return this.eggGrid.getInRadius(x, y, radius); }
  getClosestPlant(x, y, radius, filter = null) { return this.plantGrid.getClosest(x, y, radius, filter); }
  getClosestMoa(x, y, radius, filter = null) { return this.moaGrid.getClosest(x, y, radius, filter); }
  getClosestPlaceable(x, y, radius, filter = null) { return this.placeableGrid.getClosest(x, y, radius, filter); }
  // Query method for any entity type
  getNearbyOfType(type, x, y, radius) {
    const grid = this._dynamicGrids[type];
    if (!grid) return [];
    return grid.getInRadius(x, y, radius);
  }
  // ============================================
  // NEST CACHE
  // ============================================
  
  _updateNestCache() {
    this._nestCache.length = 0;
    const placeables = this.placeables;
    for (let i = 0, len = placeables.length; i < len; i++) {
      const p = placeables[i];
      if (p.alive && p.type === 'nest') this._nestCache.push(p);
    }
    this._nestCacheValid = true;
  }
  
  // ============================================
  // BOUNDS CHECKING
  // ============================================
  
  isInBounds(x, y, padding = 0) {
    return x >= padding && x < this.worldWidth - padding && 
           y >= padding && y < this.worldHeight - padding;
  }
  
  constrainToBounds(pos, padding = 5) {
    pos.x = constrain(pos.x, padding, this.worldWidth - padding);
    pos.y = constrain(pos.y, padding, this.worldHeight - padding);
    return pos;
  }
  
  // ============================================
  // MAIN UPDATE LOOP
  // ============================================
  
  update(mauri, dt = 1) {
    this.updateSpatialGrids();
    this.updatePlantsBatched(dt);
    
    if (this.seasonManager.justChanged) this.onSeasonChange();
    
    this._placeableTimer += dt;
    if (this._placeableTimer >= 2) {
      this._placeableTimer -= 2;
      this.updatePlaceables(dt);
    }
    
    this.updateEggs(mauri, dt);
    
    const aliveBeforeUpdate = this.getMoaPopulation();
    this.updateMoas(mauri, dt);
    
    this._invalidateCache();
    const aliveAfterUpdate = this.getMoaPopulation();
    const newDeaths = aliveBeforeUpdate - aliveAfterUpdate;
    if (newDeaths > 0) {
      this.stats.starvations += newDeaths;
      this.stats.deaths += newDeaths;
    }
    
    this.updateEagles(mauri, dt);
    
    // Update other entity types
    this._updateOtherEntities(mauri, dt);
    
    this._updateSpeciesStability(dt);
    
    this._cleanupTimer += dt;
    if (this._cleanupTimer >= 512) {
      this._cleanupTimer -= 512;
      this.cleanup();
    }
  }

  _updateOtherEntities(mauri, dt) {
    for (const [type, list] of Object.entries(this.otherEntities)) {
      for (let i = 0; i < list.length; i++) {
        const entity = list[i];
        if (!entity.alive) continue;
        
        // Each entity type must implement behave() and update()
        // just like moa and eagle do
        if (entity.behave) entity.behave(this, mauri, this.seasonManager, dt);
        if (entity.update) entity.update(dt);
        this.constrainToBounds(entity.pos);
      }
    }
  }

  _updateSpeciesStability(dt) {
    // Only needed if the level tracks species stability
    if (Object.keys(this._speciesStableTimes).length === 0) return;
    
    // Count alive moa by species
    const speciesCounts = {};
    const moas = this.moas;
    for (let i = 0, len = moas.length; i < len; i++) {
      const m = moas[i];
      if (!m.alive) continue;
      const key = m.speciesKey || 'unknown';
      speciesCounts[key] = (speciesCounts[key] || 0) + 1;
    }
    
    // Count other entities
    for (const [type, list] of Object.entries(this.otherEntities)) {
      let count = 0;
      for (let i = 0; i < list.length; i++) {
        if (list[i].alive) count++;
      }
      speciesCounts[type] = count;
    }
    
    // Update stability timers
    let anyExtinct = false;
    for (const key of Object.keys(this._speciesStableTimes)) {
      const count = speciesCounts[key] || 0;
      const wasAlive = this._speciesLastAlive[key];
      
      if (count >= 2) {
        // Species is stable (2+ individuals)
        this._speciesStableTimes[key] += dt;
        this._speciesLastAlive[key] = true;
      } else if (count === 0) {
        // Species extinct
        this._speciesStableTimes[key] = 0;
        this._speciesLastAlive[key] = false;
        if (wasAlive) anyExtinct = true;
      } else {
        // Only 1 — not stable but not extinct
        this._speciesLastAlive[key] = true;
        // Don't increment stability timer
      }
    }
    
    this.stats.anySpeciesExtinct = anyExtinct || this.stats.anySpeciesExtinct;
  }

  updatePlantsBatched(dt = 1) {
    const plants = this.plants;
    const len = plants.length;
    if (len === 0) return;
    
    const batchSize = Math.ceil(this._plantBatchSize * Math.min(dt, 2));
    const endIdx = Math.min(this._plantBatchIndex + batchSize, len);
    
    for (let i = this._plantBatchIndex; i < endIdx; i++) {
      plants[i].update(this.seasonManager, dt);
    }
    
    this._plantBatchIndex = endIdx >= len ? 0 : endIdx;
  }

  updatePlaceables(dt = 1) {
    const placeables = this.placeables;
    let writeIdx = 0;
    let nestRemoved = false;
    
    for (let i = 0, len = placeables.length; i < len; i++) {
      const p = placeables[i];
      p.update(dt);
      if (p.alive) {
        placeables[writeIdx++] = p;
      } else if (p.type === 'nest') {
        nestRemoved = true;
      }
    }
    
    if (placeables.length !== writeIdx) {
      placeables.length = writeIdx;
      if (nestRemoved) this._nestCacheValid = false;
    }
  }

  updateEggs(mauri, dt = 1) {
    const eggs = this.eggs;
    if (eggs.length === 0) return;
    
    if (!this._nestCacheValid) this._updateNestCache();
    
    const nests = this._nestCache;
    const config = this.config;
    let writeIdx = 0;
    
    for (let i = 0, len = eggs.length; i < len; i++) {
      const egg = eggs[i];
      
      // Apply nest bonus
      for (let j = 0, nLen = nests.length; j < nLen; j++) {
        const nest = nests[j];
        if (nest.isInRange(egg.pos)) {
          const bonus = nest.def.eggSpeedBonus;
          if (bonus > egg.speedBonus) egg.speedBonus = bonus;
          break;
        }
      }
      
      egg.update(dt);
      
      if (egg.hatched && egg.alive) {
        if (this.getMoaPopulation() < config.maxMoaPopulation) {
          const offspringSpecies = egg.getOffspringSpecies();
          const newMoa = this._createFromRegistry('moa', offspringSpecies, egg.pos.x, egg.pos.y, Moa);
          
          if (newMoa) {
            newMoa.hunger = 35;
            newMoa.size *= 0.6;
            newMoa._cacheSizeMultipliers();
            newMoa.homeRange.set(egg.pos.x, egg.pos.y);
            this.moas.push(newMoa);
            this.stats.births++;
            // Track per-species birth
            const offspringKey = newMoa.speciesKey || offspringSpecies || 'unknown';
            if (this.stats.birthsBySpecies[offspringKey] !== undefined) {
              this.stats.birthsBySpecies[offspringKey]++;
            }
            this._invalidateCache();
            mauri.earn(mauri.onEggHatch, egg.pos.x, egg.pos.y, 'hatch');

            if (this.game.tutorial) {
              this.game.tutorial.fireEvent(TUTORIAL_EVENTS.EGG_HATCHED, { egg, moa: newMoa });
            }
            
            const speciesName = newMoa.species?.displayName || 'moa';
            this.game.addNotification(`A ${speciesName} has hatched!`, 'success');
          }
          
          egg.alive = false;
        }
      }
      
      if (egg.alive) eggs[writeIdx++] = egg;
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
      if (moas[i].alive) moas[writeIdx++] = moas[i];
    }
    if (writeIdx !== moas.length) {
      moas.length = writeIdx;
      this._invalidateCache();
    }
    
    // Other entity cleanup
    for (const [type, list] of Object.entries(this.otherEntities)) {
      let wi = 0;
      for (let i = 0; i < list.length; i++) {
        if (list[i].alive) list[wi++] = list[i];
      }
      list.length = wi;
    }
  }

  onEagleStartHunt(eagle, target) {
    if (this.game.tutorial) {
      this.game.tutorial.fireEvent(TUTORIAL_EVENTS.EAGLE_HUNTING, { eagle, target });
    }
  }
  
  onSeasonChange() {
    const plants = this.plants;
    const seasonManager = this.seasonManager;
    const dormancyChance = seasonManager.getDormancyChance();
    
    let dormantCount = 0, wokeCount = 0;
    
    for (let i = 0, len = plants.length; i < len; i++) {
      const plant = plants[i];
      if (plant.isSpawned) continue;
      
      const shouldBeDormant = seasonManager.shouldPlantBeDormant(plant.elevation, plant.biomeKey);
      
      if (shouldBeDormant && !plant.dormant && plant.alive) {
        if (random() < dormancyChance) { plant.goDormant(); dormantCount++; }
      } else if (!shouldBeDormant && plant.dormant) {
        if (random() < 0.5) { plant.dormant = false; plant.growth = 0.3; wokeCount++; }
      }
    }
    
    if (CONFIG.debugMode) {
      console.log(`Season change: ${dormantCount} plants went dormant, ${wokeCount} plants woke up`);
    }
  }

  // ============================================
  // RENDER (unified viewport culling)
  // ============================================

  render() {
    this.updateViewport();
    
    const vl = this._viewLeft;
    const vt = this._viewTop;
    const vr = this._viewRight;
    const vb = this._viewBottom;
    const m = this._viewMargin;
    
    const inView = (px, py, extra) => 
      px >= vl - m - extra && px <= vr + m + extra &&
      py >= vt - m - extra && py <= vb + m + extra;
    
    const plants = this.plants;
    const placeables = this.placeables;
    const eggs = this.eggs;
    const moas = this.moas;
    const eagles = this.eagles;

    // DRAW ORDER Z INDEX
    
    // Layer 1: Ground plants (not trees — fern is now a tree)
    this._renderFiltered(plants, 0, p => p.type !== 'rimu' && p.type !== 'beech' && p.type !== 'fern', true, inView);
    
    // Layer 2: Placeables (not Storms)
    this._renderFiltered(placeables, 50, p => p.type !== 'Storm', true, inView);
    
    // Layer 3: Eggs
    this._renderFiltered(eggs, 0, null, true, inView);
    
    // Layer 4: Moas (body)
    this._renderFiltered(moas, 0, null, true, inView, 'render');
    
    for (const [type, list] of Object.entries(this.otherEntities)) {
      this._renderFiltered(list, 0, null, true, inView, 'render');
    }

    // Layer 5: Trees (rimu, beech, fern)
    this._renderFiltered(plants, 30, p => p.type === 'rimu' || p.type === 'beech' || p.type === 'fern', true, inView);
    
    // Layer 6: Eagles
    this._renderFiltered(eagles, 30, null, false, inView);
    
    // Layer 6b: Flying other entities (kea)
    // Kea should render above trees like eagles
    if (this.otherEntities.kea) {
      this._renderFiltered(this.otherEntities.kea, 30, null, true, inView);
    }

    // Layer 7: Storms
    this._renderFiltered(placeables, 80, p => p.type === 'Storm', true, inView);
    
    // Layer 8: Moa indicators
    this._renderFiltered(moas, 0, null, true, inView, 'renderIndicators');
    
    if (CONFIG.debugMode && CONFIG.showGridStats) this.renderGridStats();
  }
  
  /**
   * Render entities that pass filter and viewport check.
   * @param {Array} list - entity array
   * @param {number} extraMargin - additional viewport margin
   * @param {Function|null} filter - optional type filter (null = all)
   * @param {boolean} aliveCheck - whether to check .alive
   * @param {Function} inView - viewport test function
   * @param {string} method - render method name (default: 'render')
   */
  _renderFiltered(list, extraMargin, filter, aliveCheck, inView, method = 'render') {
    for (let i = 0, len = list.length; i < len; i++) {
      const e = list[i];
      if (aliveCheck && !e.alive) continue;
      if (filter && !filter(e)) continue;
      if (inView(e.pos.x, e.pos.y, extraMargin)) {
        e[method]();
      }
    }
  }
  
  renderGridStats() {
    const grids = {
      Moas: this.moaGrid, Eagles: this.eagleGrid,
      Plants: this.plantGrid, Placeables: this.placeableGrid
    };
    
    push();
    fill(0, 0, 0, 150);
    noStroke();
    rect(5, 100, 140, 100, 5);
    
    fill(255);
    textSize(8);
    textAlign(LEFT, TOP);
    let y = 105;
    
    text(`World: ${this.worldWidth}x${this.worldHeight}`, 10, y); y += 12;
    
    let maxInCell = 0;
    for (const [name, grid] of Object.entries(grids)) {
      const s = grid.getStats();
      text(`${name}: ${s.totalEntities} in ${s.nonEmptyCells} cells`, 10, y); y += 12;
      maxInCell = Math.max(maxInCell, s.maxInCell);
    }
    text(`Max/cell: ${maxInCell}`, 10, y);
    pop();
  }
  
  // ============================================
  // DATA FOR UI (Cached)
  // ============================================
  
  getSummary() {
    if (this._summaryFrame === frameCount) return this._cachedSummary;
    
    const summary = this._cachedSummary;
    const moas = this.moas;
    const plants = this.plants;
    
    summary.aliveMoas.length = 0;
    let migratingCount = 0;
    
    for (let i = 0, len = moas.length; i < len; i++) {
      const m = moas[i];
      if (m.alive) {
        summary.aliveMoas.push(m);
        if (m.isMigrating) migratingCount++;
      }
    }
    
    summary.moaCount = summary.aliveMoas.length;
    summary.migratingCount = migratingCount;
    
    let activePlants = 0, dormantPlants = 0;
    for (let i = 0, len = plants.length; i < len; i++) {
      const p = plants[i];
      if (p.dormant) dormantPlants++;
      else if (p.alive) activePlants++;
    }
    
    summary.plantCount = activePlants;
    summary.dormantPlantCount = dormantPlants;
    summary.eggCount = this.getAliveEggsCount();
    summary.eagleCount = this.eagles.length;
    summary.births = this.stats.births;
    summary.deaths = this.stats.deaths;
    
    // Other entity counts
    if (!summary.otherCounts) summary.otherCounts = {};
    for (const [type, list] of Object.entries(this.otherEntities)) {
      let count = 0;
      for (let i = 0; i < list.length; i++) {
        if (list[i].alive) count++;
      }
      summary.otherCounts[type] = count;
    }
    
    // Per-species moa breakdown
    if (!summary.moaBySpecies) summary.moaBySpecies = {};
    for (const key of (this.activeSpecies.moa || [])) {
      summary.moaBySpecies[key] = 0;
    }
    for (let i = 0; i < summary.aliveMoas.length; i++) {
      const key = summary.aliveMoas[i].speciesKey;
      if (key && summary.moaBySpecies[key] !== undefined) {
        summary.moaBySpecies[key]++;
      }
    }
    
    this._summaryFrame = frameCount;
    return summary;
  }
}