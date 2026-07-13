// ============================================
// LEVEL 2: Kahurangi — Glacial Maximum (LGM)
// Species variation across habitats + a scarce, contested forest.
// No speciation. Four 2-season PHASES starting in spring: grow two founders
// (emeid bush moa + Megalapteryx upland moa) using their favoured, browse-
// resistant plants, then endure two glacial winters without losing either.
// ~8 minutes total.
// ============================================

// The two founder populations the phases care about.
const GK_EMEID = 'little_bush_moa';        // bush moa (Emeidae)
const GK_MEGALAPTERYX = 'upland_moa';      // upland moa (Megalapteryx)

function gkCount(sim, key) {
  let n = 0;
  const m = sim.moas;
  for (let i = 0; i < m.length; i++) {
    if (m[i].alive && m[i].speciesKey === key) n++;
  }
  return n;
}

// A winter phase is failed if either founder population is wiped out.
function gkFocalExtinct(sim) {
  return gkCount(sim, GK_EMEID) === 0 || gkCount(sim, GK_MEGALAPTERYX) === 0;
}

// ---- Tutorial condition helpers ----
function gkEagleHuntingFocal(sim) {
  const eagles = sim.eagles || [];
  for (let i = 0; i < eagles.length; i++) {
    const e = eagles[i];
    if (e.hunting && e.target &&
        (e.target.speciesKey === GK_EMEID || e.target.speciesKey === GK_MEGALAPTERYX)) {
      return e.target.speciesKey;
    }
  }
  return null;
}
function gkEagleHuntingScarceFocal(sim) {
  const k = gkEagleHuntingFocal(sim);
  return k ? gkCount(sim, k) < 3 : false;
}
function gkCanAffordStorm(game) {
  const p = game.activePlaceables && game.activePlaceables.Storm;
  return p ? game.mauri.mauri >= p.cost : false;
}
function gkGrowthUnmet(sim) {
  return gkCount(sim, GK_EMEID) < 5 || gkCount(sim, GK_MEGALAPTERYX) < 10;
}

