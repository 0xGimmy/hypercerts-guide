import { createPublicClient, http, parseEventLogs, type Log } from 'viem'
import { eq } from 'drizzle-orm'
import {
  chains,
  DonationRouterABI,
  LegacyTransactionLoggerABI,
  type ChainConfig,
  type LegacyContract,
} from '@repo/shared'
import type { Database } from '../db/client.js'
import { transactions, syncState } from '../db/schema.js'

const BLOCK_RANGE = 50_000n // blocks per getLogs call (will auto-reduce if RPC rejects)
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1_000

interface SyncContext {
  db: Database
  chainConfig: ChainConfig
}

type TxRow = Omit<typeof transactions.$inferInsert, 'id'>

async function getSyncState(
  db: Database,
  chainId: number,
  contractType: string,
): Promise<number> {
  const id = `${chainId}:${contractType}`
  const row = await db.query.syncState.findFirst({
    where: eq(syncState.id, id),
  })
  return row?.lastBlock ?? 0
}

async function setSyncState(
  db: Database,
  chainId: number,
  contractType: string,
  lastBlock: number,
): Promise<void> {
  const id = `${chainId}:${contractType}`
  await db
    .insert(syncState)
    .values({ id, chainId, contractType, lastBlock })
    .onConflictDoUpdate({
      target: syncState.id,
      set: { lastBlock },
    })
}

function parseLegacyLogs(
  logs: Log[],
  chainConfig: ChainConfig,
  legacy: LegacyContract,
): TxRow[] {
  const parsed = parseEventLogs({
    abi: LegacyTransactionLoggerABI,
    logs,
    eventName: 'TransactionSent',
  })

  return parsed
    .filter((log) => log.transactionHash != null)
    .map((log) => ({
      hash: log.transactionHash!,
      chainId: chainConfig.id,
      sender: log.args.sender.toLowerCase(),
      receiver: log.args.receiver.toLowerCase(),
      token: legacy.tokenAddress.toLowerCase(),
      amount: log.args.amount.toString(),
      decimals: legacy.tokenDecimals,
      timestamp: Number(log.args.timestamp),
    }))
}

function parseRouterLogs(
  logs: Log[],
  chainConfig: ChainConfig,
): TxRow[] {
  const parsed = parseEventLogs({
    abi: DonationRouterABI,
    logs,
    eventName: 'DonationSent',
  })

  return parsed
    .filter((log) => log.transactionHash != null)
    .map((log) => {
      const tokenAddr = log.args.token.toLowerCase()
      const isNative = tokenAddr === '0x0000000000000000000000000000000000000000'

      let decimals = chainConfig.nativeToken.decimals
      if (!isNative) {
        const tokenConfig = Object.values(chainConfig.tokens).find(
          (t) => t.address.toLowerCase() === tokenAddr,
        )
        if (tokenConfig) {
          decimals = tokenConfig.decimals
        } else {
          console.warn(`[sync] Unknown token ${tokenAddr} on ${chainConfig.name}, defaulting to 18 decimals`)
          decimals = 18
        }
      }

      return {
        hash: log.transactionHash!,
        chainId: chainConfig.id,
        sender: log.args.sender.toLowerCase(),
        receiver: log.args.receiver.toLowerCase(),
        token: isNative ? 'native' : tokenAddr,
        amount: log.args.amount.toString(),
        decimals,
        timestamp: Number(log.args.timestamp),
      }
    })
}

async function fetchLogsWithRetry(
  client: ReturnType<typeof createPublicClient>,
  params: {
    address: `0x${string}`
    event: any
    fromBlock: bigint
    toBlock: bigint
  },
): Promise<Log[]> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await client.getLogs(params)
    } catch (err: unknown) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)

      if (isBlockRangeTooLargeError(msg)) {
        throw err
      }

      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt
      console.warn(
        `[sync] getLogs attempt ${attempt + 1}/${MAX_RETRIES} failed for ` +
          `blocks ${params.fromBlock}–${params.toBlock}: ${msg}. ` +
          `Retrying in ${delay}ms…`,
      )
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError
}

