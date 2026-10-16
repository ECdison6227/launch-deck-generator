import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Experience, pauseMedia, type ExperienceHandle } from './Experience'
import { normalizeProject, type Project } from './model'
import type { PortableManifest } from './archive'
import './index.css'
import './App.css'
function Player() {
  const [project, setProject] = useState<Project | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [error, setError] = useState('')
  const ref = useRef<ExperienceHandle>(null)
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('./project.json')
        if (!response.ok) throw new Error('请完整解压运行包，然后运行 node start.mjs')
        const manifest = await response.json() as PortableManifest
        if (manifest.format !== 'flow-web' || manifest.version !== 2) throw new Error('运行包格式不受支持')
        const loaded = normalizeProject(manifest.project)
        const urls = Object.fromEntries(manifest.media.flatMap(m => {
          if (!m.path.startsWith('media/') || m.path.includes('..')) throw new Error('媒体路径无效')
          const entries = [[m.id, new URL(m.path, location.href).href]]
          if (m.variants?.medium) {
            const path = m.variants.medium.path
            if (!path.startsWith('media/') || path.includes('..')) throw new Error('媒体路径无效')
            entries.push([`${m.id}:medium`, new URL(path, location.href).href])
          }
          return entries
        }))
        setUrls(urls); setProject(loaded); document.title = loaded.name
      } catch (error) { setError(String(error)) }
    })()
  }, [])
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(error => setError(String(error))) }
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key.toLowerCase() === 'f') fullscreen(); if (event.key === 'Escape' && document.fullscreenElement) { event.preventDefault(); void document.exitFullscreen() } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey) }, [])
  if (!project) return <div className="flow-loading"><div><p>{error || '正在打开这段旅程…'}</p></div></div>
  return <div className="flow-app"><Experience project={project} urls={urls} activeIndex={index} onIndexChange={next => { pauseMedia(); setIndex(next) }} ref={ref} /><header className="flow-topbar"><div className="flow-identity"><span className="project-caption">{project.name}</span></div><div className="flow-actions"><Button className="play-button" onClick={fullscreen}><Maximize size={14} />全屏播放</Button></div></header><footer className="flow-bottom"><span /><nav className="scene-dock" aria-label="场景导航"><Button size="icon" variant="ghost" aria-label="上一屏" disabled={!index} onClick={() => ref.current?.previous()}><ArrowLeft size={16} /></Button><div className="scene-chips">{project.scenes.map((scene, i) => <Button variant="ghost" className={`scene-chip ${i === index ? 'active' : ''}`} key={scene.id} aria-label={`第 ${i + 1} 屏`} aria-current={i === index ? 'page' : undefined} onClick={() => setIndex(i)}><span>{String(i + 1).padStart(2, '0')}</span></Button>)}</div><Button size="icon" variant="ghost" aria-label="下一屏" disabled={index === project.scenes.length - 1} onClick={() => ref.current?.next()}><ArrowRight size={16} /></Button></nav><span className="flow-key-hint">滚轮 / 方向键，去下一屏</span></footer>{error && <div role="alert" className="flow-save-alert">{error}</div>}</div>
}
createRoot(document.getElementById('root')!).render(<Player />)
