# 流光 · 优化执行方案（交给执行模型）

> 定位：**路演大屏演示优先**；手机固定 16:9 舞台并提示横屏；同时支持部署到服务器、发链接给别人看。
> 已确认：上传照片可以缩小后保存；允许移植云朵着色器、替换 Recharts，并扩充图表类型。
> 分工：执行模型负责写普通代码；Claude 负责方案、视觉验收和阶段复核。

---

## 一、执行规则（每个任务都遵守）

1. **一个任务一次提交**，提交信息用中文，写明任务编号（如 `T1.1 保存防抖`）。
2. 每次提交前必须通过 `cd web && npm run typecheck && npm run lint && npm run test:e2e`。涉及动效、切屏的任务，再跑一次 `npm run test:e2e -- --repeat-each=3`。
3. 不得破坏固定规则：18 个版式（新增后照样固定），每屏 ≤2 个主标题、≤2 个小文本、≤6 张图，运行时不请求任何 CDN。
4. 新增或移除依赖时，同步更新 `web/THIRD_PARTY.md`、`web/COMPONENT_SOURCES.json` 和 `src/archive.ts` 里的 `组件与许可.txt` 文案。
5. 代码风格跟现有代码一致：注释用中文、密度相近，不顺手做无关重构。
6. **标了【Claude 验收】的任务**：做完后先停下，附截图和数据交给 Claude 复核，通过后再继续。

---

## 二、任务清单

### 阶段 0 · 基线（先做，所有优化都拿它对比）

**T0.1 性能基线用例** — 新建 `web/tests/perf.spec.ts`
- 测试内用 canvas 生成 6 张 4000×3000 JPEG 和一个约 200MB 的假 `video/mp4` Blob，经由 `window.flowAgent.addScene` 注入。
- 剧本 A：云朵背景、1920×1080 视口，连续切 10 屏（含六图屏）。
- 剧本 B：打开编辑浮层，往标题里逐字输入 200 字（`page.keyboard.type`，delay 20ms）。
- 剧本 C：点击“打包带走”导出含大视频的项目。
- 采集：`PerformanceObserver({ type: 'long-animation-frame' })` 统计长帧数与最长帧；CDP `Performance.getMetrics` 的 `JSHeapUsedSize` 峰值；导出耗时。
- 结果写入 `web/perf/baseline.json`。之后每个阶段生成 `web/perf/after-<阶段>.json`。

**T0.2 诊断工具（仅开发依赖）**
- `vite-bundle-analyzer`：加 `npm run analyze`。
- `react-scan`：仅在 dev 且 URL 带 `?scan` 时动态加载。

---

### 阶段 1 · 低成本高收益

**T1.1 保存防抖** — `src/App.tsx:71-94`
- 文本类变更防抖 500ms；媒体增删、换版式、删屏、导入立即保存。
- 用一个 ref 记录 `referencedMedia(project).join(',')`，只在它变化时调用 `pruneUnusedMedia()`。
- 在 `pagehide` 和 `visibilitychange`（hidden）时立即落盘；`beforeunload` 保留提示。
- `saveState` 和 `loading` 改用 ref 读取，监听器 effect 的依赖改为 `[]`。
- 验收：剧本 B 中 IndexedDB 写入次数从约 200 次降到 ≤10 次，且无 >50ms 长任务。

**T1.2 TiltedCard 唤醒修复** — `src/components/vendor/react-bits/TiltedCard.tsx:197-199`
- 删除无依赖的 `useEffect(() => wakeRef.current?.())`，改为只在 floating、intro、rotateAmplitude 等设置变化时唤醒。
- `Experience.tsx`：`editing && previewScene !== scene` 时传 `floating={false}`。

**T1.3 Blob URL 回收** — `src/App.tsx`
- 每次 `urls` 变化后，与当前项目及备份引用的媒体 id 做 diff，不再引用的执行 `URL.revokeObjectURL` 并从表中删除。

**T1.4 存储保护**
- 启动时调用 `navigator.storage.persist()`。
- 在“氛围”面板底部用 `navigator.storage.estimate()` 显示“本地已用 xx MB”。占用超过 80% 时 toast 提示用户“打包带走”备份。

