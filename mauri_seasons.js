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

    // Free Play climate drift. coldIndex in [0,1] is the glacial severity of the
    // current year, set each frame by Game from ClimateDrift (0 on every level that
    // doesn't opt in, so the folds below are inert). It deepens the WINTER end of
    // the seasonal getters — never summer, never the authored base values (those
    // stay in SEASONS; writing back would compound — see MISTAKES.md).
    this.coldIndex = 0;
    this.CLIMATE_SNOW_DROP = 0.20;       // snow line drop at full glacial (0.77 winter -> ~0.57)
    this.CLIMATE_FOREST_SQUEEZE = 0.05;  // forest refuge band narrows at full glacial
    this.CLIMATE_HUNGER_MULT = 0.6;      // extra winter hunger at full glacial (+60%)

    // Free Play Mast Year: set true by Game while a bought mast year is live. Surges
    // FOREST_TREES growth (rimu most — the fruiting podocarp) in getPlantTypeModifier,
    // and keeps forest fruit edible through the cold (mauri_plant.js). Read-time only;
    // never written back into SEASONS.
    this.mastYear = false;
    this.MAST_PODO_MULT = 3.0;    // rimu (podocarp) growth multiplier in a mast year
    this.MAST_FOREST_MULT = 2.0;  // other forest trees (beech/fern) in a mast year
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
  // SEASONAL BLEND (inlined, allocation-free)
  // ============================================
  // Each getter below inlines the current->next transition blend directly. A prior
  // closure-taking helper (_lerpSeasonal(getCur, getNext)) allocated two arrow
  // functions per call on a per-entity, per-frame path — the sim's single largest
  // GC source in the Te Manawa fork. Do NOT reintroduce it. See MISTAKES.md.

  // ============================================
  // SNOW & WEATHER
  // ============================================

  getSnowLineElevation() {
    const cur = this.current.snowLine;
    let sl = (this.transitionProgress > 0) ? lerp(cur, this.next.snowLine, this.transitionProgress) : cur;
    // Free Play: a deepening glacial pushes the snow line down year-round (shrinking
    // walkable high country), most strongly through winter.
    if (this.coldIndex > 0) {
      sl -= this.coldIndex * this.CLIMATE_SNOW_DROP * (0.5 + 0.5 * this.getWinterness());
      if (sl < 0.5) sl = 0.5;
    }
    return sl;
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
    // Free Play: a deepening glacial tightens the refuge — the treeline creeps up
    // from below and eases down from above, so the productive band narrows over the
    // run, not just within a winter. Keep a sliver so it never inverts.
    if (this.coldIndex > 0) {
      const sq = this.coldIndex * this.CLIMATE_FOREST_SQUEEZE;
      const min = band.min + sq;
      const max = band.max - sq * 0.5;
      band = { min, max: Math.max(min + 0.01, max) };
    }
    this._fbFrame = frameCount;
    this._fbCache = band;
    return band;
  }

  // ============================================
  // PLANT MODIFIERS
  // ============================================

  getPlantTypeModifier(plantType) {
    const cur = this.current.plantTypeModifiers?.[plantType] || 1.0;
    let m = cur;
    if (this.transitionProgress > 0) {
      const nxt = this.next.plantTypeModifiers?.[plantType] || 1.0;
      m = lerp(cur, nxt, this.transitionProgress);
    }
    // Free Play Mast Year: the podocarp forest fruits abundantly — forest plants surge,
    // rimu (the podocarp) most of all. Read-time only; never written back (MISTAKES.md).
    if (this.mastYear && typeof FOREST_TREES !== 'undefined' && FOREST_TREES.has(plantType)) {
      m *= (plantType === 'rimu') ? this.MAST_PODO_MULT : this.MAST_FOREST_MULT;
    }
    return m;
  }

  getPlantModifier(biomeKey) {
    const cur = this.current.plantModifiers[biomeKey] || 1.0;
    if (this.transitionProgress > 0) {
      const nxt = this.next.plantModifiers[biomeKey] || 1.0;
      return lerp(cur, nxt, this.transitionProgress);
    }
    return cur;
  }
  
  // ============================================
  // MOA MODIFIERS
  // ============================================

  getHungerModifier() {
    const cur = this.current.hungerModifier;
    let h = (this.transitionProgress > 0) ? lerp(cur, this.next.hungerModifier, this.transitionProgress) : cur;
    // Free Play: cold costs energy. Concentrated in winter via winterness, so a
    // glacial winter is hungrier than an interglacial one, and deep glacials hungrier
    // still. (Per-species cold tolerance is applied on top, in mauri_moa.js.)
    if (this.coldIndex > 0) h *= (1 + this.CLIMATE_HUNGER_MULT * this.coldIndex * this.getWinterness());
    return h;
  }

  getMigrationStrength() {
    const cur = this.current.migrationStrength;
    if (this.transitionProgress > 0) return lerp(cur, this.next.migrationStrength, this.transitionProgress);
    return cur;
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