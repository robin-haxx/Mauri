// ============================================================================
// THE CAMPAIGN: the journey's map and its record (CAMPAIGN_PLAN.md, section 7.1)
// ============================================================================
// The lessons are tiles on a map, and two families walk it. Until now no level knew what
// happened in another. This file keeps the one thing that makes the story generational: a
// saved RECORD of who is alive, how each herd fared and what the player grew, read by a level
// as it starts and written by it at the win.
//
//   The map      TILES (a level each), CELLS (where each is drawn) and PATHS (the lines).
//                GROUPS and LINKS are the menu's sequence, MAP the graphic behind the tiles.
//                Game._renderJourneyModules and _renderJourneyPanel draw them.
//   Reading      CAMPAIGN.begin(runner), called as a journey level starts (a level with
//                `journey: true`): the record becomes story flags (`papa_lost`) and words
//                (`{$elders}`) on the ChapterRunner, which the chapters engine already has.
//   Writing      CAMPAIGN.finish(runner), called at the win: the level's `outcome` block
//                lists what it hands on ({ birds, herds, also }).
//   Carrying     CAMPAIGN.alive(name) says whether a named bird can be set down on this
//                tile (CHAPTERS_KIT.party does the setting down).
//
// What can vary and what cannot. A lesson can only be won with its leads alive, so Koukou,
// the baby and Pukepuke always reach tile 7. Everything else is remembered as it happened:
// the elders, Pukepuke's younger siblings, each herd's numbers, the forest's bounty, and how
// often the player acted with no hint.
//
// Every level also starts from the DEFAULT record (everyone alive, middling herds), so any
// tile can be opened alone for a test or a class. A research run (?bench=) or a run started
// with ?record=<preset or base64 JSON> never touches the saved record.
//
// NAMES ARE PLACEHOLDERS. Koukou's parents, the baby and the new chick have working titles
// here; naming them in te reo is the author's to do (one place: BIRDS below).
// ============================================================================

