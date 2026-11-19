# BUBBLE TIMER 交接文档

> 给下一个 AI：先读这份文件，再改代码。项目当前有大量未提交改动，不要假设 `git HEAD` 是最新状态。
> 最后一次处理：2026-11-19，首页激励最后一行已改为左对齐，但尚未在微信开发者工具/真机验收。

## 1. 项目概况

- 项目名：`计时器` / BUBBLE TIMER
- 根目录：`/Users/laiyuci/projects/计时器`
- 技术栈：微信小程序原生 WXML / WXSS / JS
- AppID：`wx94c4673cd56b09ad`
- 远程仓库：`git@github.com:laidaibai/BUBBLE-TIMER.git`
- 分支：`master`
- 当前工作区：**大量未提交改动**，包括新增主题、页面、组件、资源，不要随意 `git reset` 或覆盖。
- 项目内设计规则：`.claude/skills/paopao-timer-ui/SKILL.md`（动 UI 前建议先读）

## 2. 当前产品状态

主要页面：

- `pages/index`：首页 / 模块配置 / 训练分析报告（`rp2`、`rp3` 报告区块）
- `pages/timer`：沉浸计时、模块计时、结算动画
- `pages/quick`：秒表、倒计时、番茄钟
- `pages/settings`：主题、时钟样式、首页配置等
- `pages/tools`：工具入口
- `pages/history`：训练记录
- `pages/stats`：统计 / 打卡
- `pages/todo`：待办
- `pages/important`：重要日子
- `components/brand-dock`：左下角悬浮 logo 快捷入口
- `custom-tab-bar`：自定义底部导航

主题唯一数据源：

- `theme/palette.js`
- `app.wxss` 的 `THEME-TOKENS:START/END` 区块由 `node tools/gen-theme-wxss.js` 生成
- 当前主题顺序：`cream, tomato, rose, sky, sketch, mint, obsidian`
- 默认回退：`sky`
- 新增 `sketch` 铅笔手绘主题（暖纸底、石墨字、灰蓝铅笔色、淡黄高亮），已生成变量，但**尚未统一编译/真机验收**

## 3. 用户明确喜欢的视觉方向

- 手绘 / 涂鸦 / 铅笔线稿感
- 粗描边、胶囊标签、低阴影、低立体感
- 浅色数据面板，文字对比清楚，不要发灰
- 报告页：少文字、多信息，数据优先
- 计时页底部按钮要**均匀分散**，不要挤在一起，也不要只分到两端
- 时钟样式设置页必须显示真实组件预览，不能只回退成纯文字
- 首页激励图案：最后一行要**靠左对齐**，不要用 `space-between` 把最后一行拉伸到两端（最新修复）
- 品牌元素使用 `assets/brand/logo-mark.png`；不要再用之前的手绘小鱼
- 不要过亮塑料高光、过强 3D、过多装饰轮廓

## 4. 最近完成的关键改动

### 4.1 首页激励网格（最新问题）

涉及：

- `pages/index/index.js`
- `pages/index/index.wxml`
- `pages/index/index.wxss`

当前实现：

- `TOMATO_COLUMNS = 8`
- `TOMATO_GRID_LIMIT = 28`
- `loadTomatoes()` 把 `tomatoIcons` 按 8 个切成 `incentiveRows`，每行对象为 `{ key, items }`
- WXML 使用两层循环：`.tomato-grid > .tomato-row > .tomato`
- 每个 icon 有 `delay`，不再在 WXML 里用 `index * 24` 计算
- `.tomato-grid` 是 `display: block`，`.tomato-row` 强制 `display:flex; flex-direction:row; flex-wrap:nowrap`
- `.tomato-row` 完整行使用 `justify-content: space-between`
- `.tomato-row.last` 使用 `justify-content: flex-start; column-gap:8rpx`
  - 这就是最新修复：最后一行不足 8 个时靠左，不再被拉伸到两端
- 单图标行 `.tomato-row.single` 居中

**重要坑点**：之前直接给 `.tomato-grid` 设置 `justify-content: space-between` 或 `flex-direction: column`，在微信 WXSS 里会出现整块激励变成竖列 / 最后一行位置异常。现在的稳妥方案是：

1. 外层只做 `display:block`；
2. 每行独立 `display:flex; flex-direction:row; flex-wrap:nowrap`；
3. 最后一行单独用 `.last` 覆盖对齐方式。

不要再改回扁平 flex-wrap 自动换行。

### 4.2 悬浮 logo（brand-dock）

涉及：

- `components/brand-dock/index.wxml`
- `components/brand-dock/index.js`
- `components/brand-dock/index.wxss`
- `pages/index/index.wxml`
- `pages/quick/quick.js`
- 其他带 `brand-dock` 的页面 WXML/JS

已实现：

- 收起态：logo 默认 `translateX(-33rpx)`，只在左下角露出半个，减少遮挡
- 展开态：显示「今日 X 分钟 · X%」摘要 + 三个上下文动作
- 动作：
  - 继续上次训练：读 `exam-timer-records[0]`，把 rows 转成 `exam-timer-pending-modules`，`wx.reLaunch` 回首页，首页 onShow 会恢复模块
  - 开始 / 暂停计时：根据 `exam-timer-quick-state` 的 `running` 决定 `autostart=1` 或 `dockpause=1`
  - 今日待办：跳 `pages/todo/todo`，子文案显示未完成数量
- 进度环：logo 外圈用 `conic-gradient` 显示 `app.dailyStats().todayPercent`，内圈有遮罩和描边
- 长按 logo：不展开菜单，直接进入 quick 并开始 / 暂停；短按才展开
- 半隐：首页 `onConfigScroll`、其他页面 `onPageScroll` 在 `scrollTop > 48` 时给 `dim`，报告页也 `dim`
- 完成反馈：`pages/index/index.js` 的 `showReport()` 调用 `selectComponent('#brandDock').celebrate()`，触发一次擦亮 + 收拢动画，同时刷新今日进度

**注意**：

