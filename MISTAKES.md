# Mauri; mistakes worth not repeating

A plain record of things that were tried and went wrong, so the reasoning that now
looks arbitrary in the code has somewhere to live. **Newest first**; put new
entries at the top.

Each entry: what happened · root cause · consequence · the rule that prevents a
repeat. The rule is the part that also lives at the call site (as a short guard
comment) and, where general, in `OVERVIEW.md`. Tags: **[fixed]** a real incident, now
fixed; **[process]** a testing trap, not a bug; **[rule]** a design guardrail, built in;
**[inherited]** a rule paid for in the Te Manawa fork, which shares this engine's lineage.

---

## [fixed] Wild moa starved beside food: three foraging traps, found by the first emergent module

- **What happened.** In the chapters modules (`levels/chapters_storms.js`, `chapters_patotara.js`),
  where the family are ordinary simulation moa rather than scripted ones, a parent or a chick
  starved within a minute with forty plants in reach. The scripted modules never showed it:
  their family moa fed through `MoaLife._feed`, not `Moa.forage`.
- **Root cause.** Three traps in `mauri_moa.js`, each read from a headless trace of one bird
  (`tools/batch.js --trace <cast name>`). (1) `findPlant` did not skip an **unsprouted** pātōtara
  (a bare bush waiting for the player's hand): the moa walked to it and "ate" nothing from it,
  frame after frame. (2) `seekAttractions` pre-empts `forage()` whenever a placed patch attracts
  the moa, with no check that it is getting nearer; a slow bird on a steep slope was pulled at a
  patch across a rock band until it died. (3) `forage()` kept a target plant it never reached
  for the same reason (the distance swung between 30 and 70 units for forty seconds).
- **Rule.** A forager skips what has nothing on it (`unsprouted`, `nutrition <= 0`, a plant it
  gave up on), a critically hungry moa eats what is in reach before following a patch's pull,
  and any pull or target that has made no progress for four seconds is given up for a while
  (`_attrStall`, `_tgtStall`, `_unreachable`). The general rule, again: **anything a bird walks
  at must be checked for progress, and dropped when there is none.** To find such a trap,
  trace one bird once a second (state, hunger, target and its distance) rather than reading
  population counts.

## [process] A headless run must advance `frameCount` by hand

- **What happened.** Driving the game from a script (`game.update(1)` in a loop with the draw
  loop stopped), moa searched for food once and never again, and every family starved.
- **Root cause.** `Moa.forage` backs off its next search to `frameCount + 20`, and p5's
  `frameCount` only moves when `draw()` runs. A few other things are timed by it too (storm
  swell, the kea's lure refresh, a plant's sprouting).
- **Rule.** A harness that steps the simulation itself increments `frameCount` with every step
  (`tools/batch.js`, `tools/validate.js --smoke`), and stops the page's own loop *before* the
  level loads, or a few real-time frames reach the simulation and a seeded run stops being a
  replay.

## [fixed] Module moa walked forever at goals over a ridge; sites picked by distance, not by land

- **What happened.** In the modules, a moa told to go somewhere it couldn't reach kept trying:
  two moa started with an unbroken line of mountain tops between them, and a walk's goal sat
  across a ridge.
- **Root cause.** The directors pick their sites by distance on the planning grid (only the
  tarn's and the friends' winter spot's routes were path-checked, and Module 1's way in fell
  back to a straight line when there was no path). `_walkableNear` snapped a bird to the nearest
  walkable ground even across a ridge. And `MoaLife`'s stuck-watcher re-planned a detour every
  ~4 s to a goal no detour could reach. `mauri_module.js`, `mauri_module_patotara.js`.
- **Rule.** Anything a bird walks between must be on one stretch of land: check it with land
  regions (`TerrainGenerator.connected`, or the planning grid's `sameRegion` while the terrain
  is still generating). Site pickers filter candidates to the home region, spawns pass an anchor
  to `_walkableNear`, `_findPath` gives up at once between regions, and `MoaLife._travel` swaps a
  goal it can't reach for the nearest ground on its own side. To test it, wrap
  `TerrainGenerator.prototype.getElevation` to raise a glacier band across the window: real
  seeds rarely split the land.

## [fixed] Forest birds starved in a small window: three steering traps

- **What happened.** In the modules' free play (a 425×317 window), kererū, kākā and kōkako
  starved at full hunger with trees all around them.
- **Root cause.** Three steering rules written for Free Play's big map, each a trap in a small
  one. (1) `_fleeStorm` flew straight away from a storm, clamped to land; against the map's edge
  that point was no further away, so the bird hovered there, flushed, never feeding. (2) The
  storm flush ring (1.6× the radius) plus `_landward`'s 60-unit edge margin left almost no forest
  the birds could stay in: 95% of the forest cells sat within 60 of an edge. (3) `Boid.edges`
  turns a bird back 25 units from the edge with a force six times its own steering, so a tree
  nearer the edge than that can never be reached; the bird chased it until it starved.
  `mauri_kereru.js`, `mauri_kaka.js`.
- **Rule.** A flee or homing target must make real progress (`_fleeStorm` now fans round for a
  point that gets clear, and gives up if there is none). Birds never pick a tree under a storm
  or within 18 of the edge. Edge margin and flush ring are level knobs
  (`flyerEdgeMargin`, `stormFlushMult`; defaults unchanged). When birds starve "with food
  everywhere", log where each one dies: here every death was at the same point.

## [process] "The plants didn't spawn"; a stale spatial grid, not a bug

- **What happened.** Right after `addPlaceable('keaLure')`, a `getNearbyPlants()` check reported
  0 coprosma berries; looked like the Berry Cache wasn't planting them. It was; a check one
  update later found 9.
- **Root cause.** New plants (from `addPlant`, `spawnPlantsInRadius`) only enter the plant spatial
  grid when it REBUILDS, which happens in `updateSpatialGrids()` on the next `update(dt)`. A query
  issued in the same tick as the insert can't see them yet. `mauri_simulation.js`.
- **Rule.** After adding entities to a static grid (plants/eggs/nesting sites), step at least one
  `update()` before verifying via a `getNearby*` query; or read the list directly. Don't conclude
  "spawn failed" from a same-tick grid read.

## [rule] disperseSeed can't EXPAND the forest; it refuses non-forest biomes

- **What happened.** Building habitat expansion (grow podocarp forest downslope), the obvious reuse
 ; `disperseSeed`; did nothing in shrubland/flats.
- **Root cause.** `disperseSeed` gates on `biome.plantTypes` already containing a FOREST_TREE, so it
  only thickens EXISTING forest; it can't push forest into shrubland/flats. That gate is correct for
  natural recruitment (kererū), but wrong for deliberate cultivation. `mauri_simulation.js`.
- **Rule.** Player cultivation that changes the habitat needs its own path (`growForestAt`) that
  bypasses the biome gate (still density- and cap-limited). Keep `disperseSeed` for emergent
  recruitment; don't loosen its biome gate to serve cultivation.

## [fixed] World-gen froze the browser ~45s; three compounding hot loops, none of them the obvious one

- **What happened.** Loading a level took tens of seconds ("page is slowing your browser"). The
  obvious suspect (baking 4 season buffers) was NOT the main cost.
- **Root cause.** Measured, not guessed (`performance.now` around each sub-step). At `terrainDetail:2`:
  (1) `_buildRenderMaps` called `getElevation()`; the full multi-octave noise stack; for every
  render cell (detail² × the gameplay grid), ~85% of gen time; (2) `_computeBaseCellColors` built a
  p5.Color per cell via `lerpColor()` then read `red()/green()/blue()` (~600K allocations + 1.8M slow
  accessors); (3) p5's default `noiseDetail` of 4 octaves compounded the code's OWN octave loop, so
  every `noise()` did 4 hidden Perlin evals. `mauri_terrain.js`.
- **Consequence.** ~45s synchronous freeze at 1080p (a full page-unresponsive event).
- **Rule.** A VISUAL-ONLY upscaled map should be **interpolated** from the coarse map, never
  re-sampled from noise. On per-pixel/per-cell hot loops, work in **raw RGB numbers**, not p5.Color
  (`lerpColor`/`red`/`green`/`blue` allocate and go through colour-mode machinery). Set `noiseDetail`
  to match your own fractal strategy rather than paying p5's default octaves on top. **Measure the
  sub-steps before optimising**; the bake looked guilty and was innocent.

## [fixed] Changing noise params shifted terrain and exposed a null-deref in eyrie placement

- **What happened.** After `noiseDetail(2,0.5)`, `game.init()` threw
  `Cannot read properties of null (reading 'x')` in `Simulation._findCragEyrie`.
- **Root cause.** `_findCragEyrie` sampled `findWalkablePositionNear()` and used `p.x` without a null
  check; that helper returns null when no walkable spot is near (e.g. an eagle over water/ice). The
  latent bug was always there; the noise change just moved terrain enough to trigger an eagle spawn
  with no nearby land. `mauri_simulation.js`.
- **Consequence.** Level load crashed on some seeds.
- **Rule.** Any placement/threshold search that calls `findWalkablePositionNear` (or reads elevation
  bands, snow line, crag sites) must handle a null / no-match result. AND: changing a global noise
  parameter reshapes the whole heightmap; re-verify the biome distribution and every
  elevation-threshold-dependent placement after such a change (a quick biome histogram is enough).

## [fixed] A new prey species eagles couldn't ever catch; the population cache was moa-only

- **What happened.** When eagles first hunted kea, the eagle would lock onto a kea but the catch
  always failed; kea read as permanently "protected".
- **Root cause.** `Simulation.handleEagleCatchKea` guards with `isSpeciesProtected(key)`, which
  reads `getCachedSpeciesCount(key)`. `_ensurePopulationCache()` only walked `this.moas`, so the
  per-species map had no entry for `kea` → `getCachedSpeciesCount('kea')` returned 0 →
  `0 <= floor` → protected forever. `mauri_simulation.js`.
- **Consequence.** The whole predation premise was inert; kea were unkillable by eagles.
- **Rule.** When a coupling starts reading `getCachedSpeciesCount` / `isSpeciesProtected` for an
  **other-entity** species (kea/kākā/kākāpō/…), make sure `_ensurePopulationCache()` actually
  counts that species. It now folds `otherEntities` into the per-species map (but NOT into
  `moaCount`). Live `getSpeciesCount()` always counted others; the *cache* did not; don't assume
  the cache mirrors the live scan.

## [process] Don't read "nothing happened" in a short passive run as "it's broken"

- **What happened.** Testing the (since retired) kea auto-raid, a 700-tick passive run showed
  `eggsRaided: 0`; it looked like the raid code didn't work.
- **Root cause.** Not a bug: no moa eggs existed yet in that window, and kea only meet moa nests
  where something brings them together. Seeding a cluster of moa eggs beside the kea showed 4/6
  robbed at once.
- **Rule.** For couplings that depend on two populations *meeting*, verify the mechanism by
  seeding the meeting deterministically; judge the *rate* only over long runs.

## [fixed] Other-entity spatial grid crashed on the first tick; a rename missed the constructor

- **What happened.** Driving the Free Play level (which seeds kererū and kōkako via the
  `otherEntities` path), the first unpaused `update()` threw
  `TypeError: Cannot read properties of undefined (reading 'kereru')` in
  `Simulation.updateSpatialGrids`.
- **Root cause.** The constructor initialised `this.dynamicGrids = {}` (no underscore)
  but every consumer reads `this._dynamicGrids`. A rename that updated the uses but not the
  one initialiser. It hid behind the start-of-level tutorial PAUSE (a paused `update()`
  returns before reaching `updateSpatialGrids`). `mauri_simulation.js`.
- **Consequence.** Any level seeding other-entities crashed on the first frame of actual play.
- **Rule.** When you rename a field, grep the whole file for BOTH spellings; an initialiser that
  still uses the old name fails silently until the collection is non-empty. `node --check` can't
  catch a runtime typo: run the game and pump `update()`.

## [fixed] An endless level with empty goals wins on frame one

- **What happened.** A level with `goals: []`, no `phases` and no `timeLimit` sets
  `GAME_STATE.WON` on the very first update.
- **Root cause.** `Game.checkGoals()` computes `goals.every(g => g.achieved)`, and `every()` on
  an empty array is `true`.
- **Rule.** An endless level says so (`endless: true`), and `checkGoals()` hands it to the year
  engine before the win check. Don't fake it with a never-true goal (it pollutes the goals
  panel and the score). `mauri_sketch.js`.

