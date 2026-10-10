// ============================================================================
// FREE PLAY (Pukepuke & Koukou): TUTORIAL SCRIPT
// ============================================================================
// Kept minimal. Te Whē sets out the five-year goal, then the bare essentials of the screen as
// Level 1 explains them (mauri, goals, the toolbox). After that there's no hand-holding: the
// essential actions are prompted while play goes on, as big-text banners that don't pause.
// The director decides when (FreePlayDirector._updateNeeds): in the first year as soon as one
// is needed, after that only once the player has let it go 10 seconds (the eagle's: shortly
// before it dives), and only when the player can do it right then. Te Whē closes the five
// years at the finale. No other creature speaks.
//
// The director (mauri_module_freeplay.js) fires TUTORIAL_EVENTS.MODULE_BEAT with data.beat:
//   opening   the years begin
//   prompt    an essential action is wanted: data.need is one of
//               cover        the Pouākai has seen a family moa (data.moa)
//               pathDown     autumn: a storm path down the trail to the waterhole
//               pathUp       spring: a storm path back up to the nests
//               hungry       a family moa critically hungry, with food close by to tap (data.moa)
//               friendsFood  winter: Koukou's family has no food by them (data.at, data.patches)
//               sprout       grown pātōtara left bare (data.food)
//   ending    the finale: Pukepuke and Koukou grown, mated, their first egg in the nest
// (It fires others too: new_year, mast, egg_laid, moa_hatched, eagle_fed, moa_taken,
// birds_nesting, kea_raid_won ... for anything added later.)
// ============================================================================
(function () {

const { onBeat, marker, trail, sceneWith, banner, eagleAlert, SPROUT_WORDS } = MODULE_TIP_KIT;

// Te Whē narrates from the middle of the screen (as in the modules' bookends).
const scene = sceneWith({
  teWhe: { title: "Te Whē, the Mantis", sprite: 'mantis_talk', who: null, where: { fx: 0.56, fy: 0.5 } }
});

const young = (game) => game.module ? [game.module.pukepuke, game.module.koukou].filter(m => m && m.alive) : [];

// A Level 1 style screen tip from Te Whē: paused, once, pointing at part of the screen.
const uiTip = (id, title, content, highlight, guidePosition, nextTip = null, extra = {}) => ({ [id]: Object.assign({
  id, trigger: { type: TRIGGER_TYPE.IMMEDIATE }, title, content, guidePosition, highlight,
  nextTip, pauseGame: true, showOnce: true, priority: 1
}, extra) });

// A prompt: a banner that plays on while the game runs. It goes once the need is met (the
// director's needActive), or after a while if the player leaves it (not the eagle's).
const PROMPT_SEC = 12;
const prompt = (need, words, lit, extra = {}) => ({ [`prompt_${need}`]: banner(`prompt_${need}`,
  onBeat('prompt', (d) => d.need === need), words,
  (game) => !game.module || !game.module.needActive(need) ||
            (need !== 'cover' && game.tutorial.tipDisplayTime > PROMPT_SEC * 60),
  lit,
  Object.assign({ pauseGame: false, dim: false, showOnce: false, needs: 'none' }, extra)) });

const TIPS = Object.assign({},

  // ==== THE OPENING: the goal, then the screen ===============================================
  scene('fp_welcome', onBeat('opening'), [
    ['teWhe', "Pukepuke and Koukou are still young, and need your protection."],
    ['teWhe', "Keep them safe for five winters, and we can watch them grow up!", {
      renderAboveOverlay: (game) => game.renderEntitiesAboveUI(young(game))
    }]
  ], 'fp_mauri'),

  uiTip('fp_mauri', "The Mauri level of the forest", [
    "Mauri is the spiritual energy of this ngahere.",
    "As well as Upland Moa, all birds on the land add to it. Use it to shape the forest."
  ], { type: 'element', target: 'mauriDisplay' }, 'topLeft', 'fp_goals'),

  uiTip('fp_goals', "Goals & Information", [
    "Try to achieve your GOALs every season.",
    "Use the SEASON RING to prepare for what comes next!"
  ], { type: 'element', target: 'goalsPanel' }, 'left', 'fp_tools',
     { highlightAlt: { type: 'element', target: 'seasonDisplay' } }),

  uiTip('fp_tools', "You have a toolbox for shaping the ecosystem!", [
    "Mauri can become pātōtara, wharariki and storms.",
    "Select a tool, then a spot in the world to place it."
  ], { type: 'element', target: 'toolbar' }, 'bottomLeft'),

  // ==== THE PROMPTS ==========================================================================
  prompt('cover', ["The Pouākai has seen them! Cover them with a STORM", "Set the STORM over them"],
    (game, d) => { for (const m of (d && d.moa) || []) if (m.alive) marker(game, m.pos); },
    eagleAlert),

  prompt('pathDown', ["Make a STORM path down the trail to the WATERHOLE", "Set the STORM down further along the trail"],
    (game) => { if (game.module) { trail(game, game.module.sites.path); marker(game, game.module.sites.shore); } }),

  prompt('pathUp', ["Make a STORM path back up to the NESTS", "Set the STORM down further up the trail"],
    (game) => { if (game.module) { trail(game, game.module.sites.pathUp); marker(game, game.module.sites.nest); } }),

  prompt('hungry', ["Your moa are starving! Tap PLANTS near them to bring them to food",
                    "Your moa are starving! Tap PLANTS near them to bring them to food"],
    (game, d) => { for (const m of (d && d.moa) || []) if (m.alive) marker(game, m.pos); }),

  prompt('friendsFood', ["Move a WHARARIKI to Koukou's family", "Set the WHARARIKI down by Koukou's family"],
    (game, d) => {
      if (!d) return;
      game.renderEntitiesAboveUI((d.patches || []).filter(p => p.alive));
      if (d.at) marker(game, d.at);
    },
    { tool: 'wharariki' }),

  prompt('sprout', [SPROUT_WORDS, SPROUT_WORDS],
    (game, d) => { if (d && d.food && d.food.alive) marker(game, d.food.pos); },
    { tool: 'patotara' }),

  // ==== THE POUĀKAI'S PLACE ==================================================================
  // The first time it takes something, Te Whē says why that's all right (as Level 1 does), and
  // whose safety is the player's.
  scene('fp_pouakai', onBeat(['eagle_fed', 'moa_taken']), [
    ['teWhe', "Haast's eagle evolved alongside the moa. As predator and prey, they keep each other in balance."],
    ['teWhe', "So it's good for the ngahere that the Pouākai hunts. But Pukepuke and Koukou's families are yours to keep safe!", {
      renderAboveOverlay: (game) => game.renderEntitiesAboveUI(young(game))
    }]
  ]),

  // ==== THE FINALE ===========================================================================
  scene('fp_ending', onBeat('ending'), [
    ['teWhe', "Five years have passed on the tops."],
    ['teWhe', "Pukepuke and Koukou are grown, and they've made a nest of their own.", {
      renderAboveOverlay: (game) => {
        game.renderEntitiesAboveUI(young(game));
        if (game.module) marker(game, game.module.sites.thirdNest);
      }
    }],
    ['teWhe', "As long as there are kaitiaki to watch over them, the upland moa will go on in Kahurangi."]
  ])
);

TUTORIAL_REGISTRY.register('module_freeplay', TIPS);

})();
