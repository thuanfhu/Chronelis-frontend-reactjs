import { useState } from 'react'
import { Moon, Sun, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '@/app/store/ui-store'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/shared/confirm-modal'

export function ThemeLanguageToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useUiStore()
  const { i18n, t } = useTranslation()
  const [pendingLanguage, setPendingLanguage] = useState<'en' | 'vi' | null>(null)

  const isVi = i18n.language === 'vi'
  const targetLanguage = isVi ? 'en' : 'vi'
  const targetLanguageLabel = targetLanguage === 'vi' ? t('common.vietnamese') : t('common.english')
  const pendingLanguageLabel =
    pendingLanguage === 'vi' ? t('common.vietnamese') : pendingLanguage === 'en' ? t('common.english') : targetLanguageLabel

  const toggleLanguage = () => {
    setPendingLanguage(targetLanguage)
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
      <div className={`flex items-center gap-2 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLanguage}
          className="h-9 px-3 font-semibold bg-background/50 backdrop-blur-md border border-border/50 hover:bg-background/80 rounded-full flex items-center gap-2"
          title={t('common.switchLanguageTo', { language: targetLanguageLabel })}
        >
          <Globe className="h-4 w-4" />
          <span className="text-xs">{i18n.language.toUpperCase()}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 bg-background/50 backdrop-blur-md border border-border/50 hover:bg-background/80 rounded-full"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="sr-only">{t('common.toggleTheme')}</span>
        </Button>
      </div>

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
