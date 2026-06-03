import type { MemorySearchResult } from "@workspace/database"

export function formatMemoriesForPrompt(memories: MemorySearchResult[]) {
  if (memories.length === 0) {
    return "No relevant memories yet."
  }

  return memories
    .map((m, index) => `${index + 1}. [${m.type}] ${m.content}`)
    .join("\n")
}
