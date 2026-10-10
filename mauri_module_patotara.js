// ============================================================================
// MODULE 1: PĀTŌTARA (PatotaraDirector, KeaLife)
// ============================================================================
// The family from Module 0 walks north onto new tops, where another upland moa family sits on
// an egg in an established nest. Built on ModuleDirector (mauri_module.js): only the land
// plan, the cast and the summer story are new. Autumn, winter and spring play as in Module 0,
// with a few additions:
//
//   summer  The family arrives from the south and meets the other family at their nest. The
//           pātōtara by their nest is still bare: the player sprouts it (press and hold on it;
//           every pātōtara here, wild or grown, needs sprouting before it bears berries). The
//           berries draw a kea (Strongbeak), who calls two more (Skraak and Huft-Tuft); the three
//           mean to raid the egg. The player grows more pātōtara (the toolbar) by the nest and
//           sprouts it: the family comes to feed on it, and a marker on the nest shows the
//           raid's chance falling as moa gather. With all five moa there the raid fails (set
//           up to, for the lesson) and the kea fly off to their own nest, downslope in the
//           forest. The families make friends (ours stays close by: they don't settle a nest
//           here), and the other family's egg hatches (the young moa meet).
//   all year, once the kea have their nest: pātōtara the player sprouts draws any kea within
//           reach of it. Kea come at the family if it wanders near their nest, too. Kea that
//           land where the family is warn them and raid, at real odds (more kea, better odds;
//           more moa, worse): a raid that works scatters the family and the kea eat the berries
//           there. A storm in a coming kea's way turns it back.
//   autumn  The two families head downhill to different places: the other family walks to
//           its own winter spot by itself; ours makes the storm path to the waterhole.
//   winter  Pātōtara fruits in the warm months: in winter its plants stand bare (moa can't
//           eat them), and none can be sprouted. The player moves the wharariki (mountain
//           flax) down to the waterhole to feed the family instead.
//   spring  The pātōtara comes back. Both families walk home; ours makes a storm path up.
//
// Every nest here is a nesting site (drawn by the simulation). The family's walk back up ends
// at their spot next to the friends' nest.
// ============================================================================

// Tunables for this module's story (story.patotara in the level overrides them).
const PATOTARA_STORY_DEFAULTS = {
  nestRadius: 26,        // size of the nesting sites
  meetReach: 70,         // the families have met once the leader is this close to the friends' nest
  patchReach: 50,        // the pātōtara counts as "at their nest" this close
  patchDist: [34, 46],   // the story's pātōtara grows this far from their nest (just outside it)
  foodReach: 55,         // pātōtara grown this close to their nest brings the family to defend it
  sproutRemindSec: 8,    // pātōtara the player grew but hasn't sprouted gets a reminder after this
  juvenileSize: 0.55,    // Pukepuke, a year older: this share of adult size
  introZoomSec: 2.5,     // carried on from Module 0: the camera eases in from zoom 1 over this long
  // The summer raid: moa within `radius` of the nest defend it. With `needed` of them there
  // for holdSec the kea give up; if raidSec runs out first, they take the egg (a loss). Its
  // shown chance is set up for the lesson (see _summerChance), not rolled.
  defence: { radius: 85, needed: 5, holdSec: 2.5, raidSec: 30 },
  keaJoin: 2,            // kea that answer Strongbeak's call (three in all)
  // The kea after summer: pātōtara grown within lureRadius of a kea draws it; the family coming
  // within nestReach of the kea's nest draws them all. Kea that land where moa are (within
  // raidRadius) raid after rollSec, at chance base + perKea x kea - perMoa x moa (kept within
  // min..max). A raid that works scatters the family for scareSec; kea with no moa to raid feed
  // for feedSec and go home.
  // After a raid the kea don't raid again for restSec.
  keaLife: { lureRadius: 170, nestReach: 70, raidRadius: 80, rollSec: 4, scareSec: 4, feedSec: 12,
             restSec: 10, base: 0.5, perKea: 0.15, perMoa: 0.15, min: 0.05, max: 0.95 },
  friendsAfterSec: 2.5,  // after the kea flies off, the families make friends
  hatchAfterSec: 3,      // ...and the friends' egg starts hatching this long after that
  whararikiReach: 45     // the wharariki counts as "at the waterhole" within tarnRadius + this
};

class PatotaraDirector extends ModuleDirector {
  constructor(game, levelDef) {
    super(game, levelDef);
    const k = (levelDef.story && levelDef.story.patotara) || {};
    this.k = Object.assign({}, PATOTARA_STORY_DEFAULTS, k, {
      defence: Object.assign({}, PATOTARA_STORY_DEFAULTS.defence, k.defence),
      keaLife: Object.assign({}, PATOTARA_STORY_DEFAULTS.keaLife, k.keaLife)
    });
    this.friends = [];          // the other family (not hunted by the eagle; the story follows ours)
    this.friendFather = null;
    this.friendMother = null;
    this.friendChick = null;
    this.kea = null;            // Strongbeak, the first kea (the band's speaker)
    this.keas = [];             // all the kea: Strongbeak, Skraak, Huft-Tuft
    this.keaRaid = null;        // a raid after summer: { at, t, kea, moa, chance }
    this._scare = null;         // the family scattered by a raid: { from, until } (game.playTime)
    this._raidOkAt = 0;         // no new raid before this game.playTime (see keaLife.restSec)
    this.patch = null;          // the story's pātōtara patch (a placeable the player moves)
    this.placedFood = [];       // pātōtara the player has grown (the toolbar)
    this.whararikiPatch = null; // the wharariki (moved to the waterhole in winter)
    this.raid = null;           // the kea's raid in progress: { t, held, count, done }
    this._foodHeed = null;      // the grown pātōtara the family is feeding at
  }

