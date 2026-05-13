export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  workspaces: {
    all: ['workspaces'] as const,
    list: (page: number, size: number) => ['workspaces', 'list', page, size] as const,
    detail: (workspaceId: number) => ['workspaces', 'detail', workspaceId] as const,
    members: (workspaceId: number) => ['workspaces', 'members', workspaceId] as const,
  },
  projects: {
    byWorkspace: (workspaceId: number, page: number, size: number) =>
      ['projects', 'workspace', workspaceId, page, size] as const,
    detail: (projectId: number) => ['projects', 'detail', projectId] as const,
    effectiveAccess: (projectId: number) => ['projects', 'effective-access', projectId] as const,
    access: (projectId: number) => ['projects', 'access', projectId] as const,
  },
  goals: {
    byProject: (projectId: number, page: number, size: number) => ['goals', projectId, page, size] as const,
    detail: (goalId: number) => ['goals', 'detail', goalId] as const,
  },
  statuses: {
    byProject: (projectId: number) => ['task-statuses', projectId] as const,
  },
  tasks: {
    byProject: (projectId: number, page: number, size: number) => ['tasks', 'project', projectId, page, size] as const,
    byGoal: (goalId: number, page: number, size: number) => ['tasks', 'goal', goalId, page, size] as const,
    detail: (taskId: number) => ['tasks', 'detail', taskId] as const,
    dependencies: (taskId: number) => ['tasks', 'dependencies', taskId] as const,
    myWork: ['tasks', 'my-work'] as const,
  },
  schedules: {
    byTask: (taskId: number) => ['task-schedules', 'task', taskId] as const,
    projectCalendar: (projectId: number, fromDate: string, toDate: string, page: number, size: number) =>
      ['task-schedules', 'calendar', 'project', projectId, fromDate, toDate, page, size] as const,
    workspaceCalendar: (workspaceId: number, fromDate: string, toDate: string, page: number, size: number) =>
      ['task-schedules', 'calendar', 'workspace', workspaceId, fromDate, toDate, page, size] as const,
  },
  comments: {
    byTask: (taskId: number) => ['task-comments', taskId] as const,
  },
  notifications: {
    list: (page: number, size: number) => ['notifications', page, size] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  activityLogs: {
    byWorkspace: (workspaceId: number, queryKey: string, page: number, size: number) =>
      ['activity-logs', workspaceId, queryKey, page, size] as const,
  },
  taskTypes: {
    byProject: (projectId: number) => ['task-types', 'project', projectId] as const,
    detail: (taskTypeId: number) => ['task-types', 'detail', taskTypeId] as const,
  },
  teams: {
    byWorkspace: (workspaceId: number) => ['workspace-teams', 'workspace', workspaceId] as const,
    detail: (teamId: number) => ['workspace-teams', 'detail', teamId] as const,
    members: (teamId: number) => ['workspace-teams', 'members', teamId] as const,
  },
  invites: {
    byWorkspace: (workspaceId: number) => ['workspace-invites', 'workspace', workspaceId] as const,
    validate: (code: string) => ['workspace-invites', 'validate', code] as const,
  },
  admin: {
    roles: (page: number, size: number) => ['admin', 'roles', page, size] as const,
    permissions: (page: number, size: number) => ['admin', 'permissions', page, size] as const,
    modules: ['admin', 'permission-modules'] as const,
    users: (page: number, size: number) => ['admin', 'users', page, size] as const,
  },
}
