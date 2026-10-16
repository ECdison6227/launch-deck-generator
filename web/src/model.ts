import presetData from './presets.json'
export type Composition = 'opening' | 'gallery' | 'editorial' | 'cinema' | 'chart' | 'outro' | 'table'
export const compositions: { value: Composition; label: string }[] = [
  { value: 'opening', label: '留白叙事' }, { value: 'gallery', label: '漂浮画廊' },
  { value: 'editorial', label: '图文并置' }, { value: 'cinema', label: '影像时刻' },
  { value: 'chart', label: '趋势图表' }, { value: 'outro', label: '结尾收束' }, { value: 'table', label: '信息对照' },
]
export interface Photo { id: string; mediaId: string }
export interface ChartSeries { id?: string; label: string; values: number[]; color?: string }
export interface SceneChart { categories: string[]; series: ChartSeries[] }
export type SceneFont = 'sans' | 'serif' | 'alimama' | 'georgia' | 'arial' | 'trebuchet' | 'verdana' | 'courier'
export interface Scene {
  id: string; name: string; presetId?: string; font?: SceneFont; textColor?: string; photoEffect?: 'float' | 'reveal' | 'still' | 'lift'; composition: Composition; headings: string[]; texts: string[]; photos: Photo[]
  footnote?: string; videoId?: string; posterId?: string; table?: string[][]; chart?: SceneChart; muted: boolean; loop: boolean
  motion: boolean; textEffect: 'fade' | 'blur' | 'focus' | 'drift'; material: 'glass' | 'paper'; fit: 'cover' | 'contain'; align: 'left' | 'center'
}
export function getSceneInk(scene: Pick<Scene, 'composition' | 'textColor'>) {
  const ink = scene.textColor || '#30384b'
  if (scene.composition !== 'outro') return ink
  const brightness = [0.2126, 0.7152, 0.0722].reduce((sum, weight, i) => sum + weight * parseInt(ink.slice(1 + i * 2, 3 + i * 2), 16), 0)
  return brightness < 128 ? '#f4f6fa' : ink
}
export type SlideTransition = 'creative' | 'fade' | 'cards'
export interface Project {
  id: string; schemaVersion: 2; name: string; scenes: Scene[]; selectedId: string; updatedAt: number
  background: { kind: BackgroundKind; colors: string[]; speed: number; paused: boolean; preset: string }
  transition: SlideTransition
}
export interface Media { id: string; name: string; blob: Blob; type: string; width?: number; height?: number; processed?: boolean }
export const limits = { scenes: 100, headings: 2, texts: 2, photos: 6, chartPoints: 12, chartSeries: 3 } as const
export type BackgroundKind = 'mesh' | 'grain' | 'clouds' | 'clouds2' | 'solid'
export const backgroundKinds: { id: BackgroundKind; label: string }[] = [
  { id: 'mesh', label: '流动渐变' }, { id: 'grain', label: '柔雾颗粒' }, { id: 'clouds', label: '云朵' }, { id: 'clouds2', label: '云朵 · 层次' }, { id: 'solid', label: '纯色素底' },
]
export interface Palette { id: string; label: string; kind: BackgroundKind; colors: string[]; ink: string; dark?: boolean }
export const palettes: Palette[] = [
  { id: 'dawn', label: '晨光', kind: 'mesh', colors: ['#e7eaf7', '#c9dcf1', '#f6e5df', '#e8dced'], ink: '#30384b' },
  { id: 'sage', label: '青屿', kind: 'mesh', colors: ['#e5eee6', '#bfd2c8', '#eee7d5', '#e1e9e5'], ink: '#2e4238' },
  { id: 'rose', label: '暮粉', kind: 'mesh', colors: ['#f3dce5', '#d9d6ed', '#f5e8dc', '#e7c9dc'], ink: '#50374b' },
  { id: 'blue', label: '晴空', kind: 'mesh', colors: ['#cee5f1', '#b4cde9', '#e9eff4', '#d2d4ed'], ink: '#2c3e5e' },
  { id: 'ink', label: '墨夜', kind: 'mesh', dark: true, colors: ['#171a26', '#232c44', '#2b2038', '#1a2233'], ink: '#eef0f8' },
  { id: 'abyss', label: '深海', kind: 'mesh', dark: true, colors: ['#101926', '#17324a', '#0f2a33', '#1c2440'], ink: '#e3edf4' },
  { id: 'ember', label: '余烬', kind: 'mesh', dark: true, colors: ['#1d1614', '#332018', '#2b1a26', '#241a18'], ink: '#f2e2d2' },
  { id: 'aurora', label: '极光', kind: 'grain', dark: true, colors: ['#0f0e18', '#3e6172', '#88ddae', '#5a4a8a'], ink: '#dff2e7' },
  { id: 'dune', label: '沙丘', kind: 'grain', colors: ['#f2ebe0', '#d9b98a', '#c4730b', '#8a5a3c'], ink: '#45321e' },
  { id: 'waves', label: '暖波', kind: 'grain', dark: true, colors: ['#0a0f10', '#c4730b', '#bdad5f', '#d8ccc7'], ink: '#f0e6d0' },
  { id: 'cumulus', label: '积云', kind: 'clouds', colors: ['#c8dcee', '#ffffff', '#7698c2', '#f4e9d2'], ink: '#2f3d55' },
  { id: 'dusk', label: '夕云', kind: 'clouds2', dark: true, colors: ['#2c2e4a', '#f2b58c', '#4a4068', '#f7d9a8'], ink: '#f5e9da' },
  { id: 'paper', label: '白纸', kind: 'solid', colors: ['#f6f5f1', '#f6f5f1', '#f6f5f1', '#f6f5f1'], ink: '#30384b' },
  { id: 'carbon', label: '纯黑', kind: 'solid', dark: true, colors: ['#0d0f14', '#0d0f14', '#0d0f14', '#0d0f14'], ink: '#eceff5' },
  { id: 'snow', label: '冷白', kind: 'solid', colors: ['#eef2f6', '#eef2f6', '#eef2f6', '#eef2f6'], ink: '#343d54' },
]
export const fontOptions: { id: SceneFont; label: string }[] = [
  { id: 'sans', label: '系统无衬线' }, { id: 'serif', label: '宋体' }, { id: 'alimama', label: '阿里妈妈数黑体' },
  { id: 'georgia', label: 'Georgia' }, { id: 'arial', label: 'Arial' }, { id: 'trebuchet', label: 'Trebuchet MS' },
  { id: 'verdana', label: 'Verdana' }, { id: 'courier', label: 'Courier New' },
]
export const transitions: { id: SlideTransition; label: string }[] = [
  { id: 'fade', label: '柔和淡入' }, { id: 'creative', label: '纵深漂移' }, { id: 'cards', label: '卡片推进' },
]
export const presets = presetData as { id: string; name: string; description: string; headings: number; texts: number; photos: number; composition: Composition; align: 'left' | 'center'; legacy?: boolean }[]
export const defaultChart: SceneChart = { categories: ['一月', '二月', '三月', '四月', '五月', '六月'], series: [{ label: '增长', values: [12, 18, 14, 26, 22, 34] }] }
export function scenePreset(scene: Partial<Scene>) {
  const known = presets.find(p => p.id === scene.presetId)
  if (known) return known
  const n = scene.photos?.length || 0
  const id = scene.videoId ? 'cinema' : scene.composition === 'table' ? 'table' : scene.composition === 'chart' ? 'chart-line' : scene.composition === 'outro' ? 'outro' : n >= 5 ? 'gallery' : n === 4 ? 'quartet' : n === 3 ? 'trio' : n === 2 ? ((scene.headings?.length || 0) > 1 ? 'duet' : 'pair') : n === 1 ? !(scene.headings?.length || scene.texts?.length) ? 'image' : (scene.texts?.length || 0) > 1 ? 'caption-story' : 'caption' : (scene.headings?.length || 0) > 1 ? 'statement' : (scene.texts?.length || 0) > 1 ? 'story' : 'title'
  return presets.find(p => p.id === id)!
}
export function applyPreset(scene: Scene, presetId: string): Scene {
  const preset = presets.find(p => p.id === presetId) || presets[0]
  const wasDefaultName = scene.name === scenePreset(scene).name
  return { ...scene, presetId: preset.id, composition: preset.composition, align: preset.align,
    name: wasDefaultName ? preset.name : scene.name,
    headings: Array.from({ length: preset.headings }, (_, i) => scene.headings[i] || (i ? '自然发生。' : '让想法，被看见。')),
    texts: Array.from({ length: preset.texts }, (_, i) => scene.texts[i] || '留一点空间，让内容自然发生。'),
    photos: scene.photos.slice(0, preset.photos), videoId: preset.composition === 'cinema' ? scene.videoId : undefined,
    chart: preset.composition === 'chart' ? (scene.chart || structuredClone(defaultChart)) : scene.chart,
    table: preset.composition === 'table' ? (scene.table || [['项目', '内容'], ['说明', '信息']]) : scene.table,
  }
}
export function newScene(presetId = 'title'): Scene {
  const base: Scene = { id: crypto.randomUUID(), name: '新的片刻', composition: 'opening', headings: [], texts: [], photos: [], muted: true, loop: true, motion: true, textEffect: 'fade', photoEffect: 'still', material: 'glass', fit: 'cover', align: 'left', font: 'sans', textColor: '#30384b' }
  return { ...applyPreset(base, presetId), name: presets.find(p => p.id === presetId)?.name || '新的片刻' }
}
const photos = (...ids: string[]) => ids.map(mediaId => ({ id: crypto.randomUUID(), mediaId }))
export function seedProject(): Project {
  const first = { ...newScene('trio'), name: '自然发生', headings: ['让灵感，', '自然发生。'], texts: ['不用把想法装进方框。', '用流动的色彩、文字和影像，讲述你的下一次发布。'], photos: photos('alpine', 'ocean', 'botanical') }
  const second = { ...newScene('gallery'), name: '六个瞬间', headings: ['从山海之间，收集灵感。'], texts: ['海浪、林间与晨雾。把看见的美好，带进下一次表达。'], photos: photos('ocean', 'woodland', 'alpine', 'botanical', 'dunes', 'hills') }
  const third = { ...newScene('duet'), name: '留一点呼吸', headings: ['少一点束缚，', '多一点表达。'], texts: ['一段文字，一张照片。', '把注意力留给真正重要的内容。'], photos: photos('ocean', 'alpine') }
  const fourth = { ...newScene('cinema'), name: '让故事流动', headings: ['让故事，自己流动。'], texts: ['有些美好，适合用一段影像讲述。'], videoId: 'flower' }
  const cumulus = palettes.find(p => p.id === 'cumulus')!
  return { id: 'current', schemaVersion: 2, name: '一场自然发生的发布', scenes: [first, second, third, fourth], selectedId: first.id, updatedAt: Date.now(), background: { kind: cumulus.kind, colors: cumulus.colors, speed: 0.18, paused: false, preset: 'cumulus' }, transition: 'fade' }
}
const strings = (value: unknown, count: number, length: number): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, count).map(v => v.slice(0, length)) : []
const numbers = (value: unknown, count: number): number[] => Array.isArray(value) ? value.map(v => Number(v)).filter(v => Number.isFinite(v)).slice(0, count) : []
export function normalizeChart(input: unknown): SceneChart | undefined {
  if (input == null) return undefined
  const chart = input as Partial<SceneChart>
  const categories = strings(chart.categories, limits.chartPoints, 12)
  const series = (Array.isArray(chart.series) ? chart.series : []).slice(0, limits.chartSeries).map((s, i) => ({
    // 内部 dataKey 使用稳定 id + index，同名系列或叫 name 的系列不会互相覆盖。
    id: `series-${i}`,
    label: typeof s?.label === 'string' ? s.label.slice(0, 20) : `系列 ${i + 1}`,
    values: numbers(s?.values, limits.chartPoints),
    color: typeof s?.color === 'string' && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : undefined,
  })).filter(s => s.values.length)
  if (!categories.length && !series.length) return undefined
  const width = Math.min(categories.length || series[0]?.values.length || 0, limits.chartPoints)
  return { categories: categories.slice(0, width), series: series.map(s => ({ ...s, values: s.values.slice(0, width) })) }
}
export function normalizeScene(input: Partial<Scene>): Scene {
  const base = newScene()
  const preset = scenePreset(input)
  return { ...base, presetId: preset.id, font: fontOptions.some(f => f.id === input.font) ? input.font : 'sans', textColor: /^#[0-9a-f]{6}$/i.test(input.textColor || '') ? input.textColor : '#30384b', photoEffect: ['float', 'reveal', 'still', 'lift'].includes(input.photoEffect || '') ? input.photoEffect! : 'still', id: typeof input.id === 'string' ? input.id : base.id, name: typeof input.name === 'string' ? input.name.slice(0, 60) : base.name,
    composition: preset.composition,
    headings: Array.from({ length: preset.headings }, (_, i) => strings(input.headings, 2, 72)[i] || ''), texts: Array.from({ length: preset.texts }, (_, i) => strings(input.texts, 2, 180)[i] || ''),
    footnote: typeof input.footnote === 'string' && input.footnote.trim() ? input.footnote.slice(0, 120) : undefined,
    photos: Array.isArray(input.photos) ? input.photos.filter(p => p && typeof p.id === 'string' && typeof p.mediaId === 'string').slice(0, preset.photos).map(p => ({ id: p.id, mediaId: p.mediaId })) : [],
    videoId: typeof input.videoId === 'string' ? input.videoId : undefined, posterId: typeof input.posterId === 'string' ? input.posterId : undefined,
    table: Array.isArray(input.table) ? input.table.slice(0, 7).map(row => strings(row, 5, 40)) : undefined,
    chart: normalizeChart(input.chart) ?? (preset.composition === 'chart' ? structuredClone(defaultChart) : undefined),
    muted: input.muted !== false, loop: input.loop !== false, motion: input.motion !== false,
    textEffect: ['fade', 'blur', 'focus', 'drift'].includes(input.textEffect || '') ? input.textEffect! : 'fade',
    material: input.material === 'paper' ? 'paper' : 'glass', fit: preset.id === 'image' ? 'contain' : 'cover', align: preset.align,
  }
}
export function normalizeProject(input: unknown): Project {
  const value = input as Project
  if (!value || value.schemaVersion !== 2 || !Array.isArray(value.scenes) || !value.scenes.length || value.scenes.length > limits.scenes) throw new Error('这不是有效的流光运行包')
  const scenes = value.scenes.map(normalizeScene)
  if (new Set(scenes.map(s => s.id)).size !== scenes.length) throw new Error('运行包中的页面标识重复')
  const kind: BackgroundKind = backgroundKinds.some(k => k.id === value.background?.kind) ? value.background!.kind : 'mesh'
  const transition: SlideTransition = ['creative', 'fade', 'cards'].includes(value.transition || '') ? value.transition : 'fade'
  return { id: 'current', schemaVersion: 2, name: typeof value.name === 'string' ? value.name.slice(0, 60) : '我的流动网页', scenes,
    selectedId: scenes.some(s => s.id === value.selectedId) ? value.selectedId : scenes[0].id, updatedAt: Date.now(),
    background: { kind, colors: value.background?.colors?.length === 4 && value.background.colors.every(c => /^#[0-9a-f]{6}$/i.test(c)) ? value.background.colors : palettes[0].colors,
      speed: Math.max(0, Math.min(1, Number(value.background?.speed) || 0)), paused: Boolean(value.background?.paused), preset: typeof value.background?.preset === 'string' ? value.background.preset : 'custom' },
    transition,
  }
}
export function referencedMedia(project: Project) {
  return [...new Set(project.scenes.flatMap(s => [...s.photos.map(p => p.mediaId), s.videoId, s.posterId]).filter((id): id is string => Boolean(id)))]
}
