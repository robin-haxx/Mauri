// ============================================================
// KEA — the alpine parrot  (extends Kereru)
// ------------------------------------------------------------
// Nestor notabilis. The world's only alpine parrot and kākā's sister species
// (both Nestor). A strong, wide-ranging flier — the opposite of the kererū's
// short tree-to-tree hops — and a bold generalist: it browses, digs and picks
// over the high country rather than living off podocarp fruit. So mechanically
// it IS a flyer (the same FLYING → FEEDING → PERCHED → lay loop), but with three
// kea differences layered on the Kereru base:
//
//   · RANGE. Kea live high — subalpine tussock and scrub — by default, but they
//     DESCEND to the forest below in the cold (winter, and the deepening glacial
//     coldIndex). _preferredElevBand() slides its target band down as it gets
//     colder; foraging and drifting both steer toward that band. This is the
//     Free Play Year-1 hook: protect the kea so they can shelter — and nest —
//     downslope in the forest refuge when winter closes in.
//   · DIET. A generalist: it forages ANY grown plant near it (no FOREST_TREES
//     filter), biased toward its current elevation band.
//   · NO DISPERSAL. Kea are not large-seed dispersers (that is the kererū's job),
//     so _disperseChance is 0 — it still feeds, perches and breeds, planting no
//     forest as it goes.
//
// Reproduction is the emergent, sexual Kereru loop (a fed, mature female with a
// mate nearby lays). Because breeding happens wherever the bird is perched, the
// cold-driven descent means kea nest low in a hard winter — the ecology the
// Year-1 focus is built around.
//
// Class is declared BEFORE its species object (like the kōkako) so KEA_SPECIES's
// `typeof Kea` guard doesn't hit the class's temporal dead zone.
//
// Placeholder art: a drawn glyph — olive-green body, scarlet underwing flash in
// flight, dark hooked beak. Wire real art via EntitySprites.getKeaSprite later.
// ============================================================

