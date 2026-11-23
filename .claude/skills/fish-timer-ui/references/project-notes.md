# 小鱼计时器 · 项目专属档案（归档）

> 这是 2026-11 前的项目操作细节与踩坑记录，仅改「小鱼计时器」时按需读取。
> **本文件里的“虚线”均为历史遗留，已废止**；新设计以 `SKILL.md` 的“全局禁用虚线”为准。
> 通用风格、组件与跨端规则看 `SKILL.md` 与 `component-recipes.md`，不要把本文件当通用设计规范。

# 小鱼计时器 · UI 设计系统

原生微信小程序（WXML/WXSS/JS，无框架），项目根含 `app.js` / `app.json` / `pages/`。
视觉基调：**neo-brutalist 手绘感**——浅色底、深色粗描边、硬投影（无模糊阴影）、大圆角或全胶囊、数字一律加粗。
不要自述「已在开发者工具编译通过」；效果以真实截图为准（见第 5 节）。

## 1. 主题 token：唯一数据源

- `theme/palette.js` 是唯一配色源，`node tools/gen-theme-wxss.js` 生成 `app.wxss` 的 `THEME-TOKENS:START/END` 区块，**生成区禁止手改**。
- 内置 6 套：cream 蜂蜜奶霜 / tomato 红黄汽水 / rose 蜜桃雪酪 / sky 晴空苏打（默认）/ mint 薄荷青瓷 / obsidian 曜石鎏金。每套约 46 个变量 + `canvas`（海报画布色）+ `nav/front/swatch/slider`。
- 页面根节点必须写 `class="... theme-{{theme}}" style="{{themeStyle}}"`，自定义主题靠内联变量生效；`onShow` 重读主题。
- 常用变量：`--bg --card --panel --panel-deep --ink --edge --edge-deep --shadow --shadow-soft --primary --primary-2 --primary-3 --on-primary --cream-1..4 --line --line-2 --line-strong --track --text-2/3/4 --text-warm --text-mid --success(--text/-bg/-line) --danger(-text/-bg/-line) --warn-bg --warn-text --accent-bg --accent-text --chip-neutral --bar-target --bar-incomplete`。
- **禁止写死色值**；canvas 取色用 `app.getTheme().canvas`，海报/打卡 canvas 与页面 CSS 必须同色。

## 2. 卡片与组件范式

- 普通卡：`border: 2rpx solid var(--edge)` + `box-shadow: 5rpx 6rpx 0 var(--shadow-soft)` + 圆角 24–30rpx。
- 重点卡 / 报告区块（`.rp4-frame`）：`3rpx solid var(--edge)` + `32rpx` 圆角 + `7rpx 8rpx 0 var(--shadow)`。报告页规则是**一个部分一个框**（训练成绩 / 时长对比 / 模块明细 / 小鱼复盘）。
- 轻量列表行（首页待办、首页重要日子、重要日子页 `.imp-row`）：白卡 + `2rpx solid var(--line-strong)` + `18rpx` 圆角 + `min-height: 84rpx` + `padding 16rpx 18rpx` + 空心小圆点 `14rpx`（`border: 2rpx solid var(--line-strong)`，临近/激活填充 `--primary`）+ 名称 `24–26rpx/900` 省略号 + 右侧 `19rpx/900 --text-2` 时间或天数。这类行**不加硬阴影**，靠浅描边区分。
- 按钮 / 芯片 / 进度条：`border-radius: 999rpx`；危险色 `--danger`，`wx.showModal` 传 `confirmColor`。
- 数字：`class="num"`（`font-weight: 800` + `tabular-nums`），大数字 900；等宽字用 `.mono`。
- 字号下限 18rpx；正文 20–24rpx；标题 26–32rpx；降级靠 `--text-3` 而不是缩字号。

### 滑杆（时间/进度）范式
首页训练模块与报告页、打卡页共用同一套手绘滑杆，不要另造：

- 轨道：`height: 18rpx`，`background: var(--cream-2)`，`border: 2rpx solid var(--edge)`，歪圆角 `14rpx 10rpx 16rpx 11rpx`，`box-shadow: 3rpx 4rpx 0 var(--shadow-soft)`，`overflow: hidden`。
- 填充：`--primary` + `border-right: 2rpx solid var(--edge)`，叠加 112deg 白色斜纹（`repeating-linear-gradient`，约 3rpx 线 / 10rpx 间隔，`rgba(255,255,255,.22)`）。
- 圆把手：`30rpx`、`border: 3rpx solid var(--edge)`、不规则圆角 `46% 54% 48% 52%`、`transform: translate(-50%,-50%)`、左上角一个白色高光点。
- 语义（报告页/打卡页）：满格 = `max(计划, 实际)`；主题色段 = 计划内时间；**超出部分红 `--danger`，提前部分绿 `--success`**；条尾不留底色余量；数值 >100% 用 `--danger`。

## 3. 动画语言

- 统一缓动 `cubic-bezier(.2, .8, .3, 1)`；时长档 `.26s / .34–.44s / .5–.6s`；装饰性循环 2.4–3s `ease-in-out`。
- 基础入场：`app-rise-in`（上升 20–26rpx + 淡入）、`app-pop-in`（从 .9 缩放弹入）、`app-page-fade`。
- 报告页序列：卡片 `rp4-card-in` `.44s` 延迟 0/.06/.12/.18/.24s；大数字 `rp4-num-in`（`translateY(12rpx) scale(.94)`）；环 `rp4-ring-in`（`scale .82` + `-10deg` 转正）；进度条 `rp4-bar-grow`（`scaleX(0→1)`，`transform-origin: left`）；圆把手 `rp4-knob-in`（**keyframes 内必须自带 `translate(-50%,-50%)`**）；次级元素 `rp4-fade-in / rp4-chip-in / rp4-pop-in` 覆盖 kicker、日期、模式胶囊、统计 pill、百分比、标签。
- 交错用 `nth-child(n)` 递增 0.03–0.05s，不要整屏同时播。
- 计时页全屏：pin 时钟位移 + `OUTRO_DELAY`(180ms) 外围淡出 → 切布局 → `MORPH_GAP`(36ms) 后放开过渡；时钟 scale 由 `IMMERSIVE_CLOCK_SCALE[clockStyle]`（约 1.26）内联注入 `--immersive-clock-scale`。进出全屏都要清入场动画定时器，否则内容复原后会再播一遍。
- 翻页时钟：按 `flipPhase` 每秒物理重建牌面节点，**不要只靠同一批节点切 class**。共享组件 `components/flip-clock`：主牌 96×168 / 字号 72rpx，毫秒牌与主牌同尺寸；带毫秒时整排加 `.fc-with-ms` 等比收到 88×156 / 66rpx，保证 6 张牌 + 冒号不出屏。
- 毫秒必须是主数字的「同款缩小版」，不能外挂一段纯文本：翻页用毫秒牌、积木用 `q-block-tile-ms`（50×84 / 42rpx）、LED 用 `q-led-digit-ms`（34×60，七段同几何），后两者都塞进各自容器内部；`msCells` 必须带 `segs`（段码来自 `utils/format.js` 的 `LED_PATTERNS`）。只有 digital / neon / outline / minimal / jelly 这类纯文字样式才用 `.q-clock-ms` 文本。
- 数字时钟换帧别让外框跟着动：数字加 `font-variant-numeric: tabular-nums` 并在数字自身上给 `min-width`，否则逐帧宽度变化会把描边壳挤得一直缩放。
- 首页拖动排序：拖动期间关掉 reveal 入场（`.page-content` 条件加 `reveal`、卡片 `animation-delay` 条件输出），否则松手重排时被挤走的卡会闪一下。
- 装饰动画（`medal-pop`、`tomato-pop`、`incentive-*`、`dock-*`、`celebrate-*`）只在状态变化时触发一次；首页奖牌为 `72×74rpx`（圆盘 `58rpx`、丝带 `13×40rpx`、数字 `24rpx`）。

### 动画硬约束
- `@keyframes` 里**不要用 `filter`**，会让整条动画失效。
- 不要依赖「父级 class 变化 → 子元素 animation-name 变化」重启动画（渲染层不可靠），改用换节点 / 换 key / JS 控阶段。
- `animation-fill-mode: backwards` 配 `animation-delay` 时，delay 变化会重新排队并造成 `opacity:0` 闪烁；播完用定时器摘掉触发类。
- 旧基础库对 `clip-path` / `conic-gradient` / `-webkit-text-stroke` 有降级风险，非必要不用。

## 4. 页面布局规则

- **首页**：自定义导航，顶栏右侧不放控件（会被胶囊盖住）。模式胶囊（正计时/倒计时）+ 目标时间卡（缩小奖牌）+ 激励图案横排 + 模板横卡 + 可拖动训练模块列表（`catchtouchmove` 锁滚动）+ 底部 Dock 三项（首页/工具/记录）。重要日子预览与待办预览同款行。
- **报告页**：顶栏固定，内容放独立 `scroll-view`；顺序 = 训练成绩 → 时长对比（一句红/绿大字，只写超时或提前多久）→ 模块明细（每模块小卡 + 滑杆）→ 小鱼复盘 → 底部三按钮同行等宽（保存图片 / 分享 / 再练一次）。
- **数据与打卡**：今日总览深色卡 + 两张指标卡 + 竖版海报（离屏 canvas 绘制）+ 弱项追踪（滑杆轨 + 圆把手，>100% 转红）+ 成绩趋势（自绘 canvas：粗线、线下面积、圆把手数据点、虚线 100% 基准、右侧刻度）。不足 1 分钟的训练不计入弱项/曲线。
- **待办**：自绘日历 + 时间面板（不用原生 picker）；整条点击切换完成，右侧 `›` 编辑；只有一个右下正圆 FAB。
- **重要日子**：列表行与待办行同款（圆点 + 名称 + 日期小字 + 右侧剩余天数），长按删除、点击编辑，空态放 logo。工具页的「待办预览」和「重要日子预览」也必须是同一种行：白卡 + `2rpx var(--line)` + 14rpx 圆角 + 84rpx 高 + 14rpx 空心圆点（临近填 `--primary`）+ 名称 24rpx/800 + 右侧 20rpx/900 小字，不要再用浅蓝大数字卡。
- **计时页**：横屏、大数字总时间、小数字当前模块、毫秒灰小字（8 种样式统一显示，主时间变成 `HH:MM:SS` 即超过 1 小时后由 `msShow` 收起）、完成键只显示 `✓`，避开左上返回与右上胶囊。详细布局见 4.6。时钟皮肤统一在 `styles/clocks.wxss`（`--clk-face/-ink/-line/-accent/-tile/-panel/-panel-edge/-glow/-deco/-fill`），`timer.wxss` / `quick.wxss` / `settings.wxss` 首行 `@import`。
- **时钟外观只写在 clocks.wxss 的「共享外观」段**：同一 `clockStyle` 在计时页 / 快捷计时 / 设置预览里必须长得一样，选择器带页面根类（`.timer-page` / `.quick-page` / `.settings-page`）提高特异度，压过页面级覆盖；页面里只留尺寸（font-size / padding / 宽高），不要各写一份颜色或字体。8 种样式两端都要用真实结构，不能把 blocks / led 退化成纯文字：积木 `blockCells`、LED `ledCells`（段码表统一在 `utils/format.js` 的 `LED_PATTERNS`），七段几何按百分比写在共享段里。翻页与毫秒由 `components/flip-clock` 统一提供。
- **设置**：顶部分区标签（主题/首页/时钟/提醒/专注/模板/隐私），点标签切换；预设模板最多 8 个、默认显示 4 个。「隐私」单独成一档，只放 `privacyAlbum / privacyCalendar` 两个开关和「在微信中管理授权」（`wx.openSetting`），不写解释段落、不放隐私指引入口；关闭态在调用点前置拦截并引导去设置。
- **工具页**：右下齿轮入口用空心圆环 + 八枚沿半径排布的小齿（`.gear-ring` + `.gear-tooth.t1..t8`，靠 `rotate(Ndeg) translateY(-15rpx)` 定位），不要再退回实心圆 + 方齿拼法。

## 4.5 屏幕方向

- **只有 `pages/timer` 是横屏**（`pageOrientation: landscape`）。其余页面（首页、工具、记录、快捷计时、统计打卡、待办、重要日子、设置）一律 `portrait`。
- 项目**不再维护任何横屏适配样式**：不要新增 `@media (orientation: landscape)` 规则，也不要给这些页面加横屏入口或 `wx.setDeviceOrientation` 调用。

## 4.6 计时页当前布局（细化区域，别改结构）

**纵向顺序（从上到下，就是用户认可的最终版）**：大时钟 → 进度条 → 正计时/倒计时标签 → 模块名+模块时间 → TARGET / ON TRACK → 嘀嗒按钮 → 四个按钮。90% 的调整都只是这一条的间距微调。

**DOM 结构**（`pages/timer/timer.wxml`，不要新增包裹层，也不要往回加内联 `style`）：

