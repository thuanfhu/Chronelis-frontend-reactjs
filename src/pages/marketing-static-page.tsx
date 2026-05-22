import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Check, Link2, Scale, Settings, ShieldCheck } from 'lucide-react'

import { useAuthStore } from '@/app/store/auth-store'
import { useUiStore } from '@/app/store/ui-store'
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle'
import { Button } from '@/components/ui/button'
import { marketingFooterGroups, type LocaleText } from '@/pages/marketing-links'

export type MarketingPageKey =
  | 'features'
  | 'integrations'
  | 'pricing'
  | 'changelog'
  | 'about'
  | 'roadmap'
  | 'guides'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'cookies'

type Copy = {
  eyebrow: string
  title: string
  description: string
  primaryCta: string
  secondaryCta: string
  secondaryTo?: string
}

type FeatureItem = {
  fa: string
  title: string
  body: string
  tone: string
}

type PolicyPageKey = 'privacy' | 'terms' | 'cookies'

const navLinks = [
  { to: '/features', label: { en: 'Features', vi: 'Tính năng' } },
  { to: '/pricing', label: { en: 'Pricing', vi: 'Bảng giá' } },
  { to: '/roadmap', label: { en: 'Roadmap', vi: 'Lộ trình' } },
  { to: '/guides', label: { en: 'Guides', vi: 'Hướng dẫn' } },
]

const pageTitles: Record<MarketingPageKey, LocaleText> = {
  features: { en: 'Features', vi: 'Tính năng' },
  integrations: { en: 'Integrations', vi: 'Tích hợp' },
  pricing: { en: 'Pricing', vi: 'Bảng giá' },
  changelog: { en: 'Changelog', vi: 'Cập nhật' },
  about: { en: 'About Chronelis', vi: 'Về Chronelis' },
  roadmap: { en: 'Roadmap', vi: 'Lộ trình' },
  guides: { en: 'Guides', vi: 'Hướng dẫn' },
  contact: { en: 'Contact', vi: 'Liên hệ' },
  privacy: { en: 'Privacy Policy', vi: 'Chính sách bảo mật' },
  terms: { en: 'Terms of Service', vi: 'Điều khoản dịch vụ' },
  cookies: { en: 'Cookie Policy', vi: 'Chính sách Cookie' },
}

function tText(value: LocaleText, isVi: boolean) {
  return isVi ? value.vi : value.en
}

function useLocale() {
  const { i18n } = useTranslation()
  return i18n.language.startsWith('vi')
}

function FaIcon({ name, className = '' }: { name: string; className?: string }) {
  return <i className={`fa-solid ${name} fa-fw ${className}`} aria-hidden="true" />
}

export function MarketingStaticPage({ pageKey }: { pageKey: MarketingPageKey }) {
  const isVi = useLocale()
  const title = tText(pageTitles[pageKey], isVi)

  useEffect(() => {
    document.title = `${title} | Chronelis`
    window.scrollTo(0, 0)
  }, [title])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader currentPath={`/${pageKey}`} isVi={isVi} />
      <main className="pt-20">
        {pageKey === 'features' && <FeaturesPage isVi={isVi} />}
        {pageKey === 'integrations' && <IntegrationsPage isVi={isVi} />}
        {pageKey === 'pricing' && <PricingPage isVi={isVi} />}
        {pageKey === 'changelog' && <ChangelogPage isVi={isVi} />}
        {pageKey === 'about' && <AboutPage isVi={isVi} />}
        {pageKey === 'roadmap' && <RoadmapPage isVi={isVi} />}
        {pageKey === 'guides' && <GuidesPage isVi={isVi} />}
        {pageKey === 'contact' && <ContactPage isVi={isVi} />}
        {(pageKey === 'privacy' || pageKey === 'terms' || pageKey === 'cookies') && (
          <PolicyPage pageKey={pageKey} isVi={isVi} />
        )}
      </main>
      <MarketingFooter isVi={isVi} />
    </div>
  )
}

