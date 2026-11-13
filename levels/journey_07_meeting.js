// ============================================================================
// THE JOURNEY, TILE 7: WHERE THE PATHS MEET
// ============================================================================
// What this lesson is. Koukou and the baby walk in from the south, Pukepuke's family from the
// east, and they meet. Nests are made, and Koukou and Pukepuke's chick hatches. NO NEW RULE:
// lancewood keeps the bush moa off the nesting ground, speargrass founds the nests, kea come
// for the eggs, the storm hides the hunted. Every rule of the journey is in play at once,
// with the fewest hints of any lesson. It is the test of both paths.
//
// It changes with the record (mauri_campaign.js). Mama and Papa both alive: they want a nest
// of their own, so two are asked for. One elder: one nest, and a wintering place beside it.
// Neither: one nest only. Pukepuke's younger siblings walk on as part of the clan. The words
// change to match. Opened alone (or with ?record=<preset>) it starts from that record.
//
// What is guaranteed. One beat: the new chick. It is invited by the simulation (a nest, a
// fed pair, summer) and only if no egg of Koukou's has been laid by late summer is one set
// down at her nest, logged as forced. The win needs the chick alive.
//
// NOT YET AS PLANNED: tile 7 was to be played on the south-east quarter of 7f's 2×2 land, so
// its nests stand when the endless mode opens. 7f is not built, so tile 7 has a window of
// its own on the same country. Moving it onto the shared land is part of stage G.
// PLACEHOLDERS: the new chick's name, every title and line.
// ============================================================================

const JOURNEY_MEETING_DIAL = {
  herd: 6, kea: 3,
  chickBy: 0.7,        // if Koukou has not laid by this far through summer, an egg is set down (forced)
  nestTell: 28         // seconds into summer before anything is said about a nest
};

