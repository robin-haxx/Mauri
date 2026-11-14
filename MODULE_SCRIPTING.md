# Scripting modules

How to write a module with the chapters engine (`ChapterRunner`, `mauri_chapters.js`). A
module is an ordinary emergent level with a `chapters` list on top. The engine never moves
wild animals: it sets the stage (levers), measures what happened (goals), and answers it
(reactions, lines, banners).

- Worked example: `levels/chapters_prototype.js`. The three modules built this way:
  `levels/chapters_storms.js`, `levels/chapters_patotara.js`, `levels/chapters_freeplay.js`
  (what each teaches and how it plays: `CHAPTERS_MODULES.md`).
- A copyable starting point: `levels/_template_chapters.js` (§18).
- Design, build status and history: `MODULE_ENGINE_PLAN.md`.

---

## 1. A minimal module

```js
// levels/module_02_example.js
const MODULE_EXAMPLE = {
  id: 'module_example',
  name: 'Example',
  devOnly: true,                       // listed in the level select only in debug mode (D)
  unlockCondition: null,

  // ---- The land and cast: as any level ----
  startSeason: 'summer',
  terrain: Object.assign({}, LEVEL_GLACIAL_KAHURANGI.terrain),
  biomes: LEVEL_GLACIAL_KAHURANGI.biomes,
  species: { moa: ['upland_moa'], eagle: ['haasts_eagle'], other: [] },
  startingSpecies: 'upland_moa',
  initialSpeciesDistribution: { upland_moa: 6 },
  initialEntityCounts: { moa: 6, eagle: 1 },
  economy: { startingMauri: 80, seasonDuration: 3000 },   // 50 s seasons
  availablePlaceables: { speargrass: { cost: 25 }, shelter: { cost: 35 } },   // every tool any chapter uses
  mechanics: { emergentEagles: true, noSpeciation: true },

  // ---- The script ----
  chapters: [
    { id: 'summer', title: "Summer",
      tools: ['speargrass', 'shelter'],
      focus: ['upland_moa'],
      start: [{ say: [['guide', "Grow the upland moa flock this summer."]] }],
      goals: [{ id: 'grow', name: "Upland moa: {n}/{target}", done: { count: ['upland_moa', '>=', 8] }, reward: 20 }]
    },
    { id: 'autumn', title: "Autumn",
      goals: [{ id: 'hold', name: "Keep {target} upland moa", keep: { count: ['upland_moa', '>=', 4] }, required: true }],
      next: 'win'
    }
  ],
  reactions: [
    { id: 'first_hunt', on: 'eagle_hunting', if: { focus: true },
      say: [['guide', "The Pouākai is hunting! Fern cover hides a moa.", { lit: ['$target', '$eagle'] }]] }
  ],

  // ---- Required by the level format ----
  goals: [],
  menu: { title: "Example", subtitle: "Module example", flavorText: [""], displayPlants: ['speargrass'],
          featuredSpecies: { key: 'upland_moa', displayName: 'Upland Moa', localName: 'Moa Pukepuke', spriteKey: 'upland_walk_01', spriteScale: 0.4 },
          art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] } },
  tutorial: { guideSprite: 'mantis_talk', tips: null }
};
LEVEL_REGISTRY.register(MODULE_EXAMPLE);
```

Then add it to `index.html`, after any level file it borrows from (here
`level_02_glacial_kahurangi.js`):

```html
<script src="levels/module_02_example.js"></script>
```

Chapter levels don't get the default tip script. All their words come from `say` and `banner`.

---

## 2. How it runs

- **Start.** The runner adopts the `cast`, finds the level's `sites`, and opens the first
  chapter (or the one named in `?chapter=<id>`).
- **Opening a chapter**, in this order:
  1. Run its levers (`mechanics`, `tools`, `locked`, `focus`, `introduce`, `protect`, `nesting`).
  2. Adopt any missing cast, and find the chapter's `sites`.
  3. Arm its `beats`.
  4. Show its `goals` and post its `title` as a notice.
  5. Fire `chapter_start`, then run its `start` actions.
- **Every frame**, after the simulation, it reacts to that frame's events.
- **Every 6 frames** (0.1 s) it checks polled reactions, beats, goals, lose rules, and whether
  `until` holds.
- **Closing a chapter:**
  1. Unbroken `keep` goals and all `survive` goals are met.
  2. An unmet `required` goal loses the level.
  3. Otherwise `next` decides where to go: another chapter, or `'win'`.

The runner only runs while the game is playing. Moments and pausing tips hold it.

---

## 3. Level keys

| Key | What |
|---|---|
| `chapters` | The chapter list (§4). Its presence makes the level a chapter level. |
| `reactions` | Level-wide reactions (§10). |
| `cast` | Named characters adopted from the sim (§13). |
| `sites` | Named places, found when the level starts (§12). |
| `lose` | `[{ when, reason }]`. Default: `[{ when: { extinct: 'focus' }, reason: "The {species} died out." }]`. `[]` turns it off. |
| `devOnly` | `true`: listed only in debug mode. |
| `module` | `true`: a lesson. It opens without the level splash, and the validator then requires a `claim`. |
| `section` | The menu section that lists it: `'stories'`, `'chapters'`, `'endless'` or `'classic'` (`MENU_SECTIONS` in `mauri_sketch.js`; the labels there are placeholders). Default: chapter levels go in `chapters`, legacy `story` modules in `stories`. |
| `claim` | One line: the rule of the simulation this module teaches ("A moa under cover can't be seen, so the eagle hunts what it can see."). Shown on the win card. It is what a teacher or partner reads first. |
| `guide` | Field Guide entry ids the module rests on (`mauri_encyclopedia.js`). The `guide` action opens one. |
| `sketch` | `{ of, label, dial }`: this level is one variant (one setting of the emergence dial) of a module family (§18). |
| `nextLevel` | A level id: the win card's "Next module" button. |
| `teaches` | The rules of the simulation this lesson teaches, by name (`['cover', 'eagle_reads']`). `node tools/coverage.js` uses them to show which of any level's rules no lesson teaches (§16). |
| `weather` | Storms that gather by themselves on the highest ground: `{ everySec = 20, max = 3, lifeSec = 75, winterLifeSec = 40, firstSec = 8 }`, or `false`. On by default on a journey level with the Storm. A new one swells up while fewer than `max` storms stand anywhere, away from the other storms and the cast; it is `natural` (not counted as placed). |
| `userCamera` | `true`: the player's camera on this level. Zoom buttons (and the wheel, and + / -), a drag to pan when zoomed in, a tap on an animal to ring it, read who it is and follow it. With `mechanics.huntCamera` the view also eases to a hunt and back (§19). |

