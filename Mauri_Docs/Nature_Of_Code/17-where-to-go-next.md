# Chapter 17: Where to Go Next

> Tūngia te ururua, kia tupu whakaritorito te tupu o te harakeke.
>
> Clear away the overgrowth, so the new shoots of the flax may grow.
> — whakataukī

You started this guide knowing some JavaScript and some p5.js. If you've read the chapters and done even half of the projects, you now know how a forty-thousand-line game is laid out, how its animals move and decide, how its land is made, how its seasons blend, how its populations hold themselves in check, how it's drawn, and how to look inside it when it misbehaves. That's most of what there is to know. The rest is practice.

This last chapter is practical. The first half is a set of **recipes**: step-by-step instructions for the things you're most likely to want to add. The second half is a **map of the skills** this game uses, with honest pointers to where each one is taught well, so you can go deeper wherever you like.

## Before You Change Anything

Three questions, every time. They'll save you more trouble than any technique.

**Is this data or code?** Most ideas for the game turn out to be a new row in a table or a changed number in a level file (Chapter 12). Check before you open a class. If a new species, plant, tool or level can be built from parts that exist, build it from parts.

**Which layer does it belong to?** Is it a fact about the world (simulation), a way of showing it (renderer), a thing the player does (tools and economy), or a way of telling the player something (tips and stories)? Put it in the right layer and it stays out of the others' way. The most common structural mistake is drawing code that changes the simulation, or simulation code that knows about the screen.

**What loop does it create?** If your addition makes more of something when there's already a lot, it's a reinforcing loop and needs a limit (Chapter 13). Decide the limit before you write the growth.

And one rule of process: **make it opt-in**. Put new behaviour behind a `LEVEL_MECHANICS` flag and switch it on in your sandbox level only. Every finished level stays exactly as it was until you decide otherwise.

## Recipes

Each recipe lists the files to touch, in order. Chapter references say where the ideas were explained.

### Add a moa species

*Data only. Chapter 12.*

1. `mauri_species_data.js`: add an entry to `MOA_SPECIES`. Copy an existing one and change it. At minimum give it `displayName`, `tint`, `size`, `baseSpeed`, `fleeSpeed`, `baseHungerRate`, `preferredElevation`, and a `rarity`. Anything you leave out falls back to `Moa.DEFAULTS`.
2. That's the registration done: `initializeRegistry()` loops over `MOA_SPECIES`.
3. In a level file: add its key to `species.moa`, and to `initialSpeciesDistribution` with a starting count.
4. Optional: add a line to `MIGRATION_HINTS` in `mauri_seasons.js` so the HUD can describe where it goes each season.
5. Optional: give it favoured food by adding a tool with `favouredSpecies: '<your key>'`.

Test: start the level, find one, and check its hunger bar and behaviour against what its numbers should produce. A species whose `preferredElevation` doesn't overlap any walkable biome on the level's map will be stressed for ever.

### Add a plant

*Mostly data. Chapter 6.*

1. `mauri_sketch.js`: add an entry to `PLANT_TYPES` with `name`, `nutrition`, `color`, `size`, `growthTime`, `winterEdibility` and a `description`.
2. `mauri_plant.js`: add it to `PLANT_TYPE_ID` with the next unused number.
3. Make it grow somewhere. Either add its key to a biome's `plantTypes` in a level (wild), or name it as a tool's `plantType` (planted).
4. Optional: in `mauri_seasons.js`, add it to the `plantTypeModifiers` of any season where its food value should differ. Unlisted means 1.0.
5. Optional, for a forest tree that birds feed at and that follows the forest band: add it to `FOREST_TREES` in `mauri_plant.js`.

**With art.** For a square sprite, supply four images named `sprites/<Name>_Mature.png`, `_Thriving.png`, `_Wilting.png` and `_Dormant.png`; add `'<Name>'` to the `spritePlants` list in `preload()` in `mauri_sketch.js`; and add the lower-case key to `SPRITE_PLANTS` in `mauri_plant.js`. Without art, the plant draws as a simple shape in its `color`, which is fine for testing.

### Add a tool

*Data if it reuses existing capabilities; a little code if it needs a new one. Chapter 11.*

