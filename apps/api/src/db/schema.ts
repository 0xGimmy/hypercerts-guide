import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    hash: text('hash').notNull(),
    chainId: integer('chain_id').notNull(),
    sender: text('sender').notNull(),
    receiver: text('receiver').notNull(),
    token: text('token').notNull(),
    amount: text('amount').notNull(),
    decimals: integer('decimals').notNull(),
    timestamp: integer('timestamp').notNull(),
  },
  (table) => [
    uniqueIndex('tx_unique').on(table.hash, table.receiver, table.chainId),
  ],
)

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  address: text('address').unique().notNull(),
  name: text('name'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
})

export const syncState = sqliteTable('sync_state', {
  id: text('id').primaryKey(), // format: "{chainId}:{contractType}"
  chainId: integer('chain_id').notNull(),
  contractType: text('contract_type').notNull(), // 'legacy' | 'router'
  lastBlock: integer('last_block').notNull().default(0),
})
