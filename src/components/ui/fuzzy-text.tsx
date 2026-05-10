import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface FuzzyTextProps {
  children: ReactNode
  baseIntensity?: number
  hoverIntensity?: number
  enableHover?: boolean
  className?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const buildShadow = (intensity: number) => {
  const safe = clamp(intensity, 0, 1)
  const count = Math.max(6, Math.round(8 + safe * 10))
  const maxOffset = 4 + safe * 10
  const maxBlur = 6 + safe * 12
  const alpha = Math.round(18 + safe * 28)

  return Array.from({ length: count }, () => {
    const x = (Math.random() - 0.5) * maxOffset
    const y = (Math.random() - 0.5) * maxOffset
    const blur = Math.random() * maxBlur
    return `${x.toFixed(2)}px ${y.toFixed(2)}px ${blur.toFixed(2)}px color-mix(in oklab, currentColor ${alpha}%, transparent)`
  }).join(', ')
}

export default function FuzzyText({
  children,
  baseIntensity = 0.2,
  hoverIntensity = 0.5,
  enableHover = false,
  className,
}: FuzzyTextProps) {
  const [isHovering, setIsHovering] = useState(false)
  const activeIntensity = useMemo(
    () => (enableHover && isHovering ? hoverIntensity : baseIntensity),
    [enableHover, hoverIntensity, baseIntensity, isHovering]
  )
  const [shadow, setShadow] = useState(() => buildShadow(activeIntensity))

  useEffect(() => {
    if (typeof window === 'undefined') return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const update = () => setShadow(buildShadow(activeIntensity))

    update()
    if (prefersReducedMotion) return

    const intervalId = window.setInterval(update, 120)
    return () => window.clearInterval(intervalId)
  }, [activeIntensity])

  const style: CSSProperties = {
    textShadow: shadow,
    willChange: 'text-shadow',
  }

  const handleEnter = () => setIsHovering(true)
  const handleLeave = () => setIsHovering(false)

  return (
    <span
      className={cn('inline-block', className)}
      style={style}
      onMouseEnter={enableHover ? handleEnter : undefined}
      onMouseLeave={enableHover ? handleLeave : undefined}
      onFocus={enableHover ? handleEnter : undefined}
      onBlur={enableHover ? handleLeave : undefined}
    >
      {children}
    </span>
  )
}
