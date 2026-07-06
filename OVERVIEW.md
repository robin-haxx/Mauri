# Avian Age: Mauri — Systems & Codebase Overview

A real-time ecosystem-stewardship game set in glacial-age Aotearoa New Zealand.
You play a **kaitiaki** (guardian) guiding a community of **moa** through the turning
seasons — leading them to food, protecting them from the giant **Haast's eagle
(Pouākai)**, and shaping the land with placeable plants and shelters so that each
species can thrive. You spend **Mauri** (spiritual/life energy) earned from a healthy
ecosystem. Built in plain **p5.js** (global mode); the sim runs in 2-D top-down.

This document is a map of the codebase and its core systems, written for people
picking up future tasks. A companion document, `DEVBLOG_systems.md`, digs into the
ecology and behaviour in a more narrative "how it works" style.

---

## 1. The gameplay loop

1. A level loads: it generates terrain (a heightmap classified into elevation-band
   biomes), seeds a founding moa community plus Haast's eagles, and scatters plants.
2. **Seasons cycle** (summer → autumn → winter → spring). Each season shifts where
   food grows, where snow lies, and where each moa species wants to be.
3. The player **places things** from a toolbar (food groves, shelters, nesting sites,
   waterholes, thunderstorms) to feed moa, draw them somewhere, protect them, and
   encourage breeding. Placing costs **Mauri**; a thriving ecosystem earns it back.
4. Moa forage, migrate with the seasons, flee eagles, and — when well-fed and safe —
   breed. Eagles hold a nest, hunt, feed or **starve** on their own energy, and
   **breed** when prey is plentiful — so their numbers rise and fall on their own
   rather than being dialled in.
5. The level defines **goals** (classic levels) or **phases** (the glacial level).
   Meeting them wins; losing all your moa (or, in phased levels, a protected
   population during winter) loses.

---

## 2. Runtime & tech notes (read this first)

- **p5.js global mode.** Every file is a plain `<script>` sharing one global scope.
  `index.html` fixes the **load order**; a file may reference a global defined in a
  later-loaded file as long as the reference only *executes* at runtime (during play),
  not at parse time. `mauri_sketch.js` loads **last** and owns `setup()/draw()`.
- **No modules, no build step.** Just open `index.html`. There is no bundler.
- **Delta-time.** Almost everything takes a `dt` and scales by it, so the sim is
  frame-rate independent (and fast-forward-ready).
- **Spatial grids** (`mauri_spatial.js`) back all "who's near me" queries so behaviour
  stays O(neighbours) not O(N²).
- **Line endings are CRLF** on most source files. Some tooling truncates CRLF files on
  write — if you edit programmatically, write bytes carefully and re-check the file
  ends where it should (`node --check` is a good smoke test for every `.js`).

---

## 3. Codebase map — what each file does

### Entry point & assets
- **`index.html`** — loads every script in dependency order, then `mauri_sketch.js`
  last. Pulls in `p5.js` and `p5.sound.min.js`.
- **`p5.js`, `p5.sound.min.js`** — the p5 library and its sound add-on.
- **`sprites/`, `audio/`, `typefaces/`, `style.css`** — art (moa/eagle/plant PNGs),
  sound, fonts (OpenDyslexic, GroceryRounded), and minimal CSS.

### Core engine
- **`mauri_sketch.js`** *(the brain, ~1700 lines)* — defines the global `CONFIG`
  (engine constants + level-variable params), the base `PLACEABLES`, `BIOMES` and
  `PLANT_TYPES` tables, the `MauriManager` (economy), and the `Game` class that ties
  everything together: `loadLevel()`, `init()`, the per-frame `update()`, goal/phase
  checking (`checkGoals` / `_checkPhases`), placement (`tryPlace`), rendering, and
  input (`handleKey`). Also holds `applyLevelToConfig()` and the opt-in
  `LEVEL_MECHANICS` / `FOREST_BIOMES` globals. p5's `setup/draw/keyPressed` live at the
  bottom.
- **`mauri_registry.js`** — `REGISTRY`: registers animal *types* (moa, eagle) and their
  *species* configs, and constructs animals by key (`createAnimal`,
  `createRandomOfType`). The decoupling that lets a level pick which species exist.
