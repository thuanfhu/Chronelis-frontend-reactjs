import type { PaginationMeta } from '@/types/api'

export type WorkspaceMemberRoleType = 'OWNER' | 'MEMBER'
export type ProjectStatusType = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'
export type ProjectVisibilityType = 'PUBLIC' | 'PRIVATE'
export type ProjectAccessRoleType = 'MANAGER' | 'CONTRIBUTOR' | 'VIEWER'
export type ProjectAccessSubjectType = 'USER' | 'TEAM'
export type EffectiveProjectAccessRoleType = ProjectAccessRoleType | 'NO_ACCESS'
export type GoalType = 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM'
export type GoalStatusType = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD'
export type TaskPriorityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type SourceViewType = 'KANBAN' | 'TODO' | 'CALENDAR'

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_COMMENTED'
  | 'TASK_RESCHEDULED'
  | 'TASK_STATUS_CHANGED'
  | 'GOAL_UPDATED'
  | 'WORKSPACE_MEMBER_ADDED'
  | 'WORKSPACE_MEMBER_REMOVED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'WORKSPACE_INVITE_USED'

export type ReferenceType =
  | 'TASK'
  | 'GOAL'
  | 'PROJECT'
  | 'WORKSPACE'
  | 'COMMENT'
  | 'SCHEDULE'
  | 'TASK_TYPE'
  | 'TEAM'
  | 'INVITE'
  | 'CHECK_ITEM'

export type ActivityActionType =
  | 'WORKSPACE_CREATED'
  | 'WORKSPACE_UPDATED'
  | 'WORKSPACE_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'MEMBER_ROLE_UPDATED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'GOAL_CREATED'
  | 'GOAL_UPDATED'
  | 'GOAL_DELETED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_ASSIGNED'
  | 'TASK_UNASSIGNED'
  | 'TASK_RESCHEDULED'
  | 'TASK_MOVED_STATUS'
  | 'TASK_REORDERED'
  | 'TASK_DELETED'
  | 'COMMENT_ADDED'
  | 'COMMENT_UPDATED'
  | 'COMMENT_DELETED'
  | 'TASK_TYPE_CREATED'
  | 'TASK_TYPE_UPDATED'
  | 'TASK_TYPE_DELETED'
  | 'TEAM_CREATED'
  | 'TEAM_UPDATED'
  | 'TEAM_DELETED'
  | 'TEAM_MEMBER_ADDED'
  | 'TEAM_MEMBER_REMOVED'
  | 'INVITE_CREATED'
  | 'INVITE_REVOKED'
  | 'INVITE_USED'
  | 'CHECK_ITEM_CREATED'
  | 'CHECK_ITEM_UPDATED'
  | 'CHECK_ITEM_DELETED'

export type ActivityTargetType =
  | 'TASK'
  | 'GOAL'
  | 'PROJECT'
  | 'WORKSPACE'
  | 'COMMENT'
  | 'SCHEDULE'
  | 'MEMBER'
  | 'STATUS'
  | 'TASK_TYPE'
  | 'TEAM'
  | 'INVITE'
  | 'CHECK_ITEM'

export interface UserSummary {
  userId: string
  email: string
  firstName: string
  lastName: string
}

export interface RoleSecure {
  roleId: string
  name: string
  description?: string
  active?: boolean
}

export interface UserSecure {
  userId: string
  email: string
  firstName: string
  lastName: string
  nickname?: string
  phoneNumber?: string
  biography?: string
  avatarUrl?: string
  city?: string
  nationality?: string
  rolesSecured?: RoleSecure[]
}

export interface AuthenticationPayload {
  accessToken: string
  userSecured: UserSecure
}

export interface Workspace {
  id: number
  name: string
  owner: UserSummary
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  id: number
  workspaceId: number
  user: UserSummary
  role: WorkspaceMemberRoleType
  joinedAt: string
}

