import { TextEffect } from '../ui/TextEffect'
import { BlurFade } from '../ui/BlurFade'

interface Props {
  heading: string
  locale?: string
}

export default function HeroReveal({ heading, locale = 'zh' }: Props) {
  const eyebrow = locale === 'zh' ? '用區塊鏈支持台灣公益' : 'Support Taiwan Public Goods via Blockchain'
  return (
    <div className="py-16 md:py-24 flex flex-col items-center text-center gap-7">
      <span className="text-xs font-medium text-accent bg-accent/10 dark:bg-accent/20 px-3 py-1 rounded tracking-wider">
        {eyebrow}
      </span>
      <TextEffect
        as="h1"
        per="char"
        duration={0.35}
        className="text-4xl md:text-5xl font-bold font-serif text-light-text dark:text-dark-text tracking-wide leading-snug max-w-2xl"
      >
        {heading}
      </TextEffect>
      <BlurFade delay={0.6} duration={0.5}>
        <p className="text-base md:text-lg text-light-text-secondary dark:text-dark-text-secondary max-w-lg leading-relaxed">
          {locale === 'zh' ? (
            <>每一筆捐款都上鏈、每一份影響力都可驗證。<br />透明公開，讓善意走得更遠。</>
          ) : (
            <>Every donation is on-chain, every impact is verifiable.<br />Transparent and open — let goodwill go further.</>
          )}
        </p>
      </BlurFade>
    </div>
  )
}
