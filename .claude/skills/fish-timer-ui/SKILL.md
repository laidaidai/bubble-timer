---
name: fish-timer-ui
description: 「小鱼计时器」微信小程序的 UI 设计系统与自适应口径。改这个项目任何界面（首页/工具/记录/计时/快捷计时/统计打卡/待办/重要日子/设置）、调时钟皮肤或尺寸、写动画、做桌面大屏适配、排查溢出与抖动时使用。含主题 token 规范、卡片/滑杆/按钮范式、时钟统一容器体系、已验证的坑与验收方式。
---

# 小鱼计时器 · UI 设计系统

原生微信小程序（WXML/WXSS/JS，无框架），项目根 `/Users/laiyuci/projects/计时器`，AppID `wx94c4673cd56b09ad`。
视觉基调：**neo-brutalist 手绘感**——浅色底、深色粗描边、硬投影（无模糊阴影）、大圆角或全胶囊、数字一律加粗。
**不得声称「已在微信开发者工具编译通过」**；只能说做了静态校验，效果由用户自己重编译截图确认。

## 1. 主题 token（唯一数据源）

- `theme/palette.js` 是唯一配色源；`node tools/gen-theme-wxss.js` 生成 `app.wxss` 的 `THEME-TOKENS:START/END`，**生成区禁止手改**。
- 6 套内置主题（cream / tomato / rose / sky 默认 / mint / obsidian）+ 自定义主题。每套约 46 个变量，另带 `canvas` 与 `nav/front/swatch/slider`。
- 页面根节点必须 `class="... theme-{{theme}}" style="{{themeStyle}}"`，自定义主题靠内联变量生效；`onShow` 重读主题。
- 主要变量：`--bg --card --panel --panel-deep --ink --edge --edge-deep --shadow --shadow-soft --primary --primary-2 --primary-3 --on-primary --cream-1..4 --line --line-strong --track --text-2/3/4 --text-warm --success --danger --warn-bg --accent-bg`。
- **禁止写死色值**；canvas 取色用 `app.getTheme().canvas`，与页面 CSS 必须同色。
- 主题变量只挂在页面根节点，`page` / 自定义组件 / fixed 浮层读不到；大屏两侧留白靠 `.desk::before { position: fixed; inset: 0 }` 兜住。

## 2. 组件范式

- 普通卡：`2rpx solid var(--edge)` + `5rpx 6rpx 0 var(--shadow-soft)` + 圆角 24–30rpx。
- 报告区块：`3rpx` 描边 + 32rpx 圆角 + `7rpx 8rpx 0` 投影，**一个部分一个框**。
- 轻量列表行（待办/重要日子）：白卡 + `2rpx var(--line-strong)` + 18rpx 圆角 + `min-height: 84rpx` + 14rpx 空心圆点，**不加硬阴影**。
- 按钮/芯片/进度条：`border-radius: 999rpx`；危险操作用 `--danger` 并传 `wx.showModal.confirmColor`。
- 数字用 `.num`（800 + `tabular-nums`），大数字 900；等宽用 `.mono`。
- 字号下限 18rpx；正文 20–24rpx；标题 26–32rpx；降级用 `--text-3`，不缩字号。
- **原生 `button` 自带约 184px 默认宽度**：凡在 flex 行里排 button，必须显式 `width: auto !important; min-width: 0 !important; flex: 0 1 auto; max-width: 100%; box-sizing: border-box`，否则顶出容器（记录页三按钮被切半就是这个）。
- 滑杆（首页/报告/打卡共用一套）：轨 `18rpx` + `--cream-2` + 2rpx 描边 + 歪圆角 `14rpx 10rpx 16rpx 11rpx`；填充 `--primary` + 右描边 + 112deg 白斜纹；把手 `30rpx` + 3rpx 描边 + `46% 54% 48% 52%`；超出计划红 `--danger`、提前绿 `--success`。

## 3. 动画语言

- 缓动统一 `cubic-bezier(.2,.8,.3,1)`；时长 `.26s / .34–.44s / .5–.6s`；循环装饰 2.4–3s。
- 基础入场 `app-rise-in` / `app-pop-in` / `app-page-fade`；交错 `nth-child` 递增 0.03–0.05s。
- 报告序列：卡片 0/.06/.12/.18/.24s，大数字 `translateY(12rpx) scale(.94)`，环 `scale .82 + -10deg`，进度条 `scaleX(0→1)`（`transform-origin: left`），把手 keyframes 内**自带** `translate(-50%,-50%)`。
- **硬约束**：keyframes 里不用 `filter`（整条失效）；不靠父级 class 变化重启子动画；`backwards + delay` 会重新排队闪一下，播完用定时器摘触发类；旧基础库慎用 `clip-path / conic-gradient / -webkit-text-stroke`。
- 装饰动画只在状态变化时播一次；首页激励图案在大屏**一律不放大、不改动效**。

