# Features

Overview of what this codebase implements today.

## Chat & UI

| Feature | Description |
|---------|-------------|
| **Streaming chat** | Server-sent streaming via Vercel AI SDK (`streamText` + `createUIMessageStream`) on `POST /api/chat`. |
| **Multi-model selection** | UI model picker backed by a large catalog (`lib/ai/models.ts`) and Vercel AI Gateway; default model from `VITE_DEFAULT_CHAT_MODEL`. |
| **Reasoning models** | Reasoning streams enabled when the selected model supports it (capabilities fetched from AI Gateway). |
| **Tool use in chat** | Agent can call tools during generation (`CHAT_STREAM_MAX_STEPS` limits multi-step runs). |
| **Auto chat titles** | First message in a new chat triggers an LLM-generated title (`CHAT_TITLE_MODEL`). |
| **Realtime message list** | Messages and chats sync to the browser via ElectricSQL shapes (`/api/shape` proxy + TanStack DB collections). |
| **Chat sidebar** | List, create, rename, and delete chats (server functions + Electric sync). |

## Authentication

| Feature | Description |
|---------|-------------|
| **Email / password auth** | better-auth with session middleware on API routes. |
| **Sign up & login** | Dedicated auth routes under `(auth)/`. |
| **Forgot / reset password** | Password reset flow with Resend transactional email. |
| **Protected app routes** | Chat UI requires an authenticated session. |

## Persistent Memory (cross-session)

Custom memory layer — no LangChain, mem0, or similar. Memories are **scoped by `userId`**, not `chatId`, so facts learned in one chat are available in another.

### Capture

| Feature | Description |
|---------|-------------|
| **Turn-based extraction** | After each assistant reply, `queueMemoriesFromTurn` sends a `memory/process-turn` Inngest event (non-blocking). |
| **LLM extraction** | Inngest worker runs `extractMemories` (structured output, max `MEMORY_EXTRACT_MAX_PER_TURN` per turn). |
| **Types** | Each memory is `preference`, `decision`, or `fact`. |
| **Embedding + storage** | `createMemoryRecord` embeds content (`MEMORY_EMBEDDING_MODEL`), dedupes near-duplicates (`MEMORY_DUPLICATE_SIMILARITY_THRESHOLD`), inserts into Postgres. |
| **Secret filtering** | Extracted text matching `MEMORY_SECRET_FILTER_PATTERN` is dropped (API keys, passwords, etc.). |
| **Minimum message length** | Short turns are skipped (`MEMORY_MIN_MESSAGE_LENGTH`). |
| **Direct persist event** | `memory/create` Inngest function for explicit persist without extraction. |
| **Compaction memories** | When long chats are compacted, `extractMemoriesFromTranscript` also writes durable facts from the summarized batch. |

### Retrieval

| Feature | Description |
|---------|-------------|
| **Automatic injection** | Every chat request loads recent profile memories (`listUserMemories`) and vector search on the current message embedding. |
| **System prompt sections** | User profile (name), “what you remember,” and optional “especially relevant to latest message” blocks (`buildChatSystemPrompt`). |
| **pgvector search** | Cosine similarity via HNSW index; `MEMORY_MIN_SIMILARITY` threshold. |
| **Recall-style queries** | Regex on user text (`MEMORY_RECALL_QUERY_PATTERN`) lowers similarity threshold and expands embed text with recent turns for questions like “what do you know about me?” |
| **memory-tool** | Explicit `retrieveMemoryTool` for the model to search memories by topic on demand. |

## Long-Chat Context Optimization

| Feature | Description |
|---------|-------------|
| **Token estimation** | Char-based estimate (`length / 4`) on uncompacted messages before each request. |
| **Compaction trigger** | When uncompacted tokens exceed `CHAT_CONTEXT_TOKEN_THRESHOLD`, oldest eligible messages are processed. |
| **Batch size** | `CHAT_CONTEXT_COMPACT_BATCH_SIZE` oldest messages (by `createdAt` order) per compaction. |
| **Recent tail preserved** | Last `CHAT_CONTEXT_KEEP_RECENT_MESSAGES` messages are never compacted in that pass. |
| **Rolling summary** | Summarized text stored on `chat.contextSummary`; injected as a system message for future turns. |
| **Persistent offset** | `chat.compactedMessageCount` skips the oldest N DB messages on every subsequent request so context stays bounded. |
| **Summary model** | Configurable via `CHAT_CONTEXT_SUMMARY_MODEL` and `CHAT_CONTEXT_SUMMARY_SYSTEM_PROMPT`. |

Full messages remain in Postgres/Electric for the UI; only the **LLM context** is trimmed.

## Data & Infrastructure

| Feature | Description |
|---------|-------------|
| **Postgres + pgvector** | `memory.embedding` vector(1536) with HNSW index for similarity search. |
| **Soft delete on memories** | `deletedAt` column (queries ignore deleted rows). |
| **Drizzle ORM** | Shared `@workspace/database` package; operators re-exported to avoid duplicate `drizzle-orm` types. |
| **ElectricSQL sync** | Logical replication–friendly Postgres; shapes for `chat` and `message`. |
| **Docker Compose** | Local Postgres, Redis, and Electric services. |
| **Typed environment** | `@t3-oss/env-core` validation in `apps/web/src/env.ts` for all server/client config. |

## API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/chat` | Stream a reply; inject memories; optional compaction; queue memory job on finish. |
| `GET/POST/PUT /api/inngest` | Inngest serve handler (`createMemory`, `processTurnMemory`). |
| `GET /api/shape` | Authenticated proxy to Electric shape API. |

## Configuration

Most behavior is tunable via `apps/web/.env` without code changes:

| Area | Key variables (examples) |
|------|---------------------------|
| Chat | `CHAT_SYSTEM_PROMPT`, `CHAT_STREAM_MAX_STEPS`, `CHAT_TITLE_*` |
| Memory retrieval | `MEMORY_RETRIEVAL_LIMIT`, `MEMORY_PROFILE_LIMIT`, `MEMORY_MIN_SIMILARITY`, `MEMORY_RECALL_*` |
| Memory creation | `MEMORY_EXTRACT_*`, `MEMORY_EMBEDDING_MODEL`, `MEMORY_DUPLICATE_SIMILARITY_THRESHOLD` |
| Context compaction | `CHAT_CONTEXT_TOKEN_THRESHOLD`, `CHAT_CONTEXT_COMPACT_BATCH_SIZE`, `CHAT_CONTEXT_KEEP_RECENT_MESSAGES`, `CHAT_CONTEXT_SUMMARY_*` |
| Inngest | `INNGEST_APP_ID`, `INNGEST_DEV` |

## Not Implemented (yet)

| Item | Notes |
|------|--------|
| Memory management UI | No in-app edit/delete for memories (assignment stretch). |
| Redis caching | Redis runs in Docker but is not wired into the app. |
| Automated memory tests | Unit/integration tests for capture and retrieval. |
| Latency benchmark script | 1k-memory p50 retrieval measurement. |
| Cross-session demo artifact | Recorded transcript for submission. |
