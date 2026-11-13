# Chapter 11: The Player's Hand

> Nāu te rourou, nāku te rourou, ka ora ai te iwi.
>
> With your food basket and my food basket, the people will thrive.
> — whakataukī

*Builds on Chapters 6, 7 and 8.*

Everything so far would run without a player. Plants grow, moa graze and breed, eagles hunt, and the numbers rise and fall. You could put it on a screen in a museum and it would tick along for ever, or until a bad winter ended it.

A game needs someone to play it. In Mauri the player is a kaitiaki, a guardian, and what's interesting about the design is how *little* power that role is given. You cannot pick up a moa. You cannot tell it where to go, or make it eat, or stop an eagle. You can only change the land: grow food here, cover there, a storm overhead. The animals then do what they would have done anyway, in a world you've tilted.

That's called **indirect control**, and it's the right fit for an emergent simulation. Direct control would bypass the animals' brains, and with them everything in Chapters 7 to 10. Indirect control works *through* those brains. This chapter covers the tools (`PLACEABLES` in `mauri_sketch.js` and `PlaceableObject` in `mauri_placeable.js`), how the animals feel them, how a click becomes an object in the world, and the currency that limits it all.

## A Tool Is a Row in a Table

Here's the first tool most players use:

```javascript
kawakawa: {
  name: "Kawakawa Grove",
  description: "Hardy + nutritious (and spicy!)",
  cost: 25,
  radius: 40,
  duration: 1200,
  minSpacing: 30,
  feedingRate: 0.2,
  baseFeedingRate: 0.2,
  plantSpawnCount: 5,
  plantType: 'kawakawa',
  seasonalBonus: { summer: 1.2, autumn: 0.8, winter: 0.5, spring: 1.0 },
  attractsHungryMoa: true,
  attractionStrength: 1.3
},
```

And here's a very different one:

```javascript
shelter: {
  name: "Fern Shelter",
  description: "Eagles can't see moa here",
  cost: 40,
  radius: 50,
  duration: 3200,
  securityBonus: 4.0,
  blocksEagleVision: true,
  feedingRate: 0.015,
  baseFeedingRate: 0.015,
  seasonalBonus: { summer: 1.0, autumn: 1.0, winter: 1.3, spring: 1.0 }
},
```

A grove that feeds and a shelter that hides. You might expect two classes, `FeedingGrove` and `Shelter`, each with its own code. There's one class, `PlaceableObject`, and it has almost no idea what kind of thing it is. What a tool *does* is decided by which properties its row has.

- Has `feedingRate`? Moa standing in it are fed.
- Has `blocksEagleVision`? Moa standing in it are hidden.
- Has `securityBonus`? Their breeding meter fills faster.
- Has `hungerSlowdown`? They get hungry more slowly.
- Has `plantSpawnCount`? It grows that many plants when placed.
- Has `attractsHungryMoa`? Hungry moa are drawn to it.
- Has `distractsEagles`? A hunting eagle that flies into it forgets its prey.

Each property is a **capability**, and a tool is a bundle of them. A waterhole is `hungerSlowdown` plus a little `feedingRate` plus `attractsMoa`. Harakeke flax is `feedingRate` plus `securityBonus`: food *and* a bit of cover.

This is **composition**, and it's the alternative to the inheritance of Chapter 10. With inheritance you'd ask "what kind of thing is this?" and a flax bush, being both food and shelter, would have no good answer. With composition you ask "what can this thing do?" and the answer is a list. To invent a new tool, you write a new row with a new mix of flags. If the mix uses only capabilities that already exist, you write no code at all.

Both approaches are useful. Inheritance suits things with a strong shared routine and a few variations, like the birds. Composition suits things that are grab-bags of independent effects, like tools, power-ups and spells. Most games use both, and knowing which you're looking at tells you how to extend it.

## How an Animal Feels a Tool

The tool does nothing to the moa. The moa looks around and applies the tool's effects to itself. This is in `Moa.applyPlaceableEffects`, called during sensing each frame:

```javascript
applyPlaceableEffects(placeables, dt) {
  this.inShelter = false;
  this.securityBonus = 1;
  this.eggSpeedBonus = 1;
  this.isFeeding = false;
  this.feedingAt = null;
  let hungerMod = 1, feedTotal = 0;
  // Start from "no effects".

  for (let i = 0; i < placeables.length; i++) {
    const p = placeables[i];
    if (!p.alive || !p.isInRange(this.pos)) continue;
    // Only tools I'm standing in.

    const d = p.def;
    if (d.blocksEagleVision) this.inShelter = true;
    if (d.securityBonus) this.securityBonus = Math.max(this.securityBonus, d.securityBonus * p.seasonalMultiplier);
    if (d.eggSpeedBonus) this.eggSpeedBonus = Math.max(this.eggSpeedBonus, d.eggSpeedBonus * p.seasonalMultiplier);
    if (d.hungerSlowdown) hungerMod = Math.min(hungerMod, d.hungerSlowdown);
    if (d.feedingRate) {
      const fed = p.feedMoa(this, dt);
      if (fed > 0) {
        feedTotal += fed;
        this.isFeeding = true;
        this.feedingAt = p;
      }
    }
  }

  this.hungerRate = this.baseHungerRate * hungerMod;
  if (feedTotal > 0) this.hunger = Math.max(0, this.hunger - feedTotal);
}
```

