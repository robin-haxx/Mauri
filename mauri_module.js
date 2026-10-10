// ============================================================================
// MODULE LEVELS
// ============================================================================
// Module levels follow a few birds closely through a year, one small lesson at a time. A
// module level is a normal level definition with a `story` block (see
// levels/module_00_storms.js). The story is run by three controllers that live only in this
// file, so nothing here changes how any other level plays:
//
//   ModuleDirector  Runs the level. Picks where the nest, food, water and storms go, moves the
//                   story on season by season, sets each season's goals, fires the prompts (as
//                   tutorial events, which the level's tutorial script turns into tips), and
//                   decides win or loss.
//   MoaLife         The brain of one moa in the family. A moa that has one (moa.lifeScript)
//                   skips the normal moa behaviour completely (see the top of Moa.behave).
//   EagleLife       The same for the eagle (eagle.lifeScript). It circles over the tops until
//                   the director sends it after the family.
//
// Module 0, the storm, season by season:
//   summer  The father stays by the nest and the egg. The mother forages at a pātōtara patch
//           out in the open. The eagle comes for her, and the player moves a storm over her:
//           a moa under a storm can't be seen. Once the eagle has flown off she carries food
//           home (pātōtara sprouts by the nest), and the egg hatches with the camera close in
//           on the nest; then the view pulls back out, the clouds down the mountain clear and
//           the eagle flies off.
//   autumn  The view pulls back, and a lighter worn trail on the ground shows the way down
//           to the wharariki and the tarn. A storm gathers down the trail, and from now on
//           new storms gather on the tops now and then (story.weather). The family walks
//           from storm to storm, so the player drags storms into a path. The eagle comes back
//           once the path is under way, and patrols round the family from then on. The season
//           clock stands still on the way. They set off hungry and feed on the plants along
//           the trail. The eagle attacks twice; the second time, the storm over the family
//           breaks up and the Storm tool unlocks so the player can call a new one. Birds
//           caught in the open run, and their safety bar drains.
//   winter  The family stays by the tarn. Storms fade away, so the player calls new ones
//           from the toolbar, while the eagle keeps coming back.
//   spring  The family walks back up to the nest; the Storm tool has no recharge, so the
//           player can call a path of storms. Once they reach it, have their last words
//           there and are all back at the nest, the level is won. "Continue" then walks them
//           north off the map and pans the camera to the next area.
// A storm the player calls joins the standing weather (it stays until winter wears it out).
// Moa only breed in spring and summer, at their nest (see ModuleDirector.canBreed).
// Whichever module comes first opens on black with Te Whē's welcome, and whichever comes last
// fades to black for its farewell (see _beginIntro, _beginFinale).
// ============================================================================

const MODULE_FPS = 60;   // frames per second, for turning story seconds into frames

// Tunables a level's `story` can override (nested blocks are merged key by key).
const MODULE_STORY_DEFAULTS = {
  eggHatchSec: 20,         // an egg hatches this many in-game seconds after it is laid
  eggLaidAgoSec: 1,        // the opening egg was laid this long before the level starts
  // The hatching itself: the camera closes in on the nest while the egg rocks and cracks for
  // `sec`. The chick is out for peepSec before its first words (the 'chick_peep' moment),
  // then the camera pulls back out (to zoom 1) zoomOutAfterSec after that.
  hatch: { delaySec: 0.6, sec: 3, zoom: 3.2, peepSec: 1, zoomOutAfterSec: 1 },
  stormRadius: 56,         // size of the standing storms
  stormCount: 6,           // standing storms at the start (one over the nest, the rest on the tops)
  tarnRadius: 18,          // the small lake the family winters by
  // The tarn's surroundings do what the old Waterhole tool did: slow hunger and top it up.
  water: { reach: 34, hungerSlowdown: 0.4, feedingRate: 0.02 },
  openingZoom: 1.35,       // how close the opening view is (1 = the whole map)
  fadeSec: 1.5,            // the first module fades in from black, the last fades out (see _beginIntro)
  holdSeasonAt: 0.8,       // a season waits here until its key moment has happened
  // Autumn's clock stands still while the family walks down; once they're at the tarn it
  // runs this many times faster until it reaches holdSeasonAt (then on as normal).
  autumnCatchUp: 6,
  // On the walk down the family is hungry (the berries are gone): it sets off this hungry,
  // and a family member this hungry hungrySec into the walk is "hungry" (they feed along the way).
  walkHunger: 62,
  hungryAt: 45,
  hungrySec: 2,
  mauriPerSec: 0.4,        // steady mauri income while the family is alive
  goalReward: 15,          // mauri for each goal (a goal may set its own `reward`)
  hungerScale: 0.7,        // how fast the family gets hungry (1 = normal moa)
  maxHunger: 92,           // the family never starves; the danger is the eagle
  journey: {
    talkDelaySec: 5,       // autumn: the story picks up this long in (after the season's sound)
    startDelaySec: 7,      // autumn: time to build a path before the family sets off (after that)
    springDelaySec: 4,     // spring: the same, for the walk home
    hopReach: 150,         // how far ahead the family will see a storm to walk to
    goalReach: 26,         // this close to the end of the walk counts as there
    restSec: 2,            // they pause this long under each storm on the way
    waitSec: 8,            // under a storm with none ahead, they wait this long before going on alone
    speed: 1.4,            // walking pace, as a multiple of the moa's normal speed
    // The leader waits for the column once its last walker is further back than the line would
    // naturally be (tailGap a walker, plus tailSlack) by tailFar, until it's back within that
    // (but no longer than tailWaitSec at a time).
    tailGap: 14, tailSlack: 15, tailFar: 35, tailWaitSec: 6,
    // Going on alone, down: Module 0's story sends them the wrong way first (to sites.decoy);
    // otherwise (false) they walk down the trail, as they walk up it in spring.
    wrongWay: false
  },
  eagle: {
    spotRange: 140,        // the eagle sees the family from this far
    holdRange: 220,        // the family stops walking when the eagle is this close
    graceSec: 8,           // "last chance": time between the eagle seeing a bird and diving
    winterGraceSec: 6,
    searchSec: 5,          // how long it circles a hidden family before giving up
    goneSec: 3.5,          // ...and how long after it turns away that it counts as gone
    // After the summer attack on the mother, timed only (not cut short by it reaching its
    // lookout), so its parting words come first, a few seconds of play after it gives up.
    motherGoneSec: 7,
    clearSec: 1.6,         // how long the storm over the family takes to break up (second attack)
    // Summer: the eagle starts the level this far from the mother, circling there, and comes for
    // her this long in, so a few seconds of play pass before it sees her (and has its say).
    summerThreatSec: 5.5,
    summerStartDist: 200,
    autumnChase1Sec: 8,    // autumn: first attack, this long into the walk
    autumnChase2Progress: 0.45,  // second attack once they are this far along...
    autumnChase2GapSec: 10,      // ...or this long after the first, whichever comes first
    winterFirstPassSec: 8, // winter: first visit, then one every winterPassEverySec
    winterPassEverySec: 10,
    // Winter, hungry: between attacks it stalks the family, circling close and quick over
    // them, and any bird out of cover within pounceRange of it is seen at once (no waiting for
    // the next pass), pounceGapSec after its last attack. A family hiding under a storm it
    // circles for searchSec before it gives up.
    winterStalk: { patrolRadius: 90, patrolTurn: 0.014, pounceRange: 120, pounceGapSec: 3, searchSec: 8 },
    springChaseSec: 10     // spring: one attack this long into the walk home
  },
  // After the egg hatches (Module 0): the eagle flies off the map until autumn's storm path is
  // under way, and every storm clears, the nest's too (autumn gathers one there again; see
  // _calmAfterHatch, _beginAutumn, _eagleReturns).
  calmAfterHatch: false,
  // The autumn storm down the trail starts as a wisp this share of its size, and swells to
  // full over swellSec when it's pointed out (swellAutumnStorm).
  autumnStormStart: 0.4,
  swellSec: 1.5,
  eagleBackReach: 230,     // the returning eagle has its say once this close to the family
  // Weather on the tops (Module 0): from the `from` season on, every everySec a new storm gathers
  // at one of the storm sites on the high ground (sites.storms; the first a few seconds in,
  // firstSec), while fewer than `max` sit up there. null: none (see _updateWeather).
  weather: null,           // e.g. { from: 'autumn', firstSec: 3, everySec: 15, max: 3 }
  winterStormLifeSec: 30,  // in winter every storm fades away over this long (a new one has to be called)
  homeWinSec: 0.5,         // the win comes this long after they're home (and their last words there)...
  homeReach: 22,           // ...once every one of them is this close to the nest...
  homeWaitSec: 20,         // ...or this long after, whatever (a bird stuck on the way)
  nextArea: null,          // [col, row] of the world-grid area "Continue" pans to
  outroDir: 'north',       // which way the family walks off the map: 'north' or 'south'
  lockedTools: {},         // tools greyed out until a story moment: { Storm: 'new_storm' }
  // The worn trail along the way down: how wide, how light, and in which seasons it shows.
  trail: { width: 13, endWidth: 28, amount: 0.85, seasons: ['autumn', 'spring'] },
  goals: {}                // per-season goal lists: { summer: [{ id, name, reward? }], ... }
};

// ============================================================================
// ModuleDirector
// ============================================================================
class ModuleDirector {
  constructor(game, levelDef) {
    this.game = game;
    this.level = levelDef;
    this.cfg = ModuleDirector._mergeStory(levelDef.story || {});

    this.sites = null;        // where things go, chosen from the bare land (planTerrain)
    this.stage = null;        // the season the story is in: 'summer' | 'autumn' | 'winter' | 'spring'
    this.stageTime = 0;       // frames since that season began
    this.beats = {};          // one-off story moments already reached this season

    this.family = [];         // every moa in the family (father, mother, then the chick)
    this.father = null;
    this.mother = null;
    this.chick = null;
    this.egg = null;
    this.eggAge = 0;          // frames since the egg was laid
    this.clutchThisYear = true;   // the opening egg is this year's clutch
    this.eagle = null;

    this.chase = null;        // the eagle attack in progress, if any (see _startChase)
    this.journey = null;      // the family's walk in progress, if any (see _startJourney)

    this.won = false;
    this.outro = null;        // the "Continue" walk-off and pan, once started
    this.outroDone = false;
    this.cycle = 0;           // the year shown on the season dial (year 1 for now)
    this._loseAt = null;      // a loss waits a moment so the player sees what happened
    this._failReason = '';
    this._incomeT = 0;

    // What the previous module's "Continue" carried over (Game.startModuleHandoff), when it
    // leads here: the land's seed and height fit, where the family walked off, and who they are.
    const h = game._moduleHandoff;
    this.handoff = (h && h.levelId === levelDef.id) ? h : null;
  }

  static _mergeStory(story) {
    const d = MODULE_STORY_DEFAULTS;
    return Object.assign({}, d, story, {
      weather: story.weather ? Object.assign({ from: 'autumn', firstSec: 3, everySec: 15, max: 3 }, story.weather) : null,
      water: Object.assign({}, d.water, story.water),
      hatch: Object.assign({}, d.hatch, story.hatch),
      journey: Object.assign({}, d.journey, story.journey),
      trail: Object.assign({}, d.trail, story.trail),
      eagle: Object.assign({}, d.eagle, story.eagle)
    });
  }

  _sec(s) { return s * MODULE_FPS; }

  // ==========================================================================
  // SITES: chosen once from the bare land, while the terrain is being generated
  // ==========================================================================

  // Called by the terrain (as its featurePlanner) after the window's heights are fitted and
  // before the height map is filled. Picks the nest, the pātōtara patch, the tarn, the way down
  // to it, the "wrong way" the family takes without storms, the storms and the eagle's lookout.
  // Returns the tarn and the trail for the terrain to carve and paint. All positions are
  // window coordinates. (A later module overrides this and builds from the same helpers.)
  planTerrain(t) {
    const P = this._planningGrid(t), cfg = this.cfg;
    const { W, H, N, elev, walk, centre, E, dist, inside, openness, toForest, toScree, topE } = P;

    // ---- The nest: near the mountain top, with room around it and bush not far off. ----
    let nest = null, best = -Infinity;
    for (let i = 0; i < N; i++) {
      const p = centre(i);
      if (!walk[i] || elev[i] < topE - 0.07 || !inside(p, 55)) continue;
      const score = elev[i] * 12 + openness(p, 30) * 3 +
        (toForest[i] < 150 ? 1.5 : 0) + (toScree[i] < 130 ? 1 : 0);
      if (score > best) { best = score; nest = p; }
    }
    if (!nest) nest = { x: W * 0.7, y: H * 0.4 };

    // ---- The tarn (low, open ground a good walk away, with a way down to it), and the wrong
    // way: downhill, but well away from the tarn. Without storms to follow, the family heads
    // there in autumn ("going downhill but not toward the wharariki"). ----
    const { tarn, shore, path } = this._findRefuge(P, nest);
    const decoy = this._findDecoy(P, nest, tarn);

    // ---- The pātōtara patch (the variable is still `grove`): open ground just outside the
    // nest's storm, where the mother forages in summer. It sits a little below the nest but
    // not far, so her hurry home is a gentle climb rather than a long, slow slog up a slope;
    // the nearer and the more level the better (the height rule loosens if nothing fits). ----
    const R = cfg.stormRadius;
    let grove = null; best = -Infinity;
    for (const drop of [0.04, 0.08, 1]) {
      for (let i = 0; i < N; i++) {
        const p = centre(i), d = dist(p, nest);
        if (!walk[i] || d < R + 30 || d > R + 60 || !inside(p, 40) ||
            elev[i] > E(nest) + 0.01 || elev[i] < E(nest) - drop) continue;
        const score = openness(p, 22) * 3 + toScree[i] * 0.002 + random(0.3) -
          (E(nest) - elev[i]) * 25 - (d - R - 30) * 0.02;
        if (score > best) { best = score; grove = p; }
      }
      if (grove) break;
    }
    if (!grove) grove = { x: nest.x - (R + 30), y: nest.y + 10 };

    // ---- Storms: one over the nest (the father and egg start hidden), the rest gathered on
    // the high ground above it: on the far side of the nest from the patch, and clear of the
    // stretch between them, so no cloud hides the mother or her way home at the start. (A
    // storm's clouds spread to about 1.3x its radius.) They also keep off the lower part of
    // the way down. ----
    const lowerPath = path.slice(Math.floor(path.length * 0.4));
    const storms = this._placeStorms(P, nest, [{ x: nest.x, y: nest.y }],
      (p) => ModuleDirector._segDist(p, nest, grove) >= R * 1.7 && dist(p, shore) >= 200 &&
             lowerPath.every(q => dist(q, p) >= R + 5),
      grove);

    const eyrie = this._findEyrie(P, nest);
    const exitPath = this._findExit(P, nest, cfg.outroDir);

    const smooth = this._smoothPath(path);
    this.sites = { nest, grove, tarn, shore, decoy, storms, eyrie, tarnR: cfg.tarnRadius,
                   path: smooth, pathUp: smooth.slice().reverse(), exitPath };
    return this._waterFeatures(t, tarn, smooth);
  }

