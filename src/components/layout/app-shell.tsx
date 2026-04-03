import { Outlet, useParams } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { TaskDetailsDrawer } from '@/features/tasks/task-details-drawer'
import { CommandPalette } from '@/components/shared/command-palette'

export function AppShell() {
  const params = useParams()
  const workspaceId = params.workspaceId ? Number(params.workspaceId) : undefined
  const projectId = params.projectId ? Number(params.projectId) : undefined

  return (
    <div className="flex min-h-dvh">
      <AppSidebar workspaceId={workspaceId} projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="flex-1 px-3 py-4 sm:px-4 sm:py-6 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
      <TaskDetailsDrawer />
      <CommandPalette />
    </div>
  )
}
