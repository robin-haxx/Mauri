// mauri_seasons.js
const SEASONS = {
  summer: {
    name: "Summer",
    icon: "☀️",
    color: '#f4a460',
    plantModifiers: {
      coastal: 0.2,
      grassland: 0.3,
      podocarp: 0.4,
      montane: 0.9,
      subalpine: 1.3
    },
    // Plant-type specific modifiers (stacks with biome modifier, check this)
    plantTypeModifiers: {
      patotara: 1.8  // Peak berry season
    },
    preferredElevation: { min: 0.50, max: 0.78 },
    migrationStrength: 0.8,
    hungerModifier: 1.15,
    description: "Lowlands dry out. Moa migrate to alpine meadows.",
    dormancyElevation: 0.35,
    dormancyChance: 0.4
  },
  
  autumn: {
    name: "Autumn",
    icon: "🍂",
    color: '#d2691e',
    plantModifiers: {
      coastal: 0.6,
      grassland: 1.0,
      podocarp: 1.2,
      montane: 1.0,
      subalpine: 0.6
    },
    plantTypeModifiers: {
      patotara: 1.5  // Late berry season, still good
    },
    preferredElevation: { min: 0.30, max: 0.58 },
    migrationStrength: 0.5,
    hungerModifier: 0.9,
    description: "Forests fruit. Moa descend to feast.",
    dormancyElevation: null,
    dormancyChance: 0
  },
  
  winter: {
    name: "Winter",
    icon: "❄️",
    color: '#87ceeb',
    plantModifiers: {
      coastal: 0.7,
      grassland: 0.8,
      podocarp: 0.7,
      montane: 0.3,
      subalpine: 0.1
    },
    plantTypeModifiers: {
      patotara: 0.3  // No berries, just foliage
    },
    preferredElevation: { min: 0.18, max: 0.42 },
    migrationStrength: 1.0,
    hungerModifier: 1.25,
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
      coastal: 0.9,
      grassland: 1.3,
      podocarp: 1.1,
      montane: 0.8,
      subalpine: 0.5
    },
    plantTypeModifiers: {
      patotara: 0.6  // Flowering, few berries yet
    },
    preferredElevation: { min: 0.22, max: 0.52 },
    migrationStrength: 0.6,
    hungerModifier: 0.85,
    description: "New growth emerges. Best time for nesting.",
    dormancyElevation: 0.65,
    dormancyChance: 0.3,
    dormancyAbove: true
  }
};

class SeasonManager {
  constructor(config) {
    this.config = config;
    this.seasonOrder = ['summer', 'autumn', 'winter', 'spring'];
    this.currentSeasonIndex = 0;
    this.timer = 0;
    this.transitionProgress = 0;
    this.justChanged = false;
  }
  
  get current() {
    return SEASONS[this.seasonOrder[this.currentSeasonIndex]];
  }
  
  get currentKey() {
    return this.seasonOrder[this.currentSeasonIndex];
  }
  
  get next() {
    let nextIndex = (this.currentSeasonIndex + 1) % this.seasonOrder.length;
    return SEASONS[this.seasonOrder[nextIndex]];
  }
  
  get nextKey() {
    return this.seasonOrder[(this.currentSeasonIndex + 1) % this.seasonOrder.length];
  }
  
  get progress() {
    return this.timer / this.config.seasonDuration;
  }
  
  update(dt = 1) {
    this.timer += dt;
    this.justChanged = false;
    
    // Calculate transition (last 15% of season)
    let transitionStart = this.config.seasonDuration * 0.85;
    if (this.timer >= transitionStart) {
      this.transitionProgress = (this.timer - transitionStart) / (this.config.seasonDuration * 0.15);
    } else {
      this.transitionProgress = 0;
    }
    
    if (this.timer >= this.config.seasonDuration) {
      this.timer = 0;
      this.currentSeasonIndex = (this.currentSeasonIndex + 1) % this.seasonOrder.length;
      this.transitionProgress = 0;
      this.justChanged = true;
      return true;
    }
    return false;
  }

    /**
   * Get the effective snow line elevation based on current season
   * Snow extends lower in winter, retreats in summer
   * @returns {number} Elevation threshold where snow appears
   */
  getSnowLineElevation() {
    // Seasonal snow line elevations
    const snowLineByseason = {
      summer: 0.92,  // Snow retreats slightly in summer
      autumn: 0.85,  // Snow starts creeping down
      winter: 0.77,  // Snow extends to top of subalpine (covers all alpine rock)
      spring: 0.82   // Snow melts back in spring
    };
    
    const currentLine = snowLineByseason[this.currentKey];
    
    // Smooth transitions between seasons
    if (this.transitionProgress > 0) {
      const nextLine = snowLineByseason[this.nextKey];
      return lerp(currentLine, nextLine, this.transitionProgress);
    }
    
    return currentLine;
  }

  /**
   * Check if a given elevation should render as snow based on season
   * @param {number} elevation - The terrain elevation (0-1)
   * @returns {boolean} True if should render as seasonal snow
   */
  isSeasonalSnow(elevation) {
    return elevation >= this.getSnowLineElevation();
  }

