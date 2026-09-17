# Avian Age: Mauri; Endless "Years" build plan

The living build plan for endless mode's year structure. Sits beside `FREEPLAY_PLAN.md`
(the mode's origin design) and `OVERVIEW.md` (the codebase map). Code-issue post-mortems
go in `MISTAKES.md` (newest first).

> **Governing principle (inherited from FREEPLAY_PLAN).** Prefer emergent couplings over
> scripted outcomes, then expose a *lever* to focus the gameplay. Every new behaviour is
> gated behind a `LEVEL_MECHANICS.<flag>` read through a `typeof` guard, so the shipped
> classic levels are untouched. The flags live in `levels/level_freeplay_kahurangi.js`.

---

## Locked decisions (2026-09-09)

- **Season length = 1 min** (`seasonDuration: 3600`). A year = 4 min. *Open ripple:*
  `rampCycles` still 10 → "brutal" at ~40 min; halve to 5 for the old real-time pace.
  Per-tick rates (breeding/hunger) don't rescale with season length, so growth per season
  ~doubled; expect a `freeplayTargets` rebalance.
- **Terrain grid = confirmed ABCD** (deferred build): 4 areas, world scrolls one per year in
  a circle. Areas **A & D more alpine, B & C dip to forest/lowland** (year 5→A, 8→D …); a
  descent-and-return. Biggest system change; build last.
- **Link 2 (moa vacate) = emergent + a lever.** Kea raids suppress moa nesting in the
  forest (emergent); a tunable disturbance field nudges moa away to keep it legible.
- **Eagles vs kea:** eagles **patrol where moa NESTS are**, and **opportunistically hunt
  adult kea when hungry** (they target the birds themselves, *not* kea nests/eggs). Moa are
  always the preferred prey; kea are the hungry-eagle supplement.

---

## The Year-1 kea trophic cascade; build target

Objective: **migrate kea downslope into the podocarp forest without losing population.**
The player orchestrates a cascade; each link is a coupling with an opt-in flag + lever.

| # | Link | Where | Flags / levers |
|---|---|---|---|
| 4 | Eagles opportunistically hunt **adult kea** when hungry | `mauri_eagle.js` hunt(); `mauri_simulation.js` catch | `eagleHuntsKea`, `eagleKeaPreyPenalty` (moa-preference; ↑ = kea safer), `eagleKeaHungerGate` (min hunger to bother with kea) |
| 1 | Kea **raid moa eggs** (destroy them, small food) | `mauri_kea.js`; `mauri_simulation.js` raid helper | `keaRaidsEggs`, `keaRaidRadius`, `keaRaidNutrition`, `keaRaidCooldownSec` |
| 3 | Eagle **patrol tracks moa nests** (eggs), not adults | `mauri_eagle.js` relocate/follow | `eaglePatrolTracksNests` |
| 2 | Moa **vacate** disturbed nesting areas | `mauri_simulation.js` disturbance field; `mauri_moa.js` migration | `moaNestDisturbance`, `moaDisturbanceAvoidance` (0 = pure emergent), `disturbanceRadius`, `disturbanceDecaySec`, `disturbancePerRaid` |

**The intended loop:** kea (drawn downslope) raid moa eggs in the forest → moa nesting there
collapses and moa drift out (disturbance) → the eagles' nest-tracking patrol follows the moa
out → the forest empties of eagles → kea nest there safely. **The tension:** until the forest
clears, hungry eagles there will take exposed kea, so raiding is a race against kea losses.

**Build order:** 4 → 1 → 3 → 2 (predation premise first, then the raid, then the patrol
coupling, then tune the whole cascade with the disturbance lever). Terrain grid last.

### Status
- [x] **Link 4; eagle → adult kea predation** (2026-09-09). Eagle `hunt()` scans kea as
  penalised, hunger-gated candidates; `Simulation.handleEagleCatchKea` leaner than the moa
  catch (no mauri, no MOA_KILLED). *Verified:* catches unprotected kea, **spared at the
  Year-1 floor**, and the hunt path genuinely targets+seizes a kea.
- [x] **Link 1; kea egg raiding** (2026-09-09). `Kea._runState` diverts a flying, off-cooldown
  kea to the nearest moa egg; `Simulation.raidMoaEgg` destroys it + seeds disturbance. *Verified:*
  kea rob adjacent moa eggs (`stats.eggsRaided`), 4/6 of a seeded forest cluster robbed.
- [x] **Link 3; eagle patrol tracks moa nests** (2026-09-09). `Simulation.getClosestMoaNest`
  (nearest un-hatched moa egg); the eagle "follow the prey" relocation prefers it, falling back
  to nearest adult moa. *Verified:* helper returns nests; wired into the follow branch.
- [x] **Link 2; moa disturbance/vacate (+ lever)** (2026-09-09). Decaying disturbance field on
  the sim (`_addDisturbance`/`disturbanceAt`/`_decayDisturbances`); `Moa.shouldMigrate` +
  `findMigrationTarget` read it, scaled by `moaDisturbanceAvoidance`. *Verified:* moa under
  disturbance choose to migrate; the lever scales how many flee a raided patch (1→5/9, 4→8/9,
  8→9/9). Emergent base is gentle; the lever focuses it.
- [x] **Per-year interaction palettes + kea lure** (2026-09-09). Each schedule year carries its
  own `availablePlaceables`; `Game._resolvePalette` + `_beginFreeplayYear` swap `activePlaceables`
  and rebuild the toolbar on the year boundary (dropping a now-invalid selected tool). New
  `PLACEABLES.keaLure` ("Berry Cache") draws the kea flock (mauri_kea.js `_nearestLure`, radius
  520) downslope onto the forest to raid moa nests. *Verified:* Year-1 palette =
  [keaLure, lancewood, speargrass, Storm, waterhole]; a placed cache pulls kea toward it.
  Per-year sets themed by focus; mastYear unlocks from Year 2 on.
- [x] **Terrain grid (2×2 ABCD scroll); first slice built + verified (2026-09-09).** See
  "2×2 terrain grid" section below.

### Flyer / eagle tuning (2026-09-09)
- Eagle opportunistic predation generalised from kea to **all flighted birds** (`eagleHuntsFlyers`;
  `handleEagleCatchFlyer`), so clearing eagles from the forest protects every bird. Grounded kākāpō
  (isFlyer=false) exempt. Both the year's dynamic floor AND each bird's own populationFloor shield
  the last few from predation. Prey penalty lowered (2.2→1.6) and `flyerFleeMult: 0.9` (birds flee
  slower than cruise) → birds are a real, catchable target. *Verified:* eagle targets+seizes a kererū.

### World-gen performance (2026-09-09); ~45s → ~5.6s at 1080p
- **`_buildRenderMaps` interpolates** the coarse heightMap instead of re-sampling noise per render
  cell (was ~85% of gen; ~15s→0.1s at detail 2).
- **`_computeBaseCellColors` works in raw RGB** (precomputed biome stops, numeric lerp) instead of
  p5.Color + lerpColor + red/green/blue per cell (5.7s→0.07s).
- **`noiseDetail(2,0.5)`** in the terrain ctor (the code already runs its own octave loop; p5's
  default 4 was compounding); ~2× on all heightmap noise.
- **Default `terrainDetail` 2→1** (single-res buffers; the '2x' toggle still exists and is now
  viable). Remaining ~5.6s is base-heightmap noise + bake + sim seed; the '0.5x' toggle (pixelScale
  2) drops it further. A fully async/chunked generate is the future option if the freeze still bites.

### Observations / tuning notes
- **The cascade only fires where kea and moa nests overlap.** In passive Year-1 play kea sit
  ~0.43–0.46 (forest edge) and moa breed slowly, so raids are rare until a **kea lure** draws
  kea onto a moa nesting patch. That lure is the point of the per-year palette; build it next.
- **`moaDisturbanceAvoidance` default 1.0** clears ~half a patch; raise it (or widen
  `disturbanceRadius`) to focus harder. Real tuning belongs in a playtest pass.
- Season now 1 min doubled per-season growth; kea/moa breeding + `freeplayTargets` will want a
  rebalance alongside the breeding-season pillar.

---

## Kea Raid v2; player-driven, site-based (building 2026-09-09)

Replaces the emergent auto-raid (old Links 1–2) with a controllable loop; Links 3–4 stay and
slot in. **The loop:** grow the podo forest downslope (planting) → kea auto-perch there on food
→ when enough kea are stationed by a moa NESTING SITE an on-map raid indicator appears → pay
mauri, roll success (fail chance ↑ with nearby moa) → success consumes the eggs in the site
radius, destroys the site, and its moa migrate to another site → eagles (patrol nests) follow
the moa out → the forest empties → kea nest safely.

Decisions (2026-09-09): nesting sites are **seeded at start + new ones form as the forest
expands** (some seeded downslope in forest); moa lay at their nearest site; habitat expansion =
**planting grows rimu/beech fruiting trees**, and where their density crosses a threshold the
area reads as podo forest (kea perch, forest sites can form). Kea auto-perch (drawn by food), not
hand-placed. Raid is an on-map indicator at the site. All gated behind LEVEL_MECHANICS.

Slices: **A** nesting sites (entity + seed + moa lay at sites + destroy/migrate) · **B** habitat
expansion (planting grows fruiting trees → forest area) · **C** kea perch trees (food-chosen;
"stationed near a site") · **D** raid action (indicator + mauri cost + fail∝nearby moa + success
effects). Then retune, and fold Link 3 to track sites.

- [x] **A nesting sites** (2026-09-09); `mauri_nesting.js` `NestingSite`; sim seeds them
  (`_seedNestingSites`, 2 forest + 3 open), moa lay at their nearest site (eggs cluster),
  `destroyNestingSite` consumes the eggs + migrates the moa; rendered as ground scrapes.
- [x] **B habitat expansion** (2026-09-09); the Berry Cache plants coprosma (kea food) and
  `growForestAt` cultivates rimu/beech in-radius *even in non-forest biomes* (disperseSeed
  refuses those); `isForestPatch` reads density. *Verified:* in shrubland, 0→8 trees + 9 berries.
- [x] **C kea perch trees** (2026-09-09); each kea picks a fruiting FOREST tree by nearby food
  (`_choosePerchTree`) as its home (`_anchorPoint`); auto-raid (Link 1) switched OFF. *Verified:*
  a cache at a forest site stationed all 4 kea on perch trees there.
- [x] **D raid action** (2026-09-09); when ≥`stationCount` kea are stationed, an on-map indicator
  (`_renderRaidIndicators`, screen-space, clickable) shows the live success% + cost; `attemptRaid`
  spends mauri and rolls `baseSuccess − moaPenalty·moaNear` → success = `destroyNestingSite`.
  *Verified:* 5 stationed → indicator; 14 moa → 5% vs cleared → 90%; raid destroyed the site.

**Kea Raid v2 is complete and playable.**

### Refinements (2026-09-09, batch 2); all verified
- **Eagle patrol tracks nesting SITES** (was loose eggs): the follow logic anchors on the nearest
  active `NestingSite`, so raiding a site out from under the eagles makes them relocate off it.
- **Eagle patrol calmer / more readable**: harder orbit-seek (0.4→0.55), less wander (0.25→0.12),
  gentler + rarer random drift (20/256t → 10/420t). *First pass*; tune to taste.
- **Raid is a toolbar interaction** (`PLACEABLES.nestRaid`, `opensDialog`): selecting it opens a
  **site chooser dialog** (`_openRaidDialog`/`_renderRaidDialog`/`_raidDialogClick`) listing each
  nest with its stationed-kea / success% / cost; ready+affordable rows raid on click. The old
  on-map per-site indicators are removed.
- **No overlapping nesting sites**: seeding enforces a min gap (2.6·radius) between sites. (At the
  small 760p test map only ~3 fit; the full 1080p map has room for the configured 5.)
- **Focus UI shows the YEAR'S focus species** (`renderFocusSpeciesButtons` reads
  `game.freeplayFocus`), incl. birds (kea/kākā/kākāpō) via a registry lookup + a coloured marker +
  name + live count; not the static 2 focal moa.