- **`mauri_spatial.js`** — `SpatialGrid`: a uniform bucket grid with
  `insert/clear/getInRadius/getClosest`. One grid per entity kind.
- **`mauri_simulation.js`** — `Simulation`: owns all entity lists (`moas`, `eagles`,
  `plants`, `eggs`, `placeables`, and generic `otherEntities`), the spatial grids,
  spawning/seeding (`init`, `_spawnDistributedMoas`, `spawnEagle`), the master
  `update()` loop, z-ordered `render()`, cached population counts, per-species stats &
  stability timers, and `getSummary()` for the UI. For eagles it owns the
  **emergent population** plumbing — nest placement (`_assignEagleNest`), eagle-egg
  hatching (`_hatchEagleEgg`), death/cleanup and the alive count (`onEagleDeath`,
  `countAliveEagles`). The old top-down **predator–prey coupling** (`regulateEagles`)
  is retained for levels that don't opt into emergent eagles.

### Data definitions
- **`mauri_species_data.js`** — `MOA_SPECIES` and `EAGLE_SPECIES` dictionaries (size,
  speed, hunger, habitat niche, temperament, seasonal modifiers, per-genus **tint**,
  special abilities) and `registerAllSpecies()`.
- **`mauri_entity_sprites.js`** — `EntitySprites` (moa/eagle frame selection &
  animation) and `SpriteAngle` (facing/mirroring with hysteresis).

### Terrain & seasons
- **`mauri_terrain.js`** — `TerrainGenerator`: builds the heightmap (fractal + ridge
  noise, island falloff or lake basins), classifies each cell into an elevation-band
  biome, exposes `getElevationAt / getBiomeAt / isWalkable / canPlace`, and **pre-bakes
  one terrain image per season** (snow blended in) so season changes are a cheap
  cross-fade, not a recompute. Owns the dynamic **snow line**.
- **`mauri_seasons.js`** — `SEASONS` table + `SeasonManager`: advances the season
  clock, produces smoothly-lerped modifiers (per-biome plant growth, per-plant-type
  growth, preferred elevation, hunger, snow line, dormancy), the migration-message
  helpers, and the **forest band** used by forest contraction.

### Entities / ecology
- **`mauri_boid.js`** — `Boid` base: Reynolds-style steering (`separate/align/cohesion/
  seek/flee/wander/avoidUnwalkable/edges`) with delta-time integration and reusable
  vectors.
- **`mauri_moa.js`** — `Moa extends Boid`: per-species config, ageing, hunger drive, a
  behaviour **state machine** (idle/forage/flee/migrate/seek-mate/mate), foraging &
  plant selection, eagle avoidance, **same-species-biased mating**, pregnancy/egg
  laying, seasonal **migration**, and rendering with the species tint. Also the opt-in
  **habitat-stress** and **forest-competition/favoured-plant** hooks.
- **`mauri_eagle.js`** — `HaastsEagle extends Boid`: a patrol → hunt → rest state
  machine with lead-prediction swoops and prey-size preference. Under the opt-in
  **emergent** model it also holds a fixed **nest** (a crag/eyrie it orbits and
  returns to), carries an **energy budget** that can **starve** it when prey is
  scarce, ages to **maturity**, and **lays an egg in its nest** with a varied,
  prey-driven **reproduction** drive (`_tryReproduce`). So a level's eagle
  population is an emergent outcome of individual births and deaths.
- **`mauri_egg.js`** — `Egg`: incubates in place (faster near a nest), then hatches the
  parent's species.
- **`mauri_plant.js`** — `Plant`: growth / consumption / regrowth, seasonal + dormancy
  states, **forest-contraction suppression**, `favouredSpecies` tagging, and rendering
  (sprite / pre-rendered kawakawa buffer / generic blob). Also `PLANT_TYPE_ID`,
  `FOREST_TREES`, and the shared `PlantStatics`.
- **`mauri_placeable.js`** — `PlaceableObject`: the player's tools (feeding groves,
  favoured-plant stands, fern shelter, nest, waterhole, thunderstorm). Spawns child
  plants, applies seasonal bonuses, species-selective attraction, and its own visuals
  (incl. the animated storm).

