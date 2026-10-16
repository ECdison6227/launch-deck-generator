import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'

test('便携服务器：Range、HEAD、缓存、拒绝无效范围', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'flow-range-'))
  await copyFile(new URL('../scripts/portable-server.mjs', import.meta.url), join(folder, 'start.mjs'))
  await mkdir(join(folder, 'media')); await mkdir(join(folder, 'assets'))
  const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i))
  await writeFile(join(folder, 'media/test.mp4'), bytes)
  await writeFile(join(folder, 'index.html'), '路演')
  await writeFile(join(folder, 'assets/app-abc12345.js'), 'console.log(1)')
  const server = spawn(process.execPath, ['start.mjs'], { cwd: folder, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const address = await new Promise((resolve, reject) => {
      let output = ''; const timer = setTimeout(() => reject(new Error('启动超时')), 10000)
      server.on('error', reject)
      server.stdout.on('data', data => { output += data; const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//); if (url) { clearTimeout(timer); resolve(url[0]) } })
    })
    for (const [range, start, end] of [['bytes=0-99', 0, 99], ['bytes=100-', 100, 255], ['bytes=-10', 246, 255], ['bytes=200-999', 200, 255]]) {
      const response = await fetch(`${address}media/test.mp4`, { headers: { Range: range } })
      assert.equal(response.status, 206)
      assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/256`)
      assert.equal(response.headers.get('accept-ranges'), 'bytes')
      assert.equal(response.headers.get('content-length'), String(end - start + 1))
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1))
    }
    for (const range of ['bytes=256-', 'bytes=5-4', 'bytes=-0', 'bytes=0-2,4-6', 'garbage']) {
      const response = await fetch(`${address}media/test.mp4`, { headers: { Range: range } })
      assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */256'); assert.equal((await response.arrayBuffer()).byteLength, 0)
    }
    const head = await fetch(`${address}media/test.mp4`, { method: 'HEAD', headers: { Range: 'bytes=0-9' } })
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), '256'); assert.equal(await head.text(), '')
    assert.equal(head.headers.get('cache-control'), 'public, max-age=3600')
    const index = await fetch(address); assert.equal(index.headers.get('cache-control'), 'no-cache'); await index.text()
    const hashed = await fetch(`${address}assets/app-abc12345.js`); assert.match(hashed.headers.get('cache-control'), /immutable/); await hashed.text()
    const post = await fetch(address, { method: 'POST' }); assert.equal(post.status, 405); await post.text()
  } finally {
    server.kill(); await new Promise(resolve => server.once('exit', resolve)); await rm(folder, { recursive: true, force: true })
  }
})
