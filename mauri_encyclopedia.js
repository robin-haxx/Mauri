// ============================================
// MAURI — FIELD GUIDE / ENCYCLOPEDIA (gamewide)
// ------------------------------------------------------------
// A browsable, pausing dialog that holds the ecology of the game — species, plants,
// biomes, climate and concepts — so it lives somewhere the player can revisit, rather
// than flashing past in tutorial tips and notifications (which shrink to how-to-play).
// Available on every level: open with E, close with E or Esc.
//
// Content is DATA (the ENCYCLOPEDIA array), grounded in the research summarised in
// FREEPLAY_PLAN.md §2/§5. No emoji in bodies — drawn text only. Entries link via
// seeAlso. Add entries freely; the renderer paginates the list.
// ============================================

const ENCYCLOPEDIA = [
  // ---- Species ---------------------------------------------------------------
  { id: 'upland_moa', category: 'Moa', title: 'Upland Moa', subtitle: 'Megalapteryx didinus',
    body: [
      "The small, agile moa of the high country — subalpine tussock and montane forest,",
      "up to the treeline. Alone among moa it was feathered right down to the ankle, an",
      "adaptation to the cold. It browsed beech leaves and twigs, nectar-rich flax and",
      "fuchsia flowers, and subalpine herbs.",
      "",
      "In Free Play its cold tolerance makes it the backbone of a deep-glacial community:",
      "when the lowland moa falter, the upland moa is often the last still breeding."
    ], seeAlso: ['beech_refuge', 'winter_food', 'glacial_cycles'] },

  { id: 'little_bush_moa', category: 'Moa', title: 'Little Bush Moa', subtitle: 'Anomalopteryx didiformis',
    body: [
      "A closed-forest specialist of the lowland and montane bush. Small and secretive,",
      "it kept to the cover of the canopy and browsed the forest understorey.",
      "",
      "It favours planted lancewood (horoeka), a browse-resistant food that competitors",
      "largely ignore — so a lancewood stand draws the bush moa and few others."
    ], seeAlso: ['beech_refuge', 'coexistence'] },

  { id: 'south_island_giant_moa', category: 'Moa', title: 'South Island Giant Moa', subtitle: 'Dinornis robustus',
    body: [
      "The tallest moa — females could reach ~3.6 m to the raised head. A lowland",
      "browser of the open plains and forest margins.",
      "",
      "Poorly suited to deepening cold: in Free Play the giant is among the first to",
      "struggle as the glacials intensify, and can lean hard on the shared forest."
    ], seeAlso: ['glacial_cycles', 'coexistence'] },

  { id: 'stout_legged_moa', category: 'Moa', title: 'Stout-legged Moa', subtitle: 'Emeus crassus',
    body: [
      "A heavily built moa of the open lowlands and glacial outwash flats, grazing and",
      "browsing shrubland — coprosma and matagouri.",
      "",
      "A generalist on the wild background flora, so it sustains itself off the landscape",
      "rather than raiding planted plots."
    ], seeAlso: ['glacial_flats', 'coexistence'] },

  { id: 'heavy_footed_moa', category: 'Moa', title: 'Heavy-footed Moa', subtitle: 'Pachyornis elephantopus',
    body: [
      "Massive-legged and robust, a moa of forest margins and the top of the flats — a",
      "competitor at the edge of the forest refuge."
    ], seeAlso: ['beech_refuge'] },

  { id: 'haasts_eagle', category: 'Fauna', title: "Haast's Eagle", subtitle: 'Pouākai · Hieraaetus moorei',
    body: [
      "The largest eagle known, and the apex predator of the moa world — a bird that",
      "hunted prey many times its own weight.",
      "",
      "Its numbers rise and fall with the moa it hunts. A run of good years feeds more",
      "eagles; a deep glacial that thins the moa starves the eagles down behind them.",
      "In Free Play, if the eagles are lost entirely, the dominant moa surges unchecked",
      "until eagles return the following year."
    ], seeAlso: ['glacial_cycles', 'predator_prey'] },

  { id: 'kereru', category: 'Fauna', title: 'Kererū', subtitle: 'New Zealand pigeon',
    body: [
      "A large forest pigeon and a key seed-disperser: it swallows fruit whole and",
      "carries the seed away, replanting the forest as it feeds. It thins with the",
      "forest refuge in the cold and rebounds as the canopy recovers."
    ], seeAlso: ['beech_refuge', 'winter_food'] },

  { id: 'kokako', category: 'Fauna', title: 'Kōkako', subtitle: 'South Island kōkako',
    body: [
      "A wattlebird of the deep forest — a poor flier that bounds between branches. An",
      "ambient forest voice, tied to the health of the canopy."
    ], seeAlso: ['beech_refuge'] },

  // ---- Plants ----------------------------------------------------------------
  { id: 'beech', category: 'Plants', title: 'Beech', subtitle: 'Tawhai · Nothofagus/Fuscospora',
    body: [
      "The evergreen backbone of the southern forest. In good years it produces heavy",
      "'mast' seed crops. Because it keeps its leaves year-round, beech is the best",
      "winter browse a moa can find — the value of the forest refuge in the cold.",
      "",
      "Its winter food value is the highest of the wild flora, but a deepening glacial",
      "erodes even that."
    ], seeAlso: ['beech_refuge', 'winter_food'] },

  { id: 'tussock', category: 'Plants', title: 'Snow Tussock', subtitle: 'Chionochloa',
    body: [
      "The big bunch-grasses of the high country. They evolved with no browsing mammals",
      "— only moa and insects — and stand through the hardest winters. But they are",
      "coarse and low-value in the cold: standing food with little in it."
    ], seeAlso: ['winter_food', 'subalpine'] },

  { id: 'rimu', category: 'Plants', title: 'Rimu', subtitle: 'Podocarp',
    body: [
      "An ancient podocarp bearing bright fleshy fruit that birds prize. But the fruit",
      "is a summer-autumn thing: in winter a rimu offers almost no food at all."
    ], seeAlso: ['winter_food', 'kereru'] },

  { id: 'favoured_plants', category: 'Plants', title: 'Lancewood & Speargrass', subtitle: 'Horoeka · Taramea',
    body: [
      "Tough, spiky, browse-resistant plants you can place from the palette. Each feeds",
      "essentially one moa — lancewood the bush moa, speargrass the upland moa — so a",
      "planted stand draws its own species and few others.",
      "",
      "A tended stand also holds more of its food value through winter than wild flora,",
      "which makes the palette your deliberate answer to a hard glacial."
    ], seeAlso: ['coexistence', 'winter_food'] },

  // ---- Biomes ----------------------------------------------------------------
  { id: 'beech_refuge', category: 'Land', title: 'The Forest Refuge', subtitle: 'A glacial-age haven',
    body: [
      "During the last glacial, tall forest collapsed across most of the South Island —",
      "but northwest Nelson and the Karamea coast kept small pockets of beech alive.",
      "These 'micro-refugia' are why forest could spread again when the ice retreated.",
      "",
      "On this map the forest band IS that refuge: thin, contested, and the one reliable",
      "winter larder. In a deep glacial the treeline creeps up and the band narrows."
    ], seeAlso: ['winter_food', 'glacial_cycles', 'beech'] },

  { id: 'glacial_flats', category: 'Land', title: 'Glacial Flats & Shrubland', subtitle: 'Outwash country',
    body: [
      "Open, frost-prone lowland — outwash gravels, tussock and hardy divaricating",
      "shrubs (coprosma, matagouri). Rich enough in the warm seasons, it freezes hard",
      "in winter and greens late in spring."
    ], seeAlso: ['stout_legged_moa', 'winter_food'] },

  { id: 'subalpine', category: 'Land', title: 'Subalpine Tussock', subtitle: 'Above the forest',
    body: [
      "Snow tussock, dracophyllum (inaka) and cushion herbs above the treeline — the",
      "upland moa's summer country. The snow line drops into it in winter, and drops",
      "further in every deepening glacial."
    ], seeAlso: ['upland_moa', 'tussock'] },

  // ---- Climate & concepts ----------------------------------------------------
  { id: 'glacial_cycles', category: 'Climate', title: 'Glacial Cycles', subtitle: 'Ice ages come in waves',
    body: [
      "The ice ages came in waves — long cold glacials broken by shorter warm",
      "interglacials — and over the last million years the cold peaks grew deeper.",
      "",
      "Free Play compresses that into your run: the climate swings between glacial and",
      "interglacial years, and each glacial is a little colder than the last, until the",
      "land can no longer keep the flock fed. Warm years are your chance to rebuild."
    ], seeAlso: ['winter_food', 'beech_refuge'] },

  { id: 'winter_food', category: 'Climate', title: 'Why Winter Starves', subtitle: 'Food, not bare ground',
    body: [
      "New Zealand's plants are almost all evergreen — beech, tussock and the shrubs",
      "hold their leaves all year. So a glacial winter here doesn't leave bare ground;",
      "it leaves standing food with nothing in it. Fruit and berries end, new growth",
      "stops, frost toughens the leaves.",
      "",
      "The problem for a moa isn't finding a plant — it's finding one worth eating. As",
      "the climate deepens, only the best evergreen browse keeps any value, and the",
      "forest refuge becomes the lifeline."
    ], seeAlso: ['beech_refuge', 'beech', 'tussock'] },

  { id: 'coexistence', category: 'Concepts', title: 'How Many Moa Coexist', subtitle: 'Niches & favoured plants',
    body: [
      "Several moa species shared this land by NOT competing head-on: each kept to its",
      "own elevation band and its own foods. Browse-resistant favoured plants let a weak",
      "forest specialist persist beside a dominant browser, while the shared forest",
      "refuge is the one patch everyone contends for — and crowding it hurts everyone."
    ], seeAlso: ['favoured_plants', 'beech_refuge'] },

  { id: 'predator_prey', category: 'Concepts', title: 'Predator & Prey', subtitle: 'Eagles lag the moa',
    body: [
      "Eagle numbers are not set by hand — each bird feeds or starves and breeds on its",
      "own. So the classic predator-prey lag emerges: eagles climb after the moa boom,",
      "and crash behind the moa when a hard winter thins the herds."
    ], seeAlso: ['haasts_eagle'] },

  { id: 'mauri', category: 'Concepts', title: 'Mauri', subtitle: 'The life force you spend',
    body: [
      "Mauri is life force — your currency as kaitiaki (guardian). A healthy ecosystem",
      "earns it; you spend it on the palette to feed, shelter and draw the moa. In Free",
      "Play, banking mauri in the warm years pays for surviving the cold ones."
    ], seeAlso: ['favoured_plants'] }
];

