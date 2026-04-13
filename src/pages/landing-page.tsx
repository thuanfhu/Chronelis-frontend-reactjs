import { useLayoutEffect, useRef, type ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  FolderKanban,
  ListTodo,
  MessageSquare,
  PanelsTopLeft,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/app/store/auth-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger)

type Tone = 'sky' | 'emerald' | 'amber' | 'rose'

type HeroSignal = {
  label: string
  value: string
}

type WorkflowStep = {
  key: string
  icon: LucideIcon
  label: string
  title: string
  meta: string[]
}

type ViewPanel = {
  key: string
  icon: LucideIcon
  label: string
  tone: Tone
  title: string
  bullets: string[]
}

type FocusModule = {
  icon: LucideIcon
  title: string
  body: string
  bullets: string[]
}

const heroSignals: HeroSignal[] = [
  { label: 'Cấu trúc', value: 'Workspace, project, goal, task' },
  { label: 'Views', value: 'Calendar, Kanban, To Do' },
  { label: 'Ngữ cảnh task', value: 'Comment, notes, pomodoro' },
  { label: 'Theo dõi', value: 'Notifications và activity log' },
]

const workflowSteps: WorkflowStep[] = [
  {
    key: 'workspace',
    icon: PanelsTopLeft,
    label: 'Workspace',
    title: 'Tạo workspace, phân role, mời thành viên và gom team.',
    meta: ['Owner / Admin / Member', 'Invite code', 'Team members'],
  },
  {
    key: 'project',
    icon: FolderKanban,
    label: 'Project',
    title: 'Chia việc theo project và goal để nhìn đúng luồng thực thi.',
    meta: ['Project description', 'Goal progress', 'Manager assignment'],
  },
  {
    key: 'task',
    icon: ListTodo,
    label: 'Task',
    title: 'Mỗi task giữ đủ lịch, priority, comment, notes và trạng thái xử lý.',
    meta: ['Task drawer', 'Schedule sync', 'Comment thread'],
  },
  {
    key: 'pulse',
    icon: Activity,
    label: 'Pulse',
    title: 'Theo dõi nhịp làm việc bằng notifications và activity log realtime.',
    meta: ['Realtime updates', 'Unread count', 'Project timeline'],
  },
]

const viewPanels: ViewPanel[] = [
  {
    key: 'calendar',
    icon: CalendarDays,
    label: 'Calendar',
    tone: 'sky',
    title: 'Kéo lịch trực tiếp trên project timeline.',
    bullets: ['Quarter-hour grid', 'Task schedule sync', 'Right-click action'],
  },
  {
    key: 'kanban',
    icon: FolderKanban,
    label: 'Kanban',
    tone: 'amber',
    title: 'Nhìn trạng thái công việc theo cột và di chuyển nhanh.',
    bullets: ['Column workflow', 'Assignee + priority', 'Goal-linked card'],
  },
  {
    key: 'todo',
    icon: ListTodo,
    label: 'To Do',
    tone: 'emerald',
    title: 'Danh sách gọn để xử lý nhanh từng task trong ngày.',
    bullets: ['Quick create', 'Completion sound', 'Pomodoro entry'],
  },
  {
    key: 'goals',
    icon: Target,
    label: 'Goals',
    tone: 'rose',
    title: 'Gom task theo mục tiêu để xem tiến độ rõ hơn.',
    bullets: ['Filter toolbar', 'Status & type', 'Progress overview'],
  },
]

const focusModules: FocusModule[] = [
  {
    icon: MessageSquare,
    title: 'Comment nằm ngay trong task',
    body: 'Trao đổi, trả lời, chỉnh sửa comment trực tiếp trong task drawer thay vì tách sang dialog khác.',
    bullets: ['Inline comment feed', 'Reply / edit / delete', 'Giữ quyết định cạnh task'],
  },
  {
    icon: FileText,
    title: 'Notes riêng cho từng task',
    body: 'Task notes dùng editor giàu định dạng và cho upload ảnh khi cần mô tả sâu hơn.',
    bullets: ['Rich text editor', 'Upload image', 'Save back to task'],
  },
  {
    icon: TimerReset,
    title: 'Pomodoro bám theo task',
    body: 'Bật phiên tập trung, chọn âm báo và quay lại task flow mà không mất ngữ cảnh.',
    bullets: ['Focus / break cycle', 'Alarm presets', 'Open from task'],
  },
  {
    icon: Bell,
    title: 'Thông báo và activity log',
    body: 'Người dùng nhìn thấy thay đổi mới và lịch sử thao tác ngay trong app.',
    bullets: ['Unread counter', 'Mark all read', 'Realtime timeline'],
  },
  {
    icon: Users,
    title: 'Members, teams và invite',
    body: 'Workspace quản lý thành viên, team và lời mời để team vào đúng chỗ làm việc.',
    bullets: ['Join by invite', 'Member roles', 'Team membership'],
  },
  {
    icon: ShieldCheck,
    title: 'Quyền hạn rõ ràng',
    body: 'Các thao tác tạo, sửa, xóa bám theo quyền workspace và quyền quản lý project.',
    bullets: ['Role-based actions', 'Safer delete flow', 'Permission-aware UI'],
  },
]

