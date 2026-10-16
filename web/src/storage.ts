import Dexie, { type EntityTable } from 'dexie'
import { normalizeProject, normalizeScene, referencedMedia, seedProject, type Project, type Media } from './model'
import { processMedia, type ImageVariant } from './media/process-image'
export const db = new Dexie('stage-workbench') as Dexie & { projects: EntityTable<Project, 'id'>; media: EntityTable<Media, 'id'>; variants: EntityTable<ImageVariant, 'id'> }
db.version(1).stores({ projects: 'id', media: 'id' })
db.version(2).stores({ projects: 'id', media: 'id', variants: 'id, mediaId' })

export async function prepareMedia(media: Media[]) {
  const processed: Media[] = []; const variants: ImageVariant[] = []
  // 逐张处理，避免六张手机原图同时解码占用数百 MB。
  for (const asset of media) { const result = await processMedia(asset); processed.push(result.media); variants.push(...result.variants) }
  return { media: processed, variants }
}

export async function putMedia(media: Media[]) {
  const result = await prepareMedia(media)
  await db.transaction('rw', db.media, db.variants, async () => { await db.media.bulkPut(result.media); await db.variants.bulkPut(result.variants) })
  return result
}

/** 空闲时逐张迁移；编码成功且旧记录仍存在时才原子替换，不覆盖导入或其他写入。 */
export async function migrateImages(onReady: (result: Awaited<ReturnType<typeof prepareMedia>>) => void, cancelled: () => boolean) {
  const ids = await db.media.toCollection().primaryKeys()
  for (const id of ids) {
    await new Promise<void>(resolve => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 2000 })
      else setTimeout(resolve, 100)
    })
    if (cancelled()) return
    const old = await db.media.get(id)
    if (!old || old.processed || !old.type.startsWith('image/')) continue
    try {
      const result = await prepareMedia([old])
      if (cancelled()) return
      let written = false
      await db.transaction('rw', db.media, db.variants, async () => {
        const current = await db.media.get(id)
        if (!current || current.processed || current.type !== old.type || current.blob.size !== old.blob.size) return
        await db.media.put(result.media[0]); await db.variants.bulkPut(result.variants); written = true
      })
      if (written && !cancelled()) onReady(result)
    } catch { /* 旧图片处理失败时继续使用原记录，不影响打开项目。 */ }
  }
}

/** 删除未被当前项目或任何备份项目引用的媒体。被替换的图片、视频通过此函数回收。 */
export async function pruneUnusedMedia(keepIds: string[] = []) {
  const projects = await db.projects.toArray()
  const referenced = new Set<string>(keepIds)
  for (const p of projects) {
    if (p.schemaVersion === 2) referencedMedia(p).forEach(id => referenced.add(id))
    else (p as unknown as { slides?: { imageId?: string; videoId?: string; posterId?: string; cards?: { imageId?: string }[] }[] }).slides?.forEach(s => {
      for (const id of [s.imageId, s.videoId, s.posterId, ...(s.cards || []).map(c => c.imageId)]) if (id) referenced.add(id)
    })
  }
  // 只读取主键，避免每次保存都把全部图片和视频 Blob 再载入内存。
  const ids = await db.media.toCollection().primaryKeys()
  const orphan = ids.filter(id => !referenced.has(id))
  if (orphan.length) await db.transaction('rw', db.media, db.variants, async () => { await db.media.bulkDelete(orphan); await db.variants.where('mediaId').anyOf(orphan).delete() })
  return orphan.length
}
export async function loadProject() {
  const saved = await db.projects.get('current')
  if (saved?.schemaVersion === 2) return normalizeProject(saved)
  if (saved) {
    // 保留第一版的完整原件，迁移时不覆盖原始内容。
    const old = saved as unknown as { name: string; slides: { id: string; title: string; kicker: string; body: string; layout: string; imageId?: string; videoId?: string; posterId?: string; cards: { imageId?: string }[]; table: string[][] }[]; selectedId: string; background: Project['background'] }
    if (!Array.isArray(old.slides) || !old.slides.length) throw new Error('原项目无法识别，数据未覆盖')
    const scenes = old.slides.map(page => normalizeScene({ id: page.id, name: page.title.replaceAll('\n', '').slice(0, 18),
      composition: page.layout === 'video' ? 'cinema' : page.layout === 'table' ? 'table' : page.layout === 'split' ? 'editorial' : page.layout === 'cards' ? 'gallery' : 'opening',
      headings: [page.title], texts: [page.kicker, page.body].filter(Boolean), photos: [...new Set([page.imageId, ...page.cards.map(c => c.imageId)].filter((id): id is string => !!id))].slice(0, 6).map(mediaId => ({ id: crypto.randomUUID(), mediaId })), videoId: page.videoId, posterId: page.posterId, table: page.layout === 'table' ? page.table : undefined,
    }))
    const migrated: Project = { id: 'current', schemaVersion: 2, name: old.name, scenes, selectedId: old.selectedId, updatedAt: Date.now(), background: { ...old.background, kind: 'mesh', speed: Math.max(old.background.speed, 0.3) }, transition: 'creative' }
    await db.transaction('rw', db.projects, async () => { await db.projects.put({ ...saved, id: 'v0.1-backup' }); await db.projects.put(migrated) })
    return migrated
  }
  const project = seedProject()
  const sources = [{ id: 'botanical', name: 'botanical.jpg', type: 'image/jpeg' }, { id: 'alpine', name: 'alpine.jpg', type: 'image/jpeg' }, { id: 'ocean', name: 'ocean.jpg', type: 'image/jpeg' }, { id: 'flower', name: 'flower.mp4', type: 'video/mp4' }, { id: 'woodland', name: 'woodland.jpg', type: 'image/jpeg' }, { id: 'dunes', name: 'dunes.jpg', type: 'image/jpeg' }, { id: 'hills', name: 'hills.jpg', type: 'image/jpeg' }]
  const media = await Promise.all(sources.map(async source => {
    const response = await fetch(`${import.meta.env.BASE_URL}media/${source.name}`)
    if (!response.ok) throw new Error(`无法载入素材：${source.name}`)
    return { ...source, blob: await response.blob() }
  }))
  await db.transaction('rw', db.projects, db.media, async () => { await db.media.bulkPut(media); await db.projects.put(project) })
  return project
}
