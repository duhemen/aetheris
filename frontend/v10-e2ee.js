/* ============================================================
   Aetheris v10 — E2E Encryption untuk Private Room (Z) (rev2)
   - Badge pindah ke kanan bawah (tidak overlap Ctrl+K hint)
   - Fix race condition: decrypt selesai dulu sebelum chat di-render
   - Support password dari URL hash (auto-decrypt tanpa prompt)
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

const PBKDF2_ITERATIONS = 100_000;
const SALT_PREFIX = "aetheris-e2ee-v1:";

class E2EE {
  constructor() {
    this.key = null;
    this.roomId = null;
    this.enabled = false;
  }

  isEnabled() { return this.enabled && this.key !== null; }

  async deriveKey(roomId, password) {
    if (!password || password.length < 4) throw new Error('Password minimal 4 karakter');
    const enc = new TextEncoder();
    const salt = enc.encode(SALT_PREFIX + roomId);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    this.key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    this.roomId = roomId;
    this.enabled = true;
    return true;
  }

  async encrypt(plaintext) {
    if (!this.isEnabled()) return { plain: plaintext };
    try {
      const enc = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        this.key,
        enc.encode(plaintext)
      );
      return {
        _e2ee: true,
        iv: this._b64(iv),
        ct: this._b64(new Uint8Array(ct)),
      };
    } catch (e) {
      console.error('[E2EE] encrypt error:', e);
      return { plain: plaintext };
    }
  }

  async decrypt(payload) {
    if (!payload || !payload._e2ee) {
      return typeof payload === 'string' ? payload : (payload?.plain ?? '');
    }
    if (!this.isEnabled()) {
      return '🔒 [encrypted — masukkan password untuk baca]';
    }
    try {
      const iv = this._unb64(payload.iv);
      const ct = this._unb64(payload.ct);
      const pt = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.key,
        ct
      );
      return new TextDecoder().decode(pt);
    } catch (e) {
      console.warn('[E2EE] decrypt error:', e);
      return '🔒 [gagal decrypt — password salah?]';
    }
  }

  _b64(bytes) {
    let s = '';
    bytes.forEach(b => s += String.fromCharCode(b));
    return btoa(s);
  }
  _unb64(str) {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
}

const e2ee = new E2EE();

(async () => {
  const A = await waitReady();

  // ─── Cek apakah private room + ada password ───
  const isPrivate = window.__aetherisRoomIsPrivate === true;
  let pw = sessionStorage.getItem('aetheris-room-pw') || '';

  // Fallback: cek URL hash #pw=xxx (untuk share link dengan auto-decrypt)
  if (!pw && location.hash.startsWith('#pw=')) {
    pw = decodeURIComponent(location.hash.slice(4));
    if (pw) sessionStorage.setItem('aetheris-room-pw', pw);
  }

  if (isPrivate && pw) {
    try {
      await e2ee.deriveKey(A.getRoomId(), pw);
      console.log('[E2EE] 🔐 Aktif untuk room', A.getRoomId());
      showE2EEBadge(true);
    } catch (e) {
      console.warn('[E2EE] Gagal derive key:', e.message);
      showE2EEBadge(false);
    }
  } else {
    showE2EEBadge(false);
  }

  // ─── Hook: intercept chat SEND — encrypt dulu baru kirim ───
  const origSend = A.send.bind(A);
  A.send = function(msg) {
    if (msg.type === 'chat' && e2ee.isEnabled()) {
      e2ee.encrypt(msg.text).then(encrypted => {
        origSend({ ...msg, text: '', encrypted });
      });
      return;
    }
    origSend(msg);
  };

  // ─── Hook: intercept chat RECEIVE — decrypt dulu baru dispatch ───
  // Strategi: kita bikin "decrypt queue" yang jalan SEBELUM listener lain.
  window.AETHERIS_EVENTS = window.AETHERIS_EVENTS || [];

  // Wrapper: kalau ada chat encrypted, decrypt dulu, baru panggil semua listener
  const _origEvents = window.AETHERIS_EVENTS.slice();
  window.AETHERIS_EVENTS.length = 0;

  window.AETHERIS_EVENTS.push(async (msg) => {
    if (msg.type === 'chat' && msg.encrypted) {
      const plaintext = await e2ee.decrypt(msg.encrypted);
      msg.text = plaintext;
      msg.encrypted = null;
    }
    // Forward ke listener asli (sudah ter-decrypt)
    for (const fn of _origEvents) {
      try { await fn(msg); } catch (e) { console.warn('[E2EE] listener error:', e); }
    }
  });

  // ─── UI Badge — PINDAH KE KANAN BAWAH ───
    function showE2EEBadge(on) {
    let badge = document.getElementById('e2eeBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'e2eeBadge';
      // ── PAKAI INLINE STYLE (bukan Tailwind class) ──
      badge.style.cssText = `
        position: fixed;
        bottom: 12px;
        right: 128px;
        z-index: 30;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 4px;
        pointer-events: none;
      `;
      document.body.appendChild(badge);
    }
    if (on) {
      badge.innerHTML = `🔐 <span style="color:#6ee7b7">E2E</span>`;
      badge.title = 'Chat dienkripsi end-to-end (AES-256-GCM)';
      badge.style.opacity = '1';
    } else {
      badge.innerHTML = `🔓 <span style="color:#94a3b8">E2E off</span>`;
      badge.title = 'Chat tidak dienkripsi (public room atau tanpa password)';
      badge.style.opacity = '0.5';
    }
  }
  // ─── Expose ───
  window.AETHERIS_E2EE = {
    isEnabled: () => e2ee.isEnabled(),
    enable: async (password) => {
      await e2ee.deriveKey(A.getRoomId(), password);
      sessionStorage.setItem('aetheris-room-pw', password);
      showE2EEBadge(true);
    },
    disable: () => {
      e2ee.enabled = false;
      e2ee.key = null;
      sessionStorage.removeItem('aetheris-room-pw');
      showE2EEBadge(false);
    },
    encrypt: (t) => e2ee.encrypt(t),
    decrypt: (p) => e2ee.decrypt(p),
    // Shortcut: gen share link dengan password ter-embed (untuk private room)
    buildShareLink: () => {
      const pw = sessionStorage.getItem('aetheris-room-pw');
      if (!pw) return location.href;
      const url = new URL(location.href);
      url.hash = `pw=${encodeURIComponent(pw)}`;
      return url.toString();
    },
  };
})();