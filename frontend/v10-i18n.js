/* ============================================================
   Aetheris v10 — i18n (X)
   Bahasa: Indonesia (id) + English (en)
   ============================================================ */

const TRANSLATIONS = {
  id: {
    "app.title": "Aetheris: The Balance Engine",
    "app.tagline": "Cosmo-Cognitive Simulation",
    "auth.login": "Masuk / Guest",
    "auth.choose": "Pilih Cara Masuk",
    "auth.guest": "Masuk sebagai Guest",
    "auth.google": "Lanjut dengan Google",
    "auth.github": "Lanjut dengan GitHub",
    "auth.logout": "Logout",
    "chat.title": "Room Chat",
    "chat.placeholder": "Ketik pesan...",
    "chat.placeholder.wait": "Menunggu identitas...",
    "chat.send": "Kirim",
    "share.title": "Share Room",
    "share.copy": "Copy Link",
    "share.wa": "WhatsApp",
    "share.tg": "Telegram",
    "share.tw": "Twitter/X",
    "share.em": "Email",
    "voice.leave": "Keluar",
    "voice.mute": "Bisukan",
    "voice.unmute": "Bunyikan",
    "voice.private_only": "Voice hanya di Private Room",
    "admin.title": "Panel Admin",
    "admin.muteall": "Mute Semua",
    "admin.kick": "Tendang",
    "admin.ban": "Blokir",
    "admin.mute": "Mute",
    "lang.switch": "Ganti Bahasa",
  },
  en: {
    "app.title": "Aetheris: The Balance Engine",
    "app.tagline": "Cosmo-Cognitive Simulation",
    "auth.login": "Login / Guest",
    "auth.choose": "Choose Login Method",
    "auth.guest": "Continue as Guest",
    "auth.google": "Continue with Google",
    "auth.github": "Continue with GitHub",
    "auth.logout": "Logout",
    "chat.title": "Room Chat",
    "chat.placeholder": "Type a message...",
    "chat.placeholder.wait": "Waiting for identity...",
    "chat.send": "Send",
    "share.title": "Share Room",
    "share.copy": "Copy Link",
    "share.wa": "WhatsApp",
    "share.tg": "Telegram",
    "share.tw": "Twitter/X",
    "share.em": "Email",
    "voice.leave": "Leave",
    "voice.mute": "Mute",
    "voice.unmute": "Unmute",
    "voice.private_only": "Voice is private-room only",
    "admin.title": "Admin Panel",
    "admin.muteall": "Mute All",
    "admin.kick": "Kick",
    "admin.ban": "Ban",
    "admin.mute": "Mute",
    "lang.switch": "Switch Language",
  },
};

let currentLang = 'id';

export function t(key) {
  return TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS.id[key] || key;
}

export function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem('aetheris-lang', lang);
  document.documentElement.lang = lang;
  applyTranslations();
  window.dispatchEvent(new CustomEvent('aetheris-lang-change', { detail: { lang } }));
}

export function getLang() {
  return currentLang;
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (text) el.textContent = text;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const text = t(key);
    if (text) el.placeholder = text;
  });
}

// ─── Auto-init ───
(function initLang() {
  const saved = localStorage.getItem('aetheris-lang');
  if (saved && TRANSLATIONS[saved]) {
    currentLang = saved;
  } else {
    const browserLang = (navigator.language || 'id').toLowerCase();
    currentLang = browserLang.startsWith('en') ? 'en' : 'id';
  }
  document.documentElement.lang = currentLang;

  window.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    setupLangSwitcher();
  });
})();

function setupLangSwitcher() {
  const btn = document.createElement('button');
  btn.id = 'langBtn';
  btn.className = 'glass rounded-lg px-2 py-2 text-xs flex items-center gap-1 hover:bg-slate-800/80';
  btn.innerHTML = `🌐 <span id="langLabel">${currentLang.toUpperCase()}</span>`;
  btn.title = t('lang.switch');

  const topRight = document.getElementById('topRightStack');
  if (topRight) {
    btn.style.position = 'static';
    topRight.appendChild(btn);
  } else {
    btn.style.position = 'fixed';
    btn.style.top = '12px';
    btn.style.right = '12px';
    btn.style.zIndex = '40';
    document.body.appendChild(btn);
  }

  btn.onclick = () => {
    const next = currentLang === 'id' ? 'en' : 'id';
    setLang(next);
    document.getElementById('langLabel').textContent = next.toUpperCase();
  };

  window.addEventListener('aetheris-lang-change', () => {
    document.getElementById('langLabel').textContent = currentLang.toUpperCase();
  });
}

window.AETHERIS_I18N = { t, setLang, getLang, applyTranslations };