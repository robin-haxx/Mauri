# Chapter 10: Birds of the Canopy

> E koekoe te tūī, e ketekete te kākā, e kūkū te kererū.
>
> The tūī chatters, the kākā cackles, the kererū coos.
> — whakataukī

*Builds on Chapters 2, 6, 7 and 9.*

The proverb says it takes all kinds. By this point in the game's development there were moa and eagles, and the design called for more: a pigeon that spreads forest, an alpine parrot that robs nests, a forest parrot that flocks, a flightless one that breeds only in bumper years, and a songbird that holds a territory.

Five new animals. Writing five new files the size of `mauri_moa.js` would have been months of work and five times the bugs. What happened instead is that one new animal was written properly, and the other four were written as *differences from it*. The pigeon, `Kereru`, is about 800 lines. The kākā is 230. That economy is the subject of this chapter. It's about **inheritance**: how to build a family of related things so that each new member costs only what makes it different.

Along the way you'll meet a creature whose behaviour loop helps the plants it eats, and a flock that spreads itself across food without anyone telling it to.

## Inheritance, From the Start

You have already been using inheritance. `class Moa extends Boid` means: a `Moa` is a `Boid`, with everything a boid has, plus more. When you write `moa.seekPoint(...)`, JavaScript looks for `seekPoint` on `Moa`, doesn't find it, and looks on `Boid`. The `extends` keyword sets up that chain.

Three things happen in a subclass.

**It adds.** `Moa` has `forage` and `findPlant`. `Boid` doesn't.

**It overrides.** If the subclass defines a method with the same name as one in the parent, the subclass's version wins. `HaastsEagle` has its own `separate` that replaces `Boid.separate`.

**It extends.** An override can call the parent's version with `super`, and do something before or after. Here is `Kereru.update`:

```javascript
update(dt = 1) {
  this.animTime += dt;
  // ... ease altitude up or down ...

  super.update(dt);
  // Boid.update: acceleration into velocity, velocity into position.

  // ... ease the facing, clamp to land ...
}
```

It does its own preparation, hands over to `Boid.update` for the physics, then tidies up. The physics is written once, in `Boid`, and every animal reuses it.

Constructors work the same way, with one rule: a subclass constructor **must** call `super(...)` before it touches `this`.

```javascript
class Kereru extends Boid {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain);
    // Now `this` has pos, vel, acc, maxSpeed and the scratch vectors.
    this.alive = true;
    this.isFlyer = true;
    // ...
  }
}
```

The family tree for the game's animals:

```
Boid
 ├── Moa
 ├── HaastsEagle
 └── Kereru                (the pigeon, and the base for every other bird)
      ├── Kokako
      ├── Kea
      ├── Kaka
      └── Kakapo
```

This is why `index.html` lists `mauri_kereru.js` before the other four, with a comment on each saying so. It was the answer to Exercise 1.1.

## The Kererū

The kererū is the New Zealand wood pigeon, a heavy, unhurried bird and the only one left with a gape wide enough to swallow the big fruit of trees like rimu. It eats the fruit, flies off, and the seed comes out the other end somewhere else. The forest moves around the country in the guts of pigeons.

That's the behaviour the class models, and its header comment gives the loop:

```
FLYING (hungry) → hop to a fruiting tree
     → FEEDING (perched) → fill the crop (the tree is NOT consumed)
     → PERCHED (digest, maybe lay an egg)
     → FLYING (full) → short hops away, dropping a seed each (disperseSeed)
     → crop empty → hungry → FLYING.
```

It's a state machine with three states and one extra variable, `crop`, the number of fruit the bird is carrying.

```javascript
const KERERU_STATE = {
  FLYING:  'flying',
  FEEDING: 'feeding',
  PERCHED: 'perched',
  SHELTER: 'sheltering'
};
```

### A cycle, not a cascade

The moa's state machine re-decided everything each frame from a list of priorities. The kererū's is the other classic kind: each state runs until its own exit condition, then names the next state. Here's the flying state when the bird is hungry:

```javascript
_flying(sim, dt) {
  if (this.crop <= 0) {
    if (!this._treeValid(this._targetTree)) {
      this._treeSearchTimer -= dt;
      if (this._treeSearchTimer <= 0) {
        this._treeSearchTimer = 30;
        this._targetTree = this._findFruitTree(sim);
      }
    }
    if (this._treeValid(this._targetTree)) {
      this._target.set(this._targetTree.pos.x, this._targetTree.pos.y);
      const dx = this._target.x - this.pos.x, dy = this._target.y - this.pos.y;
      if (dx * dx + dy * dy < 14 * 14) {
        this.state = KERERU_STATE.FEEDING;
        // Arrived: change state.
        this._feedTimer = this._feedFrames;
        return;
      }
      this.applyForce(this.seek(this._target, 1, 24));
    } else {
      this._driftHome(sim, dt);
    }
  } else {
    // ... carrying fruit: fly to the hop target, drop a seed, perch ...
  }
}
```

Find a tree (throttled to one search per half second). Fly to it with an arrive radius. On arrival, set `this.state = FEEDING` and start a timer. Next frame the dispatcher runs `_feeding` instead.

```javascript
_feeding(sim, dt) {
  this.maxSpeed = 0.15;
  this.vel.mult(Math.pow(0.8, dt));
  // ...
  this._feedTimer -= dt;
  if (this._feedTimer <= 0) {
    this.crop = this._cropCapacity;
    this.hunger = Math.max(0, this.hunger - this._feedRelief * _scale);
    this._targetTree = null;
    this.state = KERERU_STATE.PERCHED;
    this._restTimer = this._restFrames;
  }
}
```

Sit for five seconds. Then the crop is full, hunger is relieved, and the state becomes `PERCHED`.

Which style should you use? A priority cascade suits a creature that must react at once to changing circumstances, like a moa that should drop everything when an eagle appears. A cycle suits a creature with a routine. The kererū gets both by handling emergencies *before* the cycle runs:

```javascript
behave(sim, mauri, seasonManager, dt) {
  // ... age, hunger ...
  if (this._fleeStorm(sim, dt)) return;
  if (this._fleeHarrier(sim, dt)) return;
  // Emergencies first, each able to take over the whole frame.

  this._runState(sim, dt);
  // Otherwise, the routine.
  // ...
}
```

Two overrides with early returns, then the routine. That hybrid, interrupts on top of a cycle, is a very common shape for game characters.

### Friction that respects dt

A small line in `_feeding` deserves attention:

```javascript
this.vel.mult(Math.pow(0.8, dt));
```

The bird is settling onto a branch, so its velocity is multiplied by 0.8 each frame until it stops. That's friction. But "multiply by 0.8 each frame" is frame-rate dependent in a way that `* dt` can't fix: multiplying by `0.8 * dt` would be wrong (at `dt = 2` it would multiply by 1.6 and speed the bird *up*).

Two frames of friction is `0.8 × 0.8`, which is `0.8²`. So `dt` frames of friction is `0.8` to the power `dt`. That's what `Math.pow(0.8, dt)` computes. Anything you'd apply by repeated multiplication (friction, decay, fading) needs `Math.pow(factor, dt)` to be frame-rate independent. You'll find plain `this.vel.mult(0.95)` elsewhere in the game, and at a steady 60 fps nobody notices the difference, but this line is the correct form.

### The tree is not consumed

A moa eating a plant calls `consume()`, which empties it. A kererū at a tree doesn't. It sits for five seconds and leaves with a full crop, and the tree is as it was.

That is a modelling choice with large consequences. Moa and kererū share the same trees and don't compete for them in the same way. A moa strips a rimu and the next moa finds nothing. Ten kererū can use one rimu in turn. So the birds are limited by where trees *are* and whether those trees are fruiting, not by how much fruit there is.

It also sets up the loop this animal exists for.

### Dispersal: a loop that feeds itself

With a full crop, the bird hops away, and each time it lands it drops a seed:

```javascript
if (arrived || this._disperseTimer <= 0) {
  if (sim.disperseSeed && random() < this._disperseChance) sim.disperseSeed(this.pos.x, this.pos.y);
  this.crop -= 1;
  this._disperseTimer = this._disperseFrames;
  this.state = KERERU_STATE.PERCHED;
  this._restTimer = this._restFrames;
  return;
}
```

`sim.disperseSeed` is the method from the end of Chapter 6, with its density gates and caps. If it succeeds, a seedling appears where the bird landed.

Follow the consequences round. Trees feed birds. Fed birds breed. More birds drop more seeds. Seeds become trees. More trees feed more birds.

This is a **reinforcing loop**: each part pushes the next in the same direction, and the whole thing grows. It's the opposite of the loops that held the moa population steady. Between two species, when each benefits the other, biologists call it mutualism. Run it forward and the forest expands. Run it backward (the forest contracts in a glacial winter, birds starve, fewer seeds fall) and the forest's retreat is made worse by the loss of its gardeners.

