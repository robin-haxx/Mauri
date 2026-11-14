// ============================================================================
// THE JOURNEY, TILE 6: THE CRESTED ONE, and 6f: THE GIANT MOA (the north path)
// ============================================================================
// TILE 6, the lesson. Pukepuke, Mama and Papa go north again and meet a crested moa, an old
// bird of the high country, who tells them what it knows. The one rule: two patches of a
// moa's favoured plant, with the pair near, found a nest. The lever is speargrass (taramea),
// now plantable. The rule is the open simulation's own (Simulation._updateMoaNestingFormation;
// the endless variant "The Tops" already uses it). This lesson adds its sign: a dashed ring
// round a lone patch, the reach within which a second patch would found a nest.
//
// The year. Summer: found a nest, and Mama lays. Kea come for the egg, and the family at the
// nest defeats the raid, as tile 2 taught. Autumn and winter: the grove planted ahead, as
// tile 5 taught. Spring: nothing is said. Then the family turns west.
//
// The lore. Three lines from the crested moa, each released by something the player does (the
// first patch, the nest, the hatch). They point ahead to the giant moa and the meeting.
//
// 6f, the free play. Eight years, to match 4f. Grow the clan without starving out the
// slow-breeding giant moa. No new rule: the giant moa lays one egg every two or three years
// and takes eight to grow up, a crowded winter forest feeds everyone less, and a Pouākai
// whose chosen bird is hidden turns to another. A player who hides every bird of their own
// sends the eagle to the giant moa. Won at the end of year 8 if the clan has reached its
// target and the giant moa are no fewer than at the start.
//
// Known, inferred, imagined: crested moa on the high country of north-west Nelson, known;
// speargrass spines as a defence against moa, inferred and debated; the giant moa's slow
// breeding, inferred from bone growth. A speaking crested moa is a story device.
// PLACEHOLDERS: the crested moa's name and lore, every title and line, the ring, and a
// crested moa that reads as itself on screen (it is the species' grey tint for now).
// ============================================================================

const JOURNEY_CRESTED_DIAL = {
  kea: 3,
  growInSec: 38,
  patchQuestion: 8, patchTell: 18,   // the lone patch's ladder, in seconds
  fYears: 8, fClan: 8,               // the free play: its length and the clan's target
  fGiants: 5, fHerd: 6, fEagleHunger: 0.0065   // giant moa; a stout-legged herd as other prey; a slow appetite
  //                       // giant moa at the start (the record's number once tile 6f has been played)
};

