// ============================================================================
// THE JOURNEY, TILE 4: THE NIGHT PARROTS, and 4f: THE MAST YEARS (the west path)
// ============================================================================
// TILE 4, the lesson. Koukou and the baby follow the booming north and meet the kākāpō. An
// old bird sets a riddle. Its answer: the rimu will fruit heavily next summer, and a flock
// that is ready will breed. The one rule: kākāpō breed only in a mast year, and the mast can
// be seen coming a year ahead. The lever is the Forest Seed: a grove sown by the flock this
// year bears in the mast next year.
//
// What the player sees. Two years. Year one: the riddle, and green fruit on every grown rimu
// (the riddle's answer drawn on the land, so a player who looks can solve it with no hint).
// The riddle is a hint ladder: the riddle itself, a plainer line a season later, the
// instruction by winter. Year two is the mast: the males boom, the hens come to the courts,
// and chicks hatch. Its spring is the season in which nothing is said.
//
// What the simulation does on its own. The kākāpō's courts, pairing, laying and hatching (they
// lay only when the simulation's mast flag is up), the forest's surge in a mast, the eagle.
// The lesson sets WHICH year is the mast (mechanics.mastYears) and switches on the green fruit.
//
// 4f, the free play. Eight years on the same kind of land with a mast in years 4 and 8, the
// cold deepening and the forest band shrinking from the top. Won at the end of year 8 if the
// forest is more bountiful than at the start and the kākāpō are still there. Forest bounty
// (the fruiting trees on the land) is shown all game as a goal line with its starting value.
// Koukou and the baby cannot breed here: there are no other upland moa. That is the story's
// reason to go north again.
//
// Known, inferred, imagined: kākāpō breeding in rimu mast years is known in living birds;
// that the crop can be seen a year ahead is likely (rimu fruit ripen slowly) and its timing
// is TO BE CHECKED before the riddle is written.
// PLACEHOLDERS: the riddle (all three rungs), the old bird's name, every title and line, the
// green fruit (plain dots), and the kākāpō's portrait in a speech panel (the guide's).
// ============================================================================

const JOURNEY_KAKAPO_DIAL = {
  flock: 6,                    // kākāpō at the start
  plainerAt: 60, tellAt: 125,  // the riddle's second and third rungs, seconds after it is set
  fYears: 8, fMastEvery: 4,    // the free play: its length, and how often the rimu masts
  fHerd: 8,                    // bush moa at the start of the free play: the herd the Pouākai can turn to
  fEagleHunger: 0.0065         // a slow appetite over eight years, as The Tops (the lessons: 0.011)
  //                    // bush moa at the start of the free play (the record's number, if 4f's lesson was played)
};

