// ============================================================================
// MODULE 1 (Pātōtara): TUTORIAL SCRIPT
// ============================================================================
// Lines marked [Placeholder: …] are still to be written: each marks a moment, who speaks, and
// roughly what it's about. The arrival and meeting lines and the kea's lines are written
// (Strongbeak's call for the others is Free Play's), and the banners (the "do this" prompts)
// are real. Pātōtara here comes up bare: a press and hold on it sprouts its berries, and the
// prompts teach that (the one by their nest first, then the player's own). The player already knows
// the storms from Module 0, so nothing here teaches them again: the eagle only gets a warning.
//
// The story (PatotaraDirector in mauri_module_patotara.js, built on ModuleDirector) fires
// TUTORIAL_EVENTS.MODULE_BEAT with data.beat set to one of these moments:
//
//   opening          the level has started (carried on from Module 0, once the camera has
//                    eased in): the family is walking in from the south
//   meet             they've reached the other family's nest (data.patch: the bare pātōtara
//                    by it, which the player sprouts next)
//   patch_home       the pātōtara by their nest is sprouted; the berries draw a kea (Strongbeak)
//   kea_threat       Strongbeak has landed by the berries; he calls Skraak and Huft-Tuft, who
//                    fly in once his lines are done
//   kea_gang         all three are there and mean to raid the egg (the odds show on the nest)
//   food_called      pātōtara grown and sprouted near their nest: the family is coming over
//                    (data.food)
//   sprouted         any pātōtara has just been sprouted (data.food)
//   unsprouted       pātōtara the player grew has stood bare a while (data.food): a reminder
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
//   berries_bare     the player tried to sprout pātōtara in winter (the first time): no berries now
//   wharariki_home   the wharariki is by the waterhole
//   spring           spring: the pātōtara is back, and both families head home
//   home             the family is back up beside their friends (the level is won once its tips are done;
//                    as the last module, after Te Whē's farewell)
//
// Scenes and banners come from levels/tutorial_module_kit.js.
// ============================================================================
(function () {

const { onBeat, spot, storms, family, marker, sceneWith, banner, moveBanner, reachBanner,
        eagleTips, broke, sproutBanner, sproutTips, SPROUT_WORDS } = MODULE_TIP_KIT;

// Who speaks, and their call as each line opens. The other family's parents' names are
// placeholders (their chick is Koukou, Pukepuke's friend; see the farewell).
const scene = sceneWith({
  papa:       { title: "Papa Moa",          sprite: 'upland_moa',   who: (d) => d.father, sound: 'moa' },
  mama:       { title: "Mama Moa",          sprite: 'upland_moa',   who: (d) => d.mother, sound: 'moa', pitch: 0.85 },
  chick:      { title: "Pukepuke",          sprite: 'upland_moa',   who: (d) => d.chick, sound: 'chick', scale: 0.65 },
  friendPapa: { title: "[Neighbour] Papa",  sprite: 'upland_moa',   who: (d) => d.friendFather, sound: 'moa', pitch: 1.1 },
  friendMama: { title: "Friendly Moa",      sprite: 'upland_moa',   who: (d) => d.friendMother, sound: 'moa', pitch: 0.95 },
  friendly:   { title: "Friendly Moa",      sprite: 'upland_moa',   who: (d) => d.friendMother, sound: 'moa', pitch: 0.95 },
  friendChick:{ title: "Koukou",            sprite: 'upland_moa',   who: (d) => d.friendChick, sound: 'chick', pitch: 1.15, scale: 0.5 },
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
// The pātōtara the player grew by their nest: still bare (to sprout), or sprouted.
const grownByNest = (game, bare) => {
  const fn = friendNest(game), k = K(game);
  return fn ? game.module.placedFood.find(p => p.alive && !!p.unsprouted === bare &&
    Math.hypot(p.pos.x - fn.x, p.pos.y - fn.y) <= k.foodReach) || null : null;
};

const TIPS = Object.assign({},

  // ==== SUMMER ==============================================================================
  // Walking in: the glade, and the other family by their nest.
  scene('opening', onBeat('opening'), [
    ['chick', "Are we there yet?"],
    ['mama', "...Yes, this is the Pātōtara glade! And look, it's another Upland Moa family.", {
      renderAboveOverlay: (game) => {
        spot((d) => [d.mother, ...d.friends])(game);
        marker(game, friendNest(game));
      }
    }]
  ]),

  scene('meet', onBeat('meet'), [
    ['friendly', "Why, hello! More moa is always a welcome sight! And what's your name, little one?"],
    ['chick', "Pukie-pukie!"],
    ['friendly', "Nice to meet you! Want to help us forage pātōtara, Pukie-pukie? There is plenty for all of us!", {
      renderAboveOverlay: spot((d) => [d.friendMother, d.patch])
    }]
  ], 'sprout_lesson'),

  {
    // Sprout the pātōtara by their nest (press and hold on it): it and the neighbours lit.
    sprout_lesson: sproutBanner('sprout_lesson', { type: TRIGGER_TYPE.IMMEDIATE },
      (game) => game.module && game.module.patch,
      (game) => game.renderEntitiesAboveUI([game.module && game.module.patch, ...neighbours(game)]))
  },



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
    // Grow pātōtara by their nest, then sprout it: the family and the kea lit, the nest ringed
    // (then the new patch lit). (Only pātōtara the player grows counts, not the patch by the nest.)
    // Once it's sprouted the family comes over, and the raid's odds on the nest fall as the moa
    // gather. It doesn't wait on a player who can't afford to grow one and has none to sprout.
    food_lesson: banner('food_lesson', { type: TRIGGER_TYPE.IMMEDIATE },
      (game) => grownByNest(game, true)
        ? ["Now " + SPROUT_WORDS.replace('Tap', 'tap'), SPROUT_WORDS]
        : ["Grow PĀTŌTARA by their NEST to bring your family over", "Tap beside their NEST to grow PĀTŌTARA"],
      (game) => !!grownByNest(game, false) ||
        (!grownByNest(game, true) && !game.selectedPlaceable && broke(game, 'place', 'patotara')),
      (game) => {
        const bare = grownByNest(game, true);
        game.renderEntitiesAboveUI([...family(game), ...neighbours(game), ...keas(game), ...(bare ? [bare] : [])]);
        if (!bare) marker(game, friendNest(game));   // (a grown patch is lit, not ringed)
      },
      { tool: 'patotara', needs: 'none', highlight: { type: 'element', target: 'tool:patotara' } })
  },

  scene('raid_failed', onBeat('raid_failed'), [
    ['kea', "Have it your way, keep your nest... But stay away from ours when you hide from the cold in our forest!", {
      renderAboveOverlay: keaScene
    }]
  ]),

  scene('friends', onBeat('friends'), [
    ['friendPapa', "Those Kea can be real pesky. Thanks for helping out!"],
    ['mama', "We should try and leave them be when we are foraging for WINTER.", {
      renderAboveOverlay: (game) => {
        spot((d) => [d.mother])(game);
        if (game.module) marker(game, game.module.sites.nest);
      }
    }]
  ]),

  // The neighbours' egg hatches; a moment later the young moa meet.
  scene('young_meet', onBeat('chick_peep'), [
    ['friendChick', "Squeek, Squeek!"],
    ['chick', "Wow... Was I that small last SUMMER?", {
      renderAboveOverlay: spot((d) => [d.chick, d.friendChick])
    }],
    ['friendChick', "...Squeek?"]
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
    ['friendMama', "We'll have to split up and forage in our own part of the forest for WINTER.", {
      renderAboveOverlay: (game) => {
        game.renderEntitiesAboveUI(neighbours(game));
        if (game.module) marker(game, game.module.sites.friendSpot);
      }
    }],
    ['chick', "Aw, goodbye Koukou!"],
    ['mama', "Okay Pukepuke, do you remember how to hide under STORMs?", {
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
    ['chick', "Oh no, we ate all the berries!"],
    ['papa', "Pātōtara won't grow back 'till SUMMER, so you're going to have to eat your flax...", {
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
    ['mama', "There's plenty of kai at the WATERHOLE... We can watch the WHARAIKI grow its flowers!"]
  ]),

  scene('berries_bare', onBeat('berries_bare'), [
    ['papa', "Such a shame, that pātōtara bush is shriveling up from the cold...", {
      renderAboveOverlay: (game, data) => game.module &&
        game.renderEntitiesAboveUI([game.module.father, data && data.food])
    }]
  ]),

  // Pātōtara the player grew and left bare: a reminder to sprout it.
  sproutTips(),

  // ==== SPRING ==============================================================================
  scene('spring', onBeat('spring'), [
    ['chick', "Look! I got some flax flowers to give to Koukou's family!"],
    ['mama', "That's so thoughtful, pookie! You can lead the way!"]
  ]),

  scene('home', onBeat('home'), [
    ['chick', "We're back in the mountains!", {
      renderAboveOverlay: (game) => {
        game.renderEntitiesAboveUI([...family(game), ...neighbours(game)]);
        if (game.module) marker(game, game.module.sites.nest);
      }
    }],
    ['friendChick', "Wow, WHARAIKI flowers!"]
  ])
);

TUTORIAL_REGISTRY.register('module_patotara', TIPS);

})();
