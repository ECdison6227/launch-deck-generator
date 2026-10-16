import { strFromU8, strToU8, unzip, zip, type Zippable } from 'fflate'
import { normalizeProject, referencedMedia, type Project, type Media } from './model'
export interface PortableManifest { format: 'flow-web'; version: 2; project: Project; media: { id: string; name: string; type: string; path: string }[] }
const unpack = (bytes: Uint8Array) => new Promise<Record<string, Uint8Array>>((resolve, reject) => unzip(bytes, { filter: file => file.originalSize < 256 * 1024 * 1024 }, (error, result) => error ? reject(error) : resolve(result)))
export async function exportProjectZip(project: Project, media: Media[]) {
  const response = await fetch(`${import.meta.env.BASE_URL}player-runtime.zip`, { cache: 'no-store' })
  if (!response.ok) throw new Error('运行包播放器未构建，请运行 npm run build:player 后重试')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error('播放器运行文件未就绪，请重启开发服务后重试')
  const files: Zippable = await unpack(bytes)
  if (!files['index.html'] || !files['start.mjs'] || !files['agent.mjs']) throw new Error('播放器文件不完整')
  const assetEntries: PortableManifest['media'] = []
  for (const id of referencedMedia(project)) {
    const asset = media.find(m => m.id === id)
    if (!asset) throw new Error('项目中存在缺失素材，请补充后再打包')
    const extension = asset.type === 'video/mp4' ? 'mp4' : asset.type === 'image/jpeg' ? 'jpg' : asset.type === 'image/png' ? 'png' : asset.type === 'image/webp' ? 'webp' : asset.type === 'video/webm' ? 'webm' : 'bin'
    const path = `media/${encodeURIComponent(id)}.${extension}`
    files[path] = [new Uint8Array(await asset.blob.arrayBuffer()), { level: 0 }]
    assetEntries.push({ id, name: asset.name, type: asset.type, path })
  }
  const manifest: PortableManifest = { format: 'flow-web', version: 2, project, media: assetEntries }
  files['project.json'] = strToU8(JSON.stringify(manifest))
  files['start.command'] = [strToU8('#!/bin/sh\ncd "$(dirname "$0")"\nnode start.mjs\n'), { os: 3, attrs: 0o100755 << 16 }]
  files['start.bat'] = strToU8('@echo off\r\ncd /d "%~dp0"\r\nnode start.mjs\r\npause\r\n')
  files['使用说明.txt'] = strToU8(`网页演示 · ${project.name}\n\n这是完整的本地网页运行包，包含图片、视频和播放器，不依赖原浏览器或联网 CDN。\n\n1. 完整解压 ZIP，勿在压缩包内部直接打开文件。\n2. 电脑安装 Node.js 18+，在解压目录运行：node start.mjs\n   Mac 可运行 start.command；Windows 可运行 start.bat。\n3. 浏览器打开终端显示的地址（默认 http://127.0.0.1:4177/）。\n   端口被占用时会自动选择空闲端口。\n4. 方向键 / 空格 / 滚轮切换，右上角全屏，Esc 退出全屏。\n\n播放器不需要 npm install，也没有账号或云端服务。\n如需继续编辑：回到编辑器，点击“打开运行包”导入本 ZIP。\n如交给 Agent：请它在本目录执行 node start.mjs，再打开打印的本地地址。\nAgent 修改内容：node agent.mjs presets 查看版式；node agent.mjs inspect 查看内容；编辑 agent-example.json 后执行 node agent.mjs apply agent-example.json，再刷新浏览器。\nAgent 新增一屏：在 JSON 里写 images / video 本地文件路径（图片 jpg/png/webp/gif，视频 mp4/webm/mov），执行 node agent.mjs add new-scene.json，素材会被复制进运行包。\n\n不支持 file:// 双击 index.html，因为模块和素材需要 HTTP 访问。\n`)
  files['agent-example.json'] = strToU8(JSON.stringify({ scene: 1, presetId: 'statement', headings: ['一个新的主张', '由预设保证效果'], texts: ['字号自动适配'], font: 'sans', textColor: '#30384b', textEffect: 'fade', photoEffect: 'still', background: { colors: ['#e7eaf7', '#c9dcf1', '#f6e5df', '#e8dced'], speed: 0.18 } }, null, 2))
  files['agent-add-example.json'] = strToU8(JSON.stringify({ presetId: 'pair', name: '交给 Agent 的一屏', headings: ['本地图片，', '直接交给网页。'], texts: ['images 里写文件路径，素材会复制进运行包。'], images: ['./photo.jpg'], photoEffect: 'still' }, null, 2))
  files['组件与许可.txt'] = strToU8('React MIT；Swiper MIT；Paper Shaders Apache-2.0；Vanta MIT；three MIT；shadcn/ui & Radix MIT；Motion MIT；Recharts MIT；fflate MIT；Lucide ISC；React Bits MIT + Commons Clause（组件作为完整应用一部分打包，勿单独转售或再分发组件库）。\n阿里妈妈数黑体：阿里巴巴集团官方发布，免费可用于商业用途，woff2 随包本地加载，无外站字体依赖。\n源码与许可证见项目 THIRD_PARTY.md。\n')
  for (const [path, source] of [['许可证/React-Bits.txt', 'licenses/react-bits.txt'], ['许可证/shadcn.txt', 'licenses/shadcn.txt']]) {
    const license = await fetch(`${import.meta.env.BASE_URL}${source}`)
    if (!license.ok) throw new Error('缺少上游许可文件，未生成不完整的运行包')
    files[path] = new Uint8Array(await license.arrayBuffer())
  }
  const zipBytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)))
  return new Blob([zipBytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}
export async function importProjectZip(file: File) {
  const files = await unpack(new Uint8Array(await file.arrayBuffer()))
  if (!files['project.json']) throw new Error('压缩包中没有 project.json')
  const manifest = JSON.parse(strFromU8(files['project.json'])) as PortableManifest
  if (manifest.format !== 'flow-web' || manifest.version !== 2 || !Array.isArray(manifest.media)) throw new Error('不支持此运行包格式')
  const project = normalizeProject(manifest.project)
  const media: Media[] = manifest.media.map(m => {
    if (!m || typeof m.id !== 'string' || typeof m.path !== 'string' || typeof m.type !== 'string' || !/^(image|video)\//.test(m.type) || !files[m.path]) throw new Error('压缩包中有缺失或无效的媒体')
    return { id: m.id, name: m.name || m.id, type: m.type, blob: new Blob([files[m.path] as Uint8Array<ArrayBuffer>], { type: m.type }) }
  })
  if (referencedMedia(project).some(id => !media.some(m => m.id === id))) throw new Error('压缩包缺少页面引用的素材')
  return { project, media }
}