  // A coarse planning grid of the window (height and walkability every few units), with the
  // helpers the site pickers share. Also kept as this._grid for _findPath.
  _planningGrid(t) {
    const W = t.viewW, H = t.viewH, ox = t._activeOriginX, oy = t._activeOriginY;
    const step = 6;
    const cols = Math.floor(W / step), rows = Math.floor(H / step), N = cols * rows;
    const elev = new Float32Array(N), walk = new Uint8Array(N), forest = new Uint8Array(N);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const e = t.getElevation((c + 0.5) * step + ox, (r + 0.5) * step + oy);
        const b = t.getBiomeFromElevation(e);
        elev[i] = e;
        walk[i] = b.walkable ? 1 : 0;
        forest[i] = (b.plantTypes && b.plantTypes.includes('beech')) ? 1 : 0;
      }
    }
    // Walkable cells next to un-walkable ground (scree, ice): the route keeps off these.
    const nearWall = new Uint8Array(N);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!walk[r * cols + c]) continue;
        for (let dr = -1; dr <= 1 && !nearWall[r * cols + c]; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || !walk[nr * cols + nc]) {
              nearWall[r * cols + c] = 1;
              break;
            }
          }
        }
      }
    }
    this._grid = { cols, rows, step, elev, walk, forest, nearWall, W, H };

    const cellAt = (x, y) => {
      const c = Math.max(0, Math.min(cols - 1, (x / step) | 0));
      const r = Math.max(0, Math.min(rows - 1, (y / step) | 0));
      return r * cols + c;
    };
    const centre = (i) => ({ x: ((i % cols) + 0.5) * step, y: (((i / cols) | 0) + 0.5) * step });
    const E = (p) => elev[cellAt(p.x, p.y)];
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const inside = (p, m) => p.x > m && p.y > m && p.x < W - m && p.y < H - m;
    // Share of walkable ground within `rad` of p.
    const openness = (p, rad) => {
      let n = 0, w = 0;
      for (let y = p.y - rad; y <= p.y + rad; y += step) {
        for (let x = p.x - rad; x <= p.x + rad; x += step) {
          if ((x - p.x) ** 2 + (y - p.y) ** 2 > rad * rad) continue;
          n++;
          if (x >= 0 && y >= 0 && x < W && y < H && walk[cellAt(x, y)]) w++;
        }
      }
      return n ? w / n : 0;
    };
    // Grid distance (in units) from every cell to the nearest cell where `isSource` holds.
    const distanceTo = (isSource) => {
      const d = new Float32Array(N).fill(Infinity), queue = [];
      for (let i = 0; i < N; i++) if (isSource(i)) { d[i] = 0; queue.push(i); }
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q], c = i % cols, r = (i / cols) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const j = nr * cols + nc;
          if (d[j] > d[i] + step) { d[j] = d[i] + step; queue.push(j); }
        }
      }
      return d;
    };
    const toForest = distanceTo(i => forest[i] && walk[i]);
    const toScree = distanceTo(i => !walk[i] && t.getBiomeFromElevation(elev[i]) !== t._waterBiome);

    // Highest and lowest walkable ground well inside the window.
    let topE = 0, lowE = 1;
    for (let i = 0; i < N; i++) {
      if (!walk[i] || !inside(centre(i), 50)) continue;
      if (elev[i] > topE) topE = elev[i];
      if (elev[i] < lowE) lowE = elev[i];
    }
    return { t, W, H, ox, oy, step, cols, rows, N, elev, walk, forest, nearWall,
             cellAt, centre, E, dist, inside, openness, distanceTo, toForest, toScree, topE, lowE };
  }

  // A tarn on low, open ground a good walk from `from`, with a walkable way down to it.
  // `ok(p)` can rule candidates out (e.g. too near another refuge). Returns { tarn, shore,
  // path }: the shore is the tarn's edge facing `from`, and the path runs from `from` to it.
  _findRefuge(P, from, ok = null) {
    const { W, H, N, elev, walk, cellAt, centre, dist, inside, openness, lowE } = P;
    const ideal = Math.max(230, Math.min(380, W * 0.55));
    const tarnR = this.cfg.tarnRadius;
    const cands = [];
    for (let i = 0; i < N; i++) {
      const p = centre(i);
      if (!walk[i] || elev[i] > lowE + 0.06 || !inside(p, 55) || (ok && !ok(p))) continue;
      const d = dist(p, from);
      if (d < ideal * 0.6 || d > ideal * 1.4) continue;
      const open = openness(p, tarnR * 2.2);
      if (open < 0.85) continue;
      cands.push({ p, score: -Math.abs(d - ideal) / 40 - (elev[i] - lowE) * 30 + open * 2 });
    }
    cands.sort((a, b) => b.score - a.score);
    for (let k = 0; k < Math.min(8, cands.length); k++) {
      const p = cands[k].p;
      const s = this._shorePoint(p, from, tarnR, walk, cellAt);
      if (!s) continue;
      const route = this._findPath(from, s, (x, y) => Math.hypot(x - p.x, y - p.y) < tarnR + 4);
      if (route) return { tarn: p, shore: s, path: route };
    }
    // Nowhere suitable: put it straight downhill and walk there regardless.
    const tarn = { x: Math.max(60, Math.min(W - 60, from.x - ideal * 0.8)), y: Math.max(60, Math.min(H - 60, from.y + 40)) };
    const shore = { x: tarn.x + tarnR + 12, y: tarn.y };
    return { tarn, shore, path: [from, shore] };
  }

  // The wrong way from `from`: downhill, but well away from the direction of `tarn`.
  _findDecoy(P, from, tarn) {
    const { W, H, N, walk, elev, centre, E, dist, inside, openness } = P;
    const toTarn = { x: tarn.x - from.x, y: tarn.y - from.y };
    const toTarnLen = Math.hypot(toTarn.x, toTarn.y) || 1;
    let decoy = null, best = -Infinity;
    for (let i = 0; i < N; i += 2) {
      const p = centre(i);
      if (!walk[i] || !inside(p, 40) || elev[i] > E(from) - 0.05) continue;
      const d = dist(p, from);
      if (d < 130 || d > toTarnLen * 0.85) continue;
      const cos = ((p.x - from.x) * toTarn.x + (p.y - from.y) * toTarn.y) / (d * toTarnLen);
      if (cos > 0.34) continue;   // within ~70° of the way to the tarn: too helpful
      const score = (E(from) - elev[i]) * 20 - cos * 2 + openness(p, 20);
      if (score > best) { best = score; decoy = p; }
    }
    if (!decoy) {
      const a = Math.atan2(toTarn.y, toTarn.x) + Math.PI * 0.6;
      decoy = { x: Math.max(40, Math.min(W - 40, from.x + Math.cos(a) * 150)),
                y: Math.max(40, Math.min(H - 40, from.y + Math.sin(a) * 150)) };
    }
    return decoy;
  }

  // Fill `storms` up to stormCount with storms on the high ground around `center`, keeping
  // them apart and passing `ok(p)`. With `away`, they favour the far side of `center` from
  // it. Each pass relaxes the height rule if the tops are too cramped.
  _placeStorms(P, center, storms, ok, away = null) {
    const { N, elev, centre, E, dist, inside } = P;
    const R = this.cfg.stormRadius;
    const toAway = away ? { x: away.x - center.x, y: away.y - center.y } : null;
    const toAwayLen = toAway ? (Math.hypot(toAway.x, toAway.y) || 1) : 1;
    for (const minE of [E(center) + 0.01, E(center) - 0.03, E(center) - 0.08, 0]) {
      while (storms.length < this.cfg.stormCount) {
        let pick = null, best = -Infinity;
        for (let i = 0; i < N; i += 2) {
          const p = centre(i), d = dist(p, center);
          if (!inside(p, 30) || d < R * 1.6 || d > 240 || elev[i] < minE) continue;
          if (!storms.every(s => dist(s, p) >= R * 1.3) || !ok(p)) continue;
          const toward = toAway ? ((p.x - center.x) * toAway.x + (p.y - center.y) * toAway.y) / (d * toAwayLen) : 0;
          const score = elev[i] * 10 - d * 0.004 - Math.max(0, toward) * 1.5;
          if (score > best) { best = score; pick = p; }
        }
        if (!pick) break;
        storms.push(pick);
      }
    }
    return storms;
  }

  // The eagle's lookout: high ground away from `center`.
  _findEyrie(P, center) {
    const { N, elev, centre, dist, inside } = P;
    let eyrie = null, best = -Infinity;
    for (let i = 0; i < N; i += 3) {
      const p = centre(i);
      if (!inside(p, 40)) continue;
      const score = elev[i] * 5 + Math.min(dist(p, center), 260) * 0.01;
      if (score > best) { best = score; eyrie = p; }
    }
    return eyrie;
  }

  // The way out, for the "Continue" walk-off: a walkable route from `from` to the map's edge
  // ('north' or 'south'), so the family doesn't walk into scree. null if there is none.
  _findExit(P, from, dir) {
    const { cols, rows, walk, centre, dist } = P;
    const edgeRow = dir !== 'south' ? 0 : rows - 1;
    const exits = [];
    for (let c = 0; c < cols; c++) if (walk[edgeRow * cols + c]) exits.push(centre(edgeRow * cols + c));
    exits.sort((a, b) => dist(a, from) - dist(b, from));
    let route = null;
    for (let k = 0; k < Math.min(6, exits.length) && !route; k++) route = this._findPath(from, exits[k]);
    return route ? this._smoothPath(route) : null;
  }

  // The terrain features for a tarn and the worn trail down to it (`trail`, a smoothed path):
  // the tarn sits a touch below the lowest ground under it.
  _waterFeatures(t, tarn, trail) {
    const ox = t._activeOriginX, oy = t._activeOriginY, tarnR = this.cfg.tarnRadius;
    let level = 1;
    for (let a = 0; a < 16; a++) {
      for (const rr of [0, tarnR * 0.5, tarnR]) {
        const x = tarn.x + Math.cos(a / 16 * TWO_PI) * rr, y = tarn.y + Math.sin(a / 16 * TWO_PI) * rr;
        level = Math.min(level, t.getElevation(x + ox, y + oy));
      }
    }
    const tr = this.cfg.trail;
    return [
      { type: 'tarn', x: tarn.x + ox, y: tarn.y + oy, r: tarnR, level: level - 0.006 },
      { type: 'trail', points: trail.map(p => ({ x: p.x + ox, y: p.y + oy })),
        width: tr.width, endWidth: tr.endWidth, amount: tr.amount, seasons: tr.seasons }
    ];
  }

  // Distance from p to the line a-b.
  static _segDist(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2));
    return Math.hypot(p.x - a.x - vx * k, p.y - a.y - vy * k);
  }

  // The tarn's edge facing the nest: where the family settles (and the wharariki grows).
  _shorePoint(tarn, nest, tarnR, walk, cellAt) {
    const base = Math.atan2(nest.y - tarn.y, nest.x - tarn.x);
    for (const off of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) {
      const a = base + off;
      const p = { x: tarn.x + Math.cos(a) * (tarnR + 12), y: tarn.y + Math.sin(a) * (tarnR + 12) };
      if (walk[cellAt(p.x, p.y)]) return p;
    }
    return null;
  }

  // Shortest walkable route between two points on the planning grid, preferring gentle ground
  // and keeping off scree edges. `blocked(x, y)` rules out extra cells. Returns [{x, y}] or null.
  _findPath(from, to, blocked = null) {
    const G = this._grid, cols = G.cols, rows = G.rows, step = G.step, N = cols * rows;
    const cell = (p) => Math.max(0, Math.min(rows - 1, (p.y / step) | 0)) * cols +
                        Math.max(0, Math.min(cols - 1, (p.x / step) | 0));
    const start = cell(from), goal = cell(to);
    const ok = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      ok[i] = G.walk[i];
      if (ok[i] && blocked && i !== goal && i !== start) {
        if (blocked(((i % cols) + 0.5) * step, (((i / cols) | 0) + 0.5) * step)) ok[i] = 0;
      }
    }
    ok[start] = ok[goal] = 1;
    const gc = goal % cols, gr = (goal / cols) | 0;
    const heur = (i) => Math.hypot((i % cols) - gc, ((i / cols) | 0) - gr);
    const cost = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N), open = new _ModuleHeap();
    cost[start] = 0;
    open.push(heur(start), start);
    while (open.size) {
      const cur = open.pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) break;
      const cc = cur % cols, cr = (cur / cols) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc, nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const n = nr * cols + nc;
          if (!ok[n] || closed[n]) continue;
          const len = (dr && dc) ? 1.414 : 1;
          const slope = Math.abs(G.elev[n] - G.elev[cur]) * 60;
          const c = cost[cur] + len * (1 + slope + (G.nearWall[n] ? 0.6 : 0));
          if (c < cost[n]) { cost[n] = c; came[n] = cur; open.push(c + heur(n), n); }
        }
      }
    }
    if (start !== goal && came[goal] < 0) return null;
    const out = [];
    for (let i = goal; i >= 0; i = came[i]) {
      out.push({ x: ((i % cols) + 0.5) * step, y: (((i / cols) | 0) + 0.5) * step });
      if (i === start) break;
    }
    out.reverse();
    out[0] = { x: from.x, y: from.y };
    out[out.length - 1] = { x: to.x, y: to.y };
    return out;
  }

  // Turn a grid route into a smooth line with a point every ~9 units (for the trail and for
  // the walk home).
  _smoothPath(pts) {
    let p = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1);
    for (let pass = 0; pass < 2; pass++) {   // Chaikin corner-cutting
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        q.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
        q.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    const out = [p[0]];
    let carry = 0;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], seg = Math.hypot(b.x - a.x, b.y - a.y);
      let d = 9 - carry;
      while (d <= seg) {
        out.push({ x: a.x + (b.x - a.x) * d / seg, y: a.y + (b.y - a.y) * d / seg });
        d += 9;
      }
      carry = seg - (d - 9);
    }
    out.push(p[p.length - 1]);
    return out;
  }

  // ==========================================================================
  // SETUP: put the cast on the land (after the simulation has sown the wild plants)
  // ==========================================================================
  setup() {
    const g = this.game, sim = g.simulation, s = this.sites, cfg = this.cfg;

    // The egg, laid in the nest just before the level opens. The story has it hatch after the
    // mother has brought food home, so it waits for that.
    this._layEgg(this._sec(cfg.eggLaidAgoSec));
    this.egg.waitForFood = true;

    // The parents: the father on the nest, the mother out at the pātōtara.
    this.father = this._spawnMoa(s.nest.x - 7, s.nest.y + 5, false, 'father');
    this.mother = this._spawnMoa(s.grove.x, s.grove.y, true, 'mother');

    // Food: the pātōtara patch, and wharariki (mountain flax) along the tarn's shore.
    this._sow('patotara', s.grove, 5, 18);
    this.wharariki = this._sowShore('wharariki', 6);

    // The standing storms, and any tools kept locked until the story needs them.
    for (const p of s.storms) sim.addStandingStorm(p.x, p.y, cfg.stormRadius);
    for (const tool in cfg.lockedTools) g.lockTool(tool);

    // The eagle, on its way over from its lookout. It circles where it starts until it comes
    // for the mother (see _updateSummer), so it always arrives as long after the opening.
    this._spawnEagle(s.grove);
    this._eagleHold = true;

    // The opening view: close in on the nest and the patch.
    const fx = s.nest.x * 0.6 + s.grove.x * 0.4, fy = s.nest.y * 0.6 + s.grove.y * 0.4;
    g.cameraTo({ zoom: cfg.openingZoom, cx: fx, cy: g._groundPaintY(fx, fy), ax: 0.5, ay: 0.5 }, 1);

    this._enterStage(g.seasonManager.currentKey);
    if (!this._beginIntro()) this._beat('opening');
  }

  // A new egg in the nest. The director hatches it (see _updateEgg), so the egg's own clock is
  // stopped (speedBonus 0) and its time is only used to draw its progress bar.
  _layEgg(ageFrames = 0, at = this.sites.nest) {
    const g = this.game;
    const egg = new Egg(at.x + 2, at.y + 2, g.terrain, CONFIG);
    egg.parentSpecies = 'upland_moa';
    egg.speedBonus = 0;
    egg.incubationTime = this._sec(this.cfg.eggHatchSec);
    // The egg's own clock stays just short of hatching, or the simulation would hatch it itself
    // (as a wild moa) before the story does.
    this.eggAge = ageFrames;
    egg.currentTime = Math.min(ageFrames, egg.incubationTime - 1);
    g.simulation.eggs.push(egg);
    g.simulation.markEggGridDirty();
    this.egg = egg;
    this.clutchThisYear = true;
  }

  // A scripted moa. `role` is 'father', 'mother' or 'chick' (a chick stays small: they take
  // years to grow up; opts.chickSize sets how small, as a share of adult size). It joins
  // opts.group (default: the player's family, the birds the eagle hunts and the story
  // follows; a later module adds a second family with its own group).
  _spawnMoa(x, y, female, role, opts = {}) {
    const sim = this.game.simulation;
    // Never on scree, ice or snow: a bird set down there can't walk off it (see _walkableNear).
    const p = this._walkableNear(x, y);
    if (p) { x = p.x; y = p.y; }
    const m = sim._createFromRegistry('moa', 'upland_moa', x, y, Moa);
    m.isFemale = female;
    const bySex = m.speciesConfig.sizeBySex;   // sizes set per sex (see Moa.updateAge)
    if (bySex) m.baseSize = female ? bySex.female : bySex.male;
    if (role === 'chick') {
      m.age = 0;
      m.size = m.baseSize * (opts.chickSize || 0.42);
    } else {
      m.age = MOA_AGE.ADULT_MIN + 1;
      m.updateAge(0);               // adult size
    }
    m.hunger = 20;
    m.homeRange.set(x, y);
    const group = opts.group || this.family;
    m.lifeScript = new MoaLife(m, this, role, group);
    sim.moas.push(m);
    sim._invalidateCache();
    group.push(m);
    return m;
  }

  // The nearest point to (x, y) a moa can stand on now (walkable, seasonal snow included, and at
  // least `edge` in from the map's edges), searched in rings out to maxR; (x, y) itself when it
  // already is; null if none.
  _walkableNear(x, y, maxR = 80, edge = 4) {
    const t = this.game.terrain, W = t.mapWidth, H = t.mapHeight;
    const ok = (px, py) => px > edge && py > edge && px < W - edge && py < H - edge && t.isWalkable(px, py);
    if (ok(x, y)) return { x, y };
    for (let r = 3; r <= maxR; r += 3) {
      const n = Math.max(8, Math.round(r * 1.5));
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (ok(px, py)) return { x: px, y: py };
      }
    }
    return null;
  }

  // The eagle, circling its lookout (sites.eyrie). It starts on its way over from there,
  // eagle.summerStartDist from `near` (toward the lookout), so a summer attack always takes
  // about as long to arrive.
  _spawnEagle(near) {
    const sim = this.game.simulation, s = this.sites, t = this.game.terrain;
    let ex = s.eyrie.x, ey = s.eyrie.y;
    const eD = Math.hypot(ex - near.x, ey - near.y), want = this.cfg.eagle.summerStartDist;
    if (want && eD > 1) {
      ex = Math.max(20, Math.min(t.mapWidth - 20, near.x + (ex - near.x) * want / eD));
      ey = Math.max(20, Math.min(t.mapHeight - 20, near.y + (ey - near.y) * want / eD));
    }
    const e = sim._createFromRegistry('eagle', 'haasts_eagle', ex, ey, HaastsEagle);
    e.lifeScript = new EagleLife(e, this, s.eyrie);
    sim.eagles.push(e);
    sim._invalidateCache();
    this.eagle = e;
    return e;
  }

  // Plant `count` of a plant type around a point. (Pātōtara the story plants comes up in fruit:
  // only the wild and the player's grown pātōtara need sprouting; see Plant.sproutsByHand.)
  _sow(type, at, count, radius, growth = 0.9) {
    const g = this.game, t = g.terrain;
    let placed = 0;
    for (let tries = 0; tries < count * 6 && placed < count; tries++) {
      const a = random(TWO_PI), d = random(4, radius);
      const x = at.x + Math.cos(a) * d, y = at.y + Math.sin(a) * d;
      if (!t.isWalkable(x, y)) continue;
      const p = new Plant(x, y, type, t, t.getBiomeAt(x, y).key);
      if (p.unsprouted) p.sprout();
      p.growth = growth;
      p.isSpawned = true;
      g.simulation.addPlant(p);
      placed++;
    }
  }

  // Plant along the tarn's shore, mostly on the side facing the nest. Returns the plants.
  _sowShore(type, count) {
    const s = this.sites, g = this.game, t = g.terrain;
    const base = Math.atan2(s.shore.y - s.tarn.y, s.shore.x - s.tarn.x);
    const placed = [];
    for (let tries = 0; tries < count * 8 && placed.length < count; tries++) {
      const a = base + random(-1.3, 1.3), d = s.tarnR + random(7, 22);
      const x = s.tarn.x + Math.cos(a) * d, y = s.tarn.y + Math.sin(a) * d;
      if (!t.isWalkable(x, y)) continue;
      const p = new Plant(x, y, type, t, t.getBiomeAt(x, y).key);
      p.growth = 1;
      p.isSpawned = true;
      g.simulation.addPlant(p);
      placed.push(p);
    }
    return placed;
  }

  // ==========================================================================
  // HOOKS CALLED BY THE GAME
  // ==========================================================================

  // Every playing frame, after the simulation has moved.
  update(dt) {
    if (this._intro) { this._updateIntro(); return; }     // the story waits for the welcome
    if (this._finale) { this._updateFinale(); return; }   // ...and is over for the farewell
    if (this.outro) { this._updateOutro(dt); return; }
    if (this.won) return;
    if (this._winAt != null) {          // home: the win waits out the family's words there,
      this.stageTime += dt;             // and for everyone to be back at the nest
      // Papa still on his way when Mama got home: once their words are said, he calls out.
      if (this._papaLate && this._tutorialIdle()) {
        this._papaLate = false;
        this._beat('papa_late');
      }
      const waited = this.stageTime >= this._winAt + this._sec(this.cfg.homeWaitSec);
      if (this.stageTime >= this._winAt && (this._allHome() || waited)) { this._winAt = null; this._win(); }
      return;
    }
    if (this._loseAt != null) {
      if (this.game.playTime >= this._loseAt) this._lose();
      return;
    }
    this.stageTime += dt;
    this._income(dt);
    this._updateWeather(dt);
    this._updateBreeding();
    this._updateEgg(dt);
    if (this.stage === 'summer') this._updateSummer();
    else if (this.stage === 'autumn') this._updateAutumn();
    else if (this.stage === 'winter') this._updateWinter();
    else if (this.stage === 'spring') this._updateSpring();
    this._updateJourney(dt);
    this._updateChase(dt);
  }

  // The game asks how far to move the season clock this frame. A season can't end before its
  // key moment (the egg hatching, the family reaching the tarn, getting home), so the clock
  // waits at holdSeasonAt until then. In autumn it stands still for the whole walk down (from
  // the story picking up to reaching the tarn), then catches up quickly to holdSeasonAt.
  seasonStep(dt) {
    if (this.won || this.outro || this._loseAt != null || this._intro || this._finale) return 0;
    const sm = this.game.seasonManager;
    const holdAt = this.cfg.holdSeasonAt * CONFIG.seasonDuration;
    if (this.stage === 'autumn' && this.beats.talked) {
      if (!this.beats.arrived) return 0;
      if (sm.timer < holdAt) return Math.min(dt * this.cfg.autumnCatchUp, holdAt - sm.timer);
    }
    if (!this._seasonMustWait()) return dt;
    return Math.max(0, Math.min(dt, holdAt - sm.timer));
  }

  _seasonMustWait() {
    if (this.stage === 'summer') return !this.beats.hatched;
    if (this.stage === 'autumn') return !this.beats.arrived;
    if (this.stage === 'spring') return true;   // spring ends when they get home (a win)
    return false;
  }

  onSeasonChange(key) {
    if (this.won || this.outro) return;
    this._enterStage(key);
  }

  // Whether a moa is out of the eagle's sight: under a storm.
  isHidden(m) {
    return !!this.game.simulation.stormAt(m.pos.x, m.pos.y, -2);
  }

  // What a family member does while the eagle is attacking: 'hide' (it's under a storm, so it
  // keeps still), 'flee' (it's in the open, so it runs), or null (no attack on it right now).
  chaseRole(m) {
    const c = this.chase;
    if (!(c && c.holdFamily && c.targets.includes(m))) return null;
    return this.isHidden(m) ? 'hide' : 'flee';
  }

  // What a fleeing bird runs from (anything with a pos): the eagle. A later module can add
  // other threats (see chaseRole).
  threatFor(m) { return this.eagle; }

  // The tarn's benefits at a point (slower hunger, a little food), or null if not near it.
  waterAt(x, y) {
    const s = this.sites;
    if (!s) return null;
    return Math.hypot(x - s.tarn.x, y - s.tarn.y) < s.tarnR + this.cfg.water.reach ? this.cfg.water : null;
  }

  // Moa only breed in spring and summer, at their nest, once a year. In Module 0 the year's
  // clutch is the opening egg, so this never fires there; it is the rule later years use.
  _updateBreeding() {
    if (this.egg && this.egg.alive) return;
    if (this.canBreed(this.father, this.mother)) this._layEgg(0);
  }

  // Whether the pair could lay now (see _updateBreeding).
  canBreed(father, mother) {
    const key = this.game.seasonManager.currentKey;
    if (key !== 'spring' && key !== 'summer') return false;
    if (this.clutchThisYear || !father || !mother || !father.alive || !mother.alive) return false;
    const n = this.sites.nest;
    return Math.hypot(father.pos.x - n.x, father.pos.y - n.y) < 20 &&
           Math.hypot(mother.pos.x - n.x, mother.pos.y - n.y) < 20;
  }

  // ==========================================================================
  // SEASONS
  // ==========================================================================
  _enterStage(key) {
    this.stage = key;
    this.stageTime = 0;
    this.beats = {};
    this._zoomOutAt = this._peepAt = null;   // a new season frames its own view
    // The weather on the tops gets going (story.weather), its first storm a few seconds in.
    const W = this.cfg.weather;
    if (W && key === W.from && !this._weatherOn) {
      this._weatherOn = true;
      this._weatherT = this._sec(W.everySec - W.firstSec);
    }

    // This season's goals, fresh.
    const list = (this.cfg.goals && this.cfg.goals[key]) || [];
    this.game.goals = list.map(gd => ({
      id: gd.id, name: gd.name, reward: gd.reward ?? this.cfg.goalReward,
      achieved: false, condition: () => false
    }));

    if (key === 'summer') this._beginSummer();
    else if (key === 'autumn') this._beginAutumn();
    else if (key === 'winter') this._beginWinter();
    else if (key === 'spring') this._beginSpring();
  }

  // Each season's opening. A later module overrides the ones it tells differently, and calls
  // these for the parts it shares.
  _beginSummer() {
    const s = this.sites;
    this.father.lifeScript.stay(s.nest.x - 7, s.nest.y + 5, 8);
    this.mother.lifeScript.graze(s.grove.x, s.grove.y, 16);
  }

  _beginAutumn() {
    // Pull the view back so the whole way down shows, and light it up.
    this.game.cameraTo({ zoom: 1 }, 150);
    this._gatherAtNest();
    // A new storm gathers a little way down the trail: the first stop on the way down. It
    // starts as a wisp and swells when it's pointed out (swellAutumnStorm). The story (and the
    // walk's countdown) picks up a few seconds in (see _updateAutumn).
    this.autumnStorm = this._trailStorm();
    if (this.autumnStorm) this.autumnStorm.swellTo(this.cfg.stormRadius * this.cfg.autumnStormStart, 1);
    // After the summer's clear skies (calmAfterHatch), the weather gathers over the nest again
    // (unless a storm has been set there since, not one still fading from the summer's clear
    // skies): they set out from under cover.
    const sim = this.game.simulation, n = this.sites.nest;
    if (this.cfg.calmAfterHatch &&
        !sim.placeables.some(p => p.alive && p.type === 'Storm' && !p.fading && this._overNest(p))) {
      const s = sim.addStandingStorm(n.x, n.y, this.cfg.stormRadius);
      s.swellTo(this.cfg.stormRadius * 0.3, 1);
      s.swellTo(this.cfg.stormRadius, this._sec(3));
    }
    this._journeyAt = Infinity;
    this._autumnTalkAt = this._sec(this.cfg.journey.talkDelaySec);
  }

  // "And look downhill, another STORM!": the autumn storm swells to its full size.
  swellAutumnStorm() {
    const s = this.autumnStorm;
    if (!s || !s.alive || this._swollen) return;
    this._swollen = true;
    s.swellTo(this.cfg.stormRadius, this._sec(this.cfg.swellSec));
  }

  // The eagle, gone since the hatching, is back (once the player has started the storm path,
  // or the walk has begun): it flies in toward the family from where it left, has its say
  // when it's close (the 'eagle_back' moment), and from then on patrols round the family.
  _eagleReturns() {
    this._eagleAway = false;
    this.beats.eagleBack = true;
    const c = this._centroid(this._living()), e = this.eagle.pos;
    const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy) || 1, t = this.game.terrain;
    const R = this.eagle.lifeScript.patrolRadius;
    this.eagle.lifeScript.comeBack({
      x: Math.max(20, Math.min(t.mapWidth - 20, c.x + dx / d * R)),
      y: Math.max(20, Math.min(t.mapHeight - 20, c.y + dy / d * R))
    });
  }

  // Where a patrolling eagle circles: round the family.
  patrolCentre() {
    const live = this._living();
    return live.length ? this._centroid(live) : this.sites.nest;
  }

  _beginWinter() {
    // Any tool still locked (if the story skipped its moment) is needed from here on.
    for (const tool in this.cfg.lockedTools) this.game.unlockTool(tool);
    // Winter storms fade away (moving one doesn't save it): new ones have to be called.
    for (const p of this.game.simulation.placeables) {
      if (p.alive && p.standing && p.type === 'Storm') p.fadeOver(this.cfg.winterStormLifeSec, false);
    }
    this._nextPass = this._sec(this.cfg.eagle.winterFirstPassSec);
    this._stalk(true);
    this._settleAtTarn();
    this._beat('winter');
  }

  // Winter's hungry Pouākai (eagle.winterStalk): circling close and quick round the family
  // between attacks; off again in spring.
  _stalk(on) {
    const el = this.eagle && this.eagle.lifeScript, W = this.cfg.eagle.winterStalk;
    if (!el || !W) return;
    if (on && !this._patrolWas) this._patrolWas = { r: el.patrolRadius, turn: el.patrolTurn, patrol: el.patrol };
    const was = this._patrolWas || { r: 160, turn: 0.006, patrol: el.patrol };
    el.patrolRadius = on ? W.patrolRadius : was.r;
    el.patrolTurn = on ? W.patrolTurn : was.turn;
    el.patrol = on ? true : was.patrol;
    // (Circling its lookout, it comes over to the family now.)
    if (on && (el.mode === 'soar' || el.mode === 'leave')) el.mode = 'patrol';
    if (!on) this._patrolWas = null;
  }

  // How long the eagle circles a hidden family before giving up (longer while it stalks in winter).
  _searchSec() {
    const E = this.cfg.eagle;
    return (this.stage === 'winter' && E.winterStalk) ? E.winterStalk.searchSec : E.searchSec;
  }

  _beginSpring() {
    // Winter is over: whatever storms are left stop wearing out.
    for (const p of this.game.simulation.placeables) {
      if (p.alive && p.standing && p.fading) { p.fading = false; p.life = p.maxLife = 1; }
    }
    this._stalk(false);
    this._journeyAt = this._sec(this.cfg.journey.springDelaySec);
    this.game._stormCooldownUntil = 0;   // no recharge this season (stormCooldownFree)
    this.clutchThisYear = false;   // a new breeding season
    this._beat('spring');
  }

  _updateSummer() {
    const b = this.beats, s = this.sites;
    // The eagle comes for the mother out at the grove.
    if (!b.threat && this.stageTime >= this._sec(this.cfg.eagle.summerThreatSec)) {
      b.threat = true;
      this._eagleHold = false;
      this._startChase('mother', [this.mother],
        { graceSec: this.cfg.eagle.graceSec, prompt: 'save_mother', holdOnApproach: false });
    }
    // Safe again, once the eagle has flown off she carries food home to the nest.
    if (b.motherSafe && b.eagleLeft && !b.carrying) {
      b.carrying = true;
      this.mother.lifeScript.goTo(s.nest.x + 6, s.nest.y + 4, 1.6);   // hurrying
    }
    if (b.carrying && !b.foodHome && this._near(this.mother, s.nest, 14)) {
      b.foodHome = true;
      this._foodHome();
    }
  }

  // The mother is home: the father is fed, and the berries she dropped sprout as pātōtara.
  _foodHome() {
    const s = this.sites;
    this.father.hunger = Math.max(0, this.father.hunger - 30);
    this._sow('patotara', s.nest, 3, 26, 0.4);
    this.mother.lifeScript.stay(s.nest.x + 6, s.nest.y + 4, 8);
    // "Just in time": the egg starts hatching a moment after she's home (a moment of play,
    // so her line about it shows first), however long it has been incubating.
    this._hatchFrom = this.stageTime + this._sec(this.cfg.hatch.delaySec);
    if (this.egg) this.eggAge = Math.max(this.eggAge, this.egg.incubationTime);
    this._achieve('foodHome');
    this._beat('food_home');
  }

  // The egg hatches 20 seconds after it is laid, once the mother is home at the nest to see
  // it (in summer, that's after she brings the food back). Hatching takes a few seconds: the
  // camera closes in on the nest while the egg rocks and cracks (egg.hatchProgress), then the
  // chick is out, the shell lies in pieces, and the camera pulls back out.
  _updateEgg(dt) {
    const H = this.cfg.hatch;
    if (this._peepAt != null && this.stageTime >= this._peepAt) {
      this._peepAt = null;
      this._zoomOutAt = this.stageTime + this._sec(H.zoomOutAfterSec);
      this._beat('chick_peep');
    }
    if (this._zoomOutAt != null && this.stageTime >= this._zoomOutAt) {
      this._zoomOutAt = null;
      this.game.cameraTo({ zoom: 1 }, 150);
      if (this.cfg.calmAfterHatch) this._calmAfterHatch();
    }
    if (this._shells) {
      this._shells.t += dt;
      if (this._shells.t > this._sec(6)) this._shells = null;
    }
    const egg = this.egg;
    if (!egg || !egg.alive) return;
    this.eggAge += dt;
    egg.currentTime = Math.min(egg.incubationTime - 1, this.eggAge);
    if (egg.hatchT == null) {
      if (this.eggAge < egg.incubationTime || !this._eggMayHatch(egg)) return;
      egg.hatchT = 0;
      egg.hatchProgress = 0;
      this.game.cameraTo({ zoom: H.zoom, cx: egg.pos.x, cy: this.game._groundPaintY(egg.pos.x, egg.pos.y),
                           ax: 0.5, ay: 0.5 }, 80);
      return;
    }
    egg.hatchT += dt;
    egg.hatchProgress = Math.min(1, egg.hatchT / this._sec(H.sec));
    if (egg.hatchProgress < 1) return;

    egg.alive = false;
    this.game.simulation.markEggGridDirty();
    this._shells = { x: egg.pos.x, y: egg.pos.y, t: 0, size: egg.size, spin: random(TWO_PI) };
    if (audioManager && audioManager.playPlantRustle) audioManager.playPlantRustle();
    this._hatchChick(egg);
    this.beats.hatched = true;
    this._peepAt = this.stageTime + this._sec(H.peepSec);
    this._achieve('hatched');
    this._beat('hatched');
  }

  // The chick is out and the view pulls back (story.calmAfterHatch): the eagle flies off the
  // map and, with nothing to hide from, the weather clears (every storm, the nest's too,
  // shrinks and fades away). Both come back in autumn (see _beginAutumn, _eagleReturns).
  _calmAfterHatch() {
    for (const p of this.game.simulation.placeables) {
      if (!p.alive || p.type !== 'Storm') continue;
      p.swellTo(p.radius * 0.3, this._sec(3));
      p.fadeOver(3, false);
    }
    if (this.chase) this.chase = null;
    this.eagle.lifeScript.flyAway();
    this._eagleAway = true;
  }

  _overNest(p) {
    const n = this.sites.nest;
    return Math.hypot(p.pos.x - n.x, p.pos.y - n.y) < this.cfg.stormRadius * 0.6;
  }

  // Whether the egg (its time up) can start hatching: once the mother is home at the nest to
  // see it, and in summer after she has brought the food back.
  _eggMayHatch(egg) {
    const mum = this.mother;
    return !mum || !mum.alive ||
      (this._near(mum, this.sites.nest, 22) &&
       (!egg.waitForFood || (this.beats.foodHome && this.stageTime >= (this._hatchFrom || 0))));
  }

  // The chick is out: life around the nest for the rest of summer. The parents feed close
  // by, the chick follows its mother.
  _hatchChick(egg) {
    this.chick = this._spawnMoa(egg.pos.x, egg.pos.y, random() < 0.5, 'chick');
    const n = this.sites.nest;
    this.father.lifeScript.graze(n.x, n.y, 24);
    this.mother.lifeScript.graze(n.x, n.y, 30);
    this.chick.lifeScript.follow(this.mother, 9);
    return this.chick;
  }

  _updateAutumn() {
    const b = this.beats, E = this.cfg.eagle;
    if (!b.talked && this.stageTime >= this._autumnTalkAt) {
      b.talked = true;
      this._journeyAt = this.stageTime + this._sec(this.cfg.journey.startDelaySec);
      this._movedAtTalk = this.game.simulation.stats.stormsMoved || 0;
      this._beat('autumn_path', { storm: this.autumnStorm });
    }
    // The eagle comes back once the storm path is under way (a storm moved since the talk) or
    // the walk begins; it has its say as it arrives (unless it's already attacking).
    if (this._eagleAway && b.talked &&
        (b.journey || (this.game.simulation.stats.stormsMoved || 0) > this._movedAtTalk)) this._eagleReturns();
    if (b.eagleBack && !b.eagleSaid) {
      const c = this._centroid(this._living());
      if (this.chase) b.eagleSaid = true;
      else if (Math.hypot(this.eagle.pos.x - c.x, this.eagle.pos.y - c.y) < this.cfg.eagleBackReach) {
        b.eagleSaid = true;
        this._beat('eagle_back');
      }
    }
    if (!b.journey && this.stageTime >= this._journeyAt) {
      b.journey = true;
      this.swellAutumnStorm();   // (if nobody pointed it out)
      // The berries are gone: they set off hungry, and feed on what grows along the way.
      for (const m of this._living()) m.hunger = Math.max(m.hunger, this.cfg.walkHunger);
      this._startJourney('down');
      this._beat('journey_start');
    }
    const j = this.journey;
    if (!j || !j.active || this.chase) return;
    // A little way in: the hungry ones (see hungryMoa).
    if (!b.hungry && j.time >= this._sec(this.cfg.hungrySec)) {
      b.hungry = true;
      const moa = this.hungryMoa();
      if (moa.length) this._beat('hungry', { moa });
    }
    // First attack, some way into the walk.
    if (!b.chase1 && j.time >= this._sec(E.autumnChase1Sec)) {
      b.chase1 = true;
      this._startChase('autumn1', this._living(), { graceSec: E.graceSec, prompt: 'last_chance' });
    } else if (b.chase1Done && !b.chase2 &&
               (j.progress >= E.autumnChase2Progress || j.time - b.chase1EndT >= this._sec(E.autumnChase2GapSec))) {
      // Second attack: the storm over them breaks up first.
      b.chase2 = true;
      this._startChase('autumn2', this._living(), { graceSec: E.graceSec, clearStorm: true, prompt: 'last_chance' });
      this._beat('new_storm');   // a new storm is needed (the Storm tool unlocks here)
    }
  }

  _updateWinter() {
    const b = this.beats, E = this.cfg.eagle, W = E.winterStalk;
    if (this.chase) this._lastChaseT = this.stageTime;
    // Stalking (after its first pass): a bird out of cover close under it is seen at once.
    let pounce = false;
    if (!this.chase && W && b.firstPass && this.stageTime - (this._lastChaseT || 0) >= this._sec(W.pounceGapSec)) {
      const e = this.eagle.pos;
      pounce = this._living().some(m => !this.isHidden(m) &&
        Math.hypot(m.pos.x - e.x, m.pos.y - e.y) < W.pounceRange);
    }
    if (!this.chase && (pounce || this.stageTime >= this._nextPass)) {
      this._startChase('winter', this._living(), {
        graceSec: E.winterGraceSec, prompt: b.firstPass ? 'last_chance' : 'winter_pass'
      });
      b.firstPass = true;
      this._nextPass = this.stageTime + this._sec(E.winterPassEverySec);
    }
    // Made it through: tick the goal near the end of winter, while it is still on screen.
    if (!b.survived && this.game.seasonManager.progress >= 0.8) {
      b.survived = true;
      this._achieve('winter');
    }
  }

  _updateSpring() {
    const b = this.beats, E = this.cfg.eagle;
    if (!b.journey && this.stageTime >= this._journeyAt) {
      b.journey = true;
      this._startJourney('up');
      this._beat('journey_start');
    }
    const j = this.journey;
    if (j && j.active && !b.chase && !this.chase && j.time >= this._sec(E.springChaseSec)) {
      b.chase = true;
      this._startChase('spring', this._living(), { graceSec: E.graceSec, prompt: 'last_chance' });
    }
  }

  // Everyone back to the nest, ready to set off together (hurry: walking briskly back to it,
  // as when they get home).
  _gatherAtNest(hurry = false) {
    const n = this.sites.nest;
    const to = (m, x, y) => {
      if (!m || !m.alive) return;
      if (hurry) m.lifeScript.walkRoute([{ x, y }], 1.5, 8);
      else m.lifeScript.stay(x, y, 8);
    };
    to(this.father, n.x - 6, n.y + 4);
    to(this.mother, n.x + 6, n.y + 4);
    if (this.chick && this.chick.alive) this.chick.lifeScript.follow(this.mother, 9);
  }

  // Whether the whole family is back at the nest (the level waits for this to end; see update).
  _allHome() {
    return this._living().every(m => this._near(m, this.sites.nest, this.cfg.homeReach));
  }

  // Put a standing storm on the way down, within the family's reach of the nest (about
  // 3/4 of journey.hopReach along the trail) and clear of any storm already there.
  _trailStorm() {
    const s = this.sites, sim = this.game.simulation, t = this.game.terrain;
    const R = this.cfg.stormRadius, want = this.cfg.journey.hopReach * 0.75;
    const free = (p) => !sim.placeables.some(o => o.alive && o.type === 'Storm' &&
                                               Math.hypot(o.pos.x - p.x, o.pos.y - p.y) < R * 1.3);
    let pick = null;
    for (const p of s.path) {
      const d = Math.hypot(p.x - s.nest.x, p.y - s.nest.y);
      if (d < want * 0.8) continue;
      if (d > this.cfg.journey.hopReach - 5) break;
      if (!pick) pick = p;                          // fallback: the first point far enough down
      if (t.isWalkable(p.x, p.y) && free(p)) { pick = p; break; }
    }
    if (!pick) pick = s.path[Math.min(s.path.length - 1, Math.floor(s.path.length * 0.3))];
    return sim.addStandingStorm(pick.x, pick.y, R);
  }

  // The weather on the tops (story.weather): now and then a new storm gathers at one of the
  // storm sites on the high ground (sites.storms; not the nest's, nor one by the family), while
  // fewer than weather.max sit on those sites. It swells in from a wisp, and in winter wears
  // out like the rest. It's the weather's (p.natural): a "call a storm" prompt doesn't count it.
  _updateWeather(dt) {
    const W = this.cfg.weather;
    if (!W || !this._weatherOn) return;
    this._weatherT += dt;
    if (this._weatherT < this._sec(W.everySec)) return;
    this._weatherT = 0;
    const sim = this.game.simulation, R = this.cfg.stormRadius, sites = this.sites.storms.slice(1);
    const storms = sim.placeables.filter(p => p.alive && p.type === 'Storm');
    const near = (p, q, r) => Math.hypot(p.x - q.x, p.y - q.y) < r;
    if (storms.filter(p => sites.some(q => near(p.pos, q, R * 0.8))).length >= W.max) return;
    const c = this.patrolCentre();
    const free = sites.filter(q => !storms.some(p => near(p.pos, q, R * 1.3)) && !near(c, q, R * 2));
    if (!free.length) return;
    const q = free[Math.floor(random(free.length))];
    const st = sim.addStandingStorm(q.x, q.y, R);
    st.natural = true;
    st.swellTo(R * 0.3, 1);
    st.swellTo(R, this._sec(3));
    if (this.stage === 'winter') st.fadeOver(this.cfg.winterStormLifeSec, false);
  }

  // Winter quarters: feeding along the tarn's shore.
  _settleAtTarn() {
    const s = this.sites.shore;
    this.father.lifeScript.graze(s.x, s.y, 22);
    this.mother.lifeScript.graze(s.x, s.y, 22);
    if (this.chick && this.chick.alive) this.chick.lifeScript.follow(this.mother, 9);
  }

  // ==========================================================================
  // THE WALK: from storm to storm
  // ==========================================================================
  // The mother leads, the chick follows her, the father follows the chick. She walks to the
  // next storm that brings them closer to where they're going (and, going down, isn't
  // uphill), rests under it a moment, then looks for the next. With no storm ahead she waits
  // under the one she's in for a while, then goes on without cover: going down, the wrong way
  // (downhill, but away from the wharariki); going home, along the old way up.
  _startJourney(dir) {
    const s = this.sites, lead = this._leader();
    if (!lead) return;
    const goal = dir === 'down' ? s.shore : { x: s.nest.x, y: s.nest.y };
    this.journey = {
      dir, goal, active: true, time: 0, waypoint: null, rethink: 0,
      restUntil: 0, waited: 0, goAlone: false, progress: 0,
      startDist: Math.max(1, Math.hypot(lead.pos.x - goal.x, lead.pos.y - goal.y))
    };
    // The chick right behind the leader, the other parent bringing up the rear.
    const others = [this.chick, this.father, this.mother].filter(m => m && m.alive && m !== lead);
    let prev = lead;
    for (const m of others) {
      m.lifeScript.follow(prev, m === this.chick ? 9 : 12);
      prev = m;
    }
  }

  _updateJourney(dt) {
    const j = this.journey;
    if (!j || !j.active) return;
    const lead = this._leader();
    if (!lead) return;
    const J = this.cfg.journey, ls = lead.lifeScript;
    if (!j.visited) this._prepareJourney(j);
    j.time += dt;
    const dGoal = Math.hypot(lead.pos.x - j.goal.x, lead.pos.y - j.goal.y);
    j.progress = Math.max(0, Math.min(1, 1 - dGoal / j.startDist));

    if (dGoal < J.goalReach) { j.active = false; this._arrive(j.dir); return; }
    if (this.chaseRole(lead)) return;              // the eagle is attacking: the walk waits
    if (this.stageTime < j.restUntil) { ls.stay(lead.pos.x, lead.pos.y, 4); return; }

    j.rethink -= dt;
    if (j.rethink <= 0 || !j.waypoint) {
      j.rethink = 15;
      j.waypoint = this._nextWaypoint(lead, j);
    }
    const wp = j.waypoint;
    if (wp === 'wait') {
      ls.stay(lead.pos.x, lead.pos.y, 4);
      j.waited += dt;
      if (j.waited >= this._sec(J.waitSec)) j.goAlone = true;
      return;
    }
    // The column keeps together: the leader waits for the last of them to catch up (not for
    // ever: one held up a long way back is left to follow on).
    const lag = this._columnLag(lead), tailGo = J.tailGap * (this._living().length - 1) + J.tailSlack;
    if (j.tailWait ? lag > tailGo : lag > tailGo + J.tailFar) {
      j.tailWait = (j.tailWait || 0) + dt;
      if (j.tailWait < this._sec(J.tailWaitSec)) { ls.stay(lead.pos.x, lead.pos.y, 4); return; }
    } else {
      j.tailWait = 0;
    }
    // Along its route (round the high ground) to where it's going.
    let tx = wp.x, ty = wp.y;
    if (wp.route) {
      const r = wp.route;
      while (wp.idx < r.length - 1 && Math.hypot(r[wp.idx].x - lead.pos.x, r[wp.idx].y - lead.pos.y) < 12) wp.idx++;
      tx = r[wp.idx].x; ty = r[wp.idx].y;
    }
    ls.goTo(tx, ty, J.speed);
    if (wp.storm && Math.hypot(lead.pos.x - wp.x, lead.pos.y - wp.y) < 10) {
      j.restUntil = this.stageTime + this._sec(J.restSec);   // arrived under a storm: rest
      j.visited.add(wp.storm);                                // ...and on from it, never back to it
      j.waypoint = null;
      j.waited = 0;
      j.goAlone = false;
    }
  }

  // A walk's working state, set up as it begins: the storms already rested under (never walked
  // back to), and how far there is to walk to the goal from every cell of the planning grid
  // over the ground as it is now (j.field), so storms are judged by the walk, not the crow's
  // flight: a storm over a ridge is as far as the way round it.
  _prepareJourney(j) {
    j.visited = new Set();
    j.tailWait = 0;
    j.field = this._walkField(j.goal);
  }

  // Walking distance to `to` from every cell of the planning grid (Infinity where it can't be
  // walked to), over the live walkable ground (seasonal snow included). Dijkstra, 8-way.
  _walkField(to) {
    const G = this._grid, t = this.game.terrain;
    if (!G) return null;
    const cols = G.cols, rows = G.rows, step = G.step, N = cols * rows;
    const ok = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      ok[i] = G.walk[i] && t.isWalkable(((i % cols) + 0.5) * step, (((i / cols) | 0) + 0.5) * step) ? 1 : 0;
    }
    const goal = this._cellOf(to);
    ok[goal] = 1;
    const dist = new Float32Array(N).fill(Infinity), heap = new _ModuleHeap();
    dist[goal] = 0;
    heap.push(0, goal);
    while (heap.size) {
      const cur = heap.pop();
      const cc = cur % cols, cr = (cur / cols) | 0, d0 = dist[cur];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = cc + dc, nr = cr + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const n = nr * cols + nc;
          if (!ok[n]) continue;
          const nd = d0 + ((dr && dc) ? 1.414 : 1) * step;
          if (nd < dist[n]) { dist[n] = nd; heap.push(nd, n); }
        }
      }
    }
    return dist;
  }

  _cellOf(p) {
    const G = this._grid;
    return Math.max(0, Math.min(G.rows - 1, (p.y / G.step) | 0)) * G.cols +
           Math.max(0, Math.min(G.cols - 1, (p.x / G.step) | 0));
  }

  // The walk still to go from p (the field, else as the crow flies). A point on a cell that
  // can't be walked (a storm's edge over scree) takes its best walkable neighbour's.
  _walkLeft(j, p) {
    const f = j.field;
    if (!f) return Math.hypot(p.x - j.goal.x, p.y - j.goal.y);
    const G = this._grid, i = this._cellOf(p);
    if (f[i] < Infinity) return f[i];
    let best = Infinity;
    const c = i % G.cols, r = (i / G.cols) | 0;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= G.cols || nr >= G.rows) continue;
        const v = f[nr * G.cols + nc] + Math.hypot(dr, dc) * G.step;
        if (v < best) best = v;
      }
    }
    return best;
  }

  // How far the furthest of the walkers is from the leader.
  _columnLag(lead) {
    let lag = 0;
    for (const m of this._living()) {
      if (m === lead || (m.lifeScript && m.lifeScript.offMap)) continue;
      lag = Math.max(lag, Math.hypot(m.pos.x - lead.pos.x, m.pos.y - lead.pos.y));
    }
    return lag;
  }

  _nextWaypoint(lead, j) {
    const sim = this.game.simulation, t = this.game.terrain, J = this.cfg.journey;
    const here = lead.pos;
    const dGoal = Math.hypot(here.x - j.goal.x, here.y - j.goal.y);
    if (dGoal < J.goalReach * 2) return { x: j.goal.x, y: j.goal.y };
    // Where they're going is in reach itself: straight there (no waiting for a storm first).
    if (this._walkLeft(j, here) <= J.hopReach) {
      return (j.waypoint && j.waypoint.final) ? j.waypoint : this._routeTo(lead, { x: j.goal.x, y: j.goal.y, final: true });
    }
    // (Module 0's story: having gone the wrong way, all the way to the decoy, they know better.)
    const decoy = this.sites.decoy;
    if (J.wrongWay && j.dir === 'down' && decoy && Math.hypot(here.x - decoy.x, here.y - decoy.y) < 25) j.lost = true;

    // The best storm in reach that shortens the walk still to go (by at least 20), one not
    // already rested under. The one it's heading for is kept unless another is clearly better,
    // so the leader doesn't dither between two.
    const leftHere = this._walkLeft(j, here);
    const cur = j.waypoint && j.waypoint.storm;
    let best = null, bestScore = -Infinity, bestPt = null;
    for (const p of sim.placeables) {
      if (!p.alive || p.type !== 'Storm' || j.visited.has(p)) continue;
      const d = Math.hypot(p.pos.x - here.x, p.pos.y - here.y);
      if (d > J.hopReach) continue;
      // Aim a little inside the storm on the far side, toward the goal (on ground it can stand on).
      const gx = j.goal.x - p.pos.x, gy = j.goal.y - p.pos.y, gl = Math.hypot(gx, gy) || 1;
      let pt = { x: p.pos.x + gx / gl * p.radius * 0.25, y: p.pos.y + gy / gl * p.radius * 0.25 };
      if (!t.isWalkable(pt.x, pt.y)) pt = this._walkableNear(p.pos.x, p.pos.y, p.radius * 0.5);
      if (!pt) continue;
      const gain = leftHere - this._walkLeft(j, pt);
      if (gain < 20) continue;
      const score = gain - d * 0.3 + (p === cur ? 15 : 0);
      if (score > bestScore) { bestScore = score; best = p; bestPt = pt; }
    }
    if (best) {
      if (cur === best) return j.waypoint;   // (keeping its route)
      return this._routeTo(lead, { x: bestPt.x, y: bestPt.y, storm: best });
    }
    // No storm ahead: wait under this one for a while, then go on alone, along the trail: down
    // in autumn, up in spring. (Module 0's story sends them the wrong way first: wrongWay.)
    if (!j.goAlone && this.isHidden(lead)) return 'wait';
    if (J.wrongWay && j.dir === 'down' && !j.lost && decoy) return this._routeTo(lead, { x: decoy.x, y: decoy.y });
    return this._pathPointAhead(here, j.dir === 'down' ? this.sites.path : this.sites.pathUp);
  }

  // A waypoint with a walkable route to it from where the leader is (round any high ground in
  // the way), or just the waypoint if there's no planning grid or no way round.
  _routeTo(lead, wp) {
    const t = this.game.terrain;
    const path = this._grid ? this._findPath({ x: lead.pos.x, y: lead.pos.y }, { x: wp.x, y: wp.y },
      (x, y) => !t.isWalkable(x, y)) : null;
    if (path && path.length > 2) { wp.route = this._smoothPath(path); wp.idx = 1; }
    return wp;
  }

  // A point a little further along `path` than the point nearest to `pos`.
  _pathPointAhead(pos, path) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d = Math.hypot(path[i].x - pos.x, path[i].y - pos.y);
      if (d < bd) { bd = d; bi = i; }
    }
    const p = path[Math.min(path.length - 1, bi + 4)];
    return { x: p.x, y: p.y };
  }

  _arrive(dir) {
    if (dir === 'down') {
      this.beats.arrived = true;
      this._settleAtTarn();
      this._achieve('refuge');
      this._beat('refuge');
    } else {
      const f = this.father;
      this._papaLate = !!(f && f.alive && !this._near(f, this.sites.nest, this.cfg.homeReach));
      this._gatherAtNest(true);
      this.chase = null;
      this._achieve('home');
      this._winAt = this.stageTime + this._sec(this.cfg.homeWinSec);
      this._beat('home');
    }
  }

  // ==========================================================================
  // EAGLE ATTACKS
  // ==========================================================================
  // An attack runs: (storm breaking up) → eagle flies in → if it can see a bird, a "last
  // chance" grace while it circles closer, then it dives → else it circles where they are,
  // can't find them, and leaves. Hidden birds that come out are spotted again.
  _startChase(kind, targets, opts = {}) {
    const live = targets.filter(m => m && m.alive);
    if (!live.length) return;
    const c = this.chase = {
      kind, targets: live, phase: 'approach', t: 0,
      grace: this._sec(opts.graceSec || this.cfg.eagle.graceSec), graceLeft: 0,
      prompt: opts.prompt || 'last_chance', holdFamily: false, victim: null,
      // Whether the family stops (and a bird in the open runs) as the eagle flies in, before it
      // has seen anyone. Off for the summer attack: the mother keeps feeding till it spots her.
      holdOnApproach: opts.holdOnApproach !== false
    };
    if (opts.clearStorm) {
      const s = this._stormOver(live);
      if (s) {
        s.fadeOver(this.cfg.eagle.clearSec, false);   // nothing saves this one
        c.phase = 'clearing';
        c.cleared = s;
        this._beat('storm_breaking');
      }
    }
    this.eagle.lifeScript.approach(this._centroid(live));
  }

  _updateChase(dt) {
    const c = this.chase;
    if (!c) return;
    c.t += dt;
    c.targets = c.targets.filter(m => m.alive);
    if (!c.targets.length) { this.chase = null; return; }
    const E = this.cfg.eagle, el = this.eagle.lifeScript, eagle = this.eagle;
    const centre = this._centroid(c.targets);
    const exposed = c.targets.filter(m => !this.isHidden(m));
    const dEagle = Math.hypot(eagle.pos.x - centre.x, eagle.pos.y - centre.y);

    if (c.phase === 'clearing') {
      c.holdFamily = true;                       // they stay put as their storm breaks up
      el.approach(centre);
      if (!c.cleared.alive || c.t > this._sec(E.clearSec + 0.5)) c.phase = 'approach';
    } else if (c.phase === 'approach') {
      el.approach(centre);
      c.holdFamily = c.holdOnApproach && dEagle < E.holdRange;
      if (dEagle < E.spotRange) {
        if (exposed.length) {
          c.phase = 'grace';
          c.graceLeft = c.grace;
          this._beat(c.prompt);
        } else {
          c.phase = 'search';                    // "they won't be seen at first"
          c.searchLeft = this._sec(this._searchSec());
          el.search(centre);
          this._beat('unseen');
        }
      }
    } else if (c.phase === 'grace') {
      c.holdFamily = true;
      if (!exposed.length) {
        c.phase = 'search';
        c.searchLeft = this._sec(this._searchSec());
        el.search(centre);
        this._beat('hidden');
        return;
      }
      c.graceLeft -= dt;
      const prey = this._victim(exposed);
      el.circle(prey, 26 + 46 * Math.max(0, c.graceLeft / c.grace));   // closing in
      if (c.graceLeft <= 0) {
        c.phase = 'strike';
        c.victim = prey;
        el.strike(prey);
      }
    } else if (c.phase === 'strike') {
      if (this.isHidden(c.victim)) {             // covered at the last moment
        c.phase = 'search';
        c.searchLeft = this._sec(this._searchSec());
        el.search(centre);
        this._beat('hidden');
      } else if (Math.hypot(eagle.pos.x - c.victim.pos.x, eagle.pos.y - c.victim.pos.y) < eagle.catchRadius + 2) {
        this._caught(c.victim);
      }
    } else if (c.phase === 'search') {
      c.holdFamily = true;
      if (exposed.length) {                       // one of them stepped out of cover
        const spotted = exposed.some(m => Math.hypot(eagle.pos.x - m.pos.x, eagle.pos.y - m.pos.y) < 90);
        if (spotted) {
          c.phase = 'grace';
          c.graceLeft = Math.max(this._sec(3), Math.min(c.grace, c.graceLeft || 0));
          this._beat('spotted_again');
          return;
        }
      }
      c.searchLeft -= dt;
      if (c.searchLeft <= 0) {
        c.phase = 'leaving';
        c.leftAt = c.t;
        el.leave();
        this._chaseSurvived(c);
      }
    } else if (c.phase === 'leaving') {
      c.holdFamily = false;
      // A moment after it turns away, the eagle is properly gone: home at its lookout, or (a
      // patrolling eagle) back out on its round of the family. (After the summer attack only
      // the time counts; see motherGoneSec.)
      const mother = c.kind === 'mother';
      const away = c.t - c.leftAt >= this._sec(mother ? E.motherGoneSec : E.goneSec);
      const gone = el.mode === 'soar' || (el.mode === 'patrol' && away);
      if (away || (gone && !mother)) this._eagleGone(c);
      if (gone && c.goneBeat) this.chase = null;
    }
  }

  // The eagle has flown off (once per attack): in summer the mother can head home now.
  _eagleGone(c) {
    if (c.goneBeat) return;
    c.goneBeat = true;
    if (c.kind === 'mother') this.beats.eagleLeft = true;
    this._beat('eagle_left', { kind: c.kind });
  }

  // The eagle gave up: tick whichever goal this attack belonged to.
  _chaseSurvived(c) {
    if (c.kind === 'mother') {
      this.beats.motherSafe = true;
      this._achieve('hideMother');
    } else if (c.kind === 'autumn1') {
      this.beats.chase1Done = true;
      this.beats.chase1EndT = this.journey ? this.journey.time : 0;
      this._achieve('chase1');
    } else if (c.kind === 'autumn2') {
      this._achieve('chase2');
    }
    this._beat('eagle_gave_up', { kind: c.kind });
  }

  // The bird the eagle goes for: the chick if it can, then the mother, then the father.
  _victim(exposed) {
    for (const m of [this.chick, this.mother, this.father]) if (m && exposed.includes(m)) return m;
    return exposed[0];
  }

  _caught(m) {
    const names = { father: 'the father', mother: 'the mother', chick: 'the chick' };
    m.alive = false;
    this.game.simulation._invalidateCache();
    if (audioManager) audioManager.playEagleCatch();
    this.eagle.lifeScript.leave();
    this.chase = null;
    this._failReason = `The Pouākai took ${names[m.lifeScript.role] || 'a moa'}.`;
    this._loseAt = this.game.playTime + 75;   // a beat to see it happen
  }

  // The storm most of these birds are standing under, if any.
  _stormOver(birds) {
    const sim = this.game.simulation, c = this._centroid(birds);
    return sim.stormAt(c.x, c.y) || (birds.length ? sim.stormAt(birds[0].pos.x, birds[0].pos.y) : null);
  }

  // ==========================================================================
  // WIN, LOSS AND THE "CONTINUE" OUTRO
  // ==========================================================================
  _win() {
    const g = this.game;
    // After the last module, Te Whē's farewell comes first (it calls back here when done).
    if (this.isLastModule() && !this._finaleDone) { this._beginFinale(); return; }
    this.won = true;
    this.chase = null;
    g.state = GAME_STATE.WON;
    if (audioManager) audioManager.playWin();
    PROGRESS.completeLevel(g.currentLevel.id, computeLevelScore(g.currentLevel, g._scoreContext()));
  }

  _lose() {
    const g = this.game;
    this._loseAt = null;
    g.state = GAME_STATE.LOST;
    g.gameOverReason = this._failReason;
    if (audioManager) audioManager.playLoss();
  }

  // Whether the win screen should offer "Continue" (walk off and pan to the next area).
  hasOutro() {
    return this.won && !this.outro && !this.outroDone && !!this.cfg.nextArea &&
           this.game.terrain && this.game.terrain.hasWorldGrid;
  }

  // "Continue": the family walks south off the map, then the camera pans to the next area.
  beginOutro() {
    const g = this.game;
    this.outro = { phase: 'walk', t: 0 };
    g.state = GAME_STATE.PLAYING;
    if (g.tutorial) { g.tutorial.enabled = false; g.tutorial.active = false; g.tutorial.currentTip = null; }
    g.selectedPlaceable = null;
    g.movingPlaceable = null;
    this.chase = null;
    this.journey = null;
    this.eagle.lifeScript.leave(true);   // home to its lookout (no following them off the map)
    for (const m of this._living()) m.lifeScript.walkOff(this.cfg.outroDir === 'south' ? 1 : -1, this.sites.exitPath);
    g.cameraTo({ zoom: 1 }, 90);
  }

  // Whether the win screen should offer "Continue" into another level on the same land and
  // area (story.continueTo: e.g. Module 1 into the Free Play years), with no walk-off or pan.
  hasContinue() {
    const id = this.cfg.continueTo;
    return this.won && !this._continuing && !!id && typeof LEVEL_REGISTRY !== 'undefined' && !!LEVEL_REGISTRY.get(id);
  }

  // "Continue" (story.continueTo): load that level here, on the same land, carrying over the
  // sites, both families, the storms and food patches on the map, and the mauri. The load runs
  // behind a still of this frame (Game.startModuleHandoff), so it fades straight in.
  beginContinue() {
    const g = this.game, t = g.terrain, sim = g.simulation;
    this._continuing = true;
    g.state = GAME_STATE.PLAYING;   // the card goes; the still is taken at the end of this frame
    if (g.tutorial) { g.tutorial.enabled = false; g.tutorial.active = false; g.tutorial.currentTip = null; }
    const friends = this.friends || [];
    const moa = [...this.family, ...friends].filter(m => m.alive)
      .map(m => ({ group: friends.includes(m) ? 'friends' : 'ours', role: m.lifeScript.role, female: m.isFemale }));
    const placed = sim.placeables.filter(p => p.alive && (p.type === 'Storm' || p.type === 'patotara' || p.type === 'wharariki'))
      .map(p => ({ type: p.type, x: p.pos.x, y: p.pos.y, radius: p.radius, sprouted: !p.unsprouted }));
    g.startModuleHandoff({
      levelId: this.cfg.continueTo,
      seed: t.seed,
      elevFit: t._elevFit ? Object.assign({}, t._elevFit) : null,
      sites: JSON.parse(JSON.stringify(this.sites)),
      moa, placed,
      mauri: g.mauri ? g.mauri.mauri : null
    });
  }

  // Whether the player's input is switched off (during the outro).
  inputLocked() { return !!this.outro; }

  // Whether the level clock has stopped: during the first module's welcome, and from the last
  // goal (home) on, through the family's words there, the farewell, the win and the
  // "Continue" walk-off and pan.
  clockStopped() {
    return this.won || !!this.outro || this.outroDone || this._winAt != null || !!this._intro || !!this._finale;
  }

  // ==========================================================================
  // THE BOOKENDS: Te Whē's welcome before the first module, farewell after the last
  // ==========================================================================
  // The module levels in order (by moduleIndex), the one after this (story.nextModule, if it
  // exists) and whether this is the first or the last. The welcome and the farewell follow
  // whichever modules are first and last, so adding a module moves them on by itself.
  static moduleLevels() {
    if (typeof LEVEL_REGISTRY === 'undefined') return [];
    return LEVEL_REGISTRY.getAll().filter(l => l && l.module)
      .sort((a, b) => (a.moduleIndex || 0) - (b.moduleIndex || 0));
  }
  nextModuleDef() {
    const id = this.cfg.nextModule;
    return (id && typeof LEVEL_REGISTRY !== 'undefined' && LEVEL_REGISTRY.get(id)) || null;
  }
  isFirstModule() {
    const all = ModuleDirector.moduleLevels();
    return !!all.length && all[0].id === this.level.id;
  }
  isLastModule() { return !this.nextModuleDef(); }

  // The first module opens on black: Te Whē's welcome (the 'intro' moment; once a session, so
  // a restart only fades in), then the screen fades in and the story begins (the 'opening'
  // moment). The story waits meanwhile (see update, seasonStep, clockStopped). Returns false
  // (nothing to do) for any other module, or one carried on from the module before.
  _beginIntro() {
    if (this.handoff || !this.isFirstModule()) return false;
    const g = this.game, seen = !!g._moduleIntroSeen;
    g._moduleIntroSeen = true;
    g.fadeScreen(1, 0);
    this._intro = { phase: seen ? 'fade' : 'talk' };
    if (seen) g.fadeScreen(0, this._sec(this.cfg.fadeSec));
    else this._beat('intro');
    return true;
  }

  _updateIntro() {
    const o = this._intro, g = this.game;
    if (o.phase === 'talk') {
      if (!this._tutorialIdle()) return;
      o.phase = 'fade';
      g.fadeScreen(0, this._sec(this.cfg.fadeSec));
    } else if (g.screenFadeDone()) {
      this._intro = null;
      this._beat('opening');
    }
  }

  // The last module: home, and the family's last words said. The screen fades to black, Te
  // Whē says goodbye (the 'finale' moment), and then the level is won (the win card shows on
  // the black).
  _beginFinale() {
    this._finale = { phase: 'fade' };
    this.chase = null;
    this.game.fadeScreen(1, this._sec(this.cfg.fadeSec));
  }

  _updateFinale() {
    const f = this._finale;
    if (f.phase === 'fade') {
      if (!this.game.screenFadeDone()) return;
      f.phase = 'talk';
      this._beat('finale');
    } else if (this._tutorialIdle()) {
      this._finale = null;
      this._finaleDone = true;
      this._win();
    }
  }

  // Whether no tip is showing or waiting to (so a moment's lines have all been read).
  _tutorialIdle() {
    const t = this.game.tutorial;
    return !t || !t.enabled || (!t.active && !t.pendingTips.length && !t.eventQueue.length);
  }

  // The family members hungry enough to say so (see hungryAt).
  hungryMoa() { return this._living().filter(m => m.hunger >= this.cfg.hungryAt); }

  // A storm the player has just called (Game.tryPlace) joins the standing weather: the size
  // of the others, staying put until moved, and fading like them in winter.
  onPlaced(p) {
    if (!p || p.type !== 'Storm') return;
    p.makeStanding(this.cfg.stormRadius);
    if (this.stage === 'winter') p.fadeOver(this.cfg.winterStormLifeSec, false);
  }

  // Spring: the Storm tool has no recharge, so a whole path of storms can be called at once.
  stormCooldownFree() { return this.stage === 'spring' && !this.won; }

  // Pukepuke's wharariki flowers, put down in the nest ("This is MY nest!").
  leaveFlowers() {
    this._sow('wharariki', this.sites.nest, 2, 10, 0.6);
  }

  _updateOutro(dt) {
    const o = this.outro, g = this.game, t = g.terrain;
    o.t += dt;
    if (o.phase === 'walk') {
      const north = this.cfg.outroDir !== 'south';
      const gone = this._living().every(m => north ? m.pos.y < -30 : m.pos.y > t.mapHeight + 30);
      if (gone || o.t > this._sec(30)) {
        // Off the map: clear this area and pan to the next one (already generated). Note who
        // walked off and where, for the next module to pick them up.
        const lead = this._leader();
        o.handoff = {
          levelId: this.cfg.nextModule || null,
          seed: t.seed,
          elevFit: t._elevFit ? Object.assign({}, t._elevFit) : null,
          entryX: lead ? Math.max(0, Math.min(t.mapWidth, lead.pos.x)) : null,
          family: this._living().map(m => ({ role: m.lifeScript.role, female: m.isFemale })),
          mauri: g.mauri ? g.mauri.mauri : null
        };
        g.simulation.unloadAreaEntities();
        const [col, row] = this.cfg.nextArea;
        t.panToArea(col, row);
        o.phase = 'pan';
      }
    } else if (o.phase === 'pan') {
      if (t.isPanning()) t.updatePan(dt, this._sec(3));
      if (!t.isPanning()) {
        // The next module, if there is one, carries straight on from here on the same land.
        if (o.handoff && o.handoff.levelId && typeof LEVEL_REGISTRY !== 'undefined' &&
            LEVEL_REGISTRY.get(o.handoff.levelId)) {
          this.outro = null;
          this.outroDone = true;
          g.startModuleHandoff(o.handoff);
          return;
        }
        g.simulation.spawnPlants();   // dress the new area
        o.phase = 'done';
        this.outro = null;
        this.outroDone = true;
        g.state = GAME_STATE.WON;
      }
    }
  }

  // ==========================================================================
  // DRAWING: the nest, on the ground under the birds. (The way down is drawn into the
  // terrain's colours as a trail feature, not here.)
  // ==========================================================================
  renderGround() {
    const s = this.sites, g = this.game;
    if (!s || this.outroDone || (this.outro && this.outro.phase !== 'walk')) return;
    push();
    this._renderWaterReach();
    noStroke();

    // The nest: a ring of twigs. (A module whose nests are nesting sites, drawn by the
    // simulation, turns this off with story.drawNest: false.)
    if (this.cfg.drawNest !== false) {
      const ny = g._groundPaintY(s.nest.x, s.nest.y);
      fill(96, 74, 48, 235);
      ellipse(s.nest.x, ny, 22, 13);
      fill(62, 46, 30, 240);
      ellipse(s.nest.x, ny, 13, 7);
    }

    // The broken shell, for a few seconds after the hatching: two halves tipped apart and a
    // scatter of chips, fading out.
    const sh = this._shells;
    if (sh) {
      const a = 255 * Math.min(1, 2 - sh.t / this._sec(3));
      const out = Math.min(1, sh.t / 12), r = sh.size;
      push();
      translate(sh.x, g._groundPaintY(sh.x, sh.y));
      stroke(200, 195, 180, a);
      strokeWeight(0.5);
      fill(245, 238, 220, a);
      for (const side of [-1, 1]) {
        push();
        translate(side * (1.5 + out * 3), out * 1.2);
        rotate(side * (0.5 + out * 0.6));
        arc(0, 0, r * 1.3, r * 1.5, side < 0 ? HALF_PI : -HALF_PI, side < 0 ? PI + HALF_PI : HALF_PI, CHORD);
        pop();
      }
      noStroke();
      for (let i = 0; i < 5; i++) {
        const ang = sh.spin + i * 1.26, d = 3 + out * (4 + (i % 3) * 2);
        ellipse(Math.cos(ang) * d, Math.sin(ang) * d * 0.6, 1.2, 1);
      }
      pop();
    }
    pop();
  }

  // The waterhole's reach (waterAt: the tarn's edge + water.reach), where a bird's hunger
  // slows: a steady water-blue ring with a soft glow, laid over the ground (it follows the
  // relief in the 3D view). Performance mode drops the glow, as the tool rings do.
  _renderWaterReach() {
    const s = this.sites, g = this.game;
    if (!s || !s.tarn || !this.cfg.water) return;
    const R = s.tarnR + this.cfg.water.reach, cx = s.tarn.x, cy = s.tarn.y;
    const dc = drawingContext, glow = !(typeof CONFIG !== 'undefined' && CONFIG.perfMode);
    const zoom = (typeof CONFIG !== 'undefined' && CONFIG.viewZoom) || 1;
    if (glow) {
      dc.shadowBlur = 6 * (dc.getTransform ? (dc.getTransform().a || 1) : 1);
      dc.shadowColor = 'rgba(120, 200, 240, 0.55)';
    }
    noFill();
    stroke(165, 222, 248, 190);
    strokeWeight(Math.max(1.3, 2 / zoom));
    beginShape();
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * TWO_PI, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      vertex(x, g._groundPaintY(x, y));
    }
    endShape(CLOSE);
    if (glow) { dc.shadowBlur = 0; dc.shadowColor = 'rgba(0,0,0,0)'; }
  }

  // Drawn over the birds, in the world view (after the simulation): the walk's guide. A later
  // module adds its markers (e.g. a nest's defence), after this.
  renderOver() { this._renderJourneyGuide(); }

  // On a walk, where the family is going next: a flowing dotted line from the leader to the
  // storm it's making for (along its route); waiting under a storm with none in reach, a faint
  // dotted ring as far as it can see one (journey.hopReach), so the player sees where to put it.
  _renderJourneyGuide() {
    const j = this.journey, g = this.game;
    if (!j || !j.active || this.chase) return;
    const lead = this._leader();
    if (!lead) return;
    const px = 1 / CONFIG.viewZoom, dc = drawingContext;
    const gy = (x, y) => g._groundPaintY(x, y);
    push();
    noFill();
    strokeCap(ROUND);
    strokeJoin(ROUND);
    if (j.waypoint === 'wait') {
      const R = this.cfg.journey.hopReach;
      stroke(235, 245, 255, 110);
      strokeWeight(2 * px);
      dc.setLineDash([6 * px, 8 * px]);
      dc.lineDashOffset = -(frameCount * 0.5 % 14) * px;
      beginShape();
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * Math.PI * 2, x = lead.pos.x + Math.cos(a) * R, y = lead.pos.y + Math.sin(a) * R;
        vertex(x, gy(x, y));
      }
      endShape(CLOSE);
    } else if (j.waypoint && j.waypoint.storm) {
      const wp = j.waypoint;
      const pts = [{ x: lead.pos.x, y: lead.pos.y }];
      if (wp.route) for (let i = wp.idx; i < wp.route.length; i++) pts.push(wp.route[i]);
      else pts.push({ x: wp.x, y: wp.y });
      stroke(255, 250, 215, 200);
      strokeWeight(3 * px);
      dc.setLineDash([10 * px, 10 * px]);
      dc.lineDashOffset = -(frameCount * 0.9 % 20) * px;
      beginShape();
      for (const p of pts) vertex(p.x, gy(p.x, p.y));
      endShape();
    }
    dc.setLineDash([]);
    pop();
  }

  // ==========================================================================
  // SMALL HELPERS
  // ==========================================================================
  _living() { return this.family.filter(m => m.alive); }
  // Who leads the walk: Mama Moa ("Mama Moa, lead the way!"), else the father.
  _leader() { return [this.mother, this.father].find(m => m && m.alive) || null; }

  _centroid(birds) {
    let x = 0, y = 0;
    for (const m of birds) { x += m.pos.x; y += m.pos.y; }
    return { x: x / birds.length, y: y / birds.length };
  }

  _near(m, p, r) { return Math.hypot(m.pos.x - p.x, m.pos.y - p.y) < r; }

  // Steady mauri while the family lives (they are the ecosystem here).
  _income(dt) {
    this._incomeT += dt;
    if (this._incomeT < MODULE_FPS) return;
    this._incomeT -= MODULE_FPS;
    if (this._living().length) this.game.mauri.earn(this.cfg.mauriPerSec);
  }

  // Tick a goal of the current season by id, and pay its reward.
  _achieve(id) {
    const g = this.game, goal = g.goals.find(x => x.id === id);
    if (!goal || goal.achieved) return;
    goal.achieved = true;
    g._goalsCompleted = (g._goalsCompleted || 0) + 1;
    if (goal.reward) g.mauri.earn(goal.reward, this.sites.nest.x, this.sites.nest.y, 'goal');
    g.addNotification(`Goal achieved: ${goal.name}!${goal.reward ? ` +${goal.reward} mauri` : ''}`, 'success');
  }

  // Tell the tutorial a story moment has happened (levels/tutorial_module_*.js shows tips).
  _beat(name, data = {}) {
    // A locked tool comes to life at its moment (before the tip about it shows).
    for (const tool in this.cfg.lockedTools) {
      if (this.cfg.lockedTools[tool] === name) this.game.unlockTool(tool);
    }
    const tut = this.game.tutorial;
    if (tut && typeof TUTORIAL_EVENTS !== 'undefined') {
      tut.fireEvent(TUTORIAL_EVENTS.MODULE_BEAT, Object.assign({ beat: name, director: this }, data));
    }
  }
}

