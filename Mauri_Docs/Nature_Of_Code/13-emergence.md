# Chapter 13: Emergence

> Ehara taku toa i te toa takitahi, engari he toa takitini.
>
> My strength is not that of one alone; it is the strength of many.
> — whakataukī

*Builds on everything so far. This is the chapter the others were for.*

Here is a list of things that happen in Mauri.

- In autumn, the moa walk downhill.
- Eagles hold territories.
- The eagle population rises a little after the moa population does, and falls a little after.
- A row of food patches becomes a path that a herd follows.
- Kea split themselves between berry caches according to how much food each holds.
- The treeline creeps down the mountain as winter comes.
- A species that drops to three or four animals tends to go on dropping.
- Putting a berry cache near a moa nest ends, some time later, with the eagles living somewhere else.

Now search the code for the function that makes moa walk downhill in autumn. You won't find one. There's no `migrateInAutumn()`, no `holdTerritory()`, no `followPath()`. Not one item on that list is written down anywhere in forty thousand lines.

Each of them is **emergent**: a pattern in the whole that comes from the rules of the parts, and that none of the parts was told about. This chapter is about how that works, how to think about it, how to design for it, and what to do when it goes wrong, which it will.

## Where the Behaviour Comes From

Take the first item and trace it properly. Why do moa go downhill in autumn?

1. The season table says that in winter, plants in the `subalpine` biome have a modifier of 0.1, and that moa prefer elevations from 0.18 to 0.42 (Chapter 5).
2. Those values blend in over the last part of autumn, because every season getter lerps toward the next season.
3. So plants high up grow back more slowly and are worth less when they do (Chapter 6).
4. A moa up there finds less food, so its `localFoodScore` drops and its hunger rises (Chapter 7).
5. Meanwhile its preferred band has slid down, so its elevation `err` has grown.
6. `shouldMigrate` returns true on either count.
7. It samples twenty random spots nearby and walks to the one whose elevation suits it best. That spot is lower.
8. It settles, rests, and if it's still unhappy does it again.

Eight steps across three files, and the word "autumn" appears in none of the moa's code. Each moa is solving its own small problem, here and now: *I'm hungry and uncomfortable; where nearby is better?* Sixty of them solving it at once, on a landscape whose food is draining downhill, is a migration.

Shiffman gives three conditions for a complex system, and the game meets each:

- **Simple units with short-range relationships.** A moa perceives about 100 units. It knows nothing of the map as a whole.
- **Units operating in parallel.** Every animal takes its turn, every frame, with no coordinator.
- **The whole shows patterns the units don't contain.** Migration, territories, cycles.

To those I'd add the thing that makes a *game* of it: the player is one more influence in the mix, with no more authority than the weather.

Here's the list again, with what produces each item:

| What you see | What's in the code |
|---|---|
| Autumn migration | Seasonal plant modifiers + a preferred band + sampling nearby spots |
| Eagle territories | Separation with a 100-unit radius, applied at double strength |
| Predators lagging prey | Eagles starve and breed individually; breeding and maturing take time |
| Food corridors | Attraction that seeks from outside and coasts across from inside |
| Kea sharing caches | A score of food divided by crowd |
| A moving treeline | Each tree comparing its fixed elevation with a sliding band |
| Small populations collapsing | Mating needs two animals to find each other |
| The kea cascade | Raids leave a disturbance field; moa avoid it; eagles follow moa nests |

On the left, things you'd describe to a friend. On the right, things that are a few lines each. The gap between the two columns is what "emergent gameplay" means.

## Thinking in Loops

How do you reason about a system like this, where everything affects everything? One animal at a time is too fine a grain. The tool for the larger view is the **feedback loop**.

A feedback loop exists whenever a change in something travels round a chain of causes and comes back to affect the thing that changed. There are exactly two kinds, and telling them apart is the most useful skill in this chapter.

### Balancing loops

More moa eat more plants. Fewer plants mean hungrier moa. Hungry moa don't breed, and some starve. So: fewer moa.

