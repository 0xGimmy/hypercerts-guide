import { useState, useEffect } from 'react'
import { useAccount, useChainId, useWriteContract, useConfig } from 'wagmi'
import { waitForTransactionReceipt, readContract, getChainId } from 'wagmi/actions'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { parseUnits, type Address } from 'viem'
import { useQuery } from '@tanstack/react-query'
import Providers from './Providers'
import { api } from '../../lib/api'
import { organizations, DonationRouterABI, ERC20ABI, getChainById } from '@repo/shared'

interface Props {
  locale: string
}

const t = {
  zh: {
    selectOrg: '選擇組織',
    amount: '金額',
    token: '幣種',
    chain: '鏈',
    donate: '捐款',
    distribution: '超讚分配',
    approving: '授權中...',
    donating: '捐款中...',
    success: '捐款成功！',
    connectWallet: '請先連接錢包',
    noAmount: '請輸入金額',
    donateAgain: '繼續捐款',
    chainChanged: '鏈已切換，請重試',
    invalidAmount: '金額必須大於 0',
    tooManyDecimals: (n: number) => `最多 ${n} 位小數`,
    info: '僅限 Optimism 鏈上的 USDT',
  },
  en: {
    selectOrg: 'Select Organization',
    amount: 'Amount',
    token: 'Token',
    chain: 'Chain',
    donate: 'Donate',
    approving: 'Approving...',
    donating: 'Donating...',
    success: 'Donation successful!',
    connectWallet: 'Please connect your wallet',
    noAmount: 'Please enter an amount',
    donateAgain: 'Donate Again',
    chainChanged: 'Chain changed during transaction. Please try again.',
    invalidAmount: 'Amount must be greater than 0',
    tooManyDecimals: (n: number) => `Maximum ${n} decimal places`,
    distribution: 'HyperAwesome Distribution',
    info: 'USDT on Optimism only',
  },
}