```
timer-page
└ timer-main
  ├ immersive-toggle（左上角全屏/退出）
  ├ clock-stage
  │ ├ clock-block
  │ │ ├ clock-slot          ← 时钟等高槽位，8 种时钟全在里面
  │ │ └ progress-rail       ← 滑杆 + progress-logo（悬浮，不占位）
  │ ├ stage-upper           ← 模式标签 + 模块名/时间
  │ ├ stage-target          ← TARGET / ON TRACK
  │ └ stage-bottom           ← 四个按钮
  │   ├ mode-chip           ← align-self:flex-end，靠右
  │   ├ stage-meta          ← 模块名 + 模块时间（同一行）
  │   ├ stage-target        ← TARGET 左 / ON TRACK 右，space-between
  │   ├ tick-pill
  │   └ controls            ← ◀ / Ⅱ / 下一模块 / ✓
  └ module-side + module-toggle（右侧模块栏，默认收起 moduleCollapsed:true）
```

**关键尺寸**（`timer.wxss`，改前先读原值）：
- `.timer-main { flex:1; height:100%; padding:0 14rpx 34rpx 0; justify-content:center; }`（右侧 2rpx 分隔线是 module-side 的分界，别删）
- `.clock-slot { height:120px; flex:0 0 120px; align-items:center; justify-content:center; overflow:visible; }` —— **等高槽位是保证切样式时下方不跳动的唯一手段**；`120px` 是 LED（最高 116px）留 4px 余量。子元素用具体选择器给 `flex:0 0 auto`（`flip-clock` / `.block-row` / `.led-clock` / `.plain-clock`）。
- `.progress-rail { max-width:460rpx; padding-bottom:14rpx; }`，logo 28rpx、`top:-8rpx`、`z-index:3`、`pointer-events:none`，**悬浮不占位**（原来 42rpx 占位会撑高组件）。
- `.stage-upper` / `.stage-bottom` 都是 `width:100%; flex 列; gap:6rpx; padding-top:4~12rpx`，自然跟随、**不要再给 `flex:1` / `min-height`**（会吃掉剩余空间，导致改对齐看不出效果）。
- `.mode-chip { position:static; align-self:flex-end; margin:2rpx 0 0; padding:5rpx 12rpx; font-size:18rpx; }`
- `.stage-meta { display:flex; align-items:baseline; gap:12–22rpx; font-size:22rpx; }`（名称与时间必须在同一行、同一组居中，别拆两列）
- `.stage-target { width:100%; max-width:420rpx; margin:0 auto; justify-content:space-between; font-size:18rpx; font-weight:900; }`
- `.tick-pill { margin-top:2rpx; padding:4rpx 14rpx; font-size:19rpx; }`
- `.controls { margin:2rpx 0 0; gap:16rpx; }`
- `.immersive-toggle { left: env(safe-area-inset-left); }`（用户要求贴左边缘，全屏态 `+2px`）
- 全屏：`.timer-page.immersive` 隐藏 `mode-chip / ms-line / style-hint / stage-meta / stage-progress / stage-target / tick-pill / controls / module-side`，只留时钟；`.clock-block` 与 `.clock-slot` 都放开成 `height:100%`。

**硬规则**
- 计时页的节点位置**一律由 WXSS 控制**。不要在 `timer.wxml` 里写 `position:relative; left/top` 这类内联 offset —— 内联样式会压过 CSS（含 `.immersive .xxx { display:none }`），是之前「改了没变化」「全屏嘀嗒跑到时钟上」「模块名偏左」的共同根因，已全量清除。允许的内联 style 只有：主题 `themeStyle`、`clockMorphStyle`、进度填充宽度、logo `left`、星星 `animation-delay/duration`。
- 「往中间靠」指的是**上下方向**（整组贴着进度条下方），不是左右收窄宽度。
- 时钟样式差异只体现在槽内观感，不许让槽位高度随样式变化。

**两套 UI（横屏 / 竖屏，必须分开写，不要互相牵扯）**
- 判定：`portrait = windowHeight > windowWidth`（`pages/timer/timer.js` 的 `syncOrientation()`，`onLoad` / `onShow` / 页面 `onResize` 三处调用，`onUnload` 里 `offWindowResize`）。`timer.json` 仍是 `pageOrientation: "landscape"`，手机进计时页强制横屏，**竖屏一套实际只在电脑 / 开发者工具的窄竖窗口可见**。
- 计时页是**两套独立 WXML**：`<block wx:if="{{!portrait}}">` 横屏、`<block wx:else>` 竖屏，两边各自复制节点，**不要用 CSS `order` 挪同一套 DOM**。
- **横屏纵向顺序**（2026-11 用户重排后的定稿）：右上角悬浮 `mode-chip`（`position:absolute` 不占位，`top` 约 44px 绕开胶囊）→ `stage-meta`（模块名 + 模块时间，居中）→ 固定尺寸大时钟 → `progress-rail` → `stage-target`（TARGET / ON TRACK 两行英文字，**紧贴进度条下方**，用户明确要求，不要再放回胶囊下面）→ `tick-pill`（滴答·静音）→ `controls`（在 `clock-stage` 外面）。宽屏下 `progress-rail` 的 `padding-bottom` 收到 `10px*cs`、`stage-target` 加 `6px*cs` 上边距、`tick-pill` 加 `10px*cs` 上边距，三者才不会被拉成一大段空白。
- **竖屏纵向顺序**：`stage-meta`（模块名 + 时间）→ `tick-pill`（模块时间正下方一行）→ 固定尺寸大时钟 → `progress-rail` → `stage-target` → `controls`；正计时 `mode-chip` 用 `.portrait-corner` 绝对定位在**右上角**。整组由 `portrait-stage { justify-content: center }` 垂直居中。
- 时钟固定尺寸：横屏 compact 每类时钟容器 `height: 100px`（视觉高 96px）；竖屏 `.clock-slot { height: 92px }` + 整排 `transform: scale(.70)`（96px 字号 6 位数在 375 宽会溢出屏幕）。切样式不许改变槽高。
- **选择模块 = logo 悬浮球 + 弹出面板**（2026-11 定稿，横竖屏共用一份，放在两套 `<block>` 之外）：`.module-fab`（`/assets/brand/logo-mark.png`，52px 圆球，右下角 `right 16px / bottom safe-area + 18px`）、`.module-mask`（半透明遮罩，点空白收起）、`.module-panel`（316px 卡片，`max-width 82vw`、`max-height 54vh`，从球上方向左上展开，内部 `scroll-view` 放 `module-list`）。状态 `moduleOpen`，方法 `toggleModuleFab` / `closeModuleFab`；`selectModule` 与 `openImmersive` 里都会自动收起，全屏时三者一并隐藏。
- **旧的右侧竖栏 `module-side` 与折叠把手 `module-toggle` 已废弃**：WXML 里已无这两个节点，WXSS 残留旧规则无副作用，但**不要再往回加节点**，也不要用 `moduleCollapsed`（data 已换成 `moduleOpen`）。
- 横屏 `timer-main` 不再给分栏留位：`padding: 0 18rpx 28rpx`（compact `0 10px 16px`），已去掉 `border-right`。
- 横屏 compact 尺寸只允许 px，不得改 rpx（812 宽下 `1rpx≈1.08px`，会整体翻倍）。
- **全局布局策略：全宽流式自适应 + 响应式安全边距（不设固定居中最大宽度）**。
  - 内容容器 `width: 100%` + `box-sizing: border-box` + 左右 `padding`（用 `%` 或 rpx，随宽度等比，作为安全边距），**不要再用 `max-width: 460rpx/420rpx` 这类固定窄宽居中**；
  - 平板 / 横屏 / 电脑窗口：组件与栅格随可用宽度向两侧扩展，进度条、TARGET 行、按钮行都用百分比（如 `92%/88%`）铺开；
  - 断点：`@media (min-width: 680px)` 里把边距、列宽再调大一档，保证既不贴边也不留大片空白；
  - 计量单位优先 `rpx`（随宽度流式放大），px 只用于描边等细节；
  - **不要**再用 transform 缩放整页来“适配”宽窗口（`utils/viewport.js` 及其所有调用已删除，不要恢复）。
- **横屏 compact 档的尺寸必须用 px，禁止换算成 rpx**：横屏手机宽 812，`1rpx≈1.08px`，把 64px 按钮写成 128rpx 会变成 138px（翻倍），时钟槽 120px 写成 240rpx 会变 260px——上一版就是因此时钟巨大、按钮被裁。已还原的定稿值：时钟槽 `120px`、四键 `64px/3px 描边/28px 字`（prev 24 / complete 30）、next `64px 高/0 20px/16px 字`、controls `margin-top 16px/gap 18px/padding 0 16px(14/18/15px)`、tick-pill compact `8px/6px 16px/14px`、进度条 `max-width 460rpx`、TARGET 行 `max-width 420rpx`。**不要给横屏加 `@media (min-width:680px)` 覆盖**（上一版加了被否，已删）。
- 流式布局规范只约束竖屏一套与其他页面；横屏一套的上述固定尺寸是用户手校成品，属于例外，改动前先问。



- 静态体检：改过的 js 跑 `node --check`；WXML 的 `bind/catch` 事件名必须在 js 中存在；WXSS 花括号配平；所有 `var(--x)` 能在 `app.wxss` / `styles/clocks.wxss` 找到（JS 内联注入的除外）；`git diff --check`。
- 真实截图走微信开发者工具自动化接口，**不要用 Pillow 自绘图冒充效果图**：
  ```bash
  # 需先在 IDE 设置 → 安全设置 开启「服务端口」
  /Applications/wechatwebdevtools.app/Contents/MacOS/cli auto --project /Users/laiyuci/projects/计时器 --auto-port 9420
  npm i miniprogram-automator --prefix /tmp/auto
  node -e "const a=require('/tmp/auto/node_modules/miniprogram-automator');(async()=>{const mp=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});const p=await mp.reLaunch('/pages/index/index');await p.waitFor(3000);await mp.screenshot({path:'/tmp/auto/home.png'});})()"
  ```
  用 `mp.screenshot`（`page.screenshot` 不存在）；每次会话结束端口会关，再截需重跑 `cli auto`。
- 交付时写清改了哪些文件、影响哪些页面。

## 4.7 桌面 / 大屏自适应（PC 微信全屏、宽窗口）

- **桌面信息层级（硬规则，用户明确要求）**：大屏只放大「看的主体」——首页目标时间 + 训练模块、计时页的大时钟、记录页的记录卡、分析页的报告卡、快捷计时的时钟；**功能性控件一律不放大**（顶栏返回、保存 / 清空、删除 ×、加号、步进器 ±、模式胶囊、开始 / 继续 / 暂停 / 计次 / 重置、分段 tab、预设胶囊、dock、悬浮球），保持手机档物理尺寸，只在布局上摊到屏幕边缘并保留边距（左右 24–32px）。主体放大走 `@media (min-width: 1400px)` 一档（约 ×1.25），更宽的屏再加一档，封顶 1.4；不要退回用 rpx 让它无限膨胀。
- **报告页（分析页）**：宽屏下内容列 `max-width: 900px; margin: 0 auto`，卡片才不会被拉成「又宽又扁」的横条；背景渐变要挪到 `.report-scroll`，否则窄列两侧出现色带断层。只收窄会被用户判为「纵向比例不对、组件高度不够」，必须**同时把纵向垫高**：摘要卡 padding `22px 18px`、数字 56px、圆环 136px、三粒胶囊内距 10px；`rp4-frame` padding `20px`、标题 20px、滑杆轨 14px / 把手 22px、对比句 34px、复盘卡 18px 内距 / logo 52px。底部「保存图片 / 分享 / 再练一次」是控件，`flex: 0 0 200px; min-height: 42px; font-size: 13px` 居中排列，不随屏幕放大。
- 判定：`app.js` 的 `detectDesktop()`（`wx.getDeviceInfo().platform` 为 `windows`/`mac`）→ `globalData.isDesktop`；各页 `onLoad` setData `isDesktop`，根节点追加 `{{isDesktop ? 'desk' : ''}}`。
- 根因：`rpx` 按窗口宽度换算，1700px 窗口下 1rpx ≈ 2.27px，所有 rpx 尺寸会整体放大 2.3 倍。**限宽只能防横向拉长，挡不住字号**，必须逐条改 px：`px ≈ rpx × 0.56`（= 手机档的 1.12 倍）。
- 全局（`app.wxss` 桌面段）：
  - `.desk { width: 100%; max-width: 1280px; margin: 0 auto }`（内容列留白居中，不无限拉宽）。
  - 桌面系统标题栏已自带返回箭头，各页自绘 `.topbar` 一律 `wx:if="{{!isDesktop}}"` 隐藏（否则双返回）；因此滚动容器高度只扣底栏：`.desk .config-scroll|.report-scroll|.tools-body|.history-body { height: calc(100vh - 52px) }`，无 tabBar 页（`.stats-body`/`.todo-body`/`.imp-body`）用 `100vh`。**写错会留一条空白带，看起来像有东西盖住内容。**
  - 自绘顶栏若保留，高度锁 `84px`（padding `34px 14px 0`）、标题 18px、返回键 36px。
