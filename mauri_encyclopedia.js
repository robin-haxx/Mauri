// ============================================
// MAURI; FIELD GUIDE / ENCYCLOPEDIA
// Browsable docked panel of game ecology (species, plants, biomes, climate,
// concepts). Content is the ENCYCLOPEDIA data array; entries cross-link via
// seeAlso. Open/close with E, Esc to close. Available on every level.
// ============================================

const ENCYCLOPEDIA = [
  // ---- Species ---------------------------------------------------------------
  { id: 'upland_moa', category: 'Moa', title: 'Upland Moa', subtitle: 'Megalapteryx didinus',
    body: [
      "The small, agile moa of the high country: subalpine tussock and montane forest,",
      "up to the treeline. Alone among the moa it was feathered right down its legs, almost",
      "to the toes, against the cold, and browsed beech twigs, subalpine herbs and the",
      "nectar-rich flowers of flax and fuchsia.",
      "",
      "As the cold deepened and open country spread, the upland moa was joined by",
      "the heavy-footed and crested moa, which adapted well to the same harsh land.",
      
    ], seeAlso: ['subalpine', 'beech_refuge', 'glacial_cycles'] },

  { id: 'little_bush_moa', category: 'Moa', title: 'Little Bush Moa', subtitle: 'Anomalopteryx didiformis',
    body: [
      "The smallest of the moa, and a closed-forest specialist. Small and secretive, it",
      "kept to the cover of the canopy and browsed the forest understorey.",
      "",
      "In the sparse forest of Aotearoa's last glacial winters the bush moa was pushed",
      "back into the refugia, in a constant struggle for survival. But it held on, and",
      "began to thrive again as temperatures warmed and dense forest returned at the onset",
      "of the Holocene.",
      "",
      "It favours the juvenile form of lancewood (horoeka),",
      "a browse-resistant food that competitors largely ignore."
    ], seeAlso: ['beech_refuge', 'coexistence', 'glacial_cycles'] },

  { id: 'south_island_giant_moa', category: 'Moa', title: 'South Island Giant Moa', subtitle: 'Dinornis robustus',
    body: [
      "The tallest moa: females could reach ~3.6 m!. A lowland browser,",
      "of the open plains and forest margins.",
      "",
    ], seeAlso: ['glacial_cycles', 'coexistence'] },

  { id: 'stout_legged_moa', category: 'Moa', title: 'Stout-legged Moa', subtitle: 'Emeus crassus',
    body: [
      "A heavily built moa of the open lowlands and glacial outwash flats, grazing and",
      "browsing shrubland (coprosma and matagouri.)",
      "",

    ], seeAlso: ['glacial_flats', 'coexistence'] },

  { id: 'heavy_footed_moa', category: 'Moa', title: 'Heavy-footed Moa', subtitle: 'Pachyornis elephantopus',
    body: [
      "Massive-legged and robust, a moa of forest margins and the top of the flats; a",
      "competitor at the edge of the forest refuge."
    ], seeAlso: ['beech_refuge'] },

  { id: 'haasts_eagle', category: 'Fauna', title: "Haast's Eagle", subtitle: 'Pouākai · Hieraaetus moorei',
    body: [
      "The largest eagle known, and the apex predator of the moa world.",
      "Known as the Pouākai, it hunted prey many times its own weight.",
      "",
      "Its numbers rise and fall with the moa it hunts. A good year for moa means more",
      "food for eagles; as moa populations fall, it starves the eagles behind them.",

    ], seeAlso: ['glacial_cycles', 'predator_prey'] },


  { id: 'kokako', category: 'Fauna', title: 'Kōkako', subtitle: 'South Island kōkako · Callaeas cinereus',
    body: [
      "A wattlebird of the deep forest; a poor flier that bounds between the branches on",
      "long legs, and carries a slow, organ-like song across the canopy. The South Island",
      "bird wore orange wattles at the throat.",
      "",
      "In the glacial ages the kōkako were elusive; without a dense forest mosaic, foraging",
      "and nesting became very difficult for them. Even after the last glacial their numbers",
      "kept shrinking, and today the South Island bird is all but gone; a grey ghost no one",
      "can quite confirm.",
      "",
      "You are doing very well if you can bring the forest back and make the rimu mast early",
      "enough to return this ghost to Te Waipounamu."
    ], seeAlso: ['beech_refuge', 'rimu', 'glacial_cycles'] },

  { id: 'kea', category: 'Fauna', title: 'Kea', subtitle: 'Nestor notabilis',
    body: [
      "The world's only alpine parrot; a bold, restless generalist of the subalpine",
      "tussock and scrub, and by repute the cleverest bird in these mountains.",
      "",
      "Kea split from the kākā close to two million years ago, as the Southern Alps rose",
      "and the ice ages opened up alpine country for a parrot willing to leave the forest.",
      "They are more solitary than the kākā, but far cleverer and far more opportunistic:",
      "as well as berries such as pātōtara, they raid the nests of ground-birds like kiwi",
      "and moa for the eggs. Where no moa are near, a Haast's eagle has less reason to hunt",
      "over kea country.",
      "",
      "In Free Play the kea are your lever on the moa nests: a Berry Cache placed downslope",
      "draws the flock down onto the forest, and stationed kea can be loosed to raid a",
      "nesting site (Nest Raid)."
    ], seeAlso: ['kaka', 'beech_refuge', 'glacial_cycles', 'predator_prey'] },

  { id: 'kaka', category: 'Fauna', title: 'Kākā', subtitle: 'Nestor meridionalis',
    body: [
      "The forest parrot; kea's gregarious, forest-dwelling sister, and its mirror image.",
      "Where the kea took to the alps, the kākā kept to the trees, working the podocarp and",
      "beech canopy for fruit, seed, nectar and sap and prising grubs from under the bark.",
      "It gathers into noisy foraging parties, and is a seed predator more than a disperser.",
      "",
      "Kākā are a warm-forest bird: their bones are common in the deposits of the Holocene,",
      "laid down when tall wet forest reached its greatest extent. As the glacial deepens",
      "they are squeezed into the shrinking forest refuge alongside the bush moa; so the",
      "podocarp forest you grow is their lifeline."
    ], seeAlso: ['kea', 'beech_refuge', 'winter_food'] },

  { id: 'kakapo', category: 'Fauna', title: 'Kākāpō', subtitle: 'Strigops habroptilus',
    body: [
      "The heaviest parrot in the world, and the only one that cannot fly; a nocturnal,",
      "moss-green bird with an owl-like face and a sweet, musty scent. With the kea and the",
      "kākā it belongs to the most ancient lineage of parrots on Earth. It browses the",
      "forest floor for leaves, stems and fruit and, rather than flee, freezes and trusts",
      "its camouflage.",
      "",
      "Its oddest habit is its breeding: the males gather on high ground and boom through",
      "the night from shallow bowls to call the females in; and they are fiercely",
      "territorial about it, attacking any rival whose court is dug too close.",
      "",
      "In the warm interglacials kākāpō were everywhere; dense forest ran the length of",
      "the land, the rimu thronged and fruited, and the birds far outnumbered the eagles.",
      "In this glacial age most of the South Island is stripped to scrub and herbfield;",
      "Kahurangi is a refuge where the beech holds on, with rimu clinging to the most",
      "sheltered pockets.",
      "",
      "It breeds only in a rimu MAST year, so its numbers hold or slowly fall until a mast",
      "lets the flock surge. Fern shelters draw un-settled birds; use them to spread the",
      "flock out."
    ], seeAlso: ['rimu', 'beech_refuge', 'glacial_cycles'] },

  // ---- Plants ----------------------------------------------------------------
  { id: 'beech', category: 'Plants', title: 'Beech', subtitle: 'Tawhai · Nothofagus/Fuscospora',
    body: [
      "Evergreen canopy trees that dominate southern forest, from the lowlands to the",
      "treeline and onto poor soils where other trees fail. Some years, cued by a warm",
      "previous summer, the forest sets a heavy synchronised 'mast' seed crop."
    ], seeAlso: ['beech_refuge', 'winter_food'] },

  { id: 'tussock', category: 'Plants', title: 'Snow Tussock', subtitle: 'Chionochloa',
    body: [
      "Large snow-grasses that dominate the grasslands above the treeline, long-lived",
      "and slow-growing on cold, poor ground. The coarse foliage is low in nutrients,",
      "and in occasional mast years they flower heavily."
    ], seeAlso: ['winter_food', 'subalpine'] },

  { id: 'rimu', category: 'Plants', title: 'Rimu', subtitle: 'Podocarp',
    body: [
      "A tall, slow-growing podocarp that emerges above the lowland conifer-broadleaf",
      "forest, long-lived and weeping-leaved when young. In some years it carries bright",
      "fleshy fruit through summer and autumn, prized by kererū and kākāpō."
    ], seeAlso: ['winter_food', 'kereru'] },

  { id: 'favoured_plants', category: 'Plants', title: 'Lancewood & Speargrass', subtitle: 'Horoeka · Taramea',
    body: [
      "Two tough, browse-resistant plants of the open country. Lancewood (horoeka)",
      "spends its early years as a single stem hung with long, hard, downward-angled",
      "leaves, widely read as a defence against moa browsing. Speargrass (taramea)",
      "forms a stiff rosette of sharp, spine-tipped leaves in tussock and rocky ground."
    ], seeAlso: ['coexistence', 'winter_food'] },

  // ---- Biomes ----------------------------------------------------------------
  { id: 'beech_refuge', category: 'Land', title: 'The Forest Refuge', subtitle: 'A glacial-age haven',
    body: [
      "During the last glacial, tall forest collapsed across most of the South Island;",
      "but northwest Nelson and the Karamea coast kept small pockets of beech alive.",
      "These 'micro-refugia' are why forest could spread again when the ice retreated.",
      "",
      "On this map the forest band IS that refuge: thin, contested, and the one reliable",
      "winter larder. In a deep glacial the treeline creeps up and the band narrows."
    ], seeAlso: ['winter_food', 'glacial_cycles', 'beech'] },

  { id: 'glacial_flats', category: 'Land', title: 'Glacial Flats & Shrubland', subtitle: 'Outwash country',
    body: [
      "Open, frost-prone lowland; outwash gravels, tussock and hardy divaricating",
      "shrubs (coprosma, matagouri). Rich enough in the warm seasons, it freezes hard",
      "in winter and greens late in spring."
    ], seeAlso: ['stout_legged_moa', 'winter_food'] },

  { id: 'subalpine', category: 'Land', title: 'Subalpine Tussock', subtitle: 'Above the forest',
    body: [
      "Snow tussock, dracophyllum (inaka) and cushion herbs above the treeline; the",
      "upland moa's summer country. The snow line drops into it in winter, and drops",
      "further in every deepening glacial."
    ], seeAlso: ['upland_moa', 'tussock'] },

  // ---- Climate & concepts ----------------------------------------------------
  { id: 'glacial_cycles', category: 'Climate', title: 'Glacial Cycles', subtitle: 'Ice ages come in waves',
    body: [
      "The ice ages came in waves. Long cold glacials broke against shorter warm",
      "interglacials, and over the last million years the cold peaks grew deeper each",
      "time. Beech recovered from a glacial faster than the slow podocarps, so it came",
      "to dominate later on, while the podocarps kept their hold on the wetter west.",
      "",
      "Free Play folds all of that into your run. The climate swings between glacial and",
      "interglacial years, each glacial biting a little harder than the last, until the",
      "land can no longer keep the flock fed. The warm years are your chance to rebuild."
    ], seeAlso: ['winter_food', 'beech_refuge'] },

  { id: 'winter_food', category: 'Climate', title: 'Why Winter Starves', subtitle: 'Food, not bare ground',
    body: [
      "Almost all of New Zealand's plants are evergreen. Beech, tussock and the hardy",
      "shrubs hold their leaves right through the year, so a glacial winter here doesn't",
      "strip the land back to bare ground. It leaves standing food with nothing left in",
      "it: the fruit and berries finish, new growth stops, frost toughens the old leaves.",
      "",
      "So a moa's problem in winter is never finding a plant, but finding one still worth",
      "eating. As the climate deepens, only the best evergreen browse keeps any value,",
      "and the forest refuge becomes the lifeline."
    ], seeAlso: ['beech_refuge', 'beech', 'tussock'] },

  { id: 'coexistence', category: 'Concepts', title: 'How Many Moa Coexist', subtitle: 'Niches & favoured plants',
    body: [
      "Several moa species shared this land by not competing head-on. Each kept to its",
      "own band of country and its own foods: the upland moa worked the tough subalpine",
      "tops, the little bush moa the dense forest, the stout-legged moa the eastern",
      "lowlands. Where their ranges met, a browse-resistant favoured plant let a weaker",
      "forest specialist hold on beside a dominant browser. The one patch they all",
      "contend for is the forest refuge, and crowding it hurts everyone."
    ], seeAlso: ['favoured_plants', 'beech_refuge'] },

  { id: 'predator_prey', category: 'Concepts', title: 'Predator & Prey', subtitle: 'Eagles lag the moa',
    body: [
      "No one sets the eagle numbers by hand. Each bird feeds or starves and breeds on",
      "its own, so the classic predator-prey lag falls out on its own: the eagles climb",
      "a season behind a moa boom, then crash behind the moa again when a hard winter",
      "thins the flock."
    ], seeAlso: ['haasts_eagle'] },

  { id: 'mauri', category: 'Concepts', title: 'Mauri', subtitle: 'The life force you spend',
    body: [
      "Mauri is life force, and it is your currency as kaitiaki, the guardian of this",
      "land. A healthy, balanced ecosystem earns it for you, and you spend it from the",
      "palette to feed, shelter and draw the moa. In Free Play the mauri you bank in the",
      "warm years is what pays for surviving the cold ones."
    ], seeAlso: ['favoured_plants'] }
];

