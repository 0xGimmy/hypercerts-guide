import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import type { Database } from '../db/client.js'
import { transactions } from '../db/schema.js'

type Env = { Variables: { db: Database } }

const querySchema = z.object({
  wallet: z.string().optional(),
  chain: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  offset: z.coerce.number().int().min(0).default(0),
})

export const transactionsRouter = new Hono<Env>()

transactionsRouter.get('/', async (c) => {
  const db = c.get('db')
  const parsed = querySchema.safeParse({
    wallet: c.req.query('wallet'),
    chain: c.req.query('chain'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const { wallet, chain, limit, offset } = parsed.data
  const conditions = []

  if (wallet) {
    conditions.push(eq(transactions.sender, wallet.toLowerCase()))
  }
  if (chain) {
    conditions.push(eq(transactions.chainId, chain))
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(transactions)
          .where(and(...conditions))
          .orderBy(desc(transactions.timestamp))
          .limit(limit)
          .offset(offset)
      : await db
          .select()
          .from(transactions)
          .orderBy(desc(transactions.timestamp))
          .limit(limit)
          .offset(offset)

  return c.json(
    rows.map((r) => ({
      hash: r.hash,
      chainId: r.chainId,
      sender: r.sender,
      receiver: r.receiver,
      token: r.token,
      amount: r.amount,
      decimals: r.decimals,
      timestamp: r.timestamp,
    })),
  )
})
