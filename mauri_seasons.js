// mauri_seasons.js

// ============================================
// SEASON DEFINITIONS
// ============================================
const SEASONS = {
  summer: {
    name: "Summer",
    icon: "☀️",
    color: '#f4a460',
    plantModifiers: {
      coastal: 0.2, grassland: 0.3, podocarp: 0.4,
      montane: 0.9, subalpine: 1.3,
      // Glacial biomes: brief high-country growth, parched lowland flats
      glacialFlats: 0.6, shrubland: 0.8, forestRefuge: 1.0
    },
    plantTypeModifiers: {
      patotara: 1.8,  // Peak berry season
      rimu: 1.6,      // Summer fruiting
      coprosma: 1.3, dracophyllum: 1.2, matagouri: 1.2
    },
    preferredElevation: { min: 0.50, max: 0.78 },
    migrationStrength: 0.8,
    hungerModifier: 1.15,
    snowLine: 0.92,
    description: "Lowlands dry out. Moa migrate to alpine meadows.",
    dormancyElevation: 0.35,
    dormancyChance: 0.4
  },
  
  autumn: {
    name: "Autumn",
    icon: "🍂",
    color: '#d2691e',
    plantModifiers: {
      coastal: 0.6, grassland: 1.0, podocarp: 1.2,
      montane: 1.0, subalpine: 0.6,
      // Glacial biomes: forest fruits, browse ripens on the flats
      glacialFlats: 1.0, shrubland: 1.1, forestRefuge: 1.2
    },
    plantTypeModifiers: {
      patotara: 1.5,  // Late berry season
      rimu: 1.3,      // Late fruiting
      coprosma: 1.5, dracophyllum: 1.0, matagouri: 0.9
    },
    preferredElevation: { min: 0.30, max: 0.58 },
    migrationStrength: 0.5,
    hungerModifier: 0.9,
    snowLine: 0.85,
    description: "Forests fruit. Moa descend to feast.",
    dormancyElevation: null,
    dormancyChance: 0
  },
  
  winter: {
    name: "Winter",
    icon: "❄️",
    color: '#87ceeb',
    plantModifiers: {
      coastal: 0.7, grassland: 0.8, podocarp: 0.7,
      montane: 0.3, subalpine: 0.1,
      // Glacial winter: flats freeze, forest refuge is the last larder (and gets crowded)
      glacialFlats: 0.4, shrubland: 0.5, forestRefuge: 0.7
    },
    plantTypeModifiers: {
      patotara: 0.3,  // No berries, just foliage
      rimu: 0.5,      // Dormant, no fruit
      coprosma: 0.5, dracophyllum: 0.7, matagouri: 0.4
    },
    preferredElevation: { min: 0.18, max: 0.42 },
    migrationStrength: 1.0,
    hungerModifier: 1.25,
    snowLine: 0.77,
    description: "Alpine areas freeze. Moa shelter in lowland forests.",
    dormancyElevation: 0.55,
    dormancyChance: 0.6,
    dormancyAbove: true
  },
  
  spring: {
    name: "Spring",
    icon: "🌸",
    color: '#98fb98',
    plantModifiers: {
      coastal: 0.9, grassland: 1.3, podocarp: 1.1,
      montane: 0.8, subalpine: 0.5,
      // Glacial spring: melt brings new growth to the low flats
      glacialFlats: 1.2, shrubland: 1.0, forestRefuge: 0.9
    },
    plantTypeModifiers: {
      patotara: 0.6,  // Flowering, few berries yet
      rimu: 0.8,      // Budding
      coprosma: 0.8, dracophyllum: 1.0, matagouri: 1.1
    },
    preferredElevation: { min: 0.22, max: 0.52 },
    migrationStrength: 0.6,
    hungerModifier: 0.85,
    snowLine: 0.82,
    description: "New growth emerges. Best time for nesting.",
    dormancyElevation: 0.65,
    dormancyChance: 0.3,
    dormancyAbove: true
  }
};

// ============================================
// STATIC MIGRATION DATA (extracted from methods)
// ============================================
const MIGRATION_PATTERNS = {
  upland_moa: {
    summerHabitat: 'subalpine tussock',
    winterHabitat: 'podocarp forest',
    summer: {
      current: "Upland Moa are grazing in the high subalpine meadows.",
      upcoming: "As autumn approaches, Upland Moa will begin moving downhill."
    },
    autumn: {
      current: "Upland Moa are migrating down to the forests for winter.",
      upcoming: "Upland Moa will shelter in the podocarp forest through winter."
    },
    winter: {
      current: "Upland Moa are sheltering in the podocarp forest.",
      upcoming: "When spring arrives, Upland Moa will start moving uphill."
    },
    spring: {
      current: "Upland Moa are migrating up to the subalpine zone.",
      upcoming: "Upland Moa will spend summer in the high meadows."
    }
  }
};

