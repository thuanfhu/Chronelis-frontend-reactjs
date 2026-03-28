import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { ProtectedGuard, PublicOnlyGuard } from '@/app/router/guards'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { VerifyAccountPage } from '@/features/auth/verify-account-page'
import { ForbiddenPage } from '@/pages/forbidden-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { DashboardPage } from '@/pages/dashboard-page'
import { WorkspacesPage } from '@/features/workspaces/workspaces-page'
import { WorkspaceDetailPage } from '@/features/workspaces/workspace-detail-page'
import { ProjectOverviewPage } from '@/features/projects/project-overview-page'
import { GoalsPage } from '@/features/goals/goals-page'
import { KanbanPage } from '@/features/tasks/kanban-page'
import { CalendarPage } from '@/features/tasks/calendar-page'
import { ActivityLogPage } from '@/features/activity/activity-log-page'
import { NotificationsPage } from '@/features/notifications/notifications-page'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyGuard>
              <LoginPage />
            </PublicOnlyGuard>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyGuard>
              <RegisterPage />
            </PublicOnlyGuard>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyGuard>
              <ForgotPasswordPage />
            </PublicOnlyGuard>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicOnlyGuard>
              <ResetPasswordPage />
            </PublicOnlyGuard>
          }
        />
        <Route
          path="/verify-account"
          element={
            <PublicOnlyGuard>
              <VerifyAccountPage />
            </PublicOnlyGuard>
          }
        />

        <Route path="/forbidden" element={<ForbiddenPage />} />

        <Route
          element={
            <ProtectedGuard>
              <AppShell />
            </ProtectedGuard>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId" element={<ProjectOverviewPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/goals" element={<GoalsPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/kanban" element={<KanbanPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/calendar" element={<CalendarPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/activity" element={<ActivityLogPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