The game's own loss (every moa gone) still applies.

---

## 4. Chapter keys

| Key | Default | What |
|---|---|---|
| `id` | `chapter_N` | Used by `next`, `?chapter=` and `jump`. |
| `title` | the id | Shown as a notice when the chapter opens. |
| levers (§5) | (unchanged) | `mechanics`, `tools`, `locked`, `focus`, `introduce`, `protect`, `nesting`. |
| `sites` | | Places found as the chapter opens (§12). |
| `start` | | Actions run as it opens. |
| `goals` | | §6. |
| `reactions` | | Reactions that only run in this chapter. |
| `beats` | | Guaranteed beats (§11). |
| `until` | `{ seasons: 1 }` | When the chapter closes (a condition). |
| `holdSeason` | | `{ until, at = 0.9, maxSec }`: the season clock waits at `at` of the way through until `until` holds, or `maxSec` seconds have passed. The validator warns when there is no `maxSec`: a hold needs a way out. |
| `transfer` | `false` | `true`: the unprompted stretch. No hint rung is said in this chapter, and its cases are recorded apart (§10, hint ladders). |
| `next` | the following chapter, else `'win'` | `'id'`, `'win'`, `[[cond, 'id'], ..., [true, 'id']]` (the first that holds), or `{ if, then, else }`. |

Any other key is flagged by the validator.

---

## 5. Levers

Levers run as a chapter opens and stay in force until something sets them again. Each one is
also an action, so it can be used mid-chapter (`{ focus: ['kea'] }`).

| Lever | Value | Effect |
|---|---|---|
| `tools` | `['key', ...]` or `{ key: overrides }` | **Replaces** the toolbar. Keys must be in `availablePlaceables`. |
| `locked` | `['key', ...]` | Greyed out until an `unlock` action. |
| `focus` | `['species', ...]` | Highlighted. The default lose rule watches them. `count: ['focus', ...]` means every focus species. |
| `protect` | `n` | Every non-focus species present right now holds at `n`: it can't be hunted or starved below it. |
| `nesting` | `{ species, plant }` or `null` | Two placed patches of `plant` with that moa nearby found a nest. |
| `introduce` | `[{ type, count }]` | Newcomers, set down by habitat. |
| `mechanics` | `{ key: value }` | Overlaid onto `LEVEL_MECHANICS`. The level's own values come back on the next run. |

---

## 6. Goals

```js
{ id: 'nest', name: "Found a nest", done: { gained: ['nests', '>=', 1] }, reward: 20 }
```

| Field | What |
|---|---|
| `done: cond` | Met as soon as the condition holds (it stays met). |
| `keep: cond` | Fails the moment the condition breaks; met at the chapter's close if it held. |
| `survive: true` | Met when the chapter closes. |
| `required: true` | An unmet `done` goal at the close, or a broken `keep` goal (at once), loses the level. |
| `failReason` | The loss text for a required goal. |
| `stretch: true` | A bonus: it never blocks `goalsMet` and never loses. |
| `reward` | Mauri when met (default 0). |
| `name` | Panel text. `{n}` is the live value and `{target}` the target, read from a `count`, `gained`, `mauri` or `placed` condition. |

Goal ids should be unique across the level, because `goal: id` looks in every chapter.

---

## 7. Conditions

A condition is an object whose keys must **all** hold, or `true`, or a function
`(x) => bool` (§14).

| Key | Holds when |
|---|---|
| `count: [who, op, n]` | The live count compares. `who`: a species, `'moa'`, `'eagles'`, `'eggs'`, `'focus'` (the lowest of the focus species). |
| `gained: [counter, op, n]` | The counter has grown that much since the **scope** began (see below). |
| `placed: type` | The player placed one `type` since the scope began. |
| `mauri: [op, n]` | Mauri in hand. |
| `after: sec` | That long since the scope began (play time). |
| `seasons: n` | That many season changes since the chapter opened. |
| `season: 'winter'` or `[...]` | The current season. |
| `seasonProgress: [op, f]` | How far through the season (0–1). |
| `goal: id` / `goalsMet: true` | A goal is met / every non-stretch goal of this chapter is met (or, for `keep`, unbroken). |
| `beat: id` / `since: [id, sec]` | A beat is done / has been done that long. |
| `flag: name` | A story flag is set. |
| `extinct: who` | None alive and no egg of it incubating (`'focus'`: any focus species). |
| `alive: ref` / `hidden: ref` | That bird is alive / in cover. |
| `hunting: ref` or `hunting: true` | That eagle is hunting / any eagle is hunting a focus species. |
| `hunted: ref` | An eagle is after that bird. |
| `separated: [a, b]` | Two places or birds on land no bird can walk between. |
| `regions: [species, op, n]` | How many separate stretches of land a species lives on (`'moa'`: any moa). |
| `near: [a, b, dist]` | `a` is within `dist` of `b`. `a` can be a place, a bird, a species (any live one of them) or a placeable type (any live one: `['wharariki', 'mama', 90]` is "a wharariki within 90 of Mama"). `b` is a place or a bird. |
| `seen: [event, filters?]` | The event has happened since the **scope** began, passing the filters if any (`['eagle_hunting', { species: 'upland_moa' }]`). It is recorded as the event fires, so a beat waiting on it cannot miss it between two polls. |
| `year: [op, n]` | The level's year (1 for the first four seasons, 2 for the next four, ...). |
| `eagleHunger: [op, n]` | The hungriest live eagle's hunger (0–100; they hunt from about 45). |
| `stat: [ref, field, op, n]` | A bird's own number: `'hunger'` (0–100), `'age'` (seconds) or `'size'`. |
| `species`, `focus`, `cast`, `type`, `success`, `cause` | Filters on the event a reaction answers: the subject's species (one or a list), whether it is a focus species, whether it is that cast member (one or a list), the placed type, a raid's result, and how a cast member died (`'eagle'`, `'starved'`, or `'unknown'`). |
| `any: [...]`, `all: [...]`, `not: cond` | Combinations. |

