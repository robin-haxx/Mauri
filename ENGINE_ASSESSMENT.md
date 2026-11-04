# Avian Age: the module / endless split, and a grammar to reconcile them

*An assessment of the plan to build a "grammar" (an engine) that lets Avian Age be two things
at once: a research exploration of procedural, emergent eco-simulation, and a set of
accessible, story-led lessons about Aotearoa's flora and fauna that schools and conservation
groups could take up as targeted slices. Written against the code at commit `f967746`
(2026-11-04).*

> **Scope note.** Sections 1 to 10 were written before the chapters engine existed in this
> checkout: they read what the code at `f967746` commits you to, propose a grammar that fits
> it, and list the questions that needed answering. The engine (the chapters runner,
> `MODULE_ENGINE_PLAN.md`, `MODULE_SCRIPTING.md`, the storm rework) was then built in a
> separate working copy that has not reached GitHub as of 2026-11-04, so sections 11 to 13
> weigh this assessment against the engine *as described*, not as read. Once the engine
> branch is pushed, sections 11 to 13 should be checked against the code and folded into
> `MODULE_ENGINE_PLAN.md`.

---

## 1. The short version

1. **The worry is right, but it is deeper than tone.** The modules don't *curate* the emergent
   simulation; they *replace* it. A moa, eagle or kea with a `lifeScript` skips its normal
   behaviour entirely, and the modules' free play (`FreePlayDirector`) carries its own hunger,
   hunting, feeding, breeding and starvation models inside the director. So today the
   accessible, well-teaching build is not the emergent build. That is the thing a thesis
   reviewer will find first.
2. **You have already invented the grammar; it just isn't written down as one.** The three
   directors, the tip kit and the `LEVEL_MECHANICS` flags together use a small, stable
   vocabulary: *sites, cast, beats, goals, needs, moments, levers, stages, weather, flags*.
   Section 4 names it.
3. **The missing rule is ownership, not vocabulary.** The plan becomes "defined enough" the
   moment it says, per system, which layer owns the state: the *substrate* (one simulation,
   the research object), the *direction* (a director that biases, paces and watches the
   substrate but never re-implements it), and the *presentation* (scenes, banners, moments,
   Field Guide). Section 5.
4. **The reconciling move is "watched, not scripted".** Keep the named family and the story.
   Make Pukepuke an ordinary sim moa the director *follows*, turning her emergent state changes
   into beats, and apply *pressure* (hunger, weather, grace windows) rather than *events* to
   make the lesson's moment very likely. Then the story is different every run, which is
   exactly the thesis's claim, and every lesson is demonstrably true in endless mode too.
5. **The test that keeps you honest:** *every rule a module teaches must hold in the emergent
   sim with the director removed.* Storm-as-cover is the first case: taught by Module 0,
   still a stun in the sim's own `Storm` placeable (`distractsEagles`), and only true in
   modules because `ModuleDirector.isHidden` says so.
6. **The chapters engine and this assessment are the same move seen from two sides** (section
   11): the engine makes *direction* and *presentation* data; this document says what the
   *substrate* must own for that data to be true. The engine does not, by itself, retire the
   second simulation; the substrate ports in section 6 still do that. The legacy modules
   should stay playable as their own menu row and as the thesis's scripted control condition
   (section 12), and new free play modes should be chapters over the cycling Free Play's
   substrate (section 13).

---

## 2. What the repo actually contains: two simulations

There are two lineages, and the second has grown a simulation of its own.

