import { useMemo, useRef, useState } from 'react'
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns'
import { ChevronDown, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GanttPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type GanttRowType = 'goal' | 'task' | 'milestone'

export interface GanttChartRow {
  id: string
  label: string
  start: Date
  end: Date
  type: GanttRowType
  parent?: string
  progress: number
  priority?: GanttPriority
  isCompleted: boolean
  chronelisTaskId?: number
  details?: string
}

interface GanttChartProps {
  rows: GanttChartRow[]
  selectedId?: string
  onRowClick?: (rowId: string, taskId?: number) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_W = 280
const ROW_H = 40
const GOAL_ROW_H = 44
const HEADER_H = 56
const BAR_H = 18
const MILESTONE_SIZE = 12
const MIN_DAY_W = 12
const MAX_DAY_W = 80
const DEFAULT_DAY_W = 30

// Static Tailwind classes (must be full strings for purge)
const PRIORITY_BAR: Record<GanttPriority, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-sky-500',
  HIGH: 'bg-amber-500',
  URGENT: 'bg-rose-500',
}
const PRIORITY_TRACK: Record<GanttPriority, string> = {
  LOW: 'bg-emerald-200 dark:bg-emerald-900/40',
  MEDIUM: 'bg-sky-200 dark:bg-sky-900/40',
  HIGH: 'bg-amber-200 dark:bg-amber-900/40',
  URGENT: 'bg-rose-200 dark:bg-rose-900/40',
}
const PRIORITY_MILESTONE: Record<GanttPriority, string> = {
  LOW: 'bg-emerald-500 ring-emerald-300 dark:ring-emerald-700',
  MEDIUM: 'bg-sky-500 ring-sky-300 dark:ring-sky-700',
  HIGH: 'bg-amber-500 ring-amber-300 dark:ring-amber-700',
  URGENT: 'bg-rose-500 ring-rose-300 dark:ring-rose-700',
}
const PRIORITY_LABEL: Record<GanttPriority, string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMonthColumns(rangeStart: Date, totalDays: number) {
  const cols: Array<{ label: string; startDay: number; days: number; year: number; month: number }> = []
  let cursor = new Date(rangeStart)
  let day = 0

  while (day < totalDays) {
    const y = cursor.getFullYear()
    const m = cursor.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const daysFromCursorToEnd = daysInMonth - cursor.getDate() + 1
    const count = Math.min(daysFromCursorToEnd, totalDays - day)

    cols.push({ label: format(cursor, 'MMM yyyy'), startDay: day, days: count, year: y, month: m })

    day += count
    cursor = new Date(y, m + 1, 1)
  }

  return cols
}

function formatShortDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GanttChart({ rows, selectedId, onRowClick }: GanttChartProps) {
  const [dayW, setDayW] = useState(DEFAULT_DAY_W)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Timeline range
  const { rangeStart, totalDays } = useMemo(() => {
    if (rows.length === 0) {
      const today = startOfDay(new Date())
      return { rangeStart: addDays(today, -14), totalDays: 90 }
    }

    const allDates = rows.flatMap((r) => [r.start, r.end])
    const minMs = Math.min(...allDates.map((d) => d.getTime()))
    const maxMs = Math.max(...allDates.map((d) => d.getTime()))
    const rawStart = addDays(startOfDay(new Date(minMs)), -14)
    const rawEnd = addDays(startOfDay(new Date(maxMs)), 14)
    const totalDays = Math.max(60, differenceInCalendarDays(rawEnd, rawStart) + 1)
    return { rangeStart: rawStart, totalDays }
  }, [rows])

  const rangeEnd = addDays(rangeStart, totalDays - 1)
  const monthCols = useMemo(() => buildMonthColumns(rangeStart, totalDays), [rangeStart, totalDays])

  const todayOffset = useMemo(() => {
    const today = startOfDay(new Date())
    const offset = differenceInCalendarDays(today, rangeStart)
    if (offset < 0 || offset >= totalDays) return null
    return offset * dayW
  }, [rangeStart, totalDays, dayW])

  // Collapse/expand
  const toggle = (goalId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return next
    })
  }

  // Visible rows
  const visible = useMemo(
    () => rows.filter((r) => !r.parent || !collapsed.has(r.parent)),
    [rows, collapsed],
  )

  // Per-row bar geometry
  function barGeo(row: GanttChartRow) {
    const startOffset = differenceInCalendarDays(startOfDay(row.start), rangeStart)
    const durationDays = Math.max(1, differenceInCalendarDays(startOfDay(row.end), startOfDay(row.start)) + 1)
    return {
      left: startOffset * dayW,
      width: durationDays * dayW,
    }
  }

  const totalW = SIDEBAR_W + totalDays * dayW

  return (
    <TooltipProvider>
      <div className="flex min-h-0 flex-col">
        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between gap-4 border-b border-border/60 bg-card/60 px-4 py-2.5">
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span>{formatShortDate(rangeStart)}</span>
            <span className="text-border/60">—</span>
            <span>{formatShortDate(rangeEnd)}</span>
            <span className="ml-2 rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-medium tracking-wide">
              {totalDays} ngày
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">Tỷ lệ</span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={dayW <= MIN_DAY_W}
              onClick={() => setDayW((w) => Math.max(MIN_DAY_W, Math.round(w * 0.72)))}
            >
              <Minus className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              disabled={dayW >= MAX_DAY_W}
              onClick={() => setDayW((w) => Math.min(MAX_DAY_W, Math.round(w * 1.4)))}
            >
              <Plus className="size-3" />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setDayW(DEFAULT_DAY_W)}
                >
                  <RotateCcw className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Đặt lại tỷ lệ mặc định</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto rounded-b-xl"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div style={{ minWidth: totalW }}>

            {/* ── Header row ── */}
            <div
              className="sticky top-0 z-20 flex border-b border-border/70 bg-card shadow-sm"
              style={{ height: HEADER_H }}
            >
              {/* Corner */}
              <div
                className="sticky left-0 z-30 flex shrink-0 items-end border-r border-border/70 bg-card pb-2 pl-4 pr-3"
                style={{ width: SIDEBAR_W }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Goal / Task
                </span>
              </div>

              {/* Month + week columns */}
              <div className="relative flex bg-card" style={{ width: totalDays * dayW }}>
                {monthCols.map((col, i) => (
                  <div
                    key={i}
                    className="shrink-0 overflow-hidden border-r border-border/40"
                    style={{ width: col.days * dayW }}
                  >
                    {/* Month label */}
                    <div className="flex h-7 items-center border-b border-border/30 px-2">
                      <span className="whitespace-nowrap text-[11px] font-semibold text-foreground">
                        {col.label}
                      </span>
                    </div>
                    {/* Week marks */}
                    <div
                      className="relative overflow-hidden"
                      style={{ height: HEADER_H - 28 }}
                    >
                      {Array.from({ length: Math.ceil(col.days / 7) }).map((_, wi) => {
                        const weekOffset = wi * 7 * dayW
                        if (weekOffset >= col.days * dayW) return null
                        const weekDay = new Date(col.year, col.month, wi * 7 + 1)
                        return (
                          <div
                            key={wi}
                            className="absolute top-0 text-[9px] text-muted-foreground/60"
                            style={{ left: weekOffset + 2 }}
                          >
                            {`W${Math.ceil((weekDay.getDate()) / 7)}`}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Today pin in header */}
                {todayOffset != null && (
                  <div
                    className="absolute top-0 z-10 flex flex-col items-center"
                    style={{ left: todayOffset }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <div className="w-0.5 flex-1 bg-primary/70" style={{ height: HEADER_H - 6 }} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Data rows ── */}
            {visible.map((row) => {
              const isGoal = row.type === 'goal'
              const isMilestone = row.type === 'milestone'
              const rowH = isGoal ? GOAL_ROW_H : ROW_H
              const isSelected = row.id === selectedId
              const hasChildren = isGoal && rows.some((r) => r.parent === row.id)
              const isCollapsed = isGoal && collapsed.has(row.id)
              const geo = barGeo(row)
              const prio = row.priority ?? 'MEDIUM'
              const barTop = Math.round((rowH - BAR_H) / 2)
              const milestoneTop = Math.round((rowH - MILESTONE_SIZE) / 2)

              return (
                <div
                  key={row.id}
                  className={cn(
                    'group flex cursor-pointer border-b border-border/40 transition-colors duration-100',
                    isGoal ? 'bg-violet-50/40 dark:bg-violet-950/20' : 'bg-transparent',
                    isSelected && 'bg-primary/5 dark:bg-primary/10',
                    !isSelected && 'hover:bg-muted/20',
                  )}
                  style={{ height: rowH }}
                  onClick={() => onRowClick?.(row.id, row.chronelisTaskId)}
                >
                  {/* ── Sidebar cell ── */}
                  <div
                    className={cn(
                      'sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border/50 px-3 transition-colors',
                      isGoal ? 'bg-violet-50/80 dark:bg-violet-950/40' : 'bg-card/90',
                      isSelected && 'bg-primary/5!',
                      !isSelected && 'group-hover:bg-muted/20',
                    )}
                    style={{ width: SIDEBAR_W }}
                  >
                    {/* Expand/collapse (goals only) */}
                    {isGoal && (
                      <button
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); if (hasChildren) toggle(row.id) }}
                        style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                      >
                        {isCollapsed
                          ? <ChevronRight className="size-3.5" />
                          : <ChevronDown className="size-3.5" />
                        }
                      </button>
                    )}

                    {/* Indent for tasks */}
                    {!isGoal && <div className="w-5 shrink-0" />}

                    {/* Goal color strip */}
                    {isGoal && (
                      <div className="h-5 w-1 shrink-0 rounded-full bg-violet-500/60" />
                    )}

                    {/* Label */}
                    <div className="min-w-0 flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p
                            className={cn(
                              'truncate leading-tight',
                              isGoal
                                ? 'text-sm font-semibold text-foreground'
                                : 'text-sm text-foreground/80',
                              row.isCompleted && 'line-through opacity-60',
                            )}
                          >
                            {row.label}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <p className="font-medium">{row.label}</p>
                          {row.details && <p className="mt-1 text-xs opacity-80">{row.details}</p>}
                          {row.priority && (
                            <p className="mt-1 text-xs opacity-80">
                              Độ ưu tiên: {PRIORITY_LABEL[row.priority]}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                      {row.details && (
                        <p className="mt-0.5 truncate text-[10px] leading-none text-muted-foreground/60">
                          {row.details}
                        </p>
                      )}
                    </div>

                    {/* Completion dot */}
                    {row.isCompleted && (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    )}
                  </div>

                  {/* ── Timeline cell ── */}
                  <div
                    className="relative flex-1 overflow-hidden"
                    style={{ height: rowH }}
                  >
                    {/* Subtle week dividers */}
                    {monthCols.map((col, ci) =>
                      Array.from({ length: Math.ceil(col.days / 7) }).map((_, wi) => {
                        const x = (col.startDay + wi * 7) * dayW
                        return (
                          <div
                            key={`${ci}-${wi}`}
                            className="absolute inset-y-0 w-px bg-border/20"
                            style={{ left: x }}
                          />
                        )
                      }),
                    )}

                    {/* Month boundary lines */}
                    {monthCols.map((col, ci) => (
                      <div
                        key={ci}
                        className="absolute inset-y-0 w-px bg-border/40"
                        style={{ left: col.startDay * dayW }}
                      />
                    ))}

                    {/* Today line */}
                    {todayOffset != null && (
                      <div
                        className="absolute inset-y-0 z-2 w-0.5 bg-primary/40"
                        style={{ left: todayOffset }}
                      />
                    )}

                    {/* ── BAR ── */}
                    {isMilestone ? (
                      /* Milestone diamond */
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute z-3 rotate-45 rounded-sm ring-2 ring-offset-1 transition-shadow',
                              PRIORITY_MILESTONE[prio],
                              isSelected && 'ring-primary ring-offset-background',
                            )}
                            style={{
                              left: geo.left - MILESTONE_SIZE / 2,
                              top: milestoneTop,
                              width: MILESTONE_SIZE,
                              height: MILESTONE_SIZE,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{row.label}</p>
                          <p className="text-xs opacity-75">
                            Due: {formatShortDate(row.end)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : isGoal ? (
                      /* Goal summary bar */
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute z-3 overflow-hidden rounded-full border border-violet-400/60',
                              isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                            )}
                            style={{
                              left: geo.left,
                              top: barTop - 1,
                              width: Math.max(geo.width, 8),
                              height: BAR_H + 2,
                              background: `linear-gradient(90deg, rgb(139 92 246 / 0.55) ${row.progress}%, rgb(139 92 246 / 0.18) ${row.progress}%)`,
                            }}
                          >
                            <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-full bg-violet-500" />
                            <div className="absolute inset-y-0 right-0 w-1.5 rounded-r-full bg-violet-500" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{row.label}</p>
                          <p className="text-xs opacity-75">
                            {formatShortDate(row.start)} → {formatShortDate(row.end)}
                          </p>
                          <p className="text-xs opacity-75">Tiến độ: {row.progress}%</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      /* Task bar */
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'absolute z-3 overflow-hidden rounded-full transition-shadow',
                              isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
                            )}
                            style={{
                              left: geo.left,
                              top: barTop,
                              width: Math.max(geo.width, 6),
                              height: BAR_H,
                            }}
                          >
                            {/* Track */}
                            <div className={cn('absolute inset-0', PRIORITY_TRACK[prio])} />
                            {/* Progress fill */}
                            <div
                              className={cn('absolute inset-y-0 left-0', PRIORITY_BAR[prio])}
                              style={{
                                width: `${row.isCompleted ? 100 : row.progress}%`,
                              }}
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">{row.label}</p>
                          <p className="text-xs opacity-75">
                            {formatShortDate(row.start)} → {formatShortDate(row.end)}
                          </p>
                          {row.priority && (
                            <p className="text-xs opacity-75">
                              Ưu tiên: {PRIORITY_LABEL[prio]}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Inline label for wide bars */}
                    {!isMilestone && geo.width > 60 && (
                      <div
                        className="absolute z-4 truncate text-[10px] font-medium leading-none text-foreground/70 pointer-events-none"
                        style={{
                          left: geo.left + 8,
                          top: barTop + (BAR_H - 10) / 2,
                          maxWidth: geo.width - 16,
                        }}
                      >
                        {row.label}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Empty state */}
            {visible.length === 0 && (
              <div
                className="flex items-center justify-center text-sm text-muted-foreground"
                style={{ height: 160 }}
              >
                Không có task nào trên timeline
              </div>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
