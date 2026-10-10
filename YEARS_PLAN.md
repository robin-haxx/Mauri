# Avian Age: Mauri; Free Play "Years" build plan

The living build plan for Free Play's year structure. Sits beside `FREEPLAY_PLAN.md` (the
mode's design and ecology) and `OVERVIEW.md` (the codebase map). Code-issue post-mortems go
in `MISTAKES.md` (newest first).

> **Governing principle.** Prefer emergent couplings over scripted outcomes, then expose a
> *lever* to focus the gameplay. Every new behaviour is gated behind a
> `LEVEL_MECHANICS.<flag>` read through a `typeof` guard, so the other levels are untouched.
> The flags live in `levels/level_freeplay_kahurangi.js`.

---

## The year loop (as built)

- **Season = 1 min** (`seasonDuration: 3600`), so a year is 4 min. A year runs summer →
  autumn → winter → spring, all in one area, so the year-end population shows the breeding
  season's result before the camera moves on.
- **A four-year loop** (`freeplaySchedule`) over a 2×2 world. Each year has one or more focus
  birds, plus one **zone moa** (`moaZones`: the upland moa in the two east/alpine areas, the
  little bush moa in the two west/shore ones). The other zone moa is the year's *off-focus*
  moa: highlighted, not floored, not a loss at 0; it gets one designated nest of its own
  each year. The zone moa's favoured plant (speargrass or lancewood) leads that year's
  toolbar and is how the player founds its nests.
  - **Year 1, Kea** (east, upland moa): Berry Cache, Nest Raid, fern shelter, Storm, and
    kawakawa until the first winter frost kills it (then the waterhole takes its slot).
    Kākā are introduced.
  - **Year 2, Kākā** (west, bush moa): Forest Seed, waterhole, shelter, Storm. A mast goal
    (gain 400 mauri) decides whether the rimu mast comes early (year 3) or late (year 4).
  - **Years 3 & 4** branch on the mast: kākāpō breed in the mast year (Rimu Berry Scramble);
    the other year is either a kōkako stretch (mast early) or a bush moa nesting year (late).
- **Pressure climbs per loop:** the eagle:moa target ratio and eagle cap (never an additive
  eagle count, so eagles still fall when the moa do), and natural plant density eases down
  to a floor by year 8.
- **Year-to-year reset:** each species falls back to its default, nudged by how well it did
  in this area last time; forest the player grew partly persists (`forestLegacy`).

## The kea cascade (Year 1)

Objective: **bring the kea downslope into the podocarp forest without losing them.** The
player runs a cascade; each link is a coupling with a flag and a lever.

1. **Berry Cache** (`keaLure`) draws the kea flock wherever it's placed and plants berries
   for the biome under it (pātōtara in subalpine tussock, coprosma lower down). It also
   cultivates rimu/beech in its radius, even outside the forest biome (`growForestAt`), so
   kea get perch trees downslope. Kea commit to a cache for a few seconds at a time, scored
   by food per bird and distance, so several caches spread the flock (`_chooseLure`).
2. **Kea perch** on fruiting forest trees chosen by nearby food (`_choosePerchTree`); a kea
   within `stationRadius` of a moa nesting site counts as stationed there.
3. **Nest Raid** (a toolbar interaction that opens a side panel listing the nests): with
   `stationCount` kea stationed, a raid costs 60 mauri and succeeds at
   `baseSuccess − moaPenalty × moa nearby` (0.9 − 0.12 per moa, at least 0.05). A success
   eats the site's eggs, destroys it, and sends its moa off (disturbance:
   `moaNestDisturbance`). Hovering a row tints that nest green or red on the map with its
   odds. Tapping a moa egg also sends a hungry kea to eat it.
4. **Eagles patrol the nesting sites** (`eaglePatrolTracksNests`), so a raided-out forest
   empties of eagles and the kea can nest there.
5. **Eagles also hunt flighted birds** when hungry (`eagleHuntsFlyers`), moa preferred and
   grounded kākāpō exempt; so until the forest clears, the raid is a race against kea losses.

Nesting sites aren't seeded by count. The focus moa's nests are **founded** by placing two
patches of its favoured plant close together with that moa drawn in
(`Simulation._updateMoaNestingFormation`); the off-focus moa gets a designated nest
(`_placeDesignatedNest`) and its herd is set down around it at year start, since a moa lays
wherever it is (pregnancy is short) and a nest only collects eggs from moa living nearby.

## The 2×2 world grid

One continuous alps→shore landmass is generated at init, `cols × rows` windows wide; a
window shows part of it. Each year the camera pans to the next area in a circular tour
(**(1,0) east/alps → (0,0) west/shore → (0,1) → (1,1) → repeat**), and that area's plants
and animals are unloaded and regenerated on the new ground while population counts carry
across. Gated behind the level's `worldGrid` block.

