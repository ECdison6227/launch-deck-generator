import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(fileURLToPath(import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.woff2': 'font/woff2', '.wasm': 'application/wasm' }
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); return response.end() }
    const url = new URL(request.url, 'http://127.0.0.1')
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!path.startsWith(root + sep)) { response.writeHead(403); return response.end('Forbidden') }
    const info = await stat(path)
    if (!info.isFile()) throw new Error('Not a file')
    const headers = { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Content-Length': info.size,
      'Cache-Control': /\/assets\/[^/]+-[\w-]{8,}\./.test(url.pathname) ? 'public, max-age=31536000, immutable' : path.includes(`${sep}media${sep}`) ? 'public, max-age=3600' : 'no-cache' }
    let start = 0; let end = info.size - 1; let status = 200
    // HEAD 按完整资源返回；GET 支持单段和后缀范围，拒绝多段与越界请求。
    if (request.headers.range && request.method === 'GET') {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
      if (range && (range[1] || range[2])) {
        start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]))
        end = range[1] && range[2] ? Math.min(Number(range[2]), end) : end
      } else start = -1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= info.size) {
        response.writeHead(416, { 'Content-Range': `bytes */${info.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': 0 }); return response.end()
      }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`; headers['Content-Length'] = end - start + 1
    }
    response.writeHead(status, headers)
    if (request.method === 'HEAD' || !info.size) return response.end()
    const stream = createReadStream(path, { start, end })
    stream.on('error', () => response.destroy())
    response.on('close', () => stream.destroy())
    stream.pipe(response)
  } catch { response.writeHead(404); response.end('Not found') }
})
server.on('error', error => { if (error.code === 'EADDRINUSE') server.listen(0, '127.0.0.1'); else { console.error(error); process.exit(1) } })
server.listen(Number(process.env.PORT || 4177), '127.0.0.1', () => { const port = server.address().port; console.log(`\n流光网页已启动：http://127.0.0.1:${port}/\n在浏览器打开此地址。方向键 / 空格切换，F 或右上按钮全屏。\n按 Ctrl+C 停止。\n`) })
