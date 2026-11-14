// ============================================================================
// THE JOURNEY, TILE 2: PĀTŌTARA, told as the second module told it
// ============================================================================
// What this is. The Pātōtara lesson of the chapters engine (levels/chapters_patotara.js, its
// Clues setting), with the story of the second module put back: the same moments in the same
// order, in the voices of the two families and the kea (levels/tutorial_module_01_patotara.js).
//
// The sequence, as module 1:
//   opening    A line from Te Whē on black (a year has passed), then the family walks in:
//              "Are we there yet?" They reach another family's nest and are made welcome.
//   summer     The pātōtara by the nest is bare: press and hold to sprout it. The berries
//              bring Strongbeak, who calls Skraak and Huft-Tuft. They mean to have the egg.
//              Moa gathered at the nest drive them off. The egg hatches: Koukou.
//   autumn     The families part for winter, each to its own low ground. The Pouākai.
//   winter     The berries are gone. Flax: wharariki, grown by the family.
//   spring     Flax flowers for Koukou's family, and the way home. NOTHING IS PROMPTED.
//
// What the simulation does on its own. As the Clues setting: the kea's interest in berries
// and eggs, every raid's odds (which fall with each moa near the nest), the hatch, the eagle.
// The script sets the stage, makes sure a raid is tried in summer (two more kea are sent to
// the bush if none has tried 45 seconds after the sprouting, logged as forced), and speaks.
// The walks are the story's, as on tile 1 (CHAPTERS_KIT.headFor): in, down, and home.
//
// How it teaches. By clue first, in voice:
//   - Sprouting is a new control, so it is told outright.
//   - The raid is the lesson. Nothing is said beyond the kea's own scene (Skraak sees the egg;
//     Pukepuke shouts at them). Then Skraak counts the moa at the nest out loud. Then the
//     instruction.
//   - Winter food climbs the same ladder: Papa's line, then Pukepuke's question, then the
//     instruction.
//   - The storm was taught on tile 1, so the Pouākai's hunts climb the ladder from the first.
//
// THE WORDS. Every line marked (M1) is the author's, from module 1, word for word (two
// spellings of WHARARIKI are corrected). The lines marked NEW were written for moments module
// 1 did not have, and are the author's to replace:
//   recap          Te Whē, on black
//   skraak_counts  Skraak's question rung
//   egg_lost       Koukou's mother, when a raid takes the egg (in module 1 that lost the level;
//                  here the neighbours lay again, as the Clues setting)
//   where_flax     Pukepuke's question rung in winter
//   on_the_way     Mama, if spring runs out before the family is home
// The neighbours' names are placeholders, as they were in module 1.
// ============================================================================

