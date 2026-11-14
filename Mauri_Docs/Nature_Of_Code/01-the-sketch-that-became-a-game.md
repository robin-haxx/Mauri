# Chapter 1: The Sketch That Became a Game

> Ka mua, ka muri.
>
> Walking backwards into the future.
> — whakataukī

Every p5.js sketch you have written has the same two functions in it. `setup()` runs once. `draw()` runs over and over, about 60 times a second, for as long as the page is open. Everything a sketch does happens inside one of those two.

Mauri has about 40,000 lines of JavaScript spread over 60 files, and it still has exactly one `setup()` and one `draw()`. They are at the bottom of `mauri_sketch.js`. If you understand how the rest of the code hangs off those two functions, you understand the skeleton of the whole game. That is this chapter's job. There are no moa in it yet. I want to build the stage before the actors walk on.

## One Global Scope

Open `index.html`. Most of it is a list of script tags:

```html
<script src="p5.js"></script>
<script src="mauri_audio.js"></script>
<script src="mauri_registry.js"></script>
<script src="mauri_spatial.js"></script>
<script src="mauri_simulation.js"></script>
...
<script src="mauri_boid.js"></script>
<script src="mauri_moa.js"></script>
<script src="mauri_eagle.js"></script>
...
<script src="mauri_sketch.js"></script>
```

There is no `import`, no `export`, and no bundler. Each file is loaded by the browser in the order listed, and everything a file declares at its top level (`class Moa`, `const SEASONS`, `function setup`) lands in one shared global scope. This is p5.js **global mode**, the same mode the web editor uses. The only difference from a one-file sketch is that the one file has been cut into 60 pieces.

This has a consequence you must keep in your head whenever you add a file. Consider this pair:

```javascript
// mauri_boid.js
class Boid { /* ... */ }
```

```javascript
// mauri_moa.js
class Moa extends Boid { /* ... */ }
```

`class Moa extends Boid` needs `Boid` to exist at the instant the browser reads that line. So `mauri_boid.js` must come before `mauri_moa.js` in `index.html`. If you swap them, the page dies with `Boid is not defined` before anything is drawn.

But look at this line inside a method of `Moa`:

```javascript
if (audioManager) audioManager.playMateCheep();
```

`audioManager` is created in `setup()`. The method that mentions it does not run until a moa mates, minutes into a game. By then every file has long since loaded. So this reference is safe no matter what order the files are in.

That gives the rule:

> A name used **while a file is being read** (in `extends`, or in code at the top level of the file) must be defined by an earlier file. A name used **inside a function that runs later** can be defined anywhere.

`mauri_sketch.js` is last because it holds `setup()` and `draw()`, and because its top level creates things like `CONFIG` that use nearly everything else.

You will see one odd-looking idiom all over the code because of this:

```javascript
if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.habitatStress) { ... }
```

`typeof x !== 'undefined'` is the one way to ask "does this global exist?" without crashing if it doesn't. It lets a file be cautious about things defined in files that load after it, and it lets parts of the code run outside the browser (a few files are also loaded by Node for testing).

### Exercise 1.1

Open `index.html` and find `mauri_kereru.js` and `mauri_kea.js`. Without looking at the files, which one must extend the other? Then check.

## The Loop

Here is a p5.js sketch with a ball in it:

```javascript
let x = 0;

function setup() {
  createCanvas(640, 240);
}

function draw() {
  background(255);
  x += 2;
  circle(x, 120, 24);
}
```

`draw()` does two different jobs here. It changes the world (`x += 2`), and it paints the world (`circle(...)`). In a small sketch you can mix those freely. In a game you separate them, because sooner or later you want to do one without the other: paint a paused game without advancing it, or advance a game twice as fast without painting twice.

So the first refactor every sketch-turned-game goes through is this:

```javascript
function draw() {
  update();   // change the world
  render();   // paint the world
}
```

Mauri's `draw()` is exactly that, with timing code around it. Stripped to its bones:

