# PROJECT_STATE — CiviConnect

Last updated: after Phase 1 implementation (status: IMPLEMENTED, awaiting owner testing)

## Stack
- Client: React 19 + Vite + TypeScript + Tailwind v4 (`client/`), React Router, Public Sans font, plain `fetch` wrapper
- Server: Node 24 LTS + Express 5 + TypeScript (CommonJS, run with tsx) + Mongoose + Zod (`server/`)
- Database: MongoDB Atlas (free M0), database `civiconnect`
- Auth: JWT in httpOnly cookie (`civiconnect_token`), bcryptjs (12 rounds), role-based access
- Planned: Cloudinary (images), Leaflet + OpenStreetMap (maps), Socket.IO, local CV classifier (Python service)
- Not used on purpose: Kafka, Docker, Redis, external GenAI APIs

## Decisions
- Separate `client` and `server` folders; Vite dev server proxies `/api` to `http://localhost:5000`
- Roles: citizen (self-register), officer (created by admin, has department), admin (seeded via script)
- Master Civic Issue vs Report model (see PROJECT_MASTER.md) is used for geo-merge in the next phases
- Design: signboard blue / marker amber / resolved green / alert red on paper background; Public Sans only; no gradients

## Structure
```
CiviConnect/
  PROJECT_MASTER.md, CLAUDE_MASTER_PROMPT.md, PROJECT_STATE.md, README.md, .gitignore
  server/
    .env (secret, ignored), .env.example, tsconfig.json
    src/ server.ts, app.ts
      config/ env.ts, db.ts
      models/ User.ts
      middleware/ auth.ts (authenticate, requireRole), validate.ts, errorHandler.ts
      controllers/ auth.controller.ts, admin.controller.ts
      routes/ health.ts, auth.routes.ts, admin.routes.ts
      validators/ auth.schemas.ts
      utils/ AppError.ts, password.ts, publicUser.ts, token.ts
      scripts/ seedAdmin.ts
      types/ express.d.ts
  client/
    vite.config.ts (tailwind plugin + /api proxy)
    src/ main.tsx, App.tsx, index.css, types.ts
      lib/ api.ts
      auth/ auth-context.ts, AuthProvider.tsx, useAuth.ts, ProtectedRoute.tsx
      components/ Layout.tsx, Field.tsx
      pages/ Login.tsx, Register.tsx, Dashboard.tsx, Admin.tsx
```

## API (all under /api)
- GET /health
- POST /auth/register, POST /auth/login, POST /auth/logout, GET /auth/me
- GET /admin/users, POST /admin/officers (admin only)

## Environment variables (server/.env)
NODE_ENV, PORT, MONGODB_URI, CLIENT_URL, JWT_SECRET (32+ chars), JWT_EXPIRES_DAYS, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD

## Run
- Server: `cd server && npm run dev`  (http://localhost:5000)
- Client: `cd client && npm run dev`  (http://localhost:5173)
- Seed first admin: `cd server && npx tsx src/scripts/seedAdmin.ts`

## Feature status
- Phase 0 project skeleton + Atlas connection + health check: TESTED, pushed
- Phase 1 authentication and roles: IMPLEMENTED (owner testing pending)

## Next steps
1. Owner runs the Phase 1 test list; fix anything failing; commit `feat(auth): ...`
2. Phase 2: Report issue (Cloudinary photo upload, Leaflet map pin, category, description), My Reports with status timeline
3. Phase 3: Master issue + geo-merge (2dsphere index), officer/admin lifecycle

## Notes / revisit
- Production cookies use SameSite=None; revisit CSRF protection at deployment
- Atlas user currently has atlasAdmin and IP list allows 0.0.0.0/0; tighten before deployment
