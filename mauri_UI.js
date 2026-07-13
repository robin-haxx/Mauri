// ============================================
// GAME UI CLASS - Responsive layout support
// ============================================
class GameUI {
  constructor(config, terrain, simulation, mauri, game, seasonManager) {
    this.config = config;
    this.terrain = terrain;
    this.simulation = simulation;
    this.mauri = mauri;
    this.game = game;
    this.seasonManager = seasonManager;

    // Message feed for sidebar
    this.messageFeed = [];
    this.maxMessages = 15;

    // Hover state
    this.hoveredTool = null;

    // Default colors in case CACHED_COLORS aren't set
    this._defaultPanelBg = [25, 35, 30, 240];
    this._defaultPanelBorder = [60, 90, 70];
    this._defaultPanelHeader = [45, 75, 55];

    // Build all layout positions from current CONFIG
    this.recalculate();
  }

  /**
   * Recalculate all panel bounds and layout positions from current CONFIG.
   * Call this after CONFIG.recalculateLayout() runs, or whenever the
   * canvas/game area dimensions change.
   */
  recalculate() {
    const config = this.config;

    // Panel bounds
    this.topBar = {
      x: 0,
      y: 0,
      width: config.canvasWidth,
      height: config.topBarHeight
    };

    this.bottomBar = {
      x: 0,
      y: config.gameAreaY + config.gameAreaHeight,
      width: config.gameAreaWidth,
      height: config.bottomBarHeight
    };

    this.sidebar = {
      x: config.rightSidebarX,
      y: 0,
      width: config.rightSidebarWidth,
      height: config.canvasHeight
    };

    // Toolbar Y position within bottom bar
    this.toolbarY = this.bottomBar.y + 20;

    // Recalculate all element positions
    this._calculateLayoutPositions();
  }

  _calculateLayoutPositions() {
    const gameAreaWidth = this.config.gameAreaWidth;
    const gameAreaCenter = gameAreaWidth / 2;

    // Top bar element sizes
    const mauriWidth = 180;
    const seasonWidth = 280;
    const timerWidth = 120;
    const elementSpacing = 30;

    // Total width of top bar elements
    const topBarElementsWidth = mauriWidth + seasonWidth + timerWidth + (elementSpacing * 2);

    // If game area is too narrow, compress spacing
    let adjustedSpacing = elementSpacing;
    if (topBarElementsWidth > gameAreaWidth - 120) {
      // Leave room for pause button; compress element spacing
      const available = gameAreaWidth - 120 - mauriWidth - seasonWidth - timerWidth;
      adjustedSpacing = Math.max(10, available / 2);
    }

    const adjustedTotalWidth = mauriWidth + seasonWidth + timerWidth + (adjustedSpacing * 2);
    const topBarStartX = (gameAreaWidth - adjustedTotalWidth) / 2;

    // Store calculated positions for top bar
    this.layout = {
      // Top bar elements (centered in game area)
      mauriX: topBarStartX,
      seasonX: topBarStartX + mauriWidth + adjustedSpacing,
      timerX: topBarStartX + mauriWidth + seasonWidth + (adjustedSpacing * 2),

      // Pause button (right edge of game area, before sidebar)
      pauseBtnX: gameAreaWidth - 90,
      pauseBtnY: 20,
      pauseBtnSize: 70,

      // Migration hint (centered, proportional to game area)
      migrationHintWidth: Math.min(1000, gameAreaWidth - 100),
      migrationHintX: (gameAreaWidth - Math.min(1000, gameAreaWidth - 100)) / 2,

      // Bottom bar toolbar
      toolbarBtnSize: 70,
      toolbarSpacing: 85,
      toolbarBtnCount: Object.keys(PLACEABLES).length,

      // Sidebar content padding and panel width
      sidebarPadding: 15,
      sidebarPanelWidth: this.sidebar.width - 30
    };

    // If sidebar is narrower, shrink toolbar buttons slightly to fit
    // (toolbar is in the game area, not sidebar, but this keeps proportions)
    if (gameAreaWidth < 1200) {
      this.layout.toolbarBtnSize = 60;
      this.layout.toolbarSpacing = 72;
    }

    // Calculate toolbar start position (centered in game area)
    const toolbarTotalWidth =
      (this.layout.toolbarBtnCount - 1) * this.layout.toolbarSpacing +
      this.layout.toolbarBtnSize;
    this.layout.toolbarStartX = (gameAreaWidth - toolbarTotalWidth) / 2;

    // Selected tool info panel (positioned to the right of toolbar)
    this.layout.selectedToolX = this.layout.toolbarStartX + toolbarTotalWidth + 40;

    // Event log and species panel heights scale with sidebar width
    // Wider sidebar = can show more; narrower = show less
    const sidebarScale = this.sidebar.width / 560; // 560 is the 16:9 baseline
    this.layout.eventLogHeight = Math.round(280 * sidebarScale);
    this.layout.speciesPanelHeight = Math.round(240 * sidebarScale);
    this.layout.eventLogMaxMessages = sidebarScale >= 1 ? 7 : 5;

    this.layout.toolbarTotalWidth = toolbarTotalWidth;

    // Fullscreen (max-view) button sits just left of the pause button
    this.layout.fsBtnX = this.layout.pauseBtnX - 80;

    // Fullscreen overlay HUD layout: compact strip of mauri/season/time +
    // fullscreen/pause buttons along the top, goals at top-right, placeables
    // toolbar along the bottom — all drawn over the maximised play area.
    const cw = this.config.canvasWidth;
    const chFull = this.config.canvasHeight;
    const fsGap = 12;
    const fsBtn = this.layout.pauseBtnSize;
    const stripW = 180 + 280 + 120 + fsBtn * 2 + fsGap * 4;
    const stripX = (cw - stripW) / 2;
    this.layout.fs = {
      stripY: 10,
      btnY: 10,
      btnSize: fsBtn,
      mauriX: stripX,
      seasonX: stripX + 180 + fsGap,
      timerX: stripX + 180 + 280 + fsGap * 2,
      fsBtnX: stripX + 180 + 280 + 120 + fsGap * 3,
      pauseBtnX: stripX + 180 + 280 + 120 + fsBtn + fsGap * 4,
      goalsX: cw - this.layout.sidebarPanelWidth - 30,
      goalsY: 102,
      toolbarStartX: (cw - toolbarTotalWidth) / 2,
      toolbarY: chFull - this.layout.toolbarBtnSize - 35
    };
  }

