# Avian Age: Mauri; the module engine ("chapters") build plan

The living build plan for the engine the educational modules are made with. Sits beside
`YEARS_PLAN.md` (Free Play's year structure, the engine's end goal), `OVERVIEW.md` (the
codebase map) and `MISTAKES.md`. Status marks: **[done]**, **[next]**, **[later]**.

> **Governing principle.** A module is the emergent game with a frame around it, not a
> script. The engine never steers an animal or stages an outcome: it **frames** play with
> levers (the toolbar, the focus species, newcomers, mechanics, pacing), **measures** it with
> goals (conditions on what the simulation actually did), and **narrates** it with reactions
> (lines and prompts that answer the simulation's own events). The same levers already run
> Free Play's four-year loop, which is what the ~10 modules build up to: each module switches
> on more of the systems that work in tandem there.

---

## Why (2026-10-28)

Modules 0 and 1 (`mauri_module.js`, `mauri_module_patotara.js`) are hand-written directors:
each season is an `_updateX()` state machine with one-off flags, the family's moa and the
eagle run on scripted brains (`MoaLife`, `EagleLife`), goals are names ticked from code, and
each module subclasses the last. That works against the game's design (the outcome is the
script's, not the ecosystem's) and makes every module a new pile of code.

Free Play already shows the better shape: `freeplaySchedule` is data (focus, tools,
introductions, a mast goal that branches years 3 and 4), and the year engine
(`Game._beginFreeplayYear` / `_checkFreeplayYear`) turns it into levers and measured goals over
a free-running simulation. The engine generalises that, plus the tip kit's dialogue and
banners, into one format any module can use.

## What it is

(To write a module, read `MODULE_SCRIPTING.md`: the reference for every key, with recipes.
This doc is the design and the build plan.)

- **`mauri_chapters.js`**: `ChapterRunner`, created by `Game._initFinalize` for any level with
  a `chapters` list, kept on `game.chapters`. It runs alongside the sim, never inside it.
- **A level format**: an ordinary emergent level (terrain, biomes, cast, economy, mechanics,
  `availablePlaceables` as the superset of its tools) plus `chapters`, `reactions`, `cast` and
  `lose`. Worked example: `levels/chapters_prototype.js`.