const MIGRATION_HINTS = {
  upland_moa: {
    summer: { direction: '↑', text: 'High meadows', detail: 'Upland Moa thrive in subalpine terrain' },
    autumn: { direction: '↓', text: 'Moving downhill', detail: 'Migrating to forest for winter' },
    winter: { direction: '↓', text: 'Forest shelter', detail: 'Sheltering in the forest refuge' },
    spring: { direction: '↑', text: 'Moving uphill', detail: 'Returning to subalpine meadows' }
  },
  little_bush_moa: {
    summer: { direction: '·', text: 'In the forest', detail: 'Little Bush Moa stay in the closed forest refuge' },
    autumn: { direction: '·', text: 'Feasting on mast', detail: 'Feeding on beech and rimu fruit' },
    winter: { direction: '·', text: 'Forest-bound', detail: 'Crowding the shrinking winter forest' },
    spring: { direction: '·', text: 'Nesting in cover', detail: 'Breeding under the canopy' }
  },
  stout_legged_moa: {
    summer: { direction: '↓', text: 'Open flats', detail: 'Stout-legged Moa graze the glacial outwash flats' },
    autumn: { direction: '↓', text: 'Browsing shrubland', detail: 'Feeding on coprosma and matagouri' },
    winter: { direction: '↓', text: 'Hard on the flats', detail: 'Frozen flats force a lean winter' },
    spring: { direction: '↓', text: 'New growth below', detail: 'Melt greens the low country' }
  }
};

// ============================================
// SEASON MANAGER
// ============================================
class SeasonManager {
  constructor(config) {
    this.config = config;
    this.seasonOrder = ['summer', 'autumn', 'winter', 'spring'];
    this.currentSeasonIndex = (config && config.startSeasonIndex) ? config.startSeasonIndex : 0;
    this.timer = 0;
    this.transitionProgress = 0;
    this.justChanged = false;
    
    // Reusable elevation object (avoid allocation per call)
    this._elevationResult = { min: 0, max: 0 };

    // Forest-band cache (recomputed at most once per frame)
    this._fbFrame = -1;
    this._fbCache = null;
  }
  
  get current() { return SEASONS[this.seasonOrder[this.currentSeasonIndex]]; }
  get currentKey() { return this.seasonOrder[this.currentSeasonIndex]; }
  get next() { return SEASONS[this.seasonOrder[(this.currentSeasonIndex + 1) % 4]]; }
  get nextKey() { return this.seasonOrder[(this.currentSeasonIndex + 1) % 4]; }
  get progress() { return this.timer / this.config.seasonDuration; }

  // 0..1 "how wintry it looks" — ramps up across the autumn->winter transition,
  // holds at 1 through winter, and fades back to 0 across the winter->spring
  // transition. Used to fade the frost overlay so it glides rather than snaps.
  getWinterness() {
    const k = this.currentKey;
    if (k === 'winter') {
      return this.nextKey === 'spring' ? 1 - this.transitionProgress : 1;
    }
    if (k === 'autumn' && this.transitionProgress > 0 && this.nextKey === 'winter') {
      return this.transitionProgress;
    }
    return 0;
  }
  
  update(dt = 1) {
    this.timer += dt;
    this.justChanged = false;
    
    const transitionStart = this.config.seasonDuration * 0.85;
    this.transitionProgress = this.timer >= transitionStart
      ? (this.timer - transitionStart) / (this.config.seasonDuration * 0.15)
      : 0;
    
    if (this.timer >= this.config.seasonDuration) {
      this.timer = 0;
      this.currentSeasonIndex = (this.currentSeasonIndex + 1) % 4;
      this.transitionProgress = 0;
      this.justChanged = true;
      return true;
    }
    return false;
  }

  // ============================================
  // UNIFIED LERP HELPER
  // ============================================
  
  /**
   * Get a value from current season, with smooth transition to next.
   * Works for any numeric property path.
   */
  _lerpSeasonal(getCurrentVal, getNextVal) {
    const current = getCurrentVal();
    if (this.transitionProgress > 0) {
      return lerp(current, getNextVal(), this.transitionProgress);
    }
    return current;
  }

