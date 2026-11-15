# Chapter 7: The Moa Mind

> He kai kei aku ringa.
>
> There is food at the end of my hands.
> — whakataukī

*Builds on Chapters 2 (steering), 3 (queries), 5 (seasons) and 6 (plants).*

In Chapter 2, I built a body: something with a position and a velocity that can be pushed around by forces, and a kit of forces to push it with. A body with no mind just wanders. This chapter builds the mind. It decides, sixty times a second, which of those forces to apply and how hard.

The moa is the animal the player watches most closely, and its brain is the most developed in the game: `Moa.behave` and its helpers in `mauri_moa.js`. The ideas in it, a drive, a state machine, a scoring function and a watchdog, are the same ones behind the eagle and the birds, so time spent here pays off three times over.

Craig Reynolds described an autonomous agent in three layers. **Action selection**: what do I want? **Steering**: what force gets me that? **Locomotion**: how do my legs move? Chapter 2 was steering. Locomotion in this game is a sprite animation. This chapter is action selection.

## A Drive

Why does a moa do anything? Because it's hungry.

```javascript
this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);
```

One number, creeping upward. That's a **drive**: an internal quantity that grows with time and that the animal acts to reduce. Everything else in the moa's behaviour hangs off this line. Take it out and the moa would have no reason to move.

Remember the direction: hunger of 0 is full, 100 is starving. A new moa starts between 15 and 35. With the default rate of 0.02 per frame it gains 1.2 points of hunger a second, so a moa that never eats goes from full to dead in about 80 seconds.

The rate itself is a product of several factors, in the style of Chapter 6:

```javascript
this.hungerRate = this.baseHungerRate * sc.hungerMod * hungerMod * _hm * (this.isJuvenile() ? _juv : 1);
```

The species' base rate, times the season's modifier (winter costs more), times the species' own seasonal modifier (upland moa are cold-adapted, so their winter figure is 0.8), times a per-level knob, times 1.3 if it's a chick. Five independent influences, one multiplication.

Two thresholds turn the number into behaviour:

```javascript
hungerThreshold: 35,    // above this: go and look for food
criticalHunger: 80,     // above this: desperate
```

And at the top, death:

```javascript
if (this.hunger >= this.maxHunger) {
  if (simulation.isSpeciesProtected(this.speciesKey)) {
    this.hunger = this.maxHunger * 0.9;
  } else {
    this.alive = false;
    this.causeOfDeath = 'starved';
  }
}
```

A moa dies by having its `alive` flag set to false. Nothing else happens at that moment. It stops being updated and drawn, the spatial grid leaves it out next frame, and some seconds later `cleanup()` removes it from the list. (The `isSpeciesProtected` branch is a safety net some levels use to keep the last few of a species from vanishing; Chapter 12 covers it.)

## Sense, Decide, Act

Every frame, `behave` runs the same pipeline. I'll give the outline first, then each stage.

```javascript
behave(simulation, mauri, seasonManager, dt = 1) {
  if (this.lifeScript) { this.lifeScript.behave(simulation, mauri, seasonManager, dt); return; }

  // 1. BODY: age, hunger, cooldowns
  this.updateAge(dt);
  this._updateSeasonCache(seasonManager);
  this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);
  // ...

  // 2. SENSE: what's near me?
  const placeables = simulation.getNearbyPlaceables(px, py, 80);
  const eagles = simulation.getNearbyEagles(px, py, this.fleeRadius * 1.5);
  const moas = simulation.getNearbyMoas(px, py, 100);
  this._cacheThreateningEagles(eagles);
  this.applyPlaceableEffects(placeables, dt);

  // 3. DECIDE: what should I be doing?
  this.currentState = this.determineState(placeables, sc, moas);

  // 4. ACT: turn that into forces
  this.executeState(simulation, mauri, sc, moas, placeables, dt);

  // 5. ALWAYS: things that apply whatever I'm doing
  this.applySeparation(moas);
  const avoid = this.avoidUnwalkable(); avoid.mult(2); this.applyForce(avoid);
  this.edges();
  this.updateSecurity(eagles, dt);
  // ... starvation check, slope slowdown ...
}
```

