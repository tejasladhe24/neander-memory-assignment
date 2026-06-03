import { env } from "@/env"
import { db } from "@/lib/db"
import { generateUUID } from "@/lib/utils"
import { schema, searchMemoriesByEmbedding } from "@workspace/database"
import { embed } from "ai"

export type CreateMemoryInput = {
  userId: string
  content: string
  type: "preference" | "decision" | "fact"
  sourceChatId: string
}

export async function createMemoryRecord(input: CreateMemoryInput) {
  const { userId, content, type, sourceChatId } = input

  const { embedding } = await embed({
    model: env.MEMORY_EMBEDDING_MODEL,
    value: content,
  })

  const similar = await searchMemoriesByEmbedding(db, {
    userId,
    embedding,
    limit: 1,
    minSimilarity: env.MEMORY_DUPLICATE_SIMILARITY_THRESHOLD,
  })

  if (
    similar[0] &&
    similar[0].content.trim().toLowerCase() === content.trim().toLowerCase()
  ) {
    return { memory: null, skipped: true as const }
  }

  const [memory] = await db
    .insert(schema.memory)
    .values({
      id: generateUUID(),
      userId,
      content,
      type,
      sourceChatId,
      embedding,
    })
    .returning()

  return { memory, skipped: false as const }
}
