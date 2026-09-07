# Avian Age: Mauri — Free Play mode (design plan)

*An endless survival mode set in glacial-age Kahurangi. You steward a moa community
through turning seasons while the climate slowly deepens — each glacial winter a
little colder than the last, until the land can no longer keep the flock fed. There
is no "win": you play to see how long a lineage can hold on, and how large a
community you can raise before the cold catches up with it.*

> **Governing principle.** Free Play is a *pressure ramp*, not a new simulation.
> Almost everything it needs already exists in the engine as a lerped seasonal
> modifier. The mode's whole job is to slide those numbers a little further into the
> cold each cycle, and to make winter take *food value* away rather than take
> *plants* away. Build a knob, not a world.

This document is the design spine for the mode. It is written to sit alongside
`OVERVIEW.md` (the codebase map) and `DEVBLOG_systems.md` (the ecology narrative),
and it assumes both. Where it proposes code, it uses the existing opt-in
`LEVEL_MECHANICS` pattern so nothing here touches the shipped levels.

---

## Status — v1 built and verified (2026-09-05)

The mode is implemented and smoke-tested in the browser. Sections 4–5 below are the
design rationale; this is what actually landed.

**New files:** `mauri_climate_drift.js` (the pure deepening-glacial curve `ClimateDrift`),
`levels/level_freeplay_kahurangi.js` (the endless level "Taihekenga Mutunga-kore"),
`mauri_encyclopedia.js` (the gamewide Field Guide — open with **E**).

**Edited, all behind guards so other levels are unaffected:** `mauri_seasons.js`
(perf: inlined `_lerpSeasonal`; folds `coldIndex` into snow line, forest band, winter
hunger); `mauri_plant.js` (`winterEdibility` floor + `winterInedible` — standing, not
dead); `mauri_moa.js` (skip inedible forage; cold-tolerance hunger surcharge;
coldIndex-deepened breeding cooldown; eagle-boom hooks); `mauri_sketch.js`
(cycle/coldIndex per frame; `endless` guard; the yearly-goal engine; eagle-boom; the
climate gauge; encyclopedia wiring; `winterEdibility` on `PLANT_TYPES`);
`mauri_simulation.js` (dynamic per-year focus floors; **fixed a pre-existing
`_dynamicGrids` crash** — see MISTAKES.md); `index.html` (load order).

**Verified in-browser** (forced into the level, pumped `update()`): loads with no JS
errors; seeds correctly; the yearly engine picks the two lowest-count species as focus,
protects them with dynamic floors, sets `≥ target` goals and highlights them; **a deep
winter removes 0 plants** while beech keeps food value and rimu/tussock go inedible;
eagle loss booms the dominant species, and the next year re-immigrates eagles and
refounds the extinct non-focus species; the climate gauge and Field Guide render.

**Not yet done:** moving existing tutorial/notification exposition into the Field Guide
(system is in and gamewide; the content move is iterative); balance tuning against a
benchmark run; the level is still hidden behind the menu's Level-1 progression lock
(its `unlockCondition` is `null`, but the menu gates it separately — decide whether Free
Play should be always-open).

---

## 0. Contents

1. What Free Play is
2. The ecology it stands on (Kahurangi / NW Nelson at the LGM)
3. What we take from Te Manawa — and what we change
4. New mechanics
   - 4.1 Progressive climate drift — *the core*
   - 4.2 Winter inedibility, not die-off — *the core*
   - 4.3 The cold-adaptation difficulty axis
   - 4.4 Endless framing, the instant-win trap, and run scoring
   - 4.5 Supporting mechanics (warm interludes, winter lifelines, immigration, the climate gauge)
5. The Encyclopedia dialog
6. Data & code touch-points
7. Build order and how to test
8. Open decisions (for Robbie)
9. Sources

---

## 1. What Free Play is

A single endless level (`levels/level_freeplay_kahurangi.js`) with:

- **No goals, no phases, no timed end.** The run continues until the flock dies out.
- **A climate that deepens.** A master `glacialIndex`-style scalar rises across
  successive glacial/interglacial cycles, so each cold snap bites harder than the
  one before it. Population growth that was comfortable in cycle 1 is a struggle by
  cycle 5.
- **Winter as a food *drought*, not a die-off.** Standing vegetation persists through
  the cold — Kahurangi's flora is overwhelmingly evergreen — but its food value
  collapses, and collapses further as the climate deepens. The land stays green-grey
  and frosted; it just stops feeding anyone.
- **The Mauri economy intact.** You still earn mauri from a healthy ecosystem and
  spend it on the palette. The escalating cold is what makes a surplus hard to keep.
- **Loss still possible** — losing all moa ends the run — but there is nothing to
  "beat." The score is *how long you lasted* and *how many you kept*.

