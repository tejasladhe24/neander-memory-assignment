import { env } from "@/env"
import { db, generateTxId, schema } from "@/lib/db"
import { authMiddleware } from "@/middlewares/auth"
import { createServerFn } from "@tanstack/react-start"
import z from "zod"
import { and, eq } from "@workspace/database"
import { generateText, Output } from "ai"

export const createChat = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string(),
    })
  )

  .handler(async ({ context, data }) => {
    const result = await db.transaction(async (tx) => {
      const txid = await generateTxId(tx)

      const [chat] = await tx
        .insert(schema.chat)
        .values({
          id: data.id,
          title: data.title,
          userId: context.user.id,
        })
        .returning()

      if (!chat) {
        throw new Error("Failed to create chat")
      }

      return { txid, chat }
    })

    return result
  })

export const updateChat = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string(),
    })
  )
  .handler(async ({ context, data }) => {
    const result = await db.transaction(async (tx) => {
      const txid = await generateTxId(tx)

      const [chat] = await tx
        .update(schema.chat)
        .set({
          title: data.title,
        })
        .where(
          and(
            eq(schema.chat.id, data.id),
            eq(schema.chat.userId, context.user.id)
          )
        )
        .returning()

      if (!chat) {
        throw new Error("Failed to update chat")
      }

      return { txid, chat }
    })

    return result
  })

export const deleteChat = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      id: z.string(),
    })
  )
  .handler(async ({ context, data }) => {
    const result = await db.transaction(async (tx) => {
      const txid = await generateTxId(tx)

      const [chat] = await tx
        .delete(schema.chat)
        .where(
          and(
            eq(schema.chat.id, data.id),
            eq(schema.chat.userId, context.user.id)
          )
        )
        .returning()

      if (!chat) {
        throw new Error("Failed to delete chat")
      }

      return { txid, chat }
    })

    return result
  })

export const generateChatTitle = async (messageText: string) => {
  return await generateText({
    model: env.CHAT_TITLE_MODEL,
    system: env.CHAT_TITLE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: messageText,
      },
    ],
    output: Output.object({
      schema: z.object({
        title: z
          .string()
          .max(env.CHAT_TITLE_MAX_LENGTH)
          .describe("Short title describing the conversation"),
      }),
    }),
  }).then((result) => result.output.title)
}