**Sense, decide, act** is the oldest structure in artificial intelligence, and it's a good way to organise any creature. Each stage has one job. Sensing gathers facts. Deciding picks a single intention from the facts. Acting carries out that intention. When a moa does something strange, you can ask which stage went wrong: did it not see the plant, did it choose not to go to it, or did it choose to go and fail to get there?

The first line is an escape hatch. If a moa has a `lifeScript` attached, the script takes over and none of this runs. That's how the story levels direct particular birds (Chapter 14). For every other moa, read on.

### Sensing

Three queries to three spatial grids, as you saw in Chapter 3. The radii are the moa's senses: it notices other moa within 100 units, eagles within one and a half times its flee radius, and the player's items within 80.

That limit is a design choice with real consequences. A moa can starve 150 units from a grove of food, because as far as it knows the grove doesn't exist. Perception radii are among the first things to look at when animals seem stupid, and among the most tempting to raise. Raise them too far and the animals become all-knowing, every moa on the map converges on the best plant, and the interesting local behaviour disappears. Reynolds's point that limited perception makes a simulation feel natural is truer the longer you work with one.

One sense is throttled:

```javascript
this.foodCheckTimer += dt;
if (this.foodCheckTimer >= 60) {
  this.foodCheckTimer -= 60;
  const plants = simulation.getNearbyPlants(this.pos.x, this.pos.y, 60);
  let edible = 0;
  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];
    if (!p.alive || p.matured) continue;
    if (!p.dormant && p.growth > 0.5 && edible < 8) edible++;
  }
  this.localFoodScore = edible * 0.125;
}
```

Once a second, the moa counts the edible plants within 60 units, up to 8, and stores the result as a number from 0 to 1. `localFoodScore` is the moa's impression of how good the eating is around here. It doesn't need updating sixty times a second, and several decisions below use it.

This is a general technique: **summarise the neighbourhood into one number, occasionally, and decide on the summary**. It's cheaper than re-examining every plant each frame, and it gives the animal a stable opinion instead of one that flickers.

## The State Machine

In Chapter 1 the game had a state: menu, playing, paused. A moa has one too.

```javascript
const MOA_STATE = {
  IDLE: 'idle',
  FORAGING: 'foraging',
  FLEEING: 'fleeing',
  MIGRATING: 'migrating',
  FEEDING: 'feeding',
  SEEKING_MATE: 'seeking_mate',
  MATING: 'mating'
};
```

At every moment a moa is in exactly one of these. The state is the answer to "what is it trying to do?". The alternative to a state machine is to apply all the forces all the time, weighted: a little seek-food, a little flee, a little seek-mate. For simple flocking that works. For an animal with needs it makes mush: a moa that is half fleeing and half grazing does neither. Pick one thing and commit to it.

There are two common ways to write the "which state?" logic. One is a table of transitions: from IDLE you can go to FORAGING if hungry, from FORAGING to FLEEING if an eagle appears, and so on, a rule for every pair. That grows quickly. Seven states have forty-two possible transitions.

The game does it the other way: a **priority cascade**. Every frame, forget what state you were in and ask a list of questions in order of importance. The first one that says yes wins.

```javascript
determineState(placeables, seasonCache, moas) {
  // 1. Is something trying to eat me?
  if (this._threateningEagles.length > 0) {
    this.targetMate = null;
    return MOA_STATE.FLEEING;
  }

  // 2. Am I in the middle of mating?
  if (this.matingTimer > 0 || this.matingPartner) return MOA_STATE.MATING;

  // 3. Is there a mate to pursue? (Chapter 8)
  // ... three checks that can return SEEKING_MATE ...

  // 4. Am I standing on food, eating?
  if (this.isFeeding) return MOA_STATE.FEEDING;

  // 5. Am I hungry, with food about?
  if (_hungry && (this.hunger > this.criticalHunger || this.localFoodScore >= 0.3)) {
    return MOA_STATE.FORAGING;
  }

  // 6. Am I in the wrong place for the season?
  if (this.isMigrating || this.shouldMigrate(seasonCache)) return MOA_STATE.MIGRATING;

  // 7. Hungry, with little food about: forage anyway.
  if (_hungry) return MOA_STATE.FORAGING;

  // 8. Is the player's food calling?
  for (let i = 0; i < placeables.length; i++) {
    if (placeables[i].alive && placeables[i].getAttractionStrength(this) > 0) return MOA_STATE.FORAGING;
  }

  // 9. Nothing to do.
  return MOA_STATE.IDLE;
}
```

