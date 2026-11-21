const PALETTE = require('./theme/palette.js')

const THEMES = PALETTE.map(theme => ({
  key: theme.key,
  name: theme.name,
  desc: theme.desc,
  swatch: theme.swatch,
  css: theme.css,
  nav: theme.nav,
  front: theme.front,
  sliderActive: theme.slider.active,
  sliderTrack: theme.slider.track,
  sliderBlock: theme.slider.block,
  canvas: theme.canvas
}))

// 默认训练模块：与首页首启动展示的一致，工具页「训练」在没有模板时也用它，不依赖首页是否打开过
const DEFAULT_TRAINING_MODULES = [
  { name: '课程学习', targetMinutes: 30 },
  { name: '知识梳理', targetMinutes: 20 },
  { name: '专项练习', targetMinutes: 30 },
  { name: '错题复盘', targetMinutes: 15 },
  { name: '阅读积累', targetMinutes: 15 },
  { name: '总结回顾', targetMinutes: 10 }
]

// 五款轻快常用的提示音：叮咚 / 钟琴 / 风铃 / 木琴 / 轻铃
// key 沿用旧值，已保存的铃声选择不会失效，只是换成新音源与新名字
const RINGS = [
  { key: 'chime', name: '叮咚', src: '/assets/audio/ring-dingdong.m4a' },
  { key: 'bell', name: '钟琴', src: '/assets/audio/ring-glocken.m4a' },
  { key: 'drop', name: '风铃', src: '/assets/audio/ring-windbell.m4a' },
  { key: 'marimba', name: '木琴', src: '/assets/audio/ring-xylophone.m4a' },
  { key: 'clear', name: '轻铃', src: '/assets/audio/ring-softbell.m4a' }
]


// ---- 自定义主题：由主色 / 底色 / 字色推导整套 CSS 变量 ----
const hexToRgb = (hex) => {
  let value = String(hex || '').replace('#', '')
  if (value.length === 3) value = value.split('').map(ch => ch + ch).join('')
  const num = parseInt(value, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}
const toHex = (rgb) => '#' + [rgb.r, rgb.g, rgb.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase()
const mixColor = (a, b, t) => {
  const x = hexToRgb(a), y = hexToRgb(b)
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t })
}
const shade = (hex, t) => t >= 0 ? mixColor(hex, '#FFFFFF', t) : mixColor(hex, '#000000', -t)
const inkOn = (hex) => {
  const { r, g, b } = hexToRgb(hex)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#4B3A2A' : '#FFFFFF'
}

const buildCustomTheme = (conf, meta) => {
  const metaName = (meta && meta.name) || '自定义'
  const metaKey = (meta && meta.key) || 'custom'
  const primary = (conf && conf.primary) || '#FFC94D'
  const bg = (conf && conf.bg) || '#FBF3DF'
  const ink = (conf && conf.ink) || '#4B3A2A'
  const primaryDeep = shade(primary, -0.16)
  const primarySoft = shade(primary, -0.06)
  const nav = mixColor(primary, '#FFFFFF', 0.42)
  const onPrimary = inkOn(primary)
  const textWarm = mixColor(ink, primary, 0.28)
  const line = mixColor(ink, bg, 0.82)
  const css = {
    'bg': bg,
    'card': mixColor(bg, '#FFFFFF', 0.85),
    'panel': ink,
    'panel-deep': shade(ink, -0.18),
    'ink': ink,
    'edge': ink,
    'edge-deep': shade(ink, -0.12),
    'shadow': ink,
    'shadow-soft': mixColor(ink, bg, 0.68),
    'text-2': mixColor(ink, bg, 0.48),
    'text-3': mixColor(ink, bg, 0.58),
    'text-4': mixColor(ink, bg, 0.68),
    'text-warm': textWarm,
    'text-mid': mixColor(ink, bg, 0.34),
    'text-dim': mixColor(ink, bg, 0.24),
    'on-panel': mixColor(bg, '#FFFFFF', 0.55),
    'on-panel-warm': shade(primary, 0.2),
    'accent-text': shade(primary, 0.35),
    'accent-bg': mixColor(primary, '#FFFFFF', 0.55),
    'cream-1': mixColor(bg, '#FFFFFF', 0.7),
    'cream-2': mixColor(bg, primary, 0.1),
    'cream-3': mixColor(bg, '#FFFFFF', 0.55),
    'cream-4': mixColor(bg, primary, 0.16),
    'line': line,
    'line-2': mixColor(ink, bg, 0.86),
    'line-strong': mixColor(ink, bg, 0.72),
    'track': mixColor(primary, bg, 0.72),
    'bar-target': mixColor(ink, bg, 0.62),
    'bar-incomplete': mixColor(ink, bg, 0.7),
    'chip-neutral': mixColor(bg, primary, 0.08),
    'primary': primary,
    'primary-2': primaryDeep,
    'primary-3': primarySoft,
    'on-primary': onPrimary,
    'nav': nav,
    'nav-front': '#000000',
    'success': '#4F9B74',
    'success-text': '#3D7F5E',
    'success-bg': '#DCF1E5',
    'success-line': '#A9D8C0',
    'danger': '#E8442F',
    'danger-text': '#B32B1E',
    'danger-bg': '#FFE3DE',
    'danger-line': '#F0C2B8',
    'warn-bg': '#FFEEC2',
    'warn-text': '#7A5A1C'
  }
  const style = Object.keys(css).map(name => `--${name}:${css[name]};`).join('')
  return {
    key: metaKey,
    name: metaName,
    desc: `${primary} · 自选配色`,
    swatch: [bg, primary, ink],
    nav,
    front: '#000000',
    slider: { active: primaryDeep, track: css.track, block: primary },
    canvas: {
      bg,
      card: css.card,
      panel: ink,
      onPanel: css['on-panel'],
      ink,
      sub: textWarm,
      accent: css['accent-bg'],
      soft: css['cream-2'],
      highlight: primary,
      success: '#4F9B74',
      danger: '#E8442F'
    },
    css,
    style
  }
}

