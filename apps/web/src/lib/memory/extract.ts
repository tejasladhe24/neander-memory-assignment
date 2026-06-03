import { generateText, Output } from "ai"
import z from "zod"

const extractedMemoriesSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z
          .string()
          .describe(
            "A concise, durable statement about the user (preference, decision, or fact)"
          ),
        type: z.enum(["preference", "decision", "fact"]),
      })
    )
    .max(2),
})

export type ExtractedMemory = z.infer<
  typeof extractedMemoriesSchema
>["memories"][number]

const SECRET_PATTERN =
  /\b(sk-[a-zA-Z0-9]+|api[_-]?key|password|secret|token)\b/i

export async function extractMemories(params: {
  userMessage: string
  assistantMessage: string
}): Promise<ExtractedMemory[]> {
  const { userMessage, assistantMessage } = params

  if (!userMessage.trim() || !assistantMessage.trim()) {
    return []
  }

  const result = await generateText({
    model: "openai/gpt-4o-mini",
    system: `Extract 0-2 durable, user-specific memories from this exchange.
Only include preferences, decisions, or facts worth remembering across future conversations.
Skip greetings, small talk, transient tasks, and one-off questions.
Return an empty list if nothing is worth storing.`,
    prompt: `User: ${userMessage}\n\nAssistant: ${assistantMessage}`,
    output: Output.object({ schema: extractedMemoriesSchema }),
  })

  return result.output.memories.filter(
    (memory) => memory.content.trim() && !SECRET_PATTERN.test(memory.content)
  )
}
