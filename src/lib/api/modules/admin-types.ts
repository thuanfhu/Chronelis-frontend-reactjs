import type { PaginationResponse } from '@/types/api'

export type HttpMethodName = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface AdminPermission {
  permissionId: string
  name: string
  apiPath: string
  httpMethod: HttpMethodName | string
  module?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface AdminRole {
  roleId: string
  name: string
  description?: string | null
  active?: boolean
  permissions?: AdminPermission[]
  createdAt?: string
  updatedAt?: string
}

export interface AdminUser {
  userId: string
  email: string
  firstName: string
  lastName: string
  nickname?: string | null
  phoneNumber?: string | null
  biography?: string | null
  avatarUrl?: string | null
  city?: string | null
  nationality?: string | null
  isVerified?: boolean
  roles?: AdminRole[]
  createdAt?: string
  updatedAt?: string
}

export interface PagedQueryParams {
  page?: number
  size?: number
}

export type PagedResult<T> = PaginationResponse<T>
