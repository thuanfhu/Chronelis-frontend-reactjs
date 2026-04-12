import { http, unwrapData } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { UserSecure } from '@/types/domain'

export interface UpdateUserProfilePayload {
  firstName: string
  lastName: string
  nickname?: string
  avatarUrl?: string
  biography?: string
  city?: string
  nationality?: string
}

export interface UpdateUserEmailPayload {
  newEmail: string
}

export interface UpdateUserPasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface VerifyEmailChangePayload {
  token: string
}

export const userApi = {
  async updateProfile(payload: UpdateUserProfilePayload) {
    const response = await http.patch<ApiResponse<UserSecure>>('/users/update-profile', payload)
    return unwrapData(response.data)
  },

  async updateEmail(payload: UpdateUserEmailPayload) {
    const response = await http.put<ApiResponse<void>>('/users/update-email', payload)

    if (!response.data.success) {
      throw new Error(response.data.message ?? 'Cap nhat email that bai')
    }

    return response.data.message ?? 'Vui long kiem tra email moi de xac thuc'
  },

  async updatePassword(payload: UpdateUserPasswordPayload) {
    const response = await http.put<ApiResponse<UserSecure>>('/users/update-password', payload)
    return unwrapData(response.data)
  },

  async verifyChangeEmail(payload: VerifyEmailChangePayload) {
    const response = await http.post<ApiResponse<UserSecure>>('/users/verify-change-email', payload)
    return unwrapData(response.data)
  },
}
