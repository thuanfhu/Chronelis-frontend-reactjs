import { z } from 'zod'

export interface UserPermission {
  permissionId?: string
  id?: string
  name: string
  apiPath: string
  httpMethod: string
  module: string
}

export interface UserRole {
  roleId?: string
  id?: string
  name: string
  description: string
  active: boolean
  permissions: UserPermission[]
}

export interface User {
  userId: string
  email: string
  phoneNumber?: string
  firstName: string
  lastName: string
  nickname?: string
  avatar?: string
  avatarUrl?: string
  birthDate?: string
  gender?: string
  nationality?: string
  isVerified: boolean
  roles: UserRole[]
  createdAt: string
  provider?: string
}

export const userSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  isVerified: z.boolean(),
  roles: z
    .array(
      z.object({
        id: z.string().optional(),
        roleId: z.string().optional(),
        name: z.string(),
        description: z.string().optional().default(''),
        active: z.boolean().optional().default(true),
        permissions: z.array(z.any()).optional().default([]),
      }),
    )
    .optional()
    .default([]),
  createdAt: z.string(),
  provider: z.string().optional(),
})

export const userListSchema = z.array(userSchema)