## [rule] Cold zeroes food value, never existence

- **The trap.** The tempting way to make winter bite is to delete or force-dormant the flora.
  In an evergreen landscape that is a visual lie and a churn bug: the ground goes bare, then
  slowly regrows every spring.
- **Rule.** Winter drops a plant's `nutrition` to its `winterEdibility` floor (foragers skip a
  `winterInedible` plant, which renders frosted), but `alive` stays `true`. Only grazing
  removes a plant. `mauri_plant.js`, `mauri_moa.js`. (See `FREEPLAY_PLAN.md` §3.2.)

## [rule] The winter edibility floor replaces the squared winter term

- **The trap.** `Plant.handleGrowth()` already applies the season twice
  (`maxNutrition = base × seasonalModifier`, then `nutrition = maxNutrition × seasonalModifier ×
  typeModifier`), so winter food is ≈ 0.01× base before anything else. A third winter factor
  on top pins every plant to zero and erases the beech-vs-rimu distinction.
- **Rule.** `_applyWinterEdibility` blends toward a value computed from `baseNutrition`
  (`base × growth × winterEdibility × …`), not from the already-squared nutrition, so the floor
  is what a winter plant is worth. Check a beech plant's winter `nutrition` against a rimu's
  after touching either path. `mauri_plant.js`.

