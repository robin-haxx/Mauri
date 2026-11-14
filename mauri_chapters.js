// ============================================================================
// CHAPTERS: the module engine (levels with a `chapters` list)
// ============================================================================
// A chapter level is an ordinary emergent level (its own land, cast, mechanics and tools) with
// a `chapters` list on top, run by a ChapterRunner (game.chapters). The runner never steers an
// animal or stages an outcome. It
//
//   frames    play with levers as each chapter opens: the toolbar, locked tools, the focus
//             species, a protection floor for the rest, nest founding, newcomers, mechanics
//   measures  it with goals: conditions on what the simulation did (live counts, gains since
//             the chapter began, a flock kept above a line, a season got through)
//   narrates  it with reactions: lines and "do this" banners that answer the simulation's own
//             events (a hunt, a catch, an egg, a founded nest) or a condition turning true
//
// and moves from chapter to chapter (on the season clock by default), branching on how the last
// one went. Lines and banners compile into ordinary tutorial tips at load, shown through
// TUTORIAL_EVENTS.STORY_BEAT. The format, its vocabulary and the build plan are in
// MODULE_ENGINE_PLAN.md; levels/chapters_prototype.js is a worked example.
//
// Its verbs come in two toolboxes: the SCRIPTING toolbox (deterministic: words, pacing, sites
// and things put at them, moments, and `aim`) and the ECOLOGY toolbox (levers on the sim:
// focus, floors, nest founding, newcomers, tuning, eagle pressure). A guaranteed beat joins
// them: it invites an event with ecology levers, and forces it with a script tool by a deadline.
// ============================================================================

const CHAPTER_FPS = 60;   // frames per second, for turning seconds into frames
const CHAPTER_POLL = 6;   // goals, polled reactions, lose rules and chapter ends: every this many frames

const CHAPTER_OPS = {
  '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b,
  '<': (a, b) => a < b, '==': (a, b) => a === b, '!=': (a, b) => a !== b
};

// The events a reaction can wait `on`. subject: the data field the event is about (what the
// species / focus / cast filters look at); count: the counter it adds to (also per species or
// placeable type, with a suffix). The last six are the runner's own.
const CHAPTER_EVENTS = {
  eagle_hunting:   { subject: 'target', count: 'hunts' },
  moa_killed:      { subject: 'moa', count: 'killed' },
  egg_laid:        { subject: 'egg', count: 'laid' },
  egg_hatched:     { subject: 'moa', count: 'hatched' },
  placement:       { count: 'placed' },
  placeable_moved: { count: 'moved' },
  nest_raid:       { subject: 'site', count: 'raids' },
  season_change:   {},
  chapter_start:   {},
  goal_met:        {},
  goal_failed:     {},
  nest_founded:    { subject: 'site' },
  cast_lost:       { subject: 'entity' },
  beat:            {},
  placeable_expired: { count: 'expired' },          // a placed item wore out: `type` (expired:Storm)
  plant_sprouted:  { count: 'sprouted' },           // a pātōtara sprouted by hand: `sprouted`, `type`
  bird_hatched:    { subject: 'bird', count: 'hatched' },  // a flighted bird's egg hatched: `$bird`, `$egg`
  bird_killed:     { subject: 'bird', count: 'killed' },   // an eagle took a flighted bird: `$bird`, `$eagle` (counts with the moa under killed:<species>)
  species_arrived: { count: 'arrived' },                   // newcomers came in (rescueImmigration, eagleReturns): `species`, `count`
  plant_tapped:    { count: 'tapped' },                    // the player rustled a plant: `type`
  animal_selected: { subject: 'animal', count: 'selected' },   // the player tapped an animal to read and follow it: `$animal`, `species`
  case_closed:     {},                                     // a hint ladder's case ended: `case` (the reaction's id), `rung`, `outcome`, `sec`, `transfer`
  species_left:    { subject: 'moa', count: 'left' },      // a grown young bird set off over the pass (dispersal): `$moa`, `species`
  moa_crowded:     { subject: 'moa', count: 'crowded' },   // a moa's forest meal was cut short by moa feeding beside it (crowdingSign): `$moa`, `others`
  forest_stripped: { subject: 'moa', count: 'stripped' },  // ...or by a flock feeding overhead (flockStripsFloor): `$moa`, `birds`
  eagle_gave_up:   { subject: 'eagle', count: 'gaveUp' }   // hidden prey sent the eagle to other prey (coverSendsEagleAway): `$eagle`, `species` (what it went for), `from`
};

// The events that are the player's own hand (written to the log as kind 'player').
const CHAPTER_PLAYER_EVENTS = new Set(['placement', 'placeable_moved', 'plant_sprouted', 'plant_tapped', 'animal_selected']);

// Conditions that read the world as it is right now. A beat whose `until` is made only of these
// can miss the moment it waits for (an eagle's lock can be gone between two polls), so the
// validator asks for an event-counted one (gained, seen, placed) beside or instead of them.
const CHAPTER_STATE_KEYS = new Set(['hunting', 'hunted', 'hidden', 'alive', 'season',
  'seasonProgress', 'eagleHunger', 'stat', 'extinct', 'separated']);
const CHAPTER_EVENT_KEYS = new Set(['gained', 'placed', 'seen', 'beat', 'since', 'goal', 'goalsMet', 'flag', 'after', 'seasons', 'year']);

// Condition keys: (arg, compiler) => (x) => bool, where x is { runner, game, event, scope }
// (scope: the chapter's, or a banner's since it showed). An object's keys must all hold.
const CHAPTER_CONDITIONS = {
  count:   ([who, op, n]) => (x) => CHAPTER_OPS[op](x.runner.countOf(who), n),
  gained:  ([name, op, n]) => (x) => CHAPTER_OPS[op](x.runner.gained(name, x.scope), n),
  placed:  (type) => (x) => x.runner.gained('placed:' + type, x.scope) >= 1,
  mauri:   ([op, n]) => (x) => CHAPTER_OPS[op](x.game.mauri.mauri, n),
  season:  (keys) => (x) => [].concat(keys).includes(x.game.seasonManager.currentKey),
  seasonProgress: ([op, f]) => (x) => CHAPTER_OPS[op](x.game.seasonManager.progress, f),
  after:   (sec) => (x) => x.runner.scopeTime(x.scope) >= sec * CHAPTER_FPS,
  seasons: (n) => (x) => x.runner.seasonsIn() >= n,
  goal:    (id) => (x) => x.runner.met.has(id),
  goalsMet: (want) => (x) => x.runner.chapterGoalsMet() === !!want,
  beat:    (id) => (x) => x.runner.beatsDone.has(id),
  since:   ([id, sec]) => (x) => x.runner.beatsDone.has(id) &&
    x.game.playTime - x.runner.beatsDone.get(id) >= sec * CHAPTER_FPS,
  flag:    (name) => (x) => !!x.runner.flags[name],
  extinct: (who) => (x) => x.runner.extinct(who),
  alive:   (role) => (x) => { const e = x.runner.entity(role, x.event); return !!(e && e.alive !== false); },
  // (Read from where the cover stands now, not from the bird's inShelter, which only the running
  // simulation refreshes: a storm set down over a moa while a banner has play stopped hides it
  // at once.)
  hidden:  (role) => (x) => { const e = x.runner.entity(role, x.event); return !!(e && e.alive !== false && x.runner.coveredNow(e)); },
  hunting: (role) => (x) => role === true ? x.runner.focusHunted()
    : !!(x.runner.entity(role, x.event) || {}).hunting,
  hunted:  (role) => (x) => {   // an eagle is after this one
    const t = x.runner.entity(role, x.event);
    return !!t && (x.runner.sim.eagles || []).some(e => e.alive && e.hunting && e.target === t);
  },
  // Land regions (TerrainGenerator.landRegions): two places or birds on land no bird can walk
  // between; how many separate stretches of land a species lives on.
  separated: ([a, b]) => (x) => {
    const p = x.runner.point(a, x.event), q = x.runner.point(b, x.event);
    return !!p && !!q && !!x.game.terrain.connected && !x.game.terrain.connected(p, q);
  },
  regions: ([who, op, n]) => (x) => CHAPTER_OPS[op](x.runner.regionsOf(who), n),
  // Two places or birds within `dist` of each other. `a` as a species key: any live one of them.
  near:    ([a, b, dist]) => (x) => x.runner.nearCheck(a, b, dist, x.event),
  // An event has happened since the scope began (the chapter, a beat, a banner), with optional
  // filters on it (species, focus, cast, type, success, near...). Counted at the event, so a
  // beat waiting on it can't miss it.
  seen:    (arg, c) => {
    const [name, filters] = Array.isArray(arg) ? arg : [arg, null];
    const test = filters ? c.compile(filters) : null;
    return (x) => x.runner.seenCheck(name, test, x.scope);
  },
  // The year of the level (1 in the first four seasons).
  year:    ([op, n]) => (x) => CHAPTER_OPS[op](x.runner.yearNow(), n),
  // The hungriest live eagle's hunger (0 to 100) compares.
  eagleHunger: ([op, n]) => (x) => CHAPTER_OPS[op](x.runner.eagleHungerMax(), n),
  // A bird's own number compares: stat: [ref, 'hunger' | 'age' | 'size', op, n].
  stat:    ([ref, field, op, n]) => (x) => {
    const e = x.runner.entity(ref, x.event);
    return !!e && e.alive !== false && CHAPTER_OPS[op](x.runner.statOf(e, field), n);
  },
  // Filters on the event a reaction answers.
  species: (keys) => (x) => [].concat(keys).includes(x.runner.subjectSpecies(x.event)),
  focus:   (want) => (x) => x.runner.isFocus(x.runner.subjectSpecies(x.event)) === !!want,
  cast:    (names) => (x) => {   // one name, or a list of them
    if (!x.event) return false;
    for (const name of [].concat(names)) {
      if (x.event.cast === name) return true;
      const e = x.runner.castEnts[name];
      if (e && e === x.runner.subject(x.event)) return true;
    }
    return false;
  },
  type:    (types) => (x) => !!x.event && [].concat(types).includes(x.event.type),
  cause:   (c) => (x) => !!x.event && [].concat(c).includes(x.event.cause),
  success: (want) => (x) => !!x.event && !!x.event.success === !!want,
  any:     (list, c) => { const fs = list.map(s => c.compile(s)); return (x) => fs.some(f => f(x)); },
  all:     (list, c) => { const fs = list.map(s => c.compile(s)); return (x) => fs.every(f => f(x)); },
  not:     (sub, c) => { const f = c.compile(sub); return (x) => !f(x); }
};

// ============================================================================
// THE TWO TOOLBOXES (MODULE_ENGINE_PLAN.md, "The two toolboxes")
// ============================================================================
// Every action is one verb, (arg, x) => void, where x is { runner, game, event }: one verb per
// action object ({ unlock: 'shelter' }). `say` and `banner` are compiled into tips at load and
// arrive here as their cue id.
//
// The SCRIPTING toolbox is deterministic: words, the toolbar and pacing, things put at a site,
// set-pieces, story state and flow, and `aim` (the force half of a guaranteed beat).
const CHAPTER_SCRIPT_TOOLS = {
  say:       (cue, x) => x.runner.cue(cue, x.event),
  banner:    (cue, x) => x.runner.cue(cue, x.event),
  notify:    (msg, x) => {
    const [text, type] = [].concat(msg);
    x.game.addNotification(x.runner.fill(text, x.event), type || 'info');
  },
  camera:    (cam, x) => x.runner.camera(cam, x.event),
  moment:    (spec, x) => x.runner.playMoment(spec, x.event),
  tools:     (tools, x) => x.runner.setTools(tools),
  unlock:    (keys, x) => { for (const k of [].concat(keys)) x.game.unlockTool(k); },
  lock:      (keys, x) => { for (const k of [].concat(keys)) x.game.lockTool(k); },
  place:     (spec, x) => x.runner.place(spec, x.event),
  sow:       (spec, x) => x.runner.sow(spec, x.event),
  spawn:     (spec, x) => x.runner.spawn(spec, x.event),
  aim:       (spec, x) => x.runner.aim(spec, x.event),
  nest:      (spec, x) => x.runner.nest(spec, x.event),
  lay:       (spec, x) => x.runner.lay(spec, x.event),
  adopt:     (spec, x) => x.runner.adopt(spec, x.event),
  fade:      (spec, x) => x.runner.fade(spec),
  guide:     (id, x) => x.runner.guideOpen(id),
  flag:      (name, x) => { x.runner.flags[name] = true; },
  unflag:    (name, x) => { delete x.runner.flags[name]; },
  reward:    (n, x) => x.game.mauri.earn(n, undefined, undefined, 'goal'),
  next:      (id, x) => { x.runner._nextReq = id; },
  win:       (_, x) => { x.runner._nextReq = 'win'; },
  lose:      (reason, x) => x.runner.lose(x.runner.fill(reason || "The level is lost.", x.event))
};

// The ECOLOGY toolbox is levers on the simulation, with the outcome left to it: who's on stage
// and who's protected, nest founding, newcomers, tuning, and pressure from the eagles.
const CHAPTER_ECOLOGY_TOOLS = {
  focus:     (keys, x) => x.runner.setFocus(keys),
  protect:   (floor, x) => x.runner.setProtect(floor),
  nesting:   (spec, x) => x.runner.setNesting(spec),
  introduce: (list, x) => x.runner.introduce(list),
  mechanics: (m, x) => x.runner._applyMechanics(m),
  eagle:     (spec, x) => x.runner.eaglePressure(spec, x.event)
};

