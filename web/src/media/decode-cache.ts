import { photoUrl } from './urls'
import type { Scene } from '../model'

/** 只保留当前屏和相邻屏的图片，避免预热整个项目挤满解码缓存。 */
export class DecodeCache {
  private images = new Map<string, HTMLImageElement>()
  private video: HTMLVideoElement | null = null
  warm(scenes: Scene[], active: number, urls: Record<string, string>) {
    const wanted = new Set(scenes.slice(Math.max(0, active - 1), active + 2).flatMap(s => s.photos.map(p => photoUrl(urls, p.mediaId, s.photos.length))).filter(Boolean))
    for (const [url, image] of this.images) if (!wanted.has(url)) { image.removeAttribute('src'); this.images.delete(url) }
    for (const url of wanted) if (!this.images.has(url)) {
      const image = new Image(); image.decoding = 'async'; image.src = url; this.images.set(url, image); void image.decode().catch(() => {})
    }
    const next = scenes[active + 1]; const src = next?.videoId ? urls[next.videoId] : undefined
    if (src !== this.video?.getAttribute('src')) {
      this.video?.removeAttribute('src'); this.video?.load(); this.video = null
      if (src) { this.video = document.createElement('video'); this.video.preload = 'metadata'; this.video.muted = true; this.video.src = src }
    }
  }
  dispose() {
    for (const image of this.images.values()) image.removeAttribute('src')
    this.images.clear(); this.video?.removeAttribute('src'); this.video?.load(); this.video = null
  }
}