```javascript
function draw() {
  // 1. How long did the last frame take?
  const currentTime = millis();
  deltaTime = constrain(currentTime - lastFrameTime, 1, 100);
  lastFrameTime = currentTime;
  deltaMultiplier = deltaTime / TARGET_FRAME_TIME;   // TARGET_FRAME_TIME is 16.667 ms

  // 2. Change the world.
  game.update(deltaMultiplier);
  if (game.fastForward && game.state === GAME_STATE.PLAYING) game.update(deltaMultiplier);

  // 3. Paint the world.
  game.render();
}
```

There is one object, `game`, an instance of the `Game` class. It is created at the end of `setup()` and it owns everything: the terrain, the simulation, the UI, the tutorial. `draw()` asks it to update and then asks it to render. That's the whole loop.

Notice the fast-forward line. The button in the game's corner that doubles the speed does nothing clever. It calls `update` a second time. Because updating and rendering are separate, running the world twice per painted frame is one line of code. If the two had been tangled together it would have been a rewrite.

## Delta Time

Now for step 1, which is the most important idea in this chapter.

Go back to the ball. `x += 2` moves it 2 pixels every frame. At 60 frames a second that is 120 pixels a second. On a slow laptop that manages 30 frames a second it is 60 pixels a second. The ball's speed depends on the computer. For a ball that is a curiosity. For a game with a one-minute winter in which moa must not starve, it is a disaster: on a slow machine winter would last two minutes and the moa would get hungry half as fast.

The fix is to measure how much time really passed and scale every change by it.

```javascript
let x = 0;
let lastTime = 0;

function setup() {
  createCanvas(640, 240);
}

function draw() {
  background(255);

  const now = millis();
  const dt = (now - lastTime) / 16.667;
  // dt is 1 when a frame took exactly 1/60 s, 2 when it took twice that.
  lastTime = now;

  x += 2 * dt;
  // "2 pixels per ideal frame", whatever the real frame rate.
  circle(x, 120, 24);
}
```

The game calls this number `deltaMultiplier` in `draw()` and `dt` everywhere else. Its unit is "ideal frames". When the game runs at a perfect 60 fps, `dt` is 1 every frame, and you can read all the code as if time were counted in frames. When the machine stutters, `dt` grows to cover the gap.

That is why durations in the game are written as frame counts:

```javascript
seasonDuration: 2100,   // 35 seconds
restDuration = 180;     // an eagle rests 3 seconds after a kill
```

and why the timers that count them down look like this:

```javascript
this.restTimer -= dt;
```

instead of `this.restTimer--`. A timer that subtracts `dt` takes the same real time on any machine.

Almost every `update` and `behave` method in the game takes `dt` as its last argument and multiplies its changes by it. When you write a new behaviour, do the same. If you add or subtract something every frame and you have not multiplied it by `dt`, ask yourself whether you meant to.

### The clamp

Look again at this line:

```javascript
deltaTime = constrain(currentTime - lastFrameTime, 1, 100);
```

Why cap the frame time at 100 milliseconds? Think about what happens when you switch to another browser tab for a minute. The browser stops calling `draw()`. When you come back, the first frame reports that 60,000 milliseconds have passed, so `dt` would be 3600. Every moa would move 3600 frames' worth of distance in a single step and walk straight through mountains. Every timer would expire at once.

The clamp says: however long the gap really was, never simulate more than 100 ms (6 ideal frames) in one step. The game loses a little time after a long stall, and nothing explodes.

### Exercise 1.2

In the ball sketch, add `frameRate(15)` to `setup()`. With `dt`, the ball should cross the screen in the same number of seconds as before. Remove the `* dt` and compare.

### Exercise 1.3

Find the `Egg` class in `mauri_egg.js` and read its `update` method. The simulation calls it as `egg.update(dt)`. Does an egg hatch in the same real time at 30 fps as at 60 fps? What one-line change would make it so? (I come back to this in Chapter 8.)

## The Game Has States

A sketch is always doing the same thing. A game is not: sometimes it's showing a menu, sometimes loading, sometimes playing, sometimes paused, sometimes showing "you won". Each of those wants different behaviour from `update` and `render`.

The usual way to manage this is a **state machine**: one variable that says which mode the game is in, and code that branches on it. You'll meet state machines again in every animal's brain, so it's worth seeing the simplest one first.

