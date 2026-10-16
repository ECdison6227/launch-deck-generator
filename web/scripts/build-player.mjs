import { zipSync } from 'fflate'
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const source = resolve(root, '.player-build')
const target = resolve(root, 'public/player')
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true })
await cp(resolve(target, 'player.html'), resolve(target, 'index.html'))
await rm(resolve(target, 'player.html'))
await cp(resolve(root, 'scripts/portable-server.mjs'), resolve(target, 'start.mjs'))
await cp(resolve(root, 'scripts/portable-agent.mjs'), resolve(target, 'agent.mjs'))
await cp(resolve(root, 'src/presets.json'), resolve(target, 'presets.json'))
const files = []
async function walk(dir) { for (const item of await readdir(dir, { withFileTypes: true })) { const path = resolve(dir, item.name); if (item.isDirectory()) await walk(path); else files.push(relative(target, path).replaceAll('\\', '/')) } }
await walk(target)
await writeFile(resolve(target, 'manifest.json'), JSON.stringify({ version: '0.2.0', builtAt: new Date().toISOString(), files }, null, 2))
try { await readFile(resolve(root, 'dist/index.html')); await rm(resolve(root, 'dist/player'), { recursive: true, force: true }); await cp(target, resolve(root, 'dist/player'), { recursive: true }) } catch {}
const runtimeFiles = Object.fromEntries(await Promise.all(files.map(async file => [file, new Uint8Array(await readFile(resolve(target, file)))])))
const runtimeZip = zipSync(runtimeFiles, { level: 6 })
await writeFile(resolve(root, 'public/player-runtime.zip'), runtimeZip)
try { await readFile(resolve(root, 'dist/index.html')); await writeFile(resolve(root, 'dist/player-runtime.zip'), runtimeZip) } catch {}
console.log(`Portable player: ${files.length} local files → public/player`)
