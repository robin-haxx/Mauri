// ============================================================
// KERERŪ; the large-seed disperser  (flighted-bird base class)
// Hemiphaga novaeseelandiae, the only bird large enough to pass big podocarp fruit,
// so the forest recruits where kererū go. Base class for Mauri's flighted birds
// (kōkako/kea/kākā/kākāpō extend it; see FLYER_TYPES). A flyer with short flights
// between trees and much perching:
//   FLYING (hungry) → hop to a fruiting tree
//        → FEEDING (perched) → fill the crop (the tree is NOT consumed)
//        → PERCHED (digest, maybe lay an egg)
//        → FLYING (full) → short hops away, dropping a seed each (disperseSeed)
//        → crop empty → hungry → FLYING.
// Reproduction is emergent and sexual: a mature, well-fed female with a mate near
// lays an egg tagged offspringType = speciesKey.
// ============================================================

// Which otherEntities types are flighted birds; the sim reads this to route egg
// hatches and the flyer render pass. Subclasses append their key.
const FLYER_TYPES = new Set(['kereru']);

const KERERU_STATE = {
  FLYING:  'flying',      // in the air; hopping to a tree (hungry) or dispersing (full)
  FEEDING: 'feeding',     // perched at a fruiting tree, filling the crop
  PERCHED: 'perched',     // perched; digesting, resting between hops, or laying
  SHELTER: 'sheltering'   // storm-grounded: hunkered low, no feeding/dispersal/laying
};

const KERERU_SPECIES = {
  displayName:    'Kererū',
  scientificName: 'Hemiphaga novaeseelandiae',
  label:          'kererū',   // lower-case, for the notification strip
  description:    'The forest pigeon; the only bird that disperses large podocarp fruit.',
  rarity:         'common',
  highlightColor: [150, 235, 150],  // green; player highlight

  // Movement / render; an unhurried flap, kept below the eagle's hunt speed so a chase resolves.
  baseSpeed:        0.32,
  maxForce:         0.055,
  size:             6,
  perceptionRadius: 60,
  cruiseAlt:        24,     // flight height above the ground, px (shadow sells the height)
  perchAlt:         8,      // sits low on the canopy when perched

  // Flight character; short legs; the kererū only hops.
  hopRadius:        50,
  feedRadius:       100,

  // Frugivore crop / dispersal (all times in seconds; the class converts to frames)
  cropCapacity:     1,      // fruit carried per full crop → it stops carrying quickly
  feedSec:          5,      // perched feeding time to fill the crop
  disperseEverySec: 20,     // cadence of seed drops while carrying
  restSec:          8,      // perched digest/rest between hops (why it perches so much)

  // Survival; abundant in the forested interglacial, thin in the glacial.
  maxHunger:        100,
  hungerRatePerSec: 1.2,    // ≈ per second of the sim clock (feeding pays it back)
  feedRelief:       70,     // hunger removed by a full feed
  starveSec:        18,     // sustained max-hunger before death

  // Reproduction; sexual, emergent (see _tryReproduce).
  maturitySec:      20,
  eggCooldownSec:   35,
  mateRadius:       200,
  reproCheckSec:    3.5,
  maxPopulation:    16,     // flock cap (breeding stops at it)
  populationFloor:  2       // never starve the last few (keeps a disperser alive)
};

