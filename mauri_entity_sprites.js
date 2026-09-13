// my game is top down but the sprites are designed to look angled to show one side more to the camera.
// this needs some altering as just rotation means they look "upside down" half the time.
// the eagle sprite is oriented upward (and designed to show more of its left side) and the moa oriented to the right with its right side shown more.
// when the eagle sprite is being rotated between 45 and 225 degrees clockwise I would like to mirror the sprite horizontally
// for the moa sprite angles between 45 and 225 degrees clockwise I would like to mirror the sprite vertically.
// I think this will fix how they look so as to be angled for more typical game rendering.


// ============================================
// ANGLE SNAPPING FOR PIXEL ART SPRITES
// ============================================

const SpriteAngle = {
  DIVISIONS: 12,
  INCREMENT: (Math.PI * 2) / 12,
  
  snap(angle) {
    return Math.round(angle / this.INCREMENT) * this.INCREMENT;
  },
  
  snapWithHysteresis(currentDisplayAngle, targetAngle, threshold = 0.4) {
    const snappedTarget = this.snap(targetAngle);
    
    if (currentDisplayAngle === undefined) return snappedTarget;
    
    let diff = snappedTarget - currentDisplayAngle;
    const PI = Math.PI;
    if (diff > PI) diff -= PI * 2;
    if (diff < -PI) diff += PI * 2;
    
    if (Math.abs(diff) > this.INCREMENT * threshold) {
      return snappedTarget;
    }
    
    return currentDisplayAngle;
  },
  
  // NEW: Check if angle falls within the 45°-225° range (clockwise)
  shouldMirror(angle) {
    const TWO_PI = Math.PI * 2;
    // Normalize to 0-2π range
    const normalized = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
    // 45° = π/4 ≈ 0.785,  225° = 5π/4 ≈ 3.927
    const START = Math.PI / 4;
    const END = 5 * Math.PI / 4;
    return normalized >= START && normalized <= END;
  }
};

// ============================================
// ENTITY SPRITE MANAGER
// ============================================

