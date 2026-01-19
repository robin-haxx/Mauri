// ============================================
// ENTITY REGISTRY
// Central registration and factory for all game entities
// ============================================

class EntityRegistry {
  constructor() {
    // Core registries
    this.species = new Map();        // Animal species (moa variants, eagle variants, etc.)
    this.animalTypes = new Map();    // Base animal types (moa, eagle, kiwi, etc.)
    this.plantTypes = new Map();     // Plant definitions
    this.placeables = new Map();     // Placeable items
    this.biomes = new Map();         // Biome definitions
    this.levels = new Map();         // Level/scenario definitions
    
    // Track species by their base type for easy querying
    this.speciesByType = new Map();  // e.g., 'moa' -> ['upland_moa', 'south_island_giant_moa', ...]
  }
  
  // ==========================================
  // ANIMAL TYPE REGISTRATION
  // Base types define the class and shared behavior
  // ==========================================
  
  /**
   * Register a base animal type (e.g., 'moa', 'eagle')
   * @param {string} typeKey - Unique identifier for the type
   * @param {object} config - Base configuration
   * @param {class} behaviorClass - The class to instantiate
   */
  registerAnimalType(typeKey, config, behaviorClass) {
    this.animalTypes.set(typeKey, {
      key: typeKey,
      config: config,
      class: behaviorClass,
      baseConfig: { ...config }  // Keep original for reference
    });
    
    // Initialize species tracking for this type
    if (!this.speciesByType.has(typeKey)) {
      this.speciesByType.set(typeKey, []);
    }
    
    console.log(`Registered animal type: ${typeKey}`);
  }
  
  /**
   * Get a base animal type definition
   */
  getAnimalType(typeKey) {
    return this.animalTypes.get(typeKey);
  }
  
  // ==========================================
  // SPECIES REGISTRATION
  // Species are variations of base animal types
  // ==========================================
  
  /**
   * Register a species (variant of a base animal type)
   * @param {string} speciesKey - Unique identifier (e.g., 'upland_moa')
   * @param {string} baseType - The base animal type (e.g., 'moa')
   * @param {object} speciesConfig - Species-specific overrides and additions
   */
  registerSpecies(speciesKey, baseType, speciesConfig) {
    const baseAnimal = this.animalTypes.get(baseType);
    
    if (!baseAnimal) {
      console.error(`Cannot register species '${speciesKey}': base type '${baseType}' not found`);
      return;
    }
    
    // Merge base config with species-specific config
    const mergedConfig = this.mergeConfigs(baseAnimal.config, speciesConfig);
    
    this.species.set(speciesKey, {
      key: speciesKey,
      baseType: baseType,
      config: mergedConfig,
      class: speciesConfig.class || baseAnimal.class,
      displayName: speciesConfig.displayName || speciesKey,
      description: speciesConfig.description || '',
      rarity: speciesConfig.rarity || 'common',
      // Track what was overridden for debugging
      overrides: Object.keys(speciesConfig)
    });
    
    // Track this species under its base type
    const typeSpecies = this.speciesByType.get(baseType);
    if (typeSpecies && !typeSpecies.includes(speciesKey)) {
      typeSpecies.push(speciesKey);
    }
    
    console.log(`Registered species: ${speciesKey} (${baseType})`);
  }
  