| | Prototype → endless lineage | Module lineage |
|---|---|---|
| Levels | `level_01`, `level_02`, `level_freeplay_kahurangi` | `module_00_storms`, `module_01_patotara`, `module_freeplay` |
| Who decides what a moa does | `Moa.behave`: state machine over boid forces (`mauri_moa.js`) | `MoaLife.behave` (`mauri_module.js`): the sim's moa returns at line 286 before any of its own behaviour runs |
| Who decides what the eagle does | `HaastsEagle.behave`: patrol/hunt/rest, and under `emergentEagles` an energy budget, a nest, starvation, maturity, prey-driven reproduction | `EagleLife` + `FreePlayDirector._updateHunt / _pickPrey / _goneHungry`: the director keeps its own `eagleHunger`, boldness, grace and "away" cycle |
| Moa hunger and food | `Moa.forage`, `findPlant`, favoured plants, forest competition, habitat stress, winter edibility | `MoaLife._hunger / _feed / _eat`, `biteValue` (`wildBite`, `plantedBite`), `feedAt / fedAt`, `_updateStarving` |
| Moa breeding | `securityTime`, mate search with the ×40 conspecific bias, pregnancy, `Egg` | `cond` (a condition scalar rising while fed), `_updateMoaBreeding`, `breedGapYears`, one summer egg at the nest |
| Bird breeding | `Kereru` and subclasses breed on their own timers; kākāpō only in mast years | `BIRD_CALENDAR` + `_scheduleBirdClutches` (`seasonalBirdBreeding` switches the birds' own breeding off) |
| Storm | `distractsEagles`: an eagle entering it orbits 3 s and drops its target | Cover: `ModuleDirector.isHidden(m)` reads `Simulation.stormAt`; the eagle's brain is never consulted |
| Population floors | `populationFloors`, `freeplayProtectFloor`, refounding at year boundaries | `birdPopulationFloor: 0`, `FREEPLAY_DEFAULTS.eagle.birdFloor` |
| Loss | any focus species dies out | the Pouākai takes Pukepuke or Koukou |
| How the player learns | tips keyed to generic events, the Field Guide, and inference from population dynamics | scenes (dialogue), banners ("do this"), one goal at a time, moments (camera close-ins), needs-driven prompts |

The columns on the right were built for good reasons. They are better paced, better explained
and more legible than the left. `FreePlayDirector`'s eagle (hunger → look → grace → dive;
boldness grows when it goes without; it flies off to hunt elsewhere when it can't find prey) is
arguably a *better* design for a visible predator than `HaastsEagle.emergent`'s. But it is a
second implementation of the same animal, living in a director, invisible to endless mode, and
unavailable to the research claim.

The same is true of the family's hunger model, the breeding calendar and the floors. The
modules' free play is, in effect, a **third model** of the ecosystem: hand-rolled, director-level,
and the one you find most engaging. That is why the reconciliation feels unfinished.

---

## 3. Why the split matters for each of the three goals

**The thesis.** A claim of the shape "procedural, emergent simulation makes a more dynamic,
lifelike (and perhaps better-teaching) game" needs the thing people play to *be* the emergent
sim. If the evaluated build runs scripted birds, the evidence supports "a well-authored story
teaches", which is true, uncontroversial, and not your contribution. `DEVBLOG_systems.md` is
already careful about this for the aggregation mechanic ("engineered rather than emergent");
the same candour applied to the modules says they are currently curated, not emergent.

**Teaching.** Modules teach well because each one isolates *one true rule* (a moa under a storm
can't be seen; gathered moa defeat a raid; winter takes food, not plants) and gives the player
one tool to act on it. Endless mode teaches many rules at once and most of them are invisible
(habitat stress, forest competition, the Allee effect of mate-finding). The lesson here is not
"modules good, endless bad"; it is that **a lesson needs one rule, one lever, and a visible
consequence**, and the module directors are the first part of the codebase that delivers all
three on purpose.

**Spin-offs for schools and conservation groups.** A spin-off is a *slice*: a place, a small cast,
one or two tools, one or two rules, and the real ecology behind them. Modules 0 and 1 are
slices in all but name. What stops them being commissionable today is that each one is ~900 to
2,500 lines of bespoke director code (`PatotaraDirector` alone is 884 lines, and the free play
is 1,866). A grammar that makes a slice mostly *data* (a `story` block plus a tip script) with a
*shared* director is what makes "spin off a slice for the kākāpō on Whenua Hou" a two-week
job rather than a rewrite.

---

## 4. The grammar you have already built

Reading the three directors and the tip kit as a language, these are its parts. All of them
exist; none are named as a system.

| Primitive | What it is | Where it lives today |
|---|---|---|
| **Site** | A planned place on generated land: nest, patch, tarn/shore, trail, eyrie, exit, decoy, friends' winter spot, third nest | `ModuleDirector.planTerrain`, `_planningGrid`, `_findRefuge`, `_findPath`, `_findEyrie`, `sites.*` |
| **Cast** | Named individuals with roles and relationships: father, mother, chick (Pukepuke), the friends, Koukou, Strongbeak and the band | `_spawnMoa(x, y, female, role)`, `friends`, `keas`, `_nameOf` |
| **Beat** | A named story moment with data, fired to the presentation layer | `_beat(name, data)` → `TUTORIAL_EVENTS.MODULE_BEAT` |
| **Goal** | One visible objective per season, ticked by id | `story.goals`, `_goalsFor(key)`, `_achieve(id)` |
| **Need** | A detector for "the player should act now, and can": cover, pathDown, pathUp, hungry, friendsFood, sprout; prompted at once in year 1, later only once it has stood a while | `FreePlayDirector._activeNeeds`, `_updateNeeds`, `needActive` |
| **Lever** | A player verb that biases the sim without commanding it: tap a plant to lure, sprout by hand, move a standing storm, move the wharariki | `Simulation.lurePlant`, `Game._sprout`, `PlaceableObject.makeStanding`, move-by-hold |
| **Moment** | The world held still, the camera closing in, big words saying what happened (a hatch, a catch) | `FreePlayDirector._startMoment`, `moment.*` |
| **Stage** | A season as a story stage with its own clock rules: hold at 80% until the key moment, catch up, cut short once goals are done | `_enterStage`, `holdSeasonAt`, `autumnCatchUp`, `quickSeasonSec`, `_seasonMustWait` |
| **Weather** | Scheduled pressure from the environment: storms gathering on the tops | `_updateWeather`, `story.weather` |
| **Flag** | A substrate rule switched on per level | `LEVEL_MECHANICS.*` behind `typeof` guards |
| **Scene / banner** | Dialogue chains with speakers lit up; "do this" text that dismisses itself when done | `MODULE_TIP_KIT.sceneWith`, `banner`, `moveBanner`, `placeBanner`, `reachBanner`, `sproutBanner` |
| **Guide entry** | The ecology behind a rule, unlocked as the run reveals it | `ENCYCLOPEDIA` (`mauri_encyclopedia.js`) |

Two things stand out. First, **Need** is the most important teaching primitive you have and it
is fully generic: it is a function from sim state to "what a kaitiaki should do here", with a
patience timer. It is also the primitive a research build wants to log. Second, **Lever** is
the module lineage's own version of the "prefer emergent couplings, then expose a lever"
principle in `YEARS_PLAN.md`. The two lineages already agree on the principle; they disagree on
whether the thing the lever acts on is the sim or a script.

---

## 5. The missing rule: who owns the state

Propose three layers, with one rule each.

### Substrate (the simulation)
One implementation of every ecological process: hunger and feeding, food value by season,
cover and visibility, predation, breeding (moa and birds), mast, climate, floors. Levels
configure it through flags and `economy`; nothing else writes its state. **This is the research
object.** If a rule is worth teaching, it lives here, so endless mode and every module share it.

### Direction (the director)
A director may **place** (sites, cast, spawn positions), **pace** (stage clocks, holds, catch-up),
**pressure** (weather, hunger scaling, grace windows, eagle schedules, where the eagle is allowed
to be), **lure** (the same levers the player has), **watch** (turn substrate state changes into
beats, needs and goals) and **frame** (win and loss). It may *not* re-implement a process the
substrate owns. Today's `lifeScript` is a blanket exception; it should become a **bounded stage
direction**: a scoped override such as `walkRoute(route)` or `holdAt(site)` that hands the bird
back to the substrate when it ends, and that leaves hunger, feeding, cover and breeding to the
substrate even while it runs. (The journey, column and detour code in `MoaLife` is genuinely
directorial and should stay; `_hunger`, `_feed`, `_eat` and the breeding `cond` should not.)

### Presentation (the tip kit and the Field Guide)
Scenes, banners, moments and guide unlocks. Reads beats and needs. Never touches the sim.

### The same-rule test
*Every rule a module teaches must hold in the emergent sim with the director removed.* It is a
one-line test and it is already how you decided the storm question in `YEARS_PLAN.md` ("Storm
as cover, not a stun ... To port: give the Storm `blocksEagleVision`"). The grammar makes that
the rule rather than a follow-up.

### Scripted → watched → pressured
The thing that scripting buys is *guarantee*: the eagle attacks 8 s into the walk, so the lesson
lands. Emergence takes the guarantee away. The grammar replaces guaranteed **events** with
shaped **pressure** and a **deadline**:

- The director raises eagle hunger, narrows its grace window, and places it over the trail, so an
  attack within the autumn walk is very likely.
- The beat (`last_chance`) fires when the *substrate's* eagle actually commits to a hunt on a
  family member, not on a timer.
- If the sim hasn't produced the moment by a deadline, the director nudges harder (hunger up,
  spot range up, weather clears), never teleports or fakes it. Logged as a `nudge` beat, which
  is itself research data (how often does emergence need help to teach?).

This keeps the named family and the "story of a creature", because identity becomes a **lens**
over the sim (the camera and the beats follow Pukepuke) rather than a script. `moment` already
works this way for hatches and catches.

---

## 6. Ownership table (proposed)

For each system: what exists, who should own it, and the smallest port that gets there.

| System | Implementations today | Proposed owner | Port |
|---|---|---|---|
| Storm cover | sim: `distractsEagles` stun; modules: `isHidden` in the director | Substrate | Give `Storm` `blocksEagleVision`, let cover break an existing lock in `HaastsEagle.hunt`, drop `distractsEagles`. Already decided in `YEARS_PLAN.md`; do it first. |
| Eagle hunting | `HaastsEagle` (patrol/hunt/rest + energy budget); `FreePlayDirector` (hunger, look range, boldness, grace, away) | Substrate, with the director's design | Port boldness, grace-before-dive and "away hunting" into `HaastsEagle` as flags (`eagleBoldness`, `eagleGraceSec`, `eagleAwayWhenStarved`). The director then *schedules* (where it may patrol, when it is off-map) and *watches* (beats on hunt commit, dive, catch, give up). |
| Family hunger and feeding | `Moa.forage` etc.; `MoaLife._hunger/_feed/_eat`, `biteValue` | Substrate | `wildBite`/`plantedBite` become a flag on the plant side (`biteValueByOrigin`), water slowdown becomes a terrain feature effect, and the family moa use `Moa.forage` with the tap-lure as a lever. |
| Moa breeding | `securityTime`/mating/pregnancy; `cond` + `_updateMoaBreeding` | Substrate | Keep the sim's model; express "one egg a summer at the nest" as flags (`layOnlyAtNest`, `breedSeason`, `breedGapYears`). The finale's courting stays a stage direction. |
| Bird breeding | `Kereru` timers; `BIRD_CALENDAR` | Substrate, with the calendar | `BIRD_CALENDAR` is the better model and is real biology; move it into the species data and let `Kereru` read it under `seasonalBirdBreeding`. The endless level then adopts it for free. |
| Floors and loss | three floor mechanisms; two loss rules | Direction (loss), substrate (floors) | One `populationFloors` map in the substrate; loss is a director framing (`story.loseWhen`). |
| Mast | `Game._isMastYear` read-time flag; `FreePlayDirector.mast` | Substrate | One source of truth; the director only announces it. |
| Weather | director only | Direction | Fine as is; it is pressure, not process. |
| Sites, cast, stages, beats, needs, goals | director only | Direction | Fine as is; extract the shared parts of the three directors into the base one so a new slice overrides data, not code. |

The order matters: storm cover, then the eagle, then family feeding. After those three, Module 0
can run with the substrate's moa and eagle and the same tips, which is the proof-of-concept the
thesis needs (section 9, step 4).

---

## 7. What a slice looks like

A commissionable slice for a school or a conservation group should be specifiable in one page
and buildable mostly from data. Modules 0 and 1 imply this template; writing it down is most of
the "engine plan" for the spin-off goal.

```
slice
  place      a world-grid area and biome bands, plus the sites the land must contain
             (nest, food patch, water, trail, eyrie); fitted to any seed (elevationWindow)
  cast       named individuals with roles and relationships; which species are present
  claim      the one or two ecological rules the slice teaches, each stated as a substrate
             flag (e.g. "a moa under a storm can't be seen": Storm.blocksEagleVision)
  levers     the one or two tools on the toolbar, and when each unlocks (lockedTools)
  stages     the four seasons as story stages: clocks, holds, goals (one visible at a time)
  pressure   weather schedule; eagle schedule (hunger, where it may be, grace); hunger scale
  beats      the moments the presentation may speak to, with the data each carries
  needs      the player actions to prompt, and the patience before prompting
  guide      the Field Guide entries unlocked, with sources
  framing    win, loss, "Continue" (next area, next slice, or free play on this land)
```

What this gives a partner: they can read it, argue with the *claim* line (is that what we
want kids to take away about kākāpō?), and see that the evidence is in the *guide* line. What it
gives the thesis: each slice is a controlled exhibit of one emergent rule, so the comparison
"this rule taught by a scripted vs. a watched module" is a per-slice experiment.

---

## 8. Research instrumentation

The pieces exist (`mauri_benchmark.js`, the Free Play stats export in `tests/`, `mauri_lens.js`)
but they record populations and placements, not the teaching loop. Three additions make the
same build a research instrument:

1. **Log beats and needs in the benchmark CSV**: when a need arose, when (if) it was prompted,
   when the player met it, and whether a `nudge` was required. This is the data for "does
   emergence teach without help".
2. **Run the same slice headless across seeds** (the benchmark's batch mode already exists) and
   report variance: how different are the stories? That is the "dynamic, lifelike" claim made
   measurable, e.g. time-to-first-attack distribution, predator-prey lag, extinction events,
   Allee collapses.
3. **Name the emergent claims.** Be explicit about which dynamics are emergent (eagle demography
   and the predator-prey lag; cover-directed hunting; the mate-finding Allee effect; migration as
   habitat tracking) and which are imposed (favoured plants, the forest band, climate drift as a
   difficulty curve). Choose slices that teach the *emergent* ones, because those are the
   thesis's evidence; a module about an imposed rule is a curated serious game like any other.

---

## 9. Is the plan defined enough? A checklist and first moves

A plan is defined enough when it contains:

- [ ] The three-layer ownership rule (section 5) and the same-rule test, stated as policy.
- [ ] The ownership table (section 6) with a decision per row, including which of the current
      implementations is canonical.
- [ ] The slice template (section 7) and a worked example (Module 0 rewritten in it).
- [ ] The accessibility constraints as named constraints, not incidental constants: one tool per
      slice, one visible goal, 30 to 45 s seasons, needs-prompting with patience, named
      individuals, tablet-first input (press-and-hold), OpenDyslexic. These are already in the
      module code; naming them lets a partner hold you to them.
- [ ] The instrumentation (section 8) and the research question it serves.
- [ ] A scoping decision: what the user builds (directors, substrate) vs. what a partner could
      author (a `story` block, tips, guide entries).

Suggested first moves, each small enough to finish and measure:

1. Write the ownership table into the plan and decide each row. One sitting.
2. Port storm cover to the substrate (already decided; `YEARS_PLAN.md`). Verify Module 0 and the
   endless level both still behave; this is the first same-rule exhibit.
3. Port the director's eagle design into `HaastsEagle` as flags, and reduce `FreePlayDirector`'s
   hunt code to a schedule plus beats. Run the modules' free play before and after with the
   benchmark; the beats should still fire, now from the sim.
4. Rebuild Module 0 as *watched*: keep `walkRoute` and the column as stage directions, drop
   `MoaLife`'s hunger, feeding and breeding, and make `last_chance` fire on the substrate eagle's
   own hunt commit. If Module 0 still teaches cover, the thesis has its exhibit A, and the
   slice template has its worked example.
5. Add beats, needs and nudges to the benchmark CSV, and run Module 0 across 20 seeds.

Only after these does it make sense to write new modules, because each new module written
against `lifeScript` today adds to the second simulation rather than the first.

---

## 10. Clarifying questions

Answers to these change what the plan should say; the rest of this document stands without them.

1. **Where is the engine plan?** Answered: it is `MODULE_ENGINE_PLAN.md` in a working copy
   that has not been pushed. GitHub holds only `main`, the merged `claude/perf-tablets`, and
   this branch (which carries this document and nothing else). Push it and section 11 can be
   checked against the code.
2. **What is the thesis's unit of evidence?** "Emergent sim produces more lifelike dynamics" is
   a simulation question (measure variance and lag across seeds). "Emergent sim teaches or
   engages better" is a learner study (needs participants, a scripted control, ethics). They
   need different instrumentation and possibly different builds; which is it, or both?
3. **Which emergent dynamics are the core claims?** Section 8 suggests four. If you disagree,
   the choice of which slices to build changes.
4. **Who authors a spin-off slice?** You (code is fine; the grammar is a discipline) or a
   partner's educator (the `story` block, tips and guide entries must then be data, and the
   directors must be shared, not per-module subclasses).
5. **How much non-determinism is acceptable in a lesson?** A teacher may want the eagle attack
   to happen in every session; a researcher wants it to vary. The pressure-plus-deadline model
   in section 5 is a dial between the two; where should it sit by default?
6. **Audience and session.** Age range, reading level and session length (a 40-minute class
   period with setup is perhaps 25 minutes of play) set season length, text density and how
   many stages a slice can have. The tablet work suggests iPads in classrooms; confirm.
7. **Which free play survives?** The endless level (`level_freeplay_kahurangi`: four-year loop,
   world grid, climate drift, kea cascade) and the modules' free play (Pukepuke & Koukou, five
   years, one land) are two different games. The grammar suggests the second's *design* on the
   first's *substrate*; is that the intent, or do both stay?
8. **"Balance development"**: read here as balancing *effort* between the research build and
   the teaching build, not game balance. If you meant tuning, section 8's instrumentation is
   also the tuning tool, but the recommendations above would be reordered.

---

## 11. Weighed against the chapters engine

The engine, as described: a module is a `story` of **chapters** (one per season or stage) with
**levers** (the tools and when they unlock), **goals**, **conditions and counters**
(`after`, `beat`, `near`, `hidden`, `gained`, `placed`, `stat`, `any`/`all`), **actions** in
two toolboxes (a *scripting* toolbox: `stay`, `goTo`, `follow`, `chase`, `journey`, `camera`;
an *ecology* toolbox: `sow`, `spawn`, floors, income, `unlockTool`), **lines and banners**
delivered by the existing tip kit, **reactions** (sim events by role, answered with narration),
**guaranteed beats**, **sites** found by solvers, **cast** declared once, and plain functions as
the escape hatch; plus a validator, a story inspector, a beat log and jump-to-beat. Its stated
default is emergence: the runner layers goals, unlocks and reactive narration onto the
free-running sim rather than porting the scripted seasons.

### Where the two agree (most of it)

| This assessment | The engine |
|---|---|
| Substrate / direction / presentation | "Code decides how things behave; data decides when, who and what is said" |
| Watched, not scripted | Emergence the default; reactions fire on sim events |
| Beat (`_beat(name, data)`) | Beats and the beat log |
| Need (a detector with patience) | Levers with goals and conditions; reminder banners |
| Lever | Levers, `unlockTool`, the ecology toolbox |
| Site, cast | Sites and solvers, cast declared once |
| Stage clocks | Chapters with `holdUntil` and timed close |
| Instrumentation (section 8) | Validator, inspector, beat log, jump, headless test snippet |
| "Extract shared director code into the base class" | Superseded by systems plus data chapters, which is the better design; drop the suggestion |

The slice template in section 7 is, in effect, the chapter-level key list. Two keys the
template has that the described engine may not: **`claim`** (the substrate rule or flag the
module teaches, stated in one line) and **`guide`** (the Field Guide entries it unlocks, with
sources). Both are cheap data, and both are what a school or conservation partner reads first.
Recommend adding them to the module header and having the validator require `claim`.

### Where the engine needs a rule it may not yet have

The engine makes direction and presentation declarative. It does not decide what the
substrate owns, and a data vocabulary can carry the second simulation just as well as code
can. Five rules close that gap; each is a validator check as much as a design rule.

1. **A scripting action is a bounded stage direction.** `stay`, `goTo`, `follow`, `journey`
   and `camera` must each have an end (`until`, `after`, `near`, a beat), and while one runs the
   bird's hunger, feeding, cover and breeding stay with the sim. The validator should refuse a
   scripting action with no end condition.
2. **`chase` is a nudge, not a verb.** A `chase` action that drives the eagle at a named moa is
   the scripted attack in data form. Prefer **pressure**: raise the eagle's hunger, narrow its
   grace, place it over the trail, and let the `hunt` reaction fire when the substrate eagle
   commits. If `chase` stays in the vocabulary, it should be written to the beat log as
   `forced`, so a run can report how often the lesson needed forcing.
3. **A guaranteed beat is pressure, a deadline, and a logged nudge.** Something like
   `{ guarantee: 'first_hunt', pressure: { eagle: { hunger: +30, graceSec: 5 } }, within: 40,
   then: 'force' }`. The deadline and the `force` fallback are explicit, and `nudge` / `force`
   entries in the beat log are research data (section 8).
4. **An ecology action calls a sim API the endless level also uses.** `sow`, `spawn`, floors
   and income are fine as long as they go through `Simulation` and `MauriManager`, never through
   runner-private state. The test: the same action, run in `level_freeplay_kahurangi`, must do
   the same thing.
5. **Cast brains default to the sim.** A cast entry's brain is the species' own behaviour
   unless the module says otherwise, and a scripted brain (the legacy `MoaLife` / `EagleLife` /
   `KeaLife`) is allowed only on a legacy module (section 12). The validator should warn when a
   cast member in a chapters module names a legacy brain.

### What the engine does not fix, and the order to fix it

The two eagles, the two feeding models, the two breeding models and the three floor
mechanisms (section 6) are untouched by making chapters declarative. They remain the
prerequisite for the thesis claim, and they also decide how well new modules teach: until the
legacy director's eagle design (hunger, look range, boldness, grace before the dive, away
hunting) is ported into `HaastsEagle` as flags, a chapters module's `hunt` reactions fire from
the energy-budget eagle, which is less legible than Module 0's. The storm rework is the first
port and is under way. The order stands: storm cover, then the eagle, then family feeding,
then `BIRD_CALENDAR` into the species data.

