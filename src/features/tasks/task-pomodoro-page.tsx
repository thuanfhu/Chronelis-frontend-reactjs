import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Coffee,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
  Volume2,
  Zap,
} from 'lucide-react'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { TaskPriorityBadge } from '@/features/tasks/task-priority-badge'
import { taskApi } from '@/lib/api/modules/task-api'
import { queryKeys } from '@/lib/api/query-keys'

type PomodoroMode = 'focus' | 'short-break' | 'long-break'
type PomodoroAlarmId = 'crystal-bell' | 'digital-chime' | 'soft-bloom' | 'deep-gong' | 'wood-block'

interface PomodoroLocationState {
  returnTo?: string
}

interface PomodoroAlarmPreset {
  label: string
  description: string
  masterGain: number
  notes: Array<{
    frequency: number
    duration: number
    delay: number
    type: OscillatorType
    gain: number
  }>
}

const MODE_DURATION_SECONDS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  'short-break': 5 * 60,
  'long-break': 15 * 60,
}

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: 'Focus Session',
  'short-break': 'Short Break',
  'long-break': 'Long Break',
}

const MODE_HINTS: Record<PomodoroMode, string> = {
  focus: 'Tập trung vào task chính và tránh đa nhiệm.',
  'short-break': 'Nghỉ ngắn, đứng dậy và thả lỏng vai cổ.',
  'long-break': 'Nghỉ dài hơn để hồi năng lượng cho chu kỳ mới.',
}

const MODE_THEME: Record<PomodoroMode, { text: string; ring: string; chip: string }> = {
  focus: {
    text: 'text-primary',
    ring: 'stroke-primary',
    chip: 'bg-primary/12 text-primary',
  },
  'short-break': {
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'stroke-emerald-500 dark:stroke-emerald-400',
    chip: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  },
  'long-break': {
    text: 'text-sky-600 dark:text-sky-400',
    ring: 'stroke-sky-500 dark:stroke-sky-400',
    chip: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
  },
}

const POMODORO_ALARM_STORAGE_KEY = 'chronelis.pomodoro.alarm-sound'

