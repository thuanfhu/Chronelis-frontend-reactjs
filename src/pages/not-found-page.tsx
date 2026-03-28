import { Link } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">404 — Không tìm thấy trang</h1>
        <p className="text-sm text-muted-foreground">Đường dẫn không tồn tại hoặc đã được thay đổi.</p>
        <Link to="/dashboard">
          <Button>Về trang chính</Button>
        </Link>
      </div>
    </div>
  )
}
