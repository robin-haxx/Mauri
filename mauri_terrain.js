// ============================================
// TERRAIN GENERATOR - Optimized with cached lookups and typed arrays
// ============================================
class TerrainGenerator {
  constructor(config, biomes) {
    this.config = config;
    this.biomes = biomes;
    this.biomeList = Object.values(biomes).sort((a, b) => a.minElevation - b.minElevation);
    this.seed = random(10000);
    
    // Use typed arrays for better performance
    this.heightMap = null;      // Will be Float32Array
    this.biomeIndexMap = null;  // Will be Uint8Array
    this.biomeArray = null;     // Indexed array of biomes
    
    this.terrainBuffer = null;
    
    // Pre-compute dimensions
    this.mapWidth = Math.ceil(config.width / config.zoom);
    this.mapHeight = Math.ceil(config.height / config.zoom);
    
    // Pre-compute inverse scale for faster lookups
    this.scale = config.pixelScale;
    this.invScale = 1 / config.pixelScale;
    
    // Grid dimensions (for the downsampled grid)
    this.gridCols = Math.ceil(this.mapWidth * this.invScale);
    this.gridRows = Math.ceil(this.mapHeight * this.invScale);
    
    // Create biome index lookup
    this._initBiomeIndex();
    
    // Cache for color objects to avoid repeated color() calls
    this._colorCache = new Map();
  }
  
  _initBiomeIndex() {
    // Create indexed array for O(1) biome lookup
    this.biomeArray = this.biomeList.slice();
    this.biomeIndexByKey = {};
    for (let i = 0; i < this.biomeArray.length; i++) {
      this.biomeIndexByKey[this.biomeArray[i].key] = i;
    }
  }
  
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
    const nx = (x / this.mapWidth) * 2 - 1;
    const ny = (y / this.mapHeight) * 2 - 1;
    
    let d = Math.sqrt(nx * nx + ny * ny) * 0.7071067811865476; // 1/sqrt(2)
    
    let falloff = 1 - Math.pow(d, this.config.islandFalloff);
    if (falloff < 0) falloff = 0;
    if (falloff > 1) falloff = 1;
    
    const coastNoise = noise(x * 0.02 + this.seed * 2, y * 0.02 + this.seed * 2) * 0.3;
    falloff += coastNoise - 0.15;
    
