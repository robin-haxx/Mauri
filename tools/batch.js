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
//
// Same seed, same run: the land and every roll come from p5's seeded generator.
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
      const q = `?render=2d&level=${encodeURIComponent(opt.level)}${opt.sketch ? '&sketch=' + encodeURIComponent(opt.sketch) : ''}&seed=${seed}&bench=1${years ? '&years=' + years : ''}`;
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
      const run = await page.evaluate(async ({ maxFrames, player }) => {
        const sim = game.simulation;
        let frames = 0, nextPlayer = 0;
        const coverCast = () => {   // the stand-in player: a Storm over a hunted cast member in the open
          const ch = game.chapters; if (!ch) return;
          for (const name in ch.castEnts) {
            const m = ch.castEnts[name];
            if (!m || !m.alive || m.inShelter) continue;
            const hunted = sim.eagles.some(e => e.alive && e.hunting && e.target === m);
            if (hunted) { sim.addPlaceable(m.pos.x, m.pos.y, 'Storm'); ch._log('player', 'cover', name); }
          }
        };
        while (frames < maxFrames && game.state === GAME_STATE.PLAYING) {
          for (let i = 0; i < 300 && game.state === GAME_STATE.PLAYING; i++) {
            game.update(1); frames++;
            if (player === 'cover' && game.playTime >= nextPlayer) { coverCast(); nextPlayer = game.playTime + 30; }
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
        return { result: last.result, playTime: last.playTime, beats: last.beats || {}, kills, castLost, csv: last.csv, json: last.log ? last : null,
                 state: game.state, reason: game.gameOverReason || '', hash: h.toString(16) };
      }, { maxFrames: seconds * 60, player: opt.player || null });
      const seen = (tally.seedsSeen = tally.seedsSeen || {}); seen[seed] = (seen[seed] || 0) + 1;
      const base = `${opt.level}${opt.sketch ? '_' + opt.sketch : ''}_seed${seed}${seen[seed] > 1 ? '_r' + seen[seed] : ''}`;
      if (run.csv) fs.writeFileSync(path.join(outDir, base + '.csv'), run.csv);
      if (run.json) fs.writeFileSync(path.join(outDir, base + '.beats.json'), JSON.stringify(run.json, null, 1));
      const beats = Object.entries(run.beats).map(([k, v]) => `${k}:${v}`).join(' ') || '(no beats)';
      const kills = Object.entries(run.kills).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
      console.log(`seed ${seed}: ${run.result} after ${run.playTime}s${run.reason ? ` (${run.reason})` : ''} | beats ${beats} | eagle took: ${kills}${run.castLost.length ? ` | cast lost: ${run.castLost.join(' ')}` : ''} | replay ${run.hash}`);
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
  console.log(`  files in ${outDir}`);
})().catch((e) => { console.error(e); process.exit(2); });