1. `mauri_sketch.js`: add an entry to `PLACEABLES`. Required: `name`, `description`, `cost`, `icon`, `color`, `fauna`, `effect`, `radius`, `duration`, `minSpacing`, `ignoresSpacing`, `seasonalBonus`. Then whichever capability flags you want: `feedingRate` and `baseFeedingRate`, `plantSpawnCount` and `plantType`, `securityBonus`, `blocksEagleVision`, `hungerSlowdown`, `attractsHungryMoa` and `attractionStrength`, `distractsEagles`, `favouredSpecies`, `allowedBiomes`.
2. In a level file: add its key to `availablePlaceables` with a cost, and any per-level overrides.

**A new capability.** Invent a flag name. Find the animal that should feel it and read `p.def.<yourFlag>` there. For moa, that's the loop in `Moa.applyPlaceableEffects`. Follow reset-then-accumulate: clear the effect before the loop, set it inside, and decide whether overlapping tools take the maximum, the minimum or the sum.

**A tool that isn't placed on the map.** Give it `global: true` and handle its `effect` in `Game._useGlobalInteractable`.

### Add a rule (a mechanic flag)

*Code, safely. Chapter 12.*

1. Pick a name: `myRule`, plus `myRuleStrength` and so on for its numbers.
2. In the function where the rule acts, fetch the mechanics once and guard:
   ```javascript
   const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
   if (M.myRule) {
     const strength = M.myRuleStrength ?? 0.5;
     // ... the rule ...
   }
   ```
3. In your level's `mechanics` block: `myRule: true`, with a comment saying what it does.
4. Check a level that doesn't set it and confirm nothing changed there.

If the rule should fade in with winter or with the climate, multiply by `seasonManager.getWinterness()` or `coldIndex` instead of testing the season's name (Chapter 5).

### Add a state to an animal

*Code. Chapter 7.*

For a moa:

1. Add the name to `MOA_STATE`.
2. In `determineState`, add the test **at the position in the cascade that matches its priority**. Above it: everything that should interrupt it. Below it: everything it should interrupt.
3. In `executeState`, add a `case` that sets `maxSpeed` and applies forces.
4. If it's entered and left on a threshold, use two thresholds (a deadband).
5. If it steers toward something, add a progress watchdog.

For a bird, override `_runState` in the subclass, handle your state, and call `super._runState` for the rest (Chapter 10).

### Add a bird

*A small class. Chapter 10.*

1. New file `mauri_<name>.js`: `class <Name> extends Kereru`, a `<NAME>_SPECIES` object, and `if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('<key>');`.
2. `index.html`: a script tag after `mauri_kereru.js`.
3. `mauri_sketch.js`, in `initializeRegistry()`: `registerAnimalType` and `registerSpecies`, guarded with `typeof` like the others.
4. A level: add `<key>: <count>` to `initialEntityCounts` and the key to `species.other`.
5. Override hooks for what makes it different: `_findFruitTree` (diet), `_anchorPoint` (home), `_tryReproduce` (when it breeds), `_runState` (extra states), `_renderExtra` (looks).

### Add a level

*Data. Chapters 4 and 12.*

1. Copy the level file nearest to what you want. Change the `const` name, `id`, `name` and the `menu` block.
2. Add its script tag to `index.html`. If it borrows from another level's object, it must come after that level.
3. Work through the blocks: `terrain`, `biomes`, `species`, `initialEntityCounts`, `economy`, `mechanics`, `availablePlaceables`, then `goals` (or `phases`).
4. Validate: `node tools/validate.js --only <id>`, then `--smoke`.
5. Play it on several seeds. Then run it through `tools/batch.js`.

For a level with a narrated structure, start from `levels/_template_chapters.js` instead and follow the steps in its header (Chapter 14).

### Add a tip

*Data. Chapter 14.*

1. In the level's `levels/tutorial_*.js`, add an entry with an `id`, a `trigger`, a `title`, `content` (an array of lines), and `showOnce`.
2. Choose the trigger: `EVENT` with a `TUTORIAL_EVENTS` name (and an optional `condition`), `TIME` with a `delay` in frames, `CONDITION` with a function, or `IMMEDIATE` as the `nextTip` of another.
3. To point at part of the HUD, add `highlight: { type: 'element', target: '<name>' }`. For a toolbar button, the target is `'tool:<placeable key>'`.

