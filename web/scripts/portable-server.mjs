import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = dirname(fileURLToPath(import.meta.url))
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' }
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1')
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
    if (!path.startsWith(root + sep)) { response.writeHead(403); return response.end('Forbidden') }
    const info = await stat(path)
    if (!info.isFile()) throw new Error('Not a file')
    const data = await readFile(path)
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(request.method === 'HEAD' ? undefined : data)
  } catch { response.writeHead(404); response.end('Not found') }
})
server.on('error', error => { if (error.code === 'EADDRINUSE') server.listen(0, '127.0.0.1'); else { console.error(error); process.exit(1) } })
server.listen(Number(process.env.PORT || 4177), '127.0.0.1', () => { const port = server.address().port; console.log(`\n流光网页已启动：http://127.0.0.1:${port}/\n在浏览器打开此地址。方向键 / 空格切换，F 或右上按钮全屏。\n按 Ctrl+C 停止。\n`) })
