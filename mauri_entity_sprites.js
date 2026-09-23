// Top-down game, but sprites are drawn angled to show one side to the camera, so plain
// rotation flips them "upside down" half the time. The eagle faces up (left side shown),
// the moa faces right (right side shown). Mirror the eagle horizontally, and the moa
// vertically, when rotated between 45° and 225° clockwise (see shouldMirror).

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
  
  // True if angle falls within the 45°–225° range (clockwise).
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
  // faceSign encodes the art's native horizontal facing for the billboard renderer:
  // +1 = drawn facing right (all current moa art), so scaleX = _flip * faceSign makes
  // +_flip read as "right". A future left-facing set would set faceSign: -1.
  moa: {
    walk: [],
    idle: null,
    juvenile: null,
    faceSign: 1
  },
  // Dedicated per-species sprite sets (via a species' spriteSet config).
  // 'mating' is an optional pose shown while courting; falls back to idle when absent.
  moaVariants: {
    bush: { walk: [], idle: null, faceSign: 1 },
    upland: { walk: [], idle: null, mating: null, faceSign: 1 }
  },
  eagle: {
    fly: [],
    dive: null,
    glide: null
  },
  // Flighted-bird art: one static sprite each (perched vs flying not distinguished).
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
    
    // Bush moa (Anomalopteryx); its own art, 5-frame walk + idle
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

    // Upland moa (Megalapteryx); dedicated 4-frame walk art in sprites/Moa/.
    // No separate idle/mating files: frame 2 doubles as idle, frame 3 as the mating pose.
    for (let i = 1; i <= 4; i++) {
      const n = String(i).padStart(2, '0');
      this.moaVariants.upland.walk.push(loadImage(
        `${spritePath}Moa/upland_walk_${n}.png`,
        () => console.log(`Loaded upland_walk_${n}.png`),
        () => console.warn(`Could not load upland_walk_${n}.png`)
      ));
    }
    this.moaVariants.upland.idle   = this.moaVariants.upland.walk[1]; // frame 2
    this.moaVariants.upland.mating = this.moaVariants.upland.walk[2]; // frame 3

    // Eagle fly cycle
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

    // Flighted-bird sprites; one static image each.
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

  getMoaSprite(animTime, isMoving, isJuvenile = false, variant = null, isMating = false) {
    const set = (variant && this.moaVariants[variant]) || this.moa;

    // A courting moa shows its dedicated mating pose (when the set has one) rather than
    // the walk cycle; it is normally stationary, so this takes priority over isMoving.
    if (isMating && this.isValid(set.mating)) return set.mating;

    if (isMoving && set.walk.length > 0) {
      const frameIndex = Math.floor(animTime * this.animation.moaWalkSpeed) % set.walk.length;
      if (this.isValid(set.walk[frameIndex])) return set.walk[frameIndex];
    }

    if (this.isValid(set.idle)) return set.idle;

    // Variant art missing/not loaded yet → fall back to the generic moa set.
    if (set !== this.moa) return this.getMoaSprite(animTime, isMoving, isJuvenile, null, isMating);

    return null;
  },

  // Native horizontal facing (+1 right, -1 left) of a variant's art, for the billboard
  // renderer's lateral flip. Resolves the same way getMoaSprite does.
  getMoaFaceSign(variant = null) {
    const set = (variant && this.moaVariants[variant]) || this.moa;
    return set.faceSign || 1;
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

  // Flighted-bird sprite getters; null while still loading (draw falls back to the glyph).
  getKeaSprite()    { return this.isValid(this.flyers.kea)    ? this.flyers.kea    : null; },
  getKakaSprite()   { return this.isValid(this.flyers.kaka)   ? this.flyers.kaka   : null; },
  getKakapoSprite() { return this.isValid(this.flyers.kakapo) ? this.flyers.kakapo : null; },
  getKokakoSprite() { return this.isValid(this.flyers.kokako) ? this.flyers.kokako : null; },

  // Pre-tinted moa frame cache: bake one tinted copy per (base frame, tint) lazily and
  // blit it plain, since p5's tint() is slow. Keyed by (base p5.Image) → "r,g,b".
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
      // baseSprite may be an atlas frame; use the atlas helper so it expands to the
      // sub-rect draw. Falls through to g.image() when the atlas is absent.
      if (typeof SpriteAtlas !== 'undefined') SpriteAtlas.drawTo(baked, baseSprite, 0, 0);
      else baked.image(baseSprite, 0, 0);   // bake the tint once, at native resolution
      perTint.set(key, baked);
    }
    return baked;
  },

  // ---- Sprite-shaped selection outline ---------------------------------------
  // A coloured halo the shape of a sprite's silhouette, baked once per
  // (base p5.Image → "r,g,b:thickness") and blitted under the sprite.
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

  // Draw a sprite-shaped outline under a sprite, in the current transform. Call with
  // imageMode(CENTER) and the sprite's draw size; the outline scales with it and pulses
  // unless an explicit alpha (0..1) is given. GL mode stamps a ring of pure-colour
  // silhouette quads (no bake); 2D mode blits the once-baked cached halo. thickness is
  // in source-sprite px, so the outline keeps a constant proportion at any zoom.
  drawSpriteOutline(baseSprite, drawW, drawH, col, thickness = 6, alpha = null) {
    const a = (alpha != null) ? alpha : 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(frameCount * 0.12));

    if (typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch._open) {
      // Ring radius matches the baked halo's dilation (source px scaled to draw size).
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
    if (dc) dc.globalAlpha = a;                 // cheap per-draw fade; never tint()
    image(halo, 0, 0, halo.width * kx, halo.height * ky);
    if (dc) dc.globalAlpha = prev;
  },

  // Sprite-shaped ground shadow, reusing the bake-free silhouette path. GL stamps the
  // sprite's alpha shape once as a dark flattened pool; 2D falls back to an ellipse.
  // Positional args (not an options object) so the per-entity, per-frame hot path allocates
  // nothing — see the fast path below.
  //   (cx,cy)   shadow centre in the CURRENT transform
  //   drawW,drawH  the sprite's on-screen draw size
  //   alpha     darkness 0..1                       (default 0.12)
  //   squash    vertical flatten of the silhouette  (default 0.42)
  //   wide      horizontal scale of the silhouette  (default 0.9)
  //   mirror    <0 flips it (match a mirrored sprite)
  //   fbW/fbH   ellipse size for the 2D fallback    (default the sprite box × squash)
  drawSpriteShadow(sprite, cx, cy, drawW, drawH, alpha, squash, wide, mirror, fbW, fbH) {
    const _alpha = (alpha != null) ? alpha : 0.12;
    const _squash = (squash != null) ? squash : 0.42;
    const _wide = (wide != null) ? wide : 0.9;
    if (sprite && typeof GLBatch !== 'undefined' && GLBatch.enabled && GLBatch._open) {
      const _mir = (mirror != null && mirror < 0);
      const R = (typeof _renderer !== 'undefined') ? _renderer : null;
      if (R) {
        // Hot path (once per plant + animal every frame): p5's push()/pop() allocates two
        // objects per call and tint() allocates a p5.Color + array — this loop was a top GC
        // churn source. We touch only _tint + _imageMode, so snapshot just those and write a
        // reused scratch tint directly. GLBatch reads both synchronously in image(), so the
        // scratch array is fully consumed before the next call reuses it.
        const prevTint = R._tint, prevImageMode = R._imageMode;
        if (_mir) { translate(cx, cy); scale(-1, 1); translate(-cx, -cy); }
        const st = this._shadowTint || (this._shadowTint = [0, 0, 0, 0]);
        st[3] = 255 * _alpha;
        R._tint = st;
        R._imageMode = (typeof CENTER !== 'undefined') ? CENTER : 'center';
        GLBatch._silhouette = true;
        image(sprite, cx, cy, drawW * _wide, drawH * _squash);
        GLBatch._silhouette = false;
        R._tint = prevTint;
        R._imageMode = prevImageMode;
        // A reflection is its own inverse; undo the mirror so the caller's frame is unchanged.
        if (_mir) { translate(cx, cy); scale(-1, 1); translate(-cx, -cy); }
      } else {
        // Fallback (no reachable renderer): the original push/pop path.
        push();
        imageMode(CENTER);
        if (_mir) { translate(cx, cy); scale(-1, 1); translate(-cx, -cy); }
        tint(0, 0, 0, 255 * _alpha);
        GLBatch._silhouette = true;
        image(sprite, cx, cy, drawW * _wide, drawH * _squash);
        GLBatch._silhouette = false;
        noTint();
        pop();
      }
      return;
    }
    // 2D fallback: the original soft ellipse blob.
    noStroke();
    fill(0, 0, 0, 255 * _alpha);
    ellipse(cx, cy, (fbW != null ? fbW : drawW), (fbH != null ? fbH : drawH * _squash));
  }
};

function loadEntitySprites() {
  EntitySprites.load();
}