  // Safe color getters
  _getPanelBg() {
    return CACHED_COLORS.panelBg || this._defaultPanelBg;
  }

  _getPanelBorder() {
    return CACHED_COLORS.panelBorder || this._defaultPanelBorder;
  }

  _getPanelHeader() {
    return CACHED_COLORS.panelHeader || this._defaultPanelHeader;
  }

  addMessage(text, type = 'info') {
    this.messageFeed.unshift({
      text: text,
      type: type,
      time: this.game.playTime,
      alpha: 255
    });

    if (this.messageFeed.length > this.maxMessages) {
      this.messageFeed.pop();
    }
  }

  // ==========================================
  // INPUT HANDLING
  // ==========================================

  handleClick(mx, my) {
    // Fullscreen overlay HUD gets its own hit-testing
    if (this.config.fullscreen) {
      return this.handleFullscreenClick(mx, my);
    }

    // Check pause / fullscreen button clicks first (top bar area)
    if (my >= this.topBar.y && my < this.topBar.y + this.topBar.height) {
      if (this.handlePauseButtonClick(mx, my)) return true;
      if (this.handleFullscreenButtonClick(mx, my)) return true;
    }

    // Check bottom toolbar clicks
    if (my >= this.bottomBar.y && my < this.bottomBar.y + this.bottomBar.height) {
      return this.handleToolbarClick(mx, my);
    }

    // Check sidebar clicks
    if (mx >= this.sidebar.x) {
      return this.handleSidebarClick(mx, my);
    }

    return false;
  }

  _inRect(mx, my, x, y, w, h) {
    return mx > x && mx < x + w && my > y && my < y + h;
  }

  handleFullscreenClick(mx, my) {
    const fs = this.layout.fs;
    const bs = fs.btnSize;

    if (this._inRect(mx, my, fs.fsBtnX, fs.btnY, bs, bs)) {
      this.game.toggleFullscreen();
      return true;
    }
    if (this._inRect(mx, my, fs.pauseBtnX, fs.btnY, bs, bs)) {
      this._togglePause();
      return true;
    }

    // Focus-species highlight toggles (top-right)
    if (this._fsFocusBtnBounds) {
      for (const b of this._fsFocusBtnBounds) {
        if (this._inRect(mx, my, b.x, b.y, b.size, b.size)) {
          this._toggleSpeciesHighlight(b.key);
          return true;
        }
      }
    }

    // Toolbar row
    if (this._inRect(mx, my, fs.toolbarStartX, fs.toolbarY,
                     this.layout.toolbarTotalWidth, this.layout.toolbarBtnSize)) {
      this.handleToolbarClick(mx, my, fs.toolbarStartX, fs.toolbarY);
      return true;
    }

    // Consume clicks landing on the HUD strip / goals panel so they don't
    // fall through and place items on the map underneath.
    if (this._inRect(mx, my, fs.mauriX, fs.stripY,
                     (fs.pauseBtnX + bs) - fs.mauriX, 70)) return true;
    const goalsH = 30 + this.game.goals.length * 26;
    if (this._inRect(mx, my, fs.goalsX, fs.goalsY,
                     this.layout.sidebarPanelWidth, goalsH)) return true;

    return false;
  }

  handleToolbarClick(mx, my, startX = this.layout.toolbarStartX, toolbarY = this.toolbarY) {
    const btnX = startX;
    const btnY = toolbarY;
    const btnSize = this.layout.toolbarBtnSize;
    const spacing = this.layout.toolbarSpacing;

    const palette = this.game.activePlaceables || PLACEABLES;
    let i = 0;
    for (let type in palette) {
      let x = btnX + i * spacing;
      if (mx > x && mx < x + btnSize && my > btnY && my < btnY + btnSize) {
        this.game.selectPlaceable(type);
        return true;
      }
      i++;
    }

    return false;
  }

  handleSidebarClick(mx, my) {
    // Population rows toggle their species' in-world highlight
    if (this._speciesRowBounds) {
      for (const b of this._speciesRowBounds) {
        if (this._inRect(mx, my, b.x, b.y, b.w, b.h)) {
          this._toggleSpeciesHighlight(b.key);
          return true;
        }
      }
    }
    return false;
  }

  _togglePause() {
    if (this.game.state === GAME_STATE.PLAYING) {
      this.game.state = GAME_STATE.PAUSED;
    } else if (this.game.state === GAME_STATE.PAUSED) {
      this.game.state = GAME_STATE.PLAYING;
    }
  }

  handlePauseButtonClick(mx, my) {
    const x = this.layout.pauseBtnX;
    const y = this.layout.pauseBtnY;
    const size = this.layout.pauseBtnSize;

    if (mx > x && mx < x + size && my > y && my < y + size) {
      this._togglePause();
      return true;
    }
    return false;
  }

  handleFullscreenButtonClick(mx, my) {
    const x = this.layout.fsBtnX;
    const y = this.layout.pauseBtnY;
    const size = this.layout.pauseBtnSize;

    if (mx > x && mx < x + size && my > y && my < y + size) {
      this.game.toggleFullscreen();
      return true;
    }
    return false;
  }

  // ==========================================
  // PANEL RENDERING
  // ==========================================

