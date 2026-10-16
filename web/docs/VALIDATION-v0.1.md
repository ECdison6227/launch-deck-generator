# 第一版实际验收

日期：2026-10-15。实现和验证均发生在 `web/`，根目录原有 `index.html` 未修改。

## 环境与结论

- macOS 26.5，Apple M1 / 8 GB，Node 26.10.0。
- Playwright 1.64.1，Chromium 156.0.8078.4，独立 headless 浏览器上下文；没有访问用户现有浏览器资料或系统剪贴板。
- 编辑视口 1440×900、1280×800，演示视口 1920×1080。
- `npm run typecheck` 与 `npm run build` 通过。最终生产构建 JS 766.91 kB / gzip 235.24 kB，CSS 约 119.6 kB / gzip 24.2 kB，另有本地代表素材。
- `npm run lint` 无错误；保留未经改动的上游组件 3 个警告：Button / Tabs 的 Fast Refresh 导出提示、TiltedCard 的 render 中写 ref 提示。没有为消除提示改写上游。
- Vite 提示单 chunk 大于 500 kB；第一版保持单入口，没有加入拆分系统或额外运行时。

## 实际浏览器检查

完整套件 **9 个场景 × 连续 3 轮 = 27 通过**。视觉组合修正后，对全屏 / 出场、背景 / 倾斜、六布局 / 尺寸再连续跑 3 轮，**9 通过**。最后调整现成背景质量参数后，视频与背景两个场景又各重复 3 轮，**6 通过**。视频槽位合成修复后另对视频场景连续验证 3 轮，**3 通过**。

| 项目 | 实际验证方式与结果 |
| --- | --- |
| 文字编辑 | 改标题、正文和项目名，舞台立即更新；等待真实已保存状态后刷新，重新读回一致 |
| 图片粘贴 | 通过浏览器 DataTransfer + ClipboardEvent 粘贴真实 JPEG File；页面绑定 Blob URL，图片成功解码 |
| 图片选择 / 恢复 | 实际打开 filechooser 选择文件；刷新后 URL 重新建立、naturalWidth 大于 0，没有依赖旧 URL |
| 视频 | 上传本地 H.264 MP4；浏览器真实播放且 currentTime 增加；编辑翻页和演示翻页后 paused 为 true；上传封面并刷新恢复 |
| 表格 | 单元格编辑同步舞台，二维 TSV 粘贴进入网格；增删行列、刷新读取均通过 |
| 页面管理 | 从布局弹窗新建，复制，上下调序，刷新后页序和选中页正确；确认删除后数量正确 |
| 六布局 | 在同一页切换所有布局，所选布局和舞台同步；代表页在 1080p 下内容边界未越出舞台 |
| 全屏 | 调用原生 Fullscreen API 后检查 fullscreenElement；退出后恢复原编辑页和属性标签 |
| 步骤 / 导航 | 调整正文先于标题，空格 / 右键推进，左键回退；检查 Fragment visible 数量；G 输入页码跳转通过 |
| 视频离页暂停 | 保留真实 video 元素句柄，切页后读取 paused=true；预览退出后返回原视频编辑页 |
| 背景持续 | 同一 canvas 标记跨页保持，当前舞台始终只有一个 canvas；相邻截图内容变化，证实背景实际流动 |
| 倾斜 | 真实移动指针到现成 TiltedCard，观察其内部 rotateX transform 变化 |
| 配色 / 暂停 | 使用预设、暂停开关，刷新后设置恢复；背景 / 卡片截图已实际查看 |
| 保存失败 | 注入 IndexedDB QuotaExceededError，顶部明确报错；输入与舞台保留；恢复写入后点击重试并刷新读回 |
| 生产版本 | 实际打开 4173 的构建产物，编辑保存、刷新恢复、播放视频、翻页与退出均成功，没有 pageerror |

图片粘贴由浏览器事件分发验证，未占用用户的系统剪贴板。视频播放直接调用原生媒体 API 并检查真实解码时间，未模拟播放状态。全屏断言检查浏览器 API，未用 CSS 尺寸冒充 API 成功。

早期验证发现过测试仍停留在“出场”标签时错误寻找“内容”输入框，以及开发服务器监听测试报告 HTML 导致浏览器被热刷新；分别修正断言并让 Vite / Tailwind 忽略证据输出后，完整三轮通过。最终记录不把早期失败计为通过。

## 动态背景与视频性能

代表素材为 960×540、H.264 / AAC、5.055 秒的本地 MP4。在 1920×1080 窗口演示、视频播放与动态背景并行时，实际 headless WebGL renderer 为 **ANGLE / SwiftShader（软件渲染）**。

