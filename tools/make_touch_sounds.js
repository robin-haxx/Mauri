// ============================================================
// MAURI; cuts the "touch" sounds (the player's own interactions) into audio/
//   node tools/make_touch_sounds.js <impact-sounds dir> <rpg-audio dir>
//
// The two directories are the unzipped Kenney packs (both CC0; see CREDITS.md):
//   Impact Sounds  https://kenney.nl/assets/impact-sounds   (its Audio/ folder)
//   RPG Audio      https://kenney.nl/assets/rpg-audio       (its Audio/ folder)
// Needs ffmpeg on the PATH (to decode the packs' .ogg files).
//
// Each output is a short mono 16-bit WAV: lead-in silence trimmed so the hit lands on the
// press, the tail faded so it never clicks, and the level evened out within a group. WAV, not
// MP3: these are a tenth of a second long, and an MP3's encoder padding would delay the hit.
// The two water sounds are not recordings: they are synthesised here (a bubble's rising tone).
// ============================================================

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RATE = 44100;
const OUT = path.resolve(__dirname, '..', 'audio');
const [impactDir, rpgDir] = process.argv.slice(2);
if (!impactDir || !rpgDir) {
  console.error('usage: node tools/make_touch_sounds.js <impact-sounds dir> <rpg-audio dir>');
  process.exit(1);
}
const SRC = { impact: path.resolve(impactDir), rpg: path.resolve(rpgDir) };

// out file -> { from: [pack, file], peak, max (longest body kept, s), fade (tail fade, s) }
// or a `mix`: several hits laid over each other at offsets (s), each with a gain and a speed.
const RECIPES = {
  // A fingertip on a dry branch: every plain button.
  'touch_wood_1.wav': { from: ['impact', 'impactWood_light_000.ogg'], peak: 0.8 },
  'touch_wood_2.wav': { from: ['impact', 'impactWood_light_002.ogg'], peak: 0.8 },
  'touch_wood_3.wav': { from: ['impact', 'impactWood_light_004.ogg'], peak: 0.8 },
  // A knuckle on a hollow log: the buttons that begin something.
  'touch_knock_1.wav': { from: ['impact', 'impactWood_medium_000.ogg'], peak: 0.8 },
  'touch_knock_2.wav': { from: ['impact', 'impactWood_medium_003.ogg'], peak: 0.8 },
  // A dull, dead knock: "that can't be done".
  'touch_thud_1.wav': { from: ['impact', 'impactWood_heavy_001.ogg'], peak: 0.8 },
  'touch_thud_2.wav': { from: ['impact', 'impactWood_heavy_004.ogg'], peak: 0.8 },
  // Two pebbles touching: the small switches.
  'touch_stone_1.wav': { from: ['impact', 'impactGeneric_light_001.ogg'], peak: 0.7 },
  'touch_stone_2.wav': { from: ['impact', 'impactGeneric_light_004.ogg'], peak: 0.7 },
  // A hand patting soil down: planting, setting something on the ground.
  'touch_soil_1.wav': { from: ['impact', 'impactSoft_heavy_000.ogg'], peak: 0.8 },
  'touch_soil_2.wav': { from: ['impact', 'impactSoft_heavy_002.ogg'], peak: 0.8 },
  'touch_soil_3.wav': { from: ['impact', 'impactSoft_heavy_003.ogg'], peak: 0.8 },
  // A hand through grass and leaves: taking up a plant.
  'touch_leaf_1.wav': { from: ['impact', 'footstep_grass_001.ogg'], peak: 0.7, max: 0.45, fade: 0.12 },
  'touch_leaf_2.wav': { from: ['impact', 'footstep_grass_002.ogg'], peak: 0.7, max: 0.45, fade: 0.12 },
  'touch_leaf_3.wav': { from: ['impact', 'footstep_grass_004.ogg'], peak: 0.7, max: 0.45, fade: 0.12 },
  // Dry litter and twigs giving way: the nest.
  'touch_twig_1.wav': { from: ['impact', 'footstep_snow_000.ogg'], peak: 0.75 },
  'touch_twig_2.wav': { from: ['impact', 'footstep_snow_003.ogg'], peak: 0.75 },
  // A wing shaken out: choosing an animal, the kea sent off.
  'touch_feather_1.wav': { from: ['rpg', 'cloth1.ogg'], peak: 0.7, fade: 0.1 },
  'touch_feather_2.wav': { from: ['rpg', 'cloth2.ogg'], peak: 0.7, fade: 0.1 },
  'touch_feather_3.wav': { from: ['rpg', 'cloth3.ogg'], peak: 0.7, fade: 0.1 },
  // The field guide's own pages.
  'touch_page_1.wav': { from: ['rpg', 'bookFlip2.ogg'], peak: 0.6, fade: 0.08 },
  'touch_page_2.wav': { from: ['rpg', 'bookFlip3.ogg'], peak: 0.6, fade: 0.06 },
  'touch_guide_open.wav': { from: ['rpg', 'bookOpen.ogg'], peak: 0.6, fade: 0.05 },
  'touch_guide_close.wav': { from: ['rpg', 'bookClose.ogg'], peak: 0.7, fade: 0.05 },
  // A bough leaning: the view changing.
  'touch_creak_1.wav': { from: ['rpg', 'creak3.ogg'], peak: 0.6, fade: 0.08 },
  // Seeds and berries spilling: a handful of small hits, each a little later, softer, higher.
  'touch_seeds_1.wav': { peak: 0.7, mix: [
    { from: ['impact', 'impactGeneric_light_000.ogg'], at: 0.000, gain: 1.00, speed: 1.30 },
    { from: ['impact', 'impactGeneric_light_003.ogg'], at: 0.055, gain: 0.70, speed: 1.55 },
    { from: ['impact', 'impactGeneric_light_002.ogg'], at: 0.095, gain: 0.80, speed: 1.20 },
    { from: ['impact', 'impactGeneric_light_004.ogg'], at: 0.150, gain: 0.50, speed: 1.70 },
    { from: ['impact', 'impactGeneric_light_001.ogg'], at: 0.215, gain: 0.35, speed: 1.45 } ] },
  'touch_seeds_2.wav': { peak: 0.7, mix: [
    { from: ['impact', 'impactGeneric_light_002.ogg'], at: 0.000, gain: 0.90, speed: 1.45 },
    { from: ['impact', 'impactGeneric_light_001.ogg'], at: 0.040, gain: 1.00, speed: 1.25 },
    { from: ['impact', 'impactGeneric_light_004.ogg'], at: 0.105, gain: 0.60, speed: 1.60 },
    { from: ['impact', 'impactGeneric_light_000.ogg'], at: 0.135, gain: 0.70, speed: 1.35 },
    { from: ['impact', 'impactGeneric_light_003.ogg'], at: 0.200, gain: 0.40, speed: 1.75 },
    { from: ['impact', 'impactGeneric_light_002.ogg'], at: 0.270, gain: 0.25, speed: 1.50 } ] }
};

