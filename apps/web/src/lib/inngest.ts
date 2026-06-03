import { createMemoryRecord } from "@/lib/memory/create"
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

export const inngest = new Inngest({
  id: "chatbot",
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
