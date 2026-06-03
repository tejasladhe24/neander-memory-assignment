import { Pool } from "pg"
import { timestamp } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"

export type Drizzle<
  SCHEMA extends Record<string, unknown> = Record<string, unknown>,
> = Awaited<ReturnType<typeof drizzle<SCHEMA>>>

export type Transaction = Parameters<Parameters<Drizzle["transaction"]>[0]>[0]

export type TxResult<T> = {
  data: T
  txid: number
}

export function getDb({ url, schema }: { url?: string; schema: any }) {
  return drizzle(
    new Pool({ connectionString: url ?? process.env.DATABASE_URL }),
    { schema }
  )
}

export const timestamps = {
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .$onUpdate(() => /* __@PURE__ */ new Date())
    .notNull(),
}

export async function generateTxId(tx: Transaction) {
  // The ::xid cast strips off the epoch, giving you the raw 32-bit value
  // that matches what PostgreSQL sends in logical replication streams
  // (and then exposed through Electric which we'll match against
  // in the client).
  const result = await tx.execute(
    sql`SELECT pg_current_xact_id()::xid::text as txid`
  )
  const txid = result.rows[0]?.txid

  if (txid === undefined) {
    throw new Error(`Failed to get transaction ID`)
  }

  return parseInt(txid as string, 10)
}
