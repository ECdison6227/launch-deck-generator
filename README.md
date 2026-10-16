# 流光 · 流动网页

可编辑、可打包的整屏网页叙事工具。铺满窗口的动态背景持续流动，文字自动聚焦出场，圆角照片卡片自带入场、轻浮和指针回应。编辑时按需打开右侧浮层。

提供 **12 个固定版式**，覆盖纯文字、纯单图与一图 / 双图 / 三图 / 四图 / 六图组合。每个版式固定内容位，始终不超过 **2 个主标题、2 个小文本、6 张图片**，另有视频版式。字号按字数自动适配，用户只替换内容和选择效果。方向键、空格、滚轮切换场景，支持浏览器全屏。内容与媒体自动保存，刷新恢复。

```bash
cd web
npm ci
npm run dev
```

预览：**http://127.0.0.1:5173/**。

“打包带走”导出完整 ZIP：网页播放器、当前内容、图片、视频、Mac / Windows 启动脚本与说明。另一台电脑安装 Node 18+ 后，解压并在其中运行：

```bash
node start.mjs
```

打开终端显示的地址即可播放；不需要 npm install、原浏览器数据或外站 CDN。可将 ZIP 交给其他 Agent，按包内说明启动。编辑器的“打开运行包”可将 ZIP 导回继续编辑。

采用现成组件：Swiper React Creative、Paper MeshGradient、React Bits BlurText / TiltedCard、shadcn/ui Radix、Dexie、fflate。仅编写组合、内容限制、数据、媒体与事件接线。附带的 Node 服务只负责本地静态文件，没有账号或业务数据库。

根目录原有 `index.html` 保留原样。上一版内容升级时会先留下完整本地备份。

## 下载运行包

> 仓库 → **Releases** → 最新版本 → `流光-网页运行包.zip`。

解压到任意位置，按照包内 `使用说明.txt` 启动即可播放。也可把 ZIP 交给其他 Agent，让它按包内说明启动、修改并重新打包。

## 文档

[Agent 调用说明](docs/AGENT_API.md) · [使用与启动说明](web/README.md) · [实际验收](web/VALIDATION.md) · [组件与素材来源](web/THIRD_PARTY.md)
