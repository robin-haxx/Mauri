// ============================================================================
// TEMPLATE: a module on the chapters engine (copy this file to start a new one)
// ============================================================================
// A module is an ordinary level of the open simulation with a lesson framed around it. Nothing
// in it moves an animal: the chapters set the stage (tools, who is on stage, where things are),
// put pressure on (the eagle's hunger, where it watches), measure what happened (goals) and
// answer it (lines, prompts and moments). MODULE_SCRIPTING.md explains every key.
//
// To make a new module: copy this file, rename the ids and the family, write the claim (the one
// rule it teaches), choose the land, decide the first demonstration (the beat) and the prompts
// (the reactions), add a <script> tag for it in index.html after this one, and run
//   node tools/validate.js --only <your level id>
// to check it, then
//   node tools/batch.js --level <your family id> --sketch Guided --seeds 1..5
// to see how it plays across seeds (beats natural or forced, who the eagle took).
//
// This template is devOnly: it shows in the level select only in debug mode (D).
// ============================================================================

const TEMPLATE_FAMILY = 'template_chapters';

// The dial: every sketch is the same lesson at a different setting. Add settings as you need
// them; the level below reads them as D.<name>.
const TEMPLATE_SKETCHES = {
  guided: { label: 'Guided', forced: true,  hold: true,  graceSec: 6, pause: true },
  open:   { label: 'Open',   forced: false, hold: false, graceSec: 3.5, pause: false }
};

