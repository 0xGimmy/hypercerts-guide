import { describe, it, expect } from 'vitest'
import {
  filterWithCooldown,
  calculateOrgDonations,
  calculateUserDonations,
} from '../../lib/points.js'
import type { Transaction } from '@repo/shared'

const DAY = 86400

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    hash: '0x' + Math.random().toString(16).slice(2),
    chainId: 10,
    sender: '0xdonor1',
    receiver: '0xorg1',
    token: '0xusdt',
    amount: '100000000', // 100 USDT (6 decimals)
    decimals: 6,
    timestamp: 1000000,
    ...overrides,
  }
}

describe('filterWithCooldown', () => {
  it('keeps first tx of a pair', () => {
    const txs = [makeTx({ timestamp: 1000 })]
    expect(filterWithCooldown(txs)).toHaveLength(1)
  })

  it('filters tx within 7 days of same sender-receiver-chain', () => {
    const txs = [
      makeTx({ timestamp: 1000 }),
      makeTx({ timestamp: 1000 + 3 * DAY }), // 3 days later — filtered
    ]
    expect(filterWithCooldown(txs)).toHaveLength(1)
  })

  it('keeps tx after 7 days', () => {
    const txs = [
      makeTx({ timestamp: 1000 }),
      makeTx({ timestamp: 1000 + 8 * DAY }), // 8 days later — kept
    ]
    expect(filterWithCooldown(txs)).toHaveLength(2)
  })

  it('keeps tx at exactly 7 days', () => {
    const txs = [
      makeTx({ timestamp: 1000 }),
      makeTx({ timestamp: 1000 + 7 * DAY }), // exactly 7 days — kept
    ]
    expect(filterWithCooldown(txs)).toHaveLength(2)
  })

  it('handles multiple sender-receiver pairs independently', () => {
    const txs = [
      makeTx({ sender: '0xa', receiver: '0x1', timestamp: 1000 }),
      makeTx({ sender: '0xa', receiver: '0x2', timestamp: 1000 + DAY }), // different pair
      makeTx({ sender: '0xb', receiver: '0x1', timestamp: 1000 + DAY }), // different pair
    ]
    expect(filterWithCooldown(txs)).toHaveLength(3)
  })

  it('treats same sender-receiver on different chains as independent', () => {
    const txs = [
      makeTx({ sender: '0xa', receiver: '0x1', chainId: 10, timestamp: 1000 }),
      makeTx({ sender: '0xa', receiver: '0x1', chainId: 1, timestamp: 1000 + DAY }), // same pair, different chain — kept
    ]
    expect(filterWithCooldown(txs)).toHaveLength(2)
  })

  it('resets cooldown window after accepted tx', () => {
    const txs = [
      makeTx({ timestamp: 1000 }),
      makeTx({ timestamp: 1000 + 8 * DAY }), // kept, resets window
      makeTx({ timestamp: 1000 + 10 * DAY }), // 2 days after second — filtered
    ]
    expect(filterWithCooldown(txs)).toHaveLength(2)
  })

  it('returns empty for empty input', () => {
    expect(filterWithCooldown([])).toHaveLength(0)
  })
})

