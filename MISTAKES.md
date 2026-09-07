# Mauri — mistakes worth not repeating

A plain record of things that were tried and went wrong, so the reasoning that now
looks arbitrary in the code has somewhere to live. **Newest first** — put new
entries at the top.

Each entry: what happened · root cause · consequence · the rule that prevents a
repeat. The rule is the part that also lives at the call site (as a short guard
comment) and, where general, in `OVERVIEW.md`.

> **Status.** This log opens as a *seed* for the Free Play mode (see
> `FREEPLAY_PLAN.md`), which is not built yet. The entries below are of two honest
> kinds, each labelled: **[verified]** — a trap confirmed by reading the *current*
> Mauri code, which a Free Play implementer will hit; and **[inherited]** — a rule
> paid for in blood in the Te Manawa fork (`TeManawa/MISTAKES.md`) that applies
> directly here because the engines share a lineage. Real Mauri incidents get added
> on top as they happen.

---

## [fixed] Other-entity spatial grid crashed on the first tick — a rename missed the constructor

- **What happened.** Driving the Free Play level (which seeds kererū and kōkako via the
  `otherEntities` path), the first unpaused `update()` threw
  `TypeError: Cannot read properties of undefined (reading 'kereru')` in
  `Simulation.updateSpatialGrids` — before any Free Play code ran.
- **Root cause.** The constructor initialised `this.dynamicGrids = {}` (no underscore)
  but every consumer reads `this._dynamicGrids` (`updateSpatialGrids`, and the
  per-type grid getter). So `this._dynamicGrids` was `undefined`, and
  `this._dynamicGrids[type]` threw the moment `otherEntities` had any key. A rename
  that updated the uses but not the one initialiser. `mauri_simulation.js`.
- **Consequence.** Any level that seeds other-entities — the shipped glacial level as
  well as Free Play — crashes on the first frame of actual play. It hid behind the
  start-of-level tutorial PAUSE (a paused `update()` returns before reaching
  `updateSpatialGrids`), so it only surfaced when the sim actually ran.
- **Rule.** One name: the grids are `this._dynamicGrids`, initialised in the
  constructor beside `_movingGridPairs`/`_staticGridPairs`. When you rename a field,
  grep the whole file for BOTH spellings — an initialiser that still uses the old name
  fails silently until the collection is non-empty. (Found by running the game headless
  in the browser and pumping `update()`; `node --check` cannot catch a runtime typo.)

## [verified] An endless level with empty goals wins on frame one

- **What happened.** The obvious way to build a no-objective sandbox — a level with
  `goals: []`, no `phases`, no `timeLimit` — sets `GAME_STATE.WON` on the very first
  update, before the player does anything.
- **Root cause.** `Game.checkGoals()` (`mauri_sketch.js`) computes
  `allAchieved = goals.every(g => g.achieved)`; for an empty array `every()` returns
  `true`. With no `timeLimit`, the branch `!this.timeLimit && allAchieved` is
  satisfied immediately, so the level is won with zero goals met. The shipped glacial
  level dodges this only because it sets `phases`, which routes `checkGoals()` to
  `_checkPhases()` before the empty-array test is ever reached.
- **Consequence.** An endless mode built the intuitive way is unplayable — it
  completes instantly.
- **Rule.** Give the mode a first-class `endless: true` on the level def and
  short-circuit at the top of `checkGoals()`: `if (this.currentLevel?.endless)
  return;`. Do **not** fake it with a never-true goal (it would still pollute the
  goals panel and the score tally). Loss stays with the existing last-moa check in
  `update()`. `mauri_sketch.js`.

## [verified/anticipated] Modelling winter by removing plants churns the map bare

- **What happened (anticipated).** The tempting way to make winter bite is to delete
  or force-dormant the flora when the cold arrives. In Kahurangi — an evergreen
  landscape — that is both a visual lie and a churn bug: the ground goes bare, then
  slowly regrows every spring, the exact die-off-and-recover cycle the Free Play brief
  says to avoid.
- **Root cause.** In `mauri_plant.js` a plant only truly leaves the world through
  `consume()` (grazing), which sets `alive = false` and starts a regrowth timer.
  Dormancy and forest-suppression, by contrast, set `nutrition = 0` but keep
  `alive = true` and keep drawing the plant. Winter food scarcity belongs on the
  *nutrition* axis, not the *existence* axis — but a naive "winter kills plants"
  change would put it on the wrong one, and heavy grazing of a slow-regrowing winter
  patch already tends toward bare ground on its own.
- **Consequence (if built wrong).** A bare, flickering map that contradicts the
  evergreen ecology and manufactures a regrowth churn every cycle.
- **Rule.** Cold zeroes **food value, never existence.** Winter drops a plant's
  `nutrition` to its `winterEdibility` floor (and foragers skip it like a dormant
  plant), but `alive` stays `true` and it renders frosted. Only grazing removes a
  plant. Guard this with a benchmark assertion: the count of `alive` plants after a
  simulated deep winter is unchanged by cold alone. `mauri_plant.js`,
  `mauri_moa.js`. (See `FREEPLAY_PLAN.md` §4.2.)

