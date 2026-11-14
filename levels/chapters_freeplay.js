// ============================================================================
// THE FIVE YEARS, ON THE CHAPTERS ENGINE (the emergent version of Pukepuke & Koukou)
// ============================================================================
// What this is. Five years on the tops after the two lessons. Two upland moa families each
// have a nest and an egg; the chicks that hatch from them are Pukepuke and Koukou, and the
// one task is to keep those two alive for five years. Around them lives the whole cast of the
// tops: kea, kākā and kōkako in the forest below, giant moa on the low ground, and one Haast's
// eagle that hunts whatever it can see when it is hungry. Every creature breeds in its own
// season, by its own calendar (kea in late winter, kākā and kōkako in spring, the giant moa one
// egg every few years), and the eagle takes birds as well as moa.
//
// What the player sees. Each year: summer at the nests, the autumn drift down to the water,
// winter by it, spring back up. The tools are the three learned already: storms as cover,
// pātōtara to sprout in the warm months, wharariki for winter. Prompts come only when something
// is wanted and has been left a while. When the fifth spring turns, the two are grown.
//
// What the simulation does on its own. Everything: the hunger and hunting of the eagle (birds
// and moa alike), the breeding of every species by its calendar, the kea's interest in berries
// and nests, the moa's feeding and drifting. The chapters only set the toolbar by the season,
// measure the year, and answer what happens. Nothing here moves an animal.
//
// What is guaranteed. Nothing, in either sketch, beyond the stage at the start (two nests, two
// eggs, the families beside them). The GUIDED sketch keeps a floor under each of the other
// species (so the eagle always has a herd to turn to), gives the eagle a longer wind-up, and
// pauses play for the first prompt of each kind; the OPEN sketch has no floors, a shorter
// wind-up, and a second eagle may hatch.
//
// How it is built. Four season chapters that cycle (spring goes back to summer) until the
// year count reaches six, then a finale chapter wins. The land is the two lessons'.
// ============================================================================

const CHAPTERS_FREEPLAY_FAMILY = 'chapters_freeplay';

const FREEPLAY_SKETCHES = {
  guided: { label: 'Guided', graceSec: 6,   floors: 2, eagleBreeding: false, pause: true,  eagleHungerRate: 0.012 },
  open:   { label: 'Open',   graceSec: 3.5, floors: 0, eagleBreeding: true,  pause: false, eagleHungerRate: 0.014 },
  // Clues: taught by clue first (levels/_chapters_kit.js), with no floors (newcomers come over
  // the pass instead) and the two families on the breeding calendar like everyone else, so
  // Pukepuke and Koukou are small in year one and grown by year four, and the lesson's claim
  // holds for the birds the player is watching.
  clues:  { label: 'Clues',  graceSec: 8,   floors: 0, eagleBreeding: false, pause: true,  eagleHungerRate: 0.012, clues: true },
  // Journey: the Clues sketch as tile 2f of the journey's map (mauri_campaign.js), told as the
  // first free play told it (levels/tutorial_module_freeplay.js). It is not a button under the
  // Chapters card. What differs, and only here:
  //   - Pukepuke and Koukou are not hatched again. They hatched on tiles 1 and 2, so they open
  //     these years as the half-grown birds they are: Pukepuke two years old, a cock bird, at
  //     Mama's side; Koukou a year old, a hen, at her mother's.
  //   - Te Whē opens with the free play's own words (the five winters, then the three parts of
  //     the screen: mauri, the goals and the season ring, the toolbox), says why the Pouākai's
  //     hunting is all right the first time it feeds, and closes the five years. The Pouākai
  //     keeps its one line, as the question rung of a hunt.
  //   - Mauri comes in from every bird on the land (mechanics.ecosystemIncome), as Te Whē says.
  //   - No moa courts its own parent, chick or sibling (mechanics.noKinPairing).
  //   - In the fifth year a nest of their own stands between the two families' nests, and
  //     Koukou's first clutch is due (her calendar is set so): the chick is "the baby". If no
  //     chick of hers is alive by the fifth spring an egg is set beside her (logged as forced).
  //   - The win writes the campaign record and offers the two ways on.
  journey: { label: 'Journey', graceSec: 8, floors: 0, eagleBreeding: false, pause: true, eagleHungerRate: 0.012, clues: true, journey: true }
};

