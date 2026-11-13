# Chapter 6: Plants: The Bottom of the Food Web

> Poipoia te kākano kia puāwai.
>
> Nurture the seed and it will blossom.
> — whakataukī

*Builds on Chapter 3 (the plant grid), Chapter 4 (biomes) and Chapter 5 (seasonal modifiers).*

Everything a moa does, it does because of plants. It walks to them, eats them, starves when they fail, and crowds onto whatever is left. The eagles depend on the moa. The mauri you earn depends on both. If you pull one thread to understand why a level is easy or hard, it will lead you down to the plants.

Yet a plant in this game is about the simplest object there is. It doesn't move. It doesn't decide anything. It has a number that goes up slowly and gets knocked to zero when something eats it. This chapter is about that number, the things that speed it up and slow it down, and how a thousand of these dull objects add up to a food landscape that shifts under the animals' feet.

The code is `Plant` in `mauri_plant.js`, with the scattering done by `Simulation.spawnPlants`.

## A Resource That Grows Back

Here is the idea in a sketch. Click a plant to eat it.

```javascript
let plants = [];

function setup() {
  createCanvas(640, 240);
  for (let i = 0; i < 30; i++) {
    plants.push({ x: random(width), y: random(height), growth: 1 });
  }
}

function draw() {
  background(235, 240, 225);
  for (const p of plants) {
    if (p.growth < 1) p.growth += 0.003;
    // Grow a little every frame, up to full size.
    fill(60, 140, 60);
    noStroke();
    circle(p.x, p.y, 6 + p.growth * 18);
  }
}

function mousePressed() {
  for (const p of plants) {
    if (dist(mouseX, mouseY, p.x, p.y) < 15) p.growth = 0;
    // Eaten: back to nothing.
  }
}
```

That is a **renewable resource**: it's used up, and it comes back at a fixed pace. The pace is the thing that matters. If you click faster than the plants regrow, the screen empties. If you click slower, it stays green. Somewhere between is a rate of eating the land can sustain for ever. Ecologists call that the carrying capacity, and the whole balance of the game rests on it. Too few plants, or plants that regrow too slowly, and moa starve however cleverly they behave.

## What a Plant Knows

The game's `Plant` constructor sets up a handful of properties. These are the ones that matter for behaviour:

```javascript
constructor(x, y, type, terrain, biomeKey) {
  this.pos = createVector(x, y);
  this.type = type;                     // 'tussock', 'rimu', 'patotara', ...
  this.biomeKey = biomeKey;             // which biome it stands in
  this.elevation = terrain.getElevationAt(x, y);

  const plantDef = PLANT_TYPES[type];
  this.baseNutrition = plantDef.nutrition;
  this.nutrition = plantDef.nutrition;
  this.maxNutrition = plantDef.nutrition;
  this.baseGrowthTime = plantDef.growthTime;

  this.alive = true;
  this.dormant = false;
  this.growth = 1.0;
  this.regrowthTimer = 0;
  this.seasonalModifier = 1.0;
  // ...
}
```

A plant looks up its own elevation once, when it's created, and remembers it. It never moves, so the answer never changes. That's the baking idea from Chapter 4 at the smallest possible scale: don't ask the same question twice if the answer can't change.

Its character comes from a table, `PLANT_TYPES` in `mauri_sketch.js`:

```javascript
const PLANT_TYPES = {
  tussock:  { name: "Tussock",  nutrition: 25, color: '#8ea040', size: 24, growthTime: 200, winterEdibility: 0.20, ... },
  flax:     { name: "Flax",     nutrition: 35, color: '#487020', size: 26, growthTime: 280, winterEdibility: 0.10, ... },
  rimu:     { name: "Rimu",     nutrition: 50, color: '#8B0000', size: 48, growthTime: 400, winterEdibility: 0.0,  ... },
  beech:    { name: "Beech",    nutrition: 40, color: '#8b430f', size: 52, growthTime: 350, winterEdibility: 0.35, ... },
  patotara: { name: "Pātōtara", nutrition: 42, color: '#c94c5a', size: 28, growthTime: 160, winterEdibility: 0.0,  ... },
  // ...
};
```