const POMODORO_ALARM_PRESETS: Record<PomodoroAlarmId, PomodoroAlarmPreset> = {
  'crystal-bell': {
    label: 'Crystal Bell',
    description: 'Âm ngân sáng, rõ ràng cho chuyển phiên focus/break.',
    masterGain: 0.22,
    notes: [
      { frequency: 783.99, duration: 0.26, delay: 0, type: 'sine', gain: 0.32 },
      { frequency: 987.77, duration: 0.26, delay: 0.08, type: 'sine', gain: 0.28 },
      { frequency: 1318.51, duration: 0.3, delay: 0.16, type: 'triangle', gain: 0.24 },
    ],
  },
  'digital-chime': {
    label: 'Digital Chime',
    description: 'Âm điện tử gọn, nổi bật khi bạn đang đeo tai nghe.',
    masterGain: 0.18,
    notes: [
      { frequency: 1046.5, duration: 0.15, delay: 0, type: 'square', gain: 0.24 },
      { frequency: 1318.51, duration: 0.15, delay: 0.16, type: 'square', gain: 0.22 },
      { frequency: 1567.98, duration: 0.2, delay: 0.32, type: 'square', gain: 0.2 },
    ],
  },
  'soft-bloom': {
    label: 'Soft Bloom',
    description: 'Âm dịu, phù hợp khi muốn ít giật mình hơn.',
    masterGain: 0.2,
    notes: [
      { frequency: 523.25, duration: 0.3, delay: 0, type: 'triangle', gain: 0.24 },
      { frequency: 659.25, duration: 0.32, delay: 0.1, type: 'triangle', gain: 0.22 },
      { frequency: 783.99, duration: 0.36, delay: 0.22, type: 'triangle', gain: 0.2 },
    ],
  },
  'deep-gong': {
    label: 'Deep Gong',
    description: 'Âm trầm và dày, tạo cảm giác chuyển nhịp rõ rệt.',
    masterGain: 0.2,
    notes: [
      { frequency: 196, duration: 0.55, delay: 0, type: 'sine', gain: 0.26 },
      { frequency: 261.63, duration: 0.45, delay: 0.12, type: 'sine', gain: 0.2 },
      { frequency: 329.63, duration: 0.4, delay: 0.24, type: 'sine', gain: 0.16 },
    ],
  },
  'wood-block': {
    label: 'Wood Block',
    description: 'Nhịp gỗ ngắn, gọn, hợp khi cần tín hiệu nhanh.',
    masterGain: 0.18,
    notes: [
      { frequency: 523.25, duration: 0.08, delay: 0, type: 'sawtooth', gain: 0.32 },
      { frequency: 523.25, duration: 0.08, delay: 0.12, type: 'sawtooth', gain: 0.28 },
      { frequency: 659.25, duration: 0.09, delay: 0.24, type: 'sawtooth', gain: 0.24 },
    ],
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function normalizeFocusMinutes(estimatedMinutes: number): number {
  if (!Number.isFinite(estimatedMinutes) || estimatedMinutes <= 0) {
    return 25
  }

  const rounded = Math.round(estimatedMinutes / 5) * 5
  return clamp(rounded, 10, 90)
}

function parseStoredPomodoroAlarm(value: string | null): PomodoroAlarmId {
  if (!value) {
    return 'crystal-bell'
  }

  if (value in POMODORO_ALARM_PRESETS) {
    return value as PomodoroAlarmId
  }

  return 'crystal-bell'
}

function usePomodoroAlarm(soundId: PomodoroAlarmId) {
  return useCallback(() => {
    if (typeof window === 'undefined') return

    const AudioContextCtor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: new () => AudioContext }).webkitAudioContext

    if (!AudioContextCtor) return

    const preset = POMODORO_ALARM_PRESETS[soundId]

    const audioContext = new AudioContextCtor()
    const now = audioContext.currentTime

    const master = audioContext.createGain()
    master.connect(audioContext.destination)
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(preset.masterGain, now + 0.04)

    let endAt = now

    preset.notes.forEach((note) => {
      const startAt = now + note.delay
      endAt = Math.max(endAt, startAt + note.duration)
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.type = note.type
      oscillator.frequency.setValueAtTime(note.frequency, startAt)

      gainNode.gain.setValueAtTime(0.0001, startAt)
      gainNode.gain.exponentialRampToValueAtTime(note.gain, startAt + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + note.duration)

      oscillator.connect(gainNode)
      gainNode.connect(master)
      oscillator.start(startAt)
      oscillator.stop(startAt + note.duration)
    })

    master.gain.exponentialRampToValueAtTime(0.0001, endAt + 0.12)

    window.setTimeout(() => {
      void audioContext.close()
    }, Math.ceil((endAt - now + 0.55) * 1000))
  }, [soundId])
}