const CHAPTER_ACTIONS = Object.assign({}, CHAPTER_SCRIPT_TOOLS, CHAPTER_ECOLOGY_TOOLS);

// A chapter's levers, run in this order as it opens: [the chapter's key, the verb it runs].
const CHAPTER_LEVERS = [['mechanics', 'mechanics'], ['tools', 'tools'], ['locked', 'lock'],
  ['focus', 'focus'], ['introduce', 'introduce'], ['protect', 'protect'], ['nesting', 'nesting']];

// A story moment's camera (MomentPlayer): how close, and how long it takes to ease in and out.
// (Slow enough in and out that the view glides: see Game.cameraTo.)
const CHAPTER_MOMENT = { zoom: 2.2, inSec: 1.3, outSec: 1.6 };

// What a chapter may say (the validator flags anything else, e.g. a misspelt lever).
const CHAPTER_KEYS = new Set(['id', 'title', 'sites', 'start', 'goals', 'reactions', 'beats', 'until',
  'holdSeason', 'next', 'transfer', ...CHAPTER_LEVERS.map(([key]) => key)]);

// The ways a site can be found (see ChapterRunner._findSite).
const CHAPTER_SITE_FINDERS = new Set(['flock', 'nest', 'biome', 'high', 'low', 'open', 'edge']);

// Who can speak (besides `cast` names and `$roles`): the guide.
const CHAPTER_GUIDE = { title: "Te Whē, the Mantis", sprite: 'mantis_talk' };

// ============================================================================
// ChapterRunner
// ============================================================================
class ChapterRunner {
  // Built as the level starts (Game._initFinalize), before the tips are set: everything is
  // compiled here, so `tips` holds the level's lines and banners and `issues` what's wrong
  // with its chapters. game is null for a dry run (ChapterRunner.validate).
  constructor(game, levelDef) {
    this.game = game;
    this.level = levelDef;
    this.issues = [];
    this.tips = {};
    this.log = [];
    this._seenLog = [];            // the run's events, for the `seen` condition (a ring of 512)

    this.flags = {};
    this.met = new Set();          // ids of every goal met so far (any chapter)
    this.counters = {};            // event counts for the run (see _count)
    this.focus = [];               // this chapter's focus species
    this.castEnts = {};            // cast name -> the adopted entity (null once lost)
    this.vars = {};                // values function actions leave for the words ({$name} in text)
    this._cases = [];              // hint ladders under way: { rx, ev, t0, scope, rung }
    this.caseLog = [];             // ...and how each ended: { id, t, sec, rung, outcome, who, chapter, transfer }
    this.cueData = {};             // cue id -> the event it answers (for roles and banner scopes)
    this._chain = {};              // a line cue -> the banner cue its last line leads to
    this.seasonTurns = 0;          // season changes since the level began
    this.inspector = false;        // the debug overlay (J in debug mode)

    this.cur = null;               // the chapter running
    this.goals = [];               // its live goals (shown as game.goals)
    this._events = [];
    this._nextReq = null;          // a `next` / `win` action closes the chapter on the next poll
    this._ended = false;
    this._goalsOffered = 0;
    this._extinctKey = null;
    this._nests = 0;

    this.sites = {};               // site name -> { x, y } (found as the level or its chapter starts)
    this.beatsDone = new Map();    // beat id -> playTime it was done
    this.beatState = [];           // this chapter's beats as they run (see _updateBeats)
    this.moments = game ? new MomentPlayer(game, CHAPTER_MOMENT, () => !this._ended) : null;

    this.castDefs = levelDef.cast || {};
    this._siteNames = new Set([...Object.keys(levelDef.sites || {}),
      ...(levelDef.chapters || []).flatMap(c => Object.keys(c.sites || {})),
      ...ChapterRunner._siteAliases(levelDef)]);
    this._speciesKeys = new Set([...((levelDef.species && levelDef.species.moa) || []),
      ...((levelDef.species && levelDef.species.eagle) || []), ...((levelDef.species && levelDef.species.other) || [])]);

    this.chapters = (levelDef.chapters || []).map((ch, i) => this._compileChapter(ch, i));
    this.byId = {};
    for (const ch of this.chapters) {
      if (this.byId[ch.id]) this._issue(`two chapters are called "${ch.id}"`);
      this.byId[ch.id] = ch;
    }
    this.reactions = (levelDef.reactions || []).map((r, i) => this._compileReaction(r, null, i));
    for (const ch of this.chapters) this.reactions.push(...ch.reactions);
    const lose = levelDef.lose || [{ when: { extinct: 'focus' }, reason: "The {species} died out." }];
    this.loseRules = lose.map((r) => ({ when: this.compile(r.when), reason: r.reason || "The level is lost." }));
    this._checkRefs();
    if (game) for (const s of this.issues) console.warn(`[chapters] ${levelDef.id}: ${s}`);
  }

  // The chapter checks without playing: the issues a level's chapters have.
  static validate(levelDef) { return new ChapterRunner(null, levelDef).issues; }

  // The site names a level's actions make as they run (`nest: { as: 'home' }`), so a condition
  // can name them before the action has run.
  static _siteAliases(levelDef) {
    const out = [];
    const walk = (v, depth) => {
      if (!v || typeof v !== 'object' || depth > 8) return;
      if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
      if (v.nest && typeof v.nest === 'object' && typeof v.nest.as === 'string') out.push(v.nest.as);
      for (const k of Object.keys(v)) if (k !== 'sites' && k !== 'menu') walk(v[k], depth + 1);
    };
    walk(levelDef.chapters, 0);
    walk(levelDef.reactions, 0);
    return out;
  }

  _issue(s) { if (!this.issues.includes(s)) this.issues.push(s); }

  // ==========================================================================
  // COMPILING
  // ==========================================================================
  compile(cond) {
    if (cond == null) return () => false;
    if (cond === true) return () => true;
    if (typeof cond === 'function') {
      return (x) => { try { return !!cond(x); } catch (e) { console.warn('[chapters] condition error:', e); return false; } };
    }
    if (typeof cond !== 'object' || Array.isArray(cond)) {
      this._issue(`a condition must be an object or a function: ${JSON.stringify(cond)}`);
      return () => false;
    }
    const parts = [];
    for (const key of Object.keys(cond)) {
      const make = CHAPTER_CONDITIONS[key];
      if (!make) { this._issue(`unknown condition "${key}"`); parts.push(() => false); continue; }
      const arg = cond[key];
      if (key === 'separated') [].concat(arg).forEach(r => this._checkPoint(r, '"separated"'));
      if (key === 'near') {
        if (!Array.isArray(arg) || arg.length !== 3) this._issue(`"near" takes [a, b, distance]: ${JSON.stringify(arg)}`);
        else { this._checkPoint(arg[0], '"near"'); this._checkPoint(arg[1], '"near"'); }
      }
      if (key === 'seen') {
        const name = Array.isArray(arg) ? arg[0] : arg;
        if (!CHAPTER_EVENTS[name]) this._issue(`"seen": unknown event "${name}"`);
      }
      if (key === 'stat') {
        if (!(Array.isArray(arg) && arg.length === 4 && CHAPTER_OPS[arg[2]] && ['hunger', 'age', 'size'].includes(arg[1]))) {
          this._issue(`"stat" takes [who, 'hunger' | 'age' | 'size', op, n]: ${JSON.stringify(arg)}`);
        } else this._checkRef(arg[0], '"stat"');
      }
      if (['year', 'eagleHunger'].includes(key) && !(Array.isArray(arg) && CHAPTER_OPS[arg[0]])) {
        this._issue(`"${key}" takes [op, n]: ${JSON.stringify(arg)}`);
      }
      if (key === 'regions' && Array.isArray(arg) && arg[0] !== 'moa' && !this._speciesKeys.has(arg[0])) {
        this._issue(`"regions": "${arg[0]}" isn't in the level's species`);
      }
      if (['count', 'gained', 'regions'].includes(key) && !(Array.isArray(arg) && arg.length === 3 && CHAPTER_OPS[arg[1]])) {
        this._issue(`"${key}" takes [what, op, n]: ${JSON.stringify(arg)}`);
      }
      if (['mauri', 'seasonProgress'].includes(key) && !(Array.isArray(arg) && CHAPTER_OPS[arg[0]])) {
        this._issue(`"${key}" takes [op, n]: ${JSON.stringify(arg)}`);
      }
      if (key === 'goal') (this._goalRefs || (this._goalRefs = [])).push(arg);
      if (key === 'beat' || key === 'since') (this._beatRefs || (this._beatRefs = [])).push(key === 'beat' ? arg : arg[0]);
      if (['alive', 'hidden', 'hunting', 'hunted'].includes(key) && arg !== true) this._checkRef(arg, `"${key}"`);
      parts.push(make(arg, this));
    }
    return parts.length === 1 ? parts[0] : (x) => parts.every(f => f(x));
  }

  _compileChapter(def, i) {
    const id = def.id || `chapter_${i + 1}`;
    const ch = { id, def, title: def.title || id };
    ch.goals = (def.goals || []).map((g, gi) => this._compileGoal(g, id, gi));
    const ids = ch.goals.map(g => g.id);
    if (new Set(ids).size !== ids.length) this._issue(`chapter "${id}" has two goals with the same id`);
    ch.start = this._compileActions(`${id}:start`, [].concat(def.start || []));
    ch.until = this.compile(def.until || { seasons: 1 });
    // holdSeason: { until, at = 0.9, maxSec }: the season waits at `at` until `until` holds, or
    // for maxSec at most (a hold with no way out is a rail).
    ch.hold = def.holdSeason ? { until: this.compile(def.holdSeason.until), at: def.holdSeason.at ?? 0.9,
                                 maxSec: def.holdSeason.maxSec || 0 } : null;
    if (def.holdSeason && !def.holdSeason.maxSec) this._issue(`warning: chapter "${id}" holds its season with no maxSec: give the hold a way out`);
    ch.reactions = (def.reactions || []).map((r, ri) => this._compileReaction(r, id, ri));
    ch.beats = (def.beats || []).map((b, bi) => this._compileBeat(b, id, bi));
    for (const key of Object.keys(def)) {
      if (!CHAPTER_KEYS.has(key)) this._issue(`chapter "${id}" has an unknown key "${key}"`);
    }
    for (const name of Object.keys(def.sites || {})) this._checkSiteSpec(def.sites[name], `chapter "${id}" site "${name}"`);
    // next: an id or 'win' | [[cond, id], ...] (the first that holds; true = otherwise) |
    // { if, then, else }. Left out: the chapter after this one in the list, else the win.
    const n = def.next;
    if (n == null) ch.nextRules = null;
    else if (typeof n === 'string') ch.nextRules = [{ test: () => true, id: n }];
    else if (Array.isArray(n)) ch.nextRules = n.map(([c, to]) => ({ test: this.compile(c), id: to }));
    else ch.nextRules = [{ test: this.compile(n.if), id: n.then }, { test: () => true, id: n.else }];
    for (const k of [].concat(def.focus || [], (def.introduce || []).map(s => s.type),
                              def.nesting ? [def.nesting.species] : [])) {
      if (!this._speciesKeys.has(k)) this._issue(`chapter "${id}" names "${k}", which isn't in the level's species`);
    }
    const tools = def.tools ? (Array.isArray(def.tools) ? def.tools : Object.keys(def.tools)) : [];
    for (const k of [...tools, ...[].concat(def.locked || [])]) this._checkTool(k, `chapter "${id}"`);
    return ch;
  }

  _compileGoal(g, chapterId, i) {
    const id = g.id || `${chapterId}_goal_${i + 1}`;
    if (!g.done && !g.keep && !g.survive) this._issue(`goal "${id}" needs done, keep or survive`);
    return {
      id, def: g,
      done: g.done ? this.compile(g.done) : null,
      keep: g.keep ? this.compile(g.keep) : null,
      progress: this._progressOf(g.done || g.keep)
    };
  }

  // What a goal's {n} and {target} read: the live value and target of a count / gained /
  // mauri condition.
  _progressOf(cond) {
    if (!cond || typeof cond !== 'object') return null;
    if (Array.isArray(cond.count)) return { kind: 'count', what: cond.count[0], target: cond.count[2] };
    if (Array.isArray(cond.gained)) return { kind: 'gained', what: cond.gained[0], target: cond.gained[2] };
    if (Array.isArray(cond.mauri)) return { kind: 'mauri', target: cond.mauri[1] };
    if (cond.placed) return { kind: 'gained', what: 'placed:' + cond.placed, target: 1 };
    return null;
  }

  // The keys a reaction or a beat can use as its own, in the order they run, then its `do` list.
  _ownActions(def) {
    const items = [];
    for (const k of ['unlock', 'notify', 'moment', 'say', 'banner']) if (def[k]) items.push({ [k]: def[k] });
    items.push(...[].concat(def.do || []));
    return items;
  }

  _compileReaction(r, owner, i) {
    const id = r.id || `${owner || 'level'}_reaction_${i + 1}`;
    if (r.on && !CHAPTER_EVENTS[r.on]) this._issue(`reaction "${id}" waits on an unknown event "${r.on}"`);
    if (!r.on && !r.when) this._issue(`reaction "${id}" needs on (an event) or when (a condition)`);
    if (r.for && !r.when) this._issue(`reaction "${id}": for (seconds) goes with when, not on`);
    return {
      id, def: r, owner,
      on: r.on || null,
      when: r.when ? this.compile(r.when) : null,
      // A need: `when` must have held this long (seconds) before it fires (see update).
      forFrames: (r.for || 0) * CHAPTER_FPS,
      test: r.if ? this.compile(r.if) : null,
      once: r.once !== false,
      cooldown: (r.cooldown || 0) * CHAPTER_FPS,
      max: r.max != null ? r.max : Infinity,
      chapters: r.chapters || null,
      actions: this._compileActions(`rx:${id}`, this._ownActions(r)),
      // A hint ladder (see _updateCases): rungs said one after another while `until` has not
      // come true; `solved`, the ending that counts as the player's own answer; and `lost`, the
      // ending that counts as the problem winning.
      hints: this._compileHints(id, r),
      until: r.until ? this.compile(r.until) : null,
      solved: r.solved ? this.compile(r.solved) : null,
      lost: r.lost ? this.compile(r.lost) : null,
      fired: 0, lastAt: -Infinity, was: false, heldSince: null
    };
  }