```javascript
const GAME_STATE = {
  LEVEL_SELECT: 'level_select',
  MENU: 'menu',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  WON: 'won',
  LOST: 'lost'
};
```

`Game` holds `this.state`, which is always one of those. Here is the top of `Game.update`:

```javascript
update(dt = 1) {
  if (this.state !== GAME_STATE.PLAYING && this.state !== GAME_STATE.PAUSED) return;
  // Menus, loading and end screens: the world doesn't move.

  if (this.tutorial) this.tutorial.update(dt);
  this.updateHoldToMove(dt);
  // These two keep working while paused.

  if (this.state !== GAME_STATE.PLAYING) return;
  // Paused: stop here.

  this.playTime += dt;
  // ... everything else ...
}
```

And `Game.render` begins with the mirror image:

```javascript
if (this.state === GAME_STATE.LEVEL_SELECT) { this.renderLevelSelect(); return; }
if (this.state === GAME_STATE.LOADING)      { this.renderLoading(); this._stepLoading(); return; }
// ... otherwise draw the world ...
```

Why use named constants (`GAME_STATE.PAUSED`) instead of writing the string `'paused'` everywhere? Because if you mistype a string, JavaScript says nothing: `if (this.state === 'pasued')` is simply never true, and you spend an hour wondering why pause is broken. If you mistype `GAME_STATE.PASUED` you get `undefined`, which at least fails in a way you can catch, and your editor will autocomplete the right name.

Losing the game is nothing more than an assignment:

```javascript
if (this._cachedMoaCount === 0 && this._cachedEggCount === 0) {
  this.state = GAME_STATE.LOST;
  this.gameOverReason = "All moa here were hunted...";
}
```

On the next frame, `update` returns at its first line, and `render` draws the "lost" card. No other part of the code needs to know.

## What Happens in One Frame of Play

When `state` is `PLAYING`, `Game.update` runs a fixed sequence. I'll give it as a list, because the order matters and you will come back to this list often.

1. **Advance the clock.** `this.playTime += dt`. This is the master clock for the level, in frames.
2. **Work out the year and climate.** In Free Play the year number sets how harsh the winters are (Chapter 5).
3. **Advance the season.** `this.seasonManager.update(dt)`. If the season just changed, tell everyone.
4. **Run the simulation.** `this.simulation.update(this.mauri, dt)`. This is where every plant, moa, eagle, bird and egg takes its turn. It is most of the frame's work, and Chapters 2 to 10 are about what happens inside it.
5. **Run the story.** If the level has a story director or a chapter runner, it looks at what the animals just did and reacts (Chapter 14).
6. **Count heads.** `updateCachedCounts()` records how many moa and eggs are alive.
7. **Pay income.** About once a second, mauri is earned from the population (Chapter 11).
8. **Check goals, then check for a loss.**

The simulation's own `update` has an order too:

```javascript
update(mauri, dt = 1) {
  this.updateSpatialGrids();      // rebuild the "who is where" lookup (Chapter 3)
  this.updatePlantsBatched(dt);   // grow some of the plants (Chapter 6)
  if (this.seasonManager.justChanged) this.onSeasonChange();
  this.updatePlaceables(dt);      // the player's items (Chapter 11), every 2nd frame
  this.updateEggs(mauri, dt);     // incubate and hatch (Chapter 8)
  this.updateMoas(mauri, dt);     // every moa thinks, then moves (Chapter 7)
  this.updateEagles(mauri, dt);   // every eagle thinks, then moves (Chapter 9)
  this._updateOtherEntities(mauri, dt);   // the flying birds (Chapter 10)
  // ... bookkeeping, and every ~8.5 seconds, cleanup() removes the dead
}
```

Each animal's turn has two halves, and this pattern is the same for every creature in the game:

```javascript
moa.behave(this, mauri, seasonManager, dt);   // decide what to do: produces forces
moa.update(dt);                               // do it: forces become movement
```

`behave` is the thinking. `update` is the physics. Chapter 2 is about `update`; Chapters 7 to 10 are about the different `behave`s.

### Why the order matters

