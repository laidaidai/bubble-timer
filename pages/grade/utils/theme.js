// 批改页主题运行时入口：优先使用主程序当前主题（含自定义主题），
// 小程序读不到 WXSS 变量，导航栏 / canvas 取色只能从 app.getTheme() 拿同一份。
// 计时器未初始化时退回批改原纸松主题，保证单独打开页面也不崩。
const PALETTE = require('../theme/palette.js')

function appTheme() {
  const app = typeof getApp === 'function' ? getApp() : null
  if (app && typeof app.getTheme === 'function') {
    const current = app.getTheme()
    if (current && current.canvas && current.css) return current
  }
  return null
}

function getTheme() {
  const current = appTheme()
  if (current) {
    const css = current.css || {}
    const canvas = current.canvas || {}
    return {
      key: current.key,
      name: current.name,
      desc: current.desc,
      swatch: current.swatch,
      nav: current.nav,
      front: current.front,
      css: css,
      // 批改页雷达图还用到 grid / accentDeep，计时器主题里没有这两个 key，
      // 用同一套主题的线和主色深阶补上，避免 canvas 出现 undefined 颜色。
      canvas: Object.assign({}, canvas, {
        grid: canvas.grid || css['line'] || css['line-strong'] || canvas.sub,
        accentDeep: canvas.accentDeep || css['primary-2'] || canvas.accent,
      }),
    }
  }
  return typeof PALETTE.findTheme === 'function' ? PALETTE.findTheme(PALETTE.DEFAULT_KEY) : PALETTE[0]
}

function getCanvasColors() {
  return getTheme().canvas
}

module.exports = {
  getTheme: getTheme,
  getCanvasColors: getCanvasColors,
}
