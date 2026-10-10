# Avian Age: Mauri; Free Play mode (design)

*An endless survival mode set in glacial-age Kahurangi. You steward a community of moa and
forest birds through turning seasons while the climate slowly deepens; each glacial winter
a little colder than the last. There is no "win": you play to see how long you can keep the
year's vulnerable species alive, and how well you keep them all in balance.*

> **Governing principle.** Free Play is a *pressure ramp*, not a new simulation. Almost
> everything it needs is a lerped seasonal modifier the engine already had. The mode slides
> those numbers a little further into the cold each cycle, and makes winter take *food
> value* away rather than *plants*. Build a knob, not a world.

This is the mode's design spine and ecology grounding. `YEARS_PLAN.md` is the living build
plan for its year structure (focus species, the kea cascade, the world grid); `OVERVIEW.md`
is the codebase map. Every Free Play behaviour sits behind a `LEVEL_MECHANICS` flag, so the
other levels are untouched. The flags live in `levels/level_freeplay_kahurangi.js`.

---

## 1. What Free Play is (as built)

- **An endless level** (`endless: true`): `checkGoals` hands off to the year engine and never
  declares a win.
- **Years, not a timer.** A season is 1 min, a year 4 min, running summer → autumn → winter →
  spring. Each year has its own **focus species** (that year's flighted bird plus one zone
  moa), its own goals, and its own toolbar; then the camera pans to the next area of a 2×2
  world (see `YEARS_PLAN.md`).
- **Loss** comes when **any focus species** dies out (no live birds and no egg of its own
  incubating). Non-focus species are floored at 2 and can't starve or be hunted below that;
  extinct non-focus species are refounded at the next year. The off-focus zone moa is
  neither floored nor a loss. **End Run** in the pause menu ends a run by choice.
- **The Mauri economy stays.** The main income is passive: the average population of the
  species present × how evenly balanced they are. Banking mauri in the warm years funds the
  cold ones.
- **A climate that deepens** (§3.1) and **winters that starve rather than strip** (§3.2).
- **Score** = years survived (×100) plus moa kept. A stats export (JSON + text) is offered
  at the end of a run.

---

## 2. The ecology it stands on

The map is NW Nelson / Kahurangi in Te Waipounamu during the Last Glacial Maximum
(~21 ka). The mode's core mechanics fall straight out of what that place was.

**Kahurangi was a forest *refugium*.** Across most of the glacial South Island, tall forest
collapsed into a shrubland–grassland–tussock mosaic; but the northern West Coast and Nelson
(the Karamea Bight edge, exactly our map) is one of the regions where beech unambiguously
*survived*, in small "micro-refugia." So a thin, contested forest band amid open glacial
flats and subalpine tussock is not artistic licence; it is the consensus reconstruction.
Free Play keeps that band and makes it the winter lifeline.

**New Zealand's flora is evergreen, so winter starves rather than strips.** Almost all of
Kahurangi's plants (beech, the podocarps, the tussocks, the divaricating shrubs) hold their
foliage year-round. What the cold removes is not the *plant* but the *food*: new growth
stops, fruiting and mast end, soft browse hardens, and frost drops palatability. A moa's
winter is a hunger problem, not a bare-ground problem.

**The cast is real and already cold-stratified.** The upland moa (*Megalapteryx didinus*)
was the alpine/subalpine specialist, feathered down to the ankle against the cold. The
lowland browsers (giant, stout-legged and heavy-footed moa) are the ones a deepening cold
should squeeze first. The engine already encoded this (`temperatureTolerance.cold`,
per-season hunger rates); §3.3 turns it into a difficulty axis. Overhead, the Haast's eagle
(*Pouākai*) ebbs and flows with its prey through the emergent-eagle system.

The point for the build: **the two headline mechanics are the two headline facts**;
Kahurangi kept its forest, and its forest kept its leaves.

---

## 3. Mechanics

### 3.1 Progressive climate drift
`ClimateDrift` (`mauri_climate_drift.js`) is one pure function of the year count, returning
`coldIndex` (0 = interglacial, 1 = full glacial). The curve is a stark oscillation (two
glacial years, then a relief year; `periodYears: 3`) under a ceiling that ramps to `coldCap`
over `rampCycles` (10 years, so "brutal" arrives at ~40 min), with a modest rising relief
floor. Knobs: `mechanics.climateDrift`.

`coldIndex` is a multiplier on the **winter end** of the existing seasonal numbers, so
summers stay summery: the snow line drops, the forest band contracts, winter hunger rises,
breeding cooldowns lengthen, and the winter edibility floors (§3.2) erode.

**The hard rule:** `coldIndex` modulates values at read time, on the instance. It is never
written back into `SEASONS`, `CONFIG` or a plant's base fields, or it compounds across
restarts (`MISTAKES.md`).