**Ops:** `>=` `<=` `>` `<` `==` `!=`.

**Counters** (for `gained`):

| Counter | Counts | Suffix |
|---|---|---|
| `mauri` | mauri earned | |
| `nests` | nests founded | |
| `laid`, `hatched`, `killed`, `hunts` | eggs, chicks (moa and flighted birds), eagle catches (moa and flighted birds), eagle hunts started | `:species` (`hatched:upland_moa`, `killed:kea`) |
| `placed`, `moved` | the player's placements and moves | `:type` (`placed:shelter`) |
| `expired`, `sprouted` | placed items that wore out; pātōtara the player sprouted | `:type` (`expired:Storm`) |
| `cases`, `solved`, `unaided` | hint-ladder cases closed; those the player answered; those answered before any hint | |
| `tapped`, `selected` | plants the player rustled; animals the player tapped | `:type` |
| `arrived`, `left`, `gaveUp` | newcomers over the pass; grown young gone over it; times an eagle gave a hidden species up | `:species` (`left:upland_moa`) |
| `raids`, `raidsWon` | kea nest raids | |

**Scope.** `gained`, `placed` and `after` count from the chapter's opening. Inside a banner's
`until` they count from when the banner showed; inside a beat's `until`, from when the beat
started.

---

## 8. Actions

An action is an object with **one** verb, or a function `(x) => {}`. Actions go in `start`,
`invite`, `force`, a reaction's or beat's `do`, or as a reaction's or beat's own keys
(`unlock`, `notify`, `moment`, `say`, `banner`, which run in that order, then `do`).

**Scripting toolbox** (deterministic):

| Verb | Value |
|---|---|
| `say` | `[[speaker, text, extras?], ...]` (§9) |
| `banner` | `{ words, until, lit, tool, pause, maxSec }` (§9) |
| `notify` | `"text"` or `["text", 'info' / 'success' / 'error']` |
| `moment` | `{ on, text, sec = 3, zoom = 2.2 }`: holds the world and closes in on `on`, with big words. (Every camera move eases in and out and takes up the motion of the one before it; a big change of zoom takes about 1.25 s per doubling: `Game.cameraTo`.) |
| `camera` | `{ on, zoom = 1.6, sec = 1.5 }`, or `'home'` |
| `tools`, `unlock`, `lock` | The toolbar (key or keys) |
| `place` | `{ type, at, standing }`: a placeable, free. `standing: true` never wears out. |
| `sow` | `{ plant, at, count = 4, radius = 30, growth = 0.9, sprouted = true }` |
| `spawn` | `{ type, at, count = 1, radius = 20, sexes, female, hunger, age }`: adult moa or birds at a place. `sexes: 'pair'` alternates female, male, ...; `female: true` / `false` sets them all; `hunger` (0–100) is how hungry they start (a hungry pair goes out to feed at once); `age: 'juvenile'` makes a half-grown moa chick. |
| `nest` | `{ at, radius = 40, hideClutch, reservedFor, as }`: an established nesting site at a place. `as` names it as a site, so later actions and conditions can say `at: 'home'`. |
| `lay` | `{ species, at, count = 1, incubationSec, scene }`: an egg, or a clutch, at a place. Scripted, so it is not counted as `laid`. `scene` (`true` or `{ sec = 3 }`): when its time is up it hatches as the modules' eggs did, rocking and cracking with the camera close in, then leaves its shell and the view eases back (`Game.onHatchScene`). When it hatches is still the simulation's. |
| `adopt` | `{ name: '$role' }` or `{ name: { species, near, female, pick } }`: binds a cast name to a live bird: the one the event names (`{ pukepuke: '$moa' }` on `egg_hatched`), or the nearest of a species to a place. The name must be in `cast` with `manual: true` (§13). |
| `fade` | `{ type = 'Storm', sec = 20, refreshOnMove }`: every placed item of that type wears out within `sec` seconds, standing ones too. With `refreshOnMove`, moving one gives it its time again. (On a journey level, or with `mechanics.stormMoveExtend`, a moved storm instead gains that fraction of its time left: half, by default.) |
| `guide` | An entry id: opens the Field Guide at it. |
| `aim` | `{ at, which = 'nearest', sec = 20 }`: an eagle goes for that moa, whatever its hunger. It still can't see a moa in cover; given a list, it takes the first that is alive and in the open. The validator warns when `aim` is used anywhere but a beat's `force`: it is a scripted attack, and only a forced beat is marked as such in the log. |
| `flag`, `unflag` | A story flag name |
| `reward` | Mauri |
| `next` | A chapter id or `'win'`: closes this chapter at the next check |
| `win`, `lose` | `true` / a reason |

**Ecology toolbox** (levers; the sim decides the outcome): `focus`, `protect`, `nesting`,
`introduce`, `mechanics` (§5), and:

| Verb | Value |
|---|---|
| `eagle` | `{ which = 'all', near, hunger, watch, grace }`. `which`: `'all'`, `'nearest'` (to `near` or `watch`), or a ref. `hunger`: 0–100 (they hunt above about 45). `watch`: move their patrol over a place. `grace`: seconds the eagle chases but can't strike (a "last chance"). `away`: seconds it flies off over the nearest edge on an errand (tile 1: scuffling with the kea), out of sight and out of the hunt, then back to its patrol (over `watch`, if given); `hunger` is then its hunger on its return (`HaastsEagle.sendAway`). |

---

## 9. Lines and banners

**`say`** is one panel per line, opening on the speaker's sound, with the speaker lit up and
the panel on the far side of the screen from them. Lines pause the game.

```js
say: [
  ['guide', "The Pouākai is hunting!"],
  ['$target', "Help!", { lit: ['$eagle'] }],
  ['matriarch', "Stay close, all of you."]
]
```

