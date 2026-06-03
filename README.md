# Neander Memory Assignment

A conversational agent with **persistent, cross-session memory** — built for the [Neander take-home assignment](./assignment.md). The agent should remember user preferences, decisions, and context across chats and server restarts, without drowning the model in noise.

## Current Status

| Area | Status |
|------|--------|
| Chat UI + streaming LLM | Working |
| Auth (email/password) | Working |
| Chat/message persistence | Working (Postgres + Electric sync) |
| Memory capture / retrieval | **Stub only** — see [`PLAN.md`](./PLAN.md) |
| Memory tests | Not started |
| Cross-session memory demo | Not started |
| Latency benchmark (1k memories) | Not started |

See **[PLAN.md](./PLAN.md)** for the step-by-step plan to finish the assignment on top of this codebase.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web (TanStack Start + React)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ Chat UI     │→ │ /api/chat    │→ │ Vercel AI Gateway   │ │
│  │ (useChat)   │  │ streamText   │  │ (gpt-4o-mini, etc.) │ │
│  └─────────────┘  └──────┬───────┘  └─────────────────────┘ │
│                          │                                   │
│                   memory-tool (stub)                         │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  packages/database (Drizzle ORM)                            │
│  user · session · chat · message  (+ memory table — planned)  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  Docker: Postgres (pgvector) · Redis · ElectricSQL          │
└─────────────────────────────────────────────────────────────┘
```

**Key design intent:** Memory is **user-scoped** (not chat-scoped). A new chat for the same user should still recall what was learned in earlier sessions. Chat history stays per-conversation; long-term memory is a separate layer.

## Tech Stack

- **Runtime:** Node 20+, pnpm 10, Turborepo
- **Web app:** TanStack Start, TanStack Router, React 19, Tailwind 4
- **AI:** Vercel AI SDK (`ai`, `@ai-sdk/react`) via AI Gateway
- **Database:** PostgreSQL 16 + pgvector (Docker), Drizzle ORM
- **Realtime sync:** ElectricSQL (chat/message shapes to the client)
- **Auth:** better-auth (JWT, email/password, Resend for email)

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 10
- Docker + Docker Compose
- [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) API key
- [Resend](https://resend.com) API key (for auth emails in production; optional locally)

## Local Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

**Root `.env`** — used by Docker Compose:

```env
POSTGRES_USER=admin
POSTGRES_DB=postgres
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
ELECTRIC_SECRET=<random-secret>
AUTH_MODE=insecure
```

**`apps/web/.env`** — used by the web app:

```env
SELF_URL=http://localhost:3000
VITE_SELF_URL=http://localhost:3000
AUTH_SECRET=<random-secret>
AUTH_DOMAIN=localhost
POSTGRES_URL=postgresql://admin:<password>@localhost:5432/postgres
ELECTRIC_URL=http://localhost:3100
ELECTRIC_SECRET=<same-as-root>
AI_GATEWAY_API_KEY=<vercel-ai-gateway-key>
RESEND_API_KEY=<resend-key>
EMAIL_SENDER_NAME=Neander
EMAIL_SENDER_ADDRESS=onboarding@resend.dev
```

### 3. Start infrastructure

```bash
docker compose up -d
```

Services:

| Service | Port | Purpose |
|---------|------|---------|
| Postgres (pgvector) | 5432 | Primary data store |
| Redis | 6379 | Available for caching (not wired yet) |
| Electric | 3100 | Realtime sync for chat/message tables |

### 4. Run database migrations

From the repo root (with `POSTGRES_URL` set):

```bash
pnpm exec drizzle-kit migrate --config packages/database/drizzle.config.ts
```

Or push schema during development:

```bash
pnpm exec drizzle-kit push --config packages/database/drizzle.config.ts
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start a chat.

## Project Structure

```
neander-memory-assignment/
├── apps/web/                    # TanStack Start app
│   └── src/
│       ├── routes/api/chat/     # Streaming chat endpoint
│       ├── lib/ai/tools/memory.ts  # Memory tool (stub)
│       ├── lib/collections/     # Electric-synced chat/message collections
│       ├── components/chat/     # Chat UI
│       └── server/              # Server functions (chat CRUD, auth)
├── packages/
│   ├── database/                # Drizzle schema + migrations
│   └── ui/                      # Shared shadcn/ui + AI elements
├── docker-compose.yml
├── assignment.md                # Assignment brief
└── PLAN.md                      # Implementation plan
```

## Memory System (Planned)

The assignment requires a custom memory layer — no LangChain, mem0, or similar. The planned approach (detailed in PLAN.md):

1. **`memory` table** in Postgres with pgvector embeddings, scoped by `userId`
2. **Capture** — after each turn, an LLM extracts durable facts/preferences (not raw transcript dumps)
3. **Retrieval** — top-k similarity search on the current user message before each reply
4. **Injection** — relevant memories prepended to the system prompt; `memory-tool` available for explicit recall
5. **Tests** — unit tests for capture, persistence, and retrieval logic
6. **Latency guard** — bounded retrieval (fixed k, indexed vector column) to stay within the 200ms p50 budget at ~1,000 memories

## Scripts

```bash
pnpm dev          # Start all apps in dev mode
pnpm build        # Production build
pnpm typecheck    # TypeScript check across workspace
pnpm lint         # ESLint across workspace
pnpm format       # Prettier across workspace
```

## Design Decisions & Tradeoffs

> To be filled in as memory work lands. See PLAN.md for the intended direction.

**Planned tradeoffs:**

- **Extract vs store everything** — Store distilled facts, not full message history, to limit noise and keep retrieval fast
- **Prompt injection vs tool-only** — Inject top memories automatically; keep the tool for explicit “what do you remember about X?” queries
- **pgvector vs external vector DB** — Use existing Postgres + pgvector to avoid extra infra; Redis reserved for optional embedding cache
- **No UI for memory management (v1)** — Stretch goal: memory editing UI; v1 focuses on core capture/retrieve/demo

## What I'd Build Next

See [PLAN.md](./PLAN.md) § Stretch Goals. Priority after core memory:

1. Memory editing (“forget that I prefer tabs”)
2. Conflict detection when new facts contradict old ones
3. PII/credential filtering before storage

## Time Spent

| Phase | Hours |
|-------|-------|
| Scaffold + chat/auth/infra | _TBD_ |
| Memory implementation | _TBD_ |
| Tests + demo + docs | _TBD_ |
| **Total** | _TBD_ (assignment limit: 6h) |

## Demo

> Not yet recorded. Planned: a script or transcript showing preference stated in Chat A recalled in a new Chat B after restart.

## License

Private assignment repository.