---

## 12. Retaining the legacy modules

Keep Module 0, Module 1 and the modules' free play (Pukepuke & Koukou) playable from the main
menu, as their own set, and freeze them.

- **Files.** `mauri_module.js`, `mauri_module_patotara.js`, `mauri_module_freeplay.js`, the
  three `levels/module_*.js` and their `levels/tutorial_module_*.js` scripts stay as they are.
  Mark the three levels (e.g. `legacy: true`, or `engine: 'director'`), and have the level
  select draw them as a second row of small buttons under the chapters modules, with its own
  label ("Stories"). `Game._renderModuleRow` already draws modules by `moduleIndex`; a second
  row grouped on the flag is a small change. "Continue" chains stay within the legacy set.
- **Isolation.** The legacy birds run `lifeScript`, so they skip `Moa.behave`,
  `HaastsEagle.behave` and `Kea.behave`; the substrate ports do not change how they play.
  Storm cover in the legacy set stays `ModuleDirector.isHidden` reading `Simulation.stormAt`;
  dropping `distractsEagles` from the base `Storm` touches nothing they read (only
  `HaastsEagle.behave` reads it). When `BIRD_CALENDAR` moves into the species data, keep the
  constant available under its current name (an alias is enough) so
  `FreePlayDirector._scheduleBirdClutches` keeps working.
