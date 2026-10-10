// ============================================================================
// MODULE 0: Āwhā, the storm
// ============================================================================
// A year in the life of one upland moa family, high in the Kahurangi tops. The only tool is
// the Storm: a moa under a storm can't be seen by the Pouākai (Haast's eagle). The player
// moves the standing storms (press and hold one, then drag it). Calling a new storm from the
// toolbar stays locked (greyed out) until the story first needs it.
//
//   summer  A pair at their nest, with a freshly laid egg. The father stays by the nest; the
//           mother forages at a patch of pātōtara out in the open. The eagle comes for her:
//           move a storm over her. She brings food home, and the egg hatches.
//   autumn  The view pulls back; a lighter worn trail shows the way down to the wharariki and
//           a tarn. The family walks from storm to storm, so drag the storms into a path. The
//           eagle attacks twice; the second time their storm breaks up, the Storm tool
//           unlocks, and a new storm is needed. Birds caught in the open run.
//   winter  They stay by the tarn. Storms fade away, so new ones have to be called, and the
//           eagle keeps coming back.
//   spring  They walk back up to the nest; the Storm tool has no recharge, so a path of
//           storms can be called. Getting home wins, and "Continue" walks them north off the
//           map and pans the camera on to the next area (the next module).
//
// The story itself is run by ModuleDirector (mauri_module.js); `story` below holds its
// settings and each season's goals. Prompts are tutorial tips keyed to the story's moments
// (levels/tutorial_module_00_storms.js).
//
// `module: true` puts the level in the level select's row of small buttons above the main
// cards (numbered by `moduleIndex`, labelled by menu.moduleLabel).
// ============================================================================