The spatial grids are rebuilt first, so every animal's "who is near me?" question this frame is answered from positions at the start of the frame. Moa move before eagles, so an eagle always chases where the moa is now, not where it was. The story runs after the simulation, so it reacts to what just happened and never to stale news. If you ever see a bug where something seems to lag one frame behind, look at this ordering first.

## Throttling: Not Everything Needs to Happen Every Frame

Look at how placeables are updated inside `Simulation.update`:

```javascript
this._placeableTimer += dt;
if (this._placeableTimer >= 2) {
  this._placeableTimer -= 2;
  this.updatePlaceables(dt);
}
```

And cleanup:

```javascript
this._cleanupTimer += dt;
if (this._cleanupTimer >= 512) {
  this._cleanupTimer -= 512;
  this.cleanup();
}
```

This is a **throttle**. A timer accumulates `dt`. When it passes a threshold, the work runs, and the threshold is subtracted. Placeables are updated every second frame; dead animals are swept out of the lists every 512 frames.

Notice it says `-= 512`, not `= 0`. If the timer reached 513.4, subtracting keeps the extra 1.4 for next time, so over a long run the work happens exactly once per 512 frames on average. Setting it to zero would throw away the remainder every time and slowly drift. This is a small thing, and you will see it done both ways in the code, but the subtracting form is the correct one when timing matters. The season clock uses it, with a comment saying why:

```javascript
if (this.timer >= this.config.seasonDuration) {
  // Carry the overshoot instead of resetting to 0, so the season clock stays locked to
  // Game.playTime (which drives the endless year boundary and camera pan).
  this.timer -= this.config.seasonDuration;
```

Throttling is the cheapest optimisation there is. Before making a piece of code faster, ask whether it needs to run this often at all. A moa checks how much food is around it once a second, not sixty times. A female eagle considers laying an egg every 220 frames. The player never notices, and the saved time goes to things that do need every frame, like movement.

### Exercise 1.4

Write a sketch that prints `"tick"` to the console once every 90 ideal frames using an accumulating timer and `dt`. Then set `frameRate(20)`. It should still tick every 1.5 seconds.

## CONFIG: One Object for the Knobs

Near the top of `mauri_sketch.js` is a large object literal:

```javascript
const CONFIG = {
  version: 'alpha 2.2 (VERTICAL SLICE)',
  referenceHeight: 1080,
  canvasWidth: 1920,
  canvasHeight: 1080,
  zoom: 2.5,
  debugMode: false,
  showHungerBars: true,
  // ...
  noiseScale: 0.005,
  octaves: 3,
  plantDensity: 0.006,
  initialMoaCount: 7,
  seasonDuration: 2100,
  // ...
};
```

`CONFIG` is where numbers live that more than one file needs. It has two halves, marked by comments in the source. The first half is **engine constants**: the canvas size, panel heights, colours, rendering switches. These don't change between levels. The second half is **level-variable parameters**: terrain noise settings, the starting moa count, season length. These are overwritten every time a level loads, by a function called `applyLevelToConfig` (Chapter 12).

Why one big object instead of loose `const` variables? Three reasons. You can pass it around (`new TerrainGenerator(CONFIG, biomes)`). You can see every knob in one place. And code that reads `CONFIG.seasonDuration` always gets the current level's value without knowing a level system exists.

There is one piece of real logic in `CONFIG`: the layout. The game draws on a canvas whose short edge is always 1080 pixels, and lets the long edge follow the window's shape. Everything on screen is positioned in that 1080-high space, and CSS then scales the canvas to fit the window. `CONFIG.recalculateLayout(windowW, windowH)` does the arithmetic. The benefit is that no drawing code ever asks "how big is the window?". It always draws as if the screen were 1080 pixels tall.

## Loading in Steps

Starting a level means generating a mountain range from noise, sorting it into biomes, baking images of it, scattering a thousand plants and placing the animals. That takes a second or two. If you did it all in one function call, the browser would freeze for that long with no way to show a progress bar, because the browser only paints the canvas between calls to `draw()`.

The fix is to cut the work into chunks and do one chunk per frame. This is a pattern worth learning because it applies to anything slow.

