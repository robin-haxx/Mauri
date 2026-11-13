# Chapter 12: Data-Driven Design

> Tē tōia, tē haumatia.
>
> Nothing can be achieved without a plan and a way of working.
> — whakataukī

*Builds on Chapters 4 to 11.*

Count the animals and plants in this game: nine species of moa, an eagle, five other birds, fifteen kinds of plant, fifteen tools, eight or so biomes per map, and a dozen levels. Now count the classes: `Moa`, `HaastsEagle`, `Kereru` and its four children, `Plant`, `PlaceableObject`. Nine species of moa share one class. Fifteen plants share one. Every level in the game shares the same `Game` and the same `Simulation`.

The difference between a giant moa and an upland moa is not in any code. It's in a table. So is the difference between Level 1 and Free Play. This approach has a name, **data-driven design**, and it's the reason the game could grow to this size and still be changed by one person in an afternoon. This chapter is about how to separate *what something is* from *how things work*, and about the machinery in the game that reads the tables: `mauri_species_data.js`, `mauri_registry.js`, `mauri_level_format.js`, the `levels/` folder, and the `LEVEL_MECHANICS` object.

It's the least visual chapter in the guide and possibly the most useful. Once you understand it, most of what you want to do to this game turns out to be editing data.

## Code and Data

Here's a moa written the direct way:

```javascript
class UplandMoa extends Boid {
  constructor(x, y, terrain) {
    super(x, y, terrain);
    this.baseSpeed = 0.16;
    this.fleeSpeed = 0.25;
    this.maxHunger = 100;
    this.baseHungerRate = 0.02;
    // ...
  }
}

class GiantMoa extends Boid {
  constructor(x, y, terrain) {
    super(x, y, terrain);
    this.baseSpeed = 0.15;
    this.fleeSpeed = 0.21;
    this.maxHunger = 140;
    this.baseHungerRate = 0.03;
    // ...
  }
}
```

Two classes with identical logic and different numbers. Nine species would mean nine classes. Every fix to how moa forage would need making nine times.

Here's the same thing the data-driven way:

```javascript
const MOA_SPECIES = {
  upland_moa: { baseSpeed: 0.16, fleeSpeed: 0.25, maxHunger: 100, baseHungerRate: 0.02 },
  giant_moa:  { baseSpeed: 0.15, fleeSpeed: 0.21, maxHunger: 140, baseHungerRate: 0.03 }
};

class Moa extends Boid {
  constructor(x, y, terrain, speciesKey) {
    super(x, y, terrain);
    const s = MOA_SPECIES[speciesKey];
    this.baseSpeed = s.baseSpeed;
    this.fleeSpeed = s.fleeSpeed;
    this.maxHunger = s.maxHunger;
    this.baseHungerRate = s.baseHungerRate;
  }
}
```

One class that knows *how* a moa behaves. One table that says *what* each kind is like. The class reads its numbers from the table instead of having them written into it.

The gains are large:

- **A new species is a new row.** No new logic, so no new bugs in logic.
- **Tuning doesn't touch code.** You change a number in a table. You can't break `forage` by adjusting `baseHungerRate`.
- **Everything of a kind is in one place.** To compare all the moa, read one file.
- **Other code can read the table.** The encyclopedia, the level validator and the population panel all read `MOA_SPECIES` to find names, colours and descriptions. With hard-coded classes they'd have nothing to read.

Here's a real entry from `mauri_species_data.js`, trimmed:

```javascript
south_island_giant_moa: {
  displayName: "South Island Giant Moa",
  scientificName: "Dinornis robustus",
  tint: [170, 150, 130],
  description: "Massive moa of the lowland plains, up to 3.6m tall",
  rarity: 'uncommon',

  size: { min: 12, max: 16 },
  baseSpeed: 0.15,      // Slower due to size
  fleeSpeed: 0.21,
  maxForce: 0.02,

  maxHunger: 140,       // Needs more food
  baseHungerRate: 0.03,
  hungerThreshold: 45,
  criticalHunger: 110,

  eggCooldownTime: 1200,
  preferredElevation: { min: 0.15, max: 0.40 },
  temperatureTolerance: { cold: 0.4, heat: 0.7 },

  flockTendency: 0.5,    // More solitary
  flightiness: 0.5,      // Harder to scare due to size
  eagleResistance: 0.3,  // 30% chance to resist attack

  seasonalModifiers: {
    winter: { hungerRate: 1.2, speed: 0.8 },
    // ...
  }
},
```