class Kereru extends Boid {
  constructor(x, y, terrain, config, speciesData) {
    super(x, y, terrain);
    this.config = config || {};
    this.speciesData = speciesData || null;
    const sp = (speciesData && speciesData.config) ? speciesData.config : KERERU_SPECIES;
    this.speciesKey = (speciesData && speciesData.key) || 'kereru';
    this.species = speciesData || null;   // Mauri UI reads .species?.displayName

    this.alive = true;
    this.isFlyer = true;                             // rendered above the ground plane
    // Lower-case label for the notification strip. Subclasses carry their own.
    this._label = sp.label || this.speciesKey;
    this.maxSpeed = sp.baseSpeed || 1.4;
    this.maxForce = sp.maxForce || 0.06;
    this.size = sp.size || 12;
    this.perceptionRadius = sp.perceptionRadius || 60;
    this.perceptionRadiusSq = this.perceptionRadius * this.perceptionRadius;
    this.animTime = random(1000);
    this._flip = 1;                                  // eased facing: +1 right, -1 left

    // Altitudes (eased in update so take-off/landing never pops)
    this._cruiseAlt = sp.cruiseAlt ?? 24;
    this._perchAlt  = sp.perchAlt ?? 5;
    this._altitude  = this._cruiseAlt;
    // Perch variety: each landing picks a fresh height + offset so a flock doesn't stack.
    this._perchAltCur = this._perchAlt;
    this._perchDX = 0;
    this._perchDY = 0;
    this._wasPerched = false;
    // Last walkable ground stood over; its bolt-hole if it strays over water.
    this._lastLand = { x, y };

    // Flight legs
    this._hopRadius  = sp.hopRadius ?? 120;
    this._feedRadius = sp.feedRadius ?? 170;
    // How far an anchored bird strays from home before heading back (0 = free-ranging).
    this._homeLeash   = sp.homeLeash ?? 0;
    this._homeLeashSq = this._homeLeash * this._homeLeash;

    // Crop / dispersal (seconds → frames on the sim clock)
    const F = 60;
    this._cropCapacity   = sp.cropCapacity ?? 3;
    this._feedFrames     = (sp.feedSec ?? 5) * F;
    this._disperseFrames = (sp.disperseEverySec ?? 5) * F;
    this._restFrames     = (sp.restSec ?? 4) * F;
    // Dispersal effectiveness: chance a drop establishes a seedling (kererū 1, kōkako < 0.5).
    this._disperseChance = sp.disperseChance ?? 1;
    this.crop = 0;

    // Survival
    this.maxHunger   = sp.maxHunger ?? 100;
    this.hunger      = random(10, 30);
    this.hungerRate  = (sp.hungerRatePerSec ?? 1.2) / F;
    this._feedRelief = sp.feedRelief ?? 70;
    this._starveFrames = (sp.starveSec ?? 18) * F;
    this._starveTimer = 0;

    // Reproduction
    this.isFemale = random() < 0.5;
    this.age = 0;
    this.mature = true;                              // spawned founders are adults
    this._maturityFrames = (sp.maturitySec ?? 20) * F;
    this._eggCooldownFrames = (sp.eggCooldownSec ?? 35) * F;
    this._eggCooldown = random(0, this._eggCooldownFrames);
    this._mateRadius = sp.mateRadius ?? 200;
    this._reproCheckFrames = (sp.reproCheckSec ?? 3.5) * F;
    this._reproCheckTimer = random(0, this._reproCheckFrames);
    // "In a flock" if a conspecific is within this radius. A bird with none nearby is restless:
    // it rests less and takes off to roam sooner, so solitary birds keep moving (and wandering)
    // until they find company / a mate instead of camping alone.
    this._companyRadius = sp.companyRadius ?? this._mateRadius;
    this._companyRadiusSq = this._companyRadius * this._companyRadius;
    this._lonelyRestRate = sp.lonelyRestRate ?? 2.5;   // perch drains this× faster when alone

    // State machine
    this.state = KERERU_STATE.FLYING;
    this._targetTree = null;
    this._treeSearchTimer = 0;
    this._feedTimer = 0;
    this._restTimer = 0;
    this._disperseTimer = random(this._disperseFrames);
    this._grounded = false;

    // Reusable vectors (never allocate in behave/update/render)
    this._target = createVector(x, y);
    this._landForce = createVector();
    this._landPt = { x: 0, y: 0 };
  }

