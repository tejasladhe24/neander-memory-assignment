import { env, getMemoryRecallQueryPattern } from "@/env"
import type { UIMessage } from "ai"
import { getMessageText } from "@/lib/memory/queue"

export function isRecallStyleQuery(text: string) {
  return getMemoryRecallQueryPattern().test(text)
}

/**
 * Recall questions ("do you remember my database setup?") embed poorly against
 * stored facts ("User loves PostgreSQL with pgvector"). Expand with recent
 * thread context when available, and use a lower similarity floor.
 */
export function buildRetrievalEmbedText(
  userText: string,
  recentMessages: UIMessage[]
) {
  if (!isRecallStyleQuery(userText)) {
    return userText
  }

  const recentContext = recentMessages
    .slice(-env.MEMORY_RECENT_CONTEXT_MESSAGE_COUNT)
    .map((m) => `${m.role}: ${getMessageText(m)}`)
    .filter((line) => line.length > 0)
    .join("\n")

  if (!recentContext) {
    return `${userText}\n\n${env.MEMORY_RECALL_CONTEXT_SUFFIX}`
  }

  return `${userText}\n\nRecent conversation:\n${recentContext}`
}

export function getRetrievalMinSimilarity(userText: string) {
  return isRecallStyleQuery(userText)
    ? env.MEMORY_RECALL_MIN_SIMILARITY
    : env.MEMORY_MIN_SIMILARITY
}
