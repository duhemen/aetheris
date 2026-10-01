/* ============================================================
   Aetheris v10 — Room Admin Panel (V)
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitReady();
  setupAdmin(A);
})();

function setupAdmin(A) {
  const state = {
    isAdmin: false,
    ownerId: null,
    mutedAll: false,
    users: [],
    selfId: A.getIdentity?.()?.user_id,
  };

  // Expose AETHERIS_EVENTS untuk tangkap info admin dari init
  window.AETHERIS_EVENTS = window.AETHERIS_EVENTS || [];
  window.AETHERIS_EVENTS.push((msg) => {
    if (msg.type === 'init') {
      state.isAdmin = !!msg.is_admin;
      state.ownerId = msg.owner_id;
      state.mutedAll = !!msg.muted_all;
      state.users = msg.users || [];
      refreshPanel();
    } else if (msg.type === 'user_joined' || msg.type === 'user_left') {
      state.users = msg.users || [];
      refreshPanel();
    } else if (msg.type === 'mute_all') {
      state.mutedAll = msg.value;
      refreshPanel();
    } else if (msg.type === 'owner_changed') {
      state.ownerId = msg.new_owner;
      state.isAdmin = msg.new_owner === state.selfId;
      refreshPanel();
    } else if (msg.type === 'kicked' && msg.target === state.selfId) {
      alert('Anda di-kick dari room oleh admin.');
    } else if (msg.type === 'banned' && msg.target === state.selfId) {
      alert('Anda di-ban dari room oleh admin.');
    } else if (msg.type === 'chat_blocked') {
      alert('Anda sedang di-mute oleh admin.');
    }
  });

  // ─── Panel UI ───
  const panel = document.createElement('div');
  panel.id = 'adminPanel';
  panel.className = 'hidden fixed top-16 right-3 z-40 glass rounded-xl p-3 w-72 max-h-[60vh] overflow-y-auto';
  panel.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <div class="text-sm font-semibold text-cyan-300">🛡️ Admin Panel</div>
      <button id="adminClose" class="text-slate-400 hover:text-rose-300">✕</button>
    </div>
    <div class="mb-3 flex gap-2">
      <button id="muteAllBtn" class="btn-mini flex-1 bg-amber-500/30 hover:bg-amber-500/50 text-amber-200">
        🔇 Mute All
      </button>
    </div>
    <div class="text-xs text-slate-400 mb-1">Users (${0})</div>
    <div id="adminUserList" class="space-y-1 text-xs"></div>
  `;
  document.body.appendChild(panel);

  const btn = document.createElement('button');
  btn.id = 'adminBtn';
  btn.className = 'glass rounded-lg px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-800/80 hidden';
  btn.innerHTML = `🛡️ <span class="text-slate-300">Admin</span>`;
  document.body.appendChild(btn);

  const topRight = document.getElementById('topRightStack');
  if (topRight) {
    btn.style.position = 'static';
    topRight.appendChild(btn);
  }

  btn.onclick = () => panel.classList.toggle('hidden');
  panel.querySelector('#adminClose').onclick = () => panel.classList.add('hidden');

  panel.querySelector('#muteAllBtn').onclick = () => {
    A.send({ type: 'admin_mute_all', value: !state.mutedAll });
  };

  function refreshPanel() {
    if (!state.isAdmin) {
      btn.classList.add('hidden');
      panel.classList.add('hidden');
      return;
    }
    btn.classList.remove('hidden');

    panel.querySelector('#muteAllBtn').textContent = state.mutedAll
      ? '🔊 Unmute All' : '🔇 Mute All';

    const list = panel.querySelector('#adminUserList');
    const label = panel.querySelector('.text-xs.text-slate-400');
    if (label) label.textContent = `Users (${state.users.length})`;

    list.innerHTML = state.users.map(u => {
      const isSelf = u.user_id === state.selfId;
      const isOwner = u.user_id === state.ownerId;
      return `
        <div class="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/60">
          <span class="flex-1 truncate text-slate-200">${escapeHtml(u.nickname)}</span>
          ${isOwner ? '👑' : ''}
          ${isSelf ? '<span class="text-cyan-400 text-[10px]">(you)</span>' : `
            <button data-act="mute" data-uid="${u.user_id}" class="text-[10px] px-1.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-200">Mute</button>
            <button data-act="kick" data-uid="${u.user_id}" class="text-[10px] px-1.5 rounded bg-orange-500/30 hover:bg-orange-500/50 text-orange-200">Kick</button>
            <button data-act="ban" data-uid="${u.user_id}" class="text-[10px] px-1.5 rounded bg-rose-500/30 hover:bg-rose-500/50 text-rose-200">Ban</button>
          `}
        </div>
      `;
    }).join('');

    list.querySelectorAll('button[data-act]').forEach(b => {
      b.onclick = () => {
        const act = b.dataset.act;
        const uid = b.dataset.uid;
        const user = state.users.find(u => u.user_id === uid);
        if (!confirm(`${act} user "${user?.nickname}"?`)) return;
        A.send({ type: `admin_${act}`, target: uid });
      };
    });
  }

  window.AETHERIS_ADMIN = {
    isAdmin: () => state.isAdmin,
    getOwner: () => state.ownerId,
    muteAll: () => A.send({ type: 'admin_mute_all', value: true }),
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}