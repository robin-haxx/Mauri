# Dev Blog — Ecology & Behaviour under the hood of *Mauri*

*How a coexistence model from theoretical ecology, a warming-and-cooling climate, a
flock of steering agents, and a noise-generated landscape combine into the glacial
Kahurangi level.*

This post is a tour of four interlocking systems in the *Mauri* codebase:

1. **Coexistence via aggregation** — turning a 2002 ecology paper into a food mechanic.
2. **Climate-driven migration** — how New Zealand's glacial cycles push moa around the
   map, and how the code makes them chase habitat.
3. **The behavioural system** — steering agents with a per-species state machine.
4. **Landform & forest composition** — noise-built terrain, elevation-band biomes, and a
   forest that shrinks in the cold.

We'll start with a one-minute mental model of each, then go deep.

---

## 0. The concepts in brief

- **Agents are boids.** Every moa and eagle is a steering agent (Reynolds boids):
  it sums small "forces" (seek food, flee predator, separate from neighbours, wander)
  into an acceleration each frame. That's `mauri_boid.js`.
- **Moa run a state machine on top.** `mauri_moa.js` decides *what* to want (forage,
  flee, migrate, find a mate) based on hunger, threats, and the season, then expresses
  that want as boid forces.
- **The world is elevation bands.** `mauri_terrain.js` builds a heightmap from noise and
  slices it into biomes by elevation. "Forest" is just the band 0.36–0.48 on the glacial
  map. Plants live in biomes; moa species prefer elevation ranges.
- **Seasons are lerped modifiers, not events.** `mauri_seasons.js` continuously blends
  numbers — how fast plants grow in each biome, where the snow line sits, where each
  species wants to be — so the world *glides* between seasons.
- **Plants are depletable patches.** `mauri_plant.js`: grow → get eaten → regrow. Some
  are **favoured** by one species and nearly useless to others.
- **Mechanics are opt-in per level.** A global `LEVEL_MECHANICS` object (set from the
  level file) gates every special rule, so features can be added without touching other
  levels.

Now the deep dives.

---

## 1. Coexistence — niche partitioning first, aggregation as a nuance

**The primary frame is niche partitioning.** Real moa coexistence is generally attributed
to **body-size, dietary, and habitat differences** (Worthy & Holdaway) rather than to the
ephemeral-patch dynamics the aggregation model was built for. The game leans into that:
each species is pinned to an **elevation band** (spatial/habitat niche, via `habitatStress`)
and to **browse-resistant favoured plants** (dietary niche, via the favoured-plant food
mechanic). That partitioning is what actually lets a weak forest specialist persist beside
a dominant browser.

**Aggregation is layered on as a secondary nuance**, for the one resource everyone still
contends for — the forest refuge. The Hartley & Shorrocks (2002) aggregation model gives us
a principled way to make that *shared* patch self-limiting (crowding on it hurts everyone),
adding texture on top of the niche split rather than carrying the whole coexistence load.
We're candid that this half is **engineered rather than emergent** — the clumping is imposed
by construction, not measured — so it's a flavour of the real dynamic, not a faithful
simulation of it. The rest of this section walks through that aggregation layer.

### The theory
*"A general framework for the aggregation model of coexistence"* (Hartley & Shorrocks,
*Journal of Animal Ecology*, 2002) tackles a classic puzzle: how do competing species
sharing patchy, ephemeral resources avoid competitive exclusion? The answer is
**aggregation**. If each species *clumps* on the resource patches — so that an individual
mostly experiences crowding from its **own** kind rather than from competitors — then
intraspecific competition throttles the strong competitor before it can drive the weak
one extinct. In the paper's Lotka–Volterra-on-patches formulation, coexistence needs the
product of the competition coefficients to be **less than one** (α_xy · α_yx < 1), and a
*random* clumping of clutches is enough to generate that, provided the species aren't too
evenly matched. The knobs are the **aggregation parameter** (how clumped each species is)
and the **per-patch competition coefficients** (how much one species' presence hurts
another on a shared patch).

