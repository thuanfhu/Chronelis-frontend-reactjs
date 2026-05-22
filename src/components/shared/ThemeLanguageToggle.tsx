import { useUiStore } from '@/app/store/ui-store'
import { Moon, Sun, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function ThemeLanguageToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useUiStore()
  const { i18n } = useTranslation()

  const toggleLanguage = () => {
    const newLang = i18n.language === 'vi' ? 'en' : 'vi'
    i18n.changeLanguage(newLang)
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguage}
        className="h-9 px-3 font-semibold bg-background/50 backdrop-blur-md border border-border/50 hover:bg-background/80 rounded-full flex items-center gap-2"
        title={i18n.language === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
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
        <span className="sr-only">Toggle Theme</span>
      </Button>
    </div>
  )
}