  // hints: [{ after: sec, notify | say | banner | do ... }, ...]: each rung's actions, with the
  // seconds since the reaction fired at which it is said. A rung's banner with no `until` of
  // its own waits on the reaction's (and goes after its maxSec, if it has one, whichever is
  // first: a banner must not stay up once the problem it names is over).
  _compileHints(id, r) {
    if (!r.hints) return [];
    if (!r.until) this._issue(`reaction "${id}": hints need an until (what ends the case)`);
    let last = -1;
    return r.hints.map((h, k) => {
      if ((h.after || 0) < last) this._issue(`reaction "${id}": its hints' after times must rise`);
      last = h.after || 0;
      const hh = (h.banner && !h.banner.until && r.until)
        ? Object.assign({}, h, { banner: Object.assign({ until: r.until }, h.banner) }) : h;
      return { after: (h.after || 0) * CHAPTER_FPS, actions: this._compileActions(`rx:${id}:hint${k + 1}`, this._ownActions(hh)) };
    });
  }

  // A guaranteed beat: starts `when` its condition holds (the chapter's start, without one) and
  // runs `invite` (ecology levers that make the event likely); done when `until` holds. If it
  // hasn't by `by` seconds, `force` runs (script tools that make it happen). Done, it runs its
  // own actions and fires a 'beat' event. Neither until nor by: a plain step, done at once.
  _compileBeat(b, chapterId, i) {
    const id = b.id || `${chapterId}_beat_${i + 1}`;
    if (b.force && b.by == null) this._issue(`beat "${id}" has force but no by (the deadline it runs at)`);
    if (b.until && typeof b.until === 'object' && !Array.isArray(b.until)) {
      const keys = Object.keys(b.until);
      if (keys.length && keys.every(k => CHAPTER_STATE_KEYS.has(k)) && !keys.some(k => CHAPTER_EVENT_KEYS.has(k))) {
        this._issue(`warning: beat "${id}" waits on a state (${keys.join(', ')}) that can be missed between polls: prefer seen / gained`);
      }
    }
    return {
      id, def: b, chapter: chapterId, once: !!b.once,
      when: b.when ? this.compile(b.when) : null,
      invite: this._compileActions(`beat:${id}:invite`, [].concat(b.invite || [])),
      until: b.until ? this.compile(b.until) : null,
      by: b.by != null ? b.by * CHAPTER_FPS : null,
      force: this._compileActions(`beat:${id}:force`, [].concat(b.force || [])),
      pinned: !!b.pinned,
      actions: this._compileActions(`beat:${id}`, this._ownActions(b))
    };
  }

  _compileActions(owner, items) {
    const out = [];
    items.forEach((item, i) => {
      if (typeof item === 'function') { out.push({ fn: item }); return; }
      const keys = Object.keys(item || {});
      const verb = keys[0];
      if (keys.length !== 1 || !CHAPTER_ACTIONS[verb]) {
        this._issue(`${owner}: an action is one known verb, not ${JSON.stringify(keys)}`);
        return;
      }
      const a = { verb, arg: item[verb] };
      if (verb === 'say' || verb === 'banner') a.cue = `${owner}#${i}`;
      this._checkAction(verb, a.arg, owner);
      out.push(a);
    });
    // Lines followed straight away by a banner: the banner comes after their last line.
    for (let i = 0; i < out.length - 1; i++) {
      if (out[i].verb === 'say' && out[i + 1].verb === 'banner') {
        out[i].then = out[i + 1].cue;
        out[i + 1].chained = true;
        this._chain[out[i].cue] = out[i + 1].cue;
      }
    }
    for (const a of out) {
      if (a.verb === 'say') Object.assign(this.tips, this._lineTips(a.cue, a.arg, a.then));
      else if (a.verb === 'banner') this.tips[a.cue] = this._bannerTip(a.cue, a.arg, a.chained);
    }
    return out;
  }

  // ---- Lines and banners, as tutorial tips ----------------------------------
  _beatTrigger(cue) {
    return { type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.STORY_BEAT,
             condition: (game, data) => !!data && data.cue === cue };
  }

  // A scene: one panel per line, opening on the speaker's sound with the speaker lit up and
  // the panel on the far side of the screen from them (as the modules' tip kit does). Each
  // line is [speaker, text, extras]; extras override any tip field, and extras.lit adds to
  // what's lit.
  _lineTips(cue, lines, then) {
    const out = {};
    if (!Array.isArray(lines) || !lines.length) { this._issue(`${cue}: say takes a list of [speaker, text] lines`); return out; }
    const tipId = (i) => i === 0 ? cue : `${cue}_${i + 1}`;
    lines.forEach((line, i) => {
      const [who, text, extra] = line;
      const sp = this._speaker(who, cue);
      const more = Object.assign({}, extra || {});
      const lit = more.lit || null;
      delete more.lit;
      const last = i === lines.length - 1;
      const litNow = () => [...sp.entities(), ...this.lit(lit, this.cueData[cue])];
      out[tipId(i)] = Object.assign({
        id: tipId(i),
        trigger: i === 0 ? this._beatTrigger(cue) : { type: TRIGGER_TYPE.IMMEDIATE },
        title: sp.title,
        content: () => [this.fill(text, this.cueData[cue])],
        guideSprite: sp.sprite,
        guideScale: sp.scale,
        guidePosition: MODULE_TIP_KIT.awayFromAt(litNow),
        speaker: sp.sound,
        speakerPitch: sp.pitch,
        highlight: null,
        renderAboveOverlay: (game) => game.renderEntitiesAboveUI(litNow()),
        pauseGame: true,
        showOnce: false,     // (the runner decides when a reaction repeats)
        priority: 1,
        urgency: 'high',
        nextTip: last ? (then || null) : tipId(i + 1),
        buttonLabel: (last && !then) ? "Continue" : "Next →"
      }, more);
    });
    return out;
  }

  // A banner (MODULE_TIP_KIT.banner): big words across the map until `until` holds, in a
  // scope of its own (gained/placed count from when it showed). It gives way if the player
  // can't afford `tool`, or after maxSec.
  _bannerTip(cue, b, chained) {
    if (!b || !b.words) { this._issue(`${cue}: a banner needs words`); b = Object.assign({ words: '' }, b); }
    if (!b.until && !b.maxSec) this._issue(`${cue}: a banner needs until (or maxSec), or it never goes`);
    const until = b.until ? this.compile(b.until) : () => false;
    const scopeKey = cue + ':scope';
    const words = (game, data) => [].concat(b.words).concat([].concat(b.words)).slice(0, 2)
      .map(w => this.fill(w, this.cueData[cue]));
    const done = (game) => until({ runner: this, game, event: this.cueData[cue], scope: game.tutorial.scratch[scopeKey] }) ||
      (!!b.maxSec && game.tutorial.tipDisplayTime > b.maxSec * CHAPTER_FPS);
    const lit = (game) => game.renderEntitiesAboveUI(this.lit(b.lit, this.cueData[cue]));
    // needs: what the player must afford for the banner to stand ('place': a new `tool`;
    // 'move': moving one of them, and one there to move; 'none'). A banner that can't be
    // answered is not shown, and gives way if it stops being answerable.
    const extra = {
      needs: b.needs || (b.tool ? 'place' : 'none'),
      showOnce: false,
      onShow: (game) => { game.tutorial.scratch[scopeKey] = this.scope(); }
    };
    if (b.tool && extra.needs !== 'move') {
      this._checkTool(b.tool, cue);
      extra.tool = b.tool;
      extra.highlight = { type: 'element', target: 'tool:' + b.tool };
    } else if (extra.needs === 'move') extra.tool = b.tool || 'Storm';
    if (b.pause === false) { extra.pauseGame = false; extra.dim = false; }
    return MODULE_TIP_KIT.banner(cue, chained ? { type: TRIGGER_TYPE.IMMEDIATE } : this._beatTrigger(cue),
      words, done, lit, extra);
  }

  // A speaker: 'guide' (Te Whē), a cast name, a role ('$target': whoever the event is about),
  // or a species key (the event's one of that species, else any). Its name, picture and sound
  // follow the entity's species.
  _speaker(who, cue) {
    if (who === 'guide') {
      return { title: CHAPTER_GUIDE.title, sprite: (this.level.tutorial && this.level.tutorial.guideSprite) || CHAPTER_GUIDE.sprite,
               scale: 1, sound: null, pitch: 1, entities: () => [] };
    }
    this._checkRef(who, `${cue}: speaker`);
    const c = this.castDefs[who] || null;
    const ent = () => this.entity(who, this.cueData[cue]);
    const species = () => {
      const e = ent();
      return (e && (e.speciesKey || e.parentSpecies)) || (c && c.species) ||
             (this._speciesKeys.has(who) ? who : null);
    };
    return {
      title: (c && c.title) || (() => this._name(species())),
      sprite: (c && c.sprite) || (() => this._spriteFor(species())),
      scale: (c && c.scale) || 1,
      sound: (c && c.sound) || (() => this._soundFor(species())),
      pitch: (c && c.pitch) || 1,
      entities: () => { const e = ent(); return e ? [e] : []; }
    };
  }

  _isMoa(k) { return typeof MOA_SPECIES !== 'undefined' && !!MOA_SPECIES[k]; }
  _spriteFor(k) {
    if (this._isMoa(k)) return 'upland_moa';   // (the one moa portrait the guide panel has)
    if (k === 'haasts_eagle' || k === 'kea') return k;
    return CHAPTER_GUIDE.sprite;
  }
  _soundFor(k) {
    if (this._isMoa(k)) return 'moa';
    if (k === 'haasts_eagle') return 'eagle';
    if (k === 'kea') return 'kea';
    return null;
  }
  _name(k) {
    if (!k) return '';
    return (this.game && this.game._freeplaySpeciesName) ? this.game._freeplaySpeciesName(k) : k;
  }

  // ---- Reference checks (the validator) -------------------------------------
  _checkRef(ref, where) {
    if (typeof ref !== 'string') return;
    if (ref === 'guide' || ref.startsWith('$') || this.castDefs[ref] || this._speciesKeys.has(ref)) return;
    this._issue(`${where} "${ref}" is not the guide, a $role, a cast name or one of the level's species`);
  }

  // What each tool's argument names: tools, species, places, plants.
  _checkAction(verb, arg, where) {
    const species = (k) => { if (!this._speciesKeys.has(k)) this._issue(`${where}: "${k}" isn't in the level's species`); };
    const spec = arg || {};
    if (verb === 'unlock' || verb === 'lock') for (const k of [].concat(arg)) this._checkTool(k, where);
    else if (verb === 'tools') for (const k of (Array.isArray(arg) ? arg : Object.keys(arg || {}))) this._checkTool(k, where);
    else if (verb === 'focus') [].concat(arg || []).forEach(species);
    else if (verb === 'introduce') [].concat(arg || []).forEach(s => species(s && s.type));
    else if (verb === 'nesting' && arg) species(arg.species);
    else if (verb === 'place') {
      if (typeof PLACEABLES !== 'undefined' && !PLACEABLES[spec.type]) this._issue(`${where}: unknown placeable "${spec.type}"`);
      this._checkPoint(spec.at, `${where}: place at`);
    } else if (verb === 'sow') {
      if (typeof PLANT_TYPES !== 'undefined' && !PLANT_TYPES[spec.plant]) this._issue(`${where}: unknown plant "${spec.plant}"`);
      this._checkPoint(spec.at, `${where}: sow at`);
    } else if (verb === 'spawn') {
      species(spec.type);
      this._checkPoint(spec.at, `${where}: spawn at`);
    } else if (verb === 'moment') this._checkPoint(spec.on, `${where}: moment on`);
    else if (verb === 'aim') {
      [].concat(spec.at || []).forEach(r => this._checkRef(r, `${where}: aim at`));
      // An aim is the force half of a guaranteed beat. Anywhere else it is a scripted attack that
      // the log won't call forced: say so.
      if (!/^beat:.*:force$/.test(where)) this._issue(`warning: ${where}: aim outside a beat's force is a scripted attack; prefer a beat with invite and force`);
    }
    else if (verb === 'nest') this._checkPoint(spec.at, `${where}: nest at`);
    else if (verb === 'lay') { species(spec.species); this._checkPoint(spec.at, `${where}: lay at`); }
    else if (verb === 'adopt') {
      for (const name of Object.keys(spec || {})) {
        if (!this.castDefs[name]) this._issue(`${where}: adopt "${name}", which isn't in the level's cast`);
        const want = spec[name];
        if (want && typeof want === 'object') { if (want.species) species(want.species); if (want.near) this._checkPoint(want.near, `${where}: adopt near`); }
        else this._checkRef(want, `${where}: adopt`);
      }
    }
    else if (verb === 'fade') { if (spec.type && typeof PLACEABLES !== 'undefined' && !PLACEABLES[spec.type]) this._issue(`${where}: unknown placeable "${spec.type}"`); }
    else if (verb === 'guide') { if (typeof ENCYCLOPEDIA_BY_ID !== 'undefined' && !ENCYCLOPEDIA_BY_ID[arg]) this._issue(`${where}: no Field Guide entry "${arg}"`); }
    else if (verb === 'eagle') {
      if (spec.watch) this._checkPoint(spec.watch, `${where}: eagle watch`);
      if (spec.which && !['all', 'nearest'].includes(spec.which)) this._checkRef(spec.which, `${where}: eagle which`);
    }
  }

