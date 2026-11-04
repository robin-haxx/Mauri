// ============================================================================
// VALIDATE: check every registered level without playing it
// ============================================================================
//   node tools/validate.js            level-format checks for every level, and the chapters
//                                     engine's checks for every level with chapters
//   node tools/validate.js --smoke    ...then start each level headless and run it 15 seconds,
//                                     reporting any page or console error
//   node tools/validate.js --only <levelId>   just that level
//
// Exits non-zero on any issue that isn't a warning (the engine's warnings start "warning:").
// Needs Playwright (see tools/_headless.js).
// ============================================================================
'use strict';
const { serve, args, openGame } = require('./_headless');

(async () => {
  const opt = args(process.argv.slice(2));
  const { port, child } = await serve(Number(opt.port) || 0);
  let failed = false;
  try {
    const { page, errors, close } = await openGame(port, '?render=2d');
    const report = await page.evaluate((only) => {
      const out = [];
      for (const def of LEVEL_REGISTRY.getAll()) {
        if (only && def.id !== only) continue;
        const issues = [];
        try { issues.push(...(LEVEL_REGISTRY.validate(def) || []).map(s => 'format: ' + s)); } catch (e) { issues.push('format check threw: ' + e.message); }
        if (def.chapters && typeof ChapterRunner !== 'undefined') {
          try { issues.push(...ChapterRunner.validate(def)); } catch (e) { issues.push('chapters check threw: ' + e.message); }
        }
        out.push({ id: def.id, chapters: !!def.chapters, sketch: def.sketch ? `${def.sketch.of}/${def.sketch.label}` : '', issues });
      }
      return out;
    }, opt.only || null);

    for (const r of report) {
      const warn = r.issues.filter(s => /^warning:/.test(s)), bad = r.issues.filter(s => !/^warning:/.test(s));
      const tag = r.chapters ? ` (chapters${r.sketch ? ', ' + r.sketch : ''})` : '';
      console.log(`${bad.length ? 'FAIL' : 'ok  '} ${r.id}${tag}${warn.length ? `  ${warn.length} warning(s)` : ''}`);
      for (const s of bad) console.log('      ' + s);
      for (const s of warn) console.log('      ' + s);
      if (bad.length) failed = true;
    }
    if (errors.length) { console.log('page/console while loading:'); for (const e of errors) console.log('  ' + e); }

    if (opt.smoke) {
      console.log('\nsmoke: each level, 15 s of play, headless');
      const ids = report.map(r => r.id);
      for (const id of ids) {
        const before = errors.length;
        const res = await page.evaluate(async (levelId) => {
          try {
            if (typeof BENCHMARK !== 'undefined') BENCHMARK.cancel();
            game.loadLevel(levelId);
            game._startLoading();
            for (let i = 0; i < 4000 && game.state === GAME_STATE.LOADING; i++) { redraw(); if (i % 40 === 0) await new Promise(r => setTimeout(r, 0)); }
            if (game.state === GAME_STATE.LOADING) return { ok: false, why: 'still loading' };
            if (game.tutorial) game.tutorial.skipTutorial();
            game.state = GAME_STATE.PLAYING;
            for (let i = 0; i < 900; i++) { game.update(1); if (game.state !== GAME_STATE.PLAYING) break; }
            return { ok: true, state: game.state, moa: game.simulation.getMoaPopulation(), eagles: game.simulation.countAliveEagles(),
                     chapter: game.chapters && game.chapters.cur ? game.chapters.cur.id : '' };
          } catch (e) { return { ok: false, why: e.message }; }
        }, id);
        const errs = errors.slice(before).filter(e => !/warning:/.test(e));
        const bad = !res.ok || errs.length;
        console.log(`${bad ? 'FAIL' : 'ok  '} ${id}: ${res.ok ? `${res.state}, ${res.moa} moa, ${res.eagles} eagles${res.chapter ? ', chapter ' + res.chapter : ''}` : res.why}`);
        for (const e of errs) console.log('      ' + e);
        if (bad) failed = true;
      }
    }
    await close();
  } finally {
    child.kill();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
