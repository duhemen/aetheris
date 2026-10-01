/* ============================================================
   Aetheris v8 — WebRTC Voice Chat (rev2)
   - Hanya aktif di Private Room
   - Fix voice bar display (flex bukan hidden)
   - Handle voice_error dari server
   ============================================================ */

const waitReady = () => new Promise(res => {
  if (window.AETHERIS) return res(window.AETHERIS);
  window.addEventListener('aetheris-ready', () => res(window.AETHERIS), { once: true });
});

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

(async () => {
  const A = await waitReady();
  setupVoice(A);
})();

function setupVoice(A) {
  const state = {
    enabled: false,
    muted: false,
    localStream: null,
    peers: new Map(),
    audioEls: new Map(),
    identity: A.getIdentity?.() || {},
    selfId: null,
  };

  // ══════════════════════════════════════════════════════════
  // UI
  // ══════════════════════════════════════════════════════════
  const btn = document.createElement('button');
  btn.id = 'voiceBtn';
  btn.className = 'glass rounded-full w-12 h-12 flex items-center justify-center text-cyan-300 hover:text-cyan-100 transition';
  btn.title = 'Voice chat';
  btn.innerHTML = '🎙️';
  document.body.appendChild(btn);

  const voiceBar = document.createElement('div');
  voiceBar.id = 'voiceBar';
  voiceBar.className = 'glass rounded-xl px-3 py-2 text-xs items-center gap-3';
  voiceBar.style.display = 'none';
  voiceBar.innerHTML = `
    <span id="voiceStatus" class="text-slate-300">voice: off</span>
    <button id="muteBtn" class="btn-mini bg-slate-700 hover:bg-slate-600 text-white">🔊 Unmute</button>
    <button id="leaveVoice" class="btn-mini bg-rose-500/60 hover:bg-rose-500 text-white">Leave</button>
  `;
  document.body.appendChild(voiceBar);

  const statusEl = voiceBar.querySelector('#voiceStatus');
  const muteBtn = voiceBar.querySelector('#muteBtn');
  const leaveBtn = voiceBar.querySelector('#leaveVoice');

  // Show/hide helper (konsisten)
  const showVoiceBar = () => {
    voiceBar.style.display = 'flex';
  };
  const hideVoiceBar = () => {
    voiceBar.style.display = 'none';
  };

  // ══════════════════════════════════════════════════════════
  // Mic
  // ══════════════════════════════════════════════════════════
  async function initMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      state.localStream = stream;
      return true;
    } catch (e) {
      console.error('[Voice] Mic error:', e);
      alert('Tidak bisa akses mikrofon: ' + e.message);
      return false;
    }
  }

  // ══════════════════════════════════════════════════════════
  // Peer connection
  // ══════════════════════════════════════════════════════════
  function createPeer(remoteUserId, initiator) {
    if (state.peers.has(remoteUserId)) return state.peers.get(remoteUserId);

    const pc = new RTCPeerConnection(ICE_CONFIG);

    state.localStream.getTracks().forEach(track => {
      pc.addTrack(track, state.localStream);
    });

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        A.send({
          type: 'voice_signal',
          to: remoteUserId,
          payload: { type: 'ice', candidate: e.candidate },
        });
      }
    };

    pc.ontrack = (e) => {
      let audio = state.audioEls.get(remoteUserId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.dataset.uid = remoteUserId;
        document.body.appendChild(audio);
        state.audioEls.set(remoteUserId, audio);
      }
      audio.srcObject = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        closePeer(remoteUserId);
      }
    };

    state.peers.set(remoteUserId, pc);

    if (initiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          A.send({
            type: 'voice_signal',
            to: remoteUserId,
            payload: { type: 'offer', sdp: pc.localDescription },
          });
        } catch (e) {
          console.error('[Voice] Offer error:', e);
        }
      };
    }

    return pc;
  }

  function closePeer(uid) {
    const pc = state.peers.get(uid);
    if (pc) {
      try { pc.close(); } catch {}
      state.peers.delete(uid);
    }
    const audio = state.audioEls.get(uid);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      state.audioEls.delete(uid);
    }
  }

  // ══════════════════════════════════════════════════════════
  // Actions
  // ══════════════════════════════════════════════════════════
  async function joinVoice() {
    if (state.enabled) return;

    // ── Guard: hanya di private room ──
    if (window.__aetherisRoomIsPrivate !== true) {
      alert('🔒 Voice chat hanya tersedia di Private Room.\n\nBuka/Buat Private Room dulu (tombol kanan atas).');
      return;
    }

    const ok = await initMic();
    if (!ok) return;

    state.enabled = true;
    state.selfId = state.identity.user_id;
    showVoiceBar();
    btn.classList.add('ring-2', 'ring-rose-400');
    statusEl.textContent = 'voice: on';
    A.send({ type: 'voice_join' });
    console.log('[Voice] joined');
  }

  function leaveVoice() {
    if (!state.enabled) return;
    state.enabled = false;
    hideVoiceBar();
    btn.classList.remove('ring-2', 'ring-rose-400');
    A.send({ type: 'voice_leave' });
    for (const uid of Array.from(state.peers.keys())) {
      closePeer(uid);
    }
    if (state.localStream) {
      state.localStream.getTracks().forEach(t => t.stop());
      state.localStream = null;
    }
    console.log('[Voice] left');
  }

  function toggleMute() {
    if (!state.localStream) return;
    state.muted = !state.muted;
    state.localStream.getAudioTracks().forEach(t => { t.enabled = !state.muted; });
    muteBtn.textContent = state.muted ? '🔇 Muted' : '🔊 Unmute';
    muteBtn.className = state.muted
      ? 'btn-mini bg-rose-500/60 hover:bg-rose-500 text-white'
      : 'btn-mini bg-slate-700 hover:bg-slate-600 text-white';
  }

  // ══════════════════════════════════════════════════════════
  // Event handlers
  // ══════════════════════════════════════════════════════════
  btn.addEventListener('click', () => {
    state.enabled ? leaveVoice() : joinVoice();
  });
  leaveBtn.addEventListener('click', leaveVoice);
  muteBtn.addEventListener('click', toggleMute);

  // Auto-leave saat pindah room
  window.addEventListener('aetheris-room-changing', () => {
    if (state.enabled) leaveVoice();
  });

  // ══════════════════════════════════════════════════════════
  // WS Signaling
  // ══════════════════════════════════════════════════════════
  window.AETHERIS_EVENTS = window.AETHERIS_EVENTS || [];
  window.AETHERIS_EVENTS.push(async (msg) => {

    // ── Error dari server ──
    if (msg.type === 'voice_error') {
      console.warn('[Voice] Server error:', msg.message);
      alert('Voice: ' + (msg.message || 'Error'));
      if (state.enabled) leaveVoice();
      return;
    }

    // ── Signal lain hanya diproses kalau voice enabled ──
    if (!state.enabled) return;

    if (msg.type === 'voice_peers') {
      const others = (msg.voice_users || []).filter(u => u !== state.selfId);
      for (const uid of others) {
        createPeer(uid, true);
      }
    } else if (msg.type === 'voice_joined') {
      const uid = msg.user?.user_id;
      if (uid && uid !== state.selfId) {
        createPeer(uid, false);
      }
    } else if (msg.type === 'voice_left') {
      closePeer(msg.user_id);
    } else if (msg.type === 'voice_signal') {
      const from = msg.from;
      const payload = msg.payload;
      if (!from || from === state.selfId) return;

      const pc = state.peers.get(from) || createPeer(from, false);

      try {
        if (payload.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          A.send({
            type: 'voice_signal',
            to: from,
            payload: { type: 'answer', sdp: pc.localDescription },
          });
        } else if (payload.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } else if (payload.type === 'ice') {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.warn('[Voice] ICE add error:', e);
          }
        }
      } catch (e) {
        console.error('[Voice] Signal error:', e);
      }
    }
  });

  // Auto-leave saat tab close
  window.addEventListener('beforeunload', () => {
    if (state.enabled) A.send({ type: 'voice_leave' });
  });

  // ══════════════════════════════════════════════════════════
  // Expose
  // ══════════════════════════════════════════════════════════
  window.AETHERIS_VOICE = {
    isEnabled: () => state.enabled,
    isMuted: () => state.muted,
    join: joinVoice,
    leave: leaveVoice,
    toggleMute,
  };
}