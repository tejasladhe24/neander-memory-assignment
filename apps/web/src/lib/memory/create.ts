import { db } from "@/lib/db"
import { generateUUID } from "@/lib/utils"
import { schema, searchMemoriesByEmbedding } from "@workspace/database"
import { embed } from "ai"

const DUPLICATE_SIMILARITY_THRESHOLD = 0.92

export type CreateMemoryInput = {
  userId: string
  content: string
  type: "preference" | "decision" | "fact"
  sourceChatId: string
}

export async function createMemoryRecord(input: CreateMemoryInput) {
  const { userId, content, type, sourceChatId } = input

  const { embedding } = await embed({
    model: "openai/text-embedding-3-small",
    value: content,
  })

  const similar = await searchMemoriesByEmbedding(db, {
    userId,
    embedding,
    limit: 1,
  })

  if (
    similar[0] &&
    similar[0].similarity >= DUPLICATE_SIMILARITY_THRESHOLD &&
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
