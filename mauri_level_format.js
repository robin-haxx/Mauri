// ============================================
// LEVEL FORMAT & REGISTRY
// ============================================

const LEVEL_REGISTRY = {
  _levels: {},
  _order: [],
  
  register(levelDef) {
    if (!levelDef.id) {
      console.error('Level missing id:', levelDef);
      return;
    }
    this._levels[levelDef.id] = levelDef;
    if (!this._order.includes(levelDef.id)) {
      this._order.push(levelDef.id);
    }
  },
  
  get(id) {
    return this._levels[id] || null;
  },
  
  getAll() {
    return this._order.map(id => this._levels[id]);
  },
  
  getUnlocked(progress) {
    return this.getAll().filter(level => {
      if (!level.unlockCondition) return true;
      return level.unlockCondition(progress);
    });
  },
  
  getFirst() {
    return this._levels[this._order[0]] || null;
  },
  
  getNext(currentId) {
    const idx = this._order.indexOf(currentId);
    if (idx === -1 || idx >= this._order.length - 1) return null;
    return this._levels[this._order[idx + 1]];
  },
  
  validate(levelDef) {
    const issues = [];
    const required = [
      'id', 'name', 'terrain', 'biomes', 'species',
      'startingSpecies', 'initialEntityCounts', 'economy',
      'goals', 'availablePlaceables', 'menu'
    ];
    
    for (const field of required) {
      if (!(field in levelDef)) {
        issues.push(`Missing required field: ${field}`);
      }
    }
    
    // Validate species references exist in MOA_SPECIES / EAGLE_SPECIES
    if (levelDef.species) {
      for (const key of (levelDef.species.moa || [])) {
        if (!MOA_SPECIES[key]) issues.push(`Unknown moa species: ${key}`);
      }
      for (const key of (levelDef.species.eagle || [])) {
        if (!EAGLE_SPECIES[key]) issues.push(`Unknown eagle species: ${key}`);
      }
    }
    
    // Validate biome plant references
    if (levelDef.biomes) {
      for (const [biomeKey, biome] of Object.entries(levelDef.biomes)) {
        if (biome.plantTypes) {
          for (const pt of biome.plantTypes) {
            if (!PLANT_TYPES[pt]) issues.push(`Biome ${biomeKey} references unknown plant: ${pt}`);
          }
        }
      }
    }
    
    // Validate placeable references
    if (levelDef.availablePlaceables) {
      for (const key of Object.keys(levelDef.availablePlaceables)) {
        if (!PLACEABLES[key]) issues.push(`Unknown placeable: ${key}`);
      }
    }
    
    if (issues.length > 0) {
      console.warn(`Level "${levelDef.id}" validation issues:`, issues);
    }
    return issues;
  }
};

// Default values that levels can omit to use these
const LEVEL_DEFAULTS = {
  terrain: {
    noiseScale: 0.005,
    octaves: 3,
    persistence: 0.3,
    lacunarity: 3.0,
    ridgeInfluence: 1.3,
    elevationPower: 1.5,
    islandFalloff: 0.6,                             // potential bug/ new similar system per level
    plantDensity: 0.006                             // !
  },
  economy: {
    startingMauri: 60,                              // !
    seasonDuration: 2100,
    eggIncubationTime: 500,
    securityTimeToLay: 800,
    securityTimeVariation: 200,
    layingHungerThreshold: 28,

    eagleSpawnMilestones: [12, 18, 25, 35, 45, 55], // !
    maxPopulation: 60                               // !
  },
  initialEntityCounts: {                            // !!
    moa: 7,
    eagle: 2
  }
};

// Merge a level definition with defaults (level values win)
function resolveLevelDef(levelDef) {
  // Only deep-clone the plain-data parts
  const resolved = {};
  
  // Copy all top-level properties by reference first
  // (this preserves functions, arrays of objects with functions, etc.)
  for (const key in levelDef) {
    resolved[key] = levelDef[key];
  }
  
  // Deep-merge only the plain-data objects that have no functions
  resolved.terrain = Object.assign(
    {}, LEVEL_DEFAULTS.terrain, levelDef.terrain || {}
  );
  resolved.economy = Object.assign(
    {}, LEVEL_DEFAULTS.economy, levelDef.economy || {}
  );
  resolved.initialEntityCounts = Object.assign(
    {}, LEVEL_DEFAULTS.initialEntityCounts, levelDef.initialEntityCounts || {}
  );

  // Goals array is kept by reference — functions intact
  // (already copied above, but being explicit)
  resolved.goals = levelDef.goals;

  // Resolve placeable overrides onto base PLACEABLES
  if (resolved.availablePlaceables) {
    resolved._resolvedPlaceables = {};
    for (const [key, overrides] of Object.entries(resolved.availablePlaceables)) {
      if (PLACEABLES[key]) {
        resolved._resolvedPlaceables[key] = Object.assign(
          {}, PLACEABLES[key], overrides || {}
        );
      }
    }
  }

  return resolved;
}