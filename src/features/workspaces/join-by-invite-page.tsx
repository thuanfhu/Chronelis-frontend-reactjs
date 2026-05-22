import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2, XCircle, ArrowRight, Users, Calendar, Info, Sun, Moon, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { workspaceInviteApi } from '@/lib/api/modules/workspace-invite-api'
import { format } from 'date-fns'
import { vi, enUS } from 'date-fns/locale'
import { useUiStore } from '@/app/store/ui-store'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function JoinByInvitePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') ?? ''
  const dateLocale = i18n.language === 'vi' ? vi : enUS

  const toggleTheme = useUiStore((state) => state.toggleTheme)
  const theme = useUiStore((state) => state.theme)

  const validateQuery = useQuery({
    queryKey: ['invite', 'validate', code],
    queryFn: () => workspaceInviteApi.validate(code),
    enabled: !!code,
    retry: false,
  })

  const joinMutation = useMutation({
    mutationFn: () => workspaceInviteApi.join({ inviteCode: code }),
    onSuccess: () => {
      toast.success(t('workspace.join.success'))
      navigate('/workspaces')
    },
    onError: (error: Error) => {
      toast.error(t('workspace.join.action'), { description: error.message })
    },
  })

  const invite = validateQuery.data

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: 'easeOut' as const,
        staggerChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-slate-50 dark:bg-[#0a0c10]">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[10%] -left-[10%] h-[50%] w-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[50%] w-[50%] rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      {/* Top Utilities */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-full bg-white/50 backdrop-blur-sm dark:bg-slate-800/50"
              onClick={toggleTheme}
            >
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent>
        </Tooltip>
      </div>

      <div className="relative z-10 w-full max-w-5xl px-6 py-8">
        <AnimatePresence mode="wait">
          {!code ? (
            <motion.div
              key="no-code"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mx-auto max-w-md rounded-3xl border border-slate-200/60 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/80"
            >
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="size-10" />
              </div>
              <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                {t('workspace.join.invalidCode')}
              </h1>
              <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">{t('workspace.join.invalidInvite')}</p>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/dashboard')}>
                {t('workspace.join.backHome')}
              </Button>
            </motion.div>
          ) : validateQuery.isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 className="mb-4 size-12 animate-spin text-primary" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                {t('workspace.join.loading')}
              </p>
            </motion.div>
          ) : validateQuery.isError ? (
            <motion.div
              key="error"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="mx-auto max-w-md rounded-3xl border border-slate-200/60 bg-white/80 p-8 text-center shadow-2xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/80"
            >
              <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="size-10" />
              </div>
              <h1 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                {t('workspace.join.invalidInvite')}
              </h1>
              <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">{t('workspace.join.invalidInvite')}</p>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => navigate('/dashboard')}>
                {t('workspace.join.backHome')}
              </Button>
            </motion.div>
          ) : invite ? (
            <motion.div
              key="invite"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative grid gap-0 overflow-hidden rounded-3xl border border-slate-200/60 bg-white/80 shadow-2xl backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-900/80 md:grid-cols-2"
            >
              {/* Logo in Top-Left of Form */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute top-10 left-8 z-30 hidden md:block"
              >
                <img
                  src={
                    theme === 'dark' ? '/favicon/chronelis-logo-darkmode.png' : '/favicon/chronelis-logo-lightmode.png'
                  }
                  alt="Chronelis"
                  className={`h-22 w-auto drop-shadow-md lg:h-28 origin-left transition-all duration-300 ${theme === 'dark' ? 'scale-[0.78]' : ''}`}
                />
              </motion.div>

              {/* Left Side: Workspace Brand */}
              <div className="relative flex flex-col items-center justify-center border-b border-slate-100 bg-slate-50/50 p-8 pt-24 dark:border-slate-800/50 dark:bg-slate-800/30 md:border-b-0 md:border-r md:p-12 md:pt-36">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="relative mb-6"
                >
                  <div className="flex size-24 items-center justify-center rounded-3xl bg-primary text-3xl font-bold text-white shadow-2xl shadow-primary/30 md:size-32 md:text-4xl">
                    {invite.workspaceName.charAt(0).toUpperCase()}
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                    className="absolute -bottom-2 -right-2 flex size-8 items-center justify-center rounded-full bg-white p-1.5 shadow-lg dark:bg-slate-900 md:size-10 md:p-2"
                  >
                    <Users className="size-full text-primary" />
                  </motion.div>
                </motion.div>

                <div className="text-center">
                  <motion.h2
                    variants={itemVariants}
                    className="text-xl font-bold text-slate-900 dark:text-white md:text-3xl"
                  >
                    {invite.workspaceName}
                  </motion.h2>
                  <motion.div variants={itemVariants} className="mt-4 flex flex-wrap justify-center gap-2">
                    <Badge
                      variant="secondary"
                      className="h-7 bg-primary/10 px-3 text-sm text-primary hover:bg-primary/20"
                    >
                      {t(`workspace.role.${invite.roleToAssign.toLowerCase()}`)}
                    </Badge>
                  </motion.div>
                </div>
              </div>

              {/* Right Side: Details & Action */}
              <div className="flex flex-col justify-center p-8 md:p-12 md:pt-14">
                <motion.div variants={itemVariants} className="mb-8">
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white md:text-3xl">
                    {t('workspace.join.title')}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('workspace.join.reviewInfo')}</p>
                </motion.div>

                <motion.div variants={itemVariants} className="mb-10 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                      <ShieldCheck className="size-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('workspace.join.yourRole')}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {invite.roleToAssign === 'OWNER'
                          ? t('workspace.join.roleOwnerDesc')
                          : t('workspace.join.roleMemberDesc')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10">
                      <Calendar className="size-5 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('workspace.join.inviteDate')}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {format(new Date(invite.createdAt), 'dd MMMM, yyyy', { locale: dateLocale })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
                      <Info className="size-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {t('workspace.join.invitedBy')}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {invite.createdBy.firstName} {invite.createdBy.lastName}
                      </p>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={itemVariants} className="flex flex-col gap-3">
                  <Button
                    className="group relative h-12 w-full overflow-hidden rounded-xl bg-primary px-6 font-bold text-white transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/20 active:scale-[0.98]"
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending}
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      {joinMutation.isPending ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <>
                          {t('workspace.join.action')}
                          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </div>
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-10 w-full rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    onClick={() => navigate('/dashboard')}
                  >
                    {t('common.cancel')}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 text-center text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500 uppercase"
        >
          © {new Date().getFullYear()} Chronelis Platform. All Rights Reserved.
        </motion.p>
      </div>
    </div>
  )
}
