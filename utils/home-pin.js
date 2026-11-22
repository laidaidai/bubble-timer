// 首页固定项 → 真实页面 / 真实内容。
// 快捷计时三项复用 quick-panel 组件直接渲染在首页本体里，保证原生 dock 不丢；
// 待办 / 重要日子 / 打卡打开各自真实页面，这些页面同样挂 dock。
const PIN_PAGES = {
  timer: '/pages/index/index',
  'quick-stopwatch': '/pages/quick/quick?tab=stopwatch',
  'quick-countdown': '/pages/quick/quick?tab=countdown',
  'quick-pomodoro': '/pages/quick/quick?tab=pomodoro',
  todo: '/pages/todo/todo',
  important: '/pages/important/important',
  stats: '/pages/stats/stats?tab=overview'
}

const PIN_NAMES = {
  timer: '训练计时',
  'quick-stopwatch': '秒表',
  'quick-countdown': '计时器',
  'quick-pomodoro': '番茄钟',
  todo: '待办',
  important: '重要日子',
  stats: '打卡'
}

const DEFAULT_PIN = 'timer'

function normalizePin(key) {
  return PIN_PAGES[key] ? key : DEFAULT_PIN
}

function pinnedUrl(key) {
  return PIN_PAGES[normalizePin(key)]
}

function pinnedName(key) {
  return PIN_NAMES[normalizePin(key)]
}

// 从设置里读当前固定项；所有入口共用，避免各页面各读一份
function readPinnedFeature() {
  const app = getApp()
  const settings = app && app.getSettings ? app.getSettings() : {}
  return normalizePin(settings.pinnedFeature)
}

module.exports = { PIN_PAGES, PIN_NAMES, DEFAULT_PIN, normalizePin, pinnedUrl, pinnedName, readPinnedFeature }
