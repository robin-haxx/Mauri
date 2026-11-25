// ============================================================================
// THE LESSON KIT: pieces the chapters lessons share
// ============================================================================
// A lesson is a stage, some words and some checks over the open simulation. Several of those
// pieces are the same from lesson to lesson: what to say when the Pouākai locks onto a moa,
// what to say when a storm blows out, how the unprompted stretch at the end is set up. They
// live here once, as small functions that return reactions or a chapter, so a new lesson (or
// a slice for a client) lists them instead of copying them, and a change to the words is made
// in one place.
//
// The kit teaches BY CLUE FIRST. Its prompts are hint ladders (see ChapterRunner._updateCases):
// when the simulation raises a problem nothing is said at first, because what the player can
// see is the clue (the eagle's "!" and its amber hunger bar; the storm thinning). If the
// problem is still there a few seconds on, a question is asked. Only after that is the player
// told what to do. The record keeps the rung at which the player acted.
//
// The "Clues" sketch of each lesson is built from this kit. The Guided and Open sketches are
// older and keep their own copies, unchanged, so the three can be played side by side.
// ============================================================================

const CHAPTERS_KIT = {
  // The four seasons of a lesson's year (a reaction scoped to these stays quiet in the
  // unprompted stretch that follows them).
  YEAR: ['summer', 'autumn', 'winter', 'spring'],

  // What to call a bird in a line: its cast title, else "a chick" or its kind.
  who(runner, e) {
    if (!e) return 'a moa';
    if (e.castName && runner.castDefs[e.castName]) return runner.castDefs[e.castName].title;
    const kind = (runner._name(e.speciesKey) || 'moa').toLowerCase();
    return (e.isJuvenile && e.isJuvenile()) ? `a ${kind} chick` : `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`;
  },

  // A hunt is over when its bird is hidden, dead, or no longer hunted...
  coverUntil: { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] },
  // ...and it was the player's answer if the bird is hidden and the player set a storm down
  // (placed or moved) since the hunt began.
  coverSolved: { all: [{ hidden: '$target' }, { any: [{ placed: 'Storm' }, { gained: ['moved:Storm', '>=', 1] }] }] },
  // ...and it was lost if the bird is dead.
  coverLost: { not: { alive: '$target' } },

  // ---- The Pouākai has locked onto a focus moa ------------------------------------------
  // Two reactions. The first hunt of the lesson climbs the ladder quickly and its last rung
  // stops play, so nobody loses a bird to not knowing the rule. Every later hunt climbs it
  // slowly and never stops play. Timings are seconds into the eagle's wind-up, so they should
  // sit inside the level's eagleTelegraph.graceSec (8 s suits these defaults).
  //   species      the focus species the ladder is for
  //   first        [question, instruction] seconds for the first hunt
  //   later        [question, instruction] seconds for later hunts
  //   pauseFirst   whether the first hunt's instruction stops play
  coverLadder({ species = 'upland_moa', first = [2, 5], later = [4, 7], pauseFirst = true } = {}) {
    const K = CHAPTERS_KIT;
    const name = (x) => { x.runner.vars.who = K.who(x.runner, x.event && x.event.target); };
    const isHunt = (x) => !!(x.event && x.event.target && x.event.target.speciesKey === species);
    return [
      { id: 'cover', on: 'eagle_hunting', if: isHunt,
        do: [(x) => { x.runner.vars._firstHunt = x.event; }],
        until: K.coverUntil, solved: K.coverSolved, lost: K.coverLost,
        hints: [
          { after: first[0], do: [name, { notify: ["The Pouākai has seen {$who}. It can only take what it can see. What could hide {$who}?", 'error'] }] },
          { after: first[1], banner: { words: ["Move a STORM over the hunted moa", "Set the STORM down over the moa"],
                                       lit: ['$target', '$eagle'], pause: pauseFirst, maxSec: 25, needs: 'move' } }
        ] },
      { id: 'cover_again', on: 'eagle_hunting', once: false,
        // (every hunt but the one the first reaction took)
        if: (x) => isHunt(x) && !!x.runner.vars._firstHunt && x.runner.vars._firstHunt !== x.event,
        until: K.coverUntil, solved: K.coverSolved, lost: K.coverLost,
        hints: [
          { after: later[0], do: [name, { notify: ["The Pouākai is watching {$who}.", 'error'] }] },
          { after: later[1], banner: { words: ["Cover the hunted moa with a STORM", "Set the STORM down over the moa"],
                                       lit: ['$target', '$eagle'], pause: false, maxSec: 20, needs: 'move' } }
        ] }
    ];
  },

  // A word when the player answered a problem before any hint was said: it names what they
  // did, which is the lesson's rule in their own action.
  praise({ chapters = null } = {}) {
    return [
      { id: 'saw_it_coming', on: 'case_closed', once: false, cooldown: 20, chapters,
        if: (x) => x.event && /^cover/.test(x.event.case || '') && x.event.outcome === 'solved' && x.event.rung === 0,
        notify: ["Hidden in time, with no hint. The Pouākai can't take what it can't see.", 'success'] }
    ];
  },

  // ---- A storm has blown out --------------------------------------------------------------
  // The first time, the Storm tool unlocks (where the lesson had it locked). A while later a
  // notice, and later still the instruction.
  stormLadder({ lit = [], unlock = true, notice = 6, tell = 14, chapters = null } = {}) {
    return [
      Object.assign({ id: 'storm_gone', on: 'placeable_expired', if: { type: 'Storm' }, once: false, cooldown: 25, chapters,
        until: { any: [{ placed: 'Storm' }, { gained: ['moved:Storm', '>=', 1] }, { after: 45 }] },
        solved: { any: [{ placed: 'Storm' }, { gained: ['moved:Storm', '>=', 1] }] },
        hints: [
          { after: notice, notify: "A storm has blown out." },
          { after: tell, banner: { words: ["Tap the STORM button and call a new one", "Tap beside the family to call the STORM"],
                                   tool: 'Storm', lit, pause: false, maxSec: 20 } }
        ] }, unlock ? { unlock: 'Storm' } : {})
    ];
  },

  // ---- Hidden twice, the eagle goes for the herd (mechanics.coverSendsEagleAway) ----------
  // (words: false says the first one as a message too, not in Te Whē's voice: 2f.)
  gaveUp({ words = true } = {}) {
    return [
      words ? { id: 'gave_up', on: 'eagle_gave_up',
        say: [['guide', "Hidden from it twice, the Pouākai has given the family up and gone after the {species}. It still has to eat.", { lit: ['$eagle'] }]] }
            : { id: 'gave_up', on: 'eagle_gave_up',
        notify: ["Hidden from it twice, the Pouākai has given up on the family and gone after the {species}.", 'success'] },
      { id: 'gave_up_again', on: 'eagle_gave_up', once: false, cooldown: 5,
        notify: ["The Pouākai has given up here and gone after the {species}.", 'success'] }
    ];
  },

  // ---- Newcomers over the pass, in place of floors (mechanics.rescueImmigration) ----------
  arrivals() {
    return [
      { id: 'arrived', on: 'species_arrived', if: (x) => x.event && x.event.speciesKey !== 'haasts_eagle', once: false,
        notify: "{species} have come over the pass." }
    ];
  },

  // ---- The unprompted stretch: one more season, the same rule, nobody telling ---------------
  // A chapter marked `transfer`: the runner says no hint in it, and its cases are recorded
  // apart. The eagle is made hungry over `at` as it opens and again part-way through, so
  // there is something to answer. It ends after a season, or sooner once `cases` problems
  // have been met.
  //   id, title    the chapter
  //   tools        the toolbar
  //   at           where the eagle is brought (a site or a cast name)
  //   words        the line that opens it
  //   fadeSec      the storms already standing blow out within this many seconds (0: they stay)
  //   start, goals, reactions   anything the lesson adds
  transferChapter({ id = 'transfer', title = "One more summer, on your own", tools = ['Storm'], at = 'home', cases = 2, fadeSec = 15,
                    words = "One more summer on the tops. This time nobody will tell you what to do.",
                    start = [], goals = [], reactions = [], next = 'win' } = {}) {
    return {
      id, title, transfer: true, tools,
      start: [
        { say: [['guide', words]] },
        ...start,
        // (The storms standing over the family thin out, so the family is in the open when the
        // eagle comes: moving one freshens it, as in autumn.)
        ...(fadeSec ? [{ fade: { type: 'Storm', sec: fadeSec, refreshOnMove: true } }] : []),
        { eagle: { which: 'nearest', near: at, watch: at, hunger: 42 } }
      ],
      reactions: [
        { id: `${id}_press`, when: { after: 22 }, do: [{ eagle: { which: 'nearest', near: at, watch: at, hunger: 47 } }] },
        ...reactions
      ],
      goals: [
        { id: `${id}_own`, name: "Deal with a danger before any hint", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 },
        ...goals
      ],
      until: { any: [{ seasons: 1 }, { all: [{ gained: ['cases', '>=', cases] }, { after: 30 }] }] },
      next
    };
  },

  // The family on the breeding calendar, for a Clues sketch's `mechanics`: every moa lays in
  // its own season and a chick stays small, and beside its mother, for its first years.
  familyCalendar: { seasonalBirdBreeding: 'calendar', moaCalendar: true, familyLinks: true,
                    juvenileFollow: { within: 50, untilYears: 2, pull: 0.6 } },

  // A start action: these hens have this year's egg already (the stage laid it), so their next
  // is a year or two off, as any hen's on the calendar.
  hensHaveLaid(names) {
    return (x) => { for (const n of names) { const h = x.runner.castEnts[n]; if (h) h._nextClutchYear = 1 + Math.floor(random(2)); } };
  },

  // Scope the named reactions to the lesson's year, so they stay quiet in the unprompted stretch.
  quietAfterYear(reactions, ids) {
    return reactions.map(r => ids.includes(r.id) ? Object.assign({}, r, { chapters: CHAPTERS_KIT.YEAR }) : r);
  }
};

