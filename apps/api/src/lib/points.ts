import type { Transaction, OrganizationDonation, UserDonation } from '@repo/shared'
import { formatUnits } from 'viem'

const STANDARD_DECIMALS = 6

/**
 * Filter out native token (ETH/BNB) transactions.
 * Native tokens cannot be aggregated with stablecoins without a price oracle.
 */
function filterStablecoinOnly(txs: Transaction[]): Transaction[] {
  return txs.filter((tx) => tx.token !== 'native')
}

/**
 * Normalize a raw token amount to 6-decimal standard (USDC/USDT equivalent).
 * This ensures amounts from tokens with different decimals (e.g., 6 vs 18) are comparable.
 */
function normalizeAmount(amount: bigint, fromDecimals: number): bigint {
  if (fromDecimals === STANDARD_DECIMALS) return amount
  if (fromDecimals > STANDARD_DECIMALS) {
    return amount / 10n ** BigInt(fromDecimals - STANDARD_DECIMALS)
  }
  return amount * 10n ** BigInt(STANDARD_DECIMALS - fromDecimals)
}

/**
 * Calculate quadratic funding points per organization.
 * Points = (Σ √(amount_in_human_readable))²
 *
 * Amounts are normalized to a 6-decimal standard for consistent aggregation.
 */
export function calculateOrgDonations(txs: Transaction[]): OrganizationDonation[] {
  const validTxs = filterStablecoinOnly(txs)

  const sqrtSums = new Map<string, number>()
  const totalAmounts = new Map<string, bigint>()

  for (const tx of validTxs) {
    const humanAmount = parseFloat(formatUnits(BigInt(tx.amount), tx.decimals))
    const sqrt = Math.sqrt(humanAmount)

    sqrtSums.set(tx.receiver, (sqrtSums.get(tx.receiver) ?? 0) + sqrt)

    const normalized = normalizeAmount(BigInt(tx.amount), tx.decimals)
    const prev = totalAmounts.get(tx.receiver) ?? 0n
    totalAmounts.set(tx.receiver, prev + normalized)
  }

  const result: OrganizationDonation[] = []
  for (const [address, sqrtSum] of sqrtSums) {
    result.push({
      address,
      amount: (totalAmounts.get(address) ?? 0n).toString(),
      points: parseFloat((sqrtSum ** 2).toFixed(2)),
    })
  }

  return result.sort((a, b) => b.points - a.points)
}

/**
 * Aggregate total donation amount per sender.
 * Amounts are normalized to 6-decimal standard.
 */
export function calculateUserDonations(txs: Transaction[]): UserDonation[] {
  const validTxs = filterStablecoinOnly(txs)
  const amounts = new Map<string, bigint>()

  for (const tx of validTxs) {
    const normalized = normalizeAmount(BigInt(tx.amount), tx.decimals)
    const prev = amounts.get(tx.sender) ?? 0n
    amounts.set(tx.sender, prev + normalized)
  }

  return Array.from(amounts, ([address, amount]) => ({
    address,
    amount: amount.toString(),
  })).sort((a, b) => (BigInt(b.amount) > BigInt(a.amount) ? 1 : -1))
}
