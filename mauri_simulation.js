// ============================================
// SIMULATION CLASS
// ============================================
class Simulation {
  constructor(terrain, config, game, seasonManager) {
    this.terrain = terrain;
    this.config = config;
    this.game = game;
    this.seasonManager = seasonManager;
    this.moas = [];
    this.eagles = [];
    this.plants = [];
    this.eggs = [];
    this.placeables = [];
    
    this.stats = {
      births: 0,
      deaths: 0,
      starvations: 0
    };

    this.moaGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 50);
    this.eagleGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 80);
    this.plantGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 40);
    this.placeableGrid = new SpatialGrid(terrain.mapWidth, terrain.mapHeight, 60);

  }
  
  init() {
    this.spawnPlants();
    const levelSpecies = this.config.startingSpecies || null;
    this.spawnMoas(this.config.initialMoaCount, levelSpecies);
    this.spawnEagles(this.config.eagleCount);
  }
  
  spawnPlants() {
    const scale = this.config.pixelScale;
    for (let row = 0; row < this.terrain.biomeMap.length; row++) {
      for (let col = 0; col < this.terrain.biomeMap[row].length; col++) {
        const biome = this.terrain.biomeMap[row][col];
        if (biome.canHavePlants && random() < this.config.plantDensity) {
          const x = col * scale + random(-scale/2, scale/2);
          const y = row * scale + random(-scale/2, scale/2);
          this.plants.push(new Plant(x, y, random(biome.plantTypes), this.terrain, biome.key));
        }
      }
    }
  }
  
  spawnMoas(count, speciesKey = null) {
    let pref = this.seasonManager.getPreferredElevation();
    
    for (let i = 0; i < count; i++) {
      let pos = this.findWalkablePosition(pref.min, pref.max);
      
      let moa;
      if (speciesKey && typeof REGISTRY !== 'undefined') {
        // Spawn specific species
        moa = REGISTRY.createAnimal(speciesKey, pos.x, pos.y, this.terrain, this.config);
      } else if (typeof REGISTRY !== 'undefined') {
        // Spawn random moa species based on rarity
        moa = REGISTRY.createRandomOfType('moa', pos.x, pos.y, this.terrain, this.config);
      } else {
        // Fallback to direct instantiation
        moa = new Moa(pos.x, pos.y, this.terrain, this.config);
      }
      
      if (moa) {
        this.moas.push(moa);
      }
    }
  }

  spawnEagles(count) {
    for (let i = 0; i < count; i++) {
      this.spawnEagle();
    }
  }

  spawnEagle(speciesKey = null) {
    let pos = this.findWalkablePosition(0.25, 0.7);
    let attempts = 0;
    
    while (attempts < 20) {
      let tooClose = this.eagles.some(e => p5.Vector.dist(pos, e.pos) < 80);
      if (!tooClose) break;
      pos = this.findWalkablePosition(0.25, 0.7);
      attempts++;
    }
    
    let eagle;
    if (speciesKey && typeof REGISTRY !== 'undefined') {
      eagle = REGISTRY.createAnimal(speciesKey, pos.x, pos.y, this.terrain, this.config);
    } else if (typeof REGISTRY !== 'undefined') {
      eagle = REGISTRY.createRandomOfType('eagle', pos.x, pos.y, this.terrain, this.config);
    } else {
      eagle = new HaastsEagle(pos.x, pos.y, this.terrain);
    }
    
    if (eagle) {
      this.eagles.push(eagle);
    }
  }
  
  
  findWalkablePosition(minElev = 0.15, maxElev = 0.8) {
    let attempts = 0;
    while (attempts < 100) {
      let x = random(30, this.terrain.mapWidth - 30);
      let y = random(30, this.terrain.mapHeight - 30);
      let elev = this.terrain.getElevationAt(x, y);
      if (elev > minElev && elev < maxElev && this.terrain.isWalkable(x, y)) {
        return createVector(x, y);
      }
      attempts++;
    }
    return createVector(this.terrain.mapWidth / 2, this.terrain.mapHeight / 2);
  }
  
  addEgg(x, y) {
    let egg = new Egg(x, y, this.terrain, this.config);
    this.eggs.push(egg);
    return egg;
  }
  
  addPlaceable(x, y, type) {
    const placeable = new PlaceableObject(
      x, y, type, 
      this.terrain, 
      this,  // Pass simulation reference
      this.seasonManager
    );
    this.placeables.push(placeable);
    return placeable;
  }
  
  getMoaPopulation() {
    // add eggs to moa pop
    // + this.eggs.filter(e => e.alive && !e.hatched).length
    return this.moas.filter(m => m.alive).length;
  }

  updateSpatialGrids() {
    this.moaGrid.clear();
    this.eagleGrid.clear();
    this.plantGrid.clear();
    this.placeableGrid.clear();
    
    for (let moa of this.moas) {
      if (moa.alive) this.moaGrid.insert(moa);
    }
    for (let eagle of this.eagles) {
      this.eagleGrid.insert(eagle);
    }
    for (let plant of this.plants) {
      if (plant.alive) this.plantGrid.insert(plant);
    }
    for (let p of this.placeables) {
      if (p.alive) this.placeableGrid.insert(p);
    }
  }  
  
  update(mauri) {

    this.updateSpatialGrids();
  
    // Update plants with seasonal effects
    for (let plant of this.plants) {
      plant.update(this.seasonManager);
    }
    
    // Handle season change effects
    if (this.seasonManager.justChanged) {
      this.onSeasonChange();
    }
    
    for (let p of this.placeables) {
      p.update();
    }
    this.placeables = this.placeables.filter(p => p.alive);
    
    for (let egg of this.eggs) {
      for (let p of this.placeables) {
        if (p.alive && p.type === 'nest' && p.isInRange(egg.pos)) {
          egg.speedBonus = max(egg.speedBonus, p.def.eggSpeedBonus);
        }
      }
      
      egg.update();
      
      if (egg.hatched && egg.alive) {
            if (this.getMoaPopulation() < this.config.maxMoaPopulation) {
              // Get species for offspring
              const offspringSpecies = egg.getOffspringSpecies();
              
              let newMoa;
              if (typeof REGISTRY !== 'undefined' && offspringSpecies) {
                newMoa = REGISTRY.createAnimal(offspringSpecies, egg.pos.x, egg.pos.y, this.terrain, this.config);
              } else {
                newMoa = new Moa(egg.pos.x, egg.pos.y, this.terrain, this.config);
              }
              
              if (newMoa) {
                newMoa.hunger = 35;
                newMoa.size = newMoa.size * 0.6;  // Start smaller
                newMoa.homeRange = egg.pos.copy();
                this.moas.push(newMoa);
                this.stats.births++;
                mauri.earn(mauri.onEggHatch, egg.pos.x, egg.pos.y, 'hatch');
                
                // Notification with species name
                const speciesName = newMoa.species?.displayName || 'moa';
                this.game.addNotification(`A ${speciesName} has hatched!`, 'success');
              }
              
              egg.alive = false;
            }
          }
        }
    this.eggs = this.eggs.filter(e => e.alive);
    
    let aliveBeforeUpdate = this.moas.filter(m => m.alive).length;
    
    for (let moa of this.moas) {
      if (moa.alive) {
        moa.behave(this.moas, this.eagles, this.plants, this.placeables, this, mauri, this.seasonManager);
        moa.update();
      }
    }
    
    let aliveAfterUpdate = this.moas.filter(m => m.alive).length;
    let newDeaths = aliveBeforeUpdate - aliveAfterUpdate;
    if (newDeaths > 0) {
      this.stats.starvations += newDeaths;
    }
    
    for (let eagle of this.eagles) {
      eagle.behave(this.moas, this.eagles, this.placeables);
      eagle.update();
    }
    
    if (frameCount % 600 === 0) {
      this.moas = this.moas.filter(m => m.alive);
    }
  }
  
  onSeasonChange() {
    // Force dormancy check on all plants
    let dormantCount = 0;
    let wokeCount = 0;
    
    for (let plant of this.plants) {
      if (plant.isSpawned) continue;  // Skip placeable-spawned plants
      
      let shouldBeDormant = this.seasonManager.shouldPlantBeDormant(
        plant.elevation, 
        plant.biomeKey
      );
      
      if (shouldBeDormant && !plant.dormant && plant.alive) {
        if (random() < this.seasonManager.getDormancyChance()) {
          plant.goDormant();
          dormantCount++;
        }
      } else if (!shouldBeDormant && plant.dormant) {
        // Wake up plants
        if (random() < 0.5) {
          plant.dormant = false;
          plant.growth = 0.3;
          wokeCount++;
        }
      }
    }
    
    console.log(`Season change: ${dormantCount} plants went dormant, ${wokeCount} plants woke up`);
}

  render() {
    for (let plant of this.plants) {
      plant.render();
    }
    
    for (let p of this.placeables) {
      p.render();
    }
    
    for (let egg of this.eggs) {
      egg.render();
    }
    
    for (let moa of this.moas) {
      moa.render();
    }
    
    for (let eagle of this.eagles) {
      eagle.render();
    }
  }
}