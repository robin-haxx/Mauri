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
                                       lit: ['$target', '$eagle'], pause: pauseFirst, maxSec: 25 } }
        ] },
      { id: 'cover_again', on: 'eagle_hunting', once: false,
        // (every hunt but the one the first reaction took)
        if: (x) => isHunt(x) && !!x.runner.vars._firstHunt && x.runner.vars._firstHunt !== x.event,
        until: K.coverUntil, solved: K.coverSolved, lost: K.coverLost,
        hints: [
          { after: later[0], do: [name, { notify: ["The Pouākai is watching {$who}.", 'error'] }] },
          { after: later[1], banner: { words: ["Cover the hunted moa with a STORM", "Set the STORM down over the moa"],
                                       lit: ['$target', '$eagle'], pause: false, maxSec: 20 } }
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
        until: { any: [{ placed: 'Storm' }, { after: 45 }] }, solved: { placed: 'Storm' },
        hints: [
          { after: notice, notify: "A storm has blown out." },
          { after: tell, banner: { words: ["Tap the STORM button and call a new one", "Tap beside the family to call the STORM"],
                                   tool: 'Storm', lit, pause: false, maxSec: 20 } }
        ] }, unlock ? { unlock: 'Storm' } : {})
    ];
  },

  // ---- Hidden twice, the eagle goes for the herd (mechanics.coverSendsEagleAway) ----------
  gaveUp() {
    return [
      { id: 'gave_up', on: 'eagle_gave_up',
        say: [['guide', "Hidden from it twice, the Pouākai has given the family up and gone after the {species}. It still has to eat.", { lit: ['$eagle'] }]] },
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
        { id: `${id}_own`, name: "Meet a danger with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 },
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
