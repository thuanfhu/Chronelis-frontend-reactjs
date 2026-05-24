import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmModal } from '@/components/shared/confirm-modal'

interface LanguageSwitcherProps {
  showLabel?: boolean
  className?: string
}

export function LanguageSwitcher({ showLabel = false, className }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const [pendingLanguage, setPendingLanguage] = useState<'en' | 'vi' | null>(null)
  const isVi = i18n.language === 'vi'
  const targetLabel = isVi ? t('common.english') : t('common.vietnamese')
  const pendingLanguageLabel =
    pendingLanguage === 'vi' ? t('common.vietnamese') : pendingLanguage === 'en' ? t('common.english') : targetLabel

  const toggle = () => {
    setPendingLanguage(isVi ? 'en' : 'vi')
  }

  const confirmLanguageChange = () => {
    if (!pendingLanguage) {
      return
    }

    void i18n.changeLanguage(pendingLanguage)
    setPendingLanguage(null)
  }

  return (
    <>
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

      <ConfirmModal
        open={Boolean(pendingLanguage)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingLanguage(null)
          }
        }}
        title={t('common.languageConfirmTitle')}
        description={t('common.languageConfirmDescription', { language: pendingLanguageLabel })}
        confirmText={t('common.languageConfirmAction')}
        cancelText={t('common.cancel')}
        onConfirm={confirmLanguageChange}
      />
    </>
  )
}
