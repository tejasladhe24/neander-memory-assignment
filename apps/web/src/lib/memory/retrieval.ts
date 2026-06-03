import type { UIMessage } from "ai"
import { getMessageText } from "@/lib/memory/queue"

/** User is asking the agent to recall something from memory. */
const RECALL_QUERY_PATTERN =
  /\b(remember|recall|what did i|told you|you know|my .*(setup|preference|stack))\b/i

export function isRecallStyleQuery(text: string) {
  return RECALL_QUERY_PATTERN.test(text)
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
    .slice(-8)
    .map((m) => `${m.role}: ${getMessageText(m)}`)
    .filter((line) => line.length > 0)
    .join("\n")

  if (!recentContext) {
    return `${userText}\n\nUser preferences, decisions, and facts.`
  }

  return `${userText}\n\nRecent conversation:\n${recentContext}`
}

export function getRetrievalMinSimilarity(userText: string) {
  return isRecallStyleQuery(userText) ? 0.35 : 0.5
}
