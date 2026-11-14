# Chapter 5: Seasons: Time as a Blend

> Whatungarongaro te tangata, toitū te whenua.
>
> People pass from sight; the land remains.
> — whakataukī

*Builds on Chapter 1 (timers, `dt`) and Chapter 4 (elevation, the snow line).*

The land from Chapter 4 never changes. The height map is computed once and left alone. Yet when you play, the place feels alive with change: snow creeps down the mountains, the high pastures brown off, the forest edge retreats, the moa walk downhill in autumn and back up in spring.

All of that comes from one small class, `SeasonManager` in `mauri_seasons.js`, and one idea. The seasons in Mauri are not events that happen to the world. They are a set of numbers that slide, and everything else reads the numbers.

## A Clock That Goes Round

Start with the clock. There are four seasons in a fixed order, each lasting the same number of frames.

```javascript
class SeasonManager {
  constructor(config) {
    this.config = config;
    this.seasonOrder = ['summer', 'autumn', 'winter', 'spring'];
    this.currentSeasonIndex = 0;
    this.timer = 0;
  }

  update(dt = 1) {
    this.timer += dt;
    if (this.timer >= this.config.seasonDuration) {
      this.timer -= this.config.seasonDuration;
      this.currentSeasonIndex = (this.currentSeasonIndex + 1) % 4;
      return true;    // the season just changed
    }
    return false;
  }
}
```

That's an accumulating timer, as in Chapter 1, with one new piece: `% 4`.

The `%` operator gives the remainder after division. `5 % 4` is 1; `4 % 4` is 0. So `(index + 1) % 4` counts 0, 1, 2, 3, 0, 1, 2, 3 for ever. Any time you need a counter that wraps round, to step through the frames of an animation, the seasons of a year, or the slots of a circular buffer, this is the tool.

The class uses JavaScript **getters** so the rest of the code can read the state naturally:

```javascript
get current()    { return SEASONS[this.seasonOrder[this.currentSeasonIndex]]; }
get currentKey() { return this.seasonOrder[this.currentSeasonIndex]; }
get next()       { return SEASONS[this.seasonOrder[(this.currentSeasonIndex + 1) % 4]]; }
get nextKey()    { return this.seasonOrder[(this.currentSeasonIndex + 1) % 4]; }
get progress()   { return this.timer / this.config.seasonDuration; }
```

A getter is a method that looks like a property. You write `seasonManager.currentKey`, with no brackets, and the function runs and returns `'winter'`. It's a tidy way to offer a value that's computed from other values without the caller needing to know.

`progress` is worth noticing: the timer divided by the duration is a number from 0 at the start of a season to 1 at its end. Turning "how far along am I?" into a fraction between 0 and 1 is one of the most useful moves in animation. It's called **normalising**, and once you have a 0-to-1 number you can drive anything with it.

## What a Season Is

Each season is a block of numbers in the `SEASONS` table. Here is winter, trimmed:

```javascript
winter: {
  name: "Winter",
  plantModifiers: {
    coastal: 0.7, grassland: 0.8, podocarp: 0.7,
    montane: 0.3, subalpine: 0.1,
    // ...
  },
  plantTypeModifiers: {
    patotara: 0.3,  // No berries, just foliage
    rimu: 0.5,      // Dormant, no fruit
    // ...
  },
  preferredElevation: { min: 0.18, max: 0.42 },
  migrationStrength: 1.0,
  hungerModifier: 1.25,
  snowLine: 0.77,
  dormancyElevation: 0.55,
  dormancyChance: 0.6,
  dormancyAbove: true
},
```

Read it as a description. In winter, plants in the subalpine biome grow at a tenth of their normal rate, while the lowland grassland manages 80%. Pātōtara has almost no food value. Moa prefer to be between elevations 0.18 and 0.42, and they want it badly (`migrationStrength: 1.0`). They get hungry 25% faster. Snow lies above 0.77.

Now compare summer: subalpine plants at 1.3, grassland at 0.3, preferred elevation 0.50 to 0.78, snow line at 0.92. It is the same landscape turned upside down. In summer the high country is rich and the lowlands are parched. In winter the tops are frozen and the low forest is the only larder.

Nothing in this table says "moa migrate". It says where food grows well and where moa are comfortable. The moa (Chapter 7) are built to go where food and comfort are. The migration is what you see when those two things are combined.

This table is also a place where you can do a great deal of design work without writing code. Every number in it is a lever on the whole ecosystem.

## The Problem With Switching

