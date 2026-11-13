# Chapter 16: Tools of the Trade

> I orea te tuatara ka puta ki waho.
>
> A problem is solved by continuing to find solutions.
> — whakataukī

*You can read this chapter at any point. It pairs especially well with Chapter 13.*

A simulation hides nearly everything that matters. You see a moa standing still. You don't see its hunger, the plant it has in mind, the distance to it, the stall counter ticking, or the blacklist it's about to add that plant to. Whether you can build this game further depends less on how clever your code is than on how well you can see what the code you have is doing.

This chapter is the workshop: how to run the game, how to look inside it, how to measure it, how to repeat a run exactly, how to test every level without playing any of them, and how to ship. None of it is glamorous. All of it is what turns "I think this fixed it" into "I know it did".

## Running It

In Chapter 1 you started the game with:

```bash
node tools/serve.js
```

and opened `http://127.0.0.1:8081`. It's worth knowing why that step exists at all. Why not double-click `index.html`?

A page opened straight from disk has an address beginning `file://`, and browsers, for security, refuse to let such a page load other files with JavaScript. The game loads its sprites and sounds that way, so from `file://` they'd all be blocked. A **local server** is a tiny program that hands out the same files over `http://`, which the browser trusts. `tools/serve.js` is 76 lines and uses nothing but Node's built-in modules. Read it some time: a web server is a much smaller thing than its reputation.

It takes two optional arguments, a port and a folder:

```bash
node tools/serve.js 8091 dist
```

That serves the release build (below) on port 8091.

There's no build step in development. You edit a `.js` file, reload the page, and you're running the new code. Keep it that way as long as you can. The speed of the edit-reload-look loop is the speed at which you learn.

### A first check without a browser

Before reloading, you can ask Node whether a file is at least valid JavaScript:

```bash
node --check mauri_moa.js
```

It prints nothing if the file parses and an error with a line number if you've left out a bracket. It doesn't run the code and won't catch a misspelled variable. It catches the mistakes that would otherwise give you a blank page, and it takes a tenth of a second.

## The Console

Press F12 (or right-click and choose Inspect) to open the browser's developer tools, and select the Console tab. This is the most powerful tool you have, and many people never go beyond reading error messages in it.

Because the game runs in one global scope (Chapter 1), every top-level name is reachable from the console while the game is running. You can inspect anything:

```javascript
game.simulation.moas.length
game.simulation.getMoaPopulation()
game.simulation.eagles.map(e => Math.round(e.hunger))
game.seasonManager.currentKey
game.mauri.mauri
LEVEL_MECHANICS
CONFIG.zoom
```

and you can change anything:

```javascript
game.mauri.mauri = 9999                       // rich
game.simulation.eagles.forEach(e => e.hunger = 100)   // every eagle starving
LEVEL_MECHANICS.eagleTargetRatio = 1 / 3      // more eagles from now on
game.simulation.moas[0].hunger = 95           // one desperate moa
CONFIG.debugMode = true
```

This is how you test an idea in ten seconds. Wondering whether a higher eagle ratio makes Level 1 too hard? Don't edit the level file, reload, and play for three minutes to the same point. Type the line and watch.

A few console habits that pay off:

**Grab one thing and keep it.** `m = game.simulation.moas[0]` stores a moa in a variable. Then `m.hunger`, `m.currentState`, `m.targetPlant` as often as you like. It's "follow one individual" from Chapter 13, by hand.

**`console.table`** prints an array of objects as a grid:

```javascript
console.table(game.simulation.moas.map(m => ({
  species: m.speciesKey, state: m.currentState, hunger: Math.round(m.hunger), age: Math.round(m.age)
})))
```

**Counting by a property** is a one-liner you'll use constantly:

```javascript
game.simulation.moas.reduce((acc, m) => { acc[m.currentState] = (acc[m.currentState] || 0) + 1; return acc; }, {})
```

That gives you something like `{ foraging: 12, idle: 5, migrating: 8 }`: how many moa are in each state right now. If the answer is "30 migrating, 0 foraging" in midwinter, you've learned a lot.

