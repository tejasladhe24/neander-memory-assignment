import { env, getMemorySecretFilterPattern } from "@/env"
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
    .max(env.MEMORY_EXTRACT_MAX_PER_TURN),
})

export type ExtractedMemory = z.infer<
  typeof extractedMemoriesSchema
>["memories"][number]

export async function extractMemories(params: {
  userMessage: string
  assistantMessage: string
}): Promise<ExtractedMemory[]> {
  const { userMessage, assistantMessage } = params

  if (!userMessage.trim() || !assistantMessage.trim()) {
    return []
  }

  const result = await generateText({
    model: env.MEMORY_EXTRACT_MODEL,
    system: env.MEMORY_EXTRACT_SYSTEM_PROMPT,
    prompt: `User: ${userMessage}\n\nAssistant: ${assistantMessage}`,
    output: Output.object({ schema: extractedMemoriesSchema }),
  })

  const secretPattern = getMemorySecretFilterPattern()

  return result.output.memories.filter(
    (memory) => memory.content.trim() && !secretPattern.test(memory.content)
  )
}