function DonateForm({ locale }: Props) {
  const labels = t[locale as keyof typeof t] ?? t.en
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const chainConfig = getChainById(chainId)
  const config = useConfig()
  const { openConnectModal } = useConnectModal()

  const [selectedOrgs, setSelectedOrgs] = useState<Record<string, boolean>>({})
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [selectedToken, setSelectedToken] = useState<string>('')
  const [status, setStatus] = useState<'idle' | 'approving' | 'donating' | 'success'>('idle')
  const [error, setError] = useState<string>('')

  const { writeContractAsync } = useWriteContract()

  const { data: orgDonations } = useQuery({
    queryKey: ['orgDonations'],
    queryFn: api.getOrgDonations,
    refetchInterval: 60_000,
  })

  const tokens = chainConfig ? Object.entries(chainConfig.tokens) : []
  const nativeToken = chainConfig?.nativeToken

  // Build unified token list: native + ERC20s
  const allTokens: { key: string; symbol: string; decimals: number; address?: `0x${string}`; isNative: boolean }[] = []
  if (chainConfig) {
    allTokens.push({
      key: 'NATIVE',
      symbol: chainConfig.nativeToken.symbol,
      decimals: chainConfig.nativeToken.decimals,
      isNative: true,
    })
    for (const [key, token] of Object.entries(chainConfig.tokens)) {
      allTokens.push({
        key,
        symbol: token.symbol,
        decimals: token.decimals,
        address: token.address,
        isNative: false,
      })
    }
  }

  const selectedTokenInfo = allTokens.find((t) => t.key === selectedToken)
  const isNative = selectedTokenInfo?.isNative ?? false
  const currentToken = isNative
    ? (nativeToken ? { address: undefined, decimals: nativeToken.decimals, symbol: nativeToken.symbol } : undefined)
    : chainConfig?.tokens[selectedToken]

  function getOrgName(org: typeof organizations[0]) {
    return locale === 'zh' ? org.nameZh : org.name
  }

  function handleDistribution() {
    const checkedOrgs = organizations.filter((o) => selectedOrgs[o.wallet])
    if (checkedOrgs.length === 0) {
      setError(locale === 'zh' ? '請選擇組織' : 'Please select an organization')
      return
    }
    const totalAmount = checkedOrgs.reduce((sum, o) => sum + parseFloat(amounts[o.wallet] || '0'), 0)
    if (totalAmount <= 0) {
      setError(labels.noAmount)
      return
    }

    setError('')

    const checkedOrgPoints: Record<string, number> = {}
    for (const o of checkedOrgs) {
      const od = orgDonations?.find((d) => d.address === o.wallet.toLowerCase())
      checkedOrgPoints[o.wallet] = od?.points ?? 1
    }
    const pointSum = Object.values(checkedOrgPoints).reduce((a, b) => a + b, 0)
    const maxDec = currentToken?.decimals ?? 6

    // Use toFixed to preserve fractional precision, give remainder to last org
    setAmounts((prev) => {
      const next = { ...prev }
      let distributed = 0
      for (let i = 0; i < checkedOrgs.length; i++) {
        const o = checkedOrgs[i]
        if (i === checkedOrgs.length - 1) {
          const remainder = parseFloat((totalAmount - distributed).toFixed(maxDec))
          next[o.wallet] = remainder.toString()
        } else {
          const share = parseFloat((totalAmount * (checkedOrgPoints[o.wallet] / pointSum)).toFixed(maxDec))
          next[o.wallet] = share.toString()
          distributed = parseFloat((distributed + share).toFixed(maxDec))
        }
      }
      return next
    })
  }

  // Reset selected token when chain changes
  useEffect(() => {
    setSelectedToken(tokens.length === 1 ? tokens[0][0] : '')
  }, [chainId])

  async function handleDonate() {
    if (!isConnected || !address) {
      openConnectModal?.()
      return
    }
    if (!chainConfig || !currentToken) return
    const donatingNative = isNative

    setError('')

    // Validate decimal places before parseUnits
    const maxDecimals = currentToken.decimals
    for (const o of organizations) {
      if (!selectedOrgs[o.wallet] || !amounts[o.wallet]) continue
      const parts = amounts[o.wallet].split('.')
      if (parts[1] && parts[1].length > maxDecimals) {
        setError(labels.tooManyDecimals(maxDecimals))
        return
      }
    }

    const entries = organizations
      .filter((o) => selectedOrgs[o.wallet] && amounts[o.wallet])
      .map((o) => {
        const val = parseFloat(amounts[o.wallet])
        if (isNaN(val) || val <= 0) return null
        return {
          receiver: o.wallet as Address,
          amount: parseUnits(amounts[o.wallet], currentToken.decimals),
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)

    if (entries.length === 0) {
      setError(labels.invalidAmount)
      return
    }

    const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0n)
    const routerAddress = chainConfig.donationRouter
    const initialChainId = getChainId(config)

    try {
      if (donatingNative) {
        setStatus('donating')
        if (entries.length === 1) {
          const donateHash = await writeContractAsync({
            address: routerAddress,
            abi: DonationRouterABI,
            functionName: 'donateNative',
            args: [entries[0].receiver],
            value: entries[0].amount,
          })
          await waitForTransactionReceipt(config, { hash: donateHash })
        } else {
          const donateHash = await writeContractAsync({
            address: routerAddress,
            abi: DonationRouterABI,
            functionName: 'donateNativeBatch',
            args: [
              entries.map((e) => e.receiver),
              entries.map((e) => e.amount),
            ],
            value: totalAmount,
          })
          await waitForTransactionReceipt(config, { hash: donateHash })
        }
      } else {
        setStatus('approving')

        const tokenAddress = currentToken.address as Address

        const currentAllowance = await readContract(config, {
          address: tokenAddress,
          abi: ERC20ABI,
          functionName: 'allowance',
          args: [address, routerAddress],
        }) as bigint

        if (currentAllowance < totalAmount) {
          if (currentAllowance > 0n) {
            const resetHash = await writeContractAsync({
              address: tokenAddress,
              abi: ERC20ABI,
              functionName: 'approve',
              args: [routerAddress, 0n],
            })
            await waitForTransactionReceipt(config, { hash: resetHash })
          }

          const approveHash = await writeContractAsync({
            address: tokenAddress,
            abi: ERC20ABI,
            functionName: 'approve',
            args: [routerAddress, totalAmount],
          })
          await waitForTransactionReceipt(config, { hash: approveHash })
        }

        if (getChainId(config) !== initialChainId) {
          setError(labels.chainChanged)
          setStatus('idle')
          return
        }

        setStatus('donating')
        if (entries.length === 1) {
          const donateHash = await writeContractAsync({
            address: routerAddress,
            abi: DonationRouterABI,
            functionName: 'donate',
            args: [tokenAddress, entries[0].receiver, entries[0].amount],
          })
          await waitForTransactionReceipt(config, { hash: donateHash })
        } else {
          const donateHash = await writeContractAsync({
            address: routerAddress,
            abi: DonationRouterABI,
            functionName: 'donateBatch',
            args: [
              tokenAddress,
              entries.map((e) => e.receiver),
              entries.map((e) => e.amount),
            ],
          })
          await waitForTransactionReceipt(config, { hash: donateHash })
        }
      }

      setStatus('success')
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setError(locale === 'zh' ? '交易已取消' : 'Transaction cancelled')
      } else if (msg.includes('insufficient')) {
        setError(locale === 'zh' ? '餘額不足' : 'Insufficient balance')
      } else {
        setError(locale === 'zh' ? `交易失敗：${msg.slice(0, 100)}` : `Transaction failed: ${msg.slice(0, 100)}`)
      }
      setStatus('idle')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-8">
        <p className="text-2xl mb-4">🎉</p>
        <p className="text-lg font-semibold mb-4">{labels.success}</p>
        <button
          onClick={() => {
            setStatus('idle')
            setAmounts({})
            setSelectedOrgs({})
            setError('')
          }}
          className="px-6 py-2 rounded bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
        >
          {labels.donateAgain}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Organization list */}
      <div className="space-y-3">
        {organizations.map((org) => (
          <div key={org.wallet} className="flex items-center gap-3 p-4 rounded-xl bg-light-foreground dark:bg-dark-foreground shadow-sm">
            <input
              type="checkbox"
              checked={!!selectedOrgs[org.wallet]}
              onChange={(e) =>
                setSelectedOrgs((prev) => ({ ...prev, [org.wallet]: e.target.checked }))
              }
              className="w-5 h-5"
            />
            <span className="flex-1 font-semibold">{getOrgName(org)}</span>
            {selectedOrgs[org.wallet] && (
              <input
                type="number"
                min="0"
                step="any"
                placeholder={labels.amount}
                value={amounts[org.wallet] ?? ''}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [org.wallet]: e.target.value }))
                }
                className="w-32 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {/* Token selector */}
      {allTokens.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">{labels.token}</label>
          <div className="flex gap-2 flex-wrap">
            {allTokens.map((token) => (
              <button
                key={token.key}
                onClick={() => setSelectedToken(token.key)}
                className={`px-4 py-2 rounded border text-sm transition-colors ${
                  selectedToken === token.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-300 dark:border-gray-700'
                }`}
              >
                {token.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={handleDonate}
          disabled={status !== 'idle' || !selectedToken}
          className="px-6 py-3 rounded bg-primary text-white font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {status === 'approving' ? labels.approving : status === 'donating' ? labels.donating : labels.donate}
        </button>
        <button
          onClick={handleDistribution}
          disabled={status !== 'idle'}
          className="px-6 py-3 rounded bg-primary text-white font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {labels.distribution}
        </button>
      </div>
    </div>
  )
}

export default function DonateIsland({ locale }: Props) {
  return (
    <Providers>
      <DonateForm locale={locale} />
    </Providers>
  )
}
