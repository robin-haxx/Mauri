// ============================================================
// KĀKĀPŌ — the flightless mast-breeder  (extends Kereru)
// ------------------------------------------------------------
// Strigops habroptilus. The heavy, nocturnal, FLIGHTLESS ground parrot — a moss-
// green herbivore that walks the forest floor browsing leaves, stems, rhizomes and
// fruit. Two things define it, and both are built here:
//
//   · FLIGHTLESS. It reuses the Kereru state machine for its forage → feed → rest
//     loop, but never leaves the ground: isFlyer is false (so it renders in the
//     ground pass, under the trees, not above them) and its altitude is pinned to
//     zero, so the "flight" is a slow walk. It also does NOT flee a raptor — kākāpō
//     freeze and rely on camouflage (their undoing against mammals, but authentic
//     against a diurnal eagle that hunts moa, not them).
//   · MAST BREEDING. Kākāpō breed ONLY in a rimu/podocarp MAST YEAR — the single
//     most important fact about them, and the payoff for the player's Mast Year
//     item (Game.triggerMastYear → sim.mastYear). Outside a mast the population only
//     holds or slowly declines; buy a mast and it surges. _tryReproduce gates on
//     sim.mastYear, then defers to the base (which already boosts the flock cap and
//     shortens the cooldown during a mast).
//
// A generalist ground forager (any plant, not just FOREST_TREES). Class declared
// BEFORE its species object so KAKAPO_SPECIES's `typeof Kakapo` guard doesn't hit
// the class's temporal dead zone.
//
// Placeholder art: a drawn glyph — plump moss-green body, pale owl-like facial disc.
// Wire real art via EntitySprites.getKakapoSprite later.
// ============================================================

class Kakapo extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    // Flightless: render on the ground (under trees), never lift off.
    this.isFlyer = false;
    this._cruiseAlt = 0;
    this._perchAlt = 0;
    this._altitude = 0;
  }

  // Kākāpō do NOT flee a hunting raptor — they freeze and rely on camouflage. The
  // base would otherwise burst into a panic "flight"; returning false keeps the
  // ordinary ground loop (and the diurnal eagle hunts moa, not this nocturnal bird).
  _fleeHarrier(sim, dt) { return false; }

  // Generalist ground forage: nearest grown plant of ANY type (leaves, stems,
  // rhizomes, fruit), not the base's FOREST_TREES-only fruit search.
  _findFruitTree(sim) {
    if (!sim.getNearbyPlants) return null;
    const plants = sim.getNearbyPlants(this.pos.x, this.pos.y, this._feedRadius);
    const px = this.pos.x, py = this.pos.y;
    let best = null, bestSq = Infinity;
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      if (!p.alive || p._consumed || p.dormant || p.growth < 0.5) continue;
      const dx = p.pos.x - px, dy = p.pos.y - py, dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = p; }
    }
    return best;
  }

  // Breeds ONLY in a rimu mast year — the payoff for the Mast Year item. Outside a
  // mast, no laying at all; during one, the base handles the surge (raised cap +
  // shortened cooldown for a well-fed, paired, mature female).
  _tryReproduce(sim) {
    if (!(sim && sim.mastYear)) return;
    return super._tryReproduce(sim);
  }

  _getSprite(perched) {
    return (typeof EntitySprites !== 'undefined' && EntitySprites.getKakapoSprite)
      ? EntitySprites.getKakapoSprite(perched) : null;
  }
}

// ------------------------------------------------------------
// SPECIES DATA — Strigops habroptilus. Registered as its own base type + species in
// initializeRegistry (mauri_sketch.js), carrying class: Kakapo.
// ------------------------------------------------------------
const KAKAPO_SPECIES = {
  displayName:    'Kākāpō',
  scientificName: 'Strigops habroptilus',
  label:          'kākāpō',
  class:          (typeof Kakapo !== 'undefined') ? Kakapo : undefined,
  description:    'The flightless, nocturnal ground parrot — the heaviest parrot alive, and a rimu-mast breeder.',
  rarity:         'rare',
  highlightColor: [150, 190, 90],   // moss green — player highlight (pulse + UI border)

  // Movement / render — a slow, heavy WALKER pinned to the ground (no flight).
  baseSpeed:        0.12,
  maxForce:         0.04,
  size:             7.5,
  perceptionRadius: 60,
  cruiseAlt:        0,      // flightless
  perchAlt:         0,

  hopRadius:        45,     // short ground amble
  feedRadius:       110,
  homeLeash:        0,

  // Generalist herbivore (browses leaves/stems/rhizomes/fruit); passes a little seed.
  cropCapacity:     1,
  feedSec:          6,
  disperseEverySec: 24,
  restSec:          10,
  disperseChance:   0.15,

  // Survival — an efficient herbivore and famously long-lived, so it holds between
  // masts: low hunger rate, slow to starve, and a floor so a lineage persists.
  maxHunger:        100,
  hungerRatePerSec: 0.9,
  feedRelief:       72,
  starveSec:        24,

  // Reproduction — the base loop, but GATED to mast years by _tryReproduce.
  maturitySec:      30,    // slow to mature
  eggCooldownSec:   50,
  mateRadius:       180,
  reproCheckSec:    4,
  maxPopulation:    10,
  populationFloor:  2
};

// Register the kākāpō as a flighted-bird TYPE for egg-hatch routing (Simulation
// ._hatchFlyerEgg reads FLYER_TYPES), even though it never actually flies — the
// hatchling reads isFlyer=false from its own constructor and renders on the ground.
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kakapo');

if (typeof window !== 'undefined') {
  window.Kakapo = Kakapo;
  window.KAKAPO_SPECIES = KAKAPO_SPECIES;
}