`nutrition` is how much hunger one meal removes. A moa's hunger runs 0 to 100 and it starts looking for food at about 35, so a single rimu (50) is a full meal and a tussock (25) is a snack. `growthTime` is how long the plant takes to come back after being eaten. Rimu is rich and slow; tussock is poor and quick. That trade-off between a big meal that's rarely available and a small one that's nearly always there is ordinary ecology, and here it's two columns of a table.

## The Life of a Plant

A plant has three conditions, and at any moment it is in one of them.

```
            eaten                    regrowth timer runs out
  GROWN  ----------->  EATEN  ------------------------------>  GROWING
    ^                (alive = false)                         (alive = true,
    |                                                         growth 0.3 → 1)
    +-----------------------------------------------------------+
                         growth reaches 1
```

Eating is one method:

```javascript
consume() {
  if (this.dormant || this.unsprouted) return 0;

  const nutritionGained = this.nutrition;
  this.alive = false;
  this.growth = 0;
  this.nutrition = 0;
  this.regrowthTimer = 0;
  return nutritionGained;
}
```

Whoever eats it calls `consume()` and gets back a number: how much food there was. The plant sets itself to "not alive" and starts counting.

The word `alive` is misleading here, and it's important to get this straight early. When an animal's `alive` is false, it's dead and will be removed. When a plant's `alive` is false, it has been **eaten down and is regrowing**. It stays in the list and in the grid (Chapter 3 explained why). Read `plant.alive` as "has something on it to eat".

Growing and regrowing happen in `handleGrowth`:

```javascript
handleGrowth() {
  const typeModifier = this.plantTypeModifier || 1.0;

  if (!this.alive) {
    // Eaten: count up toward regrowth.
    const regrowthRate = this.seasonalModifier;
    this.regrowthTimer += regrowthRate;

    const divisor = this.seasonalModifier > 0.3 ? this.seasonalModifier : 0.3;
    this.growthTime = this.baseGrowthTime / divisor;

    if (this.regrowthTimer >= this.growthTime) {
      this.alive = true;
      this.growth = 0.3;
      this.regrowthTimer = 0;
    }
  } else if (this.growth < 1.0) {
    // Back, but small: grow.
    const growthRate = 0.002 * this.seasonalModifier;
    this.growth += growthRate;
    if (this.growth > 1.0) this.growth = 1.0;
    this.nutrition = this.maxNutrition * this.growth * this.seasonalModifier * typeModifier;
  } else {
    // Full size.
    this.nutrition = this.maxNutrition * this.seasonalModifier * typeModifier;
  }

  this.maxNutrition = this.baseNutrition * this.seasonalModifier;
}
```

Three branches for the three conditions. The thread running through all of them is `seasonalModifier`, the number from Chapter 5 that says how well plants do in this biome at this time of year.

It acts in three places. An eaten plant's regrowth timer counts up by `seasonalModifier` per tick instead of by 1, so a subalpine tussock in winter (modifier 0.1) counts a tenth as fast, and it's counting toward a target that has itself been stretched by dividing by the modifier. A growing plant gains size at `0.002 * seasonalModifier`. And the food value of even a full-grown plant is multiplied by it.

So a poor season hits a plant three ways at once: it comes back later, grows slower, and is worth less when it's there. The effects compound. This is why winter in the high country isn't merely lean. It's empty.

### Nutrition is the product of several things

Look at the nutrition line again:

```javascript
this.nutrition = this.maxNutrition * this.growth * this.seasonalModifier * typeModifier;
```

Four numbers multiplied together: the plant's richness, how grown it is, how the season treats its biome, and how the season treats its species (`plantTypeModifier`, which is how pātōtara gets berries in summer and none in winter).

