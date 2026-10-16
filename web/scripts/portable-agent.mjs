import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(fileURLToPath(import.meta.url))
const [command = 'inspect', ...args] = process.argv.slice(2)
const presets = JSON.parse(await readFile(resolve(root, 'presets.json'), 'utf8')).filter(p => !p.legacy)
if (command === 'presets') { console.log(JSON.stringify(presets, null, 2)); process.exit(0) }
const path = resolve(root, 'project.json')
const manifest = JSON.parse(await readFile(path, 'utf8'))
const formats = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' }
const defaultScene = preset => ({ id: randomUUID(), name: preset.name, composition: preset.composition, headings: [], texts: [], photos: [], muted: true, loop: true, motion: true, textEffect: 'fade', photoEffect: 'still', material: 'glass', fit: 'cover', align: preset.align, font: 'sans', textColor: '#30384b' })
const defaultChart = { categories: ['一月', '二月', '三月', '四月', '五月', '六月'], series: [{ label: '增长', values: [12, 18, 14, 26, 22, 34] }] }
if (command === 'inspect') { console.log(JSON.stringify({ name: manifest.project.name, background: manifest.project.background, transition: manifest.project.transition, scenes: manifest.project.scenes.map((s, i) => ({ scene: i + 1, ...s })) }, null, 2)); process.exit(0) }
if ((command !== 'apply' && command !== 'add') || !args[0]) throw new Error('用法：node agent.mjs inspect | presets | apply patch.json | add patch.json')
const patch = JSON.parse(await readFile(resolve(process.cwd(), args[0]), 'utf8'))
const project = manifest.project
const hex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)
const patchDir = dirname(resolve(process.cwd(), args[0]))
const warnings = []
const bring = async (source, want) => {
  const file = resolve(patchDir, source)
  const type = formats[extname(file).toLowerCase()]
  if (!type || !type.startsWith(`${want}/`)) throw new Error(`${source} 不是受支持的${want === 'image' ? '图片' : '视频'}格式（jpg/png/webp/gif/mp4/webm/mov）`)
  const ext = extname(file).toLowerCase().replace('.jpeg', '.jpg')
  const id = randomUUID().slice(0, 8)
  const target = `media/${encodeURIComponent(id)}${ext}`
  await mkdir(resolve(root, 'media'), { recursive: true })
  await copyFile(file, resolve(root, target))
  manifest.media.push({ id, name: basename(file), type, path: target })
  return id
}
if (patch.transition !== undefined) {
  if (!['creative', 'fade', 'cards'].includes(patch.transition)) throw new Error('transition 需为 creative / fade / cards')
  project.transition = patch.transition
}
if (patch.background) {
  const bg = patch.background
  if (bg.kind && !['mesh', 'grain', 'clouds', 'clouds2', 'solid'].includes(bg.kind)) throw new Error('background.kind 需为 mesh / grain / clouds / clouds2 / solid')
  if (bg.colors && (!Array.isArray(bg.colors) || bg.colors.length !== 4 || !bg.colors.every(hex))) throw new Error('background.colors 需要4个Hex颜色')
  project.background = { ...project.background, ...bg, speed: Math.max(0, Math.min(1, bg.speed ?? project.background.speed)) }
}
const sceneKeys = ['headings', 'texts', 'footnote', 'chart', 'images', 'video', 'textColor', 'font', 'textEffect', 'photoEffect', 'motion', 'name']
if (command === 'apply' && !patch.scene && sceneKeys.some(k => patch[k] !== undefined)) throw new Error('apply 需要配合一个从 1 开始的 scene 编号；新建一屏请使用 add；只改全局背景/转场可不写 scene')
if (command === 'add' || patch.scene) {
  const creating = command === 'add'
  const scene = creating ? null : project.scenes[patch.scene - 1]
  if (!creating && !scene) throw new Error('scene 使用从1开始的编号')
  const presetId = patch.presetId || scene?.presetId
  const preset = presets.find(p => p.id === presetId)
  if (!preset) throw new Error('presetId 无效或该预设没有足够的槽位，请先运行 presets')
  const isCinema = preset.composition === 'cinema'
  if (patch.video && patch.presetId && !isCinema) throw new Error('视频只支持影像类预设，请先运行 presets 查看')
  const finalPreset = patch.video && !patch.presetId && !isCinema ? presets.find(p => p.id === 'cinema') : preset
  const target = creating ? defaultScene(finalPreset) : scene
  target.presetId = finalPreset.id; target.composition = finalPreset.composition; target.align = finalPreset.align
  for (const [key, count, length] of [['headings', finalPreset.headings, 72], ['texts', finalPreset.texts, 180]]) {
    const input = patch[key] || target[key]
    target[key] = Array.from({ length: count }, (_, i) => typeof input?.[i] === 'string' ? input[i].slice(0, length) : '')
  }
  if (typeof patch.name === 'string') target.name = patch.name.slice(0, 60)
  if (typeof patch.footnote === 'string') { const note = patch.footnote.slice(0, 120); if (note.trim()) target.footnote = note; else delete target.footnote }
  if (patch.chart !== undefined) {
    if (finalPreset.composition !== 'chart') throw new Error('chart 只支持图表类预设（chart-line / chart-full）')
    const categories = (patch.chart.categories || []).filter(c => typeof c === 'string').slice(0, 12).map(c => c.slice(0, 12))
    const series = (patch.chart.series || []).slice(0, 3).map((s, i) => ({
      label: typeof s.label === 'string' ? s.label.slice(0, 20) : `系列 ${i + 1}`,
      values: (Array.isArray(s.values) ? s.values : []).map(Number).filter(Number.isFinite).slice(0, 12),
      color: hex(s.color) ? s.color : undefined,
    })).filter(s => s.values.length)
    if (!categories.length || !series.length) throw new Error('chart 需要 categories 与至少一个带数据的 series')
    const width = Math.min(categories.length, ...series.map(s => s.values.length))
    target.chart = { categories: categories.slice(0, width), series: series.map(s => ({ ...s, values: s.values.slice(0, width) })) }
  } else if (finalPreset.composition === 'chart' && !target.chart) target.chart = JSON.parse(JSON.stringify(defaultChart))
  let added = 0
  for (const source of patch.images || []) {
    const mediaId = await bring(source, 'image')
    target.photos.push({ id: randomUUID(), mediaId }); added++
  }
  const before = target.photos.length - added
  if (target.photos.length > finalPreset.photos) warnings.push(`图片超出预设 ${finalPreset.photos} 张的限制，已采用前 ${Math.max(0, finalPreset.photos - before)} 张`)
  target.photos = target.photos.slice(0, finalPreset.photos)
  if (patch.video) target.videoId = await bring(patch.video, 'video')
  if (!isCinema && !patch.video && finalPreset.composition !== 'cinema') delete target.videoId
  if (patch.textColor) { if (!hex(patch.textColor)) throw new Error('textColor 需要Hex颜色'); target.textColor = patch.textColor }
  for (const [key, allowed] of [['font',['sans','serif','alimama','georgia','arial','trebuchet','verdana','courier']],['textEffect',['fade','blur','focus','drift']],['photoEffect',['float','reveal','still','lift']]]) {
    if (patch[key] !== undefined) { if (!allowed.includes(patch[key])) throw new Error(`${key} 不在预设范围内`); target[key] = patch[key] }
  }
  if (typeof patch.motion === 'boolean') target.motion = patch.motion
  if (creating) project.scenes.push(target)
  project.selectedId = target.id
}
await copyFile(path, resolve(root, 'project.before-agent.json'))
project.updatedAt = Date.now()
await writeFile(path, JSON.stringify(manifest, null, 2) + '\n')
for (const warning of warnings) console.warn(`提醒：${warning}`)
console.log('已应用配置，旧内容保存在 project.before-agent.json。刷新浏览器即可看到结果。')
