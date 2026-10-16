# 组件与素材来源 · v0.3

实际版本固定在 package.json 和 package-lock.json。应用只编写页面组合、槽位配置、主题样式、数据、素材保存和事件接线；未编写基础控件、shader、拖拽、播放器控件或动画引擎。

| 能力 | 来源 / 实际版本 | 许可 / 本地处理 |
| --- | --- | --- |
| React | [官方](https://react.dev/) / 19.3.1 | MIT；npm 原包 |
| 构建 | [Vite](https://vite.dev/) / 8.3.4、TypeScript 6.0.3 | MIT / Apache-2.0；npm 原包 |
| 编辑基础控件 | [shadcn/ui](https://ui.shadcn.com/docs/components) / CLI 4.21.5，new-york registry | MIT；官方生成文件在 src/components/ui，未改组件实现，保留 LICENSE.md |
| 统一交互基础 | [Radix UI](https://www.radix-ui.com/) / radix-ui 1.8.1 | MIT；全部基础交互选择同一 Radix 分支 |
| 背景 | [Paper MeshGradient](https://shaders.paper.design/mesh-gradient) / @paper-design/shaders 0.0.81 | Apache-2.0；只传 colors、speed、质量预算参数 |
| 网页切屏 | [Swiper React](https://swiperjs.com/react) / 14.3.0 | MIT；Creative、Keyboard、Mousewheel、A11y 官方模块 |
| 自动文字出场 | [React Bits BlurText](https://reactbits.dev/text-animations/blur-text) / 同下方固定 commit | MIT + Commons Clause；原样源码，使用 load 触发与内置 blur / focus / drift；依赖 Motion 12.23.24 |
| ZIP 打包 | [fflate](https://github.com/101arrowz/fflate) / 0.8.3 | MIT；异步 ZIP / unzip 与应用数据接线 |
| 倾斜卡片 | [React Bits TiltedCard](https://reactbits.dev/components/tilted-card) | 固定 commit 43591e8b3fa327d45633b4e8239ff6742ef706ef，MIT + Commons Clause；基于固定上游源码，LICENSE.md 同目录；CSS 保持原样；TSX 的唤醒 effect 已做下述本地修复 |
| 图标 | [Lucide](https://lucide.dev/) / lucide-react 1.57.0 | ISC；直接组合所需图标 |
| 保存 | [Dexie](https://dexie.org/) / 4.4.6 | Apache-2.0；IndexedDB 项目和 Blob 表 |
| 折线图 | [Recharts](https://recharts.org/) / 3.10.1 | MIT；官方 ResponsiveContainer / LineChart / Line，未改组件实现 |
| 背景（颗粒渐变） | [Paper GrainGradient](https://shaders.paper.design/) / @paper-design/shaders 0.0.81 | Apache-2.0；只传官方颜色与强度参数（v0.3.1 移除 DotGrid 用法） |
| 背景（云朵） | [Vanta CLOUDS / CLOUDS2](https://www.vantajs.com/) / vanta 0.5.24（tengbao） | MIT；官方现成效果，按需加载；three 0.186.1 MIT。CLOUDS2 必需的纹理取自 [官方 noise.png](https://www.vantajs.com/gallery/noise.png)，本地保存在 `src/assets/vanta-clouds2-noise.png`，由 Vite 打包供离线加载。使用官方 scale 参数降低背景渲染开销，未改 shader。 |
| 展示字体 | [阿里妈妈数黑体](https://www.fonts.net.cn/font-38198516477.html) / @fontpkg/alimama-shu-hei-ti 1.0.5 | 官方免费可商用声明随包；Bold woff2 本地打包进 assets，无外站字体依赖 |
| 结尾收束影幕 | [Motion](https://motion.dev/) / motion 12.23.24 | MIT；官方 motion.div 淡入参数，沿用 hark-ui-research 调研的模式时长区间建议（不使用其无许可代码） |
| 英文常用字体 | Georgia / Arial / Trebuchet MS / Verdana / Courier New | 系统字体栈，运行时未加载字库文件；“圆润无衬线”已移除 |
| 样式与通知 | Tailwind CSS 4.3.3、tw-animate-css 1.4.0、Sonner 2.0.8 | MIT；官方样式与组件，不增加动效引擎 |
| 浏览器验证 | Playwright 1.64.1 | Apache-2.0；仅开发依赖 |

React Bits 的 Commons Clause 有额外分发限制，并非 OSI 意义的无附加限制 MIT。上游许可允许作为应用的一部分使用，禁止单独或成套转售 / 再分发组件本身；完整原文保留在 vendor 目录。本项目集成时未移除这些条款。

shadcn 基础控件包括 Button、Input、Textarea、Label、Select、Tabs、Slider、Switch、Card、Table、Dialog、AlertDialog、ScrollArea、AspectRatio、Alert、Sonner，新版另使用 Sheet。原生文件 input 和 video 使用浏览器现成行为。原生 ResizeObserver 只通知 reveal.layout() 适配舞台尺寸。React Bits 的内部物理、文字动画和 CSS 来自上游；TiltedCard 的唤醒时机已做下述修复。v0.2 已移除 reveal.js 依赖；Swiper 负责网页场景切换。

## 本地演示素材

- public/media/botanical.jpg：[Unsplash 原图](https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1600&q=85)，[Unsplash License](https://unsplash.com/license)，1600px 本地副本，用于主图与图文代表页。
- public/media/flower.mp4：[MDN 官方交互示例视频](https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4)，CC0 素材目录；H.264 / AAC、960×540、5.055 秒，1,128,375 bytes。本地副本用于视频代表页。
- 首次打开时将这两份本地素材写入 IndexedDB；运行时不请求图片 CDN 或视频外站。用户上传素材只保存在当前浏览器。

生成组件与原样上游文件的 SHA-256、来源和修改声明见 COMPONENT_SOURCES.json。未接入根目录既有 shader，也未提取 Hark 的业务实现。

## v0.2 新增素材与运行包

- alpine.jpg：[Unsplash 原图](https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=82)，山间星空。
- ocean.jpg：[Unsplash 原图](https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=82)，海浪。
- woodland.jpg：[Unsplash 原图](https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1000&q=82)，林间。
- dunes.jpg：[Unsplash 原图](https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1000&q=82)，沙丘。
- hills.jpg：[Unsplash 原图](https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1000&q=82)，晨雾山丘。

均为 [Unsplash License](https://unsplash.com/license) 下的本地代表素材，可被用户替换。默认六图组合使用六个不同画面。

BlurText 固定 commit `43591e8b3fa327d45633b4e8239ff6742ef706ef`，路径 `src/ts-default/TextAnimations/BlurText/BlurText.tsx`。SHA-256 与上游一致：`ff976389990b9f25376ad491dabd66262913cc574151d54f205fcd4ca05d7ed6`。TiltedCard 基于同一 commit，本次仅调整动画唤醒 effect 的依赖，详见下方。卡片直接开启官方 floating / intro 参数，文字使用 BlurText 的官方 trigger / effect 参数，没有在应用中复制其引擎。

ZIP 包内包含 React Bits 和 shadcn 完整许可原文；播放器作为完整应用打包，不单独分发可复用组件库。`scripts/portable-server.mjs` 只使用 Node 内置模块提供本地静态文件，属于运行接线。

12 个受限页面预设 + v0.3 新增 6 个（影像主张、纯影像、趋势图表、一页图表、结尾收束、信息对照）：仍沿用同一 src/presets.json，结构、比例、字体大小为应用布局与主题参数；预设不包含自制基础控件或动效。Agent 调用沿用同一配置。

用户调研目录 `/Users/cjr/Projects/hark-ui-reserch` 中的动效实现为 hark.com 专有且无许可，本版未搬运其中任何代码；仅参考其报告中的时长区间建议。未复制 shader、物理积分器或压缩 bundle 片段。

## 性能优化新增与修改（2026-10-16）

| 项目 | 版本 / 许可 | 实际用途 |
| --- | --- | --- |
| [Paper Shaders](https://github.com/paper-design/shaders) | 0.0.81 / Apache-2.0 | 直接使用 ShaderMount 和官方 mesh / grain GLSL；原色彩与参数不变，应用限制 30fps，编辑、隐藏、减少动效时暂停。移除无使用方的 shaders-react 包。 |
| [client-zip](https://github.com/Touffy/client-zip) | 2.5.1 / MIT | 逐个读取运行时与媒体，生成 ZIP 流；支持 File System Access 时直接写盘。 |
| [Zustand](https://github.com/pmndrs/zustand) | 5.0.15 / MIT | 项目状态独立存储；UI、Blob URL 状态留在各自所有者内。 |
| [zundo](https://github.com/charkour/zundo) | 2.3.0 / MIT | 100 步历史、连续编辑合并、撤销/重做；历史仅含项目数据，不复制 Blob。 |
| [vite-bundle-analyzer](https://github.com/nonzzz/vite-bundle-analyzer) | 1.3.9 / MIT | 仅开发依赖，生成静态体积报告。 |
| [react-scan](https://github.com/aidenybai/react-scan) | 0.5.7 / MIT | 仅开发依赖，开发 URL 带 `?scan` 时加载；生产构建移除该分支。 |

fflate 0.8.3 保留，导入改为 Unzip / UnzipInflate 流式解析，不再同时持有整包压缩数组与全部解压数组。压缩媒体的解压在主线程逐块进行；导入仍需完整验证后原子切换项目。

TiltedCard.tsx 本地修改：把每次渲染都会触发的唤醒 effect 改为只依赖交互与动画设置，避免编辑文字时重新启动静止卡片。没有移除 Commons Clause 或版权署名；修改后的 SHA-256 已记录在 COMPONENT_SOURCES.json。

图片尺寸处理、相邻屏解码缓存、持久化队列与状态订阅接线属于本应用代码；不新增图像处理依赖。尚未替换 Vanta/Three.js 和 Recharts。
