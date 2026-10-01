import os
import time
import secrets
import hashlib
from contextlib import asynccontextmanager

from . import persistence as db
from . import rooms as rooms_mod

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from .physics import simulate, downsample
from .rl_agent import RLTuner
from .redis_federation import redis_fed
from .rooms import room_manager
from . import presets as presets_store
from . import auth as auth_mod


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    db.cleanup_old_messages()
    await redis_fed.connect()
    yield
    await redis_fed.shutdown()


app = FastAPI(
    title="Aetheris: The Balance Engine",
    version="7.0.0",
    description="Cosmo-Cognitive Simulation Framework — Rooms + Auth + WebGPU",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)


# ============================================================
# Pydantic models
# ============================================================
class SimulationRequest(BaseModel):
    omega_m: float = Field(0.3, ge=0.0, le=1.0)
    omega_lambda: float = Field(0.7, ge=0.0, le=1.0)
    h0: float = Field(70.0, gt=0.0, le=200.0)
    omega_s: float = Field(0.5, ge=0.0, le=1.0)
    omega_a: float = Field(0.5, ge=0.0, le=1.0)
    c0: float = Field(0.1, gt=0.0, le=5.0)
    n_agents: int = Field(12, ge=2, le=40)
    topology: str = Field("random")
    coupling: float = Field(0.3, ge=0.0, le=2.0)
    regulation: float = Field(0.2, ge=0.0, le=1.0)
    ethics: float = Field(0.3, ge=0.0, le=1.0)
    t_max: float = Field(14.0, gt=0.0, le=100.0)
    steps: int = Field(400, ge=50, le=2000)
    adaptive: bool = Field(True)


class SweepRequest(BaseModel):
    x_param: str = Field("omega_s")
    y_param: str = Field("omega_a")
    resolution: int = Field(15, ge=8, le=30)
    base: dict = Field(default_factory=dict)
    x_range: tuple = (0.0, 1.0)
    y_range: tuple = (0.0, 1.0)


class PresetSave(BaseModel):
    name: str
    params: dict


# ============================================================
# Health & stats
# ============================================================
@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "Aetheris", "version": "7.0.0"}


@app.get("/api/federation/stats")
def fed_stats():
    return redis_fed.stats()


@app.get("/api/rooms/stats")
def rooms_stats():
    return room_manager.stats()


@app.get("/api/rl/federated")
def rl_federated():
    return redis_fed.global_elite or {}


# ============================================================
# Simulation & analytics
# ============================================================
@app.post("/api/simulate")
def run_simulation(req: SimulationRequest):
    if req.omega_m + req.omega_lambda > 1.0:
        raise HTTPException(422, "omega_m + omega_lambda harus <= 1.0")
    if req.topology not in ("ring", "star", "full", "random"):
        raise HTTPException(422, "topology tidak valid")
    return simulate(req)


@app.post("/api/analytics/sweep")
def analytics_sweep(req: SweepRequest):
    from .analytics import sweep_2d
    allowed = {"omega_m", "omega_lambda", "omega_s", "omega_a",
               "regulation", "ethics", "coupling", "c0"}
    if req.x_param not in allowed or req.y_param not in allowed:
        raise HTTPException(422, f"Param harus salah satu dari {allowed}")
    if req.x_param == req.y_param:
        raise HTTPException(422, "x_param dan y_param harus berbeda")
    return sweep_2d(req.x_param, req.y_param, req.resolution,
                    base=req.base, x_range=req.x_range, y_range=req.y_range)


# ============================================================
# Presets
# ============================================================
@app.get("/api/presets")
def api_list_presets():
    return presets_store.list_presets()


@app.post("/api/presets")
def api_save_preset(body: PresetSave):
    try:
        return presets_store.save_preset(body.name, body.params)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.delete("/api/presets/{name}")
def api_delete_preset(name: str):
    if not presets_store.delete_preset(name):
        raise HTTPException(403, "Preset default tidak dapat dihapus.")
    return {"deleted": name}


# ============================================================
# AUTH ROUTES (v7)
# ============================================================
@app.get("/auth/providers")
def auth_providers():
    return {
        "enabled": auth_mod.enabled_providers(),
        "public_url": auth_mod.PUBLIC_URL,
    }


@app.get("/auth/me")
def auth_me(request: Request):
    user = auth_mod.get_user_from_request(request)
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": user}