Read it top to bottom and you have the moa's character. Staying alive beats everything. Mating, once begun, isn't interrupted by hunger. A fed and settled moa looks for a mate. A hungry moa eats. A comfortable moa in the wrong country moves. A moa with no needs ambles about.

The order of the `if`s **is** the design. To change what moa care about most, move a block. If you want hungry moa to ignore eagles until the last moment, you'd put a hunger test above the flee test. The game's order is the result of a lot of trial, and a few of the entries have comments recording why they're where they are:

```javascript
// Actively eating at a placeable: stay on the food (ranks above MIGRATING so a
// seasonal shift doesn't pull moa off feeders mid-meal).
if (this.isFeeding) return MOA_STATE.FEEDING;
```

and

```javascript
// Food outranks migration when urgent or available: a starving moa always eats first;
// a merely-hungry one eats first unless local food is scarce (then migrating finds food).
```

That second one is why hunger appears twice, at 5 and at 7. A hungry moa with food nearby should eat. A hungry moa with *no* food nearby should migrate, because walking to better country is how it finds food. Only if migration has nothing to offer does it fall through to foraging on scraps. It's a small piece of real animal sense, expressed as the position of an `if`.

### The deadband

Here is the line that computes `_hungry`:

```javascript
const _wasForaging = this.currentState === MOA_STATE.FORAGING || this.currentState === MOA_STATE.FEEDING;
const _forageExit = Math.max(this.hungerThreshold - 10, 5);
const _hungry = this.hunger > (_wasForaging ? _forageExit : this.hungerThreshold);
```

Why not `this.hunger > this.hungerThreshold`?

Think about a moa with hunger 36. It's above 35, so it forages. It takes one bite of tussock and drops to 11. Fine. But suppose the bite was small and it drops to 34. It's below 35, so it stops foraging and goes idle. Two seconds later hunger is 36 again: forage. One bite: 34, idle. The moa twitches between two states for the rest of its life, never getting properly fed.

The cure is the two-threshold trick from the end of Chapter 2, **hysteresis**. A moa *starts* foraging when hunger passes 35. Once it's foraging, it *keeps* foraging until hunger falls below 25. The gap between the two is called a **deadband**. Inside it, the moa carries on doing whatever it was already doing.

This is the one place where the priority cascade needs to remember the previous state, and it's a pattern to reach for any time a creature dithers on a boundary: make the threshold for stopping different from the threshold for starting.

### Exercise 7.1

Write a sketch with one creature that has `energy` draining over time and a food dish. It has two states, `RESTING` and `EATING`. First use one threshold: eat when energy is below 50. Print each state change to the console. Then use two: start eating below 40, stop above 80. Count the state changes per minute each way.

## Acting

`executeState` is a `switch`. Each case sets the top speed for that mood and applies its forces.

```javascript
executeState(simulation, mauri, seasonCache, moas, placeables, dt) {
  this.panicLevel = 0;
  const starving = this.hunger > this.criticalHunger;
  const speedMod = starving ? 0.6 : 1;

  switch (this.currentState) {
    case MOA_STATE.FLEEING:
      this.maxSpeed = this.fleeSpeed * speedMod;
      for (let i = 0; i < this._threateningEagles.length; i++) {
        const { eagle, distSq } = this._threateningEagles[i];
        const flee = this.fleeFrom(eagle.pos.x, eagle.pos.y);
        flee.mult(2.5 * this.flightiness);
        this.applyForce(flee);
        this.panicLevel = Math.max(this.panicLevel, 1 - Math.sqrt(distSq) / this.fleeRadius);
      }
      break;

    case MOA_STATE.FORAGING:
      this.maxSpeed = this.baseSpeed * speedMod;
      if (this.hunger > this.criticalHunger) this.forage(simulation, mauri);
      else if (!this.seekAttractions(placeables)) this.forage(simulation, mauri);
      break;

    // ... MIGRATING, SEEKING_MATE, FEEDING ...

    default: // IDLE
      this.maxSpeed = this.baseSpeed;
      this.targetPlant = null;
      if (!this.seekAttractions(placeables)) {
        const w = this.wander(); w.mult(0.4); this.applyForce(w);
        this.applyForce(this.stayInHomeRange());
      }
  }
}
```