**Breakpoints.** In the Sources tab, click a line number in any file. The next time that line runs, the game freezes there and you can hover over variables to see their values, and step forward a line at a time. For a bug in one function it beats any number of `console.log` calls. Writing `debugger;` in your code has the same effect when the developer tools are open.

One caution. `console.log` inside `behave` runs for every moa every frame: thousands of lines a second, which slows the game and buries what you wanted. Log one animal (`if (this === game.simulation.moas[0])`), or log on a timer.

## Keys and Addresses

### Keyboard

These are handled in `Game.handleKey`. The first group is for playing; the second is for you.

| Key | Does |
|---|---|
| Space, P | Pause |
| 1 to 9 | Select a tool |
| Esc | Cancel a placement, or pause |
| F | Toggle the fullscreen layout |
| V | Toggle the tilted 3D view |
| H | Show or hide hunger bars |
| E | Field guide |
| T | Tutorial tips on or off |
| M / N | Music / all audio |
| R | Restart the level |
| **D** | **Debug mode**: timing overlay, developer-only levels, the benchmark button |
| **L** | **Lenses**: world overlays and their legend |
| **J** | (debug mode, chapters levels) the chapter inspector |
| **X** | (Free Play) export this run's statistics as text and JSON |

### URL parameters

Text after a `?` in the address is read by the game at startup. Join several with `&`.

| Parameter | Effect |
|---|---|
| `level=<id>` | Start that level directly, skipping the menu |
| `sketch=<label>` | With a level family, which variant |
| `seed=<n>` | Fix the random seed (see below) |
| `chapter=<id>` | Start a chapters level at that chapter |
| `bench=<n>` | Record `n` benchmark runs from the first frame |
| `years=<n>` | End a recorded run after `n` in-game years |
| `render=2d` | Use the flat 2D renderer instead of the GPU |
| `perf=1` | Performance mode |
| `sprites=2` | Render sprites at double resolution |
| `hudcache=0` | Disable the HUD cache, for comparison |

So this address:

```
http://127.0.0.1:8081/?level=kahurangi&seed=7
```

drops you straight into Level 1 on the same land every time. When you're working on one thing, bookmark the address that gets you there. Skipping the menu a hundred times a day is worth a line of typing.

Reading these is simple, and you can add your own:

```javascript
const q = new URLSearchParams(window.location.search);
const seed = q.get('seed');
```

`URLSearchParams` parses the query string; `.get('name')` returns the value or `null`.

## Lenses

You've built several lenses in the Mauri Projects. Here's the system as a whole, since it's the first thing to reach for when behaviour puzzles you.

A lens is an object with an `id`, a `label`, and one or both of two methods:

```javascript
Lens.register({
  id: 'myLens',
  label: 'What it shows',
  drawWorld(game, z) {
    // Called inside the world transform. Use world coordinates.
    // z is the view zoom: divide sizes by it to keep them constant on screen.
  },
  drawScreen(game) {
    // Called after the HUD, in screen coordinates. For readouts and charts.
  }
});
```

`Lens.renderWorld` is called from `Game.render` just before the world transform is popped; `Lens.renderScreen` from `draw()` after everything else. Each lens's drawing is wrapped in `push()`/`pop()` and a `try`/`catch`, so a broken lens can't break the game or leak its drawing style into the next thing drawn.

The registry is an array. `Lens.register` pushes onto it, the legend is drawn by looping over it, and a click on a legend row toggles that lens's id in a `Set` of active ones. It's the self-registration pattern from Chapter 12: add a lens anywhere in `mauri_lens.js`, and it appears in the legend with no other change.

Some guidance from having written a few:

- **Draw the thing the code is thinking about.** A line from an animal to its target. A circle for a radius. A tint for a region. If a function chooses between options, draw the options and mark the winner.
- **One lens, one question.** "Where do the kea think the food is?" is a good lens. "Everything about kea" is a mess.
- **Keep them.** A lens you wrote to find one bug will find the next one too. The repository's lenses for kea cache choice and land regions were both written for a specific problem and stayed.

### Exercise 16.1

Write the lens you most wish you'd had while reading this guide. If you can't think of one: for every eagle, draw its `huntRadius`, tinted by hunger from green to red, with a line to its `nest`.

## Measuring a Run: The Benchmark

