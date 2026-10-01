import numpy as np

from .agents import (
    build_network,
    fibonacci_sphere,
    edges_from_adjacency,
    rewiring_step,
    reward_signal,
)


def simulate(req):
    # ---------- Kosmologi ----------
    omega_m, omega_lambda, omega_r = req.omega_m, req.omega_lambda, 9e-5
    h0_eff = req.h0 / 1000.0

    # ---------- AI Multi-Agen ----------
    n = req.n_agents
    omega_s, omega_a = req.omega_s, req.omega_a
    R, E = req.regulation, req.ethics
    coupling = req.coupling
    delta, K, K_R, c_max = 0.01, 1.0, 1.0, 5.0

    rng = np.random.default_rng(42)
    W, W_norm = build_network(n, req.topology, seed=42)
    c_init = np.clip(rng.normal(req.c0, req.c0 * 0.2, n), 1e-3, None)

    t = np.linspace(0.0, req.t_max, req.steps)
    dt = t[1] - t[0]

    y = np.concatenate([[1.0], c_init])
    rewire_interval = max(1, req.steps // 12)
    rewiring_events = []

    a_hist = [1.0]
    C_hist = [c_init.copy()]

    # ---------- Integrasi (Euler + adaptive rewiring) ----------
    for step in range(1, len(t)):
        aa = max(y[0], 1e-8)
        cc = np.maximum(y[1:], 1e-9)

        # Friedmann
        curvature = 1.0 - omega_m - omega_lambda - omega_r
        H2 = (
            omega_m * aa ** -3
            + omega_r * aa ** -4
            + omega_lambda
            + curvature * aa ** -2
        )
        da = aa * h0_eff * np.sqrt(max(H2, 0.0))

        # Multi-agent ODE
        growth = omega_s * cc / (1.0 + cc)
        ethical = omega_a * cc / (K + cc)
        regulation = R * cc / (K_R + cc)
        interaction = coupling * (W_norm @ cc - cc)
        ethics_field = E * cc * (1.0 - cc / c_max)
        dc = (
            cc * (growth - ethical - regulation - delta)
            + interaction
            + ethics_field
        )

        y = y + dt * np.concatenate([[da], dc])
        y[1:] = np.maximum(y[1:], 0.0)

        # Adaptive rewiring
        if req.adaptive and step % rewire_interval == 0:
            c_var = float(np.var(y[1:]))
            bal = 1.0 - min(1.0, c_var)
            reward = reward_signal(bal, c_var)
            if reward < 0.3:
                W, W_norm = rewiring_step(W, y[1:], rng)
                rewiring_events.append(int(step))

        a_hist.append(max(y[0], 0.0))
        C_hist.append(y[1:].copy())

    a = np.array(a_hist)
    C = np.array(C_hist)
    c_mean = C.mean(axis=1)
    c_end = float(c_mean[-1])
    c_growth = float(c_end / req.c0) if req.c0 > 0 else 0.0

    # ---------- Status Threshold ----------
    statuses = []
    if omega_lambda > omega_m:
        statuses.append({
            "type": "Balapan Kosmos",
            "level": "warning",
            "message": "Energi gelap mendominasi; ekspansi berakselerasi.",
        })
    else:
        statuses.append({
            "type": "Rem Kosmos",
            "level": "info",
            "message": "Materi mendominasi; ekspansi melambat.",
        })

    if omega_a > 0.75 and c_growth < 0.8:
        statuses.append({
            "type": "Paternalistic Collapse",
            "level": "danger",
            "message": "Node Malaikat terlalu dominan; AI terhambat.",
        })

    if omega_s > 0.75 and c_growth > 1.5:
        statuses.append({
            "type": "Krisis Manipulasi",
            "level": "danger",
            "message": "Node Setan terlalu dominan; AI berpotensi manipulatif.",
        })

    if R > 0.8 and c_end < 0.3:
        statuses.append({
            "type": "Over-Regulation Freeze",
            "level": "danger",
            "message": "Regulasi hukum membekukan inovasi AI.",
        })

    if req.adaptive and rewiring_events:
        statuses.append({
            "type": "Adaptive Rewiring",
            "level": "info",
            "message": f"Topologi berubah {len(rewiring_events)}× pada step {rewiring_events}.",
        })

    balance_cosmo = 1.0 - abs(omega_lambda - omega_m)
    balance_ai = 1.0 - abs(omega_s - omega_a)
    balance_gov = 1.0 - abs(R - E)
    c_var_end = float(np.var(C[-1]))
    balance = float(np.clip(
        (balance_cosmo + balance_ai + balance_gov - 0.3 * c_var_end) / 3.0,
        0.0, 1.0,
    ))

    if balance > 0.8:
        statuses.append({
            "type": "Equilibrium",
            "level": "success",
            "message": "Sistem stabil & terorganisasi.",
        })

    return {
        "t": t.tolist(),
        "a": a.tolist(),
        "c_mean": c_mean.tolist(),
        "c_agents": C.tolist(),
        "positions": fibonacci_sphere(n, 3.0),
        "edges": edges_from_adjacency(W),
        "rewiring_events": rewiring_events,
        "statuses": statuses,
        "metrics": {
            "a_end": float(a[-1]),
            "c_end": c_end,
            "c_growth": c_growth,
            "balance": balance,
            "n_agents": n,
            "rewires": len(rewiring_events),
        },
    }


def downsample(result, max_points=180):
    t = result["t"]
    n = len(t)
    if n <= max_points:
        return result
    idx = np.linspace(0, n - 1, max_points).astype(int)
    out = dict(result)
    out["t"] = [t[i] for i in idx]
    out["a"] = [result["a"][i] for i in idx]
    out["c_mean"] = [result["c_mean"][i] for i in idx]
    out["c_agents"] = [result["c_agents"][i] for i in idx]
    return out