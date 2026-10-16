# 不适用设置禁用与右上角操作框：2026-10-16

- 收尾固定黑场与已有视频的纯影像页禁用背景样式、色板、Hex、速度和暂停控件，并说明需切换页面修改全局背景。普通版式恢复可编辑。暂停背景时禁用速度滑块，纯色背景只启用第一个色位，CLOUDS2 禁用未使用的第三个色位。
- 主标题为零时禁用文字出场，关闭灵动时禁用效果和预览；纯影像禁用不适用的灵动开关，纯单图 / 纯影像禁用脚注；静置单图无需重播。收尾的深色文字选项置灰，Hex 输入拒绝不可读的深色值。共享 `getSceneInk` 同时供编辑器和播放器使用，保持原有深色文字回退规则，编辑器显示实际呈现的颜色。
- 右上角操作区使用独立、不透明的浅色背景框及固定文字 / 图标颜色，取消全屏时将整条顶栏压到 25% 透明度的规则。编辑器与独立播放器共用样式。
- `npm run build`（含 TypeScript 与独立播放器）和 `npm run lint` 通过，保留现有 lint / 大 chunk 提示。完整 Playwright 单轮 **19/19 通过**，无跳过 / 重试；报告为 `evidence/controls-availability/regression.json`。
- 另对浅色、纯黑、云朵、收尾、编辑 / 全屏及悬停状态完成 10 组操作区检查，最低文字对比度约 **7.75:1**，没有 pageerror。1440×900、1024×768、390×844 下操作框均位于视口内，已查看截图；测量与图片为 `evidence/controls-availability/visual-check.json` 及同目录 PNG。

---

# 编辑浮层保持完整画面：2026-10-16

- 修复打开编辑框时将画布减去 390px、改变字号 / 图位和移动导航的问题。移除编辑专用版式与窄屏压暗规则，面板直接覆盖在完整画面上，编辑与播放使用同一构图；收尾黑场覆盖整个视口，右侧不再露出云朵背景。
- 修复前在 1568px 视口实测画布由 1568px 变为 1178px，主标题由 106.624px 变为 80.104px；原始测量在 `evidence/editor-overlay/before-fix.json`。
- 新增布局回归：1568×884、1024×768、390×844 三种视口，各检查三图、画廊、收尾三个模板，共九组。打开与收起面板前后的画布、文字、图片、导航坐标和字号完全一致，收尾黑场与视口同宽同高。
- `npm run build`（含 TypeScript 和独立播放器）、`npm run lint` 通过，保留现有 lint 与大 chunk 提示。完整 Playwright 回归单轮 **17/17 通过**，无跳过 / 重试，结果为 `evidence/editor-overlay/regression.json`。
- DPR 2 下另检查电脑、平板、手机的三图和收尾六组画面，开关面板的几何测量一致、无 pageerror；已查看截图，记录为 `evidence/editor-overlay/visual-check.json`，截图同目录。
- 本地预览：http://127.0.0.1:5173/。

---

# 云朵性能、收尾与页码导航：2026-10-16

- 云朵背景按宿主尺寸和设备像素比限制到 230400 像素，常态调度不高于 30fps；编辑、收尾、暂停、速度为零及页面不可见时取消连续绘制，保留同一 canvas，恢复后继续。CLOUDS2 首次暂停会等待本地纹理载入再停。保存后的媒体回收只读取主键，不再反复读取全部 Blob。
- 结尾收束使用独立黑场及清晰字幕，停留 2.2 秒后用 1.4 秒完整淡出到纯黑；已有深色文字自动保证黑场可读。编辑中不自动黑屏，主动预览保留面板，修改文字立即退出预览，取消了会突然恢复字幕的固定预览计时器。
- 编辑器和便携播放器导航仅显示页码，移除逐屏名称输入；删除确认也按页码标识。保留 `name` 兼容元数据，并修复默认名称随版式更新。README 与 Agent 调用说明已同步。
- `npm run build`（含 TypeScript 与便携播放器）及 `npm run lint` 通过；lint 仍有现有组件 / refs 提示，构建仍有大 chunk 提示。
- 全量 16 项中 15 项通过，ZIP 项在 Chromium 截图时出现 `Unable to capture screenshot`，原始记录为 `evidence/current-regression.json`。调整测试，在独立播放器运行期间释放源编辑器的 WebGL，再复验 ZIP 完整流程 1/1 通过，记录为 `evidence/current-portable-recheck.json`；不把两轮描述为单轮 16/16。
- 1440×900、DPR 2 实测云朵 canvas 为 230053 像素；1440×900 与 390×844 下双标题完整可见，最终黑场、编辑文字恢复及暂停时的 CLOUDS2 纹理均已检查，未捕获 pageerror。截图和测量保存在 `evidence/current-fix/`。不将这些检查当作 Safari / Firefox 或实际投影帧率成绩。
- 本地开发预览：http://127.0.0.1:5173/。