Lenses show a moment. Balance is about what happens over minutes. For that there's `BENCHMARK` in `mauri_benchmark.js`.

Armed (from the level splash screen in debug mode, or with `?bench=1`), it runs the level with the tutorial off and, every 600 frames (ten seconds of game time), records a row:

```
seed, level, sketch, chapter, time_s, year, season,
<one column per moa species>, other_moa, total_moa, eagles, eggs,
n_<each other bird>, placed_<each tool>, event
```

When the level ends it downloads the rows as a **CSV** file: comma-separated values, plain text, one row per line. Any spreadsheet opens it. Select the `time_s`, `total_moa` and `eagles` columns, insert a line chart, and you have the population curves from Chapter 13 for a real run.

That's the measured answer to questions you'd otherwise argue about. Does the eagle count overshoot? How deep is the winter dip? Did my change make the first year easier?

Its sampling loop is the throttle from Chapter 1:

```javascript
update(game) {
  if (!this.active || this.finished) return;
  if (game.playTime >= this._nextSampleAt) {
    this.sample(game, 'sample');
    this._nextSampleAt += this.SAMPLE_INTERVAL;
  }
  // ...
}
```

and `sample` counts each species by looping over the lists. It's forty lines of counting. A recorder like this is easy to write and repays the effort many times over. If you add a new quantity that matters to the game (total food on the map, say), add a column for it.

## The Same Game Twice: Seeds

Here's a problem. You change a number, play, and the moa do better. Was it your change, or luck? Every run is different. The land is different, the first eagle attack comes at a different moment, different eggs get laid.

Computers can't produce true randomness. `random()` is a formula that, given a number, produces the next one in a long scrambled sequence. The starting number is the **seed**. Start from the same seed and you get the same sequence, every time. This is called a pseudo-random generator, and the fact that it's secretly deterministic is tremendously useful.

p5.js lets you set the seed:

```javascript
randomSeed(42);
noiseSeed(42);
```

and the game does, when you pass one:

```javascript
this.runSeed = seed != null ? seed : (this._urlSeed != null ? this._urlSeed : null);
if (this.runSeed != null) { randomSeed(this.runSeed); noiseSeed(this.runSeed); }
```

With `?seed=42`, the terrain comes out the same, the plants are scattered the same, the founders stand in the same places with the same sexes, and every `random()` call for the rest of the run returns the same value as last time.

So a seeded run is **repeatable**. That gives you three things.

- **A fair comparison.** Run seed 42 with the old number and with the new one. Any difference is your change.
- **A reproducible bug.** "On seed 17, a moa starves beside the tarn at 95 seconds." You can go and watch it, as many times as you need.
- **A regression test.** If seed 42 produced a certain result last week and a different one today, something changed.

### What breaks repeatability

A run only replays exactly if *everything* that affects it is the same. Three things can spoil that, and each is a rule to follow in your own code.

**Use `random()`, never `Math.random()`.** JavaScript's own `Math.random()` can't be seeded. One call to it in the simulation and the run diverges. The game's simulation code uses p5's `random()` throughout. (`Math.random` appears only in the audio code, choosing between sound variations, where it can't affect the ecosystem.) Keep it that way. If you need randomness in something purely cosmetic and don't want it to shift the simulation's sequence, `Math.random` is then the *right* choice, since it draws from a separate supply.

**The order of `random()` calls must be the same.** The sequence is shared. If one run makes an extra call somewhere, every call after it gets a different number. Real frame timing can cause this: a slow frame has a bigger `dt`, a moa crosses a threshold one frame earlier, a different branch runs, and one more `random()` is called. This is why the test tools step the simulation with a fixed `dt` of exactly 1.

**Real time must not leak in.** Anything read from the clock (`millis()`), from the frame counter while frames are being skipped, or from the player's mouse makes a run unique.

One honest limitation, recorded in the repository's notes: a seeded run replays exactly on one machine and browser, and drifts on a different one. The likely cause is that `Math.sin` and `Math.cos` can differ in their last digit between browsers, and in a system as sensitive as this (Chapter 13's "small causes, large effects"), a difference in the fifteenth decimal place eventually becomes a different decision. So share seeds with yourself freely, and with others knowing the first minute will match and the tenth may not.