  update(dt) {
    this._dt = dt;
    super.update(dt);
    // After the summer raid, the kea live their own year (see _updateKeaBand).
    if (this.beats && this._keaHome && !this.won && !this.outro && this._loseAt == null && this._winAt == null &&
        !this._intro && !this._finale) {
      this._updateKeaBand(dt);
    }
    if (this.beats && !this._intro && !this._finale && !this.outro) this._remindUnsprouted();
  }

  // The family doesn't settle here: no nest of their own this year (they stay by their
  // friends'), so no egg either.
  canBreed() { return false; }

  // Home (the level waits for it to end) means both families: ours at their spot, and the
  // friends back at their nest.
  _allHome() {
    const fn = this.sites.friendNest;
    return super._allHome() && this.friends.every(m => !m.alive || this._near(m, fn, 40));
  }

  // ==========================================================================
  // SITES
  // ==========================================================================
  planTerrain(t) {
    const P = this._planningGrid(t), cfg = this.cfg, h = this.handoff;
    const { W, H, N, cols, rows, elev, walk, centre, E, dist, inside, openness, toScree, topE } = P;
    const R = cfg.stormRadius;

    // ---- Where the family walks in: the south edge, below where they walked off Module 0's
    // map (or the middle). ----
    const want = (h && h.entryX != null) ? h.entryX : W * 0.5;
    let entry = null, bestD = Infinity;
    for (let c = 0; c < cols; c++) {
      const i = (rows - 1) * cols + c;
      if (!walk[i]) continue;
      const p = centre(i), d = Math.abs(p.x - want);
      if (d < bestD) { bestD = d; entry = p; }
    }
    if (!entry) entry = { x: want, y: H - 6 };

    // ---- The friends' nest: high, open ground a short walk up from where the family comes in
    // (the meeting opens the level, so it shouldn't be a long trek). ----
    let friendNest = null, best = -Infinity;
    for (const far of [200, 260, 400]) {
      for (let i = 0; i < N; i++) {
        const p = centre(i), d = dist(p, entry);
        if (!walk[i] || !inside(p, 55) || p.y > H - 90 || d < 100 || d > far) continue;
        const score = elev[i] * 10 + openness(p, 34) * 4 - Math.abs(d - 150) / 50;
        if (score > best) { best = score; friendNest = p; }
      }
      if (friendNest) break;
    }
    if (!friendNest) friendNest = { x: entry.x, y: Math.max(60, entry.y - 150) };

    // ---- Where the family stays, next door (open ground, not a nest: they don't settle
    // here); and an empty nest further off. (`nest` is the base director's name for the
    // family's spot: the walks down to the waterhole and back up start and end there.) ----
    const nestNear = (from, dMin, dMax, avoid) => {
      let pick = null, bestS = -Infinity;
      for (let i = 0; i < N; i++) {
        const p = centre(i), d = dist(p, from);
        if (!walk[i] || d < dMin || d > dMax || !inside(p, 45) || avoid.some(a => dist(a, p) < dMin)) continue;
        const s = openness(p, 24) * 3 - Math.abs(elev[i] - E(from)) * 20 + random(0.2);
        if (s > bestS) { bestS = s; pick = p; }
      }
      return pick || { x: Math.max(45, Math.min(W - 45, from.x + dMin)), y: from.y };
    };
    const nest = nestNear(friendNest, 60, 100, []);
    const thirdNest = nestNear(friendNest, 130, 220, [nest]);

    // ---- The way in: from the entry to a meeting point just short of the friends' nest. ----
    const toEntry = { x: entry.x - friendNest.x, y: entry.y - friendNest.y };
    const toEntryLen = Math.hypot(toEntry.x, toEntry.y) || 1;
    let meet = { x: friendNest.x + toEntry.x / toEntryLen * 45, y: friendNest.y + toEntry.y / toEntryLen * 45 };
    if (!walk[P.cellAt(meet.x, meet.y)]) meet = { x: friendNest.x, y: friendNest.y + 30 };
    const entryRoute = this._findPath(entry, meet);
    const entryPath = this._smoothPath(entryRoute || [entry, meet]);

    // ---- The pātōtara patch: just outside the friends' nest, on the side the family comes in
    // from, out in the open where no tree hides it (still bare: the player sprouts it). ----
    let patch = null; best = -Infinity;
    const [pMin, pMax] = this.k.patchDist;
    for (const clear of [24, 12, 0]) {
      for (let i = 0; i < N; i++) {
        const p = centre(i), d = dist(p, friendNest);
        if (!walk[i] || d < pMin || d > pMax || !inside(p, 30) || dist(p, nest) < 40) continue;
        if (clear && P.toForest[i] < clear) continue;
        const s = openness(p, 16) * 3 - dist(p, entry) * 0.004 + random(0.3);
        if (s > best) { best = s; patch = p; }
      }
      if (patch) break;
    }
    if (!patch) patch = { x: Math.max(30, Math.min(W - 30, friendNest.x + toEntry.x / toEntryLen * pMax)),
                          y: Math.max(30, Math.min(H - 30, friendNest.y + toEntry.y / toEntryLen * pMax)) };

    // ---- Where the family forages after the meeting: open ground well outside the nest's
    // defence ring (so it takes more pātōtara to bring them over), toward where they came in. ----
    let forage = null; best = -Infinity;
    const defR = this.k.defence.radius;
    for (let i = 0; i < N; i++) {
      const p = centre(i), d = dist(p, friendNest);
      if (!walk[i] || !inside(p, 40) || d < defR + 45 || d > defR + 110 || dist(p, patch) < 90) continue;
      const s = openness(p, 26) * 3 - dist(p, entry) * 0.004 - Math.abs(elev[i] - E(friendNest)) * 10;
      if (s > best) { best = s; forage = p; }
    }
    if (!forage) forage = { x: entry.x, y: Math.max(40, entry.y - 40) };

    // ---- The kea's perch: high, rocky ground a fair way off. ----
    let keaPerch = null; best = -Infinity;
    for (let i = 0; i < N; i += 2) {
      const p = centre(i), d = dist(p, friendNest);
      if (!inside(p, 35) || d < 140 || d > 270) continue;
      const s = elev[i] * 5 + (toScree[i] < 20 ? 1 : 0);
      if (s > best) { best = s; keaPerch = p; }
    }
    if (!keaPerch) keaPerch = { x: friendNest.x, y: Math.max(40, friendNest.y - 150) };

    // ---- Winter: the waterhole down the slope for our family (with the way down to it and the
    // wrong way), and a separate spot for the friends, well away from it. ----
    const { tarn, shore, path } = this._findRefuge(P, nest);
    const decoy = this._findDecoy(P, nest, tarn);
    // The friends' spot: lower ground a good walk from their nest, well away from ours, that
    // they can walk to.
    const spots = [];
    for (let i = 0; i < N; i += 2) {
      const p = centre(i), d = dist(p, friendNest);
      if (!walk[i] || !inside(p, 45) || d < 150 || d > 380) continue;
      if (dist(p, tarn) < 170 || dist(p, nest) < 120 || elev[i] > E(friendNest) - 0.04) continue;
      spots.push({ p, score: (E(friendNest) - elev[i]) * 20 + openness(p, 20) * 2 - Math.abs(d - 250) / 60 });
    }
    spots.sort((a, b) => b.score - a.score);
    let friendSpot = null, friendRoute = null;
    for (let k = 0; k < Math.min(8, spots.length) && !friendRoute; k++) {
      friendRoute = this._findPath(friendNest, spots[k].p);
      if (friendRoute) friendSpot = spots[k].p;
    }
    if (!friendRoute) {
      friendSpot = this._findDecoy(P, friendNest, tarn);
      friendRoute = [friendNest, friendSpot];
    }
    const friendPath = this._smoothPath(friendRoute);

    // ---- The wharariki: part way down, off to one side of the way, a good walk above the
    // waterhole (the player moves it there in winter). ----
    const smooth = this._smoothPath(path);
    let wharariki = null;
    for (const frac of [0.4, 0.3, 0.5, 0.2]) {
      const k = Math.min(smooth.length - 2, Math.max(1, Math.floor(smooth.length * frac)));
      const a = smooth[k], b = smooth[k + 1];
      const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
      for (const side of [1, -1]) {
        const p = { x: a.x + nx / nl * 38 * side, y: a.y + ny / nl * 38 * side };
        if (inside(p, 30) && walk[P.cellAt(p.x, p.y)] && dist(p, tarn) > 120) { wharariki = p; break; }
      }
      if (wharariki) break;
    }
    if (!wharariki) wharariki = smooth[Math.floor(smooth.length * 0.4)];

    // ---- The kea's nest: in the forest downslope (or the lowest ground near it), well away
    // from where both families spend the winter and the ways there. ----
    const segClear = (p, route, d) => route.every(q => dist(q, p) >= d);
    let keaNest = null; best = -Infinity;
    for (const relax of [1, 0.6, 0.3]) {
      for (let i = 0; i < N; i += 2) {
        const p = centre(i);
        if (!walk[i] || !inside(p, 40)) continue;
        if (dist(p, tarn) < 150 * relax || dist(p, friendSpot) < 150 * relax || dist(p, nest) < 140 * relax ||
            dist(p, friendNest) < 140 * relax || !segClear(p, smooth, 90 * relax) || !segClear(p, friendPath, 80 * relax)) continue;
        const sc = (P.forest[i] ? 3 : 0) - P.toForest[i] * 0.01 + (E(nest) - elev[i]) * 10 + random(0.2);
        if (sc > best) { best = sc; keaNest = p; }
      }
      if (keaNest) break;
    }
    if (!keaNest) keaNest = decoy;

    // ---- Storms: on the high ground, clear of the nests and the berries (the raid plays out
    // in the open) and of the lower part of the way down. ----
    const lowerPath = path.slice(Math.floor(path.length * 0.4));
    const storms = this._placeStorms(P, nest, [],
      (p) => dist(p, friendNest) >= R * 1.6 && dist(p, nest) >= R * 1.3 && dist(p, patch) >= R * 1.3 &&
             dist(p, shore) >= 200 && lowerPath.every(q => dist(q, p) >= R + 5),
      entry);

    const eyrie = this._findEyrie(P, nest);
    const exitPath = this._findExit(P, nest, cfg.outroDir);

    this.sites = { nest, friendNest, thirdNest, entry, meet, entryPath, patch, forage, keaPerch, keaNest,
                   tarn, shore, decoy, friendSpot, friendPath, friendPathUp: friendPath.slice().reverse(),
                   wharariki, storms, eyrie, tarnR: cfg.tarnRadius,
                   path: smooth, pathUp: smooth.slice().reverse(), exitPath,
                   grove: patch };   // (the base director's name for the summer food)
    return this._waterFeatures(t, tarn, smooth);
  }

