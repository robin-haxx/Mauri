# Chapter 9: The Hunter

> He iti hoki te mokoroa, nāna i kakati te kahikatea.
>
> The mokoroa grub is small, yet it gnaws through the kahikatea.
> — whakataukī

*Builds on Chapters 2, 7 and 8.*

The Haast's eagle, Pouākai, was the largest eagle that ever lived, and it hunted moa. In the game it's the reason anything is at stake. Without it the moa would graze, breed up to what the plants could feed, and stay there. With it, every well-fed herd is also a target, and the player has something to protect them from.

The eagle is a `Boid` like the moa, and its brain has the same parts: a drive, states, a scoring loop. So this chapter can move faster through the familiar pieces and spend its time on three new ideas. The first is **pursuit**: catching something that's running away. The second is a different, lighter way to write a state machine. The third, and the one I most want you to take away, is how a predator *population* can be made to regulate itself, so that the number of eagles on the map is not a setting but an outcome.

The code is `HaastsEagle` in `mauri_eagle.js`, with the births, deaths and catches handled by `Simulation`.

## A Different Animal From the Same Parts

Compare the numbers in the two constructors.

| | Moa (upland) | Eagle |
|---|---|---|
| Cruising speed | 0.16 | 0.30 |
| Top speed | 0.25 (fleeing) | 0.45 (hunting) |
| `maxForce` | 0.02 | 0.05 |
| Senses prey / predator at | 85 × flightiness | 130 |
| Keeps this far from its own kind | 50 | 100 |
| Hunger rate per frame | 0.02 | 0.012 to 0.03 |

The eagle is nearly twice as fast and turns more than twice as hard. A moa cannot outrun it. Remember that when you play: a moa in the open with an eagle locked on is caught unless something intervenes. The moa's defences are to not be chosen, to be hidden, or to have the player step in.

Eagles also keep far apart. Their separation distance is 100 units, and `behave` applies it at double strength:

```javascript
const nearbyEagles = simulation.getNearbyEagles(this.pos.x, this.pos.y, this.separationDist * 1.5);
const sep = this.separate(nearbyEagles);
sep.mult(2);
this.applyForce(sep);
```

Strong separation over a large distance produces **territories**. Nobody assigns an eagle a patch. Each one is pushed away from every other until they're spread across the map. Same force as the moa's personal space, different radius, entirely different result. That's a recurring pleasure of working with steering behaviours: the parameters matter as much as the rules.

## States by Timer

The moa's state machine asked a list of questions each frame and took the first yes. The eagle's works the same way underneath and is written in a different style, which is worth seeing because it suits a creature whose states have fixed durations.

```javascript
behave(simulation, mauri, dt = 1) {
  if (this.lifeScript) { this.lifeScript.behave(simulation, mauri, dt); return; }

  this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);
  // ... ageing, starvation, breeding (below) ...

  this.checkStorms(nearbyPlaceables);

  if (this.distractedTimer > 0) {
    this.state = 'distracted';
    this.distractedTimer -= dt;
    this.beDistracted();
    return;
  }

  if (this.restTimer > 0) {
    this.state = 'resting';
    this.restTimer -= dt;
    this.rest();
    return;
  }

  if (this.relocateTimer > 0) {
    this.state = 'relocating';
    this.relocate(dt);
    return;
  }

  // ... separation, edges ...

  if (this.hunger > _huntThresh || this.aimAt) {
    this.hunt(simulation, mauri, dt);
  } else {
    this.state = 'patrol';
    this.patrol(dt);
  }
}
```

Three of the five states are entered by setting a timer and left when it runs out. To make an eagle rest, some other piece of code writes `eagle.restTimer = 180`. From then on, each frame, `behave` sees the timer is positive, counts it down, runs the resting behaviour and returns. When it reaches zero the eagle falls through to whatever comes next.

The timers are checked in priority order, and each returns early (a guard clause, as in Chapter 6). A distracted eagle doesn't rest; a resting eagle doesn't relocate. The string in `this.state` is just a label for the renderer and the debug display. The timers are the real state.

When a state means "do this for N frames, then go back to normal", a timer is all you need. Setting it starts the state, and nothing has to remember to end it. Reserve the full question-list approach for states that depend on conditions in the world.

Below the timers is the one real decision an eagle makes: am I hungry enough to hunt? If hunger is above a threshold (45 by default), hunt. Otherwise, patrol.

## Patrol: Circling a Point

A patrolling eagle flies a loose circle around a home point.