- 底栏 `custom-tab-bar`：组件隔离，`.desk` 管不到，靠自身 `data.desk`（`syncDesk()` 在 `attached` 与 `pageLifetimes.show` 调）；`.tabbar.desk-bar` 内高 52px、图标 17–19px、文字 11px、间距 3px。
- 悬浮球 `components/brand-dock`：`syncDeskScale()` 按 `k = min(1, 420 / winW)` 反缩（`transform-origin: left bottom; transform: scale(k)`），并监听 `wx.onWindowResize` 重算（拖窗口不会触发 `pageLifetimes.show`）。
- 已 px 化的页面段（新增规则统一加 `.desk` 前缀，放在对应 wxss 末尾）：
  - `pages/tools/tools.wxss`：`.quick-feature`（图标 49px / 标题 17px）、`.tool-tile`（min-height 63px / 29px 图标 / 13px 标签）、`.settings-entry` 54px、六个 `glyph-*` 图标几何、`.di-gear` 22px + 八齿、待办与数据卡字号。
  - `pages/history/history.wxss`：卡片 padding 13px、标题 16px、时长 27px；三个按钮强制 `flex: 0 0 auto; white-space: nowrap`（**不加就会被 flex 压成竖排文字**）。
  - `pages/timer/timer.wxss` / `timer.js`（大屏等比例时钟，用户明确要求「长宽高都放大、所有样式一样大」）：`syncOrientation()` 把倍率注入页面根 `stageVars`——`--ts` 用**当前样式的 `CLOCK_BASE` 装进同一个框**：`min(4.6, max(1, min(winW*0.90/base.w, winH*0.46/base.h)))`（翻页 `440×104`、积木 `522×100`、数字/霓虹/果冻 `440~500×100~122`），`--cs = min(1.28, max(1, ts*0.45))` 只管外围；所有时钟尺寸写成 `calc(72px * var(--ts,1))` 这类等比形式，六种样式因此同大。**历史坑**：① `.wide` 段曾把 flip 62/101、block 64/102、plain 68 写死，比手机档还小，看起来「只有高度变、宽度没变」；② 翻页组件在紧凑档内部是 px（`58×96` 牌面），早期按 rpx 反算 `--fc-scale=(122*ts)/(168*rpxPx)`，宽屏下算出 ≈1，翻页钟只有巴掌大——**正确做法是 `--fc-scale = ts`**，与其它样式同一个倍率；③ `.timer-page.compact` 恒为 true，`transform: scale(1.15)` 挂在 `.compact .clock-stage` 那四个时钟容器上，wide 段要给 `transform: none` 抵消。**全屏**：`computeImmersiveScale()` 用 `98vw × 90vh` 的框、上限从 2.2 抬到 6（原来的 2.2 让全屏反而比普通档小），`.timer-page.immersive .clock-stage` 同步写成 `98vw / 90vh`，且全屏时 `immersiveVars` 必须带 `--fc-scale: 1`（全屏由容器统一放大，翻页不能再叠乘），根节点 style 顺序必须是 `themeStyle → stageVars → immersiveVars`，否则普通档的 `--fc-scale` 会盖掉全屏的 1。
  - `pages/timer/timer.wxml`：点击切时钟样式原来挂在 `.clock-stage`（覆盖整块区域），点空白也会误切；改为只挂在时钟本体（`flip-clock` 组件节点、`.block-row`、`.led-clock`、`.plain-clock`，横竖两套共 8 处），`.clock-stage` 本身不再接收 tap。切换后由 `.style-hint`（`var(--primary)` 底 + `var(--on-primary)` 字）短暂显示「已切换为 xx」，1.3 秒自动收起，属控件级提示不随屏幕放大。
  - `pages/settings/settings.wxss`：内容列 `max-width: 960px; margin: 0 auto`（1400px 档 1040px），表单类页面不收窄会被拉成「一条开关横跨 1200px」。主体放大：时钟大预览 150px 高 / 数字 54px（1400 档 172px / 62px）、列表小卡 `clock-style-sample` 62px 高 / 数字 26px（1400 档 72px / 30px）、主题色块 22px→26px、主题三列 / 时钟样式四列。控件锁手机档：分段胶囊 14px、开关 54×29px（knob 22px、on 位移 27px）、选项/铃声胶囊 12–13px、色点 29px、主题名输入框 52px、底部按钮 12–13px。分区切换用 `pane-fade-desk` 纯淡入，避免 `-18rpx` 位移在宽屏被放大成 40px 跳动。
  - `pages/index/index.wxss`：报告 v4（`.rp3-*`）与 v5（`.rp4-*`）两套卡片的字号/padding/圆环（`.rp3-ring` 93px→136px）/滑杆尺寸；`.rp3-big` 36px→56px。
  - `pages/important/important.wxss`：条目（主体）字号与内距；添加胶囊 49px、加号 19px、弹层输入框 46px、日期块、日历格 27px、取消/确定按钮内距 11px 全部锁手机档。
  - `pages/todo/todo.wxss`：完成度 36px、日历格 35px、待办条目 16px（主体）；悬浮 + 60px 贴右下 22px、勾选圈 27px、日历箭头 29px、输入框 84px、日期/时间入口、提醒胶囊、底部按钮全部锁手机档；弹层内容列 `max-width: 620px` 居中。
  - `app.wxss` 通用 `.desk .modal-*`：所有弹窗 `max-width: 620px`，标题 18px、输入框 46px、按钮 14px（工具页 / 首页模板弹窗共用）。
  - **首页「设置 → 首页」里的每种主内容都必须就地可用，不要做“先跳页再开始”的贴片**（2026-11 用户明确要求）：
    - 秒表 / 计时器 / 番茄钟：`pages/index/index.js` 自带一套 `hq` 引擎（`initHomeQuick` / `renderHomeQuick` / `toggleHomeQuick` / `resetHomeQuick` / `selectHomeQuickPreset` / `finishHomeQuick`），时钟本体点一下就是开始/暂停，下面「暂停·继续」「重置」是控件（桌面固定 132×46px，不放大；时钟本体桌面 72px→1400 档 88px→1600 档 96px，舞台高度 168/200/224px）。计时器带 10/20/30/60 预设胶囊，番茄钟 25 分钟后自动切 5/15 分钟休息并保持运行。
    - 进度写入**与快捷计时页同一个** `exam-timer-quick-state`（version 2 结构），点右上「全屏 ›」过去能接着跑；只有在用户真的操作过（`homeQuickDirty`）才写，避免覆盖快捷页里别的模式的进度。离开页面时 `stopHomeQuickTick()`，回来 `initHomeQuick()` 按时间戳续算。
    - 待办：行点击 `toggleHomeTodo` 直接勾完成（不跳转），行尾 `›` 才是进待办页；`＋ 新建待办` 打开首页内联弹层（`homeTodoComposerOpen`，文本 + 不设时间/今天/明天，今天明天落到 23:59 避免刚建就判超时）。
    - 重要日子：行点击 `editImportant` 复用首页已有的重要日子弹层就地编辑，`＋ 添加重要日子` 走 `openImportantModal`。
    - 打卡：首页只展示完成度（主体），点击仍进 `pages/stats` 看海报/曲线，属“看详情”，不是可操作功能的跳转。
  - 快捷计时时钟走 `pages/quick/quick.js` 的 `syncClockBox()`：以 100rpx 为基准反算 `transform: scale(k)`，目标字号 = `min(winW*0.115, winH*0.2)` 夹在 64–260px（宽 1700 屏约 195px，占屏宽一半出头）。**不要写成固定 62/70/76**——那在 1090px 高的屏上只剩中间一小坨，四周全是留白，用户明确反馈过太小。`onShow` 与 `onResize` 都要重算。
- 计时页横屏另有 `wide` 断点（`!portrait && windowWidth >= 900`），细节见 4.6。
- **底部空白带**：桌面底栏真实高度 = 52px + `env(safe-area-inset-bottom)`（mac 微信会返回手机档安全区）。滚动容器用 `calc(100vh - 52px - env(safe-area-inset-bottom))`，少扣安全区就会在内容下方露出一条几十 px 的空白，看着像"有东西盖住"。
- **工具页设置齿轮（`.settings-entry`）在宽屏飘在半空（已修）**：它是 `position: fixed`，但偏移写的是 rpx（`right: 28rpx`、`bottom: calc(126rpx + env(safe-area-inset-bottom))`），1700px 窗口下变成右 63px、底 286px，齿轮离底栏两百多像素、看着悬在页面中间。桌面档用 `.desk.tools-page .settings-entry { right: 24px; bottom: calc(52px + env(safe-area-inset-bottom) + 14px) }` 钉回屏幕右下、浮在底栏之上。**通用规律**：fixed 悬浮元素（齿轮、FAB、悬浮球、提示条）的 `right/left/bottom/top` 一律不要用 rpx，宽屏会成倍偏移。
- **底部内容被悬浮元素压住（各页统一口径，2026-11 全量修过）**：手机档内容底部内距是 `64rpx` 这类值，桌面 px 化时被改成 17–32px，于是滚到底时最后一张卡正好落在左下角 `brand-dock` 悬浮球（tabBar 页在 `bottom:64px`、无 tabBar 页在 `bottom:12px`，球高约 40px）或待办页右下角加号（60px，`bottom:27px`）的位置上，被压住一半。桌面底部内距统一按「悬浮元素落点 + 8px 余量」给：tabBar 页（`tools` `.page-content`、`history` `.history-body`、首页 `.report-page`）**72px**；无 tabBar 页（`important` `.imp-body`、`settings` `.settings-body`）**64px 起**（settings 取 72/76）；待办 `.todo-body` 要同时避开球和加号，**96px**。手机档的 `64rpx` 本身就是够的，是 px 化改小才出问题，别再往下调。
- **滚动抽搐**：`.add-module-row`（训练模块末尾的加号）原来用 `wx:if="{{addVisible}}"` 插入/移除，滚到底时它把 `scrollHeight` 撑高，`onConfigScroll` 的触底判定立刻翻回 false，于是反复一次导致屏幕抖动。改成**常驻占位 + `.on` 切 opacity**，高度不再变化；同时去掉它身上的入场动画（动画会把 opacity 拉到 1 再回落，闪一下）。
- 桌面下模块标题被"切一半"：`rpx` 放大后字号大于 input 高度才裁字，px 化时给 `.module-name` 一并锁 `height/line-height`。
- **悬浮加号阴影错位（待办页 `.fab`）**：`.desk .fab` 已写 `box-shadow: 4px 5px 0`，但 `@keyframes todo-fab-breathe` 里是 `7rpx 8rpx` / `9rpx 10rpx`，宽窗口下 1rpx≈2.3px，动画一帧就把阴影撑到 16–23px，看起来像按钮旁边多了一块深色圆。修法：`.desk .fab { animation: none !important }`。**通用规律**：凡是 keyframes 里写 rpx 的无限动画（呼吸、浮动、脉冲），大屏下都会把偏移/位移放大到失配，桌面必须整条停掉，不要只覆盖基础样式。
- **软键盘遮挡输入框**：弹层 `.modal-mask` / `.sheet` 是 `position: fixed`，键盘弹起时不会跟页面一起上推。`utils/format.js` 里的 `bindKeyboardHeight(page)`（原来单独放在 `utils/keyboard.js`，因新文件进不了编译已并回 format） 监听 `wx.onKeyboardHeightChange`，把高度写进页面根的 `--kb`，`app.wxss` 里 `.modal-mask { padding-bottom: var(--kb, 0px) !important }` 让弹窗内容整体上移（必须 `!important`，各页 `padding: 0 xx` 简写会盖掉）；待办页是另一套：`.sheet` 直接用 `style="bottom: {{keyboardHeight}}px"` + `.kb-open` 压高度。PC 微信用实体键盘不弹软键盘，此项只在 iPad / 触屏平板横屏、手机端生效。
- **新建的独立 util 文件可能进不了编译（踩过）**：中途新建 `utils/keyboard.js` 后，运行时报 `module 'utils/keyboard.js' is not defined`，首页直接报错。开发者工具对“会话中新出现的文件”有时不纳入 app service 包（热重载依赖图是旧的）。**对策**：临时工具函数并进已被引用的老模块（`utils/format.js` 就是本项目的公共水池）；真要独立文件，改完让用户点“编译 / 重新编译”或重启开发者工具。
- **页面 wxss 也会被查选择器（踩过）**：`pages/index/index.wxss` 里 `.primary-button text`（标签选择器）和 `.primary-button[disabled]`（属性选择器）会触发 `Some selectors are not allowed in component wxss` 警告；`pages/timer/timer.wxss` 的 `.module-info text:first-child` 同理。**对策**：节点补 class（`.primary-arrow` / `.is-disabled` / `.mi-name` / `.mi-num`），选择器只留 class，属性选择器能删就删。
- **顶栏闪一下黄色（已修）**：三个来源叠加才出现。
  1. `app.json` 的 `window.navigationBarBackgroundColor: #FFD874`（奶油黄）、`backgroundColor: #FBF3DF` 是静态值，且默认主题已改成「晴空苏打」，所以启动/切页瞬间露出的是旧默认的黄。
  2. 各页 `data` 里没有初始化 `isDesktop` / `theme`（初始为空字符串）→ 桌面首帧按「手机」渲染：`wx:if="{{!isDesktop}}"` 把自绘 `.topbar` 画出来，同时 `theme-` 空类导致 `--nav` 未定义，顶栏透明，直接露出 page 的黄底 → 一帧黄条。
  3. `applyNavBar()` 原来带 `animation: { duration: 200 }`，从系统静态色渐变到主题色，那 200ms 就是人眼看到的「闪一下」。
  修法：`app.json` 静态色对齐默认主题（`#7CC0EC` / `#EFF6FE`）；页面 `data` 首帧直取 `getApp().globalData.isDesktop`、`getApp().getTheme().key`、`getApp().getThemeStyle()`；`app.js` 的 `onLaunch` 末尾补 `this.applyNavBar()`；`applyNavBar` 改 `duration: 0`、`frontColor` 规范化为 `#ffffff`/`#000000`（该参数只认这两个值）并 try/catch。
  **通用原则**：凡是「首帧看着不对、随后自己变好」的闪烁，都是 `data` 初始值与真实状态不一致，别靠延时/动画去掩盖，直接在 `Page({ data })` 里同步取值。
