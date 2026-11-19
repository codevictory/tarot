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

const SECTION_ORDER = ['Major Arcana', 'Wands', 'Cups', 'Swords', 'Pentacles'];

let allCards = [];
const filterState = { arcana: 'All', query: '' };

function filterCards(cards, state) {
  return cards.filter((card) => {
    if (state.arcana !== 'All' && card.arcana !== state.arcana) return false;
    if (state.query) {
      const haystack = `${card.title} ${card.arcana} ${card.description}`.toLowerCase();
      if (!haystack.includes(state.query)) return false;
    }
    return true;
  });
}

function applyFilters() {
  renderCards(filterCards(allCards, filterState));
}

function renderCards(cards) {
  gallery.textContent = '';

  if (cards.length === 0) {
    const p = document.createElement('p');
    p.className = 'loading';
    p.textContent = 'No cards match the current filters.';
    gallery.appendChild(p);
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
    heading.textContent = arcana;
    gallery.appendChild(heading);

    for (const card of group) {
      const btn = document.createElement('button');
      btn.className = 'card';
      btn.type = 'button';
      btn.setAttribute('aria-label', `View ${card.title}`);

      const img = document.createElement('img');
      img.src = card.image;
      img.alt = card.title;
      img.loading = 'lazy';

      const body = document.createElement('div');
      body.className = 'card-body';

      const title = document.createElement('h3');
      title.className = 'card-title';
      title.textContent = card.title;

      const desc = document.createElement('p');
      desc.className = 'card-desc';
      desc.textContent = card.description;

      body.append(title, desc);
      btn.append(img, body);
      btn.addEventListener('click', () => openDialog(card));
      gallery.appendChild(btn);
    }
  }
}

function openDialog(card) {
  dialogImg.src = card.image;
  dialogImg.alt = card.title;
  dialogTitle.textContent = card.title;
  dialogArcana.textContent = card.arcana;
  dialogDescription.textContent = card.description;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
  document.body.style.overflow = 'hidden';
}

function closeDialog() {
  if (dialog.open) dialog.close();
  document.body.style.overflow = '';
}

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

fetch('/api/cards')
  .then((res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then((cards) => {
    allCards = cards;
    applyFilters();
  })
  .catch((err) => {
    gallery.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'loading';
    p.textContent = 'Could not load the deck: ' + err.message;
    gallery.appendChild(p);
  });