const JOURNEY_MEETING = (() => {
  const K = CHAPTERS_KIT, D = JOURNEY_MEETING_DIAL;
  const FOCUS = 'upland_moa';
  const WEST = ['koukou', 'baby'], NORTH = ['pukepuke', 'mama', 'papa'], ALL = [...WEST, ...NORTH, 'chick'];
  const TAUGHT = ['summer', 'autumn', 'winter'];
  const nests = (x) => (x.runner.sim.nestingSites || []).filter(s => s.alive !== false && s.playerMade).length;
  const want = (x) => x.runner.vars.wantNests || 1;
  const clan = (x) => x.runner.sim.getSpeciesCount(FOCUS);
  const chick = (x) => { const c = x.runner.castEnts.chick; return !!(c && c.alive); };
  const koukouEgg = (x) => x.runner.sim.eggs.some(e => e.alive && !e.hatched && e.parentSpecies === FOCUS);

  return {
    id: 'journey_meeting',
    name: "Where the paths meet",
    module: true, journey: true, section: 'journey', unlockCondition: null,
    claim: "Nothing new. Each kind's own plant, a nest from two patches, moa at the nest, and the storm: all at once.",
    teaches: [],
    guide: ['upland_moa', 'little_bush_moa', 'favoured_plants', 'kea', 'haasts_eagle'],
    waysOn: [],
    outcome: { birds: ALL, herds: { clan: FOCUS, bush_moa: 'little_bush_moa' } },
    // The closing card names the family: who set out, who arrived, who was born on the way.
    closingLines: (rec) => {
      const C = CAMPAIGN, born = Object.keys(C.BIRDS).filter(n => rec.birds[n].born);
      const lost = born.filter(n => !rec.birds[n].alive);
      return [
        `Set out from the first nest: ${C._list(['mama', 'papa', 'friendMama', 'friendPapa'])}.`,
        `Born on the way: ${C._list(['pukepuke', 'koukou', 'baby', 'chick'].filter(n => rec.birds[n].born))}${rec.siblings ? `, and ${rec.siblings} of Pukepuke's siblings` : ''}.`,
        lost.length ? `Lost: ${lost.map(n => `${C.title(n)} (${C._causeWords(rec.birds[n].cause)})`).join(', ')}.` : "Nobody was lost on the way."
      ];
    },

    zoom: 2.0, startSeason: 'summer',
    terrain: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.terrain, {
      plantDensity: 0.0058,
      elevationWindow: { lo: 0.2, hi: 0.62, pLo: 0.08, pHi: 0.92 }
    }),
    biomes: LEVEL_FREEPLAY_KAHURANGI.biomes,

    species: { moa: [FOCUS, 'little_bush_moa'], eagle: ['haasts_eagle'], other: ['kea'] },
    startingSpecies: FOCUS,
    initialSpeciesDistribution: {},
    initialEntityCounts: { moa: 0, eagle: 1, kea: D.kea },
    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 130, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 50
    }),
    availablePlaceables: {
      lancewood: { cost: 25, plantSpawnCount: 6, feedingRate: 0.14, baseFeedingRate: 0.14, attractionStrength: 2.2, radius: 46 },
      speargrass: { cost: 25, duration: 2700 * 3 },
      Storm: K.STORM
    },
    paletteOrder: [['speargrass', 'lancewood'], ['Storm']],
    mechanics: K.journeyMechanics({
      forestCompetition: true, forestBiomes: ['forestRefuge'], forestCompetitionRadius: 60, forestCompetitionTolerance: 1,
      forestCompetitionPenalty: 0.22, winterCompetitionMult: 1.7, crowdingSign: true,
      nestingSites: { forestCount: 0, openCount: 0, foundPatches: 2, foundRadius: 110, radius: 40,
                      laySnapRadius: 150, drawRadius: 260, layBoost: 0.5, eggSpeedBonus: 1.5 },
      nestFoundingSign: true,
      keaRaidsEggs: 'odds', keaRaidRadius: 95, keaRaidNutrition: 40, keaRaidCooldownSec: 8,
      keaRaid: { baseSuccess: 0.9, moaPenalty: 0.2, minSuccess: 0.05, moaRadius: 95 },
      flyerEdgeMargin: 14, stormFlushMult: 1.0, birdMaxPopulation: { kea: 4 },
      unfavouredBrowsePenalty: 0.1,
      rescueImmigration: { little_bush_moa: { below: 3, count: 3, afterSeasons: 1 }, kea: { below: 2, count: 2, afterSeasons: 2 } }
    }),

    cast: {
      koukou:   { title: "Koukou",   species: FOCUS, manual: true, pitch: 0.9 },
      baby:     { title: "the baby", species: FOCUS, manual: true },
      pukepuke: { title: "Pukepuke", species: FOCUS, manual: true },
      mama:     { title: "Mama",     species: FOCUS, manual: true, pitch: 0.85 },
      papa:     { title: "Papa",     species: FOCUS, manual: true },
      chick:    { title: "the new chick", species: FOCUS, manual: true, scale: 0.6 }
    },

    sites: {
      top:       { find: 'high', near: { fx: 0.5, fy: 0.5 }, within: 180 },
      // The meeting ground: the upper edge of the forest, where upland and bush moa both feed.
      meet:      { find: 'biome', biome: 'forestRefuge', near: 'top' },
      southEdge: { find: 'edge', side: 'south', near: 'meet' },
      eastEdge:  { find: 'edge', side: 'east', near: 'meet' },
      stormSpot: { near: 'meet', dist: [50, 90] }
    },

    chapters: [
      { id: 'summer', title: "Summer: the meeting",
        tools: ['speargrass', 'lancewood', 'Storm'], focus: [FOCUS],
        nesting: { species: FOCUS, plant: 'speargrass' },
        goals: [
          { id: 'nests', name: "{$nestLine}", done: (x) => nests(x) >= want(x), reward: 25 },
          { id: 'chick', name: "Koukou and Pukepuke's chick hatches", done: chick, reward: 30 }
        ],
        // The one guaranteed beat: the new chick's egg.
        beats: [{ id: 'new_egg', when: { seasonProgress: ['>=', D.chickBy] },
          until: (x) => koukouEgg(x) || chick(x) || (x.runner.counters['laid:' + FOCUS] || 0) > 0, by: 2,
          force: [{ lay: { species: FOCUS, at: 'koukou', incubationSec: 16 } }, { notify: "Koukou has laid an egg." }] }],
        holdSeason: { until: chick, at: 0.9, maxSec: 40 }
      },
      { id: 'autumn', title: "Autumn",
        tools: ['speargrass', 'lancewood', 'Storm'],
        start: [{ fade: { type: 'Storm', sec: 60, refreshOnMove: true } }, K.eagleComes('koukou', 41)],
        goals: [{ id: 'autumn_safe', name: "The whole clan through the autumn", keep: (x) => clan(x) >= (x.runner.vars.clanAutumn || 0), reward: 20 }],
        reactions: [{ id: 'autumn_count', on: 'chapter_start', if: K.opens('autumn'), do: [(x) => { x.runner.vars.clanAutumn = clan(x); }] }]
      },
      { id: 'winter', title: "Winter",
        tools: ['lancewood', 'Storm'],
        start: [
          { spawn: { type: 'little_bush_moa', at: 'meet', count: 3, radius: 45, sexes: 'pair', hunger: 40 } },
          (x) => { x.runner.vars.clanWinter = clan(x); }
        ],
        goals: [{ id: 'winter_all', name: "Every upland moa through the winter", keep: (x) => clan(x) >= (x.runner.vars.clanWinter || 0), reward: 25 }]
      },
      { id: 'spring', title: "Spring", transfer: true,
        tools: ['speargrass', 'lancewood', 'Storm'],
        start: [K.eagleComes('chick', 42)],
        reactions: [{ id: 'spring_press', when: { after: 24 }, do: [K.eagleComes('koukou', 47)] }],
        goals: [{ id: 'own', name: "Meet a problem with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 }],
        next: 'finale'
      },
      { id: 'finale', title: "A year where the paths met", tools: [],
        start: [
          { moment: { on: 'chick', text: "One family again", sec: 3 } },
          { say: [['guide', "A year where the two paths met. {$meetWords}", { lit: ALL }]] }
        ],
        until: { after: 4 }, next: 'win' }
    ],

    reactions: K.quietOutside([
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          { spawn: { type: 'little_bush_moa', at: 'meet', count: D.herd, radius: 40, sexes: 'pair', hunger: 34 } },
          K.party([{ name: 'koukou', female: true }, { name: 'baby' }], ['southEdge', 'meet'], { walkTo: 'meet' }),
          K.party([{ name: 'pukepuke', female: false }, { name: 'mama', female: true }, { name: 'papa', female: false }], ['eastEdge', 'meet'], { walkTo: 'meet' }),
          // Pukepuke's younger siblings, as the record has them.
          (x) => { const n = (x.runner.record && x.runner.record.siblings) || 0;
                   if (n) x.runner.spawn({ type: FOCUS, at: 'meet', count: n, age: 'juvenile', sexes: 'pair', hunger: 30 }); },
          { place: { type: 'Storm', at: 'stormSpot', standing: true } },
          { eagle: { hunger: 8 } },
          // What the record asks of this year, and the words that go with it.
          (x) => {
            const f = x.runner.flags, v = x.runner.vars;
            v.wantNests = f.elders_both ? 2 : 1;
            v.nestLine = v.wantNests === 2 ? "Two nests: one for Koukou and Pukepuke, one for Mama and Papa" : "A nest for Koukou and Pukepuke";
            v.eldersWords = f.elders_both ? "Mama and Papa are with him, and will want a nest of their own."
              : (f.elders_one ? `Only ${v.elders} is with him now. One nest, and a place beside it for the winter.`
                              : "He has come alone. Mama and Papa did not live to see this place.");
            v.meetWords = f.elders_both ? "Two nests stand here, and three generations feed beside them."
              : (f.elders_one ? `One nest stands here, and ${v.elders} winters beside it.` : "One nest stands here. The young have made it on their own.");
          },
          { say: [
            ['guide', "Koukou and her grown chick have walked up from the south. Pukepuke has come in from the east. {$eldersWords}", { lit: ALL }],
            ['guide', "Bush moa feed on this ground, kea are watching, and the Pouākai is never far. You know what each of them wants.", { lit: ['little_bush_moa', 'kea', 'haasts_eagle'] }]
          ] }
        ] },
      // The new chick: Koukou's (or the forced egg's) first hatch here.
      { id: 'new_chick', on: 'egg_hatched', if: (x) => !!x.event && x.event.moa && x.event.moa.speciesKey === FOCUS && !x.runner.castEnts.chick,
        do: [{ adopt: { chick: '$moa' } }, (x) => { const k = x.runner.castEnts.koukou, c = x.runner.castEnts.chick; if (k && c && !c.mother) c.mother = k; }],
        moment: { on: '$moa', text: "Koukou and Pukepuke's chick" } },
      // The fewest hints of any lesson: one line about nests, late, and the kit's slow ladders.
      { id: 'nest_late', when: { all: [{ season: 'summer' }, { after: D.nestTell }, (x) => nests(x) < 1] }, chapters: ['summer'],
        until: { any: [(x) => nests(x) >= 1, { after: 40 }] }, solved: (x) => nests(x) >= 1,
        hints: [
          { after: 0, notify: ["Nobody has a nest here yet. What did the crested moa say about where upland moa settle?", 'error'] },
          { after: 14, banner: { words: ["Two SPEARGRASS patches close together found a nest", "Plant them by Koukou and Pukepuke"], tool: 'speargrass', lit: ['koukou', 'pukepuke'], pause: false, maxSec: 20 } }
        ] },
      { id: 'crowd_note', on: 'moa_crowded', if: { species: FOCUS }, once: false, cooldown: 30,
        until: { any: [{ placed: 'lancewood' }, { after: 45 }] }, solved: { placed: 'lancewood' },
        hints: [{ after: 20, notify: ["The bush moa are crowding the clan off its food.", 'error'] }] },
      ...K.coverLadder({ species: FOCUS, first: [5, 7.5], later: [5, 7.5], pauseFirst: false }),
      ...K.praise({ chapters: TAUGHT }),
      ...K.gaveUp(),
      ...K.arrivals(),
      { id: 'raid_failed', on: 'nest_raid', if: { success: false }, once: false, cooldown: 20, notify: "The moa drove a kea off a nest." },
      { id: 'raid_won', on: 'nest_raid', if: { success: true }, once: false, cooldown: 15, notify: ["A kea took an egg.", 'error'] },
      ...K.leadLost({ koukou: "Koukou", baby: "the baby", pukepuke: "Pukepuke", chick: "the new chick" }),
      ...K.elderLost({ mama: "Mama", papa: "Papa" })
    ], ['gave_up', 'gave_up_again', 'arrived', 'raid_failed', 'raid_won'], TAUGHT),

    lose: [],
    winTitle: "ONE FAMILY",
    winText: "The two paths have met, and a chick of the third generation is a year old.",
    goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 30 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 40),
    menu: K.journeyMenu("Where the paths meet", "The journey: tile 7",
      ["Everyone, on one piece of country.", "", "Nothing new: every rule of the journey at once,", "and the fewest hints."],
      ['tussock', 'speargrass', 'lancewood', 'beech']),
    tutorial: { guideSprite: 'mantis_talk', tips: null }
  };
})();

LEVEL_REGISTRY.register(JOURNEY_MEETING);
