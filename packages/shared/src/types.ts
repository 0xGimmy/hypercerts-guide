export interface ChainConfig {
  id: number
  name: string
  rpc: string
  blockExplorer: string
  donationRouter: `0x${string}`
  donationRouterFromBlock: bigint
  legacyContracts: LegacyContract[]
  tokens: Record<string, TokenConfig>
  nativeToken: { symbol: string; decimals: number }
}

export interface LegacyContract {
  address: `0x${string}`
  fromBlock: bigint
  tokenAddress: `0x${string}`
  tokenDecimals: number
  tokenSymbol: string
}

export interface TokenConfig {
  address: `0x${string}`
  decimals: number
  symbol: string
}

export interface Organization {
  name: string
  nameZh: string
  wallet: `0x${string}`
  slug: string
}

export interface Transaction {
  hash: string
  chainId: number
  sender: string
  receiver: string
  token: string
  amount: string
  decimals: number
  timestamp: number
}

export interface OrganizationDonation {
  address: string
  amount: string
  points: number
}

export interface UserDonation {
  address: string
  amount: string
}

export interface User {
  id: number
  address: string
  name: string | null
  createdAt: number
  updatedAt: number
}
