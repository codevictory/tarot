'use strict';

// Server-to-server client for the klapi API (.NET 10).
//
// Configuration via environment variables (never hardcode secrets):
//   KLAPI_BASE_URL          e.g. http://localhost:5013 (dev) or https://klapi.tietokonepaja.fi (prod)
//   KLAPI_SERVICE_USERNAME  service account username (default: tarot-service)
//   KLAPI_SERVICE_PASSWORD  service account password (required in production)
//
// The client obtains a JWT from POST /auth/token and sends it as a Bearer
// token on every klapi call. In production the API runs behind HTTPS, so the
// credentials and token never travel over plaintext HTTP.

const KLAPI_BASE_URL = (process.env.KLAPI_BASE_URL || 'http://localhost:5013').replace(/\/+$/, '');
const SERVICE_USERNAME = process.env.KLAPI_SERVICE_USERNAME || 'tarot-service';
const SERVICE_PASSWORD = process.env.KLAPI_SERVICE_PASSWORD || 'changeme';

const TOKEN_REFRESH_MARGIN_MS = 60_000;
const REQUEST_TIMEOUT_MS = Number(process.env.KLAPI_TIMEOUT_MS || 10_000);

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function requestToken() {
  const res = await fetchWithTimeout(`${KLAPI_BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: SERVICE_USERNAME, password: SERVICE_PASSWORD }),
  });

  if (!res.ok) {
    throw new Error(`POST /auth/token failed: HTTP ${res.status}`);
  }

  const body = await res.json();
  if (!body.accessToken) {
    throw new Error('POST /auth/token returned no accessToken');
  }

  cachedToken = body.accessToken;
  const expiresInMs = Math.max((body.expiresIn || 43200) * 1000 - TOKEN_REFRESH_MARGIN_MS, 0);
  cachedTokenExpiresAt = Date.now() + expiresInMs;
  return cachedToken;
}

async function getToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }
  return requestToken();
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function klapiFetch(path, options = {}, retryOn401 = true) {
  const token = await getToken();
  const res = await fetchWithTimeout(`${KLAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && retryOn401) {
    await getToken(true);
    return klapiFetch(path, options, false);
  }

  return res;
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
