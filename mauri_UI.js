// ============================================
// LEVEL COUNTDOWN PIE - tunables
// A small pie sitting to the right of the TIME panel. It begins as a full
// disc and is eaten away clockwise from 12 o'clock over the course of the
// level, hitting empty as the level ends. It encodes proportion of level
// remaining only - the TIME panel next to it already carries the minutes.
// ============================================
const LEVEL_CLOCK = {
  enabled: true,        // false = no dial drawn, and no layout space reserved
  size: 70,             // outer diameter (px); also the width it claims in the top bar
  gap: 10,              // spacing between the TIME panel and the dial

  // Levels declare their length as `timeLimit` in FRAMES (14400 = 4 min).
  // This is only a last-resort fallback in seconds if that can't be found;
  // leave it null so an unresolved level simply draws no pie rather than
  // counting down a duration that means nothing.
  fallbackSeconds: null,

  // Urgency thresholds, as a FRACTION of the level still remaining
  warnAt: 0.25,         // amber at or below this (last 60s of a 4:00 level)
  dangerAt: 0.10,       // red + pulsing at or below this (last 24s of 4:00)
  pulseHz: 2.0,         // pulse speed (cycles/sec) inside the danger band

  // Colours [r, g, b]
  calmColor: [140, 220, 170],
  warnColor: [235, 190, 90],
  dangerColor: [235, 100, 90],
  spentColor: [28, 42, 34, 200],   // the disc left behind as the wedge retreats
  faceStroke: [70, 110, 80],       // outer ring

  // Show the remaining mm:ss in the middle of the dial once inside warnAt
  showNumbersWhenLow: true
};

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

    // The TIME panel and the countdown dial travel together as one block, so
    // the centring maths below only ever sees a single (wider) timer element.
    const clockGap = LEVEL_CLOCK.enabled ? LEVEL_CLOCK.gap : 0;
    const clockWidth = LEVEL_CLOCK.enabled ? LEVEL_CLOCK.size : 0;
    const timerBlockWidth = timerWidth + clockGap + clockWidth;

    // Total width of top bar elements
    const topBarElementsWidth = mauriWidth + seasonWidth + timerBlockWidth + (elementSpacing * 2);

    // If game area is too narrow, compress spacing
    let adjustedSpacing = elementSpacing;
    if (topBarElementsWidth > gameAreaWidth - 120) {
      // Leave room for pause button; compress element spacing
      const available = gameAreaWidth - 120 - mauriWidth - seasonWidth - timerBlockWidth;
      adjustedSpacing = Math.max(10, available / 2);
    }

    const adjustedTotalWidth = mauriWidth + seasonWidth + timerBlockWidth + (adjustedSpacing * 2);
    const topBarStartX = (gameAreaWidth - adjustedTotalWidth) / 2;

    // Store calculated positions for top bar
    this.layout = {
      // Top bar elements (centered in game area)
      mauriX: topBarStartX,
      seasonX: topBarStartX + mauriWidth + adjustedSpacing,
      timerX: topBarStartX + mauriWidth + seasonWidth + (adjustedSpacing * 2),
      clockX: topBarStartX + mauriWidth + seasonWidth + (adjustedSpacing * 2) +
              timerWidth + clockGap,

      // Pause button (right edge of game area, before sidebar)
      pauseBtnX: gameAreaWidth - 90,
      pauseBtnY: 20,
      pauseBtnSize: 70,

      // Migration hint (centered, proportional to game area)
      migrationHintWidth: Math.min(1000, gameAreaWidth - 100),
      migrationHintX: (gameAreaWidth - Math.min(1000, gameAreaWidth - 100)) / 2,

      // Bottom bar toolbar. Count the LEVEL'S active palette, not the global
      // PLACEABLES catalog — the catalog also holds tools from other levels
      // (lancewood, speargrass, ...), so using its length centers the row and
      // sizes the tutorial highlight for phantom extra buttons.
      toolbarBtnSize: 70,
      toolbarSpacing: 85,
      toolbarBtnCount: Object.keys((this.game && this.game.activePlaceables) || PLACEABLES).length,

      // Sidebar content padding and panel width
      sidebarPadding: 15,
      sidebarPanelWidth: this.sidebar.width - 30
    };

    // Unified season/year RING — one element in place of the old season panel +
    // TIME panel + level-countdown dial. Centred over the span those three occupied.
    const _clockSpan = LEVEL_CLOCK.enabled ? (LEVEL_CLOCK.gap + LEVEL_CLOCK.size) : 0;
    this.layout.ringR = 78;
    this.layout.ringCX = (this.layout.seasonX + this.layout.timerX + timerWidth + _clockSpan) / 2;
    this.layout.ringCY = 20 + this.layout.ringR;

    // Mauri counter as a large circular dial, sitting just LEFT of the season ring.
    this.layout.mauriRingR = 56;
    this.layout.mauriRingCX = this.layout.ringCX - this.layout.ringR - 26 - this.layout.mauriRingR;
    this.layout.mauriRingCY = this.layout.ringCY;

    // Ecosystem (avg-pop / balance) dial, sitting just RIGHT of the season ring. Endless only.
    this.layout.popDialR = 56;
    this.layout.popDialCX = this.layout.ringCX + this.layout.ringR + 26 + this.layout.popDialR;
    this.layout.popDialCY = this.layout.ringCY;

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
    // Panel heights grow with the small-text bump so their content rhythm
    // (event log lines, population rows) keeps fitting as the text scales:
    // one lineHeight bump per log message, two per stat row (5 rows).
    this.layout.eventLogHeight = Math.round(280 * sidebarScale) + SMALL_TEXT_BUMP * 7;
    this.layout.speciesPanelHeight = Math.round(240 * sidebarScale) + SMALL_TEXT_BUMP * 10;
    this.layout.eventLogMaxMessages = sidebarScale >= 1 ? 7 : 5;

    this.layout.toolbarTotalWidth = toolbarTotalWidth;

    // Fullscreen (max-view) button sits just left of the pause button
    this.layout.fsBtnX = this.layout.pauseBtnX - 80;
    // Field-guide (encyclopedia) toggle sits just left of the fullscreen button
    this.layout.guideBtnX = this.layout.fsBtnX - 80;

    // Fullscreen overlay HUD layout: the HUD is drawn over the maximised play
    // area, but the top-bar essentials, the fullscreen/pause buttons and the
    // goals panel all sit exactly where they do in the docked full UI, so
    // nothing jumps when toggling fullscreen. (Toggling fullscreen only
    // changes the view transform, not gameAreaWidth/rightSidebarX, so the
    // docked positions computed above are still valid here.) The focus-species
    // population toggles sit *below* the goals panel — see
    // renderFocusSpeciesButtons. The placeables toolbar runs along the bottom.
    const contentY = 20; // matches renderTopBar's docked contentY
    this.layout.fs = {
      stripY: contentY,
      btnY: this.layout.pauseBtnY,
      btnSize: this.layout.pauseBtnSize,
      // Top-bar elements at their docked positions (centred in the game area).
      mauriX: this.layout.mauriX,
      seasonX: this.layout.seasonX,
      timerX: this.layout.timerX,
      clockX: this.layout.clockX,
      ringCX: this.layout.ringCX,
      ringCY: this.layout.ringCY,
      ringR: this.layout.ringR,
      mauriRingCX: this.layout.mauriRingCX,
      mauriRingCY: this.layout.mauriRingCY,
      mauriRingR: this.layout.mauriRingR,
      popDialCX: this.layout.popDialCX,
      popDialCY: this.layout.popDialCY,
      popDialR: this.layout.popDialR,
      fsBtnX: this.layout.fsBtnX,
      guideBtnX: this.layout.guideBtnX,
      pauseBtnX: this.layout.pauseBtnX,
      // Goals in the same spot as the docked sidebar's goals panel (top of the
      // right sidebar column).
      goalsX: this.config.rightSidebarX + this.layout.sidebarPadding,
      goalsY: this.layout.sidebarPadding,
      toolbarStartX: (this.config.canvasWidth - toolbarTotalWidth) / 2,
      toolbarY: this.config.canvasHeight - this.layout.toolbarBtnSize - 35
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

    // Check guide / pause / fullscreen button clicks first (top bar area)
    if (my >= this.topBar.y && my < this.topBar.y + this.topBar.height) {
      if (this.handleGuideButtonClick(mx, my)) return true;
      if (this.handlePauseButtonClick(mx, my)) return true;
      if (this.handleFullscreenButtonClick(mx, my)) return true;
    }

    // Docked field guide, when open, takes clicks that land inside its panel.
    if (this.game.encyclopedia && this.game.encyclopedia.open &&
        this.game.encyclopedia.pointerOverPanel(mx, my)) {
      this.game.encyclopedia.handleDockedClick(mx, my);
      return true;
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

    if (this._inRect(mx, my, fs.guideBtnX, fs.btnY, bs, bs)) {
      if (this.game.encyclopedia) this.game.encyclopedia.toggle(this.game);
      return true;
    }
    if (this._inRect(mx, my, fs.fsBtnX, fs.btnY, bs, bs)) {
      this.game.toggleFullscreen();
      return true;
    }
    if (this._inRect(mx, my, fs.pauseBtnX, fs.btnY, bs, bs)) {
      this._togglePause();
      return true;
    }

    // Docked field guide, when open, takes clicks inside its panel.
    if (this.game.encyclopedia && this.game.encyclopedia.open &&
        this.game.encyclopedia.pointerOverPanel(mx, my)) {
      this.game.encyclopedia.handleDockedClick(mx, my);
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
    // "Total eagles" row toggles the eagle highlight (and eagle call)
    if (this._eagleRowBounds) {
      const b = this._eagleRowBounds;
      if (this._inRect(mx, my, b.x, b.y, b.w, b.h)) {
        this._toggleEagleHighlight();
        return true;
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

    // Mauri counter — a large circular dial just left of the season ring.
    this.renderMauriRing(this.layout.mauriRingCX, this.layout.mauriRingCY, this.layout.mauriRingR);

    // Unified season/year/time ring (replaces the season panel, TIME panel and
    // level-countdown dial — one element for season progress, the year and the level).
    this.renderSeasonRing(this.layout.ringCX, this.layout.ringCY, this.layout.ringR);

    // Ecosystem dial (endless): avg population + balance + mauri/sec, right of the ring.
    if (this.game.currentLevel && this.game.currentLevel.endless) {
      this.renderPopDial(this.layout.popDialCX, this.layout.popDialCY, this.layout.popDialR);
    }

    // Field-guide + fullscreen + pause buttons (right edge, before sidebar)
    this.renderGuideButton(this.layout.guideBtnX, this.layout.pauseBtnY);
    this.renderFullscreenButton(this.layout.fsBtnX, this.layout.pauseBtnY);
    this.renderPauseButton(this.layout.pauseBtnX, this.layout.pauseBtnY);

    // (The seasonal message/subtitle info bar was removed — important one-off events go
    // to the event log via notifications instead of a persistent bar.)
  }

  // ==========================================
  // FULLSCREEN OVERLAY HUD
  // Drawn over the maximised play area: the top-bar essentials (no hint row),
  // the goals panel, and the placeables toolbar. Panels are translucent.
  // ==========================================

  renderFullscreenOverlay() {
    const fs = this.layout.fs;

    this.renderMauriRing(fs.mauriRingCX, fs.mauriRingCY, fs.mauriRingR);
    this.renderSeasonRing(fs.ringCX, fs.ringCY, fs.ringR);
    if (this.game.currentLevel && this.game.currentLevel.endless) {
      this.renderPopDial(fs.popDialCX, fs.popDialCY, fs.popDialR);
    }
    this.renderGuideButton(fs.guideBtnX, fs.btnY);
    this.renderFullscreenButton(fs.fsBtnX, fs.btnY);
    this.renderPauseButton(fs.pauseBtnX, fs.btnY);

    // Extend the goals panel's own green backing 12px past the content on
    // every side (same colour as the panel body, so it reads as one panel).
    const goalsH = 30 + this.game.goals.length * 26;
    fill(30, 45, 38, 220);
    noStroke();
    rect(fs.goalsX - 12, fs.goalsY - 12,
         this.layout.sidebarPanelWidth + 24, goalsH + 24, 10);

    this.renderGoalsPanel(fs.goalsX, fs.goalsY);

    // Focus-species population toggles sit directly below the goals panel.
    this.renderFocusSpeciesButtons();

    // Right-column bottom so far (below the focus row); the raid panel + field guide
    // stack under it in order.
    let colBottom = this._fsFocusBottomY || (fs.goalsY + goalsH + 24);

    // Nest Raid (or, in the kākā mast-goal year, the Mast Year progress bar in its
    // place): a NON-MODAL panel below the focus row, above the field guide.
    if (this.game._mastGoalPanelActive && this.game._mastGoalPanelActive()) {
      const rh = Math.round(this.layout.eventLogHeight / 2);
      const ry = colBottom + 12;
      this.game._renderMastGoalPanel(fs.goalsX, ry, this.layout.sidebarPanelWidth, rh);
      colBottom = ry + rh;
    } else if (this.game._raidPanelActive && this.game._raidPanelActive()) {
      const rh = Math.round(this.layout.eventLogHeight / 2);
      const ry = colBottom + 12;
      this.game._renderRaidPanel(fs.goalsX, ry, this.layout.sidebarPanelWidth, rh);
      colBottom = ry + rh;
    }

    // Field guide docks below (the focus row, or the raid panel when it's open).
    if (this.game.encyclopedia && this.game.encyclopedia.open) {
      const gy = colBottom + 12;
      const gh = this.config.canvasHeight - gy - 20;
      this.game.encyclopedia.renderDocked(
        fs.goalsX, gy, this.layout.sidebarPanelWidth, gh, { translucent: true }
      );
    }

    this.renderToolbar(fs.toolbarStartX, fs.toolbarY);
  }

  // Fullscreen-only quick toggles for the level's focus species (directly
  // below the goals panel): idle sprite + live population. Clicking toggles
  // the in-world highlight; while active the button is framed and softly
  // filled in the species' highlight colour.
  renderFocusSpeciesButtons() {
    this._fsFocusBtnBounds = [];
    // Free Play shows THIS YEAR'S focus species (rotates — may be kea/kākā/kākāpō),
    // not the static focal moa. Other levels use their explicit focal list, else the
    // moa roster (so the toggles exist everywhere in fullscreen).
    let focal = null;
    if (this.game && this.game.freeplayFocus && this.game.freeplayFocus.length) {
      focal = this.game.freeplayFocus;
    } else {
      focal = (typeof LEVEL_MECHANICS !== 'undefined' && LEVEL_MECHANICS.focalSpecies) ||
        ((this.simulation.activeSpecies && this.simulation.activeSpecies.moa) || null);
    }

    // Endless keystone moa: a Free Play run ends only when EVERY moa is gone, so the
    // keystone moa (upland + little bush — the level's focalSpecies) are what actually
    // gate a game over. The year's focus rotates onto birds (kea/kākāpō), which never
    // trigger a loss, so ALWAYS surface these moa here too — as a survival group, and
    // de-duplicated against any already shown as this year's focus.
    let survival = [];
    if (this.game && this.game.currentLevel && this.game.currentLevel.endless) {
      const M = (typeof LEVEL_MECHANICS !== 'undefined') ? LEVEL_MECHANICS : {};
      const keystone = (M.focalSpecies || ['upland_moa', 'little_bush_moa'])
        .filter(k => typeof MOA_SPECIES !== 'undefined' && !!MOA_SPECIES[k]);
      survival = keystone.filter(k => !focal || !focal.includes(k));
    }

    if ((!focal || !focal.length) && !survival.length) {
      // No focus row — the guide (if open) docks straight below the goals panel.
      const goalsH0 = 30 + this.game.goals.length * 26;
      this._fsFocusBottomY = this.layout.fs.goalsY + goalsH0 + 24;
      return;
    }

    // Tiles to draw: the year's rotating focus first, then the keystone survival moa
    // (flagged so they draw distinctly, separated by a small gap).
    const tiles = (focal || []).map(k => ({ key: k, survival: false }))
      .concat(survival.map(k => ({ key: k, survival: true })));

    // Sit the row just below the goals panel, left-aligned to the same column.
    // The goals panel has a 12px translucent backing skirt around it, so start
    // a little further down to clear it.
    const fs = this.layout.fs;
    const goalsH = 30 + this.game.goals.length * 26;
    const size = 70, gap = 10;
    let x = fs.goalsX;
    const y = fs.goalsY + goalsH + 24;
    let sepAdded = false;

    for (const t of tiles) {
      const key = t.key, isSurvival = t.survival;
      if (isSurvival && !sepAdded) { x += gap; sepAdded = true; }   // separate the survival group
      const isMoa = (typeof MOA_SPECIES !== 'undefined' && !!MOA_SPECIES[key]);
      const regSp = (!isMoa && typeof REGISTRY !== 'undefined' && REGISTRY.getSpecies) ? REGISTRY.getSpecies(key) : null;
      const cfg = isMoa ? MOA_SPECIES[key] : ((regSp && regSp.config) || {});
      const active = typeof SPECIES_HIGHLIGHT !== 'undefined' && SPECIES_HIGHLIGHT.has(key);
      const hc = cfg.highlightColor || [255, 235, 120];

      if (active) {
        fill(hc[0] * 0.25, hc[1] * 0.25, hc[2] * 0.25, 225);
        stroke(hc[0], hc[1], hc[2]);
        strokeWeight(3);
      } else if (isSurvival) {
        // Warm amber frame marks the keystone-survival group (lose all and it's game over).
        fill(58, 42, 30, 210);
        stroke(220, 138, 74);
        strokeWeight(2);
      } else {
        fill(35, 55, 40, 200);
        stroke(70, 110, 80);
        strokeWeight(1);
      }
      rect(x, y, size, size, 10);

      // Short name so a rotating focus reads (kea vs a moa).
      const name = (isMoa ? cfg.displayName : (regSp && regSp.displayName)) || key;
      noStroke(); fill(214, 230, 214); textAlign(CENTER, TOP); textSize(9);
      text(name.length > 12 ? name.slice(0, 11) + '…' : name, x + size / 2, y + 4);

      if (isMoa) {
        // Idle sprite — the species' own art; generic art gets the species tint.
        const set = (cfg.spriteSet && EntitySprites.moaVariants[cfg.spriteSet]) || EntitySprites.moa;
        const sprite = EntitySprites.isValid(set.idle) ? set.idle : EntitySprites.moa.idle;
        if (EntitySprites.isValid(sprite)) {
          push();
          imageMode(CENTER);
          const s = Math.min(40 / sprite.width, 40 / sprite.height);
          if (!cfg.spriteSet && cfg.tint) tint(cfg.tint[0], cfg.tint[1], cfg.tint[2]);
          image(sprite, x + size / 2, y + size / 2 - 4, sprite.width * s, sprite.height * s);
          pop();
        }
      } else {
        // Bird focus species — its own sprite (kea/kākā/kākāpō/kōkako, keyed the
        // same as EntitySprites.flyers). A species without dedicated art keeps the
        // simple coloured marker as a fallback.
        const birdSprite = (typeof EntitySprites !== 'undefined' && EntitySprites.flyers)
          ? EntitySprites.flyers[key] : null;
        if (EntitySprites.isValid(birdSprite)) {
          push();
          imageMode(CENTER);
          const s = Math.min(44 / birdSprite.width, 44 / birdSprite.height);
          image(birdSprite, x + size / 2, y + size / 2 - 4, birdSprite.width * s, birdSprite.height * s);
          pop();
        } else {
          push(); noStroke();
          fill(hc[0], hc[1], hc[2]); ellipse(x + size / 2, y + size / 2 - 2, 24, 19);
          fill(hc[0] * 0.6 + 20, hc[1] * 0.6 + 20, hc[2] * 0.6 + 20);
          ellipse(x + size / 2 + 7, y + size / 2 - 8, 11, 11);
          pop();
        }
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
      textFont(FreckleFace);
      text(count, x + size / 2, y + size - 2);
      pop();

      // Keystone badge — a small amber "!" disc so the survival group reads at a glance
      // as "lose all of these and the run ends", distinct from the year's focus tiles.
      if (isSurvival) {
        push();
        noStroke();
        fill(220, 138, 74);
        ellipse(x + size - 11, y + 11, 16, 16);
        fill(30, 22, 14);
        textAlign(CENTER, CENTER); textSize(12);
        push(); textFont(FreckleFace);
        text('!', x + size - 11, y + 10);
        pop();
        pop();
      }

      this._fsFocusBtnBounds.push({ key, x, y, size });
      x += size + gap;
    }
    // Where the right-column content ends, for docking the field guide below it.
    this._fsFocusBottomY = y + size;
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
    smallTextSize(12);
    textAlign(LEFT, TOP);
    text("Mauri", x + 60, y + 12);

    // Value
    fill(120, 255, 150);
    textSize(32);
    push();
    textFont(FreckleFace);
    text(Math.floor(this.mauri.mauri), x + 60, y + 28);
    pop();
  }

  // Mauri counter as a large circular DIAL, styled to sit next to the season/year ring
  // (same backing disc). A green accent ring, a small "MAURI" label, and the value big
  // in the centre. Replaces the old rectangular counter.
  renderMauriRing(cx, cy, r) {
    const val = Math.floor(this.mauri.mauri);
    push();
    ellipseMode(CENTER);

    // Backing disc (matches renderSeasonRing's ground so the two read as a pair).
    noStroke();
    fill(22, 32, 27, 215);
    circle(cx, cy, r * 2);

    // Green accent ring.
    noFill();
    stroke(100, 200, 130, 225);
    strokeWeight(r * 0.10);
    circle(cx, cy, r * 2 - r * 0.14);

    // Label.
    noStroke();
    fill(150, 190, 160);
    textAlign(CENTER, CENTER);
    smallTextSize(11);
    text('MAURI', cx, cy - r * 0.44);

    // Value — scaled down for longer numbers so it never spills the disc.
    const str = String(val);
    // Nudge the value up a touch (endless) to make room for the gain/sec line below.
    const g = this.game;
    const showGain = !!(g && g.currentLevel && g.currentLevel.endless && g.ecosystemStats);
    const valY = showGain ? cy + r * 0.02 : cy + r * 0.12;
    let ts = r * 0.62;
    if (str.length >= 4) ts = r * 0.40;
    else if (str.length === 3) ts = r * 0.52;
    fill(120, 255, 150);
    push();
    textFont(FreckleFace);
    textSize(ts);
    text(str, cx, valY);
    pop();

    // Live mauri gain/sec under the counter (endless economy readout). Shares the
    // passive-income driver with the AVG POP dial (Game.ecosystemStats().mauriPerSec).
    if (showGain) {
      const mps = g.ecosystemStats().mauriPerSec || 0;
      fill(150, 200, 165);
      smallTextSize(12);
      text(`${mps >= 0 ? '+' : ''}${mps.toFixed(1)}/s`, cx, cy + r * 0.56);
    }

    pop();
  }

  // Ecosystem dial (endless): a ring whose arc fills with BALANCE (how even the
  // populations are, 0→1) and whose colour runs red (uneven) → green (even), like the
  // hunger bar. AVG POP sits big in the centre; below it the EQUALITY COEFFICIENT (the
  // applied balance term) — the mauri/sec readout now lives under the MAURI counter.
  renderPopDial(cx, cy, r) {
    const g = this.game;
    if (!g.ecosystemStats) return;
    const s = g.ecosystemStats();
    const bal = Math.max(0, Math.min(1, s.balance || 0));
    // red (uneven) → green (even).
    const col = [Math.round(lerp(214, 110, bal)), Math.round(lerp(74, 205, bal)), Math.round(lerp(60, 120, bal))];

    push();
    ellipseMode(CENTER);
    noStroke();
    fill(22, 32, 27, 215);
    circle(cx, cy, r * 2);

    // Track + balance arc (12 o'clock, clockwise).
    const RW = r * 0.14, d = (r - RW * 0.7) * 2, TOP = -HALF_PI;
    noFill();
    strokeCap(ROUND);
    stroke(60, 72, 64, 180); strokeWeight(RW);
    circle(cx, cy, d);
    if (bal > 0.001) {
      stroke(col[0], col[1], col[2]); strokeWeight(RW);
      arc(cx, cy, d, d, TOP, TOP + bal * TWO_PI);
    }

    // Centre: label, avg pop (big), and the equality coefficient (the applied balance).
    noStroke();
    textAlign(CENTER, CENTER);
    fill(150, 175, 155); smallTextSize(10);
    text('AVG POP', cx, cy - r * 0.44);
    fill(col[0], col[1], col[2]);
    push(); textFont(FreckleFace); textSize(r * 0.6);
    text(Math.round(s.avgPop || 0), cx, cy + r * 0.02); pop();
    fill(col[0], col[1], col[2]); smallTextSize(10);
    text(`eq ${bal.toFixed(2)}`, cx, cy + r * 0.44);
    pop();
  }

  // Unified season / year / time DIAL. One element in place of the old season
  // panel + TIME panel + level-countdown dial:
  //   • outer ring = the four seasons as coloured quadrants (summer top-right,
  //     clockwise); the CURRENT season is full strength, the rest dimmed, and a
  //     bright notch rides the exact point reached in the year (season progress).
  //   • endless levels add an inner ring = the four-year tour (≈ terrain
  //     quadrants); the current year's segment lights up, advancing one per year.
  //   • centre: era (static per level), season name, "YEAR n", and mm:ss.
  // For a single-year timed level the outer sweep IS the level's progress.
  renderSeasonRing(cx, cy, R) {
    const sm = this.seasonManager;
    if (!sm || !sm.current) return;
    const order = sm.seasonOrder;
    const curIdx = sm.currentSeasonIndex | 0;
    const prog = Math.max(0, Math.min(1, sm.progress || 0));
    const g = this.game;
    const level = g.currentLevel || g.level || g.levelConfig || {};
    const endless = !!level.endless;
    const cycle = (g.cycle | 0);

    const RW = R * 0.16;                    // season-ring thickness
    const ringD = (R - RW * 0.5) * 2;       // diameter the arc stroke is centred on
    const gapA = 0.055;                     // gap (rad) between season arcs
    const TOP = -HALF_PI;                   // 12 o'clock; summer starts here (→ top-right)

    push();
    ellipseMode(CENTER);

    // Backing disc so the centre text reads over the busy terrain.
    noStroke();
    fill(22, 32, 27, 205);
    circle(cx, cy, (R - RW) * 2 + 6);

    // Four season arcs. Current season full strength; the others dim.
    strokeCap(ROUND);
    for (let i = 0; i < 4; i++) {
      const col = color(SEASONS[order[i]].color);
      const a0 = TOP + i * HALF_PI + gapA;
      const a1 = TOP + (i + 1) * HALF_PI - gapA;
      noFill();
      stroke(red(col), green(col), blue(col), i === curIdx ? 255 : 90);
      strokeWeight(i === curIdx ? RW * 1.15 : RW);
      arc(cx, cy, ringD, ringD, a0, a1);
    }

    // Progress notch: a bright dot at the current point in the year.
    const pAng = TOP + ((curIdx + prog) / 4) * TWO_PI;
    noStroke();
    fill(245, 250, 240);
    circle(cx + Math.cos(pAng) * (ringD / 2), cy + Math.sin(pAng) * (ringD / 2), RW * 0.9);

    // Endless: inner four-year tour ring (≈ terrain quadrants), current year lit. Year 1
    // lights the BOTTOM-RIGHT quadrant (the starting map area), then advances clockwise —
    // hence the +1 offset from the raw cycle (arc i=1 spans 3→6 o'clock).
    if (endless) {
      const iD = (R - RW * 2.1) * 2;
      const tourIdx = (((cycle % 4) + 4) % 4 + 1) % 4;
      strokeWeight(R * 0.09);
      for (let i = 0; i < 4; i++) {
        noFill();
        if (i === tourIdx) stroke(210, 225, 190); else stroke(120, 135, 120, 90);
        arc(cx, cy, iD, iD, TOP + i * HALF_PI + 0.12, TOP + (i + 1) * HALF_PI - 0.12);
      }
    }

    // ---- centre text ---------------------------------------------------------
    const season = sm.current;
    textAlign(CENTER, CENTER);
    noStroke();

    let era = (level.menu && level.menu.subtitle) ? level.menu.subtitle : '';
    era = era.replace(/^[~\s]+/, '').toUpperCase();
    if (era) { fill(150, 175, 155); smallTextSize(9); text(era, cx, cy - R * 0.46); }

    const sc = color(season.color);
    fill(red(sc), green(sc), blue(sc));
    push(); textFont(FreckleFace); textSize(21); text(season.name.toUpperCase(), cx, cy - R * 0.13); pop();

    fill(200, 220, 205);
    smallTextSize(11);
    text('YEAR ' + (cycle + 1), cx, cy + R * 0.17);

    const secs = Math.floor(g.playTime / 60);
    const timeStr = Math.floor(secs / 60) + ':' + (secs % 60).toString().padStart(2, '0');
    fill(205, 240, 215);
    push(); textFont(FreckleFace); textSize(19); text(timeStr, cx, cy + R * 0.45); pop();

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
    smallTextSize(11);
    textAlign(CENTER, TOP);
    text("TIME", x + 60, y + 10);

    // Time value
    fill(200, 240, 210);
    textSize(28);
    push();
    textFont(FreckleFace);
    textAlign(CENTER, TOP);
    text(timeStr, x + 60, y + 28);
    pop();
  }

  /**
   * Resolve the active level's time limit, in FRAMES (playTime's own unit).
   * Levels declare this as e.g. `timeLimit: 14400` (4 min @ 60fps).
   *
   * The level config may hang off the game object under a few different
   * names depending on how it was loaded, so check the likely ones and fall
   * back to a bare `game.timeLimit` if the game copies it up. Returns null
   * for an untimed level, in which case no pie is drawn.
   */
  _levelTimeLimitFrames() {
    const g = this.game;
    const level = g.level || g.currentLevel || g.levelConfig || g.levelData;

    if (level && level.timeLimit != null) return level.timeLimit;
    if (g.timeLimit != null) return g.timeLimit;
    if (LEVEL_CLOCK.fallbackSeconds != null) return LEVEL_CLOCK.fallbackSeconds * 60;
    return null;
  }

  /**
   * How much of the level is left.
   * Returns { remaining, total, fraction } with times in SECONDS (for the
   * readout) and fraction in 0..1 (1 = level just started, 0 = time up),
   * or null if the level is untimed.
   */
  _levelTimeRemaining() {
    const totalFrames = this._levelTimeLimitFrames();
    if (!totalFrames || totalFrames <= 0) return null;

    const remainingFrames = Math.max(0, totalFrames - this.game.playTime);

    return {
      remaining: remainingFrames / 60,
      total: totalFrames / 60,
      fraction: remainingFrames / totalFrames
    };
  }

  /**
   * Level countdown pie, drawn to the right of the TIME panel.
   * The filled wedge is the proportion of the LEVEL still remaining - it
   * starts as a full disc and is eaten away clockwise from 12 o'clock,
   * reaching nothing exactly as the level ends. It shows no minutes and has
   * no moving hand; the only thing it encodes is "how much level is left".
   *
   * x, y is the top-left of a LEVEL_CLOCK.size square, matching the 70px
   * height of its neighbouring panels.
   */
  renderLevelClock(x, y, size = LEVEL_CLOCK.size) {
    if (!LEVEL_CLOCK.enabled) return;

    const t = this._levelTimeRemaining();
    if (!t) return;   // untimed level - nothing to count down
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size / 2 - 4;

    // Urgency colour: calm -> amber -> red as the wedge shrinks
    let col = LEVEL_CLOCK.calmColor;
    if (t.fraction <= LEVEL_CLOCK.dangerAt) col = LEVEL_CLOCK.dangerColor;
    else if (t.fraction <= LEVEL_CLOCK.warnAt) col = LEVEL_CLOCK.warnColor;

    // Pulse the wedge inside the danger band (steady once time is actually up)
    let wedgeAlpha = 255;
    if (t.fraction <= LEVEL_CLOCK.dangerAt && t.remaining > 0) {
      const phase = (this.game.playTime / 60) * TWO_PI * LEVEL_CLOCK.pulseHz;
      wedgeAlpha = 165 + 90 * ((Math.sin(phase) + 1) / 2);
    }

    push();

    // Spent portion: the whole disc, left exposed as the wedge retreats
    noStroke();
    fill(LEVEL_CLOCK.spentColor[0], LEVEL_CLOCK.spentColor[1],
         LEVEL_CLOCK.spentColor[2], LEVEL_CLOCK.spentColor[3]);
    ellipse(cx, cy, r * 2, r * 2);

    // Remaining slice, depleting clockwise from 12 o'clock.
    // p5 won't close a full-circle arc cleanly, so draw a plain disc when
    // the level has barely started.
    if (t.fraction >= 0.999) {
      fill(col[0], col[1], col[2], wedgeAlpha);
      ellipse(cx, cy, r * 2, r * 2);
    } else if (t.fraction > 0.001) {
      fill(col[0], col[1], col[2], wedgeAlpha);
      arc(cx, cy, r * 2, r * 2, -HALF_PI, -HALF_PI + TWO_PI * t.fraction, PIE);
    }

    // Outer ring, so an empty or nearly-empty pie still reads as a dial
    noFill();
    stroke(LEVEL_CLOCK.faceStroke[0], LEVEL_CLOCK.faceStroke[1],
           LEVEL_CLOCK.faceStroke[2]);
    strokeWeight(1.5);
    ellipse(cx, cy, r * 2, r * 2);

    // Numeric readout once things get tight
    if (LEVEL_CLOCK.showNumbersWhenLow && t.fraction <= LEVEL_CLOCK.warnAt) {
      const m = Math.floor(t.remaining / 60);
      const s = Math.floor(t.remaining % 60);
      const label = `${m}:${s.toString().padStart(2, '0')}`;

      // Knock the centre back so the label stays legible over the wedge
      noStroke();
      fill(20, 32, 26, 215);
      ellipse(cx, cy + 1, 44, 22);

      fill(col[0], col[1], col[2]);
      textAlign(CENTER, CENTER);
      textSize(15);
      push();
      textFont(FreckleFace);
      text(label, cx, cy + 1);
      pop();
    }

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
      smallTextSize(11);
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

  // Field-guide (encyclopedia) toggle. A little open-book glyph; framed/tinted
  // while the guide is open. Sits left of the fullscreen button in both the docked
  // top bar and the fullscreen overlay.
  renderGuideButton(x, y) {
    const size = this.layout.pauseBtnSize;
    const isHovered = mouseX > x && mouseX < x + size &&
                      mouseY > y && mouseY < y + size;
    const isOpen = !!(this.game.encyclopedia && this.game.encyclopedia.open);

    if (isOpen) {
      fill(46, 78, 56);
      stroke(120, 180, 140);
      strokeWeight(2);
    } else if (isHovered) {
      fill(50, 85, 60);
      stroke(100, 160, 120);
      strokeWeight(2);
    } else {
      fill(35, 55, 40, 200);
      stroke(70, 110, 80);
      strokeWeight(1);
    }
    rect(x, y, size, size, 10);

    // Open-book icon
    const cx = x + size / 2;
    const cy = y + size / 2;
    const bw = 24, bh = 18;
    stroke(190, 210, 195);
    strokeWeight(2);
    noFill();
    // spine + two page fans
    line(cx, cy - bh / 2, cx, cy + bh / 2);
    beginShape(); vertex(cx, cy - bh / 2); vertex(cx - bw / 2, cy - bh / 2 + 3);
    vertex(cx - bw / 2, cy + bh / 2); vertex(cx, cy + bh / 2 - 2); endShape();
    beginShape(); vertex(cx, cy - bh / 2); vertex(cx + bw / 2, cy - bh / 2 + 3);
    vertex(cx + bw / 2, cy + bh / 2); vertex(cx, cy + bh / 2 - 2); endShape();
    // faint page lines
    stroke(190, 210, 195, 120); strokeWeight(1);
    line(cx - bw / 2 + 3, cy - 3, cx - 3, cy - 4);
    line(cx + 3, cy - 4, cx + bw / 2 - 3, cy - 3);
    noStroke();

    // Label under the icon (small), so the toggle reads
    fill(isOpen ? [180, 220, 190] : [150, 180, 160]);
    textAlign(CENTER, TOP); smallTextSize(9);
    text('Guide', cx, y + size - 13);
  }

  handleGuideButtonClick(mx, my) {
    const x = this.layout.guideBtnX;
    const y = this.layout.pauseBtnY;
    const size = this.layout.pauseBtnSize;
    if (mx > x && mx < x + size && my > y && my < y + size) {
      if (this.game.encyclopedia) this.game.encyclopedia.toggle(this.game);
      return true;
    }
    return false;
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
        text: 'Spring: Plants regrow, and territory expands uphill.',
        subtext: moaCount < CONFIG.maxMoaPopulation * 0.2
          ? 'Moa are dwindling! encourage breeding with nesting sites.'
          : 'The subalpine region is warm enough for Upland species again.',
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

      // Icon (origin is already the centre of the icon circle)
      this.renderPlaceableIcon(def, 0, 0, 30, 20, canAfford ? 240 : 100);

      // Storm recharge: clock-style sweep over the icon circle. The shaded
      // wedge covers the remaining cooldown and its edge advances clockwise
      // from 12 o'clock until the storm is ready again.
      if (type === 'Storm') {
        const cdRemaining = (this.game._stormCooldownUntil || 0) - this.game.playTime;
        if (cdRemaining > 0) {
          const cdTotal = this.game._stormCooldownDuration || 600;
          const elapsed = constrain(1 - cdRemaining / cdTotal, 0, 1);
          fill(15, 20, 25, 170);
          noStroke();
          arc(0, 0, 36, 36, -HALF_PI + elapsed * TWO_PI, -HALF_PI + TWO_PI, PIE);
        }
      }
      pop();

      // Cost
      fill(canAfford ? 180 : 255, canAfford ? 255 : 120, canAfford ? 190 : 120);
      noStroke();
      smallTextSize(12);
      textAlign(CENTER, TOP);
      text(def.cost, x + btnSize / 2, btnY + btnSize - 20);

      // Hotkey number
      fill(100, 130, 110);
      smallTextSize(10);
      textAlign(CENTER, TOP);
      text(i + 1, x + btnSize / 2, btnY + btnSize + 5);

      // Tooltip on hover
      if (isHovered) {
        this.renderToolTooltip(x + btnSize / 2, btnY - 10, def);
      }

      i++;
    }
  }

  // Draws a placeable's palette icon centred on (cx, cy): pixel art when the
  // definition names an `iconSprite`, otherwise the emoji glyph. spriteSize and
  // glyphSize are separate because the art fills more of the circle than text.
  renderPlaceableIcon(def, cx, cy, spriteSize, glyphSize, alpha = 255) {
    const sprite = def.iconSprite ? placeableSprites.icons[def.iconSprite] : null;

    if (sprite && sprite.width > 0) {
      push();
      imageMode(CENTER);
      tint(255, alpha);
      image(sprite, cx, cy, spriteSize, spriteSize);
      pop();
      return;
    }

    fill(255, 255, 255, alpha);
    textSize(glyphSize);
    textAlign(CENTER, CENTER);
    text(def.icon, cx, cy);
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
    smallTextSize(13);
    textAlign(LEFT, TOP);
    text(def.name, x + 10, y + 8);

    // Description
    fill(150, 180, 160);
    smallTextSize(10);
    text(def.description, x + 10, y + 28);

    // Stats
    fill(120, 150, 130);
    smallTextSize(9);
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
    this.renderPlaceableIcon(def, adjustedX + 35, y + 35, 34, 22);

    // Name and cost
    fill(200, 240, 210);
    textSize(14);
    textAlign(LEFT, TOP);
    text(def.name, adjustedX + 65, y + 12);

    fill(140, 255, 160);
    smallTextSize(12);
    text(`Cost: ${def.cost} mauri`, adjustedX + 65, y + 32);

    // Instruction
    fill(140, 170, 150);
    smallTextSize(10);
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

    // Section 1b: Nest Raid — a NON-MODAL panel below goals, above population (half the
    // event log's height). Only present while the tool has toggled it open. In the kākā
    // mast-goal year the Mast Year progress bar takes this same slot instead.
    if (this.game._mastGoalPanelActive && this.game._mastGoalPanelActive()) {
      const rh = Math.round(this.layout.eventLogHeight / 2);
      this.game._renderMastGoalPanel(x + padding, y + 12, this.layout.sidebarPanelWidth, rh);
      y = y + 12 + rh;
    } else if (this.game._raidPanelActive && this.game._raidPanelActive()) {
      const rh = Math.round(this.layout.eventLogHeight / 2);
      this.game._renderRaidPanel(x + padding, y + 12, this.layout.sidebarPanelWidth, rh);
      y = y + 12 + rh;
    }

    // Section 2: Species Info (population) — swapped ABOVE the event log.
    y = this.renderSpeciesInfo(x + padding, y + 12);

    // Section 3: Event Log — swapped BELOW the population panel.
    y = this.renderEventLog(x + padding, y + 12);

    // Section 4: Mini Map
    this.renderMiniMap(x + padding, y + 12);

    // Section 5: Field guide (docked below the rest, when toggled open)
    if (this.game.encyclopedia && this.game.encyclopedia.open) {
      const gy = y + 12;
      const gh = this.sidebar.y + this.sidebar.height - gy - padding;
      this.game.encyclopedia.renderDocked(
        x + padding, gy, this.layout.sidebarPanelWidth, gh, { translucent: false }
      );
    }
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
    smallTextSize(10);
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
      smallTextSize(12);
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
      smallTextSize(9);
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
    const lineHeight = 34 + SMALL_TEXT_BUMP;

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
      smallTextSize(13);
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
      smallTextSize(8);
      textAlign(RIGHT, TOP);
      text(msgAge === 0 ? 'now' : `${msgAge}s`, x + panelWidth - 10, msgY + 2);

      msgY += lineHeight;
      if (msgY > y + panelHeight - 25) break;
    }

    // Empty state
    if (messages.length === 0) {
      fill(80, 100, 90);
      smallTextSize(11);
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
    // Flighted birds present this year join the grid too, so the panel grows to fit them.
    const _birdKeysAll = (this.simulation.activeSpecies && this.simulation.activeSpecies.other) || [];
    let _nPresentBirds = 0;
    for (const k of _birdKeysAll) if (this.simulation.getSpeciesCount(k) > 0) _nPresentBirds++;
    const _speciesRowCount = Math.max(1, Math.ceil((_nMoaSpecies + _nPresentBirds) / 2));
    const panelHeight = this.layout.speciesPanelHeight +
      Math.max(0, _speciesRowCount - 2) * (28 + SMALL_TEXT_BUMP * 2);

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

    // Flighted birds present this year, shown alongside the moa (kea/kākā/kākāpō/kōkako/kererū).
    const _BIRD_LABEL = { kea: 'Kea', kaka: 'Kākā', kakapo: 'Kākāpō', kokako: 'Kōkako', kereru: 'Kererū' };
    const _BIRD_ICON = { kea: '🦜', kaka: '🦜', kakapo: '🦜', kokako: '🐦', kereru: '🐦' };
    for (const k of _birdKeysAll) {
      if (_speciesRows.length >= 12) break;
      const c = this.simulation.getSpeciesCount(k);
      if (c <= 0) continue;
      const reg = (typeof REGISTRY !== 'undefined' && REGISTRY.getSpecies) ? REGISTRY.getSpecies(k) : null;
      const cfg = (reg && reg.config) || {};
      _speciesRows.push({
        key: k,
        icon: _BIRD_ICON[k] || '🐦',
        label: _BIRD_LABEL[k] || (reg && reg.displayName) || k,
        value: c,
        color: cfg.highlightColor || [200, 190, 150],
        highlightColor: cfg.highlightColor
      });
    }

    // Population stats — 5 rows x 2 columns, row-major. Each row holds a
    // small label over a value, so row height grows with the text bump
    // (label line + value offset each gain SMALL_TEXT_BUMP).
    let statY = y + 42;
    const rowH = 28 + SMALL_TEXT_BUMP * 2;
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
    this._renderEagleRow(col2X, statY, _rowW, stats.eagles);
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
      // Bar shows food security (fullness = how well fed the herd is)
      const avgFed = 100 - avgHunger;

      fill(140, 160, 150);
      smallTextSize(12);
      textAlign(LEFT, TOP);
      text(`Avg fed: ${avgFed.toFixed(0)}%`, col1X, statY);

      // Fed bar (adapts to panel width; sits under the small label)
      const barW = panelWidth - 30;
      const barY = statY + 16 + SMALL_TEXT_BUMP;

      fill(50, 40, 40);
      noStroke();
      rect(col1X, barY, barW, 8, 4);

      // Color based on food security: green when fed, red when low
      let hr = avgFed > 70 ? 100 : (avgFed > 40 ? 200 : 220);
      let hg = avgFed > 70 ? 200 : (avgFed > 40 ? 200 : 100);
      let hb = 100;
      // Under 1/4 fed: pulse the bar red as an extra warning
      if (avgFed < 25) {
        const _pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.12);
        hr = 180 + _pulse * 75;
        hg = 60 + _pulse * 40;
        hb = 60;
      }
      fill(hr, hg, hb);
      rect(col1X, barY, barW * (avgFed / 100), 8, 4);

      // Fed level text
      fill(120, 140, 130);
      smallTextSize(8);
      textAlign(RIGHT, TOP);
      const hungerStatus = avgFed > 70 ? 'Well Fed' : (avgFed > 40 ? 'Hungry' : 'Starving!');
      text(hungerStatus, col1X + barW, statY);
    } else {
      fill(150, 100, 100);
      smallTextSize(11);
      textAlign(CENTER, CENTER);
      text("No moa alive!", x + panelWidth / 2, statY + 10);
    }

    return y + panelHeight;
  }

  // One clickable species population row. Clicking it (handleSidebarClick)
  // toggles the in-world species highlight; while active the row is framed
  // in the species' highlight colour.
  _renderSpeciesRow(x, y, w, row) {
    const rowBoxH = 32 + SMALL_TEXT_BUMP * 2;   // tracks renderStatItem's height
    if (row.key) {
      this._speciesRowBounds.push({ key: row.key, x: x - 8, y: y - 4, w: w, h: rowBoxH });

      if (typeof SPECIES_HIGHLIGHT !== 'undefined' && SPECIES_HIGHLIGHT.has(row.key)) {
        const hc = row.highlightColor || [255, 235, 120];
        noFill();
        stroke(hc[0], hc[1], hc[2], 230);
        strokeWeight(2);
        rect(x - 8, y - 4, w, rowBoxH, 8);
      }
    }
    this.renderStatItem(x, y, row.icon, row.label, row.value, row.color);
  }

  // The clickable "Total eagles" row — same shape as a species row. Clicking
  // it (handleSidebarClick) toggles the eagle highlight and plays the eagle
  // call; while active the row is framed in the eagle highlight colour.
  _renderEagleRow(x, y, w, count) {
    const rowBoxH = 32 + SMALL_TEXT_BUMP * 2;   // tracks renderStatItem's height
    this._eagleRowBounds = { x: x - 8, y: y - 4, w: w, h: rowBoxH };

    const keys = (this.simulation.activeSpecies && this.simulation.activeSpecies.eagle) || [];
    const active = typeof SPECIES_HIGHLIGHT !== 'undefined' &&
                   keys.some(k => SPECIES_HIGHLIGHT.has(k));
    if (active) {
      const cfg = (typeof EAGLE_SPECIES !== 'undefined' && EAGLE_SPECIES[keys[0]]) || {};
      const hc = cfg.highlightColor || [255, 145, 90];
      noFill();
      stroke(hc[0], hc[1], hc[2], 230);
      strokeWeight(2);
      rect(x - 8, y - 4, w, rowBoxH, 8);
    }
    this.renderStatItem(x, y, '🦅', 'Total eagles', count, [180, 130, 130]);
  }

  _toggleSpeciesHighlight(key) {
    if (typeof SPECIES_HIGHLIGHT === 'undefined') return;
    if (SPECIES_HIGHLIGHT.has(key)) SPECIES_HIGHLIGHT.delete(key);
    else SPECIES_HIGHLIGHT.add(key);
    // The species answers when named — its own call on every toggle
    // (dedicated recording if present, else moa/eagle generic).
    if (audioManager) audioManager.playSpeciesCall(key);
  }

  // Toggle the in-world highlight for every active eagle species at once
  // (the sidebar has a single eagle row, not one per eagle species).
  _toggleEagleHighlight() {
    if (typeof SPECIES_HIGHLIGHT === 'undefined') return;
    const keys = (this.simulation.activeSpecies && this.simulation.activeSpecies.eagle) || [];
    if (!keys.length) return;
    const anyActive = keys.some(k => SPECIES_HIGHLIGHT.has(k));
    for (const k of keys) {
      if (anyActive) SPECIES_HIGHLIGHT.delete(k);
      else SPECIES_HIGHLIGHT.add(k);
    }
    if (audioManager) audioManager.playSpeciesCall(keys[0]);
  }

  renderStatItem(x, y, icon, label, value, col) {
    // Icon
    fill(255);
    noStroke();
    textSize(18);
    textAlign(LEFT, CENTER);
    text(icon, x, y + 10 + SMALL_TEXT_BUMP);

    // Label
    fill(col[0], col[1], col[2]);
    smallTextSize(12);
    textAlign(LEFT, TOP);
    text(label, x + 26, y);

    // Value — sits below the label, so its offset grows with the small-text
    // bump to keep the label from descending into it.
    fill(230, 245, 235);
    textSize(20);
    push();
    textFont(FreckleFace);
    textAlign(LEFT, TOP);
    text(value, x + 26, y + 10 + SMALL_TEXT_BUMP);
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