**T1.5 统一着色器背景、限 30fps** — 新建 `src/backgrounds/ShaderBackdrop.tsx`
- 改用 `@paper-design/shaders` 的原生 `ShaderMount`（不走 React 包装）：`new ShaderMount(el, fragmentShader, uniforms, undefined, 0 /*speed*/, 0, 1 /*minPixelRatio*/, maxPixelCount)`。
- 自己跑 rAF：距上次 ≥33ms 才执行 `frame += dt * speed` 和 `mount.setFrame(frame)`。以下情况停止循环：`document.hidden`、暂停、编辑中、收尾屏、减少动态效果。
- 改色、调速只更新 uniform 和 speed，不重建；切换背景种类时执行 `dispose()`。
- mesh 和 grain 先迁移过来（用库导出的 `meshGradientFragmentShader` / `grainGradientFragmentShader`，参数与现在一致）；云朵在 T3.1 接入。
- 验收：120Hz 屏上背景重绘 ≤30fps，视觉与改动前一致。

**T1.6 毛玻璃降级** — `src/App.css`
- `.scene-dock` 和 `.flow-actions` 在 `@media (prefers-reduced-transparency: reduce)` 下，或 `html[data-perf=low]` 时（由 T4.9 设置），改为 92% 不透明实色，去掉 `backdrop-filter`。

**T1.7 便携服务器** — `scripts/portable-server.mjs`（保持零依赖）
- 支持 `Range`：返回 206、`Content-Range`、`Accept-Ranges: bytes`；非法范围返回 416。
- 用 `createReadStream(path, { start, end })` 流式输出，不再 `readFile` 整个文件。
- 缓存头：`assets/` 下带 hash 的文件用 `public, max-age=31536000, immutable`；`project.json` 和 `index.html` 用 `no-cache`；`media/` 用 `max-age=3600`。
- 验收：运行包在 Safari 中能播放并拖动视频；用 `curl -r 0-99` 拿到 206。

---

### 阶段 2 · 结构性（内存与卡顿的主体）

**T2.1 图片入库管线** — 新建 `src/media/process-image.ts` 和 `src/media/image.worker.ts`
- 上传、粘贴、Agent `addScene` 和导入运行包统一走这条管线。
- 在 Worker 里：先 `createImageBitmap(blob, { imageOrientation: 'from-image' })`，再按长边生成三档：
  - `master`：长边 3840（4K 大屏单图、整屏图用）
  - `medium`：长边 1920（三图及以上的版式用）
  - `thumb`：长边 400（编辑器网格用）
- 编码：先试 `OffscreenCanvas.convertToBlob({ type: 'image/webp', quality: 0.86 })`，**检查返回的 `blob.type`**（Safari 不支持 WebP 编码，会悄悄退回 PNG）。不是 webp 就改用 `image/jpeg`、quality 0.88。带透明通道的图优先 WebP，退回时用 PNG。原图比目标尺寸还小就不放大，直接重编码。
- GIF 保留原文件不处理。HEIC：Safari 能解码；Chrome 解码失败时提示“请先转换为 JPG/PNG”（可选懒加载 `heic2any` 做浏览器内转换）。
- 存储：Dexie 升级到 `version(2)`，新增 `variants` 表（主键 `id` 形如 `${mediaId}:medium`）。`media` 表里的原记录替换为 master，**不再保留原图**。
- 渲染：每屏照片数 ≤2 用 master，≥3 用 medium，编辑器缩略图用 thumb。所有 `<img>` 加 `decoding="async"`。
- 旧数据迁移：启动后在 `requestIdleCallback` 队列里逐张处理已有图片。每张成功写入新版本后才替换旧数据；失败就保留原样。
- 导出：ZIP 只带 master 和 medium，`project.json` 的媒体清单增加 `variants` 字段；播放器优先用 medium，缺失时退回 master。
- 验收：六图屏（手机原图）JS 堆加上解码内存比基线下降 ≥60%。

**T2.2 相邻屏预解码** — 新建 `src/media/decode-cache.ts`
- 切屏完成后（`onSlideChangeTransitionEnd`），对 activeIndex ± 1 的图片执行 `const img = new Image(); img.src = url; await img.decode()`，存进 Map。
- 最多保留 3 屏的图片；被淘汰的执行 `img.src = ''`。
- 下一屏是视频屏时，提前把该 `<video>` 的 preload 设为 `auto`。
- 验收：剧本 A 转场期间无 >100ms 长帧。

