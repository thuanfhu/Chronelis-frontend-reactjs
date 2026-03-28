import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { CalendarDays, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingPanel } from '@/components/shared/loading-panel'
import { taskScheduleApi } from '@/lib/api/modules/task-schedule-api'
import { queryKeys } from '@/lib/api/query-keys'
import { formatDateTime } from '@/lib/utils/datetime'

function getDayKey(value: string) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDayLabel(dayKey: string) {
  const date = new Date(dayKey + 'T00:00:00')
  const today = new Date()
  const todayKey = getDayKey(today.toISOString())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowKey = getDayKey(tomorrow.toISOString())

  const dayName = date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (dayKey === todayKey) return `Hôm nay — ${dayName}`
  if (dayKey === tomorrowKey) return `Ngày mai — ${dayName}`
  return dayName
}

export function CalendarPage() {
  const params = useParams()
  const projectId = Number(params.projectId)
  const fromDate = '2000-01-01'
  const toDate = '2100-12-31'

  const schedulesQuery = useQuery({
    queryKey: queryKeys.schedules.projectCalendar(projectId, fromDate, toDate, 1, 200),
    queryFn: () => taskScheduleApi.projectCalendar(projectId, fromDate, toDate, { page: 1, size: 200 }),
    enabled: Number.isFinite(projectId),
  })

  if (schedulesQuery.isLoading) {
    return <LoadingPanel />
  }

  const schedules = schedulesQuery.data?.content ?? []
  const grouped = new Map<string, typeof schedules>()

  for (const schedule of schedules) {
    const key = getDayKey(schedule.scheduledStart)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)?.push(schedule)
  }

  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
  }

  const groupedEntries = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="space-y-6">
      <PageHeader title="Lịch" description="Lịch task schedule theo ngày" />

      {groupedEntries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CalendarDays className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">Chưa có lịch task nào</p>
            <p className="mt-1 text-xs text-muted-foreground">Thêm lịch biểu từ chi tiết task để hiển thị ở đây</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map(([day, items]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                <h3 className="text-sm font-semibold capitalize">{formatDayLabel(day)}</h3>
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
              </div>
              <div className="ml-2 space-y-2 border-l-2 border-muted pl-4">
                {items.map((schedule) => (
                  <Card key={schedule.id} className="transition-all hover:shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Clock className="size-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Task #{schedule.taskId}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>Bắt đầu: {formatDateTime(schedule.scheduledStart)}</span>
                          <span>·</span>
                          <span>Kết thúc: {formatDateTime(schedule.scheduledEnd)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
