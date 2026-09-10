// ============================================
// TERRAIN GENERATOR - Pre-baked seasonal buffers
// Zero computation during season transitions
// ============================================
class TerrainGenerator {
  constructor(config, biomes) {
    this.config = config;
    this.biomes = biomes;
    this.biomeList = Object.values(biomes).sort((a, b) => a.minElevation - b.minElevation);
    this.seed = random(10000);
    
    // Typed arrays
    this.heightMap = null;
    this.biomeIndexMap = null;
    this.biomeArray = null;
    
    // Pre-baked seasonal buffers (created once at generation)
    this.seasonBuffers = {
      summer: null,
      autumn: null,
      winter: null,
      spring: null
    };

    // Fixed-3D relief buffers: the same four seasons re-projected so the ranges
    // stand up (see _bakeReliefBuffer). Baked LAZILY the first time the 3D view
    // is switched on — a one-time hitch — then cached until the terrain regenerates.
    this.reliefBuffers = {
      summer: null,
      autumn: null,
      winter: null,
      spring: null
    };
    this._reliefWorldH = 0;   // world-unit height the relief buffers draw at
    
    // Snow line per season (pre-defined)
    this.seasonSnowLines = {
      summer: 0.92,
      autumn: 0.85,
      winter: 0.77,
      spring: 0.82
    };

    // Allow level-specific snow lines
    if (config.seasonSnowLines) {
      Object.assign(this.seasonSnowLines, config.seasonSnowLines);
    }
      
    // Season manager reference
    this.seasonManager = null;
    
    // Dimensions
    const gameWidth = config.gameAreaWidth || config.width;
    const gameHeight = config.gameAreaHeight || config.height;
    const zoom = config.zoom || 1;
    
    this.mapWidth = Math.ceil(gameWidth / zoom);
    this.mapHeight = Math.ceil(gameHeight / zoom);
    this.worldWidth = gameWidth;
    this.worldHeight = gameHeight;
    this.zoom = zoom;

    // ---- 2×2 (N×M) CONTINUOUS TERRAIN GRID (endless "years") ------------------
    // ONE continuous landmass, generated once, spanning worldW×worldH = cols×rows
    // play windows. The island falloff runs the FULL width, so it is a single
    // alps→shore descent (east = high alps, west = shore); a window shows only PART
    // of it (year 1 = the alps→podocarp-forest upper slope, no shore). Each YEAR the
    // CAMERA PANS across the continuous land to the next area in a circular tour, and
    // the year's plants/fauna are unloaded and regenerated for the new area (see
    // Game._scrollWorldGrid). The play window itself is unchanged (mapWidth/mapHeight,
    // simulation, projection, clip and entity bounds are all one-window sized); the
    // world only shows up in the heightmap/buffers (full-world) and a scroll offset.
    //   Tour (E–W slope): east/alps → west/shore → across → back upslope.
    this.viewW = this.mapWidth;    // one area / play window, world units
    this.viewH = this.mapHeight;
    const wg = config.worldGrid || null;
    this.worldGridCols = wg ? Math.max(1, wg.cols || 1) : 1;
    this.worldGridRows = wg ? Math.max(1, wg.rows || 1) : 1;
    this.hasWorldGrid = (this.worldGridCols * this.worldGridRows) > 1;
    this._worldGridCfg = wg || {};
    // Full continuous world extent (world units). Classic levels: one window.
    this.worldW = this.viewW * this.worldGridCols;
    this.worldH = this.viewH * this.worldGridRows;
    // Circular tour order [col,row]. Default (2×2) starts at the east/alps window and
    // loops west → across → east, so year 1 is the alps→podo upper slope.
    this._quadOrder = (wg && wg.order) || this._defaultQuadOrder(this.worldGridCols, this.worldGridRows);
    // "Less drastic alps, more podo forest": at the opening, SCALE the whole land
    // elevation toward the coast so the alps top out low and the forest/subalpine band
    // spreads far up the slope (a window then reads alps→podo, not wall-to-wall ice).
    // `openLandScale` (0..1, lower = gentler) releases to 1.0 as `glacialAdvance` grows,
    // so glacial habitats climb back up over the years. Seed-independent (a proportion,
    // not a subtractive drop). Sea/coast (below `seaLevel`) are never touched.
    this.gridOpenLandScale = (wg && wg.openLandScale != null) ? wg.openLandScale : 0.6;
    this.gridSeaLevel = (wg && wg.seaLevel != null) ? wg.seaLevel : 0.14;
    this.gridGlacialFull = (wg && wg.glacialCap != null) ? wg.glacialCap : 0.6;  // advance at which "fully deep"
    this.glacialAdvance = (wg && wg.glacialAdvance != null) ? wg.glacialAdvance : 0;

    // Active area (the window's quadrant) + its world-space origin.
    this.activeCol = this._quadOrder[0][0];
    this.activeRow = this._quadOrder[0][1];
    this._updateActiveOrigin();
    // Camera scroll (world units) = top-left of the visible window. Settled → the
    // active area's origin; animates between areas during a year's pan.
    this.scrollX = this._activeOriginX;
    this.scrollY = this._activeOriginY;
    this._pan = null;   // { fromX, fromY, toX, toY, t } while a year pan runs

    // Island Y-pad: on a classic (single-window) level the island falloff spans
    // mapHeight + 2·worldPadY so the window is the CENTRE of a larger island (the 3D
    // over-scan reveals the rest). A world grid is already a larger-than-window land,
    // so it needs no pad — the neighbouring areas ARE the "beyond".
    this.worldPadY = this.hasWorldGrid ? 0
      : Math.max(0, (config.view3DWorldPad != null ? config.view3DWorldPad : 0)) * this.mapHeight;

    // Gameplay grid resolution. A world grid covers cols×rows windows; scale the
    // pixel size up so the full-world heightmap keeps ~the same cell count (and bake
    // cost) as a single window — coarser gameplay precision, same visuals via detail.
    const gridMult = this.hasWorldGrid
      ? ((wg && wg.pixelScaleMult) || Math.sqrt(this.worldGridCols * this.worldGridRows)) : 1;
    this.scale = config.pixelScale * gridMult;
    this.invScale = 1 / this.scale;
    this.gridCols = Math.ceil(this.worldW * this.invScale);
    this.gridRows = Math.ceil(this.worldH * this.invScale);

    // Render-only detail multiplier: bakes terrain buffers at N x the
    // resolution without touching the gameplay grid (pixelScale).
    // Supports fractions (e.g. 0.5 = half-resolution buffers).
    this.detail = Math.max(0.25, config.terrainDetail || 1);

    // PERF: getElevation() runs its OWN octave loop (config.octaves), so p5's default
    // per-call noiseDetail of 4 octaves was compounding — every noise() sample did 4
    // hidden Perlin evaluations on top of our fractal loop. Halve it: near-identical
    // terrain, ~2× faster noise across the whole heightmap + relief bake. (MISTAKES.md)
    if (typeof noiseDetail === 'function') noiseDetail(2, 0.5);

    this._initBiomeIndex();
    this._colorCache = new Map();
    this._snowColorsRGB = null;
    
    // Base cell colors (computed once, reused for all seasons)
    this._baseCellColors = null;
  }

  // ============================================
  // WORLD-GRID (continuous 2×2 land / yearly camera pan) HELPERS
  // ============================================

