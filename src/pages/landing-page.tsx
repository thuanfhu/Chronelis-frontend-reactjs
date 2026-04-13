import { useLayoutEffect, useRef } from 'react'
import {
  ArrowRight,
  Bell,
  CalendarDays,
  FolderKanban,
  ListTodo,
  MessageSquare,
  PanelsTopLeft,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/app/store/auth-store'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger)

/* ─── Data ─────────────────────────────────────────────────────────────────── */

type ToneKey = 'sky' | 'emerald' | 'amber' | 'rose'
type ViewKey = 'calendar' | 'kanban' | 'todo' | 'goals'
type Feature = { icon: LucideIcon; titleKey: string; descKey: string; tone: ToneKey }
type ViewTab = { key: ViewKey; icon: LucideIcon; labelKey: string; tone: ToneKey }

const features: Feature[] = [
  { icon: PanelsTopLeft, titleKey: 'landing.featureWorkspace', descKey: 'landing.featureWorkspaceDesc', tone: 'sky' },
  { icon: FolderKanban, titleKey: 'landing.featureProject', descKey: 'landing.featureProjectDesc', tone: 'amber' },
  { icon: CalendarDays, titleKey: 'landing.featureCalendar', descKey: 'landing.featureCalendarDesc', tone: 'sky' },
  { icon: ListTodo, titleKey: 'landing.featureKanban', descKey: 'landing.featureKanbanDesc', tone: 'emerald' },
  { icon: MessageSquare, titleKey: 'landing.featureComment', descKey: 'landing.featureCommentDesc', tone: 'rose' },
  { icon: TimerReset, titleKey: 'landing.featurePomodoro', descKey: 'landing.featurePomodoroDesc', tone: 'amber' },
  { icon: Bell, titleKey: 'landing.featureNotification', descKey: 'landing.featureNotificationDesc', tone: 'rose' },
  { icon: ShieldCheck, titleKey: 'landing.featurePermission', descKey: 'landing.featurePermissionDesc', tone: 'emerald' },
]

const viewTabs: ViewTab[] = [
  { key: 'calendar', icon: CalendarDays, labelKey: 'landing.viewTabs.calendar', tone: 'sky' },
  { key: 'kanban', icon: FolderKanban, labelKey: 'landing.viewTabs.kanban', tone: 'amber' },
  { key: 'todo', icon: ListTodo, labelKey: 'landing.viewTabs.todo', tone: 'emerald' },
  { key: 'goals', icon: Target, labelKey: 'landing.viewTabs.goals', tone: 'rose' },
]

const viewMockItems: Record<ViewKey, string[]> = {
  calendar: [
    'landing.viewMocks.calendar.dragSchedule',
    'landing.viewMocks.calendar.taskScheduleSync',
    'landing.viewMocks.calendar.rightClickAction',
  ],
  kanban: [
    'landing.viewMocks.kanban.columnWorkflow',
    'landing.viewMocks.kanban.dragBetweenColumns',
    'landing.viewMocks.kanban.goalLinkedCard',
  ],
  todo: [
    'landing.viewMocks.todo.quickTaskCreate',
    'landing.viewMocks.todo.completionSound',
    'landing.viewMocks.todo.pomodoroEntry',
  ],
  goals: [
    'landing.viewMocks.goals.filterToolbar',
    'landing.viewMocks.goals.goalProgress',
    'landing.viewMocks.goals.taskByTarget',
  ],
}

const ctaChipKeys = [
  'landing.ctaChips.calendar',
  'landing.ctaChips.kanban',
  'landing.ctaChips.todo',
  'landing.ctaChips.comment',
  'landing.ctaChips.pomodoro',
  'landing.ctaChips.notifications',
]

const toneMap: Record<ToneKey, { chip: string; soft: string }> = {
  sky: { chip: 'border-sky-300/25 bg-sky-400/12 text-sky-200', soft: 'bg-sky-400/12 text-sky-200' },
  emerald: { chip: 'border-emerald-300/25 bg-emerald-400/12 text-emerald-200', soft: 'bg-emerald-400/12 text-emerald-200' },
  amber: { chip: 'border-amber-300/25 bg-amber-400/12 text-amber-200', soft: 'bg-amber-400/12 text-amber-200' },
  rose: { chip: 'border-rose-300/25 bg-rose-400/12 text-rose-200', soft: 'bg-rose-400/12 text-rose-200' },
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-200', className)}>
      <Sparkles className="size-3.5" />
      {children}
    </div>
  )
}