function MarketingHeader({ currentPath, isVi }: { currentPath: string; isVi: boolean }) {
  const currentUser = useAuthStore((state) => state.currentUser)
  const theme = useUiStore((state) => state.theme)
  const logoSrc = theme === 'dark' ? '/favicon/chronelis-logo-darkmode.png' : '/favicon/chronelis-logo-lightmode.png'

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/88 px-5 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-5">
        <Link to="/" className="relative h-10 w-32 shrink-0" aria-label="Chronelis">
          <img
            src={logoSrc}
            alt="Chronelis"
            className={`pointer-events-none absolute left-0 top-1/2 h-28 w-auto max-w-none origin-left -translate-y-1/2 ${
              theme === 'dark' ? 'scale-[0.78]' : ''
            }`}
          />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                currentPath === link.to
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tText(link.label, isVi)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeLanguageToggle />
          {currentUser ? (
            <Button asChild size="sm" className="rounded-md font-semibold">
              <Link to="/dashboard">{isVi ? 'Bảng điều khiển' : 'Dashboard'}</Link>
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
              >
                {isVi ? 'Đăng nhập' : 'Log in'}
              </Link>
              <Button asChild size="sm" className="rounded-md font-semibold">
                <Link to="/register">{isVi ? 'Bắt đầu' : 'Get started'}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function MarketingFooter({ isVi }: { isVi: boolean }) {
  const theme = useUiStore((state) => state.theme)
  const logoSrc = theme === 'dark' ? '/favicon/chronelis-logo-darkmode.png' : '/favicon/chronelis-logo-lightmode.png'

  return (
    <footer className="border-t border-border/60 bg-card px-5 pb-10 pt-16">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 md:grid-cols-4 lg:grid-cols-5">
        <div className="col-span-2">
          <Link to="/" className="relative mb-6 block h-9 w-32" aria-label="Chronelis">
            <img
              src={logoSrc}
              alt="Chronelis"
              className={`pointer-events-none absolute left-0 top-1/2 h-28 w-auto max-w-none origin-left -translate-y-1/2 ${
                theme === 'dark' ? 'scale-[0.78]' : ''
              }`}
            />
          </Link>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">
            {isVi
              ? 'Chronelis giúp nhóm quản lý dự án, mục tiêu, công việc và thời gian tập trung trong một không gian rõ ràng.'
              : 'Chronelis helps teams manage projects, goals, tasks, and focused time inside one clear workspace.'}
          </p>
        </div>
        {marketingFooterGroups.map((group) => (
          <div key={group.title.en}>
            <h4 className="mb-4 font-semibold">{tText(group.title, isVi)}</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {group.links.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors hover:text-foreground">
                    {tText(link.label, isVi)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 grid max-w-7xl grid-cols-2 gap-10 border-t border-border/60 pt-8 text-sm text-muted-foreground md:grid-cols-4 lg:grid-cols-5 items-center">
        <p className="col-span-2 md:col-span-3 lg:col-span-4">
          © 2026 Chronelis Inc. {isVi ? 'Bản quyền thuộc về Chronelis.' : 'All rights reserved.'}
        </p>
        <div className="col-span-2 md:col-span-1 lg:col-span-1 flex items-center gap-4 justify-start">
          <a
            href="https://github.com/thuanfhu/Chronelis-frontend-reactjs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-300 text-xs font-semibold group"
            title={isVi ? 'Kho lưu trữ Frontend' : 'Frontend Repository'}
          >
            <i className="fa-brands fa-github text-base group-hover:scale-110 transition-transform duration-200" />
            <span>Frontend</span>
          </a>
          <a
            href="https://github.com/thuanfhu/Chronelis-backend-spring-boot"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-300 text-xs font-semibold group"
            title={isVi ? 'Kho lưu trữ Backend' : 'Backend Repository'}
          >
            <i className="fa-brands fa-github text-base group-hover:scale-110 transition-transform duration-200" />
            <span>Backend</span>
          </a>
        </div>
      </div>
    </footer>
  )
}

function PageHero({
  copy,
  visual,
  align = 'split',
  icon = 'fa-sparkles',
}: {
  copy: Copy
  visual?: ReactNode
  align?: 'split' | 'center'
  icon?: string
}) {
  const centered = align === 'center'

  return (
    <section className="border-b border-border/60 px-5 py-16 sm:py-20 lg:py-24">
      <div
        className={`mx-auto max-w-7xl ${centered ? 'text-center' : 'grid items-center gap-12 lg:grid-cols-[0.95fr_1fr]'}`}
      >
        <div className={centered ? 'mx-auto max-w-4xl' : ''}>
          <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <FaIcon name={icon} />
            {copy.eyebrow}
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">{copy.title}</h1>
          <p
            className={`mt-6 text-base leading-8 text-muted-foreground sm:text-lg ${centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'}`}
          >
            {copy.description}
          </p>
          <div className={`mt-8 flex flex-col gap-3 sm:flex-row ${centered ? 'justify-center' : ''}`}>
            <Button asChild size="lg" className="h-11 rounded-md px-5 font-semibold">
              <Link to="/register">
                {copy.primaryCta}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 rounded-md px-5 font-semibold">
              <Link to={copy.secondaryTo ?? '/guides'}>{copy.secondaryCta}</Link>
            </Button>
          </div>
        </div>
        {!centered && visual ? <div>{visual}</div> : null}
      </div>
    </section>
  )
}

function FeaturesPage({ isVi }: { isVi: boolean }) {
  const copy: Copy = {
    eyebrow: isVi ? 'Tính năng chính' : 'Core features',
    title: isVi
      ? 'Quản lý dự án, mục tiêu và công việc trong một nơi rõ ràng.'
      : 'Manage projects, goals, and tasks in one clear place.',
    description: isVi
      ? 'Chronelis giúp nhóm biết việc nào cần làm, ai phụ trách, khi nào thực hiện và tiến độ đang ở đâu mà không phải tách dữ liệu qua nhiều công cụ.'
      : 'Chronelis helps teams see what needs to be done, who owns it, when it happens, and where progress stands without splitting work across tools.',
    primaryCta: isVi ? 'Bắt đầu miễn phí' : 'Start free',
    secondaryCta: isVi ? 'Xem hướng dẫn' : 'View guides',
  }

  const features: FeatureItem[] = [
    {
      fa: 'fa-diagram-project',
      title: isVi ? 'Không gian làm việc có tổ chức' : 'Organized workspaces',
      body: isVi
        ? 'Tạo nơi làm việc chung cho từng nhóm, kèm dự án, thành viên và quyền truy cập rõ ràng.'
        : 'Keep projects, members, and access rules in the right scope so teams can follow work easily.',
      tone: 'border-primary/35 bg-primary/10 text-primary',
    },
    {
      fa: 'fa-bullseye',
      title: isVi ? 'Mục tiêu gắn với công việc' : 'Goals tied to tasks',
      body: isVi
        ? 'Biến mục tiêu thành các việc cụ thể để nhóm thấy tiến độ thực tế, không chỉ dừng ở kế hoạch.'
        : 'Each goal can stay tied to concrete tasks, so teams see real progress instead of only a plan.',
      tone: 'border-success/35 bg-success/10 text-success',
    },
    {
      fa: 'fa-table-columns',
      title: isVi ? 'Kanban, danh sách và lịch' : 'Kanban, list, and calendar',
      body: isVi
        ? 'Xem cùng một dữ liệu theo nhiều cách: kéo thả trên Kanban, rà nhanh bằng danh sách hoặc lên lịch theo ngày.'
        : 'View the same work as a Kanban board, a scannable list, or a calendar schedule.',
      tone: 'border-accent/40 bg-accent/15 text-accent-foreground',
    },
    {
      fa: 'fa-stopwatch',
      title: isVi ? 'Pomodoro theo từng công việc' : 'Task-based Pomodoro',
      body: isVi
        ? 'Gắn phiên tập trung với việc đang làm để thời gian thực thi luôn đi cùng tiến độ.'
        : 'Attach focus sessions to active tasks so execution time stays connected to progress.',
      tone: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning',
    },
    {
      fa: 'fa-shield-halved',
      title: isVi ? 'Quyền truy cập dễ hiểu' : 'Clear access control',
      body: isVi
        ? 'Người dùng biết rõ dự án nào được xem, được sửa và quyền nào đang áp dụng trước khi thao tác.'
        : 'Public or private projects, roles, and available actions are clear before users act.',
      tone: 'border-sky-500/35 bg-sky-500/10 text-sky-600 dark:text-sky-300',
    },
    {
      fa: 'fa-comments',
      title: isVi ? 'Trao đổi ngay trong công việc' : 'Discussion inside work',
      body: isVi
        ? 'Bình luận và hoạt động nằm cạnh công việc liên quan, giúp nhóm không thất lạc quyết định.'
        : 'Comments and activity sit near the related work, so decisions do not get lost across channels.',
      tone: 'border-rose-500/35 bg-rose-500/10 text-rose-600 dark:text-rose-300',
    },
  ]

  return (
    <>
      <PageHero copy={copy} visual={<WorkMapVisual isVi={isVi} />} icon="fa-wand-magic-sparkles" />
      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((item) => (
              <article
                key={item.title}
                className="group rounded-md border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/35"
              >
                <div
                  className={`mb-5 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold ${item.tone}`}
                >
                  <FaIcon name={item.fa} />
                  <span>{isVi ? 'Tính năng' : 'Feature'}</span>
                </div>
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <FeatureWorkflow isVi={isVi} />
    </>
  )
}

function WorkMapVisual({ isVi }: { isVi: boolean }) {
  const lanes = [
    { label: isVi ? 'Cần làm' : 'To do', color: 'border-sky-500/25 bg-sky-500/10' },
    { label: isVi ? 'Đang làm' : 'In progress', color: 'border-warning/30 bg-warning/10' },
    { label: isVi ? 'Hoàn tất' : 'Done', color: 'border-success/25 bg-success/10' },
  ]

  return (
    <div className="rounded-md border border-border bg-card p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div>
          <p className="text-sm font-semibold">{isVi ? 'Không gian sản phẩm' : 'Product workspace'}</p>
          <p className="text-xs text-muted-foreground">
            {isVi ? 'Dự án, mục tiêu, lịch và thành viên' : 'Projects, goals, schedules, and members'}
          </p>
        </div>
        <div className="flex -space-x-2">
          {['A', 'M', 'T'].map((item) => (
            <span
              key={item}
              className="flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary/15 text-xs font-bold text-primary"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {lanes.map((lane, index) => (
          <div key={lane.label} className={`rounded-md border p-3 ${lane.color}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide">{lane.label}</span>
              <span className="rounded-md bg-background/70 px-2 py-0.5 text-xs font-semibold">{index + 2}</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-sm font-semibold">{isVi ? 'Thiết kế quyền dự án' : 'Project access design'}</p>
                <div className="mt-3 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 w-2/3 rounded-full bg-primary" />
                </div>
              </div>
              <div className="rounded-md border border-border/70 bg-background p-3">
                <p className="text-sm font-semibold">{isVi ? 'Lịch làm việc tuần này' : 'Weekly schedule'}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {isVi ? '3 phiên Pomodoro' : '3 Pomodoro sessions'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FeatureWorkflow({ isVi }: { isVi: boolean }) {
  const steps = [
    {
      fa: 'fa-folder-tree',
      label: isVi ? 'Tạo không gian làm việc' : 'Create workspace',
      body: isVi
        ? 'Đặt phạm vi cho dự án, thành viên và quyền truy cập.'
        : 'Define the scope for projects, members, and access.',
    },
    {
      fa: 'fa-bullseye',
      label: isVi ? 'Thêm mục tiêu' : 'Add goals',
      body: isVi ? 'Chuyển mục tiêu thành những việc có thể theo dõi.' : 'Turn goals into trackable work.',
    },
    {
      fa: 'fa-list-check',
      label: isVi ? 'Thực hiện công việc' : 'Execute tasks',
      body: isVi ? 'Làm việc qua Kanban, danh sách hoặc lịch.' : 'Work through Kanban, list, or calendar.',
    },
    {
      fa: 'fa-chart-line',
      label: isVi ? 'Theo dõi tiến độ' : 'Track progress',
      body: isVi
        ? 'Xem hoạt động, thời gian tập trung và tiến độ hoàn thành.'
        : 'Review activity, focus time, and completion progress.',
    },
  ]

  return (
    <section className="border-y border-border/60 bg-muted/25 px-5 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold leading-tight">
            {isVi
              ? 'Luồng dùng dễ hiểu từ lúc lập kế hoạch đến khi hoàn tất.'
              : 'A clear flow from planning to completion.'}
          </h2>
          <p className="mt-4 text-base leading-8 text-muted-foreground">
            {isVi
              ? 'Chronelis đi theo cách nhóm thường làm việc: tạo nơi làm việc chung, đặt mục tiêu, chia thành công việc rồi theo dõi tiến độ.'
              : 'Chronelis follows how teams naturally work: create a shared place, set goals, break them into tasks, and track progress.'}
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.label} className="rounded-md border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <span className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <FaIcon name={step.fa} />
                  {isVi ? 'Bước' : 'Step'}
                </span>
                <span className="text-sm font-bold text-muted-foreground">0{index + 1}</span>
              </div>
              <h3 className="font-semibold">{step.label}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function IntegrationsPage({ isVi }: { isVi: boolean }) {
  const copy: Copy = {
    eyebrow: isVi ? 'Tích hợp' : 'Integrations',
    title: isVi ? 'Kết nối vừa đủ để giảm thao tác lặp.' : 'Useful connections that reduce repeated work.',
    description: isVi
      ? 'Chronelis ưu tiên những kết nối gần với công việc hằng ngày: email hệ thống, lịch công việc, cập nhật thời gian thực và cấu trúc API để mở rộng về sau.'
      : 'Chronelis focuses on connections close to daily work: system email, task schedules, realtime updates, and API structure for future expansion.',
    primaryCta: isVi ? 'Bắt đầu dùng' : 'Start using it',
    secondaryCta: isVi ? 'Xem hướng dẫn' : 'View guides',
  }

  return (
    <>
      <PageHero copy={copy} visual={<IntegrationHubVisual isVi={isVi} />} icon="fa-plug-circle-bolt" />
      <IntegrationPrinciples isVi={isVi} />
    </>
  )
}

function IntegrationHubVisual({ isVi }: { isVi: boolean }) {
  const nodes = [
    {
      icon: 'fa-envelope-circle-check',
      label: isVi ? 'Email hệ thống' : 'System email',
      color: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    },
    {
      icon: 'fa-calendar-days',
      label: isVi ? 'Lịch công việc' : 'Task schedules',
      color: 'bg-warning/15 text-warning-foreground dark:text-warning',
    },
    {
      icon: 'fa-tower-broadcast',
      label: isVi ? 'Cập nhật thời gian thực' : 'Realtime updates',
      color: 'bg-success/10 text-success',
    },
    { icon: 'fa-code-branch', label: isVi ? 'API theo từng mảng' : 'Domain APIs', color: 'bg-primary/10 text-primary' },
  ]

  return (
    <div className="rounded-md border border-border bg-card p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-border/70 pb-4">
        <div>
          <p className="font-semibold">{isVi ? 'Trung tâm kết nối' : 'Connection center'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isVi ? 'Các điểm chạm đã gần với sản phẩm' : 'Connection points close to the product'}
          </p>
        </div>
        <span className="rounded-md bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Chronelis</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {nodes.map((node) => (
          <div key={node.label} className="rounded-md border border-border bg-background p-4">
            <span className={`mb-4 flex size-11 items-center justify-center rounded-md ${node.color}`}>
              <FaIcon name={node.icon} className="text-lg" />
            </span>
            <p className="text-sm font-semibold">{node.label}</p>
            <div className="mt-4 h-1.5 rounded-full bg-muted">
              <div className="h-1.5 w-2/3 rounded-full bg-primary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IntegrationPrinciples({ isVi }: { isVi: boolean }) {
  const cards = [
    {
      icon: 'fa-repeat',
      title: isVi ? 'Giảm nhập liệu lại' : 'Reduce duplicate input',
      body: isVi
        ? 'Những thông tin như lịch, trạng thái và người phụ trách nên được cập nhật một lần rồi dùng ở nhiều nơi.'
        : 'Schedules, status, and ownership should be updated once and reused in multiple places.',
      color: 'text-sky-600 bg-sky-500/10 dark:text-sky-300',
    },
    {
      icon: 'fa-bell',
      title: isVi ? 'Đưa thông báo đúng chỗ' : 'Place signals where work happens',
      body: isVi
        ? 'Cập nhật quan trọng cần xuất hiện gần dự án và công việc liên quan, thay vì trôi trong nhiều kênh rời rạc.'
        : 'Important updates should appear near the related project and task instead of drifting across separate channels.',
      color: 'text-amber-700 bg-amber-500/12 dark:text-amber-300',
    },
    {
      icon: 'fa-shield-heart',
      title: isVi ? 'Tôn trọng quyền truy cập' : 'Respect access rules',
      body: isVi
        ? 'Mọi kết nối sau này cần tuân theo quyền của không gian làm việc và dự án riêng tư.'
        : 'Future connections should follow workspace permissions and private project boundaries.',
      color: 'text-emerald-700 bg-emerald-500/12 dark:text-emerald-300',
    },
  ]

  return (
    <section className="border-y border-border/60 bg-muted/25 px-5 py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.8fr_1.1fr]">
        <div className="rounded-md border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold text-primary">
            {isVi ? 'Nguyên tắc tích hợp' : 'Integration principles'}
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-tight">
            {isVi ? 'Tích hợp tốt là làm quy trình nhẹ hơn.' : 'Good integrations make the workflow lighter.'}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {isVi
              ? 'Thay vì bày nhiều logo, trang này tập trung vào cách Chronelis có thể giảm thao tác lặp, giữ dữ liệu đúng chỗ và bảo vệ quyền truy cập.'
              : 'Instead of showing a logo wall, this page focuses on reducing repeated work, keeping data in context, and protecting access rules.'}
          </p>
          <div className="mt-6 grid gap-3">
            {cards.map((card) => (
              <div key={card.title} className="flex gap-4 rounded-md border border-border bg-background p-4">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-md ${card.color}`}>
                  <FaIcon name={card.icon} className="text-lg" />
                </span>
                <div>
                  <h3 className="font-semibold">{card.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{isVi ? 'Luồng kết nối đề xuất' : 'Suggested connection flow'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isVi
                  ? 'Từ dữ liệu trong Chronelis ra các điểm hỗ trợ bên ngoài'
                  : 'From Chronelis data to supporting external touchpoints'}
              </p>
            </div>
            <Link2 className="size-5 text-primary" />
          </div>
          <div className="space-y-4">
            {[
              [
                isVi ? 'Tài khoản' : 'Account',
                isVi ? 'Email xác thực, đặt lại mật khẩu, đổi email' : 'Verification, password reset, email change',
              ],
              [
                isVi ? 'Công việc' : 'Tasks',
                isVi ? 'Lịch làm việc và phiên Pomodoro' : 'Schedules and Pomodoro sessions',
              ],
              [
                isVi ? 'Không gian làm việc' : 'Workspace',
                isVi ? 'Cập nhật thành viên, dự án, bình luận' : 'Member, project, and comment updates',
              ],
              [
                isVi ? 'Dữ liệu' : 'Data',
                isVi ? 'API theo từng mảng để dễ mở rộng' : 'Domain APIs for future expansion',
              ],
            ].map(([label, body], index) => (
              <div
                key={label}
                className="grid gap-3 rounded-md border border-border bg-muted/20 p-4 sm:grid-cols-[3rem_0.35fr_1fr] sm:items-center"
              >
                <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                  0{index + 1}
                </span>
                <p className="font-semibold">{label}</p>
                <p className="text-sm leading-6 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PricingPage({ isVi }: { isVi: boolean }) {
  const copy: Copy = {
    eyebrow: isVi ? 'Bảng giá' : 'Pricing',
    title: isVi
      ? 'Bắt đầu miễn phí, mở rộng khi có gói chính thức.'
      : 'Start free, then expand when plans are published.',
    description: isVi
      ? 'Chronelis hiện tập trung vào trải nghiệm cốt lõi: quản lý dự án, mục tiêu, công việc, lịch và phiên Pomodoro.'
      : 'Chronelis currently focuses on the core experience: projects, goals, tasks, schedules, and Pomodoro sessions.',
    primaryCta: isVi ? 'Bắt đầu miễn phí' : 'Start free',
    secondaryCta: isVi ? 'Xem hướng dẫn' : 'View guides',
  }

  return (
    <>
      <PageHero copy={copy} align="center" icon="fa-tags" />
      <section className="px-5 pb-16 sm:pb-20">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_0.8fr]">
          <article className="rounded-md border border-primary/30 bg-card p-7 shadow-sm ring-1 ring-primary/10">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">{isVi ? 'Hiện tại' : 'Current'}</p>
                <h2 className="mt-2 text-3xl font-bold">{isVi ? 'Miễn phí' : 'Free'}</h2>
              </div>
              <span className="rounded-md bg-success/10 px-3 py-1 text-sm font-semibold text-success">
                {isVi ? 'Có thể dùng ngay' : 'Available now'}
              </span>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
              {isVi
                ? 'Phù hợp để bắt đầu tổ chức công việc nhóm trong Chronelis mà không cần thẻ thanh toán.'
                : 'Suitable for organizing team work in Chronelis without a payment card.'}
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {(isVi
                ? [
                    'Không gian làm việc và dự án',
                    'Mục tiêu và công việc',
                    'Kanban, danh sách, lịch',
                    'Pomodoro theo công việc',
                    'Cộng tác trong nhóm',
                    'Quyền truy cập cơ bản',
                  ]
                : [
                    'Workspaces and projects',
                    'Goals and tasks',
                    'Kanban, list, calendar',
                    'Task-based Pomodoro',
                    'Team collaboration',
                    'Core access control',
                  ]
              ).map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <Check className="size-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-8 rounded-md">
              <Link to="/register">{isVi ? 'Tạo tài khoản' : 'Create account'}</Link>
            </Button>
          </article>
          <aside className="rounded-md border border-border bg-muted/30 p-7">
            <FaIcon name="fa-layer-group" className="mb-5 text-2xl text-primary" />
            <h2 className="text-xl font-semibold">{isVi ? 'Hướng mở rộng sau' : 'Future expansion path'}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {isVi
                ? 'Các năng lực nâng cao có thể được đóng gói khi sản phẩm cần phục vụ nhóm lớn hơn.'
                : 'Advanced capabilities can be packaged when the product needs to support larger teams.'}
            </p>
            <div className="mt-6 space-y-3">
              {(isVi
                ? [
                    'Giá chỉ hiển thị khi được công bố',
                    'Gói nâng cao đi theo nhu cầu thật',
                    'Luồng hiện tại ưu tiên dùng thử nhanh',
                  ]
                : [
                    'Prices appear only when published',
                    'Advanced packaging follows real needs',
                    'The current flow prioritizes quick adoption',
                  ]
              ).map((item) => (
                <div key={item} className="rounded-md border border-border bg-card px-4 py-3 text-sm font-medium">
                  {item}
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </>
  )
}

function ChangelogPage({ isVi }: { isVi: boolean }) {
  const entries = [
    {
      label: isVi ? 'Quyền truy cập dự án rõ hơn' : 'Clearer project access',
      body: isVi
        ? 'Tập trung vào dự án công khai hoặc riêng tư và khả năng thao tác thực tế của từng người dùng.'
        : 'Focused on public or private projects and each user’s effective capabilities.',
      icon: 'fa-shield-halved',
    },
    {
      label: isVi ? 'Pomodoro và lịch làm việc' : 'Pomodoro and scheduling',
      body: isVi
        ? 'Công việc có thêm ngữ cảnh thời gian và phiên tập trung để hỗ trợ làm việc sâu.'
        : 'Tasks gained time context and focus sessions to support deeper work.',
      icon: 'fa-stopwatch',
    },
    {
      label: isVi ? 'Không gian làm việc và nhóm' : 'Workspaces and teams',
      body: isVi
        ? 'Thành viên, nhóm, lời mời và dự án giúp việc cộng tác có ranh giới rõ hơn.'
        : 'Members, teams, invites, and projects make collaboration boundaries clearer.',
      icon: 'fa-people-group',
    },
  ]

  return (
    <section className="px-5 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1fr]">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1 text-sm font-semibold text-warning-foreground dark:text-warning">
            <FaIcon name="fa-clock-rotate-left" />
            {isVi ? 'Cập nhật sản phẩm' : 'Product updates'}
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            {isVi ? 'Cập nhật theo tác động tới công việc hằng ngày.' : 'Updates organized by daily workflow impact.'}
          </h1>
          <p className="mt-6 text-base leading-8 text-muted-foreground">
            {isVi
              ? 'Trang này ghi lại những thay đổi đáng chú ý để người dùng hiểu Chronelis đang cải thiện phần nào.'
              : 'This page records notable changes so users understand which parts of Chronelis are improving.'}
          </p>
        </div>
        <div className="relative">
          <div className="absolute left-5 top-4 h-[calc(100%-2rem)] w-px bg-border" />
          <div className="space-y-5">
            {entries.map((entry, index) => (
              <article
                key={entry.label}
                className="relative rounded-md border border-border bg-card p-6 pl-14 shadow-sm"
              >
                <span className="absolute left-3 top-6 flex size-6 items-center justify-center rounded-full border border-warning/30 bg-background text-warning-foreground dark:text-warning">
                  <FaIcon name={entry.icon} className="text-xs" />
                </span>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">0{index + 1}</p>
                <h2 className="text-xl font-semibold">{entry.label}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{entry.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function AboutPage({ isVi }: { isVi: boolean }) {
  const principles = [
    {
      icon: 'fa-diagram-project',
      title: isVi ? 'Rõ cấu trúc' : 'Clear structure',
      body: isVi
        ? 'Dự án, mục tiêu và công việc được đặt đúng chỗ để nhóm nhìn vào là hiểu.'
        : 'Projects, goals, and tasks are placed where teams can understand them quickly.',
    },
    {
      icon: 'fa-user-check',
      title: isVi ? 'Rõ người phụ trách' : 'Clear ownership',
      body: isVi
        ? 'Mỗi việc nên có người phụ trách, trạng thái và bước tiếp theo đủ rõ.'
        : 'Each task should show ownership, status, and the next step clearly.',
    },
    {
      icon: 'fa-shield-halved',
      title: isVi ? 'Rõ quyền truy cập' : 'Clear access',
      body: isVi
        ? 'Dự án riêng tư, vai trò và quyền thao tác cần hiển thị trước khi người dùng hành động.'
        : 'Private projects, roles, and allowed actions should be visible before users act.',
    },
    {
      icon: 'fa-gauge-high',
      title: isVi ? 'Ít ma sát' : 'Low friction',
      body: isVi
        ? 'Giao diện cần giúp nhóm làm nhanh hơn, không tạo thêm bước không cần thiết.'
        : 'The interface should help teams move faster without unnecessary steps.',
    },
  ]

  return (
    <>
      <section className="overflow-hidden border-b border-border/60 px-5 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-center">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <FaIcon name="fa-circle-info" />
              {isVi ? 'Về Chronelis' : 'About Chronelis'}
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              {isVi
                ? 'Giúp nhóm nhìn rõ công việc và phối hợp dễ hơn.'
                : 'Helping teams see work clearly and coordinate with less friction.'}
            </h1>
            <p className="mt-6 text-base leading-8 text-muted-foreground sm:text-lg">
              {isVi
                ? 'Chronelis được xây cho những nhóm cần quản lý dự án, mục tiêu, công việc, lịch và quyền truy cập trong một nơi thống nhất. Trọng tâm là rõ ràng, dễ dùng và đủ chặt chẽ để làm việc cùng nhau.'
                : 'Chronelis is built for teams that need to manage projects, goals, tasks, schedules, and access in one shared place. The focus is clarity, usability, and enough structure for collaboration.'}
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-6 shadow-xl">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [
                  isVi ? 'Một nơi chung' : 'One shared place',
                  isVi ? 'Dự án, mục tiêu, công việc' : 'Projects, goals, tasks',
                  'fa-layer-group',
                ],
                [
                  isVi ? 'Rõ tiến độ' : 'Visible progress',
                  isVi ? 'Trạng thái, lịch, Pomodoro' : 'Status, schedule, Pomodoro',
                  'fa-chart-line',
                ],
                [
                  isVi ? 'Rõ quyền' : 'Clear access',
                  isVi ? 'Công khai, riêng tư, vai trò' : 'Public, private, roles',
                  'fa-lock',
                ],
                [
                  isVi ? 'Dễ phối hợp' : 'Easy coordination',
                  isVi ? 'Bình luận, hoạt động, thành viên' : 'Comments, activity, members',
                  'fa-comments',
                ],
              ].map(([title, body, icon]) => (
                <div key={title} className="rounded-md border border-border bg-muted/25 p-5">
                  <span className="mb-4 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <FaIcon name={icon} className="text-lg" />
                  </span>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="border-b border-border/60 bg-muted/25 px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <h2 className="text-3xl font-bold leading-tight">
              {isVi ? 'Nguyên tắc thiết kế sản phẩm' : 'Product design principles'}
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {isVi
                ? 'Những nguyên tắc này định hướng cách Chronelis tổ chức giao diện, quyền truy cập và luồng công việc.'
                : 'These principles guide how Chronelis organizes interface, access, and workflow.'}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {principles.map((item) => (
              <article key={item.title} className="rounded-md border border-border bg-card p-6 shadow-sm">
                <span className="mb-5 flex size-12 items-center justify-center rounded-md bg-accent/20 text-accent-foreground">
                  <FaIcon name={item.icon} className="text-lg" />
                </span>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function RoadmapPage({ isVi }: { isVi: boolean }) {
  const phases = [
    {
      title: isVi ? 'Đang ưu tiên' : 'Now',
      subtitle: isVi ? 'Các phần cần ổn định trước' : 'Stabilize first',
      tone: 'border-primary/30 bg-primary/5',
      dot: 'bg-primary',
      icon: 'fa-bolt',
      iconColor: 'text-primary',
      items: isVi
        ? [
            'Làm rõ quyền truy cập dự án',
            'Hoàn thiện lịch làm việc của công việc',
            'Ổn định trải nghiệm không gian làm việc',
          ]
        : ['Clarify project access', 'Polish task scheduling', 'Stabilize workspace experience'],
    },
    {
      title: isVi ? 'Kế tiếp' : 'Next',
      subtitle: isVi ? 'Giúp người dùng bắt đầu nhanh hơn' : 'Help users start faster',
      tone: 'border-accent/35 bg-accent/10',
      dot: 'bg-emerald-500',
      icon: 'fa-arrow-trend-up',
      iconColor: 'text-emerald-500',
      items: isVi
        ? ['Hướng dẫn bắt đầu tốt hơn', 'Báo cáo tiến độ dự án rõ hơn', 'Nhập và xuất dữ liệu có cấu trúc']
        : ['Better onboarding guides', 'Clearer project reporting', 'Structured import and export'],
    },
    {
      title: isVi ? 'Sau này' : 'Later',
      subtitle: isVi ? 'Mở rộng khi nhu cầu đủ rõ' : 'Expand when needs are clearer',
      tone: 'border-warning/35 bg-warning/10',
      dot: 'bg-warning',
      icon: 'fa-lightbulb',
      iconColor: 'text-warning',
      items: isVi
        ? ['Kết nối bên thứ ba', 'Nhật ký kiểm tra nâng cao', 'Gói dành cho nhóm lớn nếu cần']
        : ['Third-party connectors', 'Advanced audit logs', 'Large-team packaging if needed'],
    },
  ]

  return (
    <section className="px-5 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-accent/30 bg-accent/15 px-3 py-1 text-sm font-semibold text-accent-foreground">
            <FaIcon name="fa-map-location-dot" />
            {isVi ? 'Lộ trình sản phẩm' : 'Product roadmap'}
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl tracking-tight mb-5">
            {isVi ? 'Định hướng sản phẩm & Lộ trình phát triển' : 'Product Vision & Strategic Roadmap'}
          </h1>
          <p className="text-base sm:text-lg leading-relaxed text-muted-foreground">
            {isVi
              ? 'Lộ trình phát triển của Chronelis được phân chia theo thứ tự ưu tiên rõ ràng: Tập trung cải thiện hiện tại, lên kế hoạch cho tương lai gần và chuẩn bị mở rộng dài hạn.'
              : 'The Chronelis roadmap is structured by priority: active current focus, upcoming enhancements, and long-term expansion plans as our workspace ecosystem matures.'}
          </p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {phases.map((phase, index) => (
            <article key={phase.title} className={`rounded-md border ${phase.tone} p-1 shadow-sm`}>
              <div className="h-full rounded-[calc(var(--radius)-2px)] bg-card/95 p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">0{index + 1}</p>
                    <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background shadow-sm text-xs">
                      <FaIcon name={phase.icon} className={phase.iconColor} />
                    </span>
                  </div>
                  <h2 className="mt-2 text-2xl font-bold">{phase.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{phase.subtitle}</p>
                </div>
                <ul className="space-y-3 border-t border-border/70 pt-5">
                  {phase.items.map((item) => (
                    <li key={item} className="flex gap-3 rounded-md bg-background/60 p-3 text-sm font-medium">
                      <span className={`mt-2 size-1.5 shrink-0 rounded-full ${phase.dot}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function GuidesPage({ isVi }: { isVi: boolean }) {
  const guides = [
    {
      fa: 'fa-folder-tree',
      title: isVi ? 'Tổ chức không gian làm việc' : 'Organize a workspace',
      body: isVi
        ? 'Khi nào nên tạo không gian làm việc, dự án và mục tiêu riêng.'
        : 'When to create separate workspaces, projects, and goals.',
    },
    {
      fa: 'fa-lock',
      title: isVi ? 'Dự án công khai hoặc riêng tư' : 'Public or private projects',
      body: isVi
        ? 'Cách nghĩ về quyền truy cập trước khi mời thành viên.'
        : 'How to think about access before inviting members.',
    },
    {
      fa: 'fa-calendar-days',
      title: isVi ? 'Dùng chế độ lịch' : 'Use calendar view',
      body: isVi
        ? 'Đưa công việc quan trọng vào lịch để biến kế hoạch thành cam kết.'
        : 'Put important tasks on a schedule so plans become commitments.',
    },
    {
      fa: 'fa-stopwatch',
      title: isVi ? 'Pomodoro theo công việc' : 'Pomodoro by task',
      body: isVi
        ? 'Gắn phiên tập trung với công việc để theo dõi thời gian thực thi.'
        : 'Attach focus sessions to tasks to track execution time.',
    },
  ]

  return (
    <section className="px-5 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.6fr_1fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <FaIcon name="fa-book-open" />
              {isVi ? 'Hướng dẫn sử dụng' : 'Product guides'}
            </p>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
              {isVi ? 'Hướng dẫn nhanh để tổ chức công việc tốt hơn.' : 'Practical guides for organizing work better.'}
            </h1>
            <p className="mt-6 text-base leading-8 text-muted-foreground">
              {isVi
                ? 'Các mục dưới đây tập trung vào những tình huống phổ biến khi dùng Chronelis trong nhóm.'
                : 'These guides focus on common team workflows inside Chronelis.'}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {guides.map((guide) => (
              <article
                key={guide.title}
                className="rounded-md border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/35"
              >
                <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <FaIcon name={guide.fa} />
                  <span>{isVi ? 'Hướng dẫn' : 'Guide'}</span>
                </div>
                <h2 className="text-xl font-semibold">{guide.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{guide.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactPage({ isVi }: { isVi: boolean }) {
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
  }

  const topics = isVi
    ? ['Hỗ trợ tài khoản', 'Thiết lập không gian làm việc', 'Góp ý tính năng', 'Vấn đề khác']
    : ['Account support', 'Workspace setup', 'Feature feedback', 'Other']

  return (
    <section className="px-5 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1fr]">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-success/25 bg-success/10 px-3 py-1 text-sm font-semibold text-success">
            <FaIcon name="fa-paper-plane" />
            {isVi ? 'Liên hệ' : 'Contact'}
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            {isVi
              ? 'Gửi thông tin để Chronelis hiểu đúng nhu cầu của bạn.'
              : 'Send context so Chronelis can understand your needs.'}
          </h1>
          <p className="mt-6 text-base leading-8 text-muted-foreground">
            {isVi
              ? 'Mẫu liên hệ này được thiết kế cho các câu hỏi về tài khoản, cách tổ chức công việc, quyền truy cập hoặc góp ý sản phẩm.'
              : 'This contact form is designed for questions about accounts, work setup, access, or product feedback.'}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {(isVi
              ? [
                  ['fa-user-shield', 'Tài khoản'],
                  ['fa-folder-tree', 'Không gian làm việc'],
                  ['fa-lightbulb', 'Góp ý'],
                  ['fa-shield-halved', 'Quyền truy cập'],
                ]
              : [
                  ['fa-user-shield', 'Account'],
                  ['fa-folder-tree', 'Workspace'],
                  ['fa-lightbulb', 'Feedback'],
                  ['fa-shield-halved', 'Access'],
                ]
            ).map(([icon, label]) => (
              <div key={label} className="rounded-md border border-border bg-card p-4">
                <FaIcon name={icon} className="mb-3 text-lg text-primary" />
                <p className="text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="rounded-md border border-border bg-card p-6 shadow-xl sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>{isVi ? 'Họ tên' : 'Name'}</span>
              <input
                required
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder={isVi ? 'Nguyễn Minh Anh' : 'Jane Nguyen'}
              />
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>Email</span>
              <input
                required
                type="email"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="you@example.com"
              />
            </label>
          </div>
          <label className="mt-5 block space-y-2 text-sm font-medium">
            <span>{isVi ? 'Chủ đề' : 'Topic'}</span>
            <select
              required
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{isVi ? 'Chọn chủ đề' : 'Choose a topic'}</option>
              {topics.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-5 block space-y-2 text-sm font-medium">
            <span>{isVi ? 'Nội dung' : 'Message'}</span>
            <textarea
              required
              rows={6}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-3 text-sm leading-6 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder={
                isVi
                  ? 'Mô tả ngắn gọn vấn đề, không gian làm việc liên quan và điều bạn muốn được hỗ trợ.'
                  : 'Briefly describe the issue, related workspace, and what you need help with.'
              }
            />
          </label>
          {submitted ? (
            <div className="mt-5 rounded-md border border-success/25 bg-success/10 p-4 text-sm leading-6 text-success">
              {isVi
                ? 'Cảm ơn bạn. Nội dung đã được ghi nhận trên giao diện.'
                : 'Thank you. Your message has been captured in the interface.'}
            </div>
          ) : null}
          <Button type="submit" className="mt-6 w-full rounded-md font-semibold">
            <FaIcon name="fa-paper-plane" />
            {isVi ? 'Gửi liên hệ' : 'Send message'}
          </Button>
        </form>
      </div>
    </section>
  )
}

function PolicyPage({ pageKey, isVi }: { pageKey: PolicyPageKey; isVi: boolean }) {
  const policy = getPolicy(pageKey, isVi)
  const PolicyIcon = policy.icon

  return (
    <section className="px-5 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.34fr_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-md border border-border bg-card p-5 shadow-sm">
            <PolicyIcon className="mb-4 size-7 text-primary" />
            <h1 className="text-2xl font-bold">{policy.title}</h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{policy.description}</p>
            <p className="mt-5 rounded-md bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
              {isVi ? 'Cập nhật: 22/05/2026' : 'Updated: May 22, 2026'}
            </p>
          </div>
        </aside>
        <article className="rounded-md border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="space-y-10">
            {policy.sections.map((section) => (
              <section key={section.title} className="group">
                <h2 className="text-2xl font-bold flex items-center gap-3 text-foreground transition-colors group-hover:text-primary">
                  <span className="flex size-9 items-center justify-center rounded-lg border border-border/80 bg-muted/50 text-base text-muted-foreground group-hover:border-primary/20 group-hover:bg-primary/5 group-hover:text-primary transition-all duration-300">
                    <FaIcon name={section.fa} className="w-4 h-4 flex items-center justify-center" />
                  </span>
                  <span>{section.title}</span>
                </h2>
                <div className="mt-4 space-y-4 pl-12">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function getPolicy(pageKey: PolicyPageKey, isVi: boolean) {
  const base = {
    privacy: {
      icon: ShieldCheck,
      title: isVi ? 'Chính sách bảo mật' : 'Privacy Policy',
      description: isVi
        ? 'Tập trung vào dữ liệu tài khoản, nội dung trong không gian làm việc và các tín hiệu kỹ thuật cần để vận hành Chronelis.'
        : 'Focused on account data, workspace content, and technical signals needed to operate Chronelis.',
      sections: [
        {
          fa: 'fa-database',
          title: isVi ? 'Dữ liệu được xử lý' : 'Data processed',
          body: [
            isVi
              ? 'Chronelis có thể xử lý thông tin tài khoản như tên, email, trạng thái xác thực và tùy chọn hồ sơ.'
              : 'Chronelis may process account information such as name, email, verification state, and profile preferences.',
            isVi
              ? 'Nội dung trong không gian làm việc có thể gồm dự án, mục tiêu, công việc, bình luận, lịch, lời mời và thông tin thành viên do người dùng tạo.'
              : 'Workspace content may include projects, goals, tasks, comments, schedules, invites, and member records created by users.',
          ],
        },
        {
          fa: 'fa-bullseye',
          title: isVi ? 'Mục đích sử dụng' : 'Purpose of use',
          body: [
            isVi
              ? 'Dữ liệu được dùng để xác thực, đồng bộ cộng tác, hiển thị ngữ cảnh công việc, gửi email hệ thống và duy trì độ tin cậy.'
              : 'Data is used for authentication, collaboration sync, work context display, system email, and product reliability.',
            isVi
              ? 'Chronelis không bán dữ liệu cá nhân. Nếu có nhà cung cấp hạ tầng, dữ liệu chỉ nên được xử lý theo mục đích vận hành.'
              : 'Chronelis should not sell personal data. If infrastructure providers are used, data should be processed only for operational purposes.',
          ],
        },
        {
          fa: 'fa-user-shield',
          title: isVi ? 'Quyền kiểm soát' : 'User control',
          body: [
            isVi
              ? 'Người dùng có thể quản lý hồ sơ, email, mật khẩu và trạng thái tham gia không gian làm việc trong ứng dụng.'
              : 'Users can manage profile, email, password, and workspace participation inside the application.',
            isVi
              ? 'Các yêu cầu truy cập, chỉnh sửa hoặc xóa dữ liệu nên đi kèm đủ thông tin để xác minh tài khoản và không gian làm việc liên quan.'
              : 'Requests to access, correct, or delete data should include enough context to verify the account and related workspace.',
          ],
        },
      ],
    },
    terms: {
      icon: Scale,
      title: isVi ? 'Điều khoản dịch vụ' : 'Terms of Service',
      description: isVi
        ? 'Đặt kỳ vọng rõ về tài khoản, nội dung trong không gian làm việc và cách dùng dịch vụ có trách nhiệm.'
        : 'Sets clear expectations for accounts, workspace content, and responsible service use.',
      sections: [
        {
          fa: 'fa-user-check',
          title: isVi ? 'Sử dụng tài khoản' : 'Account use',
          body: [
            isVi
              ? 'Người dùng chịu trách nhiệm giữ thông tin đăng nhập an toàn và đảm bảo dữ liệu tài khoản chính xác.'
              : 'Users are responsible for keeping login credentials secure and account information accurate.',
            isVi
              ? 'Không được cố vượt quyền truy cập, can thiệp bảo mật hoặc truy cập nội dung không được phép.'
              : 'Users must not bypass access controls, interfere with security, or access unauthorized content.',
          ],
        },
        {
          fa: 'fa-briefcase',
          title: isVi ? 'Nội dung trong không gian làm việc' : 'Workspace content',
          body: [
            isVi
              ? 'Người dùng và tổ chức của họ chịu trách nhiệm với nội dung tạo trong không gian làm việc, dự án, mục tiêu, công việc và bình luận.'
              : 'Users and their organizations are responsible for content created in workspaces, projects, goals, tasks, and comments.',
            isVi
              ? 'Chronelis có thể xử lý nội dung đó để cung cấp dịch vụ, đồng bộ dữ liệu và duy trì độ tin cậy.'
              : 'Chronelis may process that content to provide the service, sync data, and maintain reliability.',
          ],
        },
        {
          fa: 'fa-rotate',
          title: isVi ? 'Thay đổi dịch vụ' : 'Service changes',
          body: [
            isVi
              ? 'Tính năng, giới hạn và cách đóng gói sản phẩm có thể thay đổi khi sản phẩm phát triển.'
              : 'Features, limits, and packaging may change as the product evolves.',
            isVi
              ? 'Dịch vụ có thể gián đoạn do bảo trì, sự cố hạ tầng hoặc phụ thuộc bên thứ ba.'
              : 'The service may be interrupted by maintenance, infrastructure incidents, or third-party dependencies.',
          ],
        },
      ],
    },
    cookies: {
      icon: Settings,
      title: isVi ? 'Chính sách Cookie' : 'Cookie Policy',
      description: isVi
        ? 'Giải thích cách Cookie và lưu trữ trình duyệt hỗ trợ đăng nhập, tùy chọn và độ tin cậy.'
        : 'Explains how cookies and browser storage support login, preferences, and reliability.',
      sections: [
        {
          fa: 'fa-cookie-bite',
          title: isVi ? 'Lưu trữ thiết yếu' : 'Essential storage',
          body: [
            isVi
              ? 'Cookie hoặc lưu trữ cục bộ có thể cần cho đăng nhập, bảo mật phiên và trạng thái ứng dụng.'
              : 'Cookies or local storage may be needed for login, session security, and application state.',
            isVi
              ? 'Nếu chặn phần lưu trữ thiết yếu, một số phần của Chronelis có thể không hoạt động đúng.'
              : 'If essential storage is blocked, parts of Chronelis may not work correctly.',
          ],
        },
        {
          fa: 'fa-palette',
          title: isVi ? 'Tùy chọn giao diện' : 'Interface preferences',
          body: [
            isVi
              ? 'Lưu trữ trình duyệt có thể ghi nhớ giao diện sáng hoặc tối, ngôn ngữ và một số lựa chọn giao diện để trải nghiệm nhất quán hơn.'
              : 'Browser storage may remember theme, language, and UI choices for a more consistent experience.',
            isVi
              ? 'Xóa dữ liệu lưu trữ có thể làm các tùy chọn này quay về mặc định.'
              : 'Clearing storage may reset these choices to defaults.',
          ],
        },
        {
          fa: 'fa-cookie',
          title: isVi ? 'Quản lý Cookie' : 'Managing cookies',
          body: [
            isVi
              ? 'Người dùng có thể chặn hoặc xóa Cookie bằng cài đặt trình duyệt.'
              : 'Users can block or delete cookies through browser settings.',
            isVi
              ? 'Nếu Chronelis thêm công cụ phân tích hoặc công cụ bên thứ ba, chính sách này cần được cập nhật rõ ràng.'
              : 'If Chronelis adds analytics or third-party tools, this policy should be updated clearly.',
          ],
        },
      ],
    },
  }

  return base[pageKey]
}