Multiplying factors is the standard way to combine independent influences, and you'll see it throughout the game. Its great property is that each factor can be reasoned about alone. "Pātōtara is worth 1.8× in summer" is true whatever the biome or the plant's size. And any factor at zero zeroes the lot, which is often what you want: a plant with no growth has no food, however good the season.

The thing to watch with products is that they multiply your tuning mistakes as well. Four factors each 20% too generous give you double the food you intended.

### Exercise 6.1

In the sketch, give each plant a `type` of either `'fast'` (regrows in 2 seconds, small) or `'slow'` (regrows in 10 seconds, large). Add a `seasonMod` variable that you can change with the up and down arrow keys, and multiply both growth rates by it. Eat steadily with the mouse and find the lowest `seasonMod` at which you can keep yourself fed.

## One Method, Many Gates

`Plant.update` is called with the season manager and decides what happens to the plant this tick. It reads as a series of gates. Each gate handles one special situation and, if it applies, returns early so the rest is skipped.

```javascript
update(seasonManager) {
  this._seasonKey = seasonManager.currentKey;

  // Gate 1: I was planted by the player.
  if (this.isSpawned && this.parentPlaceable) {
    if (!this.parentPlaceable.alive) { this.alive = false; return; }
    this.seasonalModifier = 1.2;
    this.plantTypeModifier = 1.0;
    this.handleGrowth();
    return;
  }

  // Gate 2: I'm a forest tree outside the forest band.
  if (LEVEL_MECHANICS.forestContraction && FOREST_TREES.has(this.type)) {
    const band = seasonManager.getForestBand();
    if (band && (this.elevation < band.min || this.elevation > band.max)) {
      this.suppressed = true;
      this.dormant = false;
      this.nutrition = 0;
      return;
    }
    this.suppressed = false;
  }

  // The ordinary case.
  this.seasonalModifier = seasonManager.getPlantModifier(this.biomeKey);
  this.plantTypeModifier = seasonManager.getPlantTypeModifier(this.type);

  this.checkDormancy(seasonManager);
  if (this.dormant) { this.handleDormancy(seasonManager); return; }

  this.handleGrowth();

  if (LEVEL_MECHANICS.winterInedibility) this._applyWinterEdibility(seasonManager);
}
```

