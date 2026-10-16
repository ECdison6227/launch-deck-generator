import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Copy, Download, Film, FolderOpen, ImagePlus, LoaderCircle, Maximize, Minimize, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Toaster } from '@/components/ui/sonner'
import { Experience, pauseMedia, type ExperienceHandle } from './Experience'
import { db, loadProject, pruneUnusedMedia } from './storage'
import { applyPreset, backgroundKinds, fontOptions, limits, presets, scenePreset, newScene, normalizeScene, palettes, type Project, type Scene, type Media } from './model'
import type { AgentImage, FlowAgent, ScenePatch } from './agent-api'
import { exportProjectZip, importProjectZip } from './archive'
import './App.css'

type UploadTarget = { sceneId: string; kind: 'photo' | 'video' | 'poster'; replaceId?: string }
const inkSwatches = ['#30384b', '#f4f6fa', '#e9e2d4', '#ffd166', '#5a7db8', '#b85a6e', '#38435c', '#70798c']
export default function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [editing, setEditing] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [tab, setTab] = useState('content')
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saved')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [retry, setRetry] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [presetOpen, setPresetOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [chosenPreset, setChosenPreset] = useState('title')
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const experience = useRef<ExperienceHandle>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<UploadTarget | null>(null)
  const projectRef = useRef(project)
  const urlsRef = useRef(urls)
  const editingRef = useRef(editing)
  const saveQueue = useRef(Promise.resolve())
  const saveVersion = useRef(0)
  useEffect(() => { projectRef.current = project; urlsRef.current = urls; editingRef.current = editing }, [project, urls, editing])
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const loaded = await loadProject(); const media = await db.media.toArray()
        if (!active) return
        setUrls(Object.fromEntries(media.map(m => [m.id, URL.createObjectURL(m.blob)])))
        setProject(loaded); setActiveIndex(Math.max(0, loaded.scenes.findIndex(s => s.id === loaded.selectedId))); setLoadError('')
      } catch (error) { if (active) setLoadError(String(error)) }
    })()
    return () => { active = false }
  }, [retry])
  useEffect(() => () => { Object.values(urlsRef.current).forEach(URL.revokeObjectURL) }, [])
  useEffect(() => {
    if (!project) return
    const version = ++saveVersion.current
    // IndexedDB 事务开始与完成时显示真实保存状态。
    // oxlint-disable-next-line react/set-state-in-effect
    setSaveState('saving')
    saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
      try {
        await db.projects.put(project)
        // 保存成功后回收未再被项目或任何备份引用的媒体，替换素材不再积累。
        await pruneUnusedMedia().catch(() => 0)
        if (version === saveVersion.current) { setSaveState('saved'); setSaveError('') }
      }
      catch (error) { if (version === saveVersion.current) { setSaveState('error'); setSaveError(String(error)) } }
    })
  }, [project])
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (saveState !== 'saved' || loading) { event.preventDefault(); event.returnValue = '' } }
    const exitKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && document.fullscreenElement) { event.preventDefault(); void document.exitFullscreen() } }
    document.addEventListener('keydown', exitKey, true)
    const fullChanged = () => { setFullscreen(Boolean(document.fullscreenElement)); if (!document.fullscreenElement) pauseMedia() }
    window.addEventListener('beforeunload', beforeUnload); document.addEventListener('fullscreenchange', fullChanged)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('fullscreenchange', fullChanged); document.removeEventListener('keydown', exitKey, true) }
  }, [saveState, loading])
  const update = useCallback((change: (project: Project) => Project) => setProject(p => p ? { ...change(p), updatedAt: Date.now() } : p), [])
  const patch = useCallback((id: string, changes: Partial<Scene>) => update(p => ({ ...p, scenes: p.scenes.map(s => s.id === id ? normalizeScene({ ...s, ...changes }) : s) })), [update])
  const scene = project?.scenes[activeIndex]
  const currentPreset = scene ? scenePreset(scene) : presets[0]
  const edit = (changes: Partial<Scene>) => { if (scene) patch(scene.id, changes) }
  const changeIndex = useCallback((index: number) => {
    setActiveIndex(index); update(p => p.scenes[index] ? { ...p, selectedId: p.scenes[index].id } : p)
  }, [update])
  const importMedia = useCallback(async (files: File[], target: UploadTarget) => {
    const current = projectRef.current?.scenes.find(s => s.id === target.sceneId)
    if (!current) return
    const accepted = files.filter(file => target.kind === 'video' ? file.type.startsWith('video/') : file.type.startsWith('image/'))
    const capacity = target.kind === 'photo' && !target.replaceId ? scenePreset(current).photos - current.photos.length : 1
    if (capacity <= 0) { toast.info(`当前版式有 ${scenePreset(current).photos} 个图片位；换个版式可以放更多`) ; return }
    const chosen = accepted.slice(0, capacity)
    if (!chosen.length) { toast.error('请选择支持的图片或视频文件'); return }
    if (accepted.length > chosen.length) toast.info('已按当前版式的图片位数量添加')
    setLoading(true)
    try {
      const media = chosen.map(file => ({ id: crypto.randomUUID(), name: file.name || '粘贴图片', type: file.type, blob: file }))
      await db.media.bulkPut(media)
      setUrls(urls => ({ ...urls, ...Object.fromEntries(media.map(m => [m.id, URL.createObjectURL(m.blob)])) }))
      update(p => ({ ...p, scenes: p.scenes.map(s => {
        if (s.id !== target.sceneId) return s
        if (target.kind !== 'photo') return { ...s, [target.kind === 'video' ? 'videoId' : 'posterId']: media[0].id, composition: target.kind === 'video' ? 'cinema' : s.composition }
        const photos = target.replaceId ? s.photos.map(photo => photo.id === target.replaceId ? { ...photo, mediaId: media[0].id } : photo) : [...s.photos, ...media.map(m => ({ id: crypto.randomUUID(), mediaId: m.id }))].slice(0, scenePreset(s).photos)
        return { ...s, photos }
      }) }))
      toast.success(target.kind === 'video' ? '视频已加入' : target.kind === 'poster' ? '封面已更新' : `已加入 ${media.length} 张图片`)
    } catch (error) { toast.error(`素材保存失败，当前内容仍保留：${String(error)}`) }
    finally { setLoading(false) }
  }, [update])
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (document.querySelector('[role=alertdialog]')) return
      const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'))
      const project = projectRef.current
      const scene = project?.scenes.find(s => s.id === project.selectedId)
      if (files.length && scene) { event.preventDefault(); void importMedia(files, { sceneId: scene.id, kind: 'photo' }) }
    }
    document.addEventListener('paste', paste); return () => document.removeEventListener('paste', paste)
  }, [importMedia])
  useEffect(() => {
    // 所有 agent 写入都进同一条 saveQueue，避免与编辑器保存互相覆盖。
    const commit = (change: (project: Project) => Project) => {
      const run = saveQueue.current.catch(() => {}).then(async () => {
        const current = projectRef.current
        if (!current) throw new Error('项目还未打开')
        const next = { ...change(current), updatedAt: Date.now() }
        await db.projects.put({ ...current, id: 'before-agent-backup' })
        await db.projects.put(next); projectRef.current = next; setProject(next)
        return structuredClone(next)
      })
      saveQueue.current = run.then(() => {}, () => {})
      return run
    }
    const fromDataUrl = (input: string | AgentImage, kind: 'image' | 'video'): Media => {
      const raw = typeof input === 'string' ? input : input.dataUrl
      const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(raw)
      if (!match) throw new Error('素材需为 base64 形式的 data URL')
      const type = match[1].toLowerCase()
      if (!type.startsWith(`${kind}/`)) throw new Error(kind === 'image' ? 'images 里需要图片类型的 data URL' : 'video 需要视频类型的 data URL')
      const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0))
      if (!bytes.length) throw new Error('素材内容为空')
      return { id: crypto.randomUUID(), name: (typeof input === 'string' ? undefined : input.name) || (kind === 'image' ? '交给网页的图片' : '交给网页的视频'), type, blob: new Blob([bytes], { type }) }
    }
    const applyTo = async (payload: ScenePatch | Omit<ScenePatch, 'scene'>, sceneNumber?: number) => {
      if (payload.presetId && !presets.some(p => p.id === payload.presetId && !p.legacy)) throw new Error('预设不存在')
      if (payload.textColor && !/^#[0-9a-f]{6}$/i.test(payload.textColor)) throw new Error('文字颜色需为六位 Hex')
      const photos = (payload.images || []).map(input => fromDataUrl(input, 'image'))
      const clip = payload.video ? fromDataUrl(payload.video, 'video') : null
      if (clip && payload.presetId && presets.find(p => p.id === payload.presetId)?.composition !== 'cinema') throw new Error('视频需要影像类预设（影像时刻 / 影像主张 / 纯影像）')
      const presetId = clip && !payload.presetId ? 'cinema' : payload.presetId
      if (photos.length || clip) {
        const media = clip ? [...photos, clip] : photos
        await db.media.bulkPut(media)
        setUrls(current => ({ ...current, ...Object.fromEntries(media.map(m => [m.id, URL.createObjectURL(m.blob)])) }))
      }
      const counters = { addedImages: 0, ignoredImages: 0 }
      const project = await commit(current => {
        const creating = sceneNumber === undefined
        if (creating && current.scenes.length >= limits.scenes) throw new Error(`最多 ${limits.scenes} 屏；先合并或删除一些场景`)
        const index = creating ? current.scenes.length : (sceneNumber as number) - 1
        const scene = creating ? newScene(presetId || 'title') : current.scenes[index]
        if (!scene) throw new Error('scene 使用从 1 开始的场景编号；新建一屏请使用 addScene')
        const base = !creating && payload.presetId ? applyPreset(scene, payload.presetId) : scene
        const preset = scenePreset(base)
        const merged = [...base.photos, ...photos.map(m => ({ id: crypto.randomUUID(), mediaId: m.id }))].slice(0, preset.photos)
        counters.addedImages = merged.length - base.photos.length
        counters.ignoredImages = photos.length - counters.addedImages
        const allowed = Object.fromEntries(Object.entries(payload).filter(([key]) => ['name', 'headings', 'texts', 'footnote', 'font', 'textColor', 'textEffect', 'photoEffect', 'motion', 'chart'].includes(key)))
        const updated = normalizeScene({ ...base, ...allowed, photos: merged, videoId: clip ? clip.id : base.videoId, composition: clip ? 'cinema' : base.composition })
        const scenes = creating ? [...current.scenes, updated] : current.scenes.map((s, i) => i === index ? updated : s)
        return { ...current, selectedId: updated.id, scenes }
      })
      setActiveIndex(project.scenes.findIndex(s => s.id === project.selectedId))
      return { project, scene: project.scenes.findIndex(s => s.id === project.selectedId) + 1, ...counters }
    }
    const api: FlowAgent = {
      inspect: () => projectRef.current ? structuredClone(projectRef.current) : null,
      listPresets: () => structuredClone(presets.filter(p => !p.legacy)),
      apply: payload => applyTo(payload, payload.scene),
      addScene: payload => applyTo(payload),
      setBackground: async payload => commit(current => {
        const palette = palettes.find(p => p.id === payload.preset)
        const kind = payload.kind || palette?.kind || current.background.kind
        if (payload.kind && !backgroundKinds.some(k => k.id === payload.kind)) throw new Error('背景样式需为 mesh / grain / clouds / clouds2 / solid')
        const colors = payload.colors || palette?.colors || current.background.colors
        if (colors.length !== 4 || colors.some(c => !/^#[0-9a-f]{6}$/i.test(c))) throw new Error('背景需要四个有效 Hex 颜色')
        return { ...current, background: { ...current.background, ...payload, kind, preset: palette && !payload.colors ? payload.preset as string : (payload.preset || current.background.preset), colors, speed: Math.max(0, Math.min(1, payload.speed ?? current.background.speed)) },
          scenes: palette ? current.scenes.map(s => ({ ...s, textColor: palette.ink })) : current.scenes }
      }),
      setTransition: async transition => {
        if (!['creative', 'fade', 'cards'].includes(transition)) throw new Error('转场需为 creative / fade / cards')
        return commit(current => ({ ...current, transition }))
      },
    }
    window.flowAgent = api
    return () => { if (window.flowAgent === api) delete window.flowAgent }
  }, [])
  const chooseMedia = (kind: UploadTarget['kind'], replaceId?: string) => {
    if (!scene || !uploadRef.current) return
    targetRef.current = { sceneId: scene.id, kind, replaceId }
    uploadRef.current.accept = kind === 'video' ? 'video/*' : 'image/*'; uploadRef.current.multiple = kind === 'photo' && !replaceId; uploadRef.current.click()
  }
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else { setEditing(false); void rootRef.current?.requestFullscreen().catch(() => toast.info('浏览器未允许全屏，仍可窗口播放')) }
  }
  const openPresets = (create: boolean) => { setCreating(create); setChosenPreset(create ? 'title' : currentPreset.id); setPresetOpen(true) }
  const addScene = () => openPresets(true)
  const applyChosenPreset = async () => {
    if (!project || !scene) return
    if (creating) {
      if (project.scenes.length >= limits.scenes) { toast.info(`已到 ${limits.scenes} 屏上限`); return }
      const created = newScene(chosenPreset); const index = activeIndex + 1
      update(p => { const scenes = [...p.scenes]; scenes.splice(index, 0, created); return { ...p, scenes, selectedId: created.id } }); setActiveIndex(index)
    } else {
      try { await db.projects.put({ ...project, id: 'before-preset-backup' }); edit(applyPreset(scene, chosenPreset)) }
      catch (error) { toast.error(`备份未成功，当前内容未改动：${String(error)}`); return }
    }
    setPresetOpen(false); setEditing(true); setTab('content')
  }
  const duplicate = () => {
    if (!scene || !project) return
    if (project.scenes.length >= limits.scenes) { toast.info(`已到 ${limits.scenes} 屏上限`); return }
    const created = { ...structuredClone(scene), id: crypto.randomUUID(), name: `${scene.name} · 副本`, photos: scene.photos.map(p => ({ ...p, id: crypto.randomUUID() })) }
    update(p => { const scenes = [...p.scenes]; scenes.splice(activeIndex + 1, 0, created); return { ...p, scenes, selectedId: created.id } }); setActiveIndex(i => i + 1)
  }
  const move = (direction: number) => {
    if (!project || activeIndex + direction < 0 || activeIndex + direction >= project.scenes.length) return
    update(p => { const scenes = [...p.scenes]; [scenes[activeIndex], scenes[activeIndex + direction]] = [scenes[activeIndex + direction], scenes[activeIndex]]; return { ...p, scenes } }); setActiveIndex(i => i + direction)
  }
  const remove = () => {
    if (!project || project.scenes.length <= 1) return
    const index = Math.max(0, activeIndex - 1)
    update(p => { const scenes = p.scenes.filter(s => s.id !== scene?.id); return { ...p, scenes, selectedId: scenes[index].id } }); setActiveIndex(index); setDeleteOpen(false)
  }
  const exportZip = async () => {
    if (!project) return
    setExporting(true)
    try {
      const blob = await exportProjectZip(project, await db.media.toArray())
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${project.name.replace(/[\\/:*?"<>|]/g, '-') || '流光'}.zip`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 60000)
      toast.success('运行包已下载，图片和视频一起带走')
    } catch (error) { toast.error(`打包未完成：${String(error)}`) }
    finally { setExporting(false) }
  }
  const acceptImport = async () => {
    if (!pendingImport) return
    const file = pendingImport; setPendingImport(null); setLoading(true)
    try {
      const imported = await importProjectZip(file)
      await saveQueue.current
      await db.transaction('rw', db.projects, db.media, async () => {
        if (projectRef.current) await db.projects.put({ ...projectRef.current, id: 'before-import-backup' })
        await db.media.bulkPut(imported.media); await db.projects.put(imported.project)
      })
      pauseMedia(); setUrls(old => { Object.values(old).forEach(URL.revokeObjectURL); return Object.fromEntries(imported.media.map(m => [m.id, URL.createObjectURL(m.blob)])) }); setProject(imported.project); setActiveIndex(Math.max(0, imported.project.scenes.findIndex(s => s.id === imported.project.selectedId))); setEditing(false); toast.success('运行包已打开，可以继续编辑')
    } catch (error) { toast.error(`导入失败，当前项目保留：${String(error)}`) }
    finally { setLoading(false) }
  }
  const field = (label: string, children: ReactNode) => <div className="editor-field"><Label>{label}</Label>{children}</div>
  const select = (label: string, value: string, options: { value: string; label: string }[], onChange: (value: string) => void) => field(label, <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>)
  const toggle = (label: string, checked: boolean, onCheckedChange: (value: boolean) => void) => <div className="editor-toggle"><Label>{label}</Label><Switch aria-label={label} checked={checked} onCheckedChange={onCheckedChange} /></div>
  if (!project || !scene) return <div className="flow-loading"><Card><CardContent><Sparkles size={25} /><h1>让灵感，自然发生。</h1>{loadError ? <><p>{loadError}</p><Button onClick={() => setRetry(n => n + 1)}>重新读取</Button></> : <p>正在打开你的流动网页…</p>}</CardContent></Card></div>
  return <div className={`flow-app ${editing ? 'is-editing' : ''} ${fullscreen ? 'is-fullscreen' : ''}`} ref={rootRef}>
    <Experience project={project} urls={urls} activeIndex={activeIndex} onIndexChange={changeIndex} editing={editing} ref={experience} keyboard={!deleteOpen && !pendingImport && !presetOpen} />
    <header className="flow-topbar"><div className="flow-identity"><span className="project-caption">{project.name}</span><span role="status" className={`flow-save save-${saveState}`}>{saveState === 'saved' && <Check size={12} />}{saveState === 'saved' ? '已保存' : saveState === 'saving' ? '保存中' : '未保存'}</span></div><div className="flow-actions">{!fullscreen && <><Button variant="ghost" size="icon" aria-label="打开运行包" title="打开运行包" disabled={loading} onClick={() => importRef.current?.click()}><FolderOpen size={17} /></Button><Button variant="ghost" className="edit-button" onClick={() => setEditing(e => !e)}><Pencil size={14} />{editing ? '收起编辑' : '编辑当前屏'}</Button><Button variant="outline" onClick={() => void exportZip()} disabled={exporting || loading}>{exporting ? <LoaderCircle className="animate-spin" size={14} /> : <Download size={14} />}{exporting ? '正在打包' : '打包带走'}</Button></>}<Button className="play-button" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}{fullscreen ? '退出全屏' : '全屏播放'}</Button></div></header>
    {saveState === 'error' && <Alert className="flow-save-alert" variant="destructive"><AlertTitle>保存失败，当前内容仍保留</AlertTitle><AlertDescription>{saveError}<Button variant="outline" size="sm" onClick={() => setProject(p => p ? { ...p, updatedAt: Date.now() } : p)}>重试保存</Button></AlertDescription></Alert>}
    <footer className="flow-bottom"><span /><nav className="scene-dock" aria-label="场景导航"><Button size="icon" variant="ghost" aria-label="上一屏" onClick={() => experience.current?.previous()} disabled={activeIndex === 0}><ArrowLeft size={16} /></Button><div className="scene-chips">{project.scenes.map((s, index) => <Button variant="ghost" className={`scene-chip ${index === activeIndex ? 'active' : ''}`} key={s.id} aria-label={`第 ${index + 1} 屏：${s.name}`} aria-current={index === activeIndex ? 'page' : undefined} onClick={() => changeIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span>{index === activeIndex && <span className="active-scene-name">{s.name}</span>}</Button>)}</div><Button size="icon" variant="ghost" aria-label="下一屏" onClick={() => experience.current?.next()} disabled={activeIndex === project.scenes.length - 1}><ArrowRight size={16} /></Button>{!fullscreen && <><span className="dock-separator" /><Button size="icon" variant="ghost" aria-label="添加一屏" title="添加一屏" onClick={addScene}><Plus size={17} /></Button></>}</nav><span className="flow-key-hint">滚轮 / 方向键，去下一屏</span></footer>
    <Sheet modal={false} open={editing} onOpenChange={setEditing}><SheetContent className="flow-editor" onInteractOutside={event => event.preventDefault()}><SheetHeader><div className="editor-eyebrow">第 {String(activeIndex + 1).padStart(2, '0')} 屏</div><SheetTitle>让它成为你的表达</SheetTitle><SheetDescription>改好内容，收起即可播放。</SheetDescription></SheetHeader><Tabs value={tab} onValueChange={setTab}><TabsList className="flow-editor-tabs"><TabsTrigger value="content">内容</TabsTrigger><TabsTrigger value="atmosphere">氛围</TabsTrigger><TabsTrigger value="motion">灵动</TabsTrigger></TabsList><ScrollArea className="flow-editor-scroll"><div className="flow-editor-content"><TabsContent value="content">
      {field('这一屏的名字', <Input aria-label="场景名称" value={scene.name} maxLength={28} onChange={e => edit({ name: e.target.value })} />)}
      <div className="preset-summary"><div><span>当前版式</span><strong>{currentPreset.name}</strong></div><Button variant="outline" size="sm" onClick={() => openPresets(false)}>换个版式</Button></div>
      {currentPreset.headings > 0 && <><div className="editor-group-title"><span>主标题</span><span>{currentPreset.headings} 个固定位置</span></div>{scene.headings.map((text, index) => <div className="text-slot" key={index}><Textarea aria-label={`主标题 ${index + 1}`} value={text} maxLength={72} rows={2} placeholder="写一句重要的话" onChange={e => edit({ headings: scene.headings.map((t, i) => index === i ? e.target.value : t) })} /></div>)}</>}
      {currentPreset.texts > 0 && <><div className="editor-group-title"><span>小文本</span><span>{currentPreset.texts} 个固定位置</span></div>{scene.texts.map((text, index) => <div className="text-slot" key={index}><Textarea aria-label={`小文本 ${index + 1}`} value={text} maxLength={180} rows={2} onChange={e => edit({ texts: scene.texts.map((t, i) => i === index ? e.target.value : t) })} /></div>)}</>}
      {field('脚注（可选）', <Input aria-label="脚注" value={scene.footnote || ''} maxLength={120} placeholder="比如：数据截至 2026 年 · 内部资料" onChange={e => edit({ footnote: e.target.value })} />)}
      {currentPreset.composition === 'chart' && scene.chart && <div className="chart-editor"><div className="editor-group-title"><span>折线图</span><span>最多 12 个点</span></div>
        {field('系列名称', <Input aria-label="系列名称" value={scene.chart.series[0]?.label || ''} maxLength={20} onChange={e => edit({ chart: { ...scene.chart!, series: scene.chart!.series.map((s, i) => i === 0 ? { ...s, label: e.target.value } : s) } })} />)}
        <div className="chart-points">{scene.chart.categories.map((category, index) => <div className={`chart-point row-${index}`} key={index}><Input aria-label={`分类 ${index + 1}`} value={category} maxLength={12} onChange={e => edit({ chart: { ...scene.chart!, categories: scene.chart!.categories.map((c, i) => i === index ? e.target.value : c) } })} /><Input aria-label={`数值 ${index + 1}`} type="number" value={scene.chart!.series[0]?.values[index] ?? 0} onChange={e => edit({ chart: { ...scene.chart!, series: scene.chart!.series.map((s, si) => si === 0 ? { ...s, values: s.values.map((v, i) => i === index ? Number(e.target.value) || 0 : v) } : s) } })} /></div>)}</div>
        <div className="chart-actions"><Button variant="ghost" size="sm" disabled={scene.chart.categories.length >= 12} onClick={() => edit({ chart: { ...scene.chart!, categories: [...scene.chart!.categories, `第 ${scene.chart!.categories.length + 1} 项`], series: scene.chart!.series.map(s => ({ ...s, values: [...s.values, 0] })) } })}>加一个数据点</Button><Button variant="ghost" size="sm" disabled={scene.chart.categories.length <= 2} onClick={() => edit({ chart: { ...scene.chart!, categories: scene.chart!.categories.slice(0, -1), series: scene.chart!.series.map(s => ({ ...s, values: s.values.slice(0, -1) })) } })}>去掉最后一个点</Button></div>
      </div>}
      {currentPreset.photos > 0 && <><div className="editor-group-title"><span>图片</span><span>{scene.photos.length} / {currentPreset.photos}</span></div><div className="photo-upload-grid">{scene.photos.map((photo, index) => <div className="photo-edit-tile" key={photo.id}><Button variant="ghost" className="replace-photo" aria-label={`替换图片 ${index + 1}`} disabled={loading} onClick={() => chooseMedia('photo', photo.id)}><img src={urls[photo.mediaId]} alt={`已选图片 ${index + 1}`} /></Button><div className="photo-tile-actions"><Button size="icon" variant="secondary" aria-label={`前移图片 ${index + 1}`} disabled={index === 0} onClick={() => { const photos = [...scene.photos]; [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]]; edit({ photos }) }}><ArrowLeft size={11} /></Button><Button size="icon" variant="secondary" aria-label={`删除图片 ${index + 1}`} onClick={() => edit({ photos: scene.photos.filter(p => p.id !== photo.id) })}><X size={11} /></Button></div></div>)}{scene.photos.length < currentPreset.photos && <Button variant="outline" className="add-photo-tile" disabled={loading} aria-label="添加图片" onClick={() => chooseMedia('photo')}><ImagePlus size={22} /><span>选择图片</span></Button>}</div><p className="editor-help">可多选或直接粘贴，版式会自动安排图片。</p></>}
      {currentPreset.composition === 'cinema' && <><div className="editor-group-title"><span>视频</span><span>可选</span></div><div className="video-editor-actions"><Button variant="outline" disabled={loading} onClick={() => chooseMedia('video')}><Film size={14} />{scene.videoId ? '替换视频' : '选择本地视频'}</Button>{scene.videoId && <><Button variant="ghost" size="sm" onClick={() => chooseMedia('poster')}>设置封面</Button><Button variant="ghost" size="sm" onClick={() => { pauseMedia(); edit({ videoId: undefined, composition: 'opening' }) }}>移除视频</Button>{toggle('静音播放', scene.muted, muted => edit({ muted }))}{toggle('循环播放', scene.loop, loop => edit({ loop }))}</>}</div></>}
      {scene.composition === 'table' && <div className="legacy-table-editor"><div className="editor-group-title"><span>表格内容</span></div><Table><TableBody>{(scene.table || [['项目', '内容'], ['说明', '信息']]).map((row, r) => <TableRow key={r}>{row.map((cell, c) => <TableCell key={c}><Input aria-label={`表格 ${r + 1} 行 ${c + 1} 列`} value={cell} onChange={e => edit({ table: (scene.table || [['项目', '内容'], ['说明', '信息']]).map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? e.target.value : cell)) })} /></TableCell>)}</TableRow>)}</TableBody></Table></div>}
      <div className="editor-scene-actions"><Button variant="ghost" size="sm" onClick={duplicate}><Copy size={13} />复制这一屏</Button><Button variant="ghost" size="icon" aria-label="上移场景" onClick={() => move(-1)} disabled={activeIndex === 0}><ArrowUp size={14} /></Button><Button variant="ghost" size="icon" aria-label="下移场景" onClick={() => move(1)} disabled={activeIndex === project.scenes.length - 1}><ArrowDown size={14} /></Button><Button variant="ghost" size="icon" aria-label="删除这一屏" disabled={project.scenes.length <= 1} onClick={() => setDeleteOpen(true)}><Trash2 size={14} /></Button></div>
    </TabsContent><TabsContent value="atmosphere">
      {field('网页名称', <Input aria-label="网页名称" value={project.name} maxLength={60} onChange={e => update(p => ({ ...p, name: e.target.value }))} />)}
      {field('预设布局', <Button variant="outline" onClick={() => openPresets(false)}>{currentPreset.name} · 切换版式</Button>)}
      <div className="editor-group-title"><span>背景样式</span><span>全网页共用</span></div><div className="flow-bgkinds">{backgroundKinds.map(kind => <Button variant="outline" key={kind.id} className={project.background.kind === kind.id ? 'chosen' : ''} onClick={() => update(p => ({ ...p, background: { ...p.background, kind: kind.id, preset: 'custom' } }))}><span>{kind.label}</span>{project.background.kind === kind.id && <Check size={12} />}</Button>)}</div>
      <div className="editor-group-title"><span>底色色板</span><span>选用后自动匹配文字色</span></div><div className="flow-palettes">{palettes.map(palette => <Button variant="outline" key={palette.id} className={project.background.preset === palette.id && project.background.kind === palette.kind ? 'chosen' : ''} onClick={() => update(p => ({ ...p, background: { ...p.background, kind: palette.kind, preset: palette.id, colors: palette.colors }, scenes: p.scenes.map(s => ({ ...s, textColor: palette.ink })) }))}><span style={{ background: `linear-gradient(125deg,${palette.colors.join(',')})` }} /><span>{palette.label}</span>{project.background.preset === palette.id && project.background.kind === palette.kind && <Check size={12} />}</Button>)}</div>
      <div className="editor-field"><Label>自定义配色</Label><div className="flow-colors">{project.background.colors.map((color, index) => <div className="flow-color" key={`${index}-${project.background.preset}`}><span style={{ backgroundColor: color }} /><Input aria-label={`背景颜色 ${index + 1}`} defaultValue={color} maxLength={7} onBlur={e => { const color = e.target.value; if (!/^#[0-9a-f]{6}$/i.test(color)) { e.target.value = project.background.colors[index]; toast.error('请填写完整的 Hex 颜色，例如 #e7eaf7'); return } update(p => ({ ...p, background: { ...p.background, preset: 'custom', colors: p.background.colors.map((c, i) => i === index ? color : c) } })) }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></div>)}</div></div>
      {project.background.kind !== 'solid' && <><div className="editor-field"><div className="editor-group-title"><Label>背景流动速度</Label><span>{project.background.speed.toFixed(2)}×</span></div><Slider aria-label="背景流动速度" value={[project.background.speed]} min={0} max={1} step={0.01} onValueChange={value => update(p => ({ ...p, background: { ...p.background, speed: value[0] } }))} /></div>{toggle('暂停背景', project.background.paused, paused => update(p => ({ ...p, background: { ...p.background, paused } })))}</>}
      {select('切屏转场', project.transition, [{ value: 'fade', label: '柔和淡入（默认）' }, { value: 'creative', label: '纵深漂移' }, { value: 'cards', label: '卡片推进' }], value => { const transition = value as Project['transition']; update(p => ({ ...p, transition })); setEditing(false); setTimeout(() => { if (activeIndex < project.scenes.length - 1) { experience.current?.next(); setTimeout(() => experience.current?.previous(), 1400) } else { experience.current?.previous(); setTimeout(() => experience.current?.next(), 1400) } }, 120) })}



      {(currentPreset.headings + currentPreset.texts) > 0 && <>{select('文字字体', scene.font || 'sans', fontOptions.map(f => ({ value: f.id, label: f.label })), value => edit({ font: value as Scene['font'] }))}<div className="editor-field"><Label>文字颜色</Label><div className="flow-colors ink-swatches">{inkSwatches.map(color => <button type="button" key={color} aria-label={`文字配色 ${color}`} className={`ink-swatch ${scene.textColor === color ? 'chosen' : ''}`} style={{ backgroundColor: color }} onClick={() => edit({ textColor: color })} />)}</div><Input aria-label="文字颜色 Hex" key={`${scene.id}-${scene.textColor}`} defaultValue={scene.textColor || '#30384b'} maxLength={7} onBlur={e => { if (/^#[0-9a-f]{6}$/i.test(e.target.value)) edit({ textColor: e.target.value }); else { e.target.value = scene.textColor || '#30384b'; toast.error('请输入完整的 Hex 颜色') } }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} /></div><p className="editor-help">深色背景建议配浅色文字；字号随字数自动适配，位置与留白由版式统一安排。</p></>}
    </TabsContent><TabsContent value="motion"><div className="motion-intro"><Sparkles size={24} /><h3>内容，本来就可以有生命力。</h3><p>默认轻淡入，让内容安静呈现。需要强调的页面，再选择聚焦或图片轻浮。</p></div>{toggle('这一屏的灵动效果', scene.motion, motion => edit({ motion }))}{select('文字出场', scene.textEffect, [{ value: 'fade', label: '自然淡入（默认）' }, { value: 'blur', label: '轻柔聚焦' }, { value: 'focus', label: '呼吸聚焦' }, { value: 'drift', label: '轻盈掠入' }], value => { edit({ textEffect: value as Scene['textEffect'] }); setEditing(false); setTimeout(() => experience.current?.replay(), 0) })}{currentPreset.photos > 0 && select('图片效果', scene.photoEffect || 'still', [{ value: 'still', label: '静置呈现（默认）' }, { value: 'reveal', label: '轻盈入场' }, { value: 'float', label: '轻盈入场 + 持续轻浮' }, { value: 'lift', label: '轻浮抬升 + 更深阴影' }], value => { edit({ photoEffect: value as Scene['photoEffect'] }); setEditing(false); setTimeout(() => experience.current?.replay(), 0) })}<Button variant="outline" className="replay-motion" onClick={() => { setEditing(false); setTimeout(() => experience.current?.replay(), 0) }}><RotateCcw size={14} />重新感受这一屏</Button><p className="editor-help">每屏可以单独选效果或关闭。默认只轻淡入；系统开启“减少动态效果”时会自动收敛。</p></TabsContent></div></ScrollArea></Tabs></SheetContent></Sheet>
    <input type="file" ref={uploadRef} hidden aria-label="上传素材" onChange={e => { const target = targetRef.current; const files = Array.from(e.currentTarget.files || []); if (target && files.length) void importMedia(files, target); e.currentTarget.value = '' }} />
    <input type="file" ref={importRef} hidden accept=".zip,application/zip" aria-label="导入运行包" onChange={e => { if (e.currentTarget.files?.[0]) setPendingImport(e.currentTarget.files[0]); e.currentTarget.value = '' }} />
    <Dialog open={presetOpen} onOpenChange={setPresetOpen}><DialogContent className="preset-dialog"><DialogHeader><DialogTitle>{creating ? '选一个适合内容的版式' : '换一种讲述方式'}</DialogTitle><DialogDescription>文字和图片位由预设固定。替换内容，效果自然成立。</DialogDescription></DialogHeader><ScrollArea className="preset-dialog-scroll"><div className="preset-grid">{presets.filter(p => !p.legacy).map(preset => <Button variant="outline" key={preset.id} className={`preset-choice ${chosenPreset === preset.id ? 'selected' : ''}`} onClick={() => setChosenPreset(preset.id)}><div className={`preset-preview preview-${preset.id}`}><div className="preset-text-preview">{Array.from({ length: preset.headings }, (_, i) => <span className="preview-heading" key={i} />)}{Array.from({ length: preset.texts }, (_, i) => <span className="preview-note" key={i} />)}</div><div className="preset-images-preview">{Array.from({ length: preset.photos || (preset.composition === 'cinema' || preset.composition === 'chart' || preset.composition === 'table' ? 1 : 0) }, (_, i) => <span key={i} className={preset.composition === 'cinema' ? 'preview-media' : preset.composition === 'chart' ? 'preview-chart' : preset.composition === 'table' ? 'preview-table' : ''} />)}</div></div><strong>{preset.name}</strong><small>{preset.description}</small></Button>)}</div></ScrollArea>{!creating && <p className="editor-help preset-warning">切换前自动保留项目备份，再采用对应数量的内容。</p>}<DialogFooter><Button variant="ghost" onClick={() => setPresetOpen(false)}>取消</Button><Button onClick={() => void applyChosenPreset()}>{creating ? '添加这个场景' : '应用这个版式'}</Button></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>移除“{scene.name}”？</AlertDialogTitle><AlertDialogDescription>这一屏将从网页中移除，此操作无法撤销。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>保留</AlertDialogCancel><AlertDialogAction onClick={remove}>移除这一屏</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(pendingImport)} onOpenChange={open => { if (!open) setPendingImport(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>打开这个运行包？</AlertDialogTitle><AlertDialogDescription>将载入其中的网页、图片与视频。当前项目会先保留一份本地备份。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => void acceptImport()}>打开并继续编辑</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Toaster position="bottom-center" />
  </div>
}