### 3.2 Winter takes food value, not plants
Each `PLANT_TYPES` entry carries a `winterEdibility` floor in [0, 1]: the share of its food
value that survives the cold (beech 0.35 keeps the most; tussock 0.20; the shrubs 0.15;
fern and flax 0.10; rimu and pātōtara 0, since the fruit simply isn't there; the planted
favoured plants 0.25). In winter, `Plant._applyWinterEdibility` blends a plant's nutrition
toward `base × growth × winterEdibility × winterEdibilityMult × (1 − erosion × coldIndex)`.
Below a small threshold the plant is `winterInedible`: foragers skip it, and it stands
frosted on the map. `winterEdibilityMult` (1.5) and `winterEdibilityErosion` (0.6) are the
level's knobs. In a mast year, forest plants keep their food value through the cold.

**The guardrail:** cold never sets `alive = false`. Only grazing removes a plant. A winter
that deletes the flora churns the map bare and lies about an evergreen landscape.

### 3.3 Cold tolerance shapes the cast
`coldToleranceMatters` adds a winter hunger surcharge of
`baseHungerRate × coldIndex × winterness × (1 − tolerance.cold) × coldToleranceMattersMult`.
The upland moa (cold 0.8) barely feels the ramp; the lowland browsers fade first, so the
flock drifts upland-ward as the run cools.

### 3.4 The mast year
A mast year is the great NZ forest event: beech and podocarps fruit en masse. Free Play
**earns** it rather than selling it: Year 2 of each loop sets a mast goal (gain 400 mauri in
the year). Reach it and the mast comes early (year 3, in the milder downslope, so the kākāpō
breed and a kōkako stretch opens in year 4); miss it and it falls late (year 4, in the cold
upslope). While a mast year runs (`Game._isMastYear`, read-time like `coldIndex`): rimu
growth ×3 and beech/fern ×2, forest plants stay edible through winter, the fruit-bird flock
caps swell (`mastFlockMult` 1.6) and their egg cooldowns drop, and kākāpō can breed. The
**Rimu Berry Scramble** tool shakes a glut of berries from the rimu for the kākāpō. After
the year everything reverts, and the swollen flock thins back toward its cap.

### 3.5 The Field Guide
`mauri_encyclopedia.js`, gamewide, opened with **E**: species, plants, places and concepts as
data entries that unlock as the run reveals them. The tutorial should keep only *how to
play*; what the world is and why moves here.

---

## 4. Decisions (resolved)

1. **Curve shape:** a stark oscillation with a ramped ceiling (§3.1), parametric on purpose.
   A paleoclimate replay would need an anchor table instead; Free Play is a difficulty curve.
2. **Economy:** stays, as endless *survival*; passive income rewards a large and *even*
   community.
3. **Eagle extinction is not a loss.** Losing the eagles booms the dominant non-focus moa
   (which crowds the focus species); eagles re-immigrate at the next year boundary.
4. **Rescue only at the year boundary:** extinct non-focus species are refounded each new
   year; focus species have no safety net.
5. **Free Play is always open** in the menu (`unlockCondition: null`).

## 5. Open follow-ups

- Move the season blurbs (`MIGRATION_PATTERNS` / `MIGRATION_HINTS`), remaining ecology tips
  and the DEVBLOG ecology into Field Guide entries; trim tips to how-to-play.
- Balance pass: `freeplayTargets`, `coldToleranceMattersMult`, the winter edibility floors,
  `PLANT_INEDIBLE_THRESHOLD`.
- Fold in what the module levels teach (Storm as cover, the pātōtara–kea trade); see
  `YEARS_PLAN.md`, "Free Play follow-ups from the modules".

---

## 6. Sources

Ecology grounding for §2 and the Field Guide:

- Newnham et al., *The vegetation cover of New Zealand at the Last Glacial Maximum*;
  [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0277379112003356);
  open PDF via [ANU Press](https://press-files.anu.edu.au/downloads/press/p18701/pdf/ch0417.pdf).
- *The vegetation and climate during the Last Glacial Cold Period, northern South
  Island, New Zealand*;
  [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0277379112005203)
  (the Nelson/northern South Island refugium evidence).
- *Phylogeography reveals the complex impact of the Last Glacial Maximum on New
  Zealand's terrestrial biota*;
  [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11459792/) (micro-refugia, incl. NW
  Nelson / West Coast).
- Upland moa (*Megalapteryx didinus*); [NZ Birds
  Online](https://www.nzbirdsonline.org.nz/species/upland-moa); coprolite diet study,
  *High-Resolution Coproecology…*;
  [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3386916/).
- Snow tussock / *Chionochloa* and moa browsing; [Te Ara: Tussock
  grasslands](https://teara.govt.nz/en/grasslands/page-1);
  [NZ Flora: *Chionochloa rigida*](https://www.nzflora.info/factsheet/taxon/Chionochloa-rigida.html).
- Haast's eagle (*Pouākai*); [Wikipedia](https://en.wikipedia.org/wiki/Haast%27s_eagle).
- Kahurangi National Park (setting); [DOC](https://www.doc.govt.nz/parks-and-recreation/places-to-go/nelson-tasman/places/kahurangi-national-park/).

The climate-drift and threshold-lerp patterns came from the Te Manawa fork
(`TeManawa_climate.js` and its `MISTAKES.md`).