- **首页激励图案点一下就切（本轮新增）**：`.tomato-board` 挂 `bindtap="cycleIncentive"`，按 `['tomato','star','bubble','fish']` 循环；写 `app.saveSettings({ incentiveType })` → `loadTomatoes()` 重建图标行 → `playIncentiveReveal()` 弹一下 → `wx.showToast` 报当前名字。激励类型唯一来源仍是 `settings.incentiveType`（`app.js` 的 DEFAULT_SETTINGS、设置页“激励”选项、首页 `loadTomatoes()` 三处共用），所以首页点一下，设置页的选择也会同步变。**注意**：`loadTomatoes()` 每次都从 `app.getSettings()`（读 storage）取值，所以保存后立刻调用就能拿到新值，不用额外传参。
- **`bindKeyboardHeight is not a function` 会把页面 onLoad 直接打挂（本轮已兜底）**：`pages/tools/tools.js:38`、`pages/index/index.js:147`、`pages/important/important.js:34` 都直接调用 `bindKeyboardHeight(this)`，一旦 `utils/format` 的缓存/灰度版本没带上这个导出，整个页面 onLoad 抛错（日志里是 `Subpackages N/A`、`LazyCodeLoading` 正常，纯导出缺失）。现在三处都改成 `typeof bindKeyboardHeight === 'function' ? ... : null`，解绑本来就是判空的，不会再崩。**规律**：页面 onLoad 里调工具函数，一律先 `typeof === 'function'` 再调。
- **页面 wxss 里的标签选择器会被告警**（`Some selectors are not allowed in component wxss...tag name selectors`）：本项目报过 `.quick-feature-modes text`（tools）、`.picker-units text`（quick 4 处）、`.sched-week text`（todo 2 处），以及 timer 里一条已死掉的 `.complete-button text`。**改法**：给对应 `<text>` 加 class（`qf-mode` / `picker-unit` / `sched-week-cell`），选择器换成类；死规则直接删。`page { ... }` 选择器是允许的，别误删。
- **三种时钟皮肤重设计（2026-11，本轮）**：`neon` 霓虹发光 → **荧光划线**（无框无底，`linear-gradient(180deg, ink 0 52%, primary 52% 100%)` + `background-clip:text`，上半墨下半主色）；`outline` 描边空心 → 去掉外壳边框，`-webkit-text-fill-color: transparent` + `-webkit-text-stroke`（手机 2rpx / 桌面 1.5px，描边过粗会把空心填死，这是它之前“看着不空心”的原因）；`minimal` 圆体极简 → **细体留白**（无框，`font-weight:300` + 宽字距 10rpx / 桌面 8px）。**三处必须一起改**：`styles/clocks.wxss`（唯一定义，含 timer/quick/settings 三套选择器 + `.desk` / `@media (min-width:700px)` 桌面档）、页面 wxss 里残留的边框/底色（已清成只剩 padding）、`utils/format.js` 的 `CLOCK_STYLES` 名称与描述。**坑**：计时页根节点**不带 `desk`**（它恒为 compact），所以计时页的桌面档只能用 `@media (min-width:700px)`，不能用 `.desk.timer-page`。
- **翻页钟大屏顶边（本轮）**：`pages/timer/timer.js` 的 `CLOCK_BASE.flip` 从 `{440,104}` 收到 `{452,108}`，装框倍率随之降约 3%，全屏/大屏时翻页钟左右不再压出边界（原来超出量不大，所以只收这一点点）。
- **底栏页面的滚动区不要「扣高度」（本轮改动，覆盖旧口径）**：旧做法是 `height: calc(100vh - 52px - env(safe-area-inset-bottom))`，把滚动区截断在底栏上方。只要页面里算出来的 `env(...)` 和底栏组件里的不一致（实测差约 34px，即一个安全区），截断线就浮在底栏上方，露出**一条画不出内容的死白带**，最后一张卡被切半。**新口径**：`height: 100vh`（铺到窗口底边）+ `padding-bottom: calc(52px + env(safe-area-inset-bottom) + 28px)`（把内容抬到底栏之上，28px 顺便避开左下悬浮球）。底栏是不透明主题色（`custom-tab-bar/index.js` 的 `tabStyle` 用 `swatch[0]`），内容从底下穿过看不出接缝。适用 `.desk.app .config-scroll`、`.desk.tools-page .tools-body`、`.desk.history-page .history-body`；报告页 `.report-scroll` 只改高度，净空由 `.desk .report-page` 自带的 `72px + safe` 提供。
- **报告页顶部渐层只铺到 1280 就断掉（本轮已修）**：`.desk .report-scroll` 上挂了 `linear-gradient(accent-bg → bg 258px)`，但它是 `.desk`（max-width 1280）的子元素、宽度只有 1280，窗口 1400px 以上时渐变在两侧断掉，露出底下纯 `--bg`，看起来像“左右两侧没跟主题”。**修法**：把滚动容器拉成整屏——`width: 100vw; margin-left: calc((100% - 100vw) / 2)`，内容列仍由 `.desk .report-page { max-width: 900px; margin: 0 auto }` 居中。**排查口径**：凡是“页面级”背景/渐变，不能挂在 `.desk` 的子容器上（宽 1280 会露边），要么挂 `.desk::before`（fixed 整屏），要么把容器拉成 100vw。目前全项目只有 `.report-scroll` 一处。
- **提醒铃声（2026-11 换新）**：`app.js` 的 `RINGS` 五款改成轻快常用音——叮咚 / 气泡 / 风铃 / 木琴 / 轻铃，音源放在 `assets/audio/`（`ring-dingdong` / `ring-bubble` / `ring-windbell` / `ring-xylophone` / `ring-softbell`，22050Hz 单声道 AAC，2.6–3.4s，单个 7–11KB）。**key 沿用旧值**（chime/bell/drop/marimba/clear），已保存的铃声选择不会失效；旧音源文件保留但不再被引用。铃声都是本地合成的纯音（无版权、体积可控），不是网上抓的成品。
- **番茄钟单位混用导致恢复后显示 00:01.50（本轮已修）**：`pages/quick/quick.js` 里 `POMODORO_FOCUS = 25 * 60`（秒），但 `formatTimerParts()`、stopwatch、首页共享状态 `exam-timer-quick-state` 全是毫秒；`tickPomodoro()` 又把 `pomodoroRemaining = Math.ceil(remaining/1000)` 存成秒，于是 `restorePomodoro()` 把 1500（秒）当 1500ms 显示，初始状态变成 `00:01.50`。**修法**：常量改毫秒（`25*60*1000` / `5*60*1000` / `15*60*1000`），`start()` 的 `endAt = now + remaining` 不再 `*1000`，`resetPomodoro` / `advancePomodoro` 的 `formatTimerParts()` 参数去掉 `*1000`，`tickPomodoro` 直接存毫秒剩余。**旧数据迁移**：恢复时若 `pomodoroPhaseTotal < 60000` 就判定为“秒”，把它和 `pomodoroRemaining` 一起 `*1000`（两处 restore 都要改）。**规律**：这个项目的计时状态一律毫秒，任何 `* 1000` / `/ 1000` 都要当成可疑点。
- **快捷计时页：预设时间改成“板砖”、滚轮单位对齐（本轮改）**：`.preset-grid` 从 `flex-wrap` 换成 `display:grid`——竖屏 `repeat(2,1fr)`、大屏 `repeat(3,1fr)`，`gap 18rpx / 12px`；`.preset-chip` 高度 `152rpx`（大屏 `96px`）、字号 `30rpx/16px`、圆角 22rpx/14px，按 1fr 平分铺满，不再是细长胶囊。**坑**：旧 `.desk .preset-chip` 还有 `min-width: calc(33.333% - 4px)`，grid 下会撑破列宽，必须显式 `min-width: 0`。滚轮那边 `.time-picker` 是 content-box + `width:100%` + 2rpx 边框，三列比下面 `.picker-units` 宽一点点，宽屏放大后“时/分/秒”就对不上轮子：给 `.time-picker` 加 `box-sizing:border-box`，`.picker-units` 改 `display:grid; grid-template-columns:repeat(3,1fr)`。大屏滚轮同步放大到 `236px` 高 / 每行 `76px` / 字 30px，**`quick.js` 的 `indicatorStyle` 必须一起改成 `height: 76px`**，否则选中框对不上行高。
- **打卡页整页没做桌面适配（本轮已补）**：`pages/stats` 之前是唯一全 rpx 的页面，1700px 窗口下标题/面板/间距被放大 2.3 倍变成巨块。已补 `.desk.stats-page` 整段（面板 `max-width:1040px` 居中、padding 18/22px、标题 20px、弱项追踪 22px 徽标 + 14px 滑轨、海报 `max-width:560px`、底部 72px）。
- **`wx.createCanvasContext` 画布在大屏只占左上角一小块（踩过）**：`pages/stats` 的成绩趋势画布按固定 300×150 逻辑坐标画，CSS 却是 `width:100%`，宽屏下就变成「大卡片里一个迷你图表」。**正解**：`drawTrend()` 先用 `wx.createSelectorQuery().select('.trend-canvas').boundingClientRect()` 量出真实宽高，`k = min(w/300, h/150)`，然后 `ctx.scale(k,k)` + `translate` 居中（先在未缩放状态 `clearRect` 清底，避免窗口变化留下残影），首帧量到 0 就 200ms 后重试。CSS 侧用 `width:100%; height:380px; aspect-ratio:2/1`（支持的端正好铺满，不支持的退化成 380px 高）。**通用规律**：任何老版 canvas 绘图都会这样，画之前先量尺寸再缩放。
- **切主题后大屏两侧留白不变色（已修）**：`.desk` 把根节点限到 `max-width:1280px`，根节点的 `background: var(--bg)` 只铺中间那列；两侧露出的是 `page` 背景，而 `page` 在主题根节点之外、`var(--bg)` 根本没定义，于是回落到 `app.json` 里写死的静态色（旧 sky `#EFF6FE`）。修法两处一起：
  1. `app.wxss` 桌面段加 `.desk::before { content:""; position:fixed; inset:0; z-index:-1; background:var(--bg) }` —— 用整屏 fixed 底层兜住四边，不改根节点宽度，就不影响各页已算好的滚动高度（页面根只有 `app-page-fade`（纯 opacity），不会把 fixed 变成跟随滚动）。
  2. `app.js` 的 `applyNavBar()` 里 `wx.setBackgroundColor` 原来用的是 `theme.swatch[0]`（调色板主色），窗口底色会被染成主色；改成 `theme.css.bg`（自定义主题也带 `css.bg`），并加 try/catch。
  **通用规律**：凡是“只有一部分区域跟主题”的问题，先查那块区域的变量作用域——主题变量只挂在根节点上，`page` / 组件 / fixed 浮层都读不到。
