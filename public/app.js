'use strict';

const gallery = document.getElementById('gallery');
const searchInput = document.getElementById('card-search');
const filterButtons = document.getElementById('filter-buttons');
const dialog = document.getElementById('card-dialog');
const dialogImg = document.getElementById('dialog-img');
const dialogTitle = document.getElementById('dialog-title');
const dialogArcana = document.getElementById('dialog-arcana');
const dialogDescription = document.getElementById('dialog-description');
const dialogClose = document.getElementById('dialog-close');
const dialogAiTag = document.getElementById('dialog-ai-tag');
const langPicker = document.getElementById('lang-picker');

// Arcana filter keys are the stable (English) values stored in the database;
// only the displayed labels are localized.
const SECTION_ORDER = ['Major Arcana', 'Wands', 'Cups', 'Swords', 'Pentacles'];

const LANG_STORAGE_KEY = 'tarot-lang';
const SUPPORTED_LANGS = ['fi', 'en'];
const DEFAULT_LANG = 'fi';

const I18N = {
  fi: {
    'document.title': 'Tarot Lintujärvi',
    'header.title': 'Tarot Lintujärvi',
    'header.subtitle': 'Tulkintojani ja ajatuksiani korteista sekä Tarot-symboliikasta. Käyn sivustoa läpi ja korvaan tekoäly tekstejä omillani kortti kerrallaan.',
    'lang.aria': 'Kieli',
    'search.placeholder': 'Hae kortteja nimen tai merkityksen mukaan…',
    'search.aria': 'Hae kortteja',
    'nav.aria': 'Suodata kortteja',
    'filters.aria': 'Suodata arkanan mukaan',
    'filter.All': 'Kaikki',
    'filter.Major Arcana': 'Iso arkana',
    'filter.Wands': 'Sauvat',
    'filter.Cups': 'Maljat',
    'filter.Swords': 'Miekat',
    'filter.Pentacles': 'Pentakelit',
    'loading': 'Ladataan pakkaa…',
    'noMatches': 'Yksikään kortti ei vastaa nykyisiä suodattimia.',
    'loadError': 'Pakkaa ei voitu ladata: ',
    'viewCard': 'Näytä',
    'dialog.close': 'Sulje',
    'aiTag': 'Tekoälyn kirjoittama',
  },
  en: {
    'document.title': 'Tarot Lintujärvi',
    'header.title': 'Tarot Lintujärvi',
    'header.subtitle': 'My interpretations and thoughts on the cards and Tarot symbolism. I am going through the site and replacing the AI texts with my own, one card at a time.',
    'lang.aria': 'Language',
    'search.placeholder': 'Search cards by name or meaning…',
    'search.aria': 'Search cards',
    'nav.aria': 'Filter cards',
    'filters.aria': 'Filter by arcana',
    'filter.All': 'All',
    'filter.Major Arcana': 'Major Arcana',
    'filter.Wands': 'Wands',
    'filter.Cups': 'Cups',
    'filter.Swords': 'Swords',
    'filter.Pentacles': 'Pentacles',
    'loading': 'Loading the deck…',
    'noMatches': 'No cards match the current filters.',
    'loadError': 'Could not load the deck: ',
    'viewCard': 'View',
    'dialog.close': 'Close',
    'aiTag': 'Written by AI',
  },
};

let allCards = [];
let cardsLoaded = false;
let currentCard = null;
let lang = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY)) || DEFAULT_LANG;
const filterState = { arcana: 'All', query: '' };

function normalizeLang(value) {
  const normalized = (value || '').trim().toLowerCase();
  return SUPPORTED_LANGS.includes(normalized) ? normalized : null;
}

