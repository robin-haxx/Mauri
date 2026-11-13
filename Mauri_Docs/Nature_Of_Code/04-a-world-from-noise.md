# Chapter 4: A World From Noise

> Whāia te iti kahurangi; ki te tūohu koe, me he maunga teitei.
>
> Seek the treasure you value most dearly; if you bow your head, let it be to a lofty mountain.
> — whakataukī

*Builds on Chapter 3 (flat arrays).*

Nobody drew the map of Kahurangi. Each time you start a level, the game invents a new one: a coast, lowlands, a band of forest, tussock slopes, bare rock, and snow on the tops. It does this in about a second, from a handful of numbers, and it has to produce land that an ecosystem can live on. Too much sea and the moa have nowhere to go. No forest and they starve in winter. A wall of mountains across the middle and half the herd is cut off from the other half.

This chapter is about how you grow a landscape from random numbers and then teach the rest of the game to read it. The code is `TerrainGenerator` in `mauri_terrain.js`. The part that decides the shape of the land is short, about a hundred lines. The rest of that long file is about painting it, which waits for Chapter 15.

## Height Is Everything

Here is the single design decision that makes the terrain system simple. The land is described by **one number per point: its elevation**, from 0 at the bottom of the sea to 1 at the highest peak. Everything else is derived from that number.

- Is it sea? Elevation below 0.1.
- Is it forest? Elevation between 0.3 and 0.4.
- Can a moa walk there? Depends on the biome, which depends on the elevation.
- Is there snow? Elevation above the snow line.
- How fast can a moa climb it? Depends on how quickly elevation changes.

So the question "how do I generate a world?" becomes "how do I generate a believable elevation for every point?". And for that there is a classic tool.

## Noise

You met `noise()` in Chapter 2, steering a wandering moa. Give it one number and it returns a smoothly varying value between 0 and 1. Give it *two* numbers, an x and a y, and it does the same thing across a surface: nearby points get similar values, far-apart points get unrelated ones. Treat the value as a height and you have rolling hills.

```javascript
function setup() {
  createCanvas(400, 400);
  noLoop();
  loadPixels();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const e = noise(x * 0.01, y * 0.01);
      // Elevation at this pixel, 0..1.
      const i = (y * width + x) * 4;
      pixels[i] = pixels[i + 1] = pixels[i + 2] = e * 255;
      // Grey: dark is low, light is high.
      pixels[i + 3] = 255;
    }
  }
  updatePixels();
}
```

The `0.01` is the important number. It's the **noise scale**. `noise()` changes meaningfully about once per unit of its input. Multiply pixel coordinates by 0.01 and the features are about 100 pixels across. Use 0.1 and they're 10 pixels across: a rash of little bumps. Use 0.001 and the whole canvas is one gentle slope. The game's default is `noiseScale: 0.005`, so its largest landforms are about 200 world units wide, a good fraction of a map that's around 550 wide.

Run that sketch and you get something that looks like clouds, or a blurry photo of dunes. It doesn't look like mountains yet. It's too smooth. Real terrain has big shapes with smaller shapes on them, and smaller shapes on those.

### Exercise 4.1

Run the sketch with noise scales of 0.1, 0.02, 0.005 and 0.001. Then add `noiseSeed(42)` at the top of `setup()` and reload a few times. Change 42 to something else.

## Fractal Noise: Octaves

The fix is to add several layers of noise together. The first layer is large and tall: the mountain ranges. The second is twice as fine and half as tall: the hills on the ranges. The third is finer and shorter again: the bumps on the hills. Each layer is called an **octave**, borrowing from music, where an octave doubles the frequency.

This goes by the name **fractal noise** or **fBm** (fractional Brownian motion). Here is the game's version, exactly as it appears:

```javascript
fractalNoise(x, y) {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  const noiseScale = this.config.noiseScale;
  const seed = this.seed;
  const persistence = this.config.persistence;
  const lacunarity = this.config.lacunarity;
  const octaves = this.config.octaves;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency * noiseScale + seed,
                   y * frequency * noiseScale + seed) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return total / maxValue;
}
```

Three parameters shape the result, and they are the first three numbers in every level file's `terrain` block.

**`octaves`** is how many layers. The game uses 3. More octaves add finer detail and cost more time.

**`lacunarity`** is how much finer each layer is than the last. The frequency is multiplied by it each time round. A value of 2 is conventional. The game uses 3.0, so each octave's features are a third the size of the previous one's.