// ============================================================================
// THE JOURNEY'S PIECES (CAMPAIGN_PLAN.md, section 7.5)
// ============================================================================
// The journey's lessons and free plays (levels/journey_*.js) share more than the hint ladders:
// a named party that is set down from the campaign record and walks on and off the land, a
// riddle told as a ladder, the four seasons that every free play cycles through, "won after N
// years if", and what is said when a lead or an elder is lost. They are added here so eight
// level files do not repeat each other. Nothing above this line is changed by them.
// ============================================================================
Object.assign(CHAPTERS_KIT, {
  // ---- The travelling party ------------------------------------------------------------------
  // A start action: set down the named birds at a place, those of them the campaign record
  // says are alive (mauri_campaign.js). Each is { name, female, years, mother }: `years` is its
  // age on the breeding calendar (left out: a grown founder), `mother` the cast name of the
  // hen it follows while it is small. They are real birds of the simulation from here on.
  //   walkTo   a site further in: their home range is set there, so they walk on from the edge
  party(list, at, { radius = 14, hunger = 30, walkTo = null, species = 'upland_moa' } = {}) {
    return (x) => {
      // (`at` can list fallbacks: the first place that is found on this land.)
      const r = x.runner, sim = r.sim, c = [].concat(at).map(a => r.point(a)).find(Boolean), home = walkTo ? r.point(walkTo) : null;
      if (!c) { r._log('issue', 'party', `no place "${at}"`); return; }
      const turns = sim.seasonTurns || 0;
      for (const s of list) {
        // (The record says who is still walking; a bird born on this tile, `newborn`, is not in it yet.)
        if (!s.newborn && r.level.journey && typeof CAMPAIGN !== 'undefined' && !CAMPAIGN.alive(s.name)) { r._log('party', s.name, 'not with them'); continue; }
        const p = r._walkableNear({ x: c.x + random(-radius, radius), y: c.y + random(-radius, radius) }, 120, c) || c;
        const e = sim._createFromRegistry('moa', s.species || species, p.x, p.y, Moa);
        if (!e) continue;
        if (s.female != null) e.isFemale = !!s.female;
        e.hunger = hunger;
        e._sim = sim;
        if (s.years != null) { e._bornTurn = turns - s.years * 4; e._bornYear = Math.floor(turns / 4) - Math.floor(s.years); }
        e.age = (s.years != null && s.years < 1) ? Math.round(MOA_AGE.JUVENILE_MAX * 0.5) : MOA_AGE.ADULT_MIN + 1;
        e.updateAge(0);
        if (e.homeRange) e.homeRange.set(home ? home.x : p.x, home ? home.y : p.y);
        sim.moas.push(e);
        r.castEnts[s.name] = e;
        e.castName = s.name;
        r._log('party', s.name, 'set down');
      }
      // (Mothers second, once every bird is on the land.)
      for (const s of list) {
        const e = r.castEnts[s.name], m = s.mother && r.castEnts[s.mother];
        if (e && m) { e.mother = m; m.offspring = (m.offspring || 0) + 1; }
      }
      sim._invalidateCache();
    };
  },

  // A start action: the named birds (those alive) set off for an edge of the land and walk off
  // it (Moa.beginLeaving, as a grown young bird leaving over the pass). The runner notes them as
  // walked, not lost. The level should be won within a few seconds, while they are on their way.
  walkOff(names, side) {
    return (x) => {
      const r = x.runner;
      for (const n of names) {
        const e = r.castEnts[n];
        if (!e || !e.alive) continue;
        const edge = r._findSite({ find: 'edge', side, near: n }) || x.game._nearestEdge(e.pos.x, e.pos.y);
        if (edge) e.beginLeaving(edge.x, edge.y);
      }
      r._log('walk_off', names.join(','), side);
    };
  },

  // ---- Taken by the Pouākai (a story moment, outside play) ---------------------------------------
  // A start action: the Pouākai nearest the named bird stoops on it and carries it off over the
  // nearest of `sides` (HaastsEagle.carryOff). The bird leaves the land alive; the runner notes
  // it as taken, not lost, and the record keeps it so (CAMPAIGN.finish). Never a hunt: no cover
  // stops it, so it belongs only where play has stopped (the end of 2f). With no eagle on the
  // land the bird is simply gone, logged.
  carryOff(name, { sides = ['north', 'west'], sec = 30 } = {}) {
    return (x) => {
      const r = x.runner, e = r.castEnts[name];
      if (!e || !e.alive) { r._log('issue', 'carry_off', `${name} is not on the land`); return; }
      const d = (b) => Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y);
      const eagle = (r.sim.eagles || []).filter(b => b.alive && b.carryOff).sort((a, b) => d(a) - d(b))[0];
      if (eagle && eagle.carryOff(e, { sides, sec })) { r._log('carry_off', name, 'the Pouākai stoops'); return; }
      e.alive = false; e.causeOfDeath = 'carried';
      r._log('carry_off', name, 'no eagle: gone');
    };
  },

  // A check (an `until`): the named bird has been carried off.
  isTaken(name) { return (x) => !!(x.runner.taken && x.runner.taken[name]); },

  // A start action, the fallback after carryOff: if the bird is somehow still here, it is gone
  // now, carried (logged as forced).
  makeTaken(name) {
    return (x) => {
      const r = x.runner, e = r.castEnts[name];
      if ((r.taken && r.taken[name]) || !e || !e.alive) return;
      e._carriedBy = null; e.alive = false; e.causeOfDeath = 'carried';
      r._log('beat', 'carry_off', 'forced');
    };
  },

  // ---- The west path's party (FULLGAMESCRIPT: Koukou's tribe) -------------------------------------
  // Who walks west with Koukou after 2f. As 2f's ending tells it (23 November): Koukou sends her
  // own mother and father south, home to their safe nest, and Mama Moa ("Lead our tribe with
  // strength, Kou!") and Papa follow her west with the rest of the tribe. To send Koukou's
  // parents west instead, put 'friendMama', 'friendPapa' here (CAMPAIGN_PLAN.md section 14,
  // decision 18). The unnamed upland moa who followed her are counted in the record (rec.tribe)
  // and set down beside the party (westParty).
  WEST: ['koukou', 'mama', 'papa'],
  _WEST_BIRDS: {
    koukou:     { title: "Koukou",          female: true,  pitch: 0.9 },
    friendMama: { title: "Koukou's mother", female: true,  pitch: 0.95 },
    friendPapa: { title: "Koukou's father", female: false, pitch: 1.1 },
    mama:       { title: "Mama",            female: true,  pitch: 0.85 },
    papa:       { title: "Papa",            female: false }
  },
  // The cast entries for the west party, to spread into a level's `cast`.
  westCast() {
    const out = {};
    for (const n of this.WEST) {
      const b = this._WEST_BIRDS[n];
      out[n] = Object.assign({ title: b.title, species: 'upland_moa', manual: true }, b.pitch ? { pitch: b.pitch } : {});
    }
    return out;
  },
  // A start action: the west party set down at `at` (CAMPAIGN.alive decides who is still walking).
  westParty(at, opts = {}) {
    const named = this.party(this.WEST.map(n => ({ name: n, female: this._WEST_BIRDS[n].female })), at, opts);
    return (x) => {
      named(x);
      // The rest of the tribe: upland moa who followed Koukou west at the end of 2f (at most four).
      const r = x.runner, n = Math.min(4, (r.level.journey && r.record && r.record.tribe) || 0);
      if (n) r.spawn({ type: 'upland_moa', at, count: n, sexes: 'pair', radius: (opts.radius || 14) + 10, hunger: opts.hunger ?? 30 });
    };
  },
  // The party's elders, as elderLost wants them: { castName: "Title" }.
  westElders() {
    const out = {};
    for (const n of this.WEST) if (n !== 'koukou') out[n] = this._WEST_BIRDS[n].title;
    return out;
  },

  // ---- A riddle, as a hint ladder ----------------------------------------------------------------
  // The riddle is said when the reaction fires and is the first rung: a player who answers from
  // the riddle and the world alone is recorded as unaided. A plainer line comes later, then the
  // instruction. The record keeps the rung at which the player acted.
  //   speaker       who sets it (a cast name or 'guide')
  //   riddle        its lines ([text, ...])
  //   plainer, tell the second and third rungs (a line each); at: their seconds
  //   until, solved what ends the case, and what counts as the player's answer
  riddleLadder({ id = 'riddle', on = 'chapter_start', test = null, speaker = 'guide', riddle = [], plainer, tell, at = [45, 95],
                 until, solved, lit = [], tool = null, staleSec = 400, chapters = null } = {}) {
    return [{
      id, on, if: test, chapters, staleSec,
      say: riddle.map(t => [speaker, t, { lit }]),
      until, solved,
      hints: [
        { after: at[0], say: [[speaker, plainer, { lit }]] },
        { after: at[1], banner: Object.assign({ words: [].concat(tell), lit, pause: false, maxSec: 30 }, tool ? { tool } : {}) }
      ]
    }];
  },

  // ---- The four seasons a free play cycles through -------------------------------------------------
  // by: { summer, autumn, winter, spring }, each a chapter's own keys (tools, start, goals,
  // reactions). Spring goes back to summer until `years` have turned, then on to `then`.
  seasonsCycle(by, { years, then = 'finale', titles = {} } = {}) {
    return CHAPTERS_KIT.YEAR.map(key => Object.assign({ id: key, title: titles[key] || key.charAt(0).toUpperCase() + key.slice(1) },
      by[key] || {}, key === 'spring' ? { next: [[{ year: ['>=', years + 1] }, then], [true, 'summer']] } : {}));
  },

  // The closing chapter of a free play: won if `ok` holds as the last year turns, else lost
  // with `reason`. `words` are said first; `before` runs before them (the walk off the land).
  wonAfterYears({ id = 'finale', title = "The years have turned", ok = () => true, reason = "The years ran out.", words = [], before = [], lit = [] } = {}) {
    return {
      id, title,
      start: [
        (x) => { if (!ok(x)) x.runner.lose(x.runner.fill(typeof reason === 'function' ? reason(x) : reason, null)); },
        ...(words.length ? [{ say: words.map(t => ['guide', t, { lit }]) }] : []),
        ...before
      ],
      until: { after: 5 },
      next: 'win'
    };
  },

  // ---- Leads and elders ----------------------------------------------------------------------------
  // A lead lost ends the level, with words for how. names: { castName: "Title" }.
  leadLost(names, { starved = "Food close by is what keeps a family: tap plants near them, or grow some beside them." } = {}) {
    const out = [];
    for (const n in names) {
      out.push({ id: `${n}_taken`, on: 'cast_lost', if: { cast: n, cause: 'eagle' }, do: [{ lose: `The Pouākai took ${names[n]}.` }] });
      out.push({ id: `${n}_starved`, on: 'cast_lost', if: { cast: n, cause: ['starved', 'unknown'] }, do: [{ lose: `${names[n]} starved. ${starved}` }] });
    }
    return out;
  },
  // An elder lost is not the end: the story goes on without them, and the record keeps it.
  elderLost(names) {
    const title = (x) => { x.runner.vars.who = names[x.event.cast] || 'One of the family'; };
    return [
      { id: 'elder_taken', on: 'cast_lost', if: { cast: Object.keys(names), cause: 'eagle' }, once: false,
        do: [title, { notify: ["The Pouākai took {$who}. The family goes on without them.", 'error'] }] },
      { id: 'elder_starved', on: 'cast_lost', if: { cast: Object.keys(names), cause: ['starved', 'unknown'] }, once: false,
        do: [title, { notify: ["{$who} starved. The family goes on without them.", 'error'] }] }
    ];
  },

  // Scope the named reactions to the chapters in which hints are given (the taught seasons),
  // so they stay quiet in the unprompted season that ends a journey lesson.
  quietOutside(reactions, ids, chapters) {
    return reactions.map(r => ids.includes(r.id) ? Object.assign({}, r, { chapters }) : r);
  },

  // The Pouākai is brought over a place and made hungry (the invitation to a hunt), as the
  // unprompted stretch does: for the season in which a journey lesson tests the storm again.
  eagleComes(at, hunger = 41) { return { eagle: { which: 'nearest', near: at, watch: at, hunger } }; },

  // A reaction's `if`: this chapter is the one named (for a stage set by a level-wide reaction).
  opens(chapter, flag) { return (x) => !!x.event && x.event.chapter === chapter && !(flag && x.runner.flags[flag]); },

  // The switches every journey level starts from: the Clues sketches' honest ecology (no
  // floors, the breeding calendar, a readable eagle that gives up when its bird is hidden
  // twice). A level adds its own rule on top.
  journeyMechanics(extra = {}) {
    return Object.assign({
      noSpeciation: true,
      evergreenPlants: MODULE_STORMS.mechanics.evergreenPlants,
      landRegionMates: true,
      maxPerSpecies: 12,
      seasonalBirdBreeding: 'calendar', moaCalendar: true, familyLinks: true,
      juvenileFollow: { within: 50, untilYears: 2, pull: 0.6 },
      noKinPairing: true,
      placedPlantsSeasonal: true,
      emergentEagles: true, eagleMaxPopulation: 1, eagleHungerRate: 0.011,
      eagleStarveThreshold: 88, eagleStarveTimeout: 7200, eagleTargetRatio: 1 / 5,
      eaglePreyPopThreshold: 1, eagleScarcePreyPenalty: 3, eagleSurplusPreference: true,
      eagleTelegraph: { graceSec: 8, warnBelow: 10 },
      coverBreaksLock: true, coverCalmsMoa: true, lureUnderStorm: true, placeableQueryRadius: 100,
      coverSendsEagleAway: { after: 2, sec: 45 },
      eagleReturns: { afterSeasons: 2 },
      nestingSites: { forestCount: 0, openCount: 0, radius: 40, laySnapRadius: 150, drawRadius: 260, layBoost: 0.5, eggSpeedBonus: 1.5 },
      // The lancewood grove: a stand planted in the forest brings up a few ferns round it, and
      // two stands close together found a bush moa nest while bush moa live on the land
      // (Simulation.seedGroveUnderstorey, _nestWatches).
      lancewoodGrove: { ferns: 5, fernGrowth: 0.25, species: 'little_bush_moa' },
      habitatStress: true, habitatStressMargin: 0.08, habitatStressPenalty: 0.4, winterStressMult: 1.4,
      hungerRateMult: 0.6, juvenileHungerMult: 1.0
    }, extra);
  },

  // The Storm as every journey level has it: cover, never a stun.
  STORM: { cost: 40, moveCost: 10, radius: 64, blocksEagleVision: true, distractsEagles: false,
           description: "A moa under the storm can't be seen by the Pouākai." },

  // The menu card a journey level shows (its tile on the map is what the player clicks).
  journeyMenu(title, subtitle, lines, plants) {
    return {
      title, subtitle,
      areaLabel: "Kahurangi, Te Waipounamu",
      areaSubtitle: "Upper West Coast, South Island",
      featuredSpecies: { key: 'upland_moa', displayName: 'Upland Moa', localName: 'Moa Pukepuke', spriteKey: 'upland_walk_01', spriteScale: 0.4 },
      flavorText: lines,
      displayPlants: plants || ['tussock', 'beech', 'rimu'],
      art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
    };
  }
});

