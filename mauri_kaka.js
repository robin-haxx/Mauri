// ============================================================
// KĀKĀ; the forest parrot  (extends Kereru)
// Nestor meridionalis, kea's forest-dwelling sister. A strong flier of podocarp-
// beech forest. Mechanically a Kereru (same FLYING → FEEDING → PERCHED → lay loop,
// feeding at FOREST_TREES), so the contracting glacial forest refuge squeezes the
// kākā in with the bush moa. Three differences from the kererū:
//   · DISPERSAL. A seed predator more than disperser, so _disperseChance is low
//     (0.25 vs the kererū's 1.0).
//   · GREGARIOUS. A gentle cohesion pulls flying kākā together into foraging parties.
//   · FOREST-HOMING. The flock's "home" is the forest it feeds in, not just its own centre:
//     it relocates onto the nearest podocarp grove — and, above all, onto a placed Forest
//     Seed (forestBoost) from right across the map — so dropping one visibly draws the flock,
//     and keeping the birds on feedable trees is what lets the population actually grow. This
//     replaces the old pure-centroid home, under which a flock that drifted off the fruit had
//     nothing pulling it back and quietly starved to the floor instead of breeding.
// Class declared before its species object so KAKA_SPECIES's typeof guard is safe.
// ============================================================

class Kaka extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    const sp = (speciesData && speciesData.config) ? speciesData.config : KAKA_SPECIES;
    this._flockRadius = sp.flockRadius ?? 160;
    this._flockRadiusSq = this._flockRadius * this._flockRadius;
    this._flockPull = sp.flockPull ?? 0.35;
    // A lone kākā (no flockmate in cohesion range) pulls toward the NEAREST one at this × the
    // flock pull, so isolated birds rejoin the party — and come into mate range — instead of
    // drifting alone forever (the slow-to-mate case).
    this._rejoinBoost = sp.flockRejoinBoost ?? 1.6;

    // Forest-homing: the flock relocates onto the forest it feeds in, not just its own centre.
    // A shared target (chosen off the flock's centroid so the party moves together) is refreshed
    // on a timer: a placed Forest Seed wins from far off (the clear response to new seed), else
    // the nearest podocarp grove within _forageRange. Fed into _anchorPoint below, so the base
    // loop's drift, dispersal hops and land-return all pull the flock onto feedable trees.
    this._forageRange       = sp.forageRange ?? 620;        // how far the flock senses a grove to relocate toward
    this._seedAttractRange  = sp.seedAttractRange ?? 900;   // a Forest Seed draws the flock from this far (≈ whole view)
    this._forageTarget      = null;                          // {x,y} shared flock home (grove / Forest Seed), or null
    this._forageSearchFrames = (sp.forageSearchSec ?? 1.5) * 60;
    this._forageTimer       = Math.random() * this._forageSearchFrames; // stagger the first search across the flock
  }

  // Gregarious: the flock's centre of mass is the kākā's "home", so the base loop's post-feed
  // hops (_pickHop) and drift (_driftHome) pull it back to the party after every feed — cohesion
  // that persists through the perch/feed cycle, not just during flight. On top of that, a flying
  // kākā also steers toward the flock (or the nearest bird if none is in cohesion range). This is
  // why they flock TIGHT: without the anchor, feeding at scattered trees kept them spread out.
  behave(sim, mauri, seasonManager, dt) {
    const centroid = this._allFlockCentroid(sim);    // flock centre (null when this bird is alone)
    // Refresh the shared forest target off the flock's centre (so the whole party agrees on one
    // grove and stays cohesive while relocating). Throttled + staggered per bird.
    this._forageTimer -= dt;
    if (this._forageTimer <= 0) {
      this._forageTimer = this._forageSearchFrames;
      this._forageTarget = this._findForest(sim, centroid || this.pos);
    }
    // Home = the forest when one is in reach (the flock migrates onto it and feeds), else the
    // flock's own centroid (tight cohesion when no forest is near). read by _anchorPoint below.
    this._flockHome = this._forageTarget || centroid;
    super.behave(sim, mauri, seasonManager, dt);
    if (!this._grounded && !this._fleeingStorm && this.state === KERERU_STATE.FLYING) {
      const c = this._flockCentroid(sim);
      if (c) {
        this.applyForce(this.seekPoint(c.x, c.y, this._flockPull));
      } else {
        // Isolated: no flockmate in cohesion range → head for the nearest one so the flock
        // coalesces and mates come together. Weak enough that a hungry bird still peels to feed.
        const m = this._nearestConspecific(sim);
        if (m) this.applyForce(this.seekPoint(m.pos.x, m.pos.y, this._flockPull * this._rejoinBoost));
      }
    }
  }

  // Flock centre of mass (all living kākā, excluding self), or null when alone. The home anchor.
  _allFlockCentroid(sim) {
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    if (!list) return null;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive) continue;
      sx += o.pos.x; sy += o.pos.y; n++;
    }
    return n ? { x: sx / n, y: sy / n } : null;
  }

  // Home = the forest target when one is in reach (grove / placed Forest Seed), else the flock's
  // centre — so the base flight loop keeps regrouping the flock onto feedable trees, or, with no
  // forest near, onto itself (tight flocking). Set in behave() before super steers.
  _anchorPoint() { return this._flockHome || null; }

  // The forest the flock should home on, measured from `center` (the flock's centre so the choice
  // is shared): a live Forest Seed cultivator within _seedAttractRange wins — dropping one visibly
  // draws the whole flock — else the nearest live forest tree within _forageRange, else null.
  // Growth isn't required for the grove target, so the flock heads for a maturing Forest Seed
  // patch and arrives as it ripens (the base _findFruitTree still gates actual feeding on growth).
  _findForest(sim, center) {
    const cx = center.x, cy = center.y;
    const seed = this._nearestForestSeed(sim, cx, cy);      // read placeables first (own array; no grid buffer)
    if (seed) return { x: seed.pos.x, y: seed.pos.y };
    if (!sim.getNearbyPlants) return null;
    const isForest = (typeof FOREST_TREES !== 'undefined') ? FOREST_TREES : null;
    if (!isForest) return null;
    const near = sim.getNearbyPlants(cx, cy, this._forageRange);
    let best = null, bestSq = Infinity;
    for (let i = 0; i < near.length; i++) {
      const p = near[i];
      if (!p.alive || p._consumed || !isForest.has(p.type)) continue;
      const dx = p.pos.x - cx, dy = p.pos.y - cy, dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = p; }
    }
    return best ? { x: best.pos.x, y: best.pos.y } : null;   // plain {x,y}; don't retain the grid buffer
  }

  // Nearest live Forest Seed (forestBoost) cultivator within _seedAttractRange of (cx,cy), or null.
  // Once it expires the grove it grew takes over as the target (via _findForest), so the flock stays.
  _nearestForestSeed(sim, cx, cy) {
    const list = sim.placeables;
    if (!list) return null;
    let best = null, bestSq = this._seedAttractRange * this._seedAttractRange;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.alive || p.type !== 'forestBoost') continue;
      const dx = p.pos.x - cx, dy = p.pos.y - cy, dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = p; }
    }
    return best;
  }

  // Centroid of living flockmates within _flockRadius (excluding self), or null.
  _flockCentroid(sim) {
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    if (!list) return null;
    const px = this.pos.x, py = this.pos.y;
    let sx = 0, sy = 0, n = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive) continue;
      const dx = o.pos.x - px, dy = o.pos.y - py;
      if (dx * dx + dy * dy <= this._flockRadiusSq) { sx += o.pos.x; sy += o.pos.y; n++; }
    }
    if (n === 0) return null;
    return { x: sx / n, y: sy / n };
  }

  _getSprite(perched) {
    return (typeof EntitySprites !== 'undefined' && EntitySprites.getKakaSprite)
      ? EntitySprites.getKakaSprite(perched) : null;
  }
}

