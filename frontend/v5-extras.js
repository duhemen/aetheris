/* ============================================================
   Aetheris v5 Extras (rev2)
   - J: Timeline Scrubber (replay historical frames)
   - K: Mobile layout + PWA registration
   - L: Command Palette (Ctrl+K)
   - Preset renderer (bulletproof, anti double-load)
   ============================================================ */

const waitAetheris = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitAetheris();

  // Guard: API v5 harus ada
  if (!A || typeof A.onResult !== 'function') {
    console.error('[v5-extras] window.AETHERIS.onResult tidak tersedia. Cek index.html.');
  } else {
    setupTimeline(A);
  }

  setupPWA();
  setupCommandPalette(A);
  setupMobileTweaks();
  setupPresetRenderer();   // pindah ke dalam IIFE — urutan terjamin
})();

/* ============================================================
   J. TIMELINE SCRUBBER
   ============================================================ */
function setupTimeline(A) {
  if (typeof A.onResult !== 'function') return;   // defensive

  const panel = document.getElementById('viz')?.parentElement;
  if (!panel) return;

  const bar = document.createElement('div');
  bar.id = 'timelineBar';
  bar.className = 'mt-3 flex items-center gap-3 text-xs';
  bar.innerHTML = `
    <button id="tlLive" class="btn-mini bg-emerald-500/30 text-emerald-200">● Live</button>
    <input id="tlSlider" type="range" min="0" max="159" value="159" disabled
      class="flex-1 accent-cyan-500" />
    <span id="tlLabel" class="font-mono text-cyan-300 w-16 text-right">LIVE</span>
  `;
  panel.appendChild(bar);

  const slider = bar.querySelector('#tlSlider');
  const label  = bar.querySelector('#tlLabel');
  const liveBtn = bar.querySelector('#tlLive');
  let replaying = false;

  const setReplay = (on) => {
    replaying = on;
    slider.disabled = !on;
    liveBtn.textContent = on ? '◀ Replay' : '● Live';
    liveBtn.className = on
      ? 'btn-mini bg-amber-500/30 text-amber-200'
      : 'btn-mini bg-emerald-500/30 text-emerald-200';
    if (!on) {
      slider.value = slider.max;
      label.textContent = 'LIVE';
      if (typeof A.resumeLive === 'function') A.resumeLive();
    }
  };

  liveBtn.addEventListener('click', () => setReplay(!replaying));

  slider.addEventListener('input', () => {
    if (!A.getLastResult || !A.getLastResult()) return;
    if (!replaying) setReplay(true);
    const idx = parseInt(slider.value, 10);
    if (typeof A.renderFrameAt === 'function') A.renderFrameAt(idx);
    label.textContent = `t=${idx}`;
  });

  A.onResult((res) => {
    if (!res?.c_agents?.length) return;
    const n = res.c_agents.length;
    slider.max = n - 1;
    if (!replaying) {
      slider.value = n - 1;
      label.textContent = 'LIVE';
    }
  });
}

/* ============================================================
   K. PWA REGISTER + MOBILE TWEAKS
   ============================================================ */
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(() => console.log('[PWA] Service Worker ready.'))
      .catch((e) => console.warn('[PWA] register gagal:', e));
  }
}

function setupMobileTweaks() {
  const adjust = () => {
    const isMobile = window.innerWidth < 768;
    document.querySelectorAll('.glass').forEach(el => {
      el.style.borderRadius = isMobile ? '12px' : '';
    });
    const viz = document.getElementById('viz');
    if (viz) viz.style.height = isMobile ? '320px' : '460px';
  };
  adjust();
  window.addEventListener('resize', adjust);
}

/* ============================================================
   L. COMMAND PALETTE (Ctrl+K)
   ============================================================ */
