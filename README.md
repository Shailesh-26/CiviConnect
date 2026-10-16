# CiviConnect

Crowdsourced civic issue reporting and resolution. Citizens report problems such as potholes, blocked drains,
garbage, fallen trees and broken street lights. Duplicate reports merge, problems are ranked with a transparent
priority score, every fix runs against a deadline (SLA), and an issue only closes with photo proof that citizens can
dispute. A local computer-vision service, the Photo Assistant, suggests the category from the photo.

Final-year B.Tech project.

## Features

**Citizens**
- 5-step report wizard: photo, problem, location (search, GPS or map), details, review
- Add photos by tapping, dragging them onto the page, or pasting with Ctrl+V
- Photo Assistant: suggests the category from the photo, and warns about blurry, dark or non-civic photos
- Duplicate merging within 50 m, with "similar issues nearby" shown before submitting
- Neighbourhood feed (2 km radius) with Hot / New / Top sort; upvote, follow, hide, flag, discuss
- Live status tracker, real-time notifications, before/after photos, verify the fix or reopen it
- Civic score, badges and levels; shareable public issue page without names

**Field officers**
- Field Desk: queue sorted by time left, today's route (nearest-next ordering), on-time rate
- Log problems found during field inspections; resolve with a proof photo

**City admins**
- Command Center: live map, overdue board, unassigned queue with smart officer suggestions, officer lanes
- Register complaints for citizens who phone, walk in or write
- Admin console: people and roles, moderation queue, SLA hours per category, audit log, Photo Assistant model card
- Analytics with CSV export, area report cards (A to F), chronic-spot detection, 90-day city time-lapse,
  live demo simulator

**Platform**
- Priority score out of 100: category hazard, extra reports, supporters, days open, +15 if overdue
- SLA engine: a sweep every minute warns at 25% time left and escalates overdue issues
- Server-Sent Events for live updates; MongoDB 2dsphere geospatial queries; server-side pagination
- SaaS-style landing page with live public statistics
- Light and dark themes, responsive down to phones, reduced-motion support, Ctrl+K command palette

## Architecture

```
client/  React 19 + TypeScript + Vite + Tailwind v4 + Leaflet + Recharts      (port 5173)
   |  /api (Vite proxy in development)
server/  Express 5 + TypeScript + Mongoose + Zod                              (port 5000)
   |-- MongoDB Atlas            data, 2dsphere index
   |-- Cloudinary               photo storage
   |-- OpenStreetMap Nominatim  address search (cached, throttled)
   '-- ml/ Photo Assistant      FastAPI + CLIP, runs locally                  (port 8000)
```

## Requirements

- Node.js 20 or newer
- A MongoDB Atlas connection string
- A Cloudinary account (only for photo uploads)
- Python 3.10 to 3.14 (only for the Photo Assistant)

## First-time setup

### 1. Server
1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and fill it in (see the table below)
4. Optional demo city: `npm run seed:demo` (it prints the demo logins)

### 2. Client
1. `cd client`
2. `npm install`

### 3. Photo Assistant (optional; the app works without it)
1. `cd ml`
2. `python -m venv .venv`
3. Activate it in PowerShell:
   `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned; .venv\Scripts\Activate.ps1`
   (Command Prompt: `.venv\Scripts\activate`; Mac/Linux: `source .venv/bin/activate`).
   The prompt now starts with `(.venv)`.
4. `pip install -r requirements.txt` (a few minutes, about 1 GB)

The first start downloads the CLIP model once (about 600 MB) and then runs offline on the CPU. No external AI API is used.

### Server environment variables (`server/.env`)

| Name | Meaning |
|------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | At least 32 random characters |
| `CLIENT_URL` | Usually `http://localhost:5173` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Photo uploads |
| `VISION_URL` | Photo Assistant address; leave empty for `http://localhost:8000` |

Never commit `.env`.

## Running every day

Open three terminals in the project folder:

| Terminal | Commands | Ready when you see |
|----------|----------|--------------------|
| Server | `cd server` then `npm run dev` | `Server running` |
| Client | `cd client` then `npm run dev` | a `localhost:5173` link |
| Photo Assistant | `cd ml`, activate the venv (step 3 above), then `uvicorn app.main:app --port 8000` | `Photo Assistant ready` |

Open http://localhost:5173. The Photo Assistant terminal looks idle once it is ready; that is normal.
Ctrl+C stops any of them.

## Photo Assistant (computer vision)

- **Model:** OpenAI CLIP ViT-B/32 through Hugging Face `transformers`. It turns a photo into 512 numbers (an embedding).
- **Zero-shot mode (default):** the photo's embedding is compared with embeddings of written descriptions of every
  category (`ml/app/labels.py`), plus a "not a civic problem" class. No training data needed.
- **Trained mode:** when `ml/models/civic_head.npz` exists, a logistic-regression layer trained on labelled photos is
  used on top of the same embeddings (a "linear probe").
- **Also checks** blur (variance of the Laplacian) and darkness, and fixes phone photo rotation.
- **Measured in two ways:** accuracy on held-out test photos (from the notebook), and how often citizens kept the
  suggestion in real use (Admin > Photo Assistant).

**Training on your own photos**
1. In Google Drive create `civic_dataset/` with one folder per category: `pothole`, `drainage`, `garbage`,
   `fallen_tree`, `streetlight`, optional `other`, and `not_civic` (selfies, food, rooms, screenshots).
   Aim for 100 to 300 photos per folder.
2. Open `ml/notebooks/train_civic_classifier.ipynb` in Google Colab, choose a T4 GPU, and run all cells.
3. Put the two files it downloads, `civic_head.npz` and `metrics.json`, in `ml/models/` and restart the service.
   It now says `trained mode`, and Admin > Photo Assistant shows the test scores.

**API:** `GET /health` (model and scores) and `POST /classify` (multipart `image`, up to 8 MB).
Interactive docs at http://localhost:8000/docs while it runs.

## Tests

| Part | Command | Covers |
|------|---------|--------|
| Server | `cd server` then `npm test` | priority formula, SLA states, geo and text helpers, input validation, Photo Assistant client, login protection on every private route |
| Photo Assistant | `cd ml`, activate the venv, then `python -m pytest -q` | API responses, bad uploads, blur/dark checks, decision thresholds, trained-model loading |
| Client | `cd client` then `npm run lint` and `npm run build` | type checking and lint rules |

## Folder structure

```
client/src/
  pages/         one file per screen (Landing, Dashboard, ReportIssue, CommandCenter, Admin, ...)
  components/    shared UI; components/landing/ holds the landing page sections
  lib/           API client, hooks, constants, formatting
server/src/
  models/        Mongoose schemas (Issue, User, Comment, Flag, Notification, AuditLog, CategoryConfig)
  controllers/   route handlers
  routes/        Express routers under /api
  services/      SLA engine, scheduler, notifications, insights, simulator, Photo Assistant client
  validators/    Zod schemas
server/test/     automated tests (node:test)
ml/
  app/           FastAPI service: labels, model, quality checks
  notebooks/     Colab training notebook
  models/        trained classifier files (created by the notebook)
  tests/         pytest
```