  /**
   * Deep merge two config objects, with source overriding base
   */
  mergeConfigs(base, source) {
    const result = { ...base };
    
    for (const key in source) {
      if (source[key] !== undefined) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          // Deep merge objects
          result[key] = this.mergeConfigs(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Get a species definition
   */
  getSpecies(speciesKey) {
    return this.species.get(speciesKey);
  }
  
  /**
   * Get all species of a given base type
   */
  getSpeciesOfType(baseType) {
    const speciesKeys = this.speciesByType.get(baseType) || [];
    return speciesKeys.map(key => this.species.get(key));
  }
  
  /**
   * Create an instance of a species
   */
  createAnimal(speciesKey, x, y, terrain, gameConfig) {
    const species = this.species.get(speciesKey);
    
    if (!species) {
      console.error(`Unknown species: ${speciesKey}`);
      return null;
    }
    
    // Merge game config with species config
    const finalConfig = this.mergeConfigs(gameConfig, species.config);
    
    // Create instance using the species' class
    const instance = new species.class(x, y, terrain, finalConfig, species);
    
    // Tag with species info
    instance.speciesKey = speciesKey;
    instance.speciesData = species;
    
    return instance;
  }
  
  /**
   * Create a random species of a given type
   * Respects rarity weights
   */
  createRandomOfType(baseType, x, y, terrain, gameConfig, rarityWeights = null) {
    const speciesList = this.getSpeciesOfType(baseType);
    
    if (speciesList.length === 0) {
      console.error(`No species registered for type: ${baseType}`);
      return null;
    }
    
    // Default rarity weights
    const defaultWeights = {
      common: 1.0,
      uncommon: 0.5,
      rare: 0.2,
      legendary: 0.05
    };
    
    const weights = rarityWeights || defaultWeights;
    
    // Build weighted list
    let totalWeight = 0;
    const weightedSpecies = speciesList.map(species => {
      const weight = weights[species.rarity] || 1.0;
      totalWeight += weight;
      return { species, weight, cumulative: totalWeight };
    });
    
    // Pick random based on weights
    const roll = Math.random() * totalWeight;
    const selected = weightedSpecies.find(ws => roll <= ws.cumulative);
    
    return this.createAnimal(selected.species.key, x, y, terrain, gameConfig);
  }
  
  // ==========================================
  // PLANT REGISTRATION
  // ==========================================
  
  registerPlant(key, config) {
    this.plantTypes.set(key, {
      key: key,
      ...config
    });
  }
  
  getPlant(key) {
    return this.plantTypes.get(key);
  }
  
  getAllPlants() {
    return Object.fromEntries(this.plantTypes);
  }
  
  // ==========================================
  // PLACEABLE REGISTRATION
  // ==========================================
  
  registerPlaceable(key, config) {
    this.placeables.set(key, {
      key: key,
      ...config
    });
  }
  
  getPlaceable(key) {
    return this.placeables.get(key);
  }
  
  getAllPlaceables() {
    return Object.fromEntries(this.placeables);
  }
  
  // ==========================================
  // BIOME REGISTRATION
  // ==========================================
  
  registerBiome(key, config) {
    config.key = key;
    this.biomes.set(key, config);
  }
  
  getBiome(key) {
    return this.biomes.get(key);
  }
  
  getAllBiomes() {
    return Object.fromEntries(this.biomes);
  }
  
  // ==========================================
  // LEVEL REGISTRATION
  // ==========================================
  
  registerLevel(key, config) {
    this.levels.set(key, {
      key: key,
      ...config
    });
  }
  
  getLevel(key) {
    return this.levels.get(key);
  }
  
  getLevelList() {
    return Array.from(this.levels.values()).map(level => ({
      key: level.key,
      name: level.name,
      description: level.description,
      difficulty: level.difficulty
    }));
  }
  
  // ==========================================
  // UTILITIES
  // ==========================================
  
  /**
   * Get summary of all registered content
   */
  getSummary() {
    return {
      animalTypes: Array.from(this.animalTypes.keys()),
      species: Array.from(this.species.keys()),
      speciesByType: Object.fromEntries(this.speciesByType),
      plants: Array.from(this.plantTypes.keys()),
      placeables: Array.from(this.placeables.keys()),
      biomes: Array.from(this.biomes.keys()),
      levels: Array.from(this.levels.keys())
    };
  }
  
  /**
   * Validate that all required content is registered
   */
  validate() {
    const issues = [];
    
    // Check each species has a valid base type
    for (const [key, species] of this.species) {
      if (!this.animalTypes.has(species.baseType)) {
        issues.push(`Species '${key}' references unknown base type '${species.baseType}'`);
      }
    }
    
    // Check biome plant references
    for (const [key, biome] of this.biomes) {
      if (biome.plantTypes) {
        for (const plantType of biome.plantTypes) {
          if (!this.plantTypes.has(plantType)) {
            issues.push(`Biome '${key}' references unknown plant type '${plantType}'`);
          }
        }
      }
    }
    
    if (issues.length > 0) {
      console.warn('Registry validation issues:', issues);
    }
    
    return issues;
  }
}

// ============================================
// GLOBAL REGISTRY INSTANCE
// ============================================
const REGISTRY = new EntityRegistry();