// 时钟尺寸的唯一口径：容器由窗口算出，皮肤只负责等比缩进容器。
// timer 页 / 快捷计时页 / 首页内嵌快捷面板都从这里取参数，别再各写一套。

// 各皮肤在「原始尺寸」下的近似占位（px），只用于全屏倍率兜底
const CLOCK_BASE = {
  flip: { w: 452, h: 108 },
  blocks: { w: 522, h: 100 },
  sticker: { w: 440, h: 100 },
  outline: { w: 500, h: 122 },
  jelly: { w: 481, h: 122 },
  doodle: { w: 486, h: 126 },
  stamp: { w: 500, h: 130 },
  jellypop: { w: 481, h: 124 }
}

// 计时页的时钟容器：同一台设备恒定，换皮肤不变
function computeSlotSize(winW, winH, isPortrait) {
  if (!winW || !winH) return { w: 320, h: 150 }
  if (isPortrait) {
    return {
      w: Math.round(Math.min(winW * 0.94, 860)),
      h: Math.round(Math.max(72, Math.min(winW * 0.30, winH * 0.24, 300)))
    }
  }
  if (winW >= 900) {
    // 左侧模块栏占 24%，主区只剩 76%：容器取 74% 屏宽
    return {
      w: Math.round(Math.max(320, Math.min(winW * 0.74, 1180))),
      h: Math.round(Math.max(150, Math.min(winH * 0.38, 400)))
    }
  }
  return {
    w: Math.round(Math.max(280, Math.min(winW * 0.72, 780))),
    h: Math.round(Math.max(120, Math.min(winH * 0.40, 230)))
  }
}

// 快捷计时页：宽度交给卡片实测，这里只给一个稳定的高度，避免时钟变大→卡片变高→再变大的死循环
function computeQuickSlot(winW, winH, isDesktop) {
  const base = 120
  const h = Math.max(base, Math.min((winW || 375) * 0.28, (winH || 667) * 0.26, isDesktop ? 320 : 220))
  return { h: Math.round(h) }
}

// 等比塞进容器：两个方向取小；允许放大，但留出边界余量
function fitScale(availW, availH, naturalW, naturalH, limits) {
  const min = (limits && limits.min) || 0.2
  const max = (limits && limits.max) || 3.2
  if (!availW || !availH || !naturalW || !naturalH) return 1
  let fit = Math.min((availW - 4) / naturalW, (availH - 4) / naturalH)
  if (!isFinite(fit) || fit <= 0) return 1
  fit = Math.min(max, Math.max(min, fit))
  return Math.round(fit * 1000) / 1000
}

module.exports = { CLOCK_BASE, computeSlotSize, computeQuickSlot, fitScale }
