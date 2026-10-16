import type { Media } from '../model'

export type ImageVariant = { id: string; mediaId: string; kind: 'medium' | 'thumb'; blob: Blob; type: string; width: number; height: number }
export type ProcessedMedia = { media: Media; variants: ImageVariant[] }
type EncodedImage = { blob: Blob; width: number; height: number }

async function encode(source: CanvasImageSource, width: number, height: number, edge: number, transparent: boolean): Promise<EncodedImage> {
  const ratio = Math.min(1, edge / Math.max(width, height))
  const w = Math.max(1, Math.round(width * ratio)); const h = Math.max(1, Math.round(height * ratio))
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('浏览器无法处理图片')
  ctx.drawImage(source, 0, 0, w, h)
  const toBlob = (type: string, quality?: number): Promise<Blob> => 'convertToBlob' in canvas ? canvas.convertToBlob({ type, quality })
    : new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败')), type, quality))
  try {
    let blob = await toBlob('image/webp', 0.86)
    // Safari 等环境可能静默回退 PNG，按实际 MIME 选择兼容编码。
    if (blob.type !== 'image/webp') blob = await toBlob(transparent ? 'image/png' : 'image/jpeg', 0.88)
    return { blob, width: w, height: h }
  } finally { canvas.width = 1; canvas.height = 1 }
}

/** Worker 与无 Worker 环境共用；任何一档失败都保留旧数据，由调用方决定是否报错。 */
export async function processImageLocally(media: Media): Promise<ProcessedMedia> {
  if (!media.type.startsWith('image/') || media.processed) return { media, variants: [] }
  if (['image/gif', 'image/svg+xml'].includes(media.type)) return { media: { ...media, processed: true }, variants: [] }
  // 动态 WebP / APNG 保留动画；它们不能按静态图片重编码。
  const header = new TextDecoder('latin1').decode(await media.blob.slice(0, 65536).arrayBuffer())
  if (header.includes('ANIM') || header.includes('acTL')) return { media: { ...media, processed: true }, variants: [] }
  let image: ImageBitmap | HTMLImageElement
  try { image = await createImageBitmap(media.blob, { imageOrientation: 'from-image' }) }
  catch {
    if (typeof document === 'undefined') throw new Error('图片无法解码')
    const url = URL.createObjectURL(media.blob)
    try { const img = new Image(); img.src = url; await img.decode(); image = img }
    finally { URL.revokeObjectURL(url) }
  }
  try {
    const width = 'naturalWidth' in image ? image.naturalWidth : image.width
    const height = 'naturalHeight' in image ? image.naturalHeight : image.height
    const transparent = media.type !== 'image/jpeg'
    const master = await encode(image, width, height, 3840, transparent)
    const medium = await encode(image, width, height, 1920, transparent)
    const thumb = await encode(image, width, height, 400, transparent)
    return { media: { ...media, ...master, type: master.blob.type, processed: true }, variants: [medium, thumb].map((v, i) => ({ ...v, id: `${media.id}:${i ? 'thumb' : 'medium'}`, mediaId: media.id, kind: i ? 'thumb' : 'medium', type: v.blob.type })) }
  } finally { if ('close' in image) image.close() }
}

async function processInWorker(media: Media): Promise<ProcessedMedia> {
  if (!media.type.startsWith('image/') || media.processed) return { media, variants: [] }
  if (typeof Worker === 'function' && typeof OffscreenCanvas === 'function') {
    let worker: Worker | undefined
    try {
      worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' })
      return await new Promise<ProcessedMedia>((resolve, reject) => {
        worker!.onmessage = event => event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result)
        worker!.onerror = () => reject(new Error('图片处理线程不可用'))
        worker!.postMessage(media)
      })
    } catch { /* 无 Worker 解码支持时用浏览器主线程回退。 */ }
    finally { worker?.terminate() }
  }
  try { return await processImageLocally(media) }
  catch { throw new Error(`无法读取“${media.name}”，请转换为 JPG / PNG 后重试`) }
}

let imageQueue: Promise<unknown> = Promise.resolve()
export function processMedia(media: Media): Promise<ProcessedMedia> {
  if (!media.type.startsWith('image/')) return Promise.resolve({ media, variants: [] })
  const task = imageQueue.catch(() => {}).then(() => processInWorker(media))
  imageQueue = task.catch(() => {})
  return task
}
