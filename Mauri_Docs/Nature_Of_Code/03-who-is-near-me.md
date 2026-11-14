# Chapter 3: Who Is Near Me?

> He rangi tā matawhāiti, he rangi tā matawhānui.
>
> The person with a narrow vision sees a narrow horizon;
> the person with a wide vision sees a wide horizon.
> — whakataukī

*Builds on Chapter 2.*

Every interesting thing an animal does begins with the same question. A moa separating from its herd asks: which moa are close to me? A hungry moa asks: which plants are close to me? A frightened one: is there an eagle close to me? An eagle: which moa are close to me?

In Chapter 2, `separate(nearbyBoids)` was handed a list of neighbours and I didn't say where the list came from. This chapter is about where it comes from. The answer is a class called `SpatialGrid`, in `mauri_spatial.js`. It's under 400 lines, it has no game logic in it at all, and without it the game would run at a few frames a second.

## The Problem

The simplest way to find a moa's neighbours is to check every moa:

```javascript
function neighboursOf(me, all, radius) {
  const result = [];
  for (const other of all) {
    if (other === me) continue;
    const dx = other.pos.x - me.pos.x;
    const dy = other.pos.y - me.pos.y;
    if (dx * dx + dy * dy < radius * radius) result.push(other);
  }
  return result;
}
```

This is correct. Now count the work. With 60 moa, each one checks 60 others: 3,600 distance tests a frame. That's nothing. But moa also look for plants, and there are about 1,000 plants on a map. 60 moa each checking 1,000 plants is 60,000 tests. Add eagles checking moa, birds checking trees, plants being checked when the player places something, and all of it sixty times a second.

The trouble is the shape of the growth. If you double the number of animals, each one has twice as many others to check, and there are twice as many doing the checking. Double the animals, four times the work. Ten times the animals, a hundred times the work. Computer scientists write this as **O(N²)**, "order N squared", and it's the reason many a flocking sketch slows to a crawl when you turn the count up.

And nearly all of that work is wasted. A moa in the south-west corner tests its distance to a plant in the north-east corner, finds it's 900 units away, and discards it. It does that for 990 of the 1,000 plants, every frame.

What you want is a way to say "give me only the things near here" without looking at the things that aren't.

## The Idea: Sort Things Into Bins

Imagine laying a grid of squares over the map, each 50 units across, like a chessboard. Before anyone asks any questions, walk through the list of plants once and drop each one into the square it stands in.

Now a moa wants the plants within 100 units. It works out which square it's in. Anything within 100 units must be in that square or one of the squares within two steps of it. So it looks in those 25 squares and ignores the other several hundred. If plants are spread evenly, it examines a few dozen instead of a thousand.

```
+----+----+----+----+----+----+
|    |    | .  |    |  . |    |
+----+----+----+----+----+----+
|  . |####|####|####|    | .  |
+----+----+----+----+----+----+
|    |####|#M##|####|  . |    |     M = the moa
+----+----+----+----+----+----+     # = squares it searches
| .  |####|####|####|    |    |     . = plants it never looks at
+----+----+----+----+----+----+
|    |  . |    |    | .  |    |
+----+----+----+----+----+----+
```

That is the entire idea. It goes by several names: a spatial hash, a uniform grid, bin-lattice spatial subdivision. Reynolds described it in 2000 for speeding up flocks. The rest of this chapter is how to write one well.

## A First Version

Here is a version you could write in an afternoon:

```javascript
class SimpleGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = [];
    for (let i = 0; i < this.cols * this.rows; i++) this.cells.push([]);
    // One array ("bin") per cell.
  }

  clear() {
    for (const cell of this.cells) cell.length = 0;
  }

  insert(entity) {
    const col = Math.floor(entity.pos.x / this.cellSize);
    const row = Math.floor(entity.pos.y / this.cellSize);
    this.cells[row * this.cols + col].push(entity);
  }

  getInRadius(x, y, radius) {
    const result = [];
    const reach = Math.ceil(radius / this.cellSize);
    // How many cells out do I need to look?
    const cc = Math.floor(x / this.cellSize);
    const cr = Math.floor(y / this.cellSize);

    for (let row = cr - reach; row <= cr + reach; row++) {
      for (let col = cc - reach; col <= cc + reach; col++) {
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) continue;
        for (const e of this.cells[row * this.cols + col]) {
          const dx = e.pos.x - x, dy = e.pos.y - y;
          if (dx * dx + dy * dy <= radius * radius) result.push(e);
        }
      }
    }
    return result;
  }
}
```