Suppose the code simply read the current season's values. At the instant summer became autumn, the snow line would jump from 0.92 to 0.85. A stripe of mountain would turn white in one frame. Every moa's preferred elevation would drop by 0.2 at once and the whole herd would wheel downhill together, like a marching band.

The real world doesn't change like that, and neither should a simulation. You want one season to blend into the next.

## lerp

The tool for blending is **linear interpolation**, which p5.js provides as `lerp(a, b, t)`:

```javascript
lerp(a, b, t)   // returns a + (b - a) * t
```

When `t` is 0 you get `a`. When `t` is 1 you get `b`. When `t` is 0.5 you get the midpoint. As `t` slides from 0 to 1, the result slides from `a` to `b` in a straight line.

If you take one thing from this chapter, take `lerp`. Give it two values and a 0-to-1 number and it gives you everything in between. It works for positions, sizes, colours (`lerpColor`), volumes, speeds, snow lines.

Here it is, sliding a snow line:

```javascript
let t = 0;

function setup() { createCanvas(400, 300); }

function draw() {
  background(120, 160, 110);
  t = (t + 0.005) % 1;
  // A 0..1 number that loops.

  const summerLine = 60, winterLine = 180;
  const snowY = lerp(summerLine, winterLine, t);

  fill(255); noStroke();
  rect(0, 0, width, snowY);
  // Snow covers everything above the line.
}
```

## The Transition Window

The game doesn't blend all season long. A season holds steady for most of its length, then turns into the next one over its final stretch. `SeasonManager.update` computes a second 0-to-1 number for that:

```javascript
update(dt = 1) {
  this.timer += dt;
  this.justChanged = false;

  const transitionStart = this.config.seasonDuration * 0.85;
  this.transitionProgress = this.timer >= transitionStart
    ? (this.timer - transitionStart) / (this.config.seasonDuration * 0.15)
    : 0;

  if (this.timer >= this.config.seasonDuration) {
    this.timer -= this.config.seasonDuration;
    this.currentSeasonIndex = (this.currentSeasonIndex + 1) % 4;
    this.transitionProgress = 0;
    this.justChanged = true;
    return true;
  }
  return false;
}
```

For the first 85% of a season, `transitionProgress` is 0. Over the last 15% it climbs steadily from 0 to 1. At the moment it reaches 1, the season index ticks over and it drops back to 0.

```
transitionProgress
1 |                          /|                         /|
  |                         / |                        / |
  |                        /  |                       /  |
0 |_______________________/   |______________________/   |___
  |<------- summer --------->|<------- autumn -------->|
                          ^ last 15%
```

Does the drop from 1 back to 0 cause a jump? No, and it's worth seeing why. Just before the changeover, the blend is "summer's value moved 100% of the way to autumn's", which is autumn's value. Just after, it's "autumn's value moved 0% of the way to winter's", which is also autumn's value. The two descriptions meet at the same number.

## The Getters: Reading a Blended World

Nobody outside `SeasonManager` reads `SEASONS` directly for gameplay values. They call a getter, and every getter has the same shape:

```javascript
getMigrationStrength() {
  const cur = this.current.migrationStrength;
  if (this.transitionProgress > 0) return lerp(cur, this.next.migrationStrength, this.transitionProgress);
  return cur;
}
```

Current season's value; if we're in the transition window, blend toward the next season's. There is a getter like this for each thing that varies:

| Getter | Used by | For |
|---|---|---|
| `getPlantModifier(biomeKey)` | plants | growth rate by biome |
| `getPlantTypeModifier(type)` | plants | food value by species of plant |
| `getPreferredElevation()` | moa | where they want to be |
| `getMigrationStrength()` | moa | how much they care |
| `getHungerModifier()` | moa | how fast they get hungry |
| `getSnowLineElevation()` | renderer | where snow is painted (see the note on two snow lines below) |
| `getForestBand()` | forest trees | the elevations where forest is productive |
| `getWinterness()` | many | how wintry it is, 0 to 1 |

Because every reader gets a blended value, the whole world glides. The snow line descends over the last few seconds of autumn. Plant growth in the high country tails off. Each moa's preferred elevation drifts down, and since each moa is at a slightly different height with a slightly different hunger, they peel off downhill one by one instead of all at once.

This is the pattern from Chapter 4 again, generalised: **the season is a moving threshold, checked at read time**. No plant is told "it's winter now". Each plant asks, when its turn comes, "what's my growth modifier at the moment?" and gets back a number that happens to be a bit lower than last time.

### A note on allocation

Look at `getPreferredElevation`:

