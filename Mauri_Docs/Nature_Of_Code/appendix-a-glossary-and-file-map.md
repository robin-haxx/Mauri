# Appendix A: Glossary and File Map

A reference to keep open while you work. Four parts: the files, the units and key numbers, the programming terms used in this guide, and the te reo Māori used in the game.

## 1. File Map

Every source file, what it holds, and the chapter that explains it. Files load in the order `index.html` lists them; `mauri_sketch.js` is last.

### Entry point

| File | Holds | Chapter |
|---|---|---|
| `index.html` | The script tags, in load order | 1 |
| `mauri_sketch.js` | `CONFIG`, `PLACEABLES`, `BIOMES`, `PLANT_TYPES`, `MauriManager`, the `Game` class, `preload`/`setup`/`draw`, input handlers, `applyLevelToConfig`, `initializeRegistry`, `LEVEL_MECHANICS` | 1, 11, 12, 15 |
| `style.css` | A few lines of page styling | — |
| `p5.js`, `p5.sound.min.js` | The p5 library and its sound add-on | — |

### Simulation core

| File | Holds | Chapter |
|---|---|---|
| `mauri_simulation.js` | `Simulation`: entity lists, spatial grids, spawning, the master `update`, eggs and hatching, catches, cleanup, population cache, nesting sites, disturbance field, seed dispersal, the layered and depth-sorted `render` | 1, 3, 6, 8, 9, 10, 15 |
| `mauri_spatial.js` | `SpatialGrid` | 3 |
| `mauri_registry.js` | `REGISTRY`: animal types, species, the factory | 12 |
| `mauri_boid.js` | `Boid`: position, velocity, acceleration, steering forces, facing | 2 |

### The land and its clock

| File | Holds | Chapter |
|---|---|---|
| `mauri_terrain.js` | `TerrainGenerator`: noise, height map, biome map, lookups, snow line, land regions, the world grid, terrain baking | 4, 15 |
| `mauri_seasons.js` | `SEASONS`, `SeasonManager`, migration messages | 5 |
| `mauri_climate_drift.js` | `ClimateDrift`: Free Play's year-by-year severity | 5 |
| `mauri_projection.js` | `Projection`: the plan-oblique mapping | 15 |

### Living things

| File | Holds | Chapter |
|---|---|---|
| `mauri_species_data.js` | `MOA_SPECIES`, `EAGLE_SPECIES`, species UI colours | 12 |
| `mauri_moa.js` | `Moa`: hunger, state machine, foraging, migration, mating, rendering | 7, 8 |
| `mauri_eagle.js` | `HaastsEagle`: patrol, hunt, energy budget, emergent breeding | 9 |
| `mauri_egg.js` | `Egg` | 8 |
| `mauri_plant.js` | `Plant`, `PLANT_TYPE_ID`, `FOREST_TREES`, `PlantStatics` | 6 |
| `mauri_kereru.js` | `Kereru`: the base class for all other birds; `FLYER_TYPES` | 10 |
| `mauri_kea.js`, `mauri_kaka.js`, `mauri_kakapo.js`, `mauri_kokako.js` | The four birds that extend `Kereru` | 10 |
| `mauri_nesting.js` | `NestingSite` | 10, 11 |
| `mauri_placeable.js` | `PlaceableObject`: the player's tools in the world | 11 |

### Story

| File | Holds | Chapter |
|---|---|---|
| `mauri_tutorial.js` | `TUTORIAL_EVENTS`, `TutorialManager`, the tip queue, UI highlighting | 14 |
| `mauri_module.js` | `ModuleDirector`, `MoaLife`, `EagleLife`, A* pathfinding, the heap | 14 |
| `mauri_module_patotara.js`, `mauri_module_freeplay.js` | Directors for the later story levels | 14 |
| `mauri_chapters.js` | `ChapterRunner`, the condition and action vocabularies, `MomentPlayer` | 14 |

### Interface and presentation

| File | Holds | Chapter |
|---|---|---|
| `mauri_UI.js` | `GameUI`: dials, toolbar, panels; `HudCache` | 11, 15 |
| `mauri_entity_sprites.js` | `EntitySprites`, `SpriteAngle`: frame selection, outlines, shadows | 15 |
| `mauri_spriteatlas.js` | `SpriteAtlas`: packing sprites into pages; the `image()` wrapper | 15 |
| `mauri_glbatch.js` | `GLBatch`: the WebGL sprite layer | 15 |
| `mauri_glterrain.js` | `GLTerrain`: the terrain mesh and its shaders | 15 |
| `mauri_menu_art.js` | `MenuArt`: level start-screen illustrations | — |
| `mauri_encyclopedia.js` | The field guide | — |
| `mauri_audio.js`, `mauri_audio_context.js` | `audioManager`: music, effects, bird calls | — |

