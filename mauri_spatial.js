class SpatialGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Map();
  }
  
  clear() {
    this.cells.clear();
  }
  
  getKey(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    return `${col},${row}`;
  }
  
  insert(entity) {
    const key = this.getKey(entity.pos.x, entity.pos.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(entity);
  }
  
  // Get all entities in nearby cells
  getNearby(x, y, radius) {
    const nearby = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    
    for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
      for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
        const key = `${col},${row}`;
        if (this.cells.has(key)) {
          nearby.push(...this.cells.get(key));
        }
      }
    }
    
    return nearby;
  }
  
  // Get nearby entities with actual distance check
  getInRadius(x, y, radius) {
    const nearby = this.getNearby(x, y, radius);
    const radiusSq = radius * radius;
    
    return nearby.filter(entity => {
      const dx = entity.pos.x - x;
      const dy = entity.pos.y - y;
      return (dx * dx + dy * dy) <= radiusSq;
    });
  }
}