import { env } from "@/env"
import { db, schema } from "@/lib/db"
import {
  createMemoryRecord,
  extractMemoriesFromTranscript,
  getMessageText,
} from "@/lib/memory"
import { convertToUIMessages } from "@/lib/utils"
import type { PGMessage } from "@workspace/database"
import { and, eq } from "@workspace/database"
import { generateText, type UIMessage } from "ai"

export type ChatContextState = {
  contextSummary: string | null
  compactedMessageCount: number
}

/** Messages sent to the model: rolling summary + uncompacted tail + current turn. */
export function buildMessagesForModel(params: {
  dbMessages: UIMessage[]
  currentMessage: UIMessage
  contextSummary: string | null
  compactedMessageCount: number
}): UIMessage[] {
  const active = [
    ...params.dbMessages.slice(params.compactedMessageCount),
    params.currentMessage,
  ]

  if (!params.contextSummary?.trim()) {
    return active
  }

  return [
    {
      id: "chat-context-summary",
      role: "system",
      parts: [
        {
          type: "text",
          text: `${env.CHAT_CONTEXT_SUMMARY_PREFIX}\n${params.contextSummary}`,
        },
      ],
    },
    ...active,
  ]
}

/** Summarize oldest messages when context tokens exceed threshold; persist facts to memory. */
export async function maybeCompactChatContext(params: {
  chatId: string
  userId: string
  pgMessages: PGMessage[]
  currentMessage?: UIMessage
  contextState: ChatContextState
}): Promise<ChatContextState> {
  const uiMessages = [
    ...convertToUIMessages(params.pgMessages),
    ...(params.currentMessage ? [params.currentMessage] : []),
  ]
  const { compactedMessageCount, contextSummary } = params.contextState
  const uncompacted = uiMessages.slice(compactedMessageCount)

  const tokenCount = uncompacted.reduce(
    (total, message) =>
      total + Math.ceil(getMessageText(message).length / 4) + 4,
    0
  )

  if (tokenCount < env.CHAT_CONTEXT_TOKEN_THRESHOLD) {
    return params.contextState
  }

  const keepRecent = env.CHAT_CONTEXT_KEEP_RECENT_MESSAGES
  if (uncompacted.length <= keepRecent) {
    return params.contextState
  }

  const batch = uncompacted.slice(
    0,
    Math.min(
      env.CHAT_CONTEXT_COMPACT_BATCH_SIZE,
      uncompacted.length - keepRecent
    )
  )

  if (batch.length === 0) {
    return params.contextState
  }

  const transcript = batch
    .map((message) => `${message.role}: ${getMessageText(message)}`)
    .filter((line) => line.length > 0)
    .join("\n")

  const [summaryAddition, extractedMemories] = await Promise.all([
    transcript.trim()
      ? generateText({
          model: env.CHAT_CONTEXT_SUMMARY_MODEL,
          system: env.CHAT_CONTEXT_SUMMARY_SYSTEM_PROMPT,
          prompt: transcript,
        }).then((result) => result.text.trim())
      : Promise.resolve(""),
    extractMemoriesFromTranscript(transcript),
  ])

  const addition = summaryAddition.trim()
  const newSummary = !addition
    ? contextSummary
    : !contextSummary?.trim()
      ? addition
      : `${contextSummary.trim()}\n\n${addition}`
  const newCompactedCount = compactedMessageCount + batch.length

  await Promise.all([
    db
      .update(schema.chat)
      .set({
        contextSummary: newSummary,
        compactedMessageCount: newCompactedCount,
      })
      .where(
        and(
          eq(schema.chat.id, params.chatId),
          eq(schema.chat.userId, params.userId)
        )
      ),
    ...extractedMemories.map((memory) =>
      createMemoryRecord({
        userId: params.userId,
        sourceChatId: params.chatId,
        content: memory.content,
        type: memory.type,
      })
    ),
  ])

  return {
    contextSummary: newSummary,
    compactedMessageCount: newCompactedCount,
  }
}
