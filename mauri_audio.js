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

// A thin p5.SoundFile-compatible wrapper around a streaming <audio> element, used ONLY
// for the long background-music track. p5.loadSound() fully decodes a file to PCM in RAM;
// for the ~4½-minute background loop that's ~90 MB of resident audio that never gets
// freed, and its looping source node sits in the Web Audio graph for the whole session —
// the single biggest contributor to the late-session audio drop-out on low-end machines.
// Streaming holds almost no PCM and adds no source node. Only the method surface that
// AudioManager actually calls on the background track is implemented, so it's a drop-in.
class StreamingSound {
  constructor(src, onLoad, onError) {
    this._ready = false;        // 'canplay' has fired (enough buffered to start)
    this._wantPlaying = false;  // intent, so a start requested before load still fires
    this._loop = false;
    const el = new Audio();
    this.el = el;
    el.preload = 'auto';        // begin buffering during preload() like the other sounds
    el.addEventListener('canplay', () => {
      this._ready = true;
      if (onLoad) { try { onLoad(this); } catch (e) {} onLoad = null; }
      // Cover the load race: play() was called before we could actually start.
      if (this._wantPlaying && el.paused) this._start();
    });
    el.addEventListener('error', () => {
      if (onError) { try { onError(el.error); } catch (e) {} onError = null; }
    });
    el.src = src;
  }
  isLoaded() { return this._ready || this.el.readyState >= 3; }
  isPlaying() { return !this.el.paused && !this.el.ended; }
  setLoop(loop) { this._loop = !!loop; this.el.loop = !!loop; }
  // Mirrors SoundFile.setVolume(v[, rampTime]); background never ramps, so set instantly.
  // <audio>.volume is a hard [0,1], unlike p5's amplifiable gain — clamp to be safe.
  setVolume(v) { this.el.volume = Math.max(0, Math.min(1, v)); }
  _start() {
    const p = this.el.play();
    // play() rejects if it beats the autoplay gesture; the next play() call retries.
    if (p && p.catch) p.catch(() => {});
  }
  play() { this._wantPlaying = true; this.el.loop = this._loop; if (this.isLoaded()) this._start(); }
  pause() { this._wantPlaying = false; try { this.el.pause(); } catch (e) {} }
  stop() { this._wantPlaying = false; try { this.el.pause(); this.el.currentTime = 0; } catch (e) {} }
}

// One playing instance of a decoded p5.SoundFile's buffer, on plain Web Audio: its own
// AudioBufferSourceNode into its own GainNode, into p5's master input (so the master limiter
// still applies). p5.SoundFile is kept for LOADING only. Its play()/loop() rebuild, on every
// call, a sound-length "counter" buffer in a main-thread JS loop plus a new AudioWorkletNode,
// just to track the playhead; for the long voice tracks that was a 100 MB+ allocation and a
// ~0.4 s stall per highlight, the GC churn behind the audio drop-outs. Each playback owns its
// gain, so overlapping plays of one file (a voice crossfading back to itself) never fight
// over a shared volume. Nodes are disconnected when the sound ends so they can be collected.
class BufferPlayback {
  // sf: a loaded p5.SoundFile. opts: { loop, offset (s), fadeIn (s), duration (s), fadeOut (s),
  // rate (playback speed and pitch, 1 = as recorded) }.
  // duration makes it a timed one-shot: it fades out over its last fadeOut seconds and stops,
  // scheduled on the audio clock so it ends on time even while the game is paused.
  constructor(sf, volume, opts = {}) {
    const ctx = getAudioContext();
    const buf = sf.buffer;
    // p5 routed every SoundFile through a centred StereoPannerNode, which puts a mono file at
    // −3 dB on each side; match that so mono files keep their old level.
    this._scale = buf.numberOfChannels === 1 ? Math.SQRT1_2 : 1;
    this.gain = ctx.createGain();
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = !!opts.loop;   // whole-buffer loop (p5 looped only from the cue to the end)
    if (opts.rate > 0) this.src.playbackRate.value = opts.rate;
    this.src.connect(this.gain);
    const out = (typeof p5 !== 'undefined' && p5.soundOut && p5.soundOut.input) || ctx.destination;
    this.gain.connect(out);

    const now = ctx.currentTime;
    const target = Math.max(0, volume) * this._scale;
    // gain.value only catches up with scheduled automation at the next render block, so
    // remember the starting level for a setVolume() in the same instant (see setVolume).
    this._t0 = now;
    this._startLevel = opts.fadeIn > 0 ? 0 : target;
    this.gain.gain.setValueAtTime(this._startLevel, now);
    if (opts.fadeIn > 0) this.gain.gain.linearRampToValueAtTime(target, now + opts.fadeIn);

    this.playing = true;
    BufferPlayback.live++;
    this.src.onended = () => this._release();
    const offset = Math.max(0, Math.min(opts.offset || 0, Math.max(0, buf.duration - 0.01)));
    this.src.start(now, offset);
    if (opts.duration > 0) {
      const fade = opts.fadeOut || 0;
      this.gain.gain.setValueAtTime(target, now + opts.duration - fade);
      this.gain.gain.linearRampToValueAtTime(0, now + opts.duration);
      this.src.stop(now + opts.duration + 0.05);
    }
  }

