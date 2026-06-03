export * from "./schema"
export * from "./utils"

import { schema } from "./schema"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"

export function getDb({ url }: { url?: string }) {
  return drizzle(
    new Pool({ connectionString: url ?? process.env.DATABASE_URL }),
    { schema }
  )
}