```
        (+)
  moa ───────► plants eaten
   ▲                │
   │ (−)            │ (+)
   │                ▼
 births ◄────── moa hunger
        (−)
```

Follow a disturbance round it. Suppose the moa population jumps. More plants are eaten, hunger rises, births fall and deaths rise, and the population comes back down. Now suppose it dips: fewer plants eaten, hunger falls, births rise, the population comes back up.

Whichever way you push it, the loop pushes back. That's a **balancing loop** (engineers say negative feedback). It seeks a level and holds it. A thermostat is one. So is your own hunger. Balancing loops are what make a system *stable*.

You can spot one by counting. Go round the loop, and at each arrow ask whether the two things move the same way (+) or opposite ways (−). An odd number of minus signs means balancing.

The game is full of them, and you've met them all:

- Plants limit moa (Chapter 6, 7).
- The soft breeding cap (Chapter 8).
- Eagles limit moa; moa limit eagles (Chapter 9).
- Hatch rewards that shrink as the herd grows (Chapter 11).
- Seed dispersal's density gate (Chapter 6).

### Reinforcing loops

Kererū eat fruit and drop seeds. Seeds become trees. Trees bear fruit. More fruit feeds more kererū.

```
          (+)
  birds ───────► seeds dropped
    ▲                 │
    │ (+)             │ (+)
    │                 ▼
  fruit ◄────────── trees
          (+)
```

No minus signs. Push it up and it goes up further. Push it down and it goes down further. That's a **reinforcing loop** (positive feedback), and it amplifies whatever is happening. Compound interest is one. So is a microphone squealing next to its own speaker.

Reinforcing loops are what make a system *move*: grow, collapse, tip. In the game:

- Birds and forest (Chapter 10).
- Mauri: a thriving herd earns mauri, mauri buys food, food makes the herd thrive (Chapter 11).
- Starvation: a starving moa moves at 60% speed, so it reaches food later, so it starves more (Chapter 7).
- The Allee effect: fewer moa find fewer mates, so fewer chicks, so fewer moa (Chapter 8).

Notice that the last two are reinforcing loops running *downward*. "Positive feedback" doesn't mean good. It means self-amplifying, in whichever direction it's already going. A reinforcing loop going the wrong way has a familiar name: a vicious circle. A death spiral.

### Every reinforcing loop needs a balancing partner

A reinforcing loop on its own runs to infinity or to zero. In a real system something always stops it, and in a simulation you have to supply that something.

Look at how each of the game's reinforcing loops is fenced:

| Reinforcing loop | What stops it |
|---|---|
| Birds ↔ forest | A local density gate and a total plant cap |
| Mauri ↔ herd | Diminishing hatch rewards, saturating income, a floor under balance |
| Starving ↔ slow | A starving moa searches a wider radius and takes the nearest real meal |
| Few moa ↔ few mates | Sex-balanced hatchlings, wider mate search near food, the player |

This is a design rule I'd pin above the desk:

> When you add something that feeds on its own success, add the thing that limits it in the same sitting.

Chapter 6 said it about seeds. It's true of economies, populations, power-ups and anything else that can snowball.

### Exercise 13.1

For each of these, say whether it's balancing or reinforcing, and count the minus signs to check: (a) a moa's security meter and an eagle's presence; (b) the eagle's `pressure` term in `_tryReproduce`; (c) the kea's food-per-bird score; (d) passive income and the size of the herd, below 10 moa; (e) the same, above 20 moa.

## Delay Makes Waves

A balancing loop seeks a level. Whether it settles there or swings back and forth past it depends on one thing: how long the loop takes to respond.

Think of a shower with a long pipe. The water's cold, so you turn it up. Nothing happens for a few seconds, so you turn it up more. Then the hot arrives, far too hot, and you turn it down, and overshoot the other way. The goal-seeking is fine. The **delay** between acting and feeling the result is what makes you oscillate.

The moa-eagle loop has delays all through it:

