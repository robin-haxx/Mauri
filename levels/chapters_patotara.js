// ============================================================================
// PĀTŌTARA, ON THE CHAPTERS ENGINE (the emergent version of Module 1)
// ============================================================================
// What this lesson is. A year on, Mama, Papa and the young Pukepuke live beside a second
// family of upland moa, who have an egg in an established nest. By the nest grows a bare
// pātōtara bush: pressed and held, it sprouts, and its orange berries draw kea from far off. A
// kea that reaches the nest tries for the egg, and whether it gets it depends on how many moa
// are close: every moa near the nest makes the raid less likely, so gathered moa keep their
// eggs. The player gathers them by growing more pātōtara beside the nest and sprouting it (the
// moa come to feed). In winter pātōtara bears nothing, so the player grows wharariki (mountain
// flax) by the family instead. Two rules, then: berries draw kea; moa together drive kea off.
//
// What the player sees. Summer: the two families on the tops, the bare bush by the friends'
// nest, kea somewhere downslope. Sprout the bush and the kea come; a kea that reaches the egg
// either takes it (the moa were away) or is driven off (they were there). The friends' egg
// hatches: Koukou. Then the year as in the Storm lesson: down to the water for winter, the
// Pouākai hunting on its own hunger, storms as cover, and home in spring.
//
// What the simulation does on its own. The kea's choice to come (the berries are a lure), its
// flight, its raid and its retreat; the raid's odds, from the moa around the nest; the moa's
// feeding, drifting, breeding and the hatch; the eagle's hunger and hunting. Nothing here moves
// an animal.
//
// What is guaranteed, and only in which sketch. The GUIDED sketch makes sure a raid is
// attempted in summer (two more kea arrive at the berries if none has tried within 45 seconds
// of the sprouting), makes the raid fail outright once four moa are at the nest (the odds
// reach zero), and waits for Koukou to hatch before summer ends. The OPEN sketch forces
// nothing and rolls real odds. Both log every beat as natural or forced.
//
// How it is built. makeChaptersPatotara(sketch) returns the level for one setting of the dial
// (PATOTARA_SKETCHES); the land is the Storm lesson's. See MODULE_SCRIPTING.md for every key.
// ============================================================================

const CHAPTERS_PATOTARA_FAMILY = 'chapters_patotara';

const PATOTARA_SKETCHES = {
  guided: { label: 'Guided', forced: true,  hold: true,  graceSec: 6,   kea: 3, moaPenalty: 0.25, minSuccess: 0,    pause: true,  eagleHungerRate: 0.012 },
  open:   { label: 'Open',   forced: false, hold: false, graceSec: 3.5, kea: 4, moaPenalty: 0.15, minSuccess: 0.05, pause: false, eagleHungerRate: 0.014 },
  // Clues: the Guided sketch's guarantees, taught by clue first (levels/_chapters_kit.js). When
  // kea circle the nest nothing is said at first; then a question; then the instruction. The
  // same for the eagle and the storms. No floor under the herd, the families on the breeding
  // calendar (Pukepuke stays a half-grown bird beside Mama), and one more summer at the end
  // with a new egg in the neighbours' nest and nothing said.
  clues:  { label: 'Clues',  forced: true,  hold: true,  graceSec: 8,   kea: 3, moaPenalty: 0.25, minSuccess: 0,    pause: true,  eagleHungerRate: 0.012, clues: true }
};

