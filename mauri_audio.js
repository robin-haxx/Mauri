// ============================================
// AUDIO MANAGER FOR MAURI
// ============================================

class AudioManager {
  constructor() {
    // Sound storage
    this.sounds = {
      background: null,
      tutorialTip: null,
      plantRustle: [],
      boltStrike: null,
      mateCheep: null,
      moaMilestone: null,
      seasonChange: {},
      eagleHunt: null,
      eagleCatch: null,
      win: null,
      loss: null
    };
    
    // State
    this.loaded = false;
    this.enabled = true;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    
    // Volume levels (0.0 - 1.0)
    this.masterVolume = 0.7;
    this.musicVolume = 0.4;
    this.sfxVolume = 0.8;
    
    // Cooldowns to prevent sound spam (in frames)
    this.cooldowns = {};
    this.cooldownDurations = {
      plantRustle: 15,      // ~0.25 seconds
      mateCheep: 60,        // ~1 second
      eagleHunt: 120,       // ~2 seconds
      tutorialTip: 30       // ~0.5 seconds
    };
    
    // Track currently playing sounds for management
    this._backgroundPlaying = false;
  }
  
  // ============================================
  // LOADING
  // ============================================
  
  /**
   * Load all audio files - call in preload()
   * @returns {Promise} Resolves when all audio is loaded
   */
  loadAll() {
    const audioPath = 'audio/';
    
    // Background music
    this.sounds.background = loadSound(audioPath + 'background.mp3', 
      () => {}, 
      (err) => console.warn('Could not load background music:', err)
    );
    
    // Tutorial tip
    this.sounds.tutorialTip = loadSound(audioPath + 'tutorial_tip.mp3',
      () => {},
      (err) => console.warn('Could not load tutorial_tip:', err)
    );
    
    // Plant rustle variations (1-4)
    for (let i = 1; i <= 4; i++) {
      const sound = loadSound(audioPath + `plant_rustle_${i}.mp3`,
        () => {},
        (err) => console.warn(`Could not load plant_rustle_${i}:`, err)
      );
      this.sounds.plantRustle.push(sound);
    }

    this.sounds.boltStrike = loadSound(audioPath + 'bolt_strike.mp3',
      () => {},
      (err) => console.warn('Could not load bolt_strike:', err)
    );
    
    // Mate cheep
    this.sounds.mateCheep = loadSound(audioPath + 'mate_cheep.mp3',
      () => {},
      (err) => console.warn('Could not load mate_cheep:', err)
    );
    
    // Moa milestone
    this.sounds.moaMilestone = loadSound(audioPath + 'moa_milestone.mp3',
      () => {},
      (err) => console.warn('Could not load moa_milestone:', err)
    );
    
    // Season change sounds
    const seasons = ['summer', 'autumn', 'winter', 'spring'];
    for (const season of seasons) {
      this.sounds.seasonChange[season] = loadSound(audioPath + `season_${season}.mp3`,
        () => {},
        (err) => console.warn(`Could not load season_${season}:`, err)
      );
    }
    
    // Eagle sounds
    this.sounds.eagleHunt = loadSound(audioPath + 'eagle_hunt.mp3',
      () => {},
      (err) => console.warn('Could not load eagle_hunt:', err)
    );
    
    this.sounds.eagleCatch = loadSound(audioPath + 'eagle_catch.mp3',
      () => {},
      (err) => console.warn('Could not load eagle_catch:', err)
    );
    
    // Win/Loss
    this.sounds.win = loadSound(audioPath + 'win.mp3',
      () => {},
      (err) => console.warn('Could not load win:', err)
    );
    
    this.sounds.loss = loadSound(audioPath + 'loss.mp3',
      () => {},
      (err) => console.warn('Could not load loss:', err)
    );
    
    this.loaded = true;
  }
  
  // ============================================
  // PLAYBACK HELPERS
  // ============================================
  
  /**
   * Get effective volume for a sound type
   */
  _getVolume(isMusic = false) {
    if (!this.enabled) return 0;
    if (isMusic && !this.musicEnabled) return 0;
    if (!isMusic && !this.sfxEnabled) return 0;
    
    const typeVolume = isMusic ? this.musicVolume : this.sfxVolume;
    return this.masterVolume * typeVolume;
  }
  
  /**
   * Check and update cooldown for a sound
   * @returns {boolean} True if sound can play (not on cooldown)
   */
  _checkCooldown(soundKey) {
    const now = frameCount;
    const lastPlayed = this.cooldowns[soundKey] || 0;
    const cooldownDuration = this.cooldownDurations[soundKey] || 0;
    
    if (now - lastPlayed < cooldownDuration) {
      return false;
    }
    
    this.cooldowns[soundKey] = now;
    return true;
  }
  
  /**
   * Safely play a sound with volume
   */
  _playSound(sound, volume, loop = false) {
    if (!sound || !this.enabled) return null;
    
    try {
      if (sound.isLoaded()) {
        sound.setVolume(volume);
        sound.setLoop(loop);
        sound.play();
        return sound;
      }
    } catch (e) {
      console.warn('Error playing sound:', e);
    }
    return null;
  }
  
  /**
   * Stop a sound safely
   */
  _stopSound(sound) {
    if (!sound) return;
    try {
      if (sound.isPlaying()) {
        sound.stop();
      }
    } catch (e) {
      console.warn('Error stopping sound:', e);
    }
  }
  
  // ============================================
  // BACKGROUND MUSIC
  // ============================================
  
