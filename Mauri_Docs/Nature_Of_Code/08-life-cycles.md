# Chapter 8: Life Cycles

> Ka ngaro i te ngaro o te moa.
>
> Lost, as the moa is lost.
> — whakataukī

*Builds on Chapter 7.*

A particle system in a p5.js sketch has a simple idea of population. Particles are created by an emitter at a steady rate, each has a lifespan, and when the lifespan runs out the particle is removed. The number on screen settles at "rate times lifespan" and stays there. You, the programmer, chose it.

Mauri's animals are not like that, and the difference is what this chapter is about. Nobody chooses how many moa there are. Moa are born when two other moa, fed and unafraid, find each other. They die when they starve or are caught. The count at any moment is the running total of thousands of small events, and it goes up, crashes, recovers or dies out for reasons you can trace but can't dictate.

That is a **population**, in the ecologist's sense, and building one that doesn't either explode or vanish is one of the harder problems in simulation. This chapter walks through how moa reproduce, in `mauri_moa.js`, `mauri_egg.js` and `Simulation.updateEggs`, and then through the handful of mechanisms that keep the numbers within bounds.

## Growing Up

A moa is born small and gets bigger. Its `age` counts up in frames, and two thresholds divide its life into three stages.

```javascript
const MOA_AGE = {
  JUVENILE_MAX: 600,
  ADULT_MIN: 900,
  MATING_AGE: 900,
  SIZE_JUVENILE: 0.6,
  SIZE_ADOLESCENT: 0.9,
  SIZE_ADULT: 1.0
};
```

For its first 600 frames (ten seconds) it's a juvenile, drawn at 60% size rising to 90%. From 600 to 900 it's an adolescent, growing the rest of the way. After 900 it's an adult and may breed.

```javascript
if (this.age >= MOA_AGE.ADULT_MIN) {
  this.ageStage = 'adult';
  sizeMult = this.isFemale ? MOA_AGE.SIZE_ADULT : MOA_AGE.SIZE_ADULT * maleMult;
} else if (this.age >= MOA_AGE.JUVENILE_MAX) {
  this.ageStage = 'adolescent';
  sizeMult = lerp(MOA_AGE.SIZE_ADOLESCENT, adultSize,
    (this.age - MOA_AGE.JUVENILE_MAX) / (MOA_AGE.ADULT_MIN - MOA_AGE.JUVENILE_MAX));
} else {
  this.ageStage = 'juvenile';
  sizeMult = lerp(MOA_AGE.SIZE_JUVENILE, MOA_AGE.SIZE_ADOLESCENT, this.age / MOA_AGE.JUVENILE_MAX);
}
```

Each growing branch is a `lerp` with a normalised age as its `t`. In the juvenile branch, `this.age / 600` runs from 0 to 1 as the chick ages, so size runs from 0.6 to 0.9. In the adolescent branch the expression `(age - 600) / (900 - 600)` does the same job for a range that doesn't start at zero. That second form, `(value - start) / (end - start)`, is how you normalise any range, and it's exactly what p5's `map()` does inside.

Notice that adult females are larger than males (`maleMult` is 0.9). Moa hens really were the bigger sex, in some species by a great deal. It's one line here, and it means you can tell the sexes apart on screen once you know to look.

Juveniles aren't just smaller. In Chapter 7, the hunger rate had a factor of 1.3 for them. A chick gets hungry faster than its parents, and that makes the weeks after a hatching the most dangerous in a moa's life.

Moa in this game don't die of old age. Starvation and eagles are the only ways out. That's a simplification you could change, and the Mauri Project at the end of this chapter asks you to try.

## Ready to Breed

Not every adult breeds. A moa has to pass a list of conditions:

```javascript
isReadyToMate() {
  const ready = this.canMate && this.mateCooldown <= 0 && this.canMateByAge() &&
    !this.isPregnant && !this.matingPartner &&
    this.hunger < this.matingHungerThreshold &&
    this.securityTime >= this.securityTimeRequired * 0.5;
  if (!ready) return false;
  // ...
  return true;
}
```

Old enough. Not on cooldown from the last egg. Not already pregnant or busy. **Not hungry**: hunger below 40. And **secure**: it has built up enough `securityTime`.

