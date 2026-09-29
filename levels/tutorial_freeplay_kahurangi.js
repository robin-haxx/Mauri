// ============================================================================
// FREE PLAY (Mutunga kore); TUTORIAL SCRIPT
// See levels/tutorial_01_kahurangi.js for the tip-format authoring guide.
// Free Play assumes the player met the moa in the story levels, so it opens on a reminder
// rather than a full walkthrough; the rest teaches the endless loop as it happens. Endless
// tips key off TUTORIAL_EVENTS.YEAR_START, which fires once a year's toolbar, focus and
// goals are in place. Tips with guideSprite: 'kea' are spoken by the kea, not the mantis.
// ============================================================================
(function () {

// The zone moa (upland + bush backbone; see the level's moaZones).
const fpZoneMoa = (game) =>
  Object.values((game.currentLevel && game.currentLevel.moaZones) || {}).map(z => z.moa);

// Short names the guide uses for the zone moa.
const FP_MOA_NICKNAME = { upland_moa: 'upland moa', little_bush_moa: 'bush moa' };

// The Year of the Kea: its Berry Cache tool is on the toolbar.
const fpKeaYear = (game) => !!(game.activePlaceables && game.activePlaceables.keaLure);

// A Berry Cache is standing somewhere on the map.
const fpCachePlaced = (game) => {
  const list = (game.simulation && game.simulation.placeables) || [];
  for (let i = 0; i < list.length; i++) if (list[i].alive && list[i].type === 'keaLure') return true;
  return false;
};

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
  },

  // ---------- First zone-moa egg: nests → focus species → the seasons ----------
  // The laying species (and its nest + clutch) glows through the overlay; the panel sits
  // on the half of the screen away from the nest.
  fp_egg_safe: {
    id: 'fp_egg_safe',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.EGG_LAID,
      condition: (game, data) => !!data && fpZoneMoa(game).includes(data.speciesKey)
    },
    title: "Keep your moa safe!",
    content: [
      "Moa of the same species will gather at nesting sites, and lay their eggs in the same brown circle.",
      "Be wary... The mighty Pouākai hunts where many moa are gathered."
    ],
    guidePosition: (game, data) => {
      const egg = data && data.egg;
      if (!egg) return 'center';
      return game._worldToScreen(egg.pos.x, egg.pos.y).y < CONFIG.canvasHeight * 0.5 ? 'bottom' : 'top';
    },
    // Make sure the laying species is highlighted while the tip is up (restored after).
    onShow: (game, data) => {
      const k = data && data.speciesKey;
      if (k && typeof SPECIES_HIGHLIGHT !== 'undefined' && !SPECIES_HIGHLIGHT.has(k)) {
        SPECIES_HIGHLIGHT.add(k);
        game.tutorial.scratch.eggHighlightAdded = k;
      }
    },
    renderAboveOverlay: (game, data) => game.renderSpotlightAboveUI({
      species: data && data.speciesKey ? [data.speciesKey] : [],
      at: data && data.egg ? data.egg.pos : null
    }),
    onDismiss: (game) => {
      const k = game.tutorial.scratch.eggHighlightAdded;
      if (k && typeof SPECIES_HIGHLIGHT !== 'undefined') SPECIES_HIGHLIGHT.delete(k);
      delete game.tutorial.scratch.eggHighlightAdded;
    },
    nextTip: 'fp_focus_species', pauseGame: true, showOnce: true, priority: 2
  },

  fp_focus_species: {
    id: 'fp_focus_species',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Click or tap a species to highlight it!",
    // Names this year's off-focus zone moa (the bush moa in the upland opening year).
    content: (game) => {
      const lines = ["Make sure to help these species; if one goes extinct this year, it's game over."];
      const off = (game.freeplayOffMoa || [])[0];
      if (off) {
        const zones = (game.currentLevel && game.currentLevel.moaZones) || {};
        const uphill = zones.upland && zones.upland.moa === off;
        const name = FP_MOA_NICKNAME[off] || game._freeplaySpeciesName(off);
        lines.push(`The ${name} isn't a "focus" species this year, we will go ${uphill ? 'uphill' : 'downhill'} to meet them soon. ` +
                   "But keeping their numbers up if possible, will help the forest in the long term!");
      }
      return lines;
    },
    guidePosition: 'left',
    highlight: { type: 'element', target: 'focusSpecies' },
    highlightAlt: { type: 'element', target: 'offFocusSpecies' },
    // The highlighted species glow on the map too, following the tiles live as they're
    // toggled while the tip is up.
    renderAboveOverlay: (game) => typeof SPECIES_HIGHLIGHT !== 'undefined' &&
      game.renderSpotlightAboveUI({ species: [...SPECIES_HIGHLIGHT] }),
    nextTip: 'fp_seasons', pauseGame: true, showOnce: true, priority: 2
  },

  fp_seasons: {
    id: 'fp_seasons',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Keep track of the seasons.",
    content: [
      "Aim to achieve your GOALS by the start of next summer.",
      "Winter will see food sources dry up, and spring will be Kea's breeding season. " +
      "Keep protecting your vulnerable moa and Kea all year!"
    ],
    guidePosition: 'topRight',
    highlight: { type: 'element', target: 'seasonDisplay' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  // ---------- Year of the Kea: the berries, then the guide explains ----------
  // A Berry Cache placed, or autumn reached (pātōtara fruit then), in the kea year.
  fp_kea_berries: {
    id: 'fp_kea_berries',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (game) => fpKeaYear(game) &&
        (fpCachePlaced(game) || (game.seasonManager && game.seasonManager.currentKey === 'autumn'))
    },
    title: "KEE-A! KEE-A!",
    content: [
      "BERRIES! Juicy pātōtara berries!",
      "Skraak, Huft-Tuft, get over here to eat the BERRIES!"
    ],
    guideSprite: 'kea', voice: 'kea',
    guidePosition: 'center',
    renderAboveOverlay: (game) => game.renderSpotlightAboveUI({ species: ['kea'] }),
    // The guide follows up 5s of play after this closes (fp_kea_strongbeak).
    onDismiss: (game) => { game.tutorial.scratch.keaBerriesAt = game.playTime; },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  fp_kea_strongbeak: {
    id: 'fp_kea_strongbeak',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (game) => {
        const t = game.tutorial.scratch.keaBerriesAt;
        return t != null && game.playTime >= t + 300;   // 5s @60fps
      }
    },
    title: "That's Strongbeak the kea",
    content: [
      "The kea will follow wherever you place berries, and you can disperse them with the STORM. They eat eggs as well...",
      "If your Moa are taking up too much territory, stage a NEST RAID to take over the area.",
      "With Moa driven out, Kea can nest in the podocarp forest, safe from Pouākai."
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'tool:nestRaid' },
    highlightAlt: { type: 'element', target: 'tool:keaLure' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  // ---------- Nest raids: the kea react to the roll ----------
  fp_raid_success: {
    id: 'fp_raid_success',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.NEST_RAID,
      condition: (game, data) => !!(data && data.success)
    },
    title: "SKRAAWK!",
    content: ["Move over, you giant wingless birds! This glade is ours now!"],
    guideSprite: 'kea', voice: 'kea',
    guidePosition: 'center',
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  },

  fp_raid_fail: {
    id: 'fp_raid_fail',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.NEST_RAID,
      condition: (game, data) => !!data && !data.success
    },
    title: "Skraw...",
    content: [
      "There's too many of them... At this rate, we'll be done for in the winter!",
      "Skraak, regroup, regroup!"
    ],
    guideSprite: 'kea', voice: 'kea',
    guidePosition: 'center',
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  },

  // ---------- A focus species is being hunted: call the storm ----------
  // Only while a storm is affordable (the tool:Storm highlight gates it). Like Level 1's,
  // it arms a grace window on the hunting eagles (~8s to respond before a strike) and
  // flashes the hunter above the overlay.
  fp_storm: {
    id: 'fp_storm',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.EAGLE_HUNTING,
      condition: (game, data) => !!(data && data.target && game._freeplayFocusSet &&
                                    game._freeplayFocusSet().has(data.target.speciesKey))
    },
    title: "Call on Tāwhirimātea!",
    content: (game, data) => {
      const k = data && data.target && data.target.speciesKey;
      const name = k ? (FP_MOA_NICKNAME[k] || game._freeplaySpeciesName(k)) : 'focus species';
      return [
        `The Pouākai is hunting one of your ${name}!`,
        "Select the Storm [🌩️] and drop it on the hunting eagle; a mighty thunderstorm will throw it off the chase."
      ];
    },
    onShow: (game, data) => {
      const GRACE = 480; // frames @60fps ≈ 8s
      const eagles = (game.simulation && game.simulation.eagles) || [];
      for (let i = 0; i < eagles.length; i++) {
        if (eagles[i].hunting) {
          eagles[i].tutorialGraceTimer = Math.max(eagles[i].tutorialGraceTimer || 0, GRACE);
        }
      }
      if (data && data.eagle) {
        data.eagle.tutorialGraceTimer = Math.max(data.eagle.tutorialGraceTimer || 0, GRACE);
      }
    },
    guidePosition: 'bottomRight',
    highlight: { type: 'element', target: 'tool:Storm' },
    spotlightHuntingEagle: true,
    guidedPlaceable: 'Storm',
    nextTip: null, pauseGame: true, showOnce: true, priority: 1, urgency: 'high'
  },

  // ---------- First winter: the Last Glacial Maximum, then how mauri is earned ----------
  fp_winter_lgm: {
    id: 'fp_winter_lgm',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.SEASON_CHANGE,
      condition: (game, data) => !!data && data.seasonKey === 'winter'
    },
    title: "These winters don't get any warmer from here...",
    content: [
      "The Last Glacial Maximum was a time 25,000 years ago, where the climate froze over. " +
      "Forests even on the West Coast shrank from vast, dense canopies to tiny patches of \"refugia,\" " +
      "and vulnerable species had to fight for these patches of territory.",
      "Your role as kaitiaki is to keep things in balance for as long as possible."
    ],
    guidePosition: 'center',
    nextTip: 'fp_winter_mauri', pauseGame: true, showOnce: true, priority: 1
  },

  fp_winter_mauri: {
    id: 'fp_winter_mauri',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Give back to the ngahere",
    content: [
      "You'll gain more Mauri if species don't out-compete each other, and your populations stay in balance while they grow.",
      "Each Summer, we will move to a new area of forest to watch over. ",
      "For now, protect your vulnerable species from the cold, and our giant winged hunters." +
      " Good luck!"
    ],
    guidePosition: 'topLeft',
    highlight: { type: 'element', target: 'mauriDisplay' },
    highlightAlt: { type: 'element', target: 'popDial' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  }
};

TUTORIAL_REGISTRY.register('freeplay_kahurangi', TIPS);
})();