---

# 结尾页标题修复：2026-10-16 14:06（北京时间）

用户反馈结尾页最上方文字缺失。实际复现发现 `.composition-outro .scene-copy` 继承通用 `translateY(-50%)`，1440×900 下容器移到 y=-450，首标题顶部 y=-90.08 被裁切。结尾页现在显式 `transform: none`，由既有 Grid 居中；相同标题顶部回到 y=359.92。未修改动效库和黑幕参数。

- `npm run build` 通过，`npm run lint` 退出 0（保留现有提示）。
- 现有结尾 / 转场回归新增标题在屏幕内的断言，定向执行 1/1 通过：`evidence/outro-regression.json`。
- 1440×900、1280×720、390×844 分别检查运行包单标题与编辑器双标题，6 组均完整可见；正常动态模式确认标题先显示、后淡出至黑，合计 7 项通过、无 pageerror：`evidence/outro-fix/results.json`。
- 截图：`evidence/outro-fix/title-before-blackout.png`、`two-headings-1440.png`、`two-headings-390.png`、`blackout.png`。
- ZIP 与 4188 预览已更新，14 项运行文件与本次构建一致；原项目 JSON 与媒体保留。SHA-256 见 `evidence/outro-package-audit.json`。此前运行包与预览有 `.before-outro-*` 备份。

---

# 最新验收：2026-10-16 12:11（北京时间）

当前编辑器 http://127.0.0.1:5273/；便携播放器 http://127.0.0.1:4188/。以下旧版记录保留为历史，本节为最新交付状态。

- 新项目采用 Swiper Fade 450ms、文字整段轻淡入（Motion）、图片静置，背景默认速度 0.18。逐字聚焦 / 掠入、卡片浮动 / 抬升按屏选用；小字只整段淡入，脚注静态。已有显式效果设置继续保留。Agent 与编辑器使用一致的默认值。
- CLOUDS2 原先缺少默认的 `gallery/noise.png`。现使用 Vanta 官方纹理，保存在 `src/assets/vanta-clouds2-noise.png`，通过 Vite URL 随运行包分发；官方 `scale: 2 / scaleMobile: 3` 参数降低渲染开销，未改 shader。测试断言真实同源 200 响应及 PNG 文件头。
- `npm run build`（含 TypeScript 与独立播放器）通过；`npm run lint` 退出 0，仍有现有 Fast Refresh / refs 提示。构建保留大 chunk 提示。
- 首轮 14 场景中 12 通过：图片流程超时、云朵测试关闭 trace 时因另一个遗留测试进程抢写目录失败，原始结果完整保存在 `evidence/final-regression.json`。独立目录复验两项均通过，见 `evidence/final-recheck.json`。补齐纹理后，云朵和 ZIP 场景再次验证 2/2 通过，见 `evidence/final-clouds-package.json`。不宣称三轮全量通过。
- 根因追查确认：切换代理后，本项目旧 `kimi-code` 进程仍不断启动回归。已终止旧代理及其回归任务；开发服务已独立重启，不依赖测试进程存活。
- Computer Use 实际操作：文字出场、图片效果、切屏转场；选项切换自动收起预览；刷新后 `fade / still / fade` 恢复。4188 读取新播放器、图片全部解码，图表屏可见。托管浏览器拒绝 Fullscreen API 时，应用显示窗口播放提示；原生全屏进入 / 退出及键盘切屏已由 Playwright 独立浏览器验证通过。
- 最终 ZIP 保留 6 屏演示与 7 项媒体，运行文件逐字节比对 `public/player` / `dist/player`，14/14 一致，并已解压更新 4188。旧预览保存在 `releases/.previous-preview-*`。最终大小、SHA-256 和时间见 `evidence/final-package-audit.json`。
- 新截图：`evidence/v3/calm-computer-use.jpg`、`evidence/v3/current-player-chart.jpg`。未将截图当作动画帧率或跨浏览器性能证明。

