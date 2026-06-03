# Latency Benchmark Report

**Project:** Neander Memory Assignment  
**Date:** June 2026 (updated run)  
**Environment:** Local development (`http://localhost:3000`), Postgres with pgvector, Vercel AI Gateway  

This report explains what we measured, what the numbers mean, and what we learned.

---

## Why we ran these tests

The assignment asks that the agent stays fast as memory grows. Specifically, when there are about **1,000 stored memories**, the time to prepare context for a reply should not get much worse than when there are only a few memories (within **200ms** at the median).

We also wanted to see whether **long chats** (many messages in one conversation) slow down the first part of the assistant's reply.

---

## How we ran the tests

Tool: `apps/web/scripts/latency-bench.ts` (Bun), run from `apps/web` with:

```bash
pnpm bench:latency --mode=memory --memories=1,1000
pnpm bench:latency --mode=chat --history=0,20,50,100
```

**Setup:**

- App running locally on port 3000  
- Database with migrations applied  
- Benchmark user signed in via `BENCH_EMAIL` / `BENCH_PASSWORD`  
- **30 runs** per memory scenario; **10 runs** per chat history size  

---

## Test 1: Memory retrieval (`--mode=memory`)

### What this test does

This test measures the **memory lookup path** used on every chat message—the same steps as in `/api/chat`, but **without** calling the main chat model:

1. Load a short list of recent memories for the user  
2. Turn the user's question into an **embedding** (vector) via the AI Gateway  
3. **Search** Postgres (pgvector) for the most similar stored memories  

For the "1,000 memories" case, the script first inserts benchmark memories until the user has about 1,000 rows, then runs the same lookup 30 times.

### Results

| Stored memories | Metric | Mean | Median (p50) | p95 | Max |
|-----------------|--------|------|--------------|-----|-----|
| ~1 | Full retrieval (list + embed + search) | 660.3 ms | **648.3 ms** | 876.4 ms | 1026.7 ms |
| ~1 | Vector search only | 4.6 ms | **4.5 ms** | 6.8 ms | 7.6 ms |
| ~1,000 | Full retrieval (list + embed + search) | 733.7 ms | **677.8 ms** | 1108.2 ms | 1344.4 ms |
| ~1,000 | Vector search only | 16.7 ms | **13.9 ms** | 21.9 ms | 98.6 ms |

**Assignment check (median full retrieval):**

| | p50 |
|--|-----|
| Cold store (~1 memory) | 648.3 ms |
| Large store (~1,000 memories) | 677.8 ms |
| **Difference** | **+29.5 ms** |
| **Budget** | Must stay within **200 ms** of cold store |
| **Result** | **PASS** |

### What this means (Test 1)

- **Postgres / vector search scales well.** Going from 1 to 1,000 memories added about **9 ms** at the median for search alone (4.5 ms → 13.9 ms). One outlier run reached 98.6 ms on search, but typical runs stayed under ~22 ms at p95.
- **Most of the ~650–680 ms "full retrieval" time is not the database.** The embedding API call (step 2) takes the bulk of the time. List plus search are small compared to embed.
- **The assignment's memory-growth rule is met:** median full retrieval grew by only **29.5 ms** at 1,000 memories—well inside the **200 ms** limit.

**Caveat:** Some runs at 1,000 memories were slower at the high end (p95 about 1.1 s, max about 1.3 s on full retrieval). That is likely embedding API or network variance, not the vector index failing under load.

---

## Test 2: Chat first byte (`--mode=chat`)

### What this test does

This test sends a real **`POST /api/chat`** request (like the browser does) and measures time until the **first byte** of the streamed response arrives.

Before each run, the script creates a chat with a chosen number of **prior messages** in the database:

| Label | Prior messages in chat |
|-------|-------------------------|
| history=0 | 0 |
| history=20 | 20 |
| history=50 | 50 |
| history=100 | 100 |

Each run includes: HTTP, auth, loading messages, memory retrieval, optional context compaction, starting the LLM stream, and the model's time to first token. It is **end-to-end**, not memory-only.

### Results

| Prior messages in chat | Runs | Mean | Median (p50) | p95 | Max |
|------------------------|------|------|--------------|-----|-----|
| 0 | 10 | 828.8 ms | **762.0 ms** | 1273.4 ms | 1273.4 ms |
| 20 | 10 | 927.9 ms | **703.8 ms** | 2850.1 ms | 2850.1 ms |
| 50 | 10 | 764.7 ms | **673.9 ms** | 1420.8 ms | 1420.8 ms |
| 100 | 10 | 792.5 ms | **733.1 ms** | 1093.0 ms | 1093.0 ms |

### What this means (Test 2)

- Median first-byte time stayed roughly **670–760 ms** across all history sizes—no steady climb as message count went up.
- **history=20** had a high mean (927.9 ms) because of one very slow run (max 2.85 s). The median (703.8 ms) is a fairer read than the mean here.
- This metric is dominated by **the LLM starting to stream** and the **embedding call** in memory prep—not by loading 100 old messages from the database.
- With only **10 runs** per size, differences between 0, 20, 50, and 100 messages are mostly noise.

---

## Conclusions

1. **Memory store size is not a bottleneck at ~1,000 memories.** Vector search median went from 4.5 ms to 13.9 ms. The assignment check **passed** with a **29.5 ms** increase in median full retrieval (limit: 200 ms).

2. **Embedding API time drives "full retrieval."** About **630–660 ms** of the ~650–680 ms median is outside Postgres. Improving latency for users means focusing on embeddings (cache, faster model, regional endpoint)—not more index tuning at this scale.

3. **Chat first-byte latency (~670–760 ms median)** measures the whole pipeline (memory + model). It is useful for UX but does not replace Test 1 for proving memory scalability.

4. **Long chats (0–100 prior messages)** did not show a clear median slowdown in this run. Occasional slow outliers (especially at history=20) point to model or network variance. Compaction for very long threads was not measured in isolation.

---

## Recommendations (if improving later)

| Priority | Idea |
|----------|------|
| High | Cache or dedupe query embeddings within a session when the user message text is unchanged. |
| Medium | Log embed / list / search timings separately in production for easier monitoring. |
| Low | Run more iterations (e.g. 50+) for chat mode to reduce noise when comparing history sizes. |

---

## How to reproduce

```bash
cd apps/web
pnpm dev   # terminal 1 — app on :3000
pnpm bench:latency --mode=memory --memories=1,1000
pnpm bench:latency --mode=chat --history=0,20,50,100
```

Script: `apps/web/scripts/latency-bench.ts`