### Levels and progress

| File | Holds | Chapter |
|---|---|---|
| `mauri_level_format.js` | `LEVEL_REGISTRY`, `LEVEL_DEFAULTS`, `resolveLevelDef`, scoring | 12 |
| `mauri_progress.js` | `PROGRESS`: saved completion and scores | 12 |
| `levels/level_*.js` | Classic levels and Free Play | 12 |
| `levels/module_*.js` | Story levels run by a director | 14 |
| `levels/chapters_*.js`, `levels/_template_chapters.js` | Chapters levels and the template | 14 |
| `levels/tutorial_*.js` | Each level's tips | 14 |

### Tools

| File | Holds | Chapter |
|---|---|---|
| `mauri_lens.js` | `Lens`: debug overlays | 3, 16 |
| `mauri_benchmark.js` | `BENCHMARK`: the population recorder | 16 |
| `tools/serve.js` | The local web server | 16 |
| `tools/validate.js` | Level validation and smoke tests | 16 |
| `tools/batch.js` | Seeded batch runs | 16 |
| `tools/build.js` | The release build | 16 |
| `tools/_headless.js` | Shared Playwright harness | 16 |

### The repository's own documents

| File | Read it for |
|---|---|
| `OVERVIEW.md` | The codebase map and extension notes |
| `DEVBLOG_systems.md` | The ecology behind the mechanics |
| `MISTAKES.md` | What went wrong and the rule each mistake taught |
| `FREEPLAY_PLAN.md`, `YEARS_PLAN.md` | Free Play's design |
| `MODULE_ENGINE_PLAN.md`, `MODULE_SCRIPTING.md` | The chapters engine: plan and full reference |
| `CHAPTERS_MODULES.md` | What each lesson teaches |
| `GL_PORT.md`, `PERF_ASSESSMENT.md` | The GPU renderer and performance findings |
| `ENGINE_ASSESSMENT.md` | A review of the scripted and emergent approaches |

## 2. Units and Key Numbers

### Units

| Quantity | Unit | Notes |
|---|---|---|
| Time | frames | 60 = one second. Multiply changes by `dt`. |
| `dt` | ideal frames | 1 at 60 fps; capped at 6 |
| Distance | world units | One pixel of the unzoomed map. A map is about 550 × 300. |
| Speed | world units per frame | A moa walks at about 0.15; an eagle hunts at 0.45 |
| Elevation | 0 to 1 | Sea floor to highest peak |
| Hunger | 0 to 100 | 0 is full. It goes **up** over time. |
| Growth (plants) | 0 to 1 | 1 is full size |
| Screen | pixels | The canvas's short edge is always 1080 |

### The frame, in order

`draw()` → measure `dt` → `game.update(dt)` → `game.render()`

Inside `game.update`: clock → climate → season → **simulation** → story → counts → income → goals → loss checks.

Inside `simulation.update`: spatial grids → plants (50 per frame) → placeables (every 2nd frame) → eggs → moa → eagles → other birds → bookkeeping → cleanup (every 512 frames).

Each animal: `behave(…, dt)` then `update(dt)`.

### Numbers worth knowing

| What | Value | Where |
|---|---|---|
| Moa starts foraging / stops | hunger 35 / 25 | `hungerThreshold`, the deadband in `determineState` |
| Moa is desperate | hunger 80 | `criticalHunger` |
| Moa hunger rate | 0.02 per frame | `baseHungerRate` |
| Moa plant search radius | 100 (150 when starving) | `findPlant` |
| Moa neighbour query | 100 | `behave` |
| Moa eat radius | 14 | `eatRadiusSq` = 196 |
| Moa breeds below | hunger 40 | `matingHungerThreshold` |
| Moa adult at | 900 frames | `MOA_AGE` |
| Watchdog gives up after | 240 frames | `forage`, `seekAttractions` |
| Eagle hunts above | hunger 45 | `huntThreshold` |
| Eagle sees prey within | 130 | `huntRadius` |
| Eagle catch radius | 12 | `catchRadius` |
| Eagle strike wind-up | 60 frames | `huntWindupDuration` |
| Eagle rest after a kill | 180 frames | `restDuration` |
| A moa kill relieves | 90 hunger | `handleEagleCatch` |
| Eagle target ratio | 1 per 6 moa (default) | `eagleTargetRatio` |
| Season transition | last 15% | `SeasonManager.update` |
| Default season length | 2100 frames | `LEVEL_DEFAULTS.economy` |
| Plant density | 0.006 per 2-unit step | `plantDensity` |
| Plant growth | 0.002 × modifier per update | `handleGrowth` |
| Spatial grid cells | moa 60, eagle 100, plant 50, placeable 80, egg 40 | `_buildSpatialGrids` |
| Storm recharge | 600 frames | `tryPlace` |
| Eating pays mauri below | 50 mauri | `eatMauriThreshold` |