function setupCommandPalette(A) {
  const overlay = document.createElement('div');
  overlay.id = 'cmdOverlay';
  overlay.className = 'hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="max-w-xl mx-auto mt-[12vh] glass rounded-2xl p-3">
      <input id="cmdInput" placeholder="Ketik perintah... (Ctrl+K)"
        class="w-full bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-slate-100 outline-none" />
      <div id="cmdList" class="mt-2 max-h-[55vh] overflow-y-auto"></div>
      <div class="text-xs text-slate-500 mt-2 px-1">
        ↑↓ navigasi • Enter jalankan • Esc tutup
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = overlay.querySelector('#cmdInput');
  const list  = overlay.querySelector('#cmdList');

  const actions = [
    { id: 'tab-params',    label: 'Tab → Parameter',        run: () => clickTab('params') },
    { id: 'tab-presets',   label: 'Tab → Presets',          run: () => clickTab('presets') },
    { id: 'tab-rl',        label: 'Tab → RL Auto-Tuner',    run: () => clickTab('rl') },
    { id: 'tab-analytics', label: 'Tab → Analytics',        run: () => clickTab('analytics') },
    { id: 'toggle-adaptive',  label: 'Toggle Adaptive Rewiring',    run: () => toggleChk('adaptive') },
    { id: 'toggle-rl',        label: 'Toggle RL Auto-Tune',         run: () => toggleChk('rlOn') },
    { id: 'toggle-fed',       label: 'Toggle Federation Broadcast', run: () => toggleChk('federated') },
    { id: 'run-sweep',     label: 'Jalankan Sweep 15×15',   run: () => document.getElementById('runSweep')?.click() },
    { id: 'view-network',  label: 'Lihat view Network',     run: () => document.querySelector('[data-view="network"]')?.click() },
    { id: 'view-heatmap',  label: 'Lihat view Heatmap 3D',  run: () => document.querySelector('[data-view="heatmap3d"]')?.click() },
    { id: 'rec-start',     label: 'Mulai rekam video',      run: () => document.getElementById('recStart')?.click() },
    { id: 'rec-stop',      label: 'Stop rekam video',       run: () => document.getElementById('recStop')?.click() },
    { id: 'topology-random', label: 'Topologi → Random',     run: () => setSelect('topology','random') },
    { id: 'topology-ring',   label: 'Topologi → Ring',       run: () => setSelect('topology','ring') },
    { id: 'topology-star',   label: 'Topologi → Star',       run: () => setSelect('topology','star') },
    { id: 'topology-full',   label: 'Topologi → Full Mesh',  run: () => setSelect('topology','full') },
        { id: 'share-room',    label: 'Share room (WhatsApp/Telegram)', run: () => window.AETHERIS_SHARE?.open() },
  ];

  // Tambahkan preset actions (di-load di background)
  fetch('/api/presets').then(r => r.json()).then(store => {
    Object.keys(store).forEach(name => {
      actions.push({
        id: `preset-${name}`,
        label: `Preset → Load "${name}"`,
        run: () => {
          const btns = document.querySelectorAll('.preset-item button[data-action="load"]');
          for (const b of btns) if (b.dataset.name === name) return b.click();
          // fallback
          ['omega_m','omega_lambda','omega_s','omega_a','regulation','ethics','coupling','c0']
            .forEach(k => {
              const el = document.getElementById(k);
              if (el && store[name][k] !== undefined) {
                el.value = store[name][k];
                const lbl = document.getElementById(k + 'Val');
                if (lbl) lbl.textContent = store[name][k];
              }
            });
          if (typeof A.sendNow === 'function') A.sendNow();
        },
      });
    });
  }).catch(() => {});

  let filtered = [...actions];
  let cursor = 0;

  const render = () => {
    list.innerHTML = filtered.map((a, i) => `
      <div data-i="${i}" class="px-3 py-2 rounded cursor-pointer ${
        i === cursor ? 'bg-cyan-500/20 text-cyan-200' : 'hover:bg-slate-800/60 text-slate-300'
      }">${a.label}</div>
    `).join('') || '<div class="px-3 py-3 text-slate-500 text-sm">Tidak ada perintah.</div>';

    list.querySelectorAll('[data-i]').forEach(el => {
      el.addEventListener('click', () => { cursor = +el.dataset.i; execute(); });
    });
  };

  const filter = (q) => {
    q = q.trim().toLowerCase();
    filtered = !q ? [...actions] : actions.filter(a => a.label.toLowerCase().includes(q));
    cursor = 0;
    render();
  };

  const open = () => {
    overlay.classList.remove('hidden');
    input.value = '';
    filter('');
    setTimeout(() => input.focus(), 10);
  };
  const close = () => overlay.classList.add('hidden');

  const execute = () => {
    const a = filtered[cursor];
    if (!a) return;
    close();
    try { a.run(); } catch (e) { console.warn(e); }
  };

  input.addEventListener('input', () => filter(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { cursor = Math.min(cursor + 1, filtered.length - 1); render(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cursor = Math.max(cursor - 1, 0); render(); e.preventDefault(); }
    else if (e.key === 'Enter') { execute(); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); e.preventDefault(); }
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      overlay.classList.contains('hidden') ? open() : close();
    }
  });

  // Hint Ctrl+K
  const hint = document.createElement('div');
  hint.className = 'fixed bottom-3 left-3 text-xs text-slate-500 bg-slate-900/70 px-2 py-1 rounded-lg border border-slate-700 select-none pointer-events-none';
  hint.innerHTML = 'Ctrl+K <span class="text-slate-400">palette</span>';
  document.body.appendChild(hint);
}

