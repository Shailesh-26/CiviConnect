# PROJECT_STATE — CiviConnect

Last updated: 2026-10-10, after Phase 6.1 (status: IMPLEMENTED, awaiting owner testing)

## Stack
- Client: React 19 + Vite + TypeScript + Tailwind v4 (`client/`), React Router, lucide-react icons, Leaflet + react-leaflet (OpenStreetMap tiles), Public Sans font, plain `fetch` wrapper
- Server: Node 24 LTS + Express 5 + TypeScript (CommonJS, run with tsx) + Mongoose 9 + Zod 4 + multer + cloudinary (`server/`)
- Database: MongoDB Atlas (free M0), database `civiconnect`; `issues` has a 2dsphere index on `location`
- Auth: JWT in httpOnly cookie (`civiconnect_token`), bcryptjs (12 rounds), roles citizen / officer / admin
- Images: Cloudinary (server-side upload through multer memory storage, max 3 photos, 5 MB each)
- Charts: Recharts. Hotspot map: translucent circles on Leaflet (no heat plugin)
- Planned: Server-Sent Events for live notifications (APPROVED 2026-10-10, no new dependency), local CV classifier (Python service), issue health score per area
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
- PATCH /auth/me (profile: name, bio, homeArea, homeLocation, radiusKm, notify, preset avatar or null); POST /auth/me/avatar (multipart `avatar`, Cloudinary); PATCH /auth/me/password {currentPassword, newPassword} (10 per 15 min)
- GET /admin/users; POST /admin/officers (admin)
- POST /issues (multipart: category, description, lat, lng, address?, customLabel?, customIcon?, onBehalfName?, channel?, photos[]) -> creates or merges; behaviour depends on role (see Phase 6.1)
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

## Phase 6 (new look, landing, demo data)
- Design system in client/src/index.css: theme tokens (light + dark via `.dark`), `.card .btn .input .skeleton` classes, Bricolage Grotesque display font + Public Sans, toasts, skeletons, empty states
- New: pages/Landing.tsx (public, live counters + map + activity from GET /api/public/overview), theme/ (ThemeProvider), components/ToastProvider, ui.tsx, Logo, CategoryChip, CountUp, PublicMap, lib/pins.ts (teardrop pins)
- Rewritten shell: Layout.tsx (sidebar on desktop, bottom tab bar on phones); login/register are full-screen pages outside Layout; `/` is the landing page, dashboard moved to `/dashboard`
- Server: GET /api/public/overview (anonymous, rate limited); `npm run seed:demo` / `seed:demo:clear` create or remove a fake city (46 issues, 4 officers, 8 citizens, admin@civiconnect.demo, password Demo@1234; demo photos are SVGs in client/public/demo, nothing goes to Cloudinary)

## Phase 6.1 (fix-up drop) - IMPLEMENTED 2026-10-10, awaiting owner testing
- Roadmap 6.1 -> 7 Neighbourhood -> 8 Living system -> 9 Intelligence -> 10 CV + tests: APPROVED by owner 2026-10-10
- Logout asks for confirmation (components/ConfirmDialog.tsx, reusable)
- Login/register: one full-screen page, animated city map backdrop (components/CityBackdrop.tsx, lib/cityMap.ts) with one floating glass card, live activity ticker from /public/overview; no split screen
- Collapsible sidebar: button on the sidebar edge or Ctrl+B; icons-only mode with tooltips; remembered in localStorage `cc-sidebar` (lib/storage.ts, try/catch)
- Profile page `/profile` (all roles): emoji/colour avatar, photo upload, initials; name and bio; home area + home spot on a map + radius 1/2/5/10 km; role-specific notification switches (stored now, used in Phase 8); light/dark; change password; unsaved-changes bar
- My reports and the officer/admin queue: search (press "/"), status tabs with counts, category filter, sort (components/IssueFilterBar.tsx, lib/issueFilters.ts)
- Reporting by role, enforced on the server: citizen = normal report; officer = "Field inspection" (source field_inspection, auto-assigned to self, status acknowledged; if the same problem is open within 50 m the server answers 409 with the existing issue id); admin = "Register a complaint" for a citizen (source on_behalf, requires citizen name + channel phone/walk_in/email/letter; the name is never sent to other users). Labels shown in lists and on the issue page
- "Other" category: reporter types a name (3-40 chars) and picks one of 42 icons (server/src/utils/customIcons.ts and client/src/lib/customIcons.ts must stay in sync). "Other" reports merge only when the normalised names match within 50 m
- Data model: Issue gets customLabel, customLabelKey, customIcon, source; each report gets source and onBehalf {name, channel}. User gets avatar, bio, homeArea, homeLocation, radiusKm, notify. Old records keep working (defaults)
- Demo seed: avatars, home areas for citizens, named "Other" issues
- Verified in sandbox: server tsc, client tsc + eslint + build, validator checks, 401 checks, Playwright screenshots (desktop, phone, dark). NOT verified: anything needing Atlas or Cloudinary (create flows per role, profile save, avatar upload, password change)

## Next steps
1. Owner runs the Phase 6.1 test list; fix failures; commit
2. Phase 7 Neighbourhood feed (radius, upvote, comments, flag, share, three-dot menu), public issue pages, guided report wizard with address search and similar-nearby
3. Phase 8 notifications (SSE), SLA clocks + escalation, Field Desk (officer), Command Center (admin)
4. Phase 9 chronic spots, area report cards, analytics v2, civic score, time-lapse + demo simulator; Phase 10 Photo Assistant (CV) and tests

## Notes / revisit
- Production cookies use SameSite=None; revisit CSRF protection at deployment
- Atlas user has atlasAdmin and IP list allows 0.0.0.0/0; tighten before deployment
- Priority list endpoints return up to 300 issues; add pagination if data grows
