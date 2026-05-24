import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { Crop, Loader2, RotateCcw, ZoomIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface ImageCropDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawImageSrc: string | null
  onCropConfirm: (croppedAreaPixels: Area, rotation: number) => Promise<void>
  isUploading?: boolean
  title?: string
  applyLabel?: string
}

export function ImageCropDialog({
  open,
  onOpenChange,
  rawImageSrc,
  onCropConfirm,
  isUploading = false,
  title,
  applyLabel,
}: ImageCropDialogProps) {
  const { t } = useTranslation()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels)
  }, [])

  const handleConfirm = async () => {
    if (!rawImageSrc || !croppedAreaPixels) return
    await onCropConfirm(croppedAreaPixels, rotation)
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isUploading) {
      onOpenChange(false)
      // Reset state for next time
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setCroppedAreaPixels(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crop className="size-4" />
            {title ?? t('profile.crop.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="relative h-64 w-full overflow-hidden rounded-lg bg-black">
          {rawImageSrc && (
            <Cropper
              image={rawImageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              cropShape="round"
              showGrid={false}
            />
          )}
        </div>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs">
                <ZoomIn className="size-3.5" />
                {t('profile.crop.zoom')}
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground">{zoom.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs">
                <RotateCcw className="size-3.5" />
                {t('profile.crop.rotate')}
              </Label>
              <span className="text-xs tabular-nums text-muted-foreground">{rotation}°</span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUploading}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isUploading}>
            {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Crop className="size-4" />}
            {applyLabel ?? t('profile.actions.applyAvatar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
