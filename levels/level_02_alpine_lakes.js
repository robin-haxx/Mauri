// ============================================
// LEVEL 2: Alpine Lakes — Inland Canterbury
// Multi-species balance challenge
// ============================================

const LEVEL_ALPINE_LAKES = {
  id: 'alpine_lakes',
  name: 'Te Roto Kōhatu',
  unlockCondition: (progress) => progress.levelsCompleted.includes('kahurangi'),

  terrain: {
    noiseScale: 0.004,
    octaves: 4,
    persistence: 0.35,
    lacunarity: 2.8,
    ridgeInfluence: 1.5,
    elevationPower: 1.3,
    islandFalloff: 0.0,
    plantDensity: 0.005,
    useLakes: true,
    lakeThreshold: 0.12,
    lakeNoiseScale: 0.008
  },

  biomes: {
    lake: {
      key: 'lake', name: "Glacial Lake", minElevation: 0, maxElevation: 0.12,
      colors: ['#2a5a7a', '#3a6d8e', '#4a80a2'], contourColor: '#1a3d55',
      walkable: false, canHavePlants: false, canPlace: false,
      isWater: true
    },
    lakeshore: {
      key: 'lakeshore', name: "Lakeshore", minElevation: 0.12, maxElevation: 0.17,
      colors: ['#8a9a72', '#96a67e', '#a2b28a'], contourColor: '#6a7a55',
      walkable: true, canHavePlants: true,
      plantTypes: ['flax', 'tussock'], canPlace: true
    },
    grassland: {
      key: 'grassland', name: "Valley Grassland", minElevation: 0.17, maxElevation: 0.28,
      colors: ['#7aaa62', '#88b870', '#96c67e'], contourColor: '#5a8a45',
      walkable: true, canHavePlants: true,
      plantTypes: ['tussock', 'flax', 'kawakawa'], canPlace: true
    },
    beechForest: {
      key: 'beechForest', name: "Beech Forest", minElevation: 0.28, maxElevation: 0.42,
      colors: ['#2d5a3d', '#346644', '#3b724b'], contourColor: '#1e3d29',
      walkable: true, canHavePlants: true,
      plantTypes: ['beech', 'fern', 'rimu'], canPlace: true
    },
    montane: {
      key: 'montane', name: "Montane Scrub", minElevation: 0.42, maxElevation: 0.58,
      colors: ['#4a7c59', '#528764', '#5a926f'], contourColor: '#335740',
      walkable: true, canHavePlants: true,
      plantTypes: ['beech', 'patotara', 'fern'], canPlace: true
    },
    subalpine: {
      key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.58, maxElevation: 0.72,
      colors: ['#a8a060', '#b5ad6d', '#c2ba7a'], contourColor: '#7a7445',
      walkable: true, canHavePlants: true,
      plantTypes: ['tussock', 'patotara'], canPlace: true
    },
    alpine: {
      key: 'alpine', name: "Alpine Scree", minElevation: 0.72, maxElevation: 0.85,
      colors: ['#8b8b8b', '#9a9a9a', '#a9a9a9'], contourColor: '#5c5c5c',
      walkable: false, canHavePlants: false, canPlace: false
    },
    snow: {
      key: 'snow', name: "Permanent Snow", minElevation: 0.85, maxElevation: 1.0,
      colors: ['#e8e8e8', '#f0f0f0', '#ffffff'], contourColor: '#b0b0b0',
      walkable: false, canHavePlants: false, canPlace: false
    }
  },

  species: {
    moa: [
      'south_island_giant_moa',
      'crested_moa',
      'eastern_moa',
      'stout_legged_moa'
    ],
    eagle: ['haasts_eagle', 'young_haasts_eagle'],
    other: ['weka', 'kea']
  },
  startingSpecies: 'crested_moa',

  initialEntityCounts: {
    moa: 5,
    eagle: 1,
    weka: 4,
    kea: 3
  },

  initialSpeciesDistribution: {
    'south_island_giant_moa': 1,
    'crested_moa': 2,
    'eastern_moa': 1,
    'stout_legged_moa': 1
  },

  economy: {
    startingMauri: 80,
    seasonDuration: 1800,
    eggIncubationTime: 600,
    securityTimeToLay: 900,
    securityTimeVariation: 300,
    layingHungerThreshold: 25,
    eagleSpawnMilestones: [15, 25, 35],
    maxPopulation: 50
  },

  availablePlaceables: {
    kawakawa:  { cost: 30 },
    shelter:   { cost: 35 },
    nest:      { cost: 55 },
    Storm:     { cost: 40 },
    waterhole: { cost: 35 },
    harakeke:  { cost: 25 }
  },

  goals: [
    {
      name: "3+ of each moa species alive",
      condition: (sim) => {
        const species = ['south_island_giant_moa', 'crested_moa', 'eastern_moa', 'stout_legged_moa'];
        return species.every(s => {
          const count = sim.moas.filter(m => m.alive && m.speciesKey === s).length;
          return count >= 3;
        });
      },
      reward: 100
    },
    {
      name: "Total bird population reaches 25",
      condition: (sim, game) => {
        const moa = game._cachedMoaCount;
        const weka = (sim.otherEntities.weka || []).filter(w => w.alive).length;
        const kea = (sim.otherEntities.kea || []).filter(k => k.alive).length;
        return (moa + weka + kea) >= 25;
      },
      reward: 80
    },
    {
      name: "Maintain 2+ weka for 1 minute",
      condition: (sim) => sim.wekaStableTime >= 3600,
      reward: 60
    },
    {
      name: "Maintain 2+ kea for 1 minute",
      condition: (sim) => sim.keaStableTime >= 3600,
      reward: 60
    },
    {
      name: "Hatch 8 eggs across all species",
      condition: (sim) => sim.stats.births >= 8,
      reward: 80
    },
    {
      name: "No species extinct for 2 minutes",
      condition: (sim, game) => {
        return game.playTime >= 7200 && !sim.stats.anySpeciesExtinct;
      },
      reward: 120
    },
    {
      name: "Reach 3 minutes",
      condition: (sim, game) => game.playTime >= 10800,
      reward: 100
    }
  ],

  menu: {
    title: "Avian Age:  Alpine Lakes",
    subtitle: "A New Zealand Ecosystem Strategy Game",
    areaLabel: "Area #2: Te Roto Kōhatu, Canterbury Alps",
    areaSubtitle: "(Inland Canterbury, South Island)",
    featuredSpecies: {
      key: 'south_island_giant_moa',
      displayName: 'South Island Giant Moa',
      localName: 'Te Moa Nui',
      spriteKey: 'moa_idle',
      spriteScale: 2.5
    },
    flavorText: [
      "Balance five bird species in the glacial highlands;",
      "Giant moa roam the valleys while kea rule the peaks.",
      "Watch out — kea are clever enough to raid nests!"
    ],
    displayPlants: ['tussock', 'flax', 'fern', 'beech', 'patotara', 'kawakawa']
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  },

  mechanics: {
    keaNestDisruption: true,
    keaDisruptionRadius: 60,
    keaDisruptionChance: 0.003,
    wekaFoodCompetition: true,
    wekaCompetitionRadius: 40,
    wekaFeedingPenalty: 0.3,
    nicheElevationPressure: true,
    nicheStressPenalty: 0.02
  }
};

LEVEL_REGISTRY.register(LEVEL_ALPINE_LAKES);