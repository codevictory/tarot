# AGENTS.md — working instructions for the Mistral AI agent on this repo

This file is the operating manual for any AI agent (Mistral Vibe) working in
this repository. Read it before making changes. It describes what this project
is, how it is built, and the rules the agent must follow.

## Self-maintenance rule (read this first)

**Every time anything in this repository changes — new files, removed files,
new endpoints, new env vars, new scripts, changed commands, changed data
flows, changed conventions — update this AGENTS.md in the same change** so it
always describes the current state of the code. If a change makes a section
here stale or wrong, fix that section immediately. Never let this file drift
out of sync with the code it describes.

## What this project is

A single-page gallery of all 78 Rider-Waite tarot cards with a modal detail
view, a "card of the day" feature, search, arcana filters, and Finnish/English
localization — plus a hidden admin portal for editing card texts.

- `server.js` — the whole backend: a dependency-free Node.js `http` server.
  Serves static files from `public/`, exposes `GET /api/cards`, and proxies
  the admin API (`/admin/api/*`) to the klapi backend.
- `lib/klapiClient.js` — server-to-server client for the klapi API (.NET).
- `public/` — the frontend: vanilla HTML/CSS/JS, **no build step, no
  framework**. `index.html` + `app.js` = public gallery; `admin.html` +
  `admin.js` = admin portal; `markdown.js` is a small shared helper.
- `data/cards.json`, `data/cards.fi.json` — local card data (ids, titles,
  arcana, image paths).
- `tools/` — maintenance scripts (fetch cards, sync to klapi, generate SQL).
- `scripts/deploy.sh` — production deploy (git pull, `npm ci`, pm2 restart).
- `justfile` — task runner entry points (see below).

There are **no npm dependencies** and **no test suite**. Verification means
running the server and curling the endpoints.

## Commands

| Task | Command |
|---|---|
| Run dev server | `just dev` (or `npm start` / `node server.js`) |
| Install deps | `just install` (`npm install` / `npm ci`) |
| Deploy to production | `just deploy` (`scripts/deploy.sh`) |
| Fetch card data | `npm run fetch-cards` (`python3 tools/fetch_cards.py`) |
| Sync cards to klapi | `npm run sync-cards` (`node tools/sync_cards_to_klapi.js`) |
| Generate reset SQL | `npm run generate-reset-sql` |

Production runs under **pm2** via `/etc/tarot/ecosystem.config.js` (secrets
live there, file must stay `root:veikko 640`). Public traffic reaches the app
through a reverse proxy on the pm2 port. `scripts/deploy.sh` reads the port
from that ecosystem file and health-checks `http://127.0.0.1:$PORT/` after
restart.

## Architecture rules (do not break these)

1. **Card texts always come from klapi, never from a local file, and always
   in ONE bulk call** (`GET /tarot/cards` via `fetchAllCardsFromKlapi`).
   Never fetch card-by-card. The bulk result is cached in memory for
   `TAROT_CARDS_CACHE_TTL_MS` (default 60000 ms).
2. **Site-to-site auth**: every klapi call sends the shared key in the
   `X-API-Key` header (`KLAPI_SITE_API_KEY`). The key must never appear in
   code or commits — env vars only: `KLAPI_BASE_URL`, `KLAPI_SITE_API_KEY`,
   plus `PORT` and `KLAPI_TIMEOUT_MS`. Never log secrets.
3. **Admin portal** is reachable only by typing `/admin` manually (no links).
   The browser never talks to klapi directly: `server.js` proxies
   `/admin/api/login`, `/admin/api/cards`, `PUT /admin/api/cards/:id/texts`
   and `PUT /admin/api/cards/:id/written-by-ai`, forwarding the user's
   Bearer token; the site API key never leaves the server. Keep that proxy
   pattern for any new admin endpoint.
4. **Static file serving** has a path-traversal guard (`path.normalize` +
   `startsWith(PUBLIC_DIR)` → 403). Keep it intact for any new route.
   `.html`/`.js`/`.css` are served with `Cache-Control: no-cache` + ETag so
   edits show on next load; images stay cacheable.
5. **Frontend i18n**: default language is Finnish (`fi`), supported langs
   `fi`/`en`, stored under `LANG_STORAGE_KEY`. Arcana filter keys are the
   stable English values (`Major Arcana`, `Wands`, `Cups`, `Swords`,
   `Pentacles`); only labels are localized. Card ids are stable slugs like
   `fool`.
6. **Style**: `'use strict';` at the top, CommonJS `require`, plain
   `http`/`fetch`, no transpiler. Match existing formatting; make minimal
   diffs; no new dependencies unless truly needed.

## Data files and tools

- `data/cards.json` / `cards.fi.json`: array of card objects with `id`,
  `title`, `arcana`, image reference, etc. Card images live in
  `public/cards/`.
- `tools/sync_cards_to_klapi.js` pushes the full deck to klapi
  (`PUT /tarot/cards`); `tools/fetch_cards.py` scrapes/fetches card data;
  `tools/generate_reset_tarot_cards_sql.py` emits SQL to reset the klapi
  table. Run them only when the user asks.

## How the agent should work here

1. Read the relevant files (and this AGENTS.md) before editing; never edit a
   file you have not read in the session.
2. Make minimal, style-matching changes. Remove dead code completely when
   removing it; update all call sites.
3. Verify changes: start the server (`node server.js` with a test `PORT` and
   dev klapi env if needed) and curl `/`, `/api/cards`, and any touched
   admin endpoint. There is no test runner — a manual smoke check is the
   proof.
4. Secrets stay in env / the pm2 ecosystem file — never in code, commits, or
   chat output.
5. When committing, use a short imperative message and the standard Mistral
   Vibe commit trailer (Generated by Mistral Vibe / Co-Authored-By).
6. **After any code change, update this AGENTS.md if the change affects
   anything documented here** (see the self-maintenance rule above) and
   include it in the same commit.