// ============================================================================
// MoaLife: one family member's brain
// ============================================================================
// The director gives orders (stay, graze, goTo, follow, walkOff); this carries them out each
// frame with the moa's own steering, and looks after hunger and feeding. While the eagle is
// attacking (ModuleDirector.chaseRole), a bird under a storm keeps still and hidden, and a
// bird in the open runs, its safety draining.
class MoaLife {
  static EAT_AT = 25;   // hunger at which a bird eats a plant in reach (or goes to a tapped one)
  // The orders a tapped plant may draw a hungry bird away from (any but hiding, running or
  // walking off the map: a family on its walk stops to eat, then carries on).
  static LURE_MODES = new Set(['stay', 'graze', 'follow', 'route', 'go']);
  // A tapped plant feeds a bird that gets to it over a little time (feedPerSec hunger a second),
  // until it's down to FULL_AT, and isn't used up (PLANT_LURE): a moment's effort saves it.
  static FULL_AT = 12;
  // Getting stuck on the way (see _watchProgress): watched in windows of STUCK_WINDOW frames; a
  // window counts as slow if it closed in by under STUCK_GAIN × its base pace, and STUCK_WINDOWS
  // slow ones in a row (~4 s) plan a detour round the high ground. A detour is dropped once the
  // goal moves more than DETOUR_DRIFT from where it was planned to.
  static STUCK_WINDOW = 120;
  static STUCK_WINDOWS = 2;
  static STUCK_GAIN = 0.08;
  static DETOUR_DRIFT = 40;