**`persistence`** is how much shorter each layer is. The amplitude is multiplied by it each time. The game uses 0.3: the second octave contributes 30% as much height as the first, the third 9%. Low persistence gives smooth, sweeping land with a little texture. High persistence (0.7, say) gives craggy, noisy land.

Two details. `maxValue` adds up the amplitudes so that the final division brings the result back into the 0-to-1 range whatever the settings. And `seed`, a random number chosen when the terrain is created, is added to the coordinates. `noise()` is a fixed infinite landscape; adding a seed slides the window you're looking through to a different part of it. That's why every level start gives new land.

### Exercise 4.2

Replace `noise(x * 0.01, y * 0.01)` in the sketch with a `fractalNoise(x, y)` function of your own, using noise scale 0.005. Try octaves 1, 3 and 6. With 3 octaves, try persistence 0.3 and 0.7, and lacunarity 2 and 3.

## Ridges

Fractal noise makes rounded hills. The Southern Alps aren't rounded. They have sharp crests with valleys between. You can get that from the same noise with one line of arithmetic:

```javascript
ridgeNoise(x, y) {
  const n = this.fractalNoise(x * 0.5, y * 0.5);
  return 1 - Math.abs(n * 2 - 1);
}
```

Follow a value through it. Noise is between 0 and 1. `n * 2 - 1` stretches that to between −1 and 1. `Math.abs` folds the negative half up, so everything is between 0 and 1 again, but now with a sharp V-shaped crease wherever the noise crossed its middle value. `1 -` flips the V upside down into a peak.

```
noise:      ~~~~~/\~~~~~\      /~~~~      smooth waves through 0.5
                   \     \____/

abs fold:   \    /\    /\    /            creases where it crossed the middle
             \  /  \  /  \  /
              \/    \/    \/

1 - fold:     /\    /\    /\              creases become sharp ridgelines
             /  \  /  \  /  \
```

The places where smooth noise happened to pass through 0.5 form long wandering curves across the map, and those curves become ridgelines. It's a lovely trick: the same noise, bent, gives a completely different landform.

## Putting the Shape Together

Now the function that produces the final elevation for any point:

```javascript
getElevation(x, y) {
  const base = this.fractalNoise(x, y);
  const ridge = this.ridgeNoise(x, y);
  let elevation = base * (1 - this.config.ridgeInfluence) + ridge * this.config.ridgeInfluence;
  elevation = Math.pow(elevation, this.config.elevationPower);

  if (this.config.useLakes) {
    elevation = this._applyLakeBasins(x, y, elevation);
  } else {
    const falloff = this.getIslandFalloff(x, y);
    elevation *= falloff;
  }
  // ... (a few level-specific adjustments) ...
  return Math.max(0, Math.min(1, elevation));
}
```

There are four steps here.

**Blend hills and ridges.** `ridgeInfluence` mixes the two. At 0 the land is all rolling hills; at 1 it's all ridges. The line is a `lerp` written out by hand: `a * (1 - t) + b * t`.

Here's a curiosity. The game's default `ridgeInfluence` is 1.3, which is more than 1. Put 1.3 into the formula: `base * (-0.3) + ridge * 1.3`. The hills are *subtracted* a little and the ridges exaggerated. A blend factor outside 0 to 1 is called extrapolation, and it's a legitimate way to push a look further than either ingredient. It also means the result can leave the 0-to-1 range, which is one reason the function clamps at the end.

**Reshape with a power.** `Math.pow(elevation, 1.5)`. Raising a number between 0 and 1 to a power above 1 pushes it down: 0.5 becomes 0.35, 0.8 becomes 0.72, while 1 stays 1. Low and middle ground gets flattened and only the highest ground stays high. That gives broad lowlands with peaks standing out of them, where raw noise gives a landscape that is all mid-height. An `elevationPower` below 1 does the opposite and makes plateaus.

**Make it an island.** This is the largest step, and I'll take it on its own below.

**Clamp.** `Math.max(0, Math.min(1, elevation))` forces the result into 0 to 1. p5.js has `constrain()` for this; the game writes it out because `getElevation` is called hundreds of thousands of times while a level loads.

### The island falloff

Noise has no idea where the edges of your map are. Left alone it puts a mountain on the border as happily as anywhere else. The game wants a specific large-scale shape: sea on the west, rising eastward through lowlands and forest to the alps. That's the west coast of the South Island, seen from above.

