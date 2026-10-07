import { createPool, migrate } from './db.js'

/** Mirrors the demo dataset of the old Apps Script seedDemoData(); refuses to run on a non-empty database. */
const STRIPES = [['S1', 'Stripe 1'], ['S2', 'Stripe 2']]
const BOXES = [['S1-B01', 'S1', 'Box 01'], ['S1-B02', 'S1', 'Box 02'], ['S2-B01', 'S2', 'Box 01']]
const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
const ROWS = 9
const SAMPLES = [
  ['YAS-001', 'HEK293T', 'Cell line', 12, 5, 'Passed', 'YAS', 'Working stock', 'S1-B01-C3'],
  ['YAS-002', 'HeLa', 'Cell line', 8, 4, 'Pending', 'Alex', 'Awaiting QC', 'S1-B01-F6'],
  ['YAS-003', 'CHO-K1', 'Cell line', 6, 3, 'Passed', 'YAS', 'Backup stock', 'S1-B02-A1']
] as const

const pool = createPool()
const client = await pool.connect()
try {
  await migrate(pool)
  await client.query('BEGIN')
  const existing = await client.query('SELECT (SELECT count(*) FROM boxes) + (SELECT count(*) FROM samples) AS n')
  if (Number(existing.rows[0].n) > 0) throw new Error('Demo data was not inserted because inventory data already exists.')

  for (const [id, name] of STRIPES) await client.query('INSERT INTO stripes (id, name) VALUES ($1, $2)', [id, name])
  for (const [id, stripeId, name] of BOXES) {
    await client.query('INSERT INTO boxes (id, stripe_id, name, rows, columns) VALUES ($1, $2, $3, $4, $5)', [id, stripeId, name, ROWS, COLUMNS])
    for (const col of COLUMNS) {
      for (let row = 1; row <= ROWS; row++) {
        await client.query('INSERT INTO positions (id, box_id, row_num, col) VALUES ($1, $2, $3, $4)', [`${id}-${col}${row}`, id, row, col])
      }
    }
  }
  for (const [id, cellLine, sampleType, passage, cellCount, qcStatus, owner, notes, location] of SAMPLES) {
    await client.query(
      'INSERT INTO samples (id, cell_line, sample_type, passage, cell_count, qc_status, owner, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, cellLine, sampleType, passage, cellCount, qcStatus, owner, notes]
    )
    await client.query('INSERT INTO storage (position_id, sample_id) VALUES ($1, $2)', [location, id])
    await client.query(
      "INSERT INTO activity_log (action, sample_id, to_location, actor, details) VALUES ('SEED', $1, $2, 'SYSTEM', 'Inserted demo inventory')",
      [id, location]
    )
  }
  await client.query('COMMIT')
  console.log('Seeded demo inventory: 2 stripes, 3 boxes, 3 samples.')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