### UI / meta
- **`mauri_UI.js`** — `GameUI`: top bar (Mauri, season, timer), sidebar (goals panel,
  event log, **population panel**, minimap), the **level-scoped toolbar/palette**,
  placement preview, and tooltips.
- **`mauri_menu_art.js`** — `MenuArt`: loads & lays out a level's start-screen
  illustration (with graceful fallback if art is missing).
- **`mauri_tutorial.js`** — `TutorialManager` + `TutorialUIMapper` + the default
  `TUTORIAL_TIPS`: a trigger-driven tip system (event / immediate / time / condition),
  UI highlighting, pause-on-tip, and **per-level tip sets** (`setLevelTips`).
- **`mauri_audio.js`** — `audioManager`: ambience and one-shot SFX (feeding, mating,
  eagle catch, season change, milestones, tutorial, win/loss).

### Level system
- **`mauri_level_format.js`** — `LEVEL_REGISTRY` (register/get/order/unlock),
  `LEVEL_DEFAULTS`, `resolveLevelDef()` (merge defaults + resolve the level's placeable
  overrides onto the base `PLACEABLES`), and a `validate()` sanity-checker.
- **`mauri_progress.js`** — `PROGRESS`: localStorage persistence of unlocked/completed
  levels and best scores.
- **`levels/level_01_kahurangi.js`** — intro level, single species (upland moa),
  classic static goals.
- **`levels/level_02_glacial_kahurangi.js`** — the glacial-maximum level: multi-species
  habitat balance, a **4-phase** structure, favoured plants, and a full seasonal
  tutorial. Most of the opt-in mechanics were built for this level.
- **`levels/level_03_alpine_lakes.js`** — inland multi-species balance level (with weka
  & kea as extra entity types).

---

## 4. Core systems in detail

### 4.1 CONFIG and level application
`CONFIG` (in `mauri_sketch.js`) splits into *engine constants* (layout, zoom baseline,
colours) and *level-variable params* (terrain noise, economy, populations). When a
level loads, `applyLevelToConfig(levelDef)` copies the level's `terrain`, `economy`,
`initialEntityCounts`, optional `zoom`, and `startSeason` onto `CONFIG`, and installs
the level's `mechanics` into the global `LEVEL_MECHANICS` (and `FOREST_BIOMES`). Levels
that omit a field fall back to `LEVEL_DEFAULTS`.

### 4.2 The opt-in `LEVEL_MECHANICS` system
Rather than hard-coding special behaviour, gameplay hooks read a global
`LEVEL_MECHANICS` object populated from `levelDef.mechanics`. If a level doesn't set a
flag, the hook is inert — so **existing levels are unaffected** by new mechanics. Flags
currently understood: `habitatStress` (+ margin/penalty/`winterStressMult`),
`forestCompetition` (+ radius/tolerance/penalty/`winterCompetitionMult`, `forestBiomes`),
`unfavouredBrowsePenalty`, `winterBreedingCooldownMult`, `emergentEagles`
(+ `eagleTargetRatio` — the main knob, ~`1/6` — plus `eagleMaxPopulation`,
`eagleHungerRate`, `eagleStarveThreshold`/`eagleStarveTimeout`, `eagleReproChance`/
`eagleReproCooldown`/`eagleReproCheckInterval`, `eagleMaturityAge`), the legacy
`eaglePreyCoupling` (+ `eaglesPerMoa`/min/max/interval), and `forestContraction`
(+ `forestBand`/`forestBandBySeason`). This is the main extension pattern — add a flag,
read it behind a `typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.x` guard.

### 4.3 Goals vs. Phases
Classic levels list `goals` (each `{ name, condition(sim, game), reward }`); the level
is **won** when all are achieved. The glacial level instead defines `phases` — an
ordered list of 2-season chunks, each with soft growth `goals`, an optional `survive`
objective, and an optional `fail(sim, game)` loss condition. `Game._checkPhases()`
advances phases by `playTime`, rewards growth objectives as they're met, marks survival
objectives complete when a phase ends, fails the run on a phase's `fail`, and **wins**
when you reach the end of the final phase. `game.goals` is rebuilt per phase so the UI
just renders the current objectives.

