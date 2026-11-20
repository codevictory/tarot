'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const {
  fetchAllCardsFromKlapi,
  loginToKlapi,
  fetchAdminCardsFromKlapi,
  updateAdminCardTextsInKlapi,
} = require('./lib/klapiClient');

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

// ---- Admin portal (/admin) ----
// The admin page is a static file (public/admin.html). Its API calls are
// proxied here to the klapi API with the portal user's Bearer token, so the
// browser never talks to the klapi host directly (CORS) and the site-to-site
// API key never leaves this server.
const ADMIN_PAGE = '/admin.html';
const ADMIN_TEXT_UPDATE_RE = /^\/admin\/api\/cards\/([^/]+)\/texts$/;
const MAX_BODY_BYTES = 1_000_000;

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(JSON.stringify(payload));
}

function getBearerToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec((req.headers.authorization || '').trim());
  return match ? match[1].trim() : null;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON body.'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

async function handleAdminApi(req, res, pathname) {
  if (pathname === '/admin/api/login' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const username = typeof body?.username === 'string' ? body.username.trim() : '';
      const password = typeof body?.password === 'string' ? body.password : '';
      if (!username || !password) {
        sendJson(res, 400, { message: 'Username and password are required.' });
        return;
      }
      const result = await loginToKlapi(username, password);
      sendJson(res, result.ok ? 200 : result.status, result.body ?? { message: 'Login failed.' });
    } catch (err) {
      sendJson(res, err.statusCode || 502, { message: err.message || 'Login request failed.' });
    }
    return true;
  }

  if (pathname === '/admin/api/cards' && req.method === 'GET') {
    const token = getBearerToken(req);
    if (!token) {
      sendJson(res, 401, { message: 'Missing bearer token.' });
      return true;
    }
    try {
      const cards = await fetchAdminCardsFromKlapi(token);
      sendJson(res, 200, cards);
    } catch (err) {
      sendJson(res, err.status || 502, { message: err.message });
    }
    return true;
  }

  const textMatch = req.method === 'PUT' ? ADMIN_TEXT_UPDATE_RE.exec(pathname) : null;
  if (textMatch) {
    const token = getBearerToken(req);
    if (!token) {
      sendJson(res, 401, { message: 'Missing bearer token.' });
      return true;
    }
    // pathname was already decodeURIComponent'd above, so the capture is final.
    const cardId = textMatch[1];
    try {
      const body = await readJsonBody(req);
      const texts = {
        englishTitle: typeof body?.englishTitle === 'string' ? body.englishTitle : '',
        englishDescription: typeof body?.englishDescription === 'string' ? body.englishDescription : '',
        finnishTitle: typeof body?.finnishTitle === 'string' ? body.finnishTitle : '',
        finnishDescription: typeof body?.finnishDescription === 'string' ? body.finnishDescription : '',
      };
      const updated = await updateAdminCardTextsInKlapi(token, cardId, texts);
      sendJson(res, 200, updated);
    } catch (err) {
      sendJson(res, err.status || err.statusCode || 502, { message: err.message });
    }
    return true;
  }

  return false;
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

  // Admin portal: the page is reached only by typing /admin manually.
  if (pathname === '/admin' || pathname === '/admin/') {
    pathname = ADMIN_PAGE;
  } else if (pathname.startsWith('/admin/api/')) {
    await handleAdminApi(req, res, pathname);
    if (res.writableEnded) return;
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
