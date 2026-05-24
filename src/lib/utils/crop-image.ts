import type { Area } from 'react-easy-crop'

export const AVATAR_CROP_CONTEXT_ERROR = 'AVATAR_CROP_CONTEXT_ERROR'
export const AVATAR_CROP_EMPTY_ERROR = 'AVATAR_CROP_EMPTY_ERROR'

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', (e) => reject(e))
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })
}

export async function getCroppedImg(imageSrc: string, pixelCrop: Area, rotation = 0): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error(AVATAR_CROP_CONTEXT_ERROR)

  const maxSize = Math.max(image.width, image.height)
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2))
  canvas.width = safeArea
  canvas.height = safeArea

  ctx.translate(safeArea / 2, safeArea / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-safeArea / 2, -safeArea / 2)
  ctx.drawImage(image, safeArea / 2 - image.width / 2, safeArea / 2 - image.height / 2)

  const data = ctx.getImageData(0, 0, safeArea, safeArea)
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.putImageData(
    data,
    0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x,
    0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(AVATAR_CROP_EMPTY_ERROR))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.92,
    )
  })
}
