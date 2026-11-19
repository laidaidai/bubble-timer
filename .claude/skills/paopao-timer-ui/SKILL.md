---
name: paopao-timer-ui
description: 维护「泡泡计时器」微信小程序的界面与主题时使用。覆盖首页、工具、记录、横屏计时、快捷计时、训练报告、数据与打卡、待办、设置页面的奶油白参考皮肤与 6 套 neo-brutalist 主题规则、主题 token 改法、组件与交互约定、验收流程。任何新增页面、改布局、换配色、调字号、改按钮或做视觉审查都应先读本 Skill。
---

#  UI

原生微信小程序，`navigationStyle: custom`，8 个页面。默认是参考电商卡片风的「奶油白」皮肤：浅灰底、白色大圆角卡片、轻阴影、柠檬黄点缀；其余 6 套主题保留奶黄 / 粉 / 蓝 / 绿 / 深色的 neo-brutalist 描边与硬阴影。信息密度低，数字全部加粗。

## 先定位，再动手

- 项目根：用户当前打开的「计时器」目录（根下有 `app.js`、`app.json`、`pages/`）。
- 页面：`pages/index`（首页 + 报告）、`pages/tools`（工具）、`pages/history`（记录）、`pages/timer`（横屏计时）、`pages/quick`（快捷计时）、`pages/stats`（数据与打卡）、`pages/todo`、`pages/settings`。
- 主题唯一数据源：`theme/palette.js`；生成后的 CSS 变量在 `app.wxss` 的 `THEME-TOKENS:START/END` 之间。
- 通用时间格式化：`utils/format.js`；海报文案：`utils/poster.js`。

改任何颜色前，先读 `theme/palette.js` 和对应页面的 `wxss`，不要凭记忆写色值。

## 硬性视觉规则

1. **只用 CSS 变量**：`var(--bg)` `var(--card)` `var(--panel)` `var(--ink)` `var(--edge)` `var(--shadow)` `var(--shadow-soft)` `var(--primary)` `var(--primary-2)` `var(--primary-3)` `var(--on-primary)` `var(--on-panel)` `var(--on-panel-warm)` `var(--text-2/3/4)` `var(--line)` `var(--success/danger/warn)`。不要新增写死色值；canvas 用 `app.getTheme().canvas`。
2. 卡片：`border: 2rpx solid var(--edge)`（大卡片 3rpx）+ `box-shadow: 5rpx 6rpx 0 var(--shadow-soft)`（重点卡 7rpx 8rpx 0 var(--shadow)）+ 圆角 24–30rpx。按钮/芯片/进度条一律 `border-radius: 999rpx`。
3. 数字全部加粗：页面里的数值类 `<text>` 加 `class="num"`（`font-weight: 800` + tabular-nums），大数字 900。
4. 字号下限 18rpx；正文 20–24rpx，标题 26–32rpx，说明文字靠 `--text-3` 降级，不要继续缩小。
5. 删除/危险操作：红色 `#E8442F`，`wx.showModal` 用 `confirmColor: '#E8442F'`，文案明确「删除」。
6. 文案短。不要写规则解释、不要写「提前 X」这类未完成提示；面板副标题一句话说完。
7. 自定义导航栏顶栏右侧**不放任何控件**：会被微信胶囊盖住。设置入口只放在首页时钟图标处或页面左上返回旁。
8. 首页底部 dock 纯图标、填充风、不要太高；待办只保留一个右下 FAB，且必须是正圆（`view.fab` + `border-radius: 999rpx`）。
9. 横屏计时页所有元素避开左上返回和右上胶囊；番茄阶段标签不要压住大数字。

## 主题怎么改

- 内置 7 套：pearl 奶油白（默认）/ cream 蜂蜜奶霜 / tomato 红黄汽水 / rose 蜜桃雪酪 / sky 晴空苏打 / mint 薄荷青瓷 / obsidian 曜石鎏金。每套 46 个变量 + `nav/front/swatch/slider/canvas`。
- 流程：改 `theme/palette.js` → `node tools/gen-theme-wxss.js` → 确认 `app.wxss` 里恰好 7 组 `.theme-*`。**不要手改生成区**。
- 新主题同时补 `canvas`（海报画布色）与 `slider`（取色器色），否则海报/自定义主题编辑器会缺色。
- 自定义主题由 `app.buildCustomTheme()` 推导变量；页面根节点写 `class="... theme-{{theme}}" style="{{themeStyle}}"`，`ct-*` 主题靠内联变量生效。新增页面必须带这两项。
- 页面 `onShow` 重新读主题，切换后各页立即生效；导航栏用 `app.applyNavBar()`。

