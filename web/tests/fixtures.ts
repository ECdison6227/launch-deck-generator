import { test as base } from '@playwright/test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// WebKit 的无痕上下文不能写入 Blob；编辑器测试使用独立普通配置目录。
// 便携播放器仍由测试中的 browser.newContext() 验证，保持无痕且无数据库。
export const test = base.extend({
  context: async ({ context, browserName, playwright, baseURL, viewport, headless }, provideContext) => {
    if (browserName !== 'webkit') { await provideContext(context); return }
    const profile = await mkdtemp(join(tmpdir(), 'flow-webkit-editor-'))
    const persistent = await playwright.webkit.launchPersistentContext(profile, { headless, baseURL, viewport })
    try { await provideContext(persistent) }
    finally { try { await persistent.close() } finally { await rm(profile, { recursive: true, force: true }) } }
  },
})
export { expect } from '@playwright/test'