const MODULE_STORMS = {
  id: 'module_storms',
  name: '',                 // "storm"
  module: true,
  moduleIndex: 0,
  unlockCondition: null,

  // Closer in than the main levels (Free Play opens at 1.9). The story also starts with the
  // camera closer still, on the nest (story.openingZoom).
  zoom: 2.4,
  startSeason: 'summer',

  terrain: {
    noiseScale: 0.005, octaves: 3, persistence: 0.32, lacunarity: 3.0,
    ridgeInfluence: 1.6, elevationPower: 1.4, islandFalloff: 0.2,
    plantDensity: 0.0038, useLakes: false,
    // A window this small swings from all forest to all ice depending on the seed, so its
    // heights are fitted instead: the 10th and 90th percentile heights are moved to lo and hi.
    // That gives roughly 55% tussock, 20% forest and 20% scree ridges on any seed.
    // (TerrainGenerator._fitElevationWindow)
    elevationWindow: { lo: 0.45, hi: 0.70, pLo: 0.1, pHi: 0.9 }
  },

  // The land is the high (east) end of the Free Play alps-to-sea slope. The world grid is two
  // columns by three rows, and the level plays in the middle-right area. The areas above and
  // below are generated too: the one above is where "Continue" pans to (the next module), and
  // the one below means the southern edge is real land, not the world's edge.
  worldGrid: {
    cols: 2, rows: 3,
    order: [[1, 1], [1, 0]],
    openLandScale: 0.55,    // keeps the raw alps under the height clamp, so the fit has relief to work with
    pixelScaleMult: 1.8     // gameplay grid cell size, a little coarser across the six areas
  },

  // Glacial biome bands (as Free Play and Level 2). Wild pātōtara is kept rare (plantWeights), so
  // the patches the story puts down stand out, and dracophyllum is thinned a little. The lowest band is the water the tarn
  // is made of; nothing else in this window is low enough to be water.
  biomes: {
    sea: { key: 'sea', name: "Tarn", minElevation: 0, maxElevation: 0.10,
      colors: ['#1a3a52', '#1e4d6b', '#236384'], contourColor: '#0f2533',
      walkable: false, canHavePlants: false, canPlace: false },
    coastal: { key: 'coastal', name: "Glacial Outwash", minElevation: 0.10, maxElevation: 0.15,
      colors: ['#b8b09a', '#c4bca6', '#d0c8b2'], contourColor: '#8a8270',
      walkable: true, canHavePlants: false, canPlace: true },
    glacialFlats: { key: 'glacialFlats', name: "Glacial Flats", minElevation: 0.15, maxElevation: 0.28,
      colors: ['#9aa878', '#a6b484', '#b2c090'], contourColor: '#6f7d52',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'coprosma'], canPlace: true },
    shrubland: { key: 'shrubland', name: "Frost Shrubland", minElevation: 0.28, maxElevation: 0.33,
      colors: ['#7c8858', '#889464', '#94a070'], contourColor: '#5a6640',
      walkable: true, canHavePlants: true, plantTypes: ['coprosma', 'patotara', 'tussock', 'dracophyllum'], canPlace: true,
      plantWeights: { patotara: 0.1, dracophyllum: 0.5 } },
    forestRefuge: { key: 'forestRefuge', name: "Montane Forest", minElevation: 0.33, maxElevation: 0.48,
      colors: ['#2d5240', '#345e48', '#3b6a50'], contourColor: '#1e3a2c',
      walkable: true, canHavePlants: true, plantTypes: ['beech', 'fern'], canPlace: true },
    subalpine: { key: 'subalpine', name: "Subalpine Tussock", minElevation: 0.48, maxElevation: 0.66,
      colors: ['#9a9a62', '#a6a66e', '#b2b27a'], contourColor: '#70703f',
      walkable: true, canHavePlants: true, plantTypes: ['tussock', 'dracophyllum', 'patotara'], canPlace: true,
      plantWeights: { patotara: 0.1, dracophyllum: 0.5 } },
    alpine: { key: 'alpine', name: "Alpine Scree", minElevation: 0.66, maxElevation: 0.80,
      colors: ['#9098a0', '#9ea6ae', '#acb4bc'], contourColor: '#606870',
      walkable: false, canHavePlants: false, canPlace: false },
    glacier: { key: 'glacier', name: "Glacier & Ice", minElevation: 0.80, maxElevation: 1.0,
      colors: ['#dfe8ee', '#eaf2f6', '#ffffff'], contourColor: '#a8c0cc',
      walkable: false, canHavePlants: false, canPlace: false }
  },

  species: {
    moa: ['upland_moa'],
    eagle: ['haasts_eagle'],
    other: []
  },
  startingSpecies: 'upland_moa',

  // The story places its own cast (the family and one eagle), so nothing is spawned here.
  initialEntityCounts: { moa: 0, eagle: 0 },

  economy: {
    startingMauri: 60,
    seasonDuration: 2400,        // 40 s per season (a season waits for its key moment; see story)
    eggIncubationTime: 1200,
    securityTimeToLay: 1400,
    securityTimeVariation: 400,
    layingHungerThreshold: 30,
    eagleSpawnMilestones: [],
    maxPopulation: 30
  },

  // The Storm is the only tool. Moving a storm (press and hold) costs moveCost; calling a new
  // one from the toolbar costs `cost` and then recharges.
  availablePlaceables: {
    Storm: { cost: 40, moveCost: 10 }
  },

  mechanics: {
    noSpeciation: true,
    // The tussock and dracophyllum stay standing through winter (no dormant die-back), so the
    // land doesn't change under the story.
    evergreenPlants: ['tussock', 'dracophyllum'],
    // Pātōtara on the land stands bare until the player sprouts it (press and hold on it); the
    // patches the story plants come up in fruit. (Plant.sproutsByHand, Game._sprout)
    sproutPatotara: true
  },

  // ---- The story (ModuleDirector). Anything left out uses MODULE_STORY_DEFAULTS. ----------
  story: {
    eggHatchSec: 20,
    stormRadius: 56,
    stormCount: 6,
    openingZoom: 1.35,
    nextArea: [1, 0],          // "Continue" pans north, to the area above (the next module)...
    nextModule: 'module_patotara',   // ...and Module 1 carries on there (Game.startModuleHandoff)
    outroDir: 'north',
    // The Storm tool is greyed out until the second autumn attack, when a new storm is needed.
    lockedTools: { Storm: 'new_storm' },
    // Once the chick is out, the eagle flies off and every storm clears (the nest's too) until
    // autumn (ModuleDirector._calmAfterHatch).
    calmAfterHatch: true,
    // Left without a storm to walk to on the way down, they go the wrong way first (the lesson).
    journey: { wrongWay: true },
    // From autumn on, new storms gather on the tops now and then (ModuleDirector._updateWeather).
    weather: { from: 'autumn', firstSec: 3, everySec: 15, max: 3 },
    winTitle: "HOME AGAIN",
    winText: "The family is back at the nest.",
    nextText: "The next module is on its way.",

    // Each season's goals. The director ticks them by id as the story reaches them.
    goals: {
      summer: [
        { id: 'hideMother', name: "Hide the mother from the Pouākai" },
        { id: 'foodHome',   name: "She brings food home" },
        { id: 'hatched',    name: "The egg hatches" }
      ],
      autumn: [
        { id: 'chase1',     name: "Hide the family from the Pouākai" },
        { id: 'chase2',     name: "Hide them again when their storm breaks" },
        { id: 'refuge',     name: "Lead them down to the wharariki" }
      ],
      winter: [
        { id: 'winter',     name: "Keep them hidden until spring" }
      ],
      spring: [
        { id: 'home',       name: "Lead them back up to the nest" }
      ]
    }
  },

  // Unused by a module (the director decides the win), but the level format expects it.
  goals: [],

  scoreFormula: (ctx) => Math.round(ctx.moaCount * 100 + ctx.totalEarned * 0.2 - ctx.playTime / 120),

  menu: {
    title: "Tutorial: The STORM",
    subtitle: "Module 0: the Storm",
    moduleLabel: "Storms",          // the tool name on the level-select button
    // What the module is about, shown as "Next up" on the win card of the module before it:
    // a placeable (its toolbar picture) and its common name.
    focusItem: { placeable: 'Storm', name: "Storm" },
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
      "One family, one year, high in the tops.", "",
      "A moa under a storm can't be seen.",
      "Move the storms to keep them safe."
    ],
    displayPlants: ['tussock', 'patotara', 'wharariki', 'beech'],
    art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  }
};

LEVEL_REGISTRY.register(MODULE_STORMS);