const JOURNEY_PATOTARA = (() => {
  const K = CHAPTERS_KIT;
  const base = makeChaptersPatotara('clues');
  const D = PATOTARA_SKETCHES.clues;
  const FAMILY = ['mama', 'papa', 'pukepuke'], FRIENDS = ['friendMama', 'friendPapa', 'koukou'];
  const TAUGHT = ['summer', 'autumn', 'winter'];
  const kea = (title, text, extra) => ['kea', text, Object.assign({ title }, extra || {})];
  const eggInNest = (x) => x.runner.sim.eggs.some(e => e.alive && !e.hatched && e.parentSpecies === 'upland_moa');
  const homeNow = { all: [{ near: ['mama', 'home', 120] }, { near: ['pukepuke', 'home', 140] }] };
  const flaxNear = { near: ['wharariki', 'mama', 90] };
  const sprouted = (x) => (x.runner.counters.sprouted || 0) > 0;
  const firedAgo = (x, id, sec) => x.runner.reactions.some(r => r.id === id && r.fired && r.lastAt < x.game.playTime - sec * 60);

  return Object.assign({}, base, {
    id: 'journey_patotara',
    name: "Pātōtara",
    section: 'journey', journey: true, sketch: undefined,
    nextLevel: undefined,
    waysOn: [{ label: "The five years", tile: 't2f' }],
    outcome: { birds: [...FAMILY, ...FRIENDS] },

    cast: {
      mama:       { title: "Mama Moa",       species: 'upland_moa', manual: true, pitch: 0.85 },
      papa:       { title: "Papa Moa",       species: 'upland_moa', manual: true },
      pukepuke:   { title: "Pukepuke",       species: 'upland_moa', manual: true, scale: 0.7, sound: 'chick' },
      friendMama: { title: "Friendly Moa",   species: 'upland_moa', manual: true, pitch: 0.95 },   // (placeholder name, as module 1)
      friendPapa: { title: "Friendly Papa",  species: 'upland_moa', manual: true, pitch: 1.1 },    // (placeholder name)
      koukou:     { title: "Koukou",         species: 'upland_moa', manual: true, scale: 0.55, sound: 'chick', pitch: 1.15 }
    },

    sites: Object.assign({}, base.sites, {
      arrive:     { near: 'friendNest', dist: [125, 165] },   // where the family walks in from
      shore:      { near: 'tarn', dist: [34, 60] },           // the family's winter ground, by the water
      friendSpot: { near: 'tarn', dist: [130, 190] }          // the neighbours' own winter ground
    }),

    chapters: [
      { id: 'summer', title: "Summer: the pātōtara glade",
        tools: ['patotara', 'Storm'],
        focus: ['upland_moa'],
        beats: [
          // A raid is tried in summer: the berries invite the kea; two more are sent to the
          // bush if none has tried within 45 seconds of the sprouting (logged as forced).
          { id: 'raid_comes', when: { seen: ['plant_sprouted'] },
            until: { seen: ['nest_raid'] }, once: true,
            by: 45, force: [{ spawn: { type: 'kea', at: 'patch', count: 2, radius: 20 } }] }
        ],
        goals: [
          { id: 'sprout', name: "Sprout the pātōtara by the nest", done: { seen: ['plant_sprouted'] }, reward: 10 },
          { id: 'defend', name: "The moa drive the kea off the nest", done: { seen: ['nest_raid', { success: false }] }, reward: 20 },
          { id: 'koukou', name: "The neighbours' egg hatches", done: { seen: ['egg_hatched', { near: ['$egg', 'friendsHome', 60] }] }, reward: 20 }
        ],
        holdSeason: { until: { goal: 'koukou' }, at: 0.9, maxSec: 75 }
      },

      { id: 'autumn', title: "Autumn: the families part",
        tools: ['patotara', 'Storm'],
        start: [
          { place: { type: 'waterhole', at: 'tarn', standing: true } },
          { fade: { type: 'Storm', sec: 45, refreshOnMove: true } },
          { say: [
            ['friendMama', "We'll have to split up and forage in our own part of the forest for WINTER.", { lit: FRIENDS }],   // (M1)
            ['pukepuke', "Aw, goodbye Koukou!", { lit: ['koukou'] }],                                                      // (M1)
            ['mama', "Okay Pukepuke, do you remember how to hide under STORMs?", { lit: ['Storm', 'waterhole'] }]          // (M1)
          ] },
          K.headFor(FAMILY, 'shore'),
          K.headFor(FRIENDS, 'friendSpot')
        ],
        goals: [
          { id: 'down', name: "Pukepuke's family down to the waterhole, unseen", done: { near: ['mama', 'tarn', 100] }, reward: 20 }
        ],
        holdSeason: { until: { goal: 'down' }, at: 0.9, maxSec: 45 }
      },

      { id: 'winter', title: "Winter: by the waterhole",
        tools: ['wharariki', 'Storm'],
        start: [
          { fade: { type: 'Storm', sec: 25, refreshOnMove: true } },
          K.headFor(FAMILY, 'shore'),      // (whoever is not yet down goes on)
          { say: [
            ['pukepuke', "Oh no, we ate all the berries!"],                                                                // (M1)
            ['papa', "Pātōtara won't grow back 'till SUMMER, so you're going to have to eat your flax...", { lit: ['waterhole'] }]   // (M1)
          ] }
        ],
        reactions: [
          { id: 'winter_press', when: { seasonProgress: ['>=', 0.35] }, do: [{ eagle: { hunger: 50, watch: 'tarn' } }] }
        ],
        goals: [
          { id: 'fed', name: "Wharariki growing by the family", done: flaxNear, reward: 15 },
          { id: 'through', name: "Come through the winter", survive: true, reward: 25 }
        ]
      },

      // Spring: the families' words are said, and after that nobody tells the player anything.
      { id: 'spring', title: "Spring: back to the glade", transfer: true,
        tools: ['patotara', 'Storm'],
        start: [
          { say: [
            ['pukepuke', "Look! I got some flax flowers to give to Koukou's family!", { lit: ['wharariki'] }],   // (M1)
            ['mama', "That's so thoughtful, pookie! You can lead the way!", { lit: ['nests'] }]                  // (M1)
          ] },
          K.headFor(FAMILY, 'home'),
          K.headFor(FRIENDS, 'friendsHome'),
          K.eagleComes('pukepuke', 42)
        ],
        reactions: [
          { id: 'spring_press', when: { after: 24 }, do: [K.eagleComes('pukepuke', 47)] },
          { id: 'still_homeward', when: { all: [{ after: 20 }, { not: { goal: 'home' } }] }, once: false, cooldown: 20,
            do: [K.headFor(FAMILY, 'home'), K.headFor(FRIENDS, 'friendsHome')] }
        ],
        goals: [
          { id: 'home', name: "The family back beside their friends, unseen", reward: 25, done: homeNow },
          { id: 'own', name: "Meet a danger with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 }
        ],
        holdSeason: { until: { goal: 'home' }, at: 0.9, maxSec: 90 },
        until: { any: [{ seasons: 1 }, K.saidAndRead('home_said')] },
        next: 'closing'
      },

      { id: 'closing', title: "Back in the mountains", tools: [],
        until: { all: [{ after: 2 }, K.saidAndRead('home_said')] },
        next: 'win'
      }
    ],

    reactions: K.quietOutside([
      // ---- The stage, once: the neighbours at their nest with an egg, the family walking in ------
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          { nest: { at: 'friendNest', radius: 40, hideClutch: true, as: 'friendsHome' } },
          { spawn: { type: 'upland_moa', at: 'friendNest', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { adopt: { friendMama: { species: 'upland_moa', near: 'friendsHome', female: true },
                     friendPapa: { species: 'upland_moa', near: 'friendsHome', female: false } } },
          // (A slower egg than the Clues setting's: it hatches late in summer, after the kea
          // have had time to come for it. The raid is the lesson.)
          { lay: { species: 'upland_moa', at: 'friendsHome', incubationSec: 75 } },
          { spawn: { type: 'upland_moa', at: 'arrive', count: 2, sexes: 'pair', radius: 10, hunger: 30 } },
          { spawn: { type: 'upland_moa', at: 'arrive', count: 1, age: 'juvenile', radius: 8, hunger: 25 } },
          { adopt: { mama: { species: 'upland_moa', near: 'arrive', female: true },
                     papa: { species: 'upland_moa', near: 'arrive', female: false },
                     pukepuke: { species: 'upland_moa', near: 'arrive', pick: 'youngest' } } },
          // (On the calendar: the hens have laid for now. Pukepuke is last year's chick, a year
          // old, a cock bird, and still at Mama's side.)
          K.hensHaveLaid(['mama', 'friendMama']),
          (x) => { const p = x.runner.castEnts.pukepuke; if (p) { p._bornTurn = -4; p._bornYear = -1; p.mother = x.runner.castEnts.mama || null; p.isFemale = false; p.updateAge(0); } },
          { place: { type: 'patotara', at: 'patch', standing: true } },
          { spawn: { type: 'kea', at: 'keaNest', count: D.kea, radius: 24 } },
          { place: { type: 'Storm', at: 'tops', standing: true } },
          { place: { type: 'Storm', at: 'lookout', standing: true } },
          { eagle: { which: 'nearest', near: 'home', watch: 'lookout', hunger: 25 } },
          // The family walks in to the glade beside the neighbours' nest.
          K.headFor(FAMILY, 'home')
        ] },

      // ---- A line on black, the fade in, and the walk in -------------------------------------------
      ...K.prologue({
        seenKey: '_journeyRecap2Seen',
        lines: ["A year has passed. Mama, Papa and Pukepuke have walked north across the tops, looking for other moa."],   // NEW
        opening: [
          ['pukepuke', "Are we there yet?"],                                                                             // (M1)
          ['mama', "...Yes, this is the Pātōtara glade! And look, it's another Upland Moa family.", { lit: ['friendMama', 'friendPapa', 'nests'] }]   // (M1)
        ]
      }),
      // They have reached the other family's nest.
      { id: 'meet', when: { all: [{ flag: 'opened' }, { near: ['mama', 'friendsHome', 135] }] },
        say: [
          ['friendMama', "Why, hello! More moa is always a welcome sight! And what's your name, little one?", { lit: ['pukepuke'] }],   // (M1)
          ['pukepuke', "Pukie-pukie!"],                                                                                               // (M1)
          ['friendMama', "Nice to meet you! Want to help us forage pātōtara, Pukie-pukie? There is plenty for all of us!", { lit: ['patotara'] }]   // (M1)
        ],
        // A new control, so it is told outright.
        banner: { words: ["Tap and hold the PĀTŌTARA to sprout its berries", "Tap and hold the PĀTŌTARA to sprout its berries"],
                  until: { seen: ['plant_sprouted'] }, lit: ['patotara', 'friendMama', 'friendPapa'], pause: true, maxSec: 40 } },
      // (If they are slow to arrive, the bush is still there to be sprouted: a quiet prompt.)
      { id: 'meet_late', chapters: ['summer'],
        when: (x) => !!x.runner.flags.opened && x.runner.scopeTime() > 30 * 60 && !sprouted(x) && !x.runner.reactions.some(r => r.id === 'meet' && r.fired),
        banner: { words: ["Tap and hold the PĀTŌTARA to sprout its berries", "Tap and hold the PĀTŌTARA to sprout its berries"],
                  until: { seen: ['plant_sprouted'] }, lit: ['patotara'], pause: false, maxSec: 30 } },

      // ---- The kea: Strongbeak finds the berries, and calls the others ---------------------------------
      { id: 'kea_threat', on: 'plant_sprouted',
        say: [
          kea("Strongbeak", "KEE-A! KEE-A! BERRIES! Juicy pātōtara berries!", { lit: ['kea', 'patotara'] }),             // (M1)
          kea("Strongbeak", "Skraak, Huft-Tuft, get over here to eat the BERRIES!", { lit: ['kea'] })                     // (M1)
        ] },
      // All three at the nest, with an egg in it: the lesson's ladder. Their scene is the clue
      // (nothing is told). Answered when the moa see a kea off; lost when a kea takes the egg.
      // (Not before the berries are out and the families have spoken: the story's order.)
      { id: 'kea_gang', when: (x) => !!x.runner.flags.opened && sprouted(x) && K.idle(x) && (firedAgo(x, 'meet', 3) || x.runner.scopeTime() > 40 * 60) &&
                                      eggInNest(x) && x.runner.nearCheck('kea', 'friendsHome', 170, null),
        say: [
          kea("Strongbeak", "The Pouākai attacked our mountain perch last year... We could use a clearing like yours!", { lit: ['kea'] }),   // (M1)
          kea("Skraak", "...And is that an egg? That'll go well with berries!", { lit: ['kea', 'nests'] }),                                 // (M1)
          ['pukepuke', "Stay away! That egg is going to be my friend!", { lit: ['nests'] }]                                                // (M1)
        ],
        until: { any: [{ seen: ['nest_raid'] }, { after: 40 }] },
        solved: { seen: ['nest_raid', { success: false }] }, lost: { seen: ['nest_raid', { success: true }] },
        hints: [
          { after: 5, notify: ['Skraak: "Only two moa at that nest... easy pickings, boss!"', 'error'] },                  // NEW
          { after: 11, banner: { words: ["Grow PĀTŌTARA by their NEST to bring your family over", "Tap beside their NEST to grow PĀTŌTARA, then sprout it"],   // (M1)
                                 tool: 'patotara', lit: ['kea', 'nests', ...FAMILY], pause: false, maxSec: 22 } }
        ] },
      // Later visits climb the same ladder, more slowly.
      { id: 'kea_again', when: (x) => eggInNest(x) && x.runner.nearCheck('kea', 'friendsHome', 170, null) && firedAgo(x, 'kea_gang', 30),
        once: false, cooldown: 30,
        until: { any: [{ seen: ['nest_raid'] }, { after: 40 }] },
        solved: { seen: ['nest_raid', { success: false }] }, lost: { seen: ['nest_raid', { success: true }] },
        hints: [
          { after: 6, notify: ['Skraak: "Is anybody watching that nest?"', 'error'] },                                    // NEW
          { after: 13, banner: { words: ["Gather the moa at the NEST: grow PĀTŌTARA beside it and sprout it", "Tap beside the NEST to grow PĀTŌTARA"],
                                 tool: 'patotara', lit: ['kea', 'nests'], pause: false, maxSec: 20 } }
        ] },
      // ...and if summer has waited forty seconds for her and she still has not hatched, an egg
      // close to hatching is set down there: the story cannot go on without her.
      { id: 'koukou_owed', chapters: ['summer'], once: false, cooldown: 14,
        when: (x) => !!x.runner.flags.staged && x.runner.castEnts.koukou === undefined && (x.runner._heldFrames || 0) >= 40 * 60,
        do: [(x) => { x.runner.lay({ species: 'upland_moa', at: 'friendsHome', incubationSec: 6 }); x.runner._log('beat', 'koukou', 'forced: an egg near hatching set down'); }] },
      // The raid, both ways.
      { id: 'raid_failed', on: 'nest_raid', if: { success: false },
        moment: { on: '$site', text: "The moa drove the kea off!" },
        say: [
          kea("Kea", "Have it your way, keep your nest... But stay away from ours when you hide from the cold in our forest!", { lit: ['kea'] }),   // (M1)
          ['friendPapa', "Those Kea can be real pesky. Thanks for helping out!"],                                         // (M1)
          ['mama', "We should try and leave them be when we are foraging for WINTER."]                                    // (M1)
        ] },
      { id: 'raid_failed_again', on: 'nest_raid',   // (the second time they are seen off, not the first)
        if: (x) => !!x.event && !x.event.success && firedAgo(x, 'raid_failed', 1),
        say: [kea("Strongbeak", "Skraw... There's too many of them... At this rate, we'll be done for in the winter! Skraak, regroup, regroup!", { lit: ['kea'] })] },   // (M1)
      { id: 'raid_won', on: 'nest_raid', if: { success: true },
        say: [
          kea("Kea", "SKRAAWK! Move over, you giant wingless birds! This glade is ours now!", { lit: ['kea'] }),         // (M1)
          ['friendMama', "Our egg! ...There's still time for another this summer. Stay close to us this time, won't you?", { lit: ['nests', ...FAMILY] }]   // NEW
        ] },
      { id: 'raid_won_again', on: 'nest_raid', if: (x) => !!x.event && !!x.event.success && firedAgo(x, 'raid_won', 1), once: false, cooldown: 12,
        notify: ["The kea took an egg from the nest.", 'error'] },
      // The story needs Koukou. While she has not hatched and the neighbours' nest stands empty
      // (the kea took the egg), another is laid there after a few seconds, and the log says so.
      { id: 'egg_again', chapters: ['summer', 'autumn'], once: false, cooldown: 8, for: 5,
        when: (x) => !!x.runner.flags.staged && x.runner.castEnts.koukou === undefined && !eggInNest(x),
        do: [(x) => { x.runner.lay({ species: 'upland_moa', at: 'friendsHome' }); x.runner._log('beat', 'koukou', 'forced: another egg set down'); }] },
      // Koukou: the neighbours' chick, a hen, adopted as she hatches. A moment later the young meet.
      { id: 'koukou_hatched', on: 'egg_hatched', if: { near: ['$egg', 'friendsHome', 60] },
        do: [{ adopt: { koukou: '$moa' } }, (x) => { const k = x.runner.castEnts.koukou; if (k && !k.isFemale) { k.isFemale = true; k.updateAge(0); } }],
        moment: { on: '$moa', text: "Koukou has hatched!" },
        say: [
          ['koukou', "Squeek, Squeek!"],                                                            // (M1)
          ['pukepuke', "Wow... Was I that small last SUMMER?", { lit: ['koukou'] }],                // (M1)
          ['koukou', "...Squeek?"]                                                                   // (M1)
        ] },

      // ---- The Pouākai and the storms: taught on tile 1, so by clue from the first ---------------------
      ...K.huntInVoice({ species: 'upland_moa', teach: false, chapters: TAUGHT }),
      ...K.stormInVoice({ teach: false, lit: FAMILY, chapters: TAUGHT }),
      { id: 'gave_up', on: 'eagle_gave_up', once: false, cooldown: 5,
        notify: ['Pouākai: "SKRAHH! Off to the flats, then..."', 'success'] },
      { id: 'herd_taken', on: 'moa_killed', if: { species: 'stout_legged_moa' }, once: false, cooldown: 30,
        notify: "The Pouākai has fed on the herd." },

      // ---- Winter: flax, by clue first (Papa has said it) ------------------------------------------------
      { id: 'flax', on: 'chapter_start', if: K.opens('winter'),
        until: { any: [flaxNear, { after: 40 }] }, solved: { all: [flaxNear, { placed: 'wharariki' }] },
        hints: [
          { after: 12, notify: 'Pukepuke: "But papa, where IS the flax?"' },                                               // NEW
          { after: 22, banner: { words: ["Grow WHARARIKI by the family: it keeps its food through the cold", "Tap beside the family to grow WHARARIKI"],
                                 tool: 'wharariki', lit: FAMILY, pause: false, maxSec: 22 } }
        ] },
      { id: 'flax_home', on: 'case_closed', if: (x) => x.event && x.event.case === 'flax' && x.event.outcome === 'solved',
        say: [['mama', "There's plenty of kai at the WATERHOLE... We can watch the WHARARIKI grow its flowers!", { lit: ['wharariki', 'waterhole'] }]] },   // (M1)

      // ---- Losses: the young are the stake; a grown bird lost is remembered ---------------------------------
      ...K.leadLost({ pukepuke: "Pukepuke", koukou: "Koukou" },
        { starved: "In winter grow wharariki by the families; in the warm months, sprout pātōtara." }),
      ...K.elderLost({ mama: "Mama Moa", papa: "Papa Moa", friendMama: "Koukou's mother", friendPapa: "Koukou's father" }),

      // ---- Home: the last words, then the win ----------------------------------------------------------------
      { id: 'home', on: 'goal_met', if: (x) => x.event && x.event.goal === 'home',
        say: [
          ['pukepuke', "We're back in the mountains!", { lit: ['nests', ...FRIENDS] }],             // (M1)
          ['koukou', "Wow, WHARARIKI flowers!",                                                      // (M1)
            { onShow: (game) => { if (game.chapters) game.chapters.sow({ plant: 'wharariki', at: 'friendsHome', count: 2, radius: 12 }); } }]
        ],
        do: [{ flag: 'home_said' }] },
      { id: 'on_the_way', on: 'chapter_start', if: (x) => K.opens('closing')(x) && !x.runner.flags.home_said,
        say: [['mama', "Nearly there, pookie. I can see the glade from here!", { lit: ['nests'] }]],   // NEW
        do: [{ flag: 'home_said' }] }
    ], ['gave_up', 'herd_taken'], TAUGHT),

    winTitle: "BACK IN THE MOUNTAINS",
    winText: "Both families are back in the glade. Pukepuke and Koukou have years of growing to do.",

    menu: K.journeyMenu("Pātōtara", "The journey: tile 2",
      ["New neighbours, and kea with an eye on their egg.", "", "Berries draw kea; moa together drive them off."],
      ['patotara', 'wharariki', 'tussock', 'dracophyllum'])
  });
})();

LEVEL_REGISTRY.register(JOURNEY_PATOTARA);