// The Clues sketch's reactions: the Guided list with its instructions swapped for hint ladders.
function patotaraCluesReactions(list) {
  const K = CHAPTERS_KIT;
  const eggInNest = (x) => x.runner.sim.eggs.some(e => e.alive && !e.hatched && e.parentSpecies === 'upland_moa');
  const kept = list.filter(r => !['cover', 'cover_again', 'storm_gone', 'kea_near', 'sprouted'].includes(r.id));
  return K.quietAfterYear([
    // The berries are out: said as what happened, not as what to do about it.
    { id: 'sprouted', on: 'plant_sprouted',
      say: [['guide', "Berries! Kea can smell those from far off.", { lit: ['kea'] }]] },
    // Kea at a nest with an egg in it: the lesson's own ladder. Answered when the moa see a
    // kea off; lost when a kea takes the egg.
    { id: 'kea_near', when: (x) => eggInNest(x) && x.runner.nearCheck('kea', 'friendsHome', 170, null), once: false, cooldown: 30,
      until: { any: [{ seen: ['nest_raid'] }, { after: 50 }] },
      solved: { seen: ['nest_raid', { success: false }] }, lost: { seen: ['nest_raid', { success: true }] },
      hints: [
        { after: 4, notify: ["Kea are circling the neighbours' nest. What would make a kea think twice?", 'error'] },
        { after: 10, banner: { words: ["Gather the moa at the nest: grow PĀTŌTARA beside it and sprout it", "Tap beside the nest to grow PĀTŌTARA"],
                               tool: 'patotara', lit: ['kea', 'nests'], pause: false, maxSec: 20 } }
      ] },
    ...K.coverLadder({ species: 'upland_moa' }),
    ...K.praise({ chapters: K.YEAR }),
    ...K.stormLadder({ lit: ['mama', 'papa', 'pukepuke'], unlock: false, chapters: K.YEAR }),
    ...K.gaveUp(),
    ...K.arrivals(),
    ...kept
  ], ['hungry_eagle', 'gave_up', 'gave_up_again', 'raid_failed', 'raid_won', 'sprouted']);
}

