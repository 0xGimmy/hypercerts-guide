import type { Transaction, OrganizationDonation, UserDonation, User } from '@repo/shared'

const API_BASE = import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8787'

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function updateUser(address: string, name: string, signature: string, timestamp: number): Promise<void> {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, name, signature, timestamp }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
}

export const api = {
  getTransactions: (wallet?: string, chain?: number) => {
    const params = new URLSearchParams()
    if (wallet) params.set('wallet', wallet)
    if (chain) params.set('chain', chain.toString())
    const qs = params.toString()
    return fetchApi<Transaction[]>(`/transactions${qs ? `?${qs}` : ''}`)
  },
  getDonations: () => fetchApi<Transaction[]>('/donations'),
  getOrgDonations: () => fetchApi<OrganizationDonation[]>('/donations/organizations'),
  getUserDonations: () => fetchApi<UserDonation[]>('/donations/users'),
  getUsers: () => fetchApi<User[]>('/users'),
  getUser: async (address: string): Promise<User | null> => {
    const res = await fetch(`${API_BASE}/users/${address}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return res.json()
  },
}
