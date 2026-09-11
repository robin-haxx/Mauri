// ============================================
// SPRITE ATLAS — runtime texture consolidation
// ============================================
// Every sprite PNG is loaded individually in preload() (fauna via EntitySprites,
// flora via plantSprites, weather via placeableSprites). At draw time that is
// ~150 distinct GPU textures, so the Canvas2D rasteriser binds/flushes a new
// texture for almost every image() call — up to ~1500 a frame. This module packs
// all of those loaded frames into a handful of large GPU pages ONCE, at setup(),
// so the whole cast draws from one (or a few) shared textures. It is the packed
// multi-animation atlas the strip loader's header (mauri_atlas.js) anticipated.
//
// What it does and does NOT change:
//   • It is NOT a frame-rate fix. On Canvas2D the per-frame cost is dominated by
//     DESTINATION pixels (fill rate × the supersample backing), which an atlas
//     does not touch. What it cuts is texture BINDS, the texture COUNT (GPUs cap
//     it), VRAM fragmentation, and — because the loose source images become
//     unreferenced and free their textures — the transient double-allocation that
//     makes a reload stutter. See the perf review notes.
//
// How it stays invisible to the render code:
//   • build() replaces each loaded p5.Image reference (in place, aliases and all)
//     with a lightweight AtlasFrame {__atlas, __page, sx, sy, sw, sh, width,
//     height}. width/height mirror the ORIGINAL image, so every aspect-ratio and
//     isValid() check in the render code is unchanged.
//   • It then wraps the global image() so image(frame, dx,dy[,dw,dh]) expands to
//     the 9-arg sub-rectangle draw on the frame's page. No render site changes.
//     Real p5.Images (kawakawa buffer, water strips, HUD buffers) fall straight
//     through the wrapper untouched.
//   • The two places that draw a sprite into an OFFSCREEN buffer via the graphics
//     METHOD g.image() — the tint bake and the plant gallery — are not covered by
//     the global wrap, so they call SpriteAtlas.drawTo() with a typeof guard.
//
// Failure is a no-op: an image that failed to load (width 0) or is larger than a
// page is simply left as its original reference and drawn the old way. If build()
// is never reached (headless harness with stubbed graphics) nothing is packed and
// the wrapper is a pure pass-through.