### Exercise 16.2

In a sketch, call `randomSeed(5)` in `setup()` and draw 50 random circles. Reload: same picture. Now add one `random()` call before the loop. Every circle moves. That's the "order of calls" rule. Then replace one of the calls inside the loop with `Math.random()` and reload several times.

## Testing Without Playing: Headless Tools

There are a dozen levels. After changing `Moa.behave`, do they all still load? Does any crash thirty seconds in? Checking by hand means starting each one and waiting. Nobody does that after every change, so breakages go unnoticed for days.

The `tools/` folder has two scripts that do it for you. They use **Playwright**, a library that starts a real browser with no window (a **headless** browser) and controls it from a script. To install it once:

```bash
npm install -D playwright
```

```bash
npx playwright install chromium
```

### validate.js

```bash
node tools/validate.js
```

This opens the game in a headless browser and, for every registered level, runs the validators from Chapters 12 and 14: the level-format check and, for chapters levels, the chapter engine's check. It prints a line per level:

```
ok   kahurangi
ok   glacial_kahurangi
FAIL chapters_storms_guided (chapters, storms/Guided)
      unknown condition "cuont"
```

and exits with an error code if anything failed.

```bash
node tools/validate.js --smoke
```

`--smoke` goes further. It then starts each level and runs it for 900 simulation steps (15 seconds of game time), reporting any JavaScript error and the final state. It's called a **smoke test**, from electronics: switch it on and see if smoke comes out. It doesn't prove a level is good. It proves it runs, and catches the typo in a rarely-used branch that `node --check` can't.

```bash
node tools/validate.js --only sandbox
```

checks one level.

Run `--smoke` before you commit anything that touched the simulation. It takes a minute and it's saved this project from shipping broken levels more than once.

### How a headless run works

It's worth seeing how the script drives the game, because it shows the benefit of the structure from Chapter 1. From `validate.js`:

```javascript
game.loadLevel(levelId);
game._startLoading();
for (let i = 0; i < 4000 && game.state === GAME_STATE.LOADING; i++) { redraw(); /* ... */ }
// ...
for (let i = 0; i < 900; i++) { frameCount++; game.update(1); if (game.state !== GAME_STATE.PLAYING) break; }
```

It calls `game.update(1)` in a plain loop. No drawing, no waiting for the screen. Because updating and rendering are separate, fifteen seconds of game time takes a fraction of a second of real time.

Note `frameCount++`. With the page's draw loop stopped, p5's `frameCount` stands still, and some game code times things by it. The harness advances it by hand. That's the frame-dependence trap from Chapter 13, and the fix is noted in `MISTAKES.md` under the heading *A headless run must advance `frameCount` by hand*.

### batch.js

```bash
node tools/batch.js --level kahurangi --seeds 1..10 --years 1
```

This plays a level ten times, with seeds 1 to 10, each for one in-game year, and saves each run's benchmark CSV into the `tests/` folder. It prints a line per run and a tally at the end: how many were won and lost, what the eagles took.

This is the proper way to answer a balance question. Not "I played it and it felt harder", but "of ten seeds, eight were lost before, and three after".

Its options:

| Option | Meaning |
|---|---|
| `--level <id or family>` | Which level |
| `--sketch <label>` | Which variant of a family |
| `--seeds 1..10` or `--seeds 3,7,9` | Which seeds |
| `--years <n>` | Stop after n in-game years |
| `--seconds <n>` | Stop after n seconds of game time (default 300) |
| `--player cover` | A stand-in player (below) |
| `--trace <cast name>` | Print one named bird's state once a second |
| `--out <dir>` | Where to save (default `tests`) |

**The stand-in player.** A game played with no player isn't the game. `--player cover` adds the simplest possible robot: every half-second, if a named character is being hunted in the open, it puts a storm over them. It isn't a good player. It's a *consistent* one, and it lets you compare levels and settings as they'd go for someone doing the obvious thing.

**The trace.** `--trace mama` prints one bird's state, hunger, target and distance once a second: the "follow one individual" technique, automated. The foraging bugs in Chapter 7 were found with exactly this.

