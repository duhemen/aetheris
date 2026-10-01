import numpy as np


class RLTuner:
    """
    Evolutionary Strategy (ES-lite) untuk auto-tune:
    ΩS, ΩA, R, E → memaksimalkan balance index.
    """
    KEYS = ("omega_s", "omega_a", "regulation", "ethics")

    def __init__(self, seed: int = 0, sigma: float = 0.10, lr: float = 0.15):
        self.rng = np.random.default_rng(seed)
        self.sigma = sigma
        self.lr = lr
        self.best_reward = -np.inf
        self.best_params = None
        self.current = None
        self.last_proposal = None
        self.generation = 0
        self.history = []

    def reset(self, initial: dict):
        self.best_reward = -np.inf
        self.best_params = {k: float(initial[k]) for k in self.KEYS}
        self.current = dict(self.best_params)
        self.last_proposal = dict(self.best_params)
        self.generation = 0
        self.history = []

    def propose(self) -> dict:
        if self.current is None:
            raise RuntimeError("RLTuner belum di-reset.")
        noise = self.rng.normal(0, self.sigma, len(self.KEYS))
        proposal = {
            k: float(np.clip(self.current[k] + noise[i], 0.0, 1.0))
            for i, k in enumerate(self.KEYS)
        }
        self.last_proposal = proposal
        return proposal

    def feedback(self, reward: float) -> dict:
        """Terima reward dari simulasi terakhir, update policy, return proposal baru."""
        self.generation += 1
        improved = reward > self.best_reward

        if improved:
            # Simpan sebagai elite
            self.best_reward = reward
            self.best_params = dict(self.last_proposal)
            self.current = dict(self.last_proposal)
            # Kurangi noise (eksploitasi)
            self.sigma = max(0.02, self.sigma * 0.97)
        else:
            # Kembali ke elite + drift kecil (eksplorasi)
            drift = self.rng.normal(0, self.sigma * 0.5, len(self.KEYS))
            self.current = {
                k: float(np.clip(self.best_params[k] + drift[i], 0.0, 1.0))
                for i, k in enumerate(self.KEYS)
            }

        self.history.append({
            "gen": self.generation,
            "reward": float(reward),
            "best": float(self.best_reward),
            "sigma": float(self.sigma),
        })
        # Batasi history agar payload ringan
        if len(self.history) > 120:
            self.history = self.history[-120:]

        return self.propose()

    def snapshot(self) -> dict:
        return {
            "generation": self.generation,
            "best_reward": float(self.best_reward) if self.best_reward > -np.inf else None,
            "best_params": self.best_params,
            "sigma": float(self.sigma),
            "history": self.history,
        }