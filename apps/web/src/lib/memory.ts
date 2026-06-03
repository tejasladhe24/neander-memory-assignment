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

export function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim()
}

async function extractMemoriesWithPrompt(prompt: string) {
  const result = await generateText({
    model: env.MEMORY_EXTRACT_MODEL,
    system: env.MEMORY_EXTRACT_SYSTEM_PROMPT,
    prompt,
    output: Output.object({ schema: extractedMemoriesSchema }),
  })

  const secretPattern = getMemorySecretFilterPattern()

  return result.output.memories.filter(
    (memory) => memory.content.trim() && !secretPattern.test(memory.content)
  )
}

export async function extractMemories(params: {
  userMessage: string
  assistantMessage: string
}): Promise<ExtractedMemory[]> {
  const { userMessage, assistantMessage } = params
  if (!userMessage.trim() || !assistantMessage.trim()) {
    return []
  }

  return extractMemoriesWithPrompt(
    `User: ${userMessage}\n\nAssistant: ${assistantMessage}`
  )
}

export async function extractMemoriesFromTranscript(
  transcript: string
): Promise<ExtractedMemory[]> {
  if (!transcript.trim()) {
    return []
  }

  return extractMemoriesWithPrompt(`Conversation excerpt:\n${transcript}`)
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

export function buildRetrievalEmbedText(
  userText: string,
  recentMessages: UIMessage[]
) {
  if (!getMemoryRecallQueryPattern().test(userText)) {
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
  return getMemoryRecallQueryPattern().test(userText)
    ? env.MEMORY_RECALL_MIN_SIMILARITY
    : env.MEMORY_MIN_SIMILARITY
}

export function buildChatSystemPrompt(params: {
  user: { name: string; email: string }
  profileMemories: MemoryRecord[]
  queryMemories: MemorySearchResult[]
}) {
  const { user, profileMemories, queryMemories } = params
  const seen = new Set<string>()
  const contentKey = (content: string) => content.trim().toLowerCase()

  const dedupe = <T extends { content: string }>(items: T[]) =>
    items.filter((item) => {
      const key = contentKey(item.content)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  const formatList = (memories: Array<{ content: string; type: string }>) =>
    memories.length === 0
      ? "None stored yet."
      : memories
          .map((m, i) => `${i + 1}. [${m.type}] ${m.content}`)
          .join("\n")

  const profileFacts = dedupe(profileMemories)
  seen.clear()
  const queryOnly = dedupe(queryMemories).filter(
    (memory) =>
      !profileFacts.some(
        (p) => contentKey(p.content) === contentKey(memory.content)
      )
  )

  const profileLines = [`- Name: ${user.name}`]
  if (env.CHAT_INCLUDE_USER_EMAIL) {
    profileLines.push(`- Email: ${user.email}`)
  }

  const sections = [
    env.CHAT_SYSTEM_PROMPT,
    "",
    "You are speaking with a signed-in user. Use the profile and memories below. When they ask what you know about them, summarize from this context — do not say you have no information if facts are listed here.",
    "",
    "## User profile",
    profileLines.join("\n"),
    "",
    "## What you remember about this user",
    formatList(profileFacts),
  ]

  if (queryOnly.length > 0) {
    sections.push(
      "",
      "## Especially relevant to their latest message",
      formatList(queryOnly)
    )
  }

  sections.push(
    "",
    "Do not mention this memory system unless asked. Apply remembered facts naturally in your replies."
  )

  return sections.join("\n")
}