// ============================================
// TUTORIAL SCRIPT (level-scoped; replaces the default tips)
// ============================================
const GK_TUTORIAL_TIPS = {
  // ---------- SPRING: intro chain (fires at game start) ----------
  gk_spring_1: {
    id: 'gk_spring_1',
    trigger: { type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.GAME_START },
    title: "Brr... sure is cold out, eh?",
    content: [
      "That's because the 'season' of the earth has turned.", 
      "The temperature has dropped, and the snow has crept pretty far down the mountains!",
      "",
      "This makes that dark green beech and rimu forest a lot patchier."
    ],
    guidePosition: 'center', highlight: null,
    nextTip: 'gk_spring_speargrass', pauseGame: true, showOnce: true, priority: 0
  },
  gk_spring_speargrass: {
    id: 'gk_spring_speargrass',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Good news for your friend the Upland Moa!",
    content: [
      "There's a lot more subalpine habitat, and you've unlocked a favourite food: speargrass!",
      "",
      "Each moa has a favourite food, which can boost its population as well as guide them to new areas.",
      "",
      "You don't want to leave any species behind, or they'll disappear from these hills forever!"
    ],
    guidePosition: 'bottomLeft', highlight: { type: 'element', target: 'tool:speargrass' },
    nextTip: 'gk_spring_bushmoa', pauseGame: true, showOnce: true, priority: 0
  },
  gk_spring_bushmoa: {
    id: 'gk_spring_bushmoa',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Say hello to the new Moa!",
    content: [
      "I hereby promote your guardianship:","You now also protect the little bush moa!",
      "They inhabit dense forest and have a ","special beak for shearing tough plants,",
      "but because of this climate they're particularly vulnerable right now and need your attention."
    ],
    guidePosition: 'center', highlight: null,
    nextTip: 'gk_spring_lancewood', pauseGame: true, showOnce: true, priority: 0
  },
  gk_spring_lancewood: {
    id: 'gk_spring_lancewood',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "How about some horoeka?",
    content: [
      "To help the bush moa out, try planting some of this ","scrub which only they will eat: lancewood.",
      "They might be little, but they have ","strong beaks and can chomp on lancewood when it's small and spiky!"
    ],
    guidePosition: 'bottomLeft', highlight: { type: 'element', target: 'tool:lancewood' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 0
  },

  // ---------- SPRING: after ~15s of play ----------
  gk_spring_corridor: {
    id: 'gk_spring_corridor',
    trigger: { type: TRIGGER_TYPE.TIME, delay: 900 },
    title: "Lead Them to Food",
    content: [
      "If their patch of forest is too small, you'll need to lead them somewhere new.","",
      "Place a line of lancewood to create a 'corridor' for the bush moa!"
    ],
    guidePosition: 'bottomLeft', highlight: { type: 'element', target: 'tool:lancewood' },
    nextTip: 'gk_spring_mauri', pauseGame: true, showOnce: true, priority: 2
  },
  gk_spring_mauri: {
    id: 'gk_spring_mauri',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Mauri & Competition",
    content: [
      "You'll get more Mauri for having more moa, but keep in mind that some species can out-compete others, which can lead to local extinctions."
    ],
    guidePosition: 'topLeft', highlight: { type: 'element', target: 'mauriDisplay' },
    nextTip: 'gk_spring_goals', pauseGame: true, showOnce: true, priority: 2
  },
  gk_spring_goals: {
    id: 'gk_spring_goals',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Your Goals",
    content: [
      "You need to grow the populations of both vulnerable moa to get full marks for this level!","",
      "Total moa count isn't our focus here — but if you grow all populations in balance, the Mauri will come pouring in!"
    ],
    guidePosition: 'left', highlight: { type: 'element', target: 'goalsPanel' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  // ---------- SPRING: nudge if the founders are lagging ----------
  gk_spring_nest: {
    id: 'gk_spring_nest',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (g) => g.seasonManager && g.seasonManager.currentKey === 'spring' &&
                        g.playTime > 1800 && g.mauri.mauri >= 60 && gkGrowthUnmet(g.simulation),
      cooldown: 3600
    },
    title: "Nesting Sites",
    content: [
      "When you've found a safe location, nesting sites will boost population growth, just like before.","",
      "Remember: moa need to be well-fed and unthreatened by patrolling eagles to reproduce!"
    ],
    guidePosition: 'left', highlight: { type: 'element', target: 'tool:nest' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  // ---------- AUTUMN ----------
  gk_autumn_1: {
    id: 'gk_autumn_1',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.SEASON_CHANGE,
      condition: (g, d) => d.seasonKey === 'autumn'
    },
    title: "Feel that chilly gust just now?",
    content: [
      "You'll need to prepare your moa for winter.",
      "It's not enough to just plant some ferns downhill this time; try to guide all the moa to something suitable.","",
      "It's alright if you lose some moa in the winter. There's less to eat, so a rise and fall in numbers is natural.","","Think about the right food to place so each species can bounce back when it gets warmer!"
    ],
    guidePosition: 'topRight', highlight: { type: 'element', target: 'seasonDisplay' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  },
  gk_autumn_storm: {
    id: 'gk_autumn_storm',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (g) => g.seasonManager && g.seasonManager.currentKey === 'autumn' &&
                        g.seasonManager.timer > 900 &&
                        gkEagleHuntingFocal(g.simulation) && gkCanAffordStorm(g),
      cooldown: 1200
    },
    title: "Bamboozle an eagle!",
    content: [
      "Here's a secret weapon: our good friend Tāwhirimātea!",
      "Call on a mighty thunderstorm to distract the hunting Pouākai!"
    ],
    guidePosition: 'bottomRight', highlight: { type: 'element', target: 'tool:Storm' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 1, urgency: 'high'
  },

  // ---------- WINTER ----------
  gk_winter_1: {
    id: 'gk_winter_1',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.SEASON_CHANGE,
      condition: (g, d) => d.seasonKey === 'winter'
    },
    title: "The Big Chill",
    content: [
      "The big chill is here, and it looks like it's a doozy.",
      "Now is the time to use your Mauri to safeguard as many moa as possible!"
    ],
    guidePosition: 'center', highlight: null,
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  },
  gk_winter_storm: {
    id: 'gk_winter_storm',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (g) => g.seasonManager && g.seasonManager.currentKey === 'winter' &&
                        gkEagleHuntingScarceFocal(g.simulation) && gkCanAffordStorm(g),
      cooldown: 1200
    },
    title: "Call the Storm",
    content: [
      "Your last line of defence is our good friend Tāwhirimātea.",
      "Call on a mighty thunderstorm to distract hunting Pouākai!"
    ],
    guidePosition: 'bottomRight', highlight: { type: 'element', target: 'tool:Storm' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 1, urgency: 'high'
  },

  // ---------- SPRING (second year) ----------
  gk_spring2: {
    id: 'gk_spring2',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.SEASON_CHANGE,
      condition: (g, d) => d.seasonKey === 'spring'
    },
    title: "You Made It!",
    content: [
      "Phew! Good stuff. That's the worst of it, and now you only have the giant, killer eagles to worry about.","",
      "Maybe this will be a bumper year for your moa community!","",
      "Just remember: with more creatures comes more trouble to manage… but you've proven yourself a very capable kaitiaki so far!"
    ],
    guidePosition: 'center', highlight: null,
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  }
};

const LEVEL_GLACIAL_KAHURANGI = {
  id: 'glacial_kahurangi',
  name: 'Taihekenga Huka',
  // Open for playtesting. To gate it behind Level 1 again, restore the line below:
  // unlockCondition: (progress) => progress.levelsCompleted.includes('kahurangi'),
  unlockCondition: null,

  // View: zoomed out ~50% vs the default 2.5 (shows ~1.5x the map units).
  zoom: 1.667,
  // The run opens in spring so the four 2-season phases read spring→summer,
  // autumn→winter, spring→summer, autumn→winter.
  startSeason: 'spring',

  terrain: {
    noiseScale: 0.005,
    octaves: 3,
    persistence: 0.32,
    lacunarity: 3.0,
    ridgeInfluence: 1.6,
    elevationPower: 1.4,
    islandFalloff: 0.2,
    plantDensity: 0.007,
    useLakes: false
  },

  // Glacial biome bands: the forest is compressed into a thin refuge, while
  // open glacial flats, shrubland and subalpine tussock dominate the country.
  // Permanent ice starts low (0.80) rather than the interglacial 0.90.
  biomes: {
    sea: {
      key: 'sea', name: "Sea", minElevation: 0, maxElevation: 0.10,
      colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#0f2533',
      walkable: false, canHavePlants: false, canPlace: false
    },
    coastal: {
      key: 'coastal', name: "Glacial Outwash", minElevation: 0.10, maxElevation: 0.15,
      colors: ['#b8b09a', '#c4bca6', '#d0c8b2'], contourColor: '#8a8270',
      walkable: true, canHavePlants: false, canPlace: true
    },
    glacialFlats: {
      key: 'glacialFlats', name: "Glacial Flats", minElevation: 0.15, maxElevation: 0.28,
      colors: ['#9aa878', '#a6b484', '#b2c090'], contourColor: '#6f7d52',
      walkable: true, canHavePlants: true,
      plantTypes: ['tussock', 'matagouri', 'coprosma', 'flax'], canPlace: true
    },
    shrubland: {
      key: 'shrubland', name: "Frost Shrubland", minElevation: 0.28, maxElevation: 0.36,
      colors: ['#7c8858', '#889464', '#94a070'], contourColor: '#5a6640',
      walkable: true, canHavePlants: true,
      plantTypes: ['coprosma', 'matagouri', 'tussock', 'dracophyllum'], canPlace: true
    },
    forestRefuge: {
      key: 'forestRefuge', name: "Forest Refuge", minElevation: 0.36, maxElevation: 0.48,
      colors: ['#2d5240', '#345e48', '#3b6a50'], contourColor: '#1e3a2c',
      walkable: true, canHavePlants: true,
      plantTypes: ['beech', 'rimu', 'fern'], canPlace: true
    },
    subalpine: {
      key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.48, maxElevation: 0.66,
      colors: ['#9a9a62', '#a6a66e', '#b2b27a'], contourColor: '#70703f',
      walkable: true, canHavePlants: true,
      plantTypes: ['tussock', 'dracophyllum', 'patotara'], canPlace: true
    },
    alpine: {
      key: 'alpine', name: "Alpine Scree", minElevation: 0.66, maxElevation: 0.80,
      colors: ['#9098a0', '#9ea6ae', '#acb4bc'], contourColor: '#606870',
      walkable: false, canHavePlants: false, canPlace: false
    },
    glacier: {
      key: 'glacier', name: "Glacier & Ice", minElevation: 0.80, maxElevation: 1.0,
      colors: ['#dfe8ee', '#eaf2f6', '#ffffff'], contourColor: '#a8c0cc',
      walkable: false, canHavePlants: false, canPlace: false
    }
  },

  species: {
    moa: [
      'little_bush_moa',       // FOUNDER: closed-forest emeid (favoured: lancewood)
      'upland_moa',            // FOUNDER: subalpine Megalapteryx (favoured: speargrass)
      'stout_legged_moa',      // open glacial-flats emeid — a competitor
      'south_island_giant_moa',// lowland browser — a rival for the forest
      'heavy_footed_moa'       // forest-edge Pachyornis — competes at the margin
    ],
    eagle: ['haasts_eagle']
  },
  startingSpecies: 'upland_moa',

  // Seeded at each species' own preferred elevation, so they start in-habitat.
  initialSpeciesDistribution: {
    'little_bush_moa': 4,
    'upland_moa': 5,
    'stout_legged_moa': 2,
    'south_island_giant_moa': 3,
    'heavy_footed_moa': 2
  },

  initialEntityCounts: {
    moa: 14,
    eagle: 1
  },

  economy: {
    startingMauri: 110,
    seasonDuration: 3600,        // 8 seasons x 3600 = ~8 minutes across 4 phases
    eggIncubationTime: 600,
    securityTimeToLay: 900,
    securityTimeVariation: 300,
    layingHungerThreshold: 26,
    eagleSpawnMilestones: [],    // eagles now driven by predator-prey coupling
    maxPopulation: 55
  },

  // Favoured, browse-resistant plants occupy the first two palette slots.
  availablePlaceables: {
    lancewood: { cost: 30 },   // slot 1 — bush moa (emeid)
    speargrass: { cost: 30 },  // slot 2 — upland moa (Megalapteryx)
    nest:      { cost: 55 },
    shelter:   { cost: 35 },
    Storm:     { cost: 40 },
    waterhole: { cost: 35 }
  },

  // Opt-in gameplay mechanics (read by mauri_moa.js / mauri_plant.js /
  // mauri_seasons.js / mauri_simulation.js). Absent on other levels.
  mechanics: {
    // Moa foraging far outside their species niche burn extra energy — worse in winter.
    habitatStress: true,
    habitatStressMargin: 0.10,
    habitatStressPenalty: 0.45,
    winterStressMult: 1.4,

    // The forest refuge is a limited, contested larder — competition bites hardest in winter.
    forestCompetition: true,
    forestBiomes: ['forestRefuge'],
    forestCompetitionRadius: 45,
    forestCompetitionTolerance: 2,
    forestCompetitionPenalty: 0.18,
    winterCompetitionMult: 1.7,

    // Favoured plants: non-favoured species gain only 25% and mostly ignore them.
    unfavouredBrowsePenalty: 0.25,

    // Reproduction slows in the deep cold.
    winterBreedingCooldownMult: 2,

    // Fixed cast: offspring always inherit the parent species (no random
    // mutation to off-level moa). This level is about coexistence, not speciation.
    noSpeciation: true,

    // The two founders the phases protect. Every OTHER moa is "non-focal" — a
    // competitor that sustains itself a little better (breeds faster, favours its
    // own kind more). See mauri_moa.js.
    focalSpecies: ['little_bush_moa', 'upland_moa'],

    // Hard ceiling per moa species (stops any one competitor swamping the map).
    maxPerSpecies: 20,

    // Population floors: the last N of these species can't be hunted or starved,
    // so the species can't be wiped out below the floor.
    populationFloors: { south_island_giant_moa: 2 },

    // Pulsing highlight on still-vulnerable founders until they recover past the
    // threshold — light yellow for the bush moa, light grey for the Megalapteryx.
    vulnerableHighlight: {
      little_bush_moa: { color: [255, 250, 150], until: 5 },
      upland_moa:      { color: [220, 220, 232], until: 5 }
    },

    // Emergent eagles: instead of a top-down controller setting the eagle count,
    // each eagle holds a nest, feeds or starves on its own energy, and breeds with
    // a varied drive. The population ebbs and flows from those births and deaths.
    // TUNE THIS: the drive to reproduce is pulled toward a target eagle:moa RATIO,
    // not a fixed eagle count. 1/6 ≈ one eagle per six moa. Raise it for more
    // predation pressure, lower it for a lighter touch.
    emergentEagles: true,
    eagleTargetRatio: 1 / 6,      // ← the main knob (one eagle per six moa)
    eagleMaxPopulation: 8,       // hard safety cap on total eagles
    eagleHungerRate: 0.02,        // how fast an unfed eagle's hunger climbs
    eagleStarveThreshold: 90,     // hunger above this accrues starvation
    eagleStarveTimeout: 2400,      // ticks of sustained starvation before death
    eagleReproChance: 0.4,        // base lay chance at full breeding pressure
    eagleReproCooldown: 2600,     // ticks between clutches for one bird
    eagleReproCheckInterval: 220, // how often a calm, fed adult considers laying
    eagleMaturityAge: 1500,       // ticks before a hatchling can breed
    eaglePreyPopThreshold: 12,    // eagles prioritise moa species with MORE than this many members (spares rare species)

    // Forest contraction: the productive tree band retreats (treeline drops) in
    // the cold seasons; canopy trees above the band go unproductive/wilted.
    // Lerped smoothly per frame like the snow line (no reclassification, no stutter).
    forestContraction: true,
    forestBand: { min: 0.36, max: 0.48 },
    forestBandBySeason: {
      spring: { min: 0.36, max: 0.48 },
      summer: { min: 0.36, max: 0.48 },
      autumn: { min: 0.36, max: 0.45 },
      winter: { min: 0.36, max: 0.42 }
    }
  },

  // Classic static-goal field kept empty so validation passes; the level is
  // actually driven by `phases` below.
  goals: [],

  // Four 2-season phases. Growth objectives are soft (reward only). Winter
  // phases are lost if either founder population is wiped out.
  phases: [
    {
      name: "Spring & Summer: Establish the founders",
      goals: [
        { name: "Have 5 of Bush Moa (Anomalopteryx)", reward: 60,
          condition: (sim) => gkCount(sim, GK_EMEID) >= 5 },
        { name: "Have 10 of Upland Moa (Megalapteryx)", reward: 90,
          condition: (sim) => gkCount(sim, GK_MEGALAPTERYX) >= 10 }
      ]
    },
    {
      name: "Autumn & Winter: Endure the first glacial",
      goals: [
        { name: "Keep both focus species alive through winter", reward: 100, survive: true }
      ],
      fail: (sim) => gkFocalExtinct(sim),
      failReason: "A founding population died out over the first winter."
    },
    {
      name: "Spring & Summer: Grow the community",
      goals: [
        { name: "Reach 10 Bush Moa (Anomalopteryx)", reward: 100,
          condition: (sim) => gkCount(sim, GK_EMEID) >= 10 },
        { name: "Reach 15 Upland Moa (Megalapteryx)", reward: 150,
          condition: (sim) => gkCount(sim, GK_MEGALAPTERYX) >= 15 }
      ]
    },
    {
      name: "Autumn & Winter: Endure the second glacial",
      goals: [
        { name: "Keep both focus species alive", reward: 200, survive: true }
      ],
      fail: (sim) => gkFocalExtinct(sim),
      failReason: "A founding population died out in the second winter."
    }
  ],

  menu: {
    title: "Avian Age:  Glacial Kahurangi",
    subtitle: "A New Zealand Ecosystem Strategy Game",
    areaLabel: "Area #2: Kahurangi (Glacial Maximum)",
    areaSubtitle: "NW Nelson, Te Waipounamu (~21,000 years ago.)",
    featuredSpecies: {
      key: 'little_bush_moa',
      displayName: 'Little Bush Moa',
      localName: 'Anomalopteryx didiformis',
      spriteKey: 'LB_moa_walk_01',
      spriteScale: 2           // dedicated bush moa art — no tint needed
    },
    flavorText: [
      "Glaciation advances...","",
      "Protect the bush moa in a shrinking forest,", 
      "And meet 4 new moa species!"
    ],
    displayPlants: ['lancewood', 'speargrass', 'tussock', 'coprosma', 'beech', 'patotara', 'dracophyllum'],

    art: {
      coreWidth: 1600,
      coreHeight: 1080,
      bgColor: [30, 40, 48]
    }
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: GK_TUTORIAL_TIPS
  }
};

LEVEL_REGISTRY.register(LEVEL_GLACIAL_KAHURANGI);