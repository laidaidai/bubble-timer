// 计时页随机名言库：每次进入计时页随机一条，同一条不会连续出现。
// 展示时不带出处、引号和句末标点，保持一句干净的鼓励。
const TIMER_QUOTES = [
  '不必追赶时间，先把这一分钟做好',
  '专注此刻，时间会给你答案',
  '只要我们能善用时间，就永远不愁时间不够用',
  '把今天的一小段专注，留给明天更好的自己',
  '慢一点没关系，只要一直在向前',
  '时间不会辜负每一个认真投入的当下',
  '先完成眼前这一格，再去看更远的地方',
  '认真过的每一分钟，都会留下回声',
  '每一次重新开始，都是时间给你的机会',
]

const LAST_QUOTE_KEY = 'exam-timer-quote-last'

function cleanQuote(text) {
  return String(text || '')
    .replace(/^[“”"'「」『』]+/, '')
    .replace(/[。．.!！?？；;，,、]+$/, '')
    .trim()
}

function pickTimerQuote() {
  const total = TIMER_QUOTES.length
  let lastText = ''
  try {
    lastText = wx.getStorageSync(LAST_QUOTE_KEY) || ''
  } catch (e) {}
  let index = Math.floor(Math.random() * total)
  if (total > 1 && TIMER_QUOTES[index] === lastText) {
    index = (index + 1 + Math.floor(Math.random() * (total - 1))) % total
  }
  const text = cleanQuote(TIMER_QUOTES[index])
  try {
    wx.setStorageSync(LAST_QUOTE_KEY, text)
  } catch (e) {}
  return { text }
}

module.exports = { TIMER_QUOTES, pickTimerQuote }