The technique is to compute a second value for each point, a **falloff** between 0 and 1 that says "how high is land allowed to be here?", and multiply the noise by it. `getIslandFalloff` builds one in a few moves. Stripped of its tuning options:

```javascript
getIslandFalloff(x, y) {
  const nx = x / this.worldW;
  // 0 at the west edge, 1 at the east edge.

  const warpX = noise(x * 0.01 + this.seed, y * 0.01) * 0.2;
  const warpedNx = nx + warpX - 0.1;
  // Push each point a little east or west, by noise.

  let coastNoise = /* three noise samples added together */;
  const coastlinePosition = 0.02 + coastNoise * 0.4;
  // Where the coast is, at this latitude.

  let falloff;
  if (warpedNx < coastlinePosition) {
    const seaDepth = (coastlinePosition - warpedNx) / coastlinePosition;
    falloff = (1 - seaDepth) * 0.12;
    // West of the coast: sea, deeper further out.
  } else {
    const landProgress = (warpedNx - coastlinePosition) / (1 - coastlinePosition);
    falloff = 0.13 + Math.pow(landProgress, 0.7) * 0.87;
    // East of the coast: rising toward the alps.
  }
  // ...
  return Math.max(0, Math.min(1, falloff));
}
```

At its heart this is a ramp from west to east. If it were only a ramp, the coast would be a ruler-straight vertical line. Two uses of noise prevent that.

The coastline's position is itself decided by noise, sampled along the north-south direction, so the coast wanders in and out as you go down the map: bays and headlands.

And the point's own x coordinate is nudged by noise before it's compared. This is called **domain warping**: instead of adding noise to the output of a function, you add noise to its *input*. It makes straight features wobble in an organic way, and it's worth remembering as a general technique. Whenever something procedural looks too regular, try warping its coordinates.

West of the coast the falloff is at most 0.12; east of it, at least 0.13. Since sea is defined as elevation below 0.1 and the noise it multiplies is at most 1, the coast really does fall where this function says.

### Exercise 4.3

Add a falloff to your sketch: `const falloff = x / width;` and multiply. You should see land rising to the right behind a straight coast. Now make the coast wander by computing `const coast = 0.2 + noise(y * 0.01) * 0.3` and building the falloff from `(x / width - coast)`. Finally warp `x` with a little noise before using it.

## From a Function to a Map

`getElevation(x, y)` can produce the height of any point. But it calls `noise()` a dozen or more times and does a fair bit of arithmetic. Every moa asks for the height under its feet several times a frame. You can't afford to recompute it.

So when a level loads, the game works out the elevation once for every cell of a grid covering the map and stores the answers. This is a **height map**.

```javascript
_genHeightMap() {
  const gridCols = this.gridCols;
  const gridRows = this.gridRows;
  const scale = this.scale;
  this.heightMap = new Float32Array(gridCols * gridRows);
  let idx = 0;
  for (let row = 0; row < gridRows; row++) {
    const y = row * scale;
    for (let col = 0; col < gridCols; col++) {
      this.heightMap[idx] = this.getElevation(col * scale, y);
      idx++;
    }
  }
}
```

It's the flat-array layout from Chapter 3: one long array, with the cell at `(col, row)` stored at index `row * gridCols + col`.

`Float32Array` is a **typed array**. An ordinary JavaScript array can hold anything in each slot: numbers, strings, objects. That flexibility costs memory and speed. A typed array holds only numbers of one fixed kind, packed tightly, and you must say how many up front. For a couple of hundred thousand elevations that never change in number, it is the right container. You read and write it with square brackets like any array.

Now a lookup is a multiplication and an array read:

```javascript
getElevationAt(x, y) {
  const col = ((x + this._activeOriginX) * this.invScale) | 0;
  const row = ((y + this._activeOriginY) * this.invScale) | 0;
  if (col < 0 || row < 0 || col >= this.gridCols || row >= this.gridRows) return 0.5;
  return this.heightMap[row * this.gridCols + col];
}
```

You've seen every piece of this in Chapter 3: multiply by the inverse of the cell size, floor with `| 0`, check bounds, index the flat array. (`_activeOriginX` is zero on an ordinary level. I'll explain it under "A bigger world" below.)

This is the general bargain called **precomputation** or **baking**: spend time once, up front, to make a table, so that the question can be answered instantly ever after. It works whenever the answer doesn't change. The game leans on it heavily. Chapter 15 bakes whole images of the terrain; `PlantStatics` bakes a table of sine values.

## Biomes Are Bands

