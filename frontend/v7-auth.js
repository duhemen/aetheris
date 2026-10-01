/* ============================================================
   Aetheris v7 — Social Auth (rev2)
   Flow: modal dulu → user pilih → baru connect WS
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitReady();
  const authState = await fetchAuthState();
  await setupAuthUI(A, authState);
})();

async function fetchAuthState() {
  try {
    const [me, prov] = await Promise.all([
      fetch('/auth/me').then(r => r.json()).catch(() => ({ authenticated: false })),
      fetch('/auth/providers').then(r => r.json()).catch(() => ({ enabled: [] })),
    ]);
    return { me, providers: prov.enabled || [] };
  } catch {
    return { me: { authenticated: false }, providers: [] };
  }
}

async function setupAuthUI(A, state) {
  // ══════════════════════════════════════════════════════════
  // Tentukan apakah perlu tampilkan modal
  // ══════════════════════════════════════════════════════════
  const isAuthed = state.me.authenticated;
  const isGuestMode = localStorage.getItem('aetheris-guest-mode') === '1';

  if (isAuthed) {
    localStorage.setItem('aetheris-auth-user', JSON.stringify(state.me.user));
    localStorage.removeItem('aetheris-guest-mode'); // clear guest flag
    // Langsung ready
    window.dispatchEvent(new CustomEvent('aetheris-identity-ready', {
      detail: { mode: 'member', user: state.me.user }
    }));
  } else if (isGuestMode) {
    // Sudah pernah pilih guest → langsung ready
    window.dispatchEvent(new CustomEvent('aetheris-identity-ready', {
      detail: { mode: 'guest' }
    }));
  }
  // Else: modal akan auto-open, WS tunggu user pilih

  // ══════════════════════════════════════════════════════════
  // Buat UI
  // ══════════════════════════════════════════════════════════
  const btn = document.createElement('button');
  btn.id = 'authBtn';
  btn.className = 'fixed top-3 left-3 z-40 glass rounded-lg px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-800/80 transition';
  document.body.appendChild(btn);

  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center';
  modal.innerHTML = `
    <div class="glass rounded-2xl p-6 max-w-sm w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-cyan-300">Pilih Cara Masuk</h3>
        <button id="authClose" class="text-slate-400 hover:text-rose-300 ${!isAuthed && !isGuestMode ? 'invisible' : ''}">✕</button>
      </div>
      <p class="text-sm text-slate-400 mb-4">
        Login via sosial media untuk identitas permanen, atau masuk sebagai Guest.
      </p>
      <div id="authProviders" class="space-y-2 mb-4"></div>
      <div class="border-t border-slate-700 pt-4">
        <button id="guestBtn"
          class="w-full text-sm text-slate-200 hover:text-cyan-200 bg-slate-800/60 hover:bg-slate-700/80 py-3 rounded-lg font-semibold transition">
          👤 Masuk sebagai Guest
        </button>
        <p class="text-[10px] text-slate-500 mt-2 text-center">
          Guest = identitas sementara, hanya tersimpan di browser ini
        </p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const providerNames = {
    google: { label: 'Google', icon: '🔵', color: 'bg-white hover:bg-slate-100 text-slate-900' },
    github: { label: 'GitHub', icon: '⚫', color: 'bg-slate-800 hover:bg-slate-700 text-white' },
    facebook: { label: 'Facebook', icon: '🔷', color: 'bg-blue-600 hover:bg-blue-500 text-white' },
  };

  const providersDiv = modal.querySelector('#authProviders');
  if (state.providers.length === 0) {
    providersDiv.innerHTML = `
      <div class="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
        ⚠️ Tidak ada provider OAuth aktif.<br/>
        Setup <code>GOOGLE_CLIENT_ID</code> atau <code>GITHUB_CLIENT_ID</code> di <code>.env</code>.
      </div>
    `;
  } else {
    providersDiv.innerHTML = state.providers.map(p => {
      const meta = providerNames[p] || { label: p, icon: '🔑', color: 'bg-slate-700 text-white' };
      return `
        <a href="/auth/${p}/login"
           class="flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition ${meta.color}">
          <span class="text-xl">${meta.icon}</span>
          <span>Lanjut dengan ${meta.label}</span>
        </a>
      `;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════
  // Render tombol utama
  // ══════════════════════════════════════════════════════════
  const renderBtn = () => {
    if (state.me.authenticated) {
      const u = state.me.user;
      const avatar = u.avatar
        ? `<img src="${u.avatar}" class="w-6 h-6 rounded-full" referrerpolicy="no-referrer">`
        : `<span class="w-6 h-6 rounded-full bg-cyan-500/30 flex items-center justify-center text-xs">${(u.name || '?')[0].toUpperCase()}</span>`;
      btn.innerHTML = `${avatar}<span class="text-slate-200 max-w-[100px] truncate">${escapeHtml(u.name)}</span>`;
      btn.title = `${u.name} (${u.provider}) — klik untuk logout`;
      btn.onclick = async () => {
        if (!confirm(`Logout dari ${u.name}?`)) return;
        await fetch('/auth/logout', { method: 'POST' });
        localStorage.removeItem('aetheris-auth-user');
        location.reload();
      };
    } else if (localStorage.getItem('aetheris-guest-mode') === '1') {
      const id = getGuestIdentity();
      btn.innerHTML = `<span>👤</span><span class="text-slate-300 max-w-[100px] truncate">${escapeHtml(id.nickname)}</span>`;
      btn.title = 'Guest mode — klik untuk login';
      btn.onclick = () => modal.classList.remove('hidden');
    } else {
      btn.innerHTML = `<span>👤</span><span class="text-slate-300">Pilih cara masuk</span>`;
      btn.onclick = () => modal.classList.remove('hidden');
    }
  };
  renderBtn();

  // ══════════════════════════════════════════════════════════
  // Handlers
  // ══════════════════════════════════════════════════════════
  const closeBtn = modal.querySelector('#authClose');
  closeBtn.onclick = () => {
    // Hanya izinkan close kalau user sudah punya identitas
    if (state.me.authenticated || localStorage.getItem('aetheris-guest-mode') === '1') {
      modal.classList.add('hidden');
    }
  };

  modal.querySelector('#guestBtn').onclick = () => {
    // Set flag guest
    localStorage.setItem('aetheris-guest-mode', '1');
    modal.classList.add('hidden');

    // Rename Anon → Guest di localStorage
    const id = getGuestIdentity();
    if (id.nickname.startsWith('Anon-')) {
      id.nickname = id.nickname.replace('Anon-', 'Guest-');
      localStorage.setItem('aetheris-id', JSON.stringify(id));
    }

    renderBtn();

    // Trigger WS connect (kalau belum)
    window.dispatchEvent(new CustomEvent('aetheris-identity-ready', {
      detail: { mode: 'guest' }
    }));
  };

  // ══════════════════════════════════════════════════════════
  // Auto-open modal kalau belum ada identitas
  // ══════════════════════════════════════════════════════════
  if (!isAuthed && !isGuestMode) {
    modal.classList.remove('hidden');
  }

  // ══════════════════════════════════════════════════════════
  // Handle OAuth redirect (kembali dari Google/GitHub)
  // ══════════════════════════════════════════════════════════
  const params = new URLSearchParams(location.search);
  if (params.get('auth') === 'ok') {
    params.delete('auth');
    const url = new URL(location.href);
    url.search = params.toString();
    history.replaceState({}, '', url);

    const newState = await fetchAuthState();
    Object.assign(state, newState);
    localStorage.removeItem('aetheris-guest-mode');
    renderBtn();

    window.dispatchEvent(new CustomEvent('aetheris-identity-ready', {
      detail: { mode: 'member', user: state.me.user }
    }));

    // Reconnect WS untuk dapat identitas baru
    setTimeout(() => {
      if (window.AETHERIS?.setRoom) {
        window.AETHERIS.setRoom(window.AETHERIS.getRoomId());
      }
    }, 200);
  }

  // ══════════════════════════════════════════════════════════
  // Expose
  // ══════════════════════════════════════════════════════════
  window.AETHERIS_AUTH = {
    getState: () => state,
    isAuthenticated: () => state.me.authenticated,
    getUser: () => state.me.user || null,
    isGuest: () => localStorage.getItem('aetheris-guest-mode') === '1',
    reset: () => {
      localStorage.removeItem('aetheris-guest-mode');
      localStorage.removeItem('aetheris-auth-user');
      location.reload();
    },
  };
}

function getGuestIdentity() {
  try {
    const saved = JSON.parse(localStorage.getItem('aetheris-id') || 'null');
    if (saved?.user_id) return saved;
  } catch {}
  const uid = (crypto.randomUUID?.() || Math.random().toString(36).slice(2, 10)).slice(0, 8);
  const colors = ['#22d3ee', '#a855f7', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899'];
  const id = {
    user_id: uid,
    nickname: `Guest-${uid.slice(0, 4)}`,   // ← Guest, bukan Anon
    color: colors[Math.floor(Math.random() * colors.length)],
  };
  localStorage.setItem('aetheris-id', JSON.stringify(id));
  return id;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}