function makeTemplateModule(sketchKey) {
  const D = TEMPLATE_SKETCHES[sketchKey];
  return {
    id: `${TEMPLATE_FAMILY}_${sketchKey}`,
    name: `Template (${D.label})`,
    module: true,                 // a module: the Chapters section, no level splash
    devOnly: true,
    section: 'chapters',
    sketch: { of: TEMPLATE_FAMILY, label: D.label, dial: D },
    // The one rule this module teaches, in a line a partner can read. The validator requires it.
    claim: "A moa under cover can't be seen, so the eagle hunts what it can see.",
    // The Field Guide entries it rests on (ids from mauri_encyclopedia.js).
    guide: ['haasts_eagle', 'upland_moa'],
    // nextLevel: 'another_level_id',   // the win card's "Next module" button
    unlockCondition: null,

    // ---- The land and the cast: as any level -------------------------------------------
    zoom: 2.0,
    startSeason: 'summer',
    terrain: Object.assign({}, LEVEL_GLACIAL_KAHURANGI.terrain),
    biomes: LEVEL_GLACIAL_KAHURANGI.biomes,
    species: { moa: ['upland_moa', 'stout_legged_moa'], eagle: ['haasts_eagle'], other: [] },
    startingSpecies: 'upland_moa',
    initialSpeciesDistribution: { upland_moa: 4, stout_legged_moa: 6 },
    initialEntityCounts: { moa: 10, eagle: 1 },
    economy: { startingMauri: 80, seasonDuration: 2700 },   // 45 s a season
    // Every tool any chapter offers (a chapter's `tools` picks from these). The Storm here is
    // cover, not a stun.
    availablePlaceables: {
      shelter: { cost: 35 },
      Storm: { cost: 40, moveCost: 10, radius: 64, blocksEagleVision: true, distractsEagles: false }
    },
    mechanics: {
      noSpeciation: true,
      emergentEagles: true, eagleMaxPopulation: 1,
      eagleTelegraph: { graceSec: D.graceSec, warnBelow: 10 },   // the visible wind-up
      eagleSurplusPreference: true, eaglePreyPopThreshold: 1,    // the herd before the few
      coverBreaksLock: true, coverCalmsMoa: true, lureUnderStorm: true, placeableQueryRadius: 100,
      hungerRateMult: 0.7,                                         // (a small land starves a flock at the open rate)
      populationFloors: { stout_legged_moa: 2 }
    },

    // Named characters, adopted from live birds (a real moa that can really be lost).
    cast: {
      matriarch: { title: "The Matriarch", species: 'upland_moa', pick: 'oldest', female: true }
    },
    // Named places, found on the land as the level starts.
    sites: {
      flock: { find: 'flock', species: 'upland_moa' },
      lookout: { find: 'high', near: 'flock', within: 200 }
    },

    // ---- The chapters: one per season here ------------------------------------------------
    chapters: [
      { id: 'summer', title: "Summer",
        tools: ['Storm'],
        focus: ['upland_moa'],
        start: [
          { say: [['guide', "The upland moa graze the tops. The Pouākai hunts from above.", { lit: ['upland_moa'] }]] }
        ],
        beats: [
          // The first demonstration: invited through the ecology, forced by a deadline only in
          // the guided sketch. `until` is an event the runner counted, not a state.
          Object.assign({ id: 'first_hunt', when: { after: 10 },
            invite: [{ eagle: { watch: 'flock', hunger: 41 } }],
            until: { seen: ['eagle_hunting', { species: 'upland_moa' }] }, once: true },
            D.forced ? { by: 30, force: [{ aim: { at: ['matriarch', 'upland_moa'] } }] } : {})
        ],
        goals: [
          { id: 'seen_off', name: "See off the Pouākai's first hunt", done: { all: [{ beat: 'first_hunt' }, { not: { hunting: true } }] }, reward: 15 },
          { id: 'keep', name: "Keep {target} upland moa", keep: { count: ['upland_moa', '>=', 3] }, required: true,
            failReason: "Too few upland moa are left on the tops." }
        ],
        holdSeason: D.hold ? { until: { beat: 'first_hunt' }, at: 0.9, maxSec: 30 } : undefined
      },
      { id: 'autumn', title: "Autumn",
        goals: [{ id: 'through', name: "Come through the autumn", survive: true, reward: 20 }],
        next: 'win'
      }
    ],

    // ---- All year: the words that answer what the simulation does ---------------------------
    reactions: [
      { id: 'cover', on: 'eagle_hunting', if: { species: 'upland_moa' },
        banner: { words: ["The Pouākai has seen a moa! Put a STORM over it", "Set the STORM down over the moa"],
                  tool: 'Storm', until: { any: [{ hidden: '$target' }, { not: { alive: '$target' } }, { not: { hunted: '$target' } }] },
                  lit: ['$target', '$eagle'], pause: D.pause, maxSec: 25 } },
      { id: 'herd_taken', on: 'moa_killed', if: { species: 'stout_legged_moa' },
        say: [['guide', "The Pouākai took a stout-legged moa instead: it has to eat, and they are many."]] },
      { id: 'matriarch_lost', on: 'cast_lost', if: { cast: 'matriarch' },
        notify: ["The old matriarch is gone.", 'error'] }
    ],

    goals: [],
    menu: {
      title: `Template (${D.label})`, subtitle: "A chapters module", moduleLabel: "Template",
      focusItem: { placeable: 'Storm', name: "Storm" },
      areaLabel: "Kahurangi uplands, Te Waipounamu", areaSubtitle: "Debug mode only",
      featuredSpecies: { key: 'upland_moa', displayName: 'Upland Moa', localName: 'Moa Pukepuke', spriteKey: 'upland_walk_01', spriteScale: 0.4 },
      flavorText: ["A copyable starting point for a new lesson."],
      displayPlants: ['tussock', 'beech'],
      art: { coreWidth: 1600, coreHeight: 1080, bgColor: [28, 32, 40] }
    },
    tutorial: { guideSprite: 'mantis_talk', tips: null }
  };
}

for (const key of Object.keys(TEMPLATE_SKETCHES)) LEVEL_REGISTRY.register(makeTemplateModule(key));
LEVEL_REGISTRY.registerFamily(TEMPLATE_FAMILY, { label: "Template", defaultSketch: 'template_chapters_guided' });
