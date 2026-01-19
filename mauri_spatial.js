// ============================================
// SPATIAL GRID - Optimized for flocking queries
// ============================================
class SpatialGrid {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.cells = new Map();
    this.entityCells = new WeakMap();
  }
  
  clear() {
    this.cells.clear();
  }
  
  getKey(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    return `${col},${row}`;
  }
  
  getCellCoords(x, y) {
    return {
      col: Math.floor(x / this.cellSize),
      row: Math.floor(y / this.cellSize)
    };
  }
  
  insert(entity) {
    const key = this.getKey(entity.pos.x, entity.pos.y);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(entity);
    this.entityCells.set(entity, key);
  }
  
  remove(entity) {
    const key = this.entityCells.get(entity);
    if (key && this.cells.has(key)) {
      const cell = this.cells.get(key);
      const idx = cell.indexOf(entity);
      if (idx !== -1) {
        cell.splice(idx, 1);
      }
    }
    this.entityCells.delete(entity);
  }
  
  updateEntity(entity) {
    const oldKey = this.entityCells.get(entity);
    const newKey = this.getKey(entity.pos.x, entity.pos.y);
    
    if (oldKey === newKey) return;
    
    if (oldKey && this.cells.has(oldKey)) {
      const cell = this.cells.get(oldKey);
      const idx = cell.indexOf(entity);
      if (idx !== -1) {
        cell.splice(idx, 1);
      }
    }
    
    if (!this.cells.has(newKey)) {
      this.cells.set(newKey, []);
    }
    this.cells.get(newKey).push(entity);
    this.entityCells.set(entity, newKey);
  }
  
  // Get all entities in nearby cells (fast, no distance check)
  getNearby(x, y, radius) {
    const nearby = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    
    for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
      for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            nearby.push(cell[i]);
          }
        }
      }
    }
    
    return nearby;
  }
  
  // Get nearby entities with actual distance check (more precise)
  getInRadius(x, y, radius) {
    const nearby = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    const radiusSq = radius * radius;
    
    for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
      for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        
        for (let i = 0; i < cell.length; i++) {
          const entity = cell[i];
          const dx = entity.pos.x - x;
          const dy = entity.pos.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            nearby.push(entity);
          }
        }
      }
    }
    
    return nearby;
  }
  
  // Get entities in radius excluding a specific entity
  getInRadiusExcluding(x, y, radius, excludeEntity) {
    const nearby = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    const radiusSq = radius * radius;
    
    for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
      for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        
        for (let i = 0; i < cell.length; i++) {
          const entity = cell[i];
          if (entity === excludeEntity) continue;
          
          const dx = entity.pos.x - x;
          const dy = entity.pos.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            nearby.push(entity);
          }
        }
      }
    }
    
    return nearby;
  }
  
  // Find the closest entity within radius
  getClosest(x, y, radius, filter = null) {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    const radiusSq = radius * radius;
    
    let closest = null;
    let closestDistSq = radiusSq;
    
    for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
      for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        
        for (let i = 0; i < cell.length; i++) {
          const entity = cell[i];
          if (filter && !filter(entity)) continue;
          
          const dx = entity.pos.x - x;
          const dy = entity.pos.y - y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq < closestDistSq) {
            closestDistSq = distSq;
            closest = entity;
          }
        }
      }
    }
    
    return closest;
  }
  
  // Find N closest entities within radius
  getClosestN(x, y, radius, n, filter = null) {
    const candidates = this.getInRadius(x, y, radius);
    
    // Calculate distances
    const withDist = [];
    for (let i = 0; i < candidates.length; i++) {
      const entity = candidates[i];
      if (filter && !filter(entity)) continue;
      
      const dx = entity.pos.x - x;
      const dy = entity.pos.y - y;
      withDist.push({
        entity: entity,
        distSq: dx * dx + dy * dy
      });
    }
    
    // Sort by distance and return top N
    withDist.sort((a, b) => a.distSq - b.distSq);
    
    const result = [];
    for (let i = 0; i < Math.min(n, withDist.length); i++) {
      result.push(withDist[i].entity);
    }
    
    return result;
  }
  
  // Count entities in radius (without building array)
  countInRadius(x, y, radius, filter = null) {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    const radiusSq = radius * radius;
    let count = 0;
    
    for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
      for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        
        for (let i = 0; i < cell.length; i++) {
          const entity = cell[i];
          if (filter && !filter(entity)) continue;
          
          const dx = entity.pos.x - x;
          const dy = entity.pos.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            count++;
          }
        }
      }
    }
    
    return count;
  }
  
  // Check if any entity exists within radius
  hasAnyInRadius(x, y, radius, filter = null) {
    const cellRadius = Math.ceil(radius / this.cellSize);
    const centerCol = Math.floor(x / this.cellSize);
    const centerRow = Math.floor(y / this.cellSize);
    const radiusSq = radius * radius;
    
    for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col++) {
      for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row++) {
        const key = `${col},${row}`;
        const cell = this.cells.get(key);
        if (!cell) continue;
        
        for (let i = 0; i < cell.length; i++) {
          const entity = cell[i];
          if (filter && !filter(entity)) continue;
          
          const dx = entity.pos.x - x;
          const dy = entity.pos.y - y;
          if (dx * dx + dy * dy <= radiusSq) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  // Debug: get stats about grid usage
  getStats() {
    let totalEntities = 0;
    let maxInCell = 0;
    let nonEmptyCells = 0;
    
    for (let [key, cell] of this.cells) {
      if (cell.length > 0) {
        nonEmptyCells++;
        totalEntities += cell.length;
        maxInCell = Math.max(maxInCell, cell.length);
      }
    }
    
    return {
      totalEntities,
      nonEmptyCells,
      maxInCell,
      avgPerCell: nonEmptyCells > 0 ? (totalEntities / nonEmptyCells).toFixed(1) : 0
    };
  }
}