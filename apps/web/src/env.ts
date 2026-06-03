import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    SELF_URL: z.url(),
    AUTH_SECRET: z.string(),
    AUTH_DOMAIN: z.string(),
    POSTGRES_URL: z.url(),
    RESEND_API_KEY: z.string(),
    EMAIL_SENDER_NAME: z.string(),
    EMAIL_SENDER_ADDRESS: z.email(),
    ELECTRIC_URL: z.url(),
    ELECTRIC_SECRET: z.string(),
    AI_GATEWAY_API_KEY: z.string(),

    // Inngest
    INNGEST_APP_ID: z.string().default("chatbot"),

    // Chat / LLM
    CHAT_SYSTEM_PROMPT: z
      .string()
      .default("You are a helpful assistant."),
    CHAT_STREAM_MAX_STEPS: z.coerce.number().int().positive().default(5),
    CHAT_TITLE_MODEL: z.string().default("openai/gpt-4o-mini"),
    CHAT_TITLE_MAX_LENGTH: z.coerce.number().int().positive().default(64),
    CHAT_TITLE_SYSTEM_PROMPT: z
      .string()
      .default(
        "You are a helpful assistant that generates a title for a chat based on the message text."
      ),
    CHAT_INCLUDE_USER_EMAIL: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    MEMORY_PROFILE_LIMIT: z.coerce.number().int().positive().default(8),

    // Embeddings & models
    MEMORY_EMBEDDING_MODEL: z
      .string()
      .default("openai/text-embedding-3-small"),
    MEMORY_EXTRACT_MODEL: z.string().default("openai/gpt-4o-mini"),

    // Memory retrieval
    MEMORY_MIN_MESSAGE_LENGTH: z.coerce.number().int().min(0).default(3),
    MEMORY_RETRIEVAL_LIMIT: z.coerce.number().int().positive().default(4),
    MEMORY_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.5),
    MEMORY_RECALL_MIN_SIMILARITY: z.coerce.number().min(0).max(1).default(0.35),
    MEMORY_RECALL_QUERY_PATTERN: z
      .string()
      .default(
        "\\b(remember|recall|what did i|told you|you know|my .*(setup|preference|stack))\\b"
      ),
    MEMORY_RECALL_CONTEXT_SUFFIX: z
      .string()
      .default("User preferences, decisions, and facts."),
    MEMORY_RECENT_CONTEXT_MESSAGE_COUNT: z.coerce
      .number()
      .int()
      .positive()
      .default(8),

    // Memory creation
    MEMORY_DUPLICATE_SIMILARITY_THRESHOLD: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0.92),
    MEMORY_EXTRACT_MAX_PER_TURN: z.coerce.number().int().positive().default(2),
    MEMORY_EXTRACT_SYSTEM_PROMPT: z
      .string()
      .default(
        "Extract 0-2 durable, user-specific memories from this exchange. Only include preferences, decisions, or facts worth remembering across future conversations. Skip greetings, small talk, transient tasks, and one-off questions. Return an empty list if nothing is worth storing."
      ),
    MEMORY_SECRET_FILTER_PATTERN: z
      .string()
      .default("\\b(sk-[a-zA-Z0-9]+|api[_-]?key|password|secret|token)\\b"),

    // Memory tool
    MEMORY_TOOL_DESCRIPTION: z
      .string()
      .default(
        "Search stored memories about this user. Use when the user asks what you remember, or when you need their preferences, decisions, or facts."
      ),
    MEMORY_TOOL_QUERY_DESCRIPTION: z
      .string()
      .default("The topic to search memory for."),
  },
  clientPrefix: "VITE_",
  client: {
    VITE_SELF_URL: z.url(),
    VITE_DEFAULT_CHAT_MODEL: z.string().default("gpt-4o-mini"),
  },
  runtimeEnv: {
    SELF_URL: process.env.SELF_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_DOMAIN: process.env.AUTH_DOMAIN,
    POSTGRES_URL: process.env.POSTGRES_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_SENDER_NAME: process.env.EMAIL_SENDER_NAME,
    EMAIL_SENDER_ADDRESS: process.env.EMAIL_SENDER_ADDRESS,
    ELECTRIC_URL: process.env.ELECTRIC_URL,
    ELECTRIC_SECRET: process.env.ELECTRIC_SECRET,
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,

    INNGEST_APP_ID: process.env.INNGEST_APP_ID,
    CHAT_SYSTEM_PROMPT: process.env.CHAT_SYSTEM_PROMPT,
    CHAT_STREAM_MAX_STEPS: process.env.CHAT_STREAM_MAX_STEPS,
    CHAT_TITLE_MODEL: process.env.CHAT_TITLE_MODEL,
    CHAT_TITLE_MAX_LENGTH: process.env.CHAT_TITLE_MAX_LENGTH,
    CHAT_TITLE_SYSTEM_PROMPT: process.env.CHAT_TITLE_SYSTEM_PROMPT,
    CHAT_INCLUDE_USER_EMAIL: process.env.CHAT_INCLUDE_USER_EMAIL,
    MEMORY_PROFILE_LIMIT: process.env.MEMORY_PROFILE_LIMIT,

    MEMORY_EMBEDDING_MODEL: process.env.MEMORY_EMBEDDING_MODEL,
    MEMORY_EXTRACT_MODEL: process.env.MEMORY_EXTRACT_MODEL,
    MEMORY_MIN_MESSAGE_LENGTH: process.env.MEMORY_MIN_MESSAGE_LENGTH,
    MEMORY_RETRIEVAL_LIMIT: process.env.MEMORY_RETRIEVAL_LIMIT,
    MEMORY_MIN_SIMILARITY: process.env.MEMORY_MIN_SIMILARITY,
    MEMORY_RECALL_MIN_SIMILARITY: process.env.MEMORY_RECALL_MIN_SIMILARITY,
    MEMORY_RECALL_QUERY_PATTERN: process.env.MEMORY_RECALL_QUERY_PATTERN,
    MEMORY_RECALL_CONTEXT_SUFFIX: process.env.MEMORY_RECALL_CONTEXT_SUFFIX,
    MEMORY_RECENT_CONTEXT_MESSAGE_COUNT:
      process.env.MEMORY_RECENT_CONTEXT_MESSAGE_COUNT,
    MEMORY_DUPLICATE_SIMILARITY_THRESHOLD:
      process.env.MEMORY_DUPLICATE_SIMILARITY_THRESHOLD,
    MEMORY_EXTRACT_MAX_PER_TURN: process.env.MEMORY_EXTRACT_MAX_PER_TURN,
    MEMORY_EXTRACT_SYSTEM_PROMPT: process.env.MEMORY_EXTRACT_SYSTEM_PROMPT,
    MEMORY_SECRET_FILTER_PATTERN: process.env.MEMORY_SECRET_FILTER_PATTERN,
    MEMORY_TOOL_DESCRIPTION: process.env.MEMORY_TOOL_DESCRIPTION,
    MEMORY_TOOL_QUERY_DESCRIPTION: process.env.MEMORY_TOOL_QUERY_DESCRIPTION,

    VITE_SELF_URL: import.meta.env.VITE_SELF_URL as string,
    VITE_DEFAULT_CHAT_MODEL: import.meta.env.VITE_DEFAULT_CHAT_MODEL as string,
  },
})

export function getMemoryRecallQueryPattern() {
  return new RegExp(env.MEMORY_RECALL_QUERY_PATTERN, "i")
}

export function getMemorySecretFilterPattern() {
  return new RegExp(env.MEMORY_SECRET_FILTER_PATTERN, "i")
}
