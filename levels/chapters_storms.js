// ============================================================================
// THE STORM, ON THE CHAPTERS ENGINE (the emergent version of Module 0)
// ============================================================================
// What this lesson is. A pair of upland moa have a nest and an egg high on the tops. A Haast's
// eagle (the Pouākai) hunts from above. The one rule the player learns: a moa under a storm
// cloud can't be seen, so the eagle hunts whatever it CAN see. The player moves the standing
// storms over the moa the eagle goes for (press and hold a storm, then drag it), and later
// calls new storms when the old ones blow out.
//
// What the player sees. Summer: the pair at the nest, the egg, a patch of pātōtara berries in
// the open below, and the eagle circling. The eagle grows hungry (it shows it: an amber ring,
// then a "!" when it has picked a moa and begins its slow approach), and goes for whoever is
// out in the open. Cover that moa and the eagle turns to the herd of stout-legged moa on the
// low ground, which has numbers to spare. The egg hatches: Pukepuke. Autumn: the family drifts
// downhill on its own, as upland moa do when the cold comes; the player leads them (tap tussock
// so they feed as they go) and keeps storms over them, down to the water. Winter by the water,
// with storms blowing out and a hungrier eagle. Spring: home to the nest.
//
// What the simulation does on its own. Everything the animals do: the eagle's hunger, choice
// of prey and hunting; the moa's feeding, drifting with the seasons and breeding; the chick's
// growth. Nothing here moves an animal. The script only sets the stage (where the nest, the
// food and the water are, who the family is), sets the pressure (where the eagle watches, how
// hungry it is), measures what happened (goals) and answers it (the lines and prompts).
//
// What is guaranteed, and only in which sketch. The GUIDED sketch makes sure the first hunt
// comes in summer (if the eagle hasn't gone for a family member by itself within 30 seconds of
// the invitation, it is sent after one), waits for the egg to hatch before summer ends, and
// loses the level if a parent is taken. The OPEN sketch forces nothing: the eagle hunts when it
// is hungry, the seasons run on, and only losing Pukepuke ends it. Both log every beat as
// natural or forced (press J in debug mode, or run tools/batch.js), which is how the two are
// compared.
//
// How it is built. makeChaptersStorms(sketch) returns the level for one setting of the dial
// (STORM_SKETCHES); every sketch is registered as its own level, and the family is registered
// so the level select draws one card with a button per sketch. The land and biomes are the
// legacy Module 0's. See MODULE_SCRIPTING.md for every key used here.
// ============================================================================

const CHAPTERS_STORMS_FAMILY = 'chapters_storms';

// The dial: what differs between sketches of the same lesson.
const STORM_SKETCHES = {
  guided: {
    label: 'Guided',
    forced: true,        // the first hunt is forced by a deadline if the eagle doesn't come on its own
    hold: true,          // summer waits (a while) for the hatch, autumn for the walk down, spring for home
    graceSec: 6,         // the eagle's wind-up: it chases slowly and can't strike for this long
    eagles: 1,
    eagleBreeding: false,
    storms: 4,           // standing storms the land starts with (one is over the nest)
    pause: true,         // the first prompt of each kind pauses play
    loseParents: true,   // a parent taken ends the level (Pukepuke taken always does)
    stormCost: 25,
    eagleHungerRate: 0.012   // (0..100 a frame: a meal every couple of minutes)
  },
  open: {
    label: 'Open',
    forced: false,
    hold: false,
    graceSec: 3.5,
    eagles: 1,           // (one to start; they may breed to two)
    eagleBreeding: true,
    storms: 2,
    pause: false,
    loseParents: false,
    stormCost: 40,
    eagleHungerRate: 0.014
  }
};

