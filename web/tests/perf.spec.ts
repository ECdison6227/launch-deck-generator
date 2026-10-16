import { test, expect, type Page } from '@playwright/test'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

// 单独运行：PERF_REPORT=baseline npm run test:perf；常规功能回归不跑大素材压力测试。
test.skip(!process.env.PERF_REPORT, '性能用例需显式指定 PERF_REPORT')
test.setTimeout(180000)
type Counters = { longTasks: number[]; longFrames: number[]; projectWrites: number }
declare global { interface Window { perfCounters: Counters } }

async function measure(page: Page, action: () => Promise<void>) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Performance.enable')
  await page.evaluate(() => { window.perfCounters = { longTasks: [], longFrames: [], projectWrites: 0 } })
  let heapPeakBytes = 0
  let backingStoragePeakBytes = 0
  let sampling = false
  const sample = async () => {
    if (sampling) return
    sampling = true
    try {
      const { metrics } = await cdp.send('Performance.getMetrics')
      heapPeakBytes = Math.max(heapPeakBytes, metrics.find((m: { name: string }) => m.name === 'JSHeapUsedSize')?.value || 0)
      const usage = await cdp.send('Runtime.getHeapUsage')
      backingStoragePeakBytes = Math.max(backingStoragePeakBytes, usage.backingStorageSize || 0)
    } finally { sampling = false }
  }
  await sample()
  let sampleTask = Promise.resolve()
  const timer = setInterval(() => { if (!sampling) sampleTask = sample().catch(() => {}) }, 100)
  const start = performance.now()
  try {
    await action()
    await page.waitForTimeout(250)
    await sample()
    const counters = await page.evaluate(() => window.perfCounters)
    return { elapsedMs: Math.round(performance.now() - start), heapPeakBytes, backingStoragePeakBytes, ...counters,
      longestTaskMs: Math.max(0, ...counters.longTasks), longestFrameMs: Math.max(0, ...counters.longFrames) }
  } finally { clearInterval(timer); await sampleTask; await cdp.detach() }
}

test('1080p 路演：十屏切换、连续输入、200MiB 视频导出', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true })
    window.perfCounters = { longTasks: [], longFrames: [], projectWrites: 0 }
    for (const [type, key] of [['longtask', 'longTasks'], ['long-animation-frame', 'longFrames']] as const) {
      if (PerformanceObserver.supportedEntryTypes.includes(type)) new PerformanceObserver(list => {
        window.perfCounters[key].push(...list.getEntries().map(e => e.duration))
      }).observe({ type })
    }
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'projects' && args[0]?.id === 'current') window.perfCounters.projectWrites++
      return put.apply(this, args)
    }
  })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '编辑当前屏', exact: true })).toBeVisible()
  await page.evaluate(async () => {
    const images = Array.from({ length: 6 }, (_, i) => {
      const canvas = document.createElement('canvas'); canvas.width = 4000; canvas.height = 3000
      const ctx = canvas.getContext('2d')!
      const gradient = ctx.createLinearGradient(0, 0, 4000, 3000)
      gradient.addColorStop(0, `hsl(${i * 55},65%,45%)`); gradient.addColorStop(1, '#fafafa')
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4000, 3000)
      return canvas.toDataURL('image/jpeg', 0.9)
    })
    await window.flowAgent!.addScene({ presetId: 'gallery', images, headings: ['性能基线'] })
    for (let i = 0; i < 5; i++) await window.flowAgent!.addScene({ presetId: 'title', headings: [`路演第 ${i + 1} 屏`] })
  })
  await page.getByRole('button', { name: '第 1 屏', exact: true }).click()
  await page.waitForTimeout(1200)
  const navigation = await measure(page, async () => {
    for (let i = 1; i <= 10; i++) {
      await page.getByRole('button', { name: `第 ${i} 屏`, exact: true }).click()
      await page.waitForTimeout(900)
    }
  })
  await page.getByRole('button', { name: '第 1 屏', exact: true }).click()
  await page.getByRole('button', { name: '编辑当前屏', exact: true }).click()
  await page.waitForTimeout(600)
  const typing = await measure(page, async () => {
    // 主标题最多 72 字，分两处各输入 100 字，避免被 maxLength 截断后只测到空操作。
    for (const index of [1, 2]) {
      const input = page.getByRole('textbox', { name: `小文本 ${index}`, exact: true })
      await input.fill(''); await input.pressSequentially('performance '.repeat(8) + 'test', { delay: 20 })
    }
    await expect(page.getByRole('status').filter({ hasText: /^已保存$/ })).toBeVisible()
  })
  await page.getByRole('button', { name: '收起编辑', exact: true }).click()
  await page.getByRole('button', { name: '第 4 屏', exact: true }).click()
  await page.getByRole('button', { name: '编辑当前屏', exact: true }).click()
  await page.evaluate(() => {
    // 只测打包内存，不拿无编码的占位文件验证视频播放；真实播放由 workbench.spec 覆盖。
    const input = document.querySelector<HTMLInputElement>('input[aria-label="上传素材"]')!
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(200 * 1024 * 1024)], 'stress.mp4', { type: 'video/mp4' }))
    input.files = transfer.files
  })
  await page.getByRole('button', { name: '替换视频', exact: true }).click()
  await page.locator('input[aria-label="上传素材"]').dispatchEvent('change')
  await expect(page.getByRole('status').filter({ hasText: /^已保存$/ })).toBeVisible()
  await expect(page.getByText('视频已加入', { exact: true })).toBeVisible()
  await page.waitForTimeout(800)
  const exporting = await measure(page, async () => {
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: '打包带走', exact: true }).click()
    const file = await download; expect(await file.failure()).toBeNull()
  })
  const bundles: { path: string; bytes: number; gzipBytes: number }[] = []
  for (const dir of ['dist/assets', '.player-build/assets']) for (const name of await readdir(dir)) {
    const bytes = await readFile(join(dir, name))
    bundles.push({ path: `${dir}/${name}`, bytes: bytes.length, gzipBytes: gzipSync(bytes).length })
  }
  const report = { recordedAt: new Date().toISOString(), browser: page.context().browser()?.version(), viewport: '1920x1080',
    notes: ['JSHeapUsedSize 不包括 Blob、图片解码与 GPU 内存；100ms 采样可能漏掉瞬时峰值。', '200MiB 占位视频仅用于导出，不代表视频兼容性。', '绝对帧耗时受本机 GPU 和浏览器运行模式影响，勿作为真机承诺。'],
    navigation, typing, exporting, bundles }
  await mkdir('perf', { recursive: true })
  await writeFile(`perf/${process.env.PERF_REPORT!.replace(/[^\w-]/g, '')}.json`, JSON.stringify(report, null, 2) + '\n')
})
