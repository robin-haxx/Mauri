// ============================================================================
// THE JOURNEY, TILE 1: THE STORM (Āwhā), told as the first module told it
// ============================================================================
// What this is. The Storm lesson of the chapters engine (levels/chapters_storms.js, its Clues
// setting), with the story of the first module put back: the same moments in the same order,
// in the family's and the Pouākai's own voices (levels/tutorial_module_00_storms.js). It is
// the first thing a new player sees, so it assumes nothing: Te Whē opens on black with where
// and when this is, and each control is told outright the first time it is needed.
//
// The sequence, as module 0:
//   prologue   Te Whē on black: the land, the cold, the upland moa. Then the screen fades in.
//   summer     Papa at the nest with the egg, Mama out at the pātōtara in the open. The Pouākai
//              sees her ("I spy with my little eye..."). Move a storm over her. It gives up and
//              goes for the herd on the flats. She comes home with the berries; the egg hatches.
//   autumn     The berries are gone. The family goes down to the wharariki by the lake, with a
//              storm standing part-way down. The Pouākai comes back. Storms begin to blow out.
//   winter     By the lake. Storms do not last, and the Pouākai is hungrier.
//   spring     Wharariki flowers, and the way home. NOTHING IS PROMPTED in spring: it is the
//              season that tests the year. Home at the nest, the family's last words, and north.
//
// What the simulation does on its own. Everything the animals do, exactly as the Clues setting:
// the eagle's hunger and choice of prey, the family's feeding and its drift down and up with
// the seasons, the hatch. The script sets the stage (where each bird starts, what stands
// where), invites the first hunt and forces it only at a deadline, measures, and speaks.
// One difference in the stage: Mama starts at the berries and Papa at the nest, as the story
// has it. Her home is the nest, so she walks back when she has fed.
//
// THE TWO WALKS. In module 0 the family walks down to the wharariki in autumn and home in
// spring, and the player's work is to keep storms over them on the way. Here the family sets
// off for each place when its words are said (CHAPTERS_KIT.headFor: the place becomes their
// home and they walk to it by their own migration). That is the one thing this lesson scripts
// about where an animal goes. It was tried the other way first: left to the open simulation,
// the family reached the wharariki in time on 2 seeds of 5 and the nest on none, and a tapped
// plant only calls a moa that is hungry. Everything on the way is theirs: feeding, bolting
// from the Pouākai, holding still under a storm.
//
// How it teaches. By clue first, as the Clues setting, with the hints in voice:
//   - The first hunt is told outright (the story's own scene, then "Move the STORM to cover
//     MAMA MOA"), with play stopped. So is each new control: calling a storm, tapping a plant.
//   - After that a problem is met with nothing at first (the Pouākai's "!" and its amber outline
//     are the clue), then the Pouākai's own mutter, then the instruction.
//   - The record (ChapterRunner.caseLog) keeps the rung at which the player acted.
//
// THE WORDS. Every line marked (M0) is the author's, from module 0, word for word. Te Whē's
// prologue is the modules' (levels/tutorial_module_bookends.js), and his two lines on the
// Pouākai's place are the free play's. The lines marked NEW were written for moments the
// first module did not have, in its manner, and are the author's to replace:
//   gave_up        the Pouākai turning to the herd, once it is back from the kea (the first time
//                  it is seen off it goes to "scuffle with the Kea", module 0's line and scene)
//   eagle_fed      Papa, once the Pouākai has eaten
//   amber          Te Whē on the amber outline and the "!" (what the two signs mean)
//   eagle_back     the Pouākai's first line in autumn when it did eat in summer
//   winter         Pukepuke and Mama on winter storms
//   on_the_way     Mama, if spring runs out before the family is home
//   the hint rungs in levels/_chapters_kit.js (huntInVoice, stormInVoice)
// ============================================================================

