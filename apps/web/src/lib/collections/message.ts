import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { env } from "@/env"
import type { PGMessage, PGMessageRole } from "@workspace/database"
import { deleteMessage } from "@/server/message"
import type { UIMessage } from "ai"

export const messageCollection = createCollection(
  electricCollectionOptions<
    Partial<PGMessage> & {
      id: string
      chatId: string
      parts: UIMessage["parts"]
      role: PGMessageRole
    }
  >({
    id: "message",
    shapeOptions: {
      url: new URL(
        `/api/shape`,
        typeof window !== `undefined` ? window.location.origin : env.SELF_URL
      ).toString(),
      params: {
        table: `"public"."message"`,
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    getKey: (item) => item.id,
    onDelete: async ({ transaction }) => {
      const newItem = transaction.mutations[0].original

      const result = await deleteMessage({
        data: {
          id: newItem.id,
          chatId: newItem.chatId,
        },
      })

      return { txid: result.txid }
    },
  })
)
