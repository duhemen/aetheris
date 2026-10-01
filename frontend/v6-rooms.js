/* ============================================================
   Aetheris v6 — Rooms + Chat (rev2 — auth-aware)
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

(async () => {
  const A = await waitReady();
  setupRooms(A);
  setupWebGPUToggle();
})();

function setupRooms(A) {
  // ══════════════════════════════════════════════════════════
  // 1. Migrasi identitas lama: Anon-xxx → Guest-xxx
  // ══════════════════════════════════════════════════════════
  try {
    const id = JSON.parse(localStorage.getItem('aetheris-id') || '{}');
    if (id.nickname && id.nickname.startsWith('Anon-')) {
      id.nickname = id.nickname.replace('Anon-', 'Guest-');
      localStorage.setItem('aetheris-id', JSON.stringify(id));
      console.log('[Rooms] Migrated Anon → Guest:', id.nickname);
    }
  } catch (e) {
    console.warn('[Rooms] Migration skip:', e);
  }

  const chatToggle = document.getElementById('chatToggle');
  const chatPanel = document.getElementById('chatPanel');
  const chatClose = document.getElementById('chatClose');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  const chatMessages = document.getElementById('chatMessages');
  const userList = document.getElementById('userList');
  const roomName = document.getElementById('roomName');
  const roomLabel = document.getElementById('roomLabel');
  const userCount = document.getElementById('userCount');
  const usersInline = document.getElementById('usersInline');
  const copyRoom = document.getElementById('copyRoom');
  const unreadBadge = document.getElementById('chatUnread');

  let unread = 0;
  let chatOpen = false;
  let connected = false;

  roomName.textContent = A.getRoomId();
  roomLabel.textContent = A.getRoomId();

  // ══════════════════════════════════════════════════════════
  // 2. State koneksi — disable input sampai WS open
  // ══════════════════════════════════════════════════════════
  const setConnected = (on) => {
    connected = on;
    if (chatInput) {
      chatInput.disabled = !on;
      chatInput.placeholder = on ? 'Ketik pesan...' : 'Menunggu identitas...';
    }
    if (chatSend) {
      chatSend.disabled = !on;
      chatSend.classList.toggle('opacity-40', !on);
      chatSend.classList.toggle('cursor-not-allowed', !on);
    }
  };
  setConnected(false);

  // Kalau WS sudah open saat init
  if (A.ws?.readyState === WebSocket.OPEN) {
    setConnected(true);
  } else if (A.ws) {
    A.ws.addEventListener('open', () => setConnected(true));
  }

  // ══════════════════════════════════════════════════════════
  // 3. Chat UI
  // ══════════════════════════════════════════════════════════
  const openChat = () => {
    chatOpen = true;
    chatPanel.style.display = 'flex';
    unread = 0;
    updateUnread();
    if (connected) chatInput.focus();
  };
  const closeChat = () => {
    chatOpen = false;
    chatPanel.style.display = 'none';
  };

  chatToggle.addEventListener('click', () => chatOpen ? closeChat() : openChat());
  chatClose.addEventListener('click', closeChat);

  copyRoom.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(A.getRoomId())}`;
    try {
      await navigator.clipboard.writeText(url);
      copyRoom.textContent = '✅';
      setTimeout(() => copyRoom.textContent = '📋', 1200);
    } catch {
      prompt('Copy URL room:', url);
    }
  });

  const sendChat = () => {
    if (!connected) return;
    const text = chatInput.value.trim();
    if (!text) return;
    A.send({ type: 'chat', text });
    chatInput.value = '';
  };
  chatSend.addEventListener('click', sendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  // ══════════════════════════════════════════════════════════
  // 4. Render users
  // ══════════════════════════════════════════════════════════
  const renderUsers = (users) => {
    userCount.textContent = users.length;
    usersInline.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
    userList.innerHTML = users.map(u => {
      const isMe = u.user_id === A.getIdentity().user_id;
      const avatar = u.avatar
        ? `<img src="${u.avatar}" class="w-4 h-4 rounded-full" referrerpolicy="no-referrer" alt="">`
        : `<span class="w-4 h-4 rounded-full" style="background:${u.color || '#22d3ee'}"></span>`;
      const badge = u.provider && u.provider !== 'guest'
        ? `<span class="text-[9px] px-1 rounded bg-slate-700 text-slate-400">${escapeHtml(u.provider)}</span>`
        : '';
      return `
        <div class="flex items-center gap-2 px-1 py-0.5">
          ${avatar}
          <span class="text-slate-300 truncate">${escapeHtml(u.nickname)}</span>
          ${badge}
          ${isMe ? '<span class="text-xs text-cyan-400 ml-auto">(you)</span>' : ''}
        </div>
      `;
    }).join('');
  };

  const appendMessage = (m) => {
    const div = document.createElement('div');
    const isMe = m.user_id === A.getIdentity().user_id;
    const avatar = m.avatar
      ? `<img src="${m.avatar}" class="w-5 h-5 rounded-full inline-block mr-1" referrerpolicy="no-referrer" alt="">`
      : `<span class="w-2 h-2 rounded-full inline-block mr-1" style="background:${m.color || '#94a3b8'}"></span>`;
    div.className = 'flex flex-col gap-0.5';
    div.innerHTML = `
      <div class="text-xs flex items-center" style="color:${m.color || '#94a3b8'}">
        ${avatar}
        <strong>${escapeHtml(m.nickname)}</strong>
        <span class="text-slate-500 ml-2">${formatTs(m.ts)}</span>
      </div>
      <div class="text-slate-100 ${isMe ? 'text-right pr-1' : 'pl-1'}">${escapeHtml(m.text)}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (!chatOpen && !isMe) {
      unread++;
      updateUnread();
    }
  };

  const updateUnread = () => {
  if (unread > 0) {
    unreadBadge.textContent = unread > 99 ? '99+' : unread;
    unreadBadge.style.display = 'flex';
  } else {
    unreadBadge.style.display = 'none';
  }
};

  // ══════════════════════════════════════════════════════════
  // 5. Event bus dari WS
  // ══════════════════════════════════════════════════════════
  window.AETHERIS_EVENTS = window.AETHERIS_EVENTS || [];
  window.AETHERIS_EVENTS.push((msg) => {
    if (msg.type === 'init') {
      renderUsers(msg.users || []);
      // Clear old messages dulu (biar tidak duplikat kalau reconnect)
      chatMessages.innerHTML = '';
      (msg.messages || []).forEach(appendMessage);
      setConnected(true);
      roomLabel.textContent = msg.room_id || A.getRoomId();
      roomName.textContent = msg.room_id || A.getRoomId();

      // Update identitas lokal dari server (kalau server override — misal auth)
      if (msg.user_id && msg.nickname) {
        const currentId = A.getIdentity();
        if (currentId.user_id !== msg.user_id || currentId.nickname !== msg.nickname) {
          const newId = {
            user_id: msg.user_id,
            nickname: msg.nickname,
            color: msg.color || currentId.color,
          };
          localStorage.setItem('aetheris-id', JSON.stringify(newId));
          console.log('[Rooms] Identity updated from server:', newId.nickname);
        }
      }
    } else if (msg.type === 'chat') {
      appendMessage(msg);
    } else if (msg.type === 'user_joined') {
      renderUsers(msg.users || []);
      if (msg.user) {
        const div = document.createElement('div');
        div.className = 'text-xs text-slate-500 italic px-1';
        div.textContent = `→ ${msg.user.nickname} joined`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    } else if (msg.type === 'user_left') {
      renderUsers(msg.users || []);
    }
  });

  // ══════════════════════════════════════════════════════════
  // 6. Trigger koneksi saat identitas ready
  //    (event dipancarkan oleh v7-auth.js setelah user pilih Guest/Login)
  // ══════════════════════════════════════════════════════════
  window.addEventListener('aetheris-identity-ready', () => {
    // Karena index.html yang handle connectWS, di sini kita cuma update state
    if (A.ws?.readyState === WebSocket.OPEN) {
      setConnected(true);
    } else if (A.ws) {
      A.ws.addEventListener('open', () => setConnected(true), { once: true });
    }
  });

  // Kalau ternyata WS sudah open (fallback mode), langsung enable
  if (A.ws?.readyState === WebSocket.OPEN) {
    setConnected(true);
  }
}

/* ============================================================
   WebGPU toggle (tidak berubah)
   ============================================================ */
function setupWebGPUToggle() {
  const wrap = document.getElementById('webgpuToggleWrap');
  const cb = document.getElementById('webgpuOn');
  const status = document.getElementById('webgpuStatus');
  if (!wrap || !cb) return;

  wrap.classList.remove('hidden');

  (async () => {
    try {
      const mod = await import('/static/v6-webgpu.js');
      const ok = await mod.isWebGPUAvailable();
      if (ok) {
        status.textContent = '✅ WebGPU tersedia';
        status.className = 'text-xs text-emerald-400 mt-1';
        cb.disabled = false;
        cb.addEventListener('change', () => {
          window.dispatchEvent(new CustomEvent('aetheris-webgpu-toggle', {
            detail: { enabled: cb.checked }
          }));
        });
      } else {
        status.textContent = '❌ Browser tidak mendukung WebGPU';
        status.className = 'text-xs text-rose-400 mt-1';
        cb.disabled = true;
      }
    } catch (e) {
      status.textContent = '⚠️ Gagal load modul WebGPU: ' + e.message;
      status.className = 'text-xs text-amber-400 mt-1';
      cb.disabled = true;
    }
  })();
}

/* ---------- helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function formatTs(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}