import { z } from 'zod'

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
const phonePattern = /^(\+84|0)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/
const emailPattern = /^[\w._%+-]+@(gmail\.com|yopmail\.com)$/

export const loginSchema = z
  .object({
    email: z.string().optional(),
    phoneNumber: z.string().optional(),
    password: z.string().regex(passwordPattern, 'Mat khau khong dung dinh dang backend yeu cau'),
  })
  .refine((value) => Boolean(value.email || value.phoneNumber), {
    message: 'Vui long nhap email hoac so dien thoai',
    path: ['email'],
  })
  .refine((value) => !(value.email && value.phoneNumber), {
    message: 'Chi nhap mot trong hai: email hoac so dien thoai',
    path: ['phoneNumber'],
  })

export const registerSchema = z
  .object({
    email: z.string().regex(emailPattern, 'Chi ho tro gmail.com hoac yopmail.com'),
    phoneNumber: z.string().regex(phonePattern, 'So dien thoai Viet Nam khong hop le'),
    password: z.string().regex(passwordPattern, 'Mat khau khong dung dinh dang backend yeu cau'),
    confirmPassword: z.string().regex(passwordPattern, 'Xac nhan mat khau khong hop le'),
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Mat khau va xac nhan mat khau khong khop',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({
  email: z.string().regex(emailPattern, 'Chi ho tro gmail.com hoac yopmail.com'),
})

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    newPassword: z.string().regex(passwordPattern, 'Mat khau khong dung dinh dang backend yeu cau'),
    confirmPassword: z.string().regex(passwordPattern, 'Xac nhan mat khau khong hop le'),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Mat khau va xac nhan mat khau khong khop',
    path: ['confirmPassword'],
  })
