import { env } from "@/env"
import { createMemoryRecord } from "@/lib/memory/create"
import { extractMemories } from "@/lib/memory/extract"
import { Inngest } from "inngest"

export type MemoryCreateEvent = {
  name: "memory/create"
  data: {
    userId: string
    content: string
    type: "preference" | "decision" | "fact"
    sourceChatId: string
  }
}

export type MemoryProcessTurnEvent = {
  name: "memory/process-turn"
  data: {
    userId: string
    sourceChatId: string
    userMessage: string
    assistantMessage: string
  }
}

export const inngest = new Inngest({
  id: env.INNGEST_APP_ID,
})

export const createMemory = inngest.createFunction(
  { id: "memory/create", triggers: [{ event: "memory/create" }] },
  async ({ event, step }) => {
    const { userId, content, type, sourceChatId } = event.data

    return step.run("persist-memory", () =>
      createMemoryRecord({ userId, content, type, sourceChatId })
    )
  }
)

export const processTurnMemory = inngest.createFunction(
  { id: "memory/process-turn", triggers: [{ event: "memory/process-turn" }] },
  async ({ event, step }) => {
    const { userId, sourceChatId, userMessage, assistantMessage } = event.data

    const extracted = await step.run("extract-memories", () =>
      extractMemories({ userMessage, assistantMessage })
    )

    if (extracted.length === 0) {
      return { created: 0, skipped: 0 }
    }

    const results = await Promise.all(
      extracted.map((memory, index) =>
        step.run(`persist-memory-${index}`, () =>
          createMemoryRecord({
            userId,
            sourceChatId,
            content: memory.content,
            type: memory.type,
          })
        )
      )
    )

    return {
      created: results.filter((r) => !r.skipped && r.memory).length,
      skipped: results.filter((r) => r.skipped).length,
    }
  }
)
