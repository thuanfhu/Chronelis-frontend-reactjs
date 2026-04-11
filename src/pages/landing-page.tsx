import { useRef, type PropsWithChildren } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Command,
  FileText,
  GitBranch,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SectionHeadingProps = {
  eyebrow: string
  title: string
  description: string
  align?: 'left' | 'center'
  invert?: boolean
}

type CapabilityCardProps = {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  highlights: string[]
}

const trustMarks = ['MERIDIAN', 'NORTHSTAR', 'JETLAYER', 'PULSEGRID', 'OSPREY', 'KINETIC']

const capabilityCards: CapabilityCardProps[] = [
  {
    icon: Search,
    eyebrow: 'Signal Intake',
    title: 'Capture the real work before it scatters into chat, docs, and tickets.',
    description: 'Chronelis centralizes requests, blockers, and context so teams can plan with a single source of truth from the first signal.',
    highlights: ['Unified intake', 'Decision snapshots', 'Live prioritization'],
  },
  {
    icon: Workflow,
    eyebrow: 'Execution Flow',
    title: 'Turn one request into an aligned project system without rebuilding context.',
    description: 'Tasks, owners, schedules, docs, and comments stay connected as work moves from planning to delivery.',
    highlights: ['Connected boards', 'Goal-linked work', 'Calendar aware'],
  },
  {
    icon: BrainCircuit,
    eyebrow: 'AI Assistance',
    title: 'Use AI where it accelerates judgment instead of adding noise.',
    description: 'Summaries, risk detection, and action recommendations appear exactly where teams need a faster decision.',
    highlights: ['Action summaries', 'Risk prompts', 'Follow-up drafting'],
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Operational Control',
    title: 'Keep visibility, accountability, and auditability intact as the pace increases.',
    description: 'Executives, managers, and contributors see the same operating picture with the right level of detail for each role.',
    highlights: ['Workspace governance', 'Role clarity', 'Decision trace'],
  },
]

const orchestrationHighlights = [
  {
    icon: MessageSquare,
    title: 'Comments stay attached to the task, not buried in a side channel.',
    body: 'Feedback, approvals, and clarifications remain tied to the exact work item that needs a decision.',
  },
  {
    icon: FileText,
    title: 'Notes, docs, and schedules move as part of the same workflow system.',
    body: 'Chronelis keeps knowledge, timelines, and execution details synchronized without duplicate maintenance.',
  },
  {
    icon: Bot,
    title: 'AI helps compress ambiguity into concrete next actions.',
    body: 'Teams get concise recaps, ownership nudges, and momentum signals without losing editorial control.',
  },
]

const insightStats = [
  { label: 'Execution clarity', value: '87%', note: 'fewer status-check interruptions after rollout' },
  { label: 'Risk surfaced early', value: '2.4x', note: 'faster than fragmented task and chat workflows' },
  { label: 'Weekly planning time', value: '-31%', note: 'less manual stitching across tools and sheets' },
]

const integrations = ['Slack', 'GitHub', 'Google Calendar', 'Notion', 'Linear', 'Jira', 'Figma', 'Drive', 'Teams']

function Reveal({ children, className, delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 28, filter: 'blur(10px)' }}
      whileInView={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.24 }}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function SectionHeading({ eyebrow, title, description, align = 'left', invert = false }: SectionHeadingProps) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      <div className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]',
        invert
          ? 'border-white/15 bg-white/8 text-sky-200'
          : 'border-slate-200 bg-white text-sky-700 shadow-sm',
      )}>
        <Sparkles className="size-3.5" />
        {eyebrow}
      </div>
      <h2 className={cn(
        'mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl',
        invert ? 'text-white' : 'text-slate-950',
      )}>
        {title}
      </h2>
      <p className={cn(
        'mt-4 max-w-2xl text-sm leading-7 sm:text-base',
        align === 'center' && 'mx-auto',
        invert ? 'text-slate-300' : 'text-slate-600',
      )}>
        {description}
      </p>
    </div>
  )
}

