import {
  and,
  cosineDistance,
  desc,
  eq,
  isNotNull,
  isNull,
} from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { $memory, schema } from "./schema"

type Database = NodePgDatabase<typeof schema>

export type MemoryRecord = {
  content: string
  type: (typeof $memory.$inferSelect)["type"]
}

export type MemorySearchResult = MemoryRecord & {
  similarity: number
}

export async function listUserMemories(
  db: Database,
  params: { userId: string; limit?: number }
): Promise<MemoryRecord[]> {
  const { userId, limit = 8 } = params

  return db
    .select({
      content: $memory.content,
      type: $memory.type,
    })
    .from($memory)
    .where(
      and(
        eq($memory.userId, userId),
        isNull($memory.deletedAt),
        isNotNull($memory.embedding)
      )
    )
    .orderBy(desc($memory.updatedAt))
    .limit(limit)
}

export async function searchMemoriesByEmbedding(
  db: Database,
  params: {
    userId: string
    embedding: number[]
    limit?: number
    minSimilarity?: number
  }
): Promise<MemorySearchResult[]> {
  const { userId, embedding, limit = 4, minSimilarity = 0.5 } = params
  const distance = cosineDistance($memory.embedding, embedding)

  const rows = await db
    .select({
      content: $memory.content,
      type: $memory.type,
      distance,
    })
    .from($memory)
    .where(
      and(
        eq($memory.userId, userId),
        isNull($memory.deletedAt),
        isNotNull($memory.embedding)
      )
    )
    .orderBy(distance)
    .limit(limit * 2)

  return rows
    .map((row) => ({
      content: row.content,
      type: row.type,
      similarity: 1 - Number(row.distance),
    }))
    .filter((row) => row.similarity >= minSimilarity)
    .slice(0, limit)
}
