import { env } from "@/env"
import type { MemoryListItem, MemorySearchResult } from "@workspace/database"

type ChatUser = {
  name: string
  email: string
}

function normalizeContent(content: string) {
  return content.trim().toLowerCase()
}

function dedupeMemories<T extends { content: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = normalizeContent(item.content)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function formatMemoryLines(memories: Array<{ content: string; type: string }>) {
  if (memories.length === 0) {
    return "None stored yet."
  }

  return memories
    .map((m, index) => `${index + 1}. [${m.type}] ${m.content}`)
    .join("\n")
}

export function formatUserProfileSection(user: ChatUser) {
  const lines = [`- Name: ${user.name}`]

  if (env.CHAT_INCLUDE_USER_EMAIL) {
    lines.push(`- Email: ${user.email}`)
  }

  return lines.join("\n")
}

export function buildChatSystemPrompt(params: {
  user: ChatUser
  profileMemories: MemoryListItem[]
  queryMemories: MemorySearchResult[]
}) {
  const { user, profileMemories, queryMemories } = params

  const profileFacts = dedupeMemories(profileMemories)
  const queryOnly = dedupeMemories(queryMemories).filter(
    (memory) =>
      !profileFacts.some(
        (p) => normalizeContent(p.content) === normalizeContent(memory.content)
      )
  )

  const profileSection = formatMemoryLines(profileFacts)
  const querySection =
    queryOnly.length > 0 ? formatMemoryLines(queryOnly) : null

  const sections = [
    env.CHAT_SYSTEM_PROMPT,
    "",
    "You are speaking with a signed-in user. Use the profile and memories below. When they ask what you know about them, summarize from this context — do not say you have no information if facts are listed here.",
    "",
    "## User profile",
    formatUserProfileSection(user),
    "",
    "## What you remember about this user",
    profileSection,
  ]

  if (querySection) {
    sections.push(
      "",
      "## Especially relevant to their latest message",
      querySection
    )
  }

  sections.push(
    "",
    "Do not mention this memory system unless asked. Apply remembered facts naturally in your replies."
  )

  return sections.join("\n")
}