function isBlockRangeTooLargeError(msg: string): boolean {
  return (
    msg.includes('Log response size exceeded') ||
    msg.includes('query returned more than') ||
    msg.includes('block range too large') ||
    msg.includes('exceed maximum block range')
  )
}

async function syncContractEvents(
  ctx: SyncContext,
  contractAddress: `0x${string}`,
  abi: readonly any[],
  eventName: string,
  contractType: string,
  configFromBlock: bigint,
  parseLogsFn: (logs: Log[], chain: ChainConfig) => TxRow[],
): Promise<void> {
  const { db, chainConfig } = ctx

  const client = createPublicClient({
    transport: http(chainConfig.rpc),
  })

  const currentBlock = await client.getBlockNumber()
  const lastSynced = await getSyncState(db, chainConfig.id, contractType)

  let fromBlock =
    lastSynced > 0 ? BigInt(lastSynced) + 1n : configFromBlock

  if (fromBlock > currentBlock) return

  let dynamicRange = BLOCK_RANGE

  while (fromBlock <= currentBlock) {
    const toBlock =
      fromBlock + dynamicRange > currentBlock
        ? currentBlock
        : fromBlock + dynamicRange

    let logs: Log[]
    try {
      logs = await fetchLogsWithRetry(client, {
        address: contractAddress,
        event: (() => {
          const ev = (abi as readonly { name?: string }[]).find((e) => e.name === eventName)
          if (!ev) throw new Error(`[sync] Event "${eventName}" not found in ABI`)
          return ev
        })(),
        fromBlock,
        toBlock,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isBlockRangeTooLargeError(msg) && dynamicRange > 100n) {
        dynamicRange = dynamicRange / 2n
        console.warn(
          `[sync] Block range too large for ${chainConfig.name}, ` +
            `reducing to ${dynamicRange} blocks`,
        )
        continue
      }
      throw err
    }

    if (logs.length > 0) {
      const rows = parseLogsFn(logs, chainConfig)
      for (const row of rows) {
        await db.insert(transactions).values(row).onConflictDoNothing()
      }
    }

    await setSyncState(db, chainConfig.id, contractType, Number(toBlock))

    fromBlock = toBlock + 1n

    if (dynamicRange < BLOCK_RANGE) {
      dynamicRange = dynamicRange * 2n > BLOCK_RANGE ? BLOCK_RANGE : dynamicRange * 2n
    }
  }
}

async function syncChain(db: Database, chainConfig: ChainConfig): Promise<void> {
  // Sync legacy contracts
  for (const legacy of chainConfig.legacyContracts) {
    const contractType = `legacy:${legacy.address.toLowerCase()}`
    try {
      await syncContractEvents(
        { db, chainConfig },
        legacy.address,
        LegacyTransactionLoggerABI,
        'TransactionSent',
        contractType,
        legacy.fromBlock,
        (logs, chain) => parseLegacyLogs(logs, chain, legacy),
      )
    } catch (err) {
      console.error(`[sync] Failed to sync legacy contract on ${chainConfig.name}:`, err)
    }
  }

  // Sync DonationRouter
  const routerAddr = chainConfig.donationRouter
  if (routerAddr !== '0x0000000000000000000000000000000000000000') {
    try {
      await syncContractEvents(
        { db, chainConfig },
        routerAddr,
        DonationRouterABI,
        'DonationSent',
        'router',
        chainConfig.donationRouterFromBlock,
        parseRouterLogs,
      )
    } catch (err) {
      console.error(`[sync] Failed to sync router on ${chainConfig.name}:`, err)
    }
  }
}

export async function syncAllChains(db: Database): Promise<void> {
  // Sync chains sequentially, prioritizing Optimism (has legacy data)
  const chainOrder = ['optimism', 'base', 'ethereum', 'bsc', 'sepolia']
  for (const name of chainOrder) {
    const chainConfig = chains[name]
    if (!chainConfig) continue
    try {
      await syncChain(db, chainConfig)
    } catch (err) {
      console.error(`[sync] ${name} failed:`, err)
    }
  }
}
