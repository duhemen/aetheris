/* ============================================================
   Aetheris v8 — Private Rooms (R)
   Create + join via invite code / password
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitReady();
  setupPrivateRooms(A);
})();

function setupPrivateRooms(A) {
  // ---------- Tombol di header ----------
  const btn = document.createElement('button');
  btn.id = 'privateRoomBtn';
  btn.className = 'glass rounded-lg px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-800/80';
  btn.innerHTML = `🔒 <span class="text-slate-300">Private Room</span>`;
  document.body.appendChild(btn);

  // ---------- Modal Create ----------
  const createModal = document.createElement('div');
  createModal.id = 'createRoomModal';
  createModal.className = 'hidden fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center';
  createModal.innerHTML = `
    <div class="glass rounded-2xl p-6 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-cyan-300">🔒 Buat Private Room</h3>
        <button data-close="create" class="text-slate-400 hover:text-rose-300">✕</button>
      </div>
      <div class="space-y-3">
        <div>
          <label class="text-xs text-slate-400">Room ID (huruf, angka, dash)</label>
          <input id="newRoomId" maxlength="40" placeholder="misal: rapat-rahasia"
            class="w-full mt-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-100 text-sm" />
        </div>
        <div>
          <label class="text-xs text-slate-400">Password (opsional, min 4 char)</label>
          <input id="newRoomPw" type="password" maxlength="64" placeholder="kosongkan kalau tanpa password"
            class="w-full mt-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-100 text-sm" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs text-slate-400">Max Users</label>
            <input id="newRoomMax" type="number" min="2" max="200" value="30"
              class="w-full mt-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-100 text-sm" />
          </div>
          <div>
            <label class="text-xs text-slate-400">Topic</label>
            <input id="newRoomTopic" maxlength="80" placeholder="opsional"
              class="w-full mt-1 bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-100 text-sm" />
          </div>
        </div>
        <button id="doCreateRoom"
          class="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-semibold py-2 rounded-lg">
          Buat Room
        </button>
        <div id="createResult" class="hidden mt-3"></div>
      </div>
    </div>
  `;
  document.body.appendChild(createModal);

  // ---------- Modal Join ----------
  const joinModal = document.createElement('div');
  joinModal.id = 'joinRoomModal';
  joinModal.className = 'hidden fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center';
  joinModal.innerHTML = `
    <div class="glass rounded-2xl p-6 max-w-sm w-full mx-4">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-cyan-300">🔒 Room Private</h3>
      </div>
      <p class="text-sm text-slate-400 mb-3">
        Room <span id="joinRoomName" class="text-cyan-300 font-mono"></span> butuh akses.
      </p>
      <div id="joinFields" class="space-y-3">
        <input id="joinPw" type="password" placeholder="Password"
          class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-100 text-sm hidden" />
        <input id="joinCode" placeholder="Invite code (alternatif)"
          class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-2 text-slate-100 text-sm" />
        <button id="doJoin"
          class="w-full bg-cyan-500 hover:bg-cyan-400 text-white font-semibold py-2 rounded-lg">
          Coba Masuk
        </button>
        <div id="joinError" class="text-xs text-rose-400 hidden"></div>
      </div>
    </div>
  `;
  document.body.appendChild(joinModal);

  // ---------- Handlers ----------
  btn.onclick = () => createModal.classList.remove('hidden');
  createModal.querySelectorAll('[data-close="create"]').forEach(el => {
    el.onclick = () => createModal.classList.add('hidden');
  });

  const doCreate = async () => {
    const room_id = document.getElementById('newRoomId').value.trim();
    const password = document.getElementById('newRoomPw').value;
    const max_users = parseInt(document.getElementById('newRoomMax').value || '30', 10);
    const topic = document.getElementById('newRoomTopic').value.trim();

    if (!room_id || !/^[a-zA-Z0-9_-]{3,40}$/.test(room_id)) {
      alert('Room ID tidak valid (huruf/angka/dash, 3-40 char).');
      return;
    }
    if (password && password.length < 4) {
      alert('Password minimal 4 karakter atau kosongkan.');
      return;
    }

    const r = await fetch('/api/rooms/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id, password, max_users, topic }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert('Gagal buat room: ' + (err.detail || r.status));
      return;
    }

    const data = await r.json();
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(room_id)}&code=${encodeURIComponent(data.invite_code)}`;

    const resultEl = document.getElementById('createResult');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="bg-emerald-500/15 border border-emerald-500/40 rounded-lg p-3 text-xs space-y-2">
        <div class="text-emerald-300 font-semibold">✅ Room dibuat!</div>
        <div>URL: <code class="text-cyan-300 break-all">${url}</code></div>
        <div>Invite code: <code class="text-amber-300 font-bold">${data.invite_code}</code></div>
        <button id="copyInviteLink" class="w-full mt-2 bg-cyan-500 hover:bg-cyan-400 text-white py-1.5 rounded">
          📋 Copy Invite Link
        </button>
        <button id="gotoRoom" class="w-full bg-purple-500 hover:bg-purple-400 text-white py-1.5 rounded">
          🚀 Masuk Room Sekarang
        </button>
      </div>
    `;
    document.getElementById('copyInviteLink').onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        document.getElementById('copyInviteLink').textContent = '✅ Copied!';
        setTimeout(() => {
          document.getElementById('copyInviteLink').textContent = '📋 Copy Invite Link';
        }, 1500);
      });
    };
    document.getElementById('gotoRoom').onclick = () => {
      location.href = url;
    };
  };
  document.getElementById('doCreateRoom').onclick = doCreate;

  // ---------- Join Private Room (access denied → modal) ----------
  window.AETHERIS_EVENTS = window.AETHERIS_EVENTS || [];
  window.AETHERIS_EVENTS.push((msg) => {
    if (msg.type === 'access_denied') {
      document.getElementById('joinRoomName').textContent = msg.room_id || '';
      const pwField = document.getElementById('joinPw');
      const errEl = document.getElementById('joinError');
      errEl.classList.add('hidden');

      if (msg.requires_password) {
        pwField.classList.remove('hidden');
      } else {
        pwField.classList.add('hidden');
      }
      joinModal.classList.remove('hidden');
    }
  });

  const doJoin = () => {
    const pw = document.getElementById('joinPw').value;
    const code = document.getElementById('joinCode').value.trim();
    const errEl = document.getElementById('joinError');

    if (!pw && !code) {
      errEl.textContent = 'Masukkan password atau invite code.';
      errEl.classList.remove('hidden');
      return;
    }

    // Simpan ke sessionStorage → dipakai saat WS reconnect
    sessionStorage.setItem('aetheris-room-pw', pw);
    sessionStorage.setItem('aetheris-room-code', code);

    // Update URL dengan invite code kalau ada
    if (code) {
      const url = new URL(location.href);
      url.searchParams.set('code', code);
      history.replaceState({}, '', url);
    }

    // Trigger reconnect WS
    joinModal.classList.add('hidden');
    if (window.AETHERIS?.setRoom) {
      window.AETHERIS.setRoom(window.AETHERIS.getRoomId());
    } else {
      location.reload();
    }
  };
  document.getElementById('doJoin').onclick = doJoin;

  // ---------- Auto-fill invite code dari URL ----------
  const params = new URLSearchParams(location.search);
  const codeFromUrl = params.get('code');
  if (codeFromUrl) {
    sessionStorage.setItem('aetheris-room-code', codeFromUrl);
  }
}