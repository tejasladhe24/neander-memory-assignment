import { env, getMemoryRecallQueryPattern } from "@/env"
import { db } from "@/lib/db"
import { getRetrievalMinSimilarity } from "@/lib/memory"
import { searchMemoriesByEmbedding } from "@workspace/database"
import { embed, tool } from "ai"
import z from "zod"

export const retrieveMemoryTool = (props: { userId: string }) =>
  tool({
    description: env.MEMORY_TOOL_DESCRIPTION,
    inputSchema: z.object({
      query: z.string().describe(env.MEMORY_TOOL_QUERY_DESCRIPTION),
    }),
    execute: async ({ query }) => {
      const embedText = getMemoryRecallQueryPattern().test(query)
        ? `${query}\n\n${env.MEMORY_RECALL_CONTEXT_SUFFIX}`
        : query

      const { embedding } = await embed({
        model: env.MEMORY_EMBEDDING_MODEL,
        value: embedText,
      })

      return searchMemoriesByEmbedding(db, {
        userId: props.userId,
        embedding,
        limit: env.MEMORY_RETRIEVAL_LIMIT,
        minSimilarity: getRetrievalMinSimilarity(query),
      })
    },
  })