(I've simplified the guards; the real ones check that `LEVEL_MECHANICS` exists first, as Chapter 1 described.)

This style, a sequence of "if this special case, deal with it and leave", is called using **guard clauses** or early returns. It keeps a method flat. The alternative is nesting each case inside the `else` of the last, which works and becomes unreadable by the fourth level of indentation. When you add a new condition a plant can be in, add a gate.

Let me go through the conditions.

### Planted by the player

A plant that came from one of the player's tools has `isSpawned` true and a `parentPlaceable`. It ignores the seasons entirely and always gets a modifier of 1.2: food you plant is reliable, which is why it's worth paying for. It also dies with its parent. When the grove's lifetime runs out, its plants set `alive = false` on their next update and stay that way.

### Suppressed

This is the forest contraction from Chapter 5. A forest tree checks its stored elevation against the current forest band. Outside it, the tree is `suppressed`: zero nutrition, drawn wilted. Inside it, normal life resumes. The comparison costs almost nothing, and the effect across hundreds of trees is a treeline that visibly moves.

`FOREST_TREES` is a `Set`:

```javascript
const FOREST_TREES = new Set(['beech', 'rimu', 'fern']);
```

A `Set` is a collection where the only question you ask is "is this in it?", with `.has()`. For that question it is faster than searching an array and clearer to read. The game uses sets for every "is this one of those?" test: which plants are forest trees, which use sprites, which bird types fly.

### Dormant

Dormancy is the plant switching off for a season. Each season in the `SEASONS` table can name an elevation and a direction: in winter, plants *above* 0.55 may go dormant; in summer, plants *below* 0.35.

```javascript
checkDormancy(seasonManager) {
  if (this.dormant || !this.alive || this.evergreen) return;
  if (seasonManager.currentKey === 'summer') return;

  if (seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey)) {
    const dormancyChance = seasonManager.getDormancyChance();

    if (seasonManager.justChanged && random() < dormancyChance) {
      this.goDormant();
    } else if (this.seasonalModifier < 0.25 && this.growth > 0.5 && random() < 0.01) {
      this.goDormant();
    }
  }
}
```

Two things here are new.

**Chance.** `random() < dormancyChance` is how you make something happen with a given probability. `random()` returns a number between 0 and 1, evenly spread. It is below 0.6 six times in ten. So `if (random() < 0.6)` runs its body 60% of the time. Not every plant above the line goes dormant in winter; about six in ten do, and which six differs every game. That unevenness is what makes the high country in winter look patchy and natural instead of uniformly dead.

**A slow trickle.** The second branch, `random() < 0.01`, gives a struggling plant a 1% chance per update of giving up. A small probability checked repeatedly is how you model "this will probably happen eventually, at no particular moment". You'll see it again when a dormant plant wakes:

```javascript
handleDormancy(seasonManager) {
  this.dormantTimer++;
  const shouldBeDormant = seasonManager.shouldPlantBeDormant(this.elevation, this.biomeKey);

  if (!shouldBeDormant && this.seasonalModifier > 0.5) {
    if (random() < 0.02) {
      this.dormant = false;
      this.growth = 0.2;
    }
  }
  this.nutrition = 0;
}
```

Once conditions are good again, each dormant plant has a 2% chance per update of waking. They don't all wake on the first day of spring. They come back over a period, a few at a time, and the green spreads up the hillside.

The simulation also does a sweep at the instant the season changes (`Simulation.onSeasonChange`), rolling the dice for every wild plant at once. The per-plant check catches the ones that were being eaten at that moment.

### Standing but not food

Free Play's winters use a different model, switched on by `winterInedibility`. The thinking, from a comment in the source: New Zealand's native plants are evergreen, so winter shouldn't make them vanish. It should take the food out of them.

```javascript
_applyWinterEdibility(seasonManager) {
  const w = seasonManager.getWinterness();
  if (w <= 0) { this.winterInedible = false; return; }
  // ...
  const we = def.winterEdibility;              // per plant type, 0..1
  const cold = seasonManager.coldIndex || 0;   // how harsh this year is
  const eff = Math.max(0, we * mult * (1 - erosion * cold));
  const winterVal = this.baseNutrition * this.growth * eff;
  this.nutrition = this.nutrition + (winterVal - this.nutrition) * w;   // ease in by winterness
  this.winterInedible = this.nutrition < PLANT_INEDIBLE_THRESHOLD;
}
```

Each plant type has a `winterEdibility`: the fraction of its food value that survives the cold. Beech keeps 35%. Tussock keeps 20%. Rimu and pātōtara, which are fruit, keep nothing. As `winterness` rises, the plant's nutrition is eased toward that floor (there's the easing line from Chapter 2 again, with `w` as the rate). Below a threshold of 3 the plant is flagged `winterInedible` and foragers skip it.

And `coldIndex`, the climate severity from Chapter 5, erodes the floor further. In a deep glacial year even beech holds little.

The effect on play is distinctive. In winter the map still looks vegetated, frost-tinted, and almost none of it is food. The moa have to find the beech.

## Scattering the Plants

Where do plants come from at the start of a level?

