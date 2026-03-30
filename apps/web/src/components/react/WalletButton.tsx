import { ConnectButton } from '@rainbow-me/rainbowkit'
import Providers from './Providers'

interface Props {
  locale?: string
}

export default function WalletButton({ locale = 'zh' }: Props) {
  const label = locale === 'zh' ? '連接錢包' : 'Connect Wallet'
  return (
    <Providers>
      <ConnectButton label={label} showBalance={false} chainStatus="icon" accountStatus="avatar" />
    </Providers>
  )
}