**The replay hash.** Each run's line ends with something like `replay 9c41f0a2`. It's a short fingerprint of the run's CSV. Run the same seed twice and the two fingerprints should match. If they don't, something non-deterministic has crept into the simulation, and you've been told the moment it happened instead of weeks later.

For chapters levels, batch also reports each guaranteed beat as natural or forced (Chapter 14), which is how you tune an invitation: change it, run ten seeds, and see whether "forced" went down.

## Shipping: The Release Build

During development the browser loads sixty separate, readable files. For release you want fewer, smaller files. `tools/build.js` produces them:

```bash
node tools/build.js
```

(It needs the `terser` package: `npm install -D terser`.) The output goes to a `dist/` folder, along with a zip file ready to upload to itch.io.

What it does:

1. **Reads `index.html`** to find the script tags and their order. `index.html` stays the single source of truth.
2. **Concatenates** each run of adjacent game scripts into one file, in that order.
3. **Minifies** it with terser: strips comments and whitespace and renames variables to single letters. `this.securityTimeRequired` stays (property names are kept), but a local `const nearbyPlaceables` becomes `e`.
4. **Wraps** the bundle in one private scope, so top-level names can be renamed too.
5. **Copies** only the assets the game uses: images, audio, fonts. Source art and design documents stay behind.

That fourth step has consequences, and they've caught people out. The repository's notes list the rules that follow from it.

**Never do work inside a `console.log`.** The build removes `console.log`, `console.info` and `console.debug` calls entirely, arguments and all. So:

```javascript
console.log('Spawned', this.spawnEagle());    // DON'T: the eagle is never spawned in the release
```

works in development and silently does nothing in the build. `console.warn` and `console.error` are kept, so a player's bug report still has something in it.

**p5's hooks need to be found.** p5's global mode looks for `setup`, `draw`, `mousePressed` and the rest on `window` by name. Inside a private scope they wouldn't be there. The build re-exports them (`window.setup = setup;`), from a fixed list. If you add a p5 event function the list doesn't know, add it to `P5_HOOKS` in `build.js`.

**Don't name a top-level function or variable after a p5 global.** If you declare your own top-level `function image()` or `var color`, it behaves one way as a separate script and another way when wrapped. The build checks for this and refuses, telling you to rename it.

**Only plain `<script src="...">` tags.** The build reads `index.html` with a simple pattern. An inline script or a tag with extra attributes makes it stop with an error.

**There's no `window.game` in the build.** Top-level names are private once wrapped, so the console tricks from earlier in this chapter don't work on the release. That's also why the headless tools run against the unbundled source.

If the wrapped build misbehaves, there's a fallback:

```bash
node tools/build.js --safe
```

which skips the wrapping. The files then behave exactly like separate script tags, a little larger.

Always play the built version before you publish it:

```bash
node tools/serve.js 8091 dist
```

A build is a different program from your source, produced by a tool. Trust it after you've seen it run.

## Writing Things Down

The last tool isn't code.

Open `MISTAKES.md`. Every entry has the same four parts: **what happened**, the **root cause**, the **consequence**, and **the rule that prevents a repeat**. The rule also appears as a short comment at the place in the code where the mistake was made.

That's the most valuable habit in this repository. A bug costs you an afternoon. If you fix it and move on, it'll cost you the same afternoon again in six months, when you've forgotten and make the same mistake in a new place. If you write down the *rule*, it costs you two minutes of reading. And the comment at the scene stops the next person, most likely you, from "tidying up" the odd-looking line that was the fix.

You've seen such comments all through this guide. They're why I could tell you the stories behind the code:

```javascript
// Count competitors without the shared getNearbyMoas() buffer (re-querying it would
// overwrite behave()'s neighbour list). countNearbyMoas() counts in place.
```

```javascript
// Carry the overshoot instead of resetting to 0, so the season clock stays locked to
// Game.playTime (which drives the endless year boundary and camera pan).
```

```javascript
// (A moa's eagleResistance is rolled at the strike, not here: rolled on every scan it made
// the bird's pick flicker between herd members, so no wind-up ever finished.)
```

A good comment says **why**, never what. `// add one to i` is noise; the code already says that. `// carry the overshoot ... so the season clock stays locked` tells you something no amount of staring at the code would.

