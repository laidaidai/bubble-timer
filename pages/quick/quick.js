const app = getApp()
const { pad, CLOCK_STYLES, resolveClockStyle } = require('../../utils/format')

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
const POMODORO_FOCUS = 25 * 60
const POMODORO_REST = 5 * 60
const POMODORO_LONG_REST = 15 * 60
const POMODORO_LONG_EVERY = 4


function formatStopwatch(ms) {
  const total = Math.max(0, ms)
  const hours = Math.floor(total / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const hundredths = Math.floor((total % 1000) / 10)
  return {
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
    main: hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`,
    ms: pad(hundredths),
    totalSeconds
  }
}

Page({
  data: {
    theme: 'rose',
    themeStyle: '',
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
    clockData: {},
    laps: []
  },

  onLoad() {
    this.syncTheme()
    const savedStyle = wx.getStorageSync(app.globalData.clockStyleKey)
    const style = resolveClockStyle(savedStyle)
    this.setData({ clockStyle: style.key, clockStyleName: style.name })
    this.flipPhase = false
    this.modeStates = {}
    this.loadPresetRecommendation()
    const saved = this.readQuickState()
    if (saved) {
      this.restoreQuickState(saved)
    } else {
      const preset = this.data.selectedPreset || 30
      this.setCountdown(preset * 60 * 1000)
      this.resetPomodoro()
      this.setStopwatch(0, false)
    }
  },

  onShow() {
    this.syncTheme()
    this.loadPresetRecommendation()
    if (this.data.running) this.startTicker()
  },

  onHide() {
    this.saveQuickState()
    this.stopTicker()
  },

  onUnload() {
    this.saveQuickState()
    this.stopTicker()
  },

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

  restoreQuickState(saved) {
    const now = Date.now()
    this.modeStates = saved.modeStates && typeof saved.modeStates === 'object' ? saved.modeStates : {}
    const tab = ['stopwatch', 'countdown', 'pomodoro'].includes(saved.tab) ? saved.tab : 'stopwatch'
    const running = !!saved.running
    this.stopwatchMs = Math.max(0, Number(saved.stopwatchMs) || 0)
    this.stopwatchStartedAt = tab === 'stopwatch' && running ? (Number(saved.stopwatchStartedAt) || 0) : 0
    this.lastSetMs = Math.max(0, Number(saved.lastSetMs) || 0)
    this.countdownRemaining = Math.max(0, Number(saved.countdownRemaining) || 0)
    this.countdownEndAt = tab === 'countdown' && running ? (Number(saved.countdownEndAt) || 0) : 0
    this.pomodoroPhase = saved.pomodoroPhase === 'rest' ? 'rest' : 'focus'
    this.pomodoroCycle = Math.max(1, Number(saved.pomodoroCycle) || 1)
    this.pomodoroPhaseTotal = Math.max(1, Number(saved.pomodoroPhaseTotal) || POMODORO_FOCUS)
    const savedPomodoroRemaining = Number(saved.pomodoroRemaining)
    this.pomodoroRemaining = Number.isFinite(savedPomodoroRemaining) ? Math.max(0, savedPomodoroRemaining) : this.pomodoroPhaseTotal
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
    this.pomodoroPhaseTotal = Math.max(1, Number(saved.pomodoroPhaseTotal) || POMODORO_FOCUS)
    const savedPomodoroRemaining = Number(saved.pomodoroRemaining)
    this.pomodoroRemaining = Number.isFinite(savedPomodoroRemaining) ? Math.max(0, savedPomodoroRemaining) : this.pomodoroPhaseTotal
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
    const payload = text.main !== this.lastClockText ? this.buildClockPayload(text.main, undefined, text.ms) : {}
    const msCells = text.ms.split('').map((char, index) => ({ key: `q-ms-${index}`, text: char }))
    this.setData({
      msText: text.ms,
      running: !!running,
      sessionStarted: ms > 0,
      mainSeconds: Math.floor(ms / 1000),
      'clockData.msShow': ms > 0,
      'clockData.msText': text.ms,
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
      return
    }
    if (this.data.tab === 'pomodoro') {
      this.pomodoroEndAt = Date.now() + this.pomodoroRemaining * 1000
      this.setData({ running: true, sessionStarted: true })
      this.startTicker()
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
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  reset() {
    this.stopTicker()
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
      this.countdownRemaining = 0
      this.setData({ mainSeconds: 0, running: false, countdownStarted: true, sessionStarted: false, ...this.buildClockPayload('00:00', undefined, '00') })
      if (wx.vibrateLong) wx.vibrateLong({ fail: () => {} })
      if (app.playRing) app.playRing()
      wx.showToast({ title: '时间到', icon: 'none', duration: 2000 })
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
    const parts = formatTimerParts(POMODORO_FOCUS * 1000)
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
    this.pomodoroRemaining = Math.ceil(remaining / 1000)
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
    } else {
      this.pomodoroPhase = 'focus'
      this.pomodoroPhaseTotal = POMODORO_FOCUS
      this.pomodoroCycle = this.pomodoroCycle % POMODORO_LONG_EVERY === 0 ? 1 : this.pomodoroCycle + 1
      wx.showToast({ title: '番茄专注开始', icon: 'none', duration: 1600 })
    }
    this.pomodoroRemaining = this.pomodoroPhaseTotal
    this.pomodoroEndAt = Date.now() + this.pomodoroPhaseTotal * 1000
    if (app.vibrate) app.vibrate('heavy')
    if (app.playRing) app.playRing()
    const parts = formatTimerParts(this.pomodoroPhaseTotal * 1000)
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
    const msCells = ms.split('').map((char, index) => ({ key: `q-ms-${index}`, text: char }))
    return {
      msText: ms,
      'clockData.msShow': true,
      'clockData.msText': ms,
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
    if (flipCells.some(item => item.changed)) this.flipPhase = !this.flipPhase
    this.lastClockText = text
    const styleKey = style || this.data.clockStyle
    const ms = msText || ''
    const msCells = ms.split('').map((char, index) => ({ key: `q-ms-${index}`, text: char }))
    return {
      mainText: text,
      msText: ms,
      clockData: {
        clockStyle: styleKey,
        mainText: text,
        flipCells,
        flipPhase: !!this.flipPhase,
        msShow: !!ms,
        long: !!ms && text.length > 5,
        msText: ms,
        msCells
      }
    }
  },

  setClockStyle(e) {
    const raw = e && e.currentTarget ? e.currentTarget.dataset.key : e
    const next = resolveClockStyle(raw)
    const payload = this.buildClockPayload(this.data.mainText, next.key, this.data.msText || '00')
    this.setData({ clockStyle: next.key, clockStyleName: next.name, ...payload })
    wx.setStorageSync(app.globalData.clockStyleKey, next.key)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    if (wx.showToast) wx.showToast({ title: next.name, icon: 'none', duration: 900 })
  },

  cycleClockStyle() {
    const index = CLOCK_STYLES.findIndex(item => item.key === this.data.clockStyle)
    this.setClockStyle(CLOCK_STYLES[(index + 1) % CLOCK_STYLES.length].key)
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
})
