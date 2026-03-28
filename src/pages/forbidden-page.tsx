import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="size-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">403 — Bạn không có quyền truy cập</h1>
        <p className="text-sm text-muted-foreground">Tài nguyên này yêu cầu quyền hạn khác với vai trò hiện tại của bạn.</p>
        <Link to="/dashboard">
          <Button>Quay về dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
