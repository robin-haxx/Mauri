// ============================================================================
// THE FREE PLAY YEARS: PUKEPUKE & KOUKOU (FreePlayDirector)
// ============================================================================
// Five years on Module 1's land, after its story. The two upland moa families (Pukepuke's, and
// Koukou's next door) live on the tops while Pukepuke and Koukou grow up. Keep the two of them
// safe for five years and the level is won: the camera closes in as they come of age, take the
// empty nest, and mate. Built on PatotaraDirector (Module 1's land plan, kea band, raids and
// pātōtara rules) and ModuleDirector (storm paths, eagle attacks, the tarn):
//
//   each year   summer at the nests. Autumn: both families walk down together, along a path
//               of storms, to the waterhole. Winter by the water (storms fade, the pātōtara
//               stands bare, wharariki keeps). Spring: back up the trail to their nests.
//   food        wild tussock is poor fare up here (biteValue). Hungry families walk to the
//               pātōtara (once sprouted: a press and hold, as in the modules) and wharariki the
//               player grows near their home. A pair well fed for a while and left in peace
//               lays one egg at its nest in summer, once its last chick is a couple of years old.
//   the eagle   one Pouākai that hunts when it's hungry and takes whatever it can see. A moa
//               under a storm is hidden, so the eagle turns to the next prey in sight: another
//               moa (a giant moa, too), or a bird of the forest. A storm never drives it off.
//               Going without makes it bold (it looks further and dives sooner); at its boldest
//               it goes off to hunt elsewhere for a while. A meal settles it.
//   the others  the kea (Module 1's band, at their nest downslope), kākā, kōkako, and giant moa
//               on the low ground. Each breeds in its own season, a clutch a year
//               (BIRD_CALENDAR), and its young take years to come of age. Kākā breed mainly in
//               beech-mast years. Every one of them adds to the mauri income.
//   prompts     the essential actions (cover the families from the eagle, a storm path down and
//               up, new storms in winter, food for hungry families, sprouting grown pātōtara)
//               are asked for as they come up in the first year, and after that only once the
//               player has let one go for a while (see _activeNeeds and the 'prompt' moment).
//   the end     five years: the finale and the win. The Pouākai taking Pukepuke or Koukou ends
//               it sooner; a parent or a younger chick lost is a setback, not the end.
//
// Carried on from Module 1 ("Continue" on its win card, ModuleDirector.beginContinue) it
// keeps that module's land, sites, families, storms, food patches and mauri. Picked from the
// level select, it plans the same kind of land fresh. See levels/module_freeplay.js and
// levels/tutorial_module_freeplay.js.
// ============================================================================

// The other birds the year runs for (otherEntities types, and the giant moa among the moa).
const FREEPLAY_BIRDS = ['kea', 'kaka', 'kokako', 'south_island_giant_moa'];

// Each species' breeding year, after what's known of them today (New Zealand seasons: spring
// is Sep–Nov, summer Dec–Feb, winter Jun–Aug):
//   kea         nest from late winter (Jul–Jan), 2–4 eggs, about 3–4 weeks to hatch; first
//               breed at about 3 years.
//   kākā        (South Island) breed mostly in beech or podocarp mast years, from spring, 3–5
//               eggs; in an ordinary year few pairs try.
//   kōkako      2–3 eggs in spring–summer; breed from about 2.
//   giant moa   (Dinornis robustus) one egg (rarely two) in spring–summer; bone growth rings
//               say they took many years to grow up (up to about ten).
// lay: the season the clutch is laid in, between layFrom and layTo of the way through it.
// clutch: [min, max] eggs. hatchSec: in-game seconds to hatch. maturity: years to come of age.
// success: the share of due pairs that lay (a pair eating poorly lays less; see _birdFood).
// When they can: every: [min, max] years between a hen's clutches (any year she's due); or
// years: the years (1 = the first) the species breeds at all, and minLeft: only with at least
// this many of it left. (The upland moa don't breed in these five years: see _updateMoaBreeding.)
// cap: the most the land holds. moa: hatched by the simulation as a moa (not a flighted bird).
const BIRD_CALENDAR = {
  kea:    { lay: 'winter', layFrom: 0.35, layTo: 0.6, clutch: [2, 4], hatchSec: 12, maturity: 3,
            success: 1, every: [1, 2], cap: 10 },
  kaka:   { lay: 'spring', layFrom: 0.2, layTo: 0.6, clutch: [3, 4], hatchSec: 12, maturity: 3,
            success: 1, every: [1, 2], cap: 12 },
  kokako: { lay: 'spring', layFrom: 0.25, layTo: 0.6, clutch: [2, 3], hatchSec: 10, maturity: 2,
            success: 1, years: [5], minLeft: 2, cap: 10 },
  south_island_giant_moa: { lay: 'spring', layFrom: 0.2, layTo: 0.6, clutch: [1, 1], hatchSec: 15,
            maturity: 8, success: 1, years: [2, 4], cap: 8, moa: true }
};

// Tunables (the level's story.freeplay overrides them; nested blocks merge key by key).
const FREEPLAY_DEFAULTS = {
  years: 5,                // the win: Pukepuke and Koukou are grown after this many years
  quickSeasonSec: 30,      // a season whose goals are all done ends this soon (see seasonStep)
  chickSize: 0.42,         // a new chick, as a share of adult size...
  grownAge: 5,             // ...full size at this age (the families' other young)
  starsEndSize: 0.9,       // Pukepuke's and Koukou's size by the last year (the finale grows them on)
  wildBite: 0.35,          // a bite of wild browse (tussock) yields this share of its food...
  plantedBite: 0.8,        // ...and of food the player (or the story) grew, this
  feedAt: 52,              // a family this hungry (or one of its young) walks to grown food near home...
  fedAt: 18,               // ...and goes home again once it's this full
  criticalHunger: 80,      // this hungry, the player is warned to tap plants to draw them to food...
  // ...and a moa that stays at its fullest hunger (maxHunger) this long dies. (A chick goes from
  // fed to full hunger in under 40 s with nothing to eat, so this is most of a minute's grace.)
  starveSec: 60,
  feedReach: 230,          // how far from home a family will walk for food...
  winterFeedReach: 40,     // ...and in winter, by the water (so food is moved to them)
  downhillWharariki: 3,    // wharariki standing on the low ground, to move to where it's needed
  // Condition: rises while a moa is fed (hunger under goodBelow), falls while it's hungry
  // (over badAbove). A pair both at `lay` or more lays its egg.
  cond: { goodBelow: 35, badAbove: 65, upSec: 20, downSec: 30, lay: 0.75, start: 0 },
  moaBreed: false,         // whether the families lay (off: see _updateMoaBreeding)
  layBefore: 0.6,          // no new egg after this much of summer (it must hatch before autumn)
  breedGapYears: 2,        // a pair lays again once its youngest chick is this old
  nestReach: 30,           // a pair this close to its nest can lay there
  mauriPerBird: 0.04,      // mauri a second for each bird (and giant moa) on the land
  mastChance: 0.3,         // the chance of a beech-mast year (never two in a row)
  startBirds: { kaka: 4, kokako: 4 },
  startGiantMoa: 6,        // giant moa on the low ground (three pairs)
  forestTrees: 45,         // the forest is filled out to about this many beech and fern
  kokakoTerritory: 55,     // kōkako territories, sized to a forest this small (theirs is 140 elsewhere)
  kea: { forageEverySec: 25, berryRange: 200 },   // kea go out for berries near their nest
  // The prompts: at once in the first year; after that only once a need has stood laterSec
  // (the eagle's is coverLeadSec before it dives, since its "last chance" is shorter than that).
  prompt: { laterSec: 10, coverLeadSec: 2.5 },
  // The finale: the camera closes in on the empty nest, Pukepuke and Koukou walk to it, grow
  // to full size over growSec, court for courtSec, and lay their first egg.
  ending: { zoom: 3, zoomSec: 2.5, walkSec: 8, growSec: 3, courtSec: 4 },
  // Moments (see _startMoment): a hatching or a catch, the world held still while the camera
  // closes in (to zoom, over inSec) and big words say what happened; back out over outSec.
  // A catch shows the Pouākai's dive for diveSec, then it flies on as its prey fades over fadeSec.
  // The same species hatching again within dupSec isn't shown twice (a clutch hatches together).
  moment: { zoom: 2.4, inSec: 0.7, outSec: 0.9, hatchSec: 2.5, catchSec: 2.8, diveSec: 0.9, fadeSec: 1.1, dupSec: 12 },
  eagle: {
    hungerPerSec: 0.75,    // hunger it gains a second (0..100): a meal a minute or two apart
    startHunger: 25,       // (its first hunt comes about 45 seconds in)
    huntAt: 60,            // it hunts once this hungry
    lookRange: 170,        // how far it sees prey from where it's flying...
    lookPerBold: 50,       // ...and how much further for each step of boldness
    boldMax: 3,
    graceSec: 7,           // "last chance" before it dives at a family moa it has seen...
    gracePerBold: 1.2,     // ...less for each step of boldness...
    graceMin: 3.5,         // ...but never less than this
    moaPref: 1.6,          // moa seem this much nearer than a bird (it prefers them)...
    youngPref: 1.25,       // ...and a young moa this much nearer again
    birdFloor: 0,          // it leaves a species' last this-many alone (none: no species is spared)
    birdChaseSec: 7,       // prey that stays ahead this long gets away
    birdFeed: 60,          // hunger a bird takes off (a moa takes it all)
    restSec: 14,           // it rests at its lookout after a meal
    seekSec: 10,           // hungry with nothing in sight this long, it grows bolder
    roamSec: 14,           // how long it circles one part of its range before moving on
    // At its boldest and still with nothing in sight for awayAfter more looks, it flies off to
    // hunt elsewhere in its range, back awaySec later with only backHunger.
    awayAfter: 2, awaySec: 35, backHunger: 25
  }
};

class FreePlayDirector extends PatotaraDirector {
  constructor(game, levelDef) {
    super(game, levelDef);
    const o = (levelDef.story && levelDef.story.freeplay) || {}, d = FREEPLAY_DEFAULTS;
    this.fp = Object.assign({}, d, o, {
      cond: Object.assign({}, d.cond, o.cond),
      startBirds: Object.assign({}, d.startBirds, o.startBirds),
      kea: Object.assign({}, d.kea, o.kea),
      prompt: Object.assign({}, d.prompt, o.prompt),
      ending: Object.assign({}, d.ending, o.ending),
      moment: Object.assign({}, d.moment, o.moment),
      eagle: Object.assign({}, d.eagle, o.eagle)
    });
    this._moment = null;        // the moment playing (a hatching, a catch), see _startMoment
    this._momentQueue = [];
    this._hatchShownAt = {};    // species -> playTime its last hatching was shown
    this.year = 0;              // years since the free play began (the season dial shows year + 1)
    this.cycle = 0;
    this.pukepuke = null;
    this.koukou = null;
    this.moaEggs = [];          // the families' eggs in their nests: { egg, pair, age }
    this.keaEggs = [];          // kea eggs in their nest: { egg, age }
    this.birdClutches = [];     // clutches due this season: { type, mother, stage, at, n }
    this.mast = false;          // a beech-mast year
    this._mastLast = false;
    this.chicksRaised = 0;
    this._groupFeed = {};       // family key -> the food patch it is feeding at
    this._lostThisSeason = false;
    this._scanT = 0;
    this._keaForageT = 0;
    this._stormsCalled = 0;     // storms the player has called (moves are in sim.stats.stormsMoved)
    this._needs = {};           // the essential actions standing undone: name -> { since, fired }
    this._needT = 0;
    this._ending = null;        // the finale, once the five years are up
    // The eagle
    this.eagleHunger = this.fp.eagle.startHunger;
    this.boldness = 0;
    this.birdHunt = null;       // a dive at a bird or a giant moa: { prey, t }
    this._awayUntil = 0;        // off hunting elsewhere in its range until then
    this._fruitless = 0;        // looks at its boldest that found nothing
    this._eagleRestUntil = 0;
    this._seekT = 0;
    this._lookT = 0;
    this._roam = null;
    this._roamT = 0;
    this._roamIdx = 0;
  }

