import { Hono } from 'hono'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { verifyMessage } from 'viem'
import type { Database } from '../db/client.js'
import { users } from '../db/schema.js'

type Env = { Variables: { db: Database } }

const ethereumAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address')

const SIGNATURE_MAX_AGE_SEC = 300 // 5 minutes

const upsertSchema = z.object({
  address: ethereumAddress,
  name: z.string().min(1).max(50),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/, 'Invalid signature format'),
  timestamp: z.number().int(),
})

export const usersRouter = new Hono<Env>()

usersRouter.get('/', async (c) => {
  const db = c.get('db')
  const rows = await db.select({
    address: users.address,
    name: users.name,
  }).from(users)
  return c.json(rows)
})

usersRouter.get('/:address', async (c) => {
  const db = c.get('db')
  const address = c.req.param('address').toLowerCase()
  const parsed = ethereumAddress.safeParse(c.req.param('address'))

  if (!parsed.success) {
    return c.json({ error: 'Invalid address' }, 400)
  }

  const user = await db.query.users.findFirst({
    where: eq(users.address, address),
  })

  if (!user) return c.json(null, 404)
  return c.json(user)
})

usersRouter.put('/', async (c) => {
  const db = c.get('db')

  const body = await c.req.json().catch(() => null)
  const parsed = upsertSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }

  const address = parsed.data.address.toLowerCase()
  const { name, signature, timestamp } = parsed.data

  // Reject stale signatures to prevent replay attacks
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > SIGNATURE_MAX_AGE_SEC) {
    return c.json({ error: 'Signature expired' }, 400)
  }

  // Verify wallet ownership via signature (message includes timestamp for replay protection)
  const message = `Set display name to: ${name}\nTimestamp: ${timestamp}`
  const isValid = await verifyMessage({
    address: address as `0x${string}`,
    message,
    signature: signature as `0x${string}`,
  })

  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.address, address),
  })

  if (existing) {
    await db
      .update(users)
      .set({ name, updatedAt: now })
      .where(eq(users.address, address))
    return c.body(null, 204)
  }

  await db.insert(users).values({ address, name, createdAt: now, updatedAt: now })
  return c.body(null, 201)
})
