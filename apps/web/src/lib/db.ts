import { getDb } from "@workspace/database"
import { env } from "@/env"

declare global {
  var _db: ReturnType<typeof getDb>
}

export const db = global._db || getDb({ url: env.POSTGRES_URL })

if (!global._db) {
  global._db = db
}

export * from "@workspace/database"
