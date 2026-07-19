// ============================================================================
// LEVEL 2 (Taihekenga Huka / Glacial Kahurangi) — TUTORIAL SCRIPT
// See levels/tutorial_01_kahurangi.js for the tip-format authoring guide.
// NOTE: tip conditions may reference level helpers (gkCount, GK_EMEID, ...)
// defined in the level file — resolved at call time, so load order is free.
// ============================================================================
(function () {

const TIPS = {
  // ---------- SPRING: intro chain (fires at game start) ----------
  gk_spring_1: {
    id: 'gk_spring_1',
    trigger: { type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.GAME_START },
    title: "Brr... sure is cold out, eh?",
    content: [
      "That's because the 'season' of the earth has turned.", 
      "The temperature has dropped, and the snow has crept pretty far down the mountains!",
      "",
      "This makes that dark green beech and rimu forest a lot patchier."
    ],
    guidePosition: 'center', highlight: null,
    nextTip: 'gk_spring_speargrass', pauseGame: true, showOnce: true, priority: 0
  },
  gk_spring_speargrass: {
    id: 'gk_spring_speargrass',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Good news for your friend the Upland Moa!",
    content: [
      "There's a lot more subalpine habitat, and you've unlocked a favourite food: speargrass!",
      "",
      "Each moa has a favourite food, which can boost its population as well as guide them to new areas.",
      "",
      "You don't want to leave any species behind, or they'll disappear from these hills forever!"
    ],
    guidePosition: 'bottomLeft', highlight: { type: 'element', target: 'tool:speargrass' },
    nextTip: 'gk_spring_bushmoa', pauseGame: true, showOnce: true, priority: 0
  },
  gk_spring_bushmoa: {
    id: 'gk_spring_bushmoa',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Say hello to the new Moa!",
    content: [
      "I hereby promote your guardianship:","You now also protect the little bush moa!",
      "They inhabit dense forest and have a ","special beak for shearing tough plants,",
      "but because of this climate they're particularly vulnerable right now and need your attention."
    ],
    guidePosition: 'center', highlight: null, ringsAboveUI: true,
    nextTip: 'gk_spring_lancewood', pauseGame: true, showOnce: true, priority: 0
  },
  gk_spring_lancewood: {
    id: 'gk_spring_lancewood',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "How about some horoeka?",
    content: [
      "To help the bush moa out, try planting some of this ","scrub which only they will eat: lancewood.",
      "They might be little, but they have ","strong beaks and can chomp on lancewood when it's small and spiky!"
    ],
    guidePosition: 'bottomLeft', highlight: { type: 'element', target: 'tool:lancewood' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 0
  },

  // ---------- SPRING: after ~15s of play ----------
  gk_spring_corridor: {
    id: 'gk_spring_corridor',
    trigger: { type: TRIGGER_TYPE.TIME, delay: 900 },
    title: "Lead Them to Food",
    content: [
      "If their patch of forest is too small, you'll need to lead them somewhere new.","",
      "Place a line of lancewood to create a 'corridor' for the bush moa!"
    ],
    guidePosition: 'bottomLeft', highlight: { type: 'element', target: 'tool:lancewood' },
    nextTip: 'gk_spring_mauri', pauseGame: true, showOnce: true, priority: 2
  },
  gk_spring_mauri: {
    id: 'gk_spring_mauri',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Mauri & Competition",
    content: [
      "You'll get more Mauri for having more moa, but keep in mind that some species can out-compete others, which can lead to local extinctions."
    ],
    guidePosition: 'topLeft', highlight: { type: 'element', target: 'mauriDisplay' },
    nextTip: 'gk_spring_goals', pauseGame: true, showOnce: true, priority: 2
  },
  gk_spring_goals: {
    id: 'gk_spring_goals',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Your Goals",
    content: [
      "You need to grow the populations of both vulnerable moa to get full marks for this level!","",
      "Total moa count isn't our focus here — but if you grow all populations in balance, the Mauri will come pouring in!"
    ],
    guidePosition: 'left', highlight: { type: 'element', target: 'goalsPanel' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  // ---------- SPRING: nudge if the founders are lagging ----------
  gk_spring_nest: {
    id: 'gk_spring_nest',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (g) => g.seasonManager && g.seasonManager.currentKey === 'spring' &&
                        g.playTime > 1800 && g.mauri.mauri >= 60 && gkGrowthUnmet(g.simulation),
      cooldown: 3600
    },
    title: "Nesting Sites",
    content: [
      "When you've found a safe location, nesting sites will boost population growth, just like before.","",
      "Remember: moa need to be well-fed and unthreatened by patrolling eagles to reproduce!"
    ],
    guidePosition: 'left', highlight: { type: 'element', target: 'tool:nest' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  // ---------- Fires when any moa species first reaches 10 ----------
  gk_species_thriving: {
    id: 'gk_species_thriving',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (game) => {
        const moas = game.simulation && game.simulation.moas;
        if (!moas) return false;
        const counts = {};
        for (let i = 0; i < moas.length; i++) {
          const m = moas[i];
          if (!m.alive) continue;
          const k = m.speciesKey || 'unknown';
          counts[k] = (counts[k] || 0) + 1;
          if (counts[k] >= 10) return true;
        }
        return false;
      }
    },
    title: "Your Moa are doing well!",
    content: [
      "Click a species name to toggle their highlight on screen.",
      "",
      "Keep watching over Bush Moa and Upland Moa."
    ],
    guidePosition: 'left', highlight: { type: 'element', target: 'populationPanel' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 2
  },

  // ---------- AUTUMN ----------
  gk_autumn_1: {
    id: 'gk_autumn_1',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.SEASON_CHANGE,
      condition: (g, d) => d.seasonKey === 'autumn'
    },
    title: "Feel that chilly gust just now?",
    content: [
      "You'll need to prepare your moa for winter.",
      "It's not enough to just plant some ferns downhill this time; try to guide all the moa to something suitable.","",
      "It's alright if you lose some moa in the winter. There's less to eat, so a rise and fall in numbers is natural.","","Think about the right food to place so each species can bounce back when it gets warmer!"
    ],
    guidePosition: 'topRight', highlight: { type: 'element', target: 'seasonDisplay' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  },
  gk_autumn_storm: {
    id: 'gk_autumn_storm',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (g) => g.seasonManager && g.seasonManager.currentKey === 'autumn' &&
                        g.seasonManager.timer > 900 &&
                        gkEagleHuntingFocal(g.simulation) && gkCanAffordStorm(g),
      cooldown: 1200
    },
    title: "Bamboozle an eagle!",
    content: [
      "Here's a secret weapon: our good friend Tāwhirimātea!",
      "Call on a mighty thunderstorm to distract the hunting Pouākai!"
    ],
    guidePosition: 'bottomRight', highlight: { type: 'element', target: 'tool:Storm' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 1, urgency: 'high'
  },

  // ---------- WINTER ----------
  gk_winter_1: {
    id: 'gk_winter_1',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.SEASON_CHANGE,
      condition: (g, d) => d.seasonKey === 'winter'
    },
    title: "The Big Chill",
    content: [
      "The big chill is here, and it looks like it's a doozy.",
      "Now is the time to use your Mauri to safeguard as many moa as possible!"
    ],
    guidePosition: 'center', highlight: null,
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  },
  gk_winter_storm: {
    id: 'gk_winter_storm',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (g) => g.seasonManager && g.seasonManager.currentKey === 'winter' &&
                        gkEagleHuntingScarceFocal(g.simulation) && gkCanAffordStorm(g),
      cooldown: 1200
    },
    title: "Call the Storm",
    content: [
      "Your last line of defence is our good friend Tāwhirimātea.",
      "Call on a mighty thunderstorm to distract hunting Pouākai!"
    ],
    guidePosition: 'bottomRight', highlight: { type: 'element', target: 'tool:Storm' },
    nextTip: null, pauseGame: true, showOnce: true, priority: 1, urgency: 'high'
  },

  // ---------- SPRING (second year) ----------
  gk_spring2: {
    id: 'gk_spring2',
    trigger: {
      type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.SEASON_CHANGE,
      condition: (g, d) => d.seasonKey === 'spring'
    },
    title: "You Made It!",
    content: [
      "Phew! Good stuff. That's the worst of it, and now you only have the giant, killer eagles to worry about.","",
      "Maybe this will be a bumper year for your moa community!","",
      "Just remember: with more creatures comes more trouble to manage… but you've proven yourself a very capable kaitiaki so far!"
    ],
    guidePosition: 'center', highlight: null,
    nextTip: null, pauseGame: true, showOnce: true, priority: 1
  }
};

TUTORIAL_REGISTRY.register('glacial_kahurangi', TIPS);
})();
