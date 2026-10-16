import { test, expect } from './fixtures'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { readFile } from 'node:fs/promises'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: '编辑当前屏', exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => !!window.flowAgent?.inspect())).toBe(true)
})

test('连续输入合并保存，Agent 写入保留尚未保存的文字', async ({ page }) => {
  await page.getByRole('button', { name: '编辑当前屏', exact: true }).click()
  await page.evaluate(() => {
    const counters = { writes: 0, backupScans: 0 }
    Object.assign(window, { optimizationCounters: counters })
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) { if (this.name === 'projects' && args[0].id === 'current') counters.writes++; return original.apply(this, args) }
    const getAll = IDBObjectStore.prototype.getAll
    IDBObjectStore.prototype.getAll = function (...args) { if (this.name === 'projects') counters.backupScans++; return getAll.apply(this, args) }
  })
  const input = page.getByRole('textbox', { name: '小文本 1', exact: true })
  await input.fill(''); await input.pressSequentially('a'.repeat(100), { delay: 10 })
  await expect(page.getByRole('status').filter({ hasText: /^已保存$/ })).toBeVisible()
  const counts = await page.evaluate(() => (window as unknown as { optimizationCounters: { writes: number; backupScans: number } }).optimizationCounters)
  expect(counts.writes).toBeLessThanOrEqual(3); expect(counts.backupScans).toBeLessThanOrEqual(1)
  await input.fill('Agent 必须保留这段刚输入的文字')
  await page.evaluate(() => window.flowAgent!.setBackground({ preset: 'paper' }))
  await page.reload()
  await expect.poll(() => page.evaluate(() => window.flowAgent?.inspect()?.scenes[0].texts[0])).toBe('Agent 必须保留这段刚输入的文字')
  await expect.poll(() => page.evaluate(() => window.flowAgent?.inspect()?.background.preset)).toBe('paper')
})

test('删图后可撤销、重做，恢复素材且刷新后仍存在', async ({ page }) => {
  await page.getByRole('button', { name: '编辑当前屏', exact: true }).click()
  await expect(page.locator('.photo-edit-tile')).toHaveCount(3)
  await page.getByRole('button', { name: '删除图片 1', exact: true }).click()
  await expect(page.locator('.photo-edit-tile')).toHaveCount(2)
  await expect(page.getByRole('status').filter({ hasText: /^已保存$/ })).toBeVisible()
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(page.locator('.photo-edit-tile')).toHaveCount(3)
  await expect.poll(() => page.locator('.swiper-slide-active .photo-frame img').evaluateAll(images => images.every(img => (img as HTMLImageElement).naturalWidth > 0))).toBe(true)
  await page.getByRole('button', { name: '重做', exact: true }).click()
  await expect(page.locator('.photo-edit-tile')).toHaveCount(2)
  await page.getByRole('button', { name: '撤销', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /^已保存$/ })).toBeVisible()
  await page.reload()
  await expect.poll(() => page.evaluate(() => window.flowAgent?.inspect()?.scenes[0].photos.length)).toBe(3)
})

test('大图生成三档，六图屏使用 1920 版本，导出保留 4K 版', async ({ page }) => {
  const image = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 4000; canvas.height = 3000
    const context = canvas.getContext('2d')!; context.fillStyle = '#6789ab'; context.fillRect(0, 0, 4000, 3000)
    return canvas.toDataURL('image/jpeg', 0.9)
  })
  await page.evaluate(image => window.flowAgent!.addScene({ presetId: 'gallery', images: Array(6).fill(image), headings: ['六图测试'] }), image)
  const images = page.locator('.swiper-slide-active .photo-frame img')
  await expect(images).toHaveCount(6)
  await expect.poll(() => images.evaluateAll(images => images.every(img => (img as HTMLImageElement).naturalWidth === 1920))).toBe(true)
  await page.getByRole('button', { name: '编辑当前屏', exact: true }).click()
  await expect.poll(() => page.locator('.photo-edit-tile img').evaluateAll(images => images.every(img => (img as HTMLImageElement).naturalWidth === 400))).toBe(true)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '打包带走', exact: true }).click()
  const file = await download; const path = await file.path()
  const zip = unzipSync(new Uint8Array(await readFile(path!)))
  const manifest = JSON.parse(new TextDecoder().decode(zip['project.json']))
  const ids: string[] = manifest.project.scenes.at(-1).photos.map((p: { mediaId: string }) => p.mediaId)
  const entries = manifest.media.filter((m: { id: string }) => ids.includes(m.id))
  expect(entries).toHaveLength(6)
  expect(entries.every((m: { variants: { medium: { width: number; path: string } } }) => m.variants.medium.width === 1920 && zip[m.variants.medium.path])).toBe(true)
  expect(zip['部署说明.txt']).toBeDefined()
  expect(Object.keys(zip).some(path => path.endsWith('.woff2'))).toBe(false)
})