### 4.4 The Mauri economy
`MauriManager` tracks the currency: earned from moa eating, eggs laid/hatched,
population milestones, and completing goals; spent on placeables. It also fires
population-milestone bonuses and (where a level uses them) eagle-spawn milestones, and
manages floating "+N" text.

### 4.5 Seasons
`SeasonManager` runs a four-season loop of length `economy.seasonDuration`. The last
15% of each season is a **transition** window; every modifier getter lerps from the
current season to the next across it, so plant growth, preferred elevation, the snow
line, and the forest band all glide rather than snap.

### 4.6 Plants
Plants are depletable food patches: they grow to full, are eaten to nothing
(`consume()`), then regrow on a timer. Their productivity is scaled by season (per
biome and per plant type), they can go **dormant** at the wrong elevation for the
season, and forest trees can be **suppressed** (wilted, zero-nutrition) by forest
contraction. Placeables can spawn plants tagged with a `favouredSpecies`.

### 4.7 Placeables & the toolbar
The toolbar renders the **current level's** placeables (from `levelDef.availablePlaceables`,
resolved onto the base `PLACEABLES` by `resolveLevelDef`), in the level's order, with
number-key shortcuts. Placement checks terrain (`canPlace`), spacing, and — if the
placeable defines `allowedBiomes` — habitat suitability. Storm has a placement cooldown.

### 4.8 Tutorial
`TutorialManager` shows tips driven by triggers: `EVENT` (game start, season change,
etc., optionally filtered by a `condition(game, data)`), `IMMEDIATE` (chained via
`nextTip`), `TIME` (delay after start), and `CONDITION` (polled). Tips can highlight a
named UI element — including a toolbar button by placeable key (`tool:<key>`), which
resolves against the level's palette — and can pause the game. A level supplies its own
tip set via `tutorial.tips`; otherwise the default `TUTORIAL_TIPS` is used.

---

## 5. Extending the game (common tasks)

- **Add a level:** create `levels/level_XX_name.js`, define the level object, call
  `LEVEL_REGISTRY.register(...)`, and add a `<script>` to `index.html` in the desired
  order. Include `biomes`, `species`, `economy`, `availablePlaceables`, and either
  `goals` or `phases`. Set `unlockCondition` (or `null`).
- **Add a moa species:** add an entry to `MOA_SPECIES` (niche via `preferredElevation`,
  a `tint`, seasonal modifiers, any special ability), then reference its key in a
  level's `species.moa` / `initialSpeciesDistribution`.
- **Add a plant:** add to `PLANT_TYPES` (in `mauri_sketch.js`), give it a `PLANT_TYPE_ID`
  (in `mauri_plant.js`), optionally add per-season `plantTypeModifiers`, and list it in
  a biome's `plantTypes` (natural) or a placeable's `plantType` (planted).
- **Add a placeable:** add to `PLACEABLES` (behaviour + `allowedBiomes`/`favouredSpecies`
  if relevant), then list its key + cost in a level's `availablePlaceables`.
- **Add a mechanic:** read a new `LEVEL_MECHANICS.<flag>` behind a `typeof` guard in the
  relevant system, and set it in a level's `mechanics`.

---

## 6. Gotchas / constraints

- **Load order matters.** New globals used at parse time must be defined by an
  earlier-loaded script; runtime-only references are fine.
- **CRLF truncation.** Prefer byte-safe writes and verify each `.js` with `node --check`
  after edits.
- **Untuned balance.** Populations, mechanic strengths, and pacing are playtest knobs,
  not settled numbers — most live in level `economy`/`mechanics` for easy tweaking.
- **Placeholder art.** Several plants and all species share/placeholder sprites; species
  currently differ by a render **tint** rather than unique PNGs.

---

## 7. Glossary (te reo Māori)

**Mauri** — life force / spiritual energy (the currency). **Kaitiaki** — guardian /
steward (the player). **Pouākai** — the Haast's eagle. **Moa** — the giant flightless
birds you tend. **Tāwhirimātea** — atua (deity) of weather; invoked by the storm tool.
**Harakeke** — flax. **Kawakawa**, **rimu**, **tawhai** (beech), **pātōtara**,
**horoeka** (lancewood), **taramea** (speargrass), **tūmatakuru** (matagouri) — plants.
**Te Waipounamu** — the South Island.
