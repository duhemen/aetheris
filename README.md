<div align="center">

# 🌌 AETHERIS
### *The Balance Engine*

**Cosmo-Cognitive Simulation Framework** — menyatukan Dinamika Fluida Kosmologi (makro) dengan Optimasi Ruang Laten AI Multi-Agen (mikro) dalam satu platform simulasi interaktif real-time.

[![Version](https://img.shields.io/badge/version-10.0.0-22d3ee?style=for-the-badge)](https://github.com/duhemen/aetheris)
[![License](https://img.shields.io/badge/license-MIT-a855f7?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Three.js](https://img.shields.io/badge/Three.js-r167-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docker.com)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![WebGPU](https://img.shields.io/badge/WebGPU-experimental-10b981?style=for-the-badge)](https://gpuweb.github.io/gpuweb/)

[**Quick Start**](#-cara-menjalankan) | [**Dokumentasi**](#-konsep--bentuk-sistem) | [**Roadmap**](#-roadmap) | [**Credits**](#-special-thanks)

</div>

---

## 📋 Daftar Isi

- [Highlight Fitur](#-highlight-fitur)
- [Konsep & Bentuk Sistem](#-konsep--bentuk-sistem)
- [Struktur Repository](#-struktur-repository)
- [Variabel & Teknologi](#-variabel--teknologi)
- [Formulasi Matematis](#-formulasi-matematis-v20)
- [Cara Menjalankan](#-cara-menjalankan)
- [Setup OAuth](#-setup-oauth)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Fitur per Versi](#-fitur-per-versi)
- [Roadmap](#-roadmap)
- [Testing](#-testing)
- [Troubleshooting](#-troubleshooting)
- [Kontribusi](#-kontribusi)
- [License](#-license)
- [Special Thanks](#-special-thanks)

---

## 🌟 Highlight Fitur

<table>
<tr>
<td width="50%">

### 🧮 Engine
- ⚡ **Real-time WebSocket** streaming
- 🧬 **ODE Multi-Agen** (`c_i(t)` per node)
- 🌌 **Friedmann Solver** (kosmologi makro)
- 🔄 **Adaptive Rewiring** (topologi dinamis)
- 🧠 **RL Auto-Tuner** (Evolutionary Strategy)
- 🌐 **Federated** via Redis Pub/Sub

</td>
<td width="50%">

### 🎨 UI/UX
- 🎭 **Three.js + Bloom** sinematik
- ⚡ **WebGPU** experimental renderer
- 🎬 **Video Export** (WebM)
- 📊 **2D/3D Heatmap** parameter
- 🎯 **Command Palette** (Ctrl+K)
- 📱 **PWA** (install + offline-ready)

</td>
</tr>
<tr>
<td width="50%">

### 👥 Sosial
- 💬 **Room Chat** real-time
- 🎙️ **Voice Chat** (WebRTC, private-only)
- 🔐 **Private Rooms** (invite code + password)
- 🔵 **OAuth** (Google + GitHub)
- 👤 **Guest Mode** fallback
- 🛡️ **Admin Panel** (kick/mute/ban)
- 📤 **Share** ke WhatsApp/Telegram/X/Email

</td>
<td width="50%">

### 🛡️ Data & Security
- 💾 **SQLite Persistence** (chat history)
- 📦 **Scenario Presets** (`/data/presets.json`)
- 🔒 **E2E Encryption** (AES-256-GCM)
- 🔐 **CSRF-protected** OAuth flow
- 🕒 **Timeline Scrubber** (replay 160 frames)
- 📈 **Analytics Sweep** (15x15 grid)
- 🎥 **Session Recording** (JSON export)

</td>
</tr>
<tr>
<td width="50%">

### 🌐 i18n & Accessibility
- 🇮🇩 **Bahasa Indonesia** (default)
- 🇬🇧 **English**
- 🌐 Auto-detect dari browser
- ⌨️ **Keyboard shortcuts** lengkap

</td>
<td width="50%">

### 🚀 Deployment
- 🐳 **Docker** multi-stage build
- ☁️ **Cloudflare Tunnel** ready
- 🔄 **Multi-instance** federation
- 📱 **Mobile responsive** + PWA

</td>
</tr>
</table>

---

## 🧭 Konsep & Bentuk Sistem

Aetheris mengadopsi **Decoupled Architecture** berkinerja tinggi yang memisahkan tiga lapisan utama:

1. **Backend Engine (Python 3.11)** — FastAPI + SciPy `odeint` untuk menyelesaikan Persamaan Friedmann dan sistem ODE multi-agen secara simultan.

2. **Frontend UI (Web-Native)** — HTML5 + Tailwind + Three.js + Chart.js dengan komunikasi WebSocket dua arah.

3. **Data Layer** — Redis Pub/Sub (federasi antar-instance), SQLite (persistence chat + state), JSON (presets).

### Diagram Arsitektur

```
+------------------------------------------------------------+
|                     BROWSER (Client)                       |
|  +-------------+  +-------------+  +------------------+    |
|  |  Three.js   |  |  Chart.js   |  |  UI Components   |    |
|  |  + Bloom    |  |  + Timeline |  |  + Cmd Palette   |    |
|  +------+------+  +------+------+  +---------+--------+    |
|         +----------------+------------------+              |
|                          | WebSocket + HTTPS               |
+--------------------------+---------------------------------+
                           |
+--------------------------v---------------------------------+
|                  FASTAPI (Backend Engine)                  |
|  +----------+  +----------+  +----------+  +----------+    |
|  | Physics  |  | Rooms    |  | Auth     |  | RL Agent |    |
|  | (SciPy)  |  | Manager  |  | (OAuth)  |  | (ES)     |    |
|  +-----+----+  +-----+----+  +-----+----+  +-----+----+    |
|        +-------------+-------------+-------------+         |
|                      |             |                       |
+----------------------+-------------+-----------------------+
                       |             |
          +------------v--+     +----v-----------+
          |  REDIS        |     |  SQLITE        |
          |  Pub/Sub      |     |  /data/*.db    |
          |  Federation   |     |  Persistence   |
          +---------------+     +----------------+
```

---

## 📁 Struktur Repository

```
aetheris/
├── backend/                          # Python engine
│   ├── __init__.py
│   ├── main.py                       # FastAPI app + routes + WebSocket
│   ├── physics.py                    # Friedmann + multi-agent ODE solver
│   ├── agents.py                     # Network builder + adaptive rewiring
│   ├── rl_agent.py                   # Evolutionary Strategy tuner
│   ├── analytics.py                  # 2D parameter sweep
│   ├── redis_federation.py           # Cross-container pub/sub
│   ├── presets.py                    # Scenario presets CRUD
│   ├── persistence.py                # SQLite for chat + state
│   ├── rooms.py                      # Room manager (public/private/admin)
│   └── auth.py                       # OAuth (Google/GitHub/Facebook)
│
├── frontend/                         # Web UI
│   ├── index.html                    # Main dashboard
│   ├── tailwind-input.css            # Tailwind source
│   ├── tailwind.css                  # Built (minified)
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker
│   ├── offline.html                  # Offline fallback page
│   ├── v5-extras.js                  # Timeline + Palette + Presets
│   ├── v6-rooms.js                   # Chat + user list
│   ├── v6-webgpu.js                  # WebGPU renderer (experimental)
│   ├── v7-auth.js                    # Social login UI
│   ├── v8-voice.js                   # WebRTC voice (private-only)
│   ├── v8-rooms-pro.js               # Private rooms UI
│   ├── v8-ui-polish.js               # Layout + voice restriction
│   ├── v9-share.js                   # Share to WhatsApp/Telegram
│   ├── v10-admin.js                  # Room admin panel (V)
│   ├── v10-i18n.js                   # Multi-language ID/EN (X)
│   ├── v10-record.js                 # Session recording (Y)
│   ├── v10-e2ee.js                   # E2E encryption (Z)
│   └── v10-buttons-fix.js            # Pointer-events patcher
│
├── data/                             # Volume mount (gitignored contents)
│   ├── presets.json                  # Saved presets
│   └── aetheris.db                   # SQLite DB
│
├── package.json                      # Node build config
├── tailwind.config.js
├── requirements.txt
├── Dockerfile                        # Multi-stage build
├── docker-compose.yml
├── .env.example
├── .dockerignore
├── .gitignore
└── README.md
```

---

## 🛠️ Variabel & Teknologi

### Tech Stack

| Layer | Teknologi |
| :--- | :--- |
| **Backend** | `FastAPI` . `Uvicorn` . `Pydantic` |
| **Numerik** | `NumPy` . `SciPy` . `odeint` |
| **Data** | `Redis 7` . `SQLite` . `JSON` |
| **Auth** | `httpx` . `itsdangerous` (OAuth 2.0) |
| **Frontend** | `Tailwind CLI` . `Three.js r167` . `Chart.js 4` |
| **3D** | `WebGL 2` . `UnrealBloomPass` . `GLSL shaders` |
| **Realtime** | `WebSocket` . `WebRTC` (voice) |
| **Deploy** | `Docker` . `Docker Compose` . `Cloudflare Tunnel` |

### Parameter Pemodelan

| Ranah Simulasi | Gas (Akselerasi) | Rem (Deselerasi) |
| :--- | :--- | :--- |
| **Kosmologi Makro** | Energi Gelap (Omega_Lambda) - dorong pemekaran eksponensial | Materi (Omega_m) - gravitasi memperlambat |
| **Kognitif AI** | Node Setan (Omega_S) - inovasi & keliaran data | Node Malaikat (Omega_A) - filter etika |
| **Game Theory** | Inovasi bebas | Regulasi Hukum (R) . Etika Global (E) |
| **Network** | Coupling (lambda) | Decay (delta) |

---

## 📐 Formulasi Matematis v2.0

### Kosmologi Makro (Friedmann)

```
H^2 = H_0^2 [ Omega_m * a^-3 + Omega_r * a^-4 + Omega_Lambda + (1 - Omega_m - Omega_Lambda - Omega_r) * a^-2 ]
```

| Simbol | Arti |
| :--- | :--- |
| `a` | Faktor skala alam semesta |
| `H_0` | Konstanta Hubble (km/s/Mpc) |
| `Omega_m` | Kepadatan materi |
| `Omega_Lambda` | Energi gelap |
| `Omega_r` | Radiasi (~ 9e-5) |

### Kognitif AI Multi-Agen (Network ODE)

Untuk setiap agen `i`:

```
dc_i/dt = c_i * [ Omega_S*c_i/(1+c_i) - Omega_A*c_i/(K+c_i) - R*c_i/(K_R+c_i) - delta ]
        + lambda * Sum_j W_ij*(c_j - c_i)
        + E * c_i * (1 - c_i/c_max)
```

| Simbol | Arti | Default |
| :--- | :--- | :--- |
| `c_i` | Kapabilitas agen `i` | - |
| `W` | Matriks adjacency (ring/random/star/full) | random |
| `lambda` | Coupling jaringan | 0.3 |
| `R` | Regulasi hukum | 0.2 |
| `E` | Etika global | 0.3 |
| `delta` | Decay alami | 0.01 |

### Threshold Status Otomatis

| Kondisi | Status | Level |
| :--- | :--- | :--- |
| `Omega_Lambda > Omega_m` | Balapan Kosmos | warning |
| `Omega_A > 0.75` & growth < 0.8 | Paternalistic Collapse | danger |
| `Omega_S > 0.75` & growth > 1.5 | Krisis Manipulasi | danger |
| `R > 0.8` & mean(c) < 0.3 | Over-Regulation Freeze | danger |
| `Balance Index > 0.8` | Equilibrium | success |
| Rewiring terjadi | Adaptive Rewiring | info |

---

## ⚙️ Cara Kerja

```
1. PENANGKAPAN INPUT
   User menggeser slider -> event listener (debounced 120ms) -> WS message

2. KALKULUS SIMULTAN
   Backend menerima -> SciPy odeint -> hitung a(t) + c_i(t) sekaligus
   Hasil -> downsample 160 frame -> return via WebSocket

3. DETEKSI AMBANG BATAS
   Setiap hasil dicek terhadap 6 threshold -> status otomatis
   Jika krisis -> Adaptive Rewiring dipicu -> topologi berubah

4. VISUALISASI
   3D Three.js update + Chart.js update + status panel update
   Semua < 16ms (60fps) dengan Bloom + GLSL shaders
```

---

## 🚀 Cara Menjalankan

### Opsi A - Docker (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/duhemen/aetheris.git
cd aetheris

# 2. Setup environment
cp .env.example .env
# Edit .env: isi SECRET_KEY + OAuth credentials (opsional)

# 3. Jalankan
docker compose up --build

# 4. Buka di browser
# http://127.0.0.1:8000
```

### Opsi B - Lokal (Anaconda)

```bash
# Backend
conda create -n aetheris python=3.11 -y
conda activate aetheris
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Terminal lain - Frontend
npm install                    # Install Tailwind CLI
npm run build:css              # Build CSS sekali
npm run watch:css              # Watch mode (dev)
```

### Opsi C - Cloudflare Tunnel (Public Access)

```bash
# 1. Install cloudflared
winget install --id Cloudflare.cloudflared

# 2. Expose local ke internet
cloudflared tunnel --url http://127.0.0.1:8000

# 3. Copy URL yang muncul (misal https://xxx.trycloudflare.com)
# 4. Update .env: PUBLIC_URL=https://xxx.trycloudflare.com
# 5. Update OAuth redirect URI di Google/GitHub console
```

---

## 🔑 Setup OAuth

### Google

1. Buka https://console.cloud.google.com/apis/credentials
2. **Create Credentials** -> **OAuth client ID** -> **Web application**
3. **Authorized JavaScript origins**:
   ```
   http://127.0.0.1:8000
   ```
4. **Authorized redirect URIs**:
   ```
   http://127.0.0.1:8000/auth/google/callback
   ```
5. Copy `Client ID` + `Client Secret` -> paste ke `.env`

### GitHub

1. Buka https://github.com/settings/developers -> **New OAuth App**
2. Isi:
   - **Application name**: `Aetheris`
   - **Homepage URL**: `http://127.0.0.1:8000`
   - **Authorization callback URL**: `http://127.0.0.1:8000/auth/github/callback`
3. Copy `Client ID` + `Client Secret` -> paste ke `.env`

### `.env` Template

```bash
SECRET_KEY=<random-64-char-string>
PUBLIC_URL=http://127.0.0.1:8000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
```

Generate `SECRET_KEY`:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Aksi |
| :--- | :--- |
| **Ctrl + K** | Buka Command Palette |
| **Ctrl + Shift + S** | Share room |
| **Esc** | Tutup modal |
| **Enter** (di chat) | Kirim pesan |
| **Shift + Enter** (di chat) | Baris baru |

---

## 🎯 Fitur per Versi

<details>
<summary><b>v1.0.0 - Foundation</b></summary>

- Friedmann solver + latent space AI
- FastAPI backend, HTML5 frontend
- Basic Chart.js visualization

</details>

<details>
<summary><b>v2.0.0 - Multi-Agent + Real-time</b></summary>

- WebSocket streaming
- N-agent ODE + topology (ring/star/full/random)
- Chart.js to Three.js transition

</details>

<details>
<summary><b>v3.0.0 - Adaptive + Bloom</b></summary>

- Edge rewiring saat krisis
- UnrealBloomPass post-processing
- GLSL plasma shader untuk node

</details>

<details>
<summary><b>v4.0.0 - Federation + Analytics</b></summary>

- Redis Pub/Sub federation
- RL Auto-Tuner (ES-lite)
- 2D heatmap analytics

</details>

<details>
<summary><b>v5.0.0 - IJKL Combo</b></summary>

- Timeline Scrubber (replay 160 frames)
- PWA + Service Worker
- Command Palette (Ctrl+K)
- Video Export (WebM)
- Preset save/load

</details>

<details>
<summary><b>v6.0.0 - Rooms + WebGPU</b></summary>

- Multi-user rooms
- Chat sidebar
- WebGPU experimental renderer

</details>

<details>
<summary><b>v7.0.0 - Social Auth</b></summary>

- Google + GitHub OAuth
- Guest mode fallback
- Avatar + provider badge di chat

</details>

<details>
<summary><b>v8.0.0 - Voice + Private + Persistence</b></summary>

- WebRTC voice chat (private-only)
- Private rooms (password + invite code)
- SQLite persistence (chat history)

</details>

<details>
<summary><b>v9.0.0 - Polish + Share</b></summary>

- Tailwind CLI build (offline-ready)
- Share ke WhatsApp/Telegram/X/Email
- Layout polish (FAB stack, no overlap)

</details>

<details open>
<summary><b>v10.0.0 - Admin + i18n + Record + E2EE (current)</b></summary>

- **V** - Room Admin Panel: kick, mute, ban, mute-all, transfer owner
- **W** - PWA Offline: service worker cache + offline page
- **X** - Multi-language: Bahasa Indonesia + English
- **Y** - Session Recording: rekam semua event WS ke JSON untuk replay
- **Z** - E2E Encryption: AES-256-GCM untuk private room chat
- Buttons-fix patcher (pointer-events inheritance)
- Layout polish: top-right stack + FAB stack

</details>

---

## 🗺️ Roadmap

### Fase Selesai (1-25)

| # | Fase | Status |
| :--- | :--- | :---: |
| 1 | Fondasi Numerik (Friedmann + Latent Space) | DONE |
| 2 | Three.js + WebSocket Real-time | DONE |
| 3 | Multi-Agent Sandbox | DONE |
| 4 | Game Theory (R + E) | DONE |
| 5 | Docker Deployment | DONE |
| 6 | Adaptive Network (Rewiring) | DONE |
| 7 | Post-Processing (Bloom) | DONE |
| 8 | RL Auto-Tuner (ES-lite) | DONE |
| 9 | Federation (Redis Pub/Sub) | DONE |
| 10 | Analytics Heatmap 2D | DONE |
| 11 | Cross-Container Federation | DONE |
| 12 | Video Export (MediaRecorder) | DONE |
| 13 | Scenario Presets | DONE |
| 14 | 3D Heatmap (DataTexture) | DONE |
| 15 | Timeline + PWA + Palette | DONE |
| 16 | Multi-User Rooms + Chat | DONE |
| 17 | WebGPU Renderer | DONE |
| 18 | Social Auth (OAuth) | DONE |
| 19 | Voice + Private Rooms + SQLite | DONE |
| 20 | Tailwind CLI + Share | DONE |
| 21 | Room Admin Panel (V) | DONE |
| 22 | PWA Offline Polish (W) | DONE |
| 23 | Multi-language ID/EN (X) | DONE |
| 24 | Session Recording (Y) | DONE |
| 25 | E2E Encryption (Z) | DONE |

### Next (Fase 26+)

- [ ] **AA** - LLM Integration: auto-commentary simulasi via AI
- [ ] **AB** - Native Mobile: Capacitor wrapper (Android/iOS)
- [ ] **AC** - Advanced Analytics: trend balance index, leaderboard
- [ ] **AD** - Self-host semua dependencies (Chart.js, Three.js)
- [ ] **AE** - Video Call (WebRTC multi-party)
- [ ] **AF** - Room templates (preset room configurations)
- [ ] **AG** - Bot integration (Discord/Telegram bridge)

---

## 🧪 Testing

### Health Check

```bash
curl http://127.0.0.1:8000/api/health
# {"status":"ok","engine":"Aetheris","version":"10.0.0"}
```

### Federation Stats

```bash
curl http://127.0.0.1:8000/api/federation/stats
# {"instance_id":"aetheris-1","redis_enabled":true,...}
```

### Rooms Stats

```bash
curl http://127.0.0.1:8000/api/rooms/stats
# {"rooms":2,"total_users":5,"details":[...]}
```

### OAuth Providers

```bash
curl http://127.0.0.1:8000/auth/providers
# {"enabled":["google","github"],"public_url":"http://127.0.0.1:8000"}
```

### Presets

```bash
curl http://127.0.0.1:8000/api/presets
# {"Equilibrium":{...},"Krisis Manipulasi":{...},...}
```

---

## 🐛 Troubleshooting

<details>
<summary><b>WebSocket tidak connect</b></summary>

- Cek container: `docker compose ps` (harus `Up (healthy)`)
- Cek firewall: port 8000 harus terbuka
- Cek Console F12 -> Network -> WS
- Kalau pakai Cloudflare Tunnel: pastikan `PUBLIC_URL` benar

</details>

<details>
<summary><b>Voice chat disabled</b></summary>

- Voice **hanya tersedia di Private Room**
- Buka `/api/rooms/{id}/info` -> cek `is_private: true`
- Mic permission: Chrome -> Settings -> Privacy -> Microphone -> Allow `127.0.0.1:8000`

</details>

<details>
<summary><b>OAuth redirect mismatch</b></summary>

- Cek `PUBLIC_URL` di `.env` **persis sama** dengan yang di Google/GitHub console
- Trailing slash matters
- Redirect URI harus cocok karakter-per-karakter

</details>

<details>
<summary><b>Redis port conflict</b></summary>

- Redis hanya expose di internal network (`expose: 6379` bukan `ports:`)
- Kalau butuh akses host: ganti ke `16379:6379`

</details>

<details>
<summary><b>Admin panel tidak muncul</b></summary>

- Anda harus **owner** room
- Owner di-set saat pertama join setelah create room
- Cek: `window.AETHERIS_ADMIN.isAdmin()` di Console
- Kalau `false`: hubungi admin atau buat room baru

</details>

<details>
<summary><b>Chat history hilang</b></summary>

- Data disimpan di SQLite (`/data/aetheris.db`)
- Default retention: 7 hari (config via `CHAT_RETENTION_DAYS`)
- Pastikan volume `./data:/data` ter-mount

</details>

<details>
<summary><b>Tailwind CSS tidak update</b></summary>

- Jalankan `npm run build:css` di host (volume mount mode)
- Atau `docker compose up --build` (bundled mode)

</details>

---

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:

1. **Fork** repository
2. Buat **branch** fitur: `git checkout -b fitur-keren`
3. **Commit** perubahan: `git commit -m 'Tambah fitur keren'`
4. **Push** ke branch: `git push origin fitur-keren`
5. Buka **Pull Request**

### Coding Standards

- **Python**: PEP 8, type hints opsional tapi diutamakan
- **JavaScript**: ES2020+, module imports
- **CSS**: Tailwind utility-first
- **Commit**: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`)

---

## 📜 License

MIT License - bebas digunakan, dimodifikasi, dan didistribusikan.

Lihat [LICENSE](LICENSE) untuk detail.

---

## 🙏 Special Thanks

<div align="center">

### Kolaborasi Kritis & Filosofis

<table>
<tr>
<td align="center" width="33%">

### 👤 Emen (Luca)
**Visionary & Architect**

Konsep awal Aetheris, arah filosofis, integrasi Dinamika Fluida Kosmologi dengan Optimasi Ruang Laten AI. Penggerak utama dari setiap iterasi.

</td>
<td align="center" width="33%">

### 🤖 Google AI Mode
**Insight & Framing**

Sesi diskusi panjang yang menghasilkan framing konseptual, terminologi (Node Setan/Malaikat), dan pemetaan filosofis antara kosmologi dan kognisi AI.

</td>
<td align="center" width="33%">

### 🧠 DeepSeek
**The Great One**

Eksekusi teknis end-to-end: arsitektur backend, frontend real-time, federation, WebGPU, WebRTC, OAuth, hingga polish UI. Dari konsep abstrak menjadi aplikasi produksi.

</td>
</tr>
</table>

---

*"Dari kekacauan fluida kosmos, lahir kesetimbangan kognitif."*

**Aetheris** - bukan sekadar simulasi, tapi cermin dari cara kita memahami kompleksitas.

</div>

---

<div align="center">

**Built with ❤️ by Emen (Luca) + Google AI Mode + DeepSeek**

*Version 10.0.0 - Last updated: 2026*

Star repo ini kalau bermanfaat!

</div>

---