- **Delivery**: lines and banners compile into ordinary tutorial tips at load (the same
  panels, speaker sounds, spotlights and banners as the modules' tip kit), fired through one
  new tutorial event, `TUTORIAL_EVENTS.STORY_BEAT`.

What it is not: a puppet show. There are no timed eagle attacks and no forced walks. The
scripting toolbox (below) sets the stage and the timing; when an animal has to be moved, only
a cast member can be ordered, for a while, and is then handed back to its own behaviour. A
set-piece (a hatching close-up) is a short **moment** that frames what the simulation is
doing. The module directors (Modules 0, 1 and their free play) stay as they are until they're
rebuilt (phases 3 and 4).

## The format

```js
chapters: [
  { id: 'summer', title: "Summer on the tops",
    // LEVERS, applied as the chapter opens (each stays in force until a later chapter sets it)
    tools: ['speargrass', 'shelter'],      // the toolbar (keys of availablePlaceables; object form takes overrides)
    locked: ['shelter'],                   // greyed out until an { unlock } action
    focus: ['upland_moa'],                 // highlighted; a focus species dying out loses (see `lose`)
    protect: 2,                            // every other species present holds at this floor
    nesting: { species: 'upland_moa', plant: 'speargrass' },   // two patches + that moa found a nest
    introduce: [{ type: 'kea', count: 3 }],
    mechanics: { eagleTargetRatio: 0.12 }, // tuning overlay onto LEVEL_MECHANICS (restored next run)
    start: [ actions ],                    // as it opens: lines, prompts, notices
    // GOALS, measured on the simulation
    goals: [
      { id: 'nest',  name: "Found a nest for the upland moa", done: { gained: ['nests', '>=', 1] } },
      { id: 'flock', name: "Upland moa: {n}/{target}",       done: { count: ['upland_moa', '>=', 8] }, reward: 20 },
      { id: 'hold',  name: "Keep {target} upland moa",       keep: { count: ['upland_moa', '>=', 3] }, required: true },
      { id: 'live',  name: "Come through the winter",        survive: true }
    ],
    reactions: [ ... ],                    // only while this chapter runs
    // FLOW
    until: { seasons: 1 },                 // when it closes (the default: when its season ends)
    holdSeason: { until: { goal: 'nest' }, at: 0.9 },   // pacing: the season waits here until then
    next: [[{ count: ['upland_moa', '>=', 8] }, 'thrive'], [true, 'recover']]   // or 'id' | 'win' | { if, then, else }
  }
],
reactions: [   // level-wide
  { id: 'first_hunt', on: 'eagle_hunting', if: { focus: true },   // once by default
    unlock: 'shelter',
    say: [['guide', "The Pouākai is hunting! Fern cover hides a moa from its eyes."]],
    banner: { words: ["Grow a FERN SHELTER over the hunted moa", "Tap beside the moa"], tool: 'shelter',
              until: { any: [{ placed: 'shelter' }, { hidden: '$target' }, { not: { alive: '$target' } }] },
              lit: ['$target', '$eagle'] } },
  { id: 'flock_low', when: { count: ['upland_moa', '<=', 3] }, once: false, cooldown: 60,
    say: [['guide', "Only a few upland moa are left..."]] }
],
cast: {        // optional: named characters ADOPTED from the simulation, not spawned puppets
  matriarch: { title: "The Matriarch", species: 'upland_moa', pick: 'oldest' }
},
lose: [{ when: { extinct: 'focus' }, reason: "The {species} died out." }]   // (the default)
```

Goal names fill `{n}` (the live value) and `{target}` from a `count` / `gained` / `mauri`
condition. A `done` goal ticks once its condition holds; a `keep` goal fails the moment its
condition breaks (a `required` one loses the level) and is met if it held to the chapter's
end; a `survive` goal is met when the chapter ends. A `required` `done` goal still unmet at
the end loses. `stretch: true` marks a bonus goal (it never blocks or loses).

### Conditions

An object's keys must all hold. Anywhere a condition goes, a function `(ctx) => bool` also
works (the escape hatch; promote it to a key once it's been needed twice).

| Key | Holds when |
|---|---|
| `count: [who, op, n]` | the live count of `who` (a species, `'moa'`, `'eagles'`, `'eggs'`, or `'focus'`: every focus species) compares |
| `gained: [counter, op, n]` | the counter has grown that much since the scope began (the chapter, or a banner since it showed) |
| `placed: type` | one `type` placed since the scope began (shorthand for `gained: ['placed:type', '>=', 1]`) |
| `mauri: [op, n]` | the mauri in hand compares |
| `season: key \| [keys]`, `seasonProgress: [op, f]` | the season clock |
| `after: sec` | that many seconds of play since the scope began |
| `seasons: n` | n seasons have turned since the chapter began |
| `goal: id`, `goalsMet: true` | a goal (any chapter's) is met; every non-stretch goal of this chapter is met |
| `flag: name` | a story flag is set (the `flag` action) |
| `extinct: who` | none alive and no egg of it incubating (`'focus'`: any focus species) |
| `alive: role`, `hidden: role` | the role's entity is alive; is in cover (shelter) |
| `hunting: role \| true` | that eagle is hunting; any eagle is hunting a focus species |
| `hunted: role` | an eagle is after that one |
| `beat: id`, `since: [id, sec]` | a guaranteed beat is done; has been done that long |
| `species`, `focus`, `cast`, `type`, `success` | filters on the event a reaction answers (its subject's species, whether that's a focus species, whether it's a cast member, the placed type, a raid's result) |
| `any: [...]`, `all: [...]`, `not: cond` | combinations |

Ops: `>=`, `<=`, `>`, `<`, `==`, `!=`. **Counters**: `mauri` (earned), `nests` (founded),
`laid`, `hatched`, `killed`, `hunts`, `placed`, `moved`, `raids`, `raidsWon`, each also per
species or type with a suffix (`hatched:upland_moa`, `placed:shelter`).

### Actions

The full list, by toolbox, is in "The two toolboxes" below. A reaction (or a beat) can use
`unlock`, `notify`, `moment`, `say` and `banner` as keys of its own (they run in that order),
and any verb in a `do` list; a function works too. Places (`at`, `on`, `watch`, `near`) take a
site name, a `$role`, a cast name, a species (where one is now), or an entity from a function.

- **`say: [[speaker, text, extras?], ...]`**: one panel per line, opening on the speaker's
  sound, the speaker lit up, the panel on the far side of the screen from them. `extras`
  overrides any tip field. Followed directly by a `banner`, the banner comes after the last line.
- **`banner: { words, until, lit, tool, pause, maxSec }`**: big words across the map
  (`[idle, inHand]`: the second while `tool` is in hand), the game paused (unless
  `pause: false`) until `until` holds, `lit` drawn through the dimming. It gives way if the
  player can't afford `tool`, or after `maxSec`.

### Events, roles and speakers

A reaction waits `on` an event (or polls `when` a condition turns true: a rising edge, so a
flock that keeps dropping to 3 warns once each time). With `for: sec` a polled reaction is a
**need**: it fires only once the condition has held that long. `once` is the default;
`once: false` with a `cooldown` (seconds) or `max` repeats it. `chapters: [ids]` scopes a
level-wide one.

| Event | Roles (`$name` in speakers, `lit`, `alive`/`hidden`) |
|---|---|
| `eagle_hunting` | `$eagle`, `$target` (the subject) |
| `moa_killed` | `$moa` (subject), `$eagle` |
| `egg_laid` | `$egg` (subject; its species) |
| `egg_hatched` | `$moa` (subject, the chick), `$egg` |
| `placement`, `placeable_moved` | `type` |
| `nest_raid` | `$site` (subject), `success` |
| `season_change` | `seasonKey` |
| `chapter_start`, `goal_met`, `goal_failed` | `chapter`, `goal` (the runner's own) |
| `nest_founded` | `$site` (the runner's own: a nest the player's planting founded) |
| `cast_lost` | `$entity`, `cast` (an adopted character has died) |
| `beat` | `beat` (its id), `forced` (a guaranteed beat is done) |

Speakers: `'guide'` (Te Whē), a role (`'$target'`: whoever the event is about, named and drawn
by its species), a species key (the event's one of that species, else any), or a `cast` name.
`lit` takes the same, plus `'focus'` (every focus bird), `'nests'` and placeable types.

## The two toolboxes (2026-10-28)

> **Script the stage and the timing, not the animals.** A module stays predictable by
> controlling where things start, when pressure arrives, and what's guaranteed by a
> deadline, never by moving the animals. Two more rules: **pin the first time, free the
> repeats** (the first time a mechanic appears is the lesson and can be guaranteed; later ones
> are the test, left to the sim), and **a failure is a branch, not a reset**.

The engine's verbs come in two registries (`CHAPTER_SCRIPT_TOOLS` and `CHAPTER_ECOLOGY_TOOLS`
in `mauri_chapters.js`). A chapter's levers (`focus`, `protect`, ...) are the same tools, run
as it opens; any of them can also be used as an action mid-chapter.

**Scripting toolbox**: deterministic, for the flow.

| Tool | What it does | Status |
|---|---|---|
| `sites` | Named places: fixed, or found on the land when the level (or a chapter) starts: `flock` (where a species is now), `biome`, `high` / `low` near a place, `open` ground at a distance, `edge`, `nest` | [done] |
| `place`, `sow`, `spawn` | A placeable (optionally standing: it never wears out), plants, or animals at a site | [done] |
| `beats` (sequencing) | A chapter's beats in order, each starting `when` its condition holds (`beat: id`, `since: [id, sec]`); see the bridge below | [done] |
| `holdSeason`, `lock` / `unlock`, `tools` | Pacing and the toolbar | [done] |
| `moment` | A set-piece: the world held still, the camera in on something, big words, back out. Shared with the Free Play years (`MomentPlayer`) | [done] |
| `aim` | The force half of a guarantee: an eagle goes for a named moa from any distance, whatever its hunger, cutting short a rest (still blind to it under cover) | [done] |
| `order` | A cast member walks, stays or follows for a while, then is handed back to its own behaviour | [later] |
| `nest`, `lay`, `adopt`, `fade`, `guide` | An established nest at a place (named as a site with `as`), an egg or a clutch at a place, a cast name bound to a live bird (a chick on its hatch event, the nearest female to a nest), placed items wearing out, the Field Guide opened at an entry | [done 2026-11-04] |
| `say`, `banner`, `notify`, `camera`, `flag`, `next`, `win`, `lose` | Words, camera, story state, flow | [done] |

**Ecology toolbox**: levers on the simulation; the outcome is left to it.

| Tool | What it does | Status |
|---|---|---|
| `focus`, `protect`, `introduce`, `nesting`, `mechanics` | Who's on stage, who's protected, nest founding, tuning | [done] (levers and actions) |
| `cast` (adoption) | Named characters taken from the sim | [done] |
| `eagle` | Pressure on the real eagles (`which`: all, the nearest, a role): `hunger`, `watch` (move its patrol over a site), `grace` (a "last chance": it chases but can't strike for a few seconds; the eagle's own `tutorialGraceTimer`) | [done] |
| Goals, conditions, reactions | Measuring and answering the sim | [done] |
| needs (`for` on a polled reaction) | Prompt only once something has stood unmet for N seconds (the Free Play years' `_updateNeeds`, generalised) | [done] |
| Behaviours | Built as substrate flags, not runner tools, as the review notes asked: storm as cover (`coverBreaksLock`, `coverCalmsMoa`), the eagle's visible wind-up (`eagleTelegraph`) and surplus preference, kea raids rolled against defending moa (`keaRaidsEggs: 'odds'`) and the berry lure, placed food following the seasons, the breeding calendar (`seasonalBirdBreeding: 'calendar'`). Hungry birds already walk to grown food; the seasonal walk is the moa's own drift. The table of flags: `MODULE_SCRIPTING.md` §19 | [done 2026-11-04] |
| Eagle boldness | The Free Play years' eagle grows bolder (sees further, dives sooner) the longer it goes unfed | [later] |
| Weather | How often storms gather on the tops | [later] (after the storm rework) |

**The bridge: guaranteed beats.** A beat names the emergent way to make something happen
and a scripted fallback:

```js
beats: [
  { id: 'mother_hunted',
    when: { after: 4 },                                    // starts 4 s into the chapter
    invite: [{ eagle: { watch: 'grove', hunger: 50 } }],   // ecology: make it likely
    until: { hunted: 'mama' },                             // the beat itself (a state: see Review notes, an event form is safer)
    by: 12, force: [{ aim: { at: 'mama' } }],              // script: guarantee it by 12 s
    pinned: false,                                         // (true: the outcome itself is fixed; shown in the inspector)
    banner: { words: "Move a STORM over her", until: { hidden: 'mama' }, lit: ['mama'] } }   // on completion
]
```

A beat starts when `when` holds (the chapter's start by default) and runs its `invite`. It's
done when `until` holds, or once `force` has run if it has no `until`. A beat with neither is
a plain timed step. When it's done it runs its own actions (`say`, `banner`, `notify`,
`unlock`, `do`), fires a `beat` event, and the condition `beat: id` turns true. The log and
the inspector record whether it came naturally or was forced, which is the measure of whether
a module's setup is doing its job.

## Modules 0 and 1, reworked (the plan for phases 3 and 4)

Most of the emergent pieces already exist in the modules' Free Play years
(`FREEPLAY_DEFAULTS`, `mauri_module_freeplay.js`): a hunger-driven eagle that takes whatever
it can see, families that walk to food the player grew, breeding by condition, prompts that
wait for a need, and moments. The rework puts those behind the toolboxes and rebuilds the
modules' beats on them.

**Module 0 (Storms)**: blocked until the storm rework puts storm-as-cover in the open sim
(today it lives only in `ModuleDirector.isHidden`; the open sim's Storm stuns, `distractsEagles`).

| Beat | Now (scripted) | Emergent version | Guarantee |
|---|---|---|---|
| Eagle hunts the mother (summer) | `_startChase` at 5.5 s | A hungry eagle watching the grove; the stage leaves only her visible (the father under the nest's storm) | `aim` at her by ~12 s |
| She brings food home; the egg hatches | Ordered walk home | Fed, she goes home (families already do); the egg hatches on its own timer, shown as a moment | `holdSeason` until it hatches |
| Two attacks on the walk down | At 8 s, then 45% of the way | The eagle hunts on its own clock | The family is in the open and the eagle is hungry |
| "Your storm is breaking up" | The script breaks it | Storms wear out; the lesson fires when theirs really fades | Fade it at the halfway point |
| Wrong way first | Walks to a decoy | Drop it, or keep it as a moment | n/a |
| Winter passes | Every 10 s | A mechanics overlay makes the eagle hungrier in winter | n/a |

**Module 1 (Pātōtara)**

| Beat | Now | Emergent version |
|---|---|---|
| Kea arrive | Strongbeak lands on cue and calls two more | The kea nest downslope; the first sprouted pātōtara lures them (the lure already exists after summer). Deadline fallback. |
| The family comes to defend | `_callFamily` | They start hungry and walk to the food the player grew |
| The summer raid | Odds shown (0.95 − 0.18 per moa), not rolled; a success loses | **Kept pinned** (`pinned: true`): Koukou hatches from that egg, and the Free Play years are built on Pukepuke and Koukou |
| Later raids | Rolled at real odds | Unchanged |
| Wharariki to the waterhole | A player action, measured | Unchanged |

## Land regions (2026-10-28)

**The problem.** A bird told to go somewhere it can't reach walks at it forever. Scree, ice,
snow and water can cut the land into pieces with no way between them: two moa start with an
unbroken line of mountain tops between them, a walk's goal sits across a ridge, or a mate is
on the far side of it. The module directors pick their sites by distance on a planning grid
(only the tarn's and the friends' winter spot's routes are path-checked; Module 1's way in
falls back to a straight line when there's no path), `_walkableNear` snaps a bird to the
nearest walkable ground even across a ridge, and `MoaLife`'s stuck-watcher re-plans a detour
every few seconds to a goal no detour reaches.

**The system.** The walkable ground is labelled into connected **regions**
(`labelLandRegions` in `mauri_terrain.js`: a 4-way flood fill, so a diagonal touch isn't a
pass). The terrain keeps them for the window (`TerrainGenerator.landRegions(snow)`, sampled
every 4 units and cached until the land, the window or the snow line moves) with `regionAt`,
`regionNear`, `connected(a, b)` and `nearestInRegion`. Regions follow the seasonal snow,
which can close a pass: `snow` is `'now'`, `'year'` (only ground open all year), `'none'` or a
snow-line height.

**Where it's used** (status in phase 2 below):
- **Module site planning**: the module planning grid labels its own regions (it runs inside
  terrain generation, before the terrain's are available). The family's home goes in the
  biggest stretch of land, not on a peak cut off by scree, and every site a bird walks to
  (the patch, the decoy, the friends' nest, the empty nest, the meeting point, the foraging
  ground, the winter spots, the wharariki, the way out) is kept in the region of where it's
  walked from. `_findPath` gives up at once between regions instead of searching the grid.
- **Spawning**: `_walkableNear` takes an anchor and only accepts ground connected to it, so a
  pair set down near its nest stays on the nest's side of a ridge.
- **Walking**: a scripted moa whose goal is cut off makes for the nearest ground on its own
  side instead (and says so in the console in debug mode); a tapped plant across a ridge
  doesn't lure it; the journey doesn't pick a storm it can't reach.
- **Wild moa** (`mechanics.landRegionMates`, opt-in as house rules require): a moa only
  courts a mate on its own land.
- **Chapters**: sites found `near` a place stay in its region; `spawn` keeps to the site's
  region; the conditions `separated: [a, b]` and `regions: [species, op, n]` (how many
  separate stretches of land a species lives on).
- **Lens** (**L** in debug mode): "Land regions (now)" and "(year-round)", each region
  tinted, with a count.

**Later: teaching clades.** The same map is what isolates populations. Ideas for the module
that teaches it: the regions drawn as a moment ("the tops cut the land in two"); a measure of
how long each population of a species has been apart (time since moa last crossed between
regions, or since a pass last opened); and, behind a flag, isolated populations drifting into
distinct clades (a clade tag per region that new chicks inherit, shown on the population
panel; the core sim's speciation hook, `noSpeciation`, is where a split could happen). A
chapter can then ask for a species to be kept on both sides of a ridge, and react when the
two populations have been apart long enough to count as clades.

## Where it plugs in

| Hook | Where |
|---|---|
| Created and started; its tips join the level's | `Game._initFinalize` |
| Hears every event first (before the tips' on/off switch) | `TutorialManager.fireEvent` |
| Season pacing (`holdSeason`) | `Game.update`'s `seasonManager.update(...)` |
| Runs after the sim each frame | `Game.update` |
| Owns the goals (no classic all-goals win) | `Game.checkGoals` |
| Failed goals drawn | `GameUI.renderGoalsPanel` |
| Inspector drawn / toggled | the main `draw()` (beside `Lens.renderScreen`), `Game.handleKey` (**J**) |
| A speaker's sprite chosen per line | `TutorialManager._showTip` resolves a function `guideSprite` |
| A moment holds the world, shows its words, locks input | `Game._storyMoment` (module or chapters) in `update`, `render`, `_tipOnScreen`; `selectPlaceable` and the pointer handler |
| `aim` | `HaastsEagle.behave` (the aim's timer; hunts while aimed; no resting) and `hunt` (an aimed moa in the open is the target from any distance) |
| Prototype level hidden from players | the level select lists `devOnly` levels only in debug mode |

## Authoring tools

- **Validator** (`ChapterRunner.validate`): runs as the level loads; unknown condition or
  action keys, `next` ids that don't exist, unknown speakers, tools not on the level, focus
  species not in its cast, duplicate goal ids, events no one fires. Issues go to the console
  and the inspector.
- **Inspector** (debug mode **D**, then **J**): the chapter, its clock and season count, what
  it's waiting on, each goal's live value, each reaction's count and cooldown, flags, the
  recent log.
- **Log**: `game.chapters.log` (every chapter, goal, reaction and verdict, timed);
  `game.chapters.dump()` prints it as a table.
- **Jump**: `game.chapters.jump('winter')` from the console, or `?chapter=winter` in the URL
  (starts the level there; the season clock is not moved yet).

## Review notes (2026-11-04, from `ENGINE_ASSESSMENT.md` §11)

The engine was checked against the ownership rules in `ENGINE_ASSESSMENT.md` and run headless
(the prototype, 150 s; then the first beat 9 more times). Verdict: as built, the runner never
steers a wild animal, every ecology verb lands on a sim API that already existed, the cast is
adopted, and `aim` is implemented inside `HaastsEagle` and logged. The "second simulation"
risk the assessment raised for the legacy directors does not apply here. What came out of it:

- **[done 2026-11-04] Beat `until`s that mean "it happened" must be event-based.** (`seen:
  [event, filters]` exists, scoped like `gained`; beat `until`s are also checked on the event
  path; the validator warns on a state-only `until`.) The original note: `hunting: true` and
  `hunted: ref` are states polled every 6 frames; the eagle's lock can drop between polls. In
  one run the first-hunt beat was logged **forced** at 38 s although a natural hunt had fired
  `first_hunt` at 16.3 s; in another, four hunt events fired over 21 s while the state read
  false at every poll. Natural-vs-forced is the research measure, so this matters. Done now:
  the prototype and the `MODULE_SCRIPTING.md` example use `gained: ['hunts:<species>', '>=', 1]`
  in the beat's scope. To do: evaluate beat `until`s on the event path too (in `_react`), or add
  a `seen: [event, filters]` condition scoped like `gained` (it would also cover a cast member,
  which a counter can't: the `hunted: 'mama'` example above).
- **[done 2026-11-04] `aim` outside a beat's `force` isn't marked.** Allowed in `start` / `do`,
  it is a scripted attack that no log entry calls forced. Now a validator warning.
- **[done 2026-11-04] Two level keys for partners:** `claim` (one line: the substrate rule the module
  teaches, e.g. "a moa under cover can't be seen"; validator-required) and `guide` (the Field
  Guide ids it unlocks). They are what a school or conservation partner reads first.
- **Where the [later] behaviours should live.** Eagle boldness, hungry birds walking to grown
  food, breeding by condition and `BIRD_CALENDAR` are listed above as runner tools. Build them
  as substrate flags (`LEVEL_MECHANICS`, switched on by the `mechanics` lever), so the runner
  never grows a brain and the endless level gets them for free. The same for `order` when it
  lands: an end condition required, and hunger, feeding, cover and breeding left to the sim
  while it runs.
- **Phase order, given that Modules 0 and 1 stay as legacy** (`ENGINE_ASSESSMENT.md` §12):
  phases 3 and 4 become optional (a *new* storm module on the engine is worth building as the
  scripted-vs-emergent control for the thesis, but the legacy modules are not rebuilt), so
  phase 5 (Free Play parity) and phase 6 (new modules) move up, and the storm rework blocks
  only a new storm module. Pre-existing 404s seen while running: `sprites/moa_juvenile.png`,
  `audio/call_little_bush_moa.mp3`, `audio/call_upland_moa.mp3`.

---

## Build phases

### Phase 1: the runner and a prototype **[done 2026-10-28]**
- [x] `ChapterRunner`: chapters, levers, goals, flow and branching, reactions, cast adoption,
      lose rules, counters, compiled lines and banners.
- [x] Core hooks (table above), the `STORY_BEAT` tutorial event, failed goals in the panel.
      The tip kit's `awayFrom` now sits on a director-free `awayFromAt`, which the runner's
      speakers use.
- [x] Validator, inspector, log, jump.
- [x] `levels/chapters_prototype.js`: one year of upland moa on Level 2's land with Free
      Play's ecology: the eagle, founded nests, fern cover and the waterhole. It branches in
      spring on how the flock came through winter. Its words are working placeholders.
- [x] Verified headless in the preview (see "Verification" below).

Not done in phase 1: the release build (`node tools/build.js`) hasn't been re-run, so `dist/`
doesn't have the engine yet. Speaker sounds were not listened to (headless).

### Phase 2: the two toolboxes **[in progress, started 2026-10-28]**
See "The two toolboxes" for each tool's status. First slice **[done 2026-10-28]**:
- [x] The verbs split into `CHAPTER_SCRIPT_TOOLS` and `CHAPTER_ECOLOGY_TOOLS`; the chapter
      levers run through the same verbs (`CHAPTER_LEVERS`), so they work mid-chapter too. The
      validator now also flags unknown chapter keys, places, plants and site finders.
- [x] `sites`, and `place` / `sow` / `spawn` at a site (or at a role, cast member or entity).
- [x] Guaranteed `beats` (`when`, `invite`, `until`, `by`, `force`, `pinned`), the `beat` /
      `since` conditions and `beat` event, and beats in the inspector (natural or forced).
- [x] `eagle` (`which`, `hunger`, `watch`, `grace`), `aim`, and the `hunted` condition, with
      small guarded hooks in `HaastsEagle` (see "Where it plugs in").
- [x] Needs: `for` on a polled reaction.
- [x] `moment`, on a `MomentPlayer` (in `mauri_chapters.js`) that the Free Play years'
      director now plays its hatchings and catches on too.
- [x] The prototype uses them: a free standing speargrass patch where the flock grazes, a
      guaranteed first hunt with a last chance, moments for the first nest and chick, and a
      need-style nest reminder.

Land regions **[done 2026-10-28]** (see "Land regions"):
- [x] `labelLandRegions` and the terrain's region API.
- [x] Module site planning, spawning and walking kept within regions (Modules 0, 1 and the
      Free Play years).
- [x] `landRegionMates` for wild moa (on in the prototype).
- [x] Chapters: region-aware sites and spawn; `separated` and `regions` conditions.
- [x] The two regions lenses.
The clade teaching itself is still to come (see "Later: teaching clades").

Still to do in phase 2 **[next]**: `order` with hand-back (a light brain a cast member can
borrow, then return to its own behaviour), the behaviours (seasonal walk via cover, foraging
for grown food, breeding by condition), eagle boldness. `aim` only targets moa so far (the
eagle's flyer hunt doesn't read it).

### Phase 3: Module 0 on the engine **[done 2026-11-04, as a new module beside the legacy one]**
`levels/chapters_storms.js` (Guided and Open sketches). The legacy Module 0 is kept unchanged
as a Story. Storm-as-cover went into the open sim behind flags (`coverBreaksLock`,
`coverCalmsMoa`, `lureUnderStorm`, and the level's own Storm definition). The family is spawned
at a nest the stage sets and adopted; the chick is adopted on its hatch event; the eagle is left
to hunt, with the first hunt a guaranteed beat in the Guided sketch only. See "The parallel
modules" below.

### Phase 4: Module 1 on the engine **[done 2026-11-04, as a new module beside the legacy one]**
`levels/chapters_patotara.js`. One decision changed from the table above: the summer raid is
**not pinned**. It is rolled at real odds in both sketches (a kea that reaches the egg rolls
`Simulation.raidSuccessChance`, which falls with every moa nearby); the Guided sketch lets the
odds reach zero with enough moa near, the Open sketch floors them at one in twenty, and a lost
egg is answered by the neighbours laying again rather than a reset. The arrival of kea at the
sprouted patch is the guaranteed beat (Guided only).

### Phase 5: Free Play parity **[later; a first free play on the engine is done]**
`levels/chapters_freeplay.js` **[done 2026-11-04]** is the modules' five years (Pukepuke &
Koukou) on the engine: four season chapters cycling on a `year` condition to a finale, the
whole cast breeding by calendar, the eagle hunting birds and moa, need-style prompts only.
Parity with the cycling Free Play's year engine remains:
Express `level_freeplay_kahurangi`'s four-year loop as chapters, so the endless mode and the
modules share one engine and the modules can grow into it.
- An `area` lever (the world-grid area a chapter plays in; `_scrollWorldGrid`'s staged move).
- Year-start levers for the reset Free Play does (`_computeYearStartPops`,
  `_applyZoneMoaCarry`, the per-loop pressure ramp) as named systems a chapter switches on.
- `loop` on the chapter list (endless: never wins) and the mast goal as a branching goal.
- Then `_beginFreeplayYear`'s schedule-reading shrinks to those systems.

### Phase 6: new modules **[later]**
Module 2 (YEARS_PLAN's planned food-security and moa–eagle module) and on, built as chapters.
Whatever they need that the toolboxes lack is the next set of tools.

### Phase 7: tooling **[later]**
- Season-aligned jumps, and a snapshot at each chapter start to restart from.
- A Node validator (`tools/`) so a level can be checked without the browser. **[done
  2026-11-04]**: `tools/validate.js` (with `--smoke`) and `tools/batch.js` (seeded headless runs
  across seeds, the benchmark CSV and the beat log saved per run), both through Playwright.
- Reactions on more events as modules need them. **[done 2026-11-04]** for `placeable_expired`,
  `plant_sprouted`, `bird_hatched`, `bird_killed`, and `nest_raid` with its outcome; kea
  stationed is still open.

## The parallel modules (2026-11-04)

The plan agreed in `ENGINE_ASSESSMENT.md` and the session plan was carried out: the two opening
modules and the five years rebuilt on the engine as a parallel set, the legacy set kept as
Stories, every substrate change behind a flag, and the research tooling built first. What a
reader who hasn't seen the code needs is in `CHAPTERS_MODULES.md`; every key in
`MODULE_SCRIPTING.md` (§18 sketches and the template, §19 the flags).

**Landed.**
- Menu sections from a table (`MENU_SECTIONS` in `mauri_sketch.js`: Stories, Chapters, Endless,
  Classic; placeholder labels, renamable in one place) and a `section` key per level; the
  Chapters section draws a card per family with a button per sketch; the win card has a "Next
  module" button (`nextLevel`) and shows the `claim`.
- Levels as factories with an emergence dial (`sketch: { of, label, dial }`,
  `LEVEL_REGISTRY.registerFamily`); `levels/_template_chapters.js`.
- Engine: conditions `near`, `seen`, `year`, `eagleHunger`, `stat`, the `cause` filter, list
  filters; actions `nest`, `lay`, `adopt`, `fade`, `guide`; `spawn` with sexes, hunger and age;
  beat `once`; `holdSeason.maxSec`; the `{year}` token; level keys `claim`, `guide`,
  `sketch`, `nextLevel`, `section`; the validator rules listed in `MODULE_SCRIPTING.md` §17;
  the runner's log also goes to the benchmark.
- Substrate flags (`MODULE_SCRIPTING.md` §19) and simulation helpers (`addNestingSite`,
  `addEggAt`, `raidSuccessChance`, `moaNear`, `seasonTurns`, `causeOfDeath`, `_bornYear`).
- Seeds: `?seed=` seeds p5's generators before the land is built, the `Math.random` call
  sites moved onto `random()`, and a run replays exactly on one machine and browser (same
  seed, same CSV hash). Across machines it starts the same and then drifts: see the 2026-11-10
  review below.
- Benchmark: seed, level, sketch and chapter on every row, the story log in the `event`
  column and in `<name>.beats.json`, URL arming (`?bench=1&years=n`), `BENCHMARK.lastRun`.

**Verified** with `tools/batch.js` and a stand-in player (covers a hunted cast member, sprouts
bare pātōtara, sets wharariki by the family in winter): the first-hunt and first-raid beats came
naturally in 12 of 12 runs across both sketches of both lessons; the Storm lesson was won 5 of
6, Pātōtara 5 of 6 (the losses: the family not home by spring, a chick hungry by the water: the
tasks the stand-in doesn't attempt); the five years were won in all five runs (three Guided,
two Open), with the eagle feeding on the giant moa, the families' wild descendants and a few
birds, and no named bird lost. `node tools/validate.js --smoke` passes every level. The numbers
are tabled in `CHAPTERS_MODULES.md`.

**Found and fixed in the open simulation on the way** (each in `MISTAKES.md`): wild moa starving
beside food (three foraging traps, then two more: a chick held on a parent's separation ring,
and a starving bird choosing a rich far plant over a near one); the eagle unable to catch a
giant moa because its resist roll ran on every scan; a fresh lock under `coverBreaksLock`
counted on every change of target.

**Still open**, in the order worth taking them: a `pacing` lever (a tension curve on eagle
hunger over a chapter, so fewer beats need a deadline); `order` with hand-back; words
separated from logic for partner editing; land hand-off between modules; Field Guide locks;
phase 5 parity; the kōkako laying less often than its calendar allows (one clutch in five
springs in the run checked).

## Review of the two sets (2026-11-10)

The Stories and the Chapters set were re-assessed side by side, with an outside review of the
old modules and the Endless mode as input (`ENGINE_ASSESSMENT.md` §16). Nothing below is built;
each item is **[proposed]** until the owner picks it up.

What the review found, in one line each:
- The Chapters world is emergent but its teaching is still scripted: a banner gives the answer
  at every hunt, in both sketches and every year.
- The Endless mode still plays by the old rules (the storm stuns, background species are
  protected), so there are three rulebooks, not one.
- The record of a run measures the stage (natural or forced), not the learner.
- Guided and Open differ in up to nine settings at once.
- The upland moa family breeds in every season and a chick is adult in fifteen seconds, which
  contradicts the five-year lesson's claim.
- The three lesson files repeat 24 named pieces and 34 rule settings by hand.
- A seed replays exactly on one machine but not across machines: the owner's re-run of nine
  seeds began identically and drifted apart after 17 to 35 seconds. Three seeds per sketch
  are also too few to quote win counts from.

The proposals, in order (detail in §16.6):
1. **[proposed]** One rulebook (`rules: 'tops'`) and a shared lesson kit, proven to change
   nothing by matching replay hashes.
2. **[proposed]** A hint ladder (clue, then a question, then the instruction), the player's
   actions in the record, a transfer stretch per lesson, and the dial split into three axes
   (what is guaranteed, how much is said, how hard the eagle presses).
3. **[proposed]** A new Endless variant on the shared rules, beside the existing one.
4. **[proposed]** The family on the breeding calendar and visibly growing; floors replaced by
   visible arrivals; powers named apart from the world's rules; Field Guide entries marked
   known, inferred or imagined.
5. **[proposed]** A curriculum map (`teaches` / `assumes` and a coverage tool that prints the
   untaught rules of any level) and an optional before-and-after question.
6. **[proposed]** Batches of twenty or more seeds reported as ranges; and either one named
   research machine for replays, or the simulation's own sine, cosine and angle functions so a
   run is the same everywhere.

On the framework itself the review recommends one rulebook with several framings, and each
lesson ending in one or two unprompted situations; see §16.5 for the options weighed.

## Open questions

- How much pacing is acceptable? `holdSeason` keeps a season waiting for a goal; that's a
  teaching lever, but used heavily it's a rail.
- Should a missed goal ever lose a module, or only set up a harder next chapter (a branch)?
  The prototype uses one required goal so both paths are exercised.
- Named characters: adopted from the simulation (a real moa that can really die) is the
  emergent way; Modules 0/1's family were spawned. Which do the modules want?

## Verification

Phase 1, 2026-10-28, driven headless in the preview (`game.update(1)` loops; see the
testing notes in memory), with a stepper that dismissed lines and answered banners as a
player would:

- **A full year to a win.** Summer's levers all applied (tools, shelter locked, focus,
  floors of 2 on the other moa, nest founding, the matriarch adopted). Two speargrass patches
  among the upland moa founded a nest in the simulation; the nest goal ticked and the
  `nest_founded` line showed. The first egg drew its line. At 50 s summer closed into autumn.
  The Pouākai's first hunt of an upland moa unlocked the shelter, showed the line and banner,
  and a shelter over the target cleared the banner. Six seconds later the eagle caught a
  moa, and it happened to be the matriarch: `caught` and `matriarch_lost` both fired, unscripted.
  Winter added the waterhole and the eagle-ratio overlay; `midwinter` (winter-only) fired at
  50%; the keep and survive goals were met at the close. With exactly 8 upland moa at the
  boundary the branch took `spring_thrive`, and spring's close won (7/9 goals; the unmet
  stretch didn't block). Completion saved.
- **holdSeason**: with no nest, summer sat at 90% for 10+ s of play; founding one released
  it, and summer closed 5 s later.
- **The other paths**: a thin flock at winter's end took `spring_rebuild`; dropping to 2
  upland moa in winter broke the required keep and lost with its `failReason` (and
  `flock_low` fired on its rising edge); no upland moa left in autumn lost on the default rule
  ("The Upland Moa died out."). A `keep` goal already broken as its chapter opened failed at
  once and showed ✗.
- **Restart** put the level's eagle ratio back (the overlay's `_chapterBase`) and re-locked
  the shelter.
- **`?chapter=winter`**, `introduce` and `camera` (onto an upland moa at 1.6, then home)
  worked from the console.
- **The validator** caught every planted mistake in a deliberately broken copy (unknown
  condition, goal with no done/keep/survive, duplicate goal id, unknown verb, two verbs in
  one action, unknown speaker, banner with no until, species not in the level, unknown tool,
  unknown event, missing next chapter, missing goal reference, scope to a missing chapter).
  The prototype itself validates clean.
- **No regressions seen**: Modules 0 and 1, Level 1 and Free Play load and open on their
  usual first tips with no runner; Module 1's speakers still place their panels through the
  refactored `awayFrom`. The prototype is listed only in debug mode.

Findings while testing (balance, not engine bugs): a speargrass patch lasts 40 s
(`duration: 2400`), so the two patches for a nest have to go in close together in time; and
the opening mauri (80) buys two patches and a shelter with little left, so a missed placement
can stall the nest until income catches up. Both are levers for whoever tunes the module.
(Phase 2's prototype answers both with a free, standing first patch.)

Phase 2, first slice, 2026-10-28, the same way:

- **A summer with the new tools.** The `grazing` site resolved to where the upland moa were;
  a standing speargrass patch was placed there. The player's second patch founded a nest at
  once; "A new nest!" played as a moment, then its line. The `hunt_comes` beat started at
  8 s and ran its invite (eagles watching `grazing`, hunger 55); an eagle hunted an upland moa
  on its own at 16.3 s, so the beat came naturally and the first-hunt line and banner answered
  it. The first chick's moment held the world (play time stood still for its 2.5 s).
- **The forced path.** With every eagle kept from hunting after the invite, the deadline
  (8 + 30 s) aimed the nearest at the matriarch; a zero-hunger eagle went for her, which fired
  the ordinary hunt event (so the same reaction answered), and the beat logged as forced.
- **`aim`**: from 328 away a resting, zero-hunger eagle locked on at once, chased no other
  prey and caught the aimed moa; aimed at one under fern cover it never locked on, and the aim
  lapsed on time (6 s). **`eagle`** set hunger and grace (6 s = 360 frames). **`sow`** and
  **`spawn`** put 5 plants and 2 moa at a site.
- **Moments** hold the world (no play time, no movement), lock the toolbar, and hand back.
  The Free Play years' hatching moment, now on `MomentPlayer`, still plays: words, camera in to
  2.39 and back to 1, a second hatching of the same species not shown twice, input locked
  while it plays.
- **The validator** caught every planted mistake in a broken copy using the new tools
  (unknown placeable, plant, site finder, chapter key; places that aren't sites; a species
  not in the level; force without by; duplicate beat ids; a missing beat; `for` with `on`).
- **No regressions seen**: Modules 0 and 1, Level 1, Level 2 and Free Play run 15 s of play
  with no errors and no runner.

Land regions, 2026-10-28:

- **The labeller**: a ridge splits a grid in two, a one-cell pass joins it, ground that only
  touches diagonally stays two regions.
- **Real land**: five Module 0 and six Module 1 loads put every site a family walks between,
  and every bird, on the home land. Labelling a window takes 0.2–2.4 ms, then it's cached. Real
  seeds rarely split the land (one region held 100% of it in most loads), so:
- **A forced ridge** (the height function wrapped to raise a glacier band across 40–46% of
  the window): the land split 49/51 (and three ways once). Module 0 and two Module 1 loads
  still put every walked-to site and all 2 or 5 birds on the home side. Ordered to a point over
  the ridge, the father was given the nearest point on his side, walked there and stopped,
  with no detour re-planned in 25 s (it used to re-plan every ~4 s forever); debug mode said so
  once in the console. With `landRegionMates`, a male and female 49 apart across the ridge
  weren't paired; 12 apart on one side they were; with the flag off they were paired across
  it, as before. `separated` read true across the ridge and false on one side; `regions` counted
  the upland moa on both sides (2); the validator caught bad references in both. The lens drew
  the two sides (39% and 61%) with their count.
- **No regressions seen**: all seven levels (Modules 0, 1 and their Free Play years, Levels 1
  and 2, Free Play, the prototype) ran 15 s with no errors; the module families (both, in the
  Free Play years) started on their home land.
- **Found**: on every current level "year-round" regions match "now": none of their lands
  has seasonal snow that closes a pass yet, so that mode is ready for land that does. One fix
  from testing: `_findDecoy`'s last-resort point ignored the land (it fell back to a point 150
  away); it now takes the nearest point on the home land.

Bugs found and fixed while testing: the `moment` tool's method shared its name with the
`moment` getter Game reads (the getter won); the eagle's aim timer sat below its resting
early-return (so a resting aimed eagle kept the aim forever); and an aimed moa only won when it
was already within the eagle's hunt radius (nearer prey won otherwise).

## Decisions log

- **2026-10-28**: the engine is emergent-first (frame, measure, narrate; never steer). It's
  data in JS objects (comments and functions allowed; no build step), with functions as the
  escape hatch. Delivery reuses the tutorial system, not a new UI. Modules 0/1 are left as
  they are for now.
- **2026-10-28**: two toolboxes (scripting, ecology) joined by guaranteed beats; Modules 0
  and 1 to be rebuilt on them (phases 3–4) before Free Play parity (now phase 5). Module 1's
  summer raid stays pinned for Koukou's sake.
- **2026-10-28**: named characters are adopted from the simulation (`cast`), not spawned.
  The prototype is `devOnly` (listed in debug mode only) and avoids the Storm, which is
  being reworked separately; it uses fern cover instead.
- **2026-11-04**: the legacy modules stay as they are, as the Stories section and the scripted
  control condition for the research; the three opening experiences are rebuilt on the engine
  as a parallel set in the Chapters section. Every sketch of a module is a visible variant
  button. Substrate changes go behind flags. Seeds must replay exactly. Pātōtara's summer raid is
  rolled at real odds, not pinned; a lost egg branches (the neighbours lay again). Menu section
  labels are placeholders the owner will name.