  // ==========================================================================
  // THE LAND: Module 1's, as it was left (carried on), else planned the same way
  // ==========================================================================
  planTerrain(t) {
    const h = this.handoff;
    if (h && h.sites) {
      this._planningGrid(t);   // (the route search's grid, and the forest for the birds)
      this.sites = h.sites;
      return this._waterFeatures(t, this.sites.tarn, this.sites.path);
    }
    return super.planTerrain(t);
  }

  // ==========================================================================
  // SETUP
  // ==========================================================================
  setup() {
    const g = this.game, sim = g.simulation, s = this.sites, cfg = this.cfg, h = this.handoff, F = this.fp;

    // The nests: nesting sites the simulation draws. Ours, the friends', and the empty one
    // Pukepuke and Koukou take at the end.
    const site = (p) => {
      const ns = new NestingSite(p.x, p.y, { radius: this.k.nestRadius, habitat: 'open' });
      ns.hideClutch = true;
      sim.nestingSites.push(ns);
      return ns;
    };
    site(s.nest);
    site(s.friendNest);
    this._thirdSite = site(s.thirdNest);

    // The families: who came over from Module 1, else two pairs and their young.
    const list = (h && h.moa && h.moa.length) ? h.moa : [
      { group: 'ours', role: 'father', female: false }, { group: 'ours', role: 'mother', female: true },
      { group: 'ours', role: 'chick', female: random() < 0.5 },
      { group: 'friends', role: 'father', female: false }, { group: 'friends', role: 'mother', female: true },
      { group: 'friends', role: 'chick', female: null }
    ];
    for (const d of list) {
      const ours = d.group !== 'friends', at = ours ? s.nest : s.friendNest;
      const group = ours ? this.family : this.friends;
      const female = d.female == null ? random() < 0.5 : d.female;
      const m = this._spawnMoa(at.x + random(-10, 10), at.y + random(-6, 6), female, d.role,
        { group, chickSize: F.chickSize });
      m._cond = F.cond.start;
      if (d.role === 'father') { if (ours) this.father = m; else this.friendFather = m; }
      else if (d.role === 'mother') { if (ours) this.mother = m; else this.friendMother = m; }
      else if (ours && !this.pukepuke) this.chick = this.pukepuke = m;
      else if (!ours && !this.koukou) this.friendChick = this.koukou = m;
    }
    // (Should either of the two be missing, they're here all the same: the years are theirs.)
    if (!this.pukepuke) this.chick = this.pukepuke = this._spawnMoa(s.nest.x + 8, s.nest.y + 6, random() < 0.5, 'chick', { group: this.family });
    if (!this.koukou) this.friendChick = this.koukou = this._spawnMoa(s.friendNest.x + 8, s.friendNest.y + 6, true, 'chick', { group: this.friends });
    // The other sex to each other, so they can pair up at the end (and Koukou the size for it).
    this.koukou.isFemale = !this.pukepuke.isFemale;
    const bySex = this.koukou.speciesConfig.sizeBySex;
    if (bySex) this.koukou.baseSize = this.koukou.isFemale ? bySex.female : bySex.male;
    this.pukepuke.lifeScript.name = 'Pukepuke';
    this.koukou.lifeScript.name = 'Koukou';
    // Their sizes as the years begin (Pukepuke a year older), growing to starsEndSize by the end.
    this.pukepuke._startSize = 0.6;
    this.koukou._startSize = 0.52;
    this._sizeStars();

    // The kea band (Strongbeak, Skraak and Huft-Tuft, and a mate for one of them), at home in
    // their nest downslope: two pairs, so one loss doesn't end their breeding.
    const kn = s.keaNest;
    for (let i = 0; i < 4; i++) {
      const x = kn.x + Math.cos(i * 1.6) * 12, y = kn.y + Math.sin(i * 1.6) * 8;
      const k = this._spawnKea(x, y);
      if (!k) continue;
      k.lifeScript.setHome(x, y);
      k.isFemale = i === 1 || i === 2;
      k._ageYears = BIRD_CALENDAR.kea.maturity + 2 + i;
    }
    this.kea = this.keas[0] || null;
    this._keaHome = true;

    // The birds of the forest (and enough forest for them), and the giant moa on the low ground.
    this._spawnForestBirds();
    this._thickenForest();
    this._spawnGiantMoa();

    // The storms and the food on the map: as Module 1 left them, else the storms on the high
    // ground, a pātōtara patch (in fruit) between the nests and wharariki by the waterhole.
    const placed = (h && h.placed) || null;
    if (placed && placed.length) {
      for (const p of placed) {
        if (p.type === 'Storm') { sim.addStandingStorm(p.x, p.y, cfg.stormRadius); continue; }
        const patch = this._standingPatch(p.type, p);
        if (p.type !== 'patotara') continue;
        if (p.sprouted !== false && patch.unsprouted) patch.sprout();
        this.placedFood.push(patch);
      }
    } else {
      for (const p of s.storms) sim.addStandingStorm(p.x, p.y, cfg.stormRadius);
      const mid = { x: (s.nest.x + s.friendNest.x) / 2, y: (s.nest.y + s.friendNest.y) / 2 + 22 };
      const patch = this._standingPatch('patotara', mid);
      if (patch.unsprouted) patch.sprout();
      this.placedFood.push(patch);
      this._standingPatch('wharariki', { x: s.shore.x, y: s.shore.y });
    }
    // A little wild wharariki along the shore, for winter.
    this._sowShore('wharariki', 4);
    // Koukou's family winters across the water from ours, with no food by it: the player moves
    // one of the wharariki standing downhill over to them (see _activeNeeds: friendsFood).
    // (Ours always has one by its winter spot: carried over from Module 1, the one moved to
    // the waterhole may be round the shore from it.)
    if (!sim.placeables.some(p => p.alive && p.type === 'wharariki' &&
        Math.hypot(p.pos.x - s.shore.x, p.pos.y - s.shore.y) < F.winterFeedReach - 10)) {
      this._standingPatch('wharariki', { x: s.shore.x, y: s.shore.y });
    }
    if (!s.friendWinter) s.friendWinter = this._friendWinterSpot();
    this._plantDownhillWharariki(F.downhillWharariki);

    // The Pouākai, out on its rounds.
    this._spawnEagle(s.eyrie);
    this.eagle.lifeScript.patrol = true;
    this.eagle.lifeScript.mode = 'patrol';
    this.eagle.redWhenHunting = true;   // outlined red while it hunts (HaastsEagle.render)
    sim._invalidateCache();

    if (h && h.mauri != null && g.mauri) g.mauri.mauri = Math.max(g.mauri.mauri, h.mauri);
    g.cameraTo({ zoom: 1 }, 1);

    this._enterStage(g.seasonManager.currentKey);
    this._openingAt = this._sec(h ? 1.2 : 0.8);
  }

  // The founding birds of the forest, scattered through it as grown birds.
  _spawnForestBirds() {
    const sim = this.game.simulation, G = this._grid;
    const cells = [];
    if (G) for (let i = 0; i < G.cols * G.rows; i++) if (G.forest[i] && G.walk[i]) cells.push(i);
    const at = (i) => ({ x: ((i % G.cols) + 0.5) * G.step, y: (((i / G.cols) | 0) + 0.5) * G.step });
    if (cells.length) {
      let x = 0, y = 0;
      for (const i of cells) { const p = at(i); x += p.x; y += p.y; }
      this._forestCentre = { x: x / cells.length, y: y / cells.length };
    } else {
      this._forestCentre = this.sites.keaNest;
    }
    for (const type in this.fp.startBirds) {
      const n = this.fp.startBirds[type], B = BIRD_CALENDAR[type];
      if (!sim.otherEntities[type]) sim.otherEntities[type] = [];
      for (let i = 0; i < n; i++) {
        const p = cells.length ? at(cells[Math.floor(random(cells.length))]) : this._forestCentre;
        const b = sim._createFromRegistry(type, type, p.x + random(-4, 4), p.y + random(-4, 4), null);
        if (!b) continue;
        b.isFemale = i % 2 === 0;
        b.mature = true;
        b._ageYears = (B ? B.maturity : 2) + Math.floor(random(4));
        this._settleBird(b);
        sim.otherEntities[type].push(b);
      }
    }
    sim._invalidateCache();
  }

  // Giant moa: grown pairs on the lowest open ground (they're browsers of the low country).
  _spawnGiantMoa() {
    const sim = this.game.simulation, G = this._grid, type = 'south_island_giant_moa';
    const B = BIRD_CALENDAR[type];
    const low = [];
    if (G) {
      for (let i = 0; i < G.cols * G.rows; i++) {
        if (!G.walk[i]) continue;
        const x = ((i % G.cols) + 0.5) * G.step, y = (((i / G.cols) | 0) + 0.5) * G.step;
        if (x < 30 || y < 30 || x > G.W - 30 || y > G.H - 30) continue;
        low.push({ x, y, e: G.elev[i] });
      }
      low.sort((a, b) => a.e - b.e);
    }
    const pool = low.slice(0, Math.max(1, Math.floor(low.length * 0.25)));
    for (let i = 0; i < this.fp.startGiantMoa; i++) {
      const p = pool.length ? pool[Math.floor(random(pool.length))] : this.sites.shore;
      const m = sim._createFromRegistry('moa', type, p.x, p.y, Moa);
      if (!m) continue;
      m.isFemale = i % 2 === 0;
      m.age = MOA_AGE.ADULT_MIN + 1;
      m.updateAge(0);
      m.homeRange.set(p.x, p.y);
      m._ageYears = B.maturity + Math.floor(random(6));
      sim.moas.push(m);
    }
    sim._invalidateCache();
  }

  // Where Koukou's family winters: on the tarn's shore (in the water's reach), round from ours
  // and away from any wharariki already there, so their food has to be brought.
  _friendWinterSpot() {
    const s = this.sites, t = this.game.terrain, r = s.tarnR + 12;
    const a0 = Math.atan2(s.shore.y - s.tarn.y, s.shore.x - s.tarn.x);
    const reach = this.fp.winterFeedReach + 6;
    const food = this.game.simulation.placeables.filter(p => p.alive && p.type === 'wharariki');
    for (const off of [Math.PI, 2.7, -2.7, 2.3, -2.3, 1.9, -1.9]) {
      const want = { x: s.tarn.x + Math.cos(a0 + off) * r, y: s.tarn.y + Math.sin(a0 + off) * r };
      const p = this._walkableNear(want.x, want.y, 12, 20);
      if (!p || Math.hypot(p.x - s.shore.x, p.y - s.shore.y) < this.fp.winterFeedReach + 6) continue;
      if (food.some(f => Math.hypot(f.pos.x - p.x, f.pos.y - p.y) < reach)) continue;
      return p;
    }
    return { x: s.shore.x, y: s.shore.y };
  }

