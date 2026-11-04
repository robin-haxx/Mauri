// ============================================================================
// HEADLESS HARNESS (shared by tools/validate.js and tools/batch.js)
// ============================================================================
// Serves the project folder, opens the game in a headless Chromium through Playwright, and
// hands the page to a callback. The game is the unbundled source (index.html), which is what
// the tools' console calls rely on (the release build renames top-level names).
//
// Needs Playwright with Chromium:  npm i -D playwright && npx playwright install chromium
// (In an environment with Playwright preinstalled, require('playwright') just works.)
// ============================================================================
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');

function loadPlaywright() {
  try { return require('playwright'); }
  catch (e) {
    console.error('Playwright is not installed. Run:  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}

// Start tools/serve.js on `port` (a free one is picked when 0) and resolve once it answers.
function serve(port) {
  return new Promise((resolve, reject) => {
    const p = port || (8100 + Math.floor(Math.random() * 800));
    const child = spawn(process.execPath, [path.join(ROOT, 'tools', 'serve.js'), String(p)], { stdio: 'ignore' });
    let tries = 0;
    const ping = () => {
      http.get({ host: 'localhost', port: p, path: '/index.html' }, (res) => { res.resume(); resolve({ port: p, child }); })
        .on('error', () => { if (++tries > 50) { child.kill(); reject(new Error('serve.js did not start')); } else setTimeout(ping, 200); });
    };
    setTimeout(ping, 200);
  });
}

// Parse "--name value" and "--flag" arguments into an object.
function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) out[k] = true; else { out[k] = v; i++; }
    } else out._.push(a);
  }
  return out;
}

// Open the game at `query` (e.g. "?render=2d&level=x") and wait until `ready(page)` holds.
// Returns { browser, page, errors (page errors and console errors so far), close() }.
async function openGame(port, query, { timeout = 180000 } = {}) {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('page error: ' + e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/Failed to load resource/.test(t)) errors.push('console error: ' + t);
    if (/\[chapters\]|\[url\]|\[module\]/.test(t)) errors.push(m.type() + ': ' + t);
  });
  await page.goto(`http://localhost:${port}/index.html${query || '?render=2d'}`, { waitUntil: 'load', timeout });
  await page.waitForFunction(() => typeof game !== 'undefined' && game && typeof LEVEL_REGISTRY !== 'undefined' &&
    typeof GAME_STATE !== 'undefined', null, { timeout });
  return { browser, page, errors, close: () => browser.close() };
}

module.exports = { ROOT, serve, args, openGame, loadPlaywright };
