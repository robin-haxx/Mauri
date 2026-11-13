# The Nature of Mauri

*A guide to the code behind Avian Age: Mauri, for someone who knows a little JavaScript and a little p5.js and wants to own the rest.*

> Ko te manu e kai ana i te miro, nōna te ngahere.
> Ko te manu e kai ana i te mātauranga, nōna te ao.
>
> The bird that eats the miro berry owns the forest.
> The bird that feasts on knowledge owns the world.
> — whakataukī

## What this is

Mauri is a p5.js sketch that grew into a game. Underneath the menus and the art it is still a sketch in the old sense: a `setup()`, a `draw()`, some objects with a position and a velocity, and a handful of rules. Moa get hungry and walk to food. Eagles get hungry and fly to moa. Plants grow back. Seasons turn. None of those rules is long, and none of them knows about the others. The game you play is what happens when they all run at once.

This guide teaches those rules, one system at a time, in the manner of Daniel Shiffman's *The Nature of Code*. That means I start each chapter from the smallest version of an idea that could work, usually something you could type into the p5.js web editor, and then walk towards what the game's code does and why it does it that way. Where the game's code is more complicated than the idea, I say what problem the extra code solved. Where I think the game's code has a flaw or a surprise, I say that too.

By the end you should be able to open any file in the repository, know what job it does, and change it without fear.

## Who it's for

You have written a p5.js sketch or two. You know what `let`, a `for` loop, a function and a `class` are. You may have used `createVector()`. You have not necessarily built anything this large, and words like "spatial hash", "state machine", "fractal noise" or "vertex shader" may be new. Each one gets introduced from the ground up when it first matters.

## How to read it

The chapters build on each other, and I'd read Part One in order. After that, follow your interest: each chapter opens by saying which earlier ones it leans on.

Every chapter has:

- **Sketches**: small, stand-alone p5.js examples. Paste them into [editor.p5js.org](https://editor.p5js.org) and run them. They use the same names as the game where they can.
- **In the game**: the real code, quoted from the repository, with the file and function named so you can find it with a search. I name functions instead of line numbers, because line numbers go stale the first time anyone edits a file.
- **Exercises**: things to try, in the sketch or in the game. Some have answers; most are for exploring.
- **The Mauri Project**: at the end of each chapter, one task in the real codebase that uses what the chapter taught. Do these and you will have touched every system in the game.

A note on the code quoted here: it was read from the repository in November 2026. Quotes are often trimmed to the lines that matter. A `// ...` marks a cut, and a few have a guard simplified or a short comment added where that makes them easier to read. The game also keeps changing. If a quoted function doesn't match what you see in the file, trust the file, and treat the difference as a reading exercise.

## Status

All seventeen chapters and the appendix are written. Every code name mentioned in the text was checked against the source when the guide was finished, and about 95% of the quoted lines are verbatim; the rest are the trims described above. The Mauri Projects describe changes for you to make. None of them has been applied to the game, so expect to do a little working-out of your own in each.

## The chapters

### Part One: A world that moves

| | Chapter | What you learn |
|---|---|---|
| 1 | [The Sketch That Became a Game](01-the-sketch-that-became-a-game.md) | How 40 files share one global scope, the game loop, delta time, game states, loading in steps |
| 2 | [Vectors, Forces and the Boid](02-vectors-forces-and-the-boid.md) | Position, velocity, acceleration; steering forces; seek, arrive, flee, wander, separation |
| 3 | [Who Is Near Me?](03-who-is-near-me.md) | Why neighbour searches get slow, and the grid that fixes it |

### Part Two: The land and its clock

| | Chapter | What you learn |
|---|---|---|
| 4 | [A World From Noise](04-a-world-from-noise.md) | Fractal noise, ridges, an island shape, height maps, biomes as elevation bands, flood fill |
| 5 | [Seasons: Time as a Blend](05-seasons-time-as-a-blend.md) | A clock, `lerp`, transition windows, the snow line, a climate curve |
| 6 | [Plants: The Bottom of the Food Web](06-plants.md) | A depletable resource, growth and regrowth, dormancy, updating in batches |

### Part Three: Things that live

| | Chapter | What you learn |
|---|---|---|
| 7 | [The Moa Mind](07-the-moa-mind.md) | Drives, state machines, scoring choices, hysteresis, giving up |
| 8 | [Life Cycles](08-life-cycles.md) | Mating, eggs, hatching, growth limits, why small populations are fragile |
| 9 | [The Hunter](09-the-hunter.md) | Pursuit, an energy budget, starvation, a predator population that regulates itself |
| 10 | [Birds of the Canopy](10-birds-of-the-canopy.md) | Inheritance, hook methods, flight, seed dispersal, flocks that spread themselves |

### Part Four: The game on top

| | Chapter | What you learn |
|---|---|---|
| 11 | [The Player's Hand](11-the-players-hand.md) | Placeable tools, attraction, validation, the mauri economy |
| 12 | [Data-Driven Design](12-data-driven-design.md) | Registries, species as data, level files, opt-in mechanics flags, goals |
| 13 | [Emergence](13-emergence.md) | Feedback loops, how the systems join, tuning, and the traps that emergent systems set |
| 14 | [Stories on a Simulation](14-stories-on-a-simulation.md) | Events and tips, scripted directors, pathfinding, the chapters engine |

### Part Five: Craft

| | Chapter | What you learn |
|---|---|---|
| 15 | [Drawing the World](15-drawing-the-world.md) | Cameras, a fake-3D projection, depth sorting, sprite atlases, WebGL batching, shaders, caching |
| 16 | [Tools of the Trade](16-tools-of-the-trade.md) | Running, debugging, lenses, benchmarks, seeded runs, headless tests, the release build |
| 17 | [Where to Go Next](17-where-to-go-next.md) | Step-by-step recipes for adding to the game, and a study plan |

### Reference

- [Appendix A: Glossary and File Map](appendix-a-glossary-and-file-map.md): every file in one table, the te reo Māori terms, the units and the keys.

## Running the game while you read

You need Node.js installed. From the game's folder:

```bash
node tools/serve.js
```

Then open `http://127.0.0.1:8081` in a browser. There is no build step during development. Edit a file, reload the page, and the change is live.

Three keys are worth knowing from the start. **D** turns on debug mode, which shows frame timings and unlocks developer-only levels. **L** turns on the debug lenses, which draw hidden simulation state over the world. **H** hides or shows the hunger bars. Chapter 16 has the rest.

## Conventions

- **Frames** are the unit of time everywhere in the simulation. The game aims for 60 frames a second, so 60 means one second, 3600 means one minute. Chapter 1 explains how this stays true when the frame rate drops.
- **World units** are the unit of distance. One world unit is one pixel of the game map before the camera zooms it. A moa is about 10 units across; an eagle sees prey about 130 units away.
- **Elevation** is always a number from 0 (sea floor) to 1 (the highest peak).
- **Hunger** runs from 0 (full) to 100 (starving). It goes up over time, which trips people up at first.

## A word on the epigraphs

Each chapter opens with a whakataukī (a Māori proverb), with a common English rendering. I chose them for how they speak to the chapter's idea. Please check them against a source you trust before reusing them anywhere public: I may have a macron or a word wrong, and several have more than one accepted form.

## What this guide is not

It is not the design documents. The repository already holds those (`OVERVIEW.md`, `DEVBLOG_systems.md`, `FREEPLAY_PLAN.md`, `MODULE_SCRIPTING.md` and others), and they record what was decided and why. This guide teaches the skills underneath them. Where a design document goes deeper on a topic than I do, the chapter points to it.
