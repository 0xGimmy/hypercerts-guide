import type { ChainConfig } from './types.js'

export const chains: Record<string, ChainConfig> = {
  optimism: {
    id: 10,
    name: 'Optimism',
    rpc: 'https://optimism-rpc.publicnode.com',
    blockExplorer: 'https://optimistic.etherscan.io',
    donationRouter: '0x3573B010F5eB5636B16A0Ce7bc0C0Ca51D01e91C',
    donationRouterFromBlock: 130_000_000n,
    legacyContracts: [
      {
        address: '0x49182E9F30923f8BfC88Ef21692C2A6EBe87892C',
        fromBlock: 125_490_000n,
        tokenAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        tokenDecimals: 6,
        tokenSymbol: 'USDT',
      },
    ],
    tokens: {
      USDT: {
        address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        decimals: 6,
        symbol: 'USDT',
      },
      USDC: {
        address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        decimals: 6,
        symbol: 'USDC',
      },
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
  },

  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpc: 'https://ethereum-rpc.publicnode.com',
    blockExplorer: 'https://etherscan.io',
    donationRouter: '0x029cb0aa773237Da52F3Fe81894c801296343f2b',
    donationRouterFromBlock: 21_500_000n,
    legacyContracts: [],
    tokens: {
      USDT: {
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        decimals: 6,
        symbol: 'USDT',
      },
      USDC: {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 6,
        symbol: 'USDC',
      },
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
  },

  bsc: {
    id: 56,
    name: 'BNB Chain',
    rpc: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    donationRouter: '0x62e614b260B77EA1Fdd7Db82c13Ad816394932b3',
    donationRouterFromBlock: 46_000_000n,
    legacyContracts: [],
    tokens: {
      USDT: {
        address: '0x55d398326f99059fF775485246999027B3197955',
        decimals: 18,
        symbol: 'USDT',
      },
      USDC: {
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        decimals: 18,
        symbol: 'USDC',
      },
    },
    nativeToken: { symbol: 'BNB', decimals: 18 },
  },

  base: {
    id: 8453,
    name: 'Base',
    rpc: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    donationRouter: '0xb239BE0C7d68c4aDe01c3F23b8DEe2915E1AA07F',
    donationRouterFromBlock: 25_000_000n,
    legacyContracts: [],
    tokens: {
      USDC: {
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        symbol: 'USDC',
      },
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
  },

  sepolia: {
    id: 11155111,
    name: 'Sepolia',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    blockExplorer: 'https://sepolia.etherscan.io',
    donationRouter: '0xb239BE0C7d68c4aDe01c3F23b8DEe2915E1AA07F',
    donationRouterFromBlock: 7_200_000n,
    legacyContracts: [
      {
        address: '0x53263AF748479BAdB5641ad604EFfcDFc92d7337',
        fromBlock: 5_500_000n,
        tokenAddress: '0x40Fb865347680eAed4979B1D52645234289E0981',
        tokenDecimals: 18,
        tokenSymbol: 'TYC',
      },
    ],
    tokens: {
      TYC: {
        address: '0x40Fb865347680eAed4979B1D52645234289E0981',
        decimals: 18,
        symbol: 'TYC',
      },
    },
    nativeToken: { symbol: 'ETH', decimals: 18 },
  },
} as const

export const SUPPORTED_CHAIN_IDS = Object.values(chains).map((c) => c.id)

export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(chains).find((c) => c.id === chainId)
}

export function getChainByName(name: string): ChainConfig | undefined {
  return chains[name]
}
