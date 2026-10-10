# Avian Age: Mauri; Systems & Codebase Overview

A real-time ecosystem-stewardship game set in glacial-age Aotearoa New Zealand.
You play a **kaitiaki** (guardian) guiding a community of **moa** through the turning
seasons; leading them to food, protecting them from the giant **Haast's eagle
(Pouākai)**, and shaping the land with placeable plants and shelters so that each
species can thrive. You spend **Mauri** (spiritual/life energy) earned from a healthy
ecosystem. Built in plain **p5.js** (global mode); the sim runs in 2-D top-down and is
drawn on the GPU as a tilted 3-D relief (`?render=2d`, or a lost WebGL context, falls back
to a flat Canvas2D view).

This document is a map of the codebase and its core systems, written for people
picking up future tasks. The other docs:

- `DEVBLOG_systems.md`: the ecology and behaviour, as a narrative "how it works".
- `FREEPLAY_PLAN.md`: Free Play's design and its ecology grounding.
- `YEARS_PLAN.md`: Free Play's year structure, kea cascade and world grid (the living plan).
- `GL_PORT.md` / `PERF_ASSESSMENT.md`: the GPU renderer, and where frame time goes.
- `MISTAKES.md`: things that went wrong, and the rule that stops a repeat.

---

## 1. The gameplay loop

1. A level loads: it generates terrain (a heightmap classified into elevation-band
   biomes), seeds a founding moa community plus Haast's eagles, and scatters plants.
2. **Seasons cycle** (summer → autumn → winter → spring). Each season shifts where
   food grows, where snow lies, and where each moa species wants to be.
3. The player **places things** from a toolbar (food groves, shelters, nesting sites,
   waterholes, thunderstorms) to feed moa, draw them somewhere, protect them, and
   encourage breeding. Placing costs **Mauri**; a thriving ecosystem earns it back.
4. Moa forage, migrate with the seasons, flee eagles, and; when well-fed and safe;
   breed. Eagles hold a nest, hunt, feed or **starve** on their own energy, and
   **breed** when prey is plentiful; so their numbers rise and fall on their own
   rather than being dialled in.