Two things in here deserve a closer look.

### A 2D grid in a 1D array

The grid has columns and rows, but `this.cells` is one flat array. The cell at column `col`, row `row` lives at index `row * this.cols + col`. Picture the rows laid end to end:

```
row 0: indices 0, 1, 2, 3, 4, 5
row 1: indices 6, 7, 8, 9, 10, 11
row 2: indices 12, ...
```

To reach row 2, skip two full rows (2 × 6 = 12), then step along by the column.

You could use an array of arrays (`cells[col][row]`) and it would work. The flat form is faster, uses less memory, and you'll meet it again in Chapter 4, where the height of every point on the map is stored the same way. Get comfortable with `row * cols + col`. Going back the other way is `col = index % cols` and `row = Math.floor(index / cols)`.

### Checking the corners

After picking up everything in the nearby cells, the code still does a real distance test on each one. It must. The search area is a square of cells; the question was about a circle. Something in the far corner of a corner cell is in the square and not in the circle. The grid's job is to throw away the obviously-distant quickly. The distance test finishes the job on the few that remain.

## The Game's Version

`SpatialGrid` in `mauri_spatial.js` is the same design with the waste removed. Since these functions run tens of thousands of times a second, each small saving adds up. Here are the differences and what each is for.

### Multiply, don't divide; and floor with `| 0`

```javascript
constructor(width, height, cellSize) {
  this.cellSize = cellSize;
  this.invCellSize = 1 / cellSize;
  // ...
}

getCellIndex(x, y) {
  const col = (x * this.invCellSize) | 0;
  const row = (y * this.invCellSize) | 0;
  if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
  return row * this.cols + col;
}
```

Dividing is slower than multiplying, so the grid works out `1 / cellSize` once and multiplies by that from then on. You'll see names starting with `inv` (for *inverse*) all over the game for this reason: `invCellSize`, `invScale`, `invZoom`.

`| 0` is a trick. `|` is the bitwise OR operator, which only works on whole numbers, so JavaScript chops the fraction off before applying it. OR-ing with zero changes nothing. The net effect is "drop the decimal part", and it's faster than `Math.floor`. One caution: for negative numbers it rounds toward zero (`-0.5 | 0` is `0`), where `Math.floor` rounds down (`-1`). Positions on the map are never negative, so here it doesn't matter. Don't reach for it elsewhere without thinking about that.

Notice also the bounds check that returns `-1`. An animal that somehow ends up off the map is quietly left out of the grid instead of crashing the game by writing to `cells[-37]`.

### Only clear what was used

```javascript
insert(entity) {
  const idx = this.getCellIndex(entity.pos.x, entity.pos.y);
  if (idx === -1) return;

  const cell = this.cells[idx];
  if (cell.length === 0) {
    this.activeCells.push(idx);
    // First thing into this cell: remember that it's in use.
  }
  cell.push(entity);
}

clear() {
  const active = this.activeCells;
  for (let i = 0, len = active.length; i < len; i++) {
    this.cells[active[i]].length = 0;
  }
  this.activeCells.length = 0;
}
```

The eagle grid might have 200 cells and 3 eagles. Emptying all 200 cells every frame to remove 3 birds is silly. So the grid keeps a list of which cells have something in them, and `clear` empties only those.

`cell.length = 0` is the fast way to empty an array in JavaScript. It keeps the same array object and throws away its contents. Writing `this.cells[i] = []` would make a brand new array and leave the old one for the garbage collector, which is exactly the churn Chapter 2 warned about.

### The result buffer, and its trap

```javascript
getInRadius(x, y, radius) {
  const result = this._resultBuffer;
  result.length = 0;
  // ... fill result ...
  return result;
}
```

Like the steering methods, `getInRadius` doesn't create a new array for its answer. It empties one array that belongs to the grid, fills it, and returns it. No garbage.

And like the steering methods, this means **the array you get back is only valid until the next query on the same grid**. There is one buffer per grid. Ask the moa grid a second question and the answer to the first is overwritten, while you're still holding it.

The game has been bitten by this. Here is a comment from `Moa.forage`:

