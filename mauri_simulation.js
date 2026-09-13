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
    // Render-only partition of `plants` by draw layer (type never changes), so
    // render() walks each layer directly instead of scanning the whole plants
    // list twice with a type filter. Kept in sync by addPlant().
    this.groundPlants = [];   // drawn under entities
    this.treePlants = [];     // rimu / beech / fern — drawn above entities
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
      anySpeciesExtinct: false,
      eagleBirths: 0,
      eagleDeaths: 0,
      nestingSitesMade: 0   // player-grown moa nesting sites (running total; see moaNestingWatch)

    };

    this.activeSpecies = { moa: [], eagle: [] };
    this.otherEntities = {};
    this._speciesStableTimes = {};
    this._speciesLastAlive = {};

    // Free Play Mast Year: set true by Game while a bought mast year is live. The
    // fruit-birds (kererū/kōkako) breed harder — a higher flock cap and shorter egg
    // cooldown (mauri_kereru.js._tryReproduce / _hatchFlyerEgg).
    this.mastYear = false;

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

    // Grids are split by whether their entities MOVE.
    //  • Moving grids (moa/eagle/placeable) are rebuilt every frame because the
    //    entities change position. Only live entities are inserted so a dead-
    //    but-not-yet-cleaned entity is never a phantom neighbour/threat.
    //  • Static grids (plants/eggs) never move, so each only needs rebuilding
    //    when its LIST membership changes (a plant/egg added or removed) —
    //    flagged by a per-grid `dirty` bit. This skips an O(plants) rebuild
    //    every frame, which was the dominant per-frame cost on big maps.
    this._movingGridPairs = [
      { grid: this.moaGrid, list: this.moas },
      { grid: this.eagleGrid, list: this.eagles },
      { grid: this.placeableGrid, list: this.placeables }
    ];
    // Independent dirty flags per static grid so frequent egg churn (breeding)
    // never forces a plant-grid rebuild, and vice-versa. `dirty: true` builds
    // each once on the first frame.
    this._plantGridPair = { grid: this.plantGrid, list: this.plants, dirty: true };
    this._eggGridPair   = { grid: this.eggGrid,   list: this.eggs,   dirty: true };
    this._staticGridPairs = [this._plantGridPair, this._eggGridPair];

    this._dynamicGrids = {};   // per-other-entity-type spatial grids (kereru, kokako, ...)

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
    this._eagleRegTimer = 0;
    
    // Nest lookup cache
    this._nestCache = [];
    this._nestCacheValid = false;

    // Nest-disturbance field (LINK 2): decaying points seeded where kea rob moa eggs;
    // moa steer away from them so the flock vacates a raided nesting area. Each entry
    // { x, y, strength }; strength ebbs to 0 and is pruned. Read via disturbanceAt().
    this._disturbances = [];

    // Established moa nesting sites (Kea Raid v2). Seeded in init() when the level
    // opts in (LEVEL_MECHANICS.nestingSites); moa lay at their nearest site.
    this.nestingSites = [];
    this._nestingRecomputeTimer = 0;

    // Player-grown moa nesting sites (endless "moa focus" year goal). While
    // moaNestingWatch is set (by Game._beginFreeplayYear) to { speciesKey, plantType },
    // a dense patch of the moa's favoured plant (lancewood / speargrass) with that moa
    // drawn to it forms a NEW nesting site. Off (null) outside a nesting-goal year.
    this.moaNestingWatch = null;
    this._moaNestTimer = 0;
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

    // Founder sexing bias: the two same-species moa that spawn closest together
    // get a 50% higher chance of being opposite sex (0.5 → 0.75 under random
    // sexing), so the most likely first encounter can lead to a breeding pair.
    this._biasClosestPairSexes();

    this.spawnEagles(this.config.eagleCount);

    // Emergent eagles start as a breeding PAIR: the spawned founder plus one egg
    // of the opposite sex, laid at a crag eyrie and hatching after ~30s.
    if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.emergentEagles) {
      this._spawnFounderEagleEgg();
    }

    // Spawn other entity types if the level defines them
    if (level && level.initialEntityCounts) {
      for (const [type, count] of Object.entries(level.initialEntityCounts)) {
        if (type === 'moa' || type === 'eagle') continue; // Already handled
        this._spawnOtherEntities(type, count);
      }
    }

    this._seedNestingSites();
  }

  // ============================================
  // WORLD-GRID AREA CHANGE (endless "years" camera pan)
  // ============================================
  // The world is one continuous landmass, but only the active area (window) is ever
  // populated. At a year boundary the camera pans to the next area; these two calls
  // unload the old area's trees/fauna and regenerate them on the new ground, carrying
  // the living POPULATIONS across (the flock the player built, relocated to a new
  // country) rather than resetting them. See Game._scrollWorldGrid / _updateWorldGridPan.

  // Snapshot the living populations, then clear every spatial entity. Called as the pan begins.
  unloadAreaEntities() {
    const snap = { moa: {}, eagles: 0, others: {} };
    for (const m of this.moas) if (m.alive) snap.moa[m.speciesKey] = (snap.moa[m.speciesKey] || 0) + 1;
    for (const e of this.eagles) if (e.alive) snap.eagles++;
    for (const type in this.otherEntities) {
      let n = 0; for (const e of this.otherEntities[type]) if (e.alive) n++;
      if (n) snap.others[type] = n;
    }
    this._areaSnapshot = snap;

    this.moas.length = 0;
    this.eagles.length = 0;
    this.eggs.length = 0;
    this.plants.length = 0;
    this.groundPlants.length = 0;
    this.treePlants.length = 0;
    for (const type in this.otherEntities) this.otherEntities[type].length = 0;
    if (this.nestingSites) this.nestingSites.length = 0;
    // Placed items don't travel with the flock — each new area is a fresh country, so
    // the player's placements (caches, shelters, storms …) are cleared too. The placeable
    // grid is a per-frame "moving" grid, so it rebuilds empty on its own next frame.
    this.placeables.length = 0;
    this.markPlantGridDirty();
    this.markEggGridDirty();
  }

  // Regenerate the cast for the newly-framed area: fresh trees for its terrain, and the
  // snapshot populations re-placed on the new ground. Called when the pan settles.
  spawnAreaEntities() {
    const snap = this._areaSnapshot;
    this.spawnPlants();
    this._restoreForestLegacy();   // partly re-grow the forest you cultivated here last visit
    const yp = this._yearStartPops;
    if (yp) {
      // Reset-to-default (+ per-area nudge): populations don't haul across areas — Game
      // computed this year's starting counts (defaults nudged by past performance here),
      // so spawn exactly those on the fresh ground.
      if (yp.moa && Object.keys(yp.moa).length) this._spawnDistributedMoas(yp.moa);
      this._biasClosestPairSexes();
      for (let i = 0; i < (yp.eagles || 0); i++) this.spawnEagle();
      if (yp.others) for (const type in yp.others) this._spawnOtherEntities(type, yp.others[type]);
      this._yearStartPops = null;
    } else if (snap) {
      // Classic carry (non-endless levels): re-place the snapshot populations verbatim.
      if (Object.keys(snap.moa).length) this._spawnDistributedMoas(snap.moa);
      this._biasClosestPairSexes();
      for (let i = 0; i < snap.eagles; i++) this.spawnEagle();
      for (const type in snap.others) this._spawnOtherEntities(type, snap.others[type]);
    }
    this._seedNestingSites();
    this._areaSnapshot = null;
  }

  // Count live podocarp forest trees (rimu/beech/fern) — used for the forest legacy.
  countForestTrees() {
    if (typeof FOREST_TREES === 'undefined') return 0;
    let n = 0;
    for (let i = 0; i < this.plants.length; i++) {
      const p = this.plants[i];
      if (p.alive && FOREST_TREES.has(p.type)) n++;
    }
    return n;
  }

  // Forest legacy: after fresh plants are laid for the new area, grow back a fraction of
  // the forest you had here last visit (Game sets _forestLegacyTarget). A head start on the
  // podocarp refuge for areas you tended — without hauling the whole forest across.
  _restoreForestLegacy() {
    const target = this._forestLegacyTarget || 0;
    this._forestLegacyTarget = 0;
    if (target <= 0 || !this.growForestAt) return;
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    const band = (M.forestContraction && M.forestBand) ||
                 (M.nestingSites && M.nestingSites.forestBand) || { min: 0.36, max: 0.48 };
    let grown = 0;
    for (let tries = 0; tries < target * 4 && grown < target; tries++) {
      const p = this.findWalkablePosition(band.min, band.max);
      if (p && this.growForestAt(p.x, p.y, 40, 99)) grown++;
    }
  }

  // ============================================
  // NESTING SITES (Kea Raid v2) — see mauri_nesting.js
  // ============================================

  // Seed the established moa nests: a few in the downslope forest, the rest across
  // open moa country. Count/placement from LEVEL_MECHANICS.nestingSites; inert on
  // levels that don't opt in.
  _seedNestingSites() {
    this.nestingSites = [];
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    const cfg = M.nestingSites;
    if (!cfg || typeof NestingSite === 'undefined') return;
    // Per-year override (Game._beginFreeplayYear sets this from the schedule): fewer
    // sites and/or a half-map region constraint (the kea year seeds all sites on the
    // left/forest half). Falls back to the level's defaults.
    const ov = this._nestingOverride || null;
    const forestBand = cfg.forestBand || { min: 0.36, max: 0.48 };
    const openBand = cfg.openBand || { min: 0.18, max: 0.34 };
    const radius = cfg.radius ?? 46;
    const forestCount = (ov && ov.forestCount != null) ? ov.forestCount : (cfg.forestCount ?? 2);
    const openCount = (ov && ov.openCount != null) ? ov.openCount : (cfg.openCount ?? 3);
    const region = ov && ov.region;
    const inRegion = (x) => {
      if (region === 'left')  return x < this.worldWidth * 0.5;
      if (region === 'right') return x >= this.worldWidth * 0.5;
      return true;
    };
    // Keep sites from overlapping: a new site must sit at least minGap from every
    // existing one (default 2.6 radii apart, so their raid/egg circles never touch).
    const minGap = cfg.minGap != null ? cfg.minGap : radius * 2.6;
    const minGapSq = minGap * minGap;
    const farEnough = (x, y) => {
      for (let i = 0; i < this.nestingSites.length; i++) {
        const s = this.nestingSites[i];
        const dx = s.pos.x - x, dy = s.pos.y - y;
        if (dx * dx + dy * dy < minGapSq) return false;
      }
      return true;
    };
    const place = (band, habitat) => {
      for (let tries = 0; tries < 24; tries++) {
        const p = this.findWalkablePosition(band.min, band.max);
        if (!p) continue;
        // Reject findWalkablePosition's centre-of-map fallback (and any out-of-band or
        // unwalkable spot): never seed a nest on scree/ice the moa can't nest on. If the
        // area has no room in the band, we simply place fewer sites.
        const e = this.terrain.getElevationAt(p.x, p.y);
        if (e <= band.min || e >= band.max || !this.terrain.isWalkable(p.x, p.y)) continue;
        if (!inRegion(p.x)) continue;
        if (!farEnough(p.x, p.y)) continue;
        this.nestingSites.push(new NestingSite(p.x, p.y, { radius, habitat }));
        return;
      }
    };
    for (let i = 0; i < forestCount; i++) place(forestBand, 'forest');
    for (let i = 0; i < openCount; i++) place(openBand, 'open');
  }

  // Nearest ALIVE nesting site within radius (optionally only those whose habitat a
  // species favours — forest sites for the forest-dwelling little bush moa).
  getNearestNestingSite(x, y, radius = Infinity, speciesKey = null) {
    const forestSpecies = speciesKey === 'little_bush_moa';
    const rSq = radius === Infinity ? Infinity : radius * radius;
    let best = null, bestSq = rSq;
    for (let i = 0; i < this.nestingSites.length; i++) {
      const s = this.nestingSites[i];
      if (!s.alive) continue;
      const dx = s.pos.x - x, dy = s.pos.y - y, dSq = dx * dx + dy * dy;
      // Soft habitat preference: forest moa favour forest sites (feel them nearer).
      const eff = (forestSpecies && s.habitat === 'forest') ? dSq * 0.5 : dSq;
      if (eff < bestSq) { bestSq = eff; best = s; }
    }
    return best;
  }

  // A raid (or any cause) removes a site: consume the eggs inside it, drop the site,
  // and send moa that were nesting here off to another site (they migrate).
  destroyNestingSite(site) {
    if (!site || !site.alive) return 0;
    site.alive = false;
    let eaten = 0;
    const eggs = this.eggs;
    for (let i = 0; i < eggs.length; i++) {
      const e = eggs[i];
      if (!e.alive || e.hatched) continue;
      if (e.offspringType && e.offspringType !== 'moa') continue;
      if (site.isInRange(e.pos)) { e.alive = false; eaten++; }
    }
    if (eaten) this.markEggGridDirty();

    // Displace the moa that were here toward another surviving site (or just away).
    const alt = this.getNearestNestingSite(site.pos.x, site.pos.y, Infinity);
    const R2 = (site.radius * 2.2) * (site.radius * 2.2);
    for (let i = 0; i < this.moas.length; i++) {
      const m = this.moas[i];
      if (!m.alive) continue;
      const dx = m.pos.x - site.pos.x, dy = m.pos.y - site.pos.y;
      if (dx * dx + dy * dy > R2) continue;
      if (alt && alt !== site) {
        m.migrationTarget = alt.pos;
        m.isMigrating = true;
        m.migrationCooldown = 0;
      }
      // Seed a disturbance so they also steer away in the meantime (Link 2 reuse).
      if (m.isPregnant) { m.isPregnant = false; m.pregnancyTimer = 0; }
    }
    this._addDisturbance(site.pos.x, site.pos.y);
    this._invalidateCache();
    return eaten;
  }

  // Refresh each site's egg tally (for the raid indicator) — throttled, cheap.
  _updateNestingSites(dt) {
    if (this.nestingSites.length === 0) return;
    this._nestingRecomputeTimer += dt;
    if (this._nestingRecomputeTimer < 20) return;
    this._nestingRecomputeTimer = 0;
    for (let i = 0; i < this.nestingSites.length; i++) this.nestingSites[i].eggCount = 0;
    const eggs = this.eggs;
    for (let i = 0; i < eggs.length; i++) {
      const e = eggs[i];
      if (!e.alive || e.hatched) continue;
      if (e.offspringType && e.offspringType !== 'moa') continue;
      for (let j = 0; j < this.nestingSites.length; j++) {
        const s = this.nestingSites[j];
        if (s.alive && s.isInRange(e.pos)) { s.eggCount++; break; }
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
        if (moa) {
          // Deterministic founder sexing: alternate F/M within each species so a
          // 2-count seeds 1+1 (not a 50% same-sex pair that forces outcrossing).
          moa.isFemale = (i % 2 === 0);
          this.moas.push(moa);
        }
      }
    }
  }

  // For each species, find the closest pair of founders; if they're same-sex,
  // make them opposite-sex with 50% probability. That takes P(opposite) from
  // p to p + (1-p)/2 — for the random-sexing baseline p = 0.5 that's 0.75,
  // i.e. a 50% higher chance. Sexes are swapped with another founder where
  // possible so the species' overall sex balance is unchanged.
  _biasClosestPairSexes() {
    const bySpecies = {};
    for (let i = 0; i < this.moas.length; i++) {
      const m = this.moas[i];
      if (!m.alive) continue;
      (bySpecies[m.speciesKey] || (bySpecies[m.speciesKey] = [])).push(m);
    }

    for (const key in bySpecies) {
      const list = bySpecies[key];
      if (list.length < 2) continue;

      // Closest pair — founder counts are tiny, O(n²) is fine here.
      let a = null, b = null, bestD2 = Infinity;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const dx = list[i].pos.x - list[j].pos.x;
          const dy = list[i].pos.y - list[j].pos.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) { bestD2 = d2; a = list[i]; b = list[j]; }
        }
      }

      if (!a || a.isFemale !== b.isFemale) continue;  // already opposite
      if (random() >= 0.5) continue;                  // upgrade half the same-sex cases

      // Swap with an opposite-sex founder to keep the balance; flip if none.
      let donor = null;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (m !== a && m !== b && m.isFemale !== a.isFemale) { donor = m; break; }
      }
      if (donor) {
        const s = donor.isFemale;
        donor.isFemale = b.isFemale;
        b.isFemale = s;
      } else {
        b.isFemale = !b.isFemale;
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
          this.addPlant(new Plant(x, y, plantType, terrain, biome.key));
        }
      }
    }
  }
  
  spawnMoas(count, speciesKey = null) {
    const pref = this.seasonManager.getPreferredElevation();
    
    for (let i = 0; i < count; i++) {
      const pos = this.findWalkablePosition(pref.min, pref.max);
      const moa = this._createFromRegistry('moa', speciesKey, pos.x, pos.y, Moa);
      if (moa) {
        // Deterministic founder sexing: alternate F/M so the starting flock is
        // as evenly split as possible (e.g. 6 founders → 3♀/3♂) instead of the
        // lopsided draws random per-moa sexing can give. Matches the
        // multi-species spawn path; _biasClosestPairSexes() preserves the split.
        moa.isFemale = (i % 2 === 0);
        this.moas.push(moa);
      }
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
    if (eagle) {
      if (eagle.emergent) this._assignEagleNest(eagle, pos.x, pos.y);
      this.eagles.push(eagle);
    }
  }

  // Choose a fixed nest site for an emergent eagle: the highest, rockiest walkable
  // spot in a small neighbourhood (a crag eyrie) near the given point. Falls back
  // to the point itself. Also seeds patrolCenter so the bird orbits its nest.
  _assignEagleNest(eagle, x, y) {
    // Home near prey rather than on the barren high crags, so winter glaciation
    // doesn't strand eagles in the empty alps with nothing to hunt. Falls back to
    // the spawn point when no moa are nearby.
    let cx = x, cy = y;
    const prey = this.getClosestMoa(x, y, 600);
    if (prey) {
      const near = this.findWalkablePositionNear(prey.pos.x, prey.pos.y, 70);
      cx = near.x; cy = near.y;
    }
    eagle.nest.set(cx, cy);
    eagle.patrolCenter.set(cx, cy);
  }

  // Highest, rockiest walkable spot near (x,y): a crag/cliff-edge eyrie. Samples
  // several walkable candidates and keeps the one with the greatest elevation, so
  // the site sits at the alpine edge without stranding an egg on impassable ice.
  _findCragEyrie(x, y, radius = 240) {
    let bx = x, by = y, bestE = this.terrain.getElevationAt(x, y);
    for (let i = 0; i < 12; i++) {
      const p = this.findWalkablePositionNear(x, y, radius);
      if (!p) continue;   // no walkable spot this sample (e.g. over water/ice) — skip
      const e = this.terrain.getElevationAt(p.x, p.y);
      if (e > bestE) { bestE = e; bx = p.x; by = p.y; }
    }
    return { x: bx, y: by };
  }

  // Seed the founding eagle pair: one egg of the opposite sex to the spawned
  // founder, at a crag eyrie near it, hatching after ~30s.
  _spawnFounderEagleEgg() {
    const founder = this.eagles.find(e => e.alive);
    if (!founder) return;
    const site = this._findCragEyrie(founder.nest.x, founder.nest.y);
    const egg = this.addEgg(site.x, site.y);
    egg.offspringType = 'eagle';
    egg.parentSpecies = founder.speciesKey || null;
    egg.forcedSex = !founder.isFemale;            // opposite sex to the founder
    egg.isFounderEgg = true;                      // completes the starting pair — not a "new predator"
    const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
    egg.incubationTime = M.startingEagleEggHatchTime ?? 1800;   // ~30s at 60fps
  }

  countAliveEagles() {
    const eagles = this.eagles;
    let n = 0;
    for (let i = 0, len = eagles.length; i < len; i++) {
      if (eagles[i].alive) n++;
    }
    return n;
  }

  // Called by an emergent eagle when it starves. Keeps bookkeeping and player
  // feedback in one place; the dead bird is compacted out in cleanup().
  onEagleDeath(eagle) {
    if (this.stats && this.stats.eagleDeaths !== undefined) this.stats.eagleDeaths++;
    this._invalidateCache();
    if (this.game) {
      this.game.addNotification('A Pouākai starves as prey grows scarce.', 'info');
    }
  }

  // Hatch an eagle egg into a juvenile eagle at the nest (emergent reproduction).
  _hatchEagleEgg(egg) {
    const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
    const cap = M.eagleMaxPopulation ?? 12;
    if (this.countAliveEagles() >= cap) return;

    const eaglet = this._createFromRegistry('eagle', egg.parentSpecies, egg.pos.x, egg.pos.y, HaastsEagle);
    if (!eaglet) return;

    eaglet.emergent = true;
    eaglet.age = 0;
    eaglet.mature = false;
    eaglet.hunger = 30;
    eaglet.wingspan *= 0.6;              // juveniles are smaller until they mature
    eaglet.bodyLength = eaglet.wingspan * 0.45;

    // Sex: honour a forced sex (founding pair), else take the minority sex among
    // living eagles so the population keeps both sexes and stays able to breed.
    if (egg.forcedSex === true || egg.forcedSex === false) {
      eaglet.isFemale = egg.forcedSex;
    } else {
      let _f = 0, _m = 0;
      for (let i = 0; i < this.eagles.length; i++) {
        const e = this.eagles[i];
        if (e.alive) { e.isFemale ? _f++ : _m++; }
      }
      eaglet.isFemale = (_f < _m) ? true : (_m < _f ? false : random() < 0.5);
    }

    this._assignEagleNest(eaglet, egg.pos.x, egg.pos.y);
    this.eagles.push(eaglet);

    if (this.stats && this.stats.eagleBirths !== undefined) this.stats.eagleBirths++;
    if (this.game) this.game.addNotification('A Pouākai eaglet hatches.', 'success');

    // With emergent eagles there is no milestone spawner, so bred hatches are
    // what fire the "A New Predator Arrives" tutorial beat. The founder egg is
    // excluded — it completes the starting pair rather than growing the threat.
    if (!egg.isFounderEgg && this.game && this.game.tutorial) {
      this.game.tutorial.fireEvent(TUTORIAL_EVENTS.EAGLE_SPAWNED, { eagle: eaglet });
    }
  }

  // Hatch a flighted-bird egg (kererū / kōkako / …) into a juvenile in its flock.
  // Emergent reproduction, mirroring _hatchEagleEgg; the bird lives in
  // otherEntities[type]. Cap-guarded by the species' own maxPopulation — an
  // over-cap egg is simply lost rather than lingering.
  // Diminishing per-hatch mauri. With LEVEL_MECHANICS.hatchReward: `fullAmount` (or
  // mauri.onEggHatch) at/under `full`, `reducedAmount` up to `reduced`, then 0 — counted
  // per species when `perSpecies`. Without the knob: the default 10 / half>10 / 0>15 taper.
  _hatchRewardFor(speciesKey, mauri) {
    const t = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.hatchReward) || null;
    if (!t) {
      const pop = this.getSpeciesCount(speciesKey) - 1;
      return pop > 15 ? 0 : pop > 10 ? mauri.onEggHatch * 0.5 : mauri.onEggHatch;
    }
    const pop = (t.perSpecies ? this.getSpeciesCount(speciesKey) : this.getMoaPopulation()) - 1;
    const full = (t.fullAmount != null) ? t.fullAmount : mauri.onEggHatch;
    return pop > t.reduced ? 0 : pop > t.full ? (t.reducedAmount ?? 5) : full;
  }

  _hatchFlyerEgg(egg, type) {
    if (!this.otherEntities[type]) this.otherEntities[type] = [];
    const flock = this.otherEntities[type];

    // Flock cap: read the species config, else the kererū LEVEL_MECHANICS fallback.
    let cap = 16;
    const sp = (typeof REGISTRY !== 'undefined') ? REGISTRY.getSpecies(type) : null;
    if (sp && sp.config && sp.config.maxPopulation != null) cap = sp.config.maxPopulation;
    else if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.kereruMaxPopulation != null) cap = LEVEL_MECHANICS.kereruMaxPopulation;
    // Mast year: the flock is allowed to swell past its usual cap (the boom).
    if (this.mastYear) cap = Math.ceil(cap * ((typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.mastFlockMult) || 1.6));
    if (this.getSpeciesCount(type) >= cap) return;

    const chick = this._createFromRegistry(type, type, egg.pos.x, egg.pos.y, null);
    if (!chick) return;

    chick.age = 0;
    chick.mature = false;
    chick.hunger = 30;

    // Sex-balance the hatchling: take the minority sex of its own living flock so a
    // small population keeps both sexes and stays able to pair within itself.
    let _f = 0, _m = 0;
    for (let i = 0; i < flock.length; i++) {
      const o = flock[i];
      if (o.alive) { o.isFemale ? _f++ : _m++; }
    }
    chick.isFemale = (_f < _m) ? true : (_m < _f ? false : random() < 0.5);

    flock.push(chick);
    this._invalidateCache();

    if (this.stats && this.stats.births !== undefined) this.stats.births++;
    const name = (sp && sp.displayName) || (chick.species && chick.species.displayName) || type;
    if (this.game) this.game.addNotification(`A ${name} has hatched!`, 'success');

    // Small hatch bonus for flighted birds too, when the level opts in (hatchReward.allSpecies).
    const _t = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.hatchReward) || null;
    if (_t && _t.allSpecies && this.game && this.game.mauri) {
      const r = this._hatchRewardFor(type, this.game.mauri);
      if (r > 0) this.game.mauri.earn(r, egg.pos.x, egg.pos.y, 'hatch');
    }
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
    // Protected floor species (e.g. the last Dinornis) can't be taken — the
    // eagle's strike fails and it breaks off.
    if (this.isSpeciesProtected(moa.speciesKey)) {
      eagle.hunting = false;
      eagle.target = null;
      eagle.huntSearchTimer = 0;
      return;
    }
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
    // Emergent birds keep their fixed nest and drift home to digest; the classic
    // controller-driven eagles recentre on the kill so they follow the prey.
    if (!eagle.emergent) {
      eagle.patrolCenter.set(eagle.pos.x, eagle.pos.y);
    } else {
      eagle.patrolCenter.set(eagle.nest.x, eagle.nest.y);
    }
    
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

  // LINK 4 — an eagle takes an adult flighted bird (kea/kākā/kererū/kōkako). Leaner
  // than the moa catch: no mauri reward (this is the loss the player is trying to
  // prevent) and no MOA_KILLED tutorial event. Two floors shield the last few so
  // predation pressures without guaranteeing extinction: the year's dynamic floor
  // (via isSpeciesProtected) AND the bird's own species populationFloor.
  handleEagleCatchFlyer(eagle, prey) {
    const key = prey.speciesKey;
    const ownFloor = (typeof prey._populationFloor === 'function') ? prey._populationFloor() : 0;
    if ((this.isSpeciesProtected && this.isSpeciesProtected(key)) ||
        (ownFloor > 0 && this.getSpeciesCount(key) <= ownFloor)) {
      eagle.hunting = false; eagle.target = null; eagle.huntSearchTimer = 0;
      return;
    }
    prey.alive = false;
    if (audioManager) audioManager.playEagleCatch();

    eagle.kills++;
    const feed = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.eagleFlyerFeed) || 60;
    eagle.hunger = Math.max(0, eagle.hunger - feed);   // a small bird is lighter fare than a moa
    eagle.vel.mult(0.1);
    eagle.hunting = false; eagle.target = null; eagle.huntSearchTimer = 0;
    eagle.state = 'resting'; eagle.restTimer = eagle.restDuration;
    if (eagle.emergent) eagle.patrolCenter.set(eagle.nest.x, eagle.nest.y);
    else eagle.patrolCenter.set(eagle.pos.x, eagle.pos.y);

    const name = (prey.species && prey.species.displayName) || (prey._label) || 'bird';
    if (this.game) this.game.addNotification(`An eagle seized a ${name}!`, 'error');
    this.stats.deaths++;
    this._invalidateCache();
  }
  // ============================================
  // ENTITY CREATION
  // ============================================
  
  addEgg(x, y, parentSpecies = null) {
    const egg = new Egg(x, y, this.terrain, this.config, parentSpecies);
    this.eggs.push(egg);
    this.markEggGridDirty();   // new egg → rebuild the static egg grid
    return egg;
  }

  // LINK 1 — a kea robs a moa nest: destroy the egg and seed a disturbance the moa
  // avoid (LINK 2). Only moa eggs are raidable; other birds' eggs are left alone.
  raidMoaEgg(egg, raider) {
    if (!egg || !egg.alive || egg.hatched) return;
    if (egg.offspringType && egg.offspringType !== 'moa') return;
    egg.alive = false;
    this.markEggGridDirty();
    this._addDisturbance(egg.pos.x, egg.pos.y);
    if (this.stats) this.stats.eggsRaided = (this.stats.eggsRaided || 0) + 1;
    this._invalidateCache();
  }

  // LINK 2 — disturbance field. Seeded by a raid; decays over disturbanceDecaySec.
  _addDisturbance(x, y) {
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    if (!M.moaNestDisturbance) return;
    this._disturbances.push({ x, y, strength: M.disturbancePerRaid ?? 1.0 });
    if (this._disturbances.length > 200) this._disturbances.shift();   // safety cap
  }

  // Summed disturbance at a point (each source falls off linearly to its radius).
  // 0 when the mechanic is off or nothing is near — moa scoring subtracts this.
  disturbanceAt(x, y) {
    const list = this._disturbances;
    if (!list || list.length === 0) return 0;
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    const R = M.disturbanceRadius ?? 75, R2 = R * R;
    let sum = 0;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const dx = d.x - x, dy = d.y - y, dSq = dx * dx + dy * dy;
      if (dSq >= R2) continue;
      sum += d.strength * (1 - Math.sqrt(dSq) / R);
    }
    return sum;
  }

  _decayDisturbances(dt) {
    const list = this._disturbances;
    if (list.length === 0) return;
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    const per = 1 / (((M.disturbanceDecaySec ?? 22) * 60) || 1);   // strength lost per tick
    let wi = 0;
    for (let i = 0; i < list.length; i++) {
      list[i].strength -= per * dt;
      if (list[i].strength > 0.01) list[wi++] = list[i];
    }
    list.length = wi;
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
    const sc = this._speciesCountCache || (this._speciesCountCache = {});
    for (const key in sc) sc[key] = 0;   // reset counts (keep the object)
    const moas = this.moas;
    for (let i = 0, len = moas.length; i < len; i++) {
      const m = moas[i];
      if (m.alive) {
        moaCount++;
        const k = m.speciesKey;
        if (k) sc[k] = (sc[k] || 0) + 1;
      }
    }
    // Other entities (kererū/kōkako/kea/kākā/kākāpō) counted into the per-species map
    // too, so getCachedSpeciesCount / isSpeciesProtected work for them (e.g. the
    // Year-1 kea floor that stops eagles wiping the last kea). They do NOT add to
    // moaCount — that stays a moa-only tally.
    for (const type in this.otherEntities) {
      const list = this.otherEntities[type];
      let n = 0;
      for (let i = 0, l = list.length; i < l; i++) if (list[i].alive) n++;
      sc[type] = n;
    }

    const eggs = this.eggs;
    for (let i = 0, len = eggs.length; i < len; i++) {
      if (eggs[i].alive && !eggs[i].hatched) eggCount++;
    }

    this._cachedAliveMoas = moaCount;
    this._cachedAliveEggs = eggCount;
    this._cacheFrame = frameCount;
  }

  // Per-species alive moa count, cached once per frame (cheap for hot paths like
  // eagle prey selection). Accurate to the last cache rebuild.
  getCachedSpeciesCount(speciesKey) {
    this._ensurePopulationCache();
    return (this._speciesCountCache && this._speciesCountCache[speciesKey]) || 0;
  }

  // A species is "protected" once it has fallen to its configured population floor
  // (LEVEL_MECHANICS.populationFloors) — its remaining members can't be hunted or
  // starved, so the species can never be wiped out below that floor.
  isSpeciesProtected(speciesKey) {
    const staticFloors = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.populationFloors) || null;
    const dynFloors = this.dynamicFloors || null;   // Free Play: this year's protected focus species
    let floor;
    if (staticFloors && staticFloors[speciesKey] !== undefined) floor = staticFloors[speciesKey];
    if (dynFloors && dynFloors[speciesKey] !== undefined) {
      floor = (floor === undefined) ? dynFloors[speciesKey] : Math.max(floor, dynFloors[speciesKey]);
    }
    if (floor === undefined) return false;
    return this.getCachedSpeciesCount(speciesKey) <= floor;
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
    // Moving entities: rebuilt every frame. Only live entities are inserted, so
    // a starved eagle awaiting cleanup is never a phantom threat.
    for (const pair of this._movingGridPairs) {
      pair.grid.clear();
      const list = pair.list;
      for (let i = 0, len = list.length; i < len; i++) {
        const entity = list[i];
        if (entity.alive) {
          pair.grid.insert(entity);
        }
      }
    }

    // Static entities (plants, eggs): positions never change, so rebuild a grid
    // only when its list membership changed (its `dirty` bit). Insert ALL of
    // them — including plants that are momentarily eaten (alive=false) and will
    // regrow — because the entry stays positionally valid and every plant-grid
    // consumer already filters on `.alive`. If we inserted only live plants
    // here, a plant that regrew between rebuilds would be missing from the grid
    // until the next membership change, and foragers couldn't find it.
    for (const pair of this._staticGridPairs) {
      if (!pair.dirty) continue;
      pair.grid.clear();
      const list = pair.list;
      for (let i = 0, len = list.length; i < len; i++) {
        pair.grid.insert(list[i]);
      }
      pair.dirty = false;
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

  // Flag a static grid for a rebuild on the next frame. Call whenever a plant or
  // egg is ADDED or REMOVED from its list. Not needed when a plant is merely
  // eaten or regrows — it stays in the grid and consumers read its live
  // `.alive` state.
  markPlantGridDirty() { this._plantGridPair.dirty = true; }
  markEggGridDirty()   { this._eggGridPair.dirty = true; }

  // Single entry point for adding a plant: keeps the master list, the render
  // partition (ground/tree) and the plant grid all in sync. Use this instead of
  // pushing to `this.plants` directly.
  addPlant(plant) {
    this.plants.push(plant);
    if (FOREST_TREES.has(plant.type)) this.treePlants.push(plant);
    else this.groundPlants.push(plant);
    this.markPlantGridDirty();
  }

  // Plant a forest seedling where a kererū / kōkako dropped a seed — the one runtime
  // path that grows the plant population (see mauri_kereru.js). Cap-guarded and
  // FOREST-ONLY: a seed establishes only on plant-bearing ground whose biome grows a
  // forest tree, never carpets an already-dense stand, and starts as a young recruit
  // that grows in. Returns true if it planted. A level can switch it off with
  // LEVEL_MECHANICS.seedDispersal = false.
  // Kea Raid v2 (Slice B) — CULTIVATE forest: plant a podocarp/beech tree within
  // radius, even where the biome isn't already forest (the player expanding the
  // podocarp forest downslope). Density-gated per spot and capped per patch, so it
  // grows a grove rather than a carpet. Distinct from disperseSeed, which refuses
  // non-forest biomes (that's natural recruitment; this is deliberate planting).
  growForestAt(x, y, radius, patchCap = 8) {
    if (typeof Plant === 'undefined' || typeof FOREST_TREES === 'undefined') return false;
    const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
    const cap = M.maxPlants ?? this.config.maxPlants ?? 1200;
    if (this.plants.length >= cap) return false;

    // Patch cap: stop once this grove already holds enough forest trees.
    const patch = this.getNearbyPlants(x, y, radius);
    let forestN = 0;
    for (let i = 0; i < patch.length; i++) if (patch[i].alive && FOREST_TREES.has(patch[i].type)) forestN++;
    if (forestN >= patchCap) return false;

    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * radius;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      const biome = this.terrain.getBiomeAt(px, py);
      if (!biome || !biome.canHavePlants || !this.terrain.isWalkable(px, py)) continue;
      // Local density gate so trees don't stack.
      const near = this.getNearbyPlants(px, py, 24);
      let n = 0;
      for (let i = 0; i < near.length; i++) if (near[i].alive && FOREST_TREES.has(near[i].type)) n++;
      if (n >= 2) continue;
      const type = Math.random() < 0.6 ? 'rimu' : 'beech';   // podocarp-led
      const seedling = new Plant(px, py, type, this.terrain, biome.key);
      seedling.growth = 0.25;
      this.addPlant(seedling);
      return true;
    }
    return false;
  }

  // "Does this spot read as podocarp forest?" — enough live forest trees within
  // radius. Used for kea perch selection (Slice C) and forest-site formation.
  isForestPatch(x, y, radius = 70, minTrees = 3) {
    if (typeof FOREST_TREES === 'undefined') return false;
    const near = this.getNearbyPlants(x, y, radius);
    let n = 0;
    for (let i = 0; i < near.length; i++) {
      if (near[i].alive && FOREST_TREES.has(near[i].type)) { n++; if (n >= minTrees) return true; }
    }
    return false;
  }

  disperseSeed(x, y) {
    const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
    if (M.seedDispersal === false) return false;

    // Density gate: don't carpet a stand that already holds enough live plants.
    const R = M.disperseDensityRadius ?? 26;
    const maxD = M.disperseDensityMax ?? 3;
    const near = this.getNearbyPlants(x, y, R);
    let n = 0;
    for (let i = 0; i < near.length; i++) if (near[i].alive) n++;
    if (n >= maxD) return false;

    // Must be plant-bearing ground whose biome actually grows a forest tree.
    const biome = this.terrain.getBiomeAt(x, y);
    if (!biome || !biome.canHavePlants || !biome.plantTypes) return false;
    const forestHere = biome.plantTypes.filter(t => FOREST_TREES.has(t));
    if (forestHere.length === 0) return false;

    // Soft total cap so runaway recruitment can't blow the plant budget.
    const cap = M.maxPlants ?? this.config.maxPlants ?? 1200;
    if (this.plants.length >= cap) return false;

    const type = forestHere[(Math.random() * forestHere.length) | 0];
    const seedling = new Plant(x, y, type, this.terrain, biome.key);
    seedling.growth = 0.25;                              // a young recruit — handleGrowth() grows it in
    this.addPlant(seedling);
    return true;
  }

  // ============================================
  // SPATIAL QUERY METHODS
  // ============================================
  
  getNearbyMoas(x, y, radius) { return this.moaGrid.getInRadius(x, y, radius); }
  // Count-only query: returns a number and touches NO shared result buffer, so
  // it's safe to call while a getNearbyMoas() list is still being held (and it's
  // cheaper — no array is built).
  countNearbyMoas(x, y, radius, filter = null) { return this.moaGrid.countInRadius(x, y, radius, filter); }
  getNearbyEagles(x, y, radius) { return this.eagleGrid.getInRadius(x, y, radius); }
  getNearbyPlants(x, y, radius) { return this.plantGrid.getInRadius(x, y, radius); }
  getNearbyPlaceables(x, y, radius) { return this.placeableGrid.getInRadius(x, y, radius); }
  getNearbyEggs(x, y, radius) { return this.eggGrid.getInRadius(x, y, radius); }
  getClosestPlant(x, y, radius, filter = null) { return this.plantGrid.getClosest(x, y, radius, filter); }
  getClosestMoa(x, y, radius, filter = null) { return this.moaGrid.getClosest(x, y, radius, filter); }
  // Nearest un-hatched MOA egg (a moa "nest") — LINK 3, so eagles patrol where moa breed.
  getClosestMoaNest(x, y, radius) {
    return this.eggGrid.getClosest(x, y, radius,
      e => e.alive && !e.hatched && (!e.offspringType || e.offspringType === 'moa'));
  }
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

    // Predator-prey coupling: eagle numbers track the moa population, thinning
    // in the cold seasons and rebuilding in the warm ones. This is the top-down
    // controller — skipped entirely when emergentEagles is on, because then the
    // population arises from individual births (nests) and deaths (starvation).
    if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.eaglePreyCoupling
        && !LEVEL_MECHANICS.emergentEagles) {
      this._eagleRegTimer += dt;
      const interval = LEVEL_MECHANICS.eagleAdjustInterval ?? 240;
      if (this._eagleRegTimer >= interval) {
        this._eagleRegTimer -= interval;
        this.regulateEagles();
      }
    }

    this._cleanupTimer += dt;
    if (this._cleanupTimer >= 512) {
      this._cleanupTimer -= 512;
      this.cleanup();
    }

    this._decayDisturbances(dt);   // LINK 2 — age out raided-nest disturbance
    this._updateNestingSites(dt);  // refresh site egg tallies (raid indicator)
    this._updateMoaNestingFormation(dt);   // grow player nesting sites (moa focus year)
  }

  // Endless "moa focus" year: form a NEW nesting site where the player has grown a
  // patch of the focus moa's favoured plant (lancewood → little bush moa, speargrass →
  // upland moa) and that moa has been drawn in. One site per throttle tick; each counts
  // toward the year's nesting goal (stats.nestingSitesMade). Inert when moaNestingWatch
  // is null (every non-focus year). See Game._beginFreeplayYear.
  _updateMoaNestingFormation(dt) {
    const watch = this.moaNestingWatch;
    if (!watch || typeof NestingSite === 'undefined') return;
    this._moaNestTimer -= dt;
    if (this._moaNestTimer > 0) return;
    this._moaNestTimer = 90;   // ~1.5s between attempts

    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    const nc = M.nestingSites || {};
    const radius = nc.radius ?? 46;
    const minGap = (nc.minGap != null) ? nc.minGap : radius * 2.6;
    const patchRadius = watch.patchRadius ?? 70;
    const patchMinPlants = watch.patchMinPlants ?? 3;
    const drawRadius = watch.drawRadius ?? 160;
    const forestBand = nc.forestBand || { min: 0.36, max: 0.48 };

    const plants = this.plants;
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      if (!p.alive || p.type !== watch.plantType || (p.growth != null && p.growth < 0.5)) continue;

      // A real patch: enough grown favoured plants clustered here.
      const near = this.getNearbyPlants(p.pos.x, p.pos.y, patchRadius);
      let n = 0;
      for (let j = 0; j < near.length; j++) {
        const q = near[j];
        if (q.alive && q.type === watch.plantType && (q.growth == null || q.growth >= 0.5)) n++;
      }
      if (n < patchMinPlants) continue;

      // Don't crowd an existing site.
      if (this.getNearestNestingSite(p.pos.x, p.pos.y, minGap)) continue;

      // The focus moa must actually be drawn to the patch.
      let moaNear = false;
      const moas = this.getNearbyMoas(p.pos.x, p.pos.y, drawRadius);
      for (let j = 0; j < moas.length; j++) {
        if (moas[j].alive && moas[j].speciesKey === watch.speciesKey) { moaNear = true; break; }
      }
      if (!moaNear) continue;

      const e = this.terrain.getElevationAt(p.pos.x, p.pos.y);
      const habitat = (e >= forestBand.min && e < forestBand.max) ? 'forest' : 'open';
      const site = new NestingSite(p.pos.x, p.pos.y, { radius, habitat });
      site.playerMade = true;
      site.forSpecies = watch.speciesKey;
      site.createdCycle = this.game ? this.game.cycle : 0;
      this.nestingSites.push(site);
      this.stats.nestingSitesMade = (this.stats.nestingSitesMade || 0) + 1;
      if (this.game && this.game.addNotification) {
        const name = this.game._freeplaySpeciesName ? this.game._freeplaySpeciesName(watch.speciesKey) : 'moa';
        this.game.addNotification(`The ${name} settle a new nesting site in the grove.`, 'success');
      }
      return;   // one new site per tick
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
        if (egg.offspringType === 'eagle') {
          // Emergent eagle reproduction: hatch a juvenile Pouākai, then consume
          // the egg (over-cap eggs are simply lost rather than lingering).
          this._hatchEagleEgg(egg);
          egg.alive = false;
        } else if (typeof FLYER_TYPES !== 'undefined' && FLYER_TYPES.has(egg.offspringType)) {
          // Emergent flighted-bird reproduction (kererū / kōkako / …): hatch a
          // juvenile into its flock, then consume the egg.
          this._hatchFlyerEgg(egg, egg.offspringType);
          egg.alive = false;
        } else if (this.getMoaPopulation() < config.maxMoaPopulation) {
          const offspringSpecies = egg.getOffspringSpecies();
          const _perSpeciesCap = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.maxPerSpecies) || Infinity;
          if (this.getSpeciesCount(offspringSpecies) >= _perSpeciesCap) {
            eggs[writeIdx++] = egg;   // species at its hard cap — hold this egg until there's room
            continue;
          }
          const newMoa = this._createFromRegistry('moa', offspringSpecies, egg.pos.x, egg.pos.y, Moa);

          if (newMoa) {
            // Sex-balance the hatchling: take the minority sex of its own living
            // species so small populations keep both sexes and stay able to pair
            // within themselves (only fall back to the constructor's coin flip
            // when the species is already balanced).
            let _sf = 0, _sm = 0;
            for (let mi = 0; mi < this.moas.length; mi++) {
              const _m = this.moas[mi];
              if (_m.alive && _m.speciesKey === newMoa.speciesKey) { _m.isFemale ? _sf++ : _sm++; }
            }
            if (_sf < _sm) newMoa.isFemale = true;
            else if (_sm < _sf) newMoa.isFemale = false;

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
            // Diminishing hatch reward. Levels may define their own tiers via
            // LEVEL_MECHANICS.hatchReward = { full, reduced, reducedAmount }:
            // full reward while the TOTAL flock (before this hatch) is at/below
            // `full`, a flat `reducedAmount` up to `reduced`, nothing beyond.
            // Diminishing per-hatch mauri (see _hatchRewardFor).
            const _hatchReward = this._hatchRewardFor(newMoa.speciesKey, mauri);
            if (_hatchReward > 0) mauri.earn(_hatchReward, egg.pos.x, egg.pos.y, 'hatch');

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

    if (writeIdx !== eggs.length) {
      eggs.length = writeIdx;
      this.markEggGridDirty();   // egg(s) hatched/removed → rebuild egg grid
    }
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
      if (!eagle.alive) continue;   // starved emergent birds await cleanup()
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

    // Emergent eagles can starve — compact the list just like the moa list so
    // dead birds stop being drawn, queried, and counted.
    const eagles = this.eagles;
    let eWrite = 0;
    for (let i = 0, len = eagles.length; i < len; i++) {
      if (eagles[i].alive) eagles[eWrite++] = eagles[i];
    }
    if (eWrite !== eagles.length) {
      eagles.length = eWrite;
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

    // Nesting-site cleanup (raided/destroyed sites drop out).
    if (this.nestingSites.length) {
      let wi = 0;
      for (let i = 0; i < this.nestingSites.length; i++) {
        if (this.nestingSites[i].alive) this.nestingSites[wi++] = this.nestingSites[i];
      }
      this.nestingSites.length = wi;
    }
  }

  // ============================================
  // PREDATOR-PREY COUPLING (opt-in per level)
  // ============================================

  regulateEagles() {
    const M = LEVEL_MECHANICS;
    const moa = this.getMoaPopulation();
    const perMoa = M.eaglesPerMoa ?? 0.09;
    const minE = M.minEagles ?? 1, maxE = M.maxEagles ?? 6;
    let target = Math.round(moa * perMoa);
    if (target < minE) target = minE;
    if (target > maxE) target = maxE;

    const season = this.seasonManager.currentKey;
    const n = this.eagles.length;
    // Prey scarce + cold season -> an eagle starves or leaves.
    if (n > target && (season === 'winter' || season === 'autumn')) {
      this._removeWeakestEagle();
    // Prey plentiful + warm season -> an eagle establishes / breeds.
    } else if (n < target && (season === 'spring' || season === 'summer')) {
      this.spawnEagle();
    }
  }

  _removeWeakestEagle() {
    const eagles = this.eagles;
    if (eagles.length <= 1) return;
    // Prefer a resting / non-hunting eagle so we never cut off a live swoop.
    let idx = -1;
    for (let i = 0; i < eagles.length; i++) {
      const e = eagles[i];
      if (!e.hunting && e.state !== 'hunting') { idx = i; break; }
    }
    if (idx < 0) {
      let worst = -Infinity;
      for (let i = 0; i < eagles.length; i++) {
        const h = eagles[i].hunger || 0;
        if (h > worst) { worst = h; idx = i; }
      }
    }
    if (idx >= 0) {
      eagles.splice(idx, 1);
      if (this.game) this.game.addNotification("An eagle leaves as prey grows scarce.", 'info');
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
    
    const placeables = this.placeables;
    const eggs = this.eggs;
    const moas = this.moas;
    const eagles = this.eagles;

    // Fixed-3D: billboard the cast onto the relief terrain and depth-sort it
    // front-to-back. The layered 2D path below is left untouched for 2D mode.
    if (typeof CONFIG !== 'undefined' && CONFIG.view3D &&
        typeof Projection !== 'undefined' && Projection.relief) {
      this._render3D(inView);
      if (CONFIG.debugMode && CONFIG.showGridStats) this.renderGridStats();
      return;
    }

    // DRAW ORDER Z INDEX

    // Layer 0: Nesting sites (ground scrapes, under everything else).
    if (this.nestingSites.length) this._renderFiltered(this.nestingSites, 0, null, true, inView);

    // Layer 1: Ground plants (pre-partitioned — no per-plant type filter)
    this._renderFiltered(this.groundPlants, 0, null, true, inView);

    // Layer 2: Placeables (not Storms)
    this._renderFiltered(placeables, 50, p => p.type !== 'Storm', true, inView);

    // Layer 3: Eggs
    this._renderFiltered(eggs, 0, null, true, inView);

    // Layer 4: Moas (body)
    this._renderFiltered(moas, 0, null, true, inView, 'render');

    // Ground-dwelling other entities render here (below the trees); flighted birds
    // (isFlyer: kererū, kōkako) are held back to a pass above the trees, below.
    for (const [type, list] of Object.entries(this.otherEntities)) {
      this._renderFiltered(list, 0, e => !e.isFlyer, true, inView, 'render');
    }

    // Layer 5: Trees (rimu, beech, fern — pre-partitioned)
    this._renderFiltered(this.treePlants, 30, null, true, inView);

    // Layer 6: Eagles (aliveCheck true so a just-starved bird stops drawing
    // immediately instead of lingering until the next cleanup pass)
    this._renderFiltered(eagles, 30, null, true, inView);

    // Layer 6b: Flighted other entities (kererū, kōkako) — above the trees like the
    // eagles, since they fly over and perch in the canopy.
    for (const [type, list] of Object.entries(this.otherEntities)) {
      this._renderFiltered(list, 30, e => e.isFlyer, true, inView, 'render');
    }

    // Layer 7: Storms
    this._renderFiltered(placeables, 80, p => p.type === 'Storm', true, inView);

    // GL_PORT.md Phase 2: every sprite pass above enqueued GPU quads. Composite the
    // WebGL entity layer HERE — after all sprites, before the indicator over-pass —
    // so hearts/rings (and the HUD, later) stay on top. No-op when GL is off; when
    // on it also drew the shadow/halo discs underneath during the passes above.
    if (typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch._open) {
      GLBatch.composite(drawingContext);
    }

    // Layer 8: Moa indicators
    this._renderFiltered(moas, 0, null, true, inView, 'renderIndicators');

    // Layer 9: Nest-raid hover overlay (tint + success%) — on TOP so foliage never hides it.
    this._renderFiltered(this.nestingSites, 100, s => s._raidHover, true, inView, 'renderRaidOverlay');

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

  // ============================================
  // FIXED-3D RENDER
  // ============================================
  // Each entity draws itself relative to its own pos (sprite + shadow + bars), so
  // wrapping its render in translate(0, dy) lifts the WHOLE entity so its feet sit
  // on the relief — that is the billboard: an upright, unsquashed sprite pinned to
  // the projected ground point (screenX is unchanged in plan-oblique). The cast is
  // then painted back-to-front by projected ground y so nearer things overlap
  // farther ones — the layered 2D order can't express depth once the land tilts.

  _render3D(inView) {
    const P = Projection;
    // Far entities lift UP into the frame by up to LIFT, so widen the cull test.
    const lift = P.LIFT;

    // Ground detail sits under the cast, billboarded but not depth-sorted (it is
    // low and dense; sorting ~1000 tussocks each frame buys nothing visible).
    if (this.nestingSites.length) this._billboardList(this.nestingSites, 0, null, inView, lift, 'render');
    this._billboardList(this.groundPlants, 0, null, inView, lift, 'render');

    // The depth-sorted cast: everything with real height, back-to-front.
    const cast = this._cast || (this._cast = []);
    cast.length = 0;
    this._collectCast(this.placeables, cast, inView, lift, p => p.type !== 'Storm');
    this._collectCast(this.eggs, cast, inView, lift, null);
    this._collectCast(this.moas, cast, inView, lift, null);
    for (const type in this.otherEntities) {
      this._collectCast(this.otherEntities[type], cast, inView, lift, null);
    }
    this._collectCast(this.treePlants, cast, inView, lift, null);
    this._collectCast(this.eagles, cast, inView, lift, null);
    cast.sort(Simulation._castCmp);
    for (let i = 0; i < cast.length; i++) {
      const e = cast[i];
      push();
      translate(0, e._py - e.pos.y);
      e.render();
      pop();
    }

    // Overlays on top: storms, then moa indicators (hunger bars / halos), then the
    // nest-raid hover cue (tint + success%) so it reads above the foliage.
    this._billboardList(this.placeables, 80, p => p.type === 'Storm', inView, lift, 'render');
    this._billboardList(this.moas, 0, null, inView, lift, 'renderIndicators');
    this._billboardList(this.nestingSites, 100, s => s._raidHover, inView, lift, 'renderRaidOverlay');
  }

  // Draw a list billboarded (feet on the relief) in its existing order.
  _billboardList(list, extraMargin, filter, inView, lift, method) {
    const P = Projection;
    for (let i = 0, len = list.length; i < len; i++) {
      const e = list[i];
      if (!e.alive) continue;
      if (filter && !filter(e)) continue;
      if (!inView(e.pos.x, e.pos.y, extraMargin + lift)) continue;
      const elev = this.terrain.getElevationAt(e.pos.x, e.pos.y);
      push();
      translate(0, P.groundY(e.pos.y, elev) - e.pos.y);
      e[method]();
      pop();
    }
  }

  // Push in-view entities onto the cast, tagging each with its projected ground y.
  _collectCast(list, cast, inView, lift, filter) {
    const P = Projection;
    for (let i = 0, len = list.length; i < len; i++) {
      const e = list[i];
      if (!e.alive) continue;
      if (filter && !filter(e)) continue;
      if (!inView(e.pos.x, e.pos.y, 30 + lift)) continue;
      const elev = this.terrain.getElevationAt(e.pos.x, e.pos.y);
      e._py = P.groundY(e.pos.y, elev);
      cast.push(e);
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
    summary.eagleCount = this.countAliveEagles();
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

// Depth comparator for the fixed-3D cast: ascending projected ground y, so
// farther (higher on screen) entities paint first and nearer ones over them.
// Module-level so the per-frame sort allocates no comparator closure.
Simulation._castCmp = (a, b) => a._py - b._py;