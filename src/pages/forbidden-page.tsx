import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function ForbiddenPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-3xl font-bold">403 - Ban khong co quyen truy cap</h1>
        <p className="text-sm text-muted-foreground">Tai nguyen nay yeu cau permission khac voi role hien tai.</p>
        <Link to="/dashboard">
          <Button>Quay ve dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