**T2.3 状态拆分 + 撤销重做**
- 引入 **Zustand**（`src/store.ts`）：`project`、`ui`（editing / activeIndex / previewScene / 面板 Tab）、`urls` 分成三块。
- `Experience` 只订阅当前屏、背景、转场；编辑器只订阅当前屏；底栏只订阅屏数和 activeIndex。`Experience`、`SceneContent`、背景组件加 `memo`。
- 用 **zundo** 中间件给 `project` 加撤销/重做：上限 100 步，连续打字按 500ms 合并为一步。快捷键 ⌘/Ctrl+Z、⌘/Ctrl+Shift+Z，编辑浮层顶部加两个按钮。
- `agent-api.ts` 改成读写 store，行为不变。
- 验收：用 react-scan 观察，打字时 Swiper 和背景不再重渲染。

**T2.4 流式导出 / 导入** — `src/archive.ts`、`scripts/build-player.mjs`
- 构建时不再生成 `player-runtime.zip`。改为输出 `public/player/` 目录和 `player/files.json`（文件清单）。
- 导出用 **client-zip** 的 `downloadZip()`：播放器文件逐个 `fetch` 流式写入；媒体直接传 Blob（client-zip 会按需读取，只存不压）。
- 支持 `window.showSaveFilePicker` 时（Chromium），用 `response.body.pipeTo(writable)` 直接写盘；否则执行 `await response.blob()` 再下载（内存里只有一份）。
- 导入改用 fflate 流式 `Unzip` + `UnzipInflate`：每解出一个媒体条目就写进 IndexedDB 并释放，不再整包展开在内存里。
- 验收：导出 1GB 视频项目，内存峰值不超过视频体积的 1.2 倍，期间页面可交互。

**T2.5 分包**
- `archive.ts`、预设选择对话框、旧版迁移代码、`agent-api.ts` 都改为动态 `import()`。
- 用 analyze 确认播放器入口里没有 Dexie、编辑器 UI 和 sonner。
- 目标：编辑器首屏 JS gzip ≤200KB。

---

### 阶段 3 · 体积与视觉

**T3.1 云朵移植，去掉 three + vanta**【Claude 验收】
- 来源：`docs/research/upstream/vanta/src/vanta.clouds.js` 和 `vanta.clouds2.js`，MIT 许可，保留署名。
- 新建 `src/backgrounds/clouds.frag.ts` 和 `clouds2.frag.ts`，转成 `#version 300 es`：
  - `gl_FragColor` 改为 `out vec4 fragColor`，`texture2D` 改为 `texture`。
  - `iTime` 对应 `u_time`，`iResolution` 对应 `u_resolution`，用 Paper 的 `u_pixelRatio`。
  - skyColor、cloudColor、cloudShadowColor、sunColor、lightColor 作为 vec4 uniform，用 `getShaderColorFromString` 转换颜色。
- clouds2 的噪声纹理：先把 264KB 的 PNG 转成无损 WebP，用 `ShaderMount.setTextureUniform` 注入；再试 `getShaderNoiseTexture()`，若视觉一致就去掉这张图。
- 接入 T1.5 的 `ShaderBackdrop`，像素上限沿用 230400。
- 删除 `VantaBackdrop.tsx`、`vanta.d.ts`，以及依赖 `three`、`vanta`、`@types/three`。
- 验收：固定 `frame` 后，新旧实现各截一张 1920×1080 图做像素对比，平均差异 <2%，交 Claude 目视复核。运行包体积减少约 750KB。

**T3.2 字体**
- 编辑器：构建期用 **cn-font-split** 把阿里妈妈数黑体切成 unicode-range 分片，放到 `public/fonts/alimama/`。只有当某屏选择 `alimama` 时，才动态插入它的 CSS。
- 运行包：导出时懒加载 **harfbuzzjs** 的 hb-subset（wasm），按项目全部文字加 ASCII 和常用标点做子集，生成 `fonts/alimama.woff2` 写进 ZIP；播放器的 `@font-face` 指向它。
- 字体统一加 `font-display: swap`；播放器在首屏显示前 `await document.fonts.ready`，避免上台时字体跳变。
- 验收：运行包中字体 ≤80KB；编辑器默认字体下不下载任何字体文件。

**T3.3 图表体系重做 + 扩充**【Claude 验收】（详见第四节）
- 移除 Recharts，改为 **d3-scale + d3-shape** 计算几何、自绘 SVG，用 **Motion** 做入场动画，数字滚动用 **@number-flow/react**。

---

### 阶段 4 · 路演大屏与分享

