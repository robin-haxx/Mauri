// ============================================================================
// BATCH: research runs of a level, headless, across seeds
// ============================================================================
//   node tools/batch.js --level <id or family> [--sketch <label>] --seeds 1..10 [--years 1]
//                       [--seconds 240] [--player cover] [--out tests]
//
// Each seed opens the game as ?level=...&seed=N&bench=1&years=Y (Game.autoStartFromURL), lets
// it load, then steps the simulation itself (game.update) until the level ends, the years are
// up, or --seconds of play have passed. It saves the benchmark CSV and, for a chapters level,
// the story log (.beats.json) into --out, and prints per run: the result, how long it ran, each
// guaranteed beat natural or forced, who the eagle took, and any cast lost.
//
// --player cover   a stand-in player: every few seconds, a Storm is put over any cast member an
//                  eagle is hunting in the open (free; the harness is not playing for mauri).
// --player basic   ...and it sprouts bare pātōtara and sets wharariki by the family in winter.
//
// Stand-ins that PAY for what they do (10 to move a storm, 40 to call one, 25 a patch) and
// act for every animal of a focus species, named or not. They differ in how fast they react
// to a hunt and in what they bother with, to show how different players would fare:
//   --player tend     a careful player: covers a hunted bird 2 s into the eagle's wind-up, feeds
//                     a hungry one (wharariki in the cold months, pātōtara in the warm)
//   --player slow     the same, but 5 s to react to a hunt and slower to notice hunger
//   --player late     8 s to react: usually after the wind-up is over
//   --player storms   covers (as tend) and never feeds
//   --player feeder   feeds (as tend) and never covers
//   --player none     never acts
//   --player j:<kind> the journey's stand-ins (tools/standins.js), for levels/journey_*.js
//   --record <name>   start a journey level from a written record (CAMPAIGN.PRESETS: all_lived,
//                     papa_lost, mama_lost, elders_lost, barely) or a base64 record
//
// Same seed, same run, on one machine and browser: the land and every roll come from p5's
// seeded generator. On another machine the run starts the same and then drifts (most likely
// the browser's own sine and cosine differing in the last digit): ENGINE_ASSESSMENT.md §16.4.
// Needs Playwright (see tools/_headless.js).
// ============================================================================
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, serve, args, openGame } = require('./_headless');

function seedList(opt) {
  if (opt.seeds) {
    const m = String(opt.seeds).match(/^(\d+)\.\.(\d+)$/);
    if (m) { const a = +m[1], b = +m[2], out = []; for (let s = a; s <= b; s++) out.push(s); return out; }
    return String(opt.seeds).split(',').map(Number);
  }
  const seed = opt.seed != null ? Number(opt.seed) : 1, runs = Number(opt.runs) || 1, out = [];
  for (let k = 0; k < runs; k++) out.push(seed + k);
  return out;
}