- **Continuous land:** the heightmap and biomes are full-world; `mapWidth/mapHeight` stay one
  window, so the sim and entity bounds are unchanged; lookups add the active area's origin.
- **The move** is staged: fade the cast out → pan (the once-per-loop glacial re-bake runs
  here, hidden) → fade the new cast in. Loss checks and the goal check are held for the whole
  transition (`_yearTransition`), so last year's counts never tick this year's goals.
- **Placed items are cleared** on the move, except planted lancewood stands, which are
  remembered with their area and replanted on a return (`Simulation._rememberStands`); they
  grow up into mature trees moa can't eat after a year.
- **Gentle alps, glacial over the years:** `openLandScale` flattens the land at the start so
  forest and subalpine spread far up; it releases as `glacialAdvance` grows each loop.
- **The view widens per loop** (`worldGrid.zoomByLoop`); the resize rides the loop's re-bake.
- **The 3D relief** is the GPU terrain mesh over the continuous heightmap, so both pan axes
  scroll smoothly.

## Free Play follow-ups from the modules

The module levels are becoming the tutorial for Free Play's systems. Free Play gets updated
as each module settles what a system should be; recorded here so the two stay aligned.

- **The modules' own free play** (built 2026-10-09: `levels/module_freeplay.js`,
  `mauri_module_freeplay.js`) already runs the storm as cover with a hunger-driven eagle,
  seasonal bird breeding (`BIRD_CALENDAR`) and a bird-population mauri income. It is the
  testbed for what Free Play takes on below.
- **Storm as cover, not a stun** (decided 2026-10-09). In Free Play a Storm stun-locks a
  hunting eagle (`distractsEagles`: an eagle entering it orbits for 3 s and drops its target).
  The modules teach the storm as **cover**: a moa under a storm can't be seen. Cover is the
  better design: the eagle keeps hunting and takes whoever is in the open, so the player
  *directs* the hunt to keep the species in balance rather than interrupting it. To port:
  give the Storm `blocksEagleVision` (full cover; the fern shelter stays half cover with
  `eagleSpotFrac: 0.5`), drop `distractsEagles`, and let cover break a lock already made
  (today shelter only hides a moa from a *fresh* scan, `HaastsEagle.hunt`). The storm keeps
  its flighted-bird effect (it flushes birds off their trees, `Kereru._fleeStorm`).
- **The food ladder** (2026-10-09; see `OVERVIEW.md` §4.6): pātōtara out-feeds the favoured
  plants because its berries draw kea; lancewood and speargrass are modest food whose worth
  is founding nests; the fern shelter is cover, not food.
- **Pātōtara is sprouted by hand** (2026-10-10). In the modules and their free play
  (`mechanics.sproutPatotara`), pātōtara, wild or grown, comes up bare (its dormant sprite,
  no food) until the player presses and holds on it (`Game._sprout`); then it's thriving in
  summer, mature in spring and autumn, and can't be sprouted in winter. Families and kea only
  go for sprouted berries. Not in Free Play yet: porting it there means the flag on its level
  and a tip for the hold.
- **The raid, from both sides.** Module 1 teaches kea raids as a threat that gathered moa
  defeat (the odds fall per moa), the same formula Free Play's Nest Raid uses. Free Play
  then puts the player on the kea's side; its tips should make that turn explicit.
- **Still untaught by any module:** the Mauri economy and balance income, focus species and
  the yearly goals, founding nests with favoured plants, the Berry Cache and Nest Raid,
  winter food value and the climate, the waterhole, and the other birds. Planned Module 2
  (food security and the moa–eagle dynamic) covers some of this.

## Upcoming pillars (design captured, not yet built)

- **Plausible breeding seasons per species + habitat-driven success.** Each species breeds in
  a real season; habitat kept through the year means more breeders and a better season.
  The modules' free play has a first version for the birds (`BIRD_CALENDAR`: laying season,
  clutch, years to maturity, mast-year boosts, success scaled by how well the species is
  eating); Free Play could adopt it through `mechanics.seasonalBirdBreeding`.
- **Seasonal pacing:** one or two seasons are action-heavy, the others slower for planning.
  Likely a per-season tempo/threat modifier.
- **Scoring that rewards balance:** score highest by growing the focus species *without*
  pushing the others down to their floor (reward diversity kept above floors).
- Let new forest nesting sites form where the player grows forest (`isForestPatch` is ready).

## Tools

- **Benchmark** (`mauri_benchmark.js`): on an endless level it ends after
  `BENCHMARK.endlessYears` in-game years (default 1) with a `year_end` sample and a CSV; every
  sample carries `year` and `season`.
- **Lens** (`mauri_lens.js`, **L** in debug mode): "Kea ▸ Berry Cache pull" shows each cache's
  draw and which cache each kea has committed to.