- **Tap a moa egg → a hungry kea eats it** (`_tryDirectKeaToEgg` + kea `_directedEgg`): the nearest
  hungry kea within `keaEatRadius` flies over and takes it. (A kea fleeing a nearby eagle will
  abandon the errand; realistic.)

### Design intent to honour in SCORING (not yet built)
The player should score highest by **growing the focus species without out-competing the others /
pushing them to their population floor**. The endless `scoreFormula` should reward focus-species
growth AND overall diversity kept above floors (penalise letting any species sit at its floor).
A future scoring pass.

### Still open
Let new forest sites FORM where the player grows forest (decision A's "grow with forest"; the
`isForestPatch` helper is ready for it); balance station/cost/penalty and the site count vs
min-gap on the real map; the mauri spend on a FAILED raid is intentional.

### Refinements (2026-09-11); verified
- **Berry Caches spread the flock emergently** (`mauri_kea.js` `_chooseLure`/`_refreshLureFood`).
  A kea no longer just seeks the NEAREST cache: it holds a COMMITTED choice (re-picked on a jittered
  ~2.5s timer, or when the choice dies / leaves range), scored per cache as
  `(lureBaseNutrition + food) ÷ (1 + lureCrowdWeight · kea committed)` × a distance falloff. So the
  nearest usually wins, but as a cache crowds its per-bird share drops and re-picking kea peel off to
  emptier/richer/nearer caches; and a freshly placed cache (crowd 0 + base draw) pulls nearby kea
  onto it even before its berries grow. Food is counted ≤2×/sec and cached on the placeable (shared),
  so kea eating a patch down also lowers its draw. Tunables on `KEA_SPECIES` (`lureChoiceSec`,
  `lureBaseNutrition`, `lureCrowdWeight`). *Verified:* nearest when uncrowded, spreads to the far
  cache when the near one is crowded, holds on mild crowding, single-cache unchanged.
