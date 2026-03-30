import { useState, useEffect } from 'react'
import { useAccount, useChainId, useWriteContract, useConfig } from 'wagmi'
import { waitForTransactionReceipt, readContract, getChainId } from 'wagmi/actions'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { parseUnits, type Address } from 'viem'
import Providers from './Providers'
import { DonationRouterABI, ERC20ABI, getChainById } from '@repo/shared'

interface Props {
  orgName: string
  orgWallet: string
  locale?: string
}

const t = {
  zh: {
    donateHere: '捐款',
    donateTo: '捐款給',
    success: '捐款成功！',
    close: '關閉',
    connectWallet: '請先連接錢包',
    invalidAmount: '金額必須大於 0',
    tooManyDecimals: (n: number) => `最多 ${n} 位小數`,
    approving: '授權中...',
    donating: '捐款中...',
    donate: '捐款',
    cancelled: '交易已取消',
    insufficient: '餘額不足',
    failed: (msg: string) => `交易失敗：${msg}`,
    chainChanged: '鏈已切換，請重試',
  },
  en: {
    donateHere: 'Donate Here',
    donateTo: 'Donate to',
    success: 'Donation successful!',
    close: 'Close',
    connectWallet: 'Please connect your wallet to donate',
    invalidAmount: 'Amount must be greater than 0',
    tooManyDecimals: (n: number) => `Maximum ${n} decimal places`,
    approving: 'Approving...',
    donating: 'Donating...',
    donate: 'Donate',
    cancelled: 'Transaction cancelled',
    insufficient: 'Insufficient balance',
    failed: (msg: string) => `Transaction failed: ${msg}`,
    chainChanged: 'Chain changed during transaction. Please try again.',
  },
}

function DonateButtonInner({ orgName, orgWallet, locale = 'en' }: Props) {
  const labels = t[locale as keyof typeof t] ?? t.en
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const chainConfig = getChainById(chainId)
  const config = useConfig()
  const { writeContractAsync } = useWriteContract()
  const { openConnectModal } = useConnectModal()

  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [selectedToken, setSelectedToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'approving' | 'donating' | 'success'>('idle')
  const [error, setError] = useState('')

  const tokens = chainConfig ? Object.entries(chainConfig.tokens) : []
  const nativeToken = chainConfig?.nativeToken
  const isNative = selectedToken === 'NATIVE'
  const currentToken = isNative
    ? (nativeToken ? { address: undefined, decimals: nativeToken.decimals, symbol: nativeToken.symbol } : undefined)
    : chainConfig?.tokens[selectedToken]

  // Reset selected token when chain changes
  useEffect(() => {
    setSelectedToken(tokens.length === 1 ? tokens[0][0] : '')
  }, [chainId])

  async function handleDonate() {
    if (!isConnected || !address) {
      openConnectModal?.()
      return
    }
    if (!chainConfig || !currentToken || !amount) return

    const val = parseFloat(amount)
    if (isNaN(val) || val <= 0) {
      setError(labels.invalidAmount)
      return
    }

    // Validate decimal places
    const parts = amount.split('.')
    if (parts[1] && parts[1].length > currentToken.decimals) {
      setError(labels.tooManyDecimals(currentToken.decimals))
      return
    }

    setError('')
    const parsed = parseUnits(amount, currentToken.decimals)
    const router = chainConfig.donationRouter
    const initialChainId = getChainId(config)

    try {
      if (isNative) {
        // Native token: skip approval, send value directly
        setStatus('donating')
        const donateHash = await writeContractAsync({
          address: router,
          abi: DonationRouterABI,
          functionName: 'donateNative',
          args: [orgWallet as Address],
          value: parsed,
        })
        await waitForTransactionReceipt(config, { hash: donateHash })
      } else {
        // ERC20: check allowance, approve, then donate
        setStatus('approving')

        const tokenAddress = currentToken.address as Address

        const currentAllowance = await readContract(config, {
          address: tokenAddress,
          abi: ERC20ABI,
          functionName: 'allowance',
          args: [address, router],
        }) as bigint

        if (currentAllowance < parsed) {
          if (currentAllowance > 0n) {
            const resetHash = await writeContractAsync({
              address: tokenAddress,
              abi: ERC20ABI,
              functionName: 'approve',
              args: [router, 0n],
            })
            await waitForTransactionReceipt(config, { hash: resetHash })
          }

          const approveHash = await writeContractAsync({
            address: tokenAddress,
            abi: ERC20ABI,
            functionName: 'approve',
            args: [router, parsed],
          })
          await waitForTransactionReceipt(config, { hash: approveHash })
        }

        if (getChainId(config) !== initialChainId) {
          setError(labels.chainChanged)
          setStatus('idle')
          return
        }

        setStatus('donating')
        const donateHash = await writeContractAsync({
          address: router,
          abi: DonationRouterABI,
          functionName: 'donate',
          args: [tokenAddress, orgWallet as Address, parsed],
        })
        await waitForTransactionReceipt(config, { hash: donateHash })
      }

      setStatus('success')
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setError(labels.cancelled)
      } else if (msg.includes('insufficient')) {
        setError(labels.insufficient)
      } else {
        setError(labels.failed(msg.slice(0, 100)))
      }
      setStatus('idle')
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded bg-primary text-white font-medium hover:bg-primary-dark transition-colors"
      >
        {labels.donateHere}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">{labels.donateTo} {orgName}</h3>

            {status === 'success' ? (
              <div className="text-center py-4">
                <p className="text-2xl mb-2">🎉</p>
                <p>{labels.success}</p>
                <button onClick={() => { setOpen(false); setStatus('idle'); setError(''); setAmount('') }} className="mt-4 text-primary">{labels.close}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {nativeToken && (
                    <button
                      onClick={() => setSelectedToken('NATIVE')}
                      className={`px-3 py-1 rounded border text-sm ${
                        selectedToken === 'NATIVE' ? 'border-primary text-primary' : 'border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      {nativeToken.symbol}
                    </button>
                  )}
                  {tokens.map(([key, token]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedToken(key)}
                      className={`px-3 py-1 rounded border text-sm ${
                        selectedToken === key ? 'border-primary text-primary' : 'border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      {token.symbol}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <button
                  onClick={handleDonate}
                  disabled={status !== 'idle' || !selectedToken || !amount}
                  className="w-full py-2 rounded bg-primary text-white font-medium disabled:opacity-50"
                >
                  {status === 'approving' ? labels.approving : status === 'donating' ? labels.donating : labels.donate}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function DonateButton(props: Props) {
  return (
    <Providers>
      <DonateButtonInner {...props} />
    </Providers>
  )
}
