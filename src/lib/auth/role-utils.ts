import type { UserSecure } from '@/types/domain'

export function hasRole(user: UserSecure | null | undefined, roleName: string): boolean {
  const normalized = roleName.trim().toUpperCase()
  if (!normalized) {
    return false
  }

  return Boolean(
    user?.rolesSecured?.some((role) => role.name?.toUpperCase() === normalized),
  )
}

export function isAdminUser(user: UserSecure | null | undefined): boolean {
  return hasRole(user, 'ADMIN')
}