// ------------------------------------------------------------
// SPECIES DATA; Nestor meridionalis. Registered in initializeRegistry.
// ------------------------------------------------------------
const KAKA_SPECIES = {
  displayName:    'Kākā',
  scientificName: 'Nestor meridionalis',
  label:          'kākā',
  class:          (typeof Kaka !== 'undefined') ? Kaka : undefined,
  description:    'The forest parrot; a gregarious podocarp-forest bird, the kea\'s forest-dwelling sister.',
  rarity:         'uncommon',
  highlightColor: SPECIES_UI_COLORS.kaka,  // player highlight

  // Movement / render: a strong forest flier, but below eagle hunt speed so chases resolve.
  baseSpeed:        0.34,
  maxForce:         0.055,
  size:             8,
  perceptionRadius: 70,
  cruiseAlt:        22,
  perchAlt:         8,

  hopRadius:        70,
  feedRadius:       130,
  homeLeash:        0,      // free-ranging within the forest

  // Forest frugivore (inherits FOREST_TREES search), but a poor disperser.
  cropCapacity:     1,
  feedSec:          5,
  disperseEverySec: 20,
  restSec:          7,
  disperseChance:   0.25,   // seed predator > disperser (kererū is 1.0)

  // Survival; tuned so a flock with forest to feed in holds through winter.
  maxHunger:        100,
  hungerRatePerSec: 0.95,
  feedRelief:       78,
  starveSec:        26,

  maturitySec:      27,
  eggCooldownSec:   48,     // grows fast, not many offspring
  mateRadius:       200,
  reproCheckSec:    2.2,    // sample the short crop>0 perch window more often so a near mate isn't missed
  maxPopulation:    14,
  populationFloor:  2,
  sexAgnosticBelow: 4,      // under this population, mate-seeking ignores sex (rescue a tiny flock)

  // Gregarious flocking (kākā-specific). flockRadius MUST exceed mateRadius (200): the cohesion
  // pull has to engage while birds are still within breeding distance, or the flock plateaus just
  // outside mate range and never pairs (the "kākā won't mate" bug). flockPull is strong enough to
  // gather a foraging party tight within that range, but stays below the forage seek (1.0) so a
  // hungry bird still peels off to feed.
  flockRadius:      240,
  flockPull:        0.7,    // stronger in-flight cohesion; the flock-centre anchor does the rest
  flockRejoinBoost: 1.6,    // a lone bird pulls this × harder toward the nearest flockmate to rejoin

  // Forest-homing (kākā-specific; see _findForest). The flock relocates onto the forest it feeds
  // in — new podocarp groves and, above all, a placed Forest Seed — so the flock responds to seed
  // and stays on the fruit that lets it breed. seedAttractRange spans ≈ the whole view so dropping
  // a Forest Seed anywhere on screen draws the flock; forageRange is the shorter reach to an
  // already-grown grove.
  forageRange:      620,
  seedAttractRange: 900,
  forageSearchSec:  1.5
};

// Register the kākā as a flighted-bird type.
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kaka');

if (typeof window !== 'undefined') {
  window.Kaka = Kaka;
  window.KAKA_SPECIES = KAKA_SPECIES;
}