const EntitySprites = {
  moa: {
    walk: [],
    idle: null,
    juvenile: null
  },
  // Dedicated per-species sprite sets. A species whose registry config sets
  // e.g. `spriteSet: 'bush'` renders from here instead of the generic moa art.
  moaVariants: {
    bush: { walk: [], idle: null }
  },
  eagle: {
    fly: [],
    dive: null,
    glide: null
  },
  // Flighted-bird art — one static 360×360 sprite each (the perched vs flying
  // pose isn't distinguished). The kererū base still draws its glyph; these are
  // the four subclasses with dedicated sprites.
  flyers: {
    kea: null,
    kaka: null,
    kakapo: null,
    kokako: null
  },
  loaded: false,
  loadAttempted: false,
  
  animation: {
    moaWalkSpeed: 0.12,
    eagleFlySpeed: 0.15,
    eagleDiveSpeed: 0.08
  },

  load() {
    if (this.loadAttempted) return;
    this.loadAttempted = true;
    
    const spritePath = 'sprites/';
    
    // Moa walk cycle (4 frames)
    for (let i = 1; i <= 4; i++) {
      this.moa.walk.push(loadImage(
        `${spritePath}moa_walk_${i}.png`,
        () => console.log(`Loaded moa_walk_${i}.png`),
        () => console.warn(`Could not load moa_walk_${i}.png`)
      ));
    }
    
    this.moa.idle = loadImage(
      `${spritePath}moa_idle.png`,
      () => console.log('Loaded moa_idle.png'),
      () => console.warn('Could not load moa_idle.png')
    );
    
    this.moa.juvenile = loadImage(
      `${spritePath}moa_juvenile.png`,
      () => console.log('Loaded moa_juvenile.png'),
      () => {}
    );
    
    // Bush moa (Anomalopteryx) — its own art, 5-frame walk + idle
    for (let i = 1; i <= 5; i++) {
      const n = String(i).padStart(2, '0');
      this.moaVariants.bush.walk.push(loadImage(
        `${spritePath}LB_moa_walk_${n}.png`,
        () => console.log(`Loaded LB_moa_walk_${n}.png`),
        () => console.warn(`Could not load LB_moa_walk_${n}.png`)
      ));
    }
    this.moaVariants.bush.idle = loadImage(
      `${spritePath}LB_moa_idle.png`,
      () => console.log('Loaded LB_moa_idle.png'),
      () => console.warn('Could not load LB_moa_idle.png')
    );

    // Eagle fly cycle (3 frames)
    for (let i = 1; i <= 7; i++) {
      this.eagle.fly.push(loadImage(
        `${spritePath}eagle_fly_${i}.png`,
        () => console.log(`Loaded eagle_fly_${i}.png`),
        () => console.warn(`Could not load eagle_fly_${i}.png`)
      ));
    }
    
    this.eagle.dive = loadImage(
      `${spritePath}eagle_dive.png`,
      () => console.log('Loaded eagle_dive.png'),
      () => console.warn('Could not load eagle_dive.png')
    );
    
    this.eagle.glide = loadImage(
      `${spritePath}eagle_glide.png`,
      () => console.log('Loaded eagle_glide.png'),
      () => console.warn('Could not load eagle_glide.png')
    );

    // Flighted-bird sprites — one static image each.
    const flyerFiles = { kea: 'kea.png', kaka: 'kaka.png', kakapo: 'kakapo.png', kokako: 'kokako.png' };
    for (const name in flyerFiles) {
      const file = flyerFiles[name];
      this.flyers[name] = loadImage(
        `${spritePath}${file}`,
        () => console.log(`Loaded ${file}`),
        () => console.warn(`Could not load ${file}`)
      );
    }

    this.loaded = true;
  },

  isValid(sprite) {
    return sprite && sprite.width > 0 && sprite.height > 0;
  },

  getMoaSprite(animTime, isMoving, isJuvenile = false, variant = null) {
    const set = (variant && this.moaVariants[variant]) || this.moa;

    if (isMoving && set.walk.length > 0) {
      const frameIndex = Math.floor(animTime * this.animation.moaWalkSpeed) % set.walk.length;
      if (this.isValid(set.walk[frameIndex])) return set.walk[frameIndex];
    }

    if (this.isValid(set.idle)) return set.idle;

    // Variant art missing/not loaded yet → fall back to the generic moa set.
    if (set !== this.moa) return this.getMoaSprite(animTime, isMoving, isJuvenile);

    return null;
  },

  getEagleSprite(animTime, state) {
    if ((state === 'hunting' || state === 'diving') && this.isValid(this.eagle.dive)) {
      return this.eagle.dive;
    }
    
    if (state === 'resting' && this.isValid(this.eagle.glide)) {
      return this.eagle.glide;
    }
    
    if (this.eagle.fly.length > 0) {
      const speed = state === 'hunting' ? this.animation.eagleDiveSpeed : this.animation.eagleFlySpeed;
      const frameIndex = Math.floor(animTime * speed) % this.eagle.fly.length;
      const sprite = this.eagle.fly[frameIndex];
      if (this.isValid(sprite)) return sprite;
    }

    return null;
  },

  // Flighted-bird sprite getters — one static image each, so the perched flag is
  // ignored. null while the image is still loading (draw falls back to the glyph).
  getKeaSprite()    { return this.isValid(this.flyers.kea)    ? this.flyers.kea    : null; },
  getKakaSprite()   { return this.isValid(this.flyers.kaka)   ? this.flyers.kaka   : null; },
  getKakapoSprite() { return this.isValid(this.flyers.kakapo) ? this.flyers.kakapo : null; },
  getKokakoSprite() { return this.isValid(this.flyers.kokako) ? this.flyers.kokako : null; },

  // Pre-tinted moa frame cache. p5's tint() runs a slow per-draw path and
  // defeats the fast image blit, so instead of tinting live every frame we bake
  // ONE tinted copy of each base frame per species tint — lazily, on first use —
  // and draw that with a plain image(). Keyed by (base p5.Image) → ("r,g,b").
  // A few unique genus tints × ~5 frames = a handful of tiny buffers.
  _tintCache: null,

  getTintedMoaFrame(baseSprite, tint) {
    // No tint, or art not loaded yet → draw the base frame untinted for now.
    if (!tint || !this.isValid(baseSprite)) return baseSprite;

    let cache = this._tintCache || (this._tintCache = new Map());
    let perTint = cache.get(baseSprite);
    if (!perTint) { perTint = new Map(); cache.set(baseSprite, perTint); }

    const key = tint[0] + ',' + tint[1] + ',' + tint[2];
    let baked = perTint.get(key);
    if (baked === undefined) {
      baked = createGraphics(baseSprite.width, baseSprite.height);
      baked.tint(tint[0], tint[1], tint[2]);
      // baseSprite may be an atlas frame (a sub-rect of a shared page), which the
      // global image() shim can't see on a graphics-method call — go through the
      // atlas helper so it expands to the 9-arg sub-rect draw. Falls through to a
      // plain g.image() when the atlas is absent or the arg is a real p5.Image.
      if (typeof SpriteAtlas !== 'undefined') SpriteAtlas.drawTo(baked, baseSprite, 0, 0);
      else baked.image(baseSprite, 0, 0);   // bake the tint once, at native resolution
      perTint.set(key, baked);
    }
    return baked;
  },

  // ---- Sprite-shaped selection outline ---------------------------------------
  // A coloured halo the exact shape of a sprite's silhouette, baked ONCE per
  // (base p5.Image → "r,g,b:thickness") and drawn under the real sprite. The
  // shape never changes, so the halo is computed on first use and is thereafter
  // a single plain image() blit — no per-frame silhouette work. Same bake-and-
  // cache idea as getTintedMoaFrame; used for the field-guide species highlight.
  _outlineCache: null,

  getOutline(baseSprite, col, thickness = 6, steps = 16) {
    if (!this.isValid(baseSprite)) return null;

    let cache = this._outlineCache || (this._outlineCache = new Map());
    let perSprite = cache.get(baseSprite);
    if (!perSprite) { perSprite = new Map(); cache.set(baseSprite, perSprite); }

    const key = col[0] + ',' + col[1] + ',' + col[2] + ':' + thickness;
    let baked = perSprite.get(key);
    if (baked === undefined) {
      const pad = Math.ceil(thickness) + 1;

      // 1) recolour the sprite into a solid silhouette (keeps its alpha shape).
      const sil = createGraphics(baseSprite.width, baseSprite.height);
      sil.clear();
      // Atlas-frame safe (graphics-method draw the global image() shim can't see).
      if (typeof SpriteAtlas !== 'undefined') SpriteAtlas.drawTo(sil, baseSprite, 0, 0);
      else sil.image(baseSprite, 0, 0);
      const sc = sil.drawingContext;
      sc.globalCompositeOperation = 'source-in';
      sc.fillStyle = 'rgb(' + col[0] + ',' + col[1] + ',' + col[2] + ')';
      sc.fillRect(0, 0, sil.width, sil.height);

      // 2) dilate it into a halo by stamping the silhouette around a ring.
      baked = createGraphics(baseSprite.width + pad * 2, baseSprite.height + pad * 2);
      baked.clear();
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * TWO_PI;
        baked.image(sil, pad + Math.cos(a) * thickness, pad + Math.sin(a) * thickness);
      }
      baked._pad = pad;
      sil.remove();
      perSprite.set(key, baked);
    }
    return baked;
  },

  // Draw a sprite-shaped outline centred under a sprite, in the CURRENT transform.
  // Call with imageMode(CENTER) set and pass the same drawW/drawH you draw the
  // sprite at; the outline (and so its thickness) scales with the sprite. Pulses
  // gently unless an explicit alpha (0..1) is given.
  //
  // GL mode (GL_PORT.md Phase 3): emit a ring of pure-colour SILHOUETTE quads — the
  // batch shader outputs `col` wherever the sprite is opaque, so stacked in a ring
  // they form the outline. No bake, no cache, ANY colour, essentially free.
  // 2D mode: fall back to the once-baked, cached halo blit.
  // thickness is in SOURCE-sprite px (scaled to the draw size), so the outline keeps
  // a constant *proportion* of the sprite at any zoom — chunky on a big moa, still a
  // clear rim on a small one. Shared by the field-guide selection and the species
  // highlight so they read identically (only the colour differs).
  drawSpriteOutline(baseSprite, drawW, drawH, col, thickness = 6, alpha = null) {
    const a = (alpha != null) ? alpha : 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(frameCount * 0.12));

    if (typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch._open) {
      // Ring radius in LOCAL units matches the baked halo's dilation (thickness in
      // source px, scaled to the draw size).
      const off = thickness * (drawW / (baseSprite.width || drawW));
      const steps = 16;
      push();
      imageMode(CENTER);
      tint(col[0], col[1], col[2], 255 * a);   // per-quad colour; free on GL, not a bake
      GLBatch._silhouette = true;
      for (let i = 0; i < steps; i++) {
        const ang = (i / steps) * TWO_PI;
        image(baseSprite, Math.cos(ang) * off, Math.sin(ang) * off, drawW, drawH);
      }
      GLBatch._silhouette = false;
      noTint();
      pop();
      return;
    }

    // 2D fallback: the once-baked, cached halo.
    const halo = this.getOutline(baseSprite, col, thickness);
    if (!halo) return;
    const kx = drawW / baseSprite.width;
    const ky = drawH / baseSprite.height;
    const dc = (typeof drawingContext !== 'undefined') ? drawingContext : null;
    const prev = dc ? dc.globalAlpha : 1;
    if (dc) dc.globalAlpha = a;                 // cheap per-draw fade — never tint()
    image(halo, 0, 0, halo.width * kx, halo.height * ky);
    if (dc) dc.globalAlpha = prev;
  },

  // Sprite-SHAPED ground shadow, reusing the bake-free silhouette path (the same one
  // the highlight outline uses). On GL the sprite's own alpha shape is stamped ONCE as a
  // dark, flattened, translucent pool — one quad, no bake, the same cost as the old
  // ellipse but shaped like the creature/plant instead of a blob. On the 2D path (no
  // cheap silhouette) it falls back to the original ellipse.
  //   (cx,cy)      shadow centre in the CURRENT transform (usually the entity's base)
  //   drawW,drawH  the sprite's on-screen draw size (the silhouette is sized from this)
  //   opts.alpha   darkness 0..1                       (default 0.12)
  //   opts.squash  vertical flatten of the silhouette  (default 0.42 — lies on the ground)
  //   opts.wide    horizontal scale of the silhouette  (default 0.9)
  //   opts.mirror  <0 flips it (match a mirrored sprite)
  //   opts.fbW/fbH ellipse size for the 2D fallback    (default the sprite box × squash)
  drawSpriteShadow(sprite, cx, cy, drawW, drawH, opts) {
    const o = opts || {};
    const alpha = (o.alpha != null) ? o.alpha : 0.12;
    const squash = (o.squash != null) ? o.squash : 0.42;
    if (sprite && typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch._open) {
      push();
      imageMode(CENTER);
      if (o.mirror < 0) { translate(cx, cy); scale(-1, 1); translate(-cx, -cy); }
      tint(0, 0, 0, 255 * alpha);
      GLBatch._silhouette = true;
      image(sprite, cx, cy, drawW * (o.wide != null ? o.wide : 0.9), drawH * squash);
      GLBatch._silhouette = false;
      noTint();
      pop();
      return;
    }
    // 2D fallback: the original soft ellipse blob.
    noStroke();
    fill(0, 0, 0, 255 * alpha);
    ellipse(cx, cy, (o.fbW != null ? o.fbW : drawW), (o.fbH != null ? o.fbH : drawH * squash));
  }
};

function loadEntitySprites() {
  EntitySprites.load();
}