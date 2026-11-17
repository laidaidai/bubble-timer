const PALETTE = require('./theme/palette.js')

const THEMES = PALETTE.map(theme => ({
  key: theme.key,
  name: theme.name,
  desc: theme.desc,
  swatch: theme.swatch,
  nav: theme.nav,
  front: theme.front,
  sliderActive: theme.slider.active,
  sliderTrack: theme.slider.track,
  sliderBlock: theme.slider.block,
  canvas: theme.canvas
}))

const RINGS = [
  { key: 'chime', name: '轻风铃', src: '/assets/audio/ring-chime.m4a' },
  { key: 'bell', name: '小铜铃', src: '/assets/audio/ring-bell.m4a' },
  { key: 'drop', name: '水滴音', src: '/assets/audio/ring-drop.m4a' }
]

const MODES = [
  { key: 'countup', name: '正计时', desc: '从 0 往上累计，练多少记多少' },
  { key: 'countdown', name: '倒计时', desc: '按总目标倒数，时间到自动收尾' },
  { key: 'pomodoro', name: '番茄钟', desc: '25 分钟专注 + 5 分钟休息' }
]

const DEFAULT_SETTINGS = {
  theme: 'cream',
  soundMode: 'both',
  ring: 'chime',
  keepScreenOn: true,
  exitGuard: true,
  overtimeAlert: true
}