### The adaptation
We don't simulate egg-laying distributions, but we reproduce the *causal structure*:
make each species aggregate on **its own** patches, and make shared patches costly.

**Species-specific patches — the favoured plants.** Two placeables, **lancewood**
(favoured by the bush moa / emeid) and **speargrass** (favoured by the upland moa /
Megalapteryx), plant food that is browse-resistant to everyone else. Three code paths
turn that into aggregation:

- *Attraction is selective.* `PlaceableObject.getAttractionStrength(moa)` cuts a stand's
  pull to 20% for any moa it doesn't favour — so a lancewood stand mostly draws bush moa.
- *Foraging is selective.* In `Moa.findPlant()`, a plant carrying a `favouredSpecies` that
  isn't yours has its score multiplied by 4 (strongly deprioritised), while your own
  favoured plant is multiplied by 0.6 (preferred). Agents therefore **cluster on their
  own resource**.
- *Payoff is selective.* When a non-favoured moa does eat one, `Moa.forage()` scales the
  nutrition by `unfavouredBrowsePenalty` (0.25). The plant is, to a competitor, barely
  worth the trip.

Net effect: plant a lancewood corridor and the bush moa aggregate there; the giant and
stout-legged moa largely ignore it. That is the paper's aggregation — engineered rather
than emergent — and it is exactly what lets a weak forest specialist persist alongside a
dominant browser.

**Shared patches are costly — forest interference competition.** The one resource
everyone still contends for is the forest refuge. `Moa.forage()` reads
`forestCompetition`: when more than `forestCompetitionTolerance` moa are within
`forestCompetitionRadius` of a forest plant, each additional competitor shaves the
nutrition won from it (`forestCompetitionPenalty`, amplified by `winterCompetitionMult`
in winter). This is the **per-patch competition coefficient** made concrete — crowding on
a shared patch reduces everyone's take, so piling onto the forest yields diminishing
returns and pushes species back toward their private patches.

**Habitat pins the aggregation.** `habitatStress` (in `Moa.behave()`) adds hunger to any
moa sitting outside its species' `preferredElevation` band. Combined with the favoured
plants, this keeps each species aggregated in its own elevation zone — the spatial form of
the same idea.

So the mapping to the paper is: **favoured plants + habitat stress = high intraspecific
aggregation**; **forest interference = the interspecific competition coefficient on the
shared patch**. Tuning `unfavouredBrowsePenalty` and the forest penalties is, in effect,
tuning α_xy·α_yx toward the coexistence-permitting `< 1`. A future, more faithful version
could measure realised aggregation and compute an actual invasion criterion; today the
mechanic is the paper's conclusion baked into the food web.

---

## 2. Climate-driven migration (the New Zealand glacial ecology)

### The ecology
During the Last Glacial Maximum (~21 kyr ago) the New Zealand treeline dropped by
hundreds of metres and tall forest contracted into scattered **refugia**, while cold
tussock grassland, herbfield and shrubland spread across the lowlands and outwash flats.
Animals didn't "decide" to migrate so much as **track their habitat** as it moved: a
cold-adapted upland moa follows the subalpine zone up in the brief summer and drops into
forest shelter in winter; a forest specialist crowds the shrinking refuge; open-country
species exploit the expanding flats. Populations rise and fall with the seasons — a lean
winter culls, a good summer rebounds — and predators lag their prey. Our level compresses
this into two glacial winters bracketing warm seasons.

A note on scale: this 2-D prototype runs at **season** resolution, so it models the
*within-season survival squeeze* of a glacial age — not the multi-generational, cross-cycle
demography (refugial bottlenecks and post-glacial recolonisation over tens of thousands of
years of Milankovitch cycles). That 40k-year-epoch timescale is deliberately **out of scope
here** and belongs to the 3-D game, which unfolds across those epochs. So read this level as
"surviving glacial-age winters," not "simulating a full glacial cycle."

