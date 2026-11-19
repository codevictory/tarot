'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { fetchAllCardsFromKlapi } = require('./lib/klapiClient');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CARDS_JSON = path.join(__dirname, 'data', 'cards.json');

// Card descriptions are hosted by the klapi API and are always fetched from
// there ALL AT ONCE (one bulk GET /tarot/cards call), never card by card.
// The bulk result is cached for this long; after that a single fresh bulk
// call is made. If klapi is unreachable, the local data/cards.json is used
// as a fallback so the gallery keeps working.
// Env: KLAPI_BASE_URL, KLAPI_SERVICE_USERNAME, KLAPI_SERVICE_PASSWORD (see
// lib/klapiClient.js), TAROT_CARDS_CACHE_TTL_MS (default 60000).
const CARDS_CACHE_TTL_MS = Number(process.env.TAROT_CARDS_CACHE_TTL_MS || 60_000);

let cardsCache = null;
let cardsCacheAt = 0;

function loadLocalCards() {
  return JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8'));
}

function mergeCards(localCards, remoteCards) {
  if (!Array.isArray(remoteCards) || remoteCards.length === 0) return localCards;
  const remoteById = new Map(remoteCards.map((card) => [card.id, card]));
  const localIds = new Set(localCards.map((card) => card.id));
  const merged = localCards.map((card) =>
    remoteById.has(card.id) ? { ...card, ...remoteById.get(card.id) } : card
  );
  for (const remote of remoteCards) {
    if (!localIds.has(remote.id)) merged.push(remote);
  }
  return merged;
}

async function getCards() {
  const now = Date.now();
  if (cardsCache && now - cardsCacheAt < CARDS_CACHE_TTL_MS) {
    return cardsCache;
  }

  const localCards = loadLocalCards();

  try {
    const remoteCards = await fetchAllCardsFromKlapi();
    cardsCache = mergeCards(localCards, remoteCards);
    cardsCacheAt = now;
    return cardsCache;
  } catch (err) {
    console.warn(`[klapi] bulk fetch failed (${err.message}); serving local cards.json`);
    if (cardsCache) return cardsCache;
    cardsCache = localCards;
    cardsCacheAt = now;
    return localCards;
  }
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
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Tarot gallery running at http://localhost:${PORT}`);
  getCards()
    .then((cards) => console.log(`Loaded ${cards.length} cards (klapi bulk fetch or local fallback)`))
    .catch((err) => console.warn(`Initial card load failed: ${err.message}`));
});
