import { z } from 'zod'

export const permissionSchema = z.object({
  permissionId: z.string(),
  name: z.string(),
  apiPath: z.string(),
  httpMethod: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  module: z.string().optional().default(''),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
  createdBy: z.string().optional().default(''),
})

export type Permission = z.infer<typeof permissionSchema>