- **Nest Raid is now a NON-MODAL side panel** (was a centred modal that greyed the play area).
  `Game._renderRaidPanel`/`_raidPanelClick` (selecting the tool TOGGLES it). The UI docks it in the
  right column: **fullscreen**; below the focus-species row, above the field guide (`mauri_UI.js`
  `renderFullscreenOverlay`); **docked**; below Goals, above Population, at half the event log's
  height (`renderSidebar`), which also **swaps Population above the Event Log**. It never dims the play
  area, and clicks off the panel fall through (only panel clicks are consumed). HOVERING a nest row
  echoes into the play area: that nest is drawn with a **green (raidable) / red (not) tint + the raid
  success% at its centre**, via a LATE overlay pass (`NestingSite.renderRaidOverlay`, added on top of
  the cast in both the 2D and 3D sim render so foliage never hides it). **Fullscreen is now the default
  view** (`CONFIG.fullscreen: true`). *Verified:* panel renders in both views, hover sets the correct
  site's green/red + %, the tint/% paint on top (pixel-sampled), row clicks raid without closing,
  off-panel clicks fall through, and the docked order is Goals → Nest Raid → Population → Event Log.

## 2×2 continuous terrain grid; the camera pans a new area each year (built 2026-09-10)

The endless world is now **ONE continuous landmass** generated once at init, spanning cols×rows
play windows; a single **alps→shore descent** (east = high alps, west = shore). A window shows
only PART of it, so **year 1 frames the east / alps→podocarp upper slope (no shore)**. Each year
the **camera PANS** across the continuous land to the next area in a circular tour, and that
area's **plants + fauna are unloaded and regenerated** on the new ground (the living populations
carry across; the flock relocated to a new country). Tour (E–W slope, `_defaultQuadOrder`):
**(1,0) east/alps → (0,0) west/shore → (0,1) across → (1,1) back upslope → repeat** (year 5 = start).
Gated behind a level `worldGrid` block; classic levels are byte-for-byte unchanged (verified:
`glacial_kahurangi` `hasWorldGrid=false`, worldW==mapWidth, scroll 0, scale 1, renders in 2D+3D).

