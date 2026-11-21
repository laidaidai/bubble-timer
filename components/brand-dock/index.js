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
    celebrate: false,
    dockStyle: '',
    navOptions: [
      { key: 'timer', name: '训练计时' },
      { key: 'quick-stopwatch', name: '秒表' },
      { key: 'quick-countdown', name: '计时器' },
      { key: 'quick-pomodoro', name: '番茄钟' },
      { key: 'todo', name: '待办' },
      { key: 'important', name: '重要日子' },
      { key: 'stats', name: '打卡' },
      { key: 'grade', name: '过关斩将' }
    ]
  },
  lifetimes: {
    attached() {
      this.syncDeskScale()
      this.refreshContext()
      // PC 上拖动窗口大小不会触发 pageLifetimes.show，靠窗口尺寸事件重算反缩倍率。
      // 监听必须延后注册：attached 阶段页面 load 还没结束，立刻注册容易在首帧就回调、在
      // 生命周期未落地时 setData，触发基础库的 "LifeCycle ... non-pending waiting value" 报错。
      // 只有桌面需要按窗口反缩；手机端不注册，避免每个页面实例都往 WindowInfoChanged 上挂监听
      const desktop = !!(getApp() && getApp().globalData && getApp().globalData.isDesktop)
      if (wx.onWindowResize && desktop) {
        this._onWinResize = () => this.syncDeskScale()
        this._winResizeTimer = setTimeout(() => {
          this._winResizeTimer = null
          if (this._destroyed) return
          wx.onWindowResize(this._onWinResize)
          this._winResizeListening = true
        }, 600)
      }
    },
    detached() {
      this._destroyed = true
      if (this.celebrateTimer) clearTimeout(this.celebrateTimer)
      if (this.longPressTimer) clearTimeout(this.longPressTimer)
      if (this._winResizeTimer) clearTimeout(this._winResizeTimer)
      if (this._winResizeListening && this._onWinResize && wx.offWindowResize) {
        wx.offWindowResize(this._onWinResize)
      }
      this._onWinResize = null
      this._winResizeListening = false
    }
  },
  pageLifetimes: {
    show() {
      this.syncDeskScale()
      this.refreshContext()
    }
  },
  methods: {
    // 桌面 / 大屏：rpx 会按窗口宽度放大，这里以 375 宽为基准反缩，视觉回到手机大小。
    // 只缩组件自身（fixed 浮层），不影响文档流，也不动其他页面。
    syncDeskScale() {
      let winW = 0
      try {
        winW = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth || 0
      } catch (e) {
        winW = 0
      }
      if (!winW || winW <= 480) {
        if (this.data.dockStyle) this.setData({ dockStyle: '' })
        return
      }
      // 基准 420：手机档 1.12 倍的观感，不是完全等尺寸，也不跟着窗口一起爆炸
      const k = Math.min(1, 420 / winW)
      // 桌面下 rpx 的 bottom 会被放大成几百 px，浮球飘到半空；这里同时把贴边距离改成 px
      const bottom = this.data.aboveTabbar ? 64 : 12
      const style = `left:8px; bottom:${bottom}px; transform-origin: left bottom; transform: scale(${k.toFixed(3)});`
      if (style !== this.data.dockStyle) this.setData({ dockStyle: style })
    },

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

    // 悬浮球二级菜单：进入真实工具页，不在首页复制一套内容。
    openFeature(event) {
      const key = event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.key
      if (!key) return
      this.close()
      const route = this.currentRoute()

      if (key === 'timer') {
        if (route === 'pages/index/index') {
          const pages = getCurrentPages()
          const page = pages[pages.length - 1]
          if (page && typeof page.resetToHome === 'function') page.resetToHome()
          return
        }
        wx.switchTab({ url: '/pages/index/index', fail: () => wx.showToast({ title: '切换失败，请重试', icon: 'none' }) })
        return
      }

      const quickTabs = { 'quick-stopwatch': 'stopwatch', 'quick-countdown': 'countdown', 'quick-pomodoro': 'pomodoro' }
      const quickTab = quickTabs[key]
      if (quickTab) {
        if (route === 'pages/quick/quick') {
          const pages = getCurrentPages()
          const page = pages[pages.length - 1]
          if (page && typeof page.switchTab === 'function') {
            page.switchTab({ currentTarget: { dataset: { tab: quickTab } } })
          }
          return
        }
        wx.navigateTo({ url: `/pages/quick/quick?tab=${quickTab}`, fail: () => wx.showToast({ title: '打不开快捷计时，请重试', icon: 'none' }) })
        return
      }

      const routes = {
        todo: '/pages/todo/todo',
        important: '/pages/important/important',
        stats: '/pages/stats/stats?tab=overview',
        grade: '/pages/grade/index/index'
      }
      const url = routes[key]
      if (!url) return
      const targetRoute = url.split('?')[0].replace(/^\//, '')
      if (route === targetRoute) return
      wx.navigateTo({ url, fail: () => wx.showToast({ title: '打不开页面，请重试', icon: 'none' }) })
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
