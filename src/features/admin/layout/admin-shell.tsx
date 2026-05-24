import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AdminSidebar } from '@/features/admin/layout/admin-sidebar'
export function AdminShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Dong admin sidebar"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AdminSidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border/70 bg-background/90 px-4 backdrop-blur md:hidden">
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setMobileOpen(true)}>
            <Menu className="size-4" />
          </Button>

          <div className="flex items-center ml-1">
            <span className="text-sm font-extrabold tracking-wider bg-linear-to-r from-primary to-sky-500 bg-clip-text text-transparent uppercase">
              Admin Console
            </span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 flex flex-col">
          <div className="mx-auto w-full max-w-7xl min-w-0 flex-1 flex flex-col">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
