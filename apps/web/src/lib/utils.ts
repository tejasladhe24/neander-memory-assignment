import type { PGMessage } from "@workspace/database"
import type { UIMessage } from "ai"
import { v4 as uuidv4 } from "uuid"

export const generateUUID = uuidv4

export function convertToUIMessages(messages: PGMessage[]): UIMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: message.parts as UIMessage["parts"],
  }))
}