// ---- decoding and shaping ---------------------------------------------------------------

function decode(pack, file) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(SRC[pack], file),
    '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'], { maxBuffer: 1 << 28 });
  const x = new Float32Array(raw.length >> 1);
  for (let i = 0; i < x.length; i++) x[i] = raw.readInt16LE(i * 2) / 32768;
  return x;
}

const peakOf = (x) => { let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i])); return p; };

// Cut the silence before the hit (keeping a millisecond of run-up) and after its tail.
function trim(x) {
  const p = peakOf(x);
  let a = 0; while (a < x.length && Math.abs(x[a]) < p * 0.02) a++;
  let b = x.length - 1; while (b > a && Math.abs(x[b]) < p * 0.004) b--;
  a = Math.max(0, a - Math.round(RATE * 0.001));
  return x.subarray(a, Math.min(x.length, b + Math.round(RATE * 0.01)));
}

function resample(x, speed) {   // (linear: these are short, soft-edged hits)
  const n = Math.floor(x.length / speed), y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i * speed, k = Math.floor(t), f = t - k;
    y[i] = x[k] * (1 - f) + (x[k + 1] || 0) * f;
  }
  return y;
}

function shape(x, { peak = 0.8, max = 0, fade = 0.03 }) {
  if (max > 0) x = x.subarray(0, Math.min(x.length, Math.round(max * RATE)));
  const y = Float32Array.from(x);
  const g = peak / (peakOf(y) || 1), nf = Math.min(y.length, Math.round(fade * RATE));
  const n0 = Math.min(y.length, Math.round(RATE * 0.0008));        // (no click going in either)
  for (let i = 0; i < y.length; i++) y[i] *= g;
  for (let i = 0; i < n0; i++) y[i] *= i / n0;
  for (let i = 0; i < nf; i++) y[y.length - 1 - i] *= i / nf;
  return y;
}

function writeWav(file, x) {
  const buf = Buffer.alloc(44 + x.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + x.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log(file.padEnd(24), (x.length / RATE).toFixed(2) + ' s', (buf.length / 1024).toFixed(0) + ' KB');
}

// ---- the water: a drop going in ---------------------------------------------------------
// A bubble under water rings at a pitch that climbs as it rises and dies away fast; a drop is
// one or two of them after a breath of splash. bubbles: [start s, Hz, climb (x over its life),
// decay s, level].
function water(bubbles, seed) {
  const n = Math.round(RATE * 0.34), y = new Float32Array(n);
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  let lp = 0;
  for (let i = 0; i < Math.round(RATE * 0.03); i++) {              // the splash: soft noise
    lp += (rnd() - lp) * 0.25;
    y[i] += lp * 0.35 * Math.exp(-i / (RATE * 0.008));
  }
  for (const [t0, hz, climb, decay, level] of bubbles) {
    let phase = 0;
    const i0 = Math.round(t0 * RATE);
    for (let i = i0; i < n; i++) {
      const t = (i - i0) / RATE;
      phase += 2 * Math.PI * hz * (1 + (climb - 1) * Math.min(1, t / (decay * 3))) / RATE;
      y[i] += Math.sin(phase) * level * Math.exp(-t / decay) * Math.min(1, t / 0.002);
    }
  }
  return y;
}

// ---- run --------------------------------------------------------------------------------

for (const [file, r] of Object.entries(RECIPES)) {
  let x;
  if (r.mix) {
    const parts = r.mix.map(m => ({ m, x: resample(trim(decode(...m.from)), m.speed) }));
    const n = Math.max(...parts.map(p => Math.round(p.m.at * RATE) + p.x.length));
    x = new Float32Array(n);
    for (const p of parts) {
      const g = p.m.gain / (peakOf(p.x) || 1), o = Math.round(p.m.at * RATE);
      for (let i = 0; i < p.x.length; i++) x[o + i] += p.x[i] * g;
    }
  } else {
    x = trim(decode(...r.from));
  }
  writeWav(file, shape(x, r));
}
writeWav('touch_water_1.wav', shape(water([[0.004, 520, 1.9, 0.030, 1.0], [0.075, 800, 1.6, 0.026, 0.5]], 7), { peak: 0.7, fade: 0.05 }));
writeWav('touch_water_2.wav', shape(water([[0.004, 440, 2.1, 0.034, 1.0], [0.060, 690, 1.5, 0.022, 0.4], [0.120, 980, 1.4, 0.020, 0.25]], 23), { peak: 0.7, fade: 0.05 }));
