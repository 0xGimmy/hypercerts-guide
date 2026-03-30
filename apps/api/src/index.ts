import { Hono } from 'hono'
import type { Database } from './db/client.js'
import { createDb } from './db/client.js'
import { corsMiddleware } from './middleware/cors.js'
import { rateLimit } from './middleware/rate-limit.js'
import { donationsRouter } from './routes/donations.js'
import { transactionsRouter } from './routes/transactions.js'
import { usersRouter } from './routes/users.js'
import { syncAllChains } from './jobs/sync.js'

type Bindings = { DB: D1Database }
type Variables = { db: Database }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Global middleware
app.use('*', corsMiddleware)
app.use('*', rateLimit(60_000, 60)) // 60 req/min per IP
app.use('/users', rateLimit(60_000, 10)) // Stricter limit for write operations

app.use('*', async (c, next) => {
  const db = createDb(c.env.DB)
  c.set('db', db)
  return next()
})

// Routes
app.route('/donations', donationsRouter)
app.route('/transactions', transactionsRouter)
app.route('/users', usersRouter)

// Health check
app.get('/', (c) => c.json({ status: 'ok' }))

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Bindings) {
    const db = createDb(env.DB)
    await syncAllChains(db)
  },
}
