import { z } from 'zod'

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
const phonePattern = /^(\+84|0)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/
const emailPattern = /^[\w._%+-]+@(gmail\.com|yopmail\.com)$/

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, 'Vui lòng nhập email hoặc số điện thoại')
    .superRefine((value, ctx) => {
      const trimmed = value.trim()
      const valid = trimmed.includes('@') ? emailPattern.test(trimmed) : phonePattern.test(trimmed)
      if (!valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: trimmed.includes('@')
            ? 'Chỉ hỗ trợ gmail.com hoặc yopmail.com'
            : 'Số điện thoại Việt Nam không hợp lệ',
        })
      }
    }),
  password: z.string().regex(passwordPattern, 'Mật khẩu không đúng định dạng'),
})

export const registerSchema = z
  .object({
    email: z.string().regex(emailPattern, 'Chỉ hỗ trợ gmail.com hoặc yopmail.com'),
    phoneNumber: z.string().regex(phonePattern, 'Số điện thoại Việt Nam không hợp lệ'),
    password: z.string().regex(passwordPattern, 'Mật khẩu không đúng định dạng'),
    confirmPassword: z.string().regex(passwordPattern, 'Xác nhận mật khẩu không hợp lệ'),
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Mật khẩu và xác nhận mật khẩu không khớp',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().regex(emailPattern, 'Chỉ hỗ trợ gmail.com hoặc yopmail.com'),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().regex(passwordPattern, 'Mật khẩu không đúng định dạng'),
    confirmPassword: z.string().regex(passwordPattern, 'Xác nhận mật khẩu không hợp lệ'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Mật khẩu và xác nhận mật khẩu không khớp',
    path: ['confirmPassword'],
  })
