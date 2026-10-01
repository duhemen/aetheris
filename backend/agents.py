import numpy as np


def build_network(n: int, topology: str = "random", seed: int = 42):
    """Return (W, W_norm) adjacency matrix for n agents."""
    rng = np.random.default_rng(seed)
    W = np.zeros((n, n), dtype=float)

    if topology == "ring":
        for i in range(n):
            W[i, (i + 1) % n] = 1.0
            W[(i + 1) % n, i] = 1.0
    elif topology == "star":
        for i in range(1, n):
            W[0, i] = W[i, 0] = 1.0
    elif topology == "full":
        W = np.ones((n, n)) - np.eye(n)
    else:  # random
        p = 0.25
        for i in range(n):
            for j in range(i + 1, n):
                if rng.random() < p:
                    W[i, j] = W[j, i] = 1.0

    row_sum = W.sum(axis=1, keepdims=True)
    row_sum[row_sum == 0] = 1.0
    W_norm = W / row_sum
    return W, W_norm


def fibonacci_sphere(n: int, radius: float = 3.0):
    """Distribute n points on a sphere (for 3D layout)."""
    points = []
    phi = np.pi * (3.0 - np.sqrt(5.0))
    for i in range(n):
        y = 1 - (i / max(n - 1, 1)) * 2
        r = np.sqrt(max(0.0, 1 - y * y))
        theta = phi * i
        x = np.cos(theta) * r
        z = np.sin(theta) * r
        points.append([x * radius, y * radius, z * radius])
    return points


def edges_from_adjacency(W):
    """Return list of edges [i, j] from adjacency matrix."""
    edges = []
    n = W.shape[0]
    for i in range(n):
        for j in range(i + 1, n):
            if W[i, j] > 0:
                edges.append([i, j])
    return edges

def rewiring_step(W, C_t, rng, threshold=0.35):
    """
    Edge rewiring adaptif.
    - Agen dengan gap besar (>threshold) → putus edge (isolasi)
    - Agen dengan gap kecil → perkuat edge (rewire)
    """
    n = W.shape[0]
    W_new = W.copy()
    diffs = np.abs(C_t[:, None] - C_t[None, :])

    for i in range(n):
        for j in range(i + 1, n):
            d = diffs[i, j]
            if d > threshold and W[i, j] > 0:
                # terlalu jauh → putus
                if rng.random() < 0.3:
                    W_new[i, j] = W_new[j, i] = 0.0
            elif d < threshold * 0.5 and W[i, j] == 0:
                # terlalu dekat → sambungkan
                if rng.random() < 0.2:
                    W_new[i, j] = W_new[j, i] = 1.0

    # jaga minimal 1 edge per node (anti isolasi total)
    for i in range(n):
        if W_new[i].sum() == 0:
            j = rng.integers(0, n)
            while j == i:
                j = rng.integers(0, n)
            W_new[i, j] = W_new[j, i] = 1.0

    row = W_new.sum(axis=1, keepdims=True)
    row[row == 0] = 1.0
    return W_new, W_new / row


def reward_signal(balance, c_var):
    """Reward untuk RL-like adaptation."""
    return balance - 0.5 * c_var