- `brand-dock` 组件不在 `pages/timer`，所以沉浸计时页不会出现这个 logo；这是符合“避免遮挡”的现状。
- 长按后 `longPressTriggered` 会阻止一次 tap，并用 700ms 定时器复位。
- `quick` 的 `restoreQuickState()` 会把 `running` 置为 false；`dockpause=1` 只负责把页面呈现为暂停，不等于恢复后台计时。后续若要真正后台运行，需要单独检查 quick 状态恢复逻辑。
- `conic-gradient` 在部分旧基础库可能不生效；如果真机环不显示，改用 Canvas 圆环或分段 border。

### 4.3 设置页时钟预览

涉及：

- `pages/settings/settings.wxml`
- `pages/settings/settings.wxss`

已修复：

- 积木方块样式此前只渲染纯文字，现在主预览和样式列表小卡都会渲染 `clock-block-row` / `clock-block-tile`
- 圆体极简此前靠左，现在：
  - `.clock-preview-card` 使用 flex 居中
  - `.q-plain-num` 设置 `text-align:center`
  - `.q-shell-minimal`、sample、preview 都补 `box-sizing:border-box`
  - 极简数字宽 100% 居中
- 仍需要重新编译确认所有 7 个时钟样式（翻页、数字、积木、LED、霓虹、描边、圆体极简、果冻叠影）在设置页和计时页一致

### 4.4 训练分析报告

涉及：

- `pages/index/index.js`：`prepareReport`、`showReport`、`animateReportNumbers`、`goHomeView`、`backToConfig`、`onBackPress`
- `pages/index/index.wxml`：`rp3-*`
- `pages/index/index.wxss`：报告 v5 区块

当前状态：

- 返回键已改为 `bindtap="goHomeView"`，报告页会清 `exam-timer-pending-report` 后回首页，避免回首页又被 onShow 拉回报告
- 报告背景改为浅色奶油渐变，汇总卡/胶囊降低阴影
- 报告数字动画时长 760ms
- 报告底部使用 `assets/brand/logo-mark.png`，不再使用手绘小鱼
- 报告自动退出计时器为 15s（`scheduleReportAutoExit`）
- 报告显示时 brand-dock 进入 `dim`，同时触发 `celebrate`
- 仍有未验收项：安卓实体返回键、报告返回热区、报告动画、不同机型布局

### 4.5 主题系统

- 主题唯一来源：`theme/palette.js`
- 生成脚本：`tools/gen-theme-wxss.js`
- 不要直接手改 `app.wxss` 的 `THEME-TOKENS`；改 `palette.js` 后重新生成
- `sketch` 主题已经有纸面颗粒、手绘卡片边框、按钮排线、横线输入框等全局覆盖，但未统一验收

### 4.6 计时页全屏动画（最新，2026-11-19 重写）

涉及：

- `pages/timer/timer.js`：`toggleImmersive()`、`measureImmersiveShift()`、`openImmersive()`、`closeImmersive()`、`IMMERSIVE_CLOCK_SCALE`、`OUTRO_DELAY`、`MORPH_GAP`
- `pages/timer/timer.wxml`：四种时钟容器统一加 `clock-body` class + `style="{{clockMorphStyle}}"`；根节点 `clock-morphing`
- `pages/timer/timer.wxss`：文件末尾 `clock-body` 的 transform 过渡 + `--immersive-clock-scale`；`immersive-leaving` / `immersive-anim` 只负责外围组件进出

当前逻辑（关键：**全屏时不再改字号/尺寸，只做 transform**）：

- 进全屏：先 `wx.createSelectorQuery()` 量出「时钟中心 → 页面中心」的位移 `dx/dy`（`measureImmersiveShift`）；外围组件 0.16s 淡出（180ms）；然后切沉浸布局，同时给时钟上 inline `translate3d(dx,dy,0) scale(1)` —— 这一帧画面与切换前完全重合；36ms 后清掉 inline 与 `clock-morphing`，过渡放开，时钟沿同一段 transform 长到 `scale(--immersive-clock-scale)` 并落到页面中心（0.44s）。
- 退全屏：先切回普通布局，inline 起点设成 `translate3d(dx,dy,0) scale(k)`（k 来自 `IMMERSIVE_CLOCK_SCALE`），与沉浸最后一帧重合；36ms 后清掉 inline，时钟平滑收回原位；外围组件用 `immersive-in-*` 关键帧从屏幕外滑回。
- 沉浸态时钟尺寸 = 普通尺寸 × 倍率（翻页 1.28 / 积木 1.32 / LED 1.12 / 数字 1.25 / 极简 1.23 / 霓虹/描边/果冻 1.26），这四个常量在 js 和 wxss 各有一份，改一处必须同步另一处。
- `clock-morphing` 期间同时 `transition: none` 掉 `module-side` 的 width 与 `timer-main` 的 padding，避免布局切换被二次补间。
- `immersiveBusy` 会在动画期间吞掉再次点击，避免两段形变互相打断。

**重要**：不要再往 `.timer-page.immersive` 里加改字号/宽高的时钟样式（如 `.timer-page.immersive .flip-card { width:88px }`），那会让切换那一帧尺寸跳变，动画又变回生硬。沉浸视觉只能靠 `--immersive-clock-scale`。

仍未真机验证：切换瞬间时钟中心是否全程连续、各时钟样式倍数是否还需要微调。

### 4.7 首页激励星星贴图（最新，2026-11-19）

涉及：

- `assets/incentive/star-filled.png` / `star-ghost.png`（256×256 透明底）
- `tools/gen-incentive-star.py`（生成脚本，可重复生成）
- `pages/index/index.wxml:35-36` 用 `incentiveType === 'star'` 的 `incentive-art` 引用贴图
- `pages/index/index.wxss` 的 `.incentive-art`（34×34rpx）与 `star-polish` 高光

当前参数：

