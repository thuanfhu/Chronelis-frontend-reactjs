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
import { TasksLayout } from '@/features/tasks/tasks-layout'
import { TaskPomodoroPage } from '@/features/tasks/task-pomodoro-page'
import { NotificationsPage } from '@/features/notifications/notifications-page'
import { JoinByInvitePage } from '@/features/workspaces/join-by-invite-page'

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
          <Route path="/workspaces/:workspaceId/projects/:projectId" element={<TasksLayout />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/pomodoro/:taskId" element={<TaskPomodoroPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/join" element={<JoinByInvitePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
