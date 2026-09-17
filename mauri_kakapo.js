// ============================================================
// KĀKĀPŌ; the flightless mast-breeder  (extends Kereru)
// Strigops habroptilus, the heavy, nocturnal, flightless ground parrot. Two things
// define it, both built here:
//   · FLIGHTLESS. Reuses the Kereru forage → feed → rest loop but never leaves the
//     ground (isFlyer false, altitude pinned to 0). It does NOT flee a raptor;
//     kākāpō freeze and rely on camouflage.
//   · MAST BREEDING. Breeds only in a rimu/podocarp MAST YEAR (the payoff for the
//     player's Mast Year item). _tryReproduce gates on sim.mastYear, then defers to
//     the base, which raises the flock cap and shortens the cooldown during a mast.
// A generalist ground forager (any plant). Class declared before its species object
// so KAKAPO_SPECIES's typeof guard is safe.
// ============================================================

class Kakapo extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    // Flightless: render on the ground (under trees), never lift off.
    this.isFlyer = false;
    this._cruiseAlt = 0;
    this._perchAlt = 0;
    this._altitude = 0;

    // Territorial lek tuning (see behave). Males hold and defend a court, burning energy.
    const sp = (speciesData && speciesData.config) ? speciesData.config : KAKAPO_SPECIES;
    this._lekRadius = sp.lekRadius ?? 140;
    this._lekRadiusSq = this._lekRadius * this._lekRadius;
    this._territoryPush = sp.territoryPush ?? 0.06;
    this._territoryHold = sp.territoryHold ?? 0.02;
    this._lekAttract = sp.lekAttract ?? 0.03;
    this._territory = null;   // a male's claimed court
    // Hunger burned each frame a male is actively contesting, so the flock spaces out.
    this._territoryHungerCost = (sp.territoryHungerCostPerSec ?? 0.8) / 60;
    // Fern-shelter attraction: un-settled kākāpō drift to the nearest shelter, so the
    // player seeds leks by placing shelters.
    this._shelterAttract = sp.shelterAttract ?? 0.05;
    this._shelterAttractRadius = sp.shelterAttractRadius ?? 360;
    // Rimu Berry Scramble gather: a live scramble site pulls the flock together hard (much
    // stronger than a shelter) so males re-form courts on the glut and females reach them.
    this._scrambleAttract = sp.scrambleAttract ?? 0.14;
    this._scrambleAttractRadius = sp.scrambleAttractRadius ?? 520;
    this._settled = false;    // has this bird settled
    this._settleTimer = 0;    // grace before a male with no shelter claims where it stands
    this._contesting = false; // male actively disputing a court this frame (drives audio)
  }

  // Territorial lek behaviour, after the base ground loop steers:
  //   · A MALE settles a court (at a nearby shelter if one's in reach, else where it
  //     stands), then holds it and drives rival males off; a chase that burns hunger,
  //     so males can't pack tight.
  //   · A FEMALE drifts to the nearest court in a mast to pair, else to a shelter.
  // Skipped while storm-sheltered or not walking.
  behave(sim, mauri, seasonManager, dt) {
    super.behave(sim, mauri, seasonManager, dt);
    this._contesting = false;   // set true by _contestCourt when this male disputes a court
    // (Never storm-flushed; guard kept for parity with the other parrots.)
    if (this._grounded || this._fleeingStorm || this.state !== KERERU_STATE.FLYING) return;
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    const px = this.pos.x, py = this.pos.y;

    // A live Rimu Berry Scramble site is the flock's rendezvous: it overrides the ordinary
    // shelter drift for BOTH sexes, so males re-form courts on the berry glut and females
    // reach them to pair. Males were un-settled by the scramble so they re-gather here.
    const scramble = this._nearestScrambleSite(sim);

    if (!this.isFemale) {
      if (!this._settled) {
        // Un-settled: head for a live scramble site if there is one, else drift to a fern
        // shelter to claim a court there, else settle after a grace.
        const spot = scramble || this._nearestFernShelter(sim);
        if (spot) {
          const pull = scramble ? this._scrambleAttract : this._shelterAttract;
          this.applyForce(this.seekPoint(spot.pos.x, spot.pos.y, pull));
          const dx = spot.pos.x - px, dy = spot.pos.y - py, sr = spot.radius || 50;
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
    } else if (scramble) {
      // Scramble live: head straight for the glut (hard pull), where the males are re-forming
      // courts — the fastest way to put a mate in reach and lay.
      this.applyForce(this.seekPoint(scramble.pos.x, scramble.pos.y, this._scrambleAttract));
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

  // Mark this bird as settled; a male fixes its court where it stands.
  _settle() {
    if (this._settled) return;
    this._settled = true;
    if (!this.isFemale && !this._territory) this._territory = createVector(this.pos.x, this.pos.y);
  }

  // The nearest live Rimu Berry Scramble gather site within reach (see sim.scrambleSites).
  // These out-pull shelters and expire, so the gather is a brief mast-year rendezvous.
  _nearestScrambleSite(sim) {
    const list = sim.scrambleSites;
    if (!list || !list.length) return null;
    const rSq = this._scrambleAttractRadius * this._scrambleAttractRadius;
    const px = this.pos.x, py = this.pos.y;
    let best = null, bestSq = rSq;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const dx = s.x - px, dy = s.y - py, dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = s; }
    }
    // Adapt to the {x, y} record the shelter/settle code expects a .pos on.
    return best ? { pos: { x: best.x, y: best.y }, radius: best.radius || 60 } : null;
  }

  // The nearest live fern shelter within the attraction radius.
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

  // A male's lek dispute: charge the nearest rival inside my court, and retreat from a
  // neighbour's. Either costs hunger, so contesting males run their energy down.
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
    this._contesting = contesting;   // audio: several contesting males → territorial call
  }

  // Kākāpō don't flee a raptor; they freeze and rely on camouflage. Returning false
  // keeps the ordinary ground loop.
  _fleeHarrier(sim, dt) { return false; }

  // Generalist ground forage: nearest grown plant of any type, not FOREST_TREES only.
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

  // Breeds only in a rimu mast year (the base handles the surge during one).
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
// SPECIES DATA; Strigops habroptilus. Registered in initializeRegistry.
// ------------------------------------------------------------
const KAKAPO_SPECIES = {
  displayName:    'Kākāpō',
  scientificName: 'Strigops habroptilus',
  label:          'kākāpō',
  class:          (typeof Kakapo !== 'undefined') ? Kakapo : undefined,
  description:    'The flightless, nocturnal ground parrot; the heaviest parrot alive, and a rimu-mast breeder.',
  rarity:         'rare',
  highlightColor: [190, 240, 115],  // moss green; player highlight

  // Movement / render; a slow, heavy WALKER pinned to the ground (no flight).
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

  // Survival; long-lived, so it holds between masts: low hunger, slow to starve, a floor.
  maxHunger:        100,
  hungerRatePerSec: 0.9,
  feedRelief:       72,
  starveSec:        24,

  // Reproduction; the base loop, but GATED to mast years by _tryReproduce.
  maturitySec:      30,    // slow to mature
  eggCooldownSec:   50,
  mateRadius:       180,
  reproCheckSec:    4,
  maxPopulation:    10,
  populationFloor:  2,

  // Territorial lek (kākāpō-specific); see Kakapo.behave. Males hold spaced courts and
  // chase rivals off, so a mast can't hand a runaway boom.
  lekRadius:      140,     // males keep ~this far apart (contest rival males within it)
  territoryPush:  0.06,    // how hard a male charges an intruder / drives off a neighbour
  territoryHold:  0.02,    // how hard a male holds to its own court
  lekAttract:     0.03,    // how hard a mast-year female drifts to the nearest court
  territoryHungerCostPerSec: 0.8,  // hunger burned per second while actively contesting a court
  shelterAttract:       0.05,      // pull toward a fern shelter for an un-settled bird
  shelterAttractRadius: 360,       // a fern shelter draws un-settled kākāpō within this range

  // Rimu Berry Scramble rendezvous (see Kakapo.behave / sim.scrambleSites). A live scramble
  // site out-pulls shelters and reaches far, so the whole flock converges on the berry glut
  // during the brief gather and pairs form — the mast-year glut turns into chicks.
  scrambleAttract:       0.14,     // pull toward a live scramble gather site (≫ shelterAttract)
  scrambleAttractRadius: 520       // a scramble site draws kākāpō from this far
};

// Register the kākāpō as a flighted-bird type for egg-hatch routing, though it never
// flies (the hatchling reads isFlyer=false and renders on the ground).
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kakapo');

if (typeof window !== 'undefined') {
  window.Kakapo = Kakapo;
  window.KAKAPO_SPECIES = KAKAPO_SPECIES;
}