  constructor(moa, director, role, group = null) {
    this.moa = moa;
    this.dir = director;
    this.role = role;              // 'father' | 'mother' | 'chick'
    this.group = group || director.family;   // its own family (they keep a little room between them)
    this.mode = 'stay';
    this.spot = { x: moa.pos.x, y: moa.pos.y };   // where it stays, grazes, or walks to
    this.radius = 8;               // how far from the spot it potters
    this.speed = 1;                // walking pace, as a multiple of the moa's normal speed
    this.leader = null;            // who it follows
    this.gap = 10;                 // how close it keeps to them
    this.offMap = false;           // the outro lets it walk off the edge of the map
    this.offDir = 1;               // which way it walks off: 1 = south, -1 = north
    this.security = 1;             // how safe it feels, 0..1 (shown as its second bar)
    this._eatTimer = random(60);
  }

  // ---- Orders ----
  stay(x, y, radius = 8)  { this.mode = 'stay'; this._setSpot(x, y); this.radius = radius; }
  graze(x, y, radius = 24) { this.mode = 'graze'; this._setSpot(x, y); this.radius = radius; }
  goTo(x, y, speed = 1)   { this.mode = 'go'; this._setSpot(x, y); this.speed = speed; }
  // Where it stays, grazes or walks to: on ground it can stand on (a spot on scree or snow is
  // moved to the nearest that isn't, or it would walk back onto it).
  _setSpot(x, y) {
    const p = this.offMap ? null : this.dir._walkableNear(x, y, 40);
    this.spot.x = p ? p.x : x; this.spot.y = p ? p.y : y;
  }
  follow(leader, gap = 10) { this.mode = 'follow'; this.leader = leader; this.gap = gap; }
  // Walk off the map: along `route` (a list of points to the map's edge) if there is one,
  // then straight on past the edge (dir 1 = south, -1 = north).
  walkOff(dir = 1, route = null) {
    this.mode = 'walkOff'; this.offMap = true; this.offDir = dir;
    this.route = route; this.routeIdx = 0;
  }
  // Walk along `route` (a list of points) at `speed`, then graze where it ends.
  walkRoute(route, speed = 1, grazeRadius = 20) {
    this.mode = 'route'; this.route = route; this.routeIdx = 0; this.speed = speed;
    this.radius = grazeRadius;
  }
  // Whether a walkRoute has reached its end (it is grazing there now).
  routeDone() { return this.mode !== 'route'; }

