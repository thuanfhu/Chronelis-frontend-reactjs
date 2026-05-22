import { Link } from 'react-router-dom'
import { Ghost } from 'lucide-react'
import { Button } from '@/components/ui/button'
import FuzzyText from '@/components/ui/fuzzy-text'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center bg-background relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10" />

      <div className="max-w-md space-y-8 z-10">
        <div className="relative mx-auto w-32 h-32 flex flex-col items-center justify-center">
          <motion.div
            className="flex size-32 items-center justify-center rounded-full bg-muted border border-border shadow-xl z-10 bg-gradient-to-b from-muted to-background"
            animate={{ y: [-10, 10, -10] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          >
            <Ghost className="size-16 text-primary" />
          </motion.div>

          {/* Shadow of the ghost */}
          <motion.div
            className="absolute -bottom-8 w-20 h-3 bg-black/10 dark:bg-black/30 rounded-[100%] blur-[2px]"
            animate={{ scale: [1, 0.7, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          />
        </div>

        <div className="pt-4">
          <FuzzyText
            baseIntensity={0.2}
            hoverIntensity={0.5}
            enableHover
            className="text-8xl font-black tracking-tight text-foreground sm:text-9xl drop-shadow-sm"
          >
            404
          </FuzzyText>
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground">{t('error.notFound')}</h1>
          <p className="text-base text-muted-foreground max-w-sm mx-auto">{t('error.notFoundDesc')}</p>
        </div>

        <Link to="/dashboard" className="inline-block mt-4">
          <Button
            size="lg"
            className="rounded-full px-8 shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            {t('error.goHome')}
          </Button>
        </Link>
      </div>
    </div>
  )
}