// ============================================================================
// THE FIRST TILES, TOLD IN THE ANIMALS' OWN VOICES (levels/journey_01_storm.js and on)
// ============================================================================
// Tiles 1, 2 and 2f follow the narrative sequence of the first modules (Āwhā, Pātōtara and
// their free play), whose stories were told as dialogue between the family, the kea and the
// Pouākai. These pieces say the hint ladders the same way. The ladder is unchanged: nothing,
// then a question, then the instruction. What changes is who asks. The question rung is the
// Pouākai's own mutter ("I spy with my little eye..."), which says who is in the open without
// saying what to do about it. Nothing above this line is changed by them.
// ============================================================================
Object.assign(CHAPTERS_KIT, {
  // Whether every line said so far has been read (no panel showing or waiting). A reaction that
  // must follow a scene waits on this, since a scene stops play while it is read.
  idle(x) {
    const t = x.game.tutorial;
    return !t || !t.enabled || (!t.active && !t.pendingTips.length && !t.eventQueue.length);
  },

  // A line by the Pouākai, titled as the first modules titled it.
  pouakai(text, extra) { return ['haasts_eagle', text, Object.assign({ title: "Pouākai" }, extra || {})]; },

  // ---- Te Whē's prologue on black, then the fade in -------------------------------------------
  // Reactions, in the order they run. The level starts black; Te Whē says `lines` (once a
  // session: a restart only fades in); when they have been read the screen fades in; a moment
  // later the flag `opened` is set and `opening` (the story's first scene) is said. The level's
  // stage must be set by an earlier reaction, or by the chapter's own start.
  //   chapter   the chapter it opens (the level's first)
  //   seenKey   the Game field that remembers the prologue was read this session
  // The birds' own voices (the focus moa's highlight track) wait on black, so Te Whē's click is
  // heard alone; a line with `voices` brings the birds in, and the rest start as it fades in.
  prologue({ chapter = 'summer', lines = [], opening = [], seenKey = '_journeyPrologueSeen', fadeFrames = 90 } = {}) {
    const K = CHAPTERS_KIT, first = K.opens(chapter, 'prologued');
    const voices = (held) => { if (typeof audioManager !== 'undefined' && audioManager && audioManager.holdVoices) {
      if (held) audioManager.holdVoices(); else audioManager.releaseVoices(); } };
    return [
      { id: 'black', on: 'chapter_start', if: first, do: [(x) => { x.game.fadeScreen(1, 0); voices(true); }] },
      ...(lines.length ? [{ id: 'prologue', on: 'chapter_start', if: (x) => first(x) && !x.game[seenKey],
        // (On black there is nothing to stand clear of: Te Whē speaks from the middle.)
        say: lines.map(l => ['guide', typeof l === 'string' ? l : l[0],
                             Object.assign({ guidePosition: 'center' }, typeof l === 'string' ? {} : l[1])]),
        do: [(x) => { x.game[seenKey] = true; }] }] : []),
      { id: 'prologued', on: 'chapter_start', if: first, do: [{ flag: 'prologued' }] },
      { id: 'fade_in', when: (x) => !!x.runner.flags.prologued && K.idle(x),
        do: [(x) => { x.game.fadeScreen(0, fadeFrames); x.runner.vars._fadeAt = x.game.playTime; voices(false); }, { flag: 'fading' }] },
      // (The fade is drawn, not simulated, so on a slow machine it can lag the simulation's
      // clock: wait for it to finish, or seven seconds where nothing is being drawn at all.)
      Object.assign({ id: 'opening', when: (x) => !!x.runner.flags.fading && x.game.playTime - x.runner.vars._fadeAt >= 20 &&
                                                   (x.game.screenFadeDone() || x.game.playTime - x.runner.vars._fadeAt >= 420),
        do: [{ flag: 'opened' }] }, opening.length ? { say: opening } : {})
    ];
  },

  // ---- The Pouākai's hunts, in its own voice ---------------------------------------------------
  // teach: the lesson that teaches the storm. Its first hunt is told outright, as module 0
  // told it: the Pouākai's two lines, the hunted bird's, then the instruction, with play
  // stopped. (It is said as the ladder's first rung at once, so the record does not count it
  // as answered without a hint.) Every later hunt, and every hunt in a lesson that does not
  // teach the storm, climbs the ladder: nothing (the "!" and the amber outline are the clue), the
  // Pouākai's mutter, the instruction.
  huntInVoice({ species = 'upland_moa', teach = false, later = [4, 7], chapters = null } = {}) {
    const K = CHAPTERS_KIT, P = K.pouakai;
    const name = (x) => { const w = K.who(x.runner, x.event && x.event.target); x.runner.vars.who = w; x.runner.vars.WHO = w.toUpperCase(); };
    const isHunt = (x) => !!(x.event && x.event.target && x.event.target.speciesKey === species);
    const again = {
      id: 'hunt_again', on: 'eagle_hunting', once: false,
      if: teach ? ((x) => isHunt(x) && !!x.runner.vars._firstHunt && x.runner.vars._firstHunt !== x.event) : isHunt,
      until: K.coverUntil, solved: K.coverSolved, lost: K.coverLost,
      hints: [
        { after: later[0], do: [name, { notify: ['Pouākai: "I spy with my little eye... {$who}, out in the open!"', 'error'] }] },
        { after: later[1], do: [name], banner: { words: ["The Pouākai has seen {$who}! Cover them with a STORM", "Set the STORM down over {$who}"],
                                                 lit: ['$target', '$eagle', 'Storm'], pause: false, maxSec: 20, needs: 'move' } }
      ]
    };
    const out = [];
    if (teach) out.push({
      id: 'hunt', on: 'eagle_hunting', if: isHunt,
      do: [(x) => { x.runner.vars._firstHunt = x.event; }, name],
      until: K.coverUntil, solved: K.coverSolved, lost: K.coverLost,
      hints: [{ after: 0,
        say: [P("I spy with my little eye, something beginning with M....", { lit: ['$eagle'] }),
              P("Mmm, mmm... MOA! Tasty Moa in these Mmm.. M... Mountains!", { lit: ['$eagle', '$target'] }),
              ['$target', "Eeek!"]],
        banner: { words: ["Tap and hold a STORM to move it", "Move the STORM to cover {$WHO}"],
                  lit: ['Storm', '$target', '$eagle'], pause: true, maxSec: 40, needs: 'move' } }]
    });
    out.push(again);
    // Hidden before anything was said: the Pouākai says so (the rule, in the hunter's words).
    out.push({ id: 'foiled_unaided', on: 'case_closed', once: false, cooldown: 20, chapters,
      if: (x) => x.event && /^hunt/.test(x.event.case || '') && x.event.outcome === 'solved' && x.event.rung === 0,
      notify: ['Pouākai: "Blast these clouds! I never even got a good look!"', 'success'] });
    return out;
  },

  // ---- A storm has blown out, in the family's voice ----------------------------------------------
  // teach: the first one to blow out unlocks the Storm tool and is told outright (a new control),
  // with Te Whē's one line on what calling a storm costs. Later ones climb the ladder: nothing
  // (the storm thinning is the clue), a word from `voice`, the instruction.
  stormInVoice({ teach = false, voice = "Pukepuke", lit = [], notice = 6, tell = 14, chapters = null } = {}) {
    // (Calling a new one answers it, and so does bringing one over: storms gather on the tops.)
    const solved = { any: [{ placed: 'Storm' }, { gained: ['moved:Storm', '>=', 1] }] }, until = { any: [solved, { after: 45 }] };
    const out = [];
    if (teach) out.push({
      id: 'storm_gone', on: 'placeable_expired', if: { type: 'Storm' }, unlock: 'Storm',
      do: [(x) => { x.runner.vars._firstGone = x.event; x.runner.vars._firstGoneAt = x.game.playTime; }],
      until, solved,
      hints: [{ after: 0,
        say: [['guide', "Calling a new STORM takes MAURI, the life force of this forest. Use it well, and it will offer you ways to protect the moa family in return.",
               { highlight: { type: 'element', target: 'mauriDisplay' }, guidePosition: 'topLeft' }]],
        banner: { words: ["Their STORM is breaking up! Tap the STORM button", "Now tap beside the family to call the STORM"],
                  tool: 'Storm', lit, pause: true, maxSec: 40 } }]
    });
    out.push({
      id: 'storm_gone_again', on: 'placeable_expired', once: false, cooldown: 25, chapters,
      // (Not the one that was told outright, nor the others that blew out in the same breath.)
      if: (x) => !!x.event && x.event.type === 'Storm' && (!teach || (!!x.runner.vars._firstGone && x.runner.vars._firstGone !== x.event &&
                 x.game.playTime - x.runner.vars._firstGoneAt > 20 * 60)),
      until, solved,
      hints: [
        { after: notice, notify: `${voice}: "Mama, our storm is blowing away!"` },
        { after: tell, banner: { words: ["A STORM has blown out! Tap the STORM button to call a new one", "Tap beside the family to call the STORM"],
                                 tool: 'Storm', lit, pause: false, maxSec: 20 } }
      ]
    });
    return out;
  },

  // ---- The family sets off for a place (the force of a guaranteed walk) ---------------------------
  // The story's walks (down to the wharariki in autumn, home in spring) are the simulation's
  // own: upland moa drift down with the cold and up with the thaw, and the player leads them.
  // A lesson invites the walk with its stage and its words, and only if the family has not
  // A lesson whose story has the family walk somewhere uses this: the named birds take the
  // place as their home and set off for it by their own migration walk (Moa._keepWalking),
  // feeding when hungry, bolting from the Pouākai and hiding on the way as they would. It is
  // a script tool: it decides where the birds are going, and is logged as such.
  headFor(names, place) {
    return (x) => {
      const r = x.runner, p = r.point(place);
      if (!p) { r._log('issue', 'head_for', `no place "${place}"`); return; }
      for (const n of names) {
        const e = r.castEnts[n];
        if (!e || !e.alive || !e.homeRange) continue;
        e.homeRange.set(p.x, p.y);
        e._boundFor = { x: p.x + random(-12, 12), y: p.y + random(-12, 12), r: 60 };   // (Moa._keepWalking)
      }
      r._log('head_for', names.join(','), typeof place === 'string' ? place : '');
    };
  },

  // A scene's last line said, play resumes, and then this holds: for a chapter that ends (or
  // a level that is won) once its closing words have been read.
  saidAndRead(flag) { return (x) => !!x.runner.flags[flag] && CHAPTERS_KIT.idle(x); }
});