These are defaults. Species, levels and mechanics flags override many of them.

### Keys

| Key | Does |
|---|---|
| Space / P | Pause |
| 1 to 9 | Select a tool |
| Esc | Cancel, or pause |
| F / V | Fullscreen layout / 3D view |
| H | Hunger bars |
| E | Field guide |
| T | Tips on or off |
| R | Restart |
| D | Debug mode |
| L | Lenses |
| J | Chapter inspector (debug mode) |
| X | Export Free Play statistics |

### URL parameters

`level`, `sketch`, `seed`, `chapter`, `bench`, `years`, `render=2d`, `perf`, `sprites`, `hudcache=0`. See Chapter 16.

## 3. Glossary of Terms

**A\*** A pathfinding algorithm that explores the cell with the lowest (cost so far + estimated cost to goal) first. *Ch. 14*

**Accumulating timer** A counter that adds `dt` each frame and triggers work when it passes a threshold, then subtracts the threshold. *Ch. 1*

**Allee effect** The tendency of a small population to decline because individuals struggle to find mates. *Ch. 8*

**Atlas** One large image holding many sprites, so they can be drawn from a single texture. *Ch. 15*

**Baking** Computing something once and storing the result (a height map, a terrain image, a sine table) so it needn't be recomputed. *Ch. 4, 15*

**Balancing loop** A feedback loop that opposes change and seeks a level. Also called negative feedback. *Ch. 13*

**Batching** Collecting many draw operations into one. *Ch. 15*

**Billboard** A sprite that stays upright and faces the viewer in a 3D-looking scene. *Ch. 15*

**Biome** In this game, a band of elevations with shared properties. *Ch. 4*

**Boid** An agent that moves by steering forces; the base class of every animal. *Ch. 2*

**Carrying capacity** The population a place can sustain. *Ch. 6, 8*

**Closure** A function that remembers variables from where it was created. *Ch. 12*

**Compaction** Removing dead items from an array in place by copying survivors down. *Ch. 8*

**Composition** Building a thing from independent capabilities, as opposed to a class hierarchy. *Ch. 11*

**Culling** Skipping the drawing of things that are off-screen. *Ch. 15*

**Deadband** The gap between a start threshold and a stop threshold. See hysteresis. *Ch. 7*

**Deep merge** Combining nested objects level by level. A shallow merge replaces whole nested values. *Ch. 12*

**Delta time (`dt`)** The time since the last frame, in ideal frames. *Ch. 1*

**Density dependence** Growth that slows as a population rises. *Ch. 8*

**Depth sorting** Drawing objects in order of distance so near ones cover far ones. *Ch. 15*

**Dirty flag** A marker that a cached or derived value is out of date. *Ch. 3*

**Domain-specific language (DSL)** A small language for one purpose, such as the chapters engine's conditions. *Ch. 14*

**Domain warping** Adding noise to a function's input coordinates to make its output irregular. *Ch. 4*

**Dot product** For two unit vectors, the cosine of the angle between them. Used for lighting and for "how aligned are these?". *Ch. 2, 15*

**Draw call** One instruction to the graphics card to draw a batch of triangles. *Ch. 15*

**Drive** An internal quantity that grows with time and motivates behaviour, such as hunger. *Ch. 7*

**Easing** Moving a value a fraction of the remaining distance each frame: `x += (target − x) × rate`. *Ch. 2*

**Emergence** A pattern of the whole arising from the rules of the parts. *Ch. 13*

**Event** A named announcement that something happened, with data. *Ch. 14*

**Exponential moving average** Easing applied to a noisy measurement to show its trend. *Ch. 15*

**Factory** A function that creates the right kind of object from a key. *Ch. 12*

**Feature flag** A switch that turns a piece of behaviour on for some configurations only. *Ch. 12*

**Feedback loop** A chain of causes that returns to affect its own starting point. *Ch. 13*