  behave(sim, mauri, seasonManager, dt) {
    const m = this.moa, base = m.baseSpeed;
    m.animTime += dt;
    this._travelling = false;   // set by _travel if it heads anywhere this frame
    this._hunger(dt);
    if (!this.offMap) this._feed(sim, mauri, dt);

    // While the eagle is attacking, a bird under a storm keeps still and a bird in the open
    // runs. Its safety drains while it runs and comes back slowly once it's left in peace.
    const role = this.dir.chaseRole(m);
    if (role === 'flee') this.security = Math.max(0, this.security - 0.0035 * dt);   // ~5 s to empty
    else if (!role) this.security = Math.min(1, this.security + 0.0015 * dt);
    const mode = role === 'hide' ? 'hold' : (role === 'flee' ? 'flee' : this.mode);
    const dx = this.spot.x - m.pos.x, dy = this.spot.y - m.pos.y;
    const dSpot = Math.hypot(dx, dy);
    // A plant the player tapped close by draws a hungry bird over to eat it (not one hiding,
    // running, or on an errand: see LURE_MODES).
    const lure = (MoaLife.LURE_MODES.has(mode) && !this.offMap) ? this._luredPlant(sim) : null;

    if (lure) {
      if (Math.hypot(lure.pos.x - m.pos.x, lure.pos.y - m.pos.y) < 10) {
        // At it: feeding (head down, barely moving), the plant left standing.
        if (!this._lureEating) mauri.earnFromEating(mauri.onMoaEat, m.pos.x, m.pos.y);
        this._lureEating = true;
        m.maxSpeed = base * 0.05;
        m.vel.mult(0.8);
        m.hunger = Math.max(0, m.hunger - PLANT_LURE.feedPerSec / 60 * dt);
      } else {
        m.maxSpeed = base * 1.2;   // hurrying to food
        this._travel(lure.pos.x, lure.pos.y, 0.9, 6, dt);
      }
    } else if (mode === 'hold') {
      m.maxSpeed = base * 0.05;
      m.vel.mult(0.85);                            // crouch where it stands
    } else if (mode === 'flee') {
      this._flee(sim);
    } else if (mode === 'stay' || mode === 'graze') {
      const grazing = mode === 'graze';
      m.maxSpeed = base * (grazing ? 0.6 : 0.45);
      if (dSpot > this.radius) {
        this._travel(this.spot.x, this.spot.y, 0.6, this.radius, dt);
      } else {
        const w = m.wander();
        w.mult(grazing ? 0.3 : 0.12);
        m.applyForce(w);
      }
    } else if (mode === 'go') {
      m.maxSpeed = base * this.speed;
      this._travel(this.spot.x, this.spot.y, 0.9, 12, dt);
    } else if (mode === 'follow') {
      const L = this.leader;
      if (L && L.alive) {
        // Keep up with whoever it follows (a little faster than them), easing in at the gap.
        const leadSpeed = (L.lifeScript && L.lifeScript.mode === 'go') ? L.lifeScript.speed : 0.6;
        m.maxSpeed = base * Math.max(0.6, leadSpeed * 1.15);
        const d = Math.hypot(L.pos.x - m.pos.x, L.pos.y - m.pos.y);
        if (d > this.gap) this._travel(L.pos.x, L.pos.y, 0.9, this.gap, dt);
        else { const w = m.wander(); w.mult(0.1); m.applyForce(w); }
      }
    } else if (mode === 'route') {
      m.maxSpeed = base * this.speed;
      const r = this.route;
      while (r && this.routeIdx < r.length - 1 &&
             Math.hypot(r[this.routeIdx].x - m.pos.x, r[this.routeIdx].y - m.pos.y) < 12) this.routeIdx++;
      const p = r && r[Math.min(this.routeIdx, r.length - 1)];
      if (!p || (this.routeIdx >= r.length - 1 && Math.hypot(p.x - m.pos.x, p.y - m.pos.y) < 10)) {
        const end = p || m.pos;
        this.graze(end.x, end.y, this.radius);   // there: settle and feed
      } else {
        this._travel(p.x, p.y, 0.9, 12, dt);
      }
    } else if (mode === 'walkOff') {
      m.maxSpeed = base * 1.6;
      const r = this.route;
      while (r && this.routeIdx < r.length && Math.hypot(r[this.routeIdx].x - m.pos.x, r[this.routeIdx].y - m.pos.y) < 12) this.routeIdx++;
      if (r && this.routeIdx < r.length) this._travel(r[this.routeIdx].x, r[this.routeIdx].y, 0.9, 0, dt);
      else m.applyForce(m.seekPoint(m.pos.x, this.offDir > 0 ? m.terrain.mapHeight + 200 : -200, 0.9));
    }

    // Not heading anywhere this frame (settled, hiding, running): start the next watch afresh.
    if (!this._travelling) { this._detour = null; this._prog = null; }

    this._keepSpace();
    if (!this.offMap && !m.terrain.isWalkable(m.pos.x, m.pos.y)) {
      // Standing on scree, ice or snow (set down there, jostled on, or the snow came down
      // round it): every way the avoidance looks is blocked, so it would only turn it back and
      // forth. Make for the nearest ground it can stand on instead.
      const e = this._escape;
      if (!e || Math.hypot(e.x - m.pos.x, e.y - m.pos.y) < 2 || !m.terrain.isWalkable(e.x, e.y)) {
        // (Clear of the map's edge margin, where Boid.edges would only push it back.)
        this._escape = this.dir._walkableNear(m.pos.x, m.pos.y, 80, 28) || this.dir._walkableNear(m.pos.x, m.pos.y, 80);
      }
      if (this._escape) {
        m.maxSpeed = Math.max(m.maxSpeed, base * 0.8);
        m.applyForce(m.seekPoint(this._escape.x, this._escape.y, 1.4));
      }
    } else {
      this._escape = null;
      const avoid = m.avoidUnwalkable();
      avoid.mult(2);
      m.applyForce(avoid);
    }
    if (!this.offMap) m.edges();
    // Slopes slow a walker (up much more than down); a purposeful walk is slowed less.
    const tm = m.getTerrainSpeedMultiplier();
    if (mode === 'go' || mode === 'follow' || mode === 'route') m.maxSpeed *= Math.max(0.6, tm);
    else if (mode !== 'walkOff') m.maxSpeed *= tm;
  }