```javascript
getPreferredElevation() {
  const cur = this.current.preferredElevation;
  const result = this._elevationResult;

  if (this.transitionProgress > 0) {
    const nxt = this.next.preferredElevation;
    result.min = lerp(cur.min, nxt.min, this.transitionProgress);
    result.max = lerp(cur.max, nxt.max, this.transitionProgress);
  } else {
    result.min = cur.min;
    result.max = cur.max;
  }
  return result;
}
```

It returns an object with `min` and `max`. It would be natural to write `return { min: ..., max: ... }`. But this is called by every moa every frame, and that would be sixty new objects a frame. So it fills in one object that belongs to the manager, `_elevationResult`, and returns that. It's the scratch-vector idea from Chapter 2, with the same warning attached: read the values out before you call it again, and never keep the object.

There's a comment in the source warning against a tempting tidy-up:

```javascript
// Each getter inlines the current->next transition blend directly. Do NOT extract a
// closure-taking helper; it allocated per call on a per-entity, per-frame path.
```

Someone once wrote a neat `_blend(fn)` helper that took a little function saying which property to read. Creating that little function on every call was the cost. In code that runs thousands of times a frame, repetition that allocates nothing beats elegance that does.

### Exercise 5.1

Extend the snow sketch into a four-season clock. Keep an array of four snow-line heights, a `timer`, a `seasonIndex` and a `transitionProgress` computed as in the game. Draw the season's name. Check by eye that there's no jump at the changeover. Then change the transition window from the last 15% to the last 50%, and to the last 2%.

## Winterness: A Derived Signal

Several things in the game should happen "in winter": frost on the ground, harder competition for food, slower breeding. If each of those checked `currentKey === 'winter'`, they would all switch on with a snap at the boundary. So the manager offers a smooth measure of how wintry it is:

```javascript
getWinterness() {
  const k = this.currentKey;
  if (k === 'winter') {
    return this.nextKey === 'spring' ? 1 - this.transitionProgress : 1;
  }
  if (k === 'autumn' && this.transitionProgress > 0 && this.nextKey === 'winter') {
    return this.transitionProgress;
  }
  return 0;
}
```

It's 0 through spring, summer and most of autumn. It ramps up to 1 over the end of autumn, holds at 1 through winter, and ramps back down to 0 over the end of winter.

```
winterness
1 |                    ___________________
  |                   /                   \
0 |__________________/                     \____________
  | summer |  autumn  |      winter        |  spring  |
```

Then anything that should depend on winter multiplies by it. Here is the renderer laying frost on the ground:

```javascript
const _frost = this.seasonManager.getWinterness();
if (_frost > 0.001) {
  fill(216, 232, 245, 72 * _frost);
  rect(0, 0, this.terrain.mapWidth, this.terrain.mapHeight);
}
```

And here is a moa's niche-stress penalty getting worse in the cold:

```javascript
penalty *= 1 + ((LEVEL_MECHANICS.winterStressMult ?? 1.4) - 1) * sc.winterness;
```

That last line has a shape you'll see repeatedly: `1 + (mult - 1) * amount`. When `amount` is 0 the result is 1, no change. When `amount` is 1 the result is `mult`, the full effect. In between, it's partway. It is `lerp(1, mult, amount)` written out. Use it whenever you have a multiplier you want to fade in.

The lesson of `getWinterness` is to **derive one clean 0-to-1 signal and let many things read it**, instead of having many things each work out for themselves whether it's winter.

## The Forest Band

The glacial levels add a seasonal effect that shows the pattern at full stretch. In the cold, the forest shrinks. Trees at the edges of the forest's elevation range stop being productive, and what was a broad band becomes a thin refuge.

A level describes this with a band per season:

```javascript
forestBandBySeason: {
  spring: { min: 0.36, max: 0.48 },
  summer: { min: 0.36, max: 0.48 },
  autumn: { min: 0.36, max: 0.45 },
  winter: { min: 0.36, max: 0.42 }
}
```

`getForestBand()` returns the blended band for this moment, `lerp`ing `min` and `max` separately, and each forest tree checks itself against it (Chapter 6):

```javascript
const band = seasonManager.getForestBand();
if (band && (this.elevation < band.min || this.elevation > band.max)) {
  this.suppressed = true;
  this.nutrition = 0;
  return;
}
```

A tree at elevation 0.46 is productive all summer. As autumn ends, the band's top slides from 0.48 down through 0.46, and at that moment the tree goes quiet. Each tree's turn comes at a slightly different time because each stands at a slightly different height, so the treeline visibly creeps downhill.

The band getter also shows one more optimisation:

```javascript
if (this._fbFrame === frameCount) return this._fbCache;
// ... compute band ...
this._fbFrame = frameCount;
this._fbCache = band;
return band;
```

