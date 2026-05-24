import { useState, type ChangeEvent } from 'react'
import type { Area } from 'react-easy-crop'
import { Camera } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { storageApi } from '@/lib/api/modules/storage-api'
import { ImageCropDialog } from '@/components/ui/image-crop-dialog'
import { AVATAR_CROP_CONTEXT_ERROR, AVATAR_CROP_EMPTY_ERROR, getCroppedImg } from '@/lib/utils/crop-image'
import { cn } from '@/lib/utils/cn'

interface WorkspaceImageUploadProps {
  value: string
  onChange: (url: string) => void
  className?: string
  alt?: string
  folder?: string
  fileName?: string
}

export function WorkspaceImageUpload({
  value,
  onChange,
  className,
  alt = 'Workspace',
  folder = 'workspace-images',
  fileName = 'workspace.jpg',
}: WorkspaceImageUploadProps) {
  const { t } = useTranslation()
  const [cropDialogOpen, setCropDialogOpen] = useState(false)
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      setRawImageSrc(reader.result as string)
      setCropDialogOpen(true)
    })
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCropConfirm = async (croppedAreaPixels: Area, rotation: number) => {
    if (!rawImageSrc) return
    setIsUploading(true)
    try {
      const blob = await getCroppedImg(rawImageSrc, croppedAreaPixels, rotation)
      const file = new File([blob], fileName, { type: 'image/jpeg' })
      const uploaded = await storageApi.uploadSingle(file, folder)
      onChange(uploaded.fileUrl)
      setCropDialogOpen(false)
      setRawImageSrc(null)
      toast.success(t('common.success'))
    } catch (error) {
      const description =
        error instanceof Error &&
        error.message &&
        error.message !== AVATAR_CROP_CONTEXT_ERROR &&
        error.message !== AVATAR_CROP_EMPTY_ERROR
          ? error.message
          : 'Failed to upload image'
      toast.error(t('common.error'), { description })
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <>
      <div
        className={cn(
          'group relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-dashed border-border/60 transition-colors hover:border-primary/50',
          className,
        )}
      >
        {value ? (
          <img src={value} alt={alt} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted">
            <Camera className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
        )}
        <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="size-5" />
          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isUploading} />
        </label>
      </div>

      <ImageCropDialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open)
          if (!open) setRawImageSrc(null)
        }}
        rawImageSrc={rawImageSrc}
        onCropConfirm={handleCropConfirm}
        isUploading={isUploading}
        title={t('workspace.image.editTitle')}
        applyLabel={t('workspace.image.apply')}
      />
    </>
  )
}