  // ==========================================================================
  // SETUP
  // ==========================================================================
  setup() {
    const g = this.game, sim = g.simulation, s = this.sites, cfg = this.cfg, h = this.handoff;

    // The nests: nesting sites the simulation draws (the friends', and an empty one further
    // off; our family has none here). Their eggs draw themselves.
    const site = (p) => {
      const ns = new NestingSite(p.x, p.y, { radius: this.k.nestRadius, habitat: 'open' });
      ns.hideClutch = true;
      sim.nestingSites.push(ns);
      return ns;
    };
    this.friendSite = site(s.friendNest);
    this.thirdSite = site(s.thirdNest);

    // The other family: the father on their nest with their egg, the mother beside him.
    const fn = s.friendNest;
    this.friendFather = this._spawnMoa(fn.x - 6, fn.y + 4, false, 'father', { group: this.friends });
    this.friendMother = this._spawnMoa(fn.x + 9, fn.y + 6, true, 'mother', { group: this.friends });
    this._layEgg(this._sec(cfg.eggHatchSec), fn);   // ready: it hatches when the story says

    // Our family, walking in from the south: who walked off Module 0's map, else a pair and
    // their chick.
    const fam = (h && h.family && h.family.length) ? h.family
      : [{ role: 'father', female: false }, { role: 'mother', female: true }, { role: 'chick', female: random() < 0.5 }];
    fam.forEach((m, i) => {
      const x = s.entry.x + (i - 1) * 9, y = Math.min(g.terrain.mapHeight - 4, s.entry.y + i * 4);
      const moa = this._spawnMoa(x, y, m.female, m.role, { chickSize: this.k.juvenileSize });
      if (m.role === 'father') this.father = moa;
      else if (m.role === 'mother') this.mother = moa;
      else this.chick = moa;
    });

    // The food: the pātōtara by the friends' nest (bare until the player sprouts it) and the
    // wharariki (moved to the waterhole in winter).
    this.patch = this._standingPatch('patotara', s.patch);
    this.whararikiPatch = this._standingPatch('wharariki', s.wharariki);

    // The storms, the eagle (it only hunts once the family sets off in autumn) and the kea.
    for (const p of s.storms) sim.addStandingStorm(p.x, p.y, cfg.stormRadius);
    for (const tool in cfg.lockedTools) g.lockTool(tool);
    this._spawnEagle(s.eyrie);
    this.kea = this._spawnKea(s.keaPerch.x, s.keaPerch.y);   // Strongbeak
    sim._invalidateCache();
    // What the family had saved up in Module 0 comes with them.
    if (h && h.mauri != null && g.mauri) g.mauri.mauri = Math.max(g.mauri.mauri, h.mauri);

    // The opening view: between the way in and the friends' nest. Carried on from Module 0,
    // the camera starts where that module's pan ended (the whole area, zoom 1) and eases in,
    // so the two read as one shot; picked from the menu, it opens there directly.
    const fx = s.friendNest.x * 0.6 + s.entry.x * 0.4, fy = s.friendNest.y * 0.6 + s.entry.y * 0.4;
    const opening = { zoom: cfg.openingZoom, cx: fx, cy: g._groundPaintY(fx, fy), ax: 0.5, ay: 0.5 };
    if (h) {
      g.cameraTo({ zoom: 1 }, 1);
      g._updateCamera();
      g.cameraTo(opening, this._sec(this.k.introZoomSec));
    } else {
      g.cameraTo(opening, 1);
    }

    this._enterStage(g.seasonManager.currentKey);
    // The opening moment waits for the camera to settle when it is easing in (or, as the first
    // module, for Te Whē's welcome; see _beginIntro).
    if (h) this._openingAt = this._sec(this.k.introZoomSec);
    else if (!this._beginIntro()) this._beat('opening');
  }