You can read an animal's nature straight off it. Bigger, slower, hungrier, lives low, bad in the cold, hard to frighten, sometimes shrugs off an eagle. Every one of those words is a number that some line of `Moa` reads. Recall `this.fleeRadius = 85 * this.flightiness` from Chapter 7: with `flightiness` at 0.5, a giant moa doesn't react to an eagle until it's half as close as would startle an upland moa.

The question to ask of any value in your code is: **might I want this to differ between instances, or to change while tuning?** If so, it belongs in data. If it's part of how the thing fundamentally works, it stays in code.

## Defaults and Merging

A species entry doesn't have to list everything. `Moa` has a table of defaults:

```javascript
static DEFAULTS = {
  size: { min: 8, max: 11 },
  baseSpeed: 0.1,
  fleeSpeed: 0.2,
  maxForce: 0.025,
  flockTendency: 0.8,
  flightiness: 0.7,
  eagleResistance: 0,
  foragingBonus: 1.0,
  camouflage: 0,
  maxHunger: 100,
  // ...
};
```

and the constructor combines the two in one line:

```javascript
const s = { ...Moa.DEFAULTS, ...(species.config || {}) };
```

The three dots are the **spread** operator. `{ ...a, ...b }` makes a new object containing everything in `a`, then everything in `b`. Where both have the same key, `b` wins, because it was written second. So `s` is "the defaults, overridden by whatever this species specifies".

This pattern, **defaults plus overrides**, runs through the whole game, and it's what keeps data files short. A species lists only how it differs from a typical moa. A new property can be added to `DEFAULTS` with a neutral value (`camouflage: 0`), and every existing species carries on unchanged, while a new species can opt in.

`static` means the property belongs to the class itself, not to each instance. There's one `Moa.DEFAULTS`, shared.

### Shallow and deep

There's a trap in the spread. Suppose the defaults have `size: { min: 8, max: 11 }` and a species specifies `size: { max: 14 }`, meaning to change only the maximum. After `{ ...defaults, ...species }`, `size` is `{ max: 14 }`. The `min` is gone. Spread replaces whole values at the top level and doesn't look inside nested objects. That's a **shallow** merge.

The registry has a **deep** merge for when that matters:

```javascript
mergeConfigs(base, source) {
  const result = { ...base };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        // Deep merge objects
        result[key] = this.mergeConfigs(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}
```

For each key in the override: if the value is a plain object, merge *into* the matching object in the base by calling `mergeConfigs` again on that pair. Otherwise, replace.

A function that calls itself is **recursive**. Recursion is the natural way to handle data that's nested to an unknown depth: deal with one level, and for anything that's itself a nested thing, apply the same procedure to it. Each call handles a smaller piece, and eventually the pieces are plain values and the calls stop. The flood fill in Chapter 4 could have been written this way too; it used an explicit stack instead, which is the same idea with the bookkeeping done by hand.

Note the careful condition. `typeof x === 'object'` is true for arrays and for `null` in JavaScript, both historical oddities, so the code rules them out. An array in an override replaces the base's array whole. That's almost always what you want: a species with `tint: [170, 150, 130]` doesn't want its three numbers merged with someone else's.

### Exercise 12.1

In the console or a sketch, define `defaults = { speed: 1, size: { min: 8, max: 11 } }` and `override = { size: { max: 14 } }`. Print `{ ...defaults, ...override }`. Then write `deepMerge(a, b)` and print its result. Finally, check that your `deepMerge` didn't modify `defaults` (a merge should build a new object and leave its inputs alone).

## The Registry and the Factory

`mauri_registry.js` holds a single object, `REGISTRY`, which is a set of lookup tables with a little behaviour. It knows two levels of thing:

- **Animal types**: `'moa'`, `'eagle'`, `'kereru'`... Each maps to a *class*.
- **Species**: `'upland_moa'`, `'south_island_giant_moa'`... Each maps to a type plus a config.

They're filled in once, in `setup()`, by `initializeRegistry()`:

