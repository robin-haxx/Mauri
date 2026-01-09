// ============================================
// SEASON SYSTEM
// ============================================
const SEASONS = {
  summer: {
    name: "Summer",
    icon: "☀️",
    color: '#f4a460',
    // Which biomes have reduced plant growth (0-1 multiplier)
    plantModifiers: {
      grassland: 0.4,
      podocarp: 0.5,
      montane: 0.8,
      subalpine: 1.2,
      coastal: 0.3
    },
    // Preferred elevation range for moa
    preferredElevation: { min: 0.45, max: 0.75 },
    hungerModifier: 1.1, // Slightly faster hunger in summer lowlands
    description: "Lowlands dry out. Moa migrate upland."
  },
  autumn: {
    name: "Autumn",
    icon: "🍂",
    color: '#d2691e',
    plantModifiers: {
      grassland: 0.8,
      podocarp: 1.0,
      montane: 1.0,
      subalpine: 0.7,
      coastal: 0.6
    },
    preferredElevation: { min: 0.30, max: 0.60 },
    hungerModifier: 1.0,
    description: "Mild conditions. Plants fruit before winter."
  },
  winter: {
    name: "Winter",
    icon: "❄️",
    color: '#87ceeb',
    plantModifiers: {
      grassland: 0.9,
      podocarp: 0.8,
      montane: 0.4,
      subalpine: 0.2,
      coastal: 0.7
    },
    preferredElevation: { min: 0.18, max: 0.45 },
    hungerModifier: 1.2, // Harder to find food in winter
    description: "Alpine areas freeze. Moa descend to forests."
  },
  spring: {
    name: "Spring",
    icon: "🌸",
    color: '#98fb98',
    plantModifiers: {
      grassland: 1.2,
      podocarp: 1.1,
      montane: 0.9,
      subalpine: 0.6,
      coastal: 1.0
    },
    preferredElevation: { min: 0.25, max: 0.55 },
    hungerModifier: 0.9, // Easier foraging in spring
    description: "New growth emerges. Best time for nesting."
  }
};

class SeasonManager {
  constructor(config) {
    this.config = config;
    this.seasonOrder = ['summer', 'autumn', 'winter', 'spring'];
    this.currentSeasonIndex = 0;
    this.timer = 0;
    this.transitionProgress = 0;
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
  
  get progress() {
    return this.timer / this.config.seasonDuration;
  }
  
  update() {
    this.timer++;
    
    // Calculate transition (last 10% of season)
    let transitionStart = this.config.seasonDuration * 0.9;
    if (this.timer >= transitionStart) {
      this.transitionProgress = (this.timer - transitionStart) / (this.config.seasonDuration * 0.1);
    } else {
      this.transitionProgress = 0;
    }
    
    if (this.timer >= this.config.seasonDuration) {
      this.timer = 0;
      this.currentSeasonIndex = (this.currentSeasonIndex + 1) % this.seasonOrder.length;
      this.transitionProgress = 0;
      return true; // Season changed
    }
    return false;
  }
  
  getPlantModifier(biomeKey) {
    let currentMod = this.current.plantModifiers[biomeKey] || 1.0;
    
    // Blend during transition
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
  
  getPreferredElevation() {
    let current = this.current.preferredElevation;
    
    if (this.transitionProgress > 0) {
      let next = this.next.preferredElevation;
      return {
        min: lerp(current.min, next.min, this.transitionProgress),
        max: lerp(current.max, next.max, this.transitionProgress)
      };
    }
    
    return current;
  }
}