```javascript
spawnPlants() {
  const spawnScale = 2;
  const spawnCols = Math.ceil(this.worldWidth / spawnScale);
  const spawnRows = Math.ceil(this.worldHeight / spawnScale);
  const density = this.config.plantDensity;
  const terrain = this.terrain;

  for (let row = 0; row < spawnRows; row++) {
    for (let col = 0; col < spawnCols; col++) {
      const x = col * spawnScale + random(-1, 1);
      const y = row * spawnScale + random(-1, 1);
      const biome = terrain.getBiomeAt(x, y);

      if (biome.canHavePlants && random() < density) {
        const plantTypes = biome.plantTypes;
        const plantType = biome.plantWeights
          ? Simulation._weightedPlant(plantTypes, biome.plantWeights)
          : plantTypes[(random() * plantTypes.length) | 0];
        this.addPlant(new Plant(x, y, plantType, terrain, biome.key));
      }
    }
  }
}
```

It walks over the map in steps of 2 world units. At each step it rolls the dice: with probability `plantDensity` (0.006 by default, about one step in 170), a plant grows there. The plant's type is picked from the biome's list.

That's all it takes to get forests in the forest band and tussock on the tops. The plants follow the biomes, and the biomes follow the elevation, and the elevation came from noise.

`plantDensity` is one of the most powerful numbers in a level file. It directly sets how many plants exist, and so how many moa the land can feed. If a level feels too hard or too easy and you don't know why, try changing it by a third and see.

Two small idioms in that code:

`plantTypes[(random() * plantTypes.length) | 0]` picks a random element of an array. `random() * length` is a number from 0 up to but not including `length`; `| 0` drops the fraction, giving a valid index. (p5.js also lets you write `random(plantTypes)`.)

`random(-1, 1)` nudges each position off the grid, so plants don't stand in visible rows. This small random offset is called **jitter**. Whenever you place things on a grid and it looks artificial, jitter them.

### Weighted choice

Sometimes a biome should have mostly one plant and a little of another. `_weightedPlant` handles that, and the algorithm is a classic worth knowing:

```javascript
static _weightedPlant(types, weights) {
  let total = 0;
  for (const t of types) total += weights[t] ?? 1;
  let r = random() * total;
  for (const t of types) {
    r -= weights[t] ?? 1;
    if (r <= 0) return t;
  }
  return types[types.length - 1];
}
```

Imagine the weights as lengths of ribbon laid end to end: tussock 5 units, pātōtara 1 unit. Throw a dart somewhere along the total length of 6. Whichever ribbon it lands on is the choice. The code does exactly that: pick a random point `r` along the total, then walk the ribbons subtracting each one's length until `r` runs out. Tussock gets chosen five times in six.

You'll use this any time you need "pick one, but not evenly": loot, spawn types, random events. The registry uses the same method to pick a random species by rarity.

