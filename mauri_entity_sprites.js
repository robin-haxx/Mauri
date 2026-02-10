// ============================================
// ANGLE SNAPPING FOR PIXEL ART SPRITES
// ============================================

const SpriteAngle = {
  DIVISIONS: 12,
  INCREMENT: (Math.PI * 2) / 12,
  
  snap(angle) {
    return Math.round(angle / this.INCREMENT) * this.INCREMENT;
  },
  
  snapWithHysteresis(currentDisplayAngle, targetAngle, threshold = 0.4) {
    const snappedTarget = this.snap(targetAngle);
    
    if (currentDisplayAngle === undefined) return snappedTarget;
    
    let diff = snappedTarget - currentDisplayAngle;
    const PI = Math.PI;
    if (diff > PI) diff -= PI * 2;
    if (diff < -PI) diff += PI * 2;
    
    if (Math.abs(diff) > this.INCREMENT * threshold) {
      return snappedTarget;
    }
    
    return currentDisplayAngle;
  }
};


// ============================================
// ENTITY SPRITE MANAGER
// ============================================

const EntitySprites = {
  moa: {
    walk: [],
    idle: null,
    juvenile: null
  },
  eagle: {
    fly: [],
    dive: null,
    glide: null
  },
  loaded: false,
  loadAttempted: false,
  
  animation: {
    moaWalkSpeed: 0.12,
    eagleFlySpeed: 0.15,
    eagleDiveSpeed: 0.08
  },

  load() {
    if (this.loadAttempted) return;
    this.loadAttempted = true;
    
    const spritePath = 'sprites/';
    
    // Moa walk cycle (4 frames)
    for (let i = 1; i <= 4; i++) {
      this.moa.walk.push(loadImage(
        `${spritePath}moa_walk_${i}.png`,
        () => console.log(`Loaded moa_walk_${i}.png`),
        () => console.warn(`Could not load moa_walk_${i}.png`)
      ));
    }
    
    this.moa.idle = loadImage(
      `${spritePath}moa_idle.png`,
      () => console.log('Loaded moa_idle.png'),
      () => console.warn('Could not load moa_idle.png')
    );
    
    this.moa.juvenile = loadImage(
      `${spritePath}moa_juvenile.png`,
      () => console.log('Loaded moa_juvenile.png'),
      () => {}
    );
    
    // Eagle fly cycle (3 frames)
    for (let i = 1; i <= 3; i++) {
      this.eagle.fly.push(loadImage(
        `${spritePath}eagle_fly_${i}.png`,
        () => console.log(`Loaded eagle_fly_${i}.png`),
        () => console.warn(`Could not load eagle_fly_${i}.png`)
      ));
    }
    
    this.eagle.dive = loadImage(
      `${spritePath}eagle_dive.png`,
      () => console.log('Loaded eagle_dive.png'),
      () => console.warn('Could not load eagle_dive.png')
    );
    
    this.eagle.glide = loadImage(
      `${spritePath}eagle_glide.png`,
      () => console.log('Loaded eagle_glide.png'),
      () => console.warn('Could not load eagle_glide.png')
    );
    
    this.loaded = true;
  },

  isValid(sprite) {
    return sprite && sprite.width > 0 && sprite.height > 0;
  },

  getMoaSprite(animTime, isMoving, isJuvenile = false) {
    if (isJuvenile && this.isValid(this.moa.juvenile)) {
      return this.moa.juvenile;
    }
    
    if (isMoving && this.moa.walk.length > 0) {
      const frameIndex = Math.floor(animTime * this.animation.moaWalkSpeed) % this.moa.walk.length;
      const sprite = this.moa.walk[frameIndex];
      if (this.isValid(sprite)) return sprite;
    }
    
    if (this.isValid(this.moa.idle)) {
      return this.moa.idle;
    }
    
    return null;
  },

  getEagleSprite(animTime, state) {
    if ((state === 'hunting' || state === 'diving') && this.isValid(this.eagle.dive)) {
      return this.eagle.dive;
    }
    
    if (state === 'resting' && this.isValid(this.eagle.glide)) {
      return this.eagle.glide;
    }
    
    if (this.eagle.fly.length > 0) {
      const speed = state === 'hunting' ? this.animation.eagleDiveSpeed : this.animation.eagleFlySpeed;
      const frameIndex = Math.floor(animTime * speed) % this.eagle.fly.length;
      const sprite = this.eagle.fly[frameIndex];
      if (this.isValid(sprite)) return sprite;
    }
    
    return null;
  }
};

function loadEntitySprites() {
  EntitySprites.load();
}