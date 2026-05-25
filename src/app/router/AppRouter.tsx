import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { AdminGuard, ProtectedGuard, PublicOnlyGuard } from '@/app/router/guards'
import { useMetadata } from '@/hooks/use-metadata'

const LoginPage = lazy(() => import('@/features/auth/login-page').then(m => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/features/auth/register-page').then(m => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/features/auth/forgot-password-page').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('@/features/auth/reset-password-page').then(m => ({ default: m.ResetPasswordPage })))
const VerifyAccountPage = lazy(() => import('@/features/auth/verify-account-page').then(m => ({ default: m.VerifyAccountPage })))
const VerifyEmailChangePage = lazy(() => import('@/features/auth/verify-email-change-page').then(m => ({ default: m.VerifyEmailChangePage })))
const ForbiddenPage = lazy(() => import('@/pages/forbidden-page').then(m => ({ default: m.ForbiddenPage })))
const NotFoundPage = lazy(() => import('@/pages/not-found-page').then(m => ({ default: m.NotFoundPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard-page').then(m => ({ default: m.DashboardPage })))

const WorkspacesPage = lazy(() => import('@/features/workspaces/workspaces-page').then(m => ({ default: m.WorkspacesPage })))
const WorkspaceDetailPage = lazy(() => import('@/features/workspaces/workspace-detail-page').then(m => ({ default: m.WorkspaceDetailPage })))
const TasksLayout = lazy(() => import('@/features/tasks/tasks-layout').then(m => ({ default: m.TasksLayout })))
const TaskPomodoroPage = lazy(() => import('@/features/tasks/task-pomodoro-page').then(m => ({ default: m.TaskPomodoroPage })))
const TaskNotesPage = lazy(() => import('@/features/tasks/task-notes-page').then(m => ({ default: m.TaskNotesPage })))
const NotificationsPage = lazy(() => import('@/features/notifications/notifications-page').then(m => ({ default: m.NotificationsPage })))
const JoinByInvitePage = lazy(() => import('@/features/workspaces/join-by-invite-page').then(m => ({ default: m.JoinByInvitePage })))
const ProfilePage = lazy(() => import('@/features/profile/profile-page').then(m => ({ default: m.ProfilePage })))
const GoalTasksPage = lazy(() => import('@/features/goals/goal-tasks-page').then(m => ({ default: m.GoalTasksPage })))
const AdminDashboardPage = lazy(() => import('@/features/admin/admin-dashboard-page').then(m => ({ default: m.AdminDashboardPage })))
const AdminShell = lazy(() => import('@/features/admin/layout/admin-shell').then(m => ({ default: m.AdminShell })))
const MyWorkPage = lazy(() => import('@/pages/my-work-page').then(m => ({ default: m.MyWorkPage })))

const LandingPage = lazy(() => import('@/pages/landing-page').then(m => ({ default: m.LandingPage })))
const MarketingStaticPage = lazy(() => import('@/pages/marketing-static-page').then(m => ({ default: m.MarketingStaticPage })))

function MetadataTracker() {
  useMetadata()
  return null
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <MetadataTracker />
      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-2">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium text-muted-foreground">Loading...</span>
          </div>
        </div>
      }>
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
      </Suspense>
    </BrowserRouter>
  )
}
