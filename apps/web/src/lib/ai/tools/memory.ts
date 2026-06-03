import { tool } from "ai"
import z from "zod"

export const memoryTool = (props: { userId: string }) =>
  tool({
    description: "Use this tool to search your memory",
    inputSchema: z.object({
      query: z.string().describe("The query to search your memory"),
    }),
    execute: async ({ query }) => {
      return {
        content: "This is a test response",
      }
    },
  })
