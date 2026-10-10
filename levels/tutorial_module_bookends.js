// ============================================================================
// MODULE BOOKENDS: Te Whē's welcome and farewell
// ============================================================================
// Every module level's tips include these (Game._initFinalize adds them), so they follow the
// modules wherever they start and end:
//
//   intro    the first module (the lowest moduleIndex) opens on black: Te Whē tells how the
//            land came to be the way it is, then the screen fades in and the story starts
//            (its 'opening' moment). Once a session: a restart only fades in.
//   finale   the last module (the one with no story.nextModule after it): once the family is
//            home and their last words are said, the screen fades to black and Te Whē says
//            goodbye; the win card comes after.
//
// The director (ModuleDirector._beginIntro / _beginFinale in mauri_module.js) runs the fades
// and fires the moments. The words are the user's.
// ============================================================================
(function () {

const { onBeat, sceneWith } = MODULE_TIP_KIT;

// Te Whē (the mantis) narrates from the middle of the screen, with the tip chime (which
// doesn't stack: see AudioManager.playTutorialTip).
const scene = sceneWith({
  teWhe: { title: "Te Whē, the Mantis", sprite: 'mantis_talk', who: null, where: { fx: 0.56, fy: 0.5 } }
});

const TIPS = Object.assign({},

  scene('bookend_intro', onBeat('intro'), [
    ['teWhe', "Before people found the land, Aotearoa New Zealand was ruled by birds."],
    // (The kea's and the kākāpō's own calls play under this line.)
    ['teWhe', "Forests like Kahurangi in the Southern Alps bustled with the calls of Kea, Kiwi, Kākā, Kākāpō, Kōkako, Takahē and Huia.",
      { voices: ['kea', 'kakapo'], voicesSec: 7 }],
    ['teWhe', "But the forests they filled weren't always that dense, dark green bush we think of when we visit the native back country."],
    ['teWhe', "Over the last 100,000 years, the earth's temperature rose and fell in cycles. This was called the OTIRA GLACIATION. Each time it fell, more of the ancient forest died back, taking hundreds of years to regrow."],
    // (Opens on the winter wind.)
    ['teWhe', "The final cold phase happened 30,000 years ago: The LAST GLACIAL MAXIMUM.", { speaker: 'gust' }],
    ['teWhe', "When forests shrank, replaced by glacial tussock land, most of the birds were pushed back into smaller patches of forest."],
    ['teWhe', "And only one moa was prepared to thrive in Kahurangi's alps..."],
    ['teWhe', "Moa Pukepuke, The Upland Moa."],
    ['teWhe', "This is their story."]
  ]),

  scene('bookend_finale', onBeat('finale'), [
    ['teWhe', "And so, the years went by, and the Upland Moa continued their journey."],
    ['teWhe', "Thank you for playing! More modules will be added to expand the Glacial Kahurangi forest."],
    ['teWhe', "For now, you can continue in Free Play mode to see Pukepuke and Koukou grow together."]
  ])
);

TUTORIAL_REGISTRY.register('module_bookends', TIPS);

})();