```javascript
patrol(dt = 1) {
  this.maxSpeed = this.baseSpeed;

  this.patrolAngle += this.patrolSpeed * this.wanderStrength * dt;

  this._targetVec.set(
    this.patrolCenter.x + cos(this.patrolAngle) * this.patrolRadius,
    this.patrolCenter.y + sin(this.patrolAngle) * this.patrolRadius
  );

  this.applyForce(this.seek(this._targetVec, 0.55));

  const wander = this.wander();
  wander.mult(0.12);
  this.applyForce(wander);
  // ...
}
```

There's no "orbit" force here. There is an angle that increases a little each frame, and the point on a circle at that angle:

```
x = centre.x + cos(angle) * radius
y = centre.y + sin(angle) * radius
```

As the angle grows, that point travels round the circle. The eagle seeks the point. It never quite catches it, so it follows it round, and the path it traces is a circle with the corners knocked off by its limited turning force, plus a little wander so no two laps are the same.

This is a general technique: **steer toward a target that is itself moving along a path**. To make something follow any shape, a figure of eight, a line of waypoints, a spiral, you don't need a special behaviour for each shape. You need a point that moves along the shape, and `seek`. The story-level moa in Chapter 14 walk routes this way.

The searching behaviour uses the same idea with a growing radius:

```javascript
const searchAngle = frameCount * 0.02 + this.wingPhase;
const searchRadius = this.patrolRadius + (this.huntSearchTimer * 0.3);
```

The longer a hungry eagle goes without finding prey, the wider it circles: a spiral outward from home.

### Exercise 9.1

Make a boid that seeks a point moving round a circle. Draw both. Try `maxForce` values that are too low for the circle's size and see what the boid's path becomes. Then make the radius grow slowly with time.

## The Hunt

When the eagle is hungry, `hunt` runs every frame. It has three parts: choose a target, chase it, strike.

### Choosing

```javascript
const nearbyMoas = simulation.getNearbyMoas(this.pos.x, this.pos.y, this.huntRadius);

let nearestEff = Infinity;
let nearestMoa = null;

for (let i = 0; i < nearbyMoas.length; i++) {
  const moa = nearbyMoas[i];
  if (!moa.alive) continue;
  if (simulation.isSpeciesProtected(moa.speciesKey)) continue;

  const dx = moa.pos.x - px, dy = moa.pos.y - py;
  const dSq = dx * dx + dy * dy;

  // Cover hides a moa.
  if (moa.inShelter && (this.target !== moa || _M.coverBreaksLock)) {
    const frac = moa.shelterSpotFrac || 0;
    const spotR = this.huntRadius * frac;
    if (frac <= 0 || dSq > spotR * spotR) continue;
  }

  // Camouflage: a chance of not being noticed.
  if (moa.camouflage > 0 && this.target !== moa && random() < moa.camouflage) continue;

  // Prefer abundant prey.
  let eff = dSq;
  if (this.emergent) {
    const _n = simulation.getCachedSpeciesCount(moa.speciesKey);
    if (_n <= _preyThreshold) eff *= _scarcePenalty;
  }

  if (eff < nearestEff) { nearestEff = eff; nearestDistSq = dSq; nearestMoa = moa; }
}
```

It's the "world record" loop again: filter, score, keep the best. Each filter is a way for a moa to survive.

**Cover.** A moa under a fern shelter has `inShelter` true (set in `applyPlaceableEffects`, Chapter 11) and is skipped. That's the whole of how shelter works: the moa is left out of a loop.

**Camouflage.** Some species have a `camouflage` value, say 0.3. On each scan, each such moa has a 30% chance of being overlooked. There's a subtlety in `this.target !== moa`: camouflage only applies to moa the eagle isn't already chasing. It makes a moa harder to *find*, not harder to *follow*. Without that condition, a camouflaged moa being chased would flicker in and out of the eagle's attention every frame.

**Scarcity.** The score is squared distance, but if the moa's species has 12 or fewer members, the distance is multiplied by 6. A rare moa "feels" much further away, so eagles go for common species first. The comment gives the reason: this *breaks the moa death-spiral*. In Chapter 8 I described how a small population struggles to breed. If eagles also picked off its members at the same rate as everyone else's, small populations would be doomed. This one multiplier means predation falls mainly on whichever species can best afford it. Real predators often do behave this way, switching to whatever prey is commonest.

