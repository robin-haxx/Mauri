// ============================================================================
// THE JOURNEY, TILE 5: THE CROWDED FOREST (the north path's first lesson)
// ============================================================================
// What this lesson is. After the five years, Pukepuke goes north into higher country with
// his parents and Koukou's parents. In winter the cold drives upland moa down to the forest
// edge, and a large flock of kākā has fed there all autumn. The one rule: the forest is
// shared, so winter food has to be grown a season ahead, at the place the family will
// winter. The lever is a grove of harakeke, planted in autumn so it is grown by winter.
//
// What the player sees. Summer on the tops, with the Pouākai (the storm, as tile 1 taught)
// and the kākā flock feeding in a fruiting grove at the forest edge below. Autumn: the
// harakeke tool, and a grove that goes in as shoots and takes most of a season to grow.
// Winter: the family comes down. A moa that feeds under the flock gets a short meal and
// carries a mark; a grown grove feeds it well; a grove planted late is still shoots. Spring
// is the season in which nothing is said. Then Koukou's parents turn south for home and
// Pukepuke, Mama and Papa go on north.
//
// What the simulation does on its own. The family's drift down with the cold, the flock's
// choice of grove, every meal and every hunt. Two rules are new and are switched on here:
// a flock feeding overhead leaves less on the forest floor (mechanics.flockStripsFloor),
// and planted harakeke takes time to grow in (the tool's growInSec).
//
// What is guaranteed. The stage: who walks on, and a fruiting grove at the forest edge, which
// is what brings the flock there (kākā home on the richest grove by their own rule).
//
// The second tool, left for the player to find (CAMPAIGN_PLAN.md, decision 13): patches of
// speargrass stand on the tops. They cannot be planted here, but any standing patch can be
// picked up and set down (press and hold), and the family follows its favoured food.
//
// Known, inferred, imagined: kākā are canopy feeders and moa fed on the ground, so a flock
// leaving moa short is IMAGINED (fallen fruit is the defensible link); moa eating harakeke in
// winter is INFERRED at best. To be checked by the author.
// PLACEHOLDERS: the title, every line, and the names of Koukou's parents.
// ============================================================================

const JOURNEY_KAKA_DIAL = {
  flock: 8,                 // kākā at the start
  strip: { radius: 95, tolerance: 1, per: 0.16, min: 0.25 },   // each kākā past the first within 95 takes 16% of a forest meal
  growInSec: 38,            // a harakeke grove is grown this long after it goes in (a season is 45 s)
  groveReach: 130,          // "at the forest edge": this near the wintering ground
  groveQuestion: 9, groveTell: 20,   // the autumn ladder, in seconds after a quarter of the season
  winterFood: 0.45          // how much of a wild plant's winter food value is left (winterEdibilityMult)
};