Hundreds of trees ask for the band in the same frame, and the answer is the same for all of them. So the manager computes it the first time it's asked in a frame, remembers the frame number, and hands back the stored answer for the rest of that frame. This is **per-frame caching**. It's the cheapest form of the dirty-flag idea from Chapter 3: the cache is "dirty" whenever the frame number has moved on.

## A Climate That Deepens

Free Play runs for many years, and each year's winter should be a little harder than the last, with easier years in between so the player can recover. That needs a number that changes from year to year: how cold is this year?

The game calls it `coldIndex`, 0 for a mild year and 1 for the depth of a glacial. It comes from `ClimateDrift` in `mauri_climate_drift.js`, and this file is a good one to study because it does a single thing with no dependencies at all. It's a **pure function**: you give it a year number and it gives back a severity. It reads nothing else and changes nothing.

```javascript
severityOfCycle(cycle, cfg) {
  if (cycle <= 0) return cfg.warmFloor;         // opening year is the easy one
  const ceil = this.ceilingAt(cycle, cfg);      // how deep glacials have grown
  const wave = this._starkWave(cycle, cfg);     // where in the oscillation this year sits
  const idx = ceil * (cfg.baselineFrac + (1 - cfg.baselineFrac) * wave);
  return this._clamp(idx, cfg.warmFloor, cfg.coldCap);
}
```

It multiplies two curves.

The **wave** goes up and down with a period of three years. It's built from a cosine:

```javascript
const raw = 0.5 - 0.5 * Math.cos((2 * Math.PI * cycle) / cfg.periodYears + cfg.phaseOffset);
```

`Math.cos` swings between −1 and 1 as its input grows. `0.5 - 0.5 * cos(...)` turns that into a swing between 0 and 1 that starts at 0. The division by `periodYears` sets how many years one full swing takes. Whenever you need something that rises and falls regularly, such as a pulse, a sway or a day-night cycle, a sine or cosine wrapped like this is the place to start.

The **ceiling** grows from 0 to 1 over the first ten years and then stays there:

```javascript
ceilingAt(cycle, cfg) {
  return cfg.coldCap * this._smoothstep(0, cfg.rampCycles, cycle);
}
```

Multiply them and you get an oscillation whose peaks get taller over time: mild cold snaps early in a run, brutal ones later, with relief between.

### smoothstep

The ceiling uses a function that deserves a proper introduction, since it appears in the terrain, the camera, the climate and the shaders:

```javascript
_smooth01(x) { const t = this._clamp(x, 0, 1); return t * t * (3 - 2 * t); }
```

`t * t * (3 - 2 * t)` takes a number from 0 to 1 and returns a number from 0 to 1, but bent into an S-shape. It starts slowly, speeds up through the middle, and slows into the end. Compare the two:

```
linear (lerp's t)          smoothstep
1 |        /               1 |        _--
  |      /                   |      /
  |    /                     |    /
  |  /                       |  /
0 |/                       0 |--'
```

A straight line starts and stops abruptly. The S-curve eases in and eases out. If you feed `lerp` a smoothstepped `t` instead of a raw one, a movement that looked mechanical looks natural. The camera in Chapter 15 does exactly this.

`ClimateDrift` even applies it twice in a row to square the wave's shoulders, so that cold years stay cold for longer and the turn between cold and mild is sharper. The comment calls the result a trapezoid.

### Folding it in

The season manager stores `coldIndex` (the game sets it each frame from the year number) and folds it into the winter end of its getters:

```javascript
getSnowLineElevation() {
  const cur = this.current.snowLine;
  let sl = (this.transitionProgress > 0) ? lerp(cur, this.next.snowLine, this.transitionProgress) : cur;
  // Free Play: a deepening glacial pushes the snow line down, most in winter.
  if (this.coldIndex > 0) {
    sl -= this.coldIndex * this.CLIMATE_SNOW_DROP * (0.5 + 0.5 * this.getWinterness());
    if (sl < 0.5) sl = 0.5;
  }
  return sl;
}
```

A harsh year lowers the snow line, by up to 0.2 of elevation in the dead of winter and half that in summer. The same year raises winter hunger and squeezes the forest band. Because all three getters read the one `coldIndex`, a single number turns the whole climate up or down, and nothing downstream needed to change: plants and moa were already calling the getters.

### Two snow lines

A surprise worth knowing about before it confuses you. There are two methods called `getSnowLineElevation`, and they are not the same number.

