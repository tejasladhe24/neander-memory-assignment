import { and, desc, eq, isNotNull, isNull } from "drizzle-orm"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import { $memory, schema } from "./schema"

type Database = NodePgDatabase<typeof schema>

export type MemoryListItem = {
  content: string
  type: (typeof $memory.$inferSelect)["type"]
}

/** Recent stored memories for baseline user context (no vector search). */
export async function listUserMemories(
  db: Database,
  params: { userId: string; limit?: number }
): Promise<MemoryListItem[]> {
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