  // Wharariki standing on the low ground (in the lowest third of what can be walked), well
  // away from the water and from each other: the ones to move where a family needs food.
  _plantDownhillWharariki(n) {
    const G = this._grid, s = this.sites;
    if (!G || !n) return;
    const cells = [];
    for (let i = 0; i < G.cols * G.rows; i++) {
      if (!G.walk[i] || G.nearWall[i]) continue;
      const x = ((i % G.cols) + 0.5) * G.step, y = (((i / G.cols) | 0) + 0.5) * G.step;
      if (x < 30 || y < 30 || x > G.W - 30 || y > G.H - 30) continue;
      cells.push({ x, y, e: G.elev[i] });
    }
    cells.sort((a, b) => a.e - b.e);
    const low = FreePlayDirector._shuffled(cells.slice(0, Math.max(1, Math.floor(cells.length / 3))));
    const away = [s.tarn, s.shore, s.friendWinter].filter(Boolean), placed = [];
    for (const c of low) {
      if (placed.length >= n) break;
      if (away.some(q => Math.hypot(q.x - c.x, q.y - c.y) < 80)) continue;
      if (placed.some(q => Math.hypot(q.x - c.x, q.y - c.y) < 50)) continue;
      placed.push(c);
      this._standingPatch('wharariki', c);
    }
  }

  // A bird of the forest kept to it: kōkako hold territories sized to a forest this small.
  _settleBird(b) {
    if (b.speciesKey === 'kokako') b._territoryRadius = this.fp.kokakoTerritory;
  }

  // The montane forest in a window this small holds only a handful of trees; the birds live on
  // beech and fern (FOREST_TREES), so it's filled out to about forestTrees.
  _thickenForest() {
    const g = this.game, t = g.terrain, sim = g.simulation, G = this._grid;
    if (!G) return;
    let have = 0;
    for (const p of sim.plants) if (p.alive && FOREST_TREES.has(p.type)) have++;
    const cells = [];
    for (let i = 0; i < G.cols * G.rows; i++) if (G.forest[i] && G.walk[i]) cells.push(i);
    for (let n = 0; n < this.fp.forestTrees - have && cells.length; n++) {
      const i = cells[Math.floor(random(cells.length))];
      const x = ((i % G.cols) + 0.5) * G.step + random(-3, 3), y = (((i / G.cols) | 0) + 0.5) * G.step + random(-3, 3);
      // (Not hard against the map's edge, where birds can't get close enough to perch.)
      if (!t.isWalkable(x, y) || x < 24 || y < 24 || x > t.mapWidth - 24 || y > t.mapHeight - 24) continue;
      const p = new Plant(x, y, random() < 0.6 ? 'beech' : 'fern', t, t.getBiomeAt(x, y).key);
      p.growth = random(0.7, 1);
      sim.addPlant(p);
    }
  }

  // ==========================================================================
  // EACH FRAME
  // ==========================================================================
  update(dt) {
    this._dt = dt;
    if (this._ending) { this._updateEnding(dt); return; }
    if (this._loseAt != null) {
      if (this.game.playTime >= this._loseAt) this._lose();
      return;
    }
    this.stageTime += dt;
    if (this._openingAt != null && this.stageTime >= this._openingAt) {
      this._openingAt = null;
      this._beat('opening', { pukepuke: this.pukepuke, koukou: this.koukou });
    }
    this._income(dt);
    this._updateWeather(dt);
    this._updateCondition(dt);
    this._updateStarving(dt);
    this._updateMoaEggs(dt);
    this._updateBirdYear(dt);
    if (this.stage === 'summer') this._updateSummer();
    else if (this.stage === 'autumn') this._updateAutumn();
    else if (this.stage === 'winter') this._updateWinter();
    else if (this.stage === 'spring') this._updateSpring();
    this._updateJourney(dt);
    this._updateHunt(dt);
    this._updateChase(dt);
    this._updateKeaForage(dt);
    this._updateKeaBand(dt);
    this._updateNeeds(dt);
  }

  // A season can't end before its key moment: summer waits for any egg in a nest to hatch,
  // autumn for the families to reach the waterhole (its clock stands still on the walk), and
  // spring for them to be home again. Then the clock runs on into the next.
  _seasonMustWait() {
    if (this.stage === 'summer') return this.moaEggs.some(r => r.egg.alive);
    if (this.stage === 'autumn') return !this.beats.arrived;
    if (this.stage === 'spring') return !this.beats.home;
    return false;
  }

  // A season runs its full length (economy.seasonDuration) unless its goals are all done: then
  // it ends soon after quickSeasonSec, running through what's left of it (and the seasonal
  // crossfade at its end) in about a second and a half.
  seasonStep(dt) {
    if (this._ending) return 0;
    const step = super.seasonStep(dt), sm = this.game.seasonManager, goals = this.game.goals || [];
    if (step > 0 && goals.length && goals.every(gl => gl.achieved) &&
        sm.timer + step >= this._sec(this.fp.quickSeasonSec)) {
      if (!this._quickRate) this._quickRate = Math.max(step, (CONFIG.seasonDuration - sm.timer) / this._sec(1.5));
      return Math.max(step, this._quickRate);
    }
    return step;
  }
  clockStopped() { return !!this._ending || super.clockStopped(); }
  inputLocked() { return !!this._ending || !!this._moment || super.inputLocked(); }

  // Spring into summer: a new year, or, the five years up, the finale.
  onSeasonChange(key) {
    if (this._ending || this.won) return;
    if (key === 'summer' && this.stage) {
      if (this.year + 1 >= this.fp.years) { this._beginEnding(); return; }
      this._newYear();
    }
    this._enterStage(key);
  }

  _enterStage(key) {
    this.stage = key;
    this.stageTime = 0;
    this._quickRate = 0;   // (see seasonStep)
    this.beats = {};
    this._lostThisSeason = false;
    this._groupFeed = {};
    const W = this.cfg.weather;
    if (W && key === W.from && !this._weatherOn) {
      this._weatherOn = true;
      this._weatherT = this._sec(W.everySec - W.firstSec);
    }
    this.game.goals = this._goalsFor(key).map(gd => ({
      id: gd.id, name: gd.name, reward: gd.reward ?? this.cfg.goalReward,
      achieved: false, condition: () => false
    }));
    if (key === 'summer') this._beginSummer();
    else if (key === 'autumn') this._beginAutumn();
    else if (key === 'winter') this._beginWinter();
    else if (key === 'spring') this._beginSpring();
    this._scheduleBirdClutches(key);
  }

  // Each season's goals. (The families don't breed in these five years: see _updateMoaBreeding.)
  _goalsFor(key) {
    if (key === 'summer') return [{ id: 'fed', name: "Keep the families well fed" }];
    if (key === 'autumn') return [{ id: 'refuge', name: "Lead the families down to the waterhole" }];
    if (key === 'winter') {
      const g = [{ id: 'winter', name: "Keep everyone safe until spring" }];
      if (this.friends.some(m => m.alive)) g.push({ id: 'friendsFed', name: "Move a wharariki to Koukou's family" });
      return g;
    }
    return [{ id: 'home', name: "Lead them back up to their nests" }];
  }

  // ==========================================================================
  // THE YEAR TURNS (spring into summer)
  // ==========================================================================
  _newYear() {
    const F = this.fp;
    this.year++;
    this.cycle = this.year;

    // The young are a year older (and bigger); Pukepuke and Koukou grow toward the finale.
    for (const m of this._living()) {
      const ls = m.lifeScript;
      if (ls.ageYears != null) this._setAge(m, ls.ageYears + 1);
    }
    this._sizeStars();

    // A beech-mast year now and then (never two running): the forest fruits heavily.
    this.mast = !this._mastLast && random() < F.mastChance;
    this._mastLast = this.mast;
    this.game._mastYearTargetCycle = this.mast ? this.cycle : -1;

    this._ageBirds();

    const left = F.years - this.year;
    this.game.addNotification(left > 1 ? `Year ${this.year + 1}: ${left} years until Pukepuke and Koukou are grown.`
                                       : `Year ${this.year + 1}: the last year before Pukepuke and Koukou are grown.`, 'info');
    if (this.mast) this.game.addNotification("A mast year: the beech is heavy with seed.", 'info');
    this._beat('new_year', { year: this.year });
    if (this.mast) this._beat('mast');
  }

  // ==========================================================================
  // SEASONS
  // ==========================================================================
  _beginSummer() {
    this._settleAtNests();
  }

  _updateSummer() {
    this._updateFeeding();
    this._updateMoaBreeding();
    // (No pair to breed this year: summer's goal is a well-fed family.)
    if (!this.beats.fed && this.game.goals.some(gl => gl.id === 'fed')) {
      const live = this._living();
      if (live.length && live.every(m => (m._cond || 0) >= 0.6)) {
        this.beats.fed = true;
        this._achieve('fed');
      }
    }
  }

  _beginAutumn() {
    this.game.cameraTo({ zoom: 1 }, 150);
    this._gatherAll();
    // A storm gathers a little way down the trail, a wisp till the walk is near.
    this.autumnStorm = this._trailStorm();
    this._swollen = false;
    if (this.autumnStorm) this.autumnStorm.swellTo(this.cfg.stormRadius * this.cfg.autumnStormStart, 1);
    this._journeyAt = Infinity;
    this._autumnTalkAt = this._sec(this.cfg.journey.talkDelaySec);
  }

  _updateAutumn() {
    const b = this.beats;
    if (!b.talked && this.stageTime >= this._autumnTalkAt) {
      b.talked = true;
      this._journeyAt = this.stageTime + this._sec(this.cfg.journey.startDelaySec);
      this.swellAutumnStorm();
      this._actionsAt = this._stormActions();
      this._beat('autumn_path', { storm: this.autumnStorm, first: this.year === 0 });
    }
    if (!b.journey && this.stageTime >= this._journeyAt) {
      b.journey = true;
      this._startJourney('down');
      this._beat('journey_start', { dir: 'down' });
    }
  }

  _beginWinter() {
    // Winter storms fade away (moving one doesn't save it): new ones have to be called.
    for (const p of this.game.simulation.placeables) {
      if (p.alive && p.standing && p.type === 'Storm') p.fadeOver(this.cfg.winterStormLifeSec, false);
    }
    this._bareBerries(true);   // pātōtara fruits in the warm months: bare now
    this._settleAtTarn();
    this._beat('winter', { first: this.year === 0 });
  }

  _updateWinter() {
    this._updateFeeding();
    // Koukou's family has food by them (a wharariki moved over).
    if (!this.beats.friendsFed && this._friendsHaveFood()) {
      this.beats.friendsFed = true;
      this._achieve('friendsFed');
    }
    if (!this.beats.survived && this.game.seasonManager.progress >= 0.8) {
      this.beats.survived = true;
      if (!this._lostThisSeason) this._achieve('winter');
    }
  }