## 奶油白默认皮肤（`.theme-pearl`）

- 页面底 `var(--bg)` 浅灰，卡片 `var(--card)` 纯白，顶栏 `var(--nav)` 白色；主色 `var(--primary)` 柠檬黄只用于主 CTA、主卡、选中态和角标。
- 卡片不再用 2–3rpx 深色描边和硬投影：改成 `1rpx solid var(--line)` + `0 10rpx 30rpx rgba(31,31,31,.05)`，圆角 22–28rpx；参考图是商品白卡，不堆叠多层边框。
- 工具页：顶部黄色「快捷计时」主卡，下面 2×2 白卡（训练 / 待办 / 重要日子 / 打卡），设置收成白色次级条；不要回到六等大图标。
- 顶栏白底、细分割线、轻阴影；底部 Dock 白底，选中图标用 `var(--ink)`，未选中用 `var(--text-3)`，不要高饱和色块。
- 其他 6 套主题仍按上面的 neo-brutalist 规则，不要用奶油白皮肤覆盖它们的描边和硬阴影。

## 页面约定

- **首页**：模式胶囊（正计时/倒计时）；模板横向卡片；模块列表可拖动排序，拖动期间页面绝不能滚动（`catchtouchmove` + 固定 scroll 区域）；底部 Dock 三项（首页/工具/记录），设置从工具页进入，顶栏右侧不放控件。
- **报告**：顶栏固定，内容放独立 `scroll-view`；结论两张并排（最耗时/最短时），只有一张时整行铺满；底部三按钮同行等宽：保存图片（主色）/ 分享 / 再练一次；「再练一次」直接进计时页，不回首页。
- **计时页**：大数字总时间，小数字当前模块；表盘轻点背景切换并记住；毫秒小字灰且不抢眼；完成键只显示 `✓`；模块时间最多 `mm : ss`，中间留空格。
- **数据与打卡**：今日总览深色卡 + 两张指标卡 + 竖版海报 + 弱项追踪 + 成绩趋势；不足 1 分钟的训练不计入弱项/曲线；海报和 canvas 导出色一致。
- **待办**：自绘日历 + 时间面板（不要调微信原生 picker UI）；点整条切换完成、点右侧 `›` 编辑；新建落在当前筛选日期；sheet 用 `bottom: {{keyboardHeight}}px` 抬升，键盘弹出时 `max-height: 56vh`；开启提醒时调用 `wx.addPhoneCalendar` 写入系统日历，失败再退回小程序内弹窗。
- **设置**：分区折叠（点一个展开、点另一个自动收起）；预设模板最多 8 个、默认展示 4 个可展开；勾选即写入首页同名模板。

## 改完必须验收

1. `node --check` 所有改过的 js。
2. WXML：`{{}}` 配平、所有 `bindtap/catchtap` 在 js 中存在；WXSS：花括号配平。
3. 主题生成后检查 `.theme-*` 仍是 7 组、没有未定义变量（`var(--x)` 必须能在 `.theme-cream` 找到）。
4. 视觉预览：375px 宽、`rpx` 按 0.5 转 px；mock 必须 `div{display:block} span{display:inline}`，fixed 元素在 mock 里可能被裁切，只作参考，最终以微信开发者工具为准。
5. 交付时说清改了哪些文件、可能影响哪些页面；不要声称「已在 IDE 编译通过」，编译只能由用户在开发者工具点。

## 常见坑

- 拖动排序时页面跟着滚：手势要 `catchtouchmove`，并把滚动容器锁住。
- 单击日历日期不生效：重建列表时不要读旧 `data.filterDate`，把点击值作为参数传入。
- 自定义主题删除后残留卡片：旧 `settings.customTheme` 只在 `customThemes` 非数组时迁移；删除时要同时清 `customTheme`，`ct-legacy` 也要能删。
- 离线提醒优先用 `wx.addPhoneCalendar` 写系统日历；订阅消息只能授权、不能真正离线推送，不要承诺服务端推送。
- 小程序没有创建桌面快捷方式 API，不要设计「一键添加到桌面」。