**How it's built (this replaced the earlier crossfade/per-area-regen slice).**
- **Continuous world.** `worldW/H = viewW/H × cols/rows`; the heightmap/biome/buffers are FULL-world.
  `getIslandFalloff` normalises over `worldW/worldH` → one alps→shore gradient across all windows
  (`getElevation` no longer offsets per area). `mapWidth/mapHeight` stay ONE window, so the sim,
  projection, clip and entity bounds are unchanged; the entity-facing lookups (`getElevationAt`/
  `getBiomeAt`) add the active area's world origin. Gameplay grid is scaled up (`pixelScaleMult`,
  default √(cols·rows)=2 for 2×2) so the 4×-area heightmap keeps ~a single window's cell count
  (coarser terrain, bounded bake); the one real cost, tunable.
- **Camera pan (flat).** `TerrainGenerator.scrollX/Y` + `panToArea(col,row)` / `updatePan(dt)` (~1.5s
  ease). The flat 2D `render()` blits only the scrolled window sub-rect of the full-world buffer
  (source crop, X+Y). Verified E–W and N–S pans in 2D.
- **3D relief is baked PER-ROW** (fix, 2026-09-10 batch 2). The full-world relief squashed the whole
  land's depth into one buffer, so a window was a thin squashed slice with a black gap under it. Now
  `_buildReliefSource` bakes only the ACTIVE ROW's window depth (over-scan reads the neighbouring rows
  / world edge), full width, with `LIFT = liftFrac·winRows` → one window fills the frame like a normal
  level. An E–W pan (same row) is a cheap X source-crop; a row change (N–S) re-bakes (`_reliefBakedRow`).
  `_reliefWorldH = bufH·scale/detail` (the old `bufH/detail` assumed pixelScale 1 → half-height on the
  grid = the black gap). Verified: fills the frame, E–W smooth (no re-bake), N–S re-bakes (~0.8s VM).