  _beginSpring() {
    for (const p of this.game.simulation.placeables) {
      if (p.alive && p.standing && p.fading) { p.fading = false; p.life = p.maxLife = 1; }
    }
    this._bareBerries(false);
    this._journeyAt = this._sec(this.cfg.journey.springDelaySec);
    this.game._stormCooldownUntil = 0;   // no recharge this season (stormCooldownFree)
    this._beat('spring', { first: this.year === 0 });
  }

  _updateSpring() {
    const b = this.beats;
    if (!b.journey && this.stageTime >= this._journeyAt) {
      b.journey = true;
      this._actionsAt = this._stormActions();
      this._startJourney('up');
      this._beat('journey_start', { dir: 'up' });
    }
    if (b.home) this._updateFeeding();
  }

  // ==========================================================================
  // THE FAMILIES
  // ==========================================================================
  _living() {
    const out = [];
    for (const list of [this.family, this.friends]) for (const m of list) if (m.alive) out.push(m);
    return out;
  }

  // Each family, where it lives this time of year, and its parents.
  _groups() {
    const s = this.sites, w = this._wintering();
    return [
      { key: 'ours', members: this.family, home: w ? s.shore : s.nest, nest: s.nest,
        father: this.father, mother: this.mother },
      { key: 'friends', members: this.friends, home: w ? (s.friendWinter || s.shore) : s.friendNest, nest: s.friendNest,
        father: this.friendFather, mother: this.friendMother }
    ];
  }

  // The pairs that could lay this year (both alive).
  _breedingPairs() {
    return this._groups().filter(g => g.father && g.mother && g.father.alive && g.mother.alive);
  }

  // Whether a pair is free to lay: not while its youngest chick is still small (a chick takes a
  // couple of years' care; breedGapYears). Pukepuke and Koukou don't hold their parents back.
  _pairFree(p) {
    return !p.members.some(m => m.alive && m !== p.father && m !== p.mother && m !== this.pukepuke &&
      m !== this.koukou && (m.lifeScript.ageYears ?? 99) < this.fp.breedGapYears);
  }

  _wintering() {
    return this.stage === 'winter' || (this.stage === 'autumn' && this.beats.arrived) ||
           (this.stage === 'spring' && !this.beats.home);
  }

  // Who leads the walk: Mama Moa, else whichever grown moa is left, else the eldest young.
  _leader() {
    const lead = [this.mother, this.father, this.friendMother, this.friendFather].find(m => m && m.alive);
    if (lead) return lead;
    return [this.pukepuke, this.koukou].find(m => m && m.alive) || this._living()[0] || null;
  }

  // The young: Pukepuke and Koukou (until the finale), and any chick under grownAge.
  _isYoung(m) {
    if (!m) return false;
    if (m === this.pukepuke || m === this.koukou) return !this._grownUp;
    const a = m.lifeScript && m.lifeScript.ageYears;
    return a != null && a < this.fp.grownAge;
  }

  // A chick's age, and its size from it (full size at grownAge).
  _setAge(m, years) {
    const F = this.fp;
    m.lifeScript.ageYears = years;
    m.size = m.baseSize * Math.min(1, F.chickSize + (1 - F.chickSize) * years / F.grownAge);
  }

  // Pukepuke's and Koukou's sizes: from where they started to starsEndSize by the last year.
  _sizeStars() {
    const F = this.fp, k = Math.min(1, this.year / Math.max(1, F.years - 1));
    for (const m of [this.pukepuke, this.koukou]) {
      if (!m) continue;
      m.size = m.baseSize * (m._startSize + (F.starsEndSize - m._startSize) * k);
    }
  }

  _nameOf(m) {
    if (!m) return 'a moa';
    if (m.lifeScript && m.lifeScript.name) return m.lifeScript.name;
    if (m === this.father) return 'Papa Moa';
    if (m === this.mother) return 'Mama Moa';
    if (m === this.friendFather) return "Koukou's papa";
    if (m === this.friendMother) return "Koukou's mama";
    return 'a young moa';
  }

  // Home for the summer: the parents feed round their nest (a father with an egg sits on it),
  // the young stay by their mothers. Pukepuke sticks with Koukou.
  _settleAtNests() {
    for (const g of this._groups()) this._settleGroup(g);
    this._pairTheYoung();
  }

  _settleGroup(g) {
    const live = g.members.filter(m => m.alive);
    if (!live.length) return;
    if (this._wintering()) {
      // Close along the shore, within the water's reach (it slows hunger and feeds them a little):
      // each family at its own spot (Koukou's across the water from ours).
      const s = g.home;
      for (const m of live) if (!this._isYoung(m)) m.lifeScript.graze(s.x + random(-4, 4), s.y + random(-3, 3), 12);
    } else {
      const n = g.nest, sitting = this.moaEggs.some(r => r.egg.alive && r.pair.key === g.key);
      if (g.father && g.father.alive) {
        if (sitting) g.father.lifeScript.stay(n.x - 6, n.y + 4, 7);
        else g.father.lifeScript.graze(n.x - 5, n.y + 3, 22);
      }
      if (g.mother && g.mother.alive) g.mother.lifeScript.graze(n.x + 6, n.y + 4, 26);
    }
    this._followMother(g);
  }

  // The young follow their mother (else any grown moa of the family, else of any family).
  _followMother(g) {
    const live = g.members.filter(m => m.alive);
    const lead = (g.mother && g.mother.alive) ? g.mother
      : (live.find(m => !this._isYoung(m)) || this._living().find(m => !this._isYoung(m)));
    for (const m of live) if (this._isYoung(m) && lead && m !== lead) m.lifeScript.follow(lead, 9);
  }

  // Pukepuke keeps close to Koukou (and not on a walk).
  _pairTheYoung() {
    const P = this.pukepuke, K = this.koukou;
    if (!P || !K || !P.alive || !K.alive) return;
    P.lifeScript.follow(K, 10);
  }

  // Autumn: everyone to our nest, to set off down together.
  _gatherAll() {
    const n = this.sites.nest;
    for (const m of this._living()) {
      if (this._isYoung(m)) continue;
      m.lifeScript.walkRoute([{ x: n.x + random(-14, 14), y: n.y + random(-8, 8) }], 1.2, 12);
    }
    for (const g of this._groups()) this._followMother(g);
    this._pairTheYoung();
  }

  // Winter quarters: everyone feeding along the tarn's shore.
  _settleAtTarn() {
    for (const g of this._groups()) this._settleGroup(g);
    this._pairTheYoung();
  }

  // After a loss, put everyone back where this time of year has them.
  _resettle() {
    if (this.journey && this.journey.active) this._formColumn(this._leader());
    else if (this._wintering()) this._settleAtTarn();
    else this._settleAtNests();
  }

  // ==========================================================================
  // THE WALK: both families together, from storm to storm
  // ==========================================================================
  _startJourney(dir) {
    const s = this.sites, lead = this._leader();
    if (!lead) return;
    const goal = dir === 'down' ? s.shore : { x: s.nest.x, y: s.nest.y };
    this.journey = {
      dir, goal, active: true, time: 0, waypoint: null, rethink: 0,
      restUntil: 0, waited: 0, goAlone: false, progress: 0,
      startDist: Math.max(1, Math.hypot(lead.pos.x - goal.x, lead.pos.y - goal.y))
    };
    this._groupFeed = {};
    this._formColumn(lead);
  }

  // One line behind the leader: the young first (eldest first), then the grown moa.
  _formColumn(lead) {
    if (!lead) return;
    const rest = this._living().filter(m => m !== lead);
    rest.sort((a, b) => {
      const ya = this._isYoung(a), yb = this._isYoung(b);
      if (ya !== yb) return ya ? -1 : 1;
      return (b.lifeScript.ageYears ?? 9) - (a.lifeScript.ageYears ?? 9);
    });
    let prev = lead;
    for (const m of rest) {
      m.lifeScript.follow(prev, this._isYoung(m) ? 9 : 12);
      prev = m;
    }
  }

  _arrive(dir) {
    if (dir === 'down') {
      this.beats.arrived = true;
      this._settleAtTarn();
      this._achieve('refuge');
      this._beat('refuge');
    } else {
      this.beats.home = true;
      this._settleAtNests();
      this._achieve('home');
      this._beat('home');
    }
  }

  // ==========================================================================
  // FOOD: wild browse is poor; hungry families walk to grown food near home
  // ==========================================================================
  biteValue(p) {
    return p.isSpawned ? this.fp.plantedBite : this.fp.wildBite;
  }

  // A moa's condition: fed for a while, it's able to lay.
  _updateCondition(dt) {
    const C = this.fp.cond;
    for (const m of this._living()) {
      if (m._cond == null) m._cond = C.start;
      if (m.hunger < C.goodBelow) m._cond = Math.min(1, m._cond + dt / this._sec(C.upSec));
      else if (m.hunger > C.badAbove) m._cond = Math.max(0, m._cond - dt / this._sec(C.downSec));
    }
  }

  // Starving: a family moa held at its fullest hunger (cfg.maxHunger) for starveSec dies.
  // Pukepuke or Koukou: the end, as the Pouākai taking them is. (The 'hungry' prompt warns at
  // criticalHunger, and food close by can be tapped to draw them to it.)
  _updateStarving(dt) {
    const full = this.cfg.maxHunger - 0.5, limit = this._sec(this.fp.starveSec);
    for (const m of this._living()) {
      if (m.hunger < full) { m._starveT = 0; continue; }
      m._starveT = (m._starveT || 0) + dt;
      if (m._starveT < limit) continue;
      const g = this.game, name = this._nameOf(m);
      m.alive = false;
      g.simulation._invalidateCache();
      if (m === this.pukepuke || m === this.koukou) {
        this._failReason = `${name[0].toUpperCase() + name.slice(1)} starved, in year ${this.year + 1}.`;
        this._loseAt = g.playTime + 75;
        return;
      }
      this._lostThisSeason = true;
      g.addNotification(`${name[0].toUpperCase() + name.slice(1)} starved.`, 'error');
      this._beat('moa_starved', { who: m, name });
      this._resettle();
    }
  }

  // How hungry a family is, as far as going for food goes: its average, or its hungriest young
  // one (they get hungry faster, and Pukepuke, off with Koukou, would otherwise never count).
  _groupNeed(live) {
    const avg = live.reduce((s, m) => s + m.hunger, 0) / live.length;
    const youngMax = live.reduce((s, m) => this._isYoung(m) ? Math.max(s, m.hunger) : s, 0);
    return { avg, youngMax, need: Math.max(avg, youngMax) };
  }

  _updateFeeding() {
    if ((this._feedT = (this._feedT || 0) + (this._dt || 1)) < 30) return;
    this._feedT = 0;
    if ((this.journey && this.journey.active) || this.chase || this._scare) return;
    const F = this.fp;
    for (const g of this._groups()) {
      const live = g.members.filter(m => m.alive);
      if (!live.length) continue;
      const { avg, youngMax, need } = this._groupNeed(live);
      const cur = this._groupFeed[g.key];
      if (cur) {
        if (!this._foodGood(cur) || (avg <= F.fedAt && youngMax <= F.fedAt + 12)) {
          delete this._groupFeed[g.key];
          this._settleGroup(g);
          this._pairTheYoung();
        }
        continue;
      }
      if (need < F.feedAt) continue;
      const patch = this._bestFood(g.home);
      if (!patch) continue;
      this._groupFeed[g.key] = patch;
      for (const m of live) {
        if (this._isYoung(m)) continue;
        m.lifeScript.walkRoute([{ x: patch.pos.x + random(-8, 8), y: patch.pos.y + random(-5, 5) }], 1.3, 14);
      }
      this._followMother(g);
      this._beat('family_feeding', { group: g.key, patch });
    }
  }

