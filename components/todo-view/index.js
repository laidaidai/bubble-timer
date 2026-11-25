const app = getApp()
const { pad, dateKey } = require('../../utils/format')

const REMIND_OPTIONS = [
  { key: 0, label: '不提醒' },
  { key: 10, label: '提前 10 分钟' },
  { key: 30, label: '提前 30 分钟' },
  { key: 60, label: '提前 1 小时' }
]

const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function strip(item) {
  const { dueText, overdue, remindText, ...rest } = item
  return rest
}

function dateLabel(dateText) {
  if (!dateText) return ''
  const parts = dateText.split('-').map(Number)
  const key = dateText
  const today = dateKey(new Date())
  const tomorrow = dateKey(new Date(Date.now() + 24 * 3600 * 1000))
  if (key === today) return `今天 ${parts[1]}月${parts[2]}日`
  if (key === tomorrow) return `明天 ${parts[1]}月${parts[2]}日`
  return `${parts[1]} 月 ${parts[2]} 日`
}

function parseDue(dateText, hour, minute) {
  if (!dateText) return 0
  const parts = dateText.split('-').map(Number)
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, Number(hour) || 0, Number(minute) || 0, 0).getTime()
}

function dueLabel(dueAt) {
  if (!dueAt) return ''
  const now = Date.now()
  const target = new Date(dueAt)
  const today = dateKey(new Date())
  const tomorrow = dateKey(new Date(now + 24 * 3600 * 1000))
  const dayText = dateKey(target) === today ? '今天' : dateKey(target) === tomorrow ? '明天' : `${target.getMonth() + 1}月${target.getDate()}日`
  return `${dayText} ${pad(target.getHours())}:${pad(target.getMinutes())}`
}

