# Chapter 2: Vectors, Forces and the Boid

> Mā te huruhuru ka rere te manu.
>
> Adorn the bird with feathers so it may fly.
> — whakataukī

In Chapter 1 the simulation called two methods on every animal: `behave`, then `update`. This chapter is about `update`, and about the small kit of movements that `behave` is built from. All of it lives in one file, `mauri_boid.js`, in one class, `Boid`. Every animal in the game is a `Boid` underneath: `Moa extends Boid`, `HaastsEagle extends Boid`, `Kereru extends Boid`. Learn this class and you know how everything in the game gets from one place to another.

The word *boid* comes from Craig Reynolds, who in 1986 made a flock of "bird-oid objects" move convincingly using three small rules. The game uses his rules and several more of his ideas. If you have read Chapter 5 of *The Nature of Code*, much of this will be familiar, and I'll point out where the game does things differently and why.

## Three Vectors

A vector is a pair of numbers, `x` and `y`, treated as one thing. p5.js gives you `createVector(x, y)` to make one. It can mean a place ("120 across, 80 down") or an arrow ("3 to the right and 1 up, per frame").

Anything that moves smoothly needs three of them:

```javascript
class Boid {
  constructor(x, y, terrain) {
    this.pos = createVector(x, y);
    // Where it is.
    this.vel = createVector(random(-1, 1), random(-1, 1));
    // How far it moves each frame.
    this.acc = createVector(0, 0);
    // How much its velocity changes each frame.
    this.terrain = terrain;
    this.maxSpeed = 1;
    this.maxForce = 0.05;
  }
}
```

The relationship between them is the whole of the physics:

- each frame, **acceleration is added to velocity**;
- each frame, **velocity is added to position**.

You never set an animal's position directly to make it go somewhere. You push on it, by adding to its acceleration, and let those two additions carry the push through. That indirection is what makes movement look alive: a pushed thing speeds up gradually, overshoots a little, curves when it turns.

Here is the smallest version, as a sketch:

```javascript
let boid;

function setup() {
  createCanvas(640, 240);
  boid = {
    pos: createVector(100, 120),
    vel: createVector(0, 0),
    acc: createVector(0, 0)
  };
}

function draw() {
  background(255);

  boid.acc.set(0.02, 0);
  // A steady push to the right.

  boid.vel.add(boid.acc);
  boid.pos.add(boid.vel);
  boid.acc.mult(0);
  // Forces don't carry over: clear the push every frame.

  circle(boid.pos.x, boid.pos.y, 16);
}
```

The circle starts slowly and gets faster and faster. That last line, clearing the acceleration, matters. A force is something that is applied *this frame*. If you want it applied next frame too, apply it again.

## Applying Forces

In the game nobody writes to `acc` directly. They call:

```javascript
applyForce(force) {
  this.acc.x += force.x;
  this.acc.y += force.y;
}
```

It adds. That is the point: you can call it as many times as you like in one frame, and the pushes accumulate. A moa in a single frame might apply a pull toward a plant, a push away from its neighbours, a nudge away from a cliff and a turn back from the map's edge. Each of those is computed separately, by code that knows nothing of the others, and `acc` ends up holding their sum. The animal moves along the compromise.

This is how the game combines behaviours, everywhere. There is no code that says "if near a cliff *and* hungry *and* crowded, do this". There are only independent forces and addition.

## The Real update()

