// ============================================================
// MAURI — local static server
// ------------------------------------------------------------
//   node tools/serve.js        then open http://127.0.0.1:8081
//
// Opening index.html directly as file:// does not work: Chrome's CORS
// policy blocks p5's loadImage/loadFont/loadSound from a file origin,
// so the sprites, fonts and audio all fail silently and you get a black
// screen. Serve the folder instead.
//
// No dependencies, no network access, no caching (so a reload always
// picks up edits).
// ============================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8081;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';

  const file = path.join(ROOT, rel);
  // Never serve outside the project directory.
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }

  fs.readFile(file, (err, data) => {
    if (err) {
      console.log('404', rel);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found: ' + rel);
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Mauri serving ${ROOT}`);
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log('  ctrl-c to stop');
});