  // A place reference: a site name, or anything entity() can find (a $role, cast name, species).
  _checkPoint(ref, where) {
    if (ref == null) { this._issue(`${where}: no place given`); return; }
    if (typeof ref !== 'string') { if (ref.find || ref.near) this._checkSiteSpec(ref, where); return; }
    if (this._siteNames.has(ref)) return;
    if (ref === 'guide' || ref.startsWith('$') || this.castDefs[ref] || this._speciesKeys.has(ref)) return;
    if (/^"near"/.test(where) && typeof PLACEABLES !== 'undefined' && PLACEABLES[ref]) return;   // (a placeable type, in `near`)
    this._issue(`${where} "${ref}" is not a site, a $role, a cast name or one of the level's species`);
  }

  _checkSiteSpec(spec, where) {
    if (!spec || typeof spec !== 'object') { this._issue(`${where}: a site is an object`); return; }
    if (spec.find && !CHAPTER_SITE_FINDERS.has(spec.find)) this._issue(`${where}: unknown site finder "${spec.find}"`);
    if (spec.near) this._checkPoint(spec.near, `${where}: near`);
    if (spec.species) { if (!this._speciesKeys.has(spec.species)) this._issue(`${where}: "${spec.species}" isn't in the level's species`); }
  }

  _checkTool(key, where) {
    if (typeof PLACEABLES !== 'undefined' && !PLACEABLES[key]) this._issue(`${where}: unknown tool "${key}"`);
    else if (!(this.level.availablePlaceables || {})[key]) {
      this._issue(`${where}: tool "${key}" isn't in the level's availablePlaceables`);
    }
  }

  _checkRefs() {
    if (!this.chapters.length) this._issue('the level has no chapters');
    for (const ch of this.chapters) {
      for (const r of ch.nextRules || []) {
        if (r.id !== 'win' && !this.byId[r.id]) this._issue(`chapter "${ch.id}" goes on to "${r.id}", which doesn't exist`);
      }
    }
    const goalIds = new Set(this.chapters.flatMap(ch => ch.goals.map(g => g.id)));
    for (const id of this._goalRefs || []) {
      if (!goalIds.has(id)) this._issue(`a condition waits on goal "${id}", which no chapter has`);
    }
    for (const r of this.reactions) {
      for (const c of [].concat(r.chapters || [])) {
        if (!this.byId[c]) this._issue(`reaction "${r.id}" is scoped to chapter "${c}", which doesn't exist`);
      }
    }
    const beatIds = this.chapters.flatMap(ch => ch.beats.map(b => b.id));
    if (new Set(beatIds).size !== beatIds.length) this._issue('two beats have the same id (beat ids are level-wide)');
    for (const id of this._beatRefs || []) {
      if (!beatIds.includes(id)) this._issue(`a condition waits on beat "${id}", which no chapter has`);
    }
    const sites = this.level.sites || {};
    for (const name of Object.keys(sites)) this._checkSiteSpec(sites[name], `site "${name}"`);
    // The level's own keys: what a module teaches, what it unlocks, which family of sketches it
    // belongs to, what comes next.
    const L = this.level;
    if (L.module && !(typeof L.claim === 'string' && L.claim.trim())) this._issue('a module needs a one-line `claim`: the rule it teaches');
    for (const id of [].concat(L.guide || [])) {
      if (typeof ENCYCLOPEDIA_BY_ID !== 'undefined' && !ENCYCLOPEDIA_BY_ID[id]) this._issue(`guide: no Field Guide entry "${id}"`);
    }
    if (L.sketch) {
      if (!L.sketch.of || !L.sketch.label) this._issue('`sketch` needs { of: familyId, label }');
      else if (typeof LEVEL_REGISTRY !== 'undefined' && LEVEL_REGISTRY.getFamily && !LEVEL_REGISTRY.getFamily(L.sketch.of)) {
        this._issue(`warning: sketch.of "${L.sketch.of}" isn't a registered family (LEVEL_REGISTRY.registerFamily)`);
      }
    }
    if (L.nextLevel && typeof LEVEL_REGISTRY !== 'undefined' && LEVEL_REGISTRY.get && !LEVEL_REGISTRY.get(L.nextLevel)) {
      this._issue(`warning: nextLevel "${L.nextLevel}" isn't a registered level`);
    }
  }

  // ==========================================================================
  // THE SIMULATION, AS THE CONDITIONS SEE IT
  // ==========================================================================
  get sim() { return this.game.simulation; }

  // Every live entity of a species (moa, bird or eagle).
  allOf(k) {
    const sim = this.sim, out = [];
    for (const m of sim.moas) if (m.alive && m.speciesKey === k) out.push(m);
    for (const e of (sim.otherEntities && sim.otherEntities[k]) || []) if (e.alive) out.push(e);
    if (k === 'haasts_eagle' || (typeof EAGLE_SPECIES !== 'undefined' && EAGLE_SPECIES[k])) {
      for (const e of sim.eagles || []) if (e.alive) out.push(e);
    }
    return out;
  }

  countOf(who) {
    const sim = this.sim;
    if (who === 'moa') return sim.getMoaPopulation();
    if (who === 'eagles') return sim.countAliveEagles();
    if (who === 'eggs') return sim.getAliveEggsCount();
    if (who === 'focus') return this.focus.length ? Math.min(...this.focus.map(k => sim.getSpeciesCount(k))) : 0;
    return sim.getSpeciesCount(who);
  }

  // None alive and no egg of it incubating. 'focus': any focus species (noting which, for the
  // loss's words).
  extinct(who) {
    const keys = who === 'focus' ? this.focus : [who];
    for (const k of keys) {
      if (this.sim.getSpeciesCount(k) > 0) continue;
      if (this.sim.eggs.some(e => e.alive && !e.hatched && e.parentSpecies === k)) continue;
      this._extinctKey = k;
      return true;
    }
    return false;
  }

  focusHunted() {
    return (this.sim.eagles || []).some(e => e.alive && e.hunting && e.target && this.isFocus(e.target.speciesKey));
  }

  isFocus(k) { return !!k && this.focus.includes(k); }

  // Counters: event counts (see _count) and two read live (mauri earned, nests founded).
  _counter(name) {
    if (name === 'mauri') return this.game.mauri.totalEarned;
    if (name === 'nests') return (this.sim.stats && this.sim.stats.nestingSitesMade) || 0;
    return this.counters[name] || 0;
  }

  // A scope: the counters and the clock as they stand now, for gained / placed / after.
  scope() {
    const base = Object.assign({}, this.counters);
    base.mauri = this._counter('mauri');
    base.nests = this._counter('nests');
    return { base, t0: this.game.playTime };
  }

  gained(name, scope) {
    const s = scope || this.scopeCh;
    return this._counter(name) - ((s && s.base[name]) || 0);
  }

  scopeTime(scope) { const s = scope || this.scopeCh; return this.game.playTime - (s ? s.t0 : 0); }

  seasonsIn() { return this.seasonTurns - (this._seasonsAt || 0); }

  // ---- Events and roles ------------------------------------------------------
  subject(ev) {
    const spec = ev && CHAPTER_EVENTS[ev.name];
    return (spec && spec.subject) ? ev[spec.subject] || null : null;
  }

  subjectSpecies(ev) {
    if (!ev) return null;
    if (ev.speciesKey) return ev.speciesKey;
    const s = this.subject(ev);
    return (s && (s.speciesKey || s.parentSpecies)) || null;
  }

  // An entity by reference: '$role' (a field of the event), a cast name, or a species key
  // (the event's subject if it's one, else the first alive).
  entity(ref, ev) {
    if (ref && typeof ref === 'object' && ref.pos) return ref;   // (an entity itself, from a function)
    if (!ref || ref === 'guide' || typeof ref !== 'string') return null;
    if (ref.startsWith('$')) return (ev && ev[ref.slice(1)]) || null;
    if (this.castDefs[ref]) return this.castEnts[ref] || null;
    const s = this.subject(ev);
    if (s && (s.speciesKey || s.parentSpecies) === ref) return s;
    return this.allOf(ref)[0] || null;
  }

  // What a line or banner lights up: roles, cast names, species (all of them), 'focus' (every
  // focus bird), 'nests', or a placeable type (every one placed).
  lit(list, ev) {
    if (!list || !this.game) return [];
    const out = [];
    for (const ref of [].concat(list)) {
      if (ref === 'focus') { for (const k of this.focus) out.push(...this.allOf(k)); }
      else if (ref === 'nests') out.push(...(this.sim.nestingSites || []).filter(s => s.alive !== false));
      else if (typeof ref === 'string' && (ref.startsWith('$') || this.castDefs[ref])) out.push(this.entity(ref, ev));
      else if (this._speciesKeys.has(ref)) out.push(...this.allOf(ref));
      else if (typeof PLACEABLES !== 'undefined' && PLACEABLES[ref]) out.push(...this.sim.placeables.filter(p => p.alive && p.type === ref));
    }
    return out.filter(e => e && e.alive !== false);
  }

  // Words with their blanks filled: {species} (the event's, or the one that died out),
  // {chapter} (this chapter's title).
  fill(text, ev) {
    if (typeof text !== 'string') return text;
    return text
      .replace(/\{species\}/g, () => this._name(this.subjectSpecies(ev) || this._extinctKey))
      .replace(/\{chapter\}/g, () => (this.cur ? this.cur.title : ''))
      .replace(/\{year\}/g, () => String(this.yearNow()))
      // {$name}: a value a function action left in runner.vars (a year's tally, a name).
      .replace(/\{\$(\w+)\}/g, (_, k) => (this.vars[k] != null ? String(this.vars[k]) : ''));
  }

  // The tutorial passes every event here first (TutorialManager.fireEvent): counted at once (a
  // banner waiting on a placement sees it while the game is paused), reacted to after the sim
  // step (see update).
  onEvent(type, data) {
    if (this._ended || !CHAPTER_EVENTS[type]) return;
    const ev = Object.assign({ name: type }, data);
    this._count(ev);
    // What the player's own hand did goes in the record, with the second it was done.
    if (CHAPTER_PLAYER_EVENTS.has(type)) this._log('player', type, (data && (data.type || data.speciesKey)) || '');
    if (type === 'season_change') this.seasonTurns++;
    this._seenLog.push({ name: type, t: this.game ? this.game.playTime : 0, ev });
    if (this._seenLog.length > 512) this._seenLog.shift();
    this._events.push(ev);
  }

  _count(ev) {
    const spec = CHAPTER_EVENTS[ev.name];
    if (!spec || !spec.count) return;
    const add = (k) => { this.counters[k] = (this.counters[k] || 0) + 1; };
    add(spec.count);
    const sp = this.subjectSpecies(ev);
    if (sp) add(`${spec.count}:${sp}`);
    if (ev.type) add(`${spec.count}:${ev.type}`);
    if (ev.name === 'nest_raid' && ev.success) add('raidsWon');
  }

  _emit(name, data = {}) { this._events.push(Object.assign({ name }, data)); }

  // ==========================================================================
  // RUNNING
  // ==========================================================================
  start() {
    this._restoreMechanics();
    this._nests = this._counter('nests');
    this._adoptCast();
    this._resolveSites(this.level.sites);
    // A journey level reads the campaign record as it starts: who is alive becomes story
    // flags and words (mauri_campaign.js), so its reactions can say `if: { flag: 'papa_lost' }`.
    if (this.level.journey && typeof CAMPAIGN !== 'undefined') CAMPAIGN.begin(this);
    let first = this.chapters[0] && this.chapters[0].id;
    // ?chapter=<id> starts the level there (the season clock isn't moved).
    const want = (typeof window !== 'undefined' && window.location)
      ? new URLSearchParams(window.location.search).get('chapter') : null;
    if (want && this.byId[want]) first = want;
    if (first) this._enter(first);
  }

  // Console: game.chapters.jump('winter') closes nothing and opens that chapter now.
  jump(id) {
    if (!this.byId[id]) { console.warn(`[chapters] no chapter "${id}"`); return; }
    this._log('jump', id);
    this._nextReq = null;
    this._enter(id);
  }

  dump() { console.table(this.log); }

  // How far to move the season clock this frame: a chapter's holdSeason keeps it waiting at
  // `at` of the way through the season until its condition holds.
  seasonStep(dt) {
    const h = this.cur && this.cur.hold;
    if (!h || this._ended || this._holdReleased || h.until(this._ctx())) return dt;
    const sm = this.game.seasonManager, holdAt = h.at * CONFIG.seasonDuration;
    const step = Math.max(0, Math.min(dt, holdAt - sm.timer));
    if (step < dt) {   // holding: count it, and let go after maxSec
      this._heldFrames = (this._heldFrames || 0) + (dt - step);
      if (h.maxSec && this._heldFrames >= h.maxSec * CHAPTER_FPS) {
        this._holdReleased = true;
        this._log('hold', this.cur.id, 'released after maxSec');
        return dt;
      }
    }
    return step;
  }

