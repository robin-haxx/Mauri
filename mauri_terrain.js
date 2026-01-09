// ============================================
// TERRAIN GENERATOR - Fixed for sea generation
// ============================================
class TerrainGenerator {
  constructor(config, biomes) {
    this.config = config;
    this.biomes = biomes;
    this.biomeList = Object.values(biomes).sort((a, b) => a.minElevation - b.minElevation);
    this.seed = random(10000);
    this.heightMap = [];
    this.biomeMap = [];
    this.terrainBuffer = null;
    
    this.mapWidth = Math.ceil(config.width / config.zoom);
    this.mapHeight = Math.ceil(config.height / config.zoom);
  }
  
  fractalNoise(x, y) {
    let total = 0, frequency = 1, amplitude = 1, maxValue = 0;
    for (let i = 0; i < this.config.octaves; i++) {
      total += noise(x * frequency * this.config.noiseScale + this.seed,
                     y * frequency * this.config.noiseScale + this.seed) * amplitude;
      maxValue += amplitude;
      amplitude *= this.config.persistence;
      frequency *= this.config.lacunarity;
    }
    return total / maxValue;
  }
  
  ridgeNoise(x, y) {
    let n = this.fractalNoise(x * 0.5, y * 0.5);
    return 1 - Math.abs(n * 2 - 1);
  }
  
  // Island falloff - ensures sea around edges
  getIslandFalloff(x, y) {
    let nx = (x / this.mapWidth) * 2 - 1;  // -1 to 1
    let ny = (y / this.mapHeight) * 2 - 1; // -1 to 1
    
    // Distance from center (0 at center, 1 at corners)
    let d = Math.sqrt(nx * nx + ny * ny) / Math.sqrt(2);
    
    // Smooth falloff curve
    let falloff = 1 - Math.pow(d, this.config.islandFalloff);
    falloff = Math.max(0, Math.min(1, falloff));
    
    // Add some noise to the coastline
    let coastNoise = noise(x * 0.02 + this.seed * 2, y * 0.02 + this.seed * 2) * 0.3;
    falloff += coastNoise - 0.15;
    
    return Math.max(0, Math.min(1, falloff));
  }
  
  getElevation(x, y) {
    let base = this.fractalNoise(x, y);
    let ridge = this.ridgeNoise(x, y);
    let elevation = base * (1 - this.config.ridgeInfluence) + ridge * this.config.ridgeInfluence;
    elevation = Math.pow(elevation, this.config.elevationPower);
    
    // Apply island falloff to create sea around edges
    let falloff = this.getIslandFalloff(x, y);
    elevation *= falloff;
    
    return constrain(elevation, 0, 1);
  }
  
  getElevationAt(x, y) {
    const scale = this.config.pixelScale;
    const ix = Math.floor(constrain(x / scale, 0, this.heightMap[0]?.length - 1 || 0));
    const iy = Math.floor(constrain(y / scale, 0, this.heightMap.length - 1 || 0));
    return this.heightMap[iy]?.[ix] ?? 0.5;
  }
  
  getBiomeFromElevation(elevation) {
    for (let biome of this.biomeList) {
      if (elevation >= biome.minElevation && elevation < biome.maxElevation) return biome;
    }
    return this.biomeList[this.biomeList.length - 1];
  }
  
  getBiomeAt(x, y) {
    const scale = this.config.pixelScale;
    const ix = Math.floor(constrain(x / scale, 0, this.biomeMap[0]?.length - 1 || 0));
    const iy = Math.floor(constrain(y / scale, 0, this.biomeMap.length - 1 || 0));
    return this.biomeMap[iy]?.[ix] ?? this.biomes.grassland;
  }
  
  isWalkable(x, y) { return this.getBiomeAt(x, y).walkable; }
  canPlace(x, y) { return this.getBiomeAt(x, y).canPlace; }
  
  getColor(elevation, biome) {
    const colors = biome.colors;
    const range = biome.maxElevation - biome.minElevation;
    const position = constrain((elevation - biome.minElevation) / range, 0, 1);
    const colorIndex = position * (colors.length - 1);
    const lowerIndex = Math.floor(colorIndex);
    const upperIndex = Math.min(lowerIndex + 1, colors.length - 1);
    return lerpColor(color(colors[lowerIndex]), color(colors[upperIndex]), colorIndex - lowerIndex);
  }
  
  hasAdjacentSea(row, col) {
    const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (let [dr, dc] of directions) {
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < this.heightMap.length && nc >= 0 && nc < this.heightMap[0].length) {
        if (this.heightMap[nr][nc] < this.biomes.sea.maxElevation) return true;
      }
    }
    return false;
  }
  
  generate() {
    const scale = this.config.pixelScale;
    
    this.heightMap = [];
    for (let y = 0; y < this.mapHeight; y += scale) {
      let row = [];
      for (let x = 0; x < this.mapWidth; x += scale) {
        row.push(this.getElevation(x, y));
      }
      this.heightMap.push(row);
    }
    
    this.biomeMap = [];
    for (let row = 0; row < this.heightMap.length; row++) {
      let biomeRow = [];
      for (let col = 0; col < this.heightMap[row].length; col++) {
        const elevation = this.heightMap[row][col];
        let biome = this.getBiomeFromElevation(elevation);
        if (biome.key === 'coastal' && !this.hasAdjacentSea(row, col)) {
          biome = this.biomes.grassland;
        }
        biomeRow.push(biome);
      }
      this.biomeMap.push(biomeRow);
    }
    
    this.renderToBuffer();
  }
  
  renderToBuffer() {
    const scale = this.config.pixelScale;
    this.terrainBuffer = createGraphics(this.mapWidth, this.mapHeight);
    this.terrainBuffer.noStroke();
    
    for (let row = 0; row < this.heightMap.length; row++) {
      for (let col = 0; col < this.heightMap[row].length; col++) {
        const elevation = this.heightMap[row][col];
        const biome = this.biomeMap[row][col];
        let c = this.getColor(elevation, biome);
        if (this.config.showContours) {
          const mod = elevation % this.config.contourInterval;
          if (mod < 0.008 || mod > this.config.contourInterval - 0.008) {
            c = color(biome.contourColor);
          }
        }
        this.terrainBuffer.fill(c);
        this.terrainBuffer.rect(col * scale, row * scale, scale, scale);
      }
    }
  }
  
  regenerate() {
    this.seed = random(10000);
    this.generate();
  }
  
  render() { image(this.terrainBuffer, 0, 0); }
}