**T4.1 固定 16:9 舞台**【Claude 验收】
- 背景层仍然铺满整个视口。内容层放进 `.stage-frame`：`width: min(100vw, 100dvh * 16 / 9)`、`aspect-ratio: 16 / 9`、居中，`container-type: size`。现有 `cqw` 字号自动跟着舞台缩放。
- 遇到 16:10（MacBook）、21:9 等非 16:9 屏幕时，舞台外露出的是背景本身，不加黑边。整屏视频和收尾黑场的版式，舞台外补黑。
- 编辑浮层仍然覆盖在舞台上，不压缩舞台（保持现有原则）。
- 加“投影安全边距”开关（舞台内缩 4%），应对投影仪裁边。
- 验收：1920×1080、2560×1600、3440×1440、3840×2160 四种视口下截图，版式比例完全一致。

**T4.2 手机横屏提示**【Claude 验收】
- 条件：`(orientation: portrait) and (max-width: 900px)`，或 `(pointer: coarse)` 的竖屏设备。
- 全屏浮层沿用当前背景色：中间放 lucide `Smartphone` 图标，做 0°→90° 旋转循环动画（1.6s，带停顿）；主文案“横过来观看”，副文案“路演页面按 16:9 设计”；底部小按钮“继续竖屏观看”，点击后关闭浮层，以 16:9 舞台上下留黑边显示。
- 用户点全屏后，再尝试 `screen.orientation.lock('landscape')`（安卓 Chrome 有效，iOS 静默失败，不报错）。
- 减少动态效果时，图标不转。

**T4.3 部署到服务器 / 分享链接**
- “打包带走”旁边新增 **“发布为网页”**，导出同一份 ZIP，但附带 `部署说明.txt`：把解压后的整个目录上传到任意静态托管（Nginx、Vercel、Netlify、GitHub Pages、阿里云 OSS、腾讯云 COS）即可，这些平台都支持 Range。
- 全面检查播放器的路径都是相对路径（`base: './'` 已经是），能放在任意子路径下运行；加一个 E2E：把运行包挂到 `/sub/dir/` 下打开，能正常播放。
- 导出时往 `index.html` 写入 `<title>`（网页名）、`description`、`og:title`、`og:image`（第一张图的 medium，复制为 `share.jpg`）和 favicon。
- 打开链接的加载体验：显示带进度的加载屏；首屏的媒体和字体到位后才进入；其余媒体按顺序在后台预取；视频只预取下一屏。
- 播放器检测到 `file://` 协议时，显示中文说明，不要白屏。

**T4.4 演示者模式**（路演最重要的新功能）
- 每屏新增“演讲备注”字段（不显示在舞台上；模型、Agent API 和运行包同步支持）。
- 快捷键 `P` 或按钮打开演示者窗口：用 `window.open` 打开 `?presenter`，显示当前屏缩略、下一屏预览、备注（大字）、计时器和当前时间。两个窗口之间用 `BroadcastChannel` 同步翻页。
- 运行包和服务器部署版也支持演示者模式。

**T4.5 翻页笔与快捷键**
- 支持翻页笔常用键：`PageDown` / `PageUp`；`B` 或 `.` 黑屏、`W` 白屏（再按一次恢复）；`Home` / `End`；输入数字后按 `Enter` 跳到对应屏；`G` 打开总览网格；`?` 显示快捷键面板。

**T4.6 上台状态**
- 全屏播放时申请 Wake Lock（`navigator.wakeLock.request('screen')`），防止屏幕休眠。
- 播放状态下鼠标静止 2 秒后隐藏光标和右上角操作区，鼠标一动就恢复。

**T4.7 视频进屏自动播放**
- 视频屏新增“进入即播放”开关，演示默认打开。演示时隐藏原生控件，点击或空格切换播放/暂停；编辑时显示原生控件。
- 用户没静音时自动播放可能被浏览器拦截：拦截后显示一个居中的播放按钮，不报错。

**T4.8 演示前检查**
- “播放”按钮旁加“上台检查”，逐项检查：缺失媒体、视频编码能否解码（用 `video.canPlayType` 加 **mediabunny** 读取编码信息）、字体是否已加载、本地存储是否已持久化、总媒体体积。
- 检查完把全部媒体预热一遍（解码首帧），给出“可以上台 ✓”或问题清单。

