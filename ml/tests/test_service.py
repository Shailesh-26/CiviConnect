"""Automated tests for the Photo Assistant. They use a tiny fake encoder, so no model download is needed.

Run from the ml/ folder:  python -m pytest -q
"""

import io
import json
import os

import numpy as np
import pytest
from PIL import Image, ImageDraw

os.environ["CIVIC_FAKE_MODEL"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app import labels, quality  # noqa: E402
from app.main import app, interpret  # noqa: E402
from app.model import Classifier, FakeEncoder  # noqa: E402


def photo(kind: str = "sharp", size=(320, 240), fmt="JPEG") -> bytes:
    if kind == "dark":
        img = Image.new("RGB", size, (8, 8, 10))
    elif kind == "flat":
        img = Image.new("RGB", size, (128, 128, 128))
    else:
        img = Image.new("RGB", size, (90, 92, 98))
        d = ImageDraw.Draw(img)
        for x in range(0, size[0], 16):
            d.line([(x, 0), (x, size[1])], fill=(250, 250, 250), width=3)
        d.ellipse([80, 120, 200, 180], fill=(20, 20, 24))
    buf = io.BytesIO()
    img.save(buf, fmt)
    return buf.getvalue()


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_reports_zero_shot_model(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["model"]["mode"] == "zero-shot"
    assert body["model"]["classes"] == labels.ALL


def test_classify_returns_a_complete_answer(client):
    r = client.post("/classify", files={"image": ("road.jpg", photo(), "image/jpeg")})
    assert r.status_code == 200
    body = r.json()
    assert body["verdict"] in {"confident", "unsure", "not_civic"}
    assert len(body["top"]) == 3
    assert all(t["category"] in labels.CIVIC for t in body["top"])
    scores = [t["score"] for t in body["top"]]
    assert scores == sorted(scores, reverse=True)
    assert 0 <= body["civic"] <= 1
    assert {"sharpness", "brightness", "blurry", "dark"} <= body["quality"].keys()
    assert body["model"]["mode"] == "zero-shot"


def test_png_and_sideways_photos_are_accepted(client):
    r = client.post("/classify", files={"image": ("x.png", photo(fmt="PNG", size=(120, 400)), "image/png")})
    assert r.status_code == 200


def test_rejects_files_that_are_not_photos(client):
    r = client.post("/classify", files={"image": ("notes.txt", b"hello world", "text/plain")})
    assert r.status_code == 400


def test_rejects_empty_upload(client):
    r = client.post("/classify", files={"image": ("empty.jpg", b"", "image/jpeg")})
    assert r.status_code == 400


def test_quality_flags_dark_and_blurry_photos():
    dark = quality.check(Image.open(io.BytesIO(photo("dark"))))
    assert dark["dark"] is True and dark["blurry"] is True
    sharp = quality.check(Image.open(io.BytesIO(photo("sharp"))))
    assert sharp["dark"] is False and sharp["blurry"] is False


def test_interpret_confident_pick():
    probs = {c: 0.02 for c in labels.ALL}
    probs["pothole"] = 0.86
    out = interpret(probs)
    assert out["verdict"] == "confident"
    assert out["category"] == "pothole"
    assert out["top"][0]["category"] == "pothole"


def test_interpret_unsure_does_not_preselect():
    probs = {"pothole": 0.3, "drainage": 0.28, "garbage": 0.2, "fallen_tree": 0.1, "streetlight": 0.05, "other": 0.05, "not_civic": 0.02}
    out = interpret(probs)
    assert out["verdict"] == "unsure"
    assert out["category"] is None


def test_interpret_not_civic():
    probs = {c: 0.03 for c in labels.CIVIC}
    probs["not_civic"] = 0.82
    out = interpret(probs)
    assert out["verdict"] == "not_civic"
    assert out["category"] is None


def test_trained_head_is_used_when_present(tmp_path):
    enc = FakeEncoder()
    classes = ["pothole", "garbage", "not_civic"]
    rng = np.random.default_rng(0)
    np.savez(tmp_path / "civic_head.npz", W=rng.standard_normal((3, enc.dim)), b=np.zeros(3), classes=np.array(classes))
    (tmp_path / "metrics.json").write_text(json.dumps({"accuracy": 0.9}))
    clf = Classifier(enc, models_dir=tmp_path)
    assert clf.mode == "trained"
    probs = clf.probabilities(Image.open(io.BytesIO(photo())))
    assert set(probs) == set(classes)
    assert abs(sum(probs.values()) - 1) < 1e-6
    assert clf.info()["metrics"]["accuracy"] == 0.9


# ---------------------------------------------------------------- privacy blur

def test_blur_returns_204_when_there_is_no_face(client):
    r = client.post("/privacy/blur", files={"image": ("road.jpg", photo(), "image/jpeg")})
    assert r.status_code == 204
    assert r.headers["x-faces-blurred"] == "0"


def test_blur_returns_a_blurred_jpeg_when_faces_are_found(client, monkeypatch):
    from app.main import state
    monkeypatch.setattr(state["blur"], "faces", lambda bgr: [(100, 60, 80, 90)])
    r = client.post("/privacy/blur", files={"image": ("people.jpg", photo(), "image/jpeg")})
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert r.headers["x-faces-blurred"] == "1"
    out = Image.open(io.BytesIO(r.content))
    assert out.size == (320, 240)


def test_blur_regions_changes_only_the_face_area():
    from app.privacy import blur_regions
    rng = np.random.default_rng(1)
    img = rng.integers(0, 255, (200, 300, 3), dtype=np.uint8)
    out = blur_regions(img, [(120, 80, 40, 40)])
    assert not np.array_equal(out[80:120, 120:160], img[80:120, 120:160])
    assert np.array_equal(out[:40, :40], img[:40, :40])


def test_blur_rejects_non_images(client):
    r = client.post("/privacy/blur", files={"image": ("x.txt", b"nope", "text/plain")})
    assert r.status_code == 400


# ---------------------------------------------------------------- embeddings (duplicate check, fix check, photo search)

def test_classify_can_return_the_photo_vector(client):
    r = client.post("/classify?vector=true", files={"image": ("road.jpg", photo(), "image/jpeg")})
    v = r.json()["vector"]
    assert len(v) == FakeEncoder.dim
    assert abs(sum(x * x for x in v) - 1) < 1e-3
    assert "vector" not in client.post("/classify", files={"image": ("road.jpg", photo(), "image/jpeg")}).json()


def test_embed_is_stable_and_normalised(client):
    a = client.post("/embed", files={"image": ("a.jpg", photo(), "image/jpeg")}).json()
    b = client.post("/embed", files={"image": ("b.jpg", photo(), "image/jpeg")}).json()
    assert a["dim"] == FakeEncoder.dim
    assert a["vector"] == b["vector"]
    other = client.post("/embed", files={"image": ("c.jpg", photo("dark"), "image/jpeg")}).json()
    assert other["vector"] != a["vector"]


def test_embed_text_returns_a_unit_vector(client):
    r = client.post("/embed-text", json={"text": "flooded road at night"})
    assert r.status_code == 200
    v = r.json()["vector"]
    assert len(v) == FakeEncoder.dim
    assert abs(sum(x * x for x in v) - 1) < 1e-3


def test_embed_text_rejects_empty_queries(client):
    assert client.post("/embed-text", json={"text": ""}).status_code == 422
