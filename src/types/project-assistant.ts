import type {
  GoalStatusType,
  GoalType,
  ProjectStatusType,
  TaskPriorityType,
} from '@/types/domain'

export type ProjectAssistantActionType =
  | 'UPDATE_PROJECT'
  | 'CREATE_GOAL'
  | 'UPDATE_GOAL'
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'MOVE_TASK'
  | 'UPDATE_TASK_COMPLETION'
  | 'CREATE_TASK_SCHEDULE'
  | 'UPDATE_TASK_SCHEDULE'

export interface ProjectAssistantPlannedAction {
  actionId: string
  order?: number
  actionType: ProjectAssistantActionType
  actionTitle?: string
  rationale?: string
  executable?: boolean
  validationErrors: string[]
  goalId?: number
  taskId?: number
  scheduleId?: number
  name?: string
  title?: string
  description?: string
  projectStatus?: ProjectStatusType
  goalType?: GoalType
  goalStatus?: GoalStatusType
  progressPercent?: number
  priority?: TaskPriorityType
  statusCode?: string
  targetPosition?: number
  clearGoal?: boolean
  dueDate?: string
  estimatedMinutes?: number
  completed?: boolean
  scheduledStart?: string
  scheduledEnd?: string
}

export interface ProjectAssistantPlan {
  summary?: string
  warnings: string[]
  actions: ProjectAssistantPlannedAction[]
}

export interface ProjectAssistantExecutionResult {
  actionId: string
  actionType: ProjectAssistantActionType
  actionTitle?: string
  outcome?: string
  projectId?: number
  goalId?: number
  taskId?: number
  scheduleId?: number
}

export interface ProjectAssistantStatus {
  enabled: boolean
  configured: boolean
  ready: boolean
  provider?: string
  model?: string
  maxPreviewActions?: number
  supportedActions: ProjectAssistantActionType[]
  message?: string
}

export interface ProjectAssistantPreviewResponse {
  projectId: number
  provider?: string
  model?: string
  plan: ProjectAssistantPlan
  generatedAt?: string
}

export interface ProjectAssistantApplyResponse {
  projectId: number
  requestedCount: number
  appliedCount: number
  results: ProjectAssistantExecutionResult[]
  warnings: string[]
  appliedAt?: string
}