  isPlaying() { return this.playing; }

  // Mirrors SoundFile.setVolume(v[, rampTime]): ramp from the current level to v.
  setVolume(v, rampTime = 0) {
    if (!this.playing) return;
    const g = this.gain.gain, now = getAudioContext().currentTime;
    const target = Math.max(0, v) * this._scale;
    const from = (now <= this._t0) ? this._startLevel : g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(from, now);
    if (rampTime > 0) g.linearRampToValueAtTime(target, now + rampTime);
    else g.setValueAtTime(target, now);
  }

  stop() {
    if (!this.playing) return;
    try { this.src.stop(); } catch (e) {}
    this._release();
  }

  // Idempotent: the 'ended' event also fires after an explicit stop().
  _release() {
    if (!this.playing) return;
    this.playing = false;
    BufferPlayback.live--;
    try { this.src.disconnect(); } catch (e) {}
    try { this.gain.disconnect(); } catch (e) {}
  }
}
BufferPlayback.live = 0;   // playbacks still sounding (the perf HUD's audio node count)

// A long recording (the species voice tracks) played by STREAMING rather than decoding.
// p5.SoundFile decodes a whole file to PCM up front; the ~14 minutes of voice recordings held
// ~277 MB of decoded audio for the whole session, which tablets can't spare. Here each track
// is a couple of <audio> elements that decode only as they play, routed through Web Audio
// (MediaElementSource → its own gain → p5's master input), so fades, crossfades and volume
// still ramp on the audio clock and the master limiter applies, as with BufferPlayback.
// Same surface the voice code reads off a p5.SoundFile: isLoaded(), duration().
class StreamingTrack {
  constructor(src, onLoad, onError) {
    this.src = src;
    this.isStreaming = true;
    this._duration = 0;
    this._loaded = false;
    this._failed = false;
    this._onLoad = onLoad;
    this._onError = onError;
    // Two players, so overlapping plays of one file (a voice crossfading back into itself before
    // its fade-out ends) each get their own element. The second buffers only when first played.
    this._players = [this._makePlayer('auto'), this._makePlayer('metadata')];
  }

  _makePlayer(preload) {
    const el = new Audio();
    el.preload = preload;
    const ctx = getAudioContext();
    // Created up front and left disconnected from the output while idle, so nothing reaches the
    // speakers until a playback connects it (see prime()).
    const node = ctx.createMediaElementSource(el);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    node.connect(gain);
    const player = { el, gain, owner: null, primed: false };
    // Loaded = the length is known (the voices start at a random point in the recording). A
    // stream can report its metadata before its length, so watch durationchange too.
    const onMeta = () => {
      if (isFinite(el.duration) && el.duration > this._duration) this._duration = el.duration;
      if (!this._loaded && !this._failed && this._duration > 0) {
        this._loaded = true;
        if (this._onLoad) { try { this._onLoad(this); } catch (e) {} }
      }
    };
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('error', () => this._fail(el.error));
    el.addEventListener('ended', () => { if (player.owner) player.owner._release(); });
    el.src = this.src;
    return player;
  }

  _fail(err) {
    if (this._failed) return;
    this._failed = true;
    this._loaded = false;
    if (this._onError) { try { this._onError(err); } catch (e) {} }
  }

  isLoaded() { return this._loaded && !this._failed; }
  duration() { return this._duration; }

  // A free player for `owner`; when both are sounding, the one started first is cut (it is the
  // one fading out).
  _acquire(owner) {
    let p = this._players[0].owner ? (this._players[1].owner ? null : this._players[1]) : this._players[0];
    if (!p) {
      p = (this._players[0].owner._startedAt <= this._players[1].owner._startedAt)
        ? this._players[0] : this._players[1];
      p.owner._release();
    }
    p.owner = owner;
    return p;
  }

