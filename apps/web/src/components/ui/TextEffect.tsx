import { motion, useInView, type Variants } from 'motion/react'
import { useRef } from 'react'

interface TextEffectProps {
  children: string
  className?: string
  per?: 'word' | 'char'
  delay?: number
  duration?: number
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
}

export function TextEffect({
  children,
  className,
  per = 'char',
  delay = 0,
  duration = 0.3,
  as: Tag = 'p',
}: TextEffectProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  const segments = per === 'word' ? children.split(' ') : children.split('')

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: per === 'char' ? 0.03 : 0.08,
        delayChildren: delay,
      },
    },
  }

  const child: Variants = {
    hidden: {
      opacity: 0,
      filter: 'blur(8px)',
      y: 4,
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        duration,
        ease: 'easeOut',
      },
    },
  }

  return (
    <motion.div
      ref={ref}
      variants={container}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      className={className}
      aria-label={children}
    >
      {segments.map((segment, i) => (
        <motion.span
          key={i}
          variants={child}
          style={{ display: 'inline-block', whiteSpace: per === 'word' ? 'pre' : undefined }}
        >
          {per === 'word' ? (i < segments.length - 1 ? `${segment}\u00A0` : segment) : segment}
        </motion.span>
      ))}
    </motion.div>
  )
}