  // A food patch the story puts down: it stays (doesn't wear out) until the player moves it.
  _standingPatch(type, at) {
    const p = this.game.simulation.addPlaceable(at.x, at.y, type);
    this._stand(p);
    return p;
  }
  _stand(p) { p.standing = true; p.fading = false; p.life = p.maxLife = 1; }

  // ==========================================================================
  // SUMMER: meeting the neighbours, the pātōtara, the kea's raid
  // ==========================================================================
  _beginSummer() {
    const s = this.sites;
    // Ours walk in, Mama leading; theirs stay by their nest.
    this.mother.lifeScript.walkRoute(s.entryPath, 1.5, 18);
    if (this.chick) this.chick.lifeScript.follow(this.mother, 9);
    this.father.lifeScript.follow(this.chick || this.mother, 12);
    this.friendFather.lifeScript.stay(s.friendNest.x - 6, s.friendNest.y + 4, 6);
    this.friendMother.lifeScript.graze(s.friendNest.x + 8, s.friendNest.y + 6, 18);
  }

  _updateSummer() {
    const b = this.beats, s = this.sites, dt = this._dt || 1;
    const fn = s.friendNest;

    if (this._openingAt != null && this.stageTime >= this._openingAt) {
      this._openingAt = null;
      this._beat('opening');
    }

    // 1. They arrive and meet the neighbours (who ask for help with the pātōtara), then go off
    // to forage a little way away (outside the nest's defence ring).
    if (!b.met && this.mother && (this.mother.lifeScript.routeDone() || this._near(this.mother, fn, this.k.meetReach))) {
      b.met = true;
      this._grazeFamily(s.forage, 18);
      this._achieve('meet');
      this._beat('meet', { patch: this.patch });
    }

    // 2. The pātōtara by their nest is sprouted: their mother feeds on it, and the berries draw
    // the kea.
    if (b.met && !b.patchHome && this.patch && this.patch.alive && !this.patch.unsprouted &&
        this._near(this.patch, fn, this.k.patchReach)) {
      b.patchHome = true;
      this.friendMother.lifeScript.graze(this.patch.pos.x, this.patch.pos.y, 12);
      if (this.kea) this.kea.lifeScript.comeTo(this.patch.pos.x + 10, this.patch.pos.y - 6, 'peck');
      this._achieve('patotara');
      this._beat('patch_home');
    }

    // 3. Strongbeak has landed by the berries and calls the others over (they fly in once his
    // lines are done).
    if (b.patchHome && !b.keaThreat && (!this.kea || this.kea.lifeScript.landed)) {
      b.keaThreat = true;
      const at = this.patch.pos, from = s.keaPerch;
      for (let i = 0; i < this.k.keaJoin; i++) {
        const side = i % 2 ? 1 : -1;
        const k = this._spawnKea(from.x + side * (20 + i * 12), from.y - 10 - i * 8);
        if (k) k.lifeScript.comeTo(at.x + side * (14 + i * 4), at.y + 6 + i * 3, 'peck');
      }
      this._beat('kea_threat', { kea: this.kea });
    }

    // 4. All three are there: they mean to raid the egg. The raid begins.
    if (b.keaThreat && !b.keaGang && this.keas.every(k => !k.alive || k.lifeScript.landed)) {
      b.keaGang = true;
      this.raid = { t: 0, held: 0, count: 0, done: false };
      this._beat('kea_gang', { keas: this.keas });
    }

    // Until they're friends, the family feeds at the newest pātōtara the player has grown
    // (that's how the player brings them over to the nest).
    if (b.met && !b.friends) {
      const food = this._newestFood();
      if (food && food !== this._foodHeed) {
        this._foodHeed = food;
        this._callFamily(food.pos, 14);
        if (this._near(food, fn, this.k.foodReach)) this._beat('food_called', { food });
      }
    }

    // 5. The raid: enough moa round the nest for long enough and the kea give up; too few when
    // their time runs out and they take the egg.
    const r = this.raid, D = this.k.defence;
    if (r && !r.done) {
      r.t += dt;
      r.count = this._defenders();
      r.held = r.count >= D.needed ? r.held + dt : Math.max(0, r.held - dt * 2);
      if (r.held >= this._sec(D.holdSec)) this._raidFails();
      else if (r.t >= this._sec(D.raidSec)) this._raidSucceeds();
    }

    // 6. A moment after the kea have gone: friends. Our family stays close by, next door.
    if (b.raidFailed && !b.friends && this.stageTime >= this._friendsAt) {
      b.friends = true;
      this._grazeFamily(s.nest, 22);
      this._hatchFrom = this.stageTime + this._sec(this.k.hatchAfterSec);
      this._beat('friends');
    }
  }