Now you can see why `disperseSeed` needs brakes. A reinforcing loop with no limit grows until something external stops it. The density gate is that limit. Chapter 13 puts this loop on a diagram with all the others.

### Seconds in the data, frames in the code

The kererū's numbers are written in seconds:

```javascript
const KERERU_SPECIES = {
  // ...
  feedSec:          5,      // perched feeding time to fill the crop
  disperseEverySec: 20,     // cadence of seed drops while carrying
  restSec:          8,      // perched digest/rest between hops
  starveSec:        18,     // sustained max-hunger before death
  maturitySec:      20,
  eggCooldownSec:   35,
  // ...
};
```

and converted once, in the constructor:

```javascript
const F = 60;
this._feedFrames     = (sp.feedSec ?? 5) * F;
this._disperseFrames = (sp.disperseEverySec ?? 5) * F;
this._restFrames     = (sp.restSec ?? 4) * F;
```

The moa's data is in frames (`eggCooldownTime: 1100`), and you have to divide by 60 in your head to know what it means. The birds were written later, and their author had learned something: **put the unit in the name, and store data in the unit a person thinks in**. `restSec: 8` needs no explanation. If you add new timing data to the game, follow the birds.

### Flying

A bird's position is still a 2D point on the map. Height is a separate number, `_altitude`, used only for drawing:

```javascript
const targetAlt = perched ? this._perchAltCur : this._cruiseAlt;
this._altitude += (targetAlt - this._altitude) * Math.min(1, 0.08 * dt);
```