- An eagle that's stopped finding food doesn't die at once. It starves for 15 to 40 seconds first.
- A well-fed female doesn't produce a hunter at once. She lays on a cooldown, the egg incubates, and the eaglet takes 1,500 frames to mature.

So when the moa population rises, eagle numbers respond late. By the time the new eagles are hunting, the moa may already have peaked. The eagles then drive the moa down, further than "balanced", because there are now too many eagles for the prey that's left. Then the eagles starve, late again, and the moa rebound into a world with few predators.

```
population
   │    moa
   │   ╱╲          ╱╲
   │  ╱  ╲        ╱  ╲
   │ ╱    ╲  ____╱    ╲
   │╱   ___╲╱          ╲___
   │ __╱  eagles ╲___╱
   └──────────────────────────► time
       eagles peak after moa do
```

That's the predator-prey cycle from Chapter 9, and now you can see what causes it: a balancing loop with a delay. If you did Exercise 9.3 you saw the waves come out of two lines of arithmetic.

This gives you something to *do* when a simulation oscillates more wildly than you want. You have two choices. Shorten the delay, so the correction arrives sooner. Or weaken the response, so that each correction is smaller. The eagles' "restraint" from Chapter 9 is the second kind: when there are too many eagles, each hunts less eagerly, which damps the overshoot.

It also tells you where *not* to look. You can stare at the eagle's hunting code for a week and not find the cause of a boom-and-bust cycle, because it isn't in the hunting. It's in the shape of the loop.

## Small Causes, Large Effects

In a simple system, effects are in proportion to causes. Push twice as hard and it moves twice as far. Emergent systems aren't like that, and the proverb at the head of Chapter 9 says how: the grub is small, and it fells the tree.

**Thresholds.** A moa at hunger 34 is idle. At 36 it's foraging. A two-point difference flips its whole behaviour. With sixty moa near the threshold, a small change in the hunger rate can flip them all.

**Tipping points.** In Chapter 8, a population above a certain size recovers and below it declines. Around that size, one eagle strike can be the difference between a herd of forty next year and none. The same event, on the other side of the line, would be forgotten in a minute.

**Compounding.** Chapter 6 showed nutrition as a product of four factors. A 20% change in each is a doubling overall.

What this means for you in practice:

- **Change one number at a time, and by a noticeable amount.** If you change three things and the game improves, you don't know which did it. If you nudge something by 5% and see no difference, you've learned nothing: try doubling or halving it first to find out whether it matters at all, then narrow in.
- **Test more than once.** The same settings give different games. One run that goes well proves little. Chapter 16 shows how to run ten with different random seeds and compare.
- **Expect surprises at the edges.** The interesting failures happen when populations are tiny, maps are small, or frame rates are low. Those are the cases to test deliberately.

## Designing for Emergence

You can't write an emergent behaviour directly. That's what the word means. But you can set things up so that good ones are likely. Looking back over the game, I can pull out eight habits that do most of the work. You've seen every one in context; here they are together.

**1. Give agents needs, not instructions.** The moa has hunger and a comfort band, not a route. The eagle has an energy budget, not a kill quota. Ask "what does this creature want?" and write that. Then the behaviour adapts to situations you never thought of, including whatever the player does.

**2. Limit what they can perceive.** Every query has a radius. Local knowledge gives local variety: two herds on different hillsides do different things. All-seeing agents all do the same thing.

**3. Let them act on the world, and react to the world.** The kea leaves a disturbance; the moa reads it. The moa eats a plant; the next moa finds it gone. When agents affect each other through shared surroundings instead of talking directly, you get chains of consequence for free. The fancy word for this is *stigmergy*, and ant trails are the classic case.

**4. Make state continuous.** A hunger that runs from 0 to 100, a winterness from 0 to 1, a forest band that slides. Smooth quantities give graded, varied responses. On-off switches make everyone do the same thing at the same instant.

**5. Combine by adding forces and multiplying factors.** Independent influences that sum or multiply can be reasoned about one at a time and still produce rich mixtures.

