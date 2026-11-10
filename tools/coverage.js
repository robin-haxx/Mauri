// ============================================================================
// COVERAGE: which rules a level plays by, and which lesson teaches each
// ============================================================================
//   node tools/coverage.js                    every level, one line each
//   node tools/coverage.js --level <id>       one level, rule by rule
//
// A lesson says which rules of the simulation it teaches with a `teaches` list (rule names
// from the table below). This tool reads every registered level, works out which rules are in
// force on it from its switches and tools, and reports for each rule whether some lesson
// teaches it. A rule in force that no lesson teaches is a gap between the lessons and that
// level (the "cliff" a player meets). A level that plays by the opposite of a taught rule is
// marked as contradicting it (a storm that stuns where the lessons teach that it hides).
//
// The table is the place to add a rule when a new mechanic is built: its name, a sentence a
// teacher could read, and how to tell from a level's definition that it is in force.
// Needs Playwright (see tools/_headless.js).
// ============================================================================
'use strict';
const { serve, args, openGame } = require('./_headless');

(async () => {
  const opt = args(process.argv.slice(2));
  const { port, child } = await serve(Number(opt.port) || 0);
  try {
    const { page, close } = await openGame(port, '?render=2d');
    const report = await page.evaluate(() => {
      const M = (d) => d.mechanics || {};
      const tool = (d, k) => !!(d.availablePlaceables && k in d.availablePlaceables) ||
        JSON.stringify(d.freeplaySchedule || {}).includes(`"${k}"`);
      const stormCover = (d) => { const s = d.availablePlaceables && d.availablePlaceables.Storm; return !!(s && s.blocksEagleVision); };
      // name: [sentence, in force on this level?, the rule it contradicts (optional)]
      const RULES = {
        cover:            ["A moa under a storm can't be seen by the Pouākai.", (d) => stormCover(d)],
        storm_stuns:      ["A storm stuns a hunting eagle.", (d) => tool(d, 'Storm') && !stormCover(d) && !d.story, 'cover'],
        eagle_reads:      ["The Pouākai's hunger and its wind-up can be read before it strikes.", (d) => !!M(d).eagleTelegraph],
        surplus_prey:     ["A hungry eagle turns to prey with numbers to spare.", (d) => !!(M(d).eagleSurplusPreference || M(d).coverSendsEagleAway)],
        eagle_takes_birds:["A hungry eagle takes flighted birds too.", (d) => !!M(d).eagleHuntsFlyers],
        sprout:           ["Pātōtara fruits when it is sprouted by hand.", (d) => !!M(d).sproutPatotara],
        berries_draw_kea: ["Berries draw kea.", (d) => !!M(d).keaBerryLureRadius || tool(d, 'keaLure')],
        moa_defend_nests: ["Moa gathered at a nest make a kea's raid fail.", (d) => M(d).keaRaidsEggs === 'odds' || (!!M(d).keaRaid && tool(d, 'nestRaid'))],
        nest_raid:        ["The player can send stationed kea to raid a moa nest.", (d) => tool(d, 'nestRaid')],
        winter_food:      ["Winter takes food value: pātōtara is bare, and wharariki feeds through the cold.", (d) => !!(M(d).placedPlantsSeasonal || M(d).winterInedibility)],
        tended_food:      ["Wild browse only partly feeds the families: what the player grows decides breeding and winters.", (d) => M(d).focalWildFoodMult != null],
        breeding_seasons: ["Every creature breeds in its own season.", (d) => !!M(d).seasonalBirdBreeding],
        slow_herds:       ["Herds grow slowly: one egg a year or two, and years for a chick to grow up.", (d) => !!M(d).moaCalendar],
        over_the_pass:    ["When a herd runs low a few arrive over the pass, and grown young leave by it.", (d) => !!(M(d).rescueImmigration || M(d).dispersal)],
        protected_floors: ["Some species cannot fall below a floor.", (d) => !!(M(d).freeplayProtectFloor || (M(d).populationFloors && Object.keys(M(d).populationFloors).length) || (M(d).birdPopulationFloor > 0)), 'over_the_pass'],
        nest_founding:    ["Two patches of a moa's favoured plant, with that moa near, found a nest.", (d) => !!(M(d).nestingSites && M(d).nestingSites.foundPatches) || !!d.moaZones],
        waterhole:        ["A waterhole gathers moa and birds.", (d) => tool(d, 'waterhole')],
        fern_shelter:     ["A fern shelter half hides a moa.", (d) => tool(d, 'shelter')],
        balance_income:   ["Mauri comes from a healthy, even ecosystem.", (d) => !!(M(d).freeplayPassive || M(d).ecosystemIncome)],
        yearly_focus:     ["Each year has focus species with goals of their own.", (d) => !!d.freeplaySchedule],
        climate:          ["The cold deepens over the years.", (d) => !!M(d).climateDrift],
        mast_year:        ["A rimu mast year lets the kākāpō breed.", (d) => !!d.mastGoal || tool(d, 'rimuScramble')],
        forest_tools:     ["Forest can be spread with the Forest Seed.", (d) => tool(d, 'forestBoost')],
        world_tour:       ["The view moves to a new area of a larger land each year.", (d) => !!d.worldGrid && !d.story]
      };
      const levels = LEVEL_REGISTRY.getAll();
      const teachers = {};   // rule -> the lessons that teach it
      const unknown = [];
      for (const d of levels) for (const r of (d.teaches || [])) {
        if (!RULES[r]) { unknown.push(`${d.id} teaches "${r}", which is not a rule in tools/coverage.js`); continue; }
        (teachers[r] = teachers[r] || []).push(d.id);
      }
      const out = [];
      for (const d of levels) {
        const rows = [];
        for (const name in RULES) {
          const [sentence, on, against] = RULES[name];
          let inForce = false;
          try { inForce = !!on(d); } catch (e) { inForce = false; }
          if (!inForce) continue;
          const by = (teachers[name] || []).filter(id => id !== d.id);
          const self = (d.teaches || []).includes(name);
          const status = (against && (teachers[against] || []).length) ? 'CONTRADICTS a taught rule'
            : (self ? 'taught here' : (by.length ? 'taught' : 'untaught'));
          rows.push({ name, sentence, status, by: by.slice(0, 3), against: against || '' });
        }
        out.push({ id: d.id, section: (typeof levelSection === 'function') ? levelSection(d) : '', teaches: d.teaches || [], rows });
      }
      return { out, unknown };
    });
    for (const u of report.unknown) console.log('warning: ' + u);
    const only = opt.level || null;
    for (const L of report.out) {
      if (only && L.id !== only) continue;
      const un = L.rows.filter(r => r.status === 'untaught'), bad = L.rows.filter(r => /CONTRADICTS/.test(r.status));
      if (!only) {
        console.log(`${L.id.padEnd(28)} ${String(L.rows.length).padStart(2)} rules in force, ${String(un.length).padStart(2)} untaught${bad.length ? `, ${bad.length} contradicting what a lesson teaches` : ''}${L.teaches.length ? `  (teaches: ${L.teaches.join(', ')})` : ''}`);
        continue;
      }
      console.log(`${L.id} (${L.section}): ${L.rows.length} rules in force`);
      for (const r of L.rows) {
        const tail = r.status === 'taught' ? ` by ${r.by.join(', ')}` : (r.against ? ` (${r.against})` : '');
        console.log(`  ${r.status === 'untaught' ? '✗' : (/CONTRA/.test(r.status) ? '!' : '✓')} ${r.name.padEnd(18)} ${r.status}${tail}\n      ${r.sentence}`);
      }
      console.log(`  ${un.length} untaught, ${bad.length} contradicting`);
    }
    await close();
  } finally {
    child.kill();
  }
})().catch((e) => { console.error(e); process.exit(2); });
