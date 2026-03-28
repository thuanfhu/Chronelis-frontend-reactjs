import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-3xl font-bold">404 - Khong tim thay trang</h1>
        <p className="text-sm text-muted-foreground">Duong dan khong ton tai hoac da duoc thay doi.</p>
        <Button>
          <Link to="/dashboard">Ve trang chinh</Link>
        </Button>
      </div>
    </div>
  )
}
