#!/usr/bin/env node
'use strict';

// Pushes data/cards.json to the klapi API (PUT /tarot/cards) so that klapi
// hosts the tarot card descriptions. Run after editing data/cards.json:
//
//   npm run sync-cards
//
// Uses the same env vars as the server: KLAPI_BASE_URL,
// KLAPI_SERVICE_USERNAME, KLAPI_SERVICE_PASSWORD.

const fs = require('fs');
const path = require('path');
const { syncCardsToKlapi, KLAPI_BASE_URL } = require('../lib/klapiClient');

const CARDS_JSON = path.join(__dirname, '..', 'data', 'cards.json');

async function main() {
  const cards = JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8'));
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error(`${CARDS_JSON} does not contain any cards`);
  }

  const payload = cards.map((card, index) => ({
    id: card.id,
    title: card.title,
    arcana: card.arcana,
    image: card.image,
    description: card.description,
    sortOrder: index,
  }));

  const stored = await syncCardsToKlapi(payload);
  console.log(`Synced ${stored.length} cards to ${KLAPI_BASE_URL}/tarot/cards`);
}

main().catch((err) => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
