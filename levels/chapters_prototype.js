// ============================================================================
// PROTOTYPE: CHAPTERS (the module engine's worked example)
// ============================================================================
// One year of upland moa on Level 2's glacial land, with Free Play's ecology (emergent eagles,
// founded nests, winter food value, habitat stress), run by the ChapterRunner
// (mauri_chapters.js; the format and build plan are in MODULE_ENGINE_PLAN.md). Nothing here is
// scripted: the moa, the Pouākai and the plants live as they do in Free Play. The chapters
// only set the tools, the focus, the goals, and what Te Whē says when things happen.
//
//   summer   found the upland moa a nest (two speargrass patches with the moa drawn in; the
//            first is growing where the flock grazes as the level opens) and grow the flock.
//            The season waits for the nest (holdSeason). The Pouākai's first hunt of an
//            upland moa comes in summer one way or another (a guaranteed beat), unlocks fern
//            cover with a prompt to use it, and gives the hunted moa a last chance.
//   autumn   lay eggs, and keep the flock above a line.
//   winter   the waterhole joins the toolbar and the eagles press harder (a mechanics lever);
//            fewer than 3 upland moa loses (a required goal).
//   spring   branches on how many came through: a strong flock gets a stretch goal, a thin
//            one rebuilds. Either way the year ends in a win.
//
// devOnly: listed in the level select only in debug mode (D). Lines marked [Placeholder: …]
// are still to be written; the rest are working words, to be replaced.
// ============================================================================

