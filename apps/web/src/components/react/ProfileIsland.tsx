import { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Providers from './Providers'
import { api, updateUser } from '../../lib/api'
import { getOrgByWallet } from '@repo/shared'
import { formatUnits } from 'viem'

interface Props {
  locale: string
}

const t = {
  zh: {
    connectWallet: '請連接錢包以查看個人資料',
    address: '錢包地址',
    displayName: '顯示名稱',
    save: '儲存',
    saving: '儲存中...',
    saved: '已儲存',
    saveFailed: '儲存失敗',
    donationHistory: '捐款紀錄',
    noData: '尚無捐款紀錄',
    time: '時間',
    org: '組織',
    amount: '金額',
  },
  en: {
    connectWallet: 'Please connect wallet to view profile',
    address: 'Wallet Address',
    displayName: 'Display Name',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Saved',
    saveFailed: 'Failed to save',
    donationHistory: 'Donation History',
    noData: 'No donation records',
    time: 'Time',
    org: 'Organization',
    amount: 'Amount',
  },
}

function ProfileContent({ locale }: Props) {
  const labels = t[locale as keyof typeof t] ?? t.en
  const { address, isConnected } = useAccount()
  const [name, setName] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const queryClient = useQueryClient()
  const { signMessageAsync } = useSignMessage()

  const { data: txs } = useQuery({
    queryKey: ['transactions', address],
    queryFn: () => api.getTransactions(address),
    enabled: !!address,
  })

  // Fetch only the current user instead of all users
  const { data: currentUser } = useQuery({
    queryKey: ['user', address],
    queryFn: () => api.getUser(address!),
    enabled: !!address,
  })

  useEffect(() => {
    if (currentUser?.name) setName(currentUser.name)
  }, [currentUser])

  if (!isConnected || !address) {
    return <p className="text-muted">{labels.connectWallet}</p>
  }

  async function handleSave() {
    if (!address || !name) return
    setSaveStatus('saving')
    try {
      const timestamp = Math.floor(Date.now() / 1000)
      const message = `Set display name to: ${name}\nTimestamp: ${timestamp}`
      const signature = await signMessageAsync({ message })
      await updateUser(address, name, signature, timestamp)
      await queryClient.invalidateQueries({ queryKey: ['user', address] })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Failed to save name:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const sortedTxs = [...(txs ?? [])].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div className="space-y-8">
      {/* Personal info */}
      <section>
        <p className="text-sm text-muted mb-1">{labels.address}</p>
        <p className="font-mono text-sm mb-4 break-all">{address}</p>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={labels.displayName}
            className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
          />
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="px-4 py-2 rounded bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saveStatus === 'saving' ? labels.saving : saveStatus === 'saved' ? labels.saved : saveStatus === 'error' ? labels.saveFailed : labels.save}
          </button>
        </div>
      </section>

      {/* Donation history */}
      <section>
        <h2 className="text-lg font-semibold mb-4">{labels.donationHistory}</h2>
        {sortedTxs.length === 0 ? (
          <p className="text-muted text-sm">{labels.noData}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b dark:border-gray-800">
                  <th className="py-2">{labels.time}</th>
                  <th className="py-2">{labels.org}</th>
                  <th className="py-2 text-right">{labels.amount}</th>
                </tr>
              </thead>
              <tbody>
                {sortedTxs.map((tx) => {
                  const org = getOrgByWallet(tx.receiver)
                  return (
                    <tr key={`${tx.hash}-${tx.receiver}-${tx.chainId}`} className="border-b dark:border-gray-800">
                      <td className="py-3">{new Date(tx.timestamp * 1000).toLocaleDateString()}</td>
                      <td className="py-3">{org ? (locale === 'zh' ? org.nameZh : org.name) : `${tx.receiver.slice(0, 6)}...${tx.receiver.slice(-4)}`}</td>
                      <td className="py-3 text-right font-mono">{formatUnits(BigInt(tx.amount), tx.decimals)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default function ProfileIsland({ locale }: Props) {
  return (
    <Providers>
      <ProfileContent locale={locale} />
    </Providers>
  )
}
