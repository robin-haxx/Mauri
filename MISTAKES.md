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