    if (falloff < 0) return 0;
    if (falloff > 1) return 1;
    return falloff;
  }
  
  getElevation(x, y) {
    const base = this.fractalNoise(x, y);
    const ridge = this.ridgeNoise(x, y);
    let elevation = base * (1 - this.config.ridgeInfluence) + ridge * this.config.ridgeInfluence;
    elevation = Math.pow(elevation, this.config.elevationPower);
    
    const falloff = this.getIslandFalloff(x, y);
    elevation *= falloff;
    
    if (elevation < 0) return 0;
    if (elevation > 1) return 1;
    return elevation;
  }
  
  // Optimized: Direct array access with pre-computed values
  getElevationAt(x, y) {
    const col = (x * this.invScale) | 0;
    const row = (y * this.invScale) | 0;
    
    // Bounds check
    if (col < 0 || row < 0 || col >= this.gridCols || row >= this.gridRows) {
      return 0.5;
    }
    
    return this.heightMap[row * this.gridCols + col];
  }
  
  getBiomeFromElevation(elevation) {
    const list = this.biomeList;
    for (let i = 0; i < list.length; i++) {
      const biome = list[i];
      if (elevation >= biome.minElevation && elevation < biome.maxElevation) {
        return biome;
      }
    }
    return list[list.length - 1];
  }
  
  // Optimized: Direct array access
  getBiomeAt(x, y) {
    const col = (x * this.invScale) | 0;
    const row = (y * this.invScale) | 0;
    
    // Bounds check
    if (col < 0 || row < 0 || col >= this.gridCols || row >= this.gridRows) {
      return this.biomes.grassland;
    }
    
    const biomeIdx = this.biomeIndexMap[row * this.gridCols + col];
    return this.biomeArray[biomeIdx];
  }
  
  isWalkable(x, y) {
    return this.getBiomeAt(x, y).walkable;
  }
  
  canPlace(x, y) {
    return this.getBiomeAt(x, y).canPlace;
  }
  
  // Cache color lookups
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
    const clampedPos = position < 0 ? 0 : (position > 1 ? 1 : position);
    
    const colorIndex = clampedPos * (colors.length - 1);
    const lowerIndex = colorIndex | 0;
    const upperIndex = lowerIndex + 1 < colors.length ? lowerIndex + 1 : lowerIndex;
    const t = colorIndex - lowerIndex;
    
    if (t < 0.01) {
      return this._getCachedColor(colors[lowerIndex]);
    }
    if (t > 0.99) {
      return this._getCachedColor(colors[upperIndex]);
    }
    
    return lerpColor(
      this._getCachedColor(colors[lowerIndex]),
      this._getCachedColor(colors[upperIndex]),
      t
    );
  }
  
  hasAdjacentSea(row, col) {
    const gridCols = this.gridCols;
    const gridRows = this.gridRows;
    const heightMap = this.heightMap;
    const seaMax = this.biomes.sea.maxElevation;
    
    // Check 8 neighbors
    const offsets = [-1, 0, 1];
    for (let dr = 0; dr < 3; dr++) {
      for (let dc = 0; dc < 3; dc++) {
        if (dr === 1 && dc === 1) continue; // Skip self
        
        const nr = row + offsets[dr] - 1;
        const nc = col + offsets[dc] - 1;
        
        if (nr >= 0 && nr < gridRows && nc >= 0 && nc < gridCols) {
          if (heightMap[nr * gridCols + nc] < seaMax) {
            return true;
          }
        }
      }
    }
    return false;
  }
  
  generate() {
    const gridCols = this.gridCols;
    const gridRows = this.gridRows;
    const totalCells = gridCols * gridRows;
    const scale = this.scale;
    
    // Use typed arrays
    this.heightMap = new Float32Array(totalCells);
    this.biomeIndexMap = new Uint8Array(totalCells);
    
    // Generate height map
    let idx = 0;
    for (let row = 0; row < gridRows; row++) {
      const y = row * scale;
      for (let col = 0; col < gridCols; col++) {
        const x = col * scale;
        this.heightMap[idx] = this.getElevation(x, y);
        idx++;
      }
    }
    
    // Generate biome map
    const grasslandIdx = this.biomeIndexByKey['grassland'];
    
    idx = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const elevation = this.heightMap[idx];
        let biome = this.getBiomeFromElevation(elevation);
        
        // Check coastal adjacency
        if (biome.key === 'coastal' && !this.hasAdjacentSea(row, col)) {
          biome = this.biomes.grassland;
        }
        
        this.biomeIndexMap[idx] = this.biomeIndexByKey[biome.key];
        idx++;
      }
    }
    
    this.renderToBuffer();
  }
  
  renderToBuffer() {
    this.terrainBuffer = createGraphics(this.mapWidth, this.mapHeight);
    const buf = this.terrainBuffer;
    buf.loadPixels();
    
    const d = buf.pixelDensity();
    const scale = this.scale;
    const gridCols = this.gridCols;
    const heightMap = this.heightMap;
    const biomeIndexMap = this.biomeIndexMap;
    const biomeArray = this.biomeArray;
    const showContours = this.config.showContours;
    const contourInterval = this.config.contourInterval;
    
    // Pre-compute all cell colors once
    const cellColors = new Uint8Array(gridCols * this.gridRows * 3);
    
    let idx = 0;
    for (let row = 0; row < this.gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const elevation = heightMap[idx];
        const biomeIdx = biomeIndexMap[idx];
        const biome = biomeArray[biomeIdx];
        
        let c = this.getColor(elevation, biome);
        
        if (showContours) {
          const mod = elevation % contourInterval;
          if (mod < 0.008 || mod > contourInterval - 0.008) {
            c = this._getCachedColor(biome.contourColor);
          }
        }
        
        const colorIdx = idx * 3;
        cellColors[colorIdx] = red(c);
        cellColors[colorIdx + 1] = green(c);
        cellColors[colorIdx + 2] = blue(c);
        idx++;
      }
    }
    
    // Fill pixels by looking up which grid cell each pixel belongs to
    const fullWidth = this.mapWidth * d;
    const fullHeight = this.mapHeight * d;
    const invScaleD = this.invScale / d;
    
    for (let py = 0; py < fullHeight; py++) {
      // Which grid row does this pixel row belong to?
      const gridRow = (py * invScaleD) | 0;
      const rowOffset = gridRow * gridCols;
      
      for (let px = 0; px < fullWidth; px++) {
        // Which grid col does this pixel belong to?
        const gridCol = (px * invScaleD) | 0;
        
        // Look up pre-computed color for this cell
        const colorIdx = (rowOffset + gridCol) * 3;
        
        const pixelIdx = (py * fullWidth + px) * 4;
        buf.pixels[pixelIdx] = cellColors[colorIdx];
        buf.pixels[pixelIdx + 1] = cellColors[colorIdx + 1];
        buf.pixels[pixelIdx + 2] = cellColors[colorIdx + 2];
        buf.pixels[pixelIdx + 3] = 255;
      }
    }
    
    buf.updatePixels();
  }
  
  regenerate() {
    this.seed = random(10000);
    this._colorCache.clear();
    this.generate();
  }
  
  render() {
    image(this.terrainBuffer, 0, 0);
  }
}