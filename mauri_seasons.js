// mauri_seasons.js
const SEASONS = {
  summer: {
    name: "Summer",
    icon: "☀️",
    color: '#f4a460',
    plantModifiers: {
      coastal: 0.2,     // Very dry
      grassland: 0.3,   // Parched
      podocarp: 0.4,    // Struggling
      montane: 0.9,     // Okay
      subalpine: 1.3    // Thriving
    },
    // More extreme elevation preference - clearly upland
    preferredElevation: { min: 0.50, max: 0.78 },
    migrationStrength: 0.8,  // How strongly moa want to migrate
    hungerModifier: 1.15,
    description: "Lowlands dry out. Moa migrate to alpine meadows.",
    
    // Plants below this elevation may go dormant
    dormancyElevation: 0.35,
    dormancyChance: 0.4  // 40% of plants below threshold go dormant
  },
  
  autumn: {
    name: "Autumn",
    icon: "🍂",
    color: '#d2691e',
    plantModifiers: {
      coastal: 0.6,
      grassland: 1.0,
      podocarp: 1.2,    // Fruiting season
      montane: 1.0,
      subalpine: 0.6
    },
    preferredElevation: { min: 0.30, max: 0.58 },
    migrationStrength: 0.5,
    hungerModifier: 0.9,  // Abundant food
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
      montane: 0.3,     // Snow-covered
      subalpine: 0.1    // Frozen
    },
    // Clearly lowland preference
    preferredElevation: { min: 0.18, max: 0.42 },
    migrationStrength: 1.0,  // Strong migration drive
    hungerModifier: 1.25,    // Food is scarce
    description: "Alpine areas freeze. Moa shelter in lowland forests.",
    
    // Plants above this elevation go dormant
    dormancyElevation: 0.55,
    dormancyChance: 0.6,
    dormancyAbove: true  // Dormancy affects plants ABOVE threshold
  },
  
  spring: {
    name: "Spring",
    icon: "🌸",
    color: '#98fb98',
    plantModifiers: {
      coastal: 0.9,
      grassland: 1.3,   // New growth
      podocarp: 1.1,
      montane: 0.8,     // Still melting
      subalpine: 0.5    // Snow melting
    },
    preferredElevation: { min: 0.22, max: 0.52 },
    migrationStrength: 0.6,
    hungerModifier: 0.85,  // Easy foraging
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
  
  update() {
    this.timer++;
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