  renderPanels() {
    // Top bar background
    this.renderPanelBackground(
      this.topBar.x, this.topBar.y,
      this.topBar.width, this.topBar.height,
      'top'
    );

    // Bottom bar background
    this.renderPanelBackground(
      this.bottomBar.x, this.bottomBar.y,
      this.bottomBar.width, this.bottomBar.height,
      'bottom'
    );

    // Right sidebar background
    this.renderPanelBackground(
      this.sidebar.x, this.sidebar.y,
      this.sidebar.width, this.sidebar.height,
      'sidebar'
    );

    // Game area border
    noFill();
    stroke(60, 90, 70);
    strokeWeight(2);
    rect(
      CONFIG.gameAreaX - 1,
      CONFIG.gameAreaY - 1,
      CONFIG.gameAreaWidth + 2,
      CONFIG.gameAreaHeight + 2
    );
  }

  renderPanelBackground(x, y, w, h, type) {
    // Main panel background
    noStroke();
    const bg = this._getPanelBg();
    fill(bg[0], bg[1], bg[2], bg[3] || 255);
    rect(x, y, w, h);

    // Subtle top highlight
    fill(255, 255, 255, 3);
    rect(x, y, w, 2);

    // Border
    const border = this._getPanelBorder();
    stroke(border[0], border[1], border[2]);
    strokeWeight(1);
    noFill();

    if (type === 'top') {
      line(x, y + h, x + w, y + h);
    } else if (type === 'bottom') {
      line(x, y, x + w, y);
    } else if (type === 'sidebar') {
      line(x, y, x, y + h);
    }
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  render() {
    // Top bar content
    this.renderTopBar();

    // Bottom bar content
    this.renderBottomBar();

    // Sidebar content
    this.renderSidebar();
  }

  // ==========================================
  // TOP BAR (180px height) - Centered layout
  // ==========================================

  renderTopBar() {
    const contentY = 20;

    // Mauri counter (centered left)
    this.renderMauriCounter(this.layout.mauriX, contentY);

    // Season & Migration info (center)
    this.renderSeasonPanel(this.layout.seasonX, contentY);

    // Timer (centered right)
    this.renderTimer(this.layout.timerX, contentY);

    // Fullscreen + pause buttons (right edge, before sidebar)
    this.renderFullscreenButton(this.layout.fsBtnX, this.layout.pauseBtnY);
    this.renderPauseButton(this.layout.pauseBtnX, this.layout.pauseBtnY);

    // Migration hint row (bottom of top bar, centered)
    this.renderMigrationHint(this.layout.migrationHintX, 110);
  }

  // ==========================================
  // FULLSCREEN OVERLAY HUD
  // Drawn over the maximised play area: the top-bar essentials (no hint row),
  // the goals panel, and the placeables toolbar. Panels are translucent.
  // ==========================================

  renderFullscreenOverlay() {
    const fs = this.layout.fs;

    this.renderMauriCounter(fs.mauriX, fs.stripY);
    this.renderSeasonPanel(fs.seasonX, fs.stripY);
    this.renderTimer(fs.timerX, fs.stripY);
    this.renderFullscreenButton(fs.fsBtnX, fs.btnY);
    this.renderPauseButton(fs.pauseBtnX, fs.btnY);

    this.renderFocusSpeciesButtons();

    // Extend the goals panel's own green backing 12px past the content on
    // every side (same colour as the panel body, so it reads as one panel).
    const goalsH = 30 + this.game.goals.length * 26;
    fill(30, 45, 38, 220);
    noStroke();
    rect(fs.goalsX - 12, fs.goalsY - 12,
         this.layout.sidebarPanelWidth + 24, goalsH + 24, 10);

    this.renderGoalsPanel(fs.goalsX, fs.goalsY);

    this.renderToolbar(fs.toolbarStartX, fs.toolbarY);
  }

  // Fullscreen-only quick toggles for the level's focus species (top-right,
  // above the goals panel): idle sprite + live population. Clicking toggles
  // the in-world highlight; while active the button is framed and softly
  // filled in the species' highlight colour.
  renderFocusSpeciesButtons() {
    this._fsFocusBtnBounds = [];
    const focal = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.focalSpecies) || null;
    if (!focal || !focal.length) return;

    const size = 70, gap = 10;
    let x = this.config.canvasWidth - 15 - focal.length * size - (focal.length - 1) * gap;
    const y = 10;

    for (const key of focal) {
      const cfg = (typeof MOA_SPECIES !== 'undefined' && MOA_SPECIES[key]) || {};
      const active = typeof SPECIES_HIGHLIGHT !== 'undefined' && SPECIES_HIGHLIGHT.has(key);
      const hc = cfg.highlightColor || [255, 235, 120];

      if (active) {
        fill(hc[0] * 0.25, hc[1] * 0.25, hc[2] * 0.25, 225);
        stroke(hc[0], hc[1], hc[2]);
        strokeWeight(3);
      } else {
        fill(35, 55, 40, 200);
        stroke(70, 110, 80);
        strokeWeight(1);
      }
      rect(x, y, size, size, 10);

      // Idle sprite — the species' own art; generic art gets the species tint
      const set = (cfg.spriteSet && EntitySprites.moaVariants[cfg.spriteSet]) || EntitySprites.moa;
      const sprite = EntitySprites.isValid(set.idle) ? set.idle : EntitySprites.moa.idle;
      if (EntitySprites.isValid(sprite)) {
        push();
        imageMode(CENTER);
        const s = Math.min(40 / sprite.width, 40 / sprite.height);
        if (!cfg.spriteSet && cfg.tint) tint(cfg.tint[0], cfg.tint[1], cfg.tint[2]);
        image(sprite, x + size / 2, y + size / 2 - 8, sprite.width * s, sprite.height * s);
        pop();
      }

      // Live population count
      const count = this.simulation.getCachedSpeciesCount
        ? this.simulation.getCachedSpeciesCount(key)
        : 0;
      fill(230, 245, 235);
      noStroke();
      textSize(16);
      textAlign(CENTER, BOTTOM);
      push();
      textFont(GroceryRounded);
      text(count, x + size / 2, y + size - 2);
      pop();

      this._fsFocusBtnBounds.push({ key, x, y, size });
      x += size + gap;
    }
  }