const CHAPTERS_PROTOTYPE = {
  id: 'chapters_prototype',
  name: 'Prototype: Chapters',
  devOnly: true,
  unlockCondition: null,

  zoom: LEVEL_GLACIAL_KAHURANGI.zoom,
  startSeason: 'summer',

  terrain: Object.assign({}, LEVEL_GLACIAL_KAHURANGI.terrain),
  biomes: LEVEL_GLACIAL_KAHURANGI.biomes,

  species: {
    moa: ['upland_moa', 'little_bush_moa', 'stout_legged_moa'],
    eagle: ['haasts_eagle'],
    other: []
  },
  startingSpecies: 'upland_moa',
  initialSpeciesDistribution: { upland_moa: 5, little_bush_moa: 4, stout_legged_moa: 3 },
  initialEntityCounts: { moa: 12, eagle: 2 },

  economy: {
    startingMauri: 80,
    seasonDuration: 3000,        // 50 s a season
    eggIncubationTime: 600,
    securityTimeToLay: 1000,
    securityTimeVariation: 200,
    layingHungerThreshold: 26,
    eagleSpawnMilestones: [],
    maxPopulation: 50
  },

  // Every tool any chapter offers (each chapter's `tools` picks from these).
  availablePlaceables: {
    speargrass: { cost: 25 },                    // the upland moa's plant: two patches found a nest
    shelter:    { cost: 35, eagleSpotFrac: 0.5 },// fern cover (half cover, as in Free Play)
    waterhole:  { cost: 45, radius: 60 }         // winter: slows hunger
  },
  paletteOrder: [['speargrass'], ['shelter', 'waterhole']],

  // Free Play's ecology, without its year engine (no climate drift; one focus moa).
  mechanics: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.mechanics, {
    climateDrift: null,
    focalSpecies: ['upland_moa'],
    eagleMaxPopulation: 4,
    landRegionMates: true    // a moa only courts a mate on its own land (TerrainGenerator.landRegions)
  }),

  // ---- The chapters (ChapterRunner) -------------------------------------------------
  // A character adopted from the simulation: the oldest upland moa at the start. She's a real
  // bird, so she can really be lost (the 'matriarch_lost' reaction).
  cast: {
    matriarch: { title: "The Matriarch", species: 'upland_moa', pick: 'oldest', pitch: 0.85 }
  },

  chapters: [
    { id: 'summer', title: "Summer: a home for the upland moa",
      tools: ['speargrass', 'shelter'],
      locked: ['shelter'],                       // the first hunt unlocks it (first_hunt)
      focus: ['upland_moa'],
      protect: 2,                                // the other moa hold at 2: the risk is the upland moa's
      nesting: { species: 'upland_moa', plant: 'speargrass' },
      sites: { grazing: { find: 'flock', species: 'upland_moa' } },   // where the flock is as summer opens
      start: [
        // A speargrass patch already growing where they graze (standing: it doesn't wear out).
        { place: { type: 'speargrass', at: 'grazing', standing: true } },
        { say: [
          ['guide', "This is the high country. The upland moa graze its tussock, and the Pouākai hunts them from above."],
          ['matriarch', "[Placeholder: the oldest moa of the flock, on the flock needing somewhere safe to nest]"],
          ['guide', "Upland moa love SPEARGRASS, and a patch is already growing where they graze. Grow a second close beside it, and they'll settle a nest between them.",
            { lit: ['upland_moa', 'speargrass'] }]
        ] },
        { banner: { words: ["Grow SPEARGRASS beside the patch the upland moa graze", "Tap beside the patch to grow SPEARGRASS"],
                    tool: 'speargrass', until: { placed: 'speargrass' }, lit: ['upland_moa', 'speargrass'] } }
      ],
      beats: [
        // The first hunt of an upland moa comes in summer one way or another. The eagles are
        // drawn over the flock and made hungry; if none has gone for an upland moa by 30 s, the
        // nearest is sent after the matriarch (or any upland moa, if she's gone). The
        // first_hunt reaction answers it either way. The beat is done on the hunt EVENT (a
        // count in the beat's own scope), not on the polled state `hunting: true`: an eagle's
        // lock can drop between polls, and in one headless run the state read false at every
        // poll after a real hunt, so the beat was wrongly logged as forced (ENGINE_ASSESSMENT.md §11).
        { id: 'hunt_comes', when: { after: 8 },
          invite: [{ eagle: { watch: 'grazing', hunger: 55 } }],
          until: { gained: ['hunts:upland_moa', '>=', 1] },
          by: 30, force: [{ aim: { at: ['matriarch', 'upland_moa'] } }] }
      ],
      goals: [
        { id: 'nest',  name: "Found a nest for the upland moa", done: { gained: ['nests', '>=', 1] }, reward: 20 },
        { id: 'flock', name: "Upland moa: {n}/{target}",        done: { count: ['upland_moa', '>=', 8] }, reward: 20 }
      ],
      holdSeason: { until: { goal: 'nest' }, at: 0.9, maxSec: 60 }   // summer waits for the nest (a minute at most)
    },

    { id: 'autumn', title: "Autumn: build up the flock",
      goals: [
        { id: 'eggs',  name: "Upland moa eggs laid: {n}/{target}", done: { gained: ['laid:upland_moa', '>=', 3] }, reward: 15 },
        { id: 'keep5', name: "Keep {target} upland moa",           keep: { count: ['upland_moa', '>=', 5] }, reward: 15 }
      ]
    },

    { id: 'winter', title: "Winter: the lean months",
      tools: ['speargrass', 'shelter', 'waterhole'],
      mechanics: { eagleTargetRatio: 1 / 7 },    // hungrier eagles: more of them for each moa
      start: [
        { say: [['guide', "Winter takes the goodness out of the tussock. A WATERHOLE slows a moa's hunger: grow one where the flock shelters."]] }
      ],
      goals: [
        { id: 'water',   name: "Grow a waterhole", done: { placed: 'waterhole' }, reward: 10 },
        { id: 'hold3',   name: "Keep {target} upland moa through winter", keep: { count: ['upland_moa', '>=', 3] },
          required: true, failReason: "Too few upland moa came through the winter." },
        { id: 'through', name: "Come through the winter", survive: true, reward: 25 }
      ],
      reactions: [
        // Only while winter runs: a word halfway through.
        { id: 'midwinter', when: { seasonProgress: ['>=', 0.5] }, notify: "Halfway through winter. Hold on." }
      ],
      next: [[{ count: ['upland_moa', '>=', 8] }, 'spring_thrive'], [true, 'spring_rebuild']]
    },

    { id: 'spring_thrive', title: "Spring: a thriving flock",
      start: [{ say: [['guide', "The flock came through strong. Let's see how far it can grow."]] }],
      goals: [
        { id: 'chicks', name: "Upland moa chicks: {n}/{target}", done: { gained: ['hatched:upland_moa', '>=', 3] }, reward: 20 },
        { id: 'big',    name: "Stretch: upland moa {n}/{target}", done: { count: ['upland_moa', '>=', 14] }, reward: 40, stretch: true }
      ],
      next: 'win'
    },

    { id: 'spring_rebuild', title: "Spring: rebuild the flock",
      start: [{ say: [['guide', "Only a few came through. A second nest gives the flock a better chance."]] }],
      goals: [
        { id: 'nest2',  name: "Found another nest", done: { gained: ['nests', '>=', 1] }, reward: 20 },
        { id: 'regrow', name: "Upland moa: {n}/{target}", done: { count: ['upland_moa', '>=', 6] }, reward: 20 }
      ],
      next: 'win'
    }
  ],

  // ---- Reactions, all year: words for what the simulation does ------------------------
  reactions: [
    // The Pouākai's first hunt of an upland moa: fern cover unlocks, and a prompt to use it. The
    // eagle gets 6 s it can't strike in (a last chance, once the prompt is answered).
    { id: 'first_hunt', on: 'eagle_hunting', if: { focus: true },
      unlock: 'shelter',
      do: [{ eagle: { which: '$eagle', grace: 6 } }],
      say: [['guide', "The Pouākai is hunting an upland moa! Under a FERN SHELTER a moa is hidden from its eyes.",
              { lit: ['$target', '$eagle'] }]],
      banner: { words: ["Grow a FERN SHELTER over the hunted moa", "Tap beside the moa to grow the SHELTER"],
                tool: 'shelter', lit: ['$target', '$eagle'],
                until: { any: [{ placed: 'shelter' }, { hidden: '$target' }, { not: { alive: '$target' } }] } } },

    // Every catch is news, but not every one needs a panel.
    { id: 'caught', on: 'moa_killed', if: { focus: true }, once: false, cooldown: 30,
      notify: ["The Pouākai took an upland moa.", 'error'] },

    { id: 'nest_founded', on: 'nest_founded',
      moment: { on: '$site', text: "A new nest!" },
      say: [['guide', "A nest! Moa lay faster at a nest, and their eggs hatch sooner.", { lit: ['nests'] }]] },

    { id: 'first_chick', on: 'egg_hatched', if: { species: 'upland_moa' },
      moment: { on: '$moa', text: "An upland moa chick!" } },

    // A need: still no nest 25 s into summer, a reminder (without stopping play).
    { id: 'nest_need', chapters: ['summer'], when: { not: { goal: 'nest' } }, for: 25,
      notify: "The upland moa still need a nest: SPEARGRASS close beside the patch where they graze." },

    { id: 'first_egg', on: 'egg_laid', if: { species: 'upland_moa' },
      say: [['guide', "An upland moa egg! It's safest at the nest, while the flock stays close.", { lit: ['$egg'] }]] },

    { id: 'matriarch_lost', on: 'cast_lost', if: { cast: 'matriarch' },
      say: [['guide', "The old matriarch is gone. [Placeholder: what her loss means to the flock]"]] },

    // Each time the flock drops to 3 (not every frame it stays there).
    { id: 'flock_low', when: { count: ['upland_moa', '<=', 3] }, once: false, cooldown: 60,
      say: [['guide', "Only a few upland moa are left. Keep them under cover, and near food."]] }
  ],

  // The runner decides the win; the level format expects these.
  goals: [],
  scoreFormula: (ctx) => Math.round(ctx.moaCount * 50 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 50),

  menu: {
    title: "Prototype: Chapters",
    subtitle: "Prototype: chapters",
    areaLabel: "Kahurangi uplands, Te Waipounamu",
    areaSubtitle: "Debug mode only",
    featuredSpecies: {
      key: 'upland_moa',
      displayName: 'Upland Moa',
      localName: 'Moa Pukepuke',
      spriteKey: 'upland_walk_01',
      spriteScale: 0.4
    },
    flavorText: [
      "One year of upland moa, nothing scripted.", "",
      "Chapters set the tools and goals;",
      "the ecosystem decides how it goes."
    ],
    displayPlants: ['speargrass', 'tussock', 'fern', 'beech'],
    art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
  },

  tutorial: {
    guideSprite: 'mantis_talk',
    tips: null
  }
};

LEVEL_REGISTRY.register(CHAPTERS_PROTOTYPE);
