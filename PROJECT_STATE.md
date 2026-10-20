# PROJECT_STATE — CiviConnect

Last updated: 2026-10-10, after Phase 9 (status: TESTED by owner). Phases 6.1 to 9: TESTED by owner. Work paused by owner on 2026-10-10 15:13 IST

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
- Phase 9: GET /issues, /issues/mine, /issues/assigned accept `page` (+ limit, q, group, category, sort) and then return { issues, total, page, pages, limit, counts }; without `page` they keep the old capped list (map, dashboards)
- Phase 9: GET /insights/chronic?days, /insights/areas?days=30|90|180, /insights/timeline?days, /insights/civic (citizen), GET/POST /insights/simulator {action: start|stop, everySeconds} (admin); GET /issues/:id now includes `chronic`
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

## Phase 8.1 (polish) - TESTED by owner 2026-10-10
- Command Center assignment board: Unassigned lane is fixed; only officer lanes scroll sideways, with fade edges, arrow buttons and snap; thin themed scrollbars (`.cc-scroll`) on inner lists
- /map redesigned as "Explore the city": full-height map, glass side panel (search, Open/Fixed/All, category chips, overdue only, group pins, heat layer), list of issues in the visible area ("search as I move") synced with pins (hover grows a pin, click flies to it), own marker clustering (no new dependency: groups pins within 56 px per zoom level, red when any is overdue, badge = high-priority count), custom glass zoom/fit/locate controls, legend, preview card with Open and Share; phone: filter drawer on top, list as a bottom sheet
- SLA chip time format fixed ("6 h 60 m" bug)
- CV decision recorded: Phase 10a (before review) = local Python service + Photo Assistant UI + zero-shot baseline + Colab notebook; Phase 10b (after review) = fine-tune on owner's dataset and report real metrics. Owner to start collecting photos per category now

## Phase 9 (Intelligence + premium motion + pagination) - TESTED by owner 2026-10-10
- Pagination: server-side search (every word across ticket/name/landmark/description), status group, category, sort and paging in one MongoDB aggregation with $facet; the priority formula is mirrored as a MongoDB expression so sorting by priority works across pages (utils/pagedIssues.ts). My reports and the queue use numbered pages (components/Pagination.tsx, lib/usePagedIssues.ts, 300 ms search debounce)
- Chronic spots (services/insights.ts): same category within 60 m, 3+ issues in 120 days with a return after a fix (or 4+); permanent-fix suggestion per category; badge on the issue page; Insights tab with map and list
- Area report cards: grade A-F per area = 35% fixed on time + 30% share fixed + 20% speed + 15% stayed fixed; previous-period grade, open/overdue/chronic counts; print and share
- Civic score + 8 badges + 5 levels for citizens (report 10, confirmed by neighbours 3 each up to 15 per issue, fixed 15, verification 5, upvote 1, comment 2 up to 40); on Profile and the citizen home; confetti when a new badge appears
- City time-lapse: 90 days replayed on a map with play/pause, scrubber and 1/2/5/10 days per second
- Live demo simulator (services/simulator.ts, admin only, Command Center header): every few seconds a demo citizen reports/upvotes/comments, the demo admin assigns, demo officers start and fix work; all through real notifications, audit and live refresh; only touches @civiconnect.demo users and CC-D/CC-DS tickets
- Before/after drag slider on fixed issues
- Premium motion layer: animated aurora background behind liquid-glass sidebar, header and bottom nav; page transitions; pointer spotlight on interactive cards; 3D tilt on KPI tiles and badges; scroll reveal; shine on primary buttons; confetti on report submit / fix / new badge; print styles; all respect reduced motion
- Command palette (Ctrl+K or the Search box): jump to any page, toggle theme, search tickets on the server
- New nav item "Insights" (sidebar for all roles; bottom bar for citizens)
- Demo seed: 4 chronic spots (pothole, drainage, garbage, street light); demo-ticket match tightened to CC-D#### / CC-DS####
- Verified in sandbox: server tsc; client tsc + eslint + build; geo/regex unit checks; 401 checks; Playwright screenshots against a mock API. NOT verified: aggregations against Atlas (pagination, insights), simulator running against the real database

