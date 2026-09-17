// ============================================
// AUDIO MANAGER FOR MAURI
// ============================================

// Per-species call recordings for the highlight buttons. A missing file falls back
// to the generic moa or eagle call in playSpeciesCall().
const SPECIES_CALL_FILES = {
  little_bush_moa: 'call_little_bush_moa.mp3',
  upland_moa: 'call_upland_moa.mp3'
};

// Haast's-eagle hunt cries. The eagle draws a RANDOM cry from this pool each time it
// starts a hunt (and for the eagle highlight button), so repeated hunts have variety.
// eagle_hunt.mp3 is the original and is loaded separately; the rest are optional extras;
// a file that isn't present is simply dropped from the pool, so you can add or remove
// eagle_cry_N.mp3 files here freely.
const EAGLE_HUNT_CRY_FILES = [
  'eagle_cry_1.mp3',
  'eagle_cry_2.mp3',
  'eagle_cry_3.mp3'
];

// Extended "voice" tracks; long field recordings that play when a species is HIGHLIGHTED
// (the sidebar toggle; a level's focus species start highlighted). Instead of a short
// one-shot, a highlighted species fades its recording in at a RANDOM point and lets it
// breathe for a few seconds:
//   · Most birds: a single track, played as a several-second snippet on each highlight.
//   · kākāpō (sustain): the track LOOPS for as long as they stay the focus, crossfading
//     between sub-calls as the flock's behaviour changes (see _kakapoBehaviourState).
// kōkako carries two moods (song / alarmed) and switches to the alarm call while a raptor
// is on the hunt.
//
// A species with no entry here (or whose files are all missing) falls back to the short
// playSpeciesCall() one-shot. To turn any species back into a discrete sound effect, delete
// its entry below (or remove its files); nothing else needs to change.
const SPECIES_VOICE_TRACKS = {
  kea:    { states: { song: 'kea_song.mp3' } },
  kaka:   { states: { song: 'kaka_south_island.mp3' } },
  moa:    { states: { song: 'moa_extended.mp3' } },   // baseType; covers every moa species
  kokako: { states: { song: 'kokako_song.mp3', alarmed: 'kokako_alarmed.mp3' } },
  kakapo: {
    sustain: true,
    states: {
      idle:        'kakapo_female.mp3',        // the consistent base ambience
      boom:        'kakapo_male_boom.mp3',     // males booming in a mast (mating) year
      territorial: 'kakapo_male_territorial.mp3'  // when several males are contesting courts
      // kakapo_male_ching.mp3 is also present; add a state here and a rule in
      // _kakapoBehaviourState() to fold it in.
    }
  }
};