// Fast lookup by id (for seeAlso navigation).
const ENCYCLOPEDIA_BY_ID = {};
for (const e of ENCYCLOPEDIA) ENCYCLOPEDIA_BY_ID[e.id] = e;

// Highlight colour for the guide's selected species: [r,g,b] to outline in the
// world (via EntitySprites.drawSpriteOutline), or null.
const GUIDE_OUTLINE_COLOR = [150, 255, 130];
function guideOutlineColor(speciesKey) {
  if (!speciesKey || typeof game === 'undefined' || !game || !game.encyclopedia) return null;
  const enc = game.encyclopedia;
  if (!enc.open) return null;                       // only while the guide is showing
  const entry = ENCYCLOPEDIA[enc.index];
  if (!entry) return null;
  // Animal speciesKey matches encyclopedia id.
  if (entry.id === speciesKey) return GUIDE_OUTLINE_COLOR;
  // One eagle entry covers all eagle species.
  if (entry.id === 'haasts_eagle' && speciesKey.indexOf('haasts_eagle') !== -1) return GUIDE_OUTLINE_COLOR;
  return null;
}

// In-world highlight colour for an animal sprite: [r,g,b] or null. The guide's
// selection (green) overrides the player's SPECIES_HIGHLIGHT toggle colour.
function highlightOutlineColor(speciesKey, highlightColor) {
  const g = guideOutlineColor(speciesKey);
  if (g) return g;
  if (typeof SPECIES_HIGHLIGHT !== 'undefined' && SPECIES_HIGHLIGHT.has(speciesKey))
    return highlightColor || [255, 235, 120];
  return null;
}

