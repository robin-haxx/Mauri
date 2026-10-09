// ============================================================================
// MODULE BOOKENDS: Te Whē's welcome and farewell
// ============================================================================
// Every module level's tips include these (Game._initFinalize adds them), so they follow the
// modules wherever they start and end:
//
//   intro    the first module (the lowest moduleIndex) opens on black: Te Whē welcomes the
//            player, then the screen fades in and the story starts (its 'opening' moment).
//            Once a session: a restart only fades in.
//   finale   the last module (the one with no story.nextModule after it): once the family is
//            home and their last words are said, the screen fades to black and Te Whē says
//            goodbye; the win card comes after.
//
// The director (ModuleDirector._beginIntro / _beginFinale in mauri_module.js) runs the fades
// and fires the moments. Lines marked [Placeholder: …] are still to be written.
// ============================================================================
(function () {

const { onBeat, sceneWith } = MODULE_TIP_KIT;

// Te Whē (the mantis) speaks from the middle of the screen, with the tip chime.
const scene = sceneWith({
  teWhe: { title: "Te Whē", sprite: 'mantis_talk', who: null, where: { fx: 0.56, fy: 0.5 } }
});

const TIPS = Object.assign({},

  scene('bookend_intro', onBeat('intro'), [
    ['teWhe', "[Placeholder: Te Whē greets the player]", { title: "Welcome to the vertical slice levels!" }],
    ['teWhe', "[Placeholder: a year in the life of an upland moa family, high in the Kahurangi tops]"],
    ['teWhe', "[Placeholder: each module teaches one tool; the story shows what to do]"]
  ]),

  scene('bookend_finale', onBeat('finale'), [
    ['teWhe', "[Placeholder: Te Whē looks back on the families' year]"],
    ['teWhe', "[Placeholder: what the player has learned about life in the uplands]"],
    ['teWhe', "Thank you for playing! You can also play the original prototypes, or the NZGDC free-play mode."]
  ])
);

TUTORIAL_REGISTRY.register('module_bookends', TIPS);

})();