## 4. 尺寸与自适应（全项目最重要的一节）

**单位口径**

- 手机档用 `rpx`（750 基准）；桌面/大屏必须 `px` 化：`px ≈ rpx × 0.56`（手机档的 1.12 倍）。原因：1700px 窗口 `1rpx ≈ 2.27px`，rpx 会整体放大 2.3 倍。
- 横屏 compact 档的尺寸只允许 `px`：812 宽下 `1rpx≈1.08px`，写 rpx 直接翻倍。
- 判定：`app.js` 的 `detectDesktop()`（platform 为 `windows|mac`）→ `globalData.isDesktop`；各页根节点追加 `desk` 类。开发者工具宽窗口可能判不出，补 `windowWidth > 600` 兜底。
- `.desk` 是页面级祖先，**自定义组件内部不成立**；组件要自带 `desk` 类（`.qp-embed.desk` 同元素选择器）。

**层级规则（用户明确要求）**

- 大屏只放大「看的主体」：首页目标时间/训练模块、计时页大时钟、记录卡、报告卡、快捷计时时钟。
- **功能控件一律锁手机档物理尺寸**（顶栏返回、保存/清空、删除 ×、加号、步进器 ±、模式胶囊、开始/暂停/重置、tab、预设胶囊、dock、悬浮球），只摊到屏幕边缘并保留 24–32px 边距。
- 主体放大走 `@media (min-width: 1400px)` 一档（约 1.25），再宽一档封顶 1.4。

**滚动区与底栏**

- 桌面自绘 `.topbar` 用 `wx:if="{{!isDesktop}}"` 隐藏（系统标题栏已有返回）。
- 底栏页滚动区**不扣高度**：`height: 100vh` + `padding-bottom: calc(52px + env(safe-area-inset-bottom) + 28px)`；扣高度算不准会露出「死白带」。
- 自定义 tabBar 组件读不到 `.desk`，靠自身 `data.desk`（`attached` + `pageLifetimes.show` 同步）。
- 底部内距要避开悬浮球（tabBar 页 72px，无 tabBar 页 64–76px，待办要避球+加号 96px）。

**fixed 元素**

- `position: fixed` 的 `left/right/top/bottom` **不要用 rpx**，宽屏会成倍偏移（工具页齿轮曾飘到页面中间）。
- 祖先有 `transform / filter / perspective / will-change` 时，内部 fixed 不再相对屏幕 → 底部常驻按钮做成 flex 页脚，别用 fixed。

**首帧一致性**

- 所有「先错后对」的闪烁都是 `data` 初始值与真实状态不一致：`Page({ data })` 里直接取 `getApp().globalData.isDesktop`、`getApp().getTheme()`；`app.json` 静态导航色对齐默认主题；`applyNavBar` 用 `duration: 0`。

## 5. 时钟体系（8 皮肤，唯一口径）

- 皮肤清单在 `utils/format.js` 的 `CLOCK_STYLES`：`flip / blocks / sticker / outline / jelly / doodle / stamp / jellypop`；`LEGACY_CLOCK_STYLE` + `resolveClockStyle()` 负责老 key 迁移，三处读存储都走它。
- **外观只在 `styles/clocks.wxss`**；尺寸只在 `utils/clock-layout.js`。页面 wxss 不再写各皮肤的倍数。
- 新皮肤一律无外框：`background: transparent / border: 0 / border-radius: 0 / box-shadow: none`（`!important`）。四套外壳选择器必须都写：`.timer-page.clock-<key>` / `.quick-page .q-clock-shell.q-shell-<key>` / 设置页大预览卡 / 设置页样式小样。设置页大预览是深色 `--panel` 底，文字皮肤要另加 `--on-panel` 覆盖。
- **固定容器 + 等比塞入**：
  - `computeSlotSize(winW, winH, portrait)` 决定 `.clock-slot`（竖屏 `0.94w × min(0.30w,0.24h)`；≥900 横屏 `0.74w × min(0.38h,400)`；手机横屏 `0.72w × min(0.40h,230)`）。容器只跟窗口有关，换皮肤容器不动。
  - 皮肤用 `zoom: --clk-fit`（**不是 transform**）缩进容器；`fitScale()` 取 `min(availW/natW, availH/natH)`，max 4.2。
  - 快捷页/首页内嵌面板用 `.q-clock-slot` 固定高度 + `--q-fit`，宽度交给卡片实测（避免「变大→卡片变高→再变大」）。