Each state changes `maxSpeed`. A fleeing moa is allowed `fleeSpeed`; a grazing one `baseSpeed`; a feeding one 70% of that. Because of the speed easing in `Boid.update`, the change of pace takes a few frames to come through, which looks like the animal gathering itself.

Notice `speedMod`: a starving moa moves at 60% speed, even when fleeing. Hunger makes it slow, slowness makes it easier to catch and worse at reaching food. That's a deliberate downward spiral, and it gives the player's interventions their urgency: a herd left hungry isn't merely unhappy, it's defenceless.

The flee case loops over the eagles it's afraid of and applies a flee force from each. If two eagles close from different sides, the forces add, and the moa runs along the line between them. Addition of forces from Chapter 2 does the work; nobody wrote a rule about two eagles.

There is one rule, though, for the edge of the land. A moa running straight away from an eagle that comes at it from the middle of the map runs straight into the edge, and there `Boid.edges` shoves it back in, hard. The two forces cancel, and the bird stands pinned while the eagle closes. So `fleeFrom` looks at each edge the run is heading into. From 60 units out to 25 units out it turns more and more of the into-the-edge part of the run *along* the edge instead, the way that still leads away from the eagle. The bird slides out along the edge the way a cornered animal does. It's the same vector, broken into two components (Chapter 2) and with one of them rotated.

`_threateningEagles` was filled in during sensing. An eagle counts as a threat only if it's actively hunting and inside the flee radius. A resting eagle perched nearby doesn't scare anyone. This list is computed once and used by both `determineState` and `executeState`, so the two stages can't disagree about what's frightening.

## Choosing What to Eat

A foraging moa has to pick a plant. There may be twenty in range. Which one?

The naive answer is "the nearest". But the nearest might be nearly eaten, or dormant, or a favoured plant of another species. The richest might be far away. This is a choice among options that differ in several ways at once, and the standard tool for that is a **scoring function**: boil each option down to a single number, then pick the best number.

Here is `findPlant`, with the level-specific lines trimmed:

```javascript
findPlant(simulation) {
  const _range = (this.hunger > this.criticalHunger ? 150 : 100) * this.foragingBonus;
  const plants = simulation.getNearbyPlants(this.pos.x, this.pos.y, _range);
  let best = null, bestScore = Infinity;

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i];

    // FILTER: things that aren't options at all.
    if (!p.alive || p.growth < 0.5) continue;
    if (p.unsprouted || !(p.nutrition > 0)) continue;
    if (this._unreachable && this._unreachable.get(p) > frameCount) continue;
    if (p.winterInedible) continue;
    if (p.matured) continue;
    if (p.seasonalModifier < 0.3 && this.hunger < 70) continue;

    // SCORE: lower is better.
    const dx = p.pos.x - this.pos.x, dy = p.pos.y - this.pos.y;
    let score;
    if (this.hunger > this.criticalHunger) {
      score = Math.sqrt(dx * dx + dy * dy) / this.foragingBonus / Math.min(1, p.nutrition / 15);
    } else {
      score = Math.sqrt(dx * dx + dy * dy) / this.foragingBonus / p.seasonalModifier / (p.nutrition * 0.033);
    }

    // ADJUST: preferences.
    const hx = this.homeRange.x - p.pos.x, hy = this.homeRange.y - p.pos.y;
    if (hx * hx + hy * hy < this.homeRangeRadiusSq) score *= 0.7;
    if (p.isSpawned) score *= 0.45;
    if (p.favouredSpecies) {
      if (p.favouredSpecies === this.speciesKey) score *= 0.6;
      else score *= 4.0;
    }

    if (score < bestScore) { bestScore = score; best = p; }
  }
  return best;
}
```

It has the same three parts as almost every scoring function you'll write.