(I've trimmed the partial-shelter detail.) The shape of this function is a pattern you'll use again and again.

**Reset, then accumulate.** Every frame it begins by clearing all the effects, then rebuilds them from whatever tools the moa is standing in *right now*. There's no "on enter" or "on leave" code. If the moa walks out of a shelter, or the shelter expires, then next frame the loop simply doesn't find it, and `inShelter` stays false. Nothing has to remember to switch the effect off.

That is far more robust than tracking entries and exits. Bugs of the form "the moa is still invisible though the shelter's gone" can't happen, because the state is never carried over. Whenever an effect depends on a condition that can change, prefer recomputing it from scratch each frame to toggling it on events.

**Decide how overlaps combine.** A moa can stand in two tools at once. What then? The function answers per effect. Security bonuses take the **maximum**: two shelters are no safer than the better one. Hunger slowdowns take the **minimum** (the stronger slowdown). Feeding rates **add**: two overlapping groves feed twice as fast. Those are design decisions, and they're made in one visible place. When you add an effect, decide this explicitly. "They add" is the default people fall into, and it's the one that lets players stack ten of something into nonsense.

The effects then flow into systems you already know. `inShelter` is what the eagle's target loop checks (Chapter 9). `securityBonus` multiplies the breeding meter's fill rate (Chapter 8). `isFeeding` puts the moa in the `FEEDING` state (Chapter 7). The tool sets a few fields, and the rest of the simulation responds.

### Being in range

```javascript
isInRange(pos) {
  const dx = this.pos.x - pos.x;
  const dy = this.pos.y - pos.y;
  return dx * dx + dy * dy < this.radiusSq;
}
```

A tool's area of effect is a circle, and "am I in it?" is a squared-distance comparison. Circles are the cheapest possible shape to test against, which is why game effects are so often round.

## Drawing Animals In

Being fed only helps a moa that's already in the grove. Tools also pull.

```javascript
getAttractionStrength(moa) {
  if (!this.alive || this.matured || this._bare()) return 0;

  let strength = 0;

  if (this.def.attractsHungryMoa && moa.hunger > 25) {
    strength = (moa.hunger / 100) * (this.def.attractionStrength || 1.0) * this.seasonalMultiplier;
  }
  // ... nests attract pregnant moa; waterholes attract any moa ...

  // Species-selective plants mostly draw only the species they favour
  if (this.def.favouredSpecies && moa.speciesKey !== this.def.favouredSpecies) {
    strength *= 0.2;
  }

  return strength;
}
```

The pull depends on who's asking. A full moa feels nothing from a grove. A hungry one feels it in proportion to its hunger. A lancewood stand pulls bush moa at full strength and every other species at a fifth.

So one object exerts a different force on every animal according to that animal's state. This is the game's answer to "how do I make the player's actions matter without controlling anything?". The grove isn't a command. It's an offer, and how appealing the offer is depends on what the moa needs.

The moa's side is `seekAttractions`. It scores each tool in range (strength minus a distance penalty, boosted by hunger and season) and heads for the best. Then it does something subtle, in two phases:

```javascript
if (distSq > r * r) {
  // GUIDE phase: steer toward the patch at cruising speed with no arrival braking,
  // so the moa reaches it carrying momentum instead of rubber-banding onto the centre.
  this.applyForce(this.seek(best.pos, 0.8));
} else {
  // ACROSS phase: once inside the patch, stop pulling the moa to the centre. Preserve
  // its heading so it grazes across and out the far side, so a line of plants acts as a corridor.
  const vMagSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
  if (vMagSq > 0.0001) {
    const s = (this.maxForce * 0.6) / Math.sqrt(vMagSq);
    this._tempForce.set(this.vel.x * s, this.vel.y * s);
    this.applyForce(this._tempForce);
  }
}
```

Outside the tool's radius, seek its centre. Inside, stop seeking and instead push gently along the direction the moa is *already travelling*. The moa walks in one side, grazes across, and leaves by the other.

Why? If moa kept seeking the centre they'd bunch up on one point and stay. With the across phase, a patch is something a moa passes through. And if there's another patch beyond it, the moa, still hungry and now closer to that one, is drawn on.

That's how players herd. Lay a line of groves from the high tussock down to the forest before winter, and the moa follow it like stepping stones. No "path" feature was written. A row of attractions, each handing the moa on to the next, behaves as one. The comment says it in a phrase: *a line of plants acts as a corridor*.

This two-phase attraction also has the stall watchdog from Chapter 7 attached (`_attrStall`): a patch the moa makes no progress toward for four seconds is ignored for ten.

## The Object Itself

`PlaceableObject` is mostly a countdown.

```javascript
constructor(x, y, type, terrain, simulation, seasonManager, opts = {}) {
  this.pos = createVector(x, y);
  this.type = type;
  this.def = /* the level's version of PLACEABLES[type] */;

  this.life = this.maxLife = this.def.duration;
  this.alive = true;
  this.radius = this.def.radius;
  this.radiusSq = this.radius * this.radius;

  this.spawnedPlants = [];
  if (this.def.plantSpawnCount) this.spawnPlantsInRadius();
  // ...
}

update(dt = 1) {
  // ...
  this.life -= dt;
  if (this.life <= 0) {
    this._expire();
    return;
  }
  this.updateSeasonalBonus();
  // ...
}
```

It keeps a reference to its row, `this.def`, and reads all its behaviour from there. `life` counts down from `duration`. At zero it expires, and its plants die with it (Chapter 6's first gate).

Temporary tools are a deliberate design choice. A grove that lasted for ever would be a problem solved for ever. One that lasts twenty seconds is a decision the player keeps having to make: is it still worth 25 mauri to feed them here, or has the season moved on? Giving the player's actions a lifetime is one of the simplest ways to keep a game from reaching a state where there's nothing left to do.

`ratio = life / maxLife` goes from 1 to 0 over the tool's life, another normalised 0-to-1 number. The renderer uses it to draw a shrinking ring, so the player can see time running out.

### Seasonal bonus

Each tool has a `seasonalBonus` table, and `updateSeasonalBonus` lerps between the current and next season's figures by `transitionProgress`, exactly as the season getters do in Chapter 5. A waterhole is worth double in summer and half in winter. A shelter is better in winter. So the same tool is a good or poor buy depending on the time of year, and the player's sense of what to place shifts with the seasons, without the tools themselves changing.

### Random points in a circle

Here's how a grove scatters its plants:

```javascript
for (let i = 0; i < this.def.plantSpawnCount; i++) {
  const angle = random(TWO_PI);
  const dist = random(5, this.radius * 0.8);
  const px = this.pos.x + cos(angle) * dist;
  const py = this.pos.y + sin(angle) * dist;
  // ... create the plant, mark it isSpawned, call simulation.addPlant ...
}
```

Random angle, random distance, convert to x and y. It's the obvious way to pick a point in a circle, and it has a quirk. Compare the forest-growing code:

```javascript
const a = random() * Math.PI * 2, rr = Math.sqrt(random()) * radius;
```

That one takes the **square root** of the random number before scaling by the radius. Why?

Picture the circle as a set of rings, like a target. The outer ring has much more area than the bullseye. If you choose the distance evenly between 0 and the radius, you put as many points in the small inner rings as in the big outer ones, so the points crowd toward the middle. Taking the square root shifts the choices outward by exactly the right amount to compensate, and the points come out evenly spread over the area.

Neither is wrong. A grove that's denser in the middle looks natural. A forest patch that fills evenly looks right for a forest. But you should know which you're getting. Plain `random(r)` clusters at the centre; `sqrt(random()) * r` is uniform.

### Exercise 11.1

Draw 2,000 points in a circle both ways, side by side. Then try `random() * random() * r` and `pow(random(), 0.25) * r`. Which would you use for a campfire's sparks? For trees around a clearing?

## From a Click to a Thing in the World

The player picks a tool and clicks the map. The click arrives in `Game.handleClick`, is converted to world coordinates with `_pointerWorld` (Chapter 1), and ends up at `tryPlace`:

```javascript
tryPlace(x, y) {
  if (!this.selectedPlaceable) return false;

  const def = this.activePlaceables[this.selectedPlaceable];
  if (!def || this.isToolLocked(this.selectedPlaceable)) return false;

  if (def.global) return this._useGlobalInteractable(this.selectedPlaceable, def);

  if (this.selectedPlaceable === 'Storm' && this.playTime < this._stormCooldownUntil) {
    this.addNotification(`Storm is recharging (${secs}s)`, 'error');
    return false;
  }

  if (!this.terrain.canPlace(x, y)) {
    this.addNotification("Cannot place here!", 'error');
    return false;
  }

  if (def.allowedBiomes) {
    const biome = this.terrain.getBiomeAt(x, y);
    if (!def.allowedBiomes.includes(biome.key)) {
      this.addNotification(`${def.name} can't take root in ${biome.name}`, 'error');
      return false;
    }
  }

  const spacingCheck = this.canPlaceWithSpacing(x, y, this.selectedPlaceable);
  if (!spacingCheck.allowed) {
    this.addNotification(spacingCheck.reason, 'error');
    return false;
  }

  if (!this.mauri.spend(def.cost)) {
    this.addNotification("Not enough mauri!", 'error');
    return false;
  }

  const placed = this.simulation.addPlaceable(x, y, this.selectedPlaceable);
  // ... cooldowns, notifications, tutorial event, sound ...
  return true;
}
```

It's a **validation chain**: a run of guard clauses, each checking one reason the action might not be allowed, each explaining itself to the player if it fails. Only when every check has passed does anything happen.

Two points of craft.

**The order is deliberate.** The cheap checks and the ones about *where* come first. Spending mauri comes last. `this.mauri.spend(def.cost)` both checks the balance and takes the money, in one call:

```javascript
spend(amount) {
  if (this.mauri >= amount) {
    this.mauri -= amount;
    this.totalSpent += amount;
    return true;
  }
  return false;
}
```

If it came earlier, a placement could be charged for and then rejected for being in the sea. Always do the irreversible step last, after everything that could refuse.

**Every failure says why.** A click that silently does nothing teaches the player nothing and feels like a bug. "Lancewood Stand can't take root in Alpine Rock" teaches a rule of the world. The validation chain is also the game's teacher.

There's a companion method, `_canPlaceAt(type, x, y)`, that runs the same placement rules without spending or notifying. The placement preview uses it every frame to tint the ghost of the tool green or red under the cursor. Showing the answer *before* the player commits is good interface practice. The risk is that the preview and the real check drift apart, and the game guards against that by having both call the same helpers (`terrain.canPlace`, `canPlaceWithSpacing`, `_nearForestOk`).

### Spacing

```javascript
canPlaceWithSpacing(x, y, type, exclude = null) {
  const def = this.activePlaceables[type] || PLACEABLES[type];
  if (def.ignoresSpacing) return { allowed: true };

  const mySpacing = def.minSpacing || 40;

  for (const p of this.simulation.placeables) {
    if (!p.alive || p === exclude) continue;
    const otherDef = PLACEABLES[p.type];
    if (otherDef.ignoresSpacing) continue;

    const requiredDist = (mySpacing + (otherDef.minSpacing || 40)) * 0.5;
    const dist = p5.Vector.dist(this._tempVec, p.pos);

    if (dist < requiredDist) {
      return { allowed: false, reason: `Too close to ${otherDef.name}`, blocker: p, requiredDist, actualDist: dist };
    }
  }
  return { allowed: true };
}
```

Each tool has a `minSpacing`, and two tools must be at least the average of their spacings apart. Without this, the best strategy would be to pile every grove on one spot. With it, the player has to spread tools over the land, and where to put the next one becomes a small puzzle.

Notice the return value. It isn't `true` or `false`. It's an object: `{ allowed, reason, blocker, ... }`. The caller gets the verdict and the explanation and the offending item together. When a check can fail for different reasons and the caller needs to know which, return an object. It saves working out the reason a second time.

And notice this is a plain loop over all placeables, not a spatial query. There are rarely more than twenty tools down at once, and this runs only on a click. Chapter 3's advice applies: a grid is for large N asked about often.

### Moving and holding

Press and hold on a placed tool for a second and it lifts, to be set down elsewhere for half its original cost. `updateHoldToMove` counts the frames the pointer has been held still on an item; at 60 it calls `_beginMove`. If the pointer drifts more than 14 pixels or lifts early, the count is abandoned.

That tolerance, a small distance the pointer may wander without it counting as a drag, is called **slop**, and every press-and-hold or click-versus-drag gesture needs one. Fingers and mice are never perfectly still. Without slop, holds fail for no apparent reason.

## The Storm

One tool is unlike the others. The storm has no food and, in its original form, no shelter:

```javascript
Storm: {
  name: "Storm",
  cost: 40,
  radius: 70,
  duration: 600,
  distractsEagles: true,
  minSpacing: 0,
  ignoresSpacing: true,
  // ...
},
```

It's an emergency button. It lasts ten seconds, ignores spacing so it can go anywhere, and has a ten-second recharge after use. A hunting eagle that enters it is distracted (Chapter 9) and circles it for three seconds, forgetting its target.

The story levels reuse the storm with different capabilities. There, a level's version of the row adds `blocksEagleVision`, and the storm becomes cover: moa under it can't be seen. The object, its art and its animation are unchanged. Only the flags differ. That's composition paying off. The level file can override any property of any tool (Chapter 12 shows how), so one tool can play different roles in different levels.

## Mauri: The Economy

Every tool has a cost. The currency is mauri, and `MauriManager` in `mauri_sketch.js` keeps the books. It's a small class: a balance, `earn`, `spend`, `canAfford`.

A game economy is easiest to think about as plumbing. There are **faucets**, where currency comes in, and **sinks**, where it goes out. If the faucets outrun the sinks, the player ends up with more than they can use and choices stop mattering. If the sinks outrun the faucets, the player is stuck with nothing to do. The designer's job is to keep the level in the tank in a range where each purchase is a real decision.

The sinks are simple: placing a tool, and moving one.

The faucets are more varied, and each one rewards a different thing.

| Source | Amount | Rewards |
|---|---|---|
| A moa eats a plant | 1 | Keeping moa fed |
| An egg is laid | 5 | Safety and food together |
| An egg hatches | 10, falling as the herd grows | Getting eggs through |
| A population milestone | 50 | Growth |
| A goal is completed | set by the level | Following the level's aims |
| Passive income | a trickle | Having a thriving herd |

Look at what earns. You're paid when the ecosystem does well, not for clicking. Mauri means life force, and the mechanic matches the word: a healthy land generates it, and you spend it on the land.

That makes the economy a loop. Mauri buys groves. Groves feed moa. Fed moa eat, breed and hatch, which earns mauri. It's a reinforcing loop like the birds and the forest, and it has the same tendency: success breeds success, and failure breeds failure. A player doing well earns more and does better still. A player whose herd is starving earns nothing and can't afford to fix it.

Left alone, that runs away in both directions. So the economy has brakes on the top end and a cushion at the bottom, and they're worth studying.

### Brakes

**Eating only pays when you're poor.**

```javascript
earnFromEating(amount, x, y) {
  if (this.mauri < this.eatMauriThreshold) {
    this.earn(amount, x, y, 'eat');
    return true;
  }
  return false;
}
```

`eatMauriThreshold` is 50. Below that, each bite a moa takes earns a point. Above it, nothing. This is the cushion: a player who's nearly broke has a steady small income from whatever moa are still eating, enough to climb back to one or two tools. A rich player gets none of it. It's a catch-up mechanic, and it's three lines.

**Hatching pays less as the herd grows.**

```javascript
const pop = this.getSpeciesCount(speciesKey) - 1;
return pop > 15 ? 0 : pop > 10 ? mauri.onEggHatch * 0.5 : mauri.onEggHatch;
```

Full reward up to 10 moa, half up to 15, none after. This is **diminishing returns**: each further unit of success is worth less than the last. It's the economy's version of the density-dependent breeding in Chapter 8, and it does the same job. Growth is rewarded most when the population is small and precarious, and not at all when it's already large.

**Passive income tapers.**

```javascript
const pop = this._cachedMoaCount;
income = (pop * this.mauri.perMoaPerSecond +
          this._cachedThrivingCount * this.mauri.onMoaThriving)
         * this.mauri.passiveIncomeScale;