// The Clues sketch's reactions: hint ladders for the eagle and the storms in place of the
// instructions, a word for an unprompted answer, the eagle giving up, and arrivals.
function freeplayCluesReactions(list, D) {
  const K = CHAPTERS_KIT;
  const kept = list.filter(r => !['cover', 'cover_again', 'storm_gone'].includes(r.id));
  return [
    ...(D && D.journey ? K.huntInVoice({ species: 'upland_moa', teach: false }) : [...K.coverLadder({ species: 'upland_moa' }), ...K.praise()]),
    ...K.stormLadder({ lit: ['pukepuke', 'koukou'], unlock: false }),
    ...K.gaveUp(),
    ...K.arrivals(),
    ...kept
  ];
}

const FREEPLAY_YEARS = 5;

function makeChaptersFreeplay(sketchKey) {
  const D = FREEPLAY_SKETCHES[sketchKey];
  const id = `${CHAPTERS_FREEPLAY_FAMILY}_${sketchKey}`;
  const coverUntil = { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] };
  const floors = D.floors ? { stout_legged_moa: D.floors, south_island_giant_moa: D.floors, kea: D.floors, kaka: D.floors, kokako: D.floors } : {};
  const seasonTools = { summer: ['patotara', 'Storm'], autumn: ['patotara', 'wharariki', 'Storm'], winter: ['wharariki', 'Storm'], spring: ['patotara', 'Storm'] };

  // The two young, whoever is left of them, within reach of a place.
  const youngNear = (place, dist) => ({ any: [{ near: ['pukepuke', place, dist] }, { near: ['koukou', place, dist] }] });

  // ---- The journey sketch's additions (D.journey; see FREEPLAY_SKETCHES) -------------------
  // Koukou's living chick under two years old, if she has one.
  const koukousChick = (x) => {
    const k = x.runner.castEnts.koukou;
    if (!k) return null;
    const young = x.runner.sim.moas.filter(m => m.alive && m.mother === k && m._calYears() != null && m._calYears() < 2);
    return young.sort((a, b) => a._calYears() - b._calYears())[0] || null;
  };
  const journeyParts = !D.journey ? {} : {
    section: 'journey', journey: true, sketch: undefined,
    name: "Pukepuke & Koukou: the five years",
    winText: "Pukepuke and Koukou are grown, and Koukou has a chick. Two ways lead on from here.",
    cast: {
      mama:       { title: "Mama Moa",        species: 'upland_moa', manual: true, pitch: 0.85 },
      papa:       { title: "Papa Moa",        species: 'upland_moa', manual: true },
      friendMama: { title: "Koukou's mother", species: 'upland_moa', manual: true, pitch: 0.95 },
      friendPapa: { title: "Koukou's father", species: 'upland_moa', manual: true, pitch: 1.1 },
      pukepuke:   { title: "Pukepuke",        species: 'upland_moa', manual: true },
      koukou:     { title: "Koukou",          species: 'upland_moa', manual: true },
      baby:       { title: "the baby",        species: 'upland_moa', manual: true, scale: 0.6 }
    },
    waysOn: [{ label: "West with Koukou", tile: 't3' }, { label: "North with Pukepuke", tile: 't5' }],
    sites: {
      nestA:   { find: 'high', near: { fx: 0.5, fy: 0.42 }, within: 240 },
      nestB:   { find: 'open', near: 'nestA', dist: [80, 130] },
      tops:    { near: 'nestA', dist: [60, 110] },
      lookout: { near: 'nestB', dist: [70, 130] },
      tarn:    { find: 'low', near: 'nestA', within: 560 },
      nestC:   { find: 'open', near: 'nestA', dist: [50, 95] }     // where the two young make their own nest, in year five
    },
    outcome: {
      birds: ['mama', 'papa', 'friendMama', 'friendPapa', 'pukepuke', 'koukou', 'baby'],
      also: (rec, r) => { rec.babyHatch = r.beatsDone.has('baby') ? ((r.log.some(l => l.kind === 'beat' && l.id === 'baby' && /forced/.test(l.info))) ? 'forced' : 'natural') : 'set down'; }
    }
  };
  // A half-grown bird of one of the families, set down beside its parents as the years open.
  const young = (name, at, years, female, mum, dad) => (x) => {
    const r = x.runner, before = r.sim.moas.length;
    r.spawn({ type: 'upland_moa', at, count: 1, age: 'juvenile', radius: 8, hunger: 25 });
    const e = r.sim.moas[before];
    if (!e) { r._log('issue', 'young', name); return; }
    e._bornTurn = -4 * years; e._bornYear = -years;
    e.isFemale = female;
    e.mother = r.castEnts[mum] || null; e.father = r.castEnts[dad] || null;
    e._nextClutchYear = FREEPLAY_YEARS - 1;     // (their first clutch is the fifth year's: see the dial's note)
    e.updateAge(0);
    r.castEnts[name] = e; e.castName = name;
    r._log('cast', name, `set down, ${years} years old`);
  };
  const sexes = [];

  return Object.assign({
    id,
    name: `Pukepuke & Koukou (${D.label})`,
    module: true,
    freePlay: true,
    section: 'chapters',
    sketch: { of: CHAPTERS_FREEPLAY_FAMILY, label: D.label, dial: D },
    claim: "Every creature breeds in its own season, and a hungry Pouākai takes whatever it can see.",
    teaches: D.clues ? ['breeding_seasons', 'eagle_takes_birds', 'slow_herds', 'over_the_pass'] : ['breeding_seasons', 'eagle_takes_birds'],
    guide: ['upland_moa', 'haasts_eagle', 'kea', 'kaka', 'kokako', 'south_island_giant_moa', 'predator_prey'],
    unlockCondition: null,

    zoom: 2.0,
    startSeason: 'summer',
    terrain: Object.assign({}, MODULE_STORMS.terrain, {
      plantDensity: 0.0078,
      elevationWindow: { lo: 0.22, hi: 0.70, pLo: 0.1, pHi: 0.9 }
    }),
    biomes: MODULE_STORMS.biomes,

    species: { moa: ['upland_moa', 'south_island_giant_moa'], eagle: ['haasts_eagle'], other: ['kea', 'kaka', 'kokako'] },
    startingSpecies: 'upland_moa',
    initialSpeciesDistribution: { south_island_giant_moa: 6 },
    initialEntityCounts: { moa: 6, eagle: 1, kea: 4, kaka: 4, kokako: 4 },

    economy: Object.assign({}, MODULE_STORMS.economy, {
      startingMauri: 120, seasonDuration: 2700, eggIncubationTime: 2400, eagleSpawnMilestones: [], maxPopulation: 60
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
      maxPerSpecies: 12,
      // Everyone breeds by its own calendar (the species files carry them).
      seasonalBirdBreeding: 'calendar',
      // Food and the kea, as the Pātōtara lesson.
      sproutPatotara: true, placedPlantsSeasonal: true,
      keaBerryLureRadius: 400, keaRaidsEggs: 'odds', keaRaidRadius: 95, keaRaidNutrition: 40, keaRaidCooldownSec: 6,
      keaRaid: { baseSuccess: 0.9, moaPenalty: 0.15, minSuccess: 0.05, moaRadius: 95 },
      flyerEdgeMargin: 14, stormFlushMult: 1.0,
      // One eagle (two in the open sketch, if it breeds), hunting birds too when hungry.
      emergentEagles: true, eagleMaxPopulation: D.eagleBreeding ? 2 : 1, eagleHungerRate: D.eagleHungerRate,
      eagleStarveThreshold: 88, eagleStarveTimeout: 7200, eagleTargetRatio: 1 / 5,
      eaglePreyPopThreshold: 1, eagleScarcePreyPenalty: 3, eagleSurplusPreference: true,
      eagleHuntsFlyers: true, eagleFlyerHungerGate: 50, eagleFlyerPreyPenalty: 1.3, eagleFlyerFeed: 60,
      eagleTelegraph: { graceSec: D.graceSec, warnBelow: 10 },
      coverBreaksLock: true, coverCalmsMoa: true, lureUnderStorm: true, placeableQueryRadius: 100,
      populationFloors: floors,
      birdPopulationFloor: D.floors,
      ...(D.clues ? Object.assign({
        rescueImmigration: { south_island_giant_moa: { below: 2, count: 2, afterSeasons: 3 }, kea: { below: 2, count: 2, afterSeasons: 3 },
                             kaka: { below: 2, count: 2, afterSeasons: 4 }, kokako: { below: 2, count: 2, afterSeasons: 4 } },
        eagleReturns: { afterSeasons: 2 },
        coverSendsEagleAway: { after: 2, sec: 45 } }, CHAPTERS_KIT.familyCalendar) : {}),
      nestingSites: { forestCount: 0, openCount: 0, radius: 40, laySnapRadius: 150, drawRadius: 260, layBoost: 0.5, eggSpeedBonus: 1.5 },
      habitatStress: true, habitatStressMargin: 0.08, habitatStressPenalty: 0.4, winterStressMult: 1.4,
      hungerRateMult: 0.6, juvenileHungerMult: 1.0,
      ...(D.journey ? { ecosystemIncome: { base: 0.08, perFocusAnimal: 0.015, perAnimal: 0.006 }, noEggLaidMauri: true,
                        noPopulationMilestones: true, noKinPairing: true } : {})
    },

    cast: {
      mama:       { title: "Mama Moa",   species: 'upland_moa', manual: true, pitch: 0.85 },
      papa:       { title: "Papa Moa",   species: 'upland_moa', manual: true },
      friendMama: { title: "The neighbour", species: 'upland_moa', manual: true, pitch: 0.9 },
      friendPapa: { title: "The neighbour", species: 'upland_moa', manual: true },
      pukepuke:   { title: "Pukepuke",   species: 'upland_moa', manual: true, scale: 0.6 },
      koukou:     { title: "Koukou",     species: 'upland_moa', manual: true, scale: 0.6 },
      ...(D.journey ? { baby: { title: "the baby", species: 'upland_moa', manual: true, scale: 0.6 } } : {})
    },

    sites: {
      nestA:   { find: 'high', near: { fx: 0.5, fy: 0.42 }, within: 240 },
      nestB:   { find: 'open', near: 'nestA', dist: [80, 130] },
      tops:    { near: 'nestA', dist: [60, 110] },
      lookout: { near: 'nestB', dist: [70, 130] },
      tarn:    { find: 'low', near: 'nestA', within: 560 }
    },

    chapters: [
      { id: 'summer', title: "Summer",
        tools: seasonTools.summer,
        focus: ['upland_moa'],
        start: [
          // Year one only: the stage. Two nests with an egg each, the families beside them.
          { flag: 'begun' },
          ...(D.journey ? [] : [{ say: [['guide', "Summer. Keep an eye on who is out in the open.", { lit: ['haasts_eagle'] }]] }])
        ],
        goals: [
          { id: 'summer_through', name: "Year {year}: through the summer", survive: true, reward: 10 }
        ],
        // (Not on the journey: there the two young hatched on tiles 1 and 2.)
        reactions: D.journey ? [] : [
          { id: 'hatch_pukepuke', on: 'egg_hatched', if: { near: ['$egg', 'homeA', 60] },
            do: [{ adopt: { pukepuke: '$moa' } }, ...sexes], moment: { on: '$moa', text: "Pukepuke has hatched!" } },
          { id: 'hatch_koukou', on: 'egg_hatched', if: { near: ['$egg', 'homeB', 60] },
            do: [{ adopt: { koukou: '$moa' } }, ...sexes], moment: { on: '$moa', text: "Koukou has hatched!" } }
        ]
      },
      { id: 'autumn', title: "Autumn",
        tools: seasonTools.autumn,
        start: [ { fade: { type: 'Storm', sec: 45, refreshOnMove: true } } ],
        goals: [
          { id: 'down', name: "Year {year}: the young down to the water", done: youngNear('tarn', 110), reward: 15 }
        ]
      },
      { id: 'winter', title: "Winter",
        tools: seasonTools.winter,
        start: [ { fade: { type: 'Storm', sec: 25, refreshOnMove: true } } ],
        reactions: [
          { id: 'winter_press', when: { seasonProgress: ['>=', 0.35] }, do: [{ eagle: { hunger: 50, watch: 'tarn' } }] }
        ],
        goals: [
          { id: 'fed', name: "Year {year}: wharariki by the young", done: { any: [{ near: ['wharariki', 'pukepuke', 90] }, { near: ['wharariki', 'koukou', 90] }] }, reward: 10 },
          { id: 'winter_through', name: "Year {year}: through the winter", survive: true, reward: 20 }
        ]
      },
      { id: 'spring', title: "Spring",
        tools: seasonTools.spring,
        goals: [
          { id: 'home', name: "Year {year}: the young home to the tops", done: youngNear('nestA', 160), reward: 15 }
        ],
        // Journey: the one guaranteed beat. By the fifth spring Koukou has a living chick. It
        // is invited by the simulation itself (she is of age from year four and lays in summer
        // if she is fed and Pukepuke is near); if none is alive twelve seconds into that spring
        // an egg is set down beside her, and the record says it was forced.
        ...(D.journey ? {
          beats: [{ id: 'baby', when: { year: ['>=', FREEPLAY_YEARS] },
            until: (x) => !!koukousChick(x), by: 12,
            force: [{ lay: { species: 'upland_moa', at: 'koukou', incubationSec: 14 } }, { notify: "Koukou has laid an egg." }] }],
          holdSeason: { until: (x) => x.runner.yearNow() < FREEPLAY_YEARS || !!koukousChick(x), at: 0.9, maxSec: 30 }
        } : {}),
        // Five years turned: the finale. Else round again.
        next: [[{ year: ['>=', FREEPLAY_YEARS + 1] }, 'finale'], [true, 'summer']]
      },
      { id: 'finale', title: "Five years on",
        start: [
          // Journey: Koukou's youngest living chick is the baby (set down beside her if the
          // egg did not make it: the story needs the baby, and the log says how it came).
          ...(D.journey ? [(x) => {
            const r = x.runner, c = koukousChick(x);
            if (c) { r.castEnts.baby = c; c.castName = 'baby'; r._log('cast', 'baby', 'adopted'); }
            else if (r.castEnts.koukou) { CHAPTERS_KIT.party([{ name: 'baby', years: 0.1, mother: 'koukou' }], 'koukou')(x); r._log('beat', 'baby', 'set down at the finale'); }
          }] : []),
          { moment: { on: 'pukepuke', text: "Grown up", sec: 3 } },
          ...(D.journey ? [{ say: [
            ['guide', "Five years have passed on the tops."],
            ['guide', "Pukepuke and Koukou are grown, and they've made a nest of their own.", { lit: ['pukepuke', 'koukou', 'nests'] }],
            ['guide', "And Koukou has a chick of her own.", { lit: ['baby', 'koukou'] }],                    // (new: the journey's baby)
            ['guide', "As long as there are kaitiaki to watch over them, the upland moa will go on in Kahurangi."]
          ] }] : [{ say: [['guide', "Five years have passed on the tops. Pukepuke and Koukou are grown.", { lit: ['pukepuke', 'koukou'] }],
                  ['guide', "As long as there are kaitiaki to watch over them, the upland moa will go on in Kahurangi."]] }]),
          { win: true }
        ],
        until: { after: 8 },
        next: 'win'
      }
    ],

    reactions: (D.clues ? ((list) => freeplayCluesReactions(list, D)) : (list) => list)([
      // The stage, once, as the level begins (a reaction so it runs after the level's own spawning).
      { id: 'stage', on: 'chapter_start', if: (x) => x.event && x.event.chapter === 'summer' && !x.runner.flags.staged,
        do: D.journey ? [
          { flag: 'staged' },
          { nest: { at: 'nestA', radius: 40, hideClutch: true, as: 'homeA' } },
          { nest: { at: 'nestB', radius: 40, hideClutch: true, as: 'homeB' } },
          { spawn: { type: 'upland_moa', at: 'nestA', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { spawn: { type: 'upland_moa', at: 'nestB', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { adopt: { mama: { species: 'upland_moa', near: 'homeA', female: true }, papa: { species: 'upland_moa', near: 'homeA', female: false },
                     friendMama: { species: 'upland_moa', near: 'homeB', female: true }, friendPapa: { species: 'upland_moa', near: 'homeB', female: false } } },
          // The two young, as tiles 1 and 2 left them: no eggs this year.
          young('pukepuke', 'nestA', 2, false, 'mama', 'papa'),
          young('koukou', 'nestB', 1, true, 'friendMama', 'friendPapa'),
          CHAPTERS_KIT.hensHaveLaid(['mama', 'friendMama']),
          { place: { type: 'Storm', at: 'tops', standing: true } },
          { place: { type: 'Storm', at: 'lookout', standing: true } },
          { place: { type: 'waterhole', at: 'tarn', standing: true } },
          { eagle: { which: 'nearest', near: 'nestA', watch: 'lookout', hunger: 25 } },
          // Te Whē's opening, as the first free play: the goal, then the three parts of the screen.
          { say: [
            ['guide', "Pukepuke and Koukou are still young, and need your protection.", { lit: ['pukepuke', 'koukou'] }],
            ['guide', "Keep them safe for five winters, and we can watch them grow up!", { lit: ['pukepuke', 'koukou'] }],
            ['guide', "", { title: "The Mauri level of the forest",
              content: ["Mauri is the spiritual energy of this ngahere.", "As well as Upland Moa, all birds on the land add to it. Use it to shape the forest."],
              highlight: { type: 'element', target: 'mauriDisplay' }, guidePosition: 'topLeft' }],
            ['guide', "", { title: "Goals & Information",
              content: ["Try to achieve your GOALs every season.", "Use the SEASON RING to prepare for what comes next!"],
              highlight: { type: 'element', target: 'goalsPanel' }, highlightAlt: { type: 'element', target: 'seasonDisplay' }, guidePosition: 'left' }],
            ['guide', "", { title: "You have a toolbox for shaping the ecosystem!",
              content: ["Mauri can become pātōtara, wharariki and storms.", "Select a tool, then a spot in the world to place it."],
              highlight: { type: 'element', target: 'toolbar' }, guidePosition: 'bottomLeft' }]
          ] }
        ] : [
          { flag: 'staged' },
          { nest: { at: 'nestA', radius: 40, hideClutch: true, as: 'homeA' } },
          { nest: { at: 'nestB', radius: 40, hideClutch: true, as: 'homeB' } },
          { spawn: { type: 'upland_moa', at: 'nestA', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { spawn: { type: 'upland_moa', at: 'nestB', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { adopt: { mama: { species: 'upland_moa', near: 'homeA', female: true }, papa: { species: 'upland_moa', near: 'homeA', female: false },
                     friendMama: { species: 'upland_moa', near: 'homeB', female: true }, friendPapa: { species: 'upland_moa', near: 'homeB', female: false } } },
          { lay: { species: 'upland_moa', at: 'homeA' } },
          { lay: { species: 'upland_moa', at: 'homeB' } },
          ...(D.clues ? [CHAPTERS_KIT.hensHaveLaid(['mama', 'friendMama'])] : []),
          { place: { type: 'Storm', at: 'tops', standing: true } },
          { place: { type: 'Storm', at: 'lookout', standing: true } },
          { place: { type: 'waterhole', at: 'tarn', standing: true } },
          { eagle: { which: 'nearest', near: 'nestA', watch: 'lookout', hunger: 25 } },
          { say: [
            ['guide', "Two families of upland moa, two nests, two eggs. The chicks that hatch are Pukepuke and Koukou: keep them alive five years.", { lit: ['nests'] }],
            ['guide', "Kea, kākā and kōkako live in the forest below, giant moa on the flats. Each breeds in its own season.", { lit: ['kea', 'kaka', 'kokako', 'south_island_giant_moa'] }],
            ['guide', "The Pouākai takes whatever it can see, bird or moa. Your storms, pātōtara and wharariki are what you have.", { lit: ['haasts_eagle'] }]
          ] }
        ] },
      // Journey, the fifth summer: a nest of their own stands between the families' nests.
      ...(D.journey ? [{ id: 'own_nest', on: 'chapter_start', if: (x) => !!x.event && x.event.chapter === 'summer' && x.runner.yearNow() === FREEPLAY_YEARS,
        // (The two move in beside it: the invitation to their first clutch.)
        do: [{ nest: { at: 'nestC', radius: 40, hideClutch: true, as: 'homeC' } }, CHAPTERS_KIT.headFor(['pukepuke', 'koukou'], 'nestC')],
        moment: { on: 'nestC', text: "A nest of their own" } }] : []),
      // A new year.
      { id: 'new_year', on: 'season_change', if: (x) => x.event && x.event.seasonKey === 'summer', once: false,
        notify: ["Year {year} begins on the tops.", 'success'] },
      // The eagle: cover the hunted; the first time paused in the guided sketch.
      { id: 'cover', on: 'eagle_hunting', if: { species: 'upland_moa' },
        banner: { words: ["The Pouākai has seen {species}! Move a STORM over it", "Set the STORM down over the moa"],
                  until: coverUntil, lit: ['$target', '$eagle'], pause: D.pause, maxSec: 25 } },
      { id: 'cover_again', on: 'eagle_hunting', if: { species: 'upland_moa' }, once: false, cooldown: 12,
        banner: { words: ["The Pouākai is after the moa! Cover the hunted one with a STORM", "Set the STORM down over the moa"],
                  until: coverUntil, lit: ['$target', '$eagle'], pause: false, maxSec: 20 } },
      { id: 'bird_hunted', on: 'eagle_hunting', if: { species: ['kea', 'kaka', 'kokako'] }, once: false, cooldown: 30,
        notify: "The Pouākai is after a {species}." },
      { id: 'bird_taken', on: 'bird_killed', once: false, cooldown: 10,
        notify: ["The Pouākai took a {species}.", 'error'] },
      { id: 'giant_taken', on: 'moa_killed', if: { species: 'south_island_giant_moa' },
        say: D.journey ? [
          ['guide', "Haast's eagle evolved alongside the moa. As predator and prey, they keep each other in balance.", { lit: ['haasts_eagle'] }],
          ['guide', "So it's good for the ngahere that the Pouākai hunts. But Pukepuke and Koukou's families are yours to keep safe!", { lit: ['pukepuke', 'koukou'] }]
        ] : [['guide', "The Pouākai took a giant moa: a meal to last it a while.", { lit: ['south_island_giant_moa'] }]] },
      { id: 'taken_again', on: 'moa_killed', if: { species: 'south_island_giant_moa' }, once: false, cooldown: 40,
        notify: "The Pouākai fed on the giant moa." },
      { id: 'hungry_eagle', when: { eagleHunger: ['>=', 38] }, once: false, cooldown: 45,
        notify: "The Pouākai is getting hungry. Who is out in the open?" },
      // The birds' year: the first hatch of each kind is a moment; later ones a word.
      { id: 'first_kea', on: 'bird_hatched', if: { species: 'kea' }, moment: { on: '$bird', text: "Kea chicks: late winter" } },
      { id: 'first_kaka', on: 'bird_hatched', if: { species: 'kaka' }, moment: { on: '$bird', text: "Kākā chicks: spring" } },
      { id: 'first_kokako', on: 'bird_hatched', if: { species: 'kokako' }, moment: { on: '$bird', text: "A kōkako chick: spring" } },
      { id: 'first_giant', on: 'egg_hatched', if: { species: 'south_island_giant_moa' }, moment: { on: '$moa', text: "A giant moa chick" } },
      { id: 'bird_hatch_again', on: 'bird_hatched', once: false, cooldown: 20, notify: "A {species} has hatched." },
      // The kea and the nests.
      { id: 'raid_failed', on: 'nest_raid', if: { success: false }, once: false, cooldown: 20, notify: "The moa drove a kea off a nest." },
      { id: 'raid_won', on: 'nest_raid', if: { success: true }, once: false, cooldown: 20, notify: ["A kea took an egg from a nest.", 'error'] },
      // Needs, with patience: a storm blown out, food in winter, a bare patch in the warm months.
      { id: 'storm_gone', on: 'placeable_expired', if: { type: 'Storm' }, once: false, cooldown: 40,
        banner: { words: ["A STORM has blown out! Call a new one over the families", "Tap beside the moa to call the STORM"],
                  tool: 'Storm', until: { placed: 'Storm' }, lit: ['pukepuke', 'koukou'], pause: false, maxSec: 20 } },
      { id: 'winter_food', when: { all: [{ season: 'winter' }, { not: { any: [{ near: ['wharariki', 'pukepuke', 90] }, { near: ['wharariki', 'koukou', 90] }] } }] },
        for: 20, once: false, cooldown: 45,
        notify: ["The pātōtara is bare in winter. Grow WHARARIKI by the young so they can feed.", 'error'] },
      // Losses: the two young are the stake; everyone else is a line.
      { id: 'pukepuke_lost', on: 'cast_lost', if: { cast: 'pukepuke', cause: 'eagle' }, do: [{ lose: "The Pouākai took Pukepuke." }] },
      { id: 'pukepuke_starved', on: 'cast_lost', if: { cast: 'pukepuke', cause: ['starved', 'unknown'] }, do: [{ lose: "Pukepuke starved. Keep food growing by the families: pātōtara in the warm months, wharariki in winter." }] },
      { id: 'koukou_lost', on: 'cast_lost', if: { cast: 'koukou', cause: 'eagle' }, do: [{ lose: "The Pouākai took Koukou." }] },
      { id: 'koukou_starved', on: 'cast_lost', if: { cast: 'koukou', cause: ['starved', 'unknown'] }, do: [{ lose: "Koukou starved. Keep food growing by the families: pātōtara in the warm months, wharariki in winter." }] },
      { id: 'grown_taken', on: 'cast_lost', if: { cast: ['mama', 'papa', 'friendMama', 'friendPapa'], cause: 'eagle' }, once: false,
        notify: ["The Pouākai took one of the grown moa.", 'error'] },
      { id: 'grown_starved', on: 'cast_lost', if: { cast: ['mama', 'papa', 'friendMama', 'friendPapa'], cause: ['starved', 'unknown'] }, once: false,
        notify: ["One of the grown moa starved. Tap plants near the families to bring them to food.", 'error'] }
    ]),

    lose: [{ when: { extinct: 'focus' }, reason: "The upland moa are gone from the tops." }],

    winTitle: "GROWN UP",
    winText: "Pukepuke and Koukou are grown, five years on.",

    goals: [],
    scoreFormula: (ctx) => Math.round(ctx.moaCount * 40 + ctx.totalEarned * 0.2 + (ctx.goalsCompleted || 0) * 30),

    menu: {
      title: `Pukepuke & Koukou (${D.label})`,
      subtitle: "Chapters: the five years",
      moduleLabel: "Five years",
      focusItem: { placeable: 'wharariki', name: "Wharariki" },
      areaLabel: "Kahurangi uplands, Te Waipounamu",
      areaSubtitle: "Upper West Coast, South Island",
      featuredSpecies: { key: 'upland_moa', displayName: 'Upland Moa', localName: 'Moa Pukepuke', spriteKey: 'upland_walk_01', spriteScale: 0.4 },
      flavorText: [
        "Five years on the tops, with the whole cast.", "",
        "Every creature breeds in its own season;",
        "the Pouākai takes whatever it can see."
      ],
      displayPlants: ['patotara', 'wharariki', 'tussock', 'beech'],
      art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
    },

    tutorial: { guideSprite: 'mantis_talk', tips: null }
  }, journeyParts);
}

for (const key of Object.keys(FREEPLAY_SKETCHES)) LEVEL_REGISTRY.register(makeChaptersFreeplay(key));
LEVEL_REGISTRY.registerFamily(CHAPTERS_FREEPLAY_FAMILY, { label: "Five years", defaultSketch: 'chapters_freeplay_guided' });
