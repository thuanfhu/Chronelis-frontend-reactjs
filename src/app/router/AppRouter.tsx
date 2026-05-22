import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { AdminGuard, ProtectedGuard, PublicOnlyGuard } from '@/app/router/guards'
import { LoginPage } from '@/features/auth/login-page'
import { RegisterPage } from '@/features/auth/register-page'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { VerifyAccountPage } from '@/features/auth/verify-account-page'
import { VerifyEmailChangePage } from '@/features/auth/verify-email-change-page'
import { ForbiddenPage } from '@/pages/forbidden-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { DashboardPage } from '@/pages/dashboard-page'

import { WorkspacesPage } from '@/features/workspaces/workspaces-page'
import { WorkspaceDetailPage } from '@/features/workspaces/workspace-detail-page'
import { TasksLayout } from '@/features/tasks/tasks-layout'
import { TaskPomodoroPage } from '@/features/tasks/task-pomodoro-page'
import { TaskNotesPage } from '@/features/tasks/task-notes-page'
import { NotificationsPage } from '@/features/notifications/notifications-page'
import { JoinByInvitePage } from '@/features/workspaces/join-by-invite-page'
import { ProfilePage } from '@/features/profile/profile-page'
import { GoalTasksPage } from '@/features/goals/goal-tasks-page'
import { AdminDashboardPage } from '@/features/admin/admin-dashboard-page'
import { AdminShell } from '@/features/admin/layout/admin-shell'
import { MyWorkPage } from '@/pages/my-work-page'

import { LandingPage } from '@/pages/landing-page'
import { MarketingStaticPage } from '@/pages/marketing-static-page'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

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
          path="/auth/reset-password"
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
        <Route
          path="/auth/verify-active-account"
          element={
            <PublicOnlyGuard>
              <VerifyAccountPage />
            </PublicOnlyGuard>
          }
        />

        <Route
          path="/verify-change-email"
          element={
            <ProtectedGuard>
              <VerifyEmailChangePage />
            </ProtectedGuard>
          }
        />
        <Route
          path="/auth/verify-change-email"
          element={
            <ProtectedGuard>
              <VerifyEmailChangePage />
            </ProtectedGuard>
          }
        />

        <Route path="/forbidden" element={<ForbiddenPage />} />
        <Route path="/features" element={<MarketingStaticPage pageKey="features" />} />
        <Route path="/integrations" element={<MarketingStaticPage pageKey="integrations" />} />
        <Route path="/pricing" element={<MarketingStaticPage pageKey="pricing" />} />
        <Route path="/changelog" element={<MarketingStaticPage pageKey="changelog" />} />
        <Route path="/about" element={<MarketingStaticPage pageKey="about" />} />
        <Route path="/roadmap" element={<MarketingStaticPage pageKey="roadmap" />} />
        <Route path="/guides" element={<MarketingStaticPage pageKey="guides" />} />
        <Route path="/contact" element={<MarketingStaticPage pageKey="contact" />} />
        <Route path="/privacy" element={<MarketingStaticPage pageKey="privacy" />} />
        <Route path="/terms" element={<MarketingStaticPage pageKey="terms" />} />
        <Route path="/cookies" element={<MarketingStaticPage pageKey="cookies" />} />
        <Route path="/careers" element={<Navigate to="/roadmap" replace />} />
        <Route path="/blog" element={<Navigate to="/guides" replace />} />

        <Route
          element={
            <ProtectedGuard>
              <AppShell />
            </ProtectedGuard>
          }
        >
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/my-work" element={<MyWorkPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceDetailPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId" element={<TasksLayout />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/goals/:goalId/tasks" element={<GoalTasksPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/pomodoro/:taskId" element={<TaskPomodoroPage />} />
          <Route path="/workspaces/:workspaceId/projects/:projectId/tasks/:taskId/notes" element={<TaskNotesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route
          path="/join"
          element={
            <ProtectedGuard>
              <JoinByInvitePage />
            </ProtectedGuard>
          }
        />

        <Route
          element={
            <AdminGuard>
              <AdminShell />
            </AdminGuard>
          }
        >
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          <Route path="/admin/:section" element={<AdminDashboardPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
