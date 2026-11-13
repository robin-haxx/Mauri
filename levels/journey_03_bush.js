// ============================================================================
// THE JOURNEY, TILE 3: INTO THE BUSH (the west path's first lesson)
// ============================================================================
// What this lesson is. After the five years, Koukou and her chick walk west and down into
// forest they do not know. A herd of little bush moa feeds on the same fern, and the chick
// goes short beside them. The one rule: moa crowded on the same forest food each get less,
// and each kind's own plant draws it away. The lever is lancewood (horoeka), which only the
// bush moa favour: a stand planted away from the chick draws the herd off its fern.
//
// What the player sees. Summer: the two upland moa feeding among the bush moa, and a small
// mark over any moa whose meal was cut short by the crowd. A few wild lancewood stand nearby
// and the bush moa can be seen choosing them: that is the clue. Autumn: the Pouākai comes,
// and a storm still hides a moa, as tile 1 taught. Winter: more bush moa come down into the
// refuge and the crowding is at its worst, so one stand is not enough. Spring: a booming in
// the night from the north. Nothing is said in spring: it is the season that tests the year.
// Then Koukou and the chick walk off the north edge.
//
// What the simulation does on its own. Everything the animals do. The crowding rule is the
// open simulation's (mechanics.forestCompetition, in the first Endless level since it was
// written, with nothing to show it); this lesson switches on its sign. Bush moa prefer their
// own plant by the same scoring every moa uses (Moa.findPlant). Nothing here moves an animal.
//
// What is guaranteed. Only the stage: who walks on, the herd beside them, the wild lancewood,
// and the winter arrivals. The first crowded meal is the simulation's own: the party is set
// down where the herd feeds, which invites it, and nothing forces it.
//
// What is taught by clue first. The opening tells the first problem outright (the mark and
// what it means). After that every problem climbs a ladder: nothing, a question, the
// instruction. The record keeps the rung (ChapterRunner.caseLog), and CAMPAIGN.finish hands
// it on with who is alive.
//
// Known, inferred, imagined (CAMPAIGN_PLAN.md section 6; to be checked by the author):
// bush moa in closed forest, known; different moa on different plants, known from dung;
// bush moa as the ones that ate young lancewood, IMAGINED (the spiky young form as a defence
// against moa is a debated idea).
// PLACEHOLDERS: the level's title, every line, and the baby's name.
// ============================================================================

const JOURNEY_BUSH_DIAL = {
  herd: 6,                 // bush moa beside the party at the start
  forestDensity: 0.003,   // how thickly the wild forest is planted (the first Endless level: 0.004)
  gully: { ferns: 16, radius: 42 },   // the fern gully at the camp: the rich patch both kinds come to
  winterArrivals: 4,       // ...and those that come down into the refuge in winter
  hunger: 1.0, chickHunger: 1.4,   // how fast a moa gets hungry here, and the baby faster (the other lessons: 0.6 and 1.0)
  crowd: { radius: 60, tolerance: 1, penalty: 0.25, winterMult: 1.7 },   // more than one other moa within 50 cuts a meal
  crowdQuestion: 6, crowdTell: 16,     // the first crowded meal's ladder, in seconds
  laterQuestion: 14, laterTell: 28,    // ...and later ones
  calmSec: 12              // a goal: this long with no crowded meal for Koukou or the baby
};

