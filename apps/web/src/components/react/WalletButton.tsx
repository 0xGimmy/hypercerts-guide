import { ConnectButton } from '@rainbow-me/rainbowkit'
import Providers from './Providers'

export default function WalletButton() {
  return (
    <Providers>
      <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
    </Providers>
  )
}