**6. Make individuals differ a little.** `personality`, `reproDrive`, a random part of every threshold and timer. Identical agents synchronise and look mechanical. A few percent of variation breaks that up.

**7. Limit growth locally.** The seed's density gate, the kea's crowding penalty, the moa's separation. A local limit makes things spread out and fill space. A global cap makes them stop.

**8. Keep the designer's hand on a cause, not a result.** `eagleTargetRatio` shapes each eagle's willingness to breed. It doesn't set the count. That keeps the system emergent and still tunable.

And one habit that belongs to games in particular:

**9. Cheat where chance would be unfair.** Sex-balanced hatchlings, the strike wind-up, protected last survivors. Small, quiet interventions at the few points where bad luck would end the game through no fault of the player.

### Top-down and bottom-up

Chapter 9 set two ways of running the eagle population side by side: a controller that sets the number, and individuals that produce it. The same choice comes up in every system you'll build, so it's worth stating plainly.

**Top-down**: decide the outcome and make it so. Predictable, easy to tune, easy to explain. Brittle when circumstances change, and the player can't interact with it, because there's nothing underneath to interact with.

**Bottom-up**: define the parts and their needs, and let the outcome arise. Adaptive, surprising, deep to play with. Harder to tune, and it can go somewhere you didn't want.

Neither is always right. This game is bottom-up at its core and uses top-down touches where it needs a guarantee. A level's hard population cap is top-down. So is a tutorial that needs an eagle to attack at a particular moment. Chapter 14 is entirely about putting top-down direction over a bottom-up world without killing what makes it alive.

A sound way to work: build bottom-up, find the places it fails you, and add the lightest top-down correction that fixes each. Not the reverse.

## The Traps

Emergent systems fail in characteristic ways. The repository keeps a file, `MISTAKES.md`, that records the ones this game has actually fallen into, each with its cause and the rule that came out of it. It's some of the most valuable reading in the project. Here are the families of failure, with the examples you've already met.

### Deadlock: forces that cancel

A chick hovers beside a parent on a food patch and starves. Separation pushes it away; seek pulls it in; they balance just short of the food (Chapter 7).

*The sign*: an animal standing still, or quivering, with a need it isn't meeting.
*The cure*: make one force yield as the need behind the other grows.

### The unreachable goal

A moa walks at a plant across a band of scree until it dies. A moa courts a mate on the far side of a ridge. A bird flees a storm toward a point that isn't any further from it.

*The sign*: an animal pacing an edge, or pressing into a corner.
*The cure*: a watchdog. Measure progress and give up without it. And where you can, don't choose unreachable goals in the first place: that's what the land regions of Chapter 4 are for.

The game's notes put the rule in bold, twice: **anything a bird walks at must be checked for progress, and dropped when there is none.**

### The hidden assumption about scale

This one is subtle and bit hard. Bird steering was written and tuned on Free Play's large map. Then a story level used a small window, 425 by 317 units, and the forest birds starved with trees all round them. `MISTAKES.md` lists three causes, and they share a root:

> Three steering rules written for Free Play's big map, each a trap in a small one.

The edge-avoidance margin was 60 units, which on a small map covered 95% of the forest. The storm-flush radius left almost nowhere to settle. A tree within 25 units of the border could never be reached, because the edge force was six times stronger than a bird's steering.

Nothing was wrong with any of those numbers *on the map they were tuned for*. Every constant in a simulation carries a silent assumption about the size of the world, the number of agents and the pace of time. When you reuse a system in a new setting, list its constants and ask of each: is this still sensible here?

### Frame dependence

A timer that counts frames instead of `dt`. Growth applied per update when updates aren't evenly spaced (Chapter 6). A behaviour gated on `frameCount` that stops working when a test harness steps the simulation without drawing. `MISTAKES.md` has that last one too: in a headless run, moa searched for food once and never again, because the back-off timer was waiting for a `frameCount` that never advanced.

*The cure*: time by `dt`, or by a counter you advance yourself.

### The runaway and the spiral

