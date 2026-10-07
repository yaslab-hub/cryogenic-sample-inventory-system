import pg from 'pg'
import { SCHEMA_SQL } from './schema.js'

/**
 * Connection settings:
 * - On Cloud Run, set INSTANCE_CONNECTION_NAME (project:region:instance) together with
 *   `--add-cloudsql-instances`; the connection then goes through the /cloudsql unix socket.
 * - Locally (or through the Cloud SQL Auth Proxy), set DATABASE_URL or DB_HOST/DB_PORT.
 */
export function createPool(): pg.Pool {
  const common = { max: Number(process.env.DB_POOL_MAX || 5), connectionTimeoutMillis: 10_000 }
  if (process.env.DATABASE_URL) return new pg.Pool({ connectionString: process.env.DATABASE_URL, ...common })

  const instance = process.env.INSTANCE_CONNECTION_NAME
  return new pg.Pool({
    host: instance ? `/cloudsql/${instance}` : process.env.DB_HOST || 'localhost',
    port: instance ? undefined : Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'cryogenic_inventory',
    ...common
  })
}

/** Applies the schema under an advisory lock so several Cloud Run instances can start together. */
export async function migrate(pool: pg.Pool): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock(727001)')
    await client.query(SCHEMA_SQL)
  } finally {
    await client.query('SELECT pg_advisory_unlock(727001)').catch(() => undefined)
    client.release()
  }
}
