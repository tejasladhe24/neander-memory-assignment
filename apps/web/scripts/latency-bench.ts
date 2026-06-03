/**
 * Latency benchmark for Neander memory assignment.
 *
 * Two modes (assignment cares most about memory retrieval at scale):
 *   memory — DB list + embed + vector search (same path as /api/chat, no LLM)
 *   chat   — POST /api/chat, time to first response byte (memory + model + stream)
 *
 * Prerequisites: app on :3000, Postgres migrated, BENCH_EMAIL / BENCH_PASSWORD in .env
 *
 * Usage:
 *   bun --env-file=.env scripts/latency-bench.ts --mode=memory --memories=1,1000
 *   bun --env-file=.env scripts/latency-bench.ts --mode=chat --history=0,20,50,100
 *   bun --env-file=.env scripts/latency-bench.ts --mode=all --memories=1,1000 --history=0,50
 */

import { parseArgs } from "util"
import { randomUUID } from "crypto"
import {
  and,
  count,
  eq,
  isNotNull,
  isNull,
  listUserMemories,
  schema,
  searchMemoriesByEmbedding,
} from "@workspace/database"
import { embed } from "ai"
import { db as appDb } from "../src/lib/db.ts"
import { env } from "../src/env.ts"
import {
  buildRetrievalEmbedText,
  getRetrievalMinSimilarity,
} from "../src/lib/memory.ts"

const BASE_URL = process.env.BENCH_BASE_URL ?? "http://localhost:3000"
const BENCH_EMAIL = process.env.BENCH_EMAIL
const BENCH_PASSWORD = process.env.BENCH_PASSWORD
const BENCH_MODEL = process.env.BENCH_MODEL ?? "gpt-4o-mini"
const BENCH_QUERY =
  process.env.BENCH_QUERY ??
  "What are my preferences and what database setup do I use?"
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? "30")
const EMBEDDING_DIM = 1536

type Timings = { list: number; embed: number; search: number; total: number }

function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

function summarize(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  console.log(`\n${label}`)
  console.log(`  n=${samples.length}  mean=${mean.toFixed(1)}ms`)
  console.log(
    `  p50=${percentile(sorted, 50).toFixed(1)}ms  p95=${percentile(sorted, 95).toFixed(1)}ms  max=${sorted[sorted.length - 1]?.toFixed(1)}ms`
  )
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), mean }
}

function randomEmbedding(dim = EMBEDDING_DIM): number[] {
  const v = Array.from({ length: dim }, () => Math.random() - 0.5)
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1
  return v.map((x) => x / norm)
}

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !Number.isNaN(n))
}

async function signIn(): Promise<{ cookie: string; userId: string }> {
  if (!BENCH_EMAIL || !BENCH_PASSWORD) {
    throw new Error("Set BENCH_EMAIL and BENCH_PASSWORD in apps/web/.env")
  }

  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: BENCH_EMAIL,
      password: BENCH_PASSWORD,
      callbackURL: "/",
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sign-in failed (${res.status}): ${text}`)
  }

  const setCookie = res.headers.getSetCookie?.() ?? []
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ")
  if (!cookie) {
    throw new Error(
      "No session cookie from sign-in — create the user via /signup first"
    )
  }

  const sessionRes = await fetch(`${BASE_URL}/api/auth/get-session`, {
    headers: { cookie },
  })
  const session = (await sessionRes.json()) as { user?: { id: string } }
  const userId = session.user?.id
  if (!userId) throw new Error("Could not read user id from session")

  return { cookie, userId }
}

async function countMemories(userId: string) {
  const [row] = await appDb
    .select({ count: count() })
    .from(schema.memory)
    .where(
      and(
        eq(schema.memory.userId, userId),
        isNull(schema.memory.deletedAt),
        isNotNull(schema.memory.embedding)
      )
    )
  return Number(row?.count ?? 0)
}

async function seedMemories(params: {
  userId: string
  sourceChatId: string
  targetCount: number
}) {
  const existing = await countMemories(params.userId)
  const toInsert = Math.max(0, params.targetCount - existing)
  if (toInsert === 0) {
    console.log(`  memories: ${existing} (already >= ${params.targetCount})`)
    return existing
  }

  console.log(
    `  seeding ${toInsert} memories (${existing} → ${params.targetCount})...`
  )
  const batchSize = 100
  const types = ["preference", "decision", "fact"] as const

  for (let offset = 0; offset < toInsert; offset += batchSize) {
    const chunk = Math.min(batchSize, toInsert - offset)
    const rows = Array.from({ length: chunk }, (_, i) => ({
      id: randomUUID(),
      userId: params.userId,
      content: `Benchmark memory #${existing + offset + i + 1}: user prefers stack variant ${(existing + offset + i) % 17}`,
      type: types[(existing + offset + i) % types.length],
      sourceChatId: params.sourceChatId,
      embedding: randomEmbedding(),
    }))
    await appDb.insert(schema.memory).values(rows)
  }

  return params.targetCount
}