```javascript
function initializeRegistry() {
  REGISTRY.registerAnimalType('moa', {}, Moa);
  REGISTRY.registerAnimalType('eagle', {}, HaastsEagle);

  if (typeof Kereru !== 'undefined') {
    REGISTRY.registerAnimalType('kereru', {}, Kereru);
    REGISTRY.registerSpecies('kereru', 'kereru', KERERU_SPECIES);
  }
  // ... kokako, kea, kaka, kakapo ...

  for (const [key, config] of Object.entries(MOA_SPECIES)) REGISTRY.registerSpecies(key, 'moa', config);
  for (const [key, config] of Object.entries(EAGLE_SPECIES)) REGISTRY.registerSpecies(key, 'eagle', config);
  // ... plants, placeables, biomes ...
}
```

`Object.entries(obj)` turns an object into an array of `[key, value]` pairs, so you can loop over a table. The `const [key, config]` part is **destructuring**: it unpacks each pair into two named variables.

Notice that `Moa`, the class, is passed as an argument. In JavaScript a class is a value like any other. You can store it in a table and use it later:

```javascript
createAnimal(speciesKey, x, y, terrain, gameConfig) {
  const species = this.species.get(speciesKey);
  if (!species) {
    console.error(`Unknown species: ${speciesKey}`);
    return null;
  }

  const finalConfig = this.mergeConfigs(gameConfig, species.config);
  const instance = new species.class(x, y, terrain, finalConfig, species);
  // Whatever class this species is registered with.

  instance.speciesKey = speciesKey;
  instance.speciesData = species;
  return instance;
}
```

`new species.class(...)` creates an instance of whichever class was registered: a `Moa` for `'upland_moa'`, a `Kea` for `'kea'`. The caller doesn't know or care which. It asks for an animal by name:

```javascript
const chick = REGISTRY.createAnimal('upland_moa', x, y, terrain, config);
```

This is the **factory** pattern. Instead of writing `new Moa(...)` all over the code, you ask a central place to make the thing, by key. The benefits show up when hatching: `Simulation.updateEggs` creates the chick from `egg.parentSpecies`, a string. The same line hatches every species of moa, and a similar one hatches every kind of bird, because the registry knows what class goes with each name.

Why `Map` and not a plain object for the tables? A `Map` is a key-value store built for the job: `.set(key, value)`, `.get(key)`, `.has(key)`. Either works here. The rule of thumb is: use a plain object for a fixed record whose keys you know when writing the code (`{ x: 1, y: 2 }`), and a `Map` for a collection whose keys arrive at run time.

### Validation

Because data refers to other data by name (a biome lists plant types by key, a level lists species by key), a typo breaks things in confusing ways. So the registry checks:

```javascript
validate() {
  const issues = [];
  for (const [key, species] of this.species) {
    if (!this.animalTypes.has(species.baseType)) {
      issues.push(`Species '${key}' references unknown base type '${species.baseType}'`);
    }
  }
  for (const [key, biome] of this.biomes) {
    if (biome.plantTypes) {
      for (const plantType of biome.plantTypes) {
        if (!this.plantTypes.has(plantType)) {
          issues.push(`Biome '${key}' references unknown plant type '${plantType}'`);
        }
      }
    }
  }
  // ...
  return issues;
}
```

This is the price of data-driven design and how to pay it. Code gets checked as it loads: misspell a function name and you get an error with a line number. Data doesn't: misspell `'tusock'` in a biome's plant list and you get nothing, until a plant fails to appear and you wonder why. A **validator** is a function that walks your data looking for those mistakes and reports them in plain words. Whenever you add a new kind of cross-reference to the data, add a check for it. Chapter 16 shows how to run every level's validation from the command line.

## A Level Is a File of Data

Now the largest piece of data in the game. Open `levels/level_01_kahurangi.js`. The whole file is one object and one line of code:

```javascript
const LEVEL_KAHURANGI = {
  id: 'kahurangi',
  name: 'Kahurangi',
  unlockCondition: null,

  terrain: { noiseScale: 0.005, octaves: 3, persistence: 0.3, /* ... */ plantDensity: 0.004 },
  biomes: { sea: { /* ... */ }, coastal: { /* ... */ }, /* ... */ },

  species: { moa: ['upland_moa'], eagle: ['haasts_eagle'], other: ['kea'] },
  startingSpecies: 'upland_moa',
  startSeason: 'spring',
  initialEntityCounts: { moa: 6, eagle: 1, kea: 4 },

  economy: { startingMauri: 60, seasonDuration: 1800, /* ... */ maxPopulation: 40 },
  mechanics: { noSpeciation: true, emergentEagles: true, eagleTargetRatio: 1 / 4, /* ... */ },

  availablePlaceables: { kawakawa: { cost: 25 }, harakeke: { cost: 30 }, shelter: { cost: 40 }, /* ... */ },

  timeLimit: 14400,
  fail: (sim) => { /* ... */ },
  goals: [ /* ... */ ],

  menu: { /* title, art, flavour text */ },
  tutorial: { /* ... */ }
};

LEVEL_REGISTRY.register(LEVEL_KAHURANGI);
```

Having read Chapters 4 to 11, you know what nearly every block does:

| Block | Feeds | Chapter |
|---|---|---|
| `terrain` | the noise and the plant density | 4, 6 |
| `biomes` | the elevation bands and what grows in them | 4 |
| `species`, `initialEntityCounts` | who lives here, and how many to start | 7 to 10 |
| `economy` | season length, incubation, starting mauri, caps | 5, 8, 11 |
| `mechanics` | which optional rules are on | this chapter |
| `availablePlaceables` | the toolbar | 11 |
| `goals`, `fail`, `timeLimit` | how the level is won and lost | this chapter |

A level is a *configuration of the engine*. The engine is the same every time. The level says which land, which animals, which rules, which tools and which aims.

### Self-registration

The last line of the file runs as the browser loads it:

```javascript
LEVEL_REGISTRY.register(LEVEL_KAHURANGI);
```

Each level file adds itself to a shared list. No central file enumerates the levels. To add one you create a file and add its `<script>` tag. To remove one you delete the tag. The order of the tags is the order in the menu.

This is why, in Chapter 4's project, your sandbox level appeared in the menu after two small edits. It's a pattern worth copying for anything with many independent entries: let each entry register itself, so the system that uses them doesn't need a list to keep in step.

### Resolving a level

When the player chooses a level, `Game.loadLevel` runs:

```javascript
loadLevel(levelId) {
  const rawDef = LEVEL_REGISTRY.get(levelId);
  const levelDef = resolveLevelDef(rawDef);
  this.currentLevel = levelDef;

  applyLevelToConfig(levelDef);

  this.activeBiomes = levelDef.biomes;
  this.activePlaceables = levelDef._resolvedPlaceables;
  this.activeSpecies = levelDef.species;
  // ... goals ...
}
```

Three steps. **Fetch** the raw data. **Resolve** it against defaults. **Apply** it to the running game.

`resolveLevelDef` is defaults-plus-overrides again:

```javascript
function resolveLevelDef(levelDef) {
  const resolved = {};
  for (const key in levelDef) resolved[key] = levelDef[key];

  resolved.terrain = Object.assign({}, LEVEL_DEFAULTS.terrain, levelDef.terrain || {});
  resolved.economy = Object.assign({}, LEVEL_DEFAULTS.economy, levelDef.economy || {});
  resolved.initialEntityCounts = Object.assign({}, LEVEL_DEFAULTS.initialEntityCounts, levelDef.initialEntityCounts || {});

  // Resolve placeable overrides onto base PLACEABLES
  if (resolved.availablePlaceables) {
    resolved._resolvedPlaceables = {};
    for (const [key, overrides] of Object.entries(resolved.availablePlaceables)) {
      if (PLACEABLES[key]) {
        resolved._resolvedPlaceables[key] = Object.assign({}, PLACEABLES[key], overrides || {});
      }
    }
  }
  return resolved;
}
```

`Object.assign({}, a, b)` does the same as `{ ...a, ...b }`: copy `a` into a fresh object, then `b` over it. It's the older spelling. The empty `{}` as the first argument is important. `Object.assign` writes *into* its first argument, and without the empty object it would modify `LEVEL_DEFAULTS` itself, corrupting the defaults for every level loaded afterwards.

Look at the placeables. A level writes:

```javascript
availablePlaceables: {
  kawakawa: { cost: 25 },
  shelter:  { cost: 35, eagleSpotFrac: 0.5 },
}
```