- 五角星外形改成「胖」版：外接半径 0.44×画布、内接半径 0.205×（标准星星约 0.168×），角的圆润度外角 0.13 / 凹角 0.05，所以臂粗、角圆但五个尖仍然清楚。
- 实心星：底色 `#FFC73F` 金黄 + `#1E3448` 深蓝粗描边（58/1024），不加高光，走扁平贴纸。
- 空位星：同一条轮廓的细实线（34/1024），颜色 `#9EB6C8`；原来那版虚线在 34rpx 下会糊成一圈点，已换掉。
- 想调「肥瘦」只改脚本里 `R_IN`（越大越胖）和 `ROUND_OUT/ROUND_IN`（越大越圆），改完 `python3 tools/gen-incentive-star.py` 重新出图。

## 5. 走过的坑 / 已踩过的雷

### 5.1 布局

- `flex-wrap: wrap` + `justify-content: space-between` 在微信里很容易出现最后一行“被拉满”或“整块变竖列”。激励区现在使用「JS 拆行 + 每行独立 flex」，这是经过多轮修复后的稳定方案。
- 不要在 `.tomato-grid` 上直接写 `flex-direction: column` 再指望子行自动横排；外层只做 block。
- 设置页预览的 `q-shell-*` 是加在容器上的，不是加在数字上的；改样式时要确认 WXML 里 class 加在哪一层。
- 时钟样式列表的 sample 高度固定为 `124rpx`，加 padding/border 时必须 `box-sizing:border-box`，否则会溢出或文字偏移。
- 微信小程序的 `text` 在 flex 容器里仍受 `text-align` 影响；居中要同时保证父容器 `justify-content:center` 和文字 `text-align:center`。

### 5.2 交互 / 状态

- 报告页返回失效曾被 `catchtap` 和 pending report 残留影响；报告返回要同时清理 `exam-timer-pending-report` 和报告动画计时器。
- 从记录页返回首页时，`onShow` 可能读到 pending report 并把页面拉回报告；现在的 `goHomeView` 会主动清除。
- `quick` 的 `restoreQuickState` 会把 `running` 设为 false；不要假设从 storage 读到 `running:true` 就真的会继续计时。
- 长按必须用标志位压掉随后触发的 tap，并设置超时复位，否则下一次短按会被吞掉。
- brand-dock 的 `continueLast` 依赖 `exam-timer-pending-modules`；首页 `onShow` 只在该 key 存在时恢复模块，成功后 key 会被移除。
- `selectComponent('#brandDock')` 依赖页面 WXML 里的 `id="brandDock"`，不要删。

### 5.3 样式 / 构建

- WXSS 中 `var(--xxx)` 依赖根节点 `themeStyle` 注入；组件内使用主题变量时要确保 `themeStyle` 仍传进组件。
- `conic-gradient`、`clip-path`、`-webkit-text-stroke` 在旧基础库/不同端上可能降级；遇到真机不显示，优先用更保守的实现。
- 生成主题变量后要重新编译，否则页面仍用旧 CSS 变量。
- 工作区大量改动未提交，改动前先 `git status`；不要覆盖用户已有文件，不要 `git reset --hard`。

### 5.4 之前被用户明确否掉的方向

- 手绘小鱼：不要再用，报告/完成页使用 logo
- 过亮高光、过强 3D、塑料质感
- 报告背景有复杂轮廓、文字过浅
- 激励最后一行被拉伸到两端（最新要求：左对齐）
- 设置页时钟预览只显示纯文字
- 计时页底部按钮过度拥挤或只分两端

## 6. 当前未完成 / 下一步

1. **最高优先**：在微信开发者工具编译，确认首页激励：
   - 前三行 8 个铺满
   - 最后一行 4 个靠左
   - 不再出现竖列
2. 验收 `brand-dock`：
   - 收起半露是否自然
   - 展开菜单是否被左下角裁切
   - 进度环在真机是否显示
   - 长按开始/暂停是否正常
   - 报告页完成反馈是否可见
3. 验收设置页 7 种时钟预览，特别是积木方块和圆体极简
4. 验收 `sketch` 主题全局页面
5. 验收训练分析报告返回、自动退出、动画、logo 复盘卡
6. 如需要，再补 `brand-dock` 在 `pages/timer` 的沉浸半隐策略（当前该页面没有该组件）

## 7. 快速检查命令

```bash
cd /Users/laiyuci/projects/计时器

# JS 语法
node --check pages/index/index.js
node --check pages/quick/quick.js
node --check components/brand-dock/index.js

# 空白/补丁检查
git diff --check

# 查看当前改动
git status --short
```

没有现成的自动化测试；最终以微信开发者工具编译 + 真机预览为准。

## 8. 交接原则

- 先读本文件，再读 `.claude/skills/paopao-timer-ui/SKILL.md`。
- 改 UI 前先看现有页面实际 WXML/WXSS，不要按旧记忆重写。
- 一次只改一个视觉问题，改完让用户看截图，再继续。
- 不要主动 commit/push，用户未要求。
- 不要删除或重命名用户已有文件；不要覆盖未确认的改动。

## 9. 死样式清理（2026-11-19）

- 工具：`tools/prune-wxss.py`，`--check` 只统计不写文件。
- 判定口径：某条规则的**所有类名**在该页面 wxml/js 里都找不到（并保护 `'xxx-'` 这类动态拼接前缀），整条规则才删；选择器组里只剔除死类名，声明体一字不改。
- 本轮清掉约 170 条死规则、343 行：首页的 rp2 报告旧样式 / history / progress / important / quick-home 图标 / completion 卡片，打卡页改成海报版后废弃的 hero / level 样式，记录页旧卡片样式，tab 栏的钟表指针。
- 剩余 39 个「死类名」都在与活类名同组的复合选择器里，删除会影响活类名的那条声明，故保留。
- 首页 JS 另删了 5 个无绑定、无内部调用的方法（`changeSlider`、`openSettings`、`goTools`、`setOrientation`、`openStats`）和 3 个未使用 data 字段；打卡页删了 `savePoster` / `sharePoster`。
- **重要**：首页 WXML 里还留着一整套 `importantModalOpen` 弹窗 + `editImportant / openImportantModal / removeImportant`，但目前**没有任何入口能打开它**（重要日子已独立成 `pages/important`）。这块属于「不可达 UI」，暂未删除，动它之前先确认产品是否要恢复入口。
- 改完之后验收：`node --check` 全部 js、wxss 花括号配平、WXML 绑定与 js 方法一一对应（`bind/catch` 事件名必须在 js 里有同名方法）。