Free Play is the sandbox counterpart to `level_02_glacial_kahurangi` (a scripted
4-phase, ~8-minute win/lose scenario). It reuses that level's biomes, cast and
mechanics almost verbatim and swaps the phase structure for the endless ramp.

---

## 2. The ecology it stands on

The map is already NW Nelson / Kahurangi in Te Waipounamu (see the glacial level's
`menu.areaLabel`). Free Play leans harder into what that place actually was during
the Last Glacial Maximum (~21 ka), because the mode's two core mechanics fall
straight out of the real ecology.

**Kahurangi was a forest *refugium*.** Across most of the glacial South Island, tall
forest collapsed into a shrubland–grassland–tussock mosaic; but the northern
West Coast and Nelson — the Karamea Bight edge, exactly our map — is one of the
regions where beech unambiguously *survived*, in small "micro-refugia." So the
glacial level's design — a thin, contested `forestRefuge` band amid open
`glacialFlats` and `subalpine` tussock — is not artistic licence; it is the
consensus reconstruction. Free Play keeps that band and makes it the winter lifeline.

**New Zealand's flora is evergreen, so winter starves rather than strips.** Unlike a
northern-hemisphere deciduous forest that drops its leaves and stands bare, almost
all of Kahurangi's plants — beech (*tawhai*), the podocarps, the tussocks
(*Chionochloa*), the divaricating shrubs (coprosma, matagouri / *tūmatakuru*) —
hold their foliage year-round. What the cold removes is not the *plant* but the
*food*: new growth stops, fruiting and mast (beech seed, rimu fruit, coprosma and
pātōtara berries) end, soft browse hardens, and frost drops palatability and
digestibility. This is the ecological warrant for **§4.2: winter takes food value,
not plants.** A moa's winter is a hunger problem, not a bare-ground problem.

**The cast is real and already cold-stratified.** The upland moa (*Megalapteryx
didinus*) — the mode's natural backbone — was the alpine/subalpine specialist,
feathered down to the ankle against the cold, browsing beech leaves and twigs, flax
and fuchsia nectar, and subalpine herbs. The lowland browsers (South Island giant
*Dinornis robustus*, stout-legged *Emeus crassus*, heavy-footed *Pachyornis
elephantopus*) are the ones a deepening cold should squeeze first. The engine
already encodes this: the upland moa carries `temperatureTolerance.cold: 0.8` and a
winter `hungerRate: 0.9` ("Better adapted to cold"), while the giant carries a lower
tolerance. **§4.3 turns that latent data into the difficulty axis.** Overhead, the
Haast's eagle (*Pouākai*) — the apex predator of the moa world — already ebbs and
flows with prey via the emergent-eagle system; a leaner flock simply starves the
eagles down, no new code required.

Sources are listed in §9. The point for the build: **the two headline mechanics are
the two headline facts** — Kahurangi kept its forest, and its forest kept its leaves.

---

## 3. What we take from Te Manawa — and what we change

Te Manawa (the museum fork) models a full million-year glacial/interglacial ride,
so it has already solved the "how does habitat change with climate" problem. We
lift the *patterns*, not the paleoclimate.

| Te Manawa pattern | What it is there | What Free Play does with it |
|---|---|---|
| **`glacialIndex` master scalar** | `Climate.at(yearsBP)` returns one 0→1 number; sea level, snow line, temperature are all coefficients on it. The sim reads `glacialIndex` directly. | **Adopt the shape, change the clock.** Our index is driven by *elapsed game cycles*, not `yearsBP`, and it *ratchets colder* over the run (§4.1). |
| **"Move a threshold, don't rebuild the world"** | Season changes never re-tile the map. The snow line and the forest band are single lerped scalars; a plant does one O(1) inside/outside test. | **Adopt wholesale.** The climate drift, the deepening winter, and the new edibility floor are all scalars folded into the *existing* seasonal getters. No re-tiling, no reseeding, no per-frame allocation. |
| **Forest-refugium contraction** | `getForestBand()` retreats in the cold; canopy trees outside it are *suppressed* (nutrition 0, drawn wilted — **not removed**). | **Keep the habitat squeeze; recast the food side.** We already suppress rather than delete — Free Play generalises that "standing but unproductive" idea from forest trees to *all* winter flora (§4.2). |
| **Climate as a *table*, not a sine** | Te Manawa's `Climate.ANCHORS` are LR04 anchor points, because real cycles are irregular (a sine got MIS 5e and the LGM wrong — see its `MISTAKES.md`). | **Invert the lesson deliberately.** Free Play is a *game difficulty curve*, not a paleoclimate, so a *parametric* ramp is not just acceptable, it is desirable — it's tunable and legible. Keep a table only if we ever want the mode to replay a *real* sequence. |
| **Season lerp without per-frame closures** | Te Manawa inlined its current→next blends after finding the closure helper was its single largest GC source (~1,400 closures/frame). | **A debt to pay before we add load.** Mauri's `SeasonManager._lerpSeasonal(getCur, getNext)` still allocates two closures per call (`mauri_seasons.js`), and Free Play adds *more* per-frame season reads (climate drift + edibility). Inline the blends first (see §6 and `MISTAKES.md`). |