**Field (scalar field)** A number defined at every point in space, such as disturbance. *Ch. 10*

**Fixed-point iteration** Solving an equation by repeatedly feeding a guess back into it. *Ch. 15*

**Flood fill** Spreading a label from a cell to all connected cells. *Ch. 4*

**Fractal noise (fBm)** Several octaves of noise added together. *Ch. 4*

**Fragment shader** A program run for every pixel drawn, deciding its colour. *Ch. 15*

**Garbage collection** JavaScript's automatic reclaiming of unused objects, which can cause pauses. *Ch. 2*

**Getter** A method that reads like a property. *Ch. 5*

**Guard clause** An early `return` or `continue` that handles a special case and leaves. *Ch. 6*

**Headless** Running a browser with no visible window, under script control. *Ch. 16*

**Heap (binary heap)** A structure giving fast access to the smallest item; used as a priority queue. *Ch. 14*

**Height map** A grid storing an elevation for every cell. *Ch. 4*

**Heuristic** In A*, the estimate of remaining cost to the goal. *Ch. 14*

**Hook** A method a base class calls so that subclasses, or another system, can step in. *Ch. 10, 14*

**Hysteresis** Using different thresholds for switching on and switching off, to prevent chatter. *Ch. 2, 7*

**Ideal free distribution** Animals spreading across food patches in proportion to the food. *Ch. 10*

**Indirect control** Influencing agents by changing their surroundings. *Ch. 11*

**Inheritance** A class taking on the properties and methods of another with `extends`. *Ch. 10*

**Interface** The set of methods an object must offer to be used by some system. *Ch. 10*

**Jitter** A small random offset to break up regularity. *Ch. 6*

**Lacunarity** How much the frequency grows between noise octaves. *Ch. 4*

**Lens** A debug overlay that draws hidden simulation state. *Ch. 16*

**Lerp** Linear interpolation: `a + (b − a) × t`. *Ch. 5*

**Local server** A program serving files over `http://` from your own machine. *Ch. 16*

**Matrix (transform)** The six numbers that turn local coordinates into screen coordinates. *Ch. 15*

**Memoisation** Caching a result together with the inputs that produced it. *Ch. 15*

**Mesh** A surface made of triangles joined at shared vertices. *Ch. 15*

**Minify** Shrinking code by stripping whitespace and shortening names. *Ch. 16*

**Normal** A unit vector pointing straight out of a surface. *Ch. 15*

**Normalise** (a value) Rescale to the range 0 to 1. (a vector) Scale to length 1. *Ch. 5*

**Nullish coalescing (`??`)** `a ?? b` gives `b` only when `a` is `null` or `undefined`. *Ch. 6*

**Observer** The pattern in which listeners register interest in events. *Ch. 14*

**Octave** One layer of fractal noise. *Ch. 4*

**Optional chaining (`?.`)** `a?.b` gives `undefined` instead of an error when `a` is missing. *Ch. 7*

**Painter's algorithm** Drawing back to front so later things cover earlier ones. *Ch. 15*

**Persistence** How much the amplitude shrinks between noise octaves. *Ch. 4*

**Plan oblique** A map view in which elevation is shown by shifting points up the screen. *Ch. 15*

**Polymorphism** Calling the same method on objects of different classes and getting each one's own behaviour. *Ch. 10*

**Priority cascade** A state machine that asks questions in order and takes the first yes. *Ch. 7*

**Priority queue** A queue that returns the highest-priority item first. *Ch. 14*

**Pseudo-random** Appearing random but generated by a repeatable formula. *Ch. 16*

**Pure function** A function whose result depends only on its arguments and which changes nothing else. *Ch. 5*

**Pursuit** Seeking a moving target's predicted future position. *Ch. 8, 9*

**Quad** A rectangle made of two triangles. *Ch. 15*

**Quantile** The value below which a given share of samples fall. *Ch. 4*

**Queue** A first-in, first-out list. *Ch. 14*

**Recursion** A function calling itself on a smaller piece of the problem. *Ch. 12*

**Registry** A lookup table of things by key, filled at startup. *Ch. 12*

**Reinforcing loop** A feedback loop that amplifies change. Also called positive feedback. *Ch. 13*

**Saturation** Rising quickly, then levelling toward a limit: `1 − exp(−x/s)`. *Ch. 11*

**Scoring function** Reducing each option to one number so the best can be picked. *Ch. 7*

**Scratch vector** A vector allocated once and reused to avoid creating garbage. *Ch. 2*

