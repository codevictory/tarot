#!/usr/bin/env node
'use strict';

// Pushes data/cards.json (English) + data/cards.<lang>.json (translations) to
// the klapi API (PUT /tarot/cards) so that klapi hosts the tarot card texts in
// every supported language. Run after editing the data files:
//
//   npm run sync-cards
//
// Uses the same env vars as the server: KLAPI_BASE_URL, KLAPI_SITE_API_KEY.

const fs = require('fs');
const path = require('path');
const { syncCardsToKlapi, KLAPI_BASE_URL } = require('../lib/klapiClient');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CARDS_JSON = path.join(DATA_DIR, 'cards.json');

// Extra languages pushed to TarotCardTranslations, read from data/cards.<lang>.json
const EXTRA_LANGUAGES = ['fi'];

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const cards = loadJson(CARDS_JSON);
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new Error(`${CARDS_JSON} does not contain any cards`);
  }

  const translationsByLang = {};
  for (const lang of EXTRA_LANGUAGES) {
    const file = path.join(DATA_DIR, `cards.${lang}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(`missing translation file ${file}`);
    }
    translationsByLang[lang] = loadJson(file);
  }

  const payload = cards.map((card, index) => {
    const translations = {
      en: { title: card.title, arcana: card.arcana, description: card.description },
    };
    for (const lang of EXTRA_LANGUAGES) {
      const t = translationsByLang[lang][card.id];
      if (!t) {
        throw new Error(`missing ${lang} translation for card "${card.id}" in data/cards.${lang}.json`);
      }
      translations[lang] = { title: t.title, arcana: t.arcana, description: t.description };
    }

    return {
      id: card.id,
      title: card.title,
      arcana: card.arcana,
      image: card.image,
      description: card.description,
      sortOrder: card.sortOrder ?? index,
      translations,
    };
  });

  return syncCardsToKlapi(payload).then((stored) => {
    console.log(`Synced ${stored.length} cards (${['en', ...EXTRA_LANGUAGES].join(', ')}) to ${KLAPI_BASE_URL}/tarot/cards`);
  });
}

main().catch((err) => {
  console.error(`Sync failed: ${err.message}`);
  process.exit(1);
});