Note that the loop tracks two distances. `nearestEff` is the adjusted score used for choosing. `nearestDistSq` is the true distance, kept for the catch test later. Don't let a fudge factor you added for decision-making leak into physics. The eagle prefers common prey; it doesn't have a longer reach for them.

### Chasing: lead the target

Now the eagle has a moa in its sights, and the moa is running. In Chapter 8, courting moa aimed at where their partner would be. The eagle does the same, more simply:

```javascript
this._targetVec.set(
  target.pos.x + target.vel.x * 12,
  target.pos.y + target.vel.y * 12
);
this.applyForce(this.seek(this._targetVec, 1.4));
```

It seeks the spot where the moa will be 12 frames from now if it keeps going as it is. This is **pursuit with lead**. You can see the difference on screen. An eagle seeking the moa's current position would curve in behind it and trail it in a tail-chase. An eagle seeking the predicted position cuts the corner and intercepts.

A fixed 12 frames is a simplification. A more exact pursuer would predict further ahead when the prey is far and less when it's close (as `seekMate` does). For a fast predator closing on slow prey, a small fixed lead is enough and never overshoots wildly.

The urgency is 1.4. From Chapter 2: urgency scales both the desired speed and the permitted force. This is the eagle trying harder than it does at anything else.

### Exercise 9.2

Build a chase. One boid flees the mouse (or wanders). A second pursues it. Give the pursuer a `lead` variable and aim at `prey.pos + prey.vel * lead`. Draw a small cross at the aim point. Try lead values of 0, 10 and 60 and watch the shape of the pursuer's path.

### Striking, fairly

```javascript
if (targetDistSq < this.catchRadiusSq && !inGrace && this.huntWindupTimer <= 0) {
  if (typeof target.resistEagleAttack === 'function' && target.resistEagleAttack()) {
    // Shrugged off: break away and rest a moment.
    this.hunting = false; this.target = null;
    this.state = 'resting'; this.restTimer = Math.round(this.restDuration * 0.5);
    this.vel.mult(0.3);
  }
  else simulation.handleEagleCatch(this, target, mauri);
}
```

A catch happens when the true distance is inside the catch radius (12 units), and two other conditions hold. Both are there for the player.

**The wind-up.** Every time an eagle locks onto a new target, a timer starts at 60 frames. No catch can land until it has run down. Without this, an eagle that happened to be right above a moa when it got hungry would kill it on that same frame. The player would see a moa vanish with no warning. With it, there is always at least a second between "the eagle has chosen" and "the eagle has struck".

**The grace period.** Some levels and tutorials add a longer window during which the eagle chases at reduced speed and cannot strike, with a "!" drawn above it. That's the player's chance to drop a storm or a shelter.

Neither of these makes ecological sense. A real eagle doesn't announce itself. They exist because a game has to be *readable*: the player must be able to see a threat coming and have time to respond. This is the same lesson as the sex-balanced hatchlings in Chapter 8. A simulation tuned only for realism can be a poor game. When the two pull apart, decide on purpose which one you're serving.

The `resistEagleAttack` branch lets a big moa survive a strike by chance. Giant moa have `eagleResistance: 0.3`. Note where the roll is made. An earlier version rolled it during target selection, and a comment records what went wrong: *rolled on every scan it made the bird's pick flicker between herd members, so no wind-up ever finished*. Rolling dice every frame gives you noise. Rolling once, at the moment of decision, gives you an outcome.

### The catch

Like the egg in Chapter 8, the eagle doesn't apply the consequences itself. It calls the simulation:

```javascript
handleEagleCatch(eagle, moa, mauri) {
  // ...
  moa.alive = false;
  moa.causeOfDeath = 'eagle';

  eagle.kills++;
  eagle.hunger = Math.max(0, eagle.hunger - 90);
  eagle.vel.mult(0.1);
  eagle.hunting = false;
  eagle.target = null;
  eagle.state = 'resting';
  eagle.restTimer = eagle.restDuration;
  // ...
  this.stats.deaths++;
  this._invalidateCache();
}
```

The moa dies. The eagle's hunger drops by 90, which takes it from hungry to nearly full. It stops dead and rests for 180 frames. Then it drifts back to patrol and doesn't hunt again until its hunger has climbed back over the threshold.

That last fact sets the tempo of the whole game. One moa buys an eagle a fixed period of peace. With the base hunger rate of 0.012, climbing from near 0 to 45 takes around 3,700 frames, about a minute. Levels with emergent eagles (below) use a faster rate, 0.02 to 0.03, which brings that down to 25 to 40 seconds. So one eagle takes a moa every half-minute to a minute, and a herd needs to breed faster than that to grow.