**Filter.** Some candidates aren't worth scoring. Each `continue` throws one out: eaten, too small, nothing on it, given up on, frozen. Filters are cheap and should come first.

**Score.** The basic score is distance divided by how good the plant is. Think of it as "effort per unit of food". A rimu (nutrition 50) at 60 units scores about 36. A tussock (25) at 40 units scores about 48. The moa walks past the tussock to the rimu, because it's the better deal. Lower is better, so the loop starts `bestScore` at `Infinity` and keeps whatever beats it. This "world record" loop is the standard way to find a minimum.

**Adjust.** Then preferences multiply the score. Being inside the moa's home range makes a plant look 30% closer. Being planted by the player makes it look less than half as far. Being this species' favoured plant, 40% closer. Being another species' favoured plant, four times as far.

Each of those multipliers is a design statement, and they're easy to read and easy to change. "Moa should care more about food the player grows" is one number, 0.45. The devblog in the repository explains the ecology behind the favoured-plant numbers; the mechanism is right here.

### When starving, think differently

Look at the two score formulas. A moa that isn't starving weighs distance against nutrition and season. A starving one uses a different rule: nearest, as long as it's a real meal.

The comment in the source tells the story:

```javascript
// Starving: the nearest plant that is a real meal, not the richest one in range. Weighing
// distance against nutrition sends a starving bird past the tussock at its feet toward a
// beech a hundred units off, up a slope, and it dies on the way.
```

That was a bug found by watching one moa die. The scoring function was doing its job, optimising effort per unit of food, and the optimum killed the bird, because the formula has no idea how long the bird has left. The fix wasn't to tune the weights. It was to recognise that a starving animal has a different goal, and give it a different function.

Scoring functions always encode a goal. When behaviour is wrong in a particular situation, ask whether the situation has a different goal before you start nudging multipliers.

### Exercise 7.2

In a sketch, scatter 40 food items with random `value` from 1 to 10, shown by size. Give a creature a `pick()` function that chooses by (a) nearest, (b) highest value, (c) `distance / value`. Draw a line from the creature to its choice and move the creature with the mouse. Which rule would you want if you were tired?

## Getting There, and Eating

`forage` turns the choice into movement:

```javascript
forage(simulation, mauri) {
  if (!this.targetPlant?.alive || this.targetPlant.growth < 0.5) {
    if (frameCount >= this._nextForageSearch) {
      this.targetPlant = this.findPlant(simulation);
      this._nextForageSearch = this.targetPlant ? 0 : frameCount + 20;
    }
  }

  if (this.targetPlant) {
    const dx = this.targetPlant.pos.x - this.pos.x, dy = this.targetPlant.pos.y - this.pos.y;
    const dSq = dx * dx + dy * dy;

    if (dSq < this.eatRadiusSq) {
      let gain = this.targetPlant.consume();
      // ... competition and favoured-plant adjustments to gain ...
      this.hunger = Math.max(0, this.hunger - gain);
      mauri.earnFromEating(mauri.onMoaEat, this.pos.x, this.pos.y);
      this.targetPlant = null;
      this.vel.mult(0.3);
    } else {
      // ... progress watchdog (below) ...
      this.applyForce(this.seek(this.targetPlant.pos,
        map(this.hunger, this.hungerThreshold, this.maxHunger, 0.5, 0.9), 10));
    }
  } else {
    const w = this.wander(); w.mult(0.6); this.applyForce(w);
  }
}
```

Three things to see.

**The moa keeps its target.** It doesn't call `findPlant` every frame. It picks a plant and holds onto it in `this.targetPlant` until the plant is gone or eaten. This is **commitment**, and it matters for the same reason states do: a moa that re-chose every frame would be swayed by every small change in distance and would zig-zag. `?.` is **optional chaining**: `this.targetPlant?.alive` is `undefined`, without an error, if `targetPlant` is null.

**A failed search backs off.** If `findPlant` returns nothing, the moa won't search again for 20 frames. With no food in range, searching every frame would be the most expensive way of achieving nothing.