That does two things at once. The keys say *which* tools this level offers. The values *override* properties of those tools for this level only. Free Play's shelter costs 35 and only half-hides a moa. Level 1's costs 40 and hides it fully. The global `PLACEABLES` table is never changed. Each level gets its own merged copy, and that copy is what `PlaceableObject` reads as `this.def`.

It's the lesson from Chapter 5's climate again: **never modify the source data; build a derived copy**. If loading Free Play edited `PLACEABLES.shelter.cost`, then going back to Level 1 would find the price changed, and you'd have a bug that depended on the order levels were played in.

`applyLevelToConfig` then copies the level's terrain and economy numbers into `CONFIG`, as Chapter 1 described, and installs the `mechanics` block. That last part needs a section of its own.

## Mechanics as Opt-In Flags

As the game grew, new rules were wanted for particular levels. The glacial level needed moa to suffer outside their habitat. Free Play needed winter to strip the food from plants. A story level needed storms to hide moa. Each is a change to core behaviour: `Moa.behave`, `Plant.update`, `HaastsEagle.hunt`.

The risk is obvious. Change `Moa.behave` for the new level and you change it for every level, including ones that were balanced and finished.

The game's answer is a global object, set from the level:

```javascript
let LEVEL_MECHANICS = {};

function applyLevelToConfig(levelDef) {
  LEVEL_MECHANICS = levelDef.mechanics || {};
  // ...
}
```

and a convention for reading it. Here is habitat stress in `Moa.behave`:

```javascript
if (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.habitatStress) {
  const niche = this.speciesConfig.preferredElevation;
  if (niche) {
    const elev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
    const margin = LEVEL_MECHANICS.habitatStressMargin ?? 0.10;
    const lo = niche.min - margin, hi = niche.max + margin;
    const err = elev < lo ? lo - elev : (elev > hi ? elev - hi : 0);
    if (err > 0) {
      let penalty = LEVEL_MECHANICS.habitatStressPenalty ?? 0.45;
      penalty *= 1 + ((LEVEL_MECHANICS.winterStressMult ?? 1.4) - 1) * sc.winterness;
      this.hunger = Math.min(this.hunger + err * penalty * dt, this.maxHunger);
    }
  }
}
```

The whole block is wrapped in `if (... LEVEL_MECHANICS.habitatStress)`. A level that doesn't mention `habitatStress` has `undefined` there, the condition is false, and the block does nothing. **The feature is off unless a level asks for it.**

Inside, each tuning value is read with a default: `LEVEL_MECHANICS.habitatStressMargin ?? 0.10`. A level can switch the feature on with one line (`habitatStress: true`) and accept the defaults, or adjust any number.

This pattern is called a **feature flag**, and its guarantee is the reason to use it: adding a flagged mechanic cannot change any level that doesn't set the flag. You can build something experimental for one level with no risk to the rest. Search the code for `LEVEL_MECHANICS.` and you'll find around a hundred uses. Each one is a rule some level can turn on.

The flag names group into families. Here are the main ones and where they act:

| Family | Example flags | Effect | Chapter |
|---|---|---|---|
| Habitat | `habitatStress`, `forestCompetition` | hunger outside your niche; crowded forest feeds less | 7 |
| Diet | `unfavouredBrowsePenalty`, `nonFocalGeneralistBonus` | who gets how much from which plants | 7 |
| Breeding | `breedingSoftCap`, `matingAge`, `noSpeciation`, `maxPerSpecies` | density dependence and limits | 8 |
| Eagles | `emergentEagles`, `eagleTargetRatio`, `eagleStarveTimeout` | the self-regulating predator | 9 |
| Forest | `forestContraction`, `forestBandBySeason` | the shrinking treeline | 5, 6 |
| Climate | `climateDrift`, `winterInedibility`, `coldToleranceMatters` | Free Play's deepening cold | 5, 6 |
| Protection | `populationFloors`, `focalSpecies` | species that can't be wiped out | 8 |
| Cover | `coverBreaksLock`, `coverCalmsMoa`, `eagleTelegraph` | storms as cover, visible wind-ups | 9, 11 |
| Kea | `keaRaid`, `moaNestDisturbance`, `nestingSites` | raids and their consequences | 10 |

The level files are the reference. Each flag has a comment where a level sets it, and Free Play's `mechanics` block is the fullest.

### What it costs

