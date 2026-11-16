// ============================================================================================
// Kahurangi: made in the Engine editor (project "kahurangi", level "kahurangi")
// ============================================================================================
// GENERATED FILE. It is written again each time the level is sent from the editor, so change
// the level there (Engine/projects/kahurangi), not here. To keep a hand-edited copy, save it
// under another file name and id outside levels/editor/, and add a <script> tag for it.
//
// The land is built by mauri_engine_land.js from terrain.engineLand, with the same code the
// editor draws it with, so it is the land the editor shows. The animals, plants and tools are
// Mauri's own: only which ones, how many and what they cost come from the editor.
//
// Left out or changed on the way across:
//   - rules.waterholes: the rule "Waterholes slow hunger" has no switch in Mauri, so the level plays without it there. Mauri's own switches can be listed in the project's Mauri settings.
// ============================================================================================

LEVEL_REGISTRY.register({
  id: "ed_kahurangi",
  name: "Kahurangi",
  section: "workshop",
  claim: "A predator rises and falls with its prey. Look after the moa and the eagles follow.",
  unlockCondition: null,
  zoom: 2.3,
  startSeason: "spring",
  terrain: {
    plantDensity: 0.005,
    engineLand: {
      map: { width: 600, height: 340, cell: 2 },
      params: {
        noiseScale: 0.005,
        octaves: 3,
        persistence: 0.3,
        lacunarity: 3,
        ridges: 1.3,
        power: 1.4,
        island: 0.6,
        warp: 0,
        shape: "island",
        direction: 90,
        seaLevel: 0,
        terraces: 0,
        lakes: 0,
        lakeLevel: 0.05,
        rivers: 0,
        riverWidth: 0.02,
        riverDepth: 0.12
      },
      seed: null
    }
  },
  biomes: {
    sea: {
      key: "sea",
      name: "Sea",
      minElevation: 0,
      maxElevation: 0.1,
      colors: ["#1a3a52", "#1e4d6b", "#236384"],
      contourColor: "#122738",
      walkable: false,
      canHavePlants: false,
      canPlace: false,
      isWater: true
    },
    coastal: {
      key: "coastal",
      name: "Coast",
      minElevation: 0.1,
      maxElevation: 0.15,
      colors: ["#c2b280", "#d4c794", "#e6dca8"],
      contourColor: "#847957",
      walkable: true,
      canHavePlants: false,
      canPlace: true
    },
    grassland: {
      key: "grassland",
      name: "Lowland Grassland",
      minElevation: 0.15,
      maxElevation: 0.3,
      colors: ["#7fb069", "#8fbc79", "#9fc889"],
      contourColor: "#567847",
      walkable: true,
      canHavePlants: true,
      plantTypes: ["tussock", "flax"],
      canPlace: true
    },
    podocarp: {
      key: "podocarp",
      name: "Podocarp Forest",
      minElevation: 0.3,
      maxElevation: 0.4,
      colors: ["#2d5a3d", "#346644", "#3b724b"],
      contourColor: "#1f3d29",
      walkable: true,
      canHavePlants: true,
      plantTypes: ["fern", "rimu"],
      canPlace: true
    },
    montane: {
      key: "montane",
      name: "Montane Forest",
      minElevation: 0.4,
      maxElevation: 0.6,
      colors: ["#4a7c59", "#528764", "#5a926f"],
      contourColor: "#32543d",
      walkable: true,
      canHavePlants: true,
      plantTypes: ["beech", "fern", "patotara"],
      canPlace: true
    },
    subalpine: {
      key: "subalpine",
      name: "Subalpine Tussock",
      minElevation: 0.6,
      maxElevation: 0.8,
      colors: ["#a8a060", "#b5ad6d", "#c2ba7a"],
      contourColor: "#726d41",
      walkable: true,
      canHavePlants: true,
      plantTypes: ["tussock", "patotara"],
      canPlace: true
    },
    alpine: {
      key: "alpine",
      name: "Alpine Rock",
      minElevation: 0.8,
      maxElevation: 0.9,
      colors: ["#8b8b8b", "#9a9a9a", "#a9a9a9"],
      contourColor: "#5f5f5f",
      walkable: false,
      canHavePlants: false,
      canPlace: false
    },
    snow: {
      key: "snow",
      name: "Permanent Snow",
      minElevation: 0.9,
      maxElevation: 1,
      colors: ["#e8e8e8", "#f0f0f0", "#ffffff"],
      contourColor: "#9e9e9e",
      walkable: false,
      canHavePlants: false,
      canPlace: false
    }
  },
  species: { moa: ["upland_moa"], eagle: ["haasts_eagle"], other: ["kea"] },
  startingSpecies: "upland_moa",
  initialSpeciesDistribution: { upland_moa: 6 },
  initialEntityCounts: { moa: 6, eagle: 1, kea: 4 },
  economy: {
    startingMauri: 60,
    seasonDuration: 1800,
    maxPopulation: 40,
    eggIncubationTime: 700,
    securityTimeToLay: 700,
    layingHungerThreshold: 35,
    eagleSpawnMilestones: []
  },
  availablePlaceables: {
    kawakawa: { cost: 25 },
    harakeke: { cost: 30 },
    shelter: { cost: 40 },
    nest: { cost: 50 },
    waterhole: { cost: 45 },
    Storm: { cost: 35 }
  },
  mechanics: { noSpeciation: true, emergentEagles: true },
  chapters: [
    {
      id: "kahurangi",
      title: "Kahurangi",
      focus: ["upland_moa"],
      goals: [
        {
          id: "hatch5",
          name: "Hatch 5 Upland Moa ({n} so far)",
          done: { gained: ["hatched:upland_moa", ">=", 5] },
          reward: 50
        },
        {
          id: "hatch20",
          name: "Hatch 20 Upland Moa ({n} so far)",
          done: { gained: ["hatched:upland_moa", ">=", 20] },
          reward: 50
        },
        { id: "two", name: "Reach 2 minutes", done: { after: 120 }, reward: 50 },
        { id: "three", name: "Reach 3 minutes", done: { after: 180 }, reward: 100 },
        {
          id: "thirty",
          name: "Have 30 moa ({n} now)",
          done: { count: ["upland_moa", ">=", 30] },
          stretch: true,
          reward: 100
        }
      ],
      until: { after: 240 },
      next: "win"
    }
  ],
  reactions: [
    {
      id: "welcome",
      when: { after: 2 },
      say: [
        [
          "guide",
          "Kia ora, kaitiaki. These upland moa find their own food and their own mates. You tend the land around them."
        ]
      ]
    },
    {
      id: "first_hunt",
      on: "eagle_hunting",
      if: { focus: true },
      say: [
        [
          "guide",
          "The Pouākai has chosen a moa. Under a FERN SHELTER it cannot be seen, and a STORM will turn the eagle away."
        ]
      ]
    },
    {
      id: "first_egg",
      on: "egg_laid",
      if: { focus: true },
      say: [["guide", "An egg! A NESTING SITE over it will hatch it sooner."]]
    },
    {
      id: "summer",
      on: "season_change",
      if: { season: "summer" },
      say: [
        [
          "guide",
          "Summer dries the lowlands. The moa climb to the tussock tops, where the pātōtara is in berry."
        ]
      ]
    },
    {
      id: "winter",
      on: "season_change",
      if: { season: "winter" },
      say: [
        [
          "guide",
          "Winter freezes the tops and little grows there. A WATERHOLE where the flock shelters slows their hunger."
        ]
      ]
    }
  ],
  lose: [{ when: { extinct: "upland_moa" }, reason: "The Upland Moa vanished from Kahurangi..." }],
  goals: [],
  menu: {
    title: "Kahurangi",
    subtitle: "Kahurangi",
    areaLabel: "Made in the editor",
    areaSubtitle: "",
    featuredSpecies: [
      {
        key: "upland_moa",
        displayName: "Upland Moa",
        localName: "Moa Pukepuke",
        spriteKey: "upland_walk_01",
        spriteScale: 0.4
      }
    ],
    flavorText: [
      "Upper West Coast, South Island, about",
      "30,000 years ago. Guide the upland moa",
      "through the seasons, and beware the",
      "Pouākai."
    ],
    displayPlants: ["tussock", "flax", "fern", "rimu", "beech", "patotara"],
    art: { coreWidth: 1600, coreHeight: 1080, bgColor: [25, 35, 30] }
  },
  tutorial: { guideSprite: "mantis_talk", tips: null }
});