// Fast lookup by id (for seeAlso navigation).
const ENCYCLOPEDIA_BY_ID = {};
for (const e of ENCYCLOPEDIA) ENCYCLOPEDIA_BY_ID[e.id] = e;

class Encyclopedia {
  constructor() {
    this.open = false;
    this.index = 0;          // selected entry
    this.listOffset = 0;     // first visible list row (for scrolling long lists)
    this._rowRects = [];     // hit rects rebuilt each render
    this._closeRect = null;
    this._wasPlaying = false;
  }

  toggle(game) { this.open ? this.close(game) : this.openGuide(game); }

  openGuide(game) {
    this.open = true;
    // Pause the sim while reading (restored on close) without fighting other pauses.
    if (game && typeof GAME_STATE !== 'undefined') {
      this._wasPlaying = (game.state === GAME_STATE.PLAYING);
      if (this._wasPlaying) game.state = GAME_STATE.PAUSED;
    }
  }

  close(game) {
    this.open = false;
    if (game && this._wasPlaying && typeof GAME_STATE !== 'undefined' &&
        game.state === GAME_STATE.PAUSED) {
      game.state = GAME_STATE.PLAYING;
    }
    this._wasPlaying = false;
  }

  select(idOrIndex) {
    if (typeof idOrIndex === 'string') {
      const i = ENCYCLOPEDIA.findIndex(e => e.id === idOrIndex);
      if (i >= 0) this.index = i;
    } else {
      this.index = Math.max(0, Math.min(ENCYCLOPEDIA.length - 1, idOrIndex));
    }
  }

