const app = getApp()
const { pad, dateKey, bindKeyboardHeight } = require('../../utils/format')

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function importantDateText(key) {
  const parts = String(key || '').split('-').map(Number)
  if (!parts[0] || !parts[1] || !parts[2]) return ''
  return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`
}

Component({
  options: {
    styleIsolation: 'apply-shared'
  },

  data: {
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    kbVars: '',
    theme: (getApp() && getApp().getTheme && getApp().getTheme().key) || 'sky',
    themeStyle: (getApp() && getApp().getThemeStyle && getApp().getThemeStyle()) || '',
    list: [],
    burstingId: '',
    modalOpen: false,
    editingId: '',
    name: '',
    date: '',
    dateText: '',
    yearly: false,
    calendarOpen: false,
    calTitle: '',
    calRows: [],
    calWeekLabels: WEEK_LABELS,
    dockDim: false
  },

  lifetimes: {
    attached() {
      this.setData({ isDesktop: !!(getApp().globalData && getApp().globalData.isDesktop) })
      // 兜底：万一 utils/format 的灰度/缓存版本没带上这个导出，组件也不该整个挂掉
      this.unbindKeyboard = typeof bindKeyboardHeight === 'function' ? bindKeyboardHeight(this) : null
      this.syncTheme()
      this.loadList()
    },
    detached() {
      if (this.unbindKeyboard) {
        this.unbindKeyboard()
        this.unbindKeyboard = null
      }
      clearTimeout(this.burstTimer)
    }
  },

  pageLifetimes: {
    show() {
      this.syncTheme()
      this.loadList()
    },
    resize() {
      const app = getApp()
      const desktop = app && app.detectEnvironment
        ? app.detectEnvironment()
        : !!(app && app.globalData && app.globalData.isDesktop)
      if (desktop !== this.data.isDesktop) this.setData({ isDesktop: desktop })
    }
  },

  methods: {
    syncTheme() {
      const theme = (app.getTheme && app.getTheme()) || { key: 'sky' }
      this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    },

    goBack() {
      wx.navigateBack({
        fail: () => wx.switchTab({ url: '/pages/tools/tools' })
      })
    },

    loadList() {
      const raw = wx.getStorageSync(app.globalData.importantKey)
      const list = (Array.isArray(raw) ? raw : []).map(item => ({
        ...item,
        id: item.id || `important-${item.date}-${item.name}`
      }))
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const decorated = list.map(item => this.decorate(item, today)).filter(Boolean)
      decorated.sort((a, b) => {
        const ap = a.diff < 0 ? 1 : 0
        const bp = b.diff < 0 ? 1 : 0
        if (ap !== bp) return ap - bp
        return Math.abs(a.diff) - Math.abs(b.diff)
      })
      this.setData({ list: decorated })
    },

    decorate(item, today) {
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
        countdownNumber: isToday ? '今天' : Math.abs(diff),
        countdownUnit: isToday ? '' : (diff > 0 ? '天后' : '天前'),
        dateText: item.yearly ? `${parts[1]} 月 ${parts[2]} 日` : `${parts[0]}.${pad(parts[1])}.${pad(parts[2])}`,
        soon: diff >= 0 && diff <= 7,
        isPast: diff < 0
      }
    },

    openAdd() {
      const today = dateKey(new Date())
      this.setData({
        modalOpen: true,
        editingId: '',
        name: '',
        date: today,
        dateText: importantDateText(today),
        yearly: false,
        calendarOpen: false
      })
      this.refreshCalendar(today)
    },

    editItem(event) {
      const id = event.currentTarget.dataset.id
      const item = this.data.list.find(entry => entry.id === id)
      if (!item) return
      this.setData({
        modalOpen: true,
        editingId: item.id,
        name: item.name,
        date: item.date,
        dateText: importantDateText(item.date),
        yearly: item.yearly,
        calendarOpen: false
      })
      this.refreshCalendar(item.date)
    },

    closeModal() {
      this.setData({ modalOpen: false, calendarOpen: false })
    },

    onNameInput(event) {
      this.setData({ name: event.detail.value })
    },

    toggleYearly() {
      this.setData({ yearly: !this.data.yearly })
    },

    toggleCalendar() {
      const open = !this.data.calendarOpen
      if (open) this.refreshCalendar(this.data.date || dateKey(new Date()))
      this.setData({ calendarOpen: open })
    },

    buildCalendar(year, month, selectedKey) {
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

    refreshCalendar(dateText) {
      const parts = (dateText || dateKey(new Date())).split('-').map(Number)
      const cal = this.buildCalendar(parts[0], parts[1] - 1, dateText)
      this.setData({ calRows: cal.rows, calTitle: cal.title })
    },

    shiftMonth(event) {
      const step = Number(event.currentTarget.dataset.step) || 0
      const parts = (this.data.date || dateKey(new Date())).split('-').map(Number)
      const target = new Date(parts[0], parts[1] - 1 + step, 1)
      const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      const next = new Date(target.getFullYear(), target.getMonth(), Math.min(parts[2] || 1, maxDay))
      const nextKey = dateKey(next)
      this.setData({ date: nextKey, dateText: importantDateText(nextKey) })
      this.refreshCalendar(nextKey)
    },

    selectDay(event) {
      const key = event.currentTarget.dataset.key
      if (!key) return
      this.setData({ date: key, dateText: importantDateText(key) })
      this.refreshCalendar(key)
    },

    saveItem() {
      const name = String(this.data.name || '').trim()
      if (!name) {
        wx.showToast({ title: '先写一个重要日子', icon: 'none' })
        return
      }
      const date = this.data.date || dateKey(new Date())
      const raw = wx.getStorageSync(app.globalData.importantKey)
      const list = (Array.isArray(raw) ? raw : []).map(entry => ({
        ...entry,
        id: entry.id || `important-${entry.date}-${entry.name}`
      }))
      const item = {
        id: this.data.editingId || `important-${Date.now()}`,
        name: name.slice(0, 16),
        date,
        yearly: !!this.data.yearly
      }
      const index = list.findIndex(entry => entry.id === item.id)
      if (index >= 0) list[index] = item
      else list.push(item)
      wx.setStorageSync(app.globalData.importantKey, list)
      this.setData({ modalOpen: false, calendarOpen: false })
      this.loadList()
      wx.showToast({ title: this.data.editingId ? '已更新' : '已添加', icon: 'none' })
    },

    removeItem(event) {
      const id = event.currentTarget.dataset.id
      const item = this.data.list.find(entry => entry.id === id)
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
          if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
          this.setData({ burstingId: id })
          clearTimeout(this.burstTimer)
          this.burstTimer = setTimeout(() => {
            this.loadList()
            this.setData({ burstingId: '' })
          }, 580)
        }
      })
    },

    blockTouch() {},

    onBodyScroll(event) {
      const next = ((event.detail && event.detail.scrollTop) || 0) > 48
      if (next !== this.data.dockDim) {
        this.setData({ dockDim: next })
        this.triggerEvent('dockdim', { dim: next })
      }
    }
  }
})
