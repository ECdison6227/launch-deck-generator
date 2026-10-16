import { strToU8, Unzip, UnzipInflate } from 'fflate'
import { downloadZip } from 'client-zip'
import { normalizeProject, referencedMedia, type Project, type Media } from './model'
import type { ImageVariant } from './media/process-image'

type PortableVariant = { path: string; type: string; width: number; height: number }
export interface PortableManifest { format: 'flow-web'; version: 2; project: Project; media: { id: string; name: string; type: string; path: string; variants?: { medium?: PortableVariant } }[] }
const extension = (type: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' })[type] || 'bin'
const safePath = (path: string) => !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(part => part === '..' || part === '.')
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function exportProjectStream(project: Project, media: Media[], variants: ImageVariant[] = []) {
  const runtime = await fetch(`${import.meta.env.BASE_URL}player/manifest.json`, { cache: 'no-store' })
  if (!runtime.ok || !runtime.headers.get('content-type')?.includes('json')) throw new Error('运行包播放器未构建，请运行 npm run build:player 后重试')
  const { files } = await runtime.json() as { files: string[] }
  if (!Array.isArray(files) || !['index.html', 'start.mjs', 'agent.mjs'].every(name => files.includes(name)) || files.some(path => !safePath(path))) throw new Error('播放器文件不完整')
  const assets = new Map(media.map(m => [m.id, m]))
  const entries: PortableManifest['media'] = referencedMedia(project).map(id => {
    const asset = assets.get(id)
    if (!asset) throw new Error('项目中存在缺失素材，请补充后再打包')
    const medium = variants.find(v => v.mediaId === id && v.kind === 'medium')
    return { id, name: asset.name, type: asset.type, path: `media/${encodeURIComponent(id)}.${extension(asset.type)}`,
      variants: medium ? { medium: { path: `media/${encodeURIComponent(id)}-medium.${extension(medium.type)}`, type: medium.type, width: medium.width, height: medium.height } } : undefined }
  })
  const manifest: PortableManifest = { format: 'flow-web', version: 2, project, media: entries }
  const extras: Record<string, Uint8Array> = { 'project.json': strToU8(JSON.stringify(manifest)) }
  extras['start.command'] = strToU8('#!/bin/sh\ncd "$(dirname "$0")"\nnode start.mjs\n')
  extras['start.bat'] = strToU8('@echo off\r\ncd /d "%~dp0"\r\nnode start.mjs\r\npause\r\n')
  extras['使用说明.txt'] = strToU8(`网页演示 · ${project.name}\n\n这是完整的本地网页运行包，包含图片、视频和播放器，不依赖原浏览器或联网 CDN。\n\n1. 完整解压 ZIP，勿在压缩包内部直接打开文件。\n2. 电脑安装 Node.js 18+，在解压目录运行：node start.mjs\n   Mac 可运行 start.command；Windows 可运行 start.bat。\n3. 浏览器打开终端显示的地址（默认 http://127.0.0.1:4177/）。\n   端口被占用时会自动选择空闲端口。\n4. 方向键 / 空格 / 滚轮切换，右上角全屏，Esc 退出全屏。\n\n播放器不需要 npm install，也没有账号或云端服务。\n如需继续编辑：回到编辑器，点击“打开运行包”导入本 ZIP。\n如交给 Agent：请它在本目录执行 node start.mjs，再打开打印的本地地址。\nAgent 修改内容：node agent.mjs presets 查看版式；node agent.mjs inspect 查看内容；编辑 agent-example.json 后执行 node agent.mjs apply agent-example.json，再刷新浏览器。\nAgent 新增一屏：在 JSON 里写 images / video 本地文件路径（图片 jpg/png/webp/gif，视频 mp4/webm/mov），执行 node agent.mjs add new-scene.json，素材会被复制进运行包。\n\n不支持 file:// 双击 index.html，因为模块和素材需要 HTTP 访问。\n`)
  extras['agent-example.json'] = strToU8(JSON.stringify({ scene: 1, presetId: 'statement', headings: ['一个新的主张', '由预设保证效果'], texts: ['字号自动适配'], font: 'sans', textColor: '#30384b', textEffect: 'fade', photoEffect: 'still', background: { colors: ['#e7eaf7', '#c9dcf1', '#f6e5df', '#e8dced'], speed: 0.18 } }, null, 2))
  extras['agent-add-example.json'] = strToU8(JSON.stringify({ presetId: 'pair', name: '交给 Agent 的一屏', headings: ['本地图片，', '直接交给网页。'], texts: ['images 里写文件路径，素材会复制进运行包。'], images: ['./photo.jpg'], photoEffect: 'still' }, null, 2))
  extras['组件与许可.txt'] = strToU8('React MIT；Swiper MIT；Paper Shaders Apache-2.0；Vanta MIT；three MIT；shadcn/ui & Radix MIT；Motion MIT；Recharts MIT；fflate MIT；client-zip MIT（打包器）；Zustand / zundo MIT（编辑器）；Lucide ISC；React Bits MIT + Commons Clause（组件作为完整应用一部分打包，勿单独转售或再分发组件库）。\n阿里妈妈数黑体：阿里巴巴集团官方发布，免费可用于商业用途，选择该字体时随包本地加载，未使用时不携带字体文件，无外站字体依赖。\n源码与许可证见项目 THIRD_PARTY.md。\n')
  extras['部署说明.txt'] = strToU8('发布为网页\n\n将解压后的整个目录上传到静态网站目录，通过 HTTPS 链接分享；可放在任意子路径。\nindex.html 与 project.json 应使用 no-cache；视频服务应支持 HTTP Range。\n如需社交平台分享封面，请为 og:image 配置部署后的绝对地址。\n本地演示运行 node start.mjs，不要通过 file:// 双击打开。\n')
  const hasCustomFont = project.scenes.some(s => s.font === 'alimama')
  async function* inputs() {
    for (const name of files) {
      if (!hasCustomFont && name.endsWith('.woff2')) continue
      const response = await fetch(`${import.meta.env.BASE_URL}player/${name}`)
      if (!response.ok) throw new Error(`播放器文件缺失：${name}`)
      if (name === 'index.html') {
        const description = project.scenes[0].texts.join(' ').slice(0, 160)
        const html = (await response.text()).replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(project.name)}</title>`).replace('</head>', `<meta name="description" content="${escapeHtml(description)}"><meta property="og:title" content="${escapeHtml(project.name)}"></head>`)
        yield { name, input: html }
      } else yield { name, input: response }
    }
    for (const entry of entries) {
      yield { name: entry.path, input: assets.get(entry.id)!.blob }
      if (entry.variants?.medium) yield { name: entry.variants.medium.path, input: variants.find(v => v.mediaId === entry.id && v.kind === 'medium')!.blob }
    }
    for (const [name, input] of Object.entries(extras)) yield { name, input, ...(name === 'start.command' ? { mode: 0o755 } : {}) }
    for (const [name, source] of [['许可证/React-Bits.txt', 'licenses/react-bits.txt'], ['许可证/shadcn.txt', 'licenses/shadcn.txt'], ['许可证/Paper-Shaders.txt', 'licenses/paper-shaders.txt'], ['许可证/Paper-Shaders-NOTICE.txt', 'licenses/paper-shaders-notice.txt']]) {
      const response = await fetch(`${import.meta.env.BASE_URL}${source}`)
      if (!response.ok) throw new Error('缺少上游许可文件，未生成不完整的运行包')
      yield { name, input: response }
    }
  }
  return downloadZip(inputs())
}

export async function exportProjectZip(project: Project, media: Media[], variants: ImageVariant[] = []) {
  return (await exportProjectStream(project, media, variants)).blob()
}

export async function importProjectZip(file: File) {
  const blobs = new Map<string, Blob>()
  const seen = new Set<string>()
  let failure: Error | undefined; let expanded = 0; let pending = 0
  const unzip = new Unzip(entry => {
    if (!safePath(entry.name) || seen.has(entry.name)) { failure = new Error('运行包有重复或无效路径'); return }
    seen.add(entry.name)
    if (entry.name !== 'project.json' && !entry.name.startsWith('media/')) return
    if (seen.size > 10000) { failure = new Error('运行包文件过多'); return }
    const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0; pending++
    entry.ondata = (error, data, final) => {
      if (error) { failure = error; return }
      expanded += data.length; size += data.length
      if (expanded > 16 * 1024 ** 3 || (entry.name === 'project.json' && size > 8 * 1024 ** 2)) { failure = new Error('运行包解压后过大'); entry.terminate(); return }
      chunks.push(data as Uint8Array<ArrayBuffer>)
      if (final) { blobs.set(entry.name, new Blob(chunks)); chunks.length = 0; pending-- }
    }
    entry.start()
  })
  unzip.register(UnzipInflate)
  const reader = file.stream().getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      unzip.push(value || new Uint8Array(), done)
      if (failure) throw failure
      if (done) break
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  finally { reader.releaseLock() }
  if (pending || !blobs.has('project.json')) throw new Error('运行包不完整，或没有 project.json')
  const manifest = JSON.parse(await blobs.get('project.json')!.text()) as PortableManifest
  if (manifest.format !== 'flow-web' || manifest.version !== 2 || !Array.isArray(manifest.media)) throw new Error('不支持此运行包格式')
  const project = normalizeProject(manifest.project)
  const ids = new Set<string>()
  const media: Media[] = manifest.media.map(m => {
    if (!m || typeof m.id !== 'string' || ids.has(m.id) || typeof m.path !== 'string' || !safePath(m.path) || !m.path.startsWith('media/') || typeof m.type !== 'string' || !/^(image|video)\//.test(m.type) || !blobs.has(m.path)) throw new Error('压缩包中有缺失或无效的媒体')
    ids.add(m.id)
    return { id: m.id, name: m.name || m.id, type: m.type, blob: blobs.get(m.path)!.slice(0, undefined, m.type) }
  })
  if (referencedMedia(project).some(id => !ids.has(id))) throw new Error('压缩包缺少页面引用的素材')
  // 运行包可能来自当前项目的旧版本；新 id 防止覆盖备份仍引用的同名媒体。
  const remap = new Map(media.map(m => [m.id, crypto.randomUUID()]))
  return { project: { ...project, scenes: project.scenes.map(s => ({ ...s, photos: s.photos.map(p => ({ ...p, mediaId: remap.get(p.mediaId)! })), videoId: s.videoId ? remap.get(s.videoId) : undefined, posterId: s.posterId ? remap.get(s.posterId) : undefined })) }, media: media.map(m => ({ ...m, id: remap.get(m.id)! })) }
}