```javascript
// Count competitors without the shared getNearbyMoas() buffer (re-querying it would
// overwrite behave()'s neighbour list). countNearbyMoas() counts in place.
const competitors = simulation.countNearbyMoas(
  this.pos.x, this.pos.y, radius, m => m.alive && m !== this);
```

`Moa.behave` fetches the list of nearby moa at the top and uses it all the way through. Deep inside, `forage` wanted to know how many moa were crowding a plant. If it had called `getNearbyMoas` again, the list that `behave` was still using would have silently changed underneath it. The answer was to add a method that only counts, `countInRadius`, and builds no list at all.

So there are two rules:

1. Use a query's result before making another query on the same grid, or copy it first (`.slice()`).
2. If you only need a count, a yes/no, or the single closest thing, there's a method for that which doesn't touch the buffer: `countInRadius`, `hasAnyInRadius`, `getClosest`.

### More kinds of question

`SpatialGrid` answers several questions, all built on the same nested loop over nearby cells:

| Method | Returns | Uses the shared buffer? |
|---|---|---|
| `getInRadius(x, y, r)` | everything within `r` | yes (`_resultBuffer`) |
| `getInRadiusExcluding(x, y, r, me)` | the same, leaving one entity out | yes (`_resultBuffer2`) |
| `getNearby(x, y, r)` | everything in the nearby cells, no distance test | yes (`_resultBuffer`) |
| `getClosest(x, y, r, filter)` | the single nearest, or `null` | no |
| `getClosestN(x, y, r, n, filter)` | the `n` nearest | returns a fresh array |
| `countInRadius(x, y, r, filter)` | how many | no |
| `hasAnyInRadius(x, y, r, filter)` | `true` at the first one found | no |

The `filter` argument is a function. You pass in a test, and only entities that pass it count:

```javascript
const prey = simulation.getClosestMoa(this.pos.x, this.pos.y, 320, m =>
  m.alive && !m.inShelter);
```

That reads: the closest moa within 320 units that is alive and not under cover. Passing a function as an argument is one of JavaScript's most useful habits, and this is a good, small example of it.

`hasAnyInRadius` shows another habit: stop as soon as you know the answer. It returns `true` from inside the loop the moment it finds one match. If the question is "is there any eagle near me?", finding the first is enough.

### Exercise 3.1

