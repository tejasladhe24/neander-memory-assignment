import { env } from "@/env"
import {
  createMemoryRecord,
  extractMemories,
  getMessageText,
} from "@/lib/memory"
import { Inngest } from "inngest"
import type { UIMessage } from "ai"

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

export function queueMemoriesFromTurn(params: {
  userId: string
  sourceChatId: string
  userMessage: UIMessage
  assistantMessages: UIMessage[]
}) {
  const userText = getMessageText(params.userMessage)
  const assistantText = params.assistantMessages
    .map(getMessageText)
    .filter(Boolean)
    .join("\n")

  if (
    userText.length < env.MEMORY_MIN_MESSAGE_LENGTH ||
    assistantText.length < env.MEMORY_MIN_MESSAGE_LENGTH
  ) {
    return
  }

  void inngest
    .send({
      name: "memory/process-turn",
      data: {
        userId: params.userId,
        sourceChatId: params.sourceChatId,
        userMessage: userText,
        assistantMessage: assistantText,
      },
    })
    .catch((error) => {
      console.error("Failed to queue memory/process-turn:", error)
    })
}

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
