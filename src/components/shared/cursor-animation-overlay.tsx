import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, CalendarDays, CheckCircle2, Sparkles, Target } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ProjectAssistantActionType, ProjectAssistantPlannedAction, ProjectAssistantExecutionResult } from '@/types/project-assistant'

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface CursorAnimationItem {
  actionType: ProjectAssistantActionType
  title: string
  description?: string
  scheduledStart?: string
  scheduledEnd?: string
}

interface Props {
  items: CursorAnimationItem[]
  onComplete: () => void
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const ACTION_ICONS: Partial<Record<ProjectAssistantActionType, typeof Bot>> = {
  CREATE_TASK: Target,
  CREATE_GOAL: Sparkles,
  CREATE_TASK_SCHEDULE: CalendarDays,
  UPDATE_PROJECT: Bot,
}

const ACTION_LABEL_KEYS: Partial<Record<ProjectAssistantActionType, string>> = {
  CREATE_TASK: 'ai.actionCreateTask',
  CREATE_GOAL: 'ai.actionCreateGoal',
  CREATE_TASK_SCHEDULE: 'ai.animCreateSchedule',
  UPDATE_PROJECT: 'ai.animUpdateProject',
  UPDATE_TASK: 'ai.animUpdateTask',
  MOVE_TASK: 'ai.animMoveTask',
  UPDATE_GOAL: 'ai.animUpdateGoal',
  UPDATE_TASK_COMPLETION: 'ai.animCompleteTask',
  UPDATE_TASK_SCHEDULE: 'ai.animUpdateSchedule',
}

function fmtTime(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/* ─── Cursor SVG ───────────────────────────────────────────────────────────── */

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 1L7.5 21L10.5 13.5L18 10.5L1 1Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Main Component ───────────────────────────────────────────────────────── */

export function CursorAnimationOverlay({ items, onComplete }: Props) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'enter' | 'items' | 'done'>('enter')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [typedText, setTypedText] = useState('')
  const [showCheck, setShowCheck] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = items[currentIdx] as CursorAnimationItem | undefined
  const isSchedule = current?.actionType === 'CREATE_TASK_SCHEDULE'
  const Icon = current ? (ACTION_ICONS[current.actionType] ?? Bot) : Bot
  const label = current ? t(ACTION_LABEL_KEYS[current.actionType] ?? current.actionType) : ''

  /* ── Typing animation ── */
  const startTyping = useCallback((text: string, onDone: () => void) => {
    let i = 0
    setTypedText('')
    const tick = () => {
      if (i < text.length) {
        setTypedText(text.slice(0, i + 1))
        i++
        timerRef.current = setTimeout(tick, 28 + Math.random() * 22)
      } else {
        onDone()
      }
    }
    timerRef.current = setTimeout(tick, 200)
  }, [])

  /* ── Sequence ── */
  useEffect(() => {
    if (phase === 'enter') {
      timerRef.current = setTimeout(() => setPhase('items'), 600)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'items' || !current) return

    setShowCheck(false)
    setTypedText('')

    const textToType = current.title + (current.description ? ' — ' + current.description.slice(0, 60) : '')

    startTyping(textToType, () => {
      setShowCheck(true)
      timerRef.current = setTimeout(() => {
        if (currentIdx < items.length - 1) {
          setCurrentIdx((i) => i + 1)
        } else {
          setPhase('done')
          timerRef.current = setTimeout(onComplete, 800)
        }
      }, 700)
    })

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, currentIdx, current, items.length, startTyping, onComplete])

  return (
    <AnimatePresence>
      {phase !== 'done' ? null : null}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      >
        {/* Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative mx-4 w-full max-w-lg"
        >
          {/* Progress bar */}
          <div className="mb-4 flex items-center justify-center gap-2">
            {items.map((_, i) => (
              <div key={i} className={cn('h-1 rounded-full transition-all duration-300', i < currentIdx ? 'w-8 bg-emerald-400' : i === currentIdx ? 'w-10 bg-sky-400' : 'w-6 bg-white/25')}>
                {i === currentIdx && (
                  <motion.div className="h-full rounded-full bg-sky-400" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 2.5, ease: 'linear' }} />
                )}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0c1829]/95 shadow-2xl shadow-sky-500/20 backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                <Bot className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{t('ai.animExecuting')}</p>
                <p className="text-xs text-slate-400">
                  {t('ai.animProgress', { current: currentIdx + 1, total: items.length })}
                </p>
              </div>
              {phase === 'done' && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
                  <CheckCircle2 className="size-5 text-emerald-400" />
                </motion.div>
              )}
            </div>

            {/* Body */}
            <div className="relative min-h-[10rem] px-5 py-5">
              <AnimatePresence mode="wait">
                {current && (
                  <motion.div
                    key={currentIdx}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {/* Action label */}
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-sky-300">
                        <Icon className="size-4" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">{label}</span>
                    </div>

                    {/* Typing area */}
                    {isSchedule ? (
                      <ScheduleAnimation
                        title={current.title}
                        start={fmtTime(current.scheduledStart)}
                        end={fmtTime(current.scheduledEnd)}
                        typed={typedText}
                      />
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <p className="text-sm text-white">
                          {typedText}
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{ duration: 0.5, repeat: Infinity }}
                            className="ml-0.5 inline-block h-4 w-0.5 bg-sky-400 align-middle"
                          />
                        </p>
                      </div>
                    )}

                    {/* Cursor following text */}
                    <motion.div
                      animate={{ x: [0, 4, 0], y: [0, -2, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute bottom-5 right-5"
                    >
                      <CursorIcon className="size-5 drop-shadow-lg" />
                      {/* Click ripple */}
                      <motion.div
                        animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute -left-1 -top-1 size-3 rounded-full bg-sky-400/40"
                      />
                    </motion.div>

                    {/* Check mark */}
                    {showCheck && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-2 text-emerald-400"
                      >
                        <CheckCircle2 className="size-4" />
                        <span className="text-xs font-medium">{t('ai.animDone')}</span>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Done state */}
              {phase === 'done' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-4 text-center"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20"
                  >
                    <CheckCircle2 className="size-7 text-emerald-400" />
                  </motion.div>
                  <p className="text-sm font-semibold text-white">{t('ai.animApplied')}</p>
                  <p className="text-xs text-slate-400">{t('ai.animUpdating')}</p>
                  {/* Sparkle burst */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
                      animate={{
                        opacity: 0,
                        scale: 1,
                        x: Math.cos((i * Math.PI * 2) / 6) * 60,
                        y: Math.sin((i * Math.PI * 2) / 6) * 60,
                      }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="absolute left-1/2 top-1/2 size-2 rounded-full bg-sky-400"
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

/* ── Calendar schedule animation ── */

function ScheduleAnimation({ title: _title, start, end, typed }: {
  title: string; start: string; end: string; typed: string
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      {/* Mini calendar mockup */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('ai.animSchedule')}</p>
        <div className="relative space-y-1.5">
          {/* Time slots */}
          {[start || '09:00', '', end || '11:00'].map((slot, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-12 text-right text-[11px] text-slate-500">{slot}</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
          ))}
          {/* Drag block */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 48, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            className="absolute left-16 top-1 right-2 overflow-hidden rounded-lg border border-sky-400/30 bg-sky-500/20"
          >
            <div className="px-2.5 py-1.5">
              <p className="truncate text-xs font-medium text-sky-200">{typed}</p>
              <p className="text-[10px] text-sky-300/70">{start} → {end}</p>
            </div>
          </motion.div>
        </div>
      </div>
      {/* Cursor drag indicator */}
      <motion.div
        initial={{ x: -20 }}
        animate={{ x: 80 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
        className="flex items-center gap-1 text-xs text-sky-400"
      >
        <CursorIcon className="size-4" />
        <span className="text-[10px]">{t('ai.animDrag', { start, end })}</span>
      </motion.div>
    </div>
  )
}

/* ─── Build animation items from apply results ─────────────────────────────── */

export function buildAnimationItems(
  results: ProjectAssistantExecutionResult[],
  actions: ProjectAssistantPlannedAction[],
): CursorAnimationItem[] {
  return results
    .map((result) => {
      const action = actions.find((a) => a.actionId === result.actionId)
      return {
        actionType: result.actionType,
        title: result.actionTitle || action?.title || action?.name || result.actionId,
        description: action?.description,
        scheduledStart: action?.scheduledStart,
        scheduledEnd: action?.scheduledEnd,
      }
    })
    .filter((item) =>
      ['CREATE_TASK', 'CREATE_GOAL', 'CREATE_TASK_SCHEDULE', 'UPDATE_PROJECT'].includes(item.actionType),
    )
}