**Urgency follows hunger.** The seek's urgency is `map(hunger, 35, 100, 0.5, 0.9)`. p5's `map` rescales a number from one range to another: hunger 35 gives 0.5, hunger 100 gives 0.9. A peckish moa strolls toward lunch; a desperate one strides. `map` is `lerp` with the normalising step built in, and it is the quickest way to make one quantity drive another.

Eating itself is one line: `this.hunger = Math.max(0, this.hunger - gain)`. The plant gives up its nutrition and the moa's hunger falls by that much.

## Giving Up

Now the part of the moa's mind that took longest to get right, and the lesson I'd most want you to carry into your own work.

An animal picks a target and steers toward it. What if it can't get there? The plant is across a band of scree. The moa walks at the scree, `avoidUnwalkable` turns it aside, `seek` turns it back, and it paces the edge of the rock, pulled toward food it can never reach, until it starves. All its logic is working correctly. It dies anyway.

The game's log of mistakes records this, more than once, and states the rule that came out of it:

> **Anything a bird walks at must be checked for progress, and dropped when there is none.**

Here is the check, from the middle of `forage`:

```javascript
if (this._tgtPlant !== this.targetPlant) {
  // A new target: start watching.
  this._tgtPlant = this.targetPlant; this._tgtBest = dSq; this._tgtStall = 0;
}
else if (dSq < this._tgtBest - 16) {
  // Got meaningfully closer: reset the clock.
  this._tgtBest = dSq; this._tgtStall = 0;
}
else if (++this._tgtStall > 240) {
  // Four seconds with no progress: give up on this plant for twenty.
  const bad = this._unreachable || (this._unreachable = new Map());
  bad.set(this.targetPlant, frameCount + 1200);
  this.targetPlant = null;
  this._tgtPlant = null;
  this._nextForageSearch = 0;
  return;
}
```

This is a **watchdog**. It doesn't try to understand why the moa is stuck. It only measures: is the distance to the target getting smaller? It remembers the best (smallest) distance so far. Each frame that the moa beats that record by a clear margin, the stall counter resets. Each frame it doesn't, the counter ticks up. After 240 frames without progress, the moa abandons the plant and puts it on a personal blacklist for 1,200 frames. `findPlant`'s filter skips blacklisted plants, so the next search picks something else.

The blacklist is a `Map`, a collection of key-value pairs where the key can be any object. Here each key is a plant and each value is the frame number at which the moa will consider it again.

The beauty of a watchdog is that it's general. It doesn't matter whether the obstacle is rock, water, a crowd of other moa or a bug in the steering. No progress, give up, try something else. The same structure guards the pull of the player's food patches in `seekAttractions` (`_attrStall`), and story-level moa have a more elaborate version that plans a detour.

Any time you write "go to X", write "and if that isn't working, stop" beside it. It is the difference between an animal that looks alive and one that looks broken.

### Exercise 7.3

Take a boid with `seek` and `avoidUnwalkable` from Chapter 2. Put its target behind a long wall. Watch it get stuck. Now add a watchdog: track the best distance achieved, count frames without improvement, and after three seconds pick a new random target. Draw the stall counter above its head.

## Home, and the Urge to Move

Two more forces shape where moa spend their time.

### Home range

Each moa has a `homeRange`, a point, and a radius of 50 to 90 units around it. When idle and outside that circle, it feels a gentle pull back:

```javascript
stayInHomeRange() {
  const dx = this.homeRange.x - this.pos.x, dy = this.homeRange.y - this.pos.y;
  const dSq = dx * dx + dy * dy;
  const f = this._homeForce;

  if (dSq > this.homeRangeRadiusSq) {
    f.set(dx, dy);
    f.setMag(this.maxForce * 0.12);
    f.mult(1 + (Math.sqrt(dSq) - this.homeRangeRadius) * 0.02);
  } else {
    f.set(0, 0);
  }
  return f;
}
```

Inside the circle: nothing. Outside: a pull toward the centre that grows the further out it goes, like a soft elastic leash. It's weak, 12% of the moa's turning force at the edge, so any real need overrides it. But an idle moa with no other pulls will drift home.

Home is not fixed. A moa that lays an egg resets its home to that spot. A moa that finishes a migration sets its home to where it arrived. So "home" is "the last place I settled", and the herd's territory moves with its life.