class Kea extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    const sp = (speciesData && speciesData.config) ? speciesData.config : KEA_SPECIES;
    this._bandWarm = sp.bandWarm || { lo: 0.48, hi: 0.66 };
    this._bandCold = sp.bandCold || { lo: 0.34, hi: 0.50 };
    this._descendWinter = sp.descendFromWinter ?? 0.7;
    this._descendCold   = sp.descendFromCold ?? 0.6;
    this._sm = null;   // season manager, stashed each tick so the band helper can read it

    // Egg-raiding (LINK 1): kea rob moa nests — it destroys the egg, feeds the kea a
    // little, and (via the sim) seeds a disturbance moa steer away from. A cooldown
    // keeps it opportunistic rather than obsessive.
    const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
    this._raidEnabled = !!M.keaRaidsEggs;
    this._raidRadius = M.keaRaidRadius ?? 95;
    this._raidNutrition = M.keaRaidNutrition ?? 46;
    this._raidCooldownFrames = (M.keaRaidCooldownSec ?? 5) * 60;
    this._raidCooldown = Math.random() * this._raidCooldownFrames;

    // Berry Cache choice (emergent flock spread). A kea doesn't blindly seek the NEAREST
    // cache; it COMMITS to one for a beat, chosen by relative nutrition-per-bird and
    // distance (see _chooseLure). Committing damps flapping; staggered timers + the
    // crowd term let the flock rebalance across caches instead of piling on one.
    this._lureChoice = null;
    this._lureChoiceTimer = Math.random() * 90;         // stagger the first pick across the flock
    this._lureChoiceFrames = (sp.lureChoiceSec ?? 2.5) * 60;
    this._lureBaseNutrition = sp.lureBaseNutrition ?? 6; // a placed cache attracts even before its berries grow
    this._lureCrowdWeight   = sp.lureCrowdWeight ?? 1.0; // ↑ = the flock spreads harder off a crowded cache

    // Perch-tree spread (Slice C): kea don't all pile onto the single richest tree by a
    // cache — they penalise a tree already crowded with kea, and favour trees near a moa
    // nesting site, so the flock fans out across the forest and stations where a raid can
    // actually happen (rather than clumping at the cache and softlocking the raid).
    this._perchCrowdWeight = sp.perchCrowdWeight ?? 4.0; // ↑ = spread harder off a crowded tree
    this._perchSiteBonus   = sp.perchSiteBonus ?? 6;     // score bonus for a tree near a nesting site
    // A tree counts as "near a site" out to the RAID station radius, so a preferred perch
    // is always one that also counts as stationed (they were settling just outside it).
    this._perchSiteRadius  = sp.perchSiteRadius ?? ((M.keaRaid && M.keaRaid.stationRadius) || 240);
  }

  // Stash the season manager so _preferredElevBand (reached deep in the base state
  // machine, which doesn't pass it down) can read winterness / coldIndex. Then, once
  // the base state machine has steered for the tick, add a gentle, PERSISTENT drift
  // toward the preferred elevation band while airborne — the alpine↔forest seasonal
  // migration. It is deliberately weak (below the forage-seek weight) so a kea still
  // detours to nearby food, but over a season it lifts the flock into the subalpine
  // in the warm and settles it into the forest refuge in the cold. Skipped while
  // storm-grounded so shelter isn't fought.
  behave(sim, mauri, seasonManager, dt) {
    this._sm = seasonManager;
    if (this._raidCooldown > 0) this._raidCooldown -= dt;

    // Perch tree (Slice C): each kea holds a fruiting FOREST tree, chosen by the food
    // around it, as its home perch — this is what "stations" the flock near a spot.
    // Refreshed when it's lost or on a timer. _anchorPoint() feeds it to the base
    // loop so the bird orbits and returns to it.
    this._perchSearchTimer = (this._perchSearchTimer || 0) - dt;
    if (!this._perchValid() || this._perchSearchTimer <= 0) {
      this._perchSearchTimer = 120;
      this._choosePerchTree(sim);
    }

    super.behave(sim, mauri, seasonManager, dt);
    if (!this._grounded && this.state === KERERU_STATE.FLYING) {
      // A Berry Cache (kea lure) placed downslope outranks everything — it pulls the
      // flock onto the forest patch to settle. The bird holds a COMMITTED choice of
      // cache (re-picked on a jittered timer, or when the choice dies / leaves range),
      // so the flock spreads across caches by relative nutrition + distance rather than
      // all chasing the nearest one. Else, if the bird has no perch yet, drift toward
      // the elevation band to go find forest. With a perch, the anchor (via _anchorPoint)
      // keeps it home — no extra force needed.
      this._lureChoiceTimer -= dt;
      if (!this._lureValid() || this._lureChoiceTimer <= 0) {
        this._lureChoice = this._chooseLure(sim);
        this._lureChoiceTimer = this._lureChoiceFrames * (0.75 + Math.random() * 0.5);
      }
      const lure = this._lureChoice;
      if (lure) {
        const lr = (lure.def && lure.def.radius) || 70;
        const dx = lure.pos.x - this.pos.x, dy = lure.pos.y - this.pos.y;
        // Only pull toward the cache while still ARRIVING; once on the patch, let the perch
        // anchor + crowd-spread fan the flock across the trees (don't pile on the centre —
        // that clumping was leaving too few kea stationed at a nest to raid).
        if (dx * dx + dy * dy > lr * lr) {
          this.applyForce(this.seekPoint(lure.pos.x, lure.pos.y, 0.85, lr));
        }
      } else if (!this._perchValid()) {
        const pt = this._bandwardPoint();
        if (pt) this.applyForce(this.seekPoint(pt.x, pt.y, 0.6));
      }
    }
  }

  _perchValid() {
    const p = this._perchTree;
    return !!(p && p.alive && !p._consumed);
  }

  // Home anchor for the base flight loop: the kea's perch tree (kererū is free-ranging).
  _anchorPoint() {
    return this._perchValid() ? this._perchTree.pos : null;
  }

  // Pick the best nearby fruiting FOREST tree to perch in — "best" = the one with the
  // most food (other fruiting trees + berries) around it, so kea gather where the
  // player has grown forest/berries (a Berry Cache patch).
  _choosePerchTree(sim) {
    if (!sim.getNearbyPlants) return;
    const isForest = (typeof FOREST_TREES !== 'undefined') ? FOREST_TREES : null;
    if (!isForest) return;
    // Search a bit wider than before so a kea can reach a spread-out or site-adjacent tree.
    const trees = sim.getNearbyPlants(this.pos.x, this.pos.y, this._feedRadius * 2.0);
    const flock = (sim.otherEntities && sim.otherEntities.kea) || [];
    const sites = sim.nestingSites || [];
    const crowdR2 = 55 * 55, siteR2 = this._perchSiteRadius * this._perchSiteRadius;
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < trees.length; i++) {
      const p = trees[i];
      if (!p.alive || p._consumed || p.dormant || p.growth < 0.5 || !isForest.has(p.type)) continue;
      // Food around the tree.
      const near = sim.getNearbyPlants(p.pos.x, p.pos.y, 60);
      let food = 0;
      for (let j = 0; j < near.length; j++) {
        const q = near[j];
        if (q.alive && q.growth >= 0.4 && (isForest.has(q.type) || q.type === 'coprosma')) food++;
      }
      // Crowd term: other kea already perched on/near this tree — spread off crowded trees.
      let crowd = 0;
      for (let k = 0; k < flock.length; k++) {
        const o = flock[k];
        if (o === this || !o.alive || !o._perchTree) continue;
        const dx = o._perchTree.pos.x - p.pos.x, dy = o._perchTree.pos.y - p.pos.y;
        if (dx * dx + dy * dy < crowdR2) crowd++;
      }
      // Site bonus: favour trees near a moa nesting site (so the flock stations to raid).
      let siteBonus = 0;
      for (let s = 0; s < sites.length; s++) {
        const st = sites[s];
        if (!st.alive) continue;
        const dx = st.pos.x - p.pos.x, dy = st.pos.y - p.pos.y;
        if (dx * dx + dy * dy < siteR2) { siteBonus = this._perchSiteBonus; break; }
      }
      const score = food + siteBonus - crowd * this._perchCrowdWeight;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) this._perchTree = best;
  }

  // Is the committed cache still a valid target — alive, a cache, and within pull range?
  _lureValid() {
    const c = this._lureChoice;
    if (!c || !c.alive || c.type !== 'keaLure') return false;
    const r = (c.def && c.def.keaAttractRadius) || 520;
    const dx = c.pos.x - this.pos.x, dy = c.pos.y - this.pos.y;
    return dx * dx + dy * dy <= r * r;
  }

  // Choose which in-range Berry Cache to head for. Emergent flock spread: each cache is
  // scored by its RELATIVE NUTRITION PER BIRD (available food ÷ how many kea are already
  // committed to it) times a DISTANCE falloff (closer is better). So the nearest cache
  // usually wins — but as it crowds, its per-bird share drops, and a re-picking kea will
  // prefer a less-crowded (or richer, or nearer) cache instead: some peel off to the
  // others. A freshly placed cache starts empty (crowd 0) with a base draw, so nearby
  // kea migrate onto it even before its berries grow. (placeables/flock lists are tiny.)
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
    if (caches.length === 1) return caches[0].c;   // one cache in reach — no balancing to do

    // Crowd = kea currently committed to each cache (assignment-based, so a kea still
    // EN ROUTE already counts — this pre-empts everyone piling on before arrivals show).
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

  // Available nutrition at a cache = grown, unconsumed food (kea browse coprosma berries
  // and forest fruit) within its radius. Counted at most ~twice a second and cached ON
  // the placeable, so the whole flock shares one count and depletion (kea eating it down)
  // lowers the cache's draw on its own — an emergent second reason to spread out.
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
      if (q.type === 'coprosma' || (isForest && isForest.has(q.type))) food++;
    }
    cache._keaFood = food;
  }

  // Raiding is an alternative to the base "fly to a plant" action: while airborne and
  // off cooldown, a moa egg within reach outranks foraging — the kea diverts to rob
  // it. Keeping this inside _runState (not behave) preserves all the base bookkeeping
  // (hunger, ageing, starvation, landward/edges) that behave runs around it.
  _runState(sim, dt) {
    // Player-DIRECTED egg raid (tap a moa egg): the assigned kea flies to it and eats
    // it, whatever the auto-raid flag says. Cleared when the egg is gone.
    if (this._directedEgg) {
      if (!this._directedEgg.alive || this._directedEgg.hatched) {
        this._directedEgg = null;
      } else {
        this.state = KERERU_STATE.FLYING;
        this._raidStep(sim, this._directedEgg, dt);
        return;
      }
    }
    // Auto-raid (Link 1) — OFF in Free Play (keaRaidsEggs:false), kept for other configs.
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

  // Fly to the egg; on arrival, rob it (sim destroys it + seeds disturbance), take the
  // meal, start the cooldown, and perch a beat.
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

  // The nearest walkable step (of 8 sampled) whose elevation is closer to the
  // preferred band centre than where the bird stands — i.e. one pace uphill in the
  // warm, downhill in the cold. null when already in-band or nowhere better. Shared
  // by the persistent drift (behave) and the no-forage relocation (_driftHome).
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
      if (typeof t.isWalkable === 'function' && !t.isWalkable(rx, ry)) continue;
      const e = t.getElevationAt(rx, ry);
      const s = Math.abs(e - band.center);
      if (s < bestScore) { bestScore = s; best = { x: rx, y: ry }; }
    }
    return best;
  }

  // The elevation band the kea wants to be in right now. Warm → high (subalpine);
  // cold → dragged down toward the forest refuge. Blends by BOTH the seasonal
  // winterness and the deepening glacial coldIndex.
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

  // Generalist forage: any grown plant of ANY type (kea are not frugivores), but the
  // elevation band decides WHERE it is willing to feed, so the flock trends high in
  // the warm and drops to the forest in the cold. Overrides the base's
  // FOREST_TREES-only fruit search, which _flying calls through `this.`.
  //   · In-band food is always taken (nearest wins).
  //   · If only out-of-band food is in reach and the bird is comfortable AND well
  //     outside its band, it returns null so _flying falls through to _driftHome and
  //     relocates toward the band instead of feeding at the wrong altitude.
  //   · A hungry bird (or one already near its band) eats whatever is closest —
  //     survival overrides the habitat preference, so kea never starve beside food.
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
    // Only out-of-band food in reach: a COMFORTABLE bird well outside its band
    // returns null so _flying falls through to _driftHome and relocates toward the
    // band; a HUNGRY bird (or one already near its band) eats what's here — survival
    // overrides the habitat preference, so kea never starve marching to sparse high
    // ground (which on this map would defeat the point of protecting them).
    const hungry = this.hunger >= this.maxHunger * 0.7;
    const here = canElev ? t.getElevationAt(px, py) : band.center;
    const farOutside = here < band.lo - 0.05 || here > band.hi + 0.05;
    if (!hungry && farOutside) return null;
    return bestOut;
  }

  // No fruit within reach: instead of the base idle wander, climb or descend
  // decisively toward the preferred elevation band — the alpine↔forest migration.
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
// SPECIES DATA — Nestor notabilis. Registered as its own base type + species in
// initializeRegistry (mauri_sketch.js), carrying class: Kea.
// ------------------------------------------------------------
const KEA_SPECIES = {
  displayName:    'Kea',
  scientificName: 'Nestor notabilis',
  label:          'kea',
  class:          (typeof Kea !== 'undefined') ? Kea : undefined,
  description:    'The bold alpine parrot — a strong, wide-ranging generalist that drops to the forest in the cold.',
  rarity:         'uncommon',
  highlightColor: [178, 168, 60],   // olive-gold — player highlight (pulse + UI border)

  // Movement / render — a strong flier that soars higher and ranges wider than the
  // kererū, but still kept BELOW the eagle's hunt speed so a chase resolves.
  baseSpeed:        0.40,
  maxForce:         0.06,
  size:             6.5,
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
  disperseChance:   0,      // kea plant no forest — not a large-seed disperser

  // Survival — hardy in the high country; a deep glacial still thins the flock.
  maxHunger:        100,
  hungerRatePerSec: 1.1,
  feedRelief:       68,
  starveSec:        20,

  // Reproduction — sexual, emergent (the Kereru loop).
  maturitySec:      22,
  eggCooldownSec:   40,
  mateRadius:       220,
  reproCheckSec:    3.5,
  maxPopulation:    14,
  populationFloor:  2,

  // Kea-specific: the elevation band the flock targets, and how far the cold
  // drags it down toward the forest. Warm band ≈ subalpine; cold band ≈ forest
  // refuge (see the freeplay biomes). Tunable.
  bandWarm:   { lo: 0.48, hi: 0.66 },   // subalpine tussock & scrub
  bandCold:   { lo: 0.34, hi: 0.50 },   // dropped down into the forest refuge
  descendFromWinter: 0.7,               // how much seasonal winter pulls it down
  descendFromCold:   0.6,               //   ... and how much the glacial coldIndex does

  // Berry Cache choice — how the flock spreads across MULTIPLE caches (mauri_kea.js
  // _chooseLure). Each in-range cache scores as (lureBaseNutrition + food) ÷
  // (1 + lureCrowdWeight · kea already committed), times a distance falloff, so the
  // nearest usually wins but a crowded one sheds birds to emptier/richer/nearer caches.
  lureChoiceSec:     2.5,               // re-pick a cache at most this often (jittered per bird)
  lureBaseNutrition: 6,                 // a freshly placed cache draws kea even before its berries grow
  lureCrowdWeight:   1.0                // ↑ = the flock balances harder off a crowded cache
};

// Register the kea as a flighted-bird type (routes egg hatch + the render pass).
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kea');

if (typeof window !== 'undefined') {
  window.Kea = Kea;
  window.KEA_SPECIES = KEA_SPECIES;
}
