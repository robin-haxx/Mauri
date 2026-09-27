// ============================================
// AUDIO CONTEXT PIN (must load BEFORE p5.sound.min.js)
// p5.sound builds its one AudioContext the moment it loads (new window.AudioContext()), with
// the browser defaults: the output device's sample rate and interactive (smallest) latency.
// On real machines both hurt:
//   · decodeAudioData resamples every file to the context rate, so a 176.4/192 kHz device
//     holds 4× the decoded PCM of a 44.1 kHz one (the voice tracks alone ran to ~1.3 GB);
//   · the smallest render buffer leaves no headroom, so a busy main thread or a GC pause
//     starves the audio thread and the sound drops out on low-end machines.
// Wrap the constructor so a context made without options defaults to 44.1 kHz (the rate most
// of our files are encoded at) and the 'playback' latency hint (bigger buffers: ~20 ms instead
// of ~10 ms, inaudible for game audio). Explicit options still win, and a browser that
// rejects them gets a plain context instead.
// ============================================
(function pinAudioContext() {
  const Native = window.AudioContext;
  if (typeof Native !== 'function') return;   // webkit-only (old Safari): leave p5's fallback be
  const DEFAULTS = { sampleRate: 44100, latencyHint: 'playback' };
  function PinnedAudioContext(options) {
    try { return new Native(Object.assign({}, DEFAULTS, options)); }
    catch (e) { return new Native(options); }
  }
  PinnedAudioContext.prototype = Native.prototype;   // `instanceof AudioContext` still holds
  window.AudioContext = PinnedAudioContext;
})();