  // Returns true if it consumed the key.
  handleGlobalKey(k, game) {
    const key = (k || '').toLowerCase();
    if (key === 'e') { this.toggle(game); return true; }
    if (!this.open) return false;
    if (key === 'escape') { this.close(game); return true; }
    if (keyCode === UP_ARROW) { this.select(this.index - 1); this._ensureVisible(); return true; }
    if (keyCode === DOWN_ARROW) { this.select(this.index + 1); this._ensureVisible(); return true; }
    return true;   // swallow all other keys while open (modal)
  }

  handleWheel(delta) {
    if (!this.open) return;
    this.listOffset = Math.max(0, this.listOffset + (delta > 0 ? 1 : -1));
  }

  handleClick(mx, my) {
    if (!this.open) return;
    if (this._closeRect && this._hit(this._closeRect, mx, my)) { this.close(null); return; }
    for (const r of this._rowRects) {
      if (this._hit(r, mx, my)) { this.select(r.index); return; }
    }
    // clicking a seeAlso chip
    for (const r of (this._seeAlsoRects || [])) {
      if (this._hit(r, mx, my)) { this.select(r.id); this._ensureVisible(); return; }
    }
  }

  _hit(r, mx, my) { return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }

  _ensureVisible() {
    // keep selection within the rendered window (approx; render clamps precisely)
    if (this.index < this.listOffset) this.listOffset = this.index;
  }