  // After the sim step (Game.update): react to this frame's events, then (every CHAPTER_POLL
  // frames) the polled reactions, the cast, the goals, the lose rules and the chapter's end.
  update(dt) {
    if (this._ended || !this.cur) return;
    if (this.game.state !== GAME_STATE.PLAYING) return;
    for (let n = 0; this._events.length && n < 64; n++) this._react(this._events.shift());
    // (Its own tick, not frameCount: a headless game.update(1) loop doesn't move frameCount.)
    this._tick = ((this._tick || 0) + 1) % CHAPTER_POLL;
    if (this._tick !== 0 || this._ended) return;
    if (this.game._yearTransition) return;   // (a world-grid move: last area's counts)

    this._watchNests();
    this._watchCast();
    this._updateWeather(CHAPTER_POLL);
    for (const rx of this.reactions) {
      if (!rx.when) continue;
      // A polled reaction fires as its condition turns true (or, a need with `for`, once it has
      // held that long), and not again until it has turned false in between.
      let now = rx.when(this._ctx());
      if (rx.forFrames) {
        if (!now) rx.heldSince = null;
        else if (rx.heldSince == null) rx.heldSince = this.game.playTime;
        now = now && this.game.playTime - rx.heldSince >= rx.forFrames;
      }
      if (now && !rx.was && this._mayFire(rx)) this._fire(rx, { name: 'when' });
      rx.was = now;
      if (this._ended) return;
    }
    this._updateCases();
    if (this._ended) return;
    this._updateBeats();
    if (this._ended) return;
    this._checkGoals();
    if (this._ended) return;
    for (const r of this.loseRules) {
      if (r.when(this._ctx())) { this.lose(this.fill(r.reason, null)); return; }
    }
    if (this._nextReq || this.cur.until(this._ctx())) this._close();
  }

  _ctx(event = null, scope = null) {
    return { runner: this, game: this.game, event, scope: scope || this.scopeCh };
  }

  _enter(id) {
    const ch = this.byId[id];
    if (!ch) { this._issue(`there's no chapter "${id}" to go on to`); this._win(); return; }
    const g = this.game, sim = this.sim, d = ch.def;
    this.cur = ch;
    this.scopeCh = this.scope();
    this._seasonsAt = this.seasonTurns;
    this._nextReq = null;

    // Levers: the same verbs as the actions. Each stays in force until something sets it again.
    const x = { runner: this, game: g, event: null };
    for (const [key, verb] of CHAPTER_LEVERS) {
      if (d[key] !== undefined && (d[key] !== null || key === 'nesting')) CHAPTER_ACTIONS[verb](d[key], x);
    }
    this._adoptCast();
    this._resolveSites(d.sites);

    // Its beats, fresh (a chapter visited again runs them again).
    // (A beat with once: true stays done when its chapter comes round again: a first-year lesson.)
    const keep = (b) => b.once && this.beatsDone.has(b.id);
    this.beatState = ch.beats.map(b => ({ b, phase: keep(b) ? 'done' : 'waiting', t0: 0, scope: null, forced: false }));
    for (const b of ch.beats) if (!keep(b)) this.beatsDone.delete(b.id);
    this._heldFrames = 0;
    this._holdReleased = false;

    // Goals: the panel shows this chapter's.
    this.goals = ch.goals.map(cg => ({
      id: cg.id, _g: cg, name: cg.def.name || cg.id,
      reward: cg.def.reward || 0, stretch: !!cg.def.stretch, required: !!cg.def.required,
      achieved: false, failed: false
    }));
    for (const goal of this.goals) this._nameGoal(goal);
    g.goals = this.goals;
    this._goalsOffered += this.goals.length;
    g._goalsTotal = this._goalsOffered;

    g.addNotification(ch.title, 'success');
    this._log('chapter', id);
    this._emit('chapter_start', { chapter: id });
    this._run(ch.start, null);
  }

  // The chapter's end: what held to the end is met (keep, survive), a required goal still
  // unmet loses, and otherwise the next chapter opens (or the level is won).
  _close() {
    const ch = this.cur;
    for (const goal of this.goals) {
      if (goal.achieved || goal.failed) continue;
      if (goal._g.def.survive || goal._g.keep) this._meet(goal);
      else if (goal.required) { this._failGoal(goal); if (this._ended) return; }
    }
    const next = this._nextReq || this._resolveNext(ch);
    this._log('close', ch.id, `-> ${next}`);
    if (next === 'win') this._win();
    else this._enter(next);
  }

  _resolveNext(ch) {
    if (ch.nextRules) {
      for (const r of ch.nextRules) if (r.test(this._ctx())) return r.id;
    }
    const i = this.chapters.indexOf(ch);
    return this.chapters[i + 1] ? this.chapters[i + 1].id : 'win';
  }

  // ---- Goals ----------------------------------------------------------------------
  _checkGoals() {
    const x = this._ctx();
    for (const goal of this.goals) {
      if (goal.achieved || goal.failed) continue;
      const cg = goal._g;
      if (cg.done && cg.done(x)) this._meet(goal);
      else if (cg.keep && !cg.keep(x)) this._failGoal(goal);
      else this._nameGoal(goal);
      if (this._ended) return;
    }
  }

  chapterGoalsMet() {
    return this.goals.every(g => g.stretch || g.achieved || (!g._g.done && !g.failed));
  }

  // The goal's words with {n} (its live value) and {target} filled.
  _nameGoal(goal) {
    const p = goal._g.progress, words = this.fill(goal._g.def.name || goal.id, null);
    if (!p) { goal.name = words; return; }
    let n;
    if (p.kind === 'count') n = this.countOf(p.what);
    else if (p.kind === 'gained') n = this.gained(p.what);
    else n = Math.floor(this.game.mauri.mauri);
    goal.name = words.replace(/\{n\}/g, Math.max(0, Math.round(n))).replace(/\{target\}/g, p.target);
  }

  _meet(goal) {
    const g = this.game;
    goal.achieved = true;
    this._nameGoal(goal);
    this.met.add(goal.id);
    g._goalsCompleted = (g._goalsCompleted || 0) + 1;
    if (goal.reward) g.mauri.earn(goal.reward, CONFIG.width / 2 / CONFIG.zoom, 80, 'goal');
    g.addNotification(`Goal achieved: ${goal.name}!${goal.reward ? ` +${goal.reward} mauri` : ''}`, 'success');
    this._log('goal', goal.id);
    this._emit('goal_met', { goal: goal.id });
  }

  _failGoal(goal) {
    goal.failed = true;
    this.game.addNotification(`Goal missed: ${goal.name}`, 'error');
    this._log('missed', goal.id, goal.required ? 'required' : '');
    this._emit('goal_failed', { goal: goal.id });
    if (goal.required) this.lose(goal._g.def.failReason || `Goal missed: ${goal.name}`);
  }

  // ---- Reactions ------------------------------------------------------------------
  _react(ev) {
    for (const rx of this.reactions) {
      if (rx.on !== ev.name || !this._mayFire(rx)) continue;
      if (rx.test && !rx.test(this._ctx(ev))) continue;
      this._fire(rx, ev);
      if (this._ended) return;
    }
    // A running beat whose `until` holds at this event is done now, not at the next poll: an
    // eagle's lock (hunting, hunted) can be gone by then, and a `seen` is true from this event on.
    for (const s of this.beatState) {
      if (s.phase !== 'running' || !s.b.until) continue;
      if (s.b.until(this._ctx(ev, s.scope))) { this._beatDone(s); if (this._ended) return; }
    }
  }

  _mayFire(rx) {
    if (rx.once && rx.fired) return false;
    if (rx.fired >= rx.max) return false;
    if (this.game.playTime - rx.lastAt < rx.cooldown) return false;
    if (rx.owner && (!this.cur || this.cur.id !== rx.owner)) return false;
    if (rx.chapters && !(this.cur && rx.chapters.includes(this.cur.id))) return false;
    return true;
  }

  _fire(rx, ev) {
    rx.fired++;
    rx.lastAt = this.game.playTime;
    this._log('reaction', rx.id, ev && ev.name);
    this._run(rx.actions, ev);
    if (rx.until && (rx.hints.length || rx.solved)) {
      this._cases.push({ rx, ev, t0: this.game.playTime, scope: this.scope(), rung: 0 });
    }
  }

  // ---- Hint ladders ---------------------------------------------------------------------
  // A reaction with `hints` and an `until` opens a CASE each time it fires: a problem the
  // simulation has raised (an eagle on a moa, a storm blown out). Nothing is said at first:
  // what the player can see is the clue. While `until` has not come true, each rung is said at
  // its `after` time (a question, then the instruction). When `until` holds the case closes
  // and the record keeps how far up the ladder it went, how long it took, and whether it ended
  // the way `solved` describes (the player's own answer) or some other way. In a chapter marked
  // `transfer: true` no rung is said at all: the stretch that tests what was learned.
  // The record (caseLog, exported with the run) is the measure of the learner, as natural or
  // forced beats are the measure of the stage.
  _updateCases() {
    const now = this.game.playTime, quiet = !!(this.cur && this.cur.def.transfer);
    for (let i = this._cases.length - 1; i >= 0; i--) {
      const c = this._cases[i], rx = c.rx, x = this._ctx(c.ev, c.scope);
      // (A case is dropped as stale after two minutes; a slow problem, such as a riddle that
      // takes a year to answer, says how long it may stand with `staleSec`.)
      const done = rx.until(x), stale = now - c.t0 > (rx.def.staleSec || 120) * CHAPTER_FPS;
      if (done || stale) {
        this._cases.splice(i, 1);
        // solved: it ended the way the player's own answer ends it. lost: it ended badly (the
        // reaction's `lost`). passed: it went away some other way (the bird hid itself, the
        // eagle turned elsewhere).
        const outcome = stale && !done ? 'timed out'
          : (rx.solved && rx.solved(x) ? 'solved' : (rx.lost && rx.lost(x) ? 'lost' : (rx.solved ? 'passed' : 'over')));
        const subj = this.subject(c.ev);
        const rec = { id: rx.id, t: Math.round(now / CHAPTER_FPS * 10) / 10, sec: Math.round((now - c.t0) / CHAPTER_FPS * 10) / 10,
                      rung: c.rung, outcome, who: (subj && (subj.castName || subj.speciesKey)) || '',
                      chapter: this.cur ? this.cur.id : '', transfer: quiet };
        this.caseLog.push(rec);
        const add = (k) => { this.counters[k] = (this.counters[k] || 0) + 1; };
        add('cases'); if (outcome === 'solved') { add('solved'); if (c.rung === 0) add('unaided'); }
        this._log('case', rx.id, `rung ${c.rung}, ${rec.sec}s, ${outcome}${quiet ? ', transfer' : ''}`);
        this._emit('case_closed', { case: rx.id, rung: c.rung, outcome, sec: rec.sec, transfer: quiet });
        continue;
      }
      if (!quiet && c.rung < rx.hints.length && now - c.t0 >= rx.hints[c.rung].after) {
        this._run(rx.hints[c.rung].actions, c.ev);
        c.rung++;
        this._log('hint', rx.id, `rung ${c.rung}`);
        if (this._ended) return;
      }
    }
  }

  // For the win card: how many of the problems with a "solved" ending the player answered
  // before any hint was said, and (where the level has one) how the unprompted stretch went.
  unaidedLine() {
    const all = this.caseLog.filter(c => c.outcome === 'solved' || c.outcome === 'lost');
    if (!all.length) return '';
    const tr = all.filter(c => c.transfer), main = all.filter(c => !c.transfer);
    const part = (list) => `${list.filter(c => c.outcome === 'solved' && c.rung === 0).length} of ${list.length}`;
    return tr.length ? `Without a hint: ${part(main)}. On your own at the end: ${part(tr)}.` : `Without a hint: ${part(main)}.`;
  }

  _run(actions, ev) {
    const x = { runner: this, game: this.game, event: ev };
    for (const a of actions) {
      if (this._ended) return;
      if (a.fn) {
        try { a.fn(x); } catch (e) { console.warn('[chapters] action error:', e); }
        continue;
      }
      if (a.chained) continue;   // (it comes after the lines before it)
      CHAPTER_ACTIONS[a.verb](a.cue || a.arg, x);
    }
  }

  // Show a compiled line or banner: the event it answers is kept for its roles (and for a
  // banner its last line leads to).
  cue(id, ev) {
    this.cueData[id] = ev || {};
    if (this._chain[id]) this.cueData[this._chain[id]] = ev || {};
    const tut = this.game.tutorial;
    if (tut) tut.fireEvent(TUTORIAL_EVENTS.STORY_BEAT, { cue: id });
  }

  // ---- Guaranteed beats (see _compileBeat) -----------------------------------------
  _updateBeats() {
    const now = this.game.playTime;
    for (const s of this.beatState) {
      if (s.phase === 'done') continue;
      const b = s.b;
      if (s.phase === 'waiting') {
        if (b.when && !b.when(this._ctx())) continue;
        s.phase = 'running';
        s.t0 = now;
        s.scope = this.scope();   // (its until's gained / placed / after count from here)
        this._log('beat', b.id, 'start');
        this._run(b.invite, null);
        if (this._ended) return;
      }
      if (b.until && b.until(this._ctx(null, s.scope))) this._beatDone(s);
      else if (!s.forced && b.by != null && now - s.t0 >= b.by) {
        s.forced = true;
        this._log('beat', b.id, 'forced');
        this._run(b.force, null);
        if (!b.until) this._beatDone(s);
      } else if (!b.until && b.by == null) this._beatDone(s);
      if (this._ended) return;
    }
  }

