// ============================================================================
// MODULE TIP KIT: the pieces every module's tutorial script is built from
// ============================================================================
// A module's story (ModuleDirector in mauri_module.js) fires TUTORIAL_EVENTS.MODULE_BEAT with
// data.beat set to a story moment. Its script (levels/tutorial_module_*.js) turns moments into:
//
//   scenes   dialogue: each line a tip titled with the speaker's name and drawn with their
//            sprite, opening on their own call, the speaker lit up through the dimmed screen,
//            the panel on the far side of the screen from them. A scene is a chain of lines.
//   banners  "do this" prompts: big words across the map, no panel, with what they're about
//            lit up. A banner goes by itself once the player has done what it asks
//            (tip.dismissWhen), and its words change while the thing is in hand.
//
// See levels/tutorial_01_kahurangi.js for every field a tip can use.
// ============================================================================
const MODULE_TIP_KIT = (function () {

  // A tip that shows on one story moment (or any of several). test(data, game) can narrow it.
  const onBeat = (beat, test = null) => ({
    type: TRIGGER_TYPE.EVENT,
    event: TUTORIAL_EVENTS.MODULE_BEAT,
    condition: (game, data) => !!(data && [].concat(beat).includes(data.beat) && (!test || test(data, game)))
  });

  // Light up these entities through the overlay: fn(director) => [entities].
  const spot = (fn, method) => (game) => {
    const d = game.module;
    if (d) game.renderEntitiesAboveUI(fn(d), method);
  };

  const placed = (game, type) => game.simulation.placeables.filter(p => p.alive && p.type === type);
  const storms = (game) => placed(game, 'Storm');
  const family = (game) => game.module ? game.module._living() : [];
  const stormsMoved = (game) => game.simulation.stats.stormsMoved || 0;
  // A pulsing ring on the ground at a world point (where the family is headed).
  const marker = (game, p) => p && game.renderSpotlightAboveUI({ species: [], at: p });

  // Draw fn() in the world view (the world's clip and camera), over whatever is on screen.
  const inWorld = (game, fn) => {
    const clip = game._worldClip();
    push();
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.rect(clip.x, clip.y, clip.w, clip.h);
    drawingContext.clip();
    translate(CONFIG.viewX, CONFIG.viewY);
    scale(CONFIG.viewZoom);
    fn(1 / CONFIG.viewZoom);   // (one screen pixel, in world units)
    drawingContext.restore();
    pop();
  };

  // A way to go (a list of world points, e.g. the trail down to the tarn) lit up: a soft glow
  // with bright dashes flowing along it from its first point to its last.
  const trail = (game, pts) => {
    if (!pts || pts.length < 2) return;
    inWorld(game, (px) => {
      const line = () => {
        beginShape();
        for (const p of pts) vertex(p.x, game._groundPaintY(p.x, p.y));
        endShape();
      };
      noFill();
      strokeJoin(ROUND);
      strokeCap(ROUND);
      stroke(255, 236, 150, 60);
      strokeWeight(22 * px);
      line();
      stroke(255, 236, 150, 110);
      strokeWeight(10 * px);
      line();
      stroke(255, 250, 215, 240);
      strokeWeight(4 * px);
      drawingContext.setLineDash([16 * px, 14 * px]);
      drawingContext.lineDashOffset = -(frameCount * 0.9 % 30) * px;
      line();
      drawingContext.setLineDash([]);
    });
  };

  // Pulsing rings at the feet of these birds, drawn straight over the game (for a banner that
  // leaves the screen undimmed), and the birds drawn again inside them so they stand out.
  const rings = (game, list, col = [255, 205, 90]) => {
    const birds = (list || []).filter(e => e && e.alive !== false);
    if (!birds.length) return;
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12);
    inWorld(game, (px) => {
      noFill();
      for (const m of birds) {
        const d = (m.size || 10) * 3 * (1 + 0.12 * pulse);
        push();
        translate(m.pos.x, game._groundPaintY(m.pos.x, m.pos.y));
        stroke(col[0], col[1], col[2], 120 + 120 * pulse);
        strokeWeight(3 * px);
        ellipse(0, 0, d, d * 0.62);
        pop();
      }
    });
    game.renderEntitiesAboveUI(birds);
  };

  // The family members the eagle can see right now (in the attack under way), else [].
  const exposed = (game) => {
    const d = game.module, c = d && d.chase;
    return c ? c.targets.filter(m => m.alive && !d.isHidden(m)) : [];
  };

  // Where a speaker's panel goes: on the far side of the screen from them, so the panel (and
  // its sprite) never covers the bird that is talking. who(director) can also give a list of
  // birds and world points (e.g. the speaker and the way they're talking about): the panel
  // takes the corner furthest from all of them. Held still while the camera moves, so it
  // doesn't hop sides mid-zoom.
  const awayFrom = (who) => {
    let last = null;
    return (game) => {
      if (last && game.camera && game.camera.tween) return last;
      const list = game.module ? [].concat(who(game.module) || []).filter(Boolean) : [];
      if (!list.length) return 'bottom';
      const clip = game.tutorial.playArea();
      const pts = list.map((e) => {
        const p = e.pos || e;
        return { x: CONFIG.viewX + p.x * CONFIG.viewZoom,
                 y: CONFIG.viewY + game._groundPaintY(p.x, p.y) * CONFIG.viewZoom };
      });
      const spots = CONFIG.portrait
        ? [{ fx: 0.5, fy: 0.3 }, { fx: 0.5, fy: 0.8 }]
        : [{ fx: 0.4, fy: 0.3 }, { fx: 0.66, fy: 0.3 }, { fx: 0.4, fy: 0.75 }, { fx: 0.66, fy: 0.75 }];
      let best = spots[0], bestD = -1;
      for (const s of spots) {
        const cx = clip.x + clip.w * s.fx, cy = clip.y + clip.h * s.fy;
        let near = Infinity;
        // (A panel is wide and short, so being clear above or below counts for more.)
        for (const p of pts) near = Math.min(near, Math.hypot((p.x - cx) * 0.6, p.y - cy));
        if (near > bestD) { bestD = near; best = s; }
      }
      last = best;
      return last;
    };
  };

  // A scene maker for a cast: { key: { title, sprite, who(director) => entity, scale?, sound?,
  // pitch?, where? } }. sound is the speaker's own sound as each line opens ('moa', 'chick',
  // 'eagle', 'kea'; see AudioManager.playSpeaker; none = the guide's chime), pitch shifts it,
  // and where fixes the panel's place (a guidePosition) for a speaker with no bird to stand
  // clear of. scene(id, trigger, lines, then): lines spoken one after another, each a tip
  // chained to the next. The first line shows on `trigger`; the rest follow as the player
  // clicks on. Each line is [speaker, text, extras], where extras override any tip field (a
  // different spotlight, a title...), and extras.wait (seconds) lets the game play on that
  // long before the line (the line before it closes the conversation for now). `then` names
  // a tip to chain to after the last line.
  function sceneWith(CAST) {
    return function scene(id, trigger, lines, then = null) {
      const out = {};
      const tipIdAt = (i) => i === 0 ? id : `${id}_${i + 1}`;
      lines.forEach(([who, text, extra], i) => {
        const c = CAST[who];
        const tipId = tipIdAt(i);
        const last = i === lines.length - 1;
        const next = lines[i + 1], nextWaits = !!(next && next[2] && next[2].wait);
        const wait = i > 0 && extra && extra.wait;
        out[tipId] = Object.assign({
          id: tipId,
          trigger: !wait ? (i === 0 ? trigger : { type: TRIGGER_TYPE.IMMEDIATE })
            : {   // `wait` seconds of play after the line before it closed
                type: TRIGGER_TYPE.CONDITION,
                condition: (game) => {
                  const at = game.tutorial.scratch[`${tipId}_wait`];
                  return at != null && game.tutorial.liveTime - at >= wait * 60;
                }
              },
          title: c.title,
          content: [text],
          guideSprite: c.sprite,
          guideScale: c.scale || 1,
          guidePosition: c.where || awayFrom(c.who),
          speaker: c.sound || null,
          speakerPitch: c.pitch || 1,
          highlight: null,
          renderAboveOverlay: c.who ? spot((d) => [c.who(d)]) : null,
          pauseGame: true,
          showOnce: true,
          priority: 1,
          urgency: 'high',   // story lines never sit out the gap between tips
          nextTip: nextWaits ? null : (last ? then : `${id}_${i + 2}`),
          buttonLabel: ((last && !then) || nextWaits) ? "Continue" : "Next →"
        }, extra || {});
        delete out[tipId].wait;
        // The line before a waiting one notes when it closed (in live play), for the wait.
        if (nextWaits) {
          const own = out[tipId].onDismiss, key = `${tipIdAt(i + 1)}_wait`;
          out[tipId].onDismiss = (game) => {
            game.tutorial.scratch[key] = game.tutorial.liveTime;
            if (own) own(game);
          };
        }
      });
      return out;
    };
  }

  // A placeable's definition (the level's palette entry, else the base PLACEABLES one).
  const toolDef = (game, type) =>
    (game.activePlaceables && game.activePlaceables[type]) || (typeof PLACEABLES !== 'undefined' && PLACEABLES[type]) || {};

  // Whether the player can't pay to move a `type` (needs 'move'), or to call a new one
  // (needs 'place'), so a banner asking for that must not wait. (needs 'none': a banner that
  // asks for nothing the player has to pay for.)
  const broke = (game, needs, type) => {
    if (needs === 'none') return false;
    const def = toolDef(game, type);
    const cost = needs === 'place' ? def.cost : (def.moveCost != null ? def.moveCost : Math.ceil((def.cost || 0) / 2));
    return !game.mauri.canAfford(cost || 0);
  };

  // A banner: big words across the map. `words` is [idle, inHand]: the second shows while
  // the banner's thing is in hand: extra.tool (default 'Storm') picked up to move, or its
  // toolbar button selected. The game waits (paused, dimmed) until `done(game)` holds, with
  // `lit(game)` drawn through the dimming. extra.needs ('move' or 'place') says what the
  // player has to afford. Extras override any tip field.
  function banner(id, trigger, words, done, lit, extra = {}) {
    const tool = extra.tool || 'Storm';
    const inHand = (game) => (game.movingPlaceable && game.movingPlaceable.type === tool) ||
                             game.selectedPlaceable === tool;
    return Object.assign({
      id, trigger,
      // (words can also be (game) => [idle, inHand], for words that follow the situation)
      banner: (game) => {
        const w = typeof words === 'function' ? words(game) : words;
        return inHand(game) ? w[1] : w[0];
      },
      dismissWhen: (game) => game.state === GAME_STATE.WON || game.state === GAME_STATE.LOST ||
        (!game.movingPlaceable && (done(game) || (!game.selectedPlaceable && broke(game, extra.needs, tool)))),
      renderAboveOverlay: lit,
      highlight: null,
      pauseGame: true,
      showOnce: true,
      priority: 1,
      urgency: 'high'
    }, extra);
  }

  // A banner that goes once a storm has been moved (set down somewhere new).
  function moveBanner(id, trigger, words, lit, extra = {}) {
    return banner(id, trigger, words,
      (game) => stormsMoved(game) > (game.tutorial.scratch[id] || 0), lit,
      Object.assign({ onShow: (game) => { game.tutorial.scratch[id] = stormsMoved(game); } }, extra));
  }

  // A banner that goes once `count` new ones of extra.tool (default 'Storm') have been
  // called from the toolbar; its button is highlighted. (Storms the weather brings, p.natural,
  // don't count.)
  function placeBanner(id, trigger, words, lit, count = 1, extra = {}) {
    const key = id + '_before', tool = extra.tool || 'Storm';
    return banner(id, trigger, words,
      (game) => placed(game, tool).filter(p => !p.natural && !game.tutorial.scratch[key].has(p)).length >= count, lit,
      Object.assign({
        needs: 'place',
        highlight: { type: 'element', target: tool === 'Storm' ? 'StormButton' : `tool:${tool}` },
        onShow: (game) => { game.tutorial.scratch[key] = new Set(placed(game, tool)); }
      }, extra));
  }

  // A banner that goes once item(game) (a placeable, moved by press and hold) sits within
  // `reach` (a number, or reach(game)) of target(game) (a world point).
  function reachBanner(id, trigger, words, item, target, reach, lit, extra = {}) {
    return banner(id, trigger, words,
      (game) => {
        const p = item(game), t = target(game);
        const r = typeof reach === 'function' ? reach(game) : reach;
        return !p || !t || Math.hypot(p.pos.x - t.x, p.pos.y - t.y) <= r;
      }, lit, Object.assign({ needs: 'move' }, extra));
  }

  // Extras for a banner where the player has to step in to stop the Pouākai: its screech as the
  // banner appears, and the Pouākai on the hunt drawn beside the words.
  const eagleAlert = { bannerSprite: 'haasts_eagle_hunt', call: 'haasts_eagle' };

  // The eagle prompts every module shares: their storm breaking up (call a new one), and
  // "cover them!" (paused the first time, then shown again while play goes on). With no storm
  // left to move (in winter they all fade), "cover them" asks for a new one instead.
  // With opts.teach false (a module after the storms have been learned), only the warning is
  // kept: no "call a new storm" prompt, and "cover them" shows while play goes on, every time.
  // All of them sound the alarm (eagleAlert).
  function eagleTips(opts = {}) {
    const coverWords = (game) => storms(game).length
      ? ["The Pouākai has seen them! Move a STORM over the family", "Cover the family with the STORM"]
      : ["The Pouākai has seen them! Tap the STORM button and call one over them", "Tap beside the family to call the STORM"];
    const coverDone = (game) => !game.module || !game.module.chase || exposed(game).length === 0 ||
      (!storms(game).length && !game.selectedPlaceable && broke(game, 'place', 'Storm'));
    if (opts.teach === false) {
      return {
        cover_again: banner('cover_again', onBeat(['last_chance', 'winter_pass', 'spotted_again']),
          ["The Pouākai has seen them!", "Cover the family with the STORM"], coverDone, null,
          Object.assign({ pauseGame: false, dim: false, showOnce: false }, eagleAlert))
      };
    }
    return {
      new_storm: placeBanner('new_storm', onBeat('new_storm'),
        ["Their STORM is breaking up! Tap the STORM button", "Now tap beside the family to call the STORM"],
        (game) => game.renderEntitiesAboveUI(family(game)), 1, eagleAlert),

      last_chance: banner('last_chance', onBeat(['last_chance', 'winter_pass']), coverWords, coverDone,
        (game) => game.renderEntitiesAboveUI([...storms(game), ...exposed(game)]),
        Object.assign({ spotlightHuntingEagle: true,
          highlight: (game) => storms(game).length ? null : { type: 'element', target: 'StormButton' } }, eagleAlert)),

      cover_again: banner('cover_again',
        onBeat(['last_chance', 'winter_pass', 'spotted_again'],
               (d, game) => game.tutorial.shownTips.has('last_chance')),
        coverWords, coverDone, null,
        Object.assign({ pauseGame: false, dim: false, showOnce: false }, eagleAlert))
    };
  }

  return { onBeat, spot, placed, storms, family, stormsMoved, marker, inWorld, trail, rings, exposed,
           awayFrom, sceneWith, banner, moveBanner, placeBanner, reachBanner, eagleAlert, eagleTips, broke };
})();
