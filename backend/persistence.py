import json
import os
import sqlite3
import time
from typing import List, Optional

DB_PATH = os.getenv("DB_PATH", "/data/aetheris.db")
CHAT_RETENTION_DAYS = int(os.getenv("CHAT_RETENTION_DAYS", "7"))


def _conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _conn() as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY,
                created_at REAL,
                is_private INTEGER DEFAULT 0,
                password_hash TEXT,
                invite_code TEXT,
                max_users INTEGER DEFAULT 50,
                topic TEXT DEFAULT '',
                created_by TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id TEXT,
                user_id TEXT,
                nickname TEXT,
                color TEXT,
                avatar TEXT,
                provider TEXT,
                text TEXT,
                encrypted TEXT,
                ts REAL,
                kind TEXT DEFAULT 'chat'
            );
            CREATE INDEX IF NOT EXISTS idx_messages_room_ts
                ON messages(room_id, ts DESC);
            CREATE TABLE IF NOT EXISTS room_state (
                room_id TEXT PRIMARY KEY,
                last_sim_json TEXT,
                updated_at REAL
            );
        """)

        # ── Auto-migration untuk DB lama ──
        for migration in [
            "ALTER TABLE rooms ADD COLUMN created_by TEXT DEFAULT ''",
            "ALTER TABLE messages ADD COLUMN encrypted TEXT",
        ]:
            try:
                c.execute(migration)
            except Exception:
                pass  # kolom sudah ada


# =========================
# ROOMS
# =========================
def upsert_room(room_id: str, is_private: bool = False,
                password_hash: Optional[str] = None,
                invite_code: Optional[str] = None,
                max_users: int = 50, topic: str = "",
                created_by: str = ""):
    with _conn() as c:
        c.execute("""
            INSERT INTO rooms (id, created_at, is_private, password_hash, invite_code, max_users, topic, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                is_private=excluded.is_private,
                password_hash=COALESCE(excluded.password_hash, rooms.password_hash),
                invite_code=COALESCE(excluded.invite_code, rooms.invite_code),
                max_users=excluded.max_users,
                topic=excluded.topic,
                created_by=COALESCE(excluded.created_by, rooms.created_by)
        """, (room_id, time.time(), 1 if is_private else 0,
              password_hash, invite_code, max_users, topic, created_by))


def get_room(room_id: str) -> Optional[dict]:
    with _conn() as c:
        row = c.execute("SELECT * FROM rooms WHERE id=?", (room_id,)).fetchone()
    return dict(row) if row else None


def list_rooms() -> List[dict]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM rooms ORDER BY created_at DESC LIMIT 100").fetchall()
    return [dict(r) for r in rows]


# =========================
# MESSAGES
# =========================
def add_message(room_id: str, msg: dict):
    with _conn() as c:
        c.execute("""
            INSERT INTO messages
            (room_id, user_id, nickname, color, avatar, provider, text, encrypted, ts, kind)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            room_id,
            msg.get("user_id", ""),
            msg.get("nickname", ""),
            msg.get("color", ""),
            msg.get("avatar", ""),
            msg.get("provider", "guest"),
            msg.get("text", ""),
            json.dumps(msg.get("encrypted")) if msg.get("encrypted") else None,
            msg.get("ts", time.time()),
            msg.get("kind", "chat"),
        ))


def get_messages(room_id: str, limit: int = 100) -> List[dict]:
    with _conn() as c:
        rows = c.execute("""
            SELECT * FROM messages
            WHERE room_id=? AND kind='chat'
            ORDER BY ts DESC LIMIT ?
        """, (room_id, limit)).fetchall()
    msgs = []
    for r in rows:
        m = dict(r)
        if m.get("encrypted"):
            try:
                m["encrypted"] = json.loads(m["encrypted"])
            except Exception:
                m["encrypted"] = None
        msgs.append(m)
    msgs.reverse()  # oldest first
    return msgs


def cleanup_old_messages():
    cutoff = time.time() - CHAT_RETENTION_DAYS * 86400
    with _conn() as c:
        c.execute("DELETE FROM messages WHERE ts < ? AND kind='chat'", (cutoff,))


# =========================
# ROOM STATE (last sim snapshot)
# =========================
def save_room_state(room_id: str, sim: dict):
    try:
        data = json.dumps(sim)[:200_000]  # limit 200KB
    except Exception:
        return
    with _conn() as c:
        c.execute("""
            INSERT INTO room_state (room_id, last_sim_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(room_id) DO UPDATE SET
                last_sim_json=excluded.last_sim_json,
                updated_at=excluded.updated_at
        """, (room_id, data, time.time()))


def get_room_state(room_id: str) -> Optional[dict]:
    with _conn() as c:
        row = c.execute("SELECT * FROM room_state WHERE room_id=?", (room_id,)).fetchone()
    if not row:
        return None
    try:
        return {
            "sim": json.loads(row["last_sim_json"]),
            "updated_at": row["updated_at"],
        }
    except Exception:
        return None