  // Moa (of either family) close enough to their nest to see off a kea.
  _defenders() {
    const fn = this.sites.friendNest, R = this.k.defence.radius;
    let n = 0;
    for (const m of this.game.simulation.moas) if (m.alive && this._near(m, fn, R)) n++;
    return n;
  }

  _raidFails() {
    const r = this.raid;
    r.done = true;
    this.beats.raidFailed = true;
    this._friendsAt = this.stageTime + this._sec(this.k.friendsAfterSec);
    // Driven off: a dash at the nest, then off to their own nest downslope, for good.
    const kn = this.sites.keaNest;
    this.keas.forEach((k, i) => {
      if (!k.alive) return;
      k.lifeScript.setHome(kn.x + Math.cos(i * 2.1) * 12, kn.y + Math.sin(i * 2.1) * 8);
      k.lifeScript.lungeThenLeave(this.sites.friendNest);
    });
    this._keaHome = true;
    this._achieve('defend');
    this._beat('raid_failed');
  }

  _raidSucceeds() {
    const r = this.raid;
    r.done = true;
    for (const k of this.keas) if (k.alive) k.lifeScript.comeTo(this.sites.friendNest.x, this.sites.friendNest.y, 'peck');
    if (this.egg && this.egg.alive) {
      this.egg.alive = false;
      this.game.simulation.markEggGridDirty();
    }
    if (audioManager && audioManager.playEagleCatch) audioManager.playEagleCatch();
    this._failReason = "The kea took their egg. Bring more moa to the nest next time.";
    this._loseAt = this.game.playTime + 90;
    this._beat('raid_won');
  }

  // Their egg hatches once the families are friends (see _updateSummer).
  _eggMayHatch(egg) {
    return !!this.beats.friends && this.stageTime >= (this._hatchFrom || 0);
  }

  // The friends' chick (Koukou) is out. It sticks by its mother, and Pukepuke comes to meet it.
  // Koukou is the other sex to Pukepuke: years from now the two of them pair up (see the Free
  // Play years, FreePlayDirector).
  _hatchChick(egg) {
    const fn = this.sites.friendNest;
    const female = this.chick ? !this.chick.isFemale : random() < 0.5;
    this.friendChick = this._spawnMoa(egg.pos.x, egg.pos.y, female, 'chick', { group: this.friends });
    this.friendFather.lifeScript.graze(fn.x, fn.y, 18);
    this.friendMother.lifeScript.graze(fn.x, fn.y, 24);
    this.friendChick.lifeScript.follow(this.friendMother, 8);
    if (this.chick && this.chick.alive) this.chick.lifeScript.follow(this.friendChick, 10);
    return this.friendChick;
  }