## Phase 9.5 (SaaS landing page + smoothness) - delivered 2026-10-16, owner loved it ("I love this makeover")
- Landing rebuilt from components in client/src/components/landing/: floating island header (shrinks to a glass pill on scroll, scroll-progress line, sliding hover pill, active-section underline, Product mega menu, animated burger + mobile sheet), hero with rotating problem word, marker-underline and a scripted live product preview (one pothole going Reported -> merged -> assigned -> in progress -> fixed, real priority formula and 72 h clock, pointer parallax, clickable steps), live activity ticker (pauses on hover), features bento (interactive priority playground using the exact server formula, merge animation, SLA clock that warns and escalates, live notification stack, draggable before/after proof slider, area grade weights), role tabs (citizen / officer / admin, auto-advance with timer, animated mini screens), scroll-driven "how it works" with sticky visual, live city section (map, counters, category bars, activity; refreshes every 30 s while visible), "under the hood" tech section, FAQ accordion, magnetic CTA, multi-column footer with server status
- No testimonials or invented numbers: all numbers come from /api/public/overview
- Smoothness: animations use transform/opacity only and pause when off screen (useInView, .cc-paused); removed the CSS blur filter from the global aurora background, which was the main cause of dropped frames on every page (headless test: 26 -> ~116 frames per 2 s idle)
- .reveal now uses the `translate` property so hover lift and tilt still work on revealed cards; per-item delay via --rd
- New lib/useInView.ts (useInView, useInterval)
- Verified in sandbox: client tsc + eslint + build; Playwright screenshots desktop/dark/mobile against the mock API; frame-timing check

## Phase 10a (Photo Assistant + tests + README) - delivered 2026-10-16, awaiting owner test
- ml/ (Python, FastAPI): CLIP ViT-B/32 via transformers, local (one-time ~600 MB download, no external AI API). Zero-shot with prompt ensembles per category plus a not_civic class (labels.py); verdict confident (>=0.55 among civic classes) / unsure / not_civic (civic prob < 0.5); blur (Laplacian variance < 60) and dark (mean < 45) checks; EXIF rotation; 8 MB limit; model runs off the event loop. Trained mode auto-loads models/civic_head.npz (+ metrics.json)
- notebooks/train_civic_classifier.ipynb (Colab): Drive dataset folders, CLIP embeddings, stratified 80/20 split, zero-shot baseline vs logistic-regression linear probe (GridSearch C, balanced classes), report, confusion matrix, misclassified photos, export npz + metrics.json. Verified end-to-end in sandbox with a tiny random CLIP and synthetic photos
- Server: /api/vision/status, /api/vision/classify (auth, 60 per 10 min, proxies to VISION_URL, 503 when offline), /api/vision/stats (admin: agreement of suggestion vs reported category, by verdict/mode/category). Reports store ai {verdict, category, confidence, mode}; invalid ai fields are ignored, never block a report
- Client: wizard Photo step scans the first photo (scan line, then category-coloured corner lock), Photo Assistant card (confident -> pre-selects category if none chosen; unsure -> top 3 tappable bars; not_civic warning; blurry/dark hints; offline note); "Suggested" badge on the Problem step; Admin tab "Photo Assistant" model card (status, test accuracy vs zero-shot, per-class F1, confusion matrix, real-use agreement)
- Tests: server `npm test` (node:test via tsx, 30 tests: priority, SLA, geo/text, validators, vision client with a stub service, 401 on private routes); ml `python -m pytest -q` (10 tests, fake encoder). Found and fixed: blank lat/lng was coerced to 0
- README.md (project) and ml/README.md (setup) written
- Not verified in sandbox: real CLIP weights (Hugging Face blocked here); code path verified with a randomly initialised CLIP of the same API

## Phase 10a.1 (2026-10-16)
- Owner ran the service on Windows with Python 3.14 (works; model loaded in 60 s). Load safetensors only (no double 600 MB download), hide HF symlink warning, PowerShell activation command in docs and the Admin model card