- **测原始尺寸**：`fitClock` 量 `.clock-body` 的 rect，除以当前倍率得到原始尺寸，缓存进 `clockNatural[style|portrait|compact|wide]`；切皮肤时用缓存算 `--clk-fit`，与 `clockStyle` **同一帧 setData**（否则先按旧倍率渲染一帧 = 屏闪）。
- **过渡期间不许测量**：`clockMorph` / `clockMorphStyle` 为真或距 `clockMorphAt` 不足 520ms 时，rect 会把放大算进去，缓存被污染 → 退出全屏后时钟缩水。过渡中延后重试。
- **全屏倍率用实测尺寸**：`min(0.94*winW/natW, 0.86*winH/natH)`，clamp [0.8, 12]，不要查 `CLOCK_BASE` 表估算（文字类皮肤会被算小）。退出全屏分三段交接（保持 transform → 收到 exitFit → 同帧交给 zoom）。
- 文字类皮肤偏小先查自己的 `.plain-clock` padding：透明内距会被算进原始尺寸（outline 已清零）。
- 翻页钟尺寸只改 `components/flip-clock/index.wxss`（页面里 `.flip-card` 是另一套旧实现）；组件需自带 `@media (min-width: 700px)` 的 px 档。
- 点击切皮肤只挂在时钟本体，不要挂 `.clock-stage`（点空白会误切）；切换提示 `.style-hint` 1.3s 自动收起。
- 计时页结构、横竖两套 DOM、竖向顺序、槽位高度等细节见完整版 skill（本文件是浓缩口径，改计时页前先读 `pages/timer/timer.{wxml,wxss,js}` 现状）。

## 6. 页面要点

- **首页**：自定义导航，顶栏右侧不放控件；模式胶囊 + 目标卡 + 激励图案 + 模板 + 可拖动模块列表 + Dock；固定面板（快捷计时 / 待办 / 重要日子 / 打卡）都读真实数据、就地可用，入口只在悬浮球「首页显示」。
- **记录页**：卡片标题/时间/时长 + 三按钮（再试一次 / 删除 / 查看报告），按钮见第 2 节的 184px 规则；滚动区底部避开悬浮球。
- **报告页**：顶栏固定 + 独立 scroll-view；训练成绩 → 时长对比 → 模块明细 → 小鱼复盘 → 三按钮；宽屏内容列 `max-width: 900px`，页面级渐变要挂到整屏容器（`.desk` 只有 1280 宽，会露边）。
- **分析/打卡**：今日总览 + 指标卡 + 离屏 canvas 海报 + 弱项滑杆 + 自绘趋势图；老版 canvas 先量真实宽高再 `scale(k)` 绘制，否则大屏只占左上角一小块。
- **待办 / 重要日子**：自绘日历与行样式统一（圆点 + 名称 + 时间/天数 + `›`），长按删除、点击编辑。
- **设置**：分区标签切换，宽屏内容列 960–1040px；控件锁手机档；时钟预览用真实结构，不用假图。
- **地球口径**：UI 里不写「怎么操作」的解释性文案，交互靠控件本身表达。

## 7. 微信/基础库坑（都踩过）

- WXSS 不支持通配 `*`（编译报错）；约束子元素就列具体选择器。
- 页面/组件 wxss 里**标签选择器**会给告警（`text` / `flip-clock` / `scroll-view`），节点补 class；`page {}` 允许。
- WXML 里不要写位置类内联样式（`position/left/top/display`），会压过 WXSS，造成「改了没变化」。
- `flex-wrap + space-between` 在微信里最后一行会被拉满，用 grid 或 `flex-start`。
- 跨组件 `wx:if/wx:else` 链会触发 `Framework inner error (FLOW_DEPTH)`；两套 UI 各写一份 DOM，不要靠 CSS `order` 挪。
- `observers` 首次挂载也会触发，需要 `_ready` 门闩。
- 新增独立 util 文件偶尔进不了编译，临时函数并进已被引用的老模块（本项目用 `utils/format.js`）。
- `LifeCycle.load fail: Cannot set a non-pending waiting value`：`onLoad` 里不要立刻 `redirectTo`（延后一拍）；导航 fail 回调里禁止再发 `reLaunch`；组件 `attached` 里注册 `wx.onWindowResize` 要延后并判 `_destroyed`，只在桌面注册。
- 页面 `onLoad` 调工具函数先 `typeof === 'function'` 再调，导出缺失会把整页打挂。
- `wx.getImageInfo` 吃相对路径会 500；2D canvas 用 `canvas.createImage()` + 绝对路径，`drawImage` 不能传字符串路径。
- 新建页面/组件后请用户「关自动热重载 → 清缓存 → 重新编译」。

## 8. 验收（不许凭空画图）

- 静态体检：改过的 js `node --check`；WXML 事件名在 js 里存在；WXSS 花括号配平；`var(--x)` 都能在 `app.wxss` / `styles/clocks.wxss` 找到；`git diff --check`。
- 截图只能用微信开发者工具自动化（`cli auto` + `miniprogram-automator` 的 `mp.screenshot`），**不要用 Pillow 自绘冒充效果图**；自动化不稳定时，交给用户自己编译截图。
- 交付说明写清：改了哪些文件、影响哪些页面、需要在哪些窗口尺寸验证。
- **不主动 commit**；只有用户说「提交 git」才提交，且不主动 push。
