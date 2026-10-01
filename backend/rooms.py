import time
import uuid
import hashlib
import secrets
from typing import Dict, List, Optional
from fastapi import WebSocket

from . import persistence as db


class Room:
    def __init__(self, room_id: str):
        self.id = room_id
        self.clients: Dict[WebSocket, dict] = {}
        self.created_at = time.time()
        self.max_messages = 200
        # WebRTC: daftar user yang aktif di voice
        self.voice_users: set = set()
        # Admin (v10)
        self.owner_id: Optional[str] = None
        self.banned_users: set = set()
        self.muted_users: set = set()
        self.muted_all: bool = False

    # ---------- membership ----------
    def add(self, ws, user_id: str, nickname: str, color: str,
            avatar: str = "", provider: str = "guest"):
        self.clients[ws] = {
            "user_id": user_id,
            "nickname": nickname,
            "color": color,
            "avatar": avatar,
            "provider": provider,
            "joined_at": time.time(),
            "in_voice": False,
        }

    def remove(self, ws: WebSocket) -> Optional[dict]:
        c = self.clients.pop(ws, None)
        if c:
            self.voice_users.discard(c["user_id"])
        return c

    def users(self) -> List[dict]:
        return [
            {
                "user_id": c["user_id"],
                "nickname": c["nickname"],
                "color": c["color"],
                "avatar": c.get("avatar", ""),
                "provider": c.get("provider", "guest"),
                "in_voice": c.get("in_voice", False),
                "is_muted": c["user_id"] in self.muted_users,
                "is_owner": c["user_id"] == self.owner_id,
            }
            for c in self.clients.values()
        ]

    def size(self) -> int:
        return len(self.clients)

    def voice_user_ids(self) -> List[str]:
        return list(self.voice_users)

    # ---------- Admin (v10) ----------
    def is_admin(self, user_id: str) -> bool:
        return self.owner_id is not None and user_id == self.owner_id

    def set_owner(self, user_id: str):
        if not self.owner_id:
            self.owner_id = user_id

    def can_speak(self, user_id: str) -> bool:
        """Cek apakah user boleh kirim chat."""
        if user_id in self.muted_users:
            return False
        if self.muted_all and not self.is_admin(user_id):
            return False
        return True

    def can_voice(self, user_id: str) -> bool:
        """Cek apakah user boleh join voice."""
        if user_id in self.muted_users:
            return False
        if self.muted_all and not self.is_admin(user_id):
            return False
        return True


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}

    def get_or_create(self, room_id: str) -> Room:
        if room_id not in self.rooms:
            self.rooms[room_id] = Room(room_id)
            # ensure DB row exists (public default)
            info = db.get_room(room_id)
            if not info:
                db.upsert_room(room_id, is_private=False)
            else:
                # restore owner dari DB
                if info.get("created_by"):
                    self.rooms[room_id].set_owner(info["created_by"])
        return self.rooms[room_id]

    def get(self, room_id: str) -> Optional[Room]:
        return self.rooms.get(room_id)

    async def broadcast(self, room_id: str, payload: dict, exclude: WebSocket = None):
        room = self.rooms.get(room_id)
        if not room:
            return
        dead = []
        for ws in list(room.clients.keys()):
            if ws is exclude:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for d in dead:
            room.remove(d)

    async def broadcast_to_users(self, room_id: str, user_ids: List[str],
                                  payload: dict, exclude_user: str = None):
        room = self.rooms.get(room_id)
        if not room:
            return
        dead = []
        for ws, meta in list(room.clients.items()):
            if meta["user_id"] not in user_ids:
                continue
            if exclude_user and meta["user_id"] == exclude_user:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for d in dead:
            room.remove(d)

    def cleanup_empty(self):
        empty = [rid for rid, r in self.rooms.items() if r.size() == 0]
        for rid in empty:
            del self.rooms[rid]

    def stats(self) -> dict:
        return {
            "rooms": len(self.rooms),
            "total_users": sum(r.size() for r in self.rooms.values()),
            "details": [
                {"id": rid, "users": r.size(),
                 "voice_users": len(r.voice_users),
                 "muted_all": r.muted_all,
                 "banned": len(r.banned_users)}
                for rid, r in self.rooms.items()
            ],
        }

    def new_user_id(self) -> str:
        return uuid.uuid4().hex[:8]


# ============================================================
# PRIVATE ROOM helpers
# ============================================================
def hash_password(pw: str) -> str:
    salt = secrets.token_hex(8)
    h = hashlib.sha256((salt + pw).encode()).hexdigest()
    return f"{salt}${h}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        salt, h = stored.split("$", 1)
    except Exception:
        return False
    return hashlib.sha256((salt + pw).encode()).hexdigest() == h


def new_invite_code() -> str:
    return secrets.token_urlsafe(12)[:16]


def create_private_room(room_id: str, password: str = "",
                        invite_code: str = "", max_users: int = 30,
                        topic: str = "", created_by: str = "") -> dict:
    pw_hash = hash_password(password) if password else None
    code = invite_code or new_invite_code()
    db.upsert_room(room_id, is_private=True, password_hash=pw_hash,
                   invite_code=code, max_users=max_users, topic=topic,
                   created_by=created_by)
    # set owner langsung di cache
    room = room_manager.get_or_create(room_id)
    if created_by:
        room.owner_id = created_by
    return {
        "room_id": room_id,
        "invite_code": code,
        "has_password": bool(password),
        "max_users": max_users,
        "topic": topic,
        "created_by": created_by,
    }


def check_room_access(room_id: str, password: str = "",
                      invite_code: str = "", is_authenticated: bool = False) -> tuple:
    """
    Return (allowed: bool, reason: str, requires_password: bool)
    """
    info = db.get_room(room_id)
    if not info:
        return True, "public", False

    if not info.get("is_private"):
        return True, "public", False

    # Private room
    if invite_code and info.get("invite_code") == invite_code:
        return True, "invite_code", False

    if info.get("password_hash"):
        if is_authenticated and not password and not invite_code:
            return False, "password_required", True
        if password and verify_password(password, info["password_hash"]):
            return True, "password_ok", False
        return False, "wrong_password", True

    return False, "access_denied", False


room_manager = RoomManager()