// Docked field guide in the right-bar column; does not pause the sim. Shows one
// view at a time: the entry list, or a single entry's detail. GameUI computes the
// panel box and routes clicks.
class Encyclopedia {
  constructor() {
    this.open = false;
    this.viewMode = 'list';  // 'list' | 'detail'
    this.index = 0;          // selected entry
    this.listOffset = 0;     // first visible list row
    this._rowRects = [];     // hit rects rebuilt each render
    this._seeAlsoRects = [];
    this._backRect = null;
    this._closeRect = null;
    this._panelRect = null;  // last docked box (wheel hit-testing)
  }

  toggle(game) { this.open ? this.close(game) : this.openGuide(game); }
  openGuide() { this.open = true; }   // docked; sim keeps running
  close() { this.open = false; }

  select(idOrIndex) {
    if (typeof idOrIndex === 'string') {
      const i = ENCYCLOPEDIA.findIndex(e => e.id === idOrIndex);
      if (i >= 0) this.index = i;
    } else {
      this.index = Math.max(0, Math.min(ENCYCLOPEDIA.length - 1, idOrIndex));
    }
    this.viewMode = 'detail';
  }

  // Returns true only for keys it consumes, so gameplay keys still reach the game.
  handleGlobalKey(k, game) {
    const key = (k || '').toLowerCase();
    if (key === 'e') { this.toggle(game); return true; }
    if (!this.open) return false;
    if (key === 'escape') {
      if (this.viewMode === 'detail') this.viewMode = 'list';   // step back to the list first
      else this.close();
      return true;
    }
    if (this.viewMode === 'list') {
      if (keyCode === UP_ARROW) { this.index = Math.max(0, this.index - 1); this._ensureVisible(); return true; }
      if (keyCode === DOWN_ARROW) { this.index = Math.min(ENCYCLOPEDIA.length - 1, this.index + 1); this._ensureVisible(); return true; }
    }
    return false;
  }