(`??` is the **nullish coalescing** operator: `a ?? b` means "`a`, unless it's `null` or `undefined`, in which case `b`". Here it gives any plant without a listed weight a weight of 1. It's used all over the game for defaults, and it's safer than `||` because it doesn't treat `0` as missing.)

### Exercise 6.2

Write `weightedPick(items, weights)` in a sketch and use it to fill the canvas with 500 dots in three colours with weights 6, 3 and 1. Count them and print the totals. How close to 300, 150 and 50 do you get? Run it several times.

## Updating a Thousand Plants

A plant changes slowly. It would be wasteful to update all thousand of them every frame. So the simulation updates only some each frame, working its way through the list:

```javascript
updatePlantsBatched(dt = 1) {
  const plants = this.plants;
  const len = plants.length;
  if (len === 0) return;

  const batchSize = Math.ceil(this._plantBatchSize * Math.min(dt, 2));
  const endIdx = Math.min(this._plantBatchIndex + batchSize, len);

  for (let i = this._plantBatchIndex; i < endIdx; i++) {
    plants[i].update(this.seasonManager, dt);
  }

  this._plantBatchIndex = endIdx >= len ? 0 : endIdx;
}
```

`_plantBatchSize` is 50. Each frame, 50 plants get their update, starting where the last frame stopped. When it reaches the end of the list it starts over. This is called **time slicing** or round-robin updating, and it's the big brother of the throttle from Chapter 1. A throttle says "do all of it, occasionally". A time slice says "do a bit of it, constantly". The time slice spreads the cost evenly, where a throttle would spike every time it fired.

With 1,000 plants, each plant is updated once every 20 frames, three times a second. For something that takes minutes to regrow, that's plenty.

### A coupling worth understanding

Now look closely at something. `updatePlantsBatched` passes `dt` to `plant.update`. But `Plant.update(seasonManager)` only takes one parameter, and `handleGrowth` adds `0.002 * seasonalModifier` per call with no `dt` in sight.

So a plant grows by a fixed amount **per update**, not per frame or per second. And how often a plant is updated depends on how many plants there are. On a map with 500 plants, each is updated every 10 frames. With 1,500 plants, every 30 frames. The same tussock regrows three times faster on the sparser map.

Work it through for an eaten tussock (`growthTime` 200) at a seasonal modifier of 1 on a 1,000-plant map. It needs 200 updates to come back, at one update per 20 frames: 4,000 frames, a little over a minute. Then 350 more updates to grow from 0.3 to full: another two minutes.

Is this a bug? It has a stabilising side: a map with more plants has each one regrow more slowly, so total food production stays steadier than you'd expect as density changes. It also means that when you change `plantDensity`, you change regrowth speed as well, which is not what you'd guess from the name. And the level designers have tuned around the behaviour as it is.

I'm drawing attention to it for two reasons. First, so that when you tune plants you know what you're really adjusting. Second, as an example of how optimisations can quietly become part of a game's rules. The batching was added to save time, and it now helps set the food supply. If you ever "fix" it, by scaling growth by the true elapsed time, expect every level's balance to shift, and retune.

### Exercise 6.3

Add time slicing to the sketch from the start of this chapter: update only 5 of the 30 plants per frame. The regrowth slows down sixfold. Now fix it properly: store on each plant the `frameCount` at which it was last updated, and on each update grow by `0.003 * (frameCount - lastUpdated)`. Confirm that regrowth takes the same time whatever the batch size.

## New Plants: Dispersal

Plants in the game can also be born during play. Two methods on the simulation add them.

`disperseSeed(x, y)` is called by fruit-eating birds (Chapter 10). A kererū eats at a rimu, flies off, and drops a seed where it lands:

```javascript
disperseSeed(x, y) {
  // Density gate: don't carpet a stand that already holds enough live plants.
  const near = this.getNearbyPlants(x, y, R);
  let n = 0;
  for (let i = 0; i < near.length; i++) if (near[i].alive) n++;
  if (n >= maxD) return false;

  // Must be plant-bearing ground whose biome actually grows a forest tree.
  const biome = this.terrain.getBiomeAt(x, y);
  if (!biome || !biome.canHavePlants || !biome.plantTypes) return false;
  const forestHere = biome.plantTypes.filter(t => FOREST_TREES.has(t));
  if (forestHere.length === 0) return false;

  // Soft total cap so runaway recruitment can't blow the plant budget.
  if (this.plants.length >= cap) return false;

  const type = forestHere[(random() * forestHere.length) | 0];
  const seedling = new Plant(x, y, type, this.terrain, biome.key);
  seedling.growth = 0.25;
  this.addPlant(seedling);
  return true;
}
```

Guard clauses again, and each one is a brake. The seed fails if the spot already has three plants within 26 units. It fails if the ground isn't forest country. It fails if the map already has 1,200 plants.

Those brakes are essential, and here is the general principle. Anything in a simulation that can create more of itself needs a limit. Birds eat fruit and plant trees; more trees feed more birds; more birds plant more trees. Without a limit, that loop runs until the browser falls over. The density gate is the important one: it's a *local* limit that makes growth slow down naturally as a place fills up, the way real seedlings fail under a closed canopy. The total cap is a safety net behind it.

Chapter 13 calls this pair, a reinforcing loop plus the brake that tames it, by its proper names. For now: when you add something that grows, add what stops it at the same time.

`growForestAt` is the player's version, used by forest-growing tools. It has similar gates and plants where the player chooses.

Both end with `this.addPlant(seedling)`, the one doorway that keeps the list, the render layers and the spatial grid in agreement (Chapter 3).

## A Small Lookup Table

One last item, from the drawing side, because it's a neat example of baking. Plants sway gently. A sway is a sine wave, and computing `Math.sin` for a thousand plants every frame adds up. So `PlantStatics` computes 256 sine values once:

```javascript
this.swayTable = new Float32Array(this.SWAY_TABLE_SIZE);
for (let i = 0; i < this.SWAY_TABLE_SIZE; i++) {
  this.swayTable[i] = Math.sin((i / this.SWAY_TABLE_SIZE) * TWO_PI);
}
```

and each plant looks its sway up by index:

```javascript
getSway(frameCount, phase, modifier) {
  const index = ((frameCount * 0.02 + phase) * (this.SWAY_TABLE_SIZE / TWO_PI)) % this.SWAY_TABLE_SIZE;
  return this.swayTable[index | 0] * 0.05 * modifier;
}
```

Each plant has its own `swayPhase`, a random starting point in the wave, so they don't all lean together. It's the `noiseOffset` idea from Chapter 2: give each individual a random offset into a shared pattern, and a crowd stops moving in unison.

A 256-entry table is a coarse sine, and for a sway nobody could tell. Lookup tables trade a little accuracy and memory for speed, and they suit anything decorative.

## Summary

- A plant is a renewable resource: `consume()` empties it and returns its food; it regrows on a timer.
- `plant.alive === false` means "eaten, regrowing", not "dead". It stays in the list and the grid.
- Nutrition is a product: richness × growth × the season's effect on the biome × the season's effect on the species.
- A poor season makes a plant return later, grow slower and be worth less. The effects compound.
- `update` is a series of guard clauses: player-planted, suppressed (outside the forest band), dormant, then ordinary growth, then winter edibility.
- `random() < p` makes something happen with probability `p`. A small `p` checked repeatedly spreads an event out over time.
- Plants are scattered by rolling dice on a jittered grid; the biome decides the type. `plantDensity` sets how many, and so how many animals the land can feed.
- Weighted choice: pick a point along the total weight, then walk the options subtracting.
- Plants are updated 50 per frame in rotation. Because growth is per update, regrowth speed depends on how many plants there are.
- Anything that can create more of itself needs a brake. Seed dispersal has three.

## The Mauri Project

Make the food landscape visible, then change it.

1. Add a lens, `id: 'food'`, that draws a dot on every plant in `game.simulation.plants`: green with an alpha proportional to `nutrition / 50` if it's `alive`, a small grey dot if it isn't, a blue dot if `dormant`, and a red dot if `suppressed` or `winterInedible`. Divide dot sizes by `z` so they stay the same size on screen.
2. Play a level through a full year with the lens on and fast-forward. Watch where the green is in each season. Does it match the `plantModifiers` in `mauri_seasons.js`?
3. Add a `drawScreen` to the same lens that prints three totals: the number of plants, the number that are edible right now (`p.hasFood()`), and the sum of `nutrition` across all of them. That last number is the land's larder. Note its value in midsummer and midwinter.
4. In your sandbox level from Chapter 4, halve `plantDensity`, then double it from the original. For each, note the larder total and how long a herd survives without your help. Remember the coupling: you are also changing regrowth speed.
5. Add a plant. In `PLANT_TYPES`, add `karamu` with nutrition 38, a `growthTime` of 220, a colour and a size. Give it an entry in `PLANT_TYPE_ID` in `mauri_plant.js`. Add it to your sandbox level's `podocarp` biome's `plantTypes`. It has no sprite, so it will draw as a simple shape. Find one in the game with your lens. Then give it `plantTypeModifiers` in two seasons of your choice in `SEASONS` and watch its dots change.
