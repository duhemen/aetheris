import json
import os
from typing import Dict

PRESETS_FILE = os.getenv("PRESETS_FILE", "/data/presets.json")

DEFAULT_PRESETS: Dict[str, dict] = {
    "Equilibrium": {
        "omega_m": 0.3, "omega_lambda": 0.7,
        "omega_s": 0.45, "omega_a": 0.45,
        "regulation": 0.3, "ethics": 0.3,
        "coupling": 0.3, "c0": 0.1,
        "topology": "random", "adaptive": True,
    },
    "Krisis Manipulasi": {
        "omega_m": 0.3, "omega_lambda": 0.7,
        "omega_s": 0.9, "omega_a": 0.1,
        "regulation": 0.1, "ethics": 0.1,
        "coupling": 0.3, "c0": 0.1,
        "topology": "full", "adaptive": True,
    },
    "Paternalistic Collapse": {
        "omega_m": 0.5, "omega_lambda": 0.5,
        "omega_s": 0.1, "omega_a": 0.95,
        "regulation": 0.9, "ethics": 0.9,
        "coupling": 0.3, "c0": 0.1,
        "topology": "star", "adaptive": False,
    },
    "Balapan Kosmos": {
        "omega_m": 0.05, "omega_lambda": 0.95,
        "omega_s": 0.6, "omega_a": 0.4,
        "regulation": 0.2, "ethics": 0.3,
        "coupling": 0.5, "c0": 0.1,
        "topology": "ring", "adaptive": True,
    },
}


def _load_store() -> Dict:
    if os.path.exists(PRESETS_FILE):
        try:
            with open(PRESETS_FILE, "r") as f:
                store = json.load(f)
                # Selalu sertakan default
                for k, v in DEFAULT_PRESETS.items():
                    store.setdefault(k, v)
                return store
        except Exception:
            pass
    return dict(DEFAULT_PRESETS)


def _save_store(store: Dict):
    try:
        os.makedirs(os.path.dirname(PRESETS_FILE), exist_ok=True)
        with open(PRESETS_FILE, "w") as f:
            json.dump(store, f, indent=2)
    except Exception as e:
        print(f"[Presets] save failed: {e}")


def list_presets() -> Dict:
    return _load_store()


def save_preset(name: str, params: dict) -> dict:
    if not name or len(name) > 60:
        raise ValueError("Nama preset tidak valid.")
    store = _load_store()
    store[name] = params
    _save_store(store)
    return store[name]


def delete_preset(name: str) -> bool:
    if name in DEFAULT_PRESETS:
        return False
    store = _load_store()
    if name in store:
        del store[name]
        _save_store(store)
        return True
    return False