// ============================================================
// KĀKĀ — the forest parrot  (extends Kereru)
// ------------------------------------------------------------
// Nestor meridionalis, kea's forest-dwelling sister species (both Nestor). A
// strong flier of tall podocarp–beech forest: it works the canopy for fruit,
// seeds, nectar and sap, and nests in cavities in big old trees. Mechanically it
// is a Kereru — the same FLYING → FEEDING → PERCHED → lay loop, feeding at
// FOREST_TREES (beech/rimu/fern) — so as the glacial forest refuge contracts, the
// kākā are squeezed into it with the bush moa. That IS the forest-refuge pressure
// the Free Play cycle is built on; no elevation logic needed (unlike its alpine
// cousin the kea, which ranges high and drops down only in the cold).
//
// Two things make it a kākā, not a kererū:
//   · DISPERSAL. Kākā are seed PREDATORS more than dispersers — they crush and eat
//     seed and take nectar/sap — so _disperseChance is low (0.25) versus the
//     kererū's 1.0. The forest still recruits where kākā go, but far less.
//   · GREGARIOUS. Kākā are noisy, social flock birds. A gentle cohesion pulls a
//     flying kākā toward nearby kākā, so they gather into loose foraging parties —
//     the opposite of the kōkako's territorial spacing.
//
// Reproduction is the emergent, sexual Kereru loop (a fed, mature female with a
// mate nearby lays). Class declared BEFORE its species object so KAKA_SPECIES's
// `typeof Kaka` guard doesn't hit the class's temporal dead zone.
//
// Placeholder art: a drawn glyph — olive-brown body, grey crown, crimson underwing
// flash and reddish belly. Wire real art via EntitySprites.getKakaSprite later.
// ============================================================

class Kaka extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    const sp = (speciesData && speciesData.config) ? speciesData.config : KAKA_SPECIES;
    this._flockRadius = sp.flockRadius ?? 160;
    this._flockRadiusSq = this._flockRadius * this._flockRadius;
    this._flockPull = sp.flockPull ?? 0.35;
  }

  // Gregarious: after the base state machine steers, a flying kākā drifts gently
  // toward the centroid of nearby kākā, so the flock gathers into loose parties.
  // Weak (below the forage-seek weight) so a bird still peels off to feed, and
  // skipped while storm-grounded so shelter isn't fought.
  behave(sim, mauri, seasonManager, dt) {
    super.behave(sim, mauri, seasonManager, dt);
    if (!this._grounded && !this._fleeingStorm && this.state === KERERU_STATE.FLYING) {
      const c = this._flockCentroid(sim);
      if (c) this.applyForce(this.seekPoint(c.x, c.y, this._flockPull));
    }
  }

  // Centroid of living flockmates within _flockRadius (excluding self), or null if
  // none near. A direct list scan — the flock is small and only checked while flying.
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
// SPECIES DATA — Nestor meridionalis. Registered as its own base type + species in
// initializeRegistry (mauri_sketch.js), carrying class: Kaka.
// ------------------------------------------------------------
const KAKA_SPECIES = {
  displayName:    'Kākā',
  scientificName: 'Nestor meridionalis',
  label:          'kākā',
  class:          (typeof Kaka !== 'undefined') ? Kaka : undefined,
  description:    'The forest parrot — a gregarious podocarp-forest bird, the kea\'s forest-dwelling sister.',
  rarity:         'uncommon',
  highlightColor: [250, 150, 90],   // bright warm orange — player highlight (pulse + UI border)

  // Movement / render — a strong forest flier, wider-ranging than the kererū's
  // short hops, but still BELOW the eagle's hunt speed so a chase resolves.
  baseSpeed:        0.34,
  maxForce:         0.055,
  size:             6,
  perceptionRadius: 70,
  cruiseAlt:        22,
  perchAlt:         8,

  hopRadius:        70,
  feedRadius:       130,
  homeLeash:        0,      // free-ranging within the forest

  // Forest frugivore (inherits the base FOREST_TREES search — beech/rimu/fern), but
  // a poor disperser: it crushes seed and takes nectar/sap more than it plants forest.
  cropCapacity:     1,
  feedSec:          5,
  disperseEverySec: 20,
  restSec:          7,
  disperseChance:   0.25,   // seed predator > disperser (kererū is 1.0)

  // Survival — tuned so a flock WITH podocarp forest to feed in holds through winter
  // rather than dwindling: a gentler hunger burn, a fuller feed, and slower to starve.
  // (A small static populationFloor in the Free Play level also stops a total die-off.)
  maxHunger:        100,
  hungerRatePerSec: 0.95,
  feedRelief:       78,
  starveSec:        26,

  maturitySec:      22,
  eggCooldownSec:   32,     // breeds a little more readily than the kererū base (was 40)
  mateRadius:       200,
  reproCheckSec:    3.5,
  maxPopulation:    14,
  populationFloor:  2,

  // Gregarious flocking (kākā-specific).
  flockRadius:      160,
  flockPull:        0.35
};

// Register the kākā as a flighted-bird type (routes egg hatch + the render pass).
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kaka');

if (typeof window !== 'undefined') {
  window.Kaka = Kaka;
  window.KAKA_SPECIES = KAKA_SPECIES;
}