## 10. 导出画布定位（2026-11-19）

打卡页海报一直转圈、报告页「保存图片 / 分享」点了没反应的根因是同一处：两张导出用的旧版 canvas 都被推到视口外几千 rpx。

- 原样式：`.poster-canvas { left: -4000rpx }`、`.report-canvas { left: -19998rpx }`。新版基础库对画布做同层渲染后，移出视口的 canvas 可能不参与绘制，`wx.canvasToTempFilePath` 直接 fail（拿不到 canvas 或导出空白），于是海报 `posterPath` 永远为空、报告导出弹「导出失败」。
- 现在改成「留在视口内 + 透明 + 不接收点击」：`position: fixed; left: 0; top: 0; width: 750px; height: 1200px; opacity: 0; pointer-events: none; z-index: 1`。两张画布 CSS 尺寸统一按绘制坐标系 750×1200，导出 `destWidth/destHeight` 为 2 倍。
- `report-canvas` 从 `.report-page`（在 `scroll-view` 内）搬到 `view === 'report'` block 里、`</scroll-view>` 之后，避免被滚动容器裁剪，也不再常驻首页。
- 导出加了「失败重试一次（延迟 260ms）」：`stats.exportPoster()`、`index.exportReportImage()`。仍失败才提示用户，并在 console 打 `[poster]` / `[report]` 前缀的 errMsg，方便真机排查。
- 「再练一次」另做了两处加固：`report.rows` 为空时回退到 `exam-timer-records` 里最近一条记录的 rows；若 `timerLaunching` 遮罩状态没清干净，先复位再 `beginTraining`（否则 `launchTimer` 会静默 return）。

## 11. 首页清空按钮 / 拖动闪烁 / 翻页时钟（2026-11-19）

- **一键清空**：`pages/index/index.wxml` 标题行「保存」右边加了 40rpx 的红色 `×`（`.section-clear`），只在有模块时出现，点了走 `wx.showModal` 二次确认（和单个删除一致：红色 + 「清空」），成功后 `clearModules()` 把 modules 清空并复位拖动/模板选中态。
- **拖动闪一下**，三个来源一起修：
  1. `touchEnd` 里只要没真正换位（`toIndex === fromIndex && |delta| < 8`）就直接清状态、**不重建 modules 数组**——原来点一下把手也会 `setData({modules})` 导致整排卡片重排。
  2. 松手时其余卡片的 `dragStyles` 先写成 `transition: transform 0ms; translateY(0)`，下一帧（16ms）再清成 `''`，避免「布局已换位 + transform 还带 200ms 过渡」滑一段。
  3. 手势过程中所有 transform 都显式带 `transition: transform 0ms`，不再依赖 `.dragging` 类里的 `transition: transform 0ms`；抬起时不改尺寸（去掉 `scale(1.02)` 的瞬间放大），只靠阴影/底色 140ms 过渡表现「拎起来」。
- **翻页时钟不翻**：`pages/timer/timer.wxss` 里 `@keyframes flip-top-a/b、flip-bottom-a/b` 被人塞了 `filter: brightness()`，小程序里带 filter 的关键帧容易整条失效；而且关键帧被重复定义了两份（头部一份干净、600 行一份带 filter）。现在只留一份、只用 `transform: rotateX`，并把 `animation: flip-top-a 280ms ... both / flip-bottom-a 280ms ... 280ms both` 一次写全（原来 duration 与 name 分开写在两组规则里，容易被后面的规则拆散）。

## 12. 3.18 基础库日志排查（2026-11-19）

- `无效的 app.json ["convertRpxToVw"]`：app.json 根层多了个 `"convertRpxToVw": true`（不是小程序字段，应该是外部工具写进来的），已删。app.json 现在只剩 pages / window / lazyCodeLoading / style / sitemapLocation / tabBar。
- `Failed to load image .../pages/{stats,index}/assets/brand/logo-mark.png` + `no such file or directory`：`wx.getImageInfo({src:'/assets/brand/logo-mark.png'})` 在 3.18 基础库的开发者工具里被当成「相对当前页面」的路径解析，结果去找 `pages/stats/assets/...`。新增 `utils/local-image.js` 的 `resolveLocalImage()`：先按绝对路径取，失败再用 `../../assets/brand/logo-mark.png` 兜底；`stats.loadPosterLogo()` 与 `index.loadReportLogo()` 都改用它。WXML 里的 `<image src="/assets/...">` 不受影响，保持原样。
- 其余日志都是工具自身提示，不必处理：`canvas 2d … 建议切换使用`（只是建议，旧版 canvas 仍可用）、`preloaded using link preload but not used`、`reportRealtimeAction:fail not support`、`正在使用灰度中的基础库 3.18.0`。

## 13. 导出改走离屏画布（2026-11-19）

- 结论：页面里**不要**再放导出用的 `<canvas>`。旧版 canvas 是原生组件，z-index / pointer-events 都管不住它：放到视口外导不出图，放到视口内又会整块盖住页面把点击吃掉（报告页「保存图片/分享/再练一次」点了没反应就是这么来的）。
- 新增 `utils/painter.js`：`createPainter(750, 1200, 2)` 用 `wx.createOffscreenCanvas({type:'2d'})` 建 1500×2400 的离屏画布，`ctx.scale(2,2)` 后仍按 750×1200 旧坐标系绘制；`context` 是一层兼容壳，把旧 API（`setFillStyle / setFontSize / fillText / measureText / drawImage / draw(cb)` 等）翻译成 2D 属性写法。
- 导出统一走 `exportPainter(painter, 1500, 2400)` → `wx.canvasToTempFilePath({canvas})`，不再依赖页面节点位置。
- 2D 画布不能用路径字符串画图，必须 `canvas.createImage()` + `onload`，所以 `painter.loadImage()` 把 logo 先载成图片对象；`stats.posterLogoImage` / `index.reportLogoImage` 存的是图片对象，`drawImage` 传对象。
- 两个页面里的 `<canvas canvas-id="posterCanvas">`、`<canvas canvas-id="reportCanvas">` 与 `.poster-canvas` / `.report-canvas` 样式已删除；打卡页只保留可见的 `trendCanvas` 趋势图（它有实际显示用途）。
- 「保存图片 / 分享」加了 `wx.showLoading('正在生成…')`，失败也会回调并 `hideLoading`，点了立刻有反馈。
- `utils/local-image.js` 改成**先试相对路径**（`../../assets/brand/logo-mark.png`）再退回 `/assets/...`，避免工具里先打一条 404 再成功。
- `app.json` 的非法字段 `convertRpxToVw` 已删（上一节），若控制台仍报，是工具缓存，重新编译或重启开发者工具。

