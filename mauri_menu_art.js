// ============================================
// MENU ART MANAGER
// Illustration layers for level start screens: core + wings (widescreen) + bleed
// (tall). Falls back to a plain background when no art is configured.
// ============================================

class MenuArtManager {
  constructor() {
    this.images = {};        // { core, leftWing, rightWing, topBleed, bottomBleed }
    this.loaded = false;
    this.loading = false;
    this.currentLevelId = null;
    this.config = null;      // art config from level definition
    this.bgColor = [25, 35, 30];
  }

  // Load illustration assets for a level; renders a plain background if none configured.
  loadForLevel(levelDef) {
    const artConfig = levelDef?.menu?.art;

    // Reset if no art configured
    if (!artConfig || !artConfig.paths) {
      this.loaded = false;
      this.loading = false;
      this.config = artConfig || null;
      this.currentLevelId = levelDef?.id || null;
      this.bgColor = artConfig?.bgColor || [25, 35, 30];
      return;
    }

    // Skip reload if already loaded for this level
    if (this.currentLevelId === levelDef.id && this.loaded) return;

    this.currentLevelId = levelDef.id;
    this.config = artConfig;
    this.bgColor = artConfig.bgColor || [25, 35, 30];
    this.images = {};
    this.loaded = false;
    this.loading = true;

    const assetKeys = ['core', 'leftWing', 'rightWing', 'topBleed', 'bottomBleed'];
    let expectedCount = 0;
    let loadedCount = 0;

    const onAssetResult = () => {
      loadedCount++;
      if (loadedCount >= expectedCount) {
        this.loaded = true;
        this.loading = false;
      }
    };

    for (const key of assetKeys) {
      if (artConfig.paths[key]) {
        expectedCount++;
        loadImage(
          artConfig.paths[key],
          (img) => {
            this.images[key] = img;
            onAssetResult();
          },
          () => {
            console.warn(`MenuArt: Failed to load '${key}' from ${artConfig.paths[key]}`);
            onAssetResult();
          }
        );
      }
    }

    if (expectedCount === 0) {
      this.loaded = false;
      this.loading = false;
    }
  }

  // Render the illustration behind menu UI elements.
  render(canvasW, canvasH) {
    // Always fill background colour first (covers entire canvas)
    noStroke();
    fill(this.bgColor[0], this.bgColor[1], this.bgColor[2]);
    rect(0, 0, canvasW, canvasH);

    // If art isn't loaded (or doesn't exist), just render vignette
    if (!this.loaded || !this.config) {
      this._renderVignette(canvasW, canvasH);
      return;
    }

    const coreW = this.config.coreWidth || 1600;
    const coreH = this.config.coreHeight || 1080;
    const coreX = (canvasW - coreW) / 2;
    const coreY = (canvasH - coreH) / 2;

    // --- Core illustration (always centred) ---
    if (this.images.core) {
      image(this.images.core, coreX, coreY, coreW, coreH);
    }

    // --- Left wing (visible on widescreen when canvas > core) ---
    if (coreX > 0) {
      if (this.images.leftWing) {
        const srcAspect = this.images.leftWing.width / this.images.leftWing.height;
        const drawH = coreH;
        const drawW = Math.min(coreX, drawH * srcAspect);
        const drawX = coreX - drawW;
        image(this.images.leftWing, drawX, coreY, drawW, drawH);

        // Fade remaining gap on far left
        if (drawX > 0) {
          this._renderEdgeFade(0, coreY, drawX, drawH, 'left');
        }
      } else {
        // No wing image; fade from bg colour into core edge
        this._renderEdgeFade(0, coreY, coreX, coreH, 'left');
      }
    }

    // --- Right wing ---
    if (coreX + coreW < canvasW) {
      const gapW = canvasW - (coreX + coreW);
      if (this.images.rightWing) {
        const srcAspect = this.images.rightWing.width / this.images.rightWing.height;
        const drawH = coreH;
        const drawW = Math.min(gapW, drawH * srcAspect);
        image(this.images.rightWing, coreX + coreW, coreY, drawW, drawH);

        // Fade remaining gap on far right
        const rightEdge = coreX + coreW + drawW;
        if (rightEdge < canvasW) {
          this._renderEdgeFade(rightEdge, coreY, canvasW - rightEdge, drawH, 'right');
        }
      } else {
        this._renderEdgeFade(coreX + coreW, coreY, gapW, coreH, 'right');
      }
    }

    // --- Top bleed (visible on taller ratios like 4:3) ---
    if (coreY > 0) {
      if (this.images.topBleed) {
        const srcAspect = this.images.topBleed.width / this.images.topBleed.height;
        const drawW = coreW;
        const drawH = Math.min(coreY, drawW / srcAspect);
        image(this.images.topBleed, coreX, coreY - drawH, drawW, drawH);

        // Fade above the bleed
        if (coreY - drawH > 0) {
          this._renderEdgeFade(coreX, 0, coreW, coreY - drawH, 'top');
        }
      } else {
        this._renderEdgeFade(0, 0, canvasW, coreY, 'top');
      }
    }

    // --- Bottom bleed ---
    if (coreY + coreH < canvasH) {
      const bottomGap = canvasH - (coreY + coreH);
      if (this.images.bottomBleed) {
        const srcAspect = this.images.bottomBleed.width / this.images.bottomBleed.height;
        const drawW = coreW;
        const drawH = Math.min(bottomGap, drawW / srcAspect);
        image(this.images.bottomBleed, coreX, coreY + coreH, drawW, drawH);

        const bottomEdge = coreY + coreH + drawH;
        if (bottomEdge < canvasH) {
          this._renderEdgeFade(coreX, bottomEdge, coreW, canvasH - bottomEdge, 'bottom');
        }
      } else {
        this._renderEdgeFade(0, coreY + coreH, canvasW, bottomGap, 'bottom');
      }
    }

    // Vignette over assembled illustration
    this._renderVignette(canvasW, canvasH);

    // Semi-transparent overlays behind UI text areas for readability
    this._renderTextProtection(canvasW, canvasH);
  }

