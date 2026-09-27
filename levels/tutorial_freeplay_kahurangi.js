// ============================================================================
// FREE PLAY (Mutunga kore); TUTORIAL SCRIPT
// See levels/tutorial_01_kahurangi.js for the tip-format authoring guide.
// Free Play assumes the player met the moa in the story levels, so it opens on a reminder
// rather than a full walkthrough. Endless tips key off TUTORIAL_EVENTS.YEAR_START, which
// fires once a year's toolbar, focus and goals are in place.
// ============================================================================
(function () {

const TIPS = {
  // Opening shot: the camera zooms in on one upland moa and a spot its speargrass can go
  // (Game._beginIntroShot), then eases back out to the whole country as the tip closes.
  fp_speargrass: {
    id: 'fp_speargrass',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.YEAR_START,
      condition: (game, data) => !!data && data.cycle === 0
    },
    title: "Remember how to help the upland moa?",
    content: [
      "Place speargrass to guide them in subalpine areas!",
      "You can settle a nest by placing several."
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'tool:speargrass' },
    guidedPlaceable: 'speargrass',
    onShow: (game) => game._beginIntroShot('upland_moa', 'speargrass'),
    renderAboveOverlay: (game) => game.renderIntroShotAboveUI(),
    onDismiss: (game) => game._endIntroShot(),
    nextTip: null, pauseGame: true, showOnce: true, priority: 0
  }
};

TUTORIAL_REGISTRY.register('freeplay_kahurangi', TIPS);
})();