  // Head for (x, y), easing in over `arrive`. Steering is straight at it, with avoidUnwalkable
  // nudging round scree and ice as it goes; that can stall against a mountain top that lies
  // across the way. So the walk is watched (_watchProgress), and a bird that has barely closed
  // in for a while is given a detour: a route round the high ground on the director's planning
  // grid (_planDetour), which it follows before carrying on as before.
  _travel(x, y, strength, arrive, dt) {
    const m = this.moa;
    this._travelling = true;
    let tx = x, ty = y, ar = arrive;
    const d = this._detour;
    if (d) {
      if (Math.hypot(d.gx - x, d.gy - y) > MoaLife.DETOUR_DRIFT) this._detour = null;   // going elsewhere now
      else {
        const pts = d.pts;
        while (d.i < pts.length - 1 && Math.hypot(pts[d.i].x - m.pos.x, pts[d.i].y - m.pos.y) < 10) d.i++;
        if (d.i >= pts.length - 1) this._detour = null;   // round it: straight on from here
        else { tx = pts[d.i].x; ty = pts[d.i].y; ar = 0; }
      }
    }
    m.applyForce(m.seekPoint(tx, ty, strength, ar));
    this._watchProgress(tx, ty, x, y, arrive, dt);
  }

  // How much closer the bird gets to what it's steering at, over windows of STUCK_WINDOW
  // frames (a target that jumps, the next route point say, isn't counted as progress or loss).
  // STUCK_WINDOWS slow windows in a row (well under STUCK_GAIN of its walking pace) while still
  // short of the goal (gx, gy) plan a detour.
  _watchProgress(tx, ty, gx, gy, arrive, dt) {
    const m = this.moa, d = Math.hypot(tx - m.pos.x, ty - m.pos.y);
    const w = this._prog || (this._prog = { tx, ty, d, t: 0, gain: 0, slow: 0 });
    if (Math.abs(tx - w.tx) + Math.abs(ty - w.ty) < 3) w.gain += w.d - d;   // same target as last frame
    w.tx = tx; w.ty = ty; w.d = d;
    if (Math.hypot(gx - m.pos.x, gy - m.pos.y) <= arrive + 4) { w.t = 0; w.gain = 0; w.slow = 0; return; }
    w.t += dt;
    if (w.t < MoaLife.STUCK_WINDOW) return;
    w.slow = (w.gain < w.t * m.baseSpeed * MoaLife.STUCK_GAIN) ? w.slow + 1 : 0;
    w.t = 0; w.gain = 0;
    if (w.slow >= MoaLife.STUCK_WINDOWS) { w.slow = 0; this._planDetour(gx, gy); }
  }

