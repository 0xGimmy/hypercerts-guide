import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Providers from './Providers'
import { api } from '../../lib/api'
import { getOrgByWallet } from '@repo/shared'
import { formatUnits } from 'viem'

interface Props {
  locale: string
}

const t = {
  zh: {
    orgs: '組織',
    users: '讚助人',
    rank: '排名',
    org: '組織',
    name: '名稱',
    points: '點數',
    amount: '金額',
    loading: '載入中...',
    error: '載入失敗',
    noData: '尚無資料',
  },
  en: {
    orgs: 'Organizations',
    users: 'Donors',
    rank: 'Rank',
    org: 'Organization',
    name: 'Name',
    points: 'Points',
    amount: 'Amount',
    loading: 'Loading...',
    error: 'Failed to load',
    noData: 'No data yet',
  },
}

const NORMALIZED_DECIMALS = 6

function getLocalizedOrgName(wallet: string, locale: string): string {
  const org = getOrgByWallet(wallet)
  if (!org) return `${wallet.slice(0, 6)}...`
  return locale === 'zh' ? org.nameZh : org.name
}

function LeaderboardContent({ locale }: Props) {
  const labels = t[locale as keyof typeof t] ?? t.en
  const [tab, setTab] = useState<'orgs' | 'users'>('orgs')

  const { data: orgData, isLoading: orgLoading, isError: orgError } = useQuery({
    queryKey: ['orgDonations'],
    queryFn: api.getOrgDonations,
    refetchInterval: 60_000,
  })

  const { data: userData, isLoading: userLoading, isError: userError } = useQuery({
    queryKey: ['userDonations'],
    queryFn: api.getUserDonations,
    refetchInterval: 60_000,
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers,
  })

  const userNameMap = new Map(users?.map((u) => [u.address.toLowerCase(), u.name]) ?? [])

  const isLoading = tab === 'orgs' ? orgLoading : userLoading
  const isError = tab === 'orgs' ? orgError : userError

  const title = locale === 'zh' ? '排行榜' : 'Leaderboard'

  return (
    <div>
      {/* Title + Tab switcher on same row */}
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold font-serif">{title}</h1>
        <div className="flex gap-6 border-b border-black/10 dark:border-white/10">
          <button
            onClick={() => setTab('orgs')}
            className={`pb-2 text-sm font-semibold transition-colors ${
              tab === 'orgs'
                ? 'text-accent border-b-2 border-accent'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            {labels.orgs}
          </button>
          <button
            onClick={() => setTab('users')}
            className={`pb-2 text-sm font-semibold transition-colors ${
              tab === 'users'
                ? 'text-accent border-b-2 border-accent'
                : 'text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text'
            }`}
          >
            {labels.users}
          </button>
        </div>
      </div>

      {isLoading && <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">{labels.loading}</p>}
      {isError && <p className="text-red-500 text-sm">{labels.error}</p>}

      {/* Organization leaderboard */}
      {tab === 'orgs' && !isLoading && !isError && orgData?.length === 0 && (
        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">{labels.noData}</p>
      )}
      {tab === 'orgs' && !isLoading && !isError && (orgData?.length ?? 0) > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/10">
              <th className="py-2.5 w-16 text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">{labels.rank}</th>
              <th className="py-2.5 text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">{labels.org}</th>
              <th className="py-2.5 text-right text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">{labels.points}</th>
              <th className="py-2.5 text-right text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">{labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            {orgData?.filter((org) => BigInt(org.amount) > 0n).map((org, i) => (
              <tr key={org.address} className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                <td className="py-3">{i + 1}</td>
                <td className="py-3 font-medium">{getLocalizedOrgName(org.address, locale)}</td>
                <td className="py-3 text-right font-mono">{org.points.toFixed(2)}</td>
                <td className="py-3 text-right font-mono">{formatUnits(BigInt(org.amount), NORMALIZED_DECIMALS)} USD</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* User leaderboard */}
      {tab === 'users' && !isLoading && !isError && userData?.length === 0 && (
        <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">{labels.noData}</p>
      )}
      {tab === 'users' && !isLoading && !isError && (userData?.length ?? 0) > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-black/10 dark:border-white/10">
              <th className="py-2.5 w-16 text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">{labels.rank}</th>
              <th className="py-2.5 text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">{labels.name}</th>
              <th className="py-2.5 text-right text-xs uppercase tracking-wider text-black/40 dark:text-white/40 font-medium">{labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            {userData?.filter((user) => BigInt(user.amount) > 0n).map((user, i) => (
              <tr key={user.address} className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors">
                <td className="py-3">{i + 1}</td>
                <td className="py-3">{userNameMap.get(user.address.toLowerCase()) ?? `${user.address.slice(0, 6)}...${user.address.slice(-4)}`}</td>
                <td className="py-3 text-right font-mono">{formatUnits(BigInt(user.amount), NORMALIZED_DECIMALS)} USD</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default function LeaderboardIsland({ locale }: Props) {
  return (
    <Providers>
      <LeaderboardContent locale={locale} />
    </Providers>
  )
}