### The code
The engine expresses "habitat that moves" as **continuously lerped modifiers**, and moa
as agents that chase the good numbers.

- **Where food is, by season.** `SeasonManager.getPlantModifier(biomeKey)` and
  `getPlantTypeModifier(type)` return per-season growth multipliers (blended across the
  transition window). In winter the glacial flats crash (0.4) while the forest refuge
  stays the best larder (0.7) but is small; in spring the low country greens first. Plants
  read these every update, so the *food landscape itself* migrates.
- **Where each species wants to be.** Each season has a `preferredElevation`, and each
  species a niche band; `Moa._updateSeasonCache()` blends the two. `Moa.shouldMigrate()`
  fires when a moa is too far outside that blended band (or is hungry with poor local
  food), and `findMigrationTarget()` samples nearby walkable spots and seeks the one
  closest to the target elevation. That's habitat-tracking, not scripted paths.
- **The treeline descends — forest contraction.** `SeasonManager.getForestBand()` returns
  a productive-forest elevation band that **retreats** in autumn/winter (per the level's
  `forestBandBySeason`). In `Plant.update()`, any forest tree (`FOREST_TREES`) whose
  elevation falls outside the current band is **suppressed** — nutrition set to zero, drawn
  wilted. So the forest literally shrinks upward-out in the cold and rebounds in spring,
  and it does so as a cheap per-plant threshold test (see §4), never a re-tiling.
- **Winter bites harder.** The same seasonal key ramps interspecific competition
  (`winterCompetitionMult`), niche stress (`winterStressMult`), and **doubles the
  reproduction cooldown** (`winterBreedingCooldownMult`) — encoding the natural winter
  decline and the fact that a cold season is no time to breed.
- **Predators lag prey — emergently.** Eagles are no longer counted by a top-down
  controller. Under `emergentEagles`, each bird runs its own demography (see §3): it
  feeds or **starves** on an energy budget, and **breeds** — laying an egg in its nest —
  with a *varied* drive whose strength scales with how far the eagle:moa ratio sits below
  a tunable **target ratio** (`eagleTargetRatio`, ~one eagle per six moa). When moa are
  plentiful, well-fed eagles breed and numbers climb; when the winter crash thins the moa,
  eagles fail to feed and starve back down. The classic predator–prey lag now *emerges*
  from those individual births and deaths rather than being prescribed — which is why the
  second-spring tutorial line warns that "now you only have the giant killer eagles to
  worry about." (The old proportional controller, `regulateEagles`, still exists for levels
  that don't opt in.)

Put together, a playthrough *feels* like tracking a moving habitat: you chase the food
uphill in summer, funnel everyone into the refuge for winter, accept some loss, and rebuild
in spring.

---

## 3. The behavioural system

### The boid substrate (`mauri_boid.js`)
Every animal is a `Boid`. The base class provides the steering primitives — `separate`
(push off close neighbours, inverse-square weighted), `align`/`cohesion` (match/approach
the local flock), `seek`/`flee` (go to / away from a point with an urgency scalar),
`wander` (a Perlin-noise-driven heading so idle movement looks organic), `avoidUnwalkable`
(cast a look-ahead and steer to the best open angle), and `edges` (turn away from map
borders). `applyForce()` accumulates these into `acc`; `update(dt)` integrates
`vel += acc·dt`, clamps to `maxSpeed`, moves, and clears the accumulator. Everything is
delta-time scaled and uses pre-allocated scratch vectors to avoid per-frame garbage.

### The moa mind (`mauri_moa.js`)
A moa is a `Boid` plus a **species identity** and a **state machine**. On construction it
merges `Moa.DEFAULTS` with its `MOA_SPECIES` config, so speed, hunger rates, flocking,
niche, temperament, special abilities (eagle resistance, camouflage, foraging bonus), and
the render **tint** all come from data.

