import { createApp } from './app.js'
import { createPool, migrate } from './db.js'

const pool = createPool()
const port = Number(process.env.PORT || 8080)

async function main() {
  if (process.env.SKIP_MIGRATIONS !== 'true') await migrate(pool)
  const server = createApp(pool).listen(port, () => console.log(`Cryogenic inventory listening on :${port}`))
  // Cloud Run sends SIGTERM before stopping an instance.
  process.on('SIGTERM', () => server.close(() => pool.end().finally(() => process.exit(0))))
}

main().catch(error => {
  console.error('Failed to start', error)
  process.exit(1)
})
