import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

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
      <div className="chronelis-auth-forms-container">
        <div className={cn('chronelis-auth-signin-signup', formsClassName)}>
          {children}
        </div>
      </div>

      <div className="chronelis-auth-panels-container">
        <section className="chronelis-auth-panel chronelis-auth-left-panel">
          <div className="chronelis-auth-panel-content">
            {leftPanel}
          </div>
        </section>

        <section className="chronelis-auth-panel chronelis-auth-right-panel">
          <div className="chronelis-auth-panel-content">
            {rightPanel}
          </div>
        </section>
      </div>
    </div>
  )
}