**T4.9 设备分级**
- 用 **detect-gpu** 判断设备档位（基准数据打包进本地，不联网），WebGL 不可用也算低档。
- 低档设备：背景改为静态（frame 固定），关闭毛玻璃，照片强制静置，BlurText 改为整段淡入；在 `<html>` 上设 `data-perf=low`。
- 编辑器里显示“此设备已自动降低动效”，并允许手动覆盖。

---

### 阶段 5 · 编辑易用性（见第三节）

---

## 三、交互与易用性建议（按优先级）

| 优先级 | 建议 | 原因 | 实现要点 |
|---|---|---|---|
| P0 | **撤销 / 重做** | 目前没有，误删内容或误换版式后找不回 | 在 T2.3 中用 zundo 实现 |
| P0 | **演示者模式 + 备注** | 路演必备 | T4.4 |
| P0 | **上台检查** | 降低上台事故风险 | T4.8 |
| P1 | **在舞台上直接点字编辑** | 现在改一个字要先去右侧面板找对应输入框 | 双击舞台上的标题或小字 → 原位 `contentEditable`（纯文本，禁止粘贴富文本），失焦写回；右侧面板同步高亮对应输入框 |
| P1 | **拖放图片到图位** | 从 Finder / 桌面直接拖进来最自然 | 舞台图位和编辑器网格都接收 `drop`；拖到已有图上即替换 |
| P1 | **拖动排序** | 照片和屏的顺序现在只能靠前移按钮 | **@dnd-kit**：编辑器照片网格、底部页码条（长按拖动） |
| P1 | **图片焦点** | `cover` 裁切容易切掉人脸或产品 | 编辑器缩略图上点一下设置焦点 → 存入 `photo.focus = {x, y}` → 渲染成 `object-position` |
| P1 | **图表数据从 Excel 粘贴** | 路演数据通常已经在表格里 | 数据表格接收 TSV / CSV 粘贴，自动识别首行为分类、首列为系列 |
| P2 | **总览网格（G）** | 翻到第 20 屏后很难定位 | 网格显示各屏缩略图，点击跳转；编辑模式下支持拖动排序 |
| P2 | **字数提示** | 自适应字号遇到长文会变小，大屏上看不清 | 超过版式建议字数时，输入框下方显示淡色提示“大屏建议 ≤ N 字”，不强制 |
| P2 | **多项目** | 路演通常要准备多个版本（投资人版、客户版） | Dexie `projects` 表已支持多条；加项目列表、新建、复制、删除，`current` 改为指针 |
| P2 | **版本历史** | 备份已经存在，但用户看不到 | 把 `before-*` 备份和每天第一次保存的快照列成“历史版本”，支持预览后恢复 |
| P3 | **快捷键面板（?）** | 让快捷键可被发现 | T4.5 |
| P3 | **Agent API 同步扩展** | 让 Agent 也能用上新能力 | 备注、新图表、图片焦点、视频自动播放都进入 `ScenePatch` 和 `portable-agent.mjs` |

---

## 四、图表体系（T3.3 详细说明）

**新增版式**（仍然是固定预设，18 → 24 个）：

| 预设 id | 名称 | 数据上限 | 路演用途 |
|---|---|---|---|
| `chart-line`（已有） | 趋势图表 | 12 点 × 3 系列 | 增长趋势 |
| `chart-full`（已有） | 一页图表 | 同上 | 单图强调 |
| `chart-bar` | 柱状对比 | 8 类 × 2 系列 | 年度、季度对比 |
| `chart-donut` | 占比环形 | 6 段，中心大数字 | 市场份额、收入构成 |
| `kpi` | 关键数字 | 1–3 个数字，各带标签和涨幅 | “用户 320 万，同比 +210%” |
| `timeline` | 里程碑 | 3–6 个节点 | 发展历程、路线图 |
| `funnel` | 转化漏斗 | 3–5 层 | 获客转化 |
| `compare` | 对比条 | 2–5 项指标 × 2 方 | 我们 vs 竞品 |

**数据模型**（`src/model.ts`）
- 扩展 `SceneChart`：增加 `kind: 'line' | 'area' | 'bar' | 'donut' | 'funnel' | 'compare'`、`unit?`、`highlight?`（要强调的索引）。
- 新增字段 `metrics?: { value: number; unit?: string; label: string; delta?: string }[]`（kpi 用）和 `milestones?: { date: string; title: string }[]`（timeline 用）。
- `normalizeScene` 统一按上表截断。旧的 `chart` 数据默认 `kind = 'line'`，兼容不变。