function GlassCard({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-white/6 shadow-[0_24px_64px_-40px_rgba(0,0,0,0.5)] backdrop-blur-xl', className)}>
      {children}
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export function LandingPage() {
  const token = useAuthStore((s) => s.accessToken)
  const { t } = useTranslation()
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!rootRef.current || typeof window === 'undefined') return
    const root = rootRef.current
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = gsap.context(() => {
      if (prefersReduced) return

      /* Reveal on scroll */
      root.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 48, scale: 0.97 }, {
          autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
        })
      })

      /* Feature cards stagger */
      root.querySelectorAll<HTMLElement>('.feature-card').forEach((el, i) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 56, rotate: i % 2 === 0 ? -2 : 2 }, {
          autoAlpha: 1, y: 0, rotate: 0, duration: 0.7, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' },
        })
      })

      /* CTA rings */
      const cta = root.querySelector('.landing-cta')
      if (cta) {
        gsap.timeline({
          scrollTrigger: { trigger: cta, start: 'top 82%', end: 'bottom bottom', scrub: 1 },
        }).fromTo('.cta-copy', { y: 36, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4 }, 0)
          .fromTo('.cta-ring--a', { scale: 0.8, autoAlpha: 0.1 }, { scale: 1.05, autoAlpha: 0.3, duration: 0.5 }, 0)
          .fromTo('.cta-ring--b', { scale: 0.65, autoAlpha: 0.06 }, { scale: 1.15, autoAlpha: 0.2, duration: 0.5 }, 0.05)
      }

      /* Hero glow */
      gsap.to('.hero-glow', { scale: 1.15, autoAlpha: 0.45, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut' })

    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <main ref={rootRef} className="landing-scrollbar overflow-x-clip bg-[#050b14] text-white">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#050b14]/80 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-sky-400 to-sky-600 text-sm font-bold shadow-lg shadow-sky-500/40">C</div>
            <span className="text-sm font-semibold tracking-tight">Chronelis</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 lg:flex">
            <a href="#tinh-nang" className="transition-colors hover:text-white">{t('landing.features')}</a>
            <a href="#views" className="transition-colors hover:text-white">{t('landing.views')}</a>
            <a href="#bat-dau" className="transition-colors hover:text-white">{t('landing.start')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher showLabel className="rounded-full border border-white/12 bg-white/5 px-3 text-slate-100 hover:bg-white/10 hover:text-white" />
            <Button asChild variant="ghost" className="rounded-full px-4 text-slate-200 hover:bg-white/8 hover:text-white">
              <Link to={token ? '/dashboard' : '/login'}>{token ? t('landing.openApp') : t('auth.login')}</Link>
            </Button>
            <Button asChild className="rounded-full bg-white px-5 text-slate-950 hover:bg-slate-100">
              <Link to={token ? '/dashboard' : '/register'}>{token ? t('landing.openWorkspace') : t('landing.createAccount')}</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative border-b border-white/8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-glow absolute left-1/2 top-16 size-112 -translate-x-1/2 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)', backgroundSize: '3.5rem 3.5rem' }} />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:py-40">
          <div data-reveal>
            <Pill>{t('landing.tagline')}</Pill>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              {t('landing.heroTitle')}{' '}
              <span className="bg-linear-to-r from-sky-300 to-sky-500 bg-clip-text text-transparent">{t('landing.heroTitleHighlight')}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              {t('landing.heroDescription')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                <Link to={token ? '/dashboard' : '/register'}>
                  {token ? t('landing.openChronelis') : t('landing.getStarted')}<ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full border-white/12 bg-white/5 px-6 text-sm text-white hover:bg-white/10">
                <a href="#tinh-nang">{t('landing.viewFeatures')}</a>
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-14 grid gap-3 sm:grid-cols-4" data-reveal>
            {[
              { label: t('landing.statStructure'), value: t('landing.statStructureValue') },
              { label: t('landing.statViews'), value: t('landing.statViewsValue') },
              { label: t('landing.statDeep'), value: t('landing.statDeepValue') },
              { label: t('landing.statTrack'), value: t('landing.statTrackValue') },
            ].map((item) => (
              <GlassCard key={item.label} className="p-4 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="tinh-nang" className="border-b border-white/8 bg-[#07111d]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl" data-reveal>
            <Pill>{t('landing.features')}</Pill>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {t('landing.featuresTitle')}
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              {t('landing.featuresDescription')}
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon
              const tone = toneMap[f.tone]
              return (
                <div key={f.titleKey} className="feature-card rounded-2xl border border-white/10 bg-white/4 p-5 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-white/6">
                  <div className={cn('flex size-10 items-center justify-center rounded-xl border', tone.chip)}>
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{t(f.titleKey)}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{t(f.descKey)}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Views ── */}
      <section id="views" className="border-b border-white/8 bg-[#050d18]">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl" data-reveal>
            <Pill>{t('landing.viewsSameData')}</Pill>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {t('landing.viewsTitle')}
            </h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              {t('landing.viewsDescription')}
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal>
            {viewTabs.map((v) => {
              const Icon = v.icon
              const tone = toneMap[v.tone]
              return (
                <GlassCard key={v.key} className="group p-5 transition-colors hover:border-white/15">
                  <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', tone.chip)}>
                    <Icon className="size-3.5" />
                    {t(v.labelKey)}
                  </div>
                  <div className="mt-5 space-y-2">
                    {viewMockItems[v.key].map((itemKey) => (
                      <div key={itemKey} className="rounded-lg border border-white/8 bg-white/4 px-3 py-2.5 text-xs text-slate-300">{t(itemKey)}</div>
                    ))}
                  </div>
                </GlassCard>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section id="bat-dau" className="landing-cta relative overflow-hidden bg-[#040d1a] px-4 py-24 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(56,189,248,0.12),transparent_65%)]" />
        <div className="cta-ring--a pointer-events-none absolute left-1/2 top-1/2 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/20" />
        <div className="cta-ring--b pointer-events-none absolute left-1/2 top-1/2 size-144 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-300/10" />

        <div className="cta-copy relative mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(150deg,rgba(56,189,248,0.06),rgba(255,255,255,0.03))] p-8 shadow-2xl shadow-sky-500/20 backdrop-blur-sm sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <Pill>{t('landing.ctaStart')}</Pill>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl">
                {t('landing.ctaTitle')}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
                {t('landing.ctaDescription')}
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-400">
                {ctaChipKeys.map((chipKey) => (
                  <span key={chipKey} className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5">{t(chipKey)}</span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild className="h-12 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                <Link to={token ? '/dashboard' : '/register'}>
                  {token ? t('landing.openDashboard') : t('landing.createWorkspace')}<ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full border-white/12 bg-white/5 px-6 text-sm text-white hover:bg-white/10">
                <Link to={token ? '/workspaces' : '/login'}>{token ? t('landing.viewWorkspaces') : t('auth.login')}</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3">
            {[
              { icon: PanelsTopLeft, text: t('landing.ctaFeature1') },
              { icon: Workflow, text: t('landing.ctaFeature2') },
              { icon: Zap, text: t('landing.ctaFeature3') },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-slate-200">
                <div className="flex size-9 items-center justify-center rounded-xl bg-white/8 text-sky-200"><Icon className="size-4" /></div>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 bg-[#050b14]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5 text-sm text-slate-400">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/8 text-xs font-bold text-white">C</div>
            Chronelis
          </div>
          <p className="text-xs text-slate-500">{t('landing.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </main>
  )
}