### Add an event

*Two lines. Chapter 14.*

1. Add a name to `TUTORIAL_EVENTS` in `mauri_tutorial.js`.
2. Fire it where the thing happens, once, with useful data:
   ```javascript
   if (sim.game && sim.game.tutorial) {
     sim.game.tutorial.fireEvent(TUTORIAL_EVENTS.MY_EVENT, { who: this, speciesKey: this.speciesKey });
   }
   ```
3. For chapters levels to react to it, add an entry to `CHAPTER_EVENTS` in `mauri_chapters.js` saying which data field is its subject and what counter it adds to.

### Add a lens

*Ten minutes. Chapters 3 and 16.*

At the bottom of `mauri_lens.js`:

```javascript
Lens.register({
  id: 'unique',
  label: 'Shown in the legend',
  drawWorld(game, z) { /* world coordinates; divide sizes by z */ },
  drawScreen(game) { /* screen coordinates */ }
});
```

Press **L** in the game and click it in the legend.

### Add a column to the benchmark

*A few lines. Chapter 16.*

In `BENCHMARK.sample` in `mauri_benchmark.js`, compute your value and add it to `row` before `row.event = event`. The CSV header is built from the first row's keys, so the column appears by itself. Keep it before `event` so that column stays last.

### Change how something looks

*Renderer only. Chapter 15.*

Find the entity's `render` method. It draws in its own local frame, already translated to its position and lifted onto the terrain. Change the drawing. Don't read input there, and don't change any simulation value. If you need a new piece of state for the animation alone (a wobble phase, a fade), keep it clearly separate and advance it in `render` or by a visual clock, so that pausing the simulation doesn't freeze it wrongly and so that headless runs aren't affected.

## A Checklist for Anything New

Tick these off before you call a feature done. Each one is a lesson from an earlier chapter.

- [ ] Every per-frame change is multiplied by `dt`; repeated multiplication uses `Math.pow(f, dt)`. *(1, 10)*
- [ ] Every radius has its squared twin, and they're in step. *(2)*
- [ ] Forces are applied before the next one is requested. *(2)*
- [ ] Spatial query results are used before the next query on that grid. *(3)*
- [ ] Loops over animals and plants check `alive`. *(3, 8)*
- [ ] New plants go through `simulation.addPlant`. *(3)*
- [ ] Decisions on noisy numbers use two thresholds, or commitment. *(2, 7)*
- [ ] Anything walked toward has a progress check. *(7)*
- [ ] Randomness in the simulation uses `random()`, not `Math.random()`. *(16)*
- [ ] Anything that grows has a limit. *(6, 13)*
- [ ] Source tables aren't modified; derived copies are. *(5, 12)*
- [ ] The behaviour is behind a flag and off by default. *(12)*
- [ ] No work is done inside a `console.log`. *(16)*
- [ ] It works on a small map, with a tiny population, and at a low frame rate. *(13)*
- [ ] `node tools/validate.js --smoke` passes. *(16)*
- [ ] The comments say why. *(16)*

## Ideas Worth Building

If you want a project and don't have one, here are some that fit the game's grain, roughly in order of difficulty. Each names the chapters it draws on.

**Day and night.** A light level that cycles within a season. The renderer already has a sun direction and sun colour in the terrain shader. Kākāpō are nocturnal; eagles hunt by day. *(5, 9, 15)*

**Weather as a field.** Wind as a slowly changing vector that nudges flying birds and drifts storms. Rain that raises plant growth where it falls. Use a noise-driven field like Chapter 10's disturbance. *(2, 5, 10)*

**Trampling and recovery.** Heavily grazed ground grows back more slowly, so herds must move on. The Mauri Project in Chapter 13 sketches it. *(6, 13)*

**Scent.** Moa leave a fading trail; eagles (or a new ground predator) follow it. A field again, read by a different animal than the one that writes it. *(10)*

**Age structure.** Old age, and elders that juveniles follow to good feeding grounds, so that losing the old birds costs the herd its knowledge. *(7, 8)*

**A river.** Carve a channel through the height map from the alps to the sea, following the steepest descent. Animals drink; it's a barrier in flood. The terrain's `features` mechanism already supports tarns. *(4)*

