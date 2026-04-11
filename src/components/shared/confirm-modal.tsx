import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils/cn'

interface ConfirmModalProps {
  open: boolean
  title?: string
  description: ReactNode
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'default' | 'destructive'
  loading?: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}

export function ConfirmModal({
  open,
  title = 'Xác nhận thao tác',
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  confirmVariant = 'default',
  loading = false,
  onConfirm,
  onOpenChange,
}: ConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!loading) onOpenChange(nextOpen) }}>
      <DialogContent className="sm:max-w-md" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <span
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-full',
                confirmVariant === 'destructive'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-primary/10 text-primary',
              )}
            >
              <AlertTriangle className="size-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription className="space-y-2 text-left leading-relaxed [&_mark]:rounded-md [&_mark]:bg-destructive/10 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:font-semibold [&_mark]:text-foreground [&_strong]:break-all [&_strong]:font-semibold [&_strong]:text-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button type="button" variant={confirmVariant} disabled={loading} onClick={onConfirm}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