---

# 流动网页 v0.2 实际验收

日期：2026-10-15。方向按用户后续说明修正：整屏 HTML 网页叙事，以流动背景、文字自动出场、圆角图片卡片的自然入场与轻浮为主；编辑按需打开，不沿用三栏 PPT 工作区。

## 本版约束

12 个固定预设覆盖：只说一句、两行主张、一段叙事、一张照片、一图一文、一图叙事、双图对话、双图叙事、三图灵感、四图故事、六图画廊、影像时刻。

每个预设固定主标题、小文本和图片位，整体上限 2 / 2 / 6。没有自由坐标、拖拽、手动字号或元素数量按钮。用户替换内容，选择背景、字体、文字颜色和现成文字 / 图片效果；字号按字数和可用区域配置。切换前会保存项目备份。旧表格页作为兼容内容保留。

## 环境与检查

- macOS 26.5，Apple M1 / 8 GB，Node 26.10.0。
- Playwright 1.64.1 / Chromium 156.0.8078.4，独立浏览器上下文。未操纵用户的前台浏览器或系统剪贴板。开发服务器使用 5273 端口（5173 被本机另一项目占用），playwright.config.ts 保持一致。
- 浏览器主要检查 1440×900，编辑预览与便携播放器使用同一 Experience 与 preset 配置。
- `npm run typecheck`、`npm run build` 通过；`npm run lint` 无错误，保留原样上游组件的 Fast Refresh / refs 提示及入口文件的 Fast Refresh 提示。
- 编辑器构建 JS 约 853 kB / gzip 273 kB；播放器 JS 约 531 kB / gzip 171 kB。Vite 单 chunk 大小提示保留，未声称消除该提示。

## 已实际走过的流程

| 场景 | 实际证据 |
| --- | --- |
| 整屏与灵动 | 不存在原三栏 / 缩略图 / 画布框；无需按步骤点击，文字自动由模糊到清晰；指针静止时卡片 transform 继续改变 |
| 常驻背景 | 翻页前给 canvas 标记，翻页后标记保留，页面只有一个背景 canvas |
| 受限预设 | 新建先选择 12 个预设之一；固定文字位，未提供自由增删；图片数量按当前预设封顶 |
| 文字修改 | 改主标题 / 小文本，网页立即更新，等待真实写入后刷新读取一致 |
| 图片输入 | 多选真实 JPEG；浏览器 DataTransfer / ClipboardEvent 粘贴真实 File；到六张后继续粘贴被限制；刷新后 Blob 重新建立并解码 |
| 页面管理 | 新建、复制、排序、确认删除，刷新保留位置与内容 |
| 视频 | 实际选择 MP4，原生 video.play() 后 currentTime 增加；切屏后读取旧元素 paused=true；离页暂停与原生全屏均验证 |
| 全屏 / 导航 | 检查 fullscreenElement 成功；空格、方向键切屏，Esc 退出 API 全屏；底部按钮跳到指定屏 |
| 配色 / 效果 | 配色、背景暂停和灵动开关刷新后恢复，API 字体 / 文字颜色 / 效果落入同一数据结构 |
| 保存失败 | 注入 QuotaExceededError，显示错误、保留当前输入，恢复写入后重试并刷新读回 |
| 旧项目 | v0.1 真实格式写入数据库后升级，原标题 / 正文保留，v0.1-backup 原件存在 |
| 浏览器 Agent | 实际调用 window.flowAgent，选择文字预设、字体、颜色、文字与图片效果，修改背景，刷新后读回 |
| Agent 直接交素材 | addScene 一次提交多屏 base64 图片 / 视频与文字：图片即时刻载、视频播放且离页自动暂停、刷新后 Blob 恢复；超过预设槽位只采用前 N 张并如实返回 ignoredImages |
| 便携 Agent 带文件 | agent.mjs add 把本地图片文件复制进运行包、登记媒体清单、末尾新建屏；播放器刷新后新屏图片解码、媒体文件逐一存在 |
| ZIP 导出 | 点击下载，解包检查 HTML、JS / CSS、媒体、project.json、启动器、agent.mjs、presets.json、许可原文 |
| 跨来源运行 | 解压到独立临时目录，真实 spawn Node start.mjs，打开随机新端口，阻断外站请求，图片成功解码、视频真实播放，未创建 IndexedDB |
| ZIP 中 Agent | 实际运行 node agent.mjs apply patch.json，刷新播放器，标题变成 CLI 写入内容 |
| 导回编辑 | 对当前内容做临时修改后导入 ZIP，读取包内原内容，继续编辑成功 |

