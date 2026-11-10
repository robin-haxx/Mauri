// ============================================================================
// ENDLESS, ON THE LESSONS' RULES: the tops, year after year
// ============================================================================
// What this is. The endless game the three lessons lead to. The two upland moa families from
// the lessons live on one stretch of country, with the herds, the forest birds and the
// Pouākai around them, and the years go round without end. It plays by the rules the
// lessons teach: a storm is cover, the eagle can be read and hunts what it can see, kea raid
// nests at odds the moa set, pātōtara is bare in winter, and every creature breeds in its
// own season.
//
// How it differs from the first Endless level (levels/level_freeplay_kahurangi.js), which is
// kept as it was:
//   - The same animals live on from year to year. That level moves to a new area each year
//     and sets down a fresh cast; here a chick hatched in year one is the half-grown bird of
//     year two and a parent in year four.
//   - Herds are small and breed slowly. Every moa keeps a breeding calendar (one egg in its
//     season, a year or two between clutches, three years to grow up), so a population takes
//     years to build and each animal counts. A tap on an animal says who it is, and the
//     camera can follow it.
//   - Nothing is protected from dying out. When a herd falls low, a few arrive over the pass
//     a season or two later, and the lesson says so. A lost eagle is replaced the same way.
//   - The goals are small numbers: an egg kept from the kea, every upland moa through the
//     winter, the clan growing by twos.
//   - The player defends nests from kea (as the Pātōtara lesson taught) and does not raid
//     them. The Berry Cache is the same rule from the other side: berries draw kea, so a
//     cache away from the nests draws them off.
//
// What the simulation does on its own: everything. The chapters set the toolbar by the
// season and the year, bring newcomers in on set years, count the year, and speak.
//
// What is left out of this first version, on purpose: the tour of a 2×2 world, the mast year
// and the kākāpō, the player's Nest Raid, and the forest tools. See CHAPTERS_MODULES.md.
// ============================================================================

// The dial: the numbers most worth tuning, in one place.
const ENDLESS_TOPS_DIAL = {
  seasonFrames: 2700,        // 45 s a season, three minutes a year (as the lessons)
  graceSec: 6,               // the eagle's wind-up, in seconds (the Guided lessons' length)
  eagleHungerRate: 0.0065,   // a meal every few minutes: a hunt is an event, not a drumbeat
  hungerRateMult: 0.7,       // how fast moa get hungry
  chickHunger: 1.5,          // ...and how much faster a first-year chick does (winter falls on the young)
  winterFood: 1.5,           // how much of a wild plant's winter food value is left (winterEdibilityMult)
  wildFood: 0.3,             // how much of a wild plant's food the upland families get (focalWildFoodMult)
  startingMauri: 100,
  income: { base: 0.08, perFocusAnimal: 0.015, perAnimal: 0.006 }, // mauri a second
  rewards: { eggsSafe: 10, ready: 5, winterAll: 15, yearDone: 10, clan: 20, chick: 10, nest: 20, sent: 30 },
  clanStart: 6, clanStep: 2, // the clan goal: six upland moa, then eight, then ten
  clanMax: 10,               // above this many, grown young leave over the pass each spring
  kakaYear: 2, nestYear: 3, secondEagleYear: 5, secondEagleMoa: 16
};

