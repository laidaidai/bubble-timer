// ============================================================
// 过关斩将 · 主题唯一数据源（改色只需要改这个文件）
//
// 三种颜色 → 一套主题（swatch 就是那三色，顺序固定）：
//   [0] 纸 = 页面底色 / 导航栏底色
//   [1] 松 = 主色（按钮、进度、图表、选中、徽章）
//   [2] 杏 = 强调色（高亮、当前题、警示底、分数卡）
// 其余变量（文字层级、描边、线条、功能色）全部由这三色推出来的，
// 保证整套 UI 只有三个色相，不会出现“五颜六色的黑”。
//
// 落地方式（与 /Users/laiyuci/projects/计时器 同一套）：
//   css        → node tools/gen-theme-wxss.js 生成 app.wxss 里的 THEME-TOKENS 区块
//   nav/front/swatch/slider/canvas → JS 运行时读取（小程序读不到 CSS 变量，只能留一份）
// ============================================================

const THEMES = [
  {
    key: 'pine',
    name: '纸松',
    desc: '米纸底 + 松绿主色 + 杏黄强调，久看不刺眼',
    swatch: ['#F4F0E4', '#2A6B58', '#DDA84E'],
    nav: '#F4F0E4',
    front: '#000000',
    slider: { active: '#2A6B58', track: '#E6E0CE', block: '#DDA84E' },
    // canvas / 海报 / 雷达图取色（必须与 CSS 同色，否则图与页面两张皮）
    canvas: {
      bg: '#F4F0E4',
      card: '#FFFFFF',
      panel: '#1B3A31',
      onPanel: '#FFFFFF',
      ink: '#1B3A31',
      sub: '#7E8D82',
      accent: '#DDA84E',
      soft: '#F3DFB8',
      highlight: '#E9C077',
      accentDeep: '#B9873A',
      success: '#3E9B72',
      danger: '#D9543F',
      dangerFill: 'rgba(217, 84, 63, 0.18)',
      primary: '#2A6B58',
      primaryFill: 'rgba(42, 107, 88, 0.16)',
      grid: '#D8D2C0',
      track: '#E6E0CE'
    },
    css: {
      // ---- 面：纸 / 白卡 ----
      'bg': '#F4F0E4',
      'card': '#FFFFFF',
      'panel': '#FFFFFF',
      'panel-deep': '#E8E2D0',
      'on-panel': '#FFFFFF',
      // ---- 墨：所有文字与描边 ----
      'ink': '#1B3A31',
      'edge': '#1B3A31',
      'edge-deep': '#12271F',
      'edge-soft': '#A7BAAC',
      'shadow': 'rgba(27, 58, 49, 0.20)',
      'shadow-soft': 'rgba(27, 58, 49, 0.12)',
      // ---- 文字层级（松绿系灰）----
      'text-2': '#4B5F54',
      'text-3': '#7E8D82',
      'text-4': '#A7BAAC',
      'text-warm': '#B9873A',
      'text-mid': '#41544A',
      'text-dim': '#38584C',
      // ---- 线与轨 ----
      'line': '#D8D2C0',
      'line-2': '#EDE7D7',
      'line-strong': '#BEB8A4',
      'track': '#E6E0CE',
      // ---- 主色（松）----
      'primary': '#2A6B58',
      'primary-2': '#1F5343',
      'primary-3': '#17422F',
      'on-primary': '#FFFFFF',
      // ---- 强调（杏）----
      'accent': '#DDA84E',
      'accent-deep': '#B9873A',
      'accent-bg': '#E1EEE7',
      'accent-soft': '#F6E7C6',
      'cream-1': '#FBF8EF',
      'cream-2': '#F3EDDC',
      'cream-3': '#F7F2E5',
      'cream-4': '#EEE8D5',
      // ---- 语义点缀（仍取自三色，仅红色留给错误）----
      'pink': '#E9C077',
      'peach': '#F3DFB8',
      'chip-neutral': '#EDE7D7',
      'warn-bg': '#FBEFD6',
      'warn-text': '#8A5A1C',
      'success': '#3E9B72',
      'success-text': '#2C7A5C',
      'success-bg': '#DDF0E5',
      'success-line': '#A9D8C0',
      'danger': '#D9543F',
      'danger-text': '#B0331F',
      'danger-bg': '#FBE0D8',
      'danger-line': '#F0BFAF',
      // ---- 旧语义别名（页面里 var(--amber/--green/--red/--blue) 仍可用）----
      'amber': '#DDA84E',
      'amber-deep': '#B9873A',
      'green': '#3E9B72',
      'green-bg': '#DDF0E5',
      'red': '#D9543F',
      'red-bg': '#FBE0D8',
      'blue': '#2A6B58',
      'blue-bg': '#E1EEE7'
    }
  }
]

// 默认主题 = 第一套（单主题时即唯一主题）
const DEFAULT_KEY = THEMES[0].key

function findTheme(key) {
  for (let i = 0; i < THEMES.length; i++) {
    if (THEMES[i].key === key) return THEMES[i]
  }
  return THEMES[0]
}

module.exports = THEMES
module.exports.DEFAULT_KEY = DEFAULT_KEY
module.exports.findTheme = findTheme