**实现**
- 共用组件 `src/charts/ChartFrame.tsx`：用 `ResizeObserver` 取尺寸，`d3-scale` 计算比例尺，`d3-shape` 的 `line`、`area`、`arc`、`pie` 生成路径，全部输出成 SVG。
- 入场动画：线条和弧用 Motion 的 `pathLength` 0→1（900ms，easeOut）；柱子从基线升起，每根错开 60ms；数字用 NumberFlow 从 0 滚到目标值。减少动态效果时直接显示终态。
- 编辑器：一个统一的数据表格组件（支持粘贴 TSV），切换 `kind` 时尽量保留已有数据。

**视觉方向（Claude 会按这些验收）**
- 只有一种强调色：取文字色板中的主色，其余系列降到 35–45% 不透明度。
- 不用图例，标签直接贴在线尾或柱顶；网格线最多 3 条，宽 1px、透明度 10%；坐标轴只保留底部基线。
- 大屏可读：标签字号不小于 `1.6cqw`（1920 宽下约 30px），数值字号不小于 `2.2cqw`；KPI 的主数字用 `9–12cqw`。
- 字体跟随该屏选择的字体；数字一律用 `font-variant-numeric: tabular-nums`。
- 深色色板下自动反色，对比度至少达到 WCAG AA。

---

## 五、开源项目总表

| 项目 | 许可 | 用在哪 | 说明 |
|---|---|---|---|
| @paper-design/shaders `ShaderMount` | Apache-2.0（已在依赖中） | T1.5、T3.1 | 四种动态背景统一用它 |
| Vanta clouds 着色器源码 | MIT（已在 docs/research 中） | T3.1 | 只移植 GLSL，保留署名 |
| Zustand | MIT | T2.3 | 状态拆分 |
| zundo | MIT | T2.3 | 撤销 / 重做 |
| client-zip | MIT | T2.4 | 流式导出 ZIP |
| fflate（已有，改用流式 API） | MIT | T2.4 | 流式导入 |
| cn-font-split | Apache-2.0 | T3.2 | 构建期字体分片，不进运行包 |
| harfbuzzjs（hb-subset） | MIT | T3.2 | 导出时字体子集化，懒加载 |
| d3-scale、d3-shape | ISC | T3.3 | 图表几何，替代 Recharts |
| @number-flow/react | MIT | T3.3 | KPI 数字滚动 |
| Motion（已有） | MIT | T3.3 | 图表入场动画 |
| @dnd-kit/core、@dnd-kit/sortable | MIT | 第三节 | 拖动排序 |
| mediabunny | MPL-2.0 | T4.8 | 读取视频编码信息；后续可在浏览器内压缩视频 |
| detect-gpu | MIT | T4.9 | 设备分级 |
| heic2any（可选） | MIT | T2.1 | Chrome 下转换 HEIC |
| vite-bundle-analyzer | MIT | T0.2 | 仅开发依赖 |
| react-scan | MIT | T0.2 | 仅开发依赖 |

**移除**：three、vanta、@types/three、recharts。
**不引入**：ffmpeg.wasm（体积太大）。也不替换 Swiper、Motion、Dexie。

---

## 六、Claude 复核节点

1. **T0.1 完成后**：交基线数据，由 Claude 确认指标口径。
2. **T3.1**：新旧云朵截图对比。
3. **T3.3**：交 8 种图表在浅色、深色色板下的截图（1920×1080）。
4. **T4.1 / T4.2**：交四种视口的舞台截图，以及手机竖屏提示的录屏。
5. **每个阶段结束**：交 `perf/after-<阶段>.json` 与基线的对比。

## 七、总验收指标

| 指标 | 目标 |
|---|---|
| 编辑时连续输入 | 无 >50ms 长任务 |
| 切换到六图屏（手机原图） | 转场期间无 >100ms 长帧，解码内存比基线下降 ≥60% |
| 编辑器首屏 JS（gzip） | ≤200KB |
| 播放器体积（不含用户媒体） | ≤600KB（现约 2.5MB） |
| 导出 1GB 视频项目 | 内存峰值 ≤ 视频体积 × 1.2，页面可交互 |
| Safari 中的运行包 / 部署链接 | 视频可播放、可拖动 |
| 1080p、1600p、21:9、4K 四种视口 | 16:9 舞台版式完全一致 |