## Phase 10a.2 (2026-10-16)
- Owner tested 10a: everything works (service ran on Windows, Python 3.14)
- Report wizard: drag and drop photos anywhere on the page (full-screen drop overlay, portalled), paste with Ctrl+V, one validation path (type, 5 MB, max 3) with clear toasts; dropping on a later step jumps back to the Photo step
- Fix: cards vanished on hover in Insights > Chronic spots. Cause: the scroll-reveal flag was a class that React wiped when it re-rendered className; it is now a data-in attribute (lib/motion.ts, index.css)
- Removed Vite leftovers: client/README.md, client/src/assets/
- Owner's push of 10a was rejected because origin/main had a newer commit (from the second laptop); told to pull then push

## Phase 10a.3 (2026-10-16) - repo housekeeping
- Owner's GitHub is in sync with this work copy (verified by cloning; only line-ending differences). His pull hit a README conflict because he had pasted the new README on GitHub; resolved
- One README only: ml/README.md merged into the root README (setup, daily run with 3 terminals, Photo Assistant, training, tests) and deleted
- .gitattributes (text=auto eol=lf) to stop CRLF warnings on Windows

## Phase 11 (real-world features) - delivered 2026-10-16, pushed to GitHub by owner (verified identical), test results pending
- Forgot password: POST /api/auth/forgot (same answer whether or not the email exists, 5 per 15 min) stores a SHA-256 hash of a random token, 30-minute expiry; POST /api/auth/reset sets the password, clears the token, emails a "password changed" notice and signs the user in. services/mailer.ts uses Nodemailer when SMTP_* is set in server/.env, otherwise prints the email in the server terminal; in development without SMTP the reset link is also returned as devLink and shown on the page. Pages /forgot-password and /reset-password (strength meter), "Forgot password?" on Login
- Emergencies: emergency, emergencyKind (live_wire, open_manhole, road_blocked, flooding, other_danger), emergencyAt on Issue. 4-hour fix-by clock (EMERGENCY_SLA_HOURS), +25 priority (also in the MongoDB priority expression and analytics), warning in the last hour, escalation text. Set in the wizard Details step (with "call 112 first"), raised when a merged report says so, or by admin / assigned officer via PATCH /api/issues/:id/emergency (clear restores the category clock). Notification type "emergency" cannot be switched off; admins + assigned officer told instantly. Red pulsing badge on lists, feed, Field Desk, Command Center cards and issue page; Command Center emergency banner; admin category SLA changes skip emergencies. Demo seed marks 2 open issues as emergencies
- Officer leave: onLeaveSince/onLeaveUntil on User. services/leave.ts hands every open issue to the best available colleague (services/routing.ts, the smart routing moved out of admin.controller; on-leave officers are never suggested), or back to Unassigned; timeline notes, notifications, audit. Officer: PATCH /api/officer/leave (Field Desk "Going on leave" dialog with optional end date, on-leave banner with "I'm back"); admin: People tab Leave button via PATCH /api/admin/users/:id {onLeave, leaveUntil}. Assigning to an officer on leave is refused; Command Center lanes show "On leave" and do not accept drops; the scheduler ends leave after its end date
- Privacy blur: ml/app/privacy.py with YuNet (ml/assets/face_detection_yunet_2023mar.onnx, OpenCV Model Zoo, MIT) and POST /privacy/blur (200 JPEG + X-Faces-Blurred, or 204 when no face). Server blurs report photos, proof photos and comment photos before Cloudinary (services/vision.ts blurFaces, falls back to the original when the service is down); the report response includes privacy.facesBlurred and the wizard shows a toast
- Landing: priority playground has the emergency toggle; FAQ answers emergencies, leave and face blurring
- README rewritten with emojis, badges and a screenshots table (docs/screenshots/, captured from the mock API; the Photo Assistant model card shot is left for after real training so no invented accuracy is shown)
- Tests: server 41 (emergency priority and clock, routing skips leave, leave dates, reset/forgot validation, email fallback, new 401 routes); ml 14 (blur endpoint, blur region)
- New server dependency: nodemailer (owner must run npm install in server); new ml dependency: opencv-python-headless (pip install -r requirements.txt again)