  _beatDone(s) {
    s.phase = 'done';
    this.beatsDone.set(s.b.id, this.game.playTime);
    this._log('beat', s.b.id, s.forced ? 'done (forced)' : 'done');
    this._emit('beat', { beat: s.b.id, forced: s.forced });
    this._run(s.b.actions, { name: 'beat', beat: s.b.id, forced: s.forced });
  }

  // ---- Levers ---------------------------------------------------------------------
  // The toolbar: keys of the level's availablePlaceables (an object takes overrides).
  setTools(tools) {
    const g = this.game;
    const avail = Array.isArray(tools) ? Object.fromEntries(tools.map(k => [k, {}])) : tools;
    g.activePlaceables = g._resolvePalette(avail);
    if (g.ui && g.ui._calculateLayoutPositions) g.ui._calculateLayoutPositions();
    if (g.selectedPlaceable && !g.activePlaceables[g.selectedPlaceable]) g.selectedPlaceable = null;
  }

  // { type, count }: newcomers, set down by habitat as the level's own cast is.
  introduce(list) {
    for (const spec of [].concat(list || [])) {
      if (!spec || !this.game._speciesUsable(spec.type)) continue;
      this.game._spawnFreeplaySpecies(spec.type, spec.count || 1);
    }
  }

  setFocus(keys) {
    this.focus = [].concat(keys || []).filter(k => this.game._speciesUsable(k));
    if (typeof SPECIES_HIGHLIGHT !== 'undefined') {
      SPECIES_HIGHLIGHT.clear();
      for (const k of this.focus) SPECIES_HIGHLIGHT.add(k);
    }
  }

  // Every other species present holds at this floor: it can't be hunted or starved below it
  // (Simulation.isSpeciesProtected), so the focus species carry the risk.
  setProtect(floor) {
    const sim = this.sim, floors = {};
    for (const k of this._speciesKeys) {
      if (!this.isFocus(k) && !(typeof EAGLE_SPECIES !== 'undefined' && EAGLE_SPECIES[k]) &&
          sim.getSpeciesCount(k) > 0) floors[k] = floor;
    }
    sim.dynamicFloors = floors;
  }

  // { species, plant }: two patches of the plant with that moa drawn in found a nest
  // (Simulation._updateMoaNestingFormation). null: no founding.
  setNesting(spec) {
    this.sim.moaNestingWatch = spec ? { speciesKey: spec.species, plantType: spec.plant } : null;
  }

  // ---- Pressure from the eagles ---------------------------------------------------
  // The live eagles a spec means: which: 'all' (the default), 'nearest' (to `near`, else to
  // the place being watched), or a role or cast name.
  _eagles(spec, ev) {
    const all = (this.sim.eagles || []).filter(e => e.alive);
    const which = spec.which || 'all';
    if (which === 'all') return all;
    if (which === 'nearest') {
      const p = this.point(spec.near || spec.watch, ev);
      if (!p || all.length < 2) return all.slice(0, 1);
      const d = (e) => Math.hypot(e.pos.x - p.x, e.pos.y - p.y);
      return [all.reduce((a, b) => d(a) <= d(b) ? a : b)];
    }
    const e = this.entity(which, ev);
    return e && e.alive ? [e] : [];
  }

  // { which, hunger, watch, grace }: set their hunger (0 to 100; they hunt past about 45), move
  // their patrol over a place (they fly there and circle it), or give a "last chance" of `grace`
  // seconds (it chases but can't strike: HaastsEagle.tutorialGraceTimer). With `away` (seconds)
  // it flies off the land on an errand and comes back to its patrol (HaastsEagle.sendAway);
  // `hunger` is then its hunger as it comes back.
  eaglePressure(spec, ev) {
    const p = spec.watch ? this.point(spec.watch, ev) : null;
    for (const e of this._eagles(spec, ev)) {
      if (spec.away && e.sendAway) {
        if (p) e._relocateTerritory(p.x, p.y);
        e.sendAway(spec.away, { hungerBack: spec.hunger });
        this._log('eagle_away', `${spec.away}`);
        continue;
      }
      if (spec.hunger != null) e.hunger = Math.max(0, Math.min(e.maxHunger, spec.hunger));
      if (p) e._relocateTerritory(p.x, p.y);
      if (spec.grace) e.tutorialGraceTimer = spec.grace * CHAPTER_FPS;
    }
  }

  // { at, which, sec }: an eagle (the nearest, unless `which` says) goes for a named bird for
  // `sec` (20) seconds, whatever its hunger. It still can't see one under cover
  // (HaastsEagle.aimAt). `at` can list fallbacks: ['matriarch', 'upland_moa'] (the first alive).
  aim(spec, ev) {
    const cands = [].concat(spec.at).map(r => this.entity(r, ev)).filter(e => e && e.alive && e.pos);
    const target = cands.find(e => !e.inShelter) || cands[0];   // (one in the open first: cover hides the rest)
    if (!target) { this._log('issue', 'aim', 'nothing to aim at'); return; }
    const [e] = this._eagles(Object.assign({ which: 'nearest' }, spec, { near: target }), ev);
    if (!e) return;
    e.aimAt = target;
    e.aimTimer = (spec.sec || 20) * CHAPTER_FPS;
    e._relocateTerritory(target.pos.x, target.pos.y);
    this._log('aim', target.castName || target.speciesKey || '');
  }

  // ---- The new conditions' readings -------------------------------------------------
  yearNow() { return Math.floor(((this.sim && this.sim.seasonTurns) || 0) / 4) + 1; }

  eagleHungerMax() {
    let h = -1;
    for (const e of (this.sim.eagles || [])) if (e.alive && !e._away && e.hunger > h) h = e.hunger;   // (not one off the land)
    return h;
  }

  statOf(e, field) {
    if (field === 'hunger') return e.hunger || 0;
    if (field === 'age') return (e.age || 0) / CHAPTER_FPS;
    if (field === 'size') return e.size || 0;
    return 0;
  }

  // near: [a, b, dist]. `a` as a species key means any live one of them; else both are places.
  nearCheck(a, b, dist, ev) {
    const q = this.point(b, ev);
    if (!q) return false;
    const d2 = dist * dist;
    const within = (e) => { const dx = e.pos.x - q.x, dy = e.pos.y - q.y; return dx * dx + dy * dy <= d2; };
    if (typeof a === 'string' && this._speciesKeys.has(a) && !this.castDefs[a] && !this.sites[a]) {
      return this.allOf(a).some(within);
    }
    // A placeable type: any live one of them (a wharariki by the family, say).
    if (typeof a === 'string' && !this.sites[a] && !this.castDefs[a] && typeof PLACEABLES !== 'undefined' && PLACEABLES[a]) {
      return this.sim.placeables.some(p => p.alive && p.type === a && within(p));
    }
    const p = this.point(a, ev);
    if (!p) return false;
    const dx = p.x - q.x, dy = p.y - q.y;
    return dx * dx + dy * dy <= d2;
  }

  // seen: an event of that name since the scope began, passing `test` (compiled filters) if any.
  seenCheck(name, test, scope) {
    const s = scope || this.scopeCh, t0 = s ? s.t0 : 0;
    for (let i = this._seenLog.length - 1; i >= 0; i--) {
      const r = this._seenLog[i];
      if (r.t < t0) break;
      if (r.name !== name) continue;
      if (!test || test({ runner: this, game: this.game, event: r.ev, scope: s })) return true;
    }
    return false;
  }

  // ---- The stage, continued: nests, eggs, named birds, storms wearing out, the guide --------
  // { at, radius, reservedFor, hideClutch, as }: an established nest at a place
  // (Simulation.addNestingSite). `as` names the site so later places can refer to it.
  nest(spec, ev) {
    const p = this.point(spec.at, ev);
    if (!p || !this.sim.addNestingSite) { this._log('issue', 'nest', `no place "${spec.at}"`); return null; }
    const site = this.sim.addNestingSite(p.x, p.y, { radius: spec.radius, reservedFor: spec.reservedFor, hideClutch: spec.hideClutch });
    if (site && spec.as) this.sites[spec.as] = { x: p.x, y: p.y };
    this._log('nest', typeof spec.at === 'string' ? spec.at : '', spec.as || '');
    return site;
  }

  // { species, at, count = 1, incubationSec, scene }: an egg (or a clutch) at a place. Scripted,
  // so it is not counted as laid (the player's and the birds' own eggs are). `scene` (true, or
  // { sec = 3 }): when its time is up it hatches as the modules' eggs did, rocking and cracking
  // for a few seconds with the camera close in, and leaves its shell (Game.onHatchScene).
  lay(spec, ev) {
    const p = this.point(spec.at, ev);
    if (!p || !this.sim.addEggAt) { this._log('issue', 'lay', `no place "${spec.at}"`); return; }
    const n = spec.count || 1;
    for (let i = 0; i < n; i++) {
      const a = random(TWO_PI), d = n > 1 ? random(2, 10) : 0;
      this.sim.addEggAt(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, spec.species,
        { incubationFrames: spec.incubationSec != null ? spec.incubationSec * CHAPTER_FPS : undefined,
          hatchScene: spec.scene ? (spec.scene === true ? {} : spec.scene) : null });
    }
    this._log('lay', spec.species, `${n}`);
  }

  // { name: ref } or { name: { species, near, female, pick } }: a cast name bound to a live bird
  // (a $role from the event, a species' nearest to a place...). The name must be in `cast`
  // (with manual: true, so it isn't adopted on its own as the level starts).
  adopt(spec, ev) {
    for (const name of Object.keys(spec || {})) {
      const want = spec[name];
      if (!this.castDefs[name]) { this.castDefs[name] = { title: name, manual: true }; this._log('issue', 'adopt', `"${name}" isn't in cast`); }
      let e = null;
      if (want && typeof want === 'object' && !want.pos) {
        const near = want.near ? this.point(want.near, ev) : null;
        let pool = this.allOf(want.species || (this.castDefs[name].species)).filter(b => b.alive !== false && b !== undefined);
        if (want.female != null) pool = pool.filter(b => !!b.isFemale === !!want.female);
        pool = pool.filter(b => !b.castName || b.castName === name);
        if (want.pick === 'youngest') pool.sort((a, b) => (a.age || 0) - (b.age || 0));
        else if (want.pick === 'oldest') pool.sort((a, b) => (b.age || 0) - (a.age || 0));
        if (near) pool.sort((a, b) => Math.hypot(a.pos.x - near.x, a.pos.y - near.y) - Math.hypot(b.pos.x - near.x, b.pos.y - near.y));
        e = pool[0] || null;
      } else {
        e = this.entity(want, ev);
      }
      if (!e || e.alive === false) { this._log('issue', 'adopt', `nothing to adopt as "${name}"`); continue; }
      this.castEnts[name] = e;
      e.castName = name;
      this._log('cast', name, 'adopted');
    }
  }

  // { type = 'Storm', sec, refreshOnMove }: every live standing one of `type` wears out over
  // `sec` seconds (PlaceableObject.fadeOver); a placed one that would outlast that is cut short.
  fade(spec) {
    const type = (spec && spec.type) || 'Storm', sec = (spec && spec.sec) || 20;
    let n = 0;
    for (const p of this.sim.placeables) {
      if (!p.alive || p.type !== type) continue;
      if (p.standing) { if (p.fadeOver) p.fadeOver(sec, !!(spec && spec.refreshOnMove)); }
      else if (p.life > sec * CHAPTER_FPS) { p.life = sec * CHAPTER_FPS; p.maxLife = Math.max(p.maxLife, p.life); }
      n++;
    }
    this._log('fade', type, `${n}`);
  }

  // Whether something that hides a moa from the eagle (a storm, a fern shelter) stands over `e`
  // right now. Fully hiding cover only: a partial one (eagleSpotFrac) still lets it be seen.
  coveredNow(e) {
    if (!e || !e.pos) return false;
    for (const p of this.sim.placeables) {
      if (!p.alive || !p.def || !p.def.blocksEagleVision || p.def.eagleSpotFrac > 0) continue;
      if (p.isInRange(e.pos)) return true;
    }
    return false;
  }

  // ---- The weather on the tops ------------------------------------------------------------
  // A journey level's storms gather by themselves on the high ground (level.weather; on by
  // default where the level has the Storm): now and then, while fewer than `max` storms stand
  // anywhere, a new one swells up on one of the highest spots, away from the other storms and
  // from the cast. The family lives lower down for half the year, so the player brings the
  // weather down to them. Each wears out over lifeSec (winterLifeSec in winter); moving one
  // gives it half again its time left (Game.tryDropMove). It is the weather's (p.natural): a
  // storm the player calls is counted apart.
  //   { everySec = 20, max = 3, lifeSec = 75, winterLifeSec = 40, firstSec = 8 }, or false.
  _weatherCfg() {
    if (this._weather !== undefined) return this._weather;
    const w = this.level.weather;
    const has = !!(this.game && this.game.activePlaceables && this.game.activePlaceables.Storm);
    this._weather = (w === false || !has || (!w && !this.level.journey)) ? null
      : Object.assign({ everySec: 20, max: 3, lifeSec: 75, winterLifeSec: 40, firstSec: 8 }, w || {});
    return this._weather;
  }