  // Call inside a user gesture (touchend / mousedown). iOS lets a media element play by itself
  // only after it has been played once inside a gesture, and the voices start from the game
  // loop, so play-and-pause each idle element here. It is disconnected from the output, so
  // this is silent. The streamed background music is unlocked the same way (unlockFromGesture).
  prime() {
    for (const p of this._players) {
      if (p.primed || p.owner) continue;
      p.primed = true;
      let r;
      try { r = p.el.play(); } catch (e) { p.primed = false; continue; }
      if (r && r.then) r.then(() => { if (!p.owner) p.el.pause(); }, () => { p.primed = false; });
    }
  }
}

// One playing instance of a StreamingTrack; the same surface as BufferPlayback (isPlaying,
// setVolume, stop, gain). The fade-in starts once the stream is actually playing, so a slow
// buffer can't eat into it; a setVolume() before then just changes the level it fades up to.
class StreamPlayback {
  // track: a loaded StreamingTrack. opts: as BufferPlayback's.
  constructor(track, volume, opts = {}) {
    const ctx = getAudioContext();
    this._scale = 1;   // the voice recordings are all stereo (see BufferPlayback's mono note)
    this._target = Math.max(0, volume) * this._scale;
    this._fadeIn = opts.fadeIn > 0 ? opts.fadeIn : 0;
    this._started = false;
    this._timer = null;
    this._startedAt = ctx.currentTime;
    const p = this._player = track._acquire(this);
    this.gain = p.gain;
    this.playing = true;
    StreamPlayback.live++;

    const g = this.gain.gain;
    g.cancelScheduledValues(0);
    g.setValueAtTime(0, ctx.currentTime);
    this.gain.connect((typeof p5 !== 'undefined' && p5.soundOut && p5.soundOut.input) || ctx.destination);
    const el = p.el;
    el.loop = !!opts.loop;
    try { el.currentTime = Math.max(0, opts.offset || 0); } catch (e) {}

    const begin = () => {
      if (!this.playing) return;
      this._started = true;
      const now = getAudioContext().currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(this._fadeIn > 0 ? 0 : this._target, now);
      if (this._fadeIn > 0) g.linearRampToValueAtTime(this._target, now + this._fadeIn);
      if (opts.duration > 0) {
        const fade = opts.fadeOut || 0;
        g.setValueAtTime(this._target, now + opts.duration - fade);
        g.linearRampToValueAtTime(0, now + opts.duration);
        this._timer = setTimeout(() => this.stop(), (opts.duration + 0.05) * 1000);
      }
    };
    let r;
    try { r = el.play(); } catch (e) { this._release(); return; }
    if (r && r.then) r.then(begin, () => this._release());
    else begin();
  }

  isPlaying() { return this.playing; }

  setVolume(v, rampTime = 0) {
    if (!this.playing) return;
    this._target = Math.max(0, v) * this._scale;
    if (!this._started) return;   // the fade-in, when it starts, heads for the new level
    const g = this.gain.gain, now = getAudioContext().currentTime;
    const from = g.value;
    g.cancelScheduledValues(now);
    g.setValueAtTime(from, now);
    if (rampTime > 0) g.linearRampToValueAtTime(this._target, now + rampTime);
    else g.setValueAtTime(this._target, now);
  }

  stop() { this._release(); }