## Phase 11.1 (2026-10-16)
- Owner tested Phase 11: all fine except leave. Going on leave moved Ravi's issues away and "I'm back" brought nothing back, which looked like nothing happened
- Now issues handed over because of leave are marked (Issue.handedOverFrom). On return (button, admin, or end date), the ones not started yet (reported/acknowledged) go back to the officer with a timeline note and the colleague is told; In progress work stays with the colleague. Field Desk and Admin show a welcome-back summary; leave dialog and FAQ explain the rule
- Issues moved before this fix carry no marker; re-run npm run seed:demo to reset the demo

## Phase 12 (more computer vision) - delivered 2026-10-18, awaiting owner test
- ml: /classify?vector=true returns the CLIP embedding; new /embed and /embed-text (text -> same 512-d space). 18 pytest pass
- server: PhotoEmbedding model (vector, kind report|proof, location, unique url). services/photoIndex.ts indexes photos after create and on resolve; utils/vectors.ts (cosine), utils/fixCheck.ts (verdict thresholds: same place >= 0.72, still visible = proof top category equals issue category >= 0.8)
- Same-photo check: POST /api/vision/similar {vector, lat, lng}: report photos within 500 m with cosine >= 0.88, or exact same photo anywhere >= 0.97. Wizard shows PhotoMatches with Support button
- AI fix check on resolve (advisory): Issue.fixCheck {verdict looks_fixed|different_place|still_visible, similarity, ...}. Doubtful ones notify admins (type fix_check) and appear in Admin > Photo Assistant > "Fixes to double-check" (Looks fine / Reopen). Issue page shows FixCheckNote
- Photo search by words: GET /api/vision/search?q=&kind= (officer/admin), Insights > Photo search tab
- Backfill: npm run vision:index (ML service must be running). 50 server tests pass
- Thresholds not calibrated on real data yet; that's why the fix check is advisory

## Status 2026-10-16 12:11 IST
- Phase 11 and 11.1 TESTED by owner: everything works. Owner taking a break

## Next steps
1. (done) Owner tested Phase 11.1
2. Phase 10b when the owner has photos: Colab notebook, then copy the two files into ml/models/
3. Feature freeze about 7-10 days before the final review; presentation only when the owner asks

## Notes / revisit
- Production cookies use SameSite=None; revisit CSRF protection at deployment
- Atlas user has atlasAdmin and IP list allows 0.0.0.0/0; tighten before deployment
- Priority list endpoints return up to 300 issues; add pagination if data grows
- 2026-10-18: owner created civic_dataset/ (7 folders, still empty) in Drive and ran the notebook once (expected 'no photos' stop). Notebook now finds photos in sub-folders (Kaggle layouts), prints a per-folder count, explains the empty case, and tolerates unreadable files in the sample grid
- 2026-10-18: Phase 10b DONE by owner: 305 labelled photos, test accuracy 92%, macro F1 0.85, zero-shot 87% on the same 61 test photos. Small classes (drainage 3, streetlight 2, other 6 test photos) make per-class numbers noisy; more photos there would help
- Before/After tags now fade with the slider (BeforeAfter.tsx, landing ProofSlider)
- Owner asked what more CV could do; proposed: AI fix check on proof photos (same place + problem gone), same-photo duplicate hint, natural-language photo search for admins
- Owner changed the demo password to Demo@123 (Login.tsx and seedDemo.ts); keep it

