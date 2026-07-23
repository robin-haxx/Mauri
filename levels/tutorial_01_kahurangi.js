// ============================================================================
// LEVEL 1 (Kahurangi) — TUTORIAL SCRIPT
// Registered with TUTORIAL_REGISTRY under the level id, keeping the engine
// (mauri_tutorial.js) content-free. Also registered as 'default': any level
// without its own script falls back to this one.
//
// AUTHORING GUIDE — each tip supports:
//   trigger: { type: TRIGGER_TYPE.EVENT | TIME | CONDITION | IMMEDIATE,
//              event: TUTORIAL_EVENTS.*          (EVENT tips),
//              delay: frames                     (TIME tips, from level start),
//              condition: (game, data) => bool   (CONDITION tips / EVENT gate),
//              minGameTime: frames, cooldown: frames }
//   title, content: ["short line", ...]  (lines don't reflow — keep them short)
//   guidePosition: center|left|right|top|bottom|topLeft|topRight|bottomLeft|bottomRight
//   highlight / highlightAlt: { type: 'element', target: <TutorialUIMapper target> }
//   guidedPlaceable: '<type>'  — a "place this" beat: placing anything else
//                                WHILE the tip is up fires off_script_placement
//   onShow: (game, data) => {} — side effects when the tip appears
//   nextTip: '<id>'            — chain; the next tip must be TRIGGER_TYPE.IMMEDIATE
//   pauseGame, showOnce, priority (lower first), urgency: 'high' (skips spacing)
// Shared helpers: tutorialGuidedWindowActive(game)
// ============================================================================
(function () {

const TIPS = {
  // ===== INTRODUCTION SEQUENCE =====
  welcome: {
    id: 'welcome',
    trigger: { type: TRIGGER_TYPE.EVENT, event: TUTORIAL_EVENTS.GAME_START },
    title: "Kia ora! And welcome to the glacial Alps.",
    content: [
      "I'm Te Whē, the mantis, and I will be your guide!",
      "Your role in Avian Age is to become a responsible kaitiaki of our ancient land."
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: 'goal_intro',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  goal_intro: {
    id: 'goal_intro',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "The Upland Moa need your help!",
    content: [
      "They've walked these hills millions of years,",
      "And this hardy 'clade' adapted well to Kahurangi.",
      "But, now the glaciations are getting more severe.", 
      "If we don’t step in to defend them, they'll be lost... ",
      "to hunger, or over-hunting by the mighty Pouakai!",
      
    ],
    guidePosition: 'center',
    highlight: null,
    // Instead of boxing the whole play area, light up the birds themselves:
    // the upland moa species highlight comes on while this tip is up (their
    // sprites re-drawn above the dim overlay) and goes off when it's done.
    onShow: (game) => {
      if (typeof SPECIES_HIGHLIGHT !== 'undefined') SPECIES_HIGHLIGHT.add('upland_moa');
    },
    onDismiss: (game) => {
      if (typeof SPECIES_HIGHLIGHT !== 'undefined') SPECIES_HIGHLIGHT.delete('upland_moa');
    },
    speciesHighlightAboveUI: true,
    nextTip: 'ui_mauri',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  // ui_topbar: {
  //   id: 'ui_topbar',
  //   trigger: { type: TRIGGER_TYPE.IMMEDIATE },
  //   title: "The Top Bar",
  //   content: [
      
  //     "the season, and the time taken to reach your goals.",
  //     "Mauri is gained when you help the ecosystem thrive!"
  //   ],
  //   guidePosition: 'topLeft',
  //   highlight: { type: 'element', target: 'topBarContent' },
  //   nextTip: 'ui_mauri',
  //   pauseGame: true,
  //   showOnce: true,
  //   priority: 0
  // },
  
  ui_mauri: {
    id: 'ui_mauri',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "The Mauri level of the forest",
    content: [
      "Mauri is the spiritual energy of this ngahere.",
      "Don't be afraid to use the Mauri that is earned;",
      "It will let you create a more bountiful forest.",
    ],
    guidePosition: 'topLeft',
    highlight: { type: 'element', target: 'mauriDisplay' },
    nextTip: 'ui_sidebar',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  ui_sidebar: {
    id: 'ui_sidebar',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Goals & Information",
    content: [
      "The sidebar shows your goals and ecosystem status.",
      "Your deadline is the 4 minute mark --",
      "Pause & check occasionally to make sure you're on track to the goals!"
    ],
    guidePosition: 'left',
    highlight: { type: 'element', target: 'goalsPanel' },
    nextTip: 'ui_toolbar',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  ui_toolbar: {
    id: 'ui_toolbar',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "You have a toolbox for shaping the ecosystem!",
    content: [
      "Mauri can transform into plants, clearings and storms.",
      "Select a tool, then a spot in the world to place it.",
      "(On keyboard, you can press 1-6 for quick selection,",
      "And hold shift if you want to place more than one.)"
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'toolbar' },
    nextTip: 'ui_fullscreen',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },

  ui_fullscreen: {
    id: 'ui_fullscreen',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Going Full-Screen!",
    content: [
      "For a focused view, you can enter full-screen mode.",
      "Try it now by pressing this button or the F key!"
    ],
    guidePosition: 'topRight',
    highlight: { type: 'element', target: 'fullscreenButton' },
    nextTip: 'intro_complete',
    pauseGame: true,
    showOnce: true,
    priority: 0
  },

  intro_complete: {
    id: 'intro_complete',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "That's all the basics!",
    content: [
      "Observe the forest for a moment;",
      "an opportunity might arise to help the Upland Moa!",
      "I'll be back to help when that happens.",
      "Good luck, budding eco-guardian!"
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 0
  },
  
  // ===== EVENT-TRIGGERED TIPS =====
  eagle_hunting: {
    id: 'eagle_hunting',
    trigger: {
      type: TRIGGER_TYPE.EVENT,
      event: TUTORIAL_EVENTS.EAGLE_HUNTING,
      minGameTime: 180,
      // The storm lesson only runs when the player can actually afford one.
      // If they're broke, eagle_hunting_no_mauri takes this beat instead —
      // and since a skipped trigger isn't "shown", this tip stays available
      // for a later hunt when the Mauri is there.
      condition: (game) => {
        const def = game.activePlaceables && game.activePlaceables.Storm;
        return game.mauri.canAfford(def ? def.cost : 40);
      }
    },
    title: "Haast's Eagle Attack!",
    content: [
      "Now's your time: The Pouākai is hunting a moa!",
      "Select the Storm [🌩️] to call on the atua for a distraction!"
    ],
    // Arm the grace window on every bird already mid-hunt, so the player has
    // ~8 seconds of unpaused play to respond before a strike can land.
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
    highlight: { type: 'element', target: 'StormButton' },
    guidedPlaceable: 'Storm',
    nextTip: 'storm_place',
    pauseGame: true,
    showOnce: true,
    priority: 1,
    urgency: 'high'
  },

  // Step two of the emergency: where to drop the storm. Chained from
  // eagle_hunting, so the game stays paused between the two.
  storm_place: {
    id: 'storm_place',
    trigger: { type: TRIGGER_TYPE.IMMEDIATE },
    title: "Drop It on the Eagle!",
    content: [
      "Now, while time is paused, click on the hunting eagle.",
      "You'll have to think fast to prevent the strike of a hungry Pouakai!",

    ],
    // Timestamp for the follow-up shelter tip ("a few seconds later").
    // playTime is frozen while paused, so this equals the dismissal time.
    onShow: (game) => {
      if (game.tutorial) game.tutorial.scratch.eagleTipsAt = game.playTime;
    },
    guidePosition: 'bottomRight',
    highlight: null,
    // Re-draw the hunting eagle above the dark overlay, flashing white,
    // so "click on the hunting eagle" points at an unmissable bird.
    spotlightHuntingEagle: true,
    guidedPlaceable: 'Storm',
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 1,
    urgency: 'high'
  },

  // Alternate first-attack beat: the Pouākai hunts but the player can't
  // afford a storm. Shown at most once, and only while the storm lesson
  // hasn't run yet (eagle_hunting skips when broke and stays unburned for a
  // later, affordable hunt). No grace window — the chase plays out for real.
  eagle_hunting_no_mauri: {
    id: 'eagle_hunting_no_mauri',
    trigger: {
      type: TRIGGER_TYPE.EVENT,
      event: TUTORIAL_EVENTS.EAGLE_HUNTING,
      minGameTime: 180,
      condition: (game) => {
        const def = game.activePlaceables && game.activePlaceables.Storm;
        if (game.mauri.canAfford(def ? def.cost : 40)) return false;
        return !game.tutorial.shownTips.has('eagle_hunting');
      }
    },
    title: "The Pouākai is on the hunt!",
    content: [
      "You used your Mauri already, so we'll unfortunately",
      "have to watch this chase play out uninterrupted...",
      "Try to keep enough Mauri for an emergency Storm [🌩️] in case you need to save a Moa!"
    ],
    guidePosition: 'bottomRight',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 1,
    urgency: 'high'
  },

  // The calmer follow-up beat: once the emergency has played out, teach the
  // preventive tool. Fires ~8s of unpaused play after the storm tips.
  shelter_secure: {
    id: 'shelter_secure',
    trigger: {
      type: TRIGGER_TYPE.CONDITION,
      condition: (game) => {
        const t = game.tutorial;
        return t && t.scratch && t.scratch.eagleTipsAt != null &&
               game.playTime > t.scratch.eagleTipsAt + 480;
      }
    },
    title: "A passing storm won't protect the moa forever!",
    content: [
      "You have six ways to return mauri to the forest.",
      "The Fern Shelter [🌴] grows a patch of Mamaku:",
      "a hardy tree fern that grows up to 20 metres tall!",
      "Moa under its fronds are hidden from the Pouākai,",
      "free to feed and breed in safety."
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'shelterButton' },
    guidedPlaceable: 'shelter',
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },

  // Player takes initiative: first placement made WITHOUT a "place this"
  // dialog asking for it. Praises them and teaches the move mechanic.
  first_free_placement: {
    id: 'first_free_placement',
    trigger: {
      type: TRIGGER_TYPE.EVENT,
      event: TUTORIAL_EVENTS.PLACEMENT,
      // Storms don't count: they're transient, and the move mechanic this
      // tip teaches doesn't apply to them.
      condition: (game, data) =>
        !tutorialGuidedWindowActive(game) && !(data && data.type === 'Storm')
    },
    title: "Giving back the forest's excess Mauri to Tāne!",
    content: [
      "That's the sort of natural initiative I like to see!",
      "If you want to move something you placed,",
      "touch and hold it for a second.",
      "It'll cost you half of its Mauri price."
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },

  // Player goes off-script: a "place this" dialog asked for one thing and
  // they placed another. Encourage it — and remind them tips are optional.
  off_script_placement: {
    id: 'off_script_placement',
    trigger: {
      type: TRIGGER_TYPE.EVENT,
      event: TUTORIAL_EVENTS.PLACEMENT,
      condition: (game, data) => {
        const g = game.tutorial && game.tutorial.scratch.guidedPlaceable;
        return !!(g && game.playTime <= g.until &&
                  data && data.type && data.type !== g.type);
      }
    },
    title: "Doing things your own way, eh?",
    content: [
      
      "I trust your instincts, kaitiaki!",
      "You can press T to disable or enable my guidance."
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },
  
  first_moa_death: {
    id: 'first_moa_death',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.MOA_KILLED 
    },
    title: "A Moa Has Fallen",
    content: [
      "The eagle caught a moa... but don't lose hope!",
      "Place Kawakawa [🌿] to help moa feed and breed.",
      "When moa are food-secure and not threatened, they can reproduce."
    ],
    guidePosition: 'center',
    highlight: { type: 'element', target: 'kawakawaButton' },
    guidedPlaceable: 'kawakawa',
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },
  
  // season_change_first: {
  //   id: 'season_change_first',
  //   trigger: {
  //     type: TRIGGER_TYPE.EVENT,
  //     event: TUTORIAL_EVENTS.SEASON_CHANGE,
  //     // Hold this tip until autumn itself arrives — its Pātōtara fruiting
  //     // line only makes sense then. (Level 1 starts in spring, so the
  //     // spring→summer turn passes silently.)
  //     condition: (game, data) => !!(data && data.seasonKey === 'autumn')
  //   },
  //   title: "The Seasons Turn",
  //   content: [
  //     "The mosaic of native plants shifts with the seasons.",
  //     "Upland Moa love alpine shrubs like the Pātōtara.",
  //     "It fruits around Autumn, before the alps get too cold!"
  //   ],
  //   guidePosition: 'topRight',
  //   highlight: { type: 'element', target: 'seasonDisplay' },
  //   nextTip: null,
  //   pauseGame: true,
  //   showOnce: true,
  //   priority: 3
  // },
  
  new_eagle_spawned: {
    id: 'new_eagle_spawned',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.EAGLE_SPAWNED 
    },
    title: "A New Predator Arrives",
    content: [
      "The Moa population is starting to thrive! But be wary..",
      "Haast's Eagle evolved gigantism with Moa, to eat 'em!",
      "Knowing these sorts of relationships between flora and fauna is what makes a true eco-steward."
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },
  
  first_egg: {
    id: 'first_egg',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.FIRST_EGG 
    },
    title: "An Egg!",
    content: [
      "A moa has laid an egg! Keep it safe.",
      "Nesting Sites [🪺] speed up incubation",
      "and provide extra protection."
    ],
    guidePosition: 'left',
    highlight: { type: 'element', target: 'nestButton' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },
  
  egg_hatched: {
    id: 'egg_hatched',
    trigger: { 
      type: TRIGGER_TYPE.EVENT, 
      event: TUTORIAL_EVENTS.EGG_HATCHED 
    },
    title: "A new upland moa in the flock!",
    content: [
      "A baby moa has hatched, and wants something to eat.",
      "Try making a safe patch of forest, and be wary:",
      "A growing community of moa also means a growing community of Eagles!"
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 3
  },
  
  // ===== CONDITION-BASED TIPS =====
  low_mauri_warning: {
    id: 'low_mauri_warning',
    trigger: { 
      type: TRIGGER_TYPE.CONDITION, 
      condition: (game) => game.mauri.mauri < 12 && game.playTime > 900,
      cooldown: 1800
    },
    title: "Mauri Running Low",
    content: [
      "Your Mauri is getting low!",
      "Complete goals for a boost."
    ],
    guidePosition: 'topLeft',
    highlight: { type: 'element', target: 'mauriDisplay' },
    nextTip: null,
    pauseGame: true,
    showOnce: false,
    priority: 2
  },
  
  // Fires the first time ANY moa species reaches 10 — points at the population
  // panel and teaches the click-to-highlight feature.
  species_thriving: {
    id: 'species_thriving',
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
      "Click a species name to toggle their highlight on screen."
    ],
    guidePosition: 'left',
    highlight: { type: 'element', target: 'populationPanel' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 2
  },

  hungry_population: {
    id: 'hungry_population',
    trigger: { 
      type: TRIGGER_TYPE.CONDITION, 
      condition: (game) => {
        const moas = game.simulation?.moas || [];
        const alive = moas.filter(m => m.alive);
        if (alive.length < 3) return false;
        const avgHunger = alive.reduce((s, m) => s + m.hunger, 0) / alive.length;
        return avgHunger > 65 && game.playTime > 600;
      },
      cooldown: 1200
    },
    title: "Moa Are Hungry!",
    content: [
      "Your moa are getting very hungry!",
      "Place Kawakawa (🌿) or Harakeke (🌾)",
      "to give them food quickly."
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'kawakawaButton' },
    guidedPlaceable: 'kawakawa',
    nextTip: null,
    pauseGame: true,
    showOnce: false,
    priority: 1
  },
  
  // ===== TIMED TIPS =====
  migration_reminder: {
    id: 'migration_reminder',
    trigger: { type: TRIGGER_TYPE.TIME, delay: 5100 },
    title: "Migration Patterns",
    content: [
      "Upland moa can feed in cold regions during summer,",
      "and migrate as the mosaic shifts with the seasons.",
      "There is plenty of juicy patotara uphill for now...",
      "But it will become scarce when winter arrives!"
    ],
    guidePosition: 'bottomLeft',
    highlight: { type: 'element', target: 'migrationHint' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 4
  },
  
  waterhole_tip: {
    id: 'waterhole_tip',
    trigger: { type: TRIGGER_TYPE.TIME, delay: 7600 },
    title: "Waterholes",
    content: [
      "Waterholes [💧] slow down hunger",
      "and attract moa to rest.",
      "Great for keeping moa in safe areas!"
    ],
    guidePosition: 'bottom',
    highlight: { type: 'element', target: 'waterholeButton' },
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 4
  },
  
  kaitiaki_progress: {
    id: 'kaitiaki_progress',
    trigger: { 
      type: TRIGGER_TYPE.CONDITION, 
      condition: (game) => game._cachedMoaCount >= 20 && game.simulation?.stats.births >= 5
    },
    title: "You're doing wonderfully!",
    content: [
      "The Upland Moa are thriving under your care.",
      "From now on, Mauri will grow when Eagles hunt,",
      "Since these two species need to stay in balance."
    ],
    guidePosition: 'center',
    highlight: null,
    nextTip: null,
    pauseGame: true,
    showOnce: true,
    priority: 4
  }
};

TUTORIAL_REGISTRY.register('kahurangi', TIPS);
// Shared fallback for levels that don't register a script of their own:
TUTORIAL_REGISTRY.register('default', TIPS);
})();