async function seedChatHistory(params: {
  userId: string
  chatId: string
  messageCount: number
}) {
  await appDb
    .delete(schema.message)
    .where(eq(schema.message.chatId, params.chatId))

  if (params.messageCount === 0) return

  const rows = Array.from({ length: params.messageCount }, (_, i) => ({
    id: randomUUID(),
    chatId: params.chatId,
    userId: params.userId,
    role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
    parts: [
      {
        type: "text" as const,
        text:
          i % 2 === 0
            ? `Benchmark user message ${i + 1} about postgres and preferences.`
            : `Benchmark assistant reply ${i + 1} acknowledging preferences.`,
      },
    ],
  }))

  await appDb.insert(schema.message).values(rows)
}

async function runMemoryRetrieval(
  userId: string,
  query: string
): Promise<Timings> {
  const listStart = performance.now()
  await listUserMemories(appDb, { userId, limit: env.MEMORY_PROFILE_LIMIT })
  const list = performance.now() - listStart

  const embedStart = performance.now()
  const retrievalEmbedText = buildRetrievalEmbedText(query, [])
  const { embedding } = await embed({
    value: retrievalEmbedText,
    model: env.MEMORY_EMBEDDING_MODEL,
  })
  const embedMs = performance.now() - embedStart

  const searchStart = performance.now()
  await searchMemoriesByEmbedding(appDb, {
    userId,
    embedding,
    limit: env.MEMORY_RETRIEVAL_LIMIT,
    minSimilarity: getRetrievalMinSimilarity(query),
  })
  const search = performance.now() - searchStart

  return {
    list,
    embed: embedMs,
    search,
    total: list + embedMs + search,
  }
}

async function benchmarkMemory(memoryTargets: number[]) {
  const { userId } = await signIn()
  const benchChatId = `bench-memory-${userId.slice(0, 8)}`

  await appDb
    .insert(schema.chat)
    .values({
      id: benchChatId,
      title: "Latency benchmark",
      userId,
    })
    .onConflictDoNothing()

  const results: Array<{ memories: number; p50: number; p95: number }> = []

  for (const target of memoryTargets) {
    console.log(`\n=== Memory retrieval @ ~${target} memories ===`)
    await seedMemories({
      userId,
      sourceChatId: benchChatId,
      targetCount: target,
    })

    const totals: number[] = []
    const searches: number[] = []

    for (let i = 0; i < ITERATIONS; i++) {
      const t = await runMemoryRetrieval(userId, BENCH_QUERY)
      totals.push(t.total)
      searches.push(t.search)
      if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${ITERATIONS}\r`)
    }

    const totalStats = summarize(
      "  retrieval total (list + embed + search)",
      totals
    )
    summarize("  vector search only", searches)
    results.push({ memories: target, p50: totalStats.p50, p95: totalStats.p95 })
  }

  if (results.length === 2) {
    const delta = results[1].p50 - results[0].p50
    console.log(`\n=== Assignment check (p50 delta @ large store) ===`)
    console.log(`  cold p50: ${results[0].p50.toFixed(1)}ms`)
    console.log(`  hot p50:  ${results[1].p50.toFixed(1)}ms`)
    console.log(
      `  delta:    ${delta.toFixed(1)}ms (budget: within 200ms of cold)`
    )
    console.log(
      delta <= 200 ? "  PASS (within 200ms)" : "  FAIL (exceeds 200ms budget)"
    )
  }
}

async function measureFirstByteMs(cookie: string, chatId: string) {
  const message = {
    id: randomUUID(),
    role: "user" as const,
    parts: [
      { type: "text" as const, text: "Reply with one short sentence only." },
    ],
  }

  const start = performance.now()
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      id: chatId,
      message,
      model: BENCH_MODEL,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`/api/chat ${res.status}: ${text}`)
  }

  if (!res.body) throw new Error("No response body")

  const reader = res.body.getReader()
  await reader.read()
  const firstByteMs = performance.now() - start
  reader.cancel().catch(() => {})

  return firstByteMs
}

async function benchmarkChat(historySizes: number[]) {
  const { cookie, userId } = await signIn()

  console.log("\n=== Chat first-byte latency (/api/chat) ===")
  console.log(
    "  Note: includes auth'd HTTP, memory prep, compaction, and model TTFB — not memory-only."
  )

  for (const historySize of historySizes) {
    const samples: number[] = []
    const runs = Math.min(ITERATIONS, 10)

    for (let i = 0; i < runs; i++) {
      const chatId = `bench-chat-${historySize}-${i}-${randomUUID().slice(0, 8)}`
      await appDb.insert(schema.chat).values({
        id: chatId,
        title: `Bench ${historySize} msgs #${i}`,
        userId,
      })
      await seedChatHistory({ userId, chatId, messageCount: historySize })
      samples.push(await measureFirstByteMs(cookie, chatId))
    }

    summarize(`  history=${historySize} prior messages`, samples)
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      mode: { type: "string", default: "all" },
      memories: { type: "string", default: "1,1000" },
      history: { type: "string", default: "0,20,50,100" },
    },
  })

  const mode = values.mode ?? "all"
  const memoryTargets = parseNumberList(values.memories ?? "1,1000")
  const historySizes = parseNumberList(values.history ?? "0,20,50,100")

  console.log("Latency benchmark")
  console.log(`  base: ${BASE_URL}`)
  console.log(`  iterations (memory): ${ITERATIONS}`)

  if (mode === "memory" || mode === "all") {
    await benchmarkMemory(memoryTargets)
  }

  if (mode === "chat" || mode === "all") {
    await benchmarkChat(historySizes)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
