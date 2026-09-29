// ============================================================
// MAURI; local static server
//   node tools/serve.js        then open http://127.0.0.1:8081
//   node tools/serve.js 8091 dist   serves the release build instead
//
// Serves the project folder (or a subfolder of it) so p5's asset loading
// works (file:// is blocked by Chrome's CORS policy). No dependencies, no caching.
// ============================================================

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', process.argv[3] || '.');
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
    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes'
    };
    // Byte ranges + a length, as a real host sends, so streamed <audio> (the species voice
    // tracks) knows its duration and can seek.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const size = data.length;
      const start = range[1] === '' ? Math.max(0, size - Number(range[2])) : Number(range[1]);
      const end = (range[1] !== '' && range[2] !== '') ? Math.min(Number(range[2]), size - 1) : size - 1;
      if (start >= size || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        return res.end();
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      return res.end(data.subarray(start, end + 1));
    }
    headers['Content-Length'] = data.length;
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Mauri serving ${ROOT}`);
  console.log(`  http://127.0.0.1:${PORT}`);
  console.log('  ctrl-c to stop');
});
