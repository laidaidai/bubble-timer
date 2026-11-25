const app = getApp()
const { dateTimeText } = require('../../utils/format')

Page({
  data: {
    // 首帧就按当前设备与主题渲染，避免桌面上先闪一下手机版顶栏 / 默认配色
    isDesktop: !!(getApp() && getApp().globalData && getApp().globalData.isDesktop),
    theme: 'sky', themeStyle: '',
    records: [],
    timerLaunching: false,
    historyReveal: false,
    burstingIndex: -1
  },

  syncTheme() {
    const theme = app.getTheme ? app.getTheme() : { key: 'rose' }
    if (theme.key !== this.data.theme || (theme.style || '') !== this.data.themeStyle) {
      this.setData({ theme: theme.key, themeStyle: theme.style || '' })
    }
    if (app.applyNavBar) app.applyNavBar()
  },

  onLoad() {
    this.setData({ isDesktop: !!(getApp().globalData && getApp().globalData.isDesktop) })
    this.syncTheme()
    this.loadRecords()
  },

  // 在记录页拖动窗口：重判桌面档，避免整页继续按手机 rpx 等比放大
  onResize() {
    const desktop = app && app.detectEnvironment
      ? app.detectEnvironment()
      : !!(app && app.globalData && app.globalData.isDesktop)
    if (desktop !== this.data.isDesktop) this.setData({ isDesktop: desktop })
  },

  onShow() {
    if (this.data.timerLaunching) {
      clearTimeout(this.timerCoverTimer)
      this.timerCoverTimer = setTimeout(() => this.setData({ timerLaunching: false }), 160)
    }
    this.syncTheme()
    if (this.getTabBar && this.getTabBar()) this.getTabBar().sync()
    this.loadRecords()
    this.playHistoryReveal()
  },

  // 每次回到记录页都重新播放一次入场动效
  playHistoryReveal() {
    clearTimeout(this.historyRevealTimer)
    this.setData({ historyReveal: false }, () => {
      this.historyRevealTimer = setTimeout(() => this.setData({ historyReveal: true }), 40)
    })
  },

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

  // 旧记录可能缺少 startedAt，或 startedAtText 已写成 NaN；优先用记录 id 里的时间兜底
  recordStartedAtText(record) {
    if (!record) return ''
    const text = record.startedAt ? dateTimeText(record.startedAt) : ''
    if (text) return text
    const savedText = String(record.startedAtText || '')
    if (savedText && savedText.indexOf('NaN') === -1) return savedText
    const idMatch = String(record.id || '').match(/^record-(\d{10,13})$/)
    return idMatch ? dateTimeText(Number(idMatch[1])) : ''
  },

  loadRecords() {
    const records = (wx.getStorageSync(app.globalData.recordsKey) || []).map(record => {
      const names = (record.rows || []).map(item => item.name).filter(Boolean)
      const ctx = record.context || {}
      // 带卷计时优先显示卷名；未关联成绩的会话在历史里保留「去填答案」。
      return {
        ...record,
        title: ctx.paperName || names[0] || '训练记录',
        startedAtText: this.recordStartedAtText(record),
        pendingAnswer: !!(ctx.source === 'grade' && ctx.paperId && !record.gradeRecordId)
      }
    })
    this.setData({ records })
  },

  openReport(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record) return
    wx.setStorageSync('exam-timer-pending-report', record)
    // 让首页知道报告是从记录页点开的，返回时回到记录列表
    wx.setStorageSync('exam-timer-report-origin', 'history')
    this.backToIndex()
  },

  // 重跑直接进计时页，不再回首页
  rerunRecord(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record || !record.rows || !record.rows.length) return
    const runtimeModules = record.rows.map(item => ({
      id: item.id,
      name: item.name,
      targetMinutes: item.targetMinutes,
      elapsedSeconds: 0,
      status: item.targetMinutes === 0 ? 'done' : 'pending',
      moduleKey: item.moduleKey || '',
      start: item.start,
      end: item.end,
      questionCount: item.questionCount
    }))
    const firstIndex = runtimeModules.findIndex(item => item.status !== 'done')
    if (firstIndex === -1) {
      wx.showToast({ title: '这条记录没有有效模块', icon: 'none' })
      return
    }
    runtimeModules[firstIndex].status = 'current'
    const mode = record.mode || wx.getStorageSync(app.globalData.modeKey) || 'countup'
    const totalTargetSeconds = runtimeModules.reduce((sum, item) => sum + (item.targetMinutes || 0) * 60, 0)
    wx.setStorageSync(app.globalData.modeKey, mode)
    wx.setStorageSync(app.globalData.storageKey, {
      modules: runtimeModules,
      startedAt: Date.now(),
      currentIndex: firstIndex,
      globalSeconds: 0,
      moduleSeconds: 0,
      isPaused: false,
      mode,
      totalTargetSeconds,
      // 重跑带卷计时仍保留卷面上下文，计时完照样自动去填答案
      context: record.context && record.context.paperId ? Object.assign({}, record.context, { linkedAt: Date.now() }) : null
    })
    this.launchTimer()
  },

  goGradeAnswer(event) {
    const record = this.data.records[Number(event.currentTarget.dataset.index)]
    if (!record || !record.context || !record.context.paperId) return
    wx.navigateTo({
      url: `/pages/grade/answer/answer?paperId=${encodeURIComponent(record.context.paperId)}&timerId=${encodeURIComponent(record.id)}`,
      fail: () => wx.showToast({ title: '打开答题页失败，请重试', icon: 'none' })
    })
  },

  clearAllRecords() {
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空全部记录？',
      content: `共 ${this.data.records.length} 条训练记录，清空后无法恢复。`,
      confirmText: '清空',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
        wx.setStorageSync(app.globalData.recordsKey, [])
        this.setData({ records: [], burstingIndex: -1 })
        wx.showToast({ title: '已清空', icon: 'none' })
      }
    })
  },

  removeRecord(event) {
    const index = Number(event.currentTarget.dataset.index)
    const record = this.data.records[index]
    if (!record) return
    wx.showModal({
      title: '删除这条记录？',
      content: `${record.startedAtText} · ${record.totalActualText}`,
      confirmText: '删除',
      confirmColor: '#E8442F',
      success: ({ confirm }) => {
        if (!confirm) return
        const next = this.data.records.filter((item, i) => i !== index)
        if (wx.vibrateShort) wx.vibrateShort({ type: 'light', fail: () => {} })
        wx.setStorageSync(app.globalData.recordsKey, next)
        this.setData({ burstingIndex: index })
        clearTimeout(this.burstTimer)
        this.burstTimer = setTimeout(() => {
          this.setData({ records: next, burstingIndex: -1 })
          wx.showToast({ title: '已删除', icon: 'none' })
        }, 580)
      }
    })
  },

  onUnload() {
    clearTimeout(this.burstTimer)
  },

  backToIndex() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  handleBack() {
    this.backToIndex()
  },

  onPageScroll(event) {
    const next = (event.scrollTop || 0) > 48
    if (next !== this.data.dockDim) this.setData({ dockDim: next })
  }
})