const JOURNEY_BUSH = (() => {
  const K = CHAPTERS_KIT, D = JOURNEY_BUSH_DIAL;
  const TAUGHT = ['summer', 'autumn', 'winter'];
  const LEADS = ['koukou', 'baby'];

  // The last second at which Koukou or the baby had a crowded meal (set by a reaction).
  const noteCrowd = (x) => { x.runner.vars._crowdAt = x.game.playTime; };
  const calmFor = (sec) => (x) => {
    const r = x.runner, since = r.vars._crowdAt != null ? r.vars._crowdAt : r.scopeCh.t0;
    return x.game.playTime - Math.max(since, r.scopeCh.t0) >= sec * 60;
  };
  const stands = (x) => x.runner.sim.placeables.filter(p => p.alive && p.type === 'lancewood' && !p.matured);
  const crowdUntil = { any: [{ placed: 'lancewood' }, { after: 50 }] };
  const crowdLost = { all: [{ after: 49 }, { not: { placed: 'lancewood' } }] };   // left unanswered
  // The lever seen to work: at least half the bush moa are at a lancewood stand.
  const drawnOff = (x) => {
    const herd = x.runner.allOf('little_bush_moa'), st = stands(x);
    if (!herd.length || !st.length) return false;
    return herd.filter(m => st.some(p => Math.hypot(m.pos.x - p.pos.x, m.pos.y - p.pos.y) < 85)).length >= Math.ceil(herd.length / 2);
  };

  return {
    id: 'journey_bush',
    name: "Into the bush",
    module: true,
    journey: true,
    section: 'journey',
    claim: "Moa crowded on the same forest food each get less. Each kind's own plant draws it away.",
    teaches: ['crowding', 'favoured_plant'],
    guide: ['little_bush_moa', 'upland_moa', 'favoured_plants', 'coexistence', 'beech_refuge'],
    unlockCondition: null,
    waysOn: [{ label: "North, to the booming", tile: 't4' }],
    outcome: { birds: LEADS, herds: { bush_moa: 'little_bush_moa' } },

    zoom: 2.0,
    startSeason: 'summer',
    // The first Endless level's country, fitted low: flats, shrubland and a wide forest that is
    // the highest ground there is. Upland moa keep to the highest band a land has, so here the
    // forest is where Koukou and the baby must feed: the land sets the meeting, not the script.
    terrain: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.terrain, {
      // (A thin forest: the fern gully the stage sows at the camp is the rich food on it, so
      // both kinds of moa come to the same patch for the same reason.)
      plantDensity: JOURNEY_BUSH_DIAL.forestDensity,
      elevationWindow: { lo: 0.2, hi: 0.445, pLo: 0.08, pHi: 0.985 }
    }),
    biomes: LEVEL_FREEPLAY_KAHURANGI.biomes,

    species: { moa: ['upland_moa', 'little_bush_moa'], eagle: ['haasts_eagle'], other: [] },
    startingSpecies: 'upland_moa',
    // (The party and the herd are set down by the stage; nobody is seeded.)
    initialSpeciesDistribution: {},
    initialEntityCounts: { moa: 0, eagle: 1 },

    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 100, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 40
    }),

    availablePlaceables: {
      // (A fuller stand than the first Endless level's: here it has to hold a herd's interest.)
      lancewood: { cost: 25, plantSpawnCount: 6, feedingRate: 0.14, baseFeedingRate: 0.14, attractionStrength: 2.2, radius: 46, description: "Horoeka. Only the bush moa favour it: a stand draws them to it." },
      Storm: K.STORM
    },

    mechanics: K.journeyMechanics({
      // The rule this lesson teaches, and its sign.
      forestCompetition: true, forestBiomes: ['forestRefuge'],
      forestCompetitionRadius: D.crowd.radius, forestCompetitionTolerance: D.crowd.tolerance,
      forestCompetitionPenalty: D.crowd.penalty, winterCompetitionMult: D.crowd.winterMult,
      crowdingSign: true,
      hungerRateMult: D.hunger, juvenileHungerMult: D.chickHunger,
      unfavouredBrowsePenalty: 0.1,      // a lancewood stand feeds an upland moa next to nothing
      rescueImmigration: { little_bush_moa: { below: 3, count: 3, afterSeasons: 1 } }
    }),

    cast: {
      koukou: { title: "Koukou",   species: 'upland_moa', manual: true, pitch: 0.9 },
      baby:   { title: "the baby", species: 'upland_moa', manual: true, scale: 0.6 }
    },

    sites: {
      // The high forest near the middle: the ground an upland moa would choose on this land,
      // and where the herd is feeding when the two arrive.
      top:       { find: 'high', near: { fx: 0.5, fy: 0.5 }, within: 200 },
      camp:      { find: 'biome', biome: 'forestRefuge', near: 'top' },
      wild:      { near: 'camp', dist: [95, 140] },
      stormSpot: { near: 'camp', dist: [50, 90] }
    },

    chapters: [
      { id: 'summer', title: "Summer: forest they do not know",
        tools: ['lancewood'],
        focus: ['upland_moa'],
        goals: [
          { id: 'uncrowded', name: "Half the bush moa drawn off to their own plant, and the baby's meals uncrowded",
            done: { all: [drawnOff, calmFor(D.calmSec)] }, reward: 20 },
          { id: 'summer_fed', name: "The baby fed through the summer", survive: true, reward: 10 }
        ],
        holdSeason: { until: { goal: 'uncrowded' }, at: 0.9, maxSec: 30 }
      },

      { id: 'autumn', title: "Autumn: the Pouākai finds the forest",
        tools: ['lancewood', 'Storm'],
        start: [
          { place: { type: 'Storm', at: 'stormSpot', standing: true } },
          { fade: { type: 'Storm', sec: 60, refreshOnMove: true } },
          { say: [['guide', "Autumn. A Pouākai has found this forest too. You know what hides a moa.", { lit: ['haasts_eagle', 'Storm'] }]] },
          K.eagleComes('koukou')
        ],
        goals: [
          { id: 'autumn_safe', name: "Koukou and the baby through the autumn", survive: true, reward: 15 }
        ]
      },

      { id: 'winter', title: "Winter: the refuge fills",
        tools: ['lancewood', 'Storm'],
        start: [
          // More bush moa come down into the shrinking forest, as they do when the cold comes.
          { spawn: { type: 'little_bush_moa', at: 'camp', count: D.winterArrivals, radius: 45, sexes: 'pair', hunger: 40 } },
          { say: [['guide', "Winter. More bush moa have come down into the refuge, and everyone is feeding in the same small forest.", { lit: ['little_bush_moa'] }]] }
        ],
        goals: [
          { id: 'winter_uncrowded', name: "Half the winter herd drawn off, and the baby's meals uncrowded",
            done: { all: [drawnOff, calmFor(D.calmSec)] }, reward: 25 },
          { id: 'winter_through', name: "Through the winter", survive: true, reward: 15 }
        ]
      },

      // The unprompted season: the same rules, nobody telling. Its cases are recorded apart.
      { id: 'spring', title: "Spring: a booming in the night", transfer: true,
        tools: ['lancewood', 'Storm'],
        start: [
          { say: [['guide', "Spring. At night, from the north, a deep booming comes through the trees. Koukou keeps turning toward it."],
                  ['guide', "One more season in this forest. This time nobody will tell you what to do."]] },
          K.eagleComes('koukou', 42)
        ],
        reactions: [
          { id: 'spring_press', when: { after: 24 }, do: [K.eagleComes('koukou', 47)] }
        ],
        goals: [
          { id: 'own', name: "Meet a problem with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 }
        ],
        next: 'onward'
      },

      { id: 'onward', title: "North, toward the booming",
        tools: [],
        start: [
          { say: [['guide', "Koukou and the baby set off north, toward the sound.", { lit: LEADS }]] },
          K.walkOff(LEADS, 'north')
        ],
        until: { after: 5 },
        next: 'win'
      }
    ],

    reactions: K.quietOutside([
      // ---- The stage, once -------------------------------------------------------------------
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          { sow: { plant: 'fern', at: 'camp', count: D.gully.ferns, radius: D.gully.radius } },
          { spawn: { type: 'little_bush_moa', at: 'camp', count: D.herd, radius: 34, sexes: 'pair', hunger: 34 } },
          K.party([{ name: 'koukou', female: true }, { name: 'baby', years: 1, mother: 'koukou' }], 'camp', { hunger: 38 }),
          // A few wild lancewood, away from the fern: the bush moa's own plant, and the clue.
          { sow: { plant: 'lancewood', at: 'wild', count: 4, radius: 26 } },
          (x) => { for (const p of x.runner.sim.plants) if (p.type === 'lancewood') p.favouredSpecies = 'little_bush_moa'; },
          { eagle: { hunger: 4 } },
          { say: [
            ['guide', "Koukou and her chick have come down into forest they do not know. Little bush moa feed here, on the same fern.", { lit: [...LEADS, 'little_bush_moa'] }],
            ['guide', "Watch the baby feed. A small mark over a moa means its meal was cut short: too many beaks on one patch.", { lit: ['baby'] }],
            ['guide', "Look at what the bush moa choose when they have a choice.", { lit: ['little_bush_moa'] }]
          ] }
        ] },

      // ---- The crowded meal: a hint ladder (nothing, a question, the instruction) --------------
      { id: 'crowd_note', on: 'moa_crowded', if: { cast: LEADS }, once: false, do: [noteCrowd] },
      { id: 'crowd', on: 'moa_crowded', if: { cast: LEADS },
        until: crowdUntil, solved: { placed: 'lancewood' }, lost: crowdLost,
        hints: [
          { after: D.crowdQuestion, notify: ["The baby's meal was cut short. Too many moa on one patch of fern. What would the bush moa sooner eat?", 'error'] },
          { after: D.crowdTell, banner: { words: ["Plant a LANCEWOOD STAND away from the baby", "The bush moa will go to their own plant"],
                                          tool: 'lancewood', lit: ['baby', 'little_bush_moa'], pause: true, maxSec: 30 } }
        ] },
      { id: 'crowd_again', on: 'moa_crowded', once: false, cooldown: 35,
        if: (x) => !!x.event && LEADS.some(n => x.runner.castEnts[n] === x.event.moa) && x.runner.reactions.some(r => r.id === 'crowd' && r.fired) &&
                   x.game.playTime - x.runner.reactions.find(r => r.id === 'crowd').lastAt > 50 * 60,
        until: crowdUntil, solved: { placed: 'lancewood' }, lost: crowdLost,
        hints: [
          { after: D.laterQuestion, notify: ["The baby is being crowded off its food again.", 'error'] },
          { after: D.laterTell, banner: { words: ["Another LANCEWOOD STAND would draw the bush moa off", "Plant it away from the baby"],
                                           tool: 'lancewood', lit: ['baby'], pause: false, maxSec: 20 } }
        ] },
      { id: 'saw_crowd', on: 'case_closed', once: false, cooldown: 20,
        if: (x) => x.event && /^crowd/.test(x.event.case || '') && x.event.outcome === 'solved' && x.event.rung === 0,
        notify: ["Planted with no hint. Each kind of moa has its own plant, and it draws them away.", 'success'] },
      // The lesson's other half, said once the player has acted: why it worked.
      { id: 'drawn_off', when: (x) => stands(x).some(p => x.runner.allOf('little_bush_moa').filter(m => Math.hypot(m.pos.x - p.pos.x, m.pos.y - p.pos.y) < 70).length >= 2),
        say: [['guide', "The bush moa have gone to the lancewood. It is their plant: Koukou and the baby get almost nothing from it, and leave it alone.", { lit: ['little_bush_moa', 'lancewood'] }]] },

      // ---- The Pouākai and the storm, as tile 1 taught (the kit's ladders) -----------------------
      ...K.coverLadder({ species: 'upland_moa', first: [4, 7], later: [4, 7], pauseFirst: false }),
      ...K.praise({ chapters: TAUGHT }),
      ...K.stormLadder({ lit: LEADS, unlock: false, chapters: ['autumn', 'winter'] }),
      ...K.gaveUp(),
      ...K.arrivals(),
      { id: 'herd_taken', on: 'moa_killed', if: { species: 'little_bush_moa' }, once: false, cooldown: 30,
        notify: "The Pouākai took a bush moa. It has to eat too." },

      // ---- The leads: either lost ends the lesson -------------------------------------------------
      ...K.leadLost({ koukou: "Koukou", baby: "the baby" },
        { starved: "A crowded patch feeds nobody well: draw the bush moa off with lancewood, or tap plants near the family." })
    ], ['gave_up', 'gave_up_again', 'arrived', 'herd_taken', 'drawn_off'], TAUGHT),

    lose: [],   // (the leads' loss is the only way to lose: see leadLost)

    winTitle: "NORTH",
    winText: "Koukou and the baby are through their first year in the bush.",

    goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 30 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 40),

    menu: K.journeyMenu("Into the bush", "The journey: tile 3",
      ["Koukou and her chick, in forest they do not know.", "", "Two kinds of moa on one food both go short.", "Each kind's own plant draws it away."],
      ['fern', 'beech', 'lancewood', 'rimu']),

    tutorial: { guideSprite: 'mantis_talk', tips: null }
  };
})();

LEVEL_REGISTRY.register(JOURNEY_BUSH);
