import { Hono } from 'hono'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import type { Database } from '../db/client.js'
import { transactions } from '../db/schema.js'
import { calculateOrgDonations, calculateUserDonations } from '../lib/points.js'
import type { Transaction } from '@repo/shared'

type Env = { Variables: { db: Database } }

export const donationsRouter = new Hono<Env>()

function rowsToTransactions(rows: (typeof transactions.$inferSelect)[]): Transaction[] {
  return rows.map((r) => ({
    hash: r.hash,
    chainId: r.chainId,
    sender: r.sender,
    receiver: r.receiver,
    token: r.token,
    amount: r.amount,
    decimals: r.decimals,
    timestamp: r.timestamp,
  }))
}

// In-memory cache with TTL (per-isolate on CF Workers — supplementary, not primary)
let cache: { data: Transaction[]; timestamp: number } | null = null
const CACHE_TTL_MS = 30_000

async function getCachedTransactions(db: Database): Promise<Transaction[]> {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data
  }
  const rows = await db.select().from(transactions)
  const data = rowsToTransactions(rows)
  cache = { data, timestamp: now }
  return data
}

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

donationsRouter.get('/', async (c) => {
  const db = c.get('db')
  const parsed = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }
  const { limit, offset } = parsed.data

  const rows = await db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.timestamp))
    .limit(limit)
    .offset(offset)

  return c.json(rowsToTransactions(rows))
})

donationsRouter.get('/organizations', async (c) => {
  const db = c.get('db')
  const data = await getCachedTransactions(db)
  const result = calculateOrgDonations(data)
  return c.json(result)
})

donationsRouter.get('/users', async (c) => {
  const db = c.get('db')
  const data = await getCachedTransactions(db)
  const result = calculateUserDonations(data)
  return c.json(result)
})
