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
  fold
}
