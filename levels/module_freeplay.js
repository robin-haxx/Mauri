// ============================================================================
// FREE PLAY: PUKEPUKE & KOUKOU (the five years after Module 1)
// ============================================================================
// Five years on Module 1's land. Pukepuke's family and Koukou's live on the tops: summer at the
// nests, an autumn walk down a path of storms to the waterhole, winter by the water, a spring
// walk home. Keep Pukepuke and Koukou safe for five years and the level is won: the camera
// closes in as they come of age, take the empty nest, and mate. Storms hide the moa from the
// Pouākai rather than driving it off: it hunts when hungry and takes whatever it can see, a moa
// or one of the other birds. The kea, kākā and kōkako of the forest and the giant moa of the
// low ground each breed in their own season, and every one of them adds to the mauri.
//
// Module 1's "Continue" carries straight on into this level, on the same land (its sites,
// families, storms, food and mauri). Picked from the level select (the ∞ button after the
// modules) it starts on fresh land planned the same way. Run by FreePlayDirector
// (mauri_module_freeplay.js); tips in levels/tutorial_module_freeplay.js.
// ============================================================================

const MODULE_FREEPLAY = {
  id: 'module_freeplay',
  name: '',
  module: true,
  moduleIndex: 99,     // after every module, however many there come to be
  freePlay: true,      // the level select shows ∞ on its button
  unlockCondition: null,

  zoom: MODULE_STORMS.zoom,
  startSeason: 'summer',

  terrain: Object.assign({}, MODULE_STORMS.terrain),
  // Module 1's world grid and area (they must match for the hand-off).
  worldGrid: Object.assign({}, MODULE_PATOTARA.worldGrid),
  biomes: MODULE_STORMS.biomes,

  species: {
    moa: ['upland_moa', 'south_island_giant_moa'],
    eagle: ['haasts_eagle'],
    other: ['kea', 'kaka', 'kokako']
  },
  startingSpecies: 'upland_moa',

  // The director places the whole cast (the families, the giant moa, the kea band, the forest
  // birds, the eagle).
  initialEntityCounts: { moa: 0, eagle: 0 },

  // 45-second seasons, cut to 30 once the season's goals are done (FreePlayDirector.seasonStep),
  // and held for the walks.
  economy: Object.assign({}, MODULE_STORMS.economy, { startingMauri: 80, seasonDuration: 2700 }),

  // Storms (cover from the Pouākai, and a path to walk), pātōtara (rich summer food that draws
  // kea) and wharariki (hardy food, any season). Food the player grows stays.
  availablePlaceables: {
    patotara:  { cost: 25 },
    wharariki: { cost: 25 },
    Storm:     { cost: 40, moveCost: 10 }
  },

  mechanics: {
    noSpeciation: true,
    evergreenPlants: MODULE_STORMS.mechanics.evergreenPlants,
    sproutPatotara: true,   // pātōtara, wild or grown, is sprouted by a press and hold (as the modules)
    // The birds and the giant moa breed by the season, a clutch a year, and come of age by the
    // year (the director runs it: BIRD_CALENDAR), not on their own seconds-based timers. (The
    // giant moa never pair up on their own: matingAge.)
    seasonalBirdBreeding: true,
    matingAge: Infinity,
    // No species is kept from dying out: no population floors (the giant moa had one), and the
    // birds' own starvation floor (their species' populationFloor) is taken away too.
    birdPopulationFloor: 0,
    // The population tiles under the goal: the moa and the others.
    speciesTiles: ['upland_moa', 'south_island_giant_moa', 'kea', 'kaka', 'kokako'],
    flyerFleeMult: 1.1,
    // Birds keep out from under the storms themselves (not the wider ring Free Play uses), or
    // in a forest this small the storms the moa need would leave them nowhere to feed.
    stormFlushMult: 1.0,
    // The forest in a window this small runs right to its edges: birds may fly close to them.
    flyerEdgeMargin: 14
  },

  // ---- The years (FreePlayDirector). Anything left out uses MODULE_STORY_DEFAULTS. -----------
  story: {
    director: 'freeplay',
    eggHatchSec: 15,
    stormRadius: 56,
    stormCount: 5,
    drawNest: false,           // the nests are nesting sites, drawn by the simulation
    hungerScale: 1.0,          // the families get hungry here...
    maxHunger: 100,            // ...and can starve (FreePlayDirector._updateStarving)
    mauriPerSec: 0.3,          // steady mauri from the families (every bird adds more)
    goalReward: 15,
    winterStormLifeSec: 20,    // winter's storms fade within the season: new ones are needed
    // Now and then a storm gathers on the tops, from autumn on: as many standing up there at
    // once as the year allows (maxByYear, year 1 first; FreePlayDirector._updateWeather).
    weather: { from: 'autumn', firstSec: 6, everySec: 20, max: 2, maxByYear: [2, 1, 0, 1, 0] },
    lockedTools: {},
    patotara: {},              // (Module 1's kea, raids and nests: PATOTARA_STORY_DEFAULTS)
    freeplay: {
      years: 5,                // the win
      wildBite: 0.05           // wild tussock barely feeds them: grown food is what counts
    },
    goals: {},                 // (each season's goals are set by the director)
    winTitle: "GROWN UP",
    winText: "Pukepuke and Koukou are grown, with a nest of their own."
  },

  goals: [],

  scoreFormula: (ctx) => Math.round(ctx.moaCount * 100 + ctx.totalEarned * 0.2 - ctx.playTime / 120),

  menu: {
    title: "Pukepuke & Koukou",
    subtitle: "Free Play",
    moduleLabel: "Free Play",
    areaLabel: "Kahurangi uplands, Te Waipounamu",
    areaSubtitle: "Upper West Coast, South Island",
    featuredSpecies: {
      key: 'upland_moa',
      displayName: 'Upland Moa',
      localName: 'Moa Pukepuke',
      spriteKey: 'upland_walk_01',
      spriteScale: 0.4
    },
    flavorText: [
      "Five years on the tops.", "",
      "See Pukepuke and Koukou grow up."
    ],
    displayPlants: ['patotara', 'wharariki', 'tussock', 'beech'],
    art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  }
};

LEVEL_REGISTRY.register(MODULE_FREEPLAY);