Those last two are the heart of the game's design, so I'll take them slowly.

### Fed

Breeding only happens below a hunger threshold. So the rate at which a population grows is tied to how well it's eating. In a good season with plenty of plants, most moa are below the line most of the time, and they breed. In winter, or on overgrazed land, most are above it, and breeding stops by itself.

Nobody wrote "moa breed in spring". They breed when they're fed, and spring is when there's food. If the player plants a grove in winter, the moa near it are fed, and they'll breed in winter.

This is a **feedback loop**, and it's the first of several you'll meet. More food leads to more moa. More moa eat more food. Less food leads to fewer births. The population is pulled toward what the land can support, without any code that knows what that number is.

### Secure

The second condition is the one that makes the player matter.

```javascript
updateSecurity(eagles, dt) {
  const safeDist = this.fleeRadiusSq * 0.64;
  let nearest = Infinity;

  for (let i = 0; i < eagles.length; i++) {
    const dx = eagles[i].pos.x - this.pos.x, dy = eagles[i].pos.y - this.pos.y;
    nearest = Math.min(nearest, dx * dx + dy * dy);
  }

  if (nearest > safeDist) this.securityTime += this.securityBonus * dt;
  else this.securityTime = Math.max(0, this.securityTime - dt * 2);
}
```

`securityTime` is a meter. Every frame with no eagle close by, it fills. Every frame with one close, it drains, twice as fast as it fills. A moa can only breed once the meter is at least half of its required level, and that level is set per moa when it's created: a base figure plus a random amount, typically 550 to 850 frames for an upland moa.

Think about what this does. An eagle doesn't have to catch a moa to hurt the herd. By merely circling, it empties every nearby moa's meter and breeding stops. Predators suppress their prey by fear as well as by killing, an effect ecologists call the "landscape of fear", and here it is as an accumulator and a subtraction.

It's also why the shelter and the storm are worth buying. `securityBonus` is normally 1. Standing in a fern shelter makes it 4: the meter fills four times as fast. The player isn't handed a "make moa breed" button. They're handed ways to make moa feel safe, and breeding follows.

Each moa's requirement includes a random part. If every moa needed exactly 800 frames of peace, a herd left alone would all become ready on the same frame, all lay together, and all hatch together. A spread of thresholds staggers them. Whenever a group of things share a timer, give each a little random offset, or they'll move in lockstep.

### Exercise 8.1

In a sketch, make 20 dots, each with a `calm` meter that rises by 1 per frame and a random `needed` between 200 and 400. Make the mouse a predator: any dot within 100 pixels loses 2 `calm` per frame. Colour a dot green when `calm >= needed`. Sweep the mouse through occasionally. How rarely do you need to pass by to keep the whole group from ever turning green?

## Finding a Mate

A ready moa looks through its neighbours for a partner. This is another scoring function, with a twist:

```javascript
findPotentialMate(moas) {
  // Two buckets: any same-species mate beats a cross-species one.
  let best = null, bestScore = Infinity;            // same species
  let bestCross = null, bestCrossScore = Infinity;  // other species
  const _mateR = this.effectiveMatingRadius();
  const maxDistSq = _mateR * _mateR;

  for (let i = 0; i < moas.length; i++) {
    const o = moas[i];
    if (o === this || !o.canBeMate()) continue;
    if (o.isFemale === this.isFemale) continue;       // must be opposite sex
    if (o.matingPartner && o.matingPartner !== this) continue;

    const dx = o.pos.x - px, dy = o.pos.y - py;
    const distSq = dx * dx + dy * dy;
    if (distSq > maxDistSq) continue;
    if (!this._sameLand(o)) continue;

    let score = distSq;
    if (o.targetMate === this) score *= 0.1;          // they're already coming to me
    else if (o.currentState === MOA_STATE.SEEKING_MATE && !o.targetMate) score *= 0.5;
    else if (o.isReadyToMate()) score *= 0.7;
    else if (o.currentState === MOA_STATE.FORAGING) score *= 1.5;   // busy eating

    if (o.speciesKey === this.speciesKey) {
      if (score < bestScore) { bestScore = score; best = o; }
    } else {
      const cs = score * this.mateCrossPenalty;
      if (cs < bestCrossScore) { bestCrossScore = cs; bestCross = o; }
    }
  }

  if (best) return best;
  if (this._noSpeciation) return null;
  return bestCross;
}
```

