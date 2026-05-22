import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface LanguageSwitcherProps {
  showLabel?: boolean
  className?: string
}

export function LanguageSwitcher({ showLabel = false, className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const isVi = i18n.language === 'vi'
  const targetLabel = isVi ? t('common.english') : t('common.vietnamese')

  const toggle = () => {
    void i18n.changeLanguage(isVi ? 'en' : 'vi')
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={showLabel ? 'sm' : 'icon'}
          className={
            showLabel
              ? ['group h-8 rounded-full px-3 text-xs font-medium', className].filter(Boolean).join(' ')
              : ['group size-8', className].filter(Boolean).join(' ')
          }
          onClick={toggle}
          aria-label={t('common.language')}
        >
          <Languages className="size-4 icon-hover-bounce" />
          {showLabel ? <span>{targetLabel}</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{targetLabel}</TooltipContent>
    </Tooltip>
  )
}
