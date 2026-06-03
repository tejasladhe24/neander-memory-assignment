import { db, generateTxId, schema } from "@/lib/db"
import { authMiddleware } from "@/middlewares/auth"
import { createServerFn } from "@tanstack/react-start"
import z from "zod"
import { and, eq } from "drizzle-orm"
import type { UIMessage } from "ai"

export const updateMessage = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      id: z.string(),
      content: z.string(),
      chatId: z.string(),
    })
  )
  .handler(async ({ context, data }) => {
    const result = await db.transaction(async (tx) => {
      const txid = await generateTxId(tx)

      const parts = [
        {
          type: "text",
          text: data.content,
        },
      ] as UIMessage["parts"]

      const [message] = await tx
        .update(schema.message)
        .set({
          parts: parts,
          chatId: data.chatId,
        })
        .where(
          and(
            eq(schema.message.id, data.id),
            eq(schema.message.chatId, data.chatId),
            eq(schema.message.userId, context.user.id)
          )
        )
        .returning()

      if (!message) {
        throw new Error("Failed to update message")
      }

      return { txid }
    })

    return result
  })

export const deleteMessage = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      id: z.string(),
      chatId: z.string(),
    })
  )
  .handler(async ({ context, data }) => {
    const result = await db.transaction(async (tx) => {
      const txid = await generateTxId(tx)

      const [message] = await tx
        .delete(schema.message)
        .where(
          and(
            eq(schema.message.id, data.id),
            eq(schema.message.chatId, data.chatId),
            eq(schema.message.userId, context.user.id)
          )
        )
        .returning()

      if (!message) {
        throw new Error("Failed to delete message")
      }

      return { txid }
    })

    return result
  })
