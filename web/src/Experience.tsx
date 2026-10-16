import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { A11y, EffectCards, EffectCreative, EffectFade, Keyboard, Mousewheel } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper'
import { GrainGradient, MeshGradient } from '@paper-design/shaders-react'
import { motion } from 'motion/react'
import TiltedCard from '@/components/vendor/react-bits/TiltedCard'
import BlurText from '@/components/vendor/react-bits/BlurText'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { scenePreset, type Project, type Scene } from './model'
import 'swiper/css'
import 'swiper/css/effect-creative'
import 'swiper/css/effect-fade'
import 'swiper/css/effect-cards'
import './Experience.css'

const SceneChartView = lazy(() => import('./SceneChartView'))
const VantaBackdrop = lazy(() => import('./VantaBackdrop'))

export type ExperienceHandle = { next: () => void; previous: () => void; goTo: (index: number) => void; replay: () => void }
export const pauseMedia = () => document.querySelectorAll<HTMLVideoElement>('video').forEach(v => v.pause())

function AmbientBackground({ project, reduced }: { project: Project; reduced: boolean }) {
  const background = project.background
  const paused = background.paused || reduced
  const speed = paused ? 0 : background.speed
  if (background.kind === 'solid') return <div className="ambient-background" style={{ backgroundColor: background.colors[0] }} />
  if (background.kind === 'clouds' || background.kind === 'clouds2') return <div className="ambient-background" style={{ backgroundColor: background.colors[0] }}>
    <Suspense fallback={null}><VantaBackdrop kind={background.kind} colors={background.colors} speed={speed} /></Suspense>
  </div>
  return <div className="ambient-background" style={{ backgroundColor: background.colors[0] }}>
    {background.kind === 'grain' && <GrainGradient width="100%" height="100%" colorBack={background.colors[0]} colors={background.colors.slice(1)} speed={speed * 1.4 || 0} softness={0.7} intensity={0.18} noise={0.5} shape="wave" minPixelRatio={1} maxPixelCount={518400} />}
    {background.kind === 'mesh' && <MeshGradient width="100%" height="100%" colors={background.colors} speed={speed} distortion={0.85} swirl={0.28} grainMixer={0} grainOverlay={0.012} minPixelRatio={1} maxPixelCount={518400} />}
  </div>
}