  // Circular tour of the grid areas. For a 2×2 E–W slope (col 1 = east/alps, col 0 =
  // west/shore) start at the east/alps window and loop west → down → east → up, so
  // year 1 is the alps→podocarp upper slope and year 2 pans down to the shore.
  // Falls back to a row-major snake for other shapes.
  _defaultQuadOrder(cols, rows) {
    if (cols === 2 && rows === 2) return [[1, 0], [0, 0], [0, 1], [1, 1]];
    const order = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) order.push([c, r]);
    return order;
  }

  // World-space top-left of the active area (window). Camera settles here.
  _updateActiveOrigin() {
    this._activeOriginX = this.activeCol * this.viewW;
    this._activeOriginY = this.activeRow * this.viewH;
  }

  _smoothstep(edge0, edge1, x) {
    if (edge1 === edge0) return x < edge0 ? 0 : 1;
    let t = (x - edge0) / (edge1 - edge0);
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return t * t * (3 - 2 * t);
  }

  _lerp(a, b, t) { return a + (b - a) * t; }

  // Reshape a raw elevation for the world's year (glacial advance). The alps→shore
  // SLOPE itself comes from the island falloff spanning the full width; this only
  // controls how HIGH the high country climbs.
  //
  // Opening (glacialAdvance 0): SCALE the land elevation toward the coast so the whole
  // slope is gentler — the alps top out low and the forest/subalpine band spreads far
  // up, so a window reads alps→podocarp rather than wall-to-wall scree & ice. Over the
  // years the scale releases to 1.0, so the alps rise back and glacial habitats come to
  // dominate. Seed-independent (a proportion). Coast/sea (≤ seaLevel) are never touched.
  _applyGridProfile(e) {
    if (!this.hasWorldGrid) return e;
    const sea = this.gridSeaLevel;
    if (e <= sea) return e;
    const advance = this.glacialAdvance || 0;
    const norm = this.gridGlacialFull > 0
      ? Math.min(1, advance / this.gridGlacialFull) : (advance > 0 ? 1 : 0);
    const scale = this._lerp(this.gridOpenLandScale, 1.0, norm);
    e = sea + (e - sea) * scale;
    return e < 0 ? 0 : (e > 1 ? 1 : e);
  }

  _initBiomeIndex() {
    this.biomeArray = this.biomeList.slice();
    this.biomeIndexByKey = {};
    for (let i = 0; i < this.biomeArray.length; i++) {
      this.biomeIndexByKey[this.biomeArray[i].key] = i;
    }
    
    // Cache commonly-needed biome roles by scanning properties
    // instead of assuming fixed keys exist
    this._waterBiome = null;
    this._snowBiome = null;
    this._fallbackBiome = null;
    
    for (const biome of this.biomeList) {
      // Water: the lowest non-walkable biome, or anything flagged isWater
      if (biome.isWater || (!biome.walkable && biome.maxElevation <= 0.15)) {
        if (!this._waterBiome || biome.minElevation < this._waterBiome.minElevation) {
          this._waterBiome = biome;
        }
      }
      // Snow: highest biome
      if (biome.key === 'snow' || biome.minElevation >= 0.85) {
        this._snowBiome = biome;
      }
      // Fallback: first walkable biome with plants
      if (!this._fallbackBiome && biome.walkable && biome.canHavePlants) {
        this._fallbackBiome = biome;
      }
    }
    
    // If no water biome found, use the lowest biome
    if (!this._waterBiome) {
      this._waterBiome = this.biomeList[0];
    }
    // If no snow biome, disable snow features
    // _snowBiome can stay null — we'll check before using
    // If no fallback, use the middle biome
    if (!this._fallbackBiome) {
      this._fallbackBiome = this.biomeList[Math.floor(this.biomeList.length / 2)];
    }
  }
  
  setSeasonManager(manager) {
    this.seasonManager = manager;
  }
  
  _initSnowColors() {
    if (!this._snowBiome) return;
    this._snowColorsRGB = this._snowBiome.colors.map(hex => {
      const c = this._getCachedColor(hex);
      return [red(c), green(c), blue(c)];
    });
  }
  
  getSnowLineElevation() {
    if (!this._snowBiome) return 1.0; // No snow in this level
    if (!this.seasonManager) {
      return this._snowBiome.minElevation;
    }
    
    const currentLine = this.seasonSnowLines[this.seasonManager.currentKey];
    const progress = this.seasonManager.transitionProgress;
    
    if (progress > 0) {
      const nextLine = this.seasonSnowLines[this.seasonManager.nextKey];
      return lerp(currentLine, nextLine, progress);
    }
    
    return currentLine;
  }
  
  isSeasonalSnow(elevation) {
    return elevation >= this.getSnowLineElevation();
  }
  
  getSnowCoverage(elevation) {
    if (!this._snowBiome) return 0;
    const snowLine = this.getSnowLineElevation();
    const permanentSnowLine = this._snowBiome.minElevation;
    
    if (elevation >= permanentSnowLine) return 1.0;
    if (elevation >= snowLine) {
      const range = permanentSnowLine - snowLine;
      if (range <= 0) return 1.0;
      return 0.4 + ((elevation - snowLine) / range) * 0.6;
    }
    return 0;
  }
  
  // ============================================
  // COORDINATE HELPERS
  // ============================================
  
  isInBounds(x, y) {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight;
  }
  
  clampToBounds(x, y) {
    return {
      x: Math.max(0, Math.min(this.mapWidth - 1, x)),
      y: Math.max(0, Math.min(this.mapHeight - 1, y))
    };
  }
  
  getRandomPosition(padding = 0) {
    return {
      x: padding + random() * (this.mapWidth - padding * 2),
      y: padding + random() * (this.mapHeight - padding * 2)
    };
  }
  
  // ============================================
  // NOISE GENERATION (unchanged)
  // ============================================
  
  fractalNoise(x, y) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    const noiseScale = this.config.noiseScale;
    const seed = this.seed;
    const persistence = this.config.persistence;
    const lacunarity = this.config.lacunarity;
    const octaves = this.config.octaves;
    
    for (let i = 0; i < octaves; i++) {
      total += noise(x * frequency * noiseScale + seed,
                     y * frequency * noiseScale + seed) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }
  
  ridgeNoise(x, y) {
    const n = this.fractalNoise(x * 0.5, y * 0.5);
    return 1 - Math.abs(n * 2 - 1);
  }
  
  getIslandFalloff(x, y) {
    // nx/ny normalise over the FULL land (worldW/worldH). On a classic level worldW ==
    // mapWidth and worldH == mapHeight, so this is unchanged; on a world grid the
    // falloff spans all cols×rows windows, making ONE continuous alps→shore descent
    // (low/sea at the west, high/alps at the east) that a single window only samples
    // part of. The pad still centres a classic island; a grid uses no pad (worldPadY 0).
    const nx = x / this.worldW;
    const pad = this.worldPadY || 0;
    const ny = (y + pad) / (this.worldH + 2 * pad);

    const warpX = noise(x * 0.01 + this.seed, y * 0.01) * 0.2;
    const warpY = noise(x * 0.01 + this.seed * 2, y * 0.01 + this.seed) * 0.2;
    
    const warpedNx = nx + warpX - 0.1;
    const warpedNy = ny + warpY - 0.1;
    
    let coastNoise = 0;
    coastNoise += noise(warpedNy * 1.5 + this.seed, this.seed * 0.5) * 0.4;
    coastNoise += noise(warpedNy * 3 + this.seed * 1.5, warpedNx * 0.5) * 0.2;
    coastNoise += noise(x * 0.02 + this.seed * 2, y * 0.02 + this.seed * 2) * 0.1;
    
    const coastlinePosition = 0.02 + coastNoise * 0.4;
    
    let falloff;
    if (warpedNx < coastlinePosition) {
      const seaDepth = (coastlinePosition - warpedNx) / coastlinePosition;
      falloff = (1 - seaDepth) * 0.12;
    } else {
      const landProgress = (warpedNx - coastlinePosition) / (1 - coastlinePosition);
      falloff = 0.13 + Math.pow(landProgress, 0.7) * 0.87;
      const ridgeNoise = noise(x * 0.012 + this.seed * 4, y * 0.012) * 0.2;
      falloff += ridgeNoise * landProgress;
    }
    
    // Clamp ny into [0,1] for the edge-softness term. Gameplay only ever samples
    // y ∈ [0,mapHeight] (a no-op here), but the fixed-3D relief bake samples rows
    // ABOVE the map (the far over-scan) where ny < 0 would make sin() negative and
    // pow(neg,0.3) = NaN. Saturating at the edge keeps the over-scan low coastal land.
    const nyC = ny < 0 ? 0 : (ny > 1 ? 1 : ny);
    const edgeSoftness = Math.pow(Math.sin(nyC * Math.PI), 0.3);
    falloff *= 0.6 + edgeSoftness * 0.4;

    return Math.max(0, Math.min(1, falloff));
  }
  
  getElevation(x, y) {
    // (x, y) are FULL-WORLD coordinates. On a world grid the whole land is one
    // continuous noise field + falloff, so no per-area offset — neighbouring areas
    // flow into each other (podo forest stretches downslope from area to area).

    // changing falloff
    const base = this.fractalNoise(x, y);
    const ridge = this.ridgeNoise(x, y);
    let elevation = base * (1 - this.config.ridgeInfluence) + ridge * this.config.ridgeInfluence;
    elevation = Math.pow(elevation, this.config.elevationPower);

    if (this.config.useLakes) {
      // Inland terrain: no coastal falloff
      // Instead, create lake basins by depressing low areas further
      elevation = this._applyLakeBasins(x, y, elevation);
    } else {
      // Original coastal island behavior
      const falloff = this.getIslandFalloff(x, y);
      elevation *= falloff;
    }
    // Gentle alps + broad forest at the opening; glacial habitats spread over the years.
    elevation = this._applyGridProfile(elevation);
    return Math.max(0, Math.min(1, elevation));
  }

  _applyLakeBasins(x, y, elevation) {
    const lakeNoiseScale = this.config.lakeNoiseScale || 0.008;
    const lakeThreshold = this.config.lakeThreshold || 0.12;
    
    // Secondary noise determines where lakes form
    const lakeNoise = noise(
      x * lakeNoiseScale + this.seed * 3,
      y * lakeNoiseScale + this.seed * 3.7
    );
    
    // Lakes form where both the terrain is low AND lake noise is high
    // This creates distinct basins rather than flooding all low ground
    if (elevation < 0.25 && lakeNoise > 0.5) {
      // How deep into the lake zone
      const basinStrength = (0.25 - elevation) * (lakeNoise - 0.5) * 4;
      elevation -= basinStrength * 0.3;
      
      // Clamp to create flat lake floors
      if (elevation < lakeThreshold * 0.5) {
        elevation = lakeThreshold * 0.3 + 
          noise(x * 0.05, y * 0.05) * lakeThreshold * 0.15;
      }
    }
    
    // Soft edge falloff at map borders (not ocean, just prevents
    // entities walking off the edge). Y through the padded island domain so the
    // play window is interior and the near/far over-scan tapers at the world edge.
    const pad = this.worldPadY || 0;
    const nx = x / this.worldW;
    const ny = (y + pad) / (this.worldH + 2 * pad);
    const edgeDist = Math.min(nx, 1 - nx, ny, 1 - ny);
    const edgeFalloff = Math.min(1, edgeDist * 12);
    elevation *= 0.3 + edgeFalloff * 0.7;
    
    return elevation;
  }
  
  // ============================================
  // LOOKUPS
  // ============================================
  
  // Entity-facing lookups take WINDOW coords (0..viewW/viewH). Offset by the active
  // area's world origin so they read that area's slice of the continuous heightmap.
  // (_activeOriginX/Y are 0 on a classic single-window level.)
  getElevationAt(x, y) {
    const col = ((x + this._activeOriginX) * this.invScale) | 0;
    const row = ((y + this._activeOriginY) * this.invScale) | 0;
    if (col < 0 || row < 0 || col >= this.gridCols || row >= this.gridRows) return 0.5;
    return this.heightMap[row * this.gridCols + col];
  }
  
  getBiomeFromElevation(elevation) {
    for (let i = 0; i < this.biomeList.length; i++) {
      const biome = this.biomeList[i];
      if (elevation >= biome.minElevation && elevation < biome.maxElevation) {
        return biome;
      }
    }
    return this.biomeList[this.biomeList.length - 1];
  }
  

  getBiomeAt(x, y) {
    const col = ((x + this._activeOriginX) * this.invScale) | 0;
    const row = ((y + this._activeOriginY) * this.invScale) | 0;
    if (col < 0 || row < 0 || col >= this.gridCols || row >= this.gridRows) {
      return this._fallbackBiome;
    }
    return this.biomeArray[this.biomeIndexMap[row * this.gridCols + col]];
  }
  
  getEffectiveBiomeAt(x, y) {
    if (this._snowBiome) {
      const elevation = this.getElevationAt(x, y);
      if (this.isSeasonalSnow(elevation)) return this._snowBiome;
    }
    return this.getBiomeAt(x, y);
  }
  
  isWalkable(x, y) {
    return this.getEffectiveBiomeAt(x, y).walkable;
  }
  
  canPlace(x, y) {
    if (!this.isInBounds(x, y)) return false;
    return this.getEffectiveBiomeAt(x, y).canPlace;
  }
  
  _getCachedColor(hexColor) {
    let c = this._colorCache.get(hexColor);
    if (!c) {
      c = color(hexColor);
      this._colorCache.set(hexColor, c);
    }
    return c;
  }
  
  getColor(elevation, biome) {
    const colors = biome.colors;
    const range = biome.maxElevation - biome.minElevation;
    const position = (elevation - biome.minElevation) / range;
    const clampedPos = Math.max(0, Math.min(1, position));
    
    const colorIndex = clampedPos * (colors.length - 1);
    const lowerIndex = colorIndex | 0;
    const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
    const t = colorIndex - lowerIndex;
    
    if (t < 0.01) return this._getCachedColor(colors[lowerIndex]);
    if (t > 0.99) return this._getCachedColor(colors[upperIndex]);
    
    return lerpColor(
      this._getCachedColor(colors[lowerIndex]),
      this._getCachedColor(colors[upperIndex]),
      t
    );
  }
  
  hasAdjacentWater(row, col) {
    if (!this._waterBiome) return false;
    const gridCols = this.gridCols;
    const gridRows = this.gridRows;
    const waterMax = this._waterBiome.maxElevation;
    
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
          if (this.heightMap[nr * gridCols + nc] < waterMax) return true;
        }
      }
    }
    return false;
  }
  
  // ============================================
  // GENERATION
  // ============================================
  
  generate() {
    // A fresh terrain invalidates any cached relief bake — it must re-project
    // the new land the next time the 3D view is used.
    this._disposeReliefBuffers();

    const gridCols = this.gridCols;
    const gridRows = this.gridRows;
    const totalCells = gridCols * gridRows;
    const scale = this.scale;
    
    this.heightMap = new Float32Array(totalCells);
    this.biomeIndexMap = new Uint8Array(totalCells);
    
    // Generate height map
    let idx = 0;
    for (let row = 0; row < gridRows; row++) {
      const y = row * scale;
      for (let col = 0; col < gridCols; col++) {
        this.heightMap[idx] = this.getElevation(col * scale, y);
        idx++;
      }
    }
    
    // Generate biome map
    idx = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const elevation = this.heightMap[idx];
        let biome = this.getBiomeFromElevation(elevation);
        // water type handling (lake or sea)
        if (biome === this.biomeList[1] && this._waterBiome) {
          if (!this.hasAdjacentWater(row, col)) {
            biome = this._fallbackBiome;
          }
        }
        
        this.biomeIndexMap[idx] = this.biomeIndexByKey[biome.key];
        idx++;
      }
    }
    
    // Build high-resolution maps used only for rendering
    this._buildRenderMaps();

    this._initSnowColors();

    // Compute base cell colors (without snow)
    this._computeBaseCellColors();
    
    // Pre-bake all 4 seasonal buffers
    this._bakeAllSeasonBuffers();
  }
  
  /**
   * Build render-resolution height/biome maps (detail x the gameplay grid).
   * Used only for baking terrain buffers — gameplay lookups stay on the
   * coarse heightMap/biomeIndexMap.
   */
  _buildRenderMaps() {
    const detail = this.detail;

    if (detail === 1) {
      this.renderCols = this.gridCols;
      this.renderRows = this.gridRows;
      this.renderHeightMap = this.heightMap;
      this.renderBiomeIndexMap = this.biomeIndexMap;
      return;
    }

    const renderCols = Math.ceil(this.gridCols * detail);
    const renderRows = Math.ceil(this.gridRows * detail);
    const renderScale = this.scale / detail;

    this.renderCols = renderCols;
    this.renderRows = renderRows;
    this.renderHeightMap = new Float32Array(renderCols * renderRows);
    this.renderBiomeIndexMap = new Uint8Array(renderCols * renderRows);

    // PERF: the render map is VISUAL-ONLY (bakes the terrain buffers). It used to
    // re-sample getElevation() — i.e. run the full multi-octave noise stack — for
    // every one of renderCols×renderRows cells (detail² × the gameplay grid), which
    // was ~85% of world-gen time (≈20s at detail 2). Instead, bilinearly UPSCALE the
    // coarse heightMap the gameplay grid already built: a smooth interpolation, no
    // noise, ~free. Biome is derived from the interpolated elevation, keeping the
    // coarse-grid water fallback so lakes/sea still match gameplay. (See MISTAKES.md.)
    const gc = this.gridCols, gr = this.gridRows, hm = this.heightMap;
    let idx = 0;
    for (let row = 0; row < renderRows; row++) {
      const cy = row / detail;
      const r0 = Math.min(gr - 1, cy | 0), r1 = Math.min(gr - 1, r0 + 1);
      const fy = cy - (cy | 0);
      for (let col = 0; col < renderCols; col++) {
        const cx = col / detail;
        const c0 = Math.min(gc - 1, cx | 0), c1 = Math.min(gc - 1, c0 + 1);
        const fx = cx - (cx | 0);
        const h00 = hm[r0 * gc + c0], h01 = hm[r0 * gc + c1];
        const h10 = hm[r1 * gc + c0], h11 = hm[r1 * gc + c1];
        const top = h00 + (h01 - h00) * fx;
        const elevation = top + ((h10 + (h11 - h10) * fx) - top) * fy;
        this.renderHeightMap[idx] = elevation;

        let biome = this.getBiomeFromElevation(elevation);
        // Lake/sea fallback checked on the coarse grid so water bodies match gameplay.
        if (biome === this.biomeList[1] && this._waterBiome) {
          if (!this.hasAdjacentWater(r0, c0)) biome = this._fallbackBiome;
        }
        this.renderBiomeIndexMap[idx] = this.biomeIndexByKey[biome.key];
        idx++;
      }
    }
  }

  /**
   * Compute base terrain colors once (reused for all seasons)
   */
  _computeBaseCellColors() {
    const gridCols = this.renderCols;
    const gridRows = this.renderRows;
    const totalCells = gridCols * gridRows;

    // Store RGB + contour flag for each cell
    this._baseCellColors = new Uint8Array(totalCells * 4); // R, G, B, isContour

    const showContours = this.config.showContours;
    const contourInterval = this.config.contourInterval;
    // Half-width of a contour band, in elevation units. The band spans
    // 2 x this out of every contourInterval, so it covers
    // (2 * contourWidth / contourInterval) of the map. At the old hardcoded
    // 0.008 against an interval of 0.045 that was ~36% — bands, not lines.
    const contourWidth = (this.config.contourWidth != null)
      ? this.config.contourWidth : 0.008;

    // PERF: precompute each biome's colour stops as raw [r,g,b] (once), then lerp in
    // plain numbers straight into the Uint8Array. The old path called getColor() —
    // which allocates a fresh p5.Color via lerpColor() — then red()/green()/blue() on
    // every one of ~600K render cells (~5.7s). Numeric lerp is ~20× faster and pixel-
    // identical. (See MISTAKES.md.)
    const stops = this.biomeArray.map(b =>
      (b && b.colors && b.colors.length) ? b.colors.map(h => this._hexToRGB(h)) : [[128, 128, 128]]);

    let idx = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellIdx = row * gridCols + col;
        const elevation = this.renderHeightMap[cellIdx];
        const biomeIdx = this.renderBiomeIndexMap[cellIdx];
        const biome = this.biomeArray[biomeIdx];
        const bs = stops[biomeIdx];
        const colorIdx = cellIdx * 4;

        const range = biome.maxElevation - biome.minElevation;
        let pos = range > 0 ? (elevation - biome.minElevation) / range : 0;
        pos = pos < 0 ? 0 : (pos > 1 ? 1 : pos);
        const ci = pos * (bs.length - 1);
        const lo = ci | 0, hi = lo + 1 < bs.length ? lo + 1 : bs.length - 1, t = ci - lo;
        const a = bs[lo], b2 = bs[hi];
        this._baseCellColors[colorIdx] = a[0] + (b2[0] - a[0]) * t;
        this._baseCellColors[colorIdx + 1] = a[1] + (b2[1] - a[1]) * t;
        this._baseCellColors[colorIdx + 2] = a[2] + (b2[2] - a[2]) * t;

        // Check if this is a contour line
        if (showContours) {
          const mod = elevation % contourInterval;
          this._baseCellColors[colorIdx + 3] = (mod < contourWidth || mod > contourInterval - contourWidth) ? 1 : 0;
        } else {
          this._baseCellColors[colorIdx + 3] = 0;
        }
      }
    }
  }

  // Hex string → [r,g,b] (0-255), reusing the p5.Color parse cache. Used to build the
  // numeric colour-stop tables that keep _computeBaseCellColors off the p5.Color path.
  _hexToRGB(hex) {
    const c = this._getCachedColor(hex);
    if (c && c.levels) return [c.levels[0], c.levels[1], c.levels[2]];
    return [red(c), green(c), blue(c)];
  }
  
  /**
   * Pre-bake all 4 seasonal terrain buffers
   */
  _bakeAllSeasonBuffers() {
    const seasons = ['summer', 'autumn', 'winter', 'spring'];
    
    for (const season of seasons) {
      this.seasonBuffers[season] = this._bakeSeasonBuffer(season);
    }
    
    if (CONFIG.debugMode) {
      console.log('Pre-baked all 4 seasonal terrain buffers');
    }
  }
  
  /**
   * Bake a single season's terrain buffer using direct pixel manipulation.
   * Sized to the FULL world (worldW×worldH) — on a classic level that equals the
   * window; on a world grid it is the whole continuous land, which render() then
   * pans across. The px→render-cell mapping (invScale) is unchanged, so widening
   * the buffer simply covers more render cells.
   */
  _bakeSeasonBuffer(seasonKey) {
    const detail = this.detail;
    const buf = createGraphics(Math.ceil(this.worldW * detail),
                               Math.ceil(this.worldH * detail));
    if (this.hasWorldGrid && buf.pixelDensity) buf.pixelDensity(1);   // ¼ pixels; drawn scaled anyway
    buf.loadPixels();

    const d = buf.pixelDensity();
    const gridCols = this.renderCols;
    const gridRows = this.renderRows;
    const cellColors = this._computeSeasonCellColors(seasonKey);

    // Fill buffer pixels
    // Buffer is (mapWidth*detail) wide; a render cell covers scale/detail
    // world px = scale buffer px, so px -> cell mapping is px * invScale / d
    const fullWidth = buf.width * d;
    const fullHeight = buf.height * d;
    const invScaleD = this.invScale / d;
    const maxCol = gridCols - 1;
    const maxRow = gridRows - 1;

    for (let py = 0; py < fullHeight; py++) {
      const gridRow = Math.min(maxRow, (py * invScaleD) | 0);
      const rowOffset = gridRow * gridCols;

      for (let px = 0; px < fullWidth; px++) {
        const gridCol = Math.min(maxCol, (px * invScaleD) | 0);
        const colorIdx = (rowOffset + gridCol) * 3;
        const pixelIdx = (py * fullWidth + px) * 4;

        buf.pixels[pixelIdx] = cellColors[colorIdx];
        buf.pixels[pixelIdx + 1] = cellColors[colorIdx + 1];
        buf.pixels[pixelIdx + 2] = cellColors[colorIdx + 2];
        buf.pixels[pixelIdx + 3] = 255;
      }
    }

    buf.updatePixels();
    return buf;
  }

  /**
   * Compute the per-render-cell RGB for one season: the base ground colour,
   * blended toward snow above the season's snow line, with contour shading.
   * Returns a Uint8Array of renderCols*renderRows*3. Shared by the flat bake
   * (_bakeSeasonBuffer) and the relief bake (_bakeReliefBuffer) so the two views
   * cannot drift apart in colour.
   */
  // `src` overrides the source maps (used by the fixed-3D relief bake, which works
  // over an over-scanned domain). Defaults to the render maps → the flat bake path.
  _computeSeasonCellColors(seasonKey, src) {
    const gridCols = src ? src.cols : this.renderCols;
    const gridRows = src ? src.rows : this.renderRows;
    const heightMap = src ? src.heightMap : this.renderHeightMap;
    const baseCellColors = src ? src.baseColors : this._baseCellColors;
    const biomeMap = src ? src.biomeMap : this.renderBiomeIndexMap;
    const snowColorsRGB = this._snowColorsRGB;
    const hasSnow = this._snowBiome && snowColorsRGB;

    const snowLine = this.seasonSnowLines[seasonKey];
    const permanentSnowLine = hasSnow ? this._snowBiome.minElevation : 1.0;

    let snowContourRGB = [176, 176, 176]; // default grey
    if (hasSnow) {
      const snowContourColor = this._getCachedColor(this._snowBiome.contourColor);
      snowContourRGB = [red(snowContourColor), green(snowContourColor), blue(snowContourColor)];
    }

    // How strongly a contour cell is pulled toward contourColor.
    // 1.0 = the old behaviour (flat replacement), 0.35 = a gentle shading of
    // whatever the ground colour already was, 0 = invisible.
    const contourStrength = (this.config.contourStrength != null)
      ? this.config.contourStrength : 1.0;

    // Pre-compute cell colors with snow for this season
    const cellColors = new Uint8Array(gridCols * gridRows * 3);

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellIdx = row * gridCols + col;
        const elevation = heightMap[cellIdx];
        const baseIdx = cellIdx * 4;
        const outIdx = cellIdx * 3;

        const isContour = baseCellColors[baseIdx + 3] === 1;

        // 1. Resolve the ground colour for this cell (base, or base blended
        //    toward snow for the season), ignoring contours entirely.
        let gR, gB, gG;
        let contourRGB = null;

        if (hasSnow && elevation >= snowLine) {
          // Calculate snow coverage
          let snowCoverage;
          if (elevation >= permanentSnowLine) {
            snowCoverage = 1.0;
          } else {
            const range = permanentSnowLine - snowLine;
            snowCoverage = range > 0 ? 0.4 + ((elevation - snowLine) / range) * 0.6 : 1.0;
          }

          // Add subtle noise for natural look
          const noiseVal = (Math.sin(elevation * 847 + col * 0.13 + row * 0.17) * 0.5 + 0.5) * 0.12;
          snowCoverage = Math.min(1, snowCoverage + noiseVal);

          const snowIdx = Math.min(snowColorsRGB.length - 1, (snowCoverage * snowColorsRGB.length) | 0);
          const snowRGB = snowColorsRGB[snowIdx];

          const baseR = baseCellColors[baseIdx];
          const baseG = baseCellColors[baseIdx + 1];
          const baseB = baseCellColors[baseIdx + 2];

          gR = baseR + (snowRGB[0] - baseR) * snowCoverage;
          gG = baseG + (snowRGB[1] - baseG) * snowCoverage;
          gB = baseB + (snowRGB[2] - baseB) * snowCoverage;

          if (isContour) contourRGB = snowContourRGB;
        } else {
          gR = baseCellColors[baseIdx];
          gG = baseCellColors[baseIdx + 1];
          gB = baseCellColors[baseIdx + 2];

          if (isContour) {
            const biomeIdx = biomeMap[cellIdx];
            const biome = this.biomeArray[biomeIdx];
            const contourC = this._getCachedColor(biome.contourColor);
            contourRGB = [red(contourC), green(contourC), blue(contourC)];
          }
        }

        // 2. Shade the contour over the top, rather than replacing it.
        if (contourRGB && contourStrength > 0) {
          const s = contourStrength;
          cellColors[outIdx]     = gR + (contourRGB[0] - gR) * s;
          cellColors[outIdx + 1] = gG + (contourRGB[1] - gG) * s;
          cellColors[outIdx + 2] = gB + (contourRGB[2] - gB) * s;
        } else {
          cellColors[outIdx]     = gR;
          cellColors[outIdx + 1] = gG;
          cellColors[outIdx + 2] = gB;
        }
      }
    }

    return cellColors;
  }

  // ============================================
  // FIXED-3D RELIEF BAKE
  // ============================================
  // Re-project one season's ground into a taller buffer so the ranges STAND UP,
  // ported from Te Manawa's plan-oblique column painter. For each buffer column
  // it walks the source rows near→far, lifts each cell by elev·LIFT, and paints a
  // vertical span from the projected top down to whatever nearer terrain already
  // occluded (the "ceiling"). Higher ground therefore hides the ground behind it,
  // the lower part of a tall rise is shaded as a cliff FACE, a prominent silhouette
  // gets a dark ink lip, and the sky above the far ridge fades to haze.
  //
  // Colours come from _computeSeasonCellColors so 2D and 3D never diverge; the
  // billboarded cast (mauri_simulation.js) is placed with the SAME Projection so
  // feet land on the relief.

  // Build the over-scanned source the relief bake paints from: the render maps
  // plus extra rows generated ABOVE (far distance) and BELOW (near foreground) the
  // map. The in-domain rows are COPIED verbatim so the visible relief matches the
  // flat bake exactly; only the over-scan is sampled fresh. The far over-scan lets
  // the tilted distance recede past the top of the frame; the near over-scan lets
  // the foreground continue under the bottom HUD bar so neither end shows a cut.
  // Cached across the four season bakes; rebuilt when the terrain or knobs change.
  _buildReliefSource() {
    const cols = this.renderCols;
    const fullRows = this.renderRows;
    const detail = this.detail;
    const renderScale = this.scale / detail;

    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const overFar = Math.max(0, cfg.view3DOverscan != null ? cfg.view3DOverscan : 0.45);
    const overNear = Math.max(0, cfg.view3DOverscanNear != null ? cfg.view3DOverscanNear : 0.28);

    // PER-ROW relief: bake only the ACTIVE ROW's window depth, full width, so ONE
    // window fills the frame (no full-world depth squash). The over-scan reads the
    // neighbouring rows — real terrain already in the render maps — or, past the world's
    // top/bottom edge, samples the falloff. A horizontal (E–W) pan then just scrolls X
    // across this buffer; a row change (N–S) re-bakes (see _ensureReliefBuffers).
    const winRows = this.hasWorldGrid ? Math.round(fullRows / this.worldGridRows) : fullRows;
    const rowOff = this.hasWorldGrid ? (this.activeRow * winRows) : 0;
    const marginFar = Math.round(overFar * winRows);
    const marginNear = Math.round(overNear * winRows);
    const extRows = marginFar + winRows + marginNear;

    const extHeight = new Float32Array(cols * extRows);
    const extBiome = new Uint8Array(cols * extRows);
    const extBase = new Uint8Array(cols * extRows * 4);

    const showContours = this.config.showContours;
    const contourInterval = this.config.contourInterval;
    const contourWidth = (this.config.contourWidth != null) ? this.config.contourWidth : 0.008;

    for (let er = 0; er < extRows; er++) {
      const rw = er - marginFar;          // depth row within the window (<0 far, >=winRows near)
      const worldRow = rowOff + rw;       // world render-row
      const dstRow = er * cols;

      if (worldRow >= 0 && worldRow < fullRows) {
        // In the world (the active window OR a real neighbouring row): copy the render
        // maps so the visible relief matches the flat bake exactly.
        const srcRow = worldRow * cols;
        for (let c = 0; c < cols; c++) {
          extHeight[dstRow + c] = this.renderHeightMap[srcRow + c];
          extBiome[dstRow + c] = this.renderBiomeIndexMap[srcRow + c];
          const s4 = (srcRow + c) * 4, d4 = (dstRow + c) * 4;
          extBase[d4]     = this._baseCellColors[s4];
          extBase[d4 + 1] = this._baseCellColors[s4 + 1];
          extBase[d4 + 2] = this._baseCellColors[s4 + 2];
          extBase[d4 + 3] = this._baseCellColors[s4 + 3];
        }
      } else {
        // Past the world's top/bottom edge: sample fresh (the falloff tapers to coast).
        const worldY = worldRow * renderScale;
        for (let c = 0; c < cols; c++) {
          const elev = this.getElevation(c * renderScale, worldY);
          const biome = this.getBiomeFromElevation(elev);
          const col = this.getColor(elev, biome);
          const d4 = (dstRow + c) * 4;
          extHeight[dstRow + c] = elev;
          extBiome[dstRow + c] = this.biomeIndexByKey[biome.key];
          extBase[d4]     = red(col);
          extBase[d4 + 1] = green(col);
          extBase[d4 + 2] = blue(col);
          let isC = 0;
          if (showContours) {
            const m = elev % contourInterval;
            isC = (m < contourWidth || m > contourInterval - contourWidth) ? 1 : 0;
          }
          extBase[d4 + 3] = isC;
        }
      }
    }

    this._reliefMarginFar = marginFar;
    this._reliefMarginNear = marginNear;
    this._reliefExtRows = extRows;
    this._reliefInRows = winRows;         // the bake's in-domain depth (one window)
    this._reliefSrc = { heightMap: extHeight, biomeMap: extBiome, baseColors: extBase, cols, rows: extRows };
    this._reliefBakedOverFar = overFar;
    this._reliefBakedOverNear = overNear;
    this._reliefBakedRow = this.activeRow;   // which row this relief is baked for
  }

  _bakeReliefBuffer(seasonKey) {
    const P = Projection;
    const cols = this.renderCols;        // buffer width == render columns (projX identity)
    const inRows = this._reliefInRows || this.renderRows;   // ONE window's depth (per-row bake)
    const detail = this.detail;
    const renderScale = this.scale / detail;

    const marginFar = this._reliefMarginFar;
    const marginNear = this._reliefMarginNear;
    const extRows = this._reliefExtRows;
    const nearMostRw = inRows - 1 + marginNear;

    const K = P.K;
    // Relief height in render-row units, over ONE window's depth — matches the
    // window-based Projection.LIFT (billboards use liftFrac·viewH) and fills the frame.
    const LIFT = P.liftFrac * inRows;
    const P0 = marginFar * K;            // index offset so the far over-scan sits at buffer top

    // Buffer height: the near-most over-scan row (flat) → nearMostRw·K + LIFT + P0.
    const bufH = Math.ceil(nearMostRw * K + LIFT + P0) + 1;
    // World-unit draw height. bufH is in projected RENDER-ROW px; one render row is
    // renderScale world units, so scale by renderScale (= scale/detail). The old
    // `bufH/detail` assumed pixelScale 1 (renderScale = 1/detail) — true for classic
    // levels but half-height on a world grid (pixelScaleMult raises scale), which left
    // a black gap under the relief. reliefDrawY already uses renderScale.
    this._reliefWorldH = bufH * this.scale / detail;   // = bufH * renderScale
    this._reliefDrawY = -P0 * renderScale;             // world y of the buffer's top row (< 0: above frame)

    const buf = createGraphics(cols, bufH);
    // Full-world grid buffers are large and always drawn scaled, so bake them at
    // device density 1 (¼ the pixels of a retina bake) — a big win on the 4×-area
    // relief bake, invisible once the buffer is scaled to the viewport.
    if (this.hasWorldGrid && buf.pixelDensity) buf.pixelDensity(1);
    buf.loadPixels();
    const d = buf.pixelDensity();
    const fullW = buf.width * d;
    const fullH = buf.height * d;
    const px = buf.pixels;

    const src = this._reliefSrc;
    const cellColors = this._computeSeasonCellColors(seasonKey, src);
    const heightMap = src.heightMap;
    const biomeIdxMap = src.biomeMap;
    const waterIdx = this._waterBiome ? this.biomeIndexByKey[this._waterBiome.key] : -1;

    // Look constants (device-pixel scaled). FACEMIN gates the dark cliff face so
    // only genuinely tall rises get it — gentle and moderate slopes stay lit,
    // which stops steep cel-faces (bright snow especially) from reading as
    // vertical streaks. TOPBAND is the lit cap above a real face.
    const SHADE = 4.0;                 // directional NW slope-shading strength
    const SHLO = 0.76, SHHI = 1.06;    // clamp for the shade multiplier
    const FACE = 0.72;                 // cliff-face brightness vs the top
    const TOPBAND = Math.max(1, Math.round(3 * d));
    const FACEMIN = Math.max(2, Math.round(9 * d));   // min span (px) before a face is drawn at all
    const CLIFF = Math.max(2, Math.round(12 * d));    // min span (px) to ink a silhouette
    const EDGEW = Math.max(1, Math.round(1 * d));
    const haze = (typeof CONFIG !== 'undefined' && CONFIG.view3DHaze) || [206, 220, 230];
    const hazeR = haze[0], hazeG = haze[1], hazeB = haze[2];
    const edgeRGB = (typeof CONFIG !== 'undefined' && CONFIG.view3DEdge) || [38, 46, 42];
    const reR = edgeRGB[0], reG = edgeRGB[1], reB = edgeRGB[2];

    // Aerial perspective: blend each cell toward the haze colour by DISTANCE (how
    // far it is up-map), so the body dissolves smoothly into the haze at the far
    // end instead of ending in a hard, flatter-looking band. Near stays crisp.
    const FADE_MAX = (typeof CONFIG !== 'undefined' && CONFIG.view3DHazeFade != null) ? CONFIG.view3DHazeFade : 0.72;
    const FADE_POW = 1.5;
    const distDen = (inRows - 1 + marginFar) || 1;    // rw at near map edge → 0, farthest → 1

    for (let pc = 0; pc < fullW; pc++) {
      const scol = Math.min(cols - 1, (pc / d) | 0);
      let ceiling = fullH;
      let farR = 0, farG = 0, farB = 0, painted = false;

      for (let er = extRows - 1; er >= 0; er--) {           // near → far
        const rw = er - marginFar;
        const i = er * cols + scol;
        const e = heightMap[i];
        let liftE = (biomeIdxMap[i] === waterIdx) ? 0 : e;  // water stays flat (no cliff at the shore)
        // Taper relief to zero across the coastal shelf so the waterline is a
        // clean edge, not a blocky wall (paint-only; terrain shape unchanged).
        if (liftE > 0 && liftE < 0.25) {
          const ct = (liftE - 0.10) / 0.15;
          liftE *= ct < 0 ? 0 : ct > 1 ? 1 : ct;
        }

        let yTop = ((rw * K - liftE * LIFT + LIFT + P0) * d) | 0;
        if (yTop < 0) yTop = 0;
        if (yTop >= ceiling) continue;                      // occluded by nearer terrain

        const ci = i * 3;
        let cr = cellColors[ci], cg = cellColors[ci + 1], cb = cellColors[ci + 2];

        // Directional (NW-lit) slope shade — north = the farther row (er-1).
        const eN = (er > 0) ? heightMap[i - cols] : e;
        const eW = (scol > 0) ? heightMap[i - 1] : e;
        let sh = 1 - ((e - eN) + (e - eW)) * 0.5 * SHADE;
        if (sh < SHLO) sh = SHLO; else if (sh > SHHI) sh = SHHI;
        let tr = (cr * sh) | 0, tg = (cg * sh) | 0, tb = (cb * sh) | 0;
        if (tr > 255) tr = 255; if (tg > 255) tg = 255; if (tb > 255) tb = 255;

        // Distance haze (aerial perspective) on this cell.
        if (FADE_MAX > 0) {
          let dt = (inRows - 1 - rw) / distDen;
          if (dt < 0) dt = 0; else if (dt > 1) dt = 1;
          const f = Math.pow(dt, FADE_POW) * FADE_MAX;
          if (f > 0) {
            tr = (tr + (hazeR - tr) * f) | 0;
            tg = (tg + (hazeG - tg) * f) | 0;
            tb = (tb + (hazeB - tb) * f) | 0;
          }
        }
        const fr = (tr * FACE) | 0, fg = (tg * FACE) | 0, fb = (tb * FACE) | 0;

        const spanH = ceiling - yTop;
        const isFront = (er === extRows - 1);
        const showFace = !isFront && spanH > FACEMIN;       // only real cliffs get a dark face
        const lip = (showFace && spanH > CLIFF) ? EDGEW : 0;

        for (let y = yTop; y < ceiling; y++) {
          const band = y - yTop;
          let rr, gg, bb;
          if (band < lip) { rr = reR; gg = reG; bb = reB; }          // dark silhouette ink
          else if (!showFace || band < TOPBAND) { rr = tr; gg = tg; bb = tb; }
          else { rr = fr; gg = fg; bb = fb; }                        // cliff face
          const pi = (y * fullW + pc) * 4;
          px[pi] = rr; px[pi + 1] = gg; px[pi + 2] = bb; px[pi + 3] = 255;
        }
        ceiling = yTop;
        farR = tr; farG = tg; farB = tb; painted = true;
      }

      // Sky above the far-most ridge → fade the ridge colour up into haze. With
      // the over-scan the far land reaches most of the way up, so this is now just
      // a thin band above the highest distant peak.
      for (let y = 0; y < ceiling; y++) {
        let rr, gg, bb;
        if (painted) {
          const t = y / ceiling, tt = t * t, inv = 1 - tt;
          rr = (hazeR * inv + farR * tt) | 0;
          gg = (hazeG * inv + farG * tt) | 0;
          bb = (hazeB * inv + farB * tt) | 0;
        } else { rr = hazeR; gg = hazeG; bb = hazeB; }
        const pi = (y * fullW + pc) * 4;
        px[pi] = rr; px[pi + 1] = gg; px[pi + 2] = bb; px[pi + 3] = 255;
      }
    }

    buf.updatePixels();
    return buf;
  }

  // Bake all four relief buffers on demand (first 3D switch, or after a regen).
  // A one-time hitch of a few hundred ms — the same cost class as the flat bake.
  _ensureReliefBuffers() {
    if (typeof Projection === 'undefined') return;
    // Re-bake if any bake-time 3D knob changed since the cached bake (so tuning
    // view3DK / view3DLiftFrac / over-scan / haze fade at runtime takes effect on
    // the next toggle); otherwise reuse the cache so toggling stays instant.
    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const overFar = cfg.view3DOverscan != null ? cfg.view3DOverscan : 0.45;
    const overNear = cfg.view3DOverscanNear != null ? cfg.view3DOverscanNear : 0.28;
    const hazeFade = cfg.view3DHazeFade != null ? cfg.view3DHazeFade : 0.72;
    // Re-bake on a knob change OR (world grid) when the camera has moved to a new ROW,
    // since the relief is baked per-row (one window's depth) to fill the frame.
    if (this.reliefBuffers.summer &&
        (this._reliefBakedK !== Projection.K || this._reliefBakedLift !== Projection.liftFrac ||
         this._reliefBakedOverFar !== overFar || this._reliefBakedOverNear !== overNear ||
         this._reliefBakedFade !== hazeFade ||
         (this.hasWorldGrid && this._reliefBakedRow !== this.activeRow))) {
      this._disposeReliefBuffers();
    }
    if (this.reliefBuffers.summer) return;

    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0;
    this._buildReliefSource();
    const seasons = ['summer', 'autumn', 'winter', 'spring'];
    for (const season of seasons) {
      this.reliefBuffers[season] = this._bakeReliefBuffer(season);
    }
    this._reliefSrc = null;   // the per-season buffers are baked; drop the ~large source arrays
    this._reliefBakedK = Projection.K;
    this._reliefBakedLift = Projection.liftFrac;
    this._reliefBakedFade = hazeFade;   // _reliefBakedOver{Far,Near} are set in _buildReliefSource
    if (CONFIG.debugMode) {
      const t1 = (typeof performance !== 'undefined') ? performance.now() : 0;
      console.log(`[3D] baked 4 relief terrain buffers in ${(t1 - t0).toFixed(0)}ms`);
    }
  }

  _disposeReliefBuffers() {
    for (const key in this.reliefBuffers) {
      const b = this.reliefBuffers[key];
      if (b && typeof b.remove === 'function') b.remove();   // free the GPU-backed canvas
      this.reliefBuffers[key] = null;
    }
  }

  regenerate() {
    this.seed = random(10000);
    this._colorCache.clear();
    this.generate();
  }
  
  /**
   * Render terrain — draw the pre-baked FULL-WORLD buffer offset by the camera scroll,
   * so the active area's window fills the play area. On a classic level the buffer is
   * one window and scroll is 0, so this is the old behaviour. On a world grid the year
   * pan animates the scroll across the continuous land. Season crossfade preserved.
   */
  render() {
    const use3D = (typeof CONFIG !== 'undefined' && CONFIG.view3D &&
                   typeof Projection !== 'undefined' && Projection.relief);
    if (use3D) this._ensureReliefBuffers();

    const curKey = this.seasonManager ? this.seasonManager.currentKey : 'summer';
    const sx = this.scrollX || 0, sy = this.scrollY || 0;
    const isRelief = !!(use3D && this.reliefBuffers && this.reliefBuffers[curKey]);
    const set = isRelief ? this.reliefBuffers : this.seasonBuffers;
    if (!set) return;
    const cur = set[curKey] || set.summer;
    if (!cur) return;

    // A world grid bakes the continuous land, but only the window is visible — so blit
    // just the scrolled window sub-rect (source crop) rather than the whole buffer every
    // frame. Classic levels (scroll 0, buffer == window) draw whole, exactly as before.
    // The relief is baked PER-ROW (one window's depth → fills the frame), full width, so
    // an E–W pan is an X source-crop and the row's depth is fixed (Y not scrolled).
    const dt = this.detail;
    const blit = (img, alpha) => {
      if (alpha != null) { push(); tint(255, alpha); }
      if (this.hasWorldGrid) {
        if (isRelief) {
          // Per-row relief fills the frame (one window's depth), full width → an E–W
          // pan is just an X source-crop; the row's depth is fixed (Y not scrolled).
          const pxPerWorld = img.width / this.worldW;   // relief buffer is renderCols wide
          image(img, 0, this._reliefDrawY || 0,
                this.viewW, this._reliefWorldH || this.worldH,
                sx * pxPerWorld, 0, this.viewW * pxPerWorld, img.height);
        } else {
          image(img, 0, 0, this.viewW, this.viewH,
                sx * dt, sy * dt, this.viewW * dt, this.viewH * dt);
        }
      } else {
        const h = isRelief ? (this._reliefWorldH || this.mapHeight) : this.mapHeight;
        const oy = isRelief ? (this._reliefDrawY || 0) : 0;
        image(img, 0, oy, this.worldW, h);
      }
      if (alpha != null) { noTint(); pop(); }
    };

    const tp = this.seasonManager ? this.seasonManager.transitionProgress : 0;
    blit(cur, null);
    if (tp >= 0.01) {
      const nxt = set[this.seasonManager.nextKey];
      if (nxt) blit(nxt, tp * 255);
    }
  }

  // ============================================
  // WORLD-GRID CAMERA PAN (year boundary)
  // ============================================

  _quadIndexForCycle(cycle) {
    const n = this._quadOrder.length;
    return ((cycle % n) + n) % n;
  }

  // The [col,row] area this cycle's year should occupy (circular tour).
  quadrantForCycle(cycle) {
    return this._quadOrder[this._quadIndexForCycle(cycle)];
  }

  // Whether a year pan is currently animating.
  isPanning() { return !!this._pan; }

  // Pan the camera to a new area of the SAME continuous world (no regeneration — the
  // land is generated once). Sets the active area immediately (so terrain lookups for
  // the freshly-spawned cast read the new ground) and animates the camera there.
  panToArea(col, row, opts = {}) {
    if (!this.hasWorldGrid) return;
    this.activeCol = col;
    this.activeRow = row;
    this._updateActiveOrigin();
    if (opts.animate === false) {
      this.scrollX = this._activeOriginX;
      this.scrollY = this._activeOriginY;
      this._pan = null;
      return;
    }
    this._pan = {
      fromX: this.scrollX, fromY: this.scrollY,
      toX: this._activeOriginX, toY: this._activeOriginY, t: 0
    };
  }

  // Advance the camera pan; call once per frame with dt (frames). Returns true while
  // panning, false the frame it finishes. `durFrames` is the pan length (~1.5s @ 60).
  updatePan(dt, durFrames = 90) {
    const p = this._pan;
    if (!p) return false;
    p.t += (dt || 1) / durFrames;
    const e = p.t >= 1 ? 1 : this._smoothstep(0, 1, p.t);   // ease in/out
    this.scrollX = this._lerp(p.fromX, p.toX, e);
    this.scrollY = this._lerp(p.fromY, p.toY, e);
    if (p.t >= 1) { this.scrollX = p.toX; this.scrollY = p.toY; this._pan = null; return false; }
    return true;
  }

  // Deepen the glacial share (glacial habitats climb higher). Regenerates the SAME
  // land (seed kept) at the new advance + re-bakes — a heavy op, so used sparingly
  // (e.g. once per full grid loop, not every year).
  setGlacialAdvance(adv) {
    if (Math.abs((this.glacialAdvance || 0) - adv) < 1e-4) return;
    this.glacialAdvance = adv;
    this.generate();   // disposes + re-bakes flat; relief re-baked lazily
  }

  // ============================================
  // MINIMAP SUPPORT
  // ============================================
  
  getTerrainBuffer() {
    if (!this.seasonManager) return this.seasonBuffers.summer;
    return this.seasonBuffers[this.seasonManager.currentKey];
  }
  
  getDimensions() {
    return {
      width: this.mapWidth,
      height: this.mapHeight,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight
    };
  }
}