- **Per-area cast.** `Simulation.unloadAreaEntities()` snapshots living populations then clears every
  spatial entity; `spawnAreaEntities()` re-seeds trees + the snapshot cast on the new ground. Driven
  by `Game._scrollWorldGrid` (last in `_beginFreeplayYear`, so it snapshots the year's final
  populations) + `_updateWorldGridPan` (repopulates when the pan settles, BEFORE the frame's count
  so the empty transition never trips the all-moa-gone loss; which is also guarded by `_areaTransition`).
  Nesting sites now reject `findWalkablePosition`'s centre-of-map fallback (`_seedNestingSites` checks
  in-band + walkable) so a nest never seeds on scree/ice.
- **Staged transition (2026-09-11): fade out → pan → fade in.** The move is no longer an instant
  unload+pan. `Game._yearTransition` runs three phases (`_updateWorldGridPan`): **fadeOut** (~0.6s,
  the living cast fades as `_transitionEntityAlpha` drops 1→0; applied as `drawingContext.globalAlpha`
  around `simulation.render()`, so every plant/placed-item/bird fades uniformly while the terrain stays
  opaque) → **pan** (unload + the camera pan; the once-per-loop glacial rebake `_maybeGlacialDeepen`
  runs here, hidden by the empty frame) → **fadeIn** (~0.7s, the new area's freshly-distributed cast
  fades 0→1). The loss checks are held for the whole transition (`_areaTransition = !!_yearTransition`).
- **Placed items are cleared on the move (2026-09-11).** `unloadAreaEntities()` now also clears
  `this.placeables`; a new area is a fresh country, so caches/shelters/storms don't travel. (The
  placeable grid is a per-frame moving grid, so it rebuilds empty on its own.)

**"Less drastic alps, more podo forest; glacial dominates over the years."** `_applyGridProfile` SCALES
the land elevation toward the coast at the opening (`openLandScale` 0.58, seed-independent) so the whole
slope is gentler; the alps top out low and the forest/subalpine band spreads far up. The scale releases
to 1.0 as `glacialAdvance` grows. Deepening is **per full loop** (`worldGrid.glacialPerLoop`, capped) via
`terrain.setGlacialAdvance()` (a rare whole-world re-bake), not every year. Measured after the fix; **east/
alps window (year 1): forest 46% + subalpine 36%, only 15% alpine + 3% glacier** (was ~53% high country /
wall-to-wall ice); west window 35% sea → shore/lowland/forest.

**Wiring.** `CONFIG.worldGrid` piped in `applyLevelToConfig`; `Game.update` ticks `_updateWorldGridPan`.