**A new biome with its own rule.** Wetland: rich food, slow walking, no eagle can strike there. *(4, 12)*

**Player-drawn paths.** Let the player drag a line, and have moa prefer to walk along it, using the cost function of the pathfinder or a corridor of weak attraction points. *(11, 14)*

**Saving a game in progress.** Turn each entity into plain data and back. Start with the plants, which are simplest. *(12)*

**A second predator.** Something that takes eggs or chicks on the ground, so that nests need a different kind of protection from adults. *(9, 10)*

For any of these, begin the way the game itself was built: the smallest version that could work, in a sketch or behind a flag in the sandbox level, with a lens to see it.

## The Skills, and Where to Deepen Them

Here's what the game asked of you, grouped, with where this guide covered it and where I'd send you to learn more. I've kept to sources I'm confident exist and are good. Check that links and editions are current.

### The foundation

| Skill | In this guide | Go deeper |
|---|---|---|
| JavaScript itself: closures, classes, `Map`/`Set`, spread, destructuring | throughout; 10, 12 | **MDN Web Docs** (developer.mozilla.org), the JavaScript Guide. *Eloquent JavaScript* by Marijn Haverbeke, free online. |
| p5.js | 1, 15 | The p5.js reference (p5js.org/reference). **The Coding Train** videos by Daniel Shiffman. |
| The game loop, delta time, state machines | 1, 7 | ***Game Programming Patterns*** by Robert Nystrom, free at gameprogrammingpatterns.com. Read "Game Loop", "Update Method" and "State". |

### Motion and agents

| Skill | In this guide | Go deeper |
|---|---|---|
| Vectors and forces | 2 | ***The Nature of Code*** by Daniel Shiffman (natureofcode.com), Chapters 1 and 2. |
| Steering behaviours, flocking | 2, 7, 9, 10 | *The Nature of Code*, Chapter 5. Craig Reynolds, "Steering Behaviors for Autonomous Characters" (1999), on his site red3d.com/cwr. |
| Spatial partitioning | 3 | *Game Programming Patterns*, "Spatial Partition". *The Nature of Code*, the end of Chapter 5, for quadtrees. |
| Pathfinding (A*), grids | 14 | **Red Blob Games** by Amit Patel (redblobgames.com). His "Introduction to A*" is the best explanation there is, with diagrams you can play with. |

### Worlds

| Skill | In this guide | Go deeper |
|---|---|---|
| Noise and terrain | 4 | Red Blob Games, "Making maps with noise functions". *The Nature of Code*, the section on Perlin noise in its opening chapter on randomness. |
| Flood fill, connected regions | 4 | Red Blob Games' pages on grids and on breadth-first search. |
| Easing, interpolation, tweens | 2, 5, 15 | easings.net shows the standard curves. |

### Systems and ecology

| Skill | In this guide | Go deeper |
|---|---|---|
| Feedback loops, delays, stocks and flows | 13 | ***Thinking in Systems*** by Donella Meadows. Short, readable, and the best thing I know on the subject. |
| Population dynamics | 8, 9 | Any introductory ecology text on logistic growth and the Lotka-Volterra model. *The Nature of Code*, Chapter 9, on evolving ecosystems. |
| Emergence, complex systems | 13 | *The Nature of Code*, Chapters 5 and 7. *Turtles, Termites, and Traffic Jams* by Mitchel Resnick. |
| Game economies | 11 | Search for "faucets and sinks" in game economy design; the *Machinations* framework by Joris Dormans models economies as diagrams. |

### Structure

| Skill | In this guide | Go deeper |
|---|---|---|
| Data-driven design, registries, factories | 12 | *Game Programming Patterns*: "Type Object", "Prototype", "Component". |
| Events / observers | 14 | *Game Programming Patterns*: "Observer", "Event Queue". |
| Caching, dirty flags, object reuse | 3, 5, 15 | *Game Programming Patterns*: "Dirty Flag", "Object Pool". |
| Small languages as data | 14 | *Game Programming Patterns*: "Bytecode" (the heavier cousin of what the chapters engine does). |

### Drawing

