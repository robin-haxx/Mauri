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

  // ---- 2×2 continuous terrain grid: the camera pans a new area each year -----------
  // ONE continuous landmass — a single alps→shore descent (east = high alps, west =
  // shore) spanning cols×rows play windows. Year 1 frames the EAST window (alps →
  // podocarp forest, no shore); each year the CAMERA PANS across the land to the next
  // area in a circular tour, unloading the old area's plants/fauna and regenerating
  // them for the new one: east/alps → west/shore → across → back upslope → repeat.
  // The opening is GENTLE (softer alps, broad forest); a full loop deepens the glacial
  // share so glacial habitats climb higher over the run. See TerrainGenerator +
  // Game._scrollWorldGrid. `order` may override the [col,row] tour.
  worldGrid: {
    cols: 2, rows: 2,
    openLandScale: 0.58,     // opening: scale land elevation toward the coast (lower = gentler alps, broader forest)
    glacialPerLoop: 0.22,    // each full 4-year loop releases the scale toward full height (glacial climbs back)…
    glacialCap: 0.6,         // …up to here (glacial dominates, but never wholly)
    glacialAdvance: 0        // year-1 advance (the mild opening)
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
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'coprosma', 'flax', 'pohuehue'], canPlace: true },
    shrubland: { key: 'shrubland', name: "Frost Shrubland", minElevation: 0.28, maxElevation: 0.36,
      colors: ['#7c8858', '#889464', '#94a070'], contourColor: '#5a6640',
      walkable: true, canHavePlants: true, plantTypes: ['coprosma', 'patotara', 'tussock', 'dracophyllum', 'pohuehue', 'toatoa'], canPlace: true },
    forestRefuge: { key: 'forestRefuge', name: "Forest Refuge", minElevation: 0.36, maxElevation: 0.48,
      colors: ['#2d5240', '#345e48', '#3b6a50'], contourColor: '#1e3a2c',
      walkable: true, canHavePlants: true, plantTypes: ['beech', 'rimu', 'fern'], canPlace: true },
    subalpine: { key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.48, maxElevation: 0.66,
      colors: ['#9a9a62', '#a6a66e', '#b2b27a'], contourColor: '#70703f',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'dracophyllum', 'patotara', 'toatoa'], canPlace: true },
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
    other: ['kereru', 'kokako', 'kea', 'kaka', 'kakapo']
  },
  startingSpecies: 'upland_moa',

  initialSpeciesDistribution: {
    'upland_moa': 6,
    'little_bush_moa': 4,
    'stout_legged_moa': 3,
    'south_island_giant_moa': 3,
    'heavy_footed_moa': 2
  },
  initialEntityCounts: { moa: 18, eagle: 2, kereru: 4, kokako: 3, kea: 4 },

  economy: {
    startingMauri: 80,
    seasonDuration: 3600,        // 1 min/season → a year = 4 x 3600 = ~4 min; ~cycle 10 (~40 min) is brutal
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
    keaLure:   { cost: 45 },   // Year-1 kea magnet (see freeplaySchedule per-year palettes)
    nestRaid:  { cost: 0 },    // toolbar interaction → nest-raid dialog (charged per raid)
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
    heavy_footed_moa: 6,
    // Flighted-bird focus targets (kākā/kākāpō land in later slices; harmless until then).
    kea: 8,
    kaka: 8,
    kakapo: 6
  },

  // ---- Authored year schedule (read by Game._beginFreeplayYear) -------------------
  // Overrides the dynamic "two most-endangered moa" focus with a scripted arc. The
  // `opening` years play once in order, then `cycle` repeats forever. Each entry:
  //   focus:     species this year's goals + protection + highlight track (moa OR birds)
  //   introduce: newcomers to seed this year ([{type, count}]) if not already present
  //   note:      a line shown at the year's start
  // Species not yet built (kākā/kākāpō) are skipped gracefully; a scheduled year whose
  // focus is entirely unbuilt falls back to the dynamic ranker (see _beginFreeplayYear).
  // Ecological pairing: kea ↔ the alpine upland moa, kākā & kākāpō ↔ the forest bush moa.
  freeplaySchedule: {
    opening: [
      { // Year 1 — the mild opening: protect the kea, bring in the kākā.
        focus: ['kea'],
        introduce: [{ type: 'kaka', count: 4 }],
        note: "Year of the Kea — the alpine parrots come down to nest in the podocarp forest below. Kākā are introduced to that forest. Plant kawakawa now while the forest is still warm — it will not survive the first winter.",
        // The Berry Cache draws kea downslope; forage plots pull the moa out; Storm
        // clears the eagles for a nesting window. (Mast unlocks next year.)
        // Kawakawa is a frost-tender lowland plant of this warm opening ONLY: it can be
        // planted this year but is stripped from the palette at the first winter and can
        // never be established again (the LGM closing in — see Game._banKawakawa). Its
        // grove lasts a full season here so a late-autumn planting reaches that winter
        // and is seen to wither, rather than expiring in the default 20s.
        availablePlaceables: { kawakawa: { cost: 25, duration: 3600 }, keaLure: {}, nestRaid: {}, lancewood: {}, speargrass: {}, Storm: {}, waterhole: {} }
      },
      { // Year 2 — a colder winter closes in; the kākāpō need help.
        focus: ['kakapo'],
        introduce: [{ type: 'kakapo', count: 4 }],
        note: "A colder winter. The kākāpō, ground-dwelling and flightless, now need your protection. The Mast Year is now yours to invoke — it is the only thing that breeds them.",
        availablePlaceables: { mastYear: {}, nestRaid: {}, lancewood: {}, shelter: {}, waterhole: {}, Storm: {} }
      }
    ],
    // The deepening-glacial rotation (repeats from the top): upland alone, then the
    // forest bush moa with a forest parrot, then the alpine upland moa with the kea, ...
    cycle: [
      { focus: ['upland_moa'],
        note: "The glacials deepen. Hold the cold-hardy upland moa — the backbone of a frozen world.",
        availablePlaceables: { speargrass: {}, shelter: {}, nest: {}, waterhole: {}, Storm: {}, mastYear: {}, nestRaid: {} } },
      { focus: ['little_bush_moa', 'kaka'],
        note: "Forest year: shelter the little bush moa and the kākā in the shrinking refuge.",
        availablePlaceables: { lancewood: {}, shelter: {}, nest: {}, waterhole: {}, Storm: {}, mastYear: {}, nestRaid: {} } },
      { focus: ['upland_moa', 'kea'],
        note: "Alpine year: the upland moa and the kea against the cold high country.",
        availablePlaceables: { speargrass: {}, keaLure: {}, nestRaid: {}, shelter: {}, Storm: {}, waterhole: {}, mastYear: {} } },
      { focus: ['little_bush_moa', 'kakapo'],
        note: "Forest year: the little bush moa and the kākāpō — invoke a mast year to let the kākāpō breed.",
        availablePlaceables: { lancewood: {}, mastYear: {}, nestRaid: {}, shelter: {}, nest: {}, Storm: {} } }
    ]
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

    // ---- Year-1 kea trophic cascade (see YEARS_PLAN.md) -----------------------------
    // Link 4 — eagles opportunistically hunt ADULT flighted birds when hungry (moa
    // always preferred; grounded kākāpō exempt). Flyers flee slowly (flyerFleeMult),
    // so a hungry eagle over the forest is a real threat to them.
    eagleHuntsFlyers: true,
    eagleFlyerHungerGate: 50,   // eagle bothers with a bird once this hungry
    eagleFlyerPreyPenalty: 1.6, // birds "feel" this× farther than moa (lower = easier prey)
    eagleFlyerFeed: 60,         // hunger a bird kill relieves (a moa relieves 90)
    flyerFleeMult: 0.9,         // fleeing birds only reach 0.9× cruise → easy to run down
    // Link 1 — kea AUTO-raid of eggs is now OFF: raiding is a player action on a
    // nesting site (Kea Raid v2, Slice D). Kea instead station on perch trees near a
    // site (mauri_kea.js), and the player triggers the raid.
    keaRaidsEggs: false,
    keaRaidRadius: 95, keaRaidNutrition: 46, keaRaidCooldownSec: 5,   // (dormant)
    // Link 3 — eagle patrol re-centres on moa NESTS (eggs), not on adult moa.
    eaglePatrolTracksNests: true,
    // Link 2 — moa vacate disturbed nesting areas (emergent + this lever; 0 = pure emergent).
    moaNestDisturbance: true,
    moaDisturbanceAvoidance: 1.0,
    disturbanceRadius: 75,      // spatial reach of one raid's disturbance
    disturbanceDecaySec: 22,    // a raid's disturbance fades over this long
    disturbancePerRaid: 1.0,    // strength added per raided egg

    // ---- Kea Raid v2: established moa nesting sites (see mauri_nesting.js) ----------
    nestingSites: {
      forestCount: 2,           // seeded downslope in the podocarp forest refuge
      openCount: 3,             // seeded across open moa country
      radius: 46,               // egg-clustering + raid radius of a site
      forestBand: { min: 0.36, max: 0.48 },
      openBand: { min: 0.18, max: 0.34 },
      laySnapRadius: 170,       // a laying moa snaps its egg to a site within this range
      drawRadius: 520           // a ready-to-lay moa is drawn to a site within this range
    },

    // ---- Kea Raid v2: the player-driven raid action (Slice D) ----------------------
    // When ≥ stationCount kea are perched within stationRadius of a nesting site, a
    // raid indicator appears over it. Clicking spends `cost` and rolls success:
    // baseSuccess minus moaPenalty per moa within moaRadius (so clear the moa first).
    keaRaid: {
      stationCount: 3,
      stationRadius: 150,
      cost: 60,
      baseSuccess: 0.9,
      moaPenalty: 0.12,
      minSuccess: 0.05,
      moaRadius: 95
    },

    // Tap a moa egg on the map → the nearest hungry kea within keaEatRadius eats it.
    keaTapEgg: true,
    keaTapClickRadius: 26,     // how close the tap must land to an egg (world units)
    keaEatRadius: 240,         // a hungry kea within this of the egg will take it
    keaTapHunger: 28,          // a kea must be at least this hungry to bother



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