## [inherited] A per-run climate scalar written back to CONFIG/SEASONS compounds

- **What happened.** In the Te Manawa fork, a per-run terrain adjustment written back
  onto `CONFIG` compounded across every regeneration and drifted the world away from
  its authored look. The identical trap is waiting for Free Play's climate drift: the
  natural-but-wrong move is to deepen winter by mutating the `SEASONS` table or
  `CONFIG` winter modifiers in place as `coldIndex` rises.
- **Root cause.** `applyLevelToConfig()` copies a level's authored values onto the
  shared, mutable `CONFIG` at load; `SEASONS` is a single shared table. Soft restarts
  and reseeds re-read those. Any value mutated *in place* by a per-frame or per-cycle
  system is not reset between runs, so it accumulates.
- **Consequence.** The whole game creeps permanently colder across restarts —
  invisible in a single session, corrupting over many.
- **Rule.** `coldIndex` modulates seasonal numbers **at read time, on the instance** —
  pass it into `SeasonManager.update(dt, coldIndex)` and fold it into the getters'
  return values. Never write it back into `SEASONS`, `CONFIG`, or a plant's base
  fields. Modulate, don't mutate. `mauri_seasons.js`, `mauri_sketch.js`.

## [verified/inherited] The season lerp helper allocates two closures per call

- **What happened.** `SeasonManager._lerpSeasonal(getCurrentVal, getNextVal)`
  (`mauri_seasons.js`) is called by every seasonal getter — plant modifiers, hunger,
  migration strength, snow line — and each call passes two fresh arrow functions
  (`() => this.current.x`, `() => this.next.x`). These getters run per entity per
  frame. In the Te Manawa fork the identical helper was measured as the sim's single
  largest GC source (~1,400 short-lived closures/frame) and was inlined away. Mauri
  still carries the pre-fix version.
- **Root cause.** A closure-taking helper on a hot per-frame path allocates on every
  call by construction.
- **Consequence.** Steady per-frame garbage and GC pressure — and Free Play makes it
  worse, adding `coldIndex` folding and a per-type edibility read to the same hot
  getters.
- **Rule.** Inline the current→next blend directly in each seasonal getter (a plain
  `if (transitionProgress > 0) return lerp(cur, nxt, t); return cur;`) **before**
  adding Free Play's load. Don't route hot-path blends through a closure-taking
  helper. `mauri_seasons.js`.

## [anticipated] Layering an edibility floor on the already-squared winter modifier

- **What happened (anticipated).** Free Play adds a `winterEdibility` floor to winter
  food value. Added naively as a third multiplier, it overshoots to ~zero and the
  floor does nothing — because winter is *already* applied twice.
- **Root cause.** `Plant.handleGrowth()` (`mauri_plant.js`) computes
  `maxNutrition = baseNutrition * seasonalModifier` and then, the same frame,
  `nutrition = maxNutrition * seasonalModifier * typeModifier` — so a full-grown
  plant's winter food value is scaled by `seasonalModifier` **squared** before any
  edibility factor is applied. In deep winter (`seasonalModifier ≈ 0.1`) that is
  already `≈ 0.01×` base; a third winter factor on top pins it to zero for every
  plant, erasing the beech-vs-rimu distinction the floor is meant to create.
- **Consequence (if built wrong).** The carefully-authored per-plant winter larder
  becomes uniformly worthless, and the forest-refuge lifeline never materialises.
- **Rule.** Decide deliberately whether `winterEdibility` **replaces** the squared
  winter term in the winter branch or **multiplies** a single (non-squared) one.
  Verify with a benchmark read of a beech plant's winter `nutrition` before/after the
  change — the floor must leave beech meaningfully above rimu. Whether the existing
  double-application is itself intended is a separate question to resolve first, not
  to build on top of blind. `mauri_plant.js`. (See `FREEPLAY_PLAN.md` §4.2.)

## [inherited] Climate as a sine wave — and when a parametric curve is fine

- **What happened.** In the Te Manawa fork the glacial cycle was first a generic
  ~100 kyr sinusoid over `yearsBP`; real cycles are strongly asymmetric and
  irregular, so it put the last interglacial mid-glacial and missed the LGM. The fix
  there was a table of anchor points, smoothstepped and auditable one line at a time.
- **Root cause.** No closed form reproduces a *real* paleoclimate sequence.
- **Consequence (there).** Checkable facts came out wrong.
- **Rule (inverted for Free Play).** Free Play's `ClimateDrift` is a *game difficulty
  curve*, not a paleoclimate — so a parametric ramp/oscillation is not just
  acceptable, it is the right choice: tunable, legible, and keyed to game cycles
  rather than real years. Keep the Te Manawa lesson in your pocket for one case only:
  if the mode is ever asked to replay a *real* sequence of glacials, switch to a
  table, don't reach for a wave. `mauri_climate_drift.js` (planned).