  _updateWeather(frames) {
    const W = this._weatherCfg();
    if (!W) return;
    this._weatherT = (this._weatherT == null ? (W.everySec - W.firstSec) * CHAPTER_FPS : this._weatherT) + frames;
    if (this._weatherT < W.everySec * CHAPTER_FPS) return;
    const storms = this.sim.placeables.filter(p => p.alive && p.type === 'Storm');
    if (storms.length >= W.max) return;   // (it tries again next poll: a gap opens when one blows out)
    this._weatherT = 0;
    const t = this.game.terrain, R = (this.game.activePlaceables.Storm.radius) || 64;
    const away = Object.values(this.castEnts).filter(e => e && e.alive).map(e => e.pos);
    const clear = (q) => storms.every(p => Math.hypot(p.pos.x - q.x, p.pos.y - q.y) > R * 1.6) &&
                         away.every(c => Math.hypot(c.x - q.x, c.y - q.y) > R * 1.5);
    const W0 = t.mapWidth, H0 = t.mapHeight, spots = [];
    for (let i = 0; i < 260; i++) {
      const q = { x: random(R * 0.6, W0 - R * 0.6), y: random(R * 0.6, H0 - R * 0.6) };
      if (t.canPlace(q.x, q.y) && clear(q)) spots.push({ q, h: t.getElevationAt(q.x, q.y) });
    }
    if (!spots.length) return;
    // One of the highest few (not always the one peak).
    spots.sort((a, b) => b.h - a.h);
    const q = spots[Math.floor(random(Math.min(6, spots.length)))].q;
    const st = this.sim.addStandingStorm(q.x, q.y, R);
    st.natural = true;
    st.swellTo(R * 0.3, 1);
    st.swellTo(R, 3 * CHAPTER_FPS);
    const winter = this.game.seasonManager && this.game.seasonManager.currentKey === 'winter';
    st.fadeOver(winter ? W.winterLifeSec : W.lifeSec, false);
    this._log('weather', 'Storm', `gathered at ${Math.round(q.x)},${Math.round(q.y)}`);
    if (!this._weatherSaid) {
      this._weatherSaid = true;
      this.game.addNotification("A storm is gathering on the tops. Press and hold it to bring it down.", 'info');
    }
  }

  // Open the Field Guide at an entry (there are no locks: every entry is always there).
  guideOpen(id) {
    const g = this.game, enc = g && g.encyclopedia;
    if (!enc || typeof ENCYCLOPEDIA_BY_ID === 'undefined' || !ENCYCLOPEDIA_BY_ID[id]) { this._log('issue', 'guide', `no entry "${id}"`); return; }
    enc.select(id);
    if (enc.openGuide) enc.openGuide(g);
    this._log('guide', id);
  }

  // ---- Sites: named places on the land ------------------------------------------------
  // { x, y } | { fx, fy } (shares of the map) | { find, ... }:
  //   flock   the middle of where a species is now (species; the first focus species if none)
  //   nest    the newest nesting site (with near: the one nearest that place)
  //   biome   a spot in a biome (biome: a key or keys), nearest `near` (far: true, furthest)
  //   high, low   the highest / lowest walkable ground within `within` (200) of `near`
  //   open    open ground to place on (not forest), dist: [min, max] from `near`
  //   edge    walkable ground by an edge of the map (side: 'north' | 'south' | 'east' | 'west')
  // or { near, dist: [min, max] } alone: any walkable spot that far from a place. A site is
  // found once, as the level (or the chapter that names it) starts, and later ones can be near
  // earlier ones.
  _resolveSites(specs) {
    for (const name of Object.keys(specs || {})) {
      const p = this._findSite(specs[name]);
      if (p) this.sites[name] = p;
      else this._log('issue', name, 'site not found');
    }
  }

  _findSite(spec) {
    if (!spec) return null;
    const t = this.game.terrain, W = t.mapWidth, H = t.mapHeight;
    if (spec.x != null && spec.y != null) return { x: spec.x, y: spec.y };
    if (spec.fx != null) return this._walkableNear({ x: W * spec.fx, y: H * (spec.fy ?? 0.5) });
    const near = spec.near ? this.point(spec.near) : null;
    // Near a place, only ground a bird there could walk to (its land region; anyRegion: true
    // lifts that, for a site over a ridge on purpose).
    const land = (near && !spec.anyRegion && t.regionNear) ? t.regionNear(near) : -1;
    const walk = (p) => t.isWalkable(p.x, p.y) && (land < 0 || t.regionNear(p, 'now', 1) === land);
    const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    const anywhere = () => ({ x: random(20, W - 20), y: random(20, H - 20) });
    const around = (c, r0, r1) => () => {
      const a = random(TWO_PI), r = random(r0, r1);
      return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
    };
    switch (spec.find) {
      case 'flock': {
        const k = spec.species || this.focus[0];
        const birds = k ? this.allOf(k) : [];
        if (!birds.length) return null;
        // The middle of the biggest group of them on one stretch of land (with a ridge between
        // two groups, the middle of all of them could be on neither side).
        const groups = new Map();
        for (const b of birds) {
          const r = t.regionNear ? t.regionNear(b.pos, 'now', 1) : 0;
          if (!groups.has(r)) groups.set(r, []);
          groups.get(r).push(b);
        }
        let group = null;
        for (const [r, g] of groups) if (r >= 0 && (!group || g.length > group.length)) group = g;
        group = group || birds;
        return this._walkableNear(this._centroid(group), 120, group[0].pos) || { x: group[0].pos.x, y: group[0].pos.y };
      }
      case 'nest': {
        const nests = (this.sim.nestingSites || []).filter(s => s.alive !== false);
        if (!nests.length) return null;
        const s = near ? nests.reduce((a, b) => dist(a.pos, near) <= dist(b.pos, near) ? a : b) : nests[nests.length - 1];
        return { x: s.pos.x, y: s.pos.y };
      }
      case 'biome': {
        const keys = [].concat(spec.biome);
        return this._sample(anywhere, p => walk(p) && keys.includes(t.getBiomeAt(p.x, p.y).key),
          near ? (p => (spec.far ? 1 : -1) * dist(p, near)) : null, 400);
      }
      case 'high': case 'low': {
        const sign = spec.find === 'high' ? 1 : -1;
        return this._sample(near ? around(near, 0, spec.within || 200) : anywhere, walk,
          p => sign * t.getElevationAt(p.x, p.y), 300);
      }
      case 'open': {
        if (!near) return null;
        const [r0, r1] = spec.dist || [60, 140];
        const forest = (p) => typeof FOREST_BIOMES !== 'undefined' && FOREST_BIOMES.has(t.getBiomeAt(p.x, p.y).key);
        return this._sample(around(near, r0, r1), p => walk(p) && t.canPlace(p.x, p.y) && !forest(p), null, 300);
      }
      case 'edge': {
        const m = 30, side = spec.side || 'north';
        const gen = () => side === 'north' ? { x: random(m, W - m), y: random(4, m) }
          : side === 'south' ? { x: random(m, W - m), y: random(H - m, H - 4) }
          : side === 'west' ? { x: random(4, m), y: random(m, H - m) }
          : { x: random(W - m, W - 4), y: random(m, H - m) };
        return this._sample(gen, walk, near ? (p => -dist(p, near)) : null, 300);
      }
      default:
        if (near && spec.dist) return this._sample(around(near, spec.dist[0], spec.dist[1]), walk, null, 200);
        return null;
    }
  }