@app.get("/auth/{provider}/login")
def auth_login(provider: str):
    if provider not in auth_mod.PROVIDERS:
        raise HTTPException(404, "Provider tidak dikenal")
    if provider not in auth_mod.enabled_providers():
        raise HTTPException(503, f"Provider {provider} belum dikonfigurasi")
    state = secrets.token_urlsafe(16)
    url = auth_mod.build_authorize_url(provider, state)
    resp = RedirectResponse(url)
    resp.set_cookie("aetheris_state", state, max_age=600,
                    httponly=True, samesite="lax", path="/")
    return resp


@app.get("/auth/{provider}/callback")
async def auth_callback(provider: str, request: Request, code: str = "", state: str = ""):
    if provider not in auth_mod.PROVIDERS:
        raise HTTPException(404, "Provider tidak dikenal")

    saved_state = request.cookies.get("aetheris_state", "")
    if not saved_state or state != saved_state:
        raise HTTPException(400, "State tidak valid (CSRF)")

    if not code:
        raise HTTPException(400, "Missing code dari provider")

    token = await auth_mod.exchange_code(provider, code)
    if not token:
        raise HTTPException(400, "Gagal tukar code ke access_token")

    raw = await auth_mod.fetch_userinfo(provider, token)
    if not raw:
        raise HTTPException(400, "Gagal fetch userinfo")

    user = auth_mod.normalize_user(provider, raw)
    session_token = auth_mod.create_session(user)

    resp = RedirectResponse(f"{auth_mod.PUBLIC_URL}/?auth=ok")
    auth_mod.set_session_cookie(resp, session_token)
    resp.delete_cookie("aetheris_state", path="/")
    return resp


@app.post("/auth/logout")
def auth_logout():
    resp = Response(content='{"ok":true}', media_type="application/json")
    auth_mod.clear_session_cookie(resp)
    return resp

# ============================================================
# ROOMS API (v8 — Private + Persistence)
# ============================================================
class RoomCreateRequest(BaseModel):
    room_id: str = Field(..., min_length=3, max_length=40)
    password: str = Field("", max_length=64)
    max_users: int = Field(30, ge=2, le=200)
    topic: str = Field("", max_length=80)


@app.get("/api/rooms")
def api_list_rooms():
    return {"rooms": db.list_rooms()}


@app.post("/api/rooms/create")
def api_create_room(body: RoomCreateRequest, request: Request):
    user = auth_mod.get_user_from_request(request)
    # Cek room sudah ada
    existing = db.get_room(body.room_id)
    if existing and existing.get("is_private"):
        # sudah ada dan private
        raise HTTPException(409, "Room ID sudah dipakai.")
    # Buat private room
        # Tentukan identitas creator
    if user:
        creator_id = f"{user.get('provider', 'user')}:{user.get('id', '')}"[:32]
        creator_name = user.get("name", "User")
    else:
        creator_id = "guest"
        creator_name = "guest"

    result = rooms_mod.create_private_room(
        body.room_id,
        password=body.password,
        max_users=body.max_users,
        topic=body.topic,
        created_by=creator_id,
    )
    result["created_by_name"] = creator_name
    return result


@app.get("/api/rooms/{room_id}/info")
def api_room_info(room_id: str):
    info = db.get_room(room_id)
    if not info:
        return {"room_id": room_id, "exists": False, "is_private": False}
    return {
        "room_id": info["id"],
        "exists": True,
        "is_private": bool(info.get("is_private")),
        "has_password": bool(info.get("password_hash")),
        "max_users": info.get("max_users", 50),
        "topic": info.get("topic", ""),
    }


@app.get("/api/rooms/{room_id}/messages")
def api_room_messages(room_id: str, limit: int = 100):
    limit = max(1, min(500, limit))
    return {"messages": db.get_messages(room_id, limit)}

