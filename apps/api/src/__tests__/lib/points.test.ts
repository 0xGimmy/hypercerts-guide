import { describe, it, expect } from 'vitest'
import {
  calculateOrgDonations,
  calculateUserDonations,
} from '../../lib/points.js'
import type { Transaction } from '@repo/shared'

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

  it('aggregates multiple donations from same donor to same org', () => {
    const txs = [
      makeTx({ timestamp: 1000, amount: '100000000' }),
      makeTx({ timestamp: 2000, amount: '900000000' }),
    ]
    const result = calculateOrgDonations(txs)
    // Both count: √100 + √900 = 10 + 30 = 40, 40² = 1600
    expect(result[0].points).toBe(1600)
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

  it('aggregates multiple donations from same donor', () => {
    const txs = [
      makeTx({ sender: '0xdonor1', timestamp: 1000, amount: '100000000' }),
      makeTx({ sender: '0xdonor1', timestamp: 2000, amount: '900000000' }),
    ]
    const result = calculateUserDonations(txs)
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe('1000000000') // both count: 100 + 900
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