- **果冻叠影（`clock-jelly`）错位过大（已修）**：外观里的 `text-shadow: 4rpx 5rpx 0 primary-2, 7rpx 8rpx 0 edge` 与 `-webkit-text-stroke: 2rpx` 是 rpx，1700px 窗口下 1rpx≈2.3px，54px 数字后面挂着 16px 的深色影子，看起来像三份数字叠在一起（设置页大预览与样式小卡最明显）。修法：`styles/clocks.wxss` 末尾加 `.desk.*` 档，描边 1px、错位 `2px 2px` + `3px 4px`（快捷页毫秒 `1px 1px` + `2px 3px`）。**通用规律**：写在 rpx 的 `text-shadow` / `-webkit-text-stroke` / `filter` 在宽屏会和 px 化的字号脱节，桌面必须一起换算成 px。
- **首页激励图案（番茄 / 星星 / 小鱼 / 奖章，`pages/index/index.wxss` 末尾「桌面 / 大屏：首页激励图案」段）**：
  - 症状：宽屏下图案只剩几个色块、叶子/尾巴/高光互相叠压、整行歪斜。根因是只缩了本体，`::before`（叶子 / 鱼尾）和 `::after`（高光 / 鱼眼）仍是 rpx，1700px 窗口下被放大到反超本体；同时 `.tomato-row` 还是 `space-between`，把几颗图案摊到整行两端。行布局现在改为 `.tomato-grid` 纵向 flex + `.tomato-row` 宽度 auto、`justify-content: flex-start` + `column-gap` 4px，靠右紧凑排列。
  - **硬规则（用户 2026-11 明确追加）：大屏下激励图案一律不放大**，固定成手机档物理尺寸；曾试过「桌面 18px → 1400px 档 21px → 1600px 档 30px」三档放大，结果容器放大了、内部部件（叶子 / 鱼尾 / 高光）没同步，图形旋成涡状，且 8 列×3 行摆不下 hero 卡，顶部被压。现在只有一套值：`.tomato` 16×15、`.tomato.star` 16×16、`.tomato.bubble` 15×15、`.tomato.fish` 19×13、`.incentive-art` 17×17 / `.fish` 21×17、`.fish-body` 15×12、`.fish-tail` 7×10、`.fish-eye` 3×3、`.tomato-count-badge` 22×15/字 9px、`.tomato-plus` 13px、`.hero-medal` 36×37（ribbon 7×20、disc 29×29、count 12px）。**不要再加 @media 放大。**
  - 尺寸口径：手机档基准是 `33×30rpx`（375 屏 ≈16px），桌面统一按 0.5 系数（≈1:1）重写本体 + 叶子 + 高光 + 鱼部件，保证容器与内部件比例一致，不会错位。
  - **静态化**：用户要求大屏不要动效。WXSS 不允许通配 `*`（编译报错），必须逐个列选择器并统一 `.desk .tomato-board .tomato, .tomato::before, .tomato::after, .incentive-art, .incentive-art-img, .goal-medal, .medal-disc, .tomato-plus, .tomato-count-badge { animation: none !important }`；首页奖章挂在 `.hero-card` 上而非 board 内，另加 `.desk .hero-card .hero-medal { animation: none !important }`（要压过 `.hero-card.reveal .hero-medal` 的入场动画）。wxml 上的 `animation-delay` 内联保留不会生效。
  - 报告 v3 的 `.rp3-fish-avatar` 复用了 `.incentive-art.fish`，桌面锁 `48×42px`（鱼本体 21×17 再 `scale(2.15)` 刚好铺满），否则会被缩成一小点。

## 5. 视觉验收（不要凭空画图）

- 静态体检：改过的 js 跑 `node --check`；WXML 的 `bind/catch` 事件名必须在 js 中存在；WXSS 花括号配平；所有 `var(--x)` 能在 `app.wxss` / `styles/clocks.wxss` 找到（JS 内联注入的除外）；`git diff --check`。
- 真实截图走微信开发者工具自动化接口，**不要用 Pillow 自绘图冒充效果图**：
  ```bash
  # 需先在 IDE 设置 → 安全设置 开启「服务端口」
  /Applications/wechatwebdevtools.app/Contents/MacOS/cli auto --project /Users/laiyuci/projects/计时器 --auto-port 9420
  npm i miniprogram-automator --prefix /tmp/auto
  node -e "const a=require('/tmp/auto/node_modules/miniprogram-automator');(async()=>{const mp=await a.connect({wsEndpoint:'ws://127.0.0.1:9420'});const p=await mp.reLaunch('/pages/index/index');await p.waitFor(3000);await mp.screenshot({path:'/tmp/auto/home.png'});})()"
  ```
  用 `mp.screenshot`（`page.screenshot` 不存在）；每次会话结束端口会关，再截需重跑 `cli auto`。
- 交付时写清改了哪些文件、影响哪些页面。

## 6. 常见坑

- **WXSS 不支持通配选择器 `*`**（`.a > * { ... }` 会直接编译报错、页面报错），要约束子元素就写具体选择器列表（`.slot .a, .slot .b { ... }`）。
- **WXML 里不要写位置类内联样式**：内联 `position/left/top/display` 会压过 WXSS，导致样式「改了没变化」或本该隐藏的元素（全屏时的嘀嗒、模块行）依然显示。布局一律交给 WXSS。

- `flex-wrap + justify-content: space-between` 在微信里最后一行会被拉满，改用 grid 或 `flex-start`。
- 页面内旧版 canvas 藏在视口外或透明会毁导出或吃点击；海报用 `utils/painter.js` 的离屏 2D 画布。
- `wx.getImageInfo` 吃相对路径会把 `/assets/...` 解析成 `pages/xxx/assets/...` 返回 500；改用 `canvas.createImage()` + `image.src = '/assets/brand/logo-mark.png'`。
- 2D canvas 的 `drawImage` 不能传路径字符串。
- 小程序没有「创建桌面快捷方式 / 服务端推送」能力；离线提醒走 `wx.addPhoneCalendar`。
- 品牌名统一「小鱼计时器」（英文 `FISH TIMER · DAILY`），装饰性的「泡泡」动效/图标名可保留。

- **计时页时钟不许把「模块名 + 时间」顶出屏幕（2026-11 定案）**：`.timer-main / .portrait-main` 都是 `justify-content:center` + 页面 `overflow:hidden`，内容超高时上下对称裁掉，最先被裁的就是 `.stage-meta`。现在由 `timer.js` 的 `scheduleFitClock / fitClock / verifyClockFit` 实测 `.clock-stage`、`.clock-body`（flip 组件用 `.clock-body` 挂在宿主上，页面 wxss 不能用 `flip-clock` 标签选择器）、`.controls`、`.clock-slot` 的矩形，算出 `--clk-fit`（0.55–1，只缩不放）写到根部 style，CSS 用 `.timer-page .clock-body { zoom: var(--clk-fit) }` 应用——**必须用 `zoom` 而不是 `transform`**，`transform` 不改布局尺寸，缩完仍占原位、照样挤。竖屏天花板是 `.clock-slot` 固定 92px（原写死的 `transform: scale(.70)` 已删除，改由 fit 统一接管，顺带消掉 `flip-clock` 标签选择器告警）；横屏天花板是 `main.height - chrome - controls`。所有 fit 都在 `syncOrientation` 末尾触发（样式切换 / 窗口 resize / onShow 都会走到），全屏 `immersive` 下强制 `--clk-fit:1`。另外 `.stage-meta` 的 `meta-module` 加 `max-width:58% + 省略号`、`meta-total` 不换行，保证再挤也先省模块名、时间永远在；`@media (max-height:430px)` 收窄间距与按钮到 44px，给矮横屏腾高度。

- **「切换首页」已整体删除（2026-11 定案）**：设置页不再有「首页」分区，`homePrimary / homePrimaryOptions / selectHomePrimary`、`index.wxml` 里 6 种首页分支（训练计时 / 秒表 / 计时器 / 番茄钟 / 待办 / 重要日子 / 打卡）、`homeQuick*` 内嵌快捷计时（含 `HOME_QUICK_PRESETS` 与 500ms 轮询）、`homeTodo*` 新建待办弹层、`homeStats`、`homeTimerOverride` 与 `exam-timer-home-timer` 全部删除；首页恒为训练计时单视图，`tools.js openHome()` 直接 `switchTab`。**首页不再复制任何功能页面**（这也是此前「自定义首页」争议的终结口径：要直达就跳真实页面）。
- **激励图案改在「主题」分区最上面**：设置页分区顺序 主题 / 时钟 / 提醒 / 专注 / 模块 / 隐私，主题分区里先「激励图案」`opt-grid`，再「主题配色」`theme-grid`，用现成的 `.pane-sub` 做小标题；`.opt-grid` 与主题卡片共用同一套 rpx/px 自适应。
- **首页顶部新增快捷功能条（不复制功能，只做入口）**：`.feature-strip` 用 `scroll-view scroll-x` + `.feature-strip-inner{display:flex;nowrap}` 横排胶囊（秒表 / 计时器 / 番茄钟 / 待办 / 重要日子 / 打卡 / 全部功能），点击 `bindtap="openFeature"` 读 `data-url` 直接 `wx.navigateTo` 真实页面，最后一项 `goPageTools` 用 `switchTab` 到工具页。**横向滚动是硬约束**：条目再多也只在条内滑，绝不会撑破页面；手机 rpx、桌面 `.desk` 用 px。想换成「2×3 图标格」或「长按空白弹快捷面板」时，只改这一块 WXML 与对应样式即可。

- **首页「长按固定」到首页（组件化，不是复制页面）**：`app.DEFAULT_SETTINGS.pinnedFeature`（`timer` / `quick-stopwatch` / `quick-countdown` / `quick-pomodoro`），首页 `pages/index/index.js` 的 `pinFeature / pinHomeTimer / applyPinnedFeature` 负责长按写设置；`index.wxml` 里 `.feature-strip` 胶囊条放在面板之外（轻点 `openFeature` 跳真实页、长按 `pinFeature` 固定、`训练计时` 胶囊轻点 = 取消固定），下方 `<block wx:if="{{pinnedQuickTab}}">` 渲染 `<quick-panel start-tab>`，`wx:else` 才是训练计时整块。
- **`components/quick-panel` 是快捷计时页的真实逻辑**：用 acorn 解析 `pages/quick/quick.js` 的 `Page({...})` 对象，按属性切出来重排成 `Component({ properties:{startTab}, data, lifetimes:{attached/detached}, pageLifetimes:{show/hide/resize}, methods })`，`onLoad/onShow/onHide/onUnload/onResize` 分别映射到 attached/show/hide/detached/resize；样式用 `@import "../../pages/quick/quick.wxss"` 单源复用，**没有另写一套外观**；`options:{addGlobalClass:true}` 让 app.wxss / 主题类生效。嵌入态靠 `.quick-page.qp-embed` 把 `height:100vh` 改成 `62vh`（桌面 `.qp-embed.desk` 460px），并去掉了页面 topbar / brand-dock。
- **Cookie 级坑**：①组件 wxss 里 `.desk` 是页面级祖先，嵌进组件后不成立——统一在组件内部自带 `desk` 类，用 `.qp-embed.desk` 这种同元素选择器；②`observers` 的 `startTab` 会在首次挂载时也触发，必须用 `this._ready`（attached 末尾置 true）挡掉，否则会把从 storage 恢复的「正在跑」状态清掉；③组件 attached 时页面不会触发 `pageLifetimes.show`，要在 attached 末尾补 `syncTheme / syncClockBox / startTicker`。
- **还没组件化的三项**：待办 / 重要日子 / 打卡 目前 `pinnable:false`，长按只提示「这一项还不能固定到首页」。要接进来同样是"把页面主体抽成组件"，不是复制一套精简 UI（用户明确否决过复制品）。


## 7. 2026-11 第四批验收后的定案（快捷页遮挡 / 悬浮球切换 / 荧光划线 / 工具页训练）