App({
  globalData: {
    storageKey: 'exam-timer-session',
    recordsKey: 'exam-timer-records',
    templateKey: 'exam-timer-template',
    clockStyleKey: 'exam-timer-clock-style',
    todoKey: 'exam-timer-todos',
    notifyTmplId: 'CRT3AD6eQmKo5yiX6k4gKtHpiLHboiCXuDuy0yGrdxc',
    themeKey: 'exam-timer-theme',
    dailyKey: 'exam-timer-daily',
    settingsKey: 'exam-timer-settings',
    modeKey: 'exam-timer-mode',
    habitApplyKey: 'exam-timer-habit-apply',
    presetSelectKey: 'exam-timer-preset-select',
    presetLimit: 8,
    presetFold: 4
  },
  onLaunch() {
    this.normalizeTemplates()
    wx.removeStorageSync('exam-timer-notify-queue')
  },

  // 模板存储只保留一种结构：{ currentName, templates: [{ name, modules }] }
  normalizeTemplates() {
    const raw = wx.getStorageSync(this.globalData.templateKey)
    if (!raw) return
    let currentName = '常规'
    let list = []
    if (Array.isArray(raw)) {
      const isTemplateList = raw.length && raw.every(item => item && Array.isArray(item.modules))
      list = isTemplateList ? raw : [{ name: '常规', modules: raw }]
    } else if (raw && Array.isArray(raw.templates)) {
      list = raw.templates
      currentName = raw.currentName || '常规'
    } else if (raw && Array.isArray(raw.modules)) {
      list = [{ name: raw.name || '常规', modules: raw.modules }]
    }
    const templates = list
      .filter(item => item && Array.isArray(item.modules))
      .map(item => ({
        name: item.name || '未命名',
        modules: item.modules.map(moduleItem => ({
          id: moduleItem.id || '',
          name: moduleItem.name,
          targetMinutes: Number(moduleItem.targetMinutes) || 0,
          source: moduleItem.source || ''
        }))
      }))
    if (!templates.length) return
    const finalName = templates.some(item => item.name === currentName) ? currentName : templates[0].name
    wx.setStorageSync(this.globalData.templateKey, { currentName: finalName, templates })
  },

  themes: THEMES,
  rings: RINGS,
  habitPresets: [
    { key: 'gk', name: '国考行测', desc: '5 模块 · 120 分钟', modules: [
      { name: '常识判断', targetMinutes: 10 }, { name: '言语理解', targetMinutes: 35 }, { name: '数量关系', targetMinutes: 10 },
      { name: '判断推理', targetMinutes: 35 }, { name: '资料分析', targetMinutes: 30 }
    ] },
    { key: 'sk', name: '省考行测', desc: '5 模块 · 120 分钟', modules: [
      { name: '常识判断', targetMinutes: 10 }, { name: '言语理解', targetMinutes: 35 }, { name: '数量关系', targetMinutes: 15 },
      { name: '判断推理', targetMinutes: 35 }, { name: '资料分析', targetMinutes: 25 }
    ] },
    { key: 'shenlun', name: '国考申论', desc: '5 模块 · 180 分钟', modules: [
      { name: '概括归纳', targetMinutes: 25 }, { name: '综合分析', targetMinutes: 25 }, { name: '提出对策', targetMinutes: 30 },
      { name: '贯彻执行', targetMinutes: 40 }, { name: '大作文', targetMinutes: 60 }
    ] },
    { key: 'shiye', name: '事业单位公基', desc: '4 模块 · 90 分钟', modules: [
      { name: '单选题', targetMinutes: 30 }, { name: '多选题', targetMinutes: 25 }, { name: '判断题', targetMinutes: 15 }, { name: '主观题', targetMinutes: 20 }
    ] },
    { key: 'kaoyan', name: '考研政治', desc: '4 模块 · 180 分钟', modules: [
      { name: '单选题', targetMinutes: 20 }, { name: '多选题', targetMinutes: 30 }, { name: '分析题', targetMinutes: 110 }, { name: '检查回顾', targetMinutes: 20 }
    ] },
    { key: 'english', name: '考研英语', desc: '5 模块 · 180 分钟', modules: [
      { name: '完形填空', targetMinutes: 15 }, { name: '阅读理解', targetMinutes: 70 }, { name: '新题型', targetMinutes: 20 },
      { name: '翻译', targetMinutes: 20 }, { name: '作文', targetMinutes: 55 }
    ] },
    { key: 'pomodoro', name: '番茄专注', desc: '4 模块 · 100 分钟', modules: [
      { name: '专注 1', targetMinutes: 25 }, { name: '专注 2', targetMinutes: 25 }, { name: '专注 3', targetMinutes: 25 }, { name: '专注 4', targetMinutes: 25 }
    ] },
    { key: 'zhiye', name: '事业单位职测', desc: '5 模块 · 90 分钟', modules: [
      { name: '常识判断', targetMinutes: 10 }, { name: '言语理解', targetMinutes: 20 }, { name: '数量关系', targetMinutes: 15 },
      { name: '判断推理', targetMinutes: 25 }, { name: '资料分析', targetMinutes: 20 }
    ] }
  ],
  modes: MODES,

  getSettings() {
    const saved = wx.getStorageSync(this.globalData.settingsKey) || {}
    return { ...DEFAULT_SETTINGS, ...saved }
  },

  saveSettings(patch) {
    const next = { ...this.getSettings(), ...patch }
    wx.setStorageSync(this.globalData.settingsKey, next)
    if (patch.theme) wx.setStorageSync(this.globalData.themeKey, patch.theme)
    return next
  },

  getTheme() {
    const key = this.getSettings().theme || wx.getStorageSync(this.globalData.themeKey)
    return THEMES.find(item => item.key === key) || THEMES[0]
  },

  applyNavBar() {
    const theme = this.getTheme()
    if (wx.setNavigationBarColor) {
      wx.setNavigationBarColor({
        frontColor: theme.front,
        backgroundColor: theme.nav,
        animation: { duration: 200, timingFunc: 'easeIn' }
      })
    }
    if (wx.setBackgroundColor) {
      wx.setBackgroundColor({
        backgroundColor: theme.swatch[0],
        backgroundColorTop: theme.swatch[0],
        backgroundColorBottom: theme.swatch[0]
      })
    }
  },

  playRing() {
    const settings = this.getSettings()
    if (settings.soundMode === 'vibrate' || settings.soundMode === 'silent') return
    const ring = RINGS.find(item => item.key === settings.ring) || RINGS[0]
    try {
      if (!this.audioContext) this.audioContext = wx.createInnerAudioContext()
      this.audioContext.stop()
      this.audioContext.src = ring.src
      this.audioContext.play()
    } catch (error) { /* 播放失败不影响计时 */ }
  },

  vibrate(type) {
    const settings = this.getSettings()
    if (settings.soundMode === 'ring' || settings.soundMode === 'silent') return
    if (!wx.vibrateShort) return
    wx.vibrateShort({ type: type || 'medium', fail: () => {} })
  },

  // 每日汇总，供统计页使用
  addDailyStat(stat) {
    const daily = wx.getStorageSync(this.globalData.dailyKey) || {}
    const date = stat.date
    const prev = daily[date] || { seconds: 0, sessions: 0, modules: 0, targetSeconds: 0 }
    daily[date] = {
      seconds: prev.seconds + (stat.seconds || 0),
      sessions: prev.sessions + 1,
      modules: prev.modules + (stat.modules || 0),
      targetSeconds: prev.targetSeconds + (stat.targetSeconds || 0)
    }
    wx.setStorageSync(this.globalData.dailyKey, daily)
    return daily
  },

  // 打卡/统计的唯一口径：今日、周、连续、累计、近 7 天、热力图
  dailyStats() {
    const store = wx.getStorageSync(this.globalData.dailyKey) || {}
    const pad = value => String(value).padStart(2, '0')
    const keyOf = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    const startOfDay = date => {
      const copy = new Date(date)
      copy.setHours(0, 0, 0, 0)
      return copy
    }
    const levelOf = seconds => {
      const mins = Math.floor((seconds || 0) / 60)
      if (!mins) return '0'
      if (mins < 15) return '1'
      if (mins < 45) return '2'
      if (mins < 90) return '3'
      return '4'
    }

    const today = startOfDay(new Date())
    const todayStat = store[keyOf(today)] || {}
    const targetSeconds = todayStat.targetSeconds || 180 * 60
    const todaySeconds = todayStat.seconds || 0
    const todayPercent = Math.min(100, Math.round(todaySeconds / targetSeconds * 100))

    const weekStart = startOfDay(today)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    let weekSeconds = 0
    let weekDays = 0
    const weekDaily = []
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + i)
      const stat = store[keyOf(day)] || {}
      if (stat.seconds) {
        weekSeconds += stat.seconds
        weekDays += 1
      }
      weekDaily.push({ key: keyOf(day), label: `周${['一', '二', '三', '四', '五', '六', '日'][i]}`, seconds: stat.seconds || 0 })
    }

    let streak = 0
    const cursor = new Date(today)
    if (!(store[keyOf(cursor)] && store[keyOf(cursor)].seconds)) cursor.setDate(cursor.getDate() - 1)
    while (store[keyOf(cursor)] && store[keyOf(cursor)].seconds) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    const totalDays = Object.keys(store).filter(key => store[key] && store[key].seconds).length

    const heatCols = []
    const gridStart = new Date(weekStart)
    gridStart.setDate(gridStart.getDate() - 49)
    for (let col = 0; col < 8; col += 1) {
      const cells = []
      for (let row = 0; row < 7; row += 1) {
        const day = new Date(gridStart)
        day.setDate(day.getDate() + col * 7 + row)
        const stat = store[keyOf(day)] || {}
        cells.push({
          key: keyOf(day),
          level: day > today ? 'none' : levelOf(stat.seconds),
          label: `${day.getMonth() + 1}/${day.getDate()}`,
          minutes: Math.floor((stat.seconds || 0) / 60)
        })
      }
      heatCols.push({ key: `col-${col}`, cells })
    }

    const trend = []
    for (let i = 6; i >= 0; i -= 1) {
      const day = startOfDay(new Date())
      day.setDate(day.getDate() - i)
      const stat = store[keyOf(day)] || {}
      trend.push({ key: keyOf(day), label: ['一', '二', '三', '四', '五', '六', '日'][(day.getDay() + 6) % 7], seconds: stat.seconds || 0 })
    }

    return {
      today,
      keyOf,
      todaySeconds,
      targetSeconds,
      todayPercent,
      weekSeconds,
      weekDays,
      weekDaily,
      streak,
      totalDays,
      heatCols,
      trend
    }
  }
})