### 补充：翻页只有第一下（2026-11-19）

上一轮把 `flip-a` / `flip-b` 两组规则合并成同一个动画名（都指向 `flip-top-a` / `flip-bottom-a`），结果 `animation-name` 在连续两秒之间不变，节点没重建就不会重播，于是只有第一下会翻。现在 a / b 各自用 `flip-top-a` / `flip-top-b`、`flip-bottom-a` / `flip-bottom-b`（四组关键帧内容一致，但名字不同），靠 `flipPhase` 每次变化时交替，动画就会每秒重触发。**不要再把 a/b 合并成同一个名字。**

### 补充：logo 500 的真正原因（2026-11-19）

`__pageframe__/pages/stats/assets/brand/logo-mark.png` 这个 500 是 `wx.getImageInfo` 出来的，而且是被"相对路径"坑的：**代码包资源只能从项目根目录写**（`/assets/...` 或 `assets/...`），`../../assets/...` 是非法的（官方文档「文件系统 - 代码包文件」明确写了不支持相对路径），工具会把请求拼成 `pages/stats/assets/...` 并返回 500。

现在整条链路不再用 `getImageInfo`：`utils/painter.js` 的 `loadImage()` 直接 `wx.createOffscreenCanvas({type:'2d',width:1,height:1}).createImage()`，`image.src = '/assets/brand/logo-mark.png'`（根目录路径，合法），载好后传图片对象给 `drawImage`。`utils/local-image.js` 已删除。

### 补充：海报里的番茄换成品牌 logo（2026-11-19）

`stats.drawPoster()` 里主卡进度环的圆心原来是手绘小番茄（`draw.circle(...palette.danger)` + 高光 + 绿叶），现在改成画 `this.posterLogoImage`，62×62 居中放在半径 70、线宽 10 的环心里；图片没载上时退回原小番茄。页头左侧的品牌小 logo（38×38）保持不变。

## 14. 分析页海报重做（2026-11-19）

`pages/index/index.js` 的 `createReportImage()` 整体重排版式，只改 canvas 里的绘制指令，页面内 `rp3-*` UI 未动。新版结构（750×1200，M=48，CW=654）：

1. **页头**：logo 40×40（无 logo 时品牌名从 M 起排）+「泡泡计时器 · 训练报告」+ 日期；大标题「训练分析」44px；右侧模式胶囊（`模式 · N 个模块`，宽度按 measureText+40，文字走 `fitText` 防溢出）。
2. **主卡 152–430**：左侧竖色条 + 「本次结论」+ 结论大字 40px + 一行元信息（模块数/达标/超时）；右侧达标率环（圆心 610,236，半径 58，线宽 9，白心）+ 环下「达标率」；下半是**计划/实际双条对比**（同一比例尺，x 126→600，标签列在左、数值右对齐 672），这是"一眼看出超没超"的主视觉。
3. **三枚指标 446–542**：实际专注 / 计划用时 / **时间差值**（`diffValue`：超/省 X 分，超时红、省时绿）。差值是新加的最直观信息，来源 `actualSeconds - targetSeconds`。
4. **模块明细 592–1006（固定高度 414）**：每行 `序号 + 名称 + 实际/计划（按状态上色）+ 6px 横条`，横条带 2px 目标刻度（`targetPct`）；行距 `min(120, (414-68)/(n-1))` 并在卡内居中，8 行时约 49，行少时整组居中不留上方空洞；`listRows` 为空则整段（含节奏卡）不画。
5. **节奏观察 1022–1086**：浅蓝卡（`accentBg`），左右两栏「最花时间 / 最省时间」。
6. **提示**：色点 + `fishTip`；**页脚** 1166：「泡泡计时器 · 专注记录」+「长按保存 / 分享」。

配色全部走 `theme.canvas` + `theme.css`，没有写死色值；计划条用 `palette.highlight`，实际条用 `primary`。

验证方式：写了 `/tmp/rp/rec.js`（桩掉 createPainter，把 `poster-draw` 的 roundRect/card/pill/circle/ring 与 context 的 fillText/fillRect/drawImage 录成指令流）+ `/tmp/rp/paint.py`（用 PIL 按指令流重绘成 PNG），逐版对照 0/1/2/3/8 行的排版效果，最后按 8 行版本定稿。

### 补充：翻页只翻一次，改成每拍重建节点（2026-11-19）

前面两次都在「让 animation-name 变化」上做文章（先是同名不重播、后来 a/b 拆名），用户反馈仍然只有第一下翻。说明这台手机的渲染层不吃「父级 class 变化 → 子元素 animation-name 变化 → 重启动画」这条路径。

现在改成**物理重建**：`pages/timer/timer.wxml` 里翻页牌不再是一个常驻节点，而是按 `flipPhase` 分成 `wx:if="{{flipPhase}}"` / `wx:else` 两套，每秒交替渲染其中一套。节点每次都是全新元素，动画必然从 0% 播放，不依赖任何「动画重播」的平台行为。CSS 里 a/b 的四组动画名保留（父级 `flip-a`/`flip-b` 与两套节点一一对应）。

### 补充：海报字体（2026-11-19）

- `utils/painter.js` 的 `FONT_FAMILY` 换成和 `app.wxss` 完全一致的字体栈：`-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif`，海报里的字和小程序页面同一个长相。
- 新增 `setFontWeight(w)`，默认 700（以前是 400 常规体）。两张海报的关键数字额外提到 800/900：打卡海报的完成度百分比、三枚指标值；报告海报的标题、结论、达标率、三枚指标值。

