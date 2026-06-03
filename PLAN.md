# Implementation Plan

Complete the [Neander memory assignment](./assignment.md) using the existing TanStack Start monorepo, Postgres + pgvector, and Vercel AI Gateway setup.

**Time budget:** 6 hours hard limit  
**Goal:** Cross-session memory that meaningfully changes agent behavior, with tests and a demo.

---

## 1. Gap Analysis

### Already built

| Component | Location | Notes |
|-----------|----------|-------|
| Streaming chat API | `apps/web/src/routes/api/chat/index.ts` | `streamText`, message persistence, model selector |
| LLM integration | Vercel AI Gateway | `AI_GATEWAY_API_KEY`; models like `openai/gpt-4o-mini` |
| User auth | `apps/web/src/lib/auth/` | better-auth; memory must be `userId`-scoped |
| Postgres + pgvector | `docker-compose.yml` | Image is `pgvector/pgvector:pg16` — ready for embeddings |
| Memory tool hook | `apps/web/src/lib/ai/tools/memory.ts` | **Stub** — returns `"This is a test response"` |
| Chat UI | `apps/web/src/components/chat/index.tsx` | Works; tool call rendering not wired in UI yet |

### Not built (assignment blockers)

- [ ] `memory` database table + migration
- [ ] Memory capture (extract facts from conversation)
- [ ] Memory retrieval (similarity search)
- [ ] System prompt / tool wired to real memory
- [ ] Cross-session recall demo
- [ ] Unit/integration tests for memory logic
- [ ] Latency verification at ~1,000 memories
- [ ] README design notes finalized

### Out of scope for v1 (stretch / post-deadline)

- Memory editing UI
- Conflict resolution UI
- Typed memory categories with different retention rules
- Full PII scanner (basic regex blocklist is enough for a stretch slice)

---

## 2. Recommended Memory Architecture

### Principles (assignment-aligned)

1. **Don't store everything** — Extract short, durable statements (preferences, decisions, facts).
2. **User-scoped, not chat-scoped** — Same user, new chat → same memory pool.
3. **Retrieve before respond** — Fixed top-k retrieval keeps latency predictable.
4. **Fail open on memory errors** — Chat still works if memory read/write fails.

### Data model

Add to `packages/database/src/schema.ts`:

```ts
memory {
  id: text PK
  userId: text FK → user.id
  content: text          // human-readable fact, e.g. "Prefers tabs over spaces"
  category: enum         // preference | decision | fact (optional v1)
  sourceChatId: text?    // audit trail
  embedding: vector(1536) // text-embedding-3-small via gateway
  createdAt, updatedAt
  deletedAt: timestamp?  // soft delete for "forget" stretch
}
```

Indexes:

- `(userId)` — list all memories for a user
- `(userId)` + HNSW/IVFFlat on `embedding` — similarity search

Enable extension in migration:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Capture pipeline

**When:** After assistant finishes a turn (`onFinish` in chat route, or a dedicated post-turn hook).

**How:**

1. Send last user message + assistant reply to a small/fast model (`gpt-4o-mini`).
2. Prompt: extract 0–2 durable memories worth keeping; return JSON array or empty.
3. Filter: skip greetings, one-off questions, secrets (basic regex: `password`, `api_key`, `sk-`, etc.).
4. Dedupe: if cosine similarity to an existing memory for this user > 0.92, update timestamp or skip.
5. Embed + insert.

**Why LLM extraction vs storing raw messages:** Matches assignment judgment criteria; keeps store small and retrieval signal high.

### Retrieval pipeline

**When:** Start of each `/api/chat` POST, before `streamText`.

**How:**

1. Embed the latest user message (same model as storage).
2. Query: `SELECT content FROM memory WHERE userId = $1 AND deletedAt IS NULL ORDER BY embedding <=> $2 LIMIT 5`
3. Format as bullet list in system prompt:

```
You have the following remembered context about this user:
- Prefers TypeScript over Python
- Working on a memory assignment for Neander
Use these when relevant. Do not mention the memory system unless asked.
```

4. **`memory-tool`:** Same retrieval function, but query string from tool arg instead of latest message.

### Latency strategy (200ms p50 budget at 1k memories)

| Technique | Purpose |
|-----------|---------|
| Fixed `LIMIT 5` | Bounded result set |
| pgvector HNSW index | Sub-linear search vs full scan |
| Async capture | Extraction runs **after** stream starts/finishes, not on critical path to first token |
| Sync retrieval only | One embedding call + one indexed query before first token |
| Optional Redis cache | Cache query embedding for repeated identical prompts (skip if time tight) |

**Benchmark script (deliverable):** Seed 1,000 synthetic memories for a test user, measure p50 time from POST `/api/chat` to first SSE chunk with vs without cold store.

---

## 3. Implementation Phases

### Phase 0 — Verify baseline (~30 min)

- [ ] `docker compose up -d` — Postgres, Electric, Redis healthy
- [ ] Migrations applied; sign up + send a chat message end-to-end
- [ ] Confirm `AI_GATEWAY_API_KEY` works (title generation in `server/chat.ts` is a good smoke test)

### Phase 1 — Schema + memory module (~1h)

**Files to create/modify:**

| File | Action |
|------|--------|
| `packages/database/src/schema.ts` | Add `$memory` table + vector column |
| `packages/database/migrations/0001_*.sql` | `CREATE EXTENSION vector`; create table + index |
| `apps/web/src/lib/memory/types.ts` | `MemoryRecord`, `ExtractedMemory` types |
| `apps/web/src/lib/memory/embed.ts` | `embedText(text): number[]` via AI Gateway embeddings |
| `apps/web/src/lib/memory/store.ts` | `saveMemories`, `searchMemories`, `softDelete` |
| `apps/web/src/lib/memory/extract.ts` | LLM extraction prompt + Zod schema |
| `apps/web/src/lib/memory/format.ts` | Format retrieved memories for system prompt |