  // ============================================================
  // LIFE / MOTION CLOCK; called by Simulation._updateOtherEntities.
  // ============================================================
  behave(sim, mauri, seasonManager, dt) {
    // Storms flush a flyer off its tree (see _fleeStorm) rather than grounding it.
    // _fleeingStorm tells subclasses to hold their extra steering while fleeing.
    this._grounded = false;
    this._fleeingStorm = false;

    // Age → maturity, and hunger (feeding pays it back below).
    this.age += dt;
    if (!this.mature && this.age >= this._maturityFrames) this.mature = true;
    this.hunger = Math.min(this.hunger + this.hungerRate * dt, this.maxHunger);
    if (this._eggCooldown > 0) this._eggCooldown = Math.max(0, this._eggCooldown - dt);

    // A placed Storm scares the bird off its tree to seek a new one (a displacement tool).
    if (this._fleeStorm(sim, dt)) return;

    // Flush from a hunting eagle next; a raptor on the hunt scatters the flock.
    if (this._fleeHarrier(sim, dt)) return;

    this._runState(sim, dt);

    // Keep to land: a forest bird never crosses open water for long.
    this.applyForce(this._landward());

    // Survival: sustained max-hunger kills, but never below the population floor, and never
    // while _starveImmune (a subclass shielding a focus flock; the bird clings on instead).
    if (this.hunger >= this.maxHunger) {
      this._starveTimer += dt;
      if (this._starveTimer >= this._starveFrames) {
        const floor = this._populationFloor();
        const aboveFloor = sim.getSpeciesCount && sim.getSpeciesCount(this.speciesKey) > floor;
        if (aboveFloor && !this._starveImmune(sim)) {
          this.alive = false;
          if (sim.game) sim.game.addNotification(`A ${this._label} is lost as the forest thins.`, 'info');
          return;
        }
        this.hunger = this.maxHunger * 0.85;         // protected floor / immune bird; clings on
        this._starveTimer = 0;
      }
    } else if (this._starveTimer > 0) {
      this._starveTimer = Math.max(0, this._starveTimer - dt * 2);
    }

    this.edges();
  }