Without a home range, wandering moa slowly spread across the whole map like a gas filling a room. With it, they form loose local groups that stay put between seasons. That clumping is what makes it possible for the player to look after them.

### Migration

In Chapter 5 the season published a preferred elevation band. Here is where a moa reads it. Each frame it blends the season's band with its own species' band, half and half:

```javascript
const sp = sm.getPreferredElevation();
const pp = this.speciesConfig.preferredElevation || sp;
c.preferredElevation.min = (pp.min + sp.min) * 0.5;
c.preferredElevation.max = (pp.max + sp.max) * 0.5;
```

So an upland moa (species band 0.35 to 0.70) in winter (season band 0.18 to 0.42) wants to be between about 0.27 and 0.56. A lowland giant moa in the same winter wants 0.17 to 0.41. Same season, different animals, different answers. Averaging two ranges is the simplest possible way to combine "what the weather wants" with "what I am".

`shouldMigrate` asks whether the moa is unhappy where it is:

```javascript
const elev = this.terrain.getElevationAt(this.pos.x, this.pos.y);
const p = this.preferredElevation;
const err = elev < p.min ? p.min - elev : (elev > p.max ? elev - p.max : 0);

return err > 0.08 ||
       (this.localFoodScore < 0.3 && this.hunger > 30) ||
       (err > 0.03 && sc.migrationStrength > 0.7);
```

`err` is how far outside its preferred band the moa stands: zero inside, growing with distance outside. The moa migrates if it's well outside the band, or it's hungry and the local food is poor, or it's a little outside and the season is pushing hard.

Then it needs somewhere to go. This is a different kind of search from `findPlant`, because the candidates aren't objects in a list. They're places, and there are infinitely many. The game's answer is to try a handful at random and keep the best:

```javascript
findMigrationTarget(simulation) {
  const target = (this.preferredElevation.min + this.preferredElevation.max) * 0.5;
  const current = this.terrain.getElevationAt(this.pos.x, this.pos.y);
  let bestX = 0, bestY = 0, bestScore = -Infinity, found = false;

  for (let i = 0; i < 20; i++) {
    const angle = random(TWO_PI), dist = random(50, 150);
    const x = constrain(this.pos.x + cos(angle) * dist, 20, mapW);
    const y = constrain(this.pos.y + sin(angle) * dist, 20, mapH);

    if (!this.terrain.isWalkable(x, y)) continue;

    const elev = this.terrain.getElevationAt(x, y);
    let score = 1 - abs(elev - target) * 5;
    if (elev >= this.preferredElevation.min && elev <= this.preferredElevation.max) score += 0.5;
    if ((current < target && elev > current) || (current > target && elev < current)) score += 0.3;

    if (score > bestScore) { bestScore = score; bestX = x; bestY = y; found = true; }
  }
  // ...
}
```

Twenty random points in a ring between 50 and 150 units away. `cos(angle) * dist, sin(angle) * dist` is the angle-to-arrow conversion from Chapter 2, giving a point at that angle and distance. Each walkable candidate is scored: closer to the ideal elevation is better, inside the band earns a bonus, and moving in the right direction (uphill if it needs to go up) earns another. This time higher is better, so the search starts at `-Infinity`.

This is **random sampling**: when you can't examine every option, examine a random few. It will not find the best spot on the map. It finds a decent spot nearby, cheaply, and it finds a different one for each moa, so a migrating herd fans out across a hillside instead of marching to one pixel.

A migration is a sequence of hops. The moa walks to its target, sets its home there, rests for 300 frames (`migrationCooldown`), and if it's still unhappy, picks another. Over a season this carries a herd from the tussock tops down to the forest and back. No route is planned. Each moa takes a few dozen small steps downhill because each step looked better than staying.

## Separation, Revisited

In Chapter 2 separation was a single force. In the moa it's weighted by what the moa is doing:

```javascript
let mult = isMating ? 0.2 :
  (this.currentState === MOA_STATE.FLEEING ? 0.5 * this.flockTendency : 0.8 * (2 - this.flockTendency));

if (!isMating && this.currentState !== MOA_STATE.FLEEING && this.hunger > this.hungerThreshold) {
  const span = Math.max(1, this.criticalHunger - this.hungerThreshold);
  mult *= Math.max(0.3, 1 - 0.7 * (this.hunger - this.hungerThreshold) / span);
}
f.mult(mult);
```

