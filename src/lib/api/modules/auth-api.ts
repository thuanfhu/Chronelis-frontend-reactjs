import { http, unwrapData, unwrapVoid } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'
import type { AuthenticationPayload, UserSecure } from '@/types/domain'

export interface RegisterPayload {
  email: string
  phoneNumber: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
}

export interface LoginPayload {
  email?: string
  phoneNumber?: string
  password: string
}

export interface VerifyPayload {
  token: string
}

export interface ResetPasswordPayload {
  token: string
  newPassword: string
  confirmPassword: string
}

export const authApi = {
  async register(payload: RegisterPayload) {
    const response = await http.post<ApiResponse<void>>('/auth/register', payload)
    return unwrapVoid(response.data)
  },

  async verifyActiveAccount(payload: VerifyPayload) {
    const response = await http.post<ApiResponse<AuthenticationPayload>>('/auth/verify-active-account', payload)
    return unwrapData(response.data)
  },

  async resendVerify(email: string) {
    const response = await http.post<ApiResponse<void>>('/auth/resend-verify', { email })
    return unwrapVoid(response.data)
  },

  async login(payload: LoginPayload) {
    const response = await http.post<ApiResponse<AuthenticationPayload>>('/auth/login', payload)
    return unwrapData(response.data)
  },

  async logout() {
    const response = await http.post<ApiResponse<void>>('/auth/logout')
    return unwrapVoid(response.data)
  },

  async getAccount() {
    const response = await http.get<ApiResponse<UserSecure>>('/auth/account')
    return unwrapData(response.data)
  },

  async refresh() {
    const response = await http.get<ApiResponse<AuthenticationPayload>>('/auth/refresh')
    return unwrapData(response.data)
  },

  async forgotPassword(email: string) {
    const response = await http.post<ApiResponse<void>>('/auth/forgot-password', { email })
    return unwrapVoid(response.data)
  },

  async resetPassword(payload: ResetPasswordPayload) {
    const response = await http.post<ApiResponse<void>>('/auth/reset-password', payload)
    return unwrapVoid(response.data)
  },
}