  // The nearest live Storm placeable whose cloud covers the bird (radius + margin), or null.
  _nearestStorm(sim) {
    const list = sim.placeables;
    if (!list) return null;
    const px = this.pos.x, py = this.pos.y;
    let best = null, bestSq = Infinity;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!p.alive || p.type !== 'Storm') continue;
      const r = (p.radius || 70) * 1.6;              // flush a bit beyond the visible cloud
      const dx = p.pos.x - px, dy = p.pos.y - py, d2 = dx * dx + dy * dy;
      if (d2 <= r * r && d2 < bestSq) { bestSq = d2; best = p; }
    }
    return best;
  }

  // A Storm within range flushes the bird: it drops its tree and flies away to seek a
  // fresh one. Only real flyers respond. Sets _fleeingStorm; returns true when it takes the tick.
  _fleeStorm(sim, dt) {
    if (!this.isFlyer) return false;
    const storm = this._nearestStorm(sim);
    if (!storm) return false;
    this._fleeingStorm = true;
    this.state = KERERU_STATE.FLYING;
    this._targetTree = null;                         // drop the tree it was heading to / feeding at
    this._perchTree = null;                          // and any home perch (kea); re-chosen once clear
    const base = this.speciesData?.config?.baseSpeed || 0.42;
    this.maxSpeed = base * 1.2;                      // hurry off, a shade above cruise
    let dx = this.pos.x - storm.pos.x, dy = this.pos.y - storm.pos.y;
    let m = Math.hypot(dx, dy);
    if (m < 1) { const a = Math.random() * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a); m = 1; }  // dead-centre → any way out
    const land = this._clampToLand(this.pos.x + (dx / m) * 90, this.pos.y + (dy / m) * 90);
    this._target.set(land.x, land.y);
    this.applyForce(this.seek(this._target, 1.5));
    this.applyForce(this._landward());
    this.edges();
    return true;
  }

  // Flee any hunting eagle within range; returns true when it took over the tick.
  _fleeHarrier(sim, dt) {
    if (!sim.getNearbyEagles) return false;
    const R = 110, RSq = R * R;
    const eagles = sim.getNearbyEagles(this.pos.x, this.pos.y, R);
    let ex = 0, ey = 0, threat = false;
    for (let i = 0; i < eagles.length; i++) {
      const e = eagles[i];
      const hunting = (typeof e.isHunting === 'function') ? e.isHunting()
                    : (e.hunting || e.state === 'hunting');
      if (!hunting) continue;
      const dx = this.pos.x - e.pos.x, dy = this.pos.y - e.pos.y;
      if (dx * dx + dy * dy < RSq) { ex += dx; ey += dy; threat = true; }
    }
    if (!threat) return false;
    this.state = KERERU_STATE.FLYING;
    this._targetTree = null;
    const base = this.speciesData?.config?.baseSpeed || 0.42;
    // Only a shade faster than cruise, BELOW the eagle's hunt speed so a chase resolves.
    this.maxSpeed = base * ((typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.flyerFleeMult) ?? 1.15);
    const m = Math.hypot(ex, ey) || 1;
    const land = this._clampToLand(this.pos.x + (ex / m) * 60, this.pos.y + (ey / m) * 60);
    this._target.set(land.x, land.y);
    this.applyForce(this.seek(this._target, 1.6));
    this.applyForce(this._landward());
    this.edges();
    return true;
  }

  // Can this bird be over (x,y)? Default: only walkable ground. The kea overrides this
  // (crosses the alpine, barred only by open water).
  _passable(x, y) {
    const t = this.terrain;
    return !t || typeof t.isWalkable !== 'function' || t.isWalkable(x, y);
  }

  // A "stay in habitat" steering force: zero over land away from the rim, else a firm
  // pull inward. Triggers on the world edge and impassable ground (see _passable).
  _landward() {
    const f = this._landForce; f.set(0, 0);
    const t = this.terrain;
    if (!t || typeof t.isWalkable !== 'function') return f;
    const w = t.mapWidth, h = t.mapHeight, m = 60;
    const ins = (typeof CONFIG !== 'undefined' && CONFIG.viewInsetX) ? CONFIG.viewInsetX : 0;
    const px = this.pos.x, py = this.pos.y;
    const xlo = ins + m, xhi = w - ins - m;

    let ix = 0, iy = 0, edge = false;
    if (px < xlo)    { ix = 1;  edge = true; } else if (px > xhi) { ix = -1; edge = true; }
    if (py < m)      { iy = 1;  edge = true; } else if (py > h - m) { iy = -1; edge = true; }

    const spd = Math.hypot(this.vel.x, this.vel.y);
    const ux = spd > 0.001 ? this.vel.x / spd : 0, uy = spd > 0.001 ? this.vel.y / spd : 0;
    const overWater = !this._passable(px, py);
    const waterAhead = !this._passable(px + ux * 22, py + uy * 22);
    if (!edge && !overWater && !waterAhead) return f;

    let gx, gy, have = false;
    const anc = this._anchorPoint && this._anchorPoint();
    if (anc && t.isWalkable(anc.x, anc.y)) { gx = anc.x; gy = anc.y; have = true; }
    if (!have && edge) { gx = px + ix * 140; gy = py + iy * 140; have = true; }
    if (!have) {
      for (let i = 0; i < 8; i++) {
        const a = i * (Math.PI / 4);
        const rx = px + Math.cos(a) * 45, ry = py + Math.sin(a) * 45;
        if (t.isWalkable(rx, ry)) { gx = rx; gy = ry; have = true; break; }
      }
    }
    if (!have) { gx = w * 0.5; gy = h * 0.5; }

    const s = this.seekPoint(gx, gy, overWater ? 2.5 : (edge ? 2.0 : 1.1));
    f.set(s.x, s.y);
    return f;
  }

  // Pull a fly-to point back onto land. Writes and returns the reused _landPt.
  _clampToLand(x, y) {
    const t = this.terrain, p = this._landPt;
    if (!t || typeof t.isWalkable !== 'function' || this._passable(x, y)) { p.x = x; p.y = y; return p; }
    const bx = this.pos.x, by = this.pos.y;
    for (let s = 0.75; s > 0; s -= 0.25) {
      const cx = bx + (x - bx) * s, cy = by + (y - by) * s;
      if (this._passable(cx, cy)) { p.x = cx; p.y = cy; return p; }
    }
    p.x = bx; p.y = by; return p;                            // nowhere passable → hold
  }

  // State dispatch; split out so a subclass can add a state (kōkako SINGING).
  _runState(sim, dt) {
    switch (this.state) {
      case KERERU_STATE.FLYING:  this._flying(sim, dt); break;
      case KERERU_STATE.FEEDING: this._feeding(sim, dt); break;
      case KERERU_STATE.PERCHED: this._perched(sim, dt); break;
      default:                   this.state = KERERU_STATE.FLYING; break;
    }
  }

  // Flock cap / floor; from the species config, else the kererū LEVEL_MECHANICS knobs.
  _maxPopulation() {
    const c = this.speciesData && this.speciesData.config;
    if (c && c.maxPopulation != null) return c.maxPopulation;
    return (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.kereruMaxPopulation) ?? 16;
  }
  _populationFloor() {
    const c = this.speciesData && this.speciesData.config;
    if (c && c.populationFloor != null) return c.populationFloor;
    return (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.kereruPopulationFloor) ?? 2;
  }

  // May this bird starve to DEATH right now (once above its population floor)? Base: yes.
  // A subclass can shield a focus flock for a year (see Kea) — a shielded bird still gets
  // hungry and clings on at max hunger, it just doesn't die. Separate from the floor rule.
  _starveImmune(sim) { return false; }

  // FLYING; hungry (crop == 0): find a fruiting tree, hop to it. Full (crop > 0):
  // hop away from the source, dropping a seed each leg.
  _flying(sim, dt) {
    this.maxSpeed = this.speciesData?.config?.baseSpeed || 1.4;

    if (this.crop <= 0) {
      if (!this._treeValid(this._targetTree)) {
        this._treeSearchTimer -= dt;
        if (this._treeSearchTimer <= 0) {
          this._treeSearchTimer = 30;
          this._targetTree = this._findFruitTree(sim);
          if (this._targetTree) this._target.set(this._targetTree.pos.x, this._targetTree.pos.y);
        }
      }
      if (this._treeValid(this._targetTree)) {
        this._target.set(this._targetTree.pos.x, this._targetTree.pos.y);
        const dx = this._target.x - this.pos.x, dy = this._target.y - this.pos.y;
        if (dx * dx + dy * dy < 14 * 14) {           // reached the tree → perch and feed
          this.state = KERERU_STATE.FEEDING;
          this._feedTimer = this._feedFrames;
          return;
        }
        this.applyForce(this.seek(this._target, 1, 24));
      } else {
        // No fruiting forest within reach: drift and let hunger climb. Anchored birds drift home.
        this._driftHome(sim, dt);
      }
    } else {
      const dx = this._target.x - this.pos.x, dy = this._target.y - this.pos.y;
      const arrived = dx * dx + dy * dy < 16 * 16;
      this._disperseTimer -= dt;
      if (arrived || this._disperseTimer <= 0) {
        // Drop a seed here. Crop is always spent, but establishes with _disperseChance.
        if (sim.disperseSeed && random() < this._disperseChance) sim.disperseSeed(this.pos.x, this.pos.y);
        this.crop -= 1;
        this._disperseTimer = this._disperseFrames;
        this.state = KERERU_STATE.PERCHED;
        this._restTimer = this._restFrames;
        return;
      }
      this.applyForce(this.seek(this._target, 1, 20));
    }
  }

  // FEEDING; perched at the tree, filling the crop. The plant is not consumed.
  _feeding(sim, dt) {
    this.maxSpeed = 0.15;
    this.vel.mult(Math.pow(0.8, dt));                // settle onto the perch
    if (!this._treeValid(this._targetTree)) {        // fruit gone / tree died → move on
      this.state = KERERU_STATE.FLYING;
      this._targetTree = null;
      return;
    }
    this._feedTimer -= dt;
    if (this._feedTimer <= 0) {
      this.crop = this._cropCapacity;                // a full crop of fruit
      const _scale = (typeof CONFIG !== 'undefined' && CONFIG.faunaNutritionScale) ? CONFIG.faunaNutritionScale : 1;
      this.hunger = Math.max(0, this.hunger - this._feedRelief * _scale);
      this._targetTree = null;
      this.state = KERERU_STATE.PERCHED;             // rest a beat before dispersing
      this._restTimer = this._restFrames;
    }
  }

  // PERCHED; digesting / resting between hops, and where a ready female lays.
  _perched(sim, dt) {
    this.maxSpeed = 0.15;
    this.vel.mult(Math.pow(0.8, dt));

    this._reproCheckTimer -= dt;
    if (this._reproCheckTimer <= 0) {
      this._reproCheckTimer = this._reproCheckFrames;
      this._tryReproduce(sim);
    }

    // Restless when alone: cut the perch short and take off to roam sooner, so a bird with no
    // flockmate nearby keeps moving (and wandering) until it finds company / a mate.
    this._restTimer -= dt * (this._companyNear(sim) ? 1 : this._lonelyRestRate);
    if (this._restTimer <= 0) {
      if (this.crop > 0) {
        this._pickHop();                             // take off to disperse elsewhere
        this.state = KERERU_STATE.FLYING;
      } else {
        this.state = KERERU_STATE.FLYING;            // hungry again → seek a tree
        this._targetTree = null;
      }
    }
  }

  // Choose a short fly-to point for the next dispersal leg. Anchored birds orbit home.
  _pickHop() {
    const anchor = this._anchorPoint();
    let ox = this.pos.x, oy = this.pos.y;
    if (anchor) { ox = (ox + anchor.x) * 0.5; oy = (oy + anchor.y) * 0.5; }
    const a = random(TWO_PI), r = random(this._hopRadius * 0.5, this._hopRadius);
    const w = this.terrain.mapWidth, h = this.terrain.mapHeight;
    const ins = (typeof CONFIG !== 'undefined' && CONFIG.viewInsetX) ? CONFIG.viewInsetX : 0;
    const land = this._clampToLand(
      constrain(ox + Math.cos(a) * r, ins + 8, w - ins - 8),
      constrain(oy + Math.sin(a) * r, 8, h - 8)
    );
    this._target.set(land.x, land.y);
  }

  // Home anchor for territory/pair fidelity. null = free-ranging (the kererū).
  _anchorPoint() { return null; }

  // Drift when no fruit tree is in reach: an anchored bird beyond its leash seeks home,
  // else wanders.
  _driftHome(sim, dt) {
    const anchor = this._anchorPoint();
    if (anchor) {
      const dx = anchor.x - this.pos.x, dy = anchor.y - this.pos.y;
      if (dx * dx + dy * dy > this._homeLeashSq) { this.applyForce(this.seek(anchor, 1, 30)); return; }
    }
    this.applyForce(this.wander(dt));
  }

  _treeValid(p) {
    return !!(p && p.alive && !p._consumed && !p.dormant && p.growth > 0.4);
  }

  // Nearest fruiting forest tree: alive, grown, and in FOREST_TREES.
  _findFruitTree(sim) {
    if (!sim.getNearbyPlants) return null;
    const plants = sim.getNearbyPlants(this.pos.x, this.pos.y, this._feedRadius);
    const isForest = (typeof FOREST_TREES !== 'undefined') ? FOREST_TREES : null;
    let best = null, bestSq = Infinity;
    const px = this.pos.x, py = this.pos.y;
    for (let i = 0; i < plants.length; i++) {
      const p = plants[i];
      if (!p.alive || p._consumed || p.dormant || p.growth < 0.5) continue;
      if (isForest && !isForest.has(p.type)) continue;    // only large-fruited forest
      const dx = p.pos.x - px, dy = p.pos.y - py;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = p; }
    }
    return best;
  }

  // Emergent reproduction: a mature, well-fed, off-cooldown female below the flock cap
  // with a mature mate nearby lays.
  _tryReproduce(sim) {
    if (!this.mature || !this.isFemale || this._eggCooldown > 0) return;
    if (this.crop <= 0) return;                             // must be well-fed
    // Mast year (Free Play): a higher flock cap and shorter cooldown turn the glut into chicks.
    const mast = !!(sim && sim.mastYear);
    const mastMult = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.mastFlockMult) || 1.6;
    const cap = mast ? Math.ceil(this._maxPopulation() * mastMult) : this._maxPopulation();
    if (!sim.getSpeciesCount || sim.getSpeciesCount(this.speciesKey) >= cap) return;
    if (!this._hasMateNear(sim)) return;
    if (!sim.addEgg) return;

    const egg = sim.addEgg(this.pos.x, this.pos.y);
    egg.offspringType = this.speciesKey;                   // breeds true (kererū / kōkako)
    egg.parentSpecies = this.speciesKey;
    this._eggCooldown = this._eggCooldownFrames * (mast ? 0.45 : 1);
    this.crop = Math.max(0, this.crop - 1);                 // laying spends a fruit's energy
    this._onLaid();
    if (sim.game) sim.game.addNotification(`A ${this._label} nests. +egg`, 'info');
  }

  // Hook: called right after this bird lays an egg. Base no-op; the kōkako sings a post-lay song.
  _onLaid() {}

  _hasMateNear(sim) {
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    if (!list) return false;
    const rSq = this._mateRadius * this._mateRadius;
    const px = this.pos.x, py = this.pos.y;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive || !o.mature || o.isFemale === this.isFemale) continue;
      const dx = o.pos.x - px, dy = o.pos.y - py;
      if (dx * dx + dy * dy <= rSq) return true;
    }
    return false;
  }

  // Any living conspecific within `radius` (default _companyRadius)? A cheap "am I in a flock" test.
  _companyNear(sim, radius) {
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    if (!list) return false;
    const r = radius || this._companyRadius, rSq = r * r;
    const px = this.pos.x, py = this.pos.y;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive) continue;
      const dx = o.pos.x - px, dy = o.pos.y - py;
      if (dx * dx + dy * dy <= rSq) return true;
    }
    return false;
  }

  // A mature bird of the opposite sex — a potential mate. Used to spare a pair from the spacing
  // behaviours (territory / separation) so they can settle together and breed.
  _isViableMate(o) {
    return !!(o && o.mature && o.isFemale !== this.isFemale);
  }

  // Nearest living conspecific at any distance (excluding self), or null. Lets a lone bird home
  // onto the flock to regroup and pair.
  _nearestConspecific(sim) {
    const list = sim.otherEntities && sim.otherEntities[this.speciesKey];
    if (!list) return null;
    const px = this.pos.x, py = this.pos.y;
    let best = null, bestSq = Infinity;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive) continue;
      const dx = o.pos.x - px, dy = o.pos.y - py, dSq = dx * dx + dy * dy;
      if (dSq < bestSq) { bestSq = dSq; best = o; }
    }
    return best;
  }

  // ============================================================
  // MOTION/ANIM: altitude easing + facing flip + integration + land clamp.
  // ============================================================
  _isPerched() {
    return this.state === KERERU_STATE.FEEDING ||
           this.state === KERERU_STATE.PERCHED ||
           this.state === KERERU_STATE.SHELTER;
  }

  update(dt = 1) {
    this.animTime += dt;

    const perched = this._isPerched();
    if (perched && !this._wasPerched) {
      const lo = this._perchAlt * 0.7, hi = Math.max(lo + 1, this._cruiseAlt * 0.8);
      this._perchAltCur = lo + Math.random() * (hi - lo);
      this._perchDX = (Math.random() * 2 - 1) * this.size * 1.1;
      this._perchDY = (Math.random() * 2 - 1) * this.size * 0.5;
    }
    this._wasPerched = perched;
    const targetAlt = perched ? this._perchAltCur : this._cruiseAlt;
    this._altitude += (targetAlt - this._altitude) * Math.min(1, 0.08 * dt);

    super.update(dt);

    // Eased lateral facing: ease toward the sign of horizontal velocity. A perched bird holds it.
    if (!perched && Math.abs(this.vel.x) > 0.02) {
      const want = this.vel.x >= 0 ? 1 : -1;
      this._flip += (want - this._flip) * Math.min(1, 0.15 * dt);
    }

    // Hard land clamp: a bird may skim impassable ground but never ends a frame over a
    // true barrier (see _passable). _lastLand tracks genuine walkable ground for the snap-back.
    const t = this.terrain;
    if (t && typeof t.isWalkable === 'function') {
      if (t.isWalkable(this.pos.x, this.pos.y)) {
        this._lastLand.x = this.pos.x; this._lastLand.y = this.pos.y;
      } else if (!this._passable(this.pos.x, this.pos.y)) {
        this.pos.x = this._lastLand.x; this.pos.y = this._lastLand.y;
        this.vel.mult(0.3);
      }
    }
  }

  // Drawn in the local pos frame (the sim's render loop lifts the origin to the ground
  // point), so the shadow sits on the ground and the body lifts by its altitude.
  render() {
    const s = this.size * (this.mature ? 1 : 0.7);   // juveniles smaller
    const alt = this._altitude || 0;
    const perched = this._isPerched();
    const settle = perched ? Math.min(1, Math.max(0, (this._cruiseAlt - alt) / Math.max(1, this._cruiseAlt - this._perchAltCur))) : 0;
    const offX = perched ? this._perchDX * settle : 0;
    const offY = perched ? this._perchDY * settle : 0;

    push();
    translate(this.pos.x, this.pos.y);

    // Shadow on the ground, fainter/smaller the higher the bird flies.
    const sf = 1 - Math.min(0.5, alt / 60);
    noStroke();
    fill(0, 0, 0, 26 * sf);
    ellipse(3 * sf, 3 * sf, s * 1.5 * sf, s * 0.55 * sf);

    translate(offX, -alt + offY);                    // body lifts to altitude + perch offset

    // Species highlight + field-guide selection share one sprite-shaped outline, emitted
    // at the sprite draw below (after the flip, so it mirrors with the bird).

    const sprite = this._getSprite(perched);
    if (sprite) {
      const drawW = s * 2.8;
      const drawH = sprite.width > 0 ? drawW * (sprite.height / sprite.width) : drawW;
      noTint();
      imageMode(CENTER);
      scale(this._flip >= 0 ? 1 : -1, 1);            // art faces up-and-right; mirror for leftward
      // Highlight outline: field-guide selection or the player's species toggle.
      const _hlCfg = this.speciesData && this.speciesData.config && this.speciesData.config.highlightColor;
      const _olCol = (typeof highlightOutlineColor !== 'undefined')
        ? highlightOutlineColor(this.speciesKey, _hlCfg) : null;
      if (_olCol) EntitySprites.drawSpriteOutline(sprite, drawW, drawH, _olCol);
      image(sprite, 0, 0, drawW, drawH);
    } else {
      this._renderGlyph(s, perched);
    }
    this._renderExtra(s, perched);                   // subclass diegetic cue (kōkako song)
    pop();

    if (typeof CONFIG !== 'undefined' && CONFIG.showHungerBars) this._renderDebug(s, alt);
  }

  // Sprite for the current pose; null → the drawn glyph. Subclasses point elsewhere.
  _getSprite(perched) {
    return (typeof EntitySprites !== 'undefined' && EntitySprites.getKereruSprite)
      ? EntitySprites.getKereruSprite(perched) : null;
  }

  // Fallback glyph: green-grey back, pale breast, small head.
  _renderGlyph(s, perched) {
    const dir = (this._flip >= 0) ? 1 : -1;
    const wing = perched ? 1.45 : 1.75;
    fill(66, 90, 76);
    ellipse(0, 0, s * wing, s * 1.05);                               // body / wings
    fill(236, 239, 233);
    ellipse(dir * s * 0.30, s * 0.22, s * 0.85, s * 0.72);          // white waistcoat
    fill(58, 80, 68);
    ellipse(dir * s * 0.55, -s * 0.30, s * 0.62, s * 0.56);         // head
  }

  // Extra diegetic overlay in the bird's local frame. No-op for the kererū.
  _renderExtra(s, perched) {}

  _renderDebug(s, alt) {
    push();
    translate(0, -alt - s - 4);
    textAlign(CENTER, BOTTOM);
    textSize(6);
    noStroke();
    fill(150, 90, 170, 220);
    for (let i = 0; i < this.crop; i++) ellipse((i - (this.crop - 1) * 0.5) * 3, -6, 2, 2);
    fill(200, 200, 200, 150);
    text(!this.mature ? '◆' : (this.isFemale ? '♀' : '♂'), 0, 0);
    pop();
  }
}

if (typeof window !== 'undefined') {
  window.Kereru = Kereru;
  window.KERERU_SPECIES = KERERU_SPECIES;
  window.KERERU_STATE = KERERU_STATE;
  window.FLYER_TYPES = FLYER_TYPES;
}
