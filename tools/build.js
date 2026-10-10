// ============================================================
// MAURI; release build (itch.io or any static host)
//   npm run build         -> dist/  (bundled + minified, runtime files only)
//   npm run build:safe    -> same, but top-level names are left un-renamed
//   npm run serve:dist    then open http://127.0.0.1:8091 to play the build
//
// index.html stays the source of truth: its <script> order is read, and each
// run of adjacent game scripts is concatenated (in that order) into one
// minified file. By default each run is wrapped in a single private scope so
// terser can rename top-level classes, functions and consts too; p5's hooks
// (setup, draw, mousePressed, ...) are re-exported onto window, because p5
// global mode finds them there by name. --safe skips the wrapper: the files
// then behave exactly like separate <script> tags (only locals are renamed).
//
// Libraries are never merged into the game bundle: p5.js is minified on its
// own (licence banner kept; p5 is LGPL) and *.min.js files are copied as-is.
// Only runtime asset types are copied from ASSET_DIRS, so source art (.kra,
// .pxo), design docs, tests and tools never reach dist/.
// ============================================================

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { minify } = require('terser');

const ROOT  = path.resolve(__dirname, '..');
const DIST  = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, 'node_modules', '.cache', 'mauri-build');
const SAFE  = process.argv.includes('--safe');

// Library scripts minified here (source -> output) instead of bundled. Any other
// *.min.js script is copied untouched.
const MINIFY_LIBS = { 'p5.js': 'p5.min.js' };

const ASSET_DIRS = ['sprites', 'audio', 'typefaces'];
const ASSET_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif',
                            '.mp3', '.ogg', '.wav', '.m4a',
                            '.ttf', '.otf', '.woff', '.woff2']);
const ASSET_SKIP = /\(Copy \d+\)/;   // editor duplicates, e.g. "moa_walk_4 (Copy 1).png"

// Functions p5 global mode looks up on window by name.
const P5_HOOKS = new Set([
  'preload', 'setup', 'draw', 'windowResized',
  'keyPressed', 'keyReleased', 'keyTyped',
  'mouseMoved', 'mouseDragged', 'mousePressed', 'mouseReleased', 'mouseClicked',
  'doubleClicked', 'mouseWheel', 'touchStarted', 'touchMoved', 'touchEnded',
  'deviceMoved', 'deviceTurned', 'deviceShaken'
]);

// Game code: console.log/info/debug are dropped (chatty, and they narrate internals);
// warn/error stay so a player's bug report still has something in it. Their arguments
// are dropped too, so never do real work inside a console.log(...).
const GAME_TERSER = {
  ecma: 2020,
  compress: { passes: 2, drop_console: ['log', 'info', 'debug'] },
  mangle: true,
  format: { comments: false }
};

const read  = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const size  = (n) => (n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB');
const isLib = (src) => src in MINIFY_LIBS || src.endsWith('.min.js');
const isGlobalDecl = (type) => type === 'SymbolDefun' || type === 'SymbolVar';   // lands on window when unbundled

function write(rel, data) {
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, data);
}

function copy(rel) {
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(path.join(ROOT, rel), out);
}

function fail(msg) {
  console.error('\nBUILD FAILED\n  ' + msg);
  process.exit(1);
}

// index.html with its comments removed (they narrate the architecture, and a
// commented-out <script> must not be picked up), plus its <script> tags in order.
function readPage() {
  const page = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
  const tags = [...page.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)]
    .map(m => ({ src: m[1], start: m.index, end: m.index + m[0].length }));
  if ((page.match(/<script\b/g) || []).length !== tags.length) {
    fail('index.html has a <script> this build does not understand (inline, or with extra ' +
         'attributes). Only <script src="..."></script> is supported.');
  }
  return { page, tags };
}