export function TaskPomodoroPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const openTaskDrawer = useUiStore((state) => state.openTaskDrawer)

  const workspaceId = Number(params.workspaceId)
  const projectId = Number(params.projectId)
  const taskId = Number(params.taskId)

  const [durations, setDurations] = useState(MODE_DURATION_SECONDS)
  const [mode, setMode] = useState<PomodoroMode>('focus')
  const [secondsLeft, setSecondsLeft] = useState(MODE_DURATION_SECONDS.focus)
  const [isRunning, setIsRunning] = useState(false)
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0)
  const [alarmSoundId, setAlarmSoundId] = useState<PomodoroAlarmId>(() => {
    if (typeof window === 'undefined') {
      return 'crystal-bell'
    }

    return parseStoredPomodoroAlarm(window.localStorage.getItem(POMODORO_ALARM_STORAGE_KEY))
  })

  const durationsRef = useRef(durations)
  const modeRef = useRef(mode)
  const completedRef = useRef(completedFocusSessions)
  const hasSeededFocusRef = useRef(false)

  const playBellTone = usePomodoroAlarm(alarmSoundId)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(POMODORO_ALARM_STORAGE_KEY, alarmSoundId)
  }, [alarmSoundId])

  useEffect(() => {
    durationsRef.current = durations
  }, [durations])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    completedRef.current = completedFocusSessions
  }, [completedFocusSessions])

  const taskQuery = useQuery({
    queryKey: queryKeys.tasks.detail(taskId),
    queryFn: () => taskApi.detail(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
  })

  useEffect(() => {
    if (!taskQuery.data || hasSeededFocusRef.current) {
      return
    }

    const focusMinutes = normalizeFocusMinutes(taskQuery.data.estimatedMinutes)
    const focusSeconds = focusMinutes * 60

    const seedTimeout = window.setTimeout(() => {
      setDurations((prev) => ({
        ...prev,
        focus: focusSeconds,
      }))
      setSecondsLeft(focusSeconds)
    }, 0)

    hasSeededFocusRef.current = true

    return () => {
      window.clearTimeout(seedTimeout)
    }
  }, [taskQuery.data])

  const moveToNextMode = useCallback((countFocusSession: boolean) => {
    const currentMode = modeRef.current

    if (currentMode === 'focus') {
      const nextCompleted = completedRef.current + (countFocusSession ? 1 : 0)
      if (countFocusSession) {
        setCompletedFocusSessions(nextCompleted)
      }

      const useLongBreak = countFocusSession && nextCompleted > 0 && nextCompleted % 4 === 0
      const nextMode: PomodoroMode = useLongBreak ? 'long-break' : 'short-break'

      setMode(nextMode)
      setSecondsLeft(durationsRef.current[nextMode])
      return
    }

    setMode('focus')
    setSecondsLeft(durationsRef.current.focus)
  }, [])

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((currentSeconds) => {
        if (currentSeconds <= 1) {
          window.clearInterval(interval)
          playBellTone()
          moveToNextMode(true)
          return 0
        }
        return currentSeconds - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [isRunning, moveToNextMode, playBellTone])

  const handleBack = () => {
    const state = location.state as PomodoroLocationState | null
    if (state?.returnTo) {
      navigate(state.returnTo)
      return
    }

    if (Number.isFinite(workspaceId) && Number.isFinite(projectId)) {
      navigate(`/workspaces/${workspaceId}/projects/${projectId}?view=todo`)
      return
    }

    navigate('/dashboard')
  }

  const handleOpenTaskDetail = () => {
    if (!Number.isFinite(workspaceId) || !Number.isFinite(projectId) || !Number.isFinite(taskId)) {
      return
    }

    navigate(`/workspaces/${workspaceId}/projects/${projectId}?view=todo`)
    window.setTimeout(() => {
      openTaskDrawer(taskId, 'view')
    }, 0)
  }

  const switchMode = (nextMode: PomodoroMode) => {
    setIsRunning(false)
    setMode(nextMode)
    setSecondsLeft(durationsRef.current[nextMode])
  }

  const resetCurrentMode = () => {
    setIsRunning(false)
    setSecondsLeft(durationsRef.current[modeRef.current])
  }

  const skipCurrentMode = () => {
    setIsRunning(false)
    playBellTone()
    moveToNextMode(false)
  }

  const adjustFocusMinutes = (deltaMinutes: number) => {
    const nextFocusSeconds = clamp(durationsRef.current.focus + (deltaMinutes * 60), 10 * 60, 90 * 60)

    setDurations((prev) => ({
      ...prev,
      focus: nextFocusSeconds,
    }))

    if (modeRef.current === 'focus') {
      setIsRunning(false)
      setSecondsLeft(nextFocusSeconds)
    }
  }

  const totalSeconds = durations[mode]
  const progressRatio = totalSeconds > 0 ? secondsLeft / totalSeconds : 0
  const progress = clamp(progressRatio, 0, 1)

  const radius = 88
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  const focusMinutes = Math.round(durations.focus / 60)
  const selectedAlarmPreset = POMODORO_ALARM_PRESETS[alarmSoundId]

  const modeIcon = useMemo(() => {
    if (mode === 'focus') return <Zap className="size-4" />
    if (mode === 'short-break') return <Coffee className="size-4" />
    return <Timer className="size-4" />
  }, [mode])

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Pomodoro" description="Không tìm thấy task hợp lệ." />
        <Button variant="outline" className="w-fit" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          Quay lại
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pomodoro theo task"
        description="Giữ nhịp tập trung với chu kỳ focus và break theo task hiện tại."
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4" />
              Quay lại
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenTaskDetail}>
              Mở chi tiết task
            </Button>
          </>
        )}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Task hiện tại</CardTitle>
          <CardDescription>Pomodoro đang gắn với task này để bạn tập trung theo đúng ngữ cảnh công việc.</CardDescription>
        </CardHeader>
        <CardContent>
          {taskQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Đang tải task...
            </div>
          ) : taskQuery.data ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">#{taskQuery.data.id}</Badge>
                <Badge variant="secondary">{taskQuery.data.status.name}</Badge>
                <TaskPriorityBadge priority={taskQuery.data.priority} />
                {taskQuery.data.isCompleted && (
                  <Badge className="gap-1" variant="secondary">
                    <CheckCircle2 className="size-3.5" />
                    Completed
                  </Badge>
                )}
              </div>
              <p className="text-base font-semibold">{taskQuery.data.title}</p>
              {taskQuery.data.description && (
                <p className="text-sm text-muted-foreground">{taskQuery.data.description}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Không thể tải thông tin task.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`gap-1 border-0 ${MODE_THEME[mode].chip}`}>
              {modeIcon}
              {MODE_LABELS[mode]}
            </Badge>
            <Badge variant="outline">{completedFocusSessions} phiên focus hoàn thành</Badge>
          </div>
          <CardDescription>{MODE_HINTS[mode]}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Button variant={mode === 'focus' ? 'default' : 'outline'} size="sm" onClick={() => switchMode('focus')}>Focus</Button>
            <Button variant={mode === 'short-break' ? 'default' : 'outline'} size="sm" onClick={() => switchMode('short-break')}>Short break</Button>
            <Button variant={mode === 'long-break' ? 'default' : 'outline'} size="sm" onClick={() => switchMode('long-break')}>Long break</Button>
          </div>

          <div className="flex items-center justify-center">
            <motion.div
              className="relative grid h-64 w-64 place-items-center"
              animate={isRunning ? { scale: [1, 1.02, 1] } : { scale: 1 }}
              transition={{ duration: 2.1, repeat: isRunning ? Infinity : 0, ease: 'easeInOut' }}
            >
              <div className="absolute inset-4 rounded-full bg-primary/10 blur-xl" />
              <svg className="relative h-full w-full -rotate-90" viewBox="0 0 220 220" aria-hidden>
                <circle
                  cx="110"
                  cy="110"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="12"
                  className="fill-none text-border/60"
                />
                <motion.circle
                  cx="110"
                  cy="110"
                  r={radius}
                  strokeWidth="12"
                  strokeLinecap="round"
                  className={`fill-none ${MODE_THEME[mode].ring}`}
                  strokeDasharray={circumference}
                  animate={{ strokeDashoffset: dashOffset }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <span className={`text-sm font-medium ${MODE_THEME[mode].text}`}>{MODE_LABELS[mode]}</span>
                <span className="text-5xl font-bold tracking-tight">{formatClock(secondsLeft)}</span>
              </div>
            </motion.div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => setIsRunning((running) => !running)}>
              {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
              {isRunning ? 'Tạm dừng' : 'Bắt đầu'}
            </Button>
            <Button variant="outline" onClick={resetCurrentMode}>
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Button variant="ghost" onClick={skipCurrentMode}>
              <SkipForward className="size-4" />
              Skip
            </Button>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Âm báo chuyển phiên</p>
                <p className="text-xs text-muted-foreground">{selectedAlarmPreset.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={playBellTone}>
                <Volume2 className="size-4" />
                Nghe thử
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.entries(POMODORO_ALARM_PRESETS) as [PomodoroAlarmId, PomodoroAlarmPreset][]).map(([alarmId, preset]) => (
                <Button
                  key={alarmId}
                  type="button"
                  variant={alarmSoundId === alarmId ? 'default' : 'outline'}
                  size="sm"
                  className="justify-start"
                  onClick={() => setAlarmSoundId(alarmId)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Focus duration cho task này</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => adjustFocusMinutes(-5)}>-5m</Button>
                <span className="min-w-16 text-center text-sm font-semibold">{focusMinutes} phút</span>
                <Button variant="outline" size="sm" onClick={() => adjustFocusMinutes(5)}>+5m</Button>
              </div>
              <p className="text-xs text-muted-foreground">Theo ước tính task: {taskQuery.data?.estimatedMinutes ?? 0} phút</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