  // Subtle edge darkening.
  _renderVignette(w, h) {
    noStroke();
    for (let i = 0; i < 5; i++) {
      fill(0, 0, 0, 3 - i * 0.5);
      rect(i * 20, i * 20, w - i * 40, h - i * 40);
    }
  }

  // Dark overlays behind key UI zones so text stays readable.
  _renderTextProtection(w, h) {
    const centerY = h / 2;
    noStroke();

    // Title zone (top of content)
    fill(0, 0, 0, 40);
    rect(0, centerY - 340, w, 120);

    // Central content zone (hero sprites, plants, description)
    fill(0, 0, 0, 25);
    rect(0, centerY - 180, w, 400);

    // Button zone (bottom of content)
    fill(0, 0, 0, 35);
    rect(0, centerY + 200, w, 120);
  }

  // Graduated fade from illustration edge to background colour.
  _renderEdgeFade(x, y, w, h, direction) {
    const steps = 20;
    noStroke();

    if (direction === 'left' || direction === 'right') {
      const stepW = w / steps;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        // left: opaque at x=0, transparent near core
        // right: transparent near core, opaque at far edge
        const alpha = direction === 'left' ? (1 - t) * 200 : t * 200;
        fill(this.bgColor[0], this.bgColor[1], this.bgColor[2], alpha);
        rect(x + i * stepW, y, stepW + 1, h);
      }
    } else {
      const stepH = h / steps;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        // top: opaque at y=0, transparent near core
        // bottom: transparent near core, opaque at far edge
        const alpha = direction === 'top' ? (1 - t) * 200 : t * 200;
        fill(this.bgColor[0], this.bgColor[1], this.bgColor[2], alpha);
        rect(x, y + i * stepH, w, stepH + 1);
      }
    }
  }

  // Release loaded images and reset state.
  clear() {
    this.images = {};
    this.loaded = false;
    this.loading = false;
    this.currentLevelId = null;
    this.config = null;
  }
}

// ============================================
// MENU STYLE
// The level select's hand-made look: an organic, pebbled ground (baked once per canvas size)
// and stone-slab section buttons that sit up off it and press down under the pointer (each
// slab's face, sides and shadow baked once per size). Everything here draws in canvas
// (1080-space) units onto the main canvas; the bakes carry the supersample for crispness.
// ============================================

