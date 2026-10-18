"""The Photo Assistant model.

An *encoder* turns a photo (or a sentence) into a vector. Two ways to turn that vector into a category:

1. zero-shot (default): compare the photo vector with the vectors of descriptive sentences for each
   category (see labels.PROMPTS). Works with no training data at all.
2. trained: if models/civic_head.npz exists (made by notebooks/train_civic_classifier.ipynb), use a
   small logistic-regression layer trained on the owner's own labelled photos. Same encoder, better fit.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Protocol

import numpy as np
from PIL import Image

from . import labels

# Windows without Developer Mode cannot make symlinks; the cache still works, so hide that warning.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

MODELS_DIR = Path(os.environ.get("CIVIC_MODELS_DIR", Path(__file__).resolve().parent.parent / "models"))
CLIP_ID = os.environ.get("CIVIC_CLIP_MODEL", "openai/clip-vit-base-patch32")


class Encoder(Protocol):
    name: str
    logit_scale: float

    def image(self, img: Image.Image) -> np.ndarray: ...

    def texts(self, texts: list[str]) -> np.ndarray: ...


def _features(out):
    """transformers versions differ: some return a tensor, some an output object holding it."""
    if hasattr(out, "shape"):
        return out
    for key in ("image_embeds", "text_embeds", "pooler_output"):
        value = getattr(out, key, None)
        if value is not None:
            return value
    raise TypeError("Unexpected CLIP output type")


def _normalize(v: np.ndarray) -> np.ndarray:
    return v / np.clip(np.linalg.norm(v, axis=-1, keepdims=True), 1e-8, None)


class ClipEncoder:
    """OpenAI CLIP via Hugging Face transformers. Downloaded once (about 600 MB), then runs offline on the CPU."""

    def __init__(self, model_id: str = CLIP_ID):
        import torch  # imported here so the tests can run without torch installed
        from transformers import CLIPModel, CLIPProcessor

        self._torch = torch
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # safetensors only: avoids downloading the same 600 MB weights twice in two formats.
        self.model = CLIPModel.from_pretrained(model_id, use_safetensors=True).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(model_id)
        self.logit_scale = float(self.model.logit_scale.exp().item())
        self.name = f"CLIP {model_id.split('/')[-1]}"

    def image(self, img: Image.Image) -> np.ndarray:
        with self._torch.inference_mode():
            inputs = self.processor(images=img.convert("RGB"), return_tensors="pt").to(self.device)
            feats = _features(self.model.get_image_features(**inputs))
        return _normalize(feats[0].float().cpu().numpy())

    def texts(self, texts: list[str]) -> np.ndarray:
        with self._torch.inference_mode():
            inputs = self.processor(text=texts, return_tensors="pt", padding=True).to(self.device)
            feats = _features(self.model.get_text_features(**inputs))
        return _normalize(feats.float().cpu().numpy())


class FakeEncoder:
    """A tiny deterministic stand-in used by the automated tests (no download, no torch)."""

    name = "fake-encoder"
    logit_scale = 100.0
    dim = 32

    def image(self, img: Image.Image) -> np.ndarray:
        arr = np.asarray(img.convert("RGB").resize((8, 8)), dtype=np.float32) / 255.0
        v = np.concatenate([arr.mean(axis=(0, 1)), arr.std(axis=(0, 1)), arr.reshape(-1)[: self.dim - 6]])
        return _normalize(v - 0.5)

    def texts(self, texts: list[str]) -> np.ndarray:
        out = []
        for t in texts:
            seed = int(hashlib.sha256(t.encode()).hexdigest()[:8], 16)
            out.append(np.random.default_rng(seed).standard_normal(self.dim))
        return _normalize(np.array(out, dtype=np.float32))


def _softmax(x: np.ndarray) -> np.ndarray:
    e = np.exp(x - x.max())
    return e / e.sum()


class Classifier:
    def __init__(self, encoder: Encoder, models_dir: Path = MODELS_DIR):
        self.encoder = encoder
        head = models_dir / "civic_head.npz"
        metrics = models_dir / "metrics.json"
        self.metrics = json.loads(metrics.read_text()) if metrics.exists() else None
        if head.exists():
            data = np.load(head, allow_pickle=False)
            self.classes = [str(c) for c in data["classes"]]
            self.W = data["W"].astype(np.float32)
            self.b = data["b"].astype(np.float32)
            self.mode = "trained"
        else:
            self.classes = list(labels.ALL)
            self.T = np.stack([_normalize(encoder.texts(labels.PROMPTS[c]).mean(axis=0)) for c in self.classes])
            self.mode = "zero-shot"

    def embed(self, img: Image.Image) -> np.ndarray:
        return self.encoder.image(img)

    def probabilities(self, img: Image.Image) -> dict[str, float]:
        return self.probabilities_for(self.embed(img))

    def probabilities_for(self, x: np.ndarray) -> dict[str, float]:
        logits = self.W @ x + self.b if self.mode == "trained" else self.encoder.logit_scale * (self.T @ x)
        p = _softmax(logits.astype(np.float64))
        return {c: float(v) for c, v in zip(self.classes, p)}

    def info(self) -> dict:
        return {
            "name": self.encoder.name,
            "mode": self.mode,
            "classes": self.classes,
            "metrics": self.metrics,
        }