With a height for every cell, the map needs to be sorted into kinds of country. In the game a **biome** is nothing more than a range of elevations with some properties attached. Here are three from `BIOMES` in `mauri_sketch.js`:

```javascript
grassland: {
  key: 'grassland', name: "Lowland Grassland", minElevation: 0.15, maxElevation: 0.3,
  colors: ['#7fb069', '#8fbc79', '#9fc889'], contourColor: '#658c53',
  walkable: true, canHavePlants: true, plantTypes: ['tussock', 'flax'], canPlace: true
},
podocarp: {
  key: 'podocarp', name: "Podocarp Forest", minElevation: 0.3, maxElevation: 0.4,
  colors: ['#2d5a3d', '#346644', '#3b724b'], contourColor: '#295438',
  walkable: true, canHavePlants: true, plantTypes: ['fern', 'rimu'], canPlace: true
},
alpine: {
  key: 'alpine', name: "Alpine Rock", minElevation: 0.77, maxElevation: 0.9,
  colors: ['#8b8b8b', '#9a9a9a', '#a9a9a9'], contourColor: '#696969',
  walkable: false, canHavePlants: false, canPlace: false
},
```

Classifying a point is a loop that finds the band it falls in:

```javascript
getBiomeFromElevation(elevation) {
  for (let i = 0; i < this.biomeList.length; i++) {
    const biome = this.biomeList[i];
    if (elevation >= biome.minElevation && elevation < biome.maxElevation) {
      return biome;
    }
  }
  return this.biomeList[this.biomeList.length - 1];
}
```

Because elevation rises from west to east, the biomes fall in stripes: beach, grassland, forest, tussock, rock, snow. Because the noise makes the rise irregular, the stripes bend and break up and leave islands of one inside another. You get a believable vegetation map without writing a single rule about vegetation.

The biome object is where the land's *rules* live. `walkable` decides where animals can go. `canPlace` decides where the player can put things. `plantTypes` decides what grows. Change `walkable` to `true` on `alpine` and moa will stroll over the tops. A level can supply its own set of biomes with different bands (the glacial levels do: they have a narrow `forestRefuge` band from 0.33 to 0.48 and wide cold flats), and none of the code that reads biomes has to change.

As with heights, the classification is done once and stored:

```javascript
this.biomeIndexMap = new Uint8Array(gridCols * gridRows);
```

A `Uint8Array` holds whole numbers from 0 to 255, one byte each. Each cell stores not the biome object but its *position in the list of biomes*: 0 for sea, 1 for coastal, and so on. The lookup turns that back into the object:

```javascript
getBiomeAt(x, y) {
  // ... col, row as before ...
  return this.biomeArray[this.biomeIndexMap[row * this.gridCols + col]];
}
```

Storing a small index instead of a reference is another common space-saver: one byte per cell instead of a pointer per cell.

### Exercise 4.4

Colour your sketch by biome. Make an array of `{ max, color }` bands and, for each pixel, find the first band whose `max` exceeds the elevation. Tune the bands until it looks like somewhere. Then change `elevationPower` and watch the proportions of each biome shift.

## The Questions Everyone Asks

The rest of the game talks to the terrain through a handful of methods, and it is worth knowing them by heart, because you'll call them in almost anything you write.

| Method | Answers |
|---|---|
| `getElevationAt(x, y)` | The height here, 0 to 1 |
| `getBiomeAt(x, y)` | The biome object here |
| `getEffectiveBiomeAt(x, y)` | The biome here *right now*, counting seasonal snow |
| `isWalkable(x, y)` | Can a ground animal stand here right now? |
| `canPlace(x, y)` | Can the player put something here? |
| `isWater(x, y)` | Is this sea or lake? |
| `isInBounds(x, y)` | Is this on the map at all? |

`avoidUnwalkable` from Chapter 2 calls `isWalkable` once on a clear path and thirteen times on a blocked one. The moa's uphill slowdown calls `getElevationAt` twice:

```javascript
getTerrainSpeedMultiplier() {
  // ... dirX, dirY = unit direction of travel ...
  const lookAhead = 3;
  const currentElev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
  const aheadElev = this.terrain.getElevationAt(this.pos.x + dirX * lookAhead,
                                                this.pos.y + dirY * lookAhead);
  const slope = (aheadElev - currentElev) / lookAhead;

  return slope > 0
    ? Math.max(0.35, 1 - slope * 6)      // uphill: much slower
    : Math.min(1.2, 1 - slope * 2);      // downhill: a little faster
}
```