## Phase 12.1 (speed) - 2026-10-18
- Owner tested Phase 12: everything works
- Pages are code-split (lib/lazyPage.ts: like React.lazy but renders instantly once downloaded, avoiding React's 300 ms fallback throttle). Landing, Login, Register stay in the main bundle; other pages preload in the background after the first non-landing screen. Landing's live map (Leaflet) loads only when scrolled near
- Main JS 1,054 KB -> 350 KB; first-load JS about 130 KB gzipped (was about 308 KB). Verified every page for every role in dev and production build: same headings, no loading flash, no page errors

## Phase 12.2 (owner feedback) - 2026-10-18
- Owner tested 12.1: works. Asked about loading skeletons, clickable citizen tiles, profile UX, officer vs citizen differences
- Skeleton audit with a 2.5 s slow mock: most pages already had skeletons. Fixed places that showed a misleading 0 while loading: citizen dashboard tiles, Map list and header count, Neighbourhood pulse tiles, Admin people filter counts
- Citizen dashboard tiles link to /my-reports?status=open|in_progress|resolved; My reports reads the status filter from the URL (sidebar link resets to All)
- Root cause of "had to scroll to save": .animate-page used fill-mode both (filter/transform kept), which made fixed children position relative to the page. Now fill-mode backwards (looks identical). Save bar also portalled to body
- Router moved to createBrowserRouter (main.tsx + Root.tsx; routes still in App.tsx) to allow useBlocker. lib/useLeaveGuard.ts + components/UnsavedChangesDialog.tsx: Keep editing / Discard / Save and leave. Never blocks / or /login (logout, session expiry)
- Profile makeover: one tab at a time (Profile, Score & badges for citizens, Neighbourhood, Notifications, Appearance, Password; ?tab= in URL), dots on tabs with unsaved changes, floating save bar naming the changed tabs, Ctrl+S saves
- Report wizard asks before leaving once anything is filled in

## Phase 12.3 (real demo photos) - 2026-10-18
- Owner tested 12.2 flow; decided: no secret rotation (only shared .env in this chat), deployment AFTER rehearsal + bug fixing (plan: Render single service serving client build, Atlas, Cloudinary; Photo Assistant stays local)
- Owner had pushed civic_dataset/ (306 photos, 157 MB, many from Google with unclear licences, e.g. wallpapers) to the public repo. Now gitignored; owner removes it with git rm -r --cached (files stay local + Drive)
- seed:demo uses real photos: server/src/scripts/demoPhotos.ts picks 8 per category from civic_dataset/<category> (skips other, files >9.5 MB), uploads once to Cloudinary as civiconnect/demo/..., caches in server/.demo-photos.json (gitignored). Optional demo-after/<category>/ for after photos; drawn SVGs otherwise. deleteImage never deletes civiconnect/demo/*. clearDemo also removes demo PhotoEmbeddings
- No real "after" photos exist yet (dataset has none; sandbox cannot download). Suggested owner downloads 5 free Pexels/Unsplash photos or takes them on a phone

## Rehearsal (started 2026-10-19)
- R1 (visitor pages) self-check fixes: lazyPage use() console error, PublicIssue header squeezed on phones, landing SLA "24 h" wrap. Owner had not applied R1 zip yet
- Owner ran seed with real photos (40 before, 30 after from his demo-after/ folder). A second seed run printed nothing after "Demo photos…" (cause unknown, could not reproduce without MongoDB here); added "Creating the demo city…" progress line; asked owner to rerun and paste full output
- Photo search returned 24 nearest even when unrelated: utils/searchRelevance.ts keeps matches within 0.04 of the best and >= 0.21, rest as "looser" (UI button). Thresholds not calibrated on real data
- Owner asked whether removing civic_dataset from GitHub was needed: copyright + size; local copy and Drive kept
- New flow agreed: owner tests by checklist, reports issues, I fix; zips only when there are fixes
- R1 owner findings: (1) login with empty fields said "fix the highlighted fields" with nothing highlighted -> Login now validates per field and shows server field errors; Register gets noValidate so our messages show instead of browser popups. (2) photo search "garbage" still showed street lights -> rival check (photo must look more like the query than like any other civic category; closest-meaning rival dropped) + npm run vision:search -- "words" diagnostic table. Seed rerun worked fine (earlier silent stop not seen again)
- Owner wants the rehearsal as a reference document (rounds/modules, sequential test steps) -> Claude Docs test plan
- R1 round done by owner (2026-10-20). Fixed: R1-3 Product menu items now scroll to their own landing spot (report-cards, live-feed, live-map, roles+citizen tab) with a flash outline, or open the real page when logged in; R1-6 citizen demo now loops through all 5 wizard steps; R1-7 story steps track the step nearest screen centre (scroll + rAF) instead of a thin IntersectionObserver band; R1-8 map popups: leaflet.css overrode our popup colours in dark mode (status text invisible) -> .leaflet-container-prefixed styles + StatusBadge in public popup; R1-15/R1-21 lib/useFormChecks.ts: check on blur or submit, then live while typing, server errors until edited (Login, Register)
- Photo search tuned on owner's real scores: SEARCH_MIN_SCORE 0.21, SEARCH_MARGIN 0.08 (rival check does the main filtering); regression test with the real numbers
