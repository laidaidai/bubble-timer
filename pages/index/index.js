const MODULE_LIMIT = 8
const DEFAULT_MODULES = [
  { name: '课程学习', targetMinutes: 30 },
  { name: '知识梳理', targetMinutes: 20 },
  { name: '专项练习', targetMinutes: 30 },
  { name: '错题复盘', targetMinutes: 15 },
  { name: '阅读积累', targetMinutes: 15 },
  { name: '总结回顾', targetMinutes: 10 }
]
const LEGACY_DEFAULT_MODULE_NAMES = ['资料分析', '判断推理', '言语理解', '政治理论', '常识判断', '数量关系']

const QUOTES = ['稳定节奏，持续精进。', '今天的坚持，是明天的底气。', '把时间用在真正重要的事情上。']
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const TOMATO_GRID_LIMIT = 28
const TOMATO_COLUMNS = 8

// 首页快捷计时：直接在工作台里跑，不跳页面；状态与快捷计时页共用同一个 storage
const QUICK_STATE_KEY = 'exam-timer-quick-state'
const POMODORO_FOCUS = 25 * 60 * 1000
const POMODORO_REST = 5 * 60 * 1000
const POMODORO_LONG_REST = 15 * 60 * 1000

function homeStopwatchText(ms) {
  const total = Math.max(0, ms)
  const hours = Math.floor(total / 3600000)
  const minutes = Math.floor((total % 3600000) / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

function homeCountdownText(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}
const app = getApp()
const draw = require('../../utils/poster-draw')
const { createPainter, exportPainter, loadImage, isSupported } = require('../../utils/painter')

function importantDateText(key) {
  const parts = String(key || '').split('-').map(Number)
  if (!parts[0] || !parts[1] || !parts[2]) return ''
  return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`
}

const { pad, clock: formatTime, dateTimeText: formatDateTime, clone, fold, dateKey, bindKeyboardHeight } = require('../../utils/format')

Page({
  data: {
    // 首帧就按当前设备与主题渲染，避免桌面上先闪一下手机版顶栏 / 默认配色
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    kbVars: '',
    view: 'config',
    timerLaunching: false,
    modules: [],
    totalMinutes: 0,
    templateName: '常规',
    reportAnimTimer: null,
    dragIndex: -1,
    addVisible: false,
    report: null,
    templates: [],
    templateSwitching: false,
    burstingIndex: -1,
    burstingTemplate: '',
    reportView: [],
    reportModuleRows: [],
    reportOrigin: '',
    reportExpanded: false,
    dragStyle: '',
    dragStyles: [],
    dragging: false,
    settleIndex: -1,
    settleStyle: '',
    templateModalOpen: false,
    newTemplateName: '',
    theme: 'sky', themeStyle: '',
    themeName: '蜜桃雪酪',
    sliderActive: '#EE7E99',
    sliderTrack: '#F7E2E8',
    sliderBlock: '#FF9FB6',
    mode: 'countup',
    modeName: '正计时',
    modes: [],
    // 重要日子
    importantDates: [],
    importantModalOpen: false,
    importantEditingId: '',
    importantName: '',
    importantDate: '',
    importantDateText: '',
    importantYearly: false,
    importantCalendarOpen: false,
    importantCalTitle: '',
    importantCalRows: [],
    importantCalWeekLabels: WEEK_LABELS,
    // 番茄激励
    tomatoCount: 0,
    tomatoIcons: [],
    incentiveRows: [],
    tomatoProgress: 0,
    tomatoTarget: 5,
    tomatoCaption: '',
    incentiveType: 'tomato',
    tomatoPop: false,
    incentiveReveal: false,
    homeReveal: false,
    dockDim: false,
    homeImportantPreview: [],
    // 首页只看最近 3 个倒计时
    homeCountdowns: [],
    homeCountdownCount: 0,
    importantMore: 0,
    importantLinkText: '管理 ›'
  },

  onLoad() {
    // 兜底：万一 utils/format 的灰度/缓存版本没带上这个导出，页面也不该整个挂掉
    this.unbindKeyboard = typeof bindKeyboardHeight === 'function' ? bindKeyboardHeight(this) : null
    this.setData({ isDesktop: !!(getApp().globalData && getApp().globalData.isDesktop) })
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    // 首页只保留模块化计时；番茄钟独立在快捷计时里，不再和模块混用
    const modes = (app.modes || []).filter(item => item.key !== 'pomodoro').map(item => ({ ...item }))
    const savedMode = wx.getStorageSync(app.globalData.modeKey) || 'countup'
    const modeInfo = modes.find(item => item.key === savedMode) || modes[0]
    this.setData({
      theme: theme.key,
      themeStyle: theme.style || '',
      themeName: theme.name,
      sliderActive: theme.sliderActive,
      sliderTrack: theme.sliderTrack,
      sliderBlock: theme.sliderBlock,
      modes,
      mode: modeInfo ? modeInfo.key : 'countup',
      modeName: modeInfo ? modeInfo.name : '正计时'
    })
    if (app.applyNavBar) app.applyNavBar()
    this.loadReportLogo()
    const savedSession = wx.getStorageSync(app.globalData.storageKey)
    const savedTemplates = this.readTemplates()
    const savedCurrentName = (wx.getStorageSync(app.globalData.templateKey) || {}).currentName
    let savedTemplate = savedTemplates.find(item => item.name === savedCurrentName) || savedTemplates[0]
    // 老版本默认模板是国考行测模块，迁移成通用学习模块；用户自己改过的模板不动
    const isLegacyDefault = savedTemplate && Array.isArray(savedTemplate.modules) &&
      savedTemplate.modules.length === LEGACY_DEFAULT_MODULE_NAMES.length &&
      savedTemplate.modules.every((item, index) => item.name === LEGACY_DEFAULT_MODULE_NAMES[index])
    let templatesForView = savedTemplates
    if (isLegacyDefault) {
      templatesForView = savedTemplates.map(item => item.name === savedTemplate.name
        ? { ...item, modules: clone(DEFAULT_MODULES) }
        : item)
      savedTemplate = templatesForView.find(item => item.name === savedTemplate.name)
      wx.setStorageSync(app.globalData.templateKey, { currentName: savedTemplate.name, templates: templatesForView })
    }
    const modules = savedTemplate && savedTemplate.modules && savedTemplate.modules.length ? savedTemplate.modules : DEFAULT_MODULES
    this.setData({
      modules: this.withIds(modules),
      templateName: savedTemplate && savedTemplate.name ? savedTemplate.name : '常规',
      templates: templatesForView
    }, this.refreshConfig)
    if (savedSession && savedSession.modules && savedSession.startedAt) {
      wx.showModal({
        title: '发现未完成训练',
        content: '是否恢复上次的计时进度？',
        confirmText: '恢复',
        cancelText: '放弃',
        success: ({ confirm }) => confirm ? this.launchTimer() : wx.removeStorageSync(app.globalData.storageKey)
      })
    }
    this.loadImportantDates()
    this.loadTomatoes()
    this.loadHomeSettings()
  },

  resetPortraitMetrics() {
    if (!wx.setDeviceOrientation) return
    clearTimeout(this.portraitTimer)
    this.portraitTimer = setTimeout(() => {
      wx.setDeviceOrientation({ value: 'portrait', fail: () => {} })
    }, 40)
  },

  onHide() {
    if (this.dragActive) this.touchEnd()
    if (this.data.view === 'report') this.reportLeftPage = true
    if (this.reportAutoExitTimer) {
      clearTimeout(this.reportAutoExitTimer)
      this.reportAutoExitTimer = null
    }
  },

  // 安卓实体返回键：报告页优先回首页，不让用户困在报告里
  onBackPress() {
    if (this.data.view === 'report') {
      this.goHomeView()
      return true
    }
    if (this.data.view !== 'config') {
      this.backToConfig()
      return true
    }
    return false
  },

  // 桌面拖动窗口 / 平板转屏后重新判定档位，避免页面还停在手机档、底栏已经变成桌面档
  onResize() {
    const desktop = app && app.detectEnvironment
      ? app.detectEnvironment()
      : !!(app && app.globalData && app.globalData.isDesktop)
    if (desktop !== this.data.isDesktop) this.setData({ isDesktop: desktop })
  },

  onShow() {
    // 横屏计时页返回后，WebView 偶尔会沿用横屏的 rpx 基准，整页被放大；这里主动拉回竖屏基准
    this.resetPortraitMetrics()
    // 训练页改过模块后回写模板：这里只认这个标记，避免把首页正在编辑、还没保存的内容冲掉
    const shared = getApp()
    if (shared && shared.globalData && shared.globalData.trainingModulesDirty) {
      shared.globalData.trainingModulesDirty = false
      if (this.data.view === 'config') {
        const nextModules = (shared.getTrainingModules && shared.getTrainingModules()) || []
        if (nextModules.length) this.setData({ modules: this.withIds(nextModules) })
      }
    }
    // 从工具页「训练」进来时，确保回到训练配置，不停留在计时中 / 报告视图。
    const nav = getApp()
    if (nav && nav.globalData && nav.globalData.homeResetView) {
      nav.globalData.homeResetView = ''
      wx.removeStorageSync('exam-timer-pending-report')
      if (this.data.view !== 'config') {
        this.setData({ view: 'config', reportOrigin: '' })
        // 不在 load 生命周期里直接跑测量/查询，挪到下一拍，避免和首次渲染抢生命周期
        const runRefresh = () => { if (typeof this.refreshConfig === 'function') this.refreshConfig() }
        if (wx.nextTick) wx.nextTick(runRefresh)
        else setTimeout(runRefresh, 0)
      }
    }
    if (this.data.timerLaunching) {
      clearTimeout(this.timerCoverTimer)
      this.timerCoverTimer = setTimeout(() => this.setData({ timerLaunching: false }), 280)
    }
    if (this.getTabBar && this.getTabBar()) this.getTabBar().sync()
    // 结束计时回来时先直接切到报告，避免首页/配置页闪一下
    const report = wx.getStorageSync('exam-timer-pending-report')
    if (report) {
      wx.removeStorageSync('exam-timer-pending-report')
      // 没有启动遮罩时（例如从记录页回来）也补一层 logo 遮罩，避免旧页内容闪出
      if (!this.data.timerLaunching) {
        this.setData({ timerLaunching: true })
        clearTimeout(this.timerCoverTimer)
        this.timerCoverTimer = setTimeout(() => this.setData({ timerLaunching: false }), 280)
      }
      this.loadTomatoes()
      // 记录页点「查看报告」进来时，返回要回记录列表，而不是首页工作台
      const origin = wx.getStorageSync('exam-timer-report-origin') || ''
      wx.removeStorageSync('exam-timer-report-origin')
      this.setData({ reportOrigin: origin })
      this.showReport(report, { keepOpen: origin === 'history' })
      return
    }
    // 从报告页切到别的页面再回首页时，不再停留在旧报告
    if (this.reportLeftPage && this.data.view === 'report') {
      this.reportLeftPage = false
      this.resetToHome()
    }
    const habitApply = wx.getStorageSync(app.globalData.habitApplyKey)
    if (habitApply) {
      wx.removeStorageSync(app.globalData.habitApplyKey)
      if (habitApply.action === 'add' && Array.isArray(habitApply.modules)) {
        const exist = this.data.modules.some(item => item.source === habitApply.key)
        let added = exist ? this.data.modules : this.data.modules.concat(habitApply.modules.map(item => ({
          id: `preset-${habitApply.key}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: item.name,
          targetMinutes: Number(item.targetMinutes) || 0,
          source: habitApply.key
        })))
        if (added.length > MODULE_LIMIT) {
          added = added.slice(0, MODULE_LIMIT)
          wx.showToast({ title: `最多 ${MODULE_LIMIT} 个模块`, icon: 'none' })
        }
        this.setData({ modules: added, templateName: '我的习惯', view: 'config' }, this.refreshConfig)
      } else if (habitApply.action === 'remove') {
        const kept = this.data.modules.filter(item => item.source !== habitApply.key)
        this.setData({ modules: kept, templateName: '我的习惯' }, this.refreshConfig)
      } else if (habitApply.name) {
        const templates = this.readTemplates()
        const template = templates.find(item => item.name === habitApply.name)
        if (template && template.modules && template.modules.length) {
          this.setData({ modules: this.withIds(template.modules), templateName: habitApply.name, templates, view: 'config' }, this.refreshConfig)
        } else if (habitApply.name === '常规') {
          this.setData({ modules: this.withIds(DEFAULT_MODULES), templateName: '常规', templates, view: 'config' }, this.refreshConfig)
        }
      }
    }
    // 兜底：模板存储里的当前模板变了就同步（防止一次标记丢失导致首页不变）
    const storedTpl = wx.getStorageSync(app.globalData.templateKey)
    if (storedTpl && storedTpl.currentName && storedTpl.currentName !== this.data.templateName) {
      const templates = this.readTemplates()
      const template = templates.find(item => item.name === storedTpl.currentName)
      if (template && template.modules && template.modules.length) {
        this.setData({
          modules: this.withIds(template.modules),
          templateName: template.name,
          templates,
          view: 'config'
        }, this.refreshConfig)
      }
    }
    if (app.getTheme) {
      const theme = app.getTheme()
      if (theme.key !== this.data.theme || (theme.style || '') !== this.data.themeStyle) {
        this.setData({ theme: theme.key, themeStyle: theme.style || '', themeName: theme.name, sliderActive: theme.sliderActive, sliderTrack: theme.sliderTrack, sliderBlock: theme.sliderBlock })
      }
      if (app.applyNavBar) app.applyNavBar()
    }
    this.loadImportantDates()
    this.loadTomatoes()
    this.loadHomeSettings()
    this.playIncentiveReveal()
    this.playHomeReveal()
    setTimeout(() => this.measureConfigScroll(), 150)
    this.measureSketchSliders()
    const pendingModules = wx.getStorageSync('exam-timer-pending-modules')
    if (pendingModules) {
      wx.removeStorageSync('exam-timer-pending-modules')
      this.setData({ modules: this.withIds(pendingModules), templateName: '我的习惯', view: 'config' }, this.refreshConfig)
    }
  },

  // 首页主体每次出现都重新播放入场动效
  playHomeReveal() {
    clearTimeout(this.homeRevealTimer)
    clearTimeout(this.homeRevealOffTimer)
    this.setData({ homeReveal: false }, () => {
      this.homeRevealTimer = setTimeout(() => this.setData({ homeReveal: true }), 40)
      // 入场播完就把 reveal 摘掉：否则卡片带 animation-delay，拖动换位后
      // delay 变化会让动画重新排队，被挤走的卡片会先消失再出现
      this.homeRevealOffTimer = setTimeout(() => this.setData({ homeReveal: false }), 1250)
    })
  },

  // 首页激励区每次出现都 Q 弹一下（切回首页、重新进入都生效）
  playIncentiveReveal() {
    clearTimeout(this.incentiveRevealOnTimer)
    clearTimeout(this.incentiveRevealOffTimer)
    this.setData({ incentiveReveal: false }, () => {
      this.incentiveRevealOnTimer = setTimeout(() => {
        this.setData({ incentiveReveal: true })
        this.incentiveRevealOffTimer = setTimeout(() => this.setData({ incentiveReveal: false }), 900)
      }, 40)
    })
  },

  onShareAppMessage() {
    const report = this.data.report
    if (this.data.view === 'report' && report) {
      return {
        title: `本次训练达标率 ${report.passRate}%，实际用时 ${report.totalActualText}`,
        path: '/pages/index/index'
      }
    }
    const total = this.data.modules.reduce((sum, item) => sum + (Number(item.targetMinutes) || 0), 0)
    return {
      title: `用小鱼计时器练 ${this.data.modules.length} 个模块、${total} 分钟`,
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    const total = this.data.modules.reduce((sum, item) => sum + (Number(item.targetMinutes) || 0), 0)
    return {
      title: `小鱼计时器 · ${this.data.modules.length} 个模块 ${total} 分钟备考计划`,
      query: ''
    }
  },

  onUnload() {
    if (this.unbindKeyboard) {
      this.unbindKeyboard()
      this.unbindKeyboard = null
    }
    clearTimeout(this.settleTimer)
    clearTimeout(this.settleTimer2)
    clearTimeout(this.templateSwitchTimer)
    clearTimeout(this.tomatoPopTimer)
    if (this.reportAnimTimer) clearTimeout(this.reportAnimTimer)
    clearTimeout(this.moduleBurstTimer)
    clearTimeout(this.templateBurstTimer)
  },

  // ---- 重要日子倒计时 ----
  loadHomeSettings() {
    const settings = app.getSettings ? app.getSettings() : {}
    this.setData({ incentiveType: settings.incentiveType || 'tomato' })
  },

  // 顶栏返回：任何首页子页面都回到首页主视图
  goHomeView() {
    if (this.data.view === 'report') {
      // 清掉待恢复报告，避免返回首页后又被 onShow 拉回报告页
      wx.removeStorageSync('exam-timer-pending-report')
      wx.removeStorageSync('exam-timer-report-origin')
      const fromHistory = this.data.reportOrigin === 'history'
      this.resetToHome()
      this.setData({ reportOrigin: '' })
      if (fromHistory) wx.switchTab({ url: '/pages/history/history' })
      return
    }
    if (this.data.view !== 'config') {
      this.backToConfig()
      return
    }
  },

  loadImportantDates() {
    const raw = wx.getStorageSync(app.globalData.importantKey)
    const list = (Array.isArray(raw) ? raw : []).map(item => ({
      ...item,
      id: item.id || `important-${item.date}-${item.name}`
    }))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const decorated = list.map(item => this.decorateImportant(item, today)).filter(Boolean)
    decorated.sort((a, b) => {
      const ap = a.diff < 0 ? 1 : 0
      const bp = b.diff < 0 ? 1 : 0
      if (ap !== bp) return ap - bp
      return Math.abs(a.diff) - Math.abs(b.diff)
    })
    const homeCountdowns = decorated.slice(0, 3)
    this.setData({
      importantDates: decorated,
      homeImportantPreview: decorated.slice(0, 3),
      homeCountdowns,
      homeCountdownCount: homeCountdowns.length,
      importantMore: Math.max(0, decorated.length - homeCountdowns.length),
      importantLinkText: decorated.length > 3 ? `全部 ${decorated.length} 个 ›` : '管理 ›'
    })
  },

  decorateImportant(item, today) {
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
      daysAbs: Math.abs(diff),
      countdownNumber: isToday ? '今天' : Math.abs(diff),
      countdownUnit: isToday ? '' : (diff > 0 ? '天后' : '天前'),
      dateText: item.yearly ? `${parts[1]} 月 ${parts[2]} 日` : `${parts[0]}.${pad(parts[1])}.${pad(parts[2])}`,
      monthNum: parts[1],
      dayNum: parts[2],
      monthText: `${parts[1]} 月`,
      weekText: ['日', '一', '二', '三', '四', '五', '六'][new Date(parts[0], parts[1] - 1, parts[2]).getDay()],
      soon: diff >= 0 && diff <= 7,
      isPast: diff < 0
    }
  },

  openImportantModal() {
    const today = dateKey(new Date())
    this.setData({
      importantModalOpen: true,
      importantEditingId: '',
      importantName: '',
      importantDate: today,
      importantDateText: importantDateText(today),
      importantYearly: false,
      importantCalendarOpen: false
    })
    this.refreshImportantCalendar(today)
  },

  editImportant(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.importantDates.find(entry => entry.id === id)
    if (!item) return
    this.setData({
      importantModalOpen: true,
      importantEditingId: item.id,
      importantName: item.name,
      importantDate: item.date,
      importantDateText: importantDateText(item.date),
      importantYearly: item.yearly,
      importantCalendarOpen: false
    })
    this.refreshImportantCalendar(item.date)
  },

  closeImportantModal() {
    this.setData({ importantModalOpen: false, importantCalendarOpen: false })
  },

  onImportantNameInput(event) {
    this.setData({ importantName: event.detail.value })
  },

  toggleImportantYearly() {
    this.setData({ importantYearly: !this.data.importantYearly })
  },

  toggleImportantCalendar() {
    const open = !this.data.importantCalendarOpen
    if (open) this.refreshImportantCalendar(this.data.importantDate || dateKey(new Date()))
    this.setData({ importantCalendarOpen: open })
  },

  buildImportantCalendar(year, month, selectedKey) {
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

  refreshImportantCalendar(dateText) {
    const parts = (dateText || dateKey(new Date())).split('-').map(Number)
    const cal = this.buildImportantCalendar(parts[0], parts[1] - 1, dateText)
    this.setData({ importantCalRows: cal.rows, importantCalTitle: cal.title })
  },

  shiftImportantMonth(event) {
    const step = Number(event.currentTarget.dataset.step) || 0
    const parts = (this.data.importantDate || dateKey(new Date())).split('-').map(Number)
    const target = new Date(parts[0], parts[1] - 1 + step, 1)
    const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    const next = new Date(target.getFullYear(), target.getMonth(), Math.min(parts[2] || 1, maxDay))
    const nextKey = dateKey(next)
    this.setData({ importantDate: nextKey, importantDateText: importantDateText(nextKey) })
    this.refreshImportantCalendar(nextKey)
  },

  selectImportantDay(event) {
    const key = event.currentTarget.dataset.key
    if (!key) return
    this.setData({ importantDate: key, importantDateText: importantDateText(key) })
    this.refreshImportantCalendar(key)
  },

  saveImportantDate() {
    const name = String(this.data.importantName || '').trim()
    if (!name) {
      wx.showToast({ title: '先写一个重要日子', icon: 'none' })
      return
    }
    const date = this.data.importantDate || dateKey(new Date())
    const raw = wx.getStorageSync(app.globalData.importantKey)
    const list = (Array.isArray(raw) ? raw : []).map(entry => ({
      ...entry,
      id: entry.id || `important-${entry.date}-${entry.name}`
    }))
    const item = {
      id: this.data.importantEditingId || `important-${Date.now()}`,
      name: name.slice(0, 16),
      date,
      yearly: !!this.data.importantYearly
    }
    const index = list.findIndex(entry => entry.id === item.id)
    if (index >= 0) list[index] = item
    else list.push(item)
    wx.setStorageSync(app.globalData.importantKey, list)
    this.setData({ importantModalOpen: false, importantCalendarOpen: false })
    this.loadImportantDates()
    wx.showToast({ title: this.data.importantEditingId ? '已更新' : '已添加', icon: 'none' })
  },

  removeImportant(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.importantDates.find(entry => entry.id === id)
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
        this.loadImportantDates()
      }
    })
  },

  // ---- 番茄激励 ----
  loadTomatoes() {
    const count = app.getTomatoCount ? app.getTomatoCount() : 0
    const settings = app.getSettings ? app.getSettings() : {}
    const incentiveType = settings.incentiveType || this.data.incentiveType || 'tomato'
    const tomatoTarget = 5
    const previous = this.lastTomatoCount
    const pop = typeof previous === 'number' && count > previous
    const visibleCount = count === 0 ? 0 : Math.min(count, TOMATO_GRID_LIMIT)
    const icons = count === 0
      ? [{ id: 0, filled: false, delay: 0 }]
      : Array.from({ length: visibleCount }, (_, index) => ({
        id: index,
        filled: true,
        latest: pop && index === visibleCount - 1,
        delay: index < 10 ? index * 24 : 240
      }))
    this.lastTomatoCount = count
    const rows = []
    for (let start = 0; start < icons.length; start += TOMATO_COLUMNS) {
      rows.push({ key: `incentive-row-${start}`, items: icons.slice(start, start + TOMATO_COLUMNS) })
    }
    const progress = Math.min(100, Math.round((count / tomatoTarget) * 100))
    this.setData({
      tomatoCount: count,
      tomatoIcons: icons,
      incentiveRows: rows,
      tomatoProgress: progress,
      tomatoTarget: tomatoTarget,
      incentiveType,
      tomatoCaption: count > TOMATO_GRID_LIMIT ? `×${count}` : '',
      tomatoPop: pop
    })
    if (pop) {
      clearTimeout(this.tomatoPopTimer)
      this.tomatoPopTimer = setTimeout(() => this.setData({ tomatoPop: false }), 700)
    }
  },

  // 点一下首页激励区的图案，就地循环切换激励图案（番茄 → 星星 → 泡泡 → 小鱼）
  // 点一下直接换下一个图案，不再弹提示（图案本身就说明了切换结果）
  cycleIncentive() {
    const order = ['tomato', 'star', 'bubble', 'fish']
    const current = this.data.incentiveType || 'tomato'
    const next = order[(order.indexOf(current) + 1) % order.length]
    if (app.saveSettings) app.saveSettings({ incentiveType: next })
    this.loadTomatoes()
    this.playIncentiveReveal()
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  withIds(modules) {
    return modules.map((item, index) => ({ id: item.id || `module-${Date.now()}-${index}`, name: item.name, targetMinutes: Number(item.targetMinutes) || 0, source: item.source || '' }))
  },

  refreshConfig() {
    const totalMinutes = this.data.modules.reduce((sum, item) => sum + item.targetMinutes, 0)
    this.setData({ totalMinutes })
    setTimeout(() => this.measureConfigScroll(), 150)
  },

  decorateRows(rows) {
    return (rows || []).map((row, index) => Object.assign({}, row, {
      indexLabel: index < 9 ? `0${index + 1}` : `${index + 1}`
    }))
  },

  // 旧记录可能缺少 startedAt，历史文本也可能是上一次渲染留下的 NaN；优先用记录 id 里的时间兜底
  reportStartedAtText(report) {
    if (!report) return ''
    const startedAtText = report.startedAt ? formatDateTime(report.startedAt) : ''
    if (startedAtText) return startedAtText
    const savedText = String(report.startedAtText || '')
    if (savedText && savedText.indexOf('NaN') === -1) return savedText
    const idMatch = String(report.id || '').match(/^record-(\d{10,13})$/)
    return idMatch ? formatDateTime(Number(idMatch[1])) : ''
  },

  prepareReport(report) {
    if (!report) return report
    const startedAtText = this.reportStartedAtText(report)
    if (!report.rows) return Object.assign({}, report, { startedAtText })
    const totalTargetSeconds = report.rows.reduce((sum, item) => sum + (item.targetMinutes || 0) * 60, 0)
    const totalActualSeconds = report.rows.reduce((sum, item) => sum + (item.elapsedSeconds || 0), 0)
    const incompleteCount = report.rows.filter(item => item.skipped || item.status === 'skipped' || (item.status === 'done' && (item.elapsedSeconds || 0) <= 0) || (item.elapsedSeconds || 0) <= 0).length
    const completedRows = report.rows.filter(item => !item.skipped && item.status !== 'skipped' && !(item.status === 'done' && (item.elapsedSeconds || 0) <= 0) && (item.elapsedSeconds || 0) > 0)
    const rows = report.rows.map(item => {
      const elapsed = item.elapsedSeconds || 0
      const targetSeconds = (item.targetMinutes || 0) * 60
      const isSkipped = !!(item.skipped || item.status === 'skipped')
      const statusCode = isSkipped || (item.status === 'done' && elapsed <= 0)
        ? 'skipped'
        : elapsed <= 0
          ? 'incomplete'
          : elapsed > targetSeconds
            ? 'overtime'
            : (targetSeconds > 0 && elapsed >= targetSeconds * 0.85 ? 'near' : 'on-track')
      const statusLabel = statusCode === 'skipped' ? '已跳过' : statusCode === 'incomplete' ? '未完成' : statusCode === 'overtime' ? '超时' : statusCode === 'near' ? '接近阈值' : '达标'
      const deltaText = item.elapsedSeconds === undefined
        ? item.deltaText
        : statusCode === 'skipped'
          ? '已跳过'
          : statusCode === 'incomplete'
            ? '未完成'
            : elapsed > targetSeconds
              ? `超时 ${formatTime(elapsed - targetSeconds)}`
              : `提前 ${formatTime(targetSeconds - elapsed)}`
      // 每行按 计划/实际 里的大者做满格：满格之外不再留轨道，超时/提前都只占满格内的差异段
      const scale = Math.max(elapsed, targetSeconds, 1)
      const planPercent = Math.round(targetSeconds / scale * 100)
      const usedPercent = Math.round(elapsed / scale * 100)
      const diffKind = elapsed > targetSeconds ? 'over' : elapsed < targetSeconds ? 'ahead' : 'equal'
      return {
        ...item,
        statusCode,
        statusLabel,
        deltaText,
        actualText: item.elapsedSeconds !== undefined ? formatTime(elapsed) : item.actualText,
        actualPercent: usedPercent,
        targetPercent: planPercent,
        themePercent: Math.min(planPercent, usedPercent),
        diffPercent: Math.max(0, Math.abs(planPercent - usedPercent)),
        diffKind,
        overPercent: statusCode === 'overtime' ? Math.max(4, usedPercent - planPercent) : 0,
        sharePercent: Math.round(elapsed / Math.max(1, report.totalActual || totalActualSeconds) * 100)
      }
    })
    const slowest = rows.filter(item => (item.elapsedSeconds || 0) > 0).sort((a, b) => (b.elapsedSeconds || 0) - (a.elapsedSeconds || 0))[0]
    const shortest = rows.filter(item => (item.elapsedSeconds || 0) > 0).sort((a, b) => (a.elapsedSeconds || 0) - (b.elapsedSeconds || 0))[0]
    const passRate = completedRows.length ? Math.round(completedRows.filter(item => (item.elapsedSeconds || 0) <= (item.targetMinutes || 0) * 60).length / completedRows.length * 100) : 0
    const verdict = passRate >= 80 ? '节奏很稳' : passRate >= 50 ? '过半达标' : '下次再收一点'
    const overtimeCount = rows.filter(item => item.statusCode === 'overtime').length
    const onTrackCount = rows.filter(item => item.statusCode === 'on-track' || item.statusCode === 'near').length
    const totalScale = Math.max(totalTargetSeconds, totalActualSeconds, 60)
    const planBarPercent = Math.round(totalTargetSeconds / totalScale * 100)
    const actualBarPercent = Math.round(totalActualSeconds / totalScale * 100)
    const timeRate = totalTargetSeconds > 0 ? Math.min(100, Math.round(totalActualSeconds / totalTargetSeconds * 100)) : 0
    const diffSeconds = totalActualSeconds - totalTargetSeconds
    const absDiff = Math.abs(diffSeconds)
    const diffOver = diffSeconds > 0
    const diffText = absDiff < 10
      ? '刚刚好'
      : `${diffOver ? '超时' : '提前'} ${absDiff < 60 ? `${absDiff} 秒` : `${Math.round(absDiff / 60)} 分钟`}`
    let fishTip = ''
    if (!completedRows.length) {
      fishTip = '还没跑完模块，下次先选个短的。'
    } else if (incompleteCount && passRate >= 80) {
      fishTip = `已完成的都收住了，还有 ${incompleteCount} 个没跑完。`
    } else if (incompleteCount && passRate < 50) {
      fishTip = `这次偏赶，还有 ${incompleteCount} 个没跑完。`
    } else if (passRate >= 80) {
      fishTip = `节奏很稳，${onTrackCount} 个模块按计划收住。`
    } else if (passRate >= 50) {
      fishTip = `一半模块跟上节奏，${slowest ? slowest.name : '最长模块'}稍慢。`
    } else {
      fishTip = `这次偏赶，先放宽${slowest ? slowest.name : '最长模块'}的计划。`
    }
    return {
      ...report,
      startedAtText,
      totalActualText: report.totalActual !== undefined ? formatTime(report.totalActual) : report.totalActualText,
      overtimeCount,
      incompleteCount,
      onTrackCount,
      passRate,
      verdict,
      totalTargetSeconds,
      totalTarget: report.totalTarget !== undefined ? report.totalTarget : Math.round(totalTargetSeconds / 60),
      totalActualPercent: Math.min(100, Math.round(totalActualSeconds / Math.max(1, totalTargetSeconds) * 100)),
      planBarPercent,
      actualBarPercent,
      timeRate,
      over: totalActualSeconds > totalTargetSeconds,
      diffOver,
      diffText,
      fishTip,
      slowestName: slowest ? slowest.name : '',
      slowestText: slowest ? slowest.actualText : '',
      shortestName: shortest ? shortest.name : '',
      shortestText: shortest ? shortest.actualText : '',
      rows
    }
  },

  showReport(record, options) {
    const report = this.prepareReport(record)
    const rows = this.decorateRows(report.rows)
    const actualSeconds = report.totalActual !== undefined
      ? report.totalActual
      : report.rows.reduce((sum, item) => sum + (item.elapsedSeconds || 0), 0)
    const workedRows = rows.filter(item => (item.elapsedSeconds || 0) > 0)
    this.setData({
      view: 'report',
      report: { ...report, passRate: 0, totalActualPercent: 0, totalTarget: 0, timeRate: 0, totalActualText: '00:00', diffText: report.diffText, diffOver: report.diffOver },
      reportView: rows,
      reportModuleRows: workedRows.length ? workedRows : rows,
      reportExpanded: false
    })
    this.animateReportNumbers(report.passRate, report.totalActualPercent, report.totalTarget || Math.round(report.totalTargetSeconds / 60), report.timeRate, actualSeconds)
    // 从记录页翻看历史报告时不要 15 秒自动踢走用户
    if (options && options.keepOpen) {
      if (this.reportAutoExitTimer) { clearTimeout(this.reportAutoExitTimer); this.reportAutoExitTimer = null }
    } else {
      this.scheduleReportAutoExit()
    }
    const dock = this.selectComponent && this.selectComponent('#brandDock')
    if (dock && typeof dock.celebrate === 'function') dock.celebrate()
  },

  scheduleReportAutoExit() {
    if (this.reportAutoExitTimer) clearTimeout(this.reportAutoExitTimer)
    this.reportAutoExitTimer = setTimeout(() => {
      this.reportAutoExitTimer = null
      if (this.data.view === 'report') this.backToConfig()
    }, 15000)
  },

  animateReportNumbers(targetRate, targetActual, targetTargetMinutes, targetTimeRate, targetActualSeconds) {
    if (this.reportAnimTimer) clearTimeout(this.reportAnimTimer)
    const duration = 760
    const startAt = Date.now()
    const step = () => {
      const elapsed = Date.now() - startAt
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const currentRate = Math.round(targetRate * eased)
      const currentActual = Math.round(targetActual * eased)
      const currentTarget = Math.round(targetTargetMinutes * eased)
      const currentTimeRate = Math.round(targetTimeRate * eased)
      const currentSeconds = Math.round(targetActualSeconds * eased)
      this.setData({
        'report.passRate': currentRate,
        'report.totalActualPercent': currentActual,
        'report.totalTarget': currentTarget,
        'report.timeRate': currentTimeRate,
        'report.totalActualText': formatTime(currentSeconds)
      })
      if (progress < 1) {
        this.reportAnimTimer = setTimeout(step, 16)
      } else {
        this.reportAnimTimer = null
      }
    }
    step()
  },

  changeModuleName(event) {
    const modules = clone(this.data.modules)
    modules[event.currentTarget.dataset.index].name = event.detail.value
    this.setData({ modules })
  },

  normalizeModuleName(event) {
    const index = Number(event.currentTarget.dataset.index)
    const modules = clone(this.data.modules)
    const name = String(modules[index].name || '').trim()
    if (modules[index].name === name && name) return
    modules[index].name = name || this.nextModuleName(modules, index)
    this.setData({ modules })
  },

  nextModuleName(modules, skipIndex) {
    const used = new Set((modules || []).map((item, index) => (
      index === skipIndex ? '' : String((item && item.name) || '').trim()
    )).filter(Boolean))
    let index = 1
    while (used.has(`新模块 ${index}`)) index += 1
    return `新模块 ${index}`
  },

  changeMinutes(event) {
    this.updateMinutes(event.currentTarget.dataset.index, event.detail.value)
  },
  // 预先缓存所有滑块的位置和宽度，避免第一次按下时等待异步测量，拖动延迟跟手
  measureSketchSliders() {
    setTimeout(() => {
      wx.createSelectorQuery().in(this).selectAll('.sketch-slider').boundingClientRect(rects => {
        if (!Array.isArray(rects) || !rects.length) return
        this.sketchRects = rects.map(rect => rect ? { left: rect.left, width: rect.width } : null)
      }).exec()
    }, 80)
  },

  // 手绘风滑块：用触摸位置换算分钟，替代原生细线 slider
  startSketchSlider(event) {
    const index = Number(event.currentTarget.dataset.index)
    const touch = event.touches && event.touches[0]
    if (!touch) return
    this.sketchDragging = true
    const cached = this.sketchRects && this.sketchRects[index]
    if (cached && cached.width) {
      this.sketchSliderRect = { index, left: cached.left, width: cached.width }
      this.applySketchSlider(touch.clientX)
      return
    }
    wx.createSelectorQuery().in(this).select(`#sketch-slider-${index}`).boundingClientRect(rect => {
      if (!rect || !rect.width) return
      this.sketchSliderRect = { index, left: rect.left, width: rect.width }
      if (this.sketchRects) this.sketchRects[index] = { left: rect.left, width: rect.width }
      this.applySketchSlider(touch.clientX)
    }).exec()
  },

  moveSketchSlider(event) {
    const touch = event.touches && event.touches[0]
    if (!touch || !this.sketchSliderRect) return
    this.applySketchSlider(touch.clientX)
  },

  endSketchSlider() {
    this.sketchSliderRect = null
    this.sketchDragging = false
    this.refreshConfig()
  },

  applySketchSlider(clientX) {
    const rect = this.sketchSliderRect
    if (!rect) return
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const minutes = Math.round(ratio * 60)
    if (minutes === this.data.modules[rect.index].targetMinutes) return
    this.updateMinutes(rect.index, minutes)
  },

  adjustMinutes(event) {
    const index = Number(event.currentTarget.dataset.index)
    const step = Number(event.currentTarget.dataset.step)
    this.updateMinutes(index, this.data.modules[index].targetMinutes + step)
  },

  updateMinutes(index, value) {
    const modules = clone(this.data.modules)
    modules[index].targetMinutes = Math.min(60, Math.max(0, Number(value) || 0))
    const totalMinutes = modules.reduce((sum, item) => sum + item.targetMinutes, 0)
    this.setData({ modules, totalMinutes })
    if (!this.sketchDragging) this.refreshConfig()
  },

  // 点「＋」直接加一个默认模块，名字和时长都在卡片上自己改
  addModuleDirect() {
    const modules = this.data.modules || []
    if (modules.length >= MODULE_LIMIT) {
      wx.showToast({ title: `最多 ${MODULE_LIMIT} 个模块`, icon: 'none' })
      return
    }
    const next = modules.concat({
      id: `module-${Date.now()}`,
      name: this.nextModuleName(modules),
      targetMinutes: 10
    })
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
    this.setData({ modules: next, addVisible: true }, () => {
      this.refreshConfig()
      this.measureSketchSliders()
    })
  },

  removeModule(event) {
    const index = Number(event.currentTarget.dataset.index)
    const module = this.data.modules[index]
    if (!module) return
    wx.showModal({
      title: '删除模块',
      content: `确定删除“${module.name || '未命名模块'}”吗？`,
      confirmText: '删除',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        const modules = this.data.modules.filter((_, itemIndex) => itemIndex !== index)
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
        this.setData({ burstingIndex: index })
        clearTimeout(this.moduleBurstTimer)
        this.moduleBurstTimer = setTimeout(() => {
          this.setData({ modules, burstingIndex: -1 }, this.refreshConfig)
        }, 580)
      }
    })
  },

  // 标题栏的「×」：一次清空当前所有训练模块
  clearModules() {
    const modules = this.data.modules || []
    if (!modules.length) return
    wx.showModal({
      title: '清空训练模块',
      content: `确定删除全部 ${modules.length} 个训练模块吗？`,
      confirmText: '清空',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
        clearTimeout(this.moduleBurstTimer)
        this.setData({
          modules: [],
          burstingIndex: -1,
          dragging: false,
          dragIndex: -1,
          dragStyle: '',
          dragStyles: [],
          settleIndex: -1,
          settleStyle: '',
          templateName: '',
          totalMinutes: 0
        }, this.refreshConfig)
      }
    })
  },

  touchStart(event) {
    const touch = event.touches && event.touches[0]
    if (!touch) return
    this.touchLastY = touch.clientY
    this.dragCandidateIndex = Number(event.currentTarget.dataset.index)
    this.measureStride()
  },

  measureStride() {
    // 量出卡片间距（px），保证拖动时索引换算准确；用中位数避免动画中的卡片干扰
    wx.createSelectorQuery().in(this).selectAll('.module-card').boundingClientRect(rects => {
      if (!Array.isArray(rects) || !rects.length) return
      const tops = rects.filter(rect => rect).map(rect => rect.top)
      if (tops.length > 1) {
        const gaps = tops.slice(1).map((top, index) => Math.round(top - tops[index])).sort((a, b) => a - b)
        const median = gaps[Math.floor(gaps.length / 2)]
        const height = rects[0].height || median
        if (median > 40 && Math.abs(median - height) < height) {
          this.dragStride = median
          return
        }
      }
      if (rects[0] && rects[0].height) this.dragStride = Math.round(rects[0].height + 18)
    }).exec()
  },

  handleTouchStart(event) {
    const touch = event.touches && event.touches[0]
    if (!touch) return
    this.touchLastY = touch.clientY
    this.measureStride()
    this.startDrag(Number(event.currentTarget.dataset.index), touch.clientY)
  },

  activateDrag(event) {
    if (this.dragActive) return
    const index = this.dragCandidateIndex
    if (index === undefined || index === null || index < 0) return
    const touch = event.touches && event.touches[0]
    this.startDrag(index, touch ? touch.clientY : this.touchLastY)
  },

  startDrag(index, startY) {
    if (this.dragActive || index < 0 || index >= this.data.modules.length) return
    clearTimeout(this.settleTimer)
    clearTimeout(this.settleTimer2)
    this.dragActive = true
    this.dragOriginalIndex = index
    this.dragTargetIndex = index
    this.dragBaseY = startY
    this.dragDelta = 0
    this.dragHaptic = false
    clearTimeout(this.dragWatchdog)
    this.dragWatchdog = setTimeout(() => this.touchEnd(), 10000)
    this.setData({
      dragging: true,
      dragIndex: index,
      settleIndex: -1,
      settleStyle: '',
      dragStyle: 'transition: transform 0ms, box-shadow 140ms ease, background-color 140ms ease; transform: translateY(0px); z-index: 4;',
      dragStyles: Array(this.data.modules.length).fill('')
    })
  },

  getStride() {
    if (this.dragStride && this.dragStride > 40) return this.dragStride
    const windowWidth = (wx.getSystemInfoSync && wx.getSystemInfoSync().windowWidth) || 375
    return Math.round(windowWidth * 214 / 750)
  },

  touchMove(event) {
    if (!this.dragActive) return
    const touch = event.touches && event.touches[0]
    if (!touch) return
    const stride = this.getStride()
    const length = this.data.modules.length
    const originalIndex = this.dragOriginalIndex
    const delta = touch.clientY - this.dragBaseY
    const threshold = stride * 0.5
    let targetIndex = this.dragTargetIndex
    while (targetIndex < length - 1 && delta - (targetIndex - originalIndex) * stride > threshold) targetIndex += 1
    while (targetIndex > 0 && delta - (targetIndex - originalIndex) * stride < -threshold) targetIndex -= 1
    this.dragDelta = delta
    this.dragTargetIndex = targetIndex
    if (!this.dragHaptic && Math.abs(delta) > 12 && wx.vibrateShort) {
      this.dragHaptic = true
      wx.vibrateShort({ type: 'light' })
    }
    const dragStyles = Array(length).fill('')
    if (targetIndex > originalIndex) {
      for (let index = originalIndex + 1; index <= targetIndex; index += 1) dragStyles[index] = `transform: translateY(${-stride}px)`
    } else if (targetIndex < originalIndex) {
      for (let index = targetIndex; index < originalIndex; index += 1) dragStyles[index] = `transform: translateY(${stride}px)`
    }
    this.setData({ dragStyles, dragStyle: `transition: transform 0ms; transform: translateY(${Math.round(delta)}px) scale(1.015); z-index: 4;` })
  },

  touchEnd() {
    if (!this.dragActive) return
    this.dragActive = false
    const fromIndex = this.dragOriginalIndex
    const length = this.data.modules.length
    const toIndex = Math.min(length - 1, Math.max(0, this.dragTargetIndex))
    clearTimeout(this.dragWatchdog)
    this.dragHaptic = false
    // 只是点了一下把手、没有真正换位：不重建列表，避免整排卡片重排闪一下
    if (toIndex === fromIndex && Math.abs(this.dragDelta || 0) < 8) {
      this.setData({
        dragging: false,
        dragIndex: -1,
        dragStyle: '',
        dragStyles: Array(length).fill(''),
        settleIndex: -1,
        settleStyle: ''
      })
      return
    }
    const stride = this.getStride()
    const residual = Math.round(this.dragDelta - (toIndex - fromIndex) * stride)
    const modules = clone(this.data.modules)
    const [moved] = modules.splice(fromIndex, 1)
    modules.splice(toIndex, 0, moved)
    const payload = {
      modules,
      dragging: false,
      dragIndex: -1,
      dragStyle: '',
      dragStyles: Array(modules.length).fill('transition: transform 0ms; transform: translateY(0px)'),
      settleIndex: -1,
      settleStyle: ''
    }
    // 松手后把卡片从手指位置平滑吸附到最终格位，避免视觉跳变
    if (Math.abs(residual) > 2) {
      payload.settleIndex = toIndex
      payload.settleStyle = `transition: transform 0ms; transform: translateY(${residual}px) scale(1.015); z-index: 4;`
    }
    this.setData(payload, () => {
      this.refreshConfig()
      const neutral = Array(modules.length).fill('')
      setTimeout(() => this.setData({ dragStyles: neutral }), 16)
      if (payload.settleIndex < 0) return
      clearTimeout(this.settleTimer)
      this.settleTimer = setTimeout(() => {
        this.setData({ settleStyle: 'transition: transform 180ms ease-out; transform: translateY(0px) scale(1); z-index: 4;' })
        this.settleTimer2 = setTimeout(() => this.setData({ settleIndex: -1, settleStyle: '' }), 220)
      }, 48)
    })
  },

  readTemplates() {
    const stored = wx.getStorageSync(app.globalData.templateKey)
    if (!stored || !Array.isArray(stored.templates)) return []
    const seen = {}
    return stored.templates.filter(item => {
      if (!item || !item.name || !Array.isArray(item.modules)) return false
      if (seen[item.name]) return false
      seen[item.name] = true
      return true
    })
  },

  openTemplateModal() {
    this.setData({ templateModalOpen: true, newTemplateName: '' })
  },

  closeTemplateModal() {
    this.setData({ templateModalOpen: false, newTemplateName: '' })
  },

  onTemplateNameInput(event) {
    this.setData({ newTemplateName: event.detail.value })
  },

  confirmTemplate() {
    const name = (this.data.newTemplateName || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入模板名称', icon: 'none' })
      return
    }
    this.persistTemplate(name)
  },

  measureConfigScroll() {
    wx.createSelectorQuery()
      .select('.config-scroll')
      .boundingClientRect()
      .select('.config-scroll .page-content')
      .boundingClientRect()
      .exec((res) => {
        const scrollRect = res && res[0]
        const contentRect = res && res[1]
        if (!scrollRect || !contentRect) return
        this.configScrollHeight = scrollRect.height
        const canScroll = contentRect.height > scrollRect.height + 16
        if (!canScroll) {
          if (!this.data.addVisible) this.setData({ addVisible: true })
        }
      })
  },

  onConfigScroll(event) {
    const detail = event.detail || {}
    const nextDockDim = (detail.scrollTop || 0) > 48
    if (nextDockDim !== this.data.dockDim) this.setData({ dockDim: nextDockDim })
    const scrollHeight = detail.scrollHeight || 0
    if (!scrollHeight) return
    const viewHeight = this.configScrollHeight || detail.scrollHeight
    const nearBottom = detail.scrollTop + viewHeight >= scrollHeight - 48
    if (nearBottom !== this.data.addVisible) this.setData({ addVisible: nearBottom })
  },

  onConfigBottom() {
    if (!this.data.addVisible) this.setData({ addVisible: true })
  },

  saveTemplateSnapshot(name, overwrite) {
    const seen = {}
    const templates = (this.data.templates || []).filter(item => {
      if (!item || !item.name) return false
      if (seen[item.name]) return false
      seen[item.name] = true
      return true
    })
    const nextTemplate = { name, modules: clone(this.data.modules) }
    const index = templates.findIndex(item => item.name === name)
    if (index >= 0 && !overwrite) {
      wx.showToast({ title: '已有同名模板，换个名字', icon: 'none' })
      return false
    }
    if (index >= 0) templates[index] = nextTemplate
    else templates.push(nextTemplate)
    try {
      wx.setStorageSync(app.globalData.templateKey, { currentName: name, templates })
    } catch (error) {
      wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
      return false
    }
    this.setData({
      templates,
      templateName: name,
      templateModalOpen: false,
      newTemplateName: '',
      templateSwitching: true
    }, () => {
      clearTimeout(this.templateSwitchTimer)
      this.templateSwitchTimer = setTimeout(() => this.setData({ templateSwitching: false }), 260)
    })
    wx.showToast({ title: overwrite ? '当前模板已更新' : '新模板已保存', icon: 'success' })
    return true
  },

  persistTemplate(name) {
    this.saveTemplateSnapshot(name, false)
  },

  saveCurrentTemplate() {
    const name = this.data.templateName
    if (!name) return
    wx.showModal({
      title: '保存当前模板',
      content: `用当前模块覆盖“${name}”？其他模板不会改变。`,
      confirmText: '保存',
      success: ({ confirm }) => {
        if (confirm) this.saveTemplateSnapshot(name, true)
      }
    })
  },

  removeTemplate(event) {
    const name = event.currentTarget.dataset.name
    if (!name) return
    wx.showModal({
      title: '删除模板',
      content: `确定删除“${name}”吗？`,
      confirmText: '删除',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        const templates = (this.data.templates || []).filter(item => item.name !== name)
        const fallback = templates.length ? templates[0] : null
        const currentName = this.data.templateName === name ? (fallback ? fallback.name : '常规') : this.data.templateName
        try {
          wx.setStorageSync(app.globalData.templateKey, { currentName, templates })
        } catch (error) {
          wx.showToast({ title: '删除失败，请稍后重试', icon: 'none' })
          return
        }
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
        this.setData({ burstingTemplate: name })
        clearTimeout(this.templateBurstTimer)
        this.templateBurstTimer = setTimeout(() => {
          const payload = { templates, templateName: currentName, burstingTemplate: '' }
          if (this.data.templateName === name && fallback && fallback.modules) {
            payload.modules = this.withIds(clone(fallback.modules))
          }
          this.setData(payload, () => {
            if (payload.modules) this.refreshConfig()
          })
          wx.showToast({ title: '模板已删除', icon: 'none' })
        }, 580)
      }
    })
  },

  blockTouch() {},

  goPage(url) {
    wx.navigateTo({
      url,
      fail: (error) => {
        const message = (error && error.errMsg) || '未知错误'
        wx.showModal({
          title: '页面打不开',
          content: `${url}\n${message}\n如果是 page is not found，请在开发者工具里点「编译」重新构建（新加了页面需要重新注册）。`,
          showCancel: false,
          confirmText: '知道了'
        })
      }
    })
  },
  chooseMode(event) {
    const key = event.currentTarget.dataset.key
    const modeInfo = (this.data.modes || []).find(item => item.key === key)
    if (!modeInfo) return
    wx.setStorageSync(app.globalData.modeKey, key)
    this.setModeData(modeInfo)
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
  },

  setModeData(modeInfo) {
    this.setData({ mode: modeInfo.key, modeName: modeInfo.name })
  },
  loadTemplate(event) {
    const template = this.data.templates[Number(event.currentTarget.dataset.index)]
    if (!template || !template.modules) return
    this.setData({
      templateName: template.name,
      modules: this.withIds(clone(template.modules)),
      templateSwitching: true
    }, () => {
      this.refreshConfig()
      clearTimeout(this.templateSwitchTimer)
      this.templateSwitchTimer = setTimeout(() => this.setData({ templateSwitching: false }), 260)
    })
  },

  // 唯一的开始入口：写 session 后直接进计时页
  beginTraining(modules, mode) {
    const runtimeModules = (modules || []).map(item => ({
      ...clone(item),
      elapsedSeconds: 0,
      status: item.targetMinutes === 0 ? 'done' : 'pending'
    }))
    const firstIndex = runtimeModules.findIndex(item => item.status !== 'done')
    if (firstIndex === -1) {
      wx.showToast({ title: '请设置有效的模块时长', icon: 'none' })
      return
    }
    runtimeModules[firstIndex].status = 'current'
    const startedAt = Date.now()
    const useMode = mode || 'countup'
    const totalTargetSeconds = runtimeModules.reduce((sum, item) => sum + (item.targetMinutes || 0) * 60, 0)
    wx.setStorageSync(app.globalData.modeKey, useMode)
    wx.setStorageSync(app.globalData.storageKey, {
      modules: runtimeModules,
      startedAt,
      currentIndex: firstIndex,
      globalSeconds: 0,
      moduleSeconds: 0,
      isPaused: false,
      mode: useMode,
      totalTargetSeconds,
      tickSound: app.getSettings().tickSound === true
    })
    this.launchTimer()
  },

  // 进入横屏计时页前先铺满主题底色，遮住转屏瞬间上一页被放大的画面
  launchTimer() {
    if (this.data.timerLaunching) return
    this.setData({ timerLaunching: true }, () => {
      clearTimeout(this.timerCoverTimer)
      this.timerCoverTimer = setTimeout(() => {
        wx.navigateTo({
          url: '/pages/blank/blank?mode=enter',
          fail: () => this.setData({ timerLaunching: false })
        })
      }, 60)
    })
  },

  startTraining() {
    this.beginTraining(this.data.modules, this.data.mode || 'countup')
  },

  handleBack() {
    if (this.data.view !== 'config') {
      this.backToConfig()
      return
    }
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
      return
    }
    wx.showToast({ title: '当前已是首页', icon: 'none' })
  },

  restartTraining() {
    if (this.reportAutoExitTimer) {
      clearTimeout(this.reportAutoExitTimer)
      this.reportAutoExitTimer = null
    }
    const report = this.data.report || {}
    let rows = report.rows || []
    // 当前报告没带模块时，退回最近一次训练记录，避免点了没反应
    if (!rows.length) {
      const records = wx.getStorageSync(app.globalData.recordsKey) || []
      const latest = records[0]
      if (latest && Array.isArray(latest.rows) && latest.rows.length) rows = latest.rows
    }
    if (!rows.length) {
      wx.showToast({ title: '没有可重练的模块', icon: 'none' })
      return
    }
    // 上一次进计时页的遮罩状态若没清干净，launchTimer 会静默 return
    if (this.data.timerLaunching) {
      clearTimeout(this.timerCoverTimer)
      this.setData({ timerLaunching: false })
    }
    this.beginTraining(
      rows.map(item => ({ id: item.id, name: item.name, targetMinutes: item.targetMinutes })),
      report.mode || this.data.mode || 'countup'
    )
  },

  // 首页只保留模块化计时；番茄钟独立在快捷计时里，不再和模块混用
  backToConfig() {
    if (this.reportAnimTimer) {
      clearTimeout(this.reportAnimTimer)
      this.reportAnimTimer = null
    }
    if (this.reportAutoExitTimer) {
      clearTimeout(this.reportAutoExitTimer)
      this.reportAutoExitTimer = null
    }
    wx.removeStorageSync('exam-timer-pending-report')
    wx.removeStorageSync('exam-timer-report-origin')
    this.reportLeftPage = false
    this.setData({ view: 'config', reportOrigin: '' }, this.refreshConfig)
  },

  // 底部 Dock 点“首页”时使用：无论在报告页还是临时计时首页，都回到主工作台
  resetToHome() {
    if (this.reportAnimTimer) {
      clearTimeout(this.reportAnimTimer)
      this.reportAnimTimer = null
    }
    if (this.reportAutoExitTimer) {
      clearTimeout(this.reportAutoExitTimer)
      this.reportAutoExitTimer = null
    }
    this.reportLeftPage = false
    this.setData({ view: 'config' }, this.refreshConfig)
  },

  onTabItemTap() {
    if (this.data.view === 'report') this.resetToHome()
  },
  openImportantPage() {
    wx.navigateTo({ url: '/pages/important/important' })
  },
  loadReportLogo() {
    if (this.reportLogoImage || this.reportLogoLoading) return
    this.reportLogoLoading = true
    loadImage('/assets/brand/logo-mark.png').then(image => {
      this.reportLogoLoading = false
      if (image) this.reportLogoImage = image
    })
  },

  createReportImage(callback) {
    const report = this.data.report || {}
    const theme = (app.getTheme && app.getTheme()) || {}
    const palette = theme.canvas || {
      bg: '#FBF3DF', card: '#FFFCF2', panel: '#4B3A2A', onPanel: '#FFFCF2', ink: '#4B3A2A',
      sub: '#8A7048', accent: '#FFE7A5', soft: '#FFF3D6', highlight: '#FFD166', success: '#4F9B74', danger: '#E8442F'
    }
    const tone = theme.css || {}
    const edge = tone.edge || palette.panel
    const shadow = tone.shadow || palette.panel
    const card = palette.card
    const accentBg = tone['accent-bg'] || palette.accent
    const cream1 = tone['cream-1'] || palette.soft
    const line = tone.line || palette.soft
    const primary = tone.primary || palette.highlight
    const successBg = tone['success-bg'] || palette.soft
    const dangerBg = tone['danger-bg'] || palette.soft
    const dangerText = tone['danger-text'] || palette.danger
    const successText = tone['success-text'] || palette.success
    const successFill = tone.success || palette.success
    const W = 750
    const H = 1200
    if (!isSupported()) {
      wx.showModal({ title: '导出失败', content: '当前版本不支持生成图片', showCancel: false })
      callback('')
      return
    }
    let painter = null
    try {
      painter = createPainter(W, H, 2)
    } catch (error) {
      console.warn('[report] createPainter failed', error)
    }
    if (!painter) {
      callback('')
      wx.showModal({ title: '导出失败', content: '图片生成失败，请手动截图保存报告', showCancel: false })
      return
    }
    const context = painter.context
    const M = 48
    const CW = W - M * 2
    const allRows = report.rows || []
    const workedRows = allRows.filter(row => (row.elapsedSeconds || 0) > 0)
    const trackedRows = workedRows.length ? workedRows : allRows
    // 海报最多排 4 个模块，多出来的在框底补一行说明
    const listRows = trackedRows.slice(0, 4)
    const moreCount = Math.max(0, trackedRows.length - listRows.length)

    const totalTargetSeconds = report.totalTargetSeconds || allRows.reduce((sum, item) => sum + (item.targetMinutes || 0) * 60, 0)
    const totalActualSeconds = trackedRows.reduce((sum, item) => sum + (item.elapsedSeconds || 0), 0)
    const totalScale = Math.max(totalTargetSeconds, totalActualSeconds, 60)
    const planBarPercent = report.planBarPercent !== undefined
      ? report.planBarPercent
      : Math.round(totalTargetSeconds / totalScale * 100)
    const actualBarPercent = report.actualBarPercent !== undefined
      ? report.actualBarPercent
      : Math.round(totalActualSeconds / totalScale * 100)
    const diffOver = report.diffOver !== undefined ? report.diffOver : totalActualSeconds > totalTargetSeconds
    const diffText = report.diffText || (diffOver ? '超时' : '提前')
    const diffNeutral = !diffOver && String(diffText).indexOf('刚刚好') === 0
    const diffColor = diffNeutral ? palette.ink : diffOver ? dangerText : successText
    const diffBg = diffNeutral ? cream1 : diffOver ? dangerBg : successBg
    const passRate = Math.max(0, Math.min(100, report.passRate || 0))
    const actualLabel = totalActualSeconds > 0 ? formatTime(totalActualSeconds) : (report.totalActualText || '00:00')
    const targetLabel = `${report.totalTarget || Math.round(totalTargetSeconds / 60)} 分`
    const modeLabel = report.modeName || this.data.modeName || '专注'

    const rightText = (text, rightX, baseline, size, color) => {
      const value = String(text || '')
      context.setFontSize(size)
      context.setFillStyle(color)
      context.fillText(value, rightX - context.measureText(value).width, baseline)
    }
    const pillWidth = (text, size) => {
      context.setFontSize(size)
      return context.measureText(String(text || '')).width + 26
    }

    // 底色 + 两侧留白里的浅色泡泡
    context.setFillStyle(palette.bg)
    context.fillRect(0, 0, W, H)
    draw.circle(context, 26, 302, 7, cream1)
    draw.circle(context, 724, 902, 7, cream1)

    // 页头：品牌 logo + 报告名 + 日期
    if (this.reportLogoImage) {
      context.drawImage(this.reportLogoImage, M, 26, 40, 40)
    }
    context.setFillStyle(palette.sub)
    context.setFontSize(18)
    context.fillText('小鱼计时器 · 训练报告', this.reportLogoImage ? M + 52 : M, 64)
    rightText(report.startedAtText || '', W - M, 64, 18, palette.sub)

    context.setFillStyle(palette.ink)
    context.setFontWeight(900)
    context.setFontSize(44)
    context.fillText('训练分析', M, 128)
    context.setFontWeight(700)

    const modeText = `${modeLabel} · ${allRows.length} 个模块`
    context.setFontSize(17)
    const modeW = Math.min(CW - 220, context.measureText(modeText).width + 40)
    draw.stickerPill(context, W - M - modeW, 96, modeW, 34, accentBg, edge, draw.fitText(context, modeText, modeW - 30), palette.ink, 17)

    // 成绩卡：实际专注大数字 + 计划达成环 + 三枚状态胶囊（和小程序顶部那张一致）
    draw.stickerCard(context, M, 152, CW, 252, 28, card, edge, shadow, 6)
    draw.roundRect(context, M + 2, 156, 9, 244, 5, primary)
    context.setFillStyle(palette.sub)
    context.setFontSize(17)
    context.fillText('实际专注', M + 30, 190)
    context.setFillStyle(palette.ink)
    context.setFontWeight(900)
    context.setFontSize(46)
    context.fillText(actualLabel, M + 30, 246)
    context.setFontWeight(700)
    context.setFillStyle(palette.sub)
    context.setFontSize(17)
    context.fillText(`计划 ${targetLabel}`, M + 30, 278)

    draw.ring(context, 604, 224, 54, passRate, line, primary, 9)
    draw.circle(context, 604, 224, 38, card)
    context.setFillStyle(palette.ink)
    context.setFontWeight(900)
    context.setFontSize(34)
    const scoreText = `${passRate}`
    const scoreW = context.measureText(scoreText).width
    context.fillText(scoreText, 604 - scoreW / 2, 236)
    context.setFontWeight(700)
    context.setFillStyle(palette.sub)
    context.setFontSize(15)
    const rateW = context.measureText('计划达成').width
    context.fillText('计划达成', 604 - rateW / 2, 258)

    const pillGap = 12
    const pillW = (CW - 48 - pillGap * 2) / 3
    const statPills = [
      { value: `${report.onTrackCount || 0}`, label: '达标', bg: cream1, color: palette.ink },
      { value: `${report.overtimeCount || 0}`, label: '超时', bg: report.overtimeCount ? dangerBg : cream1, color: report.overtimeCount ? dangerText : palette.ink },
      { value: `${allRows.length}`, label: '模块', bg: cream1, color: palette.ink }
    ]
    statPills.forEach((item, index) => {
      const x = M + 24 + index * (pillW + pillGap)
      draw.stickerPill(context, x, 316, pillW, 44, item.bg, edge, `${item.value}  ${item.label}`, item.color, 18)
    })

    // 时长对比框：只留一句「超时 / 提前多少」，红绿大字
    draw.stickerCard(context, M, 428, CW, 128, 28, card, edge, shadow, 6)
    context.setFillStyle(palette.ink)
    context.setFontWeight(900)
    context.setFontSize(22)
    context.fillText('时长对比', M + 24, 468)
    context.setFillStyle(diffColor)
    context.setFontSize(36)
    context.fillText(draw.fitText(context, diffText, CW - 48), M + 24, 528)
    context.setFontWeight(700)

    // 模块明细框：一个模块一张小卡，超时用红底进度条 + 主题色计划段 + 红色超时段
    const modTop = 578
    const modMaxH = 450
    const modCardH = listRows.length
      ? Math.min(92, (modMaxH - 56 - (listRows.length - 1) * 10 - 24) / listRows.length)
      : 0
    const modH = listRows.length
      ? 56 + listRows.length * modCardH + (listRows.length - 1) * 10 + 24
      : 132
    draw.stickerCard(context, M, modTop, CW, modH, 28, card, edge, shadow, 6)
    context.setFillStyle(palette.ink)
    context.setFontWeight(900)
    context.setFontSize(22)
    context.fillText('模块明细', M + 24, modTop + 40)
    context.setFontWeight(700)
    const listedOnTrack = trackedRows.filter(item => item.statusCode === 'on-track' || item.statusCode === 'near').length
    const metaText = moreCount
      ? `${trackedRows.length} 个模块 · ${listedOnTrack} 达标 · 列出前 ${listRows.length}`
      : `${listedOnTrack}/${trackedRows.length} 达标`
    rightText(metaText, W - M - 22, modTop + 40, 16, palette.sub)

    if (listRows.length) {
      const gap = 10
      const cardH = modCardH
      const startY = modTop + 56
      listRows.forEach((item, index) => {
        const y = startY + index * (cardH + gap)
        const x = M + 20
        const w = CW - 40
        const over = item.statusCode === 'overtime'
        draw.stickerCard(context, x, y, w, cardH, 20, cream1, edge, shadow, 3)
        context.setFillStyle(palette.ink)
        context.setFontWeight(900)
        context.setFontSize(19)
        context.fillText(draw.fitText(context, item.name || '', w - 160), x + 16, y + 26)
        context.setFontWeight(700)
        const tagText = item.statusLabel || (over ? '超时' : item.statusCode === 'near' ? '接近阈值' : '达标')
        const tagW = pillWidth(tagText, 14)
        const tagColor = over ? dangerText : item.statusCode === 'near' ? palette.ink : successText
        const tagBg = over ? dangerBg : item.statusCode === 'near' ? accentBg : successBg
        draw.stickerPill(context, x + w - 14 - tagW, y + 6, tagW, 24, tagBg, edge, tagText, tagColor, 14)

        context.setFillStyle(palette.sub)
        context.setFontSize(15)
        const planTime = `${item.targetMinutes}:00`
        const metaY = y + cardH - 28
        context.fillText(`计划 ${planTime} · 实际 ${item.actualText}`, x + 16, metaY)
        if (item.deltaText) {
          rightText(item.deltaText, x + w - 14, metaY, 15, over ? dangerText : successText)
        }

        const barY = y + cardH - 18
        const barX = x + 16
        const barW = w - 32
        // 满格 = 计划/实际里的大者；主题色 = 计划内完成的部分；红 = 超时，绿 = 提前
        const planPct = Math.min(100, item.targetPercent !== undefined ? item.targetPercent : 0)
        const actualPct = Math.min(100, item.actualPercent !== undefined ? item.actualPercent : 0)
        const themePct = Math.min(100, item.themePercent !== undefined ? item.themePercent : Math.min(planPct, actualPct))
        const diffPct = Math.max(0, Math.min(100 - themePct, item.diffPercent !== undefined ? item.diffPercent : Math.abs(planPct - actualPct)))
        draw.roundRect(context, barX, barY, barW, 10, 5, line)
        if (themePct > 0) {
          draw.roundRect(context, barX, barY, Math.max(5, barW * themePct / 100), 10, 5, primary)
        }
        if (diffPct > 0) {
          draw.roundRect(context, barX + barW * themePct / 100, barY, Math.max(4, barW * diffPct / 100), 10, 5, over ? palette.danger : successFill)
        }
        // 计划线位置放一枚圆把手，和首页训练模块的滑杆一致
        const knobX = barX + barW * themePct / 100
        draw.circle(context, knobX, barY + 5, 9, edge)
        draw.circle(context, knobX, barY + 5, 6, primary)
      })
    } else {
      context.setFillStyle(palette.sub)
      context.setFontSize(18)
      context.fillText('这次没有跑完任何模块', M + 24, modTop + 100)
    }

    // 小鱼复盘框（跟着模块框走，模块少时整体上收）
    const fishTop = Math.min(1046, modTop + modH + 18)
    draw.stickerCard(context, M, fishTop, CW, 78, 24, card, edge, shadow, 5)
    if (this.reportLogoImage) {
      draw.roundRect(context, M + 16, fishTop + 17, 44, 44, 14, accentBg)
      context.drawImage(this.reportLogoImage, M + 22, fishTop + 23, 32, 32)
    }
    const fishX = M + (this.reportLogoImage ? 74 : 22)
    context.setFillStyle(palette.sub)
    context.setFontWeight(900)
    context.setFontSize(16)
    context.fillText('小鱼复盘', fishX, fishTop + 28)
    context.setFillStyle(palette.ink)
    context.setFontWeight(700)
    context.setFontSize(18)
    context.fillText(draw.fitText(context, report.fishTip || '继续保持专注节奏', CW - (fishX - M) - 24), fishX, fishTop + 60)

    // 页脚
    const footY = Math.min(1166, fishTop + 78 + 44)
    context.setFillStyle(palette.sub)
    context.setFontSize(16)
    context.fillText('小鱼计时器 · 专注记录', M, footY)
    rightText('长按保存 / 分享', W - M, footY, 16, palette.sub)

    context.draw(false, () => this.exportReportImage(painter, callback))
  },

  exportReportImage(painter, callback) {
    exportPainter(painter, 1500, 2400).then(path => {
      if (path) {
        callback(path)
        return
      }
      console.warn('[report] canvasToTempFilePath failed')
      callback('')
      wx.showModal({ title: '导出失败', content: '图片生成失败，请手动截图保存报告', showCancel: false })
    })
  },

  exportReport() {
    const settings = app.getSettings ? app.getSettings() : {}
    if (settings.privacyAlbum === false) {
      wx.showModal({
        title: '相册保存已关闭',
        content: '可在设置 → 隐私与权限里重新打开「保存图片到相册」。',
        confirmText: '去设置',
        success: res => { if (res.confirm) wx.navigateTo({ url: '/pages/settings/settings' }) }
      })
      return
    }
    wx.showLoading({ title: '正在生成…', mask: true })
    this.createReportImage(tempFilePath => {
      wx.hideLoading()
      if (!tempFilePath) return
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => wx.showToast({ title: '打卡图已保存', icon: 'success' }),
        fail: error => wx.showModal({ title: '保存失败', content: error.errMsg || '请允许保存到相册后重试', showCancel: false })
      })
    })
  },

  shareReport() {
    wx.showLoading({ title: '正在生成…', mask: true })
    this.createReportImage((tempFilePath) => {
      wx.hideLoading()
      if (!tempFilePath) return
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({
          path: tempFilePath,
          fail: () => wx.previewImage({ current: tempFilePath, urls: [tempFilePath] })
        })
        return
      }
      wx.showModal({
        title: '当前版本不支持直接分享图片',
        content: '已生成打卡图，可点「预览」后长按图片转发，或先「保存」到相册再发。',
        showCancel: false
      })
    })
  }
})
