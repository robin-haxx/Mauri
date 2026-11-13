// ============================================================================
// STAND-IN PLAYERS FOR THE JOURNEY (loaded into the game's page by a test, not by index.html)
// ============================================================================
// tools/batch.js carries the stand-ins for the first lessons inside its own page script. The
// journey's lessons have new tools (lancewood, harakeke, the Forest Seed, speargrass), so the
// stand-ins that know them live here, as a page script any harness can load:
//
//   const s = document.createElement('script'); s.src = '/tools/standins.js'; document.head.appendChild(s);
//   await STANDINS.load();                          // steps the loading screen
//   const out = await STANDINS.run({ seconds: 300, player: 'tend' });
//
// tools/batch.js loads it with --player j:<kind> (see there). The page's own loop is stopped
// and the simulation is stepped by hand, as batch.js does, so a seeded run replays exactly.
//
// The kinds, by how fast they react and what they bother with (as batch.js's):
//   tend     reacts to a hunt in 2 s; answers each lesson's own problem promptly
//   slow     5 s to a hunt; twice as slow to the lesson's problem
//   late     8 s to a hunt; four times as slow to the lesson's problem
//   none     never acts (the lesson must be lost, or its record must show nothing answered)
//   lance    only ever plants lancewood          sow     only ever sows forest
//   lategrove  plants the winter grove in winter, not autumn
//   hideall  covers every bird of its own and never lets the eagle have one (for 6f)
// Every action is paid for, and announced as a player's own (so the hint ladders see it).
// ============================================================================
'use strict';
window.STANDINS = {
  KINDS: {
    tend: { react: 2, lag: 1, cover: true, tools: true }, slow: { react: 5, lag: 2, cover: true, tools: true },
    late: { react: 8, lag: 4, cover: true, tools: true }, none: { cover: false, tools: false }, storms: { react: 2, cover: true, tools: false },
    lance: { cover: false, tools: true, only: ['lancewood'], lag: 1 }, sow: { cover: false, tools: true, only: ['forestBoost'], lag: 1 },
    lategrove: { react: 2, lag: 1, cover: true, tools: true, lateGrove: true }, hideall: { react: 0.5, lag: 1, cover: true, tools: true, coverAll: true }
  },

  async load() {
    if (typeof BENCHMARK !== 'undefined') BENCHMARK.noDownload = true;
    noLoop();
    for (let i = 0; i < 4000 && game.state === GAME_STATE.LOADING; i++) { redraw(); if (i % 40 === 0) await new Promise(r => setTimeout(r, 0)); }
    return game.state === GAME_STATE.PLAYING;
  },

  async run({ seconds = 300, player = 'tend', until = null } = {}) {
    const K = this.KINDS[player] || this.KINDS.none, sim = game.simulation, ch = game.chapters;
    const spent = {}, seenHunt = new Map(), acted = {};
    const pay = (what, cost) => { if (!game.mauri.canAfford(cost)) return false; game.mauri.spend(cost); spent[what] = (spent[what] || 0) + cost; return true; };
    const has = (t) => !!(game.activePlaceables && game.activePlaceables[t]) && !(game._lockedTools && game._lockedTools.has(t)) && (!K.only || K.only.includes(t));
    const cost = (t) => (game.activePlaceables[t] && game.activePlaceables[t].cost) || 25;
    const did = (ev, type) => { if (game.tutorial) game.tutorial.fireEvent(TUTORIAL_EVENTS[ev], { type }); };
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const live = (t) => sim.placeables.filter(p => p.alive && p.type === t && !p.matured);
    const cast = (n) => ch && ch.castEnts[n] && ch.castEnts[n].alive ? ch.castEnts[n] : null;
    const leads = () => Object.keys(ch ? ch.castEnts : {}).map(cast).filter(Boolean);
    const focus = () => { const f = (ch && ch.focus.length) ? ch.focus : ['upland_moa']; return sim.moas.filter(m => m.alive && f.includes(m.speciesKey)); };
    // A spot `d` from p where `type` may go, trying eight directions (the first that is allowed).
    const spotNear = (p, d, type, away = null) => {
      let best = null, bs = -Infinity;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2, q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
        if (!game._canPlaceAt(type, q.x, q.y)) continue;
        const s = away ? dist(q, away) : 0;
        if (s > bs) { bs = s; best = q; }
      }
      return best;
    };
    const put = (type, q, key, every) => {
      const now = game.playTime;
      // (A player who covers keeps enough in hand to move a storm or call one.)
      if (!q || !has(type) || now < (acted[key] || 0)) return false;
      if (K.cover && game.mauri.mauri < cost(type) + 50) return false;
      if (!pay(type, cost(type))) return false;
      const sel = game.selectedPlaceable; game.selectedPlaceable = null;
      sim.addPlaceable(q.x, q.y, type); did('PLACEMENT', type);
      game.selectedPlaceable = sel;
      acted[key] = now + every * 60 * (K.lag || 1);
      return true;
    };

    const step = () => {
      const now = game.playTime, sk = game.seasonManager.currentKey, prog = game.seasonManager.progress;
      // ---- Cover a hunted bird (the Storm, as tile 1 taught) ------------------------------------
      if (K.cover) for (const e of sim.eagles) {
        const t = e.alive && e.hunting && e.target;
        const mine = t && t.alive && (focus().includes(t) || (K.coverAll && sim.moas.includes(t)));
        if (!mine) continue;
        if (!seenHunt.has(t)) seenHunt.set(t, now);
        if (t.inShelter || now - seenHunt.get(t) < K.react * 60) continue;
        seenHunt.delete(t);
        const storms = sim.placeables.filter(p => p.alive && p.type === 'Storm');
        if (storms.length && pay('move storm', 10)) {
          storms.sort((a, b) => dist(a.pos, t.pos) - dist(b.pos, t.pos));
          const s = storms[0]; s.pos.x = t.pos.x; s.pos.y = t.pos.y; if (s.life != null && s.maxLife) s.life = s.maxLife;
          did('PLACEABLE_MOVED', 'Storm');
        } else if (has('Storm') && pay('new storm', cost('Storm'))) { sim.addPlaceable(t.pos.x, t.pos.y, 'Storm'); did('PLACEMENT', 'Storm'); }
      }
      for (const [t] of seenHunt) if (!t.alive || !sim.eagles.some(e => e.alive && e.hunting && e.target === t)) seenHunt.delete(t);
      if (!K.tools) return;
      const L = leads(), anchor = L[0] || focus()[0];
      if (!anchor) return;

      // ---- Lancewood: a lead's meal was cut short by the crowd -> a stand away from it ------------
      const crowded = L.find(m => m._shortMeal && m._shortMeal.why === 'crowded' && now < m._shortMeal.until);
      if (crowded && now >= (acted.crowdSeen || 0)) {
        if (acted.crowdAt == null) acted.crowdAt = now;
        if (now - acted.crowdAt >= 3 * 60 * (K.lag || 1)) {
          // (Away from the family: the far side of the herd from where the leads feed.)
          if (put('lancewood', spotNear(crowded.pos, 115, 'lancewood', crowded.homeRange || crowded.pos), 'lancewood', 40)) acted.crowdAt = null;
        }
      } else if (!crowded) acted.crowdAt = null;

      // ---- The winter grove: harakeke where the family will winter, planted in autumn --------------
      if (has('harakeke')) {
        const want = K.lateGrove ? (sk === 'winter') : (sk === 'autumn' && prog > 0.15 * (K.lag || 1) || sk === 'winter');
        const site = (ch && (ch.sites.winterGround || ch.sites.edgeCamp)) || anchor.pos;
        if (want && live('harakeke').filter(p => dist(p.pos, site) < 130).length < 2) put('harakeke', spotNear(site, 40 + 30 * live('harakeke').length, 'harakeke'), 'harakeke', 12);
      }
      // ---- Wharariki / pātōtara for a hungry family, as batch.js's 'tend' ---------------------------
      const cold = sk === 'winter' || (sk === 'autumn' && prog > 0.6);
      for (const type of [cold ? 'wharariki' : 'patotara']) {
        if (!has(type)) continue;
        const hungry = focus().find(m => m.hunger > (cold ? 45 : 55) && !live(type).some(p => dist(p.pos, m.pos) < 90));
        if (hungry) put(type, spotNear(hungry.pos, 20, type) || hungry.pos, type, 6);
      }
      for (const p of sim.placeables) if (p.alive && p.unsprouted && game._sprout && has('patotara')) game._sprout(p);

      // ---- The Forest Seed: a grove by the kākāpō, sown ahead of the mast ----------------------------
      if (has('forestBoost')) {
        const kp = (sim.otherEntities.kakapo || []).filter(b => b.alive);
        const c = kp.length ? { x: kp.reduce((a, b) => a + b.pos.x, 0) / kp.length, y: kp.reduce((a, b) => a + b.pos.y, 0) / kp.length } : anchor.pos;
        if (live('forestBoost').length < 1 && (sim.seasonTurns || 0) >= 1 * (K.lag || 1) - 1) put('forestBoost', spotNear(c, 50, 'forestBoost') || spotNear(c, 100, 'forestBoost'), 'forestBoost', 50);
      }
      if (has('rimuScramble') && sim.mastYear && now >= (acted.scramble || 0) && sk === 'summer') {
        const def = game.activePlaceables.rimuScramble;
        if (game._useGlobalInteractable && game._useGlobalInteractable('rimuScramble', def)) { spent.rimuScramble = (spent.rimuScramble || 0) + def.cost; did('PLACEMENT', 'rimuScramble'); }
        acted.scramble = now + 40 * 60;
      }

      // ---- Speargrass: two patches by the pair found a nest (when the level watches for one) -----------
      if (has('speargrass') && sim.moaNestingWatch && sk !== 'winter') {
        const patches = sim._focusPlantPatches(), nests = (sim.nestingSites || []).filter(s => s.alive !== false).length;
        const wantNests = (ch && ch.vars.wantNests) || 1;
        if (nests < wantNests && patches.length < 2) {
          const base = patches[0] ? patches[0].pos : anchor.pos;
          put('speargrass', spotNear(base, patches[0] ? 60 : 30, 'speargrass'), 'speargrass', 4);
        }
      }
    };

    let frames = 0, next = 0;
    const max = seconds * 60;
    while (frames < max && game.state === GAME_STATE.PLAYING && !(until && until())) {
      for (let i = 0; i < 300 && game.state === GAME_STATE.PLAYING; i++) {
        frameCount++; game.update(1); frames++;
        if (game.playTime >= next) { step(); next = game.playTime + 30; }
      }
      if (typeof BENCHMARK !== 'undefined' && BENCHMARK.finishIfEnded) BENCHMARK.finishIfEnded(game);
      await new Promise(r => setTimeout(r, 0));
    }
    return this.report(spent);
  },

  report(spent = {}) {
    const ch = game.chapters, sim = game.simulation, c = ch ? ch.counters : {};
    const cases = ch ? ch.caseLog.filter(k => ['solved', 'lost', 'passed'].includes(k.outcome)) : [];
    const part = (list) => ({ met: list.length, noHint: list.filter(k => k.outcome === 'solved' && k.rung === 0).length,
      afterQuestion: list.filter(k => k.outcome === 'solved' && k.rung === 1).length, afterTold: list.filter(k => k.outcome === 'solved' && k.rung >= 2).length,
      passed: list.filter(k => k.outcome === 'passed').length, lost: list.filter(k => k.outcome === 'lost').length });
    const kills = {}; for (const k in c) if (/^killed:/.test(k)) kills[k.slice(7)] = c[k];
    const species = {};
    for (const m of sim.moas) if (m.alive) species[m.speciesKey] = (species[m.speciesKey] || 0) + 1;
    for (const k in sim.otherEntities) species[k] = sim.otherEntities[k].filter(b => b.alive).length;
    return {
      state: game.state, reason: game.gameOverReason || '', sec: Math.round(game.playTime / 60), chapter: ch && ch.cur ? ch.cur.id : '',
      year: Math.floor((sim.seasonTurns || 0) / 4) + 1,
      goals: ch ? [...ch.met] : [], missed: ch ? ch.log.filter(l => l.kind === 'missed').map(l => l.id) : [],
      beats: ch ? ch.log.filter(l => l.kind === 'beat' && /done/.test(l.info)).map(l => `${l.id}:${/forced/.test(l.info) ? 'forced' : 'natural'}`) : [],
      cases: { taught: part(cases.filter(k => !k.transfer)), own: part(cases.filter(k => k.transfer)) },
      byCase: cases.reduce((a, k) => { const key = k.id + (k.transfer ? '*' : ''); (a[key] = a[key] || []).push(`${k.outcome[0]}${k.rung}`); return a; }, {}),
      castLost: ch ? ch.log.filter(l => l.kind === 'cast_lost').map(l => `${l.id}:${l.info}@${l.t}s`) : [],
      kills, species, spent, mauri: Math.floor(game.mauri.mauri),
      issues: ch ? ch.log.filter(l => l.kind === 'issue').map(l => `${l.id} ${l.info}`) : [],
      record: (typeof CAMPAIGN !== 'undefined' && game.state === GAME_STATE.WON) ? CAMPAIGN.record : undefined
    };
  }
};
