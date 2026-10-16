"""CiviConnect Photo Assistant: a small local HTTP service.

Run:  uvicorn app.main:app --port 8000        (from the ml/ folder, with the virtual environment active; setup in README.md)
Docs: http://localhost:8000/docs
"""

from __future__ import annotations

import io
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError

from . import labels, privacy, quality
from .model import Classifier, ClipEncoder, FakeEncoder

MAX_BYTES = 8 * 1024 * 1024
# How sure the model must be before the app pre-selects a category for the citizen.
CONFIDENT = 0.55
# Below this "civic" probability the photo is probably not a civic problem at all.
CIVIC_MIN = 0.5

state: dict = {}


def load_classifier() -> Classifier:
    encoder = FakeEncoder() if os.environ.get("CIVIC_FAKE_MODEL") == "1" else ClipEncoder()
    return Classifier(encoder)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    started = time.perf_counter()
    state["clf"] = load_classifier()
    state["load_s"] = round(time.perf_counter() - started, 1)
    try:
        state["blur"] = privacy.FaceBlurrer()
    except Exception as err:  # the category service still works without face blurring
        print(f"Face blurring disabled: {err}")
    print(f"Photo Assistant ready: {state['clf'].encoder.name}, {state['clf'].mode} mode, loaded in {state['load_s']} s")
    yield
    state.clear()


app = FastAPI(title="CiviConnect Photo Assistant", version="1.0.0", lifespan=lifespan)


def read_image(raw: bytes) -> Image.Image:
    if not raw:
        raise HTTPException(400, "No photo received")
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "Photo is larger than 8 MB")
    try:
        img = Image.open(io.BytesIO(raw))
        img = ImageOps.exif_transpose(img)  # phone photos are often stored sideways
        return img.convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "That file is not a photo we can read") from None


def interpret(probs: dict[str, float]) -> dict:
    civic_classes = [c for c in probs if c != labels.NOT_CIVIC]
    civic = sum(probs[c] for c in civic_classes)
    total = civic or 1.0
    top = sorted(({"category": c, "score": round(probs[c] / total, 4)} for c in civic_classes), key=lambda r: -r["score"])
    best = top[0]
    if civic < CIVIC_MIN:
        verdict = "not_civic"
    elif best["score"] >= CONFIDENT:
        verdict = "confident"
    else:
        verdict = "unsure"
    return {
        "verdict": verdict,
        "category": best["category"] if verdict == "confident" else None,
        "confidence": best["score"],
        "civic": round(civic, 4),
        "top": top[:3],
    }


@app.get("/health")
def health():
    clf: Classifier = state["clf"]
    return {"ok": True, "loadSeconds": state.get("load_s"), "model": clf.info(), "labels": labels.LABEL, "faceBlur": "blur" in state}


@app.post("/classify")
async def classify(image: UploadFile = File(...)):
    started = time.perf_counter()
    img = read_image(await image.read())
    clf: Classifier = state["clf"]
    # The model is CPU-heavy; run it off the event loop so /health stays responsive.
    result = interpret(await run_in_threadpool(clf.probabilities, img))
    result["quality"] = await run_in_threadpool(quality.check, img)
    result["model"] = {"name": clf.encoder.name, "mode": clf.mode}
    result["ms"] = round((time.perf_counter() - started) * 1000)
    return result


@app.post("/privacy/blur")
async def blur(image: UploadFile = File(...)):
    """Blur every face. 200 with the new JPEG when faces were found, 204 when there was nothing to blur."""
    blurrer = state.get("blur")
    if blurrer is None:
        raise HTTPException(503, "Face blurring is not available")
    img = read_image(await image.read())
    data, count = await run_in_threadpool(privacy.blur_faces, img, blurrer)
    if data is None:
        return Response(status_code=204, headers={"X-Faces-Blurred": "0"})
    return Response(content=data, media_type="image/jpeg", headers={"X-Faces-Blurred": str(count)})
