import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
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
  translationKey: string
  source: string
}

const MODE_DURATION_SECONDS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  'short-break': 5 * 60,
  'long-break': 15 * 60,
}

const MODE_TRANSLATION_KEYS: Record<PomodoroMode, 'focus' | 'shortBreak' | 'longBreak'> = {
  focus: 'focus',
  'short-break': 'shortBreak',
  'long-break': 'longBreak',
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
    translationKey: 'crystalBell',
    source: '/audio/pomodoro/crystal-bell.wav',
  },
  'digital-chime': {
    translationKey: 'digitalChime',
    source: '/audio/pomodoro/digital-chime.wav',
  },
  'soft-bloom': {
    translationKey: 'softBloom',
    source: '/audio/pomodoro/soft-bloom.wav',
  },
  'deep-gong': {
    translationKey: 'deepGong',
    source: '/audio/pomodoro/deep-gong.wav',
  },
  'wood-block': {
    translationKey: 'woodBlock',
    source: '/audio/pomodoro/wood-block.wav',
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
  const audioMapRef = useRef<Partial<Record<PomodoroAlarmId, HTMLAudioElement>>>({})

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const alarmEntries = Object.entries(POMODORO_ALARM_PRESETS) as [PomodoroAlarmId, PomodoroAlarmPreset][]

    alarmEntries.forEach(([alarmId, preset]) => {
      const audio = new Audio(preset.source)
      audio.preload = 'auto'
      audio.volume = 0.9
      audioMapRef.current[alarmId] = audio
    })

    return () => {
      Object.values(audioMapRef.current).forEach((audio) => {
        if (!audio) {
          return
        }

        audio.pause()
        audio.src = ''
      })

      audioMapRef.current = {}
    }
  }, [])

  return useCallback(() => {
    if (typeof window === 'undefined') return

    const preset = POMODORO_ALARM_PRESETS[soundId]
    const cachedAudio = audioMapRef.current[soundId]

    if (!cachedAudio) {
      const fallbackAudio = new Audio(preset.source)
      fallbackAudio.volume = 0.9
      void fallbackAudio.play().catch(() => undefined)
      return
    }

    cachedAudio.pause()
    cachedAudio.currentTime = 0

    void cachedAudio.play().catch(() => {
      const retryAudio = new Audio(preset.source)
      retryAudio.volume = 0.9
      void retryAudio.play().catch(() => undefined)
    })
  }, [soundId])
}

export function TaskPomodoroPage() {
  const { t } = useTranslation()
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
  const modeTranslationKey = MODE_TRANSLATION_KEYS[mode]
  const modeLabel = t(`pomodoro.modes.${modeTranslationKey}.label`)
  const modeHint = t(`pomodoro.modes.${modeTranslationKey}.hint`)
  const selectedAlarmDescription = t(`pomodoro.alarms.${selectedAlarmPreset.translationKey}.description`)

  const modeIcon = useMemo(() => {
    if (mode === 'focus') return <Zap className="size-4" />
    if (mode === 'short-break') return <Coffee className="size-4" />
    return <Timer className="size-4" />
  }, [mode])

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pomodoro.pageTitle')} description={t('pomodoro.invalidTaskDescription')} />
        <Button variant="outline" className="w-fit" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          {t('common.back')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('pomodoro.pageTitle')}
        description={t('pomodoro.pageDescription')}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="size-4" />
              {t('common.back')}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleOpenTaskDetail}>
              {t('pomodoro.openTaskDetail')}
            </Button>
          </>
        )}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('pomodoro.currentTaskTitle')}</CardTitle>
          <CardDescription>{t('pomodoro.currentTaskDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {taskQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('pomodoro.loadingTask')}
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
                    {t('pomodoro.completedBadge')}
                  </Badge>
                )}
              </div>
              <p className="text-base font-semibold">{taskQuery.data.title}</p>
              {taskQuery.data.description && (
                <p className="text-sm text-muted-foreground">{taskQuery.data.description}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('pomodoro.loadTaskFailed')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={`gap-1 border-0 ${MODE_THEME[mode].chip}`}>
              {modeIcon}
              {modeLabel}
            </Badge>
            <Badge variant="outline">{t('pomodoro.focusSessionsCompleted', { count: completedFocusSessions })}</Badge>
          </div>
          <CardDescription>{modeHint}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Button variant={mode === 'focus' ? 'default' : 'outline'} size="sm" onClick={() => switchMode('focus')}>{t('pomodoro.actions.focus')}</Button>
            <Button variant={mode === 'short-break' ? 'default' : 'outline'} size="sm" onClick={() => switchMode('short-break')}>{t('pomodoro.actions.shortBreak')}</Button>
            <Button variant={mode === 'long-break' ? 'default' : 'outline'} size="sm" onClick={() => switchMode('long-break')}>{t('pomodoro.actions.longBreak')}</Button>
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
                <span className={`text-sm font-medium ${MODE_THEME[mode].text}`}>{modeLabel}</span>
                <span className="text-5xl font-bold tracking-tight">{formatClock(secondsLeft)}</span>
              </div>
            </motion.div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => setIsRunning((running) => !running)}>
              {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
              {isRunning ? t('pomodoro.actions.pause') : t('pomodoro.actions.start')}
            </Button>
            <Button variant="outline" onClick={resetCurrentMode}>
              <RotateCcw className="size-4" />
              {t('pomodoro.actions.reset')}
            </Button>
            <Button variant="ghost" onClick={skipCurrentMode}>
              <SkipForward className="size-4" />
              {t('pomodoro.actions.skip')}
            </Button>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t('pomodoro.alarmTitle')}</p>
                <p className="text-xs text-muted-foreground">{selectedAlarmDescription}</p>
                <p className="text-[11px] text-muted-foreground/85">{t('pomodoro.internalSoundsNote')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={playBellTone}>
                <Volume2 className="size-4" />
                {t('pomodoro.actions.previewSound')}
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
                  {t(`pomodoro.alarms.${preset.translationKey}.label`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t('pomodoro.focusDurationTitle')}</p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => adjustFocusMinutes(-5)}>-5m</Button>
                <span className="min-w-16 text-center text-sm font-semibold">{focusMinutes} phút</span>
                <Button variant="outline" size="sm" onClick={() => adjustFocusMinutes(5)}>+5m</Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('pomodoro.estimatedDuration', { minutes: taskQuery.data?.estimatedMinutes ?? 0 })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
