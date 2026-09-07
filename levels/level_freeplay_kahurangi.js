// ============================================
// FREE PLAY: Kahurangi — the deepening glacials (endless)
// ------------------------------------------------------------
// An endless survival mode. The same glacial Kahurangi as Level 2, but with no win:
// the climate OSCILLATES between glacial and interglacial years and DEEPENS across the
// run (stark swings, ramped ends, brutal by ~cycle 10 — see mauri_climate_drift.js).
//
// Each YEAR the game sets soft population goals on the TWO most-endangered species
// (nearest their floor); those focus species are protected from a total wipe while you
// rebuild them, and any extinct NON-focus species is refounded the next year. Winter
// takes FOOD VALUE, not plants — the evergreen flora stands frosted but stops feeding,
// so the forest refuge becomes the lifeline. Lose all your moa and the run ends.
//
// See FREEPLAY_PLAN.md. Reuses Level 2's terrain, biomes and cast almost verbatim.
// ============================================

const LEVEL_FREEPLAY_KAHURANGI = {
  id: 'freeplay_kahurangi',
  name: 'Taihekenga Mutunga-kore',   // "the endless descent into cold"
  unlockCondition: null,             // open for playtesting

  // Endless: no phases, no timed end, no win. checkGoals() short-circuits on this
  // flag to the rolling yearly-goal engine (an empty goals array would otherwise win
  // on frame one — see MISTAKES.md).
  endless: true,

  zoom: 1.667,
  startSeason: 'spring',

  terrain: {
    noiseScale: 0.005, octaves: 3, persistence: 0.32, lacunarity: 3.0,
    ridgeInfluence: 1.6, elevationPower: 1.4, islandFalloff: 0.2,
    plantDensity: 0.008, useLakes: false
  },

  // Glacial biome bands (identical to Level 2): a thin, contested forest refuge amid
  // open glacial flats, frost shrubland and subalpine tussock.
  biomes: {
    sea: { key: 'sea', name: "Sea", minElevation: 0, maxElevation: 0.10,
      colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#0f2533',
      walkable: false, canHavePlants: false, canPlace: false },
    coastal: { key: 'coastal', name: "Glacial Outwash", minElevation: 0.10, maxElevation: 0.15,
      colors: ['#b8b09a', '#c4bca6', '#d0c8b2'], contourColor: '#8a8270',
      walkable: true, canHavePlants: false, canPlace: true },
    glacialFlats: { key: 'glacialFlats', name: "Glacial Flats", minElevation: 0.15, maxElevation: 0.28,
      colors: ['#9aa878', '#a6b484', '#b2c090'], contourColor: '#6f7d52',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'coprosma', 'flax'], canPlace: true },
    shrubland: { key: 'shrubland', name: "Frost Shrubland", minElevation: 0.28, maxElevation: 0.36,
      colors: ['#7c8858', '#889464', '#94a070'], contourColor: '#5a6640',
      walkable: true, canHavePlants: true, plantTypes: ['coprosma', 'patotara', 'tussock', 'dracophyllum'], canPlace: true },
    forestRefuge: { key: 'forestRefuge', name: "Forest Refuge", minElevation: 0.36, maxElevation: 0.48,
      colors: ['#2d5240', '#345e48', '#3b6a50'], contourColor: '#1e3a2c',
      walkable: true, canHavePlants: true, plantTypes: ['beech', 'rimu', 'fern'], canPlace: true },
    subalpine: { key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.48, maxElevation: 0.66,
      colors: ['#9a9a62', '#a6a66e', '#b2b27a'], contourColor: '#70703f',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'dracophyllum', 'patotara'], canPlace: true },
    alpine: { key: 'alpine', name: "Alpine Scree", minElevation: 0.66, maxElevation: 0.80,
      colors: ['#9098a0', '#9ea6ae', '#acb4bc'], contourColor: '#606870',
      walkable: false, canHavePlants: false, canPlace: false },
    glacier: { key: 'glacier', name: "Glacier & Ice", minElevation: 0.80, maxElevation: 1.0,
      colors: ['#dfe8ee', '#eaf2f6', '#ffffff'], contourColor: '#a8c0cc',
      walkable: false, canHavePlants: false, canPlace: false }
  },

  species: {
    moa: [
      'upland_moa',             // cold-adapted Megalapteryx — the deep-glacial backbone
      'little_bush_moa',        // closed-forest emeid (favoured: lancewood)
      'stout_legged_moa',       // open glacial-flats emeid
      'south_island_giant_moa', // lowland browser — fades first as it cools
      'heavy_footed_moa'        // forest-edge Pachyornis
    ],
    eagle: ['haasts_eagle'],
    other: ['kereru', 'kokako']
  },
  startingSpecies: 'upland_moa',

  initialSpeciesDistribution: {
    'upland_moa': 6,
    'little_bush_moa': 4,
    'stout_legged_moa': 3,
    'south_island_giant_moa': 3,
    'heavy_footed_moa': 2
  },
  initialEntityCounts: { moa: 18, eagle: 2, kereru: 4, kokako: 3 },

  economy: {
    startingMauri: 80,
    seasonDuration: 1800,        // a year = 4 x 1800 = ~2 min; ~cycle 10 (~20 min) is brutal
    eggIncubationTime: 600,
    securityTimeToLay: 900,
    securityTimeVariation: 300,
    layingHungerThreshold: 26,
    eagleSpawnMilestones: [],
    maxPopulation: 60
  },

  availablePlaceables: {
    lancewood: { cost: 30 },   // slot 1 — bush moa
    speargrass: { cost: 30 },  // slot 2 — upland moa
    shelter:   { cost: 35 },
    nest:      { cost: 55 },
    waterhole: { cost: 35 },
    Storm:     { cost: 40 },
    // A global one-shot (not a placement): buy a bumper podocarp year — next year the
    // forest booms and the fruit-birds (kererū/kōkako) surge. Costs a lot of mauri, so
    // it's a deliberate warm-year investment. See Game.triggerMastYear / PLACEABLES.
    mastYear:  { cost: 200 }
  },

  // Per-species recovery targets for the yearly focus goals (fall back to
  // freeplayDefaultTarget). Big lowland browsers ask for fewer than the smaller,
  // faster-breeding species.
  freeplayTargets: {
    upland_moa: 10,
    little_bush_moa: 8,
    stout_legged_moa: 6,
    south_island_giant_moa: 5,
    heavy_footed_moa: 6
  },

  mechanics: {
    // ---- Endless deepening climate (the core) --------------------------------
    climateDrift: { periodYears: 3, rampCycles: 10, coldCap: 1.0, baselineFrac: 0.2, starkness: 1.0 },

    // ---- Winter takes food value, not plants (the core) ---------------------
    winterInedibility: true,

    // ---- Cold shapes the cast: lowland browsers suffer the deepening most -----
    coldToleranceMatters: true,
    coldToleranceMattersMult: 1.0,

    // ---- Free Play yearly-goal engine ---------------------------------------
    freeplayProtectFloor: 2,    // last N of each FOCUS species are protected this year
    freeplayRefoundCount: 3,    // extinct non-focus species refound with this many
    freeplayDefaultTarget: 8,   // recovery target when a species isn't in freeplayTargets
    freeplayGoalReward: 80,     // base mauri per met goal (scaled up by coldIndex)

    // ---- Mast Year interactable (buy with the palette; see Game.triggerMastYear) ----
    mastFlockMult: 1.6,         // fruit-bird flock caps swell by this ×  during a mast year



    // ---- Habitat & shared-refuge competition (from Level 2) -------------------
    habitatStress: true, habitatStressMargin: 0.10, habitatStressPenalty: 0.45, winterStressMult: 1.4,
    forestCompetition: true, forestBiomes: ['forestRefuge'], forestCompetitionRadius: 45,
      forestCompetitionTolerance: 2, forestCompetitionPenalty: 0.18, winterCompetitionMult: 1.7,
    unfavouredBrowsePenalty: 0,
    nonFocalGeneralistBonus: 1.2,

    // ---- Measured breeding (deepened further by coldIndex in mauri_moa.js) ----
    breedingSoftCap: 12, breedingCarryingCap: 34, breedingSuppressFloor: 0.12,
    breedingCooldownMult: 1.3, matingAge: 1200, winterBreedingCooldownMult: 2,
    noSpeciation: true,
    focalSpecies: ['upland_moa', 'little_bush_moa'],   // STABLE balance set (generalist bonus),
                                                       // distinct from the DYNAMIC yearly focus
    maxPerSpecies: 20,

    // NOTE: no static populationFloors — Free Play protects only the CURRENT year's
    // two focus species, via the engine's dynamic floors (see Game._beginFreeplayYear).

    // ---- Emergent eagles. In Free Play their extinction is NOT a loss: it unleashes
    // a dominant-moa boom and they re-immigrate next year (see Game._updateEagleBoom).
    emergentEagles: true, eagleTargetRatio: 1 / 8, eagleMaxPopulation: 8, eagleHungerRate: 0.02,
      eagleStarveThreshold: 90, eagleStarveTimeout: 2400, eagleReproChance: 0.4, eagleReproCooldown: 2600,
      eagleReproCheckInterval: 220, eagleMaturityAge: 1500, eaglePreyPopThreshold: 12,
      startingEagleEggHatchTime: 1800, eagleMateRadius: 250, eagleOverhuntRestraint: 30, eagleRestraintCap: 45,

    // ---- Forest contraction (deepened further by climateDrift, in mauri_seasons.js) ----
    forestContraction: true, forestBand: { min: 0.36, max: 0.48 },
    forestBandBySeason: {
      spring: { min: 0.36, max: 0.48 }, summer: { min: 0.36, max: 0.48 },
      autumn: { min: 0.36, max: 0.45 }, winter: { min: 0.36, max: 0.42 }
    }
  },

  // Required by the schema; endless mode never reads them (checkGoals short-circuits).
  goals: [],

  // Endless never reaches a WON screen, but keep a formula for completeness.
  scoreFormula: (ctx) => Math.round((ctx.cyclesSurvived || 0) * 100 + ctx.moaCount * 5),

  menu: {
    title: "Free Play — Kahurangi",
    subtitle: "endless glacials",
    areaLabel: "NW Nelson, Te Waipounamu",
    areaSubtitle: "Upper West Coast, South Island",
    featuredSpecies: {
      key: 'upland_moa',
      displayName: 'Upland Moa',
      localName: 'Megalapteryx didinus',
      spriteKey: 'LB_moa_walk_01',
      spriteScale: 2
    },
    flavorText: [
      "Each winter colder than the last.", "",
      "Protect the two most fragile moa each year,",
      "and hold your community together as long as you can."
    ],
    displayPlants: ['lancewood', 'speargrass', 'tussock', 'coprosma', 'beech', 'patotara', 'dracophyllum'],
    art: { coreWidth: 1600, coreHeight: 1080, bgColor: [26, 34, 44] }
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  }
};

LEVEL_REGISTRY.register(LEVEL_FREEPLAY_KAHURANGI);
