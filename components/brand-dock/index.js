const { PIN_PAGES, pinnedUrl } = require('../../utils/home-pin')

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
    dockReady: false,
    pinnedFeature: 'timer',
    featureOptions: [
      { key: 'timer', name: '训练计时' },
      { key: 'quick-stopwatch', name: '秒表' },
      { key: 'quick-countdown', name: '计时器' },
      { key: 'quick-pomodoro', name: '番茄钟' },
      { key: 'todo', name: '待办' },
      { key: 'important', name: '重要日子' },
      { key: 'stats', name: '打卡' }
    ]
  },
  lifetimes: {
    attached() {
      // 开发者工具模拟器不是真机大屏；真机 PC 才需要等宽窗尺寸稳定再露出，
      // 否则冷启动首帧读到旧窄窗宽度，球会先按大屏 rpx 放大一帧。
      this._platform = ''
      try {
        this._platform = wx.getDeviceInfo
          ? (wx.getDeviceInfo().platform || '')
          : (wx.getSystemInfoSync().platform || '')
      } catch (e) {
        this._platform = ''
      }
      this._isDesktopApp = /windows|mac/i.test(this._platform)

      this.syncDeskScale()
      this.refreshContext()

      this._scaleTimers = [
        setTimeout(() => {
          this._sizeConfirmed = true
          this.syncDeskScale()
        }, 120),
        setTimeout(() => this.syncDeskScale(), 300),
        setTimeout(() => {
          // 500ms 后仍是窄窗，说明确实是窄窗口，可以按手机档露出
          this._narrowConfirmed = true
          this.syncDeskScale()
        }, 500)
      ]

      // PC 上拖动窗口大小不会触发 pageLifetimes.show，改由组件 pageLifetimes.resize
      // 重算反缩倍率。不使用 wx.onWindowResize：macOS 基础库暴露了这个接口但调用即报
      // “SDK 暂不支持此API”，会污染控制台。
      this._winResizeTimer = setTimeout(() => {
        this._winResizeTimer = null
        if (this._destroyed) return
        this.syncDeskScale()
      }, 600)
    },
    detached() {
      this._destroyed = true
      if (this.celebrateTimer) clearTimeout(this.celebrateTimer)
      if (this.longPressTimer) clearTimeout(this.longPressTimer)
      if (this._scaleTimers) this._scaleTimers.forEach(clearTimeout)
      if (this._winResizeTimer) clearTimeout(this._winResizeTimer)
    }
  },
  pageLifetimes: {
    show() {
      this.syncDeskScale()
      this.refreshContext()
    },
    resize() {
      this.syncDeskScale()
    }
  },
  methods: {
    // 桌面 / 大屏：rpx 会按窗口宽度放大，这里以 375 宽为基准反缩，视觉回到手机大小。
    // 只缩组件自身（fixed 浮层），不影响文档流，也不动其他页面。
    syncDeskScale() {
      let winW = 0
      let screenW = 0
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        winW = info.windowWidth || 0
        screenW = info.screenWidth || 0
      } catch (e) {
        winW = 0
        screenW = 0
      }
      if (!winW) {
        try {
          const info = wx.getSystemInfoSync()
          winW = info.windowWidth || 0
          screenW = info.screenWidth || 0
        } catch (e) {
          winW = 0
        }
      }
      // 两种接口都量不到窗口宽度时退回屏幕宽度估算，保证仍按倍率露出，
      // 不会以未缩放的 rpx 尺寸突然铺在大屏上。
      if (!winW) winW = screenW
      if (!winW) {
        if (!this.data.dockReady) this.setData({ dockReady: true })
        return
      }
      if (winW <= 480) {
        // 真机 PC 冷启动偶尔先读到旧窄窗宽度：前 500ms 先不露出，
        // 等宽窗尺寸稳定后直接以最终倍率出现，避免先大后小。手机档 120ms 即露出。
        if (this._isDesktopApp && !this._narrowConfirmed && !this.data.dockStyle) return
        if (this.data.dockStyle || (this._sizeConfirmed && !this.data.dockReady)) {
          this.setData({ dockStyle: '', dockReady: true })
        }
        return
      }
      // 基准 420：手机档 1.12 倍的观感，不是完全等尺寸，也不跟着窗口一起爆炸
      const k = Math.min(1, 420 / winW)
      // 桌面下 rpx 的 bottom 会被放大成几百 px，浮球飘到半空；这里同时把贴边距离改成 px
      const bottom = this.data.aboveTabbar ? 64 : 12
      const style = `left:8px; bottom:${bottom}px; transform-origin: left bottom; transform: scale(${k.toFixed(3)});`
      if (style !== this.data.dockStyle || !this.data.dockReady) {
        this.setData({ dockStyle: style, dockReady: true })
      }
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
      const settings = app && app.getSettings ? app.getSettings() : {}

      this.setData({
        progress: Math.max(0, Math.min(100, summary.todayPercent || 0)),
        todayMinutes,
        timerRunning: !!quick.running,
        hasContinue: !!this._lastRecord,
        continueSub: this._lastRecord
          ? `${lastRows.length} 个模块 · ${last.totalActualText || '上次训练'}`
          : '',
        todoSub: pendingTodos ? `${pendingTodos} 项待完成` : '今天没有待办',
        pinnedFeature: settings.pinnedFeature || 'timer'
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

    // 悬浮球二级菜单：点某个模块＝把这个「首页」指向对应真实页面。
    // 只存一个目标地址，首页不复制任何页面内容，也不新建页面。
    switchFeature(event) {
      const key = event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.key
      if (!key) return
      const app = getApp()
      if (!app || !app.saveSettings || !PIN_PAGES[key]) {
        wx.showToast({ title: '暂不支持', icon: 'none', duration: 1200 })
        return
      }
      app.saveSettings({ pinnedFeature: key })
      this.setData({ pinnedFeature: key })
      this.close()
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })

      const url = pinnedUrl(key)
      const target = url.split('?')[0]
      const route = this.currentRoute()

      // 快捷计时三项由首页本体的 quick-panel 渲染；固定后回首页，dock 不丢
      if (key.indexOf('quick-') === 0) {
        if (route === 'pages/index/index') {
          const pages = getCurrentPages()
          const page = pages[pages.length - 1]
          if (page && typeof page.applyPinnedFeature === 'function') page.applyPinnedFeature(key)
          return
        }
        wx.switchTab({ url: '/pages/index/index', fail: () => {} })
        return
      }

      if (target === 'pages/index/index') {
        if (route === 'pages/index/index') {
          const pages = getCurrentPages()
          const page = pages[pages.length - 1]
          // 从快捷面板切回训练计时时，必须同步清掉 pinnedQuickTab，否则首页还停在旧面板
          if (page && typeof page.applyPinnedFeature === 'function') page.applyPinnedFeature(key)
          if (page && typeof page.resetToHome === 'function') page.resetToHome()
        } else {
          wx.switchTab({ url, fail: () => {} })
        }
        return
      }
      if (route === target) {
        // 已经在目标页：秒表 / 计时器 / 番茄钟之间只切页内 tab，不再压一个新页面
        if (target === 'pages/quick/quick') {
          const pages = getCurrentPages()
          const page = pages[pages.length - 1]
          const tab = key.replace('quick-', '')
          if (page && typeof page.switchTab === 'function' && page.data.tab !== tab) {
            page.switchTab({ currentTarget: { dataset: { tab } } })
          }
        }
        return
      }
      // 固定首页＝把这个真实页面设为根页面，不压新页面；返回也不会回到原首页
      wx.reLaunch({
        url,
        fail: () => wx.switchTab({ url: '/pages/index/index', fail: () => {} })
      })
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