## Distraction: Orbiting With a Perpendicular

When a hunting eagle flies into a storm the player has placed, `checkStorms` sets `distractedTimer = 180` and the eagle circles the storm, its prey forgotten. The circling uses a trick worth knowing:

```javascript
const dx = this.distractedBy.pos.x - this.pos.x;
const dy = this.distractedBy.pos.y - this.pos.y;

this._tempForce.set(-dy, dx);
this._tempForce.normalize();
this._tempForce.mult(this.maxForce * 0.8);
this.applyForce(this._tempForce);
```

`(dx, dy)` is the arrow from the eagle to the storm. `(-dy, dx)` is that same arrow rotated a quarter turn. Swapping the two components and negating one **always** gives a perpendicular vector. It's the fastest way to turn something 90 degrees, with no sines or cosines.

A force that's always perpendicular to the line between you and a point pushes you sideways round it. That's an orbit, and it's how a planet goes round a sun. The code adds a weak pull inward if the eagle drifts too far out.

## An Energy Budget

So far the eagle hunts when hungry and rests when fed. Now make hunger able to kill it.

```javascript
if (this.hunger >= this.starveThreshold) {
  this.starveTimer += dt;
  if (this.starveTimer >= this.starveTimeout) {
    this.alive = false;
    if (simulation.onEagleDeath) simulation.onEagleDeath(this);
    return;
  }
} else if (this.starveTimer > 0) {
  this.starveTimer = Math.max(0, this.starveTimer - dt * 2);
}
```

Above a hunger of 85 or 90, a starvation timer runs. If it reaches its limit (900 to 2,400 frames depending on the level) the eagle dies. If the eagle feeds in time, the timer runs back down at double speed.

This is a two-stage design, and it's kinder than "die at hunger 100". There's a danger zone, and a clock that starts when you enter it. An eagle can dip into starvation, make a kill, and recover. The fill-and-drain timer is the same shape as the moa's security meter in Chapter 8: a quantity that accumulates under one condition and decays under the opposite one. It's a handy pattern for anything that should take sustained exposure to trigger.

With this in place, an eagle has an **energy budget**. Hunger is spending. A kill is income. An eagle in country with plenty of moa stays solvent. An eagle whose prey has dwindled, or retreated under cover, goes broke and dies.

## A Population That Sets Itself

Now the idea I promised. How many eagles should there be on the map?

### The first answer: a controller

The game's original answer is still in the code, as `Simulation.regulateEagles`:

```javascript
regulateEagles() {
  const M = LEVEL_MECHANICS;
  const moa = this.getMoaPopulation();
  const perMoa = M.eaglesPerMoa ?? 0.09;
  let target = Math.round(moa * perMoa);
  // ... clamp to min/max ...

  const season = this.seasonManager.currentKey;
  const n = this.eagles.length;
  if (n > target && (season === 'winter' || season === 'autumn')) {
    this._removeWeakestEagle();
  } else if (n < target && (season === 'spring' || season === 'summer')) {
    this.spawnEagle();
  }
}
```

Every few seconds, a piece of code outside the ecosystem counts the moa, multiplies by 0.09 to get the "right" number of eagles, and adds or deletes an eagle to match. An even earlier scheme simply spawned a new eagle each time the moa population passed a milestone.

This is **top-down** control. It works, in that the numbers come out sensibly. But consider what it means. An eagle appears from nowhere because a formula said so. Another vanishes, though it had just eaten. If you ask "why did that eagle die?", the answer is "the controller removed it". There is no cause *in the world*. And there's nothing the player can do about it except change the moa count.

### The second answer: let them live

The game's current answer, switched on by `emergentEagles: true`, deletes the controller and gives each eagle a life. You've seen half of it: an eagle that doesn't eat starves. Here's the other half, reproduction.

