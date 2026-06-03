# Neander Memory Assignment

A conversational agent with **persistent, cross-session memory** — built for the [Neander take-home assignment](./assignment.md). The agent remembers user preferences, decisions, and facts across chats and restarts, with vector retrieval, async capture, and long-chat context compaction.

See **[FEATURES.md](./FEATURES.md)** for a full feature list.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  apps/web (TanStack Start + React)                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Chat UI     │→ │ /api/chat    │→ │ Vercel AI Gateway        │ │
│  │ (useChat +  │  │ streamText   │  │ (multi-model via env)    │ │
│  │  Electric)  │  │ + memory inj │  └──────────────────────────┘ │
│  └─────────────┘  └──────┬───────┘                               │
│                          │                                       │
│              memory-tool · context compaction                    │
│                          │                                       │
│              ┌───────────▼───────────┐                           │
│              │ /api/inngest          │  async memory extract/persist│
│              └───────────────────────┘                           │
└──────────────────────────┼───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  packages/database (Drizzle ORM)                                 │
│  user · session · chat · message · memory (pgvector + HNSW)        │
└──────────────────────────┬───────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  Docker: Postgres (pgvector) · Redis · ElectricSQL               │
└──────────────────────────────────────────────────────────────────┘
```

**Design:** Long-term memory is **user-scoped** (not chat-scoped). Chat history stays per conversation; memories and compaction summaries are separate layers.

## Tech Stack

- **Runtime:** Node 20+, pnpm 10, Turborepo
- **Web app:** TanStack Start, TanStack Router, React 19, Tailwind 4
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/react`) via AI Gateway
- **Database:** PostgreSQL 16 + pgvector (Docker), Drizzle ORM
- **Realtime sync:** ElectricSQL (chat/message shapes to the client)
- **Background jobs:** Inngest (memory extraction after each turn)
- **Auth:** better-auth (email/password, Resend for transactional email)

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 10 (`corepack enable` if needed)
- Docker + Docker Compose
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key
- [Resend](https://resend.com) API key (signup / password-reset emails)
- [Inngest CLI](https://www.inngest.com/docs/local-development) (optional but **required** for async memory writes in local dev)

## Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd neander-memory-assignment
pnpm install
```

### 2. Environment files

Create two env files. Passwords and secrets must match between Docker and the app.

**Root `.env`** (Docker Compose):

```env
POSTGRES_USER=admin
POSTGRES_DB=postgres
POSTGRES_PASSWORD=<strong-password>

REDIS_PASSWORD=<strong-password>

ELECTRIC_SECRET=<random-secret>
AUTH_MODE=insecure
```

**`apps/web/.env`** (web app — copy from the example below and fill in secrets):

```env
# App URLs
SELF_URL=http://localhost:3000
VITE_SELF_URL=http://localhost:3000

# Auth
AUTH_SECRET=<random-32+-char-secret>
AUTH_DOMAIN=localhost

# Database (must match Docker Postgres credentials)
POSTGRES_URL=postgresql://admin:<POSTGRES_PASSWORD>@localhost:5432/postgres

# Electric (must match ELECTRIC_SECRET in root .env)
ELECTRIC_URL=http://localhost:3100
ELECTRIC_SECRET=<same-as-root-ELECTRIC_SECRET>

# AI
AI_GATEWAY_API_KEY=<vercel-ai-gateway-key>

# Email (Resend)
RESEND_API_KEY=<resend-api-key>
EMAIL_SENDER_NAME=Neander
EMAIL_SENDER_ADDRESS=onboarding@resend.dev

# Inngest (local dev)
INNGEST_DEV=1
INNGEST_APP_ID=chatbot

# Client default model
VITE_DEFAULT_CHAT_MODEL=gpt-4o-mini
```

Optional tuning (memory, compaction, prompts) is documented in [FEATURES.md](./FEATURES.md#configuration). Defaults work without setting these.

### 3. Start infrastructure

```bash
docker compose up -d
```

Wait until Postgres is healthy (`docker compose ps`).

| Service | Host port | Purpose |
|---------|-----------|---------|
| Postgres (pgvector) | 5432 | Primary data store + vector search |
| Redis | 6379 | Reserved for future caching |
| Electric | 3100 | Realtime sync for `chat` / `message` |

### 4. Database migrations

From the repo root, with `POSTGRES_URL` exported (or inline):

```bash
export POSTGRES_URL=postgresql://admin:<POSTGRES_PASSWORD>@localhost:5432/postgres

pnpm exec drizzle-kit migrate --config packages/database/drizzle.config.ts
```

For a fresh dev DB you can instead push schema directly:

```bash
pnpm exec drizzle-kit push --config packages/database/drizzle.config.ts
```

Rebuild the database package after schema changes:

```bash
pnpm --filter @workspace/database build
```

### 5. Start the app

**Terminal 1 — web app:**

```bash
pnpm dev
```

App: [http://localhost:3000](http://localhost:3000)

**Terminal 2 — Inngest dev server** (needed so memories are extracted and saved after each reply):

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Without Inngest, chat still works but **turn-based memory capture** (`memory/process-turn`) will not run.

### 6. Smoke test

1. Sign up at `/signup` (check Resend / logs if email fails).
2. Start a new chat and tell the assistant something durable (e.g. “I prefer PostgreSQL with pgvector”).
3. Confirm the Inngest dev UI shows `memory/process-turn` runs.
4. Open a **new** chat and ask “What do you know about me?” — profile + memories should appear in the reply.

## Project Structure

```
neander-memory-assignment/
├── apps/web/
│   └── src/
│       ├── routes/api/chat/       # Streaming chat + memory inject + compaction
│       ├── routes/api/inngest/    # Inngest serve endpoint
│       ├── routes/api/shape/      # Electric shape proxy
│       ├── lib/memory.ts          # Extract, persist, retrieval helpers, prompts
│       ├── lib/chat-context.ts    # Long-chat summarization + token budgeting
│       ├── lib/inngest.ts         # Memory background functions
│       ├── lib/ai/tools/memory.ts # memory-tool for explicit recall
│       └── lib/collections/       # Electric-synced chat/message
├── packages/
│   ├── database/                  # Drizzle schema, migrations, memory queries
│   └── ui/                        # Shared shadcn + AI Elements
├── docker-compose.yml
├── assignment.md
├── FEATURES.md
└── PLAN.md                        # Original implementation plan (historical)
```

## Scripts

```bash
pnpm dev          # Start apps in dev mode (Turbo)
pnpm build        # Production build
pnpm typecheck    # TypeScript across the workspace
pnpm lint         # ESLint
pnpm format       # Prettier
```

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| DB connection errors | `POSTGRES_URL` matches `docker compose` credentials; Postgres container healthy |
| Electric sync empty / errors | `ELECTRIC_URL` and `ELECTRIC_SECRET` match root `.env`; Electric container up |
| Memories never saved | Inngest dev server running and pointed at `/api/inngest`; `INNGEST_DEV=1` |
| AI errors | Valid `AI_GATEWAY_API_KEY`; model id in UI matches Gateway-supported models |
| Auth email not sent | `RESEND_API_KEY` and verified sender domain in Resend |
| Drizzle type errors after schema change | `pnpm --filter @workspace/database build` then restart TS server |

## Assignment Deliverables

Still outstanding for submission (see [assignment.md](./assignment.md)):

- Automated tests for memory capture, persistence, and retrieval
- Cross-session demo transcript
- Latency benchmark at ~1,000 memories (200ms p50 retrieval target)

## License

Private assignment repository.
