// ============================================
// LEVEL 1: Kahurangi — Upper West Coast
// The introductory level, single moa species
// ============================================

const LEVEL_KAHURANGI = {
  id: 'kahurangi',
  name: 'Kahurangi',
  unlockCondition: null,

  terrain: {
    noiseScale: 0.005,
    octaves: 3,
    persistence: 0.3,
    lacunarity: 3.0,
    ridgeInfluence: 1.3,
    elevationPower: 1.5,
    islandFalloff: 0.6,
    plantDensity: 0.006,
    useLakes: false
  },

  biomes: {
    sea: {
      key: 'sea', name: "Sea", minElevation: 0, maxElevation: 0.1,
      colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#0f2533',
      walkable: false, canHavePlants: false, canPlace: false
    },
    coastal: {
      key: 'coastal', name: "Coastal/Beach", minElevation: 0.1, maxElevation: 0.15,
      colors: ['#c2b280', '#d4c794', '#e6dca8'], contourColor: '#8a7d5a',
      walkable: true, canHavePlants: false, canPlace: true
    },
    grassland: {
      key: 'grassland', name: "Lowland Grassland", minElevation: 0.15, maxElevation: 0.3,
      colors: ['#7fb069', '#8fbc79', '#9fc889'], contourColor: '#5a7d4a',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'flax'], canPlace: true
    },
    podocarp: {
      key: 'podocarp', name: "Podocarp Forest", minElevation: 0.3, maxElevation: 0.4,
      colors: ['#2d5a3d', '#346644', '#3b724b'], contourColor: '#1e3d29',
      walkable: true, canHavePlants: true, plantTypes: ['fern', 'rimu'], canPlace: true
    },
    montane: {
      key: 'montane', name: "Montane Forest", minElevation: 0.4, maxElevation: 0.60,
      colors: ['#4a7c59', '#528764', '#5a926f'], contourColor: '#335740',
      walkable: true, canHavePlants: true,
      plantTypes: ['beech', 'fern', 'patotara'], canPlace: true
    },
    subalpine: {
      key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.60, maxElevation: 0.80,
      colors: ['#a8a060', '#b5ad6d', '#c2ba7a'], contourColor: '#7a7445',
      walkable: true, canHavePlants: true,
      plantTypes: ['tussock', 'patotara'], canPlace: true
    },
    alpine: {
      key: 'alpine', name: "Alpine Rock", minElevation: 0.77, maxElevation: 0.9,
      colors: ['#8b8b8b', '#9a9a9a', '#a9a9a9'], contourColor: '#5c5c5c',
      walkable: false, canHavePlants: false, canPlace: false
    },
    snow: {
      key: 'snow', name: "Permanent Snow", minElevation: 0.9, maxElevation: 1.0,
      colors: ['#e8e8e8', '#f0f0f0', '#ffffff'], contourColor: '#b0b0b0',
      walkable: false, canHavePlants: false, canPlace: false
    }
  },

  species: {
    moa: ['upland_moa'],
    eagle: ['haasts_eagle']
  },
  startingSpecies: 'upland_moa',

  initialEntityCounts: {
    moa: 7,
    eagle: 2
  },

  economy: {
    startingMauri: 60,
    seasonDuration: 2100,
    eggIncubationTime: 500,
    securityTimeToLay: 800,
    securityTimeVariation: 200,
    layingHungerThreshold: 28,
    eagleSpawnMilestones: [12, 18, 25, 35, 45, 55],
    maxPopulation: 60
  },

  availablePlaceables: {
    kawakawa:  { cost: 25 },
    shelter:   { cost: 40 },
    nest:      { cost: 50 },
    Storm:     { cost: 35 },
    waterhole: { cost: 45 },
    harakeke:  { cost: 30 }
  },

  goals: [
    { name: "Hatch 5 eggs",           condition: (sim) => sim.stats.births >= 5, reward: 50 },
    { name: "Hatch 10 eggs",          condition: (sim) => sim.stats.births >= 10, reward: 100 },
    { name: "Raise population to 15", condition: (sim, game) => game._cachedMoaCount >= 15, reward: 50 },
    { name: "Raise population to 20", condition: (sim, game) => game._cachedMoaCount >= 20, reward: 50 },
    { name: "Raise population to 30", condition: (sim, game) => game._cachedMoaCount >= 30, reward: 100 },
    { name: "Reach 1 minute",         condition: (sim, game) => game.playTime >= 3600, reward: 50 },
    { name: "Reach 3 minutes",        condition: (sim, game) => game.playTime >= 10800, reward: 100 },
    { name: "Reach 4 minutes",        condition: (sim, game) => game.playTime >= 14400, reward: 100 }
  ],

  menu: {
    title: "Avian Age:  MAURI Demo",
    subtitle: "A New Zealand Ecosystem Strategy Game",
    areaLabel: "Area #1: Kahurangi, Te Waipounamu",
    areaSubtitle: "(Upper West Coast, South Island)",
    featuredSpecies: {
      key: 'upland_moa',
      displayName: 'Upland Moa',
      localName: 'Moa Koukou',
      spriteKey: 'moa_idle',
      spriteScale: 2
    },
    flavorText: [
      "Guide the Upland Moa through the seasons;",
      "Nurture the ecosystem to gain Mauri...",
      "And beware the giant Haast's eagle, Pouākai!"
    ],
    displayPlants: ['tussock', 'flax', 'fern', 'rimu', 'beech', 'kawakawa', 'patotara']
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  }
};

LEVEL_REGISTRY.register(LEVEL_KAHURANGI);