export interface Project {
  id: number
  workspaceId: number
  name: string
  description?: string
  status: ProjectStatusType
  visibility: ProjectVisibilityType
  createdBy: UserSummary
  managerUser?: UserSummary
  managerTeamId?: number
  managerTeamName?: string
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: number
  projectId: number
  title: string
  goalType: GoalType
  status: GoalStatusType
  progressPercent: number
  createdBy: UserSummary
  managerUser?: UserSummary
  managerTeamId?: number
  managerTeamName?: string
  createdAt: string
  updatedAt: string
}

export interface TaskStatus {
  id: number
  projectId: number
  name: string
  code: string
  position: number
  isClosed: boolean
  createdAt: string
}

export interface Task {
  id: number
  workspaceId: number
  projectId: number
  goalId?: number
  status: TaskStatus
  title: string
  description?: string
  notesHtml?: string
  blockerNote?: string
  priority: TaskPriorityType
  taskType?: TaskType
  sourceView?: SourceViewType
  assignee?: UserSummary
  createdBy: UserSummary
  dueDate?: string
  estimatedMinutes: number
  boardPosition: number
  isCompleted: boolean
  blocked?: boolean
  blockedReason?: string
  blockedByOpenCount?: number
  blockingTaskCount?: number
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TaskDependencyTask {
  id: number
  projectId: number
  goalId?: number
  title: string
  statusName: string
  statusCode: string
  priority: TaskPriorityType
  dueDate?: string
  completed: boolean
}

export interface TaskDependencyDetails {
  taskId: number
  blockerNote?: string
  blocked: boolean
  blockedReason?: string
  blockedByOpenCount: number
  blockingTaskCount: number
  blockedByTasks: TaskDependencyTask[]
  blockingTasks: TaskDependencyTask[]
}

export interface MyWorkScheduleItem {
  scheduleId: number
  taskId: number
  scheduledStart: string
  scheduledEnd: string
  task: Task
}

export interface MyWorkSummary {
  assignedCount: number
  blockedCount: number
  overdueCount: number
  dueTodayCount: number
  highPriorityCount: number
  upcomingScheduledCount: number
  assignedTasks: Task[]
  upcomingSchedules: MyWorkScheduleItem[]
  generatedAt: string
}

export interface TaskSchedule {
  id: number
  taskId: number
  scheduledStart: string
  scheduledEnd: string
  scheduledDate: string
  createdBy: UserSummary
  createdAt: string
  updatedAt: string
}

export interface TaskComment {
  id: number
  taskId: number
  parentCommentId?: number | null
  user: UserSummary
  content: string
  createdAt: string
  updatedAt: string
}

export interface Notification {
  id: number
  type: NotificationType
  title: string
  message: string
  referenceType: ReferenceType
  referenceId: number
  isRead: boolean
  createdAt: string
}

export interface NotificationUnreadCount {
  unreadCount: number
}

export interface ActivityLog {
  id: number
  workspaceId: number
  actor: UserSummary
  actionType: ActivityActionType
  targetType: ActivityTargetType
  targetId: number
  description: string
  createdAt: string
}

export interface RealtimeEvent<T = unknown> {
  eventType: string
  data: T
  occurredAt: string
}

export interface PageResult<T> {
  meta: PaginationMeta
  content: T[]
}

export interface TaskType {
  id: number
  workspaceId: number
  projectId: number
  goalId?: number
  name: string
  description?: string
  color?: string
  icon?: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceTeam {
  id: number
  workspaceId: number
  name: string
  description?: string
  createdBy: UserSummary
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface WorkspaceTeamMember {
  id: number
  teamId: number
  user: UserSummary
  joinedAt: string
}

export interface WorkspaceInvite {
  id: number
  workspaceId: number
  workspaceName: string
  inviteCode: string
  roleToAssign: WorkspaceMemberRoleType
  createdBy: UserSummary
  maxUses?: number
  usedCount: number
  expiresAt?: string
  isActive: boolean
  createdAt: string
}
