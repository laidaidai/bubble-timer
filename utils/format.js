// 全项目统一的时间/日期格式化，避免各页面各写一套
const pad = value => String(value).padStart(2, '0')

const safeSeconds = seconds => Math.max(0, Math.floor(seconds || 0))

// 有小时才显示 h:mm:ss，否则 mm:ss（首页报告、模块用时使用）
const clock = seconds => {
  const value = safeSeconds(seconds)
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const remainder = value % 60
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(remainder)}` : `${pad(minutes)}:${pad(remainder)}`
}

// 固定 h:mm:ss（计时页大数字使用）
const clockFull = seconds => {
  const value = safeSeconds(seconds)
  return `${pad(Math.floor(value / 3600))}:${pad(Math.floor(value % 3600 / 60))}:${pad(value % 60)}`
}

// 分钟口径文案：<60 分钟显示「X 分钟」，否则「X 小时 Y 分」
const minutesText = seconds => {
  const value = Math.floor(safeSeconds(seconds) / 60)
  if (value < 60) return `${value} 分钟`
  return `${Math.floor(value / 60)} 小时 ${value % 60} 分`
}

const dateKey = value => {
  const date = value instanceof Date ? value : new Date(value)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const timeKey = value => {
  const date = value instanceof Date ? value : new Date(value)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const dateTimeText = timestamp => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const startOfDay = value => {
  const date = new Date(value instanceof Date ? value.getTime() : value)
  date.setHours(0, 0, 0, 0)
  return date
}

const clone = value => JSON.parse(JSON.stringify(value))

// 折叠列表：未展开时只取前 limit 条
const fold = (list, expanded, limit) => {
  const source = list || []
  return expanded ? source : source.slice(0, limit)
}

// 时钟样式目录（timer / quick / settings 共用，改一处即全局生效）
const CLOCK_STYLES = [
  { key: 'flip', name: '翻页时钟', desc: '机械翻页，复古有质感' },
  { key: 'blocks', name: '积木方块', desc: '立体方块，块面感强' },
  { key: 'sticker', name: '贴纸数字', desc: '白色描边，清楚可爱' },
  { key: 'outline', name: '描边空心', desc: '只画轮廓，中间留空' },
  { key: 'jelly', name: '果冻叠影', desc: '糖果描边，圆润轻快' },
  { key: 'doodle', name: '手绘涂鸦', desc: '墨色数字 + 彩色铅笔边，整排微微歪着' },
  { key: 'stamp', name: '手绘印章', desc: '像盖上去的章，粗描边 + 硬投影' },
  { key: 'jellypop', name: '果冻弹跳', desc: '主色果冻 + 一道奶白高光，会轻轻弹' }
]

// 七段数码管段码（LED 灯共用：计时页与快捷计时同一张表）
const LED_PATTERNS = {
  '0': [1, 1, 1, 1, 1, 1, 0],
  '1': [0, 1, 1, 0, 0, 0, 0],
  '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1],
  '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1],
  '7': [1, 1, 1, 0, 0, 0, 0],
  '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1]
}

const DEFAULT_CLOCK_STYLE = 'flip'

// 已下线样式的历史存档：自动迁移到替代样式，避免用户的选择被重置
const LEGACY_CLOCK_STYLE = { digital: 'doodle', gradient: 'jellypop', neon: 'doodle', minimal: 'outline', led: 'sticker' }
const resolveClockStyle = key => {
  const mapped = LEGACY_CLOCK_STYLE[key] || key
  return CLOCK_STYLES.find(item => item.key === mapped) || CLOCK_STYLES[0]
}


// 软键盘高度 → 页面 CSS 变量（--kb）
// 弹层是 position: fixed，键盘弹起时不会跟着页面上推，所以把高度写到页面根节点上，
// WXSS 里用 padding-bottom: var(--kb) 给弹层让位。
function bindKeyboardHeight(page) {
  if (!page || !wx.onKeyboardHeightChange) return () => { }
  const handler = (res) => {
    const height = Math.max(0, Math.round((res && res.height) || 0))
    if (height === page.__keyboardHeight) return
    page.__keyboardHeight = height
    page.setData({ kbVars: height ? `--kb: ${height}px;` : '--kb: 0px;' })
  }
  wx.onKeyboardHeightChange(handler)
  return () => {
    if (wx.offKeyboardHeightChange) wx.offKeyboardHeightChange(handler)
  }
}

module.exports = {
  pad,
  clock,
  clockFull,
  minutesText,
  dateKey,
  timeKey,
  dateTimeText,
  startOfDay,
  clone,
  fold,
  CLOCK_STYLES,
  LED_PATTERNS,
  DEFAULT_CLOCK_STYLE,
  resolveClockStyle,
  bindKeyboardHeight
}