const CAMPAIGN = {
  VERSION: 1,
  _key: 'avianage_campaign',
  record: null,
  _ephemeral: false,     // a research or preset run: the record lives in memory only

  // The named birds, in the order a closing card lists them.
  BIRDS: {
    mama:       { title: "Mama",              elder: true },
    papa:       { title: "Papa",              elder: true },
    friendMama: { title: "Koukou's mother",   neighbour: true },
    friendPapa: { title: "Koukou's father",   neighbour: true },
    pukepuke:   { title: "Pukepuke",          lead: true },
    koukou:     { title: "Koukou",            lead: true },
    baby:       { title: "the baby",          lead: true },
    chick:      { title: "the new chick",     unborn: true }   // hatched on tile 7
  },

  // The tiles. `needs`: the tiles that must be won first. A tile with no level is still to come.
  TILES: {
    t1:  { label: '1',  title: "The Storm",        level: 'chapters_storms_clues',    needs: [] },
    t2:  { label: '2',  title: "Pātōtara",         level: 'chapters_patotara_clues',  needs: ['t1'] },
    t2f: { label: '2f', title: "Five years",       level: 'chapters_freeplay_journey', needs: ['t2'] },
    t3:  { label: '3',  title: "Into the bush",    level: 'journey_bush',             needs: ['t2f'] },
    t4:  { label: '4',  title: "Night parrots",    level: 'journey_kakapo',           needs: ['t3'] },
    t4f: { label: '4f', title: "Mast years",       level: 'journey_mast_years',       needs: ['t4'] },
    t5:  { label: '5',  title: "The crowded forest", level: 'journey_kaka',           needs: ['t2f'] },
    t6:  { label: '6',  title: "The crested one",  level: 'journey_crested',          needs: ['t5'] },
    t6f: { label: '6f', title: "Giant moa",        level: 'journey_giants',           needs: ['t6'] },
    t7:  { label: '7',  title: "Paths meet",       level: 'journey_meeting',          needs: ['t4', 't6'] },
    t7f: { label: '7f', title: "Endless",          level: null,                       needs: ['t7'] },
    qNE: { label: '7f', title: "year 2",           level: null,                       needs: ['t7'] },
    qNW: { label: '7f', title: "year 3",           level: null,                       needs: ['t7'] },
    qSW: { label: '7f', title: "year 4",           level: null,                       needs: ['t7'] }
  },

  // Where each tile is drawn: col 0 west, 2 east; row 0 north. (The sketch in CAMPAIGN_PLAN.md.)
  CELLS: [
    { col: 0, row: 0, tiles: ['qNW'] }, { col: 1, row: 0, tiles: ['qNE'] },
    { col: 0, row: 1, tiles: ['qSW'] }, { col: 1, row: 1, tiles: ['t7', 't7f'] }, { col: 2, row: 1, tiles: ['t6', 't6f'] },
    { col: 1, row: 2, tiles: ['t4', 't4f'] }, { col: 2, row: 2, tiles: ['t5'] },
    { col: 1, row: 3, tiles: ['t3'] }, { col: 2, row: 3, tiles: ['t2', 't2f'] },
    { col: 2, row: 4, tiles: ['t1'] }
  ],
  PATHS: [
    { name: 'together', color: [226, 214, 170], cells: [[2, 4], [2, 3]] },
    { name: 'west',     color: [150, 210, 170], cells: [[2, 3], [1, 3], [1, 2], [1, 1]] },   // with Koukou
    { name: 'north',    color: [170, 196, 236], cells: [[2, 3], [2, 2], [2, 1], [1, 1]] }    // with Pukepuke
  ],

  // The menu's sequence (Game._renderJourneyModules): the tiles in four groups, each a lesson
  // or two and the free play after them, laid out 2×2. `path` names the PATHS colour. A null
  // slot is left empty (7 sits under 4, so the west path's line drops straight into it).
  GROUPS: [
    { title: "Together",            path: 'together', tiles: ['t1', 't2', 't2f'] },
    { title: "West with Koukou",    path: 'west',     tiles: ['t3', 't4', 't4f'] },
    { title: "North with Pukepuke", path: 'north',    tiles: ['t5', 't6', 't6f'] },
    { title: "The paths meet",      path: 'together', tiles: [null, 't7', 't7f'] }
  ],
  // The lines between groups: 2f opens both 3 and 5; 7 needs both 4 and 6.
  LINKS: [
    { from: 't2f', to: 't3', path: 'west',  route: 'across' },
    { from: 't2f', to: 't5', path: 'north', route: 'under' },
    { from: 't4',  to: 't7', path: 'west',  route: 'down' },
    { from: 't6',  to: 't7', path: 'north', route: 'below' }
  ],
  // One line per tile for the menu's panel. PLACEHOLDERS: the words are the author's.
  BLURBS: {
    t1:  "A storm hides a moa from the Pouākai.",
    t2:  "Pātōtara feeds the family, and the kea come for the egg.",
    t2f: "Five years on the same land. A baby hatches.",
    t3:  "Koukou and the baby meet the little bush moa.",
    t4:  "The kākāpō set a riddle about the rimu.",
    t4f: "Eight years. Keep the forest bountiful as the cold comes down.",
    t5:  "Pukepuke's family winters beside a flock of kākā.",
    t6:  "An old crested moa of the high country.",
    t6f: "Eight years. Grow the clan beside the slow-breeding giant moa.",
    t7:  "Both families meet, and a chick hatches.",
    t7f: "The whole land, year after year."
  },
  // The upper South Island graphic behind the tiles (sprites/journey_map.png, w × h px) and
  // where the CELLS grid lies on it: (x0, y0) is the centre of cell col 0, row 0, and `pitch`
  // the distance between cells, all in the image's pixels. A new graphic needs these re-measured.
  MAP: { w: 205, h: 156, x0: 72.2, y0: 54.0, pitch: 9.2 },

  // Where a tile lies on the map graphic: its centre (u, v: 0..1 across the image) and its
  // side `s` as a fraction of the image's width. 7f is the whole 2×2 land north-west of 7.
  place(id) {
    const M = this.MAP;
    let col = 1, row = 1, span = 1;
    if (id === 't7f') { col = 0.5; row = 0.5; span = 2; }
    else for (const c of this.CELLS) if (c.tiles.includes(id)) { col = c.col; row = c.row; }
    return { u: (M.x0 + col * M.pitch) / M.w, v: (M.y0 + row * M.pitch) / M.h, s: span * M.pitch / M.w };
  },

  // The tile the menu offers first: the earliest open one not yet won (else the first).
  nextTile() {
    for (const g of this.GROUPS) for (const id of g.tiles) {
      if (id && this.TILES[id].level && this.isOpen(id) && !this.isWon(id)) return id;
    }
    return 't1';
  },
  pathColor(name) { const p = this.PATHS.find(q => q.name === name); return p ? p.color : [226, 214, 170]; },

  // Five written records for testing tile 7 and what follows it (?record=<name>, and
  // tools/batch.js --record <name>): from the kindest journey to the hardest.
  PRESETS: {
    all_lived:   { herds: { bush_moa: 9, kakapo: 9, giant: 5, kaka: 6, clan: 9 }, bounty: { start: 40, end: 62 }, siblings: 2 },
    papa_lost:   { lost: { papa: ['eagle', 't6'] }, herds: { bush_moa: 7, kakapo: 6, giant: 4, kaka: 5, clan: 6 }, bounty: { start: 40, end: 48 }, siblings: 1 },
    mama_lost:   { lost: { mama: ['starved', 't5'] }, herds: { bush_moa: 6, kakapo: 5, giant: 3, kaka: 5, clan: 5 }, bounty: { start: 40, end: 44 }, siblings: 0 },
    elders_lost: { lost: { mama: ['eagle', 't6f'], papa: ['eagle', 't5'], friendPapa: ['starved', 't5'] }, herds: { bush_moa: 5, kakapo: 4, giant: 2, kaka: 4, clan: 3 }, bounty: { start: 40, end: 41 }, siblings: 1 },
    barely:      { lost: { mama: ['starved', 't6'], papa: ['eagle', 't5'], friendMama: ['eagle', 't5'], friendPapa: ['starved', 't5'] }, herds: { bush_moa: 3, kakapo: 2, giant: 1, kaka: 2, clan: 2 }, bounty: { start: 40, end: 40 }, siblings: 0 }
  },

  // ---- The record ---------------------------------------------------------------------------
  defaultRecord() {
    const birds = {};
    for (const name in this.BIRDS) birds[name] = { alive: !this.BIRDS[name].unborn, born: !this.BIRDS[name].unborn };
    return {
      v: this.VERSION, openAll: false,
      birds,                      // name -> { alive, born, cause?, at? (the tile it was lost on) }
      siblings: 0,                // Pukepuke's younger siblings raised on the north path
      // Middling numbers stand in for a free play that was not played (decision 5).
      herds: { bush_moa: 6, kakapo: 5, giant: 3, kaka: 5, clan: 5 },
      played: {},                 // herd key -> true once a level has really written it
      bounty: null,               // { start, end } from the mast years
      learner: {},                // tile -> { met, unaided, ownMet, own }
      babyHatch: null             // 'natural' | 'forced' (the five years' one guaranteed beat)
    };
  },

  fromPreset(p) {
    const rec = this.defaultRecord();
    for (const name in (p.lost || {})) rec.birds[name] = { alive: false, born: true, cause: p.lost[name][0], at: p.lost[name][1] };
    Object.assign(rec.herds, p.herds || {});
    for (const k in (p.herds || {})) rec.played[k] = true;
    if (p.bounty) rec.bounty = Object.assign({}, p.bounty);
    if (p.siblings != null) rec.siblings = p.siblings;
    return rec;
  },

  init() {
    this._ephemeral = false;
    this.record = this._load() || this.defaultRecord();
    // ?record=<preset name | base64 JSON>: play from a written record, saving nothing.
    const want = (typeof window !== 'undefined' && window.location)
      ? new URLSearchParams(window.location.search).get('record') : null;
    if (want) {
      let rec = this.PRESETS[want] ? this.fromPreset(this.PRESETS[want]) : null;
      if (!rec) { try { rec = Object.assign(this.defaultRecord(), JSON.parse(atob(want))); } catch (e) { console.warn(`[campaign] no record "${want}"`); } }
      if (rec) { this.record = rec; this._ephemeral = true; }
    }
  },

  _load() {
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(this._key) : null;
      const rec = raw ? JSON.parse(raw) : null;
      if (!rec || rec.v !== this.VERSION) return null;   // an older shape: start again
      const d = this.defaultRecord();
      for (const k in d) if (rec[k] === undefined) rec[k] = d[k];
      for (const name in d.birds) if (!rec.birds[name]) rec.birds[name] = d.birds[name];
      return rec;
    } catch (e) { return null; }
  },

  save() {
    if (this._ephemeral) return;
    try { localStorage.setItem(this._key, JSON.stringify(this.record)); }
    catch (e) { console.warn('[campaign] could not save the record:', e); }
  },

  // The record as text for a URL (tools/batch.js --journey hands it from one run to the next).
  exportRecord() { return btoa(JSON.stringify(this.record)); },

  // Start the journey again: a fresh record, and its tiles no longer ticked.
  reset() {
    const openAll = !!(this.record && this.record.openAll);
    this.record = this.defaultRecord();
    this.record.openAll = openAll;
    if (typeof PROGRESS !== 'undefined') {
      const ids = new Set(Object.values(this.TILES).map(t => t.level).filter(Boolean));
      PROGRESS.levelsCompleted = PROGRESS.levelsCompleted.filter(id => !ids.has(id));
      PROGRESS.save();
    }
    this.save();
  },

  toggleOpenAll() { this.record.openAll = !this.record.openAll; this.save(); },

  // ---- The map ------------------------------------------------------------------------------
  tile(id) { return this.TILES[id]; },
  tileOf(levelId) { for (const id in this.TILES) if (this.TILES[id].level === levelId) return id; return null; },
  isWon(id) {
    const t = this.TILES[id];
    return !!(t && t.level && typeof PROGRESS !== 'undefined' && PROGRESS.isCompleted(t.level));
  },
  isOpen(id) {
    const t = this.TILES[id];
    if (!t || !t.level) return false;
    return !!this.record.openAll || t.needs.every(n => this.isWon(n));
  },

  // The win card's ways on: a level's `waysOn: [{ label, tile }]`, those that can be played.
  waysOn(level) {
    const out = [];
    for (const w of (level.waysOn || [])) {
      const t = this.TILES[w.tile];
      if (t && t.level && typeof LEVEL_REGISTRY !== 'undefined' && LEVEL_REGISTRY.get(t.level)) out.push({ label: w.label, id: t.level });
    }
    return out;
  },

  // ---- Who is who ----------------------------------------------------------------------------
  bird(name) { return (this.record && this.record.birds[name]) || { alive: false, born: false }; },
  alive(name) { const b = this.bird(name); return !!(b.born && b.alive); },
  title(name) { return (this.BIRDS[name] || {}).title || name; },
  _list(names) {
    const t = names.map(n => this.title(n));
    return t.length <= 1 ? (t[0] || '') : `${t.slice(0, -1).join(', ')} and ${t[t.length - 1]}`;
  },
  _causeWords(cause) { return cause === 'eagle' ? 'taken by the Pouākai' : (cause === 'starved' ? 'starved' : 'lost'); },

  // The family as the record stands, for the map's side panel.
  familyLines() {
    const rec = this.record, born = Object.keys(this.BIRDS).filter(n => rec.birds[n].born);
    const here = born.filter(n => rec.birds[n].alive), lost = born.filter(n => !rec.birds[n].alive);
    const lines = [`Walking: ${this._list(here) || 'nobody yet'}.`];
    for (const n of lost) {
      const b = rec.birds[n], t = b.at && this.TILES[b.at];
      lines.push(`${this.title(n).charAt(0).toUpperCase() + this.title(n).slice(1)}: ${this._causeWords(b.cause)}${t ? ` on tile ${t.label}` : ''}.`);
    }
    if (rec.siblings) lines.push(`Younger siblings raised in the north: ${rec.siblings}.`);
    if (rec.bounty) lines.push(`The western forest: ${rec.bounty.end} fruiting trees (it began at ${rec.bounty.start}).`);
    const L = Object.values(rec.learner);
    if (L.length) {
      const met = L.reduce((a, l) => a + (l.met || 0), 0), un = L.reduce((a, l) => a + (l.unaided || 0), 0);
      if (met) lines.push(`Problems answered with no hint: ${un} of ${met}.`);
    }
    return lines;
  },

  // ---- Reading: the record becomes flags and words as a level starts -----------------------------
  begin(runner) {
    if (!this.record) this.init();
    // A research run plays from the record it was given (or the default), and saves nothing.
    if (typeof BENCHMARK !== 'undefined' && (BENCHMARK.pending || BENCHMARK.active) && !this._ephemeral) {
      this._ephemeral = true;
      this.record = this.defaultRecord();
    }
    const rec = this.record, f = runner.flags, v = runner.vars;
    for (const name in rec.birds) {
      const b = rec.birds[name];
      if (b.born && !b.alive) f[name + '_lost'] = true;
      if (b.born && b.alive) f[name + '_here'] = true;
    }
    const group = (key, names) => {
      const here = names.filter(n => this.alive(n));
      v[key] = this._list(here);
      f[`${key}_${['none', 'one', 'both'][here.length]}`] = true;
      return here;
    };
    group('elders', ['mama', 'papa']);
    group('neighbours', ['friendMama', 'friendPapa']);
    v.siblings = rec.siblings || 0;
    if (rec.siblings) f.has_siblings = true;
    v.lostNames = this._list(Object.keys(rec.birds).filter(n => rec.birds[n].born && !rec.birds[n].alive));
    runner.record = rec;
    runner._log('record', this._ephemeral ? 'given' : 'saved', `elders: ${v.elders || 'none'}; siblings ${v.siblings}`);
  },

  // ---- Writing: what a level hands on, at its win ------------------------------------------------
  // outcome: { birds: [names on this tile's stage], herds: { key: speciesKey }, also(rec, runner) }
  finish(runner) {
    if (!this.record) this.init();
    const L = runner.level, O = L.outcome || {}, rec = this.record, tile = this.tileOf(L.id);
    const lostHow = {};
    for (const l of runner.log) if (l.kind === 'cast_lost') lostHow[l.id] = l.info;
    for (const name of (O.birds || [])) {
      if (!(name in runner.castEnts) && !(runner.walked && runner.walked[name])) continue;   // (never on this stage)
      const e = runner.castEnts[name];
      const alive = !!(e && e.alive) || !!(runner.walked && runner.walked[name]);
      const b = rec.birds[name] || (rec.birds[name] = {});
      b.born = true;
      if (alive) { b.alive = true; delete b.cause; delete b.at; }
      else if (b.alive !== false || !b.at) { b.alive = false; b.cause = lostHow[name] || 'unknown'; b.at = tile; }
    }
    const sim = runner.sim;
    for (const key in (O.herds || {})) { rec.herds[key] = sim.getSpeciesCount(O.herds[key]); rec.played[key] = true; }
    // The learner: problems with a "solved" ending, and how many were answered before any hint.
    const real = runner.caseLog.filter(c => c.outcome === 'solved' || c.outcome === 'lost');
    const own = real.filter(c => c.transfer);
    rec.learner[tile || L.id] = {
      met: real.length, unaided: real.filter(c => c.outcome === 'solved' && c.rung === 0).length,
      ownMet: own.length, own: own.filter(c => c.outcome === 'solved' && c.rung === 0).length
    };
    if (O.also) { try { O.also(rec, runner); } catch (e) { console.warn('[campaign] outcome error:', e); } }
    runner._log('record', 'written', tile || L.id);
    this.save();
  },

  // The win card's lines for a journey level: who walks on, and who was lost here.
  cardLines(level, runner) {
    const rec = this.record, tile = this.tileOf(level.id), out = [];
    const O = level.outcome || {};
    const on = (O.birds || []).filter(n => this.alive(n));
    if (on.length) out.push(`Walking on: ${this._list(on)}.`);
    const lostHere = Object.keys(rec.birds).filter(n => rec.birds[n].born && !rec.birds[n].alive && rec.birds[n].at === tile);
    for (const n of lostHere) out.push(`${this.title(n).charAt(0).toUpperCase() + this.title(n).slice(1)} was ${this._causeWords(rec.birds[n].cause)} here.`);
    if (level.closingLines) { try { out.push(...[].concat(level.closingLines(rec, runner) || [])); } catch (e) { /* a level's own words */ } }
    return out;
  }
};

CAMPAIGN.init();
