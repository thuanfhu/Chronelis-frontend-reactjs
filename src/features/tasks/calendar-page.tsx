import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)?.push(schedule)
  }

  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime())
  }

  const groupedEntries = [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="space-y-5">
      <PageHeader title="Calendar" description="Lich task schedule theo ngay" />

      {groupedEntries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Chua co lich task nao trong project
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedEntries.map(([day, items]) => (
            <Card key={day}>
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base">{day}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {items.map((schedule) => (
                  <div key={schedule.id} className="rounded-md border bg-card p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Task #{schedule.taskId}</p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Start: {formatDateTime(schedule.scheduledStart)}</p>
                    <p className="text-xs text-muted-foreground">End: {formatDateTime(schedule.scheduledEnd)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
