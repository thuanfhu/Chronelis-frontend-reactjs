import { useSearchParams } from 'react-router-dom'
import { CalendarDays, FolderKanban, ListTodo, Activity, Target, ChartNoAxesGantt } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KanbanPage } from '@/features/tasks/kanban-page'
import { TodoPage } from '@/features/tasks/todo-page'
import { CalendarPage } from '@/features/tasks/calendar-page'
import { ActivityLogPage } from '@/features/activity/activity-log-page'
import { GoalsPage } from '@/features/goals/goals-page'
import { ProjectGanttPage } from '@/features/projects/project-gantt-page'

export type TaskViewTab = 'calendar' | 'gantt' | 'kanban' | 'todo' | 'goals' | 'activity'

const TASK_TABS: { value: TaskViewTab; label: string; icon: typeof CalendarDays }[] = [
  { value: 'calendar', label: 'Lịch', icon: CalendarDays },
  { value: 'gantt', label: 'Gantt', icon: ChartNoAxesGantt },
  { value: 'kanban', label: 'Kanban', icon: FolderKanban },
  { value: 'todo', label: 'To Do', icon: ListTodo },
]

const PROJECT_TABS: { value: TaskViewTab; label: string; icon: typeof CalendarDays }[] = [
  { value: 'goals', label: 'Goals', icon: Target },
  { value: 'activity', label: 'Hoạt động', icon: Activity },
]

export function TasksLayout() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('view') as TaskViewTab) || 'calendar'
  const isTimelineView = activeTab === 'calendar' || activeTab === 'gantt'

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
        {activeTab === 'gantt' && <ProjectGanttPage />}
        {activeTab === 'kanban' && <KanbanPage />}
        {activeTab === 'todo' && <TodoPage />}
        {activeTab === 'goals' && <GoalsPage />}
        {activeTab === 'activity' && <ActivityLogPage />}
      </div>
    </div>
  )
}