## [inherited] A per-run climate scalar written back to CONFIG/SEASONS compounds

- **What happened (in Te Manawa).** A per-run terrain adjustment written back onto `CONFIG`
  compounded across every regeneration and drifted the world away from its authored look.
- **Root cause.** `applyLevelToConfig()` copies a level's values onto the shared, mutable
  `CONFIG`; `SEASONS` is one shared table. Anything mutated in place isn't reset between runs.
- **Rule.** `coldIndex` (and the mast year) modulate seasonal numbers **at read time, on the
  instance**. Never write them back into `SEASONS`, `CONFIG`, or a plant's base fields.
  Modulate, don't mutate. `mauri_seasons.js`, `mauri_sketch.js`.

## [fixed/inherited] A closure-taking lerp helper on a hot path

- **What happened.** `SeasonManager._lerpSeasonal(getCur, getNext)` took two fresh arrow functions
  per call, from every seasonal getter, per entity, per frame. In Te Manawa the identical helper
  was the sim's largest GC source (~1,400 closures/frame).
- **Rule.** Inline the current→next blend in each getter (done in `mauri_seasons.js`). Don't route
  hot-path blends through a closure-taking helper.

## [inherited] Climate as a sine wave; and when a parametric curve is fine

- **What happened (in Te Manawa).** A generic ~100 kyr sinusoid over `yearsBP` put the last
  interglacial mid-glacial and missed the LGM; real cycles are irregular. The fix there was a
  table of anchor points.
