import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { timestamps } from "./utils"
import type { UIMessage } from "ai"

export const $user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  image: text("image"),
  ...timestamps,
})

export type PGUser = typeof $user.$inferSelect

export const $session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => $user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
)

export type PGSession = typeof $session.$inferSelect

export const $account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => $user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
)

export type PGAccount = typeof $account.$inferSelect

export const $verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    ...timestamps,
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

export type PGVerification = typeof $verification.$inferSelect

export const $jwks = pgTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("publicKey").notNull(),
  privateKey: text("privateKey").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export type PGJWKS = typeof $jwks.$inferSelect

export const $chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => $user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [index("chat_user_id_idx").on(table.userId)]
)

export type PGChat = typeof $chat.$inferSelect

const messageRoles = ["user", "system", "assistant"] as const

export const $messageRole = pgEnum("messageRole", messageRoles)

export type PGMessageRole = (typeof messageRoles)[number]

export const $message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chatId")
      .notNull()
      .references(() => $chat.id, { onDelete: "cascade" }),
    role: $messageRole("role").notNull(),
    parts: jsonb("parts").$type<UIMessage["parts"]>().notNull(),
    userId: text("userId")
      .notNull()
      .references(() => $user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [
    index("message_chat_id_idx").on(table.chatId),
    index("message_user_id_idx").on(table.userId),
  ]
)

export type PGMessage = typeof $message.$inferSelect

export const schema = {
  // auth
  user: $user,
  session: $session,
  account: $account,
  verification: $verification,
  jwks: $jwks,

  // chats
  messageRole: $messageRole,
  chat: $chat,
  message: $message,
}
