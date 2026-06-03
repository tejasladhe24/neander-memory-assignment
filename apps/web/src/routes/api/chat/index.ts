import { createFileRoute } from "@tanstack/react-router"
import { and, asc, eq, sql } from "drizzle-orm"
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai"
import { db, schema } from "@/lib/db"
import { convertToUIMessages, generateUUID } from "@/lib/utils"
import { generateChatTitle } from "@/server/chat"
import { authMiddleware } from "@/middlewares/auth"
import { getCapabilities } from "@/lib/ai/models"
import { memoryTool } from "@/lib/ai/tools/memory"

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

          const stream = createUIMessageStream({
            generateId: generateUUID,
            execute: ({ writer }) => {
              const result = streamText({
                model: resolvedModel,
                system: CHAT_SYSTEM_PROMPT,
                messages: modelMessages,
                stopWhen: stepCountIs(5),
                tools: {
                  "memory-tool": memoryTool({ userId }),
                },
              })

              writer.merge(
                result.toUIMessageStream({ sendReasoning: isReasoningModel })
              )
            },
            onFinish: async ({ messages }) => {
              await Promise.all(
                messages.map(async (m) => {
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