  // ==========================================================================
  // AUTUMN, WINTER, SPRING: as Module 0, plus the neighbours and the pātōtara
  // ==========================================================================
  _beginAutumn() {
    super._beginAutumn();
    // The neighbours head off to their own winter spot.
    const fm = this.friendMother;
    fm.lifeScript.walkRoute(this.sites.friendPath, 0.9, 18);
    if (this.friendChick) this.friendChick.lifeScript.follow(fm, 8);
    this.friendFather.lifeScript.follow(this.friendChick || fm, 12);
  }

  _beginWinter() {
    super._beginWinter();
    // Winter: the pātōtara has no berries now.
    this._bareBerries(true);
  }

  // Winter as Module 0, and the wharariki: once it's by the waterhole, the family can feed on
  // it there.
  _updateWinter() {
    super._updateWinter();
    const w = this.whararikiPatch, s = this.sites;
    if (!this.beats.wharariki && w && w.alive && this._near(w, s.tarn, s.tarnR + this.k.whararikiReach)) {
      this.beats.wharariki = true;
      this._achieve('wharariki');
      this._beat('wharariki_home');
    }
  }

  _beginSpring() {
    super._beginSpring();
    this._bareBerries(false);
    // The neighbours walk home too.
    const fm = this.friendMother;
    fm.lifeScript.walkRoute(this.sites.friendPathUp, 0.9, 22);
    if (this.friendChick) this.friendChick.lifeScript.follow(fm, 8);
    this.friendFather.lifeScript.follow(this.friendChick || fm, 12);
  }

  // Pātōtara the player grows lasts the year (the family feeds at it once it's sprouted). It
  // comes up bare: the player sprouts it (Game._sprout; see onSprouted). In winter it stays bare.
  onPlaced(p) {
    super.onPlaced(p);
    if (!p || p.type !== 'patotara') return;
    this._stand(p);
    p._placedAt = this.game.playTime;
    this.placedFood.push(p);
    if (this.stage === 'winter') this._bareBerries(true);
  }

  // A pātōtara has been sprouted: once the kea have their nest, its berries draw any kea within
  // reach of them.
  onSprouted(t) {
    if (this._keaHome) this._lureKea(t.pos, (k) => this._near(k, t.pos, this.k.keaLife.lureRadius));
    this._beat('sprouted', { food: t });
  }

  // Trying to sprout one in winter: no berries now (the story points it out the first time).
  onSproutRefused(t) {
    if (this.beats.berriesBare) return;
    this.beats.berriesBare = true;
    this._beat('berries_bare', { food: t });
  }

  // Pātōtara the player grew and left unsprouted gets a reminder (once each), a while after
  // it went down: the 'unsprouted' moment.
  _remindUnsprouted() {
    if (this.stage === 'winter' || this.chase || this.won || this._winAt != null || this._loseAt != null) return;
    const now = this.game.playTime, wait = this._sec(this.k.sproutRemindSec);
    for (const p of this.placedFood) {
      if (!p.alive || !p.unsprouted || p._reminded || now - (p._placedAt || 0) < wait) continue;
      p._reminded = true;
      this._beat('unsprouted', { food: p });
      return;
    }
  }

  // Pātōtara fruits in summer: in winter every patch stands bare (no berries; moa can't eat it).
  _bareBerries(bare) {
    for (const p of this.game.simulation.placeables) {
      if (!p.alive || p.type !== 'patotara') continue;
      for (const plant of p.spawnedPlants) plant.dormant = bare;
    }
  }

  // ==========================================================================
  // THE KEA AFTER SUMMER: berries, their nest, and raids at real odds
  // ==========================================================================
  _updateKeaBand(dt) {
    const sim = this.game.simulation, K = this.k.keaLife, kn = this.sites.keaNest;
    const keas = this.keas.filter(k => k.alive), now = this.game.playTime;
    const mayRaid = now >= this._raidOkAt;

    // The family wandering near the kea's nest calls them all out at it.
    if (!this.keaRaid && mayRaid && keas.some(k => k.lifeScript.atHome())) {
      const intruder = this._living().find(m => this._near(m, kn, K.nestReach));
      if (intruder) this._lureKea(intruder.pos, (k) => k.lifeScript.atHome());
    }

    for (const k of keas) {
      const ks = k.lifeScript;
      if (!ks.lured) continue;
      // A storm in the way turns a coming kea back.
      if (ks.mode === 'fly' && sim.stormAt(k.pos.x, k.pos.y)) {
        ks.goHome();
        this._beat('kea_storm');
        continue;
      }
      // Landed: moa there means a raid; otherwise (or once they've raided) they feed on the
      // berries a while, then go home.
      if (ks.landed && !this.keaRaid) {
        ks.feedT = (ks.feedT || 0) + dt;
        if (mayRaid && !ks.raided && this._moaNear(ks.point, K.raidRadius) > 0) this._startKeaRaid(ks.point);
        else if (ks.feedT >= this._sec(K.feedSec)) ks.goHome();
      }
    }

    // The raid: a few seconds of the odds on show, then the roll.
    const r = this.keaRaid;
    if (r) {
      r.t += dt;
      r.kea = keas.filter(k => k.lifeScript.lured && k.lifeScript.landed && this._near(k, r.at, 40)).length;
      r.moa = this._moaNear(r.at, K.raidRadius);
      r.chance = this._raidChance(r.kea, r.moa);
      if (!keas.some(k => k.lifeScript.lured)) { this.keaRaid = null; return; }   // all turned back
      if (r.t >= this._sec(K.rollSec)) this._rollKeaRaid(r);
    }

    if (this._scare && now >= this._scare.until) this._scare = null;
  }