### 补充：重要日子条目对齐待办样式（2026-11-19）

`pages/important/important.wxss` 的 `.imp-row` 一套改成和 `pages/todo` 的 `.todo-item` 同款：白卡 `var(--card)` + `2rpx solid var(--edge)` 描边 + 22rpx 圆角 + `4rpx 5rpx 0 var(--shadow-soft)` 硬阴影 + 22rpx 内边距；`.imp-name` 28rpx/800、`.imp-date` 21rpx/700、`.imp-yearly` 改成 `cream-2` 胶囊（18rpx/700）；加了 `app-rise-in` 入场动画（仅在非 `bubble-bursting` 时生效，避免抢掉气泡爆开的动画）。右侧倒计时数字保持 40rpx/900。

## 15. 分析报告页 v5 版式（2026-11-19）

只改报告「页面」，导出海报（`createReportImage`）没动。顶部「训练成绩」卡原样保留。

1. **时长对比**（一枚框 `rp4-frame`）：标题 + 右侧时差胶囊（`report.diffText`，超时红底红字 / 提前绿底绿字 / 十秒内「刚刚好」），下面只有两行：计划、实际，各自一根进度条 + 右侧数值。
2. **模块明细**（一枚框 + 框内每模块一张小卡）：列表只列**真正跑过的模块**（`reportModuleRows = rows.filter(elapsedSeconds>0)`，全为 0 时回落到全部）。每张模块卡：名称 + 状态胶囊 + `计划 / 实际 / 差值` + 进度条。进度条语义按用户要求：轨道浅色，**超时的模块轨道是 `--danger-bg` 红底**，主题色 `--primary` 那一段代表计划时间，超出的部分用 `--danger` 红段（`left: targetPercent%、width: overPercent%`）续在计划后面，末端还有一根 3rpx 的目标刻度。
3. **小鱼复盘**：标题从「训练复盘」改成「小鱼复盘」，卡面换成同一套框（3rpx `--edge` 描边 + `7rpx 8rpx 0 var(--shadow)` 硬阴影）。
4. 原来的「时间分布」整段删掉了（每模块都有进度条后它就是重复信息）。`rp3-dist-*` 那批样式暂时还在文件里没清，属于死代码，后续清理时再删。
5. 数据侧：`prepareReport` 新增 `diffOver` / `diffText`，每行新增 `overPercent`（超时部分的百分比，非超时为 0）；`showReport` 新增 `reportModuleRows`，`data` 里补了默认值 `[]`。

`rp4-frame` = 白卡 + `3rpx solid var(--edge)` + 32rpx 圆角 + `7rpx 8rpx 0 var(--shadow)`，和首页训练模块同一套「粗描边 + 硬阴影」语言（首页 `.module-card` 是 40rpx 圆角 + 9/10 阴影，报告页略收一档）。

## 16. 报告海报（导出图）对齐 v5 页面

`createReportImage()` 整段重画，版式和页面一一对应：

- **成绩卡**（152–404）：实际专注大数字 + 计划 N 分 + 计划达成环（r54）+ 达标 / 超时 / 模块三枚胶囊（超时数非 0 时胶囊转红）。
- **时长对比框**（428–600）：标题 + 右侧时差胶囊（`report.diffText`，超时红 / 提前绿 / 「刚刚好」走中性色）；只有计划、实际两行，条尾右对齐数值。
- **模块明细框**（626 起）：标题右侧 `X/Y 达标`，超过 4 个模块时改成 `N 个模块 · X 达标 · 列出前 4`；框高按行数算（`modMaxH = 402`，卡片高 `min(92, …)`），一行一个模块卡，每卡「名称 + 状态胶囊 + 计划/实际 + 差值 + 进度条」，进度条语义与页面一致：超时轨道用 `danger-bg`、主题色段 = 计划、红段 = 超出部分、末端 3rpx 目标刻度。
- **小鱼复盘框 / 页脚**：位置跟着模块框走（`fishTop = min(1046, modTop + modH + 18)`，页脚 `min(1166, fishTop + 122)`），模块少的海报不会再留一整块空框。

配色全部取 `theme.canvas` / `theme.css`（`danger-text`、`success-text`、`danger-bg`、`success-bg`、`cream-1`、`line`），没写死色值。

## 17. 首页空态补「添加训练模块」按钮

原来没模块时只剩一枚会浮动的 logo，用户找不到加号。`pages/index/index.wxml` 的空态块改成竖向两件：logo（点击也能加）+ 下方新胶囊按钮 `.home-module-add`（「＋ 添加训练模块」，`cream-1` 底 + 2rpx 描边 + `4rpx 5rpx 0` 硬阴影，按下沉 2rpx）。logo 尺寸从 150rpx 收到 132rpx 给按钮腾位置。

## 18. 计时页模块行拉开间距

`.stage-meta` 那行「模块名 / 时间胶囊 / 毫秒」原来挤在一起：`gap` 16rpx→22rpx，`.meta-total` 的 `margin-left` 4rpx→10rpx，`.meta-ms` 新增 `margin-left: 10rpx`；compact（横屏小窗）同步 12px→16px、3px→7px、7px。字号、颜色、胶囊都没动。

## 19. 模块进度条改三段语义 + 成绩卡统一外框

1. **去掉条尾的浅色余量**。`prepareReport` 里每行的刻度从 `max(elapsed,target)*1.06` 改成 `max(elapsed,target,1)`（不再留 6% 余量），并新增 `themePercent`（`min(计划,实际)` 占比）、`diffPercent`（`|计划-实际|` 占比）、`diffKind`（`over`/`ahead`/`equal`）。三者关系保证 `themePercent + diffPercent = 100`，进度条永远填满，没有粉色尾巴。
2. **配色语义**：主题色 = 计划内完成的那一段；超时的差值段用 `--danger` 红，提前的差值段用 `--success` 绿；轨道统一浅色 `--track`（不再在超时时把整条轨道涂成 `danger-bg` 粉底）。
   - 超时（计划 1:00 / 实际 1:25）：主题色约 70% + 红 30%。
   - 提前（计划 1:00 / 实际 0:02）：主题色 3% + 绿 97%。