```javascript
_tryReproduce(simulation) {
  if (!this.mature || this.reproCooldown > 0) return;
  if (!this.isFemale) return;

  const wellFed = this.maxHunger * 0.45;
  if (this.hunger > wellFed) return;                 // must be fed

  const eagleN = simulation.countAliveEagles();
  if (eagleN >= cap) return;                          // hard cap

  const moaN = simulation.getMoaPopulation();
  if (moaN <= 0) return;

  // ... must have a mature male within eagleMateRadius ...
  if (!hasMate) return;

  const ratio = M.eagleTargetRatio ?? (1 / 6);
  const targetEagles = moaN * ratio;

  let pressure = 1 - (eagleN / targetEagles);
  if (pressure <= 0) return;
  if (pressure > 1) pressure = 1;

  const fed = 1 - (this.hunger / wellFed);            // 0..1
  const base = M.eagleReproChance ?? 0.5;
  const p = base * pressure * this.reproDrive * (0.5 + 0.5 * fed);

  if (random() < p) {
    const egg = simulation.addEgg(this.nest.x, this.nest.y);
    egg.offspringType = 'eagle';
    // ...
    this.reproCooldown = M.eagleReproCooldown ?? 2600;
    this.hunger = Math.min(this.maxHunger, this.hunger + 25);
  }
}
```

Guard clauses first: a mature, fed female, under the cap, with a male nearby. Then the interesting part.

`eagleTargetRatio` is one eagle per six moa by default. With 30 moa, the target is 5 eagles. `pressure` measures how far below target the eagles are, as a number from 0 to 1:

| Moa | Eagles | Target | Pressure |
|---|---|---|---|
| 30 | 1 | 5 | 0.8 |
| 30 | 3 | 5 | 0.4 |
| 30 | 5 | 5 | 0 |
| 30 | 6 | 5 | below 0: no breeding |
| 12 | 3 | 2 | below 0: no breeding |

The chance of laying is a product of four factors: a base chance, the pressure, how well fed this bird is, and `reproDrive`, a random number between 0.6 and 1.4 fixed for each eagle at birth (personality again, so that not all eagles breed alike).

Read the last row of the table. The moa have crashed to 12. Three eagles is now too many. Pressure is negative, so no eagle breeds. Meanwhile three eagles are trying to live on prey that can feed two. One of them will fail to find a meal in time and starve. Nobody removed it. It ran out of food.

Then the moa recover, the target rises above the eagle count, pressure goes positive, and a well-fed female lays.

### Why this is better

The behaviour looks similar from a distance: eagle numbers follow moa numbers. The difference is where the cause lives.

Under the controller, the link between moa and eagles was a line of arithmetic. Under the emergent model the link is the food chain itself. Fewer moa means eagles catch less, means they starve. That gives the player a hundred ways to affect it. Hide the moa under shelters and the eagles go hungry though the moa are plentiful. Let the herd sprawl in the open and the eagles thrive. The eagle population has become something you *play against* instead of a difficulty setting.

It also produces dynamics nobody scripted. Predators lag their prey. The moa boom in spring; the eagles, who need time to lay, hatch and mature, peak in summer; the moa crash in winter; the eagles starve back in the following months. Those out-of-step waves are the signature of a predator-prey system. Lotka and Volterra wrote equations for them a century ago. Here they appear because each bird is keeping its own accounts.

The cost is that an emergent system is harder to control. You can't set the number of eagles. You can only set the conditions (the ratio, the hunger rate, the starve timeout) and observe what number results. Tuning is slower, and occasionally the system does something you didn't want, like going extinct. I'd still say it's the single most valuable idea in this codebase:

> Where you can, replace a rule that sets an outcome with individual needs that produce it.

And notice that the designers kept one hand on the wheel. `eagleTargetRatio` is still there. It no longer *sets* the count. It shapes one bird's willingness to breed. The comment in the level file calls it "the main knob". A good emergent system still gives its designer a dial; the dial just acts on a cause, not on the result.

### Restraint

One more piece closes the loop. If there are more eagles than the ratio allows, each one becomes more patient:

```javascript
let _huntThresh = this.huntThreshold;
if (this.emergent) {
  const _target = _moaN * (_M.eagleTargetRatio ?? (1 / 6));
  if (_target > 0 && _eagleN > _target) {
    const _over = _eagleN / _target;
    _huntThresh += Math.min((_over - 1) * (_M.eagleOverhuntRestraint ?? 30), _M.eagleRestraintCap ?? 45);
  }
}
```

With too many eagles for the moa, the hunger level at which an eagle starts hunting rises. They tolerate more hunger before going after prey. That sounds like mercy; in effect it's the opposite for the eagles. They hunt later, so they spend longer near the starvation threshold, and the surplus birds die off *without first eating the last of the herd*.

