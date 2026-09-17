// ============================================================
// KEA; the alpine parrot  (extends Kereru)
// Nestor notabilis, the world's only alpine parrot and kākā's sister. A strong,
// wide-ranging generalist that forages the high country rather than podocarp fruit.
// Mechanically a flyer (same FLYING → FEEDING → PERCHED → lay loop) with three kea
// differences on the Kereru base:
//   · RANGE. Kea live high by default but DESCEND to the forest in the cold (winter
//     + the deepening coldIndex). _preferredElevBand() slides the target band down;
//     foraging and drifting steer toward it. The Free Play Year-1 hook.
//   · DIET. A generalist: forages any grown plant near it (no FOREST_TREES filter).
//   · NO DISPERSAL. Not a large-seed disperser, so _disperseChance is 0.
// Class declared before its species object so KEA_SPECIES's typeof guard is safe.
// ============================================================

// Berry/browse plants a kea takes as cache food (besides forest fruit); the species a
// Berry Cache seeds across its habitats, so a cache draws the flock wherever it's placed.
const KEA_BERRY_PLANTS = new Set(['coprosma', 'patotara', 'dracophyllum', 'toatoa', 'pohuehue']);

class Kea extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    const sp = (speciesData && speciesData.config) ? speciesData.config : KEA_SPECIES;
    this._bandWarm = sp.bandWarm || { lo: 0.48, hi: 0.66 };
    this._bandCold = sp.bandCold || { lo: 0.34, hi: 0.50 };
    this._descendWinter = sp.descendFromWinter ?? 0.7;
    this._descendCold   = sp.descendFromCold ?? 0.6;
    this._sm = null;   // season manager, stashed each tick so the band helper can read it

    // Egg-raiding: kea rob moa nests, destroying the egg, feeding a little, and seeding
    // a disturbance moa steer away from. A cooldown keeps it opportunistic.
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    this._raidEnabled = !!M.keaRaidsEggs;
    this._raidRadius = M.keaRaidRadius ?? 95;
    this._raidNutrition = M.keaRaidNutrition ?? 46;
    this._raidCooldownFrames = (M.keaRaidCooldownSec ?? 5) * 60;
    this._raidCooldown = Math.random() * this._raidCooldownFrames;

    // Berry Cache choice (emergent flock spread): a kea commits to one cache for a beat,
    // chosen by relative nutrition-per-bird and distance (see _chooseLure).
    this._lureChoice = null;
    this._lureChoiceTimer = Math.random() * 90;         // stagger the first pick across the flock
    this._lureChoiceFrames = (sp.lureChoiceSec ?? 2.5) * 60;
    this._lureBaseNutrition = sp.lureBaseNutrition ?? 6; // a placed cache attracts even before its berries grow
    this._lureCrowdWeight   = sp.lureCrowdWeight ?? 1.0; // ↑ = the flock spreads harder off a crowded cache

    // Perch-tree spread: kea penalise a tree already crowded with kea and favour trees near
    // a moa nesting site, so the flock fans out and stations where a raid can happen.
    this._perchCrowdWeight = sp.perchCrowdWeight ?? 4.0; // ↑ = spread harder off a crowded tree
    this._perchSiteBonus   = sp.perchSiteBonus ?? 6;     // score bonus for a tree near a nesting site
    this._perchLureBonus   = sp.perchLureBonus ?? 8;     // score bonus for a tree inside a berry cache's patch
    // A tree counts as "near a site" out to the raid station radius, so a preferred perch
    // also counts as stationed.
    this._perchSiteRadius  = sp.perchSiteRadius ?? ((M.keaRaid && M.keaRaid.stationRadius) || 240);

    // Social mate-seek (cache flock cascade): a kea not being pulled to a cache drifts
    // toward a nearby cache-bound flockmate, so the cache's draw chains outward through the flock.
    this._mateSeekRadius = sp.mateRadius ?? 220;
    this._mateSeekBoost  = sp.mateSeekBoost ?? 2.4;   // cache-bound leaders draw from this× farther
    this._mateSeekWeight = sp.mateSeekWeight ?? 0.5;  // gentle; below the direct cache pull
  }

  // Stash the season manager so _preferredElevBand can read winterness/coldIndex. After
  // the base loop steers, add a gentle drift toward the preferred elevation band while
  // airborne (the alpine↔forest migration), weak enough that a kea still detours to food.
  behave(sim, mauri, seasonManager, dt) {
    this._sm = seasonManager;
    if (this._raidCooldown > 0) this._raidCooldown -= dt;

    // Perch tree: each kea holds a fruiting forest tree (chosen by nearby food) as its home
    // perch, refreshed when lost or on a timer. _anchorPoint() feeds it to the base loop.
    this._perchSearchTimer = (this._perchSearchTimer || 0) - dt;
    if (!this._perchValid() || this._perchSearchTimer <= 0) {
      this._perchSearchTimer = 120;
      this._choosePerchTree(sim);
    }

    super.behave(sim, mauri, seasonManager, dt);
    if (!this._grounded && !this._fleeingStorm && this.state === KERERU_STATE.FLYING) {
      // A Berry Cache pulls the flock onto the forest patch. The bird holds a committed cache
      // choice (re-picked on a jittered timer), so the flock spreads across caches rather than
      // all chasing the nearest. With no cache and no perch, drift toward the elevation band.
      this._lureChoiceTimer -= dt;
      if (!this._lureValid() || this._lureChoiceTimer <= 0) {
        const prev = this._lureChoice;
        this._lureChoice = this._chooseLure(sim);
        this._lureChoiceTimer = this._lureChoiceFrames * (0.75 + Math.random() * 0.5);
        // Newly committed to a (different) cache → drop the old perch so it re-homes near the cache.
        if (this._lureChoice && this._lureChoice !== prev) {
          this._perchTree = null;
          this._perchSearchTimer = 0;
        }
      }
      const lure = this._lureChoice;
      if (lure) {
        const lr = (lure.def && lure.def.radius) || 70;
        const dx = lure.pos.x - this.pos.x, dy = lure.pos.y - this.pos.y;
        // Only pull toward the cache while still arriving; once on the patch, let the perch
        // anchor + crowd-spread fan the flock across the trees.
        if (dx * dx + dy * dy > lr * lr) {
          this.applyForce(this.seekPoint(lure.pos.x, lure.pos.y, 0.85, lr));
        }
      } else {
        // No cache in reach: follow a nearby cache-bound flockmate (the social cascade), else drift to band.
        const leader = this._seekCacheFlockmate(sim);
        if (leader) {
          this.applyForce(this.seekPoint(leader.pos.x, leader.pos.y, this._mateSeekWeight));
        } else if (!this._perchValid()) {
          const pt = this._bandwardPoint();
          if (pt) this.applyForce(this.seekPoint(pt.x, pt.y, 0.6));
        }
      }
    }
  }

  // The nearest cache-bound flockmate (live _lureChoice) within the boosted mate-seek
  // reach; following it chains the cache's draw outward through the flock. null if none.
  _seekCacheFlockmate(sim) {
    const flock = sim.otherEntities && sim.otherEntities.kea;
    if (!flock || flock.length < 2) return null;
    const r = this._mateSeekRadius * this._mateSeekBoost, rSq = r * r;
    const px = this.pos.x, py = this.pos.y;
    let best = null, bestSq = rSq;
    for (let i = 0; i < flock.length; i++) {
      const o = flock[i];
      if (o === this || !o.alive) continue;
      const c = o._lureChoice;
      if (!c || !c.alive) continue;                 // only a cache-bound leader counts
      const dx = o.pos.x - px, dy = o.pos.y - py, dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = o; }
    }
    return best;
  }

  _perchValid() {
    const p = this._perchTree;
    return !!(p && p.alive && !p._consumed);
  }

  // Home anchor for the base flight loop: the kea's perch tree (kererū is free-ranging).
  _anchorPoint() {
    return this._perchValid() ? this._perchTree.pos : null;
  }

  // A strong flier: a kea crosses alpine scree and glacier to relocate, so only open water
  // bars it (frees a kea stranded on a walkable pocket ringed by alpine rock).
  _passable(x, y) {
    const t = this.terrain;
    if (!t) return true;
    if (typeof t.isWater === 'function') return !t.isWater(x, y);
    return typeof t.isWalkable !== 'function' || t.isWalkable(x, y);
  }

  // Pick the best nearby fruiting forest tree to perch in ("best" = most food around it),
  // so kea gather where the player has grown forest/berries.
  _choosePerchTree(sim) {
    if (!sim.getNearbyPlants) return;
    const isForest = (typeof FOREST_TREES !== 'undefined') ? FOREST_TREES : null;
    if (!isForest) return;
    const trees = sim.getNearbyPlants(this.pos.x, this.pos.y, this._feedRadius * 2.0);
    const flock = (sim.otherEntities && sim.otherEntities.kea) || [];
    const sites = sim.nestingSites || [];
    const crowdR2 = 55 * 55, siteR2 = this._perchSiteRadius * this._perchSiteRadius;

    // If committed to a cache, prefer perches near it so the flock re-homes onto the patch.
    const lure = this._lureValid() ? this._lureChoice : null;
    const lureR2 = lure ? (((lure.def && lure.def.radius) || 70) * 2.2) ** 2 : 0;

    let best = null, bestScore = -Infinity;
    for (let i = 0; i < trees.length; i++) {
      const p = trees[i];
      if (!p.alive || p._consumed || p.dormant || p.growth < 0.5 || !isForest.has(p.type)) continue;
      const near = sim.getNearbyPlants(p.pos.x, p.pos.y, 60);
      let food = 0;
      for (let j = 0; j < near.length; j++) {
        const q = near[j];
        if (q.alive && q.growth >= 0.4 && (isForest.has(q.type) || q.type === 'coprosma')) food++;
      }
      let crowd = 0;
      for (let k = 0; k < flock.length; k++) {
        const o = flock[k];
        if (o === this || !o.alive || !o._perchTree) continue;
        const dx = o._perchTree.pos.x - p.pos.x, dy = o._perchTree.pos.y - p.pos.y;
        if (dx * dx + dy * dy < crowdR2) crowd++;
      }
      let siteBonus = 0;
      for (let s = 0; s < sites.length; s++) {
        const st = sites[s];
        if (!st.alive || (st.eggCount || 0) <= 0) continue;
        const dx = st.pos.x - p.pos.x, dy = st.pos.y - p.pos.y;
        if (dx * dx + dy * dy < siteR2) { siteBonus = this._perchSiteBonus; break; }
      }
      // Cache proximity bonus: a tree within the cache's patch is strongly favoured.
      let lureBonus = 0;
      if (lure) {
        const dx = lure.pos.x - p.pos.x, dy = lure.pos.y - p.pos.y;
        if (dx * dx + dy * dy < lureR2) lureBonus = this._perchLureBonus;
      }
      const score = food + siteBonus + lureBonus - crowd * this._perchCrowdWeight;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) this._perchTree = best;
  }

  // Is the committed cache still a valid target; alive, a cache, and within pull range?
  _lureValid() {
    const c = this._lureChoice;
    if (!c || !c.alive || c.type !== 'keaLure') return false;
    const r = (c.def && c.def.keaAttractRadius) || 520;
    const dx = c.pos.x - this.pos.x, dy = c.pos.y - this.pos.y;
    return dx * dx + dy * dy <= r * r;
  }

  // Choose which in-range Berry Cache to head for. Each is scored by nutrition per bird
  // (food ÷ kea committed) times a distance falloff, so the nearest usually wins but a
  // crowded one sheds birds to emptier/richer/nearer caches.
  _chooseLure(sim) {
    const list = sim.placeables;
    if (!list) return null;
    const px = this.pos.x, py = this.pos.y;
    const caches = [];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.alive || p.type !== 'keaLure') continue;
      const r = (p.def && p.def.keaAttractRadius) || 520;
      const dx = p.pos.x - px, dy = p.pos.y - py, d2 = dx * dx + dy * dy;
      if (d2 <= r * r) caches.push({ c: p, d: Math.sqrt(d2), r });
    }
    if (!caches.length) return null;
    if (caches.length === 1) return caches[0].c;   // one cache in reach; no balancing to do

    // Crowd = kea committed to each cache (a kea en route already counts).
    const flock = (sim.otherEntities && sim.otherEntities.kea) || [];
    const crowd = new Map();
    for (let i = 0; i < flock.length; i++) {
      const k = flock[i];
      if (!k.alive) continue;
      const c = k._lureChoice;
      if (c && c.alive) crowd.set(c, (crowd.get(c) || 0) + 1);
    }

    let best = null, bestScore = -Infinity;
    for (let i = 0; i < caches.length; i++) {
      const cand = caches[i], c = cand.c;
      this._refreshLureFood(sim, c);
      const base = (c.def && c.def.keaLureNutrition != null) ? c.def.keaLureNutrition : this._lureBaseNutrition;
      const nutrition = base + (c._keaFood || 0);
      let n = crowd.get(c) || 0;
      if (c === this._lureChoice && n > 0) n--;             // don't let self count against staying put
      const perCapita = nutrition / (1 + this._lureCrowdWeight * n);
      const distFactor = Math.max(0.08, 1 - cand.d / cand.r); // near → ~1, edge of range → 0.08
      let score = perCapita * distFactor;
      if (c === this._lureChoice) score *= 1.15;            // stickiness: only switch if clearly better
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // Available nutrition at a cache = grown, unconsumed food in its radius. Counted at most
  // ~twice a second and cached on the placeable, so depletion lowers the cache's draw.
  _refreshLureFood(sim, cache) {
    if (!sim.getNearbyPlants) { cache._keaFood = 0; return; }
    const now = (typeof frameCount !== 'undefined') ? frameCount : 0;
    if (cache._keaFoodFrame != null && now - cache._keaFoodFrame < 30) return;
    cache._keaFoodFrame = now;
    const rad = ((cache.def && cache.def.radius) || 70) * 1.5;
    const near = sim.getNearbyPlants(cache.pos.x, cache.pos.y, rad);
    const isForest = (typeof FOREST_TREES !== 'undefined') ? FOREST_TREES : null;
    let food = 0;
    for (let i = 0; i < near.length; i++) {
      const q = near[i];
      if (!q.alive || q._consumed || q.dormant || q.growth < 0.4) continue;
      // Count the cache's berries and forest fruit, so a cache in any habitat draws the flock.
      if (KEA_BERRY_PLANTS.has(q.type) || (isForest && isForest.has(q.type))) food++;
    }
    cache._keaFood = food;
  }

  // Raiding overrides foraging: while airborne and off cooldown, a moa egg in reach makes
  // the kea divert to rob it. Inside _runState so the base bookkeeping still runs.
  _runState(sim, dt) {
    // Player-directed egg raid (tap a moa egg): the assigned kea flies to it and eats it.
    if (this._directedEgg) {
      if (!this._directedEgg.alive || this._directedEgg.hatched) {
        this._directedEgg = null;
      } else {
        this.state = KERERU_STATE.FLYING;
        this._raidStep(sim, this._directedEgg, dt);
        return;
      }
    }
    // Auto-raid (Link 1); OFF in Free Play (keaRaidsEggs:false), kept for other configs.
    if (this._raidEnabled && this._raidCooldown <= 0 && this.state === KERERU_STATE.FLYING) {
      const egg = this._findMoaEgg(sim);
      if (egg) { this._raidStep(sim, egg, dt); return; }
    }
    super._runState(sim, dt);
  }

  // Nearest un-hatched MOA egg within raid range (kea target moa nests, not other birds').
  _findMoaEgg(sim) {
    if (!sim.getNearbyEggs) return null;
    const eggs = sim.getNearbyEggs(this.pos.x, this.pos.y, this._raidRadius);
    const px = this.pos.x, py = this.pos.y;
    let best = null, bestSq = Infinity;
    for (let i = 0; i < eggs.length; i++) {
      const e = eggs[i];
      if (!e.alive || e.hatched) continue;
      if (e.offspringType && e.offspringType !== 'moa') continue;   // only moa nests
      const dx = e.pos.x - px, dy = e.pos.y - py, d2 = dx * dx + dy * dy;
      if (d2 < bestSq) { bestSq = d2; best = e; }
    }
    return best;
  }

  // Fly to the egg; on arrival, rob it, take the meal, start the cooldown, and perch.
  _raidStep(sim, egg, dt) {
    this.maxSpeed = (this.speciesData && this.speciesData.config && this.speciesData.config.baseSpeed) || 0.4;
    const dx = egg.pos.x - this.pos.x, dy = egg.pos.y - this.pos.y;
    if (dx * dx + dy * dy < 13 * 13) {
      if (sim.raidMoaEgg) sim.raidMoaEgg(egg, this);
      const scale = (typeof CONFIG !== 'undefined' && CONFIG.faunaNutritionScale) ? CONFIG.faunaNutritionScale : 1;
      this.hunger = Math.max(0, this.hunger - this._raidNutrition * scale);
      this._raidCooldown = this._raidCooldownFrames;
      this.state = KERERU_STATE.PERCHED;
      this._restTimer = this._restFrames;
      return;
    }
    this._target.set(egg.pos.x, egg.pos.y);
    this.applyForce(this.seek(this._target, 1.2, 20));
  }

  // The nearest walkable step (of 8) whose elevation is closer to the band centre; one
  // pace uphill in the warm, downhill in the cold. null when in-band or nowhere better.
  _bandwardPoint() {
    const t = this.terrain;
    if (!t || typeof t.getElevationAt !== 'function') return null;
    const band = this._preferredElevBand();
    const here = t.getElevationAt(this.pos.x, this.pos.y);
    if (here >= band.lo && here <= band.hi) return null;
    const R = 70;
    let best = null, bestScore = Math.abs(here - band.center);
    for (let i = 0; i < 8; i++) {
      const a = i * (Math.PI / 4);
      const rx = this.pos.x + Math.cos(a) * R, ry = this.pos.y + Math.sin(a) * R;
      if (!this._passable(rx, ry)) continue;   // a kea may step across alpine rock, not water
      const e = t.getElevationAt(rx, ry);
      const s = Math.abs(e - band.center);
      if (s < bestScore) { bestScore = s; best = { x: rx, y: ry }; }
    }
    return best;
  }

  // The elevation band the kea wants right now: high (subalpine) in the warm, dragged
  // down toward the forest refuge in the cold. Blends winterness and coldIndex.
  _preferredElevBand() {
    const sm = this._sm;
    const winter = (sm && typeof sm.getWinterness === 'function') ? sm.getWinterness() : 0;
    const cold   = (sm && typeof sm.coldIndex === 'number') ? sm.coldIndex : 0;
    let descend = this._descendWinter * winter + this._descendCold * cold;
    if (descend < 0) descend = 0; else if (descend > 1) descend = 1;
    const w = this._bandWarm, c = this._bandCold;
    const lo = lerp(w.lo, c.lo, descend);
    const hi = lerp(w.hi, c.hi, descend);
    return { lo, hi, center: (lo + hi) * 0.5 };
  }

  // Generalist forage: any grown plant, but the elevation band decides where it will
  // feed. Overrides the base's FOREST_TREES-only search.
  //   · In-band food is always taken (nearest wins).
  //   · Only out-of-band food + a comfortable bird well outside its band → null, so
  //     _flying falls through to _driftHome and relocates toward the band.
  //   · A hungry bird (or one near its band) eats whatever is closest.
  _findFruitTree(sim) {
    if (!sim.getNearbyPlants) return null;
    const plants = sim.getNearbyPlants(this.pos.x, this.pos.y, this._feedRadius);
    const band = this._preferredElevBand();
    const t = this.terrain;
    const canElev = t && typeof t.getElevationAt === 'function';
    const px = this.pos.x, py = this.pos.y;
    let bestIn = null, bestInSq = Infinity, bestOut = null, bestOutSq = Infinity;
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      if (!p.alive || p._consumed || p.dormant || p.growth < 0.5) continue;
      const dx = p.pos.x - px, dy = p.pos.y - py, dSq = dx * dx + dy * dy;
      let inBand = true;
      if (canElev) { const e = t.getElevationAt(p.pos.x, p.pos.y); inBand = (e >= band.lo && e <= band.hi); }
      if (inBand) { if (dSq < bestInSq) { bestInSq = dSq; bestIn = p; } }
      else        { if (dSq < bestOutSq) { bestOutSq = dSq; bestOut = p; } }
    }
    if (bestIn) return bestIn;                                   // in-band food always preferred
    // Only out-of-band food in reach: a comfortable bird well outside its band returns null
    // (relocate toward the band); a hungry one eats what's here.
    const hungry = this.hunger >= this.maxHunger * 0.7;
    const here = canElev ? t.getElevationAt(px, py) : band.center;
    const farOutside = here < band.lo - 0.05 || here > band.hi + 0.05;
    if (!hungry && farOutside) return null;
    return bestOut;
  }

  // No fruit within reach: climb or descend toward the preferred elevation band.
  _driftHome(sim, dt) {
    const pt = this._bandwardPoint();
    if (pt) this.applyForce(this.seekPoint(pt.x, pt.y, 1.1));
    else this.applyForce(this.wander(dt));
  }

  _getSprite(perched) {
    return (typeof EntitySprites !== 'undefined' && EntitySprites.getKeaSprite)
      ? EntitySprites.getKeaSprite(perched) : null;
  }
}

