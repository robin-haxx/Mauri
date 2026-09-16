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

    // Territorial lek tuning (see behave). Males hold a court, drive rival males off, and burn
    // energy doing it. Fern shelters draw un-settled birds so the player can distribute the flock.
    const sp = (speciesData && speciesData.config) ? speciesData.config : KAKAPO_SPECIES;
    this._lekRadius = sp.lekRadius ?? 140;
    this._lekRadiusSq = this._lekRadius * this._lekRadius;
    this._territoryPush = sp.territoryPush ?? 0.06;
    this._territoryHold = sp.territoryHold ?? 0.02;
    this._lekAttract = sp.lekAttract ?? 0.03;
    this._territory = null;   // a male's claimed court (set when it settles — at a shelter if one's near)
    // Hunger burned each frame a male is actively contesting (chasing a rival / being driven off),
    // so packing males tight is costly and the flock spaces out.
    this._territoryHungerCost = (sp.territoryHungerCostPerSec ?? 0.8) / 60;
    // Fern-shelter attraction: an un-settled kākāpō drifts to the nearest shelter (selective —
    // only kākāpō), letting the player seed leks / spread the population by placing shelters.
    this._shelterAttract = sp.shelterAttract ?? 0.05;
    this._shelterAttractRadius = sp.shelterAttractRadius ?? 360;
    this._settled = false;    // has this bird settled (male: claimed a court; female: reached a spot)
    this._settleTimer = 0;    // grace before a male with no shelter claims where it stands
  }

  // Territorial lek behaviour. After the base ground loop steers:
  //   · A MALE first SETTLES a court — walking to a nearby fern shelter to claim it there if one
  //     is in reach (so the player seeds leks by placing shelters), else claiming where it stands.
  //     Once settled it HOLDS the court and actively DRIVES RIVAL MALES OFF: it charges an
  //     intruder inside its court and retreats when it strays into a neighbour's — a real chase
  //     that BURNS HUNGER, so males can't pack tight (a runaway mast boom is checked, and a
  //     well-spaced lek is worth defending).
  //   · A FEMALE drifts to the nearest male's court in a mast to pair; otherwise the fern
  //     shelters draw her too, so the player can spread the flock out.
  // Skipped while storm-sheltered or not walking, so shelter and feeding aren't fought.
  behave(sim, mauri, seasonManager, dt) {
    super.behave(sim, mauri, seasonManager, dt);
    // (A flightless kākāpō is never storm-flushed — _fleeStorm ignores non-flyers — but keep
    // the guard for parity with the other parrots.)
    if (this._grounded || this._fleeingStorm || this.state !== KERERU_STATE.FLYING) return;
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    const px = this.pos.x, py = this.pos.y;

    if (!this.isFemale) {
      if (!this._settled) {
        // Still un-settled: drift to a fern shelter to claim a court THERE (the player seeds
        // leks with shelters), else settle where it stands after a grace. No court is held yet,
        // so nothing fights the shelter pull.
        const shelter = this._nearestFernShelter(sim);
        if (shelter) {
          this.applyForce(this.seekPoint(shelter.pos.x, shelter.pos.y, this._shelterAttract));
          const dx = shelter.pos.x - px, dy = shelter.pos.y - py, sr = shelter.radius || 50;
          if (dx * dx + dy * dy <= sr * sr) this._settle();
        } else {
          this._settleTimer += dt;
          if (this._settleTimer > 180) this._settle();
        }
      } else {
        // Settled: hold the court and drive rival males off it.
        if (!this._territory) this._territory = createVector(px, py);
        if (list && list.length >= 2) this._contestCourt(list, dt);
        this.applyForce(this.seekPoint(this._territory.x, this._territory.y, this._territoryHold));
      }
    } else {
      // Female: pair at the nearest court in a mast; otherwise let the shelters distribute her.
      let paired = false;
      if (sim.mastYear && list && list.length >= 2) {
        let best = null, bestSq = Infinity;
        for (let i = 0; i < list.length; i++) {
          const o = list[i];
          if (!o.alive || o.isFemale) continue;
          const dx = o.pos.x - px, dy = o.pos.y - py, dSq = dx * dx + dy * dy;
          if (dSq < bestSq) { bestSq = dSq; best = o; }
        }
        if (best) { this.applyForce(this.seekPoint(best.pos.x, best.pos.y, this._lekAttract)); paired = true; }
      }
      if (!paired) {
        const shelter = this._nearestFernShelter(sim);
        if (shelter) this.applyForce(this.seekPoint(shelter.pos.x, shelter.pos.y, this._shelterAttract));
      }
    }
  }

  // Mark this bird as settled; a male fixes its court where it now stands (if not already set).
  _settle() {
    if (this._settled) return;
    this._settled = true;
    if (!this.isFemale && !this._territory) this._territory = createVector(this.pos.x, this.pos.y);
  }

  // The nearest live fern shelter within the attraction radius (selective: only 'shelter'
  // placeables draw kākāpō). Cheap — there are only ever a handful of placeables.
  _nearestFernShelter(sim) {
    const list = sim.placeables;
    if (!list) return null;
    const rSq = this._shelterAttractRadius * this._shelterAttractRadius;
    const px = this.pos.x, py = this.pos.y;
    let best = null, bestSq = rSq;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.alive || p.type !== 'shelter') continue;
      const dx = p.pos.x - px, dy = p.pos.y - py, dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = p; }
    }
    return best;
  }

  // A male's active lek dispute: CHARGE the nearest rival male that has intruded on my court,
  // and RETREAT if I've strayed into a neighbour's — so residents chase intruders off and the
  // pair separates. Either one costs hunger, so contesting males run their energy down.
  _contestCourt(list, dt) {
    const px = this.pos.x, py = this.pos.y;
    let contesting = false;

    // (1) Charge the nearest rival inside MY court.
    let intr = null, intrSq = this._lekRadiusSq;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive || o.isFemale) continue;
      const dx = o.pos.x - this._territory.x, dy = o.pos.y - this._territory.y, dSq = dx * dx + dy * dy;
      if (dSq < intrSq) { intrSq = dSq; intr = o; }
    }
    if (intr) { this.applyForce(this.seekPoint(intr.pos.x, intr.pos.y, this._territoryPush)); contesting = true; }

    // (2) Retreat if I'm standing inside a neighbour's court (steer away from him).
    let host = null, hostSq = this._lekRadiusSq;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive || o.isFemale || !o._territory) continue;
      const dx = o._territory.x - px, dy = o._territory.y - py, dSq = dx * dx + dy * dy;
      if (dSq < hostSq) { hostSq = dSq; host = o; }
    }
    if (host) { this.applyForce(this.seekPoint(px + (px - host.pos.x), py + (py - host.pos.y), this._territoryPush)); contesting = true; }

    if (contesting) this.hunger = Math.min(this.maxHunger, this.hunger + this._territoryHungerCost * dt);
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
  highlightColor: [190, 240, 115],  // bright moss green — player highlight (pulse + UI border)

  // Movement / render — a slow, heavy WALKER pinned to the ground (no flight).
  baseSpeed:        0.12,
  maxForce:         0.04,
  size:             8,
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
  // actively chase rival males off (which burns their hunger), so a mast can't hand a runaway
  // boom (more consistent results); a well-grown, well-spaced lek still breeds and is worth
  // defending. Fern shelters draw un-settled birds so the player can distribute the flock.
  lekRadius:      140,     // males keep ~this far apart (contest rival males within it)
  territoryPush:  0.06,    // how hard a male charges an intruder / drives off a neighbour
  territoryHold:  0.02,    // how hard a male holds to its own court
  lekAttract:     0.03,    // how hard a mast-year female drifts to the nearest court
  territoryHungerCostPerSec: 0.8,  // hunger burned per second while actively contesting a court
  shelterAttract:       0.05,      // pull toward a fern shelter for an un-settled bird
  shelterAttractRadius: 360        // a fern shelter draws un-settled kākāpō within this range
};

// Register the kākāpō as a flighted-bird TYPE for egg-hatch routing (Simulation
// ._hatchFlyerEgg reads FLYER_TYPES), even though it never actually flies — the
// hatchling reads isFlyer=false from its own constructor and renders on the ground.
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kakapo');

if (typeof window !== 'undefined') {
  window.Kakapo = Kakapo;
  window.KAKAPO_SPECIES = KAKAPO_SPECIES;
}
