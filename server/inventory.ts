import type pg from 'pg'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const QC_STATUSES = ['Pending', 'Passed', 'Failed']
const LOCATION_PATTERN = /^(S[^-]+)-(B[^-]+)-([A-I][1-9])$/

export interface SampleInput {
  id?: string
  cellLine?: string
  sampleType?: string
  passage?: number | null
  cellCount?: number | null
  qcStatus?: string
  owner?: string
  notes?: string
  locationId?: string
}

const SAMPLE_SELECT = `
  SELECT s.id, s.cell_line, s.sample_type, s.passage, s.cell_count, s.qc_status, s.owner, s.notes,
         s.created_at, s.updated_at, st.position_id AS location_id
  FROM samples s
  LEFT JOIN storage st ON st.sample_id = s.id`

function toSample(row: Record<string, any>) {
  return {
    id: row.id as string,
    cellLine: row.cell_line as string,
    sampleType: row.sample_type as string,
    passage: row.passage ?? undefined,
    cellCount: row.cell_count ?? undefined,
    qcStatus: row.qc_status as string,
    owner: row.owner as string,
    locationId: (row.location_id as string | null) ?? '',
    notes: row.notes as string,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }
}

export async function getInventory(pool: pg.Pool) {
  const [samples, boxes] = await Promise.all([
    pool.query(`${SAMPLE_SELECT} ORDER BY s.created_at, s.id`),
    pool.query('SELECT id, stripe_id, name, rows, columns FROM boxes ORDER BY stripe_id, id')
  ])
  return {
    samples: samples.rows.map(toSample),
    boxes: boxes.rows.map(row => ({ id: row.id, stripeId: row.stripe_id, name: row.name, rows: row.rows, columns: row.columns }))
  }
}

async function getSample(db: pg.Pool | pg.PoolClient, id: string) {
  const result = await db.query(`${SAMPLE_SELECT} WHERE s.id = $1`, [id])
  return result.rows[0] ? toSample(result.rows[0]) : null
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new HttpError(400, `${field} must be a non-negative integer`)
  return parsed
}

function validateSample(sample: SampleInput | undefined) {
  if (!sample || !cleanText(sample.id)) throw new HttpError(400, 'sample.id is required')
  if (!cleanText(sample.cellLine)) throw new HttpError(400, 'cellLine is required')
  const qcStatus = sample.qcStatus || 'Pending'
  if (!QC_STATUSES.includes(qcStatus)) throw new HttpError(400, `qcStatus must be one of: ${QC_STATUSES.join(', ')}`)
  return {
    id: cleanText(sample.id),
    cellLine: cleanText(sample.cellLine),
    sampleType: cleanText(sample.sampleType),
    passage: cleanInteger(sample.passage, 'passage'),
    cellCount: cleanInteger(sample.cellCount, 'cellCount'),
    qcStatus,
    owner: cleanText(sample.owner),
    notes: cleanText(sample.notes)
  }
}

function validateLocation(locationId: unknown): string {
  if (typeof locationId !== 'string' || !locationId) throw new HttpError(400, 'locationId is required')
  if (!LOCATION_PATTERN.test(locationId)) throw new HttpError(400, `Invalid location ID: ${locationId}`)
  return locationId
}

/** Runs fn inside a transaction and translates database constraint errors into HTTP errors. */
async function inTransaction<T>(pool: pg.Pool, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw translateDbError(error)
  } finally {
    client.release()
  }
}

function translateDbError(error: unknown): unknown {
  const e = error as { code?: string; constraint?: string }
  if (e?.code === '23505' && e.constraint === 'storage_pkey') return new HttpError(409, 'Storage position is already occupied')
  if (e?.code === '23505' && e.constraint === 'samples_pkey') return new HttpError(409, 'Sample ID already exists')
  if (e?.code === '23503' && e.constraint === 'storage_position_id_fkey') return new HttpError(400, 'Storage position does not exist')
  return error
}

async function assertPositionFree(client: pg.PoolClient, locationId: string) {
  const position = await client.query('SELECT 1 FROM positions WHERE id = $1', [locationId])
  if (!position.rowCount) throw new HttpError(400, `Storage position does not exist: ${locationId}`)
  const occupied = await client.query('SELECT sample_id FROM storage WHERE position_id = $1', [locationId])
  if (occupied.rowCount) throw new HttpError(409, `Storage position is already occupied: ${locationId}`)
}

async function logActivity(client: pg.PoolClient, action: string, sampleId: string, from: string, to: string, details: string) {
  await client.query(
    'INSERT INTO activity_log (action, sample_id, from_location, to_location, details) VALUES ($1, $2, $3, $4, $5)',
    [action, sampleId, from, to, details]
  )
}

export async function createSample(pool: pg.Pool, input: SampleInput | undefined) {
  const sample = validateSample(input)
  const locationId = validateLocation(input?.locationId)
  return inTransaction(pool, async client => {
    await assertPositionFree(client, locationId)
    await client.query(
      `INSERT INTO samples (id, cell_line, sample_type, passage, cell_count, qc_status, owner, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sample.id, sample.cellLine, sample.sampleType, sample.passage, sample.cellCount, sample.qcStatus, sample.owner, sample.notes]
    )
    await client.query('INSERT INTO storage (position_id, sample_id) VALUES ($1, $2)', [locationId, sample.id])
    await logActivity(client, 'CREATE', sample.id, '', locationId, 'Created sample')
    return (await getSample(client, sample.id))!
  })
}

/** Updates sample metadata only. Location changes go through moveSample so they stay atomic. */
export async function updateSample(pool: pg.Pool, input: SampleInput | undefined) {
  const sample = validateSample(input)
  return inTransaction(pool, async client => {
    const result = await client.query(
      `UPDATE samples SET cell_line = $2, sample_type = $3, passage = $4, cell_count = $5,
              qc_status = $6, owner = $7, notes = $8, updated_at = now()
       WHERE id = $1`,
      [sample.id, sample.cellLine, sample.sampleType, sample.passage, sample.cellCount, sample.qcStatus, sample.owner, sample.notes]
    )
    if (!result.rowCount) throw new HttpError(404, `Sample not found: ${sample.id}`)
    const current = await getSample(client, sample.id)
    await logActivity(client, 'UPDATE', sample.id, current!.locationId, current!.locationId, 'Updated sample')
    return current!
  })
}

export async function moveSample(pool: pg.Pool, sampleId: unknown, toLocationId: unknown) {
  if (typeof sampleId !== 'string' || !sampleId) throw new HttpError(400, 'sampleId is required')
  const target = validateLocation(toLocationId)
  return inTransaction(pool, async client => {
    // Lock the sample's storage row so concurrent moves of the same sample serialize.
    const current = await client.query('SELECT position_id FROM storage WHERE sample_id = $1 FOR UPDATE', [sampleId])
    if (!current.rowCount) {
      const exists = await client.query('SELECT 1 FROM samples WHERE id = $1', [sampleId])
      throw new HttpError(exists.rowCount ? 409 : 404, exists.rowCount ? `Storage record not found: ${sampleId}` : `Sample not found: ${sampleId}`)
    }
    const previous = current.rows[0].position_id as string
    if (previous === target) throw new HttpError(400, 'Sample is already in that position')
    await assertPositionFree(client, target)
    await client.query('UPDATE storage SET position_id = $2, assigned_at = now() WHERE sample_id = $1', [sampleId, target])
    await client.query('UPDATE samples SET updated_at = now() WHERE id = $1', [sampleId])
    await logActivity(client, 'MOVE', sampleId, previous, target, 'Moved sample')
    return (await getSample(client, sampleId))!
  })
}
