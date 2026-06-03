import { db } from "@/lib/db"
import { searchMemoriesByEmbedding } from "@workspace/database"
import { embed, tool } from "ai"
import z from "zod"

export const retrieveMemoryTool = (props: { userId: string }) =>
  tool({
    description: "Use this tool to retrieve memory about a topic for a user.",
    inputSchema: z.object({
      query: z.string().describe("The query to retrieve memory."),
    }),
    execute: async ({ query }) => {
      const { embedding } = await embed({
        model: "openai/text-embedding-3-small",
        value: query,
      })

      return searchMemoriesByEmbedding(db, {
        userId: props.userId,
        embedding,
        limit: 4,
      })
    },
  })