3. 页面 WXML 的条改成 `.rp4-bar-theme` + `.rp4-bar-diff.over|.ahead` 两段绝对定位；海报 `createReportImage()` 同步（`successFill = tone.success || palette.success`），并删掉原来那根目标刻度线（现在边界本身就是计划线）。
4. **训练成绩卡换成同一套外框**：`.report-page .rp3-summary` 覆盖成 `3rpx solid var(--edge)` + 32rpx 圆角 + `7rpx 8rpx 0 var(--shadow)`，和时长对比 / 模块明细 / 小鱼复盘四块统一。

## 20. 时长对比简化为一句大字

页面和海报都只留「超时 / 提前 多少」一句：超时用 `--danger-text` 红、提前用 `--success-text` 绿、十秒内「刚刚好」走 `--ink`；页面字号 42rpx / 900，海报 36px / 900。原来的计划/实际两根条、右侧数值、时差胶囊全部删掉。
- 页面：`index.wxml` 的 `rp4-compare` 只剩 head + `.rp4-diff-big`；`index.wxss` 新增 `.rp4-diff-big` 三条规则（`.rp4-row/.rp4-track/.rp4-fill` 现在暂时没用了）。
- 海报：`createReportImage()` 的时长对比卡从 172 高收到 128，模块框上移到 578、可用高度 `modMaxH` 402→450。

## 21. 时钟皮肤合并到一处 + 报告页进度条换成首页滑杆样式

### 时钟（styles/clocks.wxss）
三个页面原本各写一份时钟配色：计时页 `.clock-<style>`、快捷计时 `.q-shell-<style>`、设置页预览 `.q-shell-<style>`。现在新增 **`styles/clocks.wxss`**，用 CSS 变量 `--clk-face / --clk-ink / --clk-line / --clk-accent / --clk-tile / --clk-panel / --clk-panel-edge / --clk-glow / --clk-deco` 定义 8 种样式的皮肤，选择器同时覆盖 `.clock-*` 与 `.q-shell-*` 两套命名。`pages/timer/timer.wxss`、`pages/quick/quick.wxss`、`pages/settings/settings.wxss` 首行各自 `@import "../../styles/clocks.wxss";`，并在文件末尾加「时钟皮肤收口」段，把数字/牌面/发光颜色接到这些变量上。

→ **改某个时钟样式的配色，只改 `styles/clocks.wxss` 一处**；页面里剩下的只有尺寸（rpx/px）、动画与遮罩。设置页 `-sample` 尺寸、计时页 compact/immersive 尺寸仍各页维护（本身就该不同）。

### 报告页进度条
- `pages/index/index.wxml`：模块卡的条换成 `rp4-gauge` —— `.rp4-gauge-track`（`cream-2` 底 + `2rpx` 描边 + 硬阴影 + 歪圆角）+ `.rp4-gauge-theme`（主题色斜纹段）+ `.rp4-gauge-diff.over|.ahead`（红/绿差值段）+ `.rp4-gauge-knob`（30rpx 圆把手，落在计划线位置）。
- 语义不变：满格 = 计划/实际的大者，主题色 = 计划内完成，红 = 超时，绿 = 提前；条尾不再有浅色余量。
- 海报同步：`createReportImage()` 在计划线位置画圆把手（描边 + 主色两圈）。
- 删掉已无引用的 `.rp4-track/.rp4-fill*/.rp4-row/.rp4-k/@keyframes rp4-grow`。

### 体检结果
`node --check` 全项目 0 错误；WXML 事件绑定全部能在 JS 找到同名方法；所有 wxss 花括号配平；`var(--x)` 全部在 `app.wxss` / `styles/clocks.wxss` 有定义（`--immersive-clock-scale` 由 JS 内联注入，属正常）；离屏海报导出自测通过；`app.json` 无 `convertRpxToVw` 等非法字段。

## 22. 品牌名改口：泡泡计时器 → 小鱼计时器

全项目「泡泡计时器」统一替换成「小鱼计时器」（共 29 处）：
- `app.json` 的 `navigationBarTitleText`、`i18n/base.json` 三条 name
- `utils/poster.js` 的 `footLeft`，英文品牌行 `BUBBLE TIMER · DAILY` → `FISH TIMER · DAILY`
- 海报/分享文案：`index.js`（训练报告页头、页脚、两条分享标题）、`stats.js`（打卡分享）
- `todo.js` 三条系统提醒文案、`README.md` 标题与首段、项目内 skill 文档
装饰性用词（泡泡上浮/爆开动画、设置里「番茄/星星/泡泡/小鱼」激励图标选项）保留不动。首页顶部「小鱼时钟」是页面名，不是品牌名，未改。

## 23. 记录页「查看报告」后的返回路径修复

- `pages/history/history.js` 的 `openReport()`：写入 `exam-timer-pending-report` 的同时写入 `exam-timer-report-origin = 'history'`。
- `pages/index/index.js` 的 `onShow()` 报告恢复分支：读出 origin 存进 `data.reportOrigin` 并立即清除 storage；调用 `showReport(record, { keepOpen: origin === 'history' })`。
- `goHomeView()`：报告页点左上 ‹ 时，若 `reportOrigin === 'history'` → `resetToHome()` 之后再 `wx.switchTab('/pages/history/history')`，回到记录列表，而不是把用户丢在首页工作台；同时清掉 origin 与 pending 两个 storage。
- `showReport(record, options)` 新增 `keepOpen`：历史报告不启动 15 秒自动退出的定时器（原来从记录页看旧报告会被自动踢回首页）。
- `backToConfig()` 一并清除 origin；删掉 `pages/index/index.js` 里重复定义的 `handleBack`（后者静默覆盖前者）。
- 体检：`node --check` 全绿、事件绑定无缺失、`index.js` 无重复方法名、`git diff --check` 通过；用 `/tmp/report_back_test.js`（wx/Page 桩）跑通「记录页 → 报告 → 返回」全程，`switchTab` 目标确认为 `pages/history/history`。