Mating moa barely separate: they need to get close. Fleeing moa separate less, so a herd bunches as it runs. And the hungrier a moa is, the less it minds being crowded.

The comment on that last block is one of my favourites in the codebase:

```javascript
// A hungry bird crowds in: the hungrier it is, the nearer it will stand to a neighbour to
// reach food. At full strength this push is stronger than the pull toward a plant, so a
// chick would hover at arm's length from a parent feeding on a patch, held off the food
// by the parent's elbow, and starve there.
```

Two forces, each sensible alone, added together to starve a chick. Separation said "keep away from that moa". Seek said "go to that plant". The plant was under the moa. The forces balanced at a point just short of the food.

When forces sum, they can also cancel, and an animal standing still at the balance point looks exactly like an animal with no ideas. If a creature freezes for no visible reason, suspect two forces in deadlock, and make one of them yield as the need behind the other grows.

## The Season Cache

One implementation detail before the summary. At the top of `behave`:

```javascript
this._updateSeasonCache(seasonManager);
const sc = this._seasonCache;
```

and then `sc.hungerMod`, `sc.winterness`, `sc.migrationStrength`, `sc.preferredElevation` are used all through the frame. The moa asks the season manager its questions once, stores the answers in an object of its own, and reads from that. `SeasonManager.getPreferredElevation` returns a shared scratch object (Chapter 5), so copying the values out straight away is also the safe thing to do.

It's a small case of a good habit: **gather what you need at the top of a function, then work from local copies**. The function reads more clearly, runs a little faster, and can't be confused by a value changing halfway through.

## Summary

- A drive is a number that grows with time and that the animal acts to reduce. For a moa it's hunger, 0 (full) to 100 (dead).
- `behave` runs sense → decide → act, plus forces that always apply.
- Senses are radius-limited queries. `localFoodScore` summarises nearby food once a second.
- The state machine is a priority cascade: ask questions in order of importance, take the first yes. The order is the design.
- A deadband (start foraging above 35, stop below 25) prevents dithering.
- `executeState` sets the speed for the mood and applies that state's forces.
- `findPlant` is a scoring function: filter, score (distance per unit of food), adjust by preference, keep the best. A starving moa uses a different score.
- A moa commits to a target, and a watchdog drops any target it isn't getting closer to.
- A home range is a soft leash that keeps moa in local groups.
- Migration averages the season's elevation band with the species', then samples 20 random nearby spots and walks to the best. Repeated hops carry the herd.
- Forces can deadlock. Weight them by need.

## The Mauri Project

Watch one moa think, then change its mind.

1. Add a lens, `id: 'moaMind'`. In `drawWorld`, for every living moa, draw its `currentState` as small text above it (`textSize(5 / z * 2)` or thereabouts), and a line to its `targetPlant` if it has one. Colour the text by state. Also draw its home range as a faint circle (`homeRange`, `homeRangeRadius`).
2. Follow one moa through a minute of play. Write down the sequence of states it goes through. Find a moment where it changes state and explain it from `determineState`.
3. Find the deadband in `determineState` and change `_forageExit` to equal `this.hungerThreshold` (no deadband). With your lens on, watch for dithering. Put it back.
4. In `findPlant`, change the player-planted multiplier from `0.45` to `0.05`, then to `1.0`. What does each do to how the player's tools feel?
5. Give moa a new state. Add `RESTING: 'resting'` to `MOA_STATE`. In `determineState`, just above the final `return MOA_STATE.IDLE`, return `RESTING` if hunger is below 15 and `this.securityTime > 300`. In `executeState`, add a case that sets `maxSpeed` to `baseSpeed * 0.1` and multiplies `this.vel` by `0.9`. Well-fed, safe moa should now settle down. Does this change how often they breed (Chapter 8)? Why might it?
6. Stretch: the watchdog blacklists a plant for 1,200 frames. Use your lens to draw a red cross on each plant in a moa's `_unreachable` map. Find a level and a spot where moa blacklist plants often. What's in the way?