  // ============================================
  // SNOW & WEATHER
  // ============================================

  getSnowLineElevation() {
    return this._lerpSeasonal(
      () => this.current.snowLine,
      () => this.next.snowLine
    );
  }

  isSeasonalSnow(elevation) {
    return elevation >= this.getSnowLineElevation();
  }

  getSnowCoverage(elevation) {
    const snowLine = this.getSnowLineElevation();
    const fullSnowLine = 0.9;
    
    if (elevation >= fullSnowLine) return 1.0;
    if (elevation >= snowLine) return map(elevation, snowLine, fullSnowLine, 0.3, 1.0);
    return 0;
  }

  // Forest productive band — contracts seasonally (treeline retreats in the
  // glacial). Lerped smoothly per frame like the snow line, so no biome
  // reclassification is needed (avoids stutter). Cached per frame. Returns
  // null when the level does not enable forest contraction.
  getForestBand() {
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : null;
    if (!M || !M.forestContraction || !M.forestBandBySeason) return null;
    if (this._fbFrame === frameCount) return this._fbCache;
    const bands = M.forestBandBySeason;
    const cur = bands[this.currentKey] || M.forestBand;
    let band;
    if (this.transitionProgress > 0) {
      const nxt = bands[this.nextKey] || cur;
      band = {
        min: lerp(cur.min, nxt.min, this.transitionProgress),
        max: lerp(cur.max, nxt.max, this.transitionProgress)
      };
    } else {
      band = { min: cur.min, max: cur.max };
    }
    this._fbFrame = frameCount;
    this._fbCache = band;
    return band;
  }

  // ============================================
  // PLANT MODIFIERS
  // ============================================

  getPlantTypeModifier(plantType) {
    return this._lerpSeasonal(
      () => this.current.plantTypeModifiers?.[plantType] || 1.0,
      () => this.next.plantTypeModifiers?.[plantType] || 1.0
    );
  }
  
  getPlantModifier(biomeKey) {
    return this._lerpSeasonal(
      () => this.current.plantModifiers[biomeKey] || 1.0,
      () => this.next.plantModifiers[biomeKey] || 1.0
    );
  }
  
  // ============================================
  // MOA MODIFIERS
  // ============================================

  getHungerModifier() {
    return this._lerpSeasonal(
      () => this.current.hungerModifier,
      () => this.next.hungerModifier
    );
  }
  
  getMigrationStrength() {
    return this._lerpSeasonal(
      () => this.current.migrationStrength,
      () => this.next.migrationStrength
    );
  }
  
  getPreferredElevation() {
    const cur = this.current.preferredElevation;
    const result = this._elevationResult;
    
    if (this.transitionProgress > 0) {
      const nxt = this.next.preferredElevation;
      result.min = lerp(cur.min, nxt.min, this.transitionProgress);
      result.max = lerp(cur.max, nxt.max, this.transitionProgress);
    } else {
      result.min = cur.min;
      result.max = cur.max;
    }
    
    return result;
  }

  // ============================================
  // DORMANCY
  // ============================================

  shouldPlantBeDormant(elevation, biomeKey) {
    const season = this.current;
    if (!season.dormancyElevation || season.dormancyChance <= 0) return false;
    
    return season.dormancyAbove 
      ? elevation > season.dormancyElevation
      : elevation < season.dormancyElevation;
  }
  
  getDormancyChance() {
    return this.current.dormancyChance || 0;
  }

  // ============================================
  // MIGRATION MESSAGING
  // ============================================

  // Extract unique alive species from moa array (shared helper)
  _getSpeciesPresent(moas) {
    const species = new Set();
    for (const moa of moas) {
      if (moa.alive && moa.speciesKey) species.add(moa.speciesKey);
    }
    return species;
  }

  getMigrationMessages(moas) {
    const messages = { current: null, upcoming: null };
    
    for (const speciesKey of this._getSpeciesPresent(moas)) {
      const pattern = MIGRATION_PATTERNS[speciesKey];
      if (!pattern) continue;
      
      const seasonData = pattern[this.currentKey];
      if (seasonData) {
        if (seasonData.current) messages.current = seasonData.current;
        if (seasonData.upcoming) messages.upcoming = seasonData.upcoming;
      }
    }
    
    return messages;
  }

  getMigrationHint(moas) {
    for (const speciesKey of this._getSpeciesPresent(moas)) {
      const speciesHints = MIGRATION_HINTS[speciesKey];
      if (speciesHints) return speciesHints[this.currentKey] || null;
    }
    return null;
  }
}