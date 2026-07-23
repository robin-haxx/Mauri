# Performance Assessment — framerate drops

A read-through of the per-frame hot paths (`draw` → `Game.update`/`render` →
`Simulation.update`/`render`, the spatial grid, and the moa/plant render code).
The engine is already well-optimized in the low-level places — the boid steering
reuses pooled vectors, the grid uses flat arrays and bitwise floor, queries use
squared distances, and terrain is a baked image blit. So the remaining wins are
structural, not micro. Ordered by impact × ease.

## How to confirm where the time goes first

Before changing anything, set `CONFIG.debugMode = true`. `draw()` already prints
**Update: X ms** and **Render: Y ms** separately. That single number tells you
whether to spend effort on the simulation (items 1, 4, 6) or the render (items
2, 3). `CONFIG.showGridStats` adds grid occupancy. Do this per level — level 3
(weka/kea) and a large flock stress different paths.

## 1. Static grids are rebuilt every frame — likely the biggest CPU win

`Simulation.updateSpatialGrids()` clears and re-inserts **every** grid in
`_gridEntityPairs` each frame, including `plantGrid` and `eggGrid`. But plants
never move — they're only added on spawn and removed on cleanup — and eggs
incubate in place. Plants are typically the **largest** entity list (`spawnPlants`
seeds the whole map on a scale-2 grid), so this is an O(plants) rebuild of a grid
whose contents didn't change.

**Fix:** keep the plant (and egg) grids in a separate list from the moving
entities (moa/eagle/placeable). Rebuild them only behind a dirty flag set when a
plant/egg is added or removed. Everything else in `updateSpatialGrids` stays the
same. Low risk, high payoff.

## 2. Per-moa `tint()` in the render path

Moa are drawn by tinting a shared sprite: `tint(...)` immediately before each
`image()` in `Moa.render()` (~line 1153). p5's `tint()` takes a per-draw
tinted-copy path that's much slower than a plain `image()` and defeats the fast
blit — the plant sprite code even notes "No tint - fast!" for exactly this reason.
With a full flock this is a real per-frame render cost.

**Fix:** pre-bake one tinted sprite set per species once at load into an
offscreen `p5.Graphics`, then draw the pre-tinted frames with plain `image()` and
no per-draw `tint()`. Same visual result, no per-moa tint cost.

## 3. Render scans the full plant array twice with fresh closures

`Simulation.render()` calls `_renderFiltered(plants, …)` twice per frame — once
for ground plants (`p => p.type !== 'rimu' && p.type !== 'beech' && p.type !==
'fern'`) and again for trees — and allocates the `inView` arrow plus both filter
closures every frame. So each plant is visited twice, each visit paying a closure
call plus a viewport test.

**Fix:** partition plants into two stable lists (ground vs. tree) at spawn/cleanup
so each render pass walks only its own list with no filter. Hoist `inView` and the
filters out of `render()` (define once, not per frame). Optional follow-on: the
hot `render`/`renderIndicators` passes use `e[method]()` string dispatch — direct
calls are a touch faster.

## 4. Redundant / over-wide per-moa spatial queries

Each moa runs ~3–4 grid queries per frame: placeables (r80), eagles, moas, and —
while foraging — a plants query at r100–150 inside `findPlant`, on top of the
throttled food-check scan at r60. Two easy trims:

- **Throttle plant re-selection.** `findPlant` re-scans every foraging frame.
  Keep `targetPlant` until it's eaten or dies (re-select only then), so the wide
  plant query fires occasionally instead of every frame.
- **Only widen the moa query when it's needed.** The neighbor radius is driven by
  `effectiveMatingRadius()`, now up to 2×. Request that wider radius only for moa
  in/entering `SEEKING_MATE`; everyone else uses the base radius.

**Correctness note (not perf):** `getInRadius` returns a **shared** `_resultBuffer`
per grid. `moa.behave` holds the `moas` result while a later call in the same tick
(forest-competition, `mauri_moa.js:924`, level 2) calls `getNearbyMoas` again and
overwrites that buffer mid-behave. Worth a guard (second buffer, or copy) even
though it's masked today.

## 5. `Object.entries(this.otherEntities)` in several per-frame loops

`_updateOtherEntities`, `_updateSpeciesStability`, `render`, and the grid update
each iterate `Object.entries(this.otherEntities)` every frame, allocating a
pairs array each time. Free on levels 1–2 (no extra types) but constant
allocation on level 3.

**Fix:** cache the `{type, list}` array and rebuild it only when the set of entity
types changes.

## 6. Minor / opportunistic

- Moa array is walked twice in render (body pass + indicator pass). Fine as-is;
  could merge for on-screen moa if item 2/3 don't get you there.
- `updateFPS()` / `fpsHistory` bookkeeping — negligible, leave it.

## Suggested order

1. Stop rebuilding the static plant + egg grids every frame. *(biggest, lowest risk)*
2. Pre-bake per-species tinted moa sprites; remove per-draw `tint()`.
3. Pre-partition plants into ground/tree lists; hoist render closures.
4. Throttle foraging queries; widen the mate-search radius only when seeking.
5. Cache the `otherEntities` iteration.

Items 1–3 should cover most of the drop; 4–5 are cleanup for large flocks and
the multi-species level. Re-check the debug Update/Render split after each to
confirm you're spending effort on the side that's actually costing frames.
