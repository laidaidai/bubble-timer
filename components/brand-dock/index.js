const QUICK_STATE_KEY = 'exam-timer-quick-state'
const RECORDS_KEY = 'exam-timer-records'
const TODO_KEY = 'exam-timer-todos'

Component({
  properties: {
    themeStyle: { type: String, value: '' },
    aboveTabbar: { type: Boolean, value: false },
    dim: { type: Boolean, value: false }
  },
  data: {
    expanded: false,
    progress: 0,
    todayMinutes: 0,
    hasContinue: false,
    continueSub: '',
    todoSub: '',
    timerRunning: false,
    celebrate: false
  },
  lifetimes: {
    attached() {
      this.refreshContext()
    },
    detached() {
      if (this.celebrateTimer) clearTimeout(this.celebrateTimer)
      if (this.longPressTimer) clearTimeout(this.longPressTimer)
    }
  },
  pageLifetimes: {
    show() {
      this.refreshContext()
    }
  },
  methods: {
    noop() {},

    refreshContext() {
      const app = getApp()
      const summary = app && app.dailyStats ? app.dailyStats() : {}
      const records = wx.getStorageSync(RECORDS_KEY) || []
      const last = records[0]
      const lastRows = last && Array.isArray(last.rows) ? last.rows : []
      this._lastRecord = lastRows.length ? last : null

      const todos = wx.getStorageSync(TODO_KEY) || []
      const pendingTodos = Array.isArray(todos)
        ? todos.filter(item => item && !item.done).length
        : 0

      const quick = wx.getStorageSync(QUICK_STATE_KEY) || {}
      const todayMinutes = Math.max(0, Math.round((summary.todaySeconds || 0) / 60))

      this.setData({
        progress: Math.max(0, Math.min(100, summary.todayPercent || 0)),
        todayMinutes,
        timerRunning: !!quick.running,
        hasContinue: !!this._lastRecord,
        continueSub: this._lastRecord
          ? `${lastRows.length} 个模块 · ${last.totalActualText || '上次训练'}`
          : '',
        todoSub: pendingTodos ? `${pendingTodos} 项待完成` : '今天没有待办'
      })
    },

    onTap() {
      if (this.longPressTriggered) {
        this.longPressTriggered = false
        return
      }
      this.toggle()
    },

    toggle() {
      this.setData({ expanded: !this.data.expanded })
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    },

    close() {
      if (this.data.expanded) this.setData({ expanded: false })
    },

    longPress() {
      this.longPressTriggered = true
      if (this.longPressTimer) clearTimeout(this.longPressTimer)
      this.longPressTimer = setTimeout(() => {
        this.longPressTriggered = false
        this.longPressTimer = null
      }, 700)
      if (this.data.expanded) this.setData({ expanded: false })
      if (wx.vibrateShort) wx.vibrateShort({ type: 'medium', fail: () => {} })

      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      if (page && typeof page.toggleDockTimer === 'function') {
        page.toggleDockTimer()
        return
      }

      const quick = wx.getStorageSync(QUICK_STATE_KEY) || {}
      const tab = ['stopwatch', 'countdown', 'pomodoro'].indexOf(quick.tab) >= 0
        ? quick.tab
        : 'countdown'
      const mode = this.data.timerRunning ? 'dockpause=1' : 'autostart=1'
      wx.navigateTo({ url: `/pages/quick/quick?tab=${tab}&${mode}` })
    },

    startTimer() {
      this.close()
      if (this.currentRoute() === 'pages/quick/quick') {
        const pages = getCurrentPages()
        const page = pages[pages.length - 1]
        if (page && typeof page.toggleRun === 'function') page.toggleRun()
        return
      }
      const quick = wx.getStorageSync(QUICK_STATE_KEY) || {}
      const tab = ['stopwatch', 'countdown', 'pomodoro'].indexOf(quick.tab) >= 0
        ? quick.tab
        : 'countdown'
      const mode = this.data.timerRunning ? 'dockpause=1' : 'autostart=1'
      wx.navigateTo({ url: `/pages/quick/quick?tab=${tab}&${mode}` })
    },

    continueLast() {
      const last = this._lastRecord
      if (!last) return
      const modules = (last.rows || [])
        .filter(item => item && item.name)
        .map(item => ({ name: item.name, targetMinutes: Math.max(0, Number(item.targetMinutes) || 0) }))
      if (!modules.length) {
        wx.showToast({ title: '上次记录没有可恢复模块', icon: 'none' })
        return
      }
      this.close()
      wx.setStorageSync('exam-timer-pending-modules', modules)
      wx.reLaunch({ url: '/pages/index/index' })
    },

    openTodo() {
      this.close()
      if (this.currentRoute() === 'pages/todo/todo') return
      wx.navigateTo({ url: '/pages/todo/todo' })
    },

    celebrate() {
      this.refreshContext()
      if (this.celebrateTimer) clearTimeout(this.celebrateTimer)
      this.setData({ celebrate: true })
      this.celebrateTimer = setTimeout(() => {
        this.celebrateTimer = null
        this.setData({ celebrate: false })
      }, 1500)
    },

    currentRoute() {
      const pages = getCurrentPages()
      const page = pages[pages.length - 1]
      return page ? page.route : ''
    }
  }
})
