import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh">
      {/* Left panel — brand */}
      <div className="hidden flex-1 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Link to="/login" className="flex items-center relative h-8 w-32">
          <img
            src="/favicon/chronelis-logo.png"
            alt="Chronelis"
            className="h-28 w-auto absolute top-1/2 left-0 -translate-y-1/2 pointer-events-none max-w-none"
          />
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
          <Link to="/login" className="mb-6 flex items-center lg:hidden relative h-7 w-32">
            <img
              src="/favicon/chronelis-logo.png"
              alt="Chronelis"
              className="h-28 w-auto absolute top-1/2 left-0 -translate-y-1/2 pointer-events-none max-w-none"
            />
          </Link>

          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