function t(key) {
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

// Picks the localized texts for a card, falling back to the canonical
// (English) base fields when a translation is missing.
function localizedCard(card, language) {
  const tr = card.translations && card.translations[language];
  return {
    title: (tr && tr.title) || card.title,
    arcana: (tr && tr.arcana) || card.arcana,
    description: (tr && tr.description) || card.description,
  };
}

// Search matches the card text in every stored language, so a Finnish query
// also finds cards while the UI is in English and vice versa.
// The "Written by AI" tag is a per-card flag (writtenByAi in klapi), toggled
// from the admin page. Cards without the field are treated as tagged.
function isWrittenByAi(card) {
  return card.writtenByAi !== false;
}

function searchHaystack(card) {
  const parts = [card.title, card.arcana, card.description];
  if (card.translations) {
    for (const tr of Object.values(card.translations)) {
      parts.push(tr.title, tr.arcana, tr.description);
    }
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function filterCards(cards, state) {
  return cards.filter((card) => {
    if (state.arcana !== 'All' && card.arcana !== state.arcana) return false;
    if (state.query && !searchHaystack(card).includes(state.query)) return false;
    return true;
  });
}

function applyFilters() {
  if (!cardsLoaded) {
    renderMessage(t('loading'));
    return;
  }
  renderCards(filterCards(allCards, filterState));
}

function renderMessage(text) {
  gallery.textContent = '';
  const p = document.createElement('p');
  p.className = 'loading';
  p.textContent = text;
  gallery.appendChild(p);
}

function renderCards(cards) {
  gallery.textContent = '';

  if (cards.length === 0) {
    renderMessage(t('noMatches'));
    return;
  }

  const byArcana = new Map();
  for (const card of cards) {
    if (!byArcana.has(card.arcana)) byArcana.set(card.arcana, []);
    byArcana.get(card.arcana).push(card);
  }

  for (const arcana of SECTION_ORDER) {
    const group = byArcana.get(arcana);
    if (!group) continue;

    const heading = document.createElement('h2');
    heading.className = 'section-title';
    heading.textContent = localizedCard(group[0], lang).arcana;
    gallery.appendChild(heading);

    for (const card of group) {
      const l = localizedCard(card, lang);
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.type = 'button';
      btn.setAttribute('aria-label', `${t('viewCard')} ${l.title}`);

      const img = document.createElement('img');
      img.src = card.image;
      img.alt = l.title;
      img.loading = 'lazy';

      const body = document.createElement('div');
      body.className = 'card-body';

      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = l.title;

      const desc = document.createElement('p');
      desc.className = 'card-desc';
      desc.textContent = l.description;

      body.append(title, desc);
      btn.append(img, body);
      if (isWrittenByAi(card)) {
        const tag = document.createElement('span');
        tag.className = 'ai-tag';
        tag.textContent = t('aiTag');
        btn.appendChild(tag);
      }
      btn.addEventListener('click', () => openDialog(card));
      gallery.appendChild(btn);
    }
  }
}

function openDialog(card) {
  currentCard = card;
  renderDialog();
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  document.body.style.overflow = 'hidden';
}

function renderDialog() {
  if (!currentCard) return;
  const l = localizedCard(currentCard, lang);
  dialogImg.src = currentCard.image;
  dialogImg.alt = l.title;
  dialogTitle.textContent = l.title;
  dialogArcana.textContent = l.arcana;
  dialogDescription.textContent = l.description;
  dialogAiTag.hidden = !isWrittenByAi(currentCard);
}

function closeDialog() {
  if (dialog.open) dialog.close();
  document.body.style.overflow = '';
}

// Applies the active language to every static UI string, the picker state,
// and re-renders the gallery and open dialog in the new language.
function applyLanguage() {
  document.documentElement.lang = lang;
  document.title = t('document.title');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });

  langPicker.querySelectorAll('.lang-btn').forEach((btn) => {
    const isActive = btn.dataset.lang === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  applyFilters();
  renderDialog();
}

langPicker.addEventListener('click', (event) => {
  const btn = event.target.closest('.lang-btn');
  if (!btn) return;
  const next = normalizeLang(btn.dataset.lang);
  if (!next || next === lang) return;
  lang = next;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  applyLanguage();
});

dialogClose.addEventListener('click', closeDialog);

// Click on the blurred backdrop (outside the dialog content) closes the modal.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog();
});

dialog.addEventListener('close', () => {
  document.body.style.overflow = '';
});

filterButtons.addEventListener('click', (event) => {
  const btn = event.target.closest('.filter-btn');
  if (!btn) return;
  filterState.arcana = btn.dataset.arcana;
  for (const el of filterButtons.querySelectorAll('.filter-btn')) {
    const isActive = el === btn;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-pressed', String(isActive));
  }
  applyFilters();
});

searchInput.addEventListener('input', () => {
  filterState.query = searchInput.value.trim().toLowerCase();
  applyFilters();
});

applyLanguage();

fetch('/api/cards')
  .then((res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then((cards) => {
    allCards = cards;
    cardsLoaded = true;
    applyFilters();
  })
  .catch((err) => {
    cardsLoaded = true;
    renderMessage(t('loadError') + err.message);
  });
