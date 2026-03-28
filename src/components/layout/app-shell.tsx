import { Outlet, useParams } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { TaskDetailsDrawer } from '@/features/tasks/task-details-drawer'

export function AppShell() {
  const params = useParams()
  const workspaceId = params.workspaceId ? Number(params.workspaceId) : undefined
  const projectId = params.projectId ? Number(params.projectId) : undefined

  return (
    <div className="flex min-h-dvh">
      <AppSidebar workspaceId={workspaceId} projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 md:px-6">
          <Outlet />
        </main>
      </div>
      <TaskDetailsDrawer />
    </div>
  )
}
