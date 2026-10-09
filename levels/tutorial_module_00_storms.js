// ============================================================================
// MODULE 0 (Āwhā, the storm): TUTORIAL SCRIPT
// ============================================================================
// The story (ModuleDirector in mauri_module.js) fires TUTORIAL_EVENTS.MODULE_BEAT with
// data.beat set to one of these moments, and a tip can trigger on any of them:
//
//   opening        the story starts (the family, nest and storms are in place; as the first
//                  module, after Te Whē's welcome and the fade in from black)
//   save_mother    summer: the eagle has seen the mother out in the open
//   eagle_gave_up  an attack is over: the eagle gave up and is turning away (data.kind says which)
//   eagle_left     ...and a moment later it has flown off (data.kind)
//   food_home      summer: the mother is back at the nest with food (the egg hatches next)
//   hatched        the egg has hatched
//   chick_peep     ...and the chick has been out a moment (its first words); then the view
//                  pulls back, the clouds down the mountain clear and the eagle flies off
//   autumn_path    autumn has begun: the view pulls back, the trail down shows, and a new
//                  storm gathers a little way down it (data.storm; a wisp until pointed out)
//   eagle_back     the eagle, back once the storm path is under way, is near the family (from
//                  then on it patrols round them)
//   journey_start  the family sets off (autumn down, spring home)
//   hungry         autumn, a little way into the walk: some of the family are hungry
//                  (data.moa); they feed on the plants along the way
//   last_chance    the eagle has seen a family member in the open and is about to dive
//   unseen         the eagle arrived but the family was already hidden
//   hidden         the family got hidden while the eagle was circling
//   spotted_again  a hidden bird stepped out and was seen again
//   storm_breaking autumn, second attack: the storm over the family is breaking up
//   new_storm      ...and a new storm is needed: the Storm tool unlocks at this moment
//   refuge         the family reached the tarn
//   winter         winter has begun: storms wear out now
//   winter_pass    the eagle's first winter visit has spotted someone
//   spring         spring has begun
//   home           Mama is back at the nest (the level is won once its tips are done and the
//                  whole family is there)
//   papa_late      after the home tips: Papa wasn't home yet when Mama got there
//
// The story is told as dialogue between the family and the Pouākai (scenes), and every
// "do this with a storm" prompt is a banner. Both come from levels/tutorial_module_kit.js.
// (Te Whē's welcome before all this, and farewell after the last module, are in
// levels/tutorial_module_bookends.js.)
// ============================================================================
(function () {

const { onBeat, spot, storms, family, marker, trail, rings, awayFrom, sceneWith, banner, moveBanner,
        placeBanner, eagleAlert, eagleTips } = MODULE_TIP_KIT;

// Who speaks: their name (the tip's title), their sprite, which bird to light up, and their
// call as each line opens (Mama, the bigger bird, a little lower than Papa).
const scene = sceneWith({
  papa:    { title: "Papa Moa",  sprite: 'upland_moa',   who: (d) => d.father, sound: 'moa' },
  mama:    { title: "Mama Moa",  sprite: 'upland_moa',   who: (d) => d.mother, sound: 'moa', pitch: 0.85 },
  pouakai: { title: "Pouākai",   sprite: 'haasts_eagle', who: (d) => d.eagle,  sound: 'eagle' },
  chick:   { title: "Pukepuke",  sprite: 'upland_moa',   who: (d) => d.chick,  sound: 'chick', scale: 0.55 }
});

// The way down to the wharariki, lit up; and the wharariki growing by the tarn.
const theWayDown = (game) => game.module && trail(game, game.module.sites.path);
const wharariki = (d) => d.wharariki || [];
// A line said while the way down is talked about: the trail lit under whoever is speaking
// (and `more`), and the panel kept clear of all of it.
const onTheWay = (who, more = () => []) => ({
  renderAboveOverlay: (game) => {
    theWayDown(game);
    spot((d) => [who(d), ...more(d)])(game);
  },
  guidePosition: awayFrom((d) => {
    const p = d.sites.path;
    return [who(d), p[0], p[Math.floor(p.length / 2)], d.sites.shore];
  })
});

const TIPS = Object.assign({},

  // ==== SUMMER: the mother out at the pātōtara ==============================================
  scene('opening', onBeat('opening'), [
    ['papa', "Hurry up honey, it's dangerous out there in the open!"],
    ['mama', "I know, I know... But this pātōtara will be such a lovely first meal for our little Pukepuke!"],
    ['mama', "And just look at that storm gathering. I'm sure Tāwhirimātea is on our side.",
      { renderAboveOverlay: (game) => {   // her, and the storms gathering
        game.renderEntitiesAboveUI(storms(game));
        spot((d) => [d.mother])(game);
      } }]
  ]),

  // The eagle has seen her. The lesson comes straight after (storm_lesson).
  scene('save_mother', onBeat('save_mother'), [
    ['pouakai', "I spy with my little eye, something beginning with M....",
      { spotlightHuntingEagle: true, renderAboveOverlay: null }],
    ['pouakai', "Mmm, mmm... MOA! Tasty Moa in these Mmm.. M... Mountains!",
      { spotlightHuntingEagle: true, renderAboveOverlay: null }],
    ['mama', "Eeek!"]
  ], 'storm_lesson'),

  {
    // The storms are lit up; picking one up changes the words and lights the mother too. The
    // banner goes once she is under a storm. (The Pouākai's screech, and it on the hunt beside
    // the words: this is the player stepping in to stop it.)
    storm_lesson: banner('storm_lesson', { type: TRIGGER_TYPE.IMMEDIATE },
      ["Tap and hold a STORM to move it", "Move the STORM to cover MAMA MOA"],
      (game) => {
        const d = game.module;
        return !!(d && d.mother && d.mother.alive && d.isHidden(d.mother));
      },
      (game) => {
        const d = game.module;
        game.renderEntitiesAboveUI(storms(game));
        if (d && game.movingPlaceable) game.renderEntitiesAboveUI([d.mother]);
      }, eagleAlert)
  },

  // She's hidden and the eagle gives up. (A few seconds of play before the eagle answers her.)
  scene('mother_hidden', onBeat('eagle_gave_up', (d) => d.kind === 'mother'), [
    ['pouakai', "Blast these clouds! Where'd my big, tasty lunch go?"],
    ['mama', "Who do you think you're calling big, huh?"],
    ['pouakai', "SKRAHH! I'm so hungry... I'll have to S... scuffle with the Kea for S... Scraps!", { wait: 3 }]
  ]),

  scene('eagle_left', onBeat('eagle_left', (d) => d.kind === 'mother'), [
    ['papa', "Maybe the atua are watching over us. But get back to the nest before the clouds clear!"]
  ]),

  scene('food_home', onBeat('food_home'), [
    ['mama', "Look, big lovely pātōtara berries.. And just in time, look at my little egg!", {
      // The parents, and the egg in the nest ringed.
      renderAboveOverlay: (game) => game.module && game.renderSpotlightAboveUI({
        species: ['upland_moa'], at: game.module.sites.nest
      })
    }]
  ]),

  // A moment after the hatching, so the chick is seen first.
  scene('hatched', onBeat('chick_peep'), [
    ['chick', "Peep! Peep!", { title: "Moa Pukepuke" }]
  ]),

  // ==== AUTUMN: down to the wharariki ========================================================
  // From "we're going downhill" on, the way down is lit (and the wharariki at the end of it).
  scene('autumn_path', onBeat('autumn_path'), [
    ['chick', "Where'd all the Pātōtara berries go, mama?"],
    ['mama', "They've gone away pookie, because the air is getting too cold in these mountains. It's going to be winter soon!"],
    ['papa', "That means it's time for an adventure! We're going downhill to find some hardy Wharariki.",
      onTheWay((d) => d.father, wharariki)],
    ['chick', "That doesn't sound very yummy...", onTheWay((d) => d.chick)],
    ['mama', "If you learn to chew your food, the Wharariki will sprout sweet flowers for you to eat in spring!",
      onTheWay((d) => d.mother, wharariki)],
    // (The storm, a wisp till now, swells as she points it out.)
    ['mama', "And look downhill, another STORM! That'll keep us safe from Pouākai on the journey!",
      Object.assign(onTheWay((d) => d.autumnStorm, (d) => [d.mother]), {
        onShow: (game) => { if (game.module) game.module.swellAutumnStorm(); }
      })],
    ['papa', "Alright, time to go! Mama Moa, lead the way!", onTheWay((d) => d.father)]
  ], 'autumn_storms'),

  // The Pouākai, gone since the hatching, flies back in once the storm path is under way.
  scene('eagle_back', onBeat('eagle_back'), [
    ['pouakai', "Now, that was barely a meal at all... All those Kea had in their nest were disgusting, little round orange things!"],
    ['pouakai', "Aha! I spy something more kai-shaped moving, under that cloud... That's moa like it!", {
      renderAboveOverlay: (game) => game.renderEntitiesAboveUI([...storms(game), ...family(game),
                                                                game.module && game.module.eagle])
    }]
  ]),

  eagleTips(),

  {
    // Build the rest of the way: the trail, storms, family and wharariki lit, the tarn's shore
    // ringed.
    autumn_storms: moveBanner('autumn_storms', { type: TRIGGER_TYPE.IMMEDIATE },
      ["Make a STORM path down the trail to the WHARARIKI", "Set the STORM down further along the trail"],
      (game) => {
        theWayDown(game);
        game.renderEntitiesAboveUI([...storms(game), ...family(game), ...(game.module ? wharariki(game.module) : [])]);
        if (game.module) marker(game, game.module.sites.shore);
      }),

    // On the way down, the hungry ones ringed while play goes on: they eat what grows along
    // the trail. It goes once they've eaten (or after a while), or as soon as the eagle comes.
    hungry: {
      id: 'hungry',
      trigger: onBeat('hungry', (d, game) => {
        const m = game.module;
        return !!m && !m.chase && !!(m.journey && m.journey.active);
      }),
      banner: "Moa need to eat PLANTS to sustain Mauri (life force).",
      dismissWhen: (game) => {
        const d = game.module, t = game.tutorial.tipDisplayTime;
        return !d || game.state === GAME_STATE.WON || game.state === GAME_STATE.LOST || !!d.chase ||
          !(d.journey && d.journey.active) || t > 600 || (t > 300 && !d.hungryMoa().length);
      },
      renderAboveOverlay: (game) => game.module && rings(game, game.module.hungryMoa()),
      highlight: null,
      dim: false,
      pauseGame: false,
      showOnce: true,
      priority: 1,
      urgency: 'high'
    },

    // ==== WINTER: by the tarn ================================================================
    // Storms fade away in winter: call new ones.
    winter: placeBanner('winter', onBeat('winter'),
      ["STORMS fade over time in winter! Tap the STORM button to call a new one", "Tap beside the family to call the STORM"],
      (game) => game.renderEntitiesAboveUI([...storms(game), ...family(game)])),

    // ==== SPRING: home again (after the spring scene below) ==================================
    // No recharge this season: call a few storms up the way home.
    spring_storms: placeBanner('spring_storms', { type: TRIGGER_TYPE.IMMEDIATE },
      ["Call STORMS to make a path back up to the NEST", "Tap along the way up to call a STORM"],
      (game) => {
        game.renderEntitiesAboveUI([...storms(game), ...family(game)]);
        if (game.module) marker(game, game.module.sites.nest);
      }, 2)
  },

  scene('spring', onBeat('spring'), [
    ['chick', "Yum! I love wharariki flowers!"],
    ['papa', "Well, we have to leave this waterhole now, Pukepuke, so you better stuff as many into your beak as you can!"],
    ['chick', "Are the Pātōtara berries back in the mountains?"],
    ['mama', "That's right pookie! We can head north and find some more moa for you to make friends with!"],
    ['chick', "...Brt I drn't wrnt to share myr flowers rnd berries!!"],
    ['papa', "Don't talk with your mouth full, Pukepuke. There'll be plenty of berries up there for all of us..."]
  ], 'spring_storms'),

  // Home at the nest. The win screen comes after the last line.
  scene('home', onBeat('home'), [
    ['mama', "Look pookie, this is where you hatched from!", {
      renderAboveOverlay: (game) => {   // her, and the nest ringed
        spot((d) => [d.mother])(game);
        if (game.module) marker(game, game.module.sites.nest);
      }
    }],
    ['mama', "Your papa watched over your egg all summer keeping it safe."],
    ['papa', "And your mama outran a Pouākai to get you your pātōtara!"],
    ['chick', "Wooah..."],
    ['chick', "I'm putting my wharariki flowers here. This is MY nest!", {
      onShow: (game) => { if (game.module) game.module.leaveFlowers(); }
    }],
    ['mama', "Come back here whenever you like, little one."],
    ['mama', "For now, let's head north and meet your friends!"]
  ]),

  // Papa was still on his way up when Mama got home: once they've had their say, he calls out.
  scene('papa_late', onBeat('papa_late'), [
    ['papa', "Hey, wait for me!"]
  ])
);

TUTORIAL_REGISTRY.register('module_storms', TIPS);

})();
