# Scripting modules

How to write a module with the chapters engine (`ChapterRunner`, `mauri_chapters.js`). A
module is an ordinary emergent level with a `chapters` list on top. The engine never moves
wild animals: it sets the stage (levers), measures what happened (goals), and answers it
(reactions, lines, banners).

- Worked example: `levels/chapters_prototype.js`.
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
| `holdSeason` | | `{ until, at = 0.9 }`: the season clock waits at `at` of the way through until `until` holds. |
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
| `species`, `focus`, `cast`, `type`, `success` | Filters on the event a reaction answers: the subject's species, whether it's a focus species, whether it's that cast member, the placed type, a raid's result. |
| `any: [...]`, `all: [...]`, `not: cond` | Combinations. |

**Ops:** `>=` `<=` `>` `<` `==` `!=`.

**Counters** (for `gained`):

| Counter | Counts | Suffix |
|---|---|---|
| `mauri` | mauri earned | |
| `nests` | nests founded | |
| `laid`, `hatched`, `killed`, `hunts` | eggs, chicks, eagle catches, eagle hunts started | `:species` (`hatched:upland_moa`) |
| `placed`, `moved` | the player's placements and moves | `:type` (`placed:shelter`) |
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
| `moment` | `{ on, text, sec = 2.5, zoom = 2.4 }`: holds the world and closes in on `on`, with big words. |
| `camera` | `{ on, zoom = 1.6, sec = 1.5 }`, or `'home'` |
| `tools`, `unlock`, `lock` | The toolbar (key or keys) |
| `place` | `{ type, at, standing }`: a placeable, free. `standing: true` never wears out. |
| `sow` | `{ plant, at, count = 4, radius = 30, growth = 0.9, sprouted = true }` |
| `spawn` | `{ type, at, count = 1, radius = 20 }`: adult moa or birds at a place |
| `aim` | `{ at, which = 'nearest', sec = 20 }`: an eagle goes for that moa, whatever its hunger. It still can't see a moa in cover. `at` can be a list of fallbacks. |
| `flag`, `unflag` | A story flag name |
| `reward` | Mauri |
| `next` | A chapter id or `'win'`: closes this chapter at the next check |
| `win`, `lose` | `true` / a reason |

**Ecology toolbox** (levers; the sim decides the outcome): `focus`, `protect`, `nesting`,
`introduce`, `mechanics` (§5), and:

| Verb | Value |
|---|---|
| `eagle` | `{ which = 'all', near, hunger, watch, grace }`. `which`: `'all'`, `'nearest'` (to `near` or `watch`), or a ref. `hunger`: 0–100 (they hunt above about 45). `watch`: move their patrol over a place. `grace`: seconds the eagle chases but can't strike (a "last chance"). |

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
(the chapter's title).

**`lit`** takes `$role`s, cast names, species (all of them), `'focus'` (every focus bird),
`'nests'`, and placeable types (every one placed).

**`banner`** is big words across the map, waiting for the player to do something.

| Field | What |
|---|---|
| `words` | `"text"` or `[idle, inHand]`: the second shows while `tool` is selected or being moved. |
| `until` | Condition, in the banner's own scope (§7). |
| `tool` | Highlights its toolbar button. The banner gives way if the player can't afford it. |
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

| Event | Roles (`$name`) and fields |
|---|---|
| `eagle_hunting` | `$eagle`, `$target` |
| `moa_killed` | `$moa`, `$eagle` |
| `egg_laid` | `$egg` (its species) |
| `egg_hatched` | `$moa` (the chick), `$egg` |
| `placement`, `placeable_moved` | `type` |
| `nest_raid` | `$site`, `success` |
| `season_change` | `seasonKey` |
| `chapter_start` | `chapter` |
| `goal_met`, `goal_failed` | `goal` |
| `nest_founded` | `$site` (a nest the player's planting founded) |
| `cast_lost` | `$entity`, `cast` (an adopted character died) |
| `beat` | `beat`, `forced` |

---

## 11. Guaranteed beats

A beat makes something likely through the ecology, and forces it if it hasn't happened by a
deadline. Beats belong to a chapter.

```js
beats: [
  { id: 'hunt_comes', when: { after: 8 },
    invite: [{ eagle: { watch: 'grazing', hunger: 55 } }],   // make it likely
    until: { hunting: true },                                 // the beat itself
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
| `title`, `sprite`, `sound`, `pitch`, `scale` | How it speaks. |

The cast is adopted as the level starts, and checked again as each chapter opens. When an
adopted bird dies, `cast_lost` fires (`if: { cast: 'matriarch' }`).

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
- **Land checks use the snow as it is now.** `separated`, `regions` and `near` sites use the
  current snow line.
- **Moa portraits.** Every moa speaks with the upland moa portrait (the only moa portrait
  the tip panel has).
- **Not built yet:** ordering a cast member to walk somewhere (`order`). See
  `MODULE_ENGINE_PLAN.md`, phase 2.