// Voice playback tuning.
const VOICE_SNIPPET_SEC  = 5.0;   // audible length of a one-shot voice snippet
const VOICE_FADE_IN_SEC  = 0.9;   // fade-in when a voice (or a crossfade target) starts
const VOICE_FADE_OUT_SEC = 1.3;   // fade-out at a snippet's end or when un-highlighted
const VOICE_VOLUME       = 0.6;   // voice level, relative to the SFX volume
const KAKAPO_TERRITORIAL_MIN = 2; // this many males actively contesting → territorial track

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
      loss: null,
      speciesCalls: {},     // key -> dedicated call sample (see SPECIES_CALL_FILES)
      eagleHuntCries: [],   // extra hunt-cry variants, pooled with eagleHunt (EAGLE_HUNT_CRY_FILES)
      speciesVoices: {}     // voiceKey -> { stateName -> SoundFile|null } (SPECIES_VOICE_TRACKS)
    };

    // Extended-voice runtime (driven each frame by update()).
    //   _voices: voiceKey -> { active, sustain, current(stateName), sound, snippetTimer, _vol }
    //   _prevVoiceDesired: voiceKeys highlighted last frame, for rising/falling edges
    //   _fadingVoices: loops mid fade-out awaiting a stop; {sound, frames}
    this._voices = {};
    this._prevVoiceDesired = new Set();
    this._fadingVoices = [];
    this._muted = false;   // tab-blur duck (mute()/unmute()); silences voices like music
    
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
      tutorialTip: 30,      // ~0.5 seconds
      speciesCall: 45       // ~0.75 seconds (highlight-button click-spam guard)
    };
    
    // Track currently playing sounds for management
    this._backgroundPlaying = false;
  }
  
  // ============================================
  // LOADING
  // ============================================
  
  // Load all audio files (call in preload()).
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

    // Dedicated species calls; optional files. NOT loadSound(): a missing file would
    // hang preload(). Constructing p5.SoundFile directly skips the preload counter.
    for (const [key, file] of Object.entries(SPECIES_CALL_FILES)) {
      try {
        this.sounds.speciesCalls[key] = new p5.SoundFile(audioPath + file,
          () => {},
          () => {
            this.sounds.speciesCalls[key] = null;
            console.info(`No dedicated call for ${key} (${file}); using generic call`);
          }
        );
      } catch (e) {
        this.sounds.speciesCalls[key] = null;
      }
    }

    // Extra eagle hunt cries; optional (constructed directly so a missing file can't hang
    // preload). eagle_hunt loaded above stays the pool's anchor; these join it at play time.
    for (const file of EAGLE_HUNT_CRY_FILES) {
      try {
        const cry = new p5.SoundFile(audioPath + file,
          () => {},
          () => {
            const i = this.sounds.eagleHuntCries.indexOf(cry);
            if (i >= 0) this.sounds.eagleHuntCries.splice(i, 1);
            console.info(`No eagle cry ${file}; skipping (using the rest of the pool)`);
          }
        );
        this.sounds.eagleHuntCries.push(cry);
      } catch (e) { /* pool stays as-is */ }
    }

    // Extended species voice tracks; all optional (see SPECIES_VOICE_TRACKS). Same
    // direct-construct pattern: a missing state file nulls out and the species falls back.
    for (const [voiceKey, cfg] of Object.entries(SPECIES_VOICE_TRACKS)) {
      const bank = {};
      this.sounds.speciesVoices[voiceKey] = bank;
      for (const [stateName, file] of Object.entries(cfg.states)) {
        try {
          const sf = new p5.SoundFile(audioPath + file,
            () => {},
            () => {
              bank[stateName] = null;
              console.info(`No voice track ${file} for ${voiceKey}/${stateName}; falling back`);
            }
          );
          bank[stateName] = sf;
        } catch (e) {
          bank[stateName] = null;
        }
      }
    }

    this.loaded = true;
  }
  
  // ============================================
  // PLAYBACK HELPERS
  // ============================================
  
  // Effective volume for a sound type.
  _getVolume(isMusic = false) {
    if (!this.enabled) return 0;
    if (isMusic && !this.musicEnabled) return 0;
    if (!isMusic && !this.sfxEnabled) return 0;
    
    const typeVolume = isMusic ? this.musicVolume : this.sfxVolume;
    return this.masterVolume * typeVolume;
  }
  
  // Check + update cooldown; true if the sound can play (not on cooldown).
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
  
  // Safely play a sound with volume.
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
  
  // Stop a sound safely.
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
  
  // Start background music (loops).
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
  
  // Stop background music.
  stopBackground() {
    this._stopSound(this.sounds.background);
    this._backgroundPlaying = false;
  }
  
  // Pause background music.
  pauseBackground() {
    const sound = this.sounds.background;
    if (sound && sound.isPlaying()) {
      sound.pause();
    }
  }
  
  // Resume background music.
  resumeBackground() {
    if (!this.musicEnabled || !this.enabled) return;
    
    const sound = this.sounds.background;
    if (sound && sound.isLoaded() && !sound.isPlaying() && this._backgroundPlaying) {
      sound.play();
    }
  }
  
  // Update background music volume.
  updateBackgroundVolume() {
    const sound = this.sounds.background;
    if (sound && sound.isLoaded()) {
      sound.setVolume(this._getVolume(true));
    }
  }
  
  // ============================================
  // SOUND EFFECTS
  // ============================================
  
  // Play tutorial tip sound.
  playTutorialTip() {
    if (!this._checkCooldown('tutorialTip')) return;
    this._playSound(this.sounds.tutorialTip, this._getVolume() * 0.6);
  }
  
  // Play a random plant rustle sound.
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
  
  // Play mating cheep sound.
  playMateCheep() {
    if (!this._checkCooldown('mateCheep')) return;
    this._playSound(this.sounds.mateCheep, this._getVolume() * 0.5);
  }
  
  // Play moa population milestone sound.
  playMoaMilestone() {
    this._playSound(this.sounds.moaMilestone, this._getVolume() * 0.7);
  }

  // True if the key names an eagle species.
  _isEagleSpecies(key) {
    return typeof EAGLE_SPECIES !== 'undefined' && !!EAGLE_SPECIES[key];
  }

  // A random loaded hunt cry from the pool (eagleHunt + the eagle_cry_N extras), so the
  // eagle doesn't repeat the same cry every hunt. Falls back to eagleHunt.
  _randomEagleCry() {
    const pool = [];
    if (this.sounds.eagleHunt && this.sounds.eagleHunt.isLoaded && this.sounds.eagleHunt.isLoaded()) {
      pool.push(this.sounds.eagleHunt);
    }
    for (const c of this.sounds.eagleHuntCries) {
      if (c && c.isLoaded()) pool.push(c);
    }
    if (pool.length === 0) return this.sounds.eagleHunt || null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Play the call for a species (highlight-button click): a dedicated recording if
  // loaded, else a random eagle hunt cry for eagles, else the generic moa call.
  // Species with an extended voice track (SPECIES_VOICE_TRACKS) are NOT handled here;
  // the highlight update() loop owns them, fading their recording in and out.
  playSpeciesCall(speciesKey = null) {
    if (this._hasVoice(speciesKey)) return;
    if (!this._checkCooldown('speciesCall')) return;

    const custom = speciesKey && this.sounds.speciesCalls[speciesKey];
    if (custom && custom.isLoaded()) {
      this._playSound(custom, this._getVolume() * 0.55);
      return;
    }
    if (this._isEagleSpecies(speciesKey)) {
      this._playSound(this._randomEagleCry(), this._getVolume() * 0.55);
      return;
    }
    this._playSound(this.sounds.moaMilestone, this._getVolume() * 0.55);
  }

  // Generic moa call (kept for existing call sites).
  playMoaCall() {
    this.playSpeciesCall(null);
  }

  // Eagle call; the hunt cry at button volume.
  playEagleCall() {
    this.playSpeciesCall('haasts_eagle');
  }
  
  // Play season change sound.
  playSeasonChange(seasonKey) {
    const sound = this.sounds.seasonChange[seasonKey];
    if (sound) {
      this._playSound(sound, this._getVolume() * 0.6);
    }
  }
  
  // Play a (random) eagle hunting cry.
  playEagleHunt() {
    if (!this._checkCooldown('eagleHunt')) return;
    this._playSound(this._randomEagleCry(), this._getVolume() * 0.7);
  }
  
  // Play eagle catch sound.
  playEagleCatch() {
    this._playSound(this.sounds.eagleCatch, this._getVolume() * 0.8);
  }
  
  // Play win sound.
  playWin() {
    // Stop background music for victory fanfare
    this.stopBackground();
    this.stopAllVoices();
    this._playSound(this.sounds.win, this._getVolume() * 0.9);
  }
  
  // Play loss sound.
  playLoss() {
    // Stop background music for defeat sound
    this.stopBackground();
    this.stopAllVoices();
    this._playSound(this.sounds.loss, this._getVolume() * 0.8);
  }

  // ============================================
  // EXTENDED SPECIES VOICES (highlight tracks)
  // ============================================
  // Driven by update() each frame while playing. A highlighted species with a voice track
  // fades its recording in at a random point; kākāpō sustain a loop and crossfade sub-calls.

  // The voice-config key a highlighted species resolves to (moa species share the 'moa'
  // track). Eagles are deliberately excluded; they keep their short cries. null = no voice.
  _voiceKeyFor(key) {
    if (!key) return null;
    if (SPECIES_VOICE_TRACKS[key]) return key;
    if (typeof MOA_SPECIES !== 'undefined' && MOA_SPECIES[key] && SPECIES_VOICE_TRACKS.moa) return 'moa';
    return null;
  }

  _hasVoice(key) {
    return this._voiceKeyFor(key) !== null;
  }

  // A random start offset that still leaves `needSec` of audio to play (0 for loops).
  _randomCue(sound, needSec = 0) {
    let dur = 0;
    try { dur = sound.duration() || 0; } catch (e) { dur = 0; }
    const room = Math.max(0, dur - needSec - 0.15);
    return room > 0 ? Math.random() * room : 0;
  }

  // First loaded state in a bank, for a graceful fallback when a preferred state is missing.
  _anyLoadedState(bank) {
    for (const k of Object.keys(bank)) if (bank[k] && bank[k].isLoaded()) return k;
    return null;
  }

  // True while a raptor is actively hunting; kōkako switch to their alarm call.
  _predatorActive(sim) {
    const eagles = (sim && sim.eagles) || [];
    for (let i = 0; i < eagles.length; i++) {
      if (eagles[i] && eagles[i].alive && eagles[i].hunting) return true;
    }
    return false;
  }

  // Which kākāpō sub-call fits the flock right now:
  //   territorial; several males contesting courts with each other
  //   boom       ; a mast (mating) year with males present, booming for females
  //   idle       ; the calm base ambience otherwise
  _kakapoBehaviourState(sim) {
    const list = (sim && sim.otherEntities && sim.otherEntities.kakapo) || [];
    let contesting = 0, males = 0;
    for (let i = 0; i < list.length; i++) {
      const k = list[i];
      if (!k || !k.alive || k.isFemale) continue;
      males++;
      if (k._contesting) contesting++;
    }
    if (contesting >= KAKAPO_TERRITORIAL_MIN) return 'territorial';
    if (sim && sim.mastYear && males > 0) return 'boom';
    return 'idle';
  }

  // The state name a voice should be sounding, given the sim.
  _voiceTargetState(voiceKey, sim) {
    const bank = this.sounds.speciesVoices[voiceKey] || {};
    if (voiceKey === 'kakapo') {
      const st = this._kakapoBehaviourState(sim);
      if (bank[st] && bank[st].isLoaded()) return st;
      return (bank.idle && bank.idle.isLoaded()) ? 'idle' : this._anyLoadedState(bank);
    }
    if (voiceKey === 'kokako') {
      if (this._predatorActive(sim) && bank.alarmed && bank.alarmed.isLoaded()) return 'alarmed';
      return (bank.song && bank.song.isLoaded()) ? 'song' : this._anyLoadedState(bank);
    }
    return (bank.song && bank.song.isLoaded()) ? 'song' : this._anyLoadedState(bank);
  }

  // Start one state's SoundFile from a random offset, fading up from silence. Returns the
  // SoundFile (still playing) or null if unavailable.
  _startVoiceState(bank, stateName, voiceVol, loop, needSec = 0) {
    const sound = stateName && bank[stateName];
    if (!sound || !sound.isLoaded()) return null;
    // If this exact file is queued to be stopped mid-fade (a quick crossfade back), cancel
    // that stop so reviving it doesn't get cut off.
    this._fadingVoices = this._fadingVoices.filter(f => f.sound !== sound);
    const cue = this._randomCue(sound, loop ? 0 : needSec);
    try {
      sound.setVolume(0);
      if (loop) sound.loop(0, 1, 0, cue);
      else sound.play(0, 1, 0, cue);
      sound.setVolume(voiceVol, VOICE_FADE_IN_SEC);
    } catch (e) {
      console.warn('Voice start failed:', e);
      return null;
    }
    return sound;
  }

  // Begin a species voice on the rising highlight edge.
  _startVoice(voiceKey, sim, voiceVol) {
    const cfg = SPECIES_VOICE_TRACKS[voiceKey];
    const bank = this.sounds.speciesVoices[voiceKey];
    if (!cfg || !bank) return;

    const stateName = this._voiceTargetState(voiceKey, sim);
    const sustain = !!cfg.sustain;
    const sound = this._startVoiceState(bank, stateName, voiceVol, sustain,
                                        sustain ? 0 : VOICE_SNIPPET_SEC);
    if (!sound) return;

    this._voices[voiceKey] = {
      active: true,
      sustain,
      current: stateName,
      sound,
      _vol: voiceVol,
      snippetTimer: sustain ? 0 : VOICE_SNIPPET_SEC * 60
    };
  }

  // A sustaining voice (kākāpō) tracks the flock: crossfade to a new sub-call when the
  // behaviour changes, otherwise just keep its volume in step with the sliders.
  _updateSustainVoice(voiceKey, sim, voiceVol) {
    const v = this._voices[voiceKey];
    if (!v) return;
    const bank = this.sounds.speciesVoices[voiceKey];
    const target = this._voiceTargetState(voiceKey, sim);

    if (target && target !== v.current && bank[target] && bank[target].isLoaded()) {
      // Crossfade: ramp the current loop down (queued for a stop), bring the new one up.
      if (v.sound) {
        try { v.sound.setVolume(0, VOICE_FADE_OUT_SEC); } catch (e) {}
        this._fadingVoices.push({ sound: v.sound, frames: (VOICE_FADE_OUT_SEC + 0.2) * 60 });
      }
      const next = this._startVoiceState(bank, target, voiceVol, true);
      v.sound = next;
      v.current = target;
      v._vol = voiceVol;
    } else if (v.sound && Math.abs((v._vol || 0) - voiceVol) > 0.01) {
      try { v.sound.setVolume(voiceVol, 0.2); } catch (e) {}
      v._vol = voiceVol;
    }
  }

  // Fade a voice out and queue its stop.
  _stopVoice(voiceKey) {
    const v = this._voices[voiceKey];
    if (!v) return;
    if (v.sound) {
      try { v.sound.setVolume(0, VOICE_FADE_OUT_SEC); } catch (e) {}
      this._fadingVoices.push({ sound: v.sound, frames: (VOICE_FADE_OUT_SEC + 0.2) * 60 });
    }
    v.active = false;
    v.sound = null;
    v.current = null;
  }

  // Stop every extended voice immediately (level change, win/loss, audio off).
  stopAllVoices() {
    for (const vk of Object.keys(this._voices)) this._stopVoice(vk);
    for (const f of this._fadingVoices) this._stopSound(f.sound);
    this._fadingVoices = [];
    this._prevVoiceDesired = new Set();
  }

  // Per-frame voice driver; call from the game update while PLAYING, passing the
  // simulation. Reconciles SPECIES_HIGHLIGHT with the voice tracks: fades new highlights
  // in at a random point, fades removed ones out, crossfades the kākāpō ambience, and
  // times out one-shot snippets. Cheap when nothing is highlighted.
  update(sim, dt = 1) {
    // Advance loops still fading out; stop them once silent.
    for (let i = this._fadingVoices.length - 1; i >= 0; i--) {
      const f = this._fadingVoices[i];
      f.frames -= dt;
      if (f.frames <= 0) {
        this._stopSound(f.sound);
        this._fadingVoices.splice(i, 1);
      }
    }

    const baseVol = this._getVolume() * VOICE_VOLUME;

    // Audio/SFX fully off: silence everything and forget "desired" so voices re-trigger
    // cleanly when re-enabled. (A tab-blur mute is different; it keeps voices alive at
    // volume 0 so they resume in place on unmute.)
    if (baseVol <= 0) {
      for (const vk of Object.keys(this._voices)) {
        if (this._voices[vk] && this._voices[vk].active) this._stopVoice(vk);
      }
      this._prevVoiceDesired = new Set();
      return;
    }
    const voiceVol = this._muted ? 0 : baseVol;

    // Voice keys highlighted this frame.
    const desired = new Set();
    if (typeof SPECIES_HIGHLIGHT !== 'undefined') {
      for (const key of SPECIES_HIGHLIGHT) {
        const vk = this._voiceKeyFor(key);
        if (vk) desired.add(vk);
      }
    }

    // Rising edges start; falling edges fade out.
    for (const vk of desired) {
      if (!this._prevVoiceDesired.has(vk)) this._startVoice(vk, sim, voiceVol);
    }
    for (const vk of this._prevVoiceDesired) {
      if (!desired.has(vk)) this._stopVoice(vk);
    }

    // Tick active voices.
    for (const vk of Object.keys(this._voices)) {
      const v = this._voices[vk];
      if (!v || !v.active) continue;
      if (v.sustain) {
        this._updateSustainVoice(vk, sim, voiceVol);
      } else {
        // Keep the snippet's volume in step with the sliders / mute state.
        if (v.sound && Math.abs((v._vol || 0) - voiceVol) > 0.01) {
          try { v.sound.setVolume(voiceVol, 0.2); } catch (e) {}
          v._vol = voiceVol;
        }
        v.snippetTimer -= dt;
        if (v.snippetTimer <= 0) this._stopVoice(vk);
      }
    }

    this._prevVoiceDesired = desired;
  }

  // ============================================
  // VOLUME & SETTINGS
  // ============================================
  
  // Set master volume (0..1).
  setMasterVolume(volume) {
    this.masterVolume = constrain(volume, 0, 1);
    this.updateBackgroundVolume();
  }
  
  // Set music volume (0..1).
  setMusicVolume(volume) {
    this.musicVolume = constrain(volume, 0, 1);
    this.updateBackgroundVolume();
  }
  
  // Set SFX volume (0..1).
  setSfxVolume(volume) {
    this.sfxVolume = constrain(volume, 0, 1);
  }
  
  // Toggle all audio.
  toggleAudio() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopBackground();
    } else {
      this.playBackground();
    }
    return this.enabled;
  }
  
  // Toggle music only.
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) {
      this.stopBackground();
    } else {
      this.playBackground();
    }
    return this.musicEnabled;
  }
  
  // Toggle SFX only.
  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }
  
  // Mute all audio temporarily (e.g. when the tab loses focus). The per-frame voice
  // update() is throttled while the tab is hidden, so silence the voices directly here
  // rather than waiting for the loop; keeping them consistent with the background music.
  mute() {
    this._muted = true;
    if (this.sounds.background && this.sounds.background.isPlaying()) {
      this.sounds.background.setVolume(0);
    }
    for (const vk in this._voices) {
      const v = this._voices[vk];
      if (v && v.active && v.sound) {
        try { v.sound.setVolume(0, 0.2); } catch (e) {}
        v._vol = 0;
      }
    }
    for (const f of this._fadingVoices) {
      try { f.sound.setVolume(0, 0.1); } catch (e) {}
    }
  }

  // Unmute audio; restore the background and every active voice to the live level.
  unmute() {
    this._muted = false;
    this.updateBackgroundVolume();
    const voiceVol = this._getVolume() * VOICE_VOLUME;
    for (const vk in this._voices) {
      const v = this._voices[vk];
      if (v && v.active && v.sound) {
        try { v.sound.setVolume(voiceVol, 0.2); } catch (e) {}
        v._vol = voiceVol;
      }
    }
  }
}

// Global audio manager instance
let audioManager = null;

// Initialize audio manager (call in setup()).
function initAudioManager() {
  audioManager = new AudioManager();
  return audioManager;
}

// Load all audio (call in preload()).
function preloadAudio() {
  if (!audioManager) {
    audioManager = new AudioManager();
  }
  audioManager.loadAll();
}