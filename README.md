# Ohara — AI-Powered Student/Teacher Portal

A learning-management portal where teachers upload course material and the platform turns it into a taught course, an AI tutor grounded in that material, auto-generated quizzes, AI-assisted grading, and at-risk analytics — on top of a full portal (enrollment, assignments, attendance, events, kanban).

This repository is built to a strict, documented architecture. **Read the docs in `/docs` before writing code.** They are the contract, not suggestions.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict, no `any`) | Type safety across the whole stack |
| Backend framework | Express 5 | Mature, minimal, well understood |
| ORM | Sequelize 6 + `sequelize-typescript` | Typed models via decorators |
| Database | PostgreSQL 16 + `pgvector` | Relational data *and* vector search in one DB |
| Validation | Zod 4 | Runtime validation that also produces TS types + OpenAPI |
| Auth | JWT (access + refresh, rotated) + bcrypt | Stateless, role-based |
| API docs | `@asteasolutions/zod-to-openapi` v9 + Swagger UI | Single source of truth: Zod schema = validation = docs |
| Rate limiting | `express-rate-limit` (in-memory) | Abuse protection |
| Logging | Pino + `pino-http` | Structured JSON logs, redacted |
| File upload | Multer | Memory-buffered upload handling |
| File storage | Cloudinary | Course document + assignment submission uploads |
| PDF parsing | `pdf-parse` | Extract text from course PDFs |
| LLM | Groq (`openai/gpt-oss-120b`) via `groq-sdk` | Agentic tutor (tool use), grading, quiz + course generation |
| Embeddings | `@huggingface/transformers`, local `bge-small-en-v1.5` | Vectorize chunks for RAG, no external API/key needed |
| Frontend | React + Vite + TypeScript | The "R" in PERN |
| Client state | TanStack Query + Axios | Server-state caching, clean data layer |
| UI | Tailwind + shadcn/ui | Professional look, fast |
| Charts | Recharts | Render the tutor's generated graphs |
| Containerization | Docker + docker-compose | Reproducible dev + deploy |
| Testing | Vitest + Supertest | Unit + API integration |

**Not used:** Redis. `ARCHITECTURE.md` lists it as an optional rate-limit store;
the in-memory limiter is sufficient for a single API instance and it is
deliberately omitted until there is more than one.

---

## Documentation index

Read in this order:

1. **[docs/PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md)** — what ohara actually is, in plain language. Features, a day-in-the-life walkthrough, and the sitemap.
2. **[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)** — what we are building and why. Roles, features, MVP vs stretch, non-functional requirements.
3. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the RMVCS architecture, folder structure, request lifecycle, cross-cutting concerns, the AI/RAG subsystem, Docker, Swagger.
4. **[docs/SCHEMA.md](docs/SCHEMA.md)** — the full database schema, ERD, relationships, indexes, migration strategy.
5. **[docs/RULES.md](docs/RULES.md)** — coding standards. TypeScript strictness, naming, error handling, the "no `any`" rule, commit conventions.
6. **[CLAUDE.md](CLAUDE.md)** — operating manual for AI coding agents. The golden rules and the exact recipe for adding a feature.
7. **[docs/ROADMAP.md](docs/ROADMAP.md)** — the day-by-day execution plan.
8. **[docs/UI_BRIEF.md](docs/UI_BRIEF.md)** — frontend visual/design direction.
9. **[docs/PHASE_9_INTELLIGENCE.md](docs/PHASE_9_INTELLIGENCE.md)** — the intelligence/analytics phase (at-risk detection, weekly insights).

(`docs/` and `CLAUDE.md` are gitignored — local-only, not on the remote.)

---

## Quick start

```bash
# 1. Clone and install
git clone <repo> && cd ohara/backend
npm install
cp .env.example .env          # then fill in secrets (see below)

# 2. Bring up the stack (backend + frontend + postgres/pgvector)
#    --env-file is REQUIRED: compose resolves ${DB_USER} etc. from it, and
#    there is deliberately no root .env.
cd .. && docker compose --env-file ./backend/.env up --build

# 3. Run migrations + seed inside the backend container
docker compose --env-file ./backend/.env exec backend npm run db:migrate
docker compose --env-file ./backend/.env exec backend npm run db:seed

# API:      http://localhost:8080
# Swagger:  http://localhost:8080/api/docs
# OpenAPI:  http://localhost:8080/api/docs.json
```

The seeder creates one verified admin from `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` (defaults `admin@ohara.local` / `changeme123`). Note that
the **first account to register** is also promoted to admin automatically;
everyone else self-registers as a `student`.

### Running against a local PostgreSQL instead of Docker