Component({
  options: {
    styleIsolation: 'apply-shared'
  },

    data: {
    // 首帧就按当前设备与主题渲染，避免桌面上先闪一下手机版顶栏 / 默认配色
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    theme: 'sky', themeStyle: '',
    todos: [],
    viewTodos: [],
    schedTitle: '',
    schedRows: [],
    schedLabels: WEEK_LABELS,
    schedOffset: 0,
    filterDate: '',
    filterText: '',
    total: 0,
    doneCount: 0,
    percent: 0,
    remindOptions: REMIND_OPTIONS,
    hours: HOURS,
    minutes: MINUTES,
    // 编辑面板
    sheetOpen: false,
    burstingId: '',
    burstingDone: false,
    keyboardHeight: 0,
    editingId: '',
    draftText: '',
    draftDate: '',
    draftDateText: '',
    pickerPanel: '',
    draftHour: '09',
    draftMinute: '00',
    remindBefore: 0,
    timeValue: [9, 0],
    calTitle: '',
    calWeekLabels: WEEK_LABELS,
    calRows: [],
    dockDim: false
  },

  lifetimes: {
    attached() {
      this.onLoad()
    },
    detached() {
      this.onUnload()
    }
  },

  pageLifetimes: {
    show() {
      this.onShow()
    },
    hide() {
      this.onHide()
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
      const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
      if (theme.key !== this.data.theme || (theme.style || '') !== this.data.themeStyle) {
        this.setData({ theme: theme.key, themeStyle: theme.style || '' })
      }
      },

    onLoad() {
      this.setData({ isDesktop: !!(getApp().globalData && getApp().globalData.isDesktop) })
      this.syncTheme()
      this.loadTodos()
      // 键盘高度 → 底部面板整体抬升，避免输入法盖住输入框
      this.onKeyboard = (res) => {
        const height = Math.max(0, Number(res && res.height) || 0)
        if (height !== this.data.keyboardHeight) this.setData({ keyboardHeight: height })
      }
      if (wx.onKeyboardHeightChange) wx.onKeyboardHeightChange(this.onKeyboard)
    },

    onKeyboardHeightChange(event) {
      const height = Math.max(0, Number(event.detail && event.detail.height) || 0)
      if (height !== this.data.keyboardHeight) this.setData({ keyboardHeight: height })
    },

    onShow() {
      this.syncTheme()
      this.checkReminders()
      clearInterval(this.timer)
      this.timer = setInterval(() => this.checkReminders(), 30000)
    },

    onHide() {
      clearInterval(this.timer)
      this.timer = null
    },

    onUnload() {
      clearTimeout(this.burstTimer)
      clearInterval(this.timer)
      this.timer = null
      if (wx.offKeyboardHeightChange && this.onKeyboard) wx.offKeyboardHeightChange(this.onKeyboard)
    },

    loadTodos() {
      this.setTodos(wx.getStorageSync(app.globalData.todoKey) || [])
      this.checkReminders()
    },

    setTodos(todos) {
      const total = todos.length
      const doneCount = todos.filter(item => item.done).length
      const list = todos.map(item => ({
        ...item,
        dueText: dueLabel(item.dueAt),
        overdue: !!item.dueAt && !item.done && item.dueAt < Date.now(),
        remindText: item.remindBefore ? `提前 ${item.remindBefore >= 60 ? `${item.remindBefore / 60} 小时` : `${item.remindBefore} 分钟`}` : ''
      }))
      const filterDate = this.data.filterDate
      const viewTodos = filterDate
        ? list.filter(item => item.dueAt && dateKey(new Date(item.dueAt)) === filterDate)
        : list
      const sched = this.buildSchedule(list)
      this.setData({
        todos: list,
        viewTodos,
        total,
        doneCount,
        percent: total ? Math.round(doneCount / total * 100) : 0,
        schedTitle: sched.title,
        schedRows: sched.rows,
        filterText: filterDate ? dateLabel(filterDate) : ''
      })
      wx.setStorageSync(app.globalData.todoKey, list.map(strip))
    },

    // ---------- 月度日程 ----------
    buildSchedule(list, overrideDate) {
      const base = new Date()
      const target = new Date(base.getFullYear(), base.getMonth() + (this.data.schedOffset || 0), 1)
      // target 本身就是当月 1 号，直接用它算星期几（周一为 0）
      const lead = (target.getDay() + 6) % 7
      const days = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      const todayKey = dateKey(new Date())
      const filterDate = overrideDate === undefined ? this.data.filterDate : overrideDate
      const counts = {};
      (list || []).forEach(item => {
        if (!item.dueAt) return
        const key = dateKey(new Date(item.dueAt))
        counts[key] = (counts[key] || 0) + 1
      })
      const cells = []
      for (let i = 0; i < lead; i += 1) cells.push({ key: `pad-${i}`, empty: true })
      for (let d = 1; d <= days; d += 1) {
        const key = dateKey(new Date(target.getFullYear(), target.getMonth(), d))
        cells.push({
          key,
          day: d,
          empty: false,
          count: counts[key] || 0,
          today: key === todayKey,
          selected: key === filterDate
        })
      }
      while (cells.length % 7 !== 0) cells.push({ key: `tail-${cells.length}`, empty: true })
      while (cells.length < 42) cells.push({ key: `fill-${cells.length}`, empty: true })
      const rows = []
      for (let i = 0; i < cells.length; i += 7) rows.push({ key: `srow-${i}`, cells: cells.slice(i, i + 7) })
      return { rows, title: `${target.getFullYear()} 年 ${target.getMonth() + 1} 月` }
    },

    shiftScheduleMonth(event) {
      const step = Number(event.currentTarget.dataset.step) || 0
      this.setData({ schedOffset: (this.data.schedOffset || 0) + step }, () => {
        const sched = this.buildSchedule(this.data.todos)
        this.setData({ schedTitle: sched.title, schedRows: sched.rows })
      })
    },

    selectScheduleDate(event) {
      const key = event.currentTarget.dataset.key
      if (!key || key.indexOf('pad-') === 0 || key.indexOf('tail-') === 0) return
      const filterDate = this.data.filterDate === key ? '' : key
      const list = this.data.todos
      const viewTodos = filterDate
        ? list.filter(item => item.dueAt && dateKey(new Date(item.dueAt)) === filterDate)
        : list
      const sched = this.buildSchedule(list, filterDate)
      this.setData({
        filterDate,
        filterText: filterDate ? dateLabel(filterDate) : '',
        viewTodos,
        schedTitle: sched.title,
        schedRows: sched.rows
      })
    },

    clearScheduleFilter() {
      const sched = this.buildSchedule(this.data.todos, '')
      this.setData({ filterDate: '', filterText: '', viewTodos: this.data.todos, schedRows: sched.rows })
    },

    // ---------- 编辑面板 ----------
    buildCalendar(year, month, selectedKey) {
      const first = new Date(year, month, 1)
      const lead = (first.getDay() + 6) % 7
      const days = new Date(year, month + 1, 0).getDate()
      const todayKey = dateKey(new Date())
      const counts = {}
      const todos = this.data.todos || []
      todos.forEach(item => {
        if (!item.dueAt) return
        const key = dateKey(new Date(item.dueAt))
        counts[key] = (counts[key] || 0) + 1
      })
      const cells = []
      for (let i = 0; i < lead; i += 1) cells.push({ key: `pad-${i}`, empty: true })
      for (let d = 1; d <= days; d += 1) {
        const key = dateKey(new Date(year, month, d))
        cells.push({ key, day: d, empty: false, count: counts[key] || 0, selected: key === selectedKey, today: key === todayKey })
      }
      while (cells.length % 7 !== 0) cells.push({ key: `tail-${cells.length}`, empty: true })
      while (cells.length < 42) cells.push({ key: `fill-${cells.length}`, empty: true })
      const rows = []
      for (let i = 0; i < cells.length; i += 7) rows.push({ key: `row-${i}`, cells: cells.slice(i, i + 7) })
      return { rows, title: `${year} 年 ${month + 1} 月` }
    },

    refreshCalendar(dateText) {
      const parts = (dateText || dateKey(new Date())).split('-').map(Number)
      const cal = this.buildCalendar(parts[0], parts[1] - 1, dateText)
      this.setData({ calRows: cal.rows, calTitle: cal.title })
    },

    openPicker(event) {
      const panel = event.currentTarget.dataset.panel
      if (!panel) return
      if (panel === 'calendar') this.refreshCalendar(this.data.draftDate)
      this.setData({ pickerPanel: panel })
    },

    closePicker() {
      this.setData({ pickerPanel: '' })
    },

    shiftMonth(event) {
      const step = Number(event.currentTarget.dataset.step) || 0
      const parts = (this.data.draftDate || dateKey(new Date())).split('-').map(Number)
      const target = new Date(parts[0], parts[1] - 1 + step, 1)
      const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      const next = new Date(target.getFullYear(), target.getMonth(), Math.min(parts[2] || 1, maxDay))
      const dateText = dateKey(next)
      this.setData({ draftDate: dateText, draftDateText: dateLabel(dateText) })
      this.refreshCalendar(dateText)
    },

    selectDay(event) {
      const key = event.currentTarget.dataset.key
      if (!key) return
      this.setData({ draftDate: key, draftDateText: dateLabel(key) })
      this.refreshCalendar(key)
    },

    onTimeChange(event) {
      const value = event.detail.value || [0, 0]
      this.setData({
        timeValue: value,
        draftHour: HOURS[value[0]] || '00',
        draftMinute: MINUTES[value[1]] || '00'
      })
    },

    openCreate() {
      const now = new Date()
      now.setMinutes(now.getMinutes() + 30)
      const todayKey = dateKey(new Date())
      // 日程里选中了某天时，新增默认落到那一天
      const picked = this.data.filterDate
      const dateText = picked || dateKey(now)
      const isToday = dateText === todayKey
      const hour = isToday ? pad(now.getHours()) : '09'
      const minute = isToday ? pad(now.getMinutes()) : '00'
      this.setData({
        sheetOpen: true,
        editingId: '',
        draftText: '',
        draftDate: dateText,
        draftDateText: dateLabel(dateText),
        pickerPanel: '',
        draftHour: hour,
        draftMinute: minute,
        timeValue: [Number(hour), Number(minute)],
        remindBefore: 0
      })
      this.refreshCalendar(dateText)
    },

    openEdit(event) {
      const id = event.currentTarget.dataset.id
      const item = this.data.todos.find(todo => todo.id === id)
      if (!item) return
      const due = item.dueAt ? new Date(item.dueAt) : new Date()
      const dateText = dateKey(due)
      const hour = pad(due.getHours())
      const minute = pad(due.getMinutes())
      this.setData({
        sheetOpen: true,
        editingId: id,
        draftText: item.text,
        draftDate: dateText,
        draftDateText: dateLabel(dateText),
        pickerPanel: '',
        draftHour: hour,
        draftMinute: minute,
        timeValue: [Number(hour), Number(minute)],
        remindBefore: item.remindBefore || 0
      })
      this.refreshCalendar(dateText)
    },

    closeSheet() {
      this.setData({ sheetOpen: false, pickerPanel: '', keyboardHeight: 0 })
    },

    blockTouch() {},

    onDraftInput(event) {
      this.setData({ draftText: event.detail.value })
    },

    setRemind(event) {
      this.setData({ remindBefore: Number(event.currentTarget.dataset.key) || 0 })
    },

    confirmSheet() {
      const text = (this.data.draftText || '').trim()
      if (!text) {
        wx.showToast({ title: '先写点内容', icon: 'none' })
        return
      }
      const dueAt = parseDue(this.data.draftDate, this.data.draftHour, this.data.draftMinute)
      const remindBefore = this.data.remindBefore
      const base = this.data.todos.map(strip)
      const targetId = this.data.editingId || `t-${Date.now()}`
      let todos
      if (this.data.editingId) {
        const previous = base.find(item => item.id === this.data.editingId) || {}
        const timeChanged = previous.dueAt !== dueAt || (previous.remindBefore || 0) !== remindBefore
        todos = base.map(item => item.id === this.data.editingId
          ? {
            ...item,
            text,
            dueAt,
            remindBefore,
            notified: false,
            // 时间或提醒方式变了才重新写入日历，避免每次编辑都加一条
            calendarKey: timeChanged ? '' : (item.calendarKey || '')
          }
          : item)
      } else {
        todos = base.concat([{
          id: targetId,
          text,
          done: false,
          createdAt: Date.now(),
          dueAt,
          remindBefore,
          notified: false,
          calendarKey: ''
        }])
      }
      this.setData({ sheetOpen: false })
      this.setTodos(todos)
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      // 只要设置了未来时间就尝试写入系统日历；不强制要求选择提前提醒
      const saved = todos.find(item => item.id === targetId)
      if (saved && Number(saved.dueAt) > Date.now()) this.syncPhoneCalendar(saved)
    },

    // 把待办写入手机系统日历，关闭小程序后由系统提醒
    syncPhoneCalendar(item) {
      const dueAt = Number(item.dueAt) || 0
      const remind = Number(item.remindBefore) || 0
      if (!dueAt || dueAt <= Date.now()) return
      const key = `${dueAt}-${remind}`
      if (item.calendarKey === key) return
      if (!wx.addPhoneCalendar) {
        wx.showToast({ title: '当前微信版本不支持日历提醒', icon: 'none' })
        return
      }

      const addEvent = () => this.writePhoneCalendar(item, key)

      // scope.addPhoneCalendar 必须由用户明确授权；先检查，未决定时主动弹授权
      if (wx.getSetting && wx.authorize) {
        wx.getSetting({
          success: (setting) => {
            const auth = (setting && setting.authSetting) || {}
            const status = auth['scope.addPhoneCalendar']
            if (status === true) {
              addEvent()
              return
            }
            if (status === false) {
              this.showCalendarAuthModal()
              return
            }
            wx.authorize({
              scope: 'scope.addPhoneCalendar',
              success: addEvent,
              fail: () => this.showCalendarAuthModal()
            })
          },
          fail: addEvent
        })
        return
      }

      addEvent()
    },

    writePhoneCalendar(item, key) {
      const dueAt = Number(item.dueAt) || 0
      const remind = Number(item.remindBefore) || 0
      const startTime = Math.floor(dueAt / 1000)
      const settings = app.getSettings ? app.getSettings() : {}
      if (settings.privacyCalendar === false) {
        wx.showToast({ title: '已在设置里关闭日历写入', icon: 'none' })
        return
      }
      const remindText = remind >= 60 ? `${remind / 60} 小时` : `${remind} 分钟`
      wx.addPhoneCalendar({
        title: `小鱼计时器 · ${item.text}`,
        startTime,
        endTime: startTime + 30 * 60,
        alarm: remind > 0,
        alarmOffset: remind * 60,
        description: remind
          ? `提前 ${remindText} 提醒 · 来自小鱼计时器待办`
          : '来自小鱼计时器待办',
        success: () => {
          this.markCalendarSynced(item.id, key)
          wx.showToast({ title: '已加入手机日历', icon: 'none' })
        },
        fail: (error) => {
          const message = String((error && error.errMsg) || '')
          if (message.indexOf('auth') >= 0 || message.indexOf('deny') >= 0 || message.indexOf('privacy') >= 0) {
            this.showCalendarAuthModal()
            return
          }
          wx.showToast({ title: '日历没加上，仍会在小程序内提醒', icon: 'none' })
        }
      })
    },

    showCalendarAuthModal() {
      wx.showModal({
        title: '需要日历权限',
        content: '允许添加到日历后，才能把待办写进手机系统日历。',
        confirmText: '去设置',
        success: ({ confirm }) => {
          if (confirm && wx.openSetting) wx.openSetting()
        }
      })
    },

    markCalendarSynced(id, key) {
      const next = this.data.todos.map(item => (item.id === id ? { ...item, calendarKey: key } : item))
      this.setTodos(next.map(strip))
    },

    removeInSheet() {
      const id = this.data.editingId
      if (!id) {
        this.setData({ sheetOpen: false })
        return
      }
      wx.showModal({
        title: '删除这条待办？',
        content: this.data.draftText,
        confirmText: '删除',
        confirmColor: '#E8442F',
        success: ({ confirm }) => {
          if (!confirm) return
          this.setData({ sheetOpen: false })
          this.burstRemoveTodo(id)
        }
      })
    },

    // ---------- 列表 ----------
    toggleTodo(event) {
      const id = event.currentTarget.dataset.id
      const todos = this.data.todos.map(item => (item.id === id ? { ...item, done: !item.done } : item))
      this.setTodos(todos.map(strip))
      const target = todos.find(item => item.id === id)
      if (target && target.done) {
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
        if (todos.every(item => item.done) && todos.length > 1) {
          wx.showToast({ title: '今天的清单清空了', icon: 'none' })
        }
      }
    },

    burstRemoveTodo(id) {
      if (!id) return
      const next = this.data.todos.filter(item => item.id !== id).map(strip)
      wx.setStorageSync(app.globalData.todoKey, next)
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      this.setData({ burstingId: id })
      clearTimeout(this.burstTimer)
      this.burstTimer = setTimeout(() => {
        this.setTodos(next)
        this.setData({ burstingId: '' })
      }, 580)
    },

    removeTodo(event) {
      const id = event.currentTarget.dataset.id
      const target = this.data.todos.find(item => item.id === id)
      if (!target) return
      wx.showModal({
        title: '删除这条待办？',
        content: target.text,
        confirmText: '删除',
        confirmColor: '#E8442F',
        success: ({ confirm }) => {
          if (!confirm) return
          this.burstRemoveTodo(id)
        }
      })
    },

    clearDone() {
      if (!this.data.doneCount) {
        wx.showToast({ title: '还没有已完成的', icon: 'none' })
        return
      }
      wx.showModal({
        title: '清空已完成？',
        content: `将移除 ${this.data.doneCount} 条已完成的待办`,
        confirmText: '清空',
        confirmColor: '#E8442F',
        success: ({ confirm }) => {
          if (!confirm) return
          const next = this.data.todos.filter(item => !item.done).map(strip)
          wx.setStorageSync(app.globalData.todoKey, next)
          if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
          this.setData({ burstingDone: true })
          clearTimeout(this.burstTimer)
          this.burstTimer = setTimeout(() => {
            this.setTodos(next)
            this.setData({ burstingDone: false })
            wx.showToast({ title: '已清空', icon: 'none' })
          }, 580)
        }
      })
    },

    checkReminders() {
      const todos = (this.data.todos || []).filter(item => item.dueAt && !item.done)
      if (!todos.length) return
      const now = Date.now()
      const due = todos.find(item => !item.notified && now >= item.dueAt - (item.remindBefore || 0) * 60000 && now <= item.dueAt + 30 * 60000)
      if (!due) return
      const marked = this.data.todos.map(item => (item.id === due.id ? { ...item, notified: true } : item))
      this.setTodos(marked.map(strip))
      if (wx.vibrateLong) wx.vibrateLong({ fail: () => {} })
      wx.showModal({
        title: due.dueAt <= now ? '待办已到时间' : '待办快到时间',
        content: `${due.text}\n计划时间 ${dueLabel(due.dueAt)}`,
        showCancel: false,
        confirmText: '知道了'
      })
    },

    handleBack() {
      if (this.data.sheetOpen) {
        this.setData({ sheetOpen: false })
        return
      }
      const pages = getCurrentPages()
      if (pages.length > 1) wx.navigateBack()
      else wx.reLaunch({ url: '/pages/index/index' })
    },

    onPageScroll(event) {
      const next = (event.scrollTop || 0) > 48
      if (next !== this.data.dockDim) this.setData({ dockDim: next })
    },

    onBodyScroll(event) {
      const scrollTop = (event.detail && event.detail.scrollTop) || 0
      this.onPageScroll({ scrollTop })
      this.triggerEvent('dockdim', { dim: !!this.data.dockDim })
    }

  }
})
