# Agent 调用入口

Agent 与用户使用同一组 18 个受限预设，没有单独的自由画布模式。共享定义在 `src/presets.json`：每个预设固定主标题、小文本和图片位数量，始终不超过 2 / 2 / 6。字号与位置由预设自动决定。

本文中的 `src/`、`scripts/` 路径均相对于仓库内的 `web/` 目录。

页面按页码导航，不需要逐页起名。`name` 仍作为兼容元数据可选传入，不在编辑器或播放器导航中显示。新项目默认使用“云朵 · 积云”；结束页使用 `outro`，字幕停留后完整淡出至黑，编辑时静态显示，点击“重新感受这一屏”可保持编辑面板预览。

编辑器会禁用当前版式不适用的选项：收尾黑场与已放入视频的纯影像页不能调整背景；纯单图 / 纯影像不显示脚注；没有主标题时 `textEffect` 不生效，关闭 `motion` 后不能选择或预览动效。`setBackground` 仍是全局设置，收尾黑场不随之改变。收尾文字宜直接传入浅色 Hex，深色值会按共享的 `getSceneInk` 规则回退到浅色，以兼容已有项目。

18 个预设覆盖：纯文字（只说一句 / 两行主张 / 一段叙事）、纯单图（一张照片）、图文（一图一文 / 一图叙事 / 双图对话 / 双图叙事 / 三图灵感 / 四图故事 / 六图画廊）、视频（影像时刻 / 影像主张 / 纯影像）、折线图（趋势图表 / 一页图表）、表格（信息对照）、结尾收束。

v0.3 新增场景字段：`footnote`（脚注，≤120 字）、`chart`（折线图数据）；新增项目字段：`background.kind`（mesh 流动渐变 / grain 柔雾颗粒 / clouds 云朵 / clouds2 云朵 · 层次 / solid 纯色）、`transition`（creative 纵深漂移 / fade 柔和淡入 / cards 卡片推进）。色板含深色（墨夜 / 深海 / 余烬 / 极光 / 暖波）、云朵（积云 / 夕云）与纯色（白纸 / 纯黑 / 冷白），每个色板自带建议文字色、用 preset 切换时整页文字色自动跟随；文字颜色另有 8 个常用色板加任意 Hex。图片效果新增 `lift`（轻浮抬升 + 更深阴影）。v0.3.1 已移除“网格 / 星点”点阵色板与 dots 背景，移除“圆润无衬线”字体。

## 调用正在运行的编辑器

在浏览器自动化的页面上下文中执行，所有方法操作当前真实项目并保存到 IndexedDB：

```js
window.flowAgent.listPresets()
window.flowAgent.inspect()

// 修改已有的一屏（scene 从 1 开始）
await window.flowAgent.apply({
  scene: 1,
  presetId: 'statement',
  headings: ['把想法，带到这里。', '让内容自然发生。'],
  texts: ['文字大小自动适配，不需要指定坐标。'],
  footnote: '数据截至 2026 年 · 内部资料',   // 可选脚注
  font: 'sans',
  textColor: '#30384b',
  textEffect: 'fade',
  photoEffect: 'still',                     // still（默认）/ reveal / float / lift
})

// 折线图屏
await window.flowAgent.addScene({
  presetId: 'chart-line',                   // 或 chart-full
  headings: ['增长曲线，一目了然。'],
  texts: ['图表由 recharts 现成组件渲染。'],
  footnote: '来源：内部周报',
  chart: {
    categories: ['一月', '二月', '三月', '四月'],
    series: [{ label: '增长', values: [9, 15, 13, 24] }],
  },
})

// 纯影像整屏
await window.flowAgent.addScene({
  presetId: 'film',
  video: 'data:video/mp4;base64,AAAAIGZ0eXA…',
})

// 结尾收束：文字后整屏渐暗到黑
await window.flowAgent.addScene({ presetId: 'outro', headings: ['谢谢。'] })

// 在末尾新增一屏，图片 / 视频直接交给网页
// 图片、视频用 base64 data URL 传入，也可以传 { name, dataUrl }
await window.flowAgent.addScene({
  presetId: 'pair',                       // 一图一文：2 个主标题 + 1 段小文本 + 2 张图片
  name: '开门见山',
  headings: ['两天后的海边，', '把话说清楚。'],
  texts: ['图片直接交给网页，版式自己安排。'],
  images: ['data:image/jpeg;base64,/9j/4AAQ…'],
  photoEffect: 'still',
})

// 视频：传 video 字段；不传 presetId 时自动使用 cinema（影像时刻）
await window.flowAgent.addScene({
  headings: ['让故事，自己流动。'],
  video: { name: 'flower.mp4', dataUrl: 'data:video/mp4;base64,AAAAIGZ0eXA…' },
})

await window.flowAgent.setBackground({ preset: 'sage', speed: 0.3, paused: false })
await window.flowAgent.setBackground({ preset: 'ink' })                    // 深色墨夜
await window.flowAgent.setBackground({ preset: 'carbon' })                 // 纯黑（solid）
await window.flowAgent.setBackground({ preset: 'cumulus' })                // 云朵（Vanta 现成组件）
await window.flowAgent.setBackground({ preset: 'dusk' })                   // 云朵 · 层次（CLOUDS2）
await window.flowAgent.setTransition('fade')                               // creative / fade / cards
```