I think this is a good design for this game, and it has costs you should see clearly.

**It's global mutable state.** Any code anywhere can read `LEVEL_MECHANICS`, and its contents change when a level loads. That makes functions harder to reason about in isolation: what `Moa.behave` does depends on an object it wasn't handed. A stricter design would pass the mechanics in as a parameter. The global was chosen because the rules are read in so many places that threading a parameter through all of them would have been a great deal of noise.

**It can be changed mid-game, and sometimes is.** Free Play raises `eagleTargetRatio` each year by writing to the object. `applyLevelToConfig` then has to remember to undo that on restart:

```javascript
// Restore the base eagle target ratio and hard cap (the yearly ramp in
// Game._applyFreeplayYearPressure mutates these live) so a restart doesn't inherit last
// run's ramped predator pressure.
if (LEVEL_MECHANICS._eagleTargetRatioBase != null) {
  LEVEL_MECHANICS.eagleTargetRatio = LEVEL_MECHANICS._eagleTargetRatioBase;
}
```

That's the "never modify the source data" rule being broken, and the comment is the scar. If you need a value to change during play, keep the changing copy somewhere separate from the level's own data.

**Flags multiply.** Two flags give four combinations. Ten give a thousand. Nobody has tested them all, and some combinations interact oddly. In practice only a handful of combinations exist, the ones real levels use, and it's wise to treat those as the supported set.

**The guards are noisy.** `typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.x` is a mouthful to read forty times in a file. Some newer code fetches it once at the top of a function:

```javascript
const M = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS) ? LEVEL_MECHANICS : {};
```

and reads `M.x ?? default` after that. If you write new mechanic code, do it that way.

None of this means the pattern was a mistake. Every way of organising code trades some virtues for others. This one bought safety and speed of experiment at the price of tidiness, and for a game being discovered as it's built, that's a reasonable bargain. Know what you bought.

### Exercise 12.2

Find a flag you haven't met. Search `mauri_moa.js` for `LEVEL_MECHANICS.` and pick one. Work out from the code what it does, what its default is, and which levels set it (search the `levels/` folder). Then turn it on in your sandbox level and see if you can observe the effect.

## Functions in Data: Goals

So far, data has been numbers, strings and nested objects. A level's goals show that data can hold behaviour too:

```javascript
goals: [
  { name: "Hatch 5 Upland Moa",
    condition: (sim) => (sim.stats.birthsBySpecies['upland_moa'] || 0) >= 5,
    reward: 50 },
  { name: "Reach 2 minutes",
    condition: (sim, game) => game.playTime >= 7200,
    reward: 50 },
],
```

Each goal has a name, a reward and a `condition`, which is a function. Given the simulation and the game, it returns `true` when the goal is met.

The engine's side is tiny. `loadLevel` wraps each one:

```javascript
this.goals = (levelDef.goals || []).map(goalDef => ({
  name: goalDef.name,
  condition: () => goalDef.condition(this.simulation, this),
  reward: goalDef.reward,
  achieved: false
}));
```

and `checkGoals` polls them:

```javascript
for (const goal of goals) {
  if (!goal.achieved && goal.condition()) {
    goal.achieved = true;
    this.mauri.earn(goal.reward, halfWidth, 80, 'goal');
    this.addNotification(`Goal achieved: ${goal.name}! +${goal.reward} mauri`, 'success');
  }
  if (!goal.achieved) allAchieved = false;
}
```

The engine has no idea what any goal is about. It doesn't know about hatching or minutes. It calls a function and looks at whether it got `true`. All the knowledge of *what counts* lives in the level file, in a line of JavaScript that can ask anything at all of the simulation.

That's the most flexible kind of data there is. A level designer can invent a goal nobody anticipated ("have more kea than eagles in winter") without touching the engine.

A few things about that wrapping code.

`.map(fn)` builds a new array by applying `fn` to each element. Here it turns each goal *definition* into a goal *instance*, with its own `achieved: false`. The definitions in the level file are never modified, so restarting the level starts with fresh goals. (The "derived copy" rule, once more.)

The inner arrow function `() => goalDef.condition(this.simulation, this)` is a **closure**. It's created inside `loadLevel`, and it remembers two things from where it was made: `goalDef` and `this`. Later, when `checkGoals` calls `goal.condition()` with no arguments, the function still has both and can supply the simulation and the game itself. Closures are how you bundle a function together with the context it needs. You've used them since Chapter 1's loading plan.