**Seed** The starting number of a pseudo-random sequence. *Ch. 16*

**Shader** A small program run by the graphics card. *Ch. 15*

**Shelf packing** Arranging rectangles in rows, tallest first. *Ch. 15*

**Signature** A string summarising everything that affects a cached item's appearance. *Ch. 15*

**Slop** The small movement tolerated before a press counts as a drag. *Ch. 11*

**Smoke test** Running something briefly to see whether it fails outright. *Ch. 16*

**Smoothstep** The S-curve `t² (3 − 2t)`, easing in and out. *Ch. 5*

**Spatial grid** A grid of bins used to find nearby things without checking everything. *Ch. 3*

**Spread (`...`)** Copying the contents of one object or array into another. *Ch. 12*

**State machine** A system that is always in exactly one of a set of named states. *Ch. 1, 7*

**Steering force** Desired velocity minus current velocity, limited. *Ch. 2*

**Stigmergy** Agents coordinating through marks left in a shared environment. *Ch. 13*

**Swap-remove** Deleting an array element by overwriting it with the last one. *Ch. 11*

**Template method** A base-class routine with steps that subclasses override. *Ch. 10*

**Throttle** Running work less often than every frame. *Ch. 1*

**Time slicing** Updating a portion of a list each frame in rotation. *Ch. 6*

**Tween** An interpolation from a start to an end over a fixed duration. *Ch. 15*

**Typed array** A fixed-length array of one numeric type, such as `Float32Array`. *Ch. 4*

**Uniform** A value passed to a shader that is the same for every vertex and pixel. *Ch. 15*

**Validator** A function that checks data for mistakes and reports them. *Ch. 12*

**Vertex shader** A program run for every vertex, deciding where it appears. *Ch. 15*

**Watchdog** A check that abandons an action which isn't making progress. *Ch. 7*

**Weighted choice** Picking at random with unequal odds. *Ch. 6*

**World space / screen space** The simulation's coordinates, and the canvas's. *Ch. 15*

**Wrapping (a function)** Replacing a function with one that adds behaviour and calls the original. *Ch. 15*

## 4. Te Reo Māori in the Game

These are the terms used in the code, the interface and this guide, with the meanings the game gives them. For anything you publish, check spelling, macrons and usage with a reliable source such as Te Aka Māori Dictionary (maoridictionary.co.nz).

### Concepts

| Term | Meaning in the game |
|---|---|
| **Mauri** | Life force; the vitality of a living system. The game's currency. |
| **Kaitiaki** | Guardian, steward. The player's role. |
| **Aotearoa** | New Zealand. |
| **Te Waipounamu** | The South Island. |
| **Kahurangi** | The region in the north-west of the South Island where the game is set. |
| **Atua** | Deity, ancestor with influence over a domain. |
| **Tāwhirimātea** | Atua of wind and weather, invoked by the storm. |
| **Āwhā** | Storm. The name of the first story level. |
| **Whakataukī** | Proverb. |

### Birds

| Term | Bird |
|---|---|
| **Moa** | The extinct giant flightless birds at the centre of the game. Nine species appear. |
| **Moa pukepuke** | The name the game uses for the upland moa. |
| **Pouākai** | Haast's eagle, the moa's predator. |
| **Kererū** | New Zealand wood pigeon; the forest's seed disperser. |
| **Kea** | The alpine parrot. |
| **Kākā** | The forest parrot. |
| **Kākāpō** | The flightless, nocturnal parrot that breeds in mast years. |
| **Kōkako** | The wattled forest songbird. |
| **Te Whē** | The mantis who guides the player. |

### Plants

| Term | Plant |
|---|---|
| **Harakeke** | Flax. |
| **Wharariki** | Mountain flax. |
| **Kawakawa** | A shrub with heart-shaped, peppery leaves. |
| **Rimu** | A tall podocarp tree with red fruit. |
| **Tawhai** | Beech. |
| **Pātōtara** | A low alpine shrub with orange berries. |
| **Horoeka** | Lancewood. |
| **Taramea** | Speargrass. |
| **Tūmatakuru** | Matagouri, a thorny shrub. |
| **Ponga / mamaku** | Tree ferns. |
| **Pōhuehue** | A wiry scrambling vine. |
| **Inaka** | Dracophyllum, a grass-tree of the tops. |

### Words you may meet in the level text

| Term | Meaning |
|---|---|
| **Kia ora** | A greeting. |
| **Mutunga-kore** | Without end; the name of the endless mode. |
