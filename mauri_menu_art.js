// ============================================
// MENU ART MANAGER
// Handles illustration layers for level start screens.
// Supports core + wings (widescreen) + bleed (tall) layout.
// Falls back gracefully when no art is configured.
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

  /**
   * Load illustration assets for a level.
   * Call this from Game.loadLevel() after resolving the level def.
   * If no art config exists, the manager renders a plain background.
   */
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

  /**
   * Render the illustration behind menu UI elements.
   * Call this at the start of renderMenu(), before any text/buttons.
   * @param {number} canvasW - Current canvas width
   * @param {number} canvasH - Current canvas height
   */
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
        // No wing image — fade from bg colour into core edge
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

  /**
   * Subtle edge darkening matching the original menu style.
   */
  _renderVignette(w, h) {
    noStroke();
    for (let i = 0; i < 5; i++) {
      fill(0, 0, 0, 3 - i * 0.5);
      rect(i * 20, i * 20, w - i * 40, h - i * 40);
    }
  }

  /**
   * Dark overlays behind key UI zones so text stays readable
   * over detailed illustrations.
   */
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

  /**
   * Graduated fade from illustration edge to background colour.
   * @param {string} direction - 'left', 'right', 'top', or 'bottom'
   */
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

  /**
   * Release loaded images and reset state.
   */
  clear() {
    this.images = {};
    this.loaded = false;
    this.loading = false;
    this.currentLevelId = null;
    this.config = null;
  }
}