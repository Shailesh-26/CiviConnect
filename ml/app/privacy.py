"""Privacy filter: finds faces in a photo and blurs them before the photo is stored.

Uses YuNet, a small face-detection neural network from the OpenCV Model Zoo (assets/, about 230 KB).
It runs on the CPU in a few tens of milliseconds.
"""

from __future__ import annotations

import io
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

MODEL = Path(__file__).resolve().parent.parent / "assets" / "face_detection_yunet_2023mar.onnx"
# Detection is done on a copy no larger than this; boxes are scaled back to the full photo.
DETECT_MAX_SIDE = 1280
# Only confident detections are blurred, so potholes and tree bark are left alone.
SCORE_THRESHOLD = 0.75


class FaceBlurrer:
    def __init__(self, model: Path = MODEL):
        self.detector = cv2.FaceDetectorYN.create(str(model), "", (320, 320), SCORE_THRESHOLD, 0.3, 5000)

    def faces(self, bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
        h, w = bgr.shape[:2]
        scale = min(1.0, DETECT_MAX_SIDE / max(h, w))
        small = cv2.resize(bgr, (round(w * scale), round(h * scale))) if scale < 1 else bgr
        self.detector.setInputSize((small.shape[1], small.shape[0]))
        _, found = self.detector.detect(small)
        boxes = []
        for row in found if found is not None else []:
            x, y, bw, bh = (row[:4] / scale).tolist()
            boxes.append((int(x), int(y), int(bw), int(bh)))
        return boxes


def blur_regions(bgr: np.ndarray, boxes: list[tuple[int, int, int, int]]) -> np.ndarray:
    """Pixelate then blur each face with a margin, so it cannot be recognised or sharpened back."""
    out = bgr.copy()
    h, w = out.shape[:2]
    for x, y, bw, bh in boxes:
        mx, my = int(bw * 0.25), int(bh * 0.3)
        x0, y0 = max(0, x - mx), max(0, y - my)
        x1, y1 = min(w, x + bw + mx), min(h, y + bh + my)
        if x1 - x0 < 2 or y1 - y0 < 2:
            continue
        region = out[y0:y1, x0:x1]
        tiny = cv2.resize(region, (max(1, (x1 - x0) // 16), max(1, (y1 - y0) // 16)), interpolation=cv2.INTER_LINEAR)
        blocky = cv2.resize(tiny, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
        k = max(3, ((x1 - x0) // 6) | 1)
        out[y0:y1, x0:x1] = cv2.GaussianBlur(blocky, (k, k), 0)
    return out


def blur_faces(img: Image.Image, blurrer: FaceBlurrer) -> tuple[bytes | None, int]:
    """Returns (JPEG bytes of the blurred photo, number of faces). Bytes are None when no face was found."""
    bgr = cv2.cvtColor(np.asarray(img.convert("RGB")), cv2.COLOR_RGB2BGR)
    boxes = blurrer.faces(bgr)
    if not boxes:
        return None, 0
    out = Image.fromarray(cv2.cvtColor(blur_regions(bgr, boxes), cv2.COLOR_BGR2RGB))
    buf = io.BytesIO()
    out.save(buf, "JPEG", quality=90)
    return buf.getvalue(), len(boxes)