| Skill | In this guide | Go deeper |
|---|---|---|
| Transforms and cameras | 15 | The p5.js tutorials on `translate`, `scale`, `push`, `pop`. |
| WebGL and shaders | 15 | ***The Book of Shaders*** by Patricio Gonzalez Vivo and Jen Lowe (thebookofshaders.com). **WebGL Fundamentals** (webglfundamentals.org) for how the API fits together. |
| Performance | 15, 16 | Your browser's developer tools: the Performance tab records where a frame's time goes. Learn to read one recording and you'll never guess again. |

### Craft

| Skill | In this guide | Go deeper |
|---|---|---|
| Debugging | 13, 16 | The Chrome DevTools documentation on breakpoints and the console. |
| Version control | 16 | *Pro Git* by Scott Chacon and Ben Straub, free at git-scm.com. The first three chapters are enough. |
| Automated testing in a browser | 16 | The Playwright documentation (playwright.dev). |

If you read only two things from that list, read *Game Programming Patterns* and *Thinking in Systems*. The first names nearly every structural trick in this codebase. The second teaches you to see the game's behaviour as loops, which is the view from which emergent systems make sense.

## A Study Plan

If you'd like a route through all this, here's one. It's built around the game, with a piece of outside reading for each stage.

**Weeks 1 to 2: Move things.** Chapters 1 to 3. Rebuild `Boid` from scratch in the p5.js editor, without looking: `seekPoint`, `fleePoint`, `wander`, `separate`, `update` with `dt`. Add a spatial grid and get 2,000 boids running smoothly. Read *The Nature of Code*, Chapters 1, 2 and 5.

**Weeks 3 to 4: Make a place.** Chapters 4 to 6. Build a terrain sketch with fractal noise, an island falloff and biome bands. Add a season clock that slides a snow line, and plants that grow back. Read Red Blob Games on noise.

**Weeks 5 to 7: Make it live.** Chapters 7 to 10. Put grazers on your terrain with hunger, a state machine and a scoring function for food. Add breeding with a condition on being fed. Add a predator with an energy budget. Chart both populations. Get them to coexist for ten minutes without your help. This is the hardest stage and the most rewarding. Read *Thinking in Systems*.

**Weeks 8 to 9: Make it a game.** Chapters 11 and 12. Add one tool the player can place, a currency, and one goal. Move every number into tables. Make a second level by changing only data. Read *Game Programming Patterns*, the chapters named above.

**Week 10: Understand what you made.** Chapter 13. Draw the loop diagram of your own project. Find one reinforcing loop and check it has a limit. Deliberately destabilise it and fix it.

**Weeks 11 to 12: In the real codebase.** By now Mauri's code should read like a larger version of your own. Pick one idea from "Ideas Worth Building" and do it in the sandbox level, behind a flag, with a lens, a batch run before and after, and an entry in your notes.

Twelve weeks is a guess. Go at whatever pace keeps it enjoyable. The point of building your own small version alongside is that you can't really understand a design decision until you've been in the position of having to make it.

## Last Words

When you first opened this repository it was probably daunting: sixty files, seven thousand lines in one of them, names you didn't recognise. I hope it now looks like what it is. A `setup` and a `draw`. Some objects with positions and velocities. A few hundred small rules, each one simple enough to hold in your head, most of them a handful of lines. A table of numbers for every kind of thing. And a great many comments left by someone who hit a problem, solved it, and wanted the next person to know why.

None of it is beyond you. The cleverest ideas in the game (eagles that regulate themselves, a snow line that's one moving number, a beat that invites before it forces) are clever because they're simple, not in spite of it. They were found by building the plain version first, watching what went wrong, and thinking about why.

That's the whole method. Start small. Make it visible. Change one thing. Write down what you learn.

The game is yours. Go and see what grows.

## The Mauri Project

One last project, and it has no steps, because by now you don't need them.

Choose something you want the game to have. Write one sentence saying what it is, and one saying what you expect it to do to the ecosystem. Decide whether it's data or code, which layer it lives in, and what loop it makes.

Build the smallest version behind a flag in your sandbox level. Write a lens that shows it working. Run ten seeds with it off and ten with it on.

Then compare what happened with the sentence you wrote. Whatever the difference is, between what you expected and what the world did, that's the part worth understanding. It's also the reason any of us build these things.
