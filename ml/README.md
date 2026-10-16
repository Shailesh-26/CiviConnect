# Photo Assistant (computer vision)

A small Python service that looks at a report's photo and suggests the category. It also flags blurry or dark
photos and photos that are not a civic problem at all. The Express server calls it at `VISION_URL`
(default `http://localhost:8000`). If it is not running, the app works normally without suggestions.

- **Model:** OpenAI CLIP ViT-B/32, run locally through Hugging Face `transformers`. The weights (about 600 MB)
  download once on the first start, then everything runs offline on your CPU. No external AI API is used.
- **Zero-shot mode (default):** each photo is compared with several written descriptions of every category
  (`app/labels.py`). This needs no training data.
- **Trained mode:** when `models/civic_head.npz` exists, a logistic-regression layer trained on your own labelled
  photos is used instead (a "linear probe" on CLIP embeddings). Make it with `notebooks/train_civic_classifier.ipynb`
  on Google Colab.

## First-time setup (Windows)

Needs Python 3.10 to 3.14 (`python --version`).

1. Open a terminal in the project's `ml` folder.
2. Create a virtual environment: `python -m venv .venv`
3. Activate it. In PowerShell:
   `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; .venv\Scripts\Activate.ps1`
   (Command Prompt: `.venv\Scripts\activate`; Mac/Linux: `source .venv/bin/activate`).
   The prompt now starts with `(.venv)`.
4. Install the packages: `pip install -r requirements.txt` (a few minutes, about 1 GB)
5. Start the service: `uvicorn app.main:app --port 8000`

The first start downloads the model, so it takes a few minutes. Wait for
`Photo Assistant ready: CLIP clip-vit-base-patch32, zero-shot mode` and `Uvicorn running on http://127.0.0.1:8000`.
After that the terminal looks idle: that is normal, the service is running and waiting for photos. Leave it open
and use a new terminal for anything else. Ctrl+C stops it.

## Every day

```
cd ml
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; .venv\Scripts\Activate.ps1
uvicorn app.main:app --port 8000
```

Keep this terminal open next to the server and client terminals. Interactive API docs: http://localhost:8000/docs

## Training on your own photos (Phase 10b)

1. In Google Drive create `civic_dataset/` with one folder per category: `pothole`, `drainage`, `garbage`,
   `fallen_tree`, `streetlight`, optional `other`, and `not_civic` (selfies, food, rooms, screenshots).
   Aim for 100 to 300 photos per folder.
2. Open `notebooks/train_civic_classifier.ipynb` in Colab, turn on a T4 GPU, and run all cells.
3. Download `civic_head.npz` and `metrics.json` into `ml/models/` and restart the service.
   It prints `trained mode`, and the Admin page's Photo Assistant tab shows the test scores.

## Tests

```
python -m pytest -q
```

The tests use a tiny fake encoder, so they run in seconds without the model download.

## API

| Method | Path        | Body                         | Returns |
|--------|-------------|------------------------------|---------|
| GET    | `/health`   |                              | model name, mode, classes, training metrics |
| POST   | `/classify` | multipart `image` (max 8 MB) | `verdict` (confident / unsure / not_civic), `category`, `confidence`, `civic`, `top` 3, `quality`, `ms` |
