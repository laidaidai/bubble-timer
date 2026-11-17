const app = getApp()
const { pad, clockFull: clock, clock: shortClock, dateTimeText: dateTime, dateKey, clone } = require('../../utils/format')

const CLOCK_STYLES = [
  { key: 'flip', name: '翻页时钟' },
  { key: 'digital', name: '数字时钟' },
  { key: 'blocks', name: '积木方块' },
  { key: 'minimal', name: '极简线条' }
]

const FOCUS_SECONDS = 25 * 60
const REST_SECONDS = 5 * 60

Page({
  data: {
    runtimeModules: [], currentModule: {}, currentIndex: 0,
    globalSeconds: 0, moduleSeconds: 0,
    globalTimeText: '00:00:00', moduleTimeText: '00:00:00', mainTimeText: '00:00:00',
    progressPercent: 0, isPaused: false, isOvertime: false, isHolding: false,
    clockStyle: 'flip', clockStyleName: '翻页时钟', flipPairs: [], flipDigits: [], flipPhase: false,
    msText: '000', showStyleHint: false, theme: 'cream',
    isLastModule: false, isFirstModule: true,
    mode: 'countup', modeName: '正计时', mainLabel: '总用时',
    phaseLabel: '', phaseText: ''
  },

  onLoad() {
    const theme = app.getTheme ? app.getTheme() : { key: 'cream' }
    const settings = app.getSettings ? app.getSettings() : {}
    this.setData({ theme: theme.key })
    if (app.applyNavBar) app.applyNavBar()

    const session = wx.getStorageSync(app.globalData.storageKey)
    if (!session || !session.modules) {
      wx.navigateBack()
      return
    }

    const savedStyle = wx.getStorageSync(app.globalData.clockStyleKey)
    const clockStyle = CLOCK_STYLES.find(item => item.key === savedStyle) || CLOCK_STYLES[0]
    const mode = session.mode || wx.getStorageSync(app.globalData.modeKey) || 'countup'
    const modeInfo = (app.modes || []).find(item => item.key === mode)

    this.startedAt = session.startedAt
    this.totalTargetSeconds = session.totalTargetSeconds || session.modules.reduce((sum, item) => sum + (item.targetMinutes || 0) * 60, 0)
    this.pomodoroPhase = session.pomodoroPhase || 'focus'
    this.phaseRemaining = session.phaseRemaining === undefined ? FOCUS_SECONDS : session.phaseRemaining
    this.pomodoroCycle = session.pomodoroCycle || 1
    this.moduleAlerted = false
    this.totalAlerted = false
    this.finished = false

    this.setData({
      runtimeModules: session.modules,
      currentIndex: session.currentIndex,
      globalSeconds: session.globalSeconds,
      moduleSeconds: session.moduleSeconds,
      isPaused: session.isPaused,
      clockStyle: clockStyle.key,
      clockStyleName: clockStyle.name,
      mode,
      modeName: modeInfo ? modeInfo.name : '正计时'
    }, () => {
      this.updateDisplay()
      this.showStyleHint()
      if (!this.data.isPaused) {
        this.startTicker()
        this.startMsTicker()
      }
      this.setupFocusGuard(settings)
    })
  },

  setupFocusGuard(settings) {
    if (settings.keepScreenOn && wx.setKeepScreenOn) {
      wx.setKeepScreenOn({ keepScreenOn: true, fail: () => {} })
    }
    if (settings.exitGuard && wx.enableAlertBeforeUnload) {
      wx.enableAlertBeforeUnload({ message: '训练还在进行，确定要退出吗？' })
    }
  },

  showStyleHint() {
    clearTimeout(this.styleHintTimer)
    this.setData({ showStyleHint: true })
    this.styleHintTimer = setTimeout(() => this.setData({ showStyleHint: false }), 2400)
  },

  startMsTicker() {
    this.stopMsTicker()
    this.msTimer = setInterval(() => this.updateMs(), 40)
  },

  stopMsTicker() {
    if (this.msTimer) clearInterval(this.msTimer)
    this.msTimer = null
  },

  updateMs() {
    if (this.data.isPaused || this.finished) return
    const base = this.lastTickAt || Date.now()
    const ms = Date.now() - base
    const text = String(((ms % 1000) + 1000) % 1000).padStart(3, '0')
    if (text !== this.data.msText) this.setData({ msText: text })
  },

  cycleClockStyle() {
    const index = CLOCK_STYLES.findIndex(item => item.key === this.data.clockStyle)
    const next = CLOCK_STYLES[(index + 1) % CLOCK_STYLES.length]
    this.setData({ clockStyle: next.key, clockStyleName: next.name })
    wx.setStorageSync(app.globalData.clockStyleKey, next.key)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    this.showStyleHint()
  },

  onHide() {
    if (!this.finished) this.persistSession()
  },

  onUnload() {
    this.stopTicker()
    this.stopMsTicker()
    this.stopTotalBuzz()
    clearTimeout(this.styleHintTimer)
    if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: false, fail: () => {} })
    if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload()
    if (app.audioContext) app.audioContext.stop()
  },

  startTicker() {
    this.stopTicker()
    this.lastTickAt = Date.now()
    this.timer = setInterval(() => this.tick(), 1000)
  },

  stopTicker() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  },

  tick() {
    if (this.data.isPaused || this.finished) return
    const elapsed = Math.floor((Date.now() - this.lastTickAt) / 1000)
    if (!elapsed) return
    this.lastTickAt += elapsed * 1000
    this.accumulate(elapsed)
  },

  accumulate(elapsed) {
    const modules = clone(this.data.runtimeModules)
    const mode = this.data.mode
    const resting = mode === 'pomodoro' && this.pomodoroPhase === 'rest'
    if (!resting && modules[this.data.currentIndex]) {
      modules[this.data.currentIndex].elapsedSeconds += elapsed
      this.data.moduleSeconds += elapsed
    }
    this.data.globalSeconds += elapsed

    if (mode === 'pomodoro') {
      this.phaseRemaining -= elapsed
      if (this.phaseRemaining <= 0) this.switchPomodoroPhase()
    }

    this.setData({
      runtimeModules: modules,
      globalSeconds: this.data.globalSeconds,
      moduleSeconds: this.data.moduleSeconds
    }, () => {
      this.updateDisplay()
      this.checkAlerts()
    })
  },

  switchPomodoroPhase() {
    const nextPhase = this.pomodoroPhase === 'focus' ? 'rest' : 'focus'
    this.pomodoroPhase = nextPhase
    this.phaseRemaining = nextPhase === 'focus' ? FOCUS_SECONDS : REST_SECONDS
    if (nextPhase === 'focus') this.pomodoroCycle += 1
    const phaseName = nextPhase === 'focus' ? '专注' : '休息'
    if (app.vibrate) app.vibrate('heavy')
    if (app.playRing) app.playRing()
    wx.showToast({ title: `${phaseName}开始`, icon: 'none', duration: 1500 })
    this.updateDisplay()
  },

  checkAlerts() {
    if (this.finished) return
    const settings = app.getSettings ? app.getSettings() : {}
    const current = this.data.runtimeModules[this.data.currentIndex]
    const targetSeconds = current ? (current.targetMinutes || 0) * 60 : 0

    if (targetSeconds && !this.moduleAlerted && this.data.moduleSeconds >= targetSeconds) {
      this.moduleAlerted = true
      if (settings.soundMode !== 'silent') {
        if (app.vibrate) app.vibrate('heavy')
        if (app.playRing) app.playRing()
        wx.showToast({ title: `${current.name} 到时间了`, icon: 'none', duration: 1600 })
      }
    }

    if (this.data.mode === 'countdown') {
      const remaining = this.totalTargetSeconds - this.data.globalSeconds
      if (remaining <= 0) {
        this.finishWithAlert()
        return
      }
      if (settings.overtimeAlert && remaining <= 60 && !this.countdownWarned) {
        this.countdownWarned = true
        if (app.vibrate) app.vibrate('medium')
        wx.showToast({ title: '还剩 1 分钟', icon: 'none', duration: 1500 })
      }
      return
    }

    if (this.data.mode === 'countup' && settings.overtimeAlert && !this.totalAlerted && this.totalTargetSeconds && this.data.globalSeconds >= this.totalTargetSeconds) {
      this.totalAlerted = true
      this.startTotalBuzz()
    }
  },

  // 总时间到：持续震动 + 铃声，直到用户操作或 30 秒后停
  startTotalBuzz() {
    const settings = app.getSettings ? app.getSettings() : {}
    this.setData({ totalDone: true })
    wx.showToast({ title: '总时间到了，可以结束训练', icon: 'none', duration: 2500 })
    if (settings.soundMode === 'silent') return
    if (app.playRing) app.playRing()
    this.stopTotalBuzz()
    let count = 0
    this.buzzTimer = setInterval(() => {
      count += 1
      if (wx.vibrateShort) wx.vibrateShort({ type: 'heavy', fail: () => {} })
      if (count % 6 === 0 && app.playRing) app.playRing()
      if (count >= 20) this.stopTotalBuzz()
    }, 1500)
  },

  stopTotalBuzz() {
    if (this.buzzTimer) clearInterval(this.buzzTimer)
    this.buzzTimer = null
  },

  finishWithAlert() {
    if (this.finished) return
    this.startTotalBuzz()
    setTimeout(() => this.exitTraining(), 1200)
  },

  updateDisplay() {
    const currentModule = this.data.runtimeModules[this.data.currentIndex] || {}
    const targetSeconds = (currentModule.targetMinutes || 0) * 60
    const moduleText = clock(this.data.moduleSeconds)
    const globalText = clock(this.data.globalSeconds)
    const mode = this.data.mode

    let mainTimeText = globalText
    let mainLabel = '总用时'
    let phaseLabel = ''
    let phaseText = ''
    if (mode === 'countdown') {
      const remaining = Math.max(0, this.totalTargetSeconds - this.data.globalSeconds)
      mainTimeText = clock(remaining)
      mainLabel = '剩余'
    } else if (mode === 'pomodoro') {
      mainTimeText = clock(Math.max(0, this.phaseRemaining))
      mainLabel = this.pomodoroPhase === 'focus' ? `第 ${this.pomodoroCycle} 个番茄` : '休息中'
      phaseLabel = this.pomodoroPhase === 'focus' ? '专注' : '休息'
      phaseText = this.pomodoroPhase === 'focus' ? 'FOCUS' : 'BREAK'
    }

    const lastPairs = this.lastPairText || ['', '', '']
    const flipPairs = mainTimeText.split(':').map((text, index) => ({ key: `pair-${index}`, text, changed: text !== lastPairs[index] }))
    const flipDigits = mainTimeText.split('').map((text, index) => ({ key: `digit-${index}`, text, sep: text === ':' }))
    this.lastPairText = flipPairs.map(item => item.text)
    if (flipPairs.some(item => item.changed)) this.flipPhase = !this.flipPhase

    this.setData({
      currentModule,
      globalTimeText: globalText,
      moduleTimeText: moduleText,
      mainTimeText,
      mainLabel,
      phaseLabel,
      phaseText,
      progressPercent: targetSeconds ? Math.min(100, Math.round(this.data.moduleSeconds / targetSeconds * 100)) : 0,
      isOvertime: this.data.moduleSeconds > targetSeconds,
      isLastModule: this.data.currentIndex >= this.data.runtimeModules.length - 1,
      isFirstModule: this.data.currentIndex <= 0,
      flipPairs,
      flipDigits,
      flipPhase: !!this.flipPhase
    })
  },

  togglePause() {
    this.tick()
    const isPaused = !this.data.isPaused
    this.setData({ isPaused })
    if (isPaused) {
      this.stopTotalBuzz()
      this.persistSession()
    } else {
      this.startTicker()
      this.startMsTicker()
    }
  },

  startCompleteHold() {
    clearTimeout(this.completeHoldTimer)
    this.setData({ isHolding: true })
    this.completeHoldTimer = setTimeout(() => {
      this.completeHoldTimer = null
      if (this.data.isHolding) this.exitTraining()
    }, 1000)
  },

  endCompleteHold() {
    clearTimeout(this.completeHoldTimer)
    this.completeHoldTimer = null
    this.setData({ isHolding: false })
  },

  goModule(index) {
    const target = this.data.runtimeModules[index]
    if (!target || index === this.data.currentIndex) return
    const modules = clone(this.data.runtimeModules)
    const current = modules[this.data.currentIndex]
    if (current && current.status === 'current') current.status = 'pending'
    modules[index].status = 'current'
    this.moduleAlerted = false
    this.moduleSeconds = target.elapsedSeconds || 0
    this.setData({
      runtimeModules: modules,
      currentIndex: index,
      moduleSeconds: this.moduleSeconds
    }, () => {
      this.updateDisplay()
      this.persistSession()
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      wx.showToast({ title: `切换到 ${target.name}`, icon: 'none', duration: 1200 })
    })
  },

  selectModule(event) {
    this.goModule(Number(event.currentTarget.dataset.index))
  },

  prevModule() {
    this.tick()
    if (this.data.currentIndex <= 0) return
    this.goModule(this.data.currentIndex - 1)
  },

  nextModule() {
    this.tick()
    const modules = clone(this.data.runtimeModules)
    const current = modules[this.data.currentIndex]
    if (current) current.status = 'done'
    const nextIndex = modules.findIndex((item, index) => index > this.data.currentIndex && item.status !== 'done')
    const fallbackIndex = modules.findIndex(item => item.status !== 'done')
    const targetIndex = nextIndex >= 0 ? nextIndex : fallbackIndex
    if (targetIndex < 0) {
      this.exitTraining()
      return
    }
    modules[targetIndex].status = 'current'
    this.moduleAlerted = false
    this.moduleSeconds = modules[targetIndex].elapsedSeconds || 0
    this.setData({
      runtimeModules: modules,
      currentIndex: targetIndex,
      moduleSeconds: this.moduleSeconds
    }, () => {
      this.updateDisplay()
      this.persistSession()
      if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
      wx.showToast({ title: `切换到 ${modules[targetIndex].name}`, icon: 'none', duration: 1200 })
    })
  },

  persistSession() {
    wx.setStorageSync(app.globalData.storageKey, {
      modules: clone(this.data.runtimeModules),
      startedAt: this.startedAt,
      currentIndex: this.data.currentIndex,
      globalSeconds: this.data.globalSeconds,
      moduleSeconds: this.data.moduleSeconds,
      isPaused: this.data.isPaused,
      mode: this.data.mode,
      totalTargetSeconds: this.totalTargetSeconds,
      pomodoroPhase: this.pomodoroPhase,
      phaseRemaining: this.phaseRemaining,
      pomodoroCycle: this.pomodoroCycle
    })
  },

  exitTraining() {
    this.tick()
    this.finish(clone(this.data.runtimeModules))
  },

  finish(modules) {
    this.stopTicker()
    this.stopMsTicker()
    this.stopTotalBuzz()
    this.finished = true
    const rows = modules.map(item => {
      const deltaSeconds = item.elapsedSeconds - item.targetMinutes * 60
      return { ...item, actualText: shortClock(item.elapsedSeconds), deltaSeconds, deltaText: deltaSeconds > 0 ? `超时 ${shortClock(deltaSeconds)}` : `提前 ${shortClock(Math.abs(deltaSeconds))}` }
    })
    const report = {
      id: `record-${Date.now()}`,
      startedAt: this.startedAt,
      startedAtText: dateTime(this.startedAt),
      totalTarget: modules.reduce((sum, item) => sum + item.targetMinutes, 0),
      totalActual: this.data.globalSeconds,
      totalActualText: shortClock(this.data.globalSeconds),
      overtimeCount: rows.filter(item => item.deltaSeconds > 0).length,
      passRate: rows.length ? Math.round(rows.filter(item => item.deltaSeconds <= 0).length / rows.length * 100) : 0,
      rows,
      mode: this.data.mode,
      modeName: this.data.modeName,
      quote: '稳定节奏，持续精进。'
    }
    const records = [report].concat(wx.getStorageSync(app.globalData.recordsKey) || []).slice(0, 3)
    wx.setStorageSync(app.globalData.recordsKey, records)
    wx.setStorageSync('exam-timer-pending-report', report)
    if (app.addDailyStat) {
      app.addDailyStat({
        date: dateKey(this.startedAt || Date.now()),
        seconds: this.data.globalSeconds,
        targetSeconds: this.totalTargetSeconds,
        modules: rows.length
      })
    }
    wx.removeStorageSync(app.globalData.storageKey)
    wx.navigateBack()
  }
})
