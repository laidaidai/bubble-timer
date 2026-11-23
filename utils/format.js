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
  if (!isFinite(date.getTime())) return ''
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
  { key: 'doodle', name: '糖果手写', desc: '手写圆体 + 墨色描边 + 糖果色错位影子' },
  { key: 'stamp', name: '奶糖手写', desc: '深可可手写字 + 一层奶糖暖影，干净不倾斜' },
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

// 底部面板下拉关闭：只由顶部横杆接管触摸，内容区滚动不受影响。
// 下移超过面板高度的 22%（64~140px）或末段速度足够快时关闭，否则回弹。
function resetSheetDrag(page) {
  if (!page) return
  if (page._sheetDragTimer) {
    clearTimeout(page._sheetDragTimer)
    page._sheetDragTimer = null
  }
  page._sheetDrag = null
  if (page.data && (page.data.sheetDragY || page.data.sheetDragging || page.data.sheetSettling)) {
    page.setData({ sheetDragY: 0, sheetDragging: false, sheetSettling: false })
  }
}

function startSheetDrag(page, event, options) {
  if (!page || !page.setData) return
  const touch = event && event.touches && event.touches[0]
  if (!touch) return
  if (page._sheetDragTimer) {
    clearTimeout(page._sheetDragTimer)
    page._sheetDragTimer = null
  }
  const startY = touch.clientY != null ? touch.clientY : touch.pageY
  const selector = (options && options.selector) || ''
  page._sheetDrag = {
    startY,
    lastY: startY,
    lastAt: Date.now(),
    dy: 0,
    height: 0,
    close: (options && options.close) || ''
  }
  page.setData({ sheetDragY: 0, sheetDragging: true, sheetSettling: false })
  if (!selector || !wx.createSelectorQuery) return
  // 高度用于判断关闭阈值和下沉距离；查不到时退化为固定阈值。
  wx.createSelectorQuery().select(selector).boundingClientRect((rect) => {
    if (page._sheetDrag && rect && rect.height) page._sheetDrag.height = rect.height
  }).exec()
}

function moveSheetDrag(page, event) {
  if (!page || !page._sheetDrag) return
  const touch = event && event.touches && event.touches[0]
  if (!touch) return
  const y = touch.clientY != null ? touch.clientY : touch.pageY
  const drag = page._sheetDrag
  const dy = Math.max(0, y - drag.startY)
  drag.dy = dy
  drag.lastY = y
  drag.lastAt = Date.now()
  page.setData({ sheetDragY: Math.round(dy) })
}

function finishSheetDrag(page, event, options, allowClose) {
  if (!page || !page._sheetDrag) return
  const drag = page._sheetDrag
  page._sheetDrag = null
  const touch = event && event.changedTouches && event.changedTouches[0]
  const endY = touch ? (touch.clientY != null ? touch.clientY : touch.pageY) : drag.lastY
  const finalDy = Math.max(drag.dy, Math.max(0, endY - drag.startY))
  const elapsed = Math.max(1, Date.now() - drag.lastAt)
  const speed = Math.max(0, (endY - drag.lastY) / elapsed)
  const threshold = drag.height ? Math.min(140, Math.max(64, drag.height * 0.22)) : 88
  const shouldClose = allowClose && (finalDy > threshold || (finalDy > 32 && speed > 0.55))
  if (shouldClose) {
    const fall = drag.height || Math.max(240, finalDy + 120)
    page.setData({ sheetDragY: Math.round(fall), sheetDragging: false, sheetSettling: true })
    page._sheetDragTimer = setTimeout(() => {
      page._sheetDragTimer = null
      const close = (options && options.close) || drag.close
      if (close && typeof page[close] === 'function') page[close]()
      else page.setData({ sheetDragY: 0, sheetDragging: false, sheetSettling: false })
    }, 260)
    return
  }
  page.setData({ sheetDragY: 0, sheetDragging: false, sheetSettling: true })
  page._sheetDragTimer = setTimeout(() => {
    page._sheetDragTimer = null
    if (page.data && page.data.sheetSettling) page.setData({ sheetSettling: false })
  }, 280)
}

function endSheetDrag(page, event, options) {
  finishSheetDrag(page, event, options, true)
}

function cancelSheetDrag(page) {
  finishSheetDrag(page, null, null, false)
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
  bindKeyboardHeight,
  resetSheetDrag,
  startSheetDrag,
  moveSheetDrag,
  endSheetDrag,
  cancelSheetDrag
}
