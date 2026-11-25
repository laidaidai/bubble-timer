const app = getApp()
const { pad, CLOCK_STYLES, LED_PATTERNS, resolveClockStyle } = require('../../utils/format')
const { computeQuickSlot, fitScale } = require('../../utils/clock-layout')

const PRESETS = [
  { minutes: 10, label: '10 分钟' },
  { minutes: 20, label: '20 分钟' },
  { minutes: 30, label: '30 分钟' },
  { minutes: 60, label: '1 小时' },
  { minutes: 120, label: '2 小时' },
  { minutes: 180, label: '3 小时' }
]
const PRESET_STATS_KEY = 'exam-timer-quick-preset-stats'
const QUICK_STATE_KEY = 'exam-timer-quick-state'
const PICKER_COPIES = 5
const PICKER_CENTER = 2
const buildPickerOptions = count => Array.from({ length: count * PICKER_COPIES }, (_, i) => ({
  key: i,
  value: i % count,
  label: pad(i % count)
}))
const HOUR_OPTIONS = buildPickerOptions(24)
const MINUTE_OPTIONS = buildPickerOptions(60)
const SECOND_OPTIONS = buildPickerOptions(60)
// 番茄钟整条链路统一用毫秒：页面里 formatTimerParts / 首页共享状态 / stopwatch 都是毫秒，
// 之前这里写的是秒，导致恢复后把 1500（秒）当 1500ms 显示成 00:01.50。
const POMODORO_FOCUS = 25 * 60 * 1000
const POMODORO_REST = 5 * 60 * 1000
const POMODORO_LONG_REST = 15 * 60 * 1000
const POMODORO_LONG_EVERY = 4


