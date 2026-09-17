// ============================================================
// NESTING SITE; an established moa nest
// A fixed patch of ground where moa gather to lay, so eggs cluster into legible
// nests that eagles patrol and kea raid. Seeded at level start (some in forest)
// and can form where the player grows forest. A raid consumes the eggs in range,
// destroys the site, and sends its moa migrating elsewhere. The simulation owns
// the list and the seeding/destroy logic. Gated by LEVEL_MECHANICS.nestingSites.
// ============================================================

class NestingSite {
  constructor(x, y, opts = {}) {
    this.pos = createVector(x, y);
    this.radius = opts.radius != null ? opts.radius : 46;
    this.radiusSq = this.radius * this.radius;
    this.id = NestingSite._nextId++;
    this.alive = true;
    // 'forest' (downslope podocarp) or 'open' (flats/subalpine): which moa favour it.
    this.habitat = opts.habitat || 'open';
    this.eggCount = 0;          // recomputed by the sim from eggs in range
    this.animTime = Math.random() * 1000;
  }

  isInRange(pos) {
    const dx = pos.x - this.pos.x, dy = pos.y - this.pos.y;
    return dx * dx + dy * dy <= this.radiusSq;
  }

  // A shallow scrape ring, tinted by habitat, with eggs when a clutch is present.
  render() {
    const r = this.radius;
    push();
    translate(this.pos.x, this.pos.y);
    noStroke();

    // Footprint ring.
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

    // A small clutch of pale eggs when the site holds one.
    const eggs = Math.min(4, this.eggCount);
    fill(236, 228, 208);
    for (let i = 0; i < eggs; i++) {
      const a = (i / 4) * TWO_PI + this.animTime * 0.001;
      ellipse(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.14, r * 0.16, r * 0.2);
    }
    pop();
  }

  // Raid-hover cue, drawn in a late pass so foliage never hides it. Tints the nest
  // green (raidable) or red (not) and prints the raid success% at its centre.
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