It was added to prevent a specific collapse: moa numbers dip, the eagles (not yet starved) keep killing at the old rate, the moa are wiped out, and then the eagles starve too. Everything dies. A predator that eats its prey to extinction eats itself to extinction, and in a model with no restraint that outcome is common. Real ecosystems avoid it through things like prey refuges and predators switching food. The game has both of those as well (shelter, and eagles taking birds when moa are scarce) and this as a direct damper.

### Exercise 9.3

Simulate predators and prey as two numbers, no agents. Each frame:

```javascript
const born = prey * 0.02;
const eaten = prey * pred * 0.0005;
const starved = pred * 0.01;
const hatched = eaten * 0.2;
prey += born - eaten;
pred += hatched - starved;
```

Plot both. You should see waves, with the predators' peaks trailing the prey's. Then add a "refuge": prey below 20 can't be eaten. Then add a prey carrying capacity as in Exercise 8.3. Which changes make the waves die down, and which make them grow until something hits zero?

## Territory

A few last details give eagles a sense of place.

Under the emergent model each eagle has a `nest`, a fixed point. It patrols around it and returns to it after a kill. A founder's nest is placed near prey at the start of the level:

```javascript
_assignEagleNest(eagle, x, y) {
  let cx = x, cy = y;
  const prey = this.getClosestMoa(x, y, 600);
  if (prey) {
    const near = this.findWalkablePositionNear(prey.pos.x, prey.pos.y, 70);
    cx = near.x; cy = near.y;
  }
  eagle.nest.set(cx, cy);
  eagle.patrolCenter.set(cx, cy);
}
```

If a hunt search times out with nothing found, an emergent eagle looks much further afield (900 units) for moa or their nesting sites, and if it finds any, it *moves its territory there*. So when the moa migrate downhill in autumn, the eagles follow a little later. Again nobody scripted "eagles follow the migration". Each bird, failing to find food, moved toward where food was.

Eagles pair up (`_refreshPartner`), and a relocating eagle drags its partner's nest along, because a female needs a male within 250 units to lay, and a pair that drifted apart would stop breeding.

A level starts with one eagle and one egg of the opposite sex in a crag nearby. The first eagle hunts alone for thirty seconds; then its mate hatches, and the population can grow from there. It's a gentle opening, and it gives the game a small event early on.

## Summary

- The eagle is a `Boid` with different numbers: faster, more agile, longer sight, and a large separation distance that spreads eagles into territories.
- Its states are mostly timers checked in priority order with early returns: set the timer to enter the state.
- Patrol steers toward a point moving round a circle. Any path can be followed by seeking a point that moves along it.
- Target choice is a scored loop. Shelter and camouflage are filters; rare species are penalised so predation falls on the common.
- Pursuit aims at `target.pos + target.vel * lead`.
- A wind-up and a grace period exist for the player's sake. Fairness sometimes outranks realism.
- Roll dice once at the moment of decision, not every frame.
- `(-dy, dx)` is perpendicular to `(dx, dy)`. A perpendicular force makes an orbit.
- An energy budget: hunger rises, a kill pays it off, sustained high hunger kills.
- The old controller set eagle numbers from outside. The emergent model lets each bird starve or breed, with breeding pressure pulled toward a target ratio. Eagle numbers then follow moa numbers through the food chain itself, with a lag.
- Restraint when over the ratio stops surplus predators from finishing off the prey.

## The Mauri Project

See the predator-prey cycle, then break it and mend it.

1. Extend your population chart lens from Chapter 8 to plot two lines: moa (`getMoaPopulation()`) and eagles (`countAliveEagles()`, scaled up by 6 so the lines are comparable). Run Level 1 or 2 on fast-forward for several years. Do the eagle peaks trail the moa peaks? By how long?
2. Add a second lens that draws, for each eagle: a circle for its `huntRadius`, a line to its `target` if it has one, its `patrolCenter` as a small cross, and its hunger as text. Watch a full hunt from lock-on to rest.
3. In your sandbox level's `mechanics`, set `emergentEagles: true` and try `eagleTargetRatio` at `1/3`, `1/6` and `1/12`. For each, note the typical eagle count and whether the moa survive three years.
4. Remove the restraint: set `eagleOverhuntRestraint: 0`. Run several games. How often does everything die? Put it back.
5. Change the lead. In `hunt`, the prediction uses `* 12` twice. Try `0` and `40`. Use your lens to watch how the approach changes. Which is deadlier?
6. Stretch: make eagles prefer juveniles. In the target loop, multiply `eff` by 0.5 if `moa.isJuvenile()`. Predict what it will do to moa population growth before you run it. Were you right? Is it more fun?
