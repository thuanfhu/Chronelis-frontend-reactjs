import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'

const ROLE_FALLBACK_BADGE_STYLES = [
  'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-500/45 dark:bg-emerald-500/15 dark:text-emerald-200',
  'border-cyan-300 bg-cyan-100 text-cyan-800 dark:border-cyan-500/45 dark:bg-cyan-500/15 dark:text-cyan-200',
  'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-500/45 dark:bg-blue-500/15 dark:text-blue-200',
  'border-indigo-300 bg-indigo-100 text-indigo-800 dark:border-indigo-500/45 dark:bg-indigo-500/15 dark:text-indigo-200',
  'border-lime-300 bg-lime-100 text-lime-800 dark:border-lime-500/45 dark:bg-lime-500/15 dark:text-lime-200',
  'border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-500/45 dark:bg-orange-500/15 dark:text-orange-200',
] as const

function stableHash(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function resolveRoleBadgeClass(roleName: string): string {
  const normalized = roleName.trim().toUpperCase()

  if (!normalized) {
    return ROLE_FALLBACK_BADGE_STYLES[0]
  }

  if (normalized.includes('ADMIN') || normalized.includes('OWNER') || normalized.includes('ROOT')) {
    return 'border-red-300 bg-red-100 text-red-800 dark:border-red-500/45 dark:bg-red-500/15 dark:text-red-200'
  }

  if (normalized.includes('MANAGER') || normalized.includes('LEAD')) {
    return 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-500/45 dark:bg-violet-500/15 dark:text-violet-200'
  }

  if (normalized.includes('MOD') || normalized.includes('SUPPORT')) {
    return 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/45 dark:bg-amber-500/15 dark:text-amber-200'
  }

  if (normalized.includes('USER') || normalized.includes('MEMBER') || normalized.includes('GUEST')) {
    return 'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-200'
  }

  return ROLE_FALLBACK_BADGE_STYLES[stableHash(normalized) % ROLE_FALLBACK_BADGE_STYLES.length]
}

interface RoleBadgeProps {
  roleName: string
  className?: string
}

export function RoleBadge({ roleName, className }: RoleBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold tracking-tight', resolveRoleBadgeClass(roleName), className)}
    >
      {roleName}
    </Badge>
  )
}
