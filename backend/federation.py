import asyncio
import json
import os
from typing import Optional, Set, Callable

try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CHANNEL = "aetheris:broadcast"
RL_CHANNEL = "aetheris:rl"


class RedisFederation:
    def __init__(self):
        self.redis: Optional["aioredis.Redis"] = None
        self.pubsub = None
        self.local_clients: Set = set()
        self.rl_clients: Set = set()          # klien yang peduli update RL
        self.enabled = False
        self.instance_id = os.getenv("INSTANCE_ID", "aetheris-1")
        self._listener_task: Optional[asyncio.Task] = None
        self.received_count = 0
        self.sent_count = 0
        self.rl_received = 0
        self.rl_sent = 0
        self.global_elite: Optional[dict] = None   # elite params terbaik dari seluruh federasi

    async def connect(self):
        if not REDIS_AVAILABLE:
            print("[Fed] redis-py tidak tersedia; mode lokal.")
            return
        try:
            self.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
            await self.redis.ping()
            self.pubsub = self.redis.pubsub()
            await self.pubsub.subscribe(CHANNEL, RL_CHANNEL)
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
            try: await self.pubsub.close()
            except Exception: pass
        if self.redis:
            try: await self.redis.close()
            except Exception: pass

    async def _listen(self):
        try:
            async for msg in self.pubsub.listen():
                if msg.get("type") != "message":
                    continue
                ch = msg.get("channel")
                try:
                    payload = json.loads(msg["data"])
                except Exception:
                    continue
                if payload.get("_origin") == self.instance_id:
                    continue

                if ch == RL_CHANNEL:
                    self.rl_received += 1
                    # Update global elite kalau lebih baik
                    r = payload.get("reward", -1.0)
                    if self.global_elite is None or r > self.global_elite.get("reward", -1.0):
                        self.global_elite = payload
                    await self._fanout(self.rl_clients, {
                        "type": "rl_federated",
                        "instance": payload.get("_origin"),
                        "params": payload.get("params"),
                        "reward": r,
                        "generation": payload.get("generation"),
                    })
                else:
                    self.received_count += 1
                    await self._fanout(self.local_clients, payload)
        except asyncio.CancelledError:
            return
        except Exception as e:
            print(f"[Fed] listener stopped: {e}")

    async def _fanout(self, clients: Set, payload: dict):
        dead = []
        for ws in list(clients):
            try:
                await ws.send_json({**payload, "_federated": True})
            except Exception:
                dead.append(ws)
        for d in dead:
            clients.discard(d)

    # ------- Broadcast biasa -------
    async def publish(self, payload: dict):
        payload = {**payload, "_origin": self.instance_id}
        self.sent_count += 1
        if self.enabled and self.redis:
            try:
                await self.redis.publish(CHANNEL, json.dumps(payload))
                return
            except Exception:
                pass
        await self._fanout(self.local_clients, payload)

    # ------- Federated RL (I) -------
    async def publish_rl(self, params: dict, reward: float, generation: int):
        payload = {
            "_origin": self.instance_id,
            "params": params,
            "reward": float(reward),
            "generation": int(generation),
        }
        self.rl_sent += 1
        # Update lokal juga
        if self.global_elite is None or reward > self.global_elite.get("reward", -1.0):
            self.global_elite = payload
        if self.enabled and self.redis:
            try:
                await self.redis.publish(RL_CHANNEL, json.dumps(payload))
                return
            except Exception:
                pass
        await self._fanout(self.rl_clients, {
            "type": "rl_federated",
            "instance": self.instance_id,
            "params": params,
            "reward": float(reward),
            "generation": int(generation),
        })

    # ------- Klien WS -------
    async def add_client(self, ws):
        self.local_clients.add(ws)

    def remove_client(self, ws):
        self.local_clients.discard(ws)
        self.rl_clients.discard(ws)

    async def add_rl_client(self, ws):
        self.rl_clients.add(ws)
        # Kirim global elite terakhir (kalau ada)
        if self.global_elite:
            try:
                await ws.send_json({
                    "type": "rl_federated",
                    "instance": self.global_elite.get("_origin"),
                    "params": self.global_elite.get("params"),
                    "reward": self.global_elite.get("reward"),
                    "generation": self.global_elite.get("generation"),
                })
            except Exception:
                pass

    def stats(self) -> dict:
        return {
            "instance_id": self.instance_id,
            "redis_enabled": self.enabled,
            "local_clients": len(self.local_clients),
            "rl_clients": len(self.rl_clients),
            "received": self.received_count,
            "sent": self.sent_count,
            "rl_received": self.rl_received,
            "rl_sent": self.rl_sent,
            "global_elite": self.global_elite,
        }


redis_fed = RedisFederation()