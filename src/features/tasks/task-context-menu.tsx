import { useEffect, useRef } from 'react'
import { Copy, Edit3, Trash2, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TaskContextMenuProps {
  open: boolean
  x: number
  y: number
  onClose: () => void
  onDuplicate: () => void
  onEdit: () => void
  onFocus: () => void
  onDelete: () => void
}

export function TaskContextMenu({
  open,
  x,
  y,
  onClose,
  onDuplicate,
  onEdit,
  onFocus,
  onDelete,
}: TaskContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        return
      }

      if (menuRef.current?.contains(event.target)) {
        return
      }

      onClose()
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('pointerdown', closeOnPointerDown)
    window.addEventListener('resize', onClose)
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, open])

  if (!open) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-80 w-44 rounded-xl border border-white/35 bg-background/85 p-1.5 shadow-2xl backdrop-blur-xl"
      style={{ top: y, left: x }}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-primary/10"
        onClick={() => {
          onDuplicate()
          onClose()
        }}
      >
        <Copy className="size-3.5" />
        {t('task.duplicateAction')}
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-primary/10"
        onClick={() => {
          onEdit()
          onClose()
        }}
      >
        <Edit3 className="size-3.5" />
        {t('common.edit')}
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors hover:bg-primary/10"
        onClick={() => {
          onFocus()
          onClose()
        }}
      >
        <Target className="size-3.5" />
        {t('task.focusMode')}
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
        onClick={() => {
          onDelete()
          onClose()
        }}
      >
        <Trash2 className="size-3.5" />
        {t('common.delete')}
      </button>
    </div>
  )
}
