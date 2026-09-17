// ============================================================
// KĀKĀ; the forest parrot  (extends Kereru)
// Nestor meridionalis, kea's forest-dwelling sister. A strong flier of podocarp-
// beech forest. Mechanically a Kereru (same FLYING → FEEDING → PERCHED → lay loop,
// feeding at FOREST_TREES), so the contracting glacial forest refuge squeezes the
// kākā in with the bush moa. Two differences from the kererū:
//   · DISPERSAL. A seed predator more than disperser, so _disperseChance is low
//     (0.25 vs the kererū's 1.0).
//   · GREGARIOUS. A gentle cohesion pulls flying kākā together into foraging parties.
// Class declared before its species object so KAKA_SPECIES's typeof guard is safe.
// ============================================================

class Kaka extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    const sp = (speciesData && speciesData.config) ? speciesData.config : KAKA_SPECIES;
    this._flockRadius = sp.flockRadius ?? 160;
    this._flockRadiusSq = this._flockRadius * this._flockRadius;
    this._flockPull = sp.flockPull ?? 0.35;
  }

  // Gregarious: a flying kākā drifts toward the centroid of nearby kākā. Weak (below
  // forage-seek) so a bird still peels off to feed; skipped while storm-grounded.
  behave(sim, mauri, seasonManager, dt) {
    super.behave(sim, mauri, seasonManager, dt);
    if (!this._grounded && !this._fleeingStorm && this.state === KERERU_STATE.FLYING) {
      const c = this._flockCentroid(sim);
      if (c) this.applyForce(this.seekPoint(c.x, c.y, this._flockPull));
    }
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
  highlightColor: [250, 150, 90],   // warm orange; player highlight

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

  maturitySec:      22,
  eggCooldownSec:   32,     // breeds a little more readily than the kererū base
  mateRadius:       200,
  reproCheckSec:    3.5,
  maxPopulation:    14,
  populationFloor:  2,

  // Gregarious flocking (kākā-specific).
  flockRadius:      160,
  flockPull:        0.35
};

// Register the kākā as a flighted-bird type.
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kaka');

if (typeof window !== 'undefined') {
  window.Kaka = Kaka;
  window.KAKA_SPECIES = KAKA_SPECIES;
}
