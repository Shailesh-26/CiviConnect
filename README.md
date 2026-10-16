# CiviConnect

Crowdsourced civic issue reporting and resolution. Citizens report problems such as potholes, blocked drains,
garbage, fallen trees and broken street lights. Duplicate reports merge, problems are ranked with a transparent
priority score, every fix runs against a deadline (SLA), and an issue only closes with photo proof that citizens can
dispute. A local computer-vision service suggests the category from the photo.

Final-year B.Tech project.

## Features

**Citizens**
- 5-step report wizard: photo, problem, location (search, GPS or map), details, review
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
   |-- MongoDB Atlas          data, 2dsphere index
   |-- Cloudinary             photo storage
   |-- OpenStreetMap Nominatim  address search (cached, throttled)
   '-- ml/ Photo Assistant    FastAPI + CLIP (local)                         (port 8000)
```

## Running locally

Needs Node.js 20+, a MongoDB Atlas connection string, and (for photos) a Cloudinary account.
The Photo Assistant also needs Python 3.10 to 3.13.

1. **Server:** `cd server`, `npm install`, copy `.env.example` to `.env` and fill it in, then `npm run dev`
2. **Demo data (optional):** in `server`, run `npm run seed:demo`. It prints the demo logins.
3. **Client:** `cd client`, `npm install`, `npm run dev`, open http://localhost:5173
4. **Photo Assistant (optional):** see [ml/README.md](ml/README.md)

### Server environment variables (`server/.env`)

| Name | Meaning |
|------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | At least 32 random characters |
| `CLIENT_URL` | Usually `http://localhost:5173` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Photo uploads |
| `VISION_URL` | Photo Assistant address; empty means `http://localhost:8000` |

Never commit `.env`.

## Tests

| Part | Command | Covers |
|------|---------|--------|
| Server | `cd server` then `npm test` | priority formula, SLA states, geo and text helpers, input validation, Photo Assistant client, login protection on every private route |
| Photo Assistant | `cd ml` then `python -m pytest -q` | API responses, bad uploads, blur/dark checks, decision thresholds, trained-model loading |
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