`apply` / `addScene` 返回 `{ project, scene, addedImages, ignoredImages }`：scene 是实际操作的屏号；图片超过预设槽位时保留前 N 张，`ignoredImages` 报告被忽略的数量。Promise 在真实 IndexedDB 写入完成后 resolve，素材 Blob 一并入库，刷新后仍然可解码。

修改前保存 `before-agent-backup` 本地备份。`scene` 不存在、未知预设或非法 Hex 颜色会抛错。内容仍经过统一预设归一化，不能通过 API 增加额外标题、图片或自由坐标。视频只允许配合 `cinema` 预设，否则会报错；scene 末尾追加请用 addScene。

字体：`sans`（系统无衬线）、`serif`（宋体）、`alimama`（阿里妈妈数黑体，本地 woff2 随包携带）、`georgia`、`arial`、`trebuchet`、`verdana`、`courier`。英文字体走系统字体栈，无外站字体依赖。

文字效果：`blur`（轻柔聚焦）、`focus`（呼吸聚焦）、`drift`（轻盈掠入）。图片效果：`float`（现成入场 + 持续轻浮）、`reveal`（现成入场）、`still`（直接呈现）。系统减少动态效果偏好优先。

## 修改已解压的运行包

目标电脑有 Node 18+ 即可，无需 npm install。`apply` 修改已有屏，`add` 在末尾新建一屏；图片、视频用本地文件路径，agent.mjs 会把文件复制进媒体目录并登记到媒体清单：

```bash
node agent.mjs presets
node agent.mjs inspect
node agent.mjs apply agent-example.json
node agent.mjs add new-scene.json
node start.mjs
```

`agent-example.json` 在 ZIP 中附带。Agent 也可写自己的配置（`images` / `video` 中的路径相对配置文件所在目录解析）：

```json
{
  "scene": 1,
  "presetId": "statement",
  "headings": ["新的主张", "由预设保证效果"],
  "texts": ["不需要手动调整字号"],
  "footnote": "来源：内部周报",
  "font": "sans",
  "textColor": "#30384b",
  "textEffect": "fade",
  "photoEffect": "still",
  "images": ["./我的图片.jpg"],
  "transition": "fade",
  "background": {
    "kind": "mesh",
    "colors": ["#e7eaf7", "#c9dcf1", "#f6e5df", "#e8dced"],
    "speed": 0.36,
    "paused": false
  }
}
```

图表屏（`add`）：

```json
{
  "presetId": "chart-full",
  "texts": ["agent 写入的图说明。"],
  "footnote": "数据来自 agent",
  "chart": {
    "categories": ["Q1", "Q2", "Q3"],
    "series": [{ "label": "指标", "values": [4, 9, 7] }]
  }
}
```

只改全局背景或转场时，`apply` 可以不写 `scene`；涉及场景字段（headings / texts / footnote / chart / images / video 等）则必须给出 `scene` 编号。

