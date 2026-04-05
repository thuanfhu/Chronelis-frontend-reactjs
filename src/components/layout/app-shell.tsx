import { useEffect } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopbar } from '@/components/layout/app-topbar'
import { TaskDetailsDrawer } from '@/features/tasks/task-details-drawer'
import { TaskDeleteConfirmDialog } from '@/features/tasks/task-delete-confirm-dialog'
import { CommandPalette } from '@/components/shared/command-palette'
import { useUiStore } from '@/app/store/ui-store'

export function AppShell() {
  const params = useParams()
  const parsedWorkspaceId = params.workspaceId ? Number(params.workspaceId) : undefined
  const parsedProjectId = params.projectId ? Number(params.projectId) : undefined
  const workspaceIdFromRoute = Number.isFinite(parsedWorkspaceId) ? parsedWorkspaceId : undefined
  const projectIdFromRoute = Number.isFinite(parsedProjectId) ? parsedProjectId : undefined
  const selectedWorkspaceId = useUiStore((state) => state.selectedWorkspaceId)
  const selectedProjectId = useUiStore((state) => state.selectedProjectId)
  const setSelectedWorkspaceId = useUiStore((state) => state.setSelectedWorkspaceId)
  const setSelectedProjectId = useUiStore((state) => state.setSelectedProjectId)
  const workspaceId = workspaceIdFromRoute ?? selectedWorkspaceId ?? undefined
  const projectId = projectIdFromRoute ?? selectedProjectId ?? undefined

  useEffect(() => {
    if (!workspaceIdFromRoute) {
      return
    }

    setSelectedWorkspaceId(workspaceIdFromRoute)
  }, [setSelectedWorkspaceId, workspaceIdFromRoute])

  useEffect(() => {
    if (projectIdFromRoute) {
      setSelectedProjectId(projectIdFromRoute)
      return
    }

    if (workspaceIdFromRoute) {
      setSelectedProjectId(null)
    }
  }, [projectIdFromRoute, setSelectedProjectId, workspaceIdFromRoute])

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