## 24. 重要日子条目统一样式 + 分析报告入场动效 + 修掉拖动松手闪一下

### 重要日子条目（首页两处入口）
`pages/index/index.wxml`：原先的 `home-feature-important-grid / -card`（浅蓝倒数大数字卡）整体换成待办同款行样式——容器 `.home-feature-list`（1 个时 `single` 占满宽，2 个两列）、条目 `.home-todo-card`（白底 + `2rpx` 描边 + 左侧空心圆点 + 名称 + 右侧倒数文字 `.home-todo-time`）。已过期的日子走 `.home-todo-card.overdue`（红底红点），不再用旧的 `.past` 半透明。左侧文案 `countdownNumber + countdownUnit`（今天 / N天后 / N天前）。旧的 `.home-feature-important-*` 样式已全部删除。

### 分析报告入场动效（`pages/index/index.wxss` 末尾「分析报告入场动效」段）
报告块是 `wx:if` 整块重建，所以动画每次进报告都会完整播一遍，且只动 `opacity/transform`（keyframes 里不用 `filter`，那会让动画整条失效）：
- 卡片序列：成绩卡 → 时长对比 → 模块明细 → 小鱼复盘 → 三按钮，`rp4-card-in` 依次 `0/.06/.12/.18/.24s` 延迟浮入；
- 成绩卡大数字 `.rp3-big`、时长对比大字 `.rp4-diff-big` 用 `rp4-num-in`（缩放 + 上浮）；
- 达成率环 `.rp3-ring` 用 `rp4-ring-in`（从 `.82` 缩放并 `-10deg` 转正）；
- 模块小卡 `.rp4-mod` 按 `nth-child(2..7)` 依次 `0.03s` 递增（`.rp4-head` 占了第一个子节点，所以延迟从 nth-child(2) 起算）；
- 进度条 `.rp4-gauge-theme` / `.rp4-gauge-diff` 用 `rp4-bar-grow` 从左向右 `scaleX` 生长，圆把手 `.rp4-gauge-knob` 最后 `rp4-knob-in` 弹出（keyframes 里带上了 `translate(-50%,-50%)`，否则会跳位）。

### 拖动松手「被挤走的模块消失又出现」
根因：`.page-content.reveal .module-card` 的入场动画 `home-drop-in` 带 `backwards` 填充，且延迟写在内联 `animation-delay: 220 + index*45ms`。松手重排后卡片 `index` 变了 → `animation-delay` 变化 → 动画重新排队，`backwards` 期间元素处于 `opacity:0` 的起始帧，于是「先消失、延迟到了再出现」。
修法三道：
1. `playHomeReveal()` 新增 `homeRevealOffTimer`，入场播完 1250ms 后把 `homeReveal` 摘掉，之后卡片不再挂动画；
2. `.page-content` 的 class 改成 `{{homeReveal && !dragging ? 'reveal' : ''}}`，拖动期间一律不挂动画；
3. 卡片的 `animation-delay` 改成条件内联：只在 `homeReveal && !dragging` 时输出，否则 style 里根本没有这个属性。

体检：`node --check` 全绿、事件绑定无缺失、wxss 花括号配平（index.wxss 785/785）、无未定义 `var()`、`index.wxml` `<view>` 开闭 154/154。

## 25. 打卡页弱项条/趋势图套首页滑杆样式 + 退全屏多播动画 + 报告页细部动效

### 打卡页（pages/stats）
- 弱项条 `.weak-track` 换成首页训练模块滑杆的外观：`cream-2` 底 + `3rpx solid var(--edge)` + `3rpx 4rpx 0 var(--shadow-soft)` + 歪圆角 `14rpx 10rpx 16rpx 11rpx`；`.weak-fill` 主题色 + `border-right` + `::after` 白色斜纹（112deg）；新增 `.weak-knob`（30rpx 圆把手 + 高光点，落在数值位置，`style="left:{{item.bar}}%"`）。超过 100% 的数值 `.weak-pct.over` 转红色。
- `drawTrend()` 重写：浅色底格（最后一条用 `line` 收边）、100% 基准改成**虚线 + 右侧 100% 刻度**（`edge` 色）、折线 `lineWidth 3.4` 圆头圆角、线下加 `rgba(color,.13)` 半透明面积、数据点改成「深描边 + 主色内芯」的圆把手（最后一个点更大）；配色全部取 `app.getTheme().css`（`primary / primary-2 / success / edge / cream-1 / line`），带 hex→rgba 的 `alpha()` 兜底。

### 退全屏后多播一遍入场动画（pages/timer/timer.js）
根因：退全屏时先挂 `immersiveAnim`（`.immersive-in-*` 覆盖组件动画），460ms 后撤掉 → 动画落回下一层 `.timer-page.reveal .controls` 等入场规则 → `animation-name` 变化 → 整条入场动画重新播一遍，于是「内容都复原了又突然动一下」。
修法：`openImmersive()` / `closeImmersive()` 里 `clearTimeout(this.timerRevealTimer)` 并 `setData({ timerReveal: false })`，切换期间与之后都不再命中 reveal 那套动画。`reveal` 只控制入场动画，没有别的样式依赖；下次进页面 `onShow → playTimerReveal()` 仍会正常播。

### 报告页细部动效（pages/index/index.wxss，接上一节）
在卡片入场上再补一层：`rp3-kicker` / `rp3-date` 淡入、`rp3-mode` 胶囊弹入、三颗 `rp3-stat-pill`（达标/超时/模块）依次弹入、`rp3-ring-value`（百分比数字）与 `rp3-ring-label` 跟上、框标题 `rp4-title` / `rp4-meta` 淡入、模块状态 `rp4-tag` 弹入、差值 `rp4-md` 淡入、复盘徽章 `rp3-brand-badge` 弹出 + 标题淡入。全部只动 `opacity/transform`，`backwards` 保证延迟期间不闪。

体检：`node --check` 全绿、事件绑定无缺失、wxss 括号配平、无未定义 `var()`、`stats.wxml` `<view>` 27/27 配平、离屏画布自测通过（960 次绘制）。