const JOURNEY_KAKA = (() => {
  const K = CHAPTERS_KIT, D = JOURNEY_KAKA_DIAL;
  const TAUGHT = ['summer', 'autumn', 'winter'];
  const FAMILY = ['pukepuke', 'mama', 'papa', 'friendMama', 'friendPapa'];
  const ELDERS = { mama: "Mama", papa: "Papa", friendMama: "Koukou's mother", friendPapa: "Koukou's father" };

  const family = (x) => FAMILY.map(n => x.runner.castEnts[n]).filter(e => e && e.alive);
  const groves = (x) => { const w = x.runner.sites.winterGround; return x.runner.sim.placeables.filter(p => p.alive && p.type === 'harakeke' && Math.hypot(p.pos.x - w.x, p.pos.y - w.y) <= D.groveReach); };
  const groveIn = (x) => groves(x).length > 0;
  const groveGrown = (x) => groves(x).some(p => p.growFrac() >= 0.9);
  const fedAtGrove = (x) => groves(x).some(p => p.growFrac() >= 0.9 && family(x).filter(m => Math.hypot(m.pos.x - p.pos.x, m.pos.y - p.pos.y) < 85).length >= 2);

  return {
    id: 'journey_kaka',
    name: "The crowded forest",
    module: true,
    journey: true,
    section: 'journey',
    claim: "The forest is shared. Winter food has to be grown a season ahead, where the family will winter.",
    teaches: ['shared_forest', 'grow_ahead'],
    guide: ['kaka', 'upland_moa', 'beech_refuge', 'winter_food'],
    unlockCondition: null,
    waysOn: [{ label: "North again", tile: 't6' }],
    outcome: { birds: FAMILY, herds: { kaka: 'kaka' } },

    zoom: 2.0,
    startSeason: 'summer',
    // Higher country: tussock tops over a band of forest, shrubland below.
    terrain: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.terrain, {
      plantDensity: 0.0058,
      elevationWindow: { lo: 0.27, hi: 0.66, pLo: 0.08, pHi: 0.92 }
    }),
    biomes: LEVEL_FREEPLAY_KAHURANGI.biomes,

    species: { moa: ['upland_moa', 'stout_legged_moa'], eagle: ['haasts_eagle'], other: ['kaka'] },
    startingSpecies: 'upland_moa',
    initialSpeciesDistribution: { stout_legged_moa: 5 },   // a herd on the low ground, for the Pouākai to turn to
    initialEntityCounts: { moa: 5, eagle: 1, kaka: D.flock },

    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 110, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 40
    }),

    availablePlaceables: {
      // (It lasts through the winter it was planted for, and goes in as shoots.)
      harakeke: { cost: 25, duration: 2700 * 2.4, growInSec: D.growInSec, plantSpawnCount: 4,
                  description: "Flax for the cold months. It goes in as shoots and takes most of a season to grow." },
      speargrass: { cost: 25, moveCost: 10 },   // (never on the toolbar here: the standing patches can be moved)
      Storm: K.STORM
    },

    mechanics: K.journeyMechanics({
      // The rule this lesson teaches, and its sign (the mark over a moa that fed short).
      flockStripsFloor: { species: ['kaka'], radius: D.strip.radius, tolerance: D.strip.tolerance, per: D.strip.per, min: D.strip.min },
      forestBiomes: ['forestRefuge'],
      // The tops do not stand green through winter here: the tussock dies back and what is left is
      // worth little, which is what sends the family down to the forest (the land, not the script).
      evergreenPlants: [],
      winterInedibility: true, winterEdibilityMult: D.winterFood, winterEdibilityErosion: 0.6,
      birdMaxPopulation: { kaka: D.flock + 2 },
      eagleHuntsFlyers: true, eagleFlyerHungerGate: 55, eagleFlyerPreyPenalty: 1.4, eagleFlyerFeed: 60,
      rescueImmigration: { stout_legged_moa: { below: 3, count: 3, afterSeasons: 1 }, kaka: { below: 3, count: 3, afterSeasons: 2 } }
    }),

    cast: {
      pukepuke:   { title: "Pukepuke",        species: 'upland_moa', manual: true },
      mama:       { title: "Mama",            species: 'upland_moa', manual: true, pitch: 0.85 },
      papa:       { title: "Papa",            species: 'upland_moa', manual: true },
      friendMama: { title: "Koukou's mother", species: 'upland_moa', manual: true, pitch: 0.9 },
      friendPapa: { title: "Koukou's father", species: 'upland_moa', manual: true }
    },

    sites: {
      tops:         { find: 'high', near: { fx: 0.55, fy: 0.45 }, within: 240 },
      // The nearest forest to the tops: the edge the cold drives the family down to.
      winterGround: { find: 'biome', biome: 'forestRefuge', near: 'tops' },
      patchA:       { near: 'tops', dist: [30, 60] },
      patchB:       { near: 'tops', dist: [60, 100] },
      stormSpot:    { near: 'tops', dist: [50, 90] }
    },

    chapters: [
      { id: 'summer', title: "Summer: higher country",
        tools: ['Storm'],
        focus: ['upland_moa'],
        goals: [
          { id: 'summer_safe', name: "The family through the summer", survive: true, reward: 15 }
        ]
      },

      { id: 'autumn', title: "Autumn: the kākā at the forest edge",
        tools: ['harakeke', 'Storm'],
        start: [
          { fade: { type: 'Storm', sec: 60, refreshOnMove: true } },
          { say: [['guide', "Autumn. When the cold comes, upland moa go down to the forest edge. Look who has been feeding there all season.", { lit: ['kaka'] }]] }
        ],
        goals: [
          { id: 'grove_ahead', name: "Food growing at the forest edge before winter", done: groveIn, reward: 20 }
        ]
      },

      { id: 'winter', title: "Winter: down to the forest",
        tools: ['harakeke', 'Storm'],
        start: [
          (x) => { x.runner.vars.winterStart = family(x).length; },
          K.eagleComes('winterGround', 38)
        ],
        goals: [
          { id: 'fed', name: "The family feeding at a grown grove", done: fedAtGrove, reward: 25 },
          { id: 'winter_all', name: "Every one of the family through the winter",
            keep: (x) => family(x).length >= (x.runner.vars.winterStart || 0), reward: 25 }
        ]
      },

      // The unprompted season: the same rules, nobody telling.
      { id: 'spring', title: "Spring: the way divides", transfer: true,
        tools: ['harakeke', 'Storm'],
        start: [
          { say: [['guide', "Spring. One more season here, and this time nobody will tell you what to do."]] },
          K.eagleComes('pukepuke', 42)
        ],
        reactions: [
          { id: 'spring_press', when: { after: 24 }, do: [K.eagleComes('pukepuke', 47)] }
        ],
        goals: [
          { id: 'own', name: "Meet a problem with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 }
        ],
        next: 'onward'
      },

      { id: 'onward', title: "North again",
        tools: [],
        start: [
          { say: [['guide', "Here the families part. Koukou's parents turn south, for their own nest on the old tops. Pukepuke goes on north.", { lit: FAMILY }]] },
          K.walkOff(['friendMama', 'friendPapa'], 'south'),
          K.walkOff(['pukepuke', 'mama', 'papa'], 'north')
        ],
        until: { after: 5 },
        next: 'win'
      }
    ],

    reactions: K.quietOutside([
      // ---- The stage, once ---------------------------------------------------------------------
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          K.party([{ name: 'pukepuke', female: false }, { name: 'mama', female: true }, { name: 'papa', female: false },
                   { name: 'friendMama', female: true }, { name: 'friendPapa', female: false }], 'tops', { radius: 22 }),
          // A fruiting grove at the forest edge: what brings the flock there, by the kākā's own rule.
          { place: { type: 'forestBoost', at: 'winterGround', standing: true } },
          // Speargrass on the tops: the family's favoured plant. A standing patch can be moved.
          { place: { type: 'speargrass', at: 'patchA', standing: true } },
          { place: { type: 'speargrass', at: 'patchB', standing: true } },
          { place: { type: 'Storm', at: 'stormSpot', standing: true } },
          { eagle: { which: 'nearest', near: 'tops', watch: 'stormSpot', hunger: 30 } },
          { say: [
            ['guide', "Pukepuke has come north into higher country, with his parents and Koukou's.", { lit: FAMILY }],
            ['guide', "In the forest below, a flock of kākā is feeding. The forest is shared: under a flock, a moa finds less.", { lit: ['kaka'] }],
            ['guide', "A small mark over a moa means its meal was cut short. And the Pouākai hunts here too.", { lit: ['haasts_eagle'] }]
          ] }
        ] },

      // ---- The grove: a hint ladder in autumn (nothing, a question, the instruction) -----------------
      { id: 'grove', when: { all: [{ season: 'autumn' }, { seasonProgress: ['>=', 0.25] }, { not: groveIn }] }, chapters: ['autumn'],
        until: { any: [groveIn, { season: 'winter' }] }, solved: groveIn, lost: { not: groveIn },
        hints: [
          { after: D.groveQuestion, notify: ["The kākā will leave little under those trees by winter. What could be growing there before the family comes down?", 'error'] },
          { after: D.groveTell, banner: { words: ["Plant HARAKEKE at the forest edge now", "It takes most of a season to grow"],
                                          tool: 'harakeke', lit: ['kaka'], pause: true, maxSec: 30 } }
        ] },
      { id: 'grove_early', on: 'placement', if: (x) => x.event && x.event.type === 'harakeke' && x.game.seasonManager.currentKey === 'autumn' &&
                                                         x.game.seasonManager.progress < 0.25 && groveIn(x),
        do: [(x) => { const c = x.runner.counters; for (const k of ['cases', 'solved', 'unaided']) c[k] = (c[k] || 0) + 1;
                      x.runner.caseLog.push({ id: 'grove', t: Math.round(x.game.playTime / 6) / 10, sec: 0, rung: 0, outcome: 'solved', who: '', chapter: 'autumn', transfer: false }); }],
        notify: ["Planted ahead, with no hint. It will be grown when the family needs it.", 'success'] },
      // Winter: the short meal under the flock, said once, after it has been seen.
      { id: 'stripped', on: 'forest_stripped', if: { cast: FAMILY },
        say: [['guide', "The kākā have fed here all autumn. Under the flock, the forest floor gives a moa a short meal.", { lit: ['$moa', 'kaka'] }]] },
      { id: 'late_grove', when: { all: [{ season: 'winter' }, { seasonProgress: ['>=', 0.3] }, groveIn, { not: groveGrown }] }, chapters: ['winter'],
        notify: ["The harakeke is still only shoots. Planted in autumn, it would be grown by now.", 'error'] },
      { id: 'no_grove', when: { all: [{ season: 'winter' }, { seasonProgress: ['>=', 0.15] }, { not: groveIn }] }, chapters: ['winter'],
        until: { any: [groveIn, { after: 40 }] }, solved: groveIn, lost: { not: groveIn },
        hints: [
          { after: 6, notify: ["The family is feeding under the flock, and going short.", 'error'] },
          { after: 14, banner: { words: ["Plant HARAKEKE by the family", "It will be slow to grow in the cold: next time, plant in autumn"],
                                 tool: 'harakeke', lit: FAMILY, pause: false, maxSec: 20 } }
        ] },
      { id: 'grove_feeds', on: 'goal_met', if: (x) => x.event && x.event.goal === 'fed',
        say: [['guide', "The grove you planted in autumn is grown, and it is the family's alone: kākā do not eat harakeke leaves.", { lit: ['harakeke'] }]] },

      // ---- The Pouākai and the storm, as tile 1 taught ------------------------------------------------
      ...K.coverLadder({ species: 'upland_moa', first: [4, 7], later: [4, 7], pauseFirst: false }),
      ...K.praise({ chapters: TAUGHT }),
      ...K.stormLadder({ lit: FAMILY, unlock: false, chapters: ['autumn', 'winter'] }),
      ...K.gaveUp(),
      ...K.arrivals(),
      { id: 'bird_taken', on: 'bird_killed', once: false, cooldown: 20, notify: "The Pouākai took a {species}." },

      // ---- Pukepuke is the lead; the elders can be lost, and the record keeps it -----------------------
      ...K.leadLost({ pukepuke: "Pukepuke" }, { starved: "Winter food has to be growing before the family needs it." }),
      ...K.elderLost(ELDERS)
    ], ['gave_up', 'gave_up_again', 'arrived', 'bird_taken', 'stripped'], TAUGHT),

    lose: [],

    winTitle: "NORTH AGAIN",
    winText: "Pukepuke is through his first year in the high country.",

    goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 30 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 40),

    menu: K.journeyMenu("The crowded forest", "The journey: tile 5",
      ["Pukepuke and both sets of parents, in higher country.", "", "The forest is shared.", "Winter food has to be grown a season ahead."],
      ['tussock', 'beech', 'rimu', 'flax']),

    tutorial: { guideSprite: 'mantis_talk', tips: null }
  };
})();

LEVEL_REGISTRY.register(JOURNEY_KAKA);
