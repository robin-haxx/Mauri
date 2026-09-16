// ============================================
// LENS — debug visualisation overlays (toggle: key L in debug mode)
// ============================================
// A lens draws otherwise-invisible simulation state in world space so balance can
// be tuned by eye. Each lens is { id, label, drawWorld(game, z), drawScreen? }
// registered below; the manager renders the active ones over the world (under the
// HUD) and paints a clickable legend. `z` is CONFIG.viewZoom, so a lens can keep a
// constant on-screen size (divide world sizes by z). Inert unless Lens.enabled.

const Lens = {
  enabled: false,
  active: new Set(['keaPull']),   // which lenses are on when enabled
  registry: [],
  _rows: [],                      // clickable legend rows, rebuilt each screen pass

  register(l) { this.registry.push(l); return l; },
  toggleMaster() { this.enabled = !this.enabled; return this.enabled; },
  toggle(id) { if (this.active.has(id)) this.active.delete(id); else this.active.add(id); },
  isOn(id) { return this.enabled && this.active.has(id); },

  // Small stable palette so multiple instances (e.g. several caches) read apart.
  COLORS: [[255,196,64],[86,180,255],[255,120,190],[120,230,140],[190,150,255],[255,150,90]],
  colOf(i) { return this.COLORS[((i % this.COLORS.length) + this.COLORS.length) % this.COLORS.length]; },

  // World-space geometry, drawn inside the game-area transform (over world, under HUD).
  renderWorld(game) {
    if (!this.enabled) return;
    const z = (typeof CONFIG !== 'undefined' && CONFIG.viewZoom) ? CONFIG.viewZoom : 1;
    for (const l of this.registry) {
      if (!this.active.has(l.id) || !l.drawWorld) continue;
      push();
      try { l.drawWorld(game, z); }
      catch (e) { if (typeof console !== 'undefined') console.warn('[lens]', l.id, e); }
      pop();
    }
  },

  // Screen-space legend + per-lens readouts, in logical 1080-space (clickable rows).
  renderScreen(game) {
    this._rows = [];
    if (!this.enabled) return;
    const pad = 8, rowH = 19, w = 188, x = 12,
          y = (typeof CONFIG !== 'undefined' && CONFIG.viewY ? CONFIG.viewY : 60) + 40;
    const h = pad * 2 + 16 + this.registry.length * rowH;
    push();
    noStroke(); fill(16, 22, 28, 212); rect(x, y, w, h, 8);
    stroke(70, 110, 90, 140); noFill(); strokeWeight(1); rect(x, y, w, h, 8);
    noStroke(); fill(150, 220, 190); textAlign(LEFT, TOP); textSize(11); textStyle(BOLD);
    text('LENS · debug (L)', x + pad, y + pad);
    textStyle(NORMAL);
    let ry = y + pad + 17;
    for (const l of this.registry) {
      const on = this.active.has(l.id);
      noStroke(); fill(on ? [120, 230, 140] : [80, 92, 104]);
      circle(x + pad + 5, ry + rowH / 2, 9);
      fill(on ? [232, 242, 236] : [140, 150, 160]);
      textAlign(LEFT, CENTER); textSize(11);
      text(l.label, x + pad + 16, ry + rowH / 2 + 1);
      this._rows.push({ id: l.id, x, y: ry, w, h: rowH });
      ry += rowH;
    }
    pop();
    for (const l of this.registry) {
      if (!this.active.has(l.id) || !l.drawScreen) continue;
      push();
      try { l.drawScreen(game); } catch (e) { /* screen readout is best-effort */ }
      pop();
    }
  },

  // Legend hit-test. Returns true if a row was clicked.
  handleClick(mx, my) {
    if (!this.enabled) return false;
    for (const r of this._rows) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        this.toggle(r.id);
        return true;
      }
    }
    return false;
  }
};