`SeasonManager.getSnowLineElevation()`, above, includes the climate. The GPU terrain shader reads it to decide where to paint snow.

`TerrainGenerator.getSnowLineElevation()` is the one `isWalkable` uses. It keeps its own table, `seasonSnowLines`, which a level can override in its `terrain` block, and it blends between seasons with the same `transitionProgress`. It does not include `coldIndex`.

So in a deep-glacial Free Play year, the snow you see can sit lower than the snow that blocks a moa. Whether that's a bug or a kindness to the player is a design question. If you want them to agree, the terrain's version is the one to change, and now you know where both live.

Notice what was *not* done. The `SEASONS` table is never edited. The climate is applied at the moment of reading. That means there is nothing to undo when the level restarts, and the authored season values stay as the designer wrote them. Keeping your source data untouched and layering adjustments on at read time saves a whole class of bugs where a value gets modified, then modified again, and nobody can say what it was supposed to be.

### Exercise 5.2

Plot `ClimateDrift.severityOfCycle` for years 0 to 30. You can load the file in a sketch (add a `<script src="mauri_climate_drift.js">` tag to a local sketch's `index.html`) or copy the object in. Draw a bar per year. Then change `periodYears` to 5, `starkness` to 0, and `baselineFrac` to 0.6, one at a time.

### Exercise 5.3

Write a function `ease(t)` three ways: returning `t`, returning `t * t * (3 - 2 * t)`, and returning `t * t`. Animate three circles from left to right using `lerp(50, 350, ease(t))` with each. Which looks like something being thrown? Which looks like something being placed?

## When the Season Does Change

Almost everything reads blended values. A few things do care about the instant of change, and for those `update` returns `true` and sets `justChanged` for that one frame.

`Game.update` uses the return value:

```javascript
if (this.seasonManager.update(_seasonDt)) this.onSeasonChange();
```

`Game.onSeasonChange` plays a sound, posts a message, and fires a tutorial event. The simulation checks `justChanged` and runs its own `onSeasonChange`, which rolls dice for each plant to decide whether it goes dormant (Chapter 6).

So the manager offers two ways to listen: a continuous signal you can read at any time, and a one-frame pulse at the boundary. Use the continuous one for anything the player should see change gradually. Use the pulse for things that are naturally discrete: a notification, a sound, a roll of the dice.

## Summary

- A season clock is an accumulating timer and an index that wraps with `% 4`.
- Each season is a table of numbers: growth by biome, food value by plant, where moa want to be, how hungry they get, where the snow lies.
- `lerp(a, b, t)` blends between two values with a 0-to-1 number.
- `transitionProgress` is 0 for most of a season and ramps to 1 over the last 15%. Every getter lerps toward the next season by it, so nothing jumps.
- The world reads seasonal values at the moment it needs them. Nothing is pushed out to plants or animals.
- `getWinterness()` is one smooth 0-to-1 signal that many effects multiply by.
- `1 + (mult - 1) * amount` fades a multiplier in.
- `t * t * (3 - 2 * t)` (smoothstep) eases in and out.
- `ClimateDrift` is a pure function of the year: a cosine wave times a growing ceiling. It's applied at read time, never written into the season table.
- Returning a shared result object and caching per frame keep the getters cheap.

## The Mauri Project

Build a season dial for debugging, then bend the calendar.

1. In `mauri_lens.js`, register a lens with `id: 'seasonDebug'` that has a `drawScreen(game)` method (screen-space, drawn over the HUD). In it, draw a small panel showing, as text: `game.seasonManager.currentKey`, `progress`, `transitionProgress`, `getWinterness()`, `getSnowLineElevation()`, and `getPreferredElevation()`'s `min` and `max`, each to two decimal places with `.toFixed(2)`.
2. Play a level with the lens on and fast-forward. Watch the numbers through one whole autumn-to-winter transition. At what `progress` does `transitionProgress` leave zero?
3. In `mauri_seasons.js`, the transition window is the `0.85` and `0.15` in `update`. Pull them out into a single property, `this.transitionFrac = 0.15`, and write both uses in terms of it. Then try 0.5. How does a slow change of season alter the feel of the migration?
4. In the `SEASONS` table, swap summer's and winter's `preferredElevation`. Before you run it, predict what the moa will do and whether they'll survive. Then see. (Put it back.)
5. Stretch: add a fifth getter, `getDayLight()`, that returns a 0-to-1 value which is high in summer and low in winter, using `Math.cos` on the fraction of the year elapsed. The fraction of the year is `(currentSeasonIndex + progress) / 4`. Show it on your lens. You won't use it for anything yet; Chapter 15 has a place it could go.