Height here minus height a little way ahead, divided by the distance, is the slope in the direction of travel. That one subtraction is why moa labour up to the tussock in spring and hurry down in autumn. Nothing was written about climbing; it falls out of having a height map.

## Snow: Moving a Threshold

In winter, snow comes down the mountains and closes ground that was open in summer. The clumsy way to do that would be to reclassify every cell of the biome map each time the season turned. The game does something much lighter.

```javascript
getEffectiveBiomeAt(x, y) {
  if (this._snowBiome) {
    const elevation = this.getElevationAt(x, y);
    if (this.isSeasonalSnow(elevation)) return this._snowBiome;
  }
  return this.getBiomeAt(x, y);
}

isWalkable(x, y) {
  return this.getEffectiveBiomeAt(x, y).walkable;
}
```

The stored biome map never changes. There is one extra number, the **snow line**, an elevation that moves with the seasons: 0.92 in summer, 0.77 in winter by default. When asked about a point, the terrain first checks whether the point is above the snow line. If so, it's snow, whatever the map says. Otherwise, the map's answer stands.

So the whole seasonal advance and retreat of the snow, as far as the simulation is concerned, is one number sliding up and down. No cell is ever rewritten. The game's own notes call this the key pattern: *move a threshold, don't rebuild the world*. Chapter 5 shows how the number is made to slide smoothly, and Chapter 6 uses the same pattern to shrink the forest in winter.

When you want something in the world to change with time, look first for a way to express it as a threshold against data you've already got.

## Which Land Is Connected?

Here is a problem that only shows up once animals live on the land. Two moa stand 80 units apart. Between them runs a ridge of bare rock with no pass through it. To the code, they're close. To the moa, they might as well be on different islands. If one courts the other, it will walk into the foot of the ridge and stand there until it starves.

The game hit exactly this, and the fix is recorded in `MISTAKES.md`. What's needed is a way to ask: *can something walk from A to B at all?* Answering that for arbitrary pairs by searching for a path each time would be slow. But there's a neat way to precompute it for the whole map at once.

Give every patch of walkable ground a number, such that two cells have the same number exactly when you can walk between them. These are called **connected components**, and the algorithm that finds them is **flood fill**, the same thing a paint program's bucket tool does.

```javascript
function labelLandRegions(walk, cols, rows) {
  const N = cols * rows, ids = new Int32Array(N).fill(-1), sizes = [];
  const stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (!walk[s] || ids[s] !== -1) continue;
    // Find a walkable cell that hasn't got a label yet...
    const id = sizes.length;
    let top = 0, n = 0;
    ids[s] = id;
    stack[top++] = s;
    while (top) {
      const i = stack[--top], c = i % cols;
      n++;
      // ...and spread its label to every walkable neighbour, and theirs, and theirs.
      if (c > 0 && walk[i - 1] && ids[i - 1] === -1) { ids[i - 1] = id; stack[top++] = i - 1; }
      if (c < cols - 1 && walk[i + 1] && ids[i + 1] === -1) { ids[i + 1] = id; stack[top++] = i + 1; }
      if (i >= cols && walk[i - cols] && ids[i - cols] === -1) { ids[i - cols] = id; stack[top++] = i - cols; }
      if (i + cols < N && walk[i + cols] && ids[i + cols] === -1) { ids[i + cols] = id; stack[top++] = i + cols; }
    }
    sizes.push(n);
  }
  // ...
  return { ids, sizes, count: sizes.length, largest };
}
```

`walk` is a grid of 1s (walkable) and 0s. The outer loop scans for a walkable cell with no label. When it finds one, it starts a new region, gives the cell that region's number, and puts it on a **stack**, a to-do list. Then, while the to-do list isn't empty, it takes a cell off, looks at its four neighbours (left is `i - 1`, right is `i + 1`, up is `i - cols`, down is `i + cols`, thanks to the flat layout), and for each one that is walkable and unlabelled, labels it and adds it to the list. When the list empties, one whole connected region has been painted. The outer loop carries on looking for the next unlabelled cell.

Each cell is labelled exactly once, so the whole map is done in one pass. After that:

```javascript
connected(a, b, snow = 'now') {
  const ra = this.regionNear(a, snow);
  return ra >= 0 && ra === this.regionNear(b, snow);
}
```

"Can a bird at `a` walk to `b`?" is two array lookups and a comparison.

The terrain caches the labelling and only redoes it when the land or the snow line changes, since snow can close a pass. And you can see the regions: press **D**, then **L**, and turn on the land regions lens. Each connected stretch is tinted its own colour.