const SpriteAtlas = {
  MAX_PAGE: 4096,   // page dimension cap — Chrome guarantees >= 4096; kiosk-safe
  GUTTER: 2,        // transparent px between frames so bilinear scaling can't bleed a neighbour

  enabled: false,
  pages: [],        // p5.Graphics atlas pages, GPU-resident for the life of the page
  frameCount: 0,    // unique source frames packed (for the debug overlay / harness)
  _shimInstalled: false,
  _origImage: null,

  // An AtlasFrame? (what the global-image wrapper and drawTo() branch on.)
  isFrame(o) { return !!(o && o.__atlas); },

  // A loaded source image we can pack: a real object with real dims, not already a
  // frame, and small enough to sit on a page. A failed load (width 0), a boolean
  // flag (placeableSprites.loaded), or a meta object all fail this and are skipped.
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

    // 1. Walk the known sprite containers, recording every SLOT that holds a
    //    packable image and the SET of unique images (dedup by identity, so an
    //    aliased frame — eagle.dive === eagle.fly[n], plant idle === growing[0] —
    //    is packed once and every slot that names it lands on the same page rect).
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

    // 2. Shelf bin-pack the unique images into pages. Sort tallest-first so shelves
    //    stay tight. Simple and good enough — packing efficiency only affects how
    //    many pages we end up with, not correctness.
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

    // 3. Create each page at just the size it needs (never larger than MAX) and blit
    //    every source into it at native 1:1 (no scaling, so the copy is pixel-exact).
    //    pixelDensity(1) matches the project convention — the page backing must be
    //    logical-sized or the sub-rect coordinates would be off on a hi-dpi buffer.
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

    // 4. Build image -> frame, then write the frame into every recorded slot. The
    //    frame's width/height mirror the source so downstream aspect maths are
    //    unchanged; sx/sy/sw/sh are the sub-rectangle on the page.
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

  // ---- container enumeration --------------------------------------------------
  // Explicit, not a blind deep-walk: we only ever touch the structures we know
  // hold loaded sprites, so nothing unexpected (a p5.Image internal, a cycle) is
  // ever recursed into. `consider(holder, key)` records holder[key] if packable.
  _collectRoots(consider) {
    // A holder is an object of image slots OR an array of frames; consider() every
    // enumerable slot (arrays via index), recursing one level into a nested array
    // (e.g. moa.walk[]). Non-images are filtered by _packable, so a stray flag or
    // meta object is harmless. 'meta' is skipped explicitly to avoid its sub-props.
    const eachIn = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k in obj) {
        if (k === 'meta') continue;
        const v = obj[k];
        if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) consider(v, i); }
        else consider(obj, k);
      }
    };

    // Fauna — EntitySprites (mauri_entity_sprites.js): moa {walk[],idle,juvenile},
    // moaVariants[key] {walk[],idle}, eagle {fly[],dive,glide}, flyers {kea,kaka,
    // kakapo,kokako}. (No huia/kereru containers here — that's the fork's cast.)
    if (typeof EntitySprites !== 'undefined' && EntitySprites) {
      const E = EntitySprites;
      eachIn(E.moa);
      if (E.moaVariants) for (const key in E.moaVariants) eachIn(E.moaVariants[key]);
      eachIn(E.eagle);
      eachIn(E.flyers);
    }

    // Flora — PLANT_SPRITES[type] = { <state>:img } (=== plantSprites after
    // initPlantSprites) and PORTRAIT_PLANT_SPRITES[type] = [img, img] (arrays).
    // eachIn handles both an object-of-states and an array-of-variants.
    const collectPlants = (PS) => {
      if (!PS) return;
      for (const key in PS) eachIn(PS[key]);
    };
    collectPlants((typeof PLANT_SPRITES !== 'undefined' && PLANT_SPRITES)
      ? PLANT_SPRITES : (typeof plantSprites !== 'undefined' ? plantSprites : null));
    collectPlants((typeof PORTRAIT_PLANT_SPRITES !== 'undefined' && PORTRAIT_PLANT_SPRITES)
      ? PORTRAIT_PLANT_SPRITES : (typeof portraitPlantSprites !== 'undefined' ? portraitPlantSprites : null));

    // Weather — placeableSprites (clouds, bolt, ash). 'loaded' is a boolean and is
    // skipped by _packable.
    if (typeof placeableSprites !== 'undefined' && placeableSprites) {
      for (const k in placeableSprites) consider(placeableSprites, k);
    }
  },

  // ---- draw shim --------------------------------------------------------------
  // Wrap the global image() so an AtlasFrame first argument expands into the 9-arg
  // sub-rectangle draw; everything else passes straight through. Installed lazily
  // (from build(), inside setup()) because p5 global mode only binds image() on
  // window once the sketch is running. Idempotent.
  _installShim() {
    if (this._shimInstalled) return;
    if (typeof image !== 'function') return;
    const orig = image;
    this._origImage = orig;
    const shim = function (img, a, b, c, d) {
      // WebGL entity layer (opt-in): during an open batch span, an entity sprite
      // draw is captured as a GPU quad instead of drawn here. tryCapture() returns
      // false when GL is off/closed or the image is not GL-drawable, so the 2D
      // paths below still run for terrain buffers, water strips and the HUD.
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

  // Draw an AtlasFrame (or a plain image) into an offscreen graphics buffer `g`.
  // For the two graphics-method g.image() sites the global wrap cannot see (the
  // tint bake and the plant gallery). Safe to call with either a frame or a raw
  // p5.Image.
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