Note also *why* it says `this.simulation` inside the closure and doesn't capture the simulation directly. When `loadLevel` runs, the simulation doesn't exist yet; it's created when the level starts. By looking it up at call time, the closure always gets the current one.

The same idea appears in other fields of a level:

```javascript
fail: (sim) => { /* true if the level is lost */ },
unlockCondition: (progress) => progress.levelsCompleted.includes('kahurangi'),
scoreFormula: (ctx) => Math.round(ctx.moaCount * 50 + ctx.totalEarned * 0.2),
```

Each is a small question the engine asks at the right moment, with the answer supplied by the level.

### Phases

The glacial level uses a richer structure. Instead of one list of goals, it has `phases`: an ordered list, each lasting two seasons, each with its own goals, some of which are `survive` goals (met by lasting to the end of the phase) and an optional `fail` function.

`Game._checkPhases` works out which phase it is from the clock:

```javascript
const phaseDur = 2 * CONFIG.seasonDuration;
const idx = Math.min(Math.floor(this.playTime / phaseDur), this.phases.length - 1);
```

Time divided by phase length, rounded down, is the phase number. `Math.min` stops it running past the last one. When `idx` changes, the outgoing phase's survival goals are marked achieved, and `this.goals` is rebuilt from the new phase. The UI draws whatever is in `this.goals` and never learns that phases exist.

There are four ways a level can be structured, checked at the top of `checkGoals`:

```javascript
checkGoals() {
  if (this.module || this.chapters) return;                                  // a story runs the goals
  if (this.currentLevel && this.currentLevel.endless) { this._checkFreeplayYear(); return; }
  if (this.phases) { this._checkPhases(); return; }
  // ... classic goals ...
}
```

Classic goals, phases, Free Play's yearly goals, and story-driven levels (Chapter 14). All four end by writing into `this.goals`, so one goals panel shows any of them. That's a useful shape: several different sources feeding one common display format.

## Building Levels From Other Levels

Because a level is a JavaScript object, you can construct one with code. `levels/chapters_prototype.js` borrows freely:

```javascript
const CHAPTERS_PROTOTYPE = {
  id: 'chapters_prototype',
  zoom: LEVEL_GLACIAL_KAHURANGI.zoom,
  terrain: Object.assign({}, LEVEL_GLACIAL_KAHURANGI.terrain),
  biomes: LEVEL_GLACIAL_KAHURANGI.biomes,
  // ...
  mechanics: Object.assign({}, LEVEL_FREEPLAY_KAHURANGI.mechanics, {
    climateDrift: null,
    focalSpecies: ['upland_moa'],
    eagleMaxPopulation: 4,
    landRegionMates: true
  }),
  // ...
};
```

Level 2's land. Free Play's rules, with four of them changed. Defaults plus overrides, applied to whole levels. The result reads as a statement of intent: *this is Free Play's ecology without the climate, focused on one species*.

This is why the order of level scripts in `index.html` matters, and why there's a comment on that tag: the prototype uses `LEVEL_GLACIAL_KAHURANGI` at its top level, so that file must load first (Chapter 1's rule).

Some level files go further and are **factories**: a function that takes a few settings and returns a level, called more than once to register variants of the same lesson. When you find yourself copying a level file to change three numbers, that's the cue to make the copy a function call.

## Saving Progress

One last small system: remembering between sessions which levels the player has finished. It's `PROGRESS` in `mauri_progress.js`, and it's the entire persistence layer of the game.

```javascript
save() {
  try {
    localStorage.setItem(this._storageKey, JSON.stringify({
      levelsCompleted: this.levelsCompleted,
      levelsUnlocked: this.levelsUnlocked,
      bestScores: this.bestScores
    }));
  } catch (e) {
    console.warn('Could not save progress:', e);
  }
},

load() {
  try {
    const data = localStorage.getItem(this._storageKey);
    if (data) {
      const parsed = JSON.parse(data);
      this.levelsCompleted = parsed.levelsCompleted || [];
      this.levelsUnlocked = parsed.levelsUnlocked || [];
      this.bestScores = parsed.bestScores || {};
    }
  } catch (e) {
    console.warn('Could not load progress:', e);
  }
},
```

