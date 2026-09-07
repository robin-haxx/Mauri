// ============================================================
// KŌKAKO — the singing forest wattlebird  (extends Kereru)
// ------------------------------------------------------------
// SOUTH ISLAND kōkako, Callaeas cinereus — the "grey ghost", ORANGE-wattled (the
// North Island bird is the blue-wattled Callaeas wilsoni). A poor flier of tall
// native forest: it bounds and hops through the canopy and only makes short,
// laboured glides between trees — the same short-flight frugivore loop as the
// kererū, so it IS a kererū mechanically (its own base type + list, extends Kereru).
// It disperses forest seed like the kererū but far less (a smaller gape passes
// fewer large fruit, so _disperseChance is well under half — KOKAKO_SPECIES).
//
// Two things make it a kōkako, not a small kererū:
//   · TERRITORY. It holds a patch of forest and sings from it. The _territory
//     anchor pulls foraging and hops back onto that patch, so it stays put.
//   · SONG. When secure on a perch (well fed, no storm) it settles into a SINGING
//     state — it sits notably longer than a kererū. A song provokes the
//     neighbours: the NEAREST kōkako within earshot answers (a duet); any others
//     crowded inside the territory radius are pushed off to claim ground of their
//     own. Over time the flock spaces itself out — emergent territoriality.
//
// No audio ships for the song, so the cue is diegetic-visual: a small music note
// lifting from the singing bird (_renderExtra), non-flashing (photosensitivity).
// Ported/adapted from the Te Manawa fork alongside mauri_kereru.js.
// ============================================================

const KOKAKO_STATE = {
  SINGING: 'singing'    // perched and holding a song — sits longer than a plain perch
};

class Kokako extends Kereru {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain, config, speciesData);
    const sp = (speciesData && speciesData.config) ? speciesData.config : KOKAKO_SPECIES;
    const F = 60;

    this._singFrames         = (sp.singSec ?? 9) * F;
    this._singCooldownFrames = (sp.singCooldownSec ?? 14) * F;
    this._songInterval       = (sp.songEverySec ?? 16) * F;
    this._singCooldown       = random(0, this._singCooldownFrames);
    this._songTimer          = this._songInterval * random(0.5, 1.2);
    this._singTimer          = 0;
    this._respondSing        = false;

    this._singHearRadius  = sp.singHearRadius ?? 220;
    this._territoryRadius  = sp.territoryRadius ?? 140;
    this._secureHunger    = (sp.secureHungerFrac ?? 0.6);
    this._relocating      = false;
    this._territory = createVector(x, y);
  }

  _isPerched() {
    return this.state === KOKAKO_STATE.SINGING || super._isPerched();
  }

  _runState(sim, dt) {
    if (this.state === KOKAKO_STATE.SINGING) { this._singing(sim, dt); return; }
    super._runState(sim, dt);
  }

  _anchorPoint() { return this._territory; }

  // While relocating to a new territory, ignore trees and travel there; on arrival,
  // resume the ordinary forage/disperse loop.
  _flying(sim, dt) {
    if (this._relocating) {
      const t = this._territory;
      const dx = t.x - this.pos.x, dy = t.y - this.pos.y;
      if (dx * dx + dy * dy < 26 * 26) {
        this._relocating = false;
      } else {
        this.maxSpeed = this.speciesData?.config?.baseSpeed || 0.5;
        this.applyForce(this.seek(t, 1, 30));
        return;
      }
    }
    super._flying(sim, dt);
  }

  // PERCHED — count the song clocks, and break into a song when secure and either
  // answering a neighbour or due for a spontaneous one. Otherwise the kererū perch.
  _perched(sim, dt) {
    if (this._singCooldown > 0) this._singCooldown = Math.max(0, this._singCooldown - dt);
    if (this._songTimer > 0)    this._songTimer    = Math.max(0, this._songTimer - dt);

    const secure = this.hunger < this.maxHunger * this._secureHunger;
    if (secure && this._singCooldown <= 0 && (this._respondSing || this._songTimer <= 0)) {
      this._enterSinging(sim);
      return;
    }
    super._perched(sim, dt);
  }

  _enterSinging(sim) {
    this.state = KOKAKO_STATE.SINGING;
    this._singTimer = this._singFrames;
    this._respondSing = false;
    this._territory.set(this.pos.x, this.pos.y);   // claim this perch as the territory centre
    this._provokeNeighbours(sim);
  }

  _singing(sim, dt) {
    this.maxSpeed = 0.15;
    this.vel.mult(Math.pow(0.8, dt));              // hold still on the branch
    this._singTimer -= dt;
    if (this._singTimer <= 0) {
      this._singCooldown = this._singCooldownFrames;
      this._songTimer = this._songInterval * random(0.7, 1.3);
      this.state = KERERU_STATE.PERCHED;           // back to a normal perch beat
      this._restTimer = this._restFrames;
    }
  }

  // One rule drives the territoriality: the nearest kōkako within earshot answers;
  // every other kōkako packed inside the territory radius is displaced.
  _provokeNeighbours(sim) {
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    if (!list) return;
    const px = this.pos.x, py = this.pos.y;
    const hearSq = this._singHearRadius * this._singHearRadius;
    const terrSq = this._territoryRadius * this._territoryRadius;

    let nearest = null, nearSq = Infinity;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive) continue;
      const dx = o.pos.x - px, dy = o.pos.y - py, dSq = dx * dx + dy * dy;
      if (dSq <= hearSq && dSq < nearSq) { nearSq = dSq; nearest = o; }
    }
    if (nearest && typeof nearest._answerSong === 'function') nearest._answerSong();

    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || o === nearest || !o.alive) continue;
      const dx = o.pos.x - px, dy = o.pos.y - py;
      if (dx * dx + dy * dy <= terrSq && typeof o._displaceFrom === 'function') o._displaceFrom(px, py);
    }
  }

  _answerSong() { this._respondSing = true; }

  // Pushed out of a rival's territory: claim a new patch away from the singer and
  // set off for it, dropping the current tree. Stays quiet until it arrives.
  _displaceFrom(sx, sy) {
    let ang = Math.atan2(this.pos.y - sy, this.pos.x - sx);
    if (!isFinite(ang) || (this.pos.x === sx && this.pos.y === sy)) ang = random(TWO_PI);
    const r = this._territoryRadius * random(1.0, 1.7);
    const w = this.terrain.mapWidth, h = this.terrain.mapHeight;
    const land = this._clampToLand(
      constrain(this.pos.x + Math.cos(ang) * r, 8, w - 8),
      constrain(this.pos.y + Math.sin(ang) * r, 8, h - 8)
    );
    this._territory.set(land.x, land.y);
    this._relocating = true;
    this._respondSing = false;
    this._singCooldown = Math.max(this._singCooldown, this._singFrames);
    if (this._isPerched()) {
      this.state = KERERU_STATE.FLYING;
      this._targetTree = null;
    }
  }

  _getSprite(perched) {
    return (typeof EntitySprites !== 'undefined' && EntitySprites.getKokakoSprite)
      ? EntitySprites.getKokakoSprite(perched) : null;
  }

  // Glyph fallback: slate-grey body, dark bandit mask, a dab of ORANGE wattle (the
  // South Island kōkako — the North Island bird is blue-wattled).
  _renderGlyph(s, perched) {
    const dir = (this._flip >= 0) ? 1 : -1;
    const wing = perched ? 1.4 : 1.7;
    fill(120, 138, 146);
    ellipse(0, 0, s * wing, s * 1.02);                                // slate-grey body
    fill(150, 166, 172);
    ellipse(dir * s * 0.28, s * 0.20, s * 0.8, s * 0.66);             // paler underside
    fill(34, 40, 46);
    ellipse(dir * s * 0.55, -s * 0.28, s * 0.62, s * 0.56);           // head
    ellipse(dir * s * 0.66, -s * 0.16, s * 0.5, s * 0.34);            // dark facial mask
    fill(224, 138, 46);
    ellipse(dir * s * 0.5, s * 0.02, s * 0.22, s * 0.22);             // orange wattle
  }

  // Song cue — a small music note lifting from the singing bird. USER-FACING (like
  // the mating heart), gentle bob on the anim clock, non-flashing (CLAUDE.md).
  _renderExtra(s, perched) {
    if (this.state !== KOKAKO_STATE.SINGING) return;
    const dir = (this._flip >= 0) ? 1 : -1;
    const bob = Math.sin((this.animTime || 0) * 0.12) * s * 0.14;
    const hx = dir * s * 0.95, hy = -s * 1.05 + bob;
    push();
    noStroke();
    fill(224, 138, 46, 220);
    rectMode(CORNER);
    rect(hx + s * 0.16, hy - s * 0.72, s * 0.09, s * 0.72);          // stem
    triangle(hx + s * 0.25, hy - s * 0.72,
             hx + s * 0.25, hy - s * 0.40,
             hx + s * 0.52, hy - s * 0.52);                          // flag
    ellipse(hx, hy, s * 0.46, s * 0.36);                             // note head
    pop();
  }
}