(async () => {
  const opt = args(process.argv.slice(2));
  if (!opt.level) { console.log('usage: node tools/batch.js --level <id or family> [--sketch label] --seeds 1..10 [--years n] [--seconds n] [--player cover] [--out dir]'); process.exit(2); }
  const years = Number(opt.years) || 0, seconds = Number(opt.seconds) || 300, outDir = path.resolve(ROOT, opt.out || 'tests');
  fs.mkdirSync(outDir, { recursive: true });
  const { port, child } = await serve(Number(opt.port) || 0);
  const tally = { runs: 0, beats: {}, results: {}, kills: {}, castLost: 0 };
  try {
    for (const seed of seedList(opt)) {
      const q = `?render=2d&level=${encodeURIComponent(opt.level)}${opt.sketch ? '&sketch=' + encodeURIComponent(opt.sketch) : ''}&seed=${seed}&bench=1${years ? '&years=' + years : ''}${opt.record ? '&record=' + encodeURIComponent(opt.record) : ''}`;
      const { page, errors, close } = await openGame(port, q);
      // Stop the page's own loop at once and step the loading ourselves, so no real-time frame
      // reaches the simulation: with a seed, the run then replays exactly.
      const started = await page.evaluate(async () => {
        BENCHMARK.noDownload = true;
        noLoop();
        for (let i = 0; i < 4000 && game.state === GAME_STATE.LOADING; i++) { redraw(); if (i % 40 === 0) await new Promise(r => setTimeout(r, 0)); }
        return game.state === GAME_STATE.PLAYING;
      });
      if (!started) { console.log(`seed ${seed}: the level did not start (is "${opt.level}" a level or family id?)`); await close(); continue; }
      // --player j:<kind>: the journey's stand-ins (tools/standins.js: tend, slow, late, none, storms,
      // lance, sow, lategrove, hideall), who know lancewood, harakeke, the Forest Seed and speargrass.
      if (/^j:/.test(opt.player || '')) {
        await page.addScriptTag({ url: `http://localhost:${port}/tools/standins.js` });
        const out = await page.evaluate(async ({ seconds, kind }) => STANDINS.run({ seconds, player: kind }), { seconds, kind: opt.player.slice(2) });
        const c = out.cases;
        console.log(`seed ${seed}: ${out.state} after ${out.sec}s${out.reason ? ` (${out.reason})` : ''} | year ${out.year}, ${out.chapter} | goals ${out.goals.length}, missed ${out.missed.join(',') || 'none'} | beats ${out.beats.join(' ') || '(none)'} | taught: ${c.taught.noHint}/${c.taught.met} no hint, ${c.taught.lost} lost; own: ${c.own.noHint}/${c.own.met} | cast lost: ${out.castLost.join(' ') || 'none'} | ${Object.entries(out.species).map(([k, v]) => k + ' ' + v).join(', ')} | ${out.mauri} mauri`);
        if (out.record) fs.writeFileSync(path.join(outDir, `${opt.level}_seed${seed}.record.json`), JSON.stringify(out.record, null, 1));
        tally.runs++; tally.results[out.state] = (tally.results[out.state] || 0) + 1;
        await close();
        continue;
      }
      const run = await page.evaluate(async ({ maxFrames, player, trace }) => {
        const sim = game.simulation;
        let frames = 0, nextPlayer = 0;
        const traced = [];   // --trace <cast name>: that bird, once a second, for the printout
        const traceRow = () => {
          const ch = game.chapters, m = ch && ch.castEnts[trace];
          if (!m) return;
          const tp = m.targetPlant;
          traced.push(`${(game.playTime / 60).toFixed(0)}s h=${m.hunger.toFixed(0)} ${m.alive ? m.currentState : 'DEAD'}${m.isFeeding ? '+feed' : ''}${m.inShelter ? ' hid' : ''} tgt=${tp ? tp.type + '@' + Math.hypot(tp.pos.x - m.pos.x, tp.pos.y - m.pos.y).toFixed(0) : '-'} el=${sim.terrain.getElevationAt(m.pos.x, m.pos.y).toFixed(2)} migr=${!!m.isMigrating} preg=${!!m.isPregnant}`);
        };
        // ---- The paying stand-ins (tend, slow, late, storms, feeder, none) ----------------------
        const KIND = { tend: { react: 2, feedEvery: 3, cover: true, feed: true }, slow: { react: 5, feedEvery: 9, cover: true, feed: true },
                       late: { react: 8, feedEvery: 9, cover: true, feed: true }, storms: { react: 2, cover: true, feed: false },
                       feeder: { feedEvery: 3, cover: false, feed: true }, none: { cover: false, feed: false } }[player] || null;
        const spent = {}, seenHunt = new Map();
        let nextFeed = 0;
        const pay = (what, cost) => { if (!game.mauri.canAfford(cost)) return false; game.mauri.spend(cost); spent[what] = (spent[what] || 0) + cost; return true; };
        const focusKeys = () => (game.chapters && game.chapters.focus && game.chapters.focus.length) ? game.chapters.focus : ['upland_moa'];
        const tended = () => { const f = focusKeys(); return sim.moas.filter(m => m.alive && f.includes(m.speciesKey)); };
        const near = (type, m, d) => sim.placeables.some(p => p.alive && p.type === type && Math.hypot(p.pos.x - m.pos.x, p.pos.y - m.pos.y) < d);
        const has = (type) => !!(game.activePlaceables && game.activePlaceables[type]);
        // (What a stand-in does is announced as a player's own action would be, so the lesson's
        // record and its hint ladders see it.)
        const did = (ev, type) => { if (game.tutorial && typeof TUTORIAL_EVENTS !== 'undefined') game.tutorial.fireEvent(TUTORIAL_EVENTS[ev], { type }); };
        const standIn = () => {
          if (!KIND) return;
          const now = game.playTime, f = focusKeys();
          if (KIND.cover) for (const e of sim.eagles) {
            const t = e.alive && e.hunting && e.target;
            if (!t || !t.alive || !f.includes(t.speciesKey)) continue;
            if (!seenHunt.has(t)) seenHunt.set(t, now);            // first noticed now: act after the reaction time
            if (t.inShelter || now - seenHunt.get(t) < KIND.react * 60) continue;
            seenHunt.delete(t);
            const storms = sim.placeables.filter(p => p.alive && p.type === 'Storm');
            if (storms.length && pay('move storm', 10)) {
              storms.sort((a, b) => Math.hypot(a.pos.x - t.pos.x, a.pos.y - t.pos.y) - Math.hypot(b.pos.x - t.pos.x, b.pos.y - t.pos.y));
              const s = storms[0]; s.pos.x = t.pos.x; s.pos.y = t.pos.y; if (s.life != null && s.maxLife) s.life = s.maxLife;
              did('PLACEABLE_MOVED', 'Storm');
            } else if (has('Storm') && pay('new storm', 40)) { sim.addPlaceable(t.pos.x, t.pos.y, 'Storm'); did('PLACEMENT', 'Storm'); }
          }
          for (const [t] of seenHunt) if (!t.alive || !sim.eagles.some(e => e.alive && e.hunting && e.target === t)) seenHunt.delete(t);
          if (KIND.feed && now >= nextFeed) {
            nextFeed = now + KIND.feedEvery * 60;
            for (const p of sim.placeables) if (p.alive && p.unsprouted && game._sprout) game._sprout(p);   // (free)
            const sk = game.seasonManager.currentKey;
            const cold = sk === 'winter' || (sk === 'autumn' && game.seasonManager.progress > 0.6);
            const type = cold ? 'wharariki' : 'patotara', line = cold ? 45 : 55;
            if (has(type)) for (const m of tended()) {
              if (m.hunger > line && !near(type, m, 90) && pay(type, 25)) { sim.addPlaceable(m.pos.x + 18, m.pos.y, type); did('PLACEMENT', type); break; }
            }
          }
        };
        const coverCast = () => {   // the stand-in player: a Storm over a hunted cast member in the open
          const ch = game.chapters; if (!ch) return;
          for (const name in ch.castEnts) {
            const m = ch.castEnts[name];
            if (!m || !m.alive || m.inShelter) continue;
            const hunted = sim.eagles.some(e => e.alive && e.hunting && e.target === m);
            if (hunted) { sim.addPlaceable(m.pos.x, m.pos.y, 'Storm'); ch._log('player', 'cover', name); }
          }
          if (player !== 'basic') return;
          // ...and, with 'basic': sprout any bare patch, and in winter set flax by the family.
          for (const p of sim.placeables) if (p.alive && p.unsprouted && game._sprout) { game._sprout(p); ch._log('player', 'sprout', p.type); }
          if (game.seasonManager.currentKey === 'winter') {
            const m = ch.castEnts.mama || ch.castEnts.papa;
            if (m && m.alive && !sim.placeables.some(p => p.alive && p.type === 'wharariki' && Math.hypot(p.pos.x - m.pos.x, p.pos.y - m.pos.y) < 80) &&
                typeof PLACEABLES !== 'undefined' && PLACEABLES.wharariki) {
              sim.addPlaceable(m.pos.x + 20, m.pos.y, 'wharariki'); ch._log('player', 'flax', 'mama');
            }
          }
        };
        // (frameCount is advanced by hand: with the page's loop stopped it would stand still, and
        // the game times a few things by it, a moa's next search for food among them.)
        while (frames < maxFrames && game.state === GAME_STATE.PLAYING) {
          for (let i = 0; i < 300 && game.state === GAME_STATE.PLAYING; i++) {
            frameCount++; game.update(1); frames++;
            if (player && game.playTime >= nextPlayer) { if (KIND) standIn(); else coverCast(); nextPlayer = game.playTime + 30; }
            if (trace && frames % 60 === 0) traceRow();
          }
          BENCHMARK.finishIfEnded(game);
          await new Promise(r => setTimeout(r, 0));
        }
        if (BENCHMARK.active && !BENCHMARK.finished) BENCHMARK.finish(game, game.state === GAME_STATE.PLAYING ? 'cap' : game.state);
        const last = BENCHMARK.lastRun || {};
        const counters = game.chapters ? game.chapters.counters : {};
        const kills = {};
        for (const k in counters) if (/^killed:/.test(k)) kills[k.slice(7)] = counters[k];
        const castLost = (last.log || []).filter(l => l.kind === 'cast_lost').map(l => `${l.id}@${l.t}s`);
        // A short hash of the CSV: two runs of one seed should print the same (an exact replay).
        let h = 2166136261; for (let i = 0; i < (last.csv || '').length; i++) { h ^= last.csv.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        const focusNow = tended().length, years = Math.floor((sim.seasonTurns || 0) / 4) + 1;
        const left = counters['left:' + focusKeys()[0]] || 0;
        return { result: last.result, playTime: last.playTime, beats: last.beats || {}, kills, castLost, csv: last.csv, json: last.log ? last : null,
                 state: game.state, reason: game.gameOverReason || '', hash: h.toString(16), traced,
                 focusNow, years, left, spent, paying: !!KIND, mauri: Math.floor(game.mauri.mauri),
                 cases: (last.cases || []).filter(c => c.outcome === 'solved' || c.outcome === 'lost' || c.outcome === 'passed') };
      }, { maxFrames: seconds * 60, player: opt.player || null, trace: opt.trace || null });
      if (opt.trace && run.traced.length) { console.log(`  trace of ${opt.trace}:`); for (const r of run.traced.slice(-Number(opt.traceRows || 40))) console.log('   ' + r); }
      const seen = (tally.seedsSeen = tally.seedsSeen || {}); seen[seed] = (seen[seed] || 0) + 1;
      const base = `${opt.level}${opt.sketch ? '_' + opt.sketch : ''}_seed${seed}${seen[seed] > 1 ? '_r' + seen[seed] : ''}`;
      if (run.csv) fs.writeFileSync(path.join(outDir, base + '.csv'), run.csv);
      if (run.json) fs.writeFileSync(path.join(outDir, base + '.beats.json'), JSON.stringify(run.json, null, 1));
      const beats = Object.entries(run.beats).map(([k, v]) => `${k}:${v}`).join(' ') || '(no beats)';
      const kills = Object.entries(run.kills).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
      const paid = Object.entries(run.spent || {}).map(([k, v]) => `${k} ${v}`).join(', ');
      const tail = run.paying || paid || run.left ? ` | focus animals ${run.focusNow}${run.left ? `, ${run.left} left over the pass` : ''}, year ${run.years} | spent ${paid || 'nothing'}, ${run.mauri} mauri in hand` : '';
      console.log(`seed ${seed}: ${run.result} after ${run.playTime}s${run.reason ? ` (${run.reason})` : ''} | beats ${beats} | eagle took: ${kills}${run.castLost.length ? ` | cast lost: ${run.castLost.join(' ')}` : ''}${tail} | replay ${run.hash}`);
      (tally.focus = tally.focus || []).push(run.focusNow); (tally.yearsRun = tally.yearsRun || []).push(run.years);
      // Hint ladders: how far up each problem went before it was answered.
      if (run.cases && run.cases.length) {
        const part = (list) => { const solved = list.filter(c => c.outcome === 'solved'); const at = (r) => solved.filter(c => c.rung === r).length;
          return `${list.length} (answered: no hint ${at(0)}, after the question ${at(1)}, after being told ${solved.filter(c => c.rung >= 2).length}; went away by itself ${list.filter(c => c.outcome === 'passed').length}; lost ${list.filter(c => c.outcome === 'lost').length})`; };
        const main = run.cases.filter(c => !c.transfer), tr = run.cases.filter(c => c.transfer);
        console.log(`   problems met: ${part(main)}${tr.length ? `; in the unprompted stretch: ${part(tr)}` : ''}`);
        tally.cases = (tally.cases || []).concat(run.cases);
      }
      for (const e of errors.filter(x => /error/.test(x))) console.log('   ' + e);
      tally.runs++;
      tally.results[run.result] = (tally.results[run.result] || 0) + 1;
      for (const [k, v] of Object.entries(run.beats)) { tally.beats[k] = tally.beats[k] || { natural: 0, forced: 0 }; tally.beats[k][v]++; }
      for (const [k, v] of Object.entries(run.kills)) tally.kills[k] = (tally.kills[k] || 0) + v;
      tally.castLost += run.castLost.length;
      await close();
    }
  } finally {
    child.kill();
  }
  console.log(`\n${tally.runs} run(s): ${Object.entries(tally.results).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const [k, v] of Object.entries(tally.beats)) console.log(`  beat ${k}: natural ${v.natural}, forced ${v.forced}`);
  console.log(`  eagle took: ${Object.entries(tally.kills).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing'}; cast lost ${tally.castLost}`);
  if (tally.focus && tally.focus.length) {
    const f = tally.focus.slice().sort((a, b) => a - b), y = tally.yearsRun.slice().sort((a, b) => a - b);
    console.log(`  focus animals at the end: ${f[0]} to ${f[f.length - 1]} (median ${f[Math.floor(f.length / 2)]}); years reached: ${y[0]} to ${y[y.length - 1]}`);
  }
  if (tally.cases && tally.cases.length) {
    const main = tally.cases.filter(c => !c.transfer), tr = tally.cases.filter(c => c.transfer);
    const share = (list) => { const real = list.filter(c => c.outcome !== 'passed');
      return real.length ? `${real.filter(c => c.outcome === 'solved' && c.rung === 0).length} of ${real.length} answered with no hint, ${real.filter(c => c.outcome === 'solved' && c.rung > 0).length} after a hint, ${real.filter(c => c.outcome === 'lost').length} lost` : 'none'; };
    console.log(`  problems met in the lessons' year: ${share(main)}; in the unprompted stretch: ${share(tr)}`);
  }
  console.log(`  files in ${outDir}`);
})().catch((e) => { console.error(e); process.exit(2); });
