import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface DeleteUndoStackItem {
  id: number | string
  entityLabel: string
  title: string
  expiresAt: number
  windowMs: number
  status: 'pending' | 'finalizing'
}

interface DeleteUndoStackProps {
  items: DeleteUndoStackItem[]
  clockMs: number
  onUndo: (id: number | string) => void
}

const RING_RADIUS = 12
const RING_STROKE = 3
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function DeleteUndoStack({ items, clockMs, onUndo }: DeleteUndoStackProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-70 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((item) => {
        const remainingMs = Math.max(0, item.expiresAt - clockMs)
        const progress = Math.max(0, Math.min(1, remainingMs / item.windowMs))
        const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
        const ringOffset = RING_CIRCUMFERENCE * (1 - progress)

        return (
          <div
            key={item.id}
            className="pointer-events-auto rounded-lg border border-border/80 bg-card/95 p-3 shadow-lg backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Đang chờ xóa {item.entityLabel}</p>
                <p className="truncate text-xs text-muted-foreground">{item.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {item.status === 'finalizing'
                    ? 'Đang xóa vĩnh viễn...'
                    : `Tự động xóa sau ${remainingSeconds}s`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <svg
                  className="size-8 -rotate-90"
                  viewBox="0 0 32 32"
                  role="img"
                  aria-label={item.status === 'finalizing' ? 'Đang xóa' : `Còn ${remainingSeconds} giây`}
                >
                  <circle
                    cx="16"
                    cy="16"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.2"
                    strokeWidth={RING_STROKE}
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r={RING_RADIUS}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={ringOffset}
                    className="text-primary transition-[stroke-dashoffset] duration-100 ease-linear"
                  />
                </svg>

                {item.status === 'finalizing' ? (
                  <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <Button variant="outline" size="xs" onClick={() => onUndo(item.id)}>
                    Hoàn tác
                  </Button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