// ------------------------------------------------------------
// SPECIES DATA — South Island kōkako. Registered as its own base type + species
// in initializeRegistry (mauri_sketch.js), carrying class: Kokako.
// ------------------------------------------------------------
const KOKAKO_SPECIES = {
  displayName:    'South Island Kōkako',
  scientificName: 'Callaeas cinereus',
  label:          'kōkako',
  class:          (typeof Kokako !== 'undefined') ? Kokako : undefined,
  description:    'An orange-wattled forest songbird — a weak flier that holds and sings a forest territory.',
  rarity:         'uncommon',
  highlightColor: [224, 150, 70],   // orange — player highlight (pulse + UI border)

  // A poorer flier than the kererū: slower, shorter hops, barely clears the canopy.
  baseSpeed:        0.24,
  maxForce:         0.05,
  size:             6,
  perceptionRadius: 60,
  cruiseAlt:        16,
  perchAlt:         8,

  hopRadius:        38,
  feedRadius:       90,
  homeLeash:        120,     // strays this far from its territory before heading back

  cropCapacity:     1,
  feedSec:          5,
  disperseEverySec: 22,
  restSec:          10,
  disperseChance:   0.4,     // >50% fewer established seeds than the kererū (1.0)

  maxHunger:        100,
  hungerRatePerSec: 1.0,
  feedRelief:       70,
  starveSec:        18,

  maturitySec:      22,
  eggCooldownSec:   42,
  mateRadius:       170,
  reproCheckSec:    3.5,
  maxPopulation:    10,
  populationFloor:  2,

  singSec:          9,
  singCooldownSec:  14,
  songEverySec:     16,
  singHearRadius:   220,
  territoryRadius:  140,
  secureHungerFrac: 0.6
};

// Register the kōkako as a flighted-bird type (routes egg hatch + render pass).
if (typeof FLYER_TYPES !== 'undefined') FLYER_TYPES.add('kokako');

if (typeof window !== 'undefined') {
  window.Kokako = Kokako;
  window.KOKAKO_SPECIES = KOKAKO_SPECIES;
  window.KOKAKO_STATE = KOKAKO_STATE;
}