# ============================================================
# WEBSOCKET — Rooms + Simulation + Chat + Auth
# ============================================================
@app.websocket("/ws/simulate")
async def ws_simulate(ws: WebSocket):
    await ws.accept()

    # ---------- Cek auth dari cookie ----------
    auth_user = None
    try:
        token = ws.cookies.get(auth_mod.SESSION_COOKIE)
        if token:
            auth_user = auth_mod.read_session(token)
    except Exception:
        pass

    # ---------- First message = join ----------
    try:
        first = await ws.receive_json()
    except Exception:
        await ws.close()
        return

    legacy_sim = None
    if first.get("type") != "join":
        if "omega_m" in first or "omega_lambda" in first:
            # Client lama kirim simulate duluan
            room_id = "public"
            legacy_sim = first
            # Identitas default — akan di-override oleh auth jika ada
            user_id = room_manager.new_user_id()
            nickname = f"Legacy-{user_id[:4]}"
            color = "#94a3b8"
            avatar_url = ""
            provider = "guest"
        else:
            try:
                await ws.send_json({"error": "First message must be type=join or simulate"})
                await ws.close()
            except Exception:
                pass
            return
    else:
        room_id = str(first.get("room_id", "public"))[:40] or "public"
        user_id = str(first.get("user_id") or room_manager.new_user_id())[:16]
        nickname = str(first.get("nickname", f"Anon-{user_id[:4]}"))[:24]
        color = str(first.get("color", "#22d3ee"))[:9]

        # ── Private room access check ──
        invite_code = str(first.get("invite_code", ""))[:32]
        password = str(first.get("password", ""))[:64]
        allowed, reason, needs_pw = rooms_mod.check_room_access(
            room_id, password=password, invite_code=invite_code,
            is_authenticated=bool(auth_user),
        )
        if not allowed:
            try:
                await ws.send_json({
                    "type": "access_denied",
                    "reason": reason,
                    "requires_password": needs_pw,
                    "room_id": room_id,
                })
                await ws.close()
            except Exception:
                pass
            return
        avatar_url = ""
        provider = "guest"

    # ---------- Auth override (prioritas tertinggi) ----------
    if auth_user:
        user_id = f"{auth_user['provider']}:{auth_user['id']}"[:32]
        nickname = (auth_user.get("name") or "User")[:24]
        # warna deterministik dari hash user_id
        try:
            h = int(hashlib.md5(user_id.encode()).hexdigest()[:6], 16)
            color = f"hsl({h % 360}, 75%, 60%)"
        except Exception:
            color = "#22d3ee"
        avatar_url = (auth_user.get("avatar") or "")[:500]
        provider = auth_user.get("provider", "guest")

    # ---------- Join room ----------
    room = room_manager.get_or_create(room_id)
    room.add(ws, user_id, nickname, color, avatar=avatar_url, provider=provider)

    # Set owner kalau belum ada & user authenticated (atau guest pertama)
    room_obj = room_manager.get_or_create(room_id)
    if not room_obj.owner_id:
        room_obj.set_owner(user_id)

    # Cek ban
    if user_id in room_obj.banned_users:
        try:
            await ws.send_json({"type": "access_denied", "reason": "banned"})
            await ws.close()
        except Exception:
            pass
        return

    if hasattr(redis_fed, "add_client"):
        await redis_fed.add_client(ws)
    if hasattr(redis_fed, "add_rl_client"):
        await redis_fed.add_rl_client(ws)

    # Load chat history dari DB
    db_msgs = db.get_messages(room_id, limit=100)
    room_state = db.get_room_state(room_id)

    await ws.send_json({
        "type": "init",
        "room_id": room_id,
        "user_id": user_id,
        "nickname": nickname,
        "color": color,
        "avatar": avatar_url,
        "provider": provider,
        "auth": bool(auth_user),
        "users": room_obj.users(),
        "messages": db_msgs,
        "last_state": (room_state or {}).get("sim"),
        "voice_users": room_obj.voice_user_ids(),
        "is_private": bool((db.get_room(room_id) or {}).get("is_private")),
        # ── V: info admin ──
        "is_admin": room_obj.is_admin(user_id),
        "owner_id": room_obj.owner_id,
        "muted_all": room_obj.muted_all,
        "muted_users": list(room_obj.muted_users),
    })

    # ---------- Notify others ----------
    await room_manager.broadcast(room_id, {
        "type": "user_joined",
        "user": {
            "user_id": user_id,
            "nickname": nickname,
            "color": color,
            "avatar": avatar_url,
            "provider": provider,
        },
        "users": room.users(),
    }, exclude=ws)

    tuner: RLTuner | None = None
    last_reward = 0.0
    last_published_reward = -1.0

    try:
        while True:
            if legacy_sim is not None:
                msg = legacy_sim
                legacy_sim = None
            else:
                msg = await ws.receive_json()

            mtype = msg.get("type", "simulate")

            # ---------- WebRTC Voice Signaling (P) ----------
            if mtype == "voice_join":
                room_info = db.get_room(room_id) or {}
                if not room_info.get("is_private"):
                    await ws.send_json({
                        "type": "voice_error",
                        "message": "Voice hanya tersedia di Private Room.",
                    })
                    continue

                # ── Guard: mute ──
                room = room_manager.get_or_create(room_id)
                if not room.can_voice(user_id):
                    await ws.send_json({
                        "type": "voice_error",
                        "message": "Anda sedang di-mute oleh admin.",
                    })
                    continue

                meta = room.clients.get(ws)
                if meta:
                    meta["in_voice"] = True
                    room.voice_users.add(user_id)
                voice_list = room.voice_user_ids()
                await room_manager.broadcast(room_id, {
                    "type": "voice_joined",
                    "user": {
                        "user_id": user_id,
                        "nickname": nickname,
                        "color": color,
                    },
                    "voice_users": voice_list,
                })
                await ws.send_json({
                    "type": "voice_peers",
                    "voice_users": voice_list,
                })
                continue

            if mtype == "voice_leave":
                room = room_manager.get_or_create(room_id)
                meta = room.clients.get(ws)
                if meta:
                    meta["in_voice"] = False
                    room.voice_users.discard(user_id)
                await room_manager.broadcast(room_id, {
                    "type": "voice_left",
                    "user_id": user_id,
                    "voice_users": list(room.voice_users),
                })
                continue

            if mtype == "voice_signal":
                # Guard: voice hanya di private room
                room_info = db.get_room(room_id) or {}
                if not room_info.get("is_private"):
                    continue  # silent drop

                target_user = str(msg.get("to", ""))[:32]
                payload = msg.get("payload")
                if not target_user or not payload:
                    continue

                room = room_manager.get_or_create(room_id)

                # Guard: pengirim & target harus ada di voice_users
                if user_id not in room.voice_users or target_user not in room.voice_users:
                    continue

                await room_manager.broadcast_to_users(
                    room_id,
                    [target_user],
                    {
                        "type": "voice_signal",
                        "from": user_id,
                        "from_nick": nickname,
                        "payload": payload,
                    },
                )
                continue

            # ---------- Chat ----------
            if mtype == "chat":
                room = room_manager.get_or_create(room_id)
                # Guard: mute
                if not room.can_speak(user_id):
                    await ws.send_json({
                        "type": "chat_blocked",
                        "reason": "muted",
                    })
                    continue

                text = str(msg.get("text", ""))[:2000].strip()
                encrypted = msg.get("encrypted")

                if not text and not encrypted:
                    continue

                chat = {
                    "type": "chat",
                    "user_id": user_id,
                    "nickname": nickname,
                    "color": color,
                    "avatar": avatar_url,
                    "provider": provider,
                    "text": text,
                    "encrypted": encrypted,
                    "ts": time.time(),
                }
                room.add_message(chat)
                db.add_message(room_id, chat)
                await room_manager.broadcast(room_id, chat)
                continue

            # ---------- V: Admin actions ----------
            if mtype in ("admin_kick", "admin_ban", "admin_unban",
                         "admin_mute", "admin_unmute", "admin_mute_all",
                         "admin_transfer"):
                room = room_manager.get_or_create(room_id)
                if not room.is_admin(user_id):
                    await ws.send_json({"error": "Bukan admin room ini."})
                    continue

                target = str(msg.get("target", ""))[:32]

                if mtype == "admin_kick":
                    await room_manager.broadcast(room_id, {
                        "type": "kicked",
                        "target": target,
                        "by": nickname,
                    })
                    for c_ws, meta in list(room.clients.items()):
                        if meta["user_id"] == target:
                            try:
                                await c_ws.close()
                            except Exception:
                                pass
                    continue

                if mtype == "admin_ban":
                    room.banned_users.add(target)
                    room.muted_users.add(target)
                    await room_manager.broadcast(room_id, {
                        "type": "banned",
                        "target": target,
                        "by": nickname,
                    })
                    for c_ws, meta in list(room.clients.items()):
                        if meta["user_id"] == target:
                            try:
                                await c_ws.close()
                            except Exception:
                                pass
                    continue

                if mtype == "admin_unban":
                    room.banned_users.discard(target)
                    room.muted_users.discard(target)
                    await ws.send_json({"type": "admin_ack", "action": "unban", "target": target})
                    continue

                if mtype == "admin_mute":
                    room.muted_users.add(target)
                    await room_manager.broadcast(room_id, {
                        "type": "muted",
                        "target": target,
                        "by": nickname,
                    })
                    continue

                if mtype == "admin_unmute":
                    room.muted_users.discard(target)
                    await room_manager.broadcast(room_id, {
                        "type": "unmuted",
                        "target": target,
                    })
                    continue

                if mtype == "admin_mute_all":
                    room.muted_all = bool(msg.get("value", True))
                    await room_manager.broadcast(room_id, {
                        "type": "mute_all",
                        "value": room.muted_all,
                        "by": nickname,
                    })
                    continue

                if mtype == "admin_transfer":
                    if target not in [m["user_id"] for m in room.clients.values()]:
                        await ws.send_json({"error": "Target tidak ada di room."})
                        continue
                    room.owner_id = target
                    await room_manager.broadcast(room_id, {
                        "type": "owner_changed",
                        "new_owner": target,
                    })
                    continue

            # ---------- Ping ----------
            if mtype == "ping":
                await ws.send_json({"type": "pong", "ts": time.time()})
                continue

            # ---------- Simulate ----------
            payload = {k: v for k, v in msg.items() if k != "type"}
            broadcast = bool(payload.pop("broadcast", False))
            rl_on = bool(payload.pop("rl", False))
            share_rl = bool(payload.pop("share_rl", False))
            sync_room = bool(payload.pop("sync_room", False))
            for k in ("user_id", "nickname", "color", "room_id", "avatar", "provider"):
                payload.pop(k, None)

            try:
                req = SimulationRequest(**payload)
            except Exception as e:
                await ws.send_json({"error": f"payload invalid: {e}"})
                continue

            if req.omega_m + req.omega_lambda > 1.0:
                await ws.send_json({"error": "omega_m + omega_lambda > 1.0"})
                continue

            rl_snapshot = None
            if rl_on:
                if tuner is None:
                    tuner = RLTuner(seed=42)
                    tuner.reset({
                        "omega_s": req.omega_s,
                        "omega_a": req.omega_a,
                        "regulation": req.regulation,
                        "ethics": req.ethics,
                    })
                    proposal = tuner.propose()
                else:
                    proposal = tuner.feedback(reward=last_reward)
                req.omega_s = proposal["omega_s"]
                req.omega_a = proposal["omega_a"]
                req.regulation = proposal["regulation"]
                req.ethics = proposal["ethics"]

            try:
                result = simulate(req)
            except Exception as e:
                await ws.send_json({"error": str(e)})
                continue

            last_reward = float(result["metrics"]["balance"])
            if rl_on and tuner is not None:
                tuner.feedback(reward=last_reward)
                rl_snapshot = tuner.snapshot()
                if (share_rl and hasattr(redis_fed, "publish_rl")
                        and tuner.best_params
                        and tuner.best_reward > last_published_reward):
                    last_published_reward = tuner.best_reward
                    await redis_fed.publish_rl(
                        params=tuner.best_params,
                        reward=float(tuner.best_reward),
                        generation=int(tuner.generation),
                    )

            payload_out = downsample(result, 160)
            if rl_snapshot is not None:
                payload_out["rl"] = rl_snapshot

                # Persist last state untuk room (Q)
                try:
                    db.save_room_state(room_id, payload_out)
                except Exception:
                    pass

            # ---------- Routing ----------
            if broadcast:
                await redis_fed.publish(payload_out)
            elif sync_room and room.size() > 1:
                payload_out["_from_user"] = user_id
                payload_out["_from_nick"] = nickname
                await room_manager.broadcast(room_id, {
                    "type": "room_sync",
                    **payload_out,
                }, exclude=ws)
                await ws.send_json(payload_out)
            else:
                await ws.send_json(payload_out)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"error": str(e)})
        except Exception:
            pass
    finally:
        # Voice cleanup
        room = room_manager.get(room_id)
        if room:
            meta = room.clients.get(ws)
            if meta and meta.get("in_voice"):
                room.voice_users.discard(user_id)
                await room_manager.broadcast(room_id, {
                    "type": "voice_left",
                    "user_id": user_id,
                    "voice_users": list(room.voice_users),
                })
            room.remove(ws)

        if hasattr(redis_fed, "remove_client"):
            redis_fed.remove_client(ws)
        try:
            await room_manager.broadcast(room_id, {
                "type": "user_left",
                "user_id": user_id,
                "users": room.users() if room else [],
            })
        except Exception:
            pass
        room_manager.cleanup_empty()


# ============================================================
# Frontend + PWA serving
# ============================================================
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

    @app.get("/manifest.json")
    def manifest():
        return FileResponse(
            os.path.join(FRONTEND_DIR, "manifest.json"),
            media_type="application/manifest+json",
        )

    @app.get("/sw.js")
    def service_worker():
        resp = FileResponse(
            os.path.join(FRONTEND_DIR, "sw.js"),
            media_type="application/javascript",
        )
        resp.headers["Service-Worker-Allowed"] = "/"
        return resp