describe('calculateOrgDonations', () => {
  it('calculates points = (Σ√amounts)² for single org', () => {
    // Two donations of 100 USDT each
    // √100 + √100 = 10 + 10 = 20
    // 20² = 400
    const txs = [
      makeTx({ receiver: '0xorg1', amount: '100000000', timestamp: 1000 }),
      makeTx({
        receiver: '0xorg1',
        sender: '0xdonor2',
        amount: '100000000',
        timestamp: 1000,
      }),
    ]
    const result = calculateOrgDonations(txs)
    expect(result).toHaveLength(1)
    expect(result[0].address).toBe('0xorg1')
    expect(result[0].points).toBe(400)
  })

  it('returns results sorted by points descending', () => {
    const txs = [
      makeTx({ receiver: '0xorg1', amount: '100000000', timestamp: 1000 }),
      makeTx({
        receiver: '0xorg2',
        amount: '400000000',
        timestamp: 1000,
        sender: '0xdonor2',
      }), // 400 USDT → √400 = 20 → 20² = 400
    ]
    const result = calculateOrgDonations(txs)
    expect(result[0].address).toBe('0xorg2')
    expect(result[1].address).toBe('0xorg1')
  })

  it('applies 7-day cooldown before calculating', () => {
    // Same donor to same org, 1 day apart — second one filtered
    const txs = [
      makeTx({ timestamp: 1000, amount: '100000000' }),
      makeTx({ timestamp: 1000 + DAY, amount: '900000000' }),
    ]
    const result = calculateOrgDonations(txs)
    // Only first tx counts: √100 = 10, 10² = 100
    expect(result[0].points).toBe(100)
  })

  it('aggregates across chains', () => {
    const txs = [
      makeTx({ chainId: 10, receiver: '0xorg1', amount: '100000000', timestamp: 1000 }),
      makeTx({
        chainId: 1,
        receiver: '0xorg1',
        sender: '0xdonor2',
        amount: '100000000',
        timestamp: 1000,
      }),
    ]
    const result = calculateOrgDonations(txs)
    expect(result).toHaveLength(1)
    expect(result[0].points).toBe(400) // (√100 + √100)² = 400
  })

  it('normalizes amounts across different decimals', () => {
    // 100 USDT (6 decimals) + 100 USDT (18 decimals on BSC)
    const txs = [
      makeTx({
        receiver: '0xorg1',
        sender: '0xdonor1',
        amount: '100000000', // 100 with 6 decimals
        decimals: 6,
        timestamp: 1000,
      }),
      makeTx({
        receiver: '0xorg1',
        sender: '0xdonor2',
        amount: '100000000000000000000', // 100 with 18 decimals
        decimals: 18,
        timestamp: 1000,
      }),
    ]
    const result = calculateOrgDonations(txs)
    expect(result).toHaveLength(1)
    // Both are 100 USD equivalent, normalized amount should be 200000000 (200 in 6 decimals)
    expect(result[0].amount).toBe('200000000')
    // Points: (√100 + √100)² = 400
    expect(result[0].points).toBe(400)
  })

  it('returns empty for empty input', () => {
    expect(calculateOrgDonations([])).toHaveLength(0)
  })

  it('excludes native token transactions from calculation', () => {
    const txs = [
      makeTx({ receiver: '0xorg1', amount: '100000000', timestamp: 1000, token: '0xusdt' }),
      makeTx({
        receiver: '0xorg1',
        sender: '0xdonor2',
        amount: '1000000000000000000', // 1 ETH
        decimals: 18,
        token: 'native',
        timestamp: 1000,
      }),
    ]
    const result = calculateOrgDonations(txs)
    expect(result).toHaveLength(1)
    // Only stablecoin (100 USDT) should count, native ignored
    expect(result[0].amount).toBe('100000000')
    expect(result[0].points).toBe(100) // √100 = 10, 10² = 100
  })
})

describe('calculateUserDonations', () => {
  it('aggregates total per sender', () => {
    const txs = [
      makeTx({ sender: '0xdonor1', amount: '100000000' }),
      makeTx({ sender: '0xdonor1', amount: '200000000', receiver: '0xorg2' }),
      makeTx({ sender: '0xdonor2', amount: '50000000' }),
    ]
    const result = calculateUserDonations(txs)
    expect(result).toHaveLength(2)
    expect(result[0].address).toBe('0xdonor1')
    expect(result[0].amount).toBe('300000000')
    expect(result[1].address).toBe('0xdonor2')
    expect(result[1].amount).toBe('50000000')
  })

  it('applies cooldown consistently with org donations', () => {
    // Same donor to same org, 1 day apart — second one filtered
    const txs = [
      makeTx({ sender: '0xdonor1', timestamp: 1000, amount: '100000000' }),
      makeTx({ sender: '0xdonor1', timestamp: 1000 + DAY, amount: '900000000' }),
    ]
    const result = calculateUserDonations(txs)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('100000000') // only first tx counts
  })

  it('normalizes amounts across different decimals', () => {
    // 100 USDT (6 decimals) on Optimism + 100 USDT (18 decimals) on BSC
    const txs = [
      makeTx({
        sender: '0xdonor1',
        receiver: '0xorg1',
        chainId: 10,
        amount: '100000000', // 100 with 6 decimals
        decimals: 6,
        timestamp: 1000,
      }),
      makeTx({
        sender: '0xdonor1',
        receiver: '0xorg2',
        chainId: 56,
        amount: '100000000000000000000', // 100 with 18 decimals
        decimals: 18,
        timestamp: 1000,
      }),
    ]
    const result = calculateUserDonations(txs)
    expect(result).toHaveLength(1)
    // Both are 100 USD equivalent, normalized to 6 decimals: 200000000
    expect(result[0].amount).toBe('200000000')
  })

  it('excludes native token transactions from calculation', () => {
    const txs = [
      makeTx({ sender: '0xdonor1', amount: '100000000', token: '0xusdt' }),
      makeTx({
        sender: '0xdonor1',
        receiver: '0xorg2',
        amount: '1000000000000000000', // 1 ETH
        decimals: 18,
        token: 'native',
      }),
    ]
    const result = calculateUserDonations(txs)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('100000000') // only stablecoin counts
  })

  it('returns empty for empty input', () => {
    expect(calculateUserDonations([])).toHaveLength(0)
  })
})