- **Rule.** Free Play's `ClimateDrift` is a *game difficulty curve*, not a paleoclimate, so a
  parametric oscillation is the right choice: tunable and legible. If the game is ever asked to
  replay a *real* sequence of glacials, use an anchor table, not a wave.
  `mauri_climate_drift.js`.

## [fixed] The eagle could never catch a giant moa: its resist roll ran on every scan

- **What happened.** In the five-year free play the eagle hunted the giant moa herd for four
  minutes, got within a pixel of one, and starved to death without a catch; the chapters run
  then ended with "the ecosystem lost its apex predator".
- **Root cause.** The giant moa's `eagleResistance` (a 30% chance to shrug off an attack) was
  rolled in the eagle's prey *scan*, once per moa per frame. In a herd the bird's pick flickered
  between members from frame to frame, and under a chapter level's `coverBreaksLock` every
  change of target counted as a fresh lock-on: a new wind-up, a new grace window, another
  `eagle_hunting` event. No wind-up ever reached zero. (A lone giant moa in a classic level was
  nearly uncatchable the same way: the one-second wind-up needs sixty unbroken frames and a
  30% per-frame skip never allows them.)
- **Rule.** A chance to resist is rolled *at the strike*, once per attempt (`Moa.resistEagleAttack`,
  now called from `HaastsEagle.hunt`); on a shrug-off the bird breaks off and rests briefly. A
  scan decides what the eagle can *see*; nothing in it may be random per frame for the bird it
  is already chasing. And a "fresh lock" means the last target is gone from view (under cover or
  dead), not that a nearer bird appeared. `mauri_eagle.js`.

