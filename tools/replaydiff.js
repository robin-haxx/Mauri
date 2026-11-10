// ============================================================================
// REPLAYDIFF: find where the same seeded run differs between two machines
// ============================================================================
//   node tools/replaydiff.js --level <id or family> [--sketch <label>] --seed 1 [--seconds 60]
//                            [--out run_a.txt]
//
// A seed replays a run exactly on one machine and browser, and not (yet) across machines: the
// same seed starts the same and drifts apart within half a minute of play. This tool prints a
// fingerprint of the whole simulation once a second, so the same command run on two machines
// gives two files whose first differing line is the second the runs parted. It also prints,
// first, a fingerprint of the browser's own arithmetic (sine, cosine, arctangent, powers,
// exponentials over fixed inputs): if THAT line differs between the machines, the browser's
// math is the cause, and the fix is for the simulation to carry its own versions of the
// functions that differ (the tool names them).
//
//   machine A:  node tools/replaydiff.js --level chapters_storms --sketch Guided --seed 1 --out a.txt
//   machine B:  node tools/replaydiff.js --level chapters_storms --sketch Guided --seed 1 --out b.txt
//   then:       diff a.txt b.txt | head
//
// No stand-in player is used: the run is the simulation alone. Needs Playwright.
// ============================================================================
'use strict';
const fs = require('fs');
const { serve, args, openGame } = require('./_headless');

(async () => {
  const opt = args(process.argv.slice(2));
  if (!opt.level) { console.log('usage: node tools/replaydiff.js --level <id or family> [--sketch label] --seed n [--seconds 60] [--out file]'); process.exit(2); }
  const seed = opt.seed != null ? Number(opt.seed) : 1, seconds = Number(opt.seconds) || 60;
  const { port, child } = await serve(Number(opt.port) || 0);
  try {
    const q = `?render=2d&level=${encodeURIComponent(opt.level)}${opt.sketch ? '&sketch=' + encodeURIComponent(opt.sketch) : ''}&seed=${seed}&bench=1`;
    const { page, close } = await openGame(port, q);
    const lines = await page.evaluate(async ({ seconds }) => {
      BENCHMARK.noDownload = true; noLoop();
      const fnv = (h, n) => { // fold a number's exact bits into a hash
        const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, n);
        for (let i = 0; i < 8; i++) { h ^= b.getUint8(i); h = Math.imul(h, 16777619) >>> 0; }
        return h;
      };
      const out = [];
      // 1. The browser's own arithmetic, function by function.
      const xs = [0.1, 0.7, 1.3, 2.9, 3.7, 5.1, 9.9, 123.456, 1e-3, 0.999999];
      const fns = { sin: Math.sin, cos: Math.cos, tan: Math.tan, atan: Math.atan, exp: Math.exp, log: Math.log, sqrt: Math.sqrt,
                    atan2: (x) => Math.atan2(x, 1.7), pow: (x) => Math.pow(x, 1.4), pow2: (x) => Math.pow(1.4, x), hypot: (x) => Math.hypot(x, 2.2) };
      const parts = [];
      for (const name in fns) { let h = 2166136261; for (const x of xs) h = fnv(h, fns[name](x)); parts.push(`${name}=${h.toString(16)}`); }
      out.push('math ' + parts.join(' '));
      out.push('browser ' + navigator.userAgent.replace(/\s+/g, '_'));
      for (let i = 0; i < 4000 && game.state === GAME_STATE.LOADING; i++) { redraw(); if (i % 40 === 0) await new Promise(r => setTimeout(r, 0)); }
      const sim = game.simulation;
      // 2. The land as built (its heights at a grid of points), then the run, a line a second.
      let hl = 2166136261;
      for (let y = 10; y < sim.terrain.mapHeight; y += 40) for (let x = 10; x < sim.terrain.mapWidth; x += 40) hl = fnv(hl, sim.terrain.getElevationAt(x, y));
      out.push(`land ${hl.toString(16)} plants=${sim.plants.length} moa=${sim.moas.length}`);
      for (let s = 1; s <= seconds && game.state === GAME_STATE.PLAYING; s++) {
        for (let i = 0; i < 60; i++) { frameCount++; game.update(1); }
        let h = 2166136261, n = 0;
        const fold = (list) => { for (const e of list) { if (!e.alive) continue; h = fnv(fnv(fnv(h, e.pos.x), e.pos.y), e.hunger || 0); n++; } };
        fold(sim.moas); fold(sim.eagles);
        for (const k in sim.otherEntities) fold(sim.otherEntities[k]);
        out.push(`${String(s).padStart(4)}s ${h.toString(16).padStart(8, '0')} alive=${n} eggs=${sim.eggs.filter(e => e.alive && !e.hatched).length}`);
        if (s % 10 === 0) await new Promise(r => setTimeout(r, 0));
      }
      return out;
    }, { seconds });
    const text = lines.join('\n') + '\n';
    if (opt.out) { fs.writeFileSync(opt.out, text); console.log(`${lines.length} lines written to ${opt.out}`); console.log(lines.slice(0, 3).join('\n')); }
    else process.stdout.write(text);
    await close();
  } finally {
    child.kill();
  }
})().catch((e) => { console.error(e); process.exit(2); });
