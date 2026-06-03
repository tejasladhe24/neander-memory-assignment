import { createCollection } from "@tanstack/react-db"
import { electricCollectionOptions } from "@tanstack/electric-db-collection"
import { env } from "@/env"
import type { PGChat } from "@workspace/database"
import { createChat, deleteChat, updateChat } from "@/server/chat"

export const chatCollection = createCollection(
  electricCollectionOptions<
    Partial<PGChat> & {
      id: string
      title: string
      userId: string
    }
  >({
    id: "chat",
    shapeOptions: {
      url: new URL(
        `/api/shape`,
        typeof window !== `undefined` ? window.location.origin : env.SELF_URL
      ).toString(),
      params: {
        table: `"public"."chat"`,
      },
      parser: {
        timestamptz: (date: string) => {
          return new Date(date)
        },
      },
    },
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      const newItem = transaction.mutations[0].modified

      const result = await createChat({
        data: {
          id: newItem.id,
          title: newItem.title,
        },
      })

      return { txid: result.txid }
    },
    onUpdate: async ({ transaction }) => {
      const newItem = transaction.mutations[0].modified

      const result = await updateChat({
        data: {
          id: newItem.id,
          title: newItem.title,
        },
      })

      return { txid: result.txid }
    },
    onDelete: async ({ transaction }) => {
      const newItem = transaction.mutations[0].original

      const result = await deleteChat({
        data: {
          id: newItem.id,
        },
      })

      return { txid: result.txid }
    },
  })
)