```javascript
_buildLoadingPlan() {
  const plan = this.terrain.generateSteps();
  plan.push({ label: 'Laying the spatial grids',             fn: () => this._initCreateSim() });
  plan.push({ label: 'Sowing plants and founding the flock', fn: () => this.simulation.init() });
  plan.push({ label: 'Waking the ecosystem',                 fn: () => this._initFinalize() });
  return plan;
}
```

The plan is an array of `{ label, fn }` objects. Each `fn` is a small function that does one piece of the work. Then, while `state` is `LOADING`, each frame does this:

```javascript
this.renderLoading();    // paint the bar, with the label of the chunk about to run
this._stepLoading();     // run that one chunk
```

and `_stepLoading` is:

```javascript
if (this._loadingStep < this._loadingPlan.length) {
  this._loadingPlan[this._loadingStep].fn();
  this._loadingStep++;
  this._loadingProgress = this._loadingStep / this._loadingPlan.length;
}
```

The last chunk, `_initFinalize`, sets `this.state = GAME_STATE.PLAYING`, and the next frame the game is running.

Two things make this work. Functions in JavaScript are values, so you can put them in an array and call them later. And the arrow functions (`() => this._initCreateSim()`) remember which `game` they belong to, so calling them later still does the right thing.

### Exercise 1.5

Write a sketch that "loads" by running five slow steps, one per frame, and draws a progress bar. For a slow step, use a loop that counts to fifty million. Then try running all five in `setup()` instead and see what the page does.

## Input

p5.js calls `mousePressed()`, `keyPressed()` and friends when things happen. In Mauri those functions are one-liners at the bottom of `mauri_sketch.js` that pass the event to the game:

```javascript
function keyPressed() {
  // ...
  game.handleKey(key);
}
```

`Game.handleKey` is a long `if` chain: `D` toggles debug mode, `L` toggles lenses, `F` fullscreen, number keys choose a tool, space pauses. `Game.handleClick(mx, my)` asks, in order: did the click land on a menu button? On the tutorial panel? On the HUD? If none of those, it converts the screen position to a world position and treats it as a click on the map.

That conversion is one you'll need whenever you add something clickable in the world. The world is drawn shifted by `(CONFIG.viewX, CONFIG.viewY)` and scaled by `CONFIG.viewZoom`, so the reverse is:

```javascript
const worldX = (mx - CONFIG.viewX) / CONFIG.viewZoom;
const worldY = (my - CONFIG.viewY) / CONFIG.viewZoom;
```

`Game._pointerWorld(mx, my)` does this for you, and also undoes the tilted 3D view (Chapter 15). Use it; don't write the division yourself.

## Summary

- The game is one p5.js global-mode sketch split across many files. `index.html` sets the load order. A name used at a file's top level needs an earlier file; a name used inside a function doesn't.
- `draw()` measures the frame time, calls `game.update(dt)`, then `game.render()`.
- `dt` is the number of ideal 1/60 s frames that passed. Multiply every per-frame change by it. Durations are written in frames.
- `game.state` is a state machine that decides what `update` and `render` do.
- One frame of play: clock, season, simulation (grids, plants, placeables, eggs, moa, eagles, birds), story, counts, income, goals, loss checks.
- Every creature has `behave(…, dt)` (decide) and `update(dt)` (move).
- Work that doesn't need to run every frame goes behind an accumulating timer.
- `CONFIG` holds shared numbers; a level overwrites half of it on load.
- Slow work is cut into a list of functions and run one per frame.

## The Mauri Project

Add a frame counter to the game.

1. In `mauri_sketch.js`, find `Game.update`. Just after `this.playTime += dt`, add a second counter that goes up by 1 (not `dt`) each time `update` runs while playing. Call it `this._updateCalls`. Initialise it to 0 in the `Game` constructor.
2. In `draw()`, find the block that runs when `CONFIG.debugMode` is true and prints `Update:` and `Render:` timings. Add a line there that draws `game.playTime` and `game._updateCalls` side by side.
3. Run the game, press **D**, and start a level. The two numbers should stay close. Now press the fast-forward button. What happens to each? Open another tab for ten seconds and come back. Which number jumped, and by how much? Can you explain the size of the jump from the `constrain` call?

When you're done you will have edited the main loop, used debug mode, and seen `dt` do its job.