function SceneContent({ scene, urls, animate, replay, reduced }: { scene: Scene; urls: Record<string, string>; animate: boolean; replay: number; reduced: boolean }) {
  const preset = scenePreset(scene)
  const photoSlots = Array.from({ length: preset.photos }, (_, i) => scene.photos[i] || { id: `empty-${i}`, mediaId: '' })
  const font = {
    sans: '-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif',
    serif: 'Songti SC, STSong, SimSun, serif',
    alimama: '"Alimama ShuHeiTi", PingFang SC, Microsoft YaHei, sans-serif',
    georgia: 'Georgia, "Times New Roman", Songti SC, serif',
    arial: 'Arial, "Helvetica Neue", Helvetica, PingFang SC, sans-serif',
    trebuchet: '"Trebuchet MS", "Gill Sans", PingFang SC, sans-serif',
    verdana: 'Verdana, Geneva, PingFang SC, sans-serif',
    courier: '"Courier New", Courier, monospace',
  }[scene.font || 'sans']
  const hasMotion = animate && scene.motion && !reduced
  const effect = scene.photoEffect || 'still'
  const titleEffect = scene.textEffect === 'fade' ? null : scene.textEffect
  const interactivePhotos = scene.motion && !reduced && (effect === 'float' || effect === 'lift')
  return <section style={{ fontFamily: font, '--scene-ink': scene.textColor || '#30384b' } as CSSProperties} className={`scene-content preset-${preset.id} composition-${scene.composition} align-${scene.align} photo-count-${preset.photos}`} data-scene-id={scene.id}>
    <div className="scene-copy">
      <div className="headings-group">{scene.headings.map((text, i) => <div key={i} role="heading" aria-level={i + 1} className={`scene-heading heading-${i + 1}`} data-text-kind="heading" style={{ '--text-length': Math.max(1, ...text.split('\n').map(line => Array.from(line).length)) } as CSSProperties}>
        {hasMotion ? titleEffect === null ? <motion.span className="plain-heading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: i * 0.06, ease: 'easeOut' }}>{text}</motion.span> : text.split('\n').map((line, lineIndex) => <BlurText key={`${scene.id}-${replay}-${lineIndex}`} text={line || ' '} trigger="load" animateBy="letters" delay={i === 0 ? 36 : 46} effect={titleEffect} direction="bottom" distance={22} blur={10} stepDuration={0.36} className="animated-line" />) : <span className="plain-heading">{text}</span>}
      </div>)}</div>
      <div className="scene-notes">{scene.texts.map((text, i) => <div className="scene-small-text" key={i} data-text-kind="small">
        {hasMotion ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.12, ease: 'easeOut' }}>{text}</motion.p> : <p>{text}</p>}
      </div>)}</div>
      {scene.footnote && <div className="scene-footnote"><p>{scene.footnote}</p></div>}
    </div>
    {photoSlots.length > 0 && <div className={`photo-field material-${scene.material}`} aria-label="漂浮图片组">{photoSlots.map((photo, index) => <div className={`photo-slot photo-${index + 1}`} key={`${scene.id}-${photo.id}-${replay}`}>
      <TiltedCard className="living-photo" containerWidth="100%" containerHeight="100%" imageWidth="100%" imageHeight="100%" radius={28} floating={interactivePhotos} intro={hasMotion && effect !== 'still'} introDelay={180 + index * 130} rotateAmplitude={interactivePhotos ? (effect === 'lift' ? 9 : 6) : 0} scaleOnHover={interactivePhotos ? (effect === 'lift' ? 1.06 : 1.025) : 1} parallax={interactivePhotos ? 1 : 0} smoothness={0.65} shadow={effect === 'lift' ? 0.3 : 0.12} glare={interactivePhotos ? 0.18 : 0} showTooltip={false} flipOnClick={false} gyroscope={false}>
        <Card className="photo-frame"><CardContent>{urls[photo.mediaId] ? <img src={urls[photo.mediaId]} alt={`图片 ${index + 1}`} style={{ objectFit: scene.fit }} draggable={false} /> : <div className="missing-photo">图片待添加</div>}</CardContent></Card>
      </TiltedCard>
    </div>)}</div>}
    {scene.videoId && <div className="scene-video-slot"><video className="scene-video" src={urls[scene.videoId]} poster={urls[scene.posterId || '']} muted={scene.muted} loop={scene.loop} controls playsInline preload="metadata" /></div>}
    {scene.composition === 'chart' && scene.chart && <Suspense fallback={<Card className="scene-chart scene-chart-loading"><CardContent>图表载入中…</CardContent></Card>}><SceneChartView chart={scene.chart} ink={scene.textColor || '#30384b'} animate={hasMotion} /></Suspense>}
    {scene.composition === 'table' && scene.table && <Card className="scene-table"><CardContent><Table><TableHeader><TableRow>{scene.table[0]?.map((cell, i) => <TableHead key={i}>{cell}</TableHead>)}</TableRow></TableHeader><TableBody>{scene.table.slice(1).map((row, i) => <TableRow key={i}>{row.map((cell, j) => <TableCell key={j}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table></CardContent></Card>}
    {scene.composition === 'outro' && animate && <motion.div className="outro-veil" initial={{ opacity: 0 }} animate={{ opacity: scene.motion && !reduced ? 1 : 0 }} transition={{ duration: 2.6, delay: 1.8, ease: [0.45, 0, 0.55, 1] }} key={`${scene.id}-${replay}-veil`} aria-hidden="true" />}
  </section>
}

const swiperEffects = {
  creative: { modules: [EffectCreative], props: { effect: 'creative' as const, creativeEffect: { limitProgress: 1, prev: { translate: [0, '-18%', -220], opacity: 0, scale: 0.92 }, next: { translate: [0, '24%', 0], opacity: 0, scale: 1.06 } } } },
  fade: { modules: [EffectFade], props: { effect: 'fade' as const, fadeEffect: { crossFade: true } } },
  cards: { modules: [EffectCards], props: { effect: 'cards' as const, cardsEffect: { perSlideOffset: 14, perSlideRotate: 2, slideShadows: true } } },
}

export const Experience = forwardRef<ExperienceHandle, { project: Project; urls: Record<string, string>; editing?: boolean; activeIndex: number; onIndexChange: (index: number) => void; keyboard?: boolean }>(function Experience({ project, urls, editing = false, activeIndex, onIndexChange, keyboard = true }, ref) {
  const swiperRef = useRef<SwiperInstance | null>(null)
  const [replay, setReplay] = useState(0)
  // 编辑状态下点「重新感受这一屏」：短暂允许动效，播完自动回归"编辑时静止"，并保持编辑框打开。
  const [forcePlay, setForcePlay] = useState(false)
  const forceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  // 编辑模式切换时取消预览态；离开页面时清理定时器。
  useEffect(() => () => { if (forceTimer.current) clearTimeout(forceTimer.current) }, [])
  useEffect(() => { if (!editing) setForcePlay(false) }, [editing])
  const transitionSpeed = reduced ? 0 : project.transition === 'fade' ? 450 : 850
  useEffect(() => { if (swiperRef.current && swiperRef.current.activeIndex !== activeIndex) swiperRef.current.slideTo(activeIndex, editing ? 0 : transitionSpeed) }, [activeIndex, editing, transitionSpeed])
  useImperativeHandle(ref, () => ({
    next: () => swiperRef.current?.slideNext(),
    previous: () => swiperRef.current?.slidePrev(),
    goTo: index => swiperRef.current?.slideTo(index),
    replay: () => {
      setReplay(n => n + 1)
      setForcePlay(true)
      if (forceTimer.current) clearTimeout(forceTimer.current)
      forceTimer.current = setTimeout(() => setForcePlay(false), 3500)
    },
  }), [])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (!keyboard || editing || target.closest('input, textarea, select, [role=dialog], [contenteditable=true]') || event.metaKey || event.ctrlKey || event.altKey) return
      if ([' ', 'ArrowRight', 'ArrowLeft'].includes(event.key)) { event.preventDefault(); if (event.key === 'ArrowLeft') swiperRef.current?.slidePrev(); else swiperRef.current?.slideNext() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, editing])
  const effect = swiperEffects[project.transition] || swiperEffects.fade
  return <div className={`experience transition-${project.transition} ${editing ? 'experience-editing' : ''}`} data-testid="experience">
    <AmbientBackground project={project} reduced={reduced} />
    <div className="experience-pages"><Swiper key={project.transition} modules={[A11y, Keyboard, Mousewheel, ...effect.modules]} direction={project.transition === 'cards' ? 'horizontal' : 'vertical'} speed={transitionSpeed} initialSlide={activeIndex} keyboard={{ enabled: keyboard && !editing }} mousewheel={{ enabled: keyboard && !editing, forceToAxis: project.transition !== 'cards', thresholdDelta: 35, thresholdTime: 750 }} allowTouchMove={!editing} {...effect.props} onSwiper={swiper => { swiperRef.current = swiper }} onBeforeSlideChangeStart={pauseMedia} onSlideChange={swiper => { pauseMedia(); onIndexChange(swiper.activeIndex) }} a11y={{ enabled: true, containerMessage: '流动网页，使用方向键切换场景', slideLabelMessage: '第 {{index}} 屏，共 {{slidesLength}} 屏' }}>
      {project.scenes.map(scene => <SwiperSlide key={scene.id}>{({ isActive }) => isActive ? <SceneContent key={`${scene.id}-${replay}`} scene={scene} urls={urls} animate={!editing || forcePlay} replay={replay} reduced={reduced} /> : null}</SwiperSlide>)}
    </Swiper></div>
  </div>
})