`localStorage` is a small key-value store the browser provides to each website. It survives closing the tab. It only holds strings, so the data is converted with `JSON.stringify` on the way in and `JSON.parse` on the way out. JSON is a text format for plain data: objects, arrays, numbers, strings, booleans. It can't hold functions or class instances, which is why only simple lists and a score table are saved.

Three defensive habits here are worth copying:

- **`try` / `catch` around both.** Storage can be full, disabled, or blocked in a private window. A game that crashes because it couldn't save is worse than one that quietly doesn't.
- **`|| []` on every field.** Saved data may be from an older version of the game that didn't have that field. Never assume a loaded value is present.
- **A key with the game's name in it** (`'avianage_progress'`), since every page on the same site shares the store.

The game saves only progress, not a level in mid-play. Saving a running simulation would mean turning every moa, plant and timer into plain data and back again. It's possible, and it's a real project. If you want to attempt it, the data-driven structure helps: a moa is mostly a species key plus a dozen numbers.

## Summary

- Put *what things are* in tables and *how things work* in classes. One `Moa` class serves nine species.
- Defaults plus overrides: `{ ...defaults, ...specific }` or `Object.assign({}, defaults, specific)`. It's a shallow merge; `mergeConfigs` recurses for a deep one.
- `REGISTRY` maps type names to classes and species names to configs. `createAnimal(key, ...)` is a factory: it makes the right class from a string.
- Data that refers to data by name needs a validator.
- A level is one object configuring the engine: terrain, biomes, species, economy, mechanics, tools, goals. Each file registers itself.
- `resolveLevelDef` merges a level with defaults into a new object. Source tables are never modified.
- `LEVEL_MECHANICS` holds opt-in flags. A rule wrapped in `if (LEVEL_MECHANICS.x)` with `??` defaults can't affect levels that don't set it. The costs: global state, flag combinations, noisy guards.
- Goals are functions stored in data. The engine polls `condition()` and knows nothing about what it tests. Closures carry the context.
- Classic goals, phases, yearly goals and stories all write to `this.goals`.
- Levels can be built from other levels with the same merge.
- Progress is saved as JSON in `localStorage`, defensively.

## The Mauri Project

Design a species and a level around it, using only data, and then add one flag of your own.

1. **A species.** In `MOA_SPECIES`, add `tussock_moa`: small (`size: { min: 7, max: 9 }`), fast (`baseSpeed: 0.2`, `fleeSpeed: 0.3`), nervous (`flightiness: 1.0`), with `camouflage: 0.4`, a `tint`, a `preferredElevation` in the forest band, and a `displayName`. It will be registered automatically (see `initializeRegistry`).
2. **A level for it.** In your sandbox level, set `species.moa` to `['tussock_moa', 'south_island_giant_moa']` and add `initialSpeciesDistribution: { tussock_moa: 6, south_island_giant_moa: 4 }`. Add `mechanics: { noSpeciation: true, emergentEagles: true }`. Play. Which species do the eagles take? Does that match what you'd predict from `camouflage`, `flightiness` and the scarcity rule in Chapter 9?
3. **Goals.** Give the level three goals: one on a count (`sim.getSpeciesCount('tussock_moa') >= 10`), one on time, and one that compares two things (more tussock moa than giant moa). Add a `fail` function that loses the level if the tussock moa die out, and a `failReason`.
4. **Validate.** In the console, run `LEVEL_REGISTRY.validate(LEVEL_REGISTRY.get('sandbox'))`. Then misspell a species key in the level, reload, and run it again.
5. **A flag of your own.** Add a mechanic `nightOwls` that makes moa forage more boldly: when `LEVEL_MECHANICS.nightOwls` is set, `Moa.findPlant`'s search range is multiplied by `LEVEL_MECHANICS.nightOwlRange ?? 1.5`. Write it in the house style: fetch `M` once, use `??` for the default. Turn it on in the sandbox only. Then start Level 1 and satisfy yourself it's unaffected. How would you prove that, not merely believe it?
6. Stretch: make a second sandbox level that is `Object.assign({}, LEVEL_SANDBOX, { id: 'sandbox_hard', ... })` with a harsher `mechanics` block built by merging. What must you be careful not to share between the two (hint: nested objects and shallow copies)?