const CHAPTERS_ENDLESS = (() => {
  const D = ENDLESS_TOPS_DIAL;
  const FOCUS = 'upland_moa';
  const NAMED = ['mama', 'papa', 'friendMama', 'friendPapa', 'pukepuke', 'koukou'];

  // ---- Small helpers the chapters use (functions: the engine's escape hatch) ------------
  const uplandCount = (x) => x.runner.sim.getSpeciesCount(FOCUS);
  const uplands = (x) => x.runner.sim.moas.filter(m => m.alive && m.speciesKey === FOCUS);
  // What to call a bird in a line: its cast title, else "a chick" or its species.
  const callIt = (r, e) => {
    if (!e) return 'a moa';
    if (e.castName && r.castDefs[e.castName]) return r.castDefs[e.castName].title;
    const kind = r._name(e.speciesKey) || 'moa';
    return (e.isJuvenile && e.isJuvenile()) ? `a ${kind} chick` : `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind}`;
  };
  // The toolbar for a season of a year: the lessons' three tools, then what later years add.
  const toolsFor = (season, year) => {
    const base = { summer: ['patotara', 'Storm'], autumn: ['patotara', 'wharariki', 'Storm'],
                   winter: ['wharariki', 'Storm'], spring: ['patotara', 'Storm'] }[season].slice();
    if (year >= D.nestYear && season !== 'winter') base.unshift('speargrass');
    if (year >= D.kakaYear && season !== 'winter') base.push('keaLure');
    base.push('waterhole');
    return base;
  };
  const setTools = (season) => (x) => x.runner.setTools(toolsFor(season, x.runner.yearNow()));
  // The year's count: who hatched and who was lost since the last one (for the new year's line).
  const tally = (x) => {
    const r = x.runner, v = r.vars, now = uplandCount(x);
    const hatched = r.counters['hatched:' + FOCUS] || 0;
    const left = r.counters['left:' + FOCUS] || 0;
    if (v._count != null) {
      v.born = hatched - (v._hatched || 0);
      v.lost = Math.max(0, v._count + v.born - now - (left - (v._left || 0)));   // (those who left are not lost)
    }
    v._count = now; v._hatched = hatched; v._left = left; v.clan = now; v.sent = left;
    if (v.clanTarget == null) v.clanTarget = D.clanStart;
    clanLine(x);
  };
  // The standing goal. While the clan is building: "The clan: 5 of 6". Once it has reached its
  // full size, the grown young leave each spring, and the line counts them instead.
  const clanLine = (x) => {
    const v = x.runner.vars, n = uplandCount(x);
    v.clan = n;
    v.clanLine = (v.clanTarget || D.clanStart) <= D.clanMax
      ? `The clan: ${n} of ${v.clanTarget || D.clanStart} upland moa`
      : `Grown young sent over the pass: ${x.runner.counters['left:' + FOCUS] || 0}`;
    return n;
  };
  const clanGoal = (season) => ({
    id: `clan_${season}`, name: "{$clanLine}", stretch: true, reward: D.rewards.clan,
    done: (x) => { const n = clanLine(x), t = x.runner.vars.clanTarget || D.clanStart; return t <= D.clanMax && n >= t; }
  });
  const whararikiNear = (x, dist) => {
    const flax = x.runner.sim.placeables.filter(p => p.alive && p.type === 'wharariki');
    return flax.length > 0 && uplands(x).some(m => flax.some(p => Math.hypot(p.pos.x - m.pos.x, p.pos.y - m.pos.y) <= dist));
  };
  const coverUntil = { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] };

  return {
    id: 'chapters_endless',
    name: 'ENDLESS: The Tops',          // (a placeholder name, as the menu's section labels are)
    section: 'endless',
    endlessChapters: true,              // never won: a loss shows the years kept (Game's overlay)
    userCamera: true,                   // the zoom buttons, drag to pan, tap an animal to follow it
    claim: "Small herds grow slowly, so every animal counts, and the Pouākai must eat too.",
    guide: ['upland_moa', 'haasts_eagle', 'kea', 'kaka', 'kokako', 'south_island_giant_moa', 'predator_prey', 'patotara'],
    unlockCondition: null,

    zoom: 1.667,
    startSeason: 'summer',
    // The Endless level's country, in one window, with its heights fitted so any seed has
    // flats, forest, tussock tops and a little scree (TerrainGenerator._fitElevationWindow).
    terrain: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.terrain, {
      plantDensity: 0.0052,
      elevationWindow: { lo: 0.17, hi: 0.69, pLo: 0.08, pHi: 0.92 }
    }),
    biomes: LEVEL_FREEPLAY_KAHURANGI.biomes,

    species: {
      moa: ['upland_moa', 'little_bush_moa', 'stout_legged_moa', 'south_island_giant_moa'],
      eagle: ['haasts_eagle'],
      other: ['kea', 'kokako', 'kaka']
    },
    startingSpecies: 'upland_moa',
    // (The upland families are set down by the stage below; these are everyone else.)
    initialSpeciesDistribution: { little_bush_moa: 4, stout_legged_moa: 6, south_island_giant_moa: 2 },
    initialEntityCounts: { moa: 12, eagle: 1, kea: 4, kokako: 3 },

    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: D.startingMauri, seasonDuration: D.seasonFrames, eggIncubationTime: 2400,
      eagleSpawnMilestones: [], maxPopulation: 60
    }),

    availablePlaceables: {
      speargrass: { cost: 25 },
      patotara:   { cost: 25 },
      wharariki:  { cost: 25 },
      Storm:      { cost: 40, moveCost: 10, radius: 64, blocksEagleVision: true, distractsEagles: false,
                    description: "A moa under the storm can't be seen by the Pouākai." },
      keaLure:    { cost: 30, description: "Berries draw kea: set a cache away from the nests." },
      waterhole:  { cost: 45, radius: 40 }
    },
    paletteOrder: [['speargrass'], ['patotara', 'wharariki'], ['Storm', 'keaLure', 'waterhole']],

    mechanics: {
      noSpeciation: true,
      evergreenPlants: MODULE_STORMS.mechanics.evergreenPlants,
      landRegionMates: true,
      maxPerSpecies: 14,
      // The upland moa are the families the player tends. Wild browse only partly feeds them:
      // the pātōtara and wharariki the player grows are what keep them well fed.
      focalSpecies: [FOCUS], focalWildFoodMult: D.wildFood,
      birdMaxPopulation: { kea: 6, kaka: 6, kokako: 5 },   // small flocks, as the herds are small

      // ---- Small herds that breed slowly --------------------------------------------
      seasonalBirdBreeding: 'calendar',   // the birds and the giant moa lay by their calendars...
      moaCalendar: true,                  // ...and so does every other moa (mauri_species_data.js)
      familyLinks: true,                  // a chick knows its mother; an egg set down takes the nearest hen
      juvenileFollow: { within: 50, untilYears: 2, pull: 0.6 },
      // No floors. A herd that falls low is joined from over the pass; a lost eagle is replaced.
      // Above ten, the oldest grown young leave over the pass each spring (never a named bird).
      dispersal: { upland_moa: { above: D.clanMax, maxPerYear: 2, season: 'spring' } },
      rescueImmigration: {
        stout_legged_moa:       { below: 4, count: 3, afterSeasons: 2 },
        south_island_giant_moa: { below: 2, count: 2, afterSeasons: 4 },
        little_bush_moa:        { below: 3, count: 2, afterSeasons: 3 },
        kea:                    { below: 2, count: 2, afterSeasons: 3 },
        kokako:                 { below: 2, count: 2, afterSeasons: 4 },
        kaka:                   { below: 2, count: 2, afterSeasons: 4 }
      },
      eagleReturns: { afterSeasons: 2 },
      // Mauri: the steady trickle below and the goals' rewards. The older lump sums are off or
      // small here (a little per hatch while a species is few; no population milestones).
      ecosystemIncome: D.income,
      noEggLaidMauri: true, noPopulationMilestones: true,
      hatchReward: { perSpecies: true, full: 6, reduced: 10, fullAmount: 2, reducedAmount: 1, allSpecies: true },

      // ---- Food and the kea, as the Pātōtara lesson ---------------------------------
      sproutPatotara: true, placedPlantsSeasonal: true,
      keaBerryLureRadius: 400, keaRaidsEggs: 'odds', keaRaidRadius: 95, keaRaidNutrition: 40, keaRaidCooldownSec: 8,
      keaRaid: { baseSuccess: 0.9, moaPenalty: 0.2, minSuccess: 0.05, moaRadius: 95 },
      flyerEdgeMargin: 14, stormFlushMult: 1.0,

      // ---- The Pouākai: one bird with a slow appetite, readable, after whoever has numbers --
      emergentEagles: true, eagleMaxPopulation: 1, eagleHungerRate: D.eagleHungerRate,
      eagleStarveThreshold: 88, eagleStarveTimeout: 9000, eagleTargetRatio: 1 / 5,
      eaglePreyPopThreshold: 3, eagleScarcePreyPenalty: 3, eagleSurplusPreference: true,
      eagleHuntsFlyers: true, eagleFlyerHungerGate: 55, eagleFlyerPreyPenalty: 1.4, eagleFlyerFeed: 60,
      eaglePursuitRadius: 320,
      eagleTelegraph: { graceSec: D.graceSec, warnBelow: 10 },
      coverBreaksLock: true, coverCalmsMoa: true, lureUnderStorm: true, placeableQueryRadius: 100,
      // Hide its bird twice in one hunger and it gives the upland moa up for a while and goes
      // for other prey, by preference a herd with numbers to spare.
      coverSendsEagleAway: { after: 2, sec: 50 },
      huntCamera: { focusOnly: true },    // when zoomed in, the view eases to a hunt and back

      nestingSites: { forestCount: 0, openCount: 0, foundPatches: 2, foundRadius: 110, radius: 40,
                      laySnapRadius: 150, drawRadius: 260, layBoost: 0.5, eggSpeedBonus: 1.5 },
      habitatStress: true, habitatStressMargin: 0.08, habitatStressPenalty: 0.4, winterStressMult: 1.4,
      hungerRateMult: D.hungerRateMult, juvenileHungerMult: D.chickHunger,

      // ---- Winter takes food value, not plants; and the cold deepens over the years ------
      // Wild plants stand through winter but are worth a fraction of their summer food (each
      // kind's winterEdibility), less again in a glacial year. Grown wharariki is the answer.
      winterInedibility: true, winterEdibilityMult: D.winterFood, winterEdibilityErosion: 0.6,
      climateDrift: { periodYears: 3, rampCycles: 14, coldCap: 0.7, baselineFrac: 0.2, starkness: 1.0 }
    },

    cast: {
      mama:       { title: "Mama Moa",      species: FOCUS, manual: true, pitch: 0.85 },
      papa:       { title: "Papa Moa",      species: FOCUS, manual: true },
      friendMama: { title: "the neighbour hen", species: FOCUS, manual: true, pitch: 0.9 },
      friendPapa: { title: "the neighbour",  species: FOCUS, manual: true },
      pukepuke:   { title: "Pukepuke",      species: FOCUS, manual: true, scale: 0.6 },
      koukou:     { title: "Koukou",        species: FOCUS, manual: true, scale: 0.6 }
    },

    sites: {
      nestA:   { find: 'biome', biome: 'subalpine', near: { fx: 0.55, fy: 0.45 } },
      nestB:   { find: 'open', near: 'nestA', dist: [90, 150] },
      tops:    { near: 'nestA', dist: [60, 110] },
      lookout: { near: 'nestB', dist: [70, 130] },
      tarn:    { find: 'biome', biome: 'shrubland', near: 'nestA' }
    },

    // ---- The year: four chapters that go round for ever --------------------------------
    chapters: [
      { id: 'summer', title: "Summer",
        focus: [FOCUS],
        start: [setTools('summer')],
        goals: [
          { id: 'eggs_safe', name: "No egg lost to the kea this summer", keep: { not: { seen: ['nest_raid', { success: true }] } }, reward: D.rewards.eggsSafe },
          clanGoal('summer')
        ]
      },
      { id: 'autumn', title: "Autumn",
        start: [setTools('autumn'), { fade: { type: 'Storm', sec: 60, refreshOnMove: true } }],
        goals: [
          { id: 'ready', name: "Wharariki growing near the upland moa before winter", done: (x) => whararikiNear(x, 120), reward: D.rewards.ready },
          clanGoal('autumn')
        ]
      },
      { id: 'winter', title: "Winter",
        start: [setTools('winter'), (x) => { x.runner.vars.winterStart = uplandCount(x); }],
        goals: [
          { id: 'winter_all', name: "Every upland moa through the winter", keep: (x) => uplandCount(x) >= (x.runner.vars.winterStart || 0), reward: D.rewards.winterAll },
          clanGoal('winter')
        ]
      },
      { id: 'spring', title: "Spring",
        start: [setTools('spring')],
        goals: [
          { id: 'year_done', name: "Year {year} on the tops", survive: true, reward: D.rewards.yearDone },
          clanGoal('spring')
        ],
        next: 'summer'
      }
    ],

    reactions: [
      // ---- The stage, once (a reaction, so it runs after the level's own spawning) ------
      { id: 'stage', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && !x.runner.flags.staged,
        do: [
          { flag: 'staged' },
          { nest: { at: 'nestA', radius: 40, hideClutch: true, as: 'homeA' } },
          { nest: { at: 'nestB', radius: 40, hideClutch: true, as: 'homeB' } },
          { spawn: { type: FOCUS, at: 'nestA', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { spawn: { type: FOCUS, at: 'nestB', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { adopt: { mama: { species: FOCUS, near: 'homeA', female: true }, papa: { species: FOCUS, near: 'homeA', female: false },
                     friendMama: { species: FOCUS, near: 'homeB', female: true }, friendPapa: { species: FOCUS, near: 'homeB', female: false } } },
          { lay: { species: FOCUS, at: 'homeA' } },
          { lay: { species: FOCUS, at: 'homeB' } },
          // (The two hens have this year's egg: their next is a year or two off, as any hen's.)
          (x) => { for (const n of ['mama', 'friendMama']) { const h = x.runner.castEnts[n]; if (h) h._nextClutchYear = 1 + Math.floor(random(2)); } },
          { place: { type: 'Storm', at: 'tops', standing: true } },
          { place: { type: 'Storm', at: 'lookout', standing: true } },
          { place: { type: 'waterhole', at: 'tarn', standing: true } },
          { eagle: { which: 'nearest', near: 'nestA', watch: 'lookout', hunger: 15 } },
          tally,
          { say: [
            ['guide', "The two families are home on the tops, an egg in each nest. From here the years go round, and the same birds live through them.", { lit: ['nests'] }],
            ['guide', "Herds are small and grow slowly: a hen lays one egg, and a chick takes three years to grow up. Tap any animal to see who it is and follow it.", { lit: [FOCUS] }],
            ['guide', "Storms, pātōtara and wharariki are what you have. Nothing here is safe from dying out, and the Pouākai must eat too.", { lit: ['haasts_eagle'] }]
          ] }
        ] },

      // ---- A new year: the count, then what the year brings ---------------------------------
      { id: 'new_year', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && x.runner.yearNow() > 1, once: false,
        do: [tally, { notify: ["Year {year} on the tops. Upland moa: {$clan}. Hatched last year: {$born}. Lost: {$lost}. Sent over the pass so far: {$sent}.", 'success'] }] },
      { id: 'kaka_come', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && x.runner.yearNow() >= D.kakaYear,
        do: [{ introduce: [{ type: 'kaka', count: 3 }] }],
        say: [['guide', "Kākā have come into the forest below. And a new tool: berries draw kea, so a BERRY CACHE set away from the nests draws them off.", { lit: ['kaka', 'kea'] }]] },
      { id: 'new_nests', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && x.runner.yearNow() >= D.nestYear,
        do: [{ nesting: { species: FOCUS, plant: 'speargrass' } }],
        say: [['guide', "The first chicks are nearly grown and will want nests of their own. Two SPEARGRASS patches close together, with upland moa near, found a new nest.", { lit: [FOCUS] }]] },
      { id: 'second_eagle', on: 'chapter_start',
        if: (x) => x.event && x.event.chapter === 'summer' && x.runner.yearNow() >= D.secondEagleYear &&
                   x.runner.sim.getMoaPopulation() >= D.secondEagleMoa && x.runner.sim.countAliveEagles() === 1,
        do: [{ mechanics: { eagleMaxPopulation: 2 } }, (x) => { x.runner.sim.spawnEagle(); }],
        notify: ["With so many moa on the land, a second Pouākai has come.", 'error'] },
      { id: 'hard_winter', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'autumn' && (x.game.coldIndex || 0) >= 0.35, once: false,
        notify: ["A hard winter is coming. Have wharariki growing before the snow.", 'error'] },

      // ---- The clan goal grows by twos -------------------------------------------------------
      { id: 'clan_grows', on: 'goal_met', if: (x) => x.event && /^clan_/.test(x.event.goal || ''), once: false,
        do: [(x) => { x.runner.vars.clanTarget = (x.runner.vars.clanTarget || D.clanStart) + D.clanStep; }] },
      { id: 'first_leaves', on: 'species_left',
        say: [['guide', "The clan is as big as these tops can feed. A grown young moa is setting off over the pass to found a family of its own. You raised it: that is the best this game has.", { lit: ['$moa'] }]] },
      { id: 'leaves', on: 'species_left', once: false,
        do: [{ reward: D.rewards.sent }, { notify: [`A grown young upland moa has set off over the pass. +${D.rewards.sent} mauri`, 'success'] }] },
      { id: 'new_nest', on: 'nest_founded', once: false,
        do: [{ reward: D.rewards.nest }], moment: { on: '$site', text: "A new nest on the tops" } },

      // ---- Hatchings: the two named chicks, then every chick after them -------------------------
      { id: 'hatch_pukepuke', on: 'egg_hatched', if: { near: ['$egg', 'homeA', 60], species: FOCUS },
        do: [{ adopt: { pukepuke: '$moa' } }], moment: { on: '$moa', text: "Pukepuke has hatched!" } },
      { id: 'hatch_koukou', on: 'egg_hatched', if: { near: ['$egg', 'homeB', 60], species: FOCUS },
        do: [{ adopt: { koukou: '$moa' } }], moment: { on: '$moa', text: "Koukou has hatched!" } },
      { id: 'chick', on: 'egg_hatched', if: (x) => x.event && x.event.moa && x.event.moa.speciesKey === FOCUS && !x.event.moa.castName, once: false,
        do: [(x) => { const m = x.event.moa.mother; x.runner.vars.mother = m ? callIt(x.runner, m) : 'the tops'; },
             { reward: D.rewards.chick }, { moment: { on: '$moa', text: "A chick for {$mother}" } }] },
      { id: 'herd_chick', on: 'egg_hatched', if: (x) => x.event && x.event.moa && x.event.moa.speciesKey !== FOCUS, once: false, cooldown: 20,
        notify: "A {species} chick has hatched." },
      { id: 'bird_chick', on: 'bird_hatched', once: false, cooldown: 30, notify: "A {species} has hatched." },

      // ---- The Pouākai. The first hunt of a family is prompted; after that the player is told
      //      who is hunted and left to it. --------------------------------------------------------
      { id: 'cover', on: 'eagle_hunting', if: { species: FOCUS },
        banner: { words: ["The Pouākai has seen an upland moa! Move a STORM over it", "Set the STORM down over the moa"],
                  until: coverUntil, lit: ['$target', '$eagle'], pause: false, maxSec: 20 } },
      { id: 'hunted', on: 'eagle_hunting', if: { species: FOCUS }, once: false, cooldown: 6,
        do: [(x) => { x.runner.vars.who = callIt(x.runner, x.event.target); }, { notify: ["The Pouākai is after {$who}.", 'error'] }] },
      { id: 'gave_up', on: 'eagle_gave_up',
        say: [['guide', "Hidden from it twice, the Pouākai has given the family up and gone after the {species}. It still has to eat.", { lit: ['$eagle'] }]] },
      { id: 'gave_up_again', on: 'eagle_gave_up', once: false, cooldown: 5,
        notify: ["The Pouākai has given up here and gone after the {species}.", 'success'] },
      { id: 'herd_taken', on: 'moa_killed', if: (x) => x.event && x.event.moa && x.event.moa.speciesKey !== FOCUS,
        say: [['guide', "The Pouākai took a {species}. It has to eat, and a fed eagle rests a long while.", { lit: ['$eagle'] }]] },
      { id: 'herd_taken_again', on: 'moa_killed', if: (x) => x.event && x.event.moa && x.event.moa.speciesKey !== FOCUS, once: false, cooldown: 10,
        notify: "The Pouākai took a {species}." },
      { id: 'upland_taken', on: 'moa_killed', if: (x) => x.event && x.event.moa && x.event.moa.speciesKey === FOCUS, once: false,
        do: [(x) => { x.runner.vars.who = callIt(x.runner, x.event.moa); }, { notify: ["The Pouākai took {$who}.", 'error'] }] },
      { id: 'bird_taken', on: 'bird_killed', once: false, cooldown: 10, notify: "The Pouākai took a {species}." },
      { id: 'hungry_eagle', when: { eagleHunger: ['>=', 38] }, once: false, cooldown: 60,
        notify: "The Pouākai is getting hungry. Who is out in the open?" },

      // ---- The kea and the nests -------------------------------------------------------------
      { id: 'raid_failed', on: 'nest_raid', if: { success: false }, once: false, cooldown: 20, notify: "The moa drove a kea off a nest." },
      { id: 'raid_won', on: 'nest_raid', if: { success: true }, once: false, cooldown: 10,
        notify: ["A kea took an egg. Moa gathered at a nest keep the kea off: sprout pātōtara beside it.", 'error'] },

      // ---- Needs, said once something has been wanted a while ----------------------------------
      { id: 'storm_gone', on: 'placeable_expired', if: { type: 'Storm' },
        banner: { words: ["A STORM has blown out! Call a new one from the toolbar", "Tap beside the moa to call the STORM"],
                  tool: 'Storm', until: { placed: 'Storm' }, lit: [FOCUS], pause: false, maxSec: 20 } },
      { id: 'storm_gone_again', on: 'placeable_expired', if: { type: 'Storm' }, once: false, cooldown: 60, notify: "A storm has blown out." },
      { id: 'winter_food', when: (x) => x.game.seasonManager.currentKey === 'winter' && !whararikiNear(x, 100) &&
                                      uplands(x).some(m => m.hunger > m.hungerThreshold + 15),
        for: 15, once: false, cooldown: 45,
        notify: ["The upland moa are going hungry: pātōtara is bare in winter. Grow WHARARIKI by them.", 'error'] },
      { id: 'starving', when: (x) => uplands(x).some(m => m.hunger > m.criticalHunger), for: 8, once: false, cooldown: 40,
        notify: ["An upland moa is starving. Tap plants near it to bring it to food, or grow food beside it.", 'error'] },
      { id: 'starved', on: 'cast_lost', if: { cast: NAMED, cause: ['starved', 'unknown'] }, once: false,
        do: [(x) => { x.runner.vars.who = (x.runner.castDefs[x.event.cast] || {}).title || 'An upland moa'; }, { notify: ["{$who} starved.", 'error'] }] },

      // ---- Newcomers, in place of floors --------------------------------------------------------
      { id: 'arrived', on: 'species_arrived', if: (x) => x.event && x.event.speciesKey !== 'haasts_eagle', once: false,
        notify: "{species} have come over the pass." },
      { id: 'eagle_back', on: 'species_arrived', if: (x) => x.event && x.event.speciesKey === 'haasts_eagle', once: false,
        notify: ["A new Pouākai has taken the empty sky.", 'error'] }
    ],

    // The run ends when the upland moa can't go on: none left, or no hen and no egg.
    lose: [
      { when: { extinct: 'focus' }, reason: "The upland moa are gone from the tops, in year {year}." },
      { when: (x) => { const u = uplands(x); return u.length > 0 && !u.some(m => m.isFemale) &&
                         !x.runner.sim.eggs.some(e => e.alive && !e.hatched && e.parentSpecies === FOCUS); },
        reason: "No upland hen is left on the tops, in year {year}." }
    ],

    goals: [],
    scoreFormula: (ctx) => Math.round((ctx.cyclesSurvived || 0) * 100 + ctx.moaCount * 10),

    menu: {
      title: "Endless; The Tops",
      subtitle: "Endless: The Tops",
      areaLabel: "Kahurangi uplands, Te Waipounamu",
      areaSubtitle: "Upper West Coast, South Island",
      featuredSpecies: { key: 'upland_moa', displayName: 'Upland Moa', localName: 'Moa Pukepuke', spriteKey: 'upland_walk_01', spriteScale: 0.4 },
      flavorText: [
        "The same families, year after year.", "",
        "Small herds that grow slowly,",
        "and a Pouākai that must eat too."
      ],
      displayPlants: ['patotara', 'wharariki', 'speargrass', 'tussock', 'beech'],
      art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
    },

    tutorial: { guideSprite: 'mantis_talk', tips: null }
  };
})();

LEVEL_REGISTRY.register(CHAPTERS_ENDLESS);
