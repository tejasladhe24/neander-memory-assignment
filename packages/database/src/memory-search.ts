import {
  and,
  cosineDistance,
  eq,
  isNotNull,
  isNull,
} from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { $memory, schema } from "./schema"

type Database = NodePgDatabase<typeof schema>

export type MemorySearchResult = {
  content: string
  type: (typeof $memory.$inferSelect)["type"]
  similarity: number
}

export async function searchMemoriesByEmbedding(
  db: Database,
  params: { userId: string; embedding: number[]; limit?: number }
): Promise<MemorySearchResult[]> {
  const { userId, embedding, limit = 4 } = params
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
    .limit(limit)

  return rows.map((row) => ({
    content: row.content,
    type: row.type,
    similarity: 1 - Number(row.distance),
  }))
}