Each frame `behave()` runs a small pipeline:

1. **Age & hunger.** Ageing scales body size (juveniles are smaller and hungrier); hunger
   climbs at a species- and season-modulated rate, plus any **habitat-stress** penalty.
2. **Sense.** It pulls nearby plants, eagles, moa, and placeables from the spatial grids
   (radius-limited), and caches which eagles are actually threatening.
3. **Decide** (`determineState`). Priorities cascade: an active mating bout > fleeing a
   close eagle > foraging when hungry > seeking a mate when fed and secure > migrating
   when out of habitat > idle wander.
4. **Act** (`executeState`). The chosen state emits boid forces — `flee` from the eagle,
   `seek` the best plant, `seek` a migration target, `seek` a mate — layered with
   separation and terrain avoidance.

**Foraging** (`findPlant`) scores candidate plants by distance, nutrition, seasonal vigor,
home-range bonus, and the favoured-plant preferences from §1, then eats when in range
(applying competition and favoured-species scaling to the payoff).

**Reproduction is gated, not free.** A moa must be mature, well-fed, and have accrued
`securityTime` (which only builds when no eagle is near) before it will seek a mate.
`findPotentialMate` requires the opposite sex and now **strongly prefers the same
species** (a ×40 score penalty on cross-species candidates), so cross-species pairings are rare and
only happen when no conspecific partner exists. Mating makes the female pregnant; after an
incubation timer she lays an `Egg` tagged with her species; the egg hatches the parent
species (faster if it sits near a nest).

This mate-finding requirement is an **implicit Allee effect**: at low density a moa struggles
to find a same-species partner, so a species that dips toward one or two survivors becomes
fragile and can spiral to local extinction — exactly the knife-edge that makes the level's
two founders tense. Rather than hard-coding a rescue, we surface this to the player as a
**tooltip**: when a species falls to a critical threshold, the game flags it so the *player*
can intervene (plant food, place a nest, draw the survivors together) and pull it back from
the brink. The stewardship, not the safety net, is the point.

**Migration** is the habitat-tracking from §2: when out of niche/food, pick a better-
elevation target and move there, then settle a new home range.

### The eagle (`mauri_eagle.js`)
The Haast's eagle is a `Boid` with a **patrol → hunt → rest** machine. It patrols a nest
area, spots eagle-vulnerable moa within its hunt radius, swoops with **lead prediction**
(aiming where the prey *will be*), and on a catch rests to digest. Larger moa are harder
or ignored.

Its *population* used to be dialled in from outside; under the opt-in **emergent** model
it now runs its own life history, so eagle numbers ebb and flow on their own:

- **A fixed nest.** At spawn each bird is given a home site — the highest, rockiest
  walkable spot in a small neighbourhood, an eyrie (`_assignEagleNest`). It patrols around
  that nest and, after a kill, heads home to digest rather than re-centring on the carcass.
- **An energy budget that can starve it.** Hunger climbs every frame; sustained hunger
  above a threshold accrues a starvation timer, and a bird that can't catch prey in time
  **dies** (`alive = false`, cleaned up like a moa). Eagles are also *territorial* — when a
  hunt search comes up empty they return to the nest instead of teleporting across the map,
  so a barren territory thins its eagles honestly instead of shuffling them elsewhere.
- **Age and maturity.** Hatchlings start small and can't breed until they mature.
- **Prey-driven reproduction.** A calm, mature, well-fed bird that's off cooldown may
  **lay an egg in its nest** (`_tryReproduce`). The chance is per-individual (a random
  `reproDrive`) and scales with *breeding pressure* — how far the current eagle:moa ratio
  sits below `eagleTargetRatio`. At or above target the drive is zero; well below it, birds
  breed readily. The egg incubates on the shared egg lifecycle (`offspringType: 'eagle'`)
  and hatches a juvenile Pouākai. Designers tune the **target ratio**, not a fixed count.