- **快捷计时页（整页）遮挡的口径**：`pages/quick/quick.wxss` 末尾给 `.time-picker` 限高 `max-height:40vh`（内嵌面板 `30vh`），主按钮 `.quick-actions` 改 `position:fixed`（`left/right 24rpx`、`bottom: calc(env(safe-area-inset-bottom) + 18rpx)`、`z-index:6`），`.quick-body` 补 `padding-bottom: calc(env(safe-area-inset-bottom) + 168rpx) !important`（桌面档 96px），保证选择器再高也压不到按钮、按钮永远可点。
- **首页内嵌面板反过来不许自己滚**：`.quick-page.qp-embed { height:auto; max-height:none }`、`.qp-embed .quick-body { flex:0 0 auto; overflow:visible }`、`.qp-embed .quick-clock-card / .quick-clock-stage { flex:0 0 auto }`、`.qp-embed .quick-actions { position:static }`，时钟本体再补 `.qp-embed .quick-clock-stage { width:100%; overflow:hidden }` + `.qp-embed .clock-display { max-width:100% }`——内嵌态由首页整页滚动，绝不把内容裁在面板边界上。
- **悬浮球 `brand-dock` 是唯一的切换入口（不再依赖胶囊条）**：`components/brand-dock` 新增 `pinnedFeature / featureOptions` + `switchFeature(key)` + `.dock-switch / .dock-switch-chip`，面板顶部一块「首页显示」（训练计时 / 秒表 / 计时器 / 番茄钟 / 待办 / 重要日子 / 打卡）。点选规则：当前页若有 `applyPinnedFeature` 就地切；否则先写设置再 `switchTab` 回首页。`this.featureOptions` 需与首页 `featureChips` 的 key 保持一致。`.dock-panel` 加 `max-height:78vh; overflow-y:auto`。
- **`rpx` 在宽窗口被放大成「整套巨大」的另一层原因**：`isDesktop` 只看 `platform === windows | mac`，开发者工具宽窗口有时判不出来，rpx 仍按窗口宽放大。快捷页与 quick-panel 的 `isDesktop` 统一补 `|| wx.getWindowInfo().windowWidth > 600`（try/catch 兜底 `getSystemInfoSync`）。
- **荧光划线 neon 不再上下两截**：原 `linear-gradient(180deg, ink 0 52%, primary 52% 100%)` + `background-clip:text` 会变成「上半墨色、下半主色」，视觉上就是“一半有颜色一半没颜色”。现改为 `linear-gradient(180deg, var(--primary) 0%, var(--primary) 55%, var(--primary-2) 100%)`，整字都是主色、只是上亮下深一点，仍无框无底。`utils/format.js` 的 `desc` 同步改成「整字主色、上亮下深，无框无底像荧光笔」。**注意**：`pages/quick/quick.wxss`、`pages/settings/settings.wxss` 里 `.q-shell-neon .q-plain-num { color: var(--clk-ink) }` 是无效覆盖（clocks.wxss 用 `!important` + text-fill 透明），改皮肤颜色只改 `styles/clocks.wxss`。
- **工具页「训练」要回真正的首页**：`tools.js openHome()` 先置 `getApp().globalData.homeResetView = 'config'` 再 `switchTab('/pages/index/index')`（失败兜底 `reLaunch`）；`index.onShow` 开头消费该标记：清掉 `exam-timer-pending-report`，若 `view !== 'config'` 就 `setData({view:'config', reportOrigin:''}, refreshConfig)`。这样首页停在计时中 / 报告视图时也会回到训练配置页。

## 8. `LifeCycle.load fail: Cannot set a non-pending waiting value` 的规避口径（2026-11）

- **触发条件**：在页面/组件的 load 生命周期还没落地时执行 `setData`，或导航没结束时再叠一次导航（`switchTab` 的 fail 里再 `reLaunch`）。基础库 3.x（尤其灰度版 3.18.0）会直接抛这条 appServiceSDKScriptError，看起来像“页面加载失败”。
- **已落地的三条硬规矩**：
  1. 任何 `switchTab` / `navigateTo` 的 fail 回调只允许 `wx.showToast`，**禁止在 fail 里再发一次 `reLaunch/redirectTo`**；并且发导航前先判断 `this.currentRoute() === 'pages/index/index'`，已经在家就不发。
  2. 组件 `attached` 里注册 `wx.onWindowResize` 必须 `setTimeout(…, 600)` 延后，回调里先判 `this._destroyed`；`detached` 清 timer 且只在真正注册成功（`_winResizeListening`）时才 `offWindowResize`。
  3. 页面 `onShow` 里切视图（如从报告/计时中回到 `config`）只用裸 `setData`，随后用 `wx.nextTick` / `setTimeout` 再跑 `refreshConfig` 这类带 `createSelectorQuery` 的测量，**不要在 setData 的回调里直接跑查询**。

## 9. 顶部胶囊条已删除（2026-11 定案）

- 首页「快捷功能条」（`.feature-strip`：训练计时 / 秒表 / 计时器 / 番茄钟 / 待办 / 重要日子 / 打卡 / 全部功能 › + “点进页面·长按固定到首页”）**整体删除**：`index.wxml` 那段 `scroll-view` 去掉，`index.wxss` 里 `.feature-strip / .feature-strip-inner / .feature-chip / .feature-chip.pinned / .feature-chip.ghost / .feature-hint`（含 `.desk` 变体）一并清掉；`index.js` 删掉 `featureChips` 数据与 `pinFeature / pinHomeTimer / openFeature / goPageTools` 四个方法。
- **首页显示的唯一入口 = 悬浮球 `brand-dock` 的「首页显示」二级菜单**，`applyPinnedFeature` 保留（悬浮球在首页时直接调用它）。首页固定面板的副标题改成「在悬浮球「首页显示」里切换」。
- 悬浮球 `switchFeature` 只接受 `timer / quick-stopwatch / quick-countdown / quick-pomodoro` 四项；`todo / important / stats` 标了 `soon: true`（`.dock-switch-chip.soon` 虚线 + 降透明度），点了只提示“这一项还不能固定到首页”，不会把不存在的 key 写进设置。

## 10. 荧光划线改为「马克笔荧光条」（2026-11）

- 起因：荧光划线（neon）此前是 `background-clip:text` + 主色纵向渐变，和「渐变流光」都是“蓝色渐变字”，两个皮肤几乎分不出。
- 现在 neon 是**深墨数字压在一条荧光色横条上**：数字 `color / -webkit-text-fill-color: var(--ink)`，横条用 `background-image: linear-gradient(180deg, transparent 0 26%, var(--primary) 26% 92%, transparent 92% 100%)` 画在**文字自身的盒子上**（不再 `background-clip:text`，改 `border-box`），所以条的高度永远等于字号、跟着字号缩放，计时页/快捷页/设置页预览三处一致；`background-size: 106% 100% + no-repeat + center` 让色条左右各溢出 3%，像马克笔扫过。
- 外壳仍是 `background: transparent; border: 0; border-radius: 0; box-shadow: none`（无外边框）。毫秒位 `.q-ms-inline` 同一套条，`.q-ms-dot` 保持主色。
- 踩坑：`background-clip: border-box` 在 `styles/clocks.wxss` 里有 8 处，**批量插入 `background-size/position` 会误伤另外 6 个皮肤**；必须按“渐变行 + 两行 clip”整段精确替换。

## 11. 铃声「气泡」换成「钟琴」（2026-11）

- 用户嫌「气泡」难听，改为自制的**两段钟琴音**：`assets/audio/ring-glocken.m4a`（1.55s、单声道 AAC、11KB），E5(659Hz) 起手 + B5(988Hz) 在 0.17s 跟进，每个音带 5 个泛音、各自指数衰减，`tanh` 软饱和 + 一阶低通柔化，起音 8ms 淡入、结尾 220ms 淡出。
- `app.js` 的 `RINGS` 只改第 2 项：`key` 仍是 `bell`（**不动 key，避免老用户已存的 ring 选择失效**），`name: '钟琴'`，`src: '/assets/audio/ring-glocken.m4a'`；顶部注释同步为“叮咚 / 钟琴 / 风铃 / 木琴 / 轻铃”。旧的 `ring-bubble.m4a` 保留未删，只是不再被引用。
- 合成方法备忘：本机没有 ffmpeg，用 `python3` 标准库 `wave` 写 44.1k WAV，再 `afconvert -f m4af -d aac -b 48000 in.wav out.m4a`（`-s 22050` 会报 `Couldn't set audio converter property ('!dat')`，别带）。改完用 `afconvert -f WAVE -d LEI16` 回读 + 逐 100ms RMS 检查包络，确认无削波、结尾归零。

## 12. 翻页钟「突然变小」与快捷页按钮不贴底的根因（2026-11）

- **翻页钟只有 rpx、没有桌面 px 档**：`components/flip-clock/index.wxss` 里 `.fc-card` 是 96rpx×168rpx，宽窗口下 rpx 按 `winW/750` 放大（1700px 窗口 ≈ 2.27 倍 → 牌面 218×381px），计时页 `--clk-fit` 立刻把它压到下限（0.55），看起来就是“切到翻页时钟后突然变小”。修法：组件末尾补 `@media (min-width: 700px)` 的 px 档（`.fc-card 64×108`、`.fc-num 46px/108`、毫秒牌同尺寸、`.fc-with-ms` 56×100），与 `CLOCK_BASE.flip {452,108}` 对齐，六张牌 + 冒号刚好 ≈452。**改翻页钟尺寸只能改组件自己的 wxss，页面里的 `.flip-card` 是另一套旧实现，改了不生效。**
- **快捷页按钮不是“没写 fixed”，而是 fixed 失效**：`.quick-actions` 原本挂在 `.quick-body` 里，而 `.quick-body` 带 `animation: app-rise-in`（transform），**transform 会把 position:fixed 的参照系变成这个滚动容器**，于是按钮跟着内容滚、停在半截。修法：把 `<view class="quick-actions">` 从 `.quick-body` 里挪出来，成为 `.quick-page`（flex column）的尾项页脚，`position: static` + 自身 `padding-bottom: calc(env(safe-area-inset-bottom) + 14rpx)`；`.quick-body` 的底部 padding 同时收回（原来用 `padding-bottom: 168rpx !important` 给 fixed 让位，已删）。页面和 `components/quick-panel` 两份 WXML 都要改，内嵌态 `.qp-embed .quick-actions` 补 `padding: 0; margin-top: 14rpx`。
- 通用判据：**只要祖先带 transform / filter / perspective / will-change，里面所有 fixed 都不再是相对屏幕**，想要底部常驻就做成 flex 页脚，不要靠 fixed。

## 13. 代码质量「图片和音频资源 > 200K」治理 + 删除功能说明文案（2026-11）

- **体检口径**：开发者工具「代码质量」把 `assets` 下所有图片 + 音频合计算一个额度（200K）。治理前 图片 122K + 音频 117K ≈ 239K，直接红。
- **删掉 6 个已不再引用的旧铃声**：`ring-bell / ring-chime / ring-clear / ring-drop / ring-marimba / ring-bubble`（RINGS 改成新 5 款后就没引用了，静态扫描 0 引用）。备份在 `/tmp/timer-audio-backup/`，其中前 5 个在 git 里可 `git checkout --` 恢复，`ring-bubble` 是未跟踪文件，只能靠这份备份。
- **PNG 量化**：用 PIL `quantize(colors=N, method=Image.FASTOCTREE)` 保留 alpha，再 `save(optimize=True)`；按 PSNR 选档（logo/logo-mark 256 色 38dB，app icon 96 色 41dB，激励图标与 tabbar 64 色 43–66dB）。结果：logo 33→8K、logo-mark 23→6K、logo-app-icon 29→6K、激励 20→4K、tabbar 12→4K；**图片 122K→34K，音频 117K→54K，合计 88K**。改完必须 Read 一眼 PNG，确认没有可见色带/毛边。
- `afconvert` 直接把 m4a 转 m4a 会报 `Couldn't set audio converter property ('!dat')`，要先用 `-f WAVE -d LEI16` 解码成 wav 再编码；`-b 16000` 对 0.03s 的滴答声也会报同样的错，短音频别再压。
- **首页固定面板不再带功能说明**：`pinned-head` 里的「在悬浮球「首页显示」里切换」整句删掉，只留标题（秒表 / 计时器 / 番茄钟）；`.pinned-hint` 样式与 `.desk .pinned-hint` 一并清掉，`.pinned-head` 去掉 `justify-content: space-between` 与 `gap`。**UI 里不再写「怎么操作」的解释性文案**，交互靠控件本身表达。

## 14. 三个“没创意”皮肤下线，换手绘 / 果冻三件套（2026-11）

- **下线**：`gradient` 渐变流光、`neon` 荧光划线（马克笔条也判“和渐变流光太像”）、`minimal` 细体留白。`CLOCK_STYLES` 从 8 项换成：`flip / blocks / sticker / outline / jelly / doodle / stamp / jellypop`。
- **新三样**（全部写进 `styles/clocks.wxss` 末尾，外壳 `background:transparent / border:0 / border-radius:0 / box-shadow:none` 且 `!important`，**绝不留外框**）：
  - `doodle` 手绘涂鸦：墨色字 + `-webkit-text-stroke:2rpx var(--primary)` 铅笔边 + 双色硬投影（`--primary-2` 右下 / `--primary` 左上）+ 楷体族 + 整排 `rotate(-1.6deg)`。
  - `stamp` 手绘印章：墨色实字 + `4rpx --primary-2` 粗描边 + `6rpx 7rpx --primary` 硬投影 + `rotate(2.2deg)`（与涂鸦反向，两个并排能看出差别）。
  - `jellypop` 果冻弹跳：`168deg` 主色→奶白高光带→主色→`--primary-2` 的 `background-clip:text` 渐变 + `--edge` 细描边 + `@keyframes clk-jellypop`（2.8s 轻微 squish，`transform-origin: 50% 100%`）。
