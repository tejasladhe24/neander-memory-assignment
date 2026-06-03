import { createFileRoute } from "@tanstack/react-router"
import {
  and,
  asc,
  eq,
  listUserMemories,
  searchMemoriesByEmbedding,
} from "@workspace/database"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  embed,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"
import { env } from "@/env"
import { db, schema } from "@/lib/db"
import { convertToUIMessages, generateUUID } from "@/lib/utils"
import { generateChatTitle } from "@/server/chat"
import { authMiddleware } from "@/middlewares/auth"
import { getCapabilities } from "@/lib/ai/models"
import { retrieveMemoryTool } from "@/lib/ai/tools/memory"
import {
  buildChatSystemPrompt,
  buildRetrievalEmbedText,
  getMessageText,
  getRetrievalMinSimilarity,
} from "@/lib/memory"
import {
  buildMessagesForModel,
  getChatContextState,
  maybeCompactChatContext,
} from "@/lib/chat-context"
import { queueMemoriesFromTurn } from "@/lib/inngest"

type RequestBody = {
  id: string
  message: UIMessage
  model: string
}

export const Route = createFileRoute("/api/chat/")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request: req, context }) => {
        const body = (await req.json()) as RequestBody

        const { id, message, model } = body
        const userId = context.user.id
        const user = context.user
        const resolvedModel = model

        try {
          const userText = getMessageText(message)
          const capabilitiesPromise = getCapabilities()
          const profileMemoriesPromise = listUserMemories(db, {
            userId,
            limit: env.MEMORY_PROFILE_LIMIT,
          })

          let chat = await db.query.chat.findFirst({
            where: and(eq(schema.chat.id, id), eq(schema.chat.userId, userId)),
          })

          if (!chat) {
            const title = await generateChatTitle(userText)

            const [created] = await db
              .insert(schema.chat)
              .values({ id, title, userId })
              .returning()

            chat = created
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

          let contextState = getChatContextState(chat)

          contextState = await maybeCompactChatContext({
            chatId: id,
            userId,
            pgMessages: dbMessages,
            currentMessage: message,
            contextState,
          })

          const uiMessages = convertToUIMessages(dbMessages)
          const messagesForModel = buildMessagesForModel({
            dbMessages: uiMessages,
            currentMessage: message,
            contextSummary: contextState.contextSummary,
            compactedMessageCount: contextState.compactedMessageCount,
          })

          const retrievalEmbedText = buildRetrievalEmbedText(
            userText,
            messagesForModel
          )
          const minSimilarity = getRetrievalMinSimilarity(userText)

          const queryEmbeddingPromise =
            retrievalEmbedText.length >= env.MEMORY_MIN_MESSAGE_LENGTH
              ? embed({
                  value: retrievalEmbedText,
                  model: env.MEMORY_EMBEDDING_MODEL,
                }).then((result) => result.embedding)
              : Promise.resolve(null)

          const [queryEmbedding] = await Promise.all([queryEmbeddingPromise])

          const isReasoningModel =
            resolvedModel in capabilities
              ? capabilities[resolvedModel].reasoning
              : false

          const [modelMessages, profileMemories, queryMemories] =
            await Promise.all([
              convertToModelMessages(messagesForModel),
              profileMemoriesPromise,
              queryEmbedding
                ? searchMemoriesByEmbedding(db, {
                    userId,
                    embedding: queryEmbedding,
                    limit: env.MEMORY_RETRIEVAL_LIMIT,
                    minSimilarity,
                  })
                : Promise.resolve([]),
            ])

          const SYSTEM_PROMPT = buildChatSystemPrompt({
            user: { name: user.name, email: user.email },
            profileMemories,
            queryMemories,
          })

          const stream = createUIMessageStream({
            generateId: generateUUID,
            execute: ({ writer }) => {
              const result = streamText({
                model: resolvedModel,
                system: SYSTEM_PROMPT,
                messages: modelMessages,
                stopWhen: stepCountIs(env.CHAT_STREAM_MAX_STEPS),
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
