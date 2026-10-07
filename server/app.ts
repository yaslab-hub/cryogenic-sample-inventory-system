import express, { type NextFunction, type Request, type Response } from 'express'
import type pg from 'pg'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HttpError, createSample, getInventory, moveSample, updateSample } from './inventory.js'

export function createApp(pool: pg.Pool, staticDir?: string) {
  const app = express()
  app.disable('x-powered-by')
  // The frontend historically posts text/plain to avoid CORS preflight; accept both.
  app.use(express.json({ type: ['application/json', 'text/plain'], limit: '100kb' }))

  const route = (handler: (req: Request) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
    handler(req).then(data => res.json(data), next)
  }

  app.get('/api/health', route(async () => {
    await pool.query('SELECT 1')
    return { ok: true, service: 'cryogenic-sample-inventory' }
  }))
  app.get('/api/inventory', route(() => getInventory(pool)))
  app.post('/api/samples', route(req => {
    const { action, sample } = req.body ?? {}
    if (action === 'create') return createSample(pool, sample)
    if (action === 'update') return updateSample(pool, sample)
    throw new HttpError(400, 'Unknown action')
  }))
  app.post('/api/move', route(req => moveSample(pool, req.body?.sampleId, req.body?.toLocationId)))
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')))

  const dir = staticDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
  app.use(express.static(dir))

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message })
    if ((error as { type?: string })?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' })
    console.error(error)
    res.status(500).json({ error: 'Internal server error' })
  })
  return app
}