`add` 使用的 JSON 不需要 `scene` 字段，其余字段与 `apply` 相同，可带 `name` 自定义这一屏的名字。运行 `apply` / `add` 会校验预设 / 数量 / 字体 / 颜色 / 动效枚举和素材格式，备份为 `project.before-agent.json`，再修改 `project.json`。刷新正在运行的网页即可生效。原媒体文件随包保留；切换预设只使用该预设允许的槽位，超出数量的图片只采用前 N 张并在终端提醒。

支持的素材格式：图片 jpg / png / webp / gif，视频 mp4 / webm / mov。

`start.mjs` 只是本地静态服务，默认绑定 `127.0.0.1:4177`，被占用会选空闲端口。编辑器与便携播放器共享 `Experience.tsx` 和 `presets.json`，保证视觉规则一致。

## 动效默认值

新建屏与未指定效果的 Agent 请求，文字使用 `textEffect: "fade"`（整段轻淡入），图片使用 `photoEffect: "still"`（静置，指针经过不倾斜放大）。新项目采用 `transition: "fade"`，450ms 淡入，背景默认速度 0.18。重点页可单独选择 blur / focus / drift 与 float / lift / reveal，`motion: false` 关闭该屏内容动效；已明确选过的效果继续保留。小字只整段淡入，脚注直接呈现。

## Agent 与客户协作工作流

这个项目适合 Agent 拿来即用，和用户对谈讨论方案，最终打包成一场发布会级别的展示。下面是一条已经验证的协作链路。

**1. 拉取并读懂项目**

- 编辑器与播放器共用 `src/model.ts` / `src/presets.json` / `src/Experience.tsx`，视觉规则只有一套。
- `presets.json` 列出现成 18 个预设。`limits` 常量统一约束（≤100 屏 / 2 标题 / 2 文本 / 6 图 / 12 数据点 / 3 系列）。
- 用户提供的素材多以本地文件形式给出时，用运行包的 `agent.mjs add` 复制；若以 base64 提供，用 `window.flowAgent` 或运行包 JSON 直接放 data URL。
- 「可控性」来自：版式预设固定、媒体 GC 自动回收、保存队列串行，写入安全有备份（`before-agent-backup` / `before-preset-backup`）。

**2. 引导用户提供素材**

不要一次性要所有东西。按发布会叙事顺序问，一次只问一类：

- 开场主张（一句话、一句副标题）
- 三到五个分段故事（每段选合适预设：一图叙事 / 双图对话 / 三图灵感 / 趋势图表 / 表格）
- 收尾（outro `谢谢。`，或加联系人）
- 整体氛围：让用户在 15 个背景色板中选，或描述景色（晨光 / 墨夜 / 极光 / 沙丘 / 云朵），Agent 用 `setBackground` 一键切换

如果用户的素材超出预设上限（如 7 张图），主动建议拆成两屏，或替换为「六图画廊」。

**3. 生成过程**

- 先 `addScene` 创建起承转合，再批量 `apply` 注入用户的图片 / 视频素材。
- 单个场景字段错误时 API 会立即报错，不会污染项目；可以放心重试。
- 每项 commit 前自动备份到 IndexedDB 的 `projects/before-agent-backup`。当前没有“打开最近备份”按钮，需要由 Agent 或开发工具读取备份后恢复。

**4. 用户继续自编辑**

- 包内 `使用说明.txt` 自带启动命令；Agent 也可以替用户跑 `node start.mjs`。
- 卡片压缩的 `使用说明.txt` / 包内 `agent-example.json` / `agent-add-example.json` 是给后续接手的 Agent 看的，避免重复阅读源码。
- Agent 离开后，用户完全可用编辑器继续：换版式 / 调色板 / 动效都自带，不需要再依赖 Agent。

**5. 简洁可控**

- 不要写自由坐标或自定义 keyframes，预设已经卡住布局。
- chart 系列 label 可以重复——`normalizeChart` 内部用 `series-0/1/2` 作 key，legend 显示用的是 `label`，不会因为同名或与 `name` 撞列而互相覆盖。
- 频繁更换预设时不要一次性 replace 所有素材，分批 `apply` 让 GC 回收被替换的 media。
