// ============================================
// SPRITE ATLAS — runtime texture consolidation
// ============================================
// Sprite PNGs are loaded individually in preload(), giving ~150 GPU textures at
// draw time. This packs all loaded frames into a few large pages once, at setup(),
// so the cast draws from one or a few shared textures — cutting texture binds, the
// texture count, and VRAM fragmentation (not fill rate, so not a frame-rate fix).
//
// build() replaces each loaded p5.Image (in place, aliases and all) with a
// lightweight AtlasFrame whose width/height mirror the original, then wraps the
// global image() so image(frame, …) expands to the sub-rectangle draw. Real
// p5.Images fall through untouched; the two offscreen graphics-method g.image()
// sites (tint bake, plant gallery) call SpriteAtlas.drawTo() instead. Failure is a
// no-op: an unloadable or oversized image is left as its original reference.

const SpriteAtlas = {
  MAX_PAGE: 4096,   // page dimension cap — Chrome guarantees >= 4096; kiosk-safe
  // Transparent px between frames, sized for mipmapping (GLBatch WebGL2): the gutter
  // must exceed the mip footprint or a small sprite pulls in a neighbour. 16 = clean to ~1/16.
  GUTTER: 16,

  enabled: false,
  pages: [],        // p5.Graphics atlas pages, GPU-resident for the life of the page
  frameCount: 0,    // unique source frames packed (for the debug overlay / harness)
  _shimInstalled: false,
  _origImage: null,

  // An AtlasFrame? (what the global-image wrapper and drawTo() branch on.)
  isFrame(o) { return !!(o && o.__atlas); },

  // A loaded source image we can pack: real dims, not already a frame, fits on a page.
  // A failed load, a boolean flag, or a meta object all fail this.
  _packable(o) {
    const lim = this.MAX_PAGE - 2 * this.GUTTER;   // must fit on a fresh shelf, gutter included
    return !!(o && typeof o === 'object' && !o.__atlas &&
              o.width > 0 && o.height > 0 &&
              o.width <= lim && o.height <= lim);
  },

  // ---- build (call once from setup(), after preload has resolved every image) --
  build() {
    if (this.enabled) return;
    if (typeof createGraphics !== 'function') return;

    // 1. Walk the known sprite containers, recording every slot that holds a packable
    //    image and the set of unique images (dedup by identity, so aliases pack once).
    const slots = [];          // { holder, key }  (works for object props and array indices)
    const uniq = [];
    const seen = new Set();
    const consider = (holder, key) => {
      const v = holder[key];
      if (this._packable(v)) {
        slots.push({ holder, key });
        if (!seen.has(v)) { seen.add(v); uniq.push(v); }
      }
    };
    try { this._collectRoots(consider); }
    catch (e) { console.warn('[atlas] collection failed, staying unpacked:', e && e.message); return; }

    if (!uniq.length) { this._installShim(); return; }   // nothing to pack, but the wrapper is harmless

    // 2. Shelf bin-pack the unique images into pages, tallest-first so shelves stay tight.
    const order = uniq.slice().sort((a, b) => b.height - a.height);
    const G = this.GUTTER, MAX = this.MAX_PAGE;
    const placements = [];     // { img, page, x, y }
    let pageIdx = 0, x = G, y = G, shelfH = 0;
    const newPage = () => { pageIdx++; x = G; y = G; shelfH = 0; };
    for (const img of order) {
      const w = img.width, h = img.height;
      if (x + w + G > MAX) { x = G; y += shelfH + G; shelfH = 0; }   // wrap to next shelf
      if (y + h + G > MAX) { newPage(); }                            // shelf overflows page
      placements.push({ img, page: pageIdx, x, y });
      x += w + G;
      if (h > shelfH) shelfH = h;
    }
    const nPages = pageIdx + 1;

    // 3. Create each page at the size it needs and blit every source into it at 1:1.
    //    pixelDensity(1): the page backing must be logical-sized or sub-rect coords drift.
    const pageDims = new Array(nPages).fill(0).map(() => ({ w: 0, h: 0 }));
    for (const p of placements) {
      const d = pageDims[p.page];
      if (p.x + p.img.width + G > d.w) d.w = Math.min(MAX, p.x + p.img.width + G);
      if (p.y + p.img.height + G > d.h) d.h = Math.min(MAX, p.y + p.img.height + G);
    }
    this.pages = [];
    for (let i = 0; i < nPages; i++) {
      const d = pageDims[i];
      const pg = createGraphics(Math.max(1, d.w), Math.max(1, d.h));
      if (pg.pixelDensity) pg.pixelDensity(1);
      if (pg.clear) pg.clear();
      this.pages.push(pg);
    }
    for (const p of placements) {
      const pg = this.pages[p.page];
      if (pg && pg.image) pg.image(p.img, p.x, p.y);   // graphics-method draw of a REAL image — 1:1, crisp
    }

    // 3b. ALPHA BLEED — only when pages will be mipmapped (GLBatch WebGL2). Extend each
    //     sprite's edge colour into surrounding transparent px (alpha stays 0) so a mip
    //     level doesn't average the edge toward black (a dark fringe on downscaled sprites).
    if (typeof GLBatch !== 'undefined' && GLBatch._gl2) {
      for (const pg of this.pages) {
        const cnv = pg.drawingContext && pg.drawingContext.canvas;
        if (cnv) cnv._glMipSource = this._bleedEdges(pg, this.GUTTER);   // GLBatch uploads this
      }
    }

    // 4. Build image -> frame and write it into every recorded slot. width/height mirror
    //    the source; sx/sy/sw/sh are the sub-rectangle on the page.
    const frameFor = new Map();
    for (const p of placements) {
      frameFor.set(p.img, {
        __atlas: true, __page: this.pages[p.page],
        sx: p.x, sy: p.y, sw: p.img.width, sh: p.img.height,
        width: p.img.width, height: p.img.height
      });
    }
    for (const s of slots) {
      const f = frameFor.get(s.holder[s.key]);
      if (f) s.holder[s.key] = f;
    }

    this.frameCount = uniq.length;
    this.pageCount = nPages;
    this._installShim();
    this.enabled = true;
    console.log(`[atlas] packed ${uniq.length} frames into ${nPages} page(s), ` +
                `${slots.length} references rebound`);
  },

  // Return an ImageData copy of the page with each opaque edge colour extended `radius` px
  // into surrounding transparent px (alpha kept 0), so mipmapping can't average edges toward
  // black. Not written back to the canvas (premultiplied alpha discards colour under alpha 0);
  // GLBatch uploads this ImageData to the texture instead. A bounded outward dilation, 1 px/pass.
  _bleedEdges(page, radius) {
    const ctx = page.drawingContext, w = page.width, h = page.height;
    if (!ctx || !ctx.getImageData || !w || !h) return null;
    let img;
    try { img = ctx.getImageData(0, 0, w, h); } catch (_) { return null; }
    const d = img.data, N = w * h;
    const solid = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (d[i * 4 + 3] > 0) solid[i] = 1;
    const add = [];
    for (let pass = 0; pass < radius; pass++) {
      add.length = 0;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const i = row + x;
          if (solid[i]) continue;
          let ni = -1;
          if (x > 0 && solid[i - 1]) ni = i - 1;
          else if (x < w - 1 && solid[i + 1]) ni = i + 1;
          else if (y > 0 && solid[i - w]) ni = i - w;
          else if (y < h - 1 && solid[i + w]) ni = i + w;
          if (ni >= 0) { const o = ni * 4; add.push(i, d[o], d[o + 1], d[o + 2]); }
        }
      }
      if (!add.length) break;
      for (let k = 0; k < add.length; k += 4) {
        const o = add[k] * 4;
        d[o] = add[k + 1]; d[o + 1] = add[k + 2]; d[o + 2] = add[k + 3];
        solid[add[k]] = 1;
      }
    }
    return img;
  },

  // ---- container enumeration --------------------------------------------------
  // Explicit, not a blind deep-walk: only the known sprite containers are touched.
  // consider(holder, key) records holder[key] if packable.
  _collectRoots(consider) {
    // A holder is an object of slots or an array of frames; consider() each slot,
    // recursing one level into a nested array (e.g. moa.walk[]). 'meta' is skipped.
    const eachIn = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k in obj) {
        if (k === 'meta') continue;
        const v = obj[k];
        if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) consider(v, i); }
        else consider(obj, k);
      }
    };

    // Fauna — EntitySprites: moa, moaVariants[key], eagle, flyers.
    if (typeof EntitySprites !== 'undefined' && EntitySprites) {
      const E = EntitySprites;
      eachIn(E.moa);
      if (E.moaVariants) for (const key in E.moaVariants) eachIn(E.moaVariants[key]);
      eachIn(E.eagle);
      eachIn(E.flyers);
    }

    // Flora — PLANT_SPRITES[type] = { state:img } and PORTRAIT_PLANT_SPRITES[type] = [img, img].
    const collectPlants = (PS) => {
      if (!PS) return;
      for (const key in PS) eachIn(PS[key]);
    };
    collectPlants((typeof PLANT_SPRITES !== 'undefined' && PLANT_SPRITES)
      ? PLANT_SPRITES : (typeof plantSprites !== 'undefined' ? plantSprites : null));
    collectPlants((typeof PORTRAIT_PLANT_SPRITES !== 'undefined' && PORTRAIT_PLANT_SPRITES)
      ? PORTRAIT_PLANT_SPRITES : (typeof portraitPlantSprites !== 'undefined' ? portraitPlantSprites : null));

    // Weather — placeableSprites (clouds, bolt). 'loaded' is a boolean, skipped by _packable.
    if (typeof placeableSprites !== 'undefined' && placeableSprites) {
      for (const k in placeableSprites) consider(placeableSprites, k);
    }
  },

  // ---- draw shim --------------------------------------------------------------
  // Wrap the global image() so an AtlasFrame expands into the sub-rectangle draw; else
  // it passes through. Installed lazily from build() (p5 binds image() once running).
  _installShim() {
    if (this._shimInstalled) return;
    if (typeof image !== 'function') return;
    const orig = image;
    this._origImage = orig;
    const shim = function (img, a, b, c, d) {
      // WebGL entity layer: during an open batch span, a sprite draw is captured as a GPU
      // quad. tryCapture() returns false when GL is off or the image isn't GL-drawable.
      if (typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch._open &&
          GLBatch.tryCapture(img, a, b, c, d)) return;
      if (img && img.__atlas) {
        const dw = (c === undefined) ? img.width : c;
        const dh = (d === undefined) ? img.height : d;
        return orig.call(this, img.__page, a, b, dw, dh, img.sx, img.sy, img.sw, img.sh);
      }
      return orig.apply(this, arguments);
    };
    if (typeof window !== 'undefined') window.image = shim;
    try { image = shim; } catch (_) { /* strict-mode global; window.image is enough */ }
    this._shimInstalled = true;
  },

  // Draw an AtlasFrame (or plain image) into an offscreen graphics buffer g, for the
  // two g.image() sites the global wrap can't see (tint bake, plant gallery).
  drawTo(g, img, dx, dy, dw, dh) {
    if (!g || !g.image) return;
    if (img && img.__atlas) {
      const w = (dw === undefined) ? img.width : dw;
      const h = (dh === undefined) ? img.height : dh;
      g.image(img.__page, dx, dy, w, h, img.sx, img.sy, img.sw, img.sh);
    } else {
      if (dw === undefined) g.image(img, dx, dy);
      else g.image(img, dx, dy, dw, dh);
    }
  }
};

if (typeof module !== 'undefined' && module.exports) module.exports = SpriteAtlas;
