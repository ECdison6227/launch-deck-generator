import { useEffect, useRef } from 'react'
import type { BackgroundKind } from './model'
import cloudsNoise from './assets/vanta-clouds2-noise.png'

/** Vanta（MIT，tengbao）官方 CLOUDS / CLOUDS2 背景。按需动态加载 three 与效果包，不随首屏加载。 */
type VantaInstance = { destroy?: () => void; setOptions?: (options: Record<string, unknown>) => void; speed?: number }
export default function VantaBackdrop({ kind, colors, speed }: { kind: BackgroundKind; colors: string[]; speed: number }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const effectRef = useRef<VantaInstance | null>(null)
  // 初始化仅在 kind 改变时重建；speed / colors 通过 setOptions 原地更新，避免滑动速度时反复销毁重建。
  useEffect(() => {
    let cancelled = false
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
      effectRef.current = create({
        el: hostRef.current,
        THREE,
        mouseControls: false, touchControls: false, gyroControls: false,
        minHeight: 200, minWidth: 200,
        scale: 2, scaleMobile: 3,
        skyColor: colors[0], cloudColor: colors[1], cloudShadowColor: colors[2], sunColor: colors[3], lightColor: colors[3],
        ...(kind === 'clouds2' ? { texturePath: cloudsNoise } : {}),
        speed: Math.max(0, Math.min(1, speed)) * 1.2,
      })
    })().catch(error => console.error('云朵背景载入失败，保留当前底色', error))
    return () => { cancelled = true; effectRef.current?.destroy?.(); effectRef.current = null }
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const effect = effectRef.current
    if (!effect) return
    const clamped = Math.max(0, Math.min(1, speed)) * 1.2
    if (typeof effect.setOptions === 'function') {
      effect.setOptions({ skyColor: colors[0], cloudColor: colors[1], cloudShadowColor: colors[2], sunColor: colors[3], lightColor: colors[3], speed: clamped })
    } else {
      effect.speed = clamped
    }
  }, [colors, speed])
  return <div className="vanta-backdrop" ref={hostRef} aria-hidden="true" />
}