Filter, score, adjust, as in Chapter 7. The filters: opposite sex, available, in range, and on the same connected stretch of land (`_sameLand` uses the flood-fill regions from Chapter 4, so a moa never courts one on the far side of an impassable ridge).

The score is squared distance, lowered for a candidate who is already interested and raised for one who is busy eating. A moa that is being courted favours its suitor ten to one. That mutual preference is what lets two moa converge on each other instead of each chasing someone else.

The twist is the **two buckets**. Instead of one "best so far", the function tracks the best same-species candidate and the best other-species candidate separately, and at the end takes the same-species one if there is any at all. Only if there is nobody of its own kind does it settle for a cross.

Why not simply multiply the cross-species score by a big penalty and keep one list? Because a penalty can always be overcome by a large enough difference in the other factors: a cross-species moa standing right beside you could still beat a same-species moa far away. Two buckets make the preference **absolute**. When one criterion must always win over another, don't try to do it with weights. Sort into tiers first, then score within the tier.

### Courtship

Having chosen, the moa enters `SEEKING_MATE` and walks toward its target. The target is also a moa, and it's moving. If you seek the place where a moving thing *is*, you arrive where it *was*. So `seekMate` aims ahead:

```javascript
const dist = Math.sqrt(distSq);
const predictTime = constrain(dist / max(this.maxSpeed - t.vel.mag() * 0.5, 0.1), 0, 40);
this._tempForce.set(t.pos.x + t.vel.x * predictTime, t.pos.y + t.vel.y * predictTime);
this.applyForce(this.seek(this._tempForce, map(dist, 0, this.matingSearchRadius, 1.5, 0.8), 12));
```

`t.pos + t.vel * predictTime` is where the target will be in `predictTime` frames if it carries on as it is. This is Reynolds's **pursuit** behaviour: seek the predicted future position. The further away the target, the further ahead you predict, and the estimate is capped at 40 frames so a distant target doesn't send the suitor chasing a wild guess. The eagle uses the same idea in the next chapter.

On the other side, a moa that notices it's being courted responds, near the top of `determineState`:

```javascript
for (let i = 0; i < moas.length; i++) {
  if (moas[i] !== this && moas[i].targetMate === this &&
      moas[i].alive && moas[i].isFemale !== this.isFemale) {
    this.targetMate = moas[i];
    return MOA_STATE.SEEKING_MATE;
  }
}
```

"Is anyone nearby targeting me? Then I target them." The two walk toward each other, and when they're within `matingRange` (15 units), `initiateMating` links them: each records the other as `matingPartner`, both enter `MATING` for 60 frames, and hearts are drawn above them.

This is the first time in the game that two agents **coordinate**. Each one's state depends on the other's. It's done with nothing more than each holding a reference to the other and checking it every frame. Note the defensive checks everywhere: `this.matingPartner?.alive`. Your partner can be eaten at any moment. Whenever one object holds a reference to another that might die, check before you use it.

## Pregnancy and the Egg

When the 60 frames are up:

```javascript
completeMating(simulation, mauri) {
  const partner = this.matingPartner;
  const female = this.isFemale ? this : partner;
  if (female?.alive) {
    female.isPregnant = true;
    female.pregnancyTimer = female.pregnancyDuration;
  }
  this._resetAfterMating(this);
  if (partner?.alive) this._resetAfterMating(partner);
}
```

The female becomes pregnant with a timer of 90 frames. Both go on cooldown (`mateCooldown`, around 1,100 frames for an upland moa, and longer in winter) and both gain 10 hunger. Reproduction costs energy.

Pregnancy isn't a state in the state machine. It's a flag. A pregnant moa carries on foraging, fleeing and migrating as normal while `executePregnancy` counts the timer down beside her. If she's standing in a nest the player placed, it counts half as fast again. When it reaches zero:

```javascript
layEgg(simulation, mauri) {
  // Population caps: don't lay if the land is full.
  if (simulation.getMoaPopulation() >= this.config.maxMoaPopulation || /* per-species cap */) {
    this.isPregnant = false;
    return;
  }
  // ...
  const egg = simulation.addEgg(ex, ey);
  egg.speedBonus = Math.max(this.eggSpeedBonus, nestBonus);
  if (this.speciesKey) egg.parentSpecies = this.speciesKey;
  // ...
  this.isPregnant = false;
  this.hunger += 15;
  this.homeRange.set(this.pos.x, this.pos.y);
  this.securityTime = 0;
}
```

An `Egg` object appears where she stands (or at a nearby nesting site), tagged with her species. She gains 15 more hunger, her home range moves to this spot, and her security meter is emptied: she must feel safe all over again before the next one.

That reset to zero is important. Together with the cooldown it sets the maximum pace of breeding, and it means a single moa can't flood the map however good conditions are.

### The egg

An `Egg` is the simplest entity in the game. It has a position and a clock.

```javascript
update() {
  if (!this.alive || this.hatched) return;
  this.currentTime += this.speedBonus;
  if (this.currentTime >= this.incubationTime) {
    this.hatched = true;
  }
}
```

It counts up to `incubationTime` (500 to 700 frames depending on the level), faster if it's in a nest (`speedBonus` of 2). When it gets there it sets `hatched`.

Here is the answer to Exercise 1.3. The simulation calls `egg.update(dt)`, and `update` ignores the argument: it adds `speedBonus` per call, not `speedBonus * dt`. At 30 frames a second an egg takes twice as long in real time to hatch, while the moa around it, which do use `dt`, carry on at normal speed. It's a small inconsistency. The fix is one line, `this.currentTime += this.speedBonus * dt` with `update(dt = 1)`. I mention it because it's exactly the kind of thing to look for when you read simulation code: every timer should move by `dt`.

The egg doesn't create the chick. It only raises a flag. The simulation notices.

## Hatching

`Simulation.updateEggs` loops over the eggs, updates each, and deals with any that have hatched. The moa branch, trimmed:

```javascript
if (egg.hatched && egg.alive) {
  // ... eagle and flying-bird eggs are handled first ...
  if (this.getMoaPopulation() < config.maxMoaPopulation) {
    const offspringSpecies = egg.getOffspringSpecies();
    const newMoa = this._createFromRegistry('moa', offspringSpecies, egg.pos.x, egg.pos.y, Moa);

    if (newMoa) {
      // Sex-balance the hatchling: take the minority sex of its own living species.
      let _sf = 0, _sm = 0;
      for (let mi = 0; mi < this.moas.length; mi++) {
        const _m = this.moas[mi];
        if (_m.alive && _m.speciesKey === newMoa.speciesKey) { _m.isFemale ? _sf++ : _sm++; }
      }
      if (_sf < _sm) newMoa.isFemale = true;
      else if (_sm < _sf) newMoa.isFemale = false;

      newMoa.hunger = 35;
      newMoa.homeRange.set(egg.pos.x, egg.pos.y);
      this.moas.push(newMoa);
      this.stats.births++;
      // ... mauri reward, tutorial event, notification ...
    }
    egg.alive = false;
  }
}
```

A new `Moa` is constructed at the egg's position, given a starting hunger and a home, and pushed onto the list. Next frame it's in the spatial grid and living its own life.

Why does the simulation do this and not the egg? Because the simulation owns the list of moa, the caps and the statistics. The egg knows only that its time is up. This division, where a small object reports a fact and a larger one acts on it, keeps the small objects simple and keeps the rules in one place. You'll see it again when an eagle catches a moa: the eagle calls `simulation.handleEagleCatch`, and the simulation does the bookkeeping.

### Balancing the sexes

Look at the sex-balancing block. A moa's sex is normally a coin flip in its constructor. A hatchling's is not: the simulation counts the living males and females of its species and makes the chick whichever is scarcer.

This is the game intervening in its own simulation, and it's worth understanding why. With a real coin flip, small populations have a nasty failure. Take four moa. The chance they're all the same sex is one in eight. A level that starts with six moa of a species would, about one game in thirty, have no possible breeding pair, and the player would lose through no fault of their own. Random chance that averages out over a thousand animals is brutal over six.