const tStart = 10, tScale = 5.3;
if (pop > tStart && income > 0) {
  const effPop = tStart + tScale * (1 - Math.exp(-(pop - tStart) / tScale));
  income *= effPop / pop;
}
```

About once a second, the game pays a little for each "thriving" moa (hunger below 20). Then it applies a curve. Up to 10 moa, every moa counts fully. Beyond 10, the "effective population" grows more and more slowly, approaching a ceiling of about 15.3 however many moa there are.

The expression `1 - Math.exp(-x / scale)` is the standard formula for **saturation**: something that rises quickly at first and levels off toward a limit. At `x = 0` it's 0. As `x` grows it climbs toward 1 and never passes it. `scale` sets how quickly. You'll want this curve whenever "more" should keep helping but ever less: experience points, crowding, the brightness of overlapping lights.

```
effective pop
15.3 |                    ___----------   ← ceiling
     |               _--'
     |           _-'
  10 |_________-'
     |        /
     |      /           (below 10: one for one)
     |____/________________________________
          10        20        30       actual pop
```

The comment gives the intent: *discourages hoarding a huge flock*. Past a point, more moa earn no more, so the best strategy isn't simply "as many as possible".

### Exercise 11.2

Plot three reward curves for a population from 0 to 50: linear (`pop`), stepped (as the hatch reward: full to 10, half to 15, then zero added), and saturating (`10 + 5.3 * (1 - exp(-(pop - 10) / 5.3))` above 10). Which would you choose for a game where you *wanted* players to build huge herds?

### Free Play: paying for balance

Free Play replaces passive income with a formula that rewards something subtler than headcount. It wants an *even* ecosystem.

```javascript
ecosystemStats() {
  // ... count each species present ...
  const avgPop = sum / n;

  let worstBalance = 1;
  for (const [k, c] of items) {
    const ratio = mx > 0 ? c / mx : 1;      // this species ÷ the most numerous one
    const w = focus.includes(k) ? fW : 1;
    const b = Math.pow(ratio, w);
    if (b < worstBalance) worstBalance = b;
  }
  // ...
  const balance = minBal + (1 - minBal) * Math.pow(worstBalance, harsh);
  const mauriPerSec = avgPop * balance * (cfg.scale ?? 1);
  return { avgPop, balance, rawBalance, mauriPerSec, aboveFloor: n };
}
```

Income is **average population × balance**. Balance is based on the worst ratio between any species and the most numerous one. Ten of every species: balance is 1, full income. Twenty of one and two of another: the ratio is 0.1, and income collapses.

So the player is paid for keeping the rarest species healthy relative to the commonest. Pouring effort into the species that's already winning *lowers* your income. It's a scoring rule that steers the player toward the game's theme, a thriving community of species and not a monoculture, without a word of instruction.

Two details are instructive. A focus species' ratio is raised to a power (`Math.pow(ratio, w)` with `w` of 2), which makes its shortfall bite harder: 0.5 squared is 0.25. And the result is rescaled into the range from `minBalance` (0.2) to 1, so income never drops to zero. The comment records that an earlier version without that floor *crushed a 5:1 spread to ~0.01, stalling the run*. A penalty that can reach zero in a reinforcing loop is a trap the player can't climb out of. Put a floor under it.

That's the lesson of the whole economy: **whatever you reward, players will do more of**. Reward headcount and you get one enormous herd. Reward balance and you get stewardship. Decide what behaviour you want, then find the number that measures it.

### Floating numbers

One last small piece of craft. When mauri is earned at a place, a "+5" rises from that spot and fades:

```javascript
updateFloatingTexts(dt = 1) {
  const texts = this.floatingTexts;
  for (let i = texts.length - 1; i >= 0; i--) {
    const ft = texts[i];
    ft.life -= dt;
    ft.y -= 0.5 * dt;
    if (ft.life <= 0) {
      texts[i] = texts[texts.length - 1];
      texts.pop();
    }
  }
}
```

This is a tiny particle system, and its removal trick is different from the compaction in Chapter 8. To delete element `i`, it copies the **last** element over it and pops the end off. One assignment, no shifting. It's called **swap-remove**, and it's the fastest way to delete from an array.

The catch is that it changes the order: the last element jumps into the gap. For floating numbers, order is irrelevant. For moa, whose order affects nothing visible either, compaction was chosen because it runs rarely. Use swap-remove when order doesn't matter and removals are frequent. And note the loop runs **backwards**, from the end to the start, so that the element swapped into position `i` has already been processed.

Feedback like this matters more than its size suggests. The player's actions have delayed, indirect effects. A number rising from a moa as it eats ties cause to effect: *that* is where my mauri came from.

## A Tool That Makes Something New

I'll end with a mechanic that shows indirect control at its best. In Free Play, the player can found a nesting site, and there's no "nest" button for it.

```javascript
_updateMoaNestingFormation(dt) {
  // ... every 90 frames ...
  const patches = this._focusPlantPatches(watch);
  if (patches.length < need) return;

  for (let i = 0; i < patches.length; i++) {
    const a = patches[i];
    const group = patches.filter(b => d2(a, b) <= foundR2).sort(/* nearest first */).slice(0, need);
    if (group.length < need) continue;
    // ... centre of the group ...

    if (this.getNearestNestingSite(cx, cy, minGap)) continue;     // not too near another site

    let moaNear = false;
    const moas = this.getNearbyMoas(cx, cy, drawRadius);
    for (let j = 0; j < moas.length; j++) {
      if (moas[j].alive && moas[j].speciesKey === watch.speciesKey) { moaNear = true; break; }
    }
    if (!moaNear) continue;                                        // the moa must have come

    for (const g of group) g._nestFounded = true;
    const site = new NestingSite(cx, cy, { radius, habitat });
    this.nestingSites.push(site);
    return;
  }
}
```

The rule: where two patches of a moa species' favoured plant stand close together, *and* a moa of that species has been drawn to them, a nest forms between them.

The player does two ordinary things, twice planting food. The moa do an ordinary thing, walking to it. And out of the combination comes something new on the map, with its own effects: moa gather there to lay, eggs hatch faster, eagles patrol it, kea raid it.

The simulation is watching for a *pattern* in the world and responding when it appears. That's a different relationship between player and game than a button. The player has to learn how the land works, and the land rewards the knowledge. If you want to add depth to the game without adding buttons, look for more rules of this shape: when these things come together, this happens.

## Summary

- The player has indirect control: they change the land, and animals respond through their own behaviour.
- A tool is a row of capabilities in `PLACEABLES`. One class, `PlaceableObject`, serves them all. New mixes of flags need no new code.
- Composition (what can it do?) suits grab-bags of effects. Inheritance (what kind is it?) suits shared routines.
- Each frame a moa resets its effects and rebuilds them from the tools it's standing in. Decide whether overlapping effects take the max, the min or the sum.
- Attraction depends on the animal's state. Seeking the centre from outside and coasting across from inside turns a row of patches into a corridor.
- Tools have lifetimes, so decisions recur. Seasonal bonuses change what's worth buying.
- `sqrt(random()) * r` spreads points evenly in a circle; `random(r)` clusters them at the centre.
- `tryPlace` is a validation chain: cheapest checks first, the irreversible spend last, a reason given for every refusal. The preview uses the same checks.
- An economy has faucets and sinks. Mauri is earned by a healthy ecosystem, which makes a reinforcing loop.
- Brakes: eating only pays when poor; hatch rewards diminish; passive income saturates (`1 - exp(-x/s)`).
- Free Play pays average population × balance, with a floor. What you reward is what you get.
- Swap-remove deletes from an unordered array in one step; loop backwards.
- Nests form from a pattern (two patches plus a moa), not a button.

## The Mauri Project

Invent two tools: one from existing parts, one that needs new code.

1. **A tool from parts.** In `PLACEABLES`, add `tutu`:  a bush that is rich food (`feedingRate` and `baseFeedingRate` of 0.25, `plantSpawnCount` 3, `plantType: 'coprosma'`, `attractsHungryMoa: true`, `attractionStrength: 1.6`) and offers *no* security at all. Give it a `name`, `description`, `cost`, `radius`, `duration`, `color`, `icon`, `fauna: 'moa'`, `minSpacing` and a `seasonalBonus`. Add `tutu: { cost: 20 }` to your sandbox level's `availablePlaceables`. Play with it. You wrote no behaviour code. Why did it work?
2. **Override a tool per level.** In your sandbox level only, make the shelter also feed: `shelter: { cost: 40, feedingRate: 0.1, baseFeedingRate: 0.1 }`. Confirm the change doesn't affect Level 1.
3. **A new capability.** Add a flag `slowsEagles: 0.5` to a new tool, `mist`. No code reads that flag yet. In `HaastsEagle.behave`, after `nearbyPlaceables` is fetched, loop over them: if the eagle is in range of an alive placeable whose `def.slowsEagles` is set, remember the factor. Then, at the very end of `behave`, multiply `this.maxSpeed` by it. Use the reset-then-accumulate pattern: start each frame with a factor of 1. If two mists overlap, should the factors multiply, or should the strongest win? Choose, and say why in a comment.
4. **Rebalance the economy.** In `MauriManager`, change `eatMauriThreshold` from 50 to 500 and play Level 1. Then set it to 0. Describe the difference in how the first two minutes feel.
5. **Change what's rewarded.** In `Game.update`'s passive income block, replace the thriving-moa term with one that pays per *species* present with at least 3 members. Play a multi-species level. Did your behaviour as a player change?
6. Stretch: write a pattern rule of your own in the style of nest founding. For example: when a shelter and a waterhole stand within 60 units of each other, moa inside either get a `securityBonus` of 6. Where would the check go so that it follows reset-then-accumulate?
