/* ============================================================
   Aetheris v10 — Session Recorder (Y)
   Rekam semua event WS + playback
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitReady();
  setupRecorder(A);
})();

function setupRecorder(A) {
  const state = {
    recording: false,
    events: [],
    startedAt: null,
    roomId: A.getRoomId?.() || 'public',
  };

  // ─── Tombol ───
  const btn = document.createElement('button');
  btn.id = 'sessionRecBtn';
  btn.className = 'glass rounded-lg px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-800/80';
  btn.innerHTML = `⏺️ <span class="text-slate-300">Record</span>`;
  btn.title = 'Rekam sesi room';

  const topRight = document.getElementById('topRightStack');
  if (topRight) {
    btn.style.position = 'static';
    topRight.appendChild(btn);
  } else {
    document.body.appendChild(btn);
  }

  // Modal
  const modal = document.createElement('div');
  modal.id = 'sessionModal';
  modal.className = 'hidden fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center';
  modal.innerHTML = `
    <div class="glass rounded-2xl p-5 max-w-md w-full mx-4">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-lg font-semibold text-cyan-300">🎥 Session Recorder</h3>
        <button data-close class="text-slate-400 hover:text-rose-300 text-xl">✕</button>
      </div>
      <div id="recStats" class="text-xs text-slate-400 mb-3"></div>
      <div class="flex gap-2 mb-3">
        <button id="recToggle"
          class="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-semibold py-2 rounded-lg">
          ⏺️ Start
        </button>
        <button id="recExport"
          class="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg" disabled>
          💾 Export JSON
        </button>
      </div>
      <div id="recPlaylist" class="max-h-60 overflow-y-auto text-xs space-y-1"></div>
      <p class="text-xs text-slate-500 mt-2">
        Semua event WS (chat, slider change, status) akan direkam dan bisa di-export untuk replay.
      </p>
    </div>
  `;
  document.body.appendChild(modal);

  const toggleBtn = modal.querySelector('#recToggle');
  const exportBtn = modal.querySelector('#recExport');
  const statsEl = modal.querySelector('#recStats');
  const playlistEl = modal.querySelector('#recPlaylist');

  btn.onclick = () => {
    modal.classList.remove('hidden');
    updateUI();
  };
  modal.querySelector('[data-close]').onclick = () => modal.classList.add('hidden');

  // ─── Recording ───
  function start() {
    state.recording = true;
    state.events = [];
    state.startedAt = Date.now();
    state.roomId = A.getRoomId?.() || 'public';
    toggleBtn.textContent = '⏹️ Stop';
    toggleBtn.className = 'flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg';
    console.log('[Recorder] Started');
    updateUI();
  }

  function stop() {
    state.recording = false;
    toggleBtn.textContent = '⏺️ Start';
    toggleBtn.className = 'flex-1 bg-rose-500 hover:bg-rose-400 text-white font-semibold py-2 rounded-lg';
    exportBtn.disabled = state.events.length === 0;
    console.log(`[Recorder] Stopped. Total: ${state.events.length} events`);
    updateUI();
  }

  toggleBtn.onclick = () => state.recording ? stop() : start();

  // ─── Capture WS events ───
  window.AETHERIS_EVENTS = window.AETHERIS_EVENTS || [];
  window.AETHERIS_EVENTS.push((msg) => {
    if (!state.recording) return;
    // Filter: hanya rekam event yang berguna untuk replay
    const keepTypes = ['chat', 'user_joined', 'user_left', 'room_sync',
                       'kicked', 'banned', 'muted', 'mute_all'];
    if (msg.type && keepTypes.includes(msg.type)) {
      state.events.push({
        ts: Date.now() - state.startedAt,
        type: msg.type,
        data: msg,
      });
      updateUI();
    }
    // Simulate result
    if (msg.c_agents && Array.isArray(msg.c_agents)) {
      state.events.push({
        ts: Date.now() - state.startedAt,
        type: 'simulate',
        data: { t: msg.t, a: msg.a, c_mean: msg.c_mean, metrics: msg.metrics },
      });
      updateUI();
    }
  });

  // ─── Export ───
  exportBtn.onclick = () => {
    if (state.events.length === 0) return;
    const session = {
      version: '10.0.0',
      room_id: state.roomId,
      started_at: new Date(state.startedAt).toISOString(),
      duration_ms: Date.now() - state.startedAt,
      event_count: state.events.length,
      events: state.events,
    };
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetheris-${state.roomId}-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  function updateUI() {
    if (state.recording) {
      const elapsed = ((Date.now() - state.startedAt) / 1000).toFixed(1);
      statsEl.innerHTML = `<span class="rec-dot"></span> Recording: ${elapsed}s · ${state.events.length} events`;
      statsEl.className = 'text-xs text-rose-400 mb-3';
      if (!statsEl._timer) {
        statsEl._timer = setInterval(updateUI, 200);
      }
    } else {
      statsEl.textContent = `${state.events.length} events recorded`;
      statsEl.className = 'text-xs text-slate-400 mb-3';
      if (statsEl._timer) {
        clearInterval(statsEl._timer);
        statsEl._timer = null;
      }
    }

    // Playlist: 10 event terakhir
    const recent = state.events.slice(-10).reverse();
    playlistEl.innerHTML = recent.map(e => `
      <div class="flex gap-2 px-2 py-1 rounded bg-slate-800/60">
        <span class="text-slate-500 font-mono w-12">${(e.ts / 1000).toFixed(1)}s</span>
        <span class="text-cyan-300 w-20">${e.type}</span>
        <span class="text-slate-300 truncate flex-1">${
          e.type === 'chat' ? escapeHtml(e.data.text || '') :
          e.type === 'simulate' ? `sim (balance: ${e.data.metrics?.balance?.toFixed(3) ?? '—'})` :
          e.type === 'user_joined' ? escapeHtml(e.data.user?.nickname || '') :
          e.type === 'user_left' ? e.data.user_id : ''
        }</span>
      </div>
    `).join('') || '<div class="text-slate-500 italic px-2">Belum ada event.</div>';
  }

  window.AETHERIS_RECORDER = {
    start, stop,
    isRecording: () => state.recording,
    getEvents: () => state.events,
    clear: () => { state.events = []; updateUI(); },
  };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}