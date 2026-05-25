import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  FolderKanban,
  ChevronRight,
  Search,
  LogOut,
  Menu,
  ChevronsLeft,
  ChevronDown,
  Target,
  LayoutGrid,
  Plus,
  Loader2,
  Trash2,
  Briefcase,
} from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils/cn'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmModal } from '@/components/shared/confirm-modal'
import { DeferredDeleteStack } from '@/components/shared/deferred-delete-stack'
import { ProjectFormFields } from '@/components/shared/project-form-fields'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUiStore } from '@/app/store/ui-store'
import { useAuthStore } from '@/app/store/auth-store'
import { projectApi } from '@/lib/api/modules/project-api'
import { goalApi } from '@/lib/api/modules/goal-api'
import { workspaceApi } from '@/lib/api/modules/workspace-api'
import { workspaceTeamApi } from '@/lib/api/modules/workspace-team-api'
import { queryKeys } from '@/lib/api/query-keys'
import { useDeferredDelete } from '@/lib/delete/use-deferred-delete'
import type { Goal, GoalStatusType, GoalType, PageResult, Project } from '@/types/domain'

function normalizeProgress(progressPercent: number | null | undefined): number {
  if (progressPercent == null || Number.isNaN(progressPercent)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(progressPercent)))
}

function resolveProgressClass(progressPercent: number): string {
  if (progressPercent >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (progressPercent >= 45) return 'text-sky-600 dark:text-sky-400'
  if (progressPercent >= 20) return 'text-amber-600 dark:text-amber-400'
  return 'text-muted-foreground/85'
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightMatch(text: string, keyword: string): ReactNode {
  const trimmedKeyword = keyword.trim()
  if (!trimmedKeyword) {
    return text
  }

  const matcher = new RegExp(`(${escapeRegExp(trimmedKeyword)})`, 'ig')
  const parts = text.split(matcher)
  const normalizedKeyword = trimmedKeyword.toLowerCase()

  return parts.map((part, index) =>
    part.toLowerCase() === normalizedKeyword ? (
      <mark key={`${text}-${index}`} className="rounded bg-primary/20 px-0.5 text-foreground">
        {part}
      </mark>
    ) : (
      <span key={`${text}-${index}`}>{part}</span>
    ),
  )
}

type SidebarContextTarget = { kind: 'project'; project: Project } | { kind: 'goal'; goal: Goal; project: Project }

type SidebarDeletePayload = {
  kind: 'project' | 'goal'
  id: number
  projectId: number
}

const EMPTY_PENDING_GOAL_IDS = new Set<number>()

interface AppSidebarProps {
  workspaceId?: number
  projectId?: number
}

export function AppSidebar({ workspaceId, projectId }: AppSidebarProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed)
  const theme = useUiStore((s) => s.theme)

  const clearSession = useAuthStore((s) => s.clearSession)
  const currentUser = useAuthStore((s) => s.currentUser)
  const currentUserId = useAuthStore((s) => s.currentUser?.userId ?? null)

  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(() => new Set(projectId ? [projectId] : []))
  const [sidebarContextMenu, setSidebarContextMenu] = useState<{
    x: number
    y: number
    target: SidebarContextTarget
  } | null>(null)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create')
  const [projectDialogTargetId, setProjectDialogTargetId] = useState<number | null>(null)
  const [projectFormName, setProjectFormName] = useState('')
  const [projectFormImageUrl, setProjectFormImageUrl] = useState('')
  const [projectFormDescription, setProjectFormDescription] = useState('')
  const [projectFormVisibility, setProjectFormVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [projectFormManagerUserId, setProjectFormManagerUserId] = useState('')
  const [projectFormManagerTeamId, setProjectFormManagerTeamId] = useState('')
  const [projectInitialName, setProjectInitialName] = useState('')
  const [projectInitialImageUrl, setProjectInitialImageUrl] = useState('')
  const [projectInitialDescription, setProjectInitialDescription] = useState('')
  const [projectInitialVisibility, setProjectInitialVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [projectInitialManagerUserId, setProjectInitialManagerUserId] = useState('')
  const [projectInitialManagerTeamId, setProjectInitialManagerTeamId] = useState('')

  const [goalDialogOpen, setGoalDialogOpen] = useState(false)
  const [goalDialogMode, setGoalDialogMode] = useState<'create' | 'edit'>('create')
  const [goalDialogTargetId, setGoalDialogTargetId] = useState<number | null>(null)
  const [goalDialogProjectId, setGoalDialogProjectId] = useState<number | null>(null)
  const [goalFormTitle, setGoalFormTitle] = useState('')
  const [goalFormType, setGoalFormType] = useState<GoalType>('SHORT_TERM')
  const [goalFormStatus, setGoalFormStatus] = useState<GoalStatusType>('NOT_STARTED')
  const [goalInitialTitle, setGoalInitialTitle] = useState('')
  const [goalInitialType, setGoalInitialType] = useState<GoalType>('SHORT_TERM')
  const [goalInitialStatus, setGoalInitialStatus] = useState<GoalStatusType>('NOT_STARTED')

  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'project' | 'goal'
    id: number
    label: string
    projectId: number
  } | null>(null)

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.byWorkspace(workspaceId ?? 0, 1, 50),
    queryFn: () => projectApi.listByWorkspace(workspaceId!, { page: 1, size: 50 }),
    enabled: !!workspaceId,
  })

  const workspaceQuery = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId ?? 0),
    queryFn: () => workspaceApi.detail(workspaceId!),
    enabled: !!workspaceId,
  })

  const membersQuery = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId ?? 0),
    queryFn: () => workspaceApi.members(workspaceId!),
    enabled: !!workspaceId,
  })

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.byWorkspace(workspaceId ?? 0),
    queryFn: () => workspaceTeamApi.listByWorkspace(workspaceId!),
    enabled: !!workspaceId,
  })

  const projects = projectsQuery.data?.content ?? []
  const members = membersQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const isOwner = workspaceQuery.data?.owner.userId === currentUserId
  const searchKeyword = workspaceSearch.trim().toLowerCase()

  const [hasExpandedAll, setHasExpandedAll] = useState(false)

  useEffect(() => {
    if (projects.length > 0 && !hasExpandedAll) {
      setExpandedProjects((prev) => {
        const next = new Set(prev)
        projects.forEach((p) => next.add(p.id))
        return next
      })
      setHasExpandedAll(true)
    }
  }, [projects, hasExpandedAll])

  const projectFormDirty =
    projectDialogMode === 'create'
      ? Boolean(projectFormName.trim())
      : projectFormName.trim() !== projectInitialName ||
        projectFormImageUrl.trim() !== projectInitialImageUrl ||
        projectFormDescription.trim() !== projectInitialDescription ||
        (isOwner && projectFormVisibility !== projectInitialVisibility) ||
        (isOwner && projectFormManagerUserId !== projectInitialManagerUserId) ||
        (isOwner && projectFormManagerTeamId !== projectInitialManagerTeamId)

  const goalFormDirty =
    goalDialogMode === 'create'
      ? Boolean(goalFormTitle.trim())
      : goalFormTitle.trim() !== goalInitialTitle ||
        goalFormType !== goalInitialType ||
        goalFormStatus !== goalInitialStatus

  const openProjectCreateDialog = () => {
    setProjectDialogMode('create')
    setProjectDialogTargetId(null)
    setProjectFormName('')
    setProjectFormImageUrl('')
    setProjectFormDescription('')
    setProjectFormVisibility('PUBLIC')
    setProjectFormManagerUserId('')
    setProjectFormManagerTeamId('')
    setProjectInitialName('')
    setProjectInitialImageUrl('')
    setProjectInitialDescription('')
    setProjectInitialVisibility('PUBLIC')
    setProjectInitialManagerUserId('')
    setProjectInitialManagerTeamId('')
    setProjectDialogOpen(true)
  }

  const openProjectEditDialog = (project: Project) => {
    setProjectDialogMode('edit')
    setProjectDialogTargetId(project.id)
    setProjectFormName(project.name)
    setProjectFormImageUrl(project.imageUrl ?? '')
    setProjectFormDescription(project.description ?? '')
    setProjectFormVisibility(project.visibility ?? 'PUBLIC')
    setProjectFormManagerUserId(project.managerUser?.userId ?? '')
    setProjectFormManagerTeamId(project.managerTeamId ? String(project.managerTeamId) : '')
    setProjectInitialName(project.name.trim())
    setProjectInitialImageUrl(project.imageUrl ?? '')
    setProjectInitialDescription((project.description ?? '').trim())
    setProjectInitialVisibility(project.visibility ?? 'PUBLIC')
    setProjectInitialManagerUserId(project.managerUser?.userId ?? '')
    setProjectInitialManagerTeamId(project.managerTeamId ? String(project.managerTeamId) : '')
    setProjectDialogOpen(true)
  }

  const openGoalCreateDialog = (project: Project) => {
    setGoalDialogMode('create')
    setGoalDialogTargetId(null)
    setGoalDialogProjectId(project.id)
    setGoalFormTitle('')
    setGoalFormType('SHORT_TERM')
    setGoalFormStatus('NOT_STARTED')
    setGoalInitialTitle('')
    setGoalInitialType('SHORT_TERM')
    setGoalInitialStatus('NOT_STARTED')
    setGoalDialogOpen(true)
  }

  const openGoalEditDialog = (project: Project, goal: Goal) => {
    setGoalDialogMode('edit')
    setGoalDialogTargetId(goal.id)
    setGoalDialogProjectId(project.id)
    setGoalFormTitle(goal.title)
    setGoalFormType(goal.goalType)
    setGoalFormStatus(goal.status)
    setGoalInitialTitle(goal.title.trim())
    setGoalInitialType(goal.goalType)
    setGoalInitialStatus(goal.status)
    setGoalDialogOpen(true)
  }

  const openContextMenu = (event: MouseEvent<HTMLElement>, target: SidebarContextTarget) => {
    event.preventDefault()
    event.stopPropagation()
    if (!isOwner) {
      return
    }

    const clampedX = Math.min(event.clientX, window.innerWidth - 228)
    const clampedY = Math.min(event.clientY, window.innerHeight - 228)
    setSidebarContextMenu({ x: clampedX, y: clampedY, target })
  }

  useEffect(() => {
    if (!sidebarContextMenu) {
      return
    }

    const closeMenu = () => {
      setSidebarContextMenu(null)
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('contextmenu', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('contextmenu', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [sidebarContextMenu])

  const createProjectMutation = useMutation({
    mutationFn: () => {
      if (!workspaceId) {
        throw new Error(t('sidebar.workspaceMissing'))
      }

      const payload: {
        workspaceId: number
        name: string
        imageUrl?: string
        description?: string
        visibility: 'PUBLIC' | 'PRIVATE'
        managerUserId?: string
        managerTeamId?: number
      } = {
        workspaceId,
        name: projectFormName.trim(),
        imageUrl: projectFormImageUrl.trim() || undefined,
        description: projectFormDescription.trim() || undefined,
        visibility: projectFormVisibility,
      }

      if (isOwner) {
        payload.managerUserId = projectFormManagerUserId || undefined
        payload.managerTeamId = projectFormManagerTeamId ? Number(projectFormManagerTeamId) : undefined
      }

      return projectApi.create(payload)
    },
    onMutate: async () => {
      if (!workspaceId) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: ['projects', 'workspace', workspaceId] })

      const snapshot = queryClient.getQueriesData<PageResult<Project>>({
        queryKey: ['projects', 'workspace', workspaceId],
      })
      const optimisticProjectId = -Date.now()
      const nowIso = new Date().toISOString()
      const optimisticProject: Project = {
        id: optimisticProjectId,
        workspaceId,
        name: projectFormName.trim(),
        imageUrl: projectFormImageUrl.trim() || undefined,
        description: projectFormDescription.trim() || undefined,
        status: 'ACTIVE',
        visibility: projectFormVisibility,
        createdBy: {
          userId: currentUser?.userId ?? '',
          email: currentUser?.email ?? '',
          firstName: currentUser?.firstName ?? '',
          lastName: currentUser?.lastName ?? '',
          avatarUrl: currentUser?.avatarUrl,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      }

      queryClient.setQueriesData<PageResult<Project>>(
        { queryKey: ['projects', 'workspace', workspaceId] },
        (oldData) => {
          if (!oldData) {
            return oldData
          }

          return {
            ...oldData,
            content: [optimisticProject, ...oldData.content],
          }
        },
      )

      return {
        snapshot,
        optimisticProjectId,
      }
    },
    onSuccess: (savedProject, _variables, context) => {
      setProjectDialogOpen(false)
      setProjectFormName('')
      setProjectFormImageUrl('')
      setProjectFormDescription('')
      setProjectFormManagerUserId('')
      setProjectFormManagerTeamId('')
      setExpandedProjects((previous) => new Set(previous).add(savedProject.id))

      if (workspaceId) {
        queryClient.setQueriesData<PageResult<Project>>(
          { queryKey: ['projects', 'workspace', workspaceId] },
          (oldData) => {
            if (!oldData) {
              return oldData
            }

            const replacedProjects = oldData.content.map((project) =>
              project.id === context?.optimisticProjectId ? savedProject : project,
            )

            return {
              ...oldData,
              content: replacedProjects.some((project) => project.id === savedProject.id)
                ? replacedProjects
                : [savedProject, ...replacedProjects],
            }
          },
        )
      }

      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      }
      toast.success(t('workspace.toast.projectCreated'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        for (const [queryKey, data] of context.snapshot) {
          queryClient.setQueryData(queryKey, data)
        }
      }

      toast.error(t('workspace.toast.projectCreateFailed'), { description: error.message })
    },
  })

  const updateProjectMutation = useMutation({
    mutationFn: () => {
      if (!projectDialogTargetId) {
        throw new Error(t('sidebar.projectMissing'))
      }

      const payload: {
        name: string
        imageUrl?: string
        description?: string
        visibility?: 'PUBLIC' | 'PRIVATE'
        managerUserId?: string
        managerTeamId?: number
      } = {
        name: projectFormName.trim(),
        imageUrl: projectFormImageUrl.trim(),
        description: projectFormDescription.trim() || undefined,
      }

      if (isOwner) {
        payload.visibility = projectFormVisibility
        payload.managerUserId = projectFormManagerUserId || undefined
        payload.managerTeamId = projectFormManagerTeamId ? Number(projectFormManagerTeamId) : undefined
      }

      return projectApi.update(projectDialogTargetId, payload)
    },
    onMutate: async () => {
      if (!workspaceId || !projectDialogTargetId) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: ['projects', 'workspace', workspaceId] })

      const snapshot = queryClient.getQueriesData<PageResult<Project>>({
        queryKey: ['projects', 'workspace', workspaceId],
      })

      queryClient.setQueriesData<PageResult<Project>>(
        { queryKey: ['projects', 'workspace', workspaceId] },
        (oldData) => {
          if (!oldData) {
            return oldData
          }

          return {
            ...oldData,
            content: oldData.content.map((project) =>
              project.id === projectDialogTargetId
                ? {
                    ...project,
                    name: projectFormName.trim(),
                    imageUrl: projectFormImageUrl.trim(),
                    description: projectFormDescription.trim() || undefined,
                    updatedAt: new Date().toISOString(),
                  }
                : project,
            ),
          }
        },
      )

      return {
        snapshot,
      }
    },
    onSuccess: (savedProject) => {
      setProjectDialogOpen(false)
      setProjectDialogTargetId(null)

      if (workspaceId) {
        queryClient.setQueriesData<PageResult<Project>>(
          { queryKey: ['projects', 'workspace', workspaceId] },
          (oldData) => {
            if (!oldData) {
              return oldData
            }

            return {
              ...oldData,
              content: oldData.content.map((project) => (project.id === savedProject.id ? savedProject : project)),
            }
          },
        )
      }

      if (workspaceId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
      }
      toast.success(t('workspace.toast.projectUpdated'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        for (const [queryKey, data] of context.snapshot) {
          queryClient.setQueryData(queryKey, data)
        }
      }

      toast.error(t('workspace.toast.projectUpdateFailed'), { description: error.message })
    },
  })

  const createGoalMutation = useMutation({
    mutationFn: () => {
      if (!goalDialogProjectId) {
        throw new Error(t('sidebar.goalProjectMissing'))
      }

      return goalApi.create({
        projectId: goalDialogProjectId,
        title: goalFormTitle.trim(),
        goalType: goalFormType,
        status: goalFormStatus,
      })
    },
    onMutate: async () => {
      if (!goalDialogProjectId) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: ['goals', goalDialogProjectId] })

      const snapshot = queryClient.getQueriesData<PageResult<Goal>>({ queryKey: ['goals', goalDialogProjectId] })
      const optimisticGoalId = -Date.now()
      const nowIso = new Date().toISOString()
      const optimisticGoal: Goal = {
        id: optimisticGoalId,
        projectId: goalDialogProjectId,
        title: goalFormTitle.trim(),
        goalType: goalFormType,
        status: goalFormStatus,
        progressPercent: 0,
        createdBy: {
          userId: currentUser?.userId ?? '',
          email: currentUser?.email ?? '',
          firstName: currentUser?.firstName ?? '',
          lastName: currentUser?.lastName ?? '',
          avatarUrl: currentUser?.avatarUrl,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      }

      queryClient.setQueriesData<PageResult<Goal>>({ queryKey: ['goals', goalDialogProjectId] }, (oldData) => {
        if (!oldData) {
          return oldData
        }

        return {
          ...oldData,
          content: [optimisticGoal, ...oldData.content],
        }
      })

      return {
        snapshot,
        optimisticGoalId,
      }
    },
    onSuccess: (savedGoal, _variables, context) => {
      const currentProjectId = goalDialogProjectId
      setGoalDialogOpen(false)
      setGoalDialogTargetId(null)
      if (currentProjectId) {
        queryClient.setQueriesData<PageResult<Goal>>({ queryKey: ['goals', currentProjectId] }, (oldData) => {
          if (!oldData) {
            return oldData
          }

          const replacedGoals = oldData.content.map((goal) =>
            goal.id === context?.optimisticGoalId ? savedGoal : goal,
          )

          return {
            ...oldData,
            content: replacedGoals.some((goal) => goal.id === savedGoal.id)
              ? replacedGoals
              : [savedGoal, ...replacedGoals],
          }
        })
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(currentProjectId, 1, 50) })
      }
      toast.success(t('goals.toast.createSuccess'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        for (const [queryKey, data] of context.snapshot) {
          queryClient.setQueryData(queryKey, data)
        }
      }

      toast.error(t('goals.toast.createFailed'), { description: error.message })
    },
  })

  const updateGoalMutation = useMutation({
    mutationFn: () => {
      if (!goalDialogTargetId) {
        throw new Error(t('sidebar.goalMissing'))
      }

      return goalApi.update(goalDialogTargetId, {
        title: goalFormTitle.trim(),
        goalType: goalFormType,
        status: goalFormStatus,
      })
    },
    onMutate: async () => {
      if (!goalDialogProjectId || !goalDialogTargetId) {
        return {}
      }

      await queryClient.cancelQueries({ queryKey: ['goals', goalDialogProjectId] })

      const snapshot = queryClient.getQueriesData<PageResult<Goal>>({ queryKey: ['goals', goalDialogProjectId] })

      queryClient.setQueriesData<PageResult<Goal>>({ queryKey: ['goals', goalDialogProjectId] }, (oldData) => {
        if (!oldData) {
          return oldData
        }

        return {
          ...oldData,
          content: oldData.content.map((goal) =>
            goal.id === goalDialogTargetId
              ? {
                  ...goal,
                  title: goalFormTitle.trim(),
                  goalType: goalFormType,
                  status: goalFormStatus,
                  updatedAt: new Date().toISOString(),
                }
              : goal,
          ),
        }
      })

      return {
        snapshot,
      }
    },
    onSuccess: (savedGoal) => {
      const currentProjectId = goalDialogProjectId
      setGoalDialogOpen(false)
      setGoalDialogTargetId(null)
      if (currentProjectId) {
        queryClient.setQueriesData<PageResult<Goal>>({ queryKey: ['goals', currentProjectId] }, (oldData) => {
          if (!oldData) {
            return oldData
          }

          return {
            ...oldData,
            content: oldData.content.map((goal) => (goal.id === savedGoal.id ? savedGoal : goal)),
          }
        })
        void queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(currentProjectId, 1, 50) })
      }
      toast.success(t('goals.toast.updateSuccess'))
    },
    onError: (error: Error, _variables, context) => {
      if (context?.snapshot) {
        for (const [queryKey, data] of context.snapshot) {
          queryClient.setQueryData(queryKey, data)
        }
      }

      toast.error(t('goals.toast.updateFailed'), { description: error.message })
    },
  })

  const {
    pendingDeletes: pendingSidebarDeletes,
    clockMs: sidebarDeleteClockMs,
    undoWindowMs: sidebarDeleteUndoWindowMs,
    scheduleDelete: scheduleSidebarDelete,
    undoDelete: undoSidebarDelete,
  } = useDeferredDelete<SidebarDeletePayload>({
    onFinalize: async (payload) => {
      if (payload.kind === 'project') {
        await projectApi.remove(payload.id)
        return
      }

      await goalApi.remove(payload.id)
    },
    onFinalizeSuccess: async (payload) => {
      if (payload.kind === 'project') {
        if (workspaceId) {
          await queryClient.invalidateQueries({ queryKey: queryKeys.projects.byWorkspace(workspaceId, 1, 50) })
        }

        if (workspaceId && projectId === payload.id) {
          navigate(`/workspaces/${workspaceId}`)
        }
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.byProject(payload.projectId, 1, 50) }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'project', payload.projectId] }),
      ])
    },
    pendingMessage: (entry) => {
      const entityName = entry.payload.kind === 'project' ? t('sidebar.projectKind') : t('sidebar.goalKind')
      return t('workspace.toast.deleteScheduled', { entity: entityName, name: entry.label })
    },
    successMessage: (entry) => {
      const entityName = entry.payload.kind === 'project' ? t('sidebar.projectKind') : t('sidebar.goalKind')
      return t('workspace.toast.deleteSuccess', { entity: entityName, name: entry.label })
    },
    alreadyDeletedMessage: (entry) => {
      const entityName = entry.payload.kind === 'project' ? t('sidebar.projectKind') : t('sidebar.goalKind')
      return t('workspace.toast.alreadyDeleted', { entity: entityName, name: entry.label })
    },
    errorTitle: t('common.error'),
  })

  const pendingProjectIds = new Set<number>()
  const pendingGoalIdsByProject = new Map<number, Set<number>>()

  for (const pendingEntry of pendingSidebarDeletes) {
    if (pendingEntry.payload.kind === 'project') {
      pendingProjectIds.add(pendingEntry.payload.id)
      continue
    }

    const currentGoalSet = pendingGoalIdsByProject.get(pendingEntry.payload.projectId) ?? new Set<number>()
    currentGoalSet.add(pendingEntry.payload.id)
    pendingGoalIdsByProject.set(pendingEntry.payload.projectId, currentGoalSet)
  }

  const visibleProjects = projects.filter((project) => !pendingProjectIds.has(project.id))
  const collapsedProjects = searchKeyword
    ? visibleProjects.filter((project) => project.name.toLowerCase().includes(searchKeyword))
    : visibleProjects

  const handleLogout = () => {
    clearSession()
    toast.success(t('common.toast.logoutSuccess'))
    navigate('/login')
  }

  const toggleProjectExpand = (id: number) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) {
      return
    }

    const queued = scheduleSidebarDelete({
      key: `${deleteTarget.kind}-${deleteTarget.id}`,
      label: deleteTarget.label,
      payload: {
        kind: deleteTarget.kind,
        id: deleteTarget.id,
        projectId: deleteTarget.projectId,
      },
    })

    if (queued) {
      setDeleteTarget(null)
    }
  }

  // Desktop collapsed = sidebarCollapsed (independent of mobile sidebarOpen)
  const collapsed = sidebarCollapsed

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-out',
          'lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'w-68',
        )}
      >
        {/* ─── Brand header ─── */}
        <div
          className={cn(
            'relative flex h-14 shrink-0 items-center border-b transition-colors',
            collapsed
              ? 'justify-center border-border/60 bg-background/80 px-1 backdrop-blur-lg'
              : 'justify-between border-sidebar-border bg-sidebar px-3',
          )}
        >
          {!collapsed && (
            <Link to="/dashboard" className="relative flex h-7 w-32 items-center gap-2.5 overflow-visible">
              <img
                src={theme === 'dark' ? '/favicon/chronelis-logo-darkmode.png' : '/favicon/chronelis-logo-lightmode.png'}
                alt="Chronelis"
                className={cn(
                  'pointer-events-none absolute left-0 top-1/2 h-28 w-auto max-w-none origin-left -translate-y-1/2 transition-all duration-300',
                  theme === 'dark' && 'scale-[0.78]',
                )}
              />
            </Link>
          )}

          {!collapsed && (
            <div className="hidden items-center gap-0.5 lg:flex">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label="Collapse sidebar"
              >
                <ChevronsLeft className="size-4" />
              </Button>
            </div>
          )}

          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute -right-3 top-1/2 hidden size-6 -translate-y-1/2 rounded-full border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:flex"
                  onClick={() => setSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                >
                  <ChevronsLeft className="size-3.5 rotate-180" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('sidebar.expand')}</TooltipContent>
            </Tooltip>
          )}

          <div className="absolute right-1 flex items-center lg:hidden">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <Menu className="size-4" />
            </Button>
          </div>
        </div>

        {/* ─── Workspace filter + overview ─── */}
        {!collapsed ? (
          <div className="space-y-2 px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={workspaceSearch}
                onChange={(event) => setWorkspaceSearch(event.target.value)}
                placeholder={t('nav.searchProjectGoal')}
                className="h-8 border-sidebar-border bg-sidebar-accent/35 pl-8 text-xs"
              />
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2">
              {workspaceId ? (
                <NavLink
                  to={`/workspaces/${workspaceId}`}
                  end
                  className={({ isActive }) =>
                    `inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-sidebar-border bg-sidebar-accent/35 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`
                  }
                  title={t('sidebar.workspaceOverview')}
                >
                  <LayoutGrid className="size-3.5 shrink-0" />
                  <span className="truncate">{t('sidebar.workspaceOverview')}</span>
                </NavLink>
              ) : null}

              <NavLink
                to="/my-work"
                className={({ isActive }) =>
                  `inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-sidebar-border bg-sidebar-accent/35 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`
                }
                title={t('nav.myWork')}
              >
                <Briefcase className="size-3.5 shrink-0" />
                <span className="truncate">{t('nav.myWork')}</span>
              </NavLink>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2">
            {workspaceId ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={`/workspaces/${workspaceId}`}
                    className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <LayoutGrid className="size-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{t('sidebar.workspaceOverview')}</TooltipContent>
              </Tooltip>
            ) : null}

            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  to="/my-work"
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Briefcase className="size-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{t('nav.myWork')}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* ─── Scrollable navigation ─── */}
        <ScrollArea className="flex-1 min-h-0">
          {/* ─── Projects section ─── */}
          {workspaceId && !collapsed && (
            <div className="px-2 py-2">
              <div className="mb-1 flex items-center justify-between gap-1 px-2">
                <button
                  onClick={() => setProjectsExpanded(!projectsExpanded)}
                  className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 transition-colors hover:text-muted-foreground"
                >
                  <ChevronDown
                    className={cn('size-3 transition-transform duration-200', !projectsExpanded && '-rotate-90')}
                  />
                  {t('sidebar.projectsSection')}
                </button>

                {isOwner && (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 text-muted-foreground hover:text-foreground"
                      onClick={openProjectCreateDialog}
                      title={t('common.create')}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <AnimatePresence initial={false}>
                {projectsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5">
                      {visibleProjects.map((proj) => (
                        <ProjectItem
                          key={proj.id}
                          project={proj}
                          workspaceId={workspaceId}
                          isActive={projectId === proj.id}
                          isExpanded={expandedProjects.has(proj.id) || Boolean(searchKeyword)}
                          searchKeyword={searchKeyword}
                          hiddenGoalIds={pendingGoalIdsByProject.get(proj.id) ?? EMPTY_PENDING_GOAL_IDS}
                          onToggleExpand={() => toggleProjectExpand(proj.id)}
                          onCreateGoal={openGoalCreateDialog}
                          onOpenContextMenu={openContextMenu}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapsed: project icons only */}
          {workspaceId && collapsed && (
            <div className="flex flex-col items-center gap-0.5 px-2 py-2">
              {collapsedProjects.map((proj) => (
                <Tooltip key={proj.id}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={`/workspaces/${workspaceId}/projects/${proj.id}`}
                      className={({ isActive }) =>
                        cn(
                          'flex size-9 items-center justify-center rounded-lg transition-all duration-150',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                            : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground',
                        )
                      }
                    >
                      <FolderKanban className="size-4" />
                    </NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right">{proj.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* ─── Footer ─── */}
        <div className="shrink-0 border-t border-sidebar-border p-2">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLogoutConfirmOpen(true)}
                  className="group flex w-full items-center justify-center rounded-lg p-2.5 text-destructive/70 transition-colors hover:bg-destructive hover:text-destructive-foreground"
                >
                  <LogOut className="size-4 icon-hover" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('common.logout')}</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-destructive/70 transition-all duration-150 hover:bg-destructive hover:text-destructive-foreground"
            >
              <LogOut className="size-4 icon-hover" />
              {t('common.logout')}
            </button>
          )}
        </div>
      </aside>

      <ConfirmModal
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title={t('admin.sidebar.logoutTitle')}
        description={t('admin.sidebar.logoutDescription')}
        confirmText={t('common.logout')}
        confirmVariant="destructive"
        onConfirm={handleLogout}
      />

      {sidebarContextMenu && !collapsed ? (
        <div
          className="fixed z-80 w-52 rounded-xl border border-white/35 bg-background/80 p-1.5 shadow-2xl backdrop-blur-xl"
          style={{ top: sidebarContextMenu.y, left: sidebarContextMenu.x }}
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {sidebarContextMenu.target.kind === 'project' && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground/90 transition-colors hover:bg-primary/10"
              onClick={() => {
                const contextProject = sidebarContextMenu.target.project
                openGoalCreateDialog(contextProject)
                setSidebarContextMenu(null)
              }}
            >
              <Target className="size-3.5" />
              {t('sidebar.createGoal')}
            </button>
          )}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground/90 transition-colors hover:bg-primary/10"
            onClick={() => {
              if (sidebarContextMenu.target.kind === 'project') {
                openProjectEditDialog(sidebarContextMenu.target.project)
              } else {
                openGoalEditDialog(sidebarContextMenu.target.project, sidebarContextMenu.target.goal)
              }
              setSidebarContextMenu(null)
            }}
          >
            <LayoutGrid className="size-3.5" />
            {t('common.edit')}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => {
              if (sidebarContextMenu.target.kind === 'project') {
                setDeleteTarget({
                  kind: 'project',
                  id: sidebarContextMenu.target.project.id,
                  label: sidebarContextMenu.target.project.name,
                  projectId: sidebarContextMenu.target.project.id,
                })
              } else {
                setDeleteTarget({
                  kind: 'goal',
                  id: sidebarContextMenu.target.goal.id,
                  label: sidebarContextMenu.target.goal.title,
                  projectId: sidebarContextMenu.target.project.id,
                })
              }
              setSidebarContextMenu(null)
            }}
          >
            <Trash2 className="size-3.5" />
            {t('common.delete')}
          </button>
        </div>
      ) : null}

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {projectDialogMode === 'create'
                ? t('sidebar.projectDialogCreateTitle')
                : t('sidebar.projectDialogEditTitle')}
            </DialogTitle>
            <DialogDescription>{t('sidebar.projectDialogDescription')}</DialogDescription>
          </DialogHeader>

          <ProjectFormFields
            name={projectFormName}
            imageUrl={projectFormImageUrl}
            description={projectFormDescription}
            visibility={projectFormVisibility}
            managerUserId={projectFormManagerUserId}
            managerTeamId={projectFormManagerTeamId}
            onNameChange={setProjectFormName}
            onImageUrlChange={setProjectFormImageUrl}
            onDescriptionChange={setProjectFormDescription}
            onVisibilityChange={setProjectFormVisibility}
            onManagerUserChange={setProjectFormManagerUserId}
            onManagerTeamChange={setProjectFormManagerTeamId}
            members={members}
            teams={teams}
            isOwner={isOwner}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (projectDialogMode === 'create') {
                  createProjectMutation.mutate()
                } else {
                  updateProjectMutation.mutate()
                }
              }}
              disabled={
                !projectFormName.trim() ||
                !projectFormDirty ||
                createProjectMutation.isPending ||
                updateProjectMutation.isPending
              }
            >
              {(createProjectMutation.isPending || updateProjectMutation.isPending) && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              {projectDialogMode === 'create' ? t('common.create') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {goalDialogMode === 'create' ? t('sidebar.goalDialogCreateTitle') : t('sidebar.goalDialogEditTitle')}
            </DialogTitle>
            <DialogDescription>
              {goalDialogMode === 'create'
                ? t('sidebar.goalDialogCreateDescription')
                : t('sidebar.goalDialogEditDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sidebar-goal-title">{t('sidebar.goalTitleLabel')}</Label>
              <Input
                id="sidebar-goal-title"
                value={goalFormTitle}
                onChange={(event) => setGoalFormTitle(event.target.value)}
                placeholder={t('sidebar.goalTitlePlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t('sidebar.goalTypeLabel')}</Label>
                <Select value={goalFormType} onValueChange={(value) => setGoalFormType(value as GoalType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHORT_TERM">{t('goals.type.SHORT_TERM')}</SelectItem>
                    <SelectItem value="MEDIUM_TERM">{t('goals.type.MEDIUM_TERM')}</SelectItem>
                    <SelectItem value="LONG_TERM">{t('goals.type.LONG_TERM')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t('sidebar.goalStatusLabel')}</Label>
                <Select value={goalFormStatus} onValueChange={(value) => setGoalFormStatus(value as GoalStatusType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_STARTED">{t('goals.status.NOT_STARTED')}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{t('goals.status.IN_PROGRESS')}</SelectItem>
                    <SelectItem value="ON_HOLD">{t('goals.status.ON_HOLD')}</SelectItem>
                    <SelectItem value="COMPLETED">{t('goals.status.COMPLETED')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (goalDialogMode === 'create') {
                  createGoalMutation.mutate()
                } else {
                  updateGoalMutation.mutate()
                }
              }}
              disabled={
                !goalFormTitle.trim() || !goalFormDirty || createGoalMutation.isPending || updateGoalMutation.isPending
              }
            >
              {(createGoalMutation.isPending || updateGoalMutation.isPending) && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              {goalDialogMode === 'create' ? t('common.create') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        title={deleteTarget?.kind === 'project' ? t('sidebar.deleteProjectTitle') : t('sidebar.deleteGoalTitle')}
        description={
          deleteTarget ? (
            <div className="space-y-3 text-left leading-relaxed text-muted-foreground">
              <p>
                {deleteTarget.kind === 'project'
                  ? t('sidebar.deleteProjectDescription', { name: deleteTarget.label })
                  : t('sidebar.deleteGoalDescription', { name: deleteTarget.label })}
              </p>
              <div className="rounded-2xl border border-destructive/12 bg-destructive/5 px-3 py-3 text-sm text-foreground/80">
                {deleteTarget.kind === 'project' ? t('sidebar.deleteProjectWarning') : t('sidebar.deleteGoalWarning')}
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText={t('common.delete')}
        confirmVariant="destructive"
        onConfirm={handleConfirmDelete}
      />

      <DeferredDeleteStack
        pendingDeletes={pendingSidebarDeletes}
        clockMs={sidebarDeleteClockMs}
        undoWindowMs={sidebarDeleteUndoWindowMs}
        onUndo={undoSidebarDelete}
        itemTitle={(entry) =>
          entry.payload.kind === 'project' ? t('sidebar.deletingProject') : t('sidebar.deletingGoal')
        }
      />
    </>
  )
}

// ─── Project Item with expandable Goals ───

function ProjectItem({
  project,
  workspaceId,
  isActive,
  isExpanded,
  searchKeyword,
  hiddenGoalIds,
  onToggleExpand,
  onCreateGoal,
  onOpenContextMenu,
}: {
  project: Project
  workspaceId: number
  isActive: boolean
  isExpanded: boolean
  searchKeyword: string
  hiddenGoalIds: Set<number>
  onToggleExpand: () => void
  onCreateGoal: (project: Project) => void
  onOpenContextMenu: (event: MouseEvent<HTMLElement>, target: SidebarContextTarget) => void
}) {
  const { t } = useTranslation()
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.byProject(project.id, 1, 50),
    queryFn: () => goalApi.listByProject(project.id, { page: 1, size: 50 }),
    enabled: project.id > 0,
  })

  const goals = goalsQuery.data?.content ?? []
  const visibleGoals = goals.filter((goal) => !hiddenGoalIds.has(goal.id))
  const filteredGoals = searchKeyword
    ? visibleGoals.filter((goal) => goal.title.toLowerCase().includes(searchKeyword))
    : visibleGoals

  const projectMatches = !searchKeyword || project.name.toLowerCase().includes(searchKeyword)
  const hasGoalMatches = filteredGoals.length > 0

  if (searchKeyword && !projectMatches && goalsQuery.isSuccess && !hasGoalMatches) {
    return null
  }

  const expanded = isExpanded || Boolean(searchKeyword)

  const projectProgress = useMemo(() => {
    if (visibleGoals.length === 0) {
      return 0
    }

    const total = visibleGoals.reduce((sum, goal) => sum + normalizeProgress(goal.progressPercent), 0)
    return normalizeProgress(total / visibleGoals.length)
  }, [visibleGoals])

  return (
    <div>
      <div className="flex w-full min-w-0 items-center overflow-hidden">
        <button
          onClick={onToggleExpand}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground/75 transition-colors hover:text-muted-foreground"
        >
          <ChevronRight className={cn('size-3 transition-transform duration-200', expanded && 'rotate-90')} />
        </button>
        <NavLink
          to={`/workspaces/${workspaceId}/projects/${project.id}`}
          className={cn(
            'grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_2.75rem] items-center gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-[13px] transition-all duration-150',
            isActive
              ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
              : 'text-sidebar-foreground/88 hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground',
          )}
          onContextMenu={(event) => onOpenContextMenu(event, { kind: 'project', project })}
        >
          <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate" title={project.name}>
            {highlightMatch(project.name, searchKeyword)}
          </span>
          <span
            className={cn(
              'shrink-0 text-right text-[10px] font-semibold tabular-nums',
              resolveProgressClass(projectProgress),
            )}
          >
            {projectProgress}%
          </span>
        </NavLink>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-6 space-y-0.5 border-l border-sidebar-border py-1 pl-2">
              {goalsQuery.isLoading && (
                <p className="px-2 py-1 text-[11px] text-muted-foreground/75">{t('sidebar.loadingGoals')}</p>
              )}
              {visibleGoals.length === 0 && !goalsQuery.isLoading && (
                <p className="px-2 py-1 text-[11px] text-muted-foreground/75">{t('sidebar.noGoals')}</p>
              )}
              {visibleGoals.length > 0 && filteredGoals.length === 0 && searchKeyword && !goalsQuery.isLoading ? (
                <div className="flex items-center justify-between gap-2 px-2 py-1">
                  <p className="text-[11px] text-muted-foreground/75">{t('sidebar.noMatchingGoals')}</p>
                  <Button variant="ghost" size="icon" className="size-6" onClick={() => onCreateGoal(project)}>
                    <Plus className="size-3" />
                  </Button>
                </div>
              ) : null}
              {filteredGoals.map((goal) => {
                const normalizedProgress = normalizeProgress(goal.progressPercent)

                return (
                  <NavLink
                    key={goal.id}
                    to={`/workspaces/${workspaceId}/projects/${project.id}/goals/${goal.id}/tasks`}
                    className={({ isActive }) =>
                      cn(
                        'group grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_2.75rem] items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-[12px] transition-colors',
                        isActive
                          ? 'bg-sidebar-primary/14 font-medium text-sidebar-accent-foreground ring-1 ring-sidebar-primary/20'
                          : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground',
                      )
                    }
                    onContextMenu={(event) => onOpenContextMenu(event, { kind: 'goal', goal, project })}
                  >
                    <Target className="size-3 shrink-0 text-muted-foreground/80" />
                    <span className="min-w-0 flex-1 truncate" title={goal.title}>
                      {highlightMatch(goal.title, searchKeyword)}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-right text-[10px] font-semibold tabular-nums',
                        resolveProgressClass(normalizedProgress),
                      )}
                    >
                      {normalizedProgress}%
                    </span>
                  </NavLink>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