Reinforcing loops without their partners. Eagles that eat the last herd and then starve. An economy that drops to zero income and can't recover.

*The cure*: a floor, a cap, or a restraint, placed where the loop turns.

### Flicker

A decision re-made every frame from noisy inputs. The eagle's target hopping between herd members so that no wind-up ever finished. The sprite flipping left and right.

*The cure*: commitment (keep a choice until it's invalid), hysteresis (two thresholds), stickiness (a bonus for the current choice), or rolling the dice once at the moment of decision.

Put those six on a card. When something in the game looks wrong, the cause is very often one of them.

## Finding Out What Went Wrong

Debugging ordinary code, you find the line that's wrong. Debugging emergence, there may be no wrong line. Every rule is doing what it was written to do, and the result is still bad. You need different methods.

**Follow one individual.** This is the most important technique, and it's the one that cracked the foraging bugs. The note in `MISTAKES.md`:

> To find such a trap, trace one bird once a second (state, hunger, target and its distance) rather than reading population counts.

A population graph tells you *that* moa are dying. It can't tell you why. Pick one moa and log its state, its hunger, what it's heading for and how far away that is, once a second. Within a minute you'll see it: *hunger 91, FORAGING, target plant 60 units away; hunger 93, FORAGING, same plant, 61 units; hunger 95...* It isn't getting closer. Now you know what kind of problem you have.

**Make the invisible visible.** Most of what matters in the simulation can't be seen: hunger, targets, home ranges, fields, regions. That's what the lens system is for, and why most of the Mauri Projects in this guide had you build one. A lens you write in ten minutes will often show you the bug before you've finished looking.

**Chart it over time.** For questions about balance (is this level too hard? do the eagles overshoot?) you need the shape over minutes, not a snapshot. The benchmark recorder writes populations to a CSV file every ten seconds (Chapter 16).

**Fix the dice.** A bug that appears one game in five is miserable to chase. With a seed (`?seed=42` in the URL) the land and every random roll come back the same, so you can watch the same disaster unfold as often as you need.

**Change one thing.** Emergent systems confound intuition. Form a guess, change exactly one number to test it, and look. If you were wrong, that's information too.

**Ask what the loop is.** When the complaint is about the whole (it oscillates; it always collapses; it's static), stop reading functions and draw the loops. The cause is in the structure.

### Exercise 13.2

Open `MISTAKES.md` in the game's repository and read three entries of your choice. For each, name which family from "The Traps" it belongs to. Is there a family I've missed?

## Tuning

Sooner or later the systems work and the question becomes: is it any good? That's tuning, and it's a craft with a few principles.

**Find the big knobs.** In any system a few numbers matter enormously and most barely at all. For the ecosystem as a whole they are, roughly in order: `plantDensity` (how much food exists), `seasonDuration` (how long each squeeze lasts), `eagleTargetRatio` (how much predation), the moa's `baseHungerRate` (how fast things go wrong), and the breeding cooldowns (how fast they recover). Learn those five before touching anything else. The comment in the level files marks one of them outright: `// ← the main knob`.

**Tune ratios, not amounts.** Free Play raises eagle pressure over a long run by raising the *ratio* of eagles to moa, never by adding a fixed number of eagles. If the moa population falls, the eagle target falls with it. A fixed "+2 eagles" would be fine with fifty moa and an extinction event with ten. A relative setting keeps working as the scale changes; an absolute one is right at exactly one scale.

**Tune in the order things depend on each other.** Plants first, with no eagles: can the land feed a herd through winter? Then add eagles. Then the economy. If the foundation isn't stable, nothing you do upstairs will hold.

**Decide what you want to feel, then measure it.** "The first winter should be frightening, and most players should lose two or three moa and survive." Now you have something to check a run against. Without a target, tuning is just fiddling.

**Write down why.** Six months from now, `breedingSuppressFloor: 0.12` will mean nothing to you. The level files in this game are thick with comments explaining what each number does and sometimes what it used to be. Keep doing that.

## The Emergence Dial

One last idea, which leads into the next chapter.

Pure emergence makes for a wonderful sandbox and a poor teacher. If you want a new player to learn that a storm can save a moa from an eagle, you need an eagle to attack while they're watching, soon, and not fatally. An emergent world doesn't do things on cue.

Pure scripting is the opposite. You can stage the attack to the second. And then nothing the player does matters, because the outcome was decided in advance.

The game treats this as a dial with two ends. The levels in the "Stories" section of the menu sit near the scripted end: a director moves the birds through a planned year. Free Play sits at the emergent end. And the "Chapters" levels are an attempt at the middle: a fully emergent simulation with a thin layer over it that *frames* what happens, *measures* it, *narrates* it, and, only if the world hasn't obliged by a deadline, gives it a push.

That last idea, invite an event and force it only if it doesn't come, is the cleverest piece of design in the project. Chapter 14 shows how it's built.

## Summary

- Emergent behaviour is a pattern of the whole that no part was told about. Migration, territories, cycles and corridors are all emergent here.
- Trace any of them and you find a chain of small local rules across several files.
- A balancing loop (an odd number of opposing links) pushes back and stabilises. A reinforcing loop amplifies, upward or downward.
- Give every reinforcing loop a balancing partner: a cap, a floor, a gate, a restraint.
- A balancing loop with a delay oscillates. Shorten the delay or soften the response.
- Thresholds, tipping points and compounding make small causes produce large effects. Change one thing at a time, by a lot at first, and test more than once.
- Design habits: needs not instructions; limited perception; act through the world; continuous state; add forces and multiply factors; individual variation; local limits; a knob on a cause; cheat only where chance is unfair.
- Build bottom-up, and add the lightest top-down correction where it fails.
- The traps: deadlock, unreachable goals, scale assumptions, frame dependence, runaways, flicker.
- To debug: follow one individual, build a lens, chart over time, fix the seed, change one thing, draw the loops.
- To tune: find the big knobs, use ratios, tune foundations first, know the feeling you're after, record why.

## The Mauri Project

Map the game, then add a loop to it on purpose.

1. **Draw the map.** On paper, draw a box for each of: plants, moa, eagles, forest birds, forest trees, kea, moa nests, mauri, the player's tools, the season. Draw an arrow for every influence you can name from Chapters 5 to 11, and mark each + or −. Find at least four balancing loops and three reinforcing ones. For each reinforcing loop, write beside it what limits it. Keep this drawing. It's the most useful single page you can have while working on the game.
2. **Find a loop in a number.** Use your population chart lens. On Level 2, measure the time between a moa peak and the following eagle peak. Then halve `eagleMaturityAge` in the level's mechanics and measure again. Did the lag change? Did the size of the swings?
3. **Follow one moa.** Write a lens that picks the hungriest living moa and, once a second, pushes a line to an on-screen log: time, state, hunger, `targetPlant` distance (or "none"), `localFoodScore`. Keep the last fifteen lines. Play a hard winter and read the last minute of a moa that starves. What was it doing? Which trap, if any, was it in?
4. **Add a loop deliberately.** Design a mechanic that creates a new feedback loop, and decide in advance which kind. A suggestion: *trampling*. Each time a moa eats a plant, that plant's `baseGrowthTime` goes up by 5% (to a maximum of double), and recovers slowly while uneaten. Heavily grazed places become poor; moa move on; the land rests. Draw the loop before you code it. Is it balancing or reinforcing? What does it do to a herd that stays in one place? Put it behind a `LEVEL_MECHANICS.trampling` flag and try it in your sandbox.
5. **Break something and diagnose it blind.** Ask a friend (or flip a coin) to make one of these changes without telling you which: set the moa's separation multiplier to 3; set `seasonalModifier` thresholds in `findPlant` from 0.3 to 0.9; remove the watchdog's `return`; set `eagleOverhuntRestraint` to 0. Using only the game, your lenses and your chart, work out what was changed. Which technique from "Finding Out What Went Wrong" found it?