  pointerOverPanel(mx, my) { return !!this._panelRect && this._hit(this._panelRect, mx, my); }

  handleWheel(delta) {
    if (!this.open || this.viewMode !== 'list') return;
    this.listOffset = Math.max(0, this.listOffset + (delta > 0 ? 1 : -1));
  }

  // Called by GameUI only when the click lands inside the docked panel.
  handleDockedClick(mx, my) {
    if (!this.open) return false;
    if (this._closeRect && this._hit(this._closeRect, mx, my)) { this.close(); return true; }
    if (this.viewMode === 'detail') {
      if (this._backRect && this._hit(this._backRect, mx, my)) { this.viewMode = 'list'; return true; }
      for (const r of this._seeAlsoRects) if (this._hit(r, mx, my)) { this.select(r.id); return true; }
      return true;   // swallow clicks inside the panel body
    }
    for (const r of this._rowRects) if (this._hit(r, mx, my)) { this.select(r.index); return true; }
    return true;     // swallow clicks inside the list background
  }

  _hit(r, mx, my) { return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h; }

  _ensureVisible() {
    if (this.index < this.listOffset) this.listOffset = this.index;
  }

  // Small × close glyph at (x,y); returns its 20×20 hit rect.
  _drawClose(x, y) {
    push();
    stroke(150, 170, 160); strokeWeight(2);
    const s = 6, cx = x + 10, cy = y + 10;
    line(cx - s, cy - s, cx + s, cy + s);
    line(cx - s, cy + s, cx + s, cy - s);
    pop();
    return { x, y, w: 20, h: 20 };
  }

