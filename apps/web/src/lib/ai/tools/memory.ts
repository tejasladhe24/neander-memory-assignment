import { db } from "@/lib/db"
import { searchMemoriesByEmbedding } from "@workspace/database"
import {
  getRetrievalMinSimilarity,
  isRecallStyleQuery,
} from "@/lib/memory/retrieval"
import { embed, tool } from "ai"
import z from "zod"

export const retrieveMemoryTool = (props: { userId: string }) =>
  tool({
    description:
      "Search stored memories about this user. Use when the user asks what you remember, or when you need their preferences, decisions, or facts.",
    inputSchema: z.object({
      query: z.string().describe("The topic to search memory for."),
    }),
    execute: async ({ query }) => {
      const embedText = isRecallStyleQuery(query)
        ? `${query}\n\nUser preferences, decisions, and facts.`
        : query

      const { embedding } = await embed({
        model: "openai/text-embedding-3-small",
        value: embedText,
      })

      return searchMemoriesByEmbedding(db, {
        userId: props.userId,
        embedding,
        limit: 4,
        minSimilarity: getRetrievalMinSimilarity(query),
      })
    },
  })