Take a flocking sketch (yours from Chapter 2, or Shiffman's Example 5.11) with 1,000 boids, and measure the frame rate. Add `SimpleGrid` from above: clear it and reinsert every boid at the start of `draw()`, and give each boid only `grid.getInRadius(...)` as its neighbours. Measure again.

### Exercise 3.2

Write `getClosest(x, y, radius)` for `SimpleGrid` without looking at the game's. Keep a "best so far" and its squared distance, starting the best distance at `radius * radius`, and replace them whenever you find something closer. Then compare with `SpatialGrid.getClosest`.

## How the Simulation Uses Its Grids

The simulation doesn't have one grid. It has one per kind of thing, built in `Simulation._buildSpatialGrids`:

```javascript
this.moaGrid       = new SpatialGrid(worldWidth, worldHeight, 60);
this.eagleGrid     = new SpatialGrid(worldWidth, worldHeight, 100);
this.plantGrid     = new SpatialGrid(worldWidth, worldHeight, 50);
this.placeableGrid = new SpatialGrid(worldWidth, worldHeight, 80);
this.eggGrid       = new SpatialGrid(worldWidth, worldHeight, 40);
```

Separate grids mean a moa looking for plants never wades through eagles and eggs. They also let each kind have its own cell size, the third argument.

### Choosing a cell size

There's a trade-off here. Make the cells tiny, and every query has to visit hundreds of mostly-empty cells. Make them huge, and each cell holds so many things that you're back to checking everybody.

The rule of thumb: **a cell should be about as big as the radius of the questions you usually ask.** Then a typical query looks at a 3 × 3 block of cells. Moa mostly ask about things 50 to 100 units away, so their cells are 60. Eagles hunt at 130 units and are few, so their cells are 100. Eggs are tiny and asked about at short range: 40.

If you add a behaviour that asks a grid about a much bigger radius than its cell size (say 600 units on a 50-unit grid), that query visits 25 × 25 = 625 cells. It will work, and it will be slow if many animals do it every frame. Do it rarely, behind a timer.

### The simulation's wrappers

Animals don't touch the grids directly. `Simulation` wraps them in methods with friendlier names:

```javascript
getNearbyMoas(x, y, radius)       { return this.moaGrid.getInRadius(x, y, radius); }
countNearbyMoas(x, y, radius, f)  { return this.moaGrid.countInRadius(x, y, radius, f); }
getNearbyEagles(x, y, radius)     { return this.eagleGrid.getInRadius(x, y, radius); }
getNearbyPlants(x, y, radius)     { return this.plantGrid.getInRadius(x, y, radius); }
getNearbyPlaceables(x, y, radius) { return this.placeableGrid.getInRadius(x, y, radius); }
getClosestPlant(x, y, radius, f)  { return this.plantGrid.getClosest(x, y, radius, f); }
getClosestMoa(x, y, radius, f)    { return this.moaGrid.getClosest(x, y, radius, f); }
```

This is why every `behave` method takes `simulation` as its first argument. An animal perceives the world by asking the simulation questions. Here is the sensing step at the top of `Moa.behave`:

```javascript
const px = this.pos.x, py = this.pos.y;
const placeables = simulation.getNearbyPlaceables(px, py, 80);
const eagles     = simulation.getNearbyEagles(px, py, this.fleeRadius * 1.5);
const moas       = simulation.getNearbyMoas(px, py, 100);
```

Three queries, three different grids, so three different buffers. All three results stay valid together. That is the other reason for separate grids.

## Things That Move and Things That Don't

A grid is a snapshot. The moment a moa takes a step, the cell it was filed under might be wrong. So at the very start of every frame, `Simulation.update` calls `updateSpatialGrids()`, which empties the grids and files everyone again from scratch.

Refiling 60 moa is nothing. Refiling 1,000 plants sixty times a second is real work, and plants don't move. So the simulation treats the two kinds differently:

```javascript
updateSpatialGrids() {
  // Moving entities: rebuilt every frame. Only live entities are inserted.
  for (const pair of this._movingGridPairs) {
    pair.grid.clear();
    const list = pair.list;
    for (let i = 0, len = list.length; i < len; i++) {
      const entity = list[i];
      if (entity.alive) pair.grid.insert(entity);
    }
  }

  // Static entities (plants, eggs): rebuild only when list membership changed.
  for (const pair of this._staticGridPairs) {
    if (!pair.dirty) continue;
    pair.grid.clear();
    const list = pair.list;
    for (let i = 0, len = list.length; i < len; i++) {
      pair.grid.insert(list[i]);
    }
    pair.dirty = false;
  }
  // ...
}
```

The plant grid and the egg grid each carry a flag called `dirty`. They are rebuilt only when it's `true`, and it becomes `true` only when a plant or egg is added or removed. On a typical frame nothing has changed, and the plant grid is left alone.

This is the **dirty flag** pattern: keep a derived thing (the grid) alongside the real data (the list), and a flag that says whether the derived thing is out of date. Whoever changes the real data sets the flag. Whoever needs the derived thing checks the flag first. It turns "recompute every frame" into "recompute when something changed".

The danger of the pattern is forgetting to set the flag. If you push a plant straight onto `simulation.plants`, the grid never hears about it, and no animal will ever find that plant. So there is one sanctioned way in:

```javascript
// Single entry point for adding a plant: keeps the master list, render partition and
// grid in sync. Use this instead of pushing to `this.plants` directly.
addPlant(plant) {
  this.plants.push(plant);
  if (FOREST_TREES.has(plant.type)) this.treePlants.push(plant);
  else this.groundPlants.push(plant);
  this.markPlantGridDirty();
}
```

When you add plants to the game, call `addPlant`. The comment is asking you nicely.

### A subtle difference: alive and not alive

Look closely at the two loops. The moving loop inserts only entities with `alive === true`. The static loop inserts everything.

Moving grids are rebuilt every frame, so they can afford to be exact: a dead eagle is left out, and no moa will flee from a ghost. (The source comment calls this a "phantom neighbour".)

The plant grid is rebuilt rarely. A plant that has been eaten has `alive === false` until it regrows, then becomes alive again, without being added or removed from any list. If eaten plants were left out of the grid, they'd be missing until the next unrelated rebuild, long after they'd grown back. So every plant stays in the grid permanently, and the animals filter:

```javascript
for (let i = 0; i < plants.length; i++) {
  const p = plants[i];
  if (!p.alive || p.growth < 0.5) continue;
  // ...
}
```

This is why nearly every loop over plants in the game starts with `if (!p.alive) continue`. The grid tells you what is *there*. You have to check what state it's in.

### Exercise 3.3

In the game, press **D** for debug mode. In the browser's developer console, type `CONFIG.showGridStats = true`. The simulation will draw statistics for its grids. Look at `maxInCell` and `avgPerCell` for the plant grid. Then, in the console, try `game.simulation.plantGrid.getStats()`.

### Exercise 3.4

`Simulation.getSpeciesCount(speciesKey)` loops over every moa to count one species. `getCachedSpeciesCount` does it differently. Read both (they're next to each other in `mauri_simulation.js`) and `_ensurePopulationCache`. What is the "dirty flag" in this case? What marks it dirty? Which version would you call from inside a loop that runs for every eagle every frame?

## When a Grid Isn't the Answer

A uniform grid works best when things are spread fairly evenly. If every moa on the map crowded into one cell, each would again be checking all the others. A structure called a **quadtree** copes with that by splitting crowded cells into four smaller ones as needed. The game doesn't use one, because moa separate from each other and are capped at a few dozen. If you ever simulate thousands of animals that clump, look quadtrees up; Shiffman covers them in *The Nature of Code*, Example 5.13.

And sometimes a plain loop is right. The game has some:

```javascript
// The live storm covering the point (x, y), or null. ... There are only ever a few
// storms, so a plain loop is fine.
stormAt(x, y, pad = 0, frac = 1) {
  const ps = this.placeables;
  for (let i = 0; i < ps.length; i++) { /* ... */ }
}
```

Eagles looking for a mate loop over all eagles, because there are never more than a dozen. A grid has a cost: it must be kept up to date, and it's one more thing to get wrong. Use one when N is large, the question is asked often, and the answer is local. Otherwise write the loop and a comment saying why it's fine.

## Summary

- Checking every animal against every other is O(N²) and most of it is wasted.
- A spatial grid files each thing under the cell it stands in. A query looks only at cells near the point, then does a real distance test.
- A 2D grid stored flat: `index = row * cols + col`.
- `SpatialGrid` multiplies by `invCellSize`, floors with `| 0`, clears only the cells in use, and returns results in a reused buffer.
- A result from `getInRadius` is overwritten by the next call on the same grid. Use it first, or use `countInRadius` / `hasAnyInRadius` / `getClosest`.
- One grid per kind of entity, with a cell size close to the usual query radius.
- Moving grids are rebuilt every frame from live entities. Static grids are rebuilt when a dirty flag is set. Add plants only through `addPlant`.
- Static grids contain dead plants too: always check `alive`.

## The Mauri Project

Build a lens that shows what a moa perceives. The game has a system for debug overlays called lenses (Chapter 16 covers it fully); you'll add one.

1. Open `mauri_lens.js` and scroll to the bottom. Read the existing `Lens.register({...})` calls to see the shape.
2. Register a new lens with `id: 'moaSight'` and `label: 'Moa ▸ what one moa sees'`. In its `drawWorld(game, z)`:
   - Take the first living moa: `const m = game.simulation.moas.find(m => m.alive);` and return if there isn't one.
   - Draw a circle of radius 100 around it (that's the radius of its plant search): `noFill(); stroke(255, 220, 80); strokeWeight(1 / z); circle(m.pos.x, m.pos.y, 200);`
   - Ask the simulation for the plants it can see: `const plants = game.simulation.getNearbyPlants(m.pos.x, m.pos.y, 100);`
   - Draw a thin line from the moa to each plant that is `alive`, and a faint dot on each that is not.
3. Reload, start a level, press **L**, and click your lens in the legend. Watch the lines change as the moa walks.
4. Now a question to answer by experiment. Your lens calls `getNearbyPlants` during rendering. The moa called it earlier in the same frame, during `behave`. Could your call corrupt the moa's result? Why not? (Think about *when* each runs, using the frame order from Chapter 1.)
5. Stretch: also draw the grid cells that the query visited, as faint squares. You'll need `game.simulation.plantGrid.cellSize` and the same arithmetic as `getInRadius`.
