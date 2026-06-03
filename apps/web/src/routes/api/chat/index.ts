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
import { getMessageText, queueMemoriesFromTurn } from "@/lib/memory/queue"

type RequestBody = {
  id: string
  message: UIMessage
  model: string
}

const CHAT_SYSTEM_PROMPT = `You are a helpful assistant.`

export const Route = createFileRoute("/api/chat/")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      POST: async ({ request: req, context }) => {
        const body = (await req.json()) as RequestBody

        const { id, message, model } = body
        const userId = context.session.userId
        const resolvedModel = model

        try {
          const capabilitiesPromise = getCapabilities()

          const chat = await db.query.chat.findFirst({
            where: and(eq(schema.chat.id, id), eq(schema.chat.userId, userId)),
          })

          if (!chat) {
            const title = await generateChatTitle(
              message.parts
                .map((part) => (part.type === "text" ? part.text : ""))
                .join(" ")
            )

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

          const isReasoningModel =
            resolvedModel in capabilities
              ? capabilities[resolvedModel].reasoning
              : false

          const uiMessages = convertToUIMessages(dbMessages)
          const modelMessages = await convertToModelMessages([
            ...uiMessages,
            message,
          ])

          // Retrieve memories relevant to the current user message
          const userText = getMessageText(message)

          const { embedding: queryEmbedding } = await embed({
            value: userText,
            model: "openai/text-embedding-3-small",
          })

          const memories = await searchMemoriesByEmbedding(db, {
            userId,
            embedding: queryEmbedding,
            limit: 4,
          })

          const memoriesText =
            memories.length > 0
              ? memories
                  .map(
                    (m, index) =>
                      `${index + 1}. [${m.type}] ${m.content} (similarity: ${m.similarity.toFixed(2)})`
                  )
                  .join("\n")
              : "No relevant memories yet."

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

              console.log("assistantMessages", assistantMessages)

              if (assistantMessages.length > 0) {
                try {
                  await queueMemoriesFromTurn({
                    userId,
                    sourceChatId: id,
                    userMessage: message,
                    assistantMessages,
                  })
                } catch (error) {
                  console.error("Failed to queue memory creation:", error)
                }
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