/* ============================================================
   PRESET RENDERER (anti double-load, debounce)
   ============================================================ */
function setupPresetRenderer() {
  const container = document.getElementById('presetList');
  if (!container) {
    console.warn('[Presets] #presetList tidak ditemukan.');
    return;
  }

  let loading = false;
  let lastLoadedAt = 0;

  const render = (store) => {
    const keys = Object.keys(store);
    if (keys.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-500 italic px-2">Belum ada preset.</div>';
      return;
    }
    container.innerHTML = keys.map(name => `
      <div class="preset-item">
        <span class="text-slate-200">${name}</span>
        <div class="flex gap-1">
          <button data-action="load" data-name="${name}"
            class="bg-cyan-500/30 hover:bg-cyan-500/50 text-cyan-200">Load</button>
          <button data-action="del" data-name="${name}"
            class="bg-rose-500/30 hover:bg-rose-500/50 text-rose-200">×</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('button[data-action="load"]').forEach(btn => {
      btn.addEventListener('click', () => applyPreset(store[btn.dataset.name]));
    });
    container.querySelectorAll('button[data-action="del"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const r = await fetch(`/api/presets/${encodeURIComponent(btn.dataset.name)}`, { method: 'DELETE' });
        if (r.ok) load(true);
        else alert('Preset default tidak dapat dihapus.');
      });
    });
  };

  const applyPreset = (p) => {
    if (!p) return;
    ['omega_m','omega_lambda','omega_s','omega_a','regulation','ethics','coupling','c0']
      .forEach(k => {
        if (p[k] === undefined) return;
        const el = document.getElementById(k);
        if (el) {
          el.value = p[k];
          const lbl = document.getElementById(k + 'Val');
          if (lbl) lbl.textContent = p[k];
        }
      });
    if (p.topology) {
      const s = document.getElementById('topology');
      if (s) { s.value = p.topology; s.dispatchEvent(new Event('change')); }
    }
    if (p.adaptive !== undefined) {
      const c = document.getElementById('adaptive');
      if (c) { c.checked = p.adaptive; c.dispatchEvent(new Event('change')); }
    }
    if (window.AETHERIS?.sendNow) window.AETHERIS.sendNow();
  };

  const load = async (force = false) => {
    // Debounce: jangan load ulang dalam 500ms kecuali dipaksa
    const now = Date.now();
    if (!force && now - lastLoadedAt < 500) return;
    if (loading) return;
    loading = true;
    try {
      const r = await fetch('/api/presets');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      render(data);
      lastLoadedAt = Date.now();
      console.log('[Presets] loaded:', Object.keys(data).length, 'items');
    } catch (e) {
      console.warn('[Presets] load gagal:', e.message);
      container.innerHTML = `<div class="text-xs text-rose-400 px-2">Gagal load preset: ${e.message}</div>`;
    } finally {
      loading = false;
    }
  };

  // Save button
  const saveBtn = document.getElementById('presetSave');
  const nameInput = document.getElementById('presetName');
  if (saveBtn && nameInput) {
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { alert('Masukkan nama preset.'); return; }
      const params = {};
      ['omega_m','omega_lambda','omega_s','omega_a','regulation','ethics','coupling','c0']
        .forEach(k => {
          const el = document.getElementById(k);
          if (el) params[k] = parseFloat(el.value);
        });
      params.topology = document.getElementById('topology')?.value || 'random';
      params.adaptive = document.getElementById('adaptive')?.checked ?? true;

      const r = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, params }),
      });
      if (r.ok) {
        nameInput.value = '';
        load(true);
      } else {
        const err = await r.json().catch(() => ({}));
        alert('Gagal simpan: ' + (err.detail || r.status));
      }
    });
  }

  // Initial load
  load(true);

  // Refresh pas tab Presets diklik (debounced)
  const presetTab = document.querySelector('.tab[data-tab="presets"]');
  if (presetTab) presetTab.addEventListener('click', () => load(false));

  // Expose untuk konsol
  window.AETHERIS = window.AETHERIS || {};
  window.AETHERIS.reloadPresets = () => load(true);
}

/* ============================================================
   HELPERS
   ============================================================ */
function clickTab(name) {
  document.querySelector(`.tab[data-tab="${name}"]`)?.click();
}
function toggleChk(id) {
  const c = document.getElementById(id);
  if (c) { c.checked = !c.checked; c.dispatchEvent(new Event('change')); }
}
function setSelect(id, val) {
  const s = document.getElementById(id);
  if (s) { s.value = val; s.dispatchEvent(new Event('change')); }
}