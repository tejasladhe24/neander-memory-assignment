import { env, getMemoryRecallQueryPattern, getMemorySecretFilterPattern } from "@/env"
import { db } from "@/lib/db"
import { generateUUID } from "@/lib/utils"
import {
  schema,
  searchMemoriesByEmbedding,
  type MemoryRecord,
  type MemorySearchResult,
} from "@workspace/database"
import { generateText, Output, type UIMessage } from "ai"
import { embed } from "ai"
import z from "zod"

export type CreateMemoryInput = {
  userId: string
  content: string
  type: "preference" | "decision" | "fact"
  sourceChatId: string
}

const extractedMemoriesSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z
          .string()
          .describe(
            "A concise, durable statement about the user (preference, decision, or fact)"
          ),
        type: z.enum(["preference", "decision", "fact"]),
      })
    )
    .max(env.MEMORY_EXTRACT_MAX_PER_TURN),
})

export type ExtractedMemory = z.infer<
  typeof extractedMemoriesSchema
>["memories"][number]

type ChatUser = {
  name: string
  email: string
}

export function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim()
}

export async function extractMemories(params: {
  userMessage: string
  assistantMessage: string
}): Promise<ExtractedMemory[]> {
  const { userMessage, assistantMessage } = params

  if (!userMessage.trim() || !assistantMessage.trim()) {
    return []
  }

  const result = await generateText({
    model: env.MEMORY_EXTRACT_MODEL,
    system: env.MEMORY_EXTRACT_SYSTEM_PROMPT,
    prompt: `User: ${userMessage}\n\nAssistant: ${assistantMessage}`,
    output: Output.object({ schema: extractedMemoriesSchema }),
  })

  const secretPattern = getMemorySecretFilterPattern()

  return result.output.memories.filter(
    (memory) => memory.content.trim() && !secretPattern.test(memory.content)
  )
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

export function isRecallStyleQuery(text: string) {
  return getMemoryRecallQueryPattern().test(text)
}

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

function normalizeContent(content: string) {
  return content.trim().toLowerCase()
}

function dedupeMemories<T extends { content: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normalizeContent(item.content)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatMemoryLines(memories: Array<{ content: string; type: string }>) {
  if (memories.length === 0) {
    return "None stored yet."
  }

  return memories
    .map((m, index) => `${index + 1}. [${m.type}] ${m.content}`)
    .join("\n")
}

function formatUserProfileSection(user: ChatUser) {
  const lines = [`- Name: ${user.name}`]

  if (env.CHAT_INCLUDE_USER_EMAIL) {
    lines.push(`- Email: ${user.email}`)
  }

  return lines.join("\n")
}

export function buildChatSystemPrompt(params: {
  user: ChatUser
  profileMemories: MemoryRecord[]
  queryMemories: MemorySearchResult[]
}) {
  const { user, profileMemories, queryMemories } = params

  const profileFacts = dedupeMemories(profileMemories)
  const queryOnly = dedupeMemories(queryMemories).filter(
    (memory) =>
      !profileFacts.some(
        (p) => normalizeContent(p.content) === normalizeContent(memory.content)
      )
  )

  const profileSection = formatMemoryLines(profileFacts)
  const querySection =
    queryOnly.length > 0 ? formatMemoryLines(queryOnly) : null

  const sections = [
    env.CHAT_SYSTEM_PROMPT,
    "",
    "You are speaking with a signed-in user. Use the profile and memories below. When they ask what you know about them, summarize from this context — do not say you have no information if facts are listed here.",
    "",
    "## User profile",
    formatUserProfileSection(user),
    "",
    "## What you remember about this user",
    profileSection,
  ]

  if (querySection) {
    sections.push(
      "",
      "## Especially relevant to their latest message",
      querySection
    )
  }

  sections.push(
    "",
    "Do not mention this memory system unless asked. Apply remembered facts naturally in your replies."
  )

  return sections.join("\n")
}