const toneClassMap: Record<Tone, { chip: string; soft: string; line: string }> = {
  sky: {
    chip: 'border-sky-300/25 bg-sky-400/12 text-sky-100',
    soft: 'bg-sky-400/12 text-sky-200',
    line: 'from-sky-300/50 via-sky-400/15 to-transparent',
  },
  emerald: {
    chip: 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100',
    soft: 'bg-emerald-400/12 text-emerald-200',
    line: 'from-emerald-300/50 via-emerald-400/15 to-transparent',
  },
  amber: {
    chip: 'border-amber-300/25 bg-amber-400/12 text-amber-100',
    soft: 'bg-amber-400/12 text-amber-200',
    line: 'from-amber-300/50 via-amber-400/15 to-transparent',
  },
  rose: {
    chip: 'border-rose-300/25 bg-rose-400/12 text-rose-100',
    soft: 'bg-rose-400/12 text-rose-200',
    line: 'from-rose-300/50 via-rose-400/15 to-transparent',
  },
}

function SectionPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200',
      className,
    )}>
      <Sparkles className="size-3.5" />
      {children}
    </div>
  )
}

function SurfaceCard({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'rounded-[1.75rem] border border-white/10 bg-white/[0.06] shadow-[0_32px_90px_-48px_rgba(8,47,73,0.9)] backdrop-blur-xl',
      className,
    )}>
      {children}
    </div>
  )
}

function HeroSignalCard({ label, value }: HeroSignal) {
  return (
    <SurfaceCard className="hero-pill p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </SurfaceCard>
  )
}

