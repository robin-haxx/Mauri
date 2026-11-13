# Chapter 14: Stories on a Simulation

> He manu hou ahau, he pī ka rere.
>
> I am a new bird, a fledgling just learning to fly.
> — whakataukī

*Builds on Chapters 7, 9, 12 and 13.*

Chapter 13 ended on a tension. A simulation does what it does. A lesson needs particular things to happen, at particular times, in front of a player who has never seen the game before. A new player should watch an eagle hunt, be told what a storm is for, and be given a moment to use one. An ecosystem left to itself might show them that in ten seconds or in ten minutes, or the eagle might catch the moa before the first sentence has finished.

This chapter is about the three layers the game puts on top of its simulation to tell the player things and to shape what happens. They go from lightest to heaviest.

1. **Tips**: the simulation announces what happens, and a tutorial listens and speaks.
2. **Directors**: a script takes over particular animals and walks them through a planned story.
3. **Chapters**: a script that never touches an animal, and instead frames, measures and narrates a free-running world, stepping in only when it must.

Along the way you'll meet three techniques that are useful far beyond this game: an event system, a pathfinding algorithm, and a small language written as data.

## Part One: Events

### The problem of who knows what

When a moa lays the first egg of the game, several things should happen. A tip should appear explaining eggs. A sound might play. A goal counter might tick. A story might want to say something.

The moa could do all that itself:

```javascript
layEgg() {
  // ... lay the egg ...
  tutorial.showTip('first_egg');
  goals.increment('eggs');
  story.onEggLaid(this);
}
```

Now `Moa` has to know about the tutorial, the goals and the story. Every time a new system wants to hear about eggs, you edit `Moa`. And every one of the dozen other things that can happen in the simulation needs the same treatment. The animal code fills up with calls to systems that have nothing to do with being an animal.

The cure is to turn it round. The moa doesn't call anyone. It **announces** that something happened, and whoever is interested listens.

```javascript
simulation.game.tutorial.fireEvent(TUTORIAL_EVENTS.EGG_LAID, { egg, speciesKey: this.speciesKey });
```

An event has a name and a bundle of data. The moa fires it and carries on. It has no idea who, if anyone, is listening. This is called the **observer** pattern, or publish-subscribe, and it's the standard way to let parts of a program react to each other without knowing about each other.

The names are in `mauri_tutorial.js`:

```javascript
const TUTORIAL_EVENTS = {
  GAME_START: 'game_start',
  EAGLE_HUNTING: 'eagle_hunting',
  MOA_KILLED: 'moa_killed',
  SEASON_CHANGE: 'season_change',
  EGG_LAID: 'egg_laid',
  EGG_HATCHED: 'egg_hatched',
  PLACEMENT: 'placement',
  PLACEABLE_EXPIRED: 'placeable_expired',
  NEST_RAID: 'nest_raid',
  BIRD_HATCHED: 'bird_hatched',
  BIRD_KILLED: 'bird_killed',
  // ...
};
```

That list is, in effect, the simulation's public vocabulary: the things it's willing to tell the outside world about. You've seen where most of them are fired. `handleEagleCatch` fires `MOA_KILLED`. `updateEggs` fires `EGG_HATCHED`. `tryPlace` fires `PLACEMENT`. `HaastsEagle.hunt` fires `EAGLE_HUNTING` at a fresh lock-on.

Go back to Chapter 9 for a moment. The eagle code took care to fire the hunt event *once* per hunt, on a real new lock, and not every frame it had a target. Now you can see why that mattered. An event should mean "this just happened". If it fires sixty times a second, every listener has to work out for itself which firing was the real one.

In this game the tutorial manager doubles as the event hub, which is why everything calls `tutorial.fireEvent`. A larger project would have a separate event bus. The idea is the same.

### Tips: data that waits for a trigger

A tip is a row of data, and by now that shouldn't surprise you. Here's the first tip of Level 1, from `levels/tutorial_01_kahurangi.js`:

```javascript
welcome: {
  id: 'welcome',
  trigger: { type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.GAME_START },
  title: "Kia ora! And welcome to the glacial Alps.",
  content: [
    "I'm Te Whē, the mantis, and I will be your guide!",
    "Your role in Avian Age is to become a responsible kaitiaki of our ancient land."
  ],
  guidePosition: 'center',
  nextTip: 'goal_intro',
  pauseGame: true,
  showOnce: true,
  priority: 0
},
```

Words, where to show them, and a **trigger**: the condition under which it appears. There are four kinds.

| Trigger | Fires when | Example |
|---|---|---|
| `EVENT` | a named event happens (optionally filtered by a `condition` function) | "an eagle starts hunting" |
| `TIME` | so many frames have passed since the level started | "30 seconds in, mention the seasons" |
| `CONDITION` | a function, polled twice a second, returns true | "mauri has dropped below 20" |
| `IMMEDIATE` | another tip names it as `nextTip` | the second page of an explanation |