Point `DB_HOST`/`DB_PORT`/`DB_NAME` at your own server and run
`npm run db:migrate` from `backend/`. That server must have **pgvector
installed** or the `enable-pgvector` migration fails:

```bash
sudo apt install postgresql-16-pgvector   # Debian/Ubuntu
```

### Frontend

```bash
cd frontend && npm run dev     # http://localhost:3000
```

Vite proxies `/api` to the backend on 8080, so the browser only ever sees one
origin. That is not a convenience — the backend sets its auth cookies with
`sameSite=strict`, so a cross-origin frontend would have them dropped on every
request. nginx does the same proxying in production (`frontend/nginx.conf`).

**All design values live in `frontend/src/styles/theme.css`.** Tailwind v4 is
configured in CSS; there is no `tailwind.config.js`. Components reference
semantic tokens (`bg-surface`, `text-fg`, `rounded-card`) and never raw hex or
stock utilities, so changing the palette is a one-file edit.

### Tests

```bash
cd backend && npm test         # 531 tests
cd frontend && npm test        # 10 tests
```

Integration tests run against a **separate** database named by `DB_NAME_TEST`,
created and migrated automatically on first run. They truncate between tests, so
that variable must never point at a database whose contents you care about.

### Required environment variables

Validated by `backend/src/config/env.ts`. Anything not listed is not read.

| Var | Purpose |
|---|---|
| `NODE_ENV` | `development` \| `production` \| `test` |
| `PORT` | API port (default 8080) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Postgres connection |
| `DB_NAME_TEST` | Database used by the test suite (truncated between tests) |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | Token signing, min 32 chars |
| `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` | e.g. `15m`, `7d` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email |
| `GROQ_API_KEY` | LLM calls (tutor, grading, quiz + course generation) |
| `GROQ_MODEL` | Groq model id (optional, default `openai/gpt-oss-120b`) |
| `MAX_UPLOAD_PDF_BYTES` | Course PDF upload size limit (optional, defaulted) |
| `MAX_LLM_SOURCE_CHARS` | Max source chars sent to the LLM for course generation (optional, defaulted) |
| `MAX_UPLOAD_SUBMISSION_BYTES` | Assignment submission upload size limit (optional, defaulted) |
| `CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary (course document + assignment submission storage) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_CALLBACK_URL` | GitHub OAuth |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Rate limiting (optional, defaulted) |
| `AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX` | Stricter limiter for `/auth/*` (optional, defaulted) |
| `TUTOR_RATE_LIMIT_WINDOW_MS` / `TUTOR_RATE_LIMIT_MAX` | Stricter limiter for tutor messages (optional, defaulted) |
| `GRADING_RATE_LIMIT_WINDOW_MS` / `GRADING_RATE_LIMIT_MAX` | Stricter limiter for AI grading (optional, defaulted) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Bootstrap admin (optional, defaulted) |
| `FRONTEND_URL` | CORS origin and OAuth redirect target |

Embeddings run locally (`@huggingface/transformers`) — no embeddings API key
or provider variable is read.

Config is validated at boot by a Zod schema (`src/config/env.ts`). The app **refuses to start** with a missing or malformed variable — fail fast, never silently.

---

## Scripts

Run from `backend/`:

```bash
npm run dev             # tsx watch, hot reload
npm run build           # tsc -> dist/
npm run start           # node dist/server.js
npm run typecheck       # tsc --noEmit
npm run lint            # eslint, fails on any warning
npm run format          # prettier --write
npm run format:check    # prettier --check
npm run test            # vitest (unit + integration)
npm run test:watch      # vitest in watch mode
npm run db:migrate      # run Sequelize migrations
npm run db:migrate:undo # roll back the last migration
npm run db:seed         # seed the bootstrap admin
npm run db:seed:demo    # seed demo course/user data
npm run db:seed:activity   # seed activity data (attendance, submissions, etc.)
npm run db:reset:activity  # reset seeded activity data
npm run db:seed:events  # seed calendar events
```

Run from `frontend/`:

```bash
npm run dev        # vite dev server
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b --noEmit
npm run lint        # oxlint
npm run test        # vitest
npm run test:watch  # vitest in watch mode
npm run preview     # preview a production build
```

## Repository layout (top level)

```
ohara/
├── backend/          # Express + RMVCS API
│   ├── src/
│   └── tests/        # vitest: unit/ + integration/
├── frontend/         # React + Vite client
├── docs/             # the documentation set (gitignored, local only)
├── docker-compose.yml
├── CLAUDE.md         # agent operating manual (gitignored, local only)
└── README.md
```

`docs/` and `CLAUDE.md` are deliberately excluded from version control. They are
the authoritative contract for this codebase but are maintained locally and not
published to the remote.