It eases (Chapter 2's pattern) between a cruising height and a perching height. The renderer draws the bird's shadow at `pos` and the bird itself `_altitude` pixels above. The gap between a thing and its shadow is what tells your eye it's in the air. The bird rises when it takes off and settles when it lands, and none of that touches the simulation.

The flag `isFlyer = true` tells the simulation to draw the bird in a later pass, above the trees. The eagle reads it too: only flyers can be hunted in the air.

Birds also ignore `isWalkable`. They can cross scree and snow. What they can't do is linger over open water: `_landward()` returns a force pulling a bird back toward the last land it was over, and `update` snaps it back if it ends a frame somewhere impassable. Different animals have different ideas of what an obstacle is, and each gets its own small rule.

## Designing a Class to Be Extended

Now the craft. `Kereru` was written knowing other birds would extend it, and you can see that in how it's cut up.

Look at this method:

```javascript
// State dispatch; split out so a subclass can add a state (kōkako SINGING).
_runState(sim, dt) {
  switch (this.state) {
    case KERERU_STATE.FLYING:  this._flying(sim, dt); break;
    case KERERU_STATE.FEEDING: this._feeding(sim, dt); break;
    case KERERU_STATE.PERCHED: this._perched(sim, dt); break;
    default:                   this.state = KERERU_STATE.FLYING; break;
  }
}
```

It could have been written inline in `behave`. It's a separate method because the comment says why: so a subclass can add a state. Here is the kōkako adding one, in full:

```javascript
_runState(sim, dt) {
  if (this.state === KOKAKO_STATE.SINGING) { this._singing(sim, dt); return; }
  super._runState(sim, dt);
}
```

Three lines. If I'm singing, do that. Otherwise, do whatever a kererū does. The kōkako gets the whole flying-feeding-perching cycle for free and bolts a fourth state onto it.

And look at these:

```javascript
// Hook: called right after this bird lays an egg. Base no-op; the kōkako sings a post-lay song.
_onLaid() {}

// May this bird starve to DEATH right now? Base: yes. A subclass can shield a focus flock.
_starveImmune(sim) { return false; }

// Home anchor for territory/pair fidelity. null = free-ranging (the kererū).
_anchorPoint() { return this._forestHome || null; }

_renderExtra(s, perched) {}
```

Methods that do nothing, or return a fixed answer. Why write a method that does nothing?

Because the base class *calls* them at the right moments. `_tryReproduce` calls `this._onLaid()` after laying. The starvation code asks `this._starveImmune(sim)` before killing the bird. `_pickHop` asks `this._anchorPoint()` where home is. In a plain kererū those calls do nothing interesting. In a subclass that overrides them, they do.

These are called **hooks**. A hook is a deliberate gap in the parent's algorithm, a place where it says "if you're a special kind of bird, here's where you get a say". The parent owns the overall sequence of steps. The child fills in particular steps. This arrangement has a name, the **template method pattern**, and it's the most useful thing to know about inheritance.

Without hooks, a subclass that wanted to sing after laying an egg would have to copy the whole of `_tryReproduce`, fifty lines, and add one line to the copy. Then every fix to the original would have to be made twice. With the hook, the subclass writes one short method of its own, in outline:

```javascript
_onLaid() { /* start a song */ }
```

When you write a class that others will extend, look for the steps that might vary and pull each into its own small, named method. When you extend a class, look for its hooks first and override the smallest thing that gets you what you want.

### Exercise 10.1

In a sketch, write a `Creature` class with `update()` that calls, in order, `this.sense()`, `this.decide()`, `this.move()`, and a `show()` that draws a circle and then calls `this.showExtra()`, which does nothing. Then write `Glowworm extends Creature`, overriding only `showExtra` to draw a pulsing halo, and `Runner extends Creature`, overriding only `move`. Put ten of each in one array and update and show them all with a single loop.

That last part, one loop over a mixed array where each object does the right thing for its own type, is called **polymorphism**. The simulation does it in `_updateOtherEntities`: it calls `entity.behave(...)` on every bird without knowing or caring which kind it is.

## Four Birds as Differences

With the base understood, each other bird can be described in a few sentences, and that's roughly how much code each needed.

### Kākāpō: override by subtraction

The kākāpō is a huge flightless parrot that breeds only in years when the rimu fruit heavily, a "mast year". Two differences.

It doesn't fly. In its constructor:

```javascript
this.isFlyer = false;
this._cruiseAlt = 0;
this._perchAlt = 0;
this._altitude = 0;
```

It still runs the "flying" state, since that state is really "travelling to food". It just does so at altitude zero and is drawn on the ground, under the trees.

And it breeds only in a mast:

```javascript
_tryReproduce(sim) {
  if (!(sim && sim.mastYear)) return;
  return super._tryReproduce(sim);
}
```

One guard clause in front of the parent's method. Not a mast year: nothing. A mast year: everything a kererū does. This is the cleanest kind of override. It adds a condition and delegates the rest.

In play, this bird's whole existence turns on a thing the player can buy: the Mast Year tool. For years the kākāpō do nothing but survive. Then a mast is triggered and they breed all at once. One `if` gives a species a completely different rhythm from every other.

### Kōkako: a new state and a territory

The kōkako sings. Secure on a perch, it enters a `SINGING` state (added through `_runState` as you saw) and sits longer. Other kōkako inside its territory radius are pushed away. Since every kōkako does this, they end up spaced evenly through the forest, each on its own patch.

That's territory by mutual repulsion, the same mechanism as the eagles in Chapter 9, arrived at through a different excuse. Its `_anchorPoint` returns the territory's centre, so the base class's hopping and drifting code keeps it at home.

### Kākā: cohesion at last

The kākā is a forest parrot that goes about in noisy groups. Its addition is a gentle pull toward nearby flockmates while flying: Reynolds's cohesion, the rule from Chapter 2 that moa never use. A lone kākā pulls toward the nearest other one more strongly, so that stragglers rejoin.

The header comment records why its "home" works as it does: an earlier version pulled the flock toward its own centre, and *a flock that drifted off the fruit had nothing pulling it back and quietly starved*. Cohesion alone keeps a group together; it doesn't keep it anywhere useful. The fix was to anchor the flock on forest. It's the giving-up lesson from Chapter 7 in another form: check that the thing your animal is drawn to is one it can live on.

### Kea: the clever one

The kea, the alpine parrot, has the most additions, and three are worth reading closely.

**A range that slides with the cold.** Kea live high in the warm and come down to the forest in the cold. Their preferred elevation band is a lerp between two bands:

```javascript
_preferredElevBand() {
  const sm = this._sm;
  const winter = sm.getWinterness();
  const cold   = sm.coldIndex;
  let descend = this._descendWinter * winter + this._descendCold * cold;
  if (descend < 0) descend = 0; else if (descend > 1) descend = 1;
  const w = this._bandWarm, c = this._bandCold;
  const lo = lerp(w.lo, c.lo, descend);
  const hi = lerp(w.hi, c.hi, descend);
  return { lo, hi, center: (lo + hi) * 0.5 };
}
```

A warm band (0.48 to 0.66) and a cold band (0.34 to 0.50). `descend` is how far along from one to the other, built from the two smooth signals of Chapter 5: `winterness` for the season and `coldIndex` for the year. Two inputs, each weighted, added, clamped to 0 to 1, and used as a lerp's `t`. That's the standard recipe for blending between two configurations according to several conditions.

**A flock that spreads itself over food.** The player can place Berry Caches to draw kea. With two caches, what should happen? If each kea went to the nearest, they might all pile onto one. Here is `_chooseLure`'s scoring:

```javascript
const nutrition = base + (c._keaFood || 0);
let n = crowd.get(c) || 0;                              // kea already committed to this cache
if (c === this._lureChoice && n > 0) n--;               // don't count myself
const perCapita = nutrition / (1 + this._lureCrowdWeight * n);
const distFactor = Math.max(0.08, 1 - cand.d / cand.r); // near → ~1, far → 0.08
let score = perCapita * distFactor;
if (c === this._lureChoice) score *= 1.15;              // stickiness
```

The score is **food per bird**, discounted by distance. A cache with 20 food and no kea scores 20. The same cache with four kea on it scores 4. So as birds arrive at a cache, it becomes less attractive to the next bird, who goes to the other one. The flock divides itself between caches in proportion to how much food each has.

No kea knows this is the plan. Each makes a selfish choice about its own share. The even spread is what you get when they all do. Ecologists call the result an *ideal free distribution*, and they observe it in real animals feeding at patches. Here it's five lines.

Two details stop the flock from churning. A kea doesn't count itself in the crowd at its current cache (otherwise its own presence would push it to leave). And its current choice gets a 15% bonus, **stickiness**, so it only switches when another cache is clearly better. That's hysteresis again, applied to a choice instead of a threshold. And each kea re-evaluates on its own jittered timer, not every frame and not all together.

The same crowding idea picks perch trees (`_perchCrowdWeight`): a tree with a kea already near it scores lower, so the birds fan out across a grove instead of stacking on one branch.

**Raiding, and a field of fear.** Kea rob moa nests. When a raid succeeds, the egg is destroyed and the simulation records a **disturbance** at that spot:

```javascript
_addDisturbance(x, y) {
  this._disturbances.push({ x, y, strength: M.disturbancePerRaid ?? 1.0 });
}

disturbanceAt(x, y) {
  // ...
  let sum = 0;
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    const dx = d.x - x, dy = d.y - y, dSq = dx * dx + dy * dy;
    if (dSq >= R2) continue;
    sum += d.strength * (1 - Math.sqrt(dSq) / R);
  }
  return sum;
}
```

A disturbance is a point with a strength. `disturbanceAt` adds up, for any location, the contribution of every disturbance within 75 units, each falling off linearly with distance (the `1 - d / R` shape from Chapter 2's flee). Strengths fade to nothing over about 22 seconds.

This is a **scalar field**: a number defined at every point in space, built from a few sources. It isn't stored as a grid. It's computed on demand from the list of sources. Moa read it: `shouldMigrate` returns true if the disturbance where they stand is above 0.5, and `findMigrationTarget` subtracts it from each candidate's score. So moa leave a place where nests have been robbed and avoid settling there until the memory fades.

Fields like this are a powerful way to let one kind of animal affect another *indirectly*. The kea never touches a moa. It leaves a mark on the world, and the moa respond to the mark. The same technique gives you scent trails, noise, heat, trampling, anything that lingers. Ant-colony simulations run entirely on it.

So the kea's cleverness links three species into a chain: the player places a cache; kea gather; kea raid nests near it; moa abandon the area; eagles, which track moa nests, follow. The game's notes call this the kea cascade. No single piece of code describes it.

### Exercise 10.2

Make two food patches and 30 agents. Each agent picks a patch by `food / (1 + agentsThere)` and re-picks every second or so on a jittered timer. Give the patches food amounts of 30 and 10. How do the agents split? Now remove the stickiness bonus and the timer jitter and re-pick every frame. What happens?

### Exercise 10.3

Implement a disturbance field. Click to add a source. Draw the field by sampling `disturbanceAt` on a coarse grid and shading each cell. Let sources decay. Then add wandering agents that steer away from high values.

## Plugging a New Kind of Animal In

Moa live in `simulation.moas` and eagles in `simulation.eagles`. Those two were built first and have their own lists and grids. Every other kind lives in a dictionary:

```javascript
this.otherEntities = {};     // { kereru: [...], kea: [...], kaka: [...] }
```

keyed by type name, with a list for each. The simulation loops over whatever is in there:

```javascript
_updateOtherEntities(mauri, dt) {
  for (const [type, list] of Object.entries(this.otherEntities)) {
    for (let i = 0; i < list.length; i++) {
      const entity = list[i];
      if (!entity.alive) continue;
      if (entity.behave) entity.behave(this, mauri, this.seasonManager, dt);
      if (entity.update) entity.update(dt);
      this.constrainToBounds(entity.pos);
    }
  }
}
```

It doesn't know what kinds exist. It asks only that each has `alive`, `pos`, `behave` and `update`. That's an **interface**: an agreement about what methods an object offers. Anything that keeps the agreement can be dropped in. The spatial grids, the cleanup sweep, the population cache and the renderer treat `otherEntities` the same way.

So adding a sixth bird needs no change to `mauri_simulation.js`. You need:

1. A class that extends `Kereru` (or `Boid`).
2. A species object with its numbers.
3. One line adding its key to `FLYER_TYPES`, so its eggs hatch correctly:
   ```javascript
   if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kokako');
   ```
4. Two lines in `initializeRegistry()` in `mauri_sketch.js` (Chapter 12).
5. A `<script>` tag after `mauri_kereru.js`.
6. A count in a level's `initialEntityCounts`.

The lesson of the two fixed lists and the one open dictionary is about how code grows. The first two animals were special-cased, which was the right call when there were two. By the third, the pattern was clear and a general mechanism was built. Don't build the general mechanism first. Write the second special case, notice the repetition, and generalise on the third.

## Summary

- `extends` makes one class inherit from another. A subclass adds, overrides, or extends with `super`.
- `Kereru` runs a cycle: fly to a tree, feed (the tree isn't consumed), perch, fly off dropping seeds. Emergencies interrupt the cycle with early returns.
- `Math.pow(factor, dt)` is the frame-rate-independent form of repeated multiplication.
- Seed dispersal closes a reinforcing loop between birds and forest. Reinforcing loops need a limit.
- Store timings in seconds with the unit in the name; convert to frames once.
- Altitude is a drawing-only number eased between cruise and perch heights. The shadow sells the height.
- Hooks are small overridable methods the base class calls at set moments (`_runState`, `_onLaid`, `_starveImmune`, `_anchorPoint`). Override the smallest one that does the job.
- Kākāpō: a guard clause in front of `super._tryReproduce`. Kōkako: a state added through `_runState`. Kākā: cohesion, anchored to forest. Kea: a lerped elevation band, food-per-bird choice, and raids.
- Scoring by share (food ÷ crowd) spreads a flock across patches. Stickiness and jittered timers stop it thrashing.
- A disturbance field lets one animal affect another through the world.
- `otherEntities` holds any type that offers `alive`, `pos`, `behave` and `update`.

## The Mauri Project

Add a bird of your own: the tūī.

1. Create `mauri_tui.js`. Model it on `mauri_kaka.js`, the shortest subclass. Declare `class Tui extends Kereru`, a `TUI_SPECIES` object (copy `KERERU_SPECIES` and change `displayName`, `label`, a smaller `size`, a faster `baseSpeed`, a shorter `restSec`), and the `FLYER_TYPES.add('tui')` line.
2. Add its `<script>` tag to `index.html` after `mauri_kereru.js`. In `initializeRegistry()` in `mauri_sketch.js`, register it the way the kākā is registered.
3. In your sandbox level, add `tui: 6` to `initialEntityCounts` and `'tui'` to `species.other`. Run it. With no sprite the base class draws a simple glyph. Do your tūī feed, perch and breed?
4. Make it a tūī. Tūī are fiercely territorial around a food tree and chase other birds off. Override `_runState`: before calling `super._runState`, if the bird is `FEEDING`, look through `sim.otherEntities` for any other flyer within 30 units of its `_targetTree` that is not a tūī, and set that bird's `_targetTree = null` and `state = KERERU_STATE.FLYING`. You've just written interference competition between species.
5. Watch the kererū with your population chart from Chapter 8 (add a line for each bird type using `getSpeciesCount`). Does adding tūī hurt them? Does the forest spread more slowly?
6. Stretch: give the tūī a hook of its own to use. Override `_renderExtra(s, perched)` to draw the white throat tuft as two small circles. Then override `_onLaid` to post a notification.