  // Send kea (those passing `which`, not already busy) to a point; they peck about there.
  _lureKea(at, which) {
    if (this.keaRaid) return;
    let n = 0;
    this.keas.forEach((k, i) => {
      if (!k.alive || k.lifeScript.lured || !which(k)) return;
      k.lifeScript.lure(at.x + Math.cos(i * 2.3) * 10, at.y + Math.sin(i * 2.3) * 7);
      n++;
    });
    if (n) this._beat('kea_lured', { at: { x: at.x, y: at.y }, count: n });
  }

  _startKeaRaid(at) {
    this.keaRaid = { at: { x: at.x, y: at.y }, t: 0, kea: 0, moa: 0, chance: 0 };
    this._beat('kea_warn', { at: this.keaRaid.at });
  }

  _rollKeaRaid(r) {
    const won = random() < r.chance, now = this.game.playTime;
    this.keaRaid = null;
    this._raidOkAt = now + this._sec(this.k.keaLife.restSec);
    const lured = this.keas.filter(k => k.alive && k.lifeScript.lured);
    if (won) {
      // The family scatters, and the kea eat the berries there before going home.
      this._scare = { from: { x: r.at.x, y: r.at.y }, until: now + this._sec(this.k.keaLife.scareSec) };
      for (const p of this.placedFood) if (p.alive && this._near(p, r.at, 50)) p.destroy();
      for (const k of lured) { k.lifeScript.feedT = 0; k.lifeScript.raided = true; }
      this._beat('kea_raid_won', { chance: r.chance });
    } else {
      for (const k of lured) k.lifeScript.goHome();
      this._beat('kea_raid_lost', { chance: r.chance });
    }
  }

  // The chance a raid works, at real odds.
  _raidChance(kea, moa) {
    const K = this.k.keaLife;
    if (kea <= 0) return 0;
    return Math.max(K.min, Math.min(K.max, K.base + K.perKea * kea - K.perMoa * moa));
  }

  // The summer raid's shown chance: set up so three kea against all five moa fail.
  _summerChance(moa) {
    return Math.max(0.05, Math.min(0.95, 0.95 - 0.18 * moa));
  }

  _moaNear(at, r) {
    let n = 0;
    for (const m of this.game.simulation.moas) if (m.alive && this._near(m, at, r)) n++;
    return n;
  }

  // A raid that worked scatters the family for a moment: they run from where it happened.
  chaseRole(m) {
    if (this._scare && this.family.includes(m)) return 'flee';
    return super.chaseRole(m);
  }
  threatFor(m) {
    if (this._scare && this.family.includes(m)) return { pos: this._scare.from };
    return super.threatFor(m);
  }

  // ==========================================================================
  // DRAWING
  // ==========================================================================
  // The kea's nest: a rocky burrow downslope (only once they live there).
  renderGround() {
    super.renderGround();
    const kn = this.sites && this.sites.keaNest;
    if (!kn || !this._keaHome || this.outroDone) return;
    const g = this.game;
    push();
    translate(kn.x, g._groundPaintY(kn.x, kn.y));
    noStroke();
    fill(70, 66, 58, 200);
    ellipse(0, 0, 20, 11);
    fill(28, 24, 20, 230);
    ellipse(0, 1, 10, 6);
    fill(140, 136, 126, 220);
    for (const [x, y, r] of [[-9, -2, 4], [8, -3, 5], [-4, 4, 3], [6, 4, 3.5]]) ellipse(x, y, r, r * 0.8);
    pop();
  }

  // A raid's odds over where it's happening: the chance in big figures (red when the kea have
  // the better of it, green when the moa do), the kea and moa counted under it, and a ring
  // round who counts.
  renderOver() {
    super.renderOver();   // (the walk's guide)
    const r = this.raid, kr = this.keaRaid;
    if (r && !r.done && this.beats.keaGang) {
      this._drawOdds(this.sites.friendNest, this.k.defence.radius, this._summerChance(r.count),
        this.keas.filter(k => k.alive).length, r.count);
    } else if (kr) {
      this._drawOdds(kr.at, this.k.keaLife.raidRadius, kr.chance, kr.kea, kr.moa);
    }
  }

