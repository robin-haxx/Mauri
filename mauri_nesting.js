// ============================================================
// NESTING SITE — an established moa nest (Kea Raid v2)
// ------------------------------------------------------------
// A fixed patch of ground where moa gather to lay. Eggs cluster here rather than
// being dropped wherever a bird happens to stand, so the flock has legible NESTS —
// the thing eagles patrol (Link 3) and the thing kea raid (Slice D). Sites are
// seeded at level start (some downslope in the forest) and more can form where the
// player grows the forest (Slice B). A raid consumes the eggs in the site's radius,
// destroys the site, and sends its moa migrating to another site.
//
// Purely a place + a small amount of state; the simulation owns the list and the
// seeding/destroy logic (mauri_simulation.js). Gated by LEVEL_MECHANICS.nestingSites.
//
// Placeholder art: a drawn nest scrape — a ring of moss/twigs with a few pale eggs
// shown when the site holds a clutch.
// ============================================================

class NestingSite {
  constructor(x, y, opts = {}) {
    this.pos = createVector(x, y);
    this.radius = opts.radius != null ? opts.radius : 46;
    this.radiusSq = this.radius * this.radius;
    this.id = NestingSite._nextId++;
    this.alive = true;
    // 'forest' (downslope podocarp) or 'open' (flats/subalpine) — flavour + which
    // moa favour it, and what the raid clears from the forest.
    this.habitat = opts.habitat || 'open';
    this.eggCount = 0;          // recomputed by the sim from eggs in range (indicator/tally)
    this.animTime = Math.random() * 1000;
  }

  isInRange(pos) {
    const dx = pos.x - this.pos.x, dy = pos.y - this.pos.y;
    return dx * dx + dy * dy <= this.radiusSq;
  }

  // Drawn in the local pos frame (the sim's cast loop lifts it onto the relief). A
  // shallow scrape ring, tinted by habitat, with a few eggs when a clutch is present.
  render() {
    const r = this.radius;
    push();
    translate(this.pos.x, this.pos.y);
    noStroke();

    // Footprint ring — the cleared nest scrape.
    const forest = this.habitat === 'forest';
    fill(forest ? 60 : 78, forest ? 52 : 68, forest ? 38 : 46, 60);
    ellipse(0, 0, r * 1.7, r * 1.05);
    fill(forest ? 74 : 94, forest ? 64 : 82, forest ? 46 : 56, 90);
    ellipse(0, 0, r * 1.15, r * 0.7);

    // Rim of twigs/moss.
    stroke(forest ? 48 : 66, forest ? 42 : 56, forest ? 30 : 36, 150);
    strokeWeight(2);
    noFill();
    ellipse(0, 0, r * 1.15, r * 0.7);
    noStroke();

    // A small clutch of pale eggs when the site holds one (visual cue for the raid).
    const eggs = Math.min(4, this.eggCount);
    fill(236, 228, 208);
    for (let i = 0; i < eggs; i++) {
      const a = (i / 4) * TWO_PI + this.animTime * 0.001;
      ellipse(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.14, r * 0.16, r * 0.2);
    }
    pop();
  }

  // Raid-hover cue, drawn in a LATE pass (ON TOP of the cast) so foliage never hides it —
  // set by Game._renderRaidPanel while a nest row is hovered. Tints the nest green
  // (raidable) or red (not) and prints the raid success% at its centre: a play-area echo
  // of the panel row under the cursor. Same local frame as render() (own translate to
  // pos), so it billboards correctly in 3D.
  renderRaidOverlay() {
    if (!this._raidHover) return;
    const r = this.radius;
    push();
    translate(this.pos.x, this.pos.y);
    const ok = this._raidHover.raidable;
    noStroke();
    fill(ok ? 70 : 210, ok ? 200 : 66, ok ? 96 : 60, 115);
    ellipse(0, 0, r * 1.7, r * 1.05);
    stroke(ok ? 130 : 240, ok ? 235 : 100, ok ? 140 : 92, 225); strokeWeight(2.5); noFill();
    ellipse(0, 0, r * 1.7, r * 1.05);
    noStroke();
    fill(255, 255, 255, 248);
    textAlign(CENTER, CENTER); textSize(r * 0.5); textStyle(BOLD);
    if (typeof FreckleFace !== 'undefined') textFont(FreckleFace);
    text(`${this._raidHover.pct}%`, 0, 0);
    textStyle(NORMAL);
    pop();
  }
}
NestingSite._nextId = 1;

if (typeof window !== 'undefined') window.NestingSite = NestingSite;