const JOURNEY_NORTH = (() => {
  const K = CHAPTERS_KIT, D = JOURNEY_CRESTED_DIAL;
  const FAMILY = ['pukepuke', 'mama', 'papa'];
  const ELDERS = { mama: "Mama", papa: "Papa" };
  const FOCUS = 'upland_moa';
  const clan = (x) => x.runner.sim.getSpeciesCount(FOCUS);
  const giants = (x) => x.runner.sim.getSpeciesCount('south_island_giant_moa');
  const nests = (x) => (x.runner.sim.nestingSites || []).filter(s => s.alive !== false && s.playerMade).length;
  const lonePatch = (x) => { const p = x.runner.sim._focusPlantPatches(); return p.length === 1; };
  const groveNear = (x) => x.runner.sim.placeables.some(p => p.alive && p.type === 'harakeke' &&
    FAMILY.some(n => { const e = x.runner.castEnts[n]; return e && e.alive && Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y) < 150; }));

  const base = (over) => Object.assign({
    module: true, journey: true, section: 'journey', unlockCondition: null,
    zoom: 2.0, startSeason: 'summer',
    terrain: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.terrain, {
      plantDensity: 0.0066,
      elevationWindow: { lo: 0.24, hi: 0.68, pLo: 0.08, pHi: 0.92 }
    }),
    biomes: LEVEL_FREEPLAY_KAHURANGI.biomes,
    startingSpecies: FOCUS,
    sites: {
      tops:      { find: 'high', near: { fx: 0.55, fy: 0.45 }, within: 240 },
      camp:      { find: 'open', near: 'tops', dist: [30, 80] },
      elder:     { near: 'camp', dist: [40, 80] },
      stormSpot: { near: 'camp', dist: [50, 90] }
    },
    lose: [], goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 30 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 40),
    tutorial: { guideSprite: 'mantis_talk', tips: null }
  }, over);

  const HARAKEKE = { cost: 25, duration: 2700 * 2.4, growInSec: D.growInSec, plantSpawnCount: 4,
                     description: "Flax for the cold months. It goes in as shoots and takes most of a season to grow." };
  const common = (taught) => [
    ...K.coverLadder({ species: FOCUS, first: [4, 7], later: [4, 7], pauseFirst: false }),
    ...K.praise({ chapters: taught }),
    ...K.stormLadder({ lit: FAMILY, unlock: false, chapters: taught }),
    ...K.gaveUp(),
    ...K.arrivals(),
    { id: 'raid_failed', on: 'nest_raid', if: { success: false }, once: false, cooldown: 20, notify: "The moa drove a kea off the nest." },
    { id: 'raid_won', on: 'nest_raid', if: { success: true }, once: false, cooldown: 15,
      notify: ["A kea took an egg. Moa gathered at a nest keep the kea off.", 'error'] },
    ...K.leadLost({ pukepuke: "Pukepuke" }),
    ...K.elderLost(ELDERS)
  ];
  const nestMechanics = { nestingSites: { forestCount: 0, openCount: 0, foundPatches: 2, foundRadius: 110, radius: 40,
                                          laySnapRadius: 150, drawRadius: 260, layBoost: 0.5, eggSpeedBonus: 1.5 },
                          nestFoundingSign: true,
                          keaRaidsEggs: 'odds', keaRaidRadius: 95, keaRaidNutrition: 40, keaRaidCooldownSec: 8,
                          keaRaid: { baseSuccess: 0.9, moaPenalty: 0.2, minSuccess: 0.05, moaRadius: 95 },
                          flyerEdgeMargin: 14, stormFlushMult: 1.0 };

  // ==========================================================================================
  // TILE 6: the lesson
  // ==========================================================================================
  const TAUGHT = ['summer', 'autumn', 'winter'];
  const lesson = base({
    id: 'journey_crested',
    name: "The crested one",
    claim: "Two patches of a moa's favoured plant, with the pair near, found a nest.",
    teaches: ['nest_founding', 'favoured_plant'],
    guide: ['upland_moa', 'favoured_plants', 'kea', 'subalpine'],
    waysOn: [{ label: "Stay among the giant moa", tile: 't6f' }],
    outcome: { birds: FAMILY, herds: { clan: FOCUS },
               also: (rec, r) => { const m = r.castEnts.mama; rec.siblings = r.sim.moas.filter(b => b.alive && b.speciesKey === FOCUS && !b.castName && b._bornTurn != null).length; } },

    species: { moa: [FOCUS, 'crested_moa', 'stout_legged_moa'], eagle: ['haasts_eagle'], other: ['kea'] },
    initialSpeciesDistribution: { stout_legged_moa: 5 },
    initialEntityCounts: { moa: 5, eagle: 1, kea: D.kea },
    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 120, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 40
    }),
    availablePlaceables: {
      speargrass: { cost: 25, duration: 2700 * 3, description: "Taramea. The upland moa's own plant: two patches close together, with the pair near, found a nest." },
      harakeke: HARAKEKE,
      Storm: K.STORM
    },
    mechanics: K.journeyMechanics(Object.assign({}, nestMechanics, {
      birdMaxPopulation: { kea: 4 },
      winterInedibility: true, winterEdibilityMult: 0.7, winterEdibilityErosion: 0.6,
      rescueImmigration: { stout_legged_moa: { below: 3, count: 3, afterSeasons: 1 }, kea: { below: 2, count: 2, afterSeasons: 2 } }
    })),
    cast: {
      pukepuke: { title: "Pukepuke", species: FOCUS, manual: true },
      mama:     { title: "Mama",     species: FOCUS, manual: true, pitch: 0.85 },
      papa:     { title: "Papa",     species: FOCUS, manual: true },
      crested:  { title: "the crested moa", species: 'crested_moa', manual: true, pitch: 0.7 }
    },

    chapters: [
      { id: 'summer', title: "Summer: no nest here",
        tools: ['speargrass', 'Storm'], focus: [FOCUS],
        nesting: { species: FOCUS, plant: 'speargrass' },
        goals: [
          { id: 'nest', name: "A nest for the family", done: (x) => nests(x) >= 1, reward: 25 },
          { id: 'egg', name: "An egg in the nest", done: { seen: ['egg_laid', { species: FOCUS }] }, reward: 15 }
        ],
        holdSeason: { until: { goal: 'nest' }, at: 0.85, maxSec: 30 }
      },
      { id: 'autumn', title: "Autumn: before the cold",
        tools: ['speargrass', 'harakeke', 'Storm'],
        start: [{ fade: { type: 'Storm', sec: 60, refreshOnMove: true } }, K.eagleComes('pukepuke', 40)],
        goals: [{ id: 'ahead', name: "Winter food growing by the family", done: groveNear, reward: 15 }]
      },
      { id: 'winter', title: "Winter",
        tools: ['harakeke', 'Storm'],
        start: [(x) => { x.runner.vars.winterStart = clan(x); }],
        goals: [{ id: 'winter_all', name: "Every upland moa through the winter", keep: (x) => clan(x) >= (x.runner.vars.winterStart || 0), reward: 25 }]
      },
      { id: 'spring', title: "Spring: the family turns west", transfer: true,
        tools: ['speargrass', 'harakeke', 'Storm'],
        start: [{ say: [['guide', "Spring. One more season in the high country, and nobody will tell you what to do."]] }, K.eagleComes('pukepuke', 42)],
        reactions: [{ id: 'spring_press', when: { after: 24 }, do: [K.eagleComes('pukepuke', 47)] }],
        goals: [{ id: 'own', name: "Meet a problem with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 }],
        next: 'onward'
      },
      { id: 'onward', title: "West", tools: [],
        start: [{ say: [['crested', "[PLACEHOLDER LORE] West of here two valleys meet. Others of your kind are walking toward it. Go and meet them.", { lit: ['crested'] }]] }],
        until: { after: 4 }, next: 'win' }
    ],

    reactions: K.quietOutside([
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          K.party([{ name: 'pukepuke', female: false }, { name: 'mama', female: true }, { name: 'papa', female: false }], 'camp', { radius: 18 }),
          { spawn: { type: 'crested_moa', at: 'elder', count: 1, female: false, hunger: 20 } },
          { adopt: { crested: { species: 'crested_moa', near: 'elder' } } },
          { place: { type: 'Storm', at: 'stormSpot', standing: true } },
          { eagle: { which: 'nearest', near: 'camp', watch: 'stormSpot', hunger: 20 } },
          { say: [
            ['guide', "Higher still. Pukepuke, Mama and Papa have no nest in this country.", { lit: FAMILY }],
            ['crested', "[PLACEHOLDER LORE] I have watched many of your kind settle here. They settle where the speargrass grows thick.", { lit: ['crested'] }]
          ] }
        ] },
      // ---- The lone patch: a hint ladder. The ring round it is the clue. -------------------------
      { id: 'one_patch', when: lonePatch, chapters: ['summer'],
        until: { any: [(x) => nests(x) >= 1, (x) => x.runner.sim._focusPlantPatches().length >= 2, { after: 45 }] },
        solved: (x) => nests(x) >= 1 || x.runner.sim._focusPlantPatches().length >= 2,
        hints: [
          { after: D.patchQuestion, notify: ["One patch of speargrass, and a ring around it. What is the ring waiting for?", 'error'] },
          { after: D.patchTell, banner: { words: ["Plant a second SPEARGRASS inside the ring", "Two patches, with the pair near, found a nest"],
                                          tool: 'speargrass', lit: FAMILY, pause: true, maxSec: 30 } }
        ] },
      { id: 'no_patch', when: { all: [{ season: 'summer' }, { seasonProgress: ['>=', 0.35] }, (x) => nests(x) < 1 && x.runner.sim._focusPlantPatches().length === 0] }, chapters: ['summer'],
        banner: { words: ["The family needs a nest: plant SPEARGRASS by them", "It is the upland moa's own plant"], tool: 'speargrass', lit: FAMILY, pause: false, maxSec: 20 } },
      // ---- The lore, each line released by what the player did (PLACEHOLDER WORDS) -------------------
      { id: 'lore_nest', on: 'nest_founded',
        moment: { on: '$site', text: "A nest in the high country" },
        say: [['crested', "[PLACEHOLDER LORE] So. A nest. On the flats below walk moa twice my height, who lay one egg in three summers. Be careful what you crowd.", { lit: ['crested'] }]] },
      { id: 'lore_hatch', on: 'egg_hatched', if: { species: FOCUS },
        moment: { on: '$moa', text: "A chick for Mama" },
        say: [['crested', "[PLACEHOLDER LORE] A chick. The Pouākai roosts north and west of here. It forgets nothing it has seen.", { lit: ['crested', '$moa'] }]] },
      { id: 'egg_laid', on: 'egg_laid', if: { species: FOCUS }, notify: ["An egg in the nest. Kea will come for it: keep the family fed beside it.", 'success'] },
      ...common(TAUGHT)
    ], ['gave_up', 'gave_up_again', 'arrived', 'raid_failed', 'raid_won'], TAUGHT),

    winTitle: "WEST",
    winText: "The family has a nest behind it, and turns west.",
    menu: K.journeyMenu("The crested one", "The journey: tile 6",
      ["Pukepuke, Mama and Papa, and an old bird of the high country.", "", "Two patches of a moa's favoured plant,", "with the pair near, found a nest."],
      ['tussock', 'speargrass', 'flax', 'beech'])
  });

  // ==========================================================================================
  // 6f: the giant moa (free play)
  // ==========================================================================================
  const toolsFor = (season) => (x) => x.runner.setTools({ summer: ['speargrass', 'Storm'], autumn: ['speargrass', 'harakeke', 'Storm'],
                                                         winter: ['harakeke', 'Storm'], spring: ['speargrass', 'Storm'] }[season]);
  const lines = (x) => { const v = x.runner.vars; v.clan = clan(x); v.giants = giants(x);
    v.clanLine = `The clan: ${v.clan} of ${D.fClan} upland moa`; v.giantLine = `Giant moa: ${v.giants} (there were ${v.giantStart != null ? v.giantStart : v.giants})`; };
  const season = (key, extra = {}) => ({
    start: [toolsFor(key), lines, ...(extra.start || [])],
    goals: [
      { id: `clan_${key}`, name: "{$clanLine}", stretch: true, reward: 10, done: (x) => { lines(x); return clan(x) >= D.fClan; } },
      { id: `giants_${key}`, name: "{$giantLine}", reward: 10, keep: (x) => { lines(x); return giants(x) >= Math.min(x.runner.vars.giantStart || 0, x.runner.vars.giantSeason || 0); } },
      ...(extra.goals || [])
    ]
  });

  const freeplay = base({
    id: 'journey_giants',
    name: "The giant moa",
    freePlay: true, userCamera: true,
    claim: "A herd that breeds slowly pays for what its neighbours gain: in a crowded winter forest, and to a Pouākai whose bird is hidden.",
    teaches: ['slow_herds', 'balance'],
    guide: ['south_island_giant_moa', 'upland_moa', 'predator_prey', 'coexistence'],
    waysOn: [],
    outcome: { birds: FAMILY, herds: { giant: 'south_island_giant_moa', clan: FOCUS, kaka: 'kaka' },
               also: (rec, r) => { rec.siblings = r.sim.moas.filter(b => b.alive && b.speciesKey === FOCUS && !b.castName).length; } },

    species: { moa: [FOCUS, 'south_island_giant_moa', 'stout_legged_moa'], eagle: ['haasts_eagle'], other: ['kea', 'kaka'] },
    initialSpeciesDistribution: { south_island_giant_moa: D.fGiants, stout_legged_moa: D.fHerd },
    initialEntityCounts: { moa: D.fGiants + D.fHerd, eagle: 1, kea: 3, kaka: 4 },
    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 120, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 50
    }),
    availablePlaceables: { speargrass: { cost: 25, duration: 2700 * 3 }, harakeke: HARAKEKE, Storm: K.STORM },
    mechanics: K.journeyMechanics(Object.assign({}, nestMechanics, {
      birdMaxPopulation: { kea: 5, kaka: 6 }, maxPerSpecies: 14,
      forestCompetition: true, forestBiomes: ['forestRefuge'], forestCompetitionRadius: 55, forestCompetitionTolerance: 2,
      forestCompetitionPenalty: 0.18, winterCompetitionMult: 1.7, crowdingSign: true,
      winterInedibility: true, winterEdibilityMult: 1.0, winterEdibilityErosion: 0.6,
      eagleHuntsFlyers: true, eagleFlyerHungerGate: 55, eagleFlyerPreyPenalty: 1.4, eagleFlyerFeed: 60,
      focalSpecies: [FOCUS], focalWildFoodMult: 0.5,
      ecosystemIncome: { base: 0.08, perFocusAnimal: 0.015, perAnimal: 0.006 }, noEggLaidMauri: true, noPopulationMilestones: true,
      // Upland moa arrive over the pass while the clan is small; nothing brings giant moa back.
      eagleHungerRate: D.fEagleHunger,
      rescueImmigration: { upland_moa: { below: 5, count: 2, afterSeasons: 3 }, stout_legged_moa: { below: 4, count: 3, afterSeasons: 2 }, kea: { below: 2, count: 2, afterSeasons: 3 }, kaka: { below: 2, count: 2, afterSeasons: 4 } }
    })),
    cast: {
      pukepuke: { title: "Pukepuke", species: FOCUS, manual: true },
      mama:     { title: "Mama",     species: FOCUS, manual: true, pitch: 0.85 },
      papa:     { title: "Papa",     species: FOCUS, manual: true }
    },

    chapters: [
      ...K.seasonsCycle({
        summer: Object.assign(season('summer'), { focus: [FOCUS], nesting: { species: FOCUS, plant: 'speargrass' } }),
        autumn: season('autumn', { start: [{ fade: { type: 'Storm', sec: 60, refreshOnMove: true } }] }),
        winter: season('winter', { start: [(x) => { x.runner.vars.winterStart = clan(x); }],
          goals: [{ id: 'winter_all', name: "Year {year}: every upland moa through the winter", keep: (x) => clan(x) >= (x.runner.vars.winterStart || 0), reward: 15 }] }),
        spring: season('spring', { goals: [{ id: 'year_done', name: "Year {year} of " + D.fYears, survive: true, reward: 10 }] })
      }, { years: D.fYears }),
      K.wonAfterYears({
        title: "Eight years on",
        ok: (x) => clan(x) >= D.fClan && giants(x) >= (x.runner.vars.giantStart || 0),
        reason: (x) => giants(x) < (x.runner.vars.giantStart || 0)
          ? "Eight years on there are fewer giant moa than when the family came. A bird that lays one egg in three years cannot make up what it loses."
          : `Eight years on the clan is ${clan(x)}, short of ${D.fClan}.`,
        words: ["Eight years. The clan has grown, and the giant moa still walk the flats.", "The family turns west, toward the place where two valleys meet."],
        lit: FAMILY, before: [K.walkOff(FAMILY, 'west')]
      })
    ],

    reactions: [
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          K.party([{ name: 'pukepuke', female: false }, { name: 'mama', female: true }, { name: 'papa', female: false }], 'camp', { radius: 18 }),
          // Pukepuke's younger siblings, as the record has them (and a mate for him from over the pass).
          (x) => { const n = (x.runner.record && x.runner.record.siblings) || 0;
                   if (n) x.runner.spawn({ type: FOCUS, at: 'camp', count: n, age: 'juvenile', sexes: 'pair', hunger: 30 });
                   x.runner.spawn({ type: FOCUS, at: 'camp', count: 1, female: true, hunger: 30 }); },
          { place: { type: 'Storm', at: 'stormSpot', standing: true } },
          { eagle: { hunger: 10 } },
          (x) => { x.runner.vars.giantStart = giants(x); x.runner.vars.giantSeason = giants(x); x.runner.vars.wantNests = 2; lines(x); },
          { say: [
            ['guide', "Eight years in the high country. Giant moa walk the flats below: one egg every two or three years, and eight years for a chick to grow.", { lit: ['south_island_giant_moa'] }],
            ['guide', `Grow the clan to ${D.fClan} upland moa, and leave no fewer giant moa than there are now. The Pouākai has to eat somebody.`, { lit: ['haasts_eagle'] }]
          ] }
        ] },
      { id: 'season_giants', on: 'chapter_start', once: false, do: [(x) => { x.runner.vars.giantSeason = giants(x); }] },
      { id: 'giant_taken', on: 'moa_killed', if: { species: 'south_island_giant_moa' },
        say: [['guide', "The Pouākai took a giant moa. Hidden from your birds, it turned to theirs. It will be years before that one is replaced.", { lit: ['south_island_giant_moa'] }]] },
      { id: 'giant_taken_again', on: 'moa_killed', if: { species: 'south_island_giant_moa' }, once: false, cooldown: 20,
        do: [lines, { notify: ["The Pouākai took a giant moa. {$giantLine}.", 'error'] }] },
      { id: 'giant_chick', on: 'egg_hatched', if: { species: 'south_island_giant_moa' }, once: false, moment: { on: '$moa', text: "A giant moa chick" } },
      { id: 'new_nest', on: 'nest_founded', once: false, moment: { on: '$site', text: "A new nest" } },
      { id: 'giants_gone', when: (x) => x.runner.flags.staged && giants(x) === 0 &&
                                       !x.runner.sim.eggs.some(e => e.alive && !e.hatched && e.parentSpecies === 'south_island_giant_moa'),
        do: [{ lose: "The giant moa are gone from this country, in year {year}." }] },
      ...common(null)
    ],

    winTitle: "ROOM FOR BOTH",
    winText: "Eight years: the clan grew, and the giant moa are still here.",
    menu: K.journeyMenu("The giant moa", "The journey: 6f, eight years",
      ["Pukepuke's clan beside a herd that breeds slowly.", "", "Grow the clan without starving out the giant moa.", "The Pouākai has to eat somebody."],
      ['tussock', 'speargrass', 'flax', 'beech'])
  });

  return { lesson, freeplay };
})();

LEVEL_REGISTRY.register(JOURNEY_NORTH.lesson);
LEVEL_REGISTRY.register(JOURNEY_NORTH.freeplay);
