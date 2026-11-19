const app = getApp()
const { pad, dateKey } = require('../../utils/format')

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function importantDateText(key) {
  const parts = String(key || '').split('-').map(Number)
  if (!parts[0] || !parts[1] || !parts[2]) return ''
  return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`
}

Page({
  data: {
    theme: 'pearl',
    themeStyle: '',
    todayPercent: 0,
    todoTodayPending: 0,
    todoPreview: [],
    importantPreview: [],
    importantDates: [],
    importantModalOpen: false,
    importantEditingId: '',
    importantName: '',
    importantDate: '',
    importantDateText: '',
    importantYearly: false,
    importantCalendarOpen: false,
    importantCalTitle: '',
    importantCalRows: [],
    importantCalWeekLabels: WEEK_LABELS
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    if (app.applyNavBar) app.applyNavBar()
    this.loadAll()
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().sync()
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    if (theme.key !== this.data.theme || (theme.style || '') !== this.data.themeStyle) {
      this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    }
    if (app.applyNavBar) app.applyNavBar()
    this.loadAll()
  },

  loadAll() {
    this.loadStats()
    this.loadTodos()
    this.loadImportantDates()
  },

  loadStats() {
    const summary = app.dailyStats ? app.dailyStats() : {}
    this.setData({ todayPercent: summary.todayPercent || 0 })
  },

  loadTodos() {
    const todos = wx.getStorageSync(app.globalData.todoKey) || []
    const todayKey = dateKey(new Date())
    const todayTodos = todos.filter(item => item.dueAt && dateKey(new Date(item.dueAt)) === todayKey)
    const todayPending = todayTodos.filter(item => !item.done)
    const pending = todos.filter(item => !item.done).sort((a, b) => {
      const at = a.dueAt || Number.MAX_SAFE_INTEGER
      const bt = b.dueAt || Number.MAX_SAFE_INTEGER
      return at - bt
    })
    const preview = pending.slice(0, 4).map(item => ({
      id: item.id,
      text: item.text,
      timeText: item.dueAt ? this.clockText(item.dueAt) : ''
    }))
    this.setData({ todoTodayPending: todayPending.length, todoPreview: preview })
  },

  clockText(timestamp) {
    const date = new Date(timestamp)
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`
    return dateKey(date) === dateKey(new Date()) ? time : `${date.getMonth() + 1}/${date.getDate()} ${time}`
  },

  // ---- 重要日子倒计时 ----
  loadImportantDates() {
    const raw = wx.getStorageSync(app.globalData.importantKey)
    const list = (Array.isArray(raw) ? raw : []).map(item => ({
      ...item,
      id: item.id || `important-${item.date}-${item.name}`
    }))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const decorated = list.map(item => this.decorateImportant(item, today)).filter(Boolean)
    decorated.sort((a, b) => {
      const ap = a.diff < 0 ? 1 : 0
      const bp = b.diff < 0 ? 1 : 0
      if (ap !== bp) return ap - bp
      return Math.abs(a.diff) - Math.abs(b.diff)
    })
    this.setData({ importantDates: decorated, importantPreview: decorated.slice(0, 4) })
  },

  decorateImportant(item, today) {
    if (!item || !item.name || !item.date) return null
    const parts = String(item.date).split('-').map(Number)
    if (!parts[0] || !parts[1] || !parts[2]) return null
    let diff = 0
    if (item.yearly) {
      let target = new Date(today.getFullYear(), parts[1] - 1, parts[2])
      if (target < today) target = new Date(today.getFullYear() + 1, parts[1] - 1, parts[2])
      diff = Math.round((target - today) / 86400000)
    } else {
      const target = new Date(parts[0], parts[1] - 1, parts[2])
      diff = Math.round((target - today) / 86400000)
    }
    const isToday = diff === 0
    return {
      id: item.id || `important-${item.date}-${item.name}`,
      name: item.name,
      date: item.date,
      yearly: !!item.yearly,
      diff,
      isToday,
      daysAbs: Math.abs(diff),
      countdownNumber: isToday ? '今天' : Math.abs(diff),
      countdownUnit: isToday ? '' : (diff > 0 ? '天后' : '天前'),
      dateText: item.yearly ? `${parts[1]} 月 ${parts[2]} 日` : `${parts[0]}.${pad(parts[1])}.${pad(parts[2])}`,
      soon: diff >= 0 && diff <= 7,
      isPast: diff < 0
    }
  },

  openImportantModal() {
    const today = dateKey(new Date())
    this.setData({
      importantModalOpen: true,
      importantEditingId: '',
      importantName: '',
      importantDate: today,
      importantDateText: importantDateText(today),
      importantYearly: false,
      importantCalendarOpen: false
    })
    this.refreshImportantCalendar(today)
  },

  editImportant(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.importantDates.find(entry => entry.id === id)
    if (!item) return
    this.setData({
      importantModalOpen: true,
      importantEditingId: item.id,
      importantName: item.name,
      importantDate: item.date,
      importantDateText: importantDateText(item.date),
      importantYearly: item.yearly,
      importantCalendarOpen: false
    })
    this.refreshImportantCalendar(item.date)
  },

  closeImportantModal() {
    this.setData({ importantModalOpen: false, importantCalendarOpen: false })
  },

  onImportantNameInput(event) {
    this.setData({ importantName: event.detail.value })
  },

  toggleImportantYearly() {
    this.setData({ importantYearly: !this.data.importantYearly })
  },

  toggleImportantCalendar() {
    const open = !this.data.importantCalendarOpen
    if (open) this.refreshImportantCalendar(this.data.importantDate || dateKey(new Date()))
    this.setData({ importantCalendarOpen: open })
  },

  buildImportantCalendar(year, month, selectedKey) {
    const first = new Date(year, month, 1)
    const lead = (first.getDay() + 6) % 7
    const days = new Date(year, month + 1, 0).getDate()
    const todayKey = dateKey(new Date())
    const cells = []
    for (let i = 0; i < lead; i += 1) cells.push({ key: `pad-${i}`, empty: true })
    for (let d = 1; d <= days; d += 1) {
      const key = dateKey(new Date(year, month, d))
      cells.push({ key, day: d, empty: false, selected: key === selectedKey, today: key === todayKey })
    }
    while (cells.length % 7 !== 0) cells.push({ key: `tail-${cells.length}`, empty: true })
    const rows = []
    for (let i = 0; i < cells.length; i += 7) rows.push({ key: `row-${i}`, cells: cells.slice(i, i + 7) })
    return { rows, title: `${year} 年 ${month + 1} 月` }
  },

  refreshImportantCalendar(dateText) {
    const parts = (dateText || dateKey(new Date())).split('-').map(Number)
    const cal = this.buildImportantCalendar(parts[0], parts[1] - 1, dateText)
    this.setData({ importantCalRows: cal.rows, importantCalTitle: cal.title })
  },

  shiftImportantMonth(event) {
    const step = Number(event.currentTarget.dataset.step) || 0
    const parts = (this.data.importantDate || dateKey(new Date())).split('-').map(Number)
    const target = new Date(parts[0], parts[1] - 1 + step, 1)
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    const next = new Date(target.getFullYear(), target.getMonth(), Math.min(parts[2] || 1, maxDay))
    const nextKey = dateKey(next)
    this.setData({ importantDate: nextKey, importantDateText: importantDateText(nextKey) })
    this.refreshImportantCalendar(nextKey)
  },

  selectImportantDay(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    this.setData({ importantDate: key, importantDateText: importantDateText(key) })
    this.refreshImportantCalendar(key)
  },

  saveImportantDate() {
    const name = String(this.data.importantName || '').trim()
    if (!name) {
      wx.showToast({ title: '先写一个重要日子', icon: 'none' })
      return
    }
    const date = this.data.importantDate || dateKey(new Date())
    const raw = wx.getStorageSync(app.globalData.importantKey)
    const list = (Array.isArray(raw) ? raw : []).map(entry => ({
      ...entry,
      id: entry.id || `important-${entry.date}-${entry.name}`
    }))
    const item = {
      id: this.data.importantEditingId || `important-${Date.now()}`,
      name: name.slice(0, 16),
      date,
      yearly: !!this.data.importantYearly
    }
    const index = list.findIndex(entry => entry.id === item.id)
    if (index >= 0) list[index] = item
    else list.push(item)
    wx.setStorageSync(app.globalData.importantKey, list)
    this.setData({ importantModalOpen: false, importantCalendarOpen: false })
    this.loadImportantDates()
    wx.showToast({ title: this.data.importantEditingId ? '已更新' : '已添加', icon: 'none' })
  },

  removeImportant(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.importantDates.find(entry => entry.id === id)
    if (!item) return
    wx.showModal({
      title: '删除重要日子',
      content: `确定删除「${item.name}」吗？`,
      confirmText: '删除',
      confirmColor: '#D9534F',
      success: ({ confirm }) => {
        if (!confirm) return
        const raw = wx.getStorageSync(app.globalData.importantKey)
        const list = (Array.isArray(raw) ? raw : [])
          .map(entry => ({ ...entry, id: entry.id || `important-${entry.date}-${entry.name}` }))
          .filter(entry => entry.id !== id)
        wx.setStorageSync(app.globalData.importantKey, list)
        this.loadImportantDates()
      }
    })
  },

  openQuick() {
    wx.navigateTo({ url: '/pages/quick/quick' })
  },

  openTodo() {
    wx.navigateTo({ url: '/pages/todo/todo' })
  },

  openStats() {
    wx.navigateTo({ url: '/pages/stats/stats?tab=overview' })
  },

  openHome() {
    const settings = app.getSettings ? app.getSettings() : {}
    if ((settings.homePrimary || 'timer') !== 'timer') {
      wx.setStorageSync('exam-timer-home-timer', true)
    }
    wx.switchTab({ url: '/pages/index/index' })
  },

  openSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  blockTouch() {}
})
