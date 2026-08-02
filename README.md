# Ohara — AI-Powered Student/Teacher Portal

A learning-management portal where teachers upload course material and the platform turns it into a taught course, an AI tutor grounded in that material, auto-generated quizzes, AI-assisted grading, and at-risk analytics — on top of a full portal (enrollment, assignments, attendance, events, kanban).

This repository is built to a strict, documented architecture. **Read the docs in `/docs` before writing code.** They are the contract, not suggestions.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict, no `any`) | Type safety across the whole stack |
| Backend framework | Express | Mature, minimal, well understood |
| ORM | Sequelize (`sequelize-typescript`) | Typed models via decorators |
| Database | PostgreSQL 16 + `pgvector` | Relational data *and* vector search in one DB |
| Validation | Zod | Runtime validation that also produces TS types + OpenAPI |
| Auth | JWT (access + refresh) + bcrypt | Stateless, role-based |
| API docs | `@asteasolutions/zod-to-openapi` + Swagger UI | Single source of truth: Zod schema = validation = docs |
| Rate limiting | `express-rate-limit` (+ Redis store optional) | Abuse protection |
| Logging | Pino | Structured JSON logs |
| File upload | Multer | PDF ingestion |
| PDF parsing | `pdf-parse` | Extract text from course PDFs |
| LLM | Anthropic Claude via `@anthropic-ai/sdk` | Agentic tutor (tool use), grading, quiz + course generation |
| Embeddings | Pluggable provider (Voyage / OpenAI) | Vectorize chunks for RAG |
| Frontend | React + Vite + TypeScript | The "R" in PERN |
| Client state | TanStack Query + Axios | Server-state caching, clean data layer |
| UI | Tailwind + shadcn/ui | Professional look, fast |
| Charts | Recharts (or Chart.js) | Render the tutor's generated graphs |
| Containerization | Docker + docker-compose | Reproducible dev + deploy |
| Testing | Vitest + Supertest | Unit + API integration |

---

## Documentation index

Read in this order:

0. **[GETTING_STARTED.md](GETTING_STARTED.md)** — start here if you're building this with an AI coding agent. Setup, skills, repo layout, and the exact day-by-day prompts for a 5–6 day build.
1. **[docs/PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md)** — what ohara actually is, in plain language. Features, a day-in-the-life walkthrough, and the sitemap.
2. **[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)** — what we are building and why. Roles, features, MVP vs stretch, non-functional requirements.
3. **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the RMVCS architecture, folder structure, request lifecycle, cross-cutting concerns, the AI/RAG subsystem, Docker, Swagger.
4. **[docs/SCHEMA.md](docs/SCHEMA.md)** — the full database schema, ERD, relationships, indexes, migration strategy.
5. **[docs/RULES.md](docs/RULES.md)** — coding standards. TypeScript strictness, naming, error handling, the "no `any`" rule, commit conventions.
6. **[CLAUDE.md](CLAUDE.md)** — operating manual for AI coding agents. The golden rules and the exact recipe for adding a feature.
7. **[docs/ROADMAP.md](docs/ROADMAP.md)** — the day-by-day execution plan.

---

## Quick start

```bash
# 1. Clone and install
git clone <repo> && cd edu-portal
cp .env.example .env          # then fill in secrets (see below)

# 2. Bring up the whole stack (api + postgres+pgvector + redis)
docker compose up --build

# 3. Run migrations + seed inside the api container
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed

# API:      http://localhost:4000
# Swagger:  http://localhost:4000/docs
# Frontend: http://localhost:5173
```

### Required environment variables

| Var | Purpose |
|---|---|
| `NODE_ENV` | `development` \| `production` |
| `PORT` | API port (default 4000) |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing |
| `ANTHROPIC_API_KEY` | LLM calls |
| `EMBEDDINGS_API_KEY` | Embedding provider |
| `EMBEDDINGS_PROVIDER` | `voyage` \| `openai` |
| `REDIS_URL` | Rate-limit store (optional) |

Config is validated at boot by a Zod schema (`src/config/env.ts`). The app **refuses to start** with a missing or malformed variable — fail fast, never silently.

---

## Scripts

```bash
npm run dev          # ts-node-dev, hot reload
npm run build        # tsc -> dist/
npm run start        # node dist/
npm run db:migrate   # run Sequelize migrations
npm run db:seed      # seed demo data
npm run lint         # eslint, fails on any warning
npm run typecheck    # tsc --noEmit
npm run test         # vitest
```

## Repository layout (top level)

```
edu-portal/
├── apps/
│   ├── api/          # Express + RMVCS backend
│   └── web/          # React + Vite frontend
├── docs/             # the documentation set
├── docker-compose.yml
├── CLAUDE.md
└── README.md
```