## [fixed] A chick starved at arm's length from its feeding parent; two more foraging traps

- **What happened.** In the five-year free play Pukepuke hovered for seventy seconds at exactly
  fifty units from a parent feeding on a wharariki patch, hunger climbing, and starved. In
  spring it walked past tussock at its feet toward a beech a hundred units up a slope.
- **Root cause.** Two rules of the open simulation, each fine alone. (1) The separation push
  from a neighbour inside fifty units is stronger than the pull toward a plant (0.96 against at
  most 0.9 of `maxForce`), so a bird whose food lies inside a neighbour's ring stands on the
  ring. (2) Plant choice divides distance by nutrition, so a rich plant far off outscores a poor
  one close by; a starving bird on a slope dies on the way to the richer one, then the stall
  watch hands it the next far plant.
- **Rule.** A hungry bird crowds in: above its hunger threshold the separation push scales down
  toward 0.3 as hunger nears critical. A starving bird (past `criticalHunger`) takes the nearest
  real meal (fifteen food or more on it), not the richest in range. Both in `mauri_moa.js`.
  When a cast member starves beside food, run `tools/batch.js --trace <name>` first: the trace
  prints the target plant, its distance and the stall counter once a second, and the fault is
  usually visible in twenty rows.

## [process] A replay proven on one machine was claimed for every machine

- **What happened.** The documents said a run "replays exactly from a seed, so two researchers
  can watch the same five years". The owner re-ran nine seeded stand-in runs on another machine
  with the same code. Each began identically and drifted apart 17 to 35 seconds in; two runs
  that were wins in the build container were losses there.
- **Root cause.** The claim was tested only where it was made: same container, same browser
  build, same processor. There it holds (same hash under load, in parallel, six days apart).
  The simulation's stepping reads no clock, so the remaining suspects are the browser's own
  math functions (sine, cosine, arctangent, powers), which may differ in the last digit between
  browser builds and processors. Not yet confirmed.
- **Rule.** "Deterministic" needs its scope stated: one machine, one browser, or everywhere.
  Before a replay is promised across machines, run one seed on two of them and compare the
  hash `tools/batch.js` prints. Until that passes, research replays are made on the machine
  that made the original, and results are reported over many seeds as a range.

## [fixed] A bird could be struck with no wind-up of its own: two gaps in the eagle's telegraph

- **What happened.** In the endless variant a stand-in player with a five-second reaction lost
  named birds in the first autumn, although the eagle's wind-up was six seconds. Two traces
  showed why. In one the eagle locked onto Papa with a full six seconds, lost sight of him,
  and locked onto another bird with the 2.5 seconds left on the same timer. In the other it
  was winding up on one bird when Mama walked out of cover beside it; it turned to her, the
  nearer bird, and struck at once.
