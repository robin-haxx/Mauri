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

    // Island Y-pad: the island falloff spans mapHeight + 2·worldPadY (near–far), so
    // the play window [0,mapHeight] is the CENTRE of a larger island. getElevation
    // reads this for both the play-area heightmap AND the 3D over-scan, so the two
    // stay one continuous landmass. 0 = the old whole-island-fills-the-window.
    this.worldPadY = Math.max(0, (config.view3DWorldPad != null ? config.view3DWorldPad : 0)) * this.mapHeight;
    
    this.scale = config.pixelScale;
    this.invScale = 1 / config.pixelScale;
    this.gridCols = Math.ceil(this.mapWidth * this.invScale);
    this.gridRows = Math.ceil(this.mapHeight * this.invScale);

    // Render-only detail multiplier: bakes terrain buffers at N x the
    // resolution without touching the gameplay grid (pixelScale).
    // Supports fractions (e.g. 0.5 = half-resolution buffers).
    this.detail = Math.max(0.25, config.terrainDetail || 1);
    
    this._initBiomeIndex();
    this._colorCache = new Map();
    this._snowColorsRGB = null;
    
    // Base cell colors (computed once, reused for all seasons)
    this._baseCellColors = null;
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
    const nx = x / this.mapWidth;
    // Y maps through the padded island domain, so the play window is the island's
    // vertical centre and the over-scan (y<0 or y>mapHeight) is its real near/far land.
    const pad = this.worldPadY || 0;
    const ny = (y + pad) / (this.mapHeight + 2 * pad);

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
    const nx = x / this.mapWidth;
    const ny = (y + pad) / (this.mapHeight + 2 * pad);
    const edgeDist = Math.min(nx, 1 - nx, ny, 1 - ny);
    const edgeFalloff = Math.min(1, edgeDist * 12);
    elevation *= 0.3 + edgeFalloff * 0.7;
    
    return elevation;
  }
  
  // ============================================
  // LOOKUPS
  // ============================================
  
  getElevationAt(x, y) {
    const col = (x * this.invScale) | 0;
    const row = (y * this.invScale) | 0;
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
    const col = (x * this.invScale) | 0;
    const row = (y * this.invScale) | 0;
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

    let idx = 0;
    for (let row = 0; row < renderRows; row++) {
      const y = row * renderScale;
      const coarseRow = Math.min(this.gridRows - 1, (row / detail) | 0);
      for (let col = 0; col < renderCols; col++) {
        const elevation = this.getElevation(col * renderScale, y);
        this.renderHeightMap[idx] = elevation;

        let biome = this.getBiomeFromElevation(elevation);
        // Same lake/sea fallback as the gameplay grid, checked on the
        // coarse grid so water bodies match gameplay
        if (biome === this.biomeList[1] && this._waterBiome) {
          const coarseCol = Math.min(this.gridCols - 1, (col / detail) | 0);
          if (!this.hasAdjacentWater(coarseRow, coarseCol)) {
            biome = this._fallbackBiome;
          }
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

    let idx = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellIdx = row * gridCols + col;
        const elevation = this.renderHeightMap[cellIdx];
        const biomeIdx = this.renderBiomeIndexMap[cellIdx];
        const biome = this.biomeArray[biomeIdx];
        
        const c = this.getColor(elevation, biome);
        const colorIdx = cellIdx * 4;
        
        this._baseCellColors[colorIdx] = red(c);
        this._baseCellColors[colorIdx + 1] = green(c);
        this._baseCellColors[colorIdx + 2] = blue(c);
        
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
   * Bake a single season's terrain buffer using direct pixel manipulation
   */
  _bakeSeasonBuffer(seasonKey) {
    const detail = this.detail;
    const buf = createGraphics(Math.ceil(this.mapWidth * detail),
                               Math.ceil(this.mapHeight * detail));
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
    const inRows = this.renderRows;
    const detail = this.detail;
    const renderScale = this.scale / detail;

    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const overFar = Math.max(0, cfg.view3DOverscan != null ? cfg.view3DOverscan : 0.45);
    const overNear = Math.max(0, cfg.view3DOverscanNear != null ? cfg.view3DOverscanNear : 0.28);
    const marginFar = Math.round(overFar * inRows);
    const marginNear = Math.round(overNear * inRows);
    const extRows = marginFar + inRows + marginNear;

    const extHeight = new Float32Array(cols * extRows);
    const extBiome = new Uint8Array(cols * extRows);
    const extBase = new Uint8Array(cols * extRows * 4);

    const showContours = this.config.showContours;
    const contourInterval = this.config.contourInterval;
    const contourWidth = (this.config.contourWidth != null) ? this.config.contourWidth : 0.008;

    for (let er = 0; er < extRows; er++) {
      const rw = er - marginFar;          // world render-row (<0 far, >=inRows near)
      const dstRow = er * cols;

      if (rw >= 0 && rw < inRows) {
        // In-domain: copy the render maps so the visible relief is identical to 2D.
        const srcRow = rw * cols;
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
        // Over-scan (far y<0 or near y>mapHeight): sample fresh. getIslandFalloff
        // clamps ny, so out-of-range y is safe and yields the low coastal land the
        // island tapers to — a natural continuation of the shore.
        const worldY = rw * renderScale;
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
    this._reliefSrc = { heightMap: extHeight, biomeMap: extBiome, baseColors: extBase, cols, rows: extRows };
    this._reliefBakedOverFar = overFar;
    this._reliefBakedOverNear = overNear;
  }

  _bakeReliefBuffer(seasonKey) {
    const P = Projection;
    const cols = this.renderCols;        // buffer width == render columns (projX identity)
    const inRows = this.renderRows;      // rows of the actual (visible) map
    const detail = this.detail;
    const renderScale = this.scale / detail;

    const marginFar = this._reliefMarginFar;
    const marginNear = this._reliefMarginNear;
    const extRows = this._reliefExtRows;
    const nearMostRw = inRows - 1 + marginNear;

    const K = P.K;
    const LIFT = P.liftFrac * inRows;    // relief height, in render-row units (matches world LIFT)
    const P0 = marginFar * K;            // index offset so the far over-scan sits at buffer top

    // Buffer height: the near-most over-scan row (flat) → nearMostRw·K + LIFT + P0.
    const bufH = Math.ceil(nearMostRw * K + LIFT + P0) + 1;
    this._reliefWorldH = bufH / detail;              // world-unit draw height
    this._reliefDrawY = -P0 * renderScale;           // world y of the buffer's top row (< 0: above frame)

    const buf = createGraphics(cols, bufH);
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
    if (this.reliefBuffers.summer &&
        (this._reliefBakedK !== Projection.K || this._reliefBakedLift !== Projection.liftFrac ||
         this._reliefBakedOverFar !== overFar || this._reliefBakedOverNear !== overNear ||
         this._reliefBakedFade !== hazeFade)) {
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
   * Render terrain - just draws pre-baked buffers with crossfade
   * This is EXTREMELY fast - no computation, just image drawing
   */
  render() {
    // Fixed-3D: draw the relief bake instead of the flat one. It shares the
    // season crossfade; only the buffer set and the draw height differ. The
    // relief buffer is baked lazily here on the first switch.
    if (typeof CONFIG !== 'undefined' && CONFIG.view3D &&
        typeof Projection !== 'undefined' && Projection.relief) {
      this._ensureReliefBuffers();
      const buffers = this.reliefBuffers;
      const w = this.mapWidth;
      const h = this._reliefWorldH || this.mapHeight;
      const y = this._reliefDrawY || 0;   // far over-scan sits above the frame (negative y)

      if (!this.seasonManager || !buffers[this.seasonManager.currentKey]) {
        image(buffers.summer, 0, y, w, h);
        return;
      }
      const currentKey = this.seasonManager.currentKey;
      const tp = this.seasonManager.transitionProgress;
      if (tp < 0.01) {
        image(buffers[currentKey], 0, y, w, h);
      } else {
        const nextKey = this.seasonManager.nextKey;
        image(buffers[currentKey], 0, y, w, h);
        push();
        tint(255, tp * 255);
        image(buffers[nextKey], 0, y, w, h);
        noTint();
        pop();
      }
      return;
    }

    // Buffers are baked at detail x resolution; draw them at world size
    const w = this.mapWidth;
    const h = this.mapHeight;

    if (!this.seasonManager) {
      // No season manager - just draw summer
      image(this.seasonBuffers.summer, 0, 0, w, h);
      return;
    }

    const currentKey = this.seasonManager.currentKey;
    const transitionProgress = this.seasonManager.transitionProgress;

    if (transitionProgress < 0.01) {
      // No transition - just draw current season
      image(this.seasonBuffers[currentKey], 0, 0, w, h);
    } else {
      // Crossfade between current and next season
      const nextKey = this.seasonManager.nextKey;

      // Draw current season
      image(this.seasonBuffers[currentKey], 0, 0, w, h);

      // Draw next season with alpha
      push();
      tint(255, transitionProgress * 255);
      image(this.seasonBuffers[nextKey], 0, 0, w, h);
      noTint();
      pop();
    }
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