const JOURNEY_STORM = (() => {
  const K = CHAPTERS_KIT, P = K.pouakai;
  const base = makeChaptersStorms('clues');          // the land, the herd, the rules and the dial
  const FAMILY = ['mama', 'papa', 'pukepuke'];
  const TAUGHT = ['summer', 'autumn', 'winter'];     // spring says nothing
  const parents = (id) => ({ id, name: "Keep Mama and Papa safe",
    keep: { all: [{ alive: 'mama' }, { alive: 'papa' }] }, required: true, failReason: "Mama or Papa Moa was lost." });
  const fedOnHerd = (x) => (x.runner.counters['killed:stout_legged_moa'] || 0) > 0;
  const hungryOnes = (x) => FAMILY.map(n => x.runner.castEnts[n]).filter(m => m && m.alive && m.hunger >= 62);
  const homeNow = { all: [{ near: ['mama', 'home', 110] }, { near: ['pukepuke', 'home', 130] }] };
  const SCUFFLE_SEC = 30;   // how long the Pouākai is off scuffling with the kea
  const NORTH_FADE_SEC = 11;   // the walk north is watched this long at most before the fade
  // The family's walk to the next tile: one point on the north edge, the nearest to Mama, and
  // each of them sets off for it (Moa.beginLeaving), a step apart. The runner counts a bird
  // that walks off the land as walked on, not lost.
  const walkNorth = (x) => {
    const r = x.runner, lead = FAMILY.map(n => r.castEnts[n]).find(e => e && e.alive);
    if (!lead) return;
    const edge = r._findSite({ find: 'edge', side: 'north', near: lead.castName }) || x.game._nearestEdge(lead.pos.x, lead.pos.y);
    if (!edge) return;
    FAMILY.forEach((n, i) => {
      const e = r.castEnts[n];
      if (e && e.alive) e.beginLeaving(edge.x + (i - 1) * 9, edge.y);
    });
    r._log('walk_off', FAMILY.join(','), 'north');
  };
  const leader = (x) => {
    const live = FAMILY.map(n => x.runner.castEnts[n]).filter(e => e && e.alive);
    return live.length ? live.reduce((a, b) => (a.pos.y <= b.pos.y ? a : b)) : null;
  };

  return Object.assign({}, base, {
    id: 'journey_storm',
    name: "The Storm",
    section: 'journey', journey: true, sketch: undefined,
    nextLevel: undefined,
    waysOn: [{ label: "North, to the pātōtara glade", tile: 't2' }],
    outcome: { birds: FAMILY },

    // The herd on the flats: one more stout-legged moa than the Storm lesson's seven.
    initialSpeciesDistribution: { stout_legged_moa: 8 },
    initialEntityCounts: Object.assign({}, base.initialEntityCounts, { moa: 8 }),

    cast: {
      mama:     { title: "Mama Moa", species: 'upland_moa', manual: true, pitch: 0.85 },
      papa:     { title: "Papa Moa", species: 'upland_moa', manual: true },
      pukepuke: { title: "Pukepuke", species: 'upland_moa', manual: true, scale: 0.6, sound: 'chick' }
    },

    sites: Object.assign({}, base.sites, {
      shore: { near: 'tarn', dist: [34, 60] }      // where the wharariki grows, by the water
    }),

    chapters: [
      { id: 'summer', title: "Summer: a nest on the tops",
        tools: ['Storm'],
        locked: ['Storm'],            // the standing storms are moved; calling one comes when one blows out
        focus: ['upland_moa'],
        beats: [
          // The first hunt, once the opening has been said, as module 0's: the Pouākai, held on
          // its way over, is let go, made hungry and brought over the berries, where Mama is
          // (the invitation): its hunger climbs to 50 over about three seconds, its bar seen to
          // drain. It always goes for the family first: if it has not locked onto one of them
          // within 6 seconds it is sent after Mama (or Papa), and the log says forced.
          // Until it has gone for one of them it passes over the herd (30 s at most): a family
          // already under the storms is circled and waited for, as module 0's eagle searched.
          { id: 'first_hunt', when: { flag: 'opened' },
            invite: [{ eagle: { which: 'nearest', near: 'grove', release: true, watch: 'grove', hunger: 50,
                                shun: { species: 'stout_legged_moa', sec: 30 } } }],
            until: { seen: ['eagle_hunting', { species: 'upland_moa' }] },
            once: true, by: 6, force: [{ aim: { at: ['mama', 'papa'], sec: 60 } }] }
        ],
        goals: [
          { id: 'seen_off', name: "Hide the family from the Pouākai",
            done: { all: [{ beat: 'first_hunt' }, { not: { hunting: true } }] }, reward: 15 },
          { id: 'hatched', name: "The egg hatches", done: { seen: ['egg_hatched', { species: 'upland_moa' }] }, reward: 20 },
          parents('parents')
        ],
        holdSeason: { until: { all: [{ goal: 'hatched' }, { beat: 'first_hunt' }] }, at: 0.9, maxSec: 45 }
      },

      { id: 'autumn', title: "Autumn: down to the wharariki",
        tools: ['Storm'],
        start: [
          { place: { type: 'waterhole', at: 'tarn', standing: true } },
          { place: { type: 'wharariki', at: 'shore', standing: true } },
          // "And look downhill, another STORM!": one stands part-way down, as module 0's did.
          (x) => {
            const r = x.runner, a = r.point('home') || r.point('nest'), b = r.point('tarn');
            if (a && b) r.place({ type: 'Storm', at: { x: a.x + (b.x - a.x) * 0.4, y: a.y + (b.y - a.y) * 0.4 }, standing: true });
          },
          { fade: { type: 'Storm', sec: 45, refreshOnMove: true } },
          { say: [
            ['pukepuke', "Where'd all the Pātōtara berries go, mama?"],                                                    // (M0)
            ['mama', "They've gone away pookie, because the air is getting too cold in these mountains. It's going to be winter soon!"],   // (M0)
            ['papa', "That means it's time for an adventure! We're going downhill to find some hardy Wharariki.", { lit: ['wharariki', 'waterhole'] }],   // (M0)
            ['pukepuke', "That doesn't sound very yummy..."],                                                               // (M0)
            ['mama', "If you learn to chew your food, the Wharariki will sprout sweet flowers for you to eat in spring!", { lit: ['wharariki'] }],   // (M0)
            ['mama', "And look downhill, another STORM! That'll keep us safe from Pouākai on the journey!", { lit: ['Storm'] }],   // (M0)
            ['papa', "Alright, time to go! Mama Moa, lead the way!"]                                                        // (M0)
          ] },
          // "Lead the way!": the family sets off for the wharariki (see THE TWO WALKS, above).
          K.headFor(FAMILY, 'shore')
        ],
        goals: [
          { id: 'down', name: "The family down to the wharariki, unseen", done: { near: ['mama', 'tarn', 100] }, reward: 20 },
          parents('parents2')
        ],
        holdSeason: { until: { goal: 'down' }, at: 0.9, maxSec: 45 }
      },

      { id: 'winter', title: "Winter: by the lake",
        tools: ['Storm'],
        start: [
          { fade: { type: 'Storm', sec: 25, refreshOnMove: true } },
          K.headFor(FAMILY, 'shore'),      // (whoever is not yet at the tarn goes on down)
          { say: [
            ['pukepuke', "Brr! Mama, our storm keeps blowing away!"],                                   // NEW
            ['mama', "Winter storms don't last, pookie. Stay close to the flax, and we'll find another."]   // NEW
          ] }
        ],
        reactions: [
          { id: 'winter_press', when: { seasonProgress: ['>=', 0.3] }, do: [{ eagle: { hunger: 50, watch: 'tarn' } }] },
          { id: 'winter_press2', when: { seasonProgress: ['>=', 0.7] }, do: [{ eagle: { hunger: 56 } }] }
        ],
        goals: [
          { id: 'through', name: "Come through the winter", survive: true, reward: 25 },
          parents('parents3')
        ]
      },

      // Spring: the family's words are said, and after that nobody tells the player anything.
      { id: 'spring', title: "Spring: home to the tops", transfer: true,
        tools: ['Storm'],
        start: [
          { say: [
            ['pukepuke', "Yum! I love wharariki flowers!", { lit: ['wharariki'] }],                                         // (M0)
            ['papa', "Well, we have to leave this waterhole now, Pukepuke, so you better stuff as many into your beak as you can!"],   // (M0)
            ['pukepuke', "Are the Pātōtara berries back in the mountains?"],                                                 // (M0)
            ['mama', "That's right pookie! We can head north and find some more moa for you to make friends with!", { lit: ['nests'] }],   // (M0)
            ['pukepuke', "...Brt I drn't wrnt to share myr flowers rnd berries!!"],                                           // (M0)
            ['papa', "Don't talk with your mouth full, Pukepuke. There'll be plenty of berries up there for all of us..."]    // (M0)
          ] },
          // "We have to leave this waterhole now": the family sets off for the nest.
          K.headFor(FAMILY, 'home'),
          K.eagleComes('pukepuke', 42)
        ],
        reactions: [
          { id: 'spring_press', when: { after: 24 }, do: [K.eagleComes('pukepuke', 47)] },
          // (A fright or a blocked way can end a walk: every so often those not yet home set off again.)
          { id: 'still_homeward', when: { all: [{ after: 20 }, { not: { goal: 'home' } }] }, once: false, cooldown: 20,
            do: [K.headFor(FAMILY, 'home')] }
        ],
        goals: [
          { id: 'home', name: "The family home to the nest, unseen", reward: 25, done: homeNow },
          { id: 'own', name: "Meet a danger with no help", done: { gained: ['unaided', '>=', 1] }, stretch: true, reward: 30 },
          parents('parents4')
        ],
        // (Spring waits a good while for them: the story ends at the nest.)
        holdSeason: { until: { goal: 'home' }, at: 0.9, maxSec: 90 },
        until: { any: [{ seasons: 1 }, K.saidAndRead('home_said')] },
        next: 'closing'
      },

      // The year's last words. Home: they have been said at the nest, and this passes at once.
      // Not home when the season ran out (a hard spring): the family is still on its way, and
      // says so. Either way the year is won: only a bird lost loses it.
      { id: 'closing', title: "North", tools: [],
        until: { all: [{ after: 2 }, K.saidAndRead('home_said')] },
        next: 'onward'
      },

      // "Let's head north": the family sets off together for the north edge of the land, toward
      // the next tile, the view going with them, and the screen fades as they reach it. A
      // discrete scene, after the year is won; the Pouākai is fed and leaves them be.
      { id: 'onward', title: "North, to the pātōtara glade", tools: [],
        start: [
          { eagle: { which: 'nearest', near: 'home', hunger: 0 } },
          walkNorth,
          (x) => { x.runner.vars._northAt = x.game.playTime; }
        ],
        reactions: [
          // The view goes with them, a little ahead (each ease takes up the last one's motion).
          { id: 'with_them', when: { after: 0.5 }, once: false, cooldown: 1,
            do: [(x) => {
              const lead = leader(x);
              if (!lead) return;
              const g = x.game, gy = g._groundPaintY(lead.pos.x, lead.pos.y - 40);
              g.cameraTo({ zoom: 1.6, cx: lead.pos.x, cy: gy, ax: 0.5, ay: 0.5 }, 90);
            }] },
          // The first of them over the edge, or long enough: the screen fades to black.
          { id: 'fade_north', when: (x) => Object.keys(x.runner.walked || {}).length > 0 ||
                                           x.game.playTime - (x.runner.vars._northAt || 0) >= NORTH_FADE_SEC * 60,
            do: [(x) => { x.game.fadeScreen(1, 80); x.runner.vars._fadedAt = x.game.playTime; }, { flag: 'north_faded' }] }
        ],
        until: (x) => !!x.runner.flags.north_faded && x.game.playTime - x.runner.vars._fadedAt >= 95,
        next: 'win'
      }
    ],

    reactions: K.quietOutside([
      // ---- The stage, once: Papa at the nest with the egg, Mama out at the berries ---------------
      { id: 'stage', on: 'chapter_start', if: K.opens('summer', 'staged'),
        do: [
          { flag: 'staged' },
          { nest: { at: 'nest', radius: 40, hideClutch: true, as: 'home' } },
          { spawn: { type: 'upland_moa', at: 'nest', count: 1, female: false, radius: 8, hunger: 25 } },
          { adopt: { papa: { species: 'upland_moa', near: 'nest', female: false } } },
          { spawn: { type: 'upland_moa', at: 'grove', count: 1, female: true, radius: 8, hunger: 48 } },
          { adopt: { mama: { species: 'upland_moa', near: 'grove', female: true } } },
          // (Her home is the nest: fed, she walks back to it.)
          (x) => { const m = x.runner.castEnts.mama, n = x.runner.point('nest'); if (m && n && m.homeRange) m.homeRange.set(n.x, n.y); },
          // (Pukepuke's egg hatches in a scene, as module 0's did: it rocks and cracks with the
          // camera close in, and leaves its shell. When is still the simulation's.)
          { lay: { species: 'upland_moa', at: 'nest', scene: true } },
          K.hensHaveLaid(['mama']),
          { sow: { plant: 'patotara', at: 'grove', count: 5, radius: 26, sprouted: true } },
          ...['tops', 'lookout', 'tops2', 'lookout2'].map(at => ({ place: { type: 'Storm', at, standing: true } })),
          // The Pouākai's entrance, as module 0's: set down on its way over from the high ground
          // (away from the flats and the herd), circling there out of the hunt through the
          // opening, until the first hunt sends it for the family.
          { eagle: { which: 'nearest', near: 'grove', hold: { at: 'grove', awayFrom: 'tarn', dist: 160 }, hunger: 30 } }
        ] },

      // ---- Te Whē on black, the fade in, and the family's first words -----------------------------
      ...K.prologue({
        lines: [
          "Before people found the land, Aotearoa New Zealand was ruled by birds.",
          ["Forests like Kahurangi in the Southern Alps bustled with the calls of Kea, Kiwi, Kākā, Kākāpō, Kōkako, Takahē and Huia.",
            { voices: ['kea', 'kakapo'], voicesSec: 7 }],
          "But the forests they filled weren't always that dense, dark green bush we think of when we visit the native back country.",
          "Over the last 100,000 years, the earth's temperature rose and fell in cycles. This was called the OTIRA GLACIATION. Each time it fell, more of the ancient forest died back, taking hundreds of years to regrow.",
          ["The final cold phase happened 30,000 years ago: The LAST GLACIAL MAXIMUM.", { speaker: 'gust' }],
          "When forests shrank, replaced by glacial tussock land, most of the birds were pushed back into smaller patches of forest.",
          "And only one moa was prepared to thrive in Kahurangi's alps...",
          "Moa Pukepuke, The Upland Moa.",
          "This is their story."
        ],
        opening: [
          ['papa', "Hurry up honey, it's dangerous out there in the open!", { lit: ['nests'] }],                              // (M0)
          ['mama', "I know, I know... But this pātōtara will be such a lovely first meal for our little Pukepuke!"],         // (M0)
          ['mama', "And just look at that storm gathering. I'm sure Tāwhirimātea is on our side.", { lit: ['Storm'] }]       // (M0)
        ]
      }),

      // (Its first go at the family: the herd is fair game again.)
      { id: 'herd_open', on: 'eagle_hunting', if: { species: 'upland_moa' },
        do: [{ eagle: { which: 'all', shun: { species: 'stout_legged_moa', sec: 0 } } }] },

      // ---- The Pouākai's hunts: the first told outright, the rest by clue first --------------------
      ...K.huntInVoice({ species: 'upland_moa', teach: true, chapters: TAUGHT }),

      // Hidden: its bird is gone from its sight.
      { id: 'foiled', on: 'case_closed', if: (x) => x.event && x.event.case === 'hunt' && x.event.outcome === 'solved',
        say: [
          P("Blast these clouds! Where'd my big, tasty lunch go?", { lit: ['Storm'] }),          // (M0)
          ['mama', "Who do you think you're calling big, huh?"]                                  // (M0)
        ] },
      // After its first hunt (seen off, or given up on the family), it goes off over the ridge to
      // scuffle with the kea for scraps, as in module 0, and is gone a while: one errand, the
      // story's (HaastsEagle.sendAway). It comes back a little fed and hunts as it will.
      { id: 'scuffle', chapters: ['summer'],
        when: { all: [{ any: [{ goal: 'seen_off' }, { seen: ['eagle_gave_up'] }] }, K.idle] },
        say: [P("SKRAHH! I'm so hungry... I'll have to S... scuffle with the Kea for S... Scraps!", { lit: ['haasts_eagle'] })],   // (M0)
        do: [{ flag: 'scuffled' }, { eagle: { which: 'nearest', near: 'grove', away: SCUFFLE_SEC, hunger: 12 } }] },
      { id: 'eagle_left', when: (x) => !!x.runner.flags.scuffled && x.runner.sim.eagles.some(e => e._away && e._away.phase === 'gone'),
        say: [['papa', "Maybe the atua are watching over us. But get back to the nest before the clouds clear!", { lit: ['nests'] }]] },   // (M0)
      // Hidden twice after that, it gives the family up and goes for the herd (the simulation's
      // own rule).
      { id: 'gave_up', on: 'eagle_gave_up', if: (x) => !!x.runner.flags.scuffled,
        say: [P("SKRAHH! Those Kea had nothing! I'll have to S... settle for those S... stout-legged moa down on the flats!", { lit: ['$eagle', 'stout_legged_moa'] })] },   // NEW (after M0's line)
      { id: 'gave_up_again', on: 'eagle_gave_up', if: (x) => !!x.runner.flags.scuffled, once: false, cooldown: 5,
        notify: ['Pouākai: "SKRAHH! Off to the flats, then..."', 'success'] },                    // NEW
      // It has eaten: why that is all right, and who is the player's to keep.
      { id: 'eagle_fed', on: 'moa_killed', if: { all: [{ species: 'stout_legged_moa' }, { beat: 'first_hunt' }] },
        say: [
          ['papa', "The Pouākai has eaten. It won't come looking for us again for a while.", { lit: ['haasts_eagle'] }],   // NEW
          ['guide', "Haast's eagle evolved alongside the moa. As predator and prey, they keep each other in balance."],
          ['guide', "So it's good for the ngahere that the Pouākai hunts. But Mama, Papa and their little one are yours to keep safe!", { lit: ['mama', 'papa', 'pukepuke'] }]
        ] },
      { id: 'eagle_fed_again', on: 'moa_killed', if: { species: 'stout_legged_moa' }, once: false, cooldown: 30,
        notify: "The Pouākai has fed on the herd." },
      { id: 'family_taken', on: 'moa_killed', if: { species: 'upland_moa' }, once: false,
        notify: ["The Pouākai took one of the upland moa.", 'error'] },
      // The two signs to read, said once the first hunt is over and it grows hungry again.
      { id: 'amber', when: { all: [{ beat: 'first_hunt' }, { eagleHunger: ['>=', 38] }, { not: { hunting: true } }] },
        say: [['guide', "See the amber outline around the Pouākai? It is getting hungry. A \"!\" over it means it has chosen someone.", { lit: ['haasts_eagle'] }]] },   // NEW

      // ---- Summer: home with the berries, and the hatch ---------------------------------------------
      { id: 'food_home', when: { all: [{ beat: 'first_hunt' }, { near: ['mama', 'home', 46] }, { not: { hunting: true } }, { not: { goal: 'hatched' } }] },
        chapters: ['summer'],
        say: [['mama', "Lovely, orange pātōtara berries.. And just in time, look at my little egg!", { lit: ['nests'] }]] },   // (M0)
      { id: 'hatched', on: 'egg_hatched', if: { species: 'upland_moa' },
        do: [{ adopt: { pukepuke: '$moa' } }],
        moment: { on: '$moa', text: "Pukepuke has hatched!" },
        say: [['pukepuke', "Peep! Peep!", { title: "Moa Pukepuke" }]] },                                  // (M0)

      // ---- Autumn: the Pouākai is back, the walk down, a hungry moa, a storm blown out ------------
      { id: 'eagle_back', when: (x) => x.game.seasonManager.currentKey === 'autumn' && x.runner.eagleHungerMax() >= 36 && !fedOnHerd(x),
        chapters: ['autumn'],
        say: [
          P("Now, that was barely a meal at all... All those Kea had in their nest were disgusting, little round orange things!"),   // (M0)
          P("Aha! I spy something more kai-shaped moving, under that cloud... That's moa like it!", { lit: [...FAMILY, 'Storm'] })   // (M0)
        ] },
      { id: 'eagle_back_fed', when: (x) => x.game.seasonManager.currentKey === 'autumn' && x.runner.eagleHungerMax() >= 36 && fedOnHerd(x),
        chapters: ['autumn'],
        say: [
          P("Now, that S... stout-legged supper was a long time ago... and my tummy knows it!"),                             // NEW
          P("Aha! I spy something more kai-shaped moving, under that cloud... That's moa like it!", { lit: [...FAMILY, 'Storm'] })   // (M0)
        ] },
      { id: 'down', on: 'goal_met', if: (x) => x.event && x.event.goal === 'down',
        moment: { on: 'mama', text: "The wharariki, by the lake" } },
      { id: 'hungry', when: (x) => hungryOnes(x).length > 0, chapters: ['autumn', 'winter'],
        banner: { words: ["Moa need to eat PLANTS to sustain Mauri (life force).", "Tap a PLANT near a hungry moa to call it over"],   // (M0), and how
                  // (Gone once a plant has been tapped: the moa still has to walk to it and eat.)
                  until: { any: [(x) => hungryOnes(x).length === 0, { gained: ['tapped', '>=', 1] }] },
                  lit: FAMILY, pause: false, maxSec: 14 } },
      ...K.stormInVoice({ teach: true, lit: FAMILY, chapters: TAUGHT }),

      // ---- Losses ----------------------------------------------------------------------------------
      { id: 'pukepuke_lost', on: 'cast_lost', if: { cast: 'pukepuke', cause: 'eagle' }, do: [{ lose: "The Pouākai took Pukepuke." }] },
      { id: 'pukepuke_starved', on: 'cast_lost', if: { cast: 'pukepuke', cause: ['starved', 'unknown'] },
        do: [{ lose: "Pukepuke starved. A family needs food close by: tap plants near them to call them to it." }] },

      // ---- Home: the family's last words, then the win ------------------------------------------------
      { id: 'home', on: 'goal_met', if: (x) => x.event && x.event.goal === 'home',
        say: [
          ['mama', "Look pookie, this is where you hatched from!", { lit: ['nests'] }],                 // (M0)
          ['mama', "Your papa watched over your egg all summer keeping it safe."],                     // (M0)
          ['papa', "And your mama outran a Pouākai to get you your pātōtara!"],                         // (M0)
          ['pukepuke', "Wooah..."],                                                                     // (M0)
          ['pukepuke', "I'm putting my wharariki flowers here. This is MY nest!",                       // (M0)
            { lit: ['nests'], onShow: (game) => { if (game.chapters) game.chapters.sow({ plant: 'wharariki', at: 'home', count: 2, radius: 10 }); } }],
          ['mama', "Come back here whenever you like, little one."],                                    // (M0)
          ['mama', "For now, let's head north and meet your friends!"]                                  // (M0)
        ] },
      // Papa was still on his way up when Mama got home.
      { id: 'papa_late', on: 'goal_met', if: (x) => x.event && x.event.goal === 'home' && !x.runner.nearCheck('papa', 'home', 110, null),
        say: [['papa', "Hey, wait for me!"]] },                                                         // (M0)
      { id: 'home_said', on: 'goal_met', if: (x) => x.event && x.event.goal === 'home', do: [{ flag: 'home_said' }] },
      // Not home when spring ran out: the family is still on its way, and says so.
      { id: 'on_the_way', on: 'chapter_start', if: (x) => K.opens('closing')(x) && !x.runner.flags.home_said,
        say: [
          ['mama', "Nearly there, pookie. I can see our old nest from here!", { lit: ['nests'] }],     // NEW
          ['mama', "For now, let's head north and meet your friends!"]                                  // (M0)
        ],
        do: [{ flag: 'home_said' }] }
    ], ['gave_up', 'gave_up_again', 'eagle_fed', 'eagle_fed_again', 'amber'], TAUGHT),

    winTitle: "HOME AGAIN",
    winText: "The family is home at the nest. North of here, other moa are waiting.",

    menu: K.journeyMenu("The Storm", "The journey: tile 1",
      ["One family, one year, high on the tops.", "", "A moa under a storm can't be seen."],
      ['tussock', 'patotara', 'wharariki', 'beech'])
  });
})();

LEVEL_REGISTRY.register(JOURNEY_STORM);