- **Root cause.** The wind-up (`tutorialGraceTimer`) was only started when it stood at zero, so
  a second lock inherited the first lock's leftover time. And a change to a nearer target
  mid-chase was deliberately not a fresh lock (to stop a herd's flicker resetting the wind-up
  for ever), so the new bird got no wind-up at all.
- **Rule.** Under `eagleTelegraph` the eagle commits to the bird it picked for as long as it
  can see it and it is in range, so there is no flicker to guard against; any change of target
  is then a fresh hunt, with the full wind-up and the `eagle_hunting` event on that bird.
  Nothing a level calls a focus animal may be struck without a wind-up on it. Test it with a
  stand-in that reacts slower than the wind-up is long minus a second: `tools/batch.js --player slow`.
  `mauri_eagle.js`.

## [fixed] A rule written for one level changed every level; the replay hashes caught it

- **What happened.** After the endless variant was built, the old Endless level and Level 2 no
  longer replayed to their recorded hashes; Level 2's seeded run even ended in a loss it had
  not had.
- **Root cause.** "A hen and her young stand close" (no separation push between a moa and its
  mother) was written straight into `Moa.applySeparation`, and every hatchling now knows its
  mother, so it applied in every level. Every other change in that batch was behind a flag;
  this one line was not.
- **Rule.** Before changing shared simulation code, record a seeded replay hash for a level of
  each kind that should not change (`tools/batch.js` prints it), and compare afterwards. A new
  behaviour reads its flag even when it "can't matter" elsewhere. The hashes hold on one machine
  and browser only (see the replay entry above), which is all this check needs.

## [fixed] A courted hen laid out of season's turn; a flock overshot its cap

- **What happened.** With every moa on a breeding calendar, hens still laid several eggs a
  year, and the upland moa went from four to nine in one year. Kea, capped at six, reached ten.
- **Root cause.** The calendar's "not again until her next year" was checked only on the bird
  that starts a courtship (`isReadyToMate`). A cock in season could court a hen who had already
  laid, and `canBeMate` (the check on the bird courted) knew nothing of the calendar. For the
  birds, the flock cap was tested before laying, so four hens under the cap each laid a full
  clutch at once.
- **Rule.** A limit on breeding is asked of both partners (`Moa._calendarAllows`), and a cap on
  numbers counts the eggs already in the nest (`Kereru._tryReproduce`, where the level sets
  `birdMaxPopulation`). The first of these also tightens the five-year lesson's giant moa, which
  could be courted out of turn the same way.

## [fixed] Kea hovered at a storm's edge, or short of a tree, until they starved

- **What happened.** In journey mode a kea that met a storm sometimes stayed flying in one
  place until it starved. Under the old code, in a seeded test a kea was flushed off a storm
  over 300 times a minute, and one in the land's corner never landed at all.
- **Root cause.** Three unreachable goals. (1) The base flush (`Kereru._fleeStorm`) carries a
  bird just clear of the cloud, but the kea's own choices (its food search, home perch tree,
  berry lure and elevation drift, all overrides in `mauri_kea.js`) never asked about storms,
  so they pulled it straight back under to be flushed again. (2) In a corner the flush aimed
  at a point inside the 25-unit band where `Boid.edges` pushes birds back in, and the bird
  balanced there "fleeing" forever. (3) Apart from storms, the kea's food search had no edge
  check (the base one does), so it could pick a plant 5 units from the map's edge and hover
  against the edge force.
- **Rule.** An override of a target-choosing method inherits none of the base's filters: copy
  them (storm, edge) or call through. A flyer's fly-to point is kept `Kereru.REACH_EDGE` (30)
  from the edge, beyond `Boid.edges`. A flushed kea now picks a refuge outside the storm and
  lands there (`Kea._findStormRefuge`), a flush that makes no progress for 0.75 s escapes to a
  refuge instead, and a kea that gets no closer to its food plant for 3 s gives it up for 10 s
  (`Kea._watchTarget`): the progress watchdog from "the unreachable goal".