So the game nudges. Chicks are born the minority sex. Founders at the start of a level alternate female, male, female, male (`moa.isFemale = (i % 2 === 0)` in `spawnMoas`). The two closest founders of a species are biased toward being a pair.

I'd draw a general lesson from this. A simulation built for a *game* is allowed to cheat where pure randomness would be unfair, as long as the cheat is small and stays out of sight. The art is to intervene at the points where bad luck is fatal and leave everything else alone.

### Mutation

`getOffspringSpecies` usually returns the parent's species. Unless the level forbids it, 5% of the time it returns a different, randomly chosen moa species:

```javascript
if (!_noSpeciation && random() < 0.05) {
  return this.getMutatedSpecies();
}
return this.parentSpecies;
```

It's a nod toward evolution: over a long game, new kinds appear. Most levels switch it off with `noSpeciation: true`, and a comment in Level 1 explains that mutated chicks didn't count toward the "hatch 20 upland moa" goal and clogged the population cap. It's a nice example of a feature that's charming in an open sandbox and a nuisance in a level with specific goals.

## Removing the Dead

Things are added to `simulation.moas` by hatching. How do they leave?

Not straight away. When a moa dies, its `alive` flag goes false and it stays in the array. Removing an element from the middle of an array while you're looping over that array is a classic source of bugs: indices shift, and you skip an element or visit one twice. So the game separates the two: death is a flag, and removal is a periodic sweep.

```javascript
cleanup() {
  const moas = this.moas;
  let writeIdx = 0;
  for (let i = 0, len = moas.length; i < len; i++) {
    if (moas[i].alive) moas[writeIdx++] = moas[i];
  }
  if (writeIdx !== moas.length) {
    moas.length = writeIdx;
    this._invalidateCache();
  }
  // ... the same for eagles, birds, nesting sites ...
}
```

This is **in-place compaction**, and it's one of the most useful small algorithms in games. Two indices walk the array. `i` reads every element. `writeIdx` marks where the next survivor should go. Each living moa is copied down to `writeIdx`, which then moves up. Dead ones are skipped. At the end, everything before `writeIdx` is alive, in the original order, and setting `length` chops off the rest.

```
before:  [A, x, B, x, x, C, D]      x = dead
                                    i reads left to right; survivors copy down
after:   [A, B, C, D]               length set to 4
```

No new array is created, and each element is touched once. Compare `this.moas = this.moas.filter(m => m.alive)`, which is one line and makes a whole new array each time. For a sweep every eight seconds either would do. The same compaction loop runs every frame for eggs and every other frame for placeables, and there the saving counts.

Because dead moa linger in the array for up to 512 frames, **every loop over moa must check `alive`**. You'll see `if (!m.alive) continue;` at the top of nearly every such loop in the game. Forget it and you get ghosts: dead moa that still count toward population, or that eagles still chase.

### Exercise 8.2

Write `compact(arr)` that removes every element whose `alive` is false, in place, without creating a new array. Test it on arrays where the dead are at the start, at the end, all of them, and none of them.

## Counting

"How many moa are alive?" is asked constantly: by the UI, by goals, by every eagle deciding whether to breed, by every laying moa checking the cap. Counting means looping over the array checking `alive`. Doing that dozens of times a frame is wasteful when the answer changes rarely.

```javascript
_ensurePopulationCache() {
  if (this._cacheFrame === frameCount) return;

  let moaCount = 0;
  const sc = this._speciesCountCache || (this._speciesCountCache = {});
  for (const key in sc) sc[key] = 0;
  for (let i = 0, len = moas.length; i < len; i++) {
    const m = moas[i];
    if (m.alive) {
      moaCount++;
      const k = m.speciesKey;
      if (k) sc[k] = (sc[k] || 0) + 1;
    }
  }
  // ...
  this._cachedAliveMoas = moaCount;
  this._cacheFrame = frameCount;
}

getMoaPopulation() {
  this._ensurePopulationCache();
  return this._cachedAliveMoas;
}
```

