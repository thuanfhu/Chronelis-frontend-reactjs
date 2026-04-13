import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh">
      {/* Left panel — brand */}
      <div className="hidden flex-1 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Link to="/login" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/20">
            <span className="text-sm font-bold">C</span>
          </div>
          <span className="text-sm font-bold tracking-tight">Chronelis</span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight whitespace-pre-line">
            {t('auth.layoutHeading')}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-primary-foreground/70">
            {t('auth.layoutDescription')}
          </p>
        </div>

        <p className="text-xs text-primary-foreground/50">© 2025 Chronelis. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[420px]">
          <Link to="/login" className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-sm font-bold tracking-tight">Chronelis</span>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