  // ---- render (screen space; called after game.render) ------------------------
  render(game) {
    const W = CONFIG.canvasWidth, H = CONFIG.canvasHeight;
    push();
    // Backdrop
    noStroke(); fill(10, 14, 20, 210); rect(0, 0, W, H);

    // Panel
    const pw = Math.min(940, W * 0.86), ph = Math.min(660, H * 0.86);
    const px = (W - pw) / 2, py = (H - ph) / 2;
    fill(24, 30, 38); stroke(70, 90, 80); strokeWeight(2);
    rect(px, py, pw, ph, 10);
    noStroke();

    // Header
    fill(228, 236, 228); textAlign(LEFT, TOP); textStyle(BOLD);
    if (typeof textSize === 'function') textSize(22);
    text('Field Guide', px + 22, py + 16);
    textStyle(NORMAL); textSize(12); fill(150, 170, 160);
    textAlign(RIGHT, TOP);
    const closeLabel = 'E or Esc to close';
    text(closeLabel, px + pw - 22, py + 22);
    this._closeRect = { x: px + pw - 130, y: py + 14, w: 116, h: 22 };

    // Layout columns
    const listX = px + 18, listY = py + 56, listW = pw * 0.34, listH = ph - 74;
    const bodyX = listX + listW + 20, bodyY = listY, bodyW = pw - (bodyX - px) - 22, bodyH = listH;

    // Divider
    stroke(60, 74, 66); strokeWeight(1);
    line(listX + listW + 8, listY, listX + listW + 8, listY + listH);
    noStroke();

    // ---- entry list (grouped by category), with paging -----------------------
    this._rowRects = [];
    const rowH = 26;
    const maxRows = Math.floor(listH / rowH);
    // Build a flat display list of {type:'cat'|'entry', ...}
    const rows = [];
    let lastCat = null;
    for (let i = 0; i < ENCYCLOPEDIA.length; i++) {
      const e = ENCYCLOPEDIA[i];
      if (e.category !== lastCat) { rows.push({ type: 'cat', label: e.category }); lastCat = e.category; }
      rows.push({ type: 'entry', label: e.title, index: i });
    }
    if (this.listOffset > Math.max(0, rows.length - maxRows)) {
      this.listOffset = Math.max(0, rows.length - maxRows);
    }
    let ry = listY;
    for (let r = this.listOffset; r < rows.length && (ry + rowH) <= listY + listH; r++) {
      const row = rows[r];
      if (row.type === 'cat') {
        fill(120, 150, 130); textAlign(LEFT, CENTER); textStyle(BOLD); textSize(11);
        text(row.label.toUpperCase(), listX + 4, ry + rowH / 2);
        textStyle(NORMAL);
      } else {
        const selected = row.index === this.index;
        if (selected) { fill(46, 66, 54); rect(listX, ry + 2, listW - 6, rowH - 4, 5); }
        fill(selected ? [235, 245, 235] : [186, 200, 190]);
        textAlign(LEFT, CENTER); textSize(13);
        text(row.label, listX + 12, ry + rowH / 2);
        this._rowRects.push({ x: listX, y: ry, w: listW - 6, h: rowH, index: row.index });
      }
      ry += rowH;
    }
    // scroll hint
    if (rows.length > maxRows) {
      fill(120, 140, 130); textAlign(LEFT, TOP); textSize(10);
      text('scroll ▲▼', listX + 4, listY + listH + 2);
    }

    // ---- selected entry body -------------------------------------------------
    const e = ENCYCLOPEDIA[this.index];
    if (e) {
      fill(236, 244, 236); textAlign(LEFT, TOP); textStyle(BOLD); textSize(20);
      text(e.title, bodyX, bodyY);
      textStyle(ITALIC); textSize(12); fill(150, 172, 158);
      text(e.subtitle || '', bodyX, bodyY + 28);
      textStyle(NORMAL); textSize(13.5); fill(206, 216, 208);
      const bodyStr = (e.body || []).join('\n');
      text(bodyStr, bodyX, bodyY + 52, bodyW, bodyH - 120);

      // seeAlso chips
      this._seeAlsoRects = [];
      if (e.seeAlso && e.seeAlso.length) {
        let cx = bodyX, cy = bodyY + bodyH - 34;
        fill(140, 160, 148); textAlign(LEFT, TOP); textSize(11);
        text('See also:', cx, cy - 16);
        textSize(12);
        for (const id of e.seeAlso) {
          const ref = ENCYCLOPEDIA_BY_ID[id];
          if (!ref) continue;
          const label = ref.title;
          const w = textWidth(label) + 16;
          if (cx + w > bodyX + bodyW) { cx = bodyX; cy += 26; }
          fill(40, 58, 48); rect(cx, cy, w, 20, 10);
          fill(200, 226, 210); textAlign(LEFT, TOP);
          text(label, cx + 8, cy + 4);
          this._seeAlsoRects.push({ x: cx, y: cy, w, h: 20, id });
          cx += w + 8;
        }
      }
    }
    pop();
  }
}