const JOURNEY_WEST = (() => {
  const K = CHAPTERS_KIT, D = JOURNEY_KAKAPO_DIAL;
  const LEADS = ['koukou', 'baby'];
  const kakapo = (x) => x.runner.sim.getSpeciesCount('kakapo');
  const bounty = (x) => x.runner.sim.forestBounty();
  const seeds = (x) => x.runner.sim.placeables.filter(p => p.alive && p.type === 'forestBoost');
  // A grove "by the flock": a Forest Seed within reach of where the kākāpō are.
  const sownByFlock = (x) => { const birds = x.runner.allOf('kakapo'); return seeds(x).some(p => birds.some(b => Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y) < 170)); };

  const base = (over) => Object.assign({
    module: true, journey: true, section: 'journey', unlockCondition: null,
    zoom: 2.0, startSeason: 'summer',
    terrain: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.terrain, {
      plantDensity: 0.0056,
      elevationWindow: { lo: 0.2, hi: 0.5, pLo: 0.08, pHi: 0.95 }
    }),
    biomes: LEVEL_FREEPLAY_KAHURANGI.biomes,
    startingSpecies: 'upland_moa',
    cast: {
      koukou: { title: "Koukou",   species: 'upland_moa', manual: true, pitch: 0.9 },
      baby:   { title: "the baby", species: 'upland_moa', manual: true, scale: 0.8 }
    },
    sites: {
      top:    { find: 'high', near: { fx: 0.5, fy: 0.5 }, within: 200 },
      camp:   { find: 'biome', biome: 'forestRefuge', near: 'top' },
      courts: { find: 'biome', biome: 'forestRefuge', near: { fx: 0.4, fy: 0.55 } },
      stormSpot: { near: 'camp', dist: [50, 90] }
    },
    lose: [],
    goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 30 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 40),
    tutorial: { guideSprite: 'mantis_talk', tips: null }
  }, over);

  // What both levels say about the eagle, the storm and the leads.
  const common = (taught) => [
    ...K.coverLadder({ species: 'upland_moa', first: [4, 7], later: [4, 7], pauseFirst: false }),
    ...K.praise({ chapters: taught }),
    ...K.stormLadder({ lit: LEADS, unlock: false, chapters: taught }),
    ...K.gaveUp(),
    ...K.arrivals(),
    { id: 'chick', on: 'bird_hatched', if: { species: 'kakapo' }, moment: { on: '$bird', text: "A kākāpō chick" } },
    { id: 'chick_again', on: 'bird_hatched', if: { species: 'kakapo' }, once: false, cooldown: 15, notify: ["A kākāpō chick has hatched.", 'success'] },
    ...K.leadLost({ koukou: "Koukou", baby: "the baby" })
  ];

  // ==========================================================================================
  // TILE 4: the lesson
  // ==========================================================================================
  const TAUGHT = ['summer', 'autumn', 'winter', 'spring'];
  const lesson = base({
    id: 'journey_kakapo',
    name: "The night parrots",
    claim: "Kākāpō breed only in a mast year, and the mast can be seen coming a year ahead.",
    teaches: ['mast_year', 'mast_ahead', 'forest_tools'],
    guide: ['kakapo', 'rimu', 'beech_refuge'],
    waysOn: [{ label: "Stay for the mast years", tile: 't4f' }],
    outcome: { birds: LEADS, herds: { kakapo: 'kakapo' },
               also: (rec, r) => { const c = r.caseLog.find(k => k.id === 'riddle'); rec.riddleRung = c ? (c.outcome === 'solved' ? c.rung : 'unanswered') : null; } },

    species: { moa: ['upland_moa', 'little_bush_moa'], eagle: ['haasts_eagle'], other: ['kakapo'] },
    initialSpeciesDistribution: { little_bush_moa: 4 },
    initialEntityCounts: { moa: 4, eagle: 1, kakapo: D.flock },
    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 110, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 40
    }),
    availablePlaceables: {
      forestBoost: { cost: 35, description: "Sows a grove. Sown this year, it bears next year." },
      Storm: K.STORM
    },
    mechanics: K.journeyMechanics({
      mastYears: [2],             // the lesson sets which year is the mast...
      greenFruitSign: true,       // ...and the rimu carry green fruit the year before it
      forestBiomes: ['forestRefuge'], mastFlockMult: 1.6,
      birdMaxPopulation: { kakapo: 8 },
      rescueImmigration: { little_bush_moa: { below: 2, count: 2, afterSeasons: 2 } }
    }),

    chapters: [
      { id: 'summer', title: "Summer", tools: ['forestBoost', 'Storm'], focus: ['upland_moa'],
        goals: [{ id: 'sown', name: "Year {year}: be ready for what is coming", done: sownByFlock, reward: 20, stretch: true }] },
      { id: 'autumn', title: "Autumn", tools: ['forestBoost', 'Storm'],
        start: [{ fade: { type: 'Storm', sec: 60, refreshOnMove: true } }, K.eagleComes('koukou', 40)],
        goals: [{ id: 'autumn_safe', name: "Year {year}: Koukou and the baby through the autumn", survive: true, reward: 10 }] },
      { id: 'winter', title: "Winter", tools: ['forestBoost', 'Storm'],
        start: [(x) => { x.runner.vars.flockStart = kakapo(x); }],
        goals: [{ id: 'flock_through', name: "Year {year}: the flock through the winter", keep: (x) => kakapo(x) >= (x.runner.vars.flockStart || 0), reward: 20 }],
        next: [[{ year: ['>=', 2] }, 'last'], [true, 'spring']] },
      { id: 'spring', title: "Spring", tools: ['forestBoost', 'Storm'],
        goals: [{ id: 'year_one', name: "The first year among the night parrots", survive: true, reward: 15 }],
        next: 'summer' },
      // The unprompted season: the second spring.
      { id: 'last', title: "Spring: after the mast", transfer: true, tools: ['forestBoost', 'Storm'],
        start: [{ say: [['guide', "The last season here. Nobody will tell you what to do."]] }, K.eagleComes('koukou', 42)],
        reactions: [{ id: 'last_press', when: { after: 24 }, do: [K.eagleComes('koukou', 47)] }],
        goals: [{ id: 'own', name: "Meet a problem with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 }],
        next: 'onward' },
      { id: 'onward', title: "The mast is over", tools: [],
        start: [(x) => { x.runner.vars.chicks = x.runner.counters['hatched:kakapo'] || 0; },
                { say: [['guide', "Kākāpō chicks hatched in the mast: {$chicks}. The flock will not breed again until the rimu fruits like that again.", { lit: ['kakapo'] }]] }],
        until: { after: 4 }, next: 'win' }
    ],

    reactions: K.quietOutside([
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          K.party([{ name: 'koukou', female: true }, { name: 'baby', years: 2, mother: 'koukou' }], 'camp', { hunger: 30 }),
          { place: { type: 'Storm', at: 'stormSpot', standing: true } },
          { eagle: { hunger: 5 } },
          { say: [['guide', "Koukou and the baby have followed the booming north. The birds that make it walk the forest floor at night: kākāpō.", { lit: [...LEADS, 'kakapo'] }]] }
        ] },
      // The riddle: a hint ladder a year long. (PLACEHOLDER WORDS: the riddle is the author's.)
      ...K.riddleLadder({
        id: 'riddle', on: 'chapter_start', test: K.opens('summer', 'riddled'), speaker: 'kakapo',
        riddle: ["[PLACEHOLDER RIDDLE] We count no summers, only one. It hangs green over your head this year, and it is red the next. Who waits for red must dig in green."],
        plainer: "[PLACEHOLDER] Look up at the rimu. The fruit is green now and will ripen next summer. We breed only when it does. What would you do this year, if you knew?",
        tell: ["Sow a FOREST SEED by the kākāpō now", "The grove will bear in next year's mast"],
        at: [D.plainerAt, D.tellAt], tool: 'forestBoost', lit: ['kakapo'],
        until: { any: [sownByFlock, { year: ['>=', 2] }] }, solved: sownByFlock, staleSec: 200 }),
      { id: 'riddled', on: 'chapter_start', if: K.opens('summer', 'riddled'), do: [{ flag: 'riddled' }] },
      { id: 'answered', on: 'case_closed', if: (x) => x.event && x.event.case === 'riddle' && x.event.outcome === 'solved',
        say: [['kakapo', "[PLACEHOLDER] You dug in green. We will see what is red.", { lit: ['kakapo'] }]] },
      // The mast, when it comes: said after it can be seen.
      { id: 'mast', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && x.runner.yearNow() === 2,
        do: [{ notify: ["The rimu are red with fruit. This is the mast year.", 'success'] }],
        say: [['guide', "The mast. The males boom from their courts, and the hens will come to them. Kākāpō lay only in a year like this.", { lit: ['kakapo'] }]] },
      ...common(TAUGHT)
    ], ['gave_up', 'gave_up_again', 'arrived', 'chick'], TAUGHT),

    winTitle: "THE MAST",
    winText: "Koukou and the baby have seen the night parrots through a mast year.",
    menu: K.journeyMenu("The night parrots", "The journey: tile 4",
      ["Koukou and the baby among the kākāpō.", "", "They breed only in a mast year.", "The mast can be seen coming a year ahead."],
      ['rimu', 'beech', 'fern'])
  });

  // ==========================================================================================
  // 4f: the mast years (free play)
  // ==========================================================================================
  const mastNow = (x) => !!x.game._isMastYear();
  const toolsFor = (x) => { const t = ['lancewood', 'forestBoost']; if (mastNow(x)) t.push('rimuScramble'); t.push('Storm'); x.runner.setTools(t); };
  const bountyLine = (x) => { const v = x.runner.vars; v.bounty = bounty(x); v.bountyLine = `Forest bounty: ${v.bounty} fruiting trees (it began at ${v.bountyStart != null ? v.bountyStart : v.bounty})`; return v.bounty; };
  const bountyGoal = (season) => ({ id: `bounty_${season}`, name: "{$bountyLine}", stretch: true, reward: 10,
    done: (x) => { const b = bountyLine(x); return b > (x.runner.vars.bountyBest || x.runner.vars.bountyStart || Infinity) + 4; } });
  const season = (key, extra = {}) => Object.assign({
    start: [toolsFor, bountyLine, ...(extra.start || [])],
    goals: [bountyGoal(key), ...(extra.goals || [])]
  }, extra.more || {});

  const freeplay = base({
    id: 'journey_mast_years',
    name: "The mast years",
    freePlay: true, userCamera: true,
    claim: "A forest kept bountiful through the cold is what a mast-breeder lives on.",
    teaches: ['forest_bounty', 'climate'],
    guide: ['kakapo', 'rimu', 'little_bush_moa', 'glacial_cycles'],
    waysOn: [],
    outcome: { birds: LEADS, herds: { kakapo: 'kakapo', bush_moa: 'little_bush_moa' },
               also: (rec, r) => { rec.bounty = { start: r.vars.bountyStart || 0, end: r.sim.forestBounty() }; } },

    species: { moa: ['upland_moa', 'little_bush_moa'], eagle: ['haasts_eagle'], other: ['kakapo'] },
    initialSpeciesDistribution: { little_bush_moa: D.fHerd },
    initialEntityCounts: { moa: D.fHerd, eagle: 1, kakapo: D.flock },
    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 120, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 50
    }),
    availablePlaceables: {
      lancewood: { cost: 25, plantSpawnCount: 6, feedingRate: 0.14, baseFeedingRate: 0.14, attractionStrength: 2.2, radius: 46 },
      forestBoost: { cost: 35 },
      rimuScramble: { cost: 40 },
      Storm: K.STORM
    },
    paletteOrder: [['lancewood'], ['forestBoost', 'rimuScramble'], ['Storm']],
    mechanics: K.journeyMechanics({
      mastYears: { every: D.fMastEvery }, greenFruitSign: true, mastFlockMult: 1.6,
      forestCompetition: true, forestBiomes: ['forestRefuge'], forestCompetitionRadius: 55, forestCompetitionTolerance: 2,
      forestCompetitionPenalty: 0.18, winterCompetitionMult: 1.7, crowdingSign: true,
      birdMaxPopulation: { kakapo: 10 }, maxPerSpecies: 12,
      // The pressure: the cold deepens each year and the forest band shrinks from the top.
      forestContraction: true, forestBand: { min: 0.33, max: 0.48 },
      climateDrift: { periodYears: 3, rampCycles: 8, coldCap: 0.7, baselineFrac: 0.2, starkness: 1.0 },
      winterInedibility: true, winterEdibilityMult: 1.3, winterEdibilityErosion: 0.6,
      ecosystemIncome: { base: 0.08, perFocusAnimal: 0.015, perAnimal: 0.006 }, noEggLaidMauri: true, noPopulationMilestones: true,
      eagleHungerRate: D.fEagleHunger,
      rescueImmigration: { little_bush_moa: { below: 4, count: 3, afterSeasons: 2 } }
    }),

    chapters: [
      ...K.seasonsCycle({
        summer: Object.assign(season('summer'), { focus: ['upland_moa'] }),
        autumn: season('autumn', { start: [{ fade: { type: 'Storm', sec: 60, refreshOnMove: true } }] }),
        winter: season('winter', { start: [(x) => { x.runner.vars.flockStart = kakapo(x); }],
          goals: [{ id: 'flock_through', name: "Year {year}: the flock through the winter", keep: (x) => kakapo(x) >= (x.runner.vars.flockStart || 0), reward: 15 }] }),
        spring: season('spring', { goals: [{ id: 'year_done', name: "Year {year} of " + D.fYears, survive: true, reward: 10 }] })
      }, { years: D.fYears }),
      K.wonAfterYears({
        title: "Eight years on",
        ok: (x) => kakapo(x) > 0 && bounty(x) > (x.runner.vars.bountyStart || 0),
        reason: (x) => kakapo(x) > 0 ? "Eight years on, the forest bears less than when Koukou came. A bountiful forest is what the kākāpō live on."
                                     : "The kākāpō are gone from this forest.",
        words: ["Eight years. The forest bears more than when Koukou and the baby came, and the kākāpō are still booming in it.",
                "But there are no other upland moa here. The baby is grown, and it is time to go north again."],
        lit: LEADS, before: [K.walkOff(LEADS, 'north')]
      })
    ],

    reactions: [
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          K.party([{ name: 'koukou', female: true }, { name: 'baby', years: 3, mother: 'koukou' }], 'camp', { hunger: 30 }),
          { place: { type: 'Storm', at: 'stormSpot', standing: true } },
          { eagle: { hunger: 5 } },
          (x) => { x.runner.vars.bountyStart = bounty(x); bountyLine(x); },
          { say: [
            ['guide', "Eight years in the kākāpō's forest. The rimu will mast in years four and eight. The cold deepens, and the forest shrinks from the top.", { lit: ['kakapo'] }],
            ['guide', "Keep the forest bountiful: leave it with more fruiting trees than it has now, and the kākāpō still in it. Lancewood, the Forest Seed and the storm are what you have.", { lit: [...LEADS] }]
          ] }
        ] },
      { id: 'best', on: 'goal_met', if: (x) => x.event && /^bounty_/.test(x.event.goal || ''), once: false, do: [(x) => { x.runner.vars.bountyBest = bounty(x); }] },
      { id: 'new_year', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && x.runner.yearNow() > 1, once: false,
        do: [bountyLine, { notify: ["Year {year}. Kākāpō chicks so far: " + "{$chicksSoFar}. {$bountyLine}.", 'success'] }] },
      { id: 'count_chicks', on: 'bird_hatched', if: { species: 'kakapo' }, once: false, do: [(x) => { x.runner.vars.chicksSoFar = x.runner.counters['hatched:kakapo'] || 0; }] },
      { id: 'mast_coming', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && x.game._lessonMastYear(1), once: false,
        notify: "Green fruit on the rimu." },
      { id: 'mast_here', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && mastNow(x), once: false,
        notify: ["A mast year: the rimu are red with fruit, and the RIMU BERRY SCRAMBLE is yours this year.", 'success'] },
      { id: 'flock_gone', when: (x) => x.runner.flags.staged && kakapo(x) === 0, do: [{ lose: "The kākāpō are gone from this forest, in year {year}." }] },
      ...common(null)
    ],

    winTitle: "A BOUNTIFUL FOREST",
    winText: "Eight years, two masts, and the forest bears more than it did.",
    menu: K.journeyMenu("The mast years", "The journey: 4f, eight years",
      ["Koukou and the baby, eight years among the kākāpō.", "", "Keep the forest bountiful as the cold comes down.", "A mast in years four and eight."],
      ['rimu', 'beech', 'fern', 'lancewood'])
  });
  freeplay.cast = Object.assign({}, freeplay.cast, { baby: { title: "the baby", species: 'upland_moa', manual: true } });

  return { lesson, freeplay };
})();

LEVEL_REGISTRY.register(JOURNEY_WEST.lesson);
LEVEL_REGISTRY.register(JOURNEY_WEST.freeplay);
