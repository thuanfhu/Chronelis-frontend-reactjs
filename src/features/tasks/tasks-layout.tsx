import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, FolderKanban, ListTodo, Activity, Target, Settings } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KanbanPage } from '@/features/tasks/kanban-page'
import { TodoPage } from '@/features/tasks/todo-page'
import { CalendarPage } from '@/features/tasks/calendar-page'
import { ActivityLogPage } from '@/features/activity/activity-log-page'
import { GoalsPage } from '@/features/goals/goals-page'
import { ProjectSettingsPage } from '@/features/projects/project-settings-page'

export type TaskViewTab = 'calendar' | 'kanban' | 'todo' | 'goals' | 'activity' | 'settings'

export function TasksLayout() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentView = searchParams.get('view')
  const activeTab = isTaskViewTab(currentView) ? currentView : 'calendar'
  const isTimelineView = activeTab === 'calendar'

  const TASK_TABS: { value: TaskViewTab; label: string; icon: typeof CalendarDays }[] = [
    { value: 'calendar', label: t('nav.calendar'), icon: CalendarDays },
    { value: 'kanban', label: t('nav.kanban'), icon: FolderKanban },
    { value: 'todo', label: t('nav.todo'), icon: ListTodo },
  ]

  const PROJECT_TABS: { value: TaskViewTab; label: string; icon: typeof CalendarDays }[] = [
    { value: 'goals', label: t('nav.goals'), icon: Target },
    { value: 'activity', label: t('nav.activity'), icon: Activity },
    { value: 'settings', label: t('nav.settings'), icon: Settings },
  ]

  const setActiveTab = (tab: TaskViewTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('view', tab)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <div className={`flex h-full min-h-0 flex-col ${isTimelineView ? 'gap-2' : 'gap-4'}`}>
      {/* ─── View tabs ─── */}
      <div className={`border-b border-border/60 ${isTimelineView ? 'pb-2' : 'pb-3'}`}>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TaskViewTab)}>
            <TabsList className="h-9 w-max bg-muted/60">
              {TASK_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="shrink-0 gap-1.5 px-3 text-xs data-[state=active]:shadow-sm"
                >
                  <tab.icon className="size-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="mx-1 hidden h-5 w-px shrink-0 bg-border/60 sm:block" />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TaskViewTab)}>
            <TabsList className="h-9 w-max bg-muted/60">
              {PROJECT_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="shrink-0 gap-1.5 px-3 text-xs data-[state=active]:shadow-sm"
                >
                  <tab.icon className="size-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ─── Active view ─── */}
      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'calendar' && <CalendarPage />}
        {activeTab === 'kanban' && <KanbanPage />}
        {activeTab === 'todo' && <TodoPage />}
        {activeTab === 'goals' && <GoalsPage />}
        {activeTab === 'activity' && <ActivityLogPage />}
        {activeTab === 'settings' && <ProjectSettingsPage />}
      </div>
    </div>
  )
}

function isTaskViewTab(value: string | null): value is TaskViewTab {
  return (
    value === 'calendar' ||
    value === 'kanban' ||
    value === 'todo' ||
    value === 'goals' ||
    value === 'activity' ||
    value === 'settings'
  )
}
