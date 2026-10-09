// ============================================================================
// MODULE 1: Pātōtara
// ============================================================================
// The year after Module 0. The family walks north onto new tops and meets another upland moa
// family, sitting on an egg in an established nest. A kea, drawn by pātōtara berries, means
// to raid it; the player grows more pātōtara to bring the family over to defend the nest.
// Then the year plays out as in Module 0: storm paths down to a waterhole for winter and back
// up in spring. In winter the pātōtara bears no berries, and the player moves the wharariki
// (mountain flax) to the waterhole instead. See PatotaraDirector (mauri_module_patotara.js)
// for the story, and levels/tutorial_module_01_patotara.js for its prompts.
//
// Module 0's "Continue" carries straight on into this level: same land (its seed and height
// fit), the area north of Module 0's, with the family walking in from the south edge. Picked
// from the level select, it starts on a fresh land.
//
// The land, biomes and world grid are Module 0's (they must match for the hand-off).
// ============================================================================

const MODULE_PATOTARA = {
  id: 'module_patotara',
  name: 'Pātōtara',
  module: true,
  moduleIndex: 1,
  unlockCondition: null,

  zoom: MODULE_STORMS.zoom,
  startSeason: 'summer',

  terrain: Object.assign({}, MODULE_STORMS.terrain),

  // Module 0's world grid, playing in the area above (north of) Module 0's.
  worldGrid: Object.assign({}, MODULE_STORMS.worldGrid, { order: [[1, 0], [1, 1]] }),

  biomes: MODULE_STORMS.biomes,

  species: {
    moa: ['upland_moa'],
    eagle: ['haasts_eagle'],
    other: ['kea']
  },
  startingSpecies: 'upland_moa',

  // The story places its own cast (both families, the eagle and the kea).
  initialEntityCounts: { moa: 0, eagle: 0 },

  economy: Object.assign({}, MODULE_STORMS.economy, { startingMauri: 80 }),

  // Pātōtara and storms (as Module 0). The story's pātōtara patch and the wharariki are on the
  // map too, moved by press and hold.
  availablePlaceables: {
    patotara: { cost: 25 },
    Storm: { cost: 40, moveCost: 10 }
  },

  mechanics: {
    noSpeciation: true,
    evergreenPlants: MODULE_STORMS.mechanics.evergreenPlants   // (as Module 0)
  },

  // ---- The story (PatotaraDirector). Anything left out uses MODULE_STORY_DEFAULTS. --------
  story: {
    director: 'patotara',
    eggHatchSec: 20,
    stormRadius: 56,
    stormCount: 5,
    openingZoom: 1.35,
    drawNest: false,           // the nests are nesting sites, drawn by the simulation
    nextArea: null,            // the module after this one isn't built yet
    outroDir: 'north',
    lockedTools: {},
    winTitle: "HOME AGAIN",
    winText: "Both families are back up on the tops.",
    nextText: "The next module is on its way.",
    // (story.patotara overrides PATOTARA_STORY_DEFAULTS: the raid, the meeting, the hatching.)
    patotara: {},

    goals: {
      summer: [
        { id: 'meet',      name: "Meet the moa at their nest" },
        { id: 'patotara',  name: "Bring the pātōtara to their nest" },
        { id: 'defend',    name: "See the kea off their egg" },
        { id: 'hatched',   name: "Their egg hatches" }
      ],
      autumn: [
        { id: 'chase1',    name: "Hide the family from the Pouākai" },
        { id: 'chase2',    name: "Hide them again when their storm breaks" },
        { id: 'refuge',    name: "Lead them down to the waterhole" }
      ],
      winter: [
        { id: 'wharariki', name: "Move the wharariki to the waterhole" },
        { id: 'winter',    name: "Keep them hidden until spring" }
      ],
      spring: [
        { id: 'home',      name: "Lead them back up beside their friends" }
      ]
    }
  },

  goals: [],

  scoreFormula: (ctx) => Math.round(ctx.moaCount * 100 + ctx.totalEarned * 0.2 - ctx.playTime / 120),

  menu: {
    title: "Pātōtara",
    subtitle: "Module 1: Pātōtara",
    moduleLabel: "Pātōtara",          // the tool name on the level-select button
    focusItem: { placeable: 'patotara', name: "Pātōtara" },   // "Next up" on Module 0's win card
    areaLabel: "Kahurangi uplands, Te Waipounamu",
    areaSubtitle: "Upper West Coast, South Island",
    featuredSpecies: {
      key: 'kea',
      displayName: 'Kea',
      localName: 'Kea',
      spriteKey: 'kea',
      spriteScale: 0.25
    },
    flavorText: [
      "New neighbours, and a kea with an eye on their egg.", "",
      "Bring the family together to keep it safe."
    ],
    displayPlants: ['patotara', 'wharariki', 'tussock', 'dracophyllum'],
    art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  }
};

LEVEL_REGISTRY.register(MODULE_PATOTARA);