  renderMauriCounter(x, y) {
    // Container
    fill(35, 55, 40, 200);
    stroke(70, 110, 80);
    strokeWeight(1);
    rect(x, y, 180, 70, 10);

    // Mauri symbol
    push();
    translate(x + 35, y + 35);
    noFill();
    stroke(100, 200, 130);
    strokeWeight(4);
    arc(0, 0, 28, 28, PI, TWO_PI);
    arc(6, 3, 16, 16, 0, PI);
    pop();

    // Label
    fill(140, 180, 150);
    noStroke();
    textSize(12);
    textAlign(LEFT, TOP);
    text("Mauri", x + 60, y + 12);

    // Value
    fill(120, 255, 150);
    textSize(32);
    push();
    textFont(GroceryRounded);
    text(Math.floor(this.mauri.mauri), x + 60, y + 28);
    pop();
  }

  renderSeasonPanel(x, y) {
    const season = this.seasonManager.current;
    const progress = this.seasonManager.progress;
    const nextSeason = this.seasonManager.next;

    // Container
    fill(35, 55, 40, 200);
    stroke(70, 110, 80);
    strokeWeight(1);
    rect(x, y, 280, 70, 10);

    // Season icon (large)
    fill(255);
    noStroke();
    textSize(36);
    textAlign(LEFT, CENTER);
    text(season.icon, x + 15, y + 35);

    // Season name
    let seasonCol = color(season.color);
    fill(seasonCol);
    textSize(18);
    textAlign(LEFT, TOP);
    text(season.name, x + 60, y + 10);

    // Progress bar
    const barX = x + 60;
    const barY = y + 38;
    const barW = 200;
    const barH = 10;

    fill(40, 50, 45);
    noStroke();
    rect(barX, barY, barW, barH, 5);

    // Fill with gradient
    let nextCol = color(nextSeason.color);
    let gradientCol = lerpColor(seasonCol, nextCol, progress);
    fill(gradientCol);
    rect(barX, barY, barW * progress, barH, 5);
  }

