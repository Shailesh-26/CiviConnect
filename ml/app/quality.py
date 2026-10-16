"""Cheap photo-quality checks that run before the model: blur and darkness."""

import numpy as np
from PIL import Image

# Tuned on phone photos resized to 512 px: below these, the photo is hard to use.
BLUR_THRESHOLD = 60.0
DARK_THRESHOLD = 45.0


def sharpness(gray: np.ndarray) -> float:
    """Variance of the Laplacian. Sharp photos have strong edges, so a high variance."""
    g = gray.astype(np.float32)
    lap = (
        -4 * g[1:-1, 1:-1]
        + g[:-2, 1:-1]
        + g[2:, 1:-1]
        + g[1:-1, :-2]
        + g[1:-1, 2:]
    )
    return float(lap.var())


def check(image: Image.Image) -> dict:
    small = image.convert("L")
    small.thumbnail((512, 512))
    gray = np.asarray(small)
    sharp = sharpness(gray) if min(gray.shape) > 2 else 0.0
    bright = float(gray.mean())
    return {
        "sharpness": round(sharp, 1),
        "brightness": round(bright, 1),
        "blurry": sharp < BLUR_THRESHOLD,
        "dark": bright < DARK_THRESHOLD,
    }