The first caller in a frame pays for one loop, which counts the total and a per-species breakdown at once. Every later caller that frame gets the stored answer. It's the per-frame cache from Chapter 5. When a moa dies or hatches mid-frame, the code calls `_invalidateCache()`, which sets `_cacheFrame` to −1 so the next question recounts.

`sc[k] = (sc[k] || 0) + 1` is the idiom for counting things into buckets by key: "the count so far, or zero if there isn't one yet, plus one". You'll write it often.

## Keeping the Numbers in Bounds

Now the question this chapter opened with. Births depend on food and safety. Deaths depend on hunger and eagles. What stops the population running away to infinity, or collapsing to nothing?

### Against explosion

Think about growth with no limits. Two moa have two chicks. Four moa have four. Eight have eight. Each generation doubles: 2, 4, 8, 16, 32, 64. That's **exponential growth**, and anything that reproduces does it when unchecked. It starts slowly and then is suddenly everywhere.

The game has four brakes, from gentle to hard.

**Food.** The natural one. More moa eat more plants; hungrier moa don't breed. This always operates.

**A soft cap.** Some levels set `breedingSoftCap`. Above it, each moa's chance of starting a courtship tapers off:

```javascript
_computeBreedDensityFactor(simulation) {
  const soft = M.breedingSoftCap;
  if (soft == null) return 1;                       // feature off
  const carry = M.breedingCarryingCap ?? (soft * 3);
  const floor = M.breedingSuppressFloor ?? 0.15;
  const P = simulation.getMoaPopulation();
  if (P <= soft) return 1;
  if (P >= carry) return floor;
  const t = (P - soft) / (carry - soft);            // 0..1 across the band
  return 1 - t * (1 - floor);
}
```

With a soft cap of 10 and a carrying cap of 30: at 10 moa or fewer the factor is 1, full breeding. At 30 or more it's 0.12. At 20, halfway, it's 0.56. There's the normalising formula `(P - soft) / (carry - soft)` again, feeding a lerp from 1 down to the floor.

The factor is used as a probability in `determineState`: `random() < this._breedDensityFactor`. So at 20 moa, a ready moa goes looking for a mate on 56% of its chances.

This is **density dependence**: the growth rate falls as the population rises. It's the mechanism behind the S-shaped "logistic" curve in every ecology textbook, where a population rises fast, slows, and levels off at a carrying capacity. Its great virtue over a hard cap is what happens after a crash. When winter kills half the herd, the factor goes back toward 1 and the survivors breed at full rate. The population rebounds by itself.

**Cooldowns.** Each moa must wait between eggs, and longer in winter:

```javascript
_cd *= 1 + (_wm - 1) * (moa._seasonCache.winterness || 0);
```

That's the fade-in-a-multiplier pattern from Chapter 5.

**Hard caps.** `maxMoaPopulation` for the whole map, `maxPerSpecies` for each kind. `layEgg` checks both and refuses. These are the last line of defence and they protect the frame rate as much as the ecology. A simulation should rarely reach its hard cap. If it's always sitting on it, the softer brakes aren't doing their job, and the level will feel static.

### Against extinction

The opposite danger is worse, because it's permanent.

A moa needs a mate of the opposite sex, of its own species, within about 100 units, on the same land, at a time when both are fed and both feel safe. In a herd of twenty that's easy. In a group of three it can simply fail to happen for a long time. And while they wait, an eagle takes one.

So a small population is in more danger than its size alone suggests. Its birth rate *per animal* is lower than a big population's, because finding a partner is hard. Ecologists call this the **Allee effect**. Below some size a population tends to shrink, and shrinking makes it worse. It's a trap door.

The game didn't program this. It appeared as soon as mating required two moa to find each other. The designers then had to decide what to do about it, and the game's notes are clear that they chose to leave it in and make it the player's problem: a species that has dropped to a few survivors is highlighted so the player can see it's in trouble and act. *The stewardship, not the safety net, is the point.*

A few quiet aids soften it, all of which you've now met: sex-balanced hatchlings; the widened mate search near food (`effectiveMatingRadius` doubles the search radius beside a favoured plant, so planting food also brings pairs together); and, on some levels, a **population floor** below which a species can't be hunted or starve.