  // ---- docked render (right-bar column) ---------------------------------------
  // x,y,w,h is the panel box. opts.translucent softens the fill for the overlay.
  renderDocked(x, y, w, h, opts = {}) {
    if (h < 60) { this._panelRect = null; return; }   // no usable room
    this._panelRect = { x, y, w, h };
    const pad = 12, headerH = 30;

    push();
    // Panel body + border
    noStroke();
    fill(24, 30, 38, opts.translucent ? 225 : 255);
    rect(x, y, w, h, 8);
    noFill(); stroke(70, 90, 80); strokeWeight(1);
    rect(x, y, w, h, 8);
    noStroke();

    // Header bar
    fill(45, 75, 55);
    rect(x, y, w, headerH, 8, 8, 0, 0);

    if (this.viewMode === 'detail') this._renderDetail(x, y, w, h, pad, headerH);
    else this._renderList(x, y, w, h, pad, headerH);
    pop();
  }

  _renderList(x, y, w, h, pad, headerH) {
    this._backRect = null;
    this._seeAlsoRects = [];

    // Header: title + close
    fill(200, 224, 206); textAlign(LEFT, CENTER); textStyle(BOLD); textSize(14);
    text('FIELD GUIDE', x + 12, y + headerH / 2);
    textStyle(NORMAL);
    this._closeRect = this._drawClose(x + w - 26, y + (headerH - 20) / 2);

    const listX = x + pad;
    const listY = y + headerH + 6;
    const listBottom = y + h - 6;
    const rowH = 24;

    // Flat display list, grouped by category.
    const rows = [];
    let lastCat = null;
    for (let i = 0; i < ENCYCLOPEDIA.length; i++) {
      const e = ENCYCLOPEDIA[i];
      if (e.category !== lastCat) { rows.push({ type: 'cat', label: e.category }); lastCat = e.category; }
      rows.push({ type: 'entry', label: e.title, index: i });
    }
    const maxRows = Math.max(1, Math.floor((listBottom - listY) / rowH));
    if (this.listOffset > Math.max(0, rows.length - maxRows)) {
      this.listOffset = Math.max(0, rows.length - maxRows);
    }

    this._rowRects = [];
    let ry = listY;
    for (let r = this.listOffset; r < rows.length && (ry + rowH) <= listBottom; r++) {
      const row = rows[r];
      if (row.type === 'cat') {
        fill(120, 150, 130); textAlign(LEFT, CENTER); textStyle(BOLD); textSize(10);
        text(row.label.toUpperCase(), listX + 2, ry + rowH / 2);
        textStyle(NORMAL);
      } else {
        const selected = row.index === this.index;
        if (selected) { noStroke(); fill(46, 66, 54); rect(listX - 2, ry + 2, w - 2 * pad + 4, rowH - 4, 5); }
        fill(selected ? [235, 245, 235] : [190, 204, 194]);
        textAlign(LEFT, CENTER); textSize(12.5);
        text(row.label, listX + 8, ry + rowH / 2);
        this._rowRects.push({ x: listX - 2, y: ry, w: w - 2 * pad + 4, h: rowH, index: row.index });
      }
      ry += rowH;
    }

    if (rows.length > maxRows) {
      fill(120, 140, 130); textAlign(RIGHT, BOTTOM); textSize(9);
      text('scroll ▲▼', x + w - 10, listBottom);
    }
  }

