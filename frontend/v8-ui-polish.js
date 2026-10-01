/* ============================================================
   Aetheris v8 — UI Polish (rev2)
   - Stack tombol rapi (no overlap)
   - Voice HANYA di Private Room
   - Auto-detect private room via API (tidak bergantung init)
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitReady();
  await waitForButtons(2000);
  polishLayout();
  await detectPrivateRoom();     // ← auto-detect pertama
  restrictVoiceToPrivate();

  // Re-check saat event dari WS init (kalau ada)
  window.addEventListener('aetheris-room-flag', () => {
    applyVoiceState();
  });
})();

async function waitForButtons(timeout = 2000) {
  const ids = ['voiceBtn', 'chatToggle', 'privateRoomBtn'];
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = ids.filter(id => document.getElementById(id)).length;
    if (found >= 2) return;
    await new Promise(r => setTimeout(r, 100));
  }
}

/* ══════════════════════════════════════════════════════════
   AUTO-DETECT PRIVATE ROOM (via API + URL)
   ══════════════════════════════════════════════════════════ */
async function detectPrivateRoom() {
  const params = new URLSearchParams(location.search);
  const roomId = params.get('room') || 'public';
  const codeFromUrl = params.get('code') || sessionStorage.getItem('aetheris-room-code') || '';

  // Heuristik cepat: kalau ada `?code=`, hampir pasti private
  if (codeFromUrl) {
    window.__aetherisRoomIsPrivate = true;
    window.dispatchEvent(new Event('aetheris-room-flag'));
    console.log('[UI-Polish] Private room (dari URL code):', roomId);
  }

  // Konfirmasi via API
  try {
    const r = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/info`);
    if (r.ok) {
      const info = await r.json();
      const isPrivate = info.exists === true && info.is_private === true;
      window.__aetherisRoomIsPrivate = isPrivate || !!codeFromUrl;
      window.dispatchEvent(new Event('aetheris-room-flag'));
      console.log('[UI-Polish] Room info:', info, '→ isPrivate:', window.__aetherisRoomIsPrivate);
    }
  } catch (e) {
    console.warn('[UI-Polish] Detect API gagal:', e);
    if (!window.__aetherisRoomIsPrivate) {
      window.__aetherisRoomIsPrivate = !!codeFromUrl;
      window.dispatchEvent(new Event('aetheris-room-flag'));
    }
  }
}

/* ══════════════════════════════════════════════════════════
   LAYOUT — stack tombol
   ══════════════════════════════════════════════════════════ */
function polishLayout() {
  // ── Top-right stack ──
  let topRight = document.getElementById('topRightStack');
  if (!topRight) {
    topRight = document.createElement('div');
    topRight.id = 'topRightStack';
    topRight.style.cssText =
      'position:fixed;top:12px;right:12px;z-index:40;' +
      'display:flex;flex-direction:column;gap:6px;align-items:flex-end;' +
      'pointer-events:none;';
    document.body.appendChild(topRight);
  }

  const roomBadge = document.getElementById('roomBadge');
  const privateBtn = document.getElementById('privateRoomBtn');

  [roomBadge, privateBtn].forEach(el => {
    if (!el) return;
    el.style.position = 'static';
    el.style.top = '';
    el.style.right = '';
    el.style.pointerEvents = 'auto';
    topRight.appendChild(el);
  });

  // ── FAB stack (bottom-right) ──
  let fab = document.getElementById('fabStack');
  if (!fab) {
    fab = document.createElement('div');
    fab.id = 'fabStack';
    fab.style.cssText =
      'position:fixed;bottom:12px;right:12px;z-index:45;' +
      'display:flex;flex-direction:row;gap:10px;align-items:center;';
    document.body.appendChild(fab);
  }

  const voiceBtn = document.getElementById('voiceBtn');
  const chatToggle = document.getElementById('chatToggle');

  [voiceBtn, chatToggle].forEach(el => {
    if (!el) return;
    el.style.position = 'static';
    el.style.bottom = '';
    el.style.right = '';
    el.style.width = '48px';
    el.style.height = '48px';
    el.style.borderRadius = '9999px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    fab.appendChild(el);
  });

  // Voice bar → di atas FAB
  const voiceBar = document.getElementById('voiceBar');
  if (voiceBar) {
    voiceBar.style.position = 'fixed';
    voiceBar.style.bottom = '72px';
    voiceBar.style.right = '12px';
    voiceBar.style.zIndex = '44';
  }

  // Ctrl+K hint → bottom-left
  document.querySelectorAll('div').forEach(el => {
    if (el.textContent?.includes('Ctrl+K') &&
        el.textContent?.includes('palette') &&
        el.style.position === 'fixed') {
      el.style.left = '12px';
      el.style.right = 'auto';
      el.style.bottom = '12px';
    }
  });
}

/* ══════════════════════════════════════════════════════════
   VOICE RESTRICTION
   ══════════════════════════════════════════════════════════ */
let _voiceStateApplied = false;

function applyVoiceState() {
  const isPrivate = window.__aetherisRoomIsPrivate === true;
  const voiceBtn = document.getElementById('voiceBtn');
  if (!voiceBtn) return;

  if (!isPrivate) {
    voiceBtn.disabled = true;
    voiceBtn.style.opacity = '0.35';
    voiceBtn.style.cursor = 'not-allowed';
    voiceBtn.style.filter = 'grayscale(0.8)';
    voiceBtn.title = '🔒 Voice hanya tersedia di Private Room';
    voiceBtn.setAttribute('aria-disabled', 'true');
    voiceBtn.setAttribute('data-voice-allowed', 'false');
  } else {
    voiceBtn.disabled = false;
    voiceBtn.style.opacity = '1';
    voiceBtn.style.cursor = 'pointer';
    voiceBtn.style.filter = '';
    voiceBtn.title = 'Voice chat aktif (Private Room)';
    voiceBtn.removeAttribute('aria-disabled');
    voiceBtn.setAttribute('data-voice-allowed', 'true');
  }

  // Sembunyikan voice bar kalau tidak private
  const voiceBar = document.getElementById('voiceBar');
  if (voiceBar && !isPrivate) {
    voiceBar.style.display = 'none';
  }

  _voiceStateApplied = true;
}

function restrictVoiceToPrivate() {
  applyVoiceState();
  // Poll backup — kalau flag berubah (navigasi, dsb.)
  setInterval(() => {
    if (window.AETHERIS_VOICE?.isEnabled?.()) return;  // jangan ubah saat aktif
    applyVoiceState();
  }, 1500);
}