// --------------------------------------------------------------------------------------
// LENS: Kea ▸ Berry Cache "pull"
// --------------------------------------------------------------------------------------
// Each Berry Cache shows its effect radius and (faintly) its attract reach; a line
// runs from every committed kea to its chosen cache. Moa nests + eggs marked for
// context. See mauri_kea.js _chooseLure.
Lens.register({
  id: 'keaPull',
  label: 'Kea ▸ Berry Cache pull',
  drawWorld(game, z) {
    const sim = game.simulation;
    if (!sim) return;
    const lw = 1.4 / z;                 // ~1.4 logical px strokes regardless of zoom
    const rMark = (base) => base / z;   // marker radii in logical px

    // Gather caches + committed kea (crowd per cache).
    const caches = [];
    const list = sim.placeables || [];
    for (const p of list) if (p.alive && p.type === 'keaLure') caches.push(p);
    const idxOf = new Map(); caches.forEach((c, i) => idxOf.set(c, i));

    const kea = [];
    const crowd = new Map();
    const oe = sim.otherEntities || {};
    for (const k in oe) {
      const arr = oe[k]; if (!arr) continue;
      for (const e of arr) {
        if (!e || !e.alive || e.speciesKey !== 'kea') continue;
        kea.push(e);
        const c = e._lureChoice;
        if (c && c.alive) crowd.set(c, (crowd.get(c) || 0) + 1);
      }
    }

    // Context — moa nesting sites (rings) and un-hatched moa eggs (pips).
    if (sim.nestingSites) {
      noFill(); stroke(235, 238, 248, 140); strokeWeight(lw * 0.8);
      for (const s of sim.nestingSites) if (s && s.pos) circle(s.pos.x, s.pos.y, 40 + rMark(6));
    }
    if (sim.eggs) {
      for (const e of sim.eggs) {
        if (!e || !e.alive || e.hatched) continue;
        if (e.offspringType && e.offspringType !== 'moa') continue;
        noStroke(); fill(250, 242, 214, 230); circle(e.pos.x, e.pos.y, rMark(3) + 5);
        noFill(); stroke(150, 110, 70, 210); strokeWeight(lw * 0.7); circle(e.pos.x, e.pos.y, rMark(3) + 5);
      }
    }

    // Caches — attract reach (faint), effect radius (solid), a core sized by current draw.
    caches.forEach((c, i) => {
      const col = Lens.colOf(i);
      const rEff = (c.def && (c.def.coverRadius || c.def.radius)) || 70;
      const rAtt = (c.def && c.def.keaAttractRadius) || 520;
      noFill();
      stroke(col[0], col[1], col[2], 42); strokeWeight(lw);
      circle(c.pos.x, c.pos.y, rAtt * 2);                    // full pull reach (wide → kept faint)
      stroke(col[0], col[1], col[2], 215); strokeWeight(lw * 1.35);
      circle(c.pos.x, c.pos.y, rEff * 2);                    // food/effect radius
      const base = (c.def && c.def.keaLureNutrition != null) ? c.def.keaLureNutrition : 6;
      const draw = base + (c._keaFood || 0);
      const rCore = Math.min(rEff * 0.85, rMark(4) + draw * (0.45 / z));
      noStroke(); fill(col[0], col[1], col[2], 205); circle(c.pos.x, c.pos.y, rCore * 2);
      // Readout: committed kea · available food.
      const n = crowd.get(c) || 0;
      fill(col[0], col[1], col[2], 245); textAlign(CENTER, BOTTOM);
      textSize(12 / z); textStyle(BOLD);
      text(`${n} kea · food ${Math.round(draw)}`, c.pos.x, c.pos.y - rEff - rMark(5));
      textStyle(NORMAL);
    });

    // The pull itself — a line from each kea to its committed cache; grey pip if idle.
    for (const k of kea) {
      const c = k._lureChoice;
      const kx = k.pos.x, ky = k.pos.y;
      if (c && idxOf.has(c)) {
        const col = Lens.colOf(idxOf.get(c));
        stroke(col[0], col[1], col[2], 175); strokeWeight(lw);
        line(kx, ky, c.pos.x, c.pos.y);
        noStroke(); fill(col[0], col[1], col[2], 240); circle(kx, ky, rMark(4) + 2.5);
      } else {
        noStroke(); fill(205, 210, 220, 130); circle(kx, ky, rMark(3) + 1.5);
      }
    }
  }
});
