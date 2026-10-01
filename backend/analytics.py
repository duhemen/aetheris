import numpy as np

from .physics import simulate
from .main import SimulationRequest  # gunakan model yang sama


def sweep_2d(
    x_param: str,
    y_param: str,
    resolution: int = 15,
    base: dict = None,
    x_range=(0.0, 1.0),
    y_range=(0.0, 1.0),
):
    """
    Grid sweep 2 parameter, hitung balance index.
    Return: matrix, axis labels.
    """
    base = base or {}
    xs = np.linspace(x_range[0], x_range[1], resolution)
    ys = np.linspace(y_range[0], y_range[1], resolution)
    grid = np.zeros((resolution, resolution))

    # Pakai steps kecil untuk kecepatan
    fast_base = {**base, "steps": 120, "adaptive": False}

    for i, xv in enumerate(xs):
        for j, yv in enumerate(ys):
            kwargs = {**fast_base, x_param: float(xv), y_param: float(yv)}
            # Hindari pelanggaran constraint Friedmann
            if kwargs.get("omega_m", 0.3) + kwargs.get("omega_lambda", 0.7) > 1.0:
                grid[i, j] = 0.0
                continue
            try:
                req = SimulationRequest(**kwargs)
                result = simulate(req)
                grid[i, j] = result["metrics"]["balance"]
            except Exception:
                grid[i, j] = -1.0

    return {
        "x_param": x_param,
        "y_param": y_param,
        "x_values": xs.tolist(),
        "y_values": ys.tolist(),
        "grid": grid.tolist(),
        "resolution": resolution,
    }