  _drawOdds(at, radius, chance, kea, moa) {
    const g = this.game, px = 1 / CONFIG.viewZoom;   // one screen pixel, in world units
    const good = chance < 0.5;                       // the moa have the better of it
    const col = good ? [140, 230, 150] : [255, 140, 110];
    push();
    translate(at.x, g._groundPaintY(at.x, at.y));
    noFill();
    stroke(col[0], col[1], col[2], 200);
    strokeWeight(2 * px);
    drawingContext.setLineDash([8 * px, 6 * px]);
    ellipse(0, 0, radius * 2, radius * 1.24);
    drawingContext.setLineDash([]);
    // The odds, in screen-sized type above the ring.
    const y0 = -radius * 0.62 - 40 * px;
    textAlign(CENTER, CENTER);
    if (typeof FreckleFace !== 'undefined') textFont(FreckleFace);
    stroke(15, 20, 15, 230);
    strokeWeight(7 * px);
    strokeJoin(ROUND);
    fill(col[0], col[1], col[2]);
    textSize(52 * px);
    text(`RAID ${Math.round(chance * 100)}%`, 0, y0);
    fill(235, 240, 225);
    textSize(24 * px);
    text(`${kea} kea  vs  ${moa} moa`, 0, y0 + 40 * px);
    pop();
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  // A kea on a script, joining this.keas.
  _spawnKea(x, y) {
    const sim = this.game.simulation;
    const k = sim._createFromRegistry('kea', 'kea', x, y, null);
    if (!k) return null;
    if (!sim.otherEntities.kea) sim.otherEntities.kea = [];
    k.lifeScript = new KeaLife(k, this, { x, y });
    sim.otherEntities.kea.push(k);
    sim._invalidateCache();
    this.keas.push(k);
    return k;
  }

  // Our family hurries over to a spot, then feeds around it (the chick sticks with its mother).
  _callFamily(at, radius) {
    if (this.father && this.father.alive) this.father.lifeScript.walkRoute([{ x: at.x - 5, y: at.y + 3 }], 1.4, radius);
    if (this.mother && this.mother.alive) this.mother.lifeScript.walkRoute([{ x: at.x + 5, y: at.y + 3 }], 1.4, radius);
    if (this.chick && this.chick.alive) this.chick.lifeScript.follow(this.mother, 9);
  }

  // Our family feeds around a spot (the chick sticks with its mother).
  _grazeFamily(at, radius) {
    if (this.father && this.father.alive) this.father.lifeScript.graze(at.x - 5, at.y + 3, radius);
    if (this.mother && this.mother.alive) this.mother.lifeScript.graze(at.x + 5, at.y + 3, radius);
    if (this.chick && this.chick.alive) this.chick.lifeScript.follow(this.mother, 9);
  }

  // The pātōtara the player grew (and sprouted) most recently (not the story's patch).
  _newestFood() {
    for (let i = this.placedFood.length - 1; i >= 0; i--) {
      const p = this.placedFood[i];
      if (p.alive && !p.unsprouted) return p;
    }
    return null;
  }
}

// ============================================================================
// KeaLife: the kea, on a script
// ============================================================================
// Sits on its perch until the director sends it: comeTo (fly to a point and land, then sit or
// peck about), lungeThenLeave (a dash at the nest, driven off by the moa, then home), lure
// (drawn to berries or to moa near its nest; `lured` until it goes home again).
class KeaLife {
  constructor(kea, director, home) {
    this.k = kea;
    this.dir = director;
    this.home = { x: home.x, y: home.y };
    this.mode = 'sit';
    this.point = { x: home.x, y: home.y };
    this.then = 'sit';          // what it does once it lands: 'sit' or 'peck'
    this.landed = true;
    this.lured = false;
    this.feedT = 0;
    this._hop = 0;
  }

  // ---- Orders ----
  comeTo(x, y, then = 'sit') { this.mode = 'fly'; this.point = { x, y }; this.then = then; this.landed = false; }
  leave() { this.comeTo(this.home.x, this.home.y, 'sit'); }
  setHome(x, y) { this.home = { x, y }; }
  lure(x, y) { this.comeTo(x, y, 'peck'); this.lured = true; this.feedT = 0; }
  goHome() { this.lured = false; this.raided = false; this.feedT = 0; this.leave(); }
  atHome() { return !this.lured && this.landed && Math.hypot(this.k.pos.x - this.home.x, this.k.pos.y - this.home.y) < 25; }
  lungeThenLeave(at) { this.mode = 'lunge'; this.point = { x: at.x, y: at.y }; this.landed = false; }

  behave(sim, mauri, seasonManager, dt) {
    const k = this.k;
    // The Pouākai diving at this kea (it only hunts kea in the Free Play years): it takes off
    // away from it, and once clear flies back to where it was going.
    const e = this.dir.eagle;
    if (e && e.alive && e.hunting && e.target === k) {
      const ex = k.pos.x - e.pos.x, ey = k.pos.y - e.pos.y, ed = Math.hypot(ex, ey) || 1;
      if (ed < 90) {
        k.state = KERERU_STATE.FLYING;
        k.maxSpeed = 0.5;
        k.applyForce(k.seekPoint(k.pos.x + ex / ed * 60, k.pos.y + ey / ed * 60, 1.4));
        if (this.mode !== 'fly' && this.mode !== 'lunge') { this.then = this.mode; this.mode = 'fly'; }
        this.landed = false;
        k.edges();
        return;
      }
    }
    const dx = this.point.x - k.pos.x, dy = this.point.y - k.pos.y, d = Math.hypot(dx, dy);
    if (this.mode === 'fly' || this.mode === 'lunge') {
      k.state = KERERU_STATE.FLYING;
      k.maxSpeed = this.mode === 'lunge' ? 0.75 : 0.5;
      k.applyForce(k.seekPoint(this.point.x, this.point.y, 1, 18));
      const reach = this.mode === 'lunge' ? 14 : 5;
      if (d < reach) {
        if (this.mode === 'lunge') { this.leave(); return; }   // driven off: home
        this.mode = this.then;
        this.landed = true;
        k.vel.mult(0.2);
      }
    } else {
      // Sitting, or pecking about the berries in little hops.
      k.state = KERERU_STATE.PERCHED;
      k.maxSpeed = 0.15;
      k.vel.mult(0.8);
      if (this.mode === 'peck') {
        this._hop -= dt;
        if (this._hop <= 0) {
          this._hop = 50 + random(70);
          this._hopTo = { x: this.point.x + random(-9, 9), y: this.point.y + random(-6, 6) };
        }
        if (this._hopTo) k.applyForce(k.seekPoint(this._hopTo.x, this._hopTo.y, 0.4, 6));
      }
    }
    k.edges();
  }
}

MODULE_DIRECTORS.patotara = PatotaraDirector;
