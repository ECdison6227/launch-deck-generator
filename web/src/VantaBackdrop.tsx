import { useEffect, useRef } from 'react'
import type { BackgroundKind } from './model'
import cloudsNoise from './assets/vanta-clouds2-noise.png'

/** Vanta（MIT，tengbao）官方 CLOUDS / CLOUDS2 背景。按需动态加载 three 与效果包，不随首屏加载。 */
type VantaInstance = {
  destroy: () => void
  setOptions: (options: Record<string, unknown>) => void
  resize: () => void
  animationLoop: () => void
  req?: number
  prevNow?: number
  uniforms?: { iTex?: { value: { image?: unknown } } }
}
type Settings = { colors: string[]; speed: number; paused: boolean }
const MAX_CLOUD_PIXELS = 230400
const FRAME_INTERVAL = 1000 / 30
const renderFrame = (effect: VantaInstance) => {
  if (effect.req !== undefined) cancelAnimationFrame(effect.req)
  effect.animationLoop()
}
const applySettings = (effect: VantaInstance, { colors, speed }: Settings) => {
  effect.setOptions({ skyColor: colors[0], cloudColor: colors[1], cloudShadowColor: colors[2], sunColor: colors[3], lightColor: colors[3], speed: Math.max(0, Math.min(1, speed)) * 1.2 })
  renderFrame(effect)
}
export default function VantaBackdrop({ kind, colors, speed, paused }: { kind: BackgroundKind; colors: string[]; speed: number; paused: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const effectRef = useRef<VantaInstance | null>(null)
  const settingsRef = useRef<Settings>({ colors, speed, paused })
  useEffect(() => {
    settingsRef.current = { colors, speed, paused }
    if (effectRef.current) applySettings(effectRef.current, settingsRef.current)
  }, [colors, speed, paused])
  // 初始化仅在 kind 改变时重建；speed / colors 通过 setOptions 原地更新，避免滑动速度时反复销毁重建。
  useEffect(() => {
    let cancelled = false
    let observer: ResizeObserver | undefined
    let refresh: (() => void) | undefined
    void (async () => {
      const [THREE, vanta] = await Promise.all([
        import('three'),
        kind === 'clouds2' ? import('vanta/dist/vanta.clouds2.min.js') : import('vanta/dist/vanta.clouds.min.js'),
      ])
      if (cancelled || !hostRef.current) return
      type Create = (options: Record<string, unknown>) => VantaInstance
      const wrapper = (vanta as { default: unknown }).default
      const create = (typeof wrapper === 'function' ? wrapper : (wrapper as { default?: Create })?.default) as Create | undefined
      if (typeof create !== 'function') throw new Error('云朵组件未能载入')
      const host = hostRef.current
      const renderScale = () => Math.max(2, (window.devicePixelRatio || 1) * Math.sqrt(Math.max(1, host.clientWidth * host.clientHeight) / MAX_CLOUD_PIXELS))
      const scale = renderScale()
      const latest = settingsRef.current
      const effect = create({
        el: host,
        THREE,
        mouseControls: false, touchControls: false, gyroControls: false,
        minHeight: 200, minWidth: 200,
        scale, scaleMobile: scale,
        skyColor: latest.colors[0], cloudColor: latest.colors[1], cloudShadowColor: latest.colors[2], sunColor: latest.colors[3], lightColor: latest.colors[3],
        ...(kind === 'clouds2' ? { texturePath: cloudsNoise } : {}),
        speed: Math.max(0, Math.min(1, latest.speed)) * 1.2,
      })
      effectRef.current = effect
      // Vanta 没有暂停 API，speed=0 仍会渲染。保留最后一帧并取消它排定的下一帧。
      const animate = effect.animationLoop
      let lastFrame = 0
      effect.animationLoop = () => {
        const settings = settingsRef.current
        const paused = document.hidden || settings.paused || settings.speed === 0
        const now = performance.now()
        // 缓慢流动的装饰背景限制到 30fps，文字和操作仍按浏览器刷新率呈现。
        if (!paused && now - lastFrame < FRAME_INTERVAL) {
          effect.req = requestAnimationFrame(effect.animationLoop)
          return
        }
        lastFrame = now
        animate()
        const texturePending = kind === 'clouds2' && !effect.uniforms?.iTex?.value.image
        if (document.hidden || (paused && !texturePending)) {
          if (effect.req !== undefined) cancelAnimationFrame(effect.req)
          effect.req = undefined
          effect.prevNow = undefined
        }
      }
      refresh = () => {
        const scale = renderScale()
        effect.setOptions({ scale, scaleMobile: scale })
        effect.resize()
        renderFrame(effect)
      }
      observer = new ResizeObserver(refresh)
      observer.observe(host)
      window.addEventListener('resize', refresh)
      document.addEventListener('visibilitychange', refresh)
      applySettings(effect, settingsRef.current)
    })().catch(error => console.error('云朵背景载入失败，保留当前底色', error))
    return () => {
      cancelled = true
      observer?.disconnect()
      if (refresh) {
        window.removeEventListener('resize', refresh)
        document.removeEventListener('visibilitychange', refresh)
      }
      effectRef.current?.destroy()
      effectRef.current = null
    }
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="vanta-backdrop" ref={hostRef} aria-hidden="true" />
}
