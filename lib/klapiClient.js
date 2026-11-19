'use strict';

// Server-to-server client for the klapi API (.NET 10).
//
// Site-to-site authentication: every klapi call sends the shared API key in
// the X-API-Key header. The key never appears in code — set it via env:
//   KLAPI_BASE_URL       e.g. http://localhost:5013 (dev) or https://klapi.tietokonepaja.fi (prod)
//   KLAPI_SITE_API_KEY   must match Auth:SiteToSite:ApiKey on the klapi host
//                      (env var KLAPI_SITE_API_KEY there; in production the API
//                      runs behind HTTPS, so the key never travels in plaintext)

const KLAPI_BASE_URL = (process.env.KLAPI_BASE_URL || 'http://localhost:5013').replace(/\/+$/, '');
const SITE_API_KEY = process.env.KLAPI_SITE_API_KEY || 'dev-site-api-key-0123456789abcdef';

const REQUEST_TIMEOUT_MS = Number(process.env.KLAPI_TIMEOUT_MS || 10_000);

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function klapiFetch(path, options = {}) {
  return fetchWithTimeout(`${KLAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'X-API-Key': SITE_API_KEY,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
}

// Fetches the ENTIRE deck from klapi in a single request (GET /tarot/cards),
// never card by card.
async function fetchAllCardsFromKlapi() {
  const res = await klapiFetch('/tarot/cards');
  if (!res.ok) {
    throw new Error(`GET /tarot/cards failed: HTTP ${res.status}`);
  }
  const cards = await res.json();
  if (!Array.isArray(cards)) {
    throw new Error('GET /tarot/cards returned an unexpected payload');
  }
  return cards;
}

// Pushes the full deck to klapi (PUT /tarot/cards). Returns the stored cards.
async function syncCardsToKlapi(cards) {
  const res = await klapiFetch('/tarot/cards', {
    method: 'PUT',
    body: JSON.stringify(cards),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PUT /tarot/cards failed: HTTP ${res.status} ${text}`.trim());
  }
  return res.json();
}

module.exports = {
  KLAPI_BASE_URL,
  fetchAllCardsFromKlapi,
  syncCardsToKlapi,
};
