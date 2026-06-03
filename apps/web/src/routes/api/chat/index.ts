import { createFileRoute } from "@tanstack/react-router"
import { and, asc, eq, searchMemoriesByEmbedding } from "@workspace/database"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"
import { db, schema } from "@/lib/db"
import { convertToUIMessages, generateUUID } from "@/lib/utils"
import { generateChatTitle } from "@/server/chat"
import { authMiddleware } from "@/middlewares/auth"
import { getCapabilities } from "@/lib/ai/models"
import { retrieveMemoryTool } from "@/lib/ai/tools/memory"
import { formatMemoriesForPrompt } from "@/lib/memory/format"
import { getMessageText, queueMemoriesFromTurn } from "@/lib/memory/queue"
import {
  buildRetrievalEmbedText,
  getRetrievalMinSimilarity,
} from "@/lib/memory/retrieval"

type RequestBody = {
  id: string
  message: UIMessage
  model: string
}

const CHAT_SYSTEM_PROMPT = `You are a helpful assistant.`
const MIN_CHARS_FOR_MEMORY_RETRIEVAL = 3
const EMBEDDING_MODEL = "openai/text-embedding-3-small" as const

export const Route = createFileRoute("/api/chat/")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request: req, context }) => {
        const body = (await req.json()) as RequestBody

        const { id, message, model } = body
        const userId = context.user.id
        const resolvedModel = model

        try {
          const userText = getMessageText(message)
          const capabilitiesPromise = getCapabilities()

          const chat = await db.query.chat.findFirst({
            where: and(eq(schema.chat.id, id), eq(schema.chat.userId, userId)),
          })

          if (!chat) {
            const title = await generateChatTitle(userText)

            await db
              .insert(schema.chat)
              .values({ id, title, userId })
              .returning()
          }

          const [capabilities, dbMessages] = await Promise.all([
            capabilitiesPromise,
            Promise.all([
              db.query.message.findMany({
                where: and(
                  eq(schema.message.chatId, id),
                  eq(schema.message.userId, userId)
                ),
                orderBy: asc(schema.message.createdAt),
              }),
              db.insert(schema.message).values({
                id: message.id,
                chatId: id,
                userId,
                parts: message.parts,
                role: message.role as "user" | "assistant",
              }),
            ]).then(([rows]) => rows),
          ])

          const uiMessages = convertToUIMessages(dbMessages)
          const retrievalEmbedText = buildRetrievalEmbedText(userText, [
            ...uiMessages,
            message,
          ])
          const minSimilarity = getRetrievalMinSimilarity(userText)

          const queryEmbeddingPromise =
            retrievalEmbedText.length >= MIN_CHARS_FOR_MEMORY_RETRIEVAL
              ? embed({
                  value: retrievalEmbedText,
                  model: EMBEDDING_MODEL,
                }).then((result) => result.embedding)
              : Promise.resolve(null)

          const [queryEmbedding] = await Promise.all([queryEmbeddingPromise])

          const isReasoningModel =
            resolvedModel in capabilities
              ? capabilities[resolvedModel].reasoning
              : false

          const [modelMessages, memories] = await Promise.all([
            convertToModelMessages([...uiMessages, message]),
            queryEmbedding
              ? searchMemoriesByEmbedding(db, {
                  userId,
                  embedding: queryEmbedding,
                  limit: 4,
                  minSimilarity,
                })
              : Promise.resolve([]),
          ])

          const memoriesText = formatMemoriesForPrompt(memories)

          const SYSTEM_PROMPT = `${CHAT_SYSTEM_PROMPT}
The following are remembered facts about this user. Use them when relevant. Do not mention the memory system unless asked.

${memoriesText}`

          const stream = createUIMessageStream({
            generateId: generateUUID,
            execute: ({ writer }) => {
              const result = streamText({
                model: resolvedModel,
                system: SYSTEM_PROMPT,
                messages: modelMessages,
                stopWhen: stepCountIs(5),
                tools: {
                  "memory-tool": retrieveMemoryTool({
                    userId,
                  }),
                },
              })

              writer.merge(
                result.toUIMessageStream({ sendReasoning: isReasoningModel })
              )
            },
            onFinish: async ({ messages: finishedMessages }) => {
              await Promise.all(
                finishedMessages.map(async (m) => {
                  await db
                    .insert(schema.message)
                    .values({
                      id: m.id,
                      role: m.role,
                      userId,
                      parts: m.parts,
                      chatId: id,
                    })
                    .onConflictDoUpdate({
                      target: [schema.message.id],
                      set: {
                        role: m.role,
                        parts: m.parts,
                        chatId: id,
                        userId,
                      },
                    })
                })
              )

              const assistantMessages = finishedMessages.filter(
                (m) => m.role === "assistant"
              )

              if (assistantMessages.length > 0) {
                queueMemoriesFromTurn({
                  userId,
                  sourceChatId: id,
                  userMessage: message,
                  assistantMessages,
                })
              }
            },
            onError: (error) => {
              console.error(error)
              return "An error occurred while generating the message."
            },
          })

          return createUIMessageStreamResponse({ stream })
        } catch (error) {
          console.error("Unhandled error in chat API:", error)
          return new Response(
            "An error occurred while generating the message.",
            { status: 500 }
          )
        }
      },
    },
  },
})
