import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="size-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">{t('error.forbidden')}</h1>
        <p className="text-sm text-muted-foreground">{t('error.forbiddenDesc')}</p>
        <Link to="/dashboard">
          <Button>{t('error.goBack')}</Button>
        </Link>
      </div>
    </div>
  )
}
