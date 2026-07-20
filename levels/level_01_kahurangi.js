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
    elevationPower: 1.4,
    islandFalloff: 0.6,
    plantDensity: 0.005,
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

  // Calendar: open in spring so the first autumn (and its "Seasons Turn"
  // tutorial moment) lands mid-level rather than immediately.
  startSeason: 'spring',

  // One spawned founder eagle; the emergent-eagle system adds an opposite-sex
  // founder egg at a crag eyrie (~30s hatch), completing the breeding pair.
  initialEntityCounts: {
    moa: 6,
    eagle: 1
  },

  economy: {
    startingMauri: 60,
    seasonDuration: 2100,
    eggIncubationTime: 700,
    securityTimeToLay: 1400,
    securityTimeVariation: 400,
    layingHungerThreshold: 28,
    eagleSpawnMilestones: [],   // eagles are driven by predator-prey coupling (mechanics below)
    maxPopulation: 40
  },

  // Emergent eagles (same system as level 2): no top-down spawn controller.
  // Each bird holds a nest, feeds or starves on its own energy budget, and a
  // fed female lays when a mature male is near — with the drive pulled toward
  // the target eagle:moa ratio. Tuning copied from level 2, capped lower for
  // the short 4-minute run.
  mechanics: {
    // Diminishing hatch rewards: full mauri (10) while the flock is 15 or
    // fewer, a token 5 up to 20, nothing beyond — late growth toward the
    // 30-moa bonus is its own reward rather than a mauri faucet.
    hatchReward: { full: 15, reduced: 20, reducedAmount: 5 },

    emergentEagles: true,
    eagleTargetRatio: 1 / 4,      // ← the main knob: ~one eagle per eight moa
    eagleMaxPopulation: 8,        // hard safety cap on total eagles
    eagleHungerRate: 0.03,        // how fast an unfed eagle's hunger climbs
    eagleStarveThreshold: 90,     // hunger above this accrues starvation
    eagleStarveTimeout: 2400,     // ticks of sustained starvation before death
    eagleReproChance: 0.4,        // base lay chance at full breeding pressure
    eagleReproCooldown: 1200,     // ticks between clutches for one bird
    eagleReproCheckInterval: 220, // how often a calm, fed adult considers laying
    eagleMaturityAge: 1500,       // ticks before a hatchling can breed
    eaglePreyPopThreshold: 12,    // spare rare prey (moot with one species, kept for consistency)
    startingEagleEggHatchTime: 1800,  // founder egg hatches ~30s in
    eagleMateRadius: 250,         // a female needs a mature male this close to lay
    eagleOverhuntRestraint: 30,   // extra hunger tolerance per unit over-ratio
    eagleRestraintCap: 45         // cap on that restraint so they hunt eventually
  },

  availablePlaceables: {
    kawakawa:  { cost: 25 },
    shelter:   { cost: 40 },
    nest:      { cost: 50 },
    Storm:     { cost: 35 },
    waterhole: { cost: 45 },
    harakeke:  { cost: 30 }
  },

  // The level runs to a fixed 4:00 end (timeLimit below); goals are rewards
  // along the way, not the win condition. The population goal is a bonus.
  timeLimit: 14400,   // 4 minutes @ 60fps

  // Losing the Upland Moa is losing the level: hatch mutations can spawn
  // cousin species, but they can't carry the sim to a win on their own.
  // Grace period while an upland-line egg (parentSpecies upland or unset,
  // which hatches upland by default) is still incubating.
  fail: (sim) => {
    if (sim.getCachedSpeciesCount('upland_moa') > 0) return false;
    for (let i = 0; i < sim.eggs.length; i++) {
      const e = sim.eggs[i];
      if (e.alive && !e.hatched && e.offspringType !== 'eagle' &&
          (!e.parentSpecies || e.parentSpecies === 'upland_moa')) return false;
    }
    return true;
  },
  failReason: "The Upland Moa vanished from Kahurangi...",
  goals: [
    { name: "Hatch 5 Upland Moa",          condition: (sim) => (sim.stats.birthsBySpecies['upland_moa'] || 0) >= 5, reward: 50 },
    { name: "Hatch 15 Upland Moa",         condition: (sim) => (sim.stats.birthsBySpecies['upland_moa'] || 0) >= 15, reward: 50 },
    { name: "Reach 2 minutes",             condition: (sim, game) => game.playTime >= 7200, reward: 50 },
    { name: "Reach 3 minutes",             condition: (sim, game) => game.playTime >= 10800, reward: 100 },
    { name: "BONUS: Have 30 Moa before 4:00", condition: (sim, game) => game._cachedMoaCount >= 30, reward: 100 }
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
      "Guide the Upland Moa through the seasons!","",
      "Nurture the ecosystem to gain Mauri...",
      "And beware the giant Haast's eagle, Pouākai."
    ],
    displayPlants: ['tussock', 'flax', 'fern', 'rimu', 'beech', 'kawakawa', 'patotara'],

    // The system renders a plain background if paths are missing or images fail to load.
    art: {
      // Dimensions of the core illustration in pixels (the "safe zone" visible at all ratios)
      coreWidth: 1600,
      coreHeight: 1080,

      // Background colour to fade into at illustration edges
      bgColor: [25, 35, 30],

      // Asset paths — uncomment and set when artwork is ready
      // paths: {
      //   core:        'assets/art/kahurangi_core.png',       // 1600×1080, full detail
      //   leftWing:    'assets/art/kahurangi_left.png',       // ~580×1080, atmospheric extension
      //   rightWing:   'assets/art/kahurangi_right.png',      // ~580×1080, atmospheric extension
      //   topBleed:    'assets/art/kahurangi_top.png',        // 1600×~200, sky/atmosphere
      //   bottomBleed: 'assets/art/kahurangi_bottom.png'      // 1600×~200, ground/foliage
      // }
    }
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  }
};

LEVEL_REGISTRY.register(LEVEL_KAHURANGI);