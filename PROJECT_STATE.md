# PROJECT_STATE — CiviConnect

Last updated: 2026-10-10, after Phase 8.1 (status: IMPLEMENTED, awaiting owner testing). Phases 6.1, 7 and 8: TESTED by owner

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
- GET /feed?sort=hot|new|top|unresolved|resolved&radiusKm=1|2|5|10&category=&lat=&lng=&page= (center = lat/lng or the user's home spot; 400 code NO_LOCATION when neither)
- GET /issues/nearby?lat&lng&category&label&text (open issues within 200 m with a 0-100 match score and willMerge)
- GET/POST /issues/:id/comments (multipart body, parentId?, photos[] up to 2); DELETE /comments/:id (own or admin); POST /comments/:id/flag; POST /issues/:id/flag {reason, note?}; POST /issues/:id/follow (toggle); POST /issues/:id/hide (toggle)
- Phase 8: GET /notifications, GET /notifications/stream (Server-Sent Events: events hello, notification, refresh), POST /notifications/read-all, POST /notifications/:id/read
- Phase 8: GET /officer/desk (officer); GET /analytics?days=7|30|90|365 and GET /analytics/export.csv?days= (officer, admin)
- Phase 8 admin: GET /admin/overview, PATCH /admin/users/:id {isActive?, role?, department?}, GET /admin/flags?status=open|closed, POST /admin/flags/resolve {targetType, targetId, action: dismiss|remove}, GET /admin/categories, PUT /admin/categories/:category {slaHours}, GET /admin/audit?action=&before=
- GET /public/issues/:ticket (no login, anonymous); GET /geo/search?q=&lat=&lng= and GET /geo/reverse?lat&lng (login; server-side OpenStreetMap Nominatim, 1 request/second, 24 h cache)
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

## Phase 6.1 (fix-up drop) - TESTED and committed by owner 2026-10-10
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

## Phase 7 (Neighbourhood + community + wizard) - TESTED by owner 2026-10-10 ("this phase is amazing")
- Owner's friend's remarks recorded: analytics too basic (one chart type), /admin page is only a form + table, toasts too small, UI still bland. Decision: toasts fixed now; Analytics v2 moved from Phase 9 into Phase 8 together with the admin Command Center
- Design direction agreed: minimal base; bento grid for dashboards/analytics/admin; glass only for floating layers (nav, menus, sheets, toasts, map overlays); spatial depth for map views; no neumorphism, no maximalism
- Bigger toasts: title, icon tile, optional action button (Undo/Open), countdown bar, pause on hover (components/ToastProvider.tsx; toast.success(message, { title, action, duration }))
- Neighbourhood page `/neighbourhood` (citizen nav "Neighbourhood", route open to all roles): feed within 1/2/5/10 km of home spot or current location; sorts Hot/New/Top/Unresolved/Fixed; category chips; infinite scroll; map panel with radius circle and pins that grow when the card is hovered; pulse tiles; thread cards with upvote (= support), comments, share, follow, three-dot menu (copy link, share, follow, I am also affected, hide with Undo, report to admins)
- Hot score: (supporters + 2 x extra reports + comments + 1) x 1.5 if open / (days since last activity + 2)^1.3
- Discussion on every issue page: comments with one level of replies, up to 2 evidence photos, official badge for officers/admins, latest official update pinned, delete own (admin any), report comment; 3 reports hide a comment until admin review; commenting auto-follows the issue
- Issue page: Follow, Share, comment count, three-dot menu (copy public link, report)
- Public read-only page `/i/:ticket` (no login): status tracker, before/after, map, timeline without names, "fixed in X days", join call to action. Open Graph previews need server rendering: FUTURE (deployment)
- Report wizard: steps Photo (camera on phones) -> Problem -> Location (address search + use my location + map, reverse-geocoded place name) -> Details (landmark pre-filled) -> Review; admin gets a first "Citizen" step. Similar-issues panel with match % (50% distance, 35% same kind, 15% shared words; hand-chosen weights) and "Same problem: upvote instead"
- Privacy fix: timeline entries written by a reporter no longer show their name
- New models: Comment, Flag. Issue gets followers, commentCount, flagCount, lastActivityAt. User gets hiddenIssues (not sent to the client)
- Demo seed: discussions with neighbour comments and officer updates, followers, last activity
- Verified in sandbox: server tsc, client tsc + eslint + build, validator/similarity/throttle checks, 401 checks on every new route, Playwright screenshots (feed, menu, toasts, phone dark, thread, wizard, public page). NOT verified: anything needing Atlas (feed query, comments, flags, follow, hide), Cloudinary (comment photos), Nominatim (address search; sandbox has no internet)

## Phase 8 (Living system) - TESTED by owner 2026-10-10 ("next level")
- Notifications for all roles: model Notification (60-day TTL), services/notify.ts saves + pushes live over Server-Sent Events (no new dependency), respects each user's switches. Bell in sidebar and phone header, unread badge, panel with All/Unread, mark all read, live toast with "Open"
- Events: merge -> earlier followers; assign -> officer + followers; status change / resolved ("please confirm") -> followers; citizen reopen -> officer + admins; new high-priority issue -> admins; comment -> followers (official updates labelled); flag -> admins; SLA warning -> officer; escalation -> officer + admins; unassigned 12 h -> admins
- SLA engine: CategoryConfig (defaults fallen tree 24 h, drainage 48, garbage 48, pothole 72, street light 72, other 120); Issue.slaDueAt set at creation (reopen gets half the time again); services/scheduler.ts runs every minute inside the server (no queues): backfill, warning at 25% time left, automatic escalation (timeline note, +15 priority, notifications, audit), unassigned alert. SLA chips and an SLA card everywhere
- Audit log: model AuditLog; written for assign, every status change, field inspection, on-behalf complaints, user create/update, moderation decisions, SLA changes, admin deleting comments, automatic escalations and reopenings
- Officer /dashboard = Field Desk: bento hero + stats, "Next up" sorted by SLA with one-tap Start work, today's route (nearest-neighbour from most urgent, numbered map), on-time ring, recently fixed
- Admin /dashboard = Command Center: KPI bento, live map (hollow pins = unassigned, red pulsing = overdue, glass legend), breach board, drag-and-drop assignment board with Unassigned lane and smart-routing suggestion (category history + department match - 1.5 x open load), workload bars, live activity; refreshes on SSE events
- /admin = Admin console with tabs: People (search, role filter, activate/deactivate with confirm, edit role/department drawer, add officer drawer), Moderation (grouped flags with reasons and notes, Keep or Remove, decided history), Categories & SLA (edit hours, applied to open issues), Audit log (filters, grouped by day, load older)
- Analytics v2 (server-side): KPIs with previous-period deltas, SLA compliance ring, reopen rate, median first response; reported-vs-fixed area chart; status donut; category bars + table (open, avg fix, on-time); hour x weekday heatmap + busiest hour/day + hourly bars; area x category matrix; officer leaderboard; open hotspots map; 7/30/90/365 ranges; CSV export
- Category colours replaced with a palette validated for colour-blind separation (dataviz validator); dark-mode chart steps added
- Demo seed v3: 150 issues over 90 days, 20 citizens, 6 officers, realistic report hours, SLA due times, escalations, discussions, open flags (some comments auto-hidden), notifications and audit entries (marked meta.demo so seed:demo:clear removes them)
- Verified in sandbox: server tsc; client tsc + eslint + build; SLA/priority/validator unit checks; 401 checks on all new routes; Playwright screenshots against a mock API (Command Center, bell panel, Analytics light + dark, Field Desk, admin tabs, phone width). NOT verified: anything needing Atlas (aggregations, sweep, SSE delivery end to end, seed run)

## Phase 8.1 (polish) - IMPLEMENTED 2026-10-10, awaiting owner testing
- Command Center assignment board: Unassigned lane is fixed; only officer lanes scroll sideways, with fade edges, arrow buttons and snap; thin themed scrollbars (`.cc-scroll`) on inner lists
- /map redesigned as "Explore the city": full-height map, glass side panel (search, Open/Fixed/All, category chips, overdue only, group pins, heat layer), list of issues in the visible area ("search as I move") synced with pins (hover grows a pin, click flies to it), own marker clustering (no new dependency: groups pins within 56 px per zoom level, red when any is overdue, badge = high-priority count), custom glass zoom/fit/locate controls, legend, preview card with Open and Share; phone: filter drawer on top, list as a bottom sheet
- SLA chip time format fixed ("6 h 60 m" bug)
- CV decision recorded: Phase 10a (before review) = local Python service + Photo Assistant UI + zero-shot baseline + Colab notebook; Phase 10b (after review) = fine-tune on owner's dataset and report real metrics. Owner to start collecting photos per category now

## Next steps
1. Owner runs the Phase 8.1 test list; commit
2. Phase 9 chronic spots, area report cards, civic score, time-lapse + demo simulator, marker clustering, heat layer, before/after slider; Phase 10 Photo Assistant (CV) and tests

## Notes / revisit
- Production cookies use SameSite=None; revisit CSRF protection at deployment
- Atlas user has atlasAdmin and IP list allows 0.0.0.0/0; tighten before deployment
- Priority list endpoints return up to 300 issues; add pagination if data grows