function renderViewMock(panel: ViewPanel) {
  const tone = toneClassMap[panel.tone]

  if (panel.key === 'calendar') {
    return (
      <div className="grid gap-3 rounded-[1.5rem] border border-white/8 bg-[#07111d] p-4 md:grid-cols-[0.72fr_0.28fr]">
        <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] p-4">
          <div className="grid grid-cols-[3rem_repeat(3,minmax(0,1fr))] gap-2 text-[11px] text-slate-400">
            <span />
            {['Mon', 'Tue', 'Wed'].map((day) => (
              <div key={day} className="rounded-xl bg-white/[0.04] px-2 py-2 text-center text-slate-300">{day}</div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[3rem_repeat(3,minmax(0,1fr))] gap-2 text-xs">
            {['09:00', '11:00', '14:00'].map((slot, slotIndex) => (
              <div key={slot} className="contents">
                <div className="flex items-center text-slate-500">{slot}</div>
                {['Project sync', 'Focus block', 'Review'].map((item, itemIndex) => (
                  <div
                    key={`${slot}-${item}`}
                    className={cn(
                      'rounded-xl border px-3 py-3 text-slate-100',
                      itemIndex === slotIndex
                        ? tone.chip
                        : 'border-white/8 bg-white/[0.05]',
                    )}
                  >
                    {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {['Due date synced', 'Task schedule moved', 'Context menu ready'].map((item) => (
            <div key={item} className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-3 py-3 text-xs text-slate-300">{item}</div>
          ))}
        </div>
      </div>
    )
  }

  if (panel.key === 'kanban') {
    return (
      <div className="grid gap-3 rounded-[1.5rem] border border-white/8 bg-[#07111d] p-4 md:grid-cols-3">
        {[
          { column: 'Backlog', items: ['UX polish', 'API mapping'] },
          { column: 'In Progress', items: ['Landing scroll', 'Task detail fix'] },
          { column: 'Done', items: ['Comment feed', 'Goal toolbar'] },
        ].map(({ column, items }, columnIndex) => (
          <div key={column} className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{column}</p>
              <span className="text-[11px] text-slate-500">0{columnIndex + 1}</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {items.map((item) => (
                <div
                  key={item}
                  className={cn(
                    'rounded-[1rem] border px-3 py-3 text-xs text-white',
                    item === 'Landing scroll' ? tone.chip : 'border-white/8 bg-[#0c1b2b]',
                  )}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (panel.key === 'todo') {
    return (
      <div className="rounded-[1.5rem] border border-white/8 bg-[#07111d] p-4">
        <div className="space-y-3">
          {[
            ['Fix delete dialog', true],
            ['Move comments inside task drawer', true],
            ['Tune pomodoro bell preset', false],
            ['Review notifications flow', false],
          ].map(([item, done], index) => (
            <div key={String(item)} className="flex items-center gap-3 rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3 text-sm text-slate-100">
              <div className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-xs',
                done ? tone.chip : 'border-white/12 text-slate-400',
              )}>
                {done ? <CheckCircle2 className="size-4" /> : index + 1}
              </div>
              <div className="flex-1">
                <p>{item}</p>
                <p className="mt-1 text-xs text-slate-400">{done ? 'Done and synced' : 'Ready for next focus block'}</p>
              </div>
              <div className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', tone.soft)}>
                {done ? 'Done' : 'Focus'}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-3 rounded-[1.5rem] border border-white/8 bg-[#07111d] p-4 md:grid-cols-[0.56fr_0.44fr]">
      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Goal status</p>
          <div className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', tone.soft)}>
            68%
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/8">
          <div className={cn('h-full w-[68%] rounded-full bg-gradient-to-r', tone.line)} />
        </div>
        <div className="mt-4 space-y-2.5 text-xs text-slate-300">
          {['Task status', 'Goal type', 'Priority filter'].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-[1rem] border border-white/8 bg-[#0c1b2b] px-3 py-3">
              <span>{item}</span>
              <ChevronRight className="size-3.5 text-slate-500" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {['Launch alpha tasks', 'Member onboarding', 'Review sprint follow-up'].map((item, index) => (
          <div key={item} className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>{item}</span>
              <span className="text-slate-500">0{index + 1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ViewPanelCard({ panel }: { panel: ViewPanel }) {
  const tone = toneClassMap[panel.tone]
  const Icon = panel.icon

  return (
    <SurfaceCard className="view-panel flex min-w-full flex-col overflow-hidden p-5 lg:min-w-[calc(100vw-11rem)] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]', tone.chip)}>
            <Icon className="size-3.5" />
            {panel.label}
          </div>
          <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">{panel.title}</h3>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
          {panel.bullets.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6">{renderViewMock(panel)}</div>
    </SurfaceCard>
  )
}

function FocusFeatureCard({ module, className }: { module: FocusModule; className?: string }) {
  const Icon = module.icon

  return (
    <div className={cn(
      'focus-module rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-5 shadow-[0_32px_80px_-44px_rgba(0,0,0,0.5)] backdrop-blur-sm',
      className,
    )}>
      <div className="flex size-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/[0.12] text-sky-300">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-white">{module.title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-300">{module.body}</p>
      <div className="mt-5 space-y-2 text-sm text-slate-300">
        {module.bullets.map((item) => (
          <div key={item} className="flex items-start gap-2 rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskHubCard() {
  return (
    <SurfaceCard className="focus-center relative overflow-hidden border-white/12 bg-[linear-gradient(180deg,rgba(8,17,28,0.98),rgba(7,14,24,0.92))] p-6 text-white shadow-[0_42px_110px_-54px_rgba(56,189,248,0.38)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_32%)]" />
      <div className="focus-orbit absolute left-6 top-6 rounded-full border border-sky-300/20 bg-sky-400/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100">
        Comment
      </div>
      <div className="focus-orbit absolute right-6 top-10 rounded-full border border-emerald-300/20 bg-emerald-400/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
        Notes
      </div>
      <div className="focus-orbit absolute bottom-8 left-8 rounded-full border border-amber-300/20 bg-amber-400/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">
        Pomodoro
      </div>

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Task hub</p>
            <p className="mt-1 text-sm font-medium text-white">Chi tiết task, comment và nhịp làm việc ở cùng một nơi.</p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-sky-200">
            Live context
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[0.54fr_0.46fr]">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Task detail drawer</p>
                <p className="mt-1 text-base font-semibold text-white">Release planning and handoff</p>
              </div>
              <div className="rounded-full border border-emerald-300/20 bg-emerald-400/12 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-emerald-100">
                In progress
              </div>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {[
                'Priority, assignee, goal và due date trong cùng panel.',
                'Comment feed mở ngay trong task thay vì tách cửa sổ.',
                'Đi thẳng sang notes hoặc pomodoro từ task hiện tại.',
              ].map((item) => (
                <div key={item} className="rounded-[1rem] border border-white/8 bg-[#0c1a2b] px-3 py-3">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sky-200">
                <MessageSquare className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Inline comments</p>
              </div>
              <div className="mt-3 space-y-2.5 text-sm text-slate-300">
                {['Please confirm the Friday rollout window.', 'Notes updated with the final review checklist.'].map((item) => (
                  <div key={item} className="rounded-[1rem] border border-white/8 bg-[#0c1a2b] px-3 py-3">{item}</div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-amber-200">
                  <TimerReset className="size-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Pomodoro</p>
                </div>
                <p className="mt-3 text-sm text-slate-300">Focus, nghỉ ngắn, chuông báo và quay lại task ngay.</p>
              </div>
              <div className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-rose-200">
                  <Bell className="size-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">Activity pulse</p>
                </div>
                <p className="mt-3 text-sm text-slate-300">Thông báo mới và activity log giữ nhịp cập nhật liên tục.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SurfaceCard>
  )
}

export function LandingPage() {
  const token = useAuthStore((state) => state.accessToken)
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!rootRef.current || typeof window === 'undefined') {
      return
    }

    const root = rootRef.current
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const media = gsap.matchMedia()

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        return
      }

      const revealItems = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'))
      revealItems.forEach((item) => {
        gsap.fromTo(
          item,
          { autoAlpha: 0, y: 56, scale: 0.96 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: item,
              start: 'top 82%',
              end: 'bottom 58%',
              toggleActions: 'play none none reverse',
            },
          },
        )
      })

      const focusModulesList = Array.from(root.querySelectorAll<HTMLElement>('.focus-module'))
      focusModulesList.forEach((module, index) => {
        gsap.fromTo(
          module,
          { autoAlpha: 0, y: 72, rotate: index % 2 === 0 ? -4 : 4 },
          {
            autoAlpha: 1,
            y: 0,
            rotate: 0,
            duration: 1.05,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: module,
              start: 'top 84%',
              end: 'bottom 62%',
              scrub: 0.9,
            },
          },
        )
      })

      const focusCenter = root.querySelector<HTMLElement>('.focus-center')
      if (focusCenter) {
        gsap.fromTo(
          focusCenter,
          { autoAlpha: 0, y: 84, scale: 0.92, rotate: -3 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            rotate: 0,
            duration: 1.15,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: focusCenter,
              start: 'top 84%',
              end: 'bottom 62%',
              scrub: 1,
            },
          },
        )
      }

      const focusOrbits = Array.from(root.querySelectorAll<HTMLElement>('.focus-orbit'))
      focusOrbits.forEach((orbit, index) => {
        gsap.to(orbit, {
          y: index % 2 === 0 ? -10 : 10,
          x: index === 1 ? -8 : 8,
          duration: 3.4 + index * 0.45,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        })
      })

      const ctaSection = root.querySelector<HTMLElement>('.landing-cta')
      if (ctaSection) {
        const ctaTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: ctaSection,
            start: 'top 82%',
            end: 'bottom bottom',
            scrub: 1,
          },
        })

        ctaTimeline
          .fromTo('.cta-copy', { y: 48, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.42 }, 0)
          .fromTo('.cta-ring--a', { scale: 0.78, autoAlpha: 0.12 }, { scale: 1.08, autoAlpha: 0.36, duration: 0.5 }, 0)
          .fromTo('.cta-ring--b', { scale: 0.62, autoAlpha: 0.08 }, { scale: 1.2, autoAlpha: 0.24, duration: 0.5 }, 0.05)
          .fromTo('.cta-ring--c', { scale: 0.48, autoAlpha: 0.05 }, { scale: 1.32, autoAlpha: 0.16, duration: 0.5 }, 0.1)
      }

      media.add('(min-width: 1024px)', () => {
        const heroSection = root.querySelector<HTMLElement>('.landing-hero')
        if (heroSection) {
          const heroTimeline = gsap.timeline({
            scrollTrigger: {
              trigger: heroSection,
              start: 'top top',
              end: '+=190%',
              scrub: 1.1,
              pin: true,
              anticipatePin: 1,
            },
          })

          heroTimeline
            .fromTo('.hero-copy', { yPercent: 0 }, { yPercent: -16, duration: 1 }, 0)
            .fromTo('.hero-glow--a', { scale: 0.78, autoAlpha: 0.18 }, { scale: 1.25, autoAlpha: 0.42, duration: 1 }, 0)
            .fromTo('.hero-glow--b', { scale: 0.84, autoAlpha: 0.12 }, { scale: 1.22, autoAlpha: 0.34, duration: 1 }, 0.05)
            .fromTo('.hero-grid', { yPercent: 0 }, { yPercent: -10, duration: 1 }, 0)
            .fromTo('.hero-card--workspace', { x: 80, y: 56, autoAlpha: 0, scale: 0.88 }, { x: 0, y: 0, autoAlpha: 1, scale: 1, duration: 0.36, ease: 'power2.out' }, 0.02)
            .fromTo('.hero-card--views', { x: -80, y: 68, autoAlpha: 0, scale: 0.86 }, { x: 0, y: 0, autoAlpha: 1, scale: 1, duration: 0.38, ease: 'power2.out' }, 0.06)
            .fromTo('.hero-card--task', { x: 36, y: 88, autoAlpha: 0, scale: 0.84 }, { x: 0, y: 0, autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power2.out' }, 0.1)
            .fromTo('.hero-card--pulse', { x: 92, y: -48, autoAlpha: 0, scale: 0.86 }, { x: 0, y: 0, autoAlpha: 1, scale: 1, duration: 0.34, ease: 'power2.out' }, 0.14)
            .to('.hero-card--workspace', { x: -56, y: -22, rotate: -2, scale: 0.9, autoAlpha: 0.55, duration: 0.5, ease: 'power2.inOut' }, 0.54)
            .to('.hero-card--views', { x: -20, y: 56, rotate: 1, scale: 0.93, autoAlpha: 0.55, duration: 0.5, ease: 'power2.inOut' }, 0.54)
            .to('.hero-card--task', { x: 48, y: 12, rotate: 2, scale: 0.97, autoAlpha: 0.55, duration: 0.5, ease: 'power2.inOut' }, 0.54)
            .to('.hero-card--pulse', { x: 58, y: -36, rotate: -1, scale: 0.9, autoAlpha: 0.55, duration: 0.5, ease: 'power2.inOut' }, 0.54)
        }

        const storySection = root.querySelector<HTMLElement>('.system-story')
        if (storySection) {
          const storyConnectors = Array.from(storySection.querySelectorAll<SVGLineElement>('.story-connector'))
          storyConnectors.forEach((connector) => {
            const length = connector.getTotalLength()
            gsap.set(connector, {
              strokeDasharray: length,
              strokeDashoffset: length,
              autoAlpha: 0.18,
            })
          })

          const storyTimeline = gsap.timeline({
            scrollTrigger: {
              trigger: storySection,
              start: 'top top',
              end: '+=210%',
              scrub: 1,
              pin: true,
              anticipatePin: 1,
            },
          })

          storyTimeline
            .fromTo('.story-core', { autoAlpha: 0, scale: 0.72, rotate: -8 }, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.26 }, 0)
            .fromTo('.story-core-ring--a', { scale: 0.72, autoAlpha: 0.08 }, { scale: 1.05, autoAlpha: 0.22, duration: 0.32 }, 0.02)
            .fromTo('.story-core-ring--b', { scale: 0.6, autoAlpha: 0.05 }, { scale: 1.14, autoAlpha: 0.14, duration: 0.36 }, 0.04)
            .to('.story-connector--workspace', { strokeDashoffset: 0, autoAlpha: 0.95, duration: 0.16 }, 0.06)
            .fromTo('.story-node--workspace', { x: -160, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, duration: 0.24 }, 0.1)
            .to('.story-step--workspace', { autoAlpha: 1, duration: 0.16 }, 0.06)
            .to('.story-connector--project', { strokeDashoffset: 0, autoAlpha: 0.95, duration: 0.16 }, 0.24)
            .fromTo('.story-node--project', { x: 180, autoAlpha: 0, scale: 0.8 }, { x: 0, autoAlpha: 1, scale: 1, duration: 0.24 }, 0.28)
            .to('.story-step--workspace', { autoAlpha: 0.36, duration: 0.12 }, 0.26)
            .to('.story-step--project', { autoAlpha: 1, duration: 0.16 }, 0.28)
            .to('.story-connector--task', { strokeDashoffset: 0, autoAlpha: 0.95, duration: 0.16 }, 0.5)
            .fromTo('.story-node--task', { x: -140, y: 120, autoAlpha: 0, scale: 0.82 }, { x: 0, y: 0, autoAlpha: 1, scale: 1, duration: 0.24 }, 0.54)
            .to('.story-step--project', { autoAlpha: 0.36, duration: 0.12 }, 0.52)
            .to('.story-step--task', { autoAlpha: 1, duration: 0.16 }, 0.56)
            .to('.story-connector--pulse', { strokeDashoffset: 0, autoAlpha: 0.95, duration: 0.16 }, 0.74)
            .fromTo('.story-node--pulse', { x: 160, y: 120, autoAlpha: 0, scale: 0.82 }, { x: 0, y: 0, autoAlpha: 1, scale: 1, duration: 0.24 }, 0.78)
            .to('.story-step--task', { autoAlpha: 0.36, duration: 0.12 }, 0.76)
            .to('.story-step--pulse', { autoAlpha: 1, duration: 0.16 }, 0.8)
        }

        const viewsSection = root.querySelector<HTMLElement>('.views-carousel')
        const viewsViewport = root.querySelector<HTMLElement>('.views-viewport')
        const viewsTrack = root.querySelector<HTMLElement>('.views-track')
        const panels = Array.from(root.querySelectorAll<HTMLElement>('.view-panel'))

        if (viewsSection && viewsViewport && viewsTrack && panels.length > 0) {
          const viewsTimeline = gsap.timeline({
            scrollTrigger: {
              trigger: viewsSection,
              start: 'top top',
              end: () => {
                const distance = viewsTrack.scrollWidth - viewsViewport.clientWidth
                return `+=${Math.max(distance * 1.35, 1800)}`
              },
              scrub: 1,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })

          viewsTimeline.to(
            viewsTrack,
            {
              x: () => {
                const distance = viewsTrack.scrollWidth - viewsViewport.clientWidth
                return distance > 0 ? -distance : 0
              },
              duration: 1,
              ease: 'none',
            },
            0,
          )

          panels.forEach((panel, index) => {
            const enterAt = index / panels.length
            viewsTimeline.fromTo(
              panel,
              { scale: index === 0 ? 1 : 0.9, rotate: index % 2 === 0 ? -4 : 4, autoAlpha: index === 0 ? 1 : 0.62 },
              { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.18 },
              enterAt,
            )

            if (index < panels.length - 1) {
              viewsTimeline.to(
                panel,
                { scale: 0.9, rotate: index % 2 === 0 ? 5 : -5, autoAlpha: 0.5, duration: 0.18 },
                enterAt + 0.18,
              )
            }
          })
        }
      })
    }, root)

    return () => {
      media.revert()
      ctx.revert()
    }
  }, [])

  return (
    <main ref={rootRef} className="overflow-x-clip bg-[#050b14] text-white">
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#050b14]/78 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#38bdf8,#0f172a)] text-sm font-bold shadow-[0_18px_48px_-22px_rgba(56,189,248,0.55)]">
              C
            </div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-white">Chronelis</p>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            <a href="#he-thong" className="transition-colors hover:text-white">Hệ thống</a>
            <a href="#views" className="transition-colors hover:text-white">Views</a>
            <a href="#tap-trung" className="transition-colors hover:text-white">Tập trung</a>
            <a href="#bat-dau" className="transition-colors hover:text-white">Bắt đầu</a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full px-4 text-slate-200 hover:bg-white/8 hover:text-white">
              <Link to={token ? '/dashboard' : '/login'}>{token ? 'Vào app' : 'Đăng nhập'}</Link>
            </Button>
            <Button asChild className="rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100">
              <Link to={token ? '/dashboard' : '/register'}>
                {token ? 'Mở workspace' : 'Tạo tài khoản'}
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="landing-hero relative border-b border-white/8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-glow--a absolute left-1/2 top-10 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="hero-glow--b absolute right-[8%] top-24 h-72 w-72 rounded-full bg-emerald-300/12 blur-3xl" />
          <div className="hero-grid absolute inset-0 opacity-25" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)', backgroundSize: '4rem 4rem' }} />
        </div>

        <div className="mx-auto grid min-h-screen max-w-7xl gap-12 px-4 py-18 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-8 lg:px-8 lg:py-20">
          <div className="hero-copy">
            <SectionPill>Less tab switching. More control.</SectionPill>

            <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-[-0.07em] text-white sm:text-6xl lg:text-7xl">
              Chronelis gom luồng làm việc thực tế của team vào một lớp điều phối gọn và rõ.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Workspace, project, goal và task trong một flow; đổi nhanh giữa Calendar, Kanban, To Do rồi đi sâu vào comment, notes, pomodoro và activity realtime.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                <Link to={token ? '/dashboard' : '/register'}>
                  {token ? 'Mở Chronelis' : 'Bắt đầu ngay'}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full border-white/12 bg-white/[0.05] px-6 text-sm text-white hover:bg-white/10 hover:text-white">
                <a href="#views">
                  Xem toàn bộ flow
                  <ChevronRight className="size-4" />
                </a>
              </Button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {heroSignals.map((signal) => (
                <HeroSignalCard key={signal.label} {...signal} />
              ))}
            </div>
          </div>

          <div className="relative min-h-[34rem] sm:min-h-[39rem] lg:min-h-[42rem]">
            <SurfaceCard className="absolute inset-x-[8%] top-[10%] bottom-[12%] border-white/12 bg-[linear-gradient(180deg,rgba(7,18,30,0.96),rgba(7,14,24,0.92))]" />

            <SurfaceCard className="hero-card--workspace absolute left-0 top-[10%] w-[54%] p-4 lg:w-[45%]" data-hero-card>
              <div className="flex items-center gap-2 text-sky-200">
                <PanelsTopLeft className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Workspace layer</p>
              </div>
              <div className="mt-4 space-y-3">
                {['Workspace A', 'Workspace B', 'Workspace C'].map((item, index) => (
                  <div key={item} className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3 text-sm text-white">
                    <div className="flex items-center justify-between gap-3">
                      <span>{item}</span>
                      <span className="text-[11px] text-slate-400">0{index + 1}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Owner, members, teams, invites</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="hero-card--views absolute left-[8%] bottom-[7%] w-[46%] p-4 lg:left-[10%] lg:w-[38%]" data-hero-card>
              <div className="flex items-center gap-2 text-amber-200">
                <Workflow className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Task views</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-300">
                {['Calendar', 'Kanban', 'To Do'].map((item, index) => (
                  <span key={item} className={cn(
                    'rounded-full border px-3 py-1.5',
                    index === 0 ? 'border-amber-300/30 bg-amber-400/12 text-amber-100' : 'border-white/10 bg-white/[0.04]',
                  )}>
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-300">
                {['Calendar schedule', 'Kanban workflow', 'Quick To Do handling'].map((item) => (
                  <div key={item} className="rounded-[0.95rem] border border-white/8 bg-[#0c1a2b] px-3 py-2.5">{item}</div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="hero-card--task absolute right-[6%] top-[16%] w-[58%] p-4 lg:w-[48%]" data-hero-card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">Task focus</p>
                  <p className="mt-1 text-sm font-medium text-white">Task detail drawer</p>
                </div>
                <div className="rounded-full border border-emerald-300/25 bg-emerald-400/12 px-2.5 py-1 text-[11px] text-emerald-100">Live context</div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[0.56fr_0.44fr]">
                <div className="space-y-2.5">
                  {['Comments inside task', 'Notes page', 'Priority and schedule'].map((item) => (
                    <div key={item} className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-3 text-xs text-slate-200">{item}</div>
                  ))}
                </div>
                <div className="rounded-[1rem] border border-white/8 bg-[#0c1a2b] p-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2 text-white">
                    <MessageSquare className="size-4 text-emerald-200" />
                    <span>Comment feed</span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {['Need review before release.', 'Move due date to Friday.', 'Notes updated with screenshots.'].map((item) => (
                      <div key={item} className="rounded-[0.9rem] border border-white/8 bg-white/[0.04] px-3 py-2.5">{item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard className="hero-card--pulse absolute right-0 bottom-[14%] w-[34%] p-4" data-hero-card>
              <div className="flex items-center gap-2 text-rose-200">
                <Bell className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Pulse</p>
              </div>
              <div className="mt-4 space-y-2.5 text-xs text-slate-300">
                {['7 thông báo chưa đọc', 'Activity log realtime', 'Pomodoro entry available'].map((item) => (
                  <div key={item} className="rounded-[0.95rem] border border-white/8 bg-[#0c1a2b] px-3 py-2.5">{item}</div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </section>

      <section id="he-thong" className="system-story border-b border-white/8 bg-[#07111d]">
        <div className="mx-auto grid min-h-screen max-w-7xl gap-12 px-4 py-18 sm:px-6 lg:grid-cols-[0.42fr_0.58fr] lg:items-center lg:px-8 lg:py-20">
          <div data-reveal>
            <SectionPill className="bg-white/[0.04]">Luồng hệ thống</SectionPill>
            <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Từ workspace xuống từng task, Chronelis giữ cùng một mạch dữ liệu.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">
              Không phải nhảy nhiều chỗ để ghép lại ngữ cảnh. Role, project, goal, task, lịch và tín hiệu mới đều nằm trên cùng một flow.
            </p>

            <div className="mt-10 space-y-4">
              {workflowSteps.map((step, index) => {
                const Icon = step.icon

                return (
                  <div
                    key={step.key}
                    className={cn('story-step story-step--' + step.key, 'rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 text-white', index === 0 ? 'opacity-100' : 'opacity-35')}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] text-sky-200">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{step.label}</p>
                        <p className="mt-2 text-base font-medium text-white">{step.title}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                          {step.meta.map((item) => (
                            <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:hidden" data-reveal>
            {workflowSteps.map((step) => {
              const Icon = step.icon

              return (
                <SurfaceCard key={step.key} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-sky-200">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{step.label}</p>
                      <p className="mt-1 text-sm font-medium text-white">{step.title}</p>
                    </div>
                  </div>
                </SurfaceCard>
              )
            })}
          </div>

          <div className="story-scene relative hidden min-h-[42rem] overflow-hidden rounded-[2.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,17,28,0.98),rgba(7,13,24,0.92))] p-5 shadow-[0_40px_110px_-56px_rgba(14,165,233,0.44)] lg:block" data-reveal>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_32%)]" />
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line className="story-connector story-connector--workspace" x1="50" y1="50" x2="24" y2="24" stroke="rgba(125,211,252,0.9)" strokeWidth="1.2" strokeLinecap="round" />
              <line className="story-connector story-connector--project" x1="50" y1="50" x2="76" y2="24" stroke="rgba(253,224,71,0.85)" strokeWidth="1.2" strokeLinecap="round" />
              <line className="story-connector story-connector--task" x1="50" y1="50" x2="24" y2="78" stroke="rgba(110,231,183,0.9)" strokeWidth="1.2" strokeLinecap="round" />
              <line className="story-connector story-connector--pulse" x1="50" y1="50" x2="76" y2="78" stroke="rgba(251,113,133,0.85)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>

            <div className="story-core absolute left-1/2 top-1/2 z-20 flex h-46 w-46 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.2),rgba(8,17,28,0.94))] shadow-[0_28px_80px_-34px_rgba(56,189,248,0.45)]">
              <div className="story-core-ring--a pointer-events-none absolute inset-[-12%] rounded-full border border-sky-300/15" />
              <div className="story-core-ring--b pointer-events-none absolute inset-[-24%] rounded-full border border-sky-300/8" />
              <div className="relative text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200">Chronelis core</p>
                <p className="mt-3 text-sm font-medium text-white">Workspace, project, task và pulse cùng một mạch.</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] uppercase tracking-[0.16em] text-slate-400">
                  {['Calendar', 'Kanban', 'To Do', 'Realtime'].map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5">{item}</span>
                  ))}
                </div>
              </div>
            </div>

            <SurfaceCard className="story-node story-node--workspace absolute left-6 top-8 z-10 w-[34%] p-4">
              <div className="flex items-center gap-2 text-sky-200">
                <PanelsTopLeft className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Workspace</p>
              </div>
              <p className="mt-3 text-sm font-medium text-white">Invite code, team, member roles và quản trị thành viên.</p>
            </SurfaceCard>

            <SurfaceCard className="story-node story-node--project absolute right-6 top-8 z-10 w-[34%] p-4">
              <div className="flex items-center gap-2 text-amber-200">
                <FolderKanban className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Project + goal</p>
              </div>
              <p className="mt-3 text-sm font-medium text-white">Project detail, goal manager, tiến độ và bộ lọc task.</p>
            </SurfaceCard>

            <SurfaceCard className="story-node story-node--task absolute bottom-8 left-6 z-10 w-[35%] p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <ListTodo className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Task system</p>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                {['Calendar schedule', 'Comments inside drawer', 'Notes + pomodoro'].map((item) => (
                  <div key={item} className="rounded-[0.9rem] border border-white/8 bg-white/4 px-3 py-2.5">{item}</div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="story-node story-node--pulse absolute bottom-8 right-6 z-10 w-[33%] p-4">
              <div className="flex items-center gap-2 text-rose-200">
                <Activity className="size-4" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Pulse</p>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-300">
                {['Unread notifications', 'Activity log', 'Realtime project updates'].map((item) => (
                  <div key={item} className="rounded-[0.9rem] border border-white/8 bg-white/4 px-3 py-2.5">{item}</div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </section>

      <section id="views" className="views-carousel border-b border-white/8 bg-[#050d18]">
        <div className="mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl" data-reveal>
            <SectionPill>Một dữ liệu, nhiều góc nhìn</SectionPill>
            <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Chuyển view liên tục mà không làm đứt mạch xử lý công việc.
            </h2>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Calendar để kéo lịch, Kanban để nhìn flow, To Do để xử lý nhanh, Goals để xem task theo mục tiêu. Cùng một dữ liệu, chỉ đổi góc nhìn.
            </p>
          </div>

          <div className="views-viewport mt-10 overflow-hidden" data-reveal>
            <div className="views-track flex flex-col gap-5 lg:flex-row lg:gap-6">
              {viewPanels.map((panel) => (
                <ViewPanelCard key={panel.key} panel={panel} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="tap-trung" className="focus-section relative border-b border-white/8 bg-[#040d1a] text-white">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/4 top-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-sky-500/[0.07] blur-3xl" />
          <div className="absolute right-0 top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 rounded-full bg-emerald-500/[0.05] blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-[24rem] w-[48rem] -translate-x-1/2 rounded-full bg-violet-500/[0.04] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-18 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl text-center" data-reveal>
              <SectionPill>Giữ task làm trung tâm</SectionPill>
              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                Mọi thứ quan trọng đều quay về task và nhịp phối hợp của team.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Task drawer là nơi Chronelis gom phần làm việc sâu nhất: comment, notes, lịch, pomodoro, thông báo và quyền thao tác bám đúng dữ liệu thật của hệ thống.
              </p>
          </div>

          <div className="mt-12 grid gap-5 xl:grid-cols-[0.28fr_0.44fr_0.28fr] xl:items-start">
            <div className="grid gap-5">
              <FocusFeatureCard module={focusModules[0]} />
              <FocusFeatureCard module={focusModules[1]} />
            </div>

            <TaskHubCard />

            <div className="grid gap-5">
              <FocusFeatureCard module={focusModules[2]} />
              <FocusFeatureCard module={focusModules[3]} />
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FocusFeatureCard module={focusModules[4]} className="md:h-full" />
            <FocusFeatureCard module={focusModules[5]} className="md:h-full" />
          </div>
        </div>
      </section>

      <section id="bat-dau" className="landing-cta relative overflow-hidden bg-[#040d1a] px-4 py-22 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(56,189,248,0.14),transparent_68%)]" />
        <div className="cta-ring--a pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/22" />
        <div className="cta-ring--b pointer-events-none absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/12" />
        <div className="cta-ring--c pointer-events-none absolute left-1/2 top-1/2 h-[54rem] w-[54rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/6" />

        <div className="cta-copy relative mx-auto max-w-5xl overflow-hidden rounded-[2.25rem] border border-white/12 bg-[linear-gradient(150deg,rgba(56,189,248,0.08),rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8 shadow-[0_56px_140px_-64px_rgba(56,189,248,0.65)] backdrop-blur-sm sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[0.68fr_0.32fr] lg:items-end">
            <div>
              <SectionPill className="bg-white/[0.04]">Ready to operate cleaner?</SectionPill>
              <h2 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
                Bắt đầu một workspace gọn, nhanh và nhìn rõ hơn từ ngày đầu tiên.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Chronelis phù hợp khi team cần một nơi duy nhất để chạy project, goal, task, lịch, phối hợp và nhịp tập trung mà không bị vỡ ngữ cảnh.
              </p>
              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
                {['Calendar / Kanban / To Do', 'Comment + notes', 'Pomodoro + notifications', 'Roles + invites'].map((item) => (
                  <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <Button asChild className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                <Link to={token ? '/dashboard' : '/register'}>
                  {token ? 'Mở dashboard' : 'Tạo workspace mới'}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full border-white/12 bg-white/[0.05] px-6 text-sm text-white hover:bg-white/10 hover:text-white">
                <Link to={token ? '/workspaces' : '/login'}>
                  {token ? 'Xem workspaces' : 'Đăng nhập'}
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-10 grid gap-4 border-t border-white/10 pt-6 sm:grid-cols-3">
            {[
              { icon: PanelsTopLeft, label: 'Workspace and member control' },
              { icon: Workflow, label: 'Task views that switch fast' },
              { icon: Zap, label: 'Focused execution with pomodoro' },
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
      </section>
    </main>
  )
}