When you fix something that took you more than an hour to find, add an entry to `MISTAKES.md` and a comment at the site. Future you will be grateful.

### Version control

One more piece of writing-down: git. This guide isn't a git tutorial, but three habits are enough to work safely.

- **Commit small and often**, with a message saying what changed and why. A commit is a save point you can return to.
- **Before an experiment, make a branch** (`git switch -c try-trampling`). If it doesn't work, switch back and it's as if it never happened. That freedom is what lets you try bold changes to a simulation that took months to balance.
- **Read the diff before you commit** (`git diff`). You'll catch the stray `console.log` and the number you changed "just to test".

## A Routine

Putting the chapter together, here's a way of working that I'd suggest.

**Starting a change**
1. Make a branch.
2. Bookmark a URL that drops you into the level and seed you'll test on.

**While working**
3. Edit, `node --check` the file, reload.
4. Use the console to set up the situation you want to see instead of waiting for it.
5. When something's unclear, write a lens. When something's wrong with one animal, follow that animal.

**When it seems to work**
6. Try a few different seeds by hand.
7. `node tools/validate.js --smoke`.
8. If it's a balance change: `node tools/batch.js` across ten seeds, before and after.

**Finishing**
9. Read your diff. Remove debugging leftovers.
10. If you learned something the hard way, write it in `MISTAKES.md` and in a comment.
11. Commit.

**Before a release**
12. `node tools/build.js`, serve `dist/`, and play it.

## Summary

- A local server is needed because browsers block file loading from `file://`. There's no build step in development.
- `node --check file.js` catches syntax errors instantly.
- The console can read and change any global while the game runs. Use it to create the situation you want to test.
- Keys: **D** debug, **L** lenses, **J** chapter inspector, **H** hunger bars. URL parameters jump straight to a level, seed, chapter or renderer.
- A lens is `{ id, label, drawWorld, drawScreen }` passed to `Lens.register`. Draw what the code is thinking about.
- The benchmark samples populations every ten seconds into a CSV for charting.
- A seed makes a run repeatable: fair comparisons, reproducible bugs, regression tests. Use p5's `random()`, keep call order fixed, keep real time out.
- `tools/validate.js` checks every level's data; `--smoke` also runs each for 15 seconds. `tools/batch.js` plays a level across seeds with an optional stand-in player and a per-bird trace.
- `tools/build.js` concatenates, minifies and wraps the scripts into `dist/`. Don't do work inside `console.log`; keep script tags plain; don't shadow p5 names; test the build.
- Record each hard-won lesson as a rule in `MISTAKES.md` and a why-comment at the site.

## The Mauri Project

Run a proper experiment, start to finish.

1. **Pick a question** about balance that you can't answer by reasoning. For example: *does doubling the fern shelter's `securityBonus` make Level 1 noticeably easier?* Write the question down, and write down what you expect.
2. **Establish a baseline.** Install Playwright. Run `node tools/batch.js --level kahurangi --seeds 1..10 --out tests/baseline`. Note the win/loss tally.
3. **Make the change** on a branch. One number.
4. **Run it again** into `tests/changed` with the same seeds.
5. **Compare.** Open two matching-seed CSVs in a spreadsheet and chart `total_moa` over `time_s` for each. Then compare the tallies. Was your expectation right? Was the effect bigger or smaller than you guessed?
6. **Check for determinism.** Run the baseline for seed 1 twice and compare the replay hashes printed at the end of each line. Then add a single `Math.random()` call somewhere in `Moa.behave` (assign it to an unused variable) and run twice more. Do the hashes still match? Now change it to `random()`. Do they match each other? Do they match the original? Explain each result. Remove the line.
7. **Smoke-test.** Run `node tools/validate.js --smoke`. Then deliberately break something small (misspell a method name inside a rarely-run branch of `mauri_plant.js`) and run it again. Did it catch it? Does `node --check` catch it? Fix it.
8. **Build.** Run `node tools/build.js` and play `dist/` for a minute. Open the console there and type `game`. What do you get, and why?
9. **Write it up.** Add three lines to a notes file of your own: the question, the result, and what you'll do about it. If anything surprised you, that's a candidate for `MISTAKES.md`.