  /**
   * Start background music (loops)
   */
  playBackground() {
    if (!this.musicEnabled || !this.enabled) return;
    if (this._backgroundPlaying) return;
    
    const sound = this.sounds.background;
    if (sound && sound.isLoaded() && !sound.isPlaying()) {
      sound.setVolume(this._getVolume(true));
      sound.setLoop(true);
      sound.play();
      this._backgroundPlaying = true;
    }
  }
  
  /**
   * Stop background music
   */
  stopBackground() {
    this._stopSound(this.sounds.background);
    this._backgroundPlaying = false;
  }
  
  /**
   * Pause background music
   */
  pauseBackground() {
    const sound = this.sounds.background;
    if (sound && sound.isPlaying()) {
      sound.pause();
    }
  }
  
  /**
   * Resume background music
   */
  resumeBackground() {
    if (!this.musicEnabled || !this.enabled) return;
    
    const sound = this.sounds.background;
    if (sound && sound.isLoaded() && !sound.isPlaying() && this._backgroundPlaying) {
      sound.play();
    }
  }
  
  /**
   * Update background music volume (call when settings change)
   */
  updateBackgroundVolume() {
    const sound = this.sounds.background;
    if (sound && sound.isLoaded()) {
      sound.setVolume(this._getVolume(true));
    }
  }
  
  // ============================================
  // SOUND EFFECTS
  // ============================================
  
  /**
   * Play tutorial tip sound
   */
  playTutorialTip() {
    if (!this._checkCooldown('tutorialTip')) return;
    this._playSound(this.sounds.tutorialTip, this._getVolume() * 0.6);
  }
  
  /**
   * Play a random plant rustle sound
   */
  playPlantRustle() {
    if (!this._checkCooldown('plantRustle')) return;
    
    const rustles = this.sounds.plantRustle.filter(s => s && s.isLoaded());
    if (rustles.length === 0) return;
    
    const sound = rustles[Math.floor(Math.random() * rustles.length)];
    // Vary volume slightly for natural feel
    const volume = this._getVolume() * (0.3 + Math.random() * 0.3);
    this._playSound(sound, volume);
  }

  playBoltStrike() {
    this._playSound(this.sounds.boltStrike, this._getVolume() * 0.7);
  }
  
  /**
   * Play mating cheep sound
   */
  playMateCheep() {
    if (!this._checkCooldown('mateCheep')) return;
    this._playSound(this.sounds.mateCheep, this._getVolume() * 0.5);
  }
  
  /**
   * Play moa population milestone sound
   */
  playMoaMilestone() {
    this._playSound(this.sounds.moaMilestone, this._getVolume() * 0.7);
  }
  
  /**
   * Play season change sound
   * @param {string} seasonKey - 'summer', 'autumn', 'winter', or 'spring'
   */
  playSeasonChange(seasonKey) {
    const sound = this.sounds.seasonChange[seasonKey];
    if (sound) {
      this._playSound(sound, this._getVolume() * 0.6);
    }
  }
  
  /**
   * Play eagle hunting sound
   */
  playEagleHunt() {
    if (!this._checkCooldown('eagleHunt')) return;
    this._playSound(this.sounds.eagleHunt, this._getVolume() * 0.7);
  }
  
  /**
   * Play eagle catch sound
   */
  playEagleCatch() {
    this._playSound(this.sounds.eagleCatch, this._getVolume() * 0.8);
  }
  
  /**
   * Play win sound
   */
  playWin() {
    // Stop background music for victory fanfare
    this.stopBackground();
    this._playSound(this.sounds.win, this._getVolume() * 0.9);
  }
  
  /**
   * Play loss sound
   */
  playLoss() {
    // Stop background music for defeat sound
    this.stopBackground();
    this._playSound(this.sounds.loss, this._getVolume() * 0.8);
  }
  
  // ============================================
  // VOLUME & SETTINGS
  // ============================================
  
  /**
   * Set master volume
   * @param {number} volume - 0.0 to 1.0
   */
  setMasterVolume(volume) {
    this.masterVolume = constrain(volume, 0, 1);
    this.updateBackgroundVolume();
  }
  
  /**
   * Set music volume
   * @param {number} volume - 0.0 to 1.0
   */
  setMusicVolume(volume) {
    this.musicVolume = constrain(volume, 0, 1);
    this.updateBackgroundVolume();
  }
  
  /**
   * Set SFX volume
   * @param {number} volume - 0.0 to 1.0
   */
  setSfxVolume(volume) {
    this.sfxVolume = constrain(volume, 0, 1);
  }
  
  /**
   * Toggle all audio
   */
  toggleAudio() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopBackground();
    } else {
      this.playBackground();
    }
    return this.enabled;
  }
  
  /**
   * Toggle music only
   */
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) {
      this.stopBackground();
    } else {
      this.playBackground();
    }
    return this.musicEnabled;
  }
  
  /**
   * Toggle SFX only
   */
  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }
  
  /**
   * Mute all audio temporarily (e.g., when tab loses focus)
   */
  mute() {
    if (this.sounds.background && this.sounds.background.isPlaying()) {
      this.sounds.background.setVolume(0);
    }
  }
  
  /**
   * Unmute audio
   */
  unmute() {
    this.updateBackgroundVolume();
  }
}

// Global audio manager instance
let audioManager = null;

/**
 * Initialize audio manager - call in setup()
 */
function initAudioManager() {
  audioManager = new AudioManager();
  return audioManager;
}

/**
 * Load all audio - call in preload()
 */
function preloadAudio() {
  if (!audioManager) {
    audioManager = new AudioManager();
  }
  audioManager.loadAll();
}