test('支持写盘时流式保存，不依赖整包 Blob 下载', async ({ page }) => {
  await page.evaluate(() => {
    let total = 0; let closed = false
    Object.assign(window, { diskResult: () => ({ total, closed }) })
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => new WritableStream({ write(chunk) { total += chunk.byteLength }, close() { closed = true } }) }) })
  })
  await page.getByRole('button', { name: '打包带走', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { diskResult: () => { closed: boolean } }).diskResult().closed)).toBe(true)
  expect(await page.evaluate(() => (window as unknown as { diskResult: () => { total: number } }).diskResult().total)).toBeGreaterThan(1000000)
})

for (const kind of ['mesh', 'grain'] as const) test(`${kind} 背景限帧，编辑时冻结，调色和恢复不重建画布`, async ({ page }) => {
  await page.evaluate(kind => window.flowAgent!.setBackground({ kind, speed: 0.6, paused: false }), kind)
  const canvas = page.locator('.shader-backdrop canvas')
  await expect(canvas).toBeAttached()
  const handle = await canvas.elementHandle()
  await page.evaluate(() => {
    const state = { draws: 0 }; Object.assign(window, { shaderFrames: state })
    const draw = WebGL2RenderingContext.prototype.drawArrays
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      if ((this.canvas as HTMLCanvasElement).closest('.shader-backdrop')) state.draws++
      return draw.apply(this, args)
    }
  })
  await page.waitForTimeout(1100)
  const frames = await page.evaluate(() => (window as unknown as { shaderFrames: { draws: number } }).shaderFrames.draws)
  expect(frames).toBeGreaterThan(0); expect(frames).toBeLessThanOrEqual(35)
  await page.getByRole('button', { name: '编辑当前屏', exact: true }).click()
  await page.waitForTimeout(100)
  const frozen = await page.evaluate(() => (window as unknown as { shaderFrames: { draws: number } }).shaderFrames.draws)
  await page.getByRole('textbox', { name: '主标题 1', exact: true }).fill('编辑背景保持冻结')
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => (window as unknown as { shaderFrames: { draws: number } }).shaderFrames.draws)).toBe(frozen)
  await page.evaluate(kind => window.flowAgent!.setBackground({ kind, colors: ['#eeeeff', '#ddddee', '#ccccdd', '#bbbbcc'] }), kind)
  expect(await canvas.evaluate((node, old) => node === old, handle)).toBe(true)
  await page.getByRole('button', { name: '收起编辑', exact: true }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { shaderFrames: { draws: number } }).shaderFrames.draws)).toBeGreaterThan(frozen)
})

test('运行包缺少媒体时保留当前项目，不写入半成品', async ({ page }) => {
  const original = await page.evaluate(() => window.flowAgent!.inspect()!)
  const bytes = zipSync({ 'project.json': strToU8(JSON.stringify({ format: 'flow-web', version: 2, project: original, media: [] })) })
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: '打开运行包', exact: true }).click()
  await (await chooser).setFiles({ name: 'broken.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) })
  await page.getByRole('button', { name: '打开并继续编辑', exact: true }).click()
  await expect(page.getByText('导入失败，当前项目保留：Error: 压缩包缺少页面引用的素材', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => window.flowAgent!.inspect()!.scenes)).toEqual(original.scenes)
  await page.reload()
  await expect.poll(() => page.evaluate(() => window.flowAgent?.inspect()?.scenes)).toEqual(original.scenes)
})