function HeroScene() {
  const reducedMotion = useReducedMotion()
  const floatingTransition = reducedMotion
    ? undefined
    : { duration: 7.5, repeat: Infinity, ease: 'easeInOut' as const }

  return (
    <div className="relative mx-auto w-full max-w-[42rem]">
      <div className="absolute -left-16 top-12 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="absolute -right-10 bottom-4 h-48 w-48 rounded-full bg-cyan-300/18 blur-3xl" />

      <motion.div
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 28, scale: 0.97 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
        className="relative aspect-[1.08/1] overflow-hidden rounded-[2rem] border border-white/10 bg-[#07101a] p-4 shadow-[0_42px_120px_-52px_rgba(14,165,233,0.42)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_34%),linear-gradient(180deg,rgba(10,18,32,0.92),rgba(5,10,18,0.98))]" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)', backgroundSize: '4rem 4rem' }} />

        <div className="relative z-10 h-full rounded-[1.6rem] border border-white/8 bg-white/[0.04] p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.05] px-4 py-3 text-sm text-slate-300">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="size-2 rounded-full bg-amber-300" />
                <span className="size-2 rounded-full bg-rose-400" />
              </div>
              <span className="font-medium text-white">Chronelis command surface</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-200">
              <Command className="size-3" />
              Live system
            </div>
          </div>

          <div className="relative mt-4 h-[calc(100%-4.5rem)]">
            <motion.div
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, -7, 0] }}
              transition={floatingTransition}
              className="absolute left-0 top-2 w-[34%] rounded-[1.5rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_24px_50px_-30px_rgba(15,23,42,0.9)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Team Pulse</p>
              <div className="mt-4 space-y-3">
                {[
                  ['Ops handoff', 'Ready for review', 'emerald'],
                  ['Release board', '2 blockers detected', 'amber'],
                  ['Customer rollout', 'Calendar shifted', 'sky'],
                ].map(([label, status, tone]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-[#081420] px-3 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm text-white">
                      <span>{label}</span>
                      <span className={cn('size-2 rounded-full', tone === 'emerald' && 'bg-emerald-400', tone === 'amber' && 'bg-amber-300', tone === 'sky' && 'bg-sky-300')} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{status}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, 8, 0] }}
              transition={reducedMotion ? undefined : { duration: 8.6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
              className="absolute left-[25%] top-10 bottom-[18%] w-[48%] rounded-[1.7rem] border border-white/10 bg-[#091827]/92 p-4 shadow-[0_36px_90px_-42px_rgba(56,189,248,0.55)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Execution Board</p>
                  <p className="mt-1 text-sm font-medium text-white">Goal tracking rollout</p>
                </div>
                <div className="rounded-full border border-sky-300/20 bg-sky-300/10 px-2.5 py-1 text-[11px] text-sky-200">AI synced</div>
              </div>

              <div className="mt-4 grid h-[calc(100%-3.5rem)] grid-cols-3 gap-3">
                {[
                  { column: 'Signal', items: ['Customer request', 'Scope draft'] },
                  { column: 'In Motion', items: ['Owners aligned', 'Calendar blocked'] },
                  { column: 'Ready', items: ['Release note', 'Exec summary'] },
                ].map(({ column, items }, columnIndex) => (
                  <div key={column} className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{column}</p>
                      <span className="text-[11px] text-slate-500">0{columnIndex + 1}</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {items.map((item, itemIndex) => (
                        <motion.div
                          key={item}
                          animate={reducedMotion ? { opacity: 1 } : { y: [0, -4, 0], opacity: [0.92, 1, 0.92] }}
                          transition={reducedMotion ? undefined : { duration: 5.5 + itemIndex, repeat: Infinity, ease: 'easeInOut', delay: columnIndex * 0.5 + itemIndex * 0.2 }}
                          className="rounded-2xl border border-white/8 bg-[#0d2135] px-3 py-2.5"
                        >
                          <p className="text-[12px] font-medium text-white">{item}</p>
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                            <span className="rounded-full bg-white/8 px-2 py-0.5">Task</span>
                            <span className="rounded-full bg-white/8 px-2 py-0.5">Live</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, -9, 0] }}
              transition={reducedMotion ? undefined : { duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 0.45 }}
              className="absolute right-0 top-8 w-[30%] rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4 shadow-[0_24px_60px_-30px_rgba(6,182,212,0.55)]"
            >
              <div className="flex items-center gap-2 text-sky-200">
                <Bot className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">AI Brief</p>
              </div>
              <p className="mt-3 text-sm font-medium text-white">Release risk raised before handoff.</p>
              <p className="mt-2 text-xs leading-6 text-slate-300">
                Chronelis detected overlapping owner changes, a missing release note, and a due date conflict in the current sprint.
              </p>
              <div className="mt-4 space-y-2">
                {['Summarize blockers', 'Draft update', 'Suggest owners'].map((action) => (
                  <div key={action} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#081420] px-3 py-2 text-xs text-slate-300">
                    <span>{action}</span>
                    <ChevronRight className="size-3.5 text-slate-500" />
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: [0, 6, 0] }}
              transition={reducedMotion ? undefined : { duration: 8.4, repeat: Infinity, ease: 'easeInOut', delay: 0.95 }}
              className="absolute bottom-0 left-[12%] right-[8%] rounded-[1.5rem] border border-white/10 bg-[#0b1726]/95 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Timeline Sync</p>
                  <p className="mt-1 text-sm font-medium text-white">Schedules, docs, and ownership stay aligned.</p>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-200">99.98% sync health</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5 text-xs text-slate-300">
                {[
                  ['Goal', 'Release quality'],
                  ['Due window', '24 Apr - 30 Apr'],
                  ['Review', 'Owner handoff confirmed'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                    <p className="mt-1 text-slate-100">{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {!reducedMotion ? (
              <motion.div
                className="pointer-events-none absolute left-[58%] top-[18%] z-30"
                animate={{ x: [0, 120, 165, -10, 0], y: [0, 26, 168, 222, 0] }}
                transition={{ duration: 8.8, repeat: Infinity, ease: 'easeInOut', times: [0, 0.24, 0.48, 0.76, 1] }}
              >
                <motion.div
                  animate={{ scale: [1, 1.45, 1], opacity: [0.18, 0.32, 0.18] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full bg-sky-300 blur-md"
                />
                <div className="relative size-4 rounded-full border border-white/70 bg-white shadow-[0_0_0_6px_rgba(14,165,233,0.16),0_12px_24px_rgba(15,23,42,0.45)]" />
              </motion.div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function CapabilityCard({ icon: Icon, eyebrow, title, description, highlights }: CapabilityCardProps) {
  return (
    <motion.article
      whileHover={{ y: -6, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
      className="group rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.28)]"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 shadow-inner shadow-sky-200/70">
        <Icon className="size-5" />
      </div>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {highlights.map((item) => (
          <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 transition-colors group-hover:border-sky-200 group-hover:text-sky-700">
            {item}
          </span>
        ))}
      </div>
    </motion.article>
  )
}

function StorySection() {
  const storyRef = useRef<HTMLElement | null>(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: storyRef, offset: ['start start', 'end end'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.28 })

  const requestX = useTransform(progress, [0, 0.35, 0.7, 1], [0, 116, 170, 196])
  const requestY = useTransform(progress, [0, 0.35, 0.7, 1], [0, 34, 146, 164])
  const requestRotate = useTransform(progress, [0, 1], [-8, 10])
  const boardScale = useTransform(progress, [0, 0.28, 0.62, 1], [0.92, 1, 1.05, 1.02])
  const boardY = useTransform(progress, [0, 1], [16, -12])
  const assistantOpacity = useTransform(progress, [0.25, 0.52, 1], [0.25, 0.92, 1])
  const assistantY = useTransform(progress, [0.25, 1], [48, 0])
  const insightOpacity = useTransform(progress, [0.58, 0.8, 1], [0.15, 0.9, 1])
  const insightY = useTransform(progress, [0.58, 1], [52, 0])
  const railScale = useTransform(progress, [0, 1], [0, 1])

  const stepOneOpacity = useTransform(progress, [0, 0.26, 0.5], [1, 1, 0.45])
  const stepTwoOpacity = useTransform(progress, [0.2, 0.5, 0.8], [0.4, 1, 0.5])
  const stepThreeOpacity = useTransform(progress, [0.55, 0.82, 1], [0.35, 1, 1])

  return (
    <section ref={storyRef} id="story" className="relative h-[220vh] bg-[#f3f6fb] px-4 py-20 text-slate-950 sm:px-6 lg:px-8">
      <div className="sticky top-0 flex h-screen items-center py-14">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)] lg:items-center">
          <div>
            <Reveal>
              <SectionHeading
                eyebrow="Interactive Product Story"
                title="Show the product by letting work transform in front of the user."
                description="Chronelis demonstrates how one vague request becomes a coordinated execution system with owners, schedules, notes, AI context, and visibility built in."
              />
            </Reveal>

            <div className="mt-10 grid gap-4">
              {[
                ['Capture the signal', 'Requests arrive with context, constraints, and expected outcomes before planning begins.'],
                ['Organize the flow', 'The system turns scattered updates into a shared operational structure with clear ownership.'],
                ['Surface the risk', 'Leadership sees momentum, blockers, and timing drift early enough to intervene with precision.'],
              ].map(([title, body], index) => {
                const style = index === 0 ? { opacity: stepOneOpacity } : index === 1 ? { opacity: stepTwoOpacity } : { opacity: stepThreeOpacity }

                return (
                  <motion.div key={title} style={reducedMotion ? undefined : style} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.2)]">
                    <div className="flex items-start gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">0{index + 1}</div>
                      <div>
                        <p className="text-base font-semibold text-slate-950">{title}</p>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[#08111c] p-6 text-white shadow-[0_40px_100px_-44px_rgba(15,23,42,0.48)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_34%),linear-gradient(180deg,rgba(8,17,28,1),rgba(5,12,21,0.98))]" />
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.14) 1px, transparent 1px)', backgroundSize: '3.75rem 3.75rem' }} />

              <div className="relative z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-200">Sticky story</div>
                <div className="h-px flex-1 bg-white/10" />
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Scroll to advance</div>
              </div>

              <div className="relative mt-5 h-[31rem] overflow-hidden rounded-[1.6rem] border border-white/8 bg-white/[0.04] p-5">
                <div className="absolute left-6 top-6 bottom-6 w-px origin-top rounded-full bg-white/8">
                  <motion.span style={reducedMotion ? undefined : { scaleY: railScale }} className="block h-full origin-top rounded-full bg-[linear-gradient(180deg,#38bdf8,#22d3ee)]" />
                </div>

                <motion.div
                  style={reducedMotion ? undefined : { x: requestX, y: requestY, rotate: requestRotate }}
                  className="absolute left-12 top-8 w-[17rem] rounded-[1.45rem] border border-white/10 bg-[#112033] p-4 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.7)]"
                >
                  <div className="flex items-center gap-2 text-sky-200">
                    <Target className="size-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Incoming request</p>
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">Launch release quality initiative across three teams.</p>
                  <p className="mt-2 text-xs leading-6 text-slate-300">Need owner mapping, deadline alignment, onboarding docs, and visible milestone tracking.</p>
                </motion.div>

                <motion.div
                  style={reducedMotion ? undefined : { scale: boardScale, y: boardY }}
                  className="absolute inset-x-16 top-28 rounded-[1.7rem] border border-white/10 bg-[#081a2a]/92 p-4 shadow-[0_26px_70px_-38px_rgba(14,165,233,0.42)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Flow assembled</p>
                      <p className="mt-1 text-sm font-medium text-white">Execution system generated from a single request.</p>
                    </div>
                    <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] text-emerald-200">Owners confirmed</div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      { column: 'Goals', items: ['Onboarding doc', 'Role mapping'] },
                      { column: 'Tasks', items: ['Deadline sync', 'Progress review'] },
                      { column: 'Calendar', items: ['Release checkpoint', 'Stakeholder review'] },
                    ].map(({ column, items }) => (
                      <div key={column} className="rounded-[1.35rem] border border-white/8 bg-white/[0.04] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{column}</p>
                        <div className="mt-3 space-y-2">
                          {items.map((item) => (
                            <div key={item} className="rounded-2xl border border-white/8 bg-[#0d2134] px-3 py-2 text-xs text-slate-200">
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  style={reducedMotion ? undefined : { opacity: assistantOpacity, y: assistantY }}
                  className="absolute right-5 top-10 w-[14rem] rounded-[1.45rem] border border-white/10 bg-white/[0.08] p-4 shadow-[0_24px_56px_-34px_rgba(6,182,212,0.46)]"
                >
                  <div className="flex items-center gap-2 text-cyan-200">
                    <Bot className="size-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Assistive layer</p>
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs text-slate-300">
                    <div className="rounded-2xl border border-white/8 bg-[#0c1a2b] px-3 py-2.5">Summarize scope change</div>
                    <div className="rounded-2xl border border-white/8 bg-[#0c1a2b] px-3 py-2.5">Draft review checklist</div>
                    <div className="rounded-2xl border border-white/8 bg-[#0c1a2b] px-3 py-2.5">Highlight scheduling conflicts</div>
                  </div>
                </motion.div>

                <motion.div
                  style={reducedMotion ? undefined : { opacity: insightOpacity, y: insightY }}
                  className="absolute bottom-6 right-6 w-[15rem] rounded-[1.45rem] border border-white/10 bg-[#0d1726]/96 p-4"
                >
                  <div className="flex items-center gap-2 text-emerald-200">
                    <BarChart3 className="size-4" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Leadership view</p>
                  </div>
                  <p className="mt-3 text-sm font-medium text-white">Risk surfaced before delivery slipped.</p>
                  <p className="mt-2 text-xs leading-6 text-slate-300">One workstream drifted, one review was missing, and the owner handoff needed intervention.</p>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CollaborationCanvas() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#08111c] p-5 shadow-[0_34px_90px_-44px_rgba(15,23,42,0.58)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_30%),linear-gradient(180deg,rgba(8,17,28,1),rgba(7,15,27,0.98))]" />
      <div className="relative z-10 grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <motion.div
          animate={reducedMotion ? { opacity: 1 } : { y: [0, -5, 0] }}
          transition={reducedMotion ? undefined : { duration: 8.4, repeat: Infinity, ease: 'easeInOut' }}
          className="rounded-[1.6rem] border border-white/10 bg-white/[0.05] p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Collaboration feed</p>
              <p className="mt-1 text-sm font-medium text-white">Context lives beside execution.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] text-sky-200">Realtime</div>
          </div>

          <div className="mt-4 space-y-3">
            {[
              ['Mia Davis', 'Please review the migration note before we enable this in production.'],
              ['Lumen AI', 'Suggested owner update: assign rollout validation to Gabriel Vo.'],
              ['Ngoc Miller', 'Calendar checkpoint moved by 24 hours to absorb QA feedback.'],
            ].map(([name, message], index) => (
              <motion.div
                key={name}
                animate={reducedMotion ? { opacity: 1 } : { x: [0, index === 1 ? 4 : -4, 0] }}
                transition={reducedMotion ? undefined : { duration: 6.8 + index, repeat: Infinity, ease: 'easeInOut', delay: index * 0.35 }}
                className="rounded-[1.4rem] border border-white/8 bg-[#0d1a2b] p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-sky-400/10 text-[11px] font-semibold text-sky-200">{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
                  <p className="text-sm font-medium text-white">{name}</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-300">{message}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            animate={reducedMotion ? { opacity: 1 } : { y: [0, 6, 0] }}
            transition={reducedMotion ? undefined : { duration: 7.8, repeat: Infinity, ease: 'easeInOut', delay: 0.45 }}
            className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4"
          >
            <div className="flex items-center gap-2 text-cyan-200">
              <Bot className="size-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">AI coordination</p>
            </div>
            <p className="mt-3 text-sm font-medium text-white">The system drafts the next best move, not just a summary.</p>
            <div className="mt-4 space-y-2.5 text-xs text-slate-300">
              {['Draft stakeholder update', 'Summarize blockers for PM', 'Recommend next review window'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/8 bg-[#0c1a2b] px-3 py-2.5">{item}</div>
              ))}
            </div>
          </motion.div>

          <motion.div
            animate={reducedMotion ? { opacity: 1 } : { y: [0, -4, 0] }}
            transition={reducedMotion ? undefined : { duration: 7.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4"
          >
            <div className="flex items-center gap-2 text-emerald-200">
              <CalendarDays className="size-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Linked scheduling</p>
            </div>
            <div className="mt-4 grid gap-2">
              {['Mon 09:00 - kickoff sync', 'Tue 14:00 - design review', 'Thu 10:30 - release checkpoint'].map((slot) => (
                <div key={slot} className="rounded-2xl border border-white/8 bg-[#0c1a2b] px-3 py-2.5 text-xs text-slate-300">{slot}</div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function AnalyticsCanvas() {
  const reducedMotion = useReducedMotion()
  const barHeights = ['h-12', 'h-20', 'h-28', 'h-16', 'h-34', 'h-24', 'h-30']

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_34px_90px_-50px_rgba(6,182,212,0.36)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Visibility layer</p>
          <p className="mt-1 text-sm font-medium text-white">Executives see control, managers see pressure, contributors see the next move.</p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-cyan-200">Live risk scoring</div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.74fr)_minmax(0,0.26fr)]">
        <div className="rounded-[1.6rem] border border-white/10 bg-[#0b1727] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Weekly delivery confidence</span>
            <span>84 / 100</span>
          </div>
          <div className="mt-5 flex h-44 items-end gap-2 rounded-[1.35rem] border border-white/8 bg-[#08111d] px-3 pb-4 pt-6">
            {barHeights.map((height, index) => (
              <motion.div
                key={height}
                animate={reducedMotion ? { opacity: 1 } : { opacity: [0.72, 1, 0.8], y: [0, -4, 0] }}
                transition={reducedMotion ? undefined : { duration: 4.8 + index * 0.25, repeat: Infinity, ease: 'easeInOut', delay: index * 0.1 }}
                className={cn('flex-1 rounded-t-2xl bg-[linear-gradient(180deg,#38bdf8,#0f172a)]', height)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {[
            ['Critical path', '2 items require owner intervention'],
            ['Schedule drift', '1 review window moved outside target'],
            ['Team load', 'Platform squad at 82% allocation'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[1.45rem] border border-white/10 bg-[#0b1727] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
              <p className="mt-2 text-sm leading-7 text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function IntegrationPill({ label }: { label: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
    >
      <span className="size-2 rounded-full bg-sky-500" />
      {label}
    </motion.div>
  )
}

export function LandingPage() {
  const token = useAuthStore((state) => state.accessToken)

  return (
    <main className="bg-[#06101b] text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#06101b]/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#38bdf8,#0f172a)] text-sm font-semibold shadow-[0_18px_45px_-22px_rgba(56,189,248,0.55)]">C</span>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em] text-white">Chronelis</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Operating system for delivery</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            <a href="#product" className="transition-colors hover:text-white">Product</a>
            <a href="#story" className="transition-colors hover:text-white">Story</a>
            <a href="#workflow" className="transition-colors hover:text-white">Workflow</a>
            <a href="#integrations" className="transition-colors hover:text-white">Integrations</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full px-4 text-slate-200 hover:bg-white/8 hover:text-white">
              <Link to={token ? '/dashboard' : '/login'}>{token ? 'Open app' : 'Sign in'}</Link>
            </Button>
            <Button asChild className="rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100">
              <Link to={token ? '/dashboard' : '/register'}>
                {token ? 'Go to workspace' : 'Start for free'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-4 pb-18 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-14">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-sky-400/14 blur-3xl" />
          <div className="absolute left-[8%] top-36 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="absolute right-[8%] top-24 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
            <div>
              <Reveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/15 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-200">
                  <Zap className="size-3.5" />
                  Premium workspace orchestration
                </div>
                <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-[-0.07em] text-white sm:text-6xl lg:text-7xl">
                  The command center for teams that need clarity before speed.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  Chronelis brings goals, tasks, comments, schedules, docs, and AI-assisted coordination into one focused system so modern teams can move quickly without losing control.
                </p>
              </Reveal>

              <Reveal delay={0.08} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                  <Link to={token ? '/dashboard' : '/register'}>
                    {token ? 'Enter Chronelis' : 'Start free workspace'}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="h-12 rounded-full border-white/12 bg-white/6 px-6 text-sm text-white hover:bg-white/10 hover:text-white">
                  <a href="#story">
                    Watch the workflow unfold
                    <ChevronRight className="size-4" />
                  </a>
                </Button>
              </Reveal>

              <Reveal delay={0.12} className="mt-8 grid gap-4 sm:grid-cols-3">
                {[
                  ['Strategy to execution', 'Goals, tasks, docs, and owners stay linked.'],
                  ['AI that respects context', 'Signals appear inside the workflow instead of replacing it.'],
                  ['Operational confidence', 'Every handoff keeps clarity, traceability, and pace.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm">
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{body}</p>
                  </div>
                ))}
              </Reveal>
            </div>

            <Reveal delay={0.08} className="lg:pl-4">
              <HeroScene />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-y border-white/8 bg-white/[0.04] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <span className="rounded-full border border-white/8 bg-white/[0.05] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-sky-200">Trusted by modern delivery teams</span>
            <span>Product, operations, client delivery, and cross-functional leadership teams use Chronelis to stay aligned.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            {trustMarks.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="product" className="bg-[#f3f6fb] px-4 py-20 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Core Product Capabilities"
              title="A premium execution layer designed to feel fast, credible, and decisively organized."
              description="Chronelis is not another generic project dashboard. It is a productized operating model that turns scattered work into a coherent system teams can trust at every level."
              align="center"
            />
          </Reveal>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {capabilityCards.map((card, index) => (
              <Reveal key={card.title} delay={0.05 * index}>
                <CapabilityCard {...card} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <StorySection />

      <section id="workflow" className="relative overflow-hidden bg-[#07111d] px-4 py-20 text-white sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.12),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl space-y-12">
          <Reveal>
            <SectionHeading
              eyebrow="Collaboration, Workflow, AI"
              title="Context-rich teamwork without the fragmented toolchain experience."
              description="Chronelis keeps conversation, documentation, calendar coordination, and AI assistance in the same operating layer so teams spend less time reconstructing intent."
              invert
            />
          </Reveal>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <Reveal delay={0.04}>
              <CollaborationCanvas />
            </Reveal>

            <div className="grid gap-4">
              {orchestrationHighlights.map(({ icon: Icon, title, body }, index) => (
                <Reveal key={title} delay={0.08 + index * 0.04}>
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_26px_70px_-42px_rgba(15,23,42,0.55)]">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-white/8 text-sky-200">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-white">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#07111d] px-4 pb-22 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <Reveal>
            <SectionHeading
              eyebrow="Analytics, Visibility, Control"
              title="See pressure, pace, and risk early enough to do something useful about it."
              description="Chronelis translates workflow activity into managerial insight without breaking the product into a separate analytics afterthought."
              invert
            />
          </Reveal>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <Reveal delay={0.04}>
              <AnalyticsCanvas />
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {insightStats.map((item, index) => (
                <Reveal key={item.label} delay={0.08 + index * 0.04}>
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                    <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">{item.value}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{item.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="integrations" className="bg-[#f3f6fb] px-4 py-20 text-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <SectionHeading
              eyebrow="Integrations and Ecosystem"
              title="Connected to the tools teams already rely on, without becoming dependent on duct tape."
              description="Chronelis syncs the right signals from your ecosystem while keeping the operational center of gravity inside one coherent product."
              align="center"
            />
          </Reveal>

          <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
            <Reveal delay={0.04}>
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_28px_75px_-42px_rgba(15,23,42,0.24)]">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <Network className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Chronelis integration hub</p>
                    <p className="mt-1 text-sm text-slate-600">Sync activity, timing, and source context from the rest of your stack.</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {[
                    { icon: Link2, label: 'Connected signals', value: '18 active streams' },
                    { icon: CalendarDays, label: 'Calendar accuracy', value: 'Live deadline sync' },
                    { icon: GitBranch, label: 'Delivery correlation', value: 'Task to release trace' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                        <Icon className="size-4" />
                      </div>
                      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
                      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(145deg,rgba(255,255,255,0.94),rgba(241,245,249,0.92))] p-6 shadow-[0_28px_75px_-42px_rgba(15,23,42,0.24)]">
                <div className="flex flex-wrap gap-3">
                  {integrations.map((item) => (
                    <IntegrationPill key={item} label={item} />
                  ))}
                </div>
                <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.58)]">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-sky-200">
                      <LayoutDashboard className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">One operational layer above the stack</p>
                      <p className="mt-1 text-sm text-slate-300">Chronelis organizes the signals so teams can act on them, not hunt for them.</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {['Slack threads become task context', 'Calendar changes update delivery confidence', 'Release artifacts stay linked to owners', 'AI uses the same live project context'].map((bullet) => (
                      <div key={bullet} className="flex items-start gap-2 rounded-[1.25rem] border border-white/8 bg-white/[0.05] px-3 py-3 text-sm text-slate-200">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="start" className="relative overflow-hidden bg-[#07111d] px-4 py-22 text-white sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_26%)]" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <div className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-8 shadow-[0_42px_110px_-54px_rgba(56,189,248,0.48)] backdrop-blur-sm sm:p-10 lg:p-14">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,0.3fr)] lg:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200">
                    <TimerReset className="size-3.5" />
                    Start your command layer
                  </div>
                  <h2 className="mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                    Build a workspace that feels as sharp as your team actually operates.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                    Chronelis gives ambitious teams a cleaner system for prioritization, coordination, visibility, and AI-assisted execution without the messy tradeoff between speed and control.
                  </p>
                </div>

                <div className="grid gap-3">
                  <Button asChild className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                    <Link to={token ? '/dashboard' : '/register'}>
                      {token ? 'Open my workspace' : 'Create a Chronelis workspace'}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12 rounded-full border-white/12 bg-white/6 px-6 text-sm text-white hover:bg-white/10 hover:text-white">
                    <Link to={token ? '/dashboard' : '/login'}>
                      {token ? 'Go to dashboard' : 'Sign in'}
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-10 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
                {[
                  { icon: Users, label: 'Built for cross-functional teams' },
                  { icon: Bot, label: 'AI assistance inside the workflow' },
                  { icon: BarChart3, label: 'Control without manual reporting drag' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 rounded-[1.35rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-white/8 text-sky-200">
                      <Icon className="size-4" />
                    </div>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}