- 初始 1920×1080 shader 分辨率：独立采样约 12.5 RAF/s；并行截图测试期间有更低值，因此不宣称初始预算达到 30fps。
- 按 Paper 原生 `maxPixelCount` 降至 **518400 像素**，1080p 时 shader 实际画布为 **960×540**，组件自然铺满舞台，未写自有渲染或降级引擎。
- 调整后独立采样 3017 ms：**36.8 RAF/s**，视频 90 帧、丢帧 2；完整原始数据见 `evidence/runtime-metrics-tuned.json`。
- 达到本次软件渲染环境的 30fps 目标，未声称真实显卡 / 其他设备达到 60fps。用户可用现成开关暂停背景；系统减少动态效果时也会停止背景。

RAF 采样是浏览器回调频率，不等同于每帧 GPU 完成时间或跨设备性能承诺。这里只报告本次实际环境与素材。

## 视觉与组件约束

方向已固定为舞台工作台：浅中性工具区与柔和舞台分离，中央舞台为主角。基础交互均采用官方 shadcn Radix 组件；素材、布局、保存和生命周期为应用接线。

- 背景：Paper MeshGradient 单实例，配色 / 速度 / 暂停及原生像素预算。
- 切页：reveal.js 内置 fade；入场：Fragment fade-up / fade-in；卡片：React Bits TiltedCard。
- 预览与演示复用同一个 Deck 和 SlideContent，切模式时不重建背景或维护第二套演示排版。
- 不开发自由拖拽、时间轴、基础控件、shader、物理或视频控制器。
- 保留现成圆角与浅透卡片；没有实现 Hark 的 mesh 翻牌。仅指针倾斜，不宣称自动堆叠 / 自动轮换。

独立视觉评审一轮，**8/10**；之后只复核修正项，未重新评分。依据评审提高辅助文字和卡片正文对比度 / 字号，去掉重复翻页入口，保持舞台主次。卡片采用上游支持的 children 内容组合，保留可关闭的倾斜。剩余差距：3D 卡片文字与平面大标题相比仍有轻微栅格柔化，当前不妨碍阅读。最终视频画面检查发现原生视频合成层超出槽位的浅色块，已用模板容器的 overflow / paint containment 约束修复，未改写播放器；修复后截图 `evidence/video-slot-final.png` 已查看。

实际查看编辑态、卡片态、图文演示、表格演示、1280 编辑视口和卡片 200% 局部。初稿没有额外品牌宣传区，精简阶段移除重复导航，没有删掉必要操作说明。

最终 oil 截图检查没有控制台错误、横向溢出、加载失败图片或文字对比度提示。剩余“标题上方编号标签”提示保留：这些属于用户可编辑的页章导航，帮助定位讲述顺序；缩略图复用同份内容而被重复统计。

oil 动效探测记录：首次进入有透明度变化，预览 / 翻页操作检测 5 个元素变化、最大位移 10px、透明度变化 1。背景实际流动和倾斜另由浏览器断言验证。视觉评审者未实际播放录屏，不据此新增独立动效评分。

## 证据

- `evidence/visual-accessibility/page.png`：最终编辑态，已实际查看。
- `evidence/editor-cards-final.png`、`presentation-cards-final.png`：最终卡片组合。
- `evidence/video-slot-final.png`：播放中的视频槽位与动态背景，已查看无越界合成块。
- `evidence/editor-1280.png`、`presentation-1-1080p.png` 至 `presentation-6-1080p.png`：各尺寸和代表布局。
- `evidence/cards-detail-200.png`：局部放大。
- `evidence/visual-final/`：2 倍图、遮字图、首次进入与操作录屏、探测 report.json；该批截图之后仅加强了 4 处辅助文字对比度及调整卡片内容挂载方式。
- `evidence/visual-accessibility/report.json`：最终对比度检查，无可读性警告。
- `evidence/playwright-full-report/index.html`：完整三轮 27 通过报告。
- `evidence/playwright-visual-report/index.html`：视觉修正后三轮 9 通过报告。
- `evidence/playwright-report/index.html`：最近一次回归报告。
- `evidence/runtime-metrics.json`：早期并行压力采样和生产冒烟；`runtime-metrics-tuned.json`：最终像素预算的独立性能采样。

## 范围与取舍

当前支持桌面使用、单项目本地保存和浏览器演示。云朵、第二种 shader、ZIP 搬运、离线包、PPT 导出、服务器、账号与多人协作按任务范围未加入。窄于 960px 的移动设备编辑没有承诺，也未验证 Safari / Firefox、真实投影或其他编解码格式。静态构建的生产预览与开发预览有不同来源，IndexedDB 各自独立。

原 `index.html` SHA-256：`85563f4d395ebb6e36ce3672a712871d7342769ebaeb78b3242d6ffeba9a1ad8`。