function formatStopwatch(ms) {
  const total = Math.max(0, ms)
  const hours = Math.floor(total / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const hundredths = Math.floor((total % 1000) / 10)
  return {
    // 不足 1 小时：分:秒 + 毫秒；毫秒始终显示，默认就是 00:00.00，不会退回 5 位
    // 满 1 小时：时:分:秒，毫秒收起，把宽度让给小时
    main: hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`,
    ms: pad(hundredths)
  }
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

// 倒计时 / 番茄钟：主时间用剩余秒数，毫秒单独保留两位
function formatTimerParts(ms) {
  const total = Math.max(0, ms)
  const totalSeconds = Math.floor(total / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const hundredths = Math.floor((total % 1000) / 10)
  return {
    // 与秒表同一口径：不足 1 小时显示「分:秒.毫秒」，满 1 小时显示「时:分:秒」
    main: hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`,
    ms: pad(hundredths),
    totalSeconds
  }
}

Component({
  options: { addGlobalClass: true },
  properties: {
    // 首页「固定」面板用它决定落在哪个页签：stopwatch / countdown / pomodoro
    startTab: { type: String, value: '' }
  },

  data: {
      // 首帧就按当前设备与主题渲染，避免桌面上先闪一下手机版顶栏 / 默认配色
      isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
      theme: (getApp() && getApp().getTheme && getApp().getTheme().key) || 'sky',
      themeStyle: (getApp() && getApp().getThemeStyle && getApp().getThemeStyle()) || '',
      tab: 'stopwatch',
      running: false,
      countdownStarted: false,
      sessionStarted: false,
      mainText: '00:00',
      msText: '00',
      mainSeconds: 0,
      presets: PRESETS,
      selectedPreset: 30,
      recommended: 30,
      hourOptions: HOUR_OPTIONS,
      minuteOptions: MINUTE_OPTIONS,
      secondOptions: SECOND_OPTIONS,
      pickerValue: [PICKER_CENTER * 24, PICKER_CENTER * 60 + 30, PICKER_CENTER * 60],
      pomodoroPhase: 'focus',
      pomodoroCycle: 1,
      pomodoroPhaseTotal: POMODORO_FOCUS,
      clockStyle: 'flip',
      clockStyleName: '翻页时钟',
      clockHintShow: false,
      clockHintText: '轻点时钟切换样式',
      clockStyles: CLOCK_STYLES,
      clockData: {},
      clockBoxStyle: '',
      clockSlotH: 0,
      clockFitVars: '',
      clockReady: false,
      indicatorStyle: 'height: 88rpx',
      laps: [],
      finishBurst: false,
      finishBubbles: []
    },

  observers: {
    'startTab'(value) {
      // 首次挂载由 attached 处理，这里只管「已经在首页显示时又换了固定项」
      if (!this._ready) return
      if (!value || ['stopwatch', 'countdown', 'pomodoro'].indexOf(value) < 0) return
      if (value === this.data.tab) return
      this.setData({ tab: value, running: false, sessionStarted: false })
      this.applyModeState(value)
      this.syncClockBox && this.syncClockBox()
    }
  },

  lifetimes: {
    attached() {
      const options = { tab: this.data.startTab || '' }
    // 宽窗口（PC 微信 / 开发者工具宽窗口）rpx 会被放大成"整套巨大"，
    // 这里补一层按窗口宽度的判断：即使平台探测失败也走桌面档 px
    let winW = 0
    try { winW = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth || 0 } catch (e) { winW = 0 }
    const isDesktop = !!(getApp().globalData && getApp().globalData.isDesktop) || winW > 600
    this.setData({
      isDesktop,
      // picker-view 的指示框只能内联给，桌面下按 px 给，避免 rpx 被窗口放大
      indicatorStyle: isDesktop ? 'height: 76px' : 'height: 88rpx'
    })
    this.autoStartRequested = !!(options && options.autostart === '1')
    this.dockToggleRequested = !!(options && options.docktoggle === '1')
    this.dockPauseRequested = !!(options && options.dockpause === '1')
    this.syncTheme()
    // 每个页面生命周期只提示一次，3.2s 后自动收走，不常驻
    if (!this.clockHintShown) {
      this.clockHintShown = true
      clearTimeout(this.hintIntroTimer)
      this.hintIntroTimer = setTimeout(() => this.showClockHint('轻点时钟切换样式', 3200), 900)
    }
    const savedStyle = wx.getStorageSync(app.globalData.clockStyleKey)
    const style = resolveClockStyle(savedStyle)
    this.setData({ clockStyle: style.key, clockStyleName: style.name })
    this.flipPhase = false
    this.modeStates = {}
    this.loadPresetRecommendation()
    const saved = this.readQuickState()
    if (saved) {
      this.restoreQuickState(saved, options.tab)
    } else {
      const preset = this.data.selectedPreset || 30
      this.setCountdown(preset * 60 * 1000)
      this.resetPomodoro()
      this.setStopwatch(0, false)
    }
    const requested = options && options.tab
    if (requested && ['stopwatch', 'countdown', 'pomodoro'].indexOf(requested) >= 0 && requested !== this.data.tab) {
      this.setData({ tab: requested, running: false, sessionStarted: false })
      this.applyModeState(requested)
    }
  

      // 首页直接挂载时，页面不会触发 show，这里补一次尺寸与节拍
      this.syncTheme && this.syncTheme()
      this.syncClockBox && this.syncClockBox()
      if (this.data.running) this.startTicker && this.startTicker()
      this.syncKeepScreenOn(this.data.running)
      this._ready = true
    },
    detached() {
    this.saveQuickState()
    this.stopTicker()
    this.syncKeepScreenOn(false)
    if (this.finishBurstTimer) clearTimeout(this.finishBurstTimer)
    if (this.clockFitTimer) clearTimeout(this.clockFitTimer)
    if (this.clockFitVerifyTimer) clearTimeout(this.clockFitVerifyTimer)
  
    }
  },

  pageLifetimes: {
    show() {
    // 从横屏计时页回来后，强制回到竖屏基准，避免整页 rpx 被放大
    if (wx.setDeviceOrientation) {
      clearTimeout(this.portraitTimer)
      this.portraitTimer = setTimeout(() => {
        wx.setDeviceOrientation({ value: 'portrait', fail: () => {} })
      }, 40)
    }
    this.syncTheme()
    this.syncClockBox()
    this.loadPresetRecommendation()
    if (this.data.running) this.startTicker()
    this.syncKeepScreenOn(this.data.running)
    if (this.dockPauseRequested) {
      this.dockPauseRequested = false
      this.autoStartRequested = false
      this.pause()
      return
    }
    if (this.dockToggleRequested) {
      this.dockToggleRequested = false
      this.autoStartRequested = false
      this.toggleRun()
      return
    }
    if (this.autoStartRequested) {
      this.autoStartRequested = false
      if (!this.data.running) this.start()
    }
  
    },
    hide() {
    this.saveQuickState()
    this.stopTicker()
    this.syncKeepScreenOn(false)
    },
    resize() {
    // 窗口从手机宽度拉到桌面宽度时，组件也要从 rpx 档切到 px 档，
    // 否则内嵌的快捷计时仍会按手机版等比放大。
    const app = getApp()
    let winW = 0
    try { winW = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth || 0 } catch (e) { winW = 0 }
    const desktop = (app && app.detectEnvironment
      ? app.detectEnvironment()
      : !!(app && app.globalData && app.globalData.isDesktop)) || winW > 600
    const indicatorStyle = desktop ? 'height: 76px' : 'height: 88rpx'
    if (desktop !== this.data.isDesktop || indicatorStyle !== this.data.indicatorStyle) {
      this.setData({ isDesktop: desktop, indicatorStyle }, () => this.syncClockBox())
    } else {
      this.syncClockBox()
    }
    }
  },

  methods: {
    readQuickState() {
        try {
          const saved = wx.getStorageSync(QUICK_STATE_KEY)
          return saved && typeof saved === 'object' && saved.version === 2 ? saved : null
        } catch (e) {
          return null
        }
      },

    saveQuickState() {
        if (!this.data || !this.data.tab) return
        const now = Date.now()
        const tab = this.data.tab
        const running = !!this.data.running
        let stopwatchMs = Math.max(0, this.stopwatchMs || 0)
        let stopwatchStartedAt = 0
        if (tab === 'stopwatch' && running && this.stopwatchStartedAt) {
          stopwatchStartedAt = this.stopwatchStartedAt
          stopwatchMs = Math.max(0, now - stopwatchStartedAt)
        }
        let countdownRemaining = Math.max(0, this.countdownRemaining || 0)
        let countdownEndAt = tab === 'countdown' && running ? (this.countdownEndAt || 0) : 0
        if (countdownEndAt) countdownRemaining = Math.max(0, countdownEndAt - now)
        let pomodoroRemaining = Math.max(0, this.pomodoroRemaining || 0)
        let pomodoroEndAt = tab === 'pomodoro' && running ? (this.pomodoroEndAt || 0) : 0
        if (pomodoroEndAt) pomodoroRemaining = Math.max(0, pomodoroEndAt - now)
        const state = {
          version: 2,
          savedAt: now,
          tab,
          running,
          clockStyle: this.data.clockStyle,
          countdownStarted: !!this.data.countdownStarted,
          sessionStarted: !!this.data.sessionStarted,
          selectedPreset: this.data.selectedPreset || 30,
          lastSetMs: this.lastSetMs || (this.data.selectedPreset || 30) * 60000,
          stopwatchMs,
          stopwatchStartedAt,
          countdownRemaining,
          countdownEndAt,
          pomodoroPhase: this.pomodoroPhase || 'focus',
          pomodoroCycle: this.pomodoroCycle || 1,
          pomodoroPhaseTotal: this.pomodoroPhaseTotal || POMODORO_FOCUS,
          pomodoroRemaining,
          pomodoroEndAt,
          laps: Array.isArray(this.data.laps) ? this.data.laps : [],
          lapNo: this.lapNo || 0,
          lastLapMs: this.lastLapMs || 0,
          modeStates: this.modeStates || {}
        }
        try { wx.setStorageSync(QUICK_STATE_KEY, state) } catch (e) {}
      },

    restoreQuickState(saved, forcedTab) {
        const now = Date.now()
        this.modeStates = saved.modeStates && typeof saved.modeStates === 'object' ? saved.modeStates : {}
        const requested = forcedTab && ['stopwatch', 'countdown', 'pomodoro'].indexOf(forcedTab) >= 0 ? forcedTab : ''
        const savedTab = ['stopwatch', 'countdown', 'pomodoro'].includes(saved.tab) ? saved.tab : 'stopwatch'
        const tab = requested || savedTab
        // 首页固定的页签优先；只有存的也是同一个页签时才恢复“正在计时”
        const running = !!saved.running && tab === savedTab
        this.stopwatchMs = Math.max(0, Number(saved.stopwatchMs) || 0)
        this.stopwatchStartedAt = tab === 'stopwatch' && running ? (Number(saved.stopwatchStartedAt) || 0) : 0
        this.lastSetMs = Math.max(0, Number(saved.lastSetMs) || 0)
        this.countdownRemaining = Math.max(0, Number(saved.countdownRemaining) || 0)
        this.countdownEndAt = tab === 'countdown' && running ? (Number(saved.countdownEndAt) || 0) : 0
        this.pomodoroPhase = saved.pomodoroPhase === 'rest' ? 'rest' : 'focus'
        this.pomodoroCycle = Math.max(1, Number(saved.pomodoroCycle) || 1)
        let phaseTotal = Math.max(1, Number(saved.pomodoroPhaseTotal) || POMODORO_FOCUS)
        let savedRemaining = Number(saved.pomodoroRemaining)
        // 旧版本把番茄钟按“秒”存（1500 / 300 / 900），这里换算成毫秒，避免读出来变成 00:01.50
        if (phaseTotal < 60000) {
          phaseTotal *= 1000
          if (Number.isFinite(savedRemaining)) savedRemaining *= 1000
        }
        this.pomodoroPhaseTotal = phaseTotal
        this.pomodoroRemaining = Number.isFinite(savedRemaining) ? Math.max(0, savedRemaining) : this.pomodoroPhaseTotal
        this.pomodoroEndAt = tab === 'pomodoro' && running ? (Number(saved.pomodoroEndAt) || 0) : 0
        this.lapNo = Math.max(0, Number(saved.lapNo) || 0)
        this.lastLapMs = Math.max(0, Number(saved.lastLapMs) || 0)
        const selectedPreset = Math.max(1, Number(saved.selectedPreset) || 30)
        this.setData({
          tab,
          running: false,
          countdownStarted: !!saved.countdownStarted,
          sessionStarted: !!saved.sessionStarted,
          selectedPreset,
          laps: Array.isArray(saved.laps) ? saved.laps : []
        })
    
        if (tab === 'stopwatch') {
          if (running) {
            if (!this.stopwatchStartedAt) this.stopwatchStartedAt = now - this.stopwatchMs
            this.stopwatchMs = Math.max(0, now - this.stopwatchStartedAt)
          }
          this.setStopwatch(this.stopwatchMs, running)
          return
        }
    
        if (tab === 'countdown') {
          this.restoreCountdown(saved, running, now, selectedPreset)
          return
        }
    
        this.restorePomodoro(saved, running, now)
      },

    restoreCountdown(saved, running, now, selectedPreset) {
        if (running && this.countdownEndAt) {
          const remaining = this.countdownEndAt - now
          const finished = remaining <= 0
          this.countdownRemaining = Math.max(0, remaining)
          const parts = formatTimerParts(finished ? 0 : this.countdownRemaining)
          this.setData({
            mainSeconds: parts.totalSeconds,
            running: !finished,
            countdownStarted: true,
            sessionStarted: !finished,
            ...this.buildClockPayload(parts.main, undefined, parts.ms)
          })
          if (finished) this.countdownEndAt = 0
          return
        }
        if (saved.countdownStarted) {
          const remaining = this.countdownRemaining
          this.setData({
            mainSeconds: Math.floor(remaining / 1000),
            running: false,
            countdownStarted: true,
            ...this.buildClockPayload(formatTimerParts(remaining).main, undefined, formatTimerParts(remaining).ms)
          })
          return
        }
        this.setCountdown(this.lastSetMs || selectedPreset * 60000)
      },

    restorePomodoro(saved, running, now) {
        const phase = this.pomodoroPhase
        const cycle = this.pomodoroCycle
        const phaseTotal = this.pomodoroPhaseTotal
        if (running && this.pomodoroEndAt) {
          const remaining = this.pomodoroEndAt - now
          const finished = remaining <= 0
          this.pomodoroRemaining = Math.max(0, remaining)
          const parts = formatTimerParts(finished ? 0 : this.pomodoroRemaining)
          this.setData({
            pomodoroPhase: phase,
            pomodoroCycle: cycle,
            pomodoroPhaseTotal: phaseTotal,
            mainSeconds: parts.totalSeconds,
            running: !finished,
            sessionStarted: !finished,
            ...this.buildClockPayload(parts.main, undefined, parts.ms)
          })
          if (finished) this.pomodoroEndAt = 0
          return
        }
        const remaining = this.pomodoroRemaining
        this.setData({
          pomodoroPhase: phase,
          pomodoroCycle: cycle,
          pomodoroPhaseTotal: phaseTotal,
          mainSeconds: Math.floor(remaining / 1000),
          running: false,
          sessionStarted: !!saved.sessionStarted,
          ...this.buildClockPayload(formatTimerParts(remaining).main, undefined, formatTimerParts(remaining).ms)
        })
      },

    // 时钟位数 / 毫秒显隐变化时重新适配容器，避免 00:00.00 ↔ 1:00:00 横向溢出
    noteClockShape(mainText, msShow) {
      const shape = `${String(mainText || '').length}:${msShow ? 1 : 0}`
      if (shape === this.clockShape) return
      this.clockShape = shape
      this.scheduleClockFit()
    },

    scheduleClockFit() {
      clearTimeout(this.clockFitTimer)
      this.clockFitTimer = setTimeout(() => {
        this.clockFitTimer = null
        if (this._destroyed) return
        this.syncClockBox()
      }, 80)
    },

    syncClockBox() {
      let winW = 375
      let winH = 667
      try {
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        winW = info.windowWidth || 375
        winH = info.windowHeight || 667
      } catch (e) {}
      const desk = !!(getApp().globalData && getApp().globalData.isDesktop)
      const slot = computeQuickSlot(winW, winH, desk)
      const run = () => this.fitQuickClock(slot.h, desk)
      if (slot.h !== this.data.clockSlotH) this.setData({ clockSlotH: slot.h }, run)
      else run()
      // 首帧选择器可能拿不到尺寸；至少先把时钟显示出来，倍率随后再修
      if (!this.data.clockReady) this.setData({ clockReady: true })
    },

    // 时钟统一缩进「固定高度的容器」：换皮肤时容器不变，卡片/按钮不会跟着跳
    fitQuickClock(slotH, desk) {
      const query = wx.createSelectorQuery().in(this)
      query.select('.q-clock-slot').boundingClientRect()
      query.select('.q-clock-shell').boundingClientRect()
      query.exec((res) => {
        const slot = res[0]
        const shell = res[1]
        if (!slot || !slot.width || !shell || !shell.width || !shell.height) return
        const current = this.clockFit || 1
        const naturalW = shell.width / current
        const naturalH = shell.height / current
        const fit = fitScale(slot.width, slotH || slot.height, naturalW, naturalH, { max: desk ? 2.6 : 1.6 })
        if (Math.abs(fit - current) < 0.02) {
          if (!this.data.clockReady) this.setData({ clockReady: true })
          return
        }
        this.clockFit = fit
        const vars = Math.abs(fit - 1) < 0.02 ? '' : `--q-fit: ${fit};`
        if (vars !== this.data.clockFitVars || !this.data.clockReady) {
          this.setData({ clockFitVars: vars, clockReady: true }, () => this.scheduleFitVerify(slotH, desk))
        }
      })
    },

    // setData 写入 zoom 后，下一帧才拿到真实宽度；再算一次让倍率收敛，避免越算越偏
    scheduleFitVerify(slotH, desk) {
      clearTimeout(this.clockFitVerifyTimer)
      this.clockFitVerifyTimer = setTimeout(() => {
        if (this._destroyed) return
        this.fitQuickClock(slotH, desk)
      }, 120)
    },

    syncTheme() {
        const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
        this.setData({ theme: theme.key, themeStyle: theme.style || '' })
        if (app.applyNavBar) app.applyNavBar()
      },

    loadPresetRecommendation() {
        let stats = {}
        try {
          stats = wx.getStorageSync(PRESET_STATS_KEY) || {}
        } catch (e) {
          stats = {}
        }
        let recommended = 30
        let max = 0
        PRESETS.forEach(item => {
          const count = Number(stats[item.minutes] || 0)
          if (count > max) {
            max = count
            recommended = item.minutes
          }
        })
        if (max === 0) recommended = 30
        if (!this.started) {
          this.setData({ recommended, selectedPreset: recommended }, () => {
            if (this.data.tab === 'countdown') this.setCountdown(recommended * 60000)
          })
          this.started = true
        } else {
          this.setData({
            recommended,
            presets: this.data.presets.map(item => ({ ...item, recommended: item.minutes === recommended }))
          })
        }
      },

    switchTab(event) {
        const tab = event.currentTarget.dataset.tab
        if (tab === this.data.tab) return
        this.stopTicker()
        this.modeStates[this.data.tab] = this.captureModeState(this.data.tab)
        this.setData({ tab, running: false, sessionStarted: false })
        this.applyModeState(tab)
        if (this.data.running) this.startTicker()
        this.syncKeepScreenOn(this.data.running)
        this.saveQuickState()
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      },

    captureModeState(tab) {
        const now = Date.now()
        if (tab === 'stopwatch') {
          let ms = Math.max(0, this.stopwatchMs || 0)
          if (this.data.running && this.stopwatchStartedAt) ms = Math.max(0, now - this.stopwatchStartedAt)
          return {
            running: !!this.data.running,
            stopwatchStartedAt: this.data.running ? this.stopwatchStartedAt : 0,
            stopwatchMs: ms,
            sessionStarted: !!this.data.sessionStarted || ms > 0,
            laps: Array.isArray(this.data.laps) ? this.data.laps : [],
            lapNo: this.lapNo || 0,
            lastLapMs: this.lastLapMs || 0
          }
        }
        if (tab === 'countdown') {
          let remaining = Math.max(0, this.countdownRemaining || 0)
          if (this.data.running && this.countdownEndAt) remaining = Math.max(0, this.countdownEndAt - now)
          return {
            running: !!this.data.running,
            countdownEndAt: this.data.running ? this.countdownEndAt : 0,
            countdownRemaining: remaining,
            countdownStarted: !!this.data.countdownStarted,
            sessionStarted: !!this.data.sessionStarted,
            lastSetMs: this.lastSetMs || remaining || (this.data.selectedPreset || 30) * 60000
          }
        }
        let remaining = Math.max(0, this.pomodoroRemaining || 0)
        if (this.data.running && this.pomodoroEndAt) remaining = Math.max(0, this.pomodoroEndAt - now)
        return {
          running: !!this.data.running,
          pomodoroEndAt: this.data.running ? this.pomodoroEndAt : 0,
          pomodoroPhase: this.pomodoroPhase || 'focus',
          pomodoroCycle: this.pomodoroCycle || 1,
          pomodoroPhaseTotal: this.pomodoroPhaseTotal || POMODORO_FOCUS,
          pomodoroRemaining: remaining,
          sessionStarted: !!this.data.sessionStarted
        }
      },

    applyModeState(tab) {
        const saved = this.modeStates[tab]
        if (tab === 'stopwatch') {
          const running = !!(saved && saved.running)
          this.lapNo = saved ? Math.max(0, Number(saved.lapNo) || 0) : 0
          this.lastLapMs = saved ? Math.max(0, Number(saved.lastLapMs) || 0) : 0
          this.setData({ laps: saved && Array.isArray(saved.laps) ? saved.laps : [] })
          if (running) {
            this.stopwatchStartedAt = Number(saved.stopwatchStartedAt) || (Date.now() - Math.max(0, Number(saved.stopwatchMs) || 0))
            this.stopwatchMs = Math.max(0, Date.now() - this.stopwatchStartedAt)
          } else {
            this.stopwatchStartedAt = 0
            this.stopwatchMs = saved ? Math.max(0, Number(saved.stopwatchMs) || 0) : 0
          }
          this.setStopwatch(this.stopwatchMs, running)
          return
        }
    
        if (tab === 'countdown') {
          if (!saved) {
            this.setCountdown(this.lastSetMs || (this.data.selectedPreset || 30) * 60000)
            return
          }
          const lastSetMs = Math.max(0, Number(saved.lastSetMs) || 0) || this.lastSetMs
          this.lastSetMs = lastSetMs
          if (saved.running && saved.countdownEndAt) {
            const remaining = Math.max(0, Number(saved.countdownEndAt) - Date.now())
            const finished = remaining <= 0
            this.countdownRemaining = remaining
            this.countdownEndAt = finished ? 0 : saved.countdownEndAt
            const parts = formatTimerParts(finished ? 0 : remaining)
            this.setData({
              mainSeconds: parts.totalSeconds,
              running: !finished,
              countdownStarted: true,
              sessionStarted: !finished,
              ...this.buildClockPayload(parts.main, undefined, parts.ms)
            })
            return
          }
          const remaining = Math.max(0, Number(saved.countdownRemaining) || 0)
          this.countdownRemaining = remaining
          if (saved.countdownStarted) {
            const parts = formatTimerParts(remaining)
            this.setData({
              mainSeconds: parts.totalSeconds,
              running: false,
              countdownStarted: true,
              sessionStarted: !!saved.sessionStarted,
              ...this.buildClockPayload(parts.main, undefined, parts.ms)
            })
          } else {
            this.setCountdown(lastSetMs || (this.data.selectedPreset || 30) * 60000)
          }
          return
        }
    
        if (!saved) {
          this.resetPomodoro()
          return
        }
        this.pomodoroPhase = saved.pomodoroPhase === 'rest' ? 'rest' : 'focus'
        this.pomodoroCycle = Math.max(1, Number(saved.pomodoroCycle) || 1)
        let phaseTotal = Math.max(1, Number(saved.pomodoroPhaseTotal) || POMODORO_FOCUS)
        let savedRemaining = Number(saved.pomodoroRemaining)
        // 旧版本把番茄钟按“秒”存（1500 / 300 / 900），这里换算成毫秒，避免读出来变成 00:01.50
        if (phaseTotal < 60000) {
          phaseTotal *= 1000
          if (Number.isFinite(savedRemaining)) savedRemaining *= 1000
        }
        this.pomodoroPhaseTotal = phaseTotal
        this.pomodoroRemaining = Number.isFinite(savedRemaining) ? Math.max(0, savedRemaining) : this.pomodoroPhaseTotal
        if (saved.running && saved.pomodoroEndAt) {
          const remaining = Math.max(0, Number(saved.pomodoroEndAt) - Date.now())
          const finished = remaining <= 0
          this.pomodoroRemaining = remaining
          this.pomodoroEndAt = finished ? 0 : saved.pomodoroEndAt
          const parts = formatTimerParts(finished ? 0 : remaining)
          this.setData({
            pomodoroPhase: this.pomodoroPhase,
            pomodoroCycle: this.pomodoroCycle,
            pomodoroPhaseTotal: this.pomodoroPhaseTotal,
            mainSeconds: parts.totalSeconds,
            running: !finished,
            sessionStarted: !finished,
            ...this.buildClockPayload(parts.main, undefined, parts.ms)
          })
          return
        }
        this.pomodoroEndAt = 0
        const parts = formatTimerParts(this.pomodoroRemaining)
        this.setData({
          pomodoroPhase: this.pomodoroPhase,
          pomodoroCycle: this.pomodoroCycle,
          pomodoroPhaseTotal: this.pomodoroPhaseTotal,
          mainSeconds: parts.totalSeconds,
          running: false,
          sessionStarted: !!saved.sessionStarted,
          ...this.buildClockPayload(parts.main, undefined, parts.ms)
        })
      },

    setStopwatch(ms, running) {
        const text = formatStopwatch(ms)
        this.stopwatchMs = Math.max(0, ms)
        const showMs = text.main.length <= 5
        const payload = text.main !== this.lastClockText ? this.buildClockPayload(text.main, undefined, text.ms) : {}
        const msCells = showMs ? text.ms.split('').map((char, index) => ({
          key: `q-ms-${index}`,
          text: char,
          segs: LED_PATTERNS[char] || [0, 0, 0, 0, 0, 0, 0]
        })) : []
        this.setData({
          msText: showMs ? text.ms : '',
          running: !!running,
          sessionStarted: ms > 0,
          mainSeconds: Math.floor(ms / 1000),
          'clockData.msShow': showMs,
          'clockData.msText': showMs ? text.ms : '',
          'clockData.msCells': msCells,
          ...payload
        })
      },

    setCountdown(ms, syncPicker = true) {
        const safeMs = Math.max(0, ms)
        this.countdownRemaining = safeMs
        this.lastSetMs = safeMs
        const parts = formatTimerParts(safeMs)
        this.setData({
          mainSeconds: parts.totalSeconds,
          running: false,
          countdownStarted: false,
          sessionStarted: false,
          ...this.buildClockPayload(parts.main, undefined, parts.ms)
        })
        if (syncPicker) this.syncPicker(safeMs)
      },

    syncPicker(ms) {
        const totalSeconds = Math.floor(Math.max(0, ms) / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60
        this.setData({ pickerValue: [
          PICKER_CENTER * 24 + (hours % 24),
          PICKER_CENTER * 60 + minutes,
          PICKER_CENTER * 60 + seconds
        ] })
      },

    onTimeChange(event) {
        const value = (event.detail && event.detail.value) || []
        const old = this.data.pickerValue || []
        if (old[0] === value[0] && old[1] === value[1] && old[2] === value[2]) return
        this.vibrateAdjust()
        const fields = [
          { options: this.data.hourOptions, count: 24 },
          { options: this.data.minuteOptions, count: 60 },
          { options: this.data.secondOptions, count: 60 }
        ]
        const actual = fields.map((field, column) => {
          const index = Number(value[column] || 0)
          const option = field.options[index]
          return option ? option.value : index % field.count
        })
        const [hours, minutes, seconds] = actual
        const recenter = fields.map((field, column) => {
          const index = Number(value[column] || 0)
          const start = PICKER_CENTER * field.count
          const end = start + field.count
          return index < start || index >= end ? start + actual[column] : index
        })
        const matched = seconds === 0 ? PRESETS.find(item => item.minutes === hours * 60 + minutes) : null
        this.setData({ pickerValue: recenter, selectedPreset: matched ? matched.minutes : 0 })
        this.setCountdown((hours * 3600 + minutes * 60 + seconds) * 1000, false)
      },

    vibrateAdjust() {
        if (!wx.vibrateShort) return
        wx.vibrateShort({ type: 'light', fail: () => {} })
      },

    selectPreset(event) {
        if (this.data.running) return
        const minutes = Number(event.currentTarget.dataset.minutes)
        if (!minutes) return
        this.setData({ selectedPreset: minutes })
        this.vibrateAdjust()
        this.setCountdown(minutes * 60000)
      },

    // 计时中跟随「设置 → 专注 → 屏幕常亮」；暂停 / 离开首页立即释放。
    // 独立快捷页和首页内嵌面板共用同一份设置，两个入口手感一致。
    syncKeepScreenOn(running) {
        if (!wx.setKeepScreenOn) return
        let allow = true
        try {
          const settings = app.getSettings ? app.getSettings() : null
          if (settings && settings.keepScreenOn === false) allow = false
        } catch (error) { /* 设置读不到时按默认常亮处理 */ }
        const keep = !!running && allow
        if (this._keepScreenOn === keep) return
        this._keepScreenOn = keep
        wx.setKeepScreenOn({ keepScreenOn: keep, fail: () => {} })
      },

    toggleRun() {
        if (this.data.running) {
          this.pause()
        } else {
          this.start()
        }
      },

    start() {
        if (wx.vibrateShort) wx.vibrateShort({ type: 'medium', fail: () => {} })
        if (this.data.tab === 'stopwatch') {
          this.stopwatchStartedAt = Date.now() - (this.stopwatchMs || 0)
          this.tickMode = 'stopwatch'
          this.setData({ running: true, sessionStarted: true })
          this.startTicker()
          this.syncKeepScreenOn(true)
          return
        }
        if (this.data.tab === 'pomodoro') {
          this.pomodoroEndAt = Date.now() + Math.max(0, this.pomodoroRemaining || 0)
          this.setData({ running: true, sessionStarted: true })
          this.startTicker()
          this.syncKeepScreenOn(true)
          return
        }
        if (!this.countdownRemaining) {
          const fallback = this.lastSetMs
          if (!fallback) {
            wx.showToast({ title: '请先选择时间', icon: 'none' })
            return
          }
          this.setCountdown(fallback)
        }
        this.countdownEndAt = Date.now() + this.countdownRemaining
        this.tickMode = 'countdown'
        this.recordPresetUse(this.data.selectedPreset)
        this.setData({ running: true, countdownStarted: true, sessionStarted: true })
        this.startTicker()
        this.syncKeepScreenOn(true)
      },

    pause() {
        if (this.data.tab === 'stopwatch') {
          this.setData({ running: false })
        } else if (this.data.tab === 'pomodoro') {
          this.setData({ running: false })
        } else {
          this.setData({ running: false })
          this.syncPicker(this.countdownRemaining)
        }
        this.stopTicker()
        this.syncKeepScreenOn(false)
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      },

    reset() {
        this.stopTicker()
        this.syncKeepScreenOn(false)
        if (wx.vibrateShort) wx.vibrateShort({ type: 'medium', fail: () => {} })
        if (this.data.tab === 'stopwatch') {
          this.clearLaps()
          this.setStopwatch(0, false)
        } else if (this.data.tab === 'pomodoro') {
          this.resetPomodoro()
        } else {
          this.setCountdown(this.lastSetMs || (this.data.selectedPreset || 30) * 60000)
        }
      },

    startTicker() {
        this.stopTicker()
        this.ticker = setInterval(() => this.tick(), 16)
        this.tick()
      },

    stopTicker() {
        if (this.ticker) clearInterval(this.ticker)
        this.ticker = null
      },

    playFinishBurst() {
        const bubbles = Array.from({ length: 14 }).map((_, index) => ({
          id: index,
          x: 14 + Math.round(Math.random() * 72),
          size: 10 + Math.round(Math.random() * 16),
          delay: index * 26,
          duration: 820 + Math.round(Math.random() * 320),
          tone: index % 3
        }))
        clearTimeout(this.finishBurstTimer)
        this.setData({ finishBurst: true, finishBubbles: bubbles })
        this.finishBurstTimer = setTimeout(() => {
          this.finishBurstTimer = null
          this.setData({ finishBurst: false })
        }, 1050)
      },

    tick() {
        if (!this.data.running) return
        if (this.data.tab === 'stopwatch') {
          this.setStopwatch(Date.now() - this.stopwatchStartedAt, true)
          return
        }
        if (this.data.tab === 'pomodoro') {
          this.tickPomodoro()
          return
        }
        const remaining = this.countdownEndAt - Date.now()
        if (remaining <= 0) {
          this.stopTicker()
          this.syncKeepScreenOn(false)
          this.countdownRemaining = 0
          this.setData({ mainSeconds: 0, running: false, countdownStarted: true, sessionStarted: false, ...this.buildClockPayload('00:00', undefined, '00') })
          if (wx.vibrateLong) wx.vibrateLong({ fail: () => {} })
          if (app.playRing) app.playRing()
          wx.showToast({ title: '时间到', icon: 'none', duration: 2000 })
          this.playFinishBurst()
          return
        }
        this.countdownRemaining = remaining
        const parts = formatTimerParts(remaining)
        this.setData({
          mainSeconds: parts.totalSeconds,
          ...(parts.main !== this.lastClockText ? this.buildClockPayload(parts.main, undefined, parts.ms) : this.clockMsPatch(parts.ms))
        })
      },

    resetPomodoro() {
        this.pomodoroPhase = 'focus'
        this.pomodoroCycle = 1
        this.pomodoroPhaseTotal = POMODORO_FOCUS
        this.pomodoroRemaining = POMODORO_FOCUS
        this.pomodoroEndAt = 0
        const parts = formatTimerParts(POMODORO_FOCUS)
        this.setData({
          pomodoroPhase: 'focus',
          pomodoroCycle: 1,
          pomodoroPhaseTotal: POMODORO_FOCUS,
          mainSeconds: parts.totalSeconds,
          running: false,
          sessionStarted: false,
          ...this.buildClockPayload(parts.main, undefined, parts.ms)
        })
      },

    tickPomodoro() {
        const remaining = this.pomodoroEndAt - Date.now()
        if (remaining <= 0) {
          this.advancePomodoro()
          return
        }
        this.pomodoroRemaining = Math.max(0, remaining)
        const parts = formatTimerParts(remaining)
        this.setData({
          mainSeconds: parts.totalSeconds,
          ...(parts.main !== this.lastClockText ? this.buildClockPayload(parts.main, undefined, parts.ms) : this.clockMsPatch(parts.ms))
        })
      },

    advancePomodoro() {
        if (this.pomodoroPhase === 'focus') {
          if (app.addTomato) app.addTomato(1)
          const completed = this.pomodoroCycle
          const isLong = completed % POMODORO_LONG_EVERY === 0
          this.pomodoroPhase = 'rest'
          this.pomodoroPhaseTotal = isLong ? POMODORO_LONG_REST : POMODORO_REST
          wx.showToast({ title: isLong ? '长休息 15 分钟' : '休息 5 分钟', icon: 'none', duration: 1600 })
          this.playFinishBurst()
        } else {
          this.pomodoroPhase = 'focus'
          this.pomodoroPhaseTotal = POMODORO_FOCUS
          this.pomodoroCycle = this.pomodoroCycle % POMODORO_LONG_EVERY === 0 ? 1 : this.pomodoroCycle + 1
          wx.showToast({ title: '番茄专注开始', icon: 'none', duration: 1600 })
        }
        this.pomodoroRemaining = this.pomodoroPhaseTotal
        this.pomodoroEndAt = Date.now() + this.pomodoroPhaseTotal
        if (app.vibrate) app.vibrate('heavy')
        if (app.playRing) app.playRing()
        const parts = formatTimerParts(this.pomodoroPhaseTotal)
        this.setData({
          pomodoroPhase: this.pomodoroPhase,
          pomodoroCycle: this.pomodoroCycle,
          pomodoroPhaseTotal: this.pomodoroPhaseTotal,
          mainSeconds: parts.totalSeconds,
          running: true,
          sessionStarted: true,
          ...this.buildClockPayload(parts.main, undefined, parts.ms)
        })
      },

    clockMsPatch(ms) {
        const showMs = String(this.data.mainText || '').length <= 5
        const msCells = showMs ? ms.split('').map((char, index) => ({
          key: `q-ms-${index}`,
          text: char,
          segs: LED_PATTERNS[char] || [0, 0, 0, 0, 0, 0, 0]
        })) : []
        return {
          msText: showMs ? ms : '',
          'clockData.msShow': showMs && !!ms,
          'clockData.msText': showMs ? ms : '',
          'clockData.msCells': msCells
        }
      },

    buildClockPayload(text, style, msText) {
        const previous = this.lastClockText || text
        const flipCells = text.split('').map((char, index) => ({
          key: `q-flip-${index}`,
          text: char,
          oldText: previous[index] || char,
          changed: char !== (previous[index] || char),
          sep: char === ':'
        }))
        const blockCells = text.split('').map((char, index) => ({
          key: `q-block-${index}`,
          text: char,
          sep: char === ':'
        }))
        // LED 七段：段码表与计时页共用 utils/format 里的同一张
        const ledCells = text.split('').map((char, index) => ({
          key: `q-led-${index}`,
          sep: char === ':',
          segs: char === ':' ? [] : (LED_PATTERNS[char] || [0, 0, 0, 0, 0, 0, 0])
        }))
        if (flipCells.some(item => item.changed)) this.flipPhase = !this.flipPhase
        this.lastClockText = text
        const styleKey = style || this.data.clockStyle
        const ms = msText || ''
        // 秒表 / 计时器 / 番茄钟都显示毫秒；进入小时后主时间变成 HH:MM:SS，空间让给小时，毫秒自动收起
        const hasHours = text.length > 5
        const showMs = !!ms && !hasHours
        this.noteClockShape(text, showMs)
        const msCells = showMs ? ms.split('').map((char, index) => ({
          key: `q-ms-${index}`,
          text: char,
          segs: LED_PATTERNS[char] || [0, 0, 0, 0, 0, 0, 0]
        })) : []
        return {
          mainText: text,
          msText: showMs ? ms : '',
          clockData: {
            clockStyle: styleKey,
            mainText: text,
            flipCells,
            blockCells,
            ledCells,
            flipPhase: !!this.flipPhase,
            msShow: showMs,
            long: text.length > 5,
            msText: showMs ? ms : '',
            msCells
          }
        }
      },

    setClockStyle(e) {
        const raw = e && e.currentTarget ? e.currentTarget.dataset.key : e
        const next = resolveClockStyle(raw)
        const payload = this.buildClockPayload(this.data.mainText, next.key, this.data.msText || '00')
        this.setData({ clockStyle: next.key, clockStyleName: next.name, ...payload }, () => this.syncClockBox())
        this.showClockHint(`已切换 · ${next.name}`, 1500)
        wx.setStorageSync(app.globalData.clockStyleKey, next.key)
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      },

    cycleClockStyle() {
        const index = CLOCK_STYLES.findIndex(item => item.key === this.data.clockStyle)
        this.setClockStyle(CLOCK_STYLES[(index + 1) % CLOCK_STYLES.length].key)
      },

    showClockHint(text, duration = 1800) {
        clearTimeout(this.hintTimer)
        this.setData({ clockHintText: text, clockHintShow: true })
        this.hintTimer = setTimeout(() => this.setData({ clockHintShow: false }), duration)
      },

    recordLap() {
        if (this.data.tab !== 'stopwatch' || !this.stopwatchMs) return
        const total = formatStopwatch(this.stopwatchMs)
        const splitMs = this.stopwatchMs - (this.lastLapMs || 0)
        const split = formatStopwatch(splitMs)
        this.lapNo = (this.lapNo || 0) + 1
        this.lastLapMs = this.stopwatchMs
        const lap = {
          key: `lap-${this.lapNo}`,
          no: this.lapNo,
          total: `${total.main}.${total.ms}`,
          split: `+${split.main}.${split.ms}`
        }
        this.setData({ laps: [lap, ...this.data.laps] })
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      },

    clearLaps() {
        this.lapNo = 0
        this.lastLapMs = 0
        if (this.data.laps.length) this.setData({ laps: [] })
      },

    recordPresetUse(minutes) {
        if (!minutes) return
        let stats = {}
        try {
          stats = wx.getStorageSync(PRESET_STATS_KEY) || {}
        } catch (e) {
          stats = {}
        }
        stats[minutes] = Number(stats[minutes] || 0) + 1
        wx.setStorageSync(PRESET_STATS_KEY, stats)
      },

    goBack() {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/tools/tools' }) })
      }
  }
})
