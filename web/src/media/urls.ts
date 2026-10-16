import type { Media } from '../model'
import type { ImageVariant } from './process-image'

export function mediaUrls(media: Media[], variants: ImageVariant[] = []) {
  return Object.fromEntries([...media, ...variants].map(m => [m.id, URL.createObjectURL(m.blob)]))
}

export function photoUrl(urls: Record<string, string>, id: string, count: number, thumbnail = false) {
  const variant = urls[`${id}:${thumbnail ? 'thumb' : 'medium'}`]
  return variant && (thumbnail || count >= 3) ? variant : urls[id]
}
