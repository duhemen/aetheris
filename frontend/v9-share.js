/* ============================================================
   Aetheris v9 — Share Room (rev2 — fixed WA)
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitReady();
  setupShareUI(A);
})();

function setupShareUI(A) {
  const btn = document.createElement('button');
  btn.id = 'shareBtn';
  btn.className = 'glass rounded-lg px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-800/80 transition';
  btn.innerHTML = `📤 <span class="text-slate-300">Share</span>`;
  btn.title = 'Share room (Ctrl+Shift+S)';
  document.body.appendChild(btn);

  const topRight = document.getElementById('topRightStack');
  if (topRight) {
    btn.style.position = 'static';
    topRight.appendChild(btn);
  }

  const modal = document.createElement('div');
  modal.id = 'shareModal';
  modal.className = 'hidden fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center';
  modal.innerHTML = `
    <div class="glass rounded-2xl p-6 max-w-sm w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-cyan-300">📤 Share Room</h3>
        <button id="shareClose" class="text-slate-400 hover:text-rose-300 text-xl">✕</button>
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400">Link room</label>
        <div class="flex gap-2 mt-1">
          <input id="shareUrl" readonly
            class="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-300 text-xs font-mono" />
          <button id="copyLink" class="bg-cyan-500/30 hover:bg-cyan-500/50 text-cyan-200 btn-mini px-3">📋</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-3">
        <a data-target="whatsapp" href="#" role="button"
          class="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm py-3 rounded-lg transition">
          <span>📱</span> WhatsApp
        </a>
        <a data-target="telegram" href="#" role="button"
          class="flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm py-3 rounded-lg transition">
          <span>✈️</span> Telegram
        </a>
        <a data-target="twitter" href="#" role="button"
          class="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm py-3 rounded-lg transition">
          <span>🐦</span> Twitter/X
        </a>
        <a data-target="email" href="#" role="button"
          class="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm py-3 rounded-lg transition">
          <span>✉️</span> Email
        </a>
      </div>

      <div id="inviteBox" class="border-t border-slate-700 pt-3 hidden">
        <div class="text-xs text-slate-400 mb-2">Invite code (private room)</div>
        <div class="flex gap-2">
          <input id="inviteCode" readonly
            class="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-amber-300 text-xs font-mono" />
          <button id="copyCode" class="bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 btn-mini px-3">📋</button>
        </div>
      </div>

      <button id="nativeShare"
        class="w-full mt-3 hidden bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold text-sm py-2 rounded-lg">
        📤 Share via Sistem
      </button>
      <div id="shareHint" class="text-xs text-amber-400 mt-2 hidden text-center"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // ─── Build share data ───
  function buildShareData() {
    const roomId = A.getRoomId?.() || 'public';
    const code = sessionStorage.getItem('aetheris-room-code') || '';
    const url = new URL(location.href);
    url.searchParams.set('room', roomId);
    if (code) url.searchParams.set('code', code);
    url.searchParams.delete('auth');

    const isPrivate = window.__aetherisRoomIsPrivate === true;
    const text = isPrivate
      ? `Halo! Aku invite kamu ke room privat Aetheris "${roomId}".\nKlik link untuk masuk:`
      : `Halo! Ayo main Aetheris bareng di room "${roomId}".\nKlik link:`;

    return { url: url.toString(), title: 'Aetheris', text, roomId, code };
  }

  function openModal() {
    const data = buildShareData();
    modal.querySelector('#shareUrl').value = data.url;

    const inviteBox = modal.querySelector('#inviteBox');
    if (data.code) {
      modal.querySelector('#inviteCode').value = data.code;
      inviteBox.classList.remove('hidden');
    } else {
      inviteBox.classList.add('hidden');
    }

    const nativeBtn = modal.querySelector('#nativeShare');
    if (navigator.share) {
      nativeBtn.classList.remove('hidden');
      nativeBtn.onclick = async () => {
        try {
          await navigator.share({ title: data.title, text: data.text, url: data.url });
          closeModal();
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('[Share]', e);
        }
      };
    } else {
      nativeBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.querySelector('#shareHint').classList.add('hidden');
  }

  // ─── Copy helper with fallback ───
  async function copyToClipboard(text, btnEl) {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      } else {
        // Fallback: textarea + execCommand
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      }
    } catch (e) {
      console.warn('[Share] Copy error:', e);
    }

    if (btnEl) {
      const orig = btnEl.textContent;
      btnEl.textContent = ok ? '✅' : '❌';
      setTimeout(() => { btnEl.textContent = orig; }, 1200);
    }
    return ok;
  }

  // ─── Platform share URLs ───
  function buildPlatformUrl(target, data) {
    // WhatsApp: text + url digabung
    const fullText = `${data.text}\n${data.url}`;
    const encText = encodeURIComponent(fullText);
    const encUrl = encodeURIComponent(data.url);
    const encTitle = encodeURIComponent(data.title);

    switch (target) {
      case 'whatsapp':
        // Pakai api.whatsapp.com (lebih reliable daripada wa.me)
        return `https://api.whatsapp.com/send?text=${encText}`;
      case 'telegram':
        return `https://t.me/share/url?url=${encUrl}&text=${encodeURIComponent(data.text)}`;
      case 'twitter':
        return `https://twitter.com/intent/tweet?text=${encText}`;
      case 'email':
        return `mailto:?subject=${encTitle}&body=${encText}`;
      default:
        return '';
    }
  }

  // ─── Event handlers ───
  btn.onclick = openModal;
  modal.querySelector('#shareClose').onclick = closeModal;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  modal.querySelector('#copyLink').onclick = (e) => {
    const url = modal.querySelector('#shareUrl').value;
    copyToClipboard(url, e.currentTarget);
  };

  modal.querySelector('#copyCode').onclick = (e) => {
    const code = modal.querySelector('#inviteCode').value;
    copyToClipboard(code, e.currentTarget);
  };

  // Platform buttons — pakai href langsung, tidak pakai window.open
  // Karena <a href> tidak kena popup blocker
  modal.querySelectorAll('a[data-target]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const data = buildShareData();
      const url = buildPlatformUrl(a.dataset.target, data);
      if (!url) return;

      // Update href lalu trigger navigasi native
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener,noreferrer';

      // Log untuk debugging
      console.log(`[Share] Opening ${a.dataset.target}:`, url);

      // Untuk WhatsApp & Telegram, langsung navigate (bukan window.open)
      // agar tidak diblok popup blocker
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener,noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();

      closeModal();
    });
  });

  // ─── URL param auto-open ───
  const params = new URLSearchParams(location.search);
  if (params.get('share') === '1') {
    setTimeout(openModal, 800);
    params.delete('share');
    const url = new URL(location.href);
    url.search = params.toString();
    history.replaceState({}, '', url);
  }

  // ─── Keyboard: Ctrl+Shift+S ───
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      openModal();
    }
  });

  // ─── Expose ───
  window.AETHERIS_SHARE = {
    open: openModal,
    buildData: buildShareData,
    buildUrl: buildPlatformUrl,
  };
}