### Exercise 8.3

Simulate a population as a single number in a sketch, no agents. Each frame: `births = pop * 0.02`, `deaths = pop * 0.01`, and plot `pop` over time. That's exponential. Now make births density-dependent: `births = pop * 0.02 * (1 - pop / 200)`. That's logistic growth. Finally add an Allee effect: multiply births by `pop / (pop + 10)`. Start from 50, from 10 and from 3, and compare.

## A Calendar

One more mechanism, used by some levels for more realistic breeding. A species can have a `calendar`:

```javascript
south_island_giant_moa: {
  calendar: { lay: 'spring', layFrom: 0.2, layTo: 0.6, clutch: [1, 1], maturityYears: 8, every: [2, 3], success: 1 },
  // ...
}
```

When a level sets `seasonalBirdBreeding: 'calendar'`, `isReadyToMate` adds three checks: it must be the right season, within a window of that season (`progress` between 0.2 and 0.6), and the hen's next allowed year must have arrived. A giant moa lays one egg in spring, every two or three years, and her chicks take eight years to mature.

Mechanically it's just more conditions in the readiness check. In effect it changes the game. A species on a calendar breeds in a pulse once a year and recovers slowly from losses, so it needs protecting over a long time. The same engine gives you a fast-breeding upland moa and a slow, precious giant moa by changing data.

## Summary

- A moa ages through juvenile, adolescent and adult. Size is a lerp over normalised age. Chicks get hungry faster.
- To breed, a moa must be adult, off cooldown, **fed** (hunger below 40) and **secure** (a meter that fills when no eagle is near and drains when one is).
- Because breeding needs food, births track the food supply: a feedback loop that pulls the population toward what the land supports.
- Because breeding needs security, an eagle's presence suppresses breeding without a kill, and the player's shelters matter.
- Mate choice scores candidates and keeps same-species and cross-species in separate tiers.
- Courtship is mutual: each moa targets the other, with pursuit aimed at the partner's predicted position.
- The female becomes pregnant, lays an `Egg`, pays hunger, and her security resets.
- An egg counts up and sets `hatched`. The simulation creates the chick, balancing the sexes within the species.
- Death is a flag. `cleanup()` compacts the arrays in place every 512 frames. Always check `alive`.
- Population counts are cached per frame and invalidated on a birth or death.
- Against explosion: food, a soft density-dependent cap, cooldowns, hard caps.
- Small populations struggle to find mates (the Allee effect). The game leaves that in and gives the player ways to help.

## The Mauri Project

Give moa a lifespan, and chart the consequences.

1. First, instrument. Add a lens `id: 'popChart'` with a `drawScreen` that, once a second, pushes `game.simulation.getMoaPopulation()` onto an array (keep the last 300 samples) and draws the array as a line graph in a corner of the screen. Run a level for a few minutes on fast-forward and look at the shape. Can you see the seasons in it?
2. Add old age. In `MOA_AGE`, add `MAX_AGE: 14400` (four minutes). In `Moa.behave`, after `this.updateAge(dt)`, add: if `this.age > MOA_AGE.MAX_AGE` and `random() < 0.001 * dt`, set `this.alive = false` and `this.causeOfDeath = 'old age'`. Why use a small probability per frame instead of dying exactly at `MAX_AGE`? (Think about founders, who are all created at the same moment.)
3. Founders start at age 0, as chicks. Find where founders are created (`Simulation.spawnMoas`, and `_spawnDistributedMoas` for levels with several species) and give each a random starting age between 900 and 5000 so the starting herd is a mix of adults. What did that change in the first minute of play?
4. Run your chart again. With mortality added, does the population still grow? What would you change, and by how much, to restore the old balance: `eggCooldownTime`, `securityTimeBase`, `MAX_AGE`? Try one.
5. In `Simulation.updateEggs`, find the sex-balancing block and disable it (so the constructor's coin flip stands). Start Level 1 ten times and count how many founders-plus-first-chicks groups end up badly lopsided. Re-enable it.
6. Fix the egg. Make `Egg.update` take `dt` and use it. Then check: does an egg in a nest still hatch twice as fast?