  _renderDetail(x, y, w, h, pad, headerH) {
    this._rowRects = [];
    const e = ENCYCLOPEDIA[this.index];

    // Header: back toggle + close
    fill(180, 214, 190); textAlign(LEFT, CENTER); textStyle(BOLD); textSize(12);
    const backLabel = '‹ Back to encyclopedia';
    text(backLabel, x + 12, y + headerH / 2);
    this._backRect = { x: x + 6, y: y + 4, w: textWidth(backLabel) + 12, h: headerH - 8 };
    textStyle(NORMAL);
    this._closeRect = this._drawClose(x + w - 26, y + (headerH - 20) / 2);

    if (!e) return;
    const bx = x + pad, bw = w - 2 * pad;
    let by = y + headerH + 10;

    fill(236, 244, 236); textAlign(LEFT, TOP); textStyle(BOLD); textSize(17);
    text(e.title, bx, by, bw); by += 24;
    textStyle(ITALIC); textSize(11); fill(150, 172, 158);
    text(e.subtitle || '', bx, by, bw); by += 18;

    const bottom = y + h - 8;
    const seeAlsoH = (e.seeAlso && e.seeAlso.length) ? 48 : 0;
    textStyle(NORMAL); textSize(12.5); fill(206, 216, 208);
    text((e.body || []).join('\n'), bx, by + 6, bw, bottom - (by + 6) - seeAlsoH);

    // seeAlso chips (navigate within detail)
    this._seeAlsoRects = [];
    if (seeAlsoH) {
      let cx = bx, cy = bottom - seeAlsoH + 14;
      fill(140, 160, 148); textAlign(LEFT, TOP); textSize(10);
      text('See also:', cx, cy - 13);
      textSize(11);
      for (const id of e.seeAlso) {
        const ref = ENCYCLOPEDIA_BY_ID[id];
        if (!ref) continue;
        const label = ref.title;
        const cw = textWidth(label) + 16;
        if (cx + cw > bx + bw) { cx = bx; cy += 24; }
        fill(40, 58, 48); rect(cx, cy, cw, 20, 10);
        fill(200, 226, 210); textAlign(LEFT, TOP);
        text(label, cx + 8, cy + 4);
        this._seeAlsoRects.push({ x: cx, y: cy, w: cw, h: 20, id });
        cx += cw + 8;
      }
    }
  }
}