完整 **10 个场景 × 3 轮 = 30 通过**。报告保存在 `evidence/v2/full-regression-report/index.html`。最后一次按可用容器微调自动字号后，又对固定预设、浏览器 Agent 与 ZIP 各重复三轮，**9 项全部通过**。回归脚本为 `tests/workbench.spec.ts`。

2026-10-16 增补 Agent 交付素材能力后，全量 **11 个场景 × 3 轮 = 33 通过**，最终结果保存在 `evidence/playwright-report/index.html`。来源 5273 开发服务器同时服务编辑器测试，未与 5173 上其他项目冲突。

## v0.3 提升维度验收（同日）

| 场景 | 实际证据 |
| --- | --- |
| 18 个预设 | 新增影像主张 / 纯影像 / 趋势图表 / 一页图表 / 结尾收束 / 信息对照；`listPresets()` 与新建对话框均 18 项 |
| 视频版式 | cinema-quote 真实 MP4 播放、离页自动暂停、双流保留；film 整屏实测 `video-slot` 覆盖 1440×900 |
| 深色与纯色背景 | ink / carbon / stars 色板经 flowAgent 应用后背景 kind 正确（carbon 时无 shader canvas，实测背景色 rgb(13,15,20)） |
| 文字色板 | 8 个 ink swatch + 任意 Hex；实测浅色文字在深色背景渲染为 rgb(244,246,250) |
| 脚注 | `footnote` 字段渲染为 `.scene-footnote` 并随刷新持久化；便携包 agent.mjs 可写入并显示 |
| 折线图 | SceneChartView（Recharts 3.10.1）离线本地渲染 SVG，与文字区间不重叠；编辑器内增删数据点 |
| 结尾收束 | outro veil 用 Motion 官方淡入参数，实测 2 秒内 opacity ≥0.95，便携运行包同样渐暗到黑 |
| 切屏转场 | Swiper 现成 creative / fade / cards 切换刷新后保留；cards 转场对应水平 Swiper |
| 便携包 v0.3 | 真实解压 spawn Node start.mjs，agent.mjs apply（不写 scene 只改转场 / 背景），agent.mjs add 新增图表屏，播放器全链路刷新可见 |

完整 **13 个场景 × 3 轮 = 39 通过**，结果保存在 `evidence/playwright-report/index.html`。定位脚本仍为 `tests/workbench.spec.ts`。hark-ui-research 目录是 hark.com 专有逆向产物、无许可，未搬任何代码；只参考其报告中的时长区间建议。

新增证据截图：`evidence/v3/editor-atmosphere.png`、`preset-picker.png`、`dark-ink.png`、`chart-scene-dark.png`、`dots-bg.png`、`cinema-quote.png`、`film-fullscreen.png`、`outro-black.png`、`player-outro.png`。

## v0.3.1 调整验收（同日）

按用户反馈删除网格 / 星点色板与 dots 背景类型；删除流光品牌标志；删除“圆润无衬线”；字体扩充为系统无衬线 / 宋体 / 阿里妈妈数黑体 + Georgia / Arial / Trebuchet MS / Verdana / Courier New 英文常用字体栈；色板每个绑定推荐文字色，换色板 / setBackground preset 时整页文字色自动跟随；切换文字效果、图片效果、转场后自动退出编辑预览一遍；新增 Vanta（vantajs.com，tengbao，MIT）CLOUDS / CLOUDS2 两种云朵背景，按需动态加载 three 与 vanta chunk。

