'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchAllCardsFromKlapi } = require('./lib/klapiClient');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Card texts are hosted by the klapi API and are always fetched from there
// ALL AT ONCE (one bulk GET /tarot/cards call), never card by card, and never
// from a local file. The bulk result is cached for this long; after that a
// single fresh bulk call is made.
// Env: KLAPI_BASE_URL, KLAPI_SITE_API_KEY (see lib/klapiClient.js),
// TAROT_CARDS_CACHE_TTL_MS (default 60000).
const CARDS_CACHE_TTL_MS = Number(process.env.TAROT_CARDS_CACHE_TTL_MS || 60_000);

let cardsCache = null;
let cardsCacheAt = 0;

async function getCards() {
  const now = Date.now();
  if (cardsCache && now - cardsCacheAt < CARDS_CACHE_TTL_MS) {
    return cardsCache;
  }
  const cards = await fetchAllCardsFromKlapi();
  cardsCache = cards;
  cardsCacheAt = now;
  return cards;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/cards') {
    try {
      const cards = await getCards();
      res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-cache' });
      res.end(JSON.stringify(cards));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'cards data unavailable' }));
    }
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + pathname);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };

    // Code assets (html/js/css) must always revalidate against the server so
    // edits show up on the next load; without this the browser keeps serving
    // a stale cached app.js/style.css while index.html is fetched fresh.
    // Images and other static files can stay browser-cached.
    if (ext === '.html' || ext === '.js' || ext === '.css') {
      const etag = `"${fs.statSync(filePath).mtimeMs.toFixed(0)}-${data.length}"`;
      headers['Cache-Control'] = 'no-cache';
      headers['ETag'] = etag;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, { 'Cache-Control': headers['Cache-Control'], 'ETag': etag });
        res.end();
        return;
      }
    } else {
      headers['Cache-Control'] = 'public, max-age=3600';
    }

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Tarot gallery running at http://localhost:${PORT}`);
  getCards()
    .then((cards) => console.log(`Loaded ${cards.length} cards from klapi`))
    .catch((err) => console.warn(`Initial klapi card load failed: ${err.message}`));
});
