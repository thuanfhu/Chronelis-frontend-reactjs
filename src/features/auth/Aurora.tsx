import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils/cn'
import './aurora.css'

const DEFAULT_COLOR_STOPS = [
  'var(--primary)',
  'var(--accent)',
  'color-mix(in oklab, var(--primary) 55%, var(--accent) 45%)',
]

interface AuroraProps {
  className?: string
  colorStops?: string[]
  blend?: number
  amplitude?: number
  speed?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export default function Aurora({
  className,
  colorStops = DEFAULT_COLOR_STOPS,
  blend = 0.5,
  amplitude = 1,
  speed = 1,
}: AuroraProps) {
  const normalizedStops = [
    colorStops[0] ?? DEFAULT_COLOR_STOPS[0],
    colorStops[1] ?? DEFAULT_COLOR_STOPS[1],
    colorStops[2] ?? DEFAULT_COLOR_STOPS[2],
  ]

  const safeBlend = clamp(blend, 0.2, 0.85)
  const safeAmplitude = clamp(amplitude, 0.7, 1.6)
  const safeSpeed = clamp(speed, 0.35, 3)
  const durationSeconds = Math.round(24 / safeSpeed)

  const style = {
    '--aurora-1': normalizedStops[0],
    '--aurora-2': normalizedStops[1],
    '--aurora-3': normalizedStops[2],
    '--aurora-opacity': safeBlend.toString(),
    '--aurora-scale': safeAmplitude.toString(),
    '--aurora-speed': `${durationSeconds}s`,
  } as CSSProperties

  return <div aria-hidden="true" className={cn('aurora', className)} style={style} />
}