The through-line: Te Manawa proved you can make a climate move a whole ecosystem
using nothing but lerped scalars and threshold tests. Free Play is that same trick,
aimed at a difficulty ramp instead of a timeline.

---

## 4. New mechanics

All new behaviour is gated behind `LEVEL_MECHANICS` flags read through a
`typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.x` guard, exactly like
`habitatStress`, `forestContraction`, and the rest. Absent the flag, every existing
level behaves identically.

### 4.1 Progressive climate drift — *the core*

**The feel.** Winters get colder over time. The first few cycles are forgiving; by
mid-run a winter that used to cost you a few birds costs you a founder line unless
you have prepared for it.

**The mechanism.** A small pure module, `ClimateDrift` (mirroring Te Manawa's
`Climate` in spirit — pure, p5-free, one function of a clock), owns a single scalar:

```
ClimateDrift.indexAt(cycle)  ->  coldIndex in [0, 1+]
```

where `cycle` is the number of completed four-season years since the run began
(derived from `game.playTime` and `CONFIG.seasonDuration`, *not* stored on CONFIG —
see §6). `coldIndex` is 0 at run start and climbs. Two curve shapes, one module:

- **Recommended — deepening oscillation.** A slow glacial/interglacial wave whose
  *cold peaks get deeper each cycle* and whose warm troughs stay survivable. This is
  the honest read of "glacial winters get colder over time" and it echoes the real
  Mid-Pleistocene Transition (glacials intensifying cycle over cycle — a fact
  Te Manawa's own anchor comments call out). It also gives the player *warm
  interludes* to rebuild in (§4.5), so the mode breathes rather than only tightens.
  ```
  coldIndex(cycle) = baseline(cycle) + amplitude * winterWave(season)
  baseline(cycle)  = min(coldCap, cycle * deepenPerCycle)     // the ratchet
  ```
- **Simple — monotonic ramp.** `coldIndex = min(coldCap, cycle * deepenPerCycle)`.
  A pure slope to eventual doom. Fewer knobs; less texture. This is the same module
  with `amplitude = 0`.

**What the index drives.** `coldIndex` is a *multiplier on the winter end* of the
existing seasonal numbers — it never replaces them, so summers stay summery:

| Target (existing) | Free Play modulation |
|---|---|
| Winter `plantModifiers` (per-biome growth) | Pushed lower as `coldIndex` rises — the lean season gets leaner. |
| `getSnowLineElevation()` | Drops with `coldIndex` (`snowLineWarm→snowLineCold`, the same 0.92→0.55 range Te Manawa uses) — walkable high ground shrinks in deep glacials. |
| `getForestBand()` | Contracts further (narrower, higher `min`) as `coldIndex` rises — the refuge tightens over the run, not just within a winter. |
| Winter `hungerModifier` | Rises with `coldIndex` — cold costs more energy. |
| **Winter edibility floors (§4.2)** | Lowered by `coldIndex` — the central lever. |
| `winterBreedingCooldownMult` | Lengthened by `coldIndex` — breeding windows shrink, so growth genuinely gets "more difficult" exactly as asked. |

**Tuning knobs** (level `mechanics`): `climateDrift: true`, `deepenPerCycle`,
`coldCap`, `warmFloor`, `amplitude`, `driftCurve: 'oscillate' | 'ramp'`.

**The hard rule.** `coldIndex` modulates values *on the instance / at read time*. It
must **never** be written back into `SEASONS`, `CONFIG`, or a plant's base fields —
that would compound across the soft resets and reseeds and drift the whole game
colder permanently. This is the single most important guardrail for the whole mode
(`MISTAKES.md`, and Te Manawa's identical "written back to CONFIG compounded" entry).

### 4.2 Winter inedibility, not die-off — *the core*

**The feel.** When winter closes in, the map does *not* go bare. Beech and tussock
and shrub still stand, now frosted and dull. But the flock's food value drains out of
the landscape: berries and fruit vanish first, soft herb-browse hardens, and only a
few hardy evergreen larders keep any value at all. As the climate deepens (§4.1),
even those thin out.

**Why this is (mostly) already true, and what's missing.** The engine already keeps
plants *standing* through the cold — dormancy and forest-suppression set
`nutrition = 0` but leave `alive = true` and keep drawing the plant (`Plant.update` /
`_getSpriteState` in `mauri_plant.js`). A plant only truly disappears when it is
**grazed** (`consume()` sets `alive = false`, then it regrows). So "inedible not
dead" is the engine's existing instinct. Three things are missing for Free Play:

1. **Per-plant-type winter edibility.** Right now winter food value is an incidental
   by-product of the biome × type seasonal modifiers (and note winter already
   compounds `seasonalModifier` — see the caution below). Free Play makes it a
   *designed, labelled* number: each `PLANT_TYPES` entry gets a
   `winterEdibility` floor in [0, 1] — the fraction of its food value that survives
   the cold — so the ecology is explicit and the encyclopedia can explain it.

   | Plant | `winterEdibility` | Rationale |
   |---|---|---|
   | beech (*tawhai*) | ~0.35 | Evergreen browse; the upland moa's winter mainstay. The refuge's value. |
   | tussock (*Chionochloa*) | ~0.20 | Stands all winter, but coarse and low-value cold. |
   | dracophyllum, coprosma, matagouri | ~0.15 | Hardy evergreen shrubs; foliage persists, little nutrition. |
   | fern, flax | ~0.10 | Present but poor winter fare. |
   | rimu, pātōtara | ~0.0 | Fruit/berry sources — the food simply isn't there in winter. |
   | lancewood, speargrass (planted, favoured) | ~0.25 | Player lifelines keep a modest floor so the palette still matters in winter. |

2. **The climate deepens the floors.** Effective winter edibility =
   `winterEdibility * (1 - k * coldIndex)`, clamped at 0. Early cycles: most flora
   keeps a sliver of value. Late cycles: all but the best evergreen browse falls to
   zero, and the forest refuge becomes the *only* place a moa can winter — which is
   exactly the refugium story from §2, now emerging as a play problem.

3. **Foragers treat "inedible" like "dormant," not like "gone."** In
   `Moa.findPlant` / `localFoodScore` (`mauri_moa.js`), a winter-inedible plant is
   **skipped as food** (as dormant plants already are) but stays **alive and
   rendered** (frosted). It is scenery with no payoff, not a hole in the map. The
   moa must travel to the refuge, not wait for the flats to regrow.

**The guardrail (this is the "rather than dying en masse" the brief asks for).**
Cold **never** sets `alive = false`. Only grazing removes a plant. If a future
change makes winter *delete* or *mass-dormant* the flora, the map will churn bare and
then slowly regrow — the die-off-and-recover cycle we are explicitly avoiding, and a
visual lie about an evergreen landscape. Winter zeroes *food value*; it never zeroes
*existence*. (Logged in `MISTAKES.md`.)

> **Caution — don't double-dip the winter modifier.** `Plant.handleGrowth` currently
> computes `maxNutrition = baseNutrition * seasonalModifier` and then
> `nutrition = maxNutrition * seasonalModifier * typeModifier`, i.e. winter growth is
> already squared into food value. When you add the `winterEdibility` floor, decide
> deliberately whether it *replaces* that squared term in winter or *multiplies* it —
> layering a third winter factor on top without reconciling the existing two will
> overshoot to zero and make the floor meaningless. Pin this down with a benchmark
> read of a beech plant's winter `nutrition` before and after (see §7).

### 4.3 The cold-adaptation difficulty axis

The deepening cold should not squeeze every species equally — that's both duller and
less true. The data to differentiate them already exists: `MOA_SPECIES[*]` carries
`temperatureTolerance: { cold, heat }` and per-season `seasonalModifiers.winter`.

**The mechanism.** Fold `coldIndex` into the winter hunger/stress penalty *weighted
by the species' cold tolerance*:

```
winterPenalty(moa) = base * coldIndex * (1 - moa.temperatureTolerance.cold)
```

- **Upland moa (`cold: 0.8`)** barely feel the ramp — they become the backbone of a
  deep-glacial community, the birds still breeding when the lowlanders can't. True to
  *Megalapteryx*, the ankle-feathered alpine specialist.
- **Giant / stout-legged / heavy-footed (lower tolerance)** feel the ramp hard and
  fade first as the run deepens — the lowland browsers pushed out of a cooling world.

This makes the *composition* of the flock drift with the climate, on its own, from a
mixed lowland-and-upland community toward an upland-dominated one — a legible,
emergent story the encyclopedia can point at, and a real strategic problem (the
player who over-invested in giant moa is in trouble by cycle 4).

**Knob:** `mechanics.coldToleranceMattersMult` (0 = off, all species equal;
1 = full spread).

### 4.4 Endless framing, the instant-win trap, and run scoring

**No win — and mind the trap.** A Free Play level defines neither `phases` nor a
`timeLimit`, and its `goals` array is empty. **This is a live footgun in the current
engine:** `Game.checkGoals()` treats an empty goals array as *all goals achieved*
(`[].every(...) === true`) and, with no `timeLimit`, immediately sets
`GAME_STATE.WON` (`mauri_sketch.js`). An endless level built the obvious way would
win on frame one.

The fix is a first-class `endless` flag rather than a fake never-true goal:

```js
// at the top of Game.checkGoals()
if (this.currentLevel && this.currentLevel.endless) return;   // no win path
```

`endless: true` short-circuits before the win check. Loss is left entirely to the
existing `update()` checks: all moa + eggs gone → `LOST`. (Logged in `MISTAKES.md`.)

**Loss should feel like an ending, not a bug.** Consider softening the two other loss
paths for this mode:
- *Eagle extinction* currently loses the game under `emergentEagles`
  (`mauri_sketch.js`). In an endless ecosystem sandbox, the apex predator dying out
  in a deep glacial is a *natural* outcome, not a fail state — either exempt Free
  Play (let the run continue predator-free until moa also fail) or allow a rare
  eagle re-immigration in a warm interlude. Decision in §8.
- Consider a low-density **immigration** backstop (§4.5) so a single bad winter
  doesn't instantly end an otherwise strong run.

**Run scoring / readout.** With no goals, the run needs its own sense of progress.
Track and surface (and persist a personal best via `PROGRESS`):
- **Cycles survived** (the headline number — "you held on through 6 glacial winters").
- **Peak community size** and **peak per-species**.
- **Total mauri earned.**
A `scoreFormula(ctx)` can fold these into one number for the end screen; `ctx` already
carries `playTime`, `moaCount`, `totalEarned` (extend it with `cyclesSurvived`).

### 4.5 Supporting mechanics

These are optional texture, not the spine. Build them after §4.1–§4.4 prove out.

- **Warm interludes (rebuild windows).** If §4.1 uses the oscillating curve, the warm
  troughs are already breathers: edibility floors recover, breeding cooldowns
  shorten, the snow line lifts. Surface them clearly (a notification, the gauge in
  §4.5 turning warm) so the player learns the rhythm: *bank surplus in the warm,
  spend it surviving the cold.* This is the core loop that makes "growth gets harder
  over time" a strategy rather than just a slope.
- **Winter lifelines via the palette.** Placeables already spawn plants with a growth
  bonus (`seasonalModifier = 1.2` for spawned plants, `Plant.update`). Give
  player-planted food a *higher* `winterEdibility` floor than its wild kin (a tended
  grove holds value when the wild land won't) so the palette is the deliberate answer
  to a deep winter — mauri spent as insurance. This makes the economy the lever the
  brief wants: growth is "more difficult" but never *impossible* if you prepared.
- **Low-density immigration / Allee surfacing.** The engine already has an implicit
  Allee effect (a species that dips to one or two can't find a mate — see
  `DEVBLOG_systems.md` §3). In endless play that's a slow-motion loss. Options: a
  rare warm-interlude immigrant of a locally-scarce species, and/or reuse the glacial
  level's `vulnerableHighlight` to flag a species nearing the brink so the *player*
  can intervene. Keep it a nudge, not a safety net — the stewardship is the point.
- **A climate gauge in the HUD.** The player must be able to *read* the deepening
  cold, or §4.1 is invisible. A small thermometer/frost gauge (driven by `coldIndex`
  and the live winterness) alongside the season indicator, plus the "cycle N" count.
  This is the one piece of *new UI* the mode really needs; everything else is a tuning
  change to existing systems.

### 4.6 The Mast Year interactable — *a warm-year investment* (built 2026-09-05)

**The feel.** A **mast year** is a bumper year when the beech and podocarps fruit
*en masse* — the great NZ forest event that drives bird breeding. Free Play makes it a
**player-invoked** boon: spend a lot of mauri to make **next year** a mast year, and the
forest booms and the fruit-birds surge. The one-year delay is not a limitation, it's the
ecology — a real beech/rimu mast is cued a year ahead by the previous summer's warmth —
and it fits the mode's core loop: **bank surplus in the warm years to buy a masting one
before the next deep glacial.**

**The interactable.** A **global one-shot palette tool** (`PLACEABLES.mastYear`, cost 200
in the level), not a spatial placement. `tryPlace` routes any `global: true` placeable to
`Game._useGlobalInteractable` (spend + cooldown, no `canPlace`/spacing/object), which calls
`Game.triggerMastYear()` → sets `_mastYearTargetCycle = cycle + 1`. `Game._isMastYear()`
is true only while `cycle === _mastYearTargetCycle`; the per-frame code pushes it to
`seasonManager.mastYear` and `simulation.mastYear`, so — like `coldIndex` — it modulates
**at read time and is never written back** (MISTAKES.md). A tag on the climate gauge shows
it "coming", then "live". No placement ghost (guarded in `renderPlacementPreview`).

**What the mast year does** (all guarded, all read-time):

| Lever | Where | Effect during the mast year |
|---|---|---|
| Forest **growth** | `SeasonManager.getPlantTypeModifier` | `FOREST_TREES` surge — **rimu ×3** (the podocarp), **beech/fern ×2**; non-forest unaffected. |
| Forest **winter food** | `Plant._applyWinterEdibility` | Forest plants stay **edible through the cold** (the mast overrides §4.2's winter collapse for `FOREST_TREES`) — the boom feeds birds *and* browsers even in a glacial winter. |
| Fruit-**bird boom** | `mauri_kereru.js._tryReproduce`, `Simulation._hatchFlyerEgg` | Kererū/kōkako flock caps swell (`mastFlockMult`, 1.6×) and egg cooldown drops to 0.45×; a few immigrate at onset (`_beginFreeplayYear`). |

After the year passes every lever reverts; the swollen bird flock then thins naturally
back toward its cap — a real post-mast decline. **Forward hook:** the planned kākāpō
(`mauri-flighted-birds`) breed *only* in rimu mast years, so this interactable is the
switch that will drive their breeding when they land.

**Knobs.** Level `availablePlaceables.mastYear.cost` (200), `PLACEABLES.mastYear.cooldown`,
`mechanics.mastFlockMult`, and the `MAST_PODO_MULT` / `MAST_FOREST_MULT` growth constants
on `SeasonManager`.

---

## 5. The Encyclopedia dialog

The brief notes an intent to move research **out of directly-communicated info and
into an encyclopedia dialog.** This is the right call and Free Play is its natural
home — an endless mode has no scripted tutorial arc to hang facts on, and a curious
visitor has time to read.

**What moves in.** Today, ecology is delivered as fleeting, un-revisitable text:
- `MIGRATION_PATTERNS` / `MIGRATION_HINTS` season blurbs (`mauri_seasons.js`),
- tutorial tips (`mauri_tutorial.js`, `TUTORIAL_TIPS`, per-level `tutorial_*.js`),
- one-shot notifications (`Game.addNotification`),
- and the rich material currently living only in `DEVBLOG_systems.md`.

The tutorial should keep only *how to play* (press this, place that); everything
*about the world* — who the species are, why the forest is a refuge, why winter
starves — moves to the encyclopedia, where it is browsable on demand.

**The system (proposed).**
- A pausing, closable dialog (same host pattern as the tutorial's pause-on-tip),
  opened from a HUD button and auto-offered (once) the first time a new species,
  plant, or climate state appears.
- Content is **data, not code**: an `ENCYCLOPEDIA` table of entries, each
  `{ id, category, title, subtitle, spriteKey, body[], seeAlso[], unlock }`.
  Categories: `species`, `plants`, `biomes`, `climate`, `concepts`.
- **Progressive unlock** keyed off the sim (first sighting, first winter, first deep
  glacial), so the book fills in as the run reveals the world — the discovery is part
  of the play. `unlock` is a predicate over `(sim, game)`, mirroring the tutorial's
  `CONDITION` triggers.
- Entries link (`seeAlso`) so a reader can wander from "Upland Moa" to "Beech
  refuge" to "Glacial cycles."
- **No emoji in the body** — drawn glyphs / sprites only, matching the project's UI
  convention.

**Seed entries** (drafted from §2's research; ready to paste as `body` arrays):

- **Upland Moa — *Megalapteryx didinus*.** The alpine specialist, feathered to the
  ankle against the cold. Browsed beech leaves and twigs, nectar-rich flax and
  fuchsia flowers, and subalpine herbs. In a deepening glacial it is the last moa
  still thriving high — the backbone of a cold-world flock. *See also: Beech refuge,
  Glacial cycles, Cold tolerance.*
- **The Beech Refuge.** During the last glacial, tall forest collapsed across most of
  the South Island — but northwest Nelson and the Karamea coast kept small pockets of
  beech alive. These "refugia" are why forest could spread out again when the ice
  retreated. On this map, the forest band *is* that refuge: thin, contested, and the
  only reliable winter larder. *See also: Winter food, Forest contraction.*
- **Why winter starves but doesn't strip.** New Zealand's plants are almost all
  evergreen — beech, tussock and the shrubs hold their leaves all year. So a glacial
  winter here doesn't leave bare ground; it leaves *standing food with nothing in it*.
  Fruit and berries end, new growth stops, frost toughens the leaves. The problem for
  a moa isn't finding a plant — it's finding one worth eating. *See also: Beech
  refuge, Snow tussock.*
- **Snow tussock — *Chionochloa*.** The big bunch-grasses of the high country. They
  evolved with no browsing mammals — only moa and insects — and stand through the
  hardest winters, but they are coarse, slow, and low-value in the cold. *See also:
  Winter food.*
- **Haast's Eagle — *Pouākai*.** The largest eagle known, and the apex hunter of the
  moa world. Its numbers rise and fall with the moa it hunts: a good run of fat
  summers feeds more eagles; a deep glacial that thins the moa starves the eagles
  down behind them. *See also: Predator and prey.*
- **Glacial cycles.** The ice ages came in waves — long cold glacials broken by
  shorter warm interglacials — and over the last million years the cold peaks grew
  *deeper*. Free Play compresses that into your run: each winter a little colder than
  the last, until the land can't keep the flock fed. *See also: Winter food, Cold
  tolerance.*

---

## 6. Data & code touch-points

Nothing below changes an existing level's behaviour; every hook is guarded.

**New file — `mauri_climate_drift.js`** (pure, p5-free, like Te Manawa's
`climate.js`; load *before* `mauri_seasons.js` in `index.html`).
- `ClimateDrift.indexAt(cycle)` and a tiny state read from the season clock.
- Node-requirable (`module.exports`) so the benchmark can test the curve headlessly.

**New file — `levels/level_freeplay_kahurangi.js`** — clone the glacial level's
`terrain` / `biomes` / `species` / `availablePlaceables`; drop `phases`; set
`endless: true`; add the new `mechanics` flags.

**New file — `mauri_encyclopedia.js`** (+ a HUD button in `mauri_UI.js`) — the
`ENCYCLOPEDIA` table and the dialog host.

**Edits (all behind guards):**
- `mauri_seasons.js` — **first, inline the `_lerpSeasonal` closures** (perf debt,
  §3). Then fold `coldIndex` into `getSnowLineElevation`, `getForestBand`,
  `getPlantModifier`/`getPlantTypeModifier` (winter end only), `getHungerModifier`.
  The manager needs to know the current `coldIndex`; pass it in on `update(dt)` from
  the Game (do **not** store it on `CONFIG`).
- `mauri_plant.js` — add the `winterEdibility` floor to the winter branch of
  `handleGrowth` (reconciled with the existing squared modifier — see §4.2 caution);
  ensure inedible plants render frosted but are skipped as food.
- `mauri_moa.js` — `findPlant` / `localFoodScore` skip winter-inedible plants as food
  (like dormant); apply the cold-tolerance-weighted winter penalty (§4.3).
- `mauri_sketch.js` — the `endless` short-circuit in `checkGoals` (§4.4); derive and
  advance `cycle`/`coldIndex` each frame from `playTime`; extend `_scoreContext` with
  `cyclesSurvived`; optionally soften the eagle-extinction loss for endless.
- `PLANT_TYPES` (`mauri_sketch.js`) — add `winterEdibility` per entry (§4.2 table).

**New `LEVEL_MECHANICS` flags:** `climateDrift`, `deepenPerCycle`, `coldCap`,
`warmFloor`, `amplitude`, `driftCurve`, `winterEdibility` (master on/off),
`coldToleranceMattersMult`, `immigration` (+ params), `endless` (on the level def,
not mechanics, since `checkGoals` reads the level).

---

## 7. Build order and how to test

Ship it in thin, testable slices — each is playable and each is a benchmark check.

1. **Endless skeleton.** New level file + `endless` flag + the `checkGoals`
   short-circuit + cycle counter + HUD "cycle N" readout. *Verify:* the level runs
   past frame one and never auto-wins; loss on last-moa still fires.
2. **Climate drift scalar + gauge.** `mauri_climate_drift.js`, wire `coldIndex` into
   the snow line and winter `plantModifiers` only; add the climate gauge. *Verify:*
   snow line and winter growth measurably deepen cycle over cycle; summers unchanged.
3. **Winter edibility.** The `PLANT_TYPES` floors, the plant-side floor, the forager
   skip. *Verify (the key test):* in deep winter, plants stay `alive` and rendered
   while their `nutrition` reads at the floor; **no plant is removed by cold**; a
   beech plant keeps value a rimu doesn't.
4. **Cold-tolerance axis + breeding squeeze.** *Verify:* over a long headless run the
   flock composition drifts toward the upland moa as `coldIndex` climbs; breeding
   windows shorten with the cold.
5. **Encyclopedia.** System + seed entries + migrate the season/tutorial text.
6. **Texture.** Warm-interlude messaging, palette winter-lifeline floors, immigration
   backstop, run scoring + personal best.

**The harness.** Mauri's `mauri_benchmark.js` is the equivalent of Te Manawa's
bootcheck — extend it, don't add a framework. It should assert, at minimum: (a) the
level boots and does not instant-win; (b) `coldIndex` is monotonic-per-baseline and
clamped at `coldCap`; (c) after a simulated deep winter, the count of `alive` plants
is unchanged by cold alone (only grazing reduces it) — this is the "inedible not
dead" regression guard; (d) a headless long run shows the composition drift of §4.3
and *no* per-frame closure allocation regression in the season getters.

---

## 8. Decisions (resolved — as built)

1. **Curve shape** — RESOLVED: a **stark oscillation with ramped ends**, deepening to
   the cap by ~cycle 10. `ClimateDrift.severityOfCycle(cycle)` = a per-cycle stark
   trapezoidal wave (period 3 yrs → two glacial years then a relief year) times a
   smoothstep ceiling that ramps 0→coldCap over `rampCycles` (=10), with a modest
   rising relief floor (`baselineFrac`). Knobs live in the level's
   `mechanics.climateDrift`.
2. **Economy** — RESOLVED: the Mauri economy stays (endless *survival*). Yearly goals
   pay mauri; banking it in warm years funds the cold ones.
3. **Eagle extinction** — RESOLVED: **not a loss.** Losing the eagles booms the
   dominant non-focus moa (unsuppressed breeding + a raised cap), which crowds the
   focus species; eagles re-immigrate at the next year boundary, ending the boom.
4. **Immigration backstop** — RESOLVED: yes, but scoped to the year boundary — extinct
   **non-focus** species are refounded each new year, and the two **focus** species are
   protected from a total wipe *only during their focus year* (dynamic floors). Loss is
   still real: lose *all* moa and the run ends.
5. **How steep** — set for "brutal by ~cycle 10" (`rampCycles: 10`, `coldCap: 1.0`);
   `seasonDuration: 1800` makes a year ~2 min. Still a **playtest knob** — tune against
   a benchmark run once art/behaviour settle.
6. **Encyclopedia reach** — RESOLVED: **gamewide** (`mauri_encyclopedia.js`, opened with
   **E** on any level). Content migration out of tutorials/notifications is the next
   iterative step.

### Follow-ups
- Migrate the season blurbs (`MIGRATION_PATTERNS`/`MIGRATION_HINTS`), tutorial tips and
  DEVBLOG ecology into `ENCYCLOPEDIA` entries; trim tutorials to how-to-play.
- Decide whether Free Play is always-open in the menu (it's `unlockCondition: null`, but
  the menu's progression lock still hides it behind Level 1).
- Balance pass: per-species `freeplayTargets`, `coldToleranceMattersMult`, the winter
  `PLANT_TYPES.winterEdibility` floors, and `PLANT_INEDIBLE_THRESHOLD`.
- Persist a personal best ("cycles survived") on loss.

---

## 9. Sources

Ecology grounding for §2 and the encyclopedia seed content:

- Newnham et al., *The vegetation cover of New Zealand at the Last Glacial Maximum* —
  [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0277379112003356);
  open PDF via [ANU Press](https://press-files.anu.edu.au/downloads/press/p18701/pdf/ch0417.pdf).
- *The vegetation and climate during the Last Glacial Cold Period, northern South
  Island, New Zealand* —
  [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0277379112005203)
  (the Nelson/northern South Island refugium evidence).
- *Phylogeography reveals the complex impact of the Last Glacial Maximum on New
  Zealand's terrestrial biota* —
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11459792/) (micro-refugia, incl. NW
  Nelson / West Coast).
- Upland moa (*Megalapteryx didinus*) — [NZ Birds
  Online](https://www.nzbirdsonline.org.nz/species/upland-moa); coprolite diet study,
  *High-Resolution Coproecology…* —
  [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3386916/).
- Snow tussock / *Chionochloa* and moa browsing — [Te Ara: Tussock
  grasslands](https://teara.govt.nz/en/grasslands/page-1);
  [NZ Flora: *Chionochloa rigida*](https://www.nzflora.info/factsheet/taxon/Chionochloa-rigida.html).
- Haast's eagle (*Pouākai*) — [Wikipedia](https://en.wikipedia.org/wiki/Haast%27s_eagle).
- Kahurangi National Park (setting) — [DOC](https://www.doc.govt.nz/parks-and-recreation/places-to-go/nelson-tasman/places/kahurangi-national-park/).

Engine grounding is in-repo: `OVERVIEW.md`, `DEVBLOG_systems.md`, and the Te Manawa
fork's `TeManawa_climate.js` / `MISTAKES.md` for the climate-drift and
threshold-lerp patterns cited in §3.