- **Freeze.** New modules are written only on the chapters engine. The legacy set gets bug
  fixes and nothing else, and the plan should say so; otherwise it drifts back into being the
  second simulation.
- **Why keep them beyond courtesy.** Legacy Module 0 is the *scripted* version of the lesson
  a chapters Module 0 teaches *emergently*. That is the control condition the thesis wants:
  the same lesson under both regimes, compared on beat-timing variance across seeds, nudges
  and forces needed, and, with learners, outcomes. Retaining the old modules makes that
  comparison free; make it part of the study design rather than a leftover.

---

## 13. New free play modes under the new rules

The cycling Free Play (`level_freeplay_kahurangi`: the four-year focus loop, the 2×2 world
grid, climate drift, winter edibility, emergent eagles, the kea cascade) is the substrate
exemplar: it is the one level where every system runs in tandem, and the ten or so modules
are meant to end up resembling it. So a new free play mode is a chapters level over that
substrate:

- **Chapters per year** replace the year engine in `mauri_sketch.js` (`freeplaySchedule`,
  `_beginFreeplayYear`, `_checkFreeplayYear`, `_applyFreeplayYearPressure`): each year is a
  chapter with its levers (that year's toolbar), goals (the focus species' targets), and
  reactions (Te Whē on a hatch, a catch, a mast, a species at its floor). The world-grid pan
  and the glacial re-bake stay as a system the chapter calls.
- **Reactions replace the generic tips** in `levels/tutorial_freeplay_kahurangi.js`, and the
  ecology blurbs move to the Field Guide (already an open follow-up in `FREEPLAY_PLAN.md`).
- **The modules' free play becomes legacy** (section 12). Its better ideas (the eagle's
  boldness and away cycle, `BIRD_CALENDAR`, the needs prompts with patience, the hatch and
  catch moments) are ported into the substrate and the engine rather than kept as a second
  mode.
- **A first new mode worth building:** the cycling Free Play's year 1 (the kea cascade) as a
  chapters level on fresh land, with `claim` lines for the two emergent rules it rests on
  (eagles hunt what they can see; eagles follow the nests). If that mode plays as well as the
  legacy free play with no scripting-toolbox actions at all, the vocabulary is complete enough
  for the modules.