  // A route from here to (gx, gy) over the walkable ground as it is now (the planning grid,
  // less any cell under seasonal snow), smoothed. None if there's no way round.
  _planDetour(gx, gy) {
    const dir = this.dir, m = this.moa, t = m.terrain;
    if (!dir._grid || !dir._findPath) return;
    const path = dir._findPath({ x: m.pos.x, y: m.pos.y }, { x: gx, y: gy }, (x, y) => !t.isWalkable(x, y));
    if (!path || path.length < 3) return;
    this._detour = { pts: dir._smoothPath(path), i: 1, gx, gy };
  }

  // Run from the eagle: straight away from it, or into a storm if it is already at the edge of
  // one (a bird further out has to be covered by the player).
  _flee(sim) {
    const m = this.moa, e = this.dir.threatFor(m);
    m.maxSpeed = m.fleeSpeed;
    const cover = sim.stormAt(m.pos.x, m.pos.y, 10);
    if (cover) { m.applyForce(m.seekPoint(cover.pos.x, cover.pos.y, 1.2)); return; }
    let dx = m.pos.x - e.pos.x, dy = m.pos.y - e.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    m.applyForce(m.seekPoint(m.pos.x + dx * 60, m.pos.y + dy * 60, 1.2));
  }

  // Hunger rises slowly. Near the tarn it rises slower and the water tops the bird up a
  // little (what the old Waterhole tool did). The family never starves here.
  _hunger(dt) {
    const m = this.moa, cfg = this.dir.cfg;
    let rate = m.baseHungerRate * cfg.hungerScale * (this.role === 'chick' ? 1.3 : 1);
    const water = this.dir.waterAt(m.pos.x, m.pos.y);
    if (water) rate *= water.hungerSlowdown;
    m.hunger = Math.min(cfg.maxHunger, m.hunger + rate * dt);
    if (water) m.hunger = Math.max(0, m.hunger - water.feedingRate * dt);
  }

