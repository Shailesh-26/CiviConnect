# PROJECT_STATE — CiviConnect

Last updated: after Phase 4 + 5 implementation (status: IMPLEMENTED, awaiting owner testing)

## Stack
- Client: React 19 + Vite + TypeScript + Tailwind v4 (`client/`), React Router, lucide-react icons, Leaflet + react-leaflet (OpenStreetMap tiles), Public Sans font, plain `fetch` wrapper
- Server: Node 24 LTS + Express 5 + TypeScript (CommonJS, run with tsx) + Mongoose 9 + Zod 4 + multer + cloudinary (`server/`)
- Database: MongoDB Atlas (free M0), database `civiconnect`; `issues` has a 2dsphere index on `location`
- Auth: JWT in httpOnly cookie (`civiconnect_token`), bcryptjs (12 rounds), roles citizen / officer / admin
- Images: Cloudinary (server-side upload through multer memory storage, max 3 photos, 5 MB each)
- Charts: Recharts. Hotspot map: translucent circles on Leaflet (no heat plugin)
- Planned: Socket.IO notifications, local CV classifier (Python service), issue health score per area
- Not used on purpose: Kafka, Docker, Redis, external GenAI APIs

## Decisions
- Separate `client` and `server`; Vite dev server proxies `/api` to `http://localhost:5000`
- Roles: citizen (self-register), officer (created by admin, has department), admin (seeded via script)
- Master issue model: one `Issue` document holds many embedded `reports`; a new report of the same category within 50 m of an OPEN issue is merged into it
- Priority score (0-100) is computed on read: category hazard (45) + extra reports (30) + citizen support (15) + days open (10). Label: high >= 70, medium >= 40, else low
- Status flow: reported -> acknowledged -> in_progress -> resolved (reopen allowed); rejected is final. Resolve/reject need a note
- Resolution proof: resolving requires a note and at least one proof photo (when Cloudinary is configured); photos are stored on the timeline entry; issue page shows Before/After
- Citizen verification: only citizens vote on a resolved issue; a reporter saying "still there", or two other citizens, reopens it to in_progress; votes reset on each new resolve
- Officers act only on issues assigned to them; admins assign officers and can update any issue
- Reporter identities are not exposed in issue detail responses
- Design: signboard blue / marker amber / resolved green / alert red on paper background; Public Sans; lucide icons

## Structure (key files)
```
server/src/
  app.ts, server.ts
  config/ env.ts, db.ts
  models/ User.ts, Issue.ts
  middleware/ auth.ts, validate.ts, upload.ts, errorHandler.ts
  controllers/ auth, admin, issue (create/merge, list, mine, assigned, get, support, assign, updateStatus)
  routes/ health, auth.routes, admin.routes, issue.routes
  validators/ auth.schemas.ts, issue.schemas.ts
  utils/ AppError, password, publicUser, token, priority, issueDto, cloudinary
  scripts/ seedAdmin.ts
client/src/
  App.tsx, main.tsx, index.css, types.ts
  lib/ api.ts, constants.ts, format.ts
  auth/ auth-context.ts, AuthProvider.tsx, useAuth.ts, ProtectedRoute.tsx
  components/ Layout, Field, AuthShell, StatusBadge, PriorityMeter, CategoryIcon, IssueList, LocationPicker, IssueMap, HotspotMap
  pages/ Login, Register, Dashboard, ReportIssue, MyReports, Issues, IssueDetail, MapView, Analytics, Admin
```

## API (all under /api, all except health/auth need login)
- GET /health; POST /auth/register, /auth/login, /auth/logout; GET /auth/me
- GET /admin/users; POST /admin/officers (admin)
- POST /issues (multipart: category, description, lat, lng, address?, photos[]) -> creates or merges
- GET /issues (all, ?status=&category=); GET /issues/mine; GET /issues/assigned (officer); GET /issues/:id
- POST /issues/:id/support (toggle); PATCH /issues/:id/assign (admin); PATCH /issues/:id/status (admin or assigned officer, multipart: status, note?, photos[] up to 2); POST /issues/:id/verify (citizen, {fixed: boolean})

## Environment variables (server/.env)
NODE_ENV, PORT, MONGODB_URI, CLIENT_URL, JWT_SECRET (32+ chars), JWT_EXPIRES_DAYS, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

## Run
- Server: `cd server && npm run dev` (http://localhost:5000); Client: `cd client && npm run dev` (http://localhost:5173)
- Seed first admin: `cd server && npx tsx src/scripts/seedAdmin.ts`

## Feature status
- Phase 0 skeleton + Atlas: TESTED, pushed
- Phase 1 authentication and roles: TESTED, pushed
- Phase 2 report issue (map pin, categories), My reports, issue detail + timeline: TESTED; photo picker bug fixed in Phase 4/5 drop, photo upload needs owner re-test
- Phase 3 geo-merge, priority score, support, officer assignment and status flow, map view, queue: TESTED
- Phase 4 resolution proof (photo + before/after) and citizen verification with auto-reopen: IMPLEMENTED
- Phase 5 analytics page (tiles, category/status charts, hotspot map, officer performance): IMPLEMENTED

## Next steps
1. Owner runs the Phase 4+5 test list; fix failures; commit
2. Notifications (Socket.IO + email) and issue health score per area
3. Local CV classifier (Python service), then deployment (Vercel + Render) and README

## Notes / revisit
- Production cookies use SameSite=None; revisit CSRF protection at deployment
- Atlas user has atlasAdmin and IP list allows 0.0.0.0/0; tighten before deployment
- Priority list endpoints return up to 300 issues; add pagination if data grows