### Exercise 4.5

Add flood fill to your biome sketch. Build a `walk` array from your biome bands, label the regions, and tint each region a different hue. Then raise the bottom of your "rock" band until the map splits in two.

## Fitting the Land to a Window

A randomly generated map is a gamble. On a big map the odds are good: there'll be some of everything. The story levels use a small window, and a small window of random terrain can easily come out all forest or all ice.

`_fitElevationWindow` handles this with a bit of statistics. A level can say: "I want the lowest tenth of this window to sit at elevation 0.3, and the highest tenth at 0.7."

```javascript
// samples: a few hundred elevations taken across the window, then sorted
const q = (p) => samples[Math.round(p * (samples.length - 1))];
const eLo = q(0.1), eHi = q(0.9);
const a = (fit.hi - fit.lo) / (eHi - eLo);
this._elevFit = { a, b: fit.lo - a * eLo };
```

It samples the raw terrain, sorts the samples, and reads off the value a tenth of the way through the sorted list and the value nine-tenths through. Those are **quantiles**: "the height that 10% of the land lies below". Then it finds the straight line `a * e + b` that maps those two heights onto the two targets, and `getElevation` applies that line to everything.

The land keeps its random shape, every ridge and hollow in the same place. It has been stretched vertically so that the mix of biomes is what the level needs. This is a useful general idea: when random output must meet a requirement, measure it and rescale it, instead of rerolling until you get lucky.

## A Bigger World

Free Play uses one more trick. Its land is twice as wide and twice as tall as the screen, a 2 × 2 grid of "areas", and each in-game year the camera pans to the next area. The height map covers the whole world. The simulation only ever works in the window currently on screen, in coordinates that start at (0, 0) at the window's top-left.

That is what `_activeOriginX` in `getElevationAt` was for. It's the world position of the current window's corner. Adding it converts a window coordinate into a world coordinate before the height map is read. Every animal believes it lives on a map the size of the screen, and the terrain quietly looks up the right slice of the larger land.

This is worth pausing on, because it shows the value of going through a small set of lookup functions. A whole scrolling world was added to the game, and not one line of animal code had to learn about it.

## Summary

- The land is one number per point, elevation 0 to 1. Everything else is derived.
- `noise(x, y)` gives smooth random values. The noise scale sets feature size.
- Fractal noise adds octaves: each `lacunarity` times finer and `persistence` times shorter.
- `1 - abs(n * 2 - 1)` folds smooth noise into sharp ridges.
- `getElevation` blends hills and ridges, reshapes with a power, multiplies by an island falloff, and clamps.
- The falloff is a west-to-east ramp with a noisy coastline and warped coordinates.
- Heights are computed once into a `Float32Array` height map; lookups are an array read.
- A biome is an elevation band with properties (`walkable`, `canPlace`, `plantTypes`).
- Seasonal snow is a moving threshold checked at lookup time. The stored map never changes.
- Flood fill labels connected walkable ground, so "can A reach B?" is a comparison.
- Quantiles let a level stretch random land to fit the biomes it needs.

## The Mauri Project

Make your own country.

1. Copy `levels/level_01_kahurangi.js` to `levels/level_99_sandbox.js`. Change the `const` name, the `id` (to `'sandbox'`), the `name`, and `menu.title`. Add a `<script>` tag for it in `index.html` after the other level files. Reload and check it appears in the level select.
2. In its `terrain` block, change one number at a time and restart the level after each:
   - `noiseScale`: 0.002, then 0.012.
   - `ridgeInfluence`: 0, then 1, then 2.
   - `elevationPower`: 0.8, then 2.5.
   - `persistence`: 0.7.
   Keep notes on what each does. Which settings leave the moa with nowhere to live?
3. In its `biomes` block, widen `podocarp` to run from 0.25 to 0.5 (and adjust its neighbours so the bands still meet). How does a wide forest change the game?
4. Turn on the land regions lens (**D**, then **L**). Find a seed where the walkable land is split into more than one large region. In the console, check `game.terrain.landRegions().count` and `.sizes`.
5. Add a biome. Between `subalpine` and `alpine`, insert a `herbfield` band from 0.72 to 0.77 that is walkable and has `plantTypes: ['patotara']`. Give it colours. You will also need to add `herbfield` to each season's `plantModifiers` in `mauri_seasons.js`, or its plants will fall back to a modifier of 1.0 (find out why by reading `getPlantModifier`).