// ------------------------------------------------------------
// SPECIES DATA; Nestor notabilis. Registered in initializeRegistry.
// ------------------------------------------------------------
const KEA_SPECIES = {
  displayName:    'Kea',
  scientificName: 'Nestor notabilis',
  label:          'kea',
  class:          (typeof Kea !== 'undefined') ? Kea : undefined,
  description:    'The bold alpine parrot; a strong, wide-ranging generalist that drops to the forest in the cold.',
  rarity:         'uncommon',
  highlightColor: [235, 222, 90],   // olive-gold; player highlight

  // Movement / render; a strong flier, wider-ranging than the kererū, but below eagle
  // hunt speed so a chase resolves.
  baseSpeed:        0.40,
  maxForce:         0.06,
  size:             8,
  perceptionRadius: 80,
  cruiseAlt:        30,     // soars higher than the kererū (24)
  perchAlt:         8,

  // Wide-ranging: long legs, not tree-to-tree hops.
  hopRadius:        90,
  feedRadius:       150,
  homeLeash:        0,      // free-ranging (no fixed territory)

  // Generalist forager (the crop is a mouthful of browse, not carried fruit).
  cropCapacity:     1,
  feedSec:          4,
  disperseEverySec: 18,
  restSec:          6,
  disperseChance:   0,      // kea plant no forest; not a large-seed disperser

  // Survival; hardy in the high country; a deep glacial still thins the flock.
  maxHunger:        100,
  hungerRatePerSec: 0.9,
  feedRelief:       68,
  starveSec:        20,

  // Reproduction; sexual, emergent (the Kereru loop).
  maturitySec:      22,
  eggCooldownSec:   40,
  mateRadius:       220,
  reproCheckSec:    3.5,
  maxPopulation:    14,
  populationFloor:  2,

  // Kea-specific: the elevation band the flock targets, and how far the cold drags it
  // down toward the forest.
  bandWarm:   { lo: 0.48, hi: 0.66 },   // subalpine tussock & scrub
  bandCold:   { lo: 0.34, hi: 0.50 },   // dropped down into the forest refuge
  descendFromWinter: 0.7,               // how much seasonal winter pulls it down
  descendFromCold:   0.6,               //   ... and how much the glacial coldIndex does

  // Berry Cache choice; how the flock spreads across multiple caches (see _chooseLure).
  lureChoiceSec:     2.5,               // re-pick a cache at most this often (jittered per bird)
  lureBaseNutrition: 6,                 // a freshly placed cache draws kea even before its berries grow
  lureCrowdWeight:   1.0                // ↑ = the flock balances harder off a crowded cache
};

// Register the kea as a flighted-bird type.
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kea');

if (typeof window !== 'undefined') {
  window.Kea = Kea;
  window.KEA_SPECIES = KEA_SPECIES;
}