**Migration command:**

```bash
POSTGRES_URL=... pnpm exec drizzle-kit generate --config packages/database/drizzle.config.ts
POSTGRES_URL=... pnpm exec drizzle-kit migrate --config packages/database/drizzle.config.ts
```

### Phase 2 — Wire into chat (~1.5h)

**Files:**

| File | Change |
|------|--------|
| `apps/web/src/routes/api/chat/index.ts` | Retrieve memories → build dynamic system prompt; trigger capture in `onFinish` |
| `apps/web/src/lib/ai/tools/memory.ts` | Call `searchMemories(userId, query)` |
| `apps/web/src/lib/ai/prompts.ts` | `CHAT_SYSTEM_PROMPT` + `buildSystemPrompt(memories)` |

**System prompt update:**

Replace static `CHAT_SYSTEM_PROMPT` with memory-augmented version on every request.

**Capture:**

In `onFinish`, fire-and-forget `extractAndStoreMemories({ userId, chatId, lastUserMsg, lastAssistantMsg })` — do not block response completion.

### Phase 3 — Tests (~1h)

Add Vitest to `apps/web` or a small `packages/memory` package.

**Minimum test cases:**

| Test | Assert |
|------|--------|
| `extract.ts` | Given a preference statement, returns 1 memory; given "hi", returns 0 |
| `store.ts` | Insert + retrieve by userId; soft delete excludes from search |
| `searchMemories` | Most similar memory ranks first (use fixed mock embeddings or test DB) |
| Integration | Save memory for user A; user B's search returns empty |

```bash
pnpm add -D vitest --filter web
# add "test": "vitest" to apps/web/package.json
```

Use a test Postgres URL or `@electric-sql/pglite` if setup time allows; otherwise unit-test with mocked `db`.

### Phase 4 — Demo + docs (~45 min)

**Demo script** (`scripts/demo-memory.md` or shell):

1. Sign up as `demo@example.com`
2. **Chat A:** "I prefer tabs over spaces and I'm building this in TypeScript."
3. Start **Chat B** (new conversation, same user)
4. Ask: "What language and formatting should we use?"
5. Agent should reference tabs + TypeScript without being re-told

Optional: restart `pnpm dev` between steps 3–4 to prove persistence survives process restart.

**README updates:**

- Fill Design Decisions & Tradeoffs
- Record time spent
- Link demo transcript

### Phase 5 — Latency check (~45 min)

- [ ] Script to insert 1,000 memories (`scripts/seed-memories.ts`)
- [ ] Measure first-token latency turn 1 vs turn 1000 (same user, new chat)
- [ ] If over budget: verify HNSW index exists, reduce k, or cache embeddings

---

## 4. File Map (target state)

```
apps/web/src/lib/memory/
├── types.ts
├── embed.ts
├── extract.ts
├── store.ts
└── format.ts

apps/web/src/lib/ai/
├── prompts.ts          # NEW
└── tools/memory.ts     # UPDATED

packages/database/src/
└── schema.ts           # + memory table

apps/web/src/routes/api/chat/index.ts  # UPDATED

apps/web/src/lib/memory/__tests__/     # or apps/web/tests/memory/
├── extract.test.ts
├── store.test.ts
└── search.test.ts

scripts/
├── seed-memories.ts
└── demo-memory.md
```

---

## 5. Stretch Goal Pick (if time remains)

Pick **one** after core is done:

| Stretch | Effort | Recommendation |
|---------|--------|----------------|
| Relevance retrieval | Already in core plan | — |
| Memory editing | ~1h | Add `DELETE /api/memory/:id` + simple sidebar panel |
| Conflict resolution | ~1.5h | On extract, if new fact contradicts old (LLM judge), soft-delete old |
| Memory categories | ~30m | Add enum + filter retrieval by category |
| Safety (PII) | ~30m | Regex blocklist in `extract.ts` before insert |

**Do not** start stretch goals until latency benchmark passes.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Embedding API adds latency | Use `text-embedding-3-small`; one call per turn on retrieval path only |
| Over-extraction (noise) | Strict extract prompt: max 2 items, must be durable user-specific facts |
| Electric sync not needed for memory | Memory is server-side only for v1; no client collection required |
| Auth middleware uses `context.session.userId` | Verify field exists on better-auth session; fallback to `context.user.id` |
| Tool calls invisible in UI | OK for assignment; optionally render tool parts in `chat/index.tsx` later |

---

## 7. Definition of Done

Assignment is complete when:

- [ ] New chat for same user recalls facts from a prior chat
- [ ] Process restart does not clear memories (Postgres persistence)
- [ ] Tests pass for capture, store, retrieve
- [ ] README explains **why** (design + tradeoffs + time spent)
- [ ] Demo artifact exists (transcript or recording)
- [ ] p50 first-token latency at 1k memories within 200ms of cold store (document measurement method)

---

## 8. Suggested Session Order (6h)

| Block | Duration | Focus |
|-------|----------|-------|
| 1 | 30m | Baseline verification |
| 2 | 60m | Schema + memory module |
| 3 | 90m | Chat integration + manual cross-session test |
| 4 | 60m | Tests |
| 5 | 45m | Demo + README |
| 6 | 45m | Latency seed + benchmark |
| Buffer | 30m | Fixes / one stretch slice |

Start with Phase 1 schema — everything else depends on it.