**Year arc = SUMMER → autumn → winter → SPRING (2026-09-10).** The endless level now opens on
summer (`startSeason: 'summer'`, was `'spring'`), so a year runs summer → autumn → winter → spring
and the camera pans to the next quadrant only at the year boundary (spring→summer). A whole year;
including spring nesting and its ~10s-incubation hatch; plays out in ONE quadrant, so the year-end
population *shows the breeding season's result* before you move on. Classic levels stay spring-start.
- **Season↔year lock (the clean pan).** The pan fires off the `playTime`-based `cycle`
  (`playTime / 4 seasons`) while the visible season is `SeasonManager`'s own timer. That timer used
  to **reset to 0** on each change, discarding the frame-time overshoot (`dt` = a variable
  `deltaMultiplier`), so the season clock drifted behind `playTime` and the pan crept off the
  spring→summer edge over a long run. `update()` now **carries the overshoot** (`timer -= duration`),
  keeping the season index `== floor(playTime/seasonDuration) % 4` for the whole run. Verified: over
  6 sim-years of jittery `dt`, 0 season/playTime mismatches and every year boundary lands on summer;
  the old reset-to-0 logic missed the summer edge on every boundary under the same jitter.

**Follow-ups (known, not yet done).**
- **Resolution:** `pixelScaleMult` 2 halves terrain detail (blocky). Lower it (≈1.4) for finer land
  at a higher init bake; or interpolate the heightmap for the render maps at a finer detail.
- **N–S in 3D snaps; FIXED (2026-09-11), now a crossfade.** The per-row relief re-bake at a row
  change used to snap. Now the old row's relief buffers are held (`_reliefPrev`) while the new row
  bakes, and `render()` CROSSFADES old→new across the pan (`_pan.t`), disposed on settle. E–W (X
  source-crop) and 2D (X+Y crop) still pan smoothly; only the 3D row change dissolves (a literal
  vertical pan can't be geometrically clean in per-row plan-oblique relief). See the transition below.
- **Perf on this VM is misleading** (software pixel ops ~20× slower than real HW): init ~4.8s, per-row
  3D bake ~0.8s, render ~55ms here → sub-second / smooth on real hardware. (Classic relief bake also
  reads ~10s on this VM; same cause, not a regression.) Longer term: chunked/async world-gen.
- Nesting sites + focus/goal continuity across an area change are re-seeded fresh each area; revisit
  if per-area persistence is wanted.

## Benchmark tool; endless "1 year" population tracking (built 2026-09-09)

`mauri_benchmark.js` now closes an ENDLESS run after `BENCHMARK.endlessYears` in-game years
(default **1** = 4 seasons = `4·seasonDuration` frames = 240s), with a final `year_end` sample
+ CSV; endless mode never wins and only loses on a moa wipe, so a fixed window is what charts a
year's arc. Every sample now also carries `year` + `season` columns for legibility over time; the
bird populations were already captured (`n_kea`/`n_kaka`/`n_kakapo` via `otherEntities`). A normal
win/loss still ends non-endless (and a mid-year moa wipe still ends endless) via the render-path
finish. Verified: columns + 240s deadline + `year_end` finish + CSV save (no throw).

## Upcoming pillars (design captured, not yet built)

- **Plausible breeding seasons per species + habitat-driven success.** Each species breeds
  in a real/plausible season; suitable habitat kept through the year means both more breeders
  and a better breeding season. Needs per-species `breedingSeason` gating + a habitat-quality
  term feeding breeding readiness. Rebalance the whole cast around this.
- **Seasonal pacing:** 1–2 seasons are "real-time heavy" (action); the others are slower,
  for strategising. Likely a per-season tempo/threat modifier.
- **Interactions from real native plants & ecological phenomena**, and a **new palette each
  year** (rebuilt on the year boundary like goals are). Slots onto `freeplaySchedule`; add a
  per-year `availablePlaceables`; refresh `game.activePlaceables` + the toolbar on year change.
  Year-1 kea levers map to the cascade: a kea lure/cache (where they raid), a moa forage plot
  (pull moa out), Storm (clear eagles for a nesting window), a kea nest site (the payoff).

---

## Done already (slices 1–4, see FREEPLAY_PLAN.md)
Kea / kākā / kākāpō entities (`mauri_kea|kaka|kakapo.js`), the authored `freeplaySchedule`
(opening: kea → kākāpō; then upland → bush+kākā → upland+kea → bush+kākāpō), kākāpō mast-only
breeding, endless menu unlocked by default.
