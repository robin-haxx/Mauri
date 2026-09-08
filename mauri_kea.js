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
    super.behave(sim, mauri, seasonManager, dt);
    if (!this._grounded && this.state === KERERU_STATE.FLYING) {
      const pt = this._bandwardPoint();
      if (pt) this.applyForce(this.seekPoint(pt.x, pt.y, 0.6));
    }
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

  // Glyph fallback: olive-green body with a scarlet underwing flash in flight and a
  // dark hooked beak — distinct from the kererū (green/white) and kōkako (grey).
  _renderGlyph(s, perched) {
    const dir = (this._flip >= 0) ? 1 : -1;
    const wing = perched ? 1.5 : 1.85;
    if (!perched) {
      fill(196, 72, 44);                                     // scarlet underwing (shows in flight)
      ellipse(-dir * s * 0.34, s * 0.06, s * 1.02, s * 0.7);
    }
    fill(88, 108, 58);                                       // olive-green body
    ellipse(0, 0, s * wing, s * 1.05);
    fill(112, 132, 78);                                      // paler back
    ellipse(dir * s * 0.24, -s * 0.06, s * 0.9, s * 0.7);
    fill(96, 92, 72);                                        // brownish head
    ellipse(dir * s * 0.55, -s * 0.30, s * 0.6, s * 0.56);
    fill(38, 40, 40);                                        // dark hooked beak
    triangle(dir * s * 0.76, -s * 0.36, dir * s * 0.96, -s * 0.30, dir * s * 0.80, -s * 0.12);
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
  descendFromCold:   0.6                //   ... and how much the glacial coldIndex does
};

// Register the kea as a flighted-bird type (routes egg hatch + the render pass).
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kea');

if (typeof window !== 'undefined') {
  window.Kea = Kea;
  window.KEA_SPECIES = KEA_SPECIES;
}
