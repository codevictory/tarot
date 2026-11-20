'use strict';

// Admin portal (/admin). Intentionally not linked from anywhere — the admin
// types the path manually. Prompts for username/password, then shows a form
// to edit the English and Finnish title/description of every tarot card in
// the klapi database. All klapi calls go through this site's own /admin/api
// proxy, which forwards the portal user's Bearer token.

const TOKEN_STORAGE_KEY = 'tarot-admin-token';
const USERNAME_STORAGE_KEY = 'tarot-admin-username';
const LANG_STORAGE_KEY = 'tarot-lang';
const SUPPORTED_LANGS = ['fi', 'en'];
const DEFAULT_LANG = 'fi';

const I18N = {
  fi: {
    'document.title': 'Tarot-ylläpito',
    'header.title': 'Tarot-korttien ylläpito',
    'header.subtitle': 'Muokkaa korttien englannin- ja suomenkielisiä otsikoita ja kuvauksia',
    'lang.aria': 'Kieli',
    'nav.home': 'Korttigalleria',
    'login.heading': 'Kirjaudu sisään',
    'login.username': 'Käyttäjätunnus',
    'login.password': 'Salasana',
    'login.submit': 'Kirjaudu',
    'login.errorInvalid': 'Virheellinen käyttäjätunnus tai salasana',
    'login.errorNotAdmin': 'Tällä tunnuksella ei ole ylläpitäjän roolia',
    'login.errorGeneric': 'Kirjautuminen epäonnistui, yritä uudelleen',
    'logout': 'Kirjaudu ulos',
    'signedInAs': 'Kirjautunut käyttäjänä',
    'editor.loading': 'Ladataan kortteja…',
    'editor.loadError': 'Korttien lataaminen epäonnistui',
    'editor.empty': 'Kortteja ei löytynyt',
    'filter.placeholder': 'Hae kortteja…',
    'filter.aria': 'Hae kortteja',
    'card.englishTitle': 'Englanninkielinen otsikko',
    'card.englishDescription': 'Englanninkielinen kuvaus',
    'card.finnishTitle': 'Suomenkielinen otsikko',
    'card.finnishDescription': 'Suomenkielinen kuvaus',
    'card.save': 'Tallenna',
    'card.saving': 'Tallennetaan…',
    'card.saved': 'Tallennettu',
    'card.saveError': 'Tallennus epäonnistui: otsikot ovat pakollisia',
  },
  en: {
    'document.title': 'Tarot admin',
    'header.title': 'Tarot card admin',
    'header.subtitle': 'Edit the English and Finnish titles and descriptions of the cards',
    'lang.aria': 'Language',
    'nav.home': 'Card gallery',
    'login.heading': 'Sign in',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.errorInvalid': 'Invalid username or password',
    'login.errorNotAdmin': 'This account does not have the admin role',
    'login.errorGeneric': 'Sign-in failed, please try again',
    'logout': 'Sign out',
    'signedInAs': 'Signed in as',
    'editor.loading': 'Loading cards…',
    'editor.loadError': 'Failed to load cards',
    'editor.empty': 'No cards found',
    'filter.placeholder': 'Search cards…',
    'filter.aria': 'Search cards',
    'card.englishTitle': 'English title',
    'card.englishDescription': 'English description',
    'card.finnishTitle': 'Finnish title',
    'card.finnishDescription': 'Finnish description',
    'card.save': 'Save',
    'card.saving': 'Saving…',
    'card.saved': 'Saved',
    'card.saveError': 'Save failed: titles are required',
  },
};

const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const editor = document.getElementById('editor');
const adminFilter = document.getElementById('admin-filter');
const adminUser = document.getElementById('admin-user');
const logoutBtn = document.getElementById('logout-btn');
const editorStatus = document.getElementById('editor-status');
const cardForms = document.getElementById('card-forms');
const langPicker = document.getElementById('lang-picker');