| Speaker | Who |
|---|---|
| `'guide'` | Te Whē (the level's `tutorial.guideSprite`; the tip chime) |
| a cast name | The adopted bird (§13) |
| `'$role'` | The bird the event names (§10) |
| a species key | The event's bird of that species, else the first alive |

Moa speak with the upland moa portrait and the moa call, eagles as the Pouākai, kea as kea;
anything else uses Te Whē's picture and the chime. `extras` can override any tip field
(`title`, `pauseGame: false`, `guidePosition`, `voices`, ...) and add `lit: [...]`.

**Text tokens:** `{species}` (the event's species, or the one that died out), `{chapter}`
(the chapter's title), `{year}` (the level's year), and `{$name}`: a value a function action
left in `x.runner.vars.name` (a year's tally, a bird's name). Goal names take the same tokens,
so a goal can count toward a target that moves (`name: "The clan: {$clan} of {$clanTarget}"`).

**`lit`** takes `$role`s, cast names, species (all of them), `'focus'` (every focus bird),
`'nests'`, and placeable types (every one placed).

**`banner`** is big words across the map, waiting for the player to do something.

| Field | What |
|---|---|
| `words` | `"text"` or `[idle, inHand]`: the second shows while `tool` is selected or being moved. |
| `until` | Condition, in the banner's own scope (§7). |
| `tool` | Highlights its toolbar button. The banner gives way if the player can't afford it. |
| `needs` | What the player must be able to do for the banner to stand: `'place'` (a new `tool`; the default with a `tool`), `'move'` (move one of `tool`, default Storm: one must be on the land and its move price in hand) or `'none'`. A banner that can't be answered isn't shown, and gives way if it stops being answerable. |
| `lit` | As above, drawn through the dimming. |
| `pause` | Default `true`. `false`: play goes on and the screen isn't dimmed. |
| `maxSec` | Gives way after this long. |

A banner needs `until` or `maxSec`. A banner straight after a `say` in the same list shows
after the last line.

---

## 10. Reactions

```js
{ id: 'flock_low', when: { count: ['upland_moa', '<=', 3] }, once: false, cooldown: 60,
  say: [['guide', "Only a few upland moa are left."]] }
```

| Field | Default | What |
|---|---|---|
| `on` | | An event (table below). |
| `when` | | A condition, polled. Fires as it turns true, and not again until it has turned false. |
| `for` | | With `when`: it must have held this long (seconds) first. This makes a "need". |
| `if` | | Filters (§7), with the event's roles available. |
| `once` | `true` | `false` to repeat. |
| `cooldown` | 0 | Seconds between firings. |
| `max` | ∞ | The most times it fires. |
| `chapters` | | Only in these chapters (for a level-wide reaction). |
| own actions | | `unlock`, `notify`, `moment`, `say`, `banner`, `do` |
| `hints`, `until`, `solved`, `lost` | | A hint ladder (below). |

**Hint ladders: teach by clue first.** A reaction with `hints` and an `until` opens a *case* each
time it fires: a problem the simulation has raised. Nothing is said at first, because what the
player can see is the clue. While `until` has not come true, each rung is said at its `after`
time: a question, then the instruction. When `until` holds the case closes, and the record keeps
how far up the ladder it went, how long it took and how it ended.

```js
{ id: 'cover', on: 'eagle_hunting', if: { species: 'upland_moa' }, once: false,
  until:  { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] },
  solved: { all: [{ hidden: '$target' }, { any: [{ placed: 'Storm' }, { gained: ['moved:Storm', '>=', 1] }] }] },
  lost:   { not: { alive: '$target' } },
  hints: [
    { after: 4, notify: "The Pouākai is watching a moa. What could hide it?" },
    { after: 7, banner: { words: "Cover the hunted moa with a STORM", lit: ['$target', '$eagle'], pause: false, maxSec: 20 } }
  ] }
```

| Field | What |
|---|---|
| `until` | The case is over when this holds. Counted in the case's own scope (`placed`, `gained`, `seen` and `after` count from when the reaction fired), with the event's roles. |
| `hints` | `[{ after: sec, ...own actions }]`, in rising order of `after`. A rung's banner with no `until` of its own waits on the reaction's, and goes at its `maxSec` if that comes first. |
| `solved` | The ending that counts as the player's own answer. |
| `lost` | The ending that counts as the problem winning. Any other ending is recorded as `passed` (it went away by itself). |

Each closed case is a row in `game.chapters.caseLog` (and in a run's `.beats.json`): the
reaction, the rung reached (0: no hint was said), the seconds, the outcome, who it was about, the
chapter, and whether it was in a `transfer` chapter. It fires `case_closed`, and adds to the
counters `cases`, `solved` and `unaided` (solved at rung 0). The win card shows "Without a hint:
2 of 5." This record is the measure of the learner, as natural or forced beats are the measure
of the stage. Keep a rung's `after` inside the time the player has (for a hunt, the level's
`eagleTelegraph.graceSec`).

| Event | Roles (`$name`) and fields |
|---|---|
| `eagle_hunting` | `$eagle`, `$target` |
| `moa_killed` | `$moa`, `$eagle` |
| `egg_laid` | `$egg` (its species) |
| `egg_hatched` | `$moa` (the chick), `$egg` |
| `placement`, `placeable_moved` | `type` |
| `nest_raid` | `$site`, `$kea`, `$egg`, `success` (a kea reached an egg: `success: false` means the moa nearby saw it off) |
| `placeable_expired` | `type` (a placed item wore out) |
| `plant_sprouted` | `type` (the player sprouted a pātōtara) |
| `bird_hatched` | `$bird`, `$egg` (a flighted bird's, or a kākāpō's, egg hatched) |
| `bird_killed` | `$bird`, `$eagle` (an eagle took a flighted bird) |
| `plant_tapped`, `animal_selected` | `type` / `$animal` (the player rustled a plant; tapped an animal to read and follow it). Like placements, moves and sprouting, these are written to the log as kind `player` with the second they happened. |
| `case_closed` | `case` (the reaction's id), `rung`, `outcome` (`solved`, `lost`, `passed`), `sec`, `transfer` |
| `species_arrived` | `species`, `count` (newcomers came in over the pass: `rescueImmigration`, `eagleReturns`) |
| `species_left` | `$moa`, `species` (a grown young bird has set off over the pass: `dispersal`) |
| `eagle_gave_up` | `$eagle`, `species` (what it went for), `from` (its prey kept getting under cover: `coverSendsEagleAway`) |
| `season_change` | `seasonKey` |
| `chapter_start` | `chapter` |
| `goal_met`, `goal_failed` | `goal` |
| `nest_founded` | `$site` (a nest the player's planting founded) |
| `cast_lost` | `$entity`, `cast`, `cause` (an adopted character died: `'eagle'`, `'starved'`, or `'unknown'`) |
| `beat` | `beat`, `forced` |

---

## 11. Guaranteed beats

A beat makes something likely through the ecology, and forces it if it hasn't happened by a
deadline. Beats belong to a chapter.

```js
beats: [
  { id: 'hunt_comes', when: { after: 8 },
    invite: [{ eagle: { watch: 'grazing', hunger: 55 } }],   // make it likely
    until: { seen: ['eagle_hunting', { species: 'upland_moa' }] },   // the beat itself: an EVENT, recorded as it fires
    by: 30, force: [{ aim: { at: ['matriarch', 'upland_moa'] } }],   // guarantee it
    notify: "The Pouākai has seen the flock." }               // when it's done
]
```

| Field | What |
|---|---|
| `when` | Starts when this holds (default: as the chapter opens). Then `invite` runs. |
| `until` | Done when this holds (counted from the beat's start). |
| `by`, `force` | If not done `by` seconds after starting, `force` runs. With no `until`, the beat is done then. |
| `pinned` | Marks a beat whose outcome is fixed (shown in the inspector). |
| `once` | `true`: in a level whose chapters come round again (the five years), the beat stays done instead of re-arming each time. A first-year lesson. |
| own actions | Run when it's done. |

With neither `until` nor `by`, a beat is a plain step: done as soon as it starts. Sequence
beats with `when: { beat: 'previous' }` or `when: { since: ['previous', 3] }`. When a beat is
done, `beat: id` turns true and the `beat` event fires. The log and inspector show whether it
came naturally or was forced. Beat ids must be unique across the level.

---

## 12. Sites and places

```js
sites: {
  grazing: { find: 'flock', species: 'upland_moa' },
  lookout: { find: 'high', near: 'grazing', within: 250 },
  clearing: { find: 'open', near: 'grazing', dist: [60, 140] }
}
```

| Finder | Fields | Finds |
|---|---|---|
| `flock` | `species` (default: the first focus species) | The middle of the biggest group of them on one stretch of land |
| `nest` | `near` | The newest nesting site, or the nearest to `near` |
| `biome` | `biome` (key or keys), `near`, `far` | A spot in that biome, nearest `near` (`far: true`: furthest) |
| `high`, `low` | `near`, `within = 200` | The highest / lowest walkable ground |
| `open` | `near`, `dist = [60, 140]` | Open, placeable, non-forest ground at that distance |
| `edge` | `side` ('north', 'south', 'east', 'west'), `near` | Walkable ground by that edge |
| (none) | `near`, `dist: [a, b]` | Any walkable spot at that distance |
| | `{ x, y }` / `{ fx, fy }` | A fixed point / shares of the map |

- Level sites are found once, as the level starts. Chapter sites are found as the chapter
  opens, after its levers.
- A site can be `near` an earlier one.
- Sites found `near` a place stay on its stretch of land, unless `anyRegion: true`.
- A `nest` action's `as` name is a site too, from the moment it runs; the validator accepts it
  wherever a place is expected.

**A place** (`at`, `on`, `watch`, `near`, `separated`) can be:
- a site name;
- a `$role`;
- a cast name;
- a species (where its first live bird is);
- `{ x, y }`;
- an inline site spec;
- or, from a function, an entity.

---

## 13. Cast

Characters are adopted from the simulation: real birds that can really die.

```js
cast: { matriarch: { title: "The Matriarch", species: 'upland_moa', pick: 'oldest', pitch: 0.85 } }
```

| Field | What |
|---|---|
| `species` | Which birds to choose from. |
| `pick` | `'oldest'` (default), `'youngest'`, `'random'`. |
| `female` | `true` / `false` to choose by sex. |
| `recast` | `true`: when lost, another is adopted as the next chapter opens. |
| `manual` | `true`: not adopted on its own. An `adopt` action binds it: a chick on the `egg_hatched` event, a pair spawned at a nest, the nearest female to a place. |
| `title`, `sprite`, `sound`, `pitch`, `scale` | How it speaks. |

The cast is adopted as the level starts, and checked again as each chapter opens. When an
adopted bird dies, `cast_lost` fires with how it died (`if: { cast: 'matriarch', cause: 'eagle' }`),
so a lesson can answer a hunt and a famine with different words.

---

## 14. Functions (the escape hatch)

Any condition can be `(x) => bool` and any action `(x) => { ... }`. If something is needed
twice, ask for it as a real key.

| `x.` | What |
|---|---|
| `runner` | The `ChapterRunner` (see below) |
| `game` | The `Game` |
| `event` | The event being answered (`x.event.target`, ...), or null |
| `scope` | The scope (§7) |

Useful runner members:

| Member | What |
|---|---|
| `sim` | The simulation |
| `sites`, `flags`, `focus`, `castEnts` | Story state |
| `countOf(who)` | Live count, as in `count` |
| `gained(counter)` | Counter growth since the chapter opened |
| `entity(ref, event)`, `point(ref, event)` | Resolve a ref to a bird / a place |
| `allOf(species)` | Every live bird of a species |
| `regionsOf(species)` | Stretches of land a species lives on |

The terrain's `connected(a, b)` and `regionNear(p)` give land regions. Errors inside
functions are caught and logged.

---

## 15. Recipes

**Unlock a tool the first time it's needed**
```js
locked: ['shelter'],   // in the chapter
// level reactions:
{ id: 'first_hunt', on: 'eagle_hunting', if: { focus: true }, unlock: 'shelter',
  say: [['guide', "Under a FERN SHELTER a moa is hidden.", { lit: ['$target'] }]],
  banner: { words: "Grow a FERN SHELTER over the hunted moa", tool: 'shelter', lit: ['$target'],
            until: { any: [{ placed: 'shelter' }, { hidden: '$target' }, { not: { alive: '$target' } }] } } }
```

**Remind only when the player hasn't done it**
```js
{ id: 'nest_need', chapters: ['summer'], when: { not: { goal: 'nest' } }, for: 25,
  notify: "The upland moa still need a nest." }
```

**Branch on how a season went**
```js
next: [[{ count: ['upland_moa', '>=', 8] }, 'thrive'], [true, 'rebuild']]
```

**A moment for something the sim did**
```js
{ id: 'first_chick', on: 'egg_hatched', if: { species: 'upland_moa' },
  moment: { on: '$moa', text: "An upland moa chick!" } }
```

**Teach the first time, then leave it to the sim.** Guarantee the first hunt with a beat
(§11). Answer later hunts with a `notify` reaction (`once: false`, `cooldown`), not a pausing
scene.

**A free first step**
```js
start: [{ place: { type: 'speargrass', at: 'grazing', standing: true } }]
```

---

## 16. Debugging

| Tool | How |
|---|---|
| Validator | Problems print as `[chapters] <level>: ...` warnings when the level loads. `ChapterRunner.validate(MODULE_EXAMPLE)` in the console lists them without playing. |
| Inspector | Debug mode (**D**), then **J**: the chapter, what it waits on, goals, beats, reactions, cast, recent log. |
| Log | `game.chapters.log`, or `game.chapters.dump()` for a table. |
| Jump | `game.chapters.jump('winter')`, or load with `?chapter=winter`. The season clock isn't moved. |
| Lenses | **L** in debug mode: "Land regions (now / year-round)". |
| The eagle | Tap an eagle: a label says in words how hungry it is and what it is doing (with `eagleTelegraph`, §19). |

**From the command line.** Both tools drive a headless browser through Playwright
(`tools/_headless.js`; `npm i -D playwright && npx playwright install chromium` where it isn't
preinstalled).

| Command | What |
|---|---|
| `node tools/validate.js` | The level-format checks on every level and the engine's checks on every chapter level, without playing. `--smoke` also starts each level and runs it 15 s, reporting any page or console error. `--only <id>` for one level. Exits non-zero on anything but a warning. |
| `node tools/batch.js --level <id or family> --sketch <label> --seeds 1..10` | Research runs. Each seed plays headless until the level ends, `--years n` have passed, or `--seconds n` (300) of play. It writes `<name>.csv` (populations every 10 s, the story log in the `event` column) and `<name>.beats.json` (the log, each beat natural or forced, the result) into `--out` (`tests/`), and prints a line per run: the result, each beat, who the eagle took, any cast lost, and a replay hash (the same seed prints the same hash on the same machine and browser; across machines a run starts the same and then drifts). `--player cover` stands in for a player who puts a Storm over any cast member an eagle is hunting; `--player basic` also sprouts bare pātōtara and sets wharariki by the family in winter. Six more stand-ins **pay** for what they do and tend every animal of a focus species, to show how different players fare: `tend` (covers 2 s into a wind-up, feeds the hungry), `slow` (5 s), `late` (8 s), `storms` (covers, never feeds), `feeder` (feeds, never covers), `none`. With these the line also gives the focus animals left, the year reached, what was spent and the mauri in hand. `--trace <cast>` prints that bird once a second: state, hunger, target plant and its distance, the stall counter. |

| `node tools/coverage.js [--level <id>]` | Which rules each level plays by (worked out from its switches and tools) and which lesson's `teaches` covers each. A rule in force that no lesson teaches is a gap; a level playing by the opposite of a taught rule is marked as contradicting it. The table of rules is at the top of the tool. |
| `node tools/replaydiff.js --level <id> --seed 1 --out a.txt` | Prints a fingerprint of the simulation once a second, and first a fingerprint of the browser's own arithmetic. Run the same command on two machines and `diff` the files: the first differing line is where the runs part, and a differing `math` line names the functions that cause it. |

With a lesson that has hint ladders, `tools/batch.js` also prints, for each run, how each
problem was answered: with no hint, after the question, after being told, went away by itself,
or lost; and the same for the unprompted stretch.

**URL parameters** (`index.html?...`): `level=<id or family>`, `sketch=<label>`, `seed=<n>`
(the land and the opening stage are the same everywhere; the whole run replays exactly only on
the same machine and browser), `bench=1` (record from the first
frame, no splash), `years=<n>` (end the run after that many), `chapter=<id>`, `render=2d`.

Headless in the preview (the game's global is `game`):

```js
game.loadLevel('module_example'); game._startLoading();
for (let i = 0; i < 600 && game.state === GAME_STATE.LOADING; i++) redraw();
game.tutorial.skipTutorial(); game.state = GAME_STATE.PLAYING;
for (let i = 0; i < 3000; i++) game.update(1);   // 50 s of play
game.chapters.dump();
```

---

## 17. Rules and gotchas

**Design rules**
- **Script the stage and the timing, not the animals.** Use levers and beats, not orders.
- **Pin the first time, free the repeats.** The first time a mechanic appears, guarantee it;
  after that, leave it to the sim.
- **A failure is a branch, not a reset.** Prefer `next` on an outcome to a `required` goal.
- Use `holdSeason` sparingly. Used heavily, it's a rail.

**What the validator enforces** (besides the format checks: unknown keys, verbs, conditions,
species, tools, speakers, places, events, chapter ids and goal references)
- A module (`module: true`) must have a `claim`.
- `aim` anywhere but a beat's `force` warns.
- A beat `until` made only of state conditions (`hunting`, `hunted`, `hidden`, `alive`, ...)
  warns: put `seen` or a counter beside it.
- A `holdSeason` with no `maxSec` warns.
- `guide` ids must be Field Guide entries, `nextLevel` a level, `sketch.of` a registered family.

**Gotchas**
- **One verb per action.** `{ notify: 'x', unlock: 'y' }` is an error; split it.
- **`tools` replaces the whole toolbar.** List every tool the chapter offers.
- **Player actions only.** `placed` and `gained: ['placed:…']` count the player's placements,
  not a scripted `place`.
- **Reactions fire once by default.** Polled ones fire on the turn to true. Repeating ones need
  `once: false`, and usually a `cooldown`.
- **Lines and banners pause play.** A banner whose `until` can't come true waits until the
  player can't afford its `tool` or `maxSec` passes. Give it a way out.
- **`protect` uses the species present when it runs.**
- **Overlays persist.** `mechanics` overlays last across chapters; the level's values come back
  on the next run.
- **`aim` targets moa only.**
- **A beat's `until` should be an event, not a state.** `hunting: true` / `hunted: ref` read the
  eagle *right now*, every 6 frames; a lock can drop between polls, so the state can read false
  for seconds while hunt events fire, and the beat is then wrongly logged as forced (seen in
  testing: 1 run in 5). Use a counter in the beat's scope (`gained: ['hunts:upland_moa', '>=', 1]`)
  for "it happened"; keep the state forms for "it is happening now" (banners, reactions).
- **Land checks use the snow as it is now.** `separated`, `regions` and `near` sites use the
  current snow line.
- **Moa portraits.** Every moa speaks with the upland moa portrait (the only moa portrait
  the tip panel has).
- **Not built yet:** ordering a cast member to walk somewhere (`order`), and a `pacing` lever
  (a tension curve on eagle hunger over a chapter, so fewer beats need a deadline). See
  `MODULE_ENGINE_PLAN.md`.

---

## 18. Sketches, families and the template

A module is written once, as a **factory** that takes a sketch name and returns the level, and
is registered once per sketch. Each sketch is the same lesson at a different setting of the
**emergence dial**: how much is guaranteed, how long the eagle's wind-up is, whether prompts
pause play, how many eagles there are. Side by side in the menu, the sketches let a class or a
study compare them; the beat log says how often each needed help.

```js
const STORM_SKETCHES = {
  guided: { label: 'Guided', forced: true,  hold: true,  graceSec: 6,   pause: true },
  open:   { label: 'Open',   forced: false, hold: false, graceSec: 3.5, pause: false }
};
function makeChaptersStorms(sketchKey) {
  const D = STORM_SKETCHES[sketchKey];
  return {
    id: `chapters_storms_${sketchKey}`, module: true, section: 'chapters',
    sketch: { of: 'chapters_storms', label: D.label, dial: D },
    claim: "A moa under a storm can't be seen by the Pouākai.",
    guide: ['haasts_eagle', 'upland_moa'],
    // ...the level, reading the dial as D.<name>...
  };
}
for (const key of Object.keys(STORM_SKETCHES)) LEVEL_REGISTRY.register(makeChaptersStorms(key));
LEVEL_REGISTRY.registerFamily('chapters_storms', { label: "Storms", defaultSketch: 'chapters_storms_guided' });
```

- The menu's Chapters section draws one card per family with a small button per sketch
  (its `label`). Progress and best scores are kept per sketch, since each has its own id.
- `?level=<family>` opens the family's default sketch; `tools/batch.js --level <family>
  --sketch <label>` picks one.
- The dial is any object. Keep its keys few, and name them for what they change in play.
- **The lesson kit** (`levels/_chapters_kit.js`) holds the pieces lessons share, as functions
  that return reactions or a chapter: `coverLadder` (the hint ladder for an eagle on a focus
  moa), `stormLadder`, `praise` (a word for an answer given before any hint), `gaveUp`,
  `arrivals`, `transferChapter` (the unprompted stretch), `familyCalendar` and `hensHaveLaid`
  (the family on the breeding calendar), `quietAfterYear`. The **Clues** sketch of each lesson
  is built from it: the Guided sketch's stage and guarantees, with every instruction swapped
  for a ladder, no floors, the family on the calendar, and one more season at the end in which
  nothing is said. A new lesson should start from the kit, not from a copy of an old sketch.
- **Lessons told in the animals' voices.** The journey's first tiles (`levels/journey_01_storm.js`,
  `journey_02_patotara.js`, and the `journey` setting of `chapters_freeplay.js`) put the first
  modules' stories back, in the family's, the kea's and the Pouākai's own lines. The kit's
  pieces for that:
  - `prologue({ chapter, lines, opening, seenKey })`: the level opens on black, Te Whē says
    `lines` (once a session), the screen fades in, and `opening` is said. Sets the flag
    `opened`, which a first beat can wait on.
  - `huntInVoice({ species, teach, later })`: the eagle's hunts. With `teach`, the first is
    told outright as module 0's scene (the Pouākai's two lines, the hunted bird's "Eeek!", then
    the instruction). Every other hunt climbs the ladder: nothing, the Pouākai's own mutter,
    the instruction.
  - `stormInVoice({ teach, voice, lit })`: a storm blown out. With `teach`, the first unlocks
    the Storm and is told outright, with one line on mauri. Later ones: nothing, a word from
    `voice`, the instruction.
  - `headFor(names, place)`: the named birds take the place as home and walk there by their
    own migration (`Moa._keepWalking`). A fright does not end the walk; twelve seconds of
    walking with no progress does. Used for a story's walks (down in autumn, home in spring),
    which the open simulation did not make in time.
  - `idle(x)`: every line said so far has been read. `saidAndRead(flag)`: the flag is set and
    every line read (for a chapter that ends on its closing words). `pouakai(text)`: a line
    titled "Pouākai".
  A role that turns out to be a cast bird speaks under the cast name: `['$target', "Eeek!"]`
  is titled "Mama Moa" when the eagle is after Mama.
- `levels/_template_chapters.js` is a copyable module with a claim, a guide list, two sketches,
  one beat and a few reactions, with comments written for a first-time author. Copy it, rename
  the family and the ids, add a `<script>` tag for it in `index.html` after the template's,
  and run `node tools/validate.js --only <your id>`, then `tools/batch.js` across a few seeds.

---

## 19. Mechanics the modules switch on

The chapters modules teach rules that live in the open simulation. Each is a flag in the level's
`mechanics` (read behind a `typeof LEVEL_MECHANICS` guard, so other levels are untouched), or a
per-level override of a placeable. The ones added for the modules, and the file that reads each:

| Flag | What it does | Where |
|---|---|---|
| `availablePlaceables.Storm: { blocksEagleVision: true, distractsEagles: false }` (a level key, not a flag) | The Storm is cover, not a stun: a moa under it can't be seen. | `mauri_placeable.js` |
| `coverBreaksLock: true` | An eagle loses a target that reaches full cover and turns to other prey, and a strike on a covered moa fails. A change of target because the last one is gone from view counts as a fresh hunt: a new wind-up, `eagle_hunting` again. | `mauri_eagle.js`, `mauri_simulation.js` |
| `coverCalmsMoa: true` | A moa fully under cover holds still for an eagle that isn't on it, instead of bolting into the open. | `mauri_moa.js` |
| `stormAttract: { species, strength, lookahead, reach, inner, minCos, hungryMult }`, or `false` | Storms draw moa (on by default for upland moa on a journey level; `STORM_ATTRACT_DEFAULT`). Where a bird is going is still its own: a storm near its walk bends the way it steers (a heading between the destination and the storm), so the route bows through the storm and still arrives. One with nowhere to be ambles over and rests under it. Only the storm that draws it most counts; none inside a storm's inner part, none behind it; weaker when hungry, no bend on the way to food, none when starving, feeding or bolting. The held-storm preview predicts the bent route with the same rule. | `mauri_moa.js`, `mauri_sketch.js` |
| `lureUnderStorm: true` | A tap on a plant under a storm lures moa as usual. | `mauri_sketch.js` |
| `placeableQueryRadius: 100` | How far a moa notices placed items (80 otherwise; storms are wide). | `mauri_moa.js` |
| `eagleTelegraph: { graceSec, warnBelow }` | The visible wind-up. Every fresh hunt opens with `graceSec` seconds in which the eagle chases slowly and can't strike, its "!" showing. The eagle commits to the bird it picked while it can see it and it is in range; any change of target is a fresh hunt with the full window, so no bird is struck without a wind-up on it. Within `warnBelow` of its hunt threshold its hunger bar pulses amber. A tap on an eagle says in words how hungry it is and what it is doing. | `mauri_eagle.js`, `mauri_sketch.js` |
| `eagleSurplusPreference: true`, with `eaglePreyPopThreshold` and `eagleScarcePreyPenalty` | To a hunting eagle a species with numbers to spare reads as nearer, and one at or under the threshold as further, so a bird kept from one moa turns to the herd. | `mauri_eagle.js` |
| `keaRaidsEggs: 'odds'`, with `keaRaid: { baseSuccess, moaPenalty, minSuccess, moaRadius }` | A kea that reaches an egg at a nest rolls the raid odds, which fall with every moa within `moaRadius`; a failed raid shoos it off. Both outcomes fire `nest_raid`. | `mauri_kea.js`, `mauri_simulation.js` |
| `keaBerryLureRadius: 400` | Sprouted pātōtara draws kea from that far. | `mauri_kea.js` |
| `sproutPatotara: true`, `placedPlantsSeasonal: true` | A placed pātōtara patch is bare until the player sprouts it (press and hold), and the plants it grows follow the seasons: nothing to eat on them in winter, when the patch neither attracts nor feeds. | `mauri_sketch.js`, `mauri_plant.js`, `mauri_placeable.js` |
| `seasonalBirdBreeding: 'calendar'` | Kea, kākā, kōkako, kākāpō and the giant moa breed by the `calendar` in their species data: `lay` (the season) with `layFrom`–`layTo` (how far through it), `clutch: [min, max]`, `every: [min, max]` years between clutches, `maturityYears`, `success` (the chance of a clutch in a given year; `mastSuccess` in a mast year). Species without a calendar breed as before. | `mauri_kereru.js`, `mauri_moa.js`, the species files |
| `eagleHuntsFlyers: true`, with `eagleFlyerHungerGate`, `eagleFlyerPreyPenalty`, `eagleFlyerFeed` | A hungry eagle takes flighted birds too (an older flag; `bird_killed` now reports it). | `mauri_eagle.js` |
| `hungerRateMult`, `juvenileHungerMult` | Scale how fast every moa, or a chick, gets hungry. A small land starves a family at the open rate. | `mauri_moa.js` |
| `populationFloors: { species: n }` | A species the eagle can't take, and hunger can't kill, below `n`: the herd a lesson needs. | `mauri_simulation.js` |
| `coverSendsEagleAway: { after = 2, sec = 45 }` | Each time the bird an eagle is on gets under cover counts as a foil. After `after` of them in one hunger it gives that species up for `sec` seconds and moves its hunt to other prey, a plentiful species reading as nearer. Fires `eagle_gave_up`. | `mauri_eagle.js` |
| `moaCalendar: true` (with `seasonalBirdBreeding: 'calendar'`) | Every moa keeps its species' breeding calendar (the upland, little bush, stout-legged and heavy-footed moa have opt-in ones): one clutch in its season, years between clutches, years to grow up. A hatchling is sized by its year of birth, and counts as a juvenile for its whole first year. Asked of both partners, so a hen who has laid can't be courted again that year. | `mauri_moa.js`, `mauri_species_data.js` |
| `familyLinks: true`, `juvenileFollow: { within, untilYears, pull }` | A chick knows its mother (an egg a level set down takes the nearest hen), keeps within `within` of her for `untilYears`, and the two stand close. | `mauri_simulation.js`, `mauri_moa.js` |
| `focalSpecies: [...]`, `focalWildFoodMult` | Wild browse gives the focal species only this share of its food. What the player grows for them, and pātōtara the player has sprouted, feed in full, so tended food decides how well they breed and winter. | `mauri_moa.js` |
| `rescueImmigration: { species: { below, count, afterSeasons } }` | In place of floors: a species that has lived here and stood below `below` for `afterSeasons` season turns is joined by `count` from over the pass. Fires `species_arrived`. | `mauri_sketch.js` (`Game._seasonalArrivals`) |
| `eagleReturns: { afterSeasons }` | With no eagle left, a new one takes the territory after that many turns, and losing the last one is not a loss. Fires `species_arrived`. | `mauri_sketch.js` |
| `dispersal: { species: { above, maxPerYear, season } }` | While a moa species stands above `above` at the turn into `season`, its oldest grown young (hatched here, not named by the level) walk to the edge of the land and are gone. Fires `species_left`. | `mauri_sketch.js` (`Game._seasonalDepartures`), `mauri_moa.js` |
| `noKinPairing: true` (with `familyLinks`) | A moa does not court its mother, father, chick, or a sibling by the same hen. On for every journey level (`CHAPTERS_KIT.journeyMechanics`). | `mauri_moa.js` |
| `birdMaxPopulation: { kea: 6, ... }` | A cap per bird species for a level of small flocks; eggs in the nest count toward it. | `mauri_kereru.js` |
| `ecosystemIncome: { base, perFocusAnimal, perAnimal }` | Mauri a second on a level of small herds: `base` while any focus animal lives, then so much for each focus animal and for every other moa and bird. Shown on the mauri dial. `noPopulationMilestones: true` switches off the older lump sums. | `mauri_sketch.js` (`Game.ecosystemIncomePerSec`) |
| `huntCamera: { focusOnly }` (with the level key `userCamera`) | When the player is zoomed in and an eagle starts on an animal off screen (a focus animal, with `focusOnly`), the view eases to frame hunter and hunted, and back when it is over. Not while the player is dragging or holding an item. | `mauri_sketch.js` (`Game._onHuntStart`) |

