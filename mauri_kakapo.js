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

    // Territorial lek tuning (see behave). Males hold a court and repel rival males.
    const sp = (speciesData && speciesData.config) ? speciesData.config : KAKAPO_SPECIES;
    this._lekRadius = sp.lekRadius ?? 120;
    this._lekRadiusSq = this._lekRadius * this._lekRadius;
    this._territoryPush = sp.territoryPush ?? 0.05;
    this._territoryHold = sp.territoryHold ?? 0.02;
    this._lekAttract = sp.lekAttract ?? 0.03;
    this._territory = null;   // a male's claimed court (set when it first walks the ground)
  }

  // Territorial lek behaviour (a basic version of the real thing). After the base ground
  // loop steers, a MALE holds a spaced court and drives rival males out of it — so males
  // can't pack tightly and a mast year can't hand a runaway population boom (a steadier
  // result when you miss the mast goal, and a clearer payoff for defending a good lek). In
  // a mast a FEMALE drifts toward the nearest male's court to pair. Skipped while a bird is
  // storm-sheltered or not moving, so shelter and feeding aren't fought.
  behave(sim, mauri, seasonManager, dt) {
    super.behave(sim, mauri, seasonManager, dt);
    if (this._grounded || this.state !== KERERU_STATE.FLYING) return;
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    if (!list || list.length < 2) return;
    const px = this.pos.x, py = this.pos.y;

    if (!this.isFemale) {
      if (!this._territory) this._territory = createVector(px, py);
      let rx = 0, ry = 0, n = 0;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (o === this || !o.alive || o.isFemale) continue;
        const dx = px - o.pos.x, dy = py - o.pos.y, dSq = dx * dx + dy * dy;
        if (dSq > 0.01 && dSq < this._lekRadiusSq) {
          const inv = 1 / Math.sqrt(dSq);
          rx += dx * inv; ry += dy * inv; n++;
        }
      }
      if (n > 0) this.applyForce(this.seekPoint(px + rx * 30, py + ry * 30, this._territoryPush));
      this.applyForce(this.seekPoint(this._territory.x, this._territory.y, this._territoryHold));
    } else if (sim.mastYear) {
      let best = null, bestSq = Infinity;
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (!o.alive || o.isFemale) continue;
        const dx = o.pos.x - px, dy = o.pos.y - py, dSq = dx * dx + dy * dy;
        if (dSq < bestSq) { bestSq = dSq; best = o; }
      }
      if (best) this.applyForce(this.seekPoint(best.pos.x, best.pos.y, this._lekAttract));
    }
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
  populationFloor:  2,

  // Territorial lek (kākāpō-specific) — see Kakapo.behave. Males hold spaced courts and
  // drive rival males off, so a mast can't hand a runaway boom (more consistent results);
  // a well-grown, well-spaced lek still breeds and is worth defending.
  lekRadius:      120,     // males keep ~this far apart (repel rival males within it)
  territoryPush:  0.05,    // how hard a male drives rival males out of its court
  territoryHold:  0.02,    // how hard a male holds to its own court
  lekAttract:     0.03     // how hard a mast-year female drifts to the nearest court
};

// Register the kākāpō as a flighted-bird TYPE for egg-hatch routing (Simulation
// ._hatchFlyerEgg reads FLYER_TYPES), even though it never actually flies — the
// hatchling reads isFlyer=false from its own constructor and renders on the ground.
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kakapo');

if (typeof window !== 'undefined') {
  window.Kakapo = Kakapo;
  window.KAKAPO_SPECIES = KAKAPO_SPECIES;
}