Events are for things that happen at an instant. Conditions are for states of the world that become true gradually and that nobody announces. Between them they cover nearly everything, and the distinction comes back later in this chapter in a sharper form.

The manager's handling of an event is a loop over the tips:

```javascript
_checkEventTriggers(eventType, data) {
  for (const tipId in this.tips) {
    const tip = this.tips[tipId];
    if (this._shouldSkipTip(tipId, tip)) continue;
    if (tip.trigger.type !== TRIGGER_TYPE.EVENT || tip.trigger.event !== eventType) continue;
    if (tip.trigger.minGameTime && this.game.playTime < tip.trigger.minGameTime) continue;
    if (tip.trigger.condition && !tip.trigger.condition(this.game, data)) continue;
    this._queueTip(tipId, data);
  }
}
```

Guard clauses, then into a queue. The tip isn't shown at once.

### The queue

Things happen in bursts. An eagle strikes, a moa dies, mauri runs low, the season turns, all within a few seconds. If each tip appeared the instant it triggered, the player would be buried.

So triggered tips wait in `pendingTips`, and `update` releases one at a time, with a minimum gap between them:

```javascript
if (this.pendingTips.length > 0) {
  const head = this.pendingTips[0];
  const isUrgent = head.tip && head.tip.urgency === 'high';
  if (isUrgent || this.game.playTime - this.lastTipTime >= this.minTimeBetweenTips) {
    const queued = this.pendingTips.shift();
    if (this._tipAffordable(queued.tip)) this._showTip(queued.id, queued.data);
  }
}
```

A **queue** is a line: first in, first out. `push` adds to the back, `shift` takes from the front. Queues are how you turn a bursty stream of requests into an orderly one. You'll want one for notifications, sounds, animations, anything where several things can ask at once and only one should happen at a time.

Two refinements show the thought that's gone into it. Tips marked `urgency: 'high'` skip the spacing, with a comment explaining that the simulation keeps running while a tip waits, so *making an urgent one sit out the gap lets the very thing it warns about resolve unseen*. And a tip about a tool is dropped if the player can no longer afford that tool by the time its turn comes. There's no point telling someone to place a shelter they can't pay for.

Many tips pause the game (`pauseGame: true`). That's the tutorial reaching into the game's state machine from Chapter 1 and setting `PAUSED`, which is the simplest possible way to guarantee the player has time to read.

### Exercise 14.1

Write a tiny event bus in a sketch: an object with `on(name, fn)` that stores listeners in a `Map` of arrays, and `fire(name, data)` that calls each listener for that name. Make a ball bounce and fire `'bounce'` with its speed. Add three independent listeners: one counts bounces, one flashes the background, one prints when the speed drops below 1. Then delete one listener and confirm the ball's code didn't need to change.

## Part Two: Directors

The story levels in the menu's first section follow one moa family through a year. A mother, a father and a chick spend summer at a nest, walk down to a tarn in autumn along a line of storms, winter by the water, and walk home in spring, while an eagle threatens at set moments.

That is a plot, and an ecosystem doesn't produce plots on request. So for these levels a **director** takes over. The code is `ModuleDirector`, `MoaLife` and `EagleLife` in `mauri_module.js`.

### The hook

How do you script one moa without rewriting `Moa`? Chapter 7 showed the answer, the first line of `behave`:

```javascript
behave(simulation, mauri, seasonManager, dt = 1) {
  if (this.lifeScript) { this.lifeScript.behave(simulation, mauri, seasonManager, dt); return; }
  // ... the whole ordinary moa mind ...
}
```

If a moa has a `lifeScript`, the script's `behave` runs and the moa's own never does. One line, and the entire scripted-story system hangs from it. Wild moa don't have the property and are unaffected.

That's a **hook** in the sense of Chapter 10: a place where the normal flow offers itself to be replaced. It's also about the least intrusive way one large system can be attached to another. The file's header is explicit that this was the aim: the story code is kept apart from everything else, with one-line hooks into `Moa.behave` and `HaastsEagle.behave`.

### Puppets with real legs

A `MoaLife` is the brain that replaces the moa's own. The director gives it orders through a handful of methods:

```javascript
stay(x, y, radius = 8)   { this.mode = 'stay'; this._setSpot(x, y); this.radius = radius; }
graze(x, y, radius = 24) { this.mode = 'graze'; this._setSpot(x, y); this.radius = radius; }
goTo(x, y, speed = 1)    { this.mode = 'go'; this._setSpot(x, y); this.speed = speed; }
follow(leader, gap = 10) { this.mode = 'follow'; this.leader = leader; this.gap = gap; }
walkRoute(route, speed = 1, grazeRadius = 20) { /* ... */ }
```

Stay here. Graze there. Go to that point. Follow her. Walk this route. Each one just records an intention: a `mode` and its parameters. Then, every frame, `MoaLife.behave` carries out whatever the current mode is:

```javascript
} else if (mode === 'go') {
  m.maxSpeed = base * this.speed;
  this._travel(this.spot.x, this.spot.y, 0.9, 12, dt);
} else if (mode === 'follow') {
  const L = this.leader;
  if (L && L.alive) {
    m.maxSpeed = base * Math.max(0.6, leadSpeed * 1.15);
    const d = Math.hypot(L.pos.x - m.pos.x, L.pos.y - m.pos.y);
    if (d > this.gap) this._travel(L.pos.x, L.pos.y, 0.9, this.gap, dt);
    else { const w = m.wander(); w.mult(0.1); m.applyForce(w); }
  }
}
```

and `_travel` comes down to:

```javascript
m.applyForce(m.seekPoint(tx, ty, strength, ar));
```

Here's the point I want you to see. The scripted moa is still a `Boid`. It still moves by steering forces: `seekPoint`, `wander`, `avoidUnwalkable`, `edges`. It still gets hungry and eats. It's slowed by slopes. What's been replaced is only the *deciding*. The director says where to go; the moa's own body gets it there.

That's why scripted moa don't look scripted. They don't slide along rails. They amble, curve around obstacles, lag and catch up, because the same physics from Chapter 2 is carrying them. If you ever script characters in a game of your own, this is the way to do it: give orders at the level of intentions and let the character's ordinary movement system carry them out.

The `follow` mode gives you a family that walks in a line. The father follows the mother, the chick follows the father, each a little faster than the one ahead so it can catch up, each easing off at a set gap. A line of followers, each with only a local rule, is itself a small emergent thing.

### The director's clock

`ModuleDirector` is a state machine over the year. Its `update` dispatches on the stage:

```javascript
this.stageTime += dt;
// ...
if (this.stage === 'summer') this._updateSummer();
else if (this.stage === 'autumn') this._updateAutumn();
else if (this.stage === 'winter') this._updateWinter();
else if (this.stage === 'spring') this._updateSpring();
this._updateJourney(dt);
this._updateChase(dt);
```

Each stage method watches for its moments (the egg hatching, the family reaching the tarn) and issues orders when they come.

One mechanism here is worth understanding, because it resolves a real conflict. Seasons run on a clock. A story runs on events. What if autumn is due to end and the family hasn't reached the tarn?

```javascript
seasonStep(dt) {
  // ...
  const holdAt = this.cfg.holdSeasonAt * CONFIG.seasonDuration;
  // ...
  if (!this._seasonMustWait()) return dt;
  return Math.max(0, Math.min(dt, holdAt - sm.timer));
}
```

In Chapter 1's frame order, the game asked the story how much to advance the season clock:

```javascript
const _seasonDt = this.module ? this.module.seasonStep(dt) : /* ... */ dt;
if (this.seasonManager.update(_seasonDt)) this.onSeasonChange();
```

Normally the story says "`dt`, as usual". But if a key moment hasn't happened yet, it lets the season advance only up to a hold point and then returns 0. The season stands still, at 90% through, until the family arrives. The moa, the plants and the eagle all keep running on the full `dt`. Only the calendar waits.

It's a neat trick. The story bends time for one system without stopping the world, by intercepting the single number that system runs on. You can do that only because of two earlier decisions: everything takes `dt` as a parameter, and each system is updated by one clearly-placed call.

### Finding a way: A*

In autumn the family has to walk from the nest to the tarn, perhaps 200 units, across terrain with scree, ice and water in it. Chapter 2's `avoidUnwalkable` can feel its way round a small obstacle. It can't find its way round a mountain. For that you need to *plan* a route before setting off, and that's **pathfinding**.

The game's pathfinder is `ModuleDirector._findPath`. It uses the most famous algorithm in game programming, called A* (say "A star"). I'll build up to it.

Lay a coarse grid over the map and mark each cell walkable or not. A route is a chain of neighbouring walkable cells from the start to the goal. You want the cheapest chain.

The simplest search spreads out from the start like a ripple, visiting all cells one step away, then all cells two steps away, and so on until it reaches the goal. That's flood fill from Chapter 4, and it works, but it wastes effort exploring in every direction, including directly away from where you want to go.

A* adds one idea. For each cell on the frontier, estimate the *total* cost of a route through it:

```
total estimate = cost so far to reach this cell + a guess at the cost from here to the goal
```

and always explore the cell with the lowest total estimate next. The guess is called the **heuristic**. The straight-line distance to the goal is the usual choice: you can't do better than a straight line, so it never overestimates. With that guess pulling it, the search heads toward the goal and only spreads sideways when something blocks the way.

Here's the heart of the game's version:

```javascript
const heur = (i) => Math.hypot((i % cols) - gc, ((i / cols) | 0) - gr);
// Straight-line distance, in cells, from cell i to the goal.

const cost = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1);
const closed = new Uint8Array(N), open = new _ModuleHeap();
cost[start] = 0;
open.push(heur(start), start);

while (open.size) {
  const cur = open.pop();
  // The frontier cell with the lowest total estimate.
  if (closed[cur]) continue;
  closed[cur] = 1;
  if (cur === goal) break;

  const cc = cur % cols, cr = (cur / cols) | 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = cc + dc, nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const n = nr * cols + nc;
      if (!ok[n] || closed[n]) continue;

      const len = (dr && dc) ? 1.414 : 1;
      const slope = Math.abs(G.elev[n] - G.elev[cur]) * 60;
      const c = cost[cur] + len * (1 + slope + (G.nearWall[n] ? 0.6 : 0));
      // Cost so far, plus the cost of this step.

      if (c < cost[n]) { cost[n] = c; came[n] = cur; open.push(c + heur(n), n); }
      // A cheaper way to reach n: remember it, and how we got there.
    }
  }
}
```

Every piece is something you've met.

- Cells are indices into flat arrays; `i % cols` and `(i / cols) | 0` recover the column and row (Chapter 3).
- `cost[n]` is the cheapest known cost to reach each cell, starting at `Infinity`: the "world record" idea, one record per cell.
- `came[n]` records which cell each was reached from. When the goal is found, following `came` backwards from the goal gives the route in reverse.
- It looks at eight neighbours. A diagonal step costs 1.414, the square root of 2, because it's that much longer.

And look at the cost of a step: `len * (1 + slope + nearWall)`. It isn't just distance. A step that changes elevation costs more, steeply. A step beside impassable ground costs more. So the "cheapest" route isn't the shortest. It's the one that prefers gentle ground and keeps away from cliff edges. **The cost function is where a pathfinder's character lives.** Want routes that keep to the forest? Add a cost for leaving it. Routes that avoid eagles? Add a cost near them. The algorithm doesn't change.

