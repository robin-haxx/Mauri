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
    plantDensity: 0.008,
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
      plantTypes: ['tussock', 'coprosma', 'flax'], canPlace: true
    },
    shrubland: {
      key: 'shrubland', name: "Frost Shrubland", minElevation: 0.28, maxElevation: 0.36,
      colors: ['#7c8858', '#889464', '#94a070'], contourColor: '#5a6640',
      walkable: true, canHavePlants: true,
      plantTypes: ['coprosma', 'patotara', 'tussock', 'dracophyllum'], canPlace: true
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
    eagle: ['haasts_eagle'],
    // Flighted forest birds — ambient population, seeded and bred like the moa but
    // via the otherEntities path (mauri_kereru.js / mauri_kokako.js). They feed on
    // the forestRefuge canopy (beech/rimu/fern) and thin with it in the glacial.
    other: ['kereru', 'kokako']
  },
  startingSpecies: 'upland_moa',

  // Seeded at each species' own preferred elevation, so they start in-habitat.
  initialSpeciesDistribution: {
    'little_bush_moa': 4,
    'upland_moa': 6,
    'stout_legged_moa': 2,
    'south_island_giant_moa': 3,
    'heavy_footed_moa': 2
  },

  initialEntityCounts: {
    moa: 14,
    eagle: 1,
    kereru: 4,     // founding flock — breeds up toward kereru maxPopulation (16)
    kokako: 3      // founding birds — breeds up toward kokako maxPopulation (10)
  },

  economy: {
    startingMauri: 60,
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
    // Plants
    lancewood: { cost: 30 },   // slot 1 — bush moa (emeid)
    speargrass: { cost: 30 },  // slot 2 — upland moa (Megalapteryx)
    // Habitat items
    shelter:   { cost: 35 },   // slot 3
    nest:      { cost: 55 },   // slot 4
    waterhole: { cost: 35 },   // slot 5
    // Storm
    Storm:     { cost: 40 }    // slot 6
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

    // Favoured plants are FULLY exclusive to the species they belong to: a
    // non-favoured moa gains NOTHING from them. Speargrass feeds only the upland
    // moa, lancewood only the bush moa — the two founders never cross-feed, and
    // competitors can't nibble the plots either. 0 = no benefit at all.
    unfavouredBrowsePenalty: 0,

    // Non-focal competitors are generalists: they get a bonus on the WILD
    // background flora (any plant with no favouredSpecies) so they sustain
    // themselves off the landscape instead of raiding the founders' plots. This
    // is their niche edge. 1.0 = off; raise for hardier competitors.
    nonFocalGeneralistBonus: 1.2,

    // ---- Measured reproduction ----------------------------------------------
    // Soft carrying capacity: breeding readiness is full at/below breedingSoftCap
    // total moa, then tapers toward breedingSuppressFloor as the population climbs
    // to breedingCarryingCap. Flattens the unprompted spring boom; because it
    // keys off live population it eases back off after a winter crash so the
    // founders can still rebound. TUNE THESE against a benchmark run.
    breedingSoftCap: 10,          // no suppression at/below this many moa
    breedingCarryingCap: 30,      // suppression bottoms out here
    breedingSuppressFloor: 0.12,  // min breeding rate at/above the carrying cap
    breedingCooldownMult: 1.3,    // flat lengthening of every breeding cooldown
    matingAge: 1200,              // later maturity (global MOA_AGE.MATING_AGE is 900)

    // Reproduction slows in the deep cold (ramped by winterness, not a cliff).
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
    populationFloors: {
      south_island_giant_moa: 2,
      stout_legged_moa: 2,
      heavy_footed_moa: 2
    },

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
    eagleTargetRatio: 1 / 8,      // ← the main knob (one eagle per six moa)
    eagleMaxPopulation: 8,       // hard safety cap on total eagles
    eagleHungerRate: 0.02,        // how fast an unfed eagle's hunger climbs
    eagleStarveThreshold: 90,     // hunger above this accrues starvation
    eagleStarveTimeout: 2400,      // ticks of sustained starvation before death
    eagleReproChance: 0.4,        // base lay chance at full breeding pressure
    eagleReproCooldown: 2600,     // ticks between clutches for one bird
    eagleReproCheckInterval: 220, // how often a calm, fed adult considers laying
    eagleMaturityAge: 1500,       // ticks before a hatchling can breed
    eaglePreyPopThreshold: 12,    // eagles prioritise moa species with MORE than this many members (spares rare species)

    // ---- Sexual eagle reproduction + Lotka-Volterra restraint ----
    // The run starts as a breeding PAIR: the spawned founder plus one opposite-sex
    // egg at a crag eyrie, hatching after startingEagleEggHatchTime ticks (~30s).
    // A female only lays with a mature male within eagleMateRadius; if a sex is
    // lost the line dies out (and the game is lost — see mauri_sketch.js).
    startingEagleEggHatchTime: 1800,  // ~30s at 60fps
    eagleMateRadius: 250,             // a female needs a mature male this close to lay
    // Anti-overhunt: when eagles exceed the target eagle:moa ratio (e.g. after a
    // sudden moa die-off), each bird tolerates this much extra hunger before
    // hunting, so the surplus starves off instead of cropping the last herd.
    eagleOverhuntRestraint: 30,       // hunger added per unit of over-ratio surplus
    eagleRestraintCap: 45,            // max extra hunger tolerance (keeps them hunting eventually)

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

  // Per-level final score. This phase level runs a fixed ~8 minutes, so it omits
  // the default formula's time penalty and just rewards the surviving flock and
  // total mauri earned. Tune freely — ctx = {moaCount, totalEarned, playTime,
  // goalsCompleted, level}.
  scoreFormula: (ctx) => (ctx.moaCount * (ctx.totalEarned * 0.001)) + 60,

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
      failReason: "One of your moa species was lost!"
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
      failReason: "One of your moa species was lost!"
    }
  ],

  menu: {
    title: "Glacial Kahurangi",
    subtitle: "~21,000 years ago",
    areaLabel: "NW Nelson, Te Waipounamu",
    areaSubtitle: "Upper West Coast, South Island",
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
    tips: null   // script: levels/tutorial_02_glacial_kahurangi.js (TUTORIAL_REGISTRY)
  }
};

LEVEL_REGISTRY.register(LEVEL_GLACIAL_KAHURANGI);