// Runs of game scripts separated by nothing but whitespace; each run becomes one bundle,
// written where its first script stood. A library (or any markup) between two game
// scripts starts a new run, so execution order around it is kept.
function groupChunks(page, tags) {
  const chunks = [];
  let prev = null;
  for (const t of tags) {
    if (isLib(t.src)) { prev = null; continue; }
    if (prev && page.slice(prev.end, t.start).trim() === '') chunks[chunks.length - 1].tags.push(t);
    else chunks.push({ tags: [t] });
    prev = t;
  }
  chunks.forEach((c, i) => {
    c.out = chunks.length === 1 ? 'mauri.min.js' : `mauri.${i + 1}.min.js`;
    c.files = {};
    for (const t of c.tags) c.files[t.src] = read(t.src);
  });
  return chunks;
}

// A chunk's top-level declarations (name -> terser symbol type) and its free names,
// using terser's own parser and scope analysis.
async function analyse(files) {
  const { ast } = await minify(files, { compress: false, mangle: false, format: { ast: true, code: false } });
  ast.figure_out_scope();
  const declared = new Map();
  for (const [name, def] of ast.variables) declared.set(name, def.orig[0].TYPE);
  return { declared, free: new Set(ast.globals.keys()) };
}

// Names p5 global mode binds onto window, read from p5.js itself: prototype members,
// _setProperty() variables (width, mouseX, ...) and the ALL-CAPS constants.
function p5GlobalNames() {
  const src = read('p5.js');
  const names = new Set();
  for (const m of src.matchAll(/(?:_main\.default|\bp5)\.prototype\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
  for (const m of src.matchAll(/_setProperty\(\s*['"]([A-Za-z_$][\w$]*)['"]/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bexports\.([A-Z][A-Z0-9_]*)\s*=/g)) names.add(m[1]);
  return names;
}

// Wrapping a chunk in its own scope is only safe if nothing outside it needs its
// top-level names: p5 (hooks aside) and the other chunks.
function checkWrappable(chunks) {
  const p5Names = p5GlobalNames();
  const problems = [];
  for (const c of chunks) {
    for (const [name, type] of c.info.declared) {
      if (isGlobalDecl(type) && p5Names.has(name) && !P5_HOOKS.has(name)) {
        problems.push(`'${name}' is a top-level function/var that p5 also defines: unbundled, p5 ` +
                      `overwrites it on window; wrapped, the game's own would win. Rename it.`);
      }
      for (const other of chunks) {
        if (other !== c && other.info.free.has(name)) {
          problems.push(`'${name}' is declared in ${c.tags.map(t => t.src).join(', ')} but also used ` +
                        `by ${other.tags.map(t => t.src).join(', ')}; wrapping would hide it.`);
        }
      }
    }
  }
  if (problems.length) fail(problems.join('\n  ') + '\n  (or run `npm run build:safe`)');
}

async function buildChunk(c) {
  const files = Object.assign({}, c.files);
  const opts = Object.assign({}, GAME_TERSER);
  if (!SAFE) {
    const hooks = [...c.info.declared].filter(([n, type]) => P5_HOOKS.has(n) && isGlobalDecl(type)).map(([n]) => n);
    if (hooks.length) files['(p5 hooks)'] = hooks.map(h => `window.${h} = ${h};`).join('\n');
    opts.enclose = true;
  }
  const { code } = await minify(files, opts);
  write(c.out, code);
  const srcBytes = Object.values(c.files).reduce((n, s) => n + Buffer.byteLength(s), 0);
  return `${c.out.padEnd(18)} ${size(Buffer.byteLength(code)).padStart(9)}  from ${c.tags.length} file(s), ${size(srcBytes)}`;
}

// p5.js is minified once per (p5 source, terser version) and cached: it's 5 MB.
async function buildLib(src) {
  const out = MINIFY_LIBS[src];
  if (!out) { copy(src); return { out: src, line: `${src.padEnd(18)} ${size(fs.statSync(path.join(ROOT, src)).size).padStart(9)}  copied` }; }
  const code = read(src);
  const key = crypto.createHash('sha1').update(code).update(require('terser/package.json').version).digest('hex').slice(0, 12);
  const cached = path.join(CACHE, `${path.basename(out, '.js')}.${key}.js`);
  let note = 'cached';
  if (!fs.existsSync(cached)) {
    const r = await minify(code, { compress: true, mangle: true, format: { comments: 'some' } });
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(cached, r.code);
    note = 'minified';
  }
  fs.mkdirSync(path.dirname(path.join(DIST, out)), { recursive: true });
  fs.copyFileSync(cached, path.join(DIST, out));
  return { out, line: `${out.padEnd(18)} ${size(fs.statSync(cached).size).padStart(9)}  ${note}, from ${size(Buffer.byteLength(code))}` };
}

function writePage(page, tags, chunks, libOut) {
  const firstOf = new Map(chunks.map(c => [c.tags[0], c]));
  let html = '';
  let at = 0;
  for (const t of tags) {
    html += page.slice(at, t.start);
    if (isLib(t.src)) html += `<script src="${libOut.get(t.src)}"></script>`;
    else if (firstOf.has(t)) html += `<script src="${firstOf.get(t).out}"></script>`;
    at = t.end;
  }
  html += page.slice(at);
  write('index.html', html.split(/\r?\n/).map(l => l.trim()).filter(Boolean).join('\n') + '\n');
}

// Local stylesheets (and any other <link href>) referenced by the page; CSS loses its comments.
function copyLinked(page) {
  for (const m of page.matchAll(/<link\b[^>]*\bhref="([^"]+)"/g)) {
    const href = m[1];
    if (/^([a-z]+:)?\/\//i.test(href) || href.startsWith('data:')) continue;
    if (!href.endsWith('.css')) { copy(href); continue; }
    write(href, read(href).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
      .replace(/\s*([{};,])\s*/g, '$1').trim() + '\n');
  }
}

function copyAssets() {
  let count = 0, bytes = 0;
  const skipped = [];
  const walk = (rel) => {
    for (const ent of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
      const r = rel + '/' + ent.name;
      if (ent.isDirectory()) { walk(r); continue; }
      if (!ASSET_EXTS.has(path.extname(ent.name).toLowerCase()) || ASSET_SKIP.test(ent.name)) {
        skipped.push(r);
        continue;
      }
      copy(r);
      count++;
      bytes += fs.statSync(path.join(ROOT, r)).size;
    }
  };
  for (const d of ASSET_DIRS) if (fs.existsSync(path.join(ROOT, d))) walk(d);
  return { count, bytes, skipped };
}

function dirBytes(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, ent) => {
    const p = path.join(dir, ent.name);
    return n + (ent.isDirectory() ? dirBytes(p) : fs.statSync(p).size);
  }, 0);
}

(async () => {
  const t0 = Date.now();
  const { page, tags } = readPage();
  const chunks = groupChunks(page, tags);
  for (const c of chunks) c.info = await analyse(c.files);
  if (!SAFE) checkWrappable(chunks);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST);

  const lines = [];
  const libOut = new Map();
  for (const t of tags.filter(t => isLib(t.src))) {
    const { out, line } = await buildLib(t.src);
    libOut.set(t.src, out);
    lines.push(line);
  }
  for (const c of chunks) lines.push(await buildChunk(c));
  writePage(page, tags, chunks, libOut);
  copyLinked(page);
  const assets = copyAssets();

  console.log(`\ndist/ built in ${((Date.now() - t0) / 1000).toFixed(1)}s ` +
              `(${SAFE ? 'safe: top-level names kept' : 'scope-wrapped: top-level names renamed'})\n`);
  for (const l of lines) console.log('  ' + l);
  console.log(`  ${'assets'.padEnd(18)} ${size(assets.bytes).padStart(9)}  ${assets.count} files from ${ASSET_DIRS.join('/, ')}/`);
  if (assets.skipped.length) console.log(`\n  not shipped (not a runtime asset type):\n    ${assets.skipped.join('\n    ')}`);
  console.log(`\n  total ${size(dirBytes(DIST))}\n`);
})().catch(e => fail(e.filename ? `${e.filename}:${e.line}:${e.col} ${e.message}` : (e.stack || String(e))));
