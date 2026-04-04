import { Outlet, useParams } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { TaskDetailsDrawer } from '@/features/tasks/task-details-drawer'
import { TaskDeleteConfirmDialog } from '@/features/tasks/task-delete-confirm-dialog'
import { CommandPalette } from '@/components/shared/command-palette'

export function AppShell() {
  const params = useParams()
  const workspaceId = params.workspaceId ? Number(params.workspaceId) : undefined
  const projectId = params.projectId ? Number(params.projectId) : undefined

  return (
    <div className="flex h-dvh overflow-hidden">
      <AppSidebar workspaceId={workspaceId} projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppTopbar />
        <main className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-6 md:px-8">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
            <Outlet />
          </div>
        </main>
      </div>
      <TaskDetailsDrawer />
      <TaskDeleteConfirmDialog />
      <CommandPalette />
    </div>
  )
}
