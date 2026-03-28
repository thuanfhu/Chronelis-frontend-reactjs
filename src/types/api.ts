export interface MetaInfo {
  timestamp?: string
  instance?: string
}

export interface ErrorDetail {
  code?: number
  message: string
  field?: string
  resource?: string
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  errors?: ErrorDetail[]
  meta?: MetaInfo
}

export interface PaginationMeta {
  currentPage: number
  pageSize: number
  totalPages: number
  totalElements: number
  hasNext: boolean
  hasPrevious: boolean
}

export interface PaginationResponse<T> {
  meta: PaginationMeta
  content: T[]
}