  renderTimer(x, y) {
    const seconds = Math.floor(this.game.playTime / 60);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${minutes}:${secs.toString().padStart(2, '0')}`;

    // Container
    fill(35, 55, 40, 200);
    stroke(70, 110, 80);
    strokeWeight(1);
    rect(x, y, 120, 70, 10);

    // Label
    fill(140, 180, 150);
    noStroke();
    textSize(11);
    textAlign(CENTER, TOP);
    text("TIME", x + 60, y + 10);

    // Time value
    fill(200, 240, 210);
    textSize(28);
    push();
    textFont(GroceryRounded);
    textAlign(CENTER, TOP);
    text(timeStr, x + 60, y + 28);
    pop();
  }

  renderMigrationHint(x, y) {
    // Container
    fill(30, 45, 35, 180);
    noStroke();
    rect(x, y, this.layout.migrationHintWidth, 50, 8);

    // Get seasonal message
    const message = this.getSeasonalMessage();

    // Icon based on message type
    const icon = message.icon || '📢';
    fill(255);
    textSize(24);
    textAlign(LEFT, CENTER);
    text(icon, x + 15, y + 25);

    // Main message
    fill(message.color[0], message.color[1], message.color[2]);
    textSize(14);
    textAlign(LEFT, CENTER);
    text(message.text, x + 50, y + 18);

    // Secondary hint
    if (message.subtext) {
      fill(120, 150, 140);
      textSize(11);
      text(message.subtext, x + 50, y + 36);
    }
  }

  renderPauseButton(x, y) {
    const size = this.layout.pauseBtnSize;
    const isHovered = mouseX > x && mouseX < x + size &&
                      mouseY > y && mouseY < y + size;
    const isPaused = this.game.state === GAME_STATE.PAUSED;

    // Button background
    if (isHovered) {
      fill(50, 85, 60);
      stroke(100, 160, 120);
      strokeWeight(2);
    } else {
      fill(35, 55, 40, 200);
      stroke(70, 110, 80);
      strokeWeight(1);
    }
    rect(x, y, size, size, 10);

    // Icon
    noStroke();
    const centerX = x + size / 2;
    const centerY = y + size / 2;

    if (isPaused) {
      // Play triangle
      fill(100, 220, 130);
      beginShape();
      vertex(centerX - 8, centerY - 14);
      vertex(centerX - 8, centerY + 14);
      vertex(centerX + 14, centerY);
      endShape(CLOSE);
    } else {
      // Pause bars
      fill(180, 200, 190);
      rect(centerX - 12, centerY - 12, 8, 24, 2);
      rect(centerX + 4, centerY - 12, 8, 24, 2);
    }
  }

  renderFullscreenButton(x, y) {
    const size = this.layout.pauseBtnSize;
    const isHovered = mouseX > x && mouseX < x + size &&
                      mouseY > y && mouseY < y + size;

    // Button background (matches pause button styling)
    if (isHovered) {
      fill(50, 85, 60);
      stroke(100, 160, 120);
      strokeWeight(2);
    } else {
      fill(35, 55, 40, 200);
      stroke(70, 110, 80);
      strokeWeight(1);
    }
    rect(x, y, size, size, 10);

    // Corner-bracket icon: opens outward to enter fullscreen,
    // inward to exit.
    const cx = x + size / 2;
    const cy = y + size / 2;
    const fsOn = this.config.fullscreen;
    const o = fsOn ? 5 : 13;    // bracket corner offset from centre
    const len = 8;              // bracket arm length
    const dir = fsOn ? 1 : -1;  // arms point outward when exiting, inward when entering

    stroke(180, 200, 190);
    strokeWeight(3);
    noFill();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = cx + sx * o;
      const py = cy + sy * o;
      line(px, py, px + sx * dir * len, py);
      line(px, py, px, py + sy * dir * len);
    }
  }

  // ==========================================
  // SEASONAL MESSAGES
  // ==========================================

  getSeasonalMessage() {
    const seasonKey = this.seasonManager.currentKey;
    const nextSeasonKey = this.seasonManager.nextKey;
    const progress = this.seasonManager.progress;

    const aliveMoas = this.simulation.moas.filter(m => m.alive);
    const avgHunger = aliveMoas.length > 0
      ? aliveMoas.reduce((sum, m) => sum + m.hunger, 0) / aliveMoas.length
      : 0;
    const migratingCount = aliveMoas.filter(m => m.isMigrating).length;

    // Urgent warnings take priority
    if (avgHunger > 70 && aliveMoas.length > 0) {
      return {
        icon: '⚠️',
        text: 'Your moa are starving! Place food sources immediately.',
        subtext: 'Kawakawa groves and Harakeke provide quick nutrition.',
        color: [255, 150, 100]
      };
    }

    if (this.simulation.eagles.some(e => e.state === 'hunting' || e.state === 'diving')) {
      return {
        icon: '🦅',
        text: 'A Pouākai is on the hunt!',
        subtext: 'A sudden thunderstorm or heavy fern cover could thwart its pursuit.',
        color: [255, 120, 120]
      };
    }

    // Season transition warnings
    if (progress > 0.75) {
      return this.getSeasonTransitionMessage(nextSeasonKey);
    }

    // Current season messages
    return this.getCurrentSeasonMessage(seasonKey, migratingCount, aliveMoas.length);
  }

  getSeasonTransitionMessage(nextSeasonKey) {
    const messages = {
      'autumn': {
        icon: '🍂',
        text: 'Summer is ending; the mountains will snow over.',
        subtext: 'High elevation plants will become less nutritious; be prepared!',
        color: [255, 200, 130]
      },
      'winter': {
        icon: '❄️',
        text: 'Winter is coming! High ground will become barren.',
        subtext: 'Moa will migrate to the forest. Help them out!',
        color: [180, 200, 255]
      },
      'spring': {
        icon: '🌸',
        text: 'Spring is near; plants will begin to regrow.',
        subtext: 'Good nesting conditions ahead!',
        color: [255, 180, 200]
      },
      'summer': {
        icon: '☀️',
        text: 'It\'s nearly summer; Upland moa will migrate.',
        subtext: 'Moa can forage across all elevations below the snow line!',
        color: [255, 240, 150]
      }
    };

    return messages[nextSeasonKey] || messages['summer'];
  }

  getCurrentSeasonMessage(seasonKey, migratingCount, moaCount) {
    const messages = {
      'summer': {
        icon: '☀️',
        text: 'Summer: Moa can forage freely across all elevations.',
        subtext: migratingCount > 0
          ? `${migratingCount} moa currently moving to new areas.`
          : 'All biomes are productive. Good time to expand territory.',
        color: [255, 230, 150]
      },
      'autumn': {
        icon: '🍂',
        text: 'Autumn: Plants slowing growth. Prepare for winter.',
        subtext: migratingCount > 0
          ? `${migratingCount} moa moving to lower ground.`
          : 'High elevation food becoming scarce.',
        color: [255, 180, 100]
      },
      'winter': {
        icon: '❄️',
        text: 'Winter: High elevations are barren. Stay in lowlands.',
        subtext: migratingCount > 0
          ? `${migratingCount} moa still migrating to safety.`
          : 'Focus on shelters and maintaining food sources.',
        color: [180, 210, 255]
      },
      'spring': {
        icon: '🌸',
        text: 'Spring: Plants regrowing. Excellent nesting conditions.',
        subtext: moaCount < CONFIG.maxMoaPopulation * 0.5
          ? 'Moa are struggling! encourage breeding with nesting sites.'
          : 'Territory expanding as dormant plants wake up.',
        color: [255, 200, 220]
      }
    };

    return messages[seasonKey] || messages['summer'];
  }

  // ==========================================
  // BOTTOM BAR - Centered layout
  // ==========================================

  renderBottomBar() {
    this.renderToolbar();

    if (this.game.selectedPlaceable) {
      this.renderSelectedToolInfo();
    }
  }

  renderToolbar(startX = this.layout.toolbarStartX, toolbarY = this.toolbarY) {
    const btnX = startX;
    const btnY = toolbarY;
    const btnSize = this.layout.toolbarBtnSize;
    const spacing = this.layout.toolbarSpacing;

    const palette = this.game.activePlaceables || PLACEABLES;
    let i = 0;
    for (let type in palette) {
      const def = palette[type];
      const x = btnX + i * spacing;

      const isSelected = this.game.selectedPlaceable === type;
      const canAfford = this.mauri.canAfford(def.cost);
      const isHovered = mouseX > x && mouseX < x + btnSize &&
                        mouseY > btnY && mouseY < btnY + btnSize;

      // Button background
      if (isSelected) {
        fill(60, 120, 80);
        stroke(120, 200, 140);
        strokeWeight(3);
      } else if (isHovered && canAfford) {
        fill(50, 85, 60);
        stroke(90, 140, 110);
        strokeWeight(2);
      } else {
        fill(canAfford ? 40 : 35, canAfford ? 60 : 35, canAfford ? 50 : 35);
        stroke(canAfford ? 60 : 50, canAfford ? 85 : 50, canAfford ? 70 : 50);
        strokeWeight(1);
      }
      rect(x, btnY, btnSize, btnSize, 10);

      // Icon background circle
      push();
      translate(x + btnSize / 2, btnY + btnSize / 2 - 8);

      let iconCol = color(def.color);
      fill(canAfford ? red(iconCol) : 60, canAfford ? green(iconCol) : 60, canAfford ? blue(iconCol) : 60);
      noStroke();
      ellipse(0, 0, 36, 36);

      // Icon
      fill(255, 255, 255, canAfford ? 240 : 100);
      textSize(20);
      textAlign(CENTER, CENTER);
      text(def.icon, 0, 0);
      pop();

      // Cost
      fill(canAfford ? 180 : 255, canAfford ? 255 : 120, canAfford ? 190 : 120);
      noStroke();
      textSize(12);
      textAlign(CENTER, TOP);
      text(def.cost, x + btnSize / 2, btnY + btnSize - 20);

      // Hotkey number
      fill(100, 130, 110);
      textSize(10);
      textAlign(CENTER, TOP);
      text(i + 1, x + btnSize / 2, btnY + btnSize + 5);

      // Tooltip on hover
      if (isHovered) {
        this.renderToolTooltip(x + btnSize / 2, btnY - 10, def);
      }

      i++;
    }
  }

  renderToolTooltip(x, y, def) {
    const tw = 180;
    const th = 80;

    const _maxW = CONFIG.fullscreen ? CONFIG.canvasWidth : CONFIG.gameAreaWidth;
    x = constrain(x - tw / 2, 10, _maxW - tw - 10);
    y = y - th - 5;

    // Background
    fill(25, 40, 30, 240);
    stroke(80, 120, 90);
    strokeWeight(1);
    rect(x, y, tw, th, 8);

    // Name
    fill(200, 240, 210);
    noStroke();
    textSize(13);
    textAlign(LEFT, TOP);
    text(def.name, x + 10, y + 8);

    // Description
    fill(150, 180, 160);
    textSize(10);
    text(def.description, x + 10, y + 28);

    // Stats
    fill(120, 150, 130);
    textSize(9);
    text(`Duration: ${(def.duration / 60).toFixed(0)}s`, x + 10, y + 48);
    text(`Radius: ${def.radius}px`, x + 10, y + 62);
  }

  renderSelectedToolInfo() {
    const def = (this.game.activePlaceables && this.game.activePlaceables[this.game.selectedPlaceable]) || PLACEABLES[this.game.selectedPlaceable];
    const x = this.layout.selectedToolX;
    const y = this.bottomBar.y + 20;

    // Make sure the panel fits within the game area
    const panelWidth = 280;
    const adjustedX = Math.min(x, this.config.gameAreaWidth - panelWidth - 20);

    // Info panel
    fill(40, 70, 50, 220);
    stroke(90, 140, 110);
    strokeWeight(1);
    rect(adjustedX, y, panelWidth, 70, 8);

    // Icon
    const iconCol = color(def.color);
    fill(red(iconCol), green(iconCol), blue(iconCol));
    noStroke();
    ellipse(adjustedX + 35, y + 35, 40, 40);
    textSize(22);
    fill(255);
    textAlign(CENTER, CENTER);
    text(def.icon, adjustedX + 35, y + 35);

    // Name and cost
    fill(200, 240, 210);
    textSize(14);
    textAlign(LEFT, TOP);
    text(def.name, adjustedX + 65, y + 12);

    fill(140, 255, 160);
    textSize(12);
    text(`Cost: ${def.cost} mauri`, adjustedX + 65, y + 32);

    // Instruction
    fill(140, 170, 150);
    textSize(10);
    text("Click in game area to place", adjustedX + 65, y + 50);
  }

  // ==========================================
  // RIGHT SIDEBAR — Responsive width
  // Panel widths and content adapt to this.sidebar.width
  // ==========================================

  renderSidebar() {
    const x = this.sidebar.x;
    const padding = this.layout.sidebarPadding;
    let y = padding;

    // Section 1: Goals (top)
    y = this.renderGoalsPanel(x + padding, y);

    // Section 2: Event Log
    y = this.renderEventLog(x + padding, y + 12);

    // Section 3: Species Info (with population stats)
    y = this.renderSpeciesInfo(x + padding, y + 12);

    // Section 4: Mini Map
    this.renderMiniMap(x + padding, y + 12);
  }

  renderGoalsPanel(x, y) {
    const panelWidth = this.layout.sidebarPanelWidth;
    const panelHeight = 30 + this.game.goals.length * 26;

    // Panel header
    const header = this._getPanelHeader();
    fill(header[0], header[1], header[2]);
    noStroke();
    rect(x, y, panelWidth, 30, 8, 8, 0, 0);

    fill(180, 220, 190);
    textSize(18);
    textAlign(LEFT, CENTER);
    text("  GOALS", x + 12, y + 17);

    // Completion count
    const completed = this.game.goals.filter(g => g.achieved).length;
    fill(120, 180, 140);
    textSize(10);
    textAlign(RIGHT, CENTER);
    text(`${completed}/${this.game.goals.length}`, x + panelWidth - 10, y + 15);

    // Panel body
    fill(30, 45, 38, 220);
    noStroke();
    rect(x, y + 30, panelWidth, panelHeight - 30, 0, 0, 8, 8);

    // Goals list
    let goalY = y + 42;
    for (const goal of this.game.goals) {
      // Checkbox
      fill(goal.achieved ? 80 : 50, goal.achieved ? 160 : 60, goal.achieved ? 100 : 55);
      stroke(goal.achieved ? 120 : 80, goal.achieved ? 200 : 100, goal.achieved ? 140 : 85);
      strokeWeight(1);
      rect(x + 12, goalY + 3, 14, 14, 3);

      if (goal.achieved) {
        fill(40, 80, 50);
        noStroke();
        textSize(16);
        textAlign(CENTER, CENTER);
        text("✓", x + 19, goalY + 10);
      }

      // Goal text — truncate if panel is narrow
      fill(goal.achieved ? 120 : 180, goal.achieved ? 150 : 210, goal.achieved ? 130 : 190);
      noStroke();
      textSize(16);
      textAlign(LEFT, CENTER);

      let goalText = goal.name;
      const maxGoalTextW = panelWidth - 80; // room for checkbox + reward
      if (textWidth(goalText) > maxGoalTextW) {
        while (textWidth(goalText + '…') > maxGoalTextW && goalText.length > 5) {
          goalText = goalText.slice(0, -1);
        }
        goalText += '…';
      }
      text(goalText, x + 32, goalY + 10);

      // Reward
      fill(goal.achieved ? 100 : 140, goal.achieved ? 130 : 200, goal.achieved ? 110 : 150);
      textSize(12);
      textAlign(RIGHT, CENTER);
      text(`+${goal.reward}`, x + panelWidth - 12, goalY + 10);

      goalY += 24;
    }

    return y + panelHeight;
  }

  renderEventLog(x, y) {
    const panelWidth = this.layout.sidebarPanelWidth;
    const panelHeight = this.layout.eventLogHeight;
    const maxMessages = this.layout.eventLogMaxMessages;

    // Panel header
    const header = this._getPanelHeader();
    fill(header[0], header[1], header[2]);
    noStroke();
    rect(x, y, panelWidth, 28, 8, 8, 0, 0);

    fill(180, 220, 190);
    textSize(14);
    textAlign(LEFT, CENTER);
    text("  EVENT LOG", x + 10, y + 14);

    // Message count indicator
    const msgCount = this.game.notifications.length;
    if (msgCount > 0) {
      fill(100, 150, 120);
      textSize(9);
      textAlign(RIGHT, CENTER);
      text(`${msgCount} messages`, x + panelWidth - 10, y + 14);
    }

    // Panel body
    fill(30, 45, 38, 220);
    noStroke();
    rect(x, y + 28, panelWidth, panelHeight - 28, 0, 0, 8, 8);

    // Messages
    let msgY = y + 45;
    const messages = this.game.notifications.slice(0, maxMessages);
    const lineHeight = 34;

    for (const msg of messages) {
      const alpha = Math.min(255, msg.life * 0.85);

      // Message type indicator
      let tr, tg, tb;
      switch (msg.type) {
        case 'success': tr = 100; tg = 200; tb = 120; break;
        case 'error': tr = 200; tg = 100; tb = 100; break;
        default: tr = 100; tg = 150; tb = 200;
      }

      fill(tr, tg, tb, alpha);
      noStroke();
      ellipse(x + 18, msgY + 8, 8, 8);

      // Message text
      fill(190, 210, 200, alpha);
      textSize(13);
      textAlign(LEFT, TOP);

      // Word wrap for variable-width panel
      const maxW = panelWidth - 50;
      let displayText = msg.text;
      if (textWidth(displayText) > maxW) {
        while (textWidth(displayText + '...') > maxW && displayText.length > 10) {
          displayText = displayText.slice(0, -1);
        }
        displayText += '...';
      }
      text(displayText, x + 32, msgY);

      // Timestamp
      const msgAge = Math.floor((this.game.playTime - msg.time) / 60);
      fill(100, 120, 110, alpha * 0.7);
      textSize(8);
      textAlign(RIGHT, TOP);
      text(msgAge === 0 ? 'now' : `${msgAge}s`, x + panelWidth - 10, msgY + 2);

      msgY += lineHeight;
      if (msgY > y + panelHeight - 25) break;
    }

    // Empty state
    if (messages.length === 0) {
      fill(80, 100, 90);
      textSize(11);
      textAlign(CENTER, CENTER);
      text("No recent events", x + panelWidth / 2, y + panelHeight / 2);
    }

    return y + panelHeight;
  }

  renderSpeciesInfo(x, y) {
    const panelWidth = this.layout.sidebarPanelWidth;
    // Panel grows a row taller for each moa species beyond four, so a 5th/6th
    // species row never overflows the box (driven by the level's species list).
    const _nMoaSpecies = ((this.simulation.activeSpecies && this.simulation.activeSpecies.moa) || []).length;
    const _speciesRowCount = Math.max(1, Math.ceil(_nMoaSpecies / 2));
    const panelHeight = this.layout.speciesPanelHeight + Math.max(0, _speciesRowCount - 2) * 28;

    // Panel header
    const header = this._getPanelHeader();
    fill(header[0], header[1], header[2]);
    noStroke();
    rect(x, y, panelWidth, 28, 8, 8, 0, 0);

    fill(180, 220, 190);
    textSize(14);
    textAlign(LEFT, CENTER);
    text("  POPULATION", x + 10, y + 14);

    // Panel body
    fill(30, 45, 38, 220);
    noStroke();
    rect(x, y + 28, panelWidth, panelHeight - 28, 0, 0, 8, 8);

    const stats = this.getStats();
    const aliveMoas = this.simulation.moas.filter(m => m.alive);

    // Per-species counts — data-driven from the level's OWN species list so no
    // species is ever silently uncounted. (The old hardcoded genus buckets had no
    // slot for stout_legged_moa, so its whole population was invisible while still
    // counting toward the total — the source of the "counts look low" mismatch.)
    const _speciesKeys = (this.simulation.activeSpecies && this.simulation.activeSpecies.moa) || [];
    const _counts = {};
    for (let i = 0; i < _speciesKeys.length; i++) _counts[_speciesKeys[i]] = 0;
    let _otherMoa = 0;
    for (let i = 0; i < aliveMoas.length; i++) {
      const k = aliveMoas[i].speciesKey;
      if (_counts[k] !== undefined) _counts[k]++;
      else _otherMoa++;   // e.g. an off-level species introduced by egg mutation
    }

    // Compact labels + icons (fall back to the species' displayName / tint).
    const _MOA_LABEL = {
      upland_moa: 'Upland', little_bush_moa: 'Bush moa',
      stout_legged_moa: 'Stout-legged', eastern_moa: 'Eastern moa',
      south_island_giant_moa: 'Dinornis', north_island_giant_moa: 'Dinornis',
      heavy_footed_moa: 'Heavy-footed', crested_moa: 'Crested', mantells_moa: "Mantell's"
    };
    const _MOA_ICON = {
      upland_moa: '🏔️', little_bush_moa: '🌲', stout_legged_moa: '🦵',
      eastern_moa: '🌾', south_island_giant_moa: '🦤', north_island_giant_moa: '🦤',
      heavy_footed_moa: '🐾', crested_moa: '🪨', mantells_moa: '🪨'
    };
    const _speciesRows = [];
    for (let i = 0; i < _speciesKeys.length && _speciesRows.length < 6; i++) {
      const key = _speciesKeys[i];
      const data = (typeof MOA_SPECIES !== 'undefined' && MOA_SPECIES[key]) || {};
      _speciesRows.push({
        key,
        icon: _MOA_ICON[key] || '🥝',
        label: _MOA_LABEL[key] || data.displayName || key,
        value: _counts[key],
        color: data.tint || [205, 195, 165],
        highlightColor: data.highlightColor
      });
    }
    if (_otherMoa > 0 && _speciesRows.length < 6) {
      _speciesRows.push({ icon: '❔', label: 'Other moa', value: _otherMoa, color: [150, 150, 150] });
    }

    // Population stats — 5 rows x 2 columns, row-major
    let statY = y + 42;
    const rowH = 28;
    const col1X = x + 15;
    const col2X = x + panelWidth / 2 + 5;

    // Species rows (2 per row), driven by the level's species list. Render enough
    // rows for every species (plus any "Other moa"), matching the reserved height.
    // Each row is clickable: it toggles that species' in-world highlight and
    // gets a border in the species' highlight colour while active.
    const _rows = Math.max(_speciesRowCount, Math.ceil(_speciesRows.length / 2));
    const _rowW = panelWidth / 2 - 14;
    this._speciesRowBounds = [];
    for (let r = 0; r < _rows; r++) {
      const a = _speciesRows[r * 2], b = _speciesRows[r * 2 + 1];
      if (a) this._renderSpeciesRow(col1X, statY, _rowW, a);
      if (b) this._renderSpeciesRow(col2X, statY, _rowW, b);
      statY += rowH;
    }
    this.renderStatItem(col1X, statY, '👣', 'Total moa', `${stats.moas}/${this.config.maxMoaPopulation}`, [180, 210, 150]);
    this.renderStatItem(col2X, statY, '🦅', 'Total eagles', stats.eagles, [180, 130, 130]);
    statY += rowH;
    this.renderStatItem(col1X, statY, '🥚', 'Eggs', stats.eggs, [245, 240, 220]);
    this.renderStatItem(col2X, statY, '🐣', 'Hatched', stats.births, [255, 230, 180]);
    statY += rowH;
    this.renderStatItem(col1X, statY, '🌿', 'Plants', stats.activePlants, [130, 200, 130]);
    this.renderStatItem(col2X, statY, '❄️', 'Dormant', stats.dormantPlants, [150, 150, 170]);

    statY += rowH + 6;

    // Average Hunger Bar
    if (aliveMoas.length > 0) {
      const avgHunger = aliveMoas.reduce((sum, m) => sum + m.hunger, 0) / aliveMoas.length;

      fill(140, 160, 150);
      textSize(12);
      textAlign(LEFT, TOP);
      text(`Avg hunger: ${avgHunger.toFixed(0)}%`, col1X, statY);

      // Hunger bar (adapts to panel width)
      const barW = panelWidth - 30;
      const barY = statY + 16;

      fill(50, 40, 40);
      noStroke();
      rect(col1X, barY, barW, 8, 4);

      // Color based on hunger level
      const hr = avgHunger < 30 ? 100 : (avgHunger < 60 ? 200 : 220);
      const hg = avgHunger < 30 ? 200 : (avgHunger < 60 ? 200 : 100);
      const hb = avgHunger < 30 ? 100 : (avgHunger < 60 ? 100 : 100);
      fill(hr, hg, hb);
      rect(col1X, barY, barW * (avgHunger / 100), 8, 4);

      // Hunger level text
      fill(120, 140, 130);
      textSize(8);
      textAlign(RIGHT, TOP);
      const hungerStatus = avgHunger < 30 ? 'Well Fed' : (avgHunger < 60 ? 'Hungry' : 'Starving!');
      text(hungerStatus, col1X + barW, statY);
    } else {
      fill(150, 100, 100);
      textSize(11);
      textAlign(CENTER, CENTER);
      text("No moa alive!", x + panelWidth / 2, statY + 10);
    }

    return y + panelHeight;
  }

  // One clickable species population row. Clicking it (handleSidebarClick)
  // toggles the in-world species highlight; while active the row is framed
  // in the species' highlight colour.
  _renderSpeciesRow(x, y, w, row) {
    if (row.key) {
      this._speciesRowBounds.push({ key: row.key, x: x - 8, y: y - 4, w: w, h: 32 });

      if (typeof SPECIES_HIGHLIGHT !== 'undefined' && SPECIES_HIGHLIGHT.has(row.key)) {
        const hc = row.highlightColor || [255, 235, 120];
        noFill();
        stroke(hc[0], hc[1], hc[2], 230);
        strokeWeight(2);
        rect(x - 8, y - 4, w, 32, 8);
      }
    }
    this.renderStatItem(x, y, row.icon, row.label, row.value, row.color);
  }

  _toggleSpeciesHighlight(key) {
    if (typeof SPECIES_HIGHLIGHT === 'undefined') return;
    if (SPECIES_HIGHLIGHT.has(key)) SPECIES_HIGHLIGHT.delete(key);
    else SPECIES_HIGHLIGHT.add(key);
  }

  renderStatItem(x, y, icon, label, value, col) {
    // Icon
    fill(255);
    noStroke();
    textSize(18);
    textAlign(LEFT, CENTER);
    text(icon, x, y + 10);

    // Label
    fill(col[0], col[1], col[2]);
    textSize(12);
    textAlign(LEFT, TOP);
    text(label, x + 26, y);

    // Value
    fill(230, 245, 235);
    textSize(20);
    push();
    textFont(GroceryRounded);
    textAlign(LEFT, TOP);
    text(value, x + 26, y + 10);
    pop();
  }

  renderMiniMap(x, y) {
    // Placeholder for future implementation
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  getStats() {
    const aliveMoas = this.simulation.moas.filter(m => m.alive);
    return {
      moas: aliveMoas.length,
      migrating: aliveMoas.filter(m => m.isMigrating).length,
      eggs: this.simulation.eggs.filter(e => e.alive).length,
      births: this.simulation.stats.births,
      eagles: this.simulation.eagles.length,
      dormantPlants: this.simulation.plants.filter(p => p.dormant).length,
      activePlants: this.simulation.plants.filter(p => p.alive && !p.dormant).length
    };
  }
}