const MenuStyle = {
  _bg: null, _bgKey: '',
  _slabs: new Map(),    // key → { face, side, shadow, pad, W, H }

  // A seeded 0..1 generator (mulberry32), so the bakes come out the same every time and
  // never touch p5's random() sequence.
  _rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  _hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  },

  // Smooth 2D value noise (0..1) on a seeded 64×64 lattice that wraps.
  _noise2(rnd) {
    const N = 64, v = new Float32Array(N * N);
    for (let i = 0; i < v.length; i++) v[i] = rnd();
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const fx = sm(x - xi), fy = sm(y - yi);
      const x0 = ((xi % N) + N) % N, y0 = ((yi % N) + N) % N;
      const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
      const top = v[y0 * N + x0] + (v[y0 * N + x1] - v[y0 * N + x0]) * fx;
      const bot = v[y1 * N + x0] + (v[y1 * N + x1] - v[y1 * N + x0]) * fx;
      return top + (bot - top) * fy;
    };
  },

  _ss() { return (typeof spriteSS === 'function') ? spriteSS() : 1; },

  // ---- the ground ------------------------------------------------------------------------

  // Paint the menu's ground over the whole canvas (w × h).
  drawBackground(w, h) {
    const key = `${w}x${h}@${this._ss()}`;
    if (this._bgKey !== key) {
      if (this._bg && typeof freeGraphics === 'function') freeGraphics(this._bg);
      this._bg = this._bakeBackground(w, h, this._ss());
      this._bgKey = key;
    }
    image(this._bg, 0, 0, w, h);
  },

  // A dark moss-green field, mottled, and covered in small organic cells: soft-edged pebbles
  // and lichen rosettes, each a wobbly closed curve with a dark rim and a faint lit edge.
  // Where a slow noise field runs high the cells crowd and swell into colonies; elsewhere they
  // thin to bare ground. A vignette pulls the edges down so the middle reads.
  _bakeBackground(w, h, ss) {
    const g = createGraphics(w, h);
    g.pixelDensity(ss);
    const c = g.drawingContext;
    const rnd = this._rng(0x5eed7a1a);
    const field = this._noise2(rnd), grain = this._noise2(rnd);

    c.fillStyle = 'rgb(24, 35, 30)';
    c.fillRect(0, 0, w, h);

    // Mottling: broad soft pools of lighter moss and darker earth.
    for (let i = 0; i < 46; i++) {
      const x = rnd() * w, y = rnd() * h, r = 140 + rnd() * 340;
      const light = rnd() < 0.5;
      const grad = c.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, light ? 'rgba(70, 104, 76, 0.13)' : 'rgba(6, 12, 10, 0.22)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = grad;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // The cells: pebbles (plain wobbly ovals) and lichen rosettes (scalloped, with a ring
    // inside), crowding and swelling where the colony field runs high.
    const count = Math.round(w * h / 165);
    const PMAX = 16;
    const px = new Float32Array(PMAX), py = new Float32Array(PMAX);
    // A wobbly closed curve around (x, y): radius r, `lobes` scallops of depth `lobeD`.
    const blob = (x, y, r, P, lobes, lobeD, phase, rot, squash) => {
      const cr = Math.cos(rot), sr = Math.sin(rot);
      for (let k = 0; k < P; k++) {
        const a = (k / P) * Math.PI * 2;
        const rr = r * (0.86 + rnd() * 0.2) * (1 + lobeD * Math.sin(a * lobes + phase));
        const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * squash;
        px[k] = x + lx * cr - ly * sr;
        py[k] = y + lx * sr + ly * cr;
      }
      // A smooth closed curve through the points' midpoints.
      c.beginPath();
      c.moveTo((px[P - 1] + px[0]) / 2, (py[P - 1] + py[0]) / 2);
      for (let k = 0; k < P; k++) {
        const k2 = (k + 1) % P;
        c.quadraticCurveTo(px[k], py[k], (px[k] + px[k2]) / 2, (py[k] + py[k2]) / 2);
      }
      c.closePath();
    };
    for (let i = 0; i < count; i++) {
      const x = rnd() * w, y = rnd() * h;
      const n = field(x * 0.006, y * 0.006);              // colony strength here
      if (rnd() > 0.62 + 0.6 * n) continue;             // thinner between colonies
      const m = grain(x * 0.02, y * 0.02);               // finer variation in the rims
      const r = (2 + 16 * n * n + rnd() * 3) * (0.65 + 0.6 * rnd());
      const rot = rnd() * Math.PI * 2;
      const rosette = r > 6 && rnd() < 0.55;
      const squash = rosette ? 0.85 + rnd() * 0.15 : 0.62 + rnd() * 0.34;
      const P = rosette ? 16 : (r > 5 ? 9 : 6);
      blob(x, y, r, P, rosette ? 5 + Math.floor(rnd() * 3) : 0, rosette ? 0.2 : 0, rnd() * 6.3, rot, squash);
      c.fillStyle = rnd() < 0.8
        ? `rgba(196, 232, 204, ${0.03 + 0.035 * n})`
        : `rgba(6, 14, 10, ${0.12 + 0.08 * n})`;
      c.fill();
      c.lineWidth = 0.45 + 1.2 * m;
      c.strokeStyle = `rgba(9, 15, 13, ${0.32 + 0.35 * n})`;
      c.stroke();
      if (rosette) {   // the rosette's inner ring (its fruiting centre)
        blob(x, y, r * 0.42, 8, 0, 0, 0, rot, squash);
        c.fillStyle = `rgba(214, 238, 196, ${0.035 + 0.04 * n})`;
        c.fill();
        c.lineWidth = 0.7;
        c.strokeStyle = `rgba(9, 15, 13, ${0.28 + 0.3 * n})`;
        c.stroke();
      }
      if (r > 5) {   // a lit upper-left edge, so the bigger cells stand up off the ground
        c.beginPath();
        c.ellipse(x - r * 0.08, y - r * 0.1, r * 0.8, r * 0.8 * squash, rot, Math.PI * 1.05, Math.PI * 1.55);
        c.lineWidth = 0.9;
        c.strokeStyle = `rgba(225, 255, 232, ${0.05 + 0.06 * n})`;
        c.stroke();
      }
    }

    // Spores: a fine light dust over everything.
    c.fillStyle = 'rgba(200, 236, 210, 0.07)';
    const dust = Math.round(w * h / 900);
    for (let i = 0; i < dust; i++) {
      const s = 0.6 + rnd() * 1.1;
      c.fillRect(rnd() * w, rnd() * h, s, s);
    }

    // Vignette.
    const vg = c.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.45, Math.hypot(w, h) * 0.62);
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(0, 0, 0, 0.58)');
    c.fillStyle = vg;
    c.fillRect(0, 0, w, h);
    return g;
  },

  // ---- stone slabs -----------------------------------------------------------------------

  // An irregular rounded-rectangle outline w × h (offset by pad), its points nudged in and out
  // along their normals by seeded noise, so each slab has its own chipped edge.
  _slabOutline(w, h, pad, rnd) {
    const r = Math.min(h * 0.42, 30), pts = [];
    const edge = this._noise2(rnd);
    const add = (x, y, nx, ny) => pts.push({ x, y, nx, ny });
    const side = (x0, y0, x1, y1, nx, ny) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 18));
      for (let i = 0; i < n; i++) add(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, nx, ny);
    };
    const corner = (cx, cy, a0) => {
      for (let i = 0; i < 6; i++) {
        const a = a0 + (i / 6) * Math.PI / 2;
        add(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a));
      }
    };
    side(r, 0, w - r, 0, 0, -1);        corner(w - r, r, -Math.PI / 2);
    side(w, r, w, h - r, 1, 0);         corner(w - r, h - r, 0);
    side(w - r, h, r, h, 0, 1);         corner(r, h - r, Math.PI / 2);
    side(0, h - r, 0, r, -1, 0);        corner(r, r, Math.PI);
    return pts.map((p, i) => {
      const d = (edge(i * 0.45, 3.7) - 0.5) * 5 + (rnd() - 0.5) * 1.2;
      return { x: pad + p.x + p.nx * d, y: pad + p.y + p.ny * d };
    });
  },

  _slabPath(c, pts, dx = 0, dy = 0) {
    const P = pts.length;
    c.beginPath();
    c.moveTo((pts[P - 1].x + pts[0].x) / 2 + dx, (pts[P - 1].y + pts[0].y) / 2 + dy);
    for (let k = 0; k < P; k++) {
      const a = pts[k], b = pts[(k + 1) % P];
      c.quadraticCurveTo(a.x + dx, a.y + dy, (a.x + b.x) / 2 + dx, (a.y + b.y) / 2 + dy);
    }
    c.closePath();
  },

  // Bake one slab: its top face (greywacke: a lit-to-shaded gradient, mottles, grit, pits and
  // a hairline crack or two, with a bevelled rim), its side (the darker stone below the face)
  // and its soft shadow on the ground.
  _bakeSlab(key, w, h, ss) {
    const pad = 22, W = w + pad * 2, H = h + pad * 2;
    const rnd = this._rng(this._hash(key));
    const pts = this._slabOutline(w, h, pad, rnd);
    const mk = () => { const g = createGraphics(W, H); g.pixelDensity(ss); return g; };

    // Face.
    const face = mk(), c = face.drawingContext;
    this._slabPath(c, pts);
    const grad = c.createLinearGradient(0, pad, 0, pad + h);
    grad.addColorStop(0, 'rgb(138, 146, 128)');
    grad.addColorStop(0.55, 'rgb(108, 117, 101)');
    grad.addColorStop(1, 'rgb(84, 92, 79)');
    c.fillStyle = grad;
    c.fill();
    c.save();
    this._slabPath(c, pts);
    c.clip();
    const mottles = Math.round(w / 6);
    for (let i = 0; i < mottles; i++) {
      const x = pad + rnd() * w, y = pad + rnd() * h, r = 8 + rnd() * 46;
      const mg = c.createRadialGradient(x, y, 0, x, y, r);
      mg.addColorStop(0, rnd() < 0.5 ? 'rgba(200, 206, 180, 0.12)' : 'rgba(40, 48, 38, 0.16)');
      mg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = mg;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const grit = Math.round(w * h / 45);
    for (let i = 0; i < grit; i++) {
      const s = 0.6 + rnd() * 1.4;
      c.fillStyle = rnd() < 0.4
        ? `rgba(236, 238, 220, ${0.10 + rnd() * 0.18})`
        : `rgba(28, 32, 26, ${0.14 + rnd() * 0.24})`;
      c.fillRect(pad + rnd() * w, pad + rnd() * h, s, s);
    }
    const pits = Math.round(w / 40);
    for (let i = 0; i < pits; i++) {   // a dark hollow with a lit lower lip
      const x = pad + rnd() * w, y = pad + 6 + rnd() * (h - 12), r = 1.2 + rnd() * 2.6;
      c.beginPath(); c.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      c.fillStyle = 'rgba(30, 34, 28, 0.45)'; c.fill();
      c.beginPath(); c.ellipse(x, y + 0.6, r, r * 0.75, 0, Math.PI * 0.15, Math.PI * 0.85);
      c.lineWidth = 0.8; c.strokeStyle = 'rgba(235, 240, 220, 0.30)'; c.stroke();
    }
    for (let i = 0; i < 2; i++) {      // hairline cracks running in from the top edge
      let x = pad + w * (0.12 + rnd() * 0.76), y = pad - 2, a = Math.PI / 2 + (rnd() - 0.5) * 0.8;
      const seg = [[x, y]];
      const steps = 6 + Math.floor(rnd() * 5);
      for (let s = 0; s < steps; s++) {
        a += (rnd() - 0.5) * 0.9;
        x += Math.cos(a) * (5 + rnd() * 7); y += Math.sin(a) * (4 + rnd() * 6);
        seg.push([x, y]);
      }
      for (const [col, off, lw] of [['rgba(236, 240, 222, 0.22)', 0.9, 0.8], ['rgba(24, 28, 22, 0.55)', 0, 1.1]]) {
        c.beginPath();
        seg.forEach(([sx, sy], j) => j ? c.lineTo(sx, sy + off) : c.moveTo(sx, sy + off));
        c.lineWidth = lw; c.strokeStyle = col; c.stroke();
      }
    }
    // Bevel: a lit rim along the top, a shaded one along the bottom (stroked inside the edge).
    const bev = c.createLinearGradient(0, pad, 0, pad + h);
    bev.addColorStop(0, 'rgba(255, 252, 230, 0.55)');
    bev.addColorStop(0.35, 'rgba(255, 252, 230, 0)');
    bev.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    bev.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
    this._slabPath(c, pts);
    c.lineWidth = 7; c.strokeStyle = bev; c.stroke();
    c.restore();
    this._slabPath(c, pts);
    c.lineWidth = 1.6; c.strokeStyle = 'rgba(14, 18, 14, 0.9)'; c.stroke();

    // Side: the slab's body, darker, its lower edge darker still.
    const side = mk(), sc = side.drawingContext;
    this._slabPath(sc, pts);
    const sg = sc.createLinearGradient(0, pad, 0, pad + h);
    sg.addColorStop(0, 'rgb(64, 70, 60)');
    sg.addColorStop(1, 'rgb(38, 42, 36)');
    sc.fillStyle = sg; sc.fill();
    sc.lineWidth = 1.6; sc.strokeStyle = 'rgba(10, 14, 10, 0.9)'; sc.stroke();

    // Shadow: the outline, blurred. It is drawn far off the canvas and thrown back on by the
    // shadow offset (which, like the blur, is in device pixels), so only the shadow lands.
    const shadow = mk(), hc = shadow.drawingContext;
    hc.shadowColor = 'rgba(0, 0, 0, 0.62)';
    hc.shadowBlur = 10 * ss;
    hc.shadowOffsetX = 4000 * ss;
    this._slabPath(hc, pts, -4000, 0);
    hc.fillStyle = '#000'; hc.fill();

    return { face, side, shadow, pad, W, H };
  },

  _slab(key, w, h) {
    const ss = this._ss(), k = `${key}|${w}|${h}|${ss}`;
    let s = this._slabs.get(k);
    if (!s) { s = this._bakeSlab(key, w, h, ss); this._slabs.set(k, s); }
    return s;
  },

  // Draw a stone slab button w × h whose ground footprint has its top-left at (x, y + depth):
  // it stands `lift` px up off the ground (0 = pressed flat, depth = raised high), its side
  // showing below the face and its shadow softening as it rises. Returns the face's top y.
  drawSlab(key, x, y, w, h, lift, depth) {
    const s = this._slab(key, w, h), p = s.pad;
    const ctx = drawingContext;
    const top = y + depth - lift;
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.55 * Math.max(0, Math.min(1, lift / depth));
    image(s.shadow, x - p, y + depth + 2 + lift * 0.35 - p, s.W, s.H);
    ctx.restore();
    for (let o = y + depth; o > top; o -= 1) image(s.side, x - p, o - p, s.W, s.H);
    image(s.face, x - p, top - p, s.W, s.H);
    return top;
  },

  // A recessed tray (an open section's contents sit in it): dark, with an inner shadow under
  // its top edge and a faint lit lip along its bottom.
  drawTray(x, y, w, h, r) {
    if (h <= 1) return;
    const c = drawingContext;
    const shape = () => {
      c.beginPath();
      if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
    };
    c.save();
    shape();
    c.fillStyle = 'rgba(14, 24, 19, 0.92)';
    c.fill();
    c.clip();
    const ih = Math.min(h, 60);
    const ig = c.createLinearGradient(0, y, 0, y + ih);
    ig.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    ig.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = ig;
    c.fillRect(x, y, w, ih);
    c.restore();
    c.save();
    shape();
    c.lineWidth = 2; c.strokeStyle = 'rgba(0, 0, 0, 0.6)'; c.stroke();
    c.beginPath();
    c.moveTo(x + r, y + h + 1); c.lineTo(x + w - r, y + h + 1);
    c.lineWidth = 1; c.strokeStyle = 'rgba(190, 230, 200, 0.10)'; c.stroke();
    c.restore();
  }
};