- **四套外壳选择器必须都写**：`.timer-page.clock-<key>` / `.quick-page .q-clock-shell.q-shell-<key>` / `.settings-page .clock-preview .clock-preview-card.q-shell-<key>` / `.settings-page .clock-style-card .clock-style-sample.q-shell-<key>`。`components/quick-panel` 根节点本身带 `quick-page` 类，所以 `.quick-page .q-clock-shell…` 在组件里同样命中，不用另写一套。
- **设置页预览卡是深色底（`--panel`）**：三新样默认的墨色字直接压上去会看不见，必须再加 3 条 `.clock-preview-card.q-shell-* .q-plain-num` 覆盖，改用 `--on-panel` 填充 + `--on-panel-warm` 描边；列表小样 `.clock-style-sample` 是浅色 `--cream-1`，仍用墨色。
- **旧 key 迁移**：`utils/format.js` 加 `LEGACY_CLOCK_STYLE = { digital:'doodle', gradient:'jellypop', neon:'doodle', minimal:'outline', led:'sticker' }` + `resolveClockStyle(key)`；timer / quick / settings 三处读存储都走 `resolveClockStyle`，老用户存过的已删皮肤不会落到 `CLOCK_STYLES[0]` 而是迁移到对应新皮肤。`timer.js` 的 `CLOCK_BASE` / `IMMERSIVE_CLOCK_SCALE` 同步换成新键（`doodle {486,126}`、`stamp {500,130}`、`jellypop {481,124}`）。
- 摘除旧规则时按“marker 段落”整段切，**别按关键字逐行删**：`gradient/neon/minimal` 在共享块、FINAL 段、桌面档、毫秒块里各有副本，逐行删必然留下半个花括号。

## 15. 毫秒数字抖动：等宽 + 定宽（2026-11）

- 现象：秒表毫秒 1→2 位数变化时整行左右跳、数字自身也在“抖”。
- 根因：数字用 `Courier New / Menlo` 之类**非等宽**字体族，且毫秒 span 宽度随位数变化，父级 `justify-content:center` 每帧重排。
- 修法（三处一起改，缺一处仍会抖）：`.meta-ms` 补 `min-width:4.2ch; text-align:right; font-variant-numeric:tabular-nums; font-feature-settings:"tnum"`（compact 档同步）；`.q-clock-ms` 补 `min-width:3.6ch`；`.q-ms-inline` 改 `display:inline-block; min-width:2.1ch; text-align:center; letter-spacing:0`。`ch` 单位按当前字体算，比写死 px 稳。

## 16. 组件 wxss 里的标签选择器告警 / 悬浮球文案（2026-11）

- 日志 `./pages/timer/timer.wxss:1501:47 · Some selectors are not allowed in component wxss` 的真凶是 `.clock-stage flip-clock` 这类**元素选择器**（`flip-clock` 是自定义组件标签，页面 wxss 里不能这么写）。修法：给组件加类 `class="clock-body clock-flip-host"`，选择器统一改成 `.clock-stage .clock-flip-host`（4 处：compact / immersive / immersive 的 `.clock-slot` / wide）。
- 悬浮球二级菜单里**不再放解释性文案**：`.dock-tip`（“长按 logo 开始 / 暂停计时”）整块删掉，`soon` 项点击的 toast 从“这一项还不能固定到首页”缩成“暂不支持”。

## 17. 时钟改成「固定容器 + 统一缩放」，取代按皮肤各写一套尺寸（2026-11）

- 症状：大屏翻页钟小得像巴掌；切皮肤时整页上下跳；翻页钟长大到压住进度条。
- 根因有三层，叠在一起：
  1. 横屏分支的 WXML **没有 `.clock-slot`**，`fitClock` 的 `slot` 为 null，退化成 `(main.height - 其他)/clock.height` 这种受上下文影响的算法，每个皮肤算出来的倍率都不一样。
  2. `--ts` 按皮肤各写一套（翻页牌 72×122、积木 74×100、LED 68×116、数字 96px…），再乘 `CLOCK_BASE` 算出的倍率，`--ts` 一变，进度条 / TARGET / CONTROLS 的 `max-width` 也跟着变 → 换皮肤整页重排。
  3. 翻页组件内部还有 `transform: scale(--fc-scale)`，**transform 不改布局**，牌面视觉上长大到 3~4 倍，布局高度仍是原位 → 直接盖住下面的进度条。
- 现在的口径（重要，后续改尺寸先读这段）：
  - 时钟外面永远有一层 `.clock-slot`，横竖屏都有（横屏分支 WXML 也要包，别只包竖屏）。
  - `.clock-slot` 的尺寸**只跟窗口有关**：`timer.js` 的 `computeSlotSize()` 算出 `--slot-w / --slot-h` 写到根节点。竖屏 `0.94w × min(0.30w, 0.24h)`，≥900 横屏 `min(0.86w,1180) × min(0.38h,400)`，手机横屏 `min(0.96w,780) × min(0.40h,230)`。
  - 皮肤只负责「等比缩进容器」：`fitClock()` 用 `slot` 与 `.clock-body` 的原始矩形算 `--clk-fit = min(availW/w, availH/h)`，夹在 0.2~3.2（**允许放大**，大屏不再浪费空间），CSS 用 `zoom` 应用。容器尺寸不变 → 换皮肤时容器、模块名、进度条、按钮全都不动。
  - 删掉了：`.timer-page.compact … { height:137px; transform: scale(1.15) }`、wide 下 `--ts` 的翻页/积木/LED/数字尺寸、`--fc-scale`。`--ts` 现在恒为 1，外围宽度改用 `--cs`；进度条 / TARGET 的 `max-width` 用 `var(--slot-w)` 与时钟同宽。
  - 全屏（immersive）例外：`.clock-body { zoom:1 }`，`.clock-slot { width/height:100% }`，倍率仍由 `--ic` + `.clock-stage` 的 transform 负责。
- 判据：**任何「视觉放大」都不能用 transform 做布局之外的放大**——transform 不占位，必然和下面的进度条/按钮重叠；要放大又影响周围，只能用 `zoom`，或者干脆给固定容器按比例算尺寸。

## 18. 「训练」入口改成直接起一局进计时页；首页可固定待办/重要日子/打卡（2026-11）

- **工具页「训练」不能再跳首页**：首页现在会被固定成秒表/待办/打卡等任意视图，`homeResetView` 那套「回首页配置」已经不成立。`pages/tools/tools.js` 的 `openHome()` 改成：读 `app.globalData.templateKey`（支持 `{currentName, templates}` / 数组 / 单模板三种老结构）→ 取当前模板的模块（`targetMinutes>0`）→ 照首页 `beginTraining` 的口径写 `exam-timer-storage`（modules/firstIndex/startedAt/mode/totalTargetSeconds/tickSound）→ `navigateTo('/pages/blank/blank?mode=enter')` 走中转进横屏计时页。**没有模块时只 toast「先到首页添加训练模块」，不要偷偷跳首页。**
- 悬浮球「首页显示」七项全部可用：`timer / quick-stopwatch / quick-countdown / quick-pomodoro / todo / important / stats`，`brand-dock` 里的 `soon:true` 全部去掉，白名单同步加三项。
- 首页 `pages/index/index.wxml` 的计时配置块条件从 `{{!pinnedQuickTab}}` 改成 **`{{pinnedFeature === 'timer'}}`**（否则固定待办时会把整套训练配置也渲染出来）。前面依次是：快捷面板（`pinnedQuickTab`）→ 待办面板 → 重要日子面板 → 打卡面板 → 训练配置。
- 三个面板都读真实数据，不另建页面：待办 `app.globalData.todoKey`（未完成按 `dueAt` 升序取前 4，点一下写回 done；右上角 `›` 进 `/pages/todo/todo`）；重要日子用首页已有的 `homeImportantPreview`（点行直接开首页的重要日子编辑弹窗）；打卡用 **`app.dailyStats()`**（今日分钟 / 连续天数 / 本周分钟 / 累计天数 + 今日进度条），`›` 进 `/pages/stats/stats?tab=overview`。
- `loadHomeConfig()` 末尾调 `refreshPinnedData(pinned)`；`applyPinnedFeature()` 里也调一次（悬浮球切换立刻出数据）。样式在 `pages/index/index.wxss` 的 `.pinned-board / .pinned-row / .pinned-stats` 一组，含 `.desk` px 档。

## 19. 时钟尺寸的唯一口径收进 utils/clock-layout.js（2026-11）

- **分工**：外观（颜色/描边/投影/果冻渐变）只在 `styles/clocks.wxss`；尺寸（容器多大、皮肤缩到多少）只在 `utils/clock-layout.js`。页面 wxss 不再写 `--ts` / `--fc-scale` / 各皮肤的 width/height 倍数。
- `utils/clock-layout.js` 导出：`CLOCK_BASE`（8 皮肤原始占位）、`computeSlotSize(winW,winH,isPortrait)`（计时页容器：竖屏 0.94w×min(0.30w,0.24h)、≥900 横屏 0.74w×min(0.38h,400)、手机横屏 0.72w×min(0.40h,230)）、`computeQuickSlot(winW,winH,isDesktop)`（快捷页只给固定高度，宽度交给卡片实测，避免「时钟变大→卡片变高→再变大」的死循环）、`fitScale(w,h,natW,natH,{min,max})`。
- 计时页 `.clock-slot`、快捷页/内嵌面板 `.q-clock-slot` 都是**固定尺寸容器**；皮肤用 `zoom: --clk-fit / --q-fit` 等比缩进容器。zoom 改布局尺寸，所以容器外的模块名、进度条、按钮永远不动。
- **切皮肤屏闪的真正原因**：新皮肤先按旧倍率渲染一帧，再 setData 成新倍率。修法：`fitClock` 把每次量到的原始尺寸存进 `this.clockNatural[style|portrait|compact|wide]`，`cycleClockStyle` 直接用缓存算好 `--clk-fit`，和 `clockStyle` **同一帧 setData**；窗口变化时清缓存。`fitClock` 本身也不再「先归 1 再量」（那会闪），改成 `rect / 当前倍率` 反算原始尺寸。
- 快捷页同款：`.q-clock-slot` 高度由 `clockSlotH` 内联写死，`fitQuickClock` 用 `stage/slot` 实测宽度 + 固定高度算 `--q-fit`；旧的 `clockBoxStyle = transform: scale(k)` 已废（transform 不占位，会和大字号皮肤互相打架）。
- 设置页的两种缩略图（`.clock-style-sample` / `.clock-preview-card`）仍是特殊档：尺寸写死在 settings.wxss，只做观感预览，不参与自适应；改皮肤外观时靠 `styles/clocks.wxss` 的四套壳选择器兜底。

## 20. 记录页卡片/按钮被顶出屏幕：小程序 button 的默认宽度

- 现象：桌面窄窗口下，记录卡三个按钮（再试一次 / 删除 / 查看报告）整体向右溢出，第三颗被屏幕边缘切掉，卡片看起来像「穿到外面」。
- 根因：原生 `button` 带默认宽度（约 184px）。`.desk .history-*` 原本写 `flex: 0 0 auto`，等于把 184px 当基准且禁止收缩，三颗 184px 加间距超过卡片内宽，就横向顶出去。跟卡片 padding、滚动区宽度都无关。
- 修法：三颗按钮一律 `width: auto !important; min-width: 0 !important; flex: 0 1 auto; max-width: 100%; box-sizing: border-box;`（计时页 `.next-button` 早就这么写过，是同一条经验）；`.history-actions` 加 `flex-wrap: wrap`，放不下自动换行而不是溢出；桌面档整行 `justify-content: flex-end`，报告按钮去掉 `margin-left:auto` 防换行后跑位。
- 兜底：`.history-page` / `.history-body` 加 `overflow-x: hidden`，`.history-card` 加 `width:100%; box-sizing:border-box; min-width:0`。
- 通用结论：凡是在 flex 行里排原生 `button` 的，都要显式写 `width:auto !important`，否则 184px 默认宽度会把布局撑破。

## 21. 全屏时钟倍率：从「查表估算」改成「实测原始尺寸」

- 现象：全屏下只有翻页、积木大小正常，印章/手绘/果冻等文字皮肤明显偏小；非全屏四类一致。
- 根因：`computeImmersiveScale` 用 `CLOCK_BASE[style]` 估算宽度。翻页 452、积木 522 与实际渲染接近，所以看着对；文字类皮肤的基准（440–500）比真实宽度（约 200–260）大很多，算出的倍率被压小。非全屏走的是实测 `--clk-fit`，所以没有这个问题。
- 修法：全屏倍率改用 `clockNatural` 缓存（`fitClock` 量到并除以当前 zoom 的原始尺寸），`scale = min(0.94*winW/natW, 0.86*winH/natH)`，clamp [0.8, 12]；`readNaturalSize` 缓存缺失时现场量 `.clock-body`（文字皮肤的 `.clock-body` 只含主时间，不含毫秒，尺寸干净）。上限只会压低不会抬高，所以任何皮肤都不会越界。
- 附带修：`closeImmersive` 收尾时补 `scheduleFitClock()`——全屏期间 `clockFitVars` 被清空，退出后必须把普通档的 `--clk-fit` 算回来，否则退出后时钟会停在原始尺寸。
- 口径：全屏容器仍是 `98vw × 90vh` + `.clock-stage { transform: scale(--ic) }`，动画链路（clock-body morph）不变。

