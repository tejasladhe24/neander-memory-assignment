import { inngest, type MemoryCreateEvent } from "@/lib/inngest"
import { extractMemories } from "@/lib/memory/extract"
import type { UIMessage } from "ai"

export function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim()
}

export async function queueMemoriesFromTurn(params: {
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

  const extracted = await extractMemories({
    userMessage: userText,
    assistantMessage: assistantText,
  })

  if (extracted.length === 0) {
    return { queued: 0 }
  }

  const events: MemoryCreateEvent[] = extracted.map((memory) => ({
    name: "memory/create",
    data: {
      userId: params.userId,
      content: memory.content,
      type: memory.type,
      sourceChatId: params.sourceChatId,
    },
  }))

  await inngest.send(events)

  return { queued: events.length }
}
