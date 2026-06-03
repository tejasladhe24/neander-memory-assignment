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

const SUMMARY_MESSAGE_ID = "chat-context-summary"

export type ChatContextState = {
  contextSummary: string | null
  compactedMessageCount: number
}

export function estimateTokens(text: string) {
  return Math.ceil(text.length / 4)
}

export function estimateMessagesTokenCount(messages: UIMessage[]) {
  return messages.reduce(
    (total, message) =>
      total + estimateTokens(getMessageText(message)) + 4,
    0
  )
}

export function getUncompactedMessages(
  messages: UIMessage[],
  compactedMessageCount: number
) {
  return messages.slice(compactedMessageCount)
}

export function selectOldestMessagesForCompaction(
  messages: UIMessage[],
  compactedMessageCount: number,
  batchSize: number,
  keepRecent: number
) {
  const uncompacted = getUncompactedMessages(messages, compactedMessageCount)
  if (uncompacted.length <= keepRecent) {
    return []
  }

  const compactableCount = uncompacted.length - keepRecent
  const take = Math.min(batchSize, compactableCount)
  return uncompacted.slice(0, take)
}

export function formatMessagesForSummary(messages: UIMessage[]) {
  return messages
    .map((message) => `${message.role}: ${getMessageText(message)}`)
    .filter((line) => line.length > 0)
    .join("\n")
}

export function mergeContextSummaries(
  existing: string | null,
  addition: string
) {
  const trimmed = addition.trim()
  if (!trimmed) return existing

  if (!existing?.trim()) {
    return trimmed
  }

  return `${existing.trim()}\n\n${trimmed}`
}

export function buildContextSummaryMessage(
  contextSummary: string
): UIMessage {
  return {
    id: SUMMARY_MESSAGE_ID,
    role: "system",
    parts: [
      {
        type: "text",
        text: `${env.CHAT_CONTEXT_SUMMARY_PREFIX}\n${contextSummary}`,
      },
    ],
  }
}

export function buildMessagesForModel(params: {
  dbMessages: UIMessage[]
  currentMessage: UIMessage
  contextSummary: string | null
  compactedMessageCount: number
}): UIMessage[] {
  const active = [
    ...getUncompactedMessages(
      params.dbMessages,
      params.compactedMessageCount
    ),
    params.currentMessage,
  ]

  if (!params.contextSummary?.trim()) {
    return active
  }

  return [
    buildContextSummaryMessage(params.contextSummary),
    ...active,
  ]
}

export function shouldCompactContext(
  messages: UIMessage[],
  compactedMessageCount: number
) {
  const uncompacted = getUncompactedMessages(messages, compactedMessageCount)
  return (
    estimateMessagesTokenCount(uncompacted) >=
    env.CHAT_CONTEXT_TOKEN_THRESHOLD
  )
}

async function summarizeMessageBatch(messages: UIMessage[]) {
  const transcript = formatMessagesForSummary(messages)
  if (!transcript.trim()) {
    return ""
  }

  const { text } = await generateText({
    model: env.CHAT_CONTEXT_SUMMARY_MODEL,
    system: env.CHAT_CONTEXT_SUMMARY_SYSTEM_PROMPT,
    prompt: transcript,
  })

  return text.trim()
}

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

  if (!shouldCompactContext(uiMessages, compactedMessageCount)) {
    return params.contextState
  }

  const batch = selectOldestMessagesForCompaction(
    uiMessages,
    compactedMessageCount,
    env.CHAT_CONTEXT_COMPACT_BATCH_SIZE,
    env.CHAT_CONTEXT_KEEP_RECENT_MESSAGES
  )

  if (batch.length === 0) {
    return params.contextState
  }

  const [summaryAddition, extractedMemories] = await Promise.all([
    summarizeMessageBatch(batch),
    extractMemoriesFromTranscript(formatMessagesForSummary(batch)),
  ])

  const newSummary = mergeContextSummaries(
    contextSummary,
    summaryAddition
  )
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

export function getChatContextState(
  chat: {
    contextSummary: string | null
    compactedMessageCount: number | null
  } | null | undefined
): ChatContextState {
  return {
    contextSummary: chat?.contextSummary ?? null,
    compactedMessageCount: chat?.compactedMessageCount ?? 0,
  }
}