Here is `Boid.update` from the game, with the facing code removed (I'll return to it at the end of the chapter) and two lines condensed:

```javascript
update(dt = 1) {
  // Apply acceleration (scaled by dt)
  this.vel.x += this.acc.x * dt;
  this.vel.y += this.acc.y * dt;

  // Speed ramp: the effective cap eases toward maxSpeed instead of snapping.
  const targetMax = this.maxSpeed * this.personality.speedVariation;
  if (this._speedCap === null) this._speedCap = targetMax;
  this._speedCap += (targetMax - this._speedCap) * Math.min(1, 0.12 * dt);

  // Limit speed
  const maxSpd = this._speedCap;
  const spdSq = this.vel.x * this.vel.x + this.vel.y * this.vel.y;
  if (spdSq > maxSpd * maxSpd) {
    const invSpd = maxSpd / Math.sqrt(spdSq);
    this.vel.x *= invSpd;
    this.vel.y *= invSpd;
  }

  // Apply velocity (scaled by dt)
  this.pos.x += this.vel.x * dt;
  this.pos.y += this.vel.y * dt;

  // Reset acceleration
  this.acc.x = 0;
  this.acc.y = 0;

  // Keep it on the map
  const w = this.terrain.mapWidth - 5, h = this.terrain.mapHeight - 5;
  if (this.pos.x < 5) this.pos.x = 5; else if (this.pos.x > w) this.pos.x = w;
  if (this.pos.y < 5) this.pos.y = 5; else if (this.pos.y > h) this.pos.y = h;
}
```

It is the two additions from the sketch, plus four practical things.

**It multiplies by `dt`.** Both additions are scaled by the frame time, as Chapter 1 promised.

**It limits the speed.** Without a cap, a constant push makes the animal accelerate forever. `maxSpeed` is the animal's top speed in world units per frame. A moa's is about 0.15; an eagle on the hunt, 0.45. Those are small numbers because a "world unit" is a pixel of the unzoomed map and the camera magnifies it about two and a half times.

**The cap itself moves smoothly.** This is the `_speedCap` business. A moa's `maxSpeed` changes abruptly when its mood changes: 0.16 while grazing, 0.25 the instant it starts to flee. If the limit jumped, the animal's motion would jump. So the limit that is really enforced, `_speedCap`, chases `maxSpeed` a fraction at a time.

That one line is a pattern you'll see dozens of times in the game, so I want to name it:

```javascript
current += (target - current) * rate;
```

Every frame, close a fixed fraction of the remaining gap. It never overshoots, it starts fast and ends gently, and it needs no extra state. I'll call it **easing**. With `rate` at 0.12, the value covers 12% of the gap per frame: about half the distance in 5 frames, and most of it in 20.

**It writes `x` and `y` by hand.** The sketch used `boid.vel.add(boid.acc)`. The game writes `this.vel.x += this.acc.x * dt`. They do the same thing. The hand-written form avoids a function call and, more importantly, never creates a new vector. I'll come back to why that matters.

### Exercise 2.1

Change the sketch so the circle is pushed toward the mouse while the mouse is pressed, and has a top speed. You will need `p5.Vector.sub(target, pos)` to get an arrow from the boid to the mouse, `setMag()` to make it short, and `vel.limit()` for the cap.

## Steering: What an Animal Wants

A rock rolls downhill because gravity pushes on it. An animal walks to a plant because it wants to. Reynolds's insight was that you can model the wanting with a single subtraction:

> **steering force = desired velocity − current velocity**

The desired velocity is how the animal would be moving if it had already got its way: pointing straight at the plant, at top speed. The current velocity is how it's really moving. The difference between them is the correction it needs to make. Apply that correction as a force, a little each frame, and the animal turns toward what it wants.

Here is the game's `seekPoint`, the single most-used method in the codebase:

```javascript
seekPoint(tx, ty, urgency = 1, arriveRadius = 0) {
  const result = this._tempVec3;
  const dx = tx - this.pos.x;
  const dy = ty - this.pos.y;
  // An arrow from me to the target.

  let speed = this.maxSpeed * urgency;
  if (arriveRadius > 0) {
    const distSq = dx * dx + dy * dy;
    if (distSq < arriveRadius * arriveRadius) {
      speed *= Math.sqrt(distSq) / arriveRadius;
    }
  }

  result.set(dx, dy);
  result.setMag(speed);
  // Desired velocity: toward the target, at this speed.
  result.sub(this.vel);
  // Minus current velocity.
  result.limit(this.maxForce * urgency);
  // An animal can only turn so hard.

  return result;
}
```

Read the last four lines against the formula. `result.set(dx, dy); result.setMag(speed)` builds the desired velocity. `result.sub(this.vel)` subtracts the current one. What's left is the steering force. `limit(this.maxForce)` then caps how strong it can be.

`maxForce` is the animal's agility. A big `maxForce` means it can swing its velocity round in a few frames, like a fantail. A small one means it turns in wide arcs, like a heavy bird that has to lean into a corner. A moa's `maxForce` is 0.02 against a top speed of 0.16, so stopping from a walk takes it eight frames at the very least, and reversing takes sixteen. That sluggishness is a large part of why moa look like big animals.

Notice that `seekPoint` *returns* the force. It does not apply it. The caller decides what to do with it:

```javascript
this.applyForce(this.seek(this.targetPlant.pos, 0.8));
```

or scales it first:

```javascript
const w = this.wander();
w.mult(0.4);
this.applyForce(w);
```

Returning forces instead of applying them is what lets each behaviour be weighted. The numbers passed to `mult` in the animals' brains are the main tuning knobs for how they move.

### Urgency

The game adds something Reynolds's formula doesn't have: an `urgency` number that scales both the desired speed and the allowed force. An eagle closing on prey seeks with urgency 1.4. A moa settling back onto a food patch seeks with urgency 0.3. Same function, very different character. When you call `seek`, think of the second argument as "how much does it care?".

### Arrive

The `arriveRadius` argument solves a problem you'll have seen if you did Exercise 2.1: a thing that always wants to go at top speed toward a target flies straight past it, turns round, and flies past again, forever.

The cure is to want less speed as you get close. Inside the arrive radius, the desired speed is scaled down in proportion to the distance: at half the radius, half speed; at the target, zero. And when the desired velocity is zero, look at what the formula gives:

```
steering = 0 − current velocity
```

A force pointing exactly opposite to the way you're moving. It's a brake. The comment in the source says so: *at speed 0 this becomes a pure braking force*. The same subtraction that turns the animal also stops it.

The game uses arrival wherever something needs to settle: an eagle returning to its nest after a kill (`this.seek(this.patrolCenter, 0.2, 45)`), a bird landing on a tree, a moa easing onto a food patch. If you see something in the game jittering back and forth across a point, the usual cause is a seek with no arrive radius.

### Exercise 2.2

Make a sketch with a `Boid` that has `seekPoint` and `update` as above (you can leave out `dt` and the speed easing). Have it seek the mouse. Try `maxForce` values of 0.01, 0.05 and 0.5. Then add an arrive radius of 80 and watch what changes when it reaches the mouse.

### Flee

Fleeing is seeking, backwards, with two additions:

```javascript
fleePoint(tx, ty, radius = 100) {
  const result = this._tempVec1;
  const dx = this.pos.x - tx;
  const dy = this.pos.y - ty;
  // Note the order: an arrow from the threat to me.
  const distSq = dx * dx + dy * dy;

  if (distSq < radius * radius && distSq > 0.0001) {
    const d = Math.sqrt(distSq);
    const urgency = 1 - (d / radius);
    // 0 at the edge of the radius, 1 when the threat is on top of me.
    const speed = this.maxSpeed * (1 + urgency);

    result.set(dx, dy);
    result.setMag(speed);
    result.sub(this.vel);
    result.limit(this.maxForce * 2);
    return result;
  }

  result.set(0, 0);
  return result;
}
```

First, it only acts inside a radius. Outside it the function returns a zero vector, which when applied does nothing. This is Reynolds's first principle of an autonomous agent: it has a *limited* ability to perceive. A moa does not know about an eagle on the far side of the map.

Second, the closer the threat, the faster the animal wants to go, up to double its normal top speed, and it's allowed twice its normal turning force. Panic makes it nimbler. This "closer means stronger" shape, `1 - d / radius`, is worth memorising. It turns a distance into a number that is 0 at the edge of a circle and 1 at its centre, and the game uses it for fear, for attraction, for disturbance, for fading things out.

One detail: `distSq > 0.0001`. If the threat is at exactly the same position as the animal, the arrow between them has zero length and no direction. `setMag` on a zero vector gives nonsense. The guard skips that case. Whenever you compute a direction by subtracting two positions, ask what happens when they're equal.

## Wander

An animal with nothing to do should not stand still, and it should not walk in a straight line either. It should amble.

The obvious approach is to add a random push each frame:

```javascript
this.applyForce(p5.Vector.random2D().mult(0.02));
```

Try it and you get a thing that vibrates. Sixty random pushes a second in sixty unrelated directions cancel each other out. What you want is randomness that changes *slowly*, so that this frame's direction is nearly the same as last frame's.

p5.js has a function for exactly that: `noise()`. Give it a number and it gives back a value between 0 and 1. Give it a slightly different number and it gives back a slightly different value. Walk the input along slowly and the output drifts up and down like a hilly horizon. That is Perlin noise, and Chapter 4 builds mountains out of it. Here it steers a moa:

```javascript
wander(dt = 1) {
  this.wanderTime += 0.008 * dt;
  // Walk slowly along the noise.

  const result = this._tempVec1;

  if (this.vel.x * this.vel.x + this.vel.y * this.vel.y > 0.0001) {
    this._wanderHeading = Math.atan2(this.vel.y, this.vel.x);
  }
  // The direction I'm facing, as an angle.

  const drift = noise(this.noiseOffset, this.wanderTime) * 2 - 1;
  // -1..1, changing smoothly.
  const angle = this._wanderHeading + drift * 1.75;
  // Up to about 100 degrees left or right of where I'm heading.
  const mag = this.maxForce * this.personality.wanderStrength;

  result.set(Math.cos(angle) * mag, Math.sin(angle) * mag);
  return result;
}
```

Three things to take from this.

**`Math.atan2(y, x)`** converts an arrow into an angle. `Math.cos(angle)` and `Math.sin(angle)` convert an angle back into an arrow of length 1. You'll use this pair constantly: go to angles when you want to turn something, go back to `x` and `y` when you want to move it.

**The wander is relative to the current heading.** The noise doesn't pick a compass direction. It picks "a bit left" or "a bit right" of wherever the animal is already going. That keeps the path a meander instead of a scribble.

**`noiseOffset` makes each animal different.** `noise()` is a fixed landscape: the same input always gives the same output. If every moa read `noise(wanderTime)`, they would all turn left at the same moment. So each boid gets a random `noiseOffset` when it's made, and reads its own row of the noise.

The same idea gives each animal a little character:

```javascript
this.personality = {
  wanderStrength: 0.8 + random() * 0.4,
  speedVariation: 0.9 + random() * 0.2,
  turniness: 0.8 + random() * 0.4
};
```

Three random multipliers near 1, fixed for life. One moa is a slightly faster walker; another meanders more. It costs three numbers per animal and it stops a herd looking like copies.

### Exercise 2.3

Write `wander` two ways in a sketch: once with `random2D()` each frame, once with `noise()` as above. Draw a trail behind each boid (don't clear the background). Compare the paths.

## Flocking: Separation, Alignment, Cohesion

Reynolds's three rules each look at the animal's neighbours and produce one steering force.

- **Separation**: steer away from neighbours that are too close.
- **Alignment**: steer to match the average heading of neighbours.
- **Cohesion**: steer toward the average position of neighbours.

`Boid` has all three. In practice the game leans almost entirely on separation, because moa are loose grazers, not a tight school of fish. Alignment and cohesion are there for you to use.

Separation is the interesting one:

```javascript
separate(nearbyBoids) {
  const force = this._steeringVec;
  force.set(0, 0);

  let count = 0;
  const sepDistSq = this.separationDistSq;
  const px = this.pos.x;
  const py = this.pos.y;

  for (let i = 0, len = nearbyBoids.length; i < len; i++) {
    const other = nearbyBoids[i];
    if (!other.alive || other === this) continue;
    // Skip the dead, and skip myself.

    const dx = px - other.pos.x;
    const dy = py - other.pos.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < sepDistSq && distSq > 0.0001) {
      const invDistSq = 1 / distSq;
      force.x += dx * invDistSq;
      force.y += dy * invDistSq;
      // An arrow away from them, stronger the closer they are.
      count++;
    }
  }

  if (count > 0) {
    force.x /= count;
    force.y /= count;
    force.setMag(this.maxSpeed);
    force.sub(this.vel);
    force.limit(this.maxForce);
    // The usual: desired minus current, capped.
  }

  return force;
}
```

For each neighbour inside the separation distance, it adds an arrow pointing away from that neighbour. Then it averages the arrows, treats the result as a desired velocity, and finishes with the standard subtract-and-limit.

The weighting is the subtle part. The arrow `(dx, dy)` has a length equal to the distance `d`. Dividing by `d²` leaves an arrow of length `1/d`. So a neighbour 2 units away contributes an arrow of length 0.5, and a neighbour 20 units away contributes 0.05. Near things matter far more than distant ones, which is how personal space feels.

Note `other === this`. The list of neighbours includes the animal itself, because it's in the same list as everybody else. Without that check it would try to flee from itself, at distance zero.

### Squared distances

You'll have noticed `distSq`, `sepDistSq`, `perceptionRadiusSq`. The distance between two points is `Math.sqrt(dx*dx + dy*dy)`. Square roots are slow compared with multiplication, and these loops run for every pair of nearby animals every frame. But to answer "is this closer than 25 units?" you don't need the distance. You can compare the *squared* distance against 25 squared, 625, and get the same answer. So the game stores every radius twice, plain and squared, and compares squares. It takes the square root only when it needs the real distance for something, as `fleePoint` does for its urgency.

When you add a radius to an animal, add its square next to it, and keep them in step. There's a comment in the eagle's constructor shouting about exactly this: `// UPDATE SQUARED VALUES WITH RADIUS VALUES`.

## Staying on Walkable Ground

A moa cannot walk on water, scree or snow. The terrain can answer `isWalkable(x, y)` for any point (Chapter 4). `avoidUnwalkable` uses that to produce a force:

```javascript
avoidUnwalkable() {
  const result = this._steeringVec;
  result.set(0, 0);

  const lookAhead = 12;
  // ... work out the unit direction of travel ...
  const futureX = this.pos.x + velX * invVelMag * lookAhead;
  const futureY = this.pos.y + velY * invVelMag * lookAhead;
  // The point 12 units ahead of me.

  if (!this.terrain.isWalkable(futureX, futureY)) {
    let bestDot = -2;
    let bestAngle = 0;
    const currentHeading = Math.atan2(velY, velX);

    for (let i = 0; i < 12; i++) {
      const a = this._avoidAngles[i];
      // 0°, 30°, 60° ... 330° from my heading.
      const testAngle = currentHeading + a;
      const testX = this.pos.x + Math.cos(testAngle) * lookAhead;
      const testY = this.pos.y + Math.sin(testAngle) * lookAhead;

      if (this.terrain.isWalkable(testX, testY)) {
        const dot = Math.cos(a);
        // 1 = straight ahead, -1 = straight behind.
        if (dot > bestDot) { bestDot = dot; bestAngle = testAngle; }
      }
    }

    if (bestDot > -2) {
      result.set(Math.cos(bestAngle) * this.maxForce * 2,
                 Math.sin(bestAngle) * this.maxForce * 2);
    } else {
      // Nowhere is walkable: go back the way I came.
      result.set(-velX * invVelMag * this.maxForce * 3,
                 -velY * invVelMag * this.maxForce * 3);
    }
  }

  return result;
}
```

It looks a short way ahead along its direction of travel. If that spot is fine, it does nothing. If it isn't, it feels around in twelve directions like a cane, and steers toward the walkable one that is closest to where it was already going. `Math.cos(a)` is the measure of "closest to straight ahead": the cosine of an angle is 1 at 0° and falls to −1 at 180°.

This is a deliberately simple kind of obstacle avoidance. It has no memory and no map. It handles coastlines and the edges of scree well. It cannot find its way round a long ridge, because every probe on the far side of the ridge fails and it just bounces along the near side. Chapter 14 shows what the game does when a moa really must get round a mountain: real pathfinding.

There is also `edges()`, which pushes an animal back when it comes within 25 units of the map's border. Unlike everything else in this chapter it writes to `acc` directly, with a strong fixed force, because leaving the map is not negotiable.

### Exercise 2.4

In your sketch, define `isWalkable(x, y)` as "not inside a circle at the centre of the canvas". Give your boid `wander`, `avoidUnwalkable` and `edges`. Watch it for a minute. Then make the obstacle a long thin rectangle and see where the approach fails.

## Don't Make New Vectors

Look back at the methods in this chapter. Every one starts with something like:

```javascript
const result = this._tempVec3;
```

and the constructor has:

```javascript
this._steeringVec = createVector();
this._tempVec1 = createVector();
this._tempVec2 = createVector();
this._tempVec3 = createVector();
```

*The Nature of Code* writes `seek` like this:

```javascript
let desired = p5.Vector.sub(target, this.position);   // makes a new vector
desired.setMag(this.maxspeed);
let steer = p5.Vector.sub(desired, this.velocity);    // makes another
```

That's clear, and it creates two new objects per call. With 60 animals each computing half a dozen forces 60 times a second, that's tens of thousands of short-lived objects a second. JavaScript cleans them up automatically, with a process called **garbage collection**, and garbage collection occasionally pauses everything for a few milliseconds. You see it as a stutter.

So the game allocates four scratch vectors per boid, once, and every steering method writes its answer into one of them.

This has a sharp edge, and it will cut you eventually. The vector a method returns is only good until that method (or another that shares the same scratch vector) is called again. Look:

```javascript
const a = this.fleePoint(x1, y1);   // returns this._tempVec1
const b = this.wander();            // ALSO writes this._tempVec1
this.applyForce(a);                 // a now holds the wander force!
```

`fleePoint`, `wander` and `align` all use `_tempVec1`. `seekPoint` uses `_tempVec3`, and `cohesion` calls `seekPoint`. `separate` and `avoidUnwalkable` share `_steeringVec`.

The safe habit, which the game's code follows, is to **apply a force straight away, before asking for another one**:

```javascript
this.applyForce(this.fleePoint(x1, y1));
const w = this.wander(); w.mult(0.4); this.applyForce(w);
```

If you need to keep a force around, copy it into a vector of your own. `Moa` does this: it has `_tempForce`, `_returnForce` and `_homeForce` for the forces it computes itself.

### Exercise 2.5

In your sketch, write `seekPoint` both ways: with `p5.Vector.sub` creating new vectors, and with a reused scratch vector. Then deliberately write the bug above (get two forces, then apply both) and watch what the boid does.

## Facing: A Lesson in Hysteresis

One last piece of `update`, which I skipped. Moa are drawn from the side, as sprites that face left or right. Which way should the sprite face? The obvious answer: right if `vel.x > 0`, left otherwise.

Try that, and a grazing moa, whose velocity is nearly zero and wobbling, flips left-right-left-right many times a second. It looks broken.

The game's fix has three layers, and each is a general technique:

```javascript
updateFacing(dt = 1) {
  const FLIP_VX_EASE = 0.06;
  const FACE_GATE_X  = 0.045;
  const FLIP_SPEED   = 0.14;
  const MOVE_GATE_SQ = 0.0025;

  const vx = this.vel.x, vy = this.vel.y;
  const moving = (vx * vx + vy * vy) > MOVE_GATE_SQ;

  this._flipVx += (vx - this._flipVx) * Math.min(1, FLIP_VX_EASE * dt);
  // 1. Smooth the input: an eased copy of vel.x.

  if (moving) {
    if (this._flipVx > FACE_GATE_X) this._faceDir = 1;
    else if (this._flipVx < -FACE_GATE_X) this._faceDir = -1;
    // 2. Two thresholds with a dead zone between them.
  }

  this._flip += (this._faceDir - this._flip) * Math.min(1, FLIP_SPEED * dt);
  // 3. Smooth the output: ease toward the chosen facing.
}
```

**Smooth the input.** `_flipVx` is an eased copy of the horizontal velocity. Quick wobbles average out; a sustained walk to the left shows through.

**Use two thresholds.** To face right, the smoothed velocity must exceed +0.045. To face left it must go below −0.045. Between those, nothing changes: the animal keeps facing whichever way it last chose. This gap is called **hysteresis**. It's how a thermostat avoids clicking on and off every second: turn the heating on below 18°, off above 20°, and in between leave it alone. Whenever you turn a wobbly number into a yes/no decision, a single threshold will chatter and two thresholds won't. Chapter 7 uses the same trick to stop a moa dithering about whether it's hungry.

**Smooth the output.** `_flip` eases from −1 to +1 instead of jumping. The renderer scales the sprite horizontally by `_flip`, so as it passes through zero the sprite squashes edge-on and opens out mirrored, which reads as the bird turning round.

## Summary

- Every animal is a `Boid` with `pos`, `vel` and `acc`. `update(dt)` adds acceleration to velocity and velocity to position, caps the speed, and clears the acceleration.
- Behaviours never set position. They return **forces**, which the caller scales and passes to `applyForce`. Forces add up.
- Steering force = desired velocity − current velocity, limited to `maxForce`.
- `seekPoint` goes to a point; `urgency` scales how hard; `arriveRadius` slows it to a stop.
- `fleePoint` is seek reversed, inside a radius, stronger when closer.
- `wander` uses `noise()` to drift the heading smoothly.
- `separate` averages arrows away from close neighbours, weighted by 1/distance.
- `avoidUnwalkable` probes ahead and steers to the nearest open direction.
- Compare squared distances; store radii squared.
- Steering methods reuse scratch vectors. Apply a force before asking for the next.
- `current += (target − current) × rate` eases anything toward anything.
- Two thresholds, not one, when a noisy number drives a decision.

## The Mauri Project

Give the moa a visible sense of direction, then change how they move.

1. Open `mauri_moa.js` and find `renderIndicators`. At its end, add code that draws a short line from `this.pos` in the direction of `this.vel`, 400 times the velocity's length (velocities are tiny). Use `stroke`, `strokeWeight(0.5)` and `line`. Run the game and watch the lines. You should see them swing when an eagle approaches.
2. In `mauri_species_data.js`, find `upland_moa` and its `maxForce: 0.02`. Change it to `0.2`, reload, and watch a herd. Then try `0.004`. Put it back. Write down, in a sentence each, how the two extremes felt.
3. In `mauri_boid.js`, `wander` multiplies the noise drift by `1.75`. Try `0.3` and `4`. What does an idle moa do in each case? Why does a large value make it turn in tight circles?
4. Harder: moa never use `align` or `cohesion`. In `Moa.executeState`, find the `default:` (idle) case. Add a weak cohesion force there: `const c = this.cohesion(moas); c.mult(0.3); this.applyForce(c);`. Mind the scratch-vector rule: look at which vector `cohesion` returns and which the lines around it use. Does the herd hold together more? Does it cause any trouble at food patches?
