// ============================================
// FREE PLAY: Kahurangi; the deepening glacials (endless)
// An endless survival mode: glacial Kahurangi as Level 2 but with no win. The climate
// oscillates between glacial and interglacial years and deepens across the run. Each
// year sets soft goals on the two most-endangered species; every species present holds
// at a survival floor. Winter takes food value, not plants. Lose all your moa and the
// run ends. Reuses Level 2's terrain, biomes and cast.
// ============================================

const LEVEL_FREEPLAY_KAHURANGI = {
  id: 'freeplay_kahurangi',
  name: 'ENDLESS: Mutunga kore',   // "the endless descent into cold"
  unlockCondition: null,             // open for playtesting

  // Endless: no phases, no timed end, no win. checkGoals() short-circuits to the
  // yearly-goal engine.
  endless: true,

  zoom: 1.667,
  // Endless years run summer → autumn → winter → spring; the camera pans to the next
  // 2×2 area only at the year boundary (spring→summer), so a whole year plays out in
  // one quadrant. (Classic levels stay spring-start.)
  startSeason: 'summer',

  terrain: {
    noiseScale: 0.005, octaves: 3, persistence: 0.32, lacunarity: 3.0,
    ridgeInfluence: 1.6, elevationPower: 1.4, islandFalloff: 0.2,
    plantDensity: 0.005, useLakes: false
  },

  // ---- 2×2 continuous terrain grid: the camera pans a new area each year -----------
  // One continuous alps→shore landmass (east = high alps, west = shore) spanning
  // cols×rows play windows. Each year the camera pans to the next area in a circular
  // tour, regenerating that area's plants/fauna. A full loop deepens the glacial share.
  // See TerrainGenerator + Game._scrollWorldGrid.
  worldGrid: {
    cols: 2, rows: 2,
    openLandScale: 0.58,     // opening: scale land elevation (lower = gentler alps, broader forest)
    glacialPerLoop: 0.22,    // each 4-year loop releases the scale toward full height…
    glacialCap: 0.6,         // …up to here
    glacialAdvance: 0,       // year-1 advance (the mild opening)
    // Pull the sea back off the western (shore) windows (years 2 & 3): a smaller coast range
    // means less ocean on the left and a touch more lowland (so the podo forest reaches lower).
    coastBase: 0.015, coastRange: 0.26
  },

  // Glacial biome bands (identical to Level 2).
  biomes: {
    sea: { key: 'sea', name: "Sea", minElevation: 0, maxElevation: 0.10,
      colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#0f2533',
      walkable: false, canHavePlants: false, canPlace: false },
    coastal: { key: 'coastal', name: "Glacial Outwash", minElevation: 0.10, maxElevation: 0.15,
      colors: ['#b8b09a', '#c4bca6', '#d0c8b2'], contourColor: '#8a8270',
      walkable: true, canHavePlants: false, canPlace: true },
    glacialFlats: { key: 'glacialFlats', name: "Glacial Flats", minElevation: 0.15, maxElevation: 0.28,
      colors: ['#9aa878', '#a6b484', '#b2c090'], contourColor: '#6f7d52',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'coprosma', 'flax'], canPlace: true },// 'pohuehue'
    shrubland: { key: 'shrubland', name: "Frost Shrubland", minElevation: 0.28, maxElevation: 0.33,
      colors: ['#7c8858', '#889464', '#94a070'], contourColor: '#5a6640',
      walkable: true, canHavePlants: true, plantTypes: ['coprosma', 'patotara', 'tussock', 'dracophyllum'], canPlace: true },// 'pohuehue', 'toatoa'
    forestRefuge: { key: 'forestRefuge', name: "Forest Refuge", minElevation: 0.33, maxElevation: 0.48,
      colors: ['#2d5240', '#345e48', '#3b6a50'], contourColor: '#1e3a2c',
      walkable: true, canHavePlants: true, plantTypes: ['beech', 'rimu', 'fern'], canPlace: true },
    subalpine: { key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.48, maxElevation: 0.66,
      colors: ['#9a9a62', '#a6a66e', '#b2b27a'], contourColor: '#70703f',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'dracophyllum', 'patotara'], canPlace: true },//toatoa
    alpine: { key: 'alpine', name: "Alpine Scree", minElevation: 0.66, maxElevation: 0.80,
      colors: ['#9098a0', '#9ea6ae', '#acb4bc'], contourColor: '#606870',
      walkable: false, canHavePlants: false, canPlace: false },
    glacier: { key: 'glacier', name: "Glacier & Ice", minElevation: 0.80, maxElevation: 1.0,
      colors: ['#dfe8ee', '#eaf2f6', '#ffffff'], contourColor: '#a8c0cc',
      walkable: false, canHavePlants: false, canPlace: false }
  },

  species: {
    moa: [
      'upland_moa',             // cold-adapted Megalapteryx; the deep-glacial backbone
      'little_bush_moa',        // closed-forest emeid (favoured: lancewood)
      'stout_legged_moa',       // open glacial-flats emeid
      'south_island_giant_moa', // lowland browser; fades first as it cools
      'heavy_footed_moa'        // forest-edge Pachyornis
    ],
    eagle: ['haasts_eagle'],
    other: ['kokako', 'kea', 'kaka', 'kakapo']   // kererū retired from Free Play
  },
  startingSpecies: 'upland_moa',

  initialSpeciesDistribution: {
    'upland_moa': 6,
    'little_bush_moa': 4,
    'stout_legged_moa': 3,
    'south_island_giant_moa': 3,
    'heavy_footed_moa': 2
  },
  initialEntityCounts: { moa: 18, eagle: 2, kokako: 3, kea: 4 },

  economy: {
    startingMauri: 80,
    seasonDuration: 3600,        // 1 min/season → a year ≈ 4 min
    eggIncubationTime: 600,
    securityTimeToLay: 900,
    securityTimeVariation: 300,
    layingHungerThreshold: 26,
    eagleSpawnMilestones: [],
    maxPopulation: 60
  },

  availablePlaceables: {
    lancewood: { cost: 25 },   // bush moa's favoured plant (lowland years)
    speargrass: { cost: 25 },  // upland moa's favoured plant (upland years)
    // Waterholes draw the birds in too, over a wider pool: a bird within birdDrawRadius sends
    // birdVisitChance of its dispersal hops to the water, and hungers slower there (Kereru._pickHop).
    waterhole: { cost: 45, radius: 60, attractsBirds: true, birdDrawRadius: 380,
                 birdVisitChance: 0.6, birdHungerSlowdown: 0.5 },
    // Fern cover only half-hides: an eagle spots a sheltered moa within half its hunt radius.
    shelter:   { cost: 35, eagleSpotFrac: 0.5 },
    forestBoost: { cost: 35 }, // Year-2 forest cultivator
    Storm:     { cost: 40 },
    keaLure:   { cost: 30 },   // Year-1 kea magnet
    nestRaid:  { cost: 0 },    // toolbar interaction → nest-raid dialog (charged per raid)
    rimuScramble: { cost: 40 } // mast-year interaction → 20% of rimu drop berries for the kākāpō
    // No Nesting Site tool: moa nests are founded by growing the focus moa's favoured plant
    // (see Simulation._updateMoaNestingFormation).
    // The Mast Year is earned, not bought: Year 2's mast-mauri goal invokes it early
    // (year 3) on success, or lets it fall late (year 4) on a miss.
  },

  // Toolbar order, every year: the focus moa's plant, the focus bird's tools, then the shared
  // kit (kawakawa or waterhole, fern shelter, storm). A toolbar gap separates each group; tools
  // a year doesn't offer are skipped. See arrangePalette.
  paletteOrder: [
    ['lancewood', 'speargrass'],
    ['keaLure', 'nestRaid', 'forestBoost', 'rimuScramble'],
    ['kawakawa', 'waterhole', 'shelter', 'Storm']
  ],
  // Kawakawa is frost-tender: once the first winter strips it, this tool takes its toolbar
  // slot (for the rest of the run), so the layout keeps its size. See Game._banKawakawa.
  kawakawaReplacement: 'waterhole',

  // ---- One focus moa per year, set by the terrain (see Game._moaZoneForCycle) ----------
  // The upland moa in the high (east/right) quadrants, the little bush moa in the ones by the
  // sea (west/left). Its favoured plant leads that year's toolbar and founds its nests. The
  // other zone moa is off-focus: still highlighted, but not a loss at 0. It carries its numbers
  // across years spent in its off zone, and returns to its own zone fewer if it fell while away.
  moaZones: {
    upland:  { moa: 'upland_moa',      plant: 'speargrass' },
    lowland: { moa: 'little_bush_moa', plant: 'lancewood' }
  },

  // ---- Year-2 Mast objective (see Game._beginFreeplayYear / _renderMastGoalPanel) -----
  // The kākā year sets a MAST goal: gain this much mauri during the year. Reaching it
  // invokes the mast a year early (year 3, downslope) so the kākāpō breed and a kōkako
  // stretch opens in year 4; missing it delays the mast to year 4 (the cold upslope).
  mastGoal: { loopYear: 2, target: 400, reward: 0 },

  // Per-species recovery targets for the yearly focus goals (else freeplayDefaultTarget).
  freeplayTargets: {
    upland_moa: 10,
    little_bush_moa: 8,
    stout_legged_moa: 6,
    south_island_giant_moa: 5,
    heavy_footed_moa: 6,
    // Flighted-bird focus targets.
    kea: 8,
    kaka: 10,
    kakapo: 10,
    kokako: 6
  },

  // New player-grown nesting sites a nesting-goal year asks for.
  freeplayNestingGoal: 2,

  // ---- Authored year schedule (read by Game._scheduledYearEntry / _beginFreeplayYear) --
  // A repeating 4-year loop aligned to the 2×2 terrain tour: pos 0 & 3 are upland (east),
  // pos 1 & 2 lowland (west). Each year's single focus moa comes from its zone (`moaZones`),
  // not from here. Each `years[pos]`:
  //   focus:        the focus BIRD(s): goals + loss + highlight track (the zone moa is added)
  //   nestingGoal:  the year also asks for NEW nests of the focus moa
  //   mast:         force a mast year (rimu bloom)
  //   mastGoalYear: run the mast-mauri objective this year (see `mastGoal`)
  //   kokakoStretch: the kōkako goal here is a bonus stretch
  //   introduce:    newcomers to seed this year ([{type, count}])
  //   note:         a line shown at the year's start
  //   branch:       { reached, missed }; years 3 & 4 pick a variant by the mast outcome
  //   availablePlaceables: the focus bird's tools (+ year extras); the focus moa's favoured
  //                 plant is added automatically, and the toolbar is ordered by paletteOrder.
  // moaFromLoop withholds the pos-0/pos-1 moa population + nesting goals on the first loop
  // (the zone moa is still that year's focus).
  freeplaySchedule: {
    loopYears: 4,
    moaFromLoop: 1,   // pos-0/pos-1 moa goals start from this 0-based loop index
    years: [
      { // pos 0; Year of the Kea (east / alps; upland moa). Nest raid; kākā introduced.
        focus: ['kea'],
        introduce: [{ type: 'kaka', count: 3 }],
        nestingGoal: true,
        note: "Year of the Kea; the alpine parrots come down to nest in the podocarp forest below. Kākā are introduced to that forest. Plant kawakawa now while the forest is still warm; it will not survive the first winter.",
        // Kawakawa is frost-tender: plantable this year only; at the first winter the waterhole
        // takes its slot (kawakawaReplacement).
        availablePlaceables: { kawakawa: { cost: 25, duration: 3600 }, keaLure: {}, nestRaid: {}, shelter: {}, Storm: {} }
      },
      { // pos 1; Year of the Kākā (west / shore; bush moa). The mast goal runs here (takes
        // the Nest-Raid slot).
        focus: ['kaka'],
        nestingGoal: true,
        mastGoalYear: true,
        note: "Year of the Kākā; grow the flock in the sheltered lowland forest. Use the Forest Seed to spread podocarp forest into the lowland near existing groves; new rimu and beech to feed the kākā through winter. Gain enough mauri this year to invoke the Mast: reach it and the rimu mast comes early next year (the milder downslope), so the kākāpō breed there and a kōkako stretch opens after; miss it and the mast falls late, in the cold upslope.",
        availablePlaceables: { forestBoost: {}, waterhole: {}, shelter: {}, Storm: {} }
      },
      { // pos 2; Year 3 (across / downslope; bush moa). Branches on the mast-goal outcome.
        branch: {
          reached: { // the mast came early; breed the kākāpō in the milder downslope forest
            focus: ['kakapo'], mast: true,
            introduce: [{ type: 'kakapo', count: 4 }],
            note: "The Mast came early! The downslope forest blooms with rimu fruit; the kākāpō breed at last. Grow them while the masting holds. Loose the Rimu Berry Scramble to shake a berry glut from the rimu; food and cover for the kākāpō.",
            availablePlaceables: { rimuScramble: {}, waterhole: {}, shelter: {}, Storm: {} }
          },
          missed: { // no mast yet; consolidate the bush moa and grow new nests
            focus: [], nestingGoal: true,
            note: "No mast this year. Hold the little bush moa; plant lancewood downslope to draw them into new forest groves and found fresh nests before the cold upslope year.",
            availablePlaceables: { waterhole: {}, shelter: {}, Storm: {} }
          }
        }
      },
      { // pos 3; Year 4 (back upslope / cold; upland moa). Branches on the mast-goal outcome.
        branch: {
          reached: { // kākāpō already secured downslope; a South Island kōkako STRETCH opens
            focus: ['kokako'], nestingGoal: true, kokakoStretch: true,
            introduce: [{ type: 'kokako', count: 3 }],
            note: "With the kākāpō secured downslope, a stretch: grow the South Island kōkako in the forest refuge, and plant speargrass to found new upland moa nests in the high country.",
            availablePlaceables: { forestBoost: {}, waterhole: {}, shelter: {}, Storm: {} }
          },
          missed: { // the rimu mast falls late, in the COLD upslope; the hard kākāpō year
            focus: ['kakapo'], mast: true, nestingGoal: true,
            introduce: [{ type: 'kakapo', count: 4 }],
            note: "The rimu mast falls late; here, in the cold upslope. The kākāpō must breed in harsher country. Loose the Rimu Berry Scramble for a berry glut to feed and secure them. Hold the upland moa alongside them; no kōkako can be spared this loop.",
            availablePlaceables: { rimuScramble: {}, waterhole: {}, shelter: {}, Storm: {} }
          }
        }
      }
    ]
  },

  mechanics: {
    // ---- Endless deepening climate (the core) --------------------------------
    climateDrift: { periodYears: 3, rampCycles: 10, coldCap: 1.0, baselineFrac: 0.2, starkness: 1.0 },

    // ---- Winter takes food value, not plants (the core) ---------------------
    // winterEdibilityMult scales how much of a plant's food value survives the cold (a gentler
    // winter starve); winterEdibilityErosion is how hard a deepening glacial erodes that floor.
    winterInedibility: true,
    winterEdibilityMult: 1.5,      // ↑ = winter eating is less debuffed
    winterEdibilityErosion: 0.6,   // ↓ = deep-glacial winters keep more food value (was 0.8)

    // ---- Cold shapes the cast: lowland browsers suffer the deepening most -----
    coldToleranceMatters: true,
    coldToleranceMattersMult: 1.0,

    // ---- Free Play yearly-goal engine ---------------------------------------
    freeplayProtectFloor: 2,    // last N of every species present this year are protected
    freeplayRefoundCount: 3,    // extinct non-focus species refound with this many
    freeplayDefaultTarget: 8,   // recovery target when a species isn't in freeplayTargets
    freeplayGoalReward: 0,      // a goal gives no mauri boost

    // ---- Passive mauri: a healthy, EVEN ecosystem pays (the core income) ------
    // Income/sec = (avg population of PRESENT species) × balance, so it rewards breadth +
    // evenness. balance is the worst species' ratio to the top, focus species weighted 2×
    // (focusInequalityWeight), raised to a power that grows each year (imbalanceHarshness,
    // capped by imbalanceHarshnessCap), then rescaled into [minBalance, 1] so income eases
    // with imbalance but never craters to a crawl. Only present species count; eagles never.
    freeplayPassive: { scale: 1.0, imbalanceHarshness: 0.03, imbalanceHarshnessCap: 0.6, inequalityWeight: 1, focusInequalityWeight: 2, minBalance: 0.2 },

    // ---- Forage tightens: natural plant regen density eases down a little each year to a
    // floor reached at plantDensityFloorYear, so late years run leaner on food. ------------
    freeplayPlantDensity: { floor: 0.6, floorYear: 8 },

    // ---- Year-to-year reset: fall back to defaults, nudged by past performance ----
    // A new year is a new habitat: each species falls back to its default, nudged up by
    // how much you held here last time (per-area memory), capped at maxNudge. Forest you
    // grew here partly persists (forestLegacy). The off-focus zone moa (see `moaZones`) is the
    // exception: it carries its count through its off zone, and on returning to its own zone
    // restarts short by offFocusPenalty × the share it lost while away (0 left → half default).
    freeplayYearReset: { influence: 0.25, maxNudge: 3, birdDefault: 3, forestLegacy: 0.4, offFocusPenalty: 0.5 },

    // Moa laying earns no mauri here (keeps moa from out-earning the flighted birds).
    noEggLaidMauri: true,

    // ---- Egg-hatch bonus: small, and for EVERY species -----------------------
    // A little mauri per hatch while the species is below the taper: fullAmount at/under
    // full, reducedAmount up to reduced, then 0.
    hatchReward: { perSpecies: true, full: 6, reduced: 10, fullAmount: 2, reducedAmount: 1, allSpecies: true },

    // ---- Introduced-bird floors ---------------------------------------------
    // A small static floor so the last kākā pair can't be hunted or starved out.
    populationFloors: { kaka: 2 },

    // ---- Mast Year interactable (buy with the palette; see Game.triggerMastYear) ----
    mastFlockMult: 1.6,         // fruit-bird flock caps swell by this ×  during a mast year

    // ---- Year-1 kea trophic cascade -----------------------------
    // Eagles opportunistically hunt adult flighted birds when hungry (moa preferred;
    // grounded kākāpō exempt). Flyers flee slowly, so a hungry eagle is a real threat.
    eagleHuntsFlyers: true,
    eagleFlyerHungerGate: 50,   // eagle bothers with a bird once this hungry
    eagleFlyerPreyPenalty: 1.6, // birds "feel" this× farther than moa (lower = easier prey)
    eagleFlyerFeed: 60,         // hunger a bird kill relieves (a moa relieves 90)
    flyerFleeMult: 0.9,         // fleeing birds only reach 0.9× cruise → easy to run down
    // Kea auto-raid of eggs is OFF: raiding is a player action on a nesting site.
    keaRaidsEggs: false,
    keaRaidRadius: 95, keaRaidNutrition: 46, keaRaidCooldownSec: 5,   // (dormant)
    // Eagle patrol re-centres on moa nests (eggs), not adult moa.
    eaglePatrolTracksNests: true,
    // Moa vacate disturbed nesting areas.
    moaNestDisturbance: true,
    moaDisturbanceAvoidance: 1.0,
    disturbanceRadius: 75,      // spatial reach of one raid's disturbance
    disturbanceDecaySec: 22,    // a raid's disturbance fades over this long
    disturbancePerRaid: 1.0,    // strength added per raided egg

    // ---- Moa nests (see mauri_nesting.js). None are seeded: every nest is FOUNDED by the
    // player placing two patches of the focus moa's favoured plant close together with that
    // moa drawn in (Simulation._updateMoaNestingFormation). Founded nests are what the kea
    // raid. ----------
    nestingSites: {
      forestCount: 0,           // no seeded forest nests
      openCount: 0,             // no seeded open-country nests
      foundPatches: 2,          // placed favoured-plant patches it takes to found a nest…
      foundRadius: 110,         // …with their centres within this of each other
      radius: 46,               // egg-clustering + raid radius of a site
      forestBand: { min: 0.33, max: 0.48 },
      openBand: { min: 0.18, max: 0.33 },
      laySnapRadius: 170,       // a laying moa snaps its egg to a site within this range
      drawRadius: 520,          // a ready-to-lay moa is drawn to a site within this range
      layBoost: 0.5,            // a pregnant moa at a nest lays this much faster (as the old Nesting Site)
      eggSpeedBonus: 1.6        // eggs laid at a nest incubate this much faster
    },

    // ---- Kea Raid v2: the player-driven raid action ----------------------
    // When ≥ stationCount kea perch within stationRadius of a site, a raid indicator
    // appears. Clicking spends cost and rolls baseSuccess − moaPenalty per moa in moaRadius.
    keaRaid: {
      stationCount: 3,
      stationRadius: 260,       // kea count as stationed from further off (avoids a raid softlock)
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
    focalSpecies: ['upland_moa', 'little_bush_moa'],   // STABLE balance set, distinct from the dynamic yearly focus
    maxPerSpecies: 20,

    // Background species are protected from a total wipe; the year's FOCUS species are NOT
    // (letting one die out is how a run ends — see the focus loss check in update()). The
    // off-focus zone moa is neither: unprotected, but reaching 0 just carries forward.

    // ---- Emergent eagles. In Free Play their extinction is not a loss: it unleashes a
    // dominant-moa boom and they re-immigrate next year. The eagle target stays proportional
    // to the moa count, so a moa decline drops the target and the surplus predators starve
    // off (eagleStarveTimeout sets how fast). eagleTargetRatioPerLoop ramps the eagle:prey
    // ratio up over the run and eagleMaxPerLoop lifts the cap, so pressure climbs across years
    // WITHOUT decoupling from the moa (see Game._applyFreeplayYearPressure). Year 1 opens
    // gentle: a low base ratio + low base cap. eaglePursuitRadius: a committed chase.
    eaglePursuitRadius: 320,
    emergentEagles: true, eagleTargetRatio: 1 / 10, eagleTargetRatioPerLoop: 0.07, eagleMaxPopulation: 6, eagleMaxPerLoop: 2, eagleHungerRate: 0.02,
      eagleStarveThreshold: 90, eagleStarveTimeout: 1500, eagleReproChance: 0.35, eagleReproCooldown: 2600,
      eagleReproCheckInterval: 220, eagleMaturityAge: 1500, eaglePreyPopThreshold: 12,
      startingEagleEggHatchTime: 1800, eagleMateRadius: 250, eagleOverhuntRestraint: 30, eagleRestraintCap: 45,

    // ---- Forest contraction (deepened further by climateDrift, in mauri_seasons.js) ----
    // Band min matches the lowered forestRefuge biome floor (0.33) so the podo forest reaches
    // downslope; winter still contracts it from the top.
    forestContraction: true, forestBand: { min: 0.33, max: 0.48 },
    forestBandBySeason: {
      spring: { min: 0.33, max: 0.48 }, summer: { min: 0.33, max: 0.48 },
      autumn: { min: 0.33, max: 0.45 }, winter: { min: 0.33, max: 0.42 }
    }
  },

  // Required by the schema; endless mode never reads them (checkGoals short-circuits).
  goals: [],

  // Endless never reaches a WON screen, but keep a formula for completeness.
  scoreFormula: (ctx) => Math.round((ctx.cyclesSurvived || 0) * 100 + ctx.moaCount * 5),

  menu: {
    title: "Free Play; Kahurangi",
    subtitle: "PLAYTEST: Exports run stats .txt + JSON",
    areaLabel: "NW Nelson, Te Waipounamu",
    areaSubtitle: "Upper West Coast, South Island",
    // Free Play features its three flighted stars (kea, kākā, kākāpō). The menu renderer
    // lays an array of featured species out in a row.
    featuredSpecies: [
      { key: 'kea',    displayName: 'Kea',    localName: 'Nestor notabilis',     spriteKey: 'kea' },
      { key: 'kaka',   displayName: 'Kākā',   localName: 'Nestor meridionalis',  spriteKey: 'kaka' },
      { key: 'kakapo', displayName: 'Kākāpō', localName: 'Strigops habroptilus', spriteKey: 'kakapo' }
    ],
    flavorText: [
      "Progressively colder glacial winters.", "",
      "Protect the focus species each year,",
      "as the forest shrinks and food becomes scarce."
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
