const MODULE_LIMIT = 8
const DEFAULT_MODULES = [
  { name: '资料分析', targetMinutes: 25 },
  { name: '判断推理', targetMinutes: 35 },
  { name: '言语理解', targetMinutes: 34 },
  { name: '政治理论', targetMinutes: 12 },
  { name: '常识判断', targetMinutes: 9 },
  { name: '数量关系', targetMinutes: 5 }
]

const QUOTES = ['稳定节奏，持续精进。', '今天的坚持，是明天的底气。', '把时间用在真正重要的事情上。']
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const TOMATO_SHOW_LIMIT = 8
const app = getApp()

function importantDateText(key) {
  const parts = String(key || '').split('-').map(Number)
  if (!parts[0] || !parts[1] || !parts[2]) return ''
  return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`
}

const { pad, clock: formatTime, dateTimeText: formatDateTime, clone, fold, dateKey } = require('../../utils/format')

Page({
  data: {
    view: 'config',
    modules: [],
    totalMinutes: 0,
    templateName: '常规',
    dragIndex: -1,
    progressPercent: 0,
    completedCount: 0,
    isOvertime: false,
    addVisible: false,
    presetSheetOpen: false,
    presets: [
      { name: '资料分析', minutes: 25 },
      { name: '判断推理', minutes: 35 },
      { name: '言语理解', minutes: 34 },
      { name: '政治理论', minutes: 12 },
      { name: '常识判断', minutes: 9 },
      { name: '数量关系', minutes: 5 },
      { name: '英语阅读', minutes: 30 },
      { name: '单词记忆', minutes: 15 },
      { name: '专业课复习', minutes: 40 }
    ],
    report: null,
    templates: [],
    templateSwitching: false,
    reportView: [],
    reportExpanded: false,
    dragStyle: '',
    dragStyles: [],
    dragging: false,
    settleIndex: -1,
    settleStyle: '',
    templateModalOpen: false,
    newTemplateName: '',
    theme: 'rose', themeStyle: '',
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
    tomatoCaption: '完成计时收番茄',
    tomatoPop: false,
    homePrimary: 'timer',
    homeTimerOverride: false,
    homeTodo: null,
    homeTodoPreview: [],
    homeImportantPreview: [],
    homeStats: null,
    // 首页只看最近 3 个倒计时
    homeCountdowns: [],
    homeCountdownCount: 0,
    importantMore: 0,
    importantLinkText: '管理 ›'
  },

  onLoad() {
    this.setOrientation('portrait')
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    const modes = (app.modes || []).map(item => ({ ...item }))
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
    const savedSession = wx.getStorageSync(app.globalData.storageKey)
    const savedTemplates = this.readTemplates()
    const savedCurrentName = (wx.getStorageSync(app.globalData.templateKey) || {}).currentName
    const savedTemplate = savedTemplates.find(item => item.name === savedCurrentName) || savedTemplates[0]
    const modules = savedTemplate && savedTemplate.modules && savedTemplate.modules.length ? savedTemplate.modules : DEFAULT_MODULES
    this.setData({
      modules: this.withIds(modules),
      templateName: savedTemplate && savedTemplate.name ? savedTemplate.name : '常规',
      templates: savedTemplates
    }, this.refreshConfig)
    if (savedSession && savedSession.modules && savedSession.startedAt) {
      wx.showModal({
        title: '发现未完成训练',
        content: '是否恢复上次的计时进度？',
        confirmText: '恢复',
        cancelText: '放弃',
        success: ({ confirm }) => confirm ? wx.navigateTo({ url: '/pages/timer/timer' }) : wx.removeStorageSync(app.globalData.storageKey)
      })
    }
    this.loadImportantDates()
    this.loadTomatoes()
    this.loadHomeConfig()
    this.loadHomeTodo()
    this.loadHomeStats()
  },

  onHide() {
    if (this.dragActive) this.touchEnd()
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().sync()
    const homeTimerRequest = wx.getStorageSync('exam-timer-home-timer')
    if (homeTimerRequest) wx.removeStorageSync('exam-timer-home-timer')
    this.setData({ homeTimerOverride: !!homeTimerRequest })
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
    this.loadHomeConfig()
    this.loadHomeTodo()
    this.loadHomeStats()
    setTimeout(() => this.measureConfigScroll(), 150)
    const report = wx.getStorageSync('exam-timer-pending-report')
    if (report) {
      wx.removeStorageSync('exam-timer-pending-report')
      this.setOrientation('portrait')
      this.showReport(report)
      return
    }
    const pendingModules = wx.getStorageSync('exam-timer-pending-modules')
    if (pendingModules) {
      wx.removeStorageSync('exam-timer-pending-modules')
      this.setOrientation('portrait')
      this.setData({ modules: this.withIds(pendingModules), templateName: '我的习惯', view: 'config' }, this.refreshConfig)
    }
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
      title: `用泡泡计时器练 ${this.data.modules.length} 个模块、${total} 分钟`,
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    const total = this.data.modules.reduce((sum, item) => sum + (Number(item.targetMinutes) || 0), 0)
    return {
      title: `泡泡计时器 · ${this.data.modules.length} 个模块 ${total} 分钟备考计划`,
      query: ''
    }
  },

  onUnload() {
    clearTimeout(this.settleTimer)
    clearTimeout(this.settleTimer2)
    clearTimeout(this.templateSwitchTimer)
    clearTimeout(this.tomatoPopTimer)
  },

  // ---- 重要日子倒计时 ----
  loadHomeConfig() {
    const settings = app.getSettings ? app.getSettings() : {}
    let primary = settings.homePrimary || 'timer'
    if (primary === 'todo') {
      primary = 'timer'
      if (app.saveSettings) app.saveSettings({ homePrimary: 'timer' })
    }
    this.setData({ homePrimary: primary })
  },

  loadHomeTodo() {
    const todos = wx.getStorageSync(app.globalData.todoKey) || []
    const pending = todos.filter(item => !item.done).sort((a, b) => {
      const at = a.dueAt || Number.MAX_SAFE_INTEGER
      const bt = b.dueAt || Number.MAX_SAFE_INTEGER
      return at - bt
    })
    const preview = pending.slice(0, 3).map(item => {
      const date = item.dueAt ? new Date(item.dueAt) : null
      const todayKey = dateKey(new Date())
      const timeText = date
        ? (dateKey(date) === todayKey ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`)
        : ''
      return { id: item.id, text: item.text, timeText, overdue: !!(item.dueAt && item.dueAt < Date.now()) }
    })
    if (!pending.length) {
      if (this.data.homeTodo || this.data.homeTodoPreview.length) this.setData({ homeTodo: null, homeTodoPreview: [] })
      return
    }
    const todo = pending[0]
    const date = todo.dueAt ? new Date(todo.dueAt) : null
    const today = dateKey(new Date())
    const timeText = date
      ? (dateKey(date) === today ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`)
      : ''
    this.setData({
      homeTodo: {
        id: todo.id,
        text: todo.text,
        timeText,
        overdue: !!(todo.dueAt && todo.dueAt < Date.now())
      },
      homeTodoPreview: preview
    })
  },

  openTodoPage() {
    wx.navigateTo({ url: '/pages/todo/todo' })
  },

  loadHomeStats() {
    const summary = app.dailyStats ? app.dailyStats() : {}
    this.setData({
      homeStats: {
        percent: summary.todayPercent || 0,
        streak: summary.streak || 0,
        weekDays: summary.weekDays || 0
      }
    })
  },

  openStatsPage() {
    wx.navigateTo({ url: '/pages/stats/stats' })
  },

  exitTimerOverride() {
    this.setData({ homeTimerOverride: false })
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
    const shown = Math.min(count, TOMATO_SHOW_LIMIT)
    const icons = Array.from({ length: shown }, (_, index) => index)
    const previous = this.lastTomatoCount
    const pop = typeof previous === 'number' && count > previous
    this.lastTomatoCount = count
    this.setData({
      tomatoCount: count,
      tomatoIcons: icons,
      tomatoCaption: count ? `${count} 颗番茄` : '完成计时收番茄',
      tomatoPop: pop
    })
    if (pop) {
      clearTimeout(this.tomatoPopTimer)
      this.tomatoPopTimer = setTimeout(() => this.setData({ tomatoPop: false }), 700)
    }
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

  prepareReport(report) {
    if (!report || !report.rows) return report
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
      // 每行按自己的目标/实际最大值做满格，短模块也不会缩成一条线
      const rawMax = Math.max(elapsed, targetSeconds, 60)
      const scale = rawMax * 1.06
      return {
        ...item,
        statusCode,
        statusLabel,
        deltaText,
        actualText: item.elapsedSeconds !== undefined ? formatTime(elapsed) : item.actualText,
        actualPercent: Math.round(elapsed / scale * 100),
        targetPercent: Math.round(targetSeconds / scale * 100),
        sharePercent: Math.round(elapsed / Math.max(1, report.totalActual || totalActualSeconds) * 100)
      }
    })
    const slowest = rows.filter(item => (item.elapsedSeconds || 0) > 0).sort((a, b) => (b.elapsedSeconds || 0) - (a.elapsedSeconds || 0))[0]
    const shortest = rows.filter(item => (item.elapsedSeconds || 0) > 0).sort((a, b) => (a.elapsedSeconds || 0) - (b.elapsedSeconds || 0))[0]
    return {
      ...report,
      startedAtText: report.startedAt ? formatDateTime(report.startedAt) : report.startedAtText,
      totalActualText: report.totalActual !== undefined ? formatTime(report.totalActual) : report.totalActualText,
      overtimeCount: rows.filter(item => item.statusCode === 'overtime').length,
      incompleteCount,
      onTrackCount: rows.filter(item => item.statusCode === 'on-track' || item.statusCode === 'near').length,
      passRate: completedRows.length ? Math.round(completedRows.filter(item => (item.elapsedSeconds || 0) <= (item.targetMinutes || 0) * 60).length / completedRows.length * 100) : 0,
      totalTargetSeconds,
      totalActualPercent: Math.min(100, Math.round(totalActualSeconds / Math.max(1, totalTargetSeconds) * 100)),
      slowestName: slowest ? slowest.name : '',
      slowestText: slowest ? slowest.actualText : '',
      shortestName: shortest ? shortest.name : '',
      shortestText: shortest ? shortest.actualText : '',
      rows
    }
  },

  showReport(record) {
    const report = this.prepareReport(record)
    const rows = this.decorateRows(report.rows)
    const activeRows = rows.filter(item => (item.elapsedSeconds || 0) > 0)
    this.setData({
      view: 'report',
      report,
      reportView: activeRows.length ? activeRows : rows,
      reportExpanded: false
    })
  },

  changeModuleName(event) {
    const modules = clone(this.data.modules)
    modules[event.currentTarget.dataset.index].name = event.detail.value
    this.setData({ modules })
  },

  normalizeModuleName(event) {
    const index = Number(event.currentTarget.dataset.index)
    const modules = clone(this.data.modules)
    const name = modules[index].name.trim()
    if (modules[index].name === name && name) return
    modules[index].name = name || '未命名模块'
    this.setData({ modules })
  },

  changeMinutes(event) {
    this.updateMinutes(event.currentTarget.dataset.index, event.detail.value)
  },

  changeSlider(event) {
    this.updateMinutes(event.currentTarget.dataset.index, event.detail.value)
  },

  adjustMinutes(event) {
    const index = Number(event.currentTarget.dataset.index)
    const step = Number(event.currentTarget.dataset.step)
    this.updateMinutes(index, this.data.modules[index].targetMinutes + step)
  },

  updateMinutes(index, value) {
    const modules = clone(this.data.modules)
    modules[index].targetMinutes = Math.min(60, Math.max(0, Number(value) || 0))
    this.setData({ modules }, this.refreshConfig)
  },

  openPresetSheet() {
    if ((this.data.modules || []).length >= MODULE_LIMIT) {
      wx.showToast({ title: `最多 ${MODULE_LIMIT} 个模块`, icon: 'none' })
      return
    }
    this.setData({ presetSheetOpen: true })
  },

  closePresetSheet() {
    this.setData({ presetSheetOpen: false })
  },

  pickPreset(event) {
    if ((this.data.modules || []).length >= MODULE_LIMIT) {
      wx.showToast({ title: `最多 ${MODULE_LIMIT} 个模块`, icon: 'none' })
      this.setData({ presetSheetOpen: false })
      return
    }
    const preset = (this.data.presets || [])[Number(event.currentTarget.dataset.index)]
    if (!preset) return
    const modules = this.data.modules.concat({ id: `module-${Date.now()}`, name: preset.name, targetMinutes: preset.minutes })
    this.setData({ modules, presetSheetOpen: false, addVisible: true }, this.refreshConfig)
  },

  pickCustom() {
    if ((this.data.modules || []).length >= MODULE_LIMIT) {
      wx.showToast({ title: `最多 ${MODULE_LIMIT} 个模块`, icon: 'none' })
      this.setData({ presetSheetOpen: false })
      return
    }
    const modules = this.data.modules.concat({ id: `module-${Date.now()}`, name: `新模块 ${this.data.modules.length + 1}`, targetMinutes: 10 })
    this.setData({ modules, presetSheetOpen: false, addVisible: true }, this.refreshConfig)
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
        this.setData({ modules }, this.refreshConfig)
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
      dragStyle: 'transform: translateY(0px) scale(1.02); z-index: 4;',
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
    this.setData({ dragStyles, dragStyle: `transform: translateY(${Math.round(delta)}px) scale(1.02); z-index: 4;` })
  },

  touchEnd() {
    if (!this.dragActive) return
    this.dragActive = false
    const fromIndex = this.dragOriginalIndex
    const length = this.data.modules.length
    const toIndex = Math.min(length - 1, Math.max(0, this.dragTargetIndex))
    const stride = this.getStride()
    const residual = Math.round(this.dragDelta - (toIndex - fromIndex) * stride)
    const modules = clone(this.data.modules)
    const [moved] = modules.splice(fromIndex, 1)
    modules.splice(toIndex, 0, moved)
    this.dragHaptic = false
    clearTimeout(this.dragWatchdog)
    const payload = {
      modules,
      dragging: false,
      dragIndex: -1,
      dragStyle: '',
      dragStyles: Array(modules.length).fill(''),
      settleIndex: -1,
      settleStyle: ''
    }
    // 松手后把卡片从手指位置平滑吸附到最终格位，避免视觉跳变
    if (Math.abs(residual) > 2) {
      payload.settleIndex = toIndex
      payload.settleStyle = `transform: translateY(${residual}px) scale(1.02); z-index: 4;`
    }
    this.setData(payload, () => {
      this.refreshConfig()
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
        const payload = { templates, templateName: currentName }
        if (this.data.templateName === name && fallback && fallback.modules) {
          payload.modules = this.withIds(clone(fallback.modules))
        }
        this.setData(payload, () => {
          if (payload.modules) this.refreshConfig()
        })
        wx.showToast({ title: '模板已删除', icon: 'none' })
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

  openSettings() {
    this.goPage('/pages/settings/settings')
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

  openStats(event) {
    const tab = (event.currentTarget.dataset.tab || 'overview')
    if (tab === 'focus') {
      this.goPage('/pages/settings/settings')
      return
    }
    if (tab === 'todo') {
      this.goPage('/pages/todo/todo')
      return
    }
    this.goPage(`/pages/stats/stats?tab=${tab}`)
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
    wx.navigateTo({ url: '/pages/timer/timer' })
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
    const rows = this.data.report && this.data.report.rows ? this.data.report.rows : []
    if (!rows.length) {
      wx.showToast({ title: '没有可重练的模块', icon: 'none' })
      return
    }
    this.beginTraining(
      rows.map(item => ({ id: item.id, name: item.name, targetMinutes: item.targetMinutes })),
      this.data.report.mode || this.data.mode || 'countup'
    )
  },

  backToConfig() {
    this.setOrientation('portrait')
    this.setData({ view: 'config' }, this.refreshConfig)
  },

  setOrientation(value) {
    if (wx.setDeviceOrientation) {
      wx.setDeviceOrientation({ value })
    }
  },

  goTools() {
    wx.switchTab({ url: '/pages/tools/tools' })
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



  backToConfig() {
    this.setOrientation('portrait')
    this.setData({ view: 'config' }, this.refreshConfig)
  },

  setOrientation(value) {
    if (wx.setDeviceOrientation) {
      wx.setDeviceOrientation({ value })
    }
  },

  createReportImage(callback) {
    const report = this.data.report
    const palette = ((app.getTheme && app.getTheme().canvas) || {
      bg: '#FBF3DF', card: '#FFFCF2', panel: '#4B3A2A', onPanel: '#FFFCF2', ink: '#4B3A2A',
      sub: '#8A7048', accent: '#FFE7A5', soft: '#FFF3D6', highlight: '#FFD166', success: '#4F9B74', danger: '#E8442F'
    })
    const context = wx.createCanvasContext('reportCanvas', this)
    context.setFillStyle(palette.bg)
    context.fillRect(0, 0, 750, 1200)
    context.setFillStyle(palette.panel)
    context.fillRect(32, 32, 686, 250)
    context.setFillStyle(palette.onPanel)
    context.setFontSize(34)
    context.fillText('训练打卡 · 完成', 64, 92)
    context.setFillStyle(palette.accent)
    context.setFontSize(22)
    context.fillText(`训练时间  ${report.startedAtText}`, 64, 136)
    context.setFillStyle(palette.highlight)
    context.setFontSize(54)
    context.fillText(`${report.passRate}%`, 64, 230)
    context.setFillStyle(palette.onPanel)
    context.setFontSize(20)
    context.fillText(`达标率 · 超时 ${report.overtimeCount}/${report.rows.length} 个模块`, 220, 226)
    context.setFillStyle(palette.card)
    context.fillRect(32, 310, 686, 600)
    context.setFillStyle(palette.ink)
    context.setFontSize(28)
    context.fillText('专注记录', 64, 360)
    context.setFillStyle(palette.sub)
    context.setFontSize(20)
    context.fillText(`实际用时 ${report.totalActualText}   计划 ${report.totalTarget}:00`, 64, 398)
    const activeRows = report.rows.filter(row => (row.elapsedSeconds || 0) > 0)
    const rows = activeRows.length ? activeRows : report.rows
    rows.forEach((row, index) => {
      const y = 460 + index * 70
      context.setFillStyle(palette.soft)
      context.fillRect(64, y - 28, 622, 48)
      context.setFillStyle(palette.ink)
      context.setFontSize(20)
      context.fillText(`${String(index + 1).padStart(2, '0')}  ${row.name}`, 82, y)
      context.setFillStyle(row.deltaSeconds > 0 ? palette.danger : palette.success)
      context.setFontSize(18)
      context.fillText(`${row.actualText} · ${row.deltaText}`, 420, y)
    })
    context.draw(false, () => {
      wx.canvasToTempFilePath({
        canvasId: 'reportCanvas',
        destWidth: 1500,
        destHeight: 2400,
        success: ({ tempFilePath }) => callback(tempFilePath),
        fail: (error) => wx.showModal({ title: '导出失败', content: error.errMsg || '请手动截图保存报告', showCancel: false })
      }, this)
    })
  },

  exportReport() {
    this.createReportImage(tempFilePath => {
      wx.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => wx.showToast({ title: '打卡图已保存', icon: 'success' }),
        fail: error => wx.showModal({ title: '保存失败', content: error.errMsg || '请允许保存到相册后重试', showCancel: false })
      })
    })
  },

  shareReport() {
    this.createReportImage((tempFilePath) => {
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
