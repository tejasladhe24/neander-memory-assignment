import { env } from "@/env"
import { inngest } from "@/lib/inngest"
import type { UIMessage } from "ai"

export function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim()
}

/** Fire-and-forget: extraction + persistence run in Inngest. */
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
