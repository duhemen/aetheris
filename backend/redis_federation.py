import asyncio
import json
import os
from typing import Optional, Set

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CHANNEL = "aetheris:broadcast"


class RedisFederation:
    """Federasi lintas-instance via Redis Pub/Sub, fallback in-memory kalau Redis mati."""

    def __init__(self):
        self.redis: Optional["aioredis.Redis"] = None
        self.pubsub = None
        self.local_clients: Set = set()
        self.enabled = False
        self.instance_id = os.getenv("INSTANCE_ID", "aetheris-1")
        self._listener_task: Optional[asyncio.Task] = None
        self.received_count = 0
        self.sent_count = 0

    async def connect(self):
        if not REDIS_AVAILABLE:
            print("[Fed] redis-py tidak tersedia; mode lokal.")
            return
        try:
            self.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            await self.redis.ping()
            self.pubsub = self.redis.pubsub()
            await self.pubsub.subscribe(CHANNEL)
            self.enabled = True
            self._listener_task = asyncio.create_task(self._listen())
            print(f"[Fed] Redis online @ {REDIS_URL} (id={self.instance_id})")
        except Exception as e:
            print(f"[Fed] Redis gagal ({e}); fallback lokal.")
            self.enabled = False

    async def shutdown(self):
        if self._listener_task:
            self._listener_task.cancel()
        if self.pubsub:
            try:
                await self.pubsub.close()
            except Exception:
                pass
        if self.redis:
            try:
                await self.redis.close()
            except Exception:
                pass

    async def _listen(self):
        try:
            async for msg in self.pubsub.listen():
                if msg.get("type") != "message":
                    continue
                try:
                    payload = json.loads(msg["data"])
                except Exception:
                    continue
                if payload.get("_origin") == self.instance_id:
                    continue
                self.received_count += 1
                await self._fanout_local(payload)
        except asyncio.CancelledError:
            return
        except Exception as e:
            print(f"[Fed] listener stopped: {e}")

    async def _fanout_local(self, payload: dict):
        dead = []
        for ws in list(self.local_clients):
            try:
                await ws.send_json({**payload, "_federated": True})
            except Exception:
                dead.append(ws)
        for d in dead:
            self.local_clients.discard(d)

    async def publish(self, payload: dict):
        payload = {**payload, "_origin": self.instance_id}
        self.sent_count += 1
        if self.enabled and self.redis:
            try:
                await self.redis.publish(CHANNEL, json.dumps(payload))
                return
            except Exception:
                pass
        await self._fanout_local(payload)

    async def add_client(self, ws):
        self.local_clients.add(ws)

    def remove_client(self, ws):
        self.local_clients.discard(ws)

    def stats(self) -> dict:
        return {
            "instance_id": self.instance_id,
            "redis_enabled": self.enabled,
            "local_clients": len(self.local_clients),
            "received": self.received_count,
            "sent": self.sent_count,
        }


redis_fed = RedisFederation()