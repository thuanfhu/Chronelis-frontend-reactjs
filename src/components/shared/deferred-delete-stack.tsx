import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { DeferredDeleteEntry } from '@/lib/delete/use-deferred-delete'

interface CircularCountdownUndoProps {
  progress: number
  remainingSeconds: number
  onUndo: () => void
  disabled: boolean
}

function CircularCountdownUndo({ progress, remainingSeconds, onUndo, disabled }: CircularCountdownUndoProps) {
  const { t } = useTranslation()
  const radius = 18
  const strokeWidth = 3
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="flex items-center gap-2">
      <div className="relative grid size-11 place-items-center">
        <svg className="size-11 -rotate-90" viewBox="0 0 48 48" aria-hidden>
          <circle
            cx="24"
            cy="24"
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-muted/40"
          />
          <circle
            cx="24"
            cy="24"
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-primary"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 140ms linear' }}
          />
        </svg>
        <span className="absolute text-[10px] font-semibold tabular-nums">{remainingSeconds}</span>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="size-7 rounded-full"
        onClick={onUndo}
        disabled={disabled}
        aria-label={t('deferredDelete.undo')}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}

interface DeferredDeleteStackProps<TPayload> {
  pendingDeletes: Array<DeferredDeleteEntry<TPayload>>
  clockMs: number
  undoWindowMs: number
  onUndo: (key: string) => void
  itemTitle?: (entry: DeferredDeleteEntry<TPayload>) => string
  finalizingText?: string
  countdownText?: (remainingSeconds: number) => string
}

export function DeferredDeleteStack<TPayload>({
  pendingDeletes,
  clockMs,
  undoWindowMs,
  onUndo,
  itemTitle,
  finalizingText,
  countdownText,
}: DeferredDeleteStackProps<TPayload>) {
  const { t } = useTranslation()

  if (pendingDeletes.length === 0) {
    return null
  }

  const resolvedFinalizingText = finalizingText ?? t('deferredDelete.finalizing')

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-70 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {pendingDeletes.map((entry) => {
          const remainingMs = Math.max(0, entry.expiresAt - clockMs)
          const progress = Math.max(
            0,
            Math.min(100, (remainingMs / undoWindowMs) * 100),
          )
          const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))

          return (
            <motion.div
              key={entry.key}
              layout
              initial={{ opacity: 0, y: 18, scale: 0.96, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 12, scale: 0.96, filter: 'blur(8px)' }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto rounded-lg border border-border/80 bg-card/95 p-3 shadow-lg backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{itemTitle ? itemTitle(entry) : t('deferredDelete.pending')}</p>
                  <p className="break-all text-xs text-muted-foreground">{entry.label}</p>
                </div>

                <CircularCountdownUndo
                  progress={progress}
                  remainingSeconds={remainingSeconds}
                  onUndo={() => onUndo(entry.key)}
                  disabled={entry.status !== 'pending'}
                />
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">
                {entry.status === 'finalizing'
                  ? resolvedFinalizingText
                  : (countdownText ? countdownText(remainingSeconds) : t('deferredDelete.countdown', { seconds: remainingSeconds }))}
              </p>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