function makeChaptersPatotara(sketchKey) {
  const D = PATOTARA_SKETCHES[sketchKey];
  const id = `${CHAPTERS_PATOTARA_FAMILY}_${sketchKey}`;
  const tell = (text, lit) => D.pause ? { say: [['guide', text, lit ? { lit } : {}]] } : { notify: text };
  const coverUntil = { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] };

  return {
    id,
    name: `Pātōtara (${D.label})`,
    module: true,
    section: 'chapters',
    sketch: { of: CHAPTERS_PATOTARA_FAMILY, label: D.label, dial: D },
    claim: "Sprouted pātōtara berries draw kea; moa gathered at a nest drive them off.",
    teaches: ['sprout', 'berries_draw_kea', 'moa_defend_nests', 'winter_food'],   // (rule names: tools/coverage.js)
    guide: ['kea', 'patotara', 'upland_moa'],
    nextLevel: 'chapters_freeplay_guided',
    unlockCondition: null,

    zoom: 2.0,
    startSeason: 'summer',
    terrain: Object.assign({}, MODULE_STORMS.terrain, {
      plantDensity: 0.0075,
      elevationWindow: { lo: 0.24, hi: 0.70, pLo: 0.1, pHi: 0.9 }
    }),
    biomes: MODULE_STORMS.biomes,

    species: { moa: ['upland_moa', 'stout_legged_moa'], eagle: ['haasts_eagle'], other: ['kea'] },
    startingSpecies: 'upland_moa',
    initialSpeciesDistribution: { stout_legged_moa: 7 },
    initialEntityCounts: { moa: 7, eagle: 1 },

    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 100, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 40
    }),

    availablePlaceables: {
      patotara:  { cost: 25 },
      wharariki: { cost: 25 },
      Storm:     { cost: 40, moveCost: 10, radius: 64, blocksEagleVision: true, distractsEagles: false,
                   description: "A moa under the storm can't be seen by the Pouākai." },
      waterhole: { cost: 45, radius: 40 }
    },

    mechanics: {
      noSpeciation: true,
      evergreenPlants: MODULE_STORMS.mechanics.evergreenPlants,
      landRegionMates: true,
      // Pātōtara comes up bare until the player sprouts it; grown food follows the seasons, so
      // it bears nothing in winter.
      sproutPatotara: true,
      placedPlantsSeasonal: true,
      // Kea: drawn from afar by sprouted berries, and raiding a nest at the odds the moa set.
      keaBerryLureRadius: 400,
      keaRaidsEggs: 'odds',
      keaRaidRadius: 95, keaRaidNutrition: 40, keaRaidCooldownSec: 6,
      keaRaid: { baseSuccess: 0.95, moaPenalty: D.moaPenalty, minSuccess: D.minSuccess, moaRadius: 95 },
      flyerEdgeMargin: 14, stormFlushMult: 1.0,
      // The eagle and cover, as the Storm lesson.
      emergentEagles: true, eagleMaxPopulation: 1, eagleHungerRate: D.eagleHungerRate,
      eagleStarveThreshold: 88, eagleStarveTimeout: 3600, eagleTargetRatio: 1 / 4,
      eaglePreyPopThreshold: 1, eagleScarcePreyPenalty: 3, eagleSurplusPreference: true,
      eagleTelegraph: { graceSec: D.graceSec, warnBelow: 10 },
      coverBreaksLock: true, coverCalmsMoa: true, lureUnderStorm: true, placeableQueryRadius: 100,
      populationFloors: D.clues ? {} : { stout_legged_moa: 2 },
      ...(D.clues ? Object.assign({ rescueImmigration: { stout_legged_moa: { below: 3, count: 3, afterSeasons: 1 } },
                                    coverSendsEagleAway: { after: 2, sec: 45 } }, CHAPTERS_KIT.familyCalendar) : {}),
      nestingSites: { forestCount: 0, openCount: 0, radius: 40, laySnapRadius: 150, drawRadius: 260, layBoost: 0.5, eggSpeedBonus: 1.5 },
      habitatStress: true, habitatStressMargin: 0.08, habitatStressPenalty: 0.4, winterStressMult: 1.4,
      hungerRateMult: 0.6, juvenileHungerMult: 1.0
    },

    cast: {
      mama:       { title: "Mama Moa",  species: 'upland_moa', manual: true, pitch: 0.85 },
      papa:       { title: "Papa Moa",  species: 'upland_moa', manual: true },
      pukepuke:   { title: "Pukepuke",  species: 'upland_moa', manual: true, scale: 0.7 },
      friendMama: { title: "The neighbour", species: 'upland_moa', manual: true, pitch: 0.9 },
      friendPapa: { title: "The neighbour", species: 'upland_moa', manual: true },
      koukou:     { title: "Koukou",    species: 'upland_moa', manual: true, scale: 0.6 }
    },

    sites: {
      friendNest: { find: 'high', near: { fx: 0.5, fy: 0.42 }, within: 240 },
      home:       { find: 'open', near: 'friendNest', dist: [70, 110] },      // where our family lives
      patch:      { find: 'open', near: 'friendNest', dist: [36, 70] },       // the bare bush by the nest
      keaNest:    { near: 'friendNest', dist: [170, 250] },                   // where the kea start
      tops:       { near: 'friendNest', dist: [60, 110] },
      lookout:    { near: 'home', dist: [80, 140] },
      tarn:       { find: 'low', near: 'friendNest', within: 560 }
    },

    chapters: [
      { id: 'summer', title: "Summer: new neighbours",
        tools: ['patotara', 'Storm'],
        focus: ['upland_moa'],
        start: [
          { nest: { at: 'friendNest', radius: 40, hideClutch: true, as: 'friendsHome' } },
          { spawn: { type: 'upland_moa', at: 'friendNest', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { adopt: { friendMama: { species: 'upland_moa', near: 'friendsHome', female: true },
                     friendPapa: { species: 'upland_moa', near: 'friendsHome', female: false } } },
          { lay: { species: 'upland_moa', at: 'friendsHome' } },
          { spawn: { type: 'upland_moa', at: 'home', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { spawn: { type: 'upland_moa', at: 'home', count: 1, age: 'juvenile', radius: 8, hunger: 25 } },
          { adopt: { mama: { species: 'upland_moa', near: 'home', female: true },
                     papa: { species: 'upland_moa', near: 'home', female: false },
                     pukepuke: { species: 'upland_moa', near: 'home', pick: 'youngest' } } },
          // (Clues, on the calendar: the hens have laid for now, and Pukepuke is last year's
          // chick, a year old and still at Mama's side.)
          ...(D.clues ? [CHAPTERS_KIT.hensHaveLaid(['mama', 'friendMama']),
                         (x) => { const p = x.runner.castEnts.pukepuke; if (p) { p._bornTurn = -4; p._bornYear = -1; p.mother = x.runner.castEnts.mama || null; } }] : []),
          { place: { type: 'patotara', at: 'patch', standing: true } },
          { spawn: { type: 'kea', at: 'keaNest', count: D.kea, radius: 24 } },
          { place: { type: 'Storm', at: 'tops', standing: true } },
          { place: { type: 'Storm', at: 'lookout', standing: true } },
          { eagle: { which: 'nearest', near: 'home', watch: 'lookout', hunger: 25 } },
          { say: [
            ['guide', "A year on. Pukepuke's family has neighbours: another pair of upland moa, with an egg in their nest.", { lit: ['friendMama', 'friendPapa', 'pukepuke'] }],
            ['guide', "By their nest grows a pātōtara bush, still bare. Tap and hold it to sprout its berries.", { lit: ['patotara'] }],
            ['guide', "Berries draw kea, and kea rob nests. But a kea won't dare a nest with moa around it.", { lit: ['kea'] }]
          ] },
          { banner: { words: ["Tap and hold the PĀTŌTARA to sprout its berries", "Tap and hold the PĀTŌTARA to sprout its berries"],
                      until: { seen: ['plant_sprouted'] }, lit: ['patotara'], pause: D.pause, maxSec: 40 } }
        ],
        beats: [
          // A raid is attempted in summer: the berries invite the kea; the guided sketch sends
          // two more to the bush if none has tried within 45 s of the sprouting.
          Object.assign({ id: 'raid_comes', when: { seen: ['plant_sprouted'] },
            until: { seen: ['nest_raid'] }, once: true },
            D.forced ? { by: 45, force: [{ spawn: { type: 'kea', at: 'patch', count: 2, radius: 20 } }] } : {})
        ],
        goals: [
          { id: 'sprout', name: "Sprout the pātōtara by the nest", done: { seen: ['plant_sprouted'] }, reward: 10 },
          { id: 'defend', name: "The moa drive a kea off the nest", done: { seen: ['nest_raid', { success: false }] }, reward: 20 },
          { id: 'koukou', name: "The neighbours' egg hatches", done: { seen: ['egg_hatched', { near: ['$egg', 'friendsHome', 60] }] }, reward: 20 }
        ],
        holdSeason: D.hold ? { until: { goal: 'koukou' }, at: 0.9, maxSec: 45 } : undefined
      },

      { id: 'autumn', title: "Autumn: down to the water",
        tools: ['patotara', 'Storm'],
        start: [
          { place: { type: 'waterhole', at: 'tarn', standing: true } },
          { fade: { type: 'Storm', sec: 45, refreshOnMove: true } },
          tell("The cold is coming and the moa drift down. Lead both families to the water, and keep storms over them.", ['waterhole'])
        ],
        goals: [
          { id: 'down', name: "Lead Pukepuke's family down to the water", done: { near: ['mama', 'tarn', 100] }, reward: 20 }
        ],
        holdSeason: D.hold ? { until: { goal: 'down' }, at: 0.9, maxSec: 30 } : undefined
      },

      { id: 'winter', title: "Winter: by the water",
        tools: ['wharariki', 'Storm'],
        start: [
          { fade: { type: 'Storm', sec: 25, refreshOnMove: true } },
          tell("Winter. The pātōtara bears nothing now. Grow WHARARIKI by the families: it keeps its food through the cold.", ['wharariki'])
        ],
        reactions: [
          { id: 'winter_press', when: { seasonProgress: ['>=', 0.35] }, do: [{ eagle: { hunger: 50, watch: 'tarn' } }],
            notify: "The Pouākai circles the water, hungry." }
        ],
        goals: [
          { id: 'fed', name: "Wharariki growing by the family", done: { near: ['wharariki', 'mama', 90] }, reward: 15 },
          { id: 'through', name: "Come through the winter", survive: true, reward: 25 }
        ]
      },

      { id: 'spring', title: "Spring: home to the tops",
        tools: ['patotara', 'Storm'],
        start: [ tell("Spring: the pātōtara can fruit again. Lead the family home.", ['nests']) ],
        goals: [
          { id: 'home', name: "Bring the family home beside their neighbours", reward: 25, required: !D.clues,
            done: { any: [{ near: ['pukepuke', 'home', 120] }, { near: ['mama', 'home', 120] }, { near: ['papa', 'home', 120] }] },
            failReason: "Summer came and the family hadn't made it home." }
        ],
        holdSeason: D.hold ? { until: { goal: 'home' }, at: 0.9, maxSec: 30 } : undefined,
        next: D.clues ? 'transfer' : 'win'
      },

      // Clues only: one more summer, a new egg in the neighbours' nest, and nothing said.
      ...(D.clues ? [CHAPTERS_KIT.transferChapter({
        at: 'pukepuke', tools: ['patotara', 'Storm'],
        words: "One more summer. The neighbours have a new egg, and this time nobody will tell you what to do.",
        start: [{ lay: { species: 'upland_moa', at: 'friendsHome' } }]
      })] : [])
    ],

    reactions: (D.clues ? patotaraCluesReactions : (list) => list)([
      // The berries are out: now the kea.
      { id: 'sprouted', on: 'plant_sprouted',
        say: [['guide', "Berries! Kea can smell those from far off. Grow more PĀTŌTARA beside the nest and sprout it, so the moa gather there to feed.", { lit: ['friendMama', 'friendPapa', 'mama'] }]] },
      { id: 'kea_near', when: { near: ['kea', 'friendsHome', 170] },
        banner: { words: ["Kea! Gather the moa at the nest: grow PĀTŌTARA beside it and sprout it", "Tap beside the nest to grow PĀTŌTARA"],
                  tool: 'patotara', until: { any: [{ seen: ['nest_raid'] }, { near: ['mama', 'friendsHome', 90] }] },
                  lit: ['kea', 'nests'], pause: D.pause, maxSec: 25 } },
      // The raid, both ways.
      { id: 'raid_failed', on: 'nest_raid', if: { success: false },
        moment: { on: '$site', text: "The moa drove the kea off!" },
        say: [['guide', "Together the moa are too many for a kea. Gathered at a nest, they keep their eggs.", { lit: ['nests'] }]] },
      { id: 'raid_failed_again', on: 'nest_raid', if: { success: false }, once: false, cooldown: 20,
        notify: "The moa saw off another kea." },
      { id: 'raid_won', on: 'nest_raid', if: { success: true },
        do: [{ lay: { species: 'upland_moa', at: 'friendsHome' } }],
        say: [['guide', "The kea took the egg: too few moa were near the nest. The neighbours will lay again. This time, bring the moa first.", { lit: ['nests'] }]] },
      { id: 'raid_won_again', on: 'nest_raid', if: { success: true }, once: false, cooldown: 20,
        notify: ["A kea took an egg from the nest.", 'error'] },
      // Koukou: the neighbours' chick, adopted as it hatches.
      { id: 'koukou_hatched', on: 'egg_hatched', if: { near: ['$egg', 'friendsHome', 60] },
        do: [{ adopt: { koukou: '$moa' } }],
        moment: { on: '$moa', text: "Koukou has hatched!" },
        say: [['guide', "The neighbours' chick: Koukou. Pukepuke has a friend.", { lit: ['koukou', 'pukepuke'] }]] },
      // The eagle, as the Storm lesson.
      { id: 'cover', on: 'eagle_hunting', if: { species: 'upland_moa' },
        banner: { words: ["The Pouākai has seen {species}! Move a STORM over it", "Set the STORM down over the moa"],
                  until: coverUntil, lit: ['$target', '$eagle'], pause: D.pause, maxSec: 25 } },
      { id: 'cover_again', on: 'eagle_hunting', if: { species: 'upland_moa' }, once: false, cooldown: 12,
        banner: { words: ["The Pouākai is after the moa! Cover the hunted one with a STORM", "Set the STORM down over the moa"],
                  until: coverUntil, lit: ['$target', '$eagle'], pause: false, maxSec: 20 } },
      { id: 'herd_taken', on: 'moa_killed', if: { species: 'stout_legged_moa' },
        say: [['guide', "The Pouākai took a stout-legged moa. It has to eat, and they are many.", { lit: ['stout_legged_moa'] }]] },
      { id: 'hungry_eagle', when: { eagleHunger: ['>=', 38] }, once: false, cooldown: 40,
        notify: "The Pouākai is getting hungry. Who is out in the open?" },
      { id: 'storm_gone', on: 'placeable_expired', if: { type: 'Storm' },
        banner: { words: ["A STORM has blown out! Call a new one over the families", "Tap beside the moa to call the STORM"],
                  tool: 'Storm', until: { placed: 'Storm' }, lit: ['mama', 'papa', 'pukepuke'], pause: D.pause, maxSec: 30 } },
      // Winter: a need, once the family has gone a while without flax by them.
      { id: 'winter_food', when: { all: [{ season: 'winter' }, { not: { near: ['wharariki', 'mama', 90] } }] }, for: 20, once: false, cooldown: 45,
        notify: ["The pātōtara is bare in winter. Grow WHARARIKI by the family so they can feed.", 'error'] },
      // Losses: the young are the stake.
      { id: 'pukepuke_lost', on: 'cast_lost', if: { cast: 'pukepuke', cause: 'eagle' }, do: [{ lose: "The Pouākai took Pukepuke." }] },
      { id: 'pukepuke_starved', on: 'cast_lost', if: { cast: 'pukepuke', cause: ['starved', 'unknown'] },
        do: [{ lose: "Pukepuke starved. In winter grow wharariki by the family; in the warm months, sprout pātōtara." }] },
      { id: 'koukou_lost', on: 'cast_lost', if: { cast: 'koukou', cause: 'eagle' }, do: [{ lose: "The Pouākai took Koukou." }] },
      { id: 'koukou_starved', on: 'cast_lost', if: { cast: 'koukou', cause: ['starved', 'unknown'] },
        do: [{ lose: "Koukou starved. In winter grow wharariki by the families; in the warm months, sprout pātōtara." }] },
      { id: 'parent_taken', on: 'cast_lost', if: { cast: ['mama', 'papa', 'friendMama', 'friendPapa'], cause: 'eagle' }, once: false,
        notify: ["The Pouākai took one of the grown moa.", 'error'] },
      { id: 'parent_starved', on: 'cast_lost', if: { cast: ['mama', 'papa', 'friendMama', 'friendPapa'], cause: ['starved', 'unknown'] }, once: false,
        notify: ["One of the grown moa starved. Tap plants near the families to bring them to food.", 'error'] },
      { id: 'home_again', on: 'goal_met', if: (x) => x.event && x.event.goal === 'home',
        moment: { on: 'mama', text: "Home again!" } }
    ]),

    lose: [{ when: { extinct: 'focus' }, reason: "The upland moa are gone from the tops." }],

    winTitle: "HOME AGAIN",
    winText: "Both families are back on the tops, and the kea have gone hungry.",

    goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 50 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 40),

    menu: {
      title: `Pātōtara (${D.label})`,
      subtitle: "Chapters: Pātōtara",
      moduleLabel: "Pātōtara",
      focusItem: { placeable: 'patotara', name: "Pātōtara" },
      areaLabel: "Kahurangi uplands, Te Waipounamu",
      areaSubtitle: "Upper West Coast, South Island",
      featuredSpecies: { key: 'kea', displayName: 'Kea', localName: 'Kea', spriteKey: 'kea', spriteScale: 0.25 },
      flavorText: [
        "New neighbours, and kea with an eye on their egg.", "",
        "Berries draw kea; moa together drive them off.",
        D.label === 'Guided' ? "The first raid is made sure of." : "Nothing is forced: real odds, every time."
      ],
      displayPlants: ['patotara', 'wharariki', 'tussock', 'dracophyllum'],
      art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
    },

    tutorial: { guideSprite: 'mantis_talk', tips: null }
  };
}

for (const key of Object.keys(PATOTARA_SKETCHES)) LEVEL_REGISTRY.register(makeChaptersPatotara(key));
LEVEL_REGISTRY.registerFamily(CHAPTERS_PATOTARA_FAMILY, { label: "Pātōtara", defaultSketch: 'chapters_patotara_guided' });
