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
    
    // Snow line per season (pre-defined)
    this.seasonSnowLines = {
      summer: 0.92,
      autumn: 0.85,
      winter: 0.77,
      spring: 0.82
    };
    
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
    
    this.scale = config.pixelScale;
    this.invScale = 1 / config.pixelScale;
    this.gridCols = Math.ceil(this.mapWidth * this.invScale);
    this.gridRows = Math.ceil(this.mapHeight * this.invScale);
    
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
  }
  
  setSeasonManager(manager) {
    this.seasonManager = manager;
  }
  
  _initSnowColors() {
    if (!this.biomes.snow) return;
    this._snowColorsRGB = this.biomes.snow.colors.map(hex => {
      const c = this._getCachedColor(hex);
      return [red(c), green(c), blue(c)];
    });
  }
  
  // Current snow line based on season + transition
  getSnowLineElevation() {
    if (!this.seasonManager) {
      return this.biomes.snow?.minElevation || 0.9;
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
    const snowLine = this.getSnowLineElevation();
    const permanentSnowLine = this.biomes.snow?.minElevation || 0.9;
    
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
    const ny = y / this.mapHeight;
    
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
    
    const edgeSoftness = Math.pow(Math.sin(ny * Math.PI), 0.3);
    falloff *= 0.6 + edgeSoftness * 0.4;
    
    return Math.max(0, Math.min(1, falloff));
  }
  
  getElevation(x, y) {
    const base = this.fractalNoise(x, y);
    const ridge = this.ridgeNoise(x, y);
    let elevation = base * (1 - this.config.ridgeInfluence) + ridge * this.config.ridgeInfluence;
    elevation = Math.pow(elevation, this.config.elevationPower);
    const falloff = this.getIslandFalloff(x, y);
    elevation *= falloff;
    return Math.max(0, Math.min(1, elevation));
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
      return this.biomes.grassland;
    }
    return this.biomeArray[this.biomeIndexMap[row * this.gridCols + col]];
  }
  
  getEffectiveBiomeAt(x, y) {
    const elevation = this.getElevationAt(x, y);
    if (this.isSeasonalSnow(elevation)) return this.biomes.snow;
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
  
  hasAdjacentSea(row, col) {
    const gridCols = this.gridCols;
    const gridRows = this.gridRows;
    const seaMax = this.biomes.sea.maxElevation;
    
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
          if (this.heightMap[nr * gridCols + nc] < seaMax) return true;
        }
      }
    }
    return false;
  }
  
  // ============================================
  // GENERATION
  // ============================================
  
  generate() {
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
        if (biome.key === 'coastal' && !this.hasAdjacentSea(row, col)) {
          biome = this.biomes.grassland;
        }
        this.biomeIndexMap[idx] = this.biomeIndexByKey[biome.key];
        idx++;
      }
    }
    
    this._initSnowColors();
    
    // Compute base cell colors (without snow)
    this._computeBaseCellColors();
    
    // Pre-bake all 4 seasonal buffers
    this._bakeAllSeasonBuffers();
  }
  
  /**
   * Compute base terrain colors once (reused for all seasons)
   */
  _computeBaseCellColors() {
    const gridCols = this.gridCols;
    const gridRows = this.gridRows;
    const totalCells = gridCols * gridRows;
    
    // Store RGB + contour flag for each cell
    this._baseCellColors = new Uint8Array(totalCells * 4); // R, G, B, isContour
    
    const showContours = this.config.showContours;
    const contourInterval = this.config.contourInterval;
    
    let idx = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellIdx = row * gridCols + col;
        const elevation = this.heightMap[cellIdx];
        const biomeIdx = this.biomeIndexMap[cellIdx];
        const biome = this.biomeArray[biomeIdx];
        
        const c = this.getColor(elevation, biome);
        const colorIdx = cellIdx * 4;
        
        this._baseCellColors[colorIdx] = red(c);
        this._baseCellColors[colorIdx + 1] = green(c);
        this._baseCellColors[colorIdx + 2] = blue(c);
        
        // Check if this is a contour line
        if (showContours) {
          const mod = elevation % contourInterval;
          this._baseCellColors[colorIdx + 3] = (mod < 0.008 || mod > contourInterval - 0.008) ? 1 : 0;
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
    const buf = createGraphics(this.mapWidth, this.mapHeight);
    buf.loadPixels();
    
    const d = buf.pixelDensity();
    const gridCols = this.gridCols;
    const gridRows = this.gridRows;
    const heightMap = this.heightMap;
    const baseCellColors = this._baseCellColors;
    const snowColorsRGB = this._snowColorsRGB;
    
    const snowLine = this.seasonSnowLines[seasonKey];
    const permanentSnowLine = this.biomes.snow?.minElevation || 0.9;
    const snowContourColor = this._getCachedColor(this.biomes.snow.contourColor);
    const snowContourRGB = [red(snowContourColor), green(snowContourColor), blue(snowContourColor)];
    
    // Pre-compute cell colors with snow for this season
    const cellColors = new Uint8Array(gridCols * gridRows * 3);
    
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellIdx = row * gridCols + col;
        const elevation = heightMap[cellIdx];
        const baseIdx = cellIdx * 4;
        const outIdx = cellIdx * 3;
        
        const isContour = baseCellColors[baseIdx + 3] === 1;
        
        // Check if this cell has snow in this season
        if (elevation >= snowLine) {
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
          
          if (isContour) {
            // Use snow contour color
            cellColors[outIdx] = snowContourRGB[0];
            cellColors[outIdx + 1] = snowContourRGB[1];
            cellColors[outIdx + 2] = snowContourRGB[2];
          } else {
            // Blend base color with snow
            const snowIdx = Math.min(snowColorsRGB.length - 1, (snowCoverage * snowColorsRGB.length) | 0);
            const snowRGB = snowColorsRGB[snowIdx];
            
            const baseR = baseCellColors[baseIdx];
            const baseG = baseCellColors[baseIdx + 1];
            const baseB = baseCellColors[baseIdx + 2];
            
            cellColors[outIdx] = baseR + (snowRGB[0] - baseR) * snowCoverage;
            cellColors[outIdx + 1] = baseG + (snowRGB[1] - baseG) * snowCoverage;
            cellColors[outIdx + 2] = baseB + (snowRGB[2] - baseB) * snowCoverage;
          }
        } else {
          // No snow - use base color
          if (isContour) {
            // Get biome contour color
            const biomeIdx = this.biomeIndexMap[cellIdx];
            const biome = this.biomeArray[biomeIdx];
            const contourC = this._getCachedColor(biome.contourColor);
            cellColors[outIdx] = red(contourC);
            cellColors[outIdx + 1] = green(contourC);
            cellColors[outIdx + 2] = blue(contourC);
          } else {
            cellColors[outIdx] = baseCellColors[baseIdx];
            cellColors[outIdx + 1] = baseCellColors[baseIdx + 1];
            cellColors[outIdx + 2] = baseCellColors[baseIdx + 2];
          }
        }
      }
    }
    
    // Fill buffer pixels
    const fullWidth = this.mapWidth * d;
    const fullHeight = this.mapHeight * d;
    const invScaleD = this.invScale / d;
    
    for (let py = 0; py < fullHeight; py++) {
      const gridRow = (py * invScaleD) | 0;
      const rowOffset = gridRow * gridCols;
      
      for (let px = 0; px < fullWidth; px++) {
        const gridCol = (px * invScaleD) | 0;
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
    if (!this.seasonManager) {
      // No season manager - just draw summer
      image(this.seasonBuffers.summer, 0, 0);
      return;
    }
    
    const currentKey = this.seasonManager.currentKey;
    const transitionProgress = this.seasonManager.transitionProgress;
    
    if (transitionProgress < 0.01) {
      // No transition - just draw current season
      image(this.seasonBuffers[currentKey], 0, 0);
    } else {
      // Crossfade between current and next season
      const nextKey = this.seasonManager.nextKey;
      
      // Draw current season
      image(this.seasonBuffers[currentKey], 0, 0);
      
      // Draw next season with alpha
      push();
      tint(255, transitionProgress * 255);
      image(this.seasonBuffers[nextKey], 0, 0);
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