function makeChaptersStorms(sketchKey) {
  const D = STORM_SKETCHES[sketchKey];
  const id = `${CHAPTERS_STORMS_FAMILY}_${sketchKey}`;

  // Standing storms at the start, on the tops near the nest (not over it: the family starts in
  // the open, which is the point), for the player to move.
  const stormSites = ['tops', 'lookout', 'tops2', 'lookout2'].slice(0, D.storms);
  const openingStorms = stormSites.map(at => ({ place: { type: 'Storm', at, standing: true } }));

  // A line, or (in the open sketch, after the opening) a notice that doesn't stop play.
  const tell = (text, lit) => D.pause ? { say: [['guide', text, lit ? { lit } : {}]] } : { notify: text };

  return {
    id,
    name: `The Storm (${D.label})`,
    module: true,
    section: 'chapters',
    sketch: { of: CHAPTERS_STORMS_FAMILY, label: D.label, dial: D },
    claim: "A moa under a storm can't be seen by the Pouākai, so the eagle hunts what it can see.",
    guide: ['haasts_eagle', 'upland_moa', 'subalpine', 'predator_prey'],
    nextLevel: 'chapters_patotara_guided',
    unlockCondition: null,

    zoom: 2.0,
    startSeason: 'summer',

    // Module 0's land, fitted a little lower so there is low ground below the tops: shrubland
    // and flats for the herd and the water, forest between, tussock and scree above.
    terrain: Object.assign({}, MODULE_STORMS.terrain, {
      plantDensity: 0.0075,        // (the tops feed a family: on the legacy density they grazed them bare)
      elevationWindow: { lo: 0.24, hi: 0.70, pLo: 0.1, pHi: 0.9 }
    }),
    biomes: MODULE_STORMS.biomes,

    species: {
      moa: ['upland_moa', 'stout_legged_moa'],
      eagle: ['haasts_eagle'],
      other: []
    },
    startingSpecies: 'upland_moa',
    // The herd on the low ground is seeded by the simulation; the family is set down at the nest
    // by the summer chapter (spawn + adopt), so the story knows who is who.
    initialSpeciesDistribution: { stout_legged_moa: 7 },
    initialEntityCounts: { moa: 7, eagle: D.eagles },

    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 90,
      seasonDuration: 2700,        // 45 s a season
      eggIncubationTime: 2400,     // 40 s, faster at the nest (nestingSites.eggSpeedBonus): the hatch comes mid-summer
      eagleSpawnMilestones: [],
      maxPopulation: 40
    }),

    // The Storm hides a moa here (cover, like the fern shelter) and never stuns the eagle; the
    // waterhole is set down by the autumn chapter as the family's tarn.
    availablePlaceables: {
      Storm: { cost: D.stormCost, moveCost: 10, radius: 64, blocksEagleVision: true, distractsEagles: false,
               description: "A moa under the storm can't be seen by the Pouākai." },
      waterhole: { cost: 45, radius: 40 }
    },

    mechanics: {
      noSpeciation: true,
      evergreenPlants: MODULE_STORMS.mechanics.evergreenPlants,
      landRegionMates: true,
      // The eagle: its own hunger and choice of prey, with a wind-up the player can see and a
      // preference for the species with numbers to spare. (Scarcity only shields a last moa.)
      emergentEagles: true,
      eagleMaxPopulation: D.eagleBreeding ? 2 : D.eagles,
      eagleHungerRate: D.eagleHungerRate,
      eagleStarveThreshold: 88, eagleStarveTimeout: 3600,
      eagleTargetRatio: 1 / 4,
      eaglePreyPopThreshold: 1, eagleScarcePreyPenalty: 3,
      eagleSurplusPreference: true,
      eagleTelegraph: { graceSec: D.graceSec, warnBelow: 10 },
      // Cover: a storm breaks the eagle's lock and a covered moa holds still; a tap under the
      // clouds still rustles a plant; moa notice a storm a little further off.
      coverBreaksLock: true,
      coverCalmsMoa: true,
      lureUnderStorm: true,
      placeableQueryRadius: 100,
      // The herd can't be wiped out by the lesson.
      populationFloors: { stout_legged_moa: 2 },
      // The nest is a nesting site (set down by the summer chapter): eggs gather there and hatch
      // sooner. No sites are seeded.
      nestingSites: { forestCount: 0, openCount: 0, radius: 40, laySnapRadius: 150, drawRadius: 260,
                      layBoost: 0.5, eggSpeedBonus: 1.5 },
      // Out of its season's band a moa feels the cold: what moves the family down in autumn.
      habitatStress: true, habitatStressMargin: 0.08, habitatStressPenalty: 0.4, winterStressMult: 1.4,
      // Hunger is slowed and a chick gets hungry no faster than a grown moa: the danger here is
      // the eagle, not famine (on this small land the open rates starve a family in a season).
      hungerRateMult: 0.6,
      juvenileHungerMult: 1.0
    },

    // The family: bound by `adopt` as the summer chapter opens (manual), and the chick when it hatches.
    cast: {
      mama:     { title: "Mama Moa", species: 'upland_moa', manual: true, pitch: 0.85 },
      papa:     { title: "Papa Moa", species: 'upland_moa', manual: true },
      pukepuke: { title: "Pukepuke", species: 'upland_moa', manual: true, scale: 0.6 }
    },

    // Where things are, found on the land as the level starts.
    sites: {
      nest:    { find: 'high', near: { fx: 0.55, fy: 0.45 }, within: 260 },   // high open ground near the middle
      grove:   { find: 'open', near: 'nest', dist: [50, 100] },                // the berries, out in the open
      tops:    { near: 'nest', dist: [60, 110] },                               // where the storms stand at the start
      lookout: { near: 'nest', dist: [90, 150] },
      tops2:   { near: 'grove', dist: [60, 110] },
      lookout2: { near: 'tops', dist: [70, 130] },
      tarn:    { find: 'low', near: 'nest', within: 560 }                      // the lowest ground within a walk
    },

    chapters: [
      { id: 'summer', title: "Summer: a nest on the tops",
        tools: ['Storm'],
        locked: ['Storm'],            // the standing storms are moved; calling one comes with autumn
        focus: ['upland_moa'],
        start: [
          { nest: { at: 'nest', radius: 40, hideClutch: true, as: 'home' } },
          { spawn: { type: 'upland_moa', at: 'nest', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { adopt: { mama: { species: 'upland_moa', near: 'nest', female: true },
                     papa: { species: 'upland_moa', near: 'nest', female: false } } },
          { lay: { species: 'upland_moa', at: 'nest' } },
          { sow: { plant: 'patotara', at: 'grove', count: 5, radius: 26, sprouted: true } },
          ...openingStorms,
          // The eagle starts over the herd below; brought up to a lookout by the nest, not yet
          // hungry, so its first hunt (the beat below) starts up here.
          { eagle: { which: 'nearest', near: 'nest', watch: 'lookout', hunger: 30 } },
          { say: [
            ['guide', "High on the tops, Mama and Papa Moa have a nest, and an egg.", { lit: ['mama', 'papa'] }],
            ['guide', "The Pouākai hunts from above. A moa under a STORM can't be seen.", { lit: ['Storm'] }],
            ['guide', "Watch the eagle. When it's hungry it will come for whoever is in the open.", { lit: ['haasts_eagle'] }]
          ] }
        ],
        beats: [
          // The first hunt of a family member, in summer: the eagle is drawn over the berries and
          // made hungry (the invitation); the guided sketch sends it after a parent by a deadline.
          // (Its hunger is set just under the hunt threshold, so the hunt begins a few seconds
          // later, by which time the bird is over the berries.)
          Object.assign({ id: 'first_hunt', when: { after: 10 },
            invite: [{ eagle: { which: 'nearest', near: 'nest', watch: 'grove', hunger: 41 } }],
            until: { seen: ['eagle_hunting', { species: 'upland_moa' }] },
            once: true },
            D.forced ? { by: 30, force: [{ aim: { at: ['mama', 'papa'] } }] } : {})
        ],
        goals: [
          { id: 'seen_off', name: "See off the Pouākai's first hunt",
            done: { all: [{ beat: 'first_hunt' }, { not: { hunting: true } }] }, reward: 15 },
          { id: 'hatched', name: "The egg hatches", done: { seen: ['egg_hatched', { species: 'upland_moa' }] }, reward: 20 },
          ...(D.loseParents ? [{ id: 'parents', name: "Keep Mama and Papa safe",
            keep: { all: [{ alive: 'mama' }, { alive: 'papa' }] }, required: true,
            failReason: "Mama or Papa Moa was lost." }] : [])
        ],
        // (Guided: summer waits for the hatch and for the first hunt to have been seen off.)
        holdSeason: D.hold ? { until: { all: [{ goal: 'hatched' }, { beat: 'first_hunt' }] }, at: 0.9, maxSec: 45 } : undefined
      },

      { id: 'autumn', title: "Autumn: down to the water",
        tools: ['Storm'],
        start: [
          { place: { type: 'waterhole', at: 'tarn', standing: true } },
          { fade: { type: 'Storm', sec: 45, refreshOnMove: true } },
          tell("The air is cooling. Upland moa drift down to lower ground for winter: lead them to the water.", ['waterhole', 'mama']),
          tell("Tap TUSSOCK along the way so they feed as they go, and keep a STORM over them. Storms blow out now; moving one freshens it.")
        ],
        goals: [
          { id: 'down', name: "Lead the family down to the water", done: { near: ['mama', 'tarn', 100] }, reward: 20 },
          ...(D.loseParents ? [{ id: 'parents2', name: "Keep Mama and Papa safe",
            keep: { all: [{ alive: 'mama' }, { alive: 'papa' }] }, required: true,
            failReason: "Mama or Papa Moa was lost." }] : [])
        ],
        holdSeason: D.hold ? { until: { goal: 'down' }, at: 0.9, maxSec: 30 } : undefined
      },

      { id: 'winter', title: "Winter: by the water",
        tools: ['Storm'],
        start: [
          { fade: { type: 'Storm', sec: 25, refreshOnMove: true } },
          tell("Winter. Storms blow out faster now, and the Pouākai is hungrier. Keep calling new ones over the family.")
        ],
        reactions: [
          { id: 'winter_press', when: { seasonProgress: ['>=', 0.3] }, do: [{ eagle: { hunger: 50, watch: 'tarn' } }],
            notify: "The Pouākai circles the water, hungry." },
          { id: 'winter_press2', when: { seasonProgress: ['>=', 0.7] }, do: [{ eagle: { hunger: 56 } }] }
        ],
        goals: [
          { id: 'through', name: "Come through the winter", survive: true, reward: 25 },
          ...(D.loseParents ? [{ id: 'parents3', name: "Keep Mama and Papa safe",
            keep: { all: [{ alive: 'mama' }, { alive: 'papa' }] }, required: true,
            failReason: "Mama or Papa Moa was lost." }] : [])
        ]
      },

      { id: 'spring', title: "Spring: home to the tops",
        tools: ['Storm'],
        start: [ tell("Spring! The tops are green again. Lead the family home to the nest.", ['nests']) ],
        goals: [
          // Whoever is left of the family, home: the year isn't won until someone is.
          { id: 'home', name: "Bring the family home to the nest", reward: 25, required: true,
            done: { any: [{ near: ['pukepuke', 'home', 110] }, { near: ['mama', 'home', 110] }, { near: ['papa', 'home', 110] }] },
            failReason: "Summer came and the family hadn't made it home to the nest." }
        ],
        holdSeason: D.hold ? { until: { goal: 'home' }, at: 0.9, maxSec: 30 } : undefined,
        next: 'win'
      }
    ],

    // All year: the words and prompts that answer what the simulation does.
    reactions: [
      // The eagle has picked a family member: cover it. (Paused and lit the first time in the
      // guided sketch; a running prompt after that, and always in the open sketch.)
      { id: 'cover', on: 'eagle_hunting', if: { species: 'upland_moa' },
        banner: { words: ["The Pouākai has seen {species}! Move a STORM over it", "Set the STORM down over the moa"],
                  until: { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] },
                  lit: ['$target', '$eagle'], pause: D.pause, maxSec: 25 } },
      { id: 'cover_again', on: 'eagle_hunting', if: { species: 'upland_moa' }, once: false, cooldown: 12,
        banner: { words: ["The Pouākai is after the family! Cover the hunted moa with a STORM", "Set the STORM down over the moa"],
                  until: { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] },
                  lit: ['$target', '$eagle'], pause: false, maxSec: 20 } },
      // The lesson's other half: covered, the eagle turns to the herd.
      { id: 'herd_taken', on: 'moa_killed', if: { species: 'stout_legged_moa' },
        say: [['guide', "The Pouākai took a stout-legged moa instead. It has to eat, and they are many.", { lit: ['stout_legged_moa'] }]] },
      { id: 'herd_taken_again', on: 'moa_killed', if: { species: 'stout_legged_moa' }, once: false, cooldown: 30,
        notify: "The Pouākai fed on the herd." },
      { id: 'family_taken', on: 'moa_killed', if: { species: 'upland_moa' }, once: false,
        notify: ["The Pouākai took one of the upland moa.", 'error'] },
      // The hatching: the chick is adopted as Pukepuke the moment it is out.
      { id: 'hatched', on: 'egg_hatched', if: { species: 'upland_moa' },
        do: [{ adopt: { pukepuke: '$moa' } }],
        moment: { on: '$moa', text: "Pukepuke has hatched!" },
        say: [['guide', "A chick: Pukepuke. Keep the little one under the storms too.", { lit: ['pukepuke'] }]] },
      // The eagle's hunger, before it hunts: the cue to look at who is in the open.
      { id: 'hungry_eagle', when: { eagleHunger: ['>=', 38] }, once: false, cooldown: 40,
        notify: "The Pouākai is getting hungry. Who is out in the open?" },
      // The first storm to blow out unlocks the Storm tool: call a new one.
      { id: 'storm_gone', on: 'placeable_expired', if: { type: 'Storm' },
        unlock: 'Storm',
        banner: { words: ["A STORM has blown out! Tap the STORM button and call a new one", "Tap beside the family to call the STORM"],
                  tool: 'Storm', until: { placed: 'Storm' }, lit: ['mama', 'papa', 'pukepuke'], pause: D.pause, maxSec: 30 } },
      // Losses. Pukepuke taken always ends it; a parent taken ends the guided sketch (its
      // required goals) and is a line in the open one.
      { id: 'pukepuke_lost', on: 'cast_lost', if: { cast: 'pukepuke', cause: 'eagle' }, do: [{ lose: "The Pouākai took Pukepuke." }] },
      { id: 'pukepuke_starved', on: 'cast_lost', if: { cast: 'pukepuke', cause: ['starved', 'unknown'] },
        do: [{ lose: "Pukepuke starved. A family needs food close by: tap plants near them to bring them to it." }] },
      { id: 'parent_taken', on: 'cast_lost', if: { cast: ['mama', 'papa'], cause: 'eagle' }, once: false,
        notify: ["The Pouākai took one of the parents.", 'error'] },
      { id: 'parent_starved', on: 'cast_lost', if: { cast: ['mama', 'papa'], cause: ['starved', 'unknown'] }, once: false,
        notify: ["One of the parents starved. Tap plants near the family to bring them to food.", 'error'] },
      // Home again.
      { id: 'home_again', on: 'goal_met', if: (x) => x.event && x.event.goal === 'home',
        moment: { on: 'mama', text: "Home again!" } }
    ],

    lose: [{ when: { extinct: 'focus' }, reason: "The upland moa are gone from the tops." }],

    winTitle: "HOME AGAIN",
    winText: "The family is back at the nest, and the Pouākai is fed.",

    goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 50 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 40),

    menu: {
      title: `The Storm (${D.label})`,
      subtitle: "Chapters: the Storm",
      moduleLabel: "Storms",
      focusItem: { placeable: 'Storm', name: "Storm" },
      areaLabel: "Kahurangi uplands, Te Waipounamu",
      areaSubtitle: "Upper West Coast, South Island",
      featuredSpecies: { key: 'upland_moa', displayName: 'Upland Moa', localName: 'Moa Pukepuke', spriteKey: 'upland_walk_01', spriteScale: 0.4 },
      flavorText: [
        "One family, one year, high in the tops.", "",
        "A moa under a storm can't be seen.",
        D.label === 'Guided' ? "The first hunt is made sure of; the rest is the eagle's." : "Nothing is forced: the eagle hunts when it's hungry."
      ],
      displayPlants: ['tussock', 'patotara', 'wharariki', 'beech'],
      art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
    },

    tutorial: { guideSprite: 'mantis_talk', tips: null }
  };
}

for (const key of Object.keys(STORM_SKETCHES)) LEVEL_REGISTRY.register(makeChaptersStorms(key));
LEVEL_REGISTRY.registerFamily(CHAPTERS_STORMS_FAMILY, { label: "Storms", defaultSketch: 'chapters_storms_guided' });