  // Now and then, when hungry, eat a plant within reach.
  _feed(sim, mauri, dt) {
    this._eatTimer -= dt;
    if (this._eatTimer > 0) return;
    this._eatTimer = 60 + random(40);
    const m = this.moa;
    if (m.hunger < MoaLife.EAT_AT) return;
    // (Not a tapped plant one of them is feeding at: that one isn't to be used up; _luredPlant.)
    const p = sim.getClosestPlant(m.pos.x, m.pos.y, 16, pl => pl.alive && pl.growth > 0.3 && !pl.dormant && !pl.unsprouted && !pl.matured && !(pl._heldBy && pl._heldBy.alive));
    if (p) this._eat(p, mauri);
  }

  _eat(p, mauri) {
    const m = this.moa;
    // How much of the plant's food a bite yields (a director can make wild browse poorer).
    const k = this.dir.biteValue ? this.dir.biteValue(p) : 0.8;
    m.hunger = Math.max(0, m.hunger - p.consume() * k);
    mauri.earnFromEating(mauri.onMoaEat, m.pos.x, m.pos.y);
  }

  // The nearest plant the player has tapped (Simulation.lurePlant) within PLANT_LURE.range, if
  // this bird is hungry enough to eat; else null.
  // Once it has set off for one, it keeps to it (the tap's lure may run out on the way: these
  // birds are slow) until it has eaten its fill there or the plant is gone.
  _luredPlant(sim) {
    const m = this.moa, held = this._lureTarget;
    if (held) {
      if (held.hasFood() && m.hunger > MoaLife.FULL_AT) return held;
      if (held._heldBy === m) held._heldBy = null;
      this._lureTarget = null;
      this._lureEating = false;
      return null;
    }
    const lures = sim.lures;
    if (!lures || !lures.length || m.hunger < MoaLife.EAT_AT) return null;
    let best = null, bestD = PLANT_LURE.range;
    for (const l of lures) {
      const d = Math.hypot(l.plant.pos.x - m.pos.x, l.plant.pos.y - m.pos.y);
      if (d < bestD) { bestD = d; best = l.plant; }
    }
    this._lureTarget = best;
    if (best) best._heldBy = m;   // (left for it: see _feed)
    return best;
  }

  // Family members keep a little room between them (much closer than strangers would).
  _keepSpace() {
    const m = this.moa;
    for (const o of this.group) {
      if (o === m || !o.alive) continue;
      const dx = m.pos.x - o.pos.x, dy = m.pos.y - o.pos.y, d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < 64) {
        const d = Math.sqrt(d2);
        m.applyForce({ x: dx / d * m.maxForce * 0.6, y: dy / d * m.maxForce * 0.6 });
      }
    }
  }
}

// ============================================================================
// EagleLife: the eagle, on a script
// ============================================================================
// Circles its lookout until the director sends it: approach (fly at the family), circle
// (orbit a bird, closing in), search (circle where hidden birds were), strike (dive), leave
// (go back to the lookout, then circle again). The story can also send it off the map
// (flyAway) and bring it back (comeBack); once back it patrols round the family instead of
// going home after an attack.
class EagleLife {
  static FADE_DIST = 140;        // flying away, it fades out over this last stretch (px)...
  static FADE_IN_FRAMES = 50;    // ...and back in over this long on its return

  constructor(eagle, director, home) {
    this.e = eagle;
    this.dir = director;
    this.home = { x: home.x, y: home.y };
    this.mode = 'soar';
    this.point = { x: home.x, y: home.y };
    this.start = { x: eagle.pos.x, y: eagle.pos.y };   // where it circles while the story waits
    this.target = null;
    this.radius = 70;
    this.angle = random(TWO_PI);
    this.patrol = false;       // leaving an attack, it circles the family (patrolRadius) rather than going home
    this.patrolRadius = 160;
    this.patrolTurn = 0.006;   // how fast it circles the family (quicker while stalking in winter)
    this.offMap = false;       // it may be off the edge of the map (flying away, gone, coming back)
    // How visible it is, 0..1 (HaastsEagle.render draws at this alpha). Flying away it fades
    // out over its last stretch to the edge, stays unseen while gone, and fades back in on its
    // way back (see _updateFade).
    this.fade = 1;
  }

  // ---- Orders ----
  approach(p)       { this.mode = 'approach'; this.point = { x: p.x, y: p.y }; }
  circle(bird, r)   { this.mode = 'circle'; this.target = bird; this.radius = r; }
  search(p)         { this.mode = 'search'; this.point = { x: p.x, y: p.y }; this.radius = 55; }
  strike(bird)      { this.mode = 'strike'; this.target = bird; }
  leave(home = false) {
    if (home) this.patrol = false;
    this.mode = this.patrol ? 'patrol' : 'leave';
    this.target = null;
  }
  // Off over the nearest edge of the map, and gone (it waits out there, out of sight).
  flyAway() {
    const e = this.e, t = e.terrain, W = t.mapWidth, H = t.mapHeight, x = e.pos.x, y = e.pos.y;
    const out = [[x, -90, y], [x, H + 90, H - y], [-90, y, x], [W + 90, y, W - x]]
      .sort((a, b) => a[2] - b[2])[0];
    this.point = { x: out[0], y: out[1] };
    this.mode = 'away';
    this.target = null;
    this.patrol = false;
    this.offMap = true;
  }
  // Back from wherever it went, to `p`; from then on it patrols round the family.
  comeBack(p) {
    this.mode = 'return';
    this.point = { x: p.x, y: p.y };
    this.patrol = true;
    this.offMap = true;   // (until it is back over the map)
  }

  behave(sim, mauri, dt) {
    const e = this.e;
    e.animTime += dt;
    let hunting = false;
    this._updateFade(dt);

    // Back over the map (coming back, or sent straight at the family): kept to it again.
    const t = e.terrain;
    if (this.offMap && this.mode !== 'away' && this.mode !== 'gone' &&
        e.pos.x > 0 && e.pos.y > 0 && e.pos.x < t.mapWidth && e.pos.y < t.mapHeight) this.offMap = false;
    if (this.mode === 'away' || this.mode === 'gone' || (this.mode === 'return' && this.offMap)) {
      this._offMapFlight(dt);
      return;
    }

    if (this.dir._intro || this.dir._eagleHold) {
      // The story hasn't started (the welcome, the fade in), or it hasn't come for anyone yet:
      // it circles where it set out from, so it arrives on time.
      e.maxSpeed = e.baseSpeed * 0.6;
      this._orbit(this.start.x, this.start.y, 22, 0.02, dt);
    } else if (this.mode === 'soar') {
      e.maxSpeed = e.baseSpeed * 0.8;
      this._orbit(this.home.x, this.home.y, 75, 0.006, dt);
    } else if (this.mode === 'approach') {
      hunting = true;
      e.maxSpeed = e.huntSpeed;
      e.applyForce(e.seekPoint(this.point.x, this.point.y, 1.1));
    } else if (this.mode === 'circle') {
      hunting = true;
      e.maxSpeed = e.baseSpeed * 0.75;
      const b = this.target;
      if (b) this._orbit(b.pos.x, b.pos.y, this.radius, 0.022, dt);
    } else if (this.mode === 'search') {
      e.maxSpeed = e.baseSpeed * 0.8;
      this._orbit(this.point.x, this.point.y, this.radius, 0.016, dt);
    } else if (this.mode === 'strike') {
      hunting = true;
      e.maxSpeed = e.huntSpeed * 1.15;
      const b = this.target;
      if (b) e.applyForce(e.seekPoint(b.pos.x, b.pos.y, 1.6));
    } else if (this.mode === 'leave') {
      e.maxSpeed = e.baseSpeed;
      e.applyForce(e.seekPoint(this.home.x, this.home.y, 0.8, 40));
      if (Math.hypot(e.pos.x - this.home.x, e.pos.y - this.home.y) < 45) this.mode = 'soar';
    } else if (this.mode === 'return') {
      e.maxSpeed = e.baseSpeed;
      e.applyForce(e.seekPoint(this.point.x, this.point.y, 0.9, 30));
      if (Math.hypot(e.pos.x - this.point.x, e.pos.y - this.point.y) < 25) this.mode = 'patrol';
    } else if (this.mode === 'patrol') {
      // Round and round the family, keeping an eye on them.
      e.maxSpeed = e.baseSpeed * 0.8;
      const c = this.dir.patrolCentre();
      this._orbit(c.x, c.y, this.patrolRadius, this.patrolTurn, dt);
    }

    // Sprite pose and the tutorial spotlight read these.
    e.hunting = hunting;
    e.target = hunting ? this.target : null;
    e.state = hunting ? 'hunting' : 'patrol';
    e.applyForce(e.avoidEdges());
    e.edges();
  }

  // Flying off the map, waiting out of sight, or coming back from there (no keeping to the
  // map's edges until it's back over the map).
  _offMapFlight(dt) {
    const e = this.e;
    e.hunting = false;
    e.target = null;
    e.state = 'patrol';
    if (this.mode === 'gone') { e.vel.mult(0); return; }
    e.maxSpeed = e.baseSpeed * 1.1;
    e.applyForce(e.seekPoint(this.point.x, this.point.y, 1));
    if (this.mode === 'away' && Math.hypot(e.pos.x - this.point.x, e.pos.y - this.point.y) < 20) this.mode = 'gone';
  }

  // Flying away it fades out over the last FADE_DIST px to its point off the map (so it never
  // hangs at the screen's edge), is unseen while gone, and fades in over FADE_IN_FRAMES once it
  // heads back (or is given any other order).
  _updateFade(dt) {
    const e = this.e;
    if (this.mode === 'gone') { this.fade = 0; return; }
    if (this.mode === 'away') {
      const d = Math.hypot(e.pos.x - this.point.x, e.pos.y - this.point.y);
      this.fade = Math.min(this.fade, Math.max(0, Math.min(1, (d - 20) / EagleLife.FADE_DIST)));
      return;
    }
    if (this.fade < 1) this.fade = Math.min(1, this.fade + dt / EagleLife.FADE_IN_FRAMES);
  }

  // Fly round (cx, cy) at radius r.
  _orbit(cx, cy, r, turn, dt) {
    const e = this.e;
    this.angle += turn * dt * (e.personality ? e.personality.turniness : 1);
    e.applyForce(e.seekPoint(cx + Math.cos(this.angle) * r, cy + Math.sin(this.angle) * r, 0.7));
  }
}

// A small binary min-heap of (priority, value), for the route search.
class _ModuleHeap {
  constructor() { this.pri = []; this.val = []; }
  get size() { return this.val.length; }
  push(p, v) {
    const P = this.pri, V = this.val;
    let i = V.length;
    P.push(p); V.push(v);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (P[up] <= P[i]) break;
      [P[up], P[i]] = [P[i], P[up]];
      [V[up], V[i]] = [V[i], V[up]];
      i = up;
    }
  }
  pop() {
    const P = this.pri, V = this.val, top = V[0];
    const lp = P.pop(), lv = V.pop();
    if (V.length) {
      P[0] = lp; V[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < V.length && P[l] < P[m]) m = l;
        if (r < V.length && P[r] < P[m]) m = r;
        if (m === i) break;
        [P[m], P[i]] = [P[i], P[m]];
        [V[m], V[i]] = [V[i], V[m]];
        i = m;
      }
    }
    return top;
  }
}

// Director classes by name, for a level's story.director (Game._initTerrainAndSeason). Later
// modules add theirs (mauri_module_*.js).
const MODULE_DIRECTORS = { storms: ModuleDirector };