  // The best of n tries: gen() a candidate, keep those ok() passes, and the highest score()
  // wins (with no score, the first that passes).
  _sample(gen, ok, score, n) {
    let best = null, bestS = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = gen();
      if (!ok(p)) continue;
      if (!score) return p;
      const s = score(p);
      if (s > bestS) { bestS = s; best = p; }
    }
    return best;
  }

  // The nearest ground to p a bird can stand on, searched in rings out to maxR; with `anchor`,
  // only ground connected to it (its land region), not the nearest over a ridge. null if none.
  _walkableNear(p, maxR = 120, anchor = null) {
    const t = this.game.terrain;
    const land = (anchor && t.regionNear) ? t.regionNear(anchor) : -1;
    const ok = (q) => t.isWalkable(q.x, q.y) && (land < 0 || t.regionNear(q, 'now', 1) === land);
    if (ok(p)) return { x: p.x, y: p.y };
    for (let r = 6; r <= maxR; r += 6) {
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * TWO_PI, q = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
        if (ok(q)) return q;
      }
    }
    return null;
  }

  // How many separate stretches of land (regions) a species lives on now ('moa': any moa).
  regionsOf(k) {
    const t = this.game.terrain;
    if (!t.regionNear) return 0;
    const birds = k === 'moa' ? this.sim.moas.filter(m => m.alive) : this.allOf(k);
    return new Set(birds.map(b => t.regionNear(b.pos, 'now', 1)).filter(r => r >= 0)).size;
  }

  _centroid(list) {
    let x = 0, y = 0;
    for (const e of list) { x += e.pos.x; y += e.pos.y; }
    return { x: x / list.length, y: y / list.length };
  }

  // A world point by reference: a site name, a $role / cast name / species (where that one is
  // now), an entity, { x, y }, or a site spec written in place.
  point(ref, ev = null) {
    if (!ref) return null;
    if (typeof ref === 'string') {
      if (this.sites[ref]) return this.sites[ref];
      const e = this.entity(ref, ev);
      return e && e.pos ? { x: e.pos.x, y: e.pos.y } : null;
    }
    if (ref.pos) return { x: ref.pos.x, y: ref.pos.y };
    if (ref.x != null && ref.y != null) return ref;
    return this._findSite(ref);
  }

  // ---- The stage: things put at a place ---------------------------------------------
  // { type, at, standing }: a placeable, free, optionally standing (it never wears out).
  place(spec, ev) {
    const p = this.point(spec.at, ev);
    if (!p) { this._log('issue', 'place', `no place "${spec.at}"`); return null; }
    const pl = this.sim.addPlaceable(p.x, p.y, spec.type);
    if (spec.standing) { pl.standing = true; pl.fading = false; pl.life = pl.maxLife = 1; }
    this._log('place', spec.type, typeof spec.at === 'string' ? spec.at : '');
    return pl;
  }

  // { plant, at, count, radius, growth, sprouted }: wild plants (as ModuleDirector._sow).
  sow(spec, ev) {
    const c = this.point(spec.at, ev), t = this.game.terrain;
    if (!c) { this._log('issue', 'sow', `no place "${spec.at}"`); return; }
    const count = spec.count || 4, radius = spec.radius || 30;
    let n = 0;
    for (let tries = 0; tries < count * 6 && n < count; tries++) {
      const a = random(TWO_PI), d = random(4, radius);
      const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
      if (!t.isWalkable(x, y)) continue;
      const p = new Plant(x, y, spec.plant, t, t.getBiomeAt(x, y).key);
      if (p.unsprouted && spec.sprouted !== false) p.sprout();
      p.growth = spec.growth ?? 0.9;
      p.isSpawned = true;
      this.sim.addPlant(p);
      n++;
    }
    this._log('sow', spec.plant, `${n}`);
  }

  // { type, count, at, radius }: animals set down at a place (moa as adults, or birds).
  spawn(spec, ev) {
    const c = this.point(spec.at, ev), sim = this.sim;
    if (!c) { this._log('issue', 'spawn', `no place "${spec.at}"`); return; }
    const count = spec.count || 1, radius = spec.radius || 20, isMoa = this._isMoa(spec.type);
    let n = 0;
    for (let i = 0; i < count; i++) {
      const p = this._walkableNear({ x: c.x + random(-radius, radius), y: c.y + random(-radius, radius) }, 120, c) || c;
      const e = sim._createFromRegistry(isMoa ? 'moa' : spec.type, spec.type, p.x, p.y, isMoa ? Moa : null);
      if (!e) continue;
      // sexes: 'pair' alternates female, male...; female: true / false sets them all; hunger
      // (0 to 100) is how hungry they start (a hungry pair goes out to feed at once).
      if (spec.sexes === 'pair') e.isFemale = (n % 2 === 0);
      else if (spec.female != null) e.isFemale = !!spec.female;
      if (spec.hunger != null) e.hunger = spec.hunger;
      if (isMoa) {
        // Adults, unless age: 'juvenile' (a chick of last year, half grown).
        e.age = spec.age === 'juvenile' ? Math.round(MOA_AGE.JUVENILE_MAX * 0.5) : MOA_AGE.ADULT_MIN + 1;
        e.updateAge(0);
        if (e.homeRange) e.homeRange.set(p.x, p.y);
        sim.moas.push(e);
      } else {
        (sim.otherEntities[spec.type] || (sim.otherEntities[spec.type] = [])).push(e);
      }
      n++;
    }
    sim._invalidateCache();
    this._log('spawn', spec.type, `${n}`);
  }

  // ---- Moments (MomentPlayer) --------------------------------------------------------
  // { on, text, sec, zoom }: the world held still while the camera eases in on `on` (a site,
  // role, cast name or species) and `text` says what happened, then back out. (`moment`, the
  // getter below, is what Game reads; this is the `moment` tool.)
  playMoment(spec, ev) {
    const e = typeof spec.on === 'string' && !this.sites[spec.on] ? this.entity(spec.on, ev) : null;
    const at = this.point(spec.on, ev);
    if (!at || !this.moments) return;
    this.moments.start({
      kind: 'story', dur: (spec.sec || 3) * CHAPTER_FPS, zoom: spec.zoom,
      text: this.fill(spec.text || '', ev),
      at: () => (e && e.pos) ? e.pos : at
    });
    this._log('moment', typeof spec.on === 'string' ? spec.on : '', spec.text || '');
  }

  // While one plays, Game.update / render hold the world still and show it (as a module's).
  get moment() { return this.moments ? this.moments.current : null; }
  updateMoment(dt) { this.moments.update(dt); }
  renderMoment() { this.moments.render(); }

  // A chapter's mechanics overlay onto LEVEL_MECHANICS. The level's own values are kept (in
  // LEVEL_MECHANICS._chapterBase) and put back when the next run starts.
  _applyMechanics(m) {
    const M = LEVEL_MECHANICS;
    const base = M._chapterBase || (M._chapterBase = {});
    for (const k in m) {
      if (!(k in base)) base[k] = (k in M) ? M[k] : undefined;
      M[k] = m[k];
    }
  }

  _restoreMechanics() {
    const M = LEVEL_MECHANICS, base = M && M._chapterBase;
    if (!base) return;
    for (const k in base) {
      if (base[k] === undefined) delete M[k];
      else M[k] = base[k];
    }
    M._chapterBase = {};
  }

  // { on: role, zoom, sec } eases the camera onto an entity; 'home' (or { zoom: 1 }) eases back.
  camera(cam, ev) {
    const g = this.game, sec = (cam && cam.sec) || 1.5;
    if (cam === 'home' || !cam.on) { g.cameraTo({ zoom: (cam && cam.zoom) || 1 }, sec * CHAPTER_FPS); return; }
    const e = this.entity(cam.on, ev);
    if (!e || !e.pos) return;
    g.cameraTo({ zoom: cam.zoom || 1.6, cx: e.pos.x, cy: g._groundPaintY(e.pos.x, e.pos.y), ax: 0.5, ay: 0.5 },
               sec * CHAPTER_FPS);
  }

  // ---- The cast: characters adopted from the simulation --------------------------
  // { species, pick: 'oldest' | 'youngest' | 'random', female?, recast? }. A cast member is a
  // real bird: when it dies, 'cast_lost' fires, and (with recast) the next chapter adopts
  // another.
  _adoptCast() {
    for (const name in this.castDefs) {
      const c = this.castDefs[name], cur = this.castEnts[name];
      if (c.manual) continue;          // (bound by an `adopt` action, not on its own)
      if (cur && cur.alive) continue;
      if (cur === null && !c.recast) continue;   // lost, and not to be replaced
      const pool = this.allOf(c.species).filter(e => c.female == null || !!e.isFemale === !!c.female);
      if (!pool.length) continue;
      if (c.pick === 'youngest') pool.sort((a, b) => (a.age || 0) - (b.age || 0));
      else if (c.pick === 'random') pool.sort(() => random() - 0.5);
      else pool.sort((a, b) => (b.age || 0) - (a.age || 0));
      this.castEnts[name] = pool[0];
      pool[0].castName = name;
      this._log('cast', name);
    }
  }

  _watchCast() {
    for (const name in this.castEnts) {
      const e = this.castEnts[name];
      if (!e || e.alive) continue;
      this.castEnts[name] = null;
      // A named bird that walked off the land (the journey's travel: CHAPTERS_KIT.walkOff) is
      // not lost: it is on its way to the next tile.
      if (e.causeOfDeath === 'dispersed') { (this.walked || (this.walked = {}))[name] = true; this._log('cast_left', name); continue; }
      // How it died, when the simulation says (Moa.causeOfDeath: 'eagle' or 'starved'), so a
      // lesson can answer each differently (the `cause` filter).
      const cause = e.causeOfDeath || (e.hunger >= (e.maxHunger || 100) ? 'starved' : 'unknown');
      this._log('cast_lost', name, cause);
      this._emit('cast_lost', { cast: name, entity: e, cause });
    }
  }

  // A nest the player's planting founded (Simulation._updateMoaNestingFormation).
  _watchNests() {
    const n = this._counter('nests');
    if (n <= this._nests) return;
    const sites = (this.sim.nestingSites || []).filter(s => s.playerMade);
    for (let i = this._nests; i < n; i++) this._emit('nest_founded', { site: sites[sites.length - (n - i)] || null });
    this._nests = n;
  }

  // ---- The verdicts ---------------------------------------------------------------
  lose(reason) {
    if (this._ended) return;
    this._ended = true;
    const g = this.game;
    g.state = GAME_STATE.LOST;
    g.gameOverReason = reason;
    if (audioManager) audioManager.playLoss();
    this._log('lost', this.cur ? this.cur.id : '', reason);
  }

  _win() {
    if (this._ended) return;
    this._ended = true;
    const g = this.game;
    g.state = GAME_STATE.WON;
    if (audioManager) audioManager.playWin();
    PROGRESS.completeLevel(this.level.id, computeLevelScore(this.level, g._scoreContext()));
    // A journey level hands on what its `outcome` block lists (mauri_campaign.js).
    if (this.level.journey && typeof CAMPAIGN !== 'undefined') CAMPAIGN.finish(this);
    this._log('won', this.cur ? this.cur.id : '');
  }

  _log(kind, id, info = '') {
    this.log.push({ t: Math.round(this.game.playTime / CHAPTER_FPS * 10) / 10,
                    chapter: this.cur ? this.cur.id : '', kind, id, info: info || '' });
    // A research run records the story's log beside the populations (mauri_benchmark.js).
    if (typeof BENCHMARK !== 'undefined' && BENCHMARK.active && BENCHMARK.event) BENCHMARK.event(this.game, kind, id, info);
  }

  // ==========================================================================
  // INSPECTOR (debug mode, J): the chapter, what it waits on, the goals, the reactions
  // ==========================================================================
  toggleInspector() {
    this.inspector = !this.inspector;
    return this.inspector;
  }

  renderInspector() {
    if (!this.inspector || !CONFIG.debugMode || !this.cur) return;
    const rows = [];   // [text, rgb]
    const head = [150, 220, 190], dim = [140, 150, 160], txt = [225, 235, 230];
    const ok = [130, 220, 140], bad = [235, 120, 110];
    const ch = this.cur, x = this._ctx();
    rows.push([`CHAPTERS · debug (J)${this.issues.length ? `   ${this.issues.length} issue(s)` : ''}`, head]);
    rows.push([`▶ ${ch.id}: ${ch.title}`, txt]);
    const until = JSON.stringify(ch.def.until || { seasons: 1 });
    rows.push([`  ${(this.scopeTime() / CHAPTER_FPS).toFixed(1)}s in · seasons ${this.seasonsIn()} · until ${until}`, dim]);
    if (ch.hold) {
      const free = ch.hold.until(x);
      rows.push([`  season ${free ? 'free' : `held at ${Math.round(ch.hold.at * 100)}%`} (${JSON.stringify(ch.def.holdSeason.until)})`,
                 free ? dim : [235, 200, 110]]);
    }
    rows.push([`  next -> ${this._nextReq || this._resolveNext(ch)}`, dim]);
    rows.push(['GOALS', head]);
    for (const goal of this.goals) {
      const mark = goal.achieved ? '✓' : (goal.failed ? '✗' : '·');
      const tags = [goal.required ? 'required' : '', goal.stretch ? 'stretch' : '',
                    goal._g.keep ? 'keep' : '', goal._g.def.survive ? 'survive' : ''].filter(Boolean).join(' ');
      rows.push([`  ${mark} ${goal.name}${tags ? `  [${tags}]` : ''}`, goal.achieved ? ok : (goal.failed ? bad : txt)]);
    }
    if (this.beatState.length) {
      rows.push(['BEATS', head]);
      for (const s of this.beatState) {
        const b = s.b, el = (this.game.playTime - s.t0) / CHAPTER_FPS;
        const state = s.phase === 'waiting' ? 'waiting'
          : s.phase === 'running' ? `running ${el.toFixed(0)}s${b.by != null ? `/${(b.by / CHAPTER_FPS).toFixed(0)}s` : ''}${s.forced ? ' (forced)' : ''}`
          : (s.forced ? '✓ forced' : '✓ natural');
        rows.push([`  ${b.id}  ${state}${b.pinned ? '  [pinned]' : ''}`,
                   s.phase === 'done' ? (s.forced ? [235, 200, 110] : ok) : (s.phase === 'running' ? txt : dim)]);
      }
    }
    rows.push(['REACTIONS', head]);
    for (const rx of this.reactions) {
      if (rx.owner && rx.owner !== ch.id) continue;
      const cd = rx.cooldown && rx.fired ? Math.max(0, (rx.lastAt + rx.cooldown - this.game.playTime) / CHAPTER_FPS) : 0;
      const state = (rx.once && rx.fired) || rx.fired >= rx.max ? 'done' : (cd > 0 ? `cd ${cd.toFixed(0)}s` : 'armed');
      rows.push([`  ${rx.id}  ×${rx.fired}  ${state}  (${rx.on || 'when'})`, rx.fired ? txt : dim]);
    }
    const flags = Object.keys(this.flags);
    if (flags.length) rows.push([`FLAGS  ${flags.join(', ')}`, head]);
    const cast = Object.keys(this.castDefs);
    if (cast.length) {
      rows.push(['CAST', head]);
      for (const name of cast) {
        const e = this.castEnts[name];
        rows.push([`  ${name}: ${e ? (e.alive ? `alive, age ${Math.round((e.age || 0) / CHAPTER_FPS)}s` : 'dead') : 'none'}`,
                   e && e.alive ? txt : dim]);
      }
    }
    rows.push(['LOG', head]);
    for (const l of this.log.slice(-6)) rows.push([`  ${l.t}s  ${l.kind} ${l.id} ${l.info}`, dim]);
    for (const s of this.issues.slice(0, 3)) rows.push([`! ${s}`, bad]);

    const pad = 8, rowH = 15, w = 360;
    const lx = 12 + ((typeof Lens !== 'undefined' && Lens.enabled) ? 200 : 0);
    const ly = Math.max((CONFIG.viewY || 60) + 40, 160);   // (below the debug perf readout)
    push();
    noStroke(); fill(16, 22, 28, 222); rect(lx, ly, w, pad * 2 + rows.length * rowH, 8);
    textAlign(LEFT, TOP); textSize(11);
    rows.forEach(([s, col], i) => {
      fill(col[0], col[1], col[2]);
      let t = s;
      while (t.length > 4 && textWidth(t) > w - pad * 2) t = t.slice(0, -2);
      text(t === s ? s : t + '…', lx + pad, ly + pad + i * rowH);
    });
    pop();
  }
}

// ============================================================================
// MomentPlayer: a story moment (the scripting toolbox)
// ============================================================================
// While one plays, the world stands still (no sim, no clock, no tips, no input: Game.update and
// Game.render read the owner's `moment`). The camera eases in on it, big words say what
// happened, and it eases back out once the world runs on. A moment is { kind, at() (a world
// point), dur (frames), text, zoom?, tick(t, dt)?, end()?, valid()? }; one that comes while
// another plays waits its turn (and is dropped if it's no longer valid() by then). Shared by
// chapter levels (ChapterRunner.moment) and the modules' Free Play years (FreePlayDirector).
// cfg: { zoom, inSec, outSec }; canStart(): false drops a moment (e.g. the level is over).
class MomentPlayer {
  constructor(game, cfg, canStart = () => true) {
    this.game = game;
    this.cfg = cfg;
    this.canStart = canStart;
    this.current = null;
    this.queue = [];
  }

  start(m) {
    if (!this.canStart()) { if (m.end) m.end(); return; }
    if (this.current) { this.queue.push(m); return; }
    const g = this.game, c = g.camera;
    // Back to where the view was going (a camera ease under way ends where it was headed).
    const v = c ? (c.tween ? c.tween.to : c) : null;
    m.view = v ? { zoom: v.zoom, cx: v.cx, cy: v.cy, ax: v.ax, ay: v.ay } : null;
    m.t = 0;
    const at = m.at();
    g.cameraTo({ zoom: Math.max(m.zoom || this.cfg.zoom, v ? v.zoom : 1), cx: at.x, cy: g._groundPaintY(at.x, at.y),
                 ax: 0.5, ay: 0.5 }, this.cfg.inSec * 60);
    g.selectedPlaceable = null;
    g.movingPlaceable = null;
    g._holdCandidate = null;
    for (const mo of g.simulation.moas) mo.settleFacing();
    this.current = m;
  }

  update(dt) {
    const m = this.current;
    if (!m) return;
    m.t += dt;
    if (m.tick) m.tick(m.t, dt);
    if (m.t < m.dur) return;
    this.current = null;
    if (m.end) m.end();
    // The next waiting moment (if what it shows is still there), else back out to the view.
    while (this.queue.length) {
      const n = this.queue.shift();
      if (!n.valid || n.valid()) { n.view = null; this.start(n); if (this.current) this.current.view = m.view; return; }
      if (n.end) n.end();
    }
    if (m.view) this.game.cameraTo(m.view, this.cfg.outSec * 60);
  }

  // The words, big, over the top of the world (as a prompt's), fading in and out.
  render() {
    const m = this.current, g = this.game;
    if (!m || !m.text) return;
    const fade = 18, a = 255 * Math.min(1, m.t / fade, (m.dur - m.t) / fade);
    if (a <= 0) return;
    const area = g.tutorial && g.tutorial.playArea ? g.tutorial.playArea()
      : { x: 0, y: 0, w: CONFIG.canvasWidth, h: CONFIG.canvasHeight };
    const size = 58 * (typeof TIP_PANEL_SCALE !== 'undefined' ? TIP_PANEL_SCALE : 1) * (CONFIG.portrait ? 0.8 : 1);
    push();
    if (typeof FreckleFace !== 'undefined') textFont(FreckleFace);
    textSize(size);
    textAlign(CENTER, CENTER);
    translate(area.x + area.w * 0.5, area.y + area.h * 0.2);
    scale(1 + 0.08 * Math.max(0, 1 - m.t / 12));   // a small pop as it appears
    stroke(12, 22, 16, a * 0.9);
    strokeWeight(size * 0.14);
    strokeJoin(ROUND);
    fill(m.kind === 'catch' ? color(255, 214, 196, a) : color(235, 250, 225, a));
    text(m.text, 0, 0);
    pop();
  }
}
