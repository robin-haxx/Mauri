// ============================================
// SPECIES DATA DEFINITIONS
// All moa species and their characteristics
// ============================================

const MOA_SPECIES = {
  // ==========================================
  // UPLAND MOA (Megalapteryx didinus)
  // Small, forest-dwelling, cold-adapted
  // ==========================================
  upland_moa: {
    displayName: "Upland Moa",
    scientificName: "Megalapteryx didinus",
    description: "Small, hardy moa adapted to high-altitude forests",
    rarity: 'common',
    
    // Physical characteristics
    size: { min: 7, max: 9 },
    bodyColor: { r: [90, 110], g: [60, 75], b: [28, 40] },
    
    // Movement
    baseSpeed: 0.2,
    fleeSpeed: 0.35,
    maxForce: 0.025,
    
    // Survival
    maxHunger: 100,
    baseHungerRate: 0.02,
    hungerThreshold: 35,
    criticalHunger: 80,
    
    // Reproduction
    eggCooldownTime: 700,
    securityTimeBase: 500,
    securityTimeVariation: 300,
    
    // Habitat preferences
    preferredElevation: { min: 0.35, max: 0.70 },
    temperatureTolerance: { cold: 0.8, heat: 0.5 },  // Good in cold
    
    // Behavior modifiers
    flockTendency: 0.8,    // How much they stick together
    curiosity: 0.6,        // Tendency to investigate new things
    flightiness: 0.7,      // How easily spooked
    
    // Seasonal adaptations
    seasonalModifiers: {
      summer: { hungerRate: 1.1, speed: 1.0 },
      autumn: { hungerRate: 1.0, speed: 1.0 },
      winter: { hungerRate: 0.9, speed: 0.9 },  // Better adapted to cold
      spring: { hungerRate: 1.0, speed: 1.1 }
    }
  },
  
  // ==========================================
  // SOUTH ISLAND GIANT MOA (Dinornis robustus)
  // Largest moa species, plains dweller
  // ==========================================
  south_island_giant_moa: {
    displayName: "South Island Giant Moa",
    scientificName: "Dinornis robustus",
    description: "Massive moa of the lowland plains, up to 3.6m tall",
    rarity: 'uncommon',
    
    size: { min: 12, max: 16 },
    bodyColor: { r: [100, 120], g: [75, 90], b: [45, 60] },
    
    baseSpeed: 0.18,      // Slower due to size
    fleeSpeed: 0.45,
    maxForce: 0.02,
    
    maxHunger: 140,       // Needs more food
    baseHungerRate: 0.055,
    hungerThreshold: 45,
    criticalHunger: 110,
    
    eggCooldownTime: 1200,  // Longer between eggs
    securityTimeBase: 1100,
    securityTimeVariation: 500,
    
    preferredElevation: { min: 0.15, max: 0.40 },
    temperatureTolerance: { cold: 0.4, heat: 0.7 },
    
    flockTendency: 0.5,    // More solitary
    curiosity: 0.4,
    flightiness: 0.5,      // Harder to scare due to size
    
    // Special: harder for eagles to catch
    eagleResistance: 0.3,  // 30% chance to resist attack
    
    seasonalModifiers: {
      summer: { hungerRate: 0.9, speed: 1.0 },
      autumn: { hungerRate: 1.0, speed: 1.0 },
      winter: { hungerRate: 1.2, speed: 0.8 },
      spring: { hungerRate: 1.0, speed: 1.0 }
    }
  },
  
  // ==========================================
  // NORTH ISLAND GIANT MOA (Dinornis novaezealandiae)
  // ==========================================
  north_island_giant_moa: {
    displayName: "North Island Giant Moa",
    scientificName: "Dinornis novaezealandiae",
    description: "Large moa of northern forests",
    rarity: 'uncommon',
    
    size: { min: 11, max: 14 },
    bodyColor: { r: [95, 115], g: [70, 85], b: [40, 55] },
    
    baseSpeed: 0.2,
    fleeSpeed: 0.5,
    maxForce: 0.022,
    
    maxHunger: 120,
    baseHungerRate: 0.05,
    hungerThreshold: 40,
    criticalHunger: 95,
    
    preferredElevation: { min: 0.18, max: 0.45 },
    temperatureTolerance: { cold: 0.5, heat: 0.6 },
    
    flockTendency: 0.6,
    curiosity: 0.5,
    flightiness: 0.55,
    
    eagleResistance: 0.2,
    
    seasonalModifiers: {
      summer: { hungerRate: 0.95, speed: 1.0 },
      autumn: { hungerRate: 1.0, speed: 1.0 },
      winter: { hungerRate: 1.15, speed: 0.85 },
      spring: { hungerRate: 1.0, speed: 1.05 }
    }
  },
  
  // ==========================================
  // EASTERN MOA (Emeus crassus)
  // Medium-sized, adaptable
  // ==========================================
  eastern_moa: {
    displayName: "Eastern Moa",
    scientificName: "Emeus crassus",
    description: "Adaptable medium-sized moa of varied habitats",
    rarity: 'common',
    
    size: { min: 8, max: 11 },
    bodyColor: { r: [85, 105], g: [65, 80], b: [35, 50] },
    
    baseSpeed: 0.24,
    fleeSpeed: 0.58,
    maxForce: 0.024,
    
    maxHunger: 95,
    baseHungerRate: 0.038,
    hungerThreshold: 32,
    criticalHunger: 75,
    
    preferredElevation: { min: 0.20, max: 0.55 },
    temperatureTolerance: { cold: 0.6, heat: 0.6 },  // Balanced
    
    flockTendency: 0.75,
    curiosity: 0.7,
    flightiness: 0.65,
    
    // Special: finds food more efficiently
    foragingBonus: 1.2,
    
    seasonalModifiers: {
      summer: { hungerRate: 1.0, speed: 1.0 },
      autumn: { hungerRate: 0.95, speed: 1.0 },  // Good at finding autumn food
      winter: { hungerRate: 1.05, speed: 0.95 },
      spring: { hungerRate: 0.95, speed: 1.05 }
    }
  },
  
  // ==========================================
  // STOUT-LEGGED MOA (Euryapteryx curtus)
  // ==========================================
  stout_legged_moa: {
    displayName: "Stout-legged Moa",
    scientificName: "Euryapteryx curtus",
    description: "Stocky moa with powerful legs, coastal to lowland",
    rarity: 'common',
    
    size: { min: 7, max: 10 },
    bodyColor: { r: [88, 108], g: [58, 73], b: [32, 45] },
    
    baseSpeed: 0.22,
    fleeSpeed: 0.65,  // Fast runner despite stocky build
    maxForce: 0.028,  // More agile
    
    maxHunger: 90,
    baseHungerRate: 0.042,
    hungerThreshold: 33,
    criticalHunger: 72,
    
    preferredElevation: { min: 0.12, max: 0.35 },
    temperatureTolerance: { cold: 0.5, heat: 0.7 },
    
    flockTendency: 0.85,
    curiosity: 0.5,
    flightiness: 0.75,
    
    seasonalModifiers: {
      summer: { hungerRate: 0.9, speed: 1.05 },
      autumn: { hungerRate: 1.0, speed: 1.0 },
      winter: { hungerRate: 1.1, speed: 0.9 },
      spring: { hungerRate: 1.0, speed: 1.0 }
    }
  },
  
  // ==========================================
  // HEAVY-FOOTED MOA (Pachyornis elephantopus)
  // ==========================================
  heavy_footed_moa: {
    displayName: "Heavy-footed Moa",
    scientificName: "Pachyornis elephantopus",
    description: "Robust moa with massive legs, lowland specialist",
    rarity: 'uncommon',
    
    size: { min: 10, max: 13 },
    bodyColor: { r: [105, 125], g: [78, 93], b: [50, 65] },
    
    baseSpeed: 0.17,
    fleeSpeed: 0.4,
    maxForce: 0.018,
    
    maxHunger: 130,
    baseHungerRate: 0.048,
    hungerThreshold: 42,
    criticalHunger: 100,
    
    preferredElevation: { min: 0.15, max: 0.35 },
    temperatureTolerance: { cold: 0.45, heat: 0.65 },
    
    flockTendency: 0.55,
    curiosity: 0.35,
    flightiness: 0.45,
    
    eagleResistance: 0.25,
    
    seasonalModifiers: {
      summer: { hungerRate: 0.95, speed: 1.0 },
      autumn: { hungerRate: 1.0, speed: 1.0 },
      winter: { hungerRate: 1.15, speed: 0.85 },
      spring: { hungerRate: 1.0, speed: 0.95 }
    }
  },
  
  // ==========================================
  // CRESTED MOA (Pachyornis australis)  
  // ==========================================
  crested_moa: {
    displayName: "Crested Moa",
    scientificName: "Pachyornis australis",
    description: "Southern moa with distinctive head crest",
    rarity: 'rare',
    
    size: { min: 9, max: 12 },
    bodyColor: { r: [92, 112], g: [62, 77], b: [38, 52] },
    hasCrest: true,  // Visual flag for rendering
    crestColor: { r: [140, 160], g: [100, 120], b: [60, 80] },
    
    baseSpeed: 0.21,
    fleeSpeed: 0.52,
    maxForce: 0.023,
    
    maxHunger: 105,
    baseHungerRate: 0.044,
    hungerThreshold: 36,
    criticalHunger: 82,
    
    preferredElevation: { min: 0.25, max: 0.50 },
    temperatureTolerance: { cold: 0.7, heat: 0.5 },
    
    flockTendency: 0.7,
    curiosity: 0.8,  // More curious
    flightiness: 0.6,
    
    seasonalModifiers: {
      summer: { hungerRate: 1.05, speed: 1.0 },
      autumn: { hungerRate: 1.0, speed: 1.0 },
      winter: { hungerRate: 0.95, speed: 0.95 },
      spring: { hungerRate: 0.95, speed: 1.1 }
    }
  },
  
  // ==========================================
  // MANTELL'S MOA (Pachyornis geranoides)
  // ==========================================
  mantells_moa: {
    displayName: "Mantell's Moa",
    scientificName: "Pachyornis geranoides",
    description: "North Island relative of the heavy-footed moa",
    rarity: 'uncommon',
    
    size: { min: 9, max: 11 },
    bodyColor: { r: [98, 118], g: [72, 87], b: [42, 57] },
    
    baseSpeed: 0.19,
    fleeSpeed: 0.48,
    maxForce: 0.021,
    
    maxHunger: 110,
    baseHungerRate: 0.046,
    hungerThreshold: 38,
    criticalHunger: 88,
    
    preferredElevation: { min: 0.18, max: 0.42 },
    temperatureTolerance: { cold: 0.55, heat: 0.6 },
    
    flockTendency: 0.65,
    curiosity: 0.55,
    flightiness: 0.55,
    
    seasonalModifiers: {
      summer: { hungerRate: 0.95, speed: 1.0 },
      autumn: { hungerRate: 1.0, speed: 1.0 },
      winter: { hungerRate: 1.1, speed: 0.9 },
      spring: { hungerRate: 1.0, speed: 1.0 }
    }
  },
  
  // ==========================================
  // LITTLE BUSH MOA (Anomalopteryx didiformis)
  // ==========================================
  little_bush_moa: {
    displayName: "Little Bush Moa",
    scientificName: "Anomalopteryx didiformis",
    description: "Smallest moa, nimble forest dweller",
    rarity: 'common',
    
    size: { min: 5, max: 7 },
    bodyColor: { r: [82, 100], g: [55, 68], b: [25, 38] },
    
    baseSpeed: 0.3,       // Fastest moa
    fleeSpeed: 0.75,
    maxForce: 0.032,
    
    maxHunger: 70,        // Smallest needs least food
    baseHungerRate: 0.035,
    hungerThreshold: 28,
    criticalHunger: 58,
    
    eggCooldownTime: 600,  // Breeds faster
    securityTimeBase: 700,
    securityTimeVariation: 300,
    
    preferredElevation: { min: 0.22, max: 0.48 },
    temperatureTolerance: { cold: 0.65, heat: 0.55 },
    
    flockTendency: 0.9,    // Very social
    curiosity: 0.75,
    flightiness: 0.85,     // Very skittish
    
    // Special: harder to spot by eagles
    camouflage: 0.2,       // 20% chance eagle doesn't see
    
    seasonalModifiers: {
      summer: { hungerRate: 1.0, speed: 1.05 },
      autumn: { hungerRate: 0.95, speed: 1.0 },
      winter: { hungerRate: 1.0, speed: 0.95 },
      spring: { hungerRate: 0.9, speed: 1.1 }
    }
  }
};