Before any of this, the function checks whether the start and goal are on the same land region (Chapter 4's flood fill). If they aren't, no route exists and searching the whole map to discover that would be wasted work. That check was added after the bug in `MISTAKES.md` where moa walked for ever at goals across a ridge.

### The heap

A* needs, over and over, "the frontier cell with the lowest estimate". Scanning the whole frontier each time would be slow. `_ModuleHeap` is a **priority queue**: a structure where you can add items with a priority and remove the lowest-priority one, both quickly.

```javascript
push(p, v) {
  const P = this.pri, V = this.val;
  let i = V.length;
  P.push(p); V.push(v);
  while (i > 0) {
    const up = (i - 1) >> 1;
    if (P[up] <= P[i]) break;
    [P[up], P[i]] = [P[i], P[up]];
    [V[up], V[i]] = [V[i], V[up]];
    i = up;
  }
}
```

It's a **binary heap**: a tree stored in a flat array, where the item at index `i` has its parent at `(i - 1) >> 1` and its children at `2i + 1` and `2i + 2`. (`>> 1` is a bit shift, a fast whole-number halving.) The rule of the heap is that every parent is no larger than its children, so the smallest is always at index 0. To add, put the new item at the end and swap it upward while it's smaller than its parent. To remove the smallest, take index 0, move the last item there, and swap it downward.

`[a, b] = [b, a]` swaps two values in one line, using the destructuring from Chapter 12.

You don't need to memorise how a heap works. You need to know that it exists, what it's for, and that this is one you can copy when you need a priority queue.

### Smoothing

A route from a grid is a staircase of cell centres. A moa following it would walk in visible zig-zags. `_smoothPath` rounds it off with **Chaikin's algorithm**, which is a delight:

```javascript
for (let pass = 0; pass < 2; pass++) {   // Chaikin corner-cutting
  const q = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
    q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
  }
  q.push(p[p.length - 1]);
  p = q;
}
```

For each segment of the path, replace it with two points: one a quarter of the way along, one three-quarters. (Those are lerps at 0.25 and 0.75, written out.) Every sharp corner gets cut off. Do it again and the new, smaller corners get cut off too. Two passes and a staircase is a curve.

### Following the route

To walk a route, a moa keeps an index into the list of points and seeks the current one. When it's within 12 units, it moves the index on:

```javascript
while (r && this.routeIdx < r.length - 1 &&
       Math.hypot(r[this.routeIdx].x - m.pos.x, r[this.routeIdx].y - m.pos.y) < 12) this.routeIdx++;
const p = r[Math.min(this.routeIdx, r.length - 1)];
this._travel(p.x, p.y, 0.9, 12, dt);
```

It's the "seek a moving target" idea from the eagle's patrol in Chapter 9. Here the target hops from waypoint to waypoint as the moa approaches each. The planning is A*; the walking is still `seekPoint`.

And scripted moa have the watchdog, in a grander form. `_watchProgress` measures whether the moa is closing on its goal. If it stalls for about four seconds, `_planDetour` runs A* from where it stands, and the moa follows that route round the obstacle before carrying on. Simple steering most of the time, and proper planning when the simple thing demonstrably isn't working: that's a very practical division of labour, since A* is far too expensive to run for every animal every frame.

### Exercise 14.2

Implement A* on a 30 × 20 grid in a sketch. Click to toggle walls. Draw the path, and tint the cells that were explored (`closed`). Then replace the heuristic with `0` and see how much more gets explored. That version is Dijkstra's algorithm. Then multiply the heuristic by 5 and see what happens to the path's quality.

### Exercise 14.3

Draw a jagged polyline with the mouse and apply Chaikin's algorithm 0, 1, 2 and 4 times, drawing each result. What happens if you use 0.5 and 0.5 instead of 0.25 and 0.75?

### What scripting costs

The director gives the story levels exactly what they need: a reliable, readable sequence for a first-time player. Count what it took, though. `mauri_module.js` is 2,600 lines for one lesson, with two more files of similar size for the next two. The family doesn't forage, flee or breed by the rules of Chapters 7 and 8. They have their own simplified versions, written again inside `MoaLife`. That means two sets of behaviour to maintain, and the story levels found none of the foraging bugs that wild moa had, because story moa weren't running that code.

And the player's choices in a scripted level matter only where the script allows. That's the trade. The more you script, the more reliable the experience and the less of the simulation the player is really touching.

## Part Three: Chapters

The third layer is the game's attempt to get the reliability of a story without giving up the simulation. It's `ChapterRunner` in `mauri_chapters.js`, and its header states the rule it lives by:

> The runner never steers an animal or stages an outcome.

Instead it does three things: it **frames** play (which tools are available, which species matter), **measures** it (goals that test what the simulation did), and **narrates** it (words that answer the simulation's events). The moa and eagles in a chapters level are ordinary ones running the full minds of Chapters 7 to 9.

### A level written as a script

A chapters level adds a `chapters` list to an ordinary level definition. Here's one chapter from `levels/chapters_prototype.js`, trimmed:

```javascript
{ id: 'winter', title: "Winter: the lean months",
  tools: ['speargrass', 'shelter', 'waterhole'],
  mechanics: { eagleTargetRatio: 1 / 7 },    // hungrier eagles: more of them for each moa
  start: [
    { say: [['guide', "Winter takes the goodness out of the tussock. A WATERHOLE slows a moa's hunger: grow one where the flock shelters."]] }
  ],
  goals: [
    { id: 'water',   name: "Grow a waterhole", done: { placed: 'waterhole' }, reward: 10 },
    { id: 'hold3',   name: "Keep {target} upland moa through winter", keep: { count: ['upland_moa', '>=', 3] },
      required: true, failReason: "Too few upland moa came through the winter." },
    { id: 'through', name: "Come through the winter", survive: true, reward: 25 }
  ],
  next: [[{ count: ['upland_moa', '>=', 8] }, 'spring_thrive'], [true, 'spring_rebuild']]
},
```

Read it as a description. When winter opens, the toolbar offers these three tools. The eagles get more numerous, by way of the knob from Chapter 9. The guide says a line. There are three goals: place a waterhole; never drop below three upland moa (and losing that one loses the level); get to the end. Then, if there are eight or more moa, go to the chapter called `spring_thrive`; otherwise `spring_rebuild`.

Nothing in there moves a moa. Every lever it pulls is one of the simulation's own: the toolbar, a mechanics flag. Whether the flock comes through the winter is decided by the plants, the eagles and the player.

Compare the goals to Chapter 12's. There, a goal's test was a JavaScript function:

```javascript
condition: (sim) => sim.getSpeciesCount('upland_moa') >= 3
```

Here it's data:

```javascript
keep: { count: ['upland_moa', '>=', 3] }
```

That's a further step along the road Chapter 12 started down. The condition isn't code. It's a description of a condition, in a small made-up language whose words are `count`, `gained`, `placed`, `season`, `after`, `any`, `all`, `not` and a couple of dozen more.

### A little language

Why invent a language when JavaScript was right there? Three reasons, and they're good ones.

- **It can be checked.** A function is opaque: you can't tell whether it's sensible without running it. Data can be inspected. The engine can look at `{ count: ['upland_mao', '>=', 3] }` when the level loads and say "`upland_mao` isn't a species in this level". A typo in a function would fail silently, mid-game, in winter.
- **It can be understood by the engine.** From `{ count: ['upland_moa', '>=', 8] }` the engine can work out a progress readout ("Upland moa: 5/8") by itself, because it can see the species and the target. It can't see inside a function.
- **It's limited on purpose.** A level author can only say things the vocabulary allows. That keeps levels readable and stops a level from reaching into the engine's insides.

A small special-purpose language like this is called a **domain-specific language**, or DSL. Building one sounds grand. Here's how it's done.

Each word of the vocabulary is an entry in a table. The entry is a function that takes the word's argument and *returns a test function*:

```javascript
const CHAPTER_OPS = {
  '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b,
  '<': (a, b) => a < b, '==': (a, b) => a === b, '!=': (a, b) => a !== b
};

const CHAPTER_CONDITIONS = {
  count:   ([who, op, n]) => (x) => CHAPTER_OPS[op](x.runner.countOf(who), n),
  placed:  (type) => (x) => x.runner.gained('placed:' + type, x.scope) >= 1,
  season:  (keys) => (x) => [].concat(keys).includes(x.game.seasonManager.currentKey),
  after:   (sec) => (x) => x.runner.scopeTime(x.scope) >= sec * CHAPTER_FPS,
  // ...
  any:     (list, c) => { const fs = list.map(s => c.compile(s)); return (x) => fs.some(f => f(x)); },
  all:     (list, c) => { const fs = list.map(s => c.compile(s)); return (x) => fs.every(f => f(x)); },
  not:     (sub, c) => { const f = c.compile(sub); return (x) => !f(x); }
};
```

Look closely at `count`. It has two arrows:

```javascript
([who, op, n]) => (x) => CHAPTER_OPS[op](x.runner.countOf(who), n)
```

It's a function that returns a function. The outer one runs once, when the level loads, and receives `['upland_moa', '>=', 3]`. It hands back the inner one, which remembers those three values (a closure, as in Chapter 12) and which will be called over and over during play, each time with the current state of the game as `x`, returning true or false.

Even the comparison operator is data. `'>='` is a string, looked up in `CHAPTER_OPS` to get a real comparing function. That's the table-of-functions idea again: when you need to choose behaviour by name, put the behaviours in an object keyed by name.

The `compile` method turns a whole condition object into a single test:

```javascript
compile(cond) {
  if (cond == null) return () => false;
  if (cond === true) return () => true;
  if (typeof cond === 'function') return (x) => !!cond(x);
  // ...
  const parts = [];
  for (const key of Object.keys(cond)) {
    const make = CHAPTER_CONDITIONS[key];
    if (!make) { this._issue(`unknown condition "${key}"`); parts.push(() => false); continue; }
    // ... argument checks ...
    parts.push(make(cond[key], this));
  }
  return parts.length === 1 ? parts[0] : (x) => parts.every(f => f(x));
}
```

For each key in the object, look up the word, build its test, and collect them. An object with several keys means "all of these". An unknown word is reported and treated as false.

And notice `any`, `all` and `not`. Their arguments are themselves conditions, so they call `c.compile` on each. Recursion again: a condition can contain conditions, to any depth.

```javascript
until: { any: [{ placed: 'shelter' }, { hidden: '$target' }, { not: { alive: '$target' } }] }
```

"Until a shelter has been placed, or the hunted moa is hidden, or it's no longer alive."

Doing this translation once at load time, instead of interpreting the data afresh every frame, is called **compiling**. During play the engine just calls ready-made functions. And all the checking happens at load, when every problem can be gathered into a list and shown to the author before the level has run a frame. `ChapterRunner.validate(levelDef)` does exactly that, and Chapter 16 shows how to run it on every level from the command line.

Notice the escape hatch on the third line: a condition may still be a plain function. A good DSL covers the common cases cleanly and leaves a way out for the rare one it didn't foresee.

### Reactions

Words in a chapters level are **reactions**: things said when something happens.

```javascript
{ id: 'first_hunt', on: 'eagle_hunting', if: { focus: true },
  unlock: 'shelter',
  say: [['guide', "The Pouākai is hunting an upland moa! Under a FERN SHELTER a moa is hidden from its eyes.",
          { lit: ['$target', '$eagle'] }]],
  banner: { words: ["Grow a FERN SHELTER over the hunted moa", "Tap beside the moa to grow the SHELTER"],
            tool: 'shelter', until: { any: [{ placed: 'shelter' }, { hidden: '$target' }, { not: { alive: '$target' } }] } } },
```

`on: 'eagle_hunting'` names an event from Part One. `if` filters it: only when the hunted moa is a focus species. Then the actions: unlock the shelter tool, say a line, show a banner until one of three things is true.

This is the event system put to its fullest use. The eagle fires `EAGLE_HUNTING` whenever it locks on, as it always did. In a chapters level the runner is listening, through one added line at the top of `fireEvent`:

```javascript
fireEvent(eventType, data = {}) {
  if (this.game.chapters) this.game.chapters.onEvent(eventType, data);
  // ... the tips, as before ...
}
```

The eagle's code didn't change. A whole new storytelling system was plugged in by adding a listener. That's the payoff for having the simulation announce things instead of calling things.

The `$target` and `$eagle` are **roles**: placeholders filled in from the event's data. The line doesn't know which moa will be hunted. It's written about "the hunted one", and the runner fills that in when it happens. The story is authored without knowing the specifics, because the specifics will be decided by the simulation.

There are also reactions with `when` instead of `on`. Those are polled, like `CONDITION` tips, for things that become true without an event: "the flock has dropped to three".

### Events are counted; states are sampled

The runner checks goals and polled conditions every six frames, not every frame. That's a throttle, and it's fine for most things. But it opened a trap, and a comment in the prototype level records it:

```javascript
// The beat is done on the hunt EVENT (a count in the beat's own scope), not on the polled
// state `hunting: true`: an eagle's lock can drop between polls, and in one headless run the
// state read false at every poll after a real hunt, so the beat was wrongly logged as forced
```

A condition like `hunting: true` asks about the world *right now*. If the eagle locked on and lost its target within five frames, between two polls, nobody saw it. The hunt happened and the story missed it.

An event can't be missed. When `eagle_hunting` fires, the runner adds one to a counter, immediately:

```javascript
_count(ev) {
  const spec = CHAPTER_EVENTS[ev.name];
  if (!spec || !spec.count) return;
  const add = (k) => { this.counters[k] = (this.counters[k] || 0) + 1; };
  add(spec.count);
  const sp = this.subjectSpecies(ev);
  if (sp) add(`${spec.count}:${sp}`);
  // ...
}
```

and the condition `gained: ['hunts:upland_moa', '>=', 1]` asks whether that counter has gone up since the chapter began. However brief the hunt, the count is there to be read at the next poll.

This is a principle well beyond this game:

> To know whether something **happened**, count events. To know how things **are**, sample state. Never sample state to detect a happening.

The engine enforces it. Its validator knows which condition words read the momentary state of the world (`CHAPTER_STATE_KEYS`) and warns if a beat's completion relies only on those.

### Guaranteed beats

Now the mechanism Chapter 13 promised. A lesson needs the eagle's first hunt to happen during summer, so the shelter can be taught. In an emergent world it might not.

```javascript
beats: [
  { id: 'hunt_comes', when: { after: 8 },
    invite: [{ eagle: { watch: 'grazing', hunger: 55 } }],
    until: { gained: ['hunts:upland_moa', '>=', 1] },
    by: 30, force: [{ aim: { at: ['matriarch', 'upland_moa'] } }] }
],
```

A **beat** has five parts.

- `when`: start eight seconds into the chapter.
- `invite`: set conditions that make the event likely. Here: move the eagles' patrol over the flock's grazing ground and make them hungry. Those are ecological levers. Nothing is being made to happen. The odds are being tilted.
- `until`: the beat is done when an upland moa has been hunted.
- `by`: a deadline of 30 seconds.
- `force`: if the deadline passes, make it happen. `aim` tells the nearest eagle to hunt a particular moa.

The logic in `_updateBeats`:

```javascript
if (s.phase === 'waiting') {
  if (b.when && !b.when(this._ctx())) continue;
  s.phase = 'running';
  s.t0 = now;
  this._run(b.invite, null);
}
if (b.until && b.until(this._ctx(null, s.scope))) this._beatDone(s);
else if (!s.forced && b.by != null && now - s.t0 >= b.by) {
  s.forced = true;
  this._log('beat', b.id, 'forced');
  this._run(b.force, null);
}
```

A small state machine per beat: waiting, running, done. Invite when it starts. If the event comes naturally, done. If the clock runs out first, force it, and record that it was forced.

Think about what this gets you. Most of the time, in most games, the eagle comes of its own accord because the invitation worked, and the moment is a real event in a live simulation. The player's response to it is real too. Occasionally the world doesn't oblige, and a script quietly steps in so that the lesson still happens. The player can't tell the difference. And the author gets a log saying, for every run, which beats came naturally and which had to be forced, so they can tune the invitation until forcing is rare.

Even the forced version respects the simulation. `aim` sets a preference on the eagle's ordinary hunting; it doesn't teleport anything. And the eagle is still blind to a moa under cover: `// It's still blind to it under cover`, says the eagle's code. So the tool the player is being taught still works against a forced attack. The script never breaks the rules the lesson is about.

This is the "lightest top-down correction" of Chapter 13, turned into a format: **invite with the world's own levers; force with a script only at a deadline; log which it was**. If you take one design idea from this chapter into your own projects, take that one.

The runner's vocabulary is organised around this very split. Its actions come in two labelled tables: `CHAPTER_SCRIPT_TOOLS` (say, banner, place, spawn, aim: deterministic things a script does) and `CHAPTER_ECOLOGY_TOOLS` (focus, protect, mechanics, eagle pressure: levers on the simulation whose outcome the simulation decides). When you write a chapters level, the question to keep asking is which toolbox you're reaching into, and whether the ecological one would do.

### Moments

One scripted flourish. When something worth marking happens (a nest founded, a first chick), the runner can play a **moment**: the world freezes, the camera eases in on the spot, big words appear, and then it eases back and play resumes. You saw its hook as the first lines of `Game.update`:

```javascript
const _moment = this._storyMoment();
if (_moment) { _moment.updateMoment(dt); return; }
```

While a moment is playing, `update` returns before the simulation runs. The world is held still, without setting `PAUSED`, by simply not calling it. The camera keeps moving, because the camera is advanced in `render` on real frames. Chapter 15 covers that camera.

### Branching

A chapter ends, by default, when the season does. Its `next` field says where to go:

```javascript
next: [[{ count: ['upland_moa', '>=', 8] }, 'spring_thrive'], [true, 'spring_rebuild']]
```

A list of `[condition, chapter]` pairs, tried in order. The first whose condition holds wins. `true` as a condition always holds, so the last pair is the fallback. It's the priority cascade from Chapter 7 again, as data.

So the story has two different springs, and which you get depends on how your winter went. The simulation's outcome steers the narrative. That's the reverse of scripting, where the narrative steers the outcome.

## Free Play's Year Engine

The third structure is the lightest touch of all. Free Play has no story. It has a rhythm, run by `Game._beginFreeplayYear` and its helpers.

Each in-game year, the engine picks a **focus**: one or two species the year is about. It sets goals for them, swaps the toolbar to tools that suit them, pans the camera to the next quarter of the world, and raises the pressure a notch (the eagle ratio and the climate from Chapters 5 and 9). Non-focus species are quietly protected from extinction for the year; the focus species are not, and losing one ends the run.

It's the same ecosystem every year, with a different spotlight. Nothing is scripted and nothing is forced. But "this year, look after the kea" gives the player a reason to learn a different corner of the simulation each time round.

That's the emergence dial at its far end: a structure made of nothing but attention, tools and goals.

## Choosing a Layer

| | Tips | Director | Chapters | Year engine |
|---|---|---|---|---|
| Touches the animals? | No | Replaces their minds | No | No |
| Outcome decided by | Simulation | Script | Simulation, with deadlines | Simulation |
| Reliable for teaching? | Somewhat | Very | Mostly | No |
| Player's choices matter? | Fully | Where allowed | Fully | Fully |
| Cost to author | Low | Very high | Medium | Low |

If you add teaching or story to the game, start at the left of that table and move right only as far as you must. A tip costs an afternoon. A director costs months.

## Summary

- The simulation fires named events with data; listeners react. The firer doesn't know who's listening.
- An event should fire once, when the thing happens.
- Tips are data with a trigger (event, time, polled condition, or chained). Triggered tips queue and are shown one at a time.
- A director scripts chosen animals through a one-line hook, `lifeScript`. It gives orders as intentions; the animal's own steering carries them out.
- A story can hold the season clock by controlling the `dt` that the season manager is given.
- A* finds a cheap route on a grid by always exploring the cell with the lowest (cost so far + straight-line guess). The step cost encodes preferences such as gentle slopes.
- A binary heap gives fast "lowest first". Chaikin's corner-cutting smooths a path. A route is followed by seeking successive waypoints.
- Scripting buys reliability and costs a second copy of the behaviour and much of the player's agency.
- A chapters level frames, measures and narrates a free-running simulation. Its conditions are a small language: data compiled at load into test functions, which lets the engine validate them.
- Count events to detect happenings; sample state to read conditions.
- A guaranteed beat invites an event with ecological levers and forces it only at a deadline, logging which.
- Chapters branch on outcomes. Free Play structures play with focus, tools and goals alone.

## The Mauri Project

Tell a small story three ways.

1. **A tip.** In `levels/tutorial_01_kahurangi.js`, add a tip that triggers on `TUTORIAL_EVENTS.EGG_HATCHED`, only once, only when the total moa count has just reached 10 or more (use a `condition: (game, data) => ...`). Give it a title and two lines. Don't pause the game. Play Level 1 until it appears.
2. **An event of your own.** Add `MOA_STARVED: 'moa_starved'` to `TUTORIAL_EVENTS`. Fire it from `Moa.behave` at the point where a moa dies of hunger, with `{ moa: this, speciesKey: this.speciesKey }`. Mind where you fire it: the moa has a reference to the simulation, and the simulation to the game. Add a tip that listens for it and suggests planting food. How do you stop it firing ten times in a hard winter? (Look at how other tips use `showOnce` and `cooldown`.)
3. **Pathfinding in the open.** Write a lens that, when you click, runs a small A* of your own from the first living moa to the clicked point, using `game.terrain.isWalkable` on an 8-unit grid, and draws the result. Compare the path it finds with the path the moa takes if you put food at that spot.
4. **A chapter.** Copy `levels/_template_chapters.js` (follow the steps in its header). Write a single chapter for autumn with: a tool list; one `done` goal using `gained`; one `keep` goal using `count`; a reaction `on: 'moa_killed'` that says a line; and a reaction with `when` and `for` that reminds the player of something after 20 seconds. Run `ChapterRunner.validate(LEVEL_REGISTRY.get('<your id>'))` in the console and fix what it reports. Then deliberately misspell a species key and validate again.
5. **A guaranteed beat.** In your chapter, add a beat that wants an egg to be laid within 40 seconds. What could you `invite` with? (Think: what makes moa breed, from Chapter 8? Which levers does the ecology toolbox offer?) What would `force` it? Play it five times and note from the log (press **D**, then **J**) how often it was forced. Then adjust the invitation to bring that number down.
6. Reflect: you've now told "a moa is in trouble; help it" as a tip, and as a chapter. Sketch on paper how you'd do it with a director. How much code would each version need? Which would a new player learn most from, and which would a returning player enjoy most?