### Why it scales
All neighbour queries go through `mauri_spatial.js` grids; expensive passes (placeable
effects, plant updates, cleanup, eagle regulation) are **throttled** on timers or batched;
population counts and UI summaries are **frame-cached**. So hundreds of agents stay cheap.

---

## 4. Landform & forest composition

### Building the land (`mauri_terrain.js`)
Terrain is generated once per level:

1. **Height.** `getElevation(x,y)` blends fractal (fBM) noise with **ridge** noise
   (`ridgeInfluence`) for sharp alpine crests, shapes it with `elevationPower`, and then
   either applies an **island falloff** (a warped, noisy coastline that sinks the west edge
   into sea) or, for inland maps, carves **lake basins**. The result is written into a
   typed `Float32Array` heightmap on a coarse grid.
2. **Biomes are elevation bands.** Each level defines biomes with `minElevation`/
   `maxElevation`; `getBiomeFromElevation()` is a simple band lookup, baked into a
   `Uint8Array` biome-index map. So "Forest Refuge" *is* the cells whose height is
   0.36–0.48. Biomes carry `walkable`, `canPlace`, `plantTypes`, and colours.
3. **Lookups.** `getElevationAt/getBiomeAt/isWalkable/canPlace` are O(1) grid reads used
   everywhere by agents and placement.

### Forest composition
"Forest composition" is where the plant tables meet the biomes. A biome lists the plant
types that can grow there — on the glacial map the forest refuge grows `beech`, `rimu`,
`fern`; the flats grow `tussock`, `matagouri`, `coprosma`, `flax`; the subalpine grows
`tussock`, `dracophyllum`, `patotara`. Natural plants are seeded at generation by sampling
each walkable cell against `plantDensity` and its biome's plant list; **planted** plants
come from placeables and carry a `favouredSpecies`. Each `Plant` then lives a lifecycle —
grow to full, get eaten to zero, regrow on a season-scaled timer, or go **dormant** at the
wrong elevation for the season — and picks a sprite state (thriving / mature / wilting /
dormant) to match. The glacial level deliberately makes the forest a **thin, contested
band**, which is what gives the coexistence problem its teeth.

### Changing the alps without a stutter (the key pattern)
Season changes touch a lot of visual state (snow creeping down the mountains), so the
engine avoids recomputing anything mid-transition:

- At generation, `TerrainGenerator` **pre-bakes one full terrain image per season**
  (`_bakeSeasonBuffer`), blending snow into every cell above that season's snow line. At
  runtime `render()` just draws the current season's image and **cross-fades** to the
  next during the transition window — pure image compositing, zero per-cell work.
- For *gameplay* (not just visuals), the snow line is a single **lerped scalar**
  (`getSnowLineElevation()`); `getEffectiveBiomeAt()` treats anything above it as the snow
  biome, so high ground becomes non-walkable seasonally without re-tiling the map.

The **forest contraction** added for the glacial level deliberately copies this pattern:
instead of reclassifying the forest biome each frame, `SeasonManager.getForestBand()`
returns a per-frame **lerped band** (cached by frame), and each forest tree does a single
O(1) inside/outside check in its normal update. The treeline appears to breathe with the
seasons, but the cost is one comparison per tree — the same "move a threshold, don't rebuild
the world" trick that keeps the alps smooth.

---

## 5. How it all meets in glacial Kahurangi

Load the level and the pieces click together: the land is a noise-built island with a
thin forest band; three-plus moa species aggregate into their niches (habitat stress) and
onto their favoured, browse-resistant plants (aggregation-coexistence); the forest
refuge is the one shared, interference-limited patch; the seasons slide the food and the
treeline up and down while winter sharpens competition, slows breeding, and thins the
eagles; and a four-phase objective structure asks you to grow two vulnerable founders and
walk them through two glacial winters. Theoretical ecology, a moving climate, steering
agents, and a generated landscape — all reading the same handful of lerped numbers.