  // Food a hungry family can feed at now: pātōtara (sprouted, and not in winter) or wharariki.
  _foodGood(p) {
    if (!p || !p.alive) return false;
    if (p.type === 'wharariki') return true;
    return p.type === 'patotara' && !p.unsprouted && this.stage !== 'winter';
  }

  // The nearest good food patch to `home`, within reach of it (in winter, only close by: a
  // family wintering by the water won't walk far, so its food has to be brought to it).
  _bestFood(home) {
    let best = null, bestD = this._wintering() ? this.fp.winterFeedReach : this.fp.feedReach;
    for (const p of this.game.simulation.placeables) {
      if (!this._foodGood(p)) continue;
      const d = Math.hypot(p.pos.x - home.x, p.pos.y - home.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  // Wharariki the player grows stays (as pātōtara does, see PatotaraDirector.onPlaced); every
  // storm the player calls counts toward the walks (see _stormActions).
  onPlaced(p) {
    super.onPlaced(p);
    if (!p) return;
    if (p.type === 'wharariki') this._stand(p);
    if (p.type === 'Storm' && !p.natural) this._stormsCalled++;
  }

  // Storms the player has moved or called so far.
  _stormActions() {
    return (this.game.simulation.stats.stormsMoved || 0) + this._stormsCalled;
  }

  // ==========================================================================
  // MOA EGGS: one a year for a well-fed pair, at its nest in summer
  // ==========================================================================
  _updateMoaBreeding() {
    // The upland moa families don't lay in these five years: the years are Pukepuke's and
    // Koukou's growing up, and their own first egg is the finale's. (Kept, switched off, for a
    // later mode: moaBreed.)
    if (!this.fp.moaBreed) return;
    if ((this._breedT = (this._breedT || 0) + (this._dt || 1)) < 30) return;
    this._breedT = 0;
    const F = this.fp, sm = this.game.seasonManager;
    if (this.stage !== 'summer' || sm.progress > F.layBefore || this.chase) return;
    for (const p of this._breedingPairs()) {
      if (p.mother._laidYear === this.year || !this._pairFree(p)) continue;
      if (!this._near(p.father, p.nest, F.nestReach) || !this._near(p.mother, p.nest, F.nestReach)) continue;
      if ((p.father._cond || 0) < F.cond.lay || (p.mother._cond || 0) < F.cond.lay) continue;
      if (p.father.lifeScript.security < 0.8 || p.mother.lifeScript.security < 0.8) continue;
      this._layMoaEgg(p);
    }
  }

  _layMoaEgg(p) {
    const g = this.game, sim = g.simulation, n = p.nest;
    const egg = new Egg(n.x + random(-3, 3), n.y + random(-2, 2), g.terrain, CONFIG);
    egg.parentSpecies = 'upland_moa';
    egg.speedBonus = 0;   // the director hatches it (see _updateMoaEggs)
    egg.incubationTime = this._sec(this.cfg.eggHatchSec);
    egg.currentTime = 0;
    sim.eggs.push(egg);
    sim.markEggGridDirty();
    p.mother._laidYear = this.year;
    this.moaEggs.push({ egg, pair: p, age: 0 });
    this._settleGroup(p);   // the father sits on it
    const who = p.key === 'ours' ? "Pukepuke's parents" : "Koukou's parents";
    g.addNotification(`${who} have laid an egg.`, 'success');
    this._achieve('egg');
    this._beat('egg_laid', { egg, pair: p, who });
  }

  _updateMoaEggs(dt) {
    if (this._shells) {
      this._shells.t += dt;
      if (this._shells.t > this._sec(6)) this._shells = null;
    }
    for (let i = this.moaEggs.length - 1; i >= 0; i--) {
      const r = this.moaEggs[i], egg = r.egg;
      if (!egg.alive) { this.moaEggs.splice(i, 1); continue; }   // (taken in a kea raid)
      r.age += dt;
      egg.currentTime = Math.min(egg.incubationTime - 1, r.age);
      if (r.age < egg.incubationTime) continue;
      egg.alive = false;
      this.game.simulation.markEggGridDirty();
      this.moaEggs.splice(i, 1);
      this._shells = { x: egg.pos.x, y: egg.pos.y, t: 0, size: egg.size, spin: random(TWO_PI) };
      if (audioManager && audioManager.playPlantRustle) audioManager.playPlantRustle();
      const p = r.pair;
      const chick = this._spawnMoa(egg.pos.x, egg.pos.y, random() < 0.5, 'chick',
        { group: p.members, chickSize: this.fp.chickSize });
      chick._cond = this.fp.cond.start;
      this._setAge(chick, 0);
      this.chicksRaised++;
      this._settleGroup(this._groups().find(g => g.key === p.key) || p);
      this._pairTheYoung();
      this.game.addNotification("A moa chick has hatched!", 'success');
      this.onHatched(chick, 'upland_moa');
      this._achieve('hatched');
      this._beat('moa_hatched', { chick, pair: p });
    }
  }

  // ==========================================================================
  // THE POUĀKAI: hunts when hungry, takes whatever it can see
  // ==========================================================================
  // Where it circles while it isn't hunting: round the families, the forest, the kea's nest and
  // the giant moa's low ground in turn (see EagleLife's patrol).
  patrolCentre() { return this._roam || this.sites.nest; }

  _updateRoam(dt) {
    this._roamT -= dt;
    if (this._roam && this._roamT > 0) return;
    this._roamT = this._sec(this.fp.eagle.roamSec);
    const s = this.sites, fam = this._familyCentre();
    const giants = this._birds('south_island_giant_moa');
    const low = giants.length ? this._centroid(giants) : s.tarn;
    const pts = [fam, this._forestCentre || s.keaNest, fam, s.keaNest, fam, low];
    this._roam = pts[this._roamIdx++ % pts.length];
  }

  _familyCentre() {
    const live = this._living();
    return live.length ? this._centroid(live) : this.sites.nest;
  }

  _updateHunt(dt) {
    const E = this.fp.eagle, g = this.game, e = this.eagle;
    if (!e || !e.alive || this._openingAt != null) return;
    const el = e.lifeScript;
    // Off hunting elsewhere in its range: back after a while, with something in its belly.
    if (this._awayUntil) {
      if (g.playTime < this._awayUntil) return;
      this._awayUntil = 0;
      this.eagleHunger = E.backHunger;
      const c = this._familyCentre(), t = g.terrain;
      const dx = e.pos.x - c.x, dy = e.pos.y - c.y, dd = Math.hypot(dx, dy) || 1, r = el.patrolRadius;
      el.comeBack({ x: Math.max(20, Math.min(t.mapWidth - 20, c.x + dx / dd * r)),
                    y: Math.max(20, Math.min(t.mapHeight - 20, c.y + dy / dd * r)) });
      this._beat('eagle_returns');
      return;
    }
    this.eagleHunger = Math.min(100, this.eagleHunger + E.hungerPerSec * dt / 60);
    this._updateRoam(dt);
    if (this.chase) return;                           // a family attack (ModuleDirector._updateChase)
    if (this.birdHunt) { this._updateBirdHunt(dt); return; }
    if (g.playTime < this._eagleRestUntil) return;    // resting at its lookout after a meal
    if (el.mode === 'soar' || el.mode === 'leave') { el.patrol = true; el.mode = 'patrol'; }
    if (this.eagleHunger < E.huntAt) return;
    this._lookT -= dt;
    if (this._lookT > 0) return;
    this._lookT = 20;
    const prey = this._pickPrey();
    if (!prey) {
      this._seekT += 20;
      if (this._seekT >= this._sec(E.seekSec)) { this._seekT = 0; this._goneHungry(); }
      return;
    }
    this._seekT = 0;
    if (prey.family) this._huntMoa(prey.ent);
    else this._huntBird(prey.ent);
  }

  // The prey it can see from where it is: moa not under a storm (it prefers moa, the young
  // most), and the other birds (never a species' last pair). family: one of the families.
  _pickPrey(othersOnly = false) {
    const E = this.fp.eagle, e = this.eagle.pos, sim = this.game.simulation;
    const R = E.lookRange + E.lookPerBold * this.boldness;
    let best = null, bestS = Infinity;
    if (!othersOnly) {
      for (const m of this._living()) {
        if (this.isHidden(m)) continue;
        const d = Math.hypot(m.pos.x - e.x, m.pos.y - e.y);
        if (d > R) continue;
        const s = d / (E.moaPref * (this._isYoung(m) ? E.youngPref : 1));
        if (s < bestS) { bestS = s; best = { ent: m, family: true }; }
      }
    }
    for (const type of FREEPLAY_BIRDS) {
      const list = this._birds(type);
      if (list.length <= E.birdFloor) continue;
      const pref = BIRD_CALENDAR[type].moa ? E.moaPref : 1;
      for (const b of list) {
        if (sim.stormAt(b.pos.x, b.pos.y)) continue;
        const s = Math.hypot(b.pos.x - e.x, b.pos.y - e.y);
        if (s > R) continue;
        if (s / pref < bestS) { bestS = s / pref; best = { ent: b, family: false }; }
      }
    }
    return best;
  }

  // It has seen a family moa: an attack on it and whoever is with it (ModuleDirector._startChase),
  // with a "last chance" to cover them that shrinks as it grows bolder.
  _huntMoa(m) {
    const E = this.fp.eagle;
    const targets = this._living().filter(o => Math.hypot(o.pos.x - m.pos.x, o.pos.y - m.pos.y) < 120);
    const grace = Math.max(E.graceMin, E.graceSec - E.gracePerBold * this.boldness);
    this._startChase('hunt', targets, { graceSec: grace, prompt: 'last_chance' });
    this._beat('hunt_moa', { moa: m });
  }

  // A dive at one of the others (a bird, or a giant moa).
  _huntBird(b) {
    this.birdHunt = { prey: b, t: 0 };
    const el = this.eagle.lifeScript;
    el.patrol = true;
    el.strike(b);
    this._beat('hunt_bird', { prey: b, type: b.speciesKey });
  }

  _updateBirdHunt(dt) {
    const h = this.birdHunt, b = h.prey, e = this.eagle, el = e.lifeScript;
    h.t += dt;
    // Gone, too quick for it, or under a storm's cloud: it gets away.
    if (!b.alive || h.t > this._sec(this.fp.eagle.birdChaseSec) || this.game.simulation.stormAt(b.pos.x, b.pos.y)) {
      this.birdHunt = null;
      el.leave();
      if (b.alive) this._goneHungry();
      return;
    }
    el.strike(b);
    if (Math.hypot(e.pos.x - b.pos.x, e.pos.y - b.pos.y) < e.catchRadius + 3) this._catchMoment(b, () => this._eatPrey(b));
  }

  _eatPrey(b) {
    const g = this.game, E = this.fp.eagle, moa = !!BIRD_CALENDAR[b.speciesKey] && !!BIRD_CALENDAR[b.speciesKey].moa;
    b.alive = false;
    g.simulation._invalidateCache();
    this.birdHunt = null;
    this.eagleHunger = moa ? 0 : Math.max(0, this.eagleHunger - E.birdFeed);
    this.boldness = 0;
    this._fruitless = 0;
    this._restEagle(moa ? 1.5 : 1);
    const name = this._birdName(b.speciesKey);
    g.addNotification(`The Pouākai took a ${name}.`, 'error');
    this._beat('eagle_fed', { prey: b, type: b.speciesKey, name });
  }

  _restEagle(mult = 1) {
    this._eagleRestUntil = this.game.playTime + this._sec(this.fp.eagle.restSec * mult);
    const el = this.eagle.lifeScript;
    el.patrol = false;
    el.leave();
  }

  // Hungry with nothing to show for it: bolder (it looks further, and dives sooner). At its
  // boldest already, it gives the tops up for a while (see awayAfter).
  _goneHungry() {
    const E = this.fp.eagle;
    if (this.boldness < E.boldMax) {
      this.boldness++;
      this._beat('eagle_bold', { boldness: this.boldness });
      return;
    }
    if (++this._fruitless < E.awayAfter) return;
    this._fruitless = 0;
    this.boldness = 0;
    this.birdHunt = null;
    this._awayUntil = this.game.playTime + this._sec(E.awaySec);
    this.eagle.lifeScript.flyAway();
    this._beat('eagle_away');
  }

  // An attack on the families came to nothing: it turns to whatever else it can see.
  _chaseSurvived(c) {
    this._beat('eagle_gave_up', { kind: c.kind });
    const prey = this._pickPrey(true);
    if (prey) {
      this.chase = null;
      this._huntBird(prey.ent);
      this._beat('hunt_turned', { prey: prey.ent, type: prey.ent.speciesKey });
    } else {
      this._goneHungry();
    }
  }

  // The family moa it dives at: the youngest it can see.
  _victim(exposed) {
    const age = (m) => (m === this.pukepuke || m === this.koukou) ? 3 : (m.lifeScript.ageYears ?? 99);
    return exposed.slice().sort((a, b) => age(a) - age(b))[0];
  }

  // It caught a family moa: first the moment (see _catchMoment), then the loss.
  _caught(m) { this._catchMoment(m, () => this._caughtNow(m)); }

  // Pukepuke or Koukou: the end. Anyone else: a hard loss, and the families go on.
  _caughtNow(m) {
    const g = this.game, name = this._nameOf(m);
    m.alive = false;
    g.simulation._invalidateCache();
    this.chase = null;
    this.eagleHunger = 0;
    this.boldness = 0;
    if (m === this.pukepuke || m === this.koukou) {
      this.eagle.lifeScript.leave();
      this._failReason = `The Pouākai took ${name}, in year ${this.year + 1}.`;
      this._loseAt = g.playTime + 75;   // a beat to see it happen
      return;
    }
    this._restEagle(1.5);
    this._lostThisSeason = true;
    g.addNotification(`The Pouākai took ${name}.`, 'error');
    this._beat('moa_taken', { who: m, name });
    this._resettle();
  }

  // A raid that worked scatters the moa round it (both families); otherwise as Module 1.
  chaseRole(m) {
    if (this._scare && this._near(m, this._scare.from, 100)) return 'flee';
    return ModuleDirector.prototype.chaseRole.call(this, m);
  }
  threatFor(m) {
    if (this._scare && this._near(m, this._scare.from, 100)) return { pos: this._scare.from };
    return this.eagle;
  }

  // ==========================================================================
  // THE KEA: out for berries near their nest, raiding at real odds (and taking eggs)
  // ==========================================================================
  // Now and then the band goes out for the nearest sprouted pātōtara the player grew within
  // reach of their nest (in the warm months, while it has berries).
  _updateKeaForage(dt) {
    this._keaForageT += dt;
    if (this._keaForageT < this._sec(this.fp.kea.forageEverySec)) return;
    this._keaForageT = 0;
    if (this.keaRaid || this.game.playTime < this._raidOkAt || this.stage === 'winter') return;
    const kn = this.sites.keaNest;
    let best = null, bestD = this.fp.kea.berryRange;
    for (const p of this.placedFood) {
      if (!p.alive || p.unsprouted) continue;
      const d = Math.hypot(p.pos.x - kn.x, p.pos.y - kn.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best) this._lureKea(best.pos, (k) => k.lifeScript.atHome());
  }

  // Kea don't set out (for berries, or for moa near their nest) with a storm in the way: a
  // storm between the kea's nest and the families keeps them home. (One that blows into
  // their way mid-flight still turns them back, as in Module 1.)
  _lureKea(at, which) {
    const sim = this.game.simulation;
    const stormInWay = (k) => sim.placeables.some(p => p.alive && p.type === 'Storm' &&
      ModuleDirector._segDist(p.pos, k.pos, at) < p.radius);
    super._lureKea(at, (k) => which(k) && !stormInWay(k));
  }

  // As Module 1's roll, but a raid that works by a nest also takes the egg in it.
  _rollKeaRaid(r) {
    const won = random() < r.chance, now = this.game.playTime;
    this.keaRaid = null;
    this._raidOkAt = now + this._sec(this.k.keaLife.restSec);
    const lured = this.keas.filter(k => k.alive && k.lifeScript.lured);
    if (won) {
      this._scare = { from: { x: r.at.x, y: r.at.y }, until: now + this._sec(this.k.keaLife.scareSec) };
      for (const p of this.placedFood) if (p.alive && this._near(p, r.at, 50)) p.destroy();
      for (const k of lured) { k.lifeScript.feedT = 0; k.lifeScript.raided = true; }
      for (const rec of this.moaEggs) {
        if (!rec.egg.alive || !this._near(rec.egg, r.at, 70)) continue;
        rec.egg.alive = false;
        this.game.simulation.markEggGridDirty();
        this.game.addNotification("The kea took an egg from a nest!", 'error');
        this._beat('egg_taken', { pair: rec.pair });
      }
      this._beat('kea_raid_won', { chance: r.chance });
    } else {
      for (const k of lured) k.lifeScript.goHome();
      this._beat('kea_raid_lost', { chance: r.chance });
    }
  }

  // ==========================================================================
  // THE OTHERS' YEAR: birds and giant moa
  // ==========================================================================
  _birds(type) {
    const sim = this.game.simulation;
    if (BIRD_CALENDAR[type] && BIRD_CALENDAR[type].moa) return sim.moas.filter(m => m.alive && m.speciesKey === type);
    const l = sim.otherEntities[type];
    return l ? l.filter(b => b.alive) : [];
  }

  _birdCount() {
    let n = 0;
    for (const type of FREEPLAY_BIRDS) n += this._birds(type).length;
    return n;
  }

  _birdName(type) {
    const sp = typeof REGISTRY !== 'undefined' && REGISTRY.getSpecies ? REGISTRY.getSpecies(type) : null;
    return (sp && sp.displayName) || type;
  }

  // Grown: a bird by its flag, a giant moa by its years.
  _adult(b, type) {
    const B = BIRD_CALENDAR[type];
    return B.moa ? (b._ageYears ?? B.maturity) >= B.maturity : !!b.mature;
  }

  // At a season's start: each species whose laying season it is lines up its clutches (a
  // pair lays at a random point in the season, if it breeds this year at all).
  _scheduleBirdClutches(key) {
    for (const type of FREEPLAY_BIRDS) {
      const B = BIRD_CALENDAR[type];
      if (key !== B.lay) continue;
      if (B.years && !B.years.includes(this.year + 1)) continue;          // not one of its years
      if (B.minLeft && this._birds(type).length < B.minLeft) continue;    // too few left to pair
      const adults = this._birds(type).filter(b => this._adult(b, type));
      // Hens due this year (every: her last clutch long enough ago).
      const due = (b) => !B.every || (b._nextClutchYear ?? 0) <= this.year;
      const females = FreePlayDirector._shuffled(adults.filter(b => b.isFemale && due(b))), males = adults.filter(b => !b.isFemale);
      const pairs = Math.min(females.length, males.length);
      const p = (this.mast && B.mastSuccess != null) ? B.mastSuccess : B.success;
      const food = this._birdFood(type);
      for (let i = 0; i < pairs; i++) {
        if (random() >= p * food) continue;
        // Her next clutch: 1 or 2 years on (every).
        if (B.every) females[i]._nextClutchYear = this.year + B.every[0] + Math.floor(random(B.every[1] - B.every[0] + 1));
        this.birdClutches.push({
          type, mother: females[i], stage: key,
          at: Math.floor(CONFIG.seasonDuration * random(B.layFrom, B.layTo)),
          n: B.clutch[0] + Math.floor(random(B.clutch[1] - B.clutch[0] + 1))
        });
      }
    }
  }

  // How well a species is eating (the share not starving), as a breeding factor.
  _birdFood(type) {
    if (type === 'kea') return 1;
    const list = this._birds(type);
    if (!list.length) return 0;
    const fed = list.filter(b => b.hunger < 70).length / list.length;
    return 0.5 + 0.5 * fed;
  }

  _updateBirdYear(dt) {
    // Clutches due now.
    for (let i = this.birdClutches.length - 1; i >= 0; i--) {
      const c = this.birdClutches[i];
      if (c.stage !== this.stage) { this.birdClutches.splice(i, 1); continue; }   // its season passed
      if (this.stageTime < c.at) continue;
      this.birdClutches.splice(i, 1);
      this._layBirdClutch(c);
    }
    // Kea eggs in their nest (the director hatches them, as kea of the band).
    for (let i = this.keaEggs.length - 1; i >= 0; i--) {
      const r = this.keaEggs[i];
      if (!r.egg.alive) { this.keaEggs.splice(i, 1); continue; }
      r.age += dt;
      r.egg.currentTime = Math.min(r.egg.incubationTime - 1, r.age);
      if (r.age < r.egg.incubationTime) continue;
      r.egg.alive = false;
      this.game.simulation.markEggGridDirty();
      this.keaEggs.splice(i, 1);
      if (this._birds('kea').length >= BIRD_CALENDAR.kea.cap) continue;
      const k = this._spawnKea(r.egg.pos.x, r.egg.pos.y);
      if (!k) continue;
      k.mature = false;
      k._ageYears = 0;
      k.lifeScript.setHome(r.egg.pos.x, r.egg.pos.y);
      this.onHatched(k, 'kea');
    }
    // The others' young hatch on their own (Simulation._hatchFlyerEgg, or as moa): note their
    // year of birth, so they come of age by the year. A young giant moa grows over its years.
    if ((this._scanT += dt) >= 60) {
      this._scanT = 0;
      for (const type of FREEPLAY_BIRDS) {
        if (type === 'kea') continue;
        const moa = !!BIRD_CALENDAR[type].moa;
        for (const b of this._birds(type)) {
          if (b._ageYears != null || (!moa && b.mature)) continue;
          b._ageYears = 0;
          this._settleBird(b);
        }
      }
    }
    const G = BIRD_CALENDAR.south_island_giant_moa, yf = this._yearFraction();
    for (const m of this._birds('south_island_giant_moa')) {
      if (m._ageYears == null || m._ageYears >= G.maturity) continue;
      m.age = Math.min(MOA_AGE.ADULT_MIN - 1, (m._ageYears + yf) / G.maturity * MOA_AGE.ADULT_MIN);
    }
  }

  // How far through the year (from summer) it is, 0..1.
  _yearFraction() {
    const sm = this.game.seasonManager, i = ['summer', 'autumn', 'winter', 'spring'].indexOf(this.stage);
    return Math.max(0, (Math.max(0, i) + Math.min(1, sm.progress || 0)) / 4);
  }

  _layBirdClutch(c) {
    const B = BIRD_CALENDAR[c.type], m = c.mother, sim = this.game.simulation;
    if (!m || !m.alive) return;
    const pending = sim.eggs.filter(e => e.alive && !e.hatched &&
      (B.moa ? e.parentSpecies === c.type : (e.offspringType === c.type || e.offspringType === c.type + '_band'))).length;
    const n = Math.min(c.n, B.cap - this._birds(c.type).length - pending);
    if (n <= 0) return;
    for (let i = 0; i < n; i++) {
      if (c.type === 'kea') {
        const kn = this.sites.keaNest;
        const egg = new Egg(kn.x + random(-6, 6), kn.y + random(-4, 4), this.game.terrain, CONFIG);
        egg.offspringType = 'kea_band';   // (not a sim-hatched flyer: see _updateBirdYear)
        egg.parentSpecies = 'kea';
        egg.speedBonus = 0;
        egg.incubationTime = this._sec(B.hatchSec);
        egg.size = 2.6;
        sim.eggs.push(egg);
        this.keaEggs.push({ egg, age: 0 });
      } else {
        const egg = sim.addEgg(m.pos.x + random(-4, 4), m.pos.y + random(-3, 3));
        egg.parentSpecies = c.type;
        egg.incubationTime = this._sec(B.hatchSec);
        if (!B.moa) { egg.offspringType = c.type; egg.size = 2.6; }   // (a moa egg hatches a moa)
      }
    }
    sim.markEggGridDirty();
    this._beat('birds_nesting', { type: c.type, name: this._birdName(c.type), n });
  }

  // A new year: every bird and giant moa is a year older, and the young of age come of age.
  _ageBirds() {
    for (const type of FREEPLAY_BIRDS) {
      const B = BIRD_CALENDAR[type];
      for (const b of this._birds(type)) {
        if (b._ageYears == null) b._ageYears = this._adult(b, type) ? B.maturity : 0;
        else b._ageYears++;
        if (!B.moa && !b.mature && b._ageYears >= B.maturity) b.mature = true;
      }
    }
  }

  // ==========================================================================
  // THE PROMPTS: the essential actions, asked for in real time
  // ==========================================================================
  // What needs doing now, each with its data: cover (the eagle has seen a family moa), pathDown
  // and pathUp (the walks, until a storm is moved or called for them), winterStorm (a family
  // moa out in the open in winter), feed (a hungry family with no grown food in reach) and
  // sprout (grown pātōtara left bare). Only what the player can do right then: a storm to move
  // or the mauri to call one, the mauri for the food.
  _activeNeeds() {
    const g = this.game, out = {}, sim = g.simulation;
    if (this._ending || this._loseAt != null || this._openingAt != null) return out;
    const storms = sim.placeables.filter(p => p.alive && p.type === 'Storm');
    const stormDef = g.activePlaceables && g.activePlaceables.Storm;
    const canCall = !!stormDef && g.mauri.canAfford(stormDef.cost) &&
      (g.playTime >= (g._stormCooldownUntil || 0) || this.stormCooldownFree());
    const canMove = storms.length > 0 && !!stormDef && g.mauri.canAfford(stormDef.moveCost ?? 10);
    const c = this.chase;
    if (c && (c.phase === 'grace' || c.phase === 'strike') && (canMove || canCall)) {
      const exposed = c.targets.filter(m => m.alive && !this.isHidden(m));
      if (exposed.length) out.cover = { moa: exposed, chase: c };
    }
    const acted = this._stormActions() > (this._actionsAt || 0);
    if (this.stage === 'autumn' && this.beats.talked && !this.beats.arrived && !acted && (canMove || canCall)) out.pathDown = {};
    if (this.stage === 'spring' && this.beats.journey && !this.beats.home && !acted && (canMove || canCall)) out.pathUp = {};
    // Winter: Koukou's family, by the water across from ours, with no food by them.
    if (this.stage === 'winter' && this.friends.some(m => m.alive) && !this._friendsHaveFood()) {
      const wd = g.activePlaceables && g.activePlaceables.wharariki;
      const canMoveW = !!wd && g.mauri.canAfford(wd.moveCost ?? Math.ceil((wd.cost || 0) / 2));
      const free = sim.placeables.filter(p => p.alive && p.type === 'wharariki');
      if (canMoveW && free.length) out.friendsFood = { at: this.sites.friendWinter, patches: free };
    }
    // A family moa critically hungry with food growing close by: tap it to draw them over
    // (Game._tapPlant, Simulation.lurePlant).
    if (!c) {
      const starving = this._living().filter(m => m.hunger >= this.fp.criticalHunger && this._foodNear(m));
      if (starving.length) out.hungry = { moa: starving };
    }
    if (this.stage !== 'winter') {
      const bare = this.placedFood.find(p => p.alive && p.unsprouted);
      if (bare) out.sprout = { food: bare };
    }
    return out;
  }

  // Whether there's food within Koukou's family's winter reach of where they winter.
  _friendsHaveFood() {
    const at = this.sites.friendWinter;
    if (!at) return true;
    const reach = this.fp.winterFeedReach;
    return this.game.simulation.placeables.some(p => this._foodGood(p) && Math.hypot(p.pos.x - at.x, p.pos.y - at.y) < reach);
  }

  // Whether there's a plant with food on it close enough to `m` that tapping it would draw it.
  _foodNear(m) {
    const plants = this.game.simulation.getNearbyPlants(m.pos.x, m.pos.y, PLANT_LURE.range);
    for (let i = 0; i < plants.length; i++) if (plants[i].hasFood()) return true;
    return false;
  }

  // Whether a need is still standing (the prompt's banner goes once it isn't).
  needActive(name) { return !!this._activeNeeds()[name]; }

  // Each need gets its prompt (the 'prompt' moment, data.need) at once in the first year;
  // after that only once it has stood laterSec undone (the eagle's: coverLeadSec before it
  // dives). A need met clears, so the next time it comes up it counts afresh.
  _updateNeeds(dt) {
    if ((this._needT += dt) < 15) return;
    this._needT = 0;
    const now = this.game.playTime, P = this.fp.prompt, active = this._activeNeeds();
    for (const name in this._needs) if (!active[name]) delete this._needs[name];
    for (const name in active) {
      const n = this._needs[name] || (this._needs[name] = { since: now, fired: false });
      if (n.fired) continue;
      let wait = 0;
      if (this.year > 0) {
        wait = this._sec(P.laterSec);
        if (name === 'cover') wait = Math.max(0, active.cover.chase.grace - this._sec(P.coverLeadSec));
      }
      if (now - n.since < wait) continue;
      n.fired = true;
      this._beat('prompt', Object.assign({ need: name }, active[name]));
    }
  }

  // ==========================================================================
  // THE FINALE: five years on, Pukepuke and Koukou come of age and mate
  // ==========================================================================
  _beginEnding() {
    const g = this.game, E = this.fp.ending, P = this.pukepuke, K = this.koukou;
    // Their nest: the empty one, if both are a short walk from it; else where they are.
    const empty = this.sites.thirdNest;
    const n = (this._near(P, empty, 110) && this._near(K, empty, 110)) ? empty : this._meetingPoint();
    this._setFinaleNest(n);
    this._ending = { phase: 'walk', t: 0 };
    this.chase = null;
    this.birdHunt = null;
    if (this.journey) this.journey.active = false;
    this._scare = null;
    this.game.goals = [{ id: 'grown', name: "Pukepuke and Koukou are grown", reward: 0, achieved: false, condition: () => false }];
    if (this.eagle && this.eagle.alive) this.eagle.lifeScript.flyAway();   // it leaves them be
    for (const m of this._living()) {
      if (m === this.pukepuke || m === this.koukou) continue;
      m.lifeScript.stay(m.pos.x, m.pos.y, 6);
    }
    // (The families' hunger and safety bars are put away for the finale.)
    for (const m of this._living()) m.renderIndicators = () => {};
    // The two walk to it, and the camera closes in on it.
    P.lifeScript.walkRoute([{ x: n.x - 6, y: n.y + 3 }], 1.1, 4);
    K.lifeScript.walkRoute([{ x: n.x + 6, y: n.y + 3 }], 1.1, 4);
    if (g.tutorial) { g.tutorial.active = false; g.tutorial.currentTip = null; g.tutorial.pendingTips = []; }
    g.selectedPlaceable = null;
    g.movingPlaceable = null;
    this._beat('ending_start');
  }

  // Halfway between Pukepuke and Koukou (on ground they can stand on).
  _meetingPoint() {
    const P = this.pukepuke, K = this.koukou, t = this.game.terrain;
    const m = { x: (P.pos.x + K.pos.x) / 2, y: (P.pos.y + K.pos.y) / 2 };
    return t.isWalkable(m.x, m.y) ? m : { x: P.pos.x, y: P.pos.y };
  }

  // Put their nest (the empty nesting site) at , and close the camera in on it.
  _setFinaleNest(p) {
    const g = this.game, E = this.fp.ending;
    this.sites.thirdNest = { x: p.x, y: p.y };
    if (this._thirdSite) this._thirdSite.pos.set(p.x, p.y);
    // The sky clears over it: storms nearby shrink away.
    for (const st of g.simulation.placeables) {
      if (!st.alive || st.type !== 'Storm' || st._clearing || Math.hypot(st.pos.x - p.x, st.pos.y - p.y) > st.radius + 60) continue;
      st._clearing = true;
      st.swellTo(st.radius * 0.3, this._sec(2));
      st.fadeOver(2, false);
    }
    g.cameraTo({ zoom: E.zoom, cx: p.x, cy: g._groundPaintY(p.x, p.y), ax: 0.5, ay: 0.5 }, this._sec(E.zoomSec));
  }

  _updateEnding(dt) {
    const o = this._ending, E = this.fp.ending, P = this.pukepuke, K = this.koukou;
    let n = this.sites.thirdNest;
    o.t += dt;
    if (o.phase === 'walk') {
      const there = this._near(P, n, 16) && this._near(K, n, 16);
      if (there || o.t >= this._sec(E.walkSec)) {
        // (Not there yet, held up by the slope: their nest is where they've got to.)
        if (!there) this._setFinaleNest(this._meetingPoint());
        const m = this.sites.thirdNest;
        o.phase = 'grow'; o.t = 0;
        o.from = [P.size, K.size];
        P.lifeScript.stay(m.x - 5, m.y + 3, 3);
        K.lifeScript.stay(m.x + 5, m.y + 3, 3);
      }
    } else if (o.phase === 'grow') {
      // Coming of age: they grow to full size.
      const k = Math.min(1, o.t / this._sec(E.growSec)), e = k * k * (3 - 2 * k);
      P.size = o.from[0] + (P.baseSize - o.from[0]) * e;
      K.size = o.from[1] + (K.baseSize - o.from[1]) * e;
      if (k >= 1) {
        o.phase = 'court'; o.t = 0;
        this._grownUp = true;
        this._achieve('grown');
        this._beat('grown_up');
      }
    } else if (o.phase === 'court') {
      // Mating: hearts over them, close together on the nest.
      P.heartTimer = K.heartTimer = 40;
      P.lifeScript.stay(n.x - 3, n.y + 2, 2);
      K.lifeScript.stay(n.x + 3, n.y + 2, 2);
      if (o.t >= this._sec(E.courtSec)) {
        o.phase = 'egg'; o.t = 0;
        const egg = new Egg(n.x, n.y + 2, this.game.terrain, CONFIG);
        egg.parentSpecies = 'upland_moa';
        egg.speedBonus = 0;
        egg.incubationTime = this._sec(60);
        this.game.simulation.eggs.push(egg);
        this.game.simulation.markEggGridDirty();
        this._beat('ending');   // Te Whē's last words
      }
    } else if (o.phase === 'egg') {
      // The hearts fade; the win waits for Te Whē's words.
      P.heartTimer = K.heartTimer = Math.max(0, P.heartTimer - dt);
      if (o.t >= this._sec(1) && this._tutorialIdle()) {
        o.phase = 'done';
        this.won = true;
        this.game.state = GAME_STATE.WON;
        if (audioManager) audioManager.playWin();
        PROGRESS.completeLevel(this.game.currentLevel.id, computeLevelScore(this.game.currentLevel, this.game._scoreContext()));
      }
    }
  }

  // ==========================================================================
  // MAURI: the families, and every bird and giant moa on the land
  // ==========================================================================
  mauriPerSec() {
    return (this._living().length ? this.cfg.mauriPerSec : 0) + this.fp.mauriPerBird * this._birdCount();
  }

  _income(dt) {
    this._incomeT += dt;
    if (this._incomeT < MODULE_FPS) return;
    this._incomeT -= MODULE_FPS;
    const rate = this.mauriPerSec();
    if (rate > 0) this.game.mauri.earn(rate);
  }

  // The weather on the tops, kept off the families (ModuleDirector._updateWeather, but round
  // the families rather than the eagle's rounds).
  _updateWeather(dt) {
    // This year's number of storm sources on the tops (weather.maxByYear; none: no new ones).
    const W = this.cfg.weather;
    if (W && W.maxByYear) {
      W.max = W.maxByYear[Math.min(this.year, W.maxByYear.length - 1)];
      if (W.max <= 0) return;
    }
    const roam = this._roam;
    this._roam = this._familyCentre();
    super._updateWeather(dt);
    this._roam = roam;
  }

  // ==========================================================================
  // MOMENTS: a hatching, or the Pouākai's catch, held still and closed in on
  // ==========================================================================
  // While one plays (Game.update / Game.render read `moment`), the world stands still: no sim,
  // no clock, no tips, no input. The camera eases in on it, big words say what happened, and
  // it eases back out once the world runs on. Each is { kind, at() (world point), dur
  // (frames), text, tick(t, dt), end() }; a second one waits its turn.
  get moment() { return this._moment; }

  _startMoment(m) {
    if (this._ending || this._loseAt != null) { if (m.end) m.end(); return; }
    if (this._moment) { this._momentQueue.push(m); return; }
    const g = this.game, M = this.fp.moment, c = g.camera;
    // Back to where the view was going (a camera ease under way ends where it was headed).
    const v = c ? (c.tween ? c.tween.to : c) : null;
    m.view = v ? { zoom: v.zoom, cx: v.cx, cy: v.cy, ax: v.ax, ay: v.ay } : null;
    m.t = 0;
    const at = m.at();
    g.cameraTo({ zoom: Math.max(M.zoom, v ? v.zoom : 1), cx: at.x, cy: g._groundPaintY(at.x, at.y), ax: 0.5, ay: 0.5 },
      this._sec(M.inSec));
    g.selectedPlaceable = null;
    g.movingPlaceable = null;
    g._holdCandidate = null;
    for (const mo of g.simulation.moas) mo.settleFacing();
    this._moment = m;
  }

  updateMoment(dt) {
    const m = this._moment;
    if (!m) return;
    m.t += dt;
    if (m.tick) m.tick(m.t, dt);
    if (m.t < m.dur) return;
    this._moment = null;
    if (m.end) m.end();
    // The next waiting moment (if what it shows is still there), else back out to the view.
    while (this._momentQueue.length) {
      const n = this._momentQueue.shift();
      if (!n.valid || n.valid()) { n.view = null; this._startMoment(n); if (this._moment) this._moment.view = m.view; return; }
      if (n.end) n.end();
    }
    if (m.view) this.game.cameraTo(m.view, this._sec(this.fp.moment.outSec));
  }

  // The words, big, over the top of the world (as a prompt's), fading in and out.
  renderMoment() {
    const m = this._moment, g = this.game;
    if (!m || !m.text) return;
    const fade = 18, a = 255 * Math.min(1, m.t / fade, (m.dur - m.t) / fade);
    if (a <= 0) return;
    const area = g.tutorial && g.tutorial.playArea ? g.tutorial.playArea()
      : { x: 0, y: 0, w: CONFIG.canvasWidth, h: CONFIG.canvasHeight };
    const size = 58 * (typeof TIP_PANEL_SCALE !== 'undefined' ? TIP_PANEL_SCALE : 1) * (CONFIG.portrait ? 0.8 : 1);
    push();
    if (typeof FreckleFace !== 'undefined') textFont(FreckleFace);
    textSize(size);
    textAlign(CENTER, CENTER);
    translate(area.x + area.w * 0.5, area.y + area.h * 0.2);
    scale(1 + 0.08 * Math.max(0, 1 - m.t / 12));   // a small pop as it appears
    stroke(12, 22, 16, a * 0.9);
    strokeWeight(size * 0.14);
    strokeJoin(ROUND);
    fill(m.kind === 'catch' ? color(255, 214, 196, a) : color(235, 250, 225, a));
    text(m.text, 0, 0);
    pop();
  }

  // "A Kākā", "An Upland Moa".
  static _withArticle(name) { return (/^[aeiouāēīōū]/i.test(name) ? 'An ' : 'A ') + name; }

  // Something just hatched (here, or in the simulation: Simulation.onHatched): a moment on it,
  // once per species every dupSec (a clutch hatches together).
  onHatched(ent, type) {
    if (!ent || this._ending || this._loseAt != null) return;
    const now = this.game.playTime, last = this._hatchShownAt[type];
    if (last != null && now - last < this._sec(this.fp.moment.dupSec)) return;
    if (this._momentQueue.some(q => q.kind === 'hatch' && q.type === type)) return;
    this._hatchShownAt[type] = now;
    const name = this._birdName(type);
    this._startMoment({
      kind: 'hatch', type, dur: this._sec(this.fp.moment.hatchSec),
      text: `A new ${name} just hatched!`,
      at: () => ent.pos, valid: () => ent.alive
    });
  }

  // The Pouākai has its prey: before it's taken, a moment on it. The eagle shows its dive, then
  // flies on as the prey fades out; then `finish` takes it (the catch's own consequences).
  _catchMoment(prey, finish) {
    if (prey._caughtPending) return;
    prey._caughtPending = true;
    const e = this.eagle, M = this.fp.moment, name = this._birdName(prey.speciesKey || 'upland_moa');
    if (audioManager) audioManager.playEagleCatch();
    let fade = 1;
    const ownRender = Object.prototype.hasOwnProperty.call(prey, 'render') ? prey.render : null;
    const ownInd = Object.prototype.hasOwnProperty.call(prey, 'renderIndicators') ? prey.renderIndicators : null;
    const r0 = prey.render;
    prey.render = function () {
      if (fade <= 0) return;
      const dc = drawingContext, ga = dc.globalAlpha;
      dc.globalAlpha = ga * fade;
      r0.call(this);
      dc.globalAlpha = ga;
    };
    if (prey.renderIndicators) prey.renderIndicators = function () {};
    const dive = this._sec(M.diveSec), fadeT = this._sec(M.fadeSec);
    this._startMoment({
      kind: 'catch', dur: this._sec(M.catchSec),
      text: `${FreePlayDirector._withArticle(name)} was hunted!`,
      at: () => prey.pos,
      tick: (t, dt) => {
        if (!e) return;
        if (e.alive) e.animTime += dt;   // its wings keep beating
        if (t < dive) { e.hunting = true; e.target = prey; e.state = 'hunting'; return; }   // the dive
        e.hunting = false; e.target = null; e.state = 'patrol';                            // and out of it
        fade = Math.max(0, 1 - (t - dive) / fadeT);
      },
      end: () => {
        if (ownRender) prey.render = ownRender; else delete prey.render;
        if (ownInd) prey.renderIndicators = ownInd; else delete prey.renderIndicators;
        prey._caughtPending = false;
        finish();
      }
    });
  }

  // A shuffled copy of a list (Fisher–Yates). (Not a global: p5 has its own shuffle().)
  static _shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random(i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // The finale ends it (a win, no farewell or "Continue").
  isLastModule() { return false; }
  hasOutro() { return false; }

  // ==========================================================================
  // DRAWING: name tags over Pukepuke and Koukou
  // ==========================================================================
  renderOver() {
    super.renderOver();
    const g = this.game, px = 1 / CONFIG.viewZoom;
    push();
    textAlign(CENTER, BOTTOM);
    if (typeof FreckleFace !== 'undefined') textFont(FreckleFace);
    textSize(15 * px);
    stroke(15, 20, 15, 220);
    strokeWeight(4 * px);
    strokeJoin(ROUND);
    fill(235, 240, 215);
    for (const m of [this.pukepuke, this.koukou]) {
      if (!m || !m.alive) continue;
      const y = g._groundPaintY(m.pos.x, m.pos.y) - m.size * 0.8 - 24 * px;
      text(m.lifeScript.name, m.pos.x, y);
    }
    pop();
    // The finale: a heart over the two of them while they court, fading once the egg is laid.
    const o = this._ending, P = this.pukepuke, K = this.koukou;
    if (o && (o.phase === 'court' || o.phase === 'egg') && P && K) {
      const a = o.phase === 'court' ? Math.min(1, o.t / 30) : Math.max(0, 1 - o.t / this._sec(1.5));
      if (a > 0) {
        const x = (P.pos.x + K.pos.x) / 2, gy = g._groundPaintY(x, (P.pos.y + K.pos.y) / 2);
        const s = (40 + 4 * Math.sin(frameCount * 0.15)) * px;
        push();
        translate(x, gy - Math.max(P.size, K.size) * 0.8 - 70 * px);
        stroke(80, 20, 40, 200 * a);
        strokeWeight(2.5 * px);
        fill(240, 90, 130, 235 * a);
        beginShape();
        vertex(0, s * 0.35);
        bezierVertex(-s * 0.9, -s * 0.2, -s * 0.45, -s * 0.85, 0, -s * 0.4);
        bezierVertex(s * 0.45, -s * 0.85, s * 0.9, -s * 0.2, 0, s * 0.35);
        endShape(CLOSE);
        pop();
      }
    }
  }
}

MODULE_DIRECTORS.freeplay = FreePlayDirector;