const MODES = [
  { key: 'countup', name: '正计时', desc: '从 0 往上累计，练多少记多少' },
  { key: 'countdown', name: '倒计时', desc: '按总目标倒数，时间到自动收尾' },
  { key: 'pomodoro', name: '番茄钟', desc: '25 分钟专注 / 5 分钟休息，每 4 个后长休息' }
]

const DEFAULT_SETTINGS = {
  theme: 'sky',
  soundMode: 'both',
  ring: 'chime',
  keepScreenOn: true,
  exitGuard: true,
  overtimeAlert: true,
  tickSound: false,
  tickDefaultOff: true,
  incentiveType: 'tomato',
  // 首页固定显示哪一项：timer = 训练计时，quick-* = 秒表/计时器/番茄钟
  pinnedFeature: 'timer',
  privacyAlbum: true,
  privacyCalendar: true
}

const detectDesktop = () => {
  try {
    const info = (wx.getDeviceInfo ? wx.getDeviceInfo() : wx.getSystemInfoSync()) || {}
    const platform = String(info.platform || '').toLowerCase()
    return platform === 'windows' || platform === 'mac'
  } catch (e) {
    return false
  }
}

App({
  globalData: {
    storageKey: 'exam-timer-session',
    recordsKey: 'exam-timer-records',
    templateKey: 'exam-timer-template',
    clockStyleKey: 'exam-timer-clock-style',
    todoKey: 'exam-timer-todos',
    themeKey: 'exam-timer-theme',
    dailyKey: 'exam-timer-daily',
    settingsKey: 'exam-timer-settings',
    modeKey: 'exam-timer-mode',
    habitApplyKey: 'exam-timer-habit-apply',
    presetSelectKey: 'exam-timer-preset-select',
    importantKey: 'exam-timer-important-dates',
    tomatoKey: 'exam-timer-tomatoes',
    presetLimit: 8,
    presetFold: 4,
    dailyTargetSeconds: 180 * 60
  },
  onLaunch() {
    // 微信桌面版（Windows / Mac）：自定义导航栏外还有一条系统标题栏（带返回箭头），
    // 页面自己画的 topbar 会和它重复，所以桌面端隐藏自绘 topbar，只留系统那条。
    this.globalData.isDesktop = detectDesktop()
    this.normalizeTemplates()
    // 历史版本里 tickSound 默认是开，第一次升级时统一关掉，之后按用户选择走
    const saved = wx.getStorageSync(this.globalData.settingsKey)
    if (saved && !saved.tickDefaultOff) {
      saved.tickSound = false
      saved.tickDefaultOff = true
      wx.setStorageSync(this.globalData.settingsKey, saved)
    }
    // 「奶油白」皮肤下线：存量用户的主题一次性迁到默认的「晴空苏打」，之后仍可自己切回
    if (saved && !saved.pearlRemoved) {
      if (saved.theme === 'pearl') {
        saved.theme = 'sky'
        wx.setStorageSync(this.globalData.themeKey, 'sky')
      }
      saved.pearlRemoved = true
      wx.setStorageSync(this.globalData.settingsKey, saved)
    }
    // 旧默认「蜂蜜奶霜」一次性迁到新的默认「晴空苏打」；用户之后仍可切回
    if (saved && typeof saved === 'object' && !saved.skyDefaultApplied) {
      if (saved.theme === 'cream') {
        saved.theme = 'sky'
        wx.setStorageSync(this.globalData.themeKey, 'sky')
      }
      saved.skyDefaultApplied = true
      wx.setStorageSync(this.globalData.settingsKey, saved)
    }
    // 首帧之前就把系统窗口色对齐当前主题，避免先露出 app.json 里的静态配色再看它变过去
    this.applyNavBar()
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
    const seenNames = {}
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
      .filter(item => {
        if (seenNames[item.name]) return false
        seenNames[item.name] = true
        return true
      })
    if (!templates.length) return
    const finalName = templates.some(item => item.name === currentName) ? currentName : templates[0].name
    wx.setStorageSync(this.globalData.templateKey, { currentName: finalName, templates })
  },

  // 读取「当前模板」里可训练的模块（targetMinutes > 0）。
  // 工具页「训练」直接用这个，不依赖首页是否被固定成计时、也不依赖首页是否被打开过：
  // 没有存储的模板时回落到默认模块，保证任何入口点「训练」都能直接开一局。
  getTrainingModules() {
    try { this.normalizeTemplates() } catch (error) {}
    const raw = wx.getStorageSync(this.globalData.templateKey)
    let list = []
    let currentName = ''
    if (raw && Array.isArray(raw.templates)) {
      list = raw.templates
      currentName = raw.currentName || ''
    } else if (Array.isArray(raw)) {
      // 老结构：模块数组，或模板数组
      const isTemplateList = raw.length && raw.every(item => item && Array.isArray(item.modules))
      list = isTemplateList ? raw : [{ name: '常规', modules: raw }]
    } else if (raw && Array.isArray(raw.modules)) {
      list = [{ name: raw.name || '常规', modules: raw.modules }]
    }
    const chosen = list.find(item => item && item.name === currentName) || list[0]
    let modules = (chosen && chosen.modules) || []
    modules = modules
      .filter(item => item && Number(item.targetMinutes) > 0)
      .map(item => ({ name: item.name || '训练模块', targetMinutes: Number(item.targetMinutes) || 0, source: item.source || '' }))
    if (!modules.length) modules = DEFAULT_TRAINING_MODULES.map(item => ({ ...item }))
    return modules
  },

  // 保存当前模板的训练模块（训练页编辑后回写，首页读到的就是同一份）
  saveTrainingModules(modules) {
    const clean = (modules || [])
      .map(item => ({ name: (item.name || '').trim() || '训练模块', targetMinutes: Math.max(0, Number(item.targetMinutes) || 0) }))
      .filter(item => item.targetMinutes > 0)
    const raw = wx.getStorageSync(this.globalData.templateKey)
    let currentName = (raw && raw.currentName) || '常规'
    let templates = (raw && Array.isArray(raw.templates)) ? raw.templates.slice() : []
    const idx = templates.findIndex(item => item && item.name === currentName)
    const next = { name: currentName, modules: clean }
    if (idx >= 0) templates[idx] = next
    else templates = [next].concat(templates)
    wx.setStorageSync(this.globalData.templateKey, { currentName, templates })
    return clean
  },

  // 起一局训练：写会话 + 模式，调用方负责跳转（训练页 / 工具页 / 首页共用同一口径）
  startTrainingSession(modules, mode) {
    const runtimeModules = (modules || [])
      .filter(item => item && Number(item.targetMinutes) > 0)
      .map((item, index) => ({
        id: item.id || `m_${index}`,
        name: item.name || '训练模块',
        targetMinutes: Number(item.targetMinutes) || 0,
        elapsedSeconds: 0,
        status: 'pending'
      }))
    if (!runtimeModules.length) return false
    const firstIndex = 0
    runtimeModules[firstIndex].status = 'current'
    const useMode = mode || wx.getStorageSync(this.globalData.modeKey) || 'countup'
    wx.setStorageSync(this.globalData.modeKey, useMode)
    const settings = this.getSettings ? this.getSettings() : {}
    wx.setStorageSync(this.globalData.storageKey, {
      modules: runtimeModules,
      startedAt: Date.now(),
      currentIndex: firstIndex,
      globalSeconds: 0,
      moduleSeconds: 0,
      isPaused: false,
      mode: useMode,
      totalTargetSeconds: runtimeModules.reduce((sum, item) => sum + item.targetMinutes * 60, 0),
      tickSound: settings.tickSound === true
    })
    return true
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
    { key: 'zhiye', name: '事业单位职测', desc: '5 模块 · 90 分钟', modules: [
      { name: '常识判断', targetMinutes: 10 }, { name: '言语理解', targetMinutes: 20 }, { name: '数量关系', targetMinutes: 15 },
      { name: '判断推理', targetMinutes: 25 }, { name: '资料分析', targetMinutes: 20 }
    ] },
    { key: 'skshenlun', name: '省考申论', desc: '4 模块 · 150 分钟', modules: [
      { name: '概括归纳', targetMinutes: 30 }, { name: '综合分析', targetMinutes: 30 },
      { name: '贯彻执行', targetMinutes: 40 }, { name: '大作文', targetMinutes: 50 }
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
    const settings = this.getSettings()
    const key = settings.theme || wx.getStorageSync(this.globalData.themeKey)
    if (key && String(key).indexOf('ct-') === 0) {
      const entry = (settings.customThemes || []).find(item => item.key === key)
      if (entry) return buildCustomTheme(entry, { name: entry.name, key: entry.key })
    }
    if (key === 'custom') return buildCustomTheme(settings.customTheme)
    return THEMES.find(item => item.key === key) || THEMES.find(item => item.key === 'sky') || THEMES[0]
  },

  // 自定义主题列表（带旧数据兼容）
  getCustomThemes() {
    const settings = this.getSettings()
    const list = Array.isArray(settings.customThemes) ? settings.customThemes.slice() : []
    if (!Array.isArray(settings.customThemes) && settings.customTheme) {
      list.push({ key: 'ct-legacy', name: '我的主题', primary: settings.customTheme.primary, bg: settings.customTheme.bg, ink: settings.customTheme.ink })
    }
    return list
  },

  // 运行时主题全部变量（自定义主题走内联 style，内置主题为空）
  getThemeStyle() {
    const theme = this.getTheme()
    return theme.style || ''
  },

  getRings() {
    const settings = this.getSettings()
    const list = RINGS.slice()
    const customs = Array.isArray(settings.customRings) ? settings.customRings.slice() : []
    if (!Array.isArray(settings.customRings) && settings.customRing && settings.customRing.path) {
      customs.push({ key: 'cr-legacy', name: settings.customRing.name || '我的铃声', path: settings.customRing.path })
    }
    customs.forEach(item => {
      if (item && item.path) list.push({ key: item.key, name: item.name || '我的铃声', src: item.path })
    })
    return list
  },

  ringSrc(key) {
    const settings = this.getSettings()
    if (key === 'custom' && settings.customRing && settings.customRing.path) return settings.customRing.path
    const ring = this.getRings().find(item => item.key === key)
    return ring ? ring.src : RINGS[0].src
  },

  buildCustomTheme(conf) {
    return buildCustomTheme(conf)
  },

  applyNavBar() {
    const theme = this.getTheme()
    if (wx.setNavigationBarColor) {
      // frontColor 只认 #ffffff / #000000，统一小写规范化；颜色切换不做渐变动画，
      // 否则从页面静态配色过渡过来的那 200ms 会被看成「顶栏闪一下」
      const front = String(theme.front || '#000000').toLowerCase() === '#ffffff' ? '#ffffff' : '#000000'
      try {
        wx.setNavigationBarColor({
          frontColor: front,
          backgroundColor: theme.nav || '#FFFFFF',
          animation: { duration: 0, timingFunc: 'linear' }
        })
      } catch (error) { /* 部分端不支持，忽略 */ }
    }
    if (wx.setBackgroundColor) {
      // 窗口底色要跟主题的页面底色一致，用 swatch 会把边缘染成主色
      const bg = (theme.css && theme.css.bg) || theme.swatch[0]
      try {
        wx.setBackgroundColor({
          backgroundColor: bg,
          backgroundColorTop: bg,
          backgroundColorBottom: bg
        })
      } catch (error) { /* 部分端不支持，忽略 */ }
    }
  },

  playRing() {
    const settings = this.getSettings()
    if (settings.soundMode === 'vibrate' || settings.soundMode === 'silent') return
    const src = this.ringSrc(settings.ring)
    try {
      if (!this.audioContext) this.audioContext = wx.createInnerAudioContext()
      this.audioContext.stop()
      this.audioContext.src = src
      this.audioContext.play()
    } catch (error) { /* 播放失败不影响计时 */ }
  },

  vibrate(type) {
    const settings = this.getSettings()
    if (settings.soundMode === 'ring' || settings.soundMode === 'silent') return
    if (!wx.vibrateShort) return
    wx.vibrateShort({ type: type || 'medium', fail: () => {} })
  },

  // 番茄激励：完成一次计时就累计一颗
  addTomato(count) {
    const current = Number(wx.getStorageSync(this.globalData.tomatoKey) || 0) || 0
    const total = Math.max(0, current + (Number(count) || 1))
    wx.setStorageSync(this.globalData.tomatoKey, total)
    return total
  },

  getTomatoCount() {
    return Math.max(0, Number(wx.getStorageSync(this.globalData.tomatoKey) || 0) || 0)
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
    // 今日目标固定为 3 小时，不把当天多次训练的计划时长累加成 11、12 小时
    const targetSeconds = this.globalData.dailyTargetSeconds || 180 * 60
    const todaySeconds = todayStat.seconds || 0
    const todayPercent = Math.min(100, Math.round(todaySeconds / targetSeconds * 100))

    const weekStart = startOfDay(today)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    let weekSeconds = 0
    let weekDays = 0
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(weekStart)
      day.setDate(day.getDate() + i)
      const stat = store[keyOf(day)] || {}
      if (stat.seconds) {
        weekSeconds += stat.seconds
        weekDays += 1
      }
    }

    let streak = 0
    const cursor = new Date(today)
    if (!(store[keyOf(cursor)] && store[keyOf(cursor)].seconds)) cursor.setDate(cursor.getDate() - 1)
    while (store[keyOf(cursor)] && store[keyOf(cursor)].seconds) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }

    const totalDays = Object.keys(store).filter(key => store[key] && store[key].seconds).length

    // 当月日历打卡视图
    const year = today.getFullYear()
    const month = today.getMonth()
    const firstDay = new Date(year, month, 1)
    const lead = (firstDay.getDay() + 6) % 7
    const monthDays = new Date(year, month + 1, 0).getDate()
    const cells = []
    let monthSeconds = 0
    let monthDaysCount = 0
    for (let i = 0; i < lead; i += 1) {
      cells.push({ key: `pad-${i}`, empty: true, day: '' })
    }
    for (let dayNum = 1; dayNum <= monthDays; dayNum += 1) {
      const day = new Date(year, month, dayNum)
      const stat = store[keyOf(day)] || {}
      const seconds = stat.seconds || 0
      monthSeconds += seconds
      if (seconds) monthDaysCount += 1
      cells.push({
        key: keyOf(day),
        empty: false,
        day: dayNum,
        level: day > today ? 'none' : levelOf(seconds),
        minutes: Math.floor(seconds / 60),
        isToday: keyOf(day) === keyOf(today)
      })
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `tail-${cells.length}`, empty: true, day: '' })
    }
    const calendarRows = []
    for (let i = 0; i < cells.length; i += 7) {
      calendarRows.push({ key: `row-${i}`, cells: cells.slice(i, i + 7) })
    }



    return {
      today,
      keyOf,
      todaySeconds,
      targetSeconds,
      todayPercent,
      weekSeconds,
      weekDays,
      streak,
      totalDays,
      calendar: { monthLabel: `${year} 年 ${month + 1} 月`, weekdayLabels: ['一', '二', '三', '四', '五', '六', '日'], rows: calendarRows, monthSeconds, monthDays: monthDaysCount }
    }
  }
})