  /**
   * Get snow coverage amount for partial snow effects (optional)
   * Returns 0-1 for blending snow with underlying terrain
   * @param {number} elevation - The terrain elevation (0-1)
   * @returns {number} Snow coverage (0 = none, 1 = full)
   */
  getSnowCoverage(elevation) {
    const snowLine = this.getSnowLineElevation();
    const fullSnowLine = 0.9; // Original permanent snow line
    
    if (elevation >= fullSnowLine) {
      return 1.0; // Full snow in permanent snow zone
    } else if (elevation >= snowLine) {
      // Gradual snow coverage in seasonal zone
      return map(elevation, snowLine, fullSnowLine, 0.3, 1.0);
    }
    return 0;
  }

  getPlantTypeModifier(plantType) {
    const currentMod = this.current.plantTypeModifiers?.[plantType] || 1.0;
    
    if (this.transitionProgress > 0) {
      const nextMod = this.next.plantTypeModifiers?.[plantType] || 1.0;
      return lerp(currentMod, nextMod, this.transitionProgress);
    }
    
    return currentMod;
  }
  
  getPlantModifier(biomeKey) {
    let currentMod = this.current.plantModifiers[biomeKey] || 1.0;
    
    if (this.transitionProgress > 0) {
      let nextMod = this.next.plantModifiers[biomeKey] || 1.0;
      return lerp(currentMod, nextMod, this.transitionProgress);
    }
    
    return currentMod;
  }
  
  getHungerModifier() {
    if (this.transitionProgress > 0) {
      return lerp(this.current.hungerModifier, this.next.hungerModifier, this.transitionProgress);
    }
    return this.current.hungerModifier;
  }
  
  getMigrationStrength() {
    if (this.transitionProgress > 0) {
      return lerp(this.current.migrationStrength, this.next.migrationStrength, this.transitionProgress);
    }
    return this.current.migrationStrength;
  }
  
  getPreferredElevation() {
    let current = this.current.preferredElevation;
    
    if (this.transitionProgress > 0) {
      let next = this.next.preferredElevation;
      return {
        min: lerp(current.min, next.min, this.transitionProgress),
        max: lerp(current.max, next.max, this.transitionProgress)
      };
    }
    
    return { ...current };
  }

    /**
   * Get migration messages for species present in the simulation
   * @param {Array} moas - Array of moa in simulation
   * @returns {Object} - Messages about current and upcoming migration
   */
  getMigrationMessages(moas) {
    const messages = {
      current: null,
      upcoming: null
    };
    
    // Get unique species present
    const speciesPresent = new Set();
    for (let moa of moas) {
      if (moa.alive && moa.speciesKey) {
        speciesPresent.add(moa.speciesKey);
      }
    }
    
    // Check each species for migration messaging
    for (let speciesKey of speciesPresent) {
      const speciesMessages = this.getSpeciesMigrationMessage(speciesKey);
      if (speciesMessages.current) {
        messages.current = speciesMessages.current;
      }
      if (speciesMessages.upcoming) {
        messages.upcoming = speciesMessages.upcoming;
      }
    }
    
    return messages;
  }

  /**
   * Get migration message for a specific species based on current season
   */
  getSpeciesMigrationMessage(speciesKey) {
    const messages = {
      current: null,
      upcoming: null
    };
    
    // Species-specific migration patterns
    const migrationPatterns = {
      upland_moa: {
        // What terrain they migrate between
        summerHabitat: 'subalpine tussock',
        winterHabitat: 'podocarp forest',
        
        // Messages by season
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
      // Add other migratory species here as needed
    };
    
    const pattern = migrationPatterns[speciesKey];
    if (!pattern) return messages;
    
    const seasonData = pattern[this.currentKey];
    if (seasonData) {
      messages.current = seasonData.current;
      messages.upcoming = seasonData.upcoming;
    }
    
    return messages;
  }

  /**
   * Get a brief migration hint for UI display
   */
  getMigrationHint(moas) {
    // Get unique species
    const speciesPresent = new Set();
    for (let moa of moas) {
      if (moa.alive && moa.speciesKey) {
        speciesPresent.add(moa.speciesKey);
      }
    }
    
    // For now, focus on upland moa
    if (speciesPresent.has('upland_moa')) {
      const hints = {
        summer: { 
          direction: '↑', 
          text: 'High meadows',
          detail: 'Upland Moa thrive in subalpine terrain'
        },
        autumn: { 
          direction: '↓', 
          text: 'Moving downhill',
          detail: 'Migrating to forest for winter'
        },
        winter: { 
          direction: '↓', 
          text: 'Forest shelter',
          detail: 'Sheltering in podocarp forest'
        },
        spring: { 
          direction: '↑', 
          text: 'Moving uphill',
          detail: 'Returning to subalpine meadows'
        }
      };
      
      return hints[this.currentKey] || null;
    }
    
    return null;
  }
  
  // Check if a plant at given elevation should be dormant
  shouldPlantBeDormant(elevation, biomeKey) {
    let season = this.current;
    
    if (!season.dormancyElevation || season.dormancyChance <= 0) {
      return false;
    }
    
    let isDormantZone;
    if (season.dormancyAbove) {
      isDormantZone = elevation > season.dormancyElevation;
    } else {
      isDormantZone = elevation < season.dormancyElevation;
    }
    
    return isDormantZone;
  }
  
  getDormancyChance() {
    return this.current.dormancyChance || 0;
  }
}