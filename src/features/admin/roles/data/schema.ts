import { z } from 'zod'

export const permissionSchema = z.object({
  permissionId: z.string(),
  name: z.string(),
  apiPath: z.string(),
  httpMethod: z.string(),
  module: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
  createdBy: z.string().optional().default(''),
})

export type Permission = z.infer<typeof permissionSchema>

export const roleSchema = z.object({
  roleId: z.string(),
  name: z.string(),
  description: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
  permissions: z.array(permissionSchema).optional().default([]),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
  createdBy: z.string().optional().default(''),
})

export type Role = z.infer<typeof roleSchema>

export const metaSchema = z.object({
  currentPage: z.number(),
  pageSize: z.number().optional(),
  totalPages: z.number(),
  totalElements: z.number(),
  hasNext: z.boolean().optional(),
  hasPrevious: z.boolean().optional(),
})

export type Meta = z.infer<typeof metaSchema>