  // Idempotent; also runs when the track ends or another playback takes the element.
  _release() {
    if (!this.playing) return;
    this.playing = false;
    StreamPlayback.live--;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    const p = this._player;
    if (p.owner !== this) return;
    p.owner = null;
    try { p.el.pause(); } catch (e) {}
    try { p.gain.disconnect(); } catch (e) {}
  }
}
StreamPlayback.live = 0;

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
    
    // Background music — STREAMED (see StreamingSound), not loadSound(): keeps ~90 MB of
    // decoded PCM out of RAM and its looping source node out of the Web Audio graph. It's
    // constructed directly, so (like the optional calls below) it never blocks preload().
    this.sounds.background = new StreamingSound(audioPath + 'background.mp3',
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

    // Extended species voice tracks; all optional (see SPECIES_VOICE_TRACKS). STREAMED (see
    // StreamingTrack), not decoded: minutes of recordings each. A missing state file nulls out
    // and the species falls back.
    for (const [voiceKey, cfg] of Object.entries(SPECIES_VOICE_TRACKS)) {
      const bank = {};
      this.sounds.speciesVoices[voiceKey] = bank;
      for (const [stateName, file] of Object.entries(cfg.states)) {
        try {
          const sf = new StreamingTrack(audioPath + file,
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
  
  // Safely play a loaded SoundFile at a volume, on plain Web Audio (see BufferPlayback).
  // Returns the playback handle, or null.
  _playSound(sound, volume, loop = false) {
    if (!sound || !this.enabled) return null;

    try {
      if (sound.isLoaded() && sound.buffer) return new BufferPlayback(sound, volume, { loop });
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
  
  // Call from a user-gesture handler (touchend on iOS). Resumes a Web Audio context the browser
  // left suspended, and retries a background play() that was rejected for beating the gesture
  // (the stream still wants to play but sits paused). Never restarts music the game paused.
  unlockFromGesture() {
    try {
      const ctx = (typeof getAudioContext === 'function') ? getAudioContext() : null;
      if (ctx && ctx.state !== 'running' && ctx.resume) ctx.resume().catch(() => {});
    } catch (e) {}
    const bg = this.sounds.background;
    if (bg && bg._wantPlaying && bg.el && bg.el.paused && bg.isLoaded()) bg._start();
    // The streamed voice tracks' elements need the same one-off gesture play (see prime()).
    for (const bank of Object.values(this.sounds.speciesVoices)) {
      for (const track of Object.values(bank)) if (track && track.prime) track.prime();
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
  
  // Play tutorial tip sound (Te Whē, the mantis guide). Never stacked: while the last one is
  // still playing, a new tip stays quiet.
  playTutorialTip() {
    if (this._tipPlayback && this._tipPlayback.isPlaying()) return;
    if (!this._checkCooldown('tutorialTip')) return;
    this._tipPlayback = this._playSound(this.sounds.tutorialTip, this._getVolume() * 0.6);
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

  // A gust: a short snippet of the winter wind (picking up a storm).
  playWindGust() {
    if (!this._checkCooldown('plantRustle')) return;
    const sf = this.sounds.seasonChange.winter;
    if (!sf || !this.enabled || !sf.isLoaded() || !sf.buffer) return;
    try {
      const len = sf.buffer.duration || 0;
      new BufferPlayback(sf, this._getVolume() * 0.5,
        { offset: Math.random() * Math.max(0, len - 1.6), duration: 1.4, fadeIn: 0.15, fadeOut: 0.5 });
    } catch (e) { console.warn('Error playing wind gust:', e); }
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

  // A short one-shot snippet of a species' voice recording (e.g. the kea when it speaks in a
  // tutorial tip). Its fade-out and stop are scheduled on the audio clock, so it ends on
  // time even while the game is paused (the per-frame voice driver only runs in play).
  // Returns true if it played.
  playVoiceCue(voiceKey, seconds = 3) {
    const bank = this.sounds.speciesVoices[voiceKey];
    const vol = this._getVolume() * VOICE_VOLUME;
    if (!bank || this._muted || vol <= 0) return false;
    const stateName = this._voiceTargetState(voiceKey, null);
    const sf = stateName && bank[stateName];
    if (!this._voiceReady(sf)) return false;
    try {
      this._voicePlayback(sf, vol, { offset: this._randomCue(sf, seconds), fadeIn: 0.2,
                                     duration: seconds, fadeOut: 0.8 });
      return true;
    } catch (e) {
      console.warn('Voice cue failed:', e);
      return false;
    }
  }

  // A line of story dialogue opens on its speaker's own sound: 'moa' (the moa call; `rate`
  // pitches it, e.g. lower for the bigger mother), 'chick' (a cheep), 'eagle' (a hunt cry) or
  // 'kea' (a snippet of kea song) or 'gust' (the winter wind). Each new line cuts the last line's sound short, so clicking
  // through a scene never piles calls up. Returns false for a speaker with no sound of its own
  // (the tip then plays its usual chime).
  playSpeaker(kind, rate = 1) {
    if (!this.enabled || this._muted) return true;   // (silent: no chime instead)
    this._stopSpeaker();
    const vol = this._getVolume();
    if (vol <= 0) return false;
    const shot = (sf, v, opts) => (sf && sf.isLoaded() && sf.buffer) ? new BufferPlayback(sf, v, opts) : null;
    let pb = null;
    try {
      if (kind === 'moa') {
        pb = shot(this.sounds.moaMilestone, vol * 0.5, { rate, duration: 2.2, fadeOut: 0.5 });
      } else if (kind === 'chick') {
        pb = shot(this.sounds.mateCheep, vol * 0.55, { rate: 1.15 * rate, duration: 1.5, fadeOut: 0.3 });
      } else if (kind === 'eagle') {
        pb = shot(this._randomEagleCry(), vol * 0.4, { duration: 2.6, fadeOut: 0.7 });
      } else if (kind === 'gust') {
        // The winter wind, a longer snippet than the storm-pickup gust (playWindGust).
        const sf = this.sounds.seasonChange.winter;
        if (sf && sf.isLoaded() && sf.buffer) {
          const len = sf.buffer.duration || 0;
          pb = shot(sf, vol * 0.6, { offset: Math.random() * Math.max(0, len - 4.2), duration: 4, fadeIn: 0.4, fadeOut: 1.2 });
        }
      } else if (kind === 'kea') {
        const bank = this.sounds.speciesVoices.kea;
        const st = bank && this._voiceTargetState('kea', null);
        const sf = st && bank[st];
        if (this._voiceReady(sf)) {
          pb = this._voicePlayback(sf, vol * VOICE_VOLUME,
            { offset: this._randomCue(sf, 2), fadeIn: 0.1, duration: 2, fadeOut: 0.6 });
        }
      }
    } catch (e) {
      console.warn('Speaker sound failed:', e);
      pb = null;
    }
    this._speaker = pb;
    return !!pb;
  }

  // Cut the last dialogue line's sound short (a quick fade, not a click).
  _stopSpeaker() {
    const pb = this._speaker;
    this._speaker = null;
    if (!pb || !pb.isPlaying()) return;
    pb.setVolume(0, 0.08);
    setTimeout(() => pb.stop(), 120);
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

  // Start one state's recording from a random offset, fading up from silence. Returns the
  // playback handle (see BufferPlayback) or null if unavailable. Each start is its own
  // playback, so a crossfade back to a file still fading out simply overlaps it.
  _startVoiceState(bank, stateName, voiceVol, loop, needSec = 0) {
    const sound = stateName && bank[stateName];
    if (!this._voiceReady(sound)) return null;
    const cue = this._randomCue(sound, loop ? 0 : needSec);
    try {
      return this._voicePlayback(sound, voiceVol, { loop, offset: cue, fadeIn: VOICE_FADE_IN_SEC });
    } catch (e) {
      console.warn('Voice start failed:', e);
      return null;
    }
  }

  // A voice track that can start now: a streamed track once its length is known, or a decoded
  // SoundFile once its buffer exists.
  _voiceReady(sound) {
    return !!sound && sound.isLoaded() && (sound.isStreaming || !!sound.buffer);
  }

  // Start a voice track's playback (streamed or decoded); both take the same opts.
  _voicePlayback(sound, volume, opts) {
    return sound.isStreaming ? new StreamPlayback(sound, volume, opts)
                             : new BufferPlayback(sound, volume, opts);
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

  // ============================================
  // DIAGNOSTICS (perf HUD)
  // ============================================

  // Every decoded p5.SoundFile we hold (the streamed background and voice tracks are not).
  _allSoundFiles() {
    const out = [];
    const push = (s) => { if (s && s.bufferSourceNodes) out.push(s); };
    const s = this.sounds;
    [s.tutorialTip, s.boltStrike, s.mateCheep, s.moaMilestone,
     s.eagleHunt, s.eagleCatch, s.win, s.loss].forEach(push);
    s.plantRustle.forEach(push);
    Object.values(s.seasonChange).forEach(push);
    Object.values(s.speciesCalls).forEach(push);
    s.eagleHuntCries.forEach(push);
    for (const bank of Object.values(s.speciesVoices)) Object.values(bank).forEach(push);
    return out;
  }

  // Snapshot for the 'd' perf HUD. `nodes` is the live Web Audio source nodes: our own
  // playbacks (BufferPlayback, StreamPlayback) plus any left on p5's SoundFiles (none, now
  // nothing plays through p5) — the number that would climb and starve the audio thread if
  // 'ended' cleanup couldn't keep up. `ctxState` should read 'running'; if it flips to 'suspended'/
  // 'interrupted' when audio dies, that's the browser dropping the context (a resume() would
  // revive it). `voices`/`fading` track the extended-voice loops.
  getDiagnostics() {
    let nodes = BufferPlayback.live + StreamPlayback.live;
    for (const sf of this._allSoundFiles()) {
      nodes += (sf.bufferSourceNodes && sf.bufferSourceNodes.length) || 0;
    }
    let ctxState = 'n/a';
    try {
      if (typeof getAudioContext === 'function') ctxState = getAudioContext().state;
    } catch (e) {}
    let active = 0;
    for (const k in this._voices) if (this._voices[k] && this._voices[k].active) active++;
    return { nodes, ctxState, voices: active, fading: this._fadingVoices.length };
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