// ============================================================================
// THE STORY VIEW (journey tiles 1 and 2)
// ============================================================================
// A journey lesson's story happens on one stretch of its land: the nests, the food, the
// storms standing by, and the way down to winter ground. The view is held close on that
// stretch, with room round it for a storm or the Pouākai to come in from, and opened to the
// whole land only where the level says (the Pouākai's return, winter). The hatch and the
// story moments take the view and give it back; a keeper puts it back if anything leaves it
// elsewhere. Render-only: nothing here touches the simulation.
//
//   const V = CHAPTERS_KIT.storyView({ sites: [...], zoom: [lo, hi], pad });
//   V.to('story' | 'wide', frames)  a start/do action: the view the level rests on, eased to
//                                   (frames <= 2: a cut)
//   V.keeper(chapters)              the reaction that holds it there
//   V.holdOffView({ at, awayFrom, keepFrom, fallback, hunger })
//                                   the Pouākai's entrance: circling out of sight, off the story
//                                   view and well away from `keepFrom` (sites or cast), leaning
//                                   away from `awayFrom`; let go, it flies in over `at`
// ============================================================================
Object.assign(CHAPTERS_KIT, {
  storyView({ sites, zoom = [1.1, 1.3], pad = 50 } = {}) {
    // The view framing the story's sites: their middle, as close as `zoom` allows while they
    // all fit with `pad` (world units) round them.
    const frame = (x) => {
      const r = x.runner, g = x.game;
      const pts = sites.map(n => r.point(n)).filter(p => p && p.x != null);
      if (!pts.length) return null;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) {
        const py = g._groundPaintY(p.x, p.y);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      const v = g._viewport(), b = g._baseView();
      const fit = Math.min(v.w / (x1 - x0 + pad * 2), v.h / (y1 - y0 + pad * 2)) / b.z;
      return { zoom: Math.max(zoom[0], Math.min(zoom[1], fit)), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, ax: 0.5, ay: 0.5 };
    };
    // The stretch of land a framing shows, in paint space (as Game._updateViewTransform clamps
    // it to the map's edges).
    const rect = (x, sv) => {
      const g = x.game, t = g.terrain, v = g._viewport(), b = g._baseView(), z = b.z * sv.zoom;
      const vx = Math.min(b.x, Math.max(b.x + t.mapWidth * b.z - t.mapWidth * z, v.x + v.w * 0.5 - sv.cx * z));
      const vy = Math.min(b.y, Math.max(b.y + t.mapHeight * b.z - t.mapHeight * z, v.y + v.h * 0.5 - sv.cy * z));
      return { x0: (v.x - vx) / z, x1: (v.x + v.w - vx) / z, y0: (v.y - vy) / z, y1: (v.y + v.h - vy) / z };
    };
    const to = (which, frames) => (x) => {
      x.runner.vars._view = which;
      const sv = which === 'story' ? frame(x) : null;
      x.game.cameraTo(sv || { zoom: 1 }, frames);
    };
    const keeper = (chapters) => ({
      id: 'view_keep', chapters, once: false, cooldown: 1,
      when: (x) => {
        const g = x.game, c = g.camera, want = x.runner.vars._view;
        if (!want || !c || c.tween || g._hatchCam || (g.chapters && g.chapters.moment)) return false;
        if (want === 'wide') return c.zoom > 1.02;
        const sv = frame(x);
        return !!sv && (Math.abs(c.zoom - sv.zoom) > 0.03 || Math.hypot(c.cx - sv.cx, c.cy - sv.cy) > 24);
      },
      do: [(x) => to(x.runner.vars._view, 120)(x)]
    });
    // (The old entrance, `dist` from the food away from the low ground, was pushed back onto the
    // land at the map's edge: on a nest near the edge, right over the family.)
    //
    // Of the points just off the view along each bearing from `at` (and on the land), the
    // nearest to `at` that is at least KEEP from everything in keepFrom, leaning away from
    // `awayFrom` (so it is soon seen coming, not a slow crossing from the far corner); with none
    // that far from them, the furthest from them there is.
    const GAP = 40;   // (beyond the view's edge, past its circling radius)
    const KEEP = 130;
    const holdOffView = ({ at, awayFrom, keepFrom = [], fallback, hunger = 30 }) => (x) => {
      const r = x.runner, g = x.game, t = g.terrain, sv = frame(x);
      const a = r.point(at), lake = awayFrom ? r.point(awayFrom) : null;
      const keep = keepFrom.map(n => r.point(n)).filter(Boolean).concat(a ? [a] : []);
      let best = null;
      if (sv && a) {
        const R = rect(x, sv), m = 24;
        const away = lake ? Math.atan2(a.y - lake.y, a.x - lake.x) : 0;
        for (let k = 0; k < 24; k++) {
          const ang = k * Math.PI / 12, dx = Math.cos(ang), dy = Math.sin(ang);
          for (let d = 40; d <= 700; d += 10) {
            const px = a.x + dx * d, py = a.y + dy * d;
            if (px < m || py < m || px > t.mapWidth - m || py > t.mapHeight - m) break;   // (off the land first)
            const qy = g._groundPaintY(px, py);
            if (px > R.x0 - GAP && px < R.x1 + GAP && qy > R.y0 - GAP && qy < R.y1 + GAP) continue;
            const near = Math.min(...keep.map(p => Math.hypot(p.x - px, p.y - py)));
            const lean = lake ? 60 * Math.cos(ang - away) : 0;
            const score = near >= KEEP ? 1e6 - d + lean : near + lean;
            if (!best || score > best.score) best = { x: px, y: py, score };
            break;
          }
        }
      }
      const hold = best ? { at: { x: best.x, y: best.y } } : (fallback || { at });
      r._log('eagle_entrance', best ? 'off view' : 'fallback');
      r.eaglePressure({ which: 'nearest', near: at, hold, hunger }, x.event);
    };
    return { frame, to, keeper, holdOffView };
  }
});
