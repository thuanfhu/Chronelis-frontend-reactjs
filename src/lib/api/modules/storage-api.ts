import { http, unwrapData } from '@/lib/api/http'
import type { ApiResponse } from '@/types/api'

interface SingleFileResponse {
  fileName: string
  fileUrl: string
}

export const storageApi = {
  async uploadSingle(file: File, folderName = 'task-notes') {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folderName', folderName)

    const response = await http.post<ApiResponse<SingleFileResponse>>('/storage/azure-blob/upload/single', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return unwrapData(response.data)
  },
}