## 22. 大屏按钮不铺开 + 退出全屏后时钟缩水

- **按钮不铺开**：`.timer-page.wide:not(.immersive) .controls` 之前被写成 `max-width: calc(320px * var(--cs))`（约 410px），把四颗按钮锁在中间一小段。改成 `max-width: var(--slot-w, 100%)`，与进度条 / TARGET 同宽，`justify-content: space-between` 自然把按钮分到两端。
- **退出全屏后时钟变小（翻页必现）**：`fitClock` 用 `boundingClientRect` 量尺寸，而这个 API 会把 `transform` 的放大算进去。进出全屏的 morph 是 `.clock-body` 的 transform 动画，如果在动画中途量（关闭全屏后 460ms 那次重算正好落在 .44s 过渡尾部），量到的「原始尺寸」被放大了约 `--ic` 倍，写进 `clockNatural` 缓存，算出的 `--clk-fit` 只剩 1 左右 → 时钟比正常小一大截，而且缓存会一直错下去。
- 修法三条：
  1. `fitClock` 增加 `isClockMorphing()` 门闩（`clockMorph / clockMorphStyle` 为真，或距 `clockMorphAt` 不足 520ms 都算过渡中），过渡中不量，改成延后重试；每次写 `clockMorphStyle` 的地方都记 `this.clockMorphAt`。
  2. 全屏时 `fitClock` 直接 return，**不再清空 `--clk-fit`**；全屏期间 zoom 由 `.timer-page.immersive .clock-body { zoom: 1 }` 覆盖，普通档的倍率保留下来。
  3. 退出全屏走三段交接：先进普通布局并保持 transform 撑在全屏倍率（zoom 清空）→ 用 transform 平滑收到 `exitFit`（缓存算的普通档倍率）→ 同一帧把 transform 换成 zoom，视觉尺寸不变所以不跳。缓存缺失时才退回「退出后再量」。

## 23. 描边空心（outline）在计时页偏小：透明内距被算进了原始尺寸

- 计时页所有皮肤统一走「固定容器 + 实测原始尺寸 + fitScale」，所以**会随屏幕自适应**：容器由窗口算（`computeSlotSize`），换窗口会重算 `--clk-fit`。
- outline 偏小的真正原因：`.timer-page.compact .clock-outline .plain-clock { padding: 12px 34px }` 是**看不见的内距**，但 `boundingClientRect` 把它算进原始宽高（356×120），再叠加 `fitScale` 的 `max: 3.2` 上限，结果轮廓字只占容器宽度的约 78%，看起来比翻页/积木小一圈。
- 修法：计时页里 `.timer-page.clock-outline .plain-clock { padding: 0 !important }`（它本来就没有外壳，内距纯属浪费）；`fitScale` 的 max 从 3.2 抬到 4.2（上限只做“压低”不做“抬高”，放宽不会越界，只让窄一些的文字皮肤真正铺满宽度）。三处调用（fitClock / cycleClockStyle 缓存 / closeImmersive 的 exitFit）同步。
- 结论口径：文字类皮肤（stamp/doodle/jellypop）如果还有内距，同样会显得小；要更大就去查各自的 `.plain-clock` padding。

## 24. 计时页三颗圆钮在手机上偏小：矮窗口档把它们压到了 44px

- 现象：手机横屏（高 375–430）下 ◀ / Ⅱ / ✓ 明显比「下一模块」小一圈。
- 根因：`@media (max-height: 430px)` 里把三颗圆钮压到 `44px`，而 `.next-button` 仍走 compact 的 64px，所以看起来「只有下一模块正常」。
- 新尺寸（next 不动）：矮窗口 58px（字 27 / prev 24 / complete 29）、普通 compact 70px（31 / 27 / 33）、竖屏 62px（27 / 23 / 30）、宽屏 `calc(64px * var(--cs))`、基础 rpx 档 64rpx。`.controls` 是 `align-items: center`，圆钮比胶囊高一点只会上下居中，不会错位。

## 25. 工具页「训练」不该依赖首页固定

- 旧实现：`pages/tools/tools.js` 自己读 `exam-timer-template`，没有模板就 toast「先到首页添加训练模块」，于是用户感觉「必须把计时训练固定到首页才能用」。
- 现在：`app.js` 提供 `getTrainingModules()`（先 `normalizeTemplates()`，兼容 `{currentName,templates}` / 老模块数组 / 单模板；过滤 `targetMinutes>0`；空则回落 `DEFAULT_TRAINING_MODULES` 六项）。工具页只调它，写 `exam-timer-mode` + `exam-timer-storage` 后 `navigateTo('/pages/blank/blank?mode=enter')` → 计时页。
- 结论：训练入口与首页固定项、首页是否打开过全部解耦；以后任何新入口起训练都走 `app.getTrainingModules()`，不要再各自解析模板。

## 26. 训练入口的最终形态：独立「训练计时」页（覆盖第 25 节）

- 用户要的不是点一下直接开跑，也不是回首页：要一个能选模块的训练计时页，且与「首页可自定义」解耦。
- 新增 `pages/train/train.{js,wxml,wxss,json}`（已注册进 `app.json`）：目标时间 + 模块列表（改名、±5 分钟、删除、最多 8 个、添加）+ 开始计时。编辑即回写当前模板（`app.saveTrainingModules`），并打 `globalData.trainingModulesDirty`，首页 `onShow` 见到标记才刷新模块，避免冲掉首页未保存编辑。
- 起跑统一走 `app.startTrainingSession(modules)`：写 `exam-timer-mode` + `exam-timer-storage`（含 id，`wx:key="id"` 不警告），页面负责 `navigateTo('/pages/blank/blank?mode=enter')`。
- 工具页 `openHome()` 只做 `navigateTo('/pages/train/train')`，与首页固定项完全无关。
- 尺寸：手机 rpx 档；`.desk` 限宽 620px 居中并全部换 px（顶栏隐藏时补 `.train-desk-head` 返回条），不随 rpx 放大。

## 27. 首页固定面板 v2（待办/重要日子/打卡）

- 待办：一条一张卡（`.pinned-todo-chip`），描边 + 硬阴影 + 圆角，参考训练模块卡；截止日是右侧胶囊。
- 重要日子：`.pinned-imp-grid` 两列（`repeat(2,minmax(0,1fr))`），日历式卡片：大号日 + 月份 + 周几 + 倒计时；今天/临近/已过三种态。`decorateImportant` 补 `dayNum/monthText/weekText`。
- 打卡：`.pinned-poster` 海报式面板（完成度大号 %、今日/目标、进度条、三枚指标、`dailyStats().calendar` 月历热力格）；数据全部来自 `app.dailyStats()`，不另生成 canvas 海报。
- 自适应：`.desk` 全量 px 档，两列卡限宽不摊开；面板仍在 `.page-content` 内，不新增横向滚动。

## 28. 快捷计时页时间位数：不足 1 小时「分:秒.毫秒」，满 1 小时「时:分:秒」

- 口径（2026-11 定案）：任何状态下都保持三段数字，不允许只剩 `00:00` 两段。
  - `hours === 0`：主时间 `MM:SS` + 毫秒 `CC`（始终显示，默认即 `00:00.00`）；
  - `hours > 0`：主时间 `HH:MM:SS`，毫秒 `msShow=false` 收起。
- 实现：`formatStopwatch` / `formatCountdown` / `formatTimerParts` 统一按 `hours > 0` 分支；`setStopwatch` 的 `showMs` 去掉 `ms > 0` 条件（否则默认 0 毫秒又退回两段）；初始 `mainText='00:00'`、归零文案 `buildClockPayload('00:00', undefined, '00')`。
- 两边同步：`pages/quick/quick.js` 与 `components/quick-panel/index.js` 必须一起改，否则首页固定面板和独立页时间形态会不一致。
- `noteClockShape` 以 `主时间位数:是否带毫秒` 为 key：不足 1 小时恒为 `5:1`，默认 / 开始 / 暂停 / 重置都不重算；跨过 1 小时才变 `8:0`，允许这一处一次性重排。

## 29. 报告页能力图分差与模块分数位置

- 分差口径：`分差 = 该模块实得分 − 该模块满分 × 目标档%`，统一由 `result.js` 顶部 `moduleDiff(item, target)` 计算并保留一位小数；绘制轴尾和底部「优先补 / 拉分最多」共用同一函数，切 60 / 70 / 80 会实时重算，不存在写死数组。
- 数据来源：`fillModulePoints` 不再直接信任记录里的 `got`，凡逐题分值可读就按 `(模块实得/有答案分值) × 模块满分` 重算，与 `score.js` 同口径；`pointTotal` 记录「有答案题的原始分值」，老记录/缺答案时才回退存值。
- 模块分数位置：`mod-head` 改为「模块名 → 分数 → 箭头」一行，`mod-name` 用 `flex: 0 1 auto` + 省略号，`.mod-points` 用 `flex: 0 0 auto` 紧跟名字，箭头 `margin-left: auto` 靠右；不再用 `mod-right/mod-meta` 把分数推到最右。

## 30. 「固定首页」改为链接到真实页面（2026-11 定案，覆盖第 248/258/274/302/345-346 节）

- 用户口径：固定首页不是把某个页面复制/嵌到首页，也不在首页放跳转链接；固定项只保存一个地址，首页 / 悬浮球点它就是打开对应的真实页面。
- 唯一映射表：`utils/home-pin.js` 的 `PIN_PAGES`（timer → `/pages/index/index`、quick-* → `/pages/quick/quick?tab=...`、todo / important / stats）与 `pinnedUrl / pinnedName / readPinnedFeature`；所有入口共用，禁止各页再写一份。
- 悬浮球：`components/brand-dock/index.js switchFeature` 写 `settings.pinnedFeature` 后 `reLaunch` 目标页，把它设为根页面（不是压栈跳转，返回也不会退回旧首页）；若已在目标页，quick 只调页内 `switchTab` 切 tab；`timer` 用 `switchTab` 回 `pages/index/index`。
- 底栏：`custom-tab-bar` 的「首页」在 `pinnedFeature !== 'timer'` 时 `reLaunch` 固定页（首页即该页）；否则才是原 `switchTab` 首页。
- 冷启动 / 回首页：`pages/index/index.js onShow` 末尾调 `goPinnedHome()`，非 timer 时 `reLaunch` 固定页；有未完成训练 / 待恢复报告时先让原流程处理。700ms 内重复进入只跳一次。
- 首页：删除 `<quick-panel>`、待办 / 重要日子 / 打卡 / 训练条件块，`pages/index/index.wxml` 恢复为训练配置单视图；`pages/index/index.json` 不再声明 `quick-panel`，该组件已移出项目备份。
- 禁止：再引入“首页内嵌复制面板”“首页胶囊跳转条”“新建对应页面”这三种做法。

## 31. 预设卷「自定义」改题量 / 分值（2026-11）

- 过关斩将首页每套预设卷的链接行新增「自定义」入口（自定义卷仍用「编辑」），跳 `/pages/grade/custom/custom?paperId=xxx`，复用同一张表单页，不新造页面。
- 覆盖值存 `xc_paper_overrides`（`data.js` 的 `savePaperOverride / clearPaperOverride`），只存改过的卷；`getPaper()` 统一套用，答题页题号、答题卡、交卷算分、结果页模块满分都读改后的卷面。
- 预设卷编辑页隐藏「模板」块与「删除这卷」，改为「恢复默认分值」；**预设卷无论改题量还是分值都不清草稿和标准答案**，旧数据保留即可；只有自定义卷在题量 / 顺序变化时才清。
- 首页列表用 `p.edited` 显示「已自定义」小标签；改过的卷名、题量以覆盖值为准。

## 32. 固定首页保留 dock（2026-11）

- 用户口径：悬浮球选秒表后，页面立即变成秒表内容且底部仍有「首页 / 工具 / 记录」dock；切到工具或记录后再点首页，仍回到固定页。
- 实现：`pages/quick/quick` 内嵌 `app-dock`（`/custom-tab-bar/index`）；`quick.wxml` 根节点加 `has-dock`，`quick.wxss` 给 `.quick-actions` 补 `100rpx + safe`（桌面 `52px + safe`）底部内距，按钮不被底栏压住。
- **不要把 `brand-dock` 放进 quick 页**：悬浮球在底栏上方 126rpx，会和快捷页底部操作条重叠；需要切换固定项时从工具页的悬浮球操作。
- `custom-tab-bar` 的首页键：固定项为 `quick-*` 且当前已在 quick 页时，调用页内 `switchTab` 拨回固定 tab；不在 quick 时仍 `reLaunch` 固定页。这样固定页自身也带 dock，不再出现「跳到孤立页、回不到首页」。
- 待办 / 重要日子 / 打卡仍是真实页面（非快捷页），未加 dock；若以后要求统一，按同一方式内嵌 `app-dock` 并补底部内距。