// ==========================================
// EAGLE SPECIES
// ==========================================
const EAGLE_SPECIES = {
  haasts_eagle: {
    displayName: "Haast's Eagle",
    scientificName: "Hieraaetus moorei",
    description: "Largest known eagle, apex predator of moa",
    rarity: 'common',
    
    wingspan: { min: 20, max: 26 },
    
    baseSpeed: 0.6,
    huntSpeed: 1.4,
    maxForce: 0.05,
    
    maxHunger: 100,
    hungerRate: 0.022,
    huntThreshold: 40,
    
    huntRadius: 130,
    catchRadius: 12,
    
    patrolRadius: { min: 70, max: 100 },
    
    // Hunting preferences
    preferredPreySize: { min: 5, max: 12 },  // Optimal moa size
    largePenalty: 0.7,  // Multiplier for attacking larger moa
    
    restDuration: 180
  },
  
  // Could add young/old eagles, or regional variants
  young_haasts_eagle: {
    displayName: "Young Haast's Eagle",
    scientificName: "Hieraaetus moorei (juvenile)",
    description: "Inexperienced but energetic hunter",
    rarity: 'uncommon',
    
    wingspan: { min: 16, max: 20 },
    
    baseSpeed: 0.55,
    huntSpeed: 1.5,    // Faster but less accurate
    maxForce: 0.045,
    
    maxHunger: 90,
    hungerRate: 0.028, // Higher metabolism
    huntThreshold: 35, // Hunts when less hungry
    
    huntRadius: 100,   // Less experienced at spotting
    catchRadius: 10,   // Less accurate
    
    patrolRadius: { min: 50, max: 70 },
    
    preferredPreySize: { min: 5, max: 9 },
    largePenalty: 0.5,
    
    restDuration: 120  // Recovers faster
  }
};

// ==========================================
// REGISTRATION FUNCTION
// Call this during game initialization
// ==========================================
function registerAllSpecies() {
  // Register base animal types first
  REGISTRY.registerAnimalType('moa', {
    // Default moa config (can be empty, species will override)
  }, Moa);
  
  REGISTRY.registerAnimalType('eagle', {}, HaastsEagle);
  
  // Register all moa species
  for (const [key, config] of Object.entries(MOA_SPECIES)) {
    REGISTRY.registerSpecies(key, 'moa', config);
  }
  
  // Register all eagle species
  for (const [key, config] of Object.entries(EAGLE_SPECIES)) {
    REGISTRY.registerSpecies(key, 'eagle', config);
  }
  
  console.log('All species registered:', REGISTRY.getSummary());
}