| 场景 | 实际证据 |
| --- | --- |
| 品牌标志删除 | .flow-wordmark 与 .identity-separator 均不存在，顶栏只显示项目名 |
| 云朵背景 | cumulus 实测 .vanta-backdrop canvas 挂载并有 WebGL 上下文；dusk 同样；关掉后背景 canvas 移除 |
| 文字色联动 | cumulus → 全屏文字色自动切到 #2f3d55；dusk → #f5e9da |
| 阿里妈妈数黑体 | document.fonts.check("700 40px 'Alimama ShuHeiTi'") 为 true；woff2 随 assets 打进运行包 |
| 英文常用字体 | georgia / arial / trebuchet / verdana / courier 落成系统字体栈；rounded 输入被拒绝回退 sans |
| 自动预览 | 切转场自动去下一屏再回来；切文字 / 图片动效自动收起编辑重放当前屏 |

旧记录曾写为“14 个场景 × 3 轮 = 42 通过”，但 2026-10-16 接管审计时三轮循环仍在运行且缺少完整结果文件，不能作为已完成验收证据；本次结果以下方最新验收为准。证据：`evidence/v3/clouds-cumulus.png`、`clouds2-dusk.png`、`font-alimama.png`。

## 打包方式与边界

“打包带走”将当前页面与全部引用素材，同本地构建的独立播放器组合为 ZIP。播放器运行文件先固定成二进制 runtime 包，再与项目和素材打包，避免开发服务器对新增散文件的索引 / HTML 回退造成损坏包。运行文件有 ZIP 签名和必需文件检查，失败明确提示，不宣称下载成功。

运行包包含 `start.mjs`、`start.command`、`start.bat`、`agent.mjs`、`presets.json`、`agent-example.json` 和操作说明。目标电脑需 Node 18+；不需要 npm install、账号、原编辑器或原浏览器存储。启动器只服务本地静态文件，不是云业务后端。

不将 file:// 双击 HTML 当作受支持的运行方式。用户编解码格式、浏览器 WebGL 能力和字体安装仍由目标浏览器 / 系统决定。未验证 Safari、Firefox、真实投影与 60fps 性能目标。本版保留 Paper 原生 518400 像素预算与静止开关，不把上一版的帧率采样当成本版成绩。

## 视觉证据与修正

初轮独立视觉评审发现长标题进入图片区域，按基础错误档评分 4/10；静态方向意见为约 7/10。已修正文字可读宽度与按字数适配，并在实际导出的播放器复验；不将初轮分数改写成修正后分数。修正后的独立静态复核为 **8/10**：长标题遮挡消除、卡片边缘减轻、六图主辅关系和按需编辑均成立；未补作动效主观评分。

按评审把白色相框边缘从 8px 减至 4px；默认六图由重复三图改为六个不同的自然画面，组织成一张主图与错落辅图；去掉固定页脚宣传短句。保留全窗口柔和背景、卡片材质和按需编辑。最终版本再结合用户要求收敛为 12 个受限预设，并补齐 Agent 接口。

- `evidence/v2/opening.png`：当前网页首屏。
- `evidence/v2/gallery.png`：六图组合。
- `evidence/v2/editor-final.png`：固定槽位编辑浮层。
- `evidence/v2/preset-picker.png`：12 个预设选择。
- `evidence/v2/single-image-preset.png`：无文字的单图预设。
- `evidence/v2/portable-player.png`：实际解压运行的播放器与较长标题。
- `evidence/v2/final-visual/`：最终 2 倍图、遮字图、正常时长录屏与 report.json。

首轮 oil 动效探测测到首次进入 48 个元素变化、最大位移 50px、透明度变化 1；切屏 36 个元素变化、最大位移 224px。该证据来自 v0.2 原始网页动效，之后仅调整预设与排版参数。独立视觉评审者未正常速度播放录屏，不冒称独立动效评分通过。最终功能断言另直接验证现成动效的运行状态。

全部基础控件使用官方 shadcn Radix。文字使用未经修改的 React Bits BlurText；卡片使用未经修改的 TiltedCard floating / intro；网页切屏使用 Swiper Creative；背景使用 Paper MeshGradient。未编写 shader、动画物理、拖拽系统、播放器控件或基础 UI 控件。

根目录 `index.html` 原件 SHA-256：`85563f4d395ebb6e36ce3672a712871d7342769ebaeb78b3242d6ffeba9a1ad8`。

最终可交付 ZIP：`releases/流光-网页运行包.zip`，3,134,944 bytes，包含7份不同媒体、12个可选预设和兼容表格预设。已将这份最终包再次解压，在 `127.0.0.1:4188` 启动；最终图片解码、视频播放、原生全屏与退出，以及 4173 生产编辑器 API 通过，无 pageerror。
