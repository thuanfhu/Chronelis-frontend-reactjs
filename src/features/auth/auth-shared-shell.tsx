import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import Prism from '@/components/Prism'
import { ThemeLanguageToggle } from '@/components/shared/ThemeLanguageToggle'

interface AuthSharedShellProps {
  children: ReactNode
  leftPanel: ReactNode
  rightPanel: ReactNode
  pageClassName?: string
  formsClassName?: string
}

export function AuthSharedShell({
  children,
  leftPanel,
  rightPanel,
  pageClassName,
  formsClassName,
}: AuthSharedShellProps) {
  return (
    <div className={cn('chronelis-auth-page', pageClassName)}>
      <div className="absolute top-6 right-6 z-50">
        <ThemeLanguageToggle />
      </div>
      <div className="absolute inset-0 z-0">
        <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
          <Prism
            animationType="rotate"
            timeScale={0.5}
            height={3.5}
            baseWidth={5.5}
            scale={3.6}
            hueShift={0}
            colorFrequency={1}
            noise={0}
            glow={1}
          />
        </div>
      </div>
      <div className="chronelis-auth-forms-container">
        <div className={cn('chronelis-auth-signin-signup', formsClassName)}>{children}</div>
      </div>

      <div className="chronelis-auth-panels-container">
        <section className="chronelis-auth-panel chronelis-auth-left-panel">
          <div className="chronelis-auth-panel-content">{leftPanel}</div>
        </section>

        <section className="chronelis-auth-panel chronelis-auth-right-panel">
          <div className="chronelis-auth-panel-content">{rightPanel}</div>
        </section>
      </div>
    </div>
  )
}