5. The level defines **goals** (classic levels), **phases** (the glacial level), a
   **story** (module levels) or **yearly goals** (Free Play, which never wins). Meeting
   them wins; losing all your moa (in Free Play, any of the year's focus species) loses.

---

## 2. Runtime & tech notes (read this first)

- **p5.js global mode.** Every file is a plain `<script>` sharing one global scope.
  `index.html` fixes the **load order**; a file may reference a global defined in a
  later-loaded file as long as the reference only *executes* at runtime (during play),
  not at parse time. `mauri_sketch.js` loads **last** and owns `setup()/draw()`.
- **No modules, no bundler in development.** Serve the folder (`node tools/serve.js`, port
  8081) and open `index.html`. `dist/` holds a minified release build.
- **Delta-time.** Almost everything takes a `dt` and scales by it, so the sim is
  frame-rate independent (fast-forward runs the sim twice per frame).
- **Spatial grids** (`mauri_spatial.js`) back all "who's near me" queries so behaviour
  stays O(neighbours) not O(N²).
- `node --check` is a good smoke test for every `.js` after an edit; a runtime typo only
  shows up by running the game (see `MISTAKES.md`).

---

## 3. Codebase map; what each file does

### Entry point & assets
- **`index.html`**; loads every script in dependency order, then `mauri_sketch.js`
  last. Pulls in `p5.js` and `p5.sound.min.js`.
- **`p5.js`, `p5.sound.min.js`**; the p5 library and its sound add-on.
- **`sprites/`, `audio/`, `typefaces/`, `style.css`**; art (moa/eagle/plant PNGs),
  sound, fonts (OpenDyslexic, FreckleFace, GroceryRounded), and minimal CSS.

### Core engine
- **`mauri_sketch.js`** *(the brain, ~6,400 lines)*; defines the global `CONFIG`
  (engine constants + level-variable params), the base `PLACEABLES`, `BIOMES` and
  `PLANT_TYPES` tables, the `MauriManager` (economy), and the `Game` class that ties
  everything together: `loadLevel()`, `init()`, the per-frame `update()`, goal/phase
  checking (`checkGoals` / `_checkPhases`, and Free Play's year engine
  `_beginFreeplayYear` / `_checkFreeplayYear`), placement (`tryPlace`), the nest-raid
  panel, the camera, rendering, menus, and input (`handleKey`). Also holds
  `applyLevelToConfig()`, the opt-in `LEVEL_MECHANICS` / `FOREST_BIOMES` globals, and the
  renderer / performance-mode switches. p5's `setup/draw/keyPressed` live at the bottom.
- **`mauri_registry.js`**; `REGISTRY`: registers animal *types* (moa, eagle) and their
  *species* configs, and constructs animals by key (`createAnimal`,
  `createRandomOfType`). The decoupling that lets a level pick which species exist.
- **`mauri_spatial.js`**; `SpatialGrid`: a uniform bucket grid with
  `insert/clear/getInRadius/getClosest`. One grid per entity kind.
- **`mauri_simulation.js`**; `Simulation`: owns all entity lists (`moas`, `eagles`,
  `plants`, `eggs`, `placeables`, and generic `otherEntities`), the spatial grids,
  spawning/seeding (`init`, `_spawnDistributedMoas`, `spawnEagle`), the master
  `update()` loop, z-ordered `render()`, cached population counts, per-species stats &
  stability timers, and `getSummary()` for the UI. For eagles it owns the
  **emergent population** plumbing; nest placement (`_assignEagleNest`), eagle-egg
  hatching (`_hatchEagleEgg`), death/cleanup and the alive count (`onEagleDeath`,
  `countAliveEagles`). The old top-down **predator–prey coupling** (`regulateEagles`)
  is retained for levels that don't opt into emergent eagles.

### Data definitions
- **`mauri_species_data.js`**; `MOA_SPECIES` and `EAGLE_SPECIES` dictionaries (size,
  speed, hunger, habitat niche, temperament, seasonal modifiers, per-genus **tint**,
  special abilities) and `registerAllSpecies()`.
- **`mauri_entity_sprites.js`**; `EntitySprites` (moa/eagle frame selection &
  animation) and `SpriteAngle` (facing/mirroring with hysteresis).

### Terrain & seasons
- **`mauri_terrain.js`**; `TerrainGenerator`: builds the heightmap (fractal + ridge
  noise, island falloff or lake basins), classifies each cell into an elevation-band
  biome, and exposes `getElevationAt / getBiomeAt / isWalkable / canPlace`. On a
  `worldGrid` level it generates one continuous land several windows wide and pans the
  window across it (`panToArea`). Owns the dynamic **snow line**. Flat per-season images
  are baked only when the flat 2D view needs them.
- **`mauri_seasons.js`**; `SEASONS` table + `SeasonManager`: advances the season
  clock, produces smoothly-lerped modifiers (per-biome plant growth, per-plant-type
  growth, preferred elevation, hunger, snow line, dormancy), the migration-message
  helpers, and the **forest band** used by forest contraction. Folds Free Play's
  `coldIndex` into the winter end of its getters.
- **`mauri_climate_drift.js`**; `ClimateDrift`: Free Play's deepening-glacial curve, one
  pure function of the year count.

### Entities / ecology
- **`mauri_boid.js`**; `Boid` base: Reynolds-style steering (`separate/align/cohesion/
  seek/flee/wander/avoidUnwalkable/edges`) with delta-time integration and reusable
  vectors.
- **`mauri_moa.js`**; `Moa extends Boid`: per-species config, ageing, hunger drive, a
  behaviour **state machine** (idle/forage/flee/migrate/seek-mate/mate), foraging &
  plant selection, eagle avoidance, **same-species-biased mating**, pregnancy/egg
  laying, seasonal **migration**, and rendering with the species tint. Also the opt-in
  **habitat-stress** and **forest-competition/favoured-plant** hooks.
- **`mauri_eagle.js`**; `HaastsEagle extends Boid`: a patrol → hunt → rest state
  machine with lead-prediction swoops and prey-size preference. Under the opt-in
  **emergent** model it also holds a fixed **nest** (a crag/eyrie it orbits and
  returns to), carries an **energy budget** that can **starve** it when prey is
  scarce, ages to **maturity**, and **lays an egg in its nest** with a varied,
  prey-driven **reproduction** drive (`_tryReproduce`). So a level's eagle
  population is an emergent outcome of individual births and deaths.
- **`mauri_egg.js`**; `Egg`: incubates in place (faster near a nest), then hatches the
  parent's species.
- **`mauri_kereru.js`**; `Kereru`, the base class for every flighted bird (hop to a
  fruiting tree, feed, perch, disperse seed, breed). **`mauri_kea.js`**,
  **`mauri_kaka.js`**, **`mauri_kakapo.js`** and **`mauri_kokako.js`** extend it (kea
  follow Berry Caches and perch by moa nests; kākāpō breed only in mast years).
- **`mauri_nesting.js`**; `NestingSite`: a moa nest that eggs cluster into, eagles patrol
  and kea raid. In Free Play the player founds them by planting the focus moa's favoured
  plant (`Simulation._updateMoaNestingFormation`).
- **`mauri_plant.js`**; `Plant`: growth / consumption / regrowth, seasonal + dormancy
  states, **forest-contraction suppression**, Free Play's winter edibility floor,
  `favouredSpecies` tagging, and rendering (sprite / portrait sprite / pre-rendered
  kawakawa buffer / generic blob). Also `PLANT_TYPE_ID`, `FOREST_TREES`, and the shared
  `PlantStatics`.
- **`mauri_placeable.js`**; `PlaceableObject`: the player's tools (feeding groves,
  favoured-plant stands, fern shelter, waterhole, storm, Berry Cache, Forest Seed). Spawns
  child plants, applies seasonal bonuses, species-selective attraction, and its own visuals
  (incl. the animated storm). Module levels also use *standing* storms (`makeStanding`:
  placed by the level, never blow out until told to `fadeOver`).
- **`mauri_module.js`**; module levels' story code, kept apart from everything else:
  `ModuleDirector` (runs a level's `story` season by season: sites, goals, prompts, win
  and loss, the "Continue" outro), `MoaLife` (a family moa's brain) and `EagleLife` (a
  scripted eagle). A moa or eagle with a `lifeScript` skips its normal behaviour (one-line
  hooks at the top of `Moa.behave` and `HaastsEagle.behave`). **`mauri_module_patotara.js`**
  adds Module 1's `PatotaraDirector` and the scripted kea (`KeaLife`).
  **`mauri_module_freeplay.js`** adds `FreePlayDirector`, the five years after Module 1
  (see the module levels below), and `BIRD_CALENDAR`, each species' breeding year.

### Rendering
- **`mauri_projection.js`**; the plan-oblique "3D" mapping (world point + elevation →
  screen) that the relief and every billboarded sprite share.
- **`mauri_glterrain.js`**; the GPU terrain mesh, water and lighting.
  **`mauri_glbatch.js`** + **`mauri_spriteatlas.js`**; the GL sprite layer and its atlas.
  See `GL_PORT.md`.

### UI / meta
- **`mauri_UI.js`**; `GameUI`: the dials (season ring, and Free Play's avg-pop dial,
  top-right next to the goals; the Mauri dial just left of the toolbar buttons), sidebar
  (goals panel, event log, **population panel**, minimap), the **level-scoped
  toolbar/palette**, placement preview, and tooltips.
- **`mauri_menu_art.js`**; `MenuArt`: loads & lays out a level's start-screen
  illustration (with graceful fallback if art is missing).
- **`mauri_tutorial.js`**; `TutorialManager` + `TutorialUIMapper` + the default
  `TUTORIAL_TIPS`: a trigger-driven tip system (event / immediate / time / condition),
  UI highlighting, pause-on-tip, and **per-level tip sets** (`setLevelTips`).
- **`mauri_audio.js`**; `audioManager`: ambience and one-shot SFX (feeding, mating,
  eagle catch, season change, milestones, tutorial, win/loss, character calls).
  `mauri_audio_context.js` pins the audio context's sample rate and latency (loads before
  p5.sound).
- **`mauri_encyclopedia.js`**; the gamewide Field Guide (**E**).
- Debug tools: **`mauri_lens.js`** (world-space overlays of hidden sim state, **L** in
  debug mode) and **`mauri_benchmark.js`** (population CSV recorder, armed from the level
  splash in debug mode).

### Level system
- **`mauri_level_format.js`**; `LEVEL_REGISTRY` (register/get/order/unlock),
  `LEVEL_DEFAULTS`, `resolveLevelDef()` (merge defaults + resolve the level's placeable
  overrides onto the base `PLACEABLES`), and a `validate()` sanity-checker.
- **`mauri_progress.js`**; `PROGRESS`: localStorage persistence of unlocked/completed
  levels and best scores.
- **`levels/level_01_kahurangi.js`** and **`levels/level_02_glacial_kahurangi.js`**; the
  original prototypes. Level 1 is the single-species intro with classic static goals;
  Level 2 is the glacial-maximum level (multi-species balance, a **4-phase** structure,
  favoured plants). Most of the opt-in mechanics were first built for Level 2.
  (`level_03_alpine_lakes.js` is commented out and not registered.)
- **`levels/level_freeplay_kahurangi.js`**; Free Play (*Mutunga-kore*), the endless mode.
  A four-year loop of focus species across a 2×2 world grid, a deepening glacial climate,
  per-year toolbars. See `FREEPLAY_PLAN.md` and `YEARS_PLAN.md`.
- **`levels/tutorial_*.js`**; each level's tips. The modules share a kit
  (`tutorial_module_kit.js`: dialogue scenes, "do this" banners) and Te Whē's opening and
  closing words (`tutorial_module_bookends.js`).
- **Module levels** (`module: true`, numbered by `moduleIndex`): small scripted lessons
  that follow a few birds closely through a year, each built around one tool. The level select
  draws them as a row of small buttons above the main cards (`Game._renderModuleRow`,
  labelled by `menu.moduleLabel`). A module level has a `story` block, run by
  `ModuleDirector` (`mauri_module.js`), which sets its own goals per season.
  **`levels/module_00_storms.js`** (Module 0, *Āwhā*): one upland moa family's year, with
  the Storm as the only tool (a moa under a storm can't be seen by the eagle; one caught in
  the open runs, and its safety bar drains). Summer at the nest, an autumn walk down to a
  tarn along a path of storms (a lighter worn trail in the terrain shows the way), winter
  by the water, spring back up; "Continue" walks them off north and pans to the next
  world-grid area, where the next module will be. Its land is the middle-right area of a
  2×3 world grid (the areas above and below are generated too), with
  `terrain.elevationWindow` fitting its heights to tussock/forest/scree on any seed; the
  director adds a tarn and the trail as terrain `features`. The toolbar Storm stays locked
  (greyed) until the story's `new_storm` moment (`story.lockedTools`, `Game.unlockTool`).
  Module levels show one goal at a time ("GOAL:", ticking off then fading into the next).
  Its prompts are tutorial tips keyed to the story's moments
  (`TUTORIAL_EVENTS.MODULE_BEAT`) in `levels/tutorial_module_00_storms.js` (scenes of
  dialogue, each line opening on its speaker's call, and big-text banners for "do this").
  **`levels/module_01_patotara.js`** (Module 1, *Pātōtara*; `PatotaraDirector` in
  `mauri_module_patotara.js`) carries straight on from Module 0's "Continue" on the same
  land: the next module loads behind a still of the last frame and fades in over it (no
  loading screen). Module buttons skip the level splash. The first module opens on black
  with Te Whē's welcome, and the last (no `story.nextModule` after it) fades to black for
  Te Whē's farewell before its win card (`levels/tutorial_module_bookends.js`, added to
  every module's tips). A module's win card shows "Next up": the next module's
  `menu.focusItem` (a placeable's picture and name).
  **`levels/module_freeplay.js`** (*Pukepuke & Koukou*, the ∞ "Free Play" button after the
  modules; `FreePlayDirector` in `mauri_module_freeplay.js`) is the free play of the
  modules' world: Module 1's win card offers "Continue" into it (`story.continueTo`,
  `ModuleDirector.beginContinue`: same land and area, with both families, the storms, the
  food patches (sprouted or not) and the mauri carried over), or it starts on fresh land from
  the menu. Seasons are 30 s. Each year the two families summer at their nests, walk down a
  storm path together to the waterhole in autumn, winter there and walk home in spring. Keep
  Pukepuke and Koukou safe for five years and it's won: the camera closes in as they grow to
  full size and mate at a nest of their own (`_beginEnding`), then Te Whē's last words. Wild
  tussock barely feeds the families, so hungry ones walk to the (sprouted) pātōtara and
  wharariki the player grows; a well-fed pair lays one egg in summer, once its last chick is
  two. The Pouākai is hunger-driven and takes whatever it can see: a storm hides the moa under
  it, so the eagle turns to another moa (the giant moa of the low ground) or a bird. Kea, kākā,
  kōkako and giant moa breed in their own seasons, a clutch a year (`BIRD_CALENDAR`;
  `mechanics.seasonalBirdBreeding` and `matingAge: Infinity` switch off their own breeding),
  and every one adds to the mauri income. The Pouākai taking Pukepuke or Koukou ends it. Tips
  (`levels/tutorial_module_freeplay.js`) are minimal: Te Whē's five-year goal and the screen's
  essentials, then non-pausing prompts for the essential actions, at once in year 1 and after
  that only once one has gone 10 s undone (`FreePlayDirector._updateNeeds`).

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
flag, the hook is inert; so **existing levels are unaffected** by new mechanics. The
`mechanics` blocks in the level files are the reference for what exists, with a comment
per flag; Free Play's (`level_freeplay_kahurangi.js`) is the fullest. The main families
are habitat stress and forest competition, emergent eagles (`eagleTargetRatio` is the
main knob), forest contraction, Free Play's climate (`climateDrift`, `winterInedibility`,
`coldToleranceMatters`), its year engine (`freeplay*`), the kea cascade and nesting sites.
(Module levels don't use flags for their story; see `mauri_module.js`.) This is the main
extension pattern; add a flag, read it behind a
`typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.x` guard.

### 4.3 Goals, phases, stories and years
Module levels hand the whole job to their director (`checkGoals` returns early). Free
Play (`endless: true`) never wins: `_checkFreeplayYear` sets each year's goals for its
focus species, and the run is lost when any focus species dies out.
Classic levels list `goals` (each `{ name, condition(sim, game), reward }`); the level
is **won** when all are achieved. The glacial level instead defines `phases`; an
ordered list of 2-season chunks, each with soft growth `goals`, an optional `survive`
objective, and an optional `fail(sim, game)` loss condition. `Game._checkPhases()`
advances phases by `playTime`, rewards growth objectives as they're met, marks survival
objectives complete when a phase ends, fails the run on a phase's `fail`, and **wins**
when you reach the end of the final phase. `game.goals` is rebuilt per phase so the UI
just renders the current objectives.

### 4.4 The Mauri economy
`MauriManager` tracks the currency: earned from moa eating, eggs laid/hatched,
population milestones, and completing goals; spent on placeables and on moving them. It
also fires population-milestone bonuses and (where a level uses them) eagle-spawn
milestones, and manages floating "+N" text. Free Play's main income is passive instead:
average population × how evenly balanced the species are (`mechanics.freeplayPassive`).
Module levels pay a small steady income while the family lives, plus each goal.

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

Placed food is worth two things to a moa: the food in its plants (`PLANT_TYPES[*].nutrition`)
and a steady feed while it stands in the patch (`baseFeedingRate`, per frame). The ladder
is deliberate (2026-10-09):

| Placed food | Plant nutrition | Feed rate | Why |
|---|---|---|---|
| Pātōtara | 42 | 0.18 | Rich summer berries for any moa, but they draw kea, and there are none in winter |
| Kawakawa | 40 | 0.20 | Free Play's first-year food; frost kills it at the first winter |
| Wharariki | 32 | 0.15 | Hardy food for any moa that keeps a little value in winter |
| Lancewood / speargrass | 26 / 24 | 0.08 | Modest; their worth is drawing one species and founding its nests |
| Fern shelter | none | 0.015 | Cover, not food: a sheltering moa still gets hungry |

### 4.7 Placeables & the toolbar
The toolbar renders the **current level's** placeables (from `levelDef.availablePlaceables`,
resolved onto the base `PLACEABLES` by `resolveLevelDef`), in the level's order
(`paletteOrder`, else grouped by fauna), with number-key shortcuts. Free Play swaps the
palette each year. Placement checks terrain (`canPlace`), spacing, and; if the
placeable defines `allowedBiomes`; habitat suitability. Storm has a placement cooldown.
A placed item can be pressed, held and dragged to move it, for `moveCost` (default: half
its cost). A `global` tool acts without a map spot (Mast, Rimu Berry Scramble), and one
with `opensDialog` opens a panel instead (Nest Raid). A module can grey a tool out until
a story moment (`story.lockedTools`).

### 4.8 Tutorial
`TutorialManager` shows tips driven by triggers: `EVENT` (game start, season change,
etc., optionally filtered by a `condition(game, data)`), `IMMEDIATE` (chained via
`nextTip`), `TIME` (delay after start), and `CONDITION` (polled). Tips can highlight a
named UI element; including a toolbar button by placeable key (`tool:<key>`), which
resolves against the level's palette; and can pause the game. A level supplies its own
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
- **Release build.** The minified build drops `console.log` calls, so never do work
  inside one.
- **Untuned balance.** Populations, mechanic strengths, and pacing are playtest knobs,
  not settled numbers; most live in level `economy`/`mechanics` for easy tweaking.
- **Placeholder art.** The upland and little bush moa have their own sprites; the other
  moa share one, told apart by a render **tint**. Some plants (matagouri, toatoa,
  pōhuehue) still draw as generic shapes, and wharariki borrows the flax sprites.

---

## 7. Glossary (te reo Māori)

**Mauri**; life force / spiritual energy (the currency). **Kaitiaki**; guardian /
steward (the player). **Pouākai**; the Haast's eagle. **Moa**; the giant flightless
birds you tend. **Tāwhirimātea**; atua (deity) of weather; invoked by the storm tool.
**Harakeke**; flax. **Wharariki**; mountain flax. **Kawakawa**, **rimu**, **tawhai**
(beech), **pātōtara**, **horoeka** (lancewood), **taramea** (speargrass), **tūmatakuru**
(matagouri); plants. **Āwhā**; storm (Module 0's name). **Te Whē**; the mantis guide.
**Te Waipounamu**; the South Island.
