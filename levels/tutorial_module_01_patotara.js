// ============================================================================
// MODULE 1 (Pātōtara): TUTORIAL SCRIPT
// ============================================================================
// Lines marked [Placeholder: …] are still to be written: each marks a moment, who speaks, and
// roughly what it's about. The kea's lines are written (Strongbeak's call for the others is
// Free Play's), and the banners (the "do this" prompts) are real. The player already knows
// the storms from Module 0, so nothing here teaches them again: the eagle only gets a warning.
//
// The story (PatotaraDirector in mauri_module_patotara.js, built on ModuleDirector) fires
// TUTORIAL_EVENTS.MODULE_BEAT with data.beat set to one of these moments:
//
//   opening          the level has started (carried on from Module 0, once the camera has
//                    eased in): the family is walking in from the south
//   meet             they've reached the other family's nest (data.patch: the pātōtara)
//   patch_home       the pātōtara is by their nest; the berries draw a kea (Strongbeak)
//   kea_threat       Strongbeak has landed by the berries; he calls Skraak and Huft-Tuft, who
//                    fly in once his lines are done
//   kea_gang         all three are there and mean to raid the egg (the odds show on the nest)
//   food_called      pātōtara grown near their nest: the family is coming over (data.food)
//   raid_failed      all five moa round the nest: the kea give up and fly off to their nest
//   raid_won         too few: the kea took the egg (the level is lost)
//   friends          a moment later: the families make friends; ours stays close by (no nest of their own)
//   hatched          the other family's egg has hatched
//   chick_peep       ...and their chick has been out a moment (the young moa meet)
//   autumn_path      autumn: the families head downhill to different places; a storm gathers
//                    down the trail (data.storm)
//   journey_start, last_chance, unseen, hidden, spotted_again, storm_breaking, new_storm,
//   refuge, winter_pass, eagle_gave_up, eagle_left: the eagle and the walks, as Module 0
//   kea_lured        (after summer) berries the player grew, or the family near the kea's nest,
//                    have drawn kea (data.at, data.count)
//   kea_storm        a coming kea flew into a storm and turned back
//   kea_warn         kea have landed where the family is: a raid, at real odds (data.at)
//   kea_raid_won     the raid worked: the family scatters, the kea eat the berries there
//   kea_raid_lost    the raid failed: the kea go home
//   winter           winter: storms fade, the pātōtara is bare
//   berries_bare     pātōtara grown in winter (the first time): no berries now
//   wharariki_home   the wharariki is by the waterhole
//   spring           spring: the pātōtara is back, and both families head home
//   home             the family is back up beside their friends (the level is won once its tips are done;
//                    as the last module, after Te Whē's farewell)
//
// Scenes and banners come from levels/tutorial_module_kit.js.
// ============================================================================
(function () {

const { onBeat, spot, storms, family, marker, sceneWith, banner, moveBanner, reachBanner,
        eagleTips } = MODULE_TIP_KIT;

// Who speaks, and their call as each line opens. The other family's names are placeholders.
const scene = sceneWith({
  papa:       { title: "Papa Moa",          sprite: 'upland_moa',   who: (d) => d.father, sound: 'moa' },
  mama:       { title: "Mama Moa",          sprite: 'upland_moa',   who: (d) => d.mother, sound: 'moa', pitch: 0.85 },
  chick:      { title: "Pukepuke",          sprite: 'upland_moa',   who: (d) => d.chick, sound: 'chick', scale: 0.65 },
  friendPapa: { title: "[Neighbour] Papa",  sprite: 'upland_moa',   who: (d) => d.friendFather, sound: 'moa', pitch: 1.1 },
  friendMama: { title: "[Neighbour] Mama",  sprite: 'upland_moa',   who: (d) => d.friendMother, sound: 'moa', pitch: 0.95 },
  friendChick:{ title: "[Neighbour chick]", sprite: 'upland_moa',   who: (d) => d.friendChick, sound: 'chick', pitch: 1.15, scale: 0.5 },
  strongbeak: { title: "Strongbeak",        sprite: 'kea',          who: (d) => d.keas[0], sound: 'kea' },
  skraak:     { title: "Skraak",            sprite: 'kea',          who: (d) => d.keas[1], sound: 'kea' },
  huftTuft:   { title: "Huft-Tuft",         sprite: 'kea',          who: (d) => d.keas[2], sound: 'kea' },
  kea:        { title: "Kea",               sprite: 'kea',          who: (d) => d.keas[0], sound: 'kea' },
  pouakai:    { title: "Pouākai",           sprite: 'haasts_eagle', who: (d) => d.eagle, sound: 'eagle' }
});

const K = (game) => game.module && game.module.k;
const friendNest = (game) => game.module && game.module.sites.friendNest;
const neighbours = (game) => game.module ? game.module.friends.filter(m => m.alive) : [];
const keas = (game) => game.module ? game.module.keas.filter(k => k.alive) : [];
// The kea band lit up, and the family.
const keaScene = (game) => game.renderEntitiesAboveUI([...keas(game), ...family(game)]);

const TIPS = Object.assign({},

  // ==== SUMMER ==============================================================================
  scene('opening', onBeat('opening'), [
    ['mama', "[Placeholder: the family arrives on new tops, north of last year's nest]"]
  ]),

  scene('meet', onBeat('meet'), [
    ['friendMama', "[Placeholder: the neighbours greet them; they're sitting on an egg]"],
    ['friendMama', "[Placeholder: could they bring some pātōtara berries over to the nest?]", {
      renderAboveOverlay: (game) => {
        spot((d) => [d.friendMother, d.patch])(game);
      }
    }]
  ], 'patch_lesson'),

  {
    // Bring the pātōtara to their nest: the patch and the neighbours lit, the nest ringed.
    patch_lesson: reachBanner('patch_lesson', { type: TRIGGER_TYPE.IMMEDIATE },
      ["Tap and hold the PĀTŌTARA, and bring it to their NEST", "Set the PĀTŌTARA down by their NEST"],
      (game) => game.module && game.module.patch, friendNest, (game) => K(game).patchReach,
      (game) => {
        game.renderEntitiesAboveUI([game.module && game.module.patch, ...neighbours(game)]);
        marker(game, friendNest(game));
      },
      { tool: 'patotara' })
  },

  scene('patch_home', onBeat('patch_home'), [
    ['friendMama', "[Placeholder: thanks for the berries]"]
  ]),

  // Strongbeak finds the berries and calls the others (Free Play's lines). Skraak and
  // Huft-Tuft fly in once this closes.
  scene('kea_threat', onBeat('kea_threat'), [
    ['strongbeak', "KEE-A! KEE-A! BERRIES! Juicy pātōtara berries!", {
      renderAboveOverlay: spot((d) => [d.keas[0], d.patch])
    }],
    ['strongbeak', "Skraak, Huft-Tuft, get over here to eat the BERRIES!"]
  ]),

  // All three are there.
  scene('kea_gang', onBeat('kea_gang'), [
    ['strongbeak', "The Pouākai attacked our mountain perch last year... We could use a clearing like yours!", {
      renderAboveOverlay: (game) => game.renderEntitiesAboveUI(keas(game))
    }],
    ['skraak', "...And is that an egg? That'll go well with berries!", {
      renderAboveOverlay: (game) => {
        spot((d) => [d.keas[1]])(game);
        marker(game, friendNest(game));
      }
    }],
    ['chick', "Stay away! That egg is going to be my friend!"]
  ], 'food_lesson'),

  {
    // Grow pātōtara by their nest: the family and the kea lit, the nest ringed. (Only pātōtara
    // the player grows counts, not the patch they brought over.) Once it's down, the raid's
    // odds show on the nest, falling as the moa gather.
    food_lesson: banner('food_lesson', { type: TRIGGER_TYPE.IMMEDIATE },
      ["Grow PĀTŌTARA by their NEST to bring your family over", "Tap beside their NEST to grow PĀTŌTARA"],
      (game) => {
        const fn = friendNest(game), k = K(game);
        return !!fn && game.module.placedFood.some(p => p.alive && Math.hypot(p.pos.x - fn.x, p.pos.y - fn.y) <= k.foodReach);
      },
      (game) => {
        game.renderEntitiesAboveUI([...family(game), ...neighbours(game), ...keas(game)]);
        marker(game, friendNest(game));
      },
      { tool: 'patotara', needs: 'place', highlight: { type: 'element', target: 'tool:patotara' } })
  },

  scene('raid_failed', onBeat('raid_failed'), [
    ['kea', "Have it your way, keep your nest... But stay away from ours when you hide from the cold in our forest!", {
      renderAboveOverlay: keaScene
    }]
  ]),

  scene('friends', onBeat('friends'), [
    ['friendPapa', "[Placeholder: the neighbours thank them; friends now]"],
    ['mama', "[Placeholder: we'll stay close by for the summer, next to our new friends]", {
      renderAboveOverlay: (game) => {
        spot((d) => [d.mother])(game);
        if (game.module) marker(game, game.module.sites.nest);
      }
    }]
  ]),

  // The neighbours' egg hatches; a moment later the young moa meet.
  scene('young_meet', onBeat('chick_peep'), [
    ['friendChick', "[Placeholder: the new chick's first peep]"],
    ['chick', "[Placeholder: Pukepuke meets the new chick]", {
      renderAboveOverlay: spot((d) => [d.chick, d.friendChick])
    }],
    ['friendChick', "[Placeholder: the young moa talk]"]
  ]),

  // ==== THE KEA, THE REST OF THE YEAR =========================================================
  // Kea drawn to the family (by berries, or the family near their nest) warn them and raid.
  scene('kea_warn', onBeat('kea_warn'), [
    ['kea', "We warned you! Those berries are ours!", { renderAboveOverlay: keaScene }]
  ]),

  // A storm in a coming kea's way.
  scene('kea_storm', onBeat('kea_storm'), [
    ['kea', "A storm? That's too dangerous! Hold back!", {
      renderAboveOverlay: (game) => game.renderEntitiesAboveUI([...keas(game), ...storms(game)])
    }]
  ]),

  // How a raid turns out (Free Play's raid lines).
  scene('kea_raid_won', onBeat('kea_raid_won'), [
    ['kea', "SKRAAWK! Move over, you giant wingless birds! This glade is ours now!", {
      renderAboveOverlay: keaScene
    }]
  ]),
  scene('kea_raid_lost', onBeat('kea_raid_lost'), [
    ['strongbeak', "Skraw... There's too many of them... At this rate, we'll be done for in the winter! Skraak, regroup, regroup!", {
      renderAboveOverlay: keaScene
    }]
  ]),

  // ==== AUTUMN ==============================================================================
  scene('autumn_path', onBeat('autumn_path'), [
    ['friendMama', "[Placeholder: the neighbours are heading downhill for winter, somewhere else]", {
      renderAboveOverlay: (game) => {
        game.renderEntitiesAboveUI(neighbours(game));
        if (game.module) marker(game, game.module.sites.friendSpot);
      }
    }],
    ['chick', "[Placeholder: Pukepuke says goodbye to its friend]"],
    ['mama', "[Placeholder: another storm down the trail; time to go down to the waterhole]", {
      renderAboveOverlay: spot((d) => [d.autumnStorm, d.mother])
    }]
  ], 'autumn_storms'),

  // The eagle: a warning only (the storms were learned in Module 0).
  eagleTips({ teach: false }),

  {
    autumn_storms: moveBanner('autumn_storms', { type: TRIGGER_TYPE.IMMEDIATE },
      ["Make a STORM path down the trail to the WATERHOLE", "Set the STORM down further along the trail"],
      (game) => {
        game.renderEntitiesAboveUI([...storms(game), ...family(game)]);
        if (game.module) marker(game, game.module.sites.shore);
      })
  },

  // ==== WINTER ==============================================================================
  scene('winter', onBeat('winter'), [
    ['chick', "[Placeholder: hungry; where are the pātōtara berries?]"],
    ['papa', "[Placeholder: pātōtara only fruits in summer; there's wharariki up the slope]", {
      renderAboveOverlay: (game) => {
        spot((d) => [d.father, d.whararikiPatch])(game);
      }
    }]
  ], 'wharariki_lesson'),

  {
    // Move the wharariki down to the waterhole.
    wharariki_lesson: reachBanner('wharariki_lesson', { type: TRIGGER_TYPE.IMMEDIATE },
      ["Tap and hold the WHARARIKI, and bring it to the WATERHOLE", "Set the WHARARIKI down by the WATERHOLE"],
      (game) => game.module && game.module.whararikiPatch,
      (game) => game.module && game.module.sites.tarn,
      (game) => game.module.sites.tarnR + K(game).whararikiReach,
      (game) => {
        game.renderEntitiesAboveUI([game.module && game.module.whararikiPatch, ...family(game)]);
        if (game.module) marker(game, game.module.sites.shore);
      },
      { tool: 'wharariki' })
  },

  scene('wharariki_home', onBeat('wharariki_home'), [
    ['mama', "[Placeholder: wharariki by the waterhole, food for the winter]"]
  ]),

  scene('berries_bare', onBeat('berries_bare'), [
    ['papa', "[Placeholder: no berries on the pātōtara in winter]", {
      renderAboveOverlay: spot((d) => [d.father, d._newestFood()])
    }]
  ]),

  // ==== SPRING ==============================================================================
  scene('spring', onBeat('spring'), [
    ['chick', "[Placeholder: spring; will we see our friends again?]"],
    ['mama', "[Placeholder: everyone heads back up; back beside our friends]"]
  ]),

  scene('home', onBeat('home'), [
    ['chick', "[Placeholder: back up the tops, next door to friends]", {
      renderAboveOverlay: (game) => {
        game.renderEntitiesAboveUI([...family(game), ...neighbours(game)]);
        if (game.module) marker(game, game.module.sites.nest);
      }
    }],
    ['friendChick', "[Placeholder: the friends are back too]"]
  ])
);

TUTORIAL_REGISTRY.register('module_patotara', TIPS);

})();
