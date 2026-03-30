import { http } from 'wagmi'
import { mainnet, optimism, bsc, base, sepolia } from 'wagmi/chains'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'

const projectId = import.meta.env.PUBLIC_WALLETCONNECT_PROJECT_ID
if (!projectId) {
  console.warn(
    '[wagmi] PUBLIC_WALLETCONNECT_PROJECT_ID is not set — WalletConnect will not work. ' +
    'Set it in your .env file.',
  )
}

export const wagmiConfig = getDefaultConfig({
  appName: 'HyperAwesome Guidebook',
  projectId: projectId ?? '',
  chains: [optimism, mainnet, base, bsc, sepolia],
  transports: {
    [optimism.id]: http(),
    [mainnet.id]: http(),
    [base.id]: http(),
    [bsc.id]: http(),
    [sepolia.id]: http(),
  },
})