let lang = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY)) || DEFAULT_LANG;
let token = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
let signedInUsername = localStorage.getItem(USERNAME_STORAGE_KEY) || '';
let cards = [];
// cardId -> { englishTitle, englishDescription, finnishTitle, finnishDescription }
let drafts = new Map();
let savingIds = new Set();

function normalizeLang(value) {
  const normalized = (value || '').trim().toLowerCase();
  return SUPPORTED_LANGS.includes(normalized) ? normalized : null;
}

function t(key) {
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

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

  adminUser.textContent = signedInUsername ? `${t('signedInAs')} ${signedInUsername}` : '';
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

function showLogin() {
  token = '';
  signedInUsername = '';
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USERNAME_STORAGE_KEY);
  loginForm.hidden = false;
  editor.hidden = true;
  loginError.hidden = true;
  loginPassword.value = '';
  applyLanguage();
}

function showEditor() {
  loginForm.hidden = true;
  editor.hidden = false;
  applyLanguage();
}

function setStatus(message, isError) {
  editorStatus.hidden = !message;
  editorStatus.textContent = message || '';
  editorStatus.classList.toggle('admin-error', Boolean(isError));
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

async function handleLogin(event) {
  event.preventDefault();
  const username = loginUsername.value.trim();
  const password = loginPassword.value;

  if (!username || !password) return;

  loginError.hidden = true;
  try {
    const res = await apiFetch('/admin/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      loginError.textContent =
        res.status === 401 ? t('login.errorInvalid') : (res.body?.message || t('login.errorGeneric'));
      loginError.hidden = false;
      return;
    }

    const roles = Array.isArray(res.body?.roles) ? res.body.roles : [];
    if (!roles.includes('admin')) {
      loginError.textContent = t('login.errorNotAdmin');
      loginError.hidden = false;
      return;
    }

    token = res.body.accessToken || '';
    signedInUsername = res.body.username || username;
    if (!token) {
      loginError.textContent = t('login.errorGeneric');
      loginError.hidden = false;
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USERNAME_STORAGE_KEY, signedInUsername);
    showEditor();
    await loadCards();
  } catch {
    loginError.textContent = t('login.errorGeneric');
    loginError.hidden = false;
  }
}

async function loadCards() {
  setStatus(t('editor.loading'), false);
  cardForms.textContent = '';
  try {
    const res = await apiFetch('/admin/api/cards');
    if (res.status === 401 || res.status === 403) {
      showLogin();
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cards = Array.isArray(res.body) ? res.body : [];
    drafts = new Map(cards.map((card) => [card.id, draftFromCard(card)]));
    setStatus('', false);
    renderCardForms();
  } catch {
    setStatus(t('editor.loadError'), true);
  }
}

function draftFromCard(card) {
  const en = card.translations?.en;
  const fi = card.translations?.fi;
  return {
    englishTitle: en?.title ?? card.title ?? '',
    englishDescription: en?.description ?? card.description ?? '',
    finnishTitle: fi?.title ?? '',
    finnishDescription: fi?.description ?? '',
  };
}

function visibleCards() {
  const query = adminFilter.value.trim().toLowerCase();
  if (!query) return cards;
  return cards.filter((card) => {
    const draft = drafts.get(card.id) || {};
    return [card.id, card.title, card.arcana, draft.englishTitle, draft.finnishTitle]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

function labelSpan(key) {
  const span = document.createElement('span');
  span.dataset.i18n = key;
  span.textContent = t(key);
  return span;
}

function fieldInput(cardId, field, multiline) {
  const draft = drafts.get(cardId);
  const input = document.createElement(multiline ? 'textarea' : 'input');
  if (!multiline) input.type = 'text';
  if (multiline) input.rows = 4;
  input.value = draft[field];
  input.addEventListener('input', () => {
    draft[field] = input.value;
    setCardStatus(cardId, '', false);
  });
  return input;
}

function setCardStatus(cardId, message, isError) {
  const form = cardForms.querySelector(`form[data-card-id="${CSS.escape(cardId)}"]`);
  if (!form) return;
  const status = form.querySelector('.admin-card-status');
  status.textContent = message;
  status.classList.toggle('admin-error', Boolean(isError));
  status.classList.toggle('admin-saved', !isError && Boolean(message));
}

function renderCardForms() {
  cardForms.textContent = '';

  const visible = visibleCards();
  if (visible.length === 0) {
    const p = document.createElement('p');
    p.className = 'admin-status';
    p.textContent = t('editor.empty');
    cardForms.appendChild(p);
    return;
  }

  for (const card of visible) {
    const form = document.createElement('form');
    form.className = 'admin-card';
    form.dataset.cardId = card.id;

    const heading = document.createElement('h3');
    heading.className = 'admin-card-heading';
    heading.textContent = `${card.id} — ${card.arcana}`;
    form.appendChild(heading);

    const fields = [
      ['card.englishTitle', 'englishTitle', false],
      ['card.englishDescription', 'englishDescription', true],
      ['card.finnishTitle', 'finnishTitle', false],
      ['card.finnishDescription', 'finnishDescription', true],
    ];

    for (const [labelKey, field, multiline] of fields) {
      const label = document.createElement('label');
      label.className = 'admin-field';
      label.appendChild(labelSpan(labelKey));
      label.appendChild(fieldInput(card.id, field, multiline));
      form.appendChild(label);
    }

    const actions = document.createElement('div');
    actions.className = 'admin-card-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'admin-btn primary';
    saveBtn.dataset.i18n = 'card.save';
    saveBtn.textContent = t('card.save');
    saveBtn.disabled = savingIds.has(card.id);
    if (savingIds.has(card.id)) saveBtn.textContent = t('card.saving');

    const status = document.createElement('span');
    status.className = 'admin-card-status';

    actions.append(saveBtn, status);
    form.appendChild(actions);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void saveCard(card.id);
    });

    cardForms.appendChild(form);
  }
}

async function saveCard(cardId) {
  const draft = drafts.get(cardId);
  if (!draft) return;

  if (!draft.englishTitle.trim() || !draft.finnishTitle.trim()) {
    setCardStatus(cardId, t('card.saveError'), true);
    return;
  }

  savingIds.add(cardId);
  setCardStatus(cardId, '', false);
  renderSaveButtons();

  try {
    const res = await apiFetch(`/admin/api/cards/${encodeURIComponent(cardId)}/texts`, {
      method: 'PUT',
      body: JSON.stringify({
        englishTitle: draft.englishTitle.trim(),
        englishDescription: draft.englishDescription,
        finnishTitle: draft.finnishTitle.trim(),
        finnishDescription: draft.finnishDescription,
      }),
    });

    if (res.status === 401 || res.status === 403) {
      showLogin();
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const updated = res.body;
    cards = cards.map((card) => (card.id === cardId ? updated : card));
    drafts.set(cardId, draftFromCard(updated));
    setCardStatus(cardId, t('card.saved'), false);
    renderCardForms();
  } catch {
    setCardStatus(cardId, t('card.saveError'), true);
  } finally {
    savingIds.delete(cardId);
    renderSaveButtons();
  }
}

function renderSaveButtons() {
  cardForms.querySelectorAll('form.admin-card').forEach((form) => {
    const id = form.dataset.cardId;
    const btn = form.querySelector('button[type="submit"]');
    const saving = savingIds.has(id);
    btn.disabled = saving;
    btn.textContent = saving ? t('card.saving') : t('card.save');
  });
}

loginForm.addEventListener('submit', (event) => {
  void handleLogin(event);
});

logoutBtn.addEventListener('click', () => {
  showLogin();
});

adminFilter.addEventListener('input', () => {
  renderCardForms();
});

applyLanguage();

if (token) {
  